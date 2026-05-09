# Current Task

## Current Objective

 Maintain `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog` as the authoritative FODE Runtime repo during S2B Semantic Stabilization and Rollback Verification, with r148 still the documented runtime baseline.

## Current Issue

- r148 adds a SUPER-admin, read-only WhatsApp fallback CSV export queue for invalid/missing/bounced/blocked email records with valid PNG mobile numbers.
- r148 does not send WhatsApp, SMS, or email; it only returns CSV content for operator review/download.
- r148 does not change send-path, email eligibility, bounce writeback, trigger cadence, automation, Books/CRM integration, Sheet schema, or Drive files.
- PortalUrl uses existing active portal secrets only via the canonical student portal builder. Missing existing secrets leave `PortalUrl` blank and set `PortalUrlStatus = MISSING_SECRET`.
- r148 Apps Script platform version `146` created with description `r148: add WhatsApp fallback export queue`.
- Admin deployment pinned to platform version `146`.
- Student deployment pinned to platform version `146`.
- Admin whoami: `r148 / 148`, mismatch `false`, script ID `1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90`.
- Student whoami: `r148 / 148`, mismatch `false`, script ID `1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90`.
- Admin `?view=admin` HTML includes WhatsApp Fallback Queue controls, no-send/no-group warnings, and `admin_exportWhatsAppFallbackCsv`: PASS.
- Browser/operator acceptance remains required before git push: export batch size 20, inspect first 5 CSV rows, confirm `675XXXXXXXX` phones, link/message correctness, no automatic send, and no row mutation.
- S1 stabilization baseline audit active.
- S1 scope is documentation-only baseline creation before CRM cleanup or workflow refactors.
- S2B semantic stabilization and rollback verification active.
- S2B scope is small controlled stabilization work only.
- Trigger deleted by operator.
- No trigger recreation is authorized in S1 or S2B.
- r147 hardens bounce correlation to prefer explicit applicant-id tokens and unique recipient matches, while skipping ambiguous DSNs.
- r147 keeps send-path, batch-send, trigger cadence, automation, and eligibility logic unchanged.
- r147 Safe Bounce Correlation is deployed to live Admin and Student runtimes.
- Live runtime truth from canonical `?view=whoami`: Admin `r147 / 147`, mismatch `false`; Student `r147 / 147`, mismatch `false`.
- Apps Script platform version: `145`.
- Latest stable runtime commit: `e69256e` (`r147: harden bounce correlation safety`).
- Canonical Admin and Student URLs are preserved as `https://script.google.com/macros/s/<DEPLOYMENT_ID>/exec`.
- r147 bounce correlation is hardened and validated.
- Trigger visibility is repaired.
- Bounce visibility is repaired.
- Automation is operational.
- Trigger cadence is currently operator-controlled; no cadence change is authorized by this CIS.
- Admin bounce UI now surfaces matched, ambiguous, and unmatched bounce scan results plus latest bounce reason/classification.
- Manual bounce scan remains gated to matched-unique writeback only; ambiguous DSNs must be skipped.
- CLI execution of `admin_runBounceScan` remains blocked by Apps Script execution permissions from this session.
- Manual browser/operator confirmation of bounce scan output remains required before final release closure.
- Stabilization phase active.
- Trigger freeze active.
- Production email freeze active.
- May 5 sheet restore completed.
- r136 property cleanup accepted: `COMM_LAST::*` reduced to `0`; final Script Properties count `6`; protected/non-matching keys preserved.
- r137 hardening replaces hidden/unbounded `COMM_LAST::*` cooldown behavior with bounded `CacheService` state.
- `COMM_LAST::*` must never be recreated by email cooldown logic.
- Script Properties policy: keep only bounded config, cursors, locks, deployment/runtime metadata, and explicitly protected operational state.
- Bounded-state doctrine: ephemeral communication state belongs in TTL cache or observable sheet-backed durable truth, not unbounded Script Properties.
- Observability-first doctrine: email gates, trigger state, property health, last automation run, last batch ID, and last blocked reason must be visible in Admin UI via RPC.
- No hidden unbounded operational state is permitted.
- No unattended production sends permitted during stabilization.
- r138 is manual-send probe only.
- Batch sends remain frozen.
- Trigger sends remain frozen.
- Automated stage runner remains frozen.
- No automation restart is authorized.
- Replay-safe manual single-send verification is in progress.
- Production email restart beyond one controlled manual applicant send is not authorized in r138.
- r138 Apps Script version `138` created with description `r138: manual single-send probe`.
- Admin deployment pinned to `@138`.
- Student deployment pinned to `@138`.
- Admin whoami: `r138 / 138`, mismatch `false`.
- Student whoami: `r138 / 138`, mismatch `false`.
- Admin `?view=admin` HTML includes manual probe mode, last manual send, last manual recipient, last manual result, idempotency active, and explicit manual send confirmation wiring: PASS.
- CLI execution of `admin_getOperationalSafetyStatus` remains blocked by Apps Script execution permissions.
- Manual browser/operator acceptance still required: one controlled manual send, replay attempt, post-send property count, `COMM_LAST::* = 0`, and no automation activity.
- r138 manual acceptance completed and finalized with tag `staging-as138`.
- r139 is preview-only validation.
- No live batch sends are authorized.
- No trigger activation is authorized.
- Automated stage runner remains frozen.
- Replay-safe batch preview validation is in progress.
- r139 Apps Script version `139` created with description `r139: manual batch preview validation`.
- Admin deployment pinned to `@139`.
- Student deployment pinned to `@139`.
- Admin whoami: `r139 / 139`, mismatch `false`.
- Student whoami: `r139 / 139`, mismatch `false`.
- Admin `?view=admin` HTML includes preview diagnostics fields for selected stage, candidate count, blocked count, already processed, limit applied, preview batch ID, and replay protection: PASS.
- CLI execution of `admin_previewStageBatch` remains blocked by Apps Script execution permissions.
- Manual browser/operator acceptance still required: same preview twice with matching candidate count/order/replay summary, no emails, no sheet mutation, no trigger activity, `COMM_LAST::* = 0`, and bounded property count.
- r140 fixes preview timeout caused by r139 deterministic row-2 scan risk and the stale 20-second preview client timeout.
- r140 preview is bounded/read-only and may use the existing stage cursor as a non-mutating start hint.
- r140 preview scans at most `BATCH_PREVIEW_SCAN_ROW_CAP` rows and may return `partial=true` with `partialReason=PREVIEW_WINDOW_EXHAUSTED`.
- r140 Apps Script version `140` created with description `r140: preview timeout containment`.
- Admin deployment pinned to `@140`.
- Student deployment pinned to `@140`.
- Admin whoami: `r140 / 140`, mismatch `false`.
- Student whoami: `r140 / 140`, mismatch `false`.
- Admin `?view=admin` HTML includes `STAGE_BATCH_PREVIEW_TIMEOUT_MS`, rows scanned, scan window, and partial reason diagnostics: PASS.
- Manual browser/operator acceptance still required: `INVITE_PENDING` preview size 10 twice, no timeout, same window/order/count, no emails, no sheet mutation, no trigger activity, `COMM_LAST::* = 0`, and bounded property count.
- r141 local preview fallback fix in progress: preview-only scan can continue across subsequent read-only bounded windows when the first window returns zero candidates.
- r141 local fix must not write cursor, Script Properties, sheet rows, triggers, or emails.
- r141 local fix is not deployed; no Apps Script push/version/deploy is authorized in this CIS.
- Batch sends remain frozen.
- Trigger sends remain frozen.
- Automated stage runner remains frozen.
- No live batch send, trigger activation, sheet mutation, or email send is authorized in r140.
- r137 Apps Script version `137` created with description `r137: email state architecture hardening`.
- Admin deployment pinned to `@137`.
- Student deployment pinned to `@137`.
- Admin whoami: `r137 / 137`, mismatch `false`.
- Student whoami: `r137 / 137`, mismatch `false`.
- Admin RPC registry includes `admin_getOperationalSafetyStatus`: PASS.
- Admin `?view=admin` HTML includes Runtime Safety, Property Health, and Email Pipeline Status panels: PASS.
- CLI execution of `admin_getOperationalSafetyStatus` and `admin_getPropertyInventorySummary` remains blocked by Apps Script execution permissions.
- Browser/operator confirmation of populated panel values and live property counts: MANUAL REQUIRED before git commit/tag finalization.
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
  - Confirmed cleanup later accepted by operator: `COMM_LAST::*` reduced from `802` to `0`; final Script Properties count `6`.
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
  - r136 confirmed cleanup completed and accepted before r137 planning.
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
  - r136 confirmed cleanup completed and accepted; no further Script Properties deletion is authorized in r137.
  - Inventory RPC execution: MANUAL REQUIRED (`clasp run admin_getPropertyInventorySummary` denied by Apps Script execution permissions).
  - Dry-run cleanup execution: MANUAL REQUIRED (`clasp run admin_cleanupEphemeralCommunicationProperties` unavailable from current CLI execution path).
  - r136 inventory and dry-run review completed before accepted cleanup; no further Script Properties deletion is authorized in r137.
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
- `AdminUI.html`
- `Config.js`
- `CURRENT_TASK.md`

