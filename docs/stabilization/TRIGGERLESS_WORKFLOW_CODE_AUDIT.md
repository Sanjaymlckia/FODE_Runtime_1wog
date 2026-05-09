# S2C Triggerless Workflow Code Audit

Date: 2026-05-09
Scope: Read-only audit of trigger helper code and manual workflow viability with deleted/disarmed trigger state

## Summary

- Trigger helper code is still fully present
- Trigger installation/removal remains callable from Admin wrappers in source
- Current workflow does not require trigger presence for preview, review, manual send probe, or WhatsApp fallback export
- Stage-batch automation lineage still shapes UI and backend assumptions even when the live trigger is deleted

## Remaining Trigger Helper Code

| File | Function | Approx line | Callable from Admin | Depends on trigger presence |
| --- | --- | ---: | --- | --- |
| `Code.js` | `automatedStageBatchRunner` | 7725 | Indirectly, as trigger handler only | No, but intended for trigger execution |
| `Code.js` | `inspectAutomatedStageRunnerTriggers_` | 7747 | Yes via status surfaces | Reads live trigger presence |
| `Code.js` | `ensureAutomatedStageRunnerTrigger_` | 7774 | Yes via admin wrapper | Creates/updates trigger |
| `Code.js` | `removeAutomatedStageRunnerTrigger_` | 7854 | Yes via admin wrapper | Deletes trigger |
| `Code.js` | `getAutomatedStageRunnerStatus_` | 7896 | Yes via admin safety/status UI | Reads trigger state and last-run info |
| `Admin.js` | `admin_runAutomatedStageBatchOnce` | 3492 | Yes | No trigger required |
| `Admin.js` | `admin_installAutomatedStageRunnerTrigger` | 3506 | Yes | Creates trigger |
| `Admin.js` | `admin_removeAutomatedStageRunnerTrigger` | 3515 | Yes | Deletes trigger |

## Trigger API Usage

- `ScriptApp.getProjectTriggers()`:
  - `Code.js:7750`
  - `Code.js:7808`
  - `Code.js:7867`
- `ScriptApp.newTrigger(fnName).timeBased().everyMinutes(10).create()`:
  - `Code.js:7829`

## Whether Any Workflow Depends On Trigger Presence

### Does not require trigger presence

- record review flows
- document verification flows
- portal access update flows
- WhatsApp fallback CSV export
- applicant message preview
- stage batch preview
- manual `admin_runAutomatedStageBatchOnce`

### Still assumes trigger concepts exist

- `admin_getOperationalSafetyStatus()` reports trigger installed/count state (`Admin.js:3391-3456`)
- stage-batch UI exposes automation/preview/send semantics as if trigger automation is part of the normal model
- trigger install/remove wrappers remain admin-callable in source

## Triggerless Viability Findings

- The current deleted/disarmed trigger posture is operationally viable for:
  - audits
  - queue review
  - preview-only work
  - manual-first controlled actions
- The codebase still embeds scheduled automation as a first-class concept, especially around stage batching
- Trigger absence does not break the main manual review UI, but it does leave stale automation management surfaces available

## Recommendation

### Keep dormant for now

- `automatedStageBatchRunner`
- `inspectAutomatedStageRunnerTriggers_`
- `getAutomatedStageRunnerStatus_`
- `admin_runAutomatedStageBatchOnce`

### Remove later, not now

- `ensureAutomatedStageRunnerTrigger_`
- `removeAutomatedStageRunnerTrigger_`
- `admin_installAutomatedStageRunnerTrigger`
- `admin_removeAutomatedStageRunnerTrigger`

Reason:
- these paths are high-risk mutation surfaces but still useful as rollback and audit references until the next controlled cleanup plan is approved

## Triggerless Workflow Conclusion

- Recommended posture: keep trigger code dormant, do not recreate live trigger state, and plan later removal of install/remove surfaces only after a controlled patch CIS is approved
