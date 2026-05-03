# FODE Runtime Code Health Audit - r118

Date: 2026-05-03
Baseline: r118 / 118
Authoritative repo: `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog`
Mode: read-only analysis and cleanup planning

## 1. Executive Summary

Current health score: 76 / 100

The r118 runtime is stable enough for controlled operation. The strongest parts of the system are the explicit deployment discipline, canonical URL controls, `whoami` runtime truth, dry-run CRM posture, disabled automation, and the recent admin RPC identity-source fixes for the known failing Admin dashboard paths.

The main health problem is not a single urgent production defect. It is accumulated surface area: admin RPCs, upload handlers, campaign wrappers, diagnostics, token helpers, CRM helpers, and recompute logic all exist in parallel paths. Most are gated, but the system would benefit from a staged cleanup queue that first improves safety and observability, then consolidates duplicate paths.

Total findings: 46
Critical cleanup findings: 4
Urgent production issue found: No

Top 10 risks:

1. Admin RPC identity-source handling is inconsistent after r117/r118. Some read RPCs now use `getCallerEmail_()`, but many mutation RPCs still call `getActiveUserEmail_()`.
2. Dangerous admin mutations are spread across status patching, payment verification, portal token resets, email sends, bounce scans, and trigger controls.
3. Upload handling has three active or legacy paths: base64 portal upload, legacy `uploadPortalFile`, and multipart POST upload.
4. Portal secret storage keeps both plain secret and hash material, which is a long-term credential exposure risk.
5. CRM and invoice helpers are currently disabled or dry-run, but live-capable helper paths exist and need a single future activation point.
6. Document, payment, registration, portal submission, lifecycle, and stage fields mix stored compatibility fields with derived state.
7. Legacy campaign wrappers and diagnostic routes remain callable through code paths that should be classified and quarantined.
8. Outbound email identity is not globally uniform across Gmail stage/campaign sends and MailApp or best-effort alert sends.
9. Bounce and cooldown suppression can permanently or repeatedly affect applicants if stale flags are not clearly cleared by operator action.
10. Disaster recovery knowledge is spread across code, config, docs, properties, sheets, triggers, and deployment state instead of one cold rebuild artifact.

Top 10 recommended actions:

1. Create an Admin RPC registry document that classifies every RPC by read-only, safe mutation, or dangerous mutation.
2. Standardize Admin RPC caller identity on `getCallerEmail_()` where admin calls originate from UI RPC context.
3. Add a non-behavior-changing dangerous-action inventory to the Admin UI and operator docs.
4. Normalize admin RPC responses to a standard envelope without changing business logic.
5. Add minimal correlation IDs to mutation, email, upload, token reset, and bounce paths.
6. Pick one primary portal upload path and quarantine the others behind explicit legacy labels.
7. Define CRM as a mirror-only integration with one approved activation point and dry-run acceptance checks.
8. Document field authority for stored versus derived applicant fields.
9. Quarantine diagnostic, probe, test, and legacy campaign routes behind explicit super-admin or remove-later CIS phases.
10. Build a cold rebuild checklist and backup/export manifest for script, sheet schema, script properties, triggers, deployment IDs, and Gmail alias requirements.

## 2. System Map

End-to-end flow:

1. Applicant row lives in the FODE spreadsheet as the runtime source of truth.
2. Admin UI searches, reviews, patches statuses, verifies payment, resets portal access, and sends applicant communications through Apps Script RPCs.
3. Student portal uses active portal secrets and applicant identifiers to read and update controlled submission fields.
4. Upload handlers write files to Drive, patch applicant/document metadata, and log portal activity.
5. Stage and campaign logic derives communication eligibility, applies cooldown and bounce suppression, sends email through controlled sender identity, and updates communication fields.
6. Optional CRM and invoice paths are currently disabled or dry-run and should mirror FODE state only when explicitly enabled.

Admin flow:

- Browser loads `AdminUI.html`.
- `google.script.run` calls Admin RPCs in `Admin.js` and a small number of admin helpers in `Code.js`.
- Admin gate is primarily `isAdmin_(email)` or `requireSuperAdmin_(email)`.
- Recent r117/r118 fixes changed `admin_getStageAggregation`, `admin_getReviewQueues`, and `admin_searchApplicants` to use `getCallerEmail_()`.

Student flow:

