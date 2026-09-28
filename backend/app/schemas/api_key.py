from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime

class APIKeyCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=50)

class APIKeyResponse(BaseModel):
    id: int
    name: str
    status: str
    created_at: datetime
    last_used_at: Optional[datetime]
    
    class Config:
        from_attributes = True

class APIKeyCreateResponse(APIKeyResponse):
    secret_key: str  # Only returned once during creation
