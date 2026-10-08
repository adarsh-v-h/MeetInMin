import uuid
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Text, Boolean, UniqueConstraint, Float
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from app.db.database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(50), unique=True, index=True, nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    
    # Nullable because if they register via Google, they don't have a password!
    hashed_password = Column(String(255), nullable=True) 
    
    # Nullable because manual registers won't have this until they connect Gmail
    google_refresh_token = Column(String(255), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    updated_at = Column(DateTime(timezone=True), onupdate=func.now())

    # One-to-Many relationship with API Keys
    api_keys = relationship("APIKey", back_populates="user", cascade="all, delete-orphan")
    meetings = relationship("Meeting", back_populates="user", cascade="all, delete-orphan")


class APIKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Store the SHA-256 hash of the extension API key
    key_hash = Column(String(64), unique=True, index=True, nullable=False)
    
    # Give the user a way to identify keys (e.g., "My Laptop", "Desktop Extension")
    name = Column(String(50), default="Default Key")
    status = Column(String(20), default="ACTIVE")
    last_used_at = Column(DateTime(timezone=True), nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    __table_args__ = (UniqueConstraint('user_id', 'name', name='uix_user_key_name'),)

    # Relationship back to the User
    user = relationship("User", back_populates="api_keys")


class Meeting(Base):
    __tablename__ = "meetings"
    
    id = Column(String(36), primary_key=True, index=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    api_key_id = Column(Integer, ForeignKey("api_keys.id"), nullable=True)
    
    title = Column(String(255), default="Untitled Meeting")
    audio_file_path = Column(String(1024), nullable=True)
    status = Column(String(50), default="uploading") # uploading, transcribing, analyzing, completed, failed
    duration = Column(Integer, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationships
    user = relationship("User", back_populates="meetings")
    api_key = relationship("APIKey")
    transcript = relationship("Transcript", back_populates="meeting", uselist=False, cascade="all, delete-orphan")
    insight = relationship("MeetingInsight", back_populates="meeting", uselist=False, cascade="all, delete-orphan")
    email_context_sources = relationship("EmailContextSource", back_populates="meeting", cascade="all, delete-orphan")

class Transcript(Base):
    __tablename__ = "transcripts"
    
    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(String(36), ForeignKey("meetings.id"), unique=True, nullable=False)
    raw_text = Column(Text, nullable=False)
    
    meeting = relationship("Meeting", back_populates="transcript")

class MeetingInsight(Base):
    __tablename__ = "meeting_insights"
    
    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(String(36), ForeignKey("meetings.id"), unique=True, nullable=False)
    summary = Column(Text, nullable=False)
    summary_json = Column(Text, nullable=True)
    
    meeting = relationship("Meeting", back_populates="insight")
    action_items = relationship("ActionItem", back_populates="insight", cascade="all, delete-orphan")
    key_decisions = relationship("KeyDecision", back_populates="insight", cascade="all, delete-orphan")

class ActionItem(Base):
    __tablename__ = "action_items"
    
    id = Column(Integer, primary_key=True, index=True)
    insight_id = Column(Integer, ForeignKey("meeting_insights.id"), nullable=False)
    task = Column(Text, nullable=False)
    assignee = Column(String(255), nullable=True)
    is_completed = Column(Boolean, default=False)
    confidence_score = Column(Float, nullable=True, default=0.5)
    confidence_reason = Column(Text, nullable=True)
    
    insight = relationship("MeetingInsight", back_populates="action_items")

class KeyDecision(Base):
    __tablename__ = "key_decisions"
    
    id = Column(Integer, primary_key=True, index=True)
    insight_id = Column(Integer, ForeignKey("meeting_insights.id"), nullable=False)
    decision_text = Column(Text, nullable=False)
    confidence_score = Column(Float, nullable=True, default=0.5)
    confidence_reason = Column(Text, nullable=True)
    
    insight = relationship("MeetingInsight", back_populates="key_decisions")


class EmailContextSource(Base):
    """Stores attribution records for emails that were used as context for a meeting analysis."""
    __tablename__ = "email_context_sources"
    
    id = Column(Integer, primary_key=True, index=True)
    meeting_id = Column(String(36), ForeignKey("meetings.id"), nullable=False)
    
    # Google's permanent, stable message identifier
    gmail_message_id = Column(String(255), nullable=False)
    subject = Column(String(500), nullable=True)
    sender = Column(String(255), nullable=True)
    received_at = Column(DateTime(timezone=True), nullable=True)
    # 200-char preview for display in the UI — we never store the full email body
    snippet = Column(Text, nullable=True)
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    meeting = relationship("Meeting", back_populates="email_context_sources")
