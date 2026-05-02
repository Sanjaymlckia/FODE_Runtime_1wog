# FODE Email Logic and Redundancy Audit r114

Authority for this audit: CIS "FODE Email Logic Audit, Daily Cap 500, and End-to-End Redundancy Report".

Authoritative repo path from `CURRENT_TASK.md`: `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog`.

Release actions are out of scope. This report is based on local source inspection of `Config.js`, `Code.js`, `Admin.js`, and `Utils.js` only.

## Executive Summary

- Daily automated email cap was found in one authoritative location: `CONFIG.DAILY_SEND_CAP`.
- The cap is internal to the dormant automated stage runner and was changed from `300` to `500`.
- `ENABLE_AUTOMATED_STAGE_RUNNER` remains `false`; this CIS does not enable automation or install triggers.
- Stage/campaign Gmail sends still enforce `From: fode_kia@kundu.ac` through `requiredSystemSenderAlias_()` and `Reply-To: fode@kundu.ac` through `requiredSystemReplyTo_()`.
- Stage preview/send parity remains intact: send requires a matching cached preview request, stage, limit, offset, message type, candidate IDs, and candidate hash.
- Bounce ingestion remains disabled by config unless forced through admin tooling; hard/invalid/blocked bounces set `Email_Bounce_Flag=YES` and `Email_Status=BOUNCED`, which blocks future stage/campaign sends.
- CRM helpers remain present but dormant or dry-run guarded by config; no live CRM wiring was enabled.

## Cap Change

Pre-change cap:

- `Config.js`: `DAILY_SEND_CAP: 300`

Post-change cap:

- `Config.js`: `DAILY_SEND_CAP: 500`

Runtime use:

- `getRemainingDailySendAllowance_()` reads `CONFIG.DAILY_SEND_CAP`.
- `incrementDailySendCount_()` also reads `CONFIG.DAILY_SEND_CAP`.
- `runAutomatedStageBatchChunk_()` clamps per-run work to remaining daily allowance.
- The daily counter increments only after successful sends.

No conflicting daily cap was found. Other limits are batch or scan limits, not daily send caps:

- `MAX_STAGE_BATCH_SIZE: 30`
- `DEFAULT_STAGE_BATCH_SIZE: 20`
- `PER_RUN_BATCH_SIZE: 20`
- `MAX_PER_RUN_BATCH_SIZE: 25`
- `CAMPAIGN_BATCH_SIZE_DEFAULT: 50`
- `BOUNCE_INGESTION_MAX_MESSAGES: 200`

## End-to-End System Flow

1. Intake
   - `doPost(e)` handles intake activation unless `view=portalupload` or `action=portal_update`.
   - Intake prepares ApplicantID, folder state, activated row state, and PortalSecrets state.

2. Activation
   - Activation writes the applicant row, portal token/hash metadata, folder URL fields, and PortalSecrets active secret state.
   - Activation may call downstream hooks, but CRM behavior remains gated.

3. Portal
   - `doGet(e)` routes blank Student deployment requests to `renderPortalAppFromDoGet_`.
   - Portal update posts use `action=portal_update` and call `handlePortalUpdate_`.
   - Portal login/update/upload paths validate ApplicantID and portal secret before mutation.

4. Admin Review
   - Admin deployment blank route or `view=admin` loads `renderAdminApp_`.
   - Admin RPCs cover applicant search/detail, docs status, payment verification, portal access, portal link reset, stage aggregation, batch preview/send, bounce tools, and automated runner controls.

5. Stage Preview
   - `admin_previewStageBatch()` resolves the stage, message type, candidate set, PortalSecrets lookup, and cooldown lookup.
   - It stores preview candidate IDs and candidate hash in user cache.
   - It does not send email.

6. Stage Send
   - `admin_sendStageBatch()` requires explicit confirmation and a matching preview snapshot.
   - It sends only the cached candidate IDs from the approved preview.
   - It calls `sendApplicantMessage_()` per candidate, which resolves current eligibility again before dispatch.

7. Gmail Send and Logs
   - `dispatchApplicantMessage_()` calls `campaignSendEmailGmail_()`.
   - `campaignSendEmailGmail_()` checks Gmail aliases, sends via `GmailApp.sendEmail`, and logs begin/end status.
   - On success, `dispatchApplicantMessage_()` patches row email state and records communication tracking.
   - On failure, it records a failed contact outcome and does not patch `Email_Status=SENT`.

