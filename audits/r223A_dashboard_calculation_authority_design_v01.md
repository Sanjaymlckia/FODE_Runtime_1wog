# r223A Dashboard Calculation Authority Design v01

## Executive Summary

This design audit confirms that the remaining dashboard confusion is no longer mainly a wording problem. It is a calculation-authority problem.

Three distinct issues remain:

1. `Open Legacy Pipeline Rows` is currently a broad non-terminal legacy pipeline count, not a focused operational workload metric.
2. `Row-Logged Communications Today` merges row-log timestamps into a single daily activity figure that is easy to confuse with true send counts.
3. `Legacy Pipeline Summary` and `Workload & Action Required Drill-Down` are generated from different calculation models and therefore diverge by design.

Recommended direction for a future `r223B`:

- Do not attempt a broad metric rewrite.
- Prefer one small calculation authority change at a time.
- Highest-value candidate is `Open Legacy Pipeline Rows`, because it is currently the least operationally trustworthy high-visibility number.

## Target 1: Open Legacy Pipeline Rows

### Current Calculation Mapping

UI label/render path:

- Label rendered in [AdminUI.html](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:1688)
- Value filled by `renderOperationalDashboardMetrics_()` in [AdminUI.html](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:8547)
- Source value:
  - `data.pendingIntakeReview`

Backend path:

- `admin_getOperationalDashboardMetrics()` in [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:3486)
- `buildOperationalDashboardMetrics_()` in [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:3410)
- increment rule in [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:3469)
  - `if (pipeline !== "Enrolled" && pipeline !== "Closed Lost") out.pendingIntakeReview++;`

Pipeline derivation path:

- `deriveOperationalPipelineStage_()` in [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:3361)

### Sheet Fields / Inputs

Primary legacy/stored stage fields:

- `Pipeline_Stage`
- `Operational_Stage`
- `CRM_Stage`
- `Stage`

Fallback classification fields:

- `Portal_Submitted`
- `Docs_Verified`
- `Payment_Verified`
- `Registration_Complete`
- `Fee_Receipt_File`
- `Email_Status`
- `Last_Contact_Result`

### What It Actually Counts

It counts all applicant rows that are not classified into legacy `Enrolled` or `Closed Lost`.

That means it is effectively:

- a broad open/non-terminal legacy pipeline population
- not an intake review queue
- not a lifecycle-derived action queue
- not a sendable cohort

### Risks of Changing This Calculation

- Existing operator mental model may still expect a broad “everything not finished” number.
- If replaced too aggressively, the dashboard may lose a coarse top-line population indicator.
- If tied to `admin_getStageAggregation()` totals, the metric would inherit lifecycle/actionability semantics and stop being comparable to older legacy dashboard use.

### Design Options

#### Option A: Keep current calculation

Pros:

- zero behavior change
- preserves coarse open-pipeline count

Cons:

- remains high-confusion
- weak operational authority

#### Option B: Replace with queue-backed workload count

Candidate basis:

- use review queue totals from `admin_getReviewQueues()` / `normalizeReviewQueueData_()` / queue counts

Pros:

- closer to operator workload
- easier to explain operationally

Cons:

- becomes loaded queue / queue-contract dependent
- may still not represent full population truth

#### Option C: Replace with lifecycle-derived non-terminal count

Candidate basis:

- use `admin_getStageAggregation()` totals across all non-terminal lifecycle stages

Pros:

- closer to current lifecycle authority
- more consistent with drill-down

Cons:

- effectively merges this metric into the drill-down authority
- loses legacy pipeline continuity

#### Option D: Deprecate/remove the metric

Pros:

- removes a misleading number entirely

Cons:

- loses a coarse dashboard summary signal

### Recommendation

Preferred design: **Option C or Option D**

Rationale:

- If the metric stays prominent, it should be lifecycle-derived and explainable.
- If the team wants to preserve legacy-vs-lifecycle separation, then removal is cleaner than keeping a misleading pseudo-queue.

## Target 2: Row-Logged Communications Today

### Current Calculation Mapping

UI label/render path:

- Label rendered in [AdminUI.html](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:1714)
- Value filled by `renderOperationalDashboardMetrics_()` in [AdminUI.html](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:8555)

Backend path:

- `admin_getOperationalDashboardMetrics()` in [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:3486)
- `buildOperationalDashboardMetrics_()` in [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:3410)
- increment rule in [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:3458)
  - `if (isSameLocalDate_(rowObj.Email_Last_Sent_At || rowObj.Last_Contacted_At || "", now)) out.emailSentToday++;`

Related runtime/system counter:

- `Automation Daily Send Count` rendered from `admin_getOperationalSafetyStatus()` in [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:5539)
- derived as `automation.dailySendCount` in [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:5619)

### Sheet Fields / Inputs

Current row-log metric:

- `Email_Last_Sent_At`
- `Last_Contacted_At`

Related but separate runtime/send counter:

- `triggerStatus.sentToday`
- `lastRun.dailyUsedAfter`

### What It Actually Counts

It counts rows whose communication-related timestamp field is today, using:

- `Email_Last_Sent_At` if present
- otherwise `Last_Contacted_At`

It does **not** guarantee:

- actual emails sent today
- only automated sends
- only manual sends
- one count per send event

It is a row-log daily activity signal, not a transport-verified send metric.

### Risks of Changing This Calculation

- If split incorrectly, operators may interpret all resulting numbers as exact send truth.
- If changed to runtime-only send counts, it loses usefulness as a row activity signal.
- If joined to automation counters, different authorities get mixed again.

