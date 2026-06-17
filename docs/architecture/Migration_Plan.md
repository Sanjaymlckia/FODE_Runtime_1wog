# Architecture Documentation Migration Plan

Status: r23B consolidation draft
Scope: documentation migration plan only

## File Inventory Created By r23B

```text
docs/architecture/
  README.md
  Architecture_Overview.md
  Authority_Model.md
  Operational_Model.md
  Operator_Actionability_Resolver.md
  Communication_Model.md
  Queue_Model.md
  Governance.md
  Roadmap.md
  Migration_Plan.md
  Google_Drive_Package.md
  Mermaid/
    Architecture_Flow.mmd
    Authority_Model.mmd
    Operator_Actionability_Flow.mmd
    Queue_Model.mmd
    Communication_Model.mmd
    Lifecycle_State_Machine.mmd
```

## Merge Map

| Target | Source Inputs |
|---|---|
| `Architecture_Overview.md` | `ARCHITECTURE_ROADMAP_NO_CRM.md`, `ROADMAP_UNIFIED_OPERATIONS_PLATFORM.md`, OPS freeze audits |
| `Authority_Model.md` | `S5A_OPERATIONAL_AUTHORITY_MAP.md`, `r22xA`, `r225A`, `r221A` |
| `Operational_Model.md` | `S5A_CANONICAL_INTAKE_LIFECYCLE.md`, `S5B_LIFECYCLE_SEMANTICS_REVIEW.md`, dashboard/queue audits |
| `Operator_Actionability_Resolver.md` | r23A architecture review and LAP continuation assessment |
| `Communication_Model.md` | `S5A_COMMUNICATION_WORKFLOW.md`, `r221A`, email workflow audits |
| `Queue_Model.md` | `r225A`, `r22xA`, `FODE_r214_Data_Flow_Audit.md` |
| `Roadmap.md` | `ARCHITECTURE_ROADMAP_NO_CRM.md`, `ROADMAP_UNIFIED_OPERATIONS_PLATFORM.md` |
| `Governance.md` | r23A inventory and cleanup recommendations |

## Migration Steps

1. Review r23B consolidated docs.
2. Confirm whether `docs/architecture/` becomes the accepted entrypoint.
3. If accepted, add superseded notices to old source docs in a separate documentation CIS.
4. Keep old docs as historical source evidence.
5. Do not delete original docs unless a later cleanup CIS explicitly approves deletion.
6. Use `docs/architecture/Mermaid/` as the future authoritative Mermaid source location.
7. Use `docs/architecture/Operator_Actionability_Resolver.md` as the source for future read-only resolver design.

## Acceptance Boundary

r23B does not authorize:

- runtime code
- Apps Script source changes
- deployment
- versioning
- tagging
- repinning
- queue behavior changes
- communication behavior changes
- file deletion

