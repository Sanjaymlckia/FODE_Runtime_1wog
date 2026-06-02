# FODE r214 Read-Only Data-Flow Audit

Track: Track L
Runtime release: No runtime release
Audit date: 2026-06-02
Scope: Read-only audit of r213 applicant pipeline data-flow for queue release, communication cooldown, reminder eligibility, and backlog retention.

## Executive Summary

Records remain in queue/backlog because review queue membership is primarily portal/document/payment driven, while communication readiness is separately email/cooldown driven. A communication cooldown expiring does not remove a row from the review backlog, and a row can remain in backlog after communication is no longer eligible.

The main review queues in `admin_getReviewQueues` are determined by `Portal_Submitted`, raw `Docs_Verified`, raw `Payment_Verified`, `Fee_Receipt_File`, and external FD intake markers (`Admin.js:3828`, `Admin.js:3956`). The operational dashboard backlog count is even broader: `buildOperationalDashboardMetrics_` increments `queueBacklog` for any `isQueueCandidateRow_` row (`Admin.js:3410`, `Admin.js:3466`), and `isQueueCandidateRow_` includes rows that are external FD intake, portal-submitted, docs-verified, or payment-verified (`Admin.js:3313`).

Send/reminder eligibility uses a different set of sources. The visible UI "Ready to Send" text from `deriveSendEligibility` only checks `Email_Next_Action_Date` (`AdminUI.html:6565`). Backend preview/send eligibility uses `resolveApplicantMessageContextFromRow_` and `deriveCommunicationState_`, including email validity, bounce/Do Not Contact state, portal secret state, portal submitted state, message type, and a separate communication cooldown source (`Code.js:6638`, `Code.js:6855`).

Risk rating: High data-flow ambiguity. Audit execution risk is Low because no runtime files, sheets, deployments, Apps Script versions, commits, or tags were modified.

## Data-Flow Map

1. Form submission / activation:
   - `preparePortalActivationState_` creates `PortalTokenHash` and `PortalTokenIssuedAt` when headers exist (`Code.js:4690`).
   - `buildActivatedIntakeRow_` writes `ApplicantID`, `Folder_Url`, `PortalTokenHash`, and `PortalTokenIssuedAt` into the new row (`Code.js:4973`).
   - `maybeStampActivationSubmitState_` stamps `PortalLastUpdateAt` and `Portal_Submitted` only when non-payment document uploads are detected, explicitly excluding `Fee_Receipt_File` (`Code.js:4943`).

2. Portal submission and upload state:
   - `handlePortalUpdate_` writes `PortalLastUpdateAt` and stamps `Portal_Submitted` if blank (`Code.js:968`).
   - `applyPortalUploadSheetUpdate_` writes the uploaded file field, `PortalLastUpdateAt`, stamps `Portal_Submitted`, and sets the document status field to `PENDING_REVIEW` when available (`Code.js:1417`).
   - Payment receipt upload is detected through `Fee_Receipt_File` and triggers payment receipt notification logic, but it does not by itself mark `Payment_Verified`.

3. Document/payment evidence state:
   - Document metadata comes from `CONFIG.DOC_FIELDS`: `Birth_ID_Passport_File/Birth_ID_Status`, `Latest_School_Report_File/Report_Status`, `Transfer_Certificate_File/Transfer_Status`, `Passport_Photo_File/Photo_Status`, and `Fee_Receipt_File/Receipt_Status` (`Config.js:381`).
   - `computeDocVerificationStatus_` derives required-doc verification from birth, report, and photo statuses (`Code.js:4238`).
   - `adminVerifyDocument` rolls up `Docs_Verified` only when required documents are verified, excluding optional fields (`Routes.js:52`).
   - Payment verification is derived from receipt status through `derivePaymentBadge_` / `isPaymentVerifiedDerived_`; `derivePaymentVerified_` may align legacy `Payment_Verified` in memory when present (`Code.js:4184`, `Code.js:4222`).

