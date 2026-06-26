# FODE Runtime DR / Backup Audit v01

Date: 2026-06-26
Authority: FODE Runtime only
Runtime checkpoint: Admin staging `r301 / 301`
Repo: `E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog`
Status: read-only audit; no live backup copy executed

## 1. Executive Summary

FODE Runtime is partly recoverable today from GitHub, local repo metadata, Apps Script deployment IDs, and F: Playwright evidence. Code recovery is strong. Runtime deployment identity is strong for Admin staging and Student staging. Sheet and Drive recovery are not yet strong because no scheduled Sheet exports, applicant-folder inventory, or document mirror strategy was proven from local repo/config.

The safest next step is a Stage A DR manifest implementation: create a local/non-mutating recovery manifest and inventory scripts that capture critical IDs, Apps Script runtime file hashes, release proof paths, Sheet/tab names, and applicant Drive inventory metadata without copying or modifying live data. Stage B should add controlled Sheet exports and Drive inventory reports. A full document mirror should be designed separately because uploaded originals are source-of-truth and Drive quota/permissions must be handled deliberately.

## 2. Current Recovery Rating

| Area | Rating | Reason |
| --- | --- | --- |
| Code | Recoverable now | Clean Git repo, GitHub remote, `.claspignore` 12-file allowlist, current HEAD known. |
| GitHub | Recoverable now | Remote: `https://github.com/Sanjaymlckia/FODE_Runtime_1wog.git`; branch `main` aligned with `origin/main`. |
| Apps Script | Recoverable with manual effort | Script ID, deployment IDs, current Admin version, and runtime files are known. Rebuild requires clasp auth and release discipline. |
| Sheets | Not safely recoverable yet | Critical spreadsheet IDs/tabs are known, but no scheduled export/backup was proven. |
| Drive applicant documents | Recoverable with manual effort / not safely recoverable at scale yet | Root folder and canonical folder strategy are known, but no applicant document inventory or mirror was proven. |
| FormDesigner intake | Not safely recoverable yet | Runtime canonicalization path is known; FormDesigner source account/folder evidence exists from prior audits, but no independent FD export/backup process is proven. |
| Playwright/tooling | Recoverable now | F: sandbox exists with auth, specs, reports, backups of config/package files. |
| Deployment identity | Recoverable now for staging | Admin staging @301 and Student staging @247 are known from `clasp deployments`; production deployment was not identified in this pass. |

## 3. Critical IDs Discovered

### Apps Script

| Item | Value |
| --- | --- |
| Script ID | `1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90` |
| Admin staging deployment ID | `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ` |
| Admin staging current pin | `@301` |
| Student staging deployment ID | `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv` |
| Student staging current pin | `@247` |
| HEAD deployment | `AKfycbwM8iTBSoEFhz3x-KOVUHsaN8DhJctbM2ksdyHeVmQ @HEAD` |
| Inactive contaminated/recovery deployments | `@93`, `@100` records present in `clasp deployments` |
| Current runtime identity | `VERSION: "r301"`, `DEPLOY_VERSION_NUMBER: 301` |

### Sheets

| Item | Value |
| --- | --- |
| Current `DATA_MODE` | `PROD` |
| Production spreadsheet | `1fHmeGNmpOj9PEPQ5Fp4tUyCP4UdH70lltukraD4SalU` |
| Staging spreadsheet | `1YFgLtUExz__fzQ4zTNoIyGTu-nrnasS7dIaShNPl7Cs` |
| Main data tab | `FODE_Data` |
| Runtime log tab in main spreadsheet | `Webhook_Log` |
| Portal log spreadsheet | `1AQbkHUafLFxqHDqwH3dVHR8gTuOZYtyUPkheby5ejhU` |
| Portal log tab | `Submissions` |
| Portal secrets spreadsheet | `1HEJPtSov-iE5YTpSWWZ89YLIQAw4Eju9DDMG46HkTRc` |
| Portal secrets tab | `PortalSecrets` |
| Exam sites tab | `Exam_Sites` |

### Drive

| Item | Value |
| --- | --- |
| Applicant root folder ID | `1vGD3DoOv1hlxYoTIfrNCZqAnrVKmghuB` |
| Primary applicant root | `1vGD3DoOv1hlxYoTIfrNCZqAnrVKmghuB` |
| Fallback applicant root | blank |
| Year folder | `2025` |
| Upload root script property key | `FODE_UPLOAD_ROOT_ID` |
| Auto upload root | disabled |
| Preview PNG convention | applicant-folder `FODE_PREVIEW` PNG files |
| Preview folder label/config | `Applicant folder FODE_PREVIEW files` |

