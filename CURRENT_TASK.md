# Current Task

## Current Runtime Truth

- Live runtime: `r163 / 163`
- Admin whoami: `r163 / 163`, mismatch `false`
- Student whoami: `r163 / 163`, mismatch `false`
- Current release candidate: `r163 / 163`
- Current accepted tag: `staging-as153`
- Git status: source released to Apps Script; browser acceptance and git finalization not yet complete
- Browser acceptance remains pending for the Admin communications preview workflow, applicant review status overlay UI, and the r163 semantic cleanup.
- Current live feature set includes:
  - queue aging
  - Received/Age/SLA indicators in the admin queue UI
  - safe write-once `Handled_By` and `Handled_At`
  - Admin preview diagnostics for communications preview investigation
- r163 scope:
  - semantic cleanup only, not layout redesign
  - rename Stage Dashboard to Operational Pipeline Dashboard
  - rename Lifecycle & Eligibility to Eligibility Diagnostics
  - clarify `PORTAL_SUBMITTED` user-facing communication status text
  - keep raw internal codes available only as diagnostics
- Expected changed files:
  - `AdminUI.html`
  - `Config.js`
  - `CURRENT_TASK.md`
- Deferred fields stay deferred:
  - `Enrolled_By`
  - `Enrolled_At`
- Known UI issue:
  - for `Application Feedback` and `Custom Email`, the old top `Preview` / `Send` buttons remain confusing; a future CIS should hide or disable them or clearly direct staff to the editable panel buttons
- Release invariant is now governed by `AGENTS.md` and `tools/verify-remote-config-before-version.ps1`
- Browser acceptance via Chrome extension is allowed only as narrow acceptance evidence, not as a coding or debug loop
- Next exact step:
  - perform manual Admin browser acceptance for the r163 semantic cleanup
  - if acceptance passes, commit `AdminUI.html`, `Config.js`, and `CURRENT_TASK.md`, push, and tag `staging-as163`
  - if acceptance fails, do not tag; repin Admin and Student to the previous known-good r162 Apps Script platform version before considering source rollback
- Acceptance checklist:
  - Admin whoami = `r163 / 163`
  - Student whoami = `r163 / 163`
  - Operational Pipeline Dashboard heading is visible
  - Eligibility Diagnostics heading is visible
  - `PORTAL_SUBMITTED` shows a clearer user-facing communication status
  - raw internal codes are labeled as diagnostics
  - r162 overlay remains intact
  - legacy Invite/Reminder flow remains unchanged
- Rollback note:
  - repin Admin and Student deployments to the previous known-good r162 Apps Script platform version before considering source rollback

## Accepted Release State

- `r150`: deployed and accepted baseline for the S5C workstream; later superseded.
- `r151`: deployed but rejected at browser acceptance because the S5C email UI reported `Email sent to 0 admin recipient(s): `.
- `r152`: deployed and accepted after fixing the email recipient payload handling.
- `r152` confirmation: admin email delivery was found in Gmail All Mail; inbox absence was a routing/classification outcome, not a runtime failure.
- `r153`: deployed and accepted current release; queue aging and safe handled ownership are live.

## Active Deferred Work

- VCF production test remains parked until business WhatsApp phone access is available.
- Admin identity rationalisation remains deferred as a separate task.
- Future enrolment transition hook for `Enrolled_By` / `Enrolled_At` remains deferred.
- Books-native architecture work remains later-phase work and is not part of the current release.
- Batch feedback/custom email is deferred to a separate CIS. It must include preview count, explicit confirmation, per-applicant result logging, daily cap handling, and no automatic sending.
- AI-assisted document quality scan is deferred. If added later, it must be advisory only for file type, clarity, likely wrong document, passport photo suitability, unreadable scans, missing files, and related quality flags; it must not auto-reject, auto-send, or override Admin review.

## Known Governance Notes

- `r152` S5C email observability is retained: the admin CSV email path now reports recipient count, recipient list, recipient source, and send result.
- `r153` queue aging is deployed and current.
- The write-once handled attribution path is intentional; do not convert it into a repeated-write path.
- Historical handoff blocks referencing `r148`, `r149`, or `r150` as current runtime are stale and no longer authoritative.
- `staging-as153` is the current accepted tag for the live runtime state.

