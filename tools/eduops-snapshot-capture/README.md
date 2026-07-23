# EduOps Preview Lab

Status: local owner review harness for the consolidated EduOps Pass 2 reconstruction.

This package runs the actual EduOps client interface locally with either deterministic scenario data or a locally captured Fresh FODE snapshot. The directory name reflects its durable purpose: snapshot capture and runtime-surface evidence generation.

```text
EduOps.html / EduOps_Styles.html / modular EduOps_Client*.html
  -> shared runtime client
  -> transport boundary
     -> Apps Script transport in Admin staging
     -> Preview transport in this local lab
```

The Preview Lab is not a release helper and not a live data tool. Guarded operation outcomes are local simulations only.

## Start

Run:

```bat
START_EDUOPS_PREVIEW.cmd
```

The owner command refuses an occupied port, launches the existing Preview server in detached mode, and polls `http://127.0.0.1:4173/health` for bounded application, shared-client and transport readiness. It opens the browser only after readiness passes and exits nonzero with the server error when startup fails.

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

The stop script first terminates the PID written by the Preview Lab server and verifies that port 4173 is closed. If the PID file is stale, it may stop only a Node process whose command line identifies this Preview server; an unrelated listener fails closed.

## Architecture

The server renders the live runtime template directly from repository source:

- `EduOps.html`
- `EduOps_Styles.html`
- `EduOps_ClientCore.html`
- `EduOps_ClientComponents.html`
- `EduOps_ClientWorkbench.html`
- `EduOps_ClientBatch.html`
- `EduOps_Client.html`

The server replaces Apps Script template includes locally and injects:

- `server/preview-lab.css`
- `server/preview-transport.js`

The runtime client uses `window.EDUOPS_TRANSPORT` when present. Without that object, it uses the existing `google.script.run` Apps Script transport.

`GET /health` reports the server timestamp, exact runtime client files and hash, Preview transport hash, served bundle hash, and transport/scenario/request-state versions. The Preview server reads the runtime client partials directly for every render; there is no copied or generated Preview client.

## Transport Interface

Preview transport implements the closed EduOps RPC contract. Read calls are:

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
- `eduops_getOperationHistory`
- `eduops_previewCommand`

The only simulated write call is:

- `eduops_executeCommand`

It writes only to in-memory Preview state. It cannot reach Apps Script, Sheets, Drive, Gmail, WhatsApp, Books, Portal or an external API.

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
- Successful document review
- Rejected document
- Correction request
- Dirty document state
- Contact correction
- Communication preview
- Communication send receipt
- Cooling-off denial
- Contactability failure
- Duplicate send replay
- Finance verification
- Finance rejection unavailable
- Books approval blocked
- Portal resend
- Portal reset approval blocked
- Large workload
- Expired command preview
- Stale command preview
- Capability denied
- Feature flag disabled
- Operation lock conflict
- Partial batch failure
- Successful batch
- Batch cap exceeded
- Batch exception handoff
- Work Session progress
- Idempotent replay
- Altered replay payload
- Product state isolation

FODE, KIA and MLC have independent deterministic Preview snapshots. FODE is the only runtime adapter; KIA and MLC remain Preview-only.

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
set FODE_PLAYWRIGHT_AUTH_PROFILE_DIR=%LOCALAPPDATA%\FODE_Playwright\admin-staging-profile
```

Authenticate the dedicated Playwright profile once with:

```bat
tools\AUTH_FODE_ADMIN_PLAYWRIGHT.cmd
```

If the dedicated profile has expired or is missing, the browser tools fail closed with:

```text
AUTH_REQUIRED
```

and print the dedicated profile path that must be reauthenticated.

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
evidence/generated/snapshots/<capture-id>/snapshot.json
evidence/generated/snapshots/<capture-id>/SANITISATION_REPORT.json
```

