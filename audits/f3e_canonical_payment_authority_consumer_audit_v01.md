# F3E Canonical Payment Authority Consumer Audit

## Executive Result

PASS_WITH_WARNINGS.

Repository-wide search confirms F3D fixed the main review-queue drift, but canonical payment authority migration is not complete. Several remaining runtime consumers still allow raw `Payment_Verified` to influence business decisions outside `admin_getReviewQueues()`.

Answer to the audit question:

Yes. Raw `Payment_Verified` still influences business decisions in operational pipeline derivation, actionability, communications/lifecycle, CRM stage derivation, OPS lifecycle/classroom surfaces, and some AdminUI client-side fallback logic.

No runtime files were edited in this audit.

## Repository Search Summary

Search terms:

- `Payment_Verified`
- `Payment_Verified_Raw`
- `derivePaymentBadge_`
- `isPaymentVerifiedDerived_`
- `Receipt_Status`
- `paymentBadge`
- `paymentVerified`
- `paymentVerifiedRaw`

Runtime/source files with active hits:

| File | Count | Summary |
| --- | ---: | --- |
| `Admin.js` | 95 | Canonical payment writes/projections, queue classification, dashboard/pipeline, OPS/classroom, actionability. |
| `Code.js` | 49 | Canonical payment helpers, CRM/lifecycle/communication stage logic, compatibility projections. |
| `AdminUI.html` | 41 | Operator display, OPS display/filter logic, modal lock fallback logic. |
| `Config.js` | 2 | Document field mapping and compatibility schema constant. |
| `tools/fode-dr-manifest.ps1` | 1 | Manifest metadata only. |

Tests, docs, and audits also contain references. Those are historical/proof artifacts unless explicitly listed below.

## Consumer Inventory

