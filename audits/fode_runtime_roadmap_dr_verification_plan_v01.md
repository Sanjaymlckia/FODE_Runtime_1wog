# FODE Runtime Roadmap, DR, and Verification Plan v01

Date: 2026-06-27  
Classification: Track L - roadmap / disaster recovery / verification planning only  
Runtime baseline referenced: Admin staging r301 / 301  
Repository baseline referenced: `2519fd2 tools: add FODE disaster recovery toolkit`

## Scope

This note verifies the current roadmap against repository evidence and defines the next disaster-recovery and verification plan before F1 runtime audit/refactor work begins.

No runtime source was intentionally changed for this note. No Apps Script version, deployment, repin, Sheet edit, Drive edit, send action, production action, Student staging action, or OPS action is part of this plan.

## Current Repo State Caveat

The working tree is not clean. `Admin.js` is currently modified with manual document-preview backfill wrappers/runner helpers that were source-pushed previously but not committed, versioned, or repinned as a runtime release.

Observed local dirty runtime file:

- `Admin.js`

Relevant uncommitted wrapper/helper names include:

- `manualDryRunDocumentPreviewBackfill_10`
- `manualDryRunDocumentPreviewBackfill_10_Log`
- `manualRunDocumentPreviewBackfill_20`
- `manualRunDocumentPreviewBackfill_50_Once`
- `manualRunDocumentPreviewBackfill_27_25_Once`
- `manualDryRunDocumentPreviewBackfill_FromProperties`
- `manualRunDocumentPreviewBackfill_FromProperties`
- `manualStartDocumentPreviewBackfillRunner`
- `manualStopDocumentPreviewBackfillRunner`
- `manualRunDocumentPreviewBackfillNextBatch`
- `manualGetDocumentPreviewBackfillStatus`
- `manualReportDocumentUploadCompleteness`

F1 must not start until this is resolved by a separate approved decision: commit as controlled runtime utility, or restore/remove the wrappers from the working tree.

## Evidence Inspected

Repository evidence:

- `docs/architecture/Architecture_Overview.md`
- `docs/architecture/Authority_Model.md`
- `docs/architecture/Communication_Model.md`
- `docs/architecture/Data_Source_Authority_Register.md`
- `docs/architecture/Document_AI_Precheck_Model_v01.md`
- `docs/architecture/fode_drive_backed_document_review_architecture_v01.md`
- `docs/architecture/Operational_Model.md`
- `docs/architecture/Operator_Actionability_Resolver.md`
- `docs/architecture/Queue_Model.md`
- `docs/architecture/Roadmap.md`
- `docs/operations/ROADMAP_UNIFIED_OPERATIONS_PLATFORM.md`
- `docs/governance/RELEASE_CLOSURE_DISCIPLINE.md`
- `tools/README.md`
- current tests under `tests/`
- current audits under `audits/`
- recent Git history through `2519fd2`

DR workspace evidence:

- `F:\FODE_DR_Backup\manifests\fode_runtime_recovery_manifest_v01.json`
- `F:\FODE_DR_Backup\manifests\fode_runtime_recovery_manifest_v01.md`
- `F:\FODE_DR_Backup\manifests\restore_checklist_v01.md`
- `F:\FODE_DR_Backup\source_repo_snapshots\`
- `F:\FODE_DR_Backup\apps_script_manifests\`
- `F:\FODE_DR_Backup\release_proofs\`
- `F:\FODE_DR_Backup\playwright_acceptance_reports\`

## Verified Roadmap Status

| Area | Status | Evidence | Notes |
| --- | --- | --- | --- |
| 7C-B document manifest | Complete | `r23D_7C_document_review_gallery_design_v01.md`, document manifest tests | Secure manifest model exists. |
| 7C-C document gallery UI | Complete | `AdminUI.html`, gallery UI tests, accepted r23D.7C work | Current visual gallery is operational. |
| 7C-C+ PNG previews + large overlay | Complete / accepted | r290-r298 commits, `tests/admin-document-file-action.test.js`, `tests/admin-document-gallery-ui.test.js`, operator screenshots | Applicant-folder `FODE_PREVIEW` PNGs and large viewer work. |
| 7C-S document status persistence | Complete | `3feb44b`, `tests/admin-document-status-save-persistence.test.js` | Document status values persist in UI-readable form. |
| 7C-Q Docs_Verified queue-gap fix | Complete | `90a5fbc`, `tests/admin-review-queue-rollup-consistency.test.js` | Rollup and queue tolerance fixed. |
| 7C-D backfill + future previews | Partial | `tests/admin-document-preview-backfill.test.js`, `Code.js` canonicalization hook, uncommitted `Admin.js` wrappers | Future-upload hook exists; historical backfill is parked/in-progress and not fully closed. |
| 7D AI document precheck/crops | Later / not implemented | `Document_AI_Precheck_Model_v01.md` | Advisory model exists only as architecture/planning. |
| E1 stage/opening/review alignment | Mostly complete | `E1C`, `E1D`, `E1E` audit notes and prior release commits | Opening surface and review workflow improved; experimental retirement remains. |
| E2 communication authority model | Partial / active | `E2_Communication_Authority_Audit_v01.md`, H1-H5 audits/tests | Semantic registry and operator surfaces exist; contactability remains partial. |
| E3 selected-applicant email template completeness | Complete / r301 accepted | `ba896e4`, communication semantic tests | Operational templates completed with placeholder blocking. |
| E4 experimental state retirement | Not started | No implementation evidence found | Should remain after communication/contactability stabilization. |
| F-DR1 DR audit | Complete | `audits/fode_runtime_dr_backup_audit_v01.md` | DR audit committed. |
| F-DR2 DR scaffold/manifests | Complete | `F:\FODE_DR_Backup\manifests\*` | Manifest and restore checklist exist. |
| F-DR3 backup toolkit | Complete foundation | `tools/fode-dr-backup.ps1`, `tools/fode-dr-manifest.ps1` | Tooling exists; some operations remain plan-only. |
| F-DR4A release recorder | Complete foundation | `tools/fode-release-record.ps1`, r301 release proof files | Release proof recorder exists and has r301 evidence. |
| F-DR4B full backup operations | Next | DR tools + F: scaffold | Needs controlled execution/verification. |
| F-DR5 restore/DR verification | Next | `restore_checklist_v01.md` | Needs non-destructive restore drill under separate approval. |
| F0 runtime architecture authority | Partially present, not named as F0 | architecture docs under `docs/architecture/` | Recommend a named F0 consolidation before F1. |
| F1 runtime surface/dead-code audit | Not started | No F1 audit found | Should begin only after DR and dirty-tree cleanup. |
| F2 prune/archive plan | Not started | No F2 plan found | Depends on F1 findings. |
| F3 refactor cleanup | Not started | No F3 implementation found | Depends on F1/F2. |
| LAP lifecycle cadence automation | Designed / not implemented | lifecycle docs/functions exist | State derivation exists; scheduled automation is not implemented. |
| GF Google Forms replacement | Planned / not started | DR/D1Y/FormDesigner notes | Near-critical future item, but not current. |
| G1/G2 visual redesign/recolour | Deferred | Roadmap/operator direction | Should remain last. |

## Discrepancies / Corrections to Current Chat Roadmap

1. `7C-D` should be marked `PARTIAL`, not complete. Lazy preview generation and future-upload hook exist, but historical backfill is not fully executed/closed.
2. `F0` architecture authority content exists, but not as a named checkpoint. Treat as `PARTIAL / consolidate before F1`.
3. `E1` is not fully closed if E4 experimental retirement is included. E1C/E1D/E1E are complete or mostly complete; E4 remains not started.
4. `DR` is stronger than 75% for scaffolding/tooling, but lower for recoverability until full backup operations and a restore drill are performed. Recommended status: `foundation complete, operational verification pending`.
5. The local `Admin.js` backfill wrappers are an immediate process risk for F1 because they are uncommitted runtime changes. They must be resolved before any audit/refactor baseline.

## 7C-D Backfill Decision

Recommendation: convert 7C-D historical backfill into a bounded maintenance task, not a blocker for F1.

Rationale:

- Future-upload preview generation is already hooked after canonical copy into applicant folders.
- Operator evidence indicates most rows have no documents: roughly 92% applicants have no docs, 23 rows have any docs, and 6 are complete-doc rows.
- First manual execute batch reportedly scanned 25 rows and created 1 preview with 0 failed conversions.
- Historical backfill has low operational impact compared with F1/F-DR/GF priorities.

Required before closing 7C-D:

1. Decide whether to keep or remove current `Admin.js` manual wrapper changes.
2. If keeping, commit them under a Track H utility/runtime change with tests and release discipline.
3. If removing, restore `Admin.js` and leave backfill as future controlled tooling.
4. Record final backfill status and any remaining applicant IDs with missing preview derivatives.

Do not start F1 while `Admin.js` remains dirty.

## Full DR Verification Plan

### A. Baseline and Release Proof

Commands:

```powershell
git status -sb
git log --oneline -5
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\fode-release-record.ps1 -Plan -RuntimeVersion "r301" -DeployVersion "301" -AppsScriptVersion "301" -AcceptanceStatus "PASS"
```

Expected proof:

- Repo baseline recorded.
- r301 release proof exists or is created under `F:\FODE_DR_Backup\release_proofs\`.
- Admin staging proof path and acceptance evidence are referenced.

Current observed evidence:

- `F:\FODE_DR_Backup\release_proofs\release_r301_20260626_205426.json`
- `F:\FODE_DR_Backup\release_proofs\release_r301_20260626_205426.md`

### B. Repository Snapshot Verification

Command:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\fode-dr-backup.ps1 -Mode RepoSnapshot -Execute
```

Verify:

```powershell
Get-ChildItem F:\FODE_DR_Backup\source_repo_snapshots
Get-FileHash F:\FODE_DR_Backup\source_repo_snapshots\<snapshot>.zip
```

Expected result:

- Timestamped repository ZIP exists.
- SHA hash is recorded in release/DR notes.
- Snapshot is from accepted repo state, not a dirty runtime tree.

