# ACP Phase 1 Authority Consolidation

Status: implemented in local source, not yet released

## Decision

ACP Phase 1 consolidates shared authority DTOs and batch policy helpers without changing approved runtime behaviour.

Implemented scope:

- shared batch policy helpers now define configured per-run cap, stage default/max, normalization, candidate hashing, and preview-cache primitives
- selected/manual batch and Stage Batch consume those shared helpers where behaviour already matched
- Operations Workspace now receives server-authored `bucketSummaries` and `worklistSummary`
- UI bucket counts consume server DTOs first and use local fallback only as compatibility protection

Unchanged authorities:

- Canonical Lifecycle Resolver = applicant state authority
- Actionability Resolver = workload authority
- Communication Authority = final communication gate
- Population Ledger = accounting authority
- Review Workspace = mutation authority

## Rationale

Before ACP Phase 1, the runtime had converged architecturally but still duplicated policy and summary logic in multiple places:

- selected/manual batch vs Stage Batch cap/cache/hash helpers
- server workload DTOs vs UI-local bucket calculations

That duplication increased drift risk without adding capability.

## Migration Boundary

ACP Phase 1 does not:

- change Stage Batch candidate selection
- change Communication Authority outcomes
- change Population Ledger accounting
- remove legacy lifecycle helpers

## Next Safe Slice

Use ACP Phase 2 only after validating that:

- Stage Batch legacy lifecycle selection can move without preview/send drift
- remaining UI-local summaries can be retired without changing operator behaviour
