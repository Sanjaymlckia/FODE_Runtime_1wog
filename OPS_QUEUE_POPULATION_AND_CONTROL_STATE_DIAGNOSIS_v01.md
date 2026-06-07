# OPS Queue Population and Control-State Diagnosis v01

Classification: Read-Only Runtime Diagnosis  
Runtime under review: r214 / 214 staging  
Decision context: Production NO-GO; ACP Phase 2 NO-GO until root cause is reviewed.

## Executive Finding

Aggregate dashboard counts and operational queue rows are produced by different runtime paths.

The dashboard aggregate path is working and reports broad full-sheet counts. The operational queue backend also returns populated queue rows when called directly. The visible empty OPS queues are therefore not caused by missing applicant data or an empty backend queue result.

Root cause category:

**Client-side OPS queue population / data binding failure.**

The normal OPS page load leaves `queueDataState` empty even though `admin_getReviewQueues()` returns populated `fdReceived` and `docs` rows. Since Review Queues, OPS Applicant Queue, OPS Lifecycle, and OPS Communications all read from `queueDataState`, the whole OPS operational surface appears empty and many controls appear non-functional.

## Evidence

### 1. Dashboard Aggregate Counts

Files and functions:

- `Admin.js`
- `buildOperationalDashboardMetrics_()`
- `admin_getOperationalDashboardMetrics(payload)`
- `isQueueCandidateRow_(rowObj)`

Behavior:

- Opens the full data sheet with `openDataSheet_()`.
- Reads all rows through `sheet.getDataRange().getValues()`.
- Counts all rows with `ApplicantID`.
- Counts `pendingIntakeReview` when pipeline is not `Enrolled` or `Closed Lost`.
- Counts `queueBacklog` when `isQueueCandidateRow_(rowObj)` is true.

Relevant queue candidate rule:

- ApplicantID exists, and one of:
  - external FD intake marker exists
  - `Portal_Submitted` is present and not `No`
  - `Docs_Verified === "Yes"`
  - `Payment_Verified === "Yes"`

Live runtime evidence from direct read-only RPC:

- `scannedRows`: 172
- `pendingIntakeReview`: 172
- `queueBacklog`: 133
- `docsPending`: 12
- `paymentPending`: 2

Conclusion:

Dashboard counts are broad full-sheet aggregate counts. They are not proof that loaded OPS queue arrays are populated in the browser.

### 2. Operational Queue Backend

Files and functions:

- `Admin.js`
- `admin_getReviewQueues(payload)`
- `sliceQueueByOffset_(rows, offset, limit)`

Queue buckets produced:

- `fdReceived`
- `docs`
- `awaitingPayment`
- `payments`
- `anomalies`
- `paidApproved`
- `postPaymentIssues`

Core classification rules:

- `fdReceived`: external FD intake, not portal submitted, not docs verified, not payment verified
- `docs`: portal submitted and not docs verified
- `awaitingPayment`: docs verified, not payment verified, no payment evidence
- `payments`: docs verified, not payment verified, payment evidence present
- `anomalies`: payment verified and not docs verified
- `paidApproved`: payment verified

Live runtime evidence from direct read-only RPC:

- `fdReceived` count: 119
- `docs` count: 14
- `awaitingPayment` count: 0
- `payments` count: 0
- `anomalies` count: 0
- `paidApproved` count: 0
- `postPaymentIssues` count: 0
- first page returned `fdReceived`: 20 rows
- first page returned `docs`: 14 rows
- `hasMore`: true
- sample ApplicantIDs included `FODE-26-003082`, `FODE-26-003081`, `FODE-26-003080`, `FODE-26-003020`, `FODE-26-002965`, `FODE-26-003021`

Conclusion:

The operational queue backend is not empty. The backend produces the same 133-row backlog shape implied by the dashboard: 119 FD received + 14 docs = 133.

### 3. OPS Client Load and Binding Path

Files and functions:

- `AdminUI.html`
- `queueDataState`
- `loadReviewQueues(opts)`
- `renderReviewQueues(data, opts)`
- `renderOpsQueue_()`

Startup calls:

- `DOMContentLoaded` calls `loadStageDashboard()`
- `DOMContentLoaded` calls `loadReviewQueues()`
- `loadReviewQueues()` calls `admin_getReviewQueues({ offset, limit, force })`
- success handler assigns returned arrays to `queueDataState`
- `renderReviewQueues(queueDataState)` renders legacy Review Queue sections
- `renderReviewQueues()` calls `renderOpsQueue_()`

Normal loaded browser state observed before direct manual RPC:

- `queueDataState.fdReceived.length`: 0
- `queueDataState.docs.length`: 0
- `queueDataState.awaitingPayment.length`: 0
- `queueDataState.payments.length`: 0
- `queueDataState.anomalies.length`: 0
- `queueDataState.paidApproved.length`: 0
- `opsAllQueueRows_().length`: 0

Conclusion:

The browser did not retain or render the populated queue result during normal OPS load. The direct RPC proves the server can produce data, so the fault is in client-side load completion, response handling, render timing, cache use, or data binding around `loadReviewQueues()`.

### 4. Shared OPS Row Dependency

Files and functions:

- `AdminUI_OpsApplicantQueue.html`
- `opsAllQueueRows_()`
- `opsQueueRowByApplicantId_(applicantId)`
- `opsApplicantContextRow_()`

Shared dependency:

`opsAllQueueRows_()` concatenates only:

- `queueDataState.fdReceived`
- `queueDataState.docs`
- `queueDataState.awaitingPayment`
- `queueDataState.payments`
- `queueDataState.anomalies`
- `queueDataState.paidApproved`

Consumers:

- Review Queues: `renderReviewQueues()`
- OPS Applicant Queue: `renderOpsQueue_()`
- OPS Lifecycle: `opsRowsForLifecycleStage_(stageKey)`
- OPS Communications: `opsCommunicationQueueRows_(def)`
- Selected applicant context: `opsQueueRowByApplicantId_()` and `opsApplicantContextRow_()`

Conclusion:

Once `queueDataState` remains empty, every OPS operational surface that depends on loaded rows becomes empty or degraded.

## Diagnostic Answers

### Which functions generate dashboard aggregate counts?

- `Admin.js:buildOperationalDashboardMetrics_()`
- `Admin.js:admin_getOperationalDashboardMetrics(payload)`
- Supporting classifier: `Admin.js:isQueueCandidateRow_(rowObj)`

These functions scan the full data sheet and produce broad aggregate counts.

### Which functions populate Review Queues, OPS Applicant Queue, and OPS Communications rows?

Backend producer:

- `Admin.js:admin_getReviewQueues(payload)`

Client loader and renderer:

- `AdminUI.html:loadReviewQueues(opts)`
- `AdminUI.html:renderReviewQueues(data, opts)`
- `AdminUI.html:renderOpsQueue_()`

Shared row source:

- `AdminUI_OpsApplicantQueue.html:opsAllQueueRows_()`

Downstream consumers:

- `AdminUI_OpsApplicantQueue.html:opsQueueRowByApplicantId_(applicantId)`
- `AdminUI_OpsLifecycle.html:opsRowsForLifecycleStage_(stageKey)`
- `AdminUI_OpsCommunications.html:opsCommunicationQueueRows_(def)`

### Why do aggregate counts show records while operational queues return none?

They do not return none at the backend.

Runtime evidence shows:

- Dashboard aggregate RPC returns `queueBacklog = 133`.
- Review queue RPC returns `fdReceived = 119` and `docs = 14`.
- Browser `queueDataState` remains empty after normal OPS page load.

The mismatch is between backend queue results and client-side loaded queue state, not between the sheet and the backend queue classifier.

### Are rows being filtered, paged, stripped from payload, or never requested?

Evidence status:

- Not stripped from backend payload: direct RPC returned populated arrays and sample ApplicantIDs.
- Not filtered to zero by backend classification: direct RPC returned 133 queue candidates.
- Paged intentionally: backend first page returned 20 `fdReceived` rows and 14 `docs` rows, with `hasMore = true`.
- Client-side normal load outcome: rows are absent from `queueDataState`.

Most likely failure area:

`loadReviewQueues()` normal startup execution, success-handler execution, render timing, or client-side data binding.

The exact client subcause is not proven by read-only source inspection alone. It should be diagnosed next with a narrow browser console/event trace around `loadReviewQueues()` and `queueDataState`, or by adding temporary diagnostics only if separately authorized.

### Why do many controls appear non-functional?

Most controls depend on selected applicant context or loaded rows.

Examples:

- OPS Communications cohorts use `opsCommunicationQueueRows_()`, which reads `opsAllQueueRows_()`.
- Selected applicant actions use `opsApplicantContextRow_()`, which first tries `opsQueueRowByApplicantId_()`.
- OPS Lifecycle stage drill-down uses `opsRowsForLifecycleStage_()`, which reads `opsAllQueueRows_()`.
- Applicant Queue search, sort, filters, and local export operate on `opsAllQueueRows_()`.

When `queueDataState` is empty:

- no queue row can be selected from loaded OPS rows
- selected-applicant context remains empty unless separately loaded by direct applicant lookup
- communications cohorts show zero or no usable records
- lifecycle drill-down shows no loaded records
- controls correctly block, but the operator experiences them as inert or unclear

This is therefore a mixed issue:

- primary: queue population / data binding failure
- secondary: control state and messaging are insufficient when the loaded snapshot is empty

### Is this behavior new in r214 or pre-existing in r213?

Evidence is not sufficient to prove this as a new r214 functional regression.

Available evidence:

- Existing r213 browser evidence showed OPS route loading, but visible queue/state evidence also included zero loaded queues and no selected applicant.
- r214 direct backend RPC returns populated queue rows.
- r214 ACP changes did not modify `Admin.js` queue-generation logic.
- Current visible failure is in the client queue-load/binding path, not in the r214 communications row-facts backend.

Finding:

Likely pre-existing or latent in the OPS client load/binding model, now made more visible by r214 acceptance and operator review. A live r213 side-by-side rerun was not performed under this CIS, so the r213/r214 regression question remains not fully proven.

## Root Cause

Root cause identified:

**The OPS client relies on `queueDataState` as the single loaded-row source, but normal OPS page load leaves `queueDataState` empty even though `admin_getReviewQueues()` returns populated rows.**

Root cause location:

- `AdminUI.html:loadReviewQueues(opts)`
- `AdminUI.html:renderReviewQueues(data, opts)`
- `AdminUI.html:renderOpsQueue_()`
- `AdminUI_OpsApplicantQueue.html:opsAllQueueRows_()`

Non-root causes ruled out by evidence:

- The spreadsheet is not empty.
- Dashboard aggregate generation is not the reason queues are blank.
- `admin_getReviewQueues()` does not return an empty dataset when directly invoked.
- Backend queue classification does not reduce the current dataset to zero.
- ACP Phase 1 communications row-facts logic is not proven to be the cause.

## Risk Classification

High runtime usability risk:

- Operators cannot reliably see applicant rows in OPS.
- OPS communications cohorts depend on empty loaded state.
- Review Queues and Applicant Queue appear empty while dashboard counts show work exists.
- Controls may appear broken because their required row/applicant context is unavailable.

Authority risk:

- No new authority-owner promotion was found in this diagnosis.
- The immediate issue is operational visibility and client data binding, not lifecycle/payment/document authority mutation.

Deployment risk:

- Production remains NO-GO.
- ACP Phase 2 remains NO-GO.
- r214 technical acceptance is insufficient for operator acceptance until queue population is corrected or clearly bounded.

## Recommendations

Final recommendation:

- FIX QUEUE POPULATION / DATA BINDING
- FIX CONTROL STATE AND MESSAGING
- RESTORE / IMPROVE LEGACY REVIEW QUEUE VISIBILITY

Do not classify as `NO FUNCTIONAL DEFECT FOUND`.

Do not proceed to ACP Phase 2.

Do not deploy to production until the client-side queue population path is corrected and browser-verified with visible applicant rows.

## Stop Point

No source code was modified as part of this diagnosis.

No deployment was performed.

No Apps Script version was created.

No commit was made.

No sheet data was touched.
