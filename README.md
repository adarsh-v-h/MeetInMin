# MeetInMin

MeetInMin is an intelligent meeting assistant. It captures meeting audio from your browser, transcribes it using Zoho's Speech-to-Text, and uses Zoho's language model to generate structured meeting summaries, action items, and key decisions — optionally enriched with context pulled from your Gmail inbox.

## Features

1. **Browser-Based Audio Capture** — A lightweight Chrome Extension (`MeetInMinExe`) captures tab audio during Google Meet without requiring bots to join calls.
2. **Secure Audio Ingestion** — A FastAPI backend accepts audio via cryptographically secure API keys.
3. **Zoho AI Pipeline** — Zoho Catalyst Zia STT transcribes the audio; Zoho GLM produces structured meeting intelligence (summaries, action items, key decisions).
4. **Gmail Context Enrichment** — Optionally uses your connected Gmail account to cross-reference relevant emails against the transcript, giving the AI better context for more accurate results.
5. **Web Dashboard** — A glassmorphism React SPA to review meetings, transcripts, insights, and email attribution.

## Architecture

| Layer | Technology |
|---|---|
| Backend API | FastAPI (Python, async) |
| Database | SQLAlchemy 2.0 (SQLite, swappable to PostgreSQL) |
| Password Hashing | Argon2 via CFFI |
| Sessions | JWT + Google OAuth 2.0 |
| Speech-to-Text | Zoho Catalyst Zia STT |
| Meeting Intelligence | Zoho GLM (`crm-di-glm47b_30b_it`) |
| Email Enrichment | Gmail API (OAuth, read-only) |
| Frontend | React + Vite + Vanilla CSS |
| Chrome Extension | Manifest V3, Offscreen Documents |

## Getting Started

### Prerequisites
- Python ≥ 3.11 with [`uv`](https://github.com/astral-sh/uv)
- Node.js ≥ 18
- `ffmpeg` installed on your system (required for audio conversion before STT)

### Backend Setup
```bash
cd backend
uv sync
cp .env.example .env   # fill in your credentials (see below)
uv run uvicorn app.main:app --reload
```
Swagger UI available at `http://127.0.0.1:8000/docs`.

### Frontend Setup
```bash
cd frontend
npm install
npm run dev
```
Dashboard available at `http://localhost:5173`.

### Extension Setup
1. Open Chrome → `chrome://extensions/`
2. Enable **Developer Mode**
3. Click **Load unpacked** → select the `MeetInMinExe` directory
4. Log into the dashboard, generate an API Key, and paste it into the extension popup

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and fill in:

| Variable | Description |
|---|---|
| `SECRET_KEY` | Random secret for JWT signing |
| `DATABASE_URL` | SQLAlchemy DB URL (e.g. `sqlite:///./meetinmin.db`) |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_REDIRECT_URI` | OAuth callback URL (default: `http://localhost:8000/v1/auth/login/google/callback`) |
| `ZOHO_CLIENT_ID` | Zoho Catalyst OAuth client ID |
| `ZOHO_CLIENT_SECRET` | Zoho Catalyst OAuth client secret |
| `ZOHO_REFRESH_TOKEN` | Long-lived Zoho refresh token |
| `ZOHO_CATALYST_ORG` | Zoho Catalyst organization ID |
| `CATALYST_PROJECT_ID` | Zoho Catalyst project ID |
| `CATALYST_BASE_URL` | Zoho Catalyst base URL (e.g. `https://api.catalyst.zoho.in`) |

## How the AI Pipeline Works

```
Meeting Audio (.webm)
       ↓
 Convert to 16kHz mono WAV (ffmpeg/pydub)
       ↓
 Zoho Zia STT → Raw Transcript (stored in DB)
       ↓
 Gmail connected?
 ├── YES → Keyword extraction GLM call
 │         → Gmail API search + fetch
 │         → Build email context string
 │         → Store attribution records (EmailContextSource)
 └── NO  → Proceed with transcript only
       ↓
 Zoho GLM — analyzes transcript + email context (if any)
       ↓
 Structured Output: Summary · Action Items · Key Decisions
       ↓
 Saved to DB → Meeting status: completed
```

**Privacy:** Raw email bodies are never stored. Only subject, sender, date, and a short snippet are saved for attribution display.

## License

Licensed under the Apache License, Version 2.0. See the `LICENSE` file for details.
