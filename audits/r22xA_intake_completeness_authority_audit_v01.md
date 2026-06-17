# r22xA Intake Completeness Authority Audit

## Executive Summary

- The current codebase already contains a strong candidate for canonical intake completeness authority:
  - `adminOpsRequiredDocumentUploadSummary_()` in [Admin.js](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Admin.js)
- However, it is **not yet the global canonical authority** for intake completeness.
- Current lifecycle, dashboard, and queue behavior still depend on other overlapping logic:
  - `computeDocVerificationStatus_()` in [Code.js](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Code.js)
  - `deriveApplicantLifecycleStage_()` in [Code.js](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Code.js)
  - `deriveOperationalPipelineStage_()` in [Admin.js](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Admin.js)
  - `admin_getReviewQueues()` in [Admin.js](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Admin.js)
- The authorities are currently **partially separated but operationally coupled**:
  - completeness = whether required uploads exist
  - review authority = whether reviewed statuses are verified/rejected/pending
  - queue/dashboard behavior mixes the two
- Recommended Phase B direction:
  - adopt `adminOpsRequiredDocumentUploadSummary_()` as canonical completeness authority
  - keep `computeDocVerificationStatus_()` as review authority
  - update lifecycle/dashboard/queue entry points to consume that separation
  - keep OPS untouched

## Files Reviewed

- [Admin.js](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Admin.js)
- [Code.js](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Code.js)
- [AdminUI.html](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\AdminUI.html)
- [AdminUI_SharedRowFacts.html](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\AdminUI_SharedRowFacts.html)

## 1. Mandatory Upload Authority

### Existing candidate authority

- `adminOpsRequiredDocumentUploadSummary_()` at [Admin.js](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Admin.js:4100)

### Exact mandatory upload fields currently encoded

- `Birth_ID_Passport_File`
- `Latest_School_Report_File`
- `Passport_Photo_File`

### Current completeness evaluation logic

The function:

- checks only the three fields above
- counts uploaded vs missing
- returns:
  - `requiredCount`
  - `uploadedRequiredCount`
  - `missingRequiredDocuments`
  - `uploadedRequiredDocuments`
  - `requiredDocumentUploadComplete`

### Assessment

- This is the best current implementation of **document completeness authority**
- It is explicit
- It uses a designated required-field list
- It does **not** assume all upload fields are mandatory

### Limitation

- It is currently used mainly in OPS-related/shared helper paths and queue payload enrichment
- It is **not** yet the single authority consumed by:
  - legacy lifecycle stage derivation
  - legacy dashboard metrics
  - legacy review queue membership

### Recommendation

- Recommend `adminOpsRequiredDocumentUploadSummary_()` as canonical completeness authority for Phase B

## 2. Review Authority Boundary

### Existing review authority function

- `computeDocVerificationStatus_()` at [Code.js](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Code.js:4238)

### Current behavior

It uses resolved document status keys and evaluates required document **status fields**, not upload existence:

- required status set:
  - birth
  - report
  - photo

Output:

- `Rejected` if any required doc status is rejected
- `Verified` if all required doc statuses are verified
- `Pending` otherwise

### What it represents

- This is **document review authority**
- It answers:
  - have reviewed document statuses been verified/rejected?
- It does **not** answer:
  - have all mandatory uploads merely been supplied?

### Separation assessment

- Completeness and review authority are conceptually separate in code
- But they are operationally coupled because downstream lifecycle/queue logic mixes them

### Recommendation

- Keep `computeDocVerificationStatus_()` as canonical review authority
- Do not repurpose it as completeness authority

## 3. Lifecycle Authority Mapping

### Existing lifecycle function

- `deriveApplicantLifecycleStage_()` at [Code.js](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Code.js:7291)

### Current stage set relevant to intake/document readiness

- `INVITE_PENDING`
- `INVITED_AWAITING_RESPONSE`
- `REMINDER_DUE`
- `DOCS_REQUIRED`
- `PROCESSING`
- `PAYMENT_REQUIRED`
- `RECEIPT_AWAITING_VERIFICATION`
- `COMPLETE`

### Current completeness influence

Completeness is **not** directly driven by `requiredDocumentUploadComplete`.

Instead the lifecycle uses:

- `computeDocVerificationStatus_()`
- raw document signal presence:
  - status/file-like signals via `docSignals`
- portal submission state

Current key logic:

- `docsVerified = computeDocVerificationStatus_(row) === "Verified" || Docs_Verified === "Yes"`
- `DOCS_REQUIRED` when:
  - not `docsVerified`
  - and `(docSignals || docStage === "Rejected")`
- `PROCESSING` when:
  - `portalSubmittedActive` or `Email_Status === RESPONDED`

### Review influence

- Strong
- Review status (`Verified` / `Rejected` / `Pending`) directly shapes lifecycle

### Operational dependency

- Any new completeness boundary will affect:
  - stage derivation
  - dashboard drill-down semantics
  - reminder/send stage meaning

### Assessment

- Current lifecycle does **not** cleanly distinguish:
  - submitted but incomplete
  - submitted and ready for review
- It currently prioritizes portal submission and review status more than explicit completeness authority

## 4. Dashboard Authority Mapping

### Existing dashboard function

- `admin_getOperationalDashboardMetrics()` -> `buildOperationalDashboardMetrics_()` at [Admin.js](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Admin.js:3493) / [Admin.js](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Admin.js:3410)

### Current cards relevant to intake completeness

From current logic and UI:

- Forms Received Today
- Open Lifecycle Rows
- legacy pipeline counts such as:
  - `Documents Pending`
  - `Payment Pending`

