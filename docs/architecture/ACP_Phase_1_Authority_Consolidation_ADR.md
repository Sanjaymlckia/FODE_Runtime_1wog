# ACP Phase 1 Authority Consolidation

Status: released and superseded by later CAP authority-convergence slices

## Decision

ACP Phase 1 consolidated shared authority DTOs and batch policy helpers without changing approved runtime behaviour.

Implemented scope:

- shared batch policy helpers define configured per-run cap, stage default/max, normalization, candidate hashing, and preview-cache primitives
- selected/manual batch and Stage Batch consume those shared helpers where behaviour already matched
- Operations Workspace receives server-authored `bucketSummaries` and `worklistSummary`
- UI bucket counts consume server DTOs first and use local fallback only as compatibility protection

Unchanged authorities at the time of the decision:

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

ACP Phase 1 did not:

- change Stage Batch candidate selection
- change Communication Authority outcomes
- change Population Ledger accounting
- remove legacy lifecycle helpers

Later CAP slices have since converged missing-documents communication admission and promoted contactability to a first-class bucket. Those later slices do not invalidate this ADR; they build on it.

## Next Safe Slice

The remaining safe follow-on slices are:

- Stage Batch legacy lifecycle selection migration
- retirement of legacy lifecycle consumers after test parity and release proof
