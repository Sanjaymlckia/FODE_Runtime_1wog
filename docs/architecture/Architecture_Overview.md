# Architecture Overview

Status: r301+ architecture sync
Scope: architecture documentation only

## Purpose

FODE Runtime separates domain truth from workflow interpretation.

The r301+ runtime clarifies several protected authority boundaries:

- Lifecycle Authority
- Document Completeness Authority
- Document Review Authority
- Payment Authority
- Communication Authority
- Enrollment Authority
- Shared Row Facts Layer
- Admin Dashboard / Legacy Admin Surface
- Frozen OPS Surface
- Signed Document Routes
- Applicant-Folder Preview Renditions
- Zoho Books Workflow
- Disaster Recovery Tooling

The Operator Actionability Resolver is now partially implemented for Admin Operations Workspace workload selection.

## Problem Statement

The system increasingly answers:

```text
What is true?
```

It still needs a consistent derived answer to:

```text
What should happen next?
Who should act?
How urgent is it?
Should communication be recommended?
```

## Current Target Architecture

```text
Intake Sources
-> Raw Row Facts
-> Shared Row Facts
-> Authority Layer
-> Canonical Lifecycle Resolver
-> Operator Actionability Resolver
-> Operator Surfaces
-> Action Backends
```

Operator surfaces include:

- Admin Dashboard / Legacy Admin
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

## Layer Responsibilities

| Layer | Responsibility | Mutates Data |
|---|---|---|
| Intake Sources | FormDesigner and future Google Forms intake | External to runtime |
| Raw Facts | Sheet values, uploads, payment rows, communication fields | No |
| Shared Row Facts | normalized row facts for shared consumers | No |
| Authority Layer | derives domain truth | No by default |
| Canonical Lifecycle Resolver | derives applicant base lifecycle state and overlays from current facts | No |
| Operator Actionability Resolver | derives next operational recommendation and selection readiness | No |
| Operator Surfaces | displays, requests actions, and shows confirmations | No by display alone |
| Action Backends | execute approved mutations/sends | Yes, only when explicitly invoked |

## A3.3 Lifecycle / Actionability Milestone

Admin now exposes and begins consuming canonical lifecycle output:

- `resolveCanonicalApplicantLifecycle_()` derives base lifecycle state separately from overlays.
- `REMINDER_DUE` is treated as an overlay/timing signal, not the base applicant lifecycle.
- Actionability prefers canonical `recommendedMessageType` when available.
- Operations Workspace selection remains server-driven through the row `selectable` DTO.
- Cooling-off and Contactability Gate still override readiness.
- Communication Authority remains the final preview/send gate and is unchanged by A3.3.
- Population Ledger remains exactly-once accounting authority and is unchanged by A3.3.

Deferred migrations:

- Stage Batch lifecycle input migration.
- Population Ledger canonical lifecycle reporting/migration.
- Communication Authority canonical input migration.
- Retirement of legacy lifecycle derivation functions after all consumers are migrated.

## r301+ Protected Live Surfaces

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

Admin Dashboard / Legacy Admin remains the primary operational surface.

OPS is frozen as a secondary/reference surface:

- no new OPS features
- no OPS send authority
- no broad OPS communications execution
- no added client-side classification logic
- critical bug fixes only

OPS should survive only as a cleaner view over proven shared backend authority.

## Future/Partial Surfaces

These surfaces are not removal candidates:

- Google Forms replacement
- contactability and bounce evidence ingestion
- LAP scheduled automation
- classroom acceptance and handover authority
- AI-assisted document precheck, advisory only
- broader actionability owner/next-action queue model

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