### Current authority source

Legacy dashboard metrics use:

- `deriveOperationalPipelineStage_()` in [Admin.js](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Admin.js:3361)

That function uses:

- stored legacy stage fields if present
- otherwise:
  - `Portal_Submitted`
  - `Docs_Verified`
  - `Payment_Verified`
  - `Registration_Complete`
  - `Fee_Receipt_File`
  - email/contact heuristics

### Intake completeness relevance

- There is **no canonical completeness calculation** in current dashboard metrics
- `Documents Pending` is currently closer to:
  - portal submitted but not docs-verified
- It is not equivalent to:
  - missing one or more mandatory uploads

### Dashboard impact assessment

Any Phase B completeness split will directly impact:

- document-related intake cards
- workload vs review-ready counts
- interpretation of review workload statistics

## 5. Queue Authority Mapping

### Existing queue function

- `admin_getReviewQueues()` at [Admin.js](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Admin.js:4313)

### Current document-related queue membership rules

Relevant logic:

- `docsQueueMatch = portalSubmitted && !docsVerified`
- `awaitingPaymentQueueMatch = docsVerified && !paymentVerified && !paymentEvidencePresent`
- `paymentsQueueMatch = docsVerified && !paymentVerified && paymentEvidencePresent`

### Current review eligibility behavior

`Documents to Verify` currently means:

- portal submitted
- not docs verified

It does **not** mean:

- all mandatory uploads are present and ready for officer review

### Current completeness eligibility behavior

- Queue membership does not currently use `requiredDocumentUploadComplete`
- Therefore incomplete records can still enter a review-oriented documents queue after portal submission

### Queue impact assessment

This is the direct source of the observed business problem:

- review-oriented queue visibility can include applicants still awaiting uploads

## 6. Current Label / Meaning Mapping

### Current meanings found

- `Documents to Verify`
  - legacy review queue membership based on `portalSubmitted && !docsVerified`
  - not true “ready for review” authority

- `DOCS_REQUIRED`
  - lifecycle/actionability stage from `deriveApplicantLifecycleStage_()`
  - not equal to document review queue

- `Awaiting Uploads / Document Evidence Pending`
  - appears in OPS/shared row-facts layer
  - derived from `adminOpsRequiredDocumentUploadSummary_()` and related helpers
  - this is closer to true completeness authority, but OPS is frozen and must remain untouched

- `Uploaded / Review Required`
  - OPS/shared-row-facts concept for all required uploads present but review still pending
  - conceptually close to the proposed `Ready For Review`

### Important finding

- The conceptual split requested by the CIS already exists **partially** in newer helper logic
- But legacy lifecycle/dashboard/queue authority has not been fully migrated to that split

## 7. OPS Boundary

- OPS is frozen secondary/reference surface
- OPS currently consumes completeness/review concepts via:
  - `adminOpsRequiredDocumentUploadSummary_()`
  - `adminOpsDocumentStateFromRow_()`
  - shared row-facts logic in [AdminUI_SharedRowFacts.html](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\AdminUI_SharedRowFacts.html)
- OPS references are active in code, but must remain untouched in Phase B

### OPS recommendation

- No OPS implementation changes in this initiative
- Legacy Admin only for Phase B

## Canonical Authority Recommendations

### Canonical completeness authority

- **Recommended canonical authority:** `adminOpsRequiredDocumentUploadSummary_()`

Reason:

- explicit mandatory field list
- already separated from review-status logic
- fits the intended “Awaiting Documents vs Ready For Review” split

### Canonical review authority

- **Recommended canonical authority:** `computeDocVerificationStatus_()`

Reason:

- it measures review outcome, not upload completeness
- it should remain the officer verification authority

## Dashboard Impact Assessment

Phase B will likely impact:

- any legacy card or metric currently implying review readiness from portal submission alone
- document-related workload counts
- review-ready vs applicant-action-required split

Recommended principle:

- applicant completeness metrics and officer review metrics must not be conflated

## Queue Impact Assessment

Phase B will likely impact:

- `Documents to Verify` queue membership
- any queue currently using `portalSubmitted && !docsVerified` as a proxy for review readiness

Recommended principle:

- incomplete records stay visible in intake, but excluded from review-ready queue/workload counts

## Recommended Minimal Implementation Scope for Phase B

### Phase B1

- Legacy Admin only
- No OPS changes
- No payment authority changes
- No enrollment changes

### Minimal implementation path

1. Adopt `adminOpsRequiredDocumentUploadSummary_()` as canonical completeness authority
2. Introduce a legacy-admin intake classification split:
   - `Awaiting Documents`
   - `Ready For Review`
3. Keep `computeDocVerificationStatus_()` as document review authority
4. Update queue membership so review-ready queue excludes incomplete records
5. Update dashboard counts to separate:
   - applicant action required
   - officer review required

### Separate later step

- Acknowledgement email advisory should be a separate low-risk follow-up patch after authority alignment is approved

## Recommended Release Sequence

1. `r22xA` audit/design only
2. `r22xB` Track H minimal legacy-admin completeness authority patch
3. `r22xC` acknowledgement email advisory insert
4. optional later dashboard polish only after authority patch is accepted

## Acceptance Statement

This audit identifies:

- canonical completeness authority candidate
- canonical review authority
- exact mandatory upload field set currently encoded
- impacted functions
- impacted dashboard logic
- impacted queue logic
- OPS boundary
- minimal implementation path for Phase B

## Boundary Confirmation

- No runtime files were modified
- No sheets were modified
- No deployments were run
- No commits were made
