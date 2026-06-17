# Architecture Overview

Status: r23B consolidation draft
Scope: architecture documentation only

## Purpose

FODE Runtime separates domain truth from workflow interpretation.

Recent LAP work clarified several authority boundaries:

- Lifecycle Authority
- Document Completeness Authority
- Document Review Authority
- Payment Authority
- Communication Authority
- Enrollment Authority
- Shared Row Facts Layer
- Legacy Admin Surface
- Frozen OPS Surface

The next documented layer is the Operator Actionability Resolver.

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

## Target Architecture

```text
Raw Row Facts
-> Shared Row Facts
-> Authority Layer
-> Operator Actionability Resolver
-> Operator Surfaces
```

Operator surfaces include:

- Legacy Admin Dashboard
- Review Queues
- Applicant Detail / Review Modal
- Stage Batch Preview
- Communications Preview
- Escalation views

## Layer Responsibilities

| Layer | Responsibility | Mutates Data |
|---|---|---|
| Raw Facts | Sheet values, uploads, payment rows, communication fields | No |
| Shared Row Facts | normalized row facts for shared consumers | No |
| Authority Layer | derives domain truth | No by default |
| Operator Actionability Resolver | derives next operational recommendation | No |
| Operator Surfaces | displays, requests actions, and shows confirmations | No by display alone |
| Action Backends | execute approved mutations/sends | Yes, only when explicitly invoked |

## OPS Boundary

Legacy Admin remains the primary operational surface.

OPS is frozen as a secondary/reference surface:

- no new OPS features
- no OPS send authority
- no broad OPS communications execution
- no added client-side classification logic
- critical bug fixes only

OPS should survive only as a cleaner view over proven shared backend authority.

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

