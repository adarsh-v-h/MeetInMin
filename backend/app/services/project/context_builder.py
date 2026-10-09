import logging
from sqlalchemy.orm import Session
from sqlalchemy import select
from app.db.models import Project, ProjectMemory, ProjectDecision, ProjectAction, ProjectQuestion, Meeting, MeetingInsight

logger = logging.getLogger(__name__)

def build_project_context(project_id: str, db: Session) -> str:
    """
    Assembles the structured project context string from Project Memory,
    Active Decisions, Open Actions, Open Questions, and recent meeting summaries.
    This string is injected into GLM Stage 1 analysis prompt.
    """
    if not project_id:
        return ""

    project = db.execute(select(Project).where(Project.id == project_id)).scalar_one_or_none()
    if not project:
        return ""

    memory = db.execute(select(ProjectMemory).where(ProjectMemory.project_id == project_id)).scalar_one_or_none()
    decisions = db.execute(
        select(ProjectDecision).where(ProjectDecision.project_id == project_id, ProjectDecision.status == "active")
    ).scalars().all()

    open_actions = db.execute(
        select(ProjectAction).where(ProjectAction.project_id == project_id, ProjectAction.status.in_(["open", "in_progress"]))
    ).scalars().all()

    open_questions = db.execute(
        select(ProjectQuestion).where(ProjectQuestion.project_id == project_id, ProjectQuestion.status == "open")
    ).scalars().all()

    recent_meetings = db.execute(
        select(Meeting)
        .where(Meeting.project_id == project_id, Meeting.status == "completed")
        .order_by(Meeting.created_at.desc())
        .limit(3)
    ).scalars().all()

    lines = []
    lines.append(f"PROJECT NAME: {project.name}")
    if project.description:
        lines.append(f"PROJECT DESCRIPTION: {project.description}")

    lines.append("\n--- CURRENT PROJECT STATE & MEMORY ---")
    if memory and memory.current_state:
        lines.append(memory.current_state)
    else:
        lines.append("No previous meeting state recorded yet. This is the first meeting or initialization phase for this project.")

    if decisions:
        lines.append("\n--- ACTIVE KEY DECISIONS ---")
        for d in decisions:
            lines.append(f"- {d.decision_text}")

    if open_actions:
        lines.append("\n--- OPEN ACTION ITEMS ---")
        for a in open_actions:
            assignee_str = f" (Assignee: {a.assignee})" if a.assignee else ""
            lines.append(f"- {a.task}{assignee_str} [Status: {a.status}]")

    if open_questions:
        lines.append("\n--- OPEN QUESTIONS / UNRESOLVED ISSUES ---")
        for q in open_questions:
            lines.append(f"- {q.question}")

    if recent_meetings:
        lines.append("\n--- RECENT COMPLETED MEETINGS SUMMARY ---")
        for m in recent_meetings:
            dt_str = m.created_at.strftime("%Y-%m-%d") if m.created_at else "Unknown date"
            insight_summary = m.insight.summary if m.insight and m.insight.summary else "No summary"
            lines.append(f"\nMeeting: '{m.title}' ({dt_str})")
            lines.append(f"Summary: {insight_summary[:400]}")

    context_str = "\n".join(lines)
    logger.info(f"🧠 Built project context ({len(context_str)} chars) for project '{project.name}' ({project_id}).")
    return context_str
