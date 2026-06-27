# FODE Runtime Entrypoint and Portal Secret Audit

Authority for this audit: CIS "FODE Runtime Phase 1-2 Cleanup and Portal Secret Normalization".

Repo path verified from `CURRENT_TASK.md`: `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog`.

Release actions are out of scope. This audit is based only on `Code.js`, `Admin.js`, and `Utils.js`.

## 1. Entrypoints

### doPost intake

- `doPost(e)` in `Code.js` is the main POST entrypoint.
- If `view=portalupload`, it delegates to `doPost_portalUpload_(e)`; the route reference is in scoped code, but the handler definition was not found in the scoped files.
- If `action=portal_update`, it parses/merges portal payloads and delegates to `handlePortalUpdate_`.
- Otherwise it treats the POST as intake activation, prepares ApplicantID/folder/token state, writes the activated row, commits PortalSecrets state, verifies, and may call downstream CRM/intake hooks.

### doGet routes

- `doGet(e)` resolves the route through `resolveDoGetHandler_(view, isAdminDeployment)`.
- Explicit routes referenced in scoped code:
  - `diag` -> `respondDiag_`
  - `whoami` -> `doGet_whoami_`
  - `file` -> `doGet_file_`
  - `admin` -> `renderAdminApp_`
- Blank routes default to Admin app on Admin deployment and Student portal on Student deployment.
- Unknown routes fall back to Admin app on Admin deployment and Student portal on Student deployment.

F2C note: the historical diagnostic/smoke route entries `driveapiprobe`, `drivedeepprobe`, `driveprobe`, `portalsmoke`, and `uploadsmoke` were archived from `resolveDoGetHandler_()` after proof showed no active AdminUI, test, tooling, DR/release, or operator dependency in the repository.

### Admin routes

- Admin UI entrypoint: `renderAdminApp_`.
- Admin RPC surfaces include applicant search/detail, portal link generation/reset, document status updates, portal access, payment verification, docs follow-up, parent email correction, review queues, stage aggregation, stage preview/send, applicant message preview/send, campaign wrappers, bounce scan, automated stage runner controls, portal token backfill, and portal link export.

### Student routes

- Student portal page render: `renderPortalAppFromDoGet_` -> `renderPortalPageResponse_`.
- Portal update: `handlePortalUpdate_`.
- Portal base64 upload: `portalUploadBase64` -> `portalUpload_handleBase64_`.
- Portal legacy Drive upload: `uploadPortalFile`.
- Portal multipart upload: `portal_uploadMultipart_`.
- Portal uploaded-file delete: `portal_deleteUploadedFile`.

### whoami / diagnostics

- Runtime truth builder: `buildRuntimeTruth_`.
- Admin runtime RPC: `admin_getRuntimeInfo`.
- doGet whoami route delegates to `doGet_whoami_`; the implementation is referenced but not present in the scoped files.
- Diagnostics include `diagStatus_`, drive probes, upload/portal smoke routes, `authDrive`, `authDriveYearFolder`, and test helpers.

## 2. Mutation Functions

### Activation

- `doPost(e)` intake path.
- `scanApplicantIdState_`, `nextApplicantId_`.
- `preparePortalActivationState_`.
- `canonicalizeFdIntakeFiles_`.
- `maybeStampActivationSubmitState_`.
- `buildActivatedIntakeRow_`.
- `insertActivatedRowAt_`.
- `commitPortalActivationState_`.
- `verifyActivatedState_`.
- `appendRow_`, `ensurePortalTokenAtRow_`, `setPortalTokenHashForRow_`.

### Portal updates

- `handlePortalUpdate_`.
- `writeBack_`.
- `applyPatch_`.
- `portal_deleteUploadedFile`.
- `maybeNotifyPaymentReceiptUploadTransition_`.
- `sendDocsVerifiedPaymentRequiredEmail_`.
- `notifyAdminPaymentReceiptUploaded_`.

### Uploads

- `portalUploadBase64`.
- `portalUpload_handleBase64_`.
- `uploadPortalFile`.
- `portal_uploadMultipart_`.
- `savePortalUpload_`.
- `applyPortalUploadSheetUpdate_`.
- `driveApiMultipartUpload_`.
- `driveApiUploadBlobToFolder_`.
- `driveApiCreateTextFile_`.

### Admin updates: docs / payments

- `admin_updateDocStatuses`, `admin_updateDocStatuses_impl_`.
- `admin_setOverallStatus`.
- `admin_setPortalAccess`.
- `admin_verifyPayment`, `admin_setPaymentVerified`, `admin_setPaymentVerified_impl_`.
- `admin_updateParentEmailCorrected`.
- `admin_sendDocsFollowupEmails`.
- `runVerificationAutomations_`.
- `handlePaymentVerifiedEmailTriggers_`.
- `handleInvoiceTrigger_`.

### Stage preview / send

