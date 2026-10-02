"""
Gmail context builder — orchestrates keyword extraction (GLM call #1) and
email retrieval to assemble the context string injected into the main meeting
analysis (GLM call #2).

This module is the bridge between the Gmail API client and the Zoho GLM pipeline.
"""

import asyncio
import json
import logging
from datetime import datetime, timedelta, timezone
from typing import Optional

import httpx

from app.core.config import settings
from app.services.gmail.client import (
    GmailClientError,
    get_gmail_access_token,
    get_message_details,
    search_gmail_messages,
)
from app.services.zoho.auth import get_access_token

logger = logging.getLogger(__name__)

# Maximum number of emails to retrieve and include as context
_MAX_EMAILS = 10
# Characters per email body included in the GLM context string
_MAX_BODY_CHARS_PER_EMAIL = 2000
# Date window (days) around the meeting date to search for relevant emails
_DATE_WINDOW_DAYS = 7


class ContextBuildError(Exception):
    """Raised when context building fails unrecoverably."""
    pass


async def extract_keywords_from_transcript(transcript: str) -> list[str]:
    """
    GLM Call #1 — fast keyword extraction.

    Reads the transcript and returns a list of 5–8 targeted search terms
    (names, projects, companies, dates) suitable for a Gmail q= query.

    Falls back to an empty list on any failure — the caller will then proceed
    without Gmail context rather than crashing.
    """
    if not transcript or not transcript.strip():
        return []

    glm_url = settings.glm_url
    model_name = settings.ZOHO_GLM_MODEL
    org_id = settings.org_id

    system_prompt = (
        "You are a meeting analyst. Your only job is to extract search terms from a transcript."
    )
    user_prompt = f"""From the following meeting transcript, extract up to 8 search terms:
1. Full names of people mentioned (e.g. "John Smith")
2. Project names, product names, or feature names discussed
3. Company or client names referenced
4. Critical deadline dates or time references (e.g. "Q4 2024")

Return ONLY a valid JSON array of strings. No commentary, no backticks. Example:
["John Smith", "Project Apollo", "Q4 launch", "Acme Corp"]

Transcript:
{transcript[:4000]}"""

    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": 200,
        "temperature": 0.0,
        "stream": False,
        "chat_template_kwargs": {"enable_thinking": False},
    }

    try:
        token = await get_access_token()
        headers = {
            "Authorization": f"Zoho-oauthtoken {token}",
            "CATALYST-ORG": org_id,
            "Content-Type": "application/json",
        }
        async with httpx.AsyncClient() as client:
            resp = await client.post(glm_url, headers=headers, json=payload, timeout=30.0)

        if resp.status_code != 200:
            logger.warning(f"Keyword extraction GLM returned HTTP {resp.status_code}; skipping Gmail context.")
            return []

        data = resp.json()
        raw = data.get("response") or ""
        if not raw and data.get("choices"):
            raw = data["choices"][0].get("message", {}).get("content", "")

        raw = raw.strip().lstrip("```json").lstrip("```").rstrip("```").strip()
        keywords = json.loads(raw)
        if isinstance(keywords, list):
            result = [str(k).strip() for k in keywords if k and str(k).strip()][:8]
            logger.info(f"Extracted {len(result)} Gmail search keyword(s): {result}")
            return result

    except Exception as e:
        logger.warning(f"Keyword extraction failed ({e}); falling back to no Gmail context.")

    return []


def _build_gmail_query(keywords: list[str], meeting_date: datetime) -> str:
    """
    Build a Gmail q= query string from keywords + a date window around the meeting.
    """
    date_from = (meeting_date - timedelta(days=_DATE_WINDOW_DAYS)).strftime("%Y/%m/%d")
    date_to = (meeting_date + timedelta(days=_DATE_WINDOW_DAYS)).strftime("%Y/%m/%d")

    if keywords:
        keyword_part = " OR ".join(f'"{kw}"' for kw in keywords[:6])
        return f"({keyword_part}) after:{date_from} before:{date_to}"
    else:
        return f"after:{date_from} before:{date_to}"


async def build_email_context(
    transcript: str,
    meeting_date: datetime,
    google_refresh_token: str,
) -> tuple[Optional[str], list[dict]]:
    """
    Main entry point called by the background processing task.

    Returns:
        (context_string, attribution_records)
        - context_string: formatted text block injected into the GLM prompt (or None if unavailable)
        - attribution_records: list of dicts for saving to email_context_sources table
    """
    if not google_refresh_token or not google_refresh_token.strip():
        return None, []

    client_id = settings.GOOGLE_CLIENT_ID
    client_secret = settings.GOOGLE_CLIENT_SECRET

    try:
        # Step A: get Gmail access token
        access_token = await get_gmail_access_token(
            google_refresh_token, client_id, client_secret
        )
    except GmailClientError as e:
        logger.warning(f"Could not obtain Gmail access token ({e}); skipping email context.")
        return None, []

    # Step B: extract keywords from transcript
    keywords = await extract_keywords_from_transcript(transcript)

    # Step C: build the search query and search Gmail
    query = _build_gmail_query(keywords, meeting_date)
    logger.info(f"Searching Gmail with query: {query}")

    try:
        messages = await search_gmail_messages(access_token, query, max_results=_MAX_EMAILS)
    except GmailClientError as e:
        logger.warning(f"Gmail search failed ({e}); proceeding without email context.")
        return None, []

    if not messages:
        logger.info("Gmail search returned no messages. Proceeding with transcript-only GLM call.")
        return None, []

    # Step D: fetch details for each message concurrently (up to _MAX_EMAILS)
    tasks = [
        get_message_details(access_token, msg["id"])
        for msg in messages[:_MAX_EMAILS]
    ]
    results = await asyncio.gather(*tasks, return_exceptions=True)

    email_details = []
    for r in results:
        if isinstance(r, Exception):
            logger.warning(f"Failed to fetch an email detail: {r}")
            continue
        if r is not None:
            email_details.append(r)

    if not email_details:
        logger.info("No email details could be fetched. Proceeding with transcript-only analysis.")
        return None, []

    logger.info(f"Successfully fetched {len(email_details)} email(s) for context.")

    # Step E: format context string for the GLM prompt
    context_lines = []
    for i, email in enumerate(email_details, 1):
        context_lines.append(
            f"--- Email {i} ---\n"
            f"From: {email['sender']}\n"
            f"Subject: {email['subject']}\n"
            f"Received: {email['received_at'].strftime('%Y-%m-%d') if email['received_at'] else 'Unknown'}\n"
            f"Body:\n{email['body_text'][:_MAX_BODY_CHARS_PER_EMAIL]}"
        )

    context_string = "\n\n".join(context_lines)

    # Step F: build attribution records for DB storage
    attribution_records = [
        {
            "gmail_message_id": email["gmail_message_id"],
            "subject": email["subject"],
            "sender": email["sender"],
            "received_at": email["received_at"],
            "snippet": email["snippet"],
        }
        for email in email_details
    ]

    return context_string, attribution_records
