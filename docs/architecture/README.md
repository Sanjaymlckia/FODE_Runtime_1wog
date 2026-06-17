# FODE Runtime Architecture

Status: r23B consolidation draft
Scope: documentation and governance only

This folder is the proposed consolidated architecture entrypoint for FODE Runtime.

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

## Current Google Drive Folder

Synced workspace folder:

https://drive.google.com/drive/folders/1P2FkxEQ9oQsk1I1Pyj7lazkaXly049lW?usp=sharing

Local synced path:

`E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog`

