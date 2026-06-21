# H1 Communication Semantic Registry and Authority Map v01

## Classification

- Track: H
- Scope: backend semantic metadata, authority map, and tests only
- Runtime behavior: unchanged
- Deployment: none

## Adopted Architecture

FODE communication is represented as:

`person condition -> semantic intent/message type -> eligibility policy -> delivery mode -> preview -> send authority -> audit`

Message type and delivery mode are separate. A semantic type describes why a communication exists. Delivery mode describes whether an approved type may later be used for a selected recipient, an authorized batch, or a manual fallback.

The registry is metadata only. Existing normalization, eligibility, cooldown, suppression, idempotency, preview, send authority, and Stage Batch mappings remain authoritative and unchanged.

## Audience Classes

| Audience class | Authority boundary |
|---|---|
| `PROSPECT_GUIDANCE` | Requires a proven lead source, contact basis/consent, valid contact, suppression/opt-out handling, preview, and recipient-cohort authority before activation. It must not use applicant Stage Batch authority. |
| `APPLICANT_WORKFLOW` | Requires an authoritative applicant row and message-specific applicant-state validation. Existing backend preview/send authority remains controlling. |
| `OPERATOR_MANUAL` | Selected-recipient or manual-fallback handling only. It is not batch email authority. |

## Active Runtime Types

| Message type | Semantic meaning | Delivery modes | Batch safe | Notes |
|---|---|---|---|---|
| `legacy_invite` | Portal/application workflow invitation | selected, batch | yes | Applicant workflow only; not prospect guidance. |
| `reminder` | Overloaded legacy application reminder | selected, batch | yes under existing gates | Risk: currently spans response, document, payment, and receipt contexts. No new meanings should be added. |
| `fd_acknowledgement` | Application received | selected | no | Receipt acknowledgement only; does not mean accepted. Existing system acknowledgement path remains separately governed. |
| `application_feedback` | Selected-applicant correction/feedback | selected | no | Applicant-specific and not batch-safe by default. |
| `custom_email` | Selected-recipient custom operator email | selected | no | Freeform escape hatch only. Never batch-safe. |
| `docs_missing` | Documents missing or not received | selected, batch | yes under existing gates | Must not blame the applicant or imply rejection. |
| `payment_followup` | Payment reminder/follow-up | selected, batch | yes under existing gates | Must not imply acceptance or enrolment. |

The active registry set exactly matches `CONFIG.COMMUNICATION_ALLOWED_MESSAGE_TYPES`. Existing logged type names are preserved.

## Planned and Manual Definitions

| Message type | Status | Boundary |
|---|---|---|
| `prospect_general_guidance` | planned | Not previewable or sendable. Prospect recipient authority, contact basis, suppression, opt-out, preview, and cohort rules are not implemented. |
| `application_receipt_request` | planned | Requires authoritative payment/receipt state before activation. |
| `application_verified_quote` | planned | Requires later reconciliation with existing `docs_verified_quote_email`, which sits outside the normalized applicant-message family. |
| `application_acceptance_confirmation` | planned | High-authority type. Payment evidence or actionability alone cannot authorize it. |
| `application_final_reminder` | planned | Requires approved cadence and dormant/manual-handling authority. |
| `contact_fallback_manual` | manual | Represents invalid/no-effective-email manual handling. It is not a normal email-sendable type. |

Planned and manual definitions are deliberately absent from `CONFIG.COMMUNICATION_ALLOWED_MESSAGE_TYPES`, so existing preview/send normalization rejects them.

## Custom Email Boundary

`custom_email` remains:

- selected-applicant only;
- freely editable;
- previewed and sent only through existing backend authority;
- not batch-safe;
- unsuitable as a substitute for prospect guidance or missing semantic types.

An approved template may later be copied into a selected custom draft, but that does not change the audit meaning or create batch authority.

## Prospect Batch Deferral

Prospect batch sending is deferred because FODE does not yet have an approved prospect recipient authority equivalent to applicant Stage Batch authority.

Before activation, a separate prospect model must define:

- source and ownership of the recipient list;
- consent or legitimate contact basis;
- suppression and opt-out handling;
- duplicate/contact normalization;
- preview and cohort parity;
- batch caps, cooldown, idempotency, and audit meaning.

Applicant review queues and applicant Stage Batch must not be reused as prospect authority.

## Overloaded Reminder Risk

Current Stage Batch mappings route these stages to `reminder`:

- `INVITED_AWAITING_RESPONSE`
- `REMINDER_DUE`
- `DOCS_REQUIRED`
- `PAYMENT_REQUIRED`
- `RECEIPT_AWAITING_VERIFICATION`

This is accepted compatibility behavior for this slice, not the target semantic model. Future work should migrate each context deliberately without changing historical audit interpretation.

## Operational Behavior

This slice does not:

- add allowed runtime message types;
- add templates or builders;
- change Stage Batch mappings;
- change preview or send eligibility;
- activate prospect, receipt, quote, acceptance, or final-reminder sends;
- change AdminUI or OPS;
- send, write Sheets, or mutate Drive.

## Next Implementation Slice

Recommended next slice:

1. Add a read-only backend semantic/authority inspection endpoint only after deciding whether a non-UI consumer needs it.
2. Reconcile `docs_verified_quote_email` with the planned normalized quote type without activating a new send path.
3. Define prospect recipient/contact authority before implementing any prospect preview or batch behavior.
4. Split overloaded `reminder` only through separately approved, message-specific migration slices.
5. Keep AdminUI work paused until E2.1C hydration/parser isolation is complete.