4. Lifecycle stage:
   - Backend communication lifecycle is derived by `deriveApplicantLifecycleStage_` from email status, portal submitted, bounce state, doc verification, payment badge, receipt evidence, attempt count, and `Email_Next_Action_Date` (`Code.js:7291`).
   - Operational dashboard pipeline stage is separately derived by `deriveOperationalPipelineStage_` from explicit stage headers, registration/payment/docs/portal/email/contact fields (`Admin.js:3361`).
   - UI row facts derive another workflow state with `opsBuildRowFacts_`, `opsDocumentStateFromRawRow_`, `opsPortalStateFromRawRow_`, and `opsPaymentEvidenceStatus_` (`AdminUI_SharedRowFacts.html:16`, `AdminUI.html:2872`, `AdminUI.html:2911`, `AdminUI.html:3178`).

5. Communication status and send/reminder eligibility:
   - `deriveCommunicationState_` builds backend send state from email fields, last contact fields, `Email_Next_Action_Date`, portal-submitted state, docs/payment state, and communication cooldown store (`Code.js:6638`).
   - `resolveApplicantMessageContextFromRow_` applies backend blocks before preview/send (`Code.js:6855`).
   - `previewApplicantMessage_` blocks preview when context is not eligible (`Code.js:8580`).
   - `sendApplicantMessage_` applies manual/prod/stabilization/send gates and dispatches only after context passes (`Code.js:8644`).
   - `dispatchApplicantMessage_` writes campaign/contact results and sets communication cooldown state on send (`Code.js:7609`).

6. Queue/backlog inclusion:
   - Review queue candidate: `ApplicantID` plus external FD intake, portal submitted, docs verified, or payment verified (`Admin.js:3313`).
   - Review queue buckets are classified by portal submitted, raw docs verified, raw payment verified, and receipt evidence (`Admin.js:3956`).
   - Operational dashboard backlog count is candidate-driven, not send-driven (`Admin.js:3466`).

7. Queue release/removal:
   - FD received bucket releases when `Portal_Submitted`, raw `Docs_Verified`, or raw `Payment_Verified` becomes true.
   - Docs bucket releases when raw `Docs_Verified` becomes true.
   - Awaiting payment bucket releases when `Fee_Receipt_File` appears or raw `Payment_Verified` becomes true.
   - Payments bucket releases when raw `Payment_Verified` becomes true.
   - Paid approved bucket includes raw `Payment_Verified` true rows and therefore is not a terminal removal from all review/backlog counts.

## Field/Header Inventory

Lifecycle stage:
- `Email_Status`, `Email_Attempt_Count`, `Email_Next_Action_Date`, `Email_Bounce_Flag`, `Portal_Submitted`, `Docs_Verified`, `Payment_Verified`, `Fee_Receipt_File`, per-document status fields, and receipt status in `deriveApplicantLifecycleStage_` (`Code.js:7291`).
- `Pipeline_Stage`, `Operational_Stage`, `CRM_Stage`, `Stage`, `Registration_Complete`, `Payment_Verified`, `Docs_Verified`, `Portal_Submitted`, `Email_Status`, `Last_Contact_Result` in `deriveOperationalPipelineStage_` (`Admin.js:3361`).

Document status:
- `Birth_ID_Passport_File`, `Birth_ID_Status`, `Birth_ID_Comment`.
- `Latest_School_Report_File`, `Report_Status`, `Report_Comment`.
- `Transfer_Certificate_File`, `Transfer_Status`, `Transfer_Comment`.
- `Passport_Photo_File`, `Photo_Status`, `Photo_Comment`.
- `Fee_Receipt_File`, `Receipt_Status`, `Receipt_Comment`.
- Rollups/alternates: `Docs_Verified`, `Doc_Verification_Status`, `Docs_Status`, `Document_Status`, `Documents_Status`, `Overall_Doc_Status`, `Documents_Ready`, `docsStatus`, `Birth_Status`, `Document_Review_Status`, `Eligibility_Status`.

Payment status:
- `Payment_Verified`, `Payment_Verified_Bool`, `paymentVerified`, `Payment_Received`, `Fee_Receipt_File`, `Receipt_Status`.
- Payment lock/derived verification uses `Receipt_Status` through `derivePaymentBadge_` and `isPaymentVerifiedDerived_` (`Code.js:4184`).

Portal state:
- `Portal_Submitted`, `PortalLastUpdateAt`, `PortalTokenHash`, `PortalTokenIssuedAt`, `Portal_Access_Status`, `_PortalHardLocked`, `PortalURL`, `Portal_Link`, `Portal_Token_Status`.
- Portal lock uses payment verified, `Portal_Access_Status === "Locked"`, or `_PortalHardLocked` (`Code.js:4168`).

