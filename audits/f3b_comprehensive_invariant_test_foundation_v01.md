# F3B Comprehensive Runtime Invariant Test Foundation

## Executive Result

PASS_WITH_WARNINGS.

F3B added a small set of high-signal invariant tests. The suite intentionally does not chase broad line coverage. It targets contracts that previously caused operational regressions or could silently break protected surfaces.

No runtime source, Apps Script deployment, Sheets, Drive data, production, Student staging, or OPS surface was changed.

## Baseline

- Authority baseline: `baseline/r301-dr-f1-readiness`
- Current pre-task HEAD: `e98a65b docs: add F3A runtime bug-risk audit`
- Admin staging reference: `r301 / 301`
- Production: untouched
- Student staging: unchanged
- OPS: frozen

## Tests Added

| Test | Purpose | Primary protection |
| --- | --- | --- |
| `tests/admin-ui-rpc-contract.test.js` | Parse AdminUI inline scripts after Apps Script template substitution and validate UI RPC names against server functions. | Hydration/parser safety, RPC contract drift, protected Admin RPC visibility. |
| `tests/payment-authority-matrix.test.js` | Lock document/payment authority separation and queue classification invariants. | Document save vs payment authority, `Docs_Verified` rollup, queue gap prevention. |
| `tests/communication-send-gate-matrix.test.js` | Lock selected-applicant, Stage Batch, placeholder, and idempotency send-gate invariants. | Communication authority separation and no accidental batch exposure. |

## Invariants Covered

### AdminUI / RPC / Hydration

- AdminUI script blocks parse after replacing Apps Script templatelets with safe placeholders.
- UI `google.script.run` references resolve to existing server functions.
- Dynamic dispatch is limited to reviewed `fnName` paths and must fail closed.
- Protected Admin RPCs remain present:
  - `admin_getRuntimeInfo`
  - `admin_getReviewQueues`
  - `admin_getApplicantDetail_json`
  - `admin_updateDocStatuses`
  - `admin_getApplicantDocumentManifest`
  - `admin_getApplicantDocumentFileAction`
  - `admin_getApplicantDocumentImageRendition`
  - `admin_previewApplicantMessage`
  - `admin_sendApplicantMessage`
  - `admin_previewStageBatch`
  - `admin_sendStageBatch`
  - `admin_setPaymentVerified`
  - `admin_previewZohoBooksFodePayload`
  - `admin_createZohoBooksFodeDraftInvoice`

### Document / Payment / Queue

- Review queues tolerate computed document verification when raw `Docs_Verified` is stale.
- Documents to Verify excludes document-verified rows.
- Awaiting Payment requires document verification, no raw payment-verified compatibility flag, and no receipt evidence.
- Payments to Verify requires document verification, receipt evidence, and no raw payment-verified compatibility flag.
- Document status save persists `Doc_Verification_Status` and `Docs_Verified` compatibility rollup from computed document state.
- Document status save does not write `Receipt_Status`, preserving payment authority.
- Payment verification requires raw or computed document verification before payment verification.
- Payment verification writes canonical `Receipt_Status = "Verified"` and does not write `Docs_Verified`.

### Communications

- `custom_email` and planned/manual templates remain selected-only and non-batch.
- `docs_missing` and `payment_followup` remain selected-applicant available.
- Stage Batch mappings remain constrained to current mapped message types.
- Stage Batch does not map selected/manual/planned templates.
- Selected send respects stabilization and production-send gates.
- Delivery dispatch preserves idempotency and blocks replay.
- Operational `[ACTION REQUIRED: ...]` placeholders remain send-blocking.
- `custom_email` does not inherit operational placeholder blocking.

## Warnings / Findings

1. Payment queue classification still uses raw `Payment_Verified` compatibility state.
   - Evidence: `admin_getReviewQueues` assigns `paymentVerifiedRaw = clean_(rowObj.Payment_Verified || "") === "Yes"` and uses that value for payment queue classification.
   - Impact: F3C should prove whether raw compatibility state can drift from `Receipt_Status` / derived payment badge and create queue ambiguity.
   - Current test posture: captured as an explicit compatibility dependency, not silently treated as ideal.

2. Document status save syncs raw `Payment_Verified` compatibility state from derived payment badge.
   - Evidence: `admin_updateDocStatuses_impl_` sets `cols.paymentCompat` from `derivePaymentBadge_(refreshedRow)`.
   - Impact: This appears to be compatibility projection, not canonical payment authority. The canonical `Receipt_Status` remains protected from document-save writes.
   - Current test posture: protect `Receipt_Status` authority while documenting the compatibility write.

3. `docs_missing` currently supports batch mode in the semantic registry.
   - Impact: This is current runtime behavior, so F3B does not fail it. Stage Batch mapping remains separately protected from remapping to `docs_missing`.

## Intentionally Not Covered

- Full role matrix for Super Admin, document verifier, operator, and viewer boundaries.
- Portal token lifecycle and parent email correction mutation paths.
- Zoho Books live-write/dry-run matrix beyond protected RPC visibility.
- Drive quota, preview-generation races, and Apps Script timeout behavior.
- Live browser hydration; no deployment occurred in F3B.
- Gmail/Outlook bounce ingestion and contactability marking.
- Full Apps Script trigger assumptions.

## Recommended F3C Sequence

1. Add proof tests around payment authority derivation versus raw `Payment_Verified` compatibility state.
2. Decide whether `admin_getReviewQueues` should use derived payment authority instead of raw compatibility state.
3. Add role-boundary tests for document-save, payment verification, Zoho draft creation, and selected send.
4. Add portal token lifecycle invariants before any portal refactor.
5. Only then begin structural F3 refactor work.

## Refactor Gate

F3 refactor should remain blocked until F3C adds targeted proof around payment compatibility drift and role-boundary invariants. F3B improves regression protection but is not sufficient by itself to justify broad refactor.

## Validation Summary

F3B validation includes the new focused invariant tests plus existing document, gallery, communication, and empty-payload tests. Full command results are reported in the task closure.
