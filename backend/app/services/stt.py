import httpx
import logging
import json
from app.core.config import settings

logger = logging.getLogger(__name__)

async def get_zoho_access_token() -> str:
    """Exchanges our permanent refresh token for a short-lived access token."""
    url = "https://accounts.zoho.in/oauth/v2/token"
    data = {
        "grant_type": "refresh_token",
        "client_id": settings.ZOHO_CLIENT_ID,
        "client_secret": settings.ZOHO_CLIENT_SECRET,
        "refresh_token": settings.ZOHO_REFRESH_TOKEN,
    }
    async with httpx.AsyncClient() as client:
        response = await client.post(url, data=data)
        response.raise_for_status()
        return response.json()["access_token"]

async def transcribe_audio(file_path: str) -> str:
    """Uploads the audio file to Zoho Catalyst Zia and returns the transcribed text."""
    try:
        # 1. Get a fresh access token (so it never expires!)
        access_token = await get_zoho_access_token()
        
        # 2. Prepare the API request
        url = "https://api.catalyst.zoho.in/quickml/api/v1/models/zia/audio/transcribe"
        headers = {
            "CATALYST-ORG": settings.ZOHO_CATALYST_ORG,
            "Authorization": f"Zoho-oauthtoken {access_token}"
        }
        
        # 3. Upload the file
        # Meetings can be long, so we give it a generous 5-minute timeout (300 seconds)
        with open(file_path, "rb") as f:
            files = {"file": (file_path.split("/")[-1], f, "audio/webm")}
            
            async with httpx.AsyncClient(timeout=300.0) as client:
                response = await client.post(url, headers=headers, files=files)
                response.raise_for_status()
                
                # The response structure depends on Zoho. 
                # For now we'll dump the entire JSON block to string, 
                # and once we see what Zoho returns, we can cleanly extract just the text!
                data = response.json()
                logger.info(f"Successfully transcribed {file_path}")
                return json.dumps(data)
                
    except Exception as e:
        logger.error(f"Error transcribing audio from Zoho: {e}")
        return ""
