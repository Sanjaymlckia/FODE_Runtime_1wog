# S5A Finance Direction

Date: 2026-05-09
Scope: finance authority and policy direction

## Direction

- Books is the canonical finance authority.
- CRM is quarantined and must not resume operational finance authority.
- Finance behavior should be documented first and implemented later only under explicit CIS approval.

## Policy Alignment

- Fees are non-refundable unless a future policy explicitly states otherwise.
- Payment verification requires Admin authority.
- Portal access is conditional on verified payment and intake completeness.
- Exam location requirements must be satisfied before enrolment completion.
- Minimum intake completeness must be enforced before financial finalization.

## Financial States

- Payment Pending: fee evidence not yet verified
- Payment Received: evidence submitted, verification not complete
- Payment Verified: Admin-confirmed payment
- Eligible for Enrolment: payment and intake policy satisfied
- Enrolled: final outcome completed

## Legacy Marker Handling

- `CRM_Invoice_Triggered` remains a compatibility marker only.
- Future finance naming should move toward `Finance_Handoff_Status` or `Books_Invoice_Status`.
- Existing schema must not be renamed in this CIS.

## Guardrails

- Do not implement Books API logic yet.
- Do not re-enable CRM invoice authority.
- Keep future automation rollback-safe and manually overridable.

