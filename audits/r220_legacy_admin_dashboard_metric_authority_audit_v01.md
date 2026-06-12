# r220 Legacy Admin Dashboard Metric Authority Audit v01

Status: Phase 1 audit only  
Track: Audit / no runtime mutation  
Runtime checked: live `r219 / 219` legacy `?view=admin`  
Audit basis:
- Source inspection of `AdminUI.html` and `Admin.js`
- Live browser/RPC evidence captured during read-only inspection
- No direct sheet connector access used

## Executive Verdict

Verdict: `PARTIAL`

The legacy Admin dashboard renders successfully and most values are internally consistent with their current source functions. The problem is authority clarity, not render failure. Several metrics are accurate only within a narrower technical meaning than their labels imply.

Primary failures:
- `Pending Intake Review` is materially mislabeled. It currently means “all rows not Enrolled or Closed Lost,” not intake-review backlog.
- `Email Sent Today` and `Daily Send Count` use different authority sources and look comparable when they are not.
- `New To MLCKIA` is a mixed legacy/derived pipeline label, not a clean operational or lifecycle state.
- `Trigger Sends` and `Trigger Installed` present configuration truth and trigger-inspection truth side by side without clearly separating them.
- Pipeline counts are derived from mixed raw stage fields plus fallback heuristics, so they are not a single-authority dashboard.

## Source Map

Primary frontend renderers:
- `AdminUI.html:8508` `renderOperationalDashboardMetrics_()`
- `AdminUI.html:8548` `renderOperationalSafetyStatus_()`

Primary backend builders:
- `Admin.js:3361` `deriveOperationalPipelineStage_()`
- `Admin.js:3410` `buildOperationalDashboardMetrics_()`
- `Admin.js:3486` `admin_getOperationalDashboardMetrics()`
- `Admin.js:5539` `admin_getOperationalSafetyStatus()`

Live evidence used:
- Legacy Admin runtime `r219 / 219`
- Read-only browser/RPC capture during audit

## Metric Authority Table

Legend:
- Accuracy: `GOOD`, `PARTIAL`, `FAIL`
- Safety: `SAFE`, `CAUTION`, `MISLEADING`

### Operational Dashboard

| Label | Live | Render | Calculation path | Authority category | Accuracy | Operator usefulness | Safety | Recommended action |
|---|---:|---|---|---|---|---|---|---|
| Forms Received Today | 1 | `AdminUI.html:1684`, `:8512` | `buildOperationalDashboardMetrics_()` via `Timestamp \|\| timestamp \|\| adapter_timestamp \|\| Created_At \|\| PortalTokenIssuedAt` + `isSameLocalDate_()` | Full-sheet intake event heuristic | PARTIAL | Useful for same-day intake pulse | CAUTION | Rename to `Applications Received Today (heuristic)` or expose source field used |
| Pending Intake Review | 193 | `AdminUI.html:1685`, `:8513` | `buildOperationalDashboardMetrics_()` increments when pipeline != `Enrolled` and != `Closed Lost` | Mixed pipeline count | FAIL | High operator value, wrong meaning | MISLEADING | Replace with true intake backlog or relabel to `Open Pipeline Rows` |
| Docs Pending | 13 | `AdminUI.html:1686`, `:8514` | Count of pipeline == `Documents Pending` from `deriveOperationalPipelineStage_()` | Mixed derived pipeline | PARTIAL | Useful directional count | CAUTION | Clarify it is operational-pipeline derived, not authoritative doc-state truth |
| Payment Evidence Not Verified | 2 | `AdminUI.html:1687`, `:8515` | Count of pipeline == `Payment Pending` from `deriveOperationalPipelineStage_()` | Mixed derived pipeline | PARTIAL | Useful directional count | CAUTION | Clarify as pipeline/payment-evidence heuristic |
| Email Sent Today | 63 | `AdminUI.html:1688`, `:8516` | `Email_Last_Sent_At \|\| Last_Contacted_At` + `isSameLocalDate_()` | Row-level communication log fields | PARTIAL | Useful activity pulse | CAUTION | Rename to `Rows With Communication Logged Today` or split manual/auto send counts |
| Email Failures | 1 | `AdminUI.html:1689`, `:8517` | `Email_Status == FAILED/BOUNCED` or `Last_Contact_Result == FAILED` | Row-level communication outcome | PARTIAL | Useful warning metric | SAFE | Keep, but document combined source logic |
| WhatsApp Fallback Queue | 31 | `AdminUI.html:1690`, `:8518` | `isWhatsAppFallbackCandidate_(row, "ALL_FALLBACK")` or `Email_Status == FALLBACK_PENDING` | Fallback eligibility heuristic | PARTIAL | Operationally useful | CAUTION | Keep, but label as fallback candidate queue |
| Queue Backlog | 154 | `AdminUI.html:1691`, `:8519` | `isQueueCandidateRow_(row)` | Operational queue heuristic | PARTIAL | Useful only if defined | CAUTION | Expose exact queue contract or rename `Queue Candidate Rows` |
| Duplicate Risk | 1 | `AdminUI.html:1692`, `:8520` | Duplicate signature counts across applicantId, parentContact, studentDob, portalToken | Duplicate heuristic | PARTIAL | Useful warning signal | SAFE | Keep, add tooltip/source note |
| Metrics Scan | `193 rows / 1858 ms` | `AdminUI.html:1693`, `:8521` | Full-sheet row count and scan duration | Runtime scan telemetry | GOOD | Useful | SAFE | Keep |

