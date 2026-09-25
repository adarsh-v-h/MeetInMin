# MeetInMin

MeetInMin is an intelligent meeting assistant built as a robust Minimum Viable Product (MVP). It is designed to capture meeting audio, generate accurate meeting minutes, and autonomously use mailbox context to suggest useful follow-up actions.

## Overview

1. **Browser-Based Meeting Audio Capture:** A lightweight Chrome Extension (`MeetInMinExe`) that securely captures tab audio during Google Meets without requiring intrusive bots to join the call.
2. **Audio Ingestion:** A secure, asynchronous FastAPI backend that receives audio files seamlessly via cryptographically secure API keys.
3. **Meeting Intelligence (In Development):** Leverages Speech-to-Text (STT) models and large language models (LLMs) to automatically generate meeting minutes and action items.
4. **Email Integration (In Development):** Integrates with Google OAuth to fetch relevant inbox context, correlating past emails with the current meeting to proactively draft follow-up emails.

## Architecture

MeetInMin is engineered to prioritize code quality, security, and simplicity:

* **Backend:** Built on FastAPI leveraging async Python for high performance.
* **Database:** Uses SQLAlchemy 2.0 with strict transactional boundaries. Currently defaults to SQLite for rapid development, but abstracts connection logic for seamless integration with PostgreSQL.
* **Security:** 
  * Implements Argon2 (via CFFI) in a threadpool for enterprise-grade non-blocking password hashing.
  * Uses JSON Web Tokens (JWT) for stateless session management.
  * Uses SHA-256 hashing for secure, normalized API Key management.
* **Extension:** A Manifest V3 Chrome Extension utilizing Offscreen documents for reliable tab audio recording.

## Getting Started

### Backend Setup
1. Ensure you have [`uv`](https://github.com/astral-sh/uv) installed.
2. Navigate to the root directory and run `uv sync` to install all dependencies.
3. Start the FastAPI development server:
   ```bash
   cd backend
   uv run uvicorn app.main:app --reload
   ```
4. Access the auto-generated Swagger UI documentation at `http://127.0.0.1:8000/docs`.

### Extension Setup
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable Developer Mode in the top right corner.
3. Click Load unpacked and select the `MeetInMinExe` directory.
4. Log into the backend dashboard to generate your API Key, and paste it into the extension popup.

## License
This project is licensed under the Apache License, Version 2.0. See the LICENSE file for details.