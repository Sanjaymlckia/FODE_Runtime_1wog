# R391H1 Bulk-Path Fail-Closed Consolidation

Date: 2026-07-30
Track: H, HighRiskAuthority
Release: not authorized or performed

## Verdict

PASS - all known bulk execution paths now fail closed before recipient delivery.

Batch remains prohibited. Stage Batch is the only intended future bulk authority,
but it is not enabled by this change.

## Authority Model

```text
Batch preview surfaces
  -> canonical population-integrity gate
  -> diagnostics only

Any bulk execution entry point
  -> canonical population-integrity gate where applicable
  -> bulkCommunicationProhibitionResult_
  -> terminal BLOCKED result
  -> no recipient loop, Gmail adapter, Sheet/Drive/Zoho/Classroom mutation

Individual applicant send
  -> existing preview approval, capability, contactability, cooldown and idempotency gates
  -> existing guarded delivery adapter
```

The shared prohibition authority in `Utils.js` returns `ok: false`,
`result: "BLOCKED"`, `gmailPathEntered: false`, and `recipientsSent: 0`.

| Path type | Result code |
| --- | --- |
| Stage or selected Batch | `BATCH_SEND_PROHIBITED` |
| Legacy campaign Batch | `LEGACY_BULK_PATH_RETIRED` |
| Trigger or scheduled runner | `TRIGGER_BULK_PATH_PROHIBITED` |

## Consolidated Paths

| Entry point | Treatment |
| --- | --- |
| `admin_sendStageBatch` | Population-integrity check, then terminal Stage Batch prohibition. Former recipient loop removed. |
| `admin_sendSelectedApplicantBatch` | Population-integrity check within user lock, then terminal Stage Batch prohibition. Former recipient loop removed. |
| `campaign_sendLegacyBatch_` and `campaign_sendLegacyFollowups_` | Population-integrity check, then legacy-path retirement result. Former loops removed. |
| `runAutomatedStageBatchWithLock_` | Immediate trigger-path prohibition. Former lock/chunk execution removed. |
| Admin legacy wrappers | Directly return the shared legacy retirement result. |
| Direct individual adapter | Rejects array/cohort-shaped input with `INVALID_BULK_REQUEST`; scalar individual semantics are unchanged. |
| Admin and EduOps clients | Preview remains available; every Batch send control and handler is disabled or terminally blocked before RPC. |

No change was made to Finance authority, Student, Production, individual-send
payload identity, `PREVIEW_STALE`, idempotency, cooldown, contactability,
capability enforcement, or population-integrity policy.

## Future Authority Prerequisites

Stage Batch cannot be enabled until R390B2 provides a durable per-recipient
Communication Event Ledger with stable operation, preview, recipient, and
receipt identities; durable idempotency; safe interruption and resume; and a
single owner for bulk orchestration. Cache state remains diagnostic only.

## Validation

PASS:

- `node --check Utils.js Code.js Admin.js Admin_StageBatchCommunications.js Admin_SelectedApplicantCommunications.js`
- `node tests/r391h1-bulk-path-fail-closed.test.js`
- `node tests/r391b-population-integrity-fail-closed.test.js`
- `node tests/admin-role-boundary-matrix.test.js`
- `node tests/communication-send-gate-matrix.test.js`
- `git diff --check`

Playwright not required for this authority refactor. No Apps Script release
pipeline, `clasp push`, version, deployment repin, Gmail action, Batch send,
or live-system mutation was performed.
