from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException, status
from app.api.deps import DbSession
from app.db.models import User, APIKey
from sqlalchemy import select
import hashlib
import shutil
import os
import uuid
import time

router = APIRouter()

# Directory to temporarily store uploaded audio files before they are processed
UPLOAD_DIR = "uploaded_audio"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/upload/{api_key}")
async def upload_meeting_audio(
    api_key: str,
    db: DbSession,
    background_tasks: BackgroundTasks,
    file: UploadFile = File(...)
):
    # 1. Verify the API Key securely by checking its hash against the APIKey table
    api_key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    api_key_record = db.execute(select(APIKey).where(APIKey.key_hash == api_key_hash)).scalar_one_or_none()
    
    if not api_key_record:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="Invalid Extension API Key"
        )
        
    user = api_key_record.user

    # 2. Generate a secure, unique filename as requested: username_uniqueId_timestamp.webm
    timestamp = int(time.time())
    file_extension = file.filename.split(".")[-1] if "." in file.filename else "webm"
    unique_filename = f"{user.username}_{str(uuid.uuid4())[:8]}_{timestamp}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    import aiofiles
    
    # Save the uploaded audio file to disk asynchronously in 1MB chunks
    async with aiofiles.open(file_path, "wb") as out_file:
        while content := await file.read(1024 * 1024):  # 1MB chunk size
            await out_file.write(content)
        
    # TODO: Create a Database row for this Meeting (e.g., status="processing")
    # TODO: Add the Whisper Transcription function to `background_tasks` so it runs asynchronously
    
    return {
        "status": "success", 
        "message": f"Audio uploaded successfully by {user.username}",
        "file_name": unique_filename,
    }
