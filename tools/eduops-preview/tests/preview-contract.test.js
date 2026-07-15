const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const previewRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(previewRoot, "..", "..");
const previewData = require("../server/preview-data");
const { renderEduOpsPreviewHtml } = require("../server/server");

function read(file) {
  return fs.readFileSync(path.join(repoRoot, file), "utf8");
}

const runtimeClient = read("EduOps_Client.html");
const runtimeHtml = read("EduOps.html");
const previewServer = fs.readFileSync(path.join(previewRoot, "server", "server.js"), "utf8");
const previewTransport = fs.readFileSync(path.join(previewRoot, "server", "preview-transport.js"), "utf8");
const previewDataSource = fs.readFileSync(path.join(previewRoot, "server", "preview-data.js"), "utf8");
const captureSource = fs.readFileSync(path.join(previewRoot, "server", "capture-fresh-snapshot.js"), "utf8");

assert.match(runtimeClient, /function activeTransport_\(\)/, "Runtime client must centralise transport selection");
assert.match(runtimeClient, /window\.EDUOPS_TRANSPORT/, "Runtime client must support preview transport injection");
assert.match(runtimeClient, /google\.script\.run[\s\S]*withSuccessHandler/, "Apps Script transport path must remain available");
assert.doesNotMatch(runtimeClient, /prototypes\/eduops|mock-authority|eduops-next/i, "Runtime client must not import prototype mock authority");
assert.match(runtimeClient, /data-load-document-manifest[\s\S]*eduops_getDocumentRendition[\s\S]*eduops_getDocumentFileAction/, "Shared client must expose document gallery workflow");
assert.match(runtimeHtml, /Technical authority diagnostics[\s\S]*eduopsOpenParity/, "Parity diagnostics must move away from normal rail navigation");
assert.doesNotMatch(runtimeHtml, /eduopsOpenParity" class="eduops-rail-button/, "Parity diagnostics must not remain a primary rail button");
assert.match(runtimeClient, /eduops-kpi-summary/, "Horizontal KPI row must be a count summary, not duplicate state navigation");

const html = renderEduOpsPreviewHtml();
assert.match(html, /PREVIEW LAB - SIMULATED DATA - NO LIVE OPERATIONS/, "Preview Lab control strip must be injected");
assert.match(html, /Deterministic Scenario Mode[\s\S]*Fresh FODE Snapshot Mode/, "Owner startup must expose both data modes");
assert.match(html, /r352-preview/, "Preview render must use local preview identity");
assert.match(html, /window\.EDUOPS_TRANSPORT/, "Preview render must load preview transport before client");
assert.doesNotMatch(html, /HtmlService\.createHtmlOutputFromFile/, "Preview render must not depend on Apps Script includes");

for (const source of [previewTransport, previewDataSource, previewServer]) {
  assert.doesNotThrow(() => new vm.Script(source), "Preview JavaScript source must parse");
}

assert.match(previewTransport, /DETERMINISTIC SCENARIO DATA[\s\S]*NOT CURRENT FODE DATA[\s\S]*NO LIVE OPERATIONS/, "Deterministic mode must be visibly labelled");
assert.match(previewTransport, /FODE SNAPSHOT MODE[\s\S]*CURRENT AS OF CAPTURE TIME/, "Snapshot mode must never be described as live data");
assert.match(previewTransport, /SNAPSHOT MAY BE OUT OF DATE/, "Stale local snapshot warning must be implemented");

const requiredMethods = [
  "eduops_getAccessProjection",
  "eduops_getProfile",
  "eduops_queryOperationalWorkload",
  "eduops_searchApplicants",
  "eduops_getApplicantWorkbench",
  "eduops_getDocumentManifest",
  "eduops_getDocumentRendition",
  "eduops_getDocumentFileAction",
  "eduops_getReconciliation",
  "eduops_getParityDiagnostics"
];
for (const method of requiredMethods) {
  const result = previewData.handleRpc(method, { scenarioId: "normal-authoritative", serverDurationMs: 0 }, method === "eduops_getApplicantWorkbench" ? { applicantId: "FODE-26-002959", expectedSnapshotId: previewData.SNAPSHOT_ID } : {}, repoRoot);
  assert.notEqual(result && result.code, "UNKNOWN_RPC", `${method} must have a preview equivalent`);
}

