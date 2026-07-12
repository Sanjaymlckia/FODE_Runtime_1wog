const fs = require("node:fs");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const configSource = fs.readFileSync("Config.js", "utf8");
const accessSource = fs.readFileSync("Admin_AccessControl.js", "utf8");
const codeSource = fs.readFileSync("Code.js", "utf8");
const selectedApplicantSource = fs.readFileSync("Admin_SelectedApplicantCommunications.js", "utf8");

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

const configContext = {};
vm.createContext(configContext);
vm.runInContext(configSource, configContext);
const { CONFIG } = configContext;

const capabilityContext = {
  CONFIG,
  console,
  getZohoBooksWriteAdminEmails_: () => [],
  clean_: (value) => String(value == null ? "" : value).trim()
};
vm.createContext(capabilityContext);
vm.runInContext([
  extractFunction(accessSource, "normalizeAdminEmail_"),
  extractFunction(accessSource, "adminCapabilityCatalog_"),
  extractFunction(accessSource, "adminCapabilityRoleDefaults_"),
  extractFunction(accessSource, "getConfiguredAdminAccounts_"),
  extractFunction(accessSource, "isAdmin_"),
  extractFunction(accessSource, "getAdminRole_"),
  extractFunction(accessSource, "adminCapabilityBlockCode_"),
  extractFunction(accessSource, "adminCapabilityBlockReason_"),
  extractFunction(accessSource, "resolveAdminCapabilities_"),
  extractFunction(accessSource, "adminHasCapability_"),
  extractFunction(accessSource, "isOperationsAdmin_"),
  extractFunction(accessSource, "isDocumentVerifier_")
].join("\n\n"), capabilityContext);

const configuredAccounts = capabilityContext.getConfiguredAdminAccounts_();
assert.equal(
  JSON.stringify(configuredAccounts.map((entry) => String(entry.email))),
  JSON.stringify([
    "enquiries@kundu.ac",
    "fode_kia@kundu.ac",
    "mlc@minervacenters.com",
    "mlccorporate@minervacenters.com",
    "operations@minervacenters.com",
    "principal@kundu.ac",
    "sanjay@minervacenters.com"
  ]),
  "Configured operational accounts must be inventoried from runtime config"
);

const enquiries = capabilityContext.resolveAdminCapabilities_(" ENQUIRIES@KUNDU.AC ");
assert.equal(enquiries.normalizedRole, "VERIFIER");
assert.equal(enquiries.allowlisted, true);
assert.equal(enquiries.capabilities.CAN_OPEN_REVIEW_WORKSPACE, true);
assert.equal(enquiries.capabilities.CAN_SAVE_DOCUMENT_STATUSES, true);
assert.equal(enquiries.capabilities.CAN_PREVIEW_APPLICANT_COMMUNICATION, true);
assert.equal(enquiries.capabilities.CAN_EDIT_APPLICANT_COMMUNICATION, true);
assert.equal(enquiries.capabilities.CAN_INSERT_PORTAL_LINK, true);
assert.equal(enquiries.capabilities.CAN_SEND_INDIVIDUAL_EMAIL, true);
assert.equal(enquiries.capabilities.CAN_GENERATE_STANDARD_QUOTE, true);
assert.equal(enquiries.capabilities.CAN_RUN_BATCH_COMMUNICATIONS, false);
assert.equal(enquiries.capabilities.CAN_VERIFY_PAYMENT, false);
assert.equal(enquiries.capabilities.CAN_OVERRIDE_COOLDOWN, false);
assert.equal(enquiries.capabilities.CAN_APPROVE_FINANCIAL_OVERRIDE, false);
assert.equal(enquiries.capabilities.CAN_ADMINISTER_RUNTIME, false);
assert.equal(enquiries.capabilities.CAN_DEPLOY_RUNTIME, false);

const principal = capabilityContext.resolveAdminCapabilities_("principal@kundu.ac");
assert.equal(principal.normalizedRole, "OPERATIONS");
assert.equal(principal.capabilities.CAN_RUN_BATCH_COMMUNICATIONS, true);
assert.equal(principal.capabilities.CAN_GENERATE_STANDARD_INVOICE, true);
assert.equal(principal.capabilities.CAN_VERIFY_PAYMENT, false);
assert.equal(principal.capabilities.CAN_DEPLOY_RUNTIME, false);

