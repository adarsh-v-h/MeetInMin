const elements = {
  statusText: document.querySelector("#statusText"),
  durationText: document.querySelector("#durationText"),
  formatText: document.querySelector("#formatText"),
  sizeText: document.querySelector("#sizeText"),
  messageText: document.querySelector("#messageText"),
  startButton: document.querySelector("#startButton"),
  pauseButton: document.querySelector("#pauseButton"),
  resumeButton: document.querySelector("#resumeButton"),
  stopButton: document.querySelector("#stopButton"),
};

let currentStatus = {
  state: "idle",
  durationMs: 0,
  bytes: 0,
  mimeType: "audio/webm;codecs=opus",
  error: "",
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  localizeDocument();
  elements.startButton.addEventListener("click", handleStart);
  elements.pauseButton.addEventListener("click", () => sendCommand("PAUSE_RECORDING"));
  elements.resumeButton.addEventListener("click", () => sendCommand("RESUME_RECORDING"));
  elements.stopButton.addEventListener("click", () => sendCommand("STOP_RECORDING"));

  chrome.runtime.onMessage.addListener((message) => {
    if (!message || message.target !== "popup") {
      return;
    }

    if (message.status) {
      renderStatus(message.status);
    }
  });

  sendCommand("GET_STATUS", {}, { silent: true }).catch(() => {});
}

async function handleStart() {
  const includeMic = document.querySelector("#micCheckbox").checked;
  
  if (includeMic) {
    try {
      const micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micStream.getTracks().forEach((t) => t.stop());
    } catch (e) {
      chrome.tabs.create({ url: chrome.runtime.getURL("src/pages/permission/permission.html") });
      renderStatus({
        ...currentStatus,
        state: "error",
        error: t("errorMicPermission"),
      });
      return;
    }
  }
  
  sendCommand("START_RECORDING", { recordMic: includeMic });
}

async function sendCommand(type, payload = {}, options = {}) {
  setControlsDisabled(true);

  if (!options.silent) {
    elements.messageText.textContent = "";
  }

  try {
    const response = await chrome.runtime.sendMessage({ target: "worker", type, ...payload });
    if (!response?.ok) {
      throw new Error(response?.error || t("errorCommandFailed"));
    }

    renderStatus(response.status || currentStatus);
  } catch (error) {
    renderStatus({
      ...currentStatus,
      state: "error",
      error: error.message || t("errorCommandFailed"),
    });
  }
}

function renderStatus(status) {
  currentStatus = {
    ...currentStatus,
    ...status,
  };

  document.body.dataset.state = currentStatus.state;
  elements.statusText.textContent = getStatusText(currentStatus);
  elements.durationText.textContent = formatDuration(currentStatus.durationMs || 0);
  elements.formatText.textContent = formatMime(currentStatus.mimeType);
  elements.sizeText.textContent = formatBytes(currentStatus.bytes || 0);
  elements.messageText.textContent = currentStatus.error || "";

  setButtonStates(currentStatus.state);
}

function setControlsDisabled(disabled) {
  Object.values(getControlVisibility(currentStatus.state)).forEach(({ element }) => {
    element.disabled = disabled;
  });
}

function setButtonStates(state) {
  const controls = getControlVisibility(state);
  Object.values(controls).forEach(({ element, visible, disabled }) => {
    element.hidden = !visible;
    element.disabled = disabled;
  });

  const micOptionContainer = document.querySelector("#micOptionContainer");
  if (micOptionContainer) {
    micOptionContainer.hidden = !["idle", "completed", "error"].includes(state);
  }
}

function getControlVisibility(state) {
  return {
    start: {
      element: elements.startButton,
      visible: ["idle", "completed", "error"].includes(state),
      disabled: !["idle", "completed", "error"].includes(state),
    },
    pause: {
      element: elements.pauseButton,
      visible: state === "recording",
      disabled: state !== "recording",
    },
    resume: {
      element: elements.resumeButton,
      visible: state === "paused",
      disabled: state !== "paused",
    },
    stop: {
      element: elements.stopButton,
      visible: ["recording", "paused", "preparing"].includes(state),
      disabled: !["recording", "paused"].includes(state),
    },
  };
}

function getStatusText(status) {
  switch (status.state) {
    case "preparing":
      return t("statusPreparing");
    case "recording":
      return t("statusRecording", [formatDuration(status.durationMs || 0)]);
    case "paused":
      return t("statusPaused");
    case "saving":
      return t("statusSaving");
    case "completed":
      return t("statusCompleted");
    case "error":
      return t("statusError");
    case "idle":
    default:
      return t("statusIdle");
  }
}

function formatMime(mimeType) {
  if (!mimeType) {
    return t("formatOpusWebm");
  }

  if (mimeType.includes("opus")) {
    return t("formatOpusWebm");
  }

  return t("formatWebm");
}

function formatDuration(durationMs) {
  const totalSeconds = Math.floor(durationMs / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map((value) => String(value).padStart(2, "0")).join(":");
}

function formatBytes(bytes) {
  if (!bytes) {
    return "0 B";
  }

  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unitIndex = 0;

  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }

  const fractionDigits = value >= 10 || unitIndex === 0 ? 0 : 1;
  return `${value.toFixed(fractionDigits)} ${units[unitIndex]}`;
}

function localizeDocument() {
  document.documentElement.lang = chrome.i18n.getUILanguage?.() || navigator.language || "en";
  document.title = t("extensionName");

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });

  document.querySelectorAll("[data-i18n-aria-label]").forEach((node) => {
    node.setAttribute("aria-label", t(node.dataset.i18nAriaLabel));
  });
}
