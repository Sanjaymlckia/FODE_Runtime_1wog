const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");

function read(file) { return fs.readFileSync(file, "utf8"); }
function digest(value) { return Array.from(crypto.createHash("sha256").update(String(value), "utf8").digest()); }
function hmac(value, secret) { return Array.from(crypto.createHmac("sha256", String(secret)).update(String(value), "utf8").digest()); }
const context = {
  Utilities: {
    DigestAlgorithm: { SHA_256: "SHA_256" }, Charset: { UTF_8: "UTF_8" },
    computeDigest: (_a, value) => digest(value), computeHmacSha256Signature: (value, secret) => hmac(value, secret),
    getUuid: () => "fixture-uuid", formatDate: () => "31 Jul 2026, 12:00 AM"
  },
  Session: { getScriptTimeZone: () => "GMT" },
  UrlFetchApp: { fetch() { throw new Error("LIVE_HTTP_FORBIDDEN"); } },
  Date, JSON, String, Number, Array, Object, Error, Math, console
};
vm.createContext(context);
vm.runInContext(read("CommunicationLedgerContract.js"), context);
vm.runInContext(read("CommunicationLedgerClient.js"), context);
vm.runInContext(read("CommunicationLedgerShadow.js"), context);

const preview = {
  identity: { operationId: "op_shadow_001", previewId: "preview_shadow_001", receiptId: "receipt_shadow_001", idempotencyKey: "idem_shadow_001" },
  applicantId: "FODE-26-003001", recipient: "applicant@example.test", subject: "Fixture subject",
  body: "Fixture body https://portal.example.test/token/never-send", templateId: "docs_missing", templateVersionId: "v1",
  createdAt: "2026-07-31T00:00:00.000Z"
};
function legacy(result, extra) { return Object.assign({ operationId: "op_shadow_001", previewId: "preview_shadow_001", receiptId: "receipt_shadow_001", applicantId: "FODE-26-003001", result, gmailAccepted: result === "SENT", gmailAttempted: result === "SENT", rowPatchConfirmed: result === "SENT", communicationRecorded: result === "SENT" }, extra || {}); }
function clientResult(status, response, extra) { return Object.assign({ status, response, attempts: 1 }, extra || {}); }
function run(legacyResult, result, options) { return context.fodeLedgerShadowRecord_(legacyResult, preview, Object.assign({ config: { enabled: true, endpoint: "https://ledger.example.test", keyId: "fixture-key", signingSecret: "fixture-secret" }, client: { sendCommand: () => result }, nowMs: Date.parse("2026-07-31T00:00:00Z"), pngTimestamp: "31 Jul 2026, 12:00 AM" }, options || {})); }

assert.equal(run(legacy("BLOCKED", { gmailAccepted: false }), clientResult("ACCEPTED", { operationId: "op_shadow_001", applicantId: "FODE-26-003001", previewId: "preview_shadow_001", receiptId: "receipt_shadow_001", channel: "EMAIL", legacyOutcome: "BLOCKED", technicalTimestamp: "2026-07-31T00:00:00Z" })).shadowState, "shadow_reconciled");
assert.equal(run(legacy("SENT"), clientResult("REPLAY", { operationId: "op_shadow_001", applicantId: "FODE-26-003001", previewId: "preview_shadow_001", receiptId: "receipt_shadow_001", channel: "EMAIL", legacyOutcome: "SENT", technicalTimestamp: "2026-07-31T00:00:00Z" })).shadowState, "shadow_replayed");
assert.equal(run(legacy("SENT"), clientResult("REJECTED", null, { code: "IDEMPOTENCY_CONFLICT" })).shadowState, "shadow_conflict");
assert.equal(run(legacy("SENT"), clientResult("DELIVERY_UNKNOWN", null, { uncertain: true, code: "TRANSPORT_TIMEOUT" })).shadowState, "shadow_delivery_unknown");
assert.equal(run(legacy("SENT"), clientResult("REJECTED", null, { code: "SERVICE_UNAVAILABLE" })).shadowState, "shadow_failed");
assert.equal(run(legacy("SENT"), clientResult("ACCEPTED", { operationId: "wrong", applicantId: "FODE-26-003001", previewId: "preview_shadow_001", receiptId: "receipt_shadow_001", channel: "EMAIL", legacyOutcome: "SENT", technicalTimestamp: "2026-07-31T00:00:00Z" })).shadowState, "shadow_reconciliation_required");
assert.equal(context.fodeLedgerShadowRecord_(legacy("BLOCKED", { gmailAccepted: false }), preview, { config: { enabled: false }, nowMs: 0 }).shadowState, "shadow_pending");
assert.equal(context.fodeLedgerShadowRecord_({}, preview, { config: { enabled: true }, nowMs: 0 }).shadowState, "shadow_failed");
assert.equal(context.fodeLedgerShadowRecord_(legacy("SENT"), {}, { config: { enabled: true }, nowMs: 0 }).shadowState, "shadow_failed");