8. Bounce and Logs
   - `ingestRecentBounces_()` is config-gated by `ENABLE_BOUNCE_INGESTION` unless forced by admin.
   - It searches Gmail delivery failure messages, classifies bounces, patches matched applicant rows, and logs a summary.

9. CRM Mirror
   - CRM payload builders, Zoho token refresh, contact upsert, and deal upsert helpers exist.
   - The active FODE CRM pipeline flag is disabled.
   - Payment-verified workflows currently log dry-run CRM payloads when configured; they do not perform live Zoho upserts unless separately wired and enabled.

## Email Logic Flow Diagram

```text
Admin UI
  -> admin_previewStageBatch
  -> collectStageBatchCohort
  -> resolveApplicantMessageContextFromRow
  -> bounce/cooldown/portal-secret eligibility checks
  -> preview cache: stage + limit + offset + messageType + candidateIds + candidateHash

Admin UI confirm send
  -> admin_sendStageBatch
  -> preview parity gate
  -> sendApplicantMessage per cached ApplicantID
  -> resolveApplicantMessageContext again
  -> buildApplicantMessage
  -> campaignSendEmailGmail
  -> GmailApp.sendEmail(from=fode_kia@kundu.ac, replyTo=fode@kundu.ac)
  -> applyPatch Email_Status/Email_Last_Sent_At/Email_Attempt_Count
  -> setLastCommunicationSentAt
  -> recordApplicantContactOutcome
```

## Email Path Inventory

### Stage preview

- Entrypoint: `admin_previewStageBatch`.
- Uses `collectStageBatchCohort_`, `deriveCommunicationState_`, `resolveApplicantMessageContextFromRow_`, `buildPortalSecretPreviewLookup_`, and `buildCommunicationCooldownPreviewLookup_`.
- Enforces bounce flag, invalid email, do-not-contact, cooldown, already-submitted portal, missing secret, inactive secret, and stage/message type rules.
- Writes only preview cache; it does not send email or patch applicant email status.

### Stage send

- Entrypoint: `admin_sendStageBatch`.
- Requires `confirmSend=true`.
- Requires preview snapshot match for stage, limit, offset, message type, request ID, candidate count, candidate IDs, and candidate hash.
- Sends only preview candidate IDs.
- Re-resolves each candidate through `sendApplicantMessage_()`.

### Gmail alias selection and sender enforcement

- `requiredSystemSenderAlias_()` returns `fode_kia@kundu.ac`.
- `assertRequiredSystemSenderAlias_()` calls `GmailApp.getAliases()` and fails if the alias is missing.
- `campaignSendEmailGmail_()` calls `assertRequiredSystemSenderAlias_()` before `GmailApp.sendEmail`.
- Stage/campaign Gmail send uses `from: fode_kia@kundu.ac`.

### Reply-To enforcement

- `requiredSystemReplyTo_()` returns `fode@kundu.ac`.
- `campaignSendEmailGmail_()` passes `replyTo: fode@kundu.ac`.
- `adminSendEmail_()` uses `CONFIG.EMAIL_REPLY_TO` or caller-supplied `replyTo` for its MailApp/GmailApp paths.
- Direct payment-verified MailApp sends use `CONFIG.EMAIL_REPLY_TO`.
- Existing best-effort alert helper `sendEmailBestEffort_()` does not set `replyTo`; this is pre-existing behavior and is not part of the stage/campaign Gmail path.

### Message template construction

- `buildApplicantMessage_()` maps:
  - `legacy_invite` -> campaign invite subject/body.
  - `reminder` -> reminder subject/body.
  - `docs_missing` -> missing-docs subject/body.
  - `payment_followup` -> payment follow-up subject/body.
- `previewApplicantMessage_()` and `sendApplicantMessage_()` use the same context resolver and message builder.

### Gmail send

- `campaignSendEmailGmail_()` logs `GMAIL_ALIAS_LOOKUP_BEGIN`, `GMAIL_ALIAS_LOOKUP_END`, `GMAIL_SEND_BEGIN`, and `GMAIL_SEND_END`.
- Gmail failures are caught and returned as `{ ok:false }`.
- Failed sends do not increment the automated daily send counter.
- Failed sends do not patch `Email_Status=SENT`.

### Gmail patch / record update

- After successful Gmail send, `dispatchApplicantMessage_()` patches:
  - `Email_Status: SENT`
  - `Email_Last_Sent_At`
  - `Email_Attempt_Count`
  - `Email_Next_Action_Date`
  - `Email_Campaign_Batch` when available
