# Current Task

## Active CIS

- Release accepted: `r175 Ops Operational Readiness`
- Accepted live release:
  - Commit: `pending local git finalize`
  - Tag: `staging-as175`
  - Apps Script version: `184`
  - Runtime: `r175 / 175`
  - Admin deployment: `@184`
  - Student deployment: `@184`

## Baseline Verified Before Release

- `git status -sb`: `## main...origin/main [ahead 2]`
- `git rev-parse --short HEAD`: `5678c14`
- accepted live baseline before bump:
  - commit `609e513`
  - tag `staging-as173`
  - Apps Script `@182`
  - Admin `?view=whoami = r173 / 173`, `mismatch=false`
  - Student `?view=whoami = r173 / 173`, `mismatch=false`

## Allowed File Scope

- `AdminUI.html`
- `Admin.js` only if required and justified
- `Config.js` only after review approval for the release identity bump
- `CURRENT_TASK.md`

## Released Scope

- `AdminUI.html` only:
  - Date Applied / Aging now prefers queue `received*` and `age*` fields with explicit missing-source reasons
  - Applicant Queue supports low-risk Date Applied / Aging sort buttons
  - lifecycle drill-down detail shows count, visible records, selected applicant, and next action
  - applicant row context menu narrowed to non-mutating navigation actions only
  - communications panel shows selected applicant, recipient, subject/body summary, Safe Mode state, and current block reason
  - classroom handover panel shows checklist, preview state, recipient visibility, and notify reason
  - System Health cause text expanded with contributing reasons and next suggested action
  - stale accepted-baseline labels corrected to the accepted `r174` live baseline

## Still Explicitly Not Activated In r175

- all r174 disabled items remain disabled
- no Books invoice creation/send
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

## Explicitly Not Activated In r174

- bulk send
- stage batch send
- docs bulk follow-up
- Books draft invoice create
- Books invoice send
- Books payment creation
- payment verified write
- enrolment write
- portal link reset
- portal lock/unlock
- parent email correction
- document status save
- overall status override
- WhatsApp CSV export/email
- token backfill apply
- mark classroom enrolled

## Release Outcome

- `Config.js` released as:
  - `VERSION: "r175"`
  - `DEPLOY_VERSION_NUMBER: 175`
- `clasp push` completed.
- Remote source outside the repo root verified:
  - `VERSION: "r175"`
  - `DEPLOY_VERSION_NUMBER: 175`
- Apps Script version created:
  - `184`
  - `r175: ops operational readiness`
- Canonical Admin deployment repinned to `@184`.
- Canonical Student deployment repinned to `@184`.
- Live Admin `?view=whoami` passed:
  - `r175 / 175`
  - `mismatch=false`
- Live Student `?view=whoami` passed:
  - `r175 / 175`
  - `mismatch=false`
- source-level Codex review passed for r175.
- operator review accepted for r175.

## Accepted Browser Evidence

- runtime `r174 / 174` visible
- lifecycle cascade visible and improved
- applicant queue improved with selected context and test/live markers
- Billing/Zoho filters visible with explanations and counts
- Communications template quick look/custom email controls visible
- Classroom Pending explanation visible
- Reports acceptable as evolving placeholders
- Governance/Runtime Truth separated
- Rules & Config meaning improved
- System Health meaning visible
- no forbidden write exposure observed

## r175 Remaining / Deferred

- refine sidebar/menu alignment only if a visible issue remains after source review
- temporary Super Admin delegation model remains design-only and was not implemented in this local pass
- no server payload change was made; if recipient/checklist detail later proves insufficient, raise a separate CIS for `Admin.js`

## Rollback

- If future rollback is required, repin Admin and Student back to accepted `r174 / 174` Apps Script `@183`.
- Verify Admin and Student `?view=whoami`.
- Revert source only if needed after deployment rollback.
