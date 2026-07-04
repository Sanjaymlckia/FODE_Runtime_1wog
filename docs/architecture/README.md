# FODE Runtime Architecture

Status: r301+ architecture sync
Scope: documentation and governance only

This folder is the consolidated architecture entrypoint for FODE Runtime.

Runtime source, Apps Script deployment, queues, communications, Sheets, and send behavior are not changed by this documentation package.

## Architecture Index

| Area | Document |
|---|---|
| Architecture overview | [Architecture_Overview.md](Architecture_Overview.md) |
| Authority model | [Authority_Model.md](Authority_Model.md) |
| Operational model | [Operational_Model.md](Operational_Model.md) |
| Population Ledger model | [Population_Ledger_Model.md](Population_Ledger_Model.md) |
| Operator Actionability Resolver | [Operator_Actionability_Resolver.md](Operator_Actionability_Resolver.md) |
| Communication model | [Communication_Model.md](Communication_Model.md) |
| Queue model | [Queue_Model.md](Queue_Model.md) |
| Roadmap | [Roadmap.md](Roadmap.md) |
| Governance and source map | [Governance.md](Governance.md) |
| Migration plan | [Migration_Plan.md](Migration_Plan.md) |
| Google Drive package | [Google_Drive_Package.md](Google_Drive_Package.md) |
| Mermaid sources | [Mermaid/](Mermaid/) |

## Core Architecture Rule

Truth authorities determine what is true.

The Operator Actionability Resolver determines what should happen next.

The Operator Actionability Resolver is derived, read-only, and non-authoritative.

## Target Flow

```text
Raw Facts
-> Shared Row Facts
-> Authority Layer
-> Population Ledger
-> Operator Actionability Resolver
-> Dashboard / Operations Workspace / Lifecycle Map / Communications
```

## r301+ Runtime Truth

As of the r301 baseline, Legacy/Admin is the live operational authority surface. OPS is frozen as a reference/secondary surface. FormDesigner remains the current intake path, while Google Forms replacement remains future work.

Protected live surfaces include document verification, signed document routes, applicant-folder preview/gallery/lightbox, payment verification, Zoho Books, communication semantic registry, Stage Batch separation, runtime identity, release governance, and DR tooling.

Partial/future surfaces include classroom acceptance/handover authority, LAP automation, contactability/bounce ingestion, AI-assisted document precheck, and Google Forms replacement.

## Documentation Impact Rule

Every future CIS that changes runtime architecture, state transitions, queues, authority, protected surfaces, release governance, communication semantics, payment/Zoho, document verification, intake, DR, or OPS boundaries must explicitly state whether these files need updating:

- Mermaid diagrams
- Roadmap
- Architecture authority documents
- Lifecycle/state diagram
- Protected Surface Register

## Validation Level Rule

Refactor-only F4/F5 slices use Level 1 validation by default: relevant `node --check`, targeted Node regression tests, `git diff --check`, and the required audit/report. Playwright is not required for these refactors and should not be recovered if it fails to start.

Feature/UI slices use Level 2 validation: Level 1 plus manual browser inspection when visible UI intentionally changed. Playwright is used only when browser proof is specifically needed.

Release slices use Level 3 validation: release preflight, authorized Apps Script source push/version/repin, live `whoami`, and manual/operator acceptance. Playwright remains optional release evidence only when the release CIS explicitly requests it or a browser-only regression needs proof.

Historical Playwright reports remain valid evidence for the releases they documented.

## Engineering Efficiency Policy

Docs-only work uses the lightest deterministic closure: `git status -sb`, `git diff --check`, exact-file staging, one final `git diff --cached --check`, commit, and push. Do not run Node tests or Playwright for docs-only tasks unless the CIS explicitly requires docs tooling validation.

Refactor work validates only changed runtime files and the tests protecting the changed authority surface. Do not run broad exploratory validation unless a concrete defect is found.

Playwright is reserved for visible UI behavior changes, release proof, suspected browser-only regressions, or explicit operator request.

For Windows runner/session failures, attempt normal execution once. If `CreateProcessAsUserW failed: 1312` or an equivalent session failure occurs, immediately use the approved repo-local execution path and do not spend time on repeated recovery attempts.

Apps Script operations remain prohibited unless explicitly authorized by the active release CIS.

## Current Google Drive Folder

Archived Google Drive workspace folder:

https://drive.google.com/drive/folders/1P2FkxEQ9oQsk1I1Pyj7lazkaXly049lW?usp=sharing

Archived local synced path:

`E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog`

## Active Codex Working Repo

Active local working path:

`D:\Repos\FODE_Runtime_1wog`

The E: Google Drive copy is archive/reference only. GitHub remains review authority.

Do not run `clasp push`, create Apps Script versions, or repin deployments from the D: clone until `.clasp.json`, `Config.js`, and Apps Script project authority are verified from that clone in the active release CIS.
