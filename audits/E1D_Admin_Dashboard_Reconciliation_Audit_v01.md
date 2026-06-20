# E1D Admin Dashboard Reconciliation Audit v01

Status: Discovery only  
Baseline: Admin staging `r276 / 276`

## Scope

This audit checks whether the current opening-surface metrics and review-queue counts accurately represent current sheet-derived reality.

Inspected sources:

- [AdminUI.html](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html)
- [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js)
- [Config.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Config.js)
- [Routes.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Routes.js)
- [docs/architecture/Authority_Model.md](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/docs/architecture/Authority_Model.md)
- [docs/architecture/Queue_Model.md](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/docs/architecture/Queue_Model.md)

## Authority Summary

- Dashboard metrics are derived in `buildOperationalDashboardMetrics_()` from the current working sheet via `openDataSheet_()`.
- Review queue counts are derived in `admin_getReviewQueues()` from the current working sheet via `openDataSheet_()`.
- Queue visibility is not send authority.
- Stage Batch Preview determines mail eligibility, not queues or dashboard counts.

## Metric Reconciliation Table

| Metric | Authority | Derivation | Overlap Risk | Operator Risk | PASS / FAIL |
|---|---|---|---|---|---|
| Application Received / FD Received | review-queue membership | `isExternalFdIntakeRow_ && !portalSubmitted && !docsReviewVerified && !paymentVerified` | Medium | Medium | PASS |
| Documents to Verify | review-queue membership | `portalSubmitted && requiredDocumentUploadComplete && !docsReviewVerified` | Low | Low | PASS |
| Awaiting Payment | review-queue membership | `docsVerifiedRaw === "Yes" && !paymentVerified && !paymentEvidencePresent` | Medium | Medium | PASS |
| Payments to Verify | review-queue membership | `docsVerifiedRaw === "Yes" && !paymentVerified && paymentEvidencePresent` | Medium | Low | PASS |
| Payment-First Anomalies | review-queue membership | `paymentVerified && !docsReviewVerified` | Low | Low | PASS |
| Enrolled / Confirmed | review-queue membership | `paymentVerified` only | High | High | FAIL |
| Awaiting Documents | dashboard metric | `portalSubmitted && !docsReviewVerified && !requiredDocumentUploadComplete` | Low | Low | PASS |
| Ready For Review | dashboard metric | `portalSubmitted && requiredDocumentUploadComplete && !docsReviewVerified` | Low | Low | PASS |
| Payment Pending Snapshot | dashboard metric | `pipeline === "Payment Pending"` from `deriveOperationalPipelineStage_()` | High | High | FAIL |
| Summary: Payment Pending | compatibility summary metric | same `pipeline === "Payment Pending"` count | High | High | FAIL |
| Email Failures | dashboard metric | `emailStatus === FAILED/BOUNCED || lastResult === FAILED` | Medium | Medium | PASS |
| WhatsApp Fallback Queue | dashboard metric | `isWhatsAppFallbackCandidate_ || emailStatus === FALLBACK_PENDING` | Medium | Medium | PASS |
| Duplicate Risk | dashboard metric | duplicate signature counts over applicantId / parentContact / studentDob / portalToken | Low | Medium | PASS |
| Row-Logged Activity Today | dashboard metric | `Email_Last_Sent_At || Last_Contacted_At` same-local-date | High | High | FAIL |
| Email Rows Sent Today | dashboard metric | `Email_Last_Sent_At` same-local-date | Medium | Medium | PASS |
| SEND_ATTEMPT | email state metric | `normalizeEmailStatus_(Email_Status)` bucket | Medium | Medium | PASS |
| SENT | email state metric | `normalizeEmailStatus_(Email_Status)` bucket | Medium | Medium | PASS |
| FAILED | email state metric | status bucket plus additional increment when `Last_Contact_Result === FAILED` | High | High | FAIL |
| BOUNCED | email state metric | `normalizeEmailStatus_(Email_Status)` bucket | Medium | Medium | PASS |
| SUPPRESSED | email state metric | status bucket plus additional increment when `Last_Contact_Result === SUPPRESSED` | High | High | FAIL |
| FALLBACK_PENDING | email state metric | `normalizeEmailStatus_(Email_Status)` bucket | Medium | Medium | PASS |
| Forms Received Today | dashboard metric | same-local-date on `Timestamp || timestamp || adapter_timestamp || Created_At || PortalTokenIssuedAt` | Medium | Medium | PASS |
| Open Lifecycle Rows | lifecycle summary | `deriveApplicantLifecycleStage_(row) !== COMPLETE` | Low | Low | PASS |
| Queue Backlog | dashboard metric | `isQueueCandidateRow_(rowObj)` | Medium | Medium | PASS |
| Lifecycle drill-down buckets | stage aggregation | `deriveApplicantLifecycleStage_()` plus `deriveApplicantActionability_(..., resolveEligibility:false)` | Medium | Medium | PASS |