- It logs `GMAIL_PATCH_BEGIN` and `GMAIL_PATCH_END`.
- It records communication tracking through `setLastCommunicationSentAt_()` and `recordApplicantContactOutcome_()`.

### Bounce ingestion and classification

- `ingestRecentBounces_()` is gated by `CONFIG.ENABLE_BOUNCE_INGESTION === true` unless an admin force path calls it.
- It scans Gmail delivery failure messages and classifies:
  - `INVALID`
  - `BLOCKED`
  - `TEMPORARY`
  - `HARD`
  - `NONE`
- Hard, invalid, or blocked bounces patch `Email_Bounce_Flag=YES`, `Email_Bounce_Reason`, and `Email_Status=BOUNCED`.
- Temporary bounces update reason/next action date without setting the permanent bounce flag.
- Future stage/campaign eligibility blocks rows with `Email_Bounce_Flag`.

### Cooldown / duplicate prevention

- `deriveCommunicationState_()` resolves last send timestamps by applicant and message type.
- `resolveApplicantMessageContextFromRow_()` blocks `COOLDOWN_ACTIVE`.
- `stageBatchShouldExcludePriorSuccessDefault_()` excludes prior successful sends for the same stage/message family.
- `hasPriorSuccessfulMessageSend_()` prevents blocked re-processing from overwriting prior success tracking.

### Daily cap enforcement

- `DAILY_SEND_CAP` is read dynamically from `CONFIG`.
- `runAutomatedStageBatchChunk_()` checks remaining daily allowance before selecting candidates.
- Effective run size is clamped to per-run batch size, max per-run size, stage max, and remaining daily allowance.
- Daily count is incremented only after successful sends.

### Automated runner gating

- `ENABLE_AUTOMATED_STAGE_RUNNER` remains `false`.
- `shouldRunAutomatedStageBatch_()` returns `AUTOMATION_DISABLED` unless the flag is true or a caller forces the run.
- This CIS did not enable automated sending.
- This CIS did not install triggers.

## Required Email Verdicts

- `From` for stage/campaign Gmail sends: PASS, enforced as `fode_kia@kundu.ac`.
- `Reply-To` for stage/campaign Gmail sends: PASS, enforced as `fode@kundu.ac`.
- Preview/send candidate parity: PASS, send requires the cached preview snapshot and candidate hash.
- Send path bypasses preview snapshot: NO, stage batch send requires preview parity.
- Bounce suppression prevents future unsafe sends where applicable: PASS for hard/invalid/blocked bounce rows.
- Logs: PASS for stage send start, candidate begin/end, Gmail alias lookup, Gmail begin/end, patch begin/end, blocked, sent, failed, and bounce summary.

## CRM Integration Status

### Current state

- `ENABLE_FODE_CRM_PIPELINE` is `false`.
- `CRM_PUSH_DRY_RUN` is `true`.
- Zoho token/contact/deal helpers exist but are not actively wired into the payment save flow under current flags.

### Intended model found in code

- Payer/contact model:
  - `buildCrmPayloadFromRow_()` maps applicant identity, parent email, corrected email, parent phone, grade, subjects, folder URL, and FormID.
  - `upsertZohoContact_()` upserts a Zoho Contact using email/phone duplicate checks.

- Enrolment/deal model:
  - `upsertZohoDeal_()` upserts a Zoho Deal with pipeline/stage, contact linkage, folder description, and FormID/ApplicantID duplicate field.
  - `deriveFodeCrmStageFromRow_()` maps payment/admission state to CRM stages.
  - `shouldCreateFodeCrmDeal_()` requires admission-granted state and no existing Deal_ID.
  - `shouldCreateFodeCrmInvoice_()` requires an existing Deal_ID and no prior invoice trigger.

### Exact hooks found

- `getZohoToken_()`
- `upsertZohoContact_()`
- `upsertZohoDeal_()`
- `buildCrmPayloadFromRow_()`
- `deriveFodeCrmStageFromRow_()`
- `shouldCreateFodeCrmDeal_()`
- `shouldCreateFodeCrmInvoice_()`
- `triggerCrmDealForFode_()`
- `syncFodeCrmStage_()`
- `crm_syncOnPaymentVerified_()`
- `handlePaymentVerifiedTrigger_()` dry-run CRM logging branch

### Missing wiring

- `crm_syncOnPaymentVerified_()` is defined but no active caller was found.
- `triggerCrmDealForFode_()` and `syncFodeCrmStage_()` return gated metadata and do not call Zoho under disabled config.
- Live invoice trigger remains separately gated by `INVOICE_TRIGGER_ENABLED`.
- No schema changes were introduced and no CRM enablement was performed.

