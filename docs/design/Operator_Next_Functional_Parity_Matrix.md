# Operator Next Functional Parity Matrix

Status: binding Track L implementation contract; local runtime surface implemented, not released

Classification terms:

- **Retain**: current authority-backed Admin capability.
- **Recover**: useful OPS ergonomics rebuilt over current authority DTOs.
- **Redesign**: capability remains, interaction changes.
- **Reject**: must not enter Operator Next.
- **Deferred**: accepted architecture, not current runtime capability.

| Capability | Current source/surface | Owner | Operator Next treatment | Prototype proof |
| --- | --- | --- | --- | --- |
| Population accounting | Population Ledger | Population Ledger | Retain unchanged | KPI distinguishes population from returned worklist |
| Canonical applicant state | `resolveCanonicalApplicantLifecycle_()` | Canonical Lifecycle | Retain unchanged | Row authority drawer shows base state and overlays |
| Workload eligibility | Actionability preview DTO | Actionability Resolver | Retain unchanged | Cards, rows, selection use `selectable` projection |
| Broad workload groups | Operations Workspace | Actionability Resolver | Retain | Applicant Action, Finance, Academic, Contactability, Management |
| Immediate worklists | Operations Workspace | Actionability Resolver | Retain and foreground | Finance tabs separate Payment Follow-up and Payment Review |
| Current Worklist | Operations Workspace | Actionability Resolver | Recover OPS density | Bounded table with population/returned/outside-window labels |
| Select Visible / Returned | Operations Workspace | Actionability Resolver | Retain | Selection cannot include non-selectable rows |
| Applicant Review | Review Workspace | Review Workspace mutation authority | Retain | Right-side drawer preserves selected applicant |
| Document review | Review Workspace | Document Review Authority | Retain | Document checklist and Review action shown |
| Payment display | Review/Operations | `Receipt_Status` payment authority | Retain | Finance cases distinguish evidence missing from review pending |
| Payment verification | Review Workspace | Payment Authority + capability gate | Retain, gated | Disabled for non-Super roles in prototype |
| Individual communication | Review Workspace | Communication Authority | Retain | Recommendation, requested type, preview and send state shown |
| Template gallery | Review Workspace | Communication semantic registry | Retain | Recommended template highlighted; alternatives visible |
| Batch Communication | Operations Workspace modal | Communication Authority | Retain | Selected cohort modal, cap, preview, confirmation and diagnostics |
| Stage Batch | Compatibility path | Legacy stage selection + Communication Authority final gate | Redesign later | Shown only as compatibility diagnostics, not primary workflow |
| Communication activity | Admin communications surfaces | Communications Ledger | Recover | Activity view separates attempted, sent, blocked, cooling-off |
| Lifecycle Map | Admin/OPS | Canonical Lifecycle projection | Recover | Global and Working toggles with explicit scope |
| Operational dashboards | Admin/OPS summaries | Composed authority summaries | Recover | Attention, oldest, ready, cooling-off, activity, finance, registry, health |
| Contactability workload | Operations Workspace | Actionability Resolver | Retain | First-class Contactability Exceptions route implemented |
| Management exceptions | Operations Workspace | Actionability Resolver | Retain, narrow | Governance/manual/policy contradictions only |
| Zoho Books preview | Review/OPS billing | External integration | Retain | Finance handoff panel, metadata clearly non-authoritative |
| Zoho Books draft create | Review/OPS billing | External integration + capability gate | Retain, gated | Simulated confirmation only; no live write |
| Portal status/link | Review/OPS | Portal Identity/Availability/Progress | Retain | Three-domain status appears in Review drawer |
| Portal reset/lock | Review/OPS | Portal mutation authority | Retain, Super only | Visible as gated governance action |
| WhatsApp fallback / manual contact | Admin/OPS fallback | Contactability projection + export capability | Redesign as selected VCF | Runtime VCF blocked pending exact selected-cohort Track H adapter; prototype remains local-only |
| Role modes | OPS | Role/capability projection | Redesign | Role selector demonstrates capabilities; permissions remain backend-owned |
| Runtime identity/health | Admin/OPS | Release tooling/live whoami | Hand off | Small read-only status in shell; full release controls external |
| System Health | Admin/OPS diagnostics | whoami, Ledger, authority/integration diagnostics | Retain read-only | Dedicated runtime, parity, compatibility, release, and audit route |
| Roles and capabilities | Admin role model | `resolveAdminCapabilities_()` | Retain | Dedicated account matrix with explicit unavailable reasons |
| Registry/Classroom readiness | Admin/OPS handoff surfaces | Registry projection + external Classroom boundary | Represent | Eligibility, examination preparation, exceptions, and handover route |
| Release controls | OPS reference | External release engineering | Reject | Not present in prototype |
| Review Queues | Compatibility navigation | Compatibility only | De-emphasize | Listed in blueprint; absent from primary navigation |
| Legacy campaign | Historical/compatibility | Historical campaign | Reject from operator core | No campaign action in prototype |
| Direct WhatsApp send | Not implemented | None | Reject | Explicit no-send boundary |
| Classroom teaching/progress | Future external domain | Google Classroom | Deferred | Handoff status only; no teaching workflow |
| Examination registry | Future Registry domain | Registry | Deferred | Documented, not prototyped as live capability |

## Handler and Authority Mapping

