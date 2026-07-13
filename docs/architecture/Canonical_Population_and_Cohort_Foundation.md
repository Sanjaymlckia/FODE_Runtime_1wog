# Canonical Population and Cohort Foundation

Status: M1 local implementation; not released
Release track: Track H when later approved for deployment

## Decision

Mature Operations modules consume one read-only population composition and one cohort builder. They must not create parallel lifecycle, workload, finance, communication, Registry, Classroom, or population authority.

```text
FODE_Data row facts
  -> Population Ledger (accounting)
  -> Canonical Lifecycle (applicant state)
  -> Actionability (workload and selection)
  -> Communication Authority (message-specific permission)
  -> Canonical Population DTO (read-only composition)
  -> Shared Cohort Builder (exact read-only partitions)
  -> Finance / Registry / Classroom / Global View / H2 / Reporting
```

The DTO is a composition boundary, not a new authority. `buildCanonicalPopulationRow_()` calls existing authority outputs and labels compatibility data. It does not resolve lifecycle, payment, communication, or workload independently.

## Canonical Population DTO

Schema: `CANONICAL_POPULATION_V1`

| Section | Contract | Authority |
|---|---|---|
| `identity` | Applicant ID, sheet row, source sheet, stable row key | `FODE_Data` row identity |
| `lifecycle` | base state, overlays, recommendation, owner, reason | Canonical Lifecycle Resolver |
| `actionability` | state, workload group, worklist, action, selectable, blockers, cooldown | Actionability Resolver |
| `communication` | recommended/requested type, authority result/source, block | Communication Authority matrix |
| `finance` | canonical payment projection plus Books metadata | `Receipt_Status` and payment helpers; Books remains external metadata |
| `documents` | completeness, missing documents, verification | existing document helpers |
| `contactability` | email/phone readiness and state | existing contactability facts |
| `owner` | current action owner | Actionability / Canonical Lifecycle output |
| `visibility` | complete/exception projection | Actionability projection |
| `diagnostics` | lifecycle mismatch, legacy stage, provenance, Stage Batch label | passive diagnostics |
| `extensions` | Registry, Classroom and H2 placeholders | explicitly unresolved future contracts |

`communication.deliveryGatesEvaluated` is `false` in the population projection. The DTO reports Communication Authority matrix permission but does not claim preview/send readiness where cooldown cache, role, portal-secret, idempotency, or confirmation gates have not run. Actual preview/send remains authoritative.

Registry and Classroom fields are placeholders with `NOT_RESOLVED`; they contain no fabricated state.

## Shared Cohort Builder

`buildCanonicalCohort_()` supports:

- `FULL_POPULATION` or exact `SELECTED` scope
- lifecycle base-state and overlay filters
- Actionability state, workload-group, worklist and selectable filters
- finance-state filters
- contactability and cooling-off filters
- message-specific Communication Authority evaluation
- stable Applicant ID ordering
- `included`, `excluded`, and `blocked` partitions
- missing selected IDs and scope-violation diagnostics
- an empty H2 approval extension point

Selected scope is exact. It cannot admit an Applicant ID absent from the request. Communication filters place authority failures in `blocked`; ordinary filter mismatches go to `excluded`.

## Read-only APIs

| API | Purpose |
|---|---|
| `admin_getCanonicalPopulationSummary()` | full summary; rows only when explicitly requested |
| `admin_getCanonicalLifecycleGroups()` | canonical base-state groups |
| `admin_getCanonicalActionabilityGroups()` | workload states and broad groups |
| `admin_getCanonicalFinanceGroups()` | canonical payment projection groups |
| `admin_getCanonicalCommunicationCohort()` | exact/filterable communication cohort partitions |
| `admin_getCanonicalPopulationExceptions()` | bounded exception/unknown rows |
| `admin_getCanonicalApplicant()` | exact Applicant ID drill-down |
| `admin_getCanonicalPopulationReconciliation()` | reconciliation evidence only |

These APIs are not connected to Operator Next Global View in M1.

## Reconciliation Contract

The snapshot reports, without forcing agreement:

- canonical row count versus Population Ledger ApplicantID count
- canonical lifecycle totals
- Actionability totals
- finance totals
- duplicate Applicant IDs
- Working View as the existing bounded Actionability-priority subset
- canonical and ledger lifecycle counts side by side
- Stage Batch as `COMPATIBILITY_DRIFT_NOT_FORCED`
- explicit absence of OPS dependency

Population Ledger reuses already-resolved Actionability rows when called by M1. Existing callers retain the original fallback and behavior.

## Duplicate Paths Found

| Path | Current classification | M1 treatment |
|---|---|---|
| `admin_getActionabilityPreview()` full scan then bounded rows | active workload authority | defined as Working View subset |
| `buildPopulationLedgerFromValues_()` full scan and row classification | accounting authority | reuses M1 authority rows through optional input |
| selected-applicant batch ID hydration | active surface wrapper | future consumer of shared cohort builder; unchanged now |
| Stage Batch stage cohort | compatibility selection | drift labelled; behavior unchanged |
| Review Queues | compatibility navigation | excluded from M1 authority |
| OPS lifecycle summary | retired/reference | prohibited from M1 |

## Safety Boundary

M1 has no send, mutation, approval, Global View activation, Finance execution, Registry execution, Classroom execution, Stage Batch retirement, or OPS dependency.

