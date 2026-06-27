const fs = require("node:fs");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const codeSource = fs.readFileSync("Code.js", "utf8");
const adminSource = fs.readFileSync("Admin.js", "utf8");
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
  "normalizeApplicantMessageType_",
  "getCommunicationSemanticRegistry_",
  "getCommunicationSemanticDefinition_",
  "isCommunicationTypeBatchSafe_",
  "getCommunicationAllowedSendModes_",
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
  assert.deepEqual(Array.from(def.allowedSendModes), ["selected"], `${messageType} must remain selected-only`);
  assert.equal(def.batchSafe, false, `${messageType} must not become batch-safe`);
  assert.equal(context.isCommunicationTypeBatchSafe_(messageType), false, `${messageType} batch safety helper must reject batch`);
}

for (const messageType of ["docs_missing", "payment_followup"]) {
  const def = context.getCommunicationSemanticDefinition_(messageType);
  assert.ok(def, `${messageType} semantic definition must exist`);
  assert.ok(def.allowedSendModes.indexOf("selected") >= 0, `${messageType} must remain selected-applicant available`);
  assert.equal(context.normalizeApplicantMessageType_(messageType), messageType, `${messageType} must normalize for selected-applicant preview/send`);
}

const registry = context.getCommunicationSemanticRegistry_();
const planned = registry.filter((entry) => entry.implementationStatus === "planned");
for (const entry of planned) {
  assert.equal(context.normalizeApplicantMessageType_(entry.messageType), "", `${entry.messageType} must not normalize into selected preview/send`);
  assert.equal(entry.requiredRole, "NOT_AUTHORIZED", `${entry.messageType} must not have a send-capable role`);
}

const stageMapper = extractFunction(adminSource, "getBatchMessageTypeForStage_");
assert.match(stageMapper, /case "DOCS_REQUIRED":[\s\S]*return "reminder"/, "DOCS_REQUIRED Stage Batch mapping must remain legacy reminder");
assert.match(stageMapper, /case "REMINDER_DUE":[\s\S]*return "reminder"/, "REMINDER_DUE Stage Batch mapping must remain legacy reminder");
assert.match(stageMapper, /case "INVITED_AWAITING_RESPONSE":[\s\S]*return "reminder"/, "INVITED_AWAITING_RESPONSE Stage Batch mapping must remain legacy reminder");
assert.match(stageMapper, /case "INVITE_PENDING":[\s\S]*return "legacy_invite"/, "INVITE_PENDING Stage Batch mapping must remain legacy invite");
assert.doesNotMatch(stageMapper, /custom_email|docs_missing|payment_followup|application_verified_quote|application_acceptance_confirmation|application_exam_fee_reminder/, "Selected/manual templates must not be Stage Batch mapped");

const sendApplicant = extractFunction(codeSource, "sendApplicantMessage_");
const dispatchApplicant = extractFunction(codeSource, "dispatchApplicantMessage_");
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

const selectedMarkup = adminUiSource.match(/<select id="commMessageType">([\s\S]*?)<\/select>/);
assert.ok(selectedMarkup, "Selected-applicant communication picker must exist");
assert.match(selectedMarkup[1], /value="custom_email"[\s\S]*Selected Applicant/, "custom_email picker label must remain selected-applicant scoped");
assert.match(adminUiSource, /Object\.assign\(payload, getCommEditablePayload_\(\)\)/, "Send payload must use edited subject/body");
assert.match(adminUiSource, /setCommEditableDraft_\(communicationsState\.result, messageType\)/, "Preview result must hydrate editable draft before send");

console.log("PASS selected-applicant templates remain selected-only and non-batch");
console.log("PASS Stage Batch mappings remain separated from selected/manual templates");
console.log("PASS unresolved operational placeholders remain send-blocking");
