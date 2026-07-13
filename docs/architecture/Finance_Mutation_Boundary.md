# Finance Mutation Boundary

Status: design only. No mutation activated by M2.

## Payment Verification

Payment verification remains Review Workspace controlled and capability-gated by `CAN_VERIFY_PAYMENT`.

Required future design:

- receipt evidence requirement
- verifier capability
- maker-checker decision
- optimistic concurrency
- audit event
- lifecycle/actionability refresh
- correction and rollback path

## Quotes

Runtime may own quote intent and applicant context. Quote numbering, versioning, validity, discounts, and regeneration policy require owner decisions before becoming authority.

## Invoices

Zoho Books owns accounting invoice execution. Runtime stores integration IDs and handoff state only unless a future owner decision creates a local quote/invoice authority.

## Instalments

Instalments require policy for schedule, allocation, grace period, missed payment handling, and modification authority.

## Disputes, Credits, Refunds, Waivers and Write-offs

These remain policy-dependent. No current code should infer them from free text or Books metadata.

Future implementations must define:

- authorization level
- evidence
- calculation rule
- Books representation
- audit trail
- lifecycle and communication impact
