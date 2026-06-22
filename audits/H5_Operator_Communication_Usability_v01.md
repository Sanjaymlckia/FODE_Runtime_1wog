# H5 Operator Communication Usability v01

Date: 2026-06-22
Track: H - Communication / Operator Surface
Gate: Full Gate

## Current workflow

1. Open one authoritative applicant record.
2. Review effective email, contact history, bounce fields, and send eligibility.
3. Select an active message type.
4. Generate a no-send preview through `admin_previewApplicantMessage`.
5. Review recipient, subject, and body.
6. Send only through the separately authorized path after a valid preview and explicit confirmation.

## Friction found

- Picker labels did not clearly distinguish selected-applicant templates from Stage Batch concepts.
- `reminder` appeared as a generic operator choice despite being an overloaded legacy type.
- `docs_missing` and `payment_followup` labels did not state their practical evidence context.
- The preview result showed subject/body but omitted the resolved recipient.
- The surface relied on dynamic button state to imply that preview does not send.
- Selected-applicant preview does not currently expose configured sender/reply-to metadata. This is a follow-up, not a blocker; the current dispatch path uses the configured FODE campaign alias and reply-to.

## Changes

- Clarified operator-facing labels without changing message type values.
- Added concise selected-applicant usage guidance.
- Added an explicit no-send preview notice.
- Added the resolved recipient to preview output.
- Kept `custom_email` visibly selected-applicant scoped and editable.

## Authority boundaries

- Active selected-applicant types remain:
  - `legacy_invite`
  - `reminder`
  - `docs_missing`
  - `payment_followup`
  - `application_feedback`
  - `custom_email`
- Stage Batch mappings are unchanged.
- Planned types and `application_exam_fee_reminder` remain hidden and non-sendable.
- No preview, send, cooldown, suppression, idempotency, eligibility, or lifecycle behavior changed.
- Contactability ingestion/marking remains a separate H4 corrective action.
- Prospect and marketing automation remain a separate lane.

## Recommendation

Review and browser-accept this surgical label/help-text change under the Full Gate before any staging release. A later backend-only improvement may expose sender/reply-to metadata in preview responses if operators require that confirmation.