Token age / access state:
- `PortalTokenIssuedAt`, `PortalTokenAgeDays`, `PortalTokenExpired`, `PortalTokenMaxAgeDays`, `PortalTokenHash`, `Portal_Access_Status`.
- Token expiry helper exists as `isPortalTokenExpired_` (`Code.js:4022`); this audit found display/administrative age handling, but no direct portal-open enforcement call in the inspected references.

Communication status:
- `Email_Status`, `Email_Bounce_Flag`, `Email_Bounce_Reason`, `Last_Contact_Type`, `Last_Contact_Result`, `Last_Contact_Batch`, `Comm_Stage`, `Comm_Status`, `Comm_Block_Code`, `Comm_Block_Reason`, `Comm_Recommended_Message_Type`, `Comm_Awaiting_Response`.

Last sent / contacted / reminder timestamp:
- `Email_Last_Sent_At`, `Last_Contacted_At`, `Ack_Email_Sent_At`, `Email_Next_Action_Date`, `Last_Contact_Subject`.
- Legacy follow-up selection uses `Email_Next_Action_Date` and `Email_Attempt_Count` (`Code.js:9556`).

Cooldown:
- UI visible cooldown: `Email_Next_Action_Date` in `deriveSendEligibility` (`AdminUI.html:6565`).
- Backend applicant-message cooldown: `COMMUNICATION_COOLDOWN_MINUTES`, `communicationCooldownMs_`, `getLastCommunicationSentAt_`, and `setLastCommunicationSentAt_` (`Config.js:216`, `Code.js:6376`).
- Communication cooldown cache configuration: `COMMUNICATION_COOLDOWN_CACHE_TTL_SECONDS`, `COMMUNICATION_COOLDOWN_CACHE_MAX_TTL_SECONDS` (`Config.js:146`).
- Docs follow-up retry cooldown: `DOCS_FOLLOWUP_COOLDOWN_MS` and client `lastDocsSendAttemptByApplicantId` (`Config.js:232`, `AdminUI.html:7071`).
- Docs follow-up durable sent state: `DOCS_FOLLOWUP_SENT::<DATA_MODE>::<ApplicantID>` (`Utils.js:3393`, `Admin.js:2108`).

Send eligibility:
- UI: `Email_Next_Action_Date` only for visible `Ready to Send` / `Cooldown Active` (`AdminUI.html:6565`).
- Backend: effective email, email validity, `Email_Status`, `Email_Bounce_Flag`, `Email_Bounce_Reason`, `Portal_Submitted`, portal secret lookup, docs/payment state, cooldown store, message type, actor role, production/stabilization flags (`Code.js:6638`, `Code.js:6855`, `Code.js:8644`).

Queue inclusion:
- `ApplicantID`, external adapter markers, `Portal_Submitted`, `Docs_Verified`, `Payment_Verified` (`Admin.js:3313`).
- External FD intake markers: adapter source `sheet_bound_adapter`, adapter forwarded true/yes/1, or adapter version (`Admin.js:3326`).

Queue release/removal:
- `Portal_Submitted`, raw `Docs_Verified`, raw `Payment_Verified`, `Fee_Receipt_File` (`Admin.js:3956`).
- `paidApproved` remains an explicit bucket when raw `Payment_Verified` is true (`Admin.js:3968`).

Backlog counts:
- `queueBacklog`: any `isQueueCandidateRow_` row (`Admin.js:3466`).
- `pendingIntakeReview`: pipeline not Enrolled and not Closed Lost (`Admin.js:3469`).
- `docsPending`: operational pipeline equals Documents Pending (`Admin.js:3467`).
- `paymentPending`: operational pipeline equals Payment Pending (`Admin.js:3468`).
- Review queue counts: normalized bucket lengths returned by `admin_getReviewQueues` / `normalizeReviewQueueData_` (`Admin.js:3828`).

## Blocking Condition Matrix

Next reminder can be blocked by:
- `Email_Status` not `SENT`.
- `Portal_Submitted` active / applicant responded.
- Bounce flag or bounce reason.
- `Email_Attempt_Count` missing, below 1, or 3 or more.
- `Email_Next_Action_Date` missing, invalid, or in the future.
- Backend communication cooldown active from `getLastCommunicationSentAt_`.
- Missing or invalid effective email.
- `Email_Status === DO_NOT_CONTACT`.
- Missing/inactive/unusable portal secret for portal-link message types.
- Durable prior success/failure or stage-batch prior-send exclusion.
- Role, preview, production-send, stabilization, or manual-send probe gates.

