# Current Task

## Active CIS

- Release accepted: `r174 Operator Console Usability`
- Accepted live release:
  - Commit: `5678c14`
  - Tag: `staging-as174`
  - Apps Script version: `183`
  - Runtime: `r174 / 174`
  - Admin deployment: `@183`
  - Student deployment: `@183`

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

- `AdminUI.html` updated for the r174 operator usability release:
  - operator-first visual order
  - responsive lifecycle stage cascade with inspect/filter behavior
  - full-width applicant queue with selected-row highlight
  - date applied, aging, and dummy/test markers
  - applicant row right-click and long-press context menu
  - Zoho Books filters with meaning, fields used, counts, records, and next action
  - communications template quick look, custom draft controls, selected applicant context, and single-record preview/send gates
  - Classroom Pending explanation and read/write impact notes
  - WhatsApp/contact fallback explanation only
  - Rules & Config setting classification
  - System Health definitions and reason text
- Review hardening applied after `/review`:
  - footer strip explicitly ordered after the operator sections
  - custom email send is blocked if subject/body/recipient changed after preview
- `Admin.js` updated only to remove a stale `r172` label from the classroom handover preview text. No server logic or gates changed.
- `Config.js` released as:
  - `VERSION: "r174"`
  - `DEPLOY_VERSION_NUMBER: 174`

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

- `clasp push` completed.
- Remote source outside the repo root verified:
  - `VERSION: "r174"`
  - `DEPLOY_VERSION_NUMBER: 174`
- Apps Script version created:
  - `183`
  - `r174: operator console usability`
- Canonical Admin deployment repinned to `@183`.
- Canonical Student deployment repinned to `@183`.
- Live Admin `?view=whoami` passed:
  - `r174 / 174`
  - `mismatch=false`
- Live Student `?view=whoami` passed:
  - `r174 / 174`
  - `mismatch=false`
- Operator browser acceptance passed for r174.

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

## r175 Follow-ups

- populate Date Applied and Aging correctly
- refine sidebar/menu alignment
- improve lifecycle stage detail drawer/filtering
- improve applicant context menu behavior
- improve communication composer layout
- add classroom handover checklist/recipient visibility
- clarify System Health warning cause
- design temporary Super Admin delegation model

## Rollback

- If future rollback is required, repin Admin and Student back to accepted `r173 / 173` Apps Script `@182`.
- Verify Admin and Student `?view=whoami`.
- Revert source only if needed after deployment rollback.
