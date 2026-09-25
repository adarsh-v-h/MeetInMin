from fastapi import FastAPI
from app.api.v1 import auth

app = FastAPI(title="MeetInMin API")

app.include_router(auth.router, prefix="/v1/auth", tags=["Authentication"])

@app.get("/")
async def root():
    return {"message": "Welcome to the MeetInMin Backend API!"}
