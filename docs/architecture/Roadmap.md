# Architecture Roadmap

Status: r23B consolidation draft
Scope: documentation only

## Phase 1: Documentation Consolidation

- Create `docs/architecture/` entrypoint.
- Consolidate architecture, authority, operational, communication, queue, and roadmap docs.
- Consolidate Mermaid sources.
- Preserve source documents.

## Phase 2: Operator Actionability Contract

- Finalize the read-only resolver contract.
- Define input authority dependencies.
- Define output fields.
- Define non-goals and send guardrails.

## Phase 3: Read-Only Runtime Discovery

Future CIS only:

- add read-only backend diagnostic/helper
- return actionability for one applicant row
- no row mutation
- no send
- no cache authority
- no OPS activation

## Phase 4: Legacy Admin Display

Future CIS only:

- display action owner, next action, and urgency in Legacy Admin
- keep details drill-down for authority truth
- keep send/preview authority separate

## Phase 5: Queue Refinement

Future CIS only:

- separate applicant-action, officer-review, finance-action, escalated, and dormant queues
- avoid using visible queue rows as send authority

## Phase 6: Communication Alignment

Future CIS only:

- use actionability as recommendation input
- keep Preview Authority and Send Authority authoritative
- no OPS bulk send unless separately approved

## Phase 7: OPS Reassessment

OPS remains frozen until:

- Legacy Admin authority model is stable
- Operator Actionability Resolver is proven
- marketing/intake priorities are stabilized

