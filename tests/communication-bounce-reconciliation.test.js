const assert = require("node:assert/strict");
const fs = require("node:fs");
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

const context = {
  clean_: (value) => String(value == null ? "" : value).trim(),
  parseTime_: (value) => {
    const ts = Date.parse(value || "");
    return Number.isFinite(ts) ? ts : 0;
  },
  normalizeEmailStatus_: (value) => String(value || "").trim().toUpperCase(),
  isCampaignBounceFlagTrue_: (value) => /^(YES|TRUE|1|BOUNCED)$/i.test(String(value || "").trim()),
  computeNextActionDate_: () => "2026-07-06"
};

vm.createContext(context);
vm.runInContext([
  "campaignExtractBounceEmails_",
  "campaignExtractBounceReason_",
  "campaignExtractApplicantIds_",
  "campaignIsBounceMessage_",
  "collectBounceLookupMatches_",
  "normalizeBounceApplicantId_",
  "resolveBounceApplicantMatch_",
  "normalizeBounceClassification_",
  "normalizeBounceReason_",
  "classifyBounceResult_",
  "extractBounceSmtpStatus_",
  "normalizeDeliveryHealth_",
  "normalizeBounceFailureType_",
  "buildBounceReconciliationKey_",
  "buildGmailBounceCandidate_",
  "buildBounceStatePatch_",
  "applyBounceStateToRow_"
].map((name) => extractFunction(codeSource, name)).join("\n\n"), context);

function gmailMessage({ id = "msg-1", date = "2026-07-05T01:00:00.000Z" } = {}) {
  return {
    getId: () => id,
    getDate: () => new Date(date),
    getThread: () => ({ getId: () => `thread-${id}` })
  };
}

const hardBody = [
  "Delivery Status Notification (Failure)",
  "The response was:",
  "550 5.1.1 Address not found",
  "Final-Recipient: rfc822; bad.parent@example.com"
].join("\n");
const hardBounce = context.classifyBounceResult_("Delivery Status Notification (Failure)", hardBody, "");
assert.equal(hardBounce.classification, "INVALID", "550 address-not-found must classify as a permanent invalid bounce");
const hardCandidate = context.buildGmailBounceCandidate_(gmailMessage(), "Delivery Status Notification (Failure)", hardBody, hardBounce.classification, hardBounce.reason);
assert.equal(hardCandidate.failedRecipient, "bad.parent@example.com", "Gmail adapter must extract failed recipient");
assert.equal(hardCandidate.deliveryHealth, "Permanent Failure", "Permanent bounces must normalize to operator delivery health");
assert.match(hardCandidate.smtpStatus, /^550/, "Gmail adapter must extract SMTP status code");
assert.equal(hardCandidate.failureType, "PERMANENT_FAILURE", "Gmail adapter must expose normalized permanent failure type");
assert.match(hardCandidate.reconciliationKey, /^gmail-bouncemail-v1::msg-1::bad\.parent@example\.com$/, "Reconciliation key must be provider/message/recipient scoped");

const temporaryBody = [
  "Delivery Status Notification",
  "Diagnostic-Code: smtp; 452 4.2.2 Mailbox full",
  "Final-Recipient: rfc822; full@example.com"
].join("\n");
const temporaryBounce = context.classifyBounceResult_("Temporary delivery failure", temporaryBody, "");
const temporaryCandidate = context.buildGmailBounceCandidate_(gmailMessage({ id: "msg-2" }), "Temporary delivery failure", temporaryBody, temporaryBounce.classification, temporaryBounce.reason);
assert.equal(temporaryBounce.classification, "TEMPORARY", "452 mailbox full must classify as temporary");
assert.equal(temporaryCandidate.deliveryHealth, "Temporary Failure", "Temporary bounces must normalize to operator delivery health");

