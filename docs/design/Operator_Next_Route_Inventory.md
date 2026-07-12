# Operator Next Route Inventory

Status: Track L runtime implementation inventory; local only, not released

## Pre-correction Finding

The first prototype exposed core workload, Review, Batch Communication, Finance, Lifecycle, Contactability, and Management Exceptions, but it did not make the full approved Admin surface visibly discoverable.

Classification before correction: **FAIL_FUNCTIONAL_COMPLETENESS**.

Missing or underrepresented mature surfaces:

- Admissions Review and document-review exceptions.
- Portal Operations and security capability boundary.
- Registry and Classroom handover.
- System Health, runtime identity, parity, integration, compatibility, release evidence, and diagnostics.
- Detailed role/capability inspection.
- Quote, invoice, receipt, and payment-evidence routes within Finance.
- Hidden/blocked records as an explicit inspectable cohort.
- Month-to-date communication metrics and future batch-approval boundary.
- Operational dashboard routes for oldest work, registry readiness, finance activity, and system health.
- Scoped VCF contact export; the first prototype exposed CSV only.

## Revised Visible Route Map

| Prototype route | Admin capability preserved | Source authority | Interaction status |
| --- | --- | --- | --- |
| Lifecycle Map | Primary lifecycle navigation, active scope, selected-stage queue | Canonical Lifecycle + Actionability | Implemented |
| Applicant Action | Workload summary, actionable cohort, hidden/blocked reasons, exact Review | Actionability + Review Workspace | Implemented |
| Admissions Review | Document review, correction exceptions, eligibility/handover readiness | Document Review + Canonical Lifecycle | Implemented |
| Communications | Individual Review email, selected/batch communication, readiness, blocks, MTD metrics | Communication Authority + Communications Ledger | Implemented |
| Finance | Payment Follow-up, Payment Review, quotes, invoices/Books, receipts, capability boundary | Receipt_Status + Actionability + Books adapter | Implemented |
| Portal Operations | Identity, availability, progress, link insertion, security/mutation boundary | Portal Identity/Availability/Progress | Implemented |
| Contactability | Contactability workload and manual contact boundary | Actionability | Implemented; selected VCF blocked pending Track H adapter |
| Registry & Classroom | Eligibility, examination preparation, registry exceptions, handover readiness | Registry projection + future Classroom boundary | Represented; future execution labelled |
| Exceptions & Hidden | Integrity exceptions, blocked applicants, hidden reasons, escalation | Ledger + Actionability | Implemented |
| Reports & Audit | Population, workload, communications, finance, registry, exception and reconciliation summaries | Ledger + Actionability + metrics | Implemented summary route |
| System Health | Admin/Student identity, deployments, ledger/parity/integrations, compatibility, release evidence, diagnostics | live whoami/release tooling/authority diagnostics | Represented read-only |
| Roles & Capabilities | Account, resolved role, capability matrix, unavailable reasons | `resolveAdminCapabilities_()` | Implemented |
| Operational Dashboard | Attention, oldest, ready, cooling-off, communications, finance, registry, health | composed authority summaries | Implemented |
| Review Workspace overlay | Exact applicant mutation handoff and communication state contract | Review Workspace + backend gates | Reuses current mature Admin modal |
| Batch Communication overlay | Selected cohort, cap, preview, blocked reasons, confirmation | Communication Authority | Reuses current mature Admin modal; no send during validation |

## Compatibility and Future Labels

- Stage Batch and Review Queues are diagnostics/compatibility, not primary work authority.
- Deferred batch approval is shown as future architecture, not an active control.
- Zoho Books is an external accounting integration, not payment authority.
- Google Classroom execution is future/external; Operator Next shows handover readiness only.
- WhatsApp remains manual contact support; no automated send authority is implied.
- Runtime release actions remain external. System Health is read-only evidence and diagnostics.
