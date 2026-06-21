# E2.1 Communication Visibility Template Matrix Audit v01

Status: Discovery only
Track: L
Runtime changes: None
Deployment changes: None

## Scope

Assess current Admin communication visibility and whether the correct operator message template/action is available for each applicant context.

This audit does not change:

- send logic
- communication authority
- queue membership
- lifecycle authority
- payment authority
- document authority
- Apps Script source/deployment

## Baseline

Requested baseline in CIS:

- stable Admin staging `r277 / 277`

Observed current repo/runtime evidence during this audit:

- local repo clean
- local `Config.js` still reports `r278 / 278`
- `clasp deployments` currently reports Admin staging pinned at `@279`
- Student staging still `@247`

Implication:

- the attached CIS baseline is stale
- this audit is still valid as source/visibility discovery, but release references should be corrected before any follow-on implementation slice

## Files Inspected

- `E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\AdminUI.html`
- `E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Admin.js`
- `E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Code.js`
- `E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Config.js`
- `E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\audits\E2_Communication_Authority_Audit_v01.md`

## Authority Summary

Current communication authority is split across three layers:

1. Visibility layer
   - opening-surface communication cards in `AdminUI.html`
   - selected-applicant communication detail in the review modal
2. Eligibility layer
   - `admin_previewStageBatch()` and `Preview Cohort Result`
   - `resolveApplicantMessageContextFromRow_()`
   - `deriveCommunicationState_()`
3. Send execution layer
   - `admin_previewApplicantMessage()`
   - `admin_sendApplicantMessage()`
   - `admin_sendStageBatch()`

Key rule:

- `Preview Cohort Result` is the authoritative batch mail-eligibility surface
- `Review Queues` are workload surfaces, not send-authority surfaces
- actionability is advisory only

## Actual Current Message Type Inventory

Configured allowed single-record message types in `Config.js`:

- `legacy_invite`
- `reminder`
- `fd_acknowledgement`
- `application_feedback`
- `custom_email`
- `docs_missing`
- `payment_followup`

Configured batch filter types:

- `legacy_invite_eligible`
- `docs_missing`
- `payment_pending`

Actual stage-batch message type mapping:

- `INVITE_PENDING` -> `legacy_invite`
- `INVITED_AWAITING_RESPONSE` -> `reminder`
- `REMINDER_DUE` -> `reminder`
- `DOCS_REQUIRED` -> `reminder`
- `PAYMENT_REQUIRED` -> `reminder`
- `RECEIPT_AWAITING_VERIFICATION` -> `reminder`

Important gap:

- the selected-applicant Legacy Admin communication picker currently exposes only:
  - `legacy_invite`
  - `reminder`
  - `application_feedback`
  - `custom_email`
- `docs_missing` and `payment_followup` exist in backend/config and OPS surfaces, but are not clearly exposed in the main Legacy Admin review modal message-type picker

## Current Visibility Surfaces

| Surface | Current value | Notes |
|---|---|---|
| `4. Communication Performance` | Partial | Good aggregate counters, but not decision-authoritative. |
| `Stage Batch Communications` | Strong for batch | Best current mail-eligibility surface via Preview Cohort. |
| `Preview Cohort Result` | Strong | Shows sendable/gate reason/message type for selected lifecycle stage. |
| Review modal `Communications` section | Partial | Good single-record visibility, but exposed message types are narrower than backend capabilities. |
| Review modal `Last Contacted/Type/Result` | Present | Operator can see recent contact evidence before preview/send. |
| Actionability Preview | Advisory only | Can imply communication need, but does not prove template availability. |
| Review Queues | Workload only | Useful for operational work; not mail-eligibility authority. |
| OPS communication controls | Present but frozen | Shows additional types, but OPS is frozen and should not be treated as the next operator-facing solution by default. |

## Visibility Findings

### What is working

