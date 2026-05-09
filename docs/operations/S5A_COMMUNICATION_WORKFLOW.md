# S5A Communication Workflow

Date: 2026-05-09
Scope: communication lifecycle and guardrails

## Operating Rules

- No unattended outbound email by default.
- No hidden automation.
- Every outbound action must be logged.
- Every communication path must be manually overridable.

## Mandatory Communication Stages

1. FD autoresponder acknowledgement
2. Incomplete intake reminder
3. Low-quality document request
4. Payment pending notice
5. Portal activation notice
6. Enrolment confirmation
7. Fraud/manual review escalation

## Stage Purpose

### FD autoresponder acknowledgement

- Confirms intake receipt.
- Does not imply eligibility, acceptance, or payment verification.

### Incomplete intake reminder

- Requests missing fields or files.
- Can be repeated only through controlled operator-approved workflow.

### Low-quality document request

- Requests clearer or correct documents.
- Does not finalize rejection.

### Payment pending notice

- Explains that payment evidence is still required.

### Portal activation notice

- Confirms that portal access has been enabled after verification.

### Enrolment confirmation

- Confirms final enrollment outcome.

### Fraud/manual review escalation

- Escalates suspicious or inconsistent applications to manual review.

## Guardrails

- Applicant-facing messages must not imply CRM authority.
- Payment messages must not imply verification before Admin action.
- Portal messages must follow verified eligibility.
- Fraud escalations must not auto-reject without review.
- AI may draft or summarize communication, but may not send without operator authorization.

## Operational Notes

- Each message type should have a clear source, recipient, timestamp, and reason.
- Replay-safe behavior is required for any future automation.
- Communication records should support audit and rollback.