## Resume Instructions

- Resume from `r153 / 153` and trust this file as the current authority.
- Start with the VCF production test if phone access is available.
- Otherwise continue with admin identity rationalisation, then the future enrolment transition hook.
- Keep `Enrolled_By` / `Enrolled_At` deferred until a future CIS explicitly authorizes the transition hook.
- Do not reopen the resolved S5C email UI issue unless a regression appears.
- Do not rely on stale historical handoff blocks for current runtime truth.

## PASS 1 Operational Hardening In Progress

- Target release candidate: `r154 / 154`.
- Scope: operational dashboard, email observability, WhatsApp fallback visibility, duplicate intake protection, trigger/runtime telemetry, and pipeline counts.
- Files in scope: `AdminUI.html`, `Admin.js`, `Code.js`, `Utils.js`, `Config.js`, `CURRENT_TASK.md`.
- Current accepted runtime remains `r153 / 153` until release acceptance completes.
- Local validation: `node --check` passed for `Admin.js`, `Code.js`, `Utils.js`, and `Config.js`; `git diff --check` passed via preflight.
- Release blocked before Apps Script version creation: `clasp push` and `clasp push -f` both failed with `ENOENT: no such file or directory, scandir ''`.
- Do not proceed to `clasp version`, deployment repin, browser acceptance, git commit, tag, or push until the clasp rootDir blocker is explicitly resolved.
- Continuation update: `.clasp.json` normalized to `rootDir:"."`; `clasp status` enumerated the expected project files and `clasp push` succeeded.
- Apps Script version created: `153` with description `r154: PASS1 operational hardening`.
- Canonical Admin and Student deployments repinned to Apps Script version `153`.
- Runtime verification passed: Admin whoami and Student whoami both report `r154 / 154`, mismatch `false`.
- Browser acceptance remains pending because in-app browser automation was unavailable in this session.

## Entity Authority Audit In Progress

- CIS priority: entity authority / orphan PortalSecrets risk supersedes dashboard semantics.
- Known applicant under audit: `FODE-26-002013` / Anthony Makara / `mrova@airniugini.com.pg`.
- Local code-path audit found Student portal rendering and upload/update paths require both a valid PortalSecrets token and a matching current admissions-sheet `ApplicantID` via `findPortalRowByIdSecret_`.
- Local Admin review path (`admin_getApplicantDetail`) requires an admissions-sheet row and returns `DETAIL_ROW_NOT_FOUND` if the `ApplicantID` cannot be found.
- Current sandbox cannot complete live row/count audit because `clasp run` cannot read local API credentials (`Could not read API credentials. Are you logged in locally?`).
- Local `.gsheet` shortcut confirms PortalSecrets spreadsheet id `1HEJPtSov-iE5YTpSWWZ89YLIQAw4Eju9DDMG46HkTRc`; shortcut files do not contain row data.
- No correction has been approved or performed. Do not delete/invalidate PortalSecrets rows or deploy guards until operator approves a correction option.

## Sheet Authority Audit Findings

- Live whoami verified Admin and Student canonical deployments report `r154 / 154`, scriptId `1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90`, mismatch `false`.
- Runtime admissions config: `CONFIG.DATA_MODE=PROD`, spreadsheet id `1fHmeGNmpOj9PEPQ5Fp4tUyCP4UdH70lltukraD4SalU`, working tab `FODE_Data`.
- Local shortcut for runtime admissions sheet: `C:\GoogleDRIVE\2026 Enrolments and Policies\Forms FODE\FODE_Applications_2026.gsheet`.
- Runtime admissions spreadsheet tabs observed: `FODE_Data` gid `0`, `Webhook_Log` gid `1463759150`, `Exam_Sites` gid `1695378500`.
- Runtime PortalSecrets config: spreadsheet id `1HEJPtSov-iE5YTpSWWZ89YLIQAw4Eju9DDMG46HkTRc`, tab `PortalSecrets`, gid `0`.
- Local shortcut for PortalSecrets: `C:\GoogleDRIVE\01 Corporate\03 Portal_Secret\FODE Portal Secrets 2026.gsheet`.
- `FODE-26-002013` is present in runtime admissions `FODE_Data` row `2014` with Anthony Makara / `mrova@airniugini.com.pg`.
- `FODE-26-002013` is present in runtime PortalSecrets `PortalSecrets` row `2002`, status `Active`.
- This is not an orphan PortalSecrets case based on runtime-authoritative sheets.

