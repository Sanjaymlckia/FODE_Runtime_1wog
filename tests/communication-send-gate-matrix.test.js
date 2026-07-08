const fs = require("node:fs");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const codeSource = fs.readFileSync("Code.js", "utf8");
const adminSource = [
  fs.readFileSync("Admin.js", "utf8"),
  fs.readFileSync("Admin_StageBatchCommunications.js", "utf8"),
  fs.readFileSync("Admin_SelectedApplicantCommunications.js", "utf8")
].join("\n");
const adminUiSource = fs.readFileSync("AdminUI.html", "utf8");
const configSource = fs.readFileSync("Config.js", "utf8");

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

function configuredAllowedTypes() {
  const match = configSource.match(/COMMUNICATION_ALLOWED_MESSAGE_TYPES\s*:\s*\[([\s\S]*?)\]/);
  assert.ok(match, "COMMUNICATION_ALLOWED_MESSAGE_TYPES must exist");
  return Array.from(match[1].matchAll(/"([^"]+)"/g), (item) => item[1]);
}

const context = {
  CONFIG: { COMMUNICATION_ALLOWED_MESSAGE_TYPES: configuredAllowedTypes() },
  clean_: (value) => String(value == null ? "" : value).trim()
};
vm.createContext(context);
vm.runInContext([
  "normalizeLifecycleStageKey_",
  "lifecycleStageMessageTypeMap_",
  "communicationRecommendedMessageTypeForStage_",
  "isLifecycleAwaitingResponseStage_",
  "normalizeApplicantMessageType_",
  "getCommunicationSemanticRegistry_",
  "getCommunicationSemanticDefinition_",
  "communicationSendAuthorityForDefinition_",
  "communicationDefinitionSupportsMode_",
  "isCommunicationTypeBatchSafe_",
  "getCommunicationAllowedSendModes_",
  "getCommunicationAuthorityMatrix_",
  "getCommunicationAuthorityRule_",
  "hasUnresolvedActionRequiredPlaceholder_",
  "communicationRequiresResolvedActionPlaceholders_"
].map((name) => extractFunction(codeSource, name)).join("\n\n"), context);

const selectedOnly = [
  "custom_email",
  "application_feedback",
  "application_verified_quote",
  "application_acceptance_confirmation",
  "application_receipt_request",
  "application_final_reminder",
  "application_exam_fee_reminder",
  "contact_fallback_manual",
  "prospect_general_guidance"
];

for (const messageType of selectedOnly) {
  const def = context.getCommunicationSemanticDefinition_(messageType);
  assert.ok(def, `${messageType} semantic definition must exist`);
  const authority = context.communicationSendAuthorityForDefinition_(def);
  assert.deepEqual(Array.from(def.allowedSendModes), ["selected"], `${messageType} must remain selected-only`);
  assert.equal(def.batchSafe, false, `${messageType} must not become batch-safe`);
  assert.equal(authority.selectedOnly, true, `${messageType} centralized authority must classify selected-only`);
  assert.equal(authority.batchSafe, false, `${messageType} centralized authority must reject batch`);
  assert.equal(context.communicationDefinitionSupportsMode_(def, "selected"), true, `${messageType} centralized authority must allow selected mode`);
  assert.equal(context.communicationDefinitionSupportsMode_(def, "batch"), false, `${messageType} centralized authority must reject batch mode`);
  assert.equal(context.isCommunicationTypeBatchSafe_(messageType), false, `${messageType} batch safety helper must reject batch`);
}

for (const messageType of ["docs_missing", "payment_followup"]) {
  const def = context.getCommunicationSemanticDefinition_(messageType);
  const authority = context.communicationSendAuthorityForDefinition_(def);
  assert.ok(def, `${messageType} semantic definition must exist`);
  assert.ok(def.allowedSendModes.indexOf("selected") >= 0, `${messageType} must remain selected-applicant available`);
  assert.equal(authority.batchSafe, true, `${messageType} centralized authority must retain batch-safe classification`);
  assert.equal(authority.selectedOnly, false, `${messageType} centralized authority must not classify selected-only`);
  assert.equal(context.normalizeApplicantMessageType_(messageType), messageType, `${messageType} must normalize for selected-applicant preview/send`);
}

