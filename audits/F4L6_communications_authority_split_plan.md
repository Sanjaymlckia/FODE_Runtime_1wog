# F4L.6 Communications Authority Split Plan

Status: docs-only plan
Baseline: `809e9a2 refactor: extract lifecycle authority module`
Runtime changes: none
Apps Script deployment actions: none
Sheet/Drive/email actions: none

## 1. Current Communications Map

### Selected applicant communications

Current Admin surface:

- `Admin.js:6175` `admin_previewApplicantMessage`
- `Admin.js:6205` `admin_sendApplicantMessage`

Current canonical core:

- `Code.js:9624` `previewApplicantMessage_`
- `Code.js:9702` `sendApplicantMessage_`
- `Code.js:8653` `dispatchApplicantMessage_`

The Admin functions are RPC wrappers around the Code.js communication core. They preserve admin role context, edited subject/body/recipient handling, Ops Safe Mode checks, and RPC return shapes.

### Stage batch communications

Current Admin surface:

- `Admin.js:5515` `admin_previewStageBatch`
- `Admin.js:5790` `admin_sendStageBatch`
- `Admin.js:5266` `collectStageBatchCohort_`
- `Admin.js:4891` `getBatchMessageTypeForStage_`

Current tightly-coupled Admin helpers:

- `adminCommBlockedResult_`
- `normalizeStageBatchStage_`
- `clampStageBatchLimit_`
- `clampStageBatchOffset_`
- `getStageBatchPreviewCacheKey_`
- `readStageBatchPreviewCache_`
- `stageBatchPreviewCacheTtlSeconds_`
- `writeStageBatchPreviewCache_`
- `clearStageBatchPreviewCache_`
- `stageBatchPreviewLog_`
- `stageBatchDurableGroupForStage_`
- `getStageCursorKey_`
- `getStageCursor_`
- `setStageCursor_`

The batch surface uses Code.js lifecycle message mapping through `communicationRecommendedMessageTypeForStage_`, and sends through `sendApplicantMessage_`.

### WhatsApp fallback

Current Admin surface:

- `Admin.js:2605` `admin_exportWhatsAppFallbackCsv`
- `Admin.js:2725` `admin_emailWhatsAppFallbackCsv`

Current tightly-coupled Admin helpers:

- `normalizeWhatsAppFallbackLimit_`
- `normalizeWhatsAppFallbackFilter_`
- `getWhatsAppFallbackPhoneRaw_`
- `getWhatsAppFallbackStudentName_`
- `getWhatsAppFallbackParentName_`
- `getWhatsAppFallbackEmailIssue_`
- `isWhatsAppFallbackCandidate_`
- `resolveWhatsAppFallbackAdminRecipients_`
- `getWhatsAppFallbackAdminRecipients_`
- `buildWhatsAppFallbackPortalInfo_`
- `getWhatsAppFallbackMessageTemplate_`
- `buildWhatsAppFallbackTemplateTokens_`
- `renderWhatsAppFallbackTemplate_`
- `buildWhatsAppFallbackMessage_`
- `buildWhatsAppFallbackPhoneFormatted_`
- `buildWhatsAppFallbackWebLink_`
- `getWhatsAppFallbackCacheKey_`
- `getWhatsAppFallbackLastCacheKey_`
- `writeWhatsAppFallbackCsvCache_`
- `readWhatsAppFallbackCsvCache_`
- `readWhatsAppFallbackLastCsvCache_`
- `buildWhatsAppFallbackEmailSubject_`
- `buildWhatsAppFallbackEmailBody_`
- `buildWhatsAppFallbackBatchLabel_`

This surface is manual fallback/reporting authority. It uses row facts, portal-link context, UserCache snapshots, CSV generation, and `adminSendEmail_` for export email delivery.

### Payment/outbound orchestration

Current Admin surface:

- `Admin.js:1600` `sendQuoteEmail_`
- `Admin.js:1669` `sendPaymentEmail_`
- `Admin.js:1711` `triggerInvoiceWebhook_`
- `Admin.js:2153` `handlePaymentVerifiedEmailTriggers_`
- `Admin.js:2195` `handleInvoiceTrigger_`
- `Admin.js:2239` `runVerificationAutomations_`

These functions are payment/document-save side-effect orchestration. They should not move into the first communications split because they are coupled to payment verification, invoice handoff, webhook policy, and save-handler automation.

### Code.js canonical communication core

Current Code.js surface:

- `normalizeApplicantMessageType_`
- `communicationSendAuthorityForDefinition_`
- `communicationDefinitionSupportsMode_`
- `communicationTemplateGalleryCopy_`
- `communicationTemplateGalleryMetadata_`
- `communicationRequiresPortalUrl_`
- `communicationRequiresResolvedActionPlaceholders_`
- `lifecycleStageMessageTypeMap_`
- `communicationRecommendedMessageTypeForStage_`
- `buildApplicantMessage_`
- `computeEmailIdempotencyKey_`
- `wasEmailAlreadyProcessed_`
- `recordEmailProcessingResult_`
- `logManualSendProbe_`
- `dispatchApplicantMessage_`
- `previewApplicantMessage_`
- `sendApplicantMessage_`

Code.js remains the canonical communication engine: registry, template semantics, stage-message mapping, send gates, idempotency, cooldown, dispatch, preview, and send.

## 2. Proposed Module Boundaries

### F4L.7 `Admin_SelectedApplicantCommunications.js`

Responsibility:

- Own Admin-facing selected-applicant preview/send RPC wrappers only.
- Preserve global names `admin_previewApplicantMessage` and `admin_sendApplicantMessage`.
- Preserve edited draft semantics, selected applicant RPC contracts, authorization, Ops Safe Mode handling, logging, and return shapes.

Proposed functions:

- `admin_previewApplicantMessage`
- `admin_sendApplicantMessage`
- Any wrapper-only private helper discovered during extraction, if it exists solely for this selected-applicant Admin surface.

Do not include:

- Code.js template registry or send core.
- Stage batch preview/send.
- WhatsApp fallback CSV/email export.
- Payment-triggered outbound functions.

Risk: Low to medium.

Reason: The wrapper boundary is narrow, but tests assert specific Admin wrapper behavior and literal RPC names.

### F4L.8 `Admin_StageBatchCommunications.js`

Responsibility:

- Own Admin Stage Batch preview/send orchestration and the batch candidate read model.
- Preserve global names `admin_previewStageBatch`, `admin_sendStageBatch`, `collectStageBatchCohort_`, and `getBatchMessageTypeForStage_`.
- Preserve preview cache, cursor, scan-cap, pagination, confirmation, batch send caps, candidate ordering, logging, and return shapes.

Proposed functions:

- `admin_previewStageBatch`
- `admin_sendStageBatch`
- `collectStageBatchCohort_`
- `getBatchMessageTypeForStage_`
- `adminCommBlockedResult_`, only if all consumers are in the stage-batch communication path
- stage batch normalization, limit, offset, preview-cache, cursor, durable-group, and logging helpers listed in section 1

Do not include:

- Code.js registry/template/send core.
- Selected-applicant Admin wrappers unless already extracted and consumed by name.
- Payment/outbound automation.
- Review queue construction.
- Lifecycle authority state transitions.

Risk: Medium to high.

Reason: This surface has real runtime state through UserCache and Script Properties cursors, plus send gating and batch candidate parity requirements.

### F4L.9 `Admin_WhatsAppFallback.js`

Responsibility:

- Own manual WhatsApp fallback CSV/export/email reporting authority.
- Preserve global names `admin_exportWhatsAppFallbackCsv` and `admin_emailWhatsAppFallbackCsv`.
- Preserve CSV shape, batch labels, cache lookup, admin recipient resolution, message template rendering, portal-link context, and export email behavior.

Proposed functions:

- `admin_exportWhatsAppFallbackCsv`
- `admin_emailWhatsAppFallbackCsv`
- all WhatsApp fallback helpers listed in section 1

Do not include:

- Selected-applicant `contact_fallback_manual` template semantics from Code.js.
- Stage Batch communications.
- Payment/outbound automation.
- Portal secret write/update logic.

Risk: Medium.

Reason: The function cluster is cohesive, but it touches portal-link context, cache snapshots, CSV content, and `adminSendEmail_`.

## 3. Functions That Must Remain In Admin.js

Keep as orchestration until a separate outbound/payment automation design exists:

- `sendQuoteEmail_`
- `sendPaymentEmail_`
- `triggerInvoiceWebhook_`
- `handlePaymentVerifiedEmailTriggers_`
- `handleInvoiceTrigger_`
- `runVerificationAutomations_`

Reason:

- These are payment/document-save side effects, not general communication authority.
- Moving them into an Admin communications module would pull in payment authority, invoice webhook handoff, and save-handler automation.

## 4. Functions That Must Remain In Code.js

Keep canonical:

