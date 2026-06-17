# Architecture Governance

Status: r23B consolidation draft
Scope: documentation governance only

## Source Preservation Rule

Original source documents remain in place until the consolidated architecture package is reviewed and accepted.

No source files are deleted by r23B.

## Keep / Merge / Archive / Retire Map

| Source | Recommendation | Reason |
|---|---|---|
| `ARCHITECTURE_ROADMAP_NO_CRM.md` | KEEP / MERGE | Strategic roadmap and system boundaries. |
| `docs/operations/ROADMAP_UNIFIED_OPERATIONS_PLATFORM.md` | KEEP / MERGE | Unified platform roadmap. |
| `docs/operations/S5A_OPERATIONAL_AUTHORITY_MAP.md` | KEEP / MERGE | Current authority model source. |
| `docs/operations/S5A_CANONICAL_INTAKE_LIFECYCLE.md` | KEEP / MERGE | Current lifecycle model source. |
| `docs/operations/S5B_LIFECYCLE_SEMANTICS_REVIEW.md` | KEEP / MERGE | Lifecycle semantic guardrails. |
| `docs/operations/S5A_COMMUNICATION_WORKFLOW.md` | KEEP / MERGE | Communication workflow source. |
| `docs/FODE_ARCHITECTURE_MAP_r205.md` | KEEP / MERGE / SUPERSEDE LATER | Current Mermaid/refactor benchmark. |
| `FODE_AUTHORITY_MODEL_r105.md` | ARCHIVE LATER | Historical authority model. |
| `audits/r22xA_intake_completeness_authority_audit_v01.md` | KEEP AS EVIDENCE | Completeness/review authority discovery. |
| `audits/r221A_stage_batch_authority_audit_v01.md` | KEEP AS EVIDENCE | Preview/send authority evidence. |
| `audits/r225A_document_payment_queue_count_authority_audit_v01.md` | KEEP AS EVIDENCE | Queue/count authority evidence. |
| `audits/r226A_ops_dependency_and_strategic_decision_v01.md` | KEEP AS EVIDENCE | OPS dependency and simplification evidence. |
| `audits/r226B_ops_freeze_boundary_note_v01.md` | KEEP AS EVIDENCE | OPS freeze boundary. |
| `OPS_LAYER_DIAGNOSTIC_SPRINT_REPORT_v01.md` | ARCHIVE/MOVE LATER | Diagnostic report outside current doc structure. |

## Superseded Notice Policy

After acceptance, older source docs should receive a short notice:

```text
Superseded for current architecture navigation by docs/architecture/.
Retained as historical source evidence.
```

Do not apply superseded notices before operator acceptance.

## No Runtime Authority From Docs

Architecture docs guide future implementation.

They do not change runtime behavior, queues, sends, Apps Script deployments, or Sheet data.