### Pipeline Counts

| Label | Live | Render | Calculation path | Authority category | Accuracy | Operator usefulness | Safety | Recommended action |
|---|---:|---|---|---|---|---|---|---|
| New To MLCKIA | 8 | `AdminUI.html:1697`, `:8522` | `deriveOperationalPipelineStage_()` from raw `Pipeline_Stage \|\| Operational_Stage \|\| CRM_Stage \|\| Stage`, else fallback | Mixed raw + fallback pipeline | PARTIAL | Some backlog value | MISLEADING | Rename to neutral `Uncontacted / Unclassified` or split CRM label from derived state |
| Contacted | 170 | `AdminUI.html:1698`, `:8523` | Same pipeline resolver; fallback if `Email_Status == SENT/SEND_ATTEMPT` or any `Last_Contact_Result` | Mixed raw + communication heuristic | PARTIAL | Directional only | CAUTION | Clarify as operational pipeline, not lifecycle authority |
| Documents Pending | 13 | `AdminUI.html:1699`, `:8524` | Same resolver; fallback on `Portal_Submitted` | Mixed raw + portal heuristic | PARTIAL | Useful but non-authoritative | CAUTION | Clarify source; later align with r217+ document resolver |
| Payment Evidence Not Verified | 2 | `AdminUI.html:1700`, `:8525` | Same resolver; fallback on docs verified/receipt present | Mixed raw + document/payment heuristic | PARTIAL | Useful but non-authoritative | CAUTION | Clarify source or rename |
| Enrolled | 0 | `AdminUI.html:1701`, `:8526` | Same resolver; `Registration_Complete` or `Payment_Verified` can force enrolled | Mixed legacy authority | PARTIAL | Low confidence | MISLEADING | Do not present as final enrollment truth without stronger authority source |
| Closed Lost | 0 | `AdminUI.html:1702`, `:8527` | Raw stage text contains `closed|lost|withdraw` or explicit raw stage | Mixed raw stage text | PARTIAL | Directional only | CAUTION | Clarify as legacy pipeline closure label |

### Email State Counts

| Label | Live | Render | Calculation path | Authority category | Accuracy | Operator usefulness | Safety | Recommended action |
|---|---:|---|---|---|---|---|---|---|
| SEND_ATTEMPT | 0 | `AdminUI.html:1706`, `:8528` | `normalizeEmailStatus_(Email_Status)` | Row field status | GOOD | Useful | SAFE | Keep |
| SENT | 162 | `AdminUI.html:1707`, `:8529` | `normalizeEmailStatus_(Email_Status)` | Row field status | PARTIAL | Useful | CAUTION | Keep, but note “previous send state,” not eligibility |
| FAILED | 1 | `AdminUI.html:1708`, `:8530` | `Email_Status` plus extra increment when `Last_Contact_Result == FAILED` | Blended status/result count | PARTIAL | Useful warning | CAUTION | Clarify blended counting rule |
| BOUNCED | 0 | `AdminUI.html:1709`, `:8531` | `normalizeEmailStatus_(Email_Status)` | Row field status | GOOD | Useful | SAFE | Keep |
| SUPPRESSED | 0 | `AdminUI.html:1710`, `:8532` | `Email_Status` plus extra increment when `Last_Contact_Result == SUPPRESSED` | Blended status/result count | PARTIAL | Useful warning | CAUTION | Clarify blended counting rule |
| FALLBACK_PENDING | 0 | `AdminUI.html:1711`, `:8533` | `normalizeEmailStatus_(Email_Status)` | Row field status | GOOD | Useful | SAFE | Keep |

