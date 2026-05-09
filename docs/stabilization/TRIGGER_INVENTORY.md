# S1 Trigger Inventory

Date: 2026-05-09
Scope: Source-only trigger baseline with operator-deleted trigger noted per CIS

## Accepted Current State

- Operator deleted the project trigger
- No trigger recreation is authorized in S1
- Recommended posture: dormant only

## Trigger Helper Functions Still Present In Source

| Function | File | Purpose | Mutation Risk |
| --- | --- | --- | --- |
| `automatedStageBatchRunner` | `Code.js` | Top-level trigger handler for automated stage batch runs | Runtime execution only |
| `runAutomatedStageBatchScheduled` | `Code.js` | Legacy disabled trigger alias returning a skipped result | Low |
| `getAutomatedStageRunnerTriggerFunctionName_` | `Code.js` | Returns canonical trigger handler name | None |
| `inspectAutomatedStageRunnerTriggers_` | `Code.js` | Reads project trigger count for the handler | Read-only trigger API |
| `ensureAutomatedStageRunnerTrigger_` | `Code.js` | Installs or deduplicates a time-based trigger | High |
| `removeAutomatedStageRunnerTrigger_` | `Code.js` | Deletes existing handler triggers | High |
| `getAutomatedStageRunnerStatus_` | `Code.js` | Returns trigger and last-run status | Read-only trigger API |
| `admin_runAutomatedStageBatchOnce` | `Admin.js` | Manual super-admin runner | No trigger mutation |
| `admin_installAutomatedStageRunnerTrigger` | `Admin.js` | Admin wrapper for trigger install | High |
| `admin_removeAutomatedStageRunnerTrigger` | `Admin.js` | Admin wrapper for trigger removal | High |

## Trigger-Related Code Paths

### Execution path

- `automatedStageBatchRunner()`
- `runAutomatedStageBatchWithLock_({ source: "TRIGGER" })`
- Guarded by stabilization and trigger-send gates

### Inspection / observability path

- `inspectAutomatedStageRunnerTriggers_()`
- `getAutomatedStageRunnerStatus_()`
- `admin_getOperationalSafetyStatus()` surfaces trigger installed/count state to Admin UI
- `AdminUI.html` reads `trigger.installed`, `triggerCount`, and inspection status fields

### Install / remove path

- `ensureAutomatedStageRunnerTrigger_()`
- `removeAutomatedStageRunnerTrigger_()`
- Install cadence in source remains `everyMinutes(10)`

## Gate Conditions Relevant To Dormant State

- `isTriggerSendEnabled_()` requires all of the following:
  - `SYSTEM_STABILIZATION_MODE !== true`
  - `ENABLE_TRIGGER_SENDS === true`
  - `ENABLE_TRIGGER_EMAIL_SENDS === true`
  - `ENABLE_PRODUCTION_EMAIL_SENDS === true`
- `automatedStageBatchRunner()` also checks:
  - `ENABLE_AUTOMATED_STAGE_RUNNER === true`
- Even with dormant/deleted trigger state, source currently still contains the full install/remove and runner paths

## Recommendation

- Keep all trigger code paths dormant only during stabilization
- Treat deleted live trigger state as the operational truth
- Do not remove helper functions yet; they remain useful for rollback understanding and later controlled reactivation
- Do not install, update, or recreate triggers until a future CIS explicitly authorizes it
