importScripts("../utils/i18n.js");

const OFFSCREEN_DOCUMENT = "src/offscreen/offscreen.html";
const SESSION_STATE_KEY = "recordingState";
const CLEANUP_ALARM_NAME = "cleanup-after-download";
const CLEANUP_DELAY_MS = 5 * 60 * 1000;
const BUSY_STATES = new Set(["preparing", "recording", "paused", "saving"]);
const FINAL_STATES = new Set(["idle", "completed", "error"]);

const DEFAULT_STATUS = {
  state: "idle",
  durationMs: 0,
  bytes: 0,
  chunks: 0,
  mimeType: "",
  filename: "",
  error: "",
};

let status = { ...DEFAULT_STATUS };
let sourceTabId = null;
let activeDownloadId = null;
let pendingObjectUrl = "";
let sessionStateLoaded = false;
let sessionStateLoadPromise = null;

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || message.target !== "worker") {
    return false;
  }

  handleWorkerMessage(message, sender)
    .then((response) => sendResponse({ ok: true, ...response }))
    .catch(async (error) => {
      const messageText = getErrorMessage(error);
      await setStatus({ state: "error", error: messageText });
      sendResponse({ ok: false, error: messageText, status });
    });

  return true;
});

chrome.tabs.onRemoved.addListener((tabId) => {
  (async () => {
    await loadSessionState();
    if (tabId !== sourceTabId || !BUSY_STATES.has(status.state)) {
      return;
    }

    await sendToOffscreen("OFFSCREEN_STOP", { reason: "source-tab-closed" }).catch(async (error) => {
      await setStatus({ state: "error", error: getErrorMessage(error) });
    });
  })().catch(() => {});
});

chrome.downloads.onChanged.addListener((delta) => {
  (async () => {
    await loadSessionState();
    if (!activeDownloadId || delta.id !== activeDownloadId || !delta.state) {
      return;
    }

    if (delta.state.current === "complete") {
      await cleanupAfterDownload();
      await setStatus({ state: "completed" });
      broadcast({ type: "STATUS_UPDATE", status });
    }

    if (delta.state.current === "interrupted") {
      await cleanupAfterDownload();
      await setStatus({ state: "error", error: t("errorDownloadInterrupted") });
      broadcast({ type: "RECORDING_ERROR", status, error: status.error });
    }
  })().catch(() => {});
});

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name !== CLEANUP_ALARM_NAME) {
    return;
  }

  cleanupAfterDownload().catch(() => {});
});

chrome.runtime.onStartup.addListener(() => {
  recoverSessionState().catch(() => {});
});

chrome.runtime.onInstalled.addListener(() => {
  recoverSessionState().catch(() => {});
});

recoverSessionState().catch(() => {});

async function handleWorkerMessage(message) {
  await loadSessionState();

  switch (message.type) {
    case "GET_STATUS":
      return { status: await getCurrentStatus() };
    case "START_RECORDING":
      return { status: await startRecording(message) };
    case "PAUSE_RECORDING":
      return { status: await forwardControl("OFFSCREEN_PAUSE") };
    case "RESUME_RECORDING":
      return { status: await forwardControl("OFFSCREEN_RESUME") };
    case "STOP_RECORDING":
      return { status: await forwardControl("OFFSCREEN_STOP") };
    case "STATUS_UPDATE":
    case "RECORDING_PROGRESS":
      await setStatus(message.status || {});
      broadcast({ type: message.type, status });
      return { status };
    case "RECORDING_COMPLETE":
      return { status: await handleRecordingComplete(message) };
    case "RECOVERED_RECORDING":
      return { status: await handleRecoveredRecording(message) };
    case "RECORDING_ERROR":
      await setStatus({ state: "error", error: message.error || t("errorRecordingFailed") });
      broadcast({ type: "RECORDING_ERROR", status, error: status.error });
      return { status };
    default:
      throw new Error(t("errorUnknownMessageType", [message.type]));
  }
}

