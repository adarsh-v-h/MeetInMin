from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException, status
from app.api.deps import DbSession
from app.db.models import User, APIKey
from sqlalchemy import select
import hashlib
# import shutil
import os
import uuid
import time
# import asyncio

router = APIRouter()

import logging
from app.db.database import SessionLocal
from app.db.models import Meeting, Transcript, MeetingInsight, ActionItem, KeyDecision

logger = logging.getLogger(__name__)

async def process_audio_background(meeting_id: str, file_path: str):
    from app.services.stt import transcribe_audio
    from app.services.llm import generate_meeting_insights
    
    # We create a new dedicated DB session for the background task
    db = SessionLocal()
    try:
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not meeting:
            logger.error(f"Meeting {meeting_id} not found.")
            return
            
        logger.info(f"✅ Starting STT for meeting {meeting_id}")
        meeting.status = "transcribing"
        db.commit()
        
        # 1. Transcribe the audio
        transcript_text = await transcribe_audio(file_path)
        
        if not transcript_text:
            meeting.status = "failed"
            db.commit()
            return
            
        # Save transcript to DB
        new_transcript = Transcript(meeting_id=meeting.id, raw_text=transcript_text)
        db.add(new_transcript)
        
        logger.info(f"✅ Transcript saved. Generating insights...")
        meeting.status = "analyzing"
        db.commit()
        
        # 2. Get LLM Insights
        insights = await generate_meeting_insights(transcript_text)
        
        if not insights:
            meeting.status = "failed"
            db.commit()
            return
            
        # Save Insights to DB
        new_insight = MeetingInsight(
            meeting_id=meeting.id,
            summary=insights.summary
        )
        db.add(new_insight)
        db.flush() # flush to get new_insight.id
        
        # Save Key Decisions
        for decision in insights.key_decisions:
            db.add(KeyDecision(insight_id=new_insight.id, decision_text=decision))
            
        # Save Action Items
        for item in insights.action_items:
            db.add(ActionItem(
                insight_id=new_insight.id,
                task=item.task,
                assignee=item.assignee
            ))
            
        meeting.status = "completed"
        db.commit()
        logger.info(f"✨ Successfully analyzed and saved meeting {meeting_id}!")
        
    except Exception as e:
        logger.error(f"Background task failed: {e}")
        db.rollback()
        
        # Try to mark as failed
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if meeting:
            meeting.status = "failed"
            db.commit()
            
    finally:
        db.close()

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

    # 2. Generate a secure, unique filename: username_uniqueId_timestamp.webm
    timestamp = int(time.time())
    file_extension = file.filename.split(".")[-1] if "." in file.filename else "webm"
    unique_filename = f"{user.username}_{str(uuid.uuid4())[:8]}_{timestamp}.{file_extension}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    import aiofiles
    
    # Save the uploaded audio file to disk asynchronously in 1MB chunks
    async with aiofiles.open(file_path, "wb") as out_file:
        while content := await file.read(1024 * 1024):  # 1MB chunk size
            await out_file.write(content)
        
    # Create the Meeting record in the DB first
    new_meeting = Meeting(
        user_id=user.id,
        title=f"Meeting on {time.strftime('%b %d, %Y')}",
        audio_file_path=file_path,
        status="uploading"
    )
    db.add(new_meeting)
    db.commit()
    db.refresh(new_meeting)
    
    # Trigger the Zoho Catalyst STT and LLM Analysis in the background
    background_tasks.add_task(process_audio_background, new_meeting.id, file_path)
    
    return {
        "status": "success", 
        "message": f"Audio uploaded successfully by {user.username}",
        "file_name": unique_filename,
    }
