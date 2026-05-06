# Current Task

## Current Objective

Maintain `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog` as the authoritative FODE Runtime repo and complete r136 Script Properties dry-run and capped cleanup containment.

## Current Issue

- Stabilization phase active.
- Trigger freeze active.
- Production email freeze active.
- May 5 sheet restore completed.
- Property-growth cleanup containment active.
- r136 cleanup target is `COMM_LAST::*` only.
- Cleanup defaults to dry-run.
- Deletion requires `confirm=true` and `prefix="COMM_LAST::"`.
- Confirmed deletion blocks when eligible count exceeds `MAX_PROPERTY_DELETE_BATCH = 500` unless `forceLargeDelete === true`.
- Protected runtime/config/deployment/cursor keys must not be deleted.
- Phase A: deploy r136, verify whoami, verify inventory RPC wrappers, verify full dry-run output.
- Phase B: manually review property counts, protected counts, eligible counts, and estimated size reduction.
- Phase C: only then run confirmed cleanup.
- Longer-term direction: move communication cooldown state away from unbounded Script Properties after containment.
- No unattended production sends permitted during stabilization.
- r113 alias hard-block regression identified.
- Email send-block caused by r113 alias enforcement (`assertRequiredSystemSenderAlias_`).
- Confirmed working baseline: `r112` (`ca86c0e`).
- Required behavior:
  - `FROM = fode_kia@kundu.ac`
  - `REPLY-TO = fode@kundu.ac` (collaborative inbox)
- Root cause:
  - `GmailApp.getAliases()` empty -> hard fail introduced in `r113`.
- Action plan:
  - Restore `r112` behavior by removing strict alias assertion from:
    - `campaignSendEmailGmail_`
    - `adminSendEmail_`
    - `ingestRecentBounces_`
- Status:
  - r136 deployed with full dry-run and capped cleanup wrappers.
  - Existing single-key dry-run wrapper remains as smoke test.
  - Full dry-run wrapper evaluates up to 500 `COMM_LAST::*` keys and must not delete.
  - Confirmed batch wrapper is capped at 500 and must not be run until full dry-run evidence is reviewed.
  - Apps Script version `136` created with description `r136: full dry-run and capped property cleanup wrappers`.
  - Admin deployment pinned to `@136`.
  - Student deployment pinned to `@136`.
  - Admin whoami: `r136 / 136`, mismatch `false`.
  - Student whoami: `r136 / 136`, mismatch `false`.
  - Admin RPC registry includes `admin_dryRunCleanupAllCommLastProperties`: PASS.
  - Admin RPC registry includes `admin_confirmCleanupCommLastBatch500`: PASS.
  - No confirmed cleanup executed.
  - r135 diagnostics visibility instrumentation in progress.
  - Diagnostic wrappers must log terminal markers and return full objects.
  - Compact display wrappers must return browser-visible summaries for inventory, prefix breakdown, and dry-run cleanup.
  - Apps Script version `135` created with description `r135: property diagnostics visible output`.
  - Admin deployment pinned to `@135`.
  - Student deployment pinned to `@135`.
  - Admin whoami: `r135 / 135`, mismatch `false`.
  - Student whoami: `r135 / 135`, mismatch `false`.
  - Admin RPC registry includes compact display wrapper functions: PASS.
  - CLI execution of display/dry-run wrappers remains blocked by Apps Script execution permissions.
  - Operator-visible dry-run must be completed from Apps Script editor using the no-arg display/log wrappers.
  - No confirmed cleanup executed.
  - r134 identity correction completed after Apps Script version `133` was created with stale `r132 / 132` runtime identity.
  - Apps Script version `133` must not be treated as accepted because deployment pin `@133` did not match runtime identity.
  - Corrected runtime/deployment identity: `r134 / 134` pinned to Apps Script version `134`.
  - `ENABLE_PROPERTY_CLEANUP_TOOLS = true`.
  - `MAX_PROPERTY_DELETE_BATCH = 500`.
  - No confirmed property deletion executed during deployment phase.
  - No sheet row mutation authorized.
  - No email sends authorized.
  - No trigger install/remove/update authorized.
  - Apps Script version `132` created with description `r132: script properties cleanup containment`.
  - Apps Script version `133` created with diagnostic wrappers but stale `r132 / 132` runtime identity.
  - Apps Script version `134` created with description `r134: script properties cleanup containment with diagnostics`.
  - Admin deployment pinned to `@134`.
  - Student deployment pinned to `@134`.
  - Admin whoami: `r134 / 134`, mismatch `false`.
  - Student whoami: `r134 / 134`, mismatch `false`.
  - Admin RPC registry includes diagnostic wrapper functions: PASS.
  - Confirmed cleanup remains blocked until wrapper dry-run output is manually reviewed.
  - Inventory RPC execution: MANUAL REQUIRED (`clasp run admin_getPropertyInventorySummary` denied by Apps Script execution permissions).
  - Dry-run cleanup execution: MANUAL REQUIRED (`clasp run admin_cleanupEphemeralCommunicationProperties` unavailable from current CLI execution path).
  - Confirmed cleanup remains blocked until inventory and dry-run output are manually reviewed.
  - r131 deployed for stabilization freeze and property containment.
  - `SYSTEM_STABILIZATION_MODE = true`.
  - `ENABLE_AUTOMATED_STAGE_RUNNER = false`.
  - `ENABLE_PRODUCTION_EMAIL_SENDS = false`.
  - `ENABLE_TRIGGER_EMAIL_SENDS = false`.
  - No trigger creation/update/delete authorized in source implementation.
  - No sheet data mutation scripts authorized.
  - Apps Script version `131` created with description `r131: stabilization freeze and property containment`.
  - Admin deployment pinned to `@131`.
  - Student deployment pinned to `@131`.
  - Admin whoami: `r131 / 131`, mismatch `false`.
  - Student whoami: `r131 / 131`, mismatch `false`.
  - Admin portal HTTP load: PASS.
  - Admin RPC registry includes `admin_getPropertyInventorySummary`: PASS.
  - Trigger safe-noop runtime execution: MANUAL REQUIRED (`clasp run automatedStageBatchRunner` denied by Apps Script permissions).
  - Property inventory RPC runtime execution: MANUAL REQUIRED (`clasp run admin_getPropertyInventorySummary` denied by Apps Script permissions).
  - Deployment Execute as / Access settings: MANUAL REQUIRED from Apps Script deployment UI.
  - r130 deployed and verified.
  - r112 behavior restored with campaign alias lookup diagnostic-only so `GmailApp.sendEmail` is the runtime test.
  - Files changed: `Code.js`, `Utils.js`, `Config.js`, `CURRENT_TASK.md`.
  - Admin deployment pinned to `@130`.
  - Student deployment pinned to `@130`.
  - Admin whoami: `r130 / 130`, mismatch `false`.
  - Student whoami: `r130 / 130`, mismatch `false`.
  - Tag pushed: `staging-as130`.

