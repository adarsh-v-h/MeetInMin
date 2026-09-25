const FALLBACK_MESSAGES = {
  extensionName: "TabAudio Forge",
  extensionDescription: "Record audio from the active browser tab and save it locally.",
  subtitle: "Record current tab audio",
  labelStatus: "Status",
  labelDuration: "Duration",
  labelFormat: "Format",
  labelSize: "Size",
  controlsLabel: "Recording controls",
  buttonStart: "Start",
  buttonPause: "Pause",
  buttonResume: "Resume",
  buttonStop: "Stop",
  statusIdle: "Idle",
  statusPreparing: "Capturing tab...",
  statusRecording: "Recording $1",
  statusPaused: "Paused",
  statusSaving: "Saving...",
  statusCompleted: "Done",
  statusError: "Error",
  formatOpusWebm: "Opus (webm)",
  formatWebm: "WebM",
  errorCommandFailed: "Command failed.",
  errorUnknown: "Unknown error.",
  errorRecordingAlreadyRunning: "A recording is already running.",
  errorNoActiveTab: "No active tab found.",
  errorRestrictedPage: "This browser page cannot be captured.",
  errorDownloadInterrupted: "Download was interrupted.",
  errorRecordingStateLost: "Recording state was lost after the background worker restarted.",
  errorRecordingFailed: "Recording failed.",
  errorRecordingNoFile: "Recording finished without a downloadable file.",
  errorUnsupportedMime: "MediaRecorder does not support audio/webm recording in this browser.",
  errorOffscreenUnexpected: "Unexpected offscreen error.",
  errorMediaRecorderFailed: "MediaRecorder failed.",
  errorUnknownMessageType: "Unknown message type: $1",
  errorUnknownOffscreenMessageType: "Unknown offscreen message type: $1",
  permissionTitle: "Microphone Permission Required",
  permissionText: "To record your microphone, TabAudio Forge needs your permission. Please click the button below and select 'Allow' in the browser prompt.",
  permissionButton: "Grant Microphone Permission",
  permissionGranted: "Permission granted! You can now close this tab and start recording from the extension popup.",
  permissionDenied: "Permission denied. Please check your browser settings.",
  labelIncludeMic: "Include Microphone",
  errorMicPermission: "Microphone access denied. Please grant permission in the new tab."
};

function t(key, substitutions) {
  return chrome.i18n.getMessage(key, substitutions) || formatFallbackMessage(key, substitutions);
}

function formatFallbackMessage(key, substitutions) {
  const template = FALLBACK_MESSAGES[key] || key;
  const values = Array.isArray(substitutions) ? substitutions : [substitutions];
  return values.reduce((message, value, index) => {
    if (value === undefined) {
      return message;
    }

    return message.replaceAll(`$${index + 1}`, value);
  }, template);
}
