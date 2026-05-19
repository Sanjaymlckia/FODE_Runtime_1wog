# Current Task

## Accepted Baseline

- Latest finalized release: `r182 OPS progressive role stack and acceptance hardening`.
- Commit: `73b17a9`.
- Tag: `staging-as182`.
- Apps Script platform version: `192`.
- Runtime identity: `r182 / 182`.
- Admin staging deployment: `@192`.
- Student staging deployment: `@192`.
- Admin whoami: `r182 / 182`, `mismatch=false`.
- Student whoami: `r182 / 182`, `mismatch=false`.
- Known untracked local tooling residue: `.codexhub/`; do not commit without separate approval.

## Active CIS

- `CIS r183: OPS stabilization cleanup`.
- Mode: small Admin/OPS UI stabilization; not a refactor.
- Release candidate: `r183 / 183`.
- Local `Config.js` identity is bumped to `r183 / 183`.
- Allowed edit files:
  - `AdminUI.html`
  - `CURRENT_TASK.md`
  - `Config.js` only for release bump

## r183 Local Cleanup State

- Lifecycle Cascade / Lifecycle Map restored as a top-level operational concept near the top of OPS.
- Stage cards remain the lifecycle map.
- Bulk communication controls remain a separate Admin/Super Admin action layer.
- Bulk gate wording is mode-aware:
  - Super Admin in Operator Mode: switch to Admin/Super Admin mode to run gated tools.
  - Admin: visible, but execution requires Super Admin when the backend requires it.
  - Operator Mode: escalation awareness only.
- Stage-selection acceptance visibility strengthened:
  - selected stage
  - eligible records
  - blocked records/reason
  - preview availability
  - send availability
- System Health / Release Control stale `r180` labels replaced with dynamic runtime labels or neutral last-recorded-acceptance wording.
- Selected-applicant placeholders no longer default to the old safe target in Communications, Billing, Classroom, or Portal Diagnostics.
- Administrator label clarified as display-only.
- Final sidebar tidy:
  - Lifecycle Map is primary menu item 1.
  - Intake / Queue is primary menu item 2.
  - Applicant Review is no longer a separate primary sidebar item.
  - Applicant Review remains available as a drawer/sub-state from Intake / Queue.

## Authority Notes

- Login role, selected UI mode, action permission, Safe Mode target, and selected applicant are still coupled in legacy UI code.
- Do not refactor role/mode authority in r183.
- Future refactor lane:
  - separate login role from selected UI mode
  - separate action permission from Safe Mode target
  - add non-mutating checks for runtime identity, mode visibility, selected-applicant propagation, and gate reasons

## Safety State

- No backend logic change.
- No `Admin.js` change.
- No send logic change.
- No Books write change.
- No portal reset/lock change.
- No schema or Script Properties change.
- No `appsscript.json` or `.clasp.json` edit.
- `clasp push`: PASS; remote HEAD accepted r183 source.
- Remote source proof: PASS from isolated pull outside repo root.
- Apps Script platform version: `194` for final r183 sidebar tidy.
- Admin staging deployment: pinned to `@194`.
- Student staging deployment: pinned to `@194`.
- Admin whoami: PASS, `r183 / 183`.
- Student whoami: PASS, `r183 / 183`.
- Browser acceptance: BLOCKED in this Codex session because the connected Chrome Extension execution tool is unavailable; operator/manual browser evidence required before commit/tag.

## Next Exact Step

1. Obtain authenticated Admin OPS browser acceptance evidence for `r183 / 183`.
2. Confirm Runtime Verified, Lifecycle Map first, Intake / Queue second, Applicant Review drawer only, mode-aware Bulk Tools gate text, selected-applicant propagation, neutral release labels, and no stale safe-target placeholders.
3. If accepted, stage only `AdminUI.html`, `CURRENT_TASK.md`, and `Config.js`; do not stage `.codexhub/`.
4. Commit/tag only after acceptance approval.
