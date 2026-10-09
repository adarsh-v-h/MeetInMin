from fastapi import APIRouter, HTTPException, status, Depends, UploadFile, File, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload
from typing import List, Optional
from datetime import datetime, timezone
import os
import uuid
import aiofiles

from app.api.deps import DbSession, CurrentUser
from app.db.models import Project, ProjectMemory, ProjectDecision, ProjectAction, ProjectQuestion, ProjectDocument, Meeting
from app.schemas.project import (
    ProjectCreate,
    ProjectUpdate,
    ProjectSummaryResponse,
    ProjectDetailResponse,
    ProjectMemoryResponse,
    ProjectDecisionResponse,
    ProjectActionResponse,
    ProjectQuestionResponse,
    ProjectDocumentResponse,
)
from app.schemas.meeting import MeetingSummaryResponse
from app.services.project.doc_memory_engine import process_project_document

router = APIRouter()

@router.post("", response_model=ProjectSummaryResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    payload: ProjectCreate,
    current_user: CurrentUser,
    db: DbSession
):
    clean_name = payload.name.strip()
    if len(clean_name) < 2 or len(clean_name) > 255:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Project name must be between 2 and 255 characters."
        )

    now_utc = datetime.now(timezone.utc)
    new_project = Project(
        user_id=current_user.id,
        name=clean_name,
        description=payload.description.strip() if payload.description else None,
        status="active",
        created_at=now_utc,
        updated_at=now_utc,
    )
    db.add(new_project)
    db.flush()

    # Initialize empty ProjectMemory
    initial_memory = ProjectMemory(
        project_id=new_project.id,
        current_state="Project created. Awaiting first meeting analysis.",
        updated_at=now_utc,
    )
    db.add(initial_memory)
    db.commit()
    db.refresh(new_project)

    return ProjectSummaryResponse(
        id=new_project.id,
        name=new_project.name,
        description=new_project.description,
        status=new_project.status,
        meeting_count=0,
        open_action_count=0,
        created_at=new_project.created_at,
        updated_at=new_project.updated_at,
    )