const registry = context.getCommunicationSemanticRegistry_();
const planned = registry.filter((entry) => entry.implementationStatus === "planned");
for (const entry of planned) {
  assert.equal(context.normalizeApplicantMessageType_(entry.messageType), "", `${entry.messageType} must not normalize into selected preview/send`);
  assert.equal(entry.requiredRole, "NOT_AUTHORIZED", `${entry.messageType} must not have a send-capable role`);
}

const stageMapper = extractFunction(adminSource, "getBatchMessageTypeForStage_");
const stageCollect = extractFunction(adminSource, "collectStageBatchCohort_");
const stagePriorSuccess = extractFunction(adminSource, "stageBatchShouldExcludePriorSuccessDefault_");
const sharedStageMap = extractFunction(codeSource, "lifecycleStageMessageTypeMap_");
assert.match(stageMapper, /communicationRecommendedMessageTypeForStage_\(normalized\)/, "Stage Batch must delegate to shared lifecycle-stage message mapping");
assert.equal(context.communicationRecommendedMessageTypeForStage_("DOCS_REQUIRED"), "docs_missing", "DOCS_REQUIRED Stage Batch mapping must use document wording");
assert.equal(context.communicationRecommendedMessageTypeForStage_("REMINDER_DUE"), "reminder", "REMINDER_DUE Stage Batch mapping must remain legacy reminder");
assert.equal(context.communicationRecommendedMessageTypeForStage_("INVITED_AWAITING_RESPONSE"), "reminder", "INVITED_AWAITING_RESPONSE Stage Batch mapping must remain legacy reminder");
assert.equal(context.communicationRecommendedMessageTypeForStage_("INVITE_PENDING"), "legacy_invite", "INVITE_PENDING Stage Batch mapping must remain legacy invite");
assert.equal(context.communicationRecommendedMessageTypeForStage_("PAYMENT_REQUIRED"), "payment_followup", "PAYMENT_REQUIRED Stage Batch mapping must use payment wording");
assert.equal(context.communicationRecommendedMessageTypeForStage_("RECEIPT_AWAITING_VERIFICATION"), "payment_followup", "RECEIPT_AWAITING_VERIFICATION Stage Batch mapping must use payment wording");
assert.equal(context.communicationRecommendedMessageTypeForStage_("PROCESSING"), "", "PROCESSING must remain unsupported for Stage Batch messaging");
assert.equal(context.communicationRecommendedMessageTypeForStage_("application_exam_fee_reminder"), "", "Planned template keys must not become lifecycle-stage mappings");
assert.doesNotMatch(sharedStageMap, /custom_email|application_verified_quote|application_acceptance_confirmation|application_exam_fee_reminder/, "Selected/manual templates must not be Stage Batch mapped");
assert.match(stageCollect, /stageBatchShouldExcludePriorSuccessDefault_\(rowObj, normalizedStage, messageType\)/, "Stage Batch must still exclude prior successful reminder groups before resolver eligibility");
assert.match(stagePriorSuccess, /lastContactMatchesScopedType[\s\S]*lastContactWasSent[\s\S]*priorGroup === currentGroup/, "Stage Batch duplicate reminder protection must remain durable-group based");

