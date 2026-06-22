# H2 Communication Template Builder Text and Guidance Definitions v01

## Classification

- Track: H
- Scope: communication builder wording, inert planned skeletons, and tests
- AdminUI: unchanged
- Send/preview authority: unchanged
- Deployment: none

## Active Template Decisions

| Message type | Decision |
|---|---|
| `legacy_invite` | Existing portal/application invitation remains unchanged and applicant-specific. It is not prospect guidance. |
| `reminder` | Existing generic completion reminder remains unchanged. It is still explicitly classified as overloaded and no new semantic meaning was added. |
| `fd_acknowledgement` | Existing wording confirms receipt and states that Admissions will review the application and recorded uploads. It does not communicate acceptance or enrolment. |
| `application_feedback` | Existing selected-applicant correction and clarification wording remains unchanged. It continues to require the authoritative selected applicant context. |
| `custom_email` | Remains selected-only, freeform, and never batch-safe. The empty default was replaced with a neutral selected-applicant information and next-steps draft that the operator may edit. |
| `docs_missing` | Wording now covers missing, incomplete, or not-received documents without assigning blame. It explicitly allows for an upload that did not reach FODE correctly and asks for upload/resubmission while review remains open. |
| `payment_followup` | Wording now requests payment completion or clear receipt upload. It explicitly states that the follow-up does not confirm acceptance or enrolment. |

## Planned and Manual Skeletons

Builder IDs and inert subject/body skeletons now exist for:

- `prospect_general_guidance`
- `application_receipt_request`
- `application_verified_quote`
- `application_acceptance_confirmation`
- `application_final_reminder`
- `contact_fallback_manual`

These functions are not referenced by `buildApplicantMessage_()`, Stage Batch mappings, AdminUI, or any send path.

The planned/manual definitions remain outside `CONFIG.COMMUNICATION_ALLOWED_MESSAGE_TYPES`. Existing normalization therefore continues to reject them before preview or send.

## Prospect Guidance Safety

The prospect skeleton:

- uses generic FODE information and application guidance;
- directs recipients to the application form, required document upload, FAQ, and approved contact channels;
- includes `If you have already completed these steps, please ignore this message.`;
- contains no Applicant ID, applicant-state assertion, acceptance claim, or unresolved placeholder;
- remains `planned`, not batch-safe, and unauthorized for applicant Stage Batch.

Prospect delivery remains deferred until recipient source, consent/contact basis, suppression, opt-out, preview parity, caps, cooldown, idempotency, and audit authority are approved.

## Planned Authority Boundaries

- Receipt request remains inactive until authoritative payment/receipt state is defined.
- Verified quote remains inactive and still requires reconciliation with `docs_verified_quote_email`.
- Acceptance confirmation remains high-authority and selected-only by design; no active path exists.
- Final reminder remains inactive until cadence and dormant/manual-handling authority are approved.
- Contact fallback is an operator advisory, not a normal email-sendable message.

## Behavioral Boundary

H2 does not:

- add an allowed runtime message type;
- change normalization, eligibility, cooldown, suppression, idempotency, preview, send, or Stage Batch behavior;
- expose planned types in AdminUI;
- activate prospect or applicant batch sends;
- modify Sheets, Drive data, OPS, production, or Student staging.

## Next Slice

Recommended next work:

1. Review the active wording with admissions operators.
2. Define prospect recipient/contact authority before any prospect preview endpoint.
3. Reconcile the existing verified-quote workflow under a separate authority-focused CIS.
4. Keep planned types inactive until each has explicit condition, preview, send, and audit acceptance criteria.
