from pydantic import BaseModel, EmailStr, Field, model_validator

class UserCreate(BaseModel):
    email: EmailStr
    # Note: the ... as the first parameter means that the field has no default value
    # That means the caller MUST provide a value for this field
    username: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=8)
    confirm_password: str

    @model_validator(mode='after')
    def check_passwords_match(self) -> 'UserCreate':
        if self.password != self.confirm_password:
            raise ValueError('Passwords do not match')
        return self

class GoogleProfileComplete(BaseModel):
    temp_token: str
    username: str = Field(..., min_length=3, max_length=50)

class UserLogin(BaseModel):
    # Depending on your frontend, you might use OAuth2PasswordRequestForm instead
    # which uses 'username' (which can be email) and 'password'.
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserResponse(BaseModel):
    id: int
    email: EmailStr
    username: str

    class Config:
        from_attributes = True
