const fs = require("node:fs");
const assert = require("node:assert/strict");
const vm = require("node:vm");

function read(path) {
  return fs.readFileSync(path, "utf8");
}

const adminUi = read("AdminUI.html");
const serverSources = ["Code.js", "Admin.js", "Admin_WhatsAppFallback.js", "Admin_StageBatchCommunications.js", "Admin_SelectedApplicantCommunications.js", "Admin_AccessControl.js", "Admin_LifecycleAuthority.js", "Admin_PaymentAuthority.js", "Admin_ReviewQueues.js", "Admin_ReviewStatusAuthority.js", "Admin_RowFacts.js", "Admin_DocumentServices.js", "Admin_DocumentGallery.js", "Routes.js", "Utils.js", "Config.js"]
  .map(read)
  .join("\n");

function appsScriptTemplateSafe(source) {
  return source
    .replace(/(["'])<\?[\s\S]*?\?>\1/g, '"__APPS_SCRIPT_TEMPLATE__"')
    .replace(/<\?[\s\S]*?\?>/g, '"__APPS_SCRIPT_TEMPLATE__"');
}

function extractScriptBlocks(source) {
  return Array.from(source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi), (match) => match[1]);
}

const scriptBlocks = extractScriptBlocks(adminUi);
assert.ok(scriptBlocks.length >= 1, "AdminUI must contain parseable script blocks");

scriptBlocks.forEach((block, index) => {
  const sanitized = appsScriptTemplateSafe(block);
  assert.doesNotMatch(sanitized, /"\s*\n\s*"/, `script block ${index} must not contain obvious broken string literal joins`);
  assert.doesNotMatch(sanitized, /https:\s*$/m, `script block ${index} must not contain a stranded https: token`);
  assert.doesNotThrow(() => new vm.Script(sanitized, { filename: `AdminUI.script.${index}.js` }), `AdminUI script block ${index} must parse after Apps Script template placeholder substitution`);
});

const serverFunctions = new Set(Array.from(
  serverSources.matchAll(/\bfunction\s+([A-Za-z_$][\w$]*)\s*\(/g),
  (match) => match[1]
));

function extractRpcCalls(source) {
  const calls = new Set();
  const dynamic = [];
  for (const call of source.matchAll(/\.(admin_[A-Za-z0-9_]+|legacy_admin_[A-Za-z0-9_]+|portalUploadBase64|uploadPortalFile|portal_deleteUploadedFile)\s*\(/g)) {
    calls.add(call[1]);
  }
  for (const call of source.matchAll(/\b(?:run_|runCommunicationsAction_)\(\s*"([A-Za-z_$][\w$]*)"/g)) {
    calls.add(call[1]);
  }
  for (const dyn of source.matchAll(/google\.script\.run[\s\S]{0,1200}?\[\s*([A-Za-z_$][\w$]*)\s*\]\s*\(/g)) {
    dynamic.push(dyn[1]);
  }
  return { calls: Array.from(calls).sort(), dynamic };
}

const rpc = extractRpcCalls(adminUi);
assert.ok(rpc.calls.length >= 30, "AdminUI RPC map should discover the main google.script.run server calls");
assert.deepEqual(Array.from(new Set(rpc.dynamic)), ["fnName"], "Only the reviewed fnName dispatcher may use dynamic google.script.run dispatch");
assert.match(adminUi, /function run_\([\s\S]*typeof runner\[fnName\] !== "function"/, "Generic RPC dispatcher must fail closed on unknown actions");
assert.match(adminUi, /runCommunicationsAction_\("admin_previewApplicantMessage"/, "Communications dynamic dispatch must use literal preview RPC name");
assert.match(adminUi, /runCommunicationsAction_\("admin_sendApplicantMessage"/, "Communications dynamic dispatch must use literal send RPC name");

const missing = rpc.calls.filter((name) => !serverFunctions.has(name));
assert.deepEqual(missing, [], `Every AdminUI google.script.run RPC must resolve to a server function. Missing: ${missing.join(", ")}`);

const protectedRpcs = [
  "admin_getRuntimeInfo",
  "admin_getReviewQueues",
  "admin_getApplicantDetail_json",
  "admin_updateDocStatuses",
  "admin_getApplicantDocumentManifest",
  "admin_getApplicantDocumentFileAction",
  "admin_getApplicantDocumentImageRendition",
  "admin_previewApplicantMessage",
  "admin_sendApplicantMessage",
  "admin_previewStageBatch",
  "admin_sendStageBatch",
  "admin_setPaymentVerified",
  "admin_previewZohoBooksFodePayload",
  "admin_createZohoBooksFodeDraftInvoice"
];

for (const name of protectedRpcs) {
  assert.ok(rpc.calls.includes(name), `Protected AdminUI RPC must remain visible: ${name}`);
}

assert.doesNotMatch(adminUi, /console\.log\([^)]*(rawValue|fileId|folderId|PortalTokenSecret)/i, "AdminUI console logging must not expose raw file/folder/token details");
assert.match(adminUi, /withFailureHandler\(function\(err\)/, "AdminUI RPC calls must keep failure handlers");
assert.match(adminUi, /Runtime: loading\.\.\./, "AdminUI must retain visible runtime-loading state for hydration diagnostics");
assert.match(adminUi, /id="commOverridePanel"/, "Communication override panel must remain explicit in the selected-applicant UI");
assert.match(adminUi, /IS_SUPER === true[\s\S]*commOverridePanelVisible_/, "Communication override UI must stay Super Admin gated");
assert.match(adminUi, /authorityOverrideReason/, "Communication override payload must include mandatory justification text");

console.log("PASS AdminUI inline scripts parse after Apps Script template substitution");
console.log("PASS AdminUI google.script.run calls resolve to server functions");
console.log("PASS AdminUI protected RPC contract remains visible");
