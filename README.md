# 🎙️ MeetInMin

**MeetInMin** is an invisible, AI-powered meeting intelligence assistant. It silently captures audio directly from your browser tab during meetings (Google Meet, Zoom, Teams, or video streams, anything on a web browser we can take it) without requiring any awkward AI bots to join your calls. It transcribes audio using **Zoho Zia Speech-to-Text**, extracts key decisions and action items using **Zoho GLM**, and optionally enriches insights with context from your **Gmail inbox**.

---

## ⚡ Key Highlights

- **Zero-Bot Ingestion**: Captures high-fidelity tab & microphone audio via a lightweight Chrome extension (`MeetInMinExe`) — no meeting room bots required.
- **Zoho AI Intelligence**: Powered by Zoho Catalyst Zia STT (with automatic 4-minute audio chunking) and Zoho GLM (`crm-di-glm47b_30b_it`).
- **Itemized Confidence Scoring**: Evaluates summary bullet points, key decisions, and action items on a `0.00` to `1.00` confidence scale (High/Medium/Low badges with explanation tooltips).
- **AI Smart Titles & Custom Renaming**: Automatically generates 3-6 word descriptive meeting titles and supports inline manual title renaming (`PATCH /v1/meetings/{id}`).
- **Mailbox Intelligence**: Connects to your Gmail via OAuth 2.0 to cross-reference email context, attributing decisions and follow-ups to relevant email threads without storing raw email content.
- **Local Safety Backup & Auto-Migrations**: Extension offers 1-click local `.webm` file downloads, and the backend performs automatic startup schema migrations.
- **Full Data Ownership**: Download raw transcripts (`.txt`) and original meeting audio (`.webm`) directly from your dashboard anytime.

---

## 🚀 Quick Start Guide

### Prerequisites
1. **Python ≥ 3.11** with [`uv`](https://github.com/astral-sh/uv) installed.
2. **Node.js ≥ 18** and `npm`.
3. **`ffmpeg`** installed on your system (required for audio conversion and chunking).
   * **Linux (Ubuntu/Debian)**: `sudo apt update && sudo apt install ffmpeg`
   * **macOS**: `brew install ffmpeg`
   * **Windows**: Install via `choco install ffmpeg` or download binaries from [ffmpeg.org](https://ffmpeg.org).

---

## 🔑 Credential Setup Guide (Step-by-Step)

To run MeetInMin, you will need credentials for **Google OAuth** (for user login & Gmail context) and **Zoho Catalyst** (for STT and GLM AI services).

### 1. Setting Up Google OAuth Credentials
1. Go to the [Google Cloud Console](https://console.cloud.google.com/).
2. Create a new project (e.g., `MeetInMin`).
3. Navigate to **APIs & Services > OAuth consent screen**:
   * User Type: **External** (or Internal for Workspace organizations).
   * App name: `MeetInMin`.
   * User support email & Developer contact email: Your email.
   * Scopes: Add `openid`, `email`, `profile`, and `https://www.googleapis.com/auth/gmail.readonly`.
4. Navigate to **APIs & Services > Credentials**:
   * Click **Create Credentials > OAuth client ID**.
   * Application type: **Web application**.
   * Name: `MeetInMin Web Client`.
   * **Authorized JavaScript origins**: `http://localhost:5173` and `http://localhost:8000`.
   * **Authorized redirect URIs**: `http://localhost:8000/v1/auth/login/google/callback`.
5. Copy your **Client ID** and **Client Secret**.

---

### 2. Setting Up Zoho Catalyst AI Credentials
1. Sign up or log into [Zoho Catalyst Console](https://catalyst.zoho.in) (or `.com` / `.eu` depending on your region).
2. Create a Catalyst Project (e.g., `MeetInMin`).
3. Note down your **Organization ID** (`ZOHO_CATALYST_ORG`) and **Project ID** (`CATALYST_PROJECT_ID`).
4. Go to [Zoho Developer Console](https://api-console.zoho.in) to create a Self-Client or Server-based Client:
   * Generate Client ID & Client Secret.
   * Generate a long-lived **Refresh Token** with scopes: `ZohoCatalyst.projects.READ,ZohoCatalyst.ml.READ`.

---

## ⚙️ Environment Configuration (`.env`)

Create a `.env` file inside the `backend/` directory based on `backend/.env.example`:

```ini
# Core Configuration
SECRET_KEY=your-random-secret-key-min-32-chars
DATABASE_URL=sqlite:///./meetinmin.db
FRONTEND_URL=http://localhost:5173

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:8000/v1/auth/login/google/callback

# Zoho Catalyst AI Credentials
ZOHO_CLIENT_ID=your-zoho-client-id
ZOHO_CLIENT_SECRET=your-zoho-client-secret
ZOHO_REFRESH_TOKEN=your-zoho-refresh-token
ZOHO_CATALYST_ORG=your-zoho-org-id
CATALYST_PROJECT_ID=your-zoho-project-id
CATALYST_BASE_URL=https://api.catalyst.zoho.in
ZOHO_GLM_MODEL=crm-di-glm47b_30b_it
```

---

## 💻 Running the Application

### 1. Start the Backend API
```bash
cd backend
uv sync
uv run uvicorn app.main:app --reload --port 8000
```
* Interactive API Documentation (Swagger UI): `http://localhost:8000/docs`

### 2. Start the Frontend Dashboard
```bash
cd frontend
npm install
npm run dev
```
* Dashboard URL: `http://localhost:5173`

### 3. Load the Chrome Extension (`MeetInMinExe`)
1. Open Google Chrome and navigate to `chrome://extensions/`.
2. Enable **Developer Mode** using the toggle in the top-right corner.
3. Click **Load unpacked** and select the `MeetInMinExe` directory in this repository (or unzip `frontend/public/MeetInMin-Extension.zip`).
4. The **MeetInMin** extension icon will appear in your Chrome toolbar.

---

## 📱 How to Use MeetInMin (User Workflow)

1. **Sign Up / Log In**: Open `http://localhost:5173` and register your account.
2. **Generate Extension API Key**:
   * Navigate to the **API Keys** tab in the dashboard sidebar.
   * Click **Generate New Key** (e.g. `Work Laptop`) and copy your generated key.
3. **Connect Gmail (Optional)**:
   * Go to **Settings** and click **Connect Google**.
   * Authorize read-only access so MeetInMin can correlate email threads with your meetings.
4. **Record a Meeting**:
   * Join a Google Meet, Zoom, or video call tab in Chrome.
   * Click the **MeetInMin Extension icon** in your toolbar.
   * Paste your API Key.
   * (Optional) Toggle **Include Microphone** to record both tab audio and your microphone.
   * Click **Start Recording**.
   * When finished, click **Stop Recording**. The audio is uploaded automatically.
5. **View AI Insights**:
   * Open your Dashboard (`http://localhost:5173/dashboard`).
   * Once processing completes, click the meeting card to inspect the **Executive Summary**, **Key Decisions**, **Action Items**, **Gmail Source Attribution**, and download transcripts/audio files.

---

## 📖 Additional Documentation & Resources

- 🏗️ **Technical Architecture**: See [ARCHITECTURE.md](file:///home/venzz/Work/Projects/MeetInMin/Docs/ARCHITECTURE.md) for full developer diagrams, data pipelines, STT chunking mechanics, and DB schemas.

---

## 📄 License

Licensed under the [Apache License, Version 2.0](LICENSE).
