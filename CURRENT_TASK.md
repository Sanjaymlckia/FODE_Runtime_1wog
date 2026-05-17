# Current Task

## Active CIS

- Release target: `r179 Ops Full Working Surface`
- Mode: local implementation only until a separate deployment approval.
- Do not deploy, `clasp push`, create Apps Script versions, repin deployments, push git, or tag during this implementation step.

## Accepted Baseline

- Release finalized: `r178 Super Admin Portal Controls and Action Activation Clarity`
- Commit: `9a6f53f`
- Tag: `staging-as178`
- Apps Script version: `188`
- Runtime identity: `r178 / 178`
- Admin staging deployment: `@188`
- Student staging deployment: `@188`
- Admin whoami: `r178 / 178`, `mismatch=false`
- Student whoami: `r178 / 178`, `mismatch=false`
- Script ID: `1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90`
- Expected starting git state: `## main...origin/main`
- Rollback target for r179: repin Admin and Student staging deployments to accepted `r178 @188`.

## r179 Objective

- Make Ops a full working surface instead of a dashboard-only console.
- Keep WhatsApp / communications capability first.
- Keep bulk communications capability second.
- Make Admin Mode the primary working surface and prevent Admin/Ops drift.
- Keep Books read surfaces aggressively usable.
- Improve operational navigation and grouping without redesign.

## Allowed File Scope

- `AdminUI.html`
- `Admin.js`
- `CURRENT_TASK.md`
- `Config.js` only during a later release bump

## Forbidden Unless Separately Approved

- `Code.js`
- `Routes.js`
- `Utils.js`
- `appsscript.json`
- `.clasp.json`
- Sheets, Drive, deployment state, Apps Script versions, and tags

## Local r179 Scope Implemented

- `AdminUI.html`
  - added a functional session-persistent top-left mode switch:
    - `Operator Mode`
    - `Admin Mode`
    - `Super Admin Mode`
  - mode visibility now follows existing role detection:
    - Super Admin: all modes
    - Admin: Operator + Admin
    - other users: Operator only
  - visible role strip now shows:
    - logged-in email
    - detected role
    - current mode
  - mode switching now changes visible working surfaces instead of being cosmetic
  - selected applicant context is preserved across mode changes
  - Admin Mode is now the primary working surface inside Ops for:
    - Billing / Books reads
    - Communications
    - Classroom Handover
    - WhatsApp / Contact Fallback
  - Super Admin governance sections are now mode-scoped instead of always competing with operator work
  - lifecycle stage selection now also prepares bulk-stage context for bulk preview/send
  - added an Ops bulk communications card using the existing stage-batch preview/send path
  - upgraded WhatsApp fallback section from passive diagnostics to governed working controls:
    - export limit/filter visible
    - export/email buttons visible
    - buttons explicitly labeled Super Admin-only when blocked
    - no direct WhatsApp send path exposed
  - added a drift prevention register covering:
    - duplicated action paths
    - Admin-only actions
    - Ops-only actions
    - shared actions
    - legacy Admin-only actions
  - relabeled disabled actions to avoid dead buttons:
    - `Prepared`
    - `Coming Soon`
    - `Super Admin-only`
  - updated stale release/runtime copy from r177-era placeholders to accepted r178 baseline and r179 next-candidate wording

## Drift Prevention Snapshot

- Duplicated action paths:
  - Applicant review bridge plus legacy Admin review remain intentionally paired
- Admin-only actions:
  - portal reset
  - portal access lock/unlock
  - WhatsApp export/email
  - bulk send candidate
  - Books draft/test writes
- Ops-only actions:
  - lifecycle cascade
  - selected-applicant queue routing
  - role-driven mode switch
  - operator dashboard grouping
- Shared actions:
  - applicant email preview/send
  - billing preview
  - open invoice
  - portal diagnostics
  - classroom preview/notify
- Still using legacy Admin only:
  - document verification edits
  - overall override
  - parent-email correction
  - detailed modal document handling

## Explicitly Not Activated In This Local r179 Step

- direct WhatsApp send
- uncontrolled bulk send
- Books draft create/test email live activation
- payment verified write
- enrolment write
- document/status writes from Ops
- overall status override from Ops
- classroom package / mark enrolled
- token backfill apply
- silent/background mass action

## Required Local Stop State

- Local implementation and checks only.
- No deployment actions.
- No live send/write/export action executed by Codex.

## Next Exact Step

- Run local validation on the scoped changes.
- Review:
  - functional mode switching
  - Admin-primary working surface grouping
  - WhatsApp and bulk working-path activation
  - drift prevention register
  - no dead-button regressions
- If accepted, prepare a separate r179 deployment CIS.
