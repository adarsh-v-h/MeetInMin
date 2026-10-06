const TIMESLICE_MS = 2000;
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm"];
const DB_NAME = "meetinmin";
const DB_VERSION = 1;
const CHUNK_STORE = "chunks";
const RECORDING_STORE = "recordings";

let recorder = null;
let mediaStream = null;
let micStream = null;
let audioContext = null;
let recordingId = "";
let chunkWriteQueue = Promise.resolve();
let bytes = 0;
let chunkCount = 0;
let chunkSeq = 0;
let startedAt = 0;
let pausedAt = 0;
let pausedDurationMs = 0;
let progressTimer = null;
let currentObjectUrl = "";
let dbPromise = null;

// Status object tracking current recording state
let status = {
  state: "idle",
  durationMs: 0,
  bytes: 0,
  chunks: 0,
  mimeType: "",
  filename: "",
  error: "",
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.target !== "offscreen") {
    return false;
  }

  handleMessage(message)
    .then((response) => sendResponse({ ok: true, ...response }))
    .catch((error) => {
      const errorMessage = getErrorMessage(error);
      setStatus({ state: "error", error: errorMessage });
      stopProgressTimer();
      stopTracks();
      sendToWorker("RECORDING_ERROR", { error: errorMessage, status }).catch(() => {});
      sendResponse({ ok: false, error: errorMessage, status });
    });

  return true;
});

addEventListener("error", (event) => {
  const message = event.error?.message || event.message || t("errorOffscreenUnexpected");
  setStatus({ state: "error", error: message });
  sendToWorker("RECORDING_ERROR", { error: message, status }).catch(() => {});
});

async function handleMessage(message) {
  switch (message.type) {
    case "OFFSCREEN_GET_STATUS":
      await recoverStoredRecording();
      updateDuration();
      return { status, recoveredRecordingId: getRecoveredRecordingId(), currentObjectUrl };
    case "OFFSCREEN_START":
      return { status: await startRecording(message) };
    case "OFFSCREEN_PAUSE":
      return { status: await pauseRecording() };
    case "OFFSCREEN_RESUME":
      return { status: await resumeRecording() };
    case "OFFSCREEN_STOP":
      return { status: stopRecording() };
    case "OFFSCREEN_FINALIZE_RECOVERED":
      return await finalizeRecoveredRecording(message.recordingId);
    case "OFFSCREEN_REVOKE_URL":
      revokeObjectUrl(message.url);
      return { status };
    case "OFFSCREEN_GET_BLOB_URL":
      return { url: await getOrCreateBlobUrl() };
    case "OFFSCREEN_RETRY_UPLOADS":
      return { retriedCount: await retryPendingUploads() };
    default:
      throw new Error(t("errorUnknownOffscreenMessageType", [message.type]));
  }
}

let activeApiKey = "";

