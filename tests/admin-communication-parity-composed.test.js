const fs = require("node:fs");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const codeSource = fs.readFileSync("Code.js", "utf8");
const adminSource = fs.readFileSync("Admin.js", "utf8");
const uiSource = fs.readFileSync("AdminUI.html", "utf8");

assert.match(codeSource, /function communicationPaymentEvidencePresent_\([\s\S]*adminRowPaymentEvidencePresent_\(row\)/, "Communication Authority must consume the shared payment-evidence contract");
assert.doesNotMatch(codeSource, /hasUploadEvidence_\(row\.Receipt_File|hasUploadEvidence_\(row\.Payment_Receipt_File/, "Non-schema compatibility fields must not become payment-proof authority");
const lifecycleSource = fs.readFileSync("Admin_LifecycleAuthority.js", "utf8");

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

const requiredDocs = [
  "Birth_ID_Passport_File",
  "Latest_School_Report_File",
  "Passport_Photo_File"
];
const clean = (value) => String(value == null ? "" : value).trim();
const docStatus = (row) => requiredDocs.every((field) => clean(row[`${field === "Birth_ID_Passport_File" ? "Birth_ID" : field === "Latest_School_Report_File" ? "Report" : "Photo"}_Status`]).toUpperCase() === "VERIFIED")
  ? "Verified"
  : "Pending";

const context = {
  Date,
  console,
  clean_: clean,
  newDebugId_: () => "DBG-PARITY-TEST",
  isYes_: (value) => /^(yes|true|1)$/i.test(clean(value)),
  parseTime_: (value) => Number.isFinite(Date.parse(clean(value))) ? Date.parse(clean(value)) : 0,
  campaignAttemptCount_: (row) => Number(row.Email_Attempt_Count || 0),
  adminOpsRequiredDocumentUploadSummary_: (row) => {
    const uploaded = requiredDocs.filter((field) => !!clean(row[field]));
    return {
      requiredCount: requiredDocs.length,
      uploadedRequiredCount: uploaded.length,
      missingRequiredDocuments: requiredDocs.filter((field) => !clean(row[field])),
      uploadedRequiredDocuments: uploaded,
      requiredDocumentUploadComplete: uploaded.length === requiredDocs.length
    };
  },
  adminRowPaymentAuthorityFacts_: (row) => ({
    paymentEvidencePresent: !!clean(row.Fee_Receipt_File) && clean(row.Fee_Receipt_File) !== "[]",
    paymentVerified: /^verified$/i.test(clean(row.Receipt_Status))
  }),
  adminRowPortalSubmitted_: (row) => /^yes$/i.test(clean(row.Portal_Submitted)),
  computeDocVerificationStatus_: docStatus,
  adminDocumentReviewVerifiedForAutomation_: (row) => /^yes$/i.test(clean(row.Docs_Verified)) || docStatus(row) === "Verified",
  normalizeApplicantMessageType_: (value) => {
    const normalized = clean(value).toLowerCase();
    return ["payment_followup", "legacy_invite", "reminder", "docs_missing", "custom_email"].includes(normalized) ? normalized : "";
  },
  normalizeLifecycleStageKey_: (value) => clean(value).toUpperCase(),
  deriveApplicantLifecycleStage_: (row) => /^yes$/i.test(clean(row.Portal_Submitted)) ? "PROCESSING" : "INVITE_PENDING",
  communicationGetActorInfo_: () => ({ isAdmin: true, isSuper: false, role: "ADMIN", email: "operator@example.test" }),
  communicationApplicantAuthorityState_: () => "ACTIVE",
  communicationPaymentEvidencePresent_: (row) => !!clean(row.Fee_Receipt_File) && clean(row.Fee_Receipt_File) !== "[]",
  communicationPaymentEvidenceMissing_: (row) => !clean(row.Fee_Receipt_File) || clean(row.Fee_Receipt_File) === "[]",
  applicantSubjectsValue_: (row) => clean(row.Subjects_Selected_Canonical || row.Subjects || ""),
  communicationRequiresSubjects_: (type) => ["payment_followup", "application_receipt_request", "application_verified_quote", "application_acceptance_confirmation", "application_exam_fee_reminder"].includes(clean(type).toLowerCase()),
  communicationQuoteEligible_: () => false,
  communicationAcceptanceConfirmed_: () => false,
  communicationBlockReason_: (code) => clean(code),
  getCommunicationSemanticDefinition_: () => ({ requiresValidEmail: true }),
  isPortalCommunicationMessageType_: (type) => clean(type).toLowerCase() === "legacy_invite",
  resolvePortalCommunicationSecret_: () => ({ ok: true, secretPlain: "secret", secretHash: "hash" }),
  buildPortalCommunicationUrl_: () => "https://portal.example.test/continue",
  logCommunicationAuthorityOverride_: () => {},
  communicationDocsVerifiedForPayment_: (_row, base) => base.docsVerified === true,
  isLifecycleAwaitingResponseStage_: (stage) => ["INVITED_AWAITING_RESPONSE", "REMINDER_DUE", "PAYMENT_REQUIRED"].includes(clean(stage).toUpperCase()),
  communicationRecommendedMessageTypeForStage_: (stage) => ({
    INVITE_PENDING: "legacy_invite",
    PAYMENT_REQUIRED: "payment_followup"
  })[clean(stage).toUpperCase()] || "",
  communicationOverlayStatusFromCode_: (code) => clean(code).toUpperCase() || "NOT_STAGE_MESSAGE_MATCH",
  getCommunicationAuthorityRule_: (type) => ({
    payment_followup: {
      permittedLifecycleStages: ["PAYMENT_REQUIRED", "RECEIPT_AWAITING_VERIFICATION"],
      requiredApplicantState: "ACTIVE",
      requiredDocumentState: "VERIFIED",
      requiredPaymentState: "OUTSTANDING",
      requiredVerificationState: "NOT_ACCEPTED",
      protectedAction: false,
      overridePermitted: false
    },
    legacy_invite: {
      permittedLifecycleStages: ["INVITE_PENDING", "INVITED_AWAITING_RESPONSE"],
      requiredApplicantState: "ACTIVE",
      requiredDocumentState: "NOT_VERIFIED",
      requiredPaymentState: "ANY",
      requiredVerificationState: "NOT_ACCEPTED",
      protectedAction: false,
      overridePermitted: false
    },
    docs_missing: {
      permittedLifecycleStages: ["DOCS_REQUIRED", "PROCESSING"],
      requiredApplicantState: "ACTIVE",
      requiredDocumentState: "NOT_VERIFIED",
      requiredPaymentState: "ANY",
      requiredVerificationState: "NOT_ACCEPTED",
      protectedAction: false,
      overridePermitted: false
    }
  })[type] || null,
  deriveCommunicationState_: (row, messageType) => {
    const email = clean(row.Parent_Email);
    const paymentVerified = /^verified$/i.test(clean(row.Receipt_Status));
    const docsVerified = /^yes$/i.test(clean(row.Docs_Verified)) || docStatus(row) === "Verified";
    return {
      applicantId: clean(row.ApplicantID),
      communicationFamily: clean(messageType),
      cooldownActive: row.CooldownActive === true,
      cooldownLastSentAt: row.CooldownActive ? "2026-07-11T00:00:00Z" : "",
      durablePriorSuccess: row.PriorSuccess === true,
      base: {
        effectiveEmail: email,
        hasEffectiveEmail: !!email,
        hasValidEffectiveEmail: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email),
        emailStatus: clean(row.Email_Status || "READY").toUpperCase(),
        portalSubmittedActive: /^yes$/i.test(clean(row.Portal_Submitted)),
        bounceFlag: false,
        bounceReason: "",
        docsVerified,
        docsMissing: !docsVerified,
        paymentVerified,
        paymentOutstanding: !paymentVerified,
        requiresPortalUrl: ["payment_followup", "legacy_invite", "reminder", "docs_missing"].includes(clean(messageType))
      }
    };
  },
  reviewAuthoritySnapshot_: () => ({ selectBlockReason: "" })
};

vm.createContext(context);
vm.runInContext([
  extractFunction(lifecycleSource, "resolveCanonicalApplicantLifecycle_"),
  extractFunction(codeSource, "communicationAuthorityPrerequisiteLine_"),
  extractFunction(codeSource, "communicationAuthorityPrerequisiteText_"),
  extractFunction(codeSource, "communicationCanonicalLifecycleContext_"),
  extractFunction(codeSource, "communicationCanonicalLifecycleAllows_"),
  extractFunction(codeSource, "communicationRequiredCapabilityForAction_"),
  extractFunction(codeSource, "communicationActorHasCapability_"),
  extractFunction(codeSource, "communicationCapabilityBlock_"),
  extractFunction(codeSource, "evaluateCommunicationAuthority_"),
  extractFunction(codeSource, "normalizePortalSecretStatus_"),
  extractFunction(codeSource, "resolveExistingStudentPortalAuthority_"),
  extractFunction(codeSource, "resolveApplicantMessageContextFromRow_"),
  extractFunction(codeSource, "buildApplicantCommunicationAuthorityProjection_"),
  extractFunction(codeSource, "hasPriorSuccessfulMessageSend_"),
  extractFunction(adminSource, "actionabilityBatchMessageTypeForRecommendation_"),
  extractFunction(adminSource, "actionabilityAuthorityRecommendedMessageType_"),
  extractFunction(adminSource, "resolveActionabilityState_"),
  extractFunction(uiSource, "recommendCommTemplateForDetail_"),
  extractFunction(uiSource, "recommendedCommSelectionForDerived_")
].join("\n\n"), context);

const waffi = {
  ApplicantID: "FODE-26-002959",
  Parent_Email: "waffi@example.test",
  Portal_Submitted: "Yes",
  Birth_ID_Passport_File: "birth.pdf",
  Latest_School_Report_File: "report.pdf",
  Passport_Photo_File: "photo.pdf",
  Birth_ID_Status: "Verified",
  Report_Status: "Verified",
  Photo_Status: "Verified",
  Docs_Verified: "Yes",
  Subjects_Selected_Canonical: "English",
  Fee_Receipt_File: "[]",
  Receipt_Status: "Pending"
};

const lifecycle = context.resolveCanonicalApplicantLifecycle_(waffi, { nowTs: Date.parse("2026-07-12T00:00:00Z") });
assert.equal(lifecycle.baseState, "PAYMENT_PENDING");
assert.equal(lifecycle.recommendedMessageType, "payment_followup");

const actionability = context.resolveActionabilityState_({
  owner: "APPLICANT",
  nextAction: "SEND_PAYMENT_REMINDER",
  suppressor: "",
  lifecycleStage: "PROCESSING",
  recommendedMessageType: "payment_reminder",
  canonicalRecommendedMessageType: lifecycle.recommendedMessageType
});
assert.equal(actionability.actionabilityState, "READY");
assert.equal(actionability.recommendedAction, "payment_followup");
assert.equal(context.actionabilityAuthorityRecommendedMessageType_(lifecycle.recommendedMessageType, "payment_reminder"), "payment_followup");

const projection = context.buildApplicantCommunicationAuthorityProjection_(waffi, 2959, {}, "custom_email", {
  actorEmail: "operator@example.test",
  actorRole: "ADMIN"
});
assert.equal(projection.recommendedMessageType, "payment_followup");
assert.equal(projection.requestedMessageType, "custom_email");
assert.equal(projection.selectedMessageType, "payment_followup");
assert.equal(projection.permitted, true);
assert.equal(projection.sendableNow, true);
assert.equal(projection.blockCode, "");
assert.equal(projection.authoritySource, "CANONICAL_LIFECYCLE");

context.getCallerEmail_ = () => "operator@example.test";
context.isAdmin_ = () => true;
context.getAdminRole_ = () => "ADMIN";
context.getWorkingSpreadsheet_ = () => ({});
context.mustGetDataSheet_ = () => ({});
context.findRowByApplicantId_ = () => 2959;
context.getRowObject_ = () => waffi;
vm.runInContext(extractFunction(codeSource, "admin_getApplicantCommDerived_json"), context);
const reviewDto = context.admin_getApplicantCommDerived_json({
  applicantId: waffi.ApplicantID,
  messageType: "custom_email"
});
assert.equal(reviewDto.Comm_Recommended_Message_Type, "payment_followup");
assert.equal(reviewDto.Comm_Requested_Message_Type, "custom_email");
assert.equal(reviewDto.Comm_Selected_Message_Type, "payment_followup");
assert.equal(reviewDto.Comm_Permitted, true);
assert.equal(reviewDto.Comm_Sendable_Now, true);
assert.equal(reviewDto.Comm_Block_Code, "");
assert.equal(reviewDto.Comm_Authority_Source, "CANONICAL_LIFECYCLE");
assert.equal(
  context.recommendedCommSelectionForDerived_("custom_email", reviewDto.Comm_Requested_Message_Type, reviewDto.Comm_Recommended_Message_Type),
  "payment_followup",
  "Initial Review selection must adopt the canonical recommendation"
);
assert.equal(
  context.recommendedCommSelectionForDerived_("docs_missing", reviewDto.Comm_Requested_Message_Type, reviewDto.Comm_Recommended_Message_Type),
  "docs_missing",
  "A later operator selection must not be overwritten by an older derived response"
);

const preview = context.resolveApplicantMessageContextFromRow_(waffi, 2959, {}, "payment_followup", { action: "preview", skipPortalUrlBuild: true });
const sendGate = context.resolveApplicantMessageContextFromRow_(waffi, 2959, {}, "payment_followup", { action: "send", skipPortalUrlBuild: true });
assert.equal(preview.eligible, true);
assert.equal(sendGate.eligible, true);
assert.equal(preview.messageType, projection.selectedMessageType);
assert.equal(sendGate.messageType, projection.selectedMessageType);
assert.equal(preview.blockReason, projection.blockReason);
assert.equal(sendGate.blockReason, projection.blockReason);
assert.notEqual(preview.blockCode, "PORTAL_ALREADY_SUBMITTED");

const reviewRecommendation = context.recommendCommTemplateForDetail_({
  ApplicantID: waffi.ApplicantID,
  Comm_Recommended_Message_Type: projection.recommendedMessageType,
  Comm_Sendable_Now: projection.sendableNow,
  Comm_Permitted: projection.permitted,
  Comm_Block_Code: projection.blockCode,
  Comm_Block_Reason: projection.blockReason
});
assert.equal(reviewRecommendation.messageType, "payment_followup");
assert.equal(reviewRecommendation.actionable, true);

const portalInvite = context.resolveApplicantMessageContextFromRow_(waffi, 2959, {}, "legacy_invite", { action: "preview", skipPortalUrlBuild: true });
assert.equal(portalInvite.eligible, false);
assert.equal(portalInvite.blockCode, "PORTAL_ALREADY_SUBMITTED");

const paymentComplete = context.resolveApplicantMessageContextFromRow_({ ...waffi, Receipt_Status: "Verified" }, 2959, {}, "payment_followup", { action: "preview", skipPortalUrlBuild: true });
assert.equal(paymentComplete.eligible, false);

const paymentEvidencePending = { ...waffi, Fee_Receipt_File: "https://receipt.example.test/evidence.pdf", Receipt_Status: "Pending" };
const paymentEvidenceLifecycle = context.resolveCanonicalApplicantLifecycle_(paymentEvidencePending, {});
assert.equal(paymentEvidenceLifecycle.baseState, "PAYMENT_TO_VERIFY");
assert.equal(paymentEvidenceLifecycle.recommendedMessageType, "");
const paymentEvidenceFollowup = context.resolveApplicantMessageContextFromRow_(paymentEvidencePending, 2959, {}, "payment_followup", { action: "preview", skipPortalUrlBuild: true });
assert.equal(paymentEvidenceFollowup.eligible, false, "Receipt evidence awaiting verification must not remain eligible for payment follow-up");

const coolingOff = context.resolveApplicantMessageContextFromRow_({ ...waffi, CooldownActive: true }, 2959, {}, "payment_followup", { action: "preview", skipPortalUrlBuild: true });
assert.equal(coolingOff.eligible, false);
assert.equal(coolingOff.blockCode, "COOLDOWN_ACTIVE");
assert.equal(coolingOff.permitted, true, "Cooldown must block sendability without changing lifecycle permission");

const noEmail = context.buildApplicantCommunicationAuthorityProjection_({ ...waffi, Parent_Email: "" }, 2959, {}, "custom_email", {});
assert.equal(noEmail.recommendedMessageType, "payment_followup");
assert.equal(noEmail.permitted, true);
assert.equal(noEmail.sendableNow, false);
assert.equal(noEmail.blockCode, "NO_EFFECTIVE_EMAIL");
const blockedReviewRecommendation = context.recommendCommTemplateForDetail_({
  ApplicantID: waffi.ApplicantID,
  Comm_Recommended_Message_Type: noEmail.recommendedMessageType,
  Comm_Sendable_Now: noEmail.sendableNow,
  Comm_Permitted: noEmail.permitted,
  Comm_Block_Code: noEmail.blockCode,
  Comm_Block_Reason: noEmail.blockReason
});
assert.equal(blockedReviewRecommendation.messageType, "payment_followup", "Blocked recommendations must remain selected instead of falling back to custom email");
assert.equal(blockedReviewRecommendation.actionable, false);

assert.equal(context.hasPriorSuccessfulMessageSend_({
  applicantId: waffi.ApplicantID,
  messageType: "payment_followup",
  rowObj: { ...waffi, PriorSuccess: true }
}), true, "Durable duplicate protection must remain active");

const missingDocs = {
  ApplicantID: "FODE-26-MISSING-DOCS",
  Parent_Email: "docs@example.test",
  Portal_Submitted: "Yes",
  Birth_ID_Passport_File: "",
  Latest_School_Report_File: "",
  Passport_Photo_File: "",
  Birth_ID_Status: "",
  Report_Status: "",
  Photo_Status: "",
  Docs_Verified: "",
  Receipt_Status: "Pending"
};
const missingDocsLifecycle = context.resolveCanonicalApplicantLifecycle_(missingDocs, { nowTs: Date.parse("2026-07-12T00:00:00Z") });
assert.equal(missingDocsLifecycle.baseState, "INCOMPLETE_DOCUMENTS");
assert.equal(missingDocsLifecycle.recommendedMessageType, "docs_missing");
const missingDocsProjection = context.buildApplicantCommunicationAuthorityProjection_(missingDocs, 3001, {}, "custom_email", {});
assert.equal(missingDocsProjection.recommendedMessageType, "docs_missing");
assert.equal(missingDocsProjection.selectedMessageType, "docs_missing");
assert.equal(missingDocsProjection.permitted, true);
assert.equal(missingDocsProjection.sendableNow, true);
assert.equal(missingDocsProjection.authoritySource, "CANONICAL_LIFECYCLE");
assert.equal(context.resolveApplicantMessageContextFromRow_(missingDocs, 3001, {}, "docs_missing", { action: "preview", skipPortalUrlBuild: true }).eligible, true);
assert.equal(context.resolveApplicantMessageContextFromRow_(missingDocs, 3001, {}, "docs_missing", { action: "send", skipPortalUrlBuild: true }).eligible, true);

const portalInvitePending = {
  ...missingDocs,
  ApplicantID: "FODE-26-PORTAL-INVITE",
  Portal_Submitted: "",
  Parent_Email: "portal@example.test"
};
const inviteProjection = context.buildApplicantCommunicationAuthorityProjection_(portalInvitePending, 3002, {}, "custom_email", {});
assert.equal(inviteProjection.recommendedMessageType, "legacy_invite");
assert.equal(inviteProjection.selectedMessageType, "legacy_invite");
assert.equal(inviteProjection.sendableNow, true);
assert.equal(context.resolveApplicantMessageContextFromRow_(portalInvitePending, 3002, {}, "legacy_invite", { action: "preview", skipPortalUrlBuild: true }).eligible, true);
assert.equal(context.resolveApplicantMessageContextFromRow_(portalInvitePending, 3002, {}, "legacy_invite", { action: "send", skipPortalUrlBuild: true }).eligible, true);

console.log("PASS composed payment-followup communication parity and negative gates");
