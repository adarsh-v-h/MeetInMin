from typing import Annotated
from fastapi import APIRouter, HTTPException, Depends, status
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.responses import RedirectResponse
import httpx
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from sqlalchemy import select, or_

from app.schemas.auth import UserCreate, UserResponse, Token, GoogleProfileComplete
from app.db.database import get_db
from app.api.deps import CurrentUser
from app.db.models import User
from app.core.security import get_password_hash, verify_password, create_access_token, generate_api_key, ACCESS_TOKEN_EXPIRE_MINUTES, SECRET_KEY, ALGORITHM
from app.core.config import settings
from datetime import timedelta

DbSession = Annotated[Session, Depends(get_db)]
router = APIRouter()

@router.post("/register", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
async def register(
    user: UserCreate, 
    db: DbSession
):
    # 1. Check if email exists
    existing_email = db.execute(select(User).where(User.email == user.email)).scalar_one_or_none()
    if existing_email:
        raise HTTPException(status_code=400, detail="Email already registered")

    # 2. Check if username exists
    existing_username = db.execute(select(User).where(User.username == user.username)).scalar_one_or_none()
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")

    # 3. Hash the password
    hashed_password = await get_password_hash(user.password)

    # 4. Create new user in the database
    db_user = User(
        email=user.email,
        username=user.username,
        hashed_password=hashed_password
    )
    
    db.add(db_user)
    db.commit()
    db.refresh(db_user)

    return db_user

@router.post("/login", response_model=Token)
async def login(
    form_data: Annotated[OAuth2PasswordRequestForm, Depends()],
    db: DbSession
):
    # form_data.username can be either an email OR a username!
    user = db.execute(
        select(User).where(
            or_(User.email == form_data.username, User.username == form_data.username)
        )
    ).scalar_one_or_none()

    # Generic error message so we don't leak which accounts exist
    if not user:
        raise HTTPException(status_code=400, detail="Incorrect email/username or password")
    
    # If this user registered via Google only, they might not have a password set!
    if not user.hashed_password:
        raise HTTPException(status_code=400, detail="Please log in with Google")

    # Verify the password hash
    is_valid = await verify_password(form_data.password, user.hashed_password)
    if not is_valid:
        raise HTTPException(status_code=400, detail="Incorrect email/username or password")
    
    # Generate JWT Token
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.email, "user_id": user.id}, expires_delta=access_token_expires
    )
    
    return Token(access_token=access_token, token_type="bearer")

@router.get("/login/google")
async def login_google():
    # Redirect user to Google Consent Screen
    google_auth_url = (
        f"https://accounts.google.com/o/oauth2/v2/auth?"
        f"response_type=code&"
        f"client_id={settings.GOOGLE_CLIENT_ID}&"
        f"redirect_uri={settings.GOOGLE_REDIRECT_URI}&"
        f"scope=openid%20email%20profile%20https://www.googleapis.com/auth/gmail.readonly&"
        f"access_type=offline&"
        f"prompt=consent"
    )
    return RedirectResponse(url=google_auth_url)

@router.get("/login/google/callback")
async def login_google_callback(code: str, db: DbSession):
    # 1. Exchange auth code for tokens
    token_url = "https://oauth2.googleapis.com/token"
    token_data = {
        "code": code,
        "client_id": settings.GOOGLE_CLIENT_ID,
        "client_secret": settings.GOOGLE_CLIENT_SECRET,
        "redirect_uri": settings.GOOGLE_REDIRECT_URI,
        "grant_type": "authorization_code",
    }
    
    async with httpx.AsyncClient() as client:
        token_response = await client.post(token_url, data=token_data)
        if token_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to authenticate with Google")
            
        tokens = token_response.json()
        access_token = tokens.get("access_token")
        refresh_token = tokens.get("refresh_token")
        
        # 2. Fetch user profile from Google
        userinfo_url = "https://www.googleapis.com/oauth2/v2/userinfo"
        headers = {"Authorization": f"Bearer {access_token}"}
        userinfo_response = await client.get(userinfo_url, headers=headers)
        
        if userinfo_response.status_code != 200:
            raise HTTPException(status_code=400, detail="Failed to fetch user info from Google")
            
        user_info = userinfo_response.json()
        email = user_info.get("email")
        
        # 3. Check if user exists in DB
        user = db.execute(select(User).where(User.email == email)).scalar_one_or_none()
        
        if not user:
            # OPTION 2: Hold token temporarily and redirect to "Complete Profile" UI
            temp_token = create_access_token(data={"sub": email, "refresh_token": refresh_token})
            return RedirectResponse(url=f"{settings.FRONTEND_URL}/complete-profile?token={temp_token}")
            
        # 4. User exists! Update refresh token if Google provided a new one
        if refresh_token:
            user.google_refresh_token = refresh_token
            db.commit()
            
        # 5. Generate internal JWT and redirect to dashboard
        app_token = create_access_token(data={"sub": user.email, "user_id": user.id})
        return RedirectResponse(url=f"{settings.FRONTEND_URL}/dashboard?token={app_token}")

@router.post("/complete-profile", response_model=Token)
async def complete_profile(data: GoogleProfileComplete, db: DbSession):
    # 1. Decode the temporary token generated in the callback
    try:
        payload = jwt.decode(data.temp_token, SECRET_KEY, algorithms=[ALGORITHM])
        email = payload.get("sub")
        refresh_token = payload.get("refresh_token")
        if not email:
            raise HTTPException(status_code=401, detail="Invalid temporary token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid temporary token")
        
    # 2. Check if chosen username exists
    existing_username = db.execute(select(User).where(User.username == data.username)).scalar_one_or_none()
    if existing_username:
        raise HTTPException(status_code=400, detail="Username already taken")
        
    # 3. Create the user (no password!)
    db_user = User(
        email=email,
        username=data.username,
        google_refresh_token=refresh_token
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    
    # 4. Generate final login JWT
    access_token = create_access_token(data={"sub": db_user.email, "user_id": db_user.id})
    return Token(access_token=access_token, token_type="bearer")

@router.post("/generate-api-key")
async def generate_extension_api_key(current_user: CurrentUser, db: DbSession):
    from app.db.models import APIKey
    api_key, api_key_hash = generate_api_key()
    
    new_key = APIKey(
        user_id=current_user.id,
        key_hash=api_key_hash,
        name="Chrome Extension Key"
    )
    db.add(new_key)
    db.commit()
    
    # Return the RAW api key ONLY ONCE. The user copies it to the extension.
    return {"message": "API Key generated successfully", "api_key": api_key}
