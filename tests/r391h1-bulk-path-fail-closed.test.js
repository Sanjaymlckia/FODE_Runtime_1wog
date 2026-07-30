const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function source(file) {
  return fs.readFileSync(file, "utf8");
}

function extractFunction(text, name) {
  const start = text.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `missing function ${name}`);
  const brace = text.indexOf("{", start);
  let depth = 0;
  for (let index = brace; index < text.length; index += 1) {
    if (text[index] === "{") depth += 1;
    if (text[index] === "}" && --depth === 0) return text.slice(start, index + 1);
  }
  throw new Error(`unterminated function ${name}`);
}

const utils = source("Utils.js");
const code = source("Code.js");
const stage = source("Admin_StageBatchCommunications.js");
const selected = source("Admin_SelectedApplicantCommunications.js");
const admin = source("Admin.js");
const adminUi = source("AdminUI.html");
const eduOpsUi = source("EduOps_ClientBatch.html");

const context = { safeStr_: (value) => String(value == null ? "" : value).trim() };
vm.createContext(context);
vm.runInContext(extractFunction(utils, "bulkCommunicationProhibitionAuthority_"), context);
vm.runInContext(extractFunction(utils, "bulkCommunicationProhibitionResult_"), context);

for (const [pathType, blockCode] of [
  ["STAGE_BATCH", "BATCH_SEND_PROHIBITED"],
  ["LEGACY", "LEGACY_BULK_PATH_RETIRED"],
  ["TRIGGER", "TRIGGER_BULK_PATH_PROHIBITED"]
]) {
  const result = context.bulkCommunicationProhibitionResult_("test_bulk_path", pathType);
  assert.equal(result.ok, false);
  assert.equal(result.result, "BLOCKED");
  assert.equal(result.blockCode, blockCode);
  assert.equal(result.gmailPathEntered, false);
  assert.equal(result.recipientsSent, 0);
}

for (const [file, name] of [
  [stage, "admin_sendStageBatch"],
  [selected, "admin_sendSelectedApplicantBatch"],
  [code, "runAutomatedStageBatchWithLock_"],
  [code, "campaign_sendLegacyBatch_"],
  [code, "campaign_sendLegacyFollowups_"]
]) {
  const body = extractFunction(file, name);
  assert.match(body, /bulkCommunicationProhibitionResult_/, `${name} must use the shared bulk prohibition`);
  assert.doesNotMatch(body, /sendApplicantMessage_\(/, `${name} must not retain a recipient send loop`);
}

const directSend = extractFunction(code, "sendApplicantMessage_");
assert.match(directSend, /Array\.isArray\(applicantId\)[\s\S]*INVALID_BULK_REQUEST/);
assert.ok(directSend.indexOf("INVALID_BULK_REQUEST") < directSend.indexOf("logManualSendProbe_"));

assert.match(extractFunction(admin, "admin_campaignSendLegacyBatch"), /bulkCommunicationProhibitionResult_[\s\S]*"LEGACY"/);
assert.match(extractFunction(admin, "admin_campaignSendLegacyFollowups"), /bulkCommunicationProhibitionResult_[\s\S]*"LEGACY"/);
assert.match(extractFunction(adminUi, "stageBatchExecutionAllowed_"), /return false/);
assert.match(extractFunction(adminUi, "batchCommCanSend_"), /return false/);

const adminUiSend = extractFunction(adminUi, "sendBatchCommunicationModal_");
assert.match(adminUiSend, /BATCH_SEND_PROHIBITED/);
assert.doesNotMatch(adminUiSend, /admin_sendStageBatch|admin_sendSelectedApplicantBatch/);
const eduOpsExecute = extractFunction(eduOpsUi, "execute");
assert.match(eduOpsExecute, /BATCH_SEND_PROHIBITED/);
assert.doesNotMatch(eduOpsExecute, /eduops_executeCommand/);

console.log("PASS R391H1 bulk paths fail closed before recipient delivery");
