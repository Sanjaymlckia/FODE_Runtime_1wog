# Current Task

## Active CIS

- Release accepted: `r175 Ops Operational Readiness`
- Accepted live baseline:
  - Commit: `bf50855`
  - Tag: `staging-as175`
  - Apps Script version: `184`
  - Runtime: `r175 / 175`
  - Admin deployment: `@184`
  - Student deployment: `@184`

## Current r176 Local Objective

- Prepare `r176 Ops Stabilization and Drift Control` locally only.
- Clean up Release Control metadata and remove stale next-candidate labels.
- Clarify Admin/Ops parity and role layers to reduce operator drift.
- Improve operational guidance for Applicant Review, System Health, and Release Control meaning.
- Stop after local implementation and validation.
- Do not deploy until a separate approval/release step.

## Verified Starting State

- `git status -sb`: `## main...origin/main`
- `git rev-parse --short HEAD`: `bf50855`
- live Admin `?view=whoami = r175 / 175`, `mismatch=false`
- live Student `?view=whoami = r175 / 175`, `mismatch=false`
- rollback target remains accepted `r174 / 174` Apps Script `@183`

## Allowed File Scope

- `AdminUI.html`
- `CURRENT_TASK.md`
- `Config.js` only during a later r176 release bump

## r176 Local Scope Implemented

- `AdminUI.html`:
  - Release Control metadata now reflects accepted baseline `r175 / staging-as175`
  - accepted commit updated to `bf50855`
  - rollback target clarified as `r174 / staging-as174 / @183`
  - next release candidate updated to `r176`
  - local Git state explicitly marked unavailable from Apps Script unless release metadata is recorded
  - Admin / Ops parity map added:
    - Admin-only
    - Ops-visible
    - Shared
    - Super Admin / Governance
    - Developer / Release
    - Future migration
  - role layers clarified:
    - Operator / Admin
    - Super Admin / Governance
    - Developer / Release
    - temporary Super Admin delegation remains future design only
  - Open Applicant Review guidance now points operators back to the base Admin route and ApplicantID search
  - System Health and Release Control copy clarified as read-only guidance, not live Git/deployment state
  - stale `r174` and `r175-as-next-candidate` labels removed from visible Ops metadata

## Explicitly Not Activated In r176

- no Books invoice creation/send/payment writes
- no payment verified write
- no enrolment write
- no portal reset/lock
- no parent email correction
- no WhatsApp CSV export/email
- no bulk send
- no stage batch send
- no token backfill apply
- no document status save
- no overall status override

## Post-Edit Stop State

- local implementation only
- no `clasp push`
- no Apps Script version
- no deployment repin
- no commit or tag
- release bump in `Config.js` not started

## Next Exact Step

- Review local `AdminUI.html` metadata/guidance cleanup.
- If accepted, run a separate r176 release CIS:
  - bump `Config.js` to `r176 / 176`
  - push
  - remote-source verify
  - create new Apps Script version
  - repin Admin and Student
  - verify `whoami`
  - browser acceptance
  - then commit/tag
