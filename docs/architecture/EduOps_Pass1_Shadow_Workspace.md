# EduOps Pass 1 Shadow Workspace

Status: source implementation checkpoint for owner-run Admin staging release.

Track: high-safety, read-only runtime implementation.

## Boundary

EduOps Pass 1 is a separate Admin application route at `?view=eduops`.

It does not modify Current Admin, Operator Next, OPS, Student or Production behaviour. Current Admin remains the operational surface.

```text
FODE authoritative runtime
  -> EduOps FODE adapter
  -> shared EduOps contracts
  -> read-only EduOps workload and Workbench
```

Only FODE is connected in Pass 1. KIA and MLC remain future product adapters.

## Runtime Files

- `EduOps.html` is the isolated template.
- `EduOps_Styles.html` contains scoped `.eduops-*` styles.
- `EduOps_Client.html` contains the browser shell, closed RPC map and transport boundary.
- `EduOps_Contracts.js` defines versioned contracts, configuration and access helpers.
- `EduOps_FODE_Adapter.js` translates canonical FODE authority output into EduOps DTOs.
- `EduOps_Workload.js` exposes read-only EduOps RPCs and route rendering.

## Preview-First Owner Acceptance

EduOps UI and interaction changes must be reviewed locally through `tools/eduops-snapshot-capture/` before another Admin staging release where practical.

The Preview Lab renders `EduOps.html`, `EduOps_Styles.html` and `EduOps_Client.html` from runtime source and swaps only the transport/backend boundary:

```text
shared EduOps client
  -> Apps Script transport for staging/runtime
  -> Preview transport for deterministic local scenarios
```

The Preview Lab has two explicit data modes:

- Deterministic Scenario Mode: fixed reproducible fixtures labelled `DETERMINISTIC SCENARIO DATA / NOT CURRENT FODE DATA / NO LIVE OPERATIONS`.
- Fresh FODE Snapshot Mode: local immutable DTO snapshot captured by an explicit developer command from authorised Admin staging read-only EduOps RPCs and labelled `CURRENT AS OF CAPTURE TIME`.

Normal Preview Lab startup never contacts Admin staging. Fresh snapshots are stored under `tools/eduops-snapshot-capture/evidence/generated/snapshots/`, are ignored by Git, and must pass contract compatibility, sanitisation and reconciliation checks before loading.

Staging is reserved for live authority, integration, access-control and performance acceptance. The Preview Lab is the owner-facing UI/UX acceptance gate and has no automatic live data dependency.

## Public RPC Allowlist

Pass 1 allows only:

- `eduops_getAccessProjection`
- `eduops_getProfile`
- `eduops_queryOperationalWorkload`
- `eduops_searchApplicants`
- `eduops_getApplicantWorkbench`
- `eduops_getDocumentManifest`
- `eduops_getDocumentRendition`
- `eduops_getDocumentFileAction`
- `eduops_getReconciliation`
- `eduops_getParityDiagnostics`

No EduOps RPC writes Sheet cells, sends mail, changes Portal access, creates Books records, saves document status, verifies payment, executes batches, changes properties or mutates roles/capabilities.

## Authority Reuse

The FODE adapter consumes existing authority outputs:

- Canonical Population via `canonicalPopulationSnapshot_()`.
- Exact applicant authority via `admin_getCanonicalApplicant()`.
- Existing applicant detail via `admin_getApplicantDetail()`.
- Document manifest, PNG rendition and signed original actions via `Admin_DocumentGallery.js`.
- Capability projection via `resolveAdminCapabilities_()` and `adminHasCapability_()`.

EduOps does not copy Review Queue authority, Stage Batch authority, OPS client logic, legacy Admin DOM/CSS or prototype mock authority.

## Snapshot And Reliability

Workload responses include:

- `contractVersion`
- `profileVersion`
- `snapshotId`
- `snapshotAsOf`
- source reliability state
- actionability counts
- worklist counts
- reconciliation
- bounded page rows

If `expectedSnapshotId` differs from the current FODE snapshot, the response is marked `STALE`. The Workbench rejects stale exact-open requests.

The compact EduOps projection is cached for a bounded 120-second TTL by FODE source version and authorised access scope. The source version uses the authoritative spreadsheet identity, sheet dimensions and Drive last-updated value. Cache loss rehydrates from Canonical Population and reproduces the same content-derived `snapshotId`; an unavailable source-version signal disables caching rather than silently reusing a potentially stale projection.

Workload timing telemetry separates access, source-version resolution, cache read, canonical build, projection, workload composition, sorting/paging, total server RPC duration, response bytes and client render duration.

## Request And Scope Integrity

Only one workload RPC is started at a time. Duplicate requests reuse the in-flight promise; a newer context replaces any queued context; superseded responses are discarded; and a 10-second client timeout replaces permanent loading with a retry state. Loading, queued and error states identify the requested Actionability state, ownership scope and page.

Changing top-level Actionability resets ownership scope to `ALL_AUTHORISED` unless the operator explicitly selects **Pin scope across Actionability**. When pinned scope produces no rows beneath a non-zero Actionability total, the workload reports both the All Authorised total and the scoped matched count.

## Navigation And Diagnostics

Actionability navigation has one primary control set in the left rail. The horizontal Actionability row is a non-interactive count summary.

Raw parity diagnostics remains available but is moved out of normal operator navigation and placed behind a technical authority diagnostics disclosure. The parity RPC and authority contract are unchanged.

## Document Review Rule

The canonical original remains authoritative.

The browser review path is:

```text
canonical original -> secure server file resolution -> server-derived PNG rendition -> separate signed Open Original action
```

If a PNG rendition is unavailable, the UI must show the unavailable state and preserve the separate Open Original path.

## Pass 1 Exclusions

Pass 1 does not implement:

- document status save;
- contact correction;
- communication preview capable of sending;
- communication send;
- payment verification or rejection;
- Books writes;
- Portal reset, lock, unlock or resend;
- batch execution;
- assignment mutation;
- approvals;
- Registry or Classroom mutation;
- role administration;
- KIA or MLC runtime.

All future actions are displayed as disabled read-only controls labelled for EduOps Pass 2.
