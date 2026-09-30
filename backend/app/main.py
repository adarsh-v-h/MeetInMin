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
    # Reset any meetings that got stuck in 'analyzing' state during a server crash
    from app.db.database import SessionLocal
    from app.db.models import Meeting
    
    db = SessionLocal()
    try:
        stuck_meetings = db.query(Meeting).filter(Meeting.status.in_(['analyzing', 'uploading'])).update({'status': 'failed'}, synchronize_session=False)
        db.commit()
    except Exception:
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
