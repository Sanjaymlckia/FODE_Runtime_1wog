(function () {
  "use strict";

  const params = new URLSearchParams(location.search);
  const savedRail = sessionStorage.getItem("opsedu.preview.railMode");
  const state = {
    mode: params.get("mode") === "baseline" ? "baseline" : "redesign",
    snapshot: null,
    primary: params.get("bucket") || "READY",
    packageId: params.get("package") || "FODE:READY:PAYMENT_FOLLOW_UP",
    search: "",
    selected: new Set(),
    expanded: "",
    summaryMode: params.get("summary") || "compact",
    railMode: params.get("rail") || savedRail || (window.innerWidth <= 1400 ? "compact" : "expanded"),
    batchOpen: false,
    workbenchOpen: false,
    loadState: params.get("state") || "initial-loading",
    holdLoading: params.get("state") === "loading",
    errorDemo: params.get("state") === "error"
  };

  const app = document.getElementById("app");
  const MENU_GROUPS = [
    ["Finance Operations", ["Receipt review", "Payment follow-up", "Books readiness"]],
    ["Communications", ["Individual communication", "Batch communication", "History"]],
    ["Portal", ["Portal access", "Portal status"]],
    ["Contactability", ["Corrections", "Phone fallback"]],
    ["Global Lifecycle", ["Lifecycle resolver", "Actionability"]],
    ["Hidden / Other Routes", ["Dormant", "Exceptions"]],
    ["Management Summary", ["Population", "Workload"]],
    ["Reports", ["Operational reports", "Export"]],
    ["Audit", ["Receipts", "Trace"]],
    ["Roles & Capabilities", ["Capabilities", "Emergency suspension"]]
  ];

  const EMPTY_MESSAGES = {
    AWAITING_APPLICANT: "No applicants currently require input or evidence under this actionability state.",
    AWAITING_PAYMENT: "No applicants are currently waiting without an operator action being due.",
    BLOCKED: "No applicants currently have a known blocking condition requiring intervention.",
    CLASSIFICATION_REQUIRED: "All authoritative applicants are currently classified."
  };

  function modeLabel(mode) {
    return mode === "expanded" ? "Expanded" : mode === "compact" ? "Compact" : "Collapsed";
  }

  function placeholderBadge(text) {
    return `<span class="placeholder-badge">Preview placeholder - not runtime content</span><span>${esc(text)}</span>`;
  }

  function esc(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (ch) => ({
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      "\"": "&quot;",
      "'": "&#39;"
    }[ch]));
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function bucketByCode(code) {
    return (state.snapshot.primaryBuckets || []).find((bucket) => bucket.code === code) || null;
  }

  function packageById(id) {
    if (!id) return null;
    return (state.snapshot.workPackages || []).find((pkg) => pkg.packageId === id) || null;
  }

  function currentPackage() {
    return packageById(state.packageId);
  }

  function allApplicants() {
    return (state.snapshot.workPackages || []).flatMap((pkg) => pkg.applicants || []);
  }

  function filteredApplicants() {
    const pkg = currentPackage();
    if (!pkg) return [];
    const q = state.search.trim().toLowerCase();
    if (!q) return pkg.applicants;
    return pkg.applicants.filter((row) => [row.applicantId, row.name, row.workPackageLabel, row.recommendedActionLabel, row.searchIndex]
      .join(" ")
      .toLowerCase()
      .includes(q));
  }

  function searchHandoffMatches() {
    const q = state.search.trim().toLowerCase();
    if (!q) return [];
    return allApplicants()
      .filter((row) => [row.applicantId, row.name, row.workPackageLabel, row.recommendedActionLabel, row.searchIndex]
        .join(" ")
        .toLowerCase()
        .includes(q))
      .slice(0, 8);
  }

  function resetOperationalState() {
    state.selected.clear();
    state.expanded = "";
    state.batchOpen = false;
    state.workbenchOpen = false;
  }

  function showLoading(message, done) {
    state.loadState = message;
    render();
    if (state.holdLoading) return;
    setTimeout(() => {
      state.loadState = "";
      if (done) done();
      render();
    }, 120);
  }

  function setMode(mode) {
    state.mode = mode;
    render();
  }

  function setPrimary(code) {
    state.primary = code;
    const bucket = bucketByCode(code);
    const first = bucket && bucket.packages && bucket.packages[0];
    state.packageId = first ? first.packageId : "";
    state.search = "";
    state.summaryMode = "compact";
    resetOperationalState();
    showLoading("Loading operational work packages...");
  }

  function setPackage(packageId) {
    state.packageId = packageId;
    const pkg = packageById(packageId);
    if (pkg) state.primary = pkg.primaryActionability;
    state.search = "";
    state.summaryMode = "compact";
    resetOperationalState();
    showLoading("Loading applicant workload...");
  }

  function setRail(mode) {
    state.railMode = mode;
    sessionStorage.setItem("opsedu.preview.railMode", mode);
    render();
  }

  function setSummary(mode) {
    state.summaryMode = mode;
    render();
  }

  function toggleSelected(id) {
    if (state.selected.has(id)) state.selected.delete(id);
    else state.selected.add(id);
    render();
  }

  function selectEligiblePage() {
    if (!currentPackage()) return;
    showLoading("Evaluating batch eligibility...", () => {
      for (const row of filteredApplicants()) {
        if (row.selectionEligible) state.selected.add(row.applicantId);
      }
    });
  }

  function renderAdminShell(content) {
    return `
      <div class="admin-shell" data-shot="complete-admin-shell">
        <aside class="admin-nav" aria-label="Admin navigation">
          <div class="nav-brand">
            <span class="product-mark">FODE</span>
            <strong>Admin</strong>
            <small>Live operations · read-only preview</small>
          </div>
          ${MENU_GROUPS.map(([group, items]) => `
            <section class="nav-group">
              <h3>${esc(group)}</h3>
              ${items.map((item) => `<button class="nav-item" type="button">${esc(item)}</button>`).join("")}
            </section>`).join("")}
        </aside>
        <main class="admin-main">
          ${content}
        </main>
      </div>`;
  }

  function renderTopbar() {
    const source = state.snapshot.source || {};
    return `
      <header class="topbar">
        <div class="brand">
          <p class="eyebrow">OpsEdu Preview Lab</p>
          <h1>OpsEdu Cockpit</h1>
          <p>FODE live production operations · ${esc(source.liveRuntime || "runtime identity unavailable")} · snapshot ${esc(source.snapshotId || "")}</p>
        </div>
        <div class="mode-switch" aria-label="Preview mode selector">
          <button class="${state.mode === "baseline" ? "active" : ""}" data-mode="baseline">Accepted R367 baseline</button>
          <button class="${state.mode === "redesign" ? "active" : ""}" data-mode="redesign">Refined R368 redesign</button>
        </div>
      </header>`;
  }

  function renderBaseline() {
    const population = state.snapshot.population;
    const cards = state.snapshot.workPackages.map((pkg) => `
      <div class="metric">
        <strong>${pkg.count}</strong>
        <span>${esc(pkg.displayLabel)}</span>
        <small>${esc(pkg.packageId)}</small>
      </div>`).join("");
    return renderAdminShell(`
      ${renderTopbar()}
      <section class="notice">Accepted R367 baseline reproduced locally for comparison inside the complete Admin shell.</section>
      <section class="baseline" data-shot="styling-comparison">
        <div class="baseline-card">
          <p class="eyebrow">Baseline summary footprint</p>
          <h2>Today's work</h2>
          <div class="baseline-grid">${cards}</div>
        </div>
        <aside class="panel">
          <p class="eyebrow">Authoritative population</p>
          <div class="metric"><strong>${population.authoritativeApplicants}</strong><span>Applicants</span></div>
          <div class="metric"><strong>${population.duplicates.length}</strong><span>Duplicates</span></div>
          <p>The refined preview keeps the Admin shell visible and moves practical work into granular packages.</p>
        </aside>
      </section>`);
  }

  function renderSummary() {
    const buckets = state.snapshot.primaryBuckets.map((bucket) => `
      <button class="primary-pill ${bucket.code === state.primary ? "active" : ""}" data-primary="${esc(bucket.code)}">
        <span>${esc(bucket.label)}</span>
        <span class="count">${bucket.count}</span>
      </button>`).join("");
    return `
      <section class="summary-strip ${state.summaryMode}" data-shot="${state.summaryMode === "expanded" ? "expanded-summary" : state.summaryMode === "collapsed" ? "collapsed-summary" : "compact-summary"}">
        <div class="summary-title">Today’s work · ${modeLabel(state.summaryMode)}</div>
        <div class="summary-mini">${esc(bucketByCode(state.primary).label)} · ${esc(currentPackage() ? currentPackage().displayLabel : "No package selected")}</div>
        <div class="primary-list" aria-label="All primary actionability buckets">${buckets}</div>
        <div class="summary-actions">
          <button data-summary="expanded">Expanded</button>
          <button data-summary="compact">Compact</button>
          <button data-summary="collapsed">Collapsed</button>
        </div>
      </section>`;
  }

  function renderPackages() {
    const bucket = bucketByCode(state.primary);
    const packages = bucket ? bucket.packages : [];
    const railClass = `packages ${state.railMode}`;
    if (!packages.length) {
      return `
        <aside class="${railClass}" data-shot="${state.railMode === "collapsed" ? "collapsed-package-rail" : "expanded-package-rail"}">
          <div class="rail-head">
            <strong>${esc(bucket ? bucket.label : "No bucket")}</strong>
            <button data-rail="${state.railMode === "collapsed" ? "compact" : "collapsed"}">${state.railMode === "collapsed" ? "Compact" : "Collapsed"}</button>
          </div>
          <div class="empty package-empty">0 packages</div>
        </aside>`;
    }
    return `
      <aside class="${railClass}" data-shot="${state.railMode === "collapsed" ? "collapsed-package-rail" : "expanded-package-rail"}">
        <div class="rail-head">
          <div>
            <p class="eyebrow">Operational work packages</p>
            <strong>${esc(bucket.label)}</strong>
          </div>
          <div class="rail-actions">
            <button data-rail="expanded">Expanded</button>
            <button data-rail="compact">Compact</button>
            <button data-rail="collapsed">Collapsed</button>
          </div>
        </div>
        ${packages.map((pkg) => `
          <button class="package-card ${pkg.packageId === state.packageId ? "active" : ""}" data-package="${esc(pkg.packageId)}" title="${esc(pkg.label)}">
            <strong>${esc(pkg.label)}</strong>
            <small>${pkg.count} · ${esc(pkg.authority)} · ${esc(pkg.recommendedMessageType || "no communication")}</small>
            <em>${esc(pkg.packageId)}</em>
          </button>`).join("")}
      </aside>`;
  }

  function renderEmptyBucket() {
    const bucket = bucketByCode(state.primary);
    const message = EMPTY_MESSAGES[state.primary] || "No applicants currently match this authoritative actionability state.";
    const shot = {
      AWAITING_APPLICANT: "empty-waiting-applicant",
      AWAITING_PAYMENT: "empty-waiting-payment",
      BLOCKED: "empty-blocked",
      CLASSIFICATION_REQUIRED: "empty-classification-required"
    }[state.primary] || "empty-work-package";
    return `
      <div class="empty empty-bucket" data-shot="${shot}">
        <p class="eyebrow">${esc(bucket ? bucket.label : state.primary)}</p>
        <h2>0 applicants</h2>
        <p>${esc(message)}</p>
      </div>`;
  }

  function renderToolbar(pkg) {
    const disabled = !pkg;
    return `
      <div class="toolbar" data-shot="opaque-sticky-toolbar">
        <span class="context">Bucket: ${esc(bucketByCode(state.primary).label)}</span>
        <span class="context package-context">Package: ${esc(pkg ? pkg.displayLabel : "None")}</span>
        <input id="searchBox" value="${esc(state.search)}" placeholder="Search name or ApplicantID">
        <select id="filterBox"><option>All eligible</option><option>Due now</option><option>Warnings</option></select>
        <select id="sortBox"><option>Due date</option><option>Applicant name</option><option>ApplicantID</option></select>
        <select id="pageSizeBox"><option>25 rows</option><option>50 rows</option></select>
        <span>${state.selected.size} selected</span>
        <button data-select-page ${disabled ? "disabled" : ""}>Select eligible page</button>
        <button data-open-batch ${disabled || state.selected.size === 0 ? "disabled" : ""}>Open Batch Operations</button>
      </div>`;
  }

  function rowHtml(row) {
    const selected = state.selected.has(row.applicantId);
    const expanded = state.expanded === row.applicantId;
    return `
      <article class="row ${selected ? "selected" : ""}" data-applicant="${esc(row.applicantId)}" data-shot="${row.applicantId === "FODE-26-002959" ? "waffi-payment-followup" : ""}">
        <input type="checkbox" ${selected ? "checked" : ""} ${row.selectionEligible ? "" : "disabled"} data-select="${esc(row.applicantId)}" aria-label="Select ${esc(row.applicantId)}">
        <div class="row-main">
          <strong>${esc(row.name || "Unnamed applicant")}</strong>
          <span>${esc(row.applicantId)} · ${esc(row.contactabilityState || "contactability unavailable")}</span>
        </div>
        <div class="row-work">
          <strong>${esc(row.workPackageLabel)}</strong>
          <span>${esc(row.primaryReason || row.reasonCode)} · ${esc(row.recommendedActionLabel)} · ${esc(row.nextActionDate || "no due date")}</span>
        </div>
        <div class="row-status">
          <span class="chip">${esc(row.urgencyLevel || "normal")}</span>
          <span class="chip ${selected ? "selected-chip" : ""}">${selected ? "Selected" : row.selectionEligible ? "Eligible" : "Blocked"}</span>
        </div>
        <div class="row-actions">
          <button class="row-action" data-expand="${esc(row.applicantId)}">${expanded ? "Collapse" : "Expand"}</button>
          <button class="row-action" data-workbench="${esc(row.applicantId)}">Workbench</button>
        </div>
        ${expanded ? renderRowDetail(row) : ""}
      </article>`;
  }

  function renderRowDetail(row) {
    return `
      <div class="row-detail" data-shot="expanded-row">
        <div class="detail-grid">
          <div><span>Lifecycle</span><strong>${esc(row.lifecycleLabel)}</strong></div>
          <div><span>Actionability</span><strong>${esc(row.actionabilityLabel)}</strong></div>
          <div><span>Work package</span><strong>${esc(row.workPackageLabel)}</strong></div>
          <div><span>Operator next action</span><strong>${esc(row.recommendedActionLabel)}</strong></div>
          <div><span>Lifecycle owner</span><strong>${esc(row.actionOwner || "not returned")}</strong></div>
          <div><span>Documents</span><strong>${esc(row.documentState || "not returned")}</strong></div>
          <div><span>Finance</span><strong>${esc(row.financeState || "not returned")}</strong></div>
          <div><span>Selection</span><strong>${row.selectionEligible ? "Eligible" : esc(row.selectionBlockReason || "Blocked")}</strong></div>
        </div>
        <details class="trace"><summary>Show audit context</summary><pre>${esc(JSON.stringify(row.trace, null, 2))}</pre></details>
      </div>`;
  }

  function renderRows() {
    if (state.errorDemo) {
      return `<div class="error-state" data-shot="error-state"><strong>Loading applicant workload failed.</strong><p>Authoritative applicant workload decision was not returned. Refresh or retry before continuing.</p><button data-retry>Retry</button></div>`;
    }
    if (state.loadState) return `<div class="loading-state" data-shot="loading-state">${esc(state.loadState)}</div>`;
    const pkg = currentPackage();
    if (!pkg) return renderEmptyBucket();
    const rows = filteredApplicants();
    const handoff = searchHandoffMatches().filter((row) => row.workPackageId !== state.packageId);
    if (state.search.trim() && !rows.length && handoff.length) {
      return `
        <div class="empty" data-shot="waffi-search-handoff">
          <strong>No result in ${esc(currentPackage() ? currentPackage().displayLabel : bucketByCode(state.primary).label)}.</strong>
          ${handoff.map((row) => `
            <div class="handoff-card">
              <p>${esc(row.name)} exists under:</p>
              <strong>${esc(row.actionabilityLabel)} -> ${esc(row.workPackageLabel)}</strong>
              <button data-package="${esc(row.workPackageId)}">Open correct work package</button>
            </div>`).join("")}
        </div>`;
    }
    if (!rows.length) return `<div class="empty" data-shot="empty-work-package">No applicants match this active work-package/search context.</div>`;
    return rows.map(rowHtml).join("");
  }

  function templatesFromWorkbench() {
    const wb = state.snapshot.waffi && state.snapshot.waffi.workbench;
    return (((wb || {}).communications || {}).communicationTemplatePanel || {}).templates || [];
  }

  function renderBatchPanel() {
    if (!state.batchOpen) return "";
    const templates = templatesFromWorkbench();
    const selectedRows = allApplicants().filter((row) => state.selected.has(row.applicantId));
    return `
      <section class="side-panel batch-panel" data-shot="batch-preview">
        <p class="eyebrow">Batch communication preview · non-send</p>
        <h2>Batch Operations</h2>
        <p>Selected count: ${state.selected.size}. Execution limit: 30. Evaluated cohort: ${selectedRows.length}. Send transport unavailable in preview.</p>
        ${templates.slice(0, 6).map((template) => `
          <div class="template ${template.recommended ? "recommended" : ""} ${template.selectable ? "" : "disabled"}">
            <strong>${esc(template.label)}</strong>
            <p>${esc(template.subject || "Subject returned by backend")}</p>
            <small>${template.recommended ? "Recommended · " : ""}${esc(template.availabilityLabel || template.availability || "")} ${esc(template.unavailableReason || "")}</small>
          </div>`).join("")}
        <button disabled>Send disabled in preview</button>
        <button data-close-batch>Close</button>
      </section>`;
  }

  function renderWorkbench() {
    if (!state.workbenchOpen) return "";
    const row = state.snapshot.waffi.applicant || filteredApplicants()[0] || {};
    const templates = templatesFromWorkbench();
    const docs = [
      { label: "Required documents", state: row.documentState || "not returned" },
      { label: "Payment evidence", state: row.financeState || "not returned" },
      { label: "Identity / school record", state: "Preview placeholder pending backend document card DTO" }
    ];
    return `
      <section class="side-panel workbench" data-shot="individual-workbench">
        <p class="eyebrow">Individual applicant workbench</p>
        <h2>${esc(row.name || "Applicant")}</h2>
        <p>${esc(row.applicantId || "")}</p>
        <div class="detail-grid compact">
          <div><span>Lifecycle</span><strong>${esc(row.lifecycleLabel || "")}</strong></div>
          <div><span>Actionability</span><strong>${esc(row.actionabilityLabel || "")}</strong></div>
          <div><span>Work package</span><strong>${esc(row.workPackageLabel || "")}</strong></div>
          <div><span>Operator next action</span><strong>${esc(row.recommendedActionLabel || "")}</strong></div>
        </div>
        <h3>Documents</h3>
        <p class="preview-only-note">Preview-only placeholder values are explicitly marked here and must not become runtime content.</p>
        <div class="gallery">
          ${docs.map((doc) => `<div class="doc-card"><strong>${esc(doc.label)}</strong><p>${doc.state.indexOf("Preview placeholder") === 0 ? placeholderBadge(doc.state) : esc(doc.state)}</p><button>Preview/enlarge</button></div>`).join("")}
        </div>
        <h3>Communications</h3>
        <div class="template recommended">
          ${(templates.filter((template) => template.recommended).slice(0, 1).map((template) => `<strong>${esc(template.label)}</strong><p>${esc(template.subject)}</p>`).join("")) || "<p>No recommended template returned.</p>"}
        </div>
        <button data-close-workbench>Return to same package and scroll position</button>
      </section>`;
  }

  function renderRedesign() {
    const pkg = currentPackage();
    return renderAdminShell(`
      ${renderTopbar()}
      ${renderSummary()}
      <section class="workspace rail-${esc(state.railMode)}" data-shot="redesign-workspace">
        ${renderPackages()}
        <div class="work-area">
          ${renderToolbar(pkg)}
          <div class="rows">${renderRows()}</div>
        </div>
      </section>
      ${renderBatchPanel()}
      ${renderWorkbench()}`);
  }

  function render() {
    if (!state.snapshot) return;
    app.innerHTML = state.mode === "baseline" ? renderBaseline() : renderRedesign();
    bind();
  }

  function bind() {
    document.querySelectorAll("[data-mode]").forEach((el) => el.addEventListener("click", () => setMode(el.dataset.mode)));
    document.querySelectorAll("[data-primary]").forEach((el) => el.addEventListener("click", () => setPrimary(el.dataset.primary)));
    document.querySelectorAll("[data-package]").forEach((el) => el.addEventListener("click", () => setPackage(el.dataset.package)));
    document.querySelectorAll("[data-rail]").forEach((el) => el.addEventListener("click", () => setRail(el.dataset.rail)));
    document.querySelectorAll("[data-summary]").forEach((el) => el.addEventListener("click", () => setSummary(el.dataset.summary)));
    document.querySelectorAll("[data-select]").forEach((el) => el.addEventListener("change", () => toggleSelected(el.dataset.select)));
    document.querySelectorAll("[data-expand]").forEach((el) => el.addEventListener("click", () => {
      state.expanded = state.expanded === el.dataset.expand ? "" : el.dataset.expand;
      render();
    }));
    document.querySelectorAll("[data-workbench]").forEach((el) => el.addEventListener("click", () => {
      state.workbenchOpen = true;
      showLoading("Loading applicant detail...");
    }));
    const search = byId("searchBox");
    if (search) search.addEventListener("input", () => {
      state.search = search.value;
      state.selected.clear();
      render();
    });
    const selectPage = document.querySelector("[data-select-page]");
    if (selectPage) selectPage.addEventListener("click", selectEligiblePage);
    const openBatch = document.querySelector("[data-open-batch]");
    if (openBatch) openBatch.addEventListener("click", () => { state.batchOpen = true; render(); });
    const closeBatch = document.querySelector("[data-close-batch]");
    if (closeBatch) closeBatch.addEventListener("click", () => { state.batchOpen = false; render(); });
    const closeWorkbench = document.querySelector("[data-close-workbench]");
    if (closeWorkbench) closeWorkbench.addEventListener("click", () => { state.workbenchOpen = false; render(); });
    const retry = document.querySelector("[data-retry]");
    if (retry) retry.addEventListener("click", () => { state.errorDemo = false; showLoading("Loading applicant workload..."); });
  }

  fetch("/api/snapshot", { cache: "no-store" })
    .then((res) => res.ok ? res.json() : Promise.reject(new Error("Snapshot load failed")))
    .then((snapshot) => {
      state.snapshot = snapshot;
      const initialBucket = bucketByCode(state.primary);
      const initialPackage = packageById(state.packageId);
      if (!initialPackage && initialBucket && initialBucket.packages[0]) state.packageId = initialBucket.packages[0].packageId;
      if (!initialBucket) state.primary = "READY";
      showLoading("Loading primary actionability...");
    })
    .catch((err) => {
      app.innerHTML = `<main class="fail-shell"><p class="eyebrow">Fail closed</p><h1>Authoritative snapshot decision was not returned.</h1><p>${esc(err.message || err)}</p><p>Refresh or retry before continuing.</p></main>`;
    });
}());