- Canonical student web app URL uses `/macros/s/<DEPLOYMENT_ID>/exec`.
- Portal requests are routed by `doGet` and `doPost`.
- Portal access is based on active portal secret state, applicant identity, and per-row access/status fields.
- Portal submit and upload paths patch sheet fields and Drive file references.

Email flow:

- Stage/campaign sends use `GmailApp` and enforce `requiredSystemSenderAlias_()` plus `requiredSystemReplyTo_()`.
- Some notification and best-effort paths use `MailApp` or helper wrappers and may not share the same sender semantics.
- Daily cap is currently `DAILY_SEND_CAP: 500`.

CRM mirror flow:

- `ENABLE_FODE_CRM_PIPELINE` is `false`.
- `CRM_PUSH_DRY_RUN` is `true`.
- `INVOICE_TRIGGER_ENABLED` is `false`.
- CRM helpers can build payloads and dry-run contact/deal operations, but live CRM should remain a mirror of FODE runtime authority.

## 3. Findings by Audit Area

### 1. Admin/RPC Mutation Surface

What exists:

Admin RPCs found in `Admin.js` and `Code.js`:

| RPC | Classification | Gate / identity evidence |
| --- | --- | --- |
| `admin_searchApplicants` | read-only | `Admin.js:155`, uses `getCallerEmail_()` after r118 |
| `admin_getApplicantDetail` | read-only | `Admin.js:229`, still uses `getActiveUserEmail_()` |
| `admin_getApplicantDetail_json` | read-only | `Admin.js:447`, wraps detail response |
| `admin_generatePortalLink` | safe mutation or link materialization | `Admin.js:473`, delegates portal link flow |
| `admin_resetPortalSecret` | dangerous mutation | `Admin.js:477`, token reset |
| `admin_getPortalLink` | read-only or link materialization | `Admin.js:481` |
| `admin_resetPortalLink` | dangerous mutation | `Admin.js:534`, token reset |
| `admin_updateDocStatuses` | safe mutation | `Admin.js:597`, patches document statuses |
| `admin_setOverallStatus` | safe mutation | `Admin.js:790`, patches applicant status |
| `admin_setPortalAccess` | safe mutation | `Admin.js:852`, patches portal access |
| `admin_verifyPayment` | dangerous mutation alias | `Admin.js:888`, delegates payment verification |
| `admin_setPaymentVerified` | dangerous mutation | `Admin.js:892`, payment, notification, CRM/invoice hooks |
| `admin_sendDocsFollowupEmails` | dangerous mutation | `Admin.js:1336`, sends email |
| `admin_updateParentEmailCorrected` | safe mutation | `Admin.js:1476`, patches parent email |
| `admin_getStageAggregation` | read-only | `Admin.js:2051`, uses `getCallerEmail_()` after r117 |
| `admin_getReviewQueues` | read-only | `Admin.js:2105`, uses `getCallerEmail_()` after r117 |
| `admin_backfillPortalTokens` | dangerous mutation | `Admin.js:2592`, token backfill |
| `admin_backfillPortalTokensDryRun` | read-only dry-run | `Admin.js:2776` |
| `admin_backfillPortalTokensApply` | dangerous mutation | `Admin.js:2782` |
| `admin_exportPortalLinksCsv` | dangerous mutation | `Admin.js:2788`, can create active secrets |
| `admin_campaignPrepareLegacyRows` | safe mutation | `Admin.js:2881`, legacy campaign prep |
| `admin_campaignSendLegacyBatch` | dangerous mutation | `Admin.js:2889`, sends email |
| `admin_campaignSyncResponses` | safe mutation | `Admin.js:2898`, updates response state |
| `admin_campaignProcessBounces` | safe mutation | `Admin.js:2906`, updates bounce state |
| `admin_runBounceScan` | safe mutation | `Admin.js:2914`, updates bounce state |
| `admin_runAutomatedStageBatchOnce` | dangerous mutation | `Admin.js:2922`, sends or patches stage state depending plan |
| `admin_installAutomatedStageRunnerTrigger` | dangerous mutation | `Admin.js:2936`, trigger install, super-admin |
| `admin_removeAutomatedStageRunnerTrigger` | dangerous mutation | `Admin.js:2945`, trigger removal, super-admin |
| `admin_campaignSendLegacyFollowups` | dangerous mutation | `Admin.js:2954`, sends email |
| `admin_campaignGetLegacyEmailSummary` | read-only | `Admin.js:2963` |
| `admin_previewStageBatch` | read-only | `Admin.js:3449` |
| `admin_sendStageBatch` | dangerous mutation | `Admin.js:3609`, sends stage email |
| `admin_previewApplicantMessage` | read-only | `Admin.js:3917` |
| `admin_sendApplicantMessage` | dangerous mutation | `Admin.js:3943`, sends individual email |
| `admin_planApplicantBatch` | read-only | `Admin.js:3969` |
| `admin_planLegacyInviteBatch` | read-only | `Admin.js:4009` |
| `admin_getRuntimeInfo` | read-only | `Code.js:3846` |
| `admin_getStudentPortalLink` | read-only | `Code.js:3851` |
| `admin_getApplicantCommDerived_json` | read-only | `Code.js:7353` |