async function startRecording({ streamId, filename, recordMic, apiKey }) {
  if (status.state === "recording" || status.state === "paused") {
    throw new Error(t("errorRecordingAlreadyRunning"));
  }

  activeApiKey = apiKey || "";

  const mimeType = chooseMimeType();
  if (!mimeType) {
    throw new Error(t("errorUnsupportedMime"));
  }

  await resetRecordingState({ mimeType, filename });

  mediaStream = await navigator.mediaDevices.getUserMedia({
    audio: {
      mandatory: {
        chromeMediaSource: "tab",
        chromeMediaSourceId: streamId,
      },
    },
    video: false,
  });

  audioContext = new AudioContext({ latencyHint: "playback" });
  const tabSource = audioContext.createMediaStreamSource(mediaStream);
  
  if (recordMic) {
    try {
      micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (e) {
      throw new Error("Microphone access denied.");
    }
  }

  const destination = audioContext.createMediaStreamDestination();
  tabSource.connect(destination);
  
  if (micStream) {
    const micSource = audioContext.createMediaStreamSource(micStream);
    micSource.connect(destination);
  }

  // Chrome mutes the source tab while captured; route it back to the user locally.
  tabSource.connect(audioContext.destination);

  recorder = new MediaRecorder(destination.stream, { mimeType });
  recorder.ondataavailable = handleDataAvailable;
  recorder.onerror = (event) => {
    const message = event.error?.message || t("errorMediaRecorderFailed");
    setStatus({ state: "error", error: message });
    sendToWorker("RECORDING_ERROR", { error: message, status }).catch(() => {});
  };
  recorder.onstop = finalizeRecording;

  startedAt = Date.now();
  await persistCurrentRecordingMeta();
  recorder.start(TIMESLICE_MS);
  setStatus({ state: "recording" });
  startProgressTimer();
  await sendToWorker("STATUS_UPDATE", { status });
  return status;
}

async function pauseRecording() {
  if (!recorder || recorder.state !== "recording") {
    return status;
  }

  recorder.pause();
  await audioContext?.suspend();
  pausedAt = Date.now();
  setStatus({ state: "paused", durationMs: getDurationMs() });
  sendToWorker("STATUS_UPDATE", { status }).catch(() => {});
  return status;
}

async function resumeRecording() {
  if (!recorder || recorder.state !== "paused") {
    return status;
  }

  pausedDurationMs += Date.now() - pausedAt;
  pausedAt = 0;
  await audioContext?.resume();
  recorder.resume();
  setStatus({ state: "recording", durationMs: getDurationMs() });
  sendToWorker("STATUS_UPDATE", { status }).catch(() => {});
  return status;
}

function stopRecording() {
  if (!recorder || recorder.state === "inactive") {
    stopProgressTimer();
    stopTracks();
    return status;
  }

  updateDuration();
  setStatus({ state: "saving" });
  stopProgressTimer();
  recorder.stop();
  sendToWorker("STATUS_UPDATE", { status }).catch(() => {});
  return status;
}

function handleDataAvailable(event) {
  if (!event.data || event.data.size === 0) {
    return;
  }

  chunkWriteQueue = chunkWriteQueue
    .then(() => storeDataChunk(event.data))
    .catch((error) => {
      setStatus({ state: "error", error: getErrorMessage(error) });
      sendToWorker("RECORDING_ERROR", { error: status.error, status }).catch(() => {});
    });
}

async function finalizeRecording() {
  updateDuration();
  stopTracks();

  try {
    await chunkWriteQueue;

    // Read chunks and assemble the Blob right here — the blob is live in this context.
    const chunkBlobs = await readRecordingChunks(recordingId);
    if (!chunkBlobs.length) {
      throw new Error(t("errorRecordingNoFile"));
    }
    const blob = new Blob(chunkBlobs, { type: status.mimeType });
    setStatus({ bytes: blob.size, chunks: chunkBlobs.length, durationMs: getDurationMs() });

    // Always create local object URL so user can manually download anytime
    currentObjectUrl = URL.createObjectURL(blob);

    // Attempt upload directly from offscreen where the Blob is alive.
    const uploadRes = await tryUploadToBackend(blob, status.filename);

    const result = {
      uploaded: uploadRes.success,
      hadApiKey: uploadRes.hadApiKey,
      uploadError: uploadRes.error || "",
      url: currentObjectUrl,
      filename: status.filename,
      bytes: blob.size,
      durationMs: status.durationMs,
      status: { ...status, state: "completed", bytes: blob.size },
    };

    await sendToWorker("RECORDING_COMPLETE", result);
  } catch (error) {
    setStatus({ state: "error", error: getErrorMessage(error) });
    sendToWorker("RECORDING_ERROR", { error: status.error, status }).catch(() => {});
  }
}

async function getOrCreateBlobUrl() {
  if (currentObjectUrl) {
    return currentObjectUrl;
  }
  if (recordingId) {
    const chunkBlobs = await readRecordingChunks(recordingId);
    if (chunkBlobs.length > 0) {
      const blob = new Blob(chunkBlobs, { type: status.mimeType || "audio/webm" });
      currentObjectUrl = URL.createObjectURL(blob);
      return currentObjectUrl;
    }
  }
  const recordings = await getStoredRecordings();
  if (recordings.length > 0) {
    const sorted = recordings.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    for (const rec of sorted) {
      const chunkBlobs = await readRecordingChunks(rec.recordingId);
      if (chunkBlobs.length > 0) {
        const blob = new Blob(chunkBlobs, { type: rec.mimeType || status.mimeType || "audio/webm" });
        currentObjectUrl = URL.createObjectURL(blob);
        return currentObjectUrl;
      }
    }
  }
  return "";
}

async function retryPendingUploads() {
  const recordings = await getStoredRecordings();
  let retried = 0;
  for (const rec of recordings) {
    if (!rec.chunks) continue;
    try {
      const chunkBlobs = await readRecordingChunks(rec.recordingId);
      if (!chunkBlobs.length) continue;
      const blob = new Blob(chunkBlobs, { type: rec.mimeType || "audio/webm" });
      const uploaded = await tryUploadToBackend(blob, rec.filename);
      if (uploaded) {
        await deleteRecordingData(rec.recordingId);
        retried++;
      }
    } catch (e) {
      console.error("[MeetInMin] Error retrying upload for", rec.recordingId, e);
    }
  }
  return retried;
}

async function finalizeRecoveredRecording(targetRecordingId) {
  const meta = await getRecordingMeta(targetRecordingId);
  if (!meta) {
    throw new Error(t("errorRecordingNoFile"));
  }

  recordingId = targetRecordingId;
  bytes = meta.bytes || 0;
  chunkCount = meta.chunks || 0;
  chunkSeq = meta.chunks || 0;
  startedAt = 0;
  pausedDurationMs = meta.pausedDurationMs || 0;
  pausedAt = 0;
  setStatus({
    state: "saving",
    durationMs: meta.durationMs || 0,
    bytes,
    chunks: chunkCount,
    mimeType: meta.mimeType || "",
    filename: meta.filename || "MeetInMin_recovered.webm",
    error: "",
  });

  // Assemble blob and attempt upload directly from offscreen.
  const chunkBlobs = await readRecordingChunks(targetRecordingId);
  if (!chunkBlobs.length) {
    throw new Error(t("errorRecordingNoFile"));
  }
  const blob = new Blob(chunkBlobs, { type: status.mimeType });
  setStatus({ bytes: blob.size, chunks: chunkBlobs.length });

  const uploaded = await tryUploadToBackend(blob, status.filename);

  let result;
  if (uploaded) {
    result = {
      uploaded: true,
      filename: status.filename,
      bytes: blob.size,
      durationMs: status.durationMs,
      status: { ...status, state: "saving", bytes: blob.size },
    };
  } else {
    currentObjectUrl = URL.createObjectURL(blob);
    result = {
      url: currentObjectUrl,
      filename: status.filename,
      bytes: blob.size,
      durationMs: status.durationMs,
      status,
    };
  }

  await deleteRecordingData(targetRecordingId);
  recordingId = "";
  return result;
}

/**
 * Attempts to POST the audio Blob directly to the MeetInMin backend.
 * Must be called from the offscreen document where the Blob is live.
 * Returns true on success, false on any failure (so caller can fall back to local download).
 */
async function tryUploadToBackend(blob, filename) {
  try {
    let apiKey = activeApiKey;
    if (!apiKey) {
      try {
        const keyRes = await sendToWorker("GET_API_KEY", {});
        apiKey = keyRes?.apiKey || "";
      } catch (err) {
        console.warn("[MeetInMin] Failed to query worker for API key:", err);
      }
    }
    console.log("[MeetInMin] Active API Key for upload:", apiKey ? `(key present: ${apiKey.slice(0, 8)}...)` : "NONE (empty)");

    if (!apiKey) {
      console.warn("[MeetInMin] ⚠️ No active API key selected in extension storage — skipping backend upload.");
      return { success: false, hadApiKey: false, error: "No API key selected in extension dropdown" };
    }

    const formData = new FormData();
    formData.append("file", blob, filename);

    // 3-minute timeout — plenty for a large local upload.
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3 * 60 * 1000);

    try {
      console.log(`[MeetInMin] Uploading ${(blob.size / 1024 / 1024).toFixed(2)} MB to backend (http://localhost:8000/v1/meetings/upload/${apiKey.slice(0, 8)}...)...`);
      const response = await fetch(`http://localhost:8000/v1/meetings/upload/${apiKey}`, {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        console.log("[MeetInMin] ✅ Backend Upload Successful!");
        return { success: true, hadApiKey: true };
      }

      const errText = await response.text().catch(() => response.status);
      console.error(`[MeetInMin] ❌ Backend upload failed (HTTP ${response.status}):`, errText);
      return { success: false, hadApiKey: true, error: `HTTP ${response.status}: ${errText}` };
    } catch (fetchErr) {
      clearTimeout(timeoutId);
      if (fetchErr.name === "AbortError") {
        console.error("[MeetInMin] ❌ Upload timed out after 3 minutes.");
        return { success: false, hadApiKey: true, error: "Upload timed out after 3 minutes." };
      } else {
        console.error("[MeetInMin] ❌ Upload fetch exception:", fetchErr);
        return { success: false, hadApiKey: true, error: `Network error: ${fetchErr.message}` };
      }
    }
  } catch (err) {
    console.error("[MeetInMin] ❌ tryUploadToBackend top-level error:", err);
    return { success: false, hadApiKey: false, error: err.message };
  }
}

async function createRecordingResult(targetRecordingId) {
  const chunkBlobs = await readRecordingChunks(targetRecordingId);
  if (!chunkBlobs.length) {
    throw new Error(t("errorRecordingNoFile"));
  }

  const blob = new Blob(chunkBlobs, { type: status.mimeType });
  currentObjectUrl = URL.createObjectURL(blob);
  setStatus({
    state: "saving",
    bytes: blob.size || bytes,
    chunks: chunkBlobs.length,
    durationMs: startedAt ? getDurationMs() : status.durationMs,
  });

  return {
    url: currentObjectUrl,
    filename: status.filename,
    bytes: status.bytes,
    durationMs: status.durationMs,
    status,
  };
}

async function storeDataChunk(blob) {
  if (!recordingId) {
    return;
  }

  const seq = chunkSeq;
  await putChunk({
    recordingId,
    blob,
    seq,
    ts: Date.now(),
  });
  bytes += blob.size;
  chunkCount += 1;
  chunkSeq = seq + 1;
  setStatus({ bytes, chunks: chunkCount, durationMs: getDurationMs() });
}

function chooseMimeType() {
  return MIME_CANDIDATES.find((mimeType) => MediaRecorder.isTypeSupported(mimeType)) || "";
}

async function resetRecordingState({ mimeType, filename }) {
  revokeObjectUrl(currentObjectUrl);
  recorder = null;
  mediaStream = null;
  audioContext = null;
  recordingId = crypto.randomUUID();
  chunkWriteQueue = Promise.resolve();
  bytes = 0;
  chunkCount = 0;
  chunkSeq = 0;
  startedAt = 0;
  pausedAt = 0;
  pausedDurationMs = 0;
  stopProgressTimer();
  await clearRecordingData();
  setStatus({
    state: "preparing",
    durationMs: 0,
    bytes: 0,
    chunks: 0,
    mimeType,
    filename,
    error: "",
  });
}

function startProgressTimer() {
  stopProgressTimer();
  progressTimer = setInterval(() => {
    updateDuration();
    sendToWorker("RECORDING_PROGRESS", { status }).catch(() => {});
  }, 1000);
}

function stopProgressTimer() {
  if (progressTimer) {
    clearInterval(progressTimer);
    progressTimer = null;
  }
}

function updateDuration() {
  setStatus({ durationMs: getDurationMs(), bytes, chunks: chunkCount });
}

function getDurationMs() {
  if (!startedAt) {
    return status.durationMs || 0;
  }

  const now = pausedAt || Date.now();
  return Math.max(0, now - startedAt - pausedDurationMs);
}

function stopTracks() {
  if (mediaStream) {
    mediaStream.getTracks().forEach((track) => track.stop());
    mediaStream = null;
  }

  if (micStream) {
    micStream.getTracks().forEach((track) => track.stop());
    micStream = null;
  }

  if (audioContext) {
    audioContext.close().catch(() => {});
    audioContext = null;
  }
}

function revokeObjectUrl(url) {
  const urlToRevoke = url || currentObjectUrl;
  if (!urlToRevoke) {
    return;
  }

  URL.revokeObjectURL(urlToRevoke);
  if (urlToRevoke === currentObjectUrl) {
    currentObjectUrl = "";
  }
}

async function openDb() {
  if (dbPromise) {
    try {
      const db = await dbPromise;
      if (db && !db.closing) {
        return db;
      }
    } catch {
      // Stale or failed db connection promise
    }
    dbPromise = null;
  }

  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(CHUNK_STORE)) {
        const chunkStore = db.createObjectStore(CHUNK_STORE, { keyPath: "id", autoIncrement: true });
        chunkStore.createIndex("recordingId", "recordingId", { unique: false });
      }

      if (!db.objectStoreNames.contains(RECORDING_STORE)) {
        db.createObjectStore(RECORDING_STORE, { keyPath: "recordingId" });
      }
    };

    request.onsuccess = () => {
      const db = request.result;
      db.onclose = () => {
        dbPromise = null;
      };
      db.onversionchange = () => {
        db.close();
        dbPromise = null;
      };
      resolve(db);
    };

    request.onerror = () => {
      dbPromise = null;
      reject(request.error);
    };
  });

  return dbPromise;
}

