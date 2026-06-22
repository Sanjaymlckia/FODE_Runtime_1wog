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
assert.equal(prospect.authorityModel, "PROSPECT_RECIPIENT_AUTHORITY_REQUIRED");
assert.match(prospect.operatorWarning, /must not use applicant Stage Batch authority/i);
assert.equal(Object.hasOwn(prospect, "subject"), false);
assert.equal(Object.hasOwn(prospect, "body"), false);
assert.doesNotMatch(JSON.stringify(prospect), /\{\{[^}]+\}\}/);

const examFeeReminder = context.getCommunicationSemanticDefinition_("application_exam_fee_reminder");
assert.ok(examFeeReminder, "Planned National Exam Fee reminder must exist");
assert.equal(examFeeReminder.audienceClass, "APPLICANT_WORKFLOW");
assert.equal(examFeeReminder.implementationStatus, "planned");
assert.equal(examFeeReminder.requiresApplicantRow, true);
assert.equal(examFeeReminder.requiresValidEmail, true);
assert.equal(examFeeReminder.requiresExamFeeDueAuthority, true);
assert.equal(examFeeReminder.requiresSubjectConfirmation, true);
assert.equal(examFeeReminder.currentFeePerSubjectKina, 150);
assert.equal(examFeeReminder.batchSafe, false);
assert.equal(context.isCommunicationTypeBatchSafe_("application_exam_fee_reminder"), false);
assert.equal(context.normalizeApplicantMessageType_("application_exam_fee_reminder"), "");
assert.match(examFeeReminder.operatorWarning, /confirm the subject count/i);

for (const entry of registry.filter((item) => item.audienceClass === "APPLICANT_WORKFLOW")) {
  assert.equal(entry.requiresApplicantRow, true, `${entry.messageType} must require an applicant row`);
}

for (const entry of planned) {
  assert.equal(context.isCommunicationTypePlanned_(entry.messageType), true);
  assert.equal(context.normalizeApplicantMessageType_(entry.messageType), "", `${entry.messageType} must remain rejected by preview/send normalization`);
  assert.equal(entry.requiredRole, "NOT_AUTHORIZED");
}
assert.equal(context.normalizeApplicantMessageType_(manual[0].messageType), "", "Manual fallback must not become a normal email message type");

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
for (const stage of ["INVITED_AWAITING_RESPONSE", "REMINDER_DUE", "DOCS_REQUIRED", "PAYMENT_REQUIRED", "RECEIPT_AWAITING_VERIFICATION"]) {
  assert.match(stageMapper, new RegExp(`case\\s+"${stage}"`), `${stage} mapping must remain visible to the overload test`);
}
assert.match(stageMapper, /return\s+"reminder"/, "Current overloaded reminder stage mapping must remain explicitly detected");
assert.doesNotMatch(stageMapper, /application_exam_fee_reminder/, "Exam fee reminder must not be Stage Batch mapped");
assert.doesNotMatch(stageMapper, /docs_missing|payment_followup/, "H3 must not remap Stage Batch to selected-applicant template types");

const selectedMessageTypeSelect = adminUiSource.match(/<select id="commMessageType">([\s\S]*?)<\/select>/);
assert.ok(selectedMessageTypeSelect, "Selected-applicant message type picker must exist");
const selectedMessageTypeMarkup = selectedMessageTypeSelect[1];
for (const messageType of ["legacy_invite", "reminder", "docs_missing", "payment_followup", "application_feedback", "custom_email"]) {
  assert.match(selectedMessageTypeMarkup, new RegExp(`value="${messageType}"`), `${messageType} must be available in the selected-applicant picker`);
}
for (const messageType of planned.map((entry) => entry.messageType)) {
  assert.doesNotMatch(selectedMessageTypeMarkup, new RegExp(`value="${messageType}"`), `${messageType} must remain hidden from the selected-applicant picker`);
}

const previewSource = extractFunction(codeSource, "previewApplicantMessage_");
const sendSource = extractFunction(codeSource, "sendApplicantMessage_");
assert.match(previewSource, /resolveApplicantMessageContext_/, "Preview must continue through existing context authority");
assert.match(sendSource, /resolveApplicantMessageContext_/, "Send must continue through existing context authority");
assert.match(sendSource, /isSystemStabilizationModeActive_/, "Existing stabilization send gate must remain");
assert.match(sendSource, /ENABLE_PRODUCTION_EMAIL_SENDS/, "Existing production send gate must remain");
assert.match(codeSource, /computeEmailIdempotencyKey_/, "Existing idempotency path must remain");
assert.match(codeSource, /communicationCooldownMs_/, "Existing cooldown path must remain");

const templateFunctionNames = [
  "buildParentOrApplicantName_",
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
  clean_: (value) => String(value == null ? "" : value).trim()
};
vm.createContext(templateContext);
vm.runInContext(templateFunctionNames.map((name) => extractFunction(codeSource, name)).join("\n\n"), templateContext);

const applicantContext = {
  applicantId: "FODE-26-TEST",
  portalUrl: "https://portal.example.test/safe",
  rowObj: {
    Parent_First_Name: "Test",
    Parent_Last_Name: "Parent"
  }
};
const docsMissingBody = templateContext.buildDocsMissingEmailBody_(applicantContext);
assert.match(docsMissingBody, /not available or are incomplete/i);
assert.match(docsMissingBody, /did not reach us correctly/i);
assert.match(docsMissingBody, /upload or resend/i);
assert.doesNotMatch(docsMissingBody, /\breject(?:ed|ion)?\b/i);
assert.doesNotMatch(docsMissingBody, /\byour (?:fault|failure)\b/i);

const paymentBody = templateContext.buildPaymentFollowupEmailBody_(applicantContext);
assert.match(paymentBody, /payment receipt/i);
assert.match(paymentBody, /does not confirm acceptance or enrolment/i);
assert.doesNotMatch(paymentBody, /\byou (?:are|have been) accepted\b/i);

const customSubject = templateContext.buildCustomSelectedEmailSubject_();
const customBody = templateContext.buildCustomSelectedEmailBody_(applicantContext);
assert.ok(customSubject);
assert.match(customBody, /selected FODE KIA applicant record/i);
assert.match(customBody, /Applicant ID: FODE-26-TEST/);

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
assert.match(reminderSource, /pending completion/i);
assert.doesNotMatch(reminderSource, /payment receipt|documents verified|acceptance confirmation/i);

console.log("PASS communication semantic registry active/planned/manual definitions");
console.log("PASS active types exactly match configured runtime message types");
console.log("PASS planned types remain rejected by preview/send normalization");
console.log("PASS custom email selected-only and prospect Stage Batch authority blocked");
console.log("PASS overloaded reminder mappings and existing send gates remain explicit");
console.log("PASS active and planned template wording safety");
console.log("PASS selected-applicant docs/payment exposure and inert exam-fee semantics");
