# R391H Communication Ownership and Bulk Orchestrator

## Verdict

`BLOCKED`

`BATCH REMAINS PROHIBITED`.

The source contains three independently callable applicant-cohort send orchestrators and an enabled trigger-based sender. The current batch receipt and idempotency layer is cache-only. These conditions meet the CIS stop conditions; no runtime consolidation was performed.

## Baseline and scope

| Item | Evidence |
| --- | --- |
| Repository | `D:\Repos\FODE_Runtime_1wog` |
| HEAD | `909489eda98500d66af8d0108a7f04fab4a6a045` |
| Branch / origin | `main` / aligned, ahead/behind `0 / 0` |
| Initial working tree | clean |
| Runtime changes | none |
| Tests changed | none |
| Release | none |

The diagnostic covered Apps Script globals, Admin client RPC call sites, direct Gmail/MailApp calls, trigger paths, capability gates, cache/property state, receipt projection, configuration, and existing tests. Local `Config.js` is source evidence only; no live `whoami`, remote-source, or browser proof was requested or used.

## Active Admin client chain

`doGet` -> `resolveDoGetHandler_` -> `renderAdminApp_` -> `AdminUI.html`.

`AdminUI.html` includes `AdminUI_OpsLifecycle.html`, `AdminUI_OpsApplicantQueue.html`, `AdminUI_OperatorNext.html`, `AdminUI_SharedRowFacts.html`, and `AdminUI_OpsCommunications.html`.

The Admin client invokes all of the following live RPC names:

| Client flow | RPC |
| --- | --- |
| Individual preview | `admin_previewApplicantMessage` |
| Individual final send | `admin_sendApplicantMessage` |
| Stage cohort preview / send | `admin_previewStageBatch` / `admin_sendStageBatch` |
| Explicit selected-cohort preview / send | `admin_previewSelectedApplicantBatch` / `admin_sendSelectedApplicantBatch` |
| EduOps command batch | `eduops_previewCommand` / `eduops_executeCommand`, which delegates to selected-cohort preview/send |

## Communication authority map

