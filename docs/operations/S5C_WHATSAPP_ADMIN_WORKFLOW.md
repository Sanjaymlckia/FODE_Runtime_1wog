# S5C WhatsApp Admin Workflow

Date: 2026-05-10
Scope: Admin CSV export, admin email sharing, and manual WhatsApp operator assistance

## Purpose

- Support manual operator follow-up for WhatsApp fallback candidates.
- Preserve the existing criteria-based selection workflow.
- Add a bounded admin email path for sharing the generated CSV with configured recipients.
- Provide copy/paste-ready message text and manual web links without automated sending.

## Criteria-Based Selection

- Existing fallback criteria remain the primary queue selector.
- Criteria filtering must remain the first decision gate.
- Exported rows must still be reviewed manually before any contact action.
- No applicant grouping or bulk WhatsApp send behavior is introduced.

## Batch-Size Rules

- Default batch size: `20`
- Maximum batch size: `100`
- Invalid values are clamped safely server-side.
- The operator may reduce the batch size below the default, but the server must cap any larger request at `100`.
- The batch size controls the export scope only; it does not authorize sending.

## Admin CSV Email Workflow

- The operator exports a WhatsApp fallback CSV from the Admin UI.
- The generated CSV snapshot is cached for the current admin session.
- A separate `Email CSV to Admins` action sends the cached CSV only to configured admin recipients.
- The email action is explicit and manual.
- The email action does not send to applicants.
- The email action does not trigger WhatsApp sending.
- The email action should include the CSV as an attachment and a short operator instruction body.

## Message Template Policy

- The CSV includes copy/paste-ready WhatsApp message text.
- The template supports placeholders such as:
  - `ApplicantID`
  - `First_Name`
  - `Parent_Full_Name`
  - `Program`
  - `PortalLink`
- The default template must stay short and non-sensitive.
- Portal links may only appear when the existing portal-link policy already allows them.
- Tokens should resolve cleanly without encouraging unattended automation.

## WhatsApp Web Limitations

- Do not automate WhatsApp Web clicks or sends.
- Do not attempt browser scripting against WhatsApp Web.
- `wa.me` links and WhatsApp Web prefill links may be generated for single-recipient manual use where technically feasible.
- Operators remain responsible for opening the link and sending the message manually.

## Operator Responsibility

- Review the CSV before contacting anyone.
- Confirm the recipient and message text row by row.
- Use manual send only.
- Keep the admin email recipient list restricted to approved internal recipients.

## Privacy Notes

- WhatsApp fallback CSVs may contain applicant identity, contact details, and portal context.
- Emailing the CSV must remain limited to configured admin recipients.
- Do not forward the CSV outside approved internal channels.

## Anti-Spam and Consent Cautions

- Do not use the workflow to bypass consent or rate-limit expectations.
- Do not create bulk applicant groups.
- Do not broadcast without human review.
- Do not convert the workflow into unattended outreach.

## Roadmap Note

- This workflow remains part of the governed operational layer, not a CRM reactivation.
- Future scanned-document automation remains a separate design item and is not implemented here.

