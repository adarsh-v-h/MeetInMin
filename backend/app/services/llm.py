import json
import logging
import google.generativeai as genai
from app.core.config import settings
from app.schemas.meeting import MeetingInsights

logger = logging.getLogger(__name__)

# Configure the SDK globally using your free API key
genai.configure(api_key=settings.GEMINI_API_KEY)

async def generate_meeting_insights(transcript: str) -> MeetingInsights | None:
    """Takes a raw audio transcript and uses Gemini to generate structured meeting insights."""
    if not transcript or not transcript.strip():
        return {"error": "Transcript is empty."}
        
    try:
        # We use gemini-1.5-flash for its massive 1M token context window and blazing speed
        model = genai.GenerativeModel('gemini-1.5-flash')
        
        prompt = f"""
You are an expert executive assistant. I will provide you with a raw, unformatted speech-to-text transcript of a meeting.
Your job is to read it carefully and extract a summary, key decisions, and action items.

Here is the meeting transcript:
-----------------
{transcript}
-----------------
"""
        
        # We pass the Pydantic model directly to Gemini. This forces the model to 
        # strictly adhere to our schema and guarantees valid JSON!
        response = await model.generate_content_async(
            prompt,
            generation_config=genai.GenerationConfig(
                response_mime_type="application/json",
                response_schema=MeetingInsights,
                temperature=0.2, # Low temperature for more factual extraction
            )
        )
        
        # Parse the guaranteed JSON text directly into our Pydantic object
        return MeetingInsights.model_validate_json(response.text)
        
    except Exception as e:
        logger.error(f"Error generating insights with Gemini: {e}")
        return None
