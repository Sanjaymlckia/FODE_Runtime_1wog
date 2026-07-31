/**
 * R390C authenticated communication-ledger client.
 * The transport is injectable so all tests remain fixture-only.
 */
function FodeCommunicationLedgerClient(options) {
  options = options || {};
  this.endpoint_ = String(options.endpoint || "");
  this.keyId_ = String(options.keyId || "");
  this.signingSecret_ = String(options.signingSecret || "");
  this.contractVersion_ = String(options.contractVersion || FODE_COMMUNICATION_LEDGER_CONTRACT.contractVersion);
  this.maxAttempts_ = Math.max(1, Number(options.maxAttempts || 2));
  this.timeoutMs_ = Math.max(1, Number(options.timeoutMs || 15000));
  this.transport_ = options.transport || fodeLedgerDefaultTransport_;
  this.clock_ = options.clock || function () { return Date.now(); };
  this.nonceFactory_ = options.nonceFactory || fodeLedgerDefaultNonce_;
  this.operationFactory_ = options.operationFactory || fodeLedgerDefaultOperationId_;
  this.commandFactory_ = options.commandFactory || fodeLedgerDefaultCommandId_;
  if (!this.endpoint_ || !this.keyId_ || !this.signingSecret_) throw new Error("LEDGER_CLIENT_CONFIGURATION_REQUIRED");
}

FodeCommunicationLedgerClient.prototype.sendCommand = function (command, options) {
  var request = this.buildCommandRequest_(command, options);
  var attempts = 0;
  var last = null;
  while (attempts < this.maxAttempts_) {
    attempts += 1;
    try {
      var response = this.transport_(request);
      last = this.parseResponse_(response, request, attempts);
      if (!last.retryable || attempts >= this.maxAttempts_) return last;
    } catch (error) {
      last = this.uncertainResult_(request, attempts, error);
      if (!fodeLedgerIsTransportSafeError_(error) || attempts >= this.maxAttempts_) return last;
    }
  }
  return last || this.uncertainResult_(request, attempts, new Error("TRANSPORT_TIMEOUT"));
};

FodeCommunicationLedgerClient.prototype.buildCommandRequest_ = function (command, options) {
  command = command && typeof command === "object" ? command : {};
  options = options || {};
  var operationId = String(command.operationId || options.operationId || this.operationFactory_());
  var idempotencyKey = String(command.idempotencyKey || options.idempotencyKey || operationId);
  var body = {};
  Object.keys(command).forEach(function (key) { body[key] = command[key]; });
  body.contractVersion = this.contractVersion_;
  body.operationId = operationId;
  body.idempotencyKey = idempotencyKey;
  body.commandId = String(body.commandId || this.commandFactory_());
  body.requestedAt = String(body.requestedAt || fodeLedgerTimestamp_(this.clock_()));
  var encoded = fodeLedgerCanonicalJson_(body);
  var timestamp = fodeLedgerTimestamp_(this.clock_());
  var nonce = String(this.nonceFactory_());
  var bodySha256 = fodeLedgerSha256Hex_(encoded);
  var signingInput = fodeLedgerCanonicalSigningInput_(this.keyId_, timestamp, nonce, "POST", FODE_COMMUNICATION_LEDGER_CONTRACT.commandRoute, bodySha256);
  return {
    method: "POST",
    path: FODE_COMMUNICATION_LEDGER_CONTRACT.commandRoute,
    url: this.endpoint_ + FODE_COMMUNICATION_LEDGER_CONTRACT.commandRoute,
    body: encoded,
    payload: body,
    operationId: operationId,
    idempotencyKey: idempotencyKey,
    timeoutMs: this.timeoutMs_,
    headers: {
      "Content-Type": "application/json",
      "X-Ledger-Contract-Version": this.contractVersion_,
      "X-Ledger-Key-Id": this.keyId_,
      "X-Ledger-Timestamp": timestamp,
      "X-Ledger-Nonce": nonce,
      "X-Ledger-Body-SHA256": bodySha256,
      "X-Ledger-Operation-Id": operationId,
      "X-Ledger-Idempotency-Key": idempotencyKey,
      "X-Ledger-Signature": fodeLedgerHmacHex_(signingInput, this.signingSecret_)
    }
  };
};