async function withStore(storeNames, mode, callback) {
  try {
    const db = await openDb();
    return await new Promise((resolve, reject) => {
      const transaction = db.transaction(storeNames, mode);
      let result;

      transaction.oncomplete = () => resolve(result);
      transaction.onerror = () => reject(transaction.error);
      transaction.onabort = () => reject(transaction.error);

      result = callback(transaction);
    });
  } catch (err) {
    if (err?.name === "InvalidStateError" || err?.message?.includes("closing")) {
      dbPromise = null;
      const db = await openDb();
      return new Promise((resolve, reject) => {
        const transaction = db.transaction(storeNames, mode);
        let result;

        transaction.oncomplete = () => resolve(result);
        transaction.onerror = () => reject(transaction.error);
        transaction.onabort = () => reject(transaction.error);

        result = callback(transaction);
      });
    }
    throw err;
  }
}

async function putChunk(chunk) {
  await withStore(CHUNK_STORE, "readwrite", (transaction) => {
    transaction.objectStore(CHUNK_STORE).put(chunk);
  });
}

async function persistCurrentRecordingMeta() {
  if (!recordingId) {
    return;
  }

  const meta = {
    recordingId,
    filename: status.filename,
    mimeType: status.mimeType,
    state: status.state,
    durationMs: status.durationMs || getDurationMs(),
    bytes,
    chunks: chunkCount,
    startedAt,
    pausedDurationMs,
    updatedAt: Date.now(),
  };

  await withStore(RECORDING_STORE, "readwrite", (transaction) => {
    transaction.objectStore(RECORDING_STORE).put(meta);
  });
}