## Files In Scope

- `Admin.js`
- `Code.js`
- `Config.js`
- `CURRENT_TASK.md`

## Current Authority

- GitHub repo: `Sanjaymlckia/FODE_Runtime_1wog`
- Local repo: `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog`
- Home-machine authoritative repo: `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog`
- `C:\FODE_Runtime_1wog` must not be used.
- Any legacy references to `C:\FODE_Runtime_1wog` are historical only.
- Script ID: `1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90`
- Baseline: `r128 / 128` live before r129 release.
- Admin deployment: `@129` live.
- Student deployment: `@129` live.

## r125 Acceptance State

- Manual UI send: PASS.
- Send path: PASS.
- `automatedStageBatchRunner()`: PASS.
- Automation trigger: active.
- Preview timeout remains the current issue.

## r126 Objective

- Align Stage Batch Preview client timeout with Stage Batch Send timeout.
- Stage Batch Preview timeout: `180000` ms.
- Stage Batch Send timeout remains `180000` ms.
- No server logic changes.
- No automation logic changes.
- No batch size changes.

## r126 Release State

- `clasp push --force`: PASS.
- Apps Script version: `126` created with description `r126: increase stage preview timeout`.
- Canonical Admin deployment repinned to `@126`: PASS.
- Canonical Student deployment repinned to `@126`: PASS.
- Admin whoami: `r126 / 126`, mismatch `false`.
- Student whoami: `r126 / 126`, mismatch `false`.
- Browser/UI acceptance: pending manual verification.

## r127 Objective

- Introduce cursor-based scanning in the existing `collectStageBatchCohort_` scanner.
- Remove repeated full-sheet scans by starting each run from a persisted stage/message cursor.
- Persist the next cursor after each scan and wrap to row `2` after the sheet end.
- Stop scan when the batch is found or `SCAN_TIME_BUDGET_MS` is reached.
- Keep automated runner on the existing `collectStageBatchCohort_` path.
- Enable future batch scaling without changing batch size in r127.

## r127 Acceptance Targets

