# F4A Payment Authority Consolidation Refactor

## Executive Result

PASS_WITH_WARNINGS.

F4A consolidated canonical payment authority helper usage without changing runtime behavior.

Canonical authority remains:

- `Receipt_Status`
- `derivePaymentBadge_()`
- `isPaymentVerifiedDerived_()`

Raw `Payment_Verified` remains compatibility/debug/display/projection only.

## Files Changed

- `Code.js`
- `Admin.js`
- `AdminUI.html`
- `AdminUI_SharedRowFacts.html`
- `tests/payment-authority-drift.test.js`
- `tests/payment-authority-matrix.test.js`
- `tests/payment-authority-nonqueue-consumers.test.js`
- `audits/f4a_payment_authority_consolidation_refactor_v01.md`

## Refactor Summary

Added backend canonical helper wrappers:

- `deriveCanonicalPaymentState_(row)`
- `canonicalPaymentBadge_(row)`
- `isCanonicalPaymentVerified_(row)`
- `isCanonicalPaymentRejected_(row)`

Added/used client row-facts helper:

- `operationalStateCanonicalPaymentVerified_(row)`

Added selected-applicant detail helper:

- `detailCanonicalPaymentVerified_(detail)`

These helpers centralize repeated payment badge/verified predicates while preserving `derivePaymentBadge_()` as the canonical `Receipt_Status` interpreter.

## Behaviour Preserved

Preserved:

- `Receipt_Status = Verified` remains payment-complete authority.
- `Receipt_Status = Rejected` or blank blocks payment-complete classification even when raw `Payment_Verified = Yes`.
- `Payment_Verified` compatibility projection still follows canonical receipt status in existing write paths.
- Queue behavior from F3D is preserved.
- Non-queue migration behavior from F3F is preserved.
- Document status save behavior is unchanged.
- Payment verification write behavior is unchanged.
- Zoho write/test/draft behavior is unchanged.
- Communication template/send behavior is unchanged.
- Stage Batch mappings are unchanged.
- Portal/security behavior is unchanged.

## Helper Inventory Before

Payment authority was spread across repeated direct checks:

- `derivePaymentBadge_(row) === "Verified"`
- `paymentBadge === "Verified"`
- direct client-side receipt-status regex checks
- selected-applicant `Payment_Badge` / `paymentVerified` fallback expressions

Raw `Payment_Verified` was already migrated out of business decisions by F3D/F3F but remained visible in compatibility/debug/display fields.

## Helper Inventory After

Backend canonical reads now prefer:

- `canonicalPaymentBadge_(row)`
- `isCanonicalPaymentVerified_(row)`
- `isCanonicalPaymentRejected_(row)`

Client/row-facts canonical reads now prefer:

- `operationalStateCanonicalPaymentVerified_(row)`
- `detailCanonicalPaymentVerified_(detail)`

`derivePaymentBadge_(row)` remains the low-level authority interpreter for `Receipt_Status`.

`isPaymentVerifiedDerived_(row)` remains the compatibility/logging-aware derived payment check used by existing lock/projection paths.

## Raw Payment_Verified Remaining References

Remaining raw references are classified as:

- compatibility projection writes
- `Payment_Verified_Raw` evidence
- `Payment_Verified_At` timestamp display/evidence
- raw export/report pass-through
- documentation/copy identifying `Payment_Verified` as compatibility-only

No reviewed business-decision predicate uses raw `Payment_Verified`.

## Tests Run

Required F4A validation:

- `node --check Code.js`
- `node --check Admin.js`
- `node --check Routes.js`
- `node --check Utils.js`
- `node tests/payment-authority-matrix.test.js`
- `node tests/payment-authority-drift.test.js`
- `node tests/payment-authority-nonqueue-consumers.test.js`
- `node tests/admin-role-boundary-matrix.test.js`
- `node tests/admin-ui-rpc-contract.test.js`
- `node tests/admin-review-queue-rollup-consistency.test.js`
- `node tests/admin-document-status-save-persistence.test.js`
- `node tests/communication-send-gate-matrix.test.js`
- `node tests/communication-semantic-registry.test.js`
- `git diff --check`

Additional recovery note:

- The Windows sandbox runner intermittently failed with `CreateProcessAsUserW failed: 1312`.
- The task recovered by retrying simplified commands, then running mandatory Node validation through the controlled escalated process path after repeated sandbox failure.
- No external drives, deployment commands, Apps Script pushes, Sheet edits, Drive edits, production, Student, or OPS actions occurred.

## Discovered Risks

- Some tests are regex/static-contract oriented because the Apps Script runtime is difficult to execute fully under Node. This remains acceptable for helper-location and authority-boundary invariants, but future F4 slices should continue adding executable tests where practical.
- `Payment_Verified` still exists as a compatibility projection and must remain clearly labelled to prevent future authority drift.

## Rollback Path

Revert the F4A commit to return to the F3F accepted source baseline:

- `3aa3777 fix: migrate nonqueue payment authority consumers`

No deployment rollback is required because F4A performs no Apps Script push, version creation, or staging repin.

## F4B Recommendation

F4B may proceed after review if this GitHub diff is accepted.

Recommended F4B direction:

- continue small-slice consolidation around one authority surface at a time
- avoid broad refactors that mix payment, document, communication, and portal state
- preserve the canonical payment invariant in all future helper extraction
