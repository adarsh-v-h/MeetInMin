import asyncio
import logging

logger = logging.getLogger(__name__)

# The global queue for processing audio files sequentially
audio_queue = asyncio.Queue()

async def process_queue():
    """
    Background worker that consumes the queue one by one.
    This guarantees that we process Zoho audio STT and GLM requests sequentially,
    preventing concurrency issues and rate limits when processing multiple audio files.
    """
    # Import inside the function to avoid circular imports during startup
    from app.api.v1.meetings import process_audio_background
    
    logger.info("🎧 Audio Processing Queue Worker Started. Waiting for jobs...")
    
    while True:
        try:
            # Blocks until an item is added to the queue
            meeting_id, file_path = await audio_queue.get()
            
            logger.info(f"📥 Pulled meeting {meeting_id} from the queue. Processing...")
            
            # Await the processing task. This ensures we don't start the next one
            # until this one fully finishes (or fails all its retries).
            await process_audio_background(meeting_id, file_path)
            
            logger.info(f"✅ Finished processing meeting {meeting_id}. Checking for more jobs...")
            audio_queue.task_done()
            
        except asyncio.CancelledError:
            logger.info("🛑 Queue Worker shutting down...")
            break
        except Exception as e:
            logger.error(f"❌ Uncaught error in queue worker: {e}")
            await asyncio.sleep(5) # Prevent aggressive looping if something fundamentally breaks