| Entry point | Caller | Server authority | Mode | Preview authority | Send authority | Receipt/history | Retry | Classification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `admin_previewApplicantMessage` | Admin client | `Admin_SelectedApplicantCommunications.js` | individual | canonical preview plus immutable cached approved payload | none | cached preview identity | new preview only | AUTHORITATIVE for individual preview |
| `admin_sendApplicantMessage` | Admin client, EduOps dispatch | `Admin_SelectedApplicantCommunications.js` -> `sendApplicantMessage_` | individual | exact cached preview match, including canonical payload and identity | `sendApplicantMessage_` | row contact state, campaign log; EduOps projection when routed through command | operation idempotency | AUTHORITATIVE for individual final send |
| `admin_previewStageBatch` | Admin client | `Admin_StageBatchCommunications.js` | cohort | Stage cache, candidate hash, integrity fingerprint | none | preview only | new preview only | ACTIVE DUPLICATE bulk authority |
| `admin_sendStageBatch` | Admin client | `Admin_StageBatchCommunications.js` -> `sendApplicantMessage_` | cohort | Stage cache parity and integrity recheck | direct cohort loop | aggregate only; per-recipient row history | no governed resume | ACTIVE DUPLICATE bulk authority |
| `admin_previewSelectedApplicantBatch` | Admin client, EduOps command | `Admin_SelectedApplicantCommunications.js` | cohort | selected IDs, cache, candidate hash and integrity fingerprint | none | preview only | new preview only | ACTIVE DUPLICATE bulk authority |
| `admin_sendSelectedApplicantBatch` | Admin client, EduOps command | `Admin_SelectedApplicantCommunications.js` -> `sendApplicantMessage_` | cohort | selected-cache parity and integrity recheck | direct cohort loop | `applicantOutcomes`; no durable batch receipt | no governed resume | ACTIVE DUPLICATE bulk authority |
| `eduops_previewCommand` / `eduops_executeCommand` for `BATCH_COMMUNICATION` | EduOps client | `EduOps_Commands.js` | cohort | command cache plus selected-cohort preview | delegates to `admin_sendSelectedApplicantBatch` | `EduOps_Receipts.js` projection | user-cache replay only | DELEGATING_WRAPPER, but adds a separate cache-only receipt layer |
| `admin_campaignSendLegacyBatch` / `campaign_sendLegacyBatch_` | Apps Script global / Admin wrapper | `Admin.js` -> `Code.js` -> `campaignSendEmailGmail_` | cohort | legacy campaign context | direct Gmail adapter | legacy row/log state | legacy flow | COMPATIBILITY_BOUND Gmail-capable bulk path |
| `admin_campaignSendLegacyFollowups` / `campaign_sendLegacyFollowups_` | Apps Script global / Admin wrapper | `Admin.js` -> `Code.js` -> `campaignSendEmailGmail_` | cohort | legacy campaign context | direct Gmail adapter | legacy row/log state | legacy flow | COMPATIBILITY_BOUND Gmail-capable bulk path |
| `automatedStageBatchRunner` | installable trigger | `Code.js` -> `runAutomatedStageBatchWithLock_` -> `sendApplicantMessage_` | cohort | current row selection, not approved cohort preview | unattended direct loop | row/log state | chunk continuation, not recipient operation resume | ACTIVE Gmail-capable bulk path |
| `admin_campaignProcessBounces` / `admin_scanBounces_` | Admin wrapper | `Code.js:ingestRecentBounces_` | read/write reconciliation | n/a | no send | row contactability projection | processed-message cache | ACTIVE, outside send authority |
| `admin_getOperationHistory` / `eduops_recoverCommandReceipt` | EduOps client | `EduOps_Receipts.js` | read-only | n/a | none | user-cache receipt history | cache replay | READ_ONLY, transient |
| `admin_sendDocsFollowupEmails` | Apps Script global | `Admin.js` | legacy cohort | n/a | returns retired block | none | none | PROHIBITED |

Other direct adapters remain active transactional or internal single-send paths and are outside Stage Batch ownership: `adminSendEmail_` in `Utils.js`; `sendEmailBestEffort_` and `campaignSendEmailGmail_` in `Code.js`; quote/payment helpers in `Admin.js`; `admin_notifyOpsClassroomAdmin`; `admin_emailWhatsAppFallbackCsv`; and the controlled Zoho Books test-email endpoint. They must be inventoried before any repository-wide Gmail-adapter consolidation, but are not evidence that Stage Batch is safe.

## Required ownership model

The intended model remains:

```text
Client intent and immutable IDs
  -> Communication orchestrator
  -> per-recipient operation authority
  -> Gmail adapter
  -> immutable receipt authority
  -> Audit/history projection
```

Current implementation differs:

```text
AdminUI
  -> Stage Batch loop -----------------------------+
  -> Selected Batch loop <- EduOps command --------+-> sendApplicantMessage_ -> Gmail adapter
  -> Legacy campaign loops ------------------------+-> campaignSendEmailGmail_ -> GmailApp
  -> Trigger runner -------------------------------+-> sendApplicantMessage_ -> Gmail adapter
```

The individual path is the only proven reference path. It binds explicit template selection, applicant, recipient, canonical subject/body, CC/BCC, preview fingerprint, operation/preview/receipt IDs, cooldown cycle, and idempotency key before dispatch. `PREVIEW_STALE`, population integrity, capability, contactability, cooldown, and idempotent replay remain preserved there.

## Material blockers

