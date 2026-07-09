# Operational Bucket Model

Status: r338 authority convergence sync
Scope: documentation only

## Purpose

Operational buckets answer:

```text
Where did this work originate?
Who should act?
Why is it visible now?
```

They do not replace Population Ledger accounting, Canonical Lifecycle, or Communication Authority.

## Bucket Authority

Operational bucket assignment is a workload concern owned by the Operator Actionability Resolver and its server DTOs.

Population Ledger may normalize those workload outputs into full-population accounting buckets, but bucket labels shown to operators must not be re-derived in the UI.

## Current Operator Buckets

| Bucket | Meaning | Typical owner |
|---|---|---|
| Applicant Action | Applicant must upload, respond, pay, or correct | Applicant / intake |
| Admissions Review | Officer review or verification work | Officer / admissions |
| Finance | Payment evidence or finance-specific work | Finance / admin |
| Academic Administration | Academic/admin follow-up outside applicant action | Academic admin |
| Contactability Exceptions | No effective email, bounced email, or contactability gate | Applicant / intake with contactability blocker |
| Management Exceptions | Genuine manual override, governance, policy, or escalation work | Management / admin |
| Dormant | Aged or no-longer-active workload requiring explicit dormant handling | Admin / system |
| Completed / No Action | No operational work remains | None |
| Unknown / Unclassified | Resolver could not classify cleanly | Investigate |

## Contactability Decision

Contactability is not Management work by default.

Rows with suppressors such as:

- `NO_EFFECTIVE_EMAIL`
- `EMAIL_BLOCKED_OR_BOUNCED`

must route to `Contactability Exceptions` for operator truth.

`Management Exceptions` is reserved for genuine management/governance/manual-escalation work.

## Operator Metrics Rule

Every bucket summary shown to operators must distinguish:

- population in bucket
- eligible now
- current returned worklist
- outside current window or hidden by current cohort rules

The UI must not imply that visible returned rows equal full eligible population unless the DTO explicitly says so.

## Compatibility Rule

Legacy queue names and compatibility surfaces may still use older groupings internally, but operator-facing wording must prefer the current bucket truth.
