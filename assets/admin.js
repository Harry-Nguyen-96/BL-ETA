(function () {
  "use strict";

  const loginView = document.getElementById("login-view");
  const dashboardView = document.getElementById("dashboard-view");
  const adminUser = document.getElementById("admin-user");
  const loginForm = document.getElementById("login-form");
  const shipmentForm = document.getElementById("shipment-form");
  const loginStatus = document.getElementById("login-status");
  const editorStatus = document.getElementById("editor-status");
  const recordsBody = document.getElementById("records-body");
  const recordsEmpty = document.getElementById("records-empty");
  const deleteButton = document.getElementById("delete-button");
  const blInput = document.getElementById("shipment-bl");
  let db;
  let unsubscribe = null;
  let editingBl = null;

  function isConfigured() {
    return window.FIREBASE_CONFIG &&
      !Object.values(window.FIREBASE_CONFIG).some((value) => String(value).includes("YOUR_"));
  }

  function showStatus(element, message, type) {
    element.textContent = message;
    element.className = `status-message ${type || ""}`.trim();
    element.hidden = false;
  }

  function clearStatus(element) {
    element.hidden = true;
  }

  function normalizeBl(value) {
    return value.trim().replace(/\s+/g, "").toUpperCase();
  }

  function formatEta(value) {
    if (!value) return "—";
    const parsed = new Date(`${value}T00:00:00`);
    if (Number.isNaN(parsed.getTime())) return value;
    return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "short", year: "numeric" }).format(parsed);
  }

  function resetEditor() {
    editingBl = null;
    shipmentForm.reset();
    blInput.disabled = false;
    document.getElementById("editor-title").textContent = "Add shipment";
    document.getElementById("save-button").textContent = "Save shipment";
    deleteButton.hidden = true;
    clearStatus(editorStatus);
  }

  function editRecord(record) {
    editingBl = record.blNumber;
    blInput.value = record.blNumber;
    blInput.disabled = true;
    document.getElementById("vessel-name").value = record.vesselName || "";
    document.getElementById("voyage-number").value = record.voyageNumber || "";
    document.getElementById("eta-date").value = record.eta || "";
    document.getElementById("editor-title").textContent = "Edit shipment";
    document.getElementById("save-button").textContent = "Update shipment";
    deleteButton.hidden = false;
    clearStatus(editorStatus);
    document.querySelector(".editor-panel").scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderRecords(snapshot) {
    recordsBody.replaceChildren();
    const records = snapshot.docs.map((item) => item.data());
    document.getElementById("record-count").textContent = String(records.length);
    recordsEmpty.hidden = records.length > 0;

    records.forEach((record) => {
      const row = document.createElement("tr");
      const bl = document.createElement("td");
      const vessel = document.createElement("td");
      const eta = document.createElement("td");
      const action = document.createElement("td");
      const editButton = document.createElement("button");

      bl.textContent = record.blNumber || "—";
      bl.className = "record-bl";
      vessel.textContent = `${record.vesselName || "—"} / ${record.voyageNumber || "—"}`;
      eta.textContent = formatEta(record.eta);
      editButton.type = "button";
      editButton.className = "table-action";
      editButton.textContent = "Edit";
      editButton.setAttribute("aria-label", `Edit ${record.blNumber || "shipment"}`);
      editButton.addEventListener("click", () => editRecord(record));
      action.appendChild(editButton);
      row.append(bl, vessel, eta, action);
      recordsBody.appendChild(row);
    });
  }

  function startRecordListener() {
    if (unsubscribe) unsubscribe();
    unsubscribe = db.collection("shipments").orderBy("updatedAt", "desc").onSnapshot(
      renderRecords,
      (error) => {
        console.error("Could not load records", error);
        recordsEmpty.hidden = false;
        recordsEmpty.textContent = "Could not load shipment records.";
      }
    );
  }

  async function handleLogin(event) {
    event.preventDefault();
    clearStatus(loginStatus);
    const email = document.getElementById("email").value.trim();
    const password = document.getElementById("password").value;
    if (!email || !password) {
      showStatus(loginStatus, "Enter your email address and password.", "error");
      return;
    }
    const button = loginForm.querySelector("button[type='submit']");
    button.disabled = true;
    button.textContent = "Signing in…";
    try {
      const credential = await firebase.auth().signInWithEmailAndPassword(email, password);
      const token = await credential.user.getIdTokenResult(true);
      if (token.claims.admin !== true) {
        await firebase.auth().signOut();
        throw new Error("not-admin");
      }
    } catch (error) {
      console.error("Sign in failed", error);
      const message = error.message === "not-admin"
        ? "This account is not authorized as an administrator."
        : "Sign in failed. Check your email and password, then try again.";
      showStatus(loginStatus, message, "error");
    } finally {
      button.disabled = false;
      button.textContent = "Sign in";
    }
  }

  async function saveShipment(event) {
    event.preventDefault();
    clearStatus(editorStatus);
    const blNumber = normalizeBl(editingBl || blInput.value);
    const vesselName = document.getElementById("vessel-name").value.trim();
    const voyageNumber = document.getElementById("voyage-number").value.trim();
    const eta = document.getElementById("eta-date").value;
    if (!blNumber || !vesselName || !voyageNumber || !eta) {
      showStatus(editorStatus, "Complete all shipment fields.", "error");
      return;
    }
    if (!/^[A-Z0-9-]+$/.test(blNumber)) {
      showStatus(editorStatus, "Use only letters, numbers, and hyphens in the BL number.", "error");
      return;
    }

    const button = document.getElementById("save-button");
    button.disabled = true;
    try {
      await db.collection("shipments").doc(blNumber).set({
        blNumber,
        vesselName,
        voyageNumber,
        eta,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp(),
        updatedBy: firebase.auth().currentUser.uid
      }, { merge: true });
      const wasEditing = Boolean(editingBl);
      resetEditor();
      showStatus(editorStatus, wasEditing ? "Shipment updated successfully." : "Shipment added successfully.", "success");
    } catch (error) {
      console.error("Save failed", error);
      showStatus(editorStatus, "Could not save this shipment. Please try again.", "error");
    } finally {
      button.disabled = false;
    }
  }

  async function deleteShipment() {
    if (!editingBl || !window.confirm(`Delete shipment ${editingBl}? This cannot be undone.`)) return;
    deleteButton.disabled = true;
    try {
      await db.collection("shipments").doc(editingBl).delete();
      resetEditor();
      showStatus(editorStatus, "Shipment deleted successfully.", "success");
    } catch (error) {
      console.error("Delete failed", error);
      showStatus(editorStatus, "Could not delete this shipment. Please try again.", "error");
    } finally {
      deleteButton.disabled = false;
    }
  }

  if (!isConfigured()) {
    showStatus(loginStatus, "Firebase is not configured yet. Follow the setup guide in README.md.", "error");
    loginForm.querySelector("button[type='submit']").disabled = true;
    return;
  }

  if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
  db = firebase.firestore();

  firebase.auth().onAuthStateChanged(async (user) => {
    if (!user) {
      loginView.hidden = false;
      dashboardView.hidden = true;
      adminUser.hidden = true;
      if (unsubscribe) unsubscribe();
      unsubscribe = null;
      return;
    }

    const token = await user.getIdTokenResult();
    if (token.claims.admin !== true) {
      await firebase.auth().signOut();
      showStatus(loginStatus, "This account is not authorized as an administrator.", "error");
      return;
    }

    loginView.hidden = true;
    dashboardView.hidden = false;
    adminUser.hidden = false;
    document.getElementById("user-email").textContent = user.email || "Administrator";
    startRecordListener();
  });

  loginForm.addEventListener("submit", handleLogin);
  shipmentForm.addEventListener("submit", saveShipment);
  deleteButton.addEventListener("click", deleteShipment);
  document.getElementById("new-record-button").addEventListener("click", resetEditor);
  document.getElementById("logout-button").addEventListener("click", () => firebase.auth().signOut());
}());
