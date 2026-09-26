from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    SECRET_KEY: str
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/v1/auth/login/google/callback"
    FRONTEND_URL: str = "http://localhost:5173"
    
    # Zoho Catalyst Zia Audio-to-Text
    ZOHO_CLIENT_ID: str
    ZOHO_CLIENT_SECRET: str
    ZOHO_REFRESH_TOKEN: str
    ZOHO_CATALYST_ORG: str
    
    # Gemini AI
    GEMINI_API_KEY: str

    # Database
    DATABASE_URL: str
    
    class Config:
        env_file = ".env"

settings = Settings()
