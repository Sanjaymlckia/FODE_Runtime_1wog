# ADR — Contactability Exceptions as First-Class Operational Bucket

Status: Accepted
Date: 2026-07-09
Scope: documentation only

## Context

The runtime previously exposed many contactability failures through `Management Exceptions`.

That presentation mixed two different classes of work:

- genuine management/governance/manual-escalation work
- intake/applicant data-quality failures such as no effective email or bounced email

The result was poor operator accountability:

- contactability failures looked like management problems
- management totals were inflated by non-management work
- operators could not distinguish governance work from intake-quality defects

## Decision

Promote `Contactability Exceptions` to a first-class operational bucket.

Rows with suppressors such as:

- `NO_EFFECTIVE_EMAIL`
- `EMAIL_BLOCKED_OR_BOUNCED`

route to `Contactability Exceptions` in operator-facing workload surfaces.

`Management Exceptions` is narrowed to genuine:

- manual override
- governance exception
- policy conflict
- explicit management escalation

## Rationale

Contactability failures originate from applicant/intake data quality and communication reachability, not from management authority.

Separating the bucket:

- improves operator clarity
- exposes contactability as its own measurable intake-quality workload
- prevents false management backlog
- aligns bucket presentation with the declared authority chain

## Consequences

Positive:

- clearer operator worklist
- explicit intake/contactability metric
- narrower and more trustworthy `Management Exceptions`
- no change to grand totals; only bucket distribution changes

Neutral:

- compatibility aliases may still exist internally for older consumers
- Population Ledger totals remain unchanged
- Communication Authority send rules remain unchanged

Deferred:

- retirement of any remaining internal compatibility grouping once all consumers use the current bucket taxonomy
