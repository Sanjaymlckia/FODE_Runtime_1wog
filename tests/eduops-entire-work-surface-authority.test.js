const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const policy = JSON.parse(read("docs/governance/EDUOPS_CLIENT_AUTHORITY_POLICY.json"));
const clients = Object.fromEntries(policy.clientFiles.map((file) => [file, read(file)]));
const clientSource = Object.values(clients).join("\n");
const workload = read("EduOps_Workload.js");
const adapter = read("EduOps_FODE_Adapter.js");
const contracts = read("EduOps_Contracts.js");
const commands = read("EduOps_Commands.js");
const receipts = read("EduOps_Receipts.js");

for (const [file, source] of Object.entries(clients)) {
  const script = source.replace(/^\s*<script>\s*/, "").replace(/\s*<\/script>\s*$/, "");
  new vm.Script(script, { filename: file });
}

for (const identifier of policy.forbiddenClientIdentifiers) {
  assert.ok(!clientSource.includes(identifier), `forbidden client authority identifier is absent: ${identifier}`);
}
assert.doesNotMatch(clientSource, /\b(?:GmailApp|MailApp)\b|\.sendEmail\s*\(/, "no direct communication send bypass exists in the client");
assert.doesNotMatch(clientSource, /state\.(?:capabilities|featureFlags)/, "client does not retain raw capability or feature-flag authority for local decisions");
assert.doesNotMatch(workload, /eduopsReadOnlyAction_/, "deleted client-era action defaults have no residual server references");
assert.doesNotMatch(clientSource, /\.filter\s*\([^)]*(?:retired|canSendNow)/, "client does not filter template availability or infer send eligibility");
assert.doesNotMatch(clientSource, /queryFingerprint\s*=\s*function|function\s+queryFingerprint/, "client cannot generate query authority fingerprints");
assert.doesNotMatch(clientSource, /selectedApplicantIds\.length\s*[+\-*\/]/, "client cannot derive an execution cohort from selected-ID counts");
assert.doesNotMatch(clientSource, /Admin staging|\bproduction\b[^\n]{0,50}\?[^\n]{0,50}\bstaging\b/i, "client has no runtime classification fallback");

assert.match(contracts, /function eduopsAuthorityUnavailable_\(domain, authoritySource\)/, "backend supplies the standard authority-unavailable DTO");
assert.match(contracts, /schemaVersion:\s*"EDUOPS_AUTHORITY_DECISION_V1"/, "authority-unavailable DTO is versioned");
assert.match(adapter, /schemaVersion:\s*"EDUOPS_WORKLOAD_ROW_V2"/, "worklist rows use an explicit authoritative DTO");
assert.match(adapter, /authorityDecision:\s*\{[\s\S]*authoritySource:[\s\S]*snapshotId:[\s\S]*state:[\s\S]*reasonCode:[\s\S]*actionAvailable:/, "row authority decision carries source, snapshot, state, reason and availability");
assert.match(workload, /schemaVersion:\s*"EDUOPS_WORKLOAD_PRESENTATION_V1"/, "workload labels, buckets, counts and filter options are backend-projected");
assert.match(workload, /schemaVersion:\s*"EDUOPS_RUNTIME_IDENTITY_V1"/, "runtime identity and deployment classification are server-projected");
assert.match(adapter, /schemaVersion:\s*"EDUOPS_APPLICANT_WORKBENCH_V2"/, "applicant workbench uses a versioned authority DTO");
assert.match(workload, /schemaVersion:\s*"EDUOPS_RECONCILIATION_RESPONSE_V1"/, "population and hidden-record reconciliation uses a versioned backend DTO");
assert.match(workload, /schemaVersion:\s*"EDUOPS_WORKBENCH_ACTION_V1"/, "mutation availability is backend-projected");
assert.match(workload, /PORTAL_ACCESS:\s*decision\([^\n]*false[^\n]*BACKEND_CONTRACT_MISSING/, "portal actions fail closed while their backend contract is missing");

assert.match(clients["EduOps_ClientComponents.html"], /EDUOPS_WORKLOAD_PRESENTATION_V1/, "workload rendering requires the backend presentation DTO");
assert.match(clients["EduOps_ClientComponents.html"], /EDUOPS_MODULE_PROJECTION_V1/, "read-only module renderers require versioned backend DTOs");
assert.match(clients["EduOps_ClientComponents.html"], /app\.authorityUnavailable\("workload"\)/, "missing workload authority is visibly fail closed");
assert.match(clients["EduOps_ClientComponents.html"], /decision\.schemaVersion === "EDUOPS_ROW_AUTHORITY_DECISION_V1"[\s\S]*decision\.actionAvailable === true/, "missing or stale actionability decision disables row selection");
assert.match(clients["EduOps_ClientWorkbench.html"], /commandEnabled\("DOCUMENT_REVIEW"/, "document decisions consume backend action authority");
assert.match(clients["EduOps_ClientWorkbench.html"], /actionDecision\("FINANCE_EVIDENCE_DECISION"\)/, "finance decisions consume backend action authority");
assert.match(clients["EduOps_ClientWorkbench.html"], /commandEnabled\("CONTACTABILITY_CORRECTION"/, "contactability decisions consume backend action authority");
assert.match(clients["EduOps_ClientWorkbench.html"], /authorityUnavailable\("portal-access"\)/, "portal rendering exposes the missing backend authority");
assert.match(clients["EduOps_ClientWorkbench.html"], /comm\.schemaVersion !== "EDUOPS_COMMUNICATION_SUMMARY_V1"/, "missing communication authority fails closed");
assert.match(clients["EduOps_ClientWorkbench.html"], /actionDecision\("SEND_INDIVIDUAL_COMMUNICATION"\)/, "individual communication control consumes backend operation authority");
assert.doesNotMatch(clients["EduOps_ClientWorkbench.html"], /CAN_SEND_INDIVIDUAL_EMAIL/, "client does not reconstruct individual-send authority from raw capability flags");
assert.doesNotMatch(clients["EduOps_ClientWorkbench.html"], /portalSubmitted|OPEN_PORTAL|LOCK_PORTAL/, "client cannot infer or execute portal state");
assert.match(clients["EduOps_ClientBatch.html"], /profile\.batchPolicy\.allowedExecutionLimits/, "execution limits come from the backend profile");
assert.match(clients["EduOps_ClientBatch.html"], /recipient\.included === true/, "client can only retain recipients included by backend authority");
assert.doesNotMatch(clients["EduOps_ClientBatch.html"], /push\([^)]*(?:recipient|applicant)/i, "client cannot add recipients to a server cohort");
assert.match(clients["EduOps_ClientBatch.html"], /selectionQueryBinding/, "query-wide selection transports the server-issued binding");
assert.doesNotMatch(clients["EduOps_ClientBatch.html"], /JSON\.stringify\([^)]*query[^)]*\).*fingerprint|fingerprint.*JSON\.stringify/, "client cannot reconstruct a query fingerprint");

assert.match(commands, /function eduops_executeCommand[\s\S]*eduopsRequireAccess_\(\)[\s\S]*eduopsRequireCommandCapability_\(access, definition\)/, "commands revalidate authenticated role and capability");
assert.match(commands, /function eduops_executeCommand[\s\S]*eduopsRequireFeature_\(definition\.operation\)/, "commands revalidate operation availability");
assert.match(commands, /current\.snapshotId !== preview\.snapshotId/, "commands revalidate snapshot freshness");
assert.match(commands, /eduopsWithOperationLock_\(/, "commands acquire a server lock");
assert.match(commands, /eduopsReadIdempotentReceipt_\(/, "commands enforce server idempotency");
assert.match(commands, /eduopsWithOperationLock_[\s\S]*eduopsRevalidateCommandForExecution_\(preview, access\)[\s\S]*eduopsDispatchCommand_\(preview\)/, "every mutation path performs final backend revalidation inside the operation lock");
assert.match(commands, /EXECUTION_COHORT_MISMATCH[\s\S]*RECIPIENT_AUTHORITY_CHANGED/, "client intent cannot enlarge the execution cohort or recipient authority");
assert.match(commands, /eduopsDispatchCommand_\(/, "only the server dispatcher reaches mutation handlers");
assert.match(commands, /executable:\s*authorityReady/, "server preview controls executable state");
assert.match(receipts, /publicLabel:/, "receipts carry canonical public labels");
assert.match(receipts, /communicationReceipts:/, "history classification is backend-authored");

assert.doesNotMatch(clients["EduOps_ClientComponents.html"], /rows\.slice\(0,\s*20\)|actionabilityState\s*\|\|\s*lifecycle/i, "read-only modules do not hide or reclassify records locally");
assert.match(clients["EduOps_ClientComponents.html"], /workload\.presentation\.modules/, "read-only modules consume backend projections");
assert.doesNotMatch(clientSource, /selectionFingerprint/, "client has no authority-like selection fingerprint");
assert.match(clients["EduOps_ClientCore.html"], /app\.sameSelectionContext/, "selection invalidation compares local display context without creating authority");
assert.match(clientSource, /invalidateOperationAuthority/, "operator-intent changes invalidate preview and executable state");

const helperSource = `${contracts}\nthis.eduopsAuthorityUnavailable_ = eduopsAuthorityUnavailable_; this.eduopsStatePresentation_ = eduopsStatePresentation_;`;
const helperContext = {
  clean_: (value) => String(value == null ? "" : value).trim(),
  eduopsIso_: () => "2026-07-19T00:00:00.000Z",
  eduopsHumanize_: (value) => String(value || "").replace(/_/g, " "),
  eduopsNormalizeCode_: (value) => String(value || "").trim().toUpperCase(),
  Utilities: { getUuid: () => "uuid" }
};
vm.createContext(helperContext);
vm.runInContext(helperSource, helperContext, { filename: "EduOps_Contracts.js" });
const unavailable = helperContext.eduopsAuthorityUnavailable_("finance", "Finance authority");
assert.equal(unavailable.available, false, "missing authority fails closed");
assert.equal(unavailable.reasonCode, "BACKEND_CONTRACT_MISSING", "missing authority is classified precisely");
assert.match(unavailable.reason, /Authoritative finance decision was not returned/, "missing authority exposes the required operator message");
const unknownState = helperContext.eduopsStatePresentation_("");
assert.equal(unknownState.available, false, "empty state does not create a fallback business state");

const commandContext = {
  eduopsClean_: (value) => String(value == null ? "" : value).trim(),
  eduopsUpper_: (value) => String(value == null ? "" : value).trim().toUpperCase(),
  eduopsClone_: (value) => JSON.parse(JSON.stringify(value)),
  eduopsRequireFeature_: () => {},
  eduopsResolveFodeSnapshot_: () => ({ snapshotId: "SNAP-1", rows: [{ applicantId: "FODE-1" }] }),
  eduopsFodeApplicantRead_: () => ({ ok: true, rowKey: "FODE:FODE-1:2" }),
  Utilities: { getUuid: () => "uuid" }
};
vm.createContext(commandContext);
vm.runInContext(`${commands}\nthis.revalidate = eduopsRevalidateCommandForExecution_;`, commandContext, { filename: "EduOps_Commands.js" });
const access = { capabilities: { CAN_OPEN_REVIEW_WORKSPACE: true, CAN_RUN_BATCH_COMMUNICATIONS: true } };
const individualPreview = { operation: "CONTACTABILITY_CORRECTION", applicantId: "FODE-1", snapshotId: "SNAP-1", selectedApplicantIds: [], request: { operation: "CONTACTABILITY_CORRECTION", applicantId: "FODE-1", rowKey: "FODE:FODE-1:2", snapshotId: "SNAP-1", draft: { email: "new@example.test", reason: "Correction" } } };
assert.equal(commandContext.revalidate(individualPreview, access).operation, "CONTACTABILITY_CORRECTION", "operator intent is revalidated without becoming authorisation");
commandContext.eduopsResolveFodeSnapshot_ = () => ({ snapshotId: "SNAP-2", rows: [] });
assert.throws(() => commandContext.revalidate(individualPreview, access), /STALE_SNAPSHOT/, "stale authority blocks mutation before dispatch");

commandContext.eduopsResolveFodeSnapshot_ = () => ({ snapshotId: "SNAP-1", rows: [{ applicantId: "FODE-1" }] });
commandContext.eduopsResolveBatchSelection_ = () => ({ executionApplicantIds: ["FODE-1"], selectionMode: "EXPLICIT_SELECTION" });
commandContext.eduopsResolveCommunicationTemplate_ = () => ({ internalTemplateId: "docs_missing", templateId: "docs_missing", label: "Missing documents" });
commandContext.eduopsBatchPreviewRecipientProjection_ = (recipient) => ({ applicantId: recipient.applicantId, included: recipient.included === true });
commandContext.eduopsAuthorityPreview_ = () => ({ ok: true, state: "READY", recipients: [{ applicantId: "FODE-1", included: true }] });
const batchPreview = { operation: "BATCH_COMMUNICATION", applicantId: "", snapshotId: "SNAP-1", selectedApplicantIds: ["FODE-1"], recipients: [{ applicantId: "FODE-1", included: true }], request: { operation: "BATCH_COMMUNICATION", snapshotId: "SNAP-1", selection: { selectionMode: "EXPLICIT_SELECTION" }, draft: { templateId: "docs_missing" } } };
assert.equal(commandContext.revalidate(batchPreview, access).authorityPreview.state, "READY", "exact server recipient membership passes final revalidation");
commandContext.eduopsAuthorityPreview_ = () => ({ ok: true, state: "READY", recipients: [{ applicantId: "FODE-1", included: true }, { applicantId: "FODE-2", included: true }] });
assert.throws(() => commandContext.revalidate(batchPreview, access), /RECIPIENT_AUTHORITY_CHANGED/, "client cannot add recipients or enlarge a server-authorised cohort");

console.log("PASS EduOps entire work-surface authority: client decisions deleted, DTO rendering and fail-closed contracts verified");