const lookup = {
  corrected: {
    "bad.parent@example.com": [{ rowNumber: 12, row: { ApplicantID: "FODE-001", Parent_Email_Corrected: "bad.parent@example.com" } }]
  },
  raw: {},
  crm: {},
  applicantId: {
    "FODE-777": [{ rowNumber: 77, row: { ApplicantID: "FODE-777", Parent_Email_Corrected: "other@example.com" } }]
  }
};
const emailMatch = context.resolveBounceApplicantMatch_(lookup, ["bad.parent@example.com"], []);
assert.equal(emailMatch.status, "MATCHED_UNIQUE", "Exact applicant email must match deterministically");
assert.equal(emailMatch.rowNumber, 12, "Exact applicant email must return the matched applicant row");
const idMatch = context.resolveBounceApplicantMatch_(lookup, [], ["FODE-777"]);
assert.equal(idMatch.status, "MATCHED_UNIQUE", "Applicant ID evidence must be preferred when present");
assert.equal(idMatch.matchType, "APPLICANT_ID", "Applicant ID matching must be explicit");

const ambiguous = context.resolveBounceApplicantMatch_({
  corrected: {
    "shared@example.com": [
      { rowNumber: 2, row: { ApplicantID: "FODE-002" } },
      { rowNumber: 3, row: { ApplicantID: "FODE-003" } }
    ]
  },
  raw: {},
  crm: {},
  applicantId: {}
}, ["shared@example.com"], []);
assert.equal(ambiguous.status, "MATCH_AMBIGUOUS", "Duplicate email matches must remain unreconciled");
assert.equal(ambiguous.row, null, "Ambiguous matches must not pick a row");

const patch = context.buildBounceStatePatch_({}, hardCandidate.classification, hardCandidate.diagnosticReason, hardCandidate);
assert.equal(patch.Delivery_Health, "Permanent Failure", "Patch must write delivery health");
assert.equal(patch.Last_Delivery_Status, "Permanent Failure", "Patch must write last delivery status");
assert.equal(patch.Last_Bounce_Date, "2026-07-05T01:00:00.000Z", "Patch must write last bounce date");
assert.equal(patch.Delivery_Reconciliation_Source, "gmail-bouncemail-v1", "Patch must record adapter source");
assert.equal(patch.Email_Status, "BOUNCED", "Permanent bounce must keep existing suppression behaviour");
const repeatPatch = context.buildBounceStatePatch_({ Delivery_Reconciliation_Key: hardCandidate.reconciliationKey }, hardCandidate.classification, hardCandidate.diagnosticReason, hardCandidate);
assert.equal(Object.keys(repeatPatch).length, 0, "Same reconciliation key must be idempotent");
const newerDeliveredPatch = context.buildBounceStatePatch_({
  Email_Last_Sent_At: "2026-07-05T02:00:00.000Z",
  Last_Contact_Result: "DELIVERED"
}, hardCandidate.classification, hardCandidate.diagnosticReason, hardCandidate);
assert.equal(Object.keys(newerDeliveredPatch).length, 0, "Older bounce must not overwrite a newer delivered runtime state");

[
  "Last_Delivery_Status",
  "Last_Bounce_Date",
  "Bounce_Reason",
  "Delivery_Health",
  "Delivery_Reconciliation_Key",
  "Delivery_Reconciliation_Source"
].forEach((field) => {
  assert.match(configSource, new RegExp(`"${field}"`), `${field} must be an explicit runtime field`);
  assert.match(adminSource, new RegExp(`${field}: idx\\.${field}`), `${field} must be exposed through applicant detail DTOs`);
});

assert.match(adminSource, /deliveryHealth:\s*\{[\s\S]*available:\s*false/, "Communications Activity must gate delivery-health metrics on runtime evidence");
assert.match(adminSource, /Delivery_Health[\s\S]*Last_Delivery_Status[\s\S]*Last_Bounce_Date/, "Communications Activity must use reconciled runtime delivery fields");
assert.doesNotMatch(adminSource, /GmailApp\.search[\s\S]*communicationsActivity/, "Admin dashboard metrics must not query Gmail directly");
assert.match(adminUiSource, /Delivery Health[\s\S]*id="mHeaderDeliveryHealth"/, "Review Workspace must expose delivery health in the applicant identity header");
assert.match(adminUiSource, /delivery\.available === true/, "Communications Activity must display bounce metrics only from reconciled runtime evidence");

console.log("PASS bounce reconciliation parses Gmail delivery failures");
console.log("PASS bounce reconciliation matches only deterministic applicant evidence");
console.log("PASS bounce reconciliation is idempotent and preserves newer delivered state");
console.log("PASS delivery-health UI and metrics consume reconciled runtime fields only");
