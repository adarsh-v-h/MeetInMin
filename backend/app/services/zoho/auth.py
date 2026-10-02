import asyncio
import logging
import time
import httpx
from app.core.config import settings

logger = logging.getLogger(__name__)

_EXPIRY_SKEW_SECONDS = 300
_DEFAULT_LIFETIME_SECONDS = 3600

_cached_token: str | None = None
_expires_at: float = 0.0
_lock = asyncio.Lock()
_rate_limit_until: float = 0.0

async def get_access_token(timeout: float = 15.0) -> str:
    """
    Returns a valid Catalyst OAuth access token, automatically refreshing
    it via the refresh token grant when near expiry.
    """
    global _cached_token, _expires_at, _rate_limit_until

    now = time.time()
    if _cached_token and now < _expires_at:
        return _cached_token

    if now < _rate_limit_until and _cached_token:
        logger.warning("Zoho OAuth in cooldown period; returning cached access token.")
        return _cached_token

    async with _lock:
        # Re-check inside lock
        now = time.time()
        if _cached_token and now < _expires_at:
            return _cached_token

        url = settings.accounts_url
        client_id = settings.client_id
        client_secret = settings.client_secret
        refresh_token = settings.refresh_token

        logger.info("Minting fresh Zoho Catalyst OAuth access token...")
        try:
            async with httpx.AsyncClient() as client:
                resp = await client.post(
                    url,
                    data={
                        "grant_type": "refresh_token",
                        "client_id": client_id,
                        "client_secret": client_secret,
                        "refresh_token": refresh_token,
                    },
                    timeout=timeout,
                )
                resp.raise_for_status()
                data = resp.json() or {}
                token = data.get("access_token")
                if not token:
                    raise RuntimeError(f"Zoho OAuth refresh response missing access_token: {data}")

                lifetime = int(data.get("expires_in") or _DEFAULT_LIFETIME_SECONDS)
                _cached_token = token
                _expires_at = time.time() + max(0, lifetime - _EXPIRY_SKEW_SECONDS)
                _rate_limit_until = 0.0
                logger.info("Successfully refreshed Zoho Catalyst OAuth access token.")
                return token

        except Exception as e:
            if "400" in str(e) or "too many requests" in str(e).lower():
                logger.warning("Zoho OAuth rate-limited, setting 60s cooldown.")
                _rate_limit_until = time.time() + 60.0
                if _cached_token:
                    return _cached_token
            if _cached_token:
                logger.warning(f"Zoho OAuth token refresh failed ({e}); falling back to cached token.")
                return _cached_token
            raise RuntimeError(f"Failed to obtain Zoho Catalyst access token: {e}") from e

def invalidate_token() -> None:
    """Invalidates the cached token so the next get_access_token() forces a refresh."""
    global _cached_token, _expires_at
    logger.info("Invalidating cached Zoho Catalyst OAuth access token.")
    _cached_token = None
    _expires_at = 0.0
