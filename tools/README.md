# FODE Release Tooling

These scripts are staged gates. They are not a one-click release system.

## Active Repository Authority

Active Codex working repo:

`D:\Repos\FODE_Runtime_1wog`

The old Google Drive synced copy at `E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog` is archive/reference only.

GitHub remains review authority.

Do not run Apps Script source push, version creation, or deployment repin from the D: clone until `.clasp.json`, `Config.js`, and Apps Script project authority are verified from the D: clone in the active release CIS.

Tool defaults now target the active D: repo. Historical audit paths may still mention E: as evidence; do not treat those historical paths as active source authority.

## Tracks

- `Track L`: UI, documentation, audits, and local tooling with no behavior or authority change.
- `Track H`: backend, send/write, security, payment, schema, or other material runtime risk.
- Tooling/documentation-only stabilization is `Track L - No runtime release`.

## FODE Release Tracks and Gate Tiers

Repository governance permits exactly `Track L` and `Track H`. Do not introduce another track such as `Track T` unless repository governance is formally changed.

### Track L - No Runtime Release

Use for documentation, audits, tooling, reports, local scripts, and other non-runtime changes.

Track L must not change:

- `Code.js`, `AdminUI.html`, or `Config.js`;
- Apps Script runtime behavior;
- send/preview behavior or Stage Batch mappings;
- Sheets or Drive data;
- production, Student staging, or OPS.

Light gate:

- repo status;
- exact-file diff;
- parser or syntax checks for changed tooling;
- `git diff --check`;
- proof that no runtime file changed;
- proof that no deployment, version, repin, send, Sheet, Drive, OPS, production, or Student action occurred.

### Track H - Runtime / Communication / UI / Release Authority

Use for Apps Script runtime files, communication templates, send/preview behavior, selected-applicant communication exposure, Stage Batch mappings, lifecycle authority, payment/document authority, and staging or production releases.

#### Standard Gate

Use for Track H staging releases with no `AdminUI.html` change and no send-surface authority change.

- clean/aligned baseline and expected HEAD;
- Config identity;
- relevant syntax and tests;
- remote-source proof;
- Apps Script version and Admin staging repin;
- hydration/health proof;
- confirmation production, Student, Sheets, Drive, send, and OPS remain untouched.

#### Full Gate

Use when scope includes `AdminUI.html`, send/preview authority, selected-applicant send surfaces, Stage Batch, lifecycle authority, payment/document authority, production, or work following a recent hydration failure.

Full Gate includes all Standard Gate checks plus:

- full relevant regression tests;
- AdminUI inline-script parsing when AdminUI changes;
- 60-second hydration proof;
- operator-surface and no-send/send-authority proof;
- Stage Batch proof when relevant;
- rollback plan;
- complete remote runtime-file proof;
- recorded evidence paths.

Production always requires Full Gate.

Practical rule:

- Track L: Light Gate.
- Track H without AdminUI/send-surface changes: Standard Gate.
- Track H with AdminUI/send-surface/Stage Batch/lifecycle/payment-document authority: Full Gate.
- Production: Full Gate.

## Scripts

### `preflight.ps1`

Read-only runtime source checks:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\preflight.ps1
```

It validates the authoritative repo path, Config identity contract, critical flags, JavaScript syntax, Git diff hygiene, canonical URLs, and identity-source safeguards.

### `fode-release-preflight.ps1`

Read-only release baseline gate:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\fode-release-preflight.ps1 `
  -ExpectedHead 517cfde `
  -ExpectedLatestAppsScriptVersion 285 `
  -ExpectedAdminDeploymentId "ADMIN_DEPLOYMENT_ID" `
  -ExpectedAdminDeploymentVersion 285 `
  -ExpectedStudentDeploymentId "STUDENT_DEPLOYMENT_ID" `
  -ExpectedStudentDeploymentVersion 247
```

It verifies main/HEAD, clean or explicitly allowed changes, the exact 12-file clasp allowlist, latest Apps Script version, and independent Admin/Student deployment metadata. It performs no mutation.

### `fode-close-runtime.ps1`

Runtime/identity commit gate. It requires matching `Config.js` identity, stages only the supplied files, and asks before staging and committing.

It does not push, `clasp push`, create Apps Script versions, or repin deployments.

### `fode-close-docs.ps1`

Track L documentation/audit commit gate. It does not require runtime identity and accepts explicit Markdown files only by default.

Runtime files and non-Markdown files are rejected unless the operator deliberately supplies `-AllowRuntimeFiles`. The script never deploys or pushes.

### `verify-remote-config-before-version.ps1`

External remote-source proof gate. It requires explicit `-AllowExternalRemoteCheck`.

It:

- validates the script ID and local Config identity;
- refuses proof folders inside the repo;
- pulls source into the approved external proof folder;
- requires exactly the 12 allowlisted runtime files;
- hash-compares every runtime file with local source;
- optionally verifies required `Code.js` and `AdminUI.html` markers;
- prints the proof path and `SAFE TO RUN clasp version` only after all checks pass.

It does not run `clasp push`, create a version, or repin.

### `verify-runtime.ps1`

Read-only live whoami verification with independent Admin and Student identities:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\verify-runtime.ps1 `
  -AdminExpectedRuntime "r285" -AdminExpectedDeploy 285 `
  -StudentExpectedRuntime "r217" -StudentExpectedDeploy 217