| Blocker | Evidence | Consequence |
| --- | --- | --- |
| More than one callable bulk sender | Stage, selected, legacy campaign, and trigger paths are public Apps Script globals; Stage and selected are both called by `AdminUI.html` | Stage Batch is not the only bulk authority |
| Configured source enables bulk and triggers | `Config.js` sets `ENABLE_BATCH_SENDS`, `ENABLE_TRIGGER_SENDS`, `ENABLE_AUTOMATED_STAGE_RUNNER`, `ENABLE_TRIGGER_EMAIL_SENDS`, and `ENABLE_PRODUCTION_EMAIL_SENDS` true | Source cannot support a claim that Batch is prohibited; runtime truth remains unverified |
| No immutable per-recipient batch identity | selected batch can supply cohort identity to every `sendApplicantMessage_` invocation; Stage invokes without recipient preview/operation/receipt IDs | cohort identity cannot substitute for recipient operation identity |
| Cohort preview state is transient | stage and selected previews use user cache; EduOps command preview uses user cache | refresh, session change, eviction, and timeout cannot support durable resume |
| Idempotency receipt is transient | `eduopsStoreIdempotentReceipt_` declares `TRANSIENT_USER_CACHE`, `TRANSIENT_CACHE_ONLY`, `durableIdempotency: false` | safe retry after interruption cannot be proven |
| Receipt is projection, not ledger | `EduOps_Receipts.js` constructs return/history data from cached receipt data | no append-only durable per-recipient receipt owner |
| Aggregate-only Stage result | Stage loop returns counts and a sample, without durable recipient outcome records | mixed outcomes, retry units, and uncertain outcomes cannot be safely resumed |
| Post-send uncertainty is unresolved | Gmail `sendEmail` returns no provider message ID; a failure after Gmail acceptance but before row/log persistence is represented only indirectly | automatic retry could duplicate a message |
| Trigger path bypasses preview cohort | `automatedStageBatchRunner` resolves rows and sends unattended | violates approved immutable cohort requirement |

## Current receipt, idempotency, and audit boundary

| Concern | Current bounded owner | Limitation | R390B2 owner requirement |
| --- | --- | --- | --- |
| Individual operation identity | selected-applicant communication identity plus row/log evidence | no durable general batch operation store | durable per-recipient operation record |
| Batch preview | user cache | expires and is operator-session scoped | immutable durable cohort record |
| Idempotency | user cache and existing row/log checks | explicitly transient; no safe interruption recovery | durable idempotency key and operation state |
| Receipt | `EduOps_Receipts.js` response/history projection | not append-only durable ledger | immutable chronological event ledger |
| Audit/history | row contact fields, campaign logs, and projections | can show latest state but not authoritative full event timeline | projection of durable events only |

## Cohort and result contract required before any pilot

No runtime contract was added. A future Stage Batch contract must bind `cohortId`, ordered ApplicantIDs, snapshot/integrity fingerprint, message type, explicit template/version, per-recipient canonical payload, recipient, CC/BCC, portal hydration, contactability, authority, cooldown, created/expires timestamps, and unique preview/operation/receipt IDs per recipient.

The result taxonomy must keep these meanings distinct: `SENT` (outbound acceptance only), `BLOCKED`, `SUPPRESSED`, `FAILED_TRANSIENT`, `FAILED_PERMANENT`, `UNCERTAIN`, `NOT_ATTEMPTED`, and `IDEMPOTENT_REPLAY`. A resumed cohort must skip successful operations, retain blocked/permanent outcomes, retry only explicitly transient operations, and halt on `UNCERTAIN`.

## Delivery and recipient-event architecture

`SENT` must mean outbound provider acceptance, not mailbox delivery. The current adapters do not retain an outbound Gmail provider message ID, RFC `Message-ID`, or thread ID. The bounce scan reads inbound Gmail messages (`GmailApp.search` and message IDs), classifies them, and mutates row contactability fields. It correlates from applicant/email content and is not a durable communication-event authority.

| Identifier | Current state | Correlation sufficiency | R390B2 requirement |
| --- | --- | --- | --- |
| ApplicantID, recipient, template/type, send timestamp | created in communication context and row/log projections | partial | preserve in event record |
| previewId, operationId, receiptId | present on selected individual and EduOps command paths | not consistently per batch recipient or durably persisted | durable per-recipient identities |
| cohortId | stage/selected labels and request identifiers only | not immutable durable cohort identity | durable cohort record |
| Gmail/provider message ID, RFC `Message-ID`, outbound thread ID | not captured from outbound send | insufficient | retain when provider exposes it |

