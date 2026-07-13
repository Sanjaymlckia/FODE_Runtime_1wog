# Operator Next Local Implementation Report

Status: Track L local implementation; no commit, push, release, or live mutation

## Runtime Surface

```text
?view=operator-next
  -> Code.js resolveDoGetHandler_()
  -> Admin.js renderAdminApp_()
  -> AdminUI.html
  -> AdminUI_OperatorNext.html
  -> shared Review and Batch Communication modals in AdminUI.html
```

Fallback routes remain:

- `?view=admin` - current mature Admin.
- `?view=ops` - retired OPS reference surface.

## Initial Hydration

Initial route loads only:

1. `admin_getActionabilityPreview({ limit: 100 })` through the existing UI helper.
2. `admin_getRuntimeInfo()`.

Operational metrics load only on Dashboard, Communications, or Reports. Safety diagnostics load only on System Health. Global lifecycle compatibility counts load only when the operator explicitly selects Global View.

## Typography Refinement

Card dimensions remain `174px` by at least `214px`. Compared with the accepted prototype:

| Element | Prototype | Runtime surface | Change |
| --- | ---: | ---: | ---: |
| Lifecycle heading | 10.5px | 11.5px | +9.5% |
| Lifecycle body | 8.6px | 9.4px | +9.3% |
| Lifecycle fact | 8.4px | 9.2px | +9.5% |
| Queue row | 9px | 9.6px | +6.7% |
| Compact button | 9px / 29px high | 9.5px / 30px high | +5.6% / +3.4% |

Line height increased to 1.38-1.4 for body, fact, and queue text. The OPS-derived font stack and compact proportions are unchanged.

## Canonical Data Sources

| Surface | Data source |
| --- | --- |
| Working lifecycle cards | `canonicalLifecycle.baseState` from Actionability rows |
| Workload and selection | Actionability DTO and server `selectable` |
| Population/accounting | `populationLedger` public summary |
| Review | Existing applicant detail DTO and Review handlers |
| Communication | Existing Review/Batch preview and send handlers |
| Payment | `Receipt_Status` through existing canonical payment display |
| Roles | `ADMIN_CAPABILITIES` from `resolveAdminCapabilities_()` |
| Runtime | `admin_getRuntimeInfo()` |
| Safety | `admin_getOperationalSafetyStatus()` |

Global lifecycle counts use `admin_getOpsLifecycleSummary()` only in a visibly labelled compatibility view. They are not presented as canonical lifecycle authority.

## Reused Actions

- Exact applicant Review: existing `review(rowNumber, applicantId, ...)` path.
- Selected Batch Communication: existing `openBatchCommunicationFromSelection_('selected')` path.
- Post-send refresh: existing forced `loadActionabilityPreview_({ force: true })`, now reflected back into Operator Next.
- Stage Batch: current Admin compatibility route; no Stage Batch behavior change.
- Document, communication, finance, Books, portal, and payment mutations remain inside the shared mature Review Workspace.

## Safety Boundaries

- No lifecycle, Actionability, payment, communication, portal, or role authority is implemented in Operator Next.
- Context-menu and three-dot actions use the same Review/selection handlers as visible controls.
- No direct send RPC exists in `AdminUI_OperatorNext.html`.
- Selected VCF is disabled. Current Actionability rows do not expose an approved phone number, and the existing fallback CSV is not an exact selected-cohort adapter.
- No automated WhatsApp path is introduced.

## Track H Follow-up

Temporary capability grants are implemented locally as a Track H1 extension to the existing Roles & Capabilities route. The route displays durable role, inherited capability state, active temporary provenance, expiry, grant history, and Super-only grant/revoke actions. Backend RPCs remain authoritative. The store is explicitly bound to the main authoritative FODE workbook through `CAPABILITY_GRANTS_SPREADSHEET_CONFIG_KEY`; it does not inherit `DATA_MODE`. Live use remains blocked until the owner-approved `Capability_Grants` migration and Track H release are completed.

Two other capabilities cannot be completed honestly in the original Track L pass:

1. Full-population canonical lifecycle summary. Add a read-only canonical summary DTO rather than reusing the OPS compatibility classifier.
2. Selected VCF export. Add an exact-ID bounded adapter, explicit capability, approved contact projection, and audit event.

Neither gap blocks local evaluation of the Operator Next work surface, Review handoff, selected Batch Communication, finance worklists, reports, health, roles, or context-menu ergonomics.