```

Live whoami is runtime truth. `clasp deployments` is metadata only. If the Google wrapper hides inner whoami content from `Invoke-WebRequest`, use the authenticated F: Playwright proof.

### `fode-staging-health-proof.ps1`

Track L read-only wrapper for the authenticated F: Playwright proof lane. It supports:

- `health`: Admin reachability/build health;
- `hydration60`: waits 60 seconds and requires cleared runtime loading, Review buttons, and no page/console errors;
- `operator`: opens a Review modal and validates the selected-applicant communication picker without preview/send;
- `all`: runs all three modes.

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\fode-staging-health-proof.ps1 `
  -AdminUrl "https://script.google.com/macros/s/ADMIN_DEPLOYMENT_ID/exec" `
  -ExpectedRuntime "r286" `
  -ExpectedDeploy 286 `
  -Mode all `
  -Strict
```

The wrapper fails closed on Playwright failure, identity mismatch, persistent `Runtime: loading...`, missing Review buttons, blocking page errors, or report content that records failure. It prints timestamped evidence paths under the configured F: report root.

It does not deploy, repin, send, preview, edit Sheets, or mutate Drive. Operator acceptance remains human-reviewed.

The shared communication smoke assertion uses stable message-type values and verifies current approved labels. It no longer depends on the obsolete `/invite/` text fragment.

The F: Playwright lane is currently an external, non-Git proof dependency. The wrapper relies on:

- `F:\Playwright\fode-secure-link-diagnostic\specs\fode-legacy-admin-health.spec.ts` for reachability/build health;
- `F:\Playwright\fode-secure-link-diagnostic\specs\fode-admin-hydration60.spec.ts` for the 60-second hydration gate;
- `F:\Playwright\fode-secure-link-diagnostic\specs\fode-admin-communication-smoke.spec.ts` for the read-only selected-applicant communication surface.

These external specs and their auth state are not copied into the FODE runtime repository. Reports, screenshots, traces, and test output remain on F:. Back up or place the F: Playwright project under separate version control before treating it as durable release infrastructure.

### `fode-dr-manifest.ps1`

Track L disaster recovery scaffold and manifest generator. It creates the F: recovery workspace and writes local recovery manifests/checklists:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\fode-dr-manifest.ps1 -IncludeClaspDeployments
```

Default target:

`F:\FODE_DR_Backup`

Created folders:

- `source_repo_snapshots`
- `apps_script_manifests`
- `sheet_exports`
- `drive_inventory_reports`
- `applicant_document_inventory`
- `playwright_acceptance_reports`
- `release_proofs`
- `restore_drills`
- `manifests`
- `logs`

Outputs:

- `F:\FODE_DR_Backup\manifests\fode_runtime_recovery_manifest_v01.json`
- `F:\FODE_DR_Backup\manifests\fode_runtime_recovery_manifest_v01.md`
- `F:\FODE_DR_Backup\manifests\restore_checklist_v01.md`

The script reads local repo/config metadata and optionally `clasp deployments`. It does not deploy, repin, create Apps Script versions, export Sheets, copy Drive files, send email, or touch production/Student/OPS.

### `fode-dr-backup.ps1`

Track L DR backup operations wrapper. It is dry-run by default:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\fode-dr-backup.ps1 -Mode Plan
```

Supported modes:

- `RepoSnapshot`: creates a local ZIP only when `-Execute` is supplied.
- `AppsScriptManifest`: writes a local metadata manifest only when `-Execute` is supplied.
- `SheetExportPlan`: prints Sheet export requirements; does not export.
- `DriveInventoryPlan`: prints Drive inventory requirements; does not read/copy Drive.
- `ApplicantDocumentInventoryPlan`: prints applicant document inventory schema; does not read/copy Drive.
- `ArchivePlaywrightReports`: copies one explicit F: Playwright report folder only when `-Execute -PlaywrightReportPath ...` are supplied.

This script intentionally does not implement live Sheet export or Drive inventory execution yet. Those require a separate CIS because they touch live data services, even if read-only.

### `fode-release-record.ps1`

Track L release evidence recorder. After an accepted runtime release, it creates timestamped JSON and Markdown proof records under:

`F:\FODE_DR_Backup\release_proofs`

Plan mode shows the output paths and values without creating files:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\fode-release-record.ps1 `
  -Plan `
  -RuntimeVersion "r301" `
  -DeployVersion "301" `
  -AppsScriptVersion "301" `
  -ReleaseClassification "Track H" `
  -AcceptanceStatus "PASS"
```

Execute mode writes the release record only:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\fode-release-record.ps1 `
  -Execute `
  -RuntimeVersion "r301" `
  -DeployVersion "301" `
  -AppsScriptVersion "301" `
  -ReleaseClassification "Track H" `
  -AcceptanceStatus "PASS" `
  -HealthProofPath "F:\Playwright\fode-secure-link-diagnostic\reports\..."
```

The recorder reuses `F:\FODE_DR_Backup\manifests\fode_runtime_recovery_manifest_v01.json` when present and accepts explicit overrides. It does not call Apps Script, Google Drive, or Google Sheets APIs. It does not deploy, repin, create Apps Script versions, export Sheets, copy Drive files, send email, or touch production/Student/OPS.

## Approval Gates

Keep separate approvals for:

1. commit;
2. push;
3. `clasp push`;
4. external remote-source proof;
5. Apps Script version creation;
6. Admin staging repin;
7. browser/operator acceptance.

No tool in this folder sends email, edits Sheets, mutates Drive data, drops stashes, creates Apps Script versions, or repins deployments.

Production and Student staging remain out of scope unless a separate CIS explicitly authorizes the exact action.