Communication send can be blocked by:
- Admin/Operations role gate in UI and backend.
- Missing applicant row or unsupported message type.
- Missing/invalid effective email.
- `DO_NOT_CONTACT`.
- Bounce/suppression state from `Email_Bounce_Flag`, `Email_Bounce_Reason`, verification bounce/suppression fields, or last contact result.
- Backend communication cooldown active, even if UI visible `Email_Next_Action_Date` says ready.
- Portal already submitted for legacy invite/reminder.
- Missing/inactive/unusable portal secret when the message requires a portal URL.
- Docs missing message when docs are not missing.
- Payment follow-up when payment is not outstanding.
- Production/stabilization send disable flags.
- Preview cache mismatch or no confirmed send in UI.
- Empty edited subject/body or invalid edited recipient.
- Send-provider failure or safe-mode recipient constraints.

Stage progression can be blocked by:
- Portal state not submitted for doc/payment progression.
- Required document statuses not all verified.
- Raw `Docs_Verified` not aligned with derived document verification.
- Receipt evidence missing for payment-evidence progression.
- Raw `Payment_Verified` not aligned with receipt-status-derived payment verification.
- Bounce/Do Not Contact/email failure states for communication lifecycle.
- Explicit operational stage headers overriding derived stage.

Queue release/removal can be blocked by:
- `Portal_Submitted` blank for FD received release.
- Raw `Docs_Verified` not exactly `Yes` for docs queue release.
- `Fee_Receipt_File` blank for awaiting-payment to payments transition.
- Raw `Payment_Verified` not exactly `Yes` for payments release into paid-approved.
- Raw `Payment_Verified === Yes` keeps the row in `paidApproved`; it is not removed from all review queues/backlog.
- Dashboard `queueBacklog` has no terminal exclusion for payment-verified rows because `isQueueCandidateRow_` treats payment verified as a positive candidate condition.
- User cache in `admin_getReviewQueues` can preserve queue results until forced refresh or expiry (`Admin.js:3835`).

Applicant disappearing from backlog can be blocked by:
- The row remaining an external FD intake candidate.
- Any nonblank active `Portal_Submitted`.
- Raw `Docs_Verified === Yes`.
- Raw `Payment_Verified === Yes`.
- Pipeline not Enrolled/Closed Lost for `pendingIntakeReview`.
- Review queue cache not forced after a state change.

## Timestamp/Cooldown Source Comparison

| Purpose | Source | Responsible code | Eligibility gate? |
| --- | --- | --- | --- |
| Queue aging display | First valid of `PortalTokenIssuedAt`, `PortalLastUpdateAt`, `adapter_timestamp`, `Timestamp`, `Created_At` | `pickQueueReceivedInfo_` (`Admin.js:3236`) | No, display/sort only |
| Queue received display | `receivedDisplay`, `receivedAt`, `receivedSource`, `receivedAtIso` | `queueReceivedText_`, `queueAgeBadge_` (`AdminUI.html:6619`, `AdminUI.html:6634`) | No |
| UI visible send cooldown | `Email_Next_Action_Date` | `deriveSendEligibility` (`AdminUI.html:6565`) | UI display/gating only |
| Backend applicant send cooldown | Communication cooldown store keyed by applicant/message type, using `COMMUNICATION_COOLDOWN_MINUTES` | `communicationCooldownMs_`, `deriveCommunicationState_` (`Code.js:6376`, `Code.js:6638`) | Yes |
| Legacy reminder due date | `Email_Next_Action_Date`, `Email_Attempt_Count`, `Email_Status`, `Portal_Submitted`, bounce state | `campaign_sendLegacyFollowups_` (`Code.js:9556`) | Yes |
| Docs follow-up durable send state | Script property `DOCS_FOLLOWUP_SENT::<DATA_MODE>::<ApplicantID>` | `buildDocsFollowupKey_`, `getDocsFollowupSentAt_`, `computeEligibleDocsFollowUp_` (`Utils.js:3393`, `Admin.js:2108`, `Admin.js:2119`) | Yes |
| Docs follow-up click retry cooldown | Browser-local `lastDocsSendAttemptByApplicantId`, `DOCS_FOLLOWUP_COOLDOWN_MS` | `AdminUI.html:7071` | UI retry gate only |
| Queue release logic | Portal/doc/payment booleans and receipt evidence | `admin_getReviewQueues` (`Admin.js:3956`) | Yes for queue bucket membership |

