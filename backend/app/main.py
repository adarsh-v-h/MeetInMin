from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import auth, meetings, api_keys, users
from app.db.database import engine, Base
# Import models to ensure they are registered with Base
# from app.db import models

# For development: create all tables automatically
Base.metadata.create_all(bind=engine)

from contextlib import asynccontextmanager
import asyncio
from app.services.queue_manager import process_queue

@asynccontextmanager
async def lifespan(app: FastAPI):
    import os
    import logging
    from app.db.database import SessionLocal
    from app.db.models import Meeting
    from app.services.queue_manager import audio_queue
    
    logger = logging.getLogger(__name__)

    # Re-queue any meetings that got interrupted or stuck during server shutdown
    db = SessionLocal()
    try:
        pending_meetings = db.query(Meeting).filter(
            Meeting.status.in_(['uploaded', 'uploading', 'transcribing', 'analyzing'])
        ).all()

        requeued_count = 0
        for m in pending_meetings:
            if m.audio_file_path and os.path.exists(m.audio_file_path):
                m.status = 'uploaded'
                audio_queue.put_nowait((m.id, m.audio_file_path))
                requeued_count += 1
            else:
                m.status = 'failed'
        db.commit()
        if requeued_count > 0:
            logger.info(f"🔄 Re-queued {requeued_count} pending meeting(s) for processing.")
    except Exception as e:
        logger.error(f"Error recovering pending meetings on startup: {e}")
        db.rollback()
    finally:
        db.close()
        
    # Start the background queue worker
    worker_task = asyncio.create_task(process_queue())
    yield
    # Cleanup on shutdown
    worker_task.cancel()
    try:
        await worker_task
    except asyncio.CancelledError:
        pass

app = FastAPI(title="MeetInMin API", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/v1/auth", tags=["Authentication"])
app.include_router(users.router, prefix="/v1/users", tags=["Users"])
app.include_router(api_keys.router, prefix="/v1/api-keys", tags=["API Keys"])
app.include_router(meetings.router, prefix="/v1/meetings", tags=["Meetings"])

@app.get("/")
async def root():
    return {"message": "Welcome to the MeetInMin Backend API!"}