- opening surface clearly separates communication counters from review queues
- selected-applicant review modal shows:
  - effective email
  - email status
  - bounce flag/reason
  - next eligible send
  - last contacted at
  - last contact type
  - last contact by
  - last contact subject
  - last contact result
- Stage Batch Preview already exposes:
  - selected stage
  - recommended message type
  - sendable
  - gate reason
  - preview diagnostics

### What is operator-risky

- message-type availability is inconsistent across surfaces
- some actionability concepts do not map to real operator-sendable templates
- `reminder` is overloaded across:
  - awaiting response
  - documents required
  - payment required
  - receipt awaiting verification
- opening-surface communication cards mix evidence and status:
  - `Row-Logged Contact Activity Today`
  - `Email Rows Sent Today`
  - `FAILED (Status + Last Result)`
  - `SUPPRESSED (Status + Last Result)`
- main Legacy Admin selected-applicant communications UI does not expose `docs_missing` or `payment_followup`, even though backend/config recognize them

## Operator Communication Template Matrix

| Template / Action Family | Current source / function / name | Lifecycle / actionability context | Current UI surface | Preview | Individual send | Batch send | Blockers / gates | Last-contact visibility before send | Status | Recommended next action |
|---|---|---|---|---|---|---|---|---|---|---|
| Missing Documents Reminder / `SEND_DOC_REMINDER` | Backend type exists as `docs_missing`; builder path in `buildApplicantMessage_()`; OPS button label `Send Missing Documents Request` | Applicant submitted or in docs-required context; missing documents still unresolved | OPS communication controls; not exposed in main review-modal picker | Partial | Partial | Partial | email validity, bounce/do-not-contact, cooldown, portal state, docs-complete gate | Present in review modal comm card | Partial | Add explicit Legacy Admin preview/send surface or explicitly route this family through Stage Batch with clearer docs-specific wording. |
| Payment Reminder / `SEND_PAYMENT_REMINDER` | Backend type exists as `payment_followup`; builder path in `buildApplicantMessage_()`; OPS button label `Send Invoice Reminder` | Docs verified, payment still outstanding | OPS communication controls; not exposed in main review-modal picker | Partial | Partial | Partial | email validity, bounce/do-not-contact, cooldown, payment already resolved gate | Present in review modal comm card | Partial | Expose as a named operator action in Legacy Admin or document that payment reminder is stage-batch/OPS-only. |
| Receipt Request / `SEND_RECEIPT_REQUEST` | No distinct message type found; stage `RECEIPT_AWAITING_VERIFICATION` still maps to generic `reminder` | Payment claimed / receipt expected or receipt clarification needed | Stage Batch via generic `reminder`; no distinct selected-applicant control found | Partial | Ambiguous | Partial | generic reminder gates only; no receipt-specific action family | Present in review modal comm card | Missing / Ambiguous | Add a distinct receipt-request family or explicitly define that receipt follow-up uses generic reminder with receipt-specific wording. |
| Documents Verified -> Quotation / Payment Instruction / `SEND_VERIFIED_QUOTE` | Quote email code exists: `sendQuoteEmail_()` with `templateType: "docs_verified_quote_email"`; automation currently marked `manual_only` in `runVerificationAutomations_()` | Docs verified, payment not yet completed | Not clearly exposed in current Admin UI send surfaces | Unclear | Unclear | No clear batch path | recipient availability, internal workflow/manual-only status | Limited; no dedicated pre-send visibility surface found | Partial / Hidden | Decide whether this remains internal/manual-only or becomes an explicit operator preview/send action with visible quote context. |
| Acceptance / Enrolment Confirmation / `SEND_ACCEPTANCE` | Acceptance-style text exists around payment-verified/enrolment messaging, but no distinct normalized communication type found in allowed message types | Payment verified / enrolment-ready / accepted state | No explicit current operator communication template surfaced | No clear operator preview | No clear operator send | No | missing distinct message family; unclear authority boundary vs enrolment/classroom flow | Review modal shows contact history only | Missing / Ambiguous | Define whether this belongs in communications authority at all, or stays outside current operator send surface. |
| Accepted but Graduation/Exam/Timing Impact subtype | No dedicated subtype found | Accepted/confirmed with downstream timing impact or exception | None found | No | No | No | no subtype, no surfaced lifecycle-template mapping | None beyond general last-contact fields | Missing | Treat as a future explicit subtype if communication authority wants accepted-but-conditional messaging. |
| Overdue / Final Reminder / `SEND_FINAL_REMINDER` | No distinct normalized type found; overdue logic exists conceptually in actionability/stage progression, but not as a dedicated template family | Repeated non-response / long-stale | No explicit surface found | No clear preview | No clear send | No clear batch path | no dedicated type; generic reminder only | Present only as history, not as final-reminder readiness | Missing / Ambiguous | Add a distinct final-reminder family or explicitly reject it as unsupported. |
| Contact Failure / WhatsApp Fallback / manual fallback template | Present via WhatsApp fallback tooling: `admin_exportWhatsAppFallbackCsv()`, `buildWhatsAppFallbackMessage_()`, `emailWhatsAppFallbackCsv_()`; UI labels `Export CSV`, `Email CSV to Admins` | Invalid email, bounced email, blocked contact result, fallback pending | Opening-surface fallback panel; OPS fallback tools | N/A email preview | No individual WhatsApp send | Batch-style export only | admin role, ops/super gates, fallback filter, manual operator action required | Strong enough for diagnostics; not integrated into selected-applicant comm picker | Present | Keep as manual fallback, but improve visibility linkage from single-record comm failure to fallback export path. |

