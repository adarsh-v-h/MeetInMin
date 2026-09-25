from typing import Annotated
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import jwt, JWTError
from sqlalchemy.orm import Session
from sqlalchemy import select

from app.db.database import get_db
from app.db.models import User
from app.core.security import SECRET_KEY, ALGORITHM

# This tells FastAPI where the login endpoint is, so it can hook up Swagger UI properly
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="v1/auth/login")

DbSession = Annotated[Session, Depends(get_db)]

async def get_current_user(token: Annotated[str, Depends(oauth2_scheme)], db: DbSession) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        # Decode the JWT token to extract the user_id
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: int = payload.get("user_id")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
        
    # Query the database to ensure the user still exists
    user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
    if user is None:
        raise credentials_exception
        
    return user

# We create a handy alias so we can just type `user: CurrentUser` in our routes!
CurrentUser = Annotated[User, Depends(get_current_user)]
