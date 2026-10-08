from pydantic import BaseModel, Field
from typing import List, Optional, Union

class ActionItem(BaseModel):
    task: str = Field(description="The specific action item or task to be completed.")
    assignee: str = Field(description="The person responsible for the task. Use 'Unassigned' if not mentioned.")
    confidence_score: float = Field(default=0.5, description="Confidence score from 0.0 to 1.0 (e.g. 0.95 for 95%)")
    confidence_reason: Optional[str] = Field(default=None, description="Brief explanation of confidence level")

class KeyDecision(BaseModel):
    decision_text: str = Field(description="The decision made during the meeting")
    confidence_score: float = Field(default=0.5, description="Confidence score from 0.0 to 1.0")
    confidence_reason: Optional[str] = Field(default=None, description="Brief explanation of confidence level")

class SummaryBullet(BaseModel):
    point: str = Field(description="A single summary bullet point")
    confidence_score: float = Field(default=0.5, description="Confidence score from 0.0 to 1.0")
    confidence_reason: Optional[str] = Field(default=None, description="Brief explanation of confidence level")

class MeetingInsights(BaseModel):
    meeting_title: Optional[str] = Field(default=None, description="A concise 3-6 word title summarizing the meeting topic.")
    full_transcript: str = Field(description="The complete, word-for-word transcript of the entire audio recording. Do not summarize this field.")
    summary: str = Field(description="A brief, executive summary of the overall meeting.")
    summary_bullets: List[SummaryBullet] = Field(default=[], description="Structured bullet points with confidence scores.")
    key_decisions: List[Union[KeyDecision, str]] = Field(description="A list of key decisions made during the meeting.")
    action_items: List[ActionItem] = Field(description="A list of action items assigned to individuals.")

class MeetingUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=2, max_length=255, description="Meeting title must be between 2 and 255 characters.")
    project_id: Optional[str] = Field(default=None, description="Assign to project_id or null for standalone.")

class MeetingCreate(BaseModel):
    title: str = Field(min_length=2, max_length=255, description="Title for the new meeting (2-255 characters)")
    project_id: Optional[str] = Field(default=None, description="Optional project_id to assign meeting to a project.")

from datetime import datetime, timezone
from pydantic import BaseModel, Field, field_serializer, field_validator

class MeetingSummaryResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    status: str
    duration: Optional[int]
    api_key_name: Optional[str]
    project_id: Optional[str] = None
    project_name: Optional[str] = None

    @field_validator('title', mode='before')
    def validate_title(cls, v):
        if not v or not str(v).strip():
            return "Untitled Meeting"
        return str(v).strip()

    @field_serializer('created_at')
    def serialize_created_at(self, dt: Optional[datetime], _info) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    class Config:
        from_attributes = True

class PaginatedMeetings(BaseModel):
    items: List[MeetingSummaryResponse]
    total: int
    page: int
    size: int

class DBActionItem(BaseModel):
    id: int
    task: str
    assignee: Optional[str]
    is_completed: bool
    confidence_score: Optional[float] = 0.5
    confidence_reason: Optional[str] = None

    class Config:
        from_attributes = True

class DBKeyDecision(BaseModel):
    id: int
    decision_text: str
    confidence_score: Optional[float] = 0.5
    confidence_reason: Optional[str] = None

    class Config:
        from_attributes = True

class DBMeetingInsight(BaseModel):
    id: int
    summary: str
    summary_json: Optional[str] = None
    action_items: List[DBActionItem]
    key_decisions: List[DBKeyDecision]

    class Config:
        from_attributes = True

class DBTranscript(BaseModel):
    id: int
    raw_text: str

    class Config:
        from_attributes = True

class DBEmailContextSource(BaseModel):
    id: int
    gmail_message_id: str
    subject: Optional[str]
    sender: Optional[str]
    received_at: Optional[datetime]
    snippet: Optional[str]

    @field_serializer('received_at')
    def serialize_received_at(self, dt: Optional[datetime], _info) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    class Config:
        from_attributes = True

class MeetingDetailResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    status: str
    duration: Optional[int]
    api_key_name: Optional[str]
    project_id: Optional[str] = None
    project_name: Optional[str] = None

    @field_validator('title', mode='before')
    def validate_title(cls, v):
        if not v or not str(v).strip():
            return "Untitled Meeting"
        return str(v).strip()

    transcript: Optional[DBTranscript]
    insight: Optional[DBMeetingInsight]
    email_context_sources: List[DBEmailContextSource] = []

    @field_serializer('created_at')
    def serialize_created_at(self, dt: Optional[datetime], _info) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    class Config:
        from_attributes = True
