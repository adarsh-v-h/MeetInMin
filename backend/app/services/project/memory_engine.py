import asyncio
import json
import logging
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime, timezone
from app.core.config import settings
from app.db.models import (
    Meeting, Project, ProjectMemory, ProjectDecision, ProjectAction, ProjectQuestion
)
from app.services.zoho.auth import get_access_token, invalidate_token
from app.services.project.context_builder import build_project_context

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

async def extract_memory_delta_with_zoho_glm(
    project_context: str,
    meeting_title: str,
    meeting_summary: str,
    key_decisions: list[str],
    action_items: list[dict],
    raw_transcript_snippet: str
) -> dict:
    """
    Calls Zoho GLM to calculate Stage 2 project memory delta updates.
    """
    glm_url = settings.glm_url
    model_name = settings.ZOHO_GLM_MODEL
    org_id = settings.org_id

    system_prompt = """You are an advanced Project Knowledge & State Extraction Engine.
Your task is to update the cumulative Project State Memory after a newly completed meeting.

Analyze the current Project State Memory alongside the new Meeting Details, and generate an updated Project State and Memory Delta.

Return ONLY a valid, raw JSON object with the following structure:
{
  "updated_current_state": "Comprehensive 2-4 paragraph summary of the current project status, ongoing trajectory, key achievements, and current blocking issues after integrating this meeting.",
  "new_decisions": [
    {
      "decision_text": "Text of new key decision made in this meeting",
      "confidence_score": 0.9,
      "confidence_reason": "Explicitly decided in meeting"
    }
  ],
  "action_items": [
    {
      "task": "Task description",
      "assignee": "Assignee name or Unassigned",
      "status": "open",
      "confidence_score": 0.85,
      "confidence_reason": "Assigned during meeting"
    }
  ],
  "questions": [
    {
      "question": "Unresolved question or risk identified in meeting",
      "status": "open"
    }
  ]
}

CRITICAL RULES:
1. Synthesize the updated_current_state thoroughly so future meetings understand project continuity.
2. Extract all NEW project decisions and tasks created in this meeting.
3. Do NOT wrap output in markdown code blocks. Return ONLY raw JSON.
"""

    decisions_str = "\n".join([f"- {d}" for d in key_decisions]) if key_decisions else "None"
    actions_str = "\n".join([f"- {a.get('task', '')} (Assignee: {a.get('assignee', 'Unassigned')})" for a in action_items]) if action_items else "None"

    user_prompt = f"""EXISTING PROJECT CONTEXT:
{project_context}

NEW MEETING COMPLETED:
Title: {meeting_title}
Executive Summary: {meeting_summary}

Key Decisions:
{decisions_str}

Action Items:
{actions_str}

Transcript Snippet:
{raw_transcript_snippet[:2000]}
"""

    payload = {
        "model": model_name,
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": 3000,
        "temperature": 0.1,
        "stream": False,
        "chat_template_kwargs": {"enable_thinking": False},
    }

    token = await get_access_token()
    headers = {
        "Authorization": f"Zoho-oauthtoken {token}",
        "CATALYST-ORG": org_id,
        "Content-Type": "application/json",
    }

    async with httpx.AsyncClient() as client:
        resp = await client.post(glm_url, headers=headers, json=payload, timeout=90.0)
        if resp.status_code == 401:
            invalidate_token()
            token = await get_access_token()
            headers["Authorization"] = f"Zoho-oauthtoken {token}"
            resp = await client.post(glm_url, headers=headers, json=payload, timeout=90.0)

        if resp.status_code != 200:
            logger.error(f"Zoho GLM Stage 2 failed with HTTP {resp.status_code}: {resp.text[:200]}")
            return {}

        data = resp.json()
        raw_text = _extract_response_text(data)
        cleaned = _clean_json_text(raw_text)
        try:
            return json.loads(cleaned)
        except Exception as e:
            logger.error(f"Failed to parse GLM Stage 2 response JSON: {e}\nRaw text: {raw_text}")
            return {}

async def process_project_memory_update(meeting_id: str, db: Session) -> None:
    """
    Executes Stage 2 AI Project Memory update after meeting analysis is finished.
    """
    meeting = db.execute(select(Meeting).where(Meeting.id == meeting_id)).scalar_one_or_none()
    if not meeting or not meeting.project_id:
        return

    project_id = meeting.project_id
    project = db.execute(select(Project).where(Project.id == project_id)).scalar_one_or_none()
    if not project:
        return

    logger.info(f"🔄 Executing Stage 2 Project Memory Update for meeting '{meeting.title}' -> project '{project.name}'")

    project_context = build_project_context(project_id, db)

    insight = meeting.insight
    summary_text = insight.summary if insight else "No meeting summary available."
    decisions = [d.decision_text for d in insight.key_decisions] if insight and insight.key_decisions else []
    actions = [{"task": a.task, "assignee": a.assignee} for a in insight.action_items] if insight and insight.action_items else []
    transcript_text = meeting.transcript.raw_text if meeting.transcript else ""

    delta = await extract_memory_delta_with_zoho_glm(
        project_context=project_context,
        meeting_title=meeting.title,
        meeting_summary=summary_text,
        key_decisions=decisions,
        action_items=actions,
        raw_transcript_snippet=transcript_text
    )

    now_utc = datetime.now(timezone.utc)

    # 1. Update ProjectMemory
    memory = db.execute(select(ProjectMemory).where(ProjectMemory.project_id == project_id)).scalar_one_or_none()
    updated_state = delta.get("updated_current_state") or f"Updated following meeting '{meeting.title}'."

    if not memory:
        memory = ProjectMemory(
            project_id=project_id,
            current_state=updated_state,
            summary=summary_text,
            updated_at=now_utc
        )
        db.add(memory)
    else:
        memory.current_state = updated_state
        memory.summary = summary_text
        memory.updated_at = now_utc

    # 2. Add new Project Decisions
    new_decisions = delta.get("new_decisions", [])
    for d in new_decisions:
        if isinstance(d, dict) and d.get("decision_text"):
            db.add(ProjectDecision(
                project_id=project_id,
                source_meeting_id=meeting.id,
                decision_text=d["decision_text"],
                status="active",
                confidence_score=d.get("confidence_score", 0.85),
                confidence_reason=d.get("confidence_reason", "Extracted during Stage 2 Project Memory sync")
            ))

    # 3. Add Project Actions
    new_actions = delta.get("action_items", [])
    for a in new_actions:
        if isinstance(a, dict) and a.get("task"):
            db.add(ProjectAction(
                project_id=project_id,
                source_meeting_id=meeting.id,
                task=a["task"],
                assignee=a.get("assignee", "Unassigned"),
                status=a.get("status", "open"),
                confidence_score=a.get("confidence_score", 0.85),
                confidence_reason=a.get("confidence_reason", "Extracted during Stage 2 Project Memory sync")
            ))

    # 4. Add Project Questions
    new_questions = delta.get("questions", [])
    for q in new_questions:
        if isinstance(q, dict) and q.get("question"):
            db.add(ProjectQuestion(
                project_id=project_id,
                source_meeting_id=meeting.id,
                question=q["question"],
                status=q.get("status", "open")
            ))

    db.commit()
    logger.info(f"✨ Successfully updated Project Memory for project '{project.name}' ({project_id})!")
