# S5A Policy Alignment

Date: 2026-05-09
Scope: intake, finance, and review policy alignment

## Mandatory Policy Topics

- Non-refundable fees
- Fraudulent document handling
- Misrepresentation handling
- Duplicate applicant handling
- Incomplete application handling
- Payment verification requirements
- Conditional portal access
- Exam location requirements
- Minimum intake completeness

## Policy Alignment Notes

### Non-refundable fees

- Fee handling should be documented as non-refundable by default.

### Fraudulent document handling

- Suspected fraud moves the application to `FRAUD_REVIEW`.
- Fraud handling is manual-first and operator-controlled.

### Misrepresentation handling

- Inconsistent identity, school, or payment claims must be escalated.

### Duplicate applicant handling

- Duplicate intake should be flagged before any final enrollment step.

### Incomplete application handling

- Missing fields or files keep the application out of final review.

### Payment verification requirements

- Payment evidence alone is not enough; Admin verification is required.

### Conditional portal access

- Portal access should follow verified eligibility only.

### Exam location requirements

- Exam-site requirements must be met before the application can move to enrolment-ready status.

### Minimum intake completeness

- Core identity, contact, and document requirements must be satisfied before final workflow steps.

## Operational Interpretation

- Policy should be readable as rules the operator can enforce, not hidden automation.
- Policy should not depend on CRM authority.
- Policy should be consistent with the S5A lifecycle states and authority map.

