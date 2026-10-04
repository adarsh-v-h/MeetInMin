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
import asyncio
from app.services.queue_manager import audio_queue

router = APIRouter()

import logging
from app.db.database import SessionLocal
from app.db.models import Meeting, Transcript, MeetingInsight, ActionItem, KeyDecision, EmailContextSource
from app.schemas.meeting import PaginatedMeetings, MeetingDetailResponse
from app.api.deps import CurrentUser

logger = logging.getLogger(__name__)

async def process_audio_background(meeting_id: str, file_path: str):
    from app.services.zoho.stt import transcribe_audio_with_zoho
    from app.services.zoho.glm import analyze_transcript_with_zoho_glm
    from app.db.database import SessionLocal
    from app.db.models import Meeting, Transcript, MeetingInsight, ActionItem, KeyDecision

    db = SessionLocal()
    try:
        meeting = db.query(Meeting).filter(Meeting.id == meeting_id).first()
        if not meeting:
            logger.error(f"Meeting {meeting_id} not found.")
            return

        logger.info(f"✅ Starting Zoho AI Analysis for meeting {meeting_id}")
        meeting.status = "transcribing"
        db.commit()

        # Step 1: Transcribe audio with Zoho Speech-to-Text
        raw_transcript = await transcribe_audio_with_zoho(file_path)

        if not raw_transcript:
            logger.error(f"Zoho STT produced empty transcript for meeting {meeting_id}")
            meeting.status = "failed"
            db.commit()
            return

        # Step 2: Save raw transcript to DB as source of truth
        existing_transcript = db.query(Transcript).filter(Transcript.meeting_id == meeting.id).first()
        if existing_transcript:
            existing_transcript.raw_text = raw_transcript
        else:
            new_transcript = Transcript(meeting_id=meeting.id, raw_text=raw_transcript)
            db.add(new_transcript)

        meeting.status = "analyzing"
        db.commit()
        logger.info(f"📝 Raw transcript saved to DB for meeting {meeting_id}.")

        # Step 3: Fetch email context from Gmail (if user has Google connected)
        # Load the user to check for a Google refresh token
        user = db.query(User).filter(User.id == meeting.user_id).first()
        email_context = None
        attribution_records = []

        if user and user.google_refresh_token:
            logger.info(f"📧 User has Gmail connected. Building email context for meeting {meeting_id}...")
            try:
                from app.services.gmail.context_builder import build_email_context
                email_context, attribution_records = await build_email_context(
                    transcript=raw_transcript,
                    meeting_date=meeting.created_at,
                    google_refresh_token=user.google_refresh_token,
                )
                if email_context:
                    logger.info(f"✉️  Email context assembled ({len(attribution_records)} source email(s)).")
                else:
                    logger.info("📭 No relevant emails found — proceeding with transcript-only analysis.")
            except Exception as gmail_err:
                logger.warning(f"Gmail context build failed for meeting {meeting_id} ({gmail_err}). Proceeding without email context.")
                email_context = None
                attribution_records = []
        else:
            logger.info(f"📭 No Gmail connection for this user. Proceeding with transcript-only analysis.")

        # Step 4: Analyze transcript with Zoho GLM (with email context if available)
        insights = await analyze_transcript_with_zoho_glm(raw_transcript, email_context=email_context)


        if not insights:
            logger.error(f"Zoho GLM returned no insights for meeting {meeting_id}")
            meeting.status = "failed"
            db.commit()
            return

        # Step 5: Save Insights to DB
        existing_insight = db.query(MeetingInsight).filter(MeetingInsight.meeting_id == meeting.id).first()
        if existing_insight:
            db.delete(existing_insight)
            db.flush()

        new_insight = MeetingInsight(
            meeting_id=meeting.id,
            summary=insights.summary
        )
        db.add(new_insight)
        db.flush()

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

        # Step 6: Save email attribution records (which emails were used as context)
        if attribution_records:
            # Clear any existing attribution records for idempotency
            db.query(EmailContextSource).filter(EmailContextSource.meeting_id == meeting.id).delete()
            for record in attribution_records:
                db.add(EmailContextSource(
                    meeting_id=meeting.id,
                    gmail_message_id=record["gmail_message_id"],
                    subject=record["subject"],
                    sender=record["sender"],
                    received_at=record["received_at"],
                    snippet=record["snippet"],
                ))
            logger.info(f"📎 Saved {len(attribution_records)} email context source(s) for meeting {meeting_id}.")

        meeting.status = "completed"
        db.commit()
        logger.info(f"✨ Successfully analyzed and saved meeting {meeting_id} with Zoho AI!")

    except Exception as e:
        logger.error(f"Background task failed for meeting {meeting_id}: {e}")
        db.rollback()

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
        status="uploaded"
    )
    db.add(new_meeting)
    db.commit()
    db.refresh(new_meeting)
    
    # Queue the Meeting for background sequential processing (prevents Zoho rate limits)
    audio_queue.put_nowait((new_meeting.id, file_path))
    
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
    ).unique().scalar_one_or_none()
    
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

@router.post("/{meeting_id}/retry")
async def retry_failed_meeting(
    meeting_id: str, 
    current_user: CurrentUser, 
    db: DbSession,
    background_tasks: BackgroundTasks
):
    """Retries the AI analysis for a failed meeting."""
    meeting = db.execute(
        select(Meeting).where(Meeting.id == meeting_id, Meeting.user_id == current_user.id)
    ).scalar_one_or_none()
    
    if not meeting:
        raise HTTPException(status_code=404, detail="Meeting not found")
        
    if meeting.status not in ["failed", "uploading"]:
        raise HTTPException(status_code=400, detail=f"Cannot retry a meeting with status {meeting.status}")
        
    if not meeting.audio_file_path or not os.path.exists(meeting.audio_file_path):
        raise HTTPException(status_code=404, detail="Original audio file is missing from the server.")
        
    # Reset status and trigger background task again!
    meeting.status = "analyzing"
    
    # If there was a partial transcript/insight attached, we might want to delete it, 
    # but cascade="all, delete-orphan" handles it if we just delete them.
    if meeting.insight:
        db.delete(meeting.insight)
    if meeting.transcript:
        db.delete(meeting.transcript)
        
    db.commit()
    
    audio_queue.put_nowait((meeting.id, meeting.audio_file_path))
    
    return {"status": "success", "message": "Meeting analysis has been restarted in the background."}