let calls = 0;
const stable = run(legacy("SENT"), clientResult("ACCEPTED", { operationId: "op_shadow_001", applicantId: "FODE-26-003001", previewId: "preview_shadow_001", receiptId: "receipt_shadow_001", channel: "EMAIL", legacyOutcome: "SENT", technicalTimestamp: "2026-07-31T00:00:00Z" }), { client: { sendCommand: request => { calls++; assert.equal(request.operationId, "op_shadow_001"); assert.equal(request.commandId, "shadow_cmd_op_shadow_001"); return clientResult(calls === 1 ? "ACCEPTED" : "REPLAY", { operationId: "op_shadow_001", applicantId: "FODE-26-003001", previewId: "preview_shadow_001", receiptId: "receipt_shadow_001", channel: "EMAIL", legacyOutcome: "SENT", technicalTimestamp: "2026-07-31T00:00:00Z" }); } } });
const replay = run(legacy("SENT"), clientResult("REPLAY", { operationId: "op_shadow_001", applicantId: "FODE-26-003001", previewId: "preview_shadow_001", receiptId: "receipt_shadow_001", channel: "EMAIL", legacyOutcome: "SENT", technicalTimestamp: "2026-07-31T00:00:00Z" }), { client: { sendCommand: request => { calls++; assert.equal(request.operationId, "op_shadow_001"); return clientResult("REPLAY", { operationId: "op_shadow_001", applicantId: "FODE-26-003001", previewId: "preview_shadow_001", receiptId: "receipt_shadow_001", channel: "EMAIL", legacyOutcome: "SENT", technicalTimestamp: "2026-07-31T00:00:00Z" }); } } });
assert.equal(stable.shadowState, "shadow_reconciled"); assert.equal(replay.shadowState, "shadow_replayed"); assert.equal(calls, 2);
const stableTimestampA = run(legacy("SENT"), clientResult("ACCEPTED", { operationId: "op_shadow_001", applicantId: "FODE-26-003001", previewId: "preview_shadow_001", receiptId: "receipt_shadow_001", channel: "EMAIL", legacyOutcome: "SENT", technicalTimestamp: "2026-07-31T00:00:00Z" }), { nowMs: Date.parse("2026-07-31T00:01:00Z") });
const stableTimestampB = run(legacy("SENT"), clientResult("ACCEPTED", { operationId: "op_shadow_001", applicantId: "FODE-26-003001", previewId: "preview_shadow_001", receiptId: "receipt_shadow_001", channel: "EMAIL", legacyOutcome: "SENT", technicalTimestamp: "2026-07-31T00:00:00Z" }), { nowMs: Date.parse("2026-07-31T00:02:00Z") });
assert.equal(stableTimestampA.reconciliationRequired, false);
assert.equal(stableTimestampB.reconciliationRequired, false);
assert.equal(JSON.stringify(stable).includes("portal.example.test"), false);
assert.equal(JSON.stringify(stable).includes("fixture-secret"), false);
assert.match(read("CommunicationLedgerShadow.js"), /externalDeliveryInvoked: false/);
assert.doesNotMatch(read("CommunicationLedgerShadow.js"), /portal-secret|fixture-secret|COMMUNICATION_LEDGER_SHADOW_SIGNING_SECRET\s*:\s*['\"]/i);
assert.doesNotMatch(read("Admin_SelectedApplicantCommunications.js"), /fodeLedgerShadowRecord_\(sendResult/);
assert.doesNotMatch(read("Admin_SelectedApplicantCommunications.js"), /sendApplicantMessage_\([^\n]*shadow/);
console.log("PASS R390D shadow fixtures: suppressed, rejected, accepted, replay, conflict, timeout, unavailable, malformed reconciliation, stable identity, no duplicate shadow call, and redaction");
