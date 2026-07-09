# Operator Actionability Resolver

Status: r338 implemented workload authority
Scope: Admin Operations Workspace actionability and selection readiness

## Definition

The Operator Actionability Resolver is a derived, read-only workload authority layer.

It consumes existing authority outputs and derives operational recommendations.

It does not replace or bypass:

- Lifecycle Authority
- Document Completeness Authority
- Document Review Authority
- Payment Authority
- Communication Authority
- Enrollment Authority
- Preview Authority
- Send Authority

## Core Rule

Truth authorities determine what is true.

Operator Actionability Resolver determines what should happen next.

## Current Runtime Boundary

The Admin Operations Workspace actionability path prefers canonical lifecycle recommendations when available.

The resolver consumes the canonical lifecycle `recommendedMessageType` before falling back to legacy lifecycle-stage message mapping. This corrects the unsafe workload interpretation where a row with missing required uploads could be treated as `REMINDER_DUE` base lifecycle and blocked from the `docs_missing` action path.

The resolver remains derived/read-only. It does not change Population Ledger accounting, Review Queue membership, or Stage Batch send authority.

Communication Authority remains the final send gate, but now accepts narrow canonical lifecycle context for the missing-documents workflow while preserving cooldown, contactability, idempotency, manual restrictions, and legacy fallback.

## Inputs

Potential inputs:

- canonical lifecycle base state
- canonical lifecycle overlays
- canonical recommended message type
- legacy lifecycle stage, fallback/diagnostic only
- document completeness
- document review status
- payment evidence and verification
- enrollment/classroom state
- communication history
- last contact date
- next action date
- cooldown/idempotency status
- application age
- portal submission status

## Outputs

| Output | Example Values |
|---|---|
| `actionOwner` | `APPLICANT`, `OFFICER`, `FINANCE`, `ADMIN`, `SYSTEM`, `NONE` |
| `nextAction` | `UPLOAD_REQUIRED_DOCS`, `REVIEW_DOCUMENTS`, `VERIFY_PAYMENT`, `SEND_DOC_REMINDER`, `SEND_PAYMENT_REMINDER`, `FINAL_FOLLOWUP`, `NO_ACTION` |
| `urgencyLevel` | `NORMAL`, `DUE`, `OVERDUE`, `ESCALATED`, `DORMANT` |
| `urgencyReason` | `missing mandatory uploads for 14 days` |
| `recommendedMessageType` | `document_completion_reminder`, `payment_reminder`, `final_followup` |
| `actionabilityState` | `READY`, `COOLING_OFF`, `AWAITING_APPLICANT`, `AWAITING_PAYMENT`, `REVIEW_REQUIRED`, `COMPLETE`, `UNKNOWN` |
| `selectable` | server-side boolean for Operations Workspace selection |
| `selectBlockReason` | operator-readable reason when a row is not selectable |
| `staleDays` | numeric day count |
| `lastContactAgeDays` | numeric day count |
| `sourceAuthoritySummary` | compact authority explanation |
| `operationalBucket` | bucket used by Operations Workspace and compatible workload views |

## Non-Goals

The resolver must not:

- send email
- mutate rows
- create preview cache
- bypass Preview Authority
- bypass Send Authority
- bypass cooldown, idempotency, caps, or confirmation
- become OPS-only client-side logic
- replace existing authorities

## Lifecycle Base State vs Overlay

Canonical lifecycle separates applicant state from timing or urgency overlays.

Example:

```text
Base state: INCOMPLETE_DOCUMENTS
Overlay: REMINDER_DUE
Recommended message type: docs_missing
```

`REMINDER_DUE` must not replace the base lifecycle state. It can increase urgency or timing eligibility, but it should not make missing-document applicants look like a generic reminder cohort.

## Selection Rule

Operations Workspace selection is server-driven.

- `Select Visible` selects only rows whose DTO has `selectable: true`.
- `Select All Returned` selects only rows whose DTO has `selectable: true`.
- Non-ready rows remain visible with `selectBlockReason`.
- Client code must not invent readiness policy.

## Current Milestone State

Completed:

- canonical lifecycle resolver
- canonical lifecycle DTO
- lifecycle mismatch diagnostics
- lifecycle drift summary
- actionability canonical recommendation consumption
- selected/manual batch cap alignment with configured policy
- cooling-off surfaced in workload state after successful send
- contactability promoted to a first-class operational bucket

Remaining:

- Stage Batch migration
- Population Ledger canonical lifecycle reporting/migration
- legacy lifecycle retirement