## Requested Family vs Actual Runtime Alignment

### Families clearly present

- `legacy_invite`
- `reminder`
- `application_feedback`
- `custom_email`
- `docs_missing`
- `payment_followup`
- WhatsApp fallback export flow

### Families present only as hidden/internal/manual workflow

- docs verified -> quote / payment instruction

### Families not implemented as distinct communication types

- receipt request
- acceptance / enrolment confirmation
- accepted-but-impact subtype
- final reminder

## Key Gaps

1. Template vocabulary is broader in operator expectation than in actual runtime.

2. Main Legacy Admin selected-applicant communication picker is narrower than backend/config capability.

3. Stage batch uses generic `reminder` where operators likely expect distinct families:

- missing documents
- payment reminder
- receipt request
- final reminder

4. Last-contact evidence is visible before send, but template/action availability is not reconciled clearly against lifecycle stage.

5. Quote/payment-instruction communication exists in code, but is not surfaced as a normal operator preview/send workflow.

## Recommended Next Slice

Recommended next slice: `E2.1A Communication Visibility Reconciliation`

Suggested scope:

- UI copy/surface only first
- no send logic changes
- no communication authority changes

Priority items:

1. Reconcile actual available message families vs operator labels.
2. Show which template family is actually available for the current applicant/stage.
3. Distinguish:
   - selected-applicant preview/send
   - stage-batch preview/send
   - manual fallback only
4. Surface `docs_missing` and `payment_followup` availability more truthfully in Legacy Admin.
5. Mark missing families explicitly rather than implying they already exist.

## Risks

- operators may assume a stage implies a corresponding send template when none exists
- operators may infer batch sendability from workload queues instead of Preview Cohort
- operators may treat generic `reminder` as sufficient for receipt/final/escalation scenarios when wording authority is not differentiated
- hidden/manual quote workflows reduce trust because lifecycle state and communication action do not visibly line up

## Recommendation

Do not implement new templates first.

First reconcile visibility:

- what exists
- where it is visible
- which surface is authoritative for preview/send eligibility
- which requested families are currently missing

Then decide whether the next safe slice is:

- wording/surface reconciliation only, or
- adding distinct missing template families

## Safety Confirmation

- no runtime behavior changed
- no Apps Script version created
- no deployment repin performed
- no sends performed
- no sheet edits performed
- no Drive data edits performed
- OPS remains frozen