const resolveFromRow = extractFunction(codeSource, "resolveApplicantMessageContextFromRow_");
const authorityMatrixSource = extractFunction(codeSource, "getCommunicationAuthorityMatrix_");
const authorityEvaluateSource = extractFunction(codeSource, "evaluateCommunicationAuthority_");
const overrideLogSource = extractFunction(codeSource, "logCommunicationAuthorityOverride_");
assert.match(resolveFromRow, /evaluateCommunicationAuthority_/, "Selected and batch previews/sends must resolve through the canonical communication authority matrix");
assert.match(resolveFromRow, /logCommunicationAuthorityOverride_/, "Super Admin authority override must be audit logged by the resolver");
assert.match(authorityEvaluateSource, /actor\.isSuper !== true/, "Normal Admin must not bypass protected communication authority");
assert.match(authorityEvaluateSource, /reason\.length < 20/, "Super Admin override must require a written justification");
assert.match(authorityEvaluateSource, /communicationCanonicalLifecycleContext_/, "Communication Authority must consume canonical lifecycle diagnostics");
assert.match(authorityEvaluateSource, /communicationCanonicalLifecycleAllows_/, "Communication Authority must apply canonical lifecycle allowances through a narrow helper");
assert.match(overrideLogSource, /COMM_AUTHORITY_OVERRIDE/, "Override audit log must use a distinct communication authority event");
assert.match(overrideLogSource, /missingPrerequisites/, "Override audit log must include missing prerequisites");
assert.match(authorityMatrixSource, /application_acceptance_confirmation[\s\S]*protectedAction:\s*true/, "Acceptance confirmation must be a protected communication");
assert.match(authorityMatrixSource, /application_acceptance_confirmation[\s\S]*requiredPaymentState:\s*"VERIFIED"/, "Acceptance confirmation must require verified payment");
assert.match(authorityMatrixSource, /application_acceptance_confirmation[\s\S]*requiredVerificationState:\s*"ACCEPTANCE_CONFIRMED"/, "Acceptance confirmation must require acceptance authority");
assert.match(authorityMatrixSource, /payment_followup[\s\S]*requiredDocumentState:\s*"VERIFIED"/, "Payment follow-up must require document verification");
assert.match(authorityMatrixSource, /application_receipt_request[\s\S]*requiredPaymentState:\s*"EVIDENCE_MISSING"/, "Receipt request must require missing payment evidence");
assert.match(authorityMatrixSource, /application_verified_quote[\s\S]*requiredPaymentState:\s*"QUOTE_ELIGIBLE_NOT_VERIFIED"/, "Verified quote must require quote eligibility and no verified payment");
assert.match(resolveFromRow, /normalizedType === "payment_followup"[\s\S]*DOCS_NOT_VERIFIED_FOR_PAYMENT/, "payment_followup must require document verification first");
assert.match(resolveFromRow, /normalizedType === "application_receipt_request"[\s\S]*communicationPaymentEvidenceMissing_/, "receipt request must require missing payment evidence");
assert.match(resolveFromRow, /normalizedType === "application_verified_quote"[\s\S]*communicationQuoteEligible_/, "verified quote must require quote eligibility");
assert.match(resolveFromRow, /PAYMENT_ALREADY_RESOLVED/, "payment templates must block after canonical payment resolution");
assert.match(resolveFromRow, /canonicalLifecycle[\s\S]*resolveCanonicalApplicantLifecycle_/, "Applicant message resolver must pass canonical lifecycle context into Communication Authority");

context.communicationGetActorInfo_ = () => ({ isAdmin: true, isSuper: false, role: "ADMIN", email: "operator@example.test" });
context.communicationApplicantAuthorityState_ = () => "ACTIVE";
context.communicationPaymentEvidencePresent_ = () => false;
context.communicationPaymentEvidenceMissing_ = () => true;
context.communicationQuoteEligible_ = () => false;
context.communicationAcceptanceConfirmed_ = () => false;
context.deriveApplicantLifecycleStage_ = () => "REMINDER_DUE";
context.deriveCommunicationState_ = () => ({ base: {} });
context.resolveCanonicalApplicantLifecycle_ = () => ({
  baseState: "INCOMPLETE_DOCUMENTS",
  lifecycleStage: "INCOMPLETE_DOCUMENTS",
  overlays: ["REMINDER_DUE"],
  recommendedMessageType: "docs_missing",
  reason: "Required upload evidence is incomplete."
});
vm.runInContext([
  extractFunction(codeSource, "communicationAuthorityPrerequisiteLine_"),
  extractFunction(codeSource, "communicationAuthorityPrerequisiteText_"),
  extractFunction(codeSource, "communicationCanonicalLifecycleContext_"),
  extractFunction(codeSource, "communicationCanonicalLifecycleAllows_"),
  extractFunction(codeSource, "evaluateCommunicationAuthority_")
].join("\n\n"), context);