## r155 Upload Evidence Semantics Fix In Progress

- Target release candidate: `r155: upload evidence semantics fix`.
- Scope: prevent empty upload placeholders such as `[]`, `[ ]`, `{}`, `null`, `undefined`, `none`, and `not uploaded` from counting as uploaded evidence.
- Code changes made in `Utils.js`, `Admin.js`, and `Code.js` only.
- `hasUploadEvidence_` now centralizes upload evidence detection and requires a real Drive URL/file id or valid uploaded-file object/list.
- Admin detail, review queue payment evidence, mandatory document issue detection, and lifecycle receipt evidence now use upload-specific evidence semantics instead of generic non-empty string checks.
- Expected result for `FODE-26-002013`: `Fee_Receipt_File=[]` should display `Payment Evidence Uploaded: No` unless a valid receipt artifact exists.
- Local validation passed: `node --check Admin.js`, `node --check Code.js`, `node --check Utils.js`, `node --check Config.js`, `git diff --check`, and `clasp status`.
- Release blocked: `clasp push` failed with `Could not find script. Did you provide the correct scriptId? Are you logged in to the correct account with the script?`
- `clasp login --status` reports an unknown user and failed access checks for `script.google.com`, `drive.google.com`, and Google Cloud/Developer Console.
- Do not proceed to `clasp version`, deployment repin, browser acceptance, git commit, tag, or push until clasp authentication/account access is restored.

## r155 Identity Correction In Progress

- Canonical deployments were repinned to Apps Script platform version `154`, but live whoami still reported `VERSION=r154` and `DEPLOY_VERSION_NUMBER=154`.
- Root cause: `Config.js` identity was not bumped before creating the r155 Apps Script platform version.
- `Config.js` has been corrected to `VERSION: "r155"` and `DEPLOY_VERSION_NUMBER: 155`.
- Local `AGENTS.md` now includes a mandatory Release Identity Gate requiring `Select-String -Path Config.js -Pattern "VERSION|DEPLOY_VERSION_NUMBER"` readback before `clasp version`.
- Pre-version identity readback confirmed `VERSION: "r155"` and `DEPLOY_VERSION_NUMBER: 155`.
- Local validation passed: `node --check Config.js`, `node --check Admin.js`, `node --check Code.js`, `node --check Utils.js`, `git diff --check`, and `clasp status`.
- `clasp push` succeeded and Apps Script platform version `155` was created with `r155: upload evidence semantics fix identity correction`.
- Canonical Admin and Student deployments were repinned to Apps Script platform version `155`; contaminated `@93`, recovery `@100`, and `@HEAD` deployments were not modified.
- Runtime verification passed: Admin and Student whoami both report `VERSION=r155`, `DEPLOY_VERSION_NUMBER=155`, expected scriptId, and `mismatch=false`.
- Browser acceptance remains pending because the Browser control tool is unavailable in this session. Do not commit, push, tag, or mark `staging-as155` accepted until Admin browser checks pass, including `FODE-26-002013` showing `Payment Evidence Uploaded: No`.

## r156 Editable Applicant Feedback Emails Release In Progress

- Feature source is the committed change `feat: add editable applicant feedback emails`.
- `Config.js` identity was bumped to `VERSION: "r156"` and `DEPLOY_VERSION_NUMBER: 156` before Apps Script version creation.
- Identity readback confirmed `VERSION: "r156"` and `DEPLOY_VERSION_NUMBER: 156`.
- Local validation passed: `node --check Admin.js`, `node --check Code.js`, `node --check Config.js`, and `git diff --check`.
- `clasp push` succeeded.
- Apps Script platform version `156` was created with description `r156: editable applicant feedback emails`.
- Canonical Admin deployment `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ` and canonical Student deployment `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv` were repinned to Apps Script platform version `156`.
- Runtime verification passed: Admin and Student `?view=whoami` both report `VERSION=r156`, `DEPLOY_VERSION_NUMBER=156`, expected scriptId `1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90`, and `mismatch=false`.
- Browser acceptance is still incomplete in this session because authenticated Admin UI interaction could not be exercised with the available tools.
- Do not commit release metadata, push git, or tag `staging-as156` until the Admin browser acceptance matrix is completed and passes.

