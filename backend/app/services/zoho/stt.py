import asyncio
import logging
import os
import httpx
from app.core.config import settings
from app.services.zoho.auth import get_access_token, invalidate_token

logger = logging.getLogger(__name__)

_STT_HALLUCINATIONS = {"you", "you.", "you!", "thank you", "thank you.", "thanks", "subtitles by", "."}

class ZohoSTTError(Exception):
    """Raised when Zoho Speech-to-Text fails."""
    pass

async def convert_audio_to_wav(audio_file_path: str) -> bytes:
    """Converts input audio file to 16 kHz mono WAV using ffmpeg."""
    if not os.path.exists(audio_file_path):
        raise ZohoSTTError(f"Audio file not found: {audio_file_path}")

    with open(audio_file_path, "rb") as f:
        audio_bytes = f.read()

    # If it's already a WAV file, return directly
    if audio_bytes.startswith(b"RIFF") and b"WAVE" in audio_bytes[:16]:
        return audio_bytes

    logger.info(f"Converting audio file {audio_file_path} to 16kHz mono WAV via ffmpeg...")
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-i", audio_file_path, "-f", "wav", "-ac", "1", "-ar", "16000", "pipe:1",
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            err_msg = stderr.decode() if stderr else "Unknown ffmpeg error"
            raise ZohoSTTError(f"ffmpeg conversion failed: {err_msg}")
        
        if not stdout.startswith(b"RIFF"):
            raise ZohoSTTError("ffmpeg output is not valid WAV format.")
            
        logger.info(f"Successfully converted audio to WAV ({len(stdout)} bytes).")
        return stdout
    except Exception as e:
        if isinstance(e, ZohoSTTError):
            raise
        raise ZohoSTTError(f"Audio conversion failed: {e}") from e

def _extract_transcript_text(payload: dict) -> str:
    inner = payload.get("data", payload) if isinstance(payload, dict) else {}
    if not isinstance(inner, dict):
        inner = payload if isinstance(payload, dict) else {}

    for key in ("text", "transcript", "transcription", "result"):
        val = inner.get(key)
        if isinstance(val, str) and val.strip():
            cleaned = val.strip()
            if cleaned.lower().strip() in _STT_HALLUCINATIONS:
                return ""
            return cleaned
    return ""

async def transcribe_audio_with_zoho(audio_file_path: str, language: str = "en") -> str:
    """
    Sends the audio file to Zoho Zia Speech-to-Text service and returns the raw text transcript.
    """
    stt_url = settings.stt_url
    wav_bytes = await convert_audio_to_wav(audio_file_path)

    files = {"file": ("audio.wav", wav_bytes, "audio/wav")}
    data = {"language": language}

    for attempt in range(2):
        token = await get_access_token()
        headers = {
            "Authorization": f"Zoho-oauthtoken {token}",
            "CATALYST-ORG": settings.org_id,
        }

        logger.info(f"Sending audio ({len(wav_bytes)} bytes) to Zoho Speech-to-Text API...")
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    stt_url,
                    headers=headers,
                    files=files,
                    data=data,
                    timeout=60.0
                )

                if resp.status_code == 401 and attempt == 0:
                    logger.warning("Zoho STT returned 401 Unauthorized. Retrying after token refresh...")
                    invalidate_token()
                    continue

                if resp.status_code != 200:
                    body_preview = resp.text[:300] if resp.text else "<empty>"
                    raise ZohoSTTError(f"Zoho STT HTTP {resp.status_code}: {body_preview}")

                payload = resp.json()
                transcript = _extract_transcript_text(payload)
                if not transcript:
                    logger.warning(f"Zoho STT response produced no usable transcript text: {payload}")
                    raise ZohoSTTError("Zoho STT returned an empty transcript.")

                logger.info(f"Zoho STT transcription succeeded ({len(transcript)} chars).")
                return transcript

        except httpx.HTTPError as e:
            raise ZohoSTTError(f"Zoho STT request network error: {e}") from e

    raise ZohoSTTError("Zoho STT failed after retries.")
