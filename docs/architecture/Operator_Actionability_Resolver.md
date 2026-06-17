# Operator Actionability Resolver

Status: r23B consolidation draft
Scope: conceptual architecture only

## Definition

The Operator Actionability Resolver is a derived, read-only, non-authoritative layer.

It consumes existing authority outputs and derives operational recommendations.

It does not replace:

- Lifecycle Authority
- Document Completeness Authority
- Document Review Authority
- Payment Authority
- Communication Authority
- Enrollment Authority
- Preview Authority
- Send Authority

## Core Rule

Truth Authorities determine what is true.

Operator Actionability Resolver determines what should happen next.

## Inputs

Potential inputs:

- lifecycle stage
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
| `staleDays` | numeric day count |
| `lastContactAgeDays` | numeric day count |
| `sourceAuthoritySummary` | compact authority explanation |

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

## First Implementation Boundary

The safest future runtime step is a read-only backend resolver helper returning actionability for one row.

That future helper should be diagnostic/display-only until accepted.

