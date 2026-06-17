# Communication Model

Status: r23B consolidation draft
Scope: documentation only

## Communication Principle

Actionability recommends.

Preview selects.

Send Authority validates.

Send Authority remains authoritative.

## Target Flow

```text
Authority Truth
-> Actionability Recommendation
-> Preview Cohort
-> Confirmation
-> Send Authority
-> Audit Log
```

## Responsibility Split

| Component | Responsibility |
|---|---|
| Authority Layer | Determines current truth. |
| Operator Actionability Resolver | Recommends whether communication is appropriate. |
| Preview Authority | Builds visible recipient cohort. |
| Operator Confirmation | Confirms real-world intent. |
| Send Authority | Revalidates and sends. |
| Audit Log | Records outcome. |

## Candidate Message Types

Potential future message types:

- `document_completion_reminder`
- `payment_reminder`
- `final_followup`
- `application_stale_warning`
- `operator_intervention_required`

These are not implemented by this documentation package.

## Guardrails

Do not allow actionability to directly send.

Do not allow visible queue rows to become send authority.

Do not bypass:

- role/authority
- visible preview
- explicit confirmation
- caps
- cooldown
- idempotency
- candidate parity/hash
- result logging

## OPS Boundary

OPS bulk send remains disabled unless separately approved.

OPS must consume shared backend authority, not add a separate communication authority.