Conclusion: aging display, visible cooldown, backend cooldown, reminder eligibility, and queue release do not share one timestamp source.

## Queue/Backlog Inclusion Logic

Review queue inclusion is mixed portal/document/payment lifecycle logic:
- `fdReceived`: external FD intake, not portal submitted, not docs verified, not payment verified.
- `docs`: portal submitted and raw docs not verified.
- `awaitingPayment`: raw docs verified, raw payment not verified, no receipt file.
- `payments`: raw docs verified, raw payment not verified, receipt file present.
- `anomalies`: raw payment verified while raw docs not verified.
- `paidApproved`: raw payment verified.

Operational dashboard backlog is broader than the review queues:
- `queueBacklog` counts all `isQueueCandidateRow_` rows, including payment-verified rows (`Admin.js:3466`).
- `pendingIntakeReview` is operational-pipeline driven and excludes only Enrolled and Closed Lost (`Admin.js:3469`).

Communication queues in the UI are a third classification:
- `opsBuildRowFacts_` uses email availability, email issue, `recentlyContacted`, `cooldownActive`, document state, payment state, portal state, and workflow state (`AdminUI_SharedRowFacts.html:16`).
- `recentlyContacted` is true if any `Last_Contacted_At`, `Email_Last_Sent_At`, `Ack_Email_Sent_At`, or next action date exists, without checking whether the next action date is past (`AdminUI_SharedRowFacts.html:24`, `AdminUI_SharedRowFacts.html:45`).

## Release/Removal Logic

Queue release/removal is not canonical. Each operational stage has its own implicit rule:

- FD received releases when portal submission, raw docs verification, or raw payment verification becomes true.
- Docs releases only when raw `Docs_Verified === Yes`.
- Awaiting payment releases when receipt evidence appears or raw payment verification becomes true.
- Payments releases when raw `Payment_Verified === Yes`.
- Paid approved does not release from all queue/backlog views; it is a queue bucket for payment-verified rows.
- Dashboard backlog does not release completed/payment-verified candidates because payment verification is one of the candidate predicates.

This explains why a row can remain in backlog after a send cooldown expires: cooldown belongs to communication send eligibility, while backlog belongs to lifecycle/review state.

## Findings

1. Visible "Ready to Send" is not backend send eligibility.
   - `deriveSendEligibility` only checks whether `Email_Next_Action_Date` is a future date (`AdminUI.html:6565`).
   - Backend send/preview can still block on role, bounce, Do Not Contact, invalid email, missing portal secret, portal already submitted, docs/payment message mismatch, production/stabilization flags, and backend cooldown (`Code.js:6855`, `Code.js:8644`).

2. Queue/backlog counts are mixed, not communication-driven.
   - Review queues are portal/doc/payment driven (`Admin.js:3956`).
   - Operational `queueBacklog` is candidate-driven and includes payment-verified rows (`Admin.js:3313`, `Admin.js:3466`).
   - UI communication queues are communication/display driven (`AdminUI_SharedRowFacts.html:57`, `AdminUI_OpsCommunications.html:21`).

3. Cooldown has multiple independent truth sources.
   - `Email_Next_Action_Date` controls UI visible readiness and legacy reminder due logic.
   - Communication cooldown store controls backend applicant-message cooldown.
   - Docs follow-up uses a script-property sent key and a browser-local retry cooldown.
   - These sources can disagree.

4. `recentlyContacted` can suppress UI communication queues indefinitely.
   - `opsBuildRowFacts_` treats any last-contact timestamp or any next-action date as recently contacted (`AdminUI_SharedRowFacts.html:45`).
   - It does not require the next-action date to be in the future.
   - A row may be excluded from "ready" communication queues even after the next action date has passed.

5. Token/portal state can retain rows after communication cooldown expires.
   - `Portal_Submitted` moves rows into docs/payment review flows and backend blocks legacy invite/reminder as already submitted.
   - `Portal_Submitted` also keeps the row a queue candidate (`Admin.js:3313`).
   - Portal secret/access/lock state can block portal URL sends independently of cooldown (`Code.js:4168`, `Code.js:6855`).

