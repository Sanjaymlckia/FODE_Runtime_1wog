# r225A Document and Payment Queue Count Authority Audit

## 1. Executive Summary

- `Documents Pending Summary` and `Payment Evidence Queue` are not queue-authoritative metrics. They currently mirror legacy pipeline buckets from `buildOperationalDashboardMetrics_()` in [Admin.js](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:3410).
- `Documents Pending (legacy pipeline)` and `Payment Pending (legacy pipeline)` are the same authority as those two summary cards, not separate calculations.
- `Documents to Verify`, `Awaiting Payment`, and `Payments to Verify` come from `admin_getReviewQueues()` in [Admin.js](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:4313) and are the operator-authoritative review queues.
- `DOCS_REQUIRED` comes from lifecycle/actionability aggregation in `admin_getStageAggregation()` via `stageAggregationSnapshot_()` and shared lifecycle helpers. It measures lifecycle-stage membership, not the legacy docs review queue.
- The conflicting counts are caused by overlapping but different definitions:
  - legacy pipeline bucket
  - lifecycle/actionability stage
  - operator-visible review queue membership
  - evidence existence vs verification outcome
- Recommended `r225B` scope: `mixed label + calculation patch`, low-medium risk.

## 2. Current r224A Dashboard Baseline Values

### Document-related

- `Documents Pending Summary`: `14`
- `Documents Pending (legacy pipeline)`: `14`
- `Documents to Verify` queue: `16`
- `DOCS_REQUIRED` drill-down: `1 total / 1 review queue visible / 0 blocked`

### Payment-related

- `Payment Evidence Queue`: `2`
- `Payment Pending (legacy pipeline)`: `2`
- `Awaiting Payment` queue: `0`
- `Payments to Verify` queue: `0`

## 3. Metric Mapping

