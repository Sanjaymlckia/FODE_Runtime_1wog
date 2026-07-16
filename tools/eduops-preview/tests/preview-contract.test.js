const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const previewRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(previewRoot, "..", "..");
const previewData = require("../server/preview-data");
const { renderEduOpsPreviewHtml, readiness, clientBuildInfo } = require("../server/server");

function readRepo(file) { return fs.readFileSync(path.join(repoRoot, file), "utf8"); }
function readPreview(file) { return fs.readFileSync(path.join(previewRoot, file), "utf8"); }

const clientFiles = ["EduOps_ClientCore.html", "EduOps_ClientComponents.html", "EduOps_ClientWorkbench.html", "EduOps_ClientBatch.html", "EduOps_Client.html"];
const runtimeClient = clientFiles.map(readRepo).join("\n");
const runtimeHtml = readRepo("EduOps.html");
const previewServer = readPreview("server/server.js");
const previewTransport = readPreview("server/preview-transport.js");
const previewDataSource = readPreview("server/preview-data.js");
const captureSource = readPreview("server/capture-fresh-snapshot.js");
const startCommand = readPreview("START_EDUOPS_PREVIEW.cmd");
const stopCommand = readPreview("STOP_EDUOPS_PREVIEW.cmd");

for (const file of clientFiles) {
  const source = readRepo(file).replace(/^<script>\s*/, "").replace(/\s*<\/script>\s*$/, "");
  assert.doesNotThrow(() => new vm.Script(source, { filename: file }), `${file} must parse`);
}
for (const [name, source] of [["preview-transport.js", previewTransport], ["preview-data.js", previewDataSource], ["server.js", previewServer]]) {
  assert.doesNotThrow(() => new vm.Script(source, { filename: name }), `${name} must parse`);
}