Risk:

The gate is present broadly, but identity-source behavior is inconsistent. Remaining `getActiveUserEmail_()` use in admin RPCs is a known failure pattern for Apps Script RPC context and should be normalized under controlled CIS work.

Evidence:

- `Admin.js:155`, `Admin.js:2051`, `Admin.js:2105` use `getCallerEmail_()`.
- Many other admin RPCs still use `getActiveUserEmail_()`.
- `Utils.js:86` defines `getCallerEmail_()`.

Recommendation:

Create a CIS that only changes admin RPC caller identity from `getActiveUserEmail_()` to `getCallerEmail_()` where the function is invoked by Admin UI RPC and already uses `isAdmin_()`. Do not change allowlists or admin policy.

Suggested CIS phase: Phase A.

### 2. Upload Pipeline Audit

What exists:

- Base64 portal upload: `portalUploadBase64` and `portalUpload_handleBase64_` in `Code.js:1461`.
- Legacy upload: `uploadPortalFile` in `Code.js:1582`.
- Multipart POST upload: `portal_uploadMultipart_` in `Code.js:2876`, routed by `doPost` for `view=portalupload`.
- Active UI references call `portalUploadBase64` from embedded portal JavaScript in `Code.js`.
- Drive file operations use both `DriveApp` and Drive API helpers.

Risk:

Multiple upload paths can drift in validation, folder targeting, filename construction, sheet patching, and portal logging. Duplicate active paths also complicate security review.

Evidence:

- `Code.js:1461`, `Code.js:1582`, `Code.js:2876`.
- `Code.js:27` routes POST traffic.
- `Code.js` and `Utils.js` reference `DriveApp` and `Drive.Files`.

Recommendation:

Designate base64 portal upload as the primary UI path if it is the current active browser path. Mark `uploadPortalFile` and multipart POST as legacy or compatibility paths, then compare validation and logging before removal. Removal should wait until traffic evidence confirms no active callers.

Suggested CIS phase: Phase C.

### 3. CRM Boundary Audit

What exists:

Current config:

- `ENABLE_FODE_CRM_PIPELINE: false`
- `CRM_PUSH_DRY_RUN: true`
- `INVOICE_TRIGGER_ENABLED: false`

CRM and Zoho helpers exist in `Utils.js`, `Admin.js`, and `Code.js`. Payment verification can reach CRM/invoice hook functions, but current flags keep this disabled or dry-run.

Risk:

A future flag flip could activate live CRM behavior from multiple conceptual points unless a single approved wiring point is defined.

Evidence:

- `Config.js` CRM and invoice flags.
- `Utils.js:428`, `Utils.js:466`, `Utils.js:497`.
- `Admin.js` CRM sync helpers and payment verified hook.
- `Code.js:4387`, `Code.js:4416`.

Recommendation:

Keep FODE runtime as authority and CRM as mirror. Future activation should choose exactly one trigger point:

- Admission granted is the cleanest default for CRM deal creation.
- Payment verified is suitable for payment milestone updates only.
- Manual admin trigger is safest for first live pilot.
- Activation event can be added later if it maps to a specific business state.

Suggested CIS phase: Phase D.

### 4. Payment / Document Status Recompute

What exists:

The runtime uses document review fields, payment fields, portal submission fields, registration fields, and derived lifecycle/stage helpers. There are explicit recompute helpers for document verification, payment badge, overall status, lifecycle stage, actionability, and stage eligibility.

Risk:

Stored compatibility fields and derived fields can diverge. Manual status writes can disagree with recompute output unless one source of truth is documented.

Evidence:

- `Code.js:4163` `computeDocVerificationStatus_`.
- `Code.js:4179` `derivePaymentBadge_`.
- `Code.js:4188` `computeOverallStatus_`.
- `Code.js:6693` `deriveApplicantLifecycleStage_`.
- `Code.js:6732` `deriveApplicantActionability_`.
- `Code.js:6825` `getApplicantStageAndEligibility_`.
- `Admin.js:597`, `Admin.js:790`, `Admin.js:888`, `Admin.js:892`.

Recommendation:

Create a field authority map. Mark document review and payment verification inputs as stored authority fields. Mark lifecycle, queue, badge, and stage fields as derived unless a compatibility reason requires storage.

Suggested CIS phase: Phase B.

### 5. Stage Lifecycle Edge Cases

What exists:

Stage logic derives invite pending, invited awaiting response, reminder due, processing, and complete states from applicant row data, communication history, bounce state, cooldown, documents, payment, and portal submission.

Risk:

Applicants can become stuck if prior successful sends, portal submission, bounce flags, docs, or payment updates do not move the derived stage predictably. A stage with no supported message type can create a dead branch for operators.

Evidence:

- `Code.js:6281` `deriveCommunicationState_`.
- `Code.js:6693` `deriveApplicantLifecycleStage_`.
- `Code.js:6825` `getApplicantStageAndEligibility_`.
- `Admin.js:3449`, `Admin.js:3609`, `Admin.js:3917`, `Admin.js:3943`.

Recommendation:

Build a read-only stage matrix with one row per lifecycle state and columns for required fields, blocking fields, supported message types, and next transition. Add no behavior change until the matrix is accepted.

Suggested CIS phase: Phase A.

### 6. Bounce / Cooldown Suppression

What exists:

Bounce handling classifies hard, invalid, blocked, and temporary failures. Hard, invalid, and blocked states suppress future sends. Cooldown logic suppresses repeated sends by applicant and message type.

Risk:

Legitimate applicants may remain permanently blocked after an address correction if stale bounce flags are not cleared. Temporary bounces may cause repeated retries if cooldown and next-action state are not visible enough.

Evidence:

- `Utils.js:1877` `normalizeEmailStatus_`.
- `Utils.js` `isCampaignBounceFlagTrue_`.
- `Code.js:6281` `deriveCommunicationState_`.
- `Code.js:7972` `ingestRecentBounces_`.
- `Code.js:8068` `campaign_processBounces_`.
- `Admin.js:2914` `admin_runBounceScan`.

Recommendation:

Document a bounce clear workflow tied to parent email correction. Add read-only admin visibility for suppression reason, last bounce class, and cooldown expiry before changing suppression logic.

Suggested CIS phase: Phase B.

### 7. Portal Token / Security Model

What exists:

The post-r114 model uses `PortalSecrets` with active/inactive state, plain secret, hash material, issued timestamp, and reset helpers. Portal lookup enforces active secret state.

Risk:

Plain secret storage remains a credential exposure risk. Legacy and compatibility helpers make it harder to prove expired or deprecated tokens are impossible to use. Reset audit trail exists in code paths but should be standardized.

Evidence:

- `Utils.js:932` `openPortalSecrets_`.
- `Utils.js:1004` `getOrCreateActivePortalSecret_`.
- `Code.js:3530` `lookupPortalSecretForApplicant_`.
- `Code.js:3649` `resetPortalSecretForApplicant_`.
- `Admin.js:477`, `Admin.js:534`, `Admin.js:2592`, `Admin.js:2782`, `Admin.js:2788`.

Recommendation:

Without schema change, first document active/inactive enforcement and reset audit fields. Future hardening should stop creating recoverable plain secrets once all active UI paths can use one-time display or regeneration behavior.

Suggested CIS phase: Phase B, then Phase D.

### 8. Disaster Recovery and Sheet Schema

What exists:

Rebuild inputs include Apps Script source files, spreadsheet IDs, required tabs, required headers, script properties, Gmail alias, triggers, deployment IDs, and local authority docs. This knowledge is currently distributed.

Risk:

Cold rebuild depends on operator memory and scattered docs. A missing property, header, tab, alias, trigger, or deployment pin would cause partial recovery.

Evidence:

- `Config.js` stores core IDs, flags, and URLs.
- `LIVE_URLS.md` stores canonical Admin and Student URLs.
- `KNOWN_GOOD_STATE.md` stores accepted runtime baseline and deployment pins.
- `Code.js`, `Admin.js`, and `Utils.js` reference required headers, tabs, properties, and triggers.

