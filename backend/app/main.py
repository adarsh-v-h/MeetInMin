from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.v1 import auth, meetings
from app.db.database import engine, Base
# Import models to ensure they are registered with Base
# from app.db import models

# For development: create all tables automatically
Base.metadata.create_all(bind=engine)

app = FastAPI(title="MeetInMin API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/v1/auth", tags=["Authentication"])
app.include_router(meetings.router, prefix="/v1/meetings", tags=["Meetings"])

@app.get("/")
async def root():
    return {"message": "Welcome to the MeetInMin Backend API!"}