assert.match(runtimeClient, /function activeTransport\(\)/, "Client core must centralise transport selection");
assert.match(runtimeClient, /readRpcAllowlist[\s\S]*writeRpcAllowlist/, "Browser client must separate closed read and write RPC surfaces");
assert.match(runtimeClient, /eduops_previewCommand[\s\S]*eduops_executeCommand/, "All operations must use shared preview and execute commands");
assert.doesNotMatch(runtimeClient, /admin_[A-Za-z0-9_]+\s*\(/, "Browser client must never invoke legacy Admin RPCs directly");
assert.match(runtimeClient, /requestWorkbenchLeave[\s\S]*popstate/, "Dirty Workbench navigation must use the shared leave guard");
assert.match(runtimeClient, /documentKey[\s\S]*eduops_getDocumentRendition[\s\S]*eduops_getDocumentFileAction/, "Document gallery must retain exact manifest identity and separate rendition/original actions");
for (const state of ["BOOT_START", "ASSETS_READY", "TRANSPORT_READY", "ACCESS_READY", "PROFILE_READY", "SOURCE_READY", "WORKLOAD_READY", "INTERACTIVE"]) {
  assert.match(runtimeClient, new RegExp(`"${state}"`), `Shared client must expose bootstrap state ${state}`);
}
for (const state of ["TRANSPORT_ERROR", "ACCESS_ERROR", "PROFILE_ERROR", "SOURCE_ERROR", "WORKLOAD_ERROR", "TIMEOUT"]) {
  assert.match(runtimeClient, new RegExp(`"${state}"`), `Shared client must expose bootstrap failure ${state}`);
}
assert.match(runtimeClient, /data-bootstrap-disabled[\s\S]*eduopsBootstrapHelp/, "Workload-dependent controls must be truthfully disabled before INTERACTIVE");
assert.match(runtimeClient, /renderBootstrapError[\s\S]*Retry source[\s\S]*Retry workload/, "Bootstrap failures must expose exact retry controls");
assert.match(runtimeHtml, /Actionability-first workload[\s\S]*Individual Workbench[\s\S]*Batch Operations/, "Reconstructed product shell must retain the accepted architecture");

const html = renderEduOpsPreviewHtml();
assert.match(html, /Preview Lab controls/, "Preview Lab technical drawer must be injected");
assert.match(html, /Simulated data \/ no live operations/, "Preview Lab must identify its simulated authority");
assert.match(html, /id="eduopsPreviewToggle"[^>]*aria-expanded="false"/, "Preview Lab technical controls must start collapsed");
assert.match(html, /id="eduopsPreviewTechnicalBody"[^>]*hidden/, "Preview Lab technical body must not displace the product hierarchy on startup");
assert.match(html, /Deterministic Scenario Mode[\s\S]*Fresh FODE Snapshot Mode/, "Owner startup must expose both data modes");
assert.match(html, /window\.EDUOPS_TRANSPORT/, "Preview transport must load before application start");
assert.doesNotMatch(html, /HtmlService\.createHtmlOutputFromFile/, "Local Preview must resolve all Apps Script includes");
const build = clientBuildInfo();
const health = readiness();
assert.equal(health.ok, true, "Preview health must pass only when all rendered assets resolve");
assert.equal(health.serverReady, true);
assert.equal(health.applicationAssetsReady, true);
assert.equal(health.sharedClientReady, true);
assert.equal(health.previewTransportReady, true);
assert.equal(health.runtimeClientInputHash, build.runtimeClientInputHash);
assert.equal(health.servedClientBundleHash, build.servedClientBundleHash);
assert.deepEqual(health.runtimeClientFiles, clientFiles, "Health must identify the exact shared runtime client files");
assert.match(previewServer, /url\.pathname === "\/health"/, "Preview server must expose an HTTP health endpoint");
assert.match(startCommand, /\/health/, "Owner start command must poll Preview health");
assert.match(startCommand, /--daemon/, "Owner start command must launch the existing server through its bounded daemon mode");
assert.doesNotMatch(startCommand, /timeout\s+\/t/i, "Owner start command must not use an arbitrary fixed sleep");
assert.match(startCommand, /applicationAssetsReady[\s\S]*sharedClientReady[\s\S]*previewTransportReady/, "Owner start must require complete readiness");
assert.match(stopCommand, /Get-NetTCPConnection[\s\S]*did not close/, "Owner stop command must prove port 4173 closed");
assert.match(previewTransport, /window\.sessionStorage/, "Preview scenario state must be scoped to the current browser session");
assert.doesNotMatch(previewTransport, /window\.localStorage/, "Preview technical state must not contaminate a later clean start");
assert.match(previewTransport, /serverBuildTimestamp[\s\S]*runtimeClientInputHash[\s\S]*servedClientBundleHash[\s\S]*bootstrapState[\s\S]*outstandingRequestState/, "Technical diagnostics must expose build, bootstrap and request identity");
assert.equal(fs.existsSync(path.join(previewRoot, "tests", "eduops-preview-clean-start.browser.test.js")), true, "Dedicated owner-command clean-start test must exist");

const captureMethods = [
  "eduops_getAccessProjection", "eduops_getProfile", "eduops_queryOperationalWorkload", "eduops_searchApplicants",
  "eduops_getApplicantWorkbench", "eduops_getDocumentManifest", "eduops_getDocumentRendition",
  "eduops_getDocumentFileAction", "eduops_getReconciliation", "eduops_getParityDiagnostics"
];
const previewMethods = captureMethods.concat(["eduops_getOperationHistory", "eduops_previewCommand", "eduops_executeCommand"]);
for (const method of previewMethods) {
  let payload = {};
  if (method === "eduops_getApplicantWorkbench" || method === "eduops_getOperationHistory") payload = { applicantId: "FODE-26-002959", expectedSnapshotId: previewData.SNAPSHOT_ID };
  if (method === "eduops_previewCommand") payload = { operation: "DOCUMENT_REVIEW", product: "FODE", applicantId: "FODE-26-002959", snapshotId: previewData.SNAPSHOT_ID, idempotencyKey: "preview-contract-individual" };
  if (method === "eduops_executeCommand") continue;
  const result = previewData.handleRpc(method, { scenarioId: "normal-authoritative", serverDurationMs: 0 }, payload, repoRoot);
  assert.notEqual(result && result.code, "UNKNOWN_RPC", `${method} must have a Preview equivalent`);
}

const access = previewData.handleRpc("eduops_getAccessProjection", { scenarioId: "normal-authoritative" }, {}, repoRoot);
assert.deepEqual(access.rpcAllowlist.write, ["eduops_executeCommand"], "Preview write surface must contain only the shared guarded command endpoint");
assert.ok(access.rpcAllowlist.read.includes("eduops_previewCommand"));
assert.equal(access.featureFlags.BOOKS_ACTION, false, "Books must remain disabled in Preview acceptance");

const mutationTerms = ["GmailApp", "MailApp", "DriveApp", "SpreadsheetApp", "UrlFetchApp", "clasp push", "clasp deploy"];
for (const term of mutationTerms) assert.doesNotMatch(previewTransport + previewDataSource + previewServer, new RegExp(term, "i"), `Preview source must not expose live dependency ${term}`);

const captureAllowlist = Array.from(captureSource.matchAll(/"((?:eduops_)[A-Za-z0-9_]+)"/g), (match) => match[1]).filter((value, index, list) => list.indexOf(value) === index).sort();
assert.deepEqual(captureAllowlist, captureMethods.slice().sort(), "Fresh capture must remain read-only and must not include command RPCs");
assert.doesNotMatch(captureSource, /eduops_executeCommand|eduops_previewCommand/, "Fresh snapshot capture cannot preview or execute operations");
assert.match(captureSource, /function redactUrls/, "Capture must sanitise reusable file authority");
assert.match(captureSource, /local-snapshots/, "Capture must store only in ignored local snapshots");

const context = { scenarioId: "normal-authoritative", serverDurationMs: 123 };
const workload = previewData.handleRpc("eduops_queryOperationalWorkload", context, { actionabilityState: "READY", page: 1, pageSize: 25 }, repoRoot);
assert.equal(workload.ok, true);
assert.equal(workload.snapshotId, previewData.SNAPSHOT_ID);
assert.equal(workload.timings.serverRpcMs, 123);
assert.ok(workload.rows.some((row) => row.applicantId === "FODE-26-002985"), "Jackson exact fixture must be present");

const kiaWorkload = previewData.handleRpc("eduops_queryOperationalWorkload", context, { product: "KIA", actionabilityState: "READY", page: 1, pageSize: 25 }, repoRoot);
const mlcWorkload = previewData.handleRpc("eduops_queryOperationalWorkload", context, { product: "MLC", actionabilityState: "READY", page: 1, pageSize: 25 }, repoRoot);
assert.notEqual(kiaWorkload.snapshotId, workload.snapshotId, "KIA snapshot identity must be isolated from FODE");
assert.notEqual(mlcWorkload.snapshotId, workload.snapshotId, "MLC snapshot identity must be isolated from FODE");
assert.notEqual(kiaWorkload.snapshotId, mlcWorkload.snapshotId, "Preview product snapshots must remain distinct");
assert.ok(kiaWorkload.rows.every((row) => row.product === "KIA" && row.applicantId.startsWith("KIA-")));
const fodeAgain = previewData.handleRpc("eduops_queryOperationalWorkload", context, { product: "FODE", actionabilityState: "READY", page: 1, pageSize: 25, expectedSnapshotId: workload.snapshotId }, repoRoot);
assert.equal(fodeAgain.snapshotId, workload.snapshotId, "Preview product navigation must not increment another product snapshot");

const unavailableReconciliation = previewData.handleRpc("eduops_getReconciliation", { scenarioId: "source-unavailable", serverDurationMs: 0 }, { product: "FODE", actionabilityState: "READY" }, repoRoot);
assert.equal(unavailableReconciliation.ok, false, "Unavailable reconciliation must fail closed");
assert.equal(unavailableReconciliation.code, "SOURCE_UNAVAILABLE", "Reconciliation must preserve the exact source failure code");
assert.match(unavailableReconciliation.message, /source authority is unavailable/i, "Reconciliation must preserve a useful operator message");
assert.doesNotMatch(unavailableReconciliation.message, /Preview RPC failed/i, "Reconciliation must not collapse an explained source failure to a generic transport error");

const stale = previewData.handleRpc("eduops_queryOperationalWorkload", { scenarioId: "stale-snapshot", serverDurationMs: 0 }, { actionabilityState: "READY", expectedSnapshotId: previewData.SNAPSHOT_ID }, repoRoot);
assert.equal(stale.reliabilityState, "STALE");
assert.equal(stale.rows.length, 0);

const manifest = previewData.handleRpc("eduops_getDocumentManifest", context, { applicantId: "FODE-26-002959" }, repoRoot);
const exactDocument = manifest.files[0];
const rendition = previewData.handleRpc("eduops_getDocumentRendition", context, { applicantId: manifest.applicantId, sourceField: exactDocument.sourceField, itemIndex: exactDocument.itemIndex, documentKey: exactDocument.documentKey }, repoRoot);
assert.equal(rendition.ok, true);
assert.equal(rendition.renditionOnly, true);
const badDocument = previewData.handleRpc("eduops_getDocumentRendition", { scenarioId: "invalid-cross-applicant-document", serverDurationMs: 0 }, { applicantId: "FODE-26-002959", sourceField: exactDocument.sourceField, itemIndex: 0, documentKey: "another-applicant|context" }, repoRoot);
assert.equal(badDocument.code, "DOCUMENT_CONTEXT_MISMATCH");

const command = previewData.handleRpc("eduops_previewCommand", context, { operation: "DOCUMENT_REVIEW", product: "FODE", applicantId: "FODE-26-002959", snapshotId: previewData.SNAPSHOT_ID, idempotencyKey: "contract-command-1" }, repoRoot);
assert.equal(command.state, "READY");
const receipt = previewData.handleRpc("eduops_executeCommand", context, { previewId: command.previewId, idempotencyKey: command.idempotencyKey, confirmation: true }, repoRoot);
assert.equal(receipt.outcome, "COMPLETE");
assert.equal(receipt.simulated, true);
const replay = previewData.handleRpc("eduops_executeCommand", context, { previewId: command.previewId, idempotencyKey: command.idempotencyKey, confirmation: true }, repoRoot);
assert.equal(replay.receiptId, receipt.receiptId, "Idempotent replay must return the original receipt");
const history = previewData.handleRpc("eduops_getOperationHistory", context, { applicantId: "FODE-26-002959" }, repoRoot);
assert.equal(history.receipts[0].receiptId, receipt.receiptId);

const selection = { product: "FODE", snapshotId: previewData.SNAPSHOT_ID, queryFingerprint: "query-1", selectionMode: "EXPLICIT", selectedApplicantIds: ["FODE-26-002985", "FODE-26-002959"], excludedApplicantIds: [] };
const batch = previewData.handleRpc("eduops_previewCommand", context, { operation: "BATCH_COMMUNICATION", product: "FODE", snapshotId: previewData.SNAPSHOT_ID, queryFingerprint: "query-1", selection, idempotencyKey: "contract-batch-1", draft: { messageType: "docs_missing" } }, repoRoot);
assert.equal(batch.state, "READY");
assert.equal(batch.partitions[0].memberCount, 2);
const wrongQuery = previewData.handleRpc("eduops_previewCommand", context, { operation: "BATCH_COMMUNICATION", product: "FODE", snapshotId: previewData.SNAPSHOT_ID, queryFingerprint: "changed", selection, idempotencyKey: "contract-batch-2", draft: { messageType: "docs_missing" } }, repoRoot);
assert.equal(wrongQuery.code, "QUERY_BINDING_MISMATCH");
const unprovenBatch = previewData.handleRpc("eduops_previewCommand", context, { operation: "BATCH_ASSIGNMENT", product: "FODE", snapshotId: previewData.SNAPSHOT_ID, queryFingerprint: "query-1", selection, idempotencyKey: "contract-batch-unproven" }, repoRoot);
assert.equal(unprovenBatch.code, "UNSUPPORTED_OPERATION", "Unproven assignment authority must remain structural");

const expired = previewData.handleRpc("eduops_previewCommand", { scenarioId: "expired-command-preview" }, { operation: "DOCUMENT_REVIEW", product: "FODE", applicantId: "FODE-26-002959", snapshotId: previewData.SNAPSHOT_ID, idempotencyKey: "expired-1" }, repoRoot);
const expiredExecution = previewData.handleRpc("eduops_executeCommand", { scenarioId: "expired-command-preview" }, { previewId: expired.previewId, idempotencyKey: expired.idempotencyKey, confirmation: true }, repoRoot);
assert.equal(expiredExecution.code, "PREVIEW_EXPIRED", "Expired previews cannot execute");
const flagDenied = previewData.handleRpc("eduops_previewCommand", { scenarioId: "feature-flag-disabled" }, { operation: "DOCUMENT_REVIEW", product: "FODE", applicantId: "FODE-26-002959", snapshotId: previewData.SNAPSHOT_ID, idempotencyKey: "flag-1" }, repoRoot);
assert.equal(flagDenied.code, "DISABLED_BY_FLAG");
const capabilityDenied = previewData.handleRpc("eduops_previewCommand", { scenarioId: "capability-denied" }, { operation: "DOCUMENT_REVIEW", product: "FODE", applicantId: "FODE-26-002959", snapshotId: previewData.SNAPSHOT_ID, idempotencyKey: "capability-1" }, repoRoot);
assert.equal(capabilityDenied.code, "CAPABILITY_DENIED");
const stalePreview = previewData.handleRpc("eduops_previewCommand", context, { operation: "DOCUMENT_REVIEW", product: "FODE", applicantId: "FODE-26-002959", snapshotId: previewData.SNAPSHOT_ID, idempotencyKey: "stale-command-1" }, repoRoot);
const staleExecution = previewData.handleRpc("eduops_executeCommand", { scenarioId: "stale-command-preview" }, { previewId: stalePreview.previewId, idempotencyKey: stalePreview.idempotencyKey, confirmation: true }, repoRoot);
assert.equal(staleExecution.code, "STALE_SNAPSHOT");
const partialPreview = previewData.handleRpc("eduops_previewCommand", context, { operation: "BATCH_COMMUNICATION", product: "FODE", snapshotId: previewData.SNAPSHOT_ID, queryFingerprint: "query-1", selection, idempotencyKey: "partial-1", draft: { messageType: "docs_missing" } }, repoRoot);
const partialReceipt = previewData.handleRpc("eduops_executeCommand", { scenarioId: "partial-batch-failure" }, { previewId: partialPreview.previewId, idempotencyKey: partialPreview.idempotencyKey, confirmation: true }, repoRoot);
assert.equal(partialReceipt.outcome, "PARTIAL");
assert.equal(partialReceipt.applicantOutcomes.filter((item) => item.outcome === "BLOCKED").length, 1);

const financeVerified = previewData.handleRpc("eduops_previewCommand", context, { operation: "FINANCE_EVIDENCE_DECISION", product: "FODE", applicantId: "FODE-26-002959", snapshotId: previewData.SNAPSHOT_ID, idempotencyKey: "finance-verified", draft: { decision: "VERIFIED" } }, repoRoot);
assert.equal(financeVerified.state, "READY");
const financeRejected = previewData.handleRpc("eduops_previewCommand", { scenarioId: "finance-rejection" }, { operation: "FINANCE_EVIDENCE_DECISION", product: "FODE", applicantId: "FODE-26-002959", snapshotId: previewData.SNAPSHOT_ID, idempotencyKey: "finance-rejected", draft: { decision: "REPLACEMENT_REQUIRED" } }, repoRoot);
assert.equal(financeRejected.code, "UNSUPPORTED_FINANCE_DECISION");
const booksBlocked = previewData.handleRpc("eduops_previewCommand", { scenarioId: "books-approval-blocked" }, { operation: "BOOKS_ACTION", product: "FODE", applicantId: "FODE-26-002959", snapshotId: previewData.SNAPSHOT_ID, idempotencyKey: "books-blocked" }, repoRoot);
assert.equal(booksBlocked.code, "DISABLED_BY_FLAG");
const coolingBlocked = previewData.handleRpc("eduops_previewCommand", { scenarioId: "cooling-off-denial" }, { operation: "SEND_INDIVIDUAL_COMMUNICATION", product: "FODE", applicantId: "FODE-26-002959", snapshotId: previewData.SNAPSHOT_ID, idempotencyKey: "cooling-blocked", draft: { messageType: "docs_missing" } }, repoRoot);
assert.equal(coolingBlocked.code, "COOLDOWN_ACTIVE");
const portalReset = previewData.handleRpc("eduops_previewCommand", context, { operation: "PORTAL_ACCESS", product: "FODE", applicantId: "FODE-26-002959", snapshotId: previewData.SNAPSHOT_ID, idempotencyKey: "portal-reset", draft: { action: "RESET" } }, repoRoot);
const portalDenied = previewData.handleRpc("eduops_executeCommand", { scenarioId: "portal-reset-approval-blocked" }, { previewId: portalReset.previewId, idempotencyKey: portalReset.idempotencyKey, confirmation: true }, repoRoot);
assert.equal(portalDenied.code, "DUAL_APPROVAL_REQUIRED");
const overCapIds = Array.from({ length: 51 }, (_, index) => `FODE-26-CAP-${String(index + 1).padStart(3, "0")}`);
const overCapSelection = { ...selection, selectedApplicantIds: overCapIds };
const capBlocked = previewData.handleRpc("eduops_previewCommand", { scenarioId: "batch-cap-exceeded" }, { operation: "BATCH_COMMUNICATION", product: "FODE", snapshotId: previewData.SNAPSHOT_ID, queryFingerprint: "query-1", selection: overCapSelection, idempotencyKey: "cap-blocked", draft: { messageType: "docs_missing" } }, repoRoot);
assert.equal(capBlocked.code, "BATCH_CAP_EXCEEDED");
const alteredReplay = previewData.handleRpc("eduops_executeCommand", { scenarioId: "altered-replay-payload" }, { previewId: command.previewId, idempotencyKey: "altered-key", confirmation: true }, repoRoot);
assert.equal(alteredReplay.code, "IDEMPOTENCY_CONTEXT_MISMATCH");
const reusedKeyPreview = previewData.handleRpc("eduops_previewCommand", context, { operation: "DOCUMENT_REVIEW", product: "FODE", applicantId: "FODE-26-002959", snapshotId: previewData.SNAPSHOT_ID, idempotencyKey: "contract-command-1", draft: { status: "REJECTED" } }, repoRoot);
const reusedKeyConflict = previewData.handleRpc("eduops_executeCommand", { scenarioId: "altered-replay-payload" }, { previewId: reusedKeyPreview.previewId, idempotencyKey: reusedKeyPreview.idempotencyKey, confirmation: true }, repoRoot);
assert.equal(reusedKeyConflict.code, "IDEMPOTENCY_CONTEXT_CONFLICT");

const sanitisation = readPreview("fixtures/SANITISATION_REPORT.md");
assert.match(sanitisation, /No Sheet writes[\s\S]*No signed live URLs[\s\S]*synthetic/, "Fixture sanitisation report must document no live dependency");
console.log(`PASS EduOps Preview Lab contracts methods=${previewMethods.length} simulatedReceipts=true captureReadOnly=true`);
