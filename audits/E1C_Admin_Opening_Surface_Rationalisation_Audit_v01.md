# E1C Admin Opening Surface Rationalisation Audit v01

Status: Discovery only  
Classification: UI / Operator Workflow Review  
Authority impact: None  
Runtime impact: None  
Deployment: None

## Scope

This audit reviews the opening Legacy Admin operator surface after `E1B` wording cleanup at runtime `r275 / 275`.

It does not change:

- lifecycle authority
- LAP / authority model
- communication logic
- payment logic
- document logic
- queues
- gallery
- OPS
- Stage Batch behavior

## Files Inspected

- [AdminUI.html](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html)
- [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js)
- [Config.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Config.js)
- [Routes.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Routes.js)
- [docs/architecture/Architecture_Overview.md](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/docs/architecture/Architecture_Overview.md)
- [docs/architecture/Authority_Model.md](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/docs/architecture/Authority_Model.md)
- [docs/architecture/Communication_Model.md](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/docs/architecture/Communication_Model.md)
- [docs/architecture/Operational_Model.md](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/docs/architecture/Operational_Model.md)
- [docs/architecture/Queue_Model.md](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/docs/architecture/Queue_Model.md)
- [audits/r226B_ops_freeze_boundary_note_v01.md](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/audits/r226B_ops_freeze_boundary_note_v01.md)

## Runtime / Source Facts

- Admin opening-surface wording is defined in `AdminUI.html`.
- Opening dashboard metrics are derived from the current working sheet through `openDataSheet_()` and `buildOperationalDashboardMetrics_()` in `Admin.js`.
- Review queues are derived from the current working sheet through `admin_getReviewQueues()` in `Admin.js`.
- No active opening-surface dependency on an archived legacy sheet was found.
- Legacy Admin remains the trusted operator surface.
- OPS remains frozen.
- Operator Actionability remains derived, read-only, and non-authoritative.

## E1C.1 Current Surface Inventory

| Surface section | Classification | Operator value | Recommended state | Notes |
|---|---|---:|---|---|
| Admin Dashboard header + intro helper | SUPPORTING | Immediate | Expanded | Good orientation, but still summary-level rather than action-first. |
| 1. Intake Overview | SUPPORTING | Daily | Move Lower | Useful context, but not the first thing an officer needs at 8:00 AM. |
| 2. Workload & Action Required | COMPATIBILITY | Occasional | Collapse or Move Lower | Still carries compatibility-summary burden rather than direct current action. |
| 3. Document & Payment Status | ACTION | Immediate | Expanded | Closest current section to actionable officer workload. |
| 4. Communication Performance | SUPPORTING | Daily | Expanded | Useful trend/state visibility, but does not directly answer who needs contact now. |
| 5. Exceptions & Blockers | ACTION | Immediate | Expanded | High operator value; should remain prominent. |
| 6. System Health | DIAGNOSTIC | Rare | Collapsed | Important when broken, but not opening priority. |
| Stage Batch Communications | SUPPORTING | Occasional | Move Lower | Important for send workflow, but not first-read opening content. |
| Review Queues | ACTION | Immediate | Expanded | Primary operational workload surface. |
| Actionability Preview | EXPERIMENTAL | Occasional | Collapsed | Useful advisory layer, but still secondary and exploratory. |
| Applicant Search | SUPPORTING | Occasional | Collapsed | Recovery/navigation tool, not opening priority. |

## E1C.2 Compatibility Summary Review

### Current compatibility cards

- Summary: New / Unclassified
- Summary: Contacted
- Summary: Enrolled
- Summary: Closed Lost
- Summary: Payment Pending

### Assessment

These cards are no longer carrying transition-era wording, but they still behave as compatibility summaries rather than front-line operator workload truth.

They do not answer:

- what needs review now
- what is blocked now
- what is overdue now
- who needs communication now

### Recommendation

Recommended option: `Option B` leaning toward `Option C`

- Collapse them into a `Compatibility Summary` block, or
- move them below operational sections

Not recommended:

- keeping them as a prominent early section
- retiring them immediately without confirming whether operators still use them for orientation

## E1C.3 Action-First Surface Model

If the page were ordered for an 8:00 AM admissions workflow, the opening surface should begin with action-first workload rather than compatibility or summary metrics.

### Conceptual opening block

`Action Required Today`

Candidate opening metrics:

- Ready For Review
- Document Verification Required
- Payment Verification Required
- Awaiting Documents > 3 days
- Awaiting Payment > 3 days
- Communications Due
- Dormant / stale applicants
- Blocked / anomalous rows

### Discovery judgment

This direction is stronger than the current opening order.

However, implementation should be split:

1. reorder / collapse only
2. then consider better action-first cards
3. then consider communication-authority surfacing