FodeCommunicationLedgerClient.prototype.parseResponse_ = function (response, request, attempts) {
  response = response || {};
  var statusCode = Number(response.statusCode || response.status || 0);
  var raw = String(response.body || "");
  var parsed;
  try { parsed = JSON.parse(raw); } catch (_error) { return this.malformedResponse_(request, attempts, statusCode); }
  if (!parsed || typeof parsed !== "object" || parsed.contractVersion !== request.payload.contractVersion) {
    return this.malformedResponse_(request, attempts, statusCode);
  }
  if (statusCode === 200) {
    if (String(parsed.operationId || "") !== request.operationId) return this.malformedResponse_(request, attempts, statusCode);
    return {
      ok: true,
      status: parsed.idempotent === true ? "REPLAY" : "ACCEPTED",
      code: parsed.idempotent === true ? "REPLAY" : "ACCEPTED",
      operationId: request.operationId,
      idempotencyKey: request.idempotencyKey,
      response: parsed,
      attempts: attempts,
      retryable: false,
      diagnostics: fodeLedgerRedact_({ operationId: request.operationId, statusCode: statusCode, attempts: attempts, status: parsed.idempotent === true ? "REPLAY" : "ACCEPTED" })
    };
  }
  var code = String(parsed.error || "SERVICE_UNAVAILABLE");
  if (statusCode === 400) code = code === "UNSUPPORTED_CONTRACT_VERSION" ? code : "MALFORMED_REQUEST";
  if (statusCode === 401) code = code || "REQUEST_REJECTED";
  if (statusCode === 409) code = "IDEMPOTENCY_CONFLICT";
  var retryable = FODE_COMMUNICATION_LEDGER_CONTRACT.retryableStatusCodes.indexOf(statusCode) >= 0;
  return {
    ok: false,
    status: retryable ? "DELIVERY_UNKNOWN" : "REJECTED",
    code: code,
    operationId: request.operationId,
    idempotencyKey: request.idempotencyKey,
    attempts: attempts,
    uncertain: retryable,
    retryable: retryable,
    diagnostics: fodeLedgerRedact_({ operationId: request.operationId, statusCode: statusCode, attempts: attempts, code: code, uncertain: retryable })
  };
};

FodeCommunicationLedgerClient.prototype.malformedResponse_ = function (request, attempts, statusCode) {
  return { ok: false, status: "REJECTED", code: "MALFORMED_SERVICE_RESPONSE", operationId: request.operationId, idempotencyKey: request.idempotencyKey, attempts: attempts, uncertain: false, retryable: false, diagnostics: { operationId: request.operationId, statusCode: statusCode, attempts: attempts, code: "MALFORMED_SERVICE_RESPONSE" } };
};

FodeCommunicationLedgerClient.prototype.uncertainResult_ = function (request, attempts, error) {
  var code = String(error && error.code || error && error.message || "TRANSPORT_TIMEOUT");
  if (!/TIMEOUT|timed.?out|SERVICE_UNAVAILABLE|NETWORK|FETCH/i.test(code)) code = "SERVICE_UNAVAILABLE";
  return { ok: false, status: "DELIVERY_UNKNOWN", code: code === "SERVICE_UNAVAILABLE" ? code : "TRANSPORT_TIMEOUT", operationId: request.operationId, idempotencyKey: request.idempotencyKey, attempts: attempts, uncertain: true, retryable: true, diagnostics: fodeLedgerRedact_({ operationId: request.operationId, attempts: attempts, code: code, uncertain: true }) };
};

function fodeLedgerDefaultTransport_(request) {
  var response = UrlFetchApp.fetch(request.url, { method: request.method.toLowerCase(), contentType: "application/json", payload: request.body, headers: request.headers, muteHttpExceptions: true });
  return { statusCode: response.getResponseCode(), body: response.getContentText() };
}

function fodeLedgerDefaultNonce_() { return "nonce_" + String(Utilities.getUuid()).replace(/[^A-Za-z0-9_-]/g, ""); }
function fodeLedgerDefaultOperationId_() { return "op_" + String(Utilities.getUuid()).replace(/[^A-Za-z0-9_-]/g, ""); }
function fodeLedgerDefaultCommandId_() { return "cmd_" + String(Utilities.getUuid()).replace(/[^A-Za-z0-9_-]/g, ""); }
function fodeLedgerTimestamp_(milliseconds) { return new Date(Number(milliseconds)).toISOString().replace(/\.\d{3}Z$/, "Z"); }
function fodeLedgerBytesToHex_(bytes) { return Array.prototype.map.call(bytes || [], function (value) { var n = Number(value); if (n < 0) n += 256; return ("0" + n.toString(16)).slice(-2); }).join(""); }
function fodeLedgerSha256Hex_(value) { return fodeLedgerBytesToHex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(value), Utilities.Charset.UTF_8)); }
function fodeLedgerHmacHex_(value, secret) { return fodeLedgerBytesToHex_(Utilities.computeHmacSha256Signature(String(value), String(secret))); }
function fodeLedgerIsTransportSafeError_(error) { return /TIMEOUT|timed.?out|NETWORK|FETCH|SERVICE_UNAVAILABLE/i.test(String(error && (error.code || error.message) || error)); }
