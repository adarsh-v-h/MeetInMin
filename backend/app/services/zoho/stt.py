import asyncio
import logging
import os
import glob
import tempfile
import httpx
from app.core.config import settings
from app.services.zoho.auth import get_access_token, invalidate_token

logger = logging.getLogger(__name__)

_STT_HALLUCINATIONS = {"you", "you.", "you!", "thank you", "thank you.", "thanks", "subtitles by", "."}

class ZohoSTTError(Exception):
    """Raised when Zoho Speech-to-Text fails."""
    pass

async def split_audio_into_wav_chunks(audio_file_path: str, segment_seconds: int = 240) -> list[str]:
    """
    Splits an audio file into 16kHz mono WAV chunks of specified duration (default 4 minutes)
    using ffmpeg to ensure every payload remains below Zoho STT's file size limit (~8MB per chunk).
    Returns a list of temporary file paths to the created WAV chunks.
    """
    if not os.path.exists(audio_file_path):
        raise ZohoSTTError(f"Audio file not found: {audio_file_path}")

    temp_dir = tempfile.mkdtemp(prefix="meetinmin_stt_")
    out_pattern = os.path.join(temp_dir, "chunk_%03d.wav")

    logger.info(f"Segmenting audio file {audio_file_path} into {segment_seconds}s 16kHz mono WAV chunks...")
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-i", audio_file_path,
            "-f", "segment", "-segment_time", str(segment_seconds),
            "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
            out_pattern,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()
        if proc.returncode != 0:
            err_msg = stderr.decode() if stderr else "Unknown ffmpeg error"
            raise ZohoSTTError(f"ffmpeg segmentation failed: {err_msg}")

        chunks = sorted(glob.glob(os.path.join(temp_dir, "chunk_*.wav")))
        if not chunks:
            raise ZohoSTTError("ffmpeg produced no audio chunks.")

        logger.info(f"Audio split into {len(chunks)} chunk(s).")
        return chunks
    except Exception as e:
        if isinstance(e, ZohoSTTError):
            raise
        raise ZohoSTTError(f"Audio segmentation failed: {e}") from e

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

async def _transcribe_single_wav_file(wav_file_path: str, language: str = "en") -> str:
    stt_url = settings.stt_url
    with open(wav_file_path, "rb") as f:
        wav_bytes = f.read()

    files = {"file": ("audio.wav", wav_bytes, "audio/wav")}
    data = {"language": language}

    for attempt in range(2):
        token = await get_access_token()
        headers = {
            "Authorization": f"Zoho-oauthtoken {token}",
            "CATALYST-ORG": settings.org_id,
        }

        logger.info(f"Sending audio chunk ({len(wav_bytes)} bytes) to Zoho Speech-to-Text API...")
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
                return transcript

        except httpx.HTTPError as e:
            raise ZohoSTTError(f"Zoho STT request network error: {e}") from e

    raise ZohoSTTError("Zoho STT failed after retries.")

async def transcribe_audio_with_zoho(audio_file_path: str, language: str = "en") -> str:
    """
    Splits audio into 4-minute WAV chunks, transcribes each chunk sequentially via Zoho STT,
    and returns the concatenated full raw transcript text.
    """
    chunk_paths = await split_audio_into_wav_chunks(audio_file_path, segment_seconds=240)
    transcripts = []

    try:
        for idx, chunk_path in enumerate(chunk_paths):
            logger.info(f"Transcribing audio chunk {idx + 1}/{len(chunk_paths)}...")
            try:
                chunk_text = await _transcribe_single_wav_file(chunk_path, language=language)
                if chunk_text:
                    transcripts.append(chunk_text)
            except Exception as e:
                logger.warning(f"Chunk {idx + 1} transcription failed: {e}. Skipping chunk...")
    finally:
        # Cleanup temporary chunk files and directory
        for chunk_path in chunk_paths:
            try:
                os.remove(chunk_path)
            except Exception:
                pass
        temp_dir = os.path.dirname(chunk_paths[0]) if chunk_paths else None
        if temp_dir and os.path.exists(temp_dir):
            try:
                os.rmdir(temp_dir)
            except Exception:
                pass

    full_transcript = " ".join(transcripts).strip()
    if not full_transcript:
        raise ZohoSTTError("Zoho STT returned no usable transcript across all chunks.")

    logger.info(f"✅ Full audio transcription completed ({len(full_transcript)} chars across {len(transcripts)} chunk(s)).")
    return full_transcript
