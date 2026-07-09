const assert = require("node:assert/strict");
const fs = require("node:fs");

const adminSource = fs.readFileSync("Admin.js", "utf8");
const adminUi = fs.readFileSync("AdminUI.html", "utf8");

function extractFunction(source, name) {
  const signature = `function ${name}`;
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `Function ${name} must exist`);
  const braceStart = source.indexOf("{", start);
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}

const explanationEmpty = extractFunction(adminSource, "actionabilityWorkloadExplanationEmpty_");
const explanationForRow = extractFunction(adminSource, "actionabilityWorkloadExplanationForRow_");
const buildRow = extractFunction(adminSource, "buildActionabilityPreviewRow_");
const preview = extractFunction(adminSource, "admin_getActionabilityPreview");
const renderExplanation = extractFunction(adminUi, "renderActionabilityWorkloadExplanation_");
const renderPreview = extractFunction(adminUi, "renderActionabilityPreview_");
const afterAction = extractFunction(adminUi, "batchCommAfterActionHtml_");

[
  "Awaiting applicant upload",
  "Reminder sent today",
  "Awaiting applicant response",
  "Cooling-off",
  "Escalation due",
  "Ready for reminder",
  "Ready for academic review",
  "Document received today"
].forEach((label) => {
  assert.match(explanationEmpty, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Workload explanation must include ${label}`);
});

assert.match(explanationForRow, /COOLDOWN_ACTIVE[\s\S]*Cooling-off/, "Cooling-off rows must explain remaining work before batch");
assert.match(explanationForRow, /UPLOAD_REQUIRED_DOCUMENTS[\s\S]*Ready for reminder/, "Document-upload rows must distinguish ready reminder work");
assert.match(buildRow, /communicationProgress:/, "Actionability row DTO must include communication progress");
assert.match(buildRow, /communicationProgressDetail:/, "Actionability row DTO must include operator-readable progress detail");
assert.match(preview, /workloadExplanation:\s*actionabilityWorkloadExplanationEmpty_\(\)/, "Actionability preview must initialize workload explanation summary");
assert.match(preview, /incrementActionabilityWorkloadExplanation_/, "Actionability preview must summarize why work remains");
assert.match(renderExplanation, /What Work Remains/, "Operations Workspace must render the remaining-work explanation panel");
assert.doesNotMatch(renderExplanation, /Why Work Remains/, "Operations Workspace remaining-work panel must not use ambiguous Why wording");
assert.match(renderPreview, /actionabilityDisplayRowsForGroup_\(actionabilityActiveGroup, rawDisplayRows\)/, "Active bucket worklist must pass through the shared Actionability display-row authority");
assert.match(renderPreview, /No eligible-now Applicant Action rows/, "Applicant Action worklist must clearly explain when all rows are cooling-off/contacted");
assert.match(renderPreview, /eligible-now rows shown/, "Current Worklist meta must keep returned workload rows distinct from full applicant population");
assert.match(renderPreview, /communicationProgress/, "Current Worklist rows must render communication progress");
assert.match(afterAction, /Accepted for send[\s\S]*Sent by runtime[\s\S]*Delivered[\s\S]*Not confirmed by runtime ledger[\s\S]*Confirmed[\s\S]*Awaiting reconciliation/, "Batch after-action feedback must separate accepted, sent, delivered, and confirmed states");

console.log("PASS workload reconciliation explains remaining work and after-action state");
