# Current Task

## Active CIS

- Release candidate: `r174 Operator Console Usability`
- Local candidate objective: make Ops Cockpit usable as a daily operator console while preserving existing write gates.
- Accepted live baseline before editing:
  - Commit: `609e513`
  - Tag: `staging-as173`
  - Apps Script version: `182`
  - Runtime: `r173 / 173`
  - Admin deployment: `@182`
  - Student deployment: `@182`
  - Git state before editing: `## main...origin/main`

## Baseline Verified Before Editing

- `git status -sb`: clean `## main...origin/main`
- `git log --oneline -5`: latest `609e513 release: r173 ops safe-mode lifecycle mapping`
- `clasp deployments`: canonical Admin and Student staging deployments pinned to `@182`
- Admin `?view=whoami`: embedded payload showed `r173 / 173`, `mismatch=false`
- Student `?view=whoami`: embedded payload showed `r173 / 173`, `mismatch=false`

## Allowed File Scope

- `AdminUI.html`
- `Admin.js` only if required and justified
- `Config.js` only after review approval for the release identity bump
- `CURRENT_TASK.md`

## Local Implementation State

- `AdminUI.html` locally updated for the r174 usability candidate:
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
- `CURRENT_TASK.md` updated for this r174 local candidate handoff.
- `Admin.js` updated only to remove a stale `r172` label from the classroom handover preview text. No server logic or gates changed.
- `Config.js` unchanged. Local source still reports `VERSION: "r173"` and `DEPLOY_VERSION_NUMBER: 173` until review approval.

## Explicitly Not Activated In r174 Local Candidate

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

## Stop State

- Local implementation only.
- No `clasp push`.
- No `clasp version`.
- No deployment repin.
- No browser acceptance.
- No tag.
- Next required operator step: review local diff and approve or reject the r174 identity bump/release workflow.

## Future Release Workflow After Review Approval Only

1. Bump `Config.js` to `VERSION = "r174"` and `DEPLOY_VERSION_NUMBER = 174`.
2. Run `Select-String -Path Config.js -Pattern "VERSION|DEPLOY_VERSION_NUMBER"` and `git diff -- Config.js`.
3. Run `clasp push`.
4. Verify remote source outside the repo contains `r174 / 174`.
5. Create Apps Script version.
6. Repin Admin and Student staging deployments.
7. Verify Admin `whoami = r174 / 174`, `mismatch=false`.
8. Verify Student `whoami = r174 / 174`, `mismatch=false`.
9. Run browser acceptance.
10. Commit/push/tag only after acceptance.

## Rollback

- If future release acceptance fails after deployment, repin Admin and Student back to accepted `r173 / 173` Apps Script `@182`.
- Verify Admin and Student `?view=whoami`.
- Do not tag a failed release.
