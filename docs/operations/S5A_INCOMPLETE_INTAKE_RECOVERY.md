# S5A Incomplete Intake Recovery

Date: 2026-05-09
Scope: recovery process for incomplete or weak intake

## Purpose

- Recover incomplete applications without hidden automation.
- Keep the process manual-first, logged, and rollback-safe.

## Recovery Triggers

- Missing mandatory fields
- Missing required Drive files
- Low-quality files that need replacement
- Conflicting applicant identity information
- Payment evidence received before intake completeness

## Recovery Flow

1. Flag the application as `INCOMPLETE` or `LOW_QUALITY_DOCS`.
2. Log the missing item or quality issue.
3. Send the appropriate reminder or document request.
4. Wait for applicant resubmission.
5. Re-check the row and Drive artifacts.
6. Move to `REVIEW_REQUIRED` only after the missing item is resolved.

## Recovery Guardrails

- Do not auto-finalize rejection.
- Do not auto-finalize enrolment.
- Do not infer payment verification from upload presence.
- Do not reactivate CRM to recover intake.
- Do not create hidden remediation workflows.

## Operator Notes

- Recovery should preserve evidence of the original missing item.
- Each recovery action should be reversible and auditable.
- Manual review remains the authority for disputed cases.