const fode2844StyleBaseState = {
  docsVerified: false,
  docsMissing: true,
  paymentVerified: false,
  paymentOutstanding: true
};
const docsMissingCanonical = context.evaluateCommunicationAuthority_(
  {
    ApplicantID: "FODE-26-002844",
    Last_Contact_Type: "reminder",
    Last_Contact_Result: "SENT",
    Last_Contact_Batch: "STAGE_SEND::REMINDER_DUE::DBG-20260612020234-7f88e1be",
    Email_Next_Action_Date: "2026-06-15T14:00:00.000Z"
  },
  "docs_missing",
  fode2844StyleBaseState,
  {
    canonicalLifecycle: {
      baseState: "INCOMPLETE_DOCUMENTS",
      lifecycleStage: "INCOMPLETE_DOCUMENTS",
      overlays: ["REMINDER_DUE"],
      recommendedMessageType: "docs_missing"
    },
    actor: { isAdmin: true, isSuper: false, role: "ADMIN", email: "operator@example.test" }
  }
);
assert.equal(docsMissingCanonical.ok, true, "Canonical INCOMPLETE_DOCUMENTS + docs_missing recommendation must allow docs_missing despite legacy REMINDER_DUE");
assert.equal(docsMissingCanonical.canonicalLifecycleAuthority.authoritySource, "CANONICAL_LIFECYCLE");
assert.equal(docsMissingCanonical.canonicalLifecycleAuthority.legacyStage, "REMINDER_DUE");
assert.equal(docsMissingCanonical.canonicalLifecycleAuthority.canonicalBaseState, "INCOMPLETE_DOCUMENTS");
assert.deepEqual(docsMissingCanonical.canonicalLifecycleAuthority.canonicalOverlays, ["REMINDER_DUE"]);
assert.equal(docsMissingCanonical.canonicalLifecycleAuthority.canonicalRecommendedMessageType, "docs_missing");

const reminderCanonical = context.evaluateCommunicationAuthority_(
  { ApplicantID: "FODE-26-002844" },
  "reminder",
  fode2844StyleBaseState,
  {
    canonicalLifecycle: {
      baseState: "INCOMPLETE_DOCUMENTS",
      lifecycleStage: "INCOMPLETE_DOCUMENTS",
      overlays: ["REMINDER_DUE"],
      recommendedMessageType: "docs_missing"
    },
    actor: { isAdmin: true, isSuper: false, role: "ADMIN", email: "operator@example.test" }
  }
);
assert.equal(reminderCanonical.ok, true, "Canonical docs_missing convergence must not weaken legacy reminder lifecycle allowance");
assert.equal(reminderCanonical.canonicalLifecycleAuthority.authoritySource, "LEGACY_LIFECYCLE", "Reminder authority must remain legacy-stage sourced");