| Metric | r224A Value | Source Function(s) | AdminUI Render Path | Key Sheet Fields | Authority Basis | What It Actually Measures | Label Accuracy | Confusion Risk | Recommended Action |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Documents Pending Summary | 14 | `buildOperationalDashboardMetrics_()` -> `deriveOperationalPipelineStage_()` | `opsDocsPending` card at [AdminUI.html](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:1705), rendered by `renderOperationalDashboardMetrics_()` at [AdminUI.html](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:8554) | `Pipeline_Stage`, `Operational_Stage`, `CRM_Stage`, `Stage`, `Portal_Submitted`, `Docs_Verified`, `Payment_Verified`, `Registration_Complete`, `Fee_Receipt_File`, `Email_Status`, `Last_Contact_Result` | legacy pipeline bucket | Rows classified as legacy `Documents Pending`, mainly `Portal_Submitted` and not yet docs-verified/payment-pending by legacy heuristics | No | High | replace calculation or rename/demote |
| Documents Pending (legacy pipeline) | 14 | Same as above | `pipeDocumentsPending` at [AdminUI.html](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:1707), rendered at [AdminUI.html](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:8565) | Same as above | legacy pipeline bucket | Same count as `Documents Pending Summary` | Yes | Medium | keep or demote |
| Documents to Verify queue | 16 | `admin_getReviewQueues()` | `queueDocs` / `renderQueueSection("Documents to Verify", d.docs, counts.docs)` at [AdminUI.html](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:6948) | `ApplicantID`, `Portal_Submitted`, `Docs_Verified`, plus row metadata fields; queue gate is `portalSubmitted && !docsVerified` | operator-visible review queue row count | Rows in the legacy docs review queue, including rows still not docs-verified even if other evidence exists | Yes | Low | keep as operator-authoritative |
| DOCS_REQUIRED drill-down | `1 total / 1 review queue visible / 0 blocked` | `admin_getStageAggregation()` -> `stageAggregationSnapshot_()` -> `deriveApplicantLifecycleStage_()` / `deriveApplicantActionability_()` | stage dashboard cards in `renderStageDashboard_()` at [AdminUI.html](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:6507) | `Docs_Verified`, required document status fields from `computeDocVerificationStatus_()`, required upload signal fields, `Portal_Submitted`, `Email_Status`, `Email_Bounce_Flag`, `Email_Next_Action_Date`, `Fee_Receipt_File`, `Payment_Verified` | lifecycle/actionability state | Rows whose shared lifecycle resolver still treats them as missing document uploads; once portal is submitted, many rows move out of `DOCS_REQUIRED` into processing | Partly | High | clarify helper text |
| Payment Evidence Queue | 2 | `buildOperationalDashboardMetrics_()` -> `deriveOperationalPipelineStage_()` | `opsPaymentPending` card at [AdminUI.html](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:1706), rendered at [AdminUI.html](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:8555) | `Pipeline_Stage`, `Operational_Stage`, `CRM_Stage`, `Stage`, `Docs_Verified`, `Payment_Verified`, `Registration_Complete`, `Fee_Receipt_File`, `Portal_Submitted` | legacy pipeline bucket | Rows in legacy `Payment Pending`, triggered by `docsVerified || receiptPresent` and not payment-verified | No | High | replace calculation or rename |
| Payment Pending (legacy pipeline) | 2 | Same as above | `pipePaymentPending` at [AdminUI.html](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:1708), rendered at [AdminUI.html](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:8566) | Same as above | legacy pipeline bucket | Same count as `Payment Evidence Queue` | Yes | Medium | keep or demote |
| Awaiting Payment queue | 0 | `admin_getReviewQueues()` | `queueAwaitingPayment` / `renderQueueSection("Awaiting Payment", d.awaitingPayment, counts.awaitingPayment)` at [AdminUI.html](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:6949) | `ApplicantID`, `Docs_Verified`, `Payment_Verified`, `Fee_Receipt_File`; queue gate is `docsVerified && !paymentVerified && !paymentEvidencePresent` | operator-visible review queue row count | Docs-verified rows waiting for receipt upload, not rows with receipt evidence already present | Yes | Low | keep as operator-authoritative for missing evidence |
| Payments to Verify queue | 0 | `admin_getReviewQueues()` | `queuePayments` / `renderQueueSection("Payments to Verify", d.payments, counts.payments)` at [AdminUI.html](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:6950) | `ApplicantID`, `Docs_Verified`, `Payment_Verified`, `Fee_Receipt_File`; queue gate is `docsVerified && !paymentVerified && paymentEvidencePresent` | operator-visible review queue row count | Docs-verified rows with receipt evidence uploaded and pending payment verification | Yes | Low | keep as operator-authoritative for receipt review |

## 4. Source Functions Involved

### Legacy pipeline / summary cards

- `buildOperationalDashboardMetrics_()` at [Admin.js](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:3410)
- `deriveOperationalPipelineStage_()` at [Admin.js](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:3361)

Key behavior:

- `out.docsPending++` when `pipeline === "Documents Pending"` at [Admin.js](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:3474)
- `out.paymentPending++` when `pipeline === "Payment Pending"` at [Admin.js](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:3475)
- `pipelineCounts["Documents Pending"]` and `pipelineCounts["Payment Pending"]` are incremented in the same loop at [Admin.js](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:3457)

### Review queues

- `admin_getReviewQueues()` at [Admin.js](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:4313)
- Queue membership rules:
  - `docsQueueMatch = portalSubmitted && !docsVerified` at [Admin.js](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:4452)
  - `awaitingPaymentQueueMatch = docsVerified && !paymentVerified && !paymentEvidencePresent` at [Admin.js](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:4453)
  - `paymentsQueueMatch = docsVerified && !paymentVerified && paymentEvidencePresent` at [Admin.js](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:4454)
- Queue push order:
  - payments first, then awaiting payment, then docs at [Admin.js](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:4566)

### Lifecycle drill-down

- `admin_getStageAggregation()` at [Admin.js](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:4010)
- `stageAggregationSnapshot_()` at [Admin.js](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:3763)
- Shared lifecycle helpers in [Code.js](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Code.js:4238):
  - `computeDocVerificationStatus_()`
  - `deriveApplicantLifecycleStage_()`
  - `deriveApplicantActionability_()`

