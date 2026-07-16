# EduOps Pass 2 Operations Workspace

Status: implementation checkpoint for owner Preview Lab acceptance. Not released and not operationally accepted.

Release track: Track H.

## Product Baseline

The product reconstruction follows this precedence:

1. `prototypes/eduops-next/` for the consolidated Actionability, worklist, cohort, Workbench, Batch Operations, search, reliability, ownership and domain-lens model.
2. `prototypes/eduops/` for approved visual and interaction lineage.
3. Existing Current Admin services for FODE business rules, capability checks, document authority, Finance, communications and Portal operations.
4. The r352 adapter, snapshot, request-state, search and reconciliation infrastructure.

The r352 interface is not the visual baseline. Current Admin remains available and is not redesigned by this pass.

## Runtime Boundary

FODE is the only live product adapter. KIA and MLC are isolated Preview Lab profiles with independent snapshots and workspace state.

The browser has two explicit RPC allowlists:

- Read: access, profile, workload, search, exact Workbench, document manifest/rendition/original action, reconciliation, parity, operation history and command preview.
- Write: `eduops_executeCommand` only.

Browser code never calls a legacy Admin write RPC directly.

## Presentation Architecture

- `EduOps_ClientCore.html`: state, transport, query binding, request supersession, timeout, product state and dialog primitives.
- `EduOps_ClientComponents.html`: Actionability navigation, worklists, ownership scopes, filters, search, table, pagination, reconciliation and supporting views.
- `EduOps_ClientWorkbench.html`: exact applicant identity, persistent authority header, Overview, Documents, Finance, Communications, Portal, Contactability and Audit tabs.
- `EduOps_ClientBatch.html`: snapshot/query-bound cohort, revalidation, partitions, preview, confirmation, receipt, exception handoff and Work Session.
- `EduOps_Client.html`: startup, access/profile projection, keyboard layers, focus containment and browser-history coordination.

The operator flow remains:

```text
Actionability
-> Worklist key
-> Eligible cohort
-> Batch Operations or Individual Workbench
-> Authoritative receipt
-> Updated workload
```

Lifecycle and domain lenses provide context. They do not create competing workload authority.

## Guarded Commands

Every operation is bound to product, snapshot, query where applicable, exact ApplicantID or selected ApplicantIDs, required capability, preview ID, expiry and idempotency key.

Execution order:

1. Resolve authorised operator.
2. Require an independently enabled domain feature flag.
3. Require the operation capability.
4. Revalidate product snapshot and exact applicant or cohort binding.
5. Create a bounded preview.
6. Require explicit confirmation.
7. Revalidate preview expiry, snapshot, capability and any dual approval.
8. Acquire the operation lock.
9. Replay an existing receipt for the same idempotency key, or delegate once to existing authority.
10. Return and audit a versioned receipt.

All live feature flags default to `false`. Books remains independently disabled. No refund, credit, write-off, unrestricted Books, batch document decision, batch payment decision or batch Portal reset is exposed.

### Authority-Compatible Operations

| Surface | Supported guarded operation | Existing authority | Limitation |
| --- | --- | --- | --- |
| Documents | Individual status, reviewer note and overall review | Document verifier/save authority | Batch document decisions are prohibited. |
| Communications | Individual reviewed email; bounded batch communication | Existing individual and selected-applicant preview/send authorities | Batch execution remains flag-off; the legacy batch authority returns aggregate results, so unresolved per-applicant outcomes are never presented as complete. |
| Finance | Verify payment evidence | Existing payment verification authority | Rejection is unavailable because no dedicated rejection authority is proven. |
| Portal | Lock, unlock and approved reset | Existing Portal access authority | Reset requires independent approval; resend is handed to Communications. |
| Contactability | Exact applicant email correction | Existing contact update authority | Phone correction is unavailable because no proven phone-update authority is exposed. |
| Books | None | None exposed through EduOps | The Books control and flag remain disabled and no runtime dispatch exists. |

Assignments and approvals remain structural/read-only. Reports, System Health, system-wide Audit, Roles and Capabilities, and Data Quality remain read-only or structural. A visible lens does not claim mutation parity.

Idempotency is bound to a canonical command-context fingerprint, not only the caller key. Safe replay returns the original receipt; reuse for an altered operation, applicant, cohort, snapshot, query, document, draft or approval context fails with `IDEMPOTENCY_CONTEXT_CONFLICT`.

## Documents

The Workbench resolves the exact applicant manifest and passes ApplicantID, row identity, snapshot, source field, item index and manifest `documentKey` to rendition and Open Original calls. The PNG is a derived browser rendition. The canonical original remains authoritative and uses a separate signed action.