const sendApplicant = extractFunction(codeSource, "sendApplicantMessage_");
const dispatchApplicant = extractFunction(codeSource, "dispatchApplicantMessage_");
const adminPreview = extractFunction(adminSource, "admin_previewApplicantMessage");
const adminSend = extractFunction(adminSource, "admin_sendApplicantMessage");
const stageSend = extractFunction(adminSource, "admin_sendStageBatch");
const selectedBatchPreview = extractFunction(adminSource, "admin_previewSelectedApplicantBatch");
const selectedBatchSend = extractFunction(adminSource, "admin_sendSelectedApplicantBatch");
const selectedBatchAuthorityDiagnostics = extractFunction(adminSource, "selectedApplicantBatchAuthorityDiagnostics_");
vm.runInContext([
  extractFunction(adminSource, "selectedApplicantBatchTemplateLabel_"),
  extractFunction(adminSource, "selectedApplicantBatchOperatorBlockReason_"),
  selectedBatchAuthorityDiagnostics
].join("\n\n"), context);
assert.match(adminPreview, /authorityOverrideReason/, "Selected preview wrapper must pass authority override reason to backend authority");
assert.match(adminSend, /authorityOverrideReason/, "Selected send wrapper must pass authority override reason to backend authority");
assert.match(adminSend, /BULK_NOT_ALLOWED/, "Single-applicant Review send RPC must continue blocking bulk payloads");
assert.doesNotMatch(stageSend, /authorityOverride/, "Stage Batch must not provide an override bypass");
assert.match(selectedBatchPreview, /requireOperationsAdmin_\(adminEmail\)/, "Selected cohort batch preview must remain Operations/Super gated");
assert.match(selectedBatchSend, /requireOperationsAdmin_\(adminEmail\)/, "Selected cohort batch send must remain Operations/Super gated");
assert.match(selectedBatchPreview, /technicalReason:\s*rawReason/, "Selected cohort preview must retain raw authority detail only as technical diagnostics");
assert.match(selectedBatchPreview, /selectedApplicantBatchOperatorBlockReason_\(code, rawReason, messageType\)/, "Selected cohort preview must map raw block reasons to operator-readable text");
assert.match(selectedBatchPreview, /authorityDiagnostics:\s*selectedApplicantBatchAuthorityDiagnostics_/, "Selected cohort preview must expose per-recipient Communication Authority diagnostics");
assert.match(selectedBatchAuthorityDiagnostics, /authoritySource[\s\S]*legacyLifecycleStage[\s\S]*canonicalBaseState[\s\S]*canonicalOverlays[\s\S]*canonicalRecommendedMessageType[\s\S]*hasLifecycleMismatch/, "Recipient authority diagnostics must expose legacy/canonical lifecycle disagreement fields");
const canonicalRecipientDiagnostics = context.selectedApplicantBatchAuthorityDiagnostics_({
  lifecycleStage: "REMINDER_DUE",
  canonicalLifecycleAuthority: {
    authoritySource: "CANONICAL_LIFECYCLE",
    legacyStage: "REMINDER_DUE",
    canonicalBaseState: "INCOMPLETE_DOCUMENTS",
    canonicalOverlays: ["REMINDER_DUE"],
    canonicalRecommendedMessageType: "docs_missing"
  }
}, true, "");
assert.equal(canonicalRecipientDiagnostics.authoritySource, "CANONICAL_LIFECYCLE");
assert.equal(canonicalRecipientDiagnostics.explanation, "Allowed by Canonical Lifecycle (INCOMPLETE_DOCUMENTS -> docs_missing).");
assert.equal(canonicalRecipientDiagnostics.hasLifecycleMismatch, true);
const matrixReason = "Blocked by communication authority matrix. Requires: ✗ Lifecycle stage: DOCS_REQUIRED / PROCESSING - Current: REMINDER_DUE; ✓ Documents missing or not verified; ✗ No acceptance/enrolment confirmation";
assert.equal(
  context.selectedApplicantBatchOperatorBlockReason_("COMM_AUTHORITY_BLOCKED", matrixReason, "docs_missing"),
  "Blocked: This template is not allowed for this applicant's current status. Use the recommended template or review the applicant individually.",
  "Selected batch recipients must not expose raw authority matrix text to operators"
);
assert.equal(
  context.selectedApplicantBatchOperatorBlockReason_("COOLDOWN_ACTIVE", "A recent message of this type was already sent. Try again later.", "docs_missing"),
  "Blocked: Missing Documents Follow-Up was already sent recently. Wait for cooldown or review applicant individually.",
  "Cooldown blocks must explain already-sent behaviour in operator language"
);
assert.match(selectedBatchPreview, /isCommunicationTypeBatchSafe_\(messageType\)/, "Selected cohort preview must only allow batch-safe message types");
assert.match(selectedBatchSend, /isCommunicationTypeBatchSafe_\(messageType\)/, "Selected cohort send must only allow batch-safe message types");
assert.match(selectedBatchSend, /isBatchSendEnabled_\(\) !== true/, "Selected cohort send must preserve the batch-send feature gate");
assert.match(selectedBatchSend, /readSelectedApplicantBatchPreviewCache_\(adminEmail\)/, "Selected cohort send must require a cached preview");
assert.match(selectedBatchSend, /withSelectedApplicantBatchSendLock_\(adminEmail, dbgId/, "Selected cohort send must be protected by a server-side user lock");
assert.match(selectedBatchSend, /clearSelectedApplicantBatchPreviewCache_\(adminEmail\)[\s\S]*sendApplicantMessage_\(applicantId, messageType/, "Selected cohort send must consume the preview snapshot before sending");
assert.match(selectedBatchSend, /sendApplicantMessage_\(applicantId, messageType/, "Selected cohort send must reuse the existing applicant message send pipeline");
assert.doesNotMatch(selectedBatchSend, /authorityOverride/, "Selected cohort batch send must not introduce selected-applicant override bypasses");
assert.match(stageSend, /readStageBatchPreviewCache_\(adminEmail\)/, "Stage Batch send must require a cached preview");
assert.match(stageSend, /LockService\.getUserLock\(\)[\s\S]*tryLock\(30000\)/, "Stage Batch send must be protected by a server-side user lock");
assert.match(stageSend, /clearStageBatchPreviewCache_\(adminEmail\)/, "Stage Batch send must clear preview cache after send");
assert.match(sendApplicant, /isSystemStabilizationModeActive_/, "Selected send must preserve stabilization gate");
assert.match(sendApplicant, /ENABLE_PRODUCTION_EMAIL_SENDS/, "Selected send must preserve production-send gate");
assert.match(sendApplicant, /dispatchApplicantMessage_\(context, built, options\)/, "Selected send must route through guarded delivery dispatch");
assert.match(dispatchApplicant, /computeEmailIdempotencyKey_/, "Delivery dispatch must preserve idempotency key");
assert.match(dispatchApplicant, /wasEmailAlreadyProcessed_/, "Delivery dispatch must block idempotent replays");
assert.match(sendApplicant, /communicationRequiresResolvedActionPlaceholders_/, "Selected send must check placeholder policy");
assert.match(sendApplicant, /hasUnresolvedActionRequiredPlaceholder_/, "Selected send must inspect unresolved placeholders");

assert.equal(context.hasUnresolvedActionRequiredPlaceholder_("Subject", "Body"), false);
assert.equal(context.hasUnresolvedActionRequiredPlaceholder_("Subject [ACTION REQUIRED: grade]", "Body"), true);
assert.equal(context.communicationRequiresResolvedActionPlaceholders_("custom_email"), false, "Freeform custom email must not inherit operational placeholder policy");
for (const messageType of ["application_verified_quote", "application_acceptance_confirmation", "application_receipt_request", "application_final_reminder", "application_exam_fee_reminder"]) {
  assert.equal(context.communicationRequiresResolvedActionPlaceholders_(messageType), true, `${messageType} must block unresolved operational placeholders`);
}

const selectedMarkup = adminUiSource.match(/<select\b[^>]*id="commMessageType"[^>]*>([\s\S]*?)<\/select>/);
assert.ok(selectedMarkup, "Selected-applicant communication picker must exist");
assert.match(selectedMarkup[1], /value="custom_email"[\s\S]*Selected Applicant/, "custom_email picker label must remain selected-applicant scoped");
assert.match(adminUiSource, /function commTemplateOptionItems_/, "Selected-applicant picker must have a backend-metadata option helper");
assert.match(adminUiSource, /selectedOptionLabel/, "Selected-applicant picker labels must be read from backend registry metadata");
assert.match(adminUiSource, /function isEditableCommType_[\s\S]*getCommTemplateMeta_/, "Editability must be derived from backend communication metadata");
assert.match(adminUiSource, /Object\.assign\(payload, getCommEditablePayload_\(\)\)/, "Send payload must use edited subject/body");
assert.match(adminUiSource, /setCommEditableDraft_\(communicationsState\.result, messageType\)/, "Preview result must hydrate editable draft before send");

console.log("PASS selected-applicant templates remain selected-only and non-batch");
console.log("PASS Stage Batch mappings remain separated from selected/manual templates");
console.log("PASS unresolved operational placeholders remain send-blocking");
