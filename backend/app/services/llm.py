import logging
from google import genai
from google.genai import types
from app.core.config import settings
from app.schemas.meeting import MeetingInsights

import time

logger = logging.getLogger(__name__)

# Configure the new official SDK
client = genai.Client(api_key=settings.GEMINI_API_KEY)

def process_meeting_audio(audio_file_path: str, max_retries: int = 5) -> MeetingInsights | None:
    """Takes a raw audio file and uses Gemini to directly generate structured meeting insights."""
    if not audio_file_path:
        return None
        
    try:
        # 1. Upload the audio file directly to Gemini
        logger.info(f"Uploading audio file {audio_file_path} to Gemini...")
        # We explicitly tell Google this is audio/webm. Otherwise, Google's backend
        # assumes .webm is a video file, realizes there's no video stream, and crashes (FileState = FAILED)
        gemini_file = client.files.upload(
            file=audio_file_path,
            config={'mime_type': 'audio/webm'}
        )
        logger.info(f"Audio file uploaded successfully. URI: {gemini_file.uri}")
        
        # Wait for Google to finish processing the audio file
        while True:
            gemini_file = client.files.get(name=gemini_file.name)
            if gemini_file.state == "ACTIVE":
                logger.info("Audio file is now ACTIVE and ready for generation.")
                break
            elif gemini_file.state == "FAILED":
                logger.error("Google failed to process the uploaded audio file.")
                return None
            logger.info(f"File state is {gemini_file.state}... waiting 2 seconds.")
            time.sleep(2)
        
        # 2. Ask Gemini to analyze the audio directly
        prompt = """
You are an expert executive assistant. I have provided you with the raw audio recording of a meeting.
Your job is to listen carefully and perform two tasks:
1. Provide a word-for-word complete transcript of the entire audio.
2. Extract a highly structured Executive Summary, key decisions, and action items.

For the Executive Summary, please format it professionally. Use bullet points and paragraphs to make it highly readable and easy to skim. Don't just output a single block of text.
"""
        
        # We use gemini-3.8-flash as recommended by the Google API error for latest limits
        for attempt in range(max_retries):
            try:
                logger.info(f"Attempt {attempt + 1}: Asking Gemini for insights...")
                response = client.models.generate_content(
                    model='gemini-3.8-flash',
                    contents=[gemini_file, prompt],
                    config=types.GenerateContentConfig(
                        response_mime_type="application/json",
                        response_schema=MeetingInsights,
                        temperature=0.2, # Low temperature for more factual extraction
                    )
                )
                
                logger.info("Successfully generated insights from Gemini!")
                return MeetingInsights.model_validate_json(response.text)
                
            except Exception as e:
                err_msg = str(e)
                if "503" in err_msg or "429" in err_msg or "UNAVAILABLE" in err_msg or "exhausted" in err_msg.lower():
                    if attempt < max_retries - 1:
                        # Google's strict 20 RPM limit requires longer backoffs
                        sleep_time = (2 ** attempt) * 10  # 10s, 20s, 40s, 80s...
                        logger.warning(f"Gemini Rate Limit hit! Waiting {sleep_time} seconds to cool down... (Attempt {attempt+1}/{max_retries})")
                        time.sleep(sleep_time)
                        continue
                raise e # Re-raise if we are out of retries or it's a different error
                
    except Exception as e:
        logger.error(f"Error generating insights with Gemini: {e}")
        return None
