"""
Gmail API client — handles token exchange, message search, and message body retrieval.

All calls use the user's stored google_refresh_token to mint a short-lived access token
on demand. We only ever store a 200-char snippet of each email — never the full body.
"""

import base64
import logging
import re
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from typing import Optional

import httpx

logger = logging.getLogger(__name__)

_GMAIL_TOKEN_URL = "https://oauth2.googleapis.com/token"
_GMAIL_API_BASE = "https://gmail.googleapis.com/gmail/v1/users/me"


class GmailClientError(Exception):
    """Raised when a Gmail API call fails unrecoverably."""
    pass


async def get_gmail_access_token(
    google_refresh_token: str,
    client_id: str,
    client_secret: str,
    timeout: float = 10.0,
) -> str:
    """
    Exchange the stored Google OAuth refresh token for a short-lived access token.
    Called fresh for every enrichment run — no in-memory caching (unlike the Zoho token
    manager) because Gmail tokens are per-user rather than per-service.
    """
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            _GMAIL_TOKEN_URL,
            data={
                "grant_type": "refresh_token",
                "refresh_token": google_refresh_token,
                "client_id": client_id,
                "client_secret": client_secret,
            },
            timeout=timeout,
        )

        if resp.status_code != 200:
            body = resp.text[:200] if resp.text else "<empty>"
            raise GmailClientError(
                f"Gmail token exchange failed (HTTP {resp.status_code}): {body}"
            )

        data = resp.json()
        access_token = data.get("access_token")
        if not access_token:
            raise GmailClientError(
                f"Gmail token exchange response missing access_token: {data}"
            )
        return access_token


async def search_gmail_messages(
    access_token: str,
    query: str,
    max_results: int = 10,
    timeout: float = 15.0,
) -> list[dict]:
    """
    Search the user's Gmail inbox using the provided query string.
    Returns a list of lightweight message dicts: {"id": "...", "threadId": "..."}.
    Returns an empty list if no messages match — never raises on empty results.
    """
    url = f"{_GMAIL_API_BASE}/messages"
    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"q": query, "maxResults": max_results}

    async with httpx.AsyncClient() as client:
        resp = await client.get(url, headers=headers, params=params, timeout=timeout)

        if resp.status_code == 401:
            raise GmailClientError("Gmail search returned 401 — access token invalid or revoked.")
        if resp.status_code != 200:
            body = resp.text[:200] if resp.text else "<empty>"
            raise GmailClientError(f"Gmail search failed (HTTP {resp.status_code}): {body}")

        data = resp.json()
        messages = data.get("messages", [])
        logger.info(f"Gmail search returned {len(messages)} message(s) for query: {query[:80]}...")
        return messages


async def get_message_details(
    access_token: str,
    message_id: str,
    timeout: float = 10.0,
) -> Optional[dict]:
    """
    Fetch a single Gmail message and return a structured dict with:
      - gmail_message_id
      - subject
      - sender
      - received_at (datetime or None)
      - body_text (plain text, max 3000 chars)
      - snippet (first 200 chars of body_text — for DB storage)

    Returns None if the message cannot be fetched or parsed.
    """
    url = f"{_GMAIL_API_BASE}/messages/{message_id}"
    headers = {"Authorization": f"Bearer {access_token}"}
    params = {"format": "full"}

    try:
        async with httpx.AsyncClient() as client:
            resp = await client.get(url, headers=headers, params=params, timeout=timeout)

        if resp.status_code != 200:
            logger.warning(f"Could not fetch Gmail message {message_id} (HTTP {resp.status_code})")
            return None

        data = resp.json()
        payload = data.get("payload", {})
        headers_list = payload.get("headers", [])

        def _header(name: str) -> str:
            for h in headers_list:
                if h.get("name", "").lower() == name.lower():
                    return h.get("value", "")
            return ""

        subject = _header("Subject") or "(no subject)"
        sender = _header("From") or "(unknown sender)"
        date_str = _header("Date")

        received_at = None
        if date_str:
            try:
                received_at = parsedate_to_datetime(date_str)
                if received_at.tzinfo is None:
                    received_at = received_at.replace(tzinfo=timezone.utc)
            except Exception:
                received_at = None

        body_text = _extract_plain_text(payload)

        return {
            "gmail_message_id": message_id,
            "subject": subject,
            "sender": sender,
            "received_at": received_at,
            "body_text": body_text[:3000] if body_text else "",
            "snippet": (body_text[:200] if body_text else ""),
        }

    except httpx.HTTPError as e:
        logger.warning(f"Network error fetching Gmail message {message_id}: {e}")
        return None


# ─── Private helpers ──────────────────────────────────────────────────────────

def _extract_plain_text(payload: dict) -> str:
    """
    Recursively walk the MIME payload to extract plain text body.
    Prefers text/plain; falls back to stripping HTML from text/html.
    """
    mime_type = payload.get("mimeType", "")

    if mime_type == "text/plain":
        return _decode_body(payload.get("body", {}).get("data", ""))

    if mime_type == "text/html":
        html = _decode_body(payload.get("body", {}).get("data", ""))
        return _strip_html(html)

    # Multipart — recurse into parts
    parts = payload.get("parts", [])
    # Prefer text/plain part first
    for part in parts:
        if part.get("mimeType") == "text/plain":
            text = _decode_body(part.get("body", {}).get("data", ""))
            if text.strip():
                return text

    for part in parts:
        text = _extract_plain_text(part)
        if text.strip():
            return text

    return ""


def _decode_body(data: str) -> str:
    """Base64url-decode a Gmail message body data field."""
    if not data:
        return ""
    try:
        padded = data + "=" * (-len(data) % 4)
        return base64.urlsafe_b64decode(padded).decode("utf-8", errors="replace")
    except Exception:
        return ""


def _strip_html(html: str) -> str:
    """Minimal HTML-to-text: remove tags and decode common entities."""
    if not html:
        return ""
    text = re.sub(r"<style[^>]*>.*?</style>", " ", html, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<script[^>]*>.*?</script>", " ", text, flags=re.DOTALL | re.IGNORECASE)
    text = re.sub(r"<[^>]+>", " ", text)
    text = text.replace("&nbsp;", " ").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">").replace("&quot;", '"')
    text = re.sub(r"\s{2,}", " ", text)
    return text.strip()