6. Document/payment truth is duplicated.
   - Review queues use raw `Docs_Verified` and raw `Payment_Verified` (`Admin.js:3959`, `Admin.js:3962`).
   - Backend lifecycle uses derived document status and receipt-status-derived payment badge plus legacy fields (`Code.js:7291`).
   - UI uses raw rollups plus textual/status-field heuristics (`AdminUI.html:2872`, `AdminUI.html:3178`).

7. Aging is display-only but may be confused with eligibility.
   - Queue aging uses received timestamp selection from portal token/update/adapter/form timestamps (`Admin.js:3236`).
   - It is separate from cooldown, reminder due date, and release rules.

8. Stage batch eligibility can diverge from single-applicant eligibility.
   - Stage batch selection uses cursor state, prior success/failure exclusions, stage group history, and preview cache parity (`Admin.js:5461`, `Admin.js:5635`).
   - Single applicant send uses context resolution and production/send gates (`Code.js:6855`, `Code.js:8644`).

## Simplification Recommendations

1. Establish one canonical communication cooldown field/source.
   - Recommended canonical source: `Email_Next_Action_Date` as the durable sheet-visible next eligible timestamp.
   - Backend cooldown cache should be a performance aid only, and should reconcile from the canonical field before blocking.
   - UI `deriveSendEligibility`, backend `deriveCommunicationState_`, and legacy reminders should read the same canonical value.

2. Define one canonical release rule per operational stage.
   - FD received: release when portal access is issued or portal submitted, whichever is intended.
   - Docs: release when canonical document verification is complete, not raw `Docs_Verified` alone.
   - Awaiting payment: release when canonical payment evidence is present.
   - Payments: release when canonical payment verification is complete.
   - Paid approved: decide whether it is a queue bucket or a terminal completed state; do not count it in backlog if backlog means pending work.

3. Make aging display-only unless explicitly intended as an SLA gate.
   - Keep `pickQueueReceivedInfo_` for display and sort.
   - Do not use received/age timestamps for send eligibility unless a future CIS explicitly adds that rule.

4. Normalize document/payment truth upstream.
   - Use `computeDocVerificationStatus_` as the canonical docs state and align `Docs_Verified` as a compatibility rollup.
   - Use receipt-status-derived `derivePaymentBadge_` / `isPaymentVerifiedDerived_` as canonical payment state and align `Payment_Verified` as a compatibility rollup.
   - Avoid adding repeated null checks at each consumer; normalize row facts once.

5. Split "recently contacted" from "cooldown active."
   - `recentlyContacted` should display last contact evidence.
   - `cooldownActive` should be true only when the canonical next eligible timestamp is in the future.
   - Past `Email_Next_Action_Date` should not keep rows in a wait/cooldown queue.

6. Add explicit backlog semantics.
   - If backlog means pending operator work, exclude paid-approved/completed/enrolled rows.
   - If backlog means all active applicant records, rename the metric so operators do not expect release after send/payment completion.

## Risk Rating

High operational ambiguity:
- Operators can see "Ready to Send" while backend send remains blocked.
- Rows can remain in backlog after communication cooldown expires because backlog is not communication-driven.
- Raw and derived document/payment states can disagree across review queues, lifecycle, send eligibility, and UI row facts.

Low implementation risk for this CIS:
- This was a read-only audit except for the report file.
- No runtime source files were edited.
- No sheet writes, sends, deployment actions, Apps Script versions, commits, or tags were performed.

## Proposed Next CIS

Proposed CIS: r215 Canonical Queue/Cooldown Normalization

Track: Track H, because it would change backend eligibility and queue behavior.

Recommended scope:
- Choose canonical document state and payment state.
- Choose canonical communication cooldown field.
- Update `deriveCommunicationState_`, `deriveSendEligibility`, legacy reminder eligibility, and UI row facts to use the same cooldown source.
- Update `admin_getReviewQueues` and dashboard metrics to use canonical document/payment states.
- Define whether `paidApproved` is a terminal archive/completed bucket or an active queue.
- Add read-only acceptance checks for Admin whoami, Student whoami, review queue counts, single applicant preview blocking, and a no-send browser verification path before any runtime release.
