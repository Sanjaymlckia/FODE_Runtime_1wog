# R390C Apps Script ↔ PHP contract

Contract version: `1.0`.

This contract is fixture-tested and has no live endpoint or credential embedded in source. The command route is `POST /commands`. The body is UTF-8 JSON with recursively sorted object keys; arrays retain order. The request must include `contractVersion`, `commandId`, `commandType`, `actor`, `authorityContext`, `operationId`, `idempotencyKey`, `expectedState`, `requestedAt`, `payload`, and either `applicantId` or `cohortId`.

Authentication uses these headers:

| Header | Meaning |
| --- | --- |
| `X-Ledger-Contract-Version` | `1.0` |
| `X-Ledger-Key-Id` | non-secret signing-key identifier |
| `X-Ledger-Timestamp` | UTC `YYYY-MM-DDTHH:mm:ssZ` |
| `X-Ledger-Nonce` | unique per request; retained for 900 seconds |
| `X-Ledger-Body-SHA256` | lowercase SHA-256 of the exact UTF-8 body |
| `X-Ledger-Operation-Id` | stable operation correlation identifier |
| `X-Ledger-Idempotency-Key` | stable replay identity |
| `X-Ledger-Signature` | lowercase HMAC-SHA256 |

The signing input is six newline-separated fields:

```text
keyId
timestamp
nonce
METHOD
path
bodySha256
```

The service permits five minutes of clock skew. A nonce is single-use. The client generates one operation ID and retains it across every retry. A retry is permitted only for transport timeout/network failure or HTTP 408, 429, 500, 502, 503, or 504. Attempts are bounded; the default is two. Exhausted transport-safe failures return `DELIVERY_UNKNOWN` with `uncertain: true`; the client never infers delivery from a timeout and never silently retries an external delivery.

For one operation identity, an identical canonical payload returns the original result with `idempotent: true` and is exposed as `REPLAY`. A different payload returns `IDEMPOTENCY_CONFLICT`. A first accepted command returns `ACCEPTED`. Invalid input/authentication returns a rejected response. Every response includes `contractVersion` and `operationId` when the service has accepted a command identity.

The error taxonomy is: `MALFORMED_REQUEST`, `UNSUPPORTED_CONTRACT_VERSION`, `UNKNOWN_SIGNING_KEY`, `INVALID_PAYLOAD_HASH`, `INVALID_SIGNATURE`, `EXPIRED_REQUEST`, `FUTURE_CLOCK_VIOLATION`, `NONCE_REPLAY`, `IDEMPOTENCY_CONFLICT`, `TRANSPORT_TIMEOUT`, `SERVICE_UNAVAILABLE`, and `MALFORMED_SERVICE_RESPONSE`. Authentication detail remains generic at the public service boundary where disclosure would aid probing.

Diagnostics retain only contract version, operation ID, status, safe error code, HTTP status, attempt count, and uncertainty. Signing secrets, authorization values, complete signatures, protected configuration, portal secrets, request bodies, and nonces are redacted or omitted.
