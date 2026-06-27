const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const codeSource = fs.readFileSync("Code.js", "utf8");
const adminSource = fs.readFileSync("Admin.js", "utf8");
const adminUiSource = fs.readFileSync("AdminUI.html", "utf8");
const sharedRowFactsSource = fs.readFileSync("AdminUI_SharedRowFacts.html", "utf8");

function extractFunction(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Function ${name} must exist`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "\"" || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Function ${name} is not closed`);
}

function assertNoRawPaymentDecision(functionSource, label) {
  assert.doesNotMatch(functionSource, /clean_\([^)]*Payment_Verified/, `${label} must not clean raw Payment_Verified as authority`);
  assert.doesNotMatch(functionSource, /isYes_\([^)]*Payment_Verified/, `${label} must not use raw Payment_Verified as authority`);
  assert.doesNotMatch(functionSource, /adminOpsIsYes_\([^)]*Payment_Verified/, `${label} must not use raw Payment_Verified as authority`);
  assert.doesNotMatch(functionSource, /opsIsYes_\([^)]*Payment_Verified/, `${label} must not use raw Payment_Verified as authority`);
  assert.doesNotMatch(functionSource, /workflowYesNo_\([^)]*Payment_Verified/, `${label} must not use raw Payment_Verified as authority`);
  assert.doesNotMatch(functionSource, /Payment_Verified_Bool/, `${label} must not use compatibility boolean as authority`);
}

const context = {
  CONFIG: {
    CRM_STAGE_ADMISSION_GRANTED: "Admission Granted",
    CRM_STAGE_PAYMENT_CONFIRMED: "Payment Confirmed"
  },
  clean_: (value) => String(value == null ? "" : value).trim(),
  hasOwn_: (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key),
  hasUploadEvidence_: (value) => {
    const text = String(value == null ? "" : value).trim();
    return !!text && text !== "[]" && text !== "{}";
  },
  normalizeEmailStatus_: (value) => String(value == null ? "" : value).trim().toUpperCase(),
  isCampaignPortalSubmittedActive_: (row) => String((row || {}).Portal_Submitted || "").trim() === "Yes",
  isCampaignBounceFlagTrue_: () => false,
  campaignAttemptCount_: () => 0,
  parseTime_: () => 0,
  logOperationalBlock_: () => {}
};
vm.createContext(context);
vm.runInContext([
  extractFunction(codeSource, "resolveDocStatusKeys_"),
  extractFunction(codeSource, "normalizeOverallDocValue_"),
  extractFunction(codeSource, "computeDocVerificationStatus_"),
  extractFunction(codeSource, "derivePaymentBadge_"),
  extractFunction(codeSource, "deriveCanonicalPaymentState_"),
  extractFunction(codeSource, "canonicalPaymentBadge_"),
  extractFunction(codeSource, "isCanonicalPaymentVerified_"),
  extractFunction(codeSource, "isCanonicalPaymentRejected_"),
  extractFunction(codeSource, "deriveFodeCrmStageFromRow_"),
  extractFunction(codeSource, "communicationPaymentOutstanding_"),
  extractFunction(codeSource, "deriveApplicantLifecycleStage_")
].join("\n\n"), context);

assert.equal(
  context.deriveFodeCrmStageFromRow_({ Payment_Verified: "Yes", Receipt_Status: "" }),
  "",
  "raw Payment_Verified Yes with blank Receipt_Status must not produce a payment CRM stage"
);
assert.equal(
  context.deriveFodeCrmStageFromRow_({ Payment_Verified: "Yes", Receipt_Status: "Rejected" }),
  "",
  "raw Payment_Verified Yes with rejected Receipt_Status must not produce a payment CRM stage"
);
assert.equal(
  context.deriveFodeCrmStageFromRow_({ Payment_Verified: "", Receipt_Status: "Verified" }),
  "Payment Confirmed",
  "canonical Receipt_Status Verified must produce the payment CRM stage even when raw Payment_Verified is blank"
);

assert.equal(
  context.communicationPaymentOutstanding_({ Payment_Verified: "Yes", Receipt_Status: "" }),
  true,
  "payment follow-up must not be suppressed by stale raw Payment_Verified"
);
assert.equal(
  context.communicationPaymentOutstanding_({ Payment_Verified: "Yes", Receipt_Status: "Rejected" }),
  true,
  "payment follow-up must remain outstanding when canonical receipt authority is rejected"
);
assert.equal(
  context.communicationPaymentOutstanding_({ Payment_Verified: "", Receipt_Status: "Verified" }),
  false,
  "payment follow-up must be suppressed only by canonical receipt verification"
);

