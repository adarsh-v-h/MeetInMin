import logging
from app.schemas.meeting import MeetingInsights
from app.services.zoho.stt import transcribe_audio_with_zoho, ZohoSTTError
from app.services.zoho.glm import analyze_transcript_with_zoho_glm, ZohoGLMError

logger = logging.getLogger(__name__)

async def process_meeting_audio_async(audio_file_path: str, on_transcript_cb=None) -> MeetingInsights | None:
    """
    Takes a raw audio file and uses Zoho STT to transcribe it, followed by Zoho GLM to extract
    structured meeting insights.

    Args:
        audio_file_path: Path to the uploaded audio file.
        on_transcript_cb: Optional async or sync callback function to store raw transcript in DB
                          as soon as STT completes, preserving it as the source of truth.
    """
    if not audio_file_path:
        logger.error("No audio file path provided for processing.")
        return None

    try:
        # Step 1: Transcribe audio using Zoho Speech-to-Text
        logger.info(f"Transcribing audio with Zoho Speech-to-Text: {audio_file_path}")
        raw_transcript = await transcribe_audio_with_zoho(audio_file_path)

        if not raw_transcript:
            logger.error("Zoho Speech-to-Text returned an empty transcript.")
            return None

        logger.info(f"Zoho STT complete. Transcript length: {len(raw_transcript)} chars.")

        # If a callback was provided, invoke it immediately to persist raw transcript to DB
        if on_transcript_cb:
            try:
                if callable(on_transcript_cb):
                    res = on_transcript_cb(raw_transcript)
                    if hasattr(res, "__await__"):
                        await res
            except Exception as cb_err:
                logger.error(f"Error in transcript callback: {cb_err}")

        # Step 2: Generate structured meeting insights using Zoho GLM
        logger.info("Analyzing transcript with Zoho GLM...")
        insights = await analyze_transcript_with_zoho_glm(raw_transcript)
        return insights

    except (ZohoSTTError, ZohoGLMError) as zoho_err:
        logger.error(f"Zoho AI pipeline failed: {zoho_err}")
        return None
    except Exception as e:
        logger.error(f"Unexpected error in Zoho AI processing pipeline: {e}")
        return None

def process_meeting_audio(audio_file_path: str) -> MeetingInsights | None:
    """Synchronous wrapper for legacy callers."""
    import asyncio
    try:
        loop = asyncio.get_event_loop()
        if loop.is_running():
            # If running in an event loop thread, create new task or run until complete
            import nest_asyncio
            nest_asyncio.apply()
            return loop.run_until_complete(process_meeting_audio_async(audio_file_path))
        else:
            return loop.run_until_complete(process_meeting_audio_async(audio_file_path))
    except Exception:
        return asyncio.run(process_meeting_audio_async(audio_file_path))