### Web URLs

| Item | URL |
| --- | --- |
| Admin staging | `https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec` |
| Admin whoami | `https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec?view=whoami` |
| Student staging | `https://script.google.com/macros/s/AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv/exec` |
| Student whoami | `https://script.google.com/macros/s/AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv/exec?view=whoami` |

## 4. Critical Local Paths Discovered

| Path | Purpose | Recovery Role |
| --- | --- | --- |
| `E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog` | Authoritative runtime repo | Primary local source |
| `E:\Gdrive\01_SANJAY\Codex_Sync\_clasp_remote_check_FODE` | External remote proof folder | Evidence/remote-source verification; not source-of-truth |
| `F:\Playwright\fode-secure-link-diagnostic` | Playwright SSD sandbox | Staging proof tooling/evidence |
| `F:\Playwright\fode-secure-link-diagnostic\reports` | Playwright reports | Acceptance evidence |
| `F:\FODE_DR_Backup` | Proposed DR root | Does not currently exist |

## 5. Critical Runtime Files

`.claspignore` allows exactly these Apps Script runtime files:

1. `Admin.js`
2. `AdminUI_OpsApplicantQueue.html`
3. `AdminUI_OpsCommunications.html`
4. `AdminUI_OpsLifecycle.html`
5. `AdminUI_SharedRowFacts.html`
6. `AdminUI.html`
7. `appsscript.json`
8. `Code.js`
9. `Config.js`
10. `Routes.js`
11. `Utils.js`
12. `whoami_admin.html`

These files plus `.clasp.json` and release discipline can reconstruct Apps Script source, assuming clasp auth and Apps Script project access are available.

## 6. Sheet Dependencies

Primary runtime sheet access flows through `getWorkingSpreadsheet_()` and `CONFIG.DATA_MODE`. With `DATA_MODE: "PROD"`, runtime opens `SPREADSHEET_ID_PROD`. Main applicant rows and operational state are in `FODE_Data`; runtime logs are written to `Webhook_Log`; separate portal logs and portal secrets use dedicated spreadsheet IDs.

Critical data if the live Sheet is deleted/corrupted:

- applicant identity and contact fields
- `ApplicantID`
- `Folder_Url`
- document file URL fields
- document status/comment fields
- `Docs_Verified`
- `Payment_Verified`
- communication/log fields
- portal token hash/issued fields
- `File_Log`
- `Webhook_Log`
- portal secrets in `PortalSecrets`

No scheduled export or backup job was proven from local source. This is the highest practical DR gap.

## 7. Applicant Drive Document Dependencies

Canonical applicant document storage is under `CONFIG.APPLICANT_ROOT_FOLDER_ID_PRIMARY`, year folder `2025`, then applicant-specific folders. Runtime uses `Folder_Url`, `CONFIG.DOC_FIELDS`, and file/folder lineage checks to bind documents to applicant rows.

Configured document fields:

| Label | File field | Status field | Comment field | Required |
| --- | --- | --- | --- | --- |
| Birth Certificate / NID / Passport | `Birth_ID_Passport_File` | `Birth_ID_Status` | `Birth_ID_Comment` | yes |
| Latest School Reports / Documents | `Latest_School_Report_File` | `Report_Status` | `Report_Comment` | yes |
| Transfer Certificate (optional) | `Transfer_Certificate_File` | `Transfer_Status` | `Transfer_Comment` | no |
| Passport Size Colour Photo | `Passport_Photo_File` | `Photo_Status` | `Photo_Comment` | yes |
| Admission Fee Payment Receipt | `Fee_Receipt_File` | `Receipt_Status` | `Receipt_Comment` | yes |

Classification:

- Uploaded originals: critical source-of-truth.
- Canonical applicant folders: critical source-of-truth container.
- `FODE_PREVIEW` PNGs: disposable/rebuildable derived artifacts.
- Playwright screenshots/PDFs: evidence, not operational source-of-truth.
- Central/legacy rendition folders: not primary if applicant-folder preview strategy remains accepted.

No applicant folder inventory, document hash report, or mirror was proven in this pass.

## 8. FormDesigner / Intake Dependencies

Runtime intake/canonicalization points include `doPost`, `canonicalizeFdIntakeFiles_()`, `normalizeToUrlList_()`, `prepareApplicantFolder_()`, file copy/canonicalization helpers, FD acknowledgement paths, and FD log events.

