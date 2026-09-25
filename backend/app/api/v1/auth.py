from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordRequestForm
from app.schemas.auth import UserCreate, UserResponse, Token

router = APIRouter()

@router.post("/register", response_model=UserResponse)
async def register(user: UserCreate):
    # TODO: Hash password and save to database
    # For now, returning a mock response
    return UserResponse(id=1, email=user.email)

@router.post("/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends()):
    # TODO: Verify against database and generate real JWT
    # For now, accepting anything to test the API contract
    if not form_data.username or not form_data.password:
        raise HTTPException(status_code=400, detail="Incorrect email or password")
    
    return Token(access_token="mock_jwt_token_for_" + form_data.username, token_type="bearer")
