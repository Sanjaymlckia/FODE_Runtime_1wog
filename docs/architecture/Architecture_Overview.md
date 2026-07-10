# Architecture Overview

Status: r338 authority convergence sync
Scope: architecture documentation only

## Purpose

FODE Runtime separates domain truth from workflow interpretation and from mutation authority.

The current runtime clarifies these protected authority boundaries:

- Population Ledger
- Canonical Lifecycle Resolver
- Operator Actionability Resolver
- Communication Authority
- Review Workspace mutation authority
- Document Completeness Authority
- Document Review Authority
- Payment Authority
- Enrollment Authority
- Shared Row Facts Layer
- Operations Workspace / Admin surface
- Review Queues compatibility surface
- Frozen OPS Surface
- Signed Document Routes
- Applicant-Folder Preview Renditions
- Zoho Books Workflow
- Disaster Recovery Tooling

## Problem Statement

The runtime must answer four different questions without letting one surface impersonate another:

```text
What is true?
Where is every applicant accounted?
What work exists now?
What may be sent or mutated now?
```

That split prevents queue names, bucket labels, and UI summaries from becoming hidden authorities.

## Current Target Architecture

```text
Intake Sources
-> Raw Row Facts
-> Shared Row Facts
-> Domain Authorities
-> Population Ledger
-> Canonical Lifecycle Resolver
-> Operator Actionability Resolver
-> Communication Authority
-> Operator Surfaces
-> Action Backends
```

Operator surfaces include:

- Operations Workspace / Admin
- Lifecycle Map
- Review Workspace
- Review Queues
- Applicant Detail / Review Modal
- Document Gallery and Lightbox
- Stage Batch Preview
- Communications Preview
- Escalation views

Current intake sources:

- FormDesigner, currently live
- Portal/document uploads, where applicable
- Google Forms replacement, planned future path only

Protected live action backends include:

- document status save and `Docs_Verified` rollup
- signed document open/download/preview routes
- applicant-folder `FODE_PREVIEW` generation
- selected-applicant communication preview/send gates
- Stage Batch preview/send gates
- payment verification and Zoho Books
- DR/release evidence tooling

## Current Authority Chain

```text
Shared Row Facts
-> Population Ledger (accounting authority)
-> Canonical Lifecycle Resolver (applicant-state authority)
-> Operator Actionability Resolver (workload authority)
-> Communication Authority (send authority)
-> Operations Workspace / Review Workspace / compatible queue surfaces
-> Mutation backends
```

| Surface / layer | Current responsibility |
|---|---|
| Population Ledger | exactly-once applicant accounting |
| Canonical Lifecycle Resolver | base applicant state plus overlays |
| Operator Actionability Resolver | what the operator should work now |
| Communication Authority | whether a message may preview/send now |
| Operations Workspace | workload surface |
| Review Workspace | mutation authority and authority-backed display |
| Review Queues | compatibility/workflow only |

## Converged Milestones

Completed and reflected in runtime source:

- canonical lifecycle base state and overlays are separated
- `REMINDER_DUE` is an overlay, not a base lifecycle
- actionability consumes canonical recommendations where available
- Communication Authority accepts narrow canonical lifecycle context for the missing-documents workflow while preserving legacy fallback and all send gates
- Operations Workspace selection is server-driven through `selectable`
- contactability is promoted to a first-class operational bucket rather than being presented as Management work
- Review Workspace remains mutation authority; display labels are expected to consume authority output rather than re-derive state independently
- direct compatibility queue/search Docs Follow-Up send authority is retired; compatibility single-row actions route to Review Workspace and selected actions route to authoritative Batch Communication

## ACP Final Closure

Final closure was verified on 2026-07-10 after:

- remote marker proof against released source
- Admin staging release to Apps Script version `363`
- live Admin `whoami` proof at `r338 / 338`
- Student `whoami` proof unchanged at `r217 / 217`
- Playwright acceptance covering health, operational cohort partition, and legacy Docs Follow-Up retirement

Operator-route closure invariant:

`No reachable operator communication route may independently determine recipients, message identity, preview population, or send authorization outside Communication Authority.`

This invariant is now satisfied for:

- Review Workspace single-applicant communication
- selected/manual Batch Communication
- Stage Batch preview/send
- Review Queue compatibility routing
- search compatibility routing

Retained non-operator exceptions remain explicit and narrow:

- payment-verified workflow notices
- docs-verified payment-required workflow notice
- payment receipt uploaded admin alert
- WhatsApp fallback CSV email to admins

These are governed system/admin notifications, not operator cohort send routes. They do not reopen the retired Docs Follow-Up authority path.

Still deferred:

- Stage Batch candidate-selection migration from legacy lifecycle inputs
- broader Population Ledger canonical reporting/migration
- retirement of legacy lifecycle helpers after all consumers migrate

## ACP Phase 1 Authority Consolidation

ACP Phase 1 reduced duplication around already-approved authority outcomes:

- shared batch policy helpers own cap/default/max, normalization, candidate hashing, and preview-cache primitives
- selected/manual batch and Stage Batch reuse those helpers where behaviour already matched
- Operations Workspace bucket summaries are produced on the server and consumed by the UI

ACP Phase 1 did not migrate Stage Batch candidate selection.

## r338 Protected Live Surfaces

Do not prune, archive, or refactor these surfaces without a dedicated CIS and proof:

- runtime identity and release gates
- document verification and queue rollup
- signed file routes
- preview/gallery/lightbox and applicant-folder preview renditions
- payment verification and Zoho Books
- communication semantic registry and selected-applicant templates
- Stage Batch preview/send separation
- FormDesigner intake and canonicalization
- DR tooling and baseline governance

## OPS Boundary

Admin / Operations Workspace remains the primary operational surface.

OPS is frozen as a secondary/reference surface:

- no new OPS features
- no OPS send authority
- no broad OPS communications execution
- no added client-side classification logic
- critical bug fixes only

OPS should survive only as a frozen reference over proven shared backend authority.

## Future/Partial Surfaces

These surfaces are not removal candidates:

- Google Forms replacement
- contactability and bounce evidence ingestion
- LAP scheduled automation
- classroom acceptance and handover authority
- AI-assisted document precheck, advisory only
- broader actionability owner/next-action queue model
- further lifecycle retirement after canonical migration is complete

## Source Documents

This document consolidates direction from:

- `ARCHITECTURE_ROADMAP_NO_CRM.md`
- `docs/operations/ROADMAP_UNIFIED_OPERATIONS_PLATFORM.md`
- `docs/operations/S5A_OPERATIONAL_AUTHORITY_MAP.md`
- `docs/operations/S5A_CANONICAL_INTAKE_LIFECYCLE.md`
- `docs/operations/S5B_LIFECYCLE_SEMANTICS_REVIEW.md`
- `audits/r22xA_intake_completeness_authority_audit_v01.md`
- `audits/r225A_document_payment_queue_count_authority_audit_v01.md`
- `audits/r226A_ops_dependency_and_strategic_decision_v01.md`
- `audits/r226B_ops_freeze_boundary_note_v01.md`
- `audits/f1_runtime_surface_dead_code_audit_v01.md`
- `audits/f2a_runtime_call_graph_archive_plan_v01.md`
- `audits/f2a5_architecture_reconciliation_protected_surface_register_v01.md`
