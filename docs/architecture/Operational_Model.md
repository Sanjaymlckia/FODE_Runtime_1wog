# Operational Model

Status: r23B consolidation draft
Scope: documentation only

## Purpose

The operational model describes how authority truth becomes useful operator work.

It must avoid turning lifecycle or status fields into overloaded UI commands.

## Current Operational Direction

Legacy Admin is the trusted operating surface.

OPS is frozen as a secondary/reference surface.

Operator workload should become clearer by separating:

- applicant action required
- officer review required
- finance/payment action required
- escalation required
- no action required

## Derived Operational Fields

The following fields are proposed for the Operator Actionability Resolver:

| Field | Meaning | Status |
|---|---|---|
| `actionOwner` | Who should act next | Derived/read-only |
| `nextAction` | What should happen next | Derived/read-only |
| `urgencyLevel` | Operational urgency | Derived/read-only |
| `urgencyReason` | Explanation for urgency | Derived/read-only |
| `recommendedMessageType` | Suggested communication, if any | Derived/read-only |
| `staleDays` | Days since stale/blocked threshold | Derived/read-only |
| `lastContactAgeDays` | Days since last communication | Derived/read-only |
| `sourceAuthoritySummary` | Compact explanation of inputs | Derived/read-only |

These fields should not be written to the sheet in the first implementation phase.

## Lifecycle Is Not Urgency

Example:

```text
Lifecycle: Awaiting Documents
Urgency: Escalated
Owner: Applicant
Next Action: Send Final Reminder
```

Lifecycle describes the state of the application.

Urgency describes how strongly the operator should act.

## Review-Ready Boundary

Documents to Verify means officer review-ready workload:

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

## Operator Surface Rule

Primary operator displays should lead with:

- action required
- owner
- urgency
- age
- next action

Authority details should remain available through drill-down.