### OPS-derived document/payment helpers used by queues for metadata

- `adminOpsRequiredDocumentUploadSummary_()` at [Admin.js](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:4100)
- `adminOpsDocumentStateFromRow_()` at [Admin.js](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:4177)
- `adminOpsLifecycleStageKeyFromRow_()` at [Admin.js](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:4195)

## 5. AdminUI Render Paths Involved

- Summary cards:
  - `Documents Pending Summary` -> `opsDocsPending` at [AdminUI.html](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:1705)
  - `Payment Evidence Queue` -> `opsPaymentPending` at [AdminUI.html](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:1706)
- Legacy pipeline cards:
  - `pipeDocumentsPending` at [AdminUI.html](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:1707)
  - `pipePaymentPending` at [AdminUI.html](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:1708)
- Review queues:
  - `Documents to Verify` at [AdminUI.html](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:6948)
  - `Awaiting Payment` at [AdminUI.html](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:6949)
  - `Payments to Verify` at [AdminUI.html](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:6950)
- Lifecycle drill-down:
  - stage cards rendered in `renderStageDashboard_()` at [AdminUI.html](/abs/path/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:6507)

## 6. Sheet Fields Involved

### Legacy pipeline cards

- Primary stored/legacy stage fields:
  - `Pipeline_Stage`
  - `Operational_Stage`
  - `CRM_Stage`
  - `Stage`
- Fallback classification fields:
  - `Portal_Submitted`
  - `Docs_Verified`
  - `Payment_Verified`
  - `Registration_Complete`
  - `Fee_Receipt_File`
  - `Email_Status`
  - `Last_Contact_Result`

### Review queue membership

- Gate fields:
  - `ApplicantID`
  - `Portal_Submitted`
  - `Docs_Verified`
  - `Payment_Verified`
  - `Fee_Receipt_File`
- Supporting metadata fields:
  - required upload files, doc status fields, payment timestamps, invoice fields, contact fields

### Lifecycle drill-down

- Shared lifecycle/actionability fields:
  - `Docs_Verified`
  - `Payment_Verified`
  - `Fee_Receipt_File`
  - required doc status fields used by `computeDocVerificationStatus_()`
  - `Email_Status`
  - `Email_Bounce_Flag`
  - `Email_Next_Action_Date`
  - `Portal_Submitted`
  - communication/contact history fields used by shared lifecycle and actionability helpers

## 7. Why the Counts Conflict

### Q1. Why `Documents Pending Summary = 14` while `Documents to Verify = 16` and `DOCS_REQUIRED = 1`?

- `Documents Pending Summary = 14` is a legacy pipeline bucket:
  - portal submitted
  - not docs-verified
  - not yet pushed into legacy `Payment Pending`
- `Documents to Verify = 16` is the legacy docs review queue:
  - `portalSubmitted && !docsVerified`
  - it does not require lifecycle `DOCS_REQUIRED`
  - it can still include rows where upload evidence exists or newer OPS-derived document state says `uploaded_review_required`
- `DOCS_REQUIRED = 1` is a shared lifecycle stage:
  - it only counts rows whose lifecycle still resolves to missing uploads
  - once a row is portal-submitted or has other processing signals, it often leaves `DOCS_REQUIRED`

Conclusion:

- `Documents Pending Summary` and `Documents to Verify` are different authorities.
- `DOCS_REQUIRED` is not a document review queue count; it is a lifecycle-stage count.

### Q2. Why `Payment Evidence Queue = 2` while `Awaiting Payment = 0` and `Payments to Verify = 0`?

- `Payment Evidence Queue = 2` is a legacy pipeline bucket:
  - `docsVerified || receiptPresent`
  - not payment-verified
- `Awaiting Payment = 0` requires:
  - `docsVerified`
  - no payment verification
  - no payment evidence present
- `Payments to Verify = 0` requires:
  - `docsVerified`
  - no payment verification
  - payment evidence present