Future event authority must append, not rewrite: `SEND_ACCEPTED` may later be followed by `BOUNCED_PERMANENT`, `DELIVERY_CONFIRMED`, `OPEN_SIGNAL_RECORDED`, `READ_RECEIPT_RECEIVED`, `REPLY_RECEIVED`, `PORTAL_LINK_OPENED`, `DOCUMENT_UPLOADED`, `PAYMENT_EVIDENCE_SUBMITTED`, or `REQUIRED_ACTION_COMPLETED`. Open signals are probabilistic and must never be labelled read. Read receipts do not establish understanding or completion. No tracking pixels, mailbox polling extension, read-receipt requests, or external tracking service were implemented.

A permanent bounce should append a later event and drive a separate contactability projection that blocks further automatic sends pending review. Transient and uncertain delivery results must not cause automatic repeat sending. An unrestricted batch recommendation additionally requires durable provider-ID correlation and owner-visible delivery exception handling. Open/read tracking is optional for a bounded pilot and subject to separate privacy and governance approval.

## Capability model required

Existing `CAN_RUN_BATCH_COMMUNICATIONS` is insufficient because it combines bulk visibility and execution. Before any future implementation, narrowly separate server-enforced capabilities for viewing Stage Batch, preparing a cohort, previewing, approving execution, executing a capped pilot, viewing receipts, resolving uncertainty, and retrying transient failures. Individual-send capability, Workbench access, Finance access, role, and client enabled state must not imply these powers.

## Test evidence and gaps

Existing coverage explicitly preserves both Stage and selected-batch paths: `tests/admin-ui-rpc-contract.test.js`, `tests/admin-ui-actionability-dashboard-surface.test.js`, `tests/admin-operator-scenario-contract.test.js`, `tests/communication-send-gate-matrix.test.js`, `tests/r391b-population-integrity-fail-closed.test.js`, and EduOps batch contract tests. This confirms the duplicate bulk surface is intentional compatibility, not proven dead code.

Missing before pilot: authoritative-single-bulk-path tests; immutable cohort mutation tests; unique per-recipient preview/operation/receipt tests; durable interruption/resume tests; mixed-result persistence tests; Gmail quota and post-send uncertainty tests; capability-separation tests; and append-only delivery-event contract tests.

## Bounded allowlist and decision

| File | Current responsibility | Proposed responsibility | Risk |
| --- | --- | --- | --- |
| `docs/audits/R391H_Communication_Ownership_and_Bulk_Orchestrator_2026-07-30.md` | R391H architecture evidence | record diagnostic and blockers | Track L, documentation only |

No runtime, client, test, configuration, deployment, Student, Finance, or Production files are authorized for this blocked pass. Any later runtime work must be a new owner-approved `Track H` CIS, use the consolidated pipeline, require a Full Gate, and explicitly authorize the precise bulk-path disposition and durable-state strategy.

## R390B2 prerequisites

1. Durable immutable cohort and per-recipient preview/operation/receipt records.
2. Durable idempotency and retry state that survives cache eviction, browser refresh, execution timeout, and partial completion.
3. Append-only synchronous and asynchronous communication event ledger with correction/supersession rules.
4. Provider/RFC message correlation where available; correlation-safe bounce intake; delivery uncertainty handling.
5. Per-recipient outcome persistence, safe resume, and no-retry-on-uncertainty policy.
6. Separate contactability projection from the event ledger.
7. Event deduplication, first/last observation, source, confidence, privacy-aware retention, and safe tracking-token design.
8. Explicit capability boundaries for pilot execution, uncertainty resolution, and retry.

## Safety confirmation

No Batch send, Gmail send, applicant mutation, Sheet mutation, Drive mutation, Zoho write, Google Classroom write, Student change, Production change, deployment, commit, or push occurred.
