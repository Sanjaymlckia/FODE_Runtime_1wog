const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const codeSource = fs.readFileSync("Code.js", "utf8");
const configSource = fs.readFileSync("Config.js", "utf8");
const adminSource = fs.readFileSync("Admin.js", "utf8");
const adminUiSource = fs.readFileSync("AdminUI.html", "utf8");

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
  assert.ok(match, "Configured allowed communication message types must exist");
  return Array.from(match[1].matchAll(/"([^"]+)"/g), (item) => item[1]);
}

const functionNames = [
  "normalizeLifecycleStageKey_",
  "lifecycleStageMessageTypeMap_",
  "communicationRecommendedMessageTypeForStage_",
  "normalizeApplicantMessageType_",
  "getCommunicationSemanticRegistry_",
  "getCommunicationSemanticDefinition_",
  "getCommunicationSemanticDefinitionsByStatus_",
  "isCommunicationTypeBatchSafe_",
  "isCommunicationTypePlanned_",
  "getCommunicationAllowedSendModes_"
];
const context = {
  CONFIG: {
    COMMUNICATION_ALLOWED_MESSAGE_TYPES: configuredAllowedTypes()
  },
  clean_: (value) => String(value == null ? "" : value).trim()
};
vm.createContext(context);
vm.runInContext(functionNames.map((name) => extractFunction(codeSource, name)).join("\n\n"), context);

const registry = context.getCommunicationSemanticRegistry_();
const active = context.getCommunicationSemanticDefinitionsByStatus_("active");
const planned = context.getCommunicationSemanticDefinitionsByStatus_("planned");
const manual = context.getCommunicationSemanticDefinitionsByStatus_("manual");
const allowedTypes = configuredAllowedTypes();
const allowedAudienceClasses = new Set(["PROSPECT_GUIDANCE", "APPLICANT_WORKFLOW", "OPERATOR_MANUAL"]);
const allowedSendModes = new Set(["selected", "batch", "manual_fallback"]);
const allowedEditableModes = new Set(["locked", "limited", "freeform"]);

assert.equal(new Set(registry.map((entry) => entry.messageType)).size, registry.length, "Registry type IDs must be unique");
assert.deepEqual(
  Array.from(active, (entry) => entry.messageType).sort(),
  allowedTypes.slice().sort(),
  "Active registry types must exactly match COMMUNICATION_ALLOWED_MESSAGE_TYPES"
);

for (const entry of registry) {
  assert.ok(entry.messageType, "Every registry entry needs a message type");
  assert.ok(entry.templateVersion, `${entry.messageType} needs a template version`);
  assert.ok(allowedAudienceClasses.has(entry.audienceClass), `${entry.messageType} has an invalid audience class`);
  assert.ok(entry.semanticIntent, `${entry.messageType} needs semantic intent`);
  assert.ok(entry.operatorLabel, `${entry.messageType} needs an operator label`);
  assert.ok(entry.conditionPolicyId, `${entry.messageType} needs a condition policy`);
  assert.ok(Array.isArray(entry.allowedSendModes), `${entry.messageType} needs allowed send modes`);
  entry.allowedSendModes.forEach((mode) => assert.ok(allowedSendModes.has(mode), `${entry.messageType} has invalid send mode ${mode}`));
  assert.ok(allowedEditableModes.has(entry.editableMode), `${entry.messageType} has an invalid editable mode`);
  assert.ok(entry.auditMeaning, `${entry.messageType} needs audit meaning`);
  assert.ok(["active", "planned", "manual"].includes(entry.implementationStatus), `${entry.messageType} has invalid status`);
}

