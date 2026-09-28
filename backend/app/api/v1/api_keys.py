from fastapi import APIRouter, HTTPException, Depends, status
from sqlalchemy.orm import Session
from sqlalchemy import select
from typing import List

from app.api.deps import DbSession, CurrentUser
from app.db.models import APIKey
from app.schemas.api_key import APIKeyResponse, APIKeyCreate, APIKeyCreateResponse
from app.core.security import generate_api_key

router = APIRouter()

@router.get("", response_model=List[APIKeyResponse])
async def list_api_keys(current_user: CurrentUser, db: DbSession):
    keys = db.execute(
        select(APIKey).where(APIKey.user_id == current_user.id).order_by(APIKey.created_at.desc())
    ).scalars().all()
    return keys

@router.post("", response_model=APIKeyCreateResponse, status_code=status.HTTP_201_CREATED)
async def create_api_key(key_in: APIKeyCreate, current_user: CurrentUser, db: DbSession):
    # Check uniqueness for user
    existing = db.execute(
        select(APIKey).where(APIKey.user_id == current_user.id, APIKey.name == key_in.name)
    ).scalar_one_or_none()
    
    if existing:
        raise HTTPException(status_code=400, detail="An API Key with this name already exists")
        
    api_key, api_key_hash = generate_api_key()
    
    new_key = APIKey(
        user_id=current_user.id,
        key_hash=api_key_hash,
        name=key_in.name,
        status="ACTIVE"
    )
    db.add(new_key)
    db.commit()
    db.refresh(new_key)
    
    return {
        "id": new_key.id,
        "name": new_key.name,
        "status": new_key.status,
        "created_at": new_key.created_at,
        "last_used_at": new_key.last_used_at,
        "secret_key": api_key # never saved anywhere
    }

@router.patch("/{key_id}/revoke", response_model=APIKeyResponse)
async def revoke_api_key(key_id: int, current_user: CurrentUser, db: DbSession):
    key = db.execute(
        select(APIKey).where(APIKey.id == key_id, APIKey.user_id == current_user.id)
    ).scalar_one_or_none()
    
    if not key:
        raise HTTPException(status_code=404, detail="API Key not found")
        
    if key.status == "REVOKED":
        raise HTTPException(status_code=400, detail="API Key is already revoked")
        
    key.status = "REVOKED"
    db.commit()
    db.refresh(key)
    return key
