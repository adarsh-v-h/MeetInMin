import json
import logging
import httpx
from typing import Optional
from app.core.config import settings
from app.services.zoho.auth import get_access_token, invalidate_token
from app.schemas.email import EmailClassificationEnum

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

def _clean_json_text(text: str) -> str:
    cleaned = text.strip()
    if cleaned.startswith("```json"):
        cleaned = cleaned[7:]
    elif cleaned.startswith("```"):
        cleaned = cleaned[3:]
    if cleaned.endswith("```"):
        cleaned = cleaned[:-3]
    return cleaned.strip()

async def classify_email_with_zoho_glm(
    email_details: dict,
    thread_messages: Optional[list[dict]] = None,
    client: Optional[httpx.AsyncClient] = None,
) -> dict:
    """
    Classifies an email into NEEDS_REPLY, NO_REPLY_NEEDED, or UNCLEAR using Zoho GLM.
    Returns dict: {"classification": EmailClassificationEnum, "reasoning": str}
    """
    glm_url = settings.glm_url
    model_name = settings.ZOHO_GLM_MODEL
    org_id = settings.org_id

    system_prompt = """You are an intelligent Email Reply Classifier.
Your task is to analyze an incoming email (and optional thread conversation history) and classify whether the email requires a reply from the user.

Classify into exactly ONE of the following categories:
- NEEDS_REPLY: The email asks a direct question, requests information, action, approval, or feedback from the user.
- NO_REPLY_NEEDED: Automated notification, newsletter, marketing message, system alert, payment receipt, auto-responder, or the conversation is concluded.
- UNCLEAR: Ambiguous context where it is not clear if a reply is expected.

Return ONLY a valid, raw JSON object with this structure:
{
  "classification": "NEEDS_REPLY",
  "reasoning": "Brief 1-2 sentence explanation of why this email was classified this way."
}

CRITICAL RULES:
1. Output MUST be valid raw JSON with keys "classification" and "reasoning". Do not wrap in markdown.
2. Value for "classification" MUST be exactly one of: NEEDS_REPLY, NO_REPLY_NEEDED, UNCLEAR.
"""

    thread_text = ""
    if thread_messages and len(thread_messages) > 1:
        thread_text = "\n\nCONVERSATION THREAD HISTORY:\n"
        for i, msg in enumerate(thread_messages[:-1], 1):
            thread_text += f"[{i}] From: {msg.get('sender', '')} | Date: {msg.get('received_at', '')}\nBody: {msg.get('body_text', '')[:1000]}\n---\n"

    user_prompt = f"""EMAIL TO CLASSIFY:
Subject: {email_details.get('subject', '(no subject)')}
From: {email_details.get('sender', '(unknown)')}
To: {email_details.get('recipient', '(unknown)')}
Received: {email_details.get('received_at', '')}

Body Text:
{email_details.get('body_text', '')[:2500]}
{thread_text}"""

    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": 300,
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
        if client:
            resp = await client.post(glm_url, headers=headers, json=payload, timeout=30.0)
            if resp.status_code == 401:
                invalidate_token()
                token = await get_access_token()
                headers["Authorization"] = f"Zoho-oauthtoken {token}"
                resp = await client.post(glm_url, headers=headers, json=payload, timeout=30.0)
        else:
            async with httpx.AsyncClient() as c:
                resp = await c.post(glm_url, headers=headers, json=payload, timeout=30.0)
                if resp.status_code == 401:
                    invalidate_token()
                    token = await get_access_token()
                    headers["Authorization"] = f"Zoho-oauthtoken {token}"
                    resp = await c.post(glm_url, headers=headers, json=payload, timeout=30.0)


        if resp.status_code == 200:
            data = resp.json()
            raw_text = _extract_response_text(data)
            cleaned = _clean_json_text(raw_text)
            parsed = json.loads(cleaned)
            cls_val = parsed.get("classification", "").upper()
            if cls_val in EmailClassificationEnum.__members__:
                return {
                    "classification": EmailClassificationEnum(cls_val),
                    "reasoning": parsed.get("reasoning", "Classified by AI assistant.")
                }
    except Exception as err:
        logger.warning(f"GLM email classification call failed or unparseable: {err}")

    # Fallback if GLM call or parsing fails
    # Simple rule-based heuristic fallback
    body_lower = (email_details.get("body_text") or "").lower()
    subject_lower = (email_details.get("subject") or "").lower()

    if any(term in body_lower or term in subject_lower for term in ["unsubscribe", "no-reply", "noreply", "newsletter", "receipt"]):
        return {
            "classification": EmailClassificationEnum.NO_REPLY_NEEDED,
            "reasoning": "Automated notification or newsletter detected via fallback heuristic."
        }
    if "?" in body_lower or any(term in body_lower for term in ["please let me know", "can you", "could you", "thoughts?", "feedback"]):
        return {
            "classification": EmailClassificationEnum.NEEDS_REPLY,
            "reasoning": "Direct question or request detected via fallback heuristic."
        }

    return {
        "classification": EmailClassificationEnum.UNCLEAR,
        "reasoning": "Ambiguous message context."
    }