## Redundant Code Inventory

| Surface | Examples | Classification | Reason |
| --- | --- | --- | --- |
| Browser base64 upload path | `portalUploadBase64`, `portalUpload_handleBase64_` | KEEP | Current portal UI uses base64 RPC style and has detailed validation/logging. |
| Legacy google.script.run upload path | `uploadPortalFile` | CONSOLIDATE | Older path duplicates base64 upload behavior but may still be referenced by legacy UI code. |
| Multipart POST upload path | `doPost view=portalupload`, `portal_uploadMultipart_` | QUARANTINE | Useful for recovery and browser fallback, but duplicates normal upload flow. |
| Shared upload save helpers | `savePortalUpload_`, `applyPortalUploadSheetUpdate_`, Drive API helpers | KEEP | Shared lower-level behavior should remain centralized. |
| Stage messaging wrappers | `admin_previewStageBatch`, `admin_sendStageBatch` | KEEP | Current controlled send path with preview parity. |
| Single applicant messaging wrappers | `admin_previewApplicantMessage`, `admin_sendApplicantMessage` | KEEP | Useful targeted admin path, reuses same resolver/send helpers. |
| Legacy campaign wrappers | `admin_campaignPrepareLegacyRows`, `admin_campaignSendLegacyBatch`, `admin_campaignSendLegacyFollowups`, `campaign_sendLegacyBatch_` | QUARANTINE | Older wrappers overlap with stage/applicant messaging but may be needed for recovery. |
| Campaign response/bounce wrappers | `campaign_syncResponses_`, `campaign_processBounces_`, `admin_runBounceScan` | CONSOLIDATE | Bounce ingestion is still useful, but naming and wrappers overlap. |
| Dormant CRM helpers | Zoho token/contact/deal helpers, CRM stage helpers | QUARANTINE | Not active under current flags; retain until CRM model is approved. |
| Payment/invoice hooks | `handlePaymentVerifiedTrigger_`, `handleInvoiceTrigger_` | KEEP | Active payment workflow guardrails depend on these, though CRM side remains dry-run/gated. |
| Diagnostic routes | `diag`, `driveprobe`, `drivedeepprobe`, `driveapiprobe`, smoke routes | QUARANTINE | Useful for controlled diagnostics but should not be treated as product surface. |
| Test/probe functions | `test_Smoke`, `test_LogSheetWrite`, `testCampaignGmailAuth`, `adminDryRunFirst50LegacyInvites` | SAFE REMOVE LATER | Not runtime-critical; remove only after a dedicated cleanup CIS confirms no operator dependency. |
| Legacy portal secret direct helpers | `openPortalSecrets_`, `findPortalSecretsRowByApplicantId_`, `getOrCreateActivePortalSecret_`, `syncPortalSecretsActive_` | CONSOLIDATE | Phase 1-2 normalized most read/reset paths, but backfill/export/activation still use legacy helpers by design. |

## Recommended Cleanup Phases

1. Email identity audit patch
   - Decide whether non-stage MailApp alert paths must also enforce `Reply-To: fode@kundu.ac`.
   - Decide whether every outbound path must use Gmail alias `fode_kia@kundu.ac`, or only stage/campaign sends.

2. Upload surface consolidation
   - Inventory live UI references to base64, legacy RPC, and multipart upload paths.
   - Select one primary upload path.
   - Quarantine or remove unused upload entrypoints only after browser evidence.

3. Campaign wrapper quarantine
   - Keep stage preview/send as canonical.
   - Restrict legacy campaign wrappers to operator-only recovery, or remove after confirming no UI references.

4. CRM wiring decision
   - Confirm payer/contact and enrolment/deal model.
   - Decide whether Zoho CRM remains dry-run, becomes manually triggered, or is wired to payment/admission state transitions.

5. Diagnostics cleanup
   - Separate safe read-only diagnostics from mutation-capable tests.
   - Remove or hide test/probe functions only under a dedicated CIS.

## Release Risk Notes

- The cap change does not enable automated sending.
- The cap change does not alter batch size.
- The cap change does not alter sender, Reply-To, URL, template, bounce, or CRM logic.
- Existing non-stage MailApp paths have mixed sender semantics because MailApp does not use the campaign Gmail alias path. This is unchanged and should be handled only if a future CIS mandates global sender normalization.

## Rollback

Revert `Config.js` daily cap from `500` back to `300` and delete this report if needed. No deployment rollback is required unless these local changes are later released.
