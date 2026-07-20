const assert = require("node:assert/strict");
const fs = require("node:fs");
const playwrightModule = process.env.FODE_PLAYWRIGHT_MODULE || "F:/Playwright/fode-secure-link-diagnostic/node_modules/playwright";
const { chromium } = require(playwrightModule);

const clientFiles = ["EduOps_ClientCore.html", "OpsEdu_ClientCockpit.html", "EduOps_ClientComponents.html", "EduOps_ClientWorkbench.html", "EduOps_ClientBatch.html", "EduOps_Client.html"];

function fixtureHtml() {
  let html = fs.readFileSync("EduOps.html", "utf8");
  html = html.replace('<?!= HtmlService.createHtmlOutputFromFile("EduOps_Styles").getContent(); ?>', fs.readFileSync("EduOps_Styles.html", "utf8"));
  html = html.replace('<?!= HtmlService.createHtmlOutputFromFile("OpsEdu_CockpitStyles").getContent(); ?>', fs.readFileSync("OpsEdu_CockpitStyles.html", "utf8"));
  const mock = `<script>
    window.__rpcCalls = [];
    window.__executeCalls = 0;
    window.__rows = Array.from({ length: 253 }, function (_unused, index) {
      var id = "FODE-26-" + String(index + 1).padStart(6, "0");
      var coolingPayment = index === 1; var payment = coolingPayment || index === 252;
      return { applicantId: id, displayName: "Authority Applicant " + (index + 1), name: "Authority Applicant " + (index + 1), email: "applicant" + (index + 1) + "@example.test", actionabilityState: coolingPayment ? "COOLING_OFF" : "READY", worklistKey: payment ? "PAYMENT_FOLLOW_UP" : "DOCUMENT_FOLLOW_UP", worklistLabel: payment ? "Payment follow-up" : "Document follow-up", actionOwner: coolingPayment ? "APPLICANT" : "OWNER", workOwnership: { scope: "ALL_AUTHORISED" }, urgencyLevel: "NORMAL", urgencyReason: "Fixture", primaryRoute: payment ? "FINANCE" : "DOCUMENTS", nextAction: coolingPayment ? "Payment follow-up after 20 July 2026" : payment ? "Payment follow-up" : "Request missing documents", nextActionDate: coolingPayment ? "2026-07-20T00:00:00.000Z" : "", canonicalLifecycle: { label: payment ? "Payment pending" : "Documents pending" }, canonicalFinanceState: payment ? "PAYMENT_PENDING" : "NOT_YET_PAYMENT_APPLICABLE", documentState: payment ? "COMPLETE" : "MISSING", contactabilityState: "EMAIL_AVAILABLE", coolingOffUntil: coolingPayment ? "2026-07-20T00:00:00.000Z" : "", recommendedMessageType: payment ? "payment_followup" : "docs_missing", selectable: !coolingPayment, selectBlockReason: coolingPayment ? "Recently contacted - waiting period." : "", sourceReliability: { state: "AUTHORITATIVE" } };
    });
    window.__p = function (code, label, reason, tone) { return { schemaVersion: "EDUOPS_CODE_PRESENTATION_V1", authoritySource: "Authoritative fixture service", code: code, label: label, reason: reason || label, tone: tone || "ready", available: true, stale: false }; };
    window.__rows.forEach(function (row) {
      row.presentation = {
        actionability: window.__p(row.actionabilityState, row.actionabilityState === "COOLING_OFF" ? "Recently contacted - waiting period" : "Ready for action", row.selectBlockReason, row.actionabilityState === "COOLING_OFF" ? "warn" : "ready"),
        worklist: window.__p(row.worklistKey, row.worklistLabel),
        nextAction: window.__p(row.nextAction, row.nextAction),
        coolingOff: window.__p(row.actionabilityState === "COOLING_OFF" ? "COOLING_OFF" : "NOT_COOLING_OFF", row.actionabilityState === "COOLING_OFF" ? "Recently contacted - waiting period" : "No waiting period"),
        lifecycle: window.__p(row.canonicalLifecycle.label.toUpperCase().replace(/ /g, "_"), row.canonicalLifecycle.label),
        finance: window.__p(row.canonicalFinanceState, row.canonicalFinanceState === "PAYMENT_PENDING" ? "Payment pending" : "Not yet payment applicable"),
        documents: window.__p(row.documentState, row.documentState === "COMPLETE" ? "Complete" : "Missing"),
        owner: window.__p(row.actionOwner, row.actionOwner === "APPLICANT" ? "Applicant" : "Owner"),
        workScope: window.__p("ALL_AUTHORISED", "All authorised work"),
        route: window.__p(row.primaryRoute, row.primaryRoute === "FINANCE" ? "Finance" : "Documents"),
        urgency: window.__p("NORMAL", "Normal"),
        contactability: window.__p("EMAIL_AVAILABLE", "Email available"),
        reliability: window.__p("AUTHORITATIVE", "Authoritative")
      };
      row.authorityDecision = { schemaVersion: "EDUOPS_ROW_AUTHORITY_DECISION_V1", authoritySource: "Actionability Resolver", applicantId: row.applicantId, snapshotId: "SNAP-INTEGRATED", state: row.actionabilityState, reasonCode: row.selectable ? "AVAILABLE" : "COOLING_OFF", reason: row.selectBlockReason || "Authorised work can proceed now.", actionAvailable: row.selectable, stale: false };
    });
    window.__binding = function (payload) { var query = { product: "FODE", actionabilityState: payload.actionabilityState, worklistKey: payload.worklistKey || "", workScope: payload.workScope, filters: payload.filters || {}, sort: payload.sort || {}, pageSize: payload.pageSize }; return { schemaVersion: "EDUOPS_QUERY_BINDING_V1", authority: "SERVER_AUTHORED", product: "FODE", snapshotId: "SNAP-INTEGRATED", query: query, queryFingerprint: "SERVER::" + JSON.stringify(query) }; };
    window.__bucket = function (code, label, count) { return { schemaVersion: "OPSEDU_PRIMARY_BUCKET_V1", authoritySource: "Actionability Resolver + EduOps workload query service", code: code, label: label, count: count, reason: "Backend-authored fixture bucket.", defaultQueueBinding: window.__binding({ actionabilityState: code, worklistKey: "", workScope: "ALL_AUTHORISED", filters: { search: "" }, sort: { key: "urgency", direction: "ASC" }, pageSize: 25 }), disabled: false, disabledReason: "", snapshotId: "SNAP-INTEGRATED", snapshotTimestamp: "2026-07-19T00:00:00.000Z" }; };
    window.__cockpit = function () {
      function item(id, label, count, state, worklist, priority) { var payload = { product: "FODE", actionabilityState: state, worklistKey: worklist, workScope: "ALL_AUTHORISED", filters: { search: "" }, sort: { key: "urgency", direction: "ASC" }, pageSize: 25 }; return { schemaVersion: "OPSEDU_ACTION_PACKAGE_V1", packageId: id, actionabilityState: state, worklistKey: worklist, label: label, shortOperatorLabel: label, count: count, primaryAction: "OPEN_ACTION_QUEUE", primaryActionLabel: "Open queue", workType: worklist || state, ownerDomain: worklist === "PAYMENT_FOLLOW_UP" ? "Finance" : "Documents", route: worklist === "PAYMENT_FOLLOW_UP" ? "Finance" : "Documents", routeReason: "Backend-authored fixture route.", defaultQueueBinding: window.__binding(payload), mutationBoundary: "Authoritative backend service", disabled: false, disabledReason: "", secondary: false, sortPriority: priority, authoritySource: "Actionability Resolver + EduOps workload query service", snapshotId: "SNAP-INTEGRATED", snapshotTimestamp: "2026-07-19T00:00:00.000Z" }; }
      return { schemaVersion: "OPSEDU_COCKPIT_V1", authoritySource: "Authoritative fixture service", productLabel: "FODE live production operations", heading: "Today's work", primaryBuckets: [window.__bucket("READY", "Ready for action", 252), window.__bucket("COOLING_OFF", "Recently contacted / waiting period", 1), window.__bucket("AWAITING_APPLICANT", "Waiting for applicant", 0), window.__bucket("AWAITING_PAYMENT", "Waiting for payment", 0), window.__bucket("REVIEW_REQUIRED", "Needs review", 0), window.__bucket("BLOCKED", "Blocked / intervention required", 0), window.__bucket("UNKNOWN", "Classification required", 0), window.__bucket("COMPLETE", "Completed", 0)], actionPackages: [item("FODE:READY:PAYMENT_FOLLOW_UP", "Payment follow-ups due", 1, "READY", "PAYMENT_FOLLOW_UP", 10), item("FODE:READY:DOCUMENT_FOLLOW_UP", "Missing documents - applicant follow-up due", 251, "READY", "DOCUMENT_FOLLOW_UP", 20), item("FODE:COOLING_OFF", "Recently contacted / cooling off", 1, "COOLING_OFF", "", 70)], snapshotId: "SNAP-INTEGRATED", snapshotTimestamp: "2026-07-19T00:00:00.000Z", stale: false };
    };
    window.__workload = function (payload) {
      var page = Number(payload.page || 1); var pageSize = Number(payload.pageSize || 25); var matched = window.__rows.filter(function (row) { return (!payload.actionabilityState || row.actionabilityState === payload.actionabilityState) && (!payload.worklistKey || row.worklistKey === payload.worklistKey); }); var offset = (page - 1) * pageSize;
      var reconciliation = { canonicalPopulation: 253, totalMatched: matched.length, totalAuthoritySelectable: matched.filter(function (row) { return row.selectable; }).length, totalAuthorityBlocked: matched.filter(function (row) { return !row.selectable; }).length, matchingOnLaterPages: Math.max(0, matched.length - pageSize), hiddenFromCurrentView: 253 - matched.length, eligibleOutsideCurrentWindow: Math.max(0, matched.length - pageSize) };
      var presentation = { schemaVersion: "EDUOPS_WORKLOAD_PRESENTATION_V1", authoritySource: "Population Ledger + Actionability Resolver", actionabilityBuckets: [window.__p("READY", "Ready for action"), window.__p("COOLING_OFF", "Recently contacted - waiting period", "A known action is time-gated.", "warn"), window.__p("AWAITING_APPLICANT", "Waiting for applicant", "Applicant input is outstanding.", "warn"), window.__p("AWAITING_PAYMENT", "Waiting for payment", "Payment is outstanding.", "warn"), window.__p("REVIEW_REQUIRED", "Needs review", "An internal decision is required.", "warn"), window.__p("BLOCKED", "Blocked - intervention required", "A known blocker prevents progress.", "blocked"), window.__p("UNKNOWN", "Classification required", "Authority cannot classify this record safely.", "blocked"), window.__p("COMPLETE", "Completed records")].map(function (item) { item.count = item.code === "READY" ? 252 : item.code === "COOLING_OFF" ? 1 : 0; return item; }), allActionability: { label: "All authoritative states", count: 253 }, worklists: [{ code: "", label: "All work types", count: matched.length }, { code: "DOCUMENT_FOLLOW_UP", label: "Document follow-up", count: 251 }, { code: "PAYMENT_FOLLOW_UP", label: "Payment follow-up", count: 2 }], workScopes: [window.__p("ALL_AUTHORISED", "All authorised work")], reliability: window.__p("AUTHORITATIVE", "Authoritative", "Canonical fixture"), metrics: [{ label: "Eligible now", value: 252 }], filterOptions: { owner: [], urgency: [], primaryRoute: [], documentState: [], financeState: [], contactabilityState: [], communicationState: [], cooling: [], blockKind: [] }, selection: { totalMatched: matched.length, visibleSelectable: matched.slice(offset, offset + pageSize).filter(function (row) { return row.selectable; }).length, visibleBlocked: matched.slice(offset, offset + pageSize).filter(function (row) { return !row.selectable; }).length }, modules: {}, evaluatedCohort: { snapshotId: "SNAP-INTEGRATED", totalMatched: matched.length } };
      return { ok: true, schemaVersion: "EDUOPS_OPERATIONAL_WORKLOAD_V2", authoritySource: "Population Ledger + Actionability Resolver", product: "FODE", runtime: { operationalClassification: "FODE live production operations", deploymentRole: "LIVE_PRODUCTION_OPERATIONS", runtimeIdentity: "r362 / 362", appsScriptVersion: "397", deploymentIdSafe: "ADMIN...LIVE", dataAuthority: "FODE canonical applicant snapshot", snapshotId: "SNAP-INTEGRATED", snapshotAsOf: "2026-07-19T00:00:00.000Z" }, cockpit: window.__cockpit(), snapshotId: "SNAP-INTEGRATED", snapshotAsOf: "2026-07-19T00:00:00.000Z", reliabilityState: "AUTHORITATIVE", reliabilityReasons: ["Canonical fixture"], actionabilityCounts: { READY: 252, COOLING_OFF: 1 }, worklistKeyCounts: { DOCUMENT_FOLLOW_UP: 251, PAYMENT_FOLLOW_UP: 2 }, metricCounts: { eligibleNow: 252 }, reconciliation: reconciliation, presentation: presentation, queryBinding: window.__binding(payload), page: page, pageSize: pageSize, totalMatched: matched.length, totalPages: Math.ceil(matched.length / pageSize), rows: matched.slice(offset, offset + pageSize), timings: { serverRpcMs: 2, canonicalSnapshotResolutionMs: 1, workloadCompositionMs: 1, sortingPagingMs: 0, responseBytes: 4096 } };
    };
    window.__recipient = function (row, template, included, reason) { return { applicantId: row.applicantId, name: row.name, email: row.email, actionability: row.actionabilityState, lifecycle: row.canonicalLifecycle.label, finance: row.canonicalFinanceState, documentState: row.documentState, coolingOffUntil: row.coolingOffUntil, templateId: template.templateId, templateLabel: template.label, authorityDecision: included ? "INCLUDED" : "BLOCKED", authorityDecisionLabel: included ? "Included by Communication Authority" : "Blocked by Communication Authority", included: included, reason: reason || (included ? "Communication Authority permits this recipient." : "Unavailable for this recipient."), presentation: row.presentation }; };
    window.__masterRecipient = function (row) { return { applicantId: row.applicantId, name: row.name, email: row.email, actionability: row.actionabilityState, lifecycle: row.canonicalLifecycle.label, finance: row.canonicalFinanceState, documentState: row.documentState, coolingOffUntil: row.coolingOffUntil, authorityDecision: "OPERATOR_SELECTED_NOT_EVALUATED", authorityDecisionLabel: "Operator selected - communication not yet evaluated", included: false, reasonCode: "AWAITING_COMMUNICATION_AUTHORITY", reason: "Communication Authority evaluates this applicant after an explicit communication is selected.", authoritySource: "Communication Authority", presentation: row.presentation }; };
    window.__catalogue = function (payload) {
      var limit = Number(payload.selection.executionLimit); var excluded = {}; (payload.selection.excludedApplicantIds || []).forEach(function (id) { excluded[id] = true; });
      var boundState = payload.selection.queryBinding && payload.selection.queryBinding.query && payload.selection.queryBinding.query.actionabilityState; var master = window.__rows.filter(function (row) { return row.selectable && (!boundState || row.actionabilityState === boundState) && !excluded[row.applicantId]; }); var evaluated = master.slice(0, limit);
      function template(templateId, label, state, eligibleCount, recommended, reason) { var selectable = state !== "UNAVAILABLE" && eligibleCount > 0; var item = { templateId: templateId, label: label, description: label + " canonical description", availabilityState: state, availabilityLabel: selectable ? "Available for this server-evaluated cohort" : "Unavailable for this server-evaluated cohort", selectable: selectable, recommended: recommended, availableRecipientCount: eligibleCount, unavailableRecipientCount: evaluated.length - eligibleCount, reasonCode: state === "UNAVAILABLE" ? "NOT_AUTHORISED" : "", reason: reason || "Available for every applicant in the evaluated execution cohort.", editable: false, editingReason: "Batch Communication Authority uses canonical server-rendered copy; editing is not permitted.", customisable: false, authoritySource: "Communication Authority", evaluatedSnapshot: "SNAP-INTEGRATED", evaluatedCohortBinding: payload.selection.queryBinding }; item.recipients = evaluated.map(function (row, index) { return window.__recipient(row, item, index < eligibleCount, index < eligibleCount ? "" : item.reason); }); return item; }
      var binding = JSON.parse(JSON.stringify(payload.selection)); binding.selectedApplicantIds = master.map(function (row) { return row.applicantId; });
      return { ok: true, state: "READY", statusLabel: "Revalidation complete", executable: true, schemaVersion: "EDUOPS_BATCH_COMMUNICATION_CATALOGUE_V1", authoritySource: "Communication Authority", snapshotId: "SNAP-INTEGRATED", selectionBinding: binding, masterCohortSize: master.length, evaluatedCohortSize: evaluated.length, executionLimit: limit, remainingAfterEvaluation: Math.max(0, master.length - evaluated.length), excludedCount: Object.keys(excluded).length, blockedCount: 0, masterRecipients: master.map(window.__masterRecipient), templates: [template("docs_missing", "Missing Documents Follow-up", "AVAILABLE_FOR_ALL", evaluated.length, true), template("payment_followup", "Payment Follow-up", "AVAILABLE_FOR_SERVER_PARTITION", Math.min(2, evaluated.length), false, "Communication Authority permits a server-authored partition of 2 recipients."), template("application_portal_invitation", "Application Portal Invitation", "UNAVAILABLE", 0, false, "No applicant in this execution cohort is currently authorised.")] };
    };
    window.__preview = function (payload) {
      var catalogue = window.__catalogue({ selection: payload.selection }); var template = catalogue.templates.filter(function (item) { return item.templateId === payload.draft.messageType; })[0]; var recipients = (template.recipients || []).filter(function (item) { return item.included; });
      return { ok: true, state: recipients.length ? "READY" : "BLOCKED", statusLabel: recipients.length ? "Preview ready" : "Blocked by Communication Authority", statusReason: recipients.length ? "Final confirmation is required before execution." : "No executable recipients returned.", executable: recipients.length > 0, previewId: "PREVIEW-1", operation: "BATCH_COMMUNICATION", operationLabel: "Batch communication", snapshotId: "SNAP-INTEGRATED", idempotencyKey: payload.idempotencyKey, summary: "Send " + template.label + " to " + recipients.length + " recipients", selectedTemplate: { templateId: template.templateId, label: template.label, editable: false, customisable: false, editingReason: template.editingReason }, masterCohortSize: catalogue.masterCohortSize, evaluatedCohortSize: catalogue.evaluatedCohortSize, executionCohortSize: recipients.length, remainingAfterExecution: catalogue.masterCohortSize - recipients.length, partitions: recipients.length ? [{ partitionKey: template.templateId, templateId: template.templateId, label: template.label, memberCount: recipients.length, recipients: recipients }] : [], recipients: template.recipients, subject: "FODE KIA Application - Missing Documents", body: "Dear applicant,\\n\\nPlease provide the missing documents listed in your application.\\n\\nFODE Operations", eligibleCount: recipients.length, blockedCount: template.unavailableRecipientCount, excludedCount: catalogue.excludedCount, requiredCapability: "CAN_RUN_BATCH_COMMUNICATIONS", expiresAt: "2026-07-19T00:10:00.000Z" };
    };
    window.__operationAvailability = { DOCUMENT_REVIEW: { available: true }, FINANCE_EVIDENCE_DECISION: { available: true }, SEND_INDIVIDUAL_COMMUNICATION: { available: true }, CONTACTABILITY_CORRECTION: { available: true }, BATCH_COMMUNICATION: { available: true }, PORTAL_ACCESS: { available: false, reason: "This operation is not available in this release." }, BOOKS_ACTION: { available: false, reason: "This operation is not available in this release." } };
    window.EDUOPS_TRANSPORT = { call: function (name, payload) { window.__rpcCalls.push({ name: name, payload: JSON.parse(JSON.stringify(payload || {})) }); if (name === "eduops_getAccessProjection") return Promise.resolve({ ok: true, schemaVersion: "EDUOPS_ACCESS_PROJECTION_V1", authoritySource: "Admin access and capability authority", runtime: { operationalClassification: "FODE live production operations", deploymentRole: "LIVE_PRODUCTION_OPERATIONS", runtimeIdentity: "r362 / 362", appsScriptVersion: "397" }, operationAvailability: window.__operationAvailability, user: { email: "owner@example.test", role: "SUPER", capabilities: { CAN_RUN_BATCH_COMMUNICATIONS: true, CAN_SEND_INDIVIDUAL_EMAIL: true, CAN_OPEN_REVIEW_WORKSPACE: true } } }); if (name === "eduops_getProfile") return Promise.resolve({ ok: true, schemaVersion: "EDUOPS_PROFILE_V2", authoritySource: "EduOps backend profile service", defaultQuery: { product: "FODE", actionabilityState: "READY", worklistKey: "", workScope: "ALL_AUTHORISED", filters: { search: "" }, sort: { key: "urgency", direction: "asc" }, page: 1, pageSize: 25 }, batchPolicy: { schemaVersion: "EDUOPS_BATCH_POLICY_V1", authoritySource: "Communication Authority", allowedExecutionLimits: [10, 25, 30], executionCap: 30 }, featureFlags: { BATCH_COMMUNICATION: true, SEND_INDIVIDUAL_COMMUNICATION: true }, operationAvailability: window.__operationAvailability }); if (name === "eduops_queryOperationalWorkload") return Promise.resolve(window.__workload(payload)); if (name === "eduops_getBatchCommunicationCatalogue") return Promise.resolve(window.__catalogue(payload)); if (name === "eduops_previewCommand") return Promise.resolve(window.__preview(payload)); if (name === "eduops_executeCommand") { window.__executeCalls += 1; return Promise.reject(new Error("SEND_FORBIDDEN_IN_TEST")); } return Promise.resolve({ ok: true, matches: [], receipts: [] }); } };
  </script>`;
  clientFiles.forEach(function (file, index) { const include = '<?!= HtmlService.createHtmlOutputFromFile("' + file.replace(/\.html$/, "") + '").getContent(); ?>'; html = html.replace(include, (index === 0 ? mock : "") + fs.readFileSync(file, "utf8")); });
  return html.replace(/<\?= BUILD_VERSION \?>/g, "r362").replace(/<\?= BUILD_RENDERED_AT \?>/g, "2026-07-19T00:00:00.000Z").replace(/<\?= USER_EMAIL \?>/g, "owner@example.test").replace(/<\?= ADMIN_ROLE \?>/g, "SUPER");
}

