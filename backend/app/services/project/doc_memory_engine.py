import json
import logging
import httpx
from sqlalchemy.orm import Session
from sqlalchemy import select
from datetime import datetime, timezone
from app.core.config import settings
from app.db.models import (
    ProjectDocument, Project, ProjectMemory, ProjectDecision, ProjectAction, ProjectQuestion
)
from app.services.zoho.auth import get_access_token, invalidate_token
from app.services.project.context_builder import build_project_context
from app.services.project.doc_parser import extract_text_from_file

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

async def extract_doc_memory_delta_with_zoho_glm(
    project_context: str,
    doc_filename: str,
    doc_text: str
) -> dict:
    """
    Calls Zoho GLM to integrate document content into current Project Memory.
    """
    glm_url = settings.glm_url
    model_name = settings.ZOHO_GLM_MODEL
    org_id = settings.org_id

    system_prompt = """You are an advanced Project Knowledge & Document Integration Engine.
Your task is to update the cumulative Project State Memory after a new project document has been uploaded.

Analyze the current Project State Memory alongside the newly uploaded document text, and generate an updated Project State and Memory Delta.

Return ONLY a valid, raw JSON object with the following structure:
{
  "updated_current_state": "Comprehensive 2-4 paragraph summary of the updated project status, architectural specs, goals, and active requirements after incorporating this new document.",
  "new_decisions": [
    {
      "decision_text": "Text of key decision or architecture spec specified in document",
      "confidence_score": 0.9,
      "confidence_reason": "Extracted directly from project document"
    }
  ],
  "action_items": [
    {
      "task": "Task or deliverable required by document",
      "assignee": "Assignee name or Unassigned",
      "status": "open",
      "confidence_score": 0.85,
      "confidence_reason": "Specified in document"
    }
  ],
  "questions": [
    {
      "question": "Unresolved risk or question raised in document",
      "status": "open"
    }
  ]
}

CRITICAL RULES:
1. Synthesize the updated_current_state thoroughly so future meetings understand project specifications and context.
2. Extract all key project decisions and action items mentioned in the document.
3. Do NOT wrap output in markdown code blocks. Return ONLY raw JSON.
"""

    user_prompt = f"""EXISTING PROJECT CONTEXT:
{project_context}

NEW PROJECT DOCUMENT UPLOADED:
Filename: {doc_filename}

Document Extracted Text:
{doc_text[:8000]}
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
            logger.error(f"Zoho GLM Doc Synthesis failed with HTTP {resp.status_code}: {resp.text[:200]}")
            return {}

        data = resp.json()
        raw_text = _extract_response_text(data)
        cleaned = _clean_json_text(raw_text)
        try:
            return json.loads(cleaned)
        except Exception as e:
            logger.error(f"Failed to parse GLM Doc Synthesis JSON: {e}\nRaw text: {raw_text}")
            return {}

async def process_project_document(doc_id: str, db: Session) -> None:
    """
    Extracts text from uploaded document and synthesizes its findings into Project Memory.
    """
    doc = db.execute(select(ProjectDocument).where(ProjectDocument.id == doc_id)).scalar_one_or_none()
    if not doc:
        return

    logger.info(f"📑 Processing project document '{doc.filename}' ({doc.id})")
    doc.processing_status = "processing"
    db.commit()

    # Step 1: Extract text from file
    try:
        extracted_text = extract_text_from_file(doc.storage_path, doc.filename)
        doc.extracted_text = extracted_text[:10000] # store text preview
    except Exception as err:
        logger.error(f"Document parsing failed for '{doc.filename}': {err}")
        doc.processing_status = "failed"
        doc.error_message = str(err)
        db.commit()
        return

    # Step 2: Build current project context
    project_id = doc.project_id
    project = db.execute(select(Project).where(Project.id == project_id)).scalar_one_or_none()
    if not project:
        doc.processing_status = "failed"
        doc.error_message = "Associated project not found."
        db.commit()
        return

    project_context = build_project_context(project_id, db)

    # Step 3: Call GLM to integrate document content into Project Memory
    delta = await extract_doc_memory_delta_with_zoho_glm(
        project_context=project_context,
        doc_filename=doc.filename,
        doc_text=extracted_text
    )

    now_utc = datetime.now(timezone.utc)

    # Step 4: Update ProjectMemory state
    memory = db.execute(select(ProjectMemory).where(ProjectMemory.project_id == project_id)).scalar_one_or_none()
    updated_state = delta.get("updated_current_state") or f"Updated with details from document '{doc.filename}'."

    if not memory:
        memory = ProjectMemory(
            project_id=project_id,
            current_state=updated_state,
            summary=f"Synthesized from document '{doc.filename}'",
            updated_at=now_utc
        )
        db.add(memory)
    else:
        memory.current_state = updated_state
        memory.updated_at = now_utc

    # Step 5: Add decisions, actions, questions
    new_decisions = delta.get("new_decisions", [])
    for d in new_decisions:
        if isinstance(d, dict) and d.get("decision_text"):
            db.add(ProjectDecision(
                project_id=project_id,
                decision_text=d["decision_text"],
                status="active",
                confidence_score=d.get("confidence_score", 0.90),
                confidence_reason=d.get("confidence_reason", f"Extracted from document '{doc.filename}'")
            ))

    new_actions = delta.get("action_items", [])
    for a in new_actions:
        if isinstance(a, dict) and a.get("task"):
            db.add(ProjectAction(
                project_id=project_id,
                task=a["task"],
                assignee=a.get("assignee", "Unassigned"),
                status=a.get("status", "open"),
                confidence_score=a.get("confidence_score", 0.85),
                confidence_reason=a.get("confidence_reason", f"Specified in document '{doc.filename}'")
            ))

    new_questions = delta.get("questions", [])
    for q in new_questions:
        if isinstance(q, dict) and q.get("question"):
            db.add(ProjectQuestion(
                project_id=project_id,
                question=q["question"],
                status=q.get("status", "open")
            ))

    doc.processing_status = "ready"
    doc.error_message = None
    db.commit()
    logger.info(f"✨ Successfully integrated document '{doc.filename}' into project memory!")
