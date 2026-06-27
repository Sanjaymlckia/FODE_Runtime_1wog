# F3D Payment Queue Authority Drift Fix

## Executive Result

PASS.

F3D fixes the confirmed queue authority drift in `admin_getReviewQueues()`. Payment queue classification now uses canonical payment authority from `Receipt_Status` via `derivePaymentBadge_()` instead of raw `Payment_Verified`.

No Zoho behavior, payment write behavior, document status save behavior, communication behavior, portal behavior, Apps Script deployment, Sheets, Drive data, production, Student staging, or OPS surface was changed.

## Bug Confirmed

Before F3D:

- `derivePaymentBadge_()` treated `Receipt_Status` as canonical payment authority.
- `isPaymentVerifiedDerived_()` derived payment verification from `Receipt_Status`.
- `admin_getReviewQueues()` classified payment queues using raw `Payment_Verified`.
- Stale/conflicting `Payment_Verified` could place applicants into `Payment Verified` or suppress payment work even when `Receipt_Status` was blank or rejected.

## Files Changed

- `Admin.js`
- `tests/payment-authority-matrix.test.js`
- `tests/payment-authority-drift.test.js`
- `audits/f3d_payment_queue_authority_fix_v01.md`

## Behavior Before

| Row state | Previous queue risk |
| --- | --- |
| `Payment_Verified = Yes`, blank `Receipt_Status` | could classify as payment verified |
| `Payment_Verified = Yes`, `Receipt_Status = Rejected` | could classify as payment verified |
| `Receipt_Status = Verified`, blank `Payment_Verified` | could be missed until compatibility projection repaired raw field |

## Behavior After

| Row state | Queue behavior |
| --- | --- |
| `Payment_Verified = Yes`, blank `Receipt_Status` | not payment verified; routes by docs/receipt evidence |
| `Payment_Verified = Yes`, `Receipt_Status = Rejected` | not payment verified; receipt evidence routes to Payments to Verify |
| `Receipt_Status = Verified`, blank `Payment_Verified` | payment verified; routes to Payment Verified |
| docs verified + receipt evidence + no verified payment | Payments to Verify |
| docs verified + no receipt + no verified payment | Awaiting Payment |
| payment verified before document verification | Payment-first anomaly remains visible |

## Implementation Summary

`admin_getReviewQueues()` now:

- retains `paymentVerifiedRaw` only as compatibility/debug evidence
- derives `paymentBadge = derivePaymentBadge_(rowObj)`
- sets `paymentVerified = paymentBadge === "Verified"`
- exposes `Payment_Verified_Raw` and `Payment_Badge` on queue items for transparency
- keeps existing queue formulas otherwise unchanged

## Tests Added / Updated

Updated:

- `tests/payment-authority-matrix.test.js`
- `tests/payment-authority-drift.test.js`

Covered:

- raw `Payment_Verified = Yes` + blank `Receipt_Status` is not payment verified
- raw `Payment_Verified = Yes` + `Receipt_Status = Rejected` is not payment verified
- `Receipt_Status = Verified` + raw blank is payment verified
- docs verified + receipt evidence + no verified payment goes to Payments to Verify
- docs verified + no receipt + no verified payment goes to Awaiting Payment
- document-save does not write `Receipt_Status`
- payment verification does not write `Docs_Verified`
- `Payment_Verified` remains compatibility/projection state

## Protected Surfaces

Touched:

- Review queue classification in `admin_getReviewQueues()` only.

Not touched:

- Zoho Books write/preview behavior
- `admin_setPaymentVerified_impl_()`
- `admin_updateDocStatuses_impl_()` payment/document write behavior
- document gallery / preview / lightbox
- communications registry, selected send, and Stage Batch
- portal access/token behavior
- production, Student staging, OPS

## Rollback Path

Rollback source:

- revert this commit, or restore `admin_getReviewQueues()` payment classification to the pre-F3D raw `Payment_Verified` behavior.

Operational rollback if deployed later:

- repin Admin staging to the previous accepted Apps Script version.

## Remaining Payment / Zoho Risks

- Zoho draft/test/live-write gates were not modified or exhaustively retested beyond existing semantic and role-boundary tests.
- Payment compatibility projection still exists for legacy/status display. This is acceptable only if downstream consumers treat `Receipt_Status` / `derivePaymentBadge_()` as canonical authority.
- Classroom/Zoho downstream references to raw `Payment_Verified` remain separate future audit candidates before broad refactor.

## Refactor Gate

F3 refactor may proceed only after this fix is reviewed and accepted. Recommended next step is a small F3E review to identify any remaining raw `Payment_Verified` consumers that should be documented as compatibility-only or migrated to canonical payment authority.