Recommendation:

Create a cold rebuild checklist covering:

- Source files: `Code.js`, `Admin.js`, `Utils.js`, `Config.js`, `AdminUI.html`, `whoami_admin.html`, `appsscript.json`, `.clasp.json`.
- Runtime dependencies: spreadsheet ID, applicant tab, portal log tab, portal secrets tab, campaign/email tabs, Apps Script properties, Gmail alias `fode_kia@kundu.ac`, reply-to `fode@kundu.ac`, automation trigger state, Admin deployment ID, Student deployment ID.
- Backup artifacts: Apps Script source export, sheet schema export, script properties export, trigger inventory, deployment inventory, known-good whoami capture.

Suggested CIS phase: Phase D.

### 9. Legacy Campaign / Diagnostic Routes

What exists:

Legacy campaign wrappers and diagnostic/test/probe routes remain present. Routes include `diag`, Drive probes, portal smoke, upload smoke, test helpers, campaign ping, Gmail auth test, bounce scan, and automated runner trigger controls.

Risk:

Diagnostic routes increase operational surface. Dangerous diagnostic or trigger paths must be super-admin gated, hidden from normal UI, and eventually quarantined or removed.

Evidence:

- `Code.js:450` `doGet`.
- `Code.js:487` `resolveDoGetHandler_`.
- Diagnostic names found by search: `diag`, `driveapiprobe`, `drivedeepprobe`, `driveprobe`, `portalsmoke`, `uploadsmoke`.
- `Admin.js:2936`, `Admin.js:2945` trigger controls.

Recommendation:

Classify as:

- Keep: `whoami`, required admin/student routes, current Admin UI routes.
- Quarantine: Drive probes, portal/upload smoke routes, test functions, legacy campaign wrappers.
- Safe remove later: obsolete wrappers after traffic and operator workflow verification.

Suggested CIS phase: Phase C.

### 10. Global Outbound Email Consistency

What exists:

Stage and campaign email use the controlled Gmail alias and reply-to. MailApp and best-effort notification paths exist for alerts, payment/document notifications, and admin helper sends.

Risk:

Different sender and reply-to semantics can confuse recipients, complicate SPF/DMARC troubleshooting, and weaken audit traceability.

Evidence:

- `Utils.js:113` `requiredSystemSenderAlias_`.
- `Utils.js:117` `requiredSystemReplyTo_`.
- `Code.js:6078` `campaignSendEmailGmail_`.
- `Utils.js:1451` `adminSendEmail_`.
- MailApp references in `Code.js`, `Admin.js`, and `Utils.js`.

Recommendation:

Decide whether all outbound production mail should standardize on:

- From: `fode_kia@kundu.ac`
- Reply-To: `fode@kundu.ac`

Do not implement until each MailApp path is classified as applicant-facing, operator alert, or best-effort diagnostic.

Suggested CIS phase: Phase B.

### 11. Data Authority Map

What exists:

Stored fields include applicant identity, email fields, portal access/status fields, document review fields, payment fields, submission fields, communication fields, bounce fields, and CRM mirror fields. Derived fields include lifecycle, eligibility, queue membership, badges, and stage state.

Risk:

Some fields are patched by multiple functions. Manual edits to derived fields can conflict with recompute helpers and cause queue or stage drift.

Evidence:

- `Admin.js:597`, `Admin.js:790`, `Admin.js:852`, `Admin.js:892`, `Admin.js:1476`.
- `Code.js:4163`, `Code.js:4188`, `Code.js:6693`, `Code.js:6825`.
- `Utils.js:1293` `applyPatch_`.

Recommendation:

Create a data authority table with columns: field, source of truth, writer functions, derived or stored, manual edit allowed, and recompute function. Use it as a guardrail before any schema or status cleanup.

Suggested CIS phase: Phase A.

### 12. Error Handling

What exists:

Some RPCs use a standard envelope pattern. Other functions throw raw errors to the UI or return mixed success/error shapes. Some helper exceptions are swallowed for best-effort behavior.

Risk:

Mixed error formats make Admin UI handling unpredictable and make support evidence harder to collect. Swallowed exceptions can hide partial failures, while raw throws can expose low-level messages to operators.

Evidence:

- `Admin.js` has `withEnvelope_` usage in newer stage/message functions.
- Earlier admin RPCs have direct throws and mixed return objects.
- Best-effort helpers in `Code.js`, `Admin.js`, and `Utils.js` catch and continue in several paths.

Recommendation:

Adopt a standard admin response envelope:

- `ok`
- `code`
- `message`
- `requestId`
- `data`
- `warnings`

Apply first to read-only RPCs, then to safe mutations, then to dangerous mutations.

Suggested CIS phase: Phase B.

### 13. Logging and Correlation

What exists:

Logging includes Apps Script Logger calls, portal post logs, admin event logs, campaign logs, execution trace helpers, debug IDs, request IDs, and batch IDs in selected paths.

Risk:

Correlation is uneven. Email sends, upload writes, token resets, bounce scans, and payment verification should be traceable across UI request, sheet patch, log event, and outbound effect.

Evidence:

- Stage/message paths include request or debug IDs.
- Campaign send paths use batch concepts.
- Portal upload and post paths log selected events.
- Token reset and legacy wrappers are not consistently tied to one visible correlation model.

Recommendation:

Use one minimal model:

- `requestId` for UI RPC call.
- `batchId` for multi-recipient email or automation runs.
- `applicantId` for row-scoped mutation.
- `eventType` for lifecycle event.

Suggested CIS phase: Phase B.

### 14. Runtime Config Hygiene

What exists:

Core flags are explicit and conservative:

- `DAILY_SEND_CAP: 500`
- `ENABLE_AUTOMATED_STAGE_RUNNER: false`
- `ENABLE_FODE_CRM_PIPELINE: false`
- `CRM_PUSH_DRY_RUN: true`
- `INVOICE_TRIGGER_ENABLED: false`

Canonical URL rules are present. Searches for `/a/macros/` found normalization code, not canonical stored URLs in the scoped authority docs.

Risk:

Dormant flags and duplicated constants can become stale. Non-canonical URL variants must remain out of authority docs.

Evidence:

- `Config.js` flag definitions.
- `LIVE_URLS.md` canonical URLs.
- `Code.js` and `Utils.js` normalize `/a/macros/` style URLs.

Recommendation:

Add a config hygiene section to authority docs: stable values, operator-controlled flags, dormant flags, and values that cannot be changed without release CIS.

Suggested CIS phase: Phase A.

### 15. Operator Safety

What exists:

High-impact functions exist for:

- Sending emails.
- Resetting links and portal tokens.
- Patching applicant rows.
- Altering CRM or invoice mirror state when enabled.
- Installing or removing triggers.
- Running automation.
- Processing bounce state.

Risk:

Operator actions can mutate sheet state or send external communications. Most are gated, but not all have the same dry-run, preview, confirmation, or log shape.

Evidence:

- Email sends: `Admin.js:1336`, `Admin.js:2889`, `Admin.js:2954`, `Admin.js:3609`, `Admin.js:3943`.
- Token resets/backfills: `Admin.js:477`, `Admin.js:534`, `Admin.js:2592`, `Admin.js:2782`, `Admin.js:2788`.
- Status/payment patches: `Admin.js:597`, `Admin.js:790`, `Admin.js:852`, `Admin.js:892`.
- Trigger controls: `Admin.js:2936`, `Admin.js:2945`.
- Automation: `Code.js:7116`, `Admin.js:2922`.

Recommendation:

Create an operator safety matrix. Require preview, explicit confirmation, dry-run where possible, logging, and rollback notes for every dangerous mutation.

Suggested CIS phase: Phase A.

## 4. Cleanup Roadmap

### Phase A - Safety / No Behavior Change

1. Admin RPC registry and classification.
2. Admin RPC identity-source normalization plan.
3. Dangerous action inventory for Admin operations.
4. Stage lifecycle matrix.
5. Data authority map.
6. Config hygiene table.
7. Diagnostic and legacy route registry.

Acceptance style:

- Documentation only or single-mechanism no-op refactors.
- No Sheet schema changes.
- No runtime behavior changes.
- No external sends.

### Phase B - Low-Risk Behavior Hardening

1. Standard response envelope for read-only Admin RPCs.
2. Standard response envelope for safe mutation RPCs.
3. Minimal correlation model for uploads, token resets, payment, bounce, and email sends.
4. Bounce suppression visibility and clear workflow.
5. Global outbound identity decision and path classification.
6. Portal token reset audit consistency.

Acceptance style:

