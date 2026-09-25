from sqlalchemy import Column, Integer, String, DateTime, ForeignKey
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


class APIKey(Base):
    __tablename__ = "api_keys"
    
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    
    # Store the SHA-256 hash of the extension API key
    key_hash = Column(String(64), unique=True, index=True, nullable=False)
    
    # Give the user a way to identify keys (e.g., "My Laptop", "Desktop Extension")
    name = Column(String(50), default="Default Key")
    
    created_at = Column(DateTime(timezone=True), server_default=func.now())
    
    # Relationship back to the User
    user = relationship("User", back_populates="api_keys")