for (const entry of active) {
  assert.ok(entry.subjectBuilderId, `${entry.messageType} needs an active subject builder reference`);
  assert.ok(entry.bodyBuilderId, `${entry.messageType} needs an active body builder reference`);
  if (entry.subjectBuilderId.endsWith("_")) {
    assert.match(codeSource, new RegExp(`function\\s+${entry.subjectBuilderId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(`));
  }
  if (entry.bodyBuilderId.endsWith("_")) {
    assert.match(codeSource, new RegExp(`function\\s+${entry.bodyBuilderId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(`));
  }
}

for (const entry of [...planned, ...manual]) {
  assert.ok(entry.subjectBuilderId, `${entry.messageType} needs a planned/manual subject builder reference`);
  assert.ok(entry.bodyBuilderId, `${entry.messageType} needs a planned/manual body builder reference`);
  for (const builderId of [entry.subjectBuilderId, entry.bodyBuilderId]) {
    assert.match(codeSource, new RegExp(`function\\s+${builderId.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*\\(`));
  }
}

const customEmail = context.getCommunicationSemanticDefinition_("custom_email");
assert.equal(customEmail.editableMode, "freeform");
assert.deepEqual(Array.from(customEmail.allowedSendModes), ["selected"]);
assert.equal(customEmail.batchSafe, false);
assert.equal(context.isCommunicationTypeBatchSafe_("custom_email"), false);

const reminder = context.getCommunicationSemanticDefinition_("reminder");
assert.equal(reminder.semanticRisk, "OVERLOADED");
assert.match(reminder.operatorWarning, /overloaded/i);
assert.match(reminder.operatorWarning, /do not add new meanings/i);

const prospect = context.getCommunicationSemanticDefinition_("prospect_general_guidance");
assert.equal(prospect.audienceClass, "PROSPECT_GUIDANCE");
assert.equal(prospect.requiresContactConsent, true);
assert.equal(prospect.batchSafe, false);
assert.equal(prospect.implementationStatus, "active");
assert.equal(prospect.authorityModel, "SELECTED_RECIPIENT_MANUAL_AUTHORITY");
assert.match(prospect.operatorWarning, /must not use applicant Stage Batch authority/i);
assert.equal(Object.hasOwn(prospect, "subject"), false);
assert.equal(Object.hasOwn(prospect, "body"), false);
assert.doesNotMatch(JSON.stringify(prospect), /\{\{[^}]+\}\}/);

const examFeeReminder = context.getCommunicationSemanticDefinition_("application_exam_fee_reminder");
assert.ok(examFeeReminder, "Manual selected-applicant National Exam Fee reminder must exist");
assert.equal(examFeeReminder.audienceClass, "APPLICANT_WORKFLOW");
assert.equal(examFeeReminder.implementationStatus, "active");
assert.equal(examFeeReminder.requiresApplicantRow, true);
assert.equal(examFeeReminder.requiresValidEmail, true);
assert.equal(examFeeReminder.requiresExamFeeDueAuthority, true);
assert.equal(examFeeReminder.requiresSubjectConfirmation, true);
assert.equal(examFeeReminder.currentFeePerSubjectKina, 150);
assert.equal(examFeeReminder.batchSafe, false);
assert.equal(context.isCommunicationTypeBatchSafe_("application_exam_fee_reminder"), false);
assert.equal(context.normalizeApplicantMessageType_("application_exam_fee_reminder"), "application_exam_fee_reminder");
assert.match(examFeeReminder.operatorWarning, /confirm the subject count/i);

for (const entry of registry.filter((item) => item.audienceClass === "APPLICANT_WORKFLOW")) {
  assert.equal(entry.requiresApplicantRow, true, `${entry.messageType} must require an applicant row`);
}

for (const entry of planned) {
  assert.equal(context.isCommunicationTypePlanned_(entry.messageType), true);
  assert.equal(context.normalizeApplicantMessageType_(entry.messageType), "", `${entry.messageType} must remain rejected by preview/send normalization`);
  assert.equal(entry.requiredRole, "NOT_AUTHORIZED");
}

