# r222A Dashboard Metric Authority Audit v01

## Executive Summary

This audit confirms that the legacy Admin dashboard mixes at least three different authorities:

1. Legacy operational pipeline labels from `deriveOperationalPipelineStage_()`
2. Lifecycle/actionability drill-down data from `admin_getStageAggregation()`
3. Communication/runtime counters from row logs and automation status

The most misleading metrics are:

- `Open Pipeline Rows`
- `Unclassified / New To MLCKIA`
- `Communication Logged Today`
- legacy `Pipeline Counts` when visually compared with `Workload & Action Required Drill-Down`

The core problem is not a single bad formula. The problem is mixed authority presented as one coherent operator dashboard.

High-priority follow-up candidates:

1. Replace or relabel `Open Pipeline Rows`
2. Clarify or recalculate `Unclassified / New To MLCKIA`
3. Separate row-log communication activity from automation send counters
4. Make drill-down lifecycle counts visibly distinct from legacy pipeline counts

## Metric Mapping Table

| Metric | Current UI Label | Current Displayed Value | Source Function / Path | UI Render Path | Sheet Fields Used | What It Actually Counts | Authority Type | Interpretation Risk | Label Accuracy | Recommended Action |
|---|---|---:|---|---|---|---|---|---|---|---|
| Open Pipeline Rows | `Open Pipeline Rows` | around `193` from operator/CIS context | `admin_getOperationalDashboardMetrics()` -> `buildOperationalDashboardMetrics_()` -> `out.pendingIntakeReview++` when `pipeline !== "Enrolled" && pipeline !== "Closed Lost"` | `fetchOperationalDashboardMetrics_()` -> `renderOperationalDashboardMetrics_()` -> `opsPendingReview` in [AdminUI.html](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:1688) | `Pipeline_Stage`, `Operational_Stage`, `CRM_Stage`, `Stage`, fallback derivation fields `Portal_Submitted`, `Docs_Verified`, `Payment_Verified`, `Registration_Complete`, `Fee_Receipt_File`, `Email_Status`, `Last_Contact_Result` | All rows that are not classified into legacy pipeline `Enrolled` or `Closed Lost` | Mixed legacy pipeline backlog | High | Misleading | Rename label or change calculation |
| Unclassified / New To MLCKIA | `Unclassified / New To MLCKIA` | around `8` from operator/CIS context | `admin_getOperationalDashboardMetrics()` -> `buildOperationalDashboardMetrics_()` -> `pipelineCounts["New To MLCKIA"]` -> `deriveOperationalPipelineStage_()` | `fetchOperationalDashboardMetrics_()` -> `renderOperationalDashboardMetrics_()` -> `pipeNewToMlckia` in [AdminUI.html](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:1696) | `Pipeline_Stage`, `Operational_Stage`, `CRM_Stage`, `Stage`, fallback derivation fields `Portal_Submitted`, `Docs_Verified`, `Payment_Verified`, `Registration_Complete`, `Fee_Receipt_File`, `Email_Status`, `Last_Contact_Result` | Rows that have neither explicit legacy stage nor fallback signals for contacted/docs/payment/enrolled/closed-lost | Legacy operational pipeline | High | Partly misleading | Rename label and add clarification |
| Communication Logged Today | `Communication Logged Today` | not independently verified in this audit run | `admin_getOperationalDashboardMetrics()` -> `buildOperationalDashboardMetrics_()` -> `out.emailSentToday++` when `isSameLocalDate_(Email_Last_Sent_At || Last_Contacted_At, now)` | `fetchOperationalDashboardMetrics_()` -> `renderOperationalDashboardMetrics_()` -> `opsEmailSentToday` in [AdminUI.html](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:1714) | `Email_Last_Sent_At`, `Last_Contacted_At` | Rows with a same-day timestamp in either email-last-sent or last-contacted fields | Row-log communication activity | High | Misleading if read as true send count | Rename label or add explicit explanation |
| Automation Daily Send Count | `Automation Daily Send Count` | not independently verified in this audit run | `admin_getOperationalSafetyStatus()` -> `automation.dailySendCount = triggerStatus.sentToday || lastRun.dailyUsedAfter || 0` | `fetchOperationalSafetyStatus_()` -> `renderOperationalSafetyStatus_()` -> `opsDailySendCount` in [AdminUI.html](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:1754) | Trigger/runtime state, not applicant-row fields | Runtime automation send counter, not row-log communication activity | Runtime/system health | Medium | Accurate if read in System Health only | Keep label; keep separated from row-log metrics |
| Pipeline Counts | `New To MLCKIA`, `Contacted`, `Documents Pending`, `Payment Pending`, `Enrolled`, `Closed Lost` | not independently verified in this audit run | `admin_getOperationalDashboardMetrics()` -> `buildOperationalDashboardMetrics_()` -> `pipelineCounts[...]` -> `deriveOperationalPipelineStage_()` | `renderOperationalDashboardMetrics_()` -> `pipe*` values in [AdminUI.html](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:1696), [AdminUI.html](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:1707) | Same legacy pipeline/fallback fields as above | Legacy operational grouping based on stored pipeline-like fields plus fallback heuristics | Legacy pipeline state | High when compared with drill-down | Accurate only as legacy pipeline summary | Keep only if explicitly framed as legacy pipeline |
| Workload & Action Required Drill-Down | stage cards with `total / review queue visible / blocked` | not independently verified in this audit run | `admin_getStageAggregation()` -> `stageAggregationSnapshot_()` -> `deriveApplicantLifecycleStage_()` + `deriveApplicantActionability_(..., { resolveEligibility: false })` | `loadStageDashboard()` -> `renderStageDashboard_()` -> `stageDashboardCards` in [AdminUI.html](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:1825) and [AdminUI.html](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:6505) | Lifecycle fields from `deriveApplicantLifecycleStage_()` plus communication/actionability fields from `deriveApplicantActionability_()` such as effective email, contact status, next action date | Lifecycle-derived workload counts with lightweight operator-actionability, not batch-mail eligibility | Lifecycle + operator workload | High when visually compared against legacy pipeline counts | Accurate only with current caveat text | Keep but visually separate from legacy pipeline counts |