### Runtime Safety

| Label | Live | Render | Calculation path | Authority category | Accuracy | Operator usefulness | Safety | Recommended action |
|---|---:|---|---|---|---|---|---|---|
| Runtime Version | r219 | `AdminUI.html:1718`, `:8557` | `admin_getOperationalSafetyStatus()` -> `buildRuntimeTruth_()` | Runtime truth | GOOD | High | SAFE | Keep |
| Deploy Version | 219 | `AdminUI.html:1719`, `:8558` | Same | Runtime truth | GOOD | High | SAFE | Keep |
| Stabilization Mode | OFF | `AdminUI.html:1720`, `:8559` | `isSystemStabilizationModeActive_()` | Config/runtime gate | GOOD | High | SAFE | Keep |
| Production Sends | ON | `AdminUI.html:1721`, `:8560` | `CONFIG.ENABLE_PRODUCTION_EMAIL_SENDS` and stabilization | Config/runtime gate | GOOD | High | SAFE | Keep |
| Trigger Sends | ON | `AdminUI.html:1722`, `:8561` | `isTriggerSendEnabled_()` | Config gate | GOOD | Useful | CAUTION | Relabel `Trigger Sends Config` |
| Trigger Installed | UNKNOWN | `AdminUI.html:1723`, `:8562-8564` | UI derives `UNKNOWN` unless trigger inspection succeeds | Trigger inspection state | PARTIAL | Useful | CAUTION | Relabel `Trigger Installed (inspection)` |
| Trigger Inspection | `TRIGGER_API_UNAVAILABLE` | `AdminUI.html:1724`, `:8565` | `trigger.inspectionCode` | Inspection capability | GOOD | High | SAFE | Keep |
| Trigger Count | UNKNOWN | `AdminUI.html:1725`, `:8566` | Only shown when inspection ok | Trigger inspection state | PARTIAL | Medium | CAUTION | Tie wording to inspection availability |
| Last Automation Run | `2026-05-09T05:20:49.209Z` | `AdminUI.html:1726`, `:8567` | `triggerStatus.lastRun` | Trigger-run telemetry | GOOD | High | SAFE | Keep |
| Last Successful Run | `-` | `AdminUI.html:1727`, `:8568` | `lastRun.lastSuccessfulRun` | Trigger-run telemetry | GOOD | Medium | SAFE | Keep |
| Last Failed Run | `-` | `AdminUI.html:1728`, `:8569` | `lastRun.lastFailedRun` | Trigger-run telemetry | GOOD | Medium | SAFE | Keep |
| Consecutive Failures | 0 | `AdminUI.html:1729`, `:8570` | `lastRun.consecutiveFailures` | Trigger-run telemetry | GOOD | Useful | SAFE | Keep |
| Queue Scan Duration | `0 ms` | `AdminUI.html:1730`, `:8571` | `lastRun.elapsedMs` | Trigger-run telemetry | PARTIAL | Useful if trigger ran | CAUTION | Clarify “last automation scan duration” |
| Batch Size Used | 10 | `AdminUI.html:1731`, `:8572` | `lastRun.effectiveRunSize \|\| batchSize` | Trigger-run telemetry | GOOD | Useful | SAFE | Keep |
| Daily Send Count | 0 | `AdminUI.html:1732`, `:8573` | `triggerStatus.sentToday \|\| lastRun.dailyUsedAfter` | Trigger/automation send counter | PARTIAL | High | CAUTION | Relabel `Automated Daily Send Count` or split manual vs automated |
| Daily Cap Remaining | 500 | `AdminUI.html:1733`, `:8574` | `dailyCap - sentToday` | Trigger/automation cap state | GOOD | High | SAFE | Keep |
| Last Batch ID | `DBG-20260509051746-1c020b9f` | `AdminUI.html:1734`, `:8575` | `lastRun.batchId \|\| batchLabel \|\| requestId \|\| debugId` | Trigger-run telemetry | GOOD | Useful | SAFE | Keep |
| Last Batch Result | EMPTY | `AdminUI.html:1735`, `:8576` | `lastRun.result \|\| blockCode \|\| message` | Trigger-run telemetry | PARTIAL | Useful | CAUTION | Clarify it is automation result, not manual stage batch result |