const manualSelectedTypes = [
  "application_acceptance_confirmation",
  "application_verified_quote",
  "application_final_reminder",
  "application_exam_fee_reminder",
  "prospect_general_guidance",
  "application_receipt_request",
  "contact_fallback_manual"
];
for (const messageType of manualSelectedTypes) {
  const entry = context.getCommunicationSemanticDefinition_(messageType);
  assert.equal(entry.implementationStatus, "active", `${messageType} must be enabled for manual selected-applicant preview/send`);
  assert.deepEqual(Array.from(entry.allowedSendModes), ["selected"], `${messageType} must remain selected-applicant only`);
  assert.equal(entry.batchSafe, false, `${messageType} must not become batch-safe`);
  assert.equal(context.normalizeApplicantMessageType_(messageType), messageType, `${messageType} must normalize for selected-applicant manual gates`);
}

for (const entry of active) {
  const auditIdentity = {
    messageType: entry.messageType,
    templateVersion: entry.templateVersion,
    auditMeaning: entry.auditMeaning
  };
  assert.equal(auditIdentity.messageType, entry.messageType, "Audit identity must preserve the exact existing message type");
  assert.ok(auditIdentity.templateVersion, "Audit identity must retain template version metadata");
}

const stageMapper = extractFunction(adminSource, "getBatchMessageTypeForStage_");
const sharedStageMap = extractFunction(codeSource, "lifecycleStageMessageTypeMap_");
assert.match(stageMapper, /communicationRecommendedMessageTypeForStage_\(normalized\)/, "Stage Batch must use shared lifecycle-stage message mapping");
for (const stage of ["INVITED_AWAITING_RESPONSE", "REMINDER_DUE", "DOCS_REQUIRED", "PAYMENT_REQUIRED", "RECEIPT_AWAITING_VERIFICATION"]) {
  assert.equal(context.communicationRecommendedMessageTypeForStage_(stage), "reminder", `${stage} mapping must remain legacy reminder`);
}
assert.equal(context.communicationRecommendedMessageTypeForStage_("INVITE_PENDING"), "legacy_invite", "INVITE_PENDING mapping must remain legacy invite");
assert.equal(context.communicationRecommendedMessageTypeForStage_("PROCESSING"), "", "Unsupported lifecycle stages must not become batch sendable");
assert.doesNotMatch(sharedStageMap, /application_exam_fee_reminder/, "Exam fee reminder must not be Stage Batch mapped");
assert.doesNotMatch(sharedStageMap, /docs_missing|payment_followup/, "H3 must not remap Stage Batch to selected-applicant template types");

const selectedMessageTypeSelect = adminUiSource.match(/<select id="commMessageType">([\s\S]*?)<\/select>/);
assert.ok(selectedMessageTypeSelect, "Selected-applicant message type picker must exist");
const selectedMessageTypeMarkup = selectedMessageTypeSelect[1];
for (const messageType of ["legacy_invite", "reminder", "docs_missing", "payment_followup", "application_feedback", "custom_email", ...manualSelectedTypes]) {
  assert.match(selectedMessageTypeMarkup, new RegExp(`value="${messageType}"`), `${messageType} must be available in the selected-applicant picker`);
}
for (const messageType of planned.map((entry) => entry.messageType)) {
  assert.doesNotMatch(selectedMessageTypeMarkup, new RegExp(`value="${messageType}"`), `${messageType} must remain hidden from the selected-applicant picker`);
}
assert.match(selectedMessageTypeMarkup, /Application Portal Invitation/, "Legacy invite should have an operator-facing application portal label");
assert.match(selectedMessageTypeMarkup, /Legacy Application Reminder \(Overloaded\)/, "Legacy reminder must disclose its overloaded semantics");
assert.match(selectedMessageTypeMarkup, /Missing Documents - Selected Applicant/, "Missing-document follow-up must be clearly selected-applicant scoped");
assert.match(selectedMessageTypeMarkup, /Payment \/ Receipt Follow-Up/, "Payment follow-up must mention receipt handling");
assert.match(selectedMessageTypeMarkup, /Custom Email - Selected Applicant/, "Custom email must remain visibly selected-applicant scoped");
assert.match(adminUiSource, /Editable Email Draft \/ Template Preview/, "Selected-applicant templates must populate an editable preview surface");
assert.match(adminUiSource, /Subject and body may be reviewed and adjusted before final confirmation/, "Selected-applicant preview must clearly support operator editing before send");
assert.match(adminUiSource, /resultType === 'PREVIEW' && res\.effectiveEmail/, "Preview result must show the resolved recipient");
assert.match(adminUiSource, /Legacy Application Reminder is overloaded; confirm the applicant condition before use\./, "Operator help must warn about the overloaded reminder");
assert.match(adminUiSource, /setCommEditableDraft_\(communicationsState\.result, messageType\)/, "Generated preview must be copied into editable fields");
assert.match(adminUiSource, /Object\.assign\(payload, getCommEditablePayload_\(\)\)/, "Send payload must use final editable subject/body values");
assert.match(adminUiSource, /previewApplicantMessageUi_\("type_change_refresh"\)/, "Changing message type must refresh editable subject/body preview");

