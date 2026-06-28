# F4D.1 Repository Authority Path Update v01

## Executive result

PASS.

The active Codex working repository authority is now documented as:

`D:\Repos\FODE_Runtime_1wog`

The old Google Drive synced copy is now archive/reference only:

`E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog`

GitHub remains review authority.

## Scope

Track L documentation-only update.

No runtime files were edited. No Apps Script push, deployment, version creation, repin, Sheet mutation, Drive mutation, production, Student staging, or OPS action occurred.

## Files updated

- `AGENTS.md`
- `docs/architecture/README.md`
- `docs/architecture/Google_Drive_Package.md`
- `tools/README.md`
- `audits/f4d1_repository_authority_path_update_v01.md`

## Search performed

Searched for:

- `E:\Gdrive`
- `C:\GoogleDRIVE`
- `Codex_Sync`
- `FODE_Runtime_1wog`

Search scope:

- `docs`
- `audits`
- `tools`
- `AGENTS.md`

## Update policy

Updated only active authority/workflow documentation.

Preserved historical audit references where they describe past evidence, past local paths, old screenshots, old command outputs, or historical proof locations.

PowerShell tool defaults were not changed in this docs-only pass. `tools/README.md` now warns that legacy script defaults may still reference the old E: path and require explicit CIS review before use.

## Authority statements added

- Active Codex working repo is `D:\Repos\FODE_Runtime_1wog`.
- Old E: Google Drive synced copy is archive/reference only.
- GitHub remains review authority.
- No Apps Script push, version creation, deployment repin, or release action may be performed from the D: clone until `.clasp.json`, `Config.js`, and Apps Script project authority are verified from the D: clone in the active release CIS.

## Validation

Required validation:

- `git diff --check`
- `git status -sb`

## Remaining follow-up

Optional future Track L tooling pass:

- update PowerShell script default `RepoRoot` paths from E: to D:
- verify each script still fails closed from the D: clone
- rerun tooling parse checks

That was intentionally not included here because this CIS requested docs-only updates.
