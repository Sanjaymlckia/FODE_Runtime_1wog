const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === quote) quote = "";
      continue;
    }
    if (char === '"' || char === "'" || char === "`") quote = char;
    else if (char === "{") depth += 1;
    else if (char === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} is not closed`);
}

const admin = fs.readFileSync("Admin.js", "utf8");
const finance = fs.readFileSync("Admin_CanonicalFinance.js", "utf8");
const lifecycle = fs.readFileSync("Admin_LifecycleAuthority.js", "utf8");
const functions = [
  extractFunction(finance, "canonicalFinanceClean_"),
  extractFunction(finance, "resolveCanonicalFinanceState_"),
  extractFunction(lifecycle, "resolveCanonicalApplicantLifecycle_"),
  extractFunction(admin, "actionabilityBatchMessageTypeForRecommendation_"),
  extractFunction(admin, "actionabilityAuthorityRecommendedMessageType_"),
  extractFunction(admin, "resolveActionabilityState_"),
  extractFunction(admin, "buildActionabilityPreviewRow_")
].join("\n\n");

const context = {
  console, Date, Number, Math, Object, Array, String, Error,
  clean_: (value) => String(value == null ? "" : value).trim(),
  stageAggregationEffectiveEmail_: (row) => row.Parent_Email || "",
  stageAggregationIsValidEmail_: (email) => /@/.test(email),
  normalizePngWhatsAppPhone_: () => ({ ok: false }),
  getWhatsAppFallbackPhoneRaw_: () => "",
  adminOpsHasEmailIssue_: () => false,
  adminOpsRequiredDocumentUploadSummary_: () => ({ requiredDocumentUploadComplete: true, uploadedRequiredCount: 4, requiredCount: 4, missingRequiredDocuments: [] }),
  adminDocumentReviewVerifiedForAutomation_: () => true,
  adminRowPortalSubmitted_: () => true,
  adminRowPaymentAuthorityFacts_: (row) => ({ paymentEvidencePresent: context.adminRowPaymentEvidencePresent_(row), paymentVerified: String(row.Receipt_Status || "").toLowerCase() === "verified", paymentBadge: String(row.Receipt_Status || "") || "Pending" }),
  adminRowPaymentEvidencePresent_: (row) => {
    const raw = String(row.Fee_Receipt_File || "").trim();
    if (!raw || raw === "[]" || raw === "{}") return false;
    return /^https?:\/\//i.test(raw) || /^[\w-]{20,}$/.test(raw);
  },
  isCanonicalPaymentVerified_: (row) => String(row.Receipt_Status || "").toLowerCase() === "verified",
  isYes_: (value) => String(value || "").toLowerCase() === "yes",
  deriveApplicantLifecycleStage_: () => "PAYMENT_REQUIRED",
  deriveOperationalPipelineStage_: () => "PAYMENT_REQUIRED",
  compareLegacyCanonicalLifecycle_: (legacy, canonical) => ({ hasLifecycleMismatch: legacy !== canonical.baseState, legacyLifecycle: legacy, canonicalBaseState: canonical.baseState, canonicalOverlays: canonical.overlays || [], mismatchReason: "" }),
  adminOpsDocumentStateFromRow_: () => "VERIFIED",
  actionabilityPreviewDateInfo_: (row) => ({ value: row.Email_Next_Action_Date || "", source: "Email_Next_Action_Date", ageDays: 0 }),
  actionabilityPreviewLastContactAgeDays_: () => 0,
  parseTime_: (value) => Date.parse(value) || 0,
  actionabilityPreviewUrgency_: () => ({ level: "NORMAL", reason: "" }),
  communicationRecommendedMessageTypeForStage_: () => "",
  actionabilityWorkloadExplanationForRow_: (row) => row.nextAction,
  actionabilityWorklistProjection_: (row) => row.nextAction === "VERIFY_PAYMENT" ? { worklistKey: "PAYMENT_REVIEW", worklistLabel: "Payment Review", worklistReason: "Receipt pending verification" } : { worklistKey: "PAYMENT_FOLLOW_UP", worklistLabel: "Payment Follow-up", worklistReason: "Awaiting payment evidence" },
  actionabilityWorkloadGroupKey_: () => "FINANCE",
  computeDocVerificationStatus_: () => "Verified",
  normalizeEmailStatus_: () => "",
  nonEmpty_: (value) => !!String(value || "").trim()
};
vm.createContext(context);
vm.runInContext(functions, context);

const waffiStyle = context.buildActionabilityPreviewRow_({
  ApplicantID: "FODE-26-002959",
  First_Name: "Keziah",
  Last_Name: "Waffi",
  Parent_Email: "waffi@example.test",
  Portal_Submitted: "Yes",
  Fee_Receipt_File: "[]",
  Receipt_Status: "Pending",
  Last_Contact_Type: "payment_followup",
  Last_Contact_Result: "SENT",
  Email_Next_Action_Date: "2099-07-17T04:00:00.000Z"
}, 10);
assert.equal(waffiStyle.canonicalLifecycle.baseState, "PAYMENT_PENDING");
assert.equal(waffiStyle.authorityState.canonicalFinanceState, "PAYMENT_PENDING");
assert.equal(waffiStyle.nextAction, "SEND_PAYMENT_REMINDER");
assert.equal(waffiStyle.worklistKey, "PAYMENT_FOLLOW_UP");
assert.equal(waffiStyle.actionabilityState, "COOLING_OFF");
assert.equal(waffiStyle.reasonCode, "COOLDOWN_ACTIVE");
assert.equal(waffiStyle.recommendedMessageType, "payment_followup", "Cooling-off must retain the semantic recommendation");
assert.equal(waffiStyle.selectable, false);

const toVerify = context.buildActionabilityPreviewRow_({ ApplicantID: "FODE-VERIFY", Parent_Email: "verify@example.test", Portal_Submitted: "Yes", Fee_Receipt_File: "https://drive.google.com/file/d/payment-proof/view", Receipt_Status: "Pending" }, 13);
assert.equal(toVerify.canonicalLifecycle.baseState, "PAYMENT_TO_VERIFY");
assert.equal(toVerify.nextAction, "VERIFY_PAYMENT");
assert.equal(toVerify.worklistKey, "PAYMENT_REVIEW");
assert.equal(toVerify.recommendedMessageType, "");
assert.equal(toVerify.selectable, false);

const pending = context.buildActionabilityPreviewRow_({ ApplicantID: "FODE-PENDING", Parent_Email: "pending@example.test", Portal_Submitted: "Yes", Receipt_Status: "" }, 11);
assert.equal(pending.canonicalLifecycle.baseState, "PAYMENT_PENDING");
assert.equal(pending.nextAction, "SEND_PAYMENT_REMINDER");
assert.equal(pending.worklistKey, "PAYMENT_FOLLOW_UP");
assert.equal(pending.recommendedMessageType, "payment_followup");

const paid = context.buildActionabilityPreviewRow_({ ApplicantID: "FODE-PAID", Parent_Email: "paid@example.test", Portal_Submitted: "Yes", Fee_Receipt_File: "receipt", Receipt_Status: "Verified" }, 12);
assert.equal(paid.authorityState.canonicalFinanceState, "PAID_VERIFIED");
assert.notEqual(paid.nextAction, "SEND_PAYMENT_REMINDER");
assert.notEqual(paid.nextAction, "VERIFY_PAYMENT");
assert.equal(paid.recommendedMessageType, "");

console.log("PASS Actionability and canonical lifecycle consume the shared canonical Finance state");
