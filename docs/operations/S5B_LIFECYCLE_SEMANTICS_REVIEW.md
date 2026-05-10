# S5B Lifecycle Semantics Review

Date: 2026-05-10
Scope: operational semantics refinement only

## Purpose

- Refine lifecycle semantics before any implementation work.
- Reduce ambiguity between operational states.
- Align lifecycle concepts across FODE, KIA, and MLC.
- Prevent premature state-engine coding drift.

## Core Semantic Rule

- State semantics must stabilize before automation or state-engine implementation.

## Canonical Meaning Set

### NEW

- A row or application has been created and is not yet operationally triaged.
- No review outcome should be inferred.

### INCOMPLETE

- Required intake elements are missing or unusable.
- This is a recoverable state, not a rejection.

### REVIEW_REQUIRED

- The application is complete enough to inspect, but has not yet received a final human review outcome.
- Use this when an operator must inspect identity, completeness, or document quality.

### LOW_QUALITY_DOCS

- Documents exist, but one or more are not acceptable for verification.
- This is a review outcome, not a final refusal.

### PAYMENT_PENDING

- Intake review can proceed, but fee evidence or verified payment is still outstanding.

### PAYMENT_RECEIVED

- Payment evidence has been submitted or observed.
- This is receipt of evidence, not a verified payment decision.

### PAYMENT_VERIFIED

- An authorized Admin has confirmed the payment.
- This is the authoritative payment decision and may unlock downstream eligibility.

### ELIGIBLE_FOR_ENROLMENT

- The applicant satisfies intake, document, and payment conditions for enrolment processing.
- This is an eligibility outcome, not portal activation and not final enrolment.

### PORTAL_ACTIVE

- Portal access has been enabled.
- This is an access outcome, not enrolment.

### ENROLLED

- The applicant has been formally enrolled.
- This is the final operational outcome for the intake-to-enrolment path.

### REJECTED

- The application has been denied after review or policy failure.

### WITHDRAWN

- The applicant or operator has ended the application voluntarily.

### FRAUD_REVIEW

- The application contains suspicious, inconsistent, or potentially fraudulent evidence and requires manual escalation.

## Required Distinctions

### Received vs reviewed vs verified vs approved vs activated vs enrolled

- `received` means evidence entered the workflow.
- `reviewed` means a human or approved review process inspected the record.
- `verified` means a canonical authority confirmed the relevant claim.
- `approved` is a decision outcome, not a lifecycle primitive; it may be recorded as a review result or operator action, but it should not replace canonical states.
- `activated` means access was enabled, usually portal access.
- `enrolled` means the applicant has reached the final enrolment outcome.

## Distinct Non-Equivalences

- `PAYMENT_RECEIVED` ≠ `PAYMENT_VERIFIED`
- `ELIGIBLE_FOR_ENROLMENT` ≠ `PORTAL_ACTIVE`
- `PORTAL_ACTIVE` ≠ `ENROLLED`

## Shared States

- `NEW`
- `INCOMPLETE`
- `REVIEW_REQUIRED`
- `LOW_QUALITY_DOCS`
- `PAYMENT_PENDING`
- `PAYMENT_RECEIVED`
- `PAYMENT_VERIFIED`
- `ELIGIBLE_FOR_ENROLMENT`
- `PORTAL_ACTIVE`
- `ENROLLED`
- `REJECTED`
- `WITHDRAWN`
- `FRAUD_REVIEW`

These are shared canonical states for all products, even when product overlays differ in policy or sequence.

## Optional States and Non-State Concepts

- `APPROVED` is optional as a human-readable verdict or review outcome, but it should not replace the canonical lifecycle states.
- `REVIEWED` is better treated as an event or audit marker than a canonical terminal state.
- `ACTIVATED` is best treated as an access event or portal state, not a broad lifecycle replacement.
- `VERIFIED` should always name what is being verified in implementation notes, because verification may apply to payment, documents, identity, or eligibility.

## Product Applicability Review

| State | FODE | KIA | MLC | Notes |
| --- | --- | --- | --- | --- |
| NEW | Yes | Yes | Yes | Shared intake starting point. |
| INCOMPLETE | Yes | Yes | Yes | Shared recovery state. |
| REVIEW_REQUIRED | Yes | Yes | Yes | Shared human review gate. |
| LOW_QUALITY_DOCS | Yes | Yes | Yes | Shared document quality result. |
| PAYMENT_PENDING | Yes | Yes | Yes | Shared fee-status holding state. |
| PAYMENT_RECEIVED | Yes | Yes | Yes | Shared evidence-received state. |
| PAYMENT_VERIFIED | Yes | Yes | Yes | Shared Admin authority state. |
| ELIGIBLE_FOR_ENROLMENT | Yes | Yes | Yes | Shared eligibility outcome. |
| PORTAL_ACTIVE | Yes | Yes | Maybe | FODE uses portal semantics most directly; other products may use analogous access states. |
| ENROLLED | Yes | Yes | Yes | Shared final outcome. |
| REJECTED | Yes | Yes | Yes | Shared negative outcome. |
| WITHDRAWN | Yes | Yes | Yes | Shared voluntary exit. |
| FRAUD_REVIEW | Yes | Yes | Yes | Shared escalation state. |

## Shared Primitives vs Product Overlays

### Shared operational primitives

- Intake completeness checks
- Document review workflow
- Payment evidence receipt
- Admin payment verification
- Eligibility evaluation
- Audit/event logging
- Manual review escalation
- Withdrawal and rejection handling

### Product-specific overlays

- FODE distance education policy and portal workflow
- KIA school-specific policy and school workflow
- MLC DHERST/TVET policy and institution workflow

## Unresolved Semantic Tensions

- `APPROVED` can be interpreted as a state by some operators, but the canonical lifecycle is cleaner when approval is represented as an outcome that leads into `ELIGIBLE_FOR_ENROLMENT` or a product overlay decision.
- `PORTAL_ACTIVE` may be product-specific in downstream systems, but the canonical meaning should remain access granted, not enrolment.
- `REVIEW_REQUIRED` can overlap with incomplete, low-quality, or fraud-suspect scenarios; product overlays should pick a consistent routing rule rather than invent new states.
- `PAYMENT_RECEIVED` may be observed before documents are complete; this should not imply eligibility or activation.

## Implementation Cautions

- Do not encode these semantics directly into a state engine yet.
- Do not collapse `PAYMENT_RECEIVED` and `PAYMENT_VERIFIED`.
- Do not collapse `ELIGIBLE_FOR_ENROLMENT`, `PORTAL_ACTIVE`, and `ENROLLED`.
- Do not let product overlays redefine the canonical shared states.
- Keep CRM quarantined; no legacy CRM field should become the semantic authority.
- Preserve observability and operator override paths for any future automation.

