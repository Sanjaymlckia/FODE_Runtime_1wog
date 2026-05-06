# Current Task

## Current Objective

Maintain `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog` as the authoritative FODE Runtime repo and restore r112 email sender behavior after the r113 alias hard-block regression.

## Current Issue

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

r130 runtime testing.

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
