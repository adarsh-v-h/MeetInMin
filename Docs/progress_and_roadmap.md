# MeetInMin MVP: Progress & Roadmap

## 🚀 What We Have Built So Far

### 1. Backend Architecture & Security
* **FastAPI Foundation:** Set up a highly performant, async-first Python API structure.
* **Database Models:** Designed a normalized SQLAlchemy schema (currently running on SQLite for rapid development) featuring:
  * `User` table for core identity (Username, Email, Hashed Passwords).
  * `APIKey` table mapped to users via a Foreign Key to support multiple revokable extension keys.
* **Cryptographic Security:** 
  * Implemented **Argon2** (via CFFI) in a non-blocking threadpool for enterprise-grade password hashing.
  * Implemented **JWT (JSON Web Tokens)** for stateless frontend web sessions.
  * Implemented **SHA-256 Hashing** for instant, secure API Key verification.

### 2. The Authentication Engine
* **Manual Registration & Login:** Fully wired endpoints (`POST /register`, `POST /login`) supporting username or email login.
* **Google OAuth 2.0 Integration:** 
  * `GET /login/google`: Redirects to Google consent screen requesting Gmail Read-Only access.
  * `GET /login/google/callback`: Exchanges codes for Access and Refresh tokens, and verifies identity.
  * `POST /complete-profile`: The "Option 2" flow that forces Google-auth users to pick a unique username before finalizing their account.

### 3. The Chrome Extension Bridge
* **API Key Generation:** `POST /generate-api-key` endpoint allowing users to spawn secure connection strings.
* **Audio Ingestion API:** `POST /meetings/upload/{api_key}` endpoint built to accept massive audio files.
  * Uses `aiofiles` for asynchronous 1MB chunked writing to prevent blocking the FastAPI event loop.
  * Auto-generates collision-proof filenames (`username_uuid_timestamp.webm`).
  * Features instantaneous API Key hash verification.

---

## 🗺️ What Is Left To Build

### Phase 1: Wiring the Chrome Extension
* **Popup UI Update:** Add a text input box in the extension popup for users to paste their generated API Key.
* **Upload Logic:** Modify the extension's recording script so that when the user clicks "Stop", it takes the `.webm` audio blob and POSTs it directly to our FastAPI upload endpoint (instead of downloading it locally).

### Phase 2: Speech-to-Text & Processing
* **Whisper Integration:** Add a background task in FastAPI that automatically triggers when a file finishes uploading to convert the audio into a highly accurate text transcript.
* **Meeting Intelligence (LLM):** Feed the raw transcript into an LLM (e.g., GPT-4 or Gemini) with a strict prompt to extract Meeting Minutes, Action Items, and Key Decisions.

### Phase 3: The "Read.ai" Email Magic
* **Gmail API Connection:** Use the user's stored `google_refresh_token` to securely fetch recent emails from their inbox without asking for permission again.
* **Contextual Correlation:** Pass both the Meeting Minutes *and* the recent Emails to the LLM to generate highly contextual, ready-to-send follow-up actions and draft emails.

### Phase 4: The Web Dashboard (Frontend)
* **User Interface:** Scaffold a beautiful, modern React/Vite dashboard where users can actually log in.
* **Meeting History View:** Build the UI to display past meeting recordings, transcripts, and AI-generated action items.
