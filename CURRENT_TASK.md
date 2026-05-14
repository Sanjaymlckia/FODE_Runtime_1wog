# Current Task

## Current Runtime Truth

- Live runtime: `r153 / 153`
- Admin whoami: `r153 / 153`, mismatch `false`
- Student whoami: `r153 / 153`, mismatch `false`
- VERSION: `r153`
- DEPLOY_VERSION_NUMBER: `153`
- Current accepted tag: `staging-as153`
- Git status: clean
- No pending deployment
- Current live feature set:
  - queue aging
  - Received/Age/SLA indicators in the admin queue UI
  - safe write-once `Handled_By` and `Handled_At`
- Deferred fields stay deferred:
  - `Enrolled_By`
  - `Enrolled_At`

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