const previewSource = extractFunction(codeSource, "previewApplicantMessage_");
const sendSource = extractFunction(codeSource, "sendApplicantMessage_");
const adminPreviewSource = extractFunction(adminSource, "admin_previewApplicantMessage");
const adminSendSource = extractFunction(adminSource, "admin_sendApplicantMessage");
assert.match(previewSource, /resolveApplicantMessageContext_/, "Preview must continue through existing context authority");
assert.match(sendSource, /resolveApplicantMessageContext_/, "Send must continue through existing context authority");
assert.match(sendSource, /isSystemStabilizationModeActive_/, "Existing stabilization send gate must remain");
assert.match(sendSource, /ENABLE_PRODUCTION_EMAIL_SENDS/, "Existing production send gate must remain");
assert.match(sendSource, /ACTION_REQUIRED_PLACEHOLDER/, "Operational selected-applicant sends must block unresolved ACTION REQUIRED placeholders");
assert.match(sendSource, /communicationRequiresResolvedActionPlaceholders_/, "Operational placeholder send block must be scoped by message type");
assert.match(sendSource, /hasUnresolvedActionRequiredPlaceholder_/, "Send gate must inspect final editable subject/body for unresolved placeholders");
assert.match(codeSource, /computeEmailIdempotencyKey_/, "Existing idempotency path must remain");
assert.match(codeSource, /communicationCooldownMs_/, "Existing cooldown path must remain");
assert.match(adminPreviewSource, /hasOwnProperty\.call\(p, "subject"\)/, "Preview wrapper must not pass implicit blank subject over generated templates");
assert.match(adminSendSource, /hasOwnProperty\.call\(p, "subject"\)/, "Send wrapper must not pass implicit blank subject over generated templates");