## r157 Bugfix Release Failed Identity Gate

- `r156` passed runtime identity but failed browser acceptance for Applicant Feedback preview and editable panel readability.
- `r157` target scope is limited to:
  - `Code.js` preview-default fix so blank edited subject/body do not override generated defaults
  - `AdminUI.html` dark-theme editable panel styling fix
- No new feature work, schema changes, batch email, or AI scan are part of `r157`.
- `clasp push` succeeded.
- Apps Script platform version `157` was created with description `r157: fix applicant feedback preview and styling`.
- Canonical Admin deployment `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ` and canonical Student deployment `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv` were repinned to Apps Script platform version `157`.
- Identity gate failed: after repin, both Admin and Student `?view=whoami` still reported `VERSION=r156` and `DEPLOY_VERSION_NUMBER=156`.
- Do not browser-accept, commit, push git, or tag `staging-as157`.
- Next required action is to correct the platform/version-content mismatch under release discipline, then repin and re-verify live `whoami`.

## r158 Trust Reset In Progress

- Remote source pull from scriptId `1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90` confirmed `Config.js` was already `r157 / 157`, so the r157 failure was narrowed to the Apps Script version/deployment chain rather than local or remote source mismatch.
- Corrective action: create a fresh `r158 / 158` Apps Script version after bumping local and remote source identity, then repin canonical Admin and Student deployments and re-verify live `whoami` before any browser acceptance.

## r159 Release Chain Repair Failed Before Version Creation

- Local `Config.js` has been bumped to `VERSION: "r159"` and `DEPLOY_VERSION_NUMBER: 159`.
- Pre-version identity readback confirmed local `Config.js` is `r159 / 159`.
- `.clasp.json` still targets the expected scriptId `1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90`.
- `clasp push` returned `Skipping push.` despite the local `Config.js` identity change.
- Controlled `clasp push --force` failed with `A file with this name already exists in the current project: appsscript`.
- Isolated remote pull from the target script still shows `.codex_tmp_remote_pull/Config.js` at `VERSION: "r157"` and `DEPLOY_VERSION_NUMBER: 157`.
- Hard release gate failed: remote source was not proven `r159 / 159`, so no `clasp version` was created for `r159`.
- Canonical Admin and Student deployments remain pinned to Apps Script platform version `158`; no repin or browser acceptance was attempted in this CIS.
- Next required action is to diagnose why `clasp push` is skipping or force-push is colliding on `appsscript.json`, then repeat the remote-proof gate under a new CIS before any version creation.

## r160 Admin Communications Preview Handling Deployed, Browser Acceptance Pending

- Local `Config.js` was bumped to `VERSION: "r160"` and `DEPLOY_VERSION_NUMBER: 160`.
- Pre-version identity readback confirmed local `Config.js` is `r160 / 160`.
- `clasp push` succeeded and pushed 8 Apps Script source files.
- External remote pull outside the repo confirmed remote `Config.js` is `r160 / 160` before version creation.
- Apps Script platform version `160` was created with description `r160: fix admin communications preview handling`.
- Canonical Admin deployment `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ` and canonical Student deployment `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv` were repinned to Apps Script platform version `160`.
- Live whoami verification passed:
  - Admin reports `VERSION=r160`, `DEPLOY_VERSION_NUMBER=160`, expected scriptId, `mismatch=false`
  - Student reports `VERSION=r160`, `DEPLOY_VERSION_NUMBER=160`, expected scriptId, `mismatch=false`
- Browser acceptance is still pending in this session because authenticated Admin UI interaction could not be exercised with the available tools.
- No live email was sent.
- Do not commit, push git, or tag until the Admin browser acceptance matrix is completed and passes.
