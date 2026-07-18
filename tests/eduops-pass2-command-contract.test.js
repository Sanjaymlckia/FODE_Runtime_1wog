const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function read(file) { return fs.readFileSync(file, "utf8"); }
const sources = {
  contracts: read("EduOps_Contracts.js"),
  commands: read("EduOps_Commands.js"),
  flags: read("EduOps_FeatureFlags.js"),
  locks: read("EduOps_Locks.js"),
  idempotency: read("EduOps_Idempotency.js"),
  receipts: read("EduOps_Receipts.js"),
  client: ["EduOps_ClientCore.html", "EduOps_ClientComponents.html", "EduOps_ClientWorkbench.html", "EduOps_ClientBatch.html", "EduOps_Client.html"].map(read).join("\n")
};

for (const [name, source] of Object.entries(sources).filter(([name]) => name !== "client")) {
  assert.doesNotThrow(() => new vm.Script(source, { filename: name }), `${name} must parse`);
}

assert.match(sources.contracts, /function eduopsWriteRpcAllowlist_\(\)[\s\S]*\["eduops_executeCommand"\]/, "Only one public write command endpoint is allowed");
assert.match(sources.contracts, /eduops_getOperationHistory[\s\S]*eduops_previewCommand/, "Operation history and command preview must remain read RPCs");
assert.doesNotMatch(sources.client, /admin_[A-Za-z0-9_]+\s*\(/, "Browser source cannot invoke legacy Admin mutation RPCs");
assert.match(sources.client, /eduops_previewCommand[\s\S]*eduops_executeCommand/, "Browser operations must preview before the shared execute endpoint");
assert.match(sources.client, /data-message-type/, "Communication template cards must carry explicit authority message types");
assert.match(sources.client, /custom_email/, "Custom communication template must use the established Communication Authority custom_email type");
assert.doesNotMatch(sources.client, /operator_message/, "EduOps must not invent an unsupported browser-only communication type");
assert.match(sources.client, /refreshWorkbenchAfterReceipt[\s\S]*eduops_getApplicantWorkbench/, "Executed mutations must refresh the exact applicant authority projection");
assert.match(sources.client, /eduopsCommunicationHistory[\s\S]*eduops_getOperationHistory/, "Communications must surface applicant operation history in the Communications workspace");
assert.match(sources.client, /eduops-document-card[\s\S]*data-open-original/, "Document gallery must keep evidence cards adjacent to governed Open Original workflow");
assert.match(sources.client, /contextmenu[\s\S]*data-document-index[\s\S]*data-open-original/, "Document right-click behavior must route through the governed file action");

for (const operation of ["DOCUMENT_REVIEW", "FINANCE_EVIDENCE_DECISION", "SEND_INDIVIDUAL_COMMUNICATION", "CONTACTABILITY_CORRECTION", "BATCH_COMMUNICATION"]) {
  assert.match(sources.flags, new RegExp(`${operation}: true`), `${operation} must default available for released FODE Operations`);
  assert.match(sources.commands, new RegExp(`${operation}:`), `${operation} must have one command definition`);
}
assert.doesNotMatch(sources.commands, /BATCH_ASSIGNMENT|BATCH_CLASSIFICATION/, "Unproven assignment and classification authorities must not be exposed as executable commands");
assert.doesNotMatch(sources.commands, /EDUOPS_LARGE_COMMUNICATION_BATCH_THRESHOLD/, "Batch communication must not carry an unapproved independent-approval threshold");
assert.match(sources.commands, /admin_previewSelectedApplicantBatch[\s\S]*previewRequestId:[\s\S]*candidateHash:/, "Batch execution must consume the exact communication-authority preview context");
assert.match(sources.commands, /projection\.capabilities \|\| projection/, "Command capability checks must unwrap the canonical capability projection");
assert.match(sources.commands, /admin_updateParentEmailCorrected\(\{[\s\S]*newEmail:\s*draft\.email/, "Contactability correction must pass the authority-required newEmail field");
assert.match(sources.flags, /PORTAL_ACCESS: false/, "Portal access must remain unavailable independently");
assert.match(sources.flags, /BOOKS_ACTION: false/, "Books must default off independently");
assert.match(sources.flags, /function eduops_setFeatureFlagsForAdminStaging[\s\S]*getAdminRole_\(actorEmail\) !== "SUPER"/, "Feature flag activation must require SUPER authority");
assert.match(sources.flags, /SET_EDUOPS_FEATURE_FLAGS_FOR_ADMIN_STAGING/, "Feature flag activation must require explicit confirmation");
assert.match(sources.flags, /PORTAL_ACCESS_REQUIRES_SEPARATE_AUTHORITY_CIS/, "Feature flag activation must not enable Portal access");
assert.match(sources.flags, /BOOKS_ACTION_REQUIRES_SEPARATE_AUTHORITY_CIS/, "Feature flag activation must not enable Books action");
assert.match(sources.flags, /EDUOPS_FEATURE_FLAGS_SET/, "Feature flag activation must audit before/after state");
assert.doesNotMatch(sources.commands, /admin_createZohoBooksFodeDraftInvoice/, "FODE Operations cannot expose unrestricted Books execution");
assert.match(sources.commands, /BATCH_NOT_ALLOWED/, "Individual operations must reject cohort selection");
assert.match(sources.commands, /STALE_SELECTION_BINDING[\s\S]*QUERY_BINDING_MISMATCH/, "Batch preview must retain snapshot and query binding");
assert.match(sources.commands, /PREVIEW_EXPIRED_OR_UNKNOWN[\s\S]*PREVIEW_EXPIRED/, "Execution must reject absent and expired previews");
assert.match(sources.commands, /IDEMPOTENCY_CONTEXT_MISMATCH[\s\S]*eduopsReadIdempotentReceipt_/, "Execution must validate and replay idempotent receipts");
assert.match(sources.idempotency, /eduopsCanonicalJson_[\s\S]*IDEMPOTENCY_CONTEXT_CONFLICT/, "Idempotency replay must reject a reused key with altered command context");
assert.match(sources.commands, /eduopsNormalizeExecutionLimit_[\s\S]*Math\.min\(cap, requested\)/, "Batch execution must clamp to the bounded authoritative cap");
assert.match(sources.commands, /DUAL_APPROVAL_REQUIRED/, "High-risk Portal action must retain dual-approval gate");
assert.match(sources.locks, /LockService\.getScriptLock[\s\S]*tryLock[\s\S]*releaseLock/, "Execution must use a bounded lock");
assert.match(sources.receipts, /EDUOPS_RECEIPT_V1[\s\S]*receiptId[\s\S]*snapshotId[\s\S]*queryFingerprint/, "Receipts must be versioned and retain authority binding");
assert.match(sources.receipts, /logAdminEvent_[\s\S]*EDUOPS_GUARDED_OPERATION_RECEIPT/, "Receipts must enter the existing Admin audit path");
assert.match(sources.idempotency, /SHA_256/, "Idempotency keys must be hashed");
assert.match(sources.idempotency, /getUserCache[\s\S]*21600/, "Idempotency records must use bounded user-cache retention");
assert.match(sources.client, /requestWorkbenchLeave[\s\S]*history\.forward[\s\S]*history\.back/, "Dirty browser history must use the shared leave guard");
assert.match(sources.client, /event\.key === "Escape"[\s\S]*app\.closeConfirm/, "Escape must close the topmost confirmation first");
for (const field of ["documentKey", "sourceField", "itemIndex"]) assert.match(sources.client, new RegExp(field), `Document actions must carry exact manifest field ${field}`);

console.log("PASS EduOps command contract releasedOperationsDefaultAvailable=true writeRpcs=1 receipts=versioned");
