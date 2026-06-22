# H3 Selected Template Exposure, Exam Fee, and Contactability Plan

## Classification

- Release track: Track H
- Implementation scope: selected-applicant template exposure plus inert semantic metadata
- Runtime release: not authorized in this slice

## Selected-Applicant Exposure

The existing selected-applicant communication picker now includes:

- `docs_missing` - Missing Documents Follow-Up
- `payment_followup` - Payment Follow-Up

Both types already use the existing applicant-row authority, email validity, preview, cooldown, suppression, idempotency, and send gates. This change does not add them to Stage Batch and does not change their backend eligibility.

`custom_email` remains selected-applicant only and is not batch-safe.

## Planned National Exam Fee Type

`application_exam_fee_reminder` is registered as planned and inert.

- Audience: `APPLICANT_WORKFLOW`
- Current operator-known fee: K150 per subject
- Requires authoritative applicant row
- Requires authoritative exam-fee-due state
- Requires confirmed subject count before an applicant-specific amount is communicated
- Requires valid email for future email delivery
- Not previewable
- Not sendable
- Not exposed in AdminUI
- Not mapped to Stage Batch
- Not batch-safe

The skeleton wording identifies the fee as the Department of Education FODE National Exam Fee and does not imply acceptance, enrolment, or exam registration.

## Contactability Visibility Gap

Observed example:

- Applicant: `FODE-26-003157`
- Email: `josiewabby27@gmail.com`
- Later Gmail evidence: `550 5.1.1 NoSuchUser`
- Current selected-applicant surface can still show the earlier acknowledgement as `SENT`

This is a contactability evidence gap, separate from missing-document state.

Recommended future path:

1. Define an explicit contactability status or read-only derived advisory.
2. Support controlled manual marking or ingestion of authoritative bounce-log evidence.
3. Display a selected-applicant warning before preview/send when invalid or no effective email is known.
4. Provide a WhatsApp/manual fallback advisory without automating WhatsApp.
5. Exclude known-invalid email addresses from future batch cohorts.

Not implemented in H3:

- Gmail bounce ingestion
- row mutation
- automated WhatsApp
- batch exclusion changes
- communication authority changes

## Boundaries Preserved

- No Stage Batch remapping
- No new sendable type
- No automatic sends
- No prospect batch authority
- No lifecycle or actionability changes
- No Sheet or Drive mutation
- No OPS changes
