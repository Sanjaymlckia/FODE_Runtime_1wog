/**
 * R390C frozen Apps Script <-> communication-ledger contract.
 * This file contains no endpoint, credential, or Script Property value.
 */
var FODE_COMMUNICATION_LEDGER_CONTRACT = {
  contractVersion: "1.0",
  method: "POST",
  commandRoute: "/commands",
  timestampFormat: "YYYY-MM-DDTHH:mm:ssZ",
  clockSkewSeconds: 300,
  nonceTtlSeconds: 900,
  hmacAlgorithm: "HMAC-SHA256",
  canonicalFields: ["keyId", "timestamp", "nonce", "method", "path", "bodySha256"],
  errorCodes: {
    MALFORMED_REQUEST: "MALFORMED_REQUEST",
    UNSUPPORTED_CONTRACT_VERSION: "UNSUPPORTED_CONTRACT_VERSION",
    UNKNOWN_SIGNING_KEY: "UNKNOWN_SIGNING_KEY",
    INVALID_PAYLOAD_HASH: "INVALID_PAYLOAD_HASH",
    INVALID_SIGNATURE: "INVALID_SIGNATURE",
    EXPIRED_REQUEST: "EXPIRED_REQUEST",
    FUTURE_CLOCK_VIOLATION: "FUTURE_CLOCK_VIOLATION",
    NONCE_REPLAY: "NONCE_REPLAY",
    IDEMPOTENCY_CONFLICT: "IDEMPOTENCY_CONFLICT",
    TRANSPORT_TIMEOUT: "TRANSPORT_TIMEOUT",
    SERVICE_UNAVAILABLE: "SERVICE_UNAVAILABLE",
    MALFORMED_SERVICE_RESPONSE: "MALFORMED_SERVICE_RESPONSE"
  },
  retryableStatusCodes: [408, 429, 500, 502, 503, 504]
};

function fodeLedgerCanonicalJson_(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "[" + value.map(fodeLedgerCanonicalJson_).join(",") + "]";
  if (typeof value === "object") {
    return "{" + Object.keys(value).sort().map(function (key) {
      return JSON.stringify(key) + ":" + fodeLedgerCanonicalJson_(value[key]);
    }).join(",") + "}";
  }
  return JSON.stringify(value);
}

function fodeLedgerCanonicalSigningInput_(keyId, timestamp, nonce, method, path, bodySha256) {
  return [keyId, timestamp, nonce, String(method || "").toUpperCase(), path, bodySha256].join("\n");
}

function fodeLedgerRedact_(value) {
  if (Array.isArray(value)) return value.map(fodeLedgerRedact_);
  if (!value || typeof value !== "object") return value;
  var out = {};
  Object.keys(value).forEach(function (key) {
    if (/secret|password|authorization|signature|nonce|body|token|private.?key|portal/i.test(key)) {
      out[key] = "[REDACTED]";
    } else {
      out[key] = fodeLedgerRedact_(value[key]);
    }
  });
  return out;
}