### Property Health

| Label | Live | Render | Calculation path | Authority category | Accuracy | Operator usefulness | Safety | Recommended action |
|---|---:|---|---|---|---|---|---|---|
| Total Properties | 19 | `AdminUI.html:1742`, `:8577` | `getPropertyInventorySummary_()` | Script property inventory | GOOD | Useful | SAFE | Keep |
| Estimated Size | 16361 | `AdminUI.html:1743`, `:8578` | Same | Script property inventory | GOOD | Useful | SAFE | Keep |
| COMM_LAST Count | 0 | `AdminUI.html:1744`, `:8579` | Same | Script property inventory | GOOD | High | SAFE | Keep |
| Health | `HEALTHY \| SCRIPT_PROPERTY_COUNT_GREW` | `AdminUI.html:1745`, `:8580` | `propertyHealthLevel_()` + warning branch in `admin_getOperationalSafetyStatus()` | Script property hygiene | GOOD | High | SAFE | Keep, but explain warning semantics |

### Email Pipeline Status

| Label | Live | Render | Calculation path | Authority category | Accuracy | Operator usefulness | Safety | Recommended action |
|---|---:|---|---|---|---|---|---|---|
| Manual Send | ON | `AdminUI.html:1752`, `:8581` | `gates.manualSendEnabled` | Config/runtime gate | GOOD | High | SAFE | Keep |
| Manual Probe Mode | ON | `AdminUI.html:1753`, `:8582` | `gates.manualProbeMode` | Config/runtime gate | GOOD | High | SAFE | Keep |
| Batch Send | ON | `AdminUI.html:1754`, `:8583` | `gates.batchSendEnabled` | Config/runtime gate | GOOD | High | SAFE | Keep |
| Trigger Send | ON | `AdminUI.html:1755`, `:8584` | `gates.triggerSendsEnabled` | Config/runtime gate | GOOD | Medium | CAUTION | Relabel `Trigger Send Config` |
| Daily Cap | 500 | `AdminUI.html:1756`, `:8585` | `CONFIG.DAILY_SEND_CAP` or automated cap | Config | GOOD | High | SAFE | Keep |
| Per-Run Cap | 30 | `AdminUI.html:1757`, `:8586` | `CONFIG.PER_RUN_BATCH_SIZE \|\| DEFAULT_STAGE_BATCH_SIZE` | Config | GOOD | High | SAFE | Keep |
| Last Blocked Reason | `-` | `AdminUI.html:1758`, `:8587` | Derived from stabilization / production send gate | Gate state | PARTIAL | Useful only if blocked | SAFE | Keep |
| Last Manual Send | `-` | `AdminUI.html:1759`, `:8588` | `manualProbe.lastManualSend` | Manual send telemetry | PARTIAL | Medium | CAUTION | Keep if manual send remains used |
| Last Manual Recipient | `-` | `AdminUI.html:1760`, `:8589` | `manualProbe.lastManualRecipient` | Manual send telemetry | PARTIAL | Medium | CAUTION | Keep |
| Last Manual Result | `-` | `AdminUI.html:1761`, `:8590` | `manualProbe.lastManualResult` | Manual send telemetry | PARTIAL | Medium | CAUTION | Keep |
| Idempotency Active | YES | `AdminUI.html:1762`, `:8591` | `manualProbe.idempotencyActive` | Send-protection gate | GOOD | High | SAFE | Keep |
| Bounced Rows | 0 | `AdminUI.html:1763`, `:8592` | `getBounceVisibilitySummary_()` | Row scan on existing bounce fields | GOOD | Useful | SAFE | Keep |
| Hard Bounces | 0 | `AdminUI.html:1764`, `:8593` | Same | Row scan on existing bounce fields | GOOD | Useful | SAFE | Keep |
| Temporary Bounces | 0 | `AdminUI.html:1765`, `:8594` | Same | Row scan on existing bounce fields | GOOD | Useful | SAFE | Keep |
| Last Bounce Reason | `No bounced rows` | `AdminUI.html:1766`, `:8595` | Same | Bounce visibility summary | GOOD | Medium | SAFE | Keep |