const templateFunctionNames = [
  "buildApplicantFullName_",
  "buildParentOrApplicantName_",
  "actionRequiredPlaceholder_",
  "firstNonEmptyRowValue_",
  "applicantGradeOrPlaceholder_",
  "applicantSubjectsOrPlaceholder_",
  "applicantPaymentQuoteOrPlaceholder_",
  "applicantDocumentStatusSummary_",
  "applicantPaymentStatusSummary_",
  "applicantComputedFeeQuoteText_",
  "applicantOutstandingActionOrPlaceholder_",
  "paymentInstructionsOrPlaceholder_",
  "hasUnresolvedActionRequiredPlaceholder_",
  "communicationRequiresResolvedActionPlaceholders_",
  "feedbackStatusNeedsAttention_",
  "buildDocumentAttentionLines_",
  "subjectsToCsv_",
  "computeFodeFeeQuote_",
  "formatKina_",
  "applicantGradeDisplayOrUnconfirmed_",
  "applicantSubjectsDisplayOrUnconfirmed_",
  "buildReminderEmailBody_",
  "buildDocsMissingEmailBody_",
  "buildPaymentFollowupEmailBody_",
  "buildCustomSelectedEmailSubject_",
  "buildCustomSelectedEmailBody_",
  "buildProspectGeneralGuidanceSubject_",
  "buildProspectGeneralGuidanceBody_",
  "buildApplicationReceiptRequestSubject_",
  "buildApplicationReceiptRequestBody_",
  "buildApplicationVerifiedQuoteSubject_",
  "buildApplicationVerifiedQuoteBody_",
  "buildApplicationAcceptanceConfirmationSubject_",
  "buildApplicationAcceptanceConfirmationBody_",
  "buildApplicationExamFeeReminderSubject_",
  "buildApplicationExamFeeReminderBody_",
  "buildApplicationFinalReminderSubject_",
  "buildApplicationFinalReminderBody_",
  "buildContactFallbackManualSubject_",
  "buildContactFallbackManualBody_"
];
const templateContext = {
  CONFIG: {
    DOC_FIELDS: [
      { label: "Birth Certificate / NID / Passport", file: "Birth_ID_Passport_File", status: "Birth_ID_Status", comment: "Birth_ID_Comment" },
      { label: "Latest School Reports / Documents", file: "Latest_School_Report_File", status: "Report_Status", comment: "Report_Comment" },
      { label: "Passport Size Colour Photo", file: "Passport_Photo_File", status: "Photo_Status", comment: "Photo_Comment" },
      { label: "Admission Fee Payment Receipt", file: "Fee_Receipt_File", status: "Receipt_Status", comment: "Receipt_Comment" }
    ],
    COMMUNICATION_ALLOWED_MESSAGE_TYPES: allowedTypes,
    PAYMENT_INSTRUCTIONS_TEXT: "Pay using the approved KIA payment account and upload the receipt.",
    FEE_REGISTRATION_KINA: 600,
    FEE_PER_SUBJECT_KINA: 450
  },
  SCHEMA: { SUBJECTS_CANONICAL: "Subjects_Selected_Canonical" },
  clean_: (value) => String(value == null ? "" : value).trim(),
  hasUploadEvidence_: (value) => !!String(value == null ? "" : value).trim(),
  computeDocVerificationStatus_: (row) => (row && row.Docs_Verified === "Yes") ? "Verified" : "Pending",
  isCanonicalPaymentVerified_: (row) => !!(row && row.Receipt_Status === "Verified"),
  communicationDocsMissing_: (row) => !(row && row.Docs_Verified === "Yes"),
  communicationPaymentOutstanding_: (row) => !(row && row.Receipt_Status === "Verified"),
  normalizeApplicantMessageType_: context.normalizeApplicantMessageType_
};
vm.createContext(templateContext);
vm.runInContext(templateFunctionNames.map((name) => extractFunction(codeSource, name)).join("\n\n"), templateContext);

const applicantContext = {
  applicantId: "FODE-26-TEST",
  portalUrl: "https://portal.example.test/safe",
  rowObj: {
    First_Name: "Test",
    Last_Name: "Student",
    Parent_First_Name: "Test",
    Parent_Last_Name: "Parent",
    Birth_ID_Passport_File: "https://example.test/birth.pdf",
    Birth_ID_Status: "Verified",
    Latest_School_Report_File: "",
    Report_Status: "Pending",
    Report_Comment: "Please upload the latest school report."
  }
};
const docsMissingBody = templateContext.buildDocsMissingEmailBody_(applicantContext);
assert.match(docsMissingBody, /not available, incomplete, or need resubmission/i);
assert.match(docsMissingBody, /Applicant ID: FODE-26-TEST/);
assert.match(docsMissingBody, /Latest School Reports \/ Documents: not received or not available in the current application record\./);
assert.match(docsMissingBody, /required documents are not available, incomplete, or need resubmission/i);
assert.match(docsMissingBody, /Document status: review is still in progress/i);
assert.match(docsMissingBody, /This is not a final application decision/i);
assert.match(docsMissingBody, /Open the secure portal link below/i);
assert.match(docsMissingBody, /upload or resend/i);
assert.doesNotMatch(docsMissingBody, /\breject(?:ed|ion)?\b/i);
assert.doesNotMatch(docsMissingBody, /\byour (?:fault|failure)\b/i);