const mutationTerms = ["sendEmail", "setValue(", "setValues(", "appendRow(", "clasp", "DriveApp", "GmailApp", "MailApp", "UrlFetchApp"];
for (const term of mutationTerms) {
  assert.doesNotMatch(previewTransport + "\n" + previewDataSource + "\n" + previewServer, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Preview server/transport must not introduce live mutation or external service term: ${term}`);
}

const captureAllowlist = Array.from(captureSource.matchAll(/"((?:eduops_)[A-Za-z0-9_]+)"/g), (match) => match[1]).filter((value, index, list) => list.indexOf(value) === index).sort();
assert.deepEqual(captureAllowlist, requiredMethods.sort(), "Fresh snapshot capture may call only the read-only EduOps RPC allowlist");
assert.match(captureSource, /Unexpected runtime identity/, "Capture must fail on unexpected runtime identity");
assert.match(captureSource, /Incompatible contract version/, "Capture must fail on incompatible contract version");
assert.match(captureSource, /redactUrls/, "Capture must sanitise tokens, signed URLs and file authority");
assert.match(captureSource, /local-snapshots/, "Fresh snapshots must be stored under ignored local snapshot storage");
assert.doesNotMatch(captureSource, /admin_|setValue\(|appendRow\(|sendEmail|GmailApp|MailApp|DriveApp\.create|PropertiesService\.getScriptProperties\(\)\.set/, "Capture source must not include non-EduOps or mutation calls");

assert.equal(previewData.listScenarios().length, 15, "Preview Lab must expose the required scenario set");
assert.equal(previewData.handleRpc("eduops_runBatch", {}, {}, repoRoot).code, "UNKNOWN_RPC", "Preview transport must not expose mutation RPCs");

const workload = previewData.handleRpc("eduops_queryOperationalWorkload", { scenarioId: "normal-authoritative", serverDurationMs: 123 }, { actionabilityState: "READY", page: 1, pageSize: 25 }, repoRoot);
assert.equal(workload.ok, true);
assert.equal(workload.snapshotId, previewData.SNAPSHOT_ID);
assert.equal(workload.timings.serverRpcMs, 123);
assert.ok(workload.rows.some((row) => row.applicantId === "FODE-26-002985"), "Jackson exact fixture must be present");

const stale = previewData.handleRpc("eduops_queryOperationalWorkload", { scenarioId: "stale-snapshot", serverDurationMs: 0 }, { actionabilityState: "READY", expectedSnapshotId: previewData.SNAPSHOT_ID }, repoRoot);
assert.equal(stale.reliabilityState, "STALE");
assert.equal(stale.rows.length, 0);

const incompatible = previewData.validateSnapshot({ metadata: { snapshotFormatVersion: "OLD", contractVersion: previewData.CONTRACT_VERSION } });
assert.equal(incompatible.ok, false, "Incompatible snapshot versions must be rejected");

const sampleSnapshot = {
  metadata: {
    snapshotFormatVersion: previewData.SNAPSHOT_FORMAT_VERSION,
    contractVersion: previewData.CONTRACT_VERSION,
    profileVersion: previewData.PROFILE_VERSION,
    runtimeIdentity: "r352 / 352",
    capturedAt: "2026-07-15T08:00:00.000Z",
    sourceAsOf: "2026-07-15T08:00:00.000Z",
    sourceReliability: "AUTHORITATIVE",
    sanitisationVersion: previewData.SANITISATION_VERSION,
    snapshotId: "FODE-CAPTURED-SNAPSHOT-001",
    populationCount: 1
  },
  counts: { actionabilityCounts: { READY: 1 }, worklistKeyCounts: { DOCUMENT_REVIEW: 1 } },
  workloads: { default: { rows: [workload.rows[0]] } },
  exactApplicants: {
    "FODE-26-002985": { workbench: { ok: true, identity: { applicantId: "FODE-26-002985" } } },
    "FODE-26-002959": { workbench: { ok: true, identity: { applicantId: "FODE-26-002959" } } },
    "FODE-26-TEST-004": { workbench: { ok: true, identity: { applicantId: "FODE-26-TEST-004" } } }
  },
  paritySummary: { ok: true, readOnly: true, reliabilityState: "AUTHORITATIVE" }
};
assert.equal(previewData.validateSnapshot(sampleSnapshot).ok, true, "Complete compatible snapshots must validate");
const snapshotWorkload = previewData.handleRpc("eduops_queryOperationalWorkload", { mode: "snapshot", snapshot: sampleSnapshot, serverDurationMs: 3 }, { actionabilityState: "READY", page: 1, pageSize: 25 }, repoRoot);
assert.equal(snapshotWorkload.snapshotId, "FODE-CAPTURED-SNAPSHOT-001");
assert.equal(snapshotWorkload.reliabilityState, "AUTHORITATIVE");

const badDocument = previewData.handleRpc("eduops_getDocumentRendition", { scenarioId: "invalid-cross-applicant-document", serverDurationMs: 0 }, { applicantId: "FODE-26-002959", sourceField: "Proof_Of_Identity", itemIndex: 0, documentKey: "bad" }, repoRoot);
assert.equal(badDocument.code, "DOCUMENT_CONTEXT_MISMATCH");

const sanitisation = fs.readFileSync(path.join(previewRoot, "fixtures", "SANITISATION_REPORT.md"), "utf8");
assert.match(sanitisation, /No Sheet writes[\s\S]*No signed live URLs[\s\S]*synthetic/, "Fixture sanitisation report must document no live data dependency");

console.log("PASS EduOps Preview Lab contract tests methods=10 scenarios=15 sharedClient=true");
