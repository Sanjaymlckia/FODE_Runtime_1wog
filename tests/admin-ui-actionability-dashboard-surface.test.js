const fs = require("node:fs");
const assert = require("node:assert/strict");

const adminUi = fs.readFileSync("AdminUI.html", "utf8");
const adminJs = fs.readFileSync("Admin.js", "utf8");

function indexOfRequired(needle) {
  const index = adminUi.indexOf(needle);
  assert.notEqual(index, -1, `Missing expected AdminUI surface marker: ${needle}`);
  return index;
}

const dashboardIndex = indexOfRequired('id="actionabilityPreviewPanel"');
const reviewQueuesIndex = indexOfRequired('id="reviewQueuesPanel"');
assert.ok(dashboardIndex < reviewQueuesIndex, "Operations Workspace must render before Review Queues");
assert.ok(adminUi.includes("Operations Workspace"), "Promoted operator surface must use the Operations Workspace label");
assert.doesNotMatch(adminUi, /Actionability Dashboard/i, "Old Actionability Dashboard heading must not remain visible in AdminUI");
assert.ok(adminUi.includes("Operations Workspace is the primary workload surface"), "Operations Workspace must be described as the primary workload surface");
assert.doesNotMatch(adminUi, /Review Queues remains the primary action surface/i, "Review Queues must not claim primary action-surface authority");
assert.doesNotMatch(adminUi, /Secondary Navigation: Review Queues/i, "Review Queues heading must not visually compete as secondary navigation");
assert.ok(adminUi.includes("Compatibility: Review Queues"), "Review Queues must remain available as a compatibility surface");
assert.ok(adminUi.includes("Review Queues remain available for compatibility and existing review workflows"), "Review Queues compatibility wording must be explicit");
assert.ok(adminUi.includes("Global View"), "Operations Workspace must expose the Global View shell");
assert.ok(adminUi.includes("Operator View"), "Operations Workspace must expose the Operator View shell");
assert.ok(adminUi.includes("Operator View scoping is pending; no backend filter is applied"), "Operator View shell must not imply backend filtering exists");
assert.match(adminUi, /data-actionability-view="global"/, "View shell must preserve actionability-scoped internal naming");
assert.match(adminUi, /data-actionability-view="operator"[^>]*disabled/, "Operator View must stay disabled until backend scoping exists");
assert.ok(adminUi.includes("What needs work next."), "Operations Workspace role must be clear");
assert.ok(adminUi.includes("Population and state visibility."), "Lifecycle Map role must be clear");
assert.ok(adminUi.includes("Authoritative editing modal."), "Review Workspace role must be clear");
assert.ok(adminUi.includes("Diagnostics and automation state."), "System Health role must be clear");

const kpiIndex = indexOfRequired('id="actionabilityKpiStrip"');
const summaryIndex = indexOfRequired('id="actionabilityPreviewSummary"');
assert.ok(kpiIndex > dashboardIndex, "KPI strip must live inside the promoted dashboard");
assert.ok(kpiIndex < summaryIndex, "KPI strip must render above dashboard group summaries");

