# Current Task

## Accepted Baseline

- Latest finalized release: `r181 OPS invoice workflow acceptance fixes`.
- Commit: `2f339ca`.
- Tag: `staging-as181`.
- Apps Script platform version: `191`.
- Runtime identity: `r181 / 181`.
- Admin staging deployment: `@191`.
- Student staging deployment: `@191`.
- Admin whoami: `r181 / 181`, `mismatch=false`.
- Student whoami: `r181 / 181`, `mismatch=false`.
- Browser evidence accepted: Admin OPS loaded, Runtime Verified visible, Admin Mode visible, Books Connected visible.
- Known untracked local tooling residue: `.codexhub/`; do not commit without separate approval.

## Active CIS

- `CIS r182: OPS Progressive Role Stack, Linear Navigation, and Acceptance Hardening`.
- Mode: r182 release preparation with remote source verification gate.
- Release candidate: `r182 / 182`.
- Local `Config.js` identity is bumped to `r182 / 182`.
- Release gate state:
  - `clasp push`: PASS; remote HEAD accepted r182 source.
  - Remote source proof: PASS from isolated pull outside repo root.
  - Apps Script platform version: `192`.
  - Admin staging deployment: pinned to `@192`.
  - Student staging deployment: pinned to `@192` for shared runtime identity alignment.
  - Admin whoami: PASS, `r182 / 182`.
  - Student whoami: PASS, `r182 / 182`.
  - Browser acceptance: BLOCKED in this Codex session because the connected Chrome Extension execution tool is unavailable; operator/manual browser evidence required before commit/tag.

## Files In Scope

- Allowed edits used in this pass:
  - `AdminUI.html`
  - `CURRENT_TASK.md`
- Release identity edit:
  - `Config.js` bumped to `r182 / 182`.
- Not edited in this pass:
  - `Admin.js`
  - `Code.js`
  - `Routes.js`
  - `Utils.js`
  - `appsscript.json`
  - `.clasp.json`
  - Student-facing UI files

## r182 Implementation State

- OPS role visibility is now progressive in the client UI:
  - Operator sees Operator items.
  - Admin sees Operator plus Admin items.
  - Super Admin sees Operator plus Admin plus Super Admin items.
- Left navigation has been reordered into the r182 operational sequence:
  1. Intake / Queue
  2. Applicant Review
  3. Communications
  4. Billing
  5. Classroom Handover
  6. Exceptions
  7. Bulk Tools
  8. Reports / Exports
  9. Operational Supervision
  10. System Health
  11. Rules / Configuration
  12. Portal Controls
  13. Books / Email / Send Gates
  14. Runtime / Release Governance
- Main OPS section ordering now follows the same lifecycle using existing section IDs and backend routes.
- Billing acceptance observability improved:
  - Billing shows invoice number, invoice ID, status, target URL, target source, and last check.
  - Open Invoice records deterministic target state before attempting to open.
  - Popup/new-tab failure is visible as a blocked result.
  - Invoice Open Target panel is visually prominent in Billing near the selected-applicant invoice controls.
  - Existing invoice URL lookup support is preserved; no invoice creation/send behavior changed.
- Communications acceptance observability improved:
  - Preview-only controls are visually separated from send/write controls.
  - Preview audit is grouped with preview-only controls; send/write controls are in a separate warning group.
  - Custom preview controls are separated from custom send.
  - Read-only preview audit block shows ApplicantID, recipient, subject, template key/type, preview status/timestamp, and body preview.
  - Send workflow semantics and Safe Mode gates are unchanged.
- Bulk Communications is visible to Operator as an escalation-awareness block only:
  - Operator cannot run Preview Cohort or Send Stage Batch.
  - Operator block reason: `Operator can view this capability but cannot run bulk communication actions.`
  - Existing Admin/Super Admin bulk gates are unchanged.

## Safety State

- Apps Script version created: `192`.
- Admin and Student staging deployments repinned to `@192`.
- No commit or tag.
- No trigger install/remove.
- No Books write.
- No invoice creation/send.
- No payment creation.
- No CRM write.
- No portal reset/lock action.
- No schema or Script Properties change.

## Release Gate Plan

1. Obtain authenticated Admin OPS browser acceptance evidence for `r182 / 182`.
2. Confirm Runtime Verified, role inheritance, menu order, Operator bulk escalation block, Communications preview/send separation, and Invoice Open Target.
3. If accepted, stage only `AdminUI.html`, `CURRENT_TASK.md`, and `Config.js`; do not stage `.codexhub/`.
4. Commit/tag only after acceptance approval.

## Next Exact Step

- Provide connected Chrome Extension or manual browser evidence for Admin OPS after r182 repin.