- `normalizeApplicantMessageType_`
- `communicationSendAuthorityForDefinition_`
- `communicationDefinitionSupportsMode_`
- `communicationTemplateGalleryCopy_`
- `communicationTemplateGalleryMetadata_`
- `communicationRequiresPortalUrl_`
- `communicationRequiresResolvedActionPlaceholders_`
- `lifecycleStageMessageTypeMap_`
- `communicationRecommendedMessageTypeForStage_`
- `buildApplicantMessage_`
- `computeEmailIdempotencyKey_`
- `wasEmailAlreadyProcessed_`
- `recordEmailProcessingResult_`
- `logManualSendProbe_`
- `dispatchApplicantMessage_`
- `previewApplicantMessage_`
- `sendApplicantMessage_`

Reason:

- Code.js is the shared communication engine consumed by Admin RPCs, Stage Batch, and non-Admin automation paths.
- Moving this core in an Admin-only extraction would change dependency direction and risk template/send semantics.

## 5. Dependency Direction

Allowed future direction:

- `Admin_SelectedApplicantCommunications.js` may consume `Admin_AccessControl.js` and Code.js communication core.
- `Admin_StageBatchCommunications.js` may consume `Admin_AccessControl.js`, `Admin_RowFacts.js`, `Admin_LifecycleAuthority.js`, `Admin_PaymentAuthority.js`, and Code.js communication core.
- `Admin_WhatsAppFallback.js` may consume `Admin_AccessControl.js`, row facts/helpers, portal-link read helpers, and `adminSendEmail_`.

Disallowed direction:

- Code.js communication core must not depend on Admin communications modules.
- Access control, row facts, payment authority, lifecycle authority, review queues, and document services must not depend on a specific Admin communications module.
- Payment/outbound orchestration must not be absorbed into any of the three proposed modules.

## 6. Extraction Order Recommendation

1. F4L.7 Selected Applicant Communications Extraction
2. F4L.8 Stage Batch Communications Extraction
3. F4L.9 WhatsApp Fallback Module Extraction

Rationale:

- F4L.7 is the smallest wrapper seam and proves Apps Script source-order compatibility for communications modules.
- F4L.8 should happen after F4L.7 because Stage Batch sends through the same Code.js selected-applicant send core and has higher cache/cursor risk.
- F4L.9 is cohesive but should remain separate from Stage Batch because it is manual fallback/reporting, not batch send authority.

## 7. Required Targeted Tests Per Future Extraction

### F4L.7

- `node --check Admin.js`
- `node --check Admin_SelectedApplicantCommunications.js`
- `node --check Code.js`
- `node tests\communication-send-gate-matrix.test.js`
- `node tests\communication-semantic-registry.test.js`
- `node tests\admin-ui-rpc-contract.test.js`
- `node tests\admin-role-boundary-matrix.test.js`

### F4L.8

- `node --check Admin.js`
- `node --check Admin_StageBatchCommunications.js`
- `node --check Code.js`
- `node tests\communication-send-gate-matrix.test.js`
- `node tests\communication-semantic-registry.test.js`
- `node tests\admin-ui-rpc-contract.test.js`
- `node tests\admin-role-boundary-matrix.test.js`
- `node tests\admin-document-verifier-role.test.js`
- `node tests\admin-review-queue-rollup-consistency.test.js`
- `node tests\payment-authority-nonqueue-consumers.test.js`

### F4L.9

- `node --check Admin.js`
- `node --check Admin_WhatsAppFallback.js`
- `node tests\communication-semantic-registry.test.js`
- `node tests\admin-ui-rpc-contract.test.js`
- `node tests\admin-role-boundary-matrix.test.js`

If F4L.9 changes export/email cache behavior, add or update a focused WhatsApp fallback test before extraction commit.

## 8. Explicit No-Go Areas

Do not include in F4L.7, F4L.8, or F4L.9:

- payment write authority
- invoice webhook redesign
- Zoho Books preview/write authority
- lifecycle state transitions
- review queue construction
- document file services
- portal secret write/update authority
- OPS execution authority
- template semantic rewrites
- send-gate behavior changes
- Apps Script push, version, deploy, or repin
- Sheet/Drive mutation
- live email sends

## 9. Recommendation

Proceed next with:

`F4L.7 Selected Applicant Communications Extraction`

Scope should be limited to the two Admin selected-applicant RPC wrappers and wrapper-only helpers. If that extraction exposes hidden coupling, stop and report before touching Stage Batch or WhatsApp fallback.