## Source Function Map

### Legacy Admin dashboard metrics

- `admin_getOperationalDashboardMetrics()` at [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:3486)
- `buildOperationalDashboardMetrics_()` at [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:3410)
- `deriveOperationalPipelineStage_()` at [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:3361)
- `isQueueCandidateRow_()` at [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:3313)

### Drill-down stage cards

- `admin_getStageAggregation()` at [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:4004)
- `stageAggregationSnapshot_()` at [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:3756)
- `deriveApplicantLifecycleStage_()` in `Admin.js`
- `deriveApplicantActionability_(..., { resolveEligibility: false })` in `Admin.js`

### Communication/runtime counters

- `admin_getOperationalSafetyStatus()` at [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:5539)
- `automation.dailySendCount` derived in [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js:5612)

### UI render paths

- `fetchOperationalDashboardMetrics_()` / `renderOperationalDashboardMetrics_()` at [AdminUI.html](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:8546)
- `fetchOperationalSafetyStatus_()` / `renderOperationalSafetyStatus_()` at [AdminUI.html](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:8586)
- `loadStageDashboard()` / `renderStageDashboard_()` at [AdminUI.html](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html:6505)

## Sheet-Field Dependency Map

### Open Pipeline Rows

Primary fields:

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

### Unclassified / New To MLCKIA

Primary fields:

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

### Communication Logged Today

- `Email_Last_Sent_At`
- `Last_Contacted_At`

### Automation Daily Send Count

Not row-field based. Derived from runtime/trigger inspection state:

- `triggerStatus.sentToday`
- `lastRun.dailyUsedAfter`

### Pipeline Counts vs Drill-Down

Legacy pipeline counts use:

- `Pipeline_Stage`
- `Operational_Stage`
- `CRM_Stage`
- `Stage`
- fallback operational pipeline heuristics