Known local/runtime evidence:

- FD form IDs appear as `FormID` / `FD_FormID`.
- Runtime creates/prepares applicant folders before canonical document copy.
- Document URL fields are normalized through configured `DOC_FIELDS`.
- D1Y diagnostics showed FODE canonicalization works when FD sends a usable raw file URL.
- D1Y.5 adds `ACTIVATION_FILE_PAYLOAD_EMPTY_WARNING` when all configured document fields are present but empty and zero files canonicalize.

Previously supplied operator evidence outside this audit indicated FormDesigner Google Drive integration uses `enquiries@kundu.ac` and a configured FD upload folder/disk value. This pass did not inspect FormDesigner or Drive live data. If FormDesigner is unavailable, FODE can keep existing canonicalized applicant folders/documents, but new intake and source raw uploads are at risk until a Google Forms/owned intake replacement is implemented.

## 9. Playwright / Tooling Recovery

F: sandbox exists:

`F:\Playwright\fode-secure-link-diagnostic`

Observed contents include:

- `auth\`
- `helpers\`
- `node_modules\`
- `reports\`
- `specs\`
- `test-results\`
- `package.json`
- `playwright.config.ts`
- `Run-FODE-StagingCheck.ps1`
- backup copies of package/config/runner files

Recent evidence folders include r301 E3 template proof, r301 communication smoke, r301 hydration, r301 health, and r299/r300 document workflow proofs. Tooling is recoverable if F: survives; there is no proven off-F: backup of these reports.

## 10. Current Backup Gaps

1. No proven scheduled Sheet export for production/staging/portal log/portal secrets spreadsheets.
2. No proven applicant folder inventory with applicant ID, folder URL, file count, file IDs, MIME, size, modified time, and hash.
3. No proven backup/mirror of uploaded original documents outside live Drive.
4. No proven FormDesigner configuration/export backup.
5. No proven regular Apps Script runtime manifest export after accepted releases.
6. No proven release ZIP/source snapshot after accepted runtime releases.
7. No documented restore drill evidence for a second operator.
8. F: Playwright reports are useful but not yet part of a durable backup set.
9. Production deployment ID is not identified in repo/config during this pass.

## 11. Recommended F: Backup Structure

Proposed root:

`F:\FODE_DR_Backup\`

| Folder | Purpose | Store | Role | Retention |
| --- | --- | --- | --- | --- |
| `source_repo_snapshots\` | Accepted source snapshots | timestamped ZIPs, commit hash manifest, `.claspignore`, `.clasp.json` redacted copy if needed | backup/evidence | keep latest 12 monthly + every production release |
| `apps_script_manifests\` | Runtime/deployment reconstruction | version list, deployment IDs, 12-file hash manifest, whoami proof, remote proof summary | evidence/rebuild metadata | keep every accepted release |
| `sheet_exports\` | Sheet recovery | timestamped XLSX/CSV exports for main, portal log, portal secrets | backup/source recovery | daily for 30 days, weekly for 12 weeks, monthly for 24 months |
| `drive_inventory_reports\` | Folder/file metadata | root/year/applicant folder inventory, file metadata, counts, hashes if feasible | evidence/recovery map | weekly + after large intake events |
| `applicant_document_inventory\` | Applicant-level document map | applicant ID to folder URL/files/doc fields/preview status | evidence/recovery map | weekly + before major releases |
| `playwright_acceptance_reports\` | Acceptance proof | copied report folders from F: Playwright for accepted releases | evidence | keep every accepted release |
| `release_proofs\` | Release closure packages | validation commands, remote proof path, whoami, deployment metadata, operator evidence links | evidence | keep every accepted release |
| `restore_drills\` | Non-destructive drill records | drill checklist outputs, screenshots, clone/source rebuild proof | evidence | monthly/quarterly |

Do not store raw secrets in the backup root. If `.clasp.json`, auth state, or token files are backed up, they must be encrypted or excluded unless separately approved.

## 12. Minimum Backup Automation Required

Stage A - read-only manifest/inventory:

- Generate `recovery_manifest.json` and `.md`.
- Capture Git HEAD, remote, branch, status.
- Capture `.clasp.json` script ID and `.claspignore` allowlist.
- Capture `Config.js` critical IDs.
- Capture `clasp deployments` output.
- Capture 12 runtime file hashes.
- Capture latest health proof paths.
- Capture known Sheet IDs/tabs and Drive root IDs.
- Capture backup gaps.

Stage B - controlled data backup:

- Export main spreadsheet tabs to timestamped XLSX/CSV.
- Export portal log and portal secrets spreadsheets.
- Generate Drive applicant-folder inventory report.
- Generate applicant document inventory keyed by `ApplicantID`.
- Copy Playwright accepted-release reports into `playwright_acceptance_reports`.
- Create repo ZIP snapshot after accepted release.
- Store Apps Script remote-source hash manifest after accepted release.

Stage C - optional document mirror:

- Dry-run first.
- Bound by applicant count and Drive quota.
- Copy originals only after verifying applicant row, folder lineage, file IDs, and source fields.
- Do not copy generated `FODE_PREVIEW` PNGs unless requested; they are rebuildable.
- Do not delete stale files in first pass.

## 13. Restore Checklist

1. Clone GitHub repo: `https://github.com/Sanjaymlckia/FODE_Runtime_1wog.git`.
2. Verify HEAD/commit against latest accepted release manifest.
3. Restore or verify `.clasp.json` script ID: `1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90`.
4. Verify `.claspignore` 12-file allowlist.
5. Verify `Config.js` runtime identity and critical IDs.
6. Run local syntax/tests for the target recovery release.
7. If rebuilding Apps Script source, run `clasp push` only after identity/source gate.
8. Create Apps Script version only after remote-source proof.
9. Repin Admin/Student only if restore procedure explicitly requires it.
10. Verify Admin whoami and Student whoami.
11. Open restored Sheet export and inspect `FODE_Data`, `Webhook_Log`, portal log, and portal secrets exports.
12. Match applicant folder inventory to applicant IDs and `Folder_Url`.
13. Confirm document originals exist for sampled applicant folders.
14. Rerun F: Playwright health/hydration proof.
15. Record the drill in `restore_drills`.

