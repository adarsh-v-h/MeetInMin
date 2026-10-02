import asyncio
import os
from app.services.zoho.auth import get_access_token
from app.services.zoho.stt import transcribe_audio_with_zoho
from app.services.zoho.glm import analyze_transcript_with_zoho_glm
from app.schemas.meeting import MeetingInsights

async def test_zoho_auth_token():
    token = await get_access_token()
    assert token is not None, "Token should not be None"
    assert len(token) > 10, "Token should be non-empty"
    assert token.startswith("1000."), "Token should start with 1000."

async def test_zoho_stt_transcription():
    audio_path = "/home/venzz/Work/Projects/MeetInMin/backend/uploaded_audio/Adarshvh_e993eece_1790763433.webm"
    if not os.path.exists(audio_path):
        print("Skipping STT test: test file not found")
        return
    
    transcript = await transcribe_audio_with_zoho(audio_path)
    assert transcript is not None, "Transcript should not be None"
    assert isinstance(transcript, str), "Transcript should be a string"
    assert len(transcript) > 0, "Transcript should not be empty"

async def test_zoho_glm_insights():
    test_transcript = "In today's meeting we decided to launch product feature X by Friday. John will complete the API integration."
    insights = await analyze_transcript_with_zoho_glm(test_transcript)
    assert isinstance(insights, MeetingInsights), "Insights should be MeetingInsights instance"
    assert len(insights.summary) > 0, "Summary should not be empty"
    assert len(insights.key_decisions) >= 1, "Should have at least 1 key decision"
    assert len(insights.action_items) >= 1, "Should have at least 1 action item"
