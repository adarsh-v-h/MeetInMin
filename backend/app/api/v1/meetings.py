from fastapi import APIRouter, UploadFile, File, BackgroundTasks, HTTPException, status
from fastapi.responses import FileResponse
from app.api.deps import DbSession
from app.db.models import User, APIKey
from sqlalchemy import select, func
from sqlalchemy.orm import joinedload
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
from app.schemas.meeting import PaginatedMeetings, MeetingDetailResponse
from app.api.deps import CurrentUser

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
        
    if api_key_record.status == "REVOKED":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED, 
            detail="This API Key has been revoked"
        )
        
    # Update last_used_at
    api_key_record.last_used_at = func.now()
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
        api_key_id=api_key_record.id,
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

@router.get("", response_model=PaginatedMeetings)
async def list_meetings(
    current_user: CurrentUser,
    db: DbSession,
    page: int = 1,
    limit: int = 10
):
    offset = (page - 1) * limit
    
    # Efficiently load meetings and their associated api_key
    query = select(Meeting).options(
        joinedload(Meeting.api_key)
    ).where(Meeting.user_id == current_user.id).order_by(Meeting.created_at.desc())
    
    total = db.execute(select(func.count(Meeting.id)).where(Meeting.user_id == current_user.id)).scalar()
    
    meetings = db.execute(query.offset(offset).limit(limit)).scalars().all()
    
    # Map to schema manually to include api_key_name
    items = []
    for m in meetings:
        items.append({
            "id": m.id,
            "title": m.title,
            "created_at": m.created_at,
            "status": m.status,
            "duration": m.duration,
            "api_key_name": m.api_key.name if m.api_key else None
        })
        
    return PaginatedMeetings(
        items=items,
        total=total,
        page=page,
        size=limit
    )

@router.get("/{meeting_id}", response_model=MeetingDetailResponse)
async def get_meeting_details(meeting_id: str, current_user: CurrentUser, db: DbSession):
    # Eagerly load transcript, insight, and related nested objects
    meeting = db.execute(
        select(Meeting).options(
            joinedload(Meeting.api_key),
            joinedload(Meeting.transcript),
            joinedload(Meeting.insight).joinedload(MeetingInsight.action_items),
            joinedload(Meeting.insight).joinedload(MeetingInsight.key_decisions)
        ).where(Meeting.id == meeting_id, Meeting.user_id == current_user.id)
    ).scalar_one_or_none()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    return {
        "id": meeting.id,
        "title": meeting.title,
        "created_at": meeting.created_at,
        "status": meeting.status,
        "duration": meeting.duration,
        "api_key_name": meeting.api_key.name if meeting.api_key else None,
        "transcript": meeting.transcript,
        "insight": meeting.insight
    }

@router.get("/{meeting_id}/audio", response_class=FileResponse)
async def download_meeting_audio(meeting_id: str, current_user: CurrentUser, db: DbSession):
    meeting = db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.user_id == current_user.id)
    ).scalar_one_or_none()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    if not meeting.audio_file_path or not os.path.exists(meeting.audio_file_path):
        raise HTTPException(status_code=404, detail="Audio file not found or has been deleted")
        
    # Return the file securely
    return FileResponse(
        path=meeting.audio_file_path, 
        filename=os.path.basename(meeting.audio_file_path),
        media_type="audio/webm"
    )

