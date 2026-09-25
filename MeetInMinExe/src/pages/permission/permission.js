document.addEventListener("DOMContentLoaded", () => {
  document.documentElement.lang = chrome.i18n.getUILanguage?.() || navigator.language || "en";
  document.title = t("permissionTitle");

  document.querySelectorAll("[data-i18n]").forEach((node) => {
    node.textContent = t(node.dataset.i18n);
  });

  document.getElementById("requestBtn").addEventListener("click", async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      stream.getTracks().forEach((t) => t.stop());
      document.getElementById("msgText").textContent = t("permissionGranted");
      document.getElementById("msgText").style.color = "green";
      document.getElementById("requestBtn").disabled = true;
    } catch (e) {
      document.getElementById("msgText").textContent = t("permissionDenied");
      document.getElementById("msgText").style.color = "red";
    }
  });
});
