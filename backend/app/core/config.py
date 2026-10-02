from pydantic_settings import BaseSettings
from typing import Optional

class Settings(BaseSettings):
    SECRET_KEY: str
    GOOGLE_CLIENT_ID: str
    GOOGLE_CLIENT_SECRET: str
    GOOGLE_REDIRECT_URI: str = "http://localhost:8000/v1/auth/login/google/callback"
    FRONTEND_URL: str = "http://localhost:5173"
    
    # Zoho Catalyst AI Services
    ZOHO_CLIENT_ID: Optional[str] = None
    ZOHO_CLIENT_SECRET: Optional[str] = None
    ZOHO_REFRESH_TOKEN: Optional[str] = None
    ZOHO_CATALYST_ORG: Optional[str] = None
    
    CATALYST_CLIENT_ID: Optional[str] = None
    CATALYST_CLIENT_SECRET: Optional[str] = None
    CATALYST_REFRESH_TOKEN: Optional[str] = None
    CATALYST_ORG_ID: Optional[str] = None
    
    CATALYST_PROJECT_ID: Optional[str] = None
    ZOHO_PROJECT_ID: Optional[str] = None
    
    CATALYST_BASE_URL: str = "https://api.catalyst.zoho.in"
    CATALYST_ACCOUNTS_URL: Optional[str] = None
    ZIA_STT_URL: Optional[str] = None
    QUICKML_LLM_URL: Optional[str] = None
    ZOHO_GLM_MODEL: str = "crm-di-glm47b_30b_it"

    # Database
    DATABASE_URL: str

    @property
    def client_id(self) -> str:
        res = self.ZOHO_CLIENT_ID or self.CATALYST_CLIENT_ID
        if not res:
            raise ValueError("ZOHO_CLIENT_ID or CATALYST_CLIENT_ID is not configured in .env")
        return res

    @property
    def client_secret(self) -> str:
        res = self.ZOHO_CLIENT_SECRET or self.CATALYST_CLIENT_SECRET
        if not res:
            raise ValueError("ZOHO_CLIENT_SECRET or CATALYST_CLIENT_SECRET is not configured in .env")
        return res

    @property
    def refresh_token(self) -> str:
        res = self.ZOHO_REFRESH_TOKEN or self.CATALYST_REFRESH_TOKEN
        if not res:
            raise ValueError("ZOHO_REFRESH_TOKEN or CATALYST_REFRESH_TOKEN is not configured in .env")
        return res

    @property
    def org_id(self) -> str:
        res = self.ZOHO_CATALYST_ORG or self.CATALYST_ORG_ID
        if not res:
            raise ValueError("ZOHO_CATALYST_ORG or CATALYST_ORG_ID is not configured in .env")
        return res

    @property
    def project_id(self) -> str:
        res = self.CATALYST_PROJECT_ID or self.ZOHO_PROJECT_ID
        if not res:
            raise ValueError("CATALYST_PROJECT_ID or ZOHO_PROJECT_ID is not configured in .env")
        return res

    @property
    def accounts_url(self) -> str:
        if self.CATALYST_ACCOUNTS_URL:
            return self.CATALYST_ACCOUNTS_URL
        for tld in (".zoho.in", ".zoho.com", ".zoho.eu", ".zoho.com.au", ".zoho.jp"):
            if tld in self.CATALYST_BASE_URL:
                return f"https://accounts{tld}/oauth/v2/token"
        return "https://accounts.zoho.in/oauth/v2/token"

    @property
    def stt_url(self) -> str:
        if self.ZIA_STT_URL:
            return self.ZIA_STT_URL
        return f"{self.CATALYST_BASE_URL}/quickml/api/v1/models/zia/audio/transcribe"

    @property
    def glm_url(self) -> str:
        if self.QUICKML_LLM_URL:
            return self.QUICKML_LLM_URL
        return f"{self.CATALYST_BASE_URL}/quickml/v1/project/{self.project_id}/glm/chat"

    class Config:
        env_file = ".env"
        extra = "allow"

settings = Settings()
