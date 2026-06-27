# F3F Canonical Payment Authority Non-Queue Migration

## Executive Result

PASS_WITH_WARNINGS.

F3F migrated non-queue business-decision consumers away from raw `Payment_Verified` and onto canonical payment authority:

- `Receipt_Status`
- `derivePaymentBadge_()`
- `isPaymentVerifiedDerived_()`

Raw `Payment_Verified` remains only as compatibility/debug/display evidence and projection output.

## Baseline

- Baseline tag: `baseline/r301-dr-f1-readiness`
- Starting HEAD: `dcc2c74`
- Admin staging reference: `r301 / 301`
- Production: untouched
- Student staging: unchanged
- OPS: frozen

## Migration Inventory

### Admin.js

Migrated:

- `admin_getApplicantDetail`
- `isQueueCandidateRow_`
- `deriveOperationalPipelineStage_`
- `buildActionabilityPreviewRow_`
- `adminOpsLifecycleStageKeyFromRow_`
- `buildOpsClassroomHandoverContext_`
- `runVerificationAutomations_` payment-transition detection
- `campaignReportValidApplication_`

Behavior after migration:

- `Payment_Verified_Raw` exposes the raw compatibility field explicitly.
- `Payment_Verified`, `Payment_Verified_Bool`, `paymentVerified`, and `isPaymentVerified` in the selected-applicant DTO follow canonical `Payment_Badge`.
- Classroom handover no longer treats raw `Payment_Verified` as proof of payment authority.
- Actionability and operational pipeline stage use `derivePaymentBadge_()`.

### Code.js

Migrated:

- `deriveFodeCrmStageFromRow_`
- `classifyAdminQueue_`
- `mapAdminQueueRow_`
- `communicationPaymentOutstanding_`
- communication base state payment boolean
- `deriveApplicantLifecycleStage_`

Behavior after migration:

- Raw `Payment_Verified = Yes` with blank or rejected `Receipt_Status` does not produce payment-confirmed CRM stage, lifecycle complete, or payment resolved communication state.
- `Receipt_Status = Verified` with stale/blank raw `Payment_Verified` is treated as canonically payment verified.

### AdminUI.html

Migrated:

- `opsClassroomStateFromRawRow_`
- `opsPaymentEvidenceStatus_`
- OPS ready filter payment predicate
- `applyPortalLockControls_`
- `isApplicantPendingDocsOrPayment_`
- modal payment lock state

Behavior after migration:

- OPS/fallback UI helpers no longer use raw `Payment_Verified` or `Payment_Verified_Bool` as authority.
- UI payment-ready/locked state follows canonical badge/row-facts state.

### AdminUI_SharedRowFacts.html

Migrated:

- `operationalStatePaymentState_`
- `opsBillingRowFacts_`

Reason:

`opsBillingRowFacts_()` is included by `AdminUI.html` and is the actual implementation behind the OPS payment helper target. It was included in scope to avoid leaving the approved AdminUI helper migration incomplete.

## Behavior Before

- Raw `Payment_Verified = Yes` could still influence non-queue lifecycle, CRM stage, actionability, classroom readiness, communication payment outstanding state, and OPS row-facts decisions.
- `Payment_Verified_Bool` could act as a fallback authority in UI/OPS paths.

## Behavior After

- `Receipt_Status = Verified` is the payment-complete authority.
- `Receipt_Status = Rejected` or blank prevents payment-complete classification even when raw `Payment_Verified = Yes`.
- Raw `Payment_Verified` remains visible only as compatibility/debug evidence.
- Payment/Zoho write behavior was not changed.
- Document verification behavior was not changed.
- Communication template text and Stage Batch mappings were not changed.

## Tests Added / Updated

Added:

- `tests/payment-authority-nonqueue-consumers.test.js`

The test proves:

- raw `Payment_Verified = Yes` with blank `Receipt_Status` does not count as canonical payment verified
- raw `Payment_Verified = Yes` with `Receipt_Status = Rejected` does not count as canonical payment verified
- `Receipt_Status = Verified` with raw `Payment_Verified` blank counts as payment verified
- `communicationPaymentOutstanding_()` uses canonical payment state
- applicant lifecycle does not complete from raw `Payment_Verified`
- applicant detail exposes raw payment only as explicit compatibility evidence
- OPS/classroom/UI helper predicates no longer use raw payment compatibility fields as authority

## Remaining Raw Payment_Verified References

Retained as compatibility/debug/display only:

- compatibility projection writes from canonical receipt status
- `Payment_Verified_Raw` evidence in queue/detail DTOs
- `Payment_Verified_At` timestamp display/evidence
- raw export/report pass-through fields
- documentation/copy noting `Payment_Verified` is compatibility-only

No remaining reviewed business-decision consumer depends on raw `Payment_Verified`.

## Protected Surfaces

Touched:

- payment authority read consumers
- OPS/fallback payment predicates
- communication payment-outstanding predicate

Not touched:

- Zoho write behavior
- payment verification write behavior
- document status save behavior
- queue membership logic already fixed in F3D
- communication templates
- Stage Batch mappings
- portal token/security logic
- gallery/lightbox
- production
- Student staging
- OPS data/actions

## Remaining Risks

- Some legacy reports still expose raw `Payment_Verified`; this is acceptable only while labelled/treated as compatibility evidence.
- Apps Script live runtime is not changed until a future approved release; this commit is repository/source migration only.
- Broader F4 refactor should retain `Receipt_Status` as the single payment authority and avoid reintroducing raw compatibility gates.

## Rollback Path

Revert the F3F commit if any non-queue payment behavior regresses. F3D queue authority fix remains the prior accepted canonical queue baseline.

## F4 Recommendation

F4 structural refactor may begin after review if the GitHub diff is accepted. Refactor must preserve these invariants:

- no business decision may use raw `Payment_Verified`
- `Payment_Verified` may only be a compatibility projection/debug/display field
- canonical payment authority remains `Receipt_Status` through `derivePaymentBadge_()` / `isPaymentVerifiedDerived_()`
