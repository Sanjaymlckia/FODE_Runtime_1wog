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
assert.ok(dashboardIndex < reviewQueuesIndex, "Actionability Dashboard must render before Review Queues");

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

const renderBody = adminUi.slice(indexOfRequired("function renderActionabilityPreview_"), indexOfRequired("function reviewActionabilityRow_"));
assert.doesNotMatch(renderBody, /esc\(\s*r\.recommendedMessageType\s*\)/, "Rows must render communication labels, not raw message type identifiers");
assert.doesNotMatch(renderBody, /esc\(\s*r\.(?:templateId|Template_ID)\s*\)/i, "Rows must not render raw template identifiers");
assert.doesNotMatch(renderBody, /INVALID_EMAIL|NO_EFFECTIVE_EMAIL/, "Rows must not render raw contactability codes");
assert.doesNotMatch(renderBody, /html\s*\+=\s*['"][\s\S]{0,120}admin_/i, "Rows must not render internal function names");

assert.match(adminJs, /hasPhoneFallback/, "Actionability payload must expose phone fallback availability");
assert.match(adminJs, /contactabilityState: isUncontactable \? "UNCONTACTABLE"/, "Actionability payload must classify no-email/no-phone applicants as uncontactable");
assert.match(adminUi, /return "Uncontactable"/, "Dashboard priority language must show Uncontactable");
assert.match(adminUi, /return "Contact details required"/, "Dashboard due language must replace urgent due text for uncontactable applicants");
assert.match(adminUi, /return "No email, no phone"/, "Dashboard blocker must show no-email/no-phone facts");
assert.match(adminUi, /return "Contactability Gate"/, "Dashboard authority must show Contactability Gate");

console.log("PASS Actionability Dashboard is primary above Review Queues");
console.log("PASS KPI strip renders actionable responsibility buckets above dashboard groups");
console.log("PASS experimental/internal/contactability codes remain hidden from dashboard rows");
console.log("PASS dashboard Review action keeps existing modal entry from rendered rows");
console.log("PASS no-contact applicants render Uncontactable / Contactability Gate language");
