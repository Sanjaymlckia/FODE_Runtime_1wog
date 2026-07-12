# Communication Model

Status: r338 authority convergence sync
Scope: documentation only

## Communication Principle

Authoritative row facts feed Canonical Lifecycle.

Canonical Lifecycle describes applicant state.

Actionability recommends workload and message type.

Communication Authority decides message-specific permission.

Preview and send consume the same Communication Authority result.

Send Authority remains the final execution gate.

## Target Flow

```text
Authority Truth
-> Canonical Lifecycle
-> Actionability Recommendation
-> Recommended Message Type
-> Communication Authority
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
| Communication Authority | Evaluates selected message type, permission, sendability, and block reason. |
| Preview Authority | Builds visible recipient/cohort proof from the same authority result used by send. |
| Operator Confirmation | Confirms real-world intent. |
| Send Authority | Revalidates the same authority result and sends only if still eligible. |
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

Communication Authority now accepts canonical lifecycle context for the currently converged live workflows:

- `INCOMPLETE_DOCUMENTS -> docs_missing`
- `PAYMENT_PENDING -> payment_followup`

That means a row may be admitted by canonical state even when a legacy overlay-oriented lifecycle label would otherwise have caused an incorrect block.

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

## Recommendation vs Permission Contract

Operator-visible surfaces must keep these values separate:

- `recommendedMessageType`: canonical/actionability recommendation
- `requestedMessageType`: operator-selected request
- `selectedMessageType`: message type evaluated by Communication Authority
- `permitted`: lifecycle/policy permission for that message
- `sendableNow`: immediate sendability after contactability, cooldown, role and idempotency gates
- `blockCode` / `blockReason`: the reason surfaced when blocked

Review Workspace, Operations Workspace, selected/manual batch, preview and send must agree on normalized message type and block reason for the same applicant facts.

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
