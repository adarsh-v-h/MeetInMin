from fastapi import APIRouter, HTTPException
from app.api.deps import DbSession, CurrentUser
from pydantic import BaseModel

router = APIRouter()

class UserMeResponse(BaseModel):
    username: str
    email: str
    is_google_connected: bool

@router.get("/me", response_model=UserMeResponse)
async def get_current_user_profile(current_user: CurrentUser):
    return {
        "username": current_user.username,
        "email": current_user.email,
        "is_google_connected": bool(current_user.google_refresh_token)
    }

@router.post("/me/disconnect-google")
async def disconnect_google(current_user: CurrentUser, db: DbSession):
    if not current_user.google_refresh_token:
        raise HTTPException(status_code=400, detail="Google account is not connected")
        
    current_user.google_refresh_token = None
    db.commit()
    return {"status": "success", "message": "Google account disconnected"}