## 14. Recommended Next CIS

Recommended next task:

`CIS: FODE DR Stage A — Create Read-Only Recovery Manifest and Backup Scaffold`

Scope:

- Track L / No runtime release.
- Allowed files: `tools/fode-dr-manifest.ps1`, `tools/README.md`, `audits/fode_runtime_dr_backup_audit_v01.md` if updates are needed.
- Allowed local folder creation: `F:\FODE_DR_Backup` and subfolders only, if explicitly approved.
- No Sheet export, Drive copy, Apps Script version, deployment, repin, send, OPS, production, or Student changes.

Expected output:

- `F:\FODE_DR_Backup\recovery_manifest\<timestamp>\recovery_manifest.json`
- `F:\FODE_DR_Backup\recovery_manifest\<timestamp>\recovery_manifest.md`
- 12 runtime file hash manifest
- deployment metadata text
- backup gap report

## 15. Risk Classification

| Category | Classification |
| --- | --- |
| Source code | Recoverable now |
| GitHub/source history | Recoverable now |
| Apps Script source | Recoverable with manual effort |
| Apps Script deployment identity | Recoverable now for staging |
| Production deployment identity | Not safely recoverable yet from this pass |
| Operational Sheets | Not safely recoverable yet |
| Applicant Drive originals | Recoverable with manual effort, not safely recoverable at scale yet |
| Generated previews | Recoverable/rebuildable |
| FormDesigner intake | Not safely recoverable yet |
| F: Playwright evidence | Recoverable while F: exists; not backed up elsewhere |

Overall classification: recoverable with manual effort, but not yet disaster-ready.

## 16. Boundary Confirmation

- No Sheet edits.
- No Drive edits.
- No Apps Script deployment.
- No Apps Script version.
- No deployment repin.
- No sends.
- No production change.
- No Student staging change.
- No OPS change.
- No Stage Batch change.
- No payment/Zoho action.
- No Git history mutation.

## 17. Validation Evidence

Commands/evidence used:

- `git status -sb`: clean, `main...origin/main`
- `git remote -v`: GitHub origin confirmed
- `git log -1 --oneline`: `ba896e4 fix: complete selected applicant email templates`
- `.clasp.json`: script ID confirmed
- `.claspignore`: 12 runtime file allowlist confirmed
- `clasp deployments`: Admin @301, Student @247
- `Config.js`: critical Sheet, Drive, deployment, and runtime IDs read
- `F:\Playwright\fode-secure-link-diagnostic`: tooling/report inventory inspected read-only
- `F:\FODE_DR_Backup`: not present

Classification: `READY FOR FODE DR BACKUP IMPLEMENTATION PLAN`
