# Architecture Roadmap

Status: r338 authority convergence sync
Scope: documentation only

## Implemented

- Admin / Operations Workspace remains the live operator authority surface.
- Population Ledger is the accounting authority.
- Canonical Lifecycle Resolver is the applicant-state authority.
- Operator Actionability Resolver is the workload authority.
- Communication Authority is the final send authority.
- Review Workspace remains the mutation authority.
- Contactability Exceptions is a first-class operational bucket.
- Document verification, status persistence, `Docs_Verified` rollup, signed file routes, preview/gallery/lightbox, and applicant-folder `FODE_PREVIEW` renditions are live.
- Payment verification and Zoho Books are protected live surfaces.
- H1-H5 communication semantic registry, template text, selected-applicant exposure, and Stage Batch separation are live.
- DR tooling, release recording, and DR5 verification are established.
- ACP / CAP authority convergence has removed the main missing-documents authority mismatch between actionability and communication admission.
- ACP closure proof is complete for operator communication routing:
  - canonical-first Review Workspace recommendation
  - retired legacy Docs Follow-Up queue/search send authority
  - compatibility queue/search routing redirected to Review Workspace or authoritative Batch Communication
  - no reachable operator communication route bypasses Communication Authority

## Partial / In Progress

- Stage Batch candidate-selection migration off legacy lifecycle stage inputs.
- broader Population Ledger canonical lifecycle reporting.
- legacy lifecycle retirement after consumer migration.
- classroom acceptance/handover authority.
- LAP scheduled automation and single state-machine authority.
- bounce evidence ingestion and reconciliation.
- Full Sheet/Drive DR backup execution schedule.

## Deferred / Future

- Google Forms replacement for FormDesigner.
- AI-assisted document review, advisory only.
- broad visual redesign beyond authority/workload correction.

## Frozen

- OPS remains frozen as a reference/secondary surface.

## Current Safe Migration Order

### Stage 1: Authority Convergence

Completed:

- canonical lifecycle resolver
- actionability canonical recommendation consumption
- communication authority canonical convergence for missing-documents workflow
- contactability operational bucket promotion

### Stage 2: Compatibility Reduction

Next safe slices:

- Stage Batch legacy input migration
- review and retire legacy lifecycle consumers
- remove bounded UI fallback once server DTOs are proven stable across releases

### Stage 3: Reporting Completion

Later slices:

- broader Population Ledger canonical reporting
- dashboard/report surfaces that still expose legacy terminology
- frozen compatibility queue retirement planning

## Documentation Impact Rule

Future CIS work must state whether it updates or intentionally does not update:

- Mermaid diagrams
- Roadmap
- Architecture authority documents
- Lifecycle/state diagram
- Protected Surface Register
