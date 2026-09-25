import asyncio
from datetime import datetime, timedelta
from typing import Optional
import hashlib
import secrets
from jose import jwt
from argon2 import PasswordHasher

ph = PasswordHasher()

def generate_api_key() -> tuple[str, str]:
    """Generates a secure API key and its SHA-256 hash."""
    api_key = f"mim_{secrets.token_urlsafe(32)}"
    api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    return api_key, api_key_hash

# TODO: Move to .env in production
SECRET_KEY = "super-secret-key-for-development-only-change-in-prod"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 60 * 24 * 7 # 7 days token for MVP convenience

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

async def get_password_hash(password: str) -> str:
    # Hashing is intentionally slow/CPU-bound. We run it in a threadpool 
    # to avoid blocking the FastAPI async event loop.
    return await asyncio.to_thread(ph.hash, password)

async def verify_password(plain_password: str, hashed_password: str) -> bool:
    def _verify():
        try:
            return ph.verify(hashed_password, plain_password)
        except Exception:
            return False
            
    return await asyncio.to_thread(_verify)
