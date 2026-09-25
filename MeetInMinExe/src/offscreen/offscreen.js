const TIMESLICE_MS = 2000;
const MIME_CANDIDATES = ["audio/webm;codecs=opus", "audio/webm"];
const DB_NAME = "tabaudioforge";
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

let status = {
  state: "idle",
  durationMs: 0,
  bytes: 0,
  chunks: 0,
  mimeType: "",
  filename: "",
  error: "",
};

recoverStoredRecording().catch(() => {});

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
      return { status, recoveredRecordingId: getRecoveredRecordingId() };
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
    default:
      throw new Error(t("errorUnknownOffscreenMessageType", [message.type]));
  }
}

async function startRecording({ streamId, filename, recordMic }) {
  if (status.state === "recording" || status.state === "paused") {
    throw new Error(t("errorRecordingAlreadyRunning"));
  }

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
    const result = await createRecordingResult(recordingId);
    await sendToWorker("RECORDING_COMPLETE", result);
    await deleteRecordingData(recordingId);
    recordingId = "";
  } catch (error) {
    setStatus({ state: "error", error: getErrorMessage(error) });
    sendToWorker("RECORDING_ERROR", { error: status.error, status }).catch(() => {});
  }
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
    filename: meta.filename || "tabaudioforge_recovered.webm",
    error: "",
  });

  const result = await createRecordingResult(targetRecordingId);
  await deleteRecordingData(targetRecordingId);
  recordingId = "";
  return result;
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
  if (!dbPromise) {
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

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  return dbPromise;
}

async function withStore(storeNames, mode, callback) {
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
    filename: recovered.filename || "tabaudioforge_recovered.webm",
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