- Admin and Student whoami report `r127 / 127`.
- Preview Cohort completes in under 20 seconds.
- No preview timeout.
- Logs show `AUTO_STAGE_CURSOR_UPDATE`.
- Trigger durations drop significantly.

## r127 Release State

- `clasp push --force`: PASS.
- Apps Script version: `127` created with description `r127: cursor scan optimization`.
- Canonical Admin deployment repinned to `@127`: PASS.
- Canonical Student deployment repinned to `@127`: PASS.
- Admin whoami: `r127 / 127`, mismatch `false`.
- Student whoami: `r127 / 127`, mismatch `false`.
- Browser/UI preview acceptance: pending manual verification.
- Trigger duration acceptance: pending runtime observation.

## r128 Objective

- Capture actual Gmail send failure reasons in the existing failed-send recording path.
- Populate `Email_Bounce_Flag` using `classifySendFailure_`.
- Populate `Email_Bounce_Reason` with the first 200 characters of the actual send error.
- r128 captures send failure reason only; no bounce mailbox scan yet.
- No sender changes.
- No trigger changes.
- No batch size changes.
- No Admin UI, Admin.js, or cursor changes.

## r128 Release State

- `clasp push --force`: PASS.
- Apps Script version: `128` created with description `r128: capture send failure reason`.
- Canonical Admin deployment repinned to `@128`: PASS.
- Canonical Student deployment repinned to `@128`: PASS.
- Admin whoami: `r128 / 128`, mismatch `false`.
- Student whoami: `r128 / 128`, mismatch `false`.
- Runtime batch acceptance: pending; no batch was run in this session.

## r129 Objective

- Exclude non-sendable `FAILED` rows from future send batches.
- `FAILED` rows with `Email_Bounce_Flag` `HARD`, `DOMAIN`, or `UNKNOWN` are excluded.
- `FAILED` rows whose `Email_Bounce_Reason` contains `Missing required alias` are excluded.
- `TEMP` failures remain retryable only when `Email_Next_Action_Date` is due.
- SENT rows remain skipped at scan level.
- No sender identity change.
- No trigger change.
- No batch size change.
- No bounce mailbox scan.

## r129 Release State

- `clasp push --force`: PASS.
- Apps Script version: `129` created with description `r129: exclude non-sendable failed rows`.
- Canonical Admin deployment repinned to `@129`: PASS.
- Canonical Student deployment repinned to `@129`: PASS.
- Admin whoami: `r129 / 129`, mismatch `false`.
- Student whoami: `r129 / 129`, mismatch `false`.
- Runtime acceptance: pending; no batch was run in this session.

## r124 Finding

Manual UI send of 10 reached the backend, but the Admin client timed out at 20 seconds and discarded the late success response. No runner rework is authorized for r125.

## r125 Trigger Function Finding

- Correct time-driven trigger function: `automatedStageBatchRunner`.
- `automatedStageBatchRunner` is a top-level Apps Script function and calls `runAutomatedStageBatchWithLock_({ source: "TRIGGER" })`.
- Trigger install/status logic uses `getAutomatedStageRunnerTriggerFunctionName_()`, which returns `automatedStageBatchRunner`.
- Status only counts triggers whose handler function is exactly `automatedStageBatchRunner`; a trigger set to `admin_runAutomatedStageBatchOnce` would not be counted by status.
- Recommendation: delete any trigger using `admin_runAutomatedStageBatchOnce` and create exactly one time-driven trigger for `automatedStageBatchRunner`.

## CURRENT_TASK AUTHORITY RULES

- `CURRENT_TASK.md` is authoritative runtime state.
- It MUST be updated whenever:
  - `VERSION` changes.
  - Deployment changes.
  - Trigger status changes.
  - Automation status changes.
- Do not treat `CURRENT_TASK.md` as stale without updating it.
- Do not repeatedly halt execution due to stale `CURRENT_TASK.md`.
- If the user excludes it, explicitly note it is stale.

## Next Exact Step

r136 full dry-run wrapper acceptance only; do not run confirmed cleanup until visible dry-run evidence is reviewed.

## Cautions

- Do not increase automation batch size above 10 in r129.
- Do not change Gmail/send pipeline logic.
- Do not run bounce mailbox scan.
- Do not change Sheet schema.
- Do not change Drive logic.
- Do not rewrite server batching or automated runner logic.
- Do not install/delete/edit triggers until explicitly instructed.
- No commit/tag until all acceptance evidence is confirmed.
- Treat live `whoami` as runtime truth.
- Rollback prefers repinning Admin and Student to r124; if a trigger was installed, remove or disable the `automatedStageBatchRunner` trigger.