async function getRecordingMeta(targetRecordingId) {
  return withStore(RECORDING_STORE, "readonly", (transaction) => {
    const request = transaction.objectStore(RECORDING_STORE).get(targetRecordingId);
    request.onsuccess = () => {};
    return requestToPromise(request);
  });
}

async function getStoredRecordings() {
  return withStore(RECORDING_STORE, "readonly", (transaction) => {
    const request = transaction.objectStore(RECORDING_STORE).getAll();
    return requestToPromise(request);
  });
}

async function readRecordingChunks(targetRecordingId) {
  const chunks = await withStore(CHUNK_STORE, "readonly", (transaction) => {
    const store = transaction.objectStore(CHUNK_STORE);
    const index = store.index("recordingId");
    const request = index.getAll(targetRecordingId);
    return requestToPromise(request);
  });

  return chunks
    .sort((left, right) => left.seq - right.seq)
    .map((chunk) => chunk.blob);
}

async function clearRecordingData() {
  await withStore([CHUNK_STORE, RECORDING_STORE], "readwrite", (transaction) => {
    transaction.objectStore(CHUNK_STORE).clear();
    transaction.objectStore(RECORDING_STORE).clear();
  });
}

async function deleteRecordingData(targetRecordingId) {
  await withStore([CHUNK_STORE, RECORDING_STORE], "readwrite", (transaction) => {
    const chunkStore = transaction.objectStore(CHUNK_STORE);
    const index = chunkStore.index("recordingId");
    const request = index.openCursor(targetRecordingId);
    request.onsuccess = () => {
      const cursor = request.result;
      if (!cursor) {
        return;
      }

      cursor.delete();
      cursor.continue();
    };

    transaction.objectStore(RECORDING_STORE).delete(targetRecordingId);
  });
}

