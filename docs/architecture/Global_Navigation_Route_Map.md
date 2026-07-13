# Global Navigation Route Map

Status: architecture audit for Admin `@373`, runtime `r340 / 340`.

Scope: Operator Next primary shell, Current Admin supported fallback, retained OPS reference surfaces, route handlers, context actions, RPCs, and compatibility navigation.

No runtime behaviour is changed by this document.

## Executive Summary

Operator Next is the primary work surface. Current Admin remains the supported fallback and still hosts the mature Review Workspace, Batch Communication modal, Stage Batch compatibility panel, System Health panels, and operational diagnostics. OPS remains retired/reference only.

Audit result:

- No active Operator Next route calls `admin_getOpsLifecycleSummary`.
- No visible current core route depends on OPS authority.
- Global View is contained: the control is disabled, labelled as pending, and no OPS lifecycle RPC is triggered.
- Operator Next selection, Review handoff, and selected Batch Communication reuse existing Current Admin handlers and backend gates.
- Context-menu Review/communication/finance/portal actions all converge on `operatorNextOpenReview_()`.
- Stage Batch remains a compatibility route, not a primary authority route.
- Capability grants are live under Roles & Capabilities and resolve through `resolveAdminCapabilities_()` / `Capability_Grants`.

## Classification Legend

| Classification | Meaning |
|---|---|
| ACTIVE AUTHORITY | Backend authority or final gate. |
| PRIMARY WORK SURFACE | Operator Next visible route over existing authorities. |
| SUPPORTED FALLBACK | Current Admin route retained for mature workflows and rollback. |
| COMPATIBILITY ONLY | Retained compatibility/navigation route; not current authority. |
| DISABLED / DEFERRED | Visible but explicitly unavailable or future architecture. |
| RETIRED | Historical/reference only; not active operational authority. |
| ORPHANED / UNREACHABLE | Present in source but no current visible route. |
| DEFECT - AUTHORITY LEAK | Visible route owns or bypasses a declared authority incorrectly. |
| DEFECT - OPS CONTAMINATION | Visible current route requires OPS authority or OPS-only DTOs for core operation. |

## Complete Route Matrix

