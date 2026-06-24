const fs = require("node:fs");
const assert = require("node:assert/strict");

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

const getAdminRole = extractFunction(adminSource, "getAdminRole_");
const isDocVerifier = extractFunction(adminSource, "isDocumentVerifier_");
const requireDocVerifier = extractFunction(adminSource, "requireDocumentVerifier_");
const saveDocs = extractFunction(adminSource, "admin_updateDocStatuses_impl_");
const manifest = extractFunction(adminSource, "admin_getApplicantDocumentManifest");
const fileAction = extractFunction(adminSource, "admin_getApplicantDocumentFileAction");
const stagePreview = extractFunction(adminSource, "admin_previewStageBatch");
const stageSend = extractFunction(adminSource, "admin_sendStageBatch");
const paymentVerify = extractFunction(adminSource, "admin_setPaymentVerified_impl_");
const zohoCreate = extractFunction(adminSource, "admin_createZohoBooksFodeDraftInvoice");
const zohoSend = extractFunction(adminSource, "admin_sendZohoBooksTestInvoiceEmail");

assert.match(configSource, /"enquiries@kundu\.ac":\s*"VERIFIER"/, "enquiries@kundu.ac must remain the existing VERIFIER role");
assert.match(getAdminRole, /return "VERIFIER"/, "Unknown configured admin role fallback remains VERIFIER, not a new RBAC role");
assert.match(isDocVerifier, /return isAdmin_\(email\)/, "Document verifier path must use the existing admin allowlist/access model");
assert.match(requireDocVerifier, /Access denied: document verifier required/, "Blocked document-save path must provide a clear role reason");

assert.match(saveDocs, /requireDocumentVerifier_\(adminEmail\)/, "Save Document Statuses must allow the existing document verifier path");
assert.doesNotMatch(saveDocs.slice(0, saveDocs.indexOf("payload = payload") + 1), /requireSuperAdmin_\(adminEmail\)/, "Save Document Statuses must not remain Super-only at entry");
assert.match(saveDocs, /setCell_\(sh,\s*rowNumber,\s*idx,\s*"Doc_Last_Verified_By",\s*adminEmail \|\| "admin"\)/, "Document save must stamp the signed-in operator email");
assert.match(saveDocs, /captureOperatorAttribution_[\s\S]*operatorEmail:\s*adminEmail/, "Document save must preserve operator attribution");
assert.match(saveDocs, /changedFields:[\s\S]*previousStatus[\s\S]*newStatus/, "Document save audit must include previous/new status values");
assert.match(saveDocs, /canWritePaymentAuthority = canBypassPaymentFreeze_\(adminEmail\)/, "Payment authority must continue to use the existing Super-only payment bypass helper");
assert.match(saveDocs, /PAYMENT_STATUS_ROLE_BLOCK/, "Non-Super receipt/payment changes must be audited as blocked");
assert.match(saveDocs, /PAYMENT_AUTHORITY_REQUIRED/, "Non-Super receipt/payment changes must return a clear role block");
assert.match(saveDocs, /if \(!receiptChanged && !canWritePaymentAuthority\) continue;/, "Unchanged receipt payload entries should be skipped for non-Super document verifiers");

assert.match(manifest, /requireDocumentVerifier_\(adminEmail\)/, "Document manifest must be available to the document verifier path");
assert.match(fileAction, /requireDocumentVerifier_\(adminEmail\)/, "Secure document file actions must be available to the document verifier path");

assert.match(adminUiSource, /const CAN_SAVE_DOCUMENT_STATUSES = !!String\(ADMIN_ROLE \|\| ""\)\.trim\(\)/, "UI must expose document-save authority for existing configured roles");
assert.match(adminUiSource, /if \(!CAN_SAVE_DOCUMENT_STATUSES\)[\s\S]*configured document verifier required to save document statuses/, "UI saveDocs guard must use document-verifier authority");
assert.doesNotMatch(extractFunction(adminUiSource, "saveDocs"), /if \(!IS_SUPER\)/, "UI saveDocs must not remain Super-only");
assert.match(adminUiSource, /Save document verification statuses\. Audit records the signed-in operator email\./, "UI must label document save audit behavior clearly");

assert.match(stagePreview, /requireOperationsAdmin_\(adminEmail\)/, "Stage Batch preview must remain Operations/Super gated");
assert.match(stageSend, /requireOperationsAdmin_\(adminEmail\)/, "Stage Batch send must remain Operations/Super gated");
assert.match(paymentVerify, /requireSuperAdmin_\(adminEmail\)/, "Payment verification must remain Super-only");
assert.match(zohoCreate, /canWriteZohoBooksForAdmin_\(adminEmail\)/, "Zoho Books live draft invoice creation must remain write-admin gated");
assert.match(zohoSend, /canWriteZohoBooksForAdmin_\(adminEmail\)/, "Zoho Books live/test invoice email send must remain write-admin gated");

console.log("PASS existing VERIFIER role documented for enquiries@kundu.ac");
console.log("PASS operator/document-verifier path can save document statuses with signed-in audit attribution");
console.log("PASS document gallery and secure file actions use document-verifier access");
console.log("PASS Stage Batch, payment verification, and Zoho live write/send gates remain restricted");
