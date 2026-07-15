# EduOps Preview Lab

Status: local owner review harness for EduOps Pass 1.

This package runs the actual EduOps client interface locally with either deterministic scenario data or a locally captured Fresh FODE snapshot.

```text
EduOps.html / EduOps_Styles.html / EduOps_Client.html
  -> shared runtime client
  -> transport boundary
     -> Apps Script transport in Admin staging
     -> Preview transport in this local lab
```

The Preview Lab is not a runtime implementation, not a release helper and not a live data tool.

## Start

Run:

```bat
START_EDUOPS_PREVIEW.cmd
```

Default URL:

```text
http://localhost:4173/
```

The page displays:

```text
PREVIEW LAB - SIMULATED DATA - NO LIVE OPERATIONS
NO LIVE DATA / NO LIVE MUTATIONS / SIMULATED EDUOPS CONTRACTS
```

The owner startup panel requires an explicit data mode:

- Deterministic Scenario Mode.
- Fresh FODE Snapshot Mode.

Normal startup is entirely local and never contacts Admin staging automatically.

## Stop

Run:

```bat
STOP_EDUOPS_PREVIEW.cmd
```

The stop script terminates only the PID written by the Preview Lab server.

## Architecture

The server renders the live runtime template directly from repository source:

- `EduOps.html`
- `EduOps_Styles.html`
- `EduOps_Client.html`

The server replaces Apps Script template includes locally and injects:

- `server/preview-lab.css`
- `server/preview-transport.js`

The runtime client uses `window.EDUOPS_TRANSPORT` when present. Without that object, it uses the existing `google.script.run` Apps Script transport.

## Transport Interface

Preview transport implements only the read-only EduOps RPC contract:

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

No mutation transport exists.

## Data Modes

### Deterministic Scenario Mode

Label:

```text
DETERMINISTIC SCENARIO DATA
NOT CURRENT FODE DATA
NO LIVE OPERATIONS
```

This mode uses fixed versioned fixtures for UI/UX review, loading, timeout, stale snapshot, conflict, unavailable source, request supersession, ownership scopes and document failure states.

### Fresh FODE Snapshot Mode

Label:

```text
FODE SNAPSHOT MODE
CURRENT AS OF CAPTURE TIME
```

This mode loads an immutable local snapshot captured from authorised Admin staging read-only EduOps DTOs. It is not continuous live mode and must never be described as live data.

Snapshot metadata displayed in the Preview Lab:

- capture time;
- runtime identity;
- contract version;
- snapshot ID;
- reliability status;
- stale-age warning when beyond the review threshold.

If a snapshot is incompatible, the Preview Lab shows:

```text
Snapshot incompatible with this EduOps build.
Capture a new FODE snapshot or select a compatible deterministic scenario.
```

## Scenarios

The control strip includes deterministic scenarios:

- Normal authoritative
- Slow request - 6 seconds
- Timeout - over 10 seconds
- Stale snapshot
- Conflicting authority
- Source unavailable
- Empty Escalated scope
- Pinned ownership scope
- Unpinned ownership scope
- Rapid supersession
- Document PNG available
- Document preview unavailable
- Invalid cross-applicant document context
- Contactability failure
- Large workload

Exact fixtures:

- Jackson Numa / `FODE-26-002985`
- Keziah Waffi / `FODE-26-002959`
- TEST_COMM_D Payment Verified / `FODE-26-TEST-004`

## Fixture Policy

Normal startup never captures live data.

Fixtures are deterministic and sanitised:

- no Sheet writes;
- no Drive writes;
- no live signed URLs;
- no access tokens;
- no Gmail, WhatsApp, Books or Portal calls;
- synthetic email and phone values;
- local simulated PNG rendition only.

See `fixtures/SANITISATION_REPORT.md`.

## Fresh Snapshot Capture

Run only when an authorised staging snapshot is deliberately required:

```bat
CAPTURE_FRESH_FODE_SNAPSHOT.cmd
```

Optional environment:

```bat
set EDUOPS_CAPTURE_URL=https://script.google.com/macros/s/<admin-staging-deployment>/exec?view=eduops
set EDUOPS_EXPECTED_RUNTIME=r352
set EDUOPS_EXPECTED_DEPLOY=352
set FODE_ADMIN_STORAGE_STATE=F:\Playwright\fode-secure-link-diagnostic\auth\admin-storage-state.json
```

Capture command allowlist:

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

Fail-closed checks:

- runtime identity mismatch;
- incompatible contract version;
- unauthorised access;
- unsafe source reliability;
- reconciliation or parity failure;
- missing exact fixture applicants;
- duplicate ApplicantID;
- sanitisation failure.

Local storage:

```text
local-snapshots/<capture-id>/snapshot.json
local-snapshots/<capture-id>/SANITISATION_REPORT.json
```

`local-snapshots/` is ignored by Git. Fresh snapshots must not be committed unless explicitly approved.

Snapshot metadata schema:

```json
{
  "snapshotFormatVersion": "EDUOPS_PREVIEW_SNAPSHOT_V1",
  "contractVersion": "EDUOPS_SHADOW_V1",
  "runtimeIdentity": "r352 / 352",
  "sourceCommit": "...",
  "sourceDeploymentVersion": "...",
  "capturedAt": "...",
  "sourceAsOf": "...",
  "sourceReliability": "AUTHORITATIVE",
  "sanitisationVersion": "EDUOPS_PREVIEW_SANITISER_V1"
}
```

## Owner Review Guide

Suggested manual checks:

1. Open Ready Now.
2. Switch Actionability with unpinned scope.
3. Pin Escalated and switch states.
4. Test six-second loading.
5. Rapidly switch three states.
6. Trigger timeout and retry.
7. Search Jackson.
8. Open Waffi Workbench.
9. Inspect document PNG and Open Original representation.
10. Use Browser Back.
11. Open domain lenses.
12. Trigger stale/conflicting authority scenarios.

Owner notes can be saved locally from the Preview Lab panel. Output is written to:

```text
review-output/OWNER_REVIEW_RESULTS.json
```

## Tests

Run:

```bat
RUN_EDUOPS_PREVIEW_TESTS.cmd
```

Equivalent Node commands:

```bat
node tests\preview-contract.test.js
node tests\preview-lab.browser.test.js
node capture-evidence.js
```

Headed review helper:

```bat
OPEN_EDUOPS_PLAYWRIGHT_UI.cmd
```

## Evidence

Evidence is immutable per run:

```text
evidence/<timestamp>/RUN_SUMMARY.json
evidence/<timestamp>/<viewport>/*.png
```

Captured viewports:

- 1920x1080
- 1440x900
- 1366x768

## Navigation And Diagnostics Corrections

Actionability navigation now has one primary control set in the left rail. The horizontal row is a non-interactive count summary.

Raw parity diagnostics moved out of normal rail navigation and into a technical authority diagnostics disclosure.

## Limitations

The Preview Lab validates UI, workflow and request-state behaviour. Deterministic scenarios are not current FODE data. Fresh snapshots are accurate only as current as of capture time. The lab does not prove continuous live authority, live integration performance, live Drive access, live authentication, or production data state. Admin staging remains reserved for authority, integration and performance acceptance.

## Preventing Drift

The Preview Lab renders runtime source at request time. Do not manually copy `EduOps_Client.html` into the preview package. If runtime source changes, rerun the Preview Lab tests and evidence capture.

Accepted UI corrections should return to runtime source first, then be observed through this Preview Lab before staging release work resumes.