@router.get("", response_model=List[ProjectSummaryResponse])
async def list_projects(
    current_user: CurrentUser,
    db: DbSession,
    status_filter: Optional[str] = "active"
):
    query = select(Project).where(Project.user_id == current_user.id)
    if status_filter:
        query = query.where(Project.status == status_filter)

    query = query.order_by(Project.updated_at.desc())
    projects = db.execute(query).scalars().all()

    result = []
    for p in projects:
        m_count = db.execute(
            select(func.count(Meeting.id)).where(Meeting.project_id == p.id)
        ).scalar() or 0

        a_count = db.execute(
            select(func.count(ProjectAction.id)).where(
                ProjectAction.project_id == p.id,
                ProjectAction.status.in_(["open", "in_progress"])
            )
        ).scalar() or 0

        result.append(ProjectSummaryResponse(
            id=p.id,
            name=p.name,
            description=p.description,
            status=p.status,
            meeting_count=m_count,
            open_action_count=a_count,
            created_at=p.created_at,
            updated_at=p.updated_at,
        ))

    return result


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project_details(
    project_id: str,
    current_user: CurrentUser,
    db: DbSession
):
    project = db.execute(
        select(Project).options(
            joinedload(Project.project_memory),
            joinedload(Project.decisions),
            joinedload(Project.actions),
            joinedload(Project.questions),
            joinedload(Project.documents),
            joinedload(Project.meetings).joinedload(Meeting.api_key),
        ).where(Project.id == project_id, Project.user_id == current_user.id)
    ).unique().scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Map meeting summaries
    meeting_summaries = []
    for m in sorted(project.meetings, key=lambda x: x.created_at, reverse=True):
        meeting_summaries.append(MeetingSummaryResponse(
            id=m.id,
            title=m.title,
            created_at=m.created_at,
            status=m.status,
            duration=m.duration,
            api_key_name=m.api_key.name if m.api_key else None,
            project_id=m.project_id,
            project_name=project.name,
        ))

    memory_resp = None
    if project.project_memory:
        memory_resp = ProjectMemoryResponse(
            id=project.project_memory.id,
            current_state=project.project_memory.current_state,
            summary=project.project_memory.summary,
            updated_at=project.project_memory.updated_at,
        )

    decisions_resp = [
        ProjectDecisionResponse(
            id=d.id,
            decision_text=d.decision_text,
            status=d.status,
            source_meeting_id=d.source_meeting_id,
            confidence_score=d.confidence_score,
            confidence_reason=d.confidence_reason,
            created_at=d.created_at,
        ) for d in project.decisions
    ]

    actions_resp = [
        ProjectActionResponse(
            id=a.id,
            task=a.task,
            assignee=a.assignee,
            status=a.status,
            source_meeting_id=a.source_meeting_id,
            confidence_score=a.confidence_score,
            confidence_reason=a.confidence_reason,
            created_at=a.created_at,
        ) for a in project.actions
    ]

    questions_resp = [
        ProjectQuestionResponse(
            id=q.id,
            question=q.question,
            status=q.status,
            source_meeting_id=q.source_meeting_id,
            created_at=q.created_at,
        ) for q in project.questions
    ]

    documents_resp = [
        ProjectDocumentResponse(
            id=doc.id,
            project_id=doc.project_id,
            filename=doc.filename,
            mime_type=doc.mime_type,
            file_size=doc.file_size,
            processing_status=doc.processing_status,
            error_message=doc.error_message,
            uploaded_at=doc.uploaded_at,
        ) for doc in sorted(project.documents, key=lambda x: x.uploaded_at, reverse=True)
    ]

    return ProjectDetailResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        status=project.status,
        created_at=project.created_at,
        updated_at=project.updated_at,
        memory=memory_resp,
        decisions=decisions_resp,
        actions=actions_resp,
        questions=questions_resp,
        meetings=meeting_summaries,
        documents=documents_resp,
    )


@router.patch("/{project_id}", response_model=ProjectSummaryResponse)
async def update_project(
    project_id: str,
    payload: ProjectUpdate,
    current_user: CurrentUser,
    db: DbSession
):
    project = db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == current_user.id)
    ).scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if payload.name is not None:
        clean_name = payload.name.strip()
        if len(clean_name) < 2 or len(clean_name) > 255:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Project name must be between 2 and 255 characters."
            )
        project.name = clean_name

    if payload.description is not None:
        project.description = payload.description.strip() if payload.description else None

    if payload.status is not None and payload.status in ["active", "archived"]:
        project.status = payload.status

    project.updated_at = datetime.now(timezone.utc)
    db.commit()
    db.refresh(project)

    m_count = db.execute(
        select(func.count(Meeting.id)).where(Meeting.project_id == project.id)
    ).scalar() or 0

    a_count = db.execute(
        select(func.count(ProjectAction.id)).where(
            ProjectAction.project_id == project.id,
            ProjectAction.status.in_(["open", "in_progress"])
        )
    ).scalar() or 0

    return ProjectSummaryResponse(
        id=project.id,
        name=project.name,
        description=project.description,
        status=project.status,
        meeting_count=m_count,
        open_action_count=a_count,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


@router.delete("/{project_id}")
async def delete_project(
    project_id: str,
    current_user: CurrentUser,
    db: DbSession
):
    project = db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == current_user.id)
    ).scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Unlink all meetings belonging to this project (make them standalone)
    db.execute(
        Meeting.__table__.update()
        .where(Meeting.project_id == project_id)
        .values(project_id=None)
    )

    db.delete(project)
    db.commit()

    return {"status": "success", "message": f"Project '{project.name}' deleted. Associated meetings converted to standalone."}