| Classification | File / function or area | Evidence | Decision |
| --- | --- | --- | --- |
| Canonical authority | `Code.js:isPaymentVerifiedDerived_()` | derives from `derivePaymentBadge_()` and logs raw compatibility only | KEEP |
| Canonical authority | `Code.js:derivePaymentBadge_()` | derives payment from `Receipt_Status` | KEEP |
| Compatibility projection | `Code.js:derivePaymentVerified_()` | aligns `Payment_Verified` when present on row object | KEEP |
| Compatibility projection | `Code.js:computeOverallStatus_()` | aligns raw field from derived state | KEEP |
| Canonical authority | `Admin.js:admin_updateDocStatuses_impl_()` | uses `derivePaymentBadge_(refreshedRow)` and does not write `Receipt_Status` | KEEP |
| Canonical authority | `Admin.js:admin_setPaymentVerified_impl_()` | writes `Receipt_Status = "Verified"` and projects compatibility | KEEP |
| Queue logic | `Admin.js:admin_getReviewQueues()` | F3D now uses `paymentBadge = derivePaymentBadge_(rowObj)` and `paymentVerified = paymentBadge === "Verified"` | KEEP |
| Debug/diagnostic | `Admin.js:admin_getReviewQueues()` | exposes `Payment_Verified_Raw` and logs raw row value | KEEP |
| Needs migration | `Admin.js:isQueueCandidateRow_()` | candidate inclusion uses `clean_(row.Payment_Verified) === "Yes"` | MIGRATE |
| Needs migration | `Admin.js:deriveOperationalPipelineStage_()` | raw payment can classify row as `Enrolled` | MIGRATE |
| Needs migration | `Admin.js:deriveApplicantActionability_()` | uses `isYes_(row.Payment_Verified)` and source label still says `Payment_Verified/Fee_Receipt_File row facts` | MIGRATE |
| Needs migration | `Admin.js:adminOpsLifecycleStageKeyFromRow_()` | raw `Payment_Verified`, `Payment_Verified_Bool`, and `paymentVerified` can force `VERIFIED` payment state | MIGRATE |
| Needs migration | `Admin.js:buildOpsClassroomHandoverContext_()` | classroom readiness uses raw/boolean payment fields | MIGRATE |
| Needs migration | `Admin.js:admin_getApplicantDetail()` | calculates `Payment_Verified_Bool`, `paymentVerified`, and `isPaymentVerified` from raw `Payment_Verified` despite also computing `Payment_Badge` | MIGRATE |
| Compatibility projection | `Admin.js:resolveStatusCols_()` | maps compatibility column `Payment_Verified` | KEEP |
| Compatibility projection | `Admin.js:runVerificationAutomations_()` | transition detection uses raw or derived; acceptable but should eventually simplify | KEEP_WITH_REVIEW |
| Needs migration | `Code.js:deriveFodeCrmStageFromRow_()` | raw `Payment_Verified` OR canonical badge can drive CRM payment/admission stage | MIGRATE |
| Needs migration | `Code.js:communicationPaymentOutstanding_()` | raw `Payment_Verified` can mark payment resolved | MIGRATE |
| Needs migration | `Code.js:buildBaseApplicantCommunicationState_()` / related state | `paymentVerified` uses canonical OR raw | MIGRATE |
| Needs migration | `Code.js:deriveApplicantLifecycleStage_()` | raw `Payment_Verified` OR canonical badge can mark `COMPLETE` | MIGRATE |
| Needs migration | legacy lifecycle helpers around `Code.js:6012-6105` | payment status labels and docs follow-up eligibility use raw payment fields | MIGRATE_OR_RETIRE |
| UI display | `AdminUI.html:paymentBadgeFromRow_()` and queue rendering | uses server-provided facts; acceptable when facts are canonical | KEEP_WITH_SERVER_FIX |
| Needs migration | `AdminUI.html:opsPaymentEvidenceStatus_()` | raw fields can display `Payment verified` | MIGRATE |
| Needs migration | `AdminUI.html:opsClassroomStateFromRawRow_()` | raw/boolean payment fields can force `enrolment_ready` | MIGRATE |
| Needs migration | `AdminUI.html:isApplicantPendingDocsOrPayment_()` | raw payment fields can make applicant appear not pending | MIGRATE |
| UI display | `AdminUI.html:review modal payment display` | prefers `Payment_Badge`, then falls back to raw booleans | KEEP_WITH_FALLBACK_REVIEW |
| UI display | `AdminUI.html:receipt document card helper` | states `Receipt_Status` is canonical and `Payment_Verified` is compatibility-only | KEEP |
| Zoho integration | `Admin.js:admin_previewZohoBooksFodePayload()` | uses derived preview/readiness functions, not directly raw in visible snippet | KEEP_WITH_REVIEW |
| Report/export | `Admin.js:admin_getApplicantDetail_json()` / search table | output includes payment display fields | KEEP_WITH_SERVER_FIX |
| Legacy compatibility | `Config.js:SCHEMA.PAYMENT_VERIFIED` | compatibility schema constant | KEEP |
| Legacy compatibility | docs/audits/stabilization references | historical records and prior findings | KEEP_REFERENCE |
| Debug/diagnostic | tests/audits F3B-F3D | proof and regression documentation | KEEP_REFERENCE |
| DR metadata | `tools/fode-dr-manifest.ps1` | document field mapping only | KEEP |

## Canonical Consumers

The following are already canonical and should be protected:

- `Code.js:derivePaymentBadge_()`
- `Code.js:isPaymentVerifiedDerived_()`
- `Code.js:isPaymentFreezeActive_()`
- `Admin.js:admin_getReviewQueues()` after F3D
- `Admin.js:admin_updateDocStatuses_impl_()` payment display/projection
- `Admin.js:admin_setPaymentVerified_impl_()` canonical payment write
- `Admin.js:admin_setPortalAccess()` payment lock guard via `derivePaymentBadge_()`

## Compatibility-Only Consumers

Legitimate compatibility uses:

- `Payment_Verified` column resolver in `resolveStatusCols_()`
- compatibility projection writes after canonical payment status changes
- `Payment_Verified_Raw` queue item/debug field after F3D
- tests and audits proving compatibility behavior
- config/schema declarations for legacy compatibility

These should remain only as mirrors, diagnostics, or exports. They must not become independent business authority.

## Migration Candidates