| Surface | Visible label / entry | Internal route key | DOM handler / client function | Backend RPC / handler | Data source | Authority source | Required capability | Mutation capability | Classification | OPS dependency | Recommended disposition |
|---|---|---|---|---|---|---|---|---|---|---|---|
| Operator Next sidebar | Lifecycle Map | `lifecycle` | `data-onx-route`, `operatorNextActivateRoute_()` | `admin_getActionabilityPreview({ limit: 100 })` via shared `loadActionabilityPreview_()` | Actionability preview rows | Canonical Lifecycle via Actionability DTO | configured Admin account | none | PRIMARY WORK SURFACE | none | keep |
| Operator Next lifecycle toolbar | Global View - canonical summary pending | global control, not active route | `operatorNextContainGlobalView_()`; button disabled | none | none | none; deferred | none | none | DISABLED / DEFERRED | explicitly does not call OPS RPC | keep contained until canonical global summary exists |
| Operator Next lifecycle toolbar | Working View | working control | `operatorNextRenderLifecycle_(false)` | none beyond already loaded Actionability | bounded returned rows | Actionability DTO | configured Admin account | none | PRIMARY WORK SURFACE | none | keep |
| Operator Next sidebar | Operational Dashboard | `dashboard` | `operatorNextActivateRoute_()`; lazy `operatorNextLoadMetrics_()` | `admin_getOperationalDashboardMetrics()` | dashboard metrics + Actionability | Ledger + Actionability + metrics projection | configured Admin account | none | PRIMARY WORK SURFACE | none | keep |
| Operator Next sidebar | Applicant Action | `applicant` | `operatorNextRenderApplicant_()` | already loaded `admin_getActionabilityPreview()` | `workloadGroupKey`, `worklistKey`, `selectable`, hidden summaries | Actionability Resolver | configured Admin account | none | PRIMARY WORK SURFACE | none | keep |
| Operator Next sidebar | Admissions Review | `admissions` | `operatorNextRenderAdmissions_()` | already loaded Actionability; Review handoff on row action | document/review work projections | Canonical Lifecycle + Actionability; Review Workspace for mutation | `CAN_OPEN_REVIEW_WORKSPACE` for Review | Review only after handoff | PRIMARY WORK SURFACE | none | keep |
| Operator Next sidebar | Communications | `communications` | `operatorNextRenderCommunications_()` | lazy metrics; Review/Batch actions use existing handlers | selected rows, communication metrics | Communication Authority remains final gate | `CAN_OPEN_REVIEW_WORKSPACE`, `CAN_RUN_BATCH_COMMUNICATIONS` as applicable | no direct send; handoff only | PRIMARY WORK SURFACE | none | keep |
| Operator Next Communications | Individual reviewed email | action button | `operatorNextOpenSelectedReview_()` -> `operatorNextOpenReview_()` | `review()` -> `admin_getApplicantDetail_json()`; Review preview/send RPCs inside modal | selected row | Review Workspace + Communication Authority | `CAN_OPEN_REVIEW_WORKSPACE`; preview/send gates in Review | Review modal may preview/send only through existing gates | PRIMARY WORK SURFACE | none | keep |
| Operator Next Communications | Batch Communication | action button | `operatorNextOpenBatch_()` -> `openBatchCommunicationFromSelection_('selected')` | `admin_previewSelectedApplicantBatch`, `admin_sendSelectedApplicantBatch` | server-selectable selected rows | Communication Authority + selected-batch cap/cache | `CAN_RUN_BATCH_COMMUNICATIONS` | send only through modal confirmation and backend gates | PRIMARY WORK SURFACE | none | keep |
| Operator Next Communications | Open Stage Batch compatibility | action button | `window.open(... '#stageBatchPanel')` | Current Admin Stage Batch RPCs | legacy stage cohort selection | legacy cohort projection; Communication Authority final gate | `CAN_RUN_BATCH_COMMUNICATIONS` | send through existing Stage Batch gates | COMPATIBILITY ONLY | none in Operator Next; current Stage Batch legacy selection remains | migrate in separate Stage Batch pass |
| Operator Next Communications | Open current Admin communications | action button | `window.open(... '#communicationsCard')` | Current Admin communication handlers | Current Admin | Review/Batch communication gates | route-specific capabilities | only through Current Admin gates | SUPPORTED FALLBACK | none | keep fallback |
| Operator Next sidebar | Finance | `finance` | `operatorNextRenderFinance_()` | Review/Books actions after handoff | finance worklist rows | `Receipt_Status` payment authority + Actionability | Review, quote, invoice, Books capabilities as applicable | only through Review/Books RPC gates | PRIMARY WORK SURFACE | none | keep |
| Operator Next Finance | Payment Follow-up | panel | `operatorNextRenderFinance_()` | Review handoff | `FINANCE / PAYMENT_FOLLOW_UP` | Actionability + Communication Authority for reminder | Review/communication capabilities | none directly | PRIMARY WORK SURFACE | none | keep |
| Operator Next Finance | Payment / Receipt Review | panel | `operatorNextRenderFinance_()` | Review handoff | `FINANCE / PAYMENT_REVIEW` | Payment Authority | `CAN_VERIFY_PAYMENT` for mutation in Review | payment mutation only in Review RPC | PRIMARY WORK SURFACE | none | keep |
| Operator Next Finance | Quote, Invoice & Books | panel | `operatorNextRenderFinance_()` | Review handoff -> Books preview/create RPCs | Books metadata | Zoho Books external adapter; Receipt_Status remains payment authority | quote/invoice/Books capabilities | Books draft only through gated Review RPC | PRIMARY WORK SURFACE | none | keep |
| Operator Next sidebar | Portal Operations | `portal` | `operatorNextRenderPortal_()` | Review handoff | portal identity/availability/progress projection | Portal domain + Review Workspace | `CAN_INSERT_PORTAL_LINK`, `CAN_MANAGE_PORTAL_ACCESS` in Review | portal mutation only in Review | PRIMARY WORK SURFACE | none | keep |
| Operator Next sidebar | Contactability | `contactability` | `operatorNextRenderContactability_()` | already loaded Actionability | `CONTACTABILITY` rows | Actionability Resolver | Review capability for handoff | none directly | PRIMARY WORK SURFACE | none | keep |
| Operator Next Contactability | Export selected VCF | disabled control | disabled Track L boundary | none | none | future exact-cohort adapter absent | future export capability | none | DISABLED / DEFERRED | none | implement only via Track H adapter |
| Operator Next sidebar | Registry & Classroom | `registry` | `operatorNextRenderRegistry_()` | already loaded Actionability | readiness projections | Canonical Lifecycle + external Classroom boundary | configured Admin account | none | DISABLED / DEFERRED for execution; PRIMARY WORK SURFACE for readiness | none | keep as readiness only |
| Operator Next sidebar | Exceptions / Hidden | `exceptions` | `operatorNextRenderExceptions_()` | already loaded Actionability | hidden, unknown, blocked, management rows | Ledger + Actionability | configured Admin account | none | PRIMARY WORK SURFACE | none | keep |
| Operator Next sidebar | Reports & Audit | `reports` | `operatorNextRenderReports_()`; refresh metrics | `admin_getOperationalDashboardMetrics()` | metrics + Actionability + drift | Ledger, Actionability, diagnostics | configured Admin account | none | PRIMARY WORK SURFACE | none | keep |
| Operator Next sidebar | System Health | `health` | lazy `operatorNextLoadHealth_()` | `admin_getRuntimeInfo()`, `admin_getOperationalSafetyStatus()` | runtime + safety diagnostics | live runtime + safety diagnostics | configured Admin account | none | PRIMARY WORK SURFACE | none | keep read-only |
| Operator Next sidebar | Roles & Capabilities | `roles` | `operatorNextLoadCapabilityGrants_()` | `admin_getCapabilityGrantMatrix`, `admin_createTemporaryCapabilityGrant`, `admin_revokeTemporaryCapabilityGrant` | bootstrap capability context + Capability_Grants | Capability Resolver + `Capability_Grants` | configured account; grant/revoke requires Super on server | temporary grant/revoke through server gates | PRIMARY WORK SURFACE | none | keep |
| Operator Next row button | Review | row `data-onx-review` | `operatorNextOpenReview_()` | `admin_getApplicantDetail_json()` via `review()` | selected row number + ApplicantID | Review Workspace | `CAN_OPEN_REVIEW_WORKSPACE` | Review modal mutation only | PRIMARY WORK SURFACE | none | keep |
| Operator Next row button | More / three-dot | row `data-onx-more` | `operatorNextOpenRowContext_()` | none until selected action | selected row | same as chosen action | same as chosen action | none directly | PRIMARY WORK SURFACE | none | keep |
| Operator Next right-click menu | Open Review | `review` | `operatorNextHandleContext_()` -> `operatorNextOpenReview_()` | `admin_getApplicantDetail_json()` via `review()` | selected row | Review Workspace | `CAN_OPEN_REVIEW_WORKSPACE` | Review modal only | PRIMARY WORK SURFACE | none | PASS parity |
| Operator Next right-click menu | Open reviewed communication | `communication` | `operatorNextHandleContext_()` -> `operatorNextOpenReview_()` | Review communication RPCs inside modal | selected row | Communication Authority | Review/communication capabilities | preview/send only through Review gates | PRIMARY WORK SURFACE | none | PASS parity |
| Operator Next right-click menu | Open finance in Review | `finance` | `operatorNextHandleContext_()` -> `operatorNextOpenReview_()` | Review/finance RPCs inside modal | selected row | Payment/Books authorities | Review/finance capabilities | mutation only in Review RPCs | PRIMARY WORK SURFACE | none | PASS parity |
| Operator Next right-click menu | Open portal controls in Review | `portal` | `operatorNextHandleContext_()` -> `operatorNextOpenReview_()` | Review portal controls | selected row | Portal authority | Review/portal capabilities | mutation only in Review RPCs | PRIMARY WORK SURFACE | none | PASS parity |
| Operator Next right-click menu | Select for cohort | `select` | `operatorNextHandleContext_()` | none | selected row | Actionability `selectable` | batch capability checked at Batch entry | none | PRIMARY WORK SURFACE | none | keep |
| Operator Next stage context | Work queue route | `queue` | `operatorNextActivateRoute_(def.route)` | none beyond existing route data | bounded rows | Actionability DTO | configured Admin account | none | PRIMARY WORK SURFACE | none | keep |
| Operator Next stage context | Review first returned record | `first` | `operatorNextOpenReview_()` | Review RPC | first returned row | Review Workspace | `CAN_OPEN_REVIEW_WORKSPACE` | Review modal only | PRIMARY WORK SURFACE | none | keep |
| Current Admin | Review Workspace | modal/function `review()` | `review()` | `admin_getApplicantDetail_json`, document, payment, communication, Books RPCs | row detail | Review Workspace mutation authority + message/payment/document gates | capability-specific | yes, through server gates | SUPPORTED FALLBACK | none | keep |
| Current Admin | Operations Workspace / Actionability | in-page cards/worklist | `loadActionabilityPreview_()` | `admin_getActionabilityPreview()` | Actionability preview | Actionability Resolver | configured Admin account | selection only | SUPPORTED FALLBACK | none | keep |
| Current Admin | Batch Communication modal | modal | `openBatchCommunicationFromSelection_()` | selected/stage preview/send RPCs | selected rows or Stage Batch | Communication Authority final gate | batch capability | send through modal confirmation | SUPPORTED FALLBACK | none | keep |
| Current Admin | Stage Batch panel | `#stageBatchPanel` | Stage Batch client functions | `admin_previewStageBatch`, `admin_sendStageBatch` | legacy stage cohort selection | compatibility projection; Communication Authority final gate | batch capability | send through Stage Batch gates | COMPATIBILITY ONLY | none | migrate later |
| Current Admin | Communications card | `#communicationsCard` | Review/selected communication controls | Review and batch RPCs | current Admin state | Communication Authority | communication capabilities | only through gates | SUPPORTED FALLBACK | none | keep |
| Current Admin | System Health panel | `#systemHealthPanel` | health render/fetch functions | `admin_getRuntimeInfo`, `admin_getOperationalSafetyStatus` | runtime/safety diagnostics | live runtime + safety diagnostics | configured Admin account | none | SUPPORTED FALLBACK | none | keep |
| Current Admin | Review Queues | queue panels | `loadReviewQueues()` | `admin_getReviewQueues` | compatibility queue summary | compatibility navigation | configured Admin account | none | COMPATIBILITY ONLY | none | de-emphasize after Operator Next replacement |
| Current Admin | OPS Shell | `?view=ops` | legacy OPS client functions | `admin_getOpsLifecycleSummary` and OPS helper routes | OPS compatibility DTOs | retired/reference | configured Admin account | safe-mode guarded only | RETIRED | OPS reference route only | archive after evidence review |

