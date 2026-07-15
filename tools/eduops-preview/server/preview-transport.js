(function () {
  "use strict";

  var state = {
    dataMode: localStorage.getItem("eduopsPreviewDataMode") || "deterministic",
    scenario: localStorage.getItem("eduopsPreviewScenario") || "normal-authoritative",
    snapshotId: localStorage.getItem("eduopsPreviewSnapshotId") || "",
    latencyMs: Number(localStorage.getItem("eduopsPreviewLatencyMs") || -1),
    simulatedError: "",
    requestSeq: 0,
    log: [],
    snapshots: []
  };

  window.EDUOPS_REQUEST_TIMEOUT_MS = Number(window.EDUOPS_REQUEST_TIMEOUT_MS || 10000);

  function postJson(url, body) {
    return fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body || {})
    }).then(function (res) {
      return res.json().then(function (json) {
        if (!res.ok) throw new Error(json && (json.message || json.error || json.code) || ("HTTP " + res.status));
        return json;
      });
    });
  }

  function call(name, payload) {
    var requestId = ++state.requestSeq;
    var started = performance.now();
    if (state.simulatedError === "network") {
      return Promise.reject(new Error("Preview simulated network failure"));
    }
    return postJson("/api/rpc/" + encodeURIComponent(name), {
      mode: state.dataMode === "snapshot" ? "snapshot" : "deterministic",
      scenario: state.scenario,
      snapshotId: state.snapshotId,
      latencyMs: state.latencyMs,
      payload: payload || {}
    }).then(function (res) {
      var ended = performance.now();
      var item = {
        requestId: requestId,
        requestName: name,
        scenario: state.scenario,
        dataMode: state.dataMode,
        snapshotId: state.snapshotId,
        requestedActionability: payload && payload.actionabilityState || "",
        worklist: payload && payload.worklistKey || "",
        scope: payload && payload.workScope || "",
        page: payload && payload.page || "",
        startTime: new Date(Date.now() - (ended - started)).toISOString(),
        simulatedServerDurationMs: res && res.timings && res.timings.serverRpcMs || Math.round(ended - started),
        clientTransportMs: Math.round(ended - started),
        responseSize: JSON.stringify(res || {}).length,
        status: res && res.ok === false ? "REJECTED" : "OK"
      };
      state.log.push(item);
      if (state.log.length > 200) state.log.shift();
      renderDiagnostics();
      if (res && res.ok === false) throw new Error(res.message || res.error || res.code || "Preview RPC failed");
      return res;
    }).catch(function (err) {
      state.log.push({
        requestId: requestId,
        requestName: name,
        scenario: state.scenario,
        dataMode: state.dataMode,
        snapshotId: state.snapshotId,
        startTime: new Date().toISOString(),
        simulatedServerDurationMs: 0,
        clientTransportMs: Math.round(performance.now() - started),
        responseSize: 0,
        status: "ERROR",
        error: String(err && err.message || err)
      });
      renderDiagnostics();
      throw err;
    });
  }

  window.EDUOPS_TRANSPORT = { call: call };

  function installPanel() {
    var app = document.getElementById("eduopsApp");
    if (!app || document.getElementById("eduopsPreviewLab")) return;
    var panel = document.createElement("section");
    panel.id = "eduopsPreviewLab";
    panel.className = "eduops-preview-lab";
    panel.innerHTML = ''
      + '<div class="eduops-preview-title"><strong>PREVIEW LAB - SIMULATED DATA - NO LIVE OPERATIONS</strong><span>NO LIVE DATA / NO LIVE MUTATIONS / SIMULATED EDUOPS CONTRACTS</span></div>'
      + '<div id="eduopsPreviewModeBanner" class="eduops-preview-mode-banner"></div>'
      + '<div class="eduops-preview-controls">'
        + '<label>Data mode <select id="eduopsPreviewDataMode"><option value="deterministic">Deterministic Scenario Mode</option><option value="snapshot">Fresh FODE Snapshot Mode</option></select></label>'
        + '<label id="eduopsPreviewSnapshotLabel">Fresh snapshot <select id="eduopsPreviewSnapshot"><option value="">No local snapshot selected</option></select></label>'
        + '<label>Scenario <select id="eduopsPreviewScenario"></select></label>'
        + '<label>Simulated latency <select id="eduopsPreviewLatency"><option value="-1">Scenario default</option><option value="0">0-1 second</option><option value="3000">3 seconds</option><option value="6000">6 seconds</option><option value="11200">10+ second timeout</option></select></label>'
        + '<label>Simulated error <select id="eduopsPreviewError"><option value="">None</option><option value="network">Transport failure</option></select></label>'
        + '<button type="button" id="eduopsPreviewReset">Reset scenario</button>'
        + '<button type="button" id="eduopsPreviewReload">Reload application state</button>'
        + '<button type="button" data-preview-viewport="1920x1080">1920x1080</button>'
        + '<button type="button" data-preview-viewport="1440x900">1440x900</button>'
        + '<button type="button" data-preview-viewport="1366x768">1366x768</button>'
        + '<details><summary>Scenario notes</summary><div id="eduopsPreviewScenarioNotes"></div></details>'
        + '<details><summary>Developer diagnostics</summary><pre id="eduopsPreviewDiagnostics">No preview requests yet.</pre><button type="button" id="eduopsPreviewExportLog">Export session log</button></details>'
        + '<details><summary>Owner review notes</summary><label>Finding note<textarea id="eduopsPreviewNote" rows="3" placeholder="Record local owner finding"></textarea></label><button type="button" id="eduopsPreviewSaveNote">Save local note</button><span id="eduopsPreviewNoteStatus"></span></details>'
      + '</div>';
    document.body.insertBefore(panel, app);
    var mode = document.getElementById("eduopsPreviewDataMode");
    mode.value = state.dataMode;
    mode.addEventListener("change", function () {
      state.dataMode = mode.value;
      localStorage.setItem("eduopsPreviewDataMode", state.dataMode);
      refreshModeBanner();
      reloadEduOps();
    });
    var snapshotSelect = document.getElementById("eduopsPreviewSnapshot");
    snapshotSelect.addEventListener("change", function () {
      state.snapshotId = snapshotSelect.value;
      localStorage.setItem("eduopsPreviewSnapshotId", state.snapshotId);
      refreshModeBanner();
      if (state.dataMode === "snapshot") reloadEduOps();
    });
    fetch("/api/snapshots").then(function (res) { return res.json(); }).then(function (items) {
      state.snapshots = items || [];
      snapshotSelect.innerHTML = '<option value="">No local snapshot selected</option>' + state.snapshots.map(function (item) {
        return '<option value="' + escapeHtml(item.id) + '">' + escapeHtml((item.captureDate || item.id) + " / " + (item.runtimeIdentity || "runtime unknown") + " / " + (item.contractVersion || "contract unknown") + " / " + (item.reliability || "reliability unknown") + " / " + (item.populationCount || 0) + " applicants" + (item.compatible ? "" : " / INCOMPATIBLE")) + '</option>';
      }).join("");
      snapshotSelect.value = state.snapshotId;
      refreshModeBanner();
    });
    fetch("/api/scenarios").then(function (res) { return res.json(); }).then(function (items) {
      var select = document.getElementById("eduopsPreviewScenario");
      select.innerHTML = items.map(function (item) {
        return '<option value="' + escapeHtml(item.id) + '">' + escapeHtml(item.label) + '</option>';
      }).join("");
      select.value = state.scenario;
      renderScenarioNotes(items);
      select.addEventListener("change", function () {
        state.scenario = select.value;
        localStorage.setItem("eduopsPreviewScenario", state.scenario);
        renderScenarioNotes(items);
        reloadEduOps();
      });
    });
    var latency = document.getElementById("eduopsPreviewLatency");
    latency.value = String(state.latencyMs);
    latency.addEventListener("change", function () {
      state.latencyMs = Number(latency.value);
      localStorage.setItem("eduopsPreviewLatencyMs", String(state.latencyMs));
      renderDiagnostics();
    });
    document.getElementById("eduopsPreviewError").addEventListener("change", function (event) {
      state.simulatedError = event.target.value;
      reloadEduOps();
    });
    document.getElementById("eduopsPreviewReset").addEventListener("click", function () {
      state.scenario = "normal-authoritative";
      state.latencyMs = -1;
      state.simulatedError = "";
      localStorage.setItem("eduopsPreviewScenario", state.scenario);
      localStorage.setItem("eduopsPreviewLatencyMs", "-1");
      location.reload();
    });
    document.getElementById("eduopsPreviewReload").addEventListener("click", reloadEduOps);
    document.getElementById("eduopsPreviewExportLog").addEventListener("click", exportLog);
    document.getElementById("eduopsPreviewSaveNote").addEventListener("click", saveReviewNote);
    panel.addEventListener("click", function (event) {
      var button = event.target.closest("[data-preview-viewport]");
      if (!button) return;
      document.documentElement.setAttribute("data-preview-viewport", button.getAttribute("data-preview-viewport"));
    });
  }

  function selectedSnapshotMetadata() {
    return state.snapshots.filter(function (item) { return item.id === state.snapshotId; })[0] || null;
  }

  function refreshModeBanner() {
    var banner = document.getElementById("eduopsPreviewModeBanner");
    var scenarioLabel = document.getElementById("eduopsPreviewScenario") && document.getElementById("eduopsPreviewScenario").closest("label");
    var snapshotLabel = document.getElementById("eduopsPreviewSnapshotLabel");
    if (!banner) return;
    if (state.dataMode === "snapshot") {
      var meta = selectedSnapshotMetadata();
      if (scenarioLabel) scenarioLabel.hidden = true;
      if (snapshotLabel) snapshotLabel.hidden = false;
      var ageWarning = "";
      if (meta && meta.captureDate) {
        var ageMs = Date.now() - Date.parse(meta.captureDate);
        if (isFinite(ageMs) && ageMs > 24 * 60 * 60 * 1000) ageWarning = " SNAPSHOT MAY BE OUT OF DATE.";
      }
      banner.setAttribute("data-mode", "snapshot");
      banner.textContent = meta
        ? "FODE SNAPSHOT MODE / CURRENT AS OF CAPTURE TIME / Captured: " + (meta.captureDate || "-") + " / Runtime: " + (meta.runtimeIdentity || "-") + " / Contract: " + (meta.contractVersion || "-") + " / Snapshot: " + (meta.snapshotId || "-") + " / Reliability: " + (meta.reliability || "-") + "." + ageWarning
        : "FODE SNAPSHOT MODE / Select a compatible local snapshot. This is not live data.";
    } else {
      if (scenarioLabel) scenarioLabel.hidden = false;
      if (snapshotLabel) snapshotLabel.hidden = true;
      banner.setAttribute("data-mode", "deterministic");
      banner.textContent = "DETERMINISTIC SCENARIO DATA / NOT CURRENT FODE DATA / NO LIVE OPERATIONS.";
    }
  }

  function renderScenarioNotes(items) {
    var notes = document.getElementById("eduopsPreviewScenarioNotes");
    if (!notes) return;
    var found = (items || []).filter(function (item) { return item.id === state.scenario; })[0];
    notes.textContent = found ? found.description : "";
  }

  function reloadEduOps() {
    window.dispatchEvent(new CustomEvent("eduops:preview-reload"));
  }

  function renderDiagnostics() {
    var target = document.getElementById("eduopsPreviewDiagnostics");
    if (!target) return;
    var client = window.__EDUOPS_REQUEST_DIAGNOSTICS__ || [];
    target.textContent = JSON.stringify({ transport: state.log.slice(-12), client: client.slice(-12) }, null, 2);
  }

  function exportLog() {
    var payload = {
      exportedAt: new Date().toISOString(),
      dataMode: state.dataMode,
      scenario: state.scenario,
      snapshotId: state.snapshotId,
      transport: state.log,
      client: window.__EDUOPS_REQUEST_DIAGNOSTICS__ || []
    };
    var blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "EDUOPS_PREVIEW_SESSION_LOG.json";
    link.click();
    setTimeout(function () { URL.revokeObjectURL(link.href); }, 500);
  }

  function saveReviewNote() {
    var note = document.getElementById("eduopsPreviewNote");
    var status = document.getElementById("eduopsPreviewNoteStatus");
    postJson("/api/review-note", {
      scenario: state.scenario,
      dataMode: state.dataMode,
      snapshotId: state.snapshotId,
      note: note ? note.value : "",
      clientDiagnostics: window.__EDUOPS_REQUEST_DIAGNOSTICS__ || []
    }).then(function () {
      if (status) status.textContent = "Saved locally.";
      if (note) note.value = "";
    }).catch(function (err) {
      if (status) status.textContent = "Save failed: " + (err && err.message || err);
    });
  }

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (ch) {
      return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[ch];
    });
  }

  document.addEventListener("DOMContentLoaded", installPanel);
})();
