const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");

function read(file) { return fs.readFileSync(file, "utf8"); }
function digest(value) { return Array.from(crypto.createHash("sha256").update(String(value), "utf8").digest()); }
function hmac(value, secret) { return Array.from(crypto.createHmac("sha256", String(secret)).update(String(value), "utf8").digest()); }
function baseContext() {
  return {
    Utilities: {
      DigestAlgorithm: { SHA_256: "SHA_256" },
      Charset: { UTF_8: "UTF_8" },
      computeDigest: (_a, value) => digest(value),
      computeHmacSha256Signature: (value, secret) => hmac(value, secret),
      getUuid: () => "fixture-uuid"
    },
    UrlFetchApp: { fetch() { throw new Error("LIVE_HTTP_FORBIDDEN"); } },
    Date, JSON, String, Number, Array, Object, Error, Math, console
  };
}

const context = baseContext();
vm.createContext(context);
vm.runInContext(read("CommunicationLedgerContract.js"), context);
vm.runInContext(read("CommunicationLedgerClient.js"), context);
assert.equal(context.FODE_COMMUNICATION_LEDGER_CONTRACT.contractVersion, "1.0");
assert.equal(context.fodeLedgerCanonicalSigningInput_("kid", "2026-07-31T00:00:00Z", "nonce", "post", "/commands", "hash"), "kid\n2026-07-31T00:00:00Z\nnonce\nPOST\n/commands\nhash");

let now = Date.parse("2026-07-31T00:00:00Z");
const requests = [];
const transportResults = [];
const client = new context.FodeCommunicationLedgerClient({
  endpoint: "https://ledger.example.test",
  keyId: "fixture-key-id",
  signingSecret: "fixture-secret",
  clock: () => now,
  nonceFactory: () => "fixture_nonce_1",
  operationFactory: () => "op_fixture_1",
  commandFactory: () => "cmd_fixture_1",
  maxAttempts: 2,
  transport: request => { requests.push(request); const next = transportResults.shift(); if (next instanceof Error) throw next; return next; }
});

function command(overrides) {
  return Object.assign({
    commandType: "SEND_INDIVIDUAL_COMMUNICATION",
    actor: "operator@example.test",
    authorityContext: { capability: "CAN_SEND_INDIVIDUAL" },
    operationId: "op_fixture_1",
    idempotencyKey: "idem_fixture_1",
    expectedState: "READY",
    applicantId: "FODE-26-003001",
    requestedAt: "2026-07-31T00:00:00Z",
    payload: { communicationId: "comm_fixture_1", messageType: "docs_missing", recipient: "applicant@example.test", subject: "Fixture", body: "Fixture body" }
  }, overrides || {});
}

function response(statusCode, body) { return { statusCode, body: JSON.stringify(Object.assign({ contractVersion: "1.0", operationId: "op_fixture_1" }, body)) }; }

transportResults.push(response(200, { commandId: "cmd_fixture_1", status: "AUTHORIZED", idempotent: false }));
const accepted = client.sendCommand(command());
assert.equal(accepted.ok, true);
assert.equal(accepted.status, "ACCEPTED");
assert.equal(accepted.operationId, "op_fixture_1");
assert.equal(requests[0].headers["X-Ledger-Contract-Version"], "1.0");
assert.match(requests[0].headers["X-Ledger-Signature"], /^[0-9a-f]{64}$/);
assert.equal(requests[0].payload.operationId, "op_fixture_1");
assert.equal(requests[0].payload.idempotencyKey, "idem_fixture_1");
assert.equal(requests[0].payload.contractVersion, "1.0");

transportResults.push(response(200, { commandId: "cmd_fixture_1", status: "AUTHORIZED", idempotent: true }));
const replay = client.sendCommand(command());
assert.equal(replay.status, "REPLAY");
assert.equal(replay.operationId, accepted.operationId);

transportResults.push(response(409, { error: "IDEMPOTENCY_CONFLICT" }));
assert.equal(client.sendCommand(command({ payload: Object.assign({}, command().payload, { body: "different" }) })).code, "IDEMPOTENCY_CONFLICT");

for (const fixture of [[400, "MALFORMED_REQUEST"], [400, "UNSUPPORTED_CONTRACT_VERSION"], [401, "INVALID_PAYLOAD_HASH"], [401, "INVALID_SIGNATURE"], [401, "EXPIRED_REQUEST"], [401, "FUTURE_CLOCK_VIOLATION"], [401, "UNKNOWN_SIGNING_KEY"], [401, "NONCE_REPLAY"]]) {
  transportResults.push(response(fixture[0], { error: fixture[1] }));
  assert.equal(client.sendCommand(command()).code, fixture[1]);
}

for (const errorCode of ["TRANSPORT_TIMEOUT", "SERVICE_UNAVAILABLE"]) {
  transportResults.push(Object.assign(new Error(errorCode), { code: errorCode }));
  transportResults.push(Object.assign(new Error(errorCode), { code: errorCode }));
  const uncertain = client.sendCommand(command({ operationId: "op_" + errorCode, idempotencyKey: "idem_" + errorCode }));
  assert.equal(uncertain.status, "DELIVERY_UNKNOWN");
  assert.equal(uncertain.uncertain, true);
  assert.equal(requests[requests.length - 1].payload.operationId, "op_" + errorCode);
  assert.equal(requests[requests.length - 2].payload.operationId, "op_" + errorCode);
}

const redacted = JSON.stringify(context.fodeLedgerRedact_({ operationId: "op_safe", nonce: "nonce_secret", signature: "signature_secret", body: "private body", status: "DELIVERY_UNKNOWN" }));
assert.match(redacted, /op_safe/);
assert.match(redacted, /DELIVERY_UNKNOWN/);
assert.doesNotMatch(redacted, /nonce_secret|signature_secret|private body/);
assert.doesNotMatch(read("CommunicationLedgerClient.js"), /fixture-secret|portal-secret|api_signing_secret/i);
assert.doesNotMatch(read("CommunicationLedgerContract.js"), /fixture-secret|portal-secret|api_signing_secret/i);
console.log("PASS R390C contract/client fixtures: accepted, replay, conflict, auth, malformed, retry, uncertainty, and redaction");