[
  "Applicant Action",
  "Admissions Review",
  "Finance",
  "Academic Admin",
  "Exceptions",
  "Dormant",
  "Completed / No Action"
].forEach((label) => {
  assert.ok(adminUi.includes(label), `KPI responsibility bucket must be present: ${label}`);
});
assert.match(adminUi, /key === "MANAGEMENT" \? "Exceptions"/, "KPI strip must shorten Management Exceptions to Exceptions");
assert.match(adminUi, /<button class="actionabilityKpi/, "KPI cards must render as actionable buttons");
assert.match(adminUi, /onclick="selectActionabilityGroup_/, "KPI/group cards must select an actionability group");

["APPLICANT", "ADMISSIONS", "FINANCE", "ACADEMIC", "MANAGEMENT", "DORMANT", "COMPLETE"].forEach((key) => {
  assert.ok(adminUi.includes(`data-actionability-kpi="' + esc(key) + '"`) || adminUi.includes(`data-actionability-kpi="${key}"`), `KPI bucket key must be rendered: ${key}`);
});

assert.doesNotMatch(adminUi, /Read-Only Experimental|Experimental Actionability|Actionability Preview/i, "Promoted dashboard must not expose experimental preview wording");
assert.match(adminUi, /function reviewActionabilityRow_/, "Dashboard Review button must keep existing modal entry function");
assert.match(adminUi, /reviewActionabilityRow_\('[^']*'|reviewActionabilityRow_\(\s*'?\s*\+ String\(index\)/, "Dashboard rows must render Review actions");
assert.match(adminUi, /actionabilityRenderedRows/, "Dashboard Review buttons must use the currently rendered row list");
assert.match(adminUi, /class="btn actionabilityReviewBtn"/, "Dashboard Review button must use the emphasized operator action style");
assert.match(adminUi, /review\([^;]+actionabilityFocus:\s*true/, "Dashboard Review must explicitly mark actionability-origin focus requests");
assert.match(adminUi, /function clearPendingActionabilityReviewContext_/, "Dashboard Review focus context must have an explicit clear helper");
assert.match(adminUi, /pendingCtx\.requestId\s*=\s*reqId/, "Dashboard Review focus context must bind to the current detail request id");
assert.match(adminUi, /focusActionabilityReviewTarget_\(d\)/, "Dashboard focus must validate against the opened detail record");
assert.match(adminUi, /ctxId\s*&&\s*detailId\s*&&\s*ctxId\s*!==\s*detailId/, "Dashboard focus must ignore applicant mismatches");
assert.match(adminUi, /clearPendingActionabilityReviewContext_\(reqId\)/, "Dashboard focus context must clear on stale or failed detail requests");
assert.match(adminUi, /reviewOpts\.actionabilityFocus\s*===\s*true[\s\S]+clearPendingActionabilityReviewContext_\(\)/, "Normal Review calls must clear stale dashboard focus context");

const renderBody = adminUi.slice(indexOfRequired("function renderActionabilityPreview_"), indexOfRequired("function reviewActionabilityRow_"));
assert.doesNotMatch(renderBody, /esc\(\s*r\.recommendedMessageType\s*\)/, "Rows must render communication labels, not raw message type identifiers");
assert.doesNotMatch(renderBody, /esc\(\s*r\.(?:templateId|Template_ID)\s*\)/i, "Rows must not render raw template identifiers");
assert.doesNotMatch(renderBody, /INVALID_EMAIL|NO_EFFECTIVE_EMAIL/, "Rows must not render raw contactability codes");
assert.doesNotMatch(renderBody, /html\s*\+=\s*['"][\s\S]{0,120}admin_/i, "Rows must not render internal function names");
assert.match(adminUi, /function actionabilityDocumentLabel_/, "Dashboard must normalize document field keys before display");
assert.match(adminUi, /missing\.slice\(0,\s*2\)\.map\(actionabilityDocumentLabel_/, "Dashboard blocker labels must not render raw document field keys");

assert.match(adminJs, /hasPhoneFallback/, "Actionability payload must expose phone fallback availability");
assert.match(adminJs, /contactabilityState: isUncontactable \? "UNCONTACTABLE"/, "Actionability payload must classify no-email/no-phone applicants as uncontactable");
assert.match(adminUi, /return "Uncontactable"/, "Dashboard priority language must show Uncontactable");
assert.match(adminUi, /return "Contact details required"/, "Dashboard due language must replace urgent due text for uncontactable applicants");
assert.match(adminUi, /return "No email, no phone"/, "Dashboard blocker must show no-email/no-phone facts");
assert.match(adminUi, /return "Contactability Gate"/, "Dashboard authority must show Contactability Gate");

console.log("PASS Operations Workspace is primary above Review Queues");
console.log("PASS Operations Workspace role wording, compatibility Review Queues, and view shell are present");
console.log("PASS KPI strip renders actionable responsibility buckets above dashboard groups");
console.log("PASS experimental/internal/contactability codes remain hidden from dashboard rows");
console.log("PASS dashboard Review action keeps existing modal entry from rendered rows");
console.log("PASS dashboard Review focus context is request-bound and cleared on stale paths");
console.log("PASS no-contact applicants render Uncontactable / Contactability Gate language");