| Prototype action | Future runtime adapter | Final authority/gate |
| --- | --- | --- |
| Load dashboard/worklist | `admin_getActionabilityPreview()` | Population Ledger + Actionability DTO |
| Open Review | existing applicant detail RPC | Review Workspace + capability resolver |
| Generate preview | selected-applicant preview RPC | Communication Authority |
| Send individual | selected-applicant send RPC | Communication Authority + idempotency/cooldown/contactability |
| Open Batch Communication | selected/manual or Stage wrapper | Communication Authority; cap/cache parity |
| Create Books draft | existing Books preview/create RPCs | Books adapter + `CAN_WRITE_ZOHO_BOOKS`; `Receipt_Status` unchanged |
| Export selected WhatsApp contacts | No safe existing exact-cohort handler; future bounded adapter | Actionability selection + explicit export capability; no send authority |

## Runtime Binding Matrix

| Operator Next route/action | Existing handler or DTO | Owning authority | Required capability | Status |
| --- | --- | --- | --- | --- |
| Lifecycle Map, Working View | `admin_getActionabilityPreview()` → `canonicalLifecycle.baseState` | Canonical Lifecycle via Actionability DTO | Configured Admin account | Implemented, bounded returned cohort |
| Lifecycle Map, Global View | `admin_getOpsLifecycleSummary()` | Compatibility projection | Configured Admin account | Implemented, explicitly compatibility-labelled |
| Operational Dashboard | Actionability DTO; lazy `admin_getOperationalDashboardMetrics()` | Ledger + Actionability + metrics projection | Configured Admin account | Implemented |
| Applicant Action queue | Actionability `workloadGroupKey`, `worklistKey`, `selectable` | Actionability Resolver | Configured Admin account | Implemented |
| Admissions Review queue | Actionability canonical/document work projections | Actionability + Document Review | `CAN_OPEN_REVIEW_WORKSPACE` | Implemented |
| Open exact Review | `review(rowNumber, applicantId, ...)` → `admin_getApplicantDetail_json()` | Review Workspace mutation authority | `CAN_OPEN_REVIEW_WORKSPACE` | Implemented through shared mature modal |
| Document save/gallery | Existing Review modal handlers | Document Review authority | `CAN_REVIEW_DOCUMENTS`, `CAN_SAVE_DOCUMENT_STATUSES` | Preserved in shared Review |
| Individual reviewed communication | Existing Review communication controls | Communication Authority | Preview/send capabilities | Preserved in shared Review |
| Selected Batch Communication | `openBatchCommunicationFromSelection_('selected')` | Communication Authority + capped preview cache | `CAN_RUN_BATCH_COMMUNICATIONS` | Implemented through shared mature modal |
| Stage Batch | Current Admin compatibility route | Legacy cohort projection; Communication Authority final gate | `CAN_RUN_BATCH_COMMUNICATIONS` | Discoverable compatibility only |
| Finance / Payment Follow-up | Actionability `FINANCE/PAYMENT_FOLLOW_UP`; shared Review | `Receipt_Status` + Actionability | Review/communication capabilities | Implemented |
| Finance / Payment Review | Actionability `FINANCE/PAYMENT_REVIEW`; shared Review | Payment Authority | `CAN_VERIFY_PAYMENT` for mutation | Implemented and capability-labelled |
| Quote/invoice/Books | Shared Review handlers | Finance handoff + Zoho Books adapter | Quote/invoice/Books capabilities | Preserved in shared Review |
| Portal controls | Shared Review handlers | Portal Identity/Availability/Progress | `CAN_INSERT_PORTAL_LINK`; `CAN_MANAGE_PORTAL_ACCESS` | Preserved and capability-labelled |
| Contactability queue | Actionability `CONTACTABILITY` group | Actionability Resolver | Review capability | Implemented |
| Selected VCF | No safe existing exact-cohort handler | Future contact-export adapter | Future explicit export capability | Blocked: Track H required |
| Registry/Classroom readiness | Canonical `ENROLMENT_READY` returned rows | Canonical Lifecycle; external Classroom boundary | Configured Admin account | Represented; future execution labelled |
| Exceptions/Hidden | Actionability hidden/unknown/management DTOs | Ledger + Actionability | Configured Admin account | Implemented |
| Reports & Audit | Existing Actionability, metrics, and drift summaries | Declared source per metric | Configured Admin account | Implemented summary routes |
| System Health | `admin_getRuntimeInfo()`; lazy `admin_getOperationalSafetyStatus()` | Live runtime + safety diagnostics | Configured Admin account | Implemented read-only |
| Roles & Capabilities | Template bootstrap plus `admin_getCapabilityGrantMatrix()` refresh from `resolveAdminCapabilities_()` | Capability resolver + `Capability_Grants` current-state authority | Configured Admin account; grant/revoke controls require `SUPER` | H1 live at Admin `@373`, `r340 / 340`; schema ready with zero grants |
| Right-click / three-dot Review | `operatorNextOpenReview_()` | Same shared Review path | Same Review capability | Implemented parity |
| Right-click selection | Server `selectable` only | Actionability Resolver | Batch capability enforced at Batch entry | Implemented parity |

## Remaining Bounded Gaps

- A future shell DTO could compose population, workload, capability, and runtime metadata, but it is not required for the current lazy Track L surface.
- Full-population canonical lifecycle counts need a canonical backend summary; existing full-population OPS counts remain compatibility evidence only.
- Stage Batch remains a compatibility path until its cohort selection is migrated separately.
- Review Queue compatibility should remain reachable only as reconciliation/navigation during migration.
- Selected VCF requires a bounded backend projection, explicit capability, and audit event in a separate Track H CIS.
- Runtime release needs Admin-staging browser acceptance for all roles and narrow/mobile widths.
