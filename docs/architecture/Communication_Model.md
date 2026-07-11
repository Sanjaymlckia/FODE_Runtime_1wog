# Communication Model

Status: r338 authority convergence sync
Scope: documentation only

## Communication Principle

Canonical Lifecycle describes state.

Actionability recommends workload.

Preview selects.

Send Authority validates.

Send Authority remains authoritative.

## Target Flow

```text
Authority Truth
-> Canonical Lifecycle
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
| Canonical Lifecycle Resolver | Determines base state and overlays. |
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

## Current Convergence Boundary

Communication Authority now accepts narrow canonical lifecycle context for the missing-documents workflow.

That means a row may be admitted by canonical `INCOMPLETE_DOCUMENTS -> docs_missing` even when a legacy overlay-oriented lifecycle label would otherwise have caused an unsafe block.

This convergence does not change:

- cooldown
- contactability
- idempotency
- role restrictions
- preview/send parity
- confirmation
- Stage Batch candidate selection
- canonical payment authority
- Zoho Books accounting-integration boundary

## ACP Closure Boundary

The following operator-triggered routes are now required to pass through Communication Authority before preview/send:

- Review Workspace single-applicant preview/send
- selected/manual Batch Communication preview/send
- Stage Batch preview/send
- compatibility queue/search communication routing

Compatibility surfaces may still expose communication-related labels, but they no longer own send identity or send execution.

## Portal Communication Boundary

Portal Communication is the canonical runtime capability for:

- initial application portal invitation
- resend portal access

Current runtime compatibility token:

- `legacy_invite`

Boundary rule:

- `legacy_invite` is a compatibility alias, not the architectural concept.
- Historical Legacy Campaign helpers may continue to reference `legacy_invite`,
  but they must not become Communication Authority or lifecycle authority.
- No ACP slice may rename the external token, RPC names, Apps Script function
  names, or operator-facing labels without a separate compatibility programme.

Retired path:

- `admin_sendDocsFollowupEmails()` is retained only as a non-sending compatibility wrapper and explicit retirement response

Deferred cleanup:

- `docsFollowupSentAt`
- compatibility queue/search wording and controls that still mention legacy Docs Follow-Up history

Retained automated exceptions:

- governed unattended payment/document/admin-notification emails
- manual WhatsApp fallback CSV email to admins

These are outside the operator batch/review communication authority chain and must remain explicitly documented and narrowly scoped.

## Finance Boundary

Communication recommendation and communication authority must remain canonical-payment-backed.

They must not infer payment completion, payment hold, or payment reminder suppression from:

- `Books_Invoice_ID`
- `Books_Invoice_Number`
- `Books_Invoice_Status`
- `Books_Push_Status`
- `CRM_Invoice_Triggered`
- `Invoice_Sent_At`

Those fields are accounting integration metadata or retained compatibility state, not communication payment authority.

## OPS Boundary

OPS bulk send remains disabled unless separately approved.

OPS must consume shared backend authority, not add a separate communication authority.