## OPS Dependency Findings

`admin_getOpsLifecycleSummary()` remains in `Admin.js` for the retired/reference OPS surface and compatibility evidence. Current Operator Next does not call it. Current Admin core workflows use Actionability, Review, Communication, Payment, Books, and Health handlers instead.

OPS contamination test result: PASS.

No current visible Operator Next route requires OPS-only DTOs, OPS lifecycle counts, OPS-specific actionability logic, OPS mutation handlers, OPS send handlers, OPS role checks, or OPS-specific population filtering presented as canonical.

The only visible Operator Next mention of OPS-derived capability is the Health route compatibility row that labels the old global lifecycle summary as compatibility.

## Global View Containment Proof

Global View is visible but contained:

- `#onxGlobalScope` is rendered with `disabled` and `aria-disabled="true"`.
- The button label is `Global View - canonical summary pending`.
- The explanatory text says: `Full-population canonical lifecycle counts are not yet available. Working View remains authoritative.`
- `operatorNextContainGlobalView_()` enforces the disabled state and explanatory note.
- `operatorNextShowGlobalCompatibility_()` renders a containment message and does not call `admin_getOpsLifecycleSummary`.
- `tests/operator-next-runtime-surface.test.js` asserts no OPS lifecycle call on initial hydration or programmatic Global View activation.