Document decisions are individual-only and require preview, confirmation and the existing document-verifier authority.

Overall review validates every supplied document against the exact authoritative manifest. A document from another applicant, an altered manifest entry or stale snapshot is rejected before delegation.

## Navigation Safety

Return, close, browser Back, product change, another applicant and Batch entry share the dirty Workbench leave guard. Escape closes only the topmost confirmation and preserves local drafts. Tab and Shift+Tab remain inside the active confirmation.

Workload requests are deduplicated, superseded deterministically, bounded by a ten-second timeout and reported with exact pending page/state/scope context.

## Clean-Start Initialisation

The shared client uses one explicit bootstrap state machine:

```text
BOOT_START
-> ASSETS_READY
-> TRANSPORT_READY
-> ACCESS_READY
-> PROFILE_READY
-> SOURCE_READY
-> WORKLOAD_READY
-> INTERACTIVE
```

Each transition records a diagnostic event and updates an observable root state. Transport, access, profile, source and workload failures render terminal error states with bounded retry rather than leaving snapshot or authority labels pending. Controls that require workload authority are disabled until `INTERACTIVE`; source retry and safe read-only navigation remain available.

Preview Lab startup is independently gated by `/health`. The health contract proves application assets, the shared runtime client and Preview transport are renderable, and exposes exact runtime-input and served-bundle hashes. The owner launcher refuses an occupied port and opens the browser only after health passes.

Preview technical selections use browser-session storage rather than persistent local storage. An ordinary new browser process therefore cannot inherit a prior timeout, unavailable-source or alternative-data scenario. HTTP responses remain `no-store`, and no service worker controls the local Preview origin.

The Preview Lab does not maintain a second client build. It reads `EduOps_ClientCore.html`, `EduOps_ClientComponents.html`, `EduOps_ClientWorkbench.html`, `EduOps_ClientBatch.html` and `EduOps_Client.html` directly from the repository for each render.

## Receipts And Audit

Receipts are versioned, snapshot-bound and applicant-specific. Preview Lab batch scenarios provide exact per-applicant outcomes. The existing runtime batch authority may return only aggregate counts; in that case EduOps records `UNCONFIRMED` applicant outcomes and a `PARTIAL` receipt rather than fabricating success.

The Workbench history projection uses a bounded six-hour user cache and records the authoritative receipt through the existing Admin audit logger. This is an operator convenience projection, not a replacement for durable audit authority.

## Preview Acceptance

The Preview Lab starts offline and has no live dependency. Simulated execution writes only to in-memory Preview state. Fresh FODE snapshot capture retains the original ten-call read-only allowlist and does not capture command preview or execution.

Required owner acceptance includes all three viewports, exact FODE fixtures, Workbench tabs, document gallery, Batch receipts, dirty navigation, product isolation, failure scenarios, console/page errors, overflow and readability.

Known pre-owner limitations are deliberate and fail closed: all runtime mutation flags are off; KIA and MLC are Preview-only; Books has no dispatch; Finance rejection and phone correction are unavailable; live batch enablement requires an authority that returns exact per-applicant outcomes; and Fresh Snapshot mode cannot simulate commands against live data.

This implementation must not be described as released or accepted before the owner approves Preview Lab evidence and runs the separately authorised release procedure.

## Owner-Review Recovery

The recovery cycle preserves the approved Actionability hierarchy while making interaction state observable. Client controls are classified once at render time; dynamic Workbench, Batch and report controls use the same classification and stable-ID contract. The fixed live region reports loading and terminal results without replacing authoritative DTO state.

Supporting modules are explicit:

- Functional: Actionability, worklists, Workbench, Documents, Communications preview, guarded Finance, guarded Portal, Contactability correction, Batch Operations and Work Session.
- Meaningful read-only: Finance, Communications, Portal and Contactability lenses; Global Lifecycle; Management Summary; Reports; Audit; System Health; reconciliation and hidden reasons.
- Structural: Roles and Capabilities, Assignments and Approvals, and Data Quality.
- Unavailable: Books execution and any operation without a proven authority.
- Technical: Preview scenarios, latency, viewport controls, evidence notes and diagnostics in the collapsed Preview Lab drawer.

The local owner-proxy acceptance run starts a fresh Preview server, uses only visible UI interactions, and captures trace, video, screenshots and a control census. It covers all seven Workbench tabs, dirty Browser Back, document rendition/original separation, individual guarded previews, successful and partial Batch receipts, exception handoff, Work Session, supporting modules, Fresh Snapshot mode and deterministic return. No internal application function or direct state mutation is permitted in that run.
