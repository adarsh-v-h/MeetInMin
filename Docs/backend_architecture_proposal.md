# Backend Integration & Architecture Proposal

## Current Extension Status (MeetInMinExe)

I have inspected the `MeetInMinExe/` repository. The extension currently features a highly modular architecture (categorized into `src/popup`, `src/background`, `src/offscreen`, etc.). 

**What works right now:**
1. **Audio Capture:** It correctly captures tab audio (via `chrome.tabCapture`) and microphone audio (via user permission granted in `permission.html`).
2. **Audio Mixing:** It successfully mixes these streams using the Web Audio API inside the offscreen document.
3. **Recording & Storage:** It records the mixed stream using `MediaRecorder` and safely chunks the data into an `IndexedDB` database to survive background worker restarts.
4. **Output:** On stop, it stitches the chunks together into a single `Blob` and triggers a local download via `chrome.downloads`.

---

## Proposal for Audio Upload MVP

### 1. Minimal Backend Architecture
- **Framework:** FastAPI (Python).
- **Async Processing:** For the simplest reliable setup without Redis/Kafka, we can use a **database-backed polling worker** (or FastAPI `BackgroundTasks` if you are okay with ephemeral tasks for the very first prototype). A simple table `background_jobs` that a background thread polls is robust, easy to inspect, and requires zero extra infrastructure.
- **Storage:** Local filesystem (e.g., `uploads/` directory) for development, abstracted behind a `StorageProvider` interface so S3 can be dropped in later.

### 2. API Contract
Following a clean REST design:

* **Initialize Capture:**
  `POST /v1/capture/sessions`
  *(Returns a `session_id` and initial status)*
* **Upload Audio:**
  `POST /v1/capture/sessions/{id}/audio`
  *(Accepts `multipart/form-data` containing the WebM file)*
* **Complete Session:**
  `POST /v1/capture/sessions/{id}/complete`
  *(Marks the upload as finished and triggers the background processing pipeline)*

### 3. Initial Database Entities
Using PostgreSQL (e.g., via SQLAlchemy/SQLModel), the initial core tables for this slice would be:
- `users`: `id`, `email`, `hashed_password`, `created_at`
- `capture_sessions`: `id`, `user_id`, `status` (IDLE, UPLOADING, PROCESSING, COMPLETED, ERROR), `started_at`, `ended_at`
- `meeting_recordings`: `id`, `capture_session_id`, `storage_path`, `file_size_bytes`, `duration_ms`, `format`

### 4. Extension Authentication
For the MVP upload flow:
1. The user logs into the Web Dashboard.
2. The Dashboard generates a long-lived **Extension API Token**.
3. The user opens the Extension Options page (which we will build) and pastes this token.
4. The extension stores the token in `chrome.storage.local` and passes it in the `Authorization: Bearer <token>` header for all `/v1/capture` requests.

### 5. Recording Lifecycle
1. **CAPTURING:** Extension starts recording, saving chunks to IndexedDB.
2. **UPLOADING:** User clicks "Stop". Extension initiates `POST /v1/capture/sessions` to get an ID. It then reads the chunks, constructs the WebM blob, and uploads it via `POST /v1/capture/sessions/{id}/audio`.
3. **PROCESSING:** Extension calls `POST .../complete`. The backend acknowledges and spawns a background task. The extension can transition to a "Processing" UI or return to Idle.

### 6. Problems with the Current Extension Architecture
- **Memory Limits with Large Blobs:** Currently, the offscreen document reads *all* chunks from IndexedDB and stitches them into a single in-memory `Blob` before downloading. For a 2-hour meeting, this Blob could consume hundreds of megabytes of RAM and crash the offscreen document. 
  - *Fix for Upload:* We should ideally stream the chunks directly from IndexedDB into the HTTP request body (using a `ReadableStream` or by uploading in smaller parts) rather than loading everything into RAM at once. For the *very* first MVP, a single `fetch()` with the Blob might survive, but it is a scaling risk.
- **Local Download Logic:** The current reliance on `chrome.downloads.download` will need to be entirely removed and replaced with the `fetch()` API calls to the FastAPI backend.
