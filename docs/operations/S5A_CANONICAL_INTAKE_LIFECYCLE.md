# S5A Canonical Intake Lifecycle

Date: 2026-05-09
Scope: documentation-only operational model

## Canonical Rules

- Sheet is the canonical intake authority.
- Drive is the canonical document authority.
- Admin verification is the canonical payment verification authority.
- Books is the canonical finance authority.
- CRM is a quarantined compatibility layer only.
- No unattended outbound email by default.
- No hidden automation.
- All outbound actions are logged.
- All future automation must be rollback-safe and manually overridable.

## Lifecycle States

### NEW

- Fresh intake row exists but has not yet reached operational review.
- Minimum completeness may still be missing.

### INCOMPLETE

- Required intake fields or files are missing.
- Applicant may be recoverable through reminder or re-upload.

### REVIEW_REQUIRED

- Intake is present, but an operator must inspect identity, completeness, or document quality.

### LOW_QUALITY_DOCS

- Required files exist, but one or more are unreadable, cropped, wrong-side, or otherwise insufficient.

### PAYMENT_PENDING

- Intake is pending fee receipt or payment evidence.
- Portal access remains conditional.

### PAYMENT_RECEIVED

- Receipt or payment evidence has been submitted.
- This is not final payment verification.

### PAYMENT_VERIFIED

- Admin has verified the payment.
- This is the only state that may unlock downstream eligibility checks.

### ELIGIBLE_FOR_ENROLMENT

- Intake, document, and payment conditions are satisfied.
- Candidate is eligible for final enrolment processing.

### PORTAL_ACTIVE

- Portal access has been granted for the verified applicant.
- This is an access state, not a finance state.

### ENROLLED

- Applicant has been formally enrolled.

### REJECTED

- Applicant is rejected after review.

### WITHDRAWN

- Applicant or operator has closed the application voluntarily.

### FRAUD_REVIEW

- Application requires manual fraud or misrepresentation review before any further action.

## Canonical Transition Notes

- NEW -> INCOMPLETE when required intake elements are missing.
- NEW -> REVIEW_REQUIRED when intake is present but not yet validated.
- INCOMPLETE -> REVIEW_REQUIRED when missing items are resubmitted.
- REVIEW_REQUIRED -> LOW_QUALITY_DOCS when files are present but unusable.
- REVIEW_REQUIRED -> PAYMENT_PENDING when documents are acceptable but payment is still outstanding.
- PAYMENT_PENDING -> PAYMENT_RECEIVED only when evidence is submitted.
- PAYMENT_RECEIVED -> PAYMENT_VERIFIED only after Admin verification.
- PAYMENT_VERIFIED -> ELIGIBLE_FOR_ENROLMENT only after policy checks pass.
- ELIGIBLE_FOR_ENROLMENT -> PORTAL_ACTIVE when portal access is explicitly granted.
- PORTAL_ACTIVE -> ENROLLED when formal enrolment is completed.
- Any state -> FRAUD_REVIEW when fraud indicators or misrepresentation are credible.
- Any state -> WITHDRAWN when the applicant exits the process.
- Any state -> REJECTED when the applicant does not meet policy requirements or is denied after review.

## Operational Interpretation

- `Receipt_Status` is the canonical payment signal.
- `Payment_Verified` is a compatibility mirror, not the canonical authority.
- `CRM_Invoice_Triggered` is legacy compatibility only.
- No lifecycle state should imply CRM authority.