- `admin_getStageAggregation`.
- `admin_getReviewQueues`.
- `admin_previewStageBatch`.
- `admin_sendStageBatch`.
- `admin_previewApplicantMessage`.
- `admin_sendApplicantMessage`.
- `admin_planApplicantBatch`.
- `admin_planLegacyInviteBatch`.
- `previewApplicantMessage_`.
- `sendApplicantMessage_`.
- `planApplicantBatch_`.
- `runAutomatedStageBatchChunk_`.
- `runAutomatedStageBatchWithLock_`.
- `runAutomatedStageBatchScheduled`.

### Token / secret reset

- `admin_getPortalLink`.
- `admin_generatePortalLink`.
- `admin_resetPortalSecret`.
- `admin_resetPortalLink`.
- `lookupPortalSecretForApplicant_`.
- `getPortalSecretForApplicant_`.
- `resetPortalSecretForApplicant_`.
- `setPortalSecretForApplicant_`.
- `getOrCreateActivePortalSecret_`.
- `syncPortalSecretsActive_`.
- `admin_backfillPortalTokens`.
- `admin_backfillPortalTokensDryRun`.
- `admin_backfillPortalTokensApply`.
- `admin_exportPortalLinksCsv`.

### CRM hooks

- `getZohoToken_`.
- `upsertZohoContact_`.
- `upsertZohoDeal_`.
- `triggerCrmDealForFode_`.
- `syncFodeCrmStage_`.
- `crm_syncOnPaymentVerified_`.
- `buildCrmPayloadFromRow_`.
- `deriveFodeCrmStageFromRow_`.
- `shouldCreateFodeCrmDeal_`.
- `shouldCreateFodeCrmInvoice_`.

### Email / bounce flows

- `adminSendEmail_`.
- `sendQuoteEmail_`.
- `sendPaymentEmail_`.
- `sendPaymentVerifiedStudentQuoteEmail_`.
- `sendPaymentVerifiedAdminReleaseEmail_`.
- `sendDocsVerifiedPaymentRequiredEmail_`.
- `admin_sendDocsFollowupEmails`.
- `campaignSendEmailGmail_`.
- `dispatchApplicantMessage_`.
- `campaign_sendLegacyBatch_`.
- `campaign_sendLegacyFollowups_`.
- `campaign_syncResponses_`.
- `ingestRecentBounces_`.
- `admin_scanBounces_`.
- `campaign_processBounces_`.

## 3. Recovery / Debug Tools

### Safe / read-only

- `admin_getRuntimeInfo`.
- `buildRuntimeTruth_`.
- `diagStatus_` when diagnostics are enabled.
- `driveProbeFolder_`, `driveDeepProbe_` style probes when used only for inspection.
- `authDrive` and `authDriveYearFolder` read Drive metadata and are safe from a data-mutation perspective, but they do exercise Drive scopes.
- `admin_getApplicantDetail`, `admin_getApplicantDetail_json`, `admin_searchApplicants`.
- `admin_getStageAggregation`, `admin_getReviewQueues`.
- `admin_campaignGetLegacyEmailSummary`.
- `admin_backfillPortalTokensDryRun`.
- `admin_planApplicantBatch`, `admin_planLegacyInviteBatch`.

### Mutation-capable

- `test_PortalLogWrite`, `test_LogSheetWrite`.
- `portalUploadBase64`, `portalUpload_handleBase64_`, `uploadPortalFile`, `portal_uploadMultipart_`.
- `portal_deleteUploadedFile`.
- `admin_updateDocStatuses`, `admin_setOverallStatus`, `admin_setPortalAccess`.
- `admin_resetPortalLink`, `admin_resetPortalSecret`.
- `admin_backfillPortalTokensApply`, `admin_backfillPortalTokens` when `dryRun=false`.
- `admin_exportPortalLinksCsv` because it can create active PortalSecrets rows.
- `admin_campaignPrepareLegacyRows`, `admin_campaignSyncResponses`.
- `admin_runBounceScan`, `admin_campaignProcessBounces`.

### Dangerous

- `admin_sendStageBatch`.
- `admin_sendApplicantMessage`.
- `admin_campaignSendLegacyBatch`.
- `admin_campaignSendLegacyFollowups`.
- `runAutomatedStageBatchScheduled`.
- `admin_runAutomatedStageBatchOnce`.
- `admin_installAutomatedStageRunnerTrigger`.
- `admin_removeAutomatedStageRunnerTrigger`.
- `admin_setPaymentVerified` because it can trigger email, CRM, and invoice flows.
- `portal_deleteUploadedFile` because it can trash Drive files when the file is inside the applicant folder chain.

## 4. Legacy / Duplicate Surfaces

### Multiple upload paths

- Browser base64 RPC path: `portalUploadBase64` -> `portalUpload_handleBase64_`.
- Legacy google.script.run Drive path: `uploadPortalFile`.
- Multipart POST path: `portal_uploadMultipart_`.
- doPost route reference: `doPost_portalUpload_`.
- Shared lower-level save/update helpers: `savePortalUpload_`, `applyPortalUploadSheetUpdate_`, Drive API helpers.

