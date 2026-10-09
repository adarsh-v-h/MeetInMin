import logging
import httpx
from typing import Optional
from app.core.config import settings
from app.services.zoho.auth import get_access_token, invalidate_token

logger = logging.getLogger(__name__)

def _extract_response_text(data: dict) -> str:
    if not isinstance(data, dict):
        return ""
    if "response" in data and isinstance(data["response"], str):
        return data["response"].strip()
    choices = data.get("choices")
    if choices and isinstance(choices, list) and len(choices) > 0:
        message = choices[0].get("message", {})
        content = message.get("content", "")
        if isinstance(content, str):
            return content.strip()
    return ""

async def generate_reply_draft_with_zoho_glm(
    email_details: dict,
    thread_messages: Optional[list[dict]] = None,
    user_instructions: Optional[str] = None
) -> str:
    """
    Generates a professional contextual reply draft for an email thread using Zoho GLM.
    Returns the raw string of the draft email body.
    """
    glm_url = settings.glm_url
    model_name = settings.ZOHO_GLM_MODEL
    org_id = settings.org_id

    system_prompt = """You are an intelligent, professional AI Email Assistant.
Your task is to draft a polite, clear, and contextual email reply to an incoming message.

CRITICAL RULES:
1. NEVER invent or hallucinate facts, dates, times, specific commitments, prices, or meeting details that are not provided in the original email, thread history, or explicit user instructions.
2. If the user provided additional notes/instructions, follow them precisely in the response.
3. If information requested in the email is unknown or absent from the context, state politely that you received the email and will follow up shortly with details.
4. Output ONLY the raw body text of the reply. Do NOT include markdown code blocks, subject headers, "Dear...", or extraneous explanations. Keep paragraphs clean and professional.
"""

    thread_text = ""
    if thread_messages and len(thread_messages) > 1:
        thread_text = "\n\nCONVERSATION THREAD HISTORY:\n"
        for i, msg in enumerate(thread_messages[:-1], 1):
            thread_text += f"[{i}] From: {msg.get('sender', '')} | Date: {msg.get('received_at', '')}\nBody: {msg.get('body_text', '')[:1000]}\n---\n"

    instructions_text = f"\nUSER INSTRUCTIONS FOR REPLIER:\n{user_instructions}\n" if user_instructions else ""

    user_prompt = f"""INCOMING EMAIL TO REPLY TO:
Subject: {email_details.get('subject', '(no subject)')}
From: {email_details.get('sender', '(unknown)')}
Received: {email_details.get('received_at', '')}

Body Text:
{email_details.get('body_text', '')[:2500]}
{thread_text}{instructions_text}

Draft a clear, polite, and professional email reply body based on the context above:"""

    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": 500,
        "temperature": 0.2,
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
            if resp.status_code == 401:
                invalidate_token()
                token = await get_access_token()
                headers["Authorization"] = f"Zoho-oauthtoken {token}"
                resp = await client.post(glm_url, headers=headers, json=payload, timeout=30.0)

        if resp.status_code == 200:
            data = resp.json()
            raw_text = _extract_response_text(data)
            if raw_text:
                return raw_text
    except Exception as err:
        logger.warning(f"GLM reply draft generation call failed: {err}")

    # Fallback template if GLM is unavailable
    sender_name = email_details.get("sender", "there").split("<")[0].strip()
    return f"Hi {sender_name},\n\nThank you for reaching out. I have received your message regarding '{email_details.get('subject', 'this matter')}' and will get back to you shortly with more details.\n\nBest regards,"
