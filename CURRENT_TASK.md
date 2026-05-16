# Current Task

## Active CIS

- Release target in progress: `r173 / 173`
- Objective: Ops truth/safety correction, Safe Mode gating, and lifecycle/portal/fallback mapping.
- Accepted live baseline: `r172 / 172`
- Accepted baseline commit: `1125023`
- Accepted baseline tag: `staging-as172`

## Proven Baseline Before Editing

- Admin `?view=whoami`: `r172 / 172`, `mismatch=false`
- Student `?view=whoami`: `r172 / 172`, `mismatch=false`
- Script ID: `1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90`
- Admin deployment: canonical staging deployment pinned to Apps Script `@180`
- Student deployment: canonical staging deployment pinned to Apps Script `@180`
- Admin `?view=ops` route loads

## Allowed File Scope

- `AdminUI.html`
- `Admin.js`
- `Config.js`
- `CURRENT_TASK.md`

Audit artifacts may remain untracked:

- `audits/r173/r173_ops_feature_audit.json`
- `audits/r173/r173_ops_feature_audit.md`

## Required r173 Scope

- Correct misleading Ops labels and stale acceptance/runtime text.
- Add explicit Safe Mode banner and approved-target gating for existing Ops live actions.
- Separate Operator/Admin workflow surfaces from Super Admin/Governance surfaces.
- Add lifecycle/stage cascade mapping.
- Add Student Portal diagnostics mapping.
- Add WhatsApp/contact fallback diagnostics mapping.

## Explicitly Disabled In r173

- Portal link reset
- Portal lock/unlock
- Parent email correction
- Document status save
- Overall status override
- Payment verified write
- Books draft invoice creation
- Books test invoice email
- Books payment/contact mutation
- WhatsApp CSV export/email
- Bounce scan write action
- Docs bulk send
- Stage batch preview/send
- Token backfill apply
- Classroom package generation
- Mark classroom enrolled

## Local Implementation State

- `Config.js` now contains the `OPS_SAFE_MODE_*` config block.
- `Admin.js` now contains centralized Ops Safe Mode gating and deterministic diagnostics for Ops mutation actions.
- `AdminUI.html` now:
  - corrects misleading action-mode labels
  - makes the Operator/Admin layer primary
  - moves governance/runtime/release surfaces secondary
  - adds lifecycle cascade mapping
  - adds Student Portal diagnostics mapping
  - adds WhatsApp/contact fallback diagnostics mapping
- Local source only. No `clasp push`, version, repin, commit, or tag has been run for `r173`.

## r173 Acceptance Outcome

- Local `Config.js` was bumped to `r173 / 173`.
- `clasp push` completed.
- Remote-source verification outside the repo root passed for:
  - `VERSION: "r173"`
  - `DEPLOY_VERSION_NUMBER: 173`
  - latest `AdminUI.html` row-selection acceptance fix
- Apps Script versions created during r173 acceptance:
  - `181`
    - `r173: Ops truth/safety correction + safe-mode lifecycle mapping`
  - `182`
    - `r173: ops safe-mode lifecycle mapping with row-selection acceptance fix`
- Canonical Admin and Student staging deployments are accepted on `@182`.
- Live Admin `?view=whoami` passed:
  - `r173 / 173`
  - `mismatch=false`
- Live Student `?view=whoami` passed:
  - `r173 / 173`
  - `mismatch=false`
- Accepted operator evidence for r173:
  - Ops loads with `r173 / 173`
  - Safe Mode visible
  - approved row identity `FODE-26-002929` visible
  - approved row email visible
  - test recipient override separated and visible
  - applicant email sends shown as `Safe Test Only`
  - classroom notify shown as `Safe Test Only`
  - non-approved row `FODE-26-002928` selected and context updated
  - non-approved row displayed `Not approved for Safe Mode send`
  - no unintended email/write observed
  - Books/payment/enrolment/WhatsApp/export writes remain disabled
  - lifecycle, Student Portal diagnostics, and WhatsApp/contact fallback mapping visible
- Owner accepted approved-row positive send based on configured Safe Mode state and prior known single-send/email behavior.
- `r173` is accepted.

## Finalization

- Final source finalization:
  - `git add Admin.js AdminUI.html Config.js CURRENT_TASK.md audits/r173/r173_ops_feature_audit.json audits/r173/r173_ops_feature_audit.md`
  - `git commit -m "release: r173 ops safe-mode lifecycle mapping"`
  - `git push`
  - `git tag staging-as173`
  - `git push origin staging-as173`

## Rollback

- If a future rollback is required, repin Admin and Student back to accepted `r172 / 172` Apps Script `@180` first.
- Verify Admin and Student `?view=whoami`.
- Revert source only if needed after deployment rollback.