### Campaign wrappers

- Admin wrapper layer: `admin_campaignPrepareLegacyRows`, `admin_campaignSendLegacyBatch`, `admin_campaignSyncResponses`, `admin_campaignProcessBounces`, `admin_campaignSendLegacyFollowups`, `admin_campaignGetLegacyEmailSummary`.
- Internal campaign layer: `campaign_prepareLegacyRows_`, `campaign_sendLegacyBatch_`, `campaign_syncResponses_`, `campaign_processBounces_`, `campaign_sendLegacyFollowups_`, `campaign_getLegacyEmailSummary_`.
- Newer stage/applicant messaging reuses some campaign naming and delivery helpers.

### CRM dormant / guarded helpers

- Zoho token/contact/deal helpers exist in `Utils.js`.
- Admin payment verification has CRM sync hooks, including dry-run guarded behavior.
- CRM behavior is config-gated and should not be assumed active from local source alone.

### Probe / test utilities

- Runtime diagnostics: `buildRuntimeTruth_`, `admin_getRuntimeInfo`, `diagStatus_`.
- Drive probes/auth probes: `driveProbeFolder_`, `authDrive`, `authDriveYearFolder`, Drive API probes.
- Smoke/tests: `test_Smoke`, `test_PortalLogWrite`, `test_AdminAuth`, `test_AdminResetPortalLink`, `test_BackfillPortalTokens_DryRun`, `testCampaignPing`, `testCampaignGmailAuth`.
- Audit helper: `audit_NoHardcodedRowDefaults`.

## 5. Portal Secret Model

### Pre-change state found during analysis

- Portal login, portal update, upload auth, admin portal link generation, docs follow-up links, and `admin_getStudentPortalLink` used `getPortalSecretForApplicant_`.
- `getPortalSecretForApplicant_` read the PortalSecrets sheet directly by `ApplicantID` and returned the first matching secret column value.
- That read path accepted `Secret`, `Secret_Plain`, or `Secret_Hash` as the secret column.
- That read path did not enforce `Status=Active`.
- Campaign messaging used `getActivePortalSecretForCampaign_`, which required `Status=Active`, `Secret_Plain`, and `Secret_Hash`.
- Stage preview built a separate direct PortalSecrets lookup and enforced active status at the call site.
- Activation wrote `Secret_Plain`, `Secret_Hash`, `Created_At`, `Last_Rotated_At`, and `Status=Active` through `commitPortalActivationState_`.
- Admission rows may contain `PortalTokenHash` and `PortalTokenIssuedAt`.
- Reset previously generated a new plain secret, wrote through `setPortalSecretForApplicant_`, and did not consistently update admission row `PortalTokenHash` / `PortalTokenIssuedAt`.

### Normalized state after Phase 2

- `lookupPortalSecretForApplicant_` is the shared read helper.
- Helper lookup:
  - finds by `ApplicantID`
  - reads PortalSecrets without creating columns
  - respects `Status=Active` when a `Status` column exists
  - returns `{ applicantId, secretPlain, secretHash, issuedAt, status, found, reason }` plus backward-compatible `ok`, `code`, and `secret`
  - prefers active rows when duplicate ApplicantID rows exist
- `getPortalSecretForApplicant_` now delegates to `lookupPortalSecretForApplicant_` and preserves the existing `ok` / `secret` caller shape.
- `getActivePortalSecretForCampaign_` now delegates to `lookupPortalSecretForApplicant_` and still requires both plain secret and hash.
- Stage preview lookup now uses the same row normalization and no longer creates PortalSecrets columns during read.
- `resetPortalSecretForApplicant_` is the shared reset helper.
- Reset:
  - generates a new plain secret
  - computes `Secret_Hash`
  - writes only existing PortalSecrets columns
  - marks previous rows `Inactive` only when `ApplicantID` matches, a `Status` column exists, and current `Status` is exactly `Active`
  - appends a new active row when `Status` exists
  - updates in place when `Status` does not exist
  - updates admission row `PortalTokenHash` and `PortalTokenIssuedAt` only when those columns already exist

### Remaining legacy reads / writes

- `getOrCreateActivePortalSecret_` still uses `openPortalSecrets_` and `findPortalSecretsRowByApplicantId_`; this is a create/backfill helper and was not changed to avoid altering export/backfill behavior.
- `syncPortalSecretsActive_` remains unused in scoped files and still opens PortalSecrets directly.
- `admin_backfillPortalTokens` and `admin_exportPortalLinksCsv` still use `openPortalSecrets_`; these are mutation-capable admin tools and were not refactored in this CIS.
- `commitPortalActivationState_` still writes activation secrets directly and can create the PortalSecrets tab/headers as before; activation behavior was not changed in this CIS.
