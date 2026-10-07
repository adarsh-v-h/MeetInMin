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

def repair_webm_bytes_if_needed(audio_file_path: str) -> str | None:
    """
    If the file is a WebM recording missing the EBML container header (starts without 1a 45 df a3),
    prepends a standard WebM Opus container header to allow ffmpeg to demux clusters cleanly.
    Returns path to a temporary repaired file, or None if repair is not needed/applicable.
    """
    try:
        with open(audio_file_path, "rb") as f:
            header_bytes = f.read(16)
        
        # Check if already has valid EBML header
        if header_bytes.startswith(bytes.fromhex("1a45dfa3")):
            return None
        
        with open(audio_file_path, "rb") as f:
            raw_data = f.read()

        cluster_idx = raw_data.find(bytes.fromhex("1f43b675"))
        if cluster_idx == -1:
            return None

        logger.warning(f"⚠️ WebM EBML container header missing in {audio_file_path}. Attempting automatic header repair at cluster offset {cluster_idx}...")
        
        hdr_hex = (
            "1a45dfa39f4286810142f7810142f2810442f381084282847765626d42878104428581021853806"
            "701000000000003da114d9b74ba4dbb8b53ab841549a96653ac81a14dbb8b53ab841654ae6b53ac8"
            "1d84dbb8c53ab841254c36753ac82013f4dbb8c53ab841c53bb6b53ac8203c4ec010000000000005"
            "90000000000000000000000000000000000000000000000000000000000000000000000000000000"
            "00000000000000000000000000000000000000000000000000000000000000000000000000000000"
            "0000000000000001549a966b22ad7b1830f42404d808d4c61766635382e37362e31303057418"
            "d4c61766635382e37362e313030448988408f8000000000001654ae6be2ae0100000000000059d78"
            "10173c58802eaf5bf23fdfc689c810022b59c83756e648686415f4f50555356aa83632ea056bb840"
            "4c4b400838102e1919f8101b58840e77000000000006264811063a2934f707573486561640101380"
            "180bb00000000001254c367409b7373010000000000002763c08067c8010000000000001a45a3874"
            "54e434f44455244878d4c61766635382e37362e3130307373010000000000006063c08b63c58802e"
            "af5bf23fdfc6867c8010000000000002345a387454e434f4445524487964c61766335382e3133342"
            "e313030206c69626f70757367c8a245a3884455524154494f4e44879430303a30303a30312e30303"
            "83030303030300000"
        )
        repaired_bytes = bytes.fromhex(hdr_hex) + raw_data[cluster_idx:]

        with tempfile.NamedTemporaryFile(suffix="_repaired.webm", delete=False) as tmp:
            tmp.write(repaired_bytes)
            repaired_path = tmp.name
        
        logger.info(f"✅ WebM stream repaired successfully -> {repaired_path}")
        return repaired_path
    except Exception as err:
        logger.warning(f"WebM header repair attempt failed: {err}")
        return None

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

    # Attempt header repair if file is WebM with missing header
    repaired_path = repair_webm_bytes_if_needed(audio_file_path)
    target_path = repaired_path if repaired_path else audio_file_path

    logger.info(f"Segmenting audio file {target_path} into {segment_seconds}s 16kHz mono WAV chunks...")
    try:
        proc = await asyncio.create_subprocess_exec(
            "ffmpeg", "-y", "-err_detect", "ignore_err", "-i", target_path,
            "-f", "segment", "-segment_time", str(segment_seconds),
            "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le",
            out_pattern,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
        )
        stdout, stderr = await proc.communicate()

        # If original file failed, try repairing if not done yet
        if proc.returncode != 0 and not repaired_path:
            repaired_path = repair_webm_bytes_if_needed(audio_file_path)
            if repaired_path:
                target_path = repaired_path
                proc = await asyncio.create_subprocess_exec(
                    "ffmpeg", "-y", "-err_detect", "ignore_err", "-i", target_path,
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
    finally:
        if repaired_path and os.path.exists(repaired_path):
            try:
                os.remove(repaired_path)
            except Exception:
                pass

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
