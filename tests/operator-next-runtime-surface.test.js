const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const operatorNextUi = fs.readFileSync("AdminUI_OperatorNext.html", "utf8");
const adminUi = fs.readFileSync("AdminUI.html", "utf8");
const adminJs = fs.readFileSync("Admin.js", "utf8");
const codeJs = fs.readFileSync("Code.js", "utf8");
const claspIgnore = fs.readFileSync(".claspignore", "utf8");

function scriptFromHtml(source) {
  return Array.from(source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi), (match) => match[1]).join("\n");
}

function htmlEscape(value) {
  return String(value == null ? "" : value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

const script = scriptFromHtml(operatorNextUi);
assert.doesNotThrow(() => new vm.Script(script, { filename: "AdminUI_OperatorNext.script.js" }));

const expectedRoutes = [
  "lifecycle", "dashboard", "applicant", "admissions", "communications", "finance",
  "portal", "contactability", "registry", "exceptions", "reports", "health", "roles"
];
for (const route of expectedRoutes) {
  assert.match(operatorNextUi, new RegExp(`id="onxRoute-${route}"`), `Operator Next must expose ${route}`);
}

assert.match(codeJs, /route === "operator-next"\) return renderAdminApp_;/, "Operator Next must use the authenticated Admin renderer");
assert.match(adminUi, /createHtmlOutputFromFile\('AdminUI_OperatorNext'\)/, "Admin must include the parallel Operator Next shell");
assert.match(claspIgnore, /!AdminUI_OperatorNext\.html/, "Operator Next must be in the deployable Apps Script contract");
assert.match(adminJs, /requestedView === "operator-next" \? " - Operator Next"/, "Operator Next must have a distinct document title");
assert.match(adminUi, /wrap\.classList\.toggle\("hiddenView", opsActive \|\| operatorNextActive\)/, "Operator Next must not replace the current Admin DOM");
assert.match(adminUi, /if \(typeof operatorNextIsActive_[\s\S]*operatorNextInit_\(\);[\s\S]*return;/, "Operator Next must have a lazy, route-specific startup branch");
assert.match(adminUi, /fetchRuntimeInfo_\(\);[\s\S]*loadReviewQueues\(\);[\s\S]*loadActionabilityPreview_\(\);/, "Current Admin and OPS startup must remain available");

[
  "resolveCanonicalApplicantLifecycle_",
  "deriveApplicantLifecycleStage_",
  "resolveActionabilityState_",
  "deriveApplicantActionability_",
  "evaluateCommunicationAuthority_",
  "communicationRecommendedMessageTypeForStage_",
  "admin_sendApplicantMessage",
  "admin_sendSelectedApplicantBatch",
  "admin_sendStageBatch"
].forEach((authorityFunction) => {
  assert.doesNotMatch(operatorNextUi, new RegExp(`\\b${authorityFunction}\\b`), `Operator Next must not own ${authorityFunction}`);
});

assert.match(operatorNextUi, /row\.canonicalLifecycle&&row\.canonicalLifecycle\.baseState/, "Lifecycle cards must consume canonical lifecycle DTO output");
assert.doesNotMatch(operatorNextUi, /operatorNextCompatibilityCountFor_/, "Global compatibility counts must not be translated into canonical lifecycle labels in the client");
assert.match(operatorNextUi, /Global View - canonical summary pending/, "Global View must be explicitly contained until a canonical full-population summary exists");
assert.match(operatorNextUi, /Full-population canonical lifecycle counts are not yet available\. Working View remains authoritative\./, "Global View must explain why it is unavailable");
assert.match(operatorNextUi, /function operatorNextContainGlobalView_/, "Global View containment must be enforced by a dedicated helper");
assert.doesNotMatch(operatorNextUi, /admin_getOpsLifecycleSummary\(\{force:0\}\)/, "Contained Global View must not fetch OPS compatibility summary");
assert.match(operatorNextUi, /row&&row\.selectable===true/, "Selection must consume server Actionability selectable");
assert.match(operatorNextUi, /review\(Number\(row\.rowNumber\|\|0\)\|\|null,String\(row\.applicantId\|\|''\),null,\{actionabilityFocus:true\}\)/, "Review handoff must preserve exact row and Applicant ID");
assert.match(operatorNextUi, /openBatchCommunicationFromSelection_\('selected'\)/, "Batch action must reuse the existing selected-cohort modal path");
assert.match(operatorNextUi, /operatorNextHandleContext_[\s\S]*operatorNextOpenReview_\(row\)/, "Context actions must converge on the visible Review handler");
assert.match(operatorNextUi, /data-onx-more=/, "Every worklist row must expose a non-right-click action alternative");
assert.match(operatorNextUi, /operatorNextCapability_\('CAN_RUN_BATCH_COMMUNICATIONS'\)/, "Batch visibility must consume resolved capabilities");
assert.doesNotMatch(operatorNextUi, /ADMIN_ROLE\s*===|ADMIN_ROLE\s*!==/, "Operator Next must not branch authority directly on role names");

assert.match(operatorNextUi, /id="onxExportVcf"[\s\S]*disabled/, "Unsafe VCF export must remain disabled in Track L");
assert.match(operatorNextUi, /current Actionability DTO does not expose the approved phone number/, "VCF block must expose the exact missing authority contract");
assert.doesNotMatch(operatorNextUi, /admin_exportWhatsAppFallbackCsv|wa\.me|api\.whatsapp|sendWhatsApp/i, "Operator Next must not introduce a WhatsApp send or broad fallback export path");

const calls = [];
const runner = {
  withSuccessHandler(fn) { this.success = fn; return this; },
  withFailureHandler(fn) { this.failure = fn; return this; },
  admin_getRuntimeInfo() { calls.push("admin_getRuntimeInfo"); return this; },
  admin_getOperationalDashboardMetrics() { calls.push("admin_getOperationalDashboardMetrics"); return this; },
  admin_getOperationalSafetyStatus() { calls.push("admin_getOperationalSafetyStatus"); return this; },
  admin_getOpsLifecycleSummary() { calls.push("admin_getOpsLifecycleSummary"); return this; }
};
const documentStub = {
  getElementById() { return null; },
  querySelectorAll() { return []; },
  addEventListener() {}
};
const context = {
  console,
  Date,
  Math,
  Number,
  String,
  Array,
  Object,
  JSON,
  INITIAL_ADMIN_VIEW: "operator-next",
  USER_EMAIL: "principal@kundu.ac",
  ADMIN_ROLE: "OPERATIONS",
  ADMIN_CAPABILITIES: {
    capabilities: {
      CAN_OPEN_REVIEW_WORKSPACE: true,
      CAN_RUN_BATCH_COMMUNICATIONS: true,
      CAN_INSERT_PORTAL_LINK: true,
      CAN_GENERATE_STANDARD_QUOTE: true,
      CAN_GENERATE_STANDARD_INVOICE: true,
      CAN_VERIFY_PAYMENT: false,
      CAN_MANAGE_PORTAL_ACCESS: false,
      CAN_WRITE_ZOHO_BOOKS: false
    }
  },
  WEBAPP_URL: "https://example.invalid/exec",
  document: documentStub,
  window: { scrollTo() {}, innerWidth: 1400, innerHeight: 900, open() {} },
  navigator: { clipboard: { writeText: () => Promise.resolve() } },
  google: { script: { run: runner } },
  esc: htmlEscape,
  loadActionabilityPreview_() { calls.push("admin_getActionabilityPreview"); },
  review(...args) { calls.push({ review: args }); },
  openBatchCommunicationFromSelection_(mode) { calls.push({ batch: mode }); },
  actionabilityRowKey_(row) { return String(row && row.applicantId || ""); },
  actionabilityIsSelectable_(row) { return !!(row && row.selectable === true); },
  actionabilitySelectedKeys: {},
  actionabilityPreviewRows: [],
  actionabilityCurrentCohortRows: [],
  actionabilityRenderedRows: [],
  actionabilitySelectionSource: ""
};
vm.createContext(context);
vm.runInContext(script, context, { filename: "AdminUI_OperatorNext.script.js" });

context.operatorNextInit_();
assert.deepEqual(calls.filter((entry) => typeof entry === "string"), [
  "admin_getActionabilityPreview",
  "admin_getRuntimeInfo"
], "Initial hydration must load only Actionability and runtime identity");
assert.ok(!calls.includes("admin_getOpsLifecycleSummary"), "Initial hydration must not load OPS compatibility summary");
context.operatorNextActivateRoute_("dashboard");
assert.ok(calls.includes("admin_getOperationalDashboardMetrics"), "Dashboard metrics must lazy-load on route activation");
assert.ok(!calls.includes("admin_getOperationalSafetyStatus"), "Health diagnostics must stay deferred until the Health route");
context.operatorNextActivateRoute_("health");
assert.ok(calls.includes("admin_getOperationalSafetyStatus"), "Health diagnostics must load on demand");
context.operatorNextShowGlobalCompatibility_();
assert.ok(!calls.includes("admin_getOpsLifecycleSummary"), "Programmatic Global View activation must remain contained");

const waffi = {
  rowNumber: 2959,
  applicantId: "FODE-26-002959",
  name: "Keziah Waffi",
  workloadGroupKey: "FINANCE",
  worklistKey: "PAYMENT_FOLLOW_UP",
  worklistLabel: "Payment Follow-up",
  worklistReason: "Awaiting payment evidence",
  nextAction: "SEND_PAYMENT_REMINDER",
  actionOwner: "APPLICANT",
  actionabilityState: "READY",
  selectable: true,
  recommendedMessageType: "payment_followup",
  canonicalLifecycle: { baseState: "PAYMENT_PENDING", overlays: [] }
};
const stephanie = {
  rowNumber: 3230,
  applicantId: "FODE-26-003230",
  name: "Stephanie Duba",
  workloadGroupKey: "APPLICANT",
  worklistKey: "MISSING_DOCUMENTS",
  worklistLabel: "Missing Documents",
  worklistReason: "Required documents are incomplete",
  nextAction: "UPLOAD_REQUIRED_DOCUMENTS",
  actionOwner: "APPLICANT",
  actionabilityState: "READY",
  selectable: true,
  recommendedMessageType: "docs_missing",
  canonicalLifecycle: { baseState: "INCOMPLETE_DOCUMENTS", overlays: ["REMINDER_DUE"] }
};
const coolingOff = {
  rowNumber: 4000,
  applicantId: "FODE-26-COOLING",
  name: "Cooling Off Applicant",
  workloadGroupKey: "APPLICANT",
  worklistKey: "MISSING_DOCUMENTS",
  nextAction: "UPLOAD_REQUIRED_DOCUMENTS",
  actionabilityState: "COOLING_OFF",
  selectable: false,
  selectBlockReason: "Cooling-off active until tomorrow",
  recommendedMessageType: "docs_missing",
  canonicalLifecycle: { baseState: "INCOMPLETE_DOCUMENTS", overlays: ["COOLING_OFF"] }
};

context.operatorNextState_.rows = [waffi, stephanie, coolingOff];
context.operatorNextState_.selected = { [waffi.applicantId]: true, [stephanie.applicantId]: true, [coolingOff.applicantId]: true };
const queueHtml = context.operatorNextQueueHtml_([waffi, stephanie, coolingOff], "fixture");
assert.match(queueHtml, /FODE-26-002959[\s\S]*Payment Follow-up[\s\S]*PAYMENT PENDING[\s\S]*SEND PAYMENT REMINDER[\s\S]*payment_followup/, "Waffi must retain payment authority projection");
assert.match(queueHtml, /FODE-26-003230[\s\S]*Missing Documents[\s\S]*INCOMPLETE DOCUMENTS[\s\S]*UPLOAD REQUIRED DOCUMENTS[\s\S]*docs_missing/, "Stephanie must retain missing-documents authority projection");
assert.match(queueHtml, /FODE-26-COOLING[\s\S]*disabled[\s\S]*Cooling-off active until tomorrow/, "Cooling-off rows must remain visible, explained, and unselectable");

context.operatorNextOpenReview_(waffi);
const reviewCall = calls.find((entry) => entry && entry.review);
assert.deepEqual(reviewCall.review.slice(0, 2), [2959, "FODE-26-002959"], "Review must open the exact Waffi row and Applicant ID");

context.operatorNextOpenBatch_();
const batchCall = calls.find((entry) => entry && entry.batch);
assert.equal(batchCall.batch, "selected", "Operator Next must open the existing selected-cohort Batch Communication path");
assert.deepEqual(Object.keys(context.actionabilitySelectedKeys).sort(), [waffi.applicantId, stephanie.applicantId].sort(), "Batch handoff must exclude server-unselectable rows");

context.operatorNextReceiveActionability_({ rows: [waffi, { ...stephanie, selectable: false, actionabilityState: "COOLING_OFF" }] });
assert.deepEqual(Object.keys(context.operatorNextState_.selected), [waffi.applicantId], "Forced refresh must clear selected IDs that are no longer selectable");

console.log("PASS Operator Next route, authority, and lazy-hydration contract");
console.log("PASS Waffi and Stephanie composed projection fixtures");
console.log("PASS exact Review and selected Batch handler reuse");
console.log("PASS VCF/WhatsApp Track L safety boundary");