## Current Authority

- GitHub repo: `Sanjaymlckia/FODE_Runtime_1wog`
- Local repo: `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog`
- Home-machine authoritative repo: `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog`
- Active authoritative local repo for this session: `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog`
- Any legacy references to other local checkout paths are historical only.
- Script ID: `1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90`
- Baseline: `r128 / 128` live before r129 release.
- Admin runtime: `r148 / 148`, mismatch `false`.
- Student runtime: `r148 / 148`, mismatch `false`.
- Apps Script platform version: `146`.
- Latest local runtime commit pending browser acceptance/git push: `r148: add WhatsApp fallback export queue`.
- Canonical Admin URL preserved: `https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec`.
- Canonical Student URL preserved: `https://script.google.com/macros/s/AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv/exec`.

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

Complete S2B rollback verification addendum and semantic stabilization planning docs, preserve runtime as read-only, keep trigger state dormant/deleted, and do not perform deploy actions, schema mutation, CRM deletion, or trigger recreation in this CIS. r148 browser/operator acceptance remains pending.

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
- r141 is not deployed. Runtime rollback is not expected; if later deployed and rejected, repin Admin and Student to the last accepted baseline and verify whoami.

## Handoff Update - 2026-05-08 14:32:01

- Machine: DESKTOP-9J8KA0T
- Project: FODE_RUNTIME
- Path: E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog
- Current status: Status:
- Next exact step: Office session stabilized FODE repo authority to E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog. r148 deployed; browser/operator acceptance still pending. No runtime changes pending.
- Risks/blockers:
- Files modified: Next exact step:
- Release state: At home, open CodexHub, select FODE Runtime, confirm CURRENT_TASK.md, git status, and continue r148 browser/operator acceptance. Do not push until acceptance passes.

### Git Status

```text
## main...origin/main [ahead 1]
```

## Handoff Update - 2026-05-08 14:33:43

- Machine: DESKTOP-9J8KA0T
- Project: FODE_RUNTIME
- Path: E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog
- Current status: Status:
- Next exact step: Office session stabilized FODE repo authority to E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog. r148 deployed; browser/operator acceptance still pending. No runtime changes pending.
- Risks/blockers:
- Files modified: Next exact step:
- Release state: At home, open CodexHub, select FODE Runtime, confirm CURRENT_TASK.md, git status, and continue r148 browser/operator acceptance. Do not push until acceptance passes.

### Git Status

```text
## main...origin/main [ahead 1]
 M CURRENT_TASK.md
```