`evidence/generated/` is ignored by Git. Fresh snapshots must not be committed unless explicitly approved.

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
12. Run a successful document review and correction-request handoff.
13. Preview and confirm an individual communication, then verify duplicate replay.
14. Verify Finance rejection, Books and unapproved Portal reset remain blocked.
15. Run successful, partial-failure and cap-exceeded Batch scenarios.
16. Confirm Work Session identity and batch exception handoff.
17. Trigger stale, expired, capability, lock and conflicting-authority failures.

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
node tests\eduops-preview-clean-start.browser.test.js
node capture-evidence.js
```

Headed review helper:

```bat
OPEN_EDUOPS_PLAYWRIGHT_UI.cmd
```

## Evidence

Generated evidence is immutable per run:

```text
evidence/generated/<timestamp>/RUN_SUMMARY.json
evidence/generated/<timestamp>/<viewport>/*.png
```

Captured viewports:

- 1920x1080
- 1440x900
- 1366x768

## Navigation And Diagnostics Corrections

Actionability navigation now has one primary control set in the left rail. The horizontal row is a non-interactive count summary.

Raw parity diagnostics moved out of normal rail navigation and into a technical authority diagnostics disclosure.

## Owner-Review Recovery Contract

Every rendered control receives a stable identifier and exactly one classification: Navigation, Operation, Structural, Unavailable or Technical. Async operations expose activated/loading and terminal success, blocked or error feedback through the shared live status region. Repeated clicks are suppressed while a request is pending.

The Preview Lab launcher is subordinate in the rail footer. Its technical drawer starts closed and is the only location for scenario, latency, viewport and diagnostics controls. Global-search results are dismissed after either Open Workbench or Open worklist so they cannot intercept later product controls.

Read-only supporting modules now return meaningful simulated projections for Lifecycle, Management Summary, Reports, Audit and System Health. Roles and Capabilities, Assignments and Approvals, and Data Quality are explicitly Structural and expose no operational action. Books remains Unavailable.

Recovery validation adds `tests/owner-proxy-acceptance.browser.test.js`. It uses visible UI only and records a headed trace, video, before/after screenshots, browser errors, failed requests and a stable-control coverage report. Shared row-component instances are linked to a directly exercised representative contract rather than counted as separate behaviours.

The prior 31-behaviour suite did not click rail collapse, advanced filters, Batch step navigation or structural/supporting modules, and it exercised only successful Preview RPC scenarios. Screenshot existence and zero console errors therefore did not prove visible control response. The owner-proxy run closes that methodological gap by asserting visible terminal state after each journey.

## Clean-Start Recovery Contract

The owner-observed stalled shell resulted from three combined gaps:

- the launcher used a fixed delay and could report success against an already-running server without proving the served build;
- Preview scenario, mode and latency settings persisted in `localStorage`, allowing a prior technical scenario to contaminate a later ordinary browser start;
- client startup had no explicit observable state machine, bounded phase timeout or terminal bootstrap error rendering.

The corrected startup sequence is:

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

Technical Preview settings are now session-scoped. Workload-dependent controls are truthfully disabled before `INTERACTIVE`; source refresh and safe navigation remain available. Source, workload and timeout failures clear stale loading text, preserve the exact error and expose visible retry actions.

`tests/eduops-preview-clean-start.browser.test.js` starts and stops the lab only through the owner commands. It performs three independent starts with a new browser process and empty storage, disables cache, verifies `/health` and source hashes, asserts loading labels disappear, exercises the required visible controls, records traces/videos/screenshots, proves zero unresolved requests, and confirms a duplicate start fails closed while port 4173 is occupied.

## Limitations

The Preview Lab validates UI, workflow, guarded-command and request-state behaviour. Deterministic scenarios are not current FODE data. Fresh snapshots are accurate only as current as of capture time and remain read-only; command scenarios use deterministic data only. The lab does not prove continuous live authority, live integration performance, live Drive access, live authentication, or production data state. Admin staging remains reserved for authority, integration and performance acceptance.

All runtime mutation flags remain off before owner acceptance. KIA and MLC are Preview-only. Finance rejection and phone correction are unavailable without proven authorities. Books has no runtime dispatch. Existing live batch authority exposes aggregate results, so live batch enablement remains blocked until exact per-applicant outcomes can be proven.

## Preventing Drift

The Preview Lab renders runtime source at request time. Do not manually copy `EduOps_Client.html` into the preview package. If runtime source changes, rerun the Preview Lab tests and evidence capture.

Accepted UI corrections should return to runtime source first, then be observed through this Preview Lab before staging release work resumes.
