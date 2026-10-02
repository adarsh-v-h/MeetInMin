# Zoho Catalyst — Zia STT & GLM Integration Guide

A complete reference for reimplementing the two Catalyst-backed AI services used in this codebase:
**Zoho Zia** (Speech-to-Text, Translation, Text-to-Speech) and **GLM** (LLM chat completions via QuickML).

---

## Table of Contents

1. [Authentication — How It Works](#1-authentication--how-it-works)
2. [Zia Speech-to-Text (STT)](#2-zia-speech-to-text-stt)
3. [Zia Text Translation](#3-zia-text-translation)
4. [Zia Text-to-Speech (TTS)](#4-zia-text-to-speech-tts)
5. [GLM Chat Completions (QuickML)](#5-glm-chat-completions-quickml)
6. [Environment Variables Reference](#6-environment-variables-reference)
7. [How to Get the API Keys / Credentials](#7-how-to-get-the-api-keys--credentials)

---

## 1. Authentication — How It Works

Every single Catalyst API call — Zia STT, TTS, translation, and GLM — uses the **exact same auth headers**:

```http
Authorization: Zoho-oauthtoken {access_token}
CATALYST-ORG: {CATALYST_ORG_ID}
```

`access_token` is a **short-lived OAuth 2.0 access token** (~1 hour TTL).  
`CATALYST_ORG_ID` is your **numeric organization ID** from the Catalyst console.

### Token lifecycle

The codebase manages tokens automatically via `/home/venzz/Work/Projects/Agentic-KSP/backend/config/catalyst_token.py`:

1. Holds `CATALYST_CLIENT_ID`, `CATALYST_CLIENT_SECRET`, `CATALYST_REFRESH_TOKEN` in env.
2. On every API call, checks if the cached token is still fresh.
3. If near expiry (within 5 min), POSTs to the OAuth endpoint to get a new one.
4. **Refresh tokens never expire**, so the service stays authenticated indefinitely.
5. Falls back to the static `CATALYST_API_TOKEN` env var if refresh creds are absent.

### Token refresh call

```http
POST https://accounts.zoho.in/oauth/v2/token
Content-Type: application/x-www-form-urlencoded

grant_type=refresh_token
&client_id={CATALYST_CLIENT_ID}
&client_secret={CATALYST_CLIENT_SECRET}
&refresh_token={CATALYST_REFRESH_TOKEN}
```

**Response:**
```json
{
  "access_token": "1000.xxxxxxxxxxxx",
  "expires_in": 3600,
  "token_type": "Bearer"
}
```

> **Region note:** The accounts URL is region-specific.  
> - India: `https://accounts.zoho.in/oauth/v2/token`  
> - US:     `https://accounts.zoho.com/oauth/v2/token`  
> - EU:     `https://accounts.zoho.eu/oauth/v2/token`

---

## 2. Zia Speech-to-Text (STT)

**Source file:** `/home/venzz/Work/Projects/Agentic-KSP/backend/voice/zia_voice.py` → `transcribe_audio()`  
(also duplicated in `/home/venzz/Work/Projects/Agentic-KSP/backend/zia/zia_service.py`)

### Endpoint

```
POST https://api.catalyst.zoho.in/quickml/api/v1/models/zia/audio/transcribe
```

Stored in env var `ZIA_STT_URL`.

### Request

- **Content-Type:** `multipart/form-data` (set automatically by the HTTP client)
- **Headers:**
  ```http
  Authorization: Zoho-oauthtoken {access_token}
  CATALYST-ORG: {CATALYST_ORG_ID}
  ```
- **Form fields:**

  | Field      | Type        | Value                         |
  |------------|-------------|-------------------------------|
  | `file`     | file upload | `audio.wav` bytes, `audio/wav` MIME |
  | `language` | string      | `"en"` (English) or `"kn"` (Kannada) |

- **Audio format requirement:** The codebase converts any input to **16 kHz mono WAV** via `ffmpeg` before sending. If your audio is already WAV (starts with `RIFF`+`WAVE` magic bytes), it is sent as-is.

  ```python
  # ffmpeg conversion (async subprocess)
  ffmpeg -y -i pipe:0 -f wav -ac 1 -ar 16000 pipe:1
  ```

- **Timeout:** 20 seconds

### Example (Python with httpx)

```python
import httpx

files = {"file": ("audio.wav", wav_bytes, "audio/wav")}
data = {"language": "en"}
headers = {
    "Authorization": f"Zoho-oauthtoken {access_token}",
    "CATALYST-ORG": "YOUR_ORG_ID",
}

resp = httpx.post(
    "https://api.catalyst.zoho.in/quickml/api/v1/models/zia/audio/transcribe",
    headers=headers,
    files=files,
    data=data,
    timeout=20.0,
)
```

### Response

```json
{
  "data": {
    "transcript": "The transcribed text goes here."
  }
}
```

The codebase handles two possible shapes — with and without the `data` wrapper — and probes these keys in order: `transcript`, `text`, `transcription`, `result`.

```python
# Extraction logic
def _extract_transcript(payload: dict) -> str:
    inner = payload.get("data", payload)   # unwrap "data" if present
    for key in ("transcript", "text", "transcription", "result"):
        val = inner.get(key)
        if isinstance(val, str) and val.strip():
            return val.strip()
    return ""
```

### Known hallucinations filtered out

Short noise responses are discarded: `"you"`, `"you."`, `"thank you"`, `"thanks"`, `"subtitles by"`, `"."`

---

## 3. Zia Text Translation

**Source file:** `/home/venzz/Work/Projects/Agentic-KSP/backend/voice/zia_voice.py` → `translate_to_english()`

### Endpoint

```
POST https://api.catalyst.zoho.in/quickml/api/v1/models/zia/translate
```

Stored in env var `ZIA_TRANSLATE_URL`.

### Request

- **Content-Type:** `application/json`
- **Headers:**
  ```http
  Authorization: Zoho-oauthtoken {access_token}
  CATALYST-ORG: {CATALYST_ORG_ID}
  Content-Type: application/json
  ```
- **Body:**
  ```json
  {
    "text": "ನಮಸ್ಕಾರ",
    "src_lang": "kn",
    "tgt_lang": "en"
  }
  ```

  | Field       | Type   | Description                    |
  |-------------|--------|--------------------------------|
  | `text`      | string | Input text to translate        |
  | `src_lang`  | string | Source language code (`"kn"` for Kannada, etc.) |
  | `tgt_lang`  | string | Target language code (`"en"` for English) |

- **Timeout:** 10 seconds

### Response

```json
{
  "translated_text": "Hello"
}
```

Or wrapped: `{"data": {"translated_text": "Hello"}}`. Probes keys: `translated_text`, `translation`, `text`, `result`.

---

## 4. Zia Text-to-Speech (TTS)

**Source file:** `/home/venzz/Work/Projects/Agentic-KSP/backend/voice/zia_voice.py` → `synthesize_speech()`

### Endpoint

```
POST https://api.catalyst.zoho.in/quickml/api/v1/models/zia/tts/synthesize
```

Stored in env var `ZIA_TTS_URL`.

### Request

- **Content-Type:** `application/json`
- **Headers:**
  ```http
  Authorization: Zoho-oauthtoken {access_token}
  CATALYST-ORG: {CATALYST_ORG_ID}
  Content-Type: application/json
  ```
- **Body:**
  ```json
  {
    "text": "Hello, this is a test.",
    "language": "en",
    "speaker": "Mary",
    "pitch": "moderate",
    "speed": "moderate",
    "emotion": "neutral"
  }
  ```

  | Field      | Type   | Notes                                        |
  |------------|--------|----------------------------------------------|
  | `text`     | string | Max 200 characters (enforced by this codebase) |
  | `language` | string | `"en"` (always English, even for Kannada input — Kannada text is pre-translated) |
  | `speaker`  | string | `"Mary"` (voice name)                       |
  | `pitch`    | string | `"moderate"` / `"high"` / `"low"`           |
  | `speed`    | string | `"moderate"` / `"fast"` / `"slow"`          |
  | `emotion`  | string | `"neutral"` / `"happy"` / `"sad"`           |

- **Timeout:** 30 seconds

### Response

**Raw audio bytes** — not JSON. The `Content-Type` will be an audio MIME type.  
Write the response body directly to a file or stream it to the client.

```python
resp = httpx.post(url, headers=headers, json=payload, timeout=30.0)
audio_bytes = resp.content   # write this to a .wav or .mp3 file
```

### 401 handling

On a 401, the codebase invalidates the token cache and retries once:
```python
if resp.status_code == 401:
    invalidate()  # clear cached token
    # retry the request — get_access_token() will refresh automatically
```

---

## 5. GLM Chat Completions (QuickML)

**Source file:** `/home/venzz/Work/Projects/Agentic-KSP/backend/llm/client_real.py` → `call_llm()`

### Endpoint

```
POST https://api.catalyst.zoho.in/quickml/v1/project/{PROJECT_ID}/glm/chat
```

Stored in env var `QUICKML_LLM_URL`. The full URL pattern is:
```
{CATALYST_BASE_URL}/quickml/v1/project/{CATALYST_PROJECT_ID}/glm/chat
```

### Request

- **Content-Type:** `application/json`
- **Headers:**
  ```http
  Authorization: Zoho-oauthtoken {access_token}
  CATALYST-ORG: {CATALYST_ORG_ID}
  Content-Type: application/json
  ```
- **Body:**
  ```json
  {
    "model": "crm-di-glm47b_30b_it",
    "messages": [
      {"role": "system", "content": "You are a helpful assistant."},
      {"role": "user",   "content": "What is the capital of France?"}
    ],
    "max_tokens": 4000,
    "temperature": 0.1,
    "stream": false,
    "chat_template_kwargs": {
      "enable_thinking": false
    }
  }
  ```

  | Field                           | Type    | Notes                                         |
  |---------------------------------|---------|-----------------------------------------------|
  | `model`                         | string  | Model identifier (see env `MODEL_SQL` / `MODEL_ANSWER`) |
  | `messages`                      | array   | OpenAI-style message array with `role` + `content` |
  | `max_tokens`                    | int     | Max tokens to generate. This project uses 4000 |
  | `temperature`                   | float   | `0.1` for deterministic (SQL), `0.4` for creative (answers) |
  | `stream`                        | bool    | Always `false` in this project                |
  | `chat_template_kwargs.enable_thinking` | bool | `false` — disables chain-of-thought tokens |

- **Model identifier used:** `crm-di-glm47b_30b_it` (GLM-4.7-Flash, 30B instruct)
- **Timeout:** 180 seconds

### Example (Python with httpx)

```python
import httpx

headers = {
    "Authorization": f"Zoho-oauthtoken {access_token}",
    "CATALYST-ORG": "YOUR_ORG_ID",
    "Content-Type": "application/json",
}
payload = {
    "model": "crm-di-glm47b_30b_it",
    "messages": [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user",   "content": "Summarize this in one sentence."},
    ],
    "max_tokens": 4000,
    "temperature": 0.1,
    "stream": False,
    "chat_template_kwargs": {"enable_thinking": False},
}

resp = httpx.post(
    "https://api.catalyst.zoho.in/quickml/v1/project/YOUR_PROJECT_ID/glm/chat",
    headers=headers,
    json=payload,
    timeout=180.0,
)
data = resp.json()
```

### Response

The API returns one of two shapes (the code handles both):

**Shape 1 — Direct (observed in production):**
```json
{
  "response": "Paris is the capital of France."
}
```

**Shape 2 — OpenAI-compatible:**
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Paris is the capital of France."
      }
    }
  ]
}
```

Extraction logic:
```python
def _extract_response_text(data: dict) -> str:
    # Shape 1
    if "response" in data and isinstance(data["response"], str):
        return data["response"].strip()
    # Shape 2
    choices = data.get("choices")
    if choices:
        return choices[0].get("message", {}).get("content", "").strip()
    return ""
```

### Retry logic

The codebase retries up to 3 times with exponential backoff on:
- HTTP `429` (rate limited)
- HTTP `408` (timeout)
- HTTP `5xx` (server errors)
- `httpx.TimeoutException` / `httpx.HTTPError` (network failures)

```
Delay = base_delay * (2^attempt) + jitter(0.1–0.5s)
Base delay = 1.0s → delays: ~1.1s, ~2.2s, ~4.3s
```

---

## 6. Environment Variables Reference

Copy `.env.example` to `.env` and fill these in:

```bash
# ─── Catalyst identity ────────────────────────────────────────────────────────
CATALYST_PROJECT_ID=your_catalyst_project_id      # numeric project ID
CATALYST_ORG_ID=your_catalyst_org_id              # numeric org ID (sent as CATALYST-ORG header)

# ─── Auth: fallback static token (used if refresh creds below are absent) ─────
CATALYST_API_TOKEN=your_short_lived_access_token  # ~1h TTL, manual rotation

# ─── Auth: OAuth refresh flow (RECOMMENDED — never expires) ──────────────────
CATALYST_CLIENT_ID=your_oauth_client_id
CATALYST_CLIENT_SECRET=your_oauth_client_secret
CATALYST_REFRESH_TOKEN=your_oauth_refresh_token

# ─── Region ───────────────────────────────────────────────────────────────────
CATALYST_BASE_URL=https://api.catalyst.zoho.in         # .in / .com / .eu
CATALYST_ACCOUNTS_URL=https://accounts.zoho.in/oauth/v2/token

# ─── GLM / QuickML ────────────────────────────────────────────────────────────
QUICKML_LLM_URL=https://api.catalyst.zoho.in/quickml/v1/project/YOUR_PROJECT_ID/glm/chat
MODEL_SQL=crm-di-glm47b_30b_it
MODEL_ANSWER=crm-di-glm47b_30b_it

# ─── Zia Voice ────────────────────────────────────────────────────────────────
ZIA_STT_URL=https://api.catalyst.zoho.in/quickml/api/v1/models/zia/audio/transcribe
ZIA_TTS_URL=https://api.catalyst.zoho.in/quickml/api/v1/models/zia/tts/synthesize
ZIA_TRANSLATE_URL=https://api.catalyst.zoho.in/quickml/api/v1/models/zia/translate
```

---

## 7. How to Get the API Keys / Credentials

You need a **Zoho Catalyst** account with a project set up. Here is the full step-by-step:

---

### Step 1 — Create a Zoho account and set up Catalyst

1. Go to [https://catalyst.zoho.in](https://catalyst.zoho.in) (India) or [https://catalyst.zoho.com](https://catalyst.zoho.com) (US).
2. Sign in or create a Zoho account.
3. Create a new Catalyst project. Note down:
   - **Project ID** (visible in the project URL and dashboard) → `CATALYST_PROJECT_ID`
   - **Organization ID** (under your org settings) → `CATALYST_ORG_ID`

---

### Step 2 — Enable QuickML (GLM + Zia)

1. Inside your Catalyst project, navigate to **QuickML** in the left sidebar.
2. Enable the QuickML service for your project.
3. GLM and Zia models will be available at the endpoint patterns shown above once enabled.
4. The model ID `crm-di-glm47b_30b_it` is Zoho's hosted GLM-4.7-Flash — no separate deployment needed.

---

### Step 3 — Get OAuth credentials (for the refresh token flow)

Go to the **Zoho API Console** at [https://api-console.zoho.in](https://api-console.zoho.in):

1. Click **Add Client** → choose **Self Client** (for server-to-server / backend use).
2. Copy the generated:
   - `Client ID` → `CATALYST_CLIENT_ID`
   - `Client Secret` → `CATALYST_CLIENT_SECRET`
3. Under **Generate Code**, enter the required scopes:
   ```
   ZohoCatalyst.projects.ALL,ZohoCatalyst.quickml.ALL
   ```
4. Set **Time Duration** to maximum (10 minutes is fine — you just need to use it once).
5. Click **Create** — you get a short-lived **authorization code**.
6. Exchange the code for a refresh token via:

   ```http
   POST https://accounts.zoho.in/oauth/v2/token
   Content-Type: application/x-www-form-urlencoded

   grant_type=authorization_code
   &client_id={CLIENT_ID}
   &client_secret={CLIENT_SECRET}
   &redirect_uri=https://localhost   (must match what you set in the console)
   &code={AUTHORIZATION_CODE}
   ```

   Response will include:
   ```json
   {
     "access_token": "...",
     "refresh_token": "...",   ← this is permanent, save it
     "expires_in": 3600
   }
   ```

7. Save the `refresh_token` → `CATALYST_REFRESH_TOKEN`

---

### Step 4 — Static token (bootstrap / simple use)

If you don't want to set up the refresh flow immediately:

1. In the Catalyst console go to **Settings → API Keys** (or use the API Console OAuth flow but just grab the `access_token` from Step 3).
2. Paste it as `CATALYST_API_TOKEN`.
3. **Caveat:** it expires in ~1 hour. Fine for development, not for production.

---

### What you need in total

| Credential              | Where to get it                          | Required? |
|-------------------------|------------------------------------------|-----------|
| `CATALYST_PROJECT_ID`   | Catalyst console → project URL           | Yes       |
| `CATALYST_ORG_ID`       | Catalyst console → org settings          | Yes       |
| `CATALYST_CLIENT_ID`    | Zoho API Console → Self Client           | Recommended |
| `CATALYST_CLIENT_SECRET`| Zoho API Console → Self Client           | Recommended |
| `CATALYST_REFRESH_TOKEN`| OAuth authorization_code exchange        | Recommended |
| `CATALYST_API_TOKEN`    | Short-lived access token (fallback only) | Fallback  |

Once those are set, the `QUICKML_LLM_URL`, `ZIA_STT_URL`, `ZIA_TTS_URL`, and `ZIA_TRANSLATE_URL` follow the fixed URL patterns — just substitute your `PROJECT_ID` and pick the correct region host.

---

## Quick Cheat-Sheet

```
# Auth on EVERY call:
Authorization: Zoho-oauthtoken {access_token}
CATALYST-ORG: {CATALYST_ORG_ID}

# STT (multipart/form-data):
POST .../quickml/api/v1/models/zia/audio/transcribe
  file: audio.wav (16kHz mono WAV)
  language: en
→ {"data": {"transcript": "..."}}

# Translate (JSON):
POST .../quickml/api/v1/models/zia/translate
  {"text": "...", "src_lang": "kn", "tgt_lang": "en"}
→ {"translated_text": "..."}

# TTS (JSON):
POST .../quickml/api/v1/models/zia/tts/synthesize
  {"text": "...", "language": "en", "speaker": "Mary", "pitch": "moderate", "speed": "moderate", "emotion": "neutral"}
→ raw audio bytes

# GLM (JSON):
POST .../quickml/v1/project/{PROJECT_ID}/glm/chat
  {"model": "crm-di-glm47b_30b_it", "messages": [...], "max_tokens": 4000, "temperature": 0.1, "stream": false, "chat_template_kwargs": {"enable_thinking": false}}
→ {"response": "..."} or {"choices": [{"message": {"content": "..."}}]}
```
