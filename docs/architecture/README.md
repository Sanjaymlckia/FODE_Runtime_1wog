# FODE Runtime Architecture

Status: Architecture Build V1 freeze candidate at Admin `@373`, runtime `r340 / 340`
Scope: documentation and governance only

This folder is the consolidated architecture entrypoint for FODE Runtime.

Runtime source, Apps Script deployment, queues, communications, Sheets, and send behavior are not changed by this documentation package.

## Architecture Index

| Area | Document |
|---|---|
| Architecture overview | [Architecture_Overview.md](Architecture_Overview.md) |
| Architecture Build V1 closure | [Architecture_Build_V1_Closure.md](Architecture_Build_V1_Closure.md) |
| V1 backup and recovery | [Backup_and_Recovery_V1.md](Backup_and_Recovery_V1.md) |
| Authority model | [Authority_Model.md](Authority_Model.md) |
| Operational bucket model | [Operational_Bucket_Model.md](Operational_Bucket_Model.md) |
| ACP Phase 1 ADR | [ACP_Phase_1_Authority_Consolidation_ADR.md](ACP_Phase_1_Authority_Consolidation_ADR.md) |
| Contactability ADR | [../adr/ADR_Contactability_Exceptions_as_First_Class_Operational_Bucket.md](../adr/ADR_Contactability_Exceptions_as_First_Class_Operational_Bucket.md) |
| Zoho Books authority ADR | [../adr/ADR_Zoho_Books_Authority_Boundary.md](../adr/ADR_Zoho_Books_Authority_Boundary.md) |
| Legacy retirement register | [Legacy_Retirement_Register.md](Legacy_Retirement_Register.md) |
| Compatibility shim register | [Compatibility_Shim_Register.md](Compatibility_Shim_Register.md) |
| Operational model | [Operational_Model.md](Operational_Model.md) |
| Population Ledger model | [Population_Ledger_Model.md](Population_Ledger_Model.md) |
| Canonical population and cohort foundation | [Canonical_Population_and_Cohort_Foundation.md](Canonical_Population_and_Cohort_Foundation.md) |
| Canonical finance authority | [Canonical_Finance_Authority.md](Canonical_Finance_Authority.md) |
| Apps Script deployable contract | [Apps_Script_Deployable_Contract.md](Apps_Script_Deployable_Contract.md) |
| Finance state model | [Finance_State_Model.md](Finance_State_Model.md) |
| Finance reconciliation contract | [Finance_Reconciliation_Contract.md](Finance_Reconciliation_Contract.md) |
| Finance reporting boundary | [Finance_Reporting_Boundary.md](Finance_Reporting_Boundary.md) |
| Finance mutation boundary | [Finance_Mutation_Boundary.md](Finance_Mutation_Boundary.md) |
| Books integration authority | [Books_Integration_Authority.md](Books_Integration_Authority.md) |
| Mature Operations M1-M6 roadmap | [Mature_Operations_Release_Roadmap.md](Mature_Operations_Release_Roadmap.md) |
| Operator Actionability Resolver | [Operator_Actionability_Resolver.md](Operator_Actionability_Resolver.md) |
| Communication model | [Communication_Model.md](Communication_Model.md) |
| Queue model | [Queue_Model.md](Queue_Model.md) |
| Roadmap | [Roadmap.md](Roadmap.md) |
| Governance and source map | [Governance.md](Governance.md) |
| Migration plan | [Migration_Plan.md](Migration_Plan.md) |
| Google Drive package | [Google_Drive_Package.md](Google_Drive_Package.md) |
| Mermaid sources | [Mermaid/](Mermaid/) |

## Core Architecture Rule

Population Ledger determines where every applicant is accounted.

Canonical Lifecycle determines applicant state.

Operator Actionability Resolver determines what work exists now.

Communication Authority determines whether communication may preview/send now.

Review Workspace remains mutation authority.

## Target Flow

```text
Raw Facts
-> Population Ledger (accounting)
-> Canonical Lifecycle Resolver
<-> Operator Actionability Resolver
-> Communication Authority
-> Preview / Send Gates
-> Row fact writeback
-> Re-resolution on next read
```

Operations Workspace, Review Workspace and Communications consume the resulting DTOs. They do not create separate authority.

The arrow between Canonical Lifecycle and Actionability represents fact mutation followed by re-resolution, not recursive implementation dependency. Review Workspace mutations change row facts; the next read resolves lifecycle, workload, communication recommendation and send authority again.

## V1 Runtime Truth

As of `r340 / 340`, Operator Next (`?view=operator-next`) is the primary work surface. Current Admin (`?view=admin`) remains the supported fallback and hosts the shared mature Review and Batch Communication components. OPS is retired as operational authority and remains reference-only. FormDesigner remains the current intake path; Google Forms replacement remains future work.

Protected live surfaces include document verification, signed document routes, applicant-folder preview/gallery/lightbox, payment verification, Zoho Books, communication semantic registry, Stage Batch separation, runtime identity, release governance, and DR tooling.

Capability authority is resolved by `resolveAdminCapabilities_()`. The `Capability_Grants` tab is live current-state authority for bounded temporary capabilities; `Webhook_Log` is immutable transition evidence. Track H2 exact-action approval remains deferred.

Finance boundary freeze:

- `Receipt_Status` is canonical payment authority
- `Books_*` fields are Zoho Books integration metadata only
- `Payment_Verified` is compatibility-only
- legacy invoice-trigger fields/functions remain retained compatibility only until dependency proof allows retirement

Partial/future surfaces include classroom acceptance/handover authority, LAP automation, bounce ingestion, AI-assisted document precheck, and Google Forms replacement.

## ACP Closure Status

ACP closure review completed on 2026-07-10 against:

- commit `f10a776` `refactor: make review communication recommendation canonical-first`
- commit `cf50e9e` `refactor: retire legacy docs follow-up send authority`
- Admin Apps Script version `363`
- Admin staging pin `@363`
- live Admin runtime identity `r338 / 338`
- live Student runtime identity `r217 / 217`

Release/acceptance evidence:

- `F:\Playwright\fode-secure-link-diagnostic\reports\2026-07-10T07-50-25-296Z-admin-legacy-docs-followup-authority-retirement`
- `F:\Playwright\fode-secure-link-diagnostic\reports\2026-07-10T07-47-34-178Z-admin-operational-communication-cohort-partition`
- `F:\Playwright\fode-secure-link-diagnostic\reports\2026-07-10T07-50-25-855Z-legacy-admin-health`

Closure classification:

`ACP ARCHITECTURALLY VERIFIED - COMPLETE WITH DEFERRED CLEANUP`

Meaning:

- no reachable operator communication route bypasses Communication Authority
- Review communication projection consumes canonical recommendation plus final message-specific Communication Authority
- Review Queues are compatibility/navigation only
- legacy Docs Follow-Up queue/search send authority is retired
- selected and stage batch communication remain bounded by authoritative preview/send gates
- remaining work is cleanup, Stage Batch migration, broader canonical reporting, and legacy retirement

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

Mermaid diagrams may be validated using:

`tools\validate-mermaid-docs.ps1`

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
