# FODE Release Tooling

These scripts are staged gates. They are not a one-click release system.

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