## Most Misleading Labels

1. `Pending Intake Review`
   - Current logic: every row not `Enrolled` or `Closed Lost`
   - Problem: implies a narrow intake-review queue, but currently means almost all open rows

2. `New To MLCKIA`
   - Current logic: mixed raw stage label or final fallback when no stronger signal exists
   - Problem: implies a business-defined stage, but often means “none of the above”

3. `Email Sent Today`
   - Current logic: any row with `Email_Last_Sent_At` or `Last_Contacted_At` on current date
   - Problem: looks comparable to actual send counts, but includes broader contact logging semantics

4. `Trigger Sends`
   - Current logic: config gate only
   - Problem: can be `ON` while trigger inspection/install state is unknown

5. `Trigger Installed`
   - Current logic: derived from successful trigger inspection only
   - Problem: `UNKNOWN` is not an install state; it is an inspection limitation

## Suspect or Mixed Calculations

1. `Pending Intake Review`
   - `Admin.js:3469`
   - Mixed pipeline count presented as a review queue

2. Pipeline dashboard overall
   - `Admin.js:3361-3385`
   - Raw stage fields are preferred, then fallback heuristics are applied
   - This mixes CRM, operational, document, payment, and communication signals

3. `Email Sent Today` vs `Daily Send Count`
   - `Admin.js:3458` vs `Admin.js:5619`
   - One is row-log date-based; the other is trigger runner state

4. `FAILED` and `SUPPRESSED` email states
   - `Admin.js:3460-3461`
   - Counts can be incremented from `Last_Contact_Result` as well as normalized `Email_Status`

5. `Enrolled`
   - `Admin.js:3381`
   - `Registration_Complete` or `Payment_Verified` can force enrolled pipeline status
   - This is legacy authority debt, not a clean enrollment authority

## Missing Operator-Useful Metrics

1. True intake-review backlog
2. True mail-eligible count separate from review-queue visible count
3. Separate manual sends today vs automated sends today vs rows contacted today
4. Clear trigger state split:
   - trigger send config
   - trigger installed
   - trigger inspection availability
5. Clean document-state counts:
   - awaiting uploads
   - partially uploaded
   - uploaded review required
   - docs verified
6. Clear payment-state counts independent of legacy pipeline labels
7. Explicit “full sheet derived” note so operators do not read the dashboard as selected queue truth

## Recommended Phase 2 Scope

Phase 2 should be split into two scopes, not one:

1. `Track L` wording/label cleanup
   - Replace misleading labels
   - Add small operator notes explaining operational backlog vs mail eligibility vs runtime gate telemetry

2. `Track H` metric contract cleanup
   - Backend metric split in `Admin.js`
   - Separate counts for:
     - open pipeline rows
     - true intake review backlog
     - review queue visible
     - mail eligible now
     - cooldown / blocked for mail
     - automated daily sends
     - manual sends / row-level communication logged today
   - Reduce mixed legacy authority in pipeline dashboard or explicitly classify it as legacy operational dashboarding

## Likely Files for Approved Phase 2

- `AdminUI.html`
- `Admin.js`

No other files are indicated by this audit.

## Recommended Operator Dashboard Direction

1. Keep legacy Admin dashboard as an operational summary, not an authority dashboard.
2. Stop using single ambiguous counts where operators infer sendability from workload visibility.
3. Separate these concepts visually:
   - operational backlog
   - lifecycle/document/payment truth
   - mail eligibility now
   - runtime/config/trigger safety
4. Treat legacy pipeline counts as transitional unless and until they are aligned to one resolver contract.

## No-Action Confirmation

- Code changes: no runtime code changed by this audit
- Deployments run: no
- Apps Script version created: no
- Deployment repin: no
- Sends performed: no
- Sheets touched: no
- Commit/tag: no

