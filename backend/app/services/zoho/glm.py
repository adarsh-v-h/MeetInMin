import asyncio
import json
import logging
import random
import httpx
from app.core.config import settings
from app.schemas.meeting import MeetingInsights
from app.services.zoho.auth import get_access_token, invalidate_token

logger = logging.getLogger(__name__)

class ZohoGLMError(Exception):
    """Raised when Zoho GLM analysis fails."""
    pass

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

async def analyze_transcript_with_zoho_glm(
    transcript: str,
    email_context: str | None = None,
    max_retries: int = 3,
    base_delay: float = 1.5
) -> MeetingInsights:
    """
    Sends the stored transcript (and optional Gmail email context) to Zoho GLM
    to generate structured meeting insights.

    When email_context is provided, it is included in the prompt as supporting
    context to help GLM produce sharper summaries and more accurate action items.
    When None, the analysis runs on the transcript alone — producing complete
    results without any degradation.

    Returns a validated MeetingInsights Pydantic object.
    """
    if not transcript or not transcript.strip():
        raise ZohoGLMError("Cannot analyze an empty transcript.")

    glm_url = settings.glm_url
    model_name = settings.ZOHO_GLM_MODEL
    org_id = settings.org_id

    # Build the email context block for the prompt if available
    email_context_block = ""
    if email_context and email_context.strip():
        email_context_block = f"""

SUPPORTING EMAIL CONTEXT:
The user has provided relevant emails from their inbox. Use these ONLY to fill in
context gaps, clarify references, or add specifics the audio didn't capture.
Do NOT let the emails override or contradict what was clearly said in the transcript.
The transcript is always the primary source.

{email_context}
"""

    system_prompt = """You are an expert executive assistant and meeting intelligence analyst.
Your job is to thoroughly analyze the provided meeting transcript and extract comprehensive, structured meeting insights with confidence scores for each item.

You MUST respond ONLY with a valid, raw JSON object matching this exact schema:
{
  "summary": "An executive summary of the meeting. Synthesize all major topics, key discussions, context, and outcomes thoroughly using structured bullet points and clear paragraphs.",
  "summary_bullets": [
    {
      "point": "Specific bullet point sentence describing a key topic or outcome",
      "confidence_score": 0.95,
      "confidence_reason": "Brief explanation (e.g., 'Explicitly stated in audio')"
    }
  ],
  "key_decisions": [
    {
      "decision_text": "Comprehensive decision 1 with context",
      "confidence_score": 0.90,
      "confidence_reason": "Brief explanation (e.g., 'Direct agreement reached by team')"
    }
  ],
  "action_items": [
    {
      "task": "Specific description of the task or commitment",
      "assignee": "Person assigned (or 'Unassigned' if implicit / not explicitly named)",
      "confidence_score": 0.75,
      "confidence_reason": "Brief explanation (e.g., 'Assignee inferred from context')"
    }
  ]
}

CRITICAL INSTRUCTIONS FOR CONFIDENCE SCORING:
For EVERY summary bullet point, key decision, and action item, evaluate your confidence on a 0.00 to 1.00 float scale:
- 0.85 - 1.00: High Confidence. Directly and explicitly spoken in the transcript.
- 0.60 - 0.84: Medium Confidence. Contextually inferred or supported by email context.
- 0.00 - 0.59: Low Confidence. Assumed or speculative due to missing transcript details.

CRITICAL INSTRUCTIONS FOR COMPLETENESS AND QUALITY:
1. EXHAUSTIVE ACTION ITEMS: Extract EVERY single action item, task, follow-up, promise, or next step mentioned in the transcript. Do NOT omit minor tasks.
2. EXHAUSTIVE KEY DECISIONS: List ALL decisions made, agreed upon, or resolved during the meeting.
3. COMPREHENSIVE SUMMARY: Do NOT abbreviate or give a vague high-level summary. Cover all main agenda points and key topics discussed.
4. NO MARKDOWN WRAPPERS: Do NOT include code formatting backticks (no ```json or ```) or intro/outro text. Return ONLY the raw JSON string.
5. TRANSCRIPT PRIMACY: Base your analysis primarily on the transcript. Supporting email context (if provided) is supplementary only.
"""

    user_prompt = f"Meeting Transcript:\n\n{transcript}{email_context_block}"

    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": 4000,
        "temperature": 0.1,
        "stream": False,
        "chat_template_kwargs": {"enable_thinking": False},
    }

    last_error = None

    for attempt in range(max_retries + 1):
        try:
            token = await get_access_token()
            headers = {
                "Authorization": f"Zoho-oauthtoken {token}",
                "CATALYST-ORG": org_id,
                "Content-Type": "application/json",
            }

            logger.info(f"Sending transcript ({len(transcript)} chars) to Zoho GLM (Attempt {attempt+1}/{max_retries+1})...")

            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    glm_url,
                    headers=headers,
                    json=payload,
                    timeout=120.0
                )

                if resp.status_code == 401 and attempt < max_retries:
                    logger.warning("Zoho GLM returned 401 Unauthorized. Retrying after token refresh...")
                    invalidate_token()
                    await asyncio.sleep(1.0)
                    continue

                if resp.status_code in (429, 408) or resp.status_code >= 500:
                    if attempt < max_retries:
                        sleep_time = base_delay * (2 ** attempt) + random.uniform(0.1, 0.5)
                        logger.warning(f"Zoho GLM HTTP {resp.status_code}, retrying in {sleep_time:.2f}s...")
                        await asyncio.sleep(sleep_time)
                        continue

                if resp.status_code != 200:
                    body_preview = resp.text[:300] if resp.text else "<empty>"
                    raise ZohoGLMError(f"Zoho GLM returned HTTP {resp.status_code}: {body_preview}")

                data = resp.json()
                raw_text = _extract_response_text(data)
                if not raw_text:
                    raise ZohoGLMError(f"Zoho GLM response contained no text: {data}")

                cleaned_json = _clean_json_text(raw_text)

                try:
                    parsed_dict = json.loads(cleaned_json)
                    # Normalize key_decisions if GLM returned simple strings instead of objects
                    if "key_decisions" in parsed_dict and isinstance(parsed_dict["key_decisions"], list):
                        norm_decisions = []
                        for dec in parsed_dict["key_decisions"]:
                            if isinstance(dec, str):
                                norm_decisions.append({
                                    "decision_text": dec,
                                    "confidence_score": 0.5,
                                    "confidence_reason": "Unrated / Legacy item"
                                })
                            elif isinstance(dec, dict):
                                norm_decisions.append(dec)
                        parsed_dict["key_decisions"] = norm_decisions

                    # Add full_transcript to match schema expected by MeetingInsights
                    parsed_dict["full_transcript"] = transcript
                    insights = MeetingInsights.model_validate(parsed_dict)
                    logger.info("Successfully generated structured insights with confidence scores via Zoho GLM!")
                    return insights
                except Exception as parse_err:
                    logger.error(f"Failed to parse Zoho GLM JSON response: {parse_err}\nRaw text: {raw_text}")
                    raise ZohoGLMError(f"Zoho GLM output failed JSON validation: {parse_err}") from parse_err

        except (httpx.TimeoutException, httpx.HTTPError) as net_err:
            last_error = net_err
            if attempt < max_retries:
                sleep_time = base_delay * (2 ** attempt) + random.uniform(0.1, 0.5)
                logger.warning(f"Zoho GLM network error ({net_err}), retrying in {sleep_time:.2f}s...")
                await asyncio.sleep(sleep_time)
                continue
            raise ZohoGLMError(f"Zoho GLM failed after {max_retries+1} attempts: {net_err}") from net_err

    raise ZohoGLMError(f"Zoho GLM analysis failed: {last_error}")
