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

Backup procedure and restoration gates are defined in [Backup_and_Recovery_V1.md](Backup_and_Recovery_V1.md).

Closure source checkpoint: `e92652ce86a1353c19802b0888a63aba0fb2c749`.

Private server backup:

- folder: `FODE_Runtime_H1_Backup_20260713022819` (`1_HDkgUNM6UdlcaIHoHS9j3374LhHVtfL`);
- workbook copy: `1x3_J8pwsQIz7DhI3bGKNxSVA9gTUTMU9KynqYu3yHwM`;
- secured Script Properties export: `1vo8cB-sSOdulvDszRTn-L9bVlgGGIiXd`;
- sanitized server manifest: `1Oxb_FT4tmuRYWrE-P_bacYkXC2xLt35w`;
- five workbook tabs enumerated, including `Capability_Grants` and `Webhook_Log`;
- 19 Script Property keys parsed; values remain private;
- server result: `BACKUP_VERIFIED`.

Local recovery set:

`F:\FODE_DR_Backup\architecture_v1\20260713123045_e92652ce86a1353c19802b0888a63aba0fb2c749`

The local manifest records SHA-256 hashes for 47 artifacts. The Git bundle verifies and contains the source checkpoint. The Apps Script source set contains 26 files and independently contains `r340 / 340`. The source archive, acceptance evidence, runtime metadata, and closure documentation are readable. No secret-bearing artifact is tracked by Git.

Rollback prefers repinning Admin staging to Apps Script `@373` and confirming `r340 / 340`. Student and Production must not be changed.

## Bounded Findings

- Operator Next returns a bounded 100-row work window; Waffi and Stephanie were outside it during acceptance and required exact-ID Review fallback.
- Separate OPERATIONS and VERIFIER live credentials were unavailable; composed backend tests provide role-boundary proof.
- Mermaid CLI was unavailable; eight Mermaid sources were reviewed but rendering validation was skipped.
- Legacy-versus-canonical lifecycle drift remains visible as a passive diagnostic and does not own runtime decisions.

No P0/P1 authority, mutation, startup, handoff, communication, capability, fallback, runtime-identity, or backup defect remains.

## Closure Classification

`PASS_WITH_FINDINGS — ARCHITECTURE BUILD V1 CLOSED WITH BOUNDED FINDINGS`

The findings above are non-authoritative, non-destructive, documented, and explicitly deferred. They do not block normal operation or rollback.
