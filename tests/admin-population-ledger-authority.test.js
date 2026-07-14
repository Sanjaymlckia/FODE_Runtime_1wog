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

const actionabilityPreview = extractFunction(adminSource, "admin_getActionabilityPreview");
const stageAggregation = extractFunction(adminSource, "admin_getStageAggregation");
const dashboardMetrics = extractFunction(adminSource, "buildOperationalDashboardMetrics_");
const ledgerBuilder = extractFunction(adminSource, "buildPopulationLedgerFromValues_");
const ledgerClassifier = extractFunction(adminSource, "populationLedgerClassifyRow_");
const ledgerBucketMapper = extractFunction(adminSource, "populationLedgerBucketFromActionability_");

assert.match(ledgerClassifier, /buildActionabilityPreviewRow_/, "Population Ledger must reuse the existing actionability row resolver");
assert.match(ledgerBucketMapper, /Unknown \/ Unclassified/, "Unknown / Unclassified bucket must be explicit");
assert.match(ledgerBuilder, /bucketTotal !== out\.applicantIdRows/, "Ledger must verify bucket totals equal ApplicantID rows");
assert.match(ledgerBuilder, /duplicateApplicantIds/, "Ledger must expose duplicate ApplicantID evidence");
assert.doesNotMatch(ledgerBuilder, /admin_getReviewQueues|isQueueCandidateRow_/, "Ledger builder must not use Review Queue membership");

[
  ["Operations Workspace", actionabilityPreview],
  ["Lifecycle Map", stageAggregation],
  ["Global Dashboard", dashboardMetrics]
].forEach(([label, source]) => {
  assert.match(source, /canonicalPopulationSnapshot_\(\)|buildPopulationLedgerFromValues_/, `${label} must derive its accounting summary from canonical population or the ledger builder`);
  assert.match(source, /populationLedgerPublicSummary_\(ledger\)|populationLedger:/, `${label} must expose Population Ledger summary`);
});

assert.match(adminUi, /actionabilityPopulationCountForGroup_/, "Operations Workspace must resolve KPI counts from ledger population totals");
assert.match(actionabilityPreview, /bucketSummaries:\s*\{\}/, "Operations Workspace preview must initialize authoritative bucket summaries");
assert.match(actionabilityPreview, /buildActionabilityBucketSummaries_\(rows, out\.rows, ledger, out\.hiddenRecords\)/, "Operations Workspace preview must expose server-authored bucket summaries");
assert.match(adminUi, /eligible-now rows shown/, "Operations Workspace must label eligible workload rows separately from population totals");
assert.match(adminUi, /bounded worklist rows/, "Operations Workspace must retain bounded worklist wording for non-Applicant filters");
assert.match(adminUi, /String\(populationTotal\) \+ " total applicant population/, "Operations Workspace must label displayed workload rows separately from population totals");
assert.match(adminSource, /workloadExplanation:\s*actionabilityWorkloadExplanationEmpty_\(\)/, "Operations Workspace must keep workload explanations separate from Population Ledger counts");
assert.match(adminUi, /What Work Remains/, "Operations Workspace must explain workload separately from population accounting");
assert.doesNotMatch(adminUi, /Review Queues remains the primary action surface/i, "Review Queues must not claim primary authority");
assert.match(adminUi, /Compatibility: Review Queues/, "Review Queues must remain compatibility-only navigation");

console.log("PASS Population Ledger is the shared dashboard authority summary");
console.log("PASS Review Queues stay out of population/workload authority");
