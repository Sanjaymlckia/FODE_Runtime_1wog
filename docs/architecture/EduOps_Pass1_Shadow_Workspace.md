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
- `EduOps_Client.html` contains the browser shell and closed RPC map.
- `EduOps_Contracts.js` defines versioned contracts, configuration and access helpers.
- `EduOps_FODE_Adapter.js` translates canonical FODE authority output into EduOps DTOs.
- `EduOps_Workload.js` exposes read-only EduOps RPCs and route rendering.

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

## Owner-Review Follow-Ups

- Actionability navigation is duplicated in the rail and horizontal KPI row. The smallest later correction is to keep one interactive navigation set and make the other a non-interactive count summary.
- Raw parity diagnostics is too prominent in the normal operator rail. The smallest later correction is to move it under a secondary Diagnostics disclosure without changing the parity RPC or authority contract.

These are bounded navigation/prominence findings, not part of the workload reliability repair and not a Pass 2 expansion.

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