Drill-down uses:

- lifecycle derivation from `deriveApplicantLifecycleStage_()`
- actionability derivation from `deriveApplicantActionability_(..., { resolveEligibility: false })`
- communication-related fields including effective email validity and contact timing

## Detailed Findings

### 1. Open Pipeline Rows

Current meaning:

- Count of every row not mapped to legacy pipeline `Enrolled` or `Closed Lost`

Why misleading:

- It sounds like a concrete review queue.
- It is actually a broad residual bucket from the legacy operational pipeline model.
- It can include rows across very different lifecycle/document/payment states.

Risk:

- High

Recommended direction:

- Replace with a clearer backlog metric, or relabel as a broad legacy pipeline count.

### 2. Unclassified / New To MLCKIA

Current meaning:

- Rows that do not trip contacted/docs/payment/enrolled/closed-lost heuristics

Why misleading:

- The slash label implies both unknown classification and a meaningful intake state.
- The underlying logic is mostly heuristic fallback, not authoritative lifecycle truth.

Risk:

- High

Recommended direction:

- Rename to something like `Legacy Pipeline: New / Unclassified`.
- Optionally split truly unclassified from intentionally new.

### 3. Communication Logged Today

Current meaning:

- Number of rows whose `Email_Last_Sent_At` or `Last_Contacted_At` is on the current local date

Why misleading:

- It is row-log based, not a definitive count of emails sent today.
- It can include non-email contact logging via `Last_Contacted_At`.
- It is easy to compare incorrectly against `Automation Daily Send Count`.

Risk:

- High

Recommended direction:

- Rename or clarify to indicate row-log activity, not authoritative send volume.

### 4. Pipeline Counts vs Workload & Action Required Drill-Down

Current meaning:

- Pipeline cards use legacy operational pipeline grouping.
- Drill-down cards use lifecycle stage plus lightweight operator-actionability.

Why misleading:

- Both are presented on the same page as if they belong to one coherent model.
- Operators can assume they should reconcile directly.
- They are generated from different functions and different authority assumptions.

Risk:

- High

Recommended direction:

- Keep both only if their different authority is explicit.
- Otherwise remove one of the overlapping summaries or move one to diagnostics/secondary context.

## Operator Confusion Risk Assessment

| Area | Risk | Reason |
|---|---|---|
| Open Pipeline Rows | High | Broad residual legacy-pipeline count presented like a concrete operational queue |
| Unclassified / New To MLCKIA | High | Mixed concept label over heuristic fallback classification |
| Communication Logged Today | High | Easy to mistake for actual daily send count |
| Pipeline Counts vs Drill-Down | High | Different authorities displayed side by side without strong separation |
| Automation Daily Send Count | Medium | Mostly accurate, but easily compared against row-log metrics |

## Prioritisation for Follow-Up

### Priority 1

- `Open Pipeline Rows`
- `Communication Logged Today`

These are the most likely to drive incorrect operator conclusions quickly.

### Priority 2

- `Unclassified / New To MLCKIA`
- legacy pipeline counts vs drill-down relationship

These are structurally confusing but can follow the first label/authority fixes.

## Recommended r222B Patch Scope

Recommended scope only. Not implemented here.

Track:

- `Track L`

Suggested minimal scope:

1. Replace or relabel `Open Pipeline Rows`
2. Clarify `Communication Logged Today` as row-log activity, not send-count authority
3. Clarify `Unclassified / New To MLCKIA`
4. Add stronger visual separation between:
   - legacy pipeline summary
   - lifecycle/actionability drill-down

Do not change Stage Batch logic in `r222B`.

Possible `r222B` file scope:

- `AdminUI.html` only, if limited to wording and grouping
- `Admin.js` only if a metric calculation replacement is explicitly approved later

## Explicit No-Mutation Statement

- No runtime files were changed during this audit.
- No deployment was performed during this audit.
- No Apps Script version was created during this audit.
- No staging repin was performed during this audit.
- No send was performed during this audit.
- No sheet modification was performed during this audit.

