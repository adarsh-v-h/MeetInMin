from pydantic import BaseModel, Field
from typing import List, Optional

class ActionItem(BaseModel):
    task: str = Field(description="The specific action item or task to be completed.")
    assignee: str = Field(description="The person responsible for the task. Use 'Unassigned' if not mentioned.")

class MeetingInsights(BaseModel):
    full_transcript: str = Field(description="The complete, word-for-word transcript of the entire audio recording. Do not summarize this field.")
    summary: str = Field(description="A brief, executive summary of the overall meeting.")
    key_decisions: List[str] = Field(description="A list of key decisions that were made during the meeting.")
    action_items: List[ActionItem] = Field(description="A list of action items assigned to individuals.")

from datetime import datetime, timezone
from pydantic import field_serializer

class MeetingSummaryResponse(BaseModel):
    id: str
    title: str
    created_at: datetime
    status: str
    duration: Optional[int]
    api_key_name: Optional[str]

    @field_serializer('created_at')
    def serialize_created_at(self, dt: datetime, _info) -> str:
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

    class Config:
        from_attributes = True

class DBKeyDecision(BaseModel):
    id: int
    decision_text: str

    class Config:
        from_attributes = True

class DBMeetingInsight(BaseModel):
    id: int
    summary: str
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

    transcript: Optional[DBTranscript]
    insight: Optional[DBMeetingInsight]
    email_context_sources: List[DBEmailContextSource] = []

    @field_serializer('created_at')
    def serialize_created_at(self, dt: datetime, _info) -> str:
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    class Config:
        from_attributes = True
