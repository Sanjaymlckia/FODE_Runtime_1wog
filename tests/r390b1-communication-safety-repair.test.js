const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  let lineComment = false;
  let blockComment = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    const next = source[i + 1];
    if (lineComment) {
      if (ch === "\n") lineComment = false;
      continue;
    }
    if (blockComment) {
      if (ch === "*" && next === "/") {
        blockComment = false;
        i += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "/" && next === "/") {
      lineComment = true;
      i += 1;
      continue;
    }
    if (ch === "/" && next === "*") {
      blockComment = true;
      i += 1;
      continue;
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function digestBytes(value) {
  return Array.from(crypto.createHash("sha256").update(String(value), "utf8").digest());
}

function base64Url(bytes) {
  return Buffer.from(Array.from(bytes || [], value => Number(value) < 0 ? Number(value) + 256 : Number(value))).toString("base64url");
}

const codeSource = read("Code.js");
const adminSource = read("Admin.js");
const commandsSource = read("EduOps_Commands.js");
const idempotencySource = read("EduOps_Idempotency.js");
const receiptsSource = read("EduOps_Receipts.js");
const selectedSource = read("Admin_SelectedApplicantCommunications.js");
const workbenchSource = read("EduOps_ClientWorkbench.html");
const stageBatchSource = read("Admin_StageBatchCommunications.js");

// R391B explicitly authorizes Stage Batch population-integrity gates. Preserve
// the R390 communication identity assertions while requiring the new boundary.
assert.match(
  extractFunction(stageBatchSource, "admin_previewStageBatch"),
  /populationIntegrity/i,
  "Stage Batch preview must retain the R391B population-integrity gate"
);
assert.match(
  extractFunction(stageBatchSource, "admin_sendStageBatch"),
  /populationIntegrity/i,
  "Stage Batch send must retain the R391B population-integrity revalidation"
);

const previewSource = extractFunction(commandsSource, "eduops_previewCommand");
const executeSource = extractFunction(commandsSource, "eduops_executeCommand");
const dispatchSource = extractFunction(commandsSource, "eduopsDispatchCommand_");
const identityPayloadSource = extractFunction(commandsSource, "eduopsCommandIdentityPayload_");
for (const field of [
  "operationId",
  "previewId",
  "receiptId",
  "applicantId",
  "messageType",
  "commandType",
  "actor",
  "stateFingerprint",
  "cooldownCycle",
  "idempotencyKey"
]) {
  assert.match(previewSource, new RegExp(`\\b${field}\\s*:`), `Preview must retain ${field}`);
}
assert.match(previewSource, /var stateFingerprint\s*=\s*eduopsStateFingerprint_\(/, "Preview must derive its approved state fingerprint");
assert.match(previewSource, /stateFingerprint:\s*stateFingerprint/, "Preview must bind its approved state fingerprint");
for (const field of ["operationId", "previewId", "receiptId", "stateFingerprint", "cooldownCycle", "idempotencyKey"]) {
  assert.match(identityPayloadSource, new RegExp(`\\b${field}\\s*:`), `Command identity payload must retain ${field}`);
}
assert.match(dispatchSource, /var operationIdentity\s*=\s*eduopsCommandIdentityPayload_\(preview\)/, "Individual dispatch must derive the approved operation identity");
assert.match(dispatchSource, /admin_sendApplicantMessage\(Object\.assign\(\{\},\s*operationIdentity,/, "Individual dispatch must pass the approved operation identity");
assert.match(dispatchSource, /eduopsIndividualCommunicationApprovedPayload_\(preview\)/, "Individual dispatch must use the immutable preview-approved communication payload");
assert.doesNotMatch(dispatchSource, /recipient:\s*draft\.recipient|subject:\s*draft\.subject|body:\s*draft\.body|cc:\s*draft\.cc|bcc:\s*draft\.bcc/, "Individual dispatch must not rebuild final communication content from mutable draft fields");
const priorReadIndex = executeSource.indexOf("eduopsReadIdempotentReceipt_");
const dispatchIndex = executeSource.indexOf("eduopsDispatchCommand_");
assert.ok(priorReadIndex >= 0 && dispatchIndex > priorReadIndex, "Exact replay must be resolved before dispatch");
assert.match(executeSource.slice(priorReadIndex, dispatchIndex), /if \(prior\) return prior;/, "Exact replay must return the original receipt without dispatch");
const expiryCheckIndex = executeSource.indexOf("Date.parse(preview.expiresAt) <= Date.now()");
assert.ok(expiryCheckIndex >= 0 && expiryCheckIndex < dispatchIndex, "Expired previews must be blocked before the Gmail dispatch path");
assert.doesNotMatch(codeSource, /markApplicantEmailPipelineState_\(ctx,\s*"SUPPRESSED"/, "Idempotent replay must not overwrite Email_Status with SUPPRESSED");
assert.doesNotMatch(codeSource, /recordApplicantContactOutcome_\(ctx,\s*"SUPPRESSED"/, "Idempotent replay must not overwrite successful contact history with SUPPRESSED");

const cacheValues = new Map();
let gmailCalls = 0;
const idempotencyContext = {
  Buffer,
  CacheService: {
    getUserCache() {
      return {
        get(key) { return cacheValues.has(key) ? cacheValues.get(key) : null; },
        put(key, value) { cacheValues.set(key, value); }
      };
    }
  },
  GmailApp: {
    sendEmail() { gmailCalls += 1; }
  },
  Utilities: {
    DigestAlgorithm: { SHA_256: "SHA_256" },
    Charset: { UTF_8: "UTF_8" },
    computeDigest(_algorithm, value) { return digestBytes(value); },
    base64EncodeWebSafe(bytes) { return base64Url(bytes); }
  },
  eduopsClean_: clean,
  eduopsClone_: value => JSON.parse(JSON.stringify(value))
};
vm.createContext(idempotencyContext);
vm.runInContext(idempotencySource, idempotencyContext);

const fingerprintFixture = {
  commandType: "SEND_INDIVIDUAL_COMMUNICATION",
  product: "FODE",
  snapshotId: "SNAP-R390B1",
  queryFingerprint: "QUERY-R390B1",
  applicantId: "FODE-26-003001",
  selectedApplicantIds: [],
  request: {
    document: null,
    draft: { messageType: "docs_missing", subject: "Missing documents", body: "Please upload the missing documents." },
    approvalId: ""
  }
};
const fingerprintA = idempotencyContext.eduopsStateFingerprint_(fingerprintFixture);
const fingerprintB = idempotencyContext.eduopsStateFingerprint_({
  ...fingerprintFixture,
  request: {
    approvalId: "",
    draft: { body: "Please upload the missing documents.", subject: "Missing documents", messageType: "docs_missing" },
    document: null
  }
});
const fingerprintChanged = idempotencyContext.eduopsStateFingerprint_({
  ...fingerprintFixture,
  request: { ...fingerprintFixture.request, draft: { ...fingerprintFixture.request.draft, body: "Different approved state." } }
});
assert.match(fingerprintA, /^EDUOPS-STATE-/, "State fingerprint must have the bounded public prefix");
assert.equal(fingerprintB, fingerprintA, "Equivalent approved state must have a deterministic fingerprint");
assert.notEqual(fingerprintChanged, fingerprintA, "Changed approved content must receive a new state fingerprint");

const commandPayloadContext = {
  eduopsClean_: clean
};
vm.createContext(commandPayloadContext);
vm.runInContext(extractFunction(commandsSource, "eduopsIndividualCommunicationApprovedPayload_"), commandPayloadContext);
const approvedDispatchPayload = commandPayloadContext.eduopsIndividualCommunicationApprovedPayload_({
  request: {
    draft: {
      recipient: "draft@example.test",
      cc: "draft-cc@example.test",
      bcc: "draft-bcc@example.test",
      subject: "Draft subject",
      body: "Raw draft body with {{portal_url}}"
    }
  },
  authorityPreview: {
    effectiveEmail: "parent@example.test",
    cc: "",
    bcc: "",
    subject: "Missing documents",
    body: "Open the secure applicant portal.\nhttps://portal.example.test/FODE-FINGERPRINT"
  },
  subject: "Missing documents",
  body: "Open the secure applicant portal.\nhttps://portal.example.test/FODE-FINGERPRINT",
  cc: "",
  bcc: ""
});
assert.equal(JSON.stringify(approvedDispatchPayload), JSON.stringify({
  recipient: "parent@example.test",
  cc: "",
  bcc: "",
  subject: "Missing documents",
  body: "Open the secure applicant portal.\nhttps://portal.example.test/FODE-FINGERPRINT"
}), "Final operation must bind to immutable preview-approved canonical payload, not mutable draft/display fields");

const originalReceipt = {
  receiptId: "EDUOPS-RECEIPT-R390B1-EXACT",
  operationId: "EDUOPS-OPERATION-R390B1-EXACT",
  previewId: "EDUOPS-PREVIEW-R390B1-EXACT",
  outcome: "SENT",
  idempotentReplay: false
};
idempotencyContext.eduopsStoreIdempotentReceipt_("IDEMPOTENCY-R390B1-EXACT", originalReceipt, fingerprintA);
const replay = idempotencyContext.eduopsReadIdempotentReceipt_("IDEMPOTENCY-R390B1-EXACT", fingerprintA, { markReplay: true });
assert.equal(replay.receiptId, originalReceipt.receiptId, "Exact replay must retain the original receipt ID");
assert.equal(replay.operationId, originalReceipt.operationId, "Exact replay must retain the original operation ID");
assert.equal(replay.previewId, originalReceipt.previewId, "Exact replay must retain the original preview ID");
assert.equal(replay.outcome, "SENT", "Exact replay must retain the original canonical outcome");
assert.equal(replay.idempotentReplay, true, "Exact replay must be explicitly identified");
assert.equal(replay.replayOutcome, "IDEMPOTENT_REPLAY", "Exact replay must expose its non-destructive replay outcome");
assert.doesNotMatch(JSON.stringify(replay), /SUPPRESSED/, "Exact replay must never become SUPPRESSED");
assert.equal(gmailCalls, 0, "Idempotency contract tests must never send Gmail");
assert.equal(originalReceipt.idempotentReplay, false, "Reading a replay must not mutate the original stored receipt object");

const receiptCache = new Map();
const receiptsContext = {
  CacheService: {
    getUserCache() {
      return {
        get(key) { return receiptCache.has(key) ? receiptCache.get(key) : null; },
        put(key, value) { receiptCache.set(key, value); }
      };
    }
  },
  Logger: { log() {} },
  Session: { getScriptTimeZone() { return "Pacific/Port_Moresby"; } },
  Utilities: {
    DigestAlgorithm: { SHA_256: "SHA_256" },
    Charset: { UTF_8: "UTF_8" },
    computeDigest(_algorithm, value) { return digestBytes(value); },
    base64EncodeWebSafe(bytes) { return base64Url(bytes); },
    formatDate() { return "29 July 2026, 10:15 am"; },
    getUuid() { throw new Error("Receipt identity must not be regenerated during receipt construction"); }
  },
  eduopsClean_: clean,
  eduopsUpper_: (value, fallback) => clean(value || fallback).toUpperCase(),
  eduopsClone_: value => JSON.parse(JSON.stringify(value)),
  logAdminEvent_() {}
};
vm.createContext(receiptsContext);
vm.runInContext(receiptsSource, receiptsContext);

function previewIdentity(suffix) {
  return {
    operationId: `EDUOPS-OPERATION-${suffix}`,
    previewId: `EDUOPS-PREVIEW-${suffix}`,
    receiptId: `EDUOPS-RECEIPT-${suffix}`,
    operation: "SEND_INDIVIDUAL_COMMUNICATION",
    commandType: "SEND_INDIVIDUAL_COMMUNICATION",
    product: "FODE",
    snapshotId: "SNAP-R390B1",
    queryFingerprint: "",
    applicantId: `FODE-${suffix}`,
    selectedApplicantIds: [],
    messageType: "docs_missing",
    actor: "operator@example.test",
    stateFingerprint: `EDUOPS-STATE-${suffix}`,
    cooldownCycle: "AFTER_FIRST_SUCCESS",
    idempotencyKey: `EDUOPS-IDEMPOTENCY-${suffix}`,
    selectedTemplate: { templateId: "docs_missing", templateVersionId: "1", label: "Missing Documents" },
    subject: "Missing documents",
    body: "Please upload the missing documents.",
    request: { draft: { messageType: "docs_missing" } }
  };
}

const blockedPreview = previewIdentity("R390B1-BLOCKED");
const blockedReceipt = receiptsContext.eduopsBuildReceipt_(blockedPreview, {
  ok: false,
  result: "BLOCKED",
  blockCode: "AUTHORITY_PENDING",
  blockReason: "Admissions authority review is still pending.",
  deliveryEvidence: { gmailAttempted: false, gmailAccepted: false },
  applicantOutcomes: [{
    applicantId: blockedPreview.applicantId,
    outcome: "BLOCKED",
    blockCode: "AUTHORITY_PENDING",
    blockReason: "Admissions authority review is still pending."
  }]
});
for (const field of [
  "receiptId",
  "operationId",
  "previewId",
  "applicantId",
  "messageType",
  "outcome",
  "blockCode",
  "blockReason",
  "actor",
  "occurredAt",
  "occurredAtPng",
  "deliveryEvidence",
  "idempotentReplay"
]) {
  assert.ok(Object.prototype.hasOwnProperty.call(blockedReceipt, field), `Receipt must retain ${field}`);
}
assert.equal(blockedReceipt.receiptId, blockedPreview.receiptId, "Receipt ID must be preserved exactly from preview");
assert.equal(blockedReceipt.operationId, blockedPreview.operationId);
assert.equal(blockedReceipt.previewId, blockedPreview.previewId);
assert.equal(blockedReceipt.blockCode, "AUTHORITY_PENDING");
assert.equal(blockedReceipt.blockReason, "Admissions authority review is still pending.");
assert.equal(blockedReceipt.idempotentReplay, false);
assert.ok(Number.isFinite(Date.parse(blockedReceipt.occurredAt)), "Receipt must retain a technical ISO timestamp");
assert.ok(clean(blockedReceipt.occurredAtPng), "Receipt must retain a PNG-local timestamp");
assert.equal(blockedReceipt.deliveryEvidence.gmailAttempted, false);

const sentPreview = previewIdentity("R390B1-SENT");
const sentReceipt = receiptsContext.eduopsBuildReceipt_(sentPreview, {
  ok: true,
  result: "SENT",
  message: "Communication completed.",
  deliveryEvidence: { gmailAttempted: true, gmailAccepted: true },
  applicantOutcomes: [{
    applicantId: sentPreview.applicantId,
    outcome: "SENT",
    blockCode: "",
    blockReason: "",
    gmailAttempted: true,
    gmailAccepted: true,
    rowPatchConfirmed: true,
    communicationRecorded: true
  }]
});
assert.equal(sentReceipt.receiptId, sentPreview.receiptId);
assert.notEqual(sentReceipt.receiptId, blockedReceipt.receiptId, "Distinct previews must retain distinct receipt IDs");
assert.equal(sentReceipt.blockCode, "", "Successful receipts must not render a blocker code");
assert.equal(sentReceipt.blockReason, "", "Successful authority messages must not render as blocker reasons");
assert.equal(sentReceipt.authorityMessage, "Communication completed.", "Successful informational messages remain separate authority evidence");

const replayPreview = previewIdentity("R390B1-AUTHORITY-REPLAY");
const replayReceipt = receiptsContext.eduopsBuildReceipt_(replayPreview, {
  ok: true,
  result: "IDEMPOTENT_REPLAY",
  idempotentReplay: true,
  replayOutcome: "IDEMPOTENT_REPLAY",
  originalOutcome: "SENT",
  blockCode: "ALREADY_PROCESSED_FOR_OPERATION",
  applicantOutcomes: [{
    applicantId: replayPreview.applicantId,
    outcome: "IDEMPOTENT_REPLAY",
    idempotentReplay: true,
    replayOutcome: "IDEMPOTENT_REPLAY",
    originalOutcome: "SENT",
    gmailAttempted: false,
    gmailAccepted: true,
    rowPatchConfirmed: true,
    communicationRecorded: true
  }]
});
assert.equal(replayReceipt.idempotentReplay, true, "Authority-level exact replay must remain explicit in the receipt");
assert.equal(replayReceipt.replayOutcome, "IDEMPOTENT_REPLAY");
assert.equal(replayReceipt.originalOutcome, "SENT");
assert.equal(replayReceipt.blockCode, "", "A successful exact replay is not a contactability blocker");
assert.equal(replayReceipt.applicantOutcomes[0].idempotentReplay, true, "Per-applicant replay evidence must survive receipt projection");

const batchPreview = {
  ...previewIdentity("R390B1-BATCH"),
  operation: "BATCH_COMMUNICATION",
  commandType: "BATCH_COMMUNICATION",
  applicantId: "",
  selectedApplicantIds: ["FODE-BATCH-SENT", "FODE-BATCH-REPLAY", "FODE-BATCH-BLOCKED"],
  recipients: [{
    applicantId: "FODE-BATCH-SENT",
    included: true,
    messageType: "docs_missing"
  }, {
    applicantId: "FODE-BATCH-REPLAY",
    included: true,
    messageType: "docs_missing"
  }, {
    applicantId: "FODE-BATCH-BLOCKED",
    included: false,
    blockCode: "AUTHORITY_PENDING",
    blockReason: "Admissions authority review is still pending.",
    messageType: "docs_missing"
  }]
};
const batchReceipt = receiptsContext.eduopsBuildReceipt_(batchPreview, {
  ok: true,
  result: "COMPLETE",
  message: "Bounded batch authority completed.",
  applicantOutcomes: [{
    applicantId: "FODE-BATCH-SENT",
    outcome: "SENT",
    gmailAttempted: true,
    gmailAccepted: true,
    rowPatchConfirmed: true,
    communicationRecorded: true,
    messageType: "docs_missing"
  }, {
    applicantId: "FODE-BATCH-REPLAY",
    outcome: "IDEMPOTENT_REPLAY",
    idempotentReplay: true,
    replayOutcome: "IDEMPOTENT_REPLAY",
    originalOutcome: "SENT",
    gmailAttempted: false,
    gmailAccepted: true,
    rowPatchConfirmed: true,
    communicationRecorded: true,
    messageType: "docs_missing"
  }]
});
assert.equal(batchReceipt.applicantOutcomes.length, batchPreview.selectedApplicantIds.length, "Batch receipt outcomes must reconcile to the selected cohort");
assert.equal(batchReceipt.sentCount, 1);
assert.equal(batchReceipt.replayCount, 1);
assert.equal(batchReceipt.blockedCount, 1);
assert.equal(batchReceipt.completeCount + batchReceipt.blockedCount + batchReceipt.failedCount + batchReceipt.reconciliationRequiredCount + batchReceipt.unresolvedCount, batchPreview.selectedApplicantIds.length);
assert.equal(batchReceipt.outcome, "PARTIAL");
assert.equal(batchReceipt.blockCode, "AUTHORITY_PENDING", "Preview authority blocker must survive into the batch receipt");
assert.equal(batchReceipt.blockReason, "Admissions authority review is still pending.");
assert.equal(batchReceipt.deliveryEvidence.gmailAttemptedCount, 1);
assert.equal(batchReceipt.deliveryEvidence.gmailAcceptedCount, 2);
assert.equal(batchReceipt.deliveryEvidence.rowPatchConfirmedCount, 2);
assert.equal(batchReceipt.deliveryEvidence.communicationRecordedCount, 2);
assert.equal(batchReceipt.deliveryEvidence.idempotentReplayCount, 1);
assert.equal(batchReceipt.deliveryEvidence.gmailAcceptedAny, true);
assert.equal(batchReceipt.deliveryEvidence.rowPatchConfirmedAllAccepted, true);

const compatibilityContext = {
  clean_: clean,
  normalizeEmailStatus_: value => clean(value).toUpperCase(),
  parseTime_: value => {
    const parsed = Date.parse(value || "");
    return Number.isFinite(parsed) ? parsed : 0;
  },
  isCampaignBounceFlagTrue_: value => value === true || /^(YES|TRUE|1)$/i.test(clean(value)),
  campaignAttemptCount_: row => Math.max(0, Math.floor(Number(row && row.Email_Attempt_Count || 0)))
};
vm.createContext(compatibilityContext);
vm.runInContext(extractFunction(codeSource, "communicationActualContactEvidence_"), compatibilityContext);
vm.runInContext(extractFunction(codeSource, "communicationCompatibilityReadRow_"), compatibilityContext);
vm.runInContext(extractFunction(codeSource, "communicationCadenceState_"), compatibilityContext);

const falseSuppressedRow = {
  ApplicantID: "FODE-FALSE-SUPPRESSED",
  Parent_Email: "parent@example.test",
  Email_Status: "SUPPRESSED",
  Email_Attempt_Count: 1,
  Email_Last_Sent_At: "2026-07-26T00:00:00.000Z",
  Last_Contacted_At: "2026-07-26T00:00:00.000Z",
  Last_Contact_Type: "docs_missing",
  Last_Contact_Result: "SUPPRESSED"
};
const normalizedFalseSuppressed = compatibilityContext.communicationCompatibilityReadRow_(falseSuppressedRow);
assert.notStrictEqual(normalizedFalseSuppressed, falseSuppressedRow, "Compatibility normalization must return a row clone");
assert.equal(falseSuppressedRow.Email_Status, "SUPPRESSED", "Compatibility normalization must not mutate the source row");
assert.equal(normalizedFalseSuppressed.Email_Status, "SENT", "Prior successful delivery evidence must recover false SUPPRESSED status");
assert.equal(normalizedFalseSuppressed.Last_Contact_Result, "SENT", "Prior successful contact evidence must remain successful");

const hardBounceReasonOnly = compatibilityContext.communicationCompatibilityReadRow_({
  Email_Status: "SUPPRESSED",
  Email_Last_Sent_At: "2026-07-26T00:00:00.000Z",
  Last_Contact_Result: "SUPPRESSED",
  Bounce_Reason: "550 permanent mailbox unavailable"
});
assert.equal(hardBounceReasonOnly.Email_Status, "BOUNCED", "A hard-bounce reason must survive false-suppression compatibility normalization");
assert.equal(hardBounceReasonOnly._communicationActualContactEvidence.blocked, true);

const permanentDeliveryHealth = compatibilityContext.communicationCompatibilityReadRow_({
  Email_Status: "SUPPRESSED",
  Email_Last_Sent_At: "2026-07-26T00:00:00.000Z",
  Last_Contact_Result: "SUPPRESSED",
  Delivery_Health: "Permanent Failure"
});
assert.equal(permanentDeliveryHealth.Email_Status, "BOUNCED", "Permanent delivery health must remain a contactability blocker");

const temporaryDeliveryHealth = compatibilityContext.communicationCompatibilityReadRow_({
  Email_Status: "SUPPRESSED",
  Email_Last_Sent_At: "2026-07-26T00:00:00.000Z",
  Last_Contact_Result: "SUPPRESSED",
  Delivery_Health: "Temporary Failure",
  Bounce_Reason: "Temporary rate limit; try again"
});
assert.equal(temporaryDeliveryHealth.Email_Status, "SENT", "Temporary delivery failure remains governed by retry cadence, not permanent contactability");
assert.equal(temporaryDeliveryHealth._communicationActualContactEvidence.blocked, false);

const doNotContactCompatibility = compatibilityContext.communicationCompatibilityReadRow_({
  Email_Status: "SUPPRESSED",
  Email_Last_Sent_At: "2026-07-26T00:00:00.000Z",
  Last_Contact_Result: "SUPPRESSED",
  Do_Not_Contact: "YES"
});
assert.equal(doNotContactCompatibility.Email_Status, "DO_NOT_CONTACT", "A separate DNC authority flag must never be normalized away");
assert.equal(doNotContactCompatibility._communicationActualContactEvidence.doNotContact, true);

const auditedFalseSuppressedIds = [
  "FODE-26-002972",
  "FODE-26-002976",
  "FODE-26-002980",
  "FODE-26-002987",
  "FODE-26-003013",
  "FODE-26-003020",
  "FODE-26-003021"
];
const auditedFalseSuppressedProjection = auditedFalseSuppressedIds.map(applicantId => compatibilityContext.communicationCompatibilityReadRow_({
  ApplicantID: applicantId,
  Email_Status: "SUPPRESSED",
  Email_Attempt_Count: 2,
  Email_Last_Sent_At: "2026-07-20T00:00:00.000Z",
  Last_Contacted_At: "2026-07-20T00:00:00.000Z",
  Last_Contact_Type: "docs_missing",
  Last_Contact_Result: "SUPPRESSED",
  Email_Next_Action_Date: "2026-07-24T00:00:00.000Z"
}));
assert.equal(auditedFalseSuppressedProjection.length, 7);
assert.equal(auditedFalseSuppressedProjection.filter(row => row.Email_Status === "SUPPRESSED" || row.Last_Contact_Result === "SUPPRESSED").length, 0, "All seven audited false-suppression rows must project without suppression");

const dayMs = 24 * 60 * 60 * 1000;
const nowMs = Date.parse("2026-07-28T00:00:00.000Z");
const firstCadence = compatibilityContext.communicationCadenceState_({
  Email_Attempt_Count: 1,
  Email_Last_Sent_At: "2026-07-28T00:00:00.000Z",
  Email_Next_Action_Date: "2026-07-30T00:00:00.000Z"
}, nowMs);
assert.equal(firstCadence.successfulSendCount, 1);
assert.equal(firstCadence.nextActionAtMs - nowMs, 2 * dayMs, "First successful send must retain the two-day cadence");
assert.equal(firstCadence.cooldownActive, true);
assert.equal(firstCadence.manualReviewRequired, false);
assert.ok(clean(firstCadence.cooldownCycle), "First cadence cycle must be explicit");

const secondCadence = compatibilityContext.communicationCadenceState_({
  Email_Attempt_Count: 2,
  Email_Last_Sent_At: "2026-07-28T00:00:00.000Z",
  Email_Next_Action_Date: "2026-08-01T00:00:00.000Z"
}, nowMs);
assert.equal(secondCadence.successfulSendCount, 2);
assert.equal(secondCadence.nextActionAtMs - nowMs, 4 * dayMs, "Second successful send must retain the four-day cadence");
assert.equal(secondCadence.cooldownActive, true);
assert.equal(secondCadence.manualReviewRequired, false);

const expiredCadence = compatibilityContext.communicationCadenceState_({
  Email_Attempt_Count: 1,
  Email_Last_Sent_At: "2026-07-24T00:00:00.000Z",
  Email_Next_Action_Date: "2026-07-26T00:00:00.000Z"
}, nowMs);
assert.equal(expiredCadence.cooldownActive, false, "Expired cooldown must not become permanent duplicate completion");
assert.equal(expiredCadence.manualReviewRequired, false);

const thirdCadence = compatibilityContext.communicationCadenceState_({
  Email_Attempt_Count: 2,
  Email_Last_Sent_At: "2026-07-24T00:00:00.000Z",
  Email_Next_Action_Date: "2026-07-28T00:00:00.000Z"
}, nowMs);
assert.equal(thirdCadence.successfulSendCount, 2);
assert.equal(thirdCadence.manualReviewRequired, true, "Attempt three or later must require manual communication review");
assert.match(codeSource, /MANUAL_REVIEW_REQUIRED/, "Attempt-three projection must expose MANUAL_REVIEW_REQUIRED");

const communicationCache = new Map();
const dispatchEvents = [];
let dispatchGmailCalls = 0;
let dispatchPatchCalls = 0;
let dispatchPipelineMarks = 0;
let failNextDispatchPatch = false;
const dispatchContext = {
  CONFIG: {
    ENABLE_PRODUCTION_EMAIL_SENDS: true,
    VERSION: "r390",
    DEPLOY_VERSION_NUMBER: 390
  },
  clean_: clean,
  isSystemStabilizationModeActive_: () => false,
  isManualSingleSendProbeEnabled_: () => true,
  isPortalCommunicationMessageType_: () => false,
  getCallerEmail_: () => "operator@example.test",
  getCommunicationCooldownState_(applicantId, messageType) {
    return communicationCache.get(`${applicantId}::${messageType}`) || null;
  },
  setCommunicationCooldownState_(applicantId, messageType, state) {
    communicationCache.set(`${applicantId}::${messageType}`, JSON.parse(JSON.stringify(state)));
    dispatchEvents.push(`cache:${state.source}:${state.result}`);
    return { ok: true, stored: true };
  },
  computeEmailIdempotencyKey_(ctx, options) {
    return clean(options.idempotencyKey || ctx.idempotencyKey || `EMAIL_OPERATION::${ctx.operationId}::${ctx.applicantId}::${ctx.messageType}`);
  },
  communicationCooldownMs_: () => 6 * 60 * 60 * 1000,
  communicationBlockReason_: code => code,
  campaignAttemptCount_: row => Math.max(0, Math.floor(Number(row && row.Email_Attempt_Count || 0))),
  computeNextActionDate_(attemptCount, now) {
    return new Date(now.getTime() + Number(attemptCount) * 2 * dayMs).toISOString();
  },
  campaignSendEmailGmail_() {
    dispatchGmailCalls += 1;
    dispatchEvents.push("gmail:accepted");
    return { ok: true, from: "admissions@example.test" };
  },
  markApplicantEmailPipelineState_() {
    dispatchPipelineMarks += 1;
  },
  applyPatch_(_sheet, _rowNumber, patch) {
    dispatchPatchCalls += 1;
    dispatchEvents.push("row:patch");
    if (failNextDispatchPatch) {
      failNextDispatchPatch = false;
      throw new Error("simulated row persistence failure");
    }
    dispatchContext.lastPatch = JSON.parse(JSON.stringify(patch));
  },
  recordApplicantContactOutcome_() {},
  recordEmailProcessingResult_() {},
  campaignLog_() {},
  logOperationalBlock_() {},
  setManualSendProbeStatus_() {},
  logManualSendProbe_() {},
  newDebugId_: () => "DBG-DISPATCH-R390B1"
};
vm.createContext(dispatchContext);
vm.runInContext(extractFunction(codeSource, "wasEmailAlreadyProcessed_"), dispatchContext);
vm.runInContext(extractFunction(codeSource, "dispatchApplicantMessage_"), dispatchContext);

function freshDispatchContext(suffix, overrides = {}) {
  return {
    eligible: true,
    sheet: {},
    rowNumber: 2,
    applicantId: `FODE-DISPATCH-${suffix}`,
    messageType: "docs_missing",
    effectiveEmail: "parent@example.test",
    rowObj: { Email_Attempt_Count: 0 },
    successfulSendCount: 0,
    operationId: `COMM-OPERATION-${suffix}`,
    previewId: `COMM-PREVIEW-${suffix}`,
    receiptId: `COMM-RECEIPT-${suffix}`,
    commandType: "SEND_INDIVIDUAL_COMMUNICATION",
    actor: "operator@example.test",
    stateFingerprint: `STATE-${suffix}`,
    cooldownCycle: "FIRST_SEND_ELIGIBLE",
    idempotencyKey: `EMAIL-OPERATION-${suffix}`,
    debugId: `DBG-${suffix}`,
    ...overrides
  };
}

const firstDispatchContext = freshDispatchContext("EXACT");
const firstDispatch = dispatchContext.dispatchApplicantMessage_(firstDispatchContext, {
  subject: "Missing documents",
  body: "Please upload the missing documents."
}, { idempotencyKey: firstDispatchContext.idempotencyKey, sendSource: "ADMIN_SELECTED_APPLICANT" });
assert.equal(firstDispatch.result, "SENT");
assert.equal(dispatchGmailCalls, 1);
assert.equal(dispatchPatchCalls, 1);
assert.equal(dispatchContext.lastPatch.Email_Attempt_Count, 1);
assert.ok(
  dispatchEvents.indexOf("cache:email_dispatch_gmail_accepted:RECONCILIATION_REQUIRED") < dispatchEvents.indexOf("row:patch"),
  "Gmail acceptance must be operation-guarded before durable row persistence"
);

const patchCallsBeforeExactReplay = dispatchPatchCalls;
const pipelineMarksBeforeExactReplay = dispatchPipelineMarks;
const exactReplay = dispatchContext.dispatchApplicantMessage_(firstDispatchContext, {
  subject: "Missing documents",
  body: "Please upload the missing documents."
}, { idempotencyKey: firstDispatchContext.idempotencyKey, sendSource: "ADMIN_SELECTED_APPLICANT" });
assert.equal(exactReplay.result, "IDEMPOTENT_REPLAY");
assert.equal(exactReplay.replayOutcome, "IDEMPOTENT_REPLAY");
assert.equal(exactReplay.originalOutcome, "SENT");
assert.equal(exactReplay.receiptId, firstDispatchContext.receiptId);
assert.equal(dispatchGmailCalls, 1, "Exact retry must not call Gmail again");
assert.equal(dispatchPatchCalls, patchCallsBeforeExactReplay, "Exact retry must not write the applicant row");
assert.equal(dispatchPipelineMarks, pipelineMarksBeforeExactReplay, "Exact retry must not increment or mark an attempt");

const persistenceFailureContext = freshDispatchContext("PERSISTENCE");
failNextDispatchPatch = true;
const persistenceFailure = dispatchContext.dispatchApplicantMessage_(persistenceFailureContext, {
  subject: "Missing documents",
  body: "Please upload the missing documents."
}, { idempotencyKey: persistenceFailureContext.idempotencyKey, sendSource: "ADMIN_SELECTED_APPLICANT" });
assert.equal(persistenceFailure.result, "RECONCILIATION_REQUIRED");
assert.equal(persistenceFailure.gmailAccepted, true);
const gmailCallsAfterPersistenceFailure = dispatchGmailCalls;
const persistenceRetry = dispatchContext.dispatchApplicantMessage_(persistenceFailureContext, {
  subject: "Missing documents",
  body: "Please upload the missing documents."
}, { idempotencyKey: persistenceFailureContext.idempotencyKey, sendSource: "ADMIN_SELECTED_APPLICANT" });
assert.equal(persistenceRetry.result, "IDEMPOTENT_REPLAY");
assert.equal(persistenceRetry.originalOutcome, "RECONCILIATION_REQUIRED");
assert.equal(persistenceRetry.rowPatchConfirmed, false);
assert.equal(dispatchGmailCalls, gmailCallsAfterPersistenceFailure, "Retry after Gmail acceptance and row failure must not resend");

const legacySecondSendContext = freshDispatchContext("LEGACY-SECOND", {
  rowObj: {
    Email_Attempt_Count: 0,
    Email_Status: "SENT",
    Last_Contact_Type: "docs_missing",
    Last_Contact_Result: "SENT",
    Last_Contact_DebugId: "OLDER-OPERATION"
  },
  successfulSendCount: 1
});
const legacySecondSend = dispatchContext.dispatchApplicantMessage_(legacySecondSendContext, {
  subject: "Second follow-up",
  body: "Please complete the next step."
}, { idempotencyKey: legacySecondSendContext.idempotencyKey, sendSource: "ADMIN_SELECTED_APPLICANT" });
assert.equal(legacySecondSend.result, "SENT");
assert.equal(dispatchContext.lastPatch.Email_Attempt_Count, 2, "Legacy SENT evidence with a zero counter must advance to successful send two");
assert.equal(
  Date.parse(dispatchContext.lastPatch.Email_Next_Action_Date) - Date.parse(dispatchContext.lastPatch.Email_Last_Sent_At),
  4 * dayMs,
  "Successful send two must write the four-day cadence"
);

const stageContext = freshDispatchContext("STAGE", {
  operationId: "",
  previewId: "",
  receiptId: "",
  idempotencyKey: "LEGACY-STAGE-IDEMPOTENCY",
  batchLabel: "STAGE_SEND::DOCS_REQUIRED::20260728",
  rowObj: {
    Email_Status: "SENT",
    Last_Contact_Type: "docs_missing",
    Last_Contact_Result: "SENT",
    Last_Contact_Batch: "STAGE_SEND::DOCS_REQUIRED::20260728"
  }
});
const gmailBeforeStageGuard = dispatchGmailCalls;
const patchesBeforeStageGuard = dispatchPatchCalls;
const stagePriorSuccess = dispatchContext.dispatchApplicantMessage_(stageContext, {
  subject: "Stage message",
  body: "Stage message body"
}, { idempotencyKey: stageContext.idempotencyKey, batchLabel: stageContext.batchLabel, sendSource: "ADMIN_STAGE_BATCH" });
assert.equal(stagePriorSuccess.result, "BLOCKED", "Stage Batch must retain its prior-success blocked accounting");
assert.equal(stagePriorSuccess.blockCode, "ALREADY_PROCESSED");
assert.equal(dispatchGmailCalls, gmailBeforeStageGuard, "Stage prior-success guard must not call Gmail");
assert.equal(dispatchPatchCalls, patchesBeforeStageGuard, "Stage prior-success guard must not write SUPPRESSED or any row state");

const exactOperationDifferentBatch = dispatchContext.wasEmailAlreadyProcessed_({
  applicantId: "FODE-EXACT-BATCH",
  messageType: "docs_missing",
  operationId: "COMM-OPERATION-EXACT-BATCH",
  batchLabel: "REQUEST-B",
  rowObj: {
    Last_Contact_Type: "docs_missing",
    Last_Contact_Result: "SENT",
    Last_Contact_DebugId: "COMM-OPERATION-EXACT-BATCH",
    Last_Contact_Batch: "REQUEST-A"
  }
}, "EMAIL-OPERATION-EXACT-BATCH");
assert.equal(exactOperationDifferentBatch.exactOperationMatch, true, "Exact operation identity must override a changed request/batch label");
assert.equal(exactOperationDifferentBatch.alreadyProcessed, true);

const authorityBlockedContext = freshDispatchContext("AUTHORITY-BLOCK", {
  eligible: false,
  blockCode: "DOCS_NOT_VERIFIED_FOR_PAYMENT",
  blockReason: "Documents are not verified."
});
const gmailBeforeAuthorityBlock = dispatchGmailCalls;
const patchesBeforeAuthorityBlock = dispatchPatchCalls;
const authorityBlocked = dispatchContext.dispatchApplicantMessage_(authorityBlockedContext, {
  subject: "Payment",
  body: "Payment body"
}, { idempotencyKey: authorityBlockedContext.idempotencyKey });
assert.equal(authorityBlocked.result, "BLOCKED");
assert.equal(authorityBlocked.blockCode, "DOCS_NOT_VERIFIED_FOR_PAYMENT");
assert.equal(dispatchGmailCalls, gmailBeforeAuthorityBlock);
assert.equal(dispatchPatchCalls, patchesBeforeAuthorityBlock);

let sendDispatchCalls = 0;
const sendReplayContext = {
  CONFIG: { ENABLE_PRODUCTION_EMAIL_SENDS: true },
  clean_: clean,
  isManualSingleSendProbeEnabled_: () => true,
  isSystemStabilizationModeActive_: () => false,
  logOperationalBlock_() {},
  newDebugId_: () => "DBG-SEND-REPLAY",
  resolveApplicantMessageContext_: () => ({
    eligible: true,
    applicantId: "FODE-SEND-REPLAY",
    messageType: "docs_missing",
    effectiveEmail: "parent@example.test",
    operationId: "COMM-OPERATION-SEND-REPLAY",
    previewId: "COMM-PREVIEW-SEND-REPLAY",
    receiptId: "COMM-RECEIPT-SEND-REPLAY",
    commandType: "SEND_INDIVIDUAL_COMMUNICATION",
    actor: "operator@example.test",
    stateFingerprint: "STATE-SEND-REPLAY",
    cooldownCycle: "SECOND_SEND_ELIGIBLE",
    debugId: "DBG-SEND-REPLAY"
  }),
  computeEmailIdempotencyKey_: () => "EMAIL-OPERATION-SEND-REPLAY",
  wasEmailAlreadyProcessed_: () => ({
    alreadyProcessed: true,
    originalOutcome: "SENT",
    originalGmailAccepted: true,
    originalRowPatchConfirmed: true,
    originalCommunicationRecorded: true
  }),
  communicationBlockReason_: code => code,
  dispatchApplicantMessage_() {
    sendDispatchCalls += 1;
    throw new Error("Exact replay must return before dispatch");
  }
};
vm.createContext(sendReplayContext);
vm.runInContext(extractFunction(codeSource, "sendApplicantMessage_"), sendReplayContext);
const sendReplay = sendReplayContext.sendApplicantMessage_("FODE-SEND-REPLAY", "docs_missing", {
  operationId: "COMM-OPERATION-SEND-REPLAY"
});
assert.equal(sendReplay.result, "IDEMPOTENT_REPLAY");
assert.equal(sendReplay.originalOutcome, "SENT");
assert.equal(sendReplay.receiptId, "COMM-RECEIPT-SEND-REPLAY");
assert.equal(sendDispatchCalls, 0, "sendApplicantMessage_ must return an exact replay before dispatch");

const contextResolverSource = extractFunction(codeSource, "resolveApplicantMessageContextFromRow_");
assert.ok(
  contextResolverSource.indexOf("if (!authority.ok)") < contextResolverSource.indexOf("if (communicationState.manualReviewRequired)"),
  "Genuine lifecycle/authority blocks must retain precedence over the attempt-three manual-review projection"
);
for (const prerequisiteGate of [
  "SUBJECTS_AUTHORITY_REQUIRED",
  "PORTAL_LINK_UNAVAILABLE",
  "DOCS_ALREADY_COMPLETE",
  "DOCS_NOT_VERIFIED_FOR_PAYMENT",
  "PAYMENT_ALREADY_RESOLVED",
  "PAYMENT_EVIDENCE_ALREADY_PRESENT",
  "QUOTE_NOT_READY"
]) {
  assert.ok(
    contextResolverSource.indexOf(prerequisiteGate) < contextResolverSource.indexOf("if (communicationState.manualReviewRequired)"),
    `${prerequisiteGate} must retain precedence over attempt-three manual review`
  );
}
assert.ok(
  contextResolverSource.indexOf("if (communicationState.manualReviewRequired)") < contextResolverSource.indexOf("context.eligible = true"),
  "Manual review must gate only an otherwise eligible third communication"
);
const dncResolverContext = {
  clean_: clean,
  newDebugId_: () => "DBG-DNC-RESOLVER",
  normalizeApplicantMessageType_: value => clean(value),
  communicationGetActorInfo_: () => ({ email: "operator@example.test", role: "ADMIN", isAdmin: true, isSuper: false }),
  communicationCompatibilityReadRow_: row => row,
  deriveCommunicationState_: row => ({
    applicantId: row.ApplicantID,
    communicationFamily: "documents",
    cooldownLastSentAt: "",
    cooldownActive: false,
    cooldownCycle: "SECOND_SEND_ELIGIBLE",
    manualReviewRequired: false,
    successfulSendCount: 1,
    base: {
      effectiveEmail: "parent@example.test",
      hasEffectiveEmail: true,
      hasValidEffectiveEmail: true,
      emailStatus: "SENT",
      portalSubmittedActive: false,
      bounceFlag: false,
      docsVerified: false,
      paymentVerified: false,
      requiresPortalUrl: false,
      docsMissing: true,
      actualContactEvidence: {
        blocked: true,
        doNotContact: true,
        bounced: false,
        invalid: false,
        failed: false,
        reason: "DO_NOT_CONTACT"
      }
    }
  }),
  communicationCapabilityBlock_: () => null,
  resolveCanonicalApplicantLifecycle_: () => ({ baseState: "DOCS_REQUIRED" }),
  evaluateCommunicationAuthority_: () => ({
    ok: true,
    protectedCommunication: false,
    overridePermitted: false,
    overrideApplied: false,
    prerequisiteChecks: [],
    missingPrerequisites: [],
    lifecycleStage: "DOCS_REQUIRED",
    legacyLifecycleStage: "DOCS_REQUIRED",
    applicantState: "DOCS_REQUIRED"
  }),
  getCommunicationSemanticDefinition_: () => ({ requiresValidEmail: true }),
  isPortalCommunicationMessageType_: () => false,
  communicationBlockReason_: code => code,
  communicationRequiresSubjects_: () => false,
  communicationRequiresResolvedActionPlaceholders_: () => false
};
vm.createContext(dncResolverContext);
vm.runInContext(contextResolverSource, dncResolverContext);
const dncResolverResult = dncResolverContext.resolveApplicantMessageContextFromRow_({
  ApplicantID: "FODE-DNC-RESOLVER",
  Email_Status: "SENT",
  Do_Not_Contact: "YES"
}, 2, {}, "docs_missing", { action: "send" });
assert.equal(dncResolverResult.eligible, false);
assert.equal(dncResolverResult.blockCode, "DO_NOT_CONTACT", "Separate DNC authority must block the actual resolver before any Gmail path");

assert.match(adminSource, /communicationCompatibilityReadRow_/, "Admin contactability projection must consume upstream communication compatibility normalization");
const detailSource = extractFunction(adminSource, "admin_getApplicantDetail");
assert.match(detailSource, /Email_Status_Raw/, "Applicant detail must preserve raw compatibility status for diagnostics");
assert.match(detailSource, /Do_Not_Contact:\s*idx\.Do_Not_Contact/, "Applicant detail must hydrate the separate DNC authority flag");
assert.match(detailSource, /DO_NOT_CONTACT:\s*idx\.DO_NOT_CONTACT/, "Applicant detail must hydrate the uppercase DNC compatibility flag");
assert.match(detailSource, /detailCommunicationView\s*=\s*typeof communicationCompatibilityReadRow_/, "Applicant detail must normalize false suppression before returning the active UI DTO");
assert.ok(
  detailSource.indexOf("detailCommunicationView") < detailSource.indexOf("var resultObject = { ok: true, detail: detailObj }"),
  "Selected-applicant detail must normalize communication fields before returning to Admin UI"
);
const adminContactContext = {
  clean_: clean,
  communicationCompatibilityReadRow_: compatibilityContext.communicationCompatibilityReadRow_,
  isCampaignBounceFlagTrue_: value => value === true || /^(YES|TRUE|1)$/i.test(clean(value))
};
vm.createContext(adminContactContext);
vm.runInContext(extractFunction(adminSource, "adminOpsFirstNonBlank_"), adminContactContext);
vm.runInContext(extractFunction(adminSource, "adminOpsHasEmailIssue_"), adminContactContext);
assert.equal(adminContactContext.adminOpsHasEmailIssue_(normalizedFalseSuppressed), false, "False duplicate suppression must not become a contactability failure");
assert.equal(adminContactContext.adminOpsHasEmailIssue_({
  Email_Status: "BOUNCED",
  Email_Bounce_Flag: "YES",
  Email_Bounce_Reason: "Permanent delivery failure"
}), true, "Genuine bounced email must remain a contactability failure");
assert.equal(adminContactContext.adminOpsHasEmailIssue_(hardBounceReasonOnly), true, "Reason-only hard bounce must remain an Admin contactability failure");
assert.equal(adminContactContext.adminOpsHasEmailIssue_(permanentDeliveryHealth), true, "Permanent delivery health must remain an Admin contactability failure");
assert.equal(adminContactContext.adminOpsHasEmailIssue_(temporaryDeliveryHealth), false, "Temporary delivery health must remain in cadence/cooldown authority");
assert.equal(adminContactContext.adminOpsHasEmailIssue_(doNotContactCompatibility), true, "Separate DNC evidence must remain an Admin contactability failure");

const actionabilityContext = {
  clean_: clean,
  communicationRecommendedMessageTypeForStage_: () => ""
};
vm.createContext(actionabilityContext);
vm.runInContext(extractFunction(adminSource, "actionabilityBatchMessageTypeForRecommendation_"), actionabilityContext);
vm.runInContext(extractFunction(adminSource, "resolveActionabilityState_"), actionabilityContext);
const noEmailBlock = actionabilityContext.resolveActionabilityState_({
  owner: "APPLICANT",
  nextAction: "UPLOAD_REQUIRED_DOCUMENTS",
  suppressor: "NO_EFFECTIVE_EMAIL"
});
assert.equal(noEmailBlock.actionabilityState, "REVIEW_REQUIRED");
assert.equal(noEmailBlock.reasonCode, "NO_EFFECTIVE_EMAIL");
const bounceBlock = actionabilityContext.resolveActionabilityState_({
  owner: "APPLICANT",
  nextAction: "UPLOAD_REQUIRED_DOCUMENTS",
  suppressor: "EMAIL_BLOCKED_OR_BOUNCED"
});
assert.equal(bounceBlock.actionabilityState, "REVIEW_REQUIRED");
assert.equal(bounceBlock.reasonCode, "EMAIL_BLOCKED_OR_BOUNCED");
const cooldownBlock = actionabilityContext.resolveActionabilityState_({
  owner: "APPLICANT",
  nextAction: "UPLOAD_REQUIRED_DOCUMENTS",
  suppressor: "COOLDOWN_ACTIVE",
  coolingOffUntil: "2026-07-30T00:00:00.000Z"
});
assert.equal(cooldownBlock.actionabilityState, "COOLING_OFF");
assert.equal(cooldownBlock.reasonCode, "COOLDOWN_ACTIVE");
const authorityBlock = actionabilityContext.resolveActionabilityState_({
  owner: "OFFICER",
  nextAction: "REVIEW_DOCUMENTS",
  suppressor: "OFFICER_ACTION_PENDING"
});
assert.equal(authorityBlock.actionabilityState, "REVIEW_REQUIRED");
assert.equal(authorityBlock.reasonCode, "OFFICER_ACTION_PENDING");
const manualReviewBlock = actionabilityContext.resolveActionabilityState_({
  owner: "APPLICANT",
  nextAction: "MANUAL_COMMUNICATION_REVIEW",
  suppressor: "MANUAL_REVIEW_REQUIRED"
});
assert.equal(manualReviewBlock.actionabilityState, "REVIEW_REQUIRED");
assert.equal(manualReviewBlock.reasonCode, "MANUAL_REVIEW_REQUIRED");

const historyContext = {
  app: {
    authorityUnavailable(domain) { return `Unavailable ${domain}`; },
    esc(value) {
      return String(value == null ? "" : value).replace(/[&<>"']/g, character => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
      })[character]);
    },
    formatPngDate(value) {
      if (value == null || value === "") return "Not scheduled";
      const date = value instanceof Date ? value : new Date(value);
      if (Number.isNaN(date.getTime())) return "Not scheduled";
      const parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Pacific/Port_Moresby",
        day: "numeric",
        month: "long",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
        hour12: true
      }).formatToParts(date);
      const byType = {};
      parts.forEach(part => { if (part.type !== "literal") byType[part.type] = part.value; });
      return [byType.day, byType.month, byType.year].join(" ") + ", " + byType.hour + ":" + byType.minute + " " + String(byType.dayPeriod || "").toUpperCase();
    }
  }
};
vm.createContext(historyContext);
for (const name of ["displayValue", "definition", "historyListHtml"]) {
  vm.runInContext(extractFunction(workbenchSource, name), historyContext);
}
const historyHtml = historyContext.historyListHtml({
  schemaVersion: "EDUOPS_OPERATION_HISTORY_V1",
  receipts: [{
    operation: "SEND_INDIVIDUAL_COMMUNICATION",
    outcome: "BLOCKED",
    blockCode: "AUTHORITY_PENDING",
    blockReason: "Admissions authority review is still pending.",
    receiptId: "EDUOPS-RECEIPT-HISTORY-EXACT",
    actor: "operator@example.test",
    occurredAt: "2026-07-28T23:15:00.000Z",
    occurredAtPng: "29 July 2026, 9:15 am",
    communication: { templateLabel: "Missing Documents" }
  }],
  communicationReceipts: []
}, false);
for (const label of [
  "Operation",
  "Outcome",
  "Block code",
  "Block reason",
  "Receipt ID",
  "Actor",
  "PNG-local date/time",
  "Technical timestamp"
]) {
  assert.match(historyHtml, new RegExp(`<dt>${label}</dt>`), `History must render labelled ${label}`);
}
assert.match(historyHtml, /<dd>BLOCKED<\/dd>/);
assert.match(historyHtml, /<dd>AUTHORITY_PENDING<\/dd>/);
assert.match(historyHtml, /<dd>EDUOPS-RECEIPT-HISTORY-EXACT<\/dd>/);
assert.match(historyHtml, /<dd>29 July 2026, 9:15 AM<\/dd>/, "History must render PNG-local display from the technical timestamp");
assert.match(historyHtml, /<dd>2026-07-28T23:15:00.000Z<\/dd>/, "History must retain the separate technical timestamp");
assert.doesNotMatch(historyHtml, /BLOCKEDEDUOPS-RECEIPT/, "Outcome and receipt ID must never be concatenated");

const unblockedHistoryHtml = historyContext.historyListHtml({
  schemaVersion: "EDUOPS_OPERATION_HISTORY_V1",
  receipts: [{
    operation: "SEND_INDIVIDUAL_COMMUNICATION",
    outcome: "SENT",
    blockCode: "",
    blockReason: "",
    receiptId: "EDUOPS-RECEIPT-HISTORY-SENT",
    actor: "operator@example.test",
    occurredAt: "2026-07-28T23:15:00.000Z",
    occurredAtPng: "29 July 2026, 9:15 am"
  }],
  communicationReceipts: []
}, false);
assert.doesNotMatch(unblockedHistoryHtml, /<dt>Block code<\/dt>|<dt>Block reason<\/dt>/, "History must hide block fields only when no blocker exists");

const correctedHistoryHtml = historyContext.historyListHtml({
  schemaVersion: "EDUOPS_OPERATION_HISTORY_V1",
  receipts: [{
  operation: "SEND_INDIVIDUAL_COMMUNICATION",
  outcome: "BLOCKED",
  blockCode: "PREVIEW_STALE",
  blockReason: "Preview expired.",
  receiptId: "EDUOPS-RECEIPT-PREVIEW-STALE",
  actor: "operator@example.test",
  occurredAt: "2026-07-30T03:52:18.845Z",
  occurredAtPng: "30 July 2026, 11:52 AM"
  }],
  communicationReceipts: []
}, false);
assert.match(correctedHistoryHtml, /<dd>30 July 2026, 1:52 PM<\/dd>/, "Audit must convert the proven PREVIEW_STALE receipt time to PNG-local UTC+10");
assert.match(correctedHistoryHtml, /<dd>2026-07-30T03:52:18.845Z<\/dd>/, "Audit must preserve the proven technical ISO timestamp");
assert.match(correctedHistoryHtml, /<dd>PREVIEW_STALE<\/dd>/, "Audit must keep the PREVIEW_STALE block code visible");
assert.doesNotMatch(correctedHistoryHtml, /11:52 AM/, "Audit must not display the stale two-hour-shifted PNG-local timestamp");

let selectedPreviewCapture = null;
let selectedSendCapture = null;
let selectedIdentitySequence = 0;
const individualLockEvents = [];
const individualPreviewCache = new Map();
let individualLockHeld = false;
let individualCacheReadsWhileLocked = 0;
const selectedContext = {
  CONFIG: { OPS_SAFE_MODE_TEST_RECIPIENT_OVERRIDE: "" },
  adminCapabilityBlockCode_: capability => `${capability}_REQUIRED`,
  adminCapabilityBlockReason_: capability => `${capability} is required.`,
  adminCommBlockedResult_: (_action, code, _debugId, more) => ({ ok: false, blockCode: code, ...(more || {}) }),
  adminHasCapability_: () => true,
  CacheService: {
    getUserCache() {
      return {
        get(key) {
          if (individualLockHeld) individualCacheReadsWhileLocked += 1;
          return individualPreviewCache.has(key) ? individualPreviewCache.get(key) : null;
        },
        put(key, value) { individualPreviewCache.set(key, value); }
      };
    }
  },
  clean_: clean,
  getCallerEmail_: () => "operator@example.test",
  isAdmin_: () => true,
  LockService: {
    getUserLock() {
      return {
        tryLock(timeoutMs) {
          individualLockEvents.push(`acquire:${timeoutMs}`);
          individualLockHeld = true;
          return true;
        },
        releaseLock() {
          individualLockEvents.push("release");
          individualLockHeld = false;
        }
      };
    }
  },
  logOpsSafeModeEvent_() {},
  newDebugId_: () => `SERVER-IDENTITY-${++selectedIdentitySequence}`,
  normalizeApplicantMessageType_: value => clean(value),
  previewApplicantMessage_(applicantId, messageType, options) {
    selectedPreviewCapture = { applicantId, messageType, options };
    return {
      ok: true,
      result: "PREVIEW",
      effectiveEmail: options.editedRecipient || "parent@example.test",
      subject: options.editedSubject || "Approved preview subject",
      body: options.editedBody || "Approved preview body",
      cc: options.cc || "",
      bcc: options.bcc || ""
    };
  },
  resolveAdminCommActor_: () => ({ actorEmail: "operator@example.test", actorRole: "ADMIN" }),
  runOpsSafeModeGate_: () => ({ ok: true, safeMode: false }),
  safeStr_: clean,
  sendApplicantMessage_(applicantId, messageType, options) {
    selectedSendCapture = { applicantId, messageType, options };
    return { ok: true, result: "SENT" };
  },
  withEnvelope_: (_name, callback) => callback("DBG-R390B1")
};
vm.createContext(selectedContext);
vm.runInContext(extractFunction(selectedSource, "adminCommunicationOperationIdentity_"), selectedContext);
vm.runInContext(extractFunction(selectedSource, "adminIndividualCommunicationPreviewCacheKey_"), selectedContext);
vm.runInContext(extractFunction(selectedSource, "adminCanonicalIndividualCommunicationPayload_"), selectedContext);
vm.runInContext(extractFunction(selectedSource, "adminWriteIndividualCommunicationPreview_"), selectedContext);
vm.runInContext(extractFunction(selectedSource, "adminReadIndividualCommunicationPreview_"), selectedContext);
vm.runInContext(extractFunction(selectedSource, "adminIndividualCommunicationPreviewMatches_"), selectedContext);
vm.runInContext(extractFunction(selectedSource, "adminBindIndividualCommunicationPreview_"), selectedContext);
vm.runInContext(extractFunction(selectedSource, "adminCommunicationWithIdentity_"), selectedContext);
vm.runInContext(extractFunction(selectedSource, "withAdminIndividualCommunicationLock_"), selectedContext);
vm.runInContext(extractFunction(selectedSource, "admin_previewApplicantMessage"), selectedContext);
vm.runInContext(extractFunction(selectedSource, "admin_sendApplicantMessage"), selectedContext);
const canonicalPreview = selectedContext.adminCanonicalIndividualCommunicationPayload_({
  recipient: " parent@example.test ",
  subject: "Missing documents\r\n",
  body: "Line one\r\nLine two\rLine three",
  cc: " ",
  bcc: "",
  templateId: " docs_missing ",
  templateVersionId: " 1 "
});
assert.equal(JSON.stringify(canonicalPreview), JSON.stringify({
  recipient: "parent@example.test",
  subject: "Missing documents\n",
  body: "Line one\nLine two\nLine three",
  cc: "",
  bcc: "",
  templateId: "docs_missing",
  templateVersionId: "1",
  authorityOverride: false,
  authorityOverrideReason: ""
}), "Preview fingerprint inputs must be canonicalized once with stable line endings and empty CC/BCC");
const followUpIdentityA = selectedContext.adminCommunicationOperationIdentity_({}, "FODE-SELECTED-R390B1", "docs_missing", "operator@example.test", "DBG-FOLLOW-UP-A");
const followUpIdentityB = selectedContext.adminCommunicationOperationIdentity_({}, "FODE-SELECTED-R390B1", "docs_missing", "operator@example.test", "DBG-FOLLOW-UP-B");
assert.notEqual(followUpIdentityA.operationId, followUpIdentityB.operationId, "A later eligible follow-up must receive a new operation identity");
assert.equal(followUpIdentityA.actor, "operator@example.test");
const spoofedActorIdentity = selectedContext.adminCommunicationOperationIdentity_({
  operationId: "COMM-OPERATION-SPOOF",
  previewId: "COMM-PREVIEW-SPOOF",
  receiptId: "COMM-RECEIPT-SPOOF",
  commandType: "SEND_INDIVIDUAL_COMMUNICATION",
  actor: "spoofed@example.test"
}, "FODE-SELECTED-R390B1", "docs_missing", "operator@example.test", "DBG-SPOOF");
assert.equal(spoofedActorIdentity.ok, false, "Client-supplied actor identity must not override the authenticated actor");
assert.equal(spoofedActorIdentity.blockCode, "COMMUNICATION_IDENTITY_MISMATCH");
const partialIdentity = selectedContext.adminCommunicationOperationIdentity_({
  operationId: "COMM-OPERATION-PARTIAL"
}, "FODE-SELECTED-R390B1", "docs_missing", "operator@example.test", "DBG-PARTIAL");
assert.equal(partialIdentity.ok, false, "Partial operation identity must fail closed");
const wrongCommandIdentity = selectedContext.adminCommunicationOperationIdentity_({
  operationId: "COMM-OPERATION-COMMAND",
  previewId: "COMM-PREVIEW-COMMAND",
  receiptId: "COMM-RECEIPT-COMMAND",
  commandType: "BATCH_COMMUNICATION",
  actor: "operator@example.test"
}, "FODE-SELECTED-R390B1", "docs_missing", "operator@example.test", "DBG-COMMAND");
assert.equal(wrongCommandIdentity.ok, false, "Individual endpoint command type must be server-bound");

const repeatedClientDebugA = selectedContext.admin_previewApplicantMessage({
  applicantId: "FODE-SELECTED-R390B1",
  messageType: "docs_missing",
  debugId: "CLIENT-REPEATED-DEBUG"
});
const repeatedClientDebugB = selectedContext.admin_previewApplicantMessage({
  applicantId: "FODE-SELECTED-R390B1",
  messageType: "docs_missing",
  debugId: "CLIENT-REPEATED-DEBUG"
});
assert.notEqual(repeatedClientDebugA.operationId, repeatedClientDebugB.operationId, "Repeated client debug IDs must not reuse operation identity");
assert.notEqual(repeatedClientDebugA.receiptId, repeatedClientDebugB.receiptId, "Every new preview must receive a unique receipt ID");

const fingerprintIdentity = selectedContext.adminCommunicationOperationIdentity_({
  operationId: "EDUOPS-OPERATION-FINGERPRINT",
  previewId: "EDUOPS-PREVIEW-FINGERPRINT",
  receiptId: "EDUOPS-RECEIPT-FINGERPRINT",
  commandType: "SEND_INDIVIDUAL_COMMUNICATION",
  actor: "operator@example.test",
  stateFingerprint: "EDUOPS-STATE-FINGERPRINT",
  cooldownCycle: "R391DE-CYCLE",
  idempotencyKey: "EDUOPS-IDEMPOTENCY-FINGERPRINT"
}, "FODE-FINGERPRINT", "docs_missing", "operator@example.test", "DBG-FINGERPRINT");
const fingerprintApproved = selectedContext.adminWriteIndividualCommunicationPreview_(
  "FODE-FINGERPRINT",
  "docs_missing",
  fingerprintIdentity,
  {
    templateId: "docs_missing",
    templateVersionId: "1",
    recipient: "parent@example.test",
    cc: "",
    bcc: "",
    subject: "Missing documents",
    body: "Open the secure applicant portal.\r\nhttps://portal.example.test/FODE-FINGERPRINT"
  },
  {
    effectiveEmail: "parent@example.test",
    cc: "",
    bcc: "",
    subject: "Missing documents",
    body: "Open the secure applicant portal.\nhttps://portal.example.test/FODE-FINGERPRINT"
  }
);
assert.equal(selectedContext.adminIndividualCommunicationPreviewMatches_(fingerprintApproved, {
  recipient: "parent@example.test",
  cc: "",
  bcc: "",
  templateId: "docs_missing",
  templateVersionId: "1",
  subject: "Missing documents",
  body: "Open the secure applicant portal.\r\nhttps://portal.example.test/FODE-FINGERPRINT"
}).ok, true, "Unchanged preview payload must pass fingerprint validation before expiry");
assert.equal(selectedContext.adminIndividualCommunicationPreviewMatches_(fingerprintApproved, {
  recipient: "parent@example.test",
  cc: "  ",
  bcc: "",
  templateId: "docs_missing",
  templateVersionId: "1",
  subject: "Missing documents",
  body: "Open the secure applicant portal.\r\nhttps://portal.example.test/FODE-FINGERPRINT"
}).ok, true, "Empty CC/BCC canonicalization must be stable");
assert.equal(selectedContext.adminIndividualCommunicationPreviewMatches_(fingerprintApproved, {
  recipient: "parent@example.test",
  templateId: "docs_missing",
  templateVersionId: "1",
  subject: "Missing documents",
  body: "Open the secure applicant portal.\r\nhttps://portal.example.test/FODE-FINGERPRINT"
}).ok, true, "Hydrated portal content must remain stable across CRLF/LF readback");
for (const [field, value] of [
  ["recipient", "changed@example.test"],
  ["templateId", "payment_followup"],
  ["subject", "Changed subject"],
  ["body", "Changed body"]
]) {
  const operation = {
    recipient: "parent@example.test",
    cc: "",
    bcc: "",
    templateId: "docs_missing",
    templateVersionId: "1",
    subject: "Missing documents",
    body: "Open the secure applicant portal.\nhttps://portal.example.test/FODE-FINGERPRINT"
  };
  operation[field] = value;
  const mismatch = selectedContext.adminIndividualCommunicationPreviewMatches_(fingerprintApproved, operation);
  assert.equal(mismatch.ok, false, `Changed ${field} must be blocked`);
  assert.equal(mismatch.code, "PREVIEW_STALE");
  assert.equal(mismatch.mismatchedField, field);
}
selectedPreviewCapture = null;
selectedSendCapture = null;
selectedContext.admin_previewApplicantMessage({
  applicantId: "FODE-FINGERPRINT-BLOCK",
  messageType: "docs_missing",
  templateId: "docs_missing",
  recipient: "parent@example.test",
  subject: "Missing documents",
  body: "Open the secure applicant portal.\nhttps://portal.example.test/FODE-FINGERPRINT-BLOCK"
});
const blockedFingerprintSend = selectedContext.admin_sendApplicantMessage({
  applicantId: "FODE-FINGERPRINT-BLOCK",
  messageType: "docs_missing",
  templateId: "docs_missing",
  recipient: "changed@example.test",
  subject: "Missing documents",
  body: "Open the secure applicant portal.\nhttps://portal.example.test/FODE-FINGERPRINT-BLOCK",
  confirmManualSingleSend: true
});
assert.equal(blockedFingerprintSend.blockCode, "PREVIEW_STALE", "Changed recipient after preview must block at preview validation");
assert.equal(blockedFingerprintSend.mismatchedField, "recipient", "Blocked send must expose the exact mismatched fingerprint input");
assert.equal(selectedSendCapture, null, "Preview validation failure must not enter the Gmail-capable send implementation");
individualLockEvents.length = 0;
individualCacheReadsWhileLocked = 0;

const opsIdentitylessPreview = selectedContext.admin_previewApplicantMessage({
  applicantId: "FODE-OPS-IDENTITYLESS",
  messageType: "docs_missing",
  sourceSurface: "ops",
  sourceView: "ops"
});
selectedContext.admin_sendApplicantMessage({
  applicantId: "FODE-OPS-IDENTITYLESS",
  messageType: "docs_missing",
  confirmManualSingleSend: true,
  sourceSurface: "ops",
  sourceView: "ops"
});
assert.equal(selectedSendCapture.options.operationId, opsIdentitylessPreview.operationId, "Identity-less Ops send must consume the server-cached preview operation ID");
assert.equal(selectedSendCapture.options.previewId, opsIdentitylessPreview.previewId);
assert.equal(selectedSendCapture.options.receiptId, opsIdentitylessPreview.receiptId);
assert.equal(selectedSendCapture.options.editedRecipient, opsIdentitylessPreview.effectiveEmail, "Ops send must bind the approved preview recipient");
assert.equal(selectedSendCapture.options.editedSubject, opsIdentitylessPreview.subject, "Ops send must bind the approved preview subject");
assert.equal(selectedSendCapture.options.editedBody, opsIdentitylessPreview.body, "Ops send must bind the approved preview body");
assert.equal(selectedSendCapture.options.cc, opsIdentitylessPreview.cc || "");
assert.equal(selectedSendCapture.options.bcc, opsIdentitylessPreview.bcc || "");
assert.equal(selectedSendCapture.options.templateId, "docs_missing");
assert.equal(selectedSendCapture.options.templateVersionId, "");
assert.equal(selectedSendCapture.options.authorityOverride, false);
assert.equal(individualCacheReadsWhileLocked, 1, "Approved preview identity and content must be re-read inside the send lock");

const selectedPayload = {
  applicantId: "FODE-SELECTED-R390B1",
  messageType: "docs_missing",
  templateId: "docs_missing",
  templateVersionId: "1",
  operationId: "EDUOPS-OPERATION-SELECTED",
  previewId: "EDUOPS-PREVIEW-SELECTED",
  receiptId: "EDUOPS-RECEIPT-SELECTED",
  commandType: "SEND_INDIVIDUAL_COMMUNICATION",
  actor: "operator@example.test",
  stateFingerprint: "EDUOPS-STATE-SELECTED",
  cooldownCycle: "AFTER_FIRST_SUCCESS",
  idempotencyKey: "EDUOPS-IDEMPOTENCY-SELECTED",
  confirmManualSingleSend: true
};
selectedContext.admin_previewApplicantMessage(selectedPayload);
selectedContext.admin_sendApplicantMessage(selectedPayload);
for (const capture of [selectedPreviewCapture, selectedSendCapture]) {
  assert.ok(capture, "Selected-applicant wrapper must reach the bounded communication authority");
  assert.equal(capture.applicantId, selectedPayload.applicantId);
  assert.equal(capture.messageType, selectedPayload.messageType);
  for (const field of [
    "operationId",
    "previewId",
    "receiptId",
    "commandType",
    "actor",
    "stateFingerprint",
    "cooldownCycle",
    "idempotencyKey"
  ]) {
    assert.equal(capture.options[field], selectedPayload[field], `Selected-applicant authority must preserve ${field}`);
  }
}
assert.deepEqual(individualLockEvents, ["acquire:30000", "release", "acquire:30000", "release"], "Each direct selected-applicant send must hold one user lock across recheck and dispatch");
const directSendSource = extractFunction(selectedSource, "admin_sendApplicantMessage");
assert.ok(
  directSendSource.indexOf("withAdminIndividualCommunicationLock_") < directSendSource.indexOf("sendApplicantMessage_"),
  "Direct send must acquire its lock before the underlying idempotency recheck and Gmail path"
);
const communicationsResultSource = extractFunction(read("AdminUI.html"), "renderCommunicationsResult_");
assert.match(communicationsResultSource, /Already processed/, "Admin UI must render idempotent replay as an explicit outcome");
assert.match(communicationsResultSource, /no email was resent/, "Admin UI replay must state that Gmail was not called again");
assert.match(communicationsResultSource, /Receipt ID/, "Admin UI replay must expose the receipt identity");
assert.match(communicationsResultSource, /Operation ID/, "Admin UI replay must expose the operation identity");
assert.match(communicationsResultSource, /Reconciliation required/, "Admin UI must distinguish post-send reconciliation from a preview");
assert.match(communicationsResultSource, /Do not retry until the operation is reconciled/, "Admin UI must prevent unsafe retry after Gmail acceptance");
assert.match(communicationsResultSource, /Manual review required/, "Attempt three or later must be visibly routed to manual review");
assert.equal(gmailCalls, 0, "R390B1 automated contract tests must not send Gmail");

console.log("PASS R390B1 communication safety, identity, cadence, contactability, receipt, history, and Stage Batch freeze contracts");