Result: PASS.

## Context-Menu Parity Findings

| Action family | Visible action | Context action | Common handler | Result |
|---|---|---|---|---|
| Review | row Review button | Open Review | `operatorNextOpenReview_()` | PASS |
| Individual communication | Individual reviewed email button requires one selected row | Open reviewed communication | `operatorNextOpenReview_()` then Review communication controls | PASS |
| Finance | Finance route row Review | Open finance in Review | `operatorNextOpenReview_()` | PASS |
| Portal | Portal route selected Review | Open portal controls in Review | `operatorNextOpenReview_()` | PASS |
| Cohort selection | row checkbox / Select returned | Select for cohort | server `selectable` check, then batch entry capability check | PASS |
| Stage lifecycle card | card click | context queue action | `operatorNextActivateRoute_()` | PASS |

No context-only send, payment verification, portal mutation, Books write, or applicant mutation route was found.

## Role / Capability Enforcement Findings

Operator Next uses the shared Admin bootstrap capability context for client visibility and readiness labels. Server-side enforcement remains in the backend:

- `resolveAdminCapabilities_()` builds effective capabilities.
- `requireAdminCapability_()` and `adminHasCapability_()` enforce backend gates.
- Review handoff checks `CAN_OPEN_REVIEW_WORKSPACE` client-side before opening the shared Review path.
- Selected Batch Communication checks `CAN_RUN_BATCH_COMMUNICATIONS` before opening the modal, and backend selected-batch RPCs re-check capability and Communication Authority.
- Individual preview/send RPCs require `CAN_PREVIEW_APPLICANT_COMMUNICATION` and `CAN_SEND_INDIVIDUAL_EMAIL`.
- Payment verification and Books draft creation remain gated by payment/Books RPCs.
- Temporary grant create/revoke actions are exposed only through the Roles route and are server-gated by Super authority and `Capability_Grants` schema/state.

