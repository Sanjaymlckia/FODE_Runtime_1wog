# Architecture Build V1 Closure

Closure date: 2026-07-13

## Release Baseline

| Item | Accepted state |
|---|---|
| Feature source | `36b2986 feat: activate temporary capability grant authority` |
| Release metadata | `50e2a63 chore: record r340 capability grant release` |
| Admin staging | Apps Script `@373`; runtime `r340 / 340` |
| Student | Apps Script `@247`; runtime `r217 / 217` |
| Production | Untouched |
| OPS | Retired/reference only |
| Operator Next | Primary work surface at `?view=operator-next` |
| Current Admin | Supported fallback at `?view=admin` |

## Frozen Authority Model

| Domain | Authority |
|---|---|
| Population/accounting | Population Ledger |
| Applicant state | Canonical Lifecycle Resolver |
| Operator workload and selection | Actionability Resolver |
| Recommendation, eligibility, preview/send | Communication Authority |
| Applicant mutation | Review Workspace backend actions |
| Effective capability | Capability Resolver |
| Temporary capability state | `Capability_Grants` |
| Grant transition evidence | `Webhook_Log` / `logAudit_()` |

Operator Next and Current Admin are work surfaces. Neither is a domain authority.

## Acceptance Evidence

Live read-only evidence: `.release-proof/v1-closure-live-acceptance.json`.

- startup, identity, role/capability bootstrap: PASS;
- bounded Working View and contained Global View: PASS;
- Waffi exact-ID Review: `PAYMENT_PENDING`, `payment_followup`, cooling-off visible: PASS;
- Stephanie exact-ID Review: `INCOMPLETE_DOCUMENTS`, `docs_missing`, cooling-off visible: PASS;
- canonical recommendation remains selected while send is blocked: PASS;
- exact returned-row Review handoff: PASS (`FODE-26-003031` observed);
- individual preview authority exercised without send: PASS;
- selected two-recipient `docs_missing` preview: PASS, 2 included, 0 blocked, exact IDs only;
- Reports, System Health, Roles & Capabilities: PASS;
- Current Admin fallback: PASS;
- page errors: 0.

The named Waffi and Stephanie records were outside Operator Next's bounded 100-row returned window at acceptance time. Exact-ID Review validated both. This is a documented discoverability limitation, not an authority defect; the canonical full-population summary remains deferred.

Separate OPERATIONS and VERIFIER live sessions were unavailable. Composed role/capability regression tests prove their backend boundaries; SUPER live projection was accepted with seven configured accounts, eight exact delegable capabilities, schema ready, and zero grant records.

## Test Evidence

The V1 closure suite passed syntax and targeted tests covering temporary grants, role convergence, role boundaries, communication gates and semantics, Review cohesion, payment authority, Operator Next, RPC contracts, operator scenarios, Stage Batch diagnostics, canonical lifecycle, Actionability, Population Ledger, and document gallery/manifest/file actions. `tools/fode-preflight.ps1`, runtime-context validation, and Admin/Student `whoami` also passed.

## Compatibility and Deferred Work

The authoritative classification and removal preconditions are in [Compatibility_Shim_Register.md](Compatibility_Shim_Register.md).

V1 defers H2 exact-action approvals, canonical Global Population Summary, selected VCF/manual WhatsApp export, Stage Batch retirement, full OPS archival, Registry, Classroom, REP extraction, finance expansion, and broad UI polish.

## Backup and Rollback

Backup procedure and restoration gates are defined in [Backup_and_Recovery_V1.md](Backup_and_Recovery_V1.md). Exact closure backup IDs, local manifest path, bundle commit, and verification outcome are recorded after the documentation source checkpoint is created.

Rollback prefers repinning Admin staging to Apps Script `@373` and confirming `r340 / 340`. Student and Production must not be changed.

## Closure Classification

Pending final verified backup and pushed closure evidence checkpoint. No P0/P1 authority or operational defect remains from static audit, live acceptance, or regression validation.