### Design Options

#### Option A: Keep one row-log metric

Pros:

- cheap and simple

Cons:

- ambiguity remains

#### Option B: Split into three metrics

Suggested split:

1. `Row Activity Logged Today`
2. `Rows With Email Sent Today`
3. `Automation Sends Today`

Pros:

- clean authority separation
- preserves row activity and runtime send truth separately

Cons:

- more dashboard space
- requires careful definitions

#### Option C: Split into two metrics only

Suggested split:

1. `Row Activity Logged Today`
2. `Automation Sends Today`

Pros:

- lower UI cost
- easier operator interpretation

Cons:

- still hides distinction between email send vs broader row contact logging inside the row-log metric

#### Option D: Move runtime send truth entirely to System Health and keep only row-log activity in the main dashboard

Pros:

- minimal disruption
- preserves conceptual separation

Cons:

- operators still have to mentally compare two sections

### Recommendation

Preferred design: **Option B**

Rationale:

- This is the cleanest authority separation.
- It gives one row-activity metric and one true runtime send metric, with optional email-send-timestamp row metric if desired.
- If screen space is limited, fallback to **Option C**.

## Target 3: Legacy Pipeline Summary vs Workload & Action Required Drill-Down

### Current Calculation Mapping

Legacy pipeline summary path:

- `admin_getOperationalDashboardMetrics()` in [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:3486)
- `buildOperationalDashboardMetrics_()` in [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:3410)
- `pipelineCounts[...]` fed by `deriveOperationalPipelineStage_()` in [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:3361)
- rendered in `renderOperationalDashboardMetrics_()` at [AdminUI.html](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:8547)

Workload drill-down path:

- `admin_getStageAggregation()` in [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:4003)
- `stageAggregationSnapshot_()` in [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:3756)
- `deriveApplicantLifecycleStage_()`
- `deriveApplicantActionability_(..., { resolveEligibility: false })`
- rendered by `loadStageDashboard()` / `renderStageDashboard_()` in [AdminUI.html](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:6530) and [AdminUI.html](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:6505)

### Why They Diverge

They diverge because they are intendedly built from different authority models:

- legacy pipeline summary:
  - uses stored/legacy pipeline labels plus fallback heuristics
- drill-down:
  - uses lifecycle derivation plus lightweight operator-actionability

This is not a bug in one function alone. It is an architectural split:

- legacy operational grouping
- lifecycle/actionability grouping

### Risks of Changing This Relationship

- Forcing parity may erase useful legacy operational views before operators are ready.
- Recalculating legacy pipeline purely from lifecycle authority may effectively remove the point of keeping the legacy summary.
- Keeping both without stronger structure continues to create confusion.

### Design Options

#### Option A: Keep both, with stronger visual separation only

Pros:

- low risk
- preserves legacy behavior

Cons:

- confusion reduced but not solved

#### Option B: Recalculate legacy summary from lifecycle authority

Pros:

- removes divergence

Cons:

- legacy summary stops being legacy
- effectively duplicates drill-down with different names

#### Option C: Demote legacy summary to a secondary/diagnostic section

Pros:

- preserves legacy visibility
- promotes lifecycle/actionability as primary operator truth

Cons:

- layout change
- still leaves dual models in the page

#### Option D: Replace legacy summary with a lifecycle summary

Pros:

- one authority model for dashboard and drill-down

Cons:

- highest change impact
- likely no longer a small Track L/medium-risk patch

### Recommendation

Preferred design: **Option C**

Rationale:

- The drill-down is closer to current operator actionability.
- The legacy summary can survive as secondary context without claiming equal authority.
- This avoids pretending the two models mean the same thing.

## Risk Assessment by Target

| Target | Change Risk | Main Risk |
|---|---|---|
| Open Legacy Pipeline Rows | Medium | replacing a familiar but weak number with a more authoritative metric changes operator expectation |
| Row-Logged Communications Today | Low-Medium | operators may misread split counters without tight wording |
| Legacy Pipeline Summary vs Drill-Down | Medium | structural change can alter how operators scan the dashboard |

## Recommended r223B Scope

Recommended next patch scope:

### Preferred r223B

1. Replace or deprecate `Open Legacy Pipeline Rows`
2. Split `Row-Logged Communications Today` into clearer authority-separated metrics

Do **not** try to fully reconcile legacy pipeline summary vs drill-down in the same patch.

### Why this sequence

- It addresses the two highest-confusion top-level metrics first.
- It avoids mixing:
  - metric rewrite
  - structural demotion of legacy pipeline
  - drill-down redesign

### Recommended file scope for future r223B

- likely `Admin.js`
- likely `AdminUI.html`

But only for the two selected targets above.

## Pros / Cons Summary

| Area | Best Design Direction | Pros | Cons |
|---|---|---|---|
| Open Legacy Pipeline Rows | Replace with lifecycle-derived non-terminal count or remove | clearer authority | changes familiar summary meaning |
| Row-Logged Communications Today | Split row activity vs runtime send truth | strongest clarity | adds metrics |
| Legacy Pipeline vs Drill-Down | Demote legacy summary | preserves context while making authority clearer | requires layout/section hierarchy change |

## Explicit No-Change Confirmation

- No runtime code was changed under this CIS.
- No deployment was performed.
- No Apps Script version was created.
- No staging repin was performed.
- No send was performed.
- No schema/header change was made.
- No OPS or Student files were modified.

