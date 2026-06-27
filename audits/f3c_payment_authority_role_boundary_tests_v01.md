# F3C Payment Authority Drift + Role Boundary Tests

## Executive Result

PASS_WITH_WARNINGS.

F3C added targeted tests for the highest-risk gaps left after F3B.1:

- payment authority drift between canonical `Receipt_Status` / derived payment badge and raw `Payment_Verified` compatibility state
- role-boundary invariants for mutation-capable Admin RPCs

No runtime behavior, Apps Script deployment, Sheets, Drive data, production, Student staging, or OPS surface was changed.

## Baseline

- Current HEAD before task: `9ed310d`
- Baseline tag: `baseline/r301-dr-f1-readiness`
- Admin staging reference: `r301 / 301`
- Production: untouched
- Student staging: unchanged
- OPS: frozen

## Tests Added

| Test | Purpose | Result |
| --- | --- | --- |
| `tests/payment-authority-drift.test.js` | Executes payment helper cases and captures current queue compatibility drift behavior. | PASS |
| `tests/admin-role-boundary-matrix.test.js` | Verifies mutation-capable Admin RPCs retain explicit role gates and protected mutation paths. | PASS |

## Payment Authority Findings

Canonical payment authority remains `Receipt_Status` through `derivePaymentBadge_()`:

- `Receipt_Status = "Verified"` derives payment verified.
- `Receipt_Status = "Rejected"` derives payment rejected.
- blank or pending receipt derives payment pending.
- raw `Payment_Verified = "Yes"` is ignored by `derivePaymentBadge_()` when `Receipt_Status` is blank or rejected.

Compatibility projection remains present:

- `computeOverallStatus_()` aligns `Payment_Verified` to derived payment state when that property exists on the row object.
- `admin_updateDocStatuses_impl_()` projects `Payment_Verified` compatibility from `derivePaymentBadge_(refreshedRow)`.
- `admin_updateDocStatuses_impl_()` does not write canonical `Receipt_Status`.

Queue drift risk remains:

- `admin_getReviewQueues()` currently classifies payment stage using raw `Payment_Verified`.
- This means a stale raw compatibility value can influence queue membership even if canonical `Receipt_Status` disagrees.
- F3C preserves and documents this behavior; it does not fix it.

## Payment Cases Covered

| Case | Canonical result | Current queue-risk note |
| --- | --- | --- |
| raw `Payment_Verified = Yes`, blank `Receipt_Status` | derived pending | raw compatibility can still classify as paid in queues |
| `Receipt_Status = Verified`, blank raw `Payment_Verified` | derived verified | compatibility can be repaired by projection paths |
| both verified | derived verified | consistent |
| rejected receipt, raw payment verified | derived rejected | raw queue state can conflict unless compatibility is repaired |
| docs verified + receipt present + payment not verified | payments-to-verify | expected |
| docs verified + payment verified + missing receipt | current paid-approved compatibility state | bug-risk candidate |
| payment-first anomaly | anomaly remains visible | expected |

## Role-Boundary Findings

The role-boundary matrix covers these mutation-capable surfaces:

| Surface | Mutation type | Required gate evidence | Coverage status |
| --- | --- | --- | --- |
| document status save | document status / rollup | `requireDocumentVerifier_`, payment-status role block | Covered |
| payment verification | canonical receipt verification | `isAdmin_`, `requireSuperAdmin_` | Covered |
| Zoho draft invoice | Zoho draft + sheet writeback | `canWriteZohoBooksForAdmin_`, write-enabled assertion | Covered |
| selected applicant send | single applicant email send | `isAdmin_`, `requireOperationsAdmin_`, bulk block | Covered |
| Stage Batch send | batch email send | `isAdmin_`, `requireOperationsAdmin_`, batch-send enable gate | Covered |
| portal reset | portal secret reset | `isAdmin_`, `requireSuperAdmin_` | Covered |
| portal access lock | portal access mutation | `isAdmin_`, `requireSuperAdmin_`, payment-lock guard | Covered |
| classroom notify | internal classroom notification | `isAdmin_`, `requireSuperAdmin_`, confirm required, OPS safe mode | Covered |
| ephemeral communication property cleanup | Script Properties cleanup | `isAdmin_`, `requireSuperAdmin_` | Covered |

Additional send-core assertions cover:

- production-send disable gate
- unresolved placeholder policy
- idempotency key generation
- replay blocking

## Bugs / Suspected Bugs Discovered

1. Payment queue compatibility drift remains the strongest F3D candidate.
   - Current queues rely on raw `Payment_Verified`.
   - Canonical payment helpers rely on `Receipt_Status`.
   - If raw compatibility state is stale or conflicting, queue classification can disagree with canonical payment authority.

2. Classroom notify has strong Super Admin and safe-mode gates, but it uses direct `adminSendEmail_()` inside the RPC.
   - This is not changed by F3C.
   - Future tests should verify whether the same global production-send/stabilization policy expected for other sends also applies here.

## Behavior Preserved vs Bug Suspected

Preserved as current behavior:

- raw `Payment_Verified` remains queue compatibility input
- document-save may sync raw `Payment_Verified` compatibility projection
- `Receipt_Status` remains canonical payment review signal
- Stage Batch and selected-applicant send gates remain distinct

Suspected bug / F3D candidate:

- queue classification should likely derive payment from canonical `Receipt_Status` / `derivePaymentBadge_()` instead of trusting raw `Payment_Verified`.

## Remaining Uncovered Role Surfaces

- Full runtime role execution using mocked `Session` and row state.
- Portal token lifecycle expiry/reuse behavior.
- Zoho test-email path and production-send interaction.
- Classroom notify global send-stabilization behavior.
- Apps Script trigger/manual wrapper authority.
- Raw error leakage from mutation failures.

## Recommendation for F3D

F3D should be a narrow bug-fix/proof CIS:

1. Add failing proof around `admin_getReviewQueues()` payment classification when raw `Payment_Verified` conflicts with `Receipt_Status`.
2. Decide whether queues should use `derivePaymentBadge_()` / `isPaymentVerifiedDerived_()` instead of raw `Payment_Verified`.
3. If approved, patch only queue payment classification and related compatibility projection tests.
4. Do not start broad refactor until the payment authority drift is resolved or explicitly accepted as compatibility behavior.

## Refactor Gate

Refactor remains blocked. F3C improves invariant coverage, but the payment queue drift risk should be resolved or formally accepted before structural F3 refactor begins.