const paymentBody = templateContext.buildPaymentFollowupEmailBody_(applicantContext);
assert.match(paymentBody, /Applicant ID: FODE-26-TEST/);
assert.match(paymentBody, /Admissions still needs payment evidence or payment verification/i);
assert.match(paymentBody, /\[ACTION REQUIRED: confirm grade\]/);
assert.match(paymentBody, /\[ACTION REQUIRED: confirm subjects\]/);
assert.match(paymentBody, /\[ACTION REQUIRED: insert payment\/quote amount\]/);
assert.match(paymentBody, /Pay using the approved KIA payment account and upload the receipt\./);
assert.match(paymentBody, /Upload or send a clear payment receipt\/evidence/i);
assert.match(paymentBody, /does not confirm acceptance or enrolment/i);
assert.doesNotMatch(paymentBody, /\byou (?:are|have been) accepted\b/i);

const quoteBody = templateContext.buildApplicationVerifiedQuoteBody_(applicantContext);
assert.match(quoteBody, /completed document verification/i);
assert.match(quoteBody, /Applicant ID: FODE-26-TEST/);
assert.match(quoteBody, /\[ACTION REQUIRED: confirm grade\]/);
assert.match(quoteBody, /\[ACTION REQUIRED: confirm subjects\]/);
assert.match(quoteBody, /\[ACTION REQUIRED: insert payment\/quote amount\]/);
assert.match(quoteBody, /payment receipt\/evidence/i);
assert.match(quoteBody, /Next steps:/);
const quoteReadyContext = {
  applicantId: "FODE-26-QUOTE",
  portalUrl: "https://portal.example.test/quote",
  rowObj: {
    First_Name: "Quote",
    Last_Name: "Student",
    Grade: "Grade 10",
    Subjects_Selected_Canonical: "English, Mathematics",
    Docs_Verified: "Yes"
  }
};
const quoteReadyBody = templateContext.buildApplicationVerifiedQuoteBody_(quoteReadyContext);
assert.match(quoteReadyBody, /Estimated total payable: K1500/);
assert.match(quoteReadyBody, /Subject fee: K900 \(K450 x 2\)/);
assert.match(quoteReadyBody, /Pay using the approved KIA payment account and upload the receipt\./);
assert.doesNotMatch(quoteReadyBody, /\[ACTION REQUIRED: insert payment\/quote amount\]/);
assert.doesNotMatch(quoteReadyBody, /operator|internal|Do not rely/i);

const acceptanceBody = templateContext.buildApplicationAcceptanceConfirmationBody_(applicantContext);
assert.match(acceptanceBody, /Applicant ID: FODE-26-TEST/);
assert.match(acceptanceBody, /\[ACTION REQUIRED: confirm grade\]/);
assert.match(acceptanceBody, /\[ACTION REQUIRED: confirm subjects\]/);
assert.match(acceptanceBody, /\[ACTION REQUIRED: confirm acceptance\/enrolment status\]/);
assert.match(acceptanceBody, /Next steps:/);

const receiptRequestBody = templateContext.buildApplicationReceiptRequestBody_(applicantContext);
assert.match(receiptRequestBody, /Applicant ID: FODE-26-TEST/);
assert.match(receiptRequestBody, /Payment evidence \/ receipt is still required/i);
assert.match(receiptRequestBody, /upload a clear copy/i);
assert.match(receiptRequestBody, /does not confirm acceptance or enrolment/i);

