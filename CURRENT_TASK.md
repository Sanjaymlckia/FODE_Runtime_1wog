# Current Task

## Active CIS

- Release target: `r178 Ops Control Hardening + Activation Readiness`
- Mode: local implementation only until a separate deployment approval.
- Do not deploy, `clasp push`, create Apps Script versions, repin deployments, push git, or tag during this implementation step.

## Accepted Baseline

- Release finalized: `r177 Ops Working Surface + Action Router + Admin Review Bridge`
- Commit: `af33ca4`
- Tag: `staging-as177`
- Apps Script version: `186`
- Runtime identity: `r177 / 177`
- Admin staging deployment: `@186`
- Student staging deployment: `@186`
- Admin whoami: `r177 / 177`, `mismatch=false`
- Student whoami: `r177 / 177`, `mismatch=false`
- Script ID: `1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90`
- Expected starting git state: `## main...origin/main`
- Rollback target for r178: repin Admin and Student staging deployments to accepted `r177 @186`.

## r178 Objective

- Make Super Admin detection observable and debuggable.
- Ensure `sanjay@minervacenters.com` resolves as `SUPER` from the canonical role config source.
- Fix legacy Admin portal reset visibility and server gating to `Super Admin` only.
- Clarify the difference between:
  - read-only portal link actions
  - local editing lock/unlock
  - portal reset / lock governance actions
- Classify existing full-functionality actions with exact technical blockers:
  - bulk email preview/send
  - WhatsApp export/email
  - Books draft/test actions
  - portal controls
- Preserve Admin / Ops parity and drift visibility.
- Keep `DriveConfig` / `InstitutionConfig` as future architecture note only.

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

## r178 Local Scope Implemented

- `Admin.js`
  - `renderAdminApp_` now exposes canonical role observability inputs to the template:
    - `SUPER_ADMIN_EMAILS`
    - `ROLE_DECISION_SOURCE`
  - `admin_resetPortalLink` now enforces `requireSuperAdmin_()` server-side.

- `AdminUI.html`
  - added read-only role / identity diagnostic in `Rules & Config` showing:
    - logged-in email
    - detected role
    - `IS_SUPER`
    - role-decision source
    - expected Super Admin account
    - current-email match state
    - Super Admin mode switch visible yes/no
    - reason if hidden
    - temporary delegation status
  - `setRoleUi()` now:
    - hides `Reset Link` from non-super-admin users
    - keeps editing lock buttons clearly labeled as local editing controls
    - renders the role diagnostic each time role UI is applied
  - legacy Admin portal labels clarified:
    - `Unlock` -> `Unlock Editing`
    - `Lock` -> `Lock Editing`
    - helper text now states these do not change applicant portal access state
    - `Reset Link` now states Super Admin only
  - `resetPortalLink()` client path now blocks immediately for non-super-admin users
  - action registry updated with exact activation classifications:
    - bulk preview: `enabled-gated`
    - bulk send: `prepared-r179` with exact recipient-review blocker
    - WhatsApp export/email: `enabled-gated`
    - Books draft create: `prepared-r179` with exact write-config/test-applicant blocker
    - portal reset/lock: `enabled-gated`
  - visible Rules / Config and release-copy drift labels updated from stale `r176` / `r177` references to the accepted `r177` baseline and `r178` next-candidate context

## Canonical Super Admin Source

- `Config.js -> ADMIN_ROLES` is the canonical role source.
- Matching is case-insensitive in `getAdminRole_()`.
- `sanjay@minervacenters.com` is present as `SUPER`.
- `SUPER_ADMIN_EMAILS` also contains `sanjay@minervacenters.com`.
- Do not duplicate Super Admin identity elsewhere unless a later CIS explicitly changes the canonical source.

## Exact Action Classification Notes

- `admin_previewStageBatch`
  - can activate in r178
  - already requires `Super Admin`
  - preview-only, audit-visible, no send

- `admin_sendStageBatch`
  - prepare in r178, activate in r179
  - exact blocker:
    - current send flow validates preview parity and stage snapshot
    - current Ops surface still lacks final recipient-level suppression review before live bulk send

- `admin_exportWhatsAppFallbackCsv`
  - can activate in r178
  - exact basis:
    - `Super Admin` only
    - explicit confirmation
    - capped export
    - audit event
    - no WhatsApp send occurs

- `admin_emailWhatsAppFallbackCsv`
  - can activate in r178
  - exact basis:
    - `Super Admin` only
    - explicit confirmation
    - requires prior cached export snapshot
    - sends only to configured admin recipients

- `admin_createZohoBooksFodeDraftInvoice`
  - prepare in r178, activate in r179
  - exact blocker:
    - requires Books live-write enablement
    - requires preview-ready parity
    - requires explicit Zoho Books test-applicant allowlist
    - current Ops flow does not yet prove safe handoff for create-from-preview

- `admin_sendZohoBooksTestInvoiceEmail`
  - prepare in r178, activate in r179
  - exact blocker:
    - requires draft invoice already created
    - requires test-recipient config
    - should remain tied to explicit Books test applicant flow

## Explicitly Not Activated In This Local r178 Step

- Books draft create/send live activation
- bulk send live activation
- payment verified write
- enrolment write
- parent email correction activation from Ops
- document/status writes from Ops
- overall status override from Ops
- classroom package/mark enrolled
- token backfill apply
- silent/background mass action

## Codebase Size Control

- `AdminUI.html` is already large.
- r178 changes were kept localized to:
  - role observability
  - legacy portal-control clarity
  - action registry classification
- If later r178 review demands larger new UI surfaces, stop and split by boundary:
  - role diagnostics / governance
  - portal controls
  - bulk activation surfaces
  - Books activation surfaces

## Required Local Stop State

- Local implementation and checks only.
- No deployment actions.
- No live send/write/export action executed by Codex.

## Next Exact Step

- Run local validation on the scoped changes.
- Review:
  - Super Admin observability
  - legacy Admin portal reset hardening
  - action-registry activation classification
- If accepted, prepare a separate r178 deployment CIS.