# Document Upload & Processing Endpoints
UPLOAD_PROJECT_DOCS_DIR = "uploaded_project_docs"
os.makedirs(UPLOAD_PROJECT_DOCS_DIR, exist_ok=True)
ALLOWED_DOC_EXTENSIONS = {"pdf", "docx", "md", "txt"}
MAX_FILE_SIZE_BYTES = 15 * 1024 * 1024 # 15 MB

@router.post("/{project_id}/documents", response_model=ProjectDocumentResponse, status_code=status.HTTP_201_CREATED)
async def upload_project_document(
    project_id: str,
    current_user: CurrentUser,
    db: DbSession,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    project = db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == current_user.id)
    ).scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    ext = file.filename.split(".")[-1].lower() if "." in file.filename else ""
    if ext not in ALLOWED_DOC_EXTENSIONS:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Unsupported file format '.{ext}'. Allowed formats: .pdf, .docx, .md, .txt"
        )

    # Collision-free filename: <username>_<clean_project_name>_<doc_uuid>_<original_filename>.<ext>
    doc_uuid = str(uuid.uuid4())
    clean_username = "".join([c for c in current_user.username if c.isalnum()]) or "user"
    clean_projname = "".join([c for c in project.name if c.isalnum()]) or "proj"
    clean_orig_name = "".join([c if c.isalnum() or c in "._-" else "_" for c in file.filename])
    unique_filename = f"{clean_username}_{clean_projname}_{doc_uuid[:8]}_{clean_orig_name}"
    storage_path = os.path.join(UPLOAD_PROJECT_DOCS_DIR, unique_filename)

    file_size = 0
    async with aiofiles.open(storage_path, "wb") as out_file:
        while chunk := await file.read(1024 * 1024):
            file_size += len(chunk)
            if file_size > MAX_FILE_SIZE_BYTES:
                out_file.close()
                if os.path.exists(storage_path):
                    os.remove(storage_path)
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail="File size exceeds the 15 MB limit."
                )
            await out_file.write(chunk)

    now_utc = datetime.now(timezone.utc)
    new_doc = ProjectDocument(
        id=doc_uuid,
        project_id=project.id,
        filename=file.filename,
        mime_type=file.content_type,
        storage_path=storage_path,
        file_size=file_size,
        processing_status="uploaded",
        uploaded_at=now_utc,
    )
    db.add(new_doc)
    db.commit()
    db.refresh(new_doc)

    # Trigger background AI memory synthesis for document
    background_tasks.add_task(process_project_document, new_doc.id, db)

    return ProjectDocumentResponse.model_validate(new_doc)


@router.get("/{project_id}/documents", response_model=List[ProjectDocumentResponse])
async def list_project_documents(
    project_id: str,
    current_user: CurrentUser,
    db: DbSession
):
    project = db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == current_user.id)
    ).scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    docs = db.execute(
        select(ProjectDocument)
        .where(ProjectDocument.project_id == project_id)
        .order_by(ProjectDocument.uploaded_at.desc())
    ).scalars().all()

    return [ProjectDocumentResponse.model_validate(d) for d in docs]


@router.get("/{project_id}/documents/{doc_id}/download", response_class=FileResponse)
async def download_project_document(
    project_id: str,
    doc_id: str,
    current_user: CurrentUser,
    db: DbSession
):
    project = db.execute(
        select(Project).where(Project.id == project_id, Project.user_id == current_user.id)
    ).scalar_one_or_none()

    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    doc = db.execute(
        select(ProjectDocument).where(ProjectDocument.id == doc_id, ProjectDocument.project_id == project_id)
    ).scalar_one_or_none()

    if not doc:
        raise HTTPException(status_code=404, detail="Document not found")

    if not doc.storage_path or not os.path.exists(doc.storage_path):
        raise HTTPException(status_code=404, detail="Original document file missing from disk.")

    return FileResponse(
        path=doc.storage_path,
        filename=doc.filename,
        media_type=doc.mime_type or "application/octet-stream"
    )