async function startRecording(message) {
  if (BUSY_STATES.has(status.state)) {
    throw new Error(t("errorRecordingAlreadyRunning"));
  }

  await clearCleanupAlarm();

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || typeof tab.id !== "number") {
    throw new Error(t("errorNoActiveTab"));
  }

  if (isRestrictedUrl(tab.url)) {
    throw new Error(t("errorRestrictedPage"));
  }

  await setStatus({
    state: "preparing",
    durationMs: 0,
    bytes: 0,
    chunks: 0,
    mimeType: "",
    filename: "",
    error: "",
  });
  broadcast({ type: "STATUS_UPDATE", status });

  await setSessionFields({ sourceTabId: tab.id });
  try {
    await ensureOffscreenDocument();

    const streamId = await chrome.tabCapture.getMediaStreamId({ targetTabId: tab.id });
    const filename = buildFileName(tab.title || "untitled-tab");

    const response = await sendToOffscreen("OFFSCREEN_START", {
      streamId,
      filename,
      tabId: tab.id,
      recordMic: message?.recordMic === true,
    });

    await setStatus(response.status || { state: "recording", filename });
    broadcast({ type: "STATUS_UPDATE", status });
    return status;
  } catch (error) {
    await cleanupAfterDownload();
    await setSessionFields({ sourceTabId: null });
    throw error;
  }
}

async function forwardControl(type) {
  if (FINAL_STATES.has(status.state)) {
    return getCurrentStatus();
  }

  const response = await sendToOffscreen(type, {});
  await setStatus(response.status || {});
  broadcast({ type: "STATUS_UPDATE", status });
  return status;
}

async function handleRecordingComplete(message) {
  if (!message.url) {
    throw new Error(t("errorRecordingNoFile"));
  }

  await setSessionFields({ pendingObjectUrl: message.url });
  await setStatus({
    ...(message.status || {}),
    state: "saving",
    filename: message.filename || status.filename,
    durationMs: message.durationMs ?? status.durationMs,
    bytes: message.bytes ?? status.bytes,
  });
  broadcast({ type: "STATUS_UPDATE", status });

  try {
    const downloadId = await chrome.downloads.download({
      url: message.url,
      filename: status.filename,
      saveAs: false,
    });
    await setSessionFields({ activeDownloadId: downloadId });
  } catch (error) {
    await cleanupAfterDownload();
    throw error;
  }

  // Keep the offscreen document alive long enough for the download subsystem to read the blob URL.
  await chrome.alarms.create(CLEANUP_ALARM_NAME, { when: Date.now() + CLEANUP_DELAY_MS });

  return status;
}

async function handleRecoveredRecording(message) {
  if (!message.recordingId) {
    return getCurrentStatus();
  }

  await setStatus({
    ...(message.status || {}),
    state: "saving",
    error: "",
  });
  broadcast({ type: "STATUS_UPDATE", status });

  const response = await sendToOffscreen("OFFSCREEN_FINALIZE_RECOVERED", {
    recordingId: message.recordingId,
  });
  return handleRecordingComplete(response);
}

async function getCurrentStatus() {
  if (await hasOffscreenDocument()) {
    try {
      const response = await sendToOffscreen("OFFSCREEN_GET_STATUS", {});
      if (response.recoveredRecordingId) {
        return handleRecoveredRecording({
          recordingId: response.recoveredRecordingId,
          status: response.status,
        });
      }
      await setStatus(response.status || {});
    } catch {
      // The popup can still render the worker's last known state.
    }
  }

  return status;
}

async function ensureOffscreenDocument() {
  if (await hasOffscreenDocument()) {
    return;
  }

  await chrome.offscreen.createDocument({
    url: OFFSCREEN_DOCUMENT,
    reasons: ["USER_MEDIA"],
    justification: "Record audio from the active browser tab.",
  });
}

async function hasOffscreenDocument() {
  if (chrome.runtime.getContexts) {
    const contexts = await chrome.runtime.getContexts({
      contextTypes: ["OFFSCREEN_DOCUMENT"],
      documentUrls: [chrome.runtime.getURL(OFFSCREEN_DOCUMENT)],
    });
    return contexts.length > 0;
  }

  if (chrome.offscreen.hasDocument) {
    return chrome.offscreen.hasDocument();
  }

  return false;
}