No calculation change is required for the discovery conclusion itself.

## E1C.4 Communication Visibility Review

### Current state

Communication workload is `Partially Visible`.

Visible:

- Communication Performance summary
- row-logged activity today
- email rows sent today
- failures / fallback related counts
- Stage Batch visibility
- Actionability Preview advisory layer

Not immediately visible on opening surface:

- exactly who needs communication now
- why they need communication
- overdue communication counts in an operator-first form
- explicit communications-due queue framing

### Assessment

The current communication section reports activity and diagnostics more than operator next actions.

For an officer opening Admin in the morning, communication workload is not hidden, but it is not surfaced in a decision-ready way.

### Recommendation

Communication visibility should be improved in a later slice, but not by changing send logic or authority.

Best next direction:

- keep current communication performance block for now
- later add explicit `communications due` visibility based on existing authority/actionability outputs

## E1C.5 Panel Collapse Strategy

### Recommended collapsed by default

- System Health
- Actionability Preview
- Applicant Search

### Recommended remain expanded

- Review Queues
- Document & Payment Status
- Exceptions & Blockers

### Review target

`Communication Performance` may remain expanded for now, but it is a candidate to move below action-first sections once a clearer communications-due surface exists.

## E1C.6 Operator Workflow Walkthrough

### 1. Officer starts day

Helpful:

- Review Queues
- Document & Payment Status
- Exceptions & Blockers

Redundant or low-priority:

- Compatibility Summary cards
- System Health

Missing:

- direct `what is due now`
- direct `what needs communication now`

### 2. Officer clears document reviews

Helpful:

- Review Queues
- Documents to Verify
- Ready For Review metric

Redundant:

- Summary cards

Missing:

- older-than threshold emphasis

### 3. Officer clears payment reviews

Helpful:

- Payments to Verify
- Awaiting Payment
- Payment-related cards

Redundant:

- Summary: Payment Pending if queue counts already carry the truth

Missing:

- clearer split between verification-required and applicant-follow-up

### 4. Officer sends communications

Helpful:

- Stage Batch Communications
- Communication Performance
- Actionability Preview

Redundant:

- compatibility summary cards

Missing:

- immediate communications-due operator view

### 5. Officer identifies blockers

Helpful:

- Exceptions & Blockers
- System Health when something is actually broken

Redundant:

- System Health being expanded by default

Missing:

- stronger overdue / stale highlighting on opening surface

## Proposed Operator-First Layout (Conceptual Only)

No implementation is proposed in this audit. Conceptually, the opening order should move toward:

1. Review Queues
2. Document & Payment Status
3. Exceptions & Blockers
4. Communication Performance or future Communications Due block
5. Intake Overview
6. Compatibility Summary
7. Stage Batch Communications
8. Actionability Preview
9. Applicant Search
10. System Health

Alternative safe step:

- keep current major sections
- collapse compatibility-style and diagnostic panels
- move operational queues higher before any new metrics are introduced

## Key Findings

1. The opening surface is still partly optimized for transition-era orientation rather than current operator action.
2. Review Queues is the strongest true opening workload surface.
3. Document & Payment Status is the strongest current action summary block.
4. Communication visibility is present but not operator-first.
5. Compatibility summary cards now have lower operator value than they did during migration/legacy-alignment work.
6. System Health is useful but should not compete with morning workload visibility.
7. Actionability Preview remains helpful but secondary until its role is deliberately expanded or relocated.

## Risk Assessment

### Low risk

- collapsing System Health
- collapsing Applicant Search
- collapsing Actionability Preview
- moving compatibility summary lower

### Medium risk

- retiring compatibility summary entirely without observing operator usage
- reordering sections in a way that disrupts established muscle memory without a staged rollout

### Not recommended in next slice

- mixing wording/rationalisation with authority or metric logic changes
- mixing dashboard rationalisation with communication backend/model changes

## Recommended Next Slice

Primary recommendation:

- `E1C.1 implementation slice`: opening-surface order / collapse rationalisation only

Suggested boundaries:

- AdminUI-only if possible
- no metric logic changes
- no queue logic changes
- no communication logic changes

Secondary follow-on:

- `E2 communication authority / visibility discovery`

Not recommended yet:

- introducing new computed action-first metrics in the same slice as layout cleanup

## Final Recommendation

The dashboard is no longer best optimized for the legacy-transition era.

It should evolve toward an operator-first opening surface centered on:

- queues
- review workload
- blockers
- communications due

while demoting:

- compatibility summaries
- search
- system diagnostics
- experimental advisory panels

## Confirmation

- No runtime files changed
- No authority changed
- No queue behavior changed
- No communication/send behavior changed
- No deployment performed
- No version created
- No repin performed
- No send performed
- No Sheet edit performed
- No Drive edit performed
