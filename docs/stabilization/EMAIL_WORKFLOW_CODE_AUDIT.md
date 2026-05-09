# S2C Email Workflow Code Audit

Date: 2026-05-09
Scope: Read-only audit of send paths, preview/send relationships, bounce handling, and replay/dedupe behavior

## Summary

- Current email workflow is manual-first in several places, but live send code still exists
- Preview-before-send gating is strongest in stage batch flows and applicant message flows
- Replay/dedupe protections are mixed: some use cache/idempotency, some rely on durable row status, some use sent keys
- Bounce and failure semantics are explicit but still spread across multiple fields and code families

## Current Send Paths

| File | Function | Approx line | Send mechanism | Notes |
| --- | --- | ---: | --- | --- |
| `Code.js` | `sendEmailBestEffort_` | 4252 | `MailApp.sendEmail` | Generic best-effort sender |
| `Code.js` | campaign Gmail send block | 6105-6119 | `GmailApp.sendEmail` | Uses configured alias and reply-to |
| `Utils.js` | payment verified workflow mail sends | 1809, 1825 | `MailApp.sendEmail` | Student and admin release notices |
| `Utils.js` | provider-based sender | 1905, 1915 | `MailApp.sendEmail` / `GmailApp.sendEmail` | General provider abstraction |
| `Admin.js` | `sendQuoteEmail_` / `sendPaymentEmail_` / payment verified email helpers | 1139+, 1199+, 1560+ | via admin email helpers | Manual/admin workflows |

## Preview / Send Relationship

### Applicant message workflow

- `AdminUI.html:1329-1355` requires preview before send in the operator UI
- `Admin.js:4806` exposes `admin_previewApplicantMessage`
- send path checks preview readiness and explicit confirmation semantics

### Stage batch workflow

- `AdminUI.html:1850-1868` disables send until preview is ready
- `Admin.js:4218` provides `admin_previewStageBatch`
- `Admin.js:4481` provides `admin_sendStageBatch`
- `Admin.js:4536-4647` enforces preview snapshot parity:
  - preview request id match
  - candidate count / ids / hash checks
  - stale preview rejection
  - changed preview retry requirement

This is currently the strongest replay guard in the codebase.

## Dedupe / Replay Weaknesses

### Stronger protections

- stage batch preview cache and parity decision checks (`Admin.js:4536-4647`)
- communication cooldown cache (`Code.js:6144+`, `Utils.js:1388+`)
- payment verified sent keys (`Admin.js:1648-1653`, `Utils.js:1763-1847`)

### Weaker or mixed protections

- durable row semantics still depend on `Email_Status`, `Last_Contact_*`, and cooldown cache rather than a single ledger
- some send blockers rely on field state like `SENT` / `FAILED`, which can drift from preview cache assumptions
- Gmail alias visibility is best-effort logged, but alias lookup failure does not itself guarantee uniform prevention across all send families

## Bounce / Failure Handling

| Area | Approx lines | Notes |
| --- | ---: | --- |
| UI bounce warnings | `AdminUI.html:1124-1125`, `3886-3918` | Operator-facing suppression/bounce visibility |
| communication state derivation | `Code.js:6277-6326` | Uses `Email_Status`, bounce flag, next action date, prior contact metadata |
| bounce ingestion path | `Code.js:8731-8819` | Reads Gmail bounce messages and patches row state |
| failed-send exclusion | `Admin.js:3750+`, `AdminUI.html:1803-1814` | Stage batch preview/send excludes prior `FAILED` or `SENT` rows under conditions |

## Manual-First Queue Recommendation

- Keep preview-required manual operation as the default for all send paths
- Prefer applicant-level preview and stage-batch preview over direct send activation
- Treat triggerless workflow and disabled automation as a safety feature, not a temporary inconvenience
- Delay any cleanup that weakens preview parity or cooldown checks until a controlled patch plan is approved

## Risks

- email truth remains split across:
  - `Email_Status`
  - `Email_Bounce_Flag`
  - `Email_Bounce_Reason`
  - `Email_Next_Action_Date`
  - `Last_Contact_*`
  - cache-based cooldown state
- `FAILED` and `SENT` are durable but not the only replay/suppression signals
- removing any one layer prematurely could expose duplicate sends or incorrect suppression behavior

## Conclusion

- Current recommendation: preserve manual-first queue operation, keep preview-before-send guarantees, and plan cleanup only after S3A documents a controlled patch order for email state, payment semantics, and triggerless operation
