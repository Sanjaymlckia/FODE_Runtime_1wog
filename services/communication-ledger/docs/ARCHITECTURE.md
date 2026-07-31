# Architecture and operational contract

`public/index.php` is the sole public entry point. It loads protected configuration from outside the document root, opens PDO with native parameter binding, and routes only `/health`, `/version`, `/schema`, and signed `/commands`. Public status endpoints disclose only availability, environment, version, schema version, database state, and UTC time.

The canonical signature is six newline-separated fields: key ID, UTC timestamp (`YYYY-MM-DDTHH:MM:SSZ`), nonce, upper-case method, request path, and lower-case SHA-256 body hash. The signature is a lower-case HMAC-SHA256 hex digest of that exact string. Key ID and HMAC use constant-time comparison. Accepted `(key_id, nonce)` values are inserted under a unique key before command dispatch; skew and TTL are configuration-controlled.

Commands are transacted by `commands.command_id` and durable `idempotency_key`. A matching fingerprint returns its original result; a different fingerprint fails closed. The operation, communication, command, and `OPERATION_AUTHORIZED` event are committed atomically. There is no provider invocation here, so uncertainty never triggers a resend.

Communications, previews, operations, receipts, and events use immutable IDs. Events append only; a bounce does not alter a send event, an open is not a read, and a read is not an action completion. Provider identifiers remain nullable. Batch storage is prepared through immutable cohorts and per-recipient records, but no route invokes batch execution.

Logs are JSON-lines with correlation/command/operation/cohort/route/result/duration/error-classification fields. Logger removes secrets, passwords, authorization, raw nonces, and bodies before write.