async function recoverStoredRecording() {
  if (recordingId || recorder) {
    return false;
  }

  const recordings = await getStoredRecordings();
  const recovered = recordings
    .filter((recording) => recording.chunks > 0)
    .sort((left, right) => right.updatedAt - left.updatedAt)[0];

  if (!recovered) {
    return false;
  }

  recordingId = recovered.recordingId;
  bytes = recovered.bytes || 0;
  chunkCount = recovered.chunks || 0;
  chunkSeq = recovered.chunks || 0;
  startedAt = 0;
  pausedAt = 0;
  pausedDurationMs = 0;
  setStatus({
    state: "saving",
    durationMs: recovered.durationMs || 0,
    bytes,
    chunks: chunkCount,
    mimeType: recovered.mimeType || "",
    filename: recovered.filename || "MeetInMin_recovered.webm",
    error: "",
  });
  await sendToWorker("RECOVERED_RECORDING", { recordingId, status }).catch(() => {});
  return true;
}

function getRecoveredRecordingId() {
  if (recordingId && !recorder && status.state === "saving") {
    return recordingId;
  }

  return "";
}

function requestToPromise(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function sendToWorker(type, payload) {
  return chrome.runtime.sendMessage({
    target: "worker",
    type,
    ...payload,
  });
}

function setStatus(nextStatus) {
  status = {
    ...status,
    ...nextStatus,
  };
  persistCurrentRecordingMeta().catch(() => {});
}

function getErrorMessage(error) {
  if (!error) {
    return t("errorUnknown");
  }

  if (typeof error === "string") {
    return error;
  }

  return error.message || t("errorUnknown");
}