### C. Apps Script Manifest Export

Commands:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\fode-dr-backup.ps1 -Mode AppsScriptManifest -Execute
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\fode-dr-manifest.ps1 -IncludeClaspDeployments
```

Expected result:

- Apps Script script ID, deployment IDs, current Admin/Student/production references, clasp metadata, and runtime allowlist are recorded under `F:\FODE_DR_Backup\apps_script_manifests\`.
- This is metadata only; it is not a remote-source proof and not a deployment.

### D. Sheet Export Plan

Current tooling status:

- Sheet export is plan-only unless separately approved.

Recommended controlled next step:

1. Confirm spreadsheet IDs and worksheet names from the manifest.
2. Export timestamped XLSX or CSV snapshots to `F:\FODE_DR_Backup\sheet_exports\`.
3. Record export command, operator account, timestamp, and file hashes.
4. Treat exports as sensitive operational data.

Do not execute Sheet exports without separate approval.

### E. Drive Inventory Plan

Current tooling status:

- Drive inventory is plan-only unless a read-only Drive inventory implementation is separately approved.

Recommended inventory fields:

- applicant ID
- applicant folder ID / URL
- folder name
- file count
- configured document source files found
- `FODE_PREVIEW` PNG count
- missing preview count
- unsupported file count
- folder mismatch/security skip count

Important distinction:

- Original/canonical applicant documents are authority.
- `FODE_PREVIEW` PNG files are derived and rebuildable.
- Do not copy, rename, delete, or move applicant files during inventory.

### F. FormDesigner / Intake Evidence Capture

Capture and archive manually supplied proof for:

- FormDesigner Google Drive account: `enquiries@kundu.ac`
- configured upload folder/disk value
- enabled upload fields
- webhook endpoint/configuration
- file manager screenshots around known break/fix dates

Recommended storage:

- `F:\FODE_DR_Backup\drive_inventory_reports\formdesigner_intake_evidence\`

Do not mutate FormDesigner data as part of DR verification.

### G. Playwright Evidence Archive

Command pattern:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\fode-dr-backup.ps1 -Mode ArchivePlaywrightReports -Execute -PlaywrightReportPath "F:\Playwright\fode-secure-link-diagnostic\reports\<report-folder>"
```

Expected result:

- Accepted health/hydration/communication/gallery proof reports are copied under `F:\FODE_DR_Backup\playwright_acceptance_reports\`.

Current observed evidence includes:

- `F:\FODE_DR_Backup\playwright_acceptance_reports\2026-06-26T07-22-45-815Z-e3-template-r301-rpc-proof\RUN_SUMMARY.md`

### H. Non-Destructive Restore Drill

Do not perform a restore drill in the current task.

Recommended future drill under separate approval:

1. Validate repository snapshot can be opened and contains expected files.
2. Validate Apps Script manifest has enough metadata to identify the project and deployments.
3. Validate Sheet export can be opened and required tabs exist.
4. Validate Drive inventory can identify applicant folders and canonical documents.
5. Validate Playwright health proof can be run against staging after restore.

No live restore, no production action, no Sheet edits, and no Drive mutation.

## F1 Readiness Gate

F1 runtime surface/dead-code audit should start only after all of these are true:

1. Repo is clean and aligned with `origin/main`.
2. Dirty `Admin.js` backfill wrappers are either committed through release discipline or removed/restored.
3. Latest accepted runtime proof is recorded in F: release proofs.
4. Repo snapshot exists and hash is recorded.
5. Apps Script manifest export exists.
6. Restore checklist exists and is reviewed.
7. Sheet export is either completed under approval or explicitly deferred with risk accepted.
8. Drive inventory is either completed under approval or explicitly deferred with risk accepted.
9. F0 architecture authority consolidation is created or existing architecture docs are explicitly accepted as the F0 baseline.
10. Production, Student staging, OPS, Sheets, and Drive mutation boundaries are reaffirmed.

## Recommended Next Sequence

1. Resolve dirty `Admin.js` backfill wrapper state.
2. Run/record full DR verification: repo snapshot, Apps Script manifest, release proof, Playwright archive.
3. Decide whether Sheet export and Drive inventory are required before F1 or can be deferred with explicit risk.
4. Create a short F0 architecture authority checkpoint that maps current authority docs to runtime modules.
5. Start F1 dead-code/runtime surface audit.
6. Defer F2/F3 until F1 produces a prune/archive list.
7. Keep GF replacement and LAP automation after F1/F2/F3 or after a dedicated operational priority decision.
8. Keep G1/G2 visual redesign last.

## Boundary Confirmation

This note is documentation/planning only.

No runtime file was intentionally changed by this note.  
No Apps Script source push was run.  
No Apps Script version was created.  
No deployment was repinned.  
No production action occurred.  
No Student staging action occurred.  
No Sheet edit occurred.  
No Drive data mutation occurred.  
No email was sent.  
OPS remains frozen.

## Classification

READY FOR FULL DR VERIFICATION / F1 READINESS DECISION
