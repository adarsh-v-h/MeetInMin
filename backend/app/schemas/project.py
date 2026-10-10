from pydantic import BaseModel, Field, field_serializer
from typing import List, Optional
from datetime import datetime, timezone
# pyrefly: ignore [missing-import]
from app.schemas.meeting import MeetingSummaryResponse

class ProjectCreate(BaseModel):
    name: str = Field(min_length=2, max_length=255, description="Project name must be between 2 and 255 characters.")
    description: Optional[str] = Field(default=None, description="Optional project description or scope.")

class ProjectUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=2, max_length=255)
    description: Optional[str] = None
    status: Optional[str] = None  # active, archived

class ProjectDecisionResponse(BaseModel):
    id: int
    decision_text: str
    status: str
    source_meeting_id: Optional[str] = None
    confidence_score: Optional[float] = 0.5
    confidence_reason: Optional[str] = None
    created_at: Optional[datetime] = None

    @field_serializer('created_at')
    def serialize_created_at(self, dt: Optional[datetime], _info) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    class Config:
        from_attributes = True

class ProjectActionResponse(BaseModel):
    id: int
    task: str
    assignee: Optional[str] = None
    status: str
    source_meeting_id: Optional[str] = None
    confidence_score: Optional[float] = 0.5
    confidence_reason: Optional[str] = None
    created_at: Optional[datetime] = None

    @field_serializer('created_at')
    def serialize_created_at(self, dt: Optional[datetime], _info) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    class Config:
        from_attributes = True

class ProjectQuestionResponse(BaseModel):
    id: int
    question: str
    status: str
    source_meeting_id: Optional[str] = None
    created_at: Optional[datetime] = None

    @field_serializer('created_at')
    def serialize_created_at(self, dt: Optional[datetime], _info) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    class Config:
        from_attributes = True

class ProjectMemoryResponse(BaseModel):
    id: int
    current_state: Optional[str] = None
    summary: Optional[str] = None
    updated_at: Optional[datetime] = None

    @field_serializer('updated_at')
    def serialize_updated_at(self, dt: Optional[datetime], _info) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    class Config:
        from_attributes = True

class ProjectSummaryResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    status: str
    meeting_count: int = 0
    open_action_count: int = 0
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_serializer('created_at', 'updated_at')
    def serialize_datetime(self, dt: Optional[datetime], _info) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    class Config:
        from_attributes = True

class ProjectDocumentResponse(BaseModel):
    id: str
    project_id: str
    filename: str
    mime_type: Optional[str] = None
    file_size: Optional[int] = None
    processing_status: str
    error_message: Optional[str] = None
    uploaded_at: Optional[datetime] = None

    @field_serializer('uploaded_at')
    def serialize_uploaded_at(self, dt: Optional[datetime], _info) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    class Config:
        from_attributes = True

class ProjectTeamMemberCreate(BaseModel):
    name: str = Field(min_length=1, max_length=255, description="Team member name")
    role: Optional[str] = Field(default=None, max_length=255, description="Team member role or title")
    email: Optional[str] = Field(default=None, max_length=255, description="Email address")
    current_focus: Optional[str] = Field(default=None, description="Current tasks or focus area")

class ProjectTeamMemberResponse(BaseModel):
    id: int
    project_id: str
    name: str
    role: Optional[str] = None
    email: Optional[str] = None
    current_focus: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    @field_serializer('created_at', 'updated_at')
    def serialize_datetime(self, dt: Optional[datetime], _info) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    class Config:
        from_attributes = True

class ProjectDetailResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    status: str
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    memory: Optional[ProjectMemoryResponse] = None
    decisions: List[ProjectDecisionResponse] = []
    actions: List[ProjectActionResponse] = []
    questions: List[ProjectQuestionResponse] = []
    meetings: List[MeetingSummaryResponse] = []
    documents: List[ProjectDocumentResponse] = []
    team_members: List[ProjectTeamMemberResponse] = []

    @field_serializer('created_at', 'updated_at')
    def serialize_datetime(self, dt: Optional[datetime], _info) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    class Config:
        from_attributes = True

