from pydantic import BaseModel, Field, field_serializer
from typing import List, Optional
from datetime import datetime, timezone
from enum import Enum

class EmailClassificationEnum(str, Enum):
    NEEDS_REPLY = "NEEDS_REPLY"
    NO_REPLY_NEEDED = "NO_REPLY_NEEDED"
    UNCLEAR = "UNCLEAR"

class PendingEmailResponse(BaseModel):
    gmail_message_id: str
    thread_id: str
    subject: str
    sender: str
    recipient: Optional[str] = None
    snippet: Optional[str] = None
    body_text: Optional[str] = None
    received_at: Optional[datetime] = None
    classification: EmailClassificationEnum
    reasoning: str

    @field_serializer('received_at')
    def serialize_received_at(self, dt: Optional[datetime], _info) -> Optional[str]:
        if dt is None:
            return None
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        return dt.isoformat()

    class Config:
        from_attributes = True

class EmailDraftRequest(BaseModel):
    user_instructions: Optional[str] = Field(
        default=None,
        description="Optional instructions or notes from the user to guide the generated reply (e.g. 'I am free on Friday at 3pm')."
    )

class EmailDraftResponse(BaseModel):
    gmail_message_id: str
    thread_id: str
    recipient: str
    subject: str
    body_text: str
    in_reply_to_message_id: Optional[str] = None

class SendEmailReplyRequest(BaseModel):
    gmail_message_id: str
    thread_id: Optional[str] = None
    recipient: str
    subject: str
    body_text: str
    in_reply_to_message_id: Optional[str] = None

class SendEmailReplyResponse(BaseModel):
    success: bool
    sent_message_id: str
    thread_id: Optional[str] = None
    detail: Optional[str] = None


