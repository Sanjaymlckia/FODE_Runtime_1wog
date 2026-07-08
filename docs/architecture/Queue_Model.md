# Queue Model

Status: r23B consolidation draft
Scope: documentation only

## Purpose

Queues should tell the operator where attention is needed.

Queues must not be confused with lifecycle authority, population authority, workload authority, or send authority.

Population accounting belongs to the Population Ledger.

Review Queues remain compatibility/workflow queues. They may expose useful review cohorts, but they are not exhaustive population truth and must not be used to reconcile the applicant population.

## Current Clarified Queue Rules

Documents to Verify means officer review-ready:

```text
portalSubmitted
&& requiredDocumentUploadComplete
&& !docsVerified
```

Awaiting Documents means applicant action required:

```text
portalSubmitted
&& !requiredDocumentUploadComplete
&& !docsVerified
```

Stage Batch Preview remains separate from Review Queues.

## Future Queue Direction

Queues should move toward owner/action orientation:

| Queue | Owner | Meaning |
|---|---|---|
| Applicant Action Queue | Applicant | Applicant must upload, pay, correct, or respond. |
| Officer Review Queue | Officer | Officer must verify complete evidence. |
| Finance Action Queue | Finance/Admin | Payment evidence or finance exception needs action. |
| Escalated Queue | Operator/Admin | Overdue or unresolved record needs escalation. |
| Dormant Queue | Operator/Admin | Record exceeded final follow-up window. |

## Queue vs Send Authority

Queue membership is not send authority.

Stage Batch Preview determines mail eligibility.

Send Authority validates before any send.

## Queue vs Lifecycle

Lifecycle describes state.

Population Ledger describes where every applicant is accounted for.

Operations Workspace describes current work from ledger/actionability outputs.

Review Queue membership describes compatibility workflow cohorts.

A single lifecycle state can appear in different queue contexts depending on owner, urgency, communication history, and payment/document readiness.

## A3.3 Canonical Lifecycle Migration Boundary

Operations Workspace actionability now consumes canonical lifecycle recommendations when available.

Queue/worklist selection must follow the server `selectable` DTO, not client-side lifecycle labels.

Canonical lifecycle distinguishes:

- base applicant state, such as `INCOMPLETE_DOCUMENTS`
- overlays, such as `REMINDER_DUE`
- actionability readiness, such as `READY` or `COOLING_OFF`

This means a missing-document applicant can remain in the base state `INCOMPLETE_DOCUMENTS` while also carrying the `REMINDER_DUE` overlay. The overlay may affect urgency, but it must not replace the base state or block the `docs_missing` action path by itself.

Stage Batch and Communication Authority still use their existing authority paths until a later Track H migration explicitly changes them.

