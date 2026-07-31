# R390B2 — Durable Communication Event Ledger

Source design completed under the isolated `services/communication-ledger/` boundary. The package provides InnoDB/utf8mb4 migrations; append-only event storage; durable commands, previews, operations, and receipts; signed request verification; nonce replay protection; deterministic idempotency; and secret-safe logging. No Apps Script or live hosting/database action is included.

## Gate 2 staging evidence — 2026-07-31

- Deployed to `https://ledger-staging.kiafode.com` at `/home/kundghlt/ledger-staging.kiafode.com`; TLS is active and PHP reports 8.1.34.
- Protected configuration is outside the document root at `/home/kundghlt/communication-ledger-config.php` (0600). The configuration values and secrets were not captured in this audit.
- `GET /health` returned 200 with `serviceVersion: 0.1.0-r390b4`, connected database status, and `schemaVersion: 002_nonce_cleanup_event_dedup`; `/version` and `/schema` also returned 200.
- Ordered migrations `001_initial_schema` and `002_nonce_cleanup_event_dedup` were applied to `kundghlt_commledger_stg`. Structural inspection found 10 ledger tables, all InnoDB and `utf8mb4_unicode_ci`, with 13 foreign keys, 22 unique indexes, and 23 secondary indexes.
- PDO connectivity was proven by a temporary protected diagnostic (`PDO_OK`), which was removed. Public root and source access were checked: unauthenticated root returned 401 and `/src/Config/Config.php` returned 403.
- The root autoloader path defect exposed by the flattened cPanel deployment was corrected in the source package and redeployed. A temporary signed-test endpoint was removed after validation and its URL now returns the normal 401 `REQUEST_REJECTED` response.

### Outstanding Gate 2 proof

Full PHP 8.1 lint across every deployed file, migration-rerun proof, all required negative HMAC cases, durable ledger record variants, logging/redaction inspection, failure/recovery exercises, and backup/restore verification remain unrecorded. No claim of complete Gate 2 validation is made here.
