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
assert.ok(adminUi.includes("Primary workload surface for today's work, ownership, blockers, priority, and next action"), "Operations Workspace must be described as the primary workload surface");
assert.ok(adminUi.includes("Review Workspace remains the primary editing authority"), "Review Workspace must be described as the editing authority");
assert.doesNotMatch(adminUi, /Review Queues remains the primary action surface/i, "Review Queues must not claim primary action-surface authority");
assert.doesNotMatch(adminUi, /Secondary Navigation: Review Queues/i, "Review Queues heading must not visually compete as secondary navigation");
assert.ok(adminUi.includes("Compatibility: Review Queues"), "Review Queues must remain available as a compatibility surface");
assert.ok(adminUi.includes("Review Queues remain available for compatibility and existing review workflows"), "Review Queues compatibility wording must be explicit");
assert.match(adminUi, /<details id="reviewQueuesPanel"[^>]*>/, "Review Queues must be a collapsed details surface");
assert.doesNotMatch(adminUi, /<details id="reviewQueuesPanel"[^>]*\sopen\b/, "Review Queues must be collapsed by default");
assert.ok(adminUi.includes("Advanced Diagnostics / Legacy Panels"), "Legacy/supporting panels must be grouped under Advanced Diagnostics");
assert.match(adminUi, /<details id="advancedDiagnosticsPanel"[^>]*>/, "Advanced Diagnostics must be a collapsed details surface");
assert.doesNotMatch(adminUi, /<details id="advancedDiagnosticsPanel"[^>]*\sopen\b/, "Advanced Diagnostics must be collapsed by default");
assert.ok(adminUi.includes("Global View: Current workload"), "Operations Workspace must expose the Global View shell");
assert.ok(adminUi.includes("Operator View: Coming soon"), "Operations Workspace must expose the Operator View shell");
assert.ok(adminUi.includes("Operator-scoped workload is planned; no backend filter is applied"), "Operator View shell must not imply backend filtering exists");
assert.match(adminUi, /data-actionability-view="global"/, "View shell must preserve actionability-scoped internal naming");
assert.match(adminUi, /data-actionability-view="operator"[^>]*disabled/, "Operator View must stay disabled until backend scoping exists");
assert.ok(adminUi.includes("What requires work today."), "Operations Workspace role must be clear");
assert.ok(adminUi.includes("Where applicants are."), "Lifecycle Map role must be clear");
assert.ok(adminUi.includes("Authoritative editing modal."), "Review Workspace role must be clear");
assert.ok(adminUi.includes("Troubleshooting and automation state."), "System Health role must be clear");

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
assert.match(adminUi, /var displayRows = actionabilityActiveGroup \? \(groupRows\[actionabilityActiveGroup\] \|\| \[\]\) : rows;/, "KPI/group filters must still drive displayed worklist rows");

["APPLICANT", "ADMISSIONS", "FINANCE", "ACADEMIC", "MANAGEMENT", "DORMANT", "COMPLETE"].forEach((key) => {
  assert.ok(adminUi.includes(`data-actionability-kpi="' + esc(key) + '"`) || adminUi.includes(`data-actionability-kpi="${key}"`), `KPI bucket key must be rendered: ${key}`);
});

