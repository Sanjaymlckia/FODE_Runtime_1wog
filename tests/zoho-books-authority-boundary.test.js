const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const codeSource = fs.readFileSync("Code.js", "utf8");
const adminSource = [
  fs.readFileSync("Admin.js", "utf8"),
  fs.readFileSync("Admin_LifecycleAuthority.js", "utf8"),
  fs.readFileSync("Admin_ReviewQueues.js", "utf8")
].join("\n");
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

function assertNoBooksAuthority(source, label) {
  assert.doesNotMatch(source, /Books_Invoice_ID|Books_Invoice_Number|Books_Invoice_Status|Books_Push_Status|FODE_Billing_Reference/, `${label} must not derive authority from Books metadata`);
  assert.doesNotMatch(source, /CRM_Invoice_Triggered|Invoice_Sent_At/, `${label} must not derive authority from legacy invoice-trigger compatibility fields`);
}

const runtimeContext = {
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
vm.createContext(runtimeContext);
vm.runInContext([
  extractFunction(codeSource, "resolveDocStatusKeys_"),
  extractFunction(codeSource, "normalizeOverallDocValue_"),
  extractFunction(codeSource, "computeDocVerificationStatus_"),
  extractFunction(codeSource, "derivePaymentBadge_"),
  extractFunction(codeSource, "deriveCanonicalPaymentState_"),
  extractFunction(codeSource, "canonicalPaymentBadge_"),
  extractFunction(codeSource, "isCanonicalPaymentVerified_"),
  extractFunction(codeSource, "isCanonicalPaymentRejected_"),
  extractFunction(codeSource, "communicationPaymentOutstanding_"),
  extractFunction(codeSource, "deriveApplicantLifecycleStage_")
].join("\n\n"), runtimeContext);

const canonicalPaymentRow = {
  Docs_Verified: "Yes",
  Receipt_Status: "",
  Payment_Verified: "",
  Fee_Receipt_File: "",
  Books_Invoice_ID: "123456789",
  Books_Invoice_Number: "INV-001",
  Books_Invoice_Status: "draft",
  Books_Push_Status: "DRAFT_INVOICE_CREATED",
  CRM_Invoice_Triggered: "Yes",
  Invoice_Sent_At: "2026-07-11T12:00:00Z",
  FODE_Billing_Reference: "FODE-TEST-001"
};

assert.equal(
  runtimeContext.communicationPaymentOutstanding_(canonicalPaymentRow),
  true,
  "Books metadata and legacy invoice-trigger markers must not suppress payment-outstanding state"
);
assert.equal(
  runtimeContext.deriveApplicantLifecycleStage_(canonicalPaymentRow),
  "PAYMENT_REQUIRED",
  "Books metadata and legacy invoice-trigger markers must not advance lifecycle without canonical payment verification"
);

const canonicalPaidRow = Object.assign({}, canonicalPaymentRow, {
  Receipt_Status: "Verified",
  Payment_Verified: ""
});
assert.equal(
  runtimeContext.communicationPaymentOutstanding_(canonicalPaidRow),
  false,
  "canonical Receipt_Status Verified must remain the payment suppression authority even when raw compatibility fields differ"
);
assert.equal(
  runtimeContext.deriveApplicantLifecycleStage_(canonicalPaidRow),
  "COMPLETE",
  "canonical Receipt_Status Verified must remain the lifecycle completion authority"
);

const actionabilityResolver = extractFunction(adminSource, "resolveActionabilityState_");
const previewRowBuilder = extractFunction(adminSource, "buildActionabilityPreviewRow_");
const canonicalLifecycleResolver = extractFunction(adminSource, "resolveCanonicalApplicantLifecycle_");
const reviewPaymentLabel = extractFunction(adminUiSource, "reviewPaymentLabelFromAuthority_");
const previewBooksRpc = extractFunction(adminSource, "admin_previewZohoBooksFodePayload");
const createBooksRpc = extractFunction(adminSource, "admin_createZohoBooksFodeDraftInvoice");
const legacyWebhook = extractFunction(adminSource, "triggerInvoiceWebhook_");
const legacyHandle = extractFunction(adminSource, "handleInvoiceTrigger_");

assertNoBooksAuthority(actionabilityResolver, "resolveActionabilityState_");
assertNoBooksAuthority(previewRowBuilder, "buildActionabilityPreviewRow_");
assertNoBooksAuthority(canonicalLifecycleResolver, "resolveCanonicalApplicantLifecycle_");

assert.match(reviewPaymentLabel, /authorityState\.paymentVerified/, "Review Workspace payment display must remain authority-backed");
assert.match(reviewPaymentLabel, /canonicalLifecycle/, "Review Workspace payment display must consult canonical lifecycle state");
assert.doesNotMatch(reviewPaymentLabel, /Books_Invoice_ID|Books_Invoice_Number|Books_Invoice_Status|Books_Push_Status/, "Review Workspace payment display must not derive payment label from Books metadata");

assert.match(previewBooksRpc, /buildZohoBooksPreviewResult_/, "Books preview RPC must remain an integration preview surface");
assert.match(createBooksRpc, /buildZohoBooksWritebackPatch_/, "Books create RPC must remain an integration writeback surface");
assert.match(createBooksRpc, /Books_Invoice_ID/, "Books create RPC may persist external invoice metadata");
assert.doesNotMatch(createBooksRpc, /Receipt_Status/, "Books create RPC must not write canonical payment authority");

assert.match(codeSource, /CRM_Invoice_Triggered` is retained as a legacy compatibility marker only\./, "CRM invoice trigger state must remain explicitly documented in source as compatibility-only");
assert.match(legacyHandle, /legacy compatibility marker/, "Legacy invoice-trigger wrapper must remain explicitly classified as compatibility-only");
assert.match(legacyHandle, /CRM_Invoice_Triggered: "Yes"/, "Legacy invoice-trigger wrapper may still persist compatibility replay state");
assert.match(legacyHandle, /Invoice_Sent_At: ts/, "Legacy invoice-trigger wrapper may still persist compatibility timestamp state");

console.log("PASS Books metadata does not override canonical payment authority");
console.log("PASS lifecycle and workload authority remain independent of Books metadata");
console.log("PASS legacy invoice-trigger path remains classified as compatibility only");