This means the two rows in legacy `Payment Pending` are likely being pulled in by broader heuristics:

- receipt evidence exists but `Docs_Verified` raw flag is not `Yes`, or
- another legacy pipeline signal promotes them into payment-pending without satisfying the stricter queue gates

Conclusion:

- `Payment Evidence Queue` is not the same thing as either payment review queue.
- It is a broader legacy bucket and is mislabeled if read as an operator review queue.

## 8. Authority Classification

### Operator-authoritative metrics

- Document day-to-day review work:
  - `Documents to Verify` queue
- Payment evidence review work:
  - `Payments to Verify` queue for uploaded receipt review
  - `Awaiting Payment` queue for missing payment evidence follow-up

### Non-authoritative summary/backlog metrics

- `Documents Pending Summary`
- `Payment Evidence Queue`
- `Documents Pending (legacy pipeline)`
- `Payment Pending (legacy pipeline)`

### Separate lifecycle metrics

- `DOCS_REQUIRED` drill-down is lifecycle-authoritative, not review-queue-authoritative

## 9. Label and Helper-Text Assessment

### Labels that are currently misleading

- `Documents Pending Summary`
  - misleading because it sounds like the main document workload queue
- `Payment Evidence Queue`
  - misleading because it sounds like the payment review queue

### Labels that are acceptable but may need context

- `Documents Pending (legacy pipeline)`
- `Payment Pending (legacy pipeline)`
- `DOCS_REQUIRED`
- `Documents to Verify`
- `Awaiting Payment`
- `Payments to Verify`

### Recommended label/helper-text changes

- Rename or clarify:
  - `Documents Pending Summary` -> `Legacy Documents Pending Summary` or replace with queue-authoritative count
  - `Payment Evidence Queue` -> `Legacy Payment Pending Summary` or replace with queue-authoritative count
- Add helper text:
  - Review queues are operator worklists
  - Lifecycle drill-down is resolver-stage visibility
  - Legacy pipeline cards are not queue-authoritative

## 10. Calculation Change Assessment

### Can this be solved by label/helper text only?

- Partly.
- Labels/helper text would materially reduce confusion.
- They would not remove the underlying duplicate/overlapping authorities.

### Is a future calculation patch justified?

- Yes.
- The two summary cards currently present themselves like operational queues while actually repeating legacy pipeline buckets.

### Can a future patch be done without schema/header changes?

- Yes.
- The current code already has enough data to:
  - keep legacy pipeline cards clearly demoted, or
  - replace the misleading summary cards with queue-authoritative counts using existing queue logic

## 11. Stage Batch Boundary

- No evidence shows these eight metrics are part of Stage Batch send authority.
- Stage Batch preview/send authority is separate from:
  - `buildOperationalDashboardMetrics_()`
  - `admin_getReviewQueues()`
  - `admin_getStageAggregation()`

## 12. Recommended r225B Scope

- Recommended scope: `mixed label + calculation patch`
- Reason:
  - label-only would reduce confusion fast
  - a small calculation change would remove the most misleading duplicate cards

### Suggested r225B direction

1. Keep review queues as operator-authoritative.
2. Keep lifecycle drill-down as lifecycle-authoritative.
3. Either:
   - demote legacy pipeline cards with explicit legacy wording, or
   - replace the two misleading summary cards with queue-authoritative document/payment counts.

### Explicit risk rating for r225B

- `Low-Medium`
- No schema/header changes appear necessary.
- No Stage Batch/send/cooldown/cap/idempotency changes appear necessary.

## 13. Recommendation

- `r225B` should be approved as a scoped dashboard clarification patch.
- Preferred order:
  1. clarify labels/helper text
  2. remove or replace the two misleading summary cards
  3. leave Stage Batch and send authority untouched

## 14. Evidence and Boundary Confirmation

- No runtime files were modified under this audit.
- No sheet changes were made.
- No deployment, versioning, repin, send, commit, or tag occurred.
- No OPS files or Student files were modified.