assert.doesNotMatch(adminUi, /Read-Only Experimental|Experimental Actionability|Actionability Preview/i, "Promoted dashboard must not expose experimental preview wording");
assert.match(adminUi, /function reviewActionabilityRow_/, "Dashboard Review button must keep existing modal entry function");
assert.match(adminUi, /reviewActionabilityRow_\('[^']*'|reviewActionabilityRow_\(\s*'?\s*\+ String\(index\)/, "Dashboard rows must render Review actions");
assert.match(adminUi, /actionabilityRenderedRows/, "Dashboard Review buttons must use the currently rendered row list");
assert.match(adminUi, /class="btn actionabilityReviewBtn"/, "Dashboard Review button must use the emphasized operator action style");
assert.match(adminUi, /Current Worklist/, "Operations Workspace must label the dense worklist");
assert.match(adminUi, /class="actionabilityWorklist"/, "Applicant rows must render in the OPS-style worklist structure");
assert.match(adminUi, /role="table" aria-label="Operations Workspace Current Worklist"/, "Worklist must use a predictable table/list geometry");
assert.match(adminUi, /class="actionabilityWorklistRow" role="row" data-actionability-row=/, "Applicant rows must render as fixed worklist rows");
assert.doesNotMatch(renderActionabilityRowBody_(), /class="actionabilityTask"/, "Applicant rows must not render as the old irregular card blocks");
assert.match(adminUi, /actionabilityStatusChips/, "Dashboard rows must expose compact status chips");
assert.doesNotMatch(adminUi, /\.actionabilityWorklist\{[^}]*overflow-x:auto/, "Primary worklist must not require horizontal scrolling");
assert.doesNotMatch(adminUi, /\.actionabilityWorklistTable\{[^}]*min-width:/, "Primary worklist table must not force horizontal overflow");
["Applicant", "Ownership", "Progress", "Timeline"].forEach((label) => {
  assert.ok(adminUi.includes(`class="actionabilityClusterLabel">${label}</span>`), `Worklist must cluster operator facts under ${label}`);
});
assert.match(adminUi, /actionabilityReviewCell[\s\S]+actionabilityReviewBtn/, "Review must remain a dedicated visible action column");
assert.doesNotMatch(renderActionabilityRowBody_(), /<strong>Invoice:<\/strong> <span>Not shown<\/span>|<strong>CRM:<\/strong> <span>Not shown<\/span>/, "Dashboard rows must not spend scan space on Not shown filler facts");
[
  ["applicantId", "Applicant ID"],
  ["name", "Applicant Name"],
  ["owner", "Owner"],
  ["nextAction", "Next Action"],
  ["docs", "Docs"],
  ["payment", "Payment"],
  ["contact", "Contact"],
  ["age", "Age / Last"],
  ["due", "Due / Next"]
].forEach(([key, label]) => {
  assert.match(adminUi, new RegExp(`sortHeader\\("${key}", "${label}"\\)`), `Sortable header must exist for ${label}`);
  assert.match(adminUi, /data-actionability-sort="' \+ esc\(key\) \+ '"/, `Sort data attribute must be rendered for ${label}`);
  assert.match(adminUi, /onclick="sortActionabilityPreview_/, `Sort action must be wired for ${label}`);
});
["applicantId", "docs", "payment", "contact", "due"].forEach((key) => {
  assert.match(adminUi, new RegExp(`state\\.key === "${key}"`), `Sorter must implement ${key}`);
});
assert.match(adminUi, /review\([^;]+actionabilityFocus:\s*true/, "Dashboard Review must explicitly mark actionability-origin focus requests");
assert.match(adminUi, /function clearPendingActionabilityReviewContext_/, "Dashboard Review focus context must have an explicit clear helper");
assert.match(adminUi, /pendingCtx\.requestId\s*=\s*reqId/, "Dashboard Review focus context must bind to the current detail request id");
assert.match(adminUi, /focusActionabilityReviewTarget_\(d\)/, "Dashboard focus must validate against the opened detail record");
assert.match(adminUi, /ctxId\s*&&\s*detailId\s*&&\s*ctxId\s*!==\s*detailId/, "Dashboard focus must ignore applicant mismatches");
assert.match(adminUi, /clearPendingActionabilityReviewContext_\(reqId\)/, "Dashboard focus context must clear on stale or failed detail requests");
assert.match(adminUi, /reviewOpts\.actionabilityFocus\s*===\s*true[\s\S]+clearPendingActionabilityReviewContext_\(\)/, "Normal Review calls must clear stale dashboard focus context");

function renderActionabilityRowBody_() {
  return adminUi.slice(indexOfRequired("function renderActionabilityPreview_"), indexOfRequired("function reviewActionabilityRow_"));
}

const renderBody = renderActionabilityRowBody_();
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
