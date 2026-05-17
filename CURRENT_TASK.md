# Current Task

## Active CIS

- Release target: `r177 Ops Working Surface + Action Router + Admin Review Bridge`
- Mode: local implementation only until a separate release approval.
- Do not deploy, push with clasp, create Apps Script versions, repin deployments, push git, or tag during this implementation step.

## Corrected r176 Baseline

- Release finalized: `r176 Ops Stabilization and Drift Control`
- Commit: `5f7d309`
- Tag: `staging-as176`
- Apps Script version: `185`
- Runtime identity: `r176 / 176`
- Admin staging deployment: `@185`
- Student staging deployment: `@185`
- Admin whoami: `r176 / 176`, `mismatch=false`
- Student whoami: `r176 / 176`, `mismatch=false`
- Script ID: `1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90`
- Expected starting git state: `## main...origin/main`
- Rollback target for r177: repin Admin and Student staging deployments to r176 `@185`.

Do not use r175, r174, `@183`, `@184`, or older runtime references as the active baseline.

## r177 Objective

Make Ops Cockpit materially usable as a working operator console:

- Clickable/context-menu actions open real selected-applicant surfaces.
- Open Applicant Review opens the selected ApplicantID directly or uses an Ops review drawer fallback.
- Selected applicant drives Billing, Communications, Portal Diagnostics, Classroom Handover, and Reports context.
- Single-record email/classroom notify may be enabled only through existing gates, explicit owner confirmation, visible recipient/target, and audit logging.
- Bulk email and WhatsApp fallback must be classified from existing function readiness before activation.
- Super Admin mode shell must be visible only to Super Admin and must not silently activate dangerous writes.

## Allowed File Scope

- `AdminUI.html`
- `Admin.js`
- `Config.js`
- `CURRENT_TASK.md`

## Forbidden Unless Separately Justified

- `Routes.js`
- `Code.js`
- `appsscript.json`
- `.clasp.json`
- Sheets, Drive, Apps Script deployment state, Apps Script versions, and tags

## Explicitly Not Activated Without r177 Matrix Approval

- Books invoice create/send/payment
- payment verified write
- enrolment write
- portal reset/lock
- parent email correction
- document/status writes
- overall status override
- classroom package/mark enrolled
- token backfill apply
- silent/background mass action

## r177 Architecture Notes

- Current app/code projects live under Sanjay GDrive / Codex sync.
- Operational data remains in the respective institution/operation drives such as KIA enquiries, KIA data sources, KIA-FODE, and MLC-related roots.
- Do not physically consolidate drives in r177.
- Current separate-drive arrangement is acceptable for now.
- Future shared-core work should introduce an `InstitutionConfig` / `DriveConfig` registry with institution, branch, brand/program, source spreadsheet IDs, Drive folder IDs, Books org/portal IDs, Admin deployment, Student deployment, document roots, portal configuration, billing configuration, classroom/LMS handover configuration, and permission model.

## Codebase Hotspots

- `AdminUI.html`: large UI surface; avoid uncontrolled sprawl.
- `Admin.js`: large RPC/action surface; keep r177 changes scoped.
- `Code.js`: large portal/core surface; do not edit in r177 unless a Student Portal bridge is explicitly required.
- `Routes.js`: route file appears unnecessary for r177 because existing `doGet` routes `admin` and `ops`.

Near-term modularization targets:

- Ops action registry
- applicant review drawer
- communications composer
- billing/Books panel
- portal diagnostics
- classroom handover panel
- role/permission helpers
- shared action registry

## Required Local Stop State

- Local implementation and checks only.
- No `clasp push`.
- No Apps Script version.
- No deployment repin.
- No tag.
- No live send/write/export action executed by Codex.