- Existing behavior preserved.
- Better UI errors and logs.
- Test with read-only RPCs first.
- Mutation tests must use dry-run or targeted non-production-safe cases unless explicitly approved.

### Phase C - Consolidation

1. Choose primary upload path.
2. Quarantine legacy upload and multipart compatibility paths.
3. Quarantine legacy campaign wrappers.
4. Quarantine diagnostic/probe/smoke routes.
5. Remove obsolete wrappers only after traffic and operator acceptance.

Acceptance style:

- Active UI still uploads successfully.
- No canonical URL drift.
- No accidental removal of current admin or student routes.

### Phase D - Future Enablement

1. CRM activation plan as mirror-only.
2. Automated stage runner enablement plan.
3. Disaster recovery drill.
4. Script properties and trigger inventory export.
5. Sheet schema backup/export artifact.

Acceptance style:

- Dry-run first.
- Manual admin trigger before automation.
- Live enablement requires explicit CIS and rollback plan.

## 5. Proposed CIS Queue

### CIS 1 - Admin RPC Registry and Identity Source Audit

Objective: Document every Admin RPC, classify risk, and identify the exact remaining `getActiveUserEmail_()` to `getCallerEmail_()` candidates.

Files likely in scope: `Admin.js`, `Code.js`, `FODE_CODE_HEALTH_AUDIT_r118.md` or a new RPC registry doc.

Risk level: Low if documentation only; medium if identity-source code changes are included.

Acceptance tests:

- `rg "function admin_|getActiveUserEmail_|getCallerEmail_|isAdmin_" Admin.js Code.js Utils.js`
- Admin whoami unchanged.
- Admin search, stage dashboard, review queues load.

Rollback approach: Revert only the identity-source substitutions if an RPC loses admin access.

### CIS 2 - Operator Safety Matrix

Objective: Produce a no-code registry of dangerous operations, required guard, log event, dry-run support, and rollback method.

Files likely in scope: docs only.

Risk level: Low.

Acceptance tests:

- Every email, token reset, row patch, trigger, CRM, invoice, bounce, and automation function has an entry.
- No source/runtime files changed.

Rollback approach: Documentation revert.

### CIS 3 - Admin RPC Envelope Phase 1

Objective: Standardize read-only Admin RPC response envelopes without changing business logic.

Files likely in scope: `Admin.js`, `Code.js`, `AdminUI.html`.

Risk level: Medium.

Acceptance tests:

- `node --check Admin.js`
- `node --check Code.js`
- Admin UI loads.
- Search, applicant detail, stage aggregation, review queues, preview batch return expected payloads.

Rollback approach: Revert envelope wrapper changes for affected RPCs.

### CIS 4 - Upload Path Decision and Quarantine Plan

Objective: Confirm primary upload path and mark legacy paths as compatibility-only before code removal.

Files likely in scope: `Code.js`, `AdminUI.html`, docs.

Risk level: Medium.

Acceptance tests:

- Current UI upload still succeeds in a controlled non-production-safe test.
- Legacy path has no active UI caller.
- Portal logging unchanged.

Rollback approach: Re-enable compatibility route or repin previous deployment.

### CIS 5 - Bounce Suppression Visibility

Objective: Add read-only visibility for bounce class, cooldown expiry, and suppression reason.

Files likely in scope: `Code.js`, `Admin.js`, `AdminUI.html`.

Risk level: Medium.

Acceptance tests:

- Suppressed applicants show reason.
- No sends occur.
- No bounce state is modified by viewing.

Rollback approach: Revert UI/read-only display changes.

### CIS 6 - Global Outbound Email Identity Decision

Objective: Classify each outbound path and decide whether it must use `fode_kia@kundu.ac` with reply-to `fode@kundu.ac`.

Files likely in scope: docs first; later `Code.js`, `Admin.js`, `Utils.js`.

Risk level: Low for decision doc; high for implementation.

Acceptance tests:

- No email behavior changes in decision phase.
- Later implementation must send only in controlled smoke tests.

Rollback approach: Revert email helper path changes or repin previous deployment.

### CIS 7 - Data Authority Map

Objective: Identify stored authority fields, derived fields, manual-edit-prohibited fields, and writer functions.

Files likely in scope: docs only first; later `Code.js`, `Admin.js`, `AdminUI.html`.

Risk level: Low for docs; medium for enforcement.

Acceptance tests:

- Every document, payment, portal, lifecycle, communication, bounce, and CRM field has one authority classification.
- No source code changed in documentation phase.

Rollback approach: Documentation revert.

### CIS 8 - Diagnostic and Legacy Route Quarantine

Objective: Restrict or label diagnostic, probe, test, smoke, and legacy campaign routes.

Files likely in scope: `Code.js`, `Admin.js`, docs.

Risk level: Medium.

Acceptance tests:

- Current Admin and Student canonical routes still work.
- `whoami` still works.
- Quarantined routes require expected gate or are no longer routed.

Rollback approach: Revert route table change or repin previous deployment.

### CIS 9 - CRM Mirror Activation Plan

Objective: Define one future live CRM trigger point and dry-run acceptance checklist.

Files likely in scope: docs first; later `Config.js`, `Admin.js`, `Code.js`, `Utils.js`.

Risk level: Low for plan; high for live enablement.

Acceptance tests:

- `ENABLE_FODE_CRM_PIPELINE` remains false during planning.
- `CRM_PUSH_DRY_RUN` remains true during planning.
- Dry-run logs show expected payload without live mutation.

Rollback approach: Keep flags disabled; if live later, disable flags and repin if needed.

### CIS 10 - Disaster Recovery Drill

Objective: Create a cold rebuild runbook and export checklist.

Files likely in scope: docs only; possibly generated schema/property inventory artifacts after approval.

Risk level: Low if read-only.

Acceptance tests:

- Rebuild checklist includes source, manifest, clasp project binding, sheet schema, script properties, triggers, Gmail alias, deployments, and whoami verification.
- No runtime mutation.

Rollback approach: Documentation revert.

## 6. Stop / Do-Not-Touch List

Do not change without explicit CIS approval:

- `appsscript.json`
- `.clasp.json`
- Spreadsheet schema, tabs, headers, formulas, or data
- Drive folder structure or stored uploaded files
- Gmail alias configuration
- Script properties
- Trigger installation, removal, or schedule
- CRM or Zoho live state
- Invoice live state
- Daily email cap
- Admin allowlist
- Canonical Admin deployment URL
- Canonical Student deployment URL
- Apps Script deployment pins
- Portal secret schema
- Payment verification semantics
- Document status semantics
- Automated stage runner enablement

Do not treat local source as live runtime proof. Runtime acceptance remains Admin and Student `?view=whoami` plus required browser checks for release work.

## Validation Notes

Commands run:

- `git rev-parse --show-toplevel`
- `git status -sb`
- `rg "function admin_|admin_[A-Za-z0-9_]+|google.script.run" Admin.js AdminUI.html Code.js`
- `rg "getActiveUserEmail_|getCallerEmail_|isAdmin_|Access denied|Not authorized" Code.js Admin.js Utils.js`
- `rg "uploadPortalFile|portalUploadBase64|portalupload|multipart|DriveApp|Drive.Files" Code.js Admin.js Utils.js AdminUI.html`
- `rg "CRM|Zoho|ENABLE_FODE_CRM_PIPELINE|CRM_PUSH_DRY_RUN|INVOICE_TRIGGER" Config.js Code.js Admin.js Utils.js`
- `rg "Docs_Verified|Payment_Verified|Receipt_Status|Registration_Complete|Portal_Submitted|Stage|Lifecycle" Code.js Admin.js Utils.js`
- `rg "BOUNCE|Bounce|COOLDOWN|cooldown|Email_Bounce_Flag|Email_Status" Code.js Admin.js Utils.js`
- `rg "PortalSecrets|Secret_Plain|Secret_Hash|PortalTokenIssuedAt|resetPortal" Code.js Admin.js Utils.js`
- `rg "sendEmail|MailApp|GmailApp|requiredSystemSenderAlias|requiredSystemReplyTo|replyTo" Code.js Admin.js Utils.js`
- `rg "diag|probe|test_|smoke|install|trigger|automation|runner" Code.js Admin.js Utils.js`
- `rg "/a/macros/|script.google.com/a/macros|macros/a" .`

Validation result:

- Repo root matched the authoritative E: path.
- Initial git status was clean.
- No runtime commands were run.
- No clasp commands were run.
- No source files were edited by this audit.
- Canonical authority docs use `/macros/s/` URLs.
- `/a/macros/` references found by search are normalization code, not canonical stored authority URLs.

Final verdict: AUDIT COMPLETE