async function cleanupAfterDownload() {
  await loadSessionState();
  await clearCleanupAlarm();

  await setSessionFields({ activeDownloadId: null });

  if (pendingObjectUrl) {
    await sendToOffscreen("OFFSCREEN_REVOKE_URL", { url: pendingObjectUrl }).catch(() => {});
    await setSessionFields({ pendingObjectUrl: "" });
  }

  if (await hasOffscreenDocument()) {
    await chrome.offscreen.closeDocument().catch(() => {});
  }

  await setSessionFields({ sourceTabId: null });
}

async function clearCleanupAlarm() {
  await chrome.alarms.clear(CLEANUP_ALARM_NAME).catch(() => {});
}

async function sendToOffscreen(type, payload) {
  return chrome.runtime.sendMessage({
    target: "offscreen",
    type,
    ...payload,
  });
}

function broadcast(message) {
  chrome.runtime.sendMessage({
    target: "popup",
    ...message,
  }).catch(() => {});
}

async function loadSessionState() {
  if (sessionStateLoaded) {
    return;
  }

  if (!sessionStateLoadPromise) {
    sessionStateLoadPromise = (async () => {
      const stored = await chrome.storage.session.get(SESSION_STATE_KEY);
      const nextState = stored[SESSION_STATE_KEY];
      if (nextState && typeof nextState === "object") {
        status = { ...DEFAULT_STATUS, ...(nextState.status || {}) };
        sourceTabId = typeof nextState.sourceTabId === "number" ? nextState.sourceTabId : null;
        activeDownloadId = typeof nextState.activeDownloadId === "number" ? nextState.activeDownloadId : null;
        pendingObjectUrl = typeof nextState.pendingObjectUrl === "string" ? nextState.pendingObjectUrl : "";
      }
      sessionStateLoaded = true;
    })();
  }

  await sessionStateLoadPromise;
}

async function persistSessionState() {
  await chrome.storage.session.set({
    [SESSION_STATE_KEY]: {
      status,
      sourceTabId,
      activeDownloadId,
      pendingObjectUrl,
    },
  });
}

async function setStatus(nextStatus) {
  status = {
    ...status,
    ...nextStatus,
  };
  await persistSessionState();
}

async function setSessionFields(fields) {
  if (Object.hasOwn(fields, "sourceTabId")) {
    sourceTabId = fields.sourceTabId;
  }

  if (Object.hasOwn(fields, "activeDownloadId")) {
    activeDownloadId = fields.activeDownloadId;
  }

  if (Object.hasOwn(fields, "pendingObjectUrl")) {
    pendingObjectUrl = fields.pendingObjectUrl;
  }

  await persistSessionState();
}

async function recoverSessionState() {
  await loadSessionState();
  if (!BUSY_STATES.has(status.state)) {
    return;
  }

  if (await hasOffscreenDocument()) {
    await getCurrentStatus();
    return;
  }

  await setStatus({ state: "error", error: t("errorRecordingStateLost") });
  await setSessionFields({
    sourceTabId: null,
    activeDownloadId: null,
    pendingObjectUrl: "",
  });
}

function buildFileName(tabTitle) {
  const title = sanitizeFileName(tabTitle) || "untitled-tab";
  const cappedTitle = title.slice(0, 80).replace(/[-_. ]+$/g, "") || "untitled-tab";
  return `tabaudioforge_${cappedTitle}_${formatTimestamp(new Date())}.webm`;
}

function sanitizeFileName(value) {
  return String(value)
    .normalize("NFKD")
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, " ")
    .replace(/\s+/g, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
}

function formatTimestamp(date) {
  const pad = (value) => String(value).padStart(2, "0");
  return [
    date.getFullYear(),
    pad(date.getMonth() + 1),
    pad(date.getDate()),
  ].join("-") + `_${pad(date.getHours())}-${pad(date.getMinutes())}-${pad(date.getSeconds())}`;
}

function isRestrictedUrl(url) {
  return /^(chrome|chrome-extension|chrome-untrusted|edge|about|devtools|view-source|file):/i.test(url || "");
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
