# F4D.2 Repository Authority and Toolchain Migration v01

## Executive result

PASS.

The active Codex working repository is `D:\Repos\FODE_Runtime_1wog`.

The legacy Google Drive synced repository at `E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog` is archive/reference only.

GitHub is committed-source/review authority. Live Apps Script `whoami` remains runtime truth.

No Apps Script push, deployment, version creation, repin, Sheet mutation, Drive mutation, production, Student staging, or OPS action occurred.

## Baseline

- Starting HEAD: `4d5ab92`
- Admin staging reference: `r301 / 301`
- Production: untouched
- Student staging: unchanged
- OPS: frozen
- `.clasp.json`: unchanged
- Runtime files: unchanged

## Files changed

- `tools/README.md`
- `tools/fode-close-docs.ps1`
- `tools/fode-close-runtime.ps1`
- `tools/fode-dr-backup.ps1`
- `tools/fode-dr-manifest.ps1`
- `tools/fode-release-preflight.ps1`
- `tools/preflight.ps1`
- `tools/verify-remote-config-before-version.ps1`
- `audits/f4d2_repository_authority_toolchain_migration_v01.md`

No `Code.js`, `Admin.js`, `Routes.js`, `Utils.js`, `Config.js`, `AdminUI*.html`, `appsscript.json`, or `.clasp.json` files changed.

## Search terms used

- `E:\Gdrive`
- `C:\GoogleDRIVE`
- `Codex_Sync`
- `FODE_Runtime_1wog`
- `RepoRoot`
- `ExpectedRoot`
- `RemoteCheckRoot`
- `remoteProofFolder`

Search scope included `AGENTS.md`, `docs`, `tools`, and `audits`.

## Reference classification summary

| Classification | Result |
|---|---|
| Historical evidence | Preserved old E: paths in old audit reports, old stabilization notes, screenshots/proof references, and parked patches. |
| Active authority | Already updated by F4D.1 in `AGENTS.md`, `docs/architecture/README.md`, `docs/architecture/Google_Drive_Package.md`, and `tools/README.md`. |
| Documentation/tool default | Updated active tooling defaults from E: to D:. |
| Actual script behavior | Low-risk default path updates only; script control flow was not changed. |
| Requires later review | Historical DR reports still mention E: as the then-current repo; leave as evidence. |
| Obsolete | No deletion in this pass. |

## Tool inventory

| Tool | Classification | Action |
|---|---|---|
| `tools/preflight.ps1` | path-dependent validation default | updated expected repo root to D: |
| `tools/fode-release-preflight.ps1` | path-dependent release preflight default | updated repo root to D: |
| `tools/verify-remote-config-before-version.ps1` | path-dependent remote proof default | updated repo root to D: and remote proof folder to `D:\Repos\_clasp_remote_check_FODE` |
| `tools/fode-close-runtime.ps1` | path-dependent close gate default | updated repo path to D: |
| `tools/fode-close-docs.ps1` | path-dependent close gate default | updated repo path to D: |
| `tools/fode-dr-manifest.ps1` | path-dependent DR manifest default | updated repo root to D: and remote proof metadata folder to `D:\Repos\_clasp_remote_check_FODE` |
| `tools/fode-dr-backup.ps1` | path-dependent DR backup default | updated repo root to D: |
| `tools/fode-release-record.ps1` | repo-relative | no change |
| `tools/fode-staging-health-proof.ps1` | external F: Playwright wrapper | no change |
| `tools/verify-runtime.ps1` | URL/runtime verifier | no path change needed |

## Changed tooling table

| File | Old path | New path | Behaviour changed? | Validation |
|---|---|---|---|---|
| `tools/preflight.ps1` | `E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog` | `D:\Repos\FODE_Runtime_1wog` | No; default expected root only. | PowerShell parse PASS |
| `tools/fode-release-preflight.ps1` | `E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog` | `D:\Repos\FODE_Runtime_1wog` | No; default repo root only. | PowerShell parse PASS |
| `tools/verify-remote-config-before-version.ps1` | `E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog`; `E:\Gdrive\01_SANJAY\Codex_Sync\_clasp_remote_check_FODE` | `D:\Repos\FODE_Runtime_1wog`; `D:\Repos\_clasp_remote_check_FODE` | No; default paths only. | PowerShell parse PASS |
| `tools/fode-close-runtime.ps1` | `E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog` | `D:\Repos\FODE_Runtime_1wog` | No; default repo path only. | PowerShell parse PASS |
| `tools/fode-close-docs.ps1` | `E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog` | `D:\Repos\FODE_Runtime_1wog` | No; default repo path only. | PowerShell parse PASS |
| `tools/fode-dr-manifest.ps1` | `E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog`; `E:\Gdrive\01_SANJAY\Codex_Sync\_clasp_remote_check_FODE` | `D:\Repos\FODE_Runtime_1wog`; `D:\Repos\_clasp_remote_check_FODE` | No; default paths and manifest metadata only. | PowerShell parse PASS |
| `tools/fode-dr-backup.ps1` | `E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog` | `D:\Repos\FODE_Runtime_1wog` | No; default repo root only. | PowerShell parse PASS |

## Governance changes

F4D.1 already recorded the durable governance update:

- active home repo is `D:\Repos\FODE_Runtime_1wog`
- office machine must use a separate Git clone
- Google Drive repo is archive/reference only
- never copy working folders between machines
- GitHub is committed-source/review authority
- live Apps Script `whoami` remains runtime truth
- Apps Script operations remain blocked until a release CIS verifies `.clasp.json`, `Config.js`, and deployment target from the D: clone

F4D.2 extends that governance into tool defaults.

## Multi-machine protocol

- Home: use `D:\Repos\FODE_Runtime_1wog`.
- Office: use a separate clean Git clone.
- Before work on any machine: `git fetch origin`, verify alignment with `origin/main`, and pull only with `git pull --ff-only` when behind.
- After work: commit, push to GitHub, and verify clean/aligned.
- Never copy repo folders between machines.
- Do not use the Google Drive copy as active source.

## Historical references preserved

Historical `E:\Gdrive` references remain in:

- old audit reports
- stabilization notes
- historical evidence links
- failed/parked patch files
- DR reports that describe earlier state

These are evidence records, not active source authority.

## Manual follow-up items

- Run full tooling positive/negative tests in a later Track L pass if desired.
- Before any Apps Script operation from D:, verify `.clasp.json`, `Config.js`, script ID, Admin deployment ID, Student deployment ID, and intended release identity in the active release CIS.
- If external remote proof is re-enabled, confirm `D:\Repos\_clasp_remote_check_FODE` is acceptable and outside the clasp source root.

## Rollback strategy

Revert this commit to restore previous tool defaults. No runtime rollback is needed because no runtime source or deployment state changed.

## Validation

- `git fetch origin` PASS
- `main...origin/main` before work: `0 0`
- PowerShell parse validation for changed `.ps1` files: PASS
- `git diff --check`: PASS
- `git diff --cached --check`: required before commit

## Closure decision

Repository authority migration is complete for active governance and tool defaults.

F4E may proceed after this commit if its CIS uses `D:\Repos\FODE_Runtime_1wog` as the active repo and preserves the Apps Script verification gate.