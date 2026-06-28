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
-> Operator Actionability Resolver
-> Dashboard / Queues / Communications
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