const operations = capabilityContext.resolveAdminCapabilities_("operations@minervacenters.com");
assert.equal(operations.normalizedRole, "OPERATIONS");
assert.equal(operations.capabilities.CAN_SEND_INDIVIDUAL_EMAIL, true);
assert.equal(operations.capabilities.CAN_RUN_BATCH_COMMUNICATIONS, true);
assert.equal(operations.capabilities.CAN_GENERATE_STANDARD_INVOICE, true);
assert.equal(operations.capabilities.CAN_VERIFY_PAYMENT, false);
assert.equal(operations.capabilities.CAN_OVERRIDE_COOLDOWN, false);
assert.equal(operations.capabilities.CAN_APPROVE_FINANCIAL_OVERRIDE, false);
assert.equal(operations.capabilities.CAN_ADMINISTER_RUNTIME, false);
assert.equal(operations.capabilities.CAN_DEPLOY_RUNTIME, false);

const superAdmin = capabilityContext.resolveAdminCapabilities_("sanjay@minervacenters.com");
assert.equal(superAdmin.normalizedRole, "SUPER");
assert.equal(superAdmin.capabilities.CAN_RUN_BATCH_COMMUNICATIONS, true);
assert.equal(superAdmin.capabilities.CAN_VERIFY_PAYMENT, true);
assert.equal(superAdmin.capabilities.CAN_OVERRIDE_COOLDOWN, true);
assert.equal(superAdmin.capabilities.CAN_APPROVE_FINANCIAL_OVERRIDE, true);
assert.equal(superAdmin.capabilities.CAN_MANAGE_PORTAL_ACCESS, true);
assert.equal(superAdmin.capabilities.CAN_ADMINISTER_RUNTIME, true);
assert.equal(superAdmin.capabilities.CAN_DEPLOY_RUNTIME, true);
assert.equal(superAdmin.capabilities.CAN_WRITE_ZOHO_BOOKS, true);

const unknown = capabilityContext.resolveAdminCapabilities_("unknown@example.test");
assert.equal(unknown.allowlisted, false);
assert.equal(unknown.normalizedRole, "");
for (const key of Object.keys(unknown.capabilities)) {
  assert.equal(unknown.capabilities[key], false, `Unknown account must not receive ${key}`);
}

assert.equal(capabilityContext.isDocumentVerifier_("enquiries@kundu.ac"), true, "Document verifier helper must follow capability authority");
assert.equal(capabilityContext.isOperationsAdmin_("enquiries@kundu.ac"), false, "Verifier must not receive batch authority");
assert.equal(capabilityContext.isOperationsAdmin_("principal@kundu.ac"), true, "Operations role must receive batch authority");

const projectionContext = {
  CONFIG,
  clean_: (value) => String(value == null ? "" : value).trim(),
  normalizeApplicantMessageType_: (value) => String(value || "").trim().toLowerCase(),
  normalizeLifecycleStageKey_: (value) => String(value || "").trim().toUpperCase(),
  deriveApplicantLifecycleStage_: () => "DOCS_REQUIRED",
  resolveCanonicalApplicantLifecycle_: () => ({
    baseState: "INCOMPLETE_DOCUMENTS",
    lifecycleStage: "INCOMPLETE_DOCUMENTS",
    overlays: [],
    recommendedMessageType: "docs_missing"
  }),
  communicationRecommendedMessageTypeForStage_: () => "docs_missing",
  resolveApplicantMessageContextFromRow_: () => ({
    permitted: true,
    sendableNow: true,
    eligible: true,
    blockCode: "",
    blockReason: "",
    canonicalLifecycleAuthority: { authoritySource: "CANONICAL_LIFECYCLE" }
  }),
  isLifecycleAwaitingResponseStage_: () => false,
  communicationOverlayStatusFromCode_: (code) => String(code || "").trim().toUpperCase() || "ACTIONABLE",
  communicationBlockReason_: (code) => String(code || ""),
  adminHasCapability_: (_actor, capability) => capability !== "CAN_SEND_INDIVIDUAL_EMAIL",
  adminCapabilityBlockCode_: (capability) => capability === "CAN_SEND_INDIVIDUAL_EMAIL" ? "INDIVIDUAL_EMAIL_CAPABILITY_REQUIRED" : "ROLE_BLOCKED",
  adminCapabilityBlockReason_: (capability) => capability === "CAN_SEND_INDIVIDUAL_EMAIL" ? "Individual applicant email capability is required before send." : "Blocked"
};
vm.createContext(projectionContext);
vm.runInContext([
  extractFunction(codeSource, "communicationGetActorInfo_"),
  extractFunction(codeSource, "communicationRequiredCapabilityForAction_"),
  extractFunction(codeSource, "communicationActorHasCapability_"),
  extractFunction(codeSource, "communicationCapabilityBlock_"),
  extractFunction(codeSource, "buildApplicantCommunicationAuthorityProjection_")
].join("\n\n"), projectionContext);

