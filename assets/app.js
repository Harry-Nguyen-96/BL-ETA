(function () {
  "use strict";

  const form = document.getElementById("tracking-form");
  const input = document.getElementById("bl-number");
  const status = document.getElementById("status");
  const result = document.getElementById("result");
  const submitButton = form.querySelector("button[type='submit']");

  function showStatus(message, type) {
    status.textContent = message;
    status.className = `status-message ${type || ""}`.trim();
    status.hidden = false;
  }

  function clearOutput() {
    status.hidden = true;
    result.hidden = true;
  }

  function normalizeBl(value) {
    return value.trim().replace(/\s+/g, "").toUpperCase();
  }

  function formatEta(value) {
    if (!value) return "Not available";
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric"
    }).format(parsed);
  }

  function isConfigured() {
    return window.FIREBASE_CONFIG &&
      !Object.values(window.FIREBASE_CONFIG).some((value) => String(value).includes("YOUR_"));
  }

  async function trackShipment(event) {
    event.preventDefault();
    clearOutput();

    const blNumber = normalizeBl(input.value);
    input.value = blNumber;
    if (!blNumber) {
      showStatus("Please enter a Bill of Lading number.", "error");
      input.focus();
      return;
    }
    if (!/^[A-Z0-9-]+$/.test(blNumber)) {
      showStatus("Use only letters, numbers, and hyphens in the BL number.", "error");
      input.focus();
      return;
    }

    if (!isConfigured()) {
      showStatus("Tracking is being configured. Please try again later.", "error");
      return;
    }

    submitButton.disabled = true;
    submitButton.classList.add("loading");
    submitButton.querySelector("span").textContent = "Searching…";

    try {
      if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
      const snapshot = await firebase.firestore().collection("shipments").doc(blNumber).get();
      if (!snapshot.exists) {
        showStatus("No shipment was found for this BL number. Please check the number and try again.", "error");
        return;
      }

      const shipment = snapshot.data();
      document.getElementById("result-vessel").textContent = shipment.vesselName || "Not available";
      document.getElementById("result-voyage").textContent = shipment.voyageNumber || "Not available";
      document.getElementById("result-eta").textContent = formatEta(shipment.eta);
      document.getElementById("result-bl").textContent = shipment.blNumber || blNumber;
      result.hidden = false;
      result.scrollIntoView({ behavior: "smooth", block: "nearest" });
    } catch (error) {
      console.error("Tracking failed", error);
      showStatus("We could not retrieve this shipment right now. Please try again shortly.", "error");
    } finally {
      submitButton.disabled = false;
      submitButton.classList.remove("loading");
      submitButton.querySelector("span").textContent = "Track shipment";
    }
  }

  form.addEventListener("submit", trackShipment);
  input.addEventListener("input", clearOutput);
}());