| File | Function / area | Current behavior | Recommended behavior | Risk | Confidence |
| --- | --- | --- | --- | --- | --- |
| `Admin.js` | `isQueueCandidateRow_()` | raw `Payment_Verified` keeps row in candidate set | derive from `derivePaymentBadge_()` | Low/Medium: candidate inclusion only, but still business filtering | High |
| `Admin.js` | `deriveOperationalPipelineStage_()` | raw payment can classify as `Enrolled` | canonical badge only; classroom/enrolment should not rely on raw payment | Medium: dashboard/pipeline label drift | High |
| `Admin.js` | `deriveApplicantActionability_()` | actionability payment state uses raw field | canonical badge plus receipt evidence | High: advisory next action can be wrong | High |
| `Admin.js` | `adminOpsLifecycleStageKeyFromRow_()` | raw/boolean payment fields force verified payment state | canonical receipt status, optionally `Payment_Badge` only if server-derived | High: OPS/classroom readiness can be wrong | High |
| `Admin.js` | `buildOpsClassroomHandoverContext_()` | classroom handover gate can accept raw payment booleans | canonical payment badge only | High: internal handover could be sent early | High |
| `Admin.js` | `admin_getApplicantDetail()` | raw booleans exposed as `paymentVerified` despite `Payment_Badge` | expose booleans from `paymentBadge === "Verified"` | High: AdminUI modal locks/unlocks and display can drift | High |
| `Code.js` | `deriveFodeCrmStageFromRow_()` | raw OR canonical drives CRM payment/admission stages | canonical only; raw as compatibility note only | High: CRM stage can be advanced incorrectly | High |
| `Code.js` | `communicationPaymentOutstanding_()` | raw OR canonical can suppress payment follow-up | canonical only | High: applicant may not receive payment follow-up | High |
| `Code.js` | base communication state | `paymentVerified` uses raw OR canonical | canonical only | High: send eligibility can be wrong | High |
| `Code.js` | `deriveApplicantLifecycleStage_()` | raw OR canonical can mark `COMPLETE` | canonical only | High: lifecycle/stage drift | High |
| `Code.js` | legacy state helper around payment raw fields | raw payment status drives payment labels/follow-up eligibility | canonical helper or retire if obsolete | Medium: depends whether live caller remains | Medium |
| `AdminUI.html` | OPS client payment/classroom helpers | raw fields can show verified/enrolment-ready | consume server-derived `Payment_Badge`/canonical facts only | Medium/High: display and operator guidance drift | High |
| `AdminUI.html` | pending docs/payment helper | raw fields can suppress pending state | server-derived canonical facts | Medium: client-side display/filter drift | Medium |

## Dead References

No dead runtime references were conclusively identified in this audit.

Historical audit/docs references that describe earlier raw `Payment_Verified` behavior are legacy reference material and should not be treated as live authority.

## Remaining Risks

- Raw `Payment_Verified` can still advance or suppress decisions in CRM, communications, actionability, OPS/classroom, and client-side AdminUI display.
- Some AdminUI helpers run client-side against mixed row shapes; if the server does not provide `Payment_Badge`, they fall back to raw booleans.
- Classroom handover is the highest-risk non-queue surface because it can send an internal notification based on readiness.
- CRM stage derivation is high-risk because it can communicate payment/admission state outside the Admin surface.
- Communications are high-risk because raw payment can suppress payment follow-up.

## Recommendation

One more payment fix is required before F4 refactor.

Recommended next CIS:

F3F Canonical Payment Authority Migration for Non-Queue Consumers.

Scope should be narrow and staged:

1. Backend first:
   - `admin_getApplicantDetail()`
   - `deriveOperationalPipelineStage_()`
   - `deriveApplicantActionability_()`
   - `adminOpsLifecycleStageKeyFromRow_()`
   - `buildOpsClassroomHandoverContext_()`
   - `deriveFodeCrmStageFromRow_()`
   - communication base/payment outstanding helpers

2. Client display second:
   - AdminUI should prefer server-derived `Payment_Badge` / canonical booleans and only show raw `Payment_Verified` as compatibility/debug if needed.

3. Tests:
   - raw yes + blank/rejected `Receipt_Status` must not advance CRM, communications, actionability, OPS, classroom, or AdminUI payment-verified facts.
   - `Receipt_Status = Verified` must be sufficient even if raw `Payment_Verified` is blank.

F4 refactor should wait until these migration candidates are fixed or formally accepted.
