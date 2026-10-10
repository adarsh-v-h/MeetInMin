import logging
from typing import Optional, List
from sqlalchemy.orm import Session
from sqlalchemy import select, func
from datetime import datetime, timezone
from app.db.models import ProjectTeamMember

logger = logging.getLogger(__name__)

def upsert_team_members(project_id: str, team_members_data: List[dict], db: Session) -> None:
    """
    Intelligently inserts or updates team members for a given project.
    Matches existing members by case-insensitive name or email to prevent duplicate rows.
    """
    if not team_members_data or not isinstance(team_members_data, list):
        return

    for item in team_members_data:
        if not isinstance(item, dict) or not item.get("name"):
            continue

        name = item["name"].strip()
        email = (item.get("email") or "").strip() or None
        role = (item.get("role") or "").strip() or None
        current_focus = (item.get("current_focus") or "").strip() or None

        # Check for existing member by email or name
        query = select(ProjectTeamMember).where(ProjectTeamMember.project_id == project_id)
        if email:
            query = query.where(
                (func.lower(ProjectTeamMember.email) == email.lower()) |
                (func.lower(ProjectTeamMember.name) == name.lower())
            )
        else:
            query = query.where(func.lower(ProjectTeamMember.name) == name.lower())

        existing = db.execute(query).scalars().first()

        if existing:
            if role:
                existing.role = role
            if email and not existing.email:
                existing.email = email
            if current_focus:
                existing.current_focus = current_focus
            existing.updated_at = datetime.now(timezone.utc)
            logger.info(f"Updated team member '{existing.name}' for project '{project_id}'")
        else:
            new_member = ProjectTeamMember(
                project_id=project_id,
                name=name,
                role=role,
                email=email,
                current_focus=current_focus
            )
            db.add(new_member)
            logger.info(f"Added new team member '{name}' for project '{project_id}'")
