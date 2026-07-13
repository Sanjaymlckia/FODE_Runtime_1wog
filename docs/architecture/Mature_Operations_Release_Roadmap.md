# Mature Operations Release Roadmap

Status: M1 implemented locally; M2-M6 design frozen for later bounded programmes

All later modules consume `CANONICAL_POPULATION_V1` and `buildCanonicalCohort_()`. A later module may extend the DTO through an explicit versioned field, but must not fork population, lifecycle, Actionability, payment, or communication logic.

## M2 Finance Mature Operations

### State model

| State | Meaning | Runtime authority |
|---|---|---|
| `PAYMENT_PENDING` | no verified payment and no evidence | `Receipt_Status` plus receipt evidence helper |
| `PAYMENT_TO_VERIFY` | evidence exists; verification pending | same |
| `PAID_VERIFIED` | canonical payment verified | `Receipt_Status` |
| `OVERDUE` | configured due date passed while outstanding | future Finance policy configuration |
| `PARTIAL` | accounting evidence confirms partial settlement | future Books reconciliation input; not inferred now |
| `DISPUTED` | explicit operator/accounting dispute | future controlled mutation |
| `CREDITED`, `REFUND_PENDING`, `REFUNDED`, `WRITTEN_OFF` | accounting outcomes | Zoho Books result mirrored into runtime integration metadata |

### Contracts

- Population Ledger accounts for applicants; it does not become an accounting ledger.
- Runtime owns applicant payment intent, evidence review, verification decision, communication, and operational work.
- Zoho Books owns contacts, invoices, payments, receipts, credits, refunds, write-offs, reconciliation, journals, and tax.
- Quote/invoice/instalment/balance projections require explicit amounts, currency, billing reference, policy version, and Books IDs/status.
- `Receipt_Status` remains canonical payment authority. `Payment_Verified` remains a compatibility mirror. `Books_*` remains external integration metadata.
- Payment verification and any refund/credit/write-off instruction require capability and mutation audits. Batch Finance mutation is out of M2 first release.

### Workspace and reporting

Finance consumes canonical cohorts for Payment Follow-up, Payment Review, overdue, exceptions, and reconciliation. Initial reports are read-only and show runtime state beside Books state without silently reconciling differences.

### Owner decisions before implementation

- institutional overdue and instalment policy
- dispute ownership and escalation
- refund/credit/write-off approval levels
- authoritative balance source and synchronization cadence

## M3 Registry and Classroom Operations

### Registry states

`NOT_ELIGIBLE`, `ELIGIBLE`, `READY_FOR_IMPORT`, `IMPORTED`, `DISCREPANCY`, `WITHDRAWN`, `TRANSFERRED`, `COMPLETED`.

Registry eligibility is a new resolver consuming canonical lifecycle, verified payment policy, enrolment facts, approved programme/grade/subjects, and explicit exception state. It must not be inferred from Actionability labels.

### Contracts

- Registry import uses stable Applicant ID, learner identity, programme, grade, subjects, eligibility evidence, source version, and idempotency key.
- Discrepancies never overwrite canonical applicant facts silently.
- Classroom readiness is separate from Registry eligibility: `NOT_READY`, `READY`, `MAPPED`, `INVITED`, `ACTIVE`, `BLOCKED`.
- Google Classroom owns class/course mapping, invitations, teaching, materials, assessment, grading, and learning progress.
- Runtime owns admissions, enrolment, registry, finance readiness, compliance, and handover evidence.
- Subject/class rosters are exact canonical cohorts plus approved Registry facts.
- Exam eligibility depends on Registry state, subject registration, institutional policy, and unresolved exception checks.
- Withdrawal, transfer, and completion are explicit transitions with source and effective date.

### Owner decisions before implementation

- Registry source/import system and authoritative identifiers
- finance prerequisite for Registry and Classroom readiness
- Google Classroom account and course ownership
- examination eligibility policy and Registry mutation roles

## M4 Canonical Global View

Global View is read-only in its first release and consumes the M1 summary/API contracts.

Required summary buckets include lifecycle base states, Actionability states, workload groups/worklists, finance states, communication recommendations/blocks, contactability, exceptions, Registry readiness, and Classroom readiness. Drill-down uses the exact cohort builder and exact Applicant ID detail API.

Role visibility uses the existing capability resolver. No Global View button may create a mutation or enable a downstream action until:

- its displayed count reconciles to the canonical population
- its cohort is exact and deterministic
- its authority and freshness are visible
- the target action has an existing capability and final authority gate
- browser acceptance proves no OPS DTO or handler participates

Global View must display compatibility drift rather than merging it into canonical totals.

## M5 H2 Controlled Batch Approvals

H2 starts from a request-only canonical cohort preview. The approval snapshot contains exact ordered Applicant IDs, selected/excluded/blocked partitions, message type, rendered content hash, authority diagnostics, operator, capability, source schema version, creation time, expiry, and fingerprint.

States: `PENDING`, `APPROVED`, `REJECTED`, `EXPIRED`, `INVALIDATED`, `USED`.

The Super decision records reviewer, decision, reason, timestamp, and fingerprint. Send requires atomic single-use consumption, exact fingerprint match, unexpired state, unchanged content/cohort, current capability, and full Communication Authority re-evaluation. Any difference invalidates the approval. Existing preview cache, candidate hash, cooldown, durable prior-success, idempotency, and batch cap remain mandatory.

Replay returns the prior result or a deterministic used/invalid response; it never sends again. H2 approval is supervisory permission, not a replacement send authority.

Owner decisions before implementation:

- approval expiry
- which capabilities/actions require H2
- whether exclusions require reapproval
- persistence/audit store and notification channel

## M6 Consolidation

### Retirement order

1. Migrate Stage Batch cohort selection to the shared builder while preserving preview/send parity.
2. Reduce Review Queues to links/reconciliation, then remove unused projections with dependency proof.
3. Archive OPS source/evidence after recovery and route checks prove no active dependency.
4. Add selected-cohort VCF export for manual WhatsApp support with exact scope, capability, audit, and no automated send implication.
5. Consolidate cross-domain reporting onto canonical summaries.

### Production-transition gates

- all canonical/compatibility totals reconcile or display explicit drift
- no live route depends on OPS authority
- Stage Batch migration has candidate, cache, cap, send, and rollback parity
- Admin and Student runtime verification passes
- full backup manifest, restore rehearsal, and evidence review passes
- acceptance URLs and PASS/FAIL checks are recorded
- rollback deployment pins and recovery source are verified

M6 does not start until M2-M5 consumers prove they use the M1 foundation without parallel authority.

## Recommended Implementation Sequence

1. Review and commit M1 foundation independently.
2. Release M1 as a read-only Track H backend slice only after explicit approval.
3. Build M4 read-only Global View first to exercise M1 at scale without mutation.
4. Build M2 Finance read-only workspace, then controlled mutation contracts.
5. Build M3 Registry resolver and import preview before any import mutation.
6. Build M5 H2 only after canonical cohort production use is stable.
7. Execute M6 compatibility retirement last.

