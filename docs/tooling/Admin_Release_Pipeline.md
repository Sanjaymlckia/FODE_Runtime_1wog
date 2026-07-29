# Admin Release Pipeline

Status: R392A tooling consolidation. No runtime release is authorized by this document.

## Primary Command

Use the governed Admin staging release command for normal bounded releases:

```powershell
.\tools\Invoke-FodeAdminRelease.ps1 `
  -ReleaseClass BackendSemantic `
  -ExpectedAdminRuntime r392 `
  -ExpectedAdminDeploy 392 `
  -ExpectedStudentRuntime r217 `
  -ExpectedStudentDeploy 217
```

The command detects changed files, prints the minimum release class, rejects risk downgrades, creates a manifest, runs the class-specific validation plan, preserves repeated remote Config readback before version creation, repins Admin only, verifies runtime identity, and stops before Git commit.

Default final status:

`Not committed or pushed - awaiting final owner acceptance`

## Release Classes

`DocsOnly`: documentation, governance, local tooling metadata and tests. No runtime identity bump, `clasp push`, Apps Script version or deployment repin.

`ClientOnly`: active Admin client/browser-side source. Uses Fast Gate by default: changed-file syntax/parser checks, deployability contracts, client/workbench regressions selected by dependency mapping, and the permanent critical-invariant suite. Full Gate runs only when an escalation condition applies.

`BackendSemantic`: server logic, DTOs, routing, classification, Finance, capability or authority semantics. Uses Fast Gate plus affected-domain regressions by default, with runtime identity bump, repeated remote readback and Admin-only staging verification. Full Gate runs only when an escalation condition applies.

`HighRiskAuthority`: communication send authority, Batch/bulk authority, applicant mutation, population integrity, identity authority, settlement authority, deployment authority or durable communication architecture. Includes BackendSemantic controls plus authority/prohibition tests and manual acceptance checklist. It never auto-commits.

## Test Gates

`Fast Gate` is the normal gate for bounded Admin staging releases. It runs:

- syntax and parser checks for changed files;
- `git diff --check`;
- release-pipeline and Apps Script deployability contracts;
- tests directly associated with changed files or declared feature scope;
- dependency-selected regression tests;
- the permanent critical-invariant suite.

The permanent critical-invariant suite covers Admin deployment identity/runtime verification, Student protection, Production protection, server-side capability enforcement, Finance read-only authority, Batch-send prohibition, population-integrity fail-closed behavior, stale-response/applicant-binding protection for runtime changes, and Apps Script deployability.

`Full Gate` runs the complete repository suite only when an escalation condition applies:

- Production release;
- `HighRiskAuthority` release;
- shared classifier, identity, capability framework, DTO framework, workload framework or release infrastructure changes;
- dependency mapping is incomplete or uncertain;
- broad cross-domain changes;
- test-selection logic changes;
- scheduled repository health validation;
- explicit operator request;
- Fast Gate failure indicates wider regression risk.

A normal bounded `ClientOnly` or `BackendSemantic` release must not require the complete repository suite solely because it changes runtime code.

The pipeline reports the selected gate, direct tests, dependency-selected tests, critical-invariant tests, escalation reasons, tests intentionally not run and residual bounded-selection risk. It fails closed to Full Gate when it cannot determine a safe bounded selection.

## Automatic Classification

The pipeline classifies each changed file conservatively:

- `docs/**`, governance docs, local tooling docs, `runtime-context.json`, `tools/**` and `tests/**`: `DocsOnly`.
- Active Admin/EduOps HTML and browser-side source: `ClientOnly`.
- Active server JS, DTO, routing, Finance, capability, lifecycle or `Config.js`: `BackendSemantic`.
- Communication, Batch, population integrity, idempotency, receipt, deployment or unknown active-runtime files: `HighRiskAuthority`.

An operator may choose a higher class. A lower class is rejected.

## Dry Run

Use:

```powershell
.\tools\Invoke-FodeAdminRelease.ps1 -ReleaseClass BackendSemantic -DryRun
```

Dry run performs repository validation, change detection, risk classification, manifest preview, proposed identity calculation, test-plan selection, deployment-target validation and evidence preview.

Dry run does not edit `Config.js`, run `clasp push`, create Apps Script versions, repin deployments, stage files, commit, push or mutate live systems.

## Owner Acceptance Boundary

After staging verification, review the generated evidence and then close with:

```powershell
.\tools\Complete-FodeReleaseCommit.ps1 `
  -CommitMessage "fix: repair bounded release"
```

The closure command loads the manifest, verifies the current diff hash, rejects post-acceptance drift, confirms runtime identity, stages only manifest-approved files, runs `git diff --cached --check`, commits once, pushes, verifies `HEAD == origin/main`, verifies ahead/behind `0 / 0`, and requires a clean working tree.

## Resume And Failure Behaviour

The manifest records baseline commit, diff hash, release class, runtime identity, release identifier and stage state. Resume decisions must be based on the manifest plus fresh remote readback; local state alone is not release truth.

Failures are explicit. The pipeline reports the failed stage and stops. It does not automatically roll back, retry remote mutation, repin Student, repin Production, or continue after mandatory validation failure.

## Evidence

Evidence reports are written under:

`docs/audits/releases/`

Release manifests are written under:

`.release-proof/admin-release/`

Evidence must not contain OAuth credentials, clasp tokens, applicant personal data, Gmail content or sensitive integration values.

## Protected Boundaries

Admin staging is the only deployment the pipeline may repin. Student and Production are protected targets. The pipeline must not send Gmail, execute Batch send, mutate applicants, mutate Sheets, mutate Drive, write to Zoho, write to Google Classroom, modify Student or modify Production.
