# ADR — Zoho Books Authority Boundary

Status: Accepted
Date: 2026-07-11
Scope: documentation and regression freeze only

## Context

FODE Runtime currently contains two finance-adjacent paths:

- the protected Zoho Books draft-invoice workflow
- the legacy invoice-trigger compatibility workflow

Those paths are adjacent to payment handling, but they are not the payment authority.

The runtime has already converged on canonical payment truth:

- `Receipt_Status` is the canonical payment authority
- `Payment_Verified` is a compatibility mirror only

Without an explicit boundary freeze, future cleanup work could accidentally let Books metadata or legacy trigger markers become hidden payment authority.

## Decision

Freeze the finance boundary as follows:

- `Receipt_Status` remains the canonical payment authority
- Zoho Books draft invoice preview/create/test-email flows remain external integration only
- `Books_*` fields remain integration metadata and must not determine lifecycle, workload, or communication recommendation
- `Payment_Verified` remains a compatibility mirror only
- `triggerInvoiceWebhook_()` and `handleInvoiceTrigger_()` remain retained legacy compatibility paths only
- `CRM_Invoice_Triggered` and `Invoice_Sent_At` remain compatibility state only
- `FODE_Billing_Reference` remains an external integration join key
- Review Workspace and Operations Workspace payment display must remain canonical-payment-backed

## Rationale

The system must keep four concerns separate:

- payment truth
- external accounting integration
- legacy compatibility handoff
- operator-facing payment/workload display

If those are merged prematurely:

- Books draft state could be mistaken for paid state
- workload routing could drift from canonical payment truth
- legacy webhook markers could become operational authority
- cleanup could remove compatibility fields without proving dependency safety

## Consequences

Positive:

- payment authority stays explicit and testable
- Zoho Books remains protected but non-authoritative
- legacy finance compatibility remains documented instead of implicit
- Runtime Cleanup Finalisation can proceed later against a frozen boundary

Neutral:

- legacy invoice-trigger code remains temporarily present
- compatibility fields remain in schema and writeback
- Books metadata remains visible in detail/diagnostic surfaces

Deferred:

- retirement of `triggerInvoiceWebhook_()`
- retirement of `handleInvoiceTrigger_()`
- retirement of `CRM_Invoice_Triggered`
- retirement of `Invoice_Sent_At`

These retirements require explicit dependency proof that no external/manual process still relies on the legacy handoff path.