const projected = projectionContext.buildApplicantCommunicationAuthorityProjection_(
  { ApplicantID: "FODE-26-TEST-ROLE" },
  2,
  {},
  "docs_missing",
  { actorEmail: "enquiries@kundu.ac", actorRole: "VERIFIER" }
);
assert.equal(projected.recommendedMessageType, "docs_missing");
assert.equal(projected.selectedMessageType, "docs_missing");
assert.equal(projected.permitted, false, "Capability-aware projection must not claim send permission when individual-send capability is absent");
assert.equal(projected.sendableNow, false, "Capability-aware projection must not claim sendability when individual-send capability is absent");
assert.equal(projected.blockCode, "INDIVIDUAL_EMAIL_CAPABILITY_REQUIRED");
assert.equal(projected.blockReason, "Individual applicant email capability is required before send.");

const wrapperContext = {
  CONFIG,
  clean_: (value) => String(value == null ? "" : value).trim(),
  safeStr_: (value) => String(value == null ? "" : value).trim(),
  withEnvelope_: (_name, fn) => fn("DBG-ROLE"),
  getCallerEmail_: () => wrapperContext.__email,
  isAdmin_: capabilityContext.isAdmin_,
  adminHasCapability_: capabilityContext.adminHasCapability_,
  adminCapabilityBlockCode_: capabilityContext.adminCapabilityBlockCode_,
  adminCapabilityBlockReason_: capabilityContext.adminCapabilityBlockReason_,
  getAdminRole_: capabilityContext.getAdminRole_,
  resolveAdminCommActor_: () => ({ actorEmail: wrapperContext.__email, actorRole: capabilityContext.getAdminRole_(wrapperContext.__email), isSuper: false }),
  normalizeApplicantMessageType_: (value) => String(value || "").trim().toLowerCase(),
  adminCommBlockedResult_: (action, blockCode, debugId, extra) => ({
    ok: false,
    action,
    result: "BLOCKED",
    eligible: false,
    blockCode,
    blockReason: extra && extra.blockReason || "",
    debugId
  }),
  runOpsSafeModeGate_: () => ({ ok: true, safeMode: false }),
  sendApplicantMessage_: (_applicantId, _messageType, _opts) => ({ ok: true, result: "SENT", eligible: true }),
  parseOverrideFlag_: () => false,
  CONFIG: Object.assign({}, CONFIG, { OPS_SAFE_MODE_TEST_RECIPIENT_OVERRIDE: "" })
};
vm.createContext(wrapperContext);
vm.runInContext([
  extractFunction(selectedApplicantSource, "admin_previewApplicantMessage"),
  extractFunction(selectedApplicantSource, "admin_sendApplicantMessage")
].join("\n\n"), wrapperContext);

wrapperContext.__email = "enquiries@kundu.ac";
const verifierSend = wrapperContext.admin_sendApplicantMessage({
  applicantId: "FODE-26-TEST-ROLE",
  messageType: "docs_missing",
  confirmManualSingleSend: true
});
assert.equal(verifierSend.result, "SENT", "Configured verifier must be able to send an individually reviewed applicant email");

wrapperContext.__email = "principal@kundu.ac";
const operationsSend = wrapperContext.admin_sendApplicantMessage({
  applicantId: "FODE-26-TEST-ROLE",
  messageType: "payment_followup",
  confirmManualSingleSend: true
});
assert.equal(operationsSend.result, "SENT", "Configured Operations account must retain individual send capability");

wrapperContext.__email = "operations@minervacenters.com";
const secondOperationsSend = wrapperContext.admin_sendApplicantMessage({
  applicantId: "FODE-26-TEST-ROLE",
  messageType: "payment_followup",
  confirmManualSingleSend: true
});
assert.equal(secondOperationsSend.result, "SENT", "Secondary configured Operations account must retain individual send capability");

wrapperContext.__email = "unknown@example.test";
assert.throws(() => wrapperContext.admin_sendApplicantMessage({
  applicantId: "FODE-26-TEST-ROLE",
  messageType: "docs_missing",
  confirmManualSingleSend: true
}), /Access denied/, "Unknown account must remain blocked at the backend boundary");

console.log("PASS configured admin accounts resolve through explicit capability authority");
console.log("PASS verifier and operations individual-send paths use capability gates without inheriting batch authority");
console.log("PASS capability-aware communication projection surfaces the same individual-send block code as the backend wrapper");