No role-name-only branch was found in Operator Next authority decisions. Existing tests assert this boundary.

Result: PASS.

## Orphaned or Unreachable Routes

| Item | Classification | Finding | Disposition |
|---|---|---|---|
| Global View canonical full-population route | DISABLED / DEFERRED | Visible but intentionally disabled; no canonical DTO yet. | build canonical summary later or remove button |
| Selected VCF export | DISABLED / DEFERRED | Visible boundary only; no safe exact-cohort runtime adapter. | separate Track H adapter required |
| Future batch approval workflow | DISABLED / DEFERRED | Labelled future only; no active approval authority. | H2 programme |
| Registry execution / Classroom teaching | DISABLED / DEFERRED | readiness only; no teaching/assessment workflow. | external Classroom bridge later |
| OPS `?view=ops` | RETIRED | still routable as reference/fallback evidence. | archive after recovery/evidence review |

No active primary Operator Next route is orphaned.

## Compatibility Routes Retained

| Route / capability | Why retained | Current authority status | Cleanup trigger |
|---|---|---|---|
| Current Admin `?view=admin` | mature Review, Batch, Stage Batch, and rollback host | supported fallback | Operator Next fully replaces workflows with owner approval |
| Stage Batch panel | legacy cohort selection remains operational compatibility | compatibility projection; Communication Authority final gate | dedicated Stage Batch migration |
| Review Queues | navigation/reconciliation | compatibility only | queue consumers move to authority-backed surfaces |
| OPS `?view=ops` | historical evidence / retired reference | retired reference | post-V1 archive |
| Global View | future canonical full-population summary placeholder | disabled/deferred | canonical full-population DTO exists |

## Recommended Cleanup Order

P0: none found.

P1: none found.

P2:

1. Stage Batch cohort migration from legacy stage selection to canonical/actionability cohort source.
2. Review Queue compatibility reduction after Operator Next acceptance stabilizes.
3. Canonical full-population lifecycle summary DTO to replace the disabled Global View placeholder.
4. OPS source archival after recovery/evidence review.

P3:

1. Convert this route map into a maintained checklist for future Operator Next changes.
2. Add a route-map static test only if route churn resumes.
3. Keep parity documentation synchronized when a new navigation entry is added.

## V1 Impact Statement

Architecture Build V1 remains closed. The audit found no P0/P1 route authority issue, no active OPS contamination, no active Global View execution path, and no context-menu bypass. The remaining items are compatibility cleanup and deferred architecture, not blockers to V1.

## Post-V1 Backlog

- Canonical Global Population Summary DTO.
- Stage Batch canonical cohort migration.
- Selected VCF/manual contact exact-cohort adapter.
- Review Queue retirement or de-emphasis.
- OPS archival after backup/recovery evidence review.
- Route-map regression test if Operator Next navigation grows.
