const fs = require("node:fs");
const assert = require("node:assert/strict");

const adminUi = fs.readFileSync("AdminUI.html", "utf8");

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

["APPLICANT", "ADMISSIONS", "FINANCE", "ACADEMIC", "MANAGEMENT", "DORMANT", "COMPLETE"].forEach((key) => {
  assert.ok(adminUi.includes(`data-actionability-kpi="' + esc(key) + '"`) || adminUi.includes(`data-actionability-kpi="${key}"`), `KPI bucket key must be rendered: ${key}`);
});

assert.doesNotMatch(adminUi, /Read-Only Experimental|Experimental Actionability|Actionability Preview/i, "Promoted dashboard must not expose experimental preview wording");
assert.match(adminUi, /function reviewActionabilityRow_/, "Dashboard Review button must keep existing modal entry function");
assert.match(adminUi, /reviewActionabilityRow_\('[^']*'|reviewActionabilityRow_\(\s*'?\s*\+ String\(index\)/, "Dashboard rows must render Review actions");

const renderBody = adminUi.slice(indexOfRequired("function renderActionabilityPreview_"), indexOfRequired("function reviewActionabilityRow_"));
assert.doesNotMatch(renderBody, /esc\(\s*r\.recommendedMessageType\s*\)/, "Rows must render communication labels, not raw message type identifiers");
assert.doesNotMatch(renderBody, /esc\(\s*r\.(?:templateId|Template_ID)\s*\)/i, "Rows must not render raw template identifiers");
assert.doesNotMatch(renderBody, /html\s*\+=\s*['"][\s\S]{0,120}admin_/i, "Rows must not render internal function names");

console.log("PASS Actionability Dashboard is primary above Review Queues");
console.log("PASS KPI strip renders responsibility buckets above dashboard groups");
console.log("PASS experimental/internal wording remains hidden from dashboard rows");
console.log("PASS dashboard Review action keeps existing modal entry");