const finalReminderBody = templateContext.buildApplicationFinalReminderBody_(applicantContext);
assert.match(finalReminderBody, /Applicant ID: FODE-26-TEST/);
assert.match(finalReminderBody, /upload or resend the missing required document/i);
assert.match(finalReminderBody, /\[ACTION REQUIRED: confirm deadline or urgency\]/);

assert.equal(templateContext.hasUnresolvedActionRequiredPlaceholder_("", paymentBody), true);
assert.equal(templateContext.hasUnresolvedActionRequiredPlaceholder_("", paymentBody.replace(/\[ACTION REQUIRED: [^\]]+\]/g, "operator confirmed")), false);
assert.equal(templateContext.communicationRequiresResolvedActionPlaceholders_("payment_followup"), true);
assert.equal(templateContext.communicationRequiresResolvedActionPlaceholders_("application_verified_quote"), true);
assert.equal(templateContext.communicationRequiresResolvedActionPlaceholders_("custom_email"), false);

const customSubject = templateContext.buildCustomSelectedEmailSubject_();
const customBody = templateContext.buildCustomSelectedEmailBody_(applicantContext);
assert.ok(customSubject);
assert.match(customBody, /FODE KIA application listed below/i);
assert.match(customBody, /Applicant ID: FODE-26-TEST/);
assert.doesNotMatch(customBody, /\[ACTION REQUIRED:/);

const reminderBody = templateContext.buildReminderEmailBody_(applicantContext);
assert.match(reminderBody, /awaiting your next step/i);
assert.doesNotMatch(reminderBody, /\[ACTION REQUIRED:/);

const prospectBody = templateContext.buildProspectGeneralGuidanceBody_({
  informationUrl: "https://example.test/fode",
  applicationUrl: "https://example.test/apply",
  faqUrl: "https://example.test/faq"
});
assert.match(prospectBody, /complete the online application form carefully/i);
assert.match(prospectBody, /upload the required identification, school records/i);
assert.match(prospectBody, /If you have already completed these steps, please ignore this message\./i);
assert.doesNotMatch(prospectBody, /Applicant ID|your application (?:has|was)|you have been accepted/i);
assert.doesNotMatch(prospectBody, /\{\{[^}]+\}\}/);

const examFeeBody = templateContext.buildApplicationExamFeeReminderBody_({ applicantId: "FODE-26-TEST" });
assert.match(examFeeBody, /National Exam Fee/i);
assert.match(examFeeBody, /K150 per subject/i);
assert.match(examFeeBody, /subject count must be checked/i);
assert.doesNotMatch(examFeeBody, /you (?:are|have been) accepted|you are enrolled/i);

const fdAcknowledgementSource = extractFunction(codeSource, "buildFdAcknowledgementEmailBody_");
assert.match(fdAcknowledgementSource, /application has been received/i);
assert.match(fdAcknowledgementSource, /Admissions will review/i);
assert.doesNotMatch(fdAcknowledgementSource, /\baccepted\b|\benrol(?:led|ment)\b/i);

const reminderSource = extractFunction(codeSource, "buildReminderEmailBody_");
assert.match(reminderSource, /awaiting your next step/i);
assert.doesNotMatch(reminderSource, /acceptance confirmation/i);

console.log("PASS communication semantic registry active/planned/manual definitions");
console.log("PASS active types exactly match configured runtime message types");
console.log("PASS expanded manual selected-applicant types normalize for selected-only gates");
console.log("PASS custom email selected-only and prospect Stage Batch authority blocked");
console.log("PASS overloaded reminder mappings and existing send gates remain explicit");
console.log("PASS selected-applicant editable binding and send payload safeguards");
console.log("PASS active template wording safety and docs-missing consequence language");