## Explicit Findings

### Duplicated counts

1. `Payment Pending Snapshot` and `Summary: Payment Pending` are the same conceptual pipeline-family count surfaced twice in different parts of the opening surface.
2. `Row-Logged Activity Today` and `Email Rows Sent Today` are adjacent but represent different timestamp authorities that can be mistaken for one another.

### Contradictory or inflation-prone counts

1. `FAILED` and `SUPPRESSED` in `emailStates` are inflation-prone because the code increments from `Email_Status` and then increments again from `Last_Contact_Result`.
2. `Enrolled / Confirmed` queue is labeled more strongly than its current derivation. The queue currently keys off `paymentVerified`, not classroom handover or confirmed enrollment truth.

### Compatibility-only metrics

1. `Summary: New / Unclassified`
2. `Summary: Contacted`
3. `Summary: Enrolled`
4. `Summary: Closed Lost`
5. `Summary: Payment Pending`

These are current-sheet-derived, but they are still compatibility summaries rather than front-line operational workload truth.

### Metrics no longer clearly useful on the opening surface

1. `Summary: Payment Pending` once `Payment Pending Snapshot` already exists.
2. `Payment Pending Snapshot` itself is lower-confidence than the queue pair:
   - `Awaiting Payment`
   - `Payments to Verify`
3. `Row-Logged Activity Today` as an opening card is weak because it blends contact logging with send evidence.

## Detailed Authority Notes

### Review queue truth quality

Strongest queue-backed truths:

- Documents to Verify
- Awaiting Payment
- Payments to Verify

Weakest queue-backed label:

- Enrolled / Confirmed

Recommendation:

- treat `Enrolled / Confirmed` as needing label/authority review before relying on it as a true enrolled-state queue

### Dashboard truth quality

Strongest current cards:

- Awaiting Documents
- Ready For Review
- Queue Backlog
- Open Lifecycle Rows

Weakest current cards:

- Payment Pending Snapshot
- Summary: Payment Pending
- Row-Logged Activity Today

### Lifecycle drill-down

The lifecycle drill-down is coherent as a stage/actionability aggregation surface, but its `actionable`/`review queue visible` interpretation remains distinct from:

- review queue membership
- Stage Batch mail eligibility

That distinction remains necessary and correct.

## Key Findings

1. The dashboard is largely sourced from current-sheet reality, not archived legacy data.
2. Queue counts for document/payment review are more operationally trustworthy than compatibility summary cards.
3. Payment-related summary cards are duplicative and less clear than queue-backed review/payment workload.
4. Communication counters mix activity, send evidence, and status buckets in ways that are not cleanly operator-trustworthy.
5. `FAILED` and `SUPPRESSED` counters need later authority review because the current derivation can double-count.
6. `Enrolled / Confirmed` is label-risky because the current derivation is payment verification, not full enrolled/classroom confirmation.

## Recommended Next Slice

Recommended next slice from this report:

- `E1D.1 metric/label reconciliation`

Scope should likely be:

- label/placement cleanup first
- then selective metric retirement/demotion
- no authority changes unless separately approved

Highest-priority candidates:

1. Reconcile or retire `Payment Pending Snapshot` vs `Summary: Payment Pending`
2. Review `Enrolled / Confirmed` label against actual queue truth
3. Reconcile communication counters, especially `FAILED` and `SUPPRESSED`

## Risk Assessment

- Low risk: demoting compatibility-only metrics
- Medium risk: relabeling queue cards without first confirming operator expectations
- Medium risk: changing communication counters without explicit authority review

## Confirmation

- No runtime files edited
- No tests edited
- No deployment
- No version
- No repin
- No commit
- No send
- No Sheet edit
- No Drive edit