async function settled(page) {
  await page.waitForFunction(() => document.querySelector("#eduopsApp")?.getAttribute("aria-busy") === "false" && document.querySelectorAll("#eduopsWorklistRows [data-select-applicant]").length > 0, null, { timeout: 30000 });
}

async function seedExecutableAuthority(page) {
  await page.evaluate(() => {
    const app = window.EduOpsApp;
    const batch = app.state.batch || {};
    Object.assign(batch, {
      step: "confirm",
      catalogue: batch.catalogue || { templates: [] },
      preview: { state: "READY", previewId: "STALE-PREVIEW", partitions: [{ partitionKey: "stale", memberCount: 1 }] },
      receipt: { receiptId: "STALE-RECEIPT" },
      idempotencyKey: "STALE-IDEMPOTENCY",
      authorityError: "",
      invalidationReason: ""
    });
    app.state.batch = batch;
    app.state.commandPreview = batch.preview;
    app.state.commandIdempotencyKey = "STALE-IDEMPOTENCY";
    app.state.commandExecutable = true;
    app.state.confirm = { title: "Stale confirmation" };
  });
}

async function assertAuthorityInvalidated(page, label) {
  const state = await page.evaluate(() => ({
    step: window.EduOpsApp.state.batch && window.EduOpsApp.state.batch.step,
    preview: window.EduOpsApp.state.batch && window.EduOpsApp.state.batch.preview,
    receipt: window.EduOpsApp.state.batch && window.EduOpsApp.state.batch.receipt,
    batchIdempotency: window.EduOpsApp.state.batch && window.EduOpsApp.state.batch.idempotencyKey,
    commandPreview: window.EduOpsApp.state.commandPreview,
    commandIdempotency: window.EduOpsApp.state.commandIdempotencyKey,
    executable: window.EduOpsApp.state.commandExecutable,
    confirmation: window.EduOpsApp.state.confirm
  }));
  assert.equal(state.step, "cohort", `${label}: confirmation step must reset`);
  assert.equal(state.preview, null, `${label}: preview and partitions must clear`);
  assert.equal(state.receipt, null, `${label}: stale receipt must clear`);
  assert.equal(state.batchIdempotency, "", `${label}: batch idempotency must clear`);
  assert.equal(state.commandPreview, null, `${label}: command preview must clear`);
  assert.equal(state.commandIdempotency, "", `${label}: command idempotency must clear`);
  assert.equal(state.executable, false, `${label}: executable state must clear`);
  assert.equal(state.confirmation, null, `${label}: confirmation must close`);
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    const pageErrors = [];
    page.on("pageerror", (error) => { pageErrors.push(error.message); console.error("BROWSER_PAGEERROR", error.stack || error.message); });
    page.on("console", (message) => { if (message.type() === "error") console.error("BROWSER_CONSOLE", message.text()); });
    await page.setContent(fixtureHtml(), { waitUntil: "domcontentloaded" });
    await settled(page);

    assert.equal(await page.locator("#eduopsOperationalClassification").innerText(), "FODE live production operations");
    assert.equal(await page.locator("#eduopsRuntimeIdentity").innerText(), "r362 / 362");
    assert.equal(await page.locator("#eduopsAppsScriptIdentity").innerText(), "Apps Script @397");
    assert.equal(await page.locator("#eduopsReleaseSnapshotIdentity").innerText(), "Snapshot SNAP-INTEGRATED");
    assert.equal(await page.locator("#eduopsReleaseSnapshotTime").innerText(), "As of 2026-07-19T00:00:00.000Z");
    assert.match(await page.locator("#eduopsReleaseIdentity").innerText(), /FODE live production operations[\s\S]*r362 \/ 362[\s\S]*Apps Script @397[\s\S]*Snapshot SNAP-INTEGRATED[\s\S]*As of 2026-07-19T00:00:00\.000Z/);
    assert.doesNotMatch(await page.locator("#eduopsReleaseIdentity").innerText(), /Admin staging/);
    assert.equal(await page.locator("#opseduCockpitHeading").innerText(), "Today's work");
    assert.equal(await page.locator("#opseduCockpitContext").innerText(), "FODE live production operations");
    const cockpitLayout = await page.evaluate(() => {
      const cockpit = document.querySelector("#opseduCockpit").getBoundingClientRect();
      const ribbon = document.querySelector(".opsedu-ribbon-row");
      const primary = document.querySelector("#opseduPrimaryBuckets");
      const packages = document.querySelector("#opseduActionPackages");
      const split = document.querySelector(".opsedu-split-workspace").getBoundingClientRect();
      const context = document.querySelector(".opsedu-context-pane").getBoundingClientRect();
      const queue = document.querySelector(".opsedu-queue-pane").getBoundingClientRect();
      const cards = Array.from(document.querySelectorAll("#opseduActionPackages .opsedu-action-card")).map((card) => card.getBoundingClientRect());
      return {
        cockpitHeight: cockpit.height,
        cockpitBottom: cockpit.bottom,
        primaryCount: document.querySelectorAll("#opseduPrimaryBuckets [data-opsedu-primary-bucket]").length,
        packageCount: cards.length,
        primaryOverflow: primary.scrollWidth > primary.clientWidth,
        packageOverflow: packages.scrollWidth > packages.clientWidth,
        sameRibbon: Math.abs(primary.getBoundingClientRect().top - packages.getBoundingClientRect().top) <= 2,
        ribbonOverflow: ribbon.scrollWidth > ribbon.clientWidth,
        cardBottoms: cards.map((card) => card.bottom),
        contextRatio: context.width / split.width,
        queueRatio: queue.width / split.width
      };
    });
    assert.equal(cockpitLayout.primaryCount, 8, "all eight primary buckets must render in the OPS ribbon");
    assert.equal(cockpitLayout.cardBottoms.length, 2, "active primary bucket work packages must render as visible cockpit cards");
    assert.equal(cockpitLayout.packageCount, 2, "READY packages must remain visible beside the primary states");
    assert.equal(cockpitLayout.sameRibbon, true, "primary states and selected packages must occupy one ribbon row");
    assert.equal(cockpitLayout.primaryOverflow, false, "primary state ribbon must not require hidden horizontal scroll");
    assert.equal(cockpitLayout.packageOverflow, false, "selected packages must not require hidden horizontal scroll");
    assert.equal(cockpitLayout.ribbonOverflow, false, "OPS ribbon must not require hidden horizontal scroll");
    assert(cockpitLayout.cockpitHeight <= 125, "OPS ribbon must remain within the compact 100-120px target range");
    assert(cockpitLayout.contextRatio >= 0.26 && cockpitLayout.contextRatio <= 0.34, "context pane must remain near the approved 28/72 to 32/68 split");
    assert(cockpitLayout.queueRatio >= 0.66, "applicant queue must remain the dominant workspace");
    assert.equal(cockpitLayout.cardBottoms.every((bottom) => bottom <= cockpitLayout.cockpitBottom), true, "cockpit must not clip its action cards");
    await page.locator('#opseduActionPackages [data-opsedu-package="FODE:READY:PAYMENT_FOLLOW_UP"]').click();
    await settled(page);
    assert.equal(await page.evaluate(() => window.EduOpsApp.state.worklistKey), "PAYMENT_FOLLOW_UP", "card click transports the exact backend worklist binding");
    assert.equal(await page.evaluate(() => window.EduOpsApp.state.actionabilityState), "READY", "card click transports the exact backend actionability binding");
    assert.equal(await page.locator("#eduopsVisibleRange").innerText(), "Showing 1-1 of 1");
    assert.equal(await page.locator("#eduopsWorklistRows [data-applicant-row]").getAttribute("data-applicant-row"), "FODE-26-000253", "Waffi-like payment follow-up fixture lands in the exact queue without search");
    assert.equal(await page.evaluate(() => window.__executeCalls), 0, "cockpit navigation never executes a communication or mutation");
    await page.locator('[data-opsedu-primary-bucket="AWAITING_APPLICANT"]').click();
    await page.waitForFunction(() => document.querySelector("#eduopsApp")?.getAttribute("aria-busy") === "false" && document.querySelector("#eduopsVisibleRange")?.textContent === "Showing 0-0 of 0", null, { timeout: 30000 });
    assert.equal(await page.locator("#eduopsVisibleRange").innerText(), "Showing 0-0 of 0", "empty primary bucket clears the visible workload range");
    assert.equal(await page.locator("#eduopsWorklistRows [data-applicant-row]").count(), 0, "empty primary bucket clears stale applicant rows");
    assert.equal(await page.locator("#opseduActionPackages .opsedu-action-card").count(), 0, "empty primary bucket clears stale package cards");
    assert.equal(await page.locator("#eduopsOpenBatch").isDisabled(), true, "empty primary bucket leaves batch disabled");
    assert.equal(await page.evaluate(() => Object.keys(window.EduOpsApp.state.selected).filter((key) => window.EduOpsApp.state.selected[key]).length), 0, "empty primary bucket clears selected applicants");
    assert.equal(await page.evaluate(() => Object.keys(window.EduOpsApp.state.selectionExcluded).filter((key) => window.EduOpsApp.state.selectionExcluded[key]).length), 0, "empty primary bucket clears exclusions");
    await page.evaluate(() => { window.EduOpsApp.state.actionabilityState = "READY"; window.EduOpsApp.state.worklistKey = ""; return window.EduOpsApp.requestWorkload({ resetPage: true }); });
    await settled(page);
    const originalWorkload = await page.evaluate(() => JSON.parse(JSON.stringify(window.EduOpsApp.state.workload)));
    await page.evaluate((workload) => window.EduOpsApp.renderWorkload(Object.assign({}, workload, { runtime: {} }), 0), originalWorkload);
    assert.equal(await page.locator("#eduopsOperationalClassification").innerText(), "Runtime identity unavailable.");
    assert.equal(await page.locator("#eduopsRuntimeIdentity").innerText(), "Runtime identity unavailable.");
    assert.equal(await page.locator("#eduopsReleaseSnapshotIdentity").innerText(), "Snapshot SNAP-INTEGRATED", "response-level snapshot identity remains rendered when runtime snapshot fields are absent");
    await page.evaluate((workload) => window.EduOpsApp.renderWorkload(workload, 0), originalWorkload);

    await page.evaluate((workload) => window.EduOpsApp.renderWorkload(Object.assign({}, workload, { presentation: null }), 0), originalWorkload);
    assert.equal(await page.locator("#eduopsVisibleRange").innerText(), "Workload unavailable", "missing workload/actionability projection fails closed");
    await page.evaluate((workload) => window.EduOpsApp.renderWorkload(workload, 0), originalWorkload);
    for (const missingField of ["lifecycle", "finance", "documents", "actionability"]) {
      await page.evaluate(({ workload, field }) => {
        const changed = JSON.parse(JSON.stringify(workload));
        delete changed.rows[0].presentation[field];
        window.EduOpsApp.renderWorkload(changed, 0);
      }, { workload: originalWorkload, field: missingField });
      const domain = missingField === "lifecycle" ? "lifecycle state" : missingField === "documents" ? "document state" : missingField === "actionability" ? "state" : missingField;
      assert.match(await page.locator('#eduopsWorklistRows tr[data-applicant-row="FODE-26-000001"]').innerText(), new RegExp(`Authoritative ${domain} decision was not returned`, "i"), `missing ${missingField} DTO is visibly fail closed`);
    }
    await page.evaluate((workload) => {
      const changed = JSON.parse(JSON.stringify(workload));
      delete changed.rows[0].authorityDecision;
      window.EduOpsApp.renderWorkload(changed, 0);
    }, originalWorkload);
    assert.equal(await page.locator('#eduopsWorklistRows tr[data-applicant-row="FODE-26-000001"] [data-select-applicant]').isDisabled(), true, "missing row authority decision disables selection");
    await page.evaluate((workload) => window.EduOpsApp.renderWorkload(workload, 0), originalWorkload);

    await page.locator('#eduopsActionNav button[data-state="COOLING_OFF"]').click();
    await settled(page);
    assert.match(await page.locator("#eduopsSelectedStateLabel").innerText(), /Recently contacted.*waiting period/i);
    const coolingRow = page.locator('#eduopsWorklistRows tr[data-applicant-row="FODE-26-000002"]');
    const coolingText = await coolingRow.innerText();
    assert.match(coolingText, /Payment pending/i, "underlying payment-pending lifecycle must remain visible");
    assert.match(coolingText, /Finance: Payment pending/i, "underlying PAYMENT_PENDING finance state must remain visible");
    assert.match(coolingText, /Recently contacted.*waiting period|Cooling off/i, "COOLING_OFF authority state must remain visible");
    assert.match(coolingText, /Payment follow-up after 20 July 2026/i, "payment follow-up must remain the next action");
    assert.match(coolingText, /Next-action date: 2026-07-20T00:00:00.000Z/, "future next-action date must be visible");
    assert.match(coolingText, /Recently contacted.*waiting period until 2026-07-20T00:00:00.000Z/i, "future cooling-off expiry must be visible");
    await page.locator('#eduopsActionNav button[data-state="READY"]').click();
    await settled(page);

    const firstCheckbox = page.locator("#eduopsWorklistRows [data-select-applicant]").first();
    await seedExecutableAuthority(page);
    await firstCheckbox.check();
    await assertAuthorityInvalidated(page, "select");
    await seedExecutableAuthority(page);
    await firstCheckbox.uncheck();
    await assertAuthorityInvalidated(page, "deselect");

    await page.locator("#eduopsSelectAllMatching").click();
    assert.equal(await page.evaluate(() => window.EduOpsApp.state.selectionMode), "ALL_ELIGIBLE_MATCHING_QUERY");
    await page.locator("#eduopsSort").selectOption({ index: 1 });
    await settled(page);
    assert.equal(await page.evaluate(() => window.EduOpsApp.state.selectionMode), "ALL_ELIGIBLE_MATCHING_QUERY", "sorting preserves server-bound selection");

    await seedExecutableAuthority(page);
    await firstCheckbox.uncheck();
    assert.equal(await page.evaluate(() => Object.keys(window.EduOpsApp.state.selectionExcluded).length), 1);
    assert.equal(await page.evaluate(() => window.EduOpsApp.state.selectionMode), "ALL_ELIGIBLE_MATCHING_QUERY", "query-wide deselection must remain query-wide");
    await assertAuthorityInvalidated(page, "exclude");
    await seedExecutableAuthority(page);
    await firstCheckbox.check();
    assert.equal(await page.evaluate(() => Object.keys(window.EduOpsApp.state.selectionExcluded).length), 0);
    await assertAuthorityInvalidated(page, "restore");

    const availability = await page.evaluate(() => {
      const app = window.EduOpsApp; const projected = app.state.operationAvailability;
      app.state.operationAvailability = {};
      const missing = { available: app.operationAvailable("BATCH_COMMUNICATION"), reason: app.operationUnavailableReason("BATCH_COMMUNICATION") };
      app.state.operationAvailability = projected;
      return missing;
    });
    assert.equal(availability.available, false, "missing backend operation availability must fail closed in the browser");
    assert.match(availability.reason, /Authoritative operation availability was not returned/);

    await page.locator("#eduopsOpenBatch").click();
    assert.equal(await page.locator("[data-batch-execution-limit]").inputValue(), "", "execution limit is not defaulted");
    assert.equal(await page.locator("[data-batch-template]").inputValue(), "", "communication is not preselected");
    await page.locator("[data-batch-execution-limit]").selectOption("10");
    await page.waitForSelector('[data-batch-template-card="docs_missing"]');
    assert.equal(await page.locator('[data-batch-template-card="application_portal_invitation"]').isDisabled(), true);
    assert.match(await page.locator('[data-batch-template-card="application_portal_invitation"]').innerText(), /No applicant.*authorised/);
    assert.equal(await page.locator('[data-batch-template-card="retired_notice"]').count(), 0);
    assert.match(await page.locator('[data-batch-template-card="docs_missing"]').innerText(), /Recommended/);
    assert.doesNotMatch(await page.locator("#eduopsBatchWorkspace").innerText(), /Legacy Invite|legacy_invite/);

    await page.locator("[data-batch-template]").selectOption("docs_missing");
    assert.match(await page.locator("#eduopsBatchPanel").innerText(), /Server-authorised recipients: 10/);
    assert.equal(await page.evaluate(() => window.EduOpsApp.state.batch.templateId), "docs_missing");
    await page.locator("[data-batch-preview]").click();
    await page.waitForSelector("[data-batch-continue]");
    assert.match(await page.locator("#eduopsBatchOperationStatus").innerText(), /Preview ready/);
    assert.doesNotMatch(await page.locator("#eduopsBatchWorkspace").innerText(), /Pending preview|Confirmed execution/);
    await page.locator("[data-batch-continue]").click();
    assert.equal(await page.locator("#eduopsBatchPanel input[readonly]").nth(1).inputValue(), "FODE KIA Application - Missing Documents");
    assert.match(await page.locator("#eduopsBatchPanel textarea[readonly]").inputValue(), /Please provide the missing documents/);
    assert.match(await page.locator("#eduopsBatchOperationStatus").innerText(), /Preview ready/);

    await page.locator("[data-batch-confirm]").click();
    assert.match(await page.locator("#eduopsBatchOperationStatus").innerText(), /Preview ready/);
    assert.equal(await page.locator("#eduopsBatchExecutionStatus").innerText(), "Execution: No execution performed");
    assert.match(await page.locator("[data-batch-execute]").innerText(), /Send Missing Documents Follow-up to 10 recipients/);
    assert.equal(await page.evaluate(() => window.__executeCalls), 0, "browser acceptance must not send");

    await page.locator("[data-batch-back]").click();
    await page.locator("[data-batch-back]").click();
    await page.locator("[data-batch-back]").click();
    await seedExecutableAuthority(page);
    await page.locator("[data-batch-template]").selectOption("payment_followup");
    await assertAuthorityInvalidated(page, "template change");
    assert.match(await page.locator("#eduopsBatchPanel").innerText(), /Server-authorised recipients: 2/);
    await seedExecutableAuthority(page);
    await page.locator("[data-batch-execution-limit]").selectOption("30");
    await page.waitForFunction(() => window.EduOpsApp.state.batch.catalogue && window.EduOpsApp.state.batch.catalogue.executionLimit === 30);
    assert.equal(await page.evaluate(() => window.EduOpsApp.state.batch.binding.executionLimit), 30);
    await assertAuthorityInvalidated(page, "execution-limit change");

    await page.evaluate(() => {
      window.EduOpsApp.state.communicationDraft = { applicantId: "FODE-26-000001", templateId: "custom_email", messageType: "custom_email", subject: "Original subject", body: "Original body" };
      document.getElementById("eduopsWorkbenchPanel").innerHTML = '<input id="eduopsCommSubject" value="Original subject"><textarea id="eduopsCommBody">Original body</textarea>';
    });
    await seedExecutableAuthority(page);
    await page.evaluate(() => { const field = document.getElementById("eduopsCommSubject"); field.value = "Changed subject"; field.dispatchEvent(new Event("input", { bubbles: true })); });
    await assertAuthorityInvalidated(page, "subject edit");
    await seedExecutableAuthority(page);
    await page.evaluate(() => { const field = document.getElementById("eduopsCommBody"); field.value = "Changed body"; field.dispatchEvent(new Event("input", { bubbles: true })); });
    await assertAuthorityInvalidated(page, "body edit");
    assert.equal(await page.evaluate(() => window.__executeCalls), 0);
    assert.deepEqual(pageErrors, []);

    console.log("PASS integrated authority browser/RPC path templates=complete queryWide=true recipients=exact preview=true send=false");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
