# Repository Hygiene, Prototype Disposition and EduOps Naming Audit

Date: 2026-07-23

Track: Track L - no runtime release

Repository: `D:\Repos\FODE_Runtime_1wog`

Baseline HEAD / origin/main: `d568fcc5daf1258063fd1012e0859a3014af8559`

Runtime boundary: Admin remains `@416 / r380 / 380`; Student remains `@247 / r217 / 217`; Production untouched. No `clasp push`, Apps Script version, deployment repin, live send, Sheet/Drive/portal-secret/grant mutation, or runtime identity change was performed.

## Archive Evidence

External archive root:

```text
F:\FODE_DR_Backup\release_proofs\repo-hygiene-2026-07-23-2026-07-23-142618
```

Authoritative archive evidence:

- `archive-manifest.json`: 68 entries.
- `sha256-manifest.txt`: 68 checksums.
- `working-tree-before.txt`, `tracked-diff.patch`, `untracked-inventory.csv`, and `classification.md` retained.
- `removed-from-working-tree/` contains moved generated/prototype residue.

The temporary pointer `.repo-hygiene-current-archive-root.txt` was used only during cleanup and is not part of the staged release set.

## Naming Decision

Canonical architecture:

- `EduOps Platform`: shared lifecycle, actionability, communication, population and workspace authority architecture.
- `EduOps Operations Workspace`: current operator-facing surface.
- `?view=eduops`: canonical live route for the EduOps Operations Workspace.

`OpsEdu` is retired as an active durable term. Remaining active source references are classified as either runtime naming debt deferred to `R376J - EduOps Runtime Naming Alignment` or approved compatibility references for schema IDs, DOM selectors, and local preview filenames.

The deployable runtime files `OpsEdu_ClientCockpit.html` and `OpsEdu_CockpitStyles.html` were not renamed in this Track L pass.

## Prototype Disposition

- `prototypes/eduops/`: historical pre-replacement standalone EduOps prototype; archive label `legacy-eduops-standalone-prototype`; removed from working tree after verified external archive.
- `prototypes/eduops-next/`: transitional parity prototype for the current EduOps Operations Workspace; archive label `transitional-eduops-operations-workspace-prototype`; removed from working tree after verified external archive.
- `prototypes/operator-next/`: separate historical operator-surface experiment; generated evidence archived/removed; tracked capture script restored to `HEAD`.

No prototype was promoted into active source.

## Tooling Disposition

Preview and capture tooling:

- `tools/eduops-preview/` renamed to `tools/eduops-snapshot-capture/`.
- `tools/opsedu-preview/` renamed to `tools/eduops-operations-preview/`.
- Generated evidence under the old tool directories was removed from the working tree and remains externally archived.
- Fresh snapshot output now belongs under `tools/eduops-snapshot-capture/evidence/generated/snapshots/`.
- Operations preview generated output now belongs under `tools/eduops-operations-preview/evidence/generated/`.

Browser RPC:

- `tools/fode-readonly-browser-rpc.js` retained as the canonical fixed allowlist read-only browser RPC bridge.
- `tools/fode-h1-browser-rpc.js` retired and deleted.
- H1 backup/migration browser-runner references were removed from active tests/docs; future mutation-capable browser runners require a separate bounded CIS.

Authentication:

- Canonical launcher: `tools/AUTH_FODE_ADMIN_PLAYWRIGHT.cmd`.
- Canonical implementation: `tools/auth-fode-admin-playwright.js`.
- Duplicate helper `tools/fode-playwright-auth.js` removed after its safe shared behavior was folded into the canonical implementation.
- Browser state remains external under the operator Playwright profile path; no cookies, OAuth tokens, refresh tokens, storage state, or profiles were added.

## Generated-Output Governance

Narrow `.gitignore` rules were added for:

- `tools/eduops-snapshot-capture/.tmp/`
- `tools/eduops-snapshot-capture/preview-server.*.log`
- `tools/eduops-snapshot-capture/evidence/generated/`
- `tools/eduops-operations-preview/evidence/generated/`
- `prototypes/*/evidence/generated/`
- `prototypes/*.zip`
- Playwright/browser auth-state, storage-state, session, and profile patterns.

Read-only checker added:

```text
tools/check-repository-hygiene.js
```

Checker result at audit update:

- generated output outside approved directories: 0
- unexpected prototype ZIPs: 0
- auth/session files: 0
- browser profiles: 0
- preview-server logs: 0
- large untracked evidence trees: 0
- active naming classifications:
  - runtime naming debt deferred to R376J: 17
  - historical archive/reference: 15
  - approved compatibility reference: 10
  - defect requiring removal now: 0

## R376I Boundary

R376I remains separate and untouched:

```text
Batch Operations reaches Cohort -> Partitions -> Preview -> Confirm.
The final confirmation/execution transition does not proceed.
```

This Track L cleanup did not edit `EduOps_ClientBatch.html`, attempt a send, retry the batch, refresh-loop the workflow, change idempotency behavior, change callback behavior, run `clasp`, create a version, or repin Admin.

Future work order:

1. Complete repository hygiene and naming cleanup.
2. R376I batch-confirmation repair.
3. R376J runtime naming alignment.

## Validation

Passed:

- `node --check` for changed JavaScript tooling and focused tests.
- `node tests\admin-readonly-rpc-allowlist.test.js`
- `node tests\repository-hygiene-tooling.test.js`
- `node tests\admin-temporary-capability-grants.test.js`
- `node tools\eduops-snapshot-capture\server\capture-fresh-snapshot.js --help`
- `node tools\eduops-snapshot-capture\server\capture-fresh-snapshot.js --dry-run`
- `node tools\eduops-snapshot-capture\tests\preview-contract.test.js`
- `node tools\eduops-operations-preview\tests\validate-r368-preview.js`
- `node tools\eduops-operations-preview\tests\validate-r368a-preview.js`
- operations preview in-process local startup health check: PASS

Final pre-owner-acceptance checks passed:

- `node tests\apps-script-deployable-file-contract.test.js`
- `git diff --check`
- `git diff --cached --check`
- raw staged term scan: expected governance/env-var literals only
- value-bearing staged secret scan: PASS

## Closure State

No deployable Apps Script runtime file changed. `Config.js` remains `r380 / 380`; `runtime-context.json` unchanged. No runtime release action was performed.

The staged set is limited to Track L tooling, tests, docs, audit, directory renames, and intentional generated-evidence deletions.

Final working-tree notes:

- tracked unstaged diff: 0
- unexpected untracked files: 0
- ignored files/directories reported by Git: 2545
- generated/auth/profile/log hygiene findings: 0
- legacy `tools\opsedu-preview\` directory: empty filesystem residue only, not tracked or staged; removal is blocked by an external Windows directory handle