assert.notEqual(
  context.deriveApplicantLifecycleStage_({ Docs_Verified: "Yes", Payment_Verified: "Yes", Receipt_Status: "" }),
  "COMPLETE",
  "raw Payment_Verified Yes must not complete lifecycle when Receipt_Status is blank"
);
assert.notEqual(
  context.deriveApplicantLifecycleStage_({ Docs_Verified: "Yes", Payment_Verified: "Yes", Receipt_Status: "Rejected" }),
  "COMPLETE",
  "raw Payment_Verified Yes must not complete lifecycle when Receipt_Status is rejected"
);
assert.equal(
  context.deriveApplicantLifecycleStage_({ Docs_Verified: "Yes", Payment_Verified: "", Receipt_Status: "Verified" }),
  "COMPLETE",
  "canonical Receipt_Status Verified must complete lifecycle even when raw Payment_Verified is blank"
);

const adminDetail = extractFunction(adminSource, "admin_getApplicantDetail");
assert.match(adminDetail, /Payment_Verified_Raw/, "Applicant detail must expose raw payment only as explicit raw compatibility evidence");
assert.match(adminDetail, /Payment_Verified = paymentVerifiedBool \? "Yes" : "No"/, "Applicant detail Payment_Verified projection must follow canonical payment badge");
assert.match(adminDetail, /paymentVerified = paymentVerifiedBool/, "Applicant detail paymentVerified boolean must follow canonical payment badge");
assert.match(adminDetail, /isPaymentVerified = paymentVerifiedBool/, "Applicant detail isPaymentVerified boolean must follow canonical payment badge");

const nonQueueAdminConsumers = [
  ["isQueueCandidateRow_", extractFunction(adminSource, "isQueueCandidateRow_")],
  ["deriveOperationalPipelineStage_", extractFunction(adminSource, "deriveOperationalPipelineStage_")],
  ["buildActionabilityPreviewRow_", extractFunction(adminSource, "buildActionabilityPreviewRow_")],
  ["adminOpsLifecycleStageKeyFromRow_", extractFunction(adminSource, "adminOpsLifecycleStageKeyFromRow_")],
  ["buildOpsClassroomHandoverContext_", extractFunction(adminSource, "buildOpsClassroomHandoverContext_")]
];
for (const [name, source] of nonQueueAdminConsumers) {
  assert.match(source, /canonicalPaymentBadge_|isCanonicalPaymentVerified_/, `${name} must use canonical payment helpers`);
  assertNoRawPaymentDecision(source, name);
}

const crmStage = extractFunction(codeSource, "deriveFodeCrmStageFromRow_");
const lifecycle = extractFunction(codeSource, "deriveApplicantLifecycleStage_");
const communicationOutstanding = extractFunction(codeSource, "communicationPaymentOutstanding_");
assertNoRawPaymentDecision(crmStage, "deriveFodeCrmStageFromRow_");
assertNoRawPaymentDecision(lifecycle, "deriveApplicantLifecycleStage_");
assertNoRawPaymentDecision(communicationOutstanding, "communicationPaymentOutstanding_");
assert.match(
  codeSource,
  /paymentVerified:\s*isCanonicalPaymentVerified_\(row\)/,
  "communication base state must use canonical payment helper"
);

const opsClassroom = extractFunction(adminUiSource, "opsClassroomStateFromRawRow_");
const opsPaymentEvidence = extractFunction(adminUiSource, "opsPaymentEvidenceStatus_");
const pendingDocsOrPayment = extractFunction(adminUiSource, "isApplicantPendingDocsOrPayment_");
const operationalPaymentState = extractFunction(sharedRowFactsSource, "operationalStatePaymentState_");
const sharedBillingFacts = extractFunction(sharedRowFactsSource, "opsBillingRowFacts_");
assertNoRawPaymentDecision(opsClassroom, "opsClassroomStateFromRawRow_");
assertNoRawPaymentDecision(opsPaymentEvidence, "opsPaymentEvidenceStatus_");
assertNoRawPaymentDecision(pendingDocsOrPayment, "isApplicantPendingDocsOrPayment_");
assertNoRawPaymentDecision(operationalPaymentState, "operationalStatePaymentState_");
assertNoRawPaymentDecision(sharedBillingFacts, "opsBillingRowFacts_");

console.log("PASS non-queue payment consumers use canonical receipt authority");
console.log("PASS raw Payment_Verified remains compatibility/debug/display evidence only");
