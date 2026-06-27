# F2A Runtime Call Graph and Archive Plan v01

Date: 2026-06-27
Classification: Track L - audit artifact only / no runtime release
Baseline tag: `baseline/r301-dr-f1-readiness`
Current HEAD at start: `b80a897 docs: add F1 runtime surface audit`
Runtime baseline: Admin staging `r301 / 301`

## Executive Summary

PASS_WITH_WARNINGS

Static analysis indexed the current runtime surface and found:

- 926 server-side function declarations across `Code.js`, `Admin.js`, `Routes.js`, and `Utils.js`.
- 78 public `admin_*` functions.
- 35 unique UI-to-server RPC names from `google.script.run`; all 35 resolve to defined runtime functions.
- 10 route mappings from `doGet`.
- 33 trigger/runner candidates.
- 153 inline `onclick` handlers in HTML surfaces.
- 125 functions with no static caller/reference in the local call graph.

F2B may begin as a proof-first archive batch. It should start with Batch A diagnostics/probe/test-helper planning, not direct deletion.

Warnings:

- The call graph is static. Apps Script global functions, dynamic string dispatch, editor Run dropdowns, route query parameters, trigger registrations, and `google.script.run[fnName]` style calls can create false orphan candidates.
- OPS remains frozen and should not be pruned in F2B.
- Campaign, LAP/automated runner, Zoho/payment, portal-token, and property-cleanup surfaces are mutation-capable or data-sensitive and must remain `KEEP_UNTIL_PROVEN`.

## Preflight

Commands run:

- `git status -sb`
- `git log --oneline -5`
- `git diff --check`

Observed:

- Git status before report creation: `## main...origin/main`
- `git diff --check`: PASS
- Recent commits:
  - `b80a897 docs: add F1 runtime surface audit`
  - `bf2fb48 docs: add DR5 backup verification report`
  - `034498b docs: add roadmap DR verification plan`
  - `2519fd2 tools: add FODE disaster recovery toolkit`
  - `ba896e4 fix: complete selected applicant email templates`

## Method

Static analysis read:

- Runtime: `Code.js`, `Admin.js`, `Routes.js`, `Utils.js`
- UI: `AdminUI.html`, `AdminUI_OpsLifecycle.html`, `AdminUI_OpsCommunications.html`, `AdminUI_OpsApplicantQueue.html`, `AdminUI_SharedRowFacts.html`, `whoami_admin.html`
- Tests: all `tests/*.js`
- Metadata: `Config.js`, `appsscript.json`

The analysis extracted:

- `function name(...)` declarations
- intra-runtime `callee(...)` references
- `google.script.run.admin_*` and `google.script.run.legacy_admin_*` calls
- `onclick="..."` handlers
- route-to-handler mappings
- trigger/runner name candidates
- test file references to runtime function names

Limitations:

- Does not fully parse JavaScript AST or template string construction.
- Does not prove Apps Script editor/manual invocations.
- Does not prove installed trigger state.
- Does not prove external URLs/scripts calling query routes.
- Does not prove dead code by absence of static caller alone.

## Runtime Entry Graph

### Web Routes

| Route / entry | Handler | File / line | Classification | Notes |
| --- | --- | --- | --- | --- |
| `doGet` | route dispatcher | `Code.js:514` | SAFE_KEEP | Primary GET route. |
| `doPost` | intake / portal upload dispatcher | `Code.js:27` | SAFE_KEEP | Intake and upload-critical. |
| `diag` | `respondDiag_` | `Code.js:553` | KEEP_UNTIL_PROVEN | Diagnostic route; archive candidate only after support proof. |
| `whoami` | `doGet_whoami_` | `Code.js:554` | SAFE_KEEP | Release truth. |
| `file` | `doGet_file_` | `Code.js:555` | SAFE_KEEP | Signed document file route. |
| `driveapiprobe` | `doGet_driveApiProbe_` | `Code.js:556` | ARCHIVE_CANDIDATE | Probe route. |
| `drivedeepprobe` | `doGet_driveDeepProbe_` | `Code.js:557` | ARCHIVE_CANDIDATE | Probe route. |
| `driveprobe` | `doGet_driveProbe_` | `Code.js:558` | ARCHIVE_CANDIDATE | Probe route. |
| `portalsmoke` | `doGet_portalSmoke_` | `Code.js:559` | ARCHIVE_CANDIDATE | Smoke route. |
| `uploadsmoke` | `doGet_uploadSmoke_` | `Code.js:560` | ARCHIVE_CANDIDATE | Smoke route. |
| `ops` | `renderAdminApp_` | `Code.js:561` | OPS_FROZEN | Frozen secondary surface. |
| `admin` | `renderAdminApp_` | `Code.js:562` | SAFE_KEEP | Main Admin UI. |

### Primary Entry Chains

| Entry | Main callees observed | Classification |
| --- | --- | --- |
| `doGet` | `resolveDoGetHandler_`, `renderDoGetFatalHtml_`, `maybeRedirectToCanonical_`, route handlers | SAFE_KEEP |
| `doPost` | `canonicalizeFdIntakeFiles_`, `createApplicantFolder_`, `insertActivatedRowAt_`, `runFdAcknowledgementForCommittedRow_`, portal helpers | SAFE_KEEP |
| `admin_updateDocStatuses` | `admin_updateDocStatuses_impl_` | SAFE_KEEP |
| `admin_getApplicantDocumentManifest` | document manifest helpers, signed URL builder, row/folder/file resolvers | SAFE_KEEP |
| `admin_getApplicantDocumentImageRendition` | file resolver, `adminDocumentGalleryPrepareStoredRendition_` | SAFE_KEEP |
| `admin_previewApplicantMessage` | message normalization, actor resolution, `previewApplicantMessage_` | SAFE_KEEP |
| `admin_sendApplicantMessage` | operations role gate, OPS safe-mode gate, `sendApplicantMessage_` | SAFE_KEEP / HIGH_RISK |
| `admin_previewStageBatch` | stage mapping, preview cache, cohort collection, idempotency summary | SAFE_KEEP |
| `admin_sendStageBatch` | operations role gate, preview parity, send gate | SAFE_KEEP / HIGH_RISK |
| `automatedStageBatchRunner` | stabilization/trigger send gates, locked automated chunk runner | KEEP_UNTIL_PROVEN |

## RPC Map

The UI references 35 unique server RPC names. Static analysis found zero missing definitions.

| RPC group | RPCs | Classification |
| --- | --- | --- |
| Runtime/dashboard | `admin_getRuntimeInfo`, `admin_getOperationalDashboardMetrics`, `admin_getOperationalSafetyStatus` | SAFE_KEEP |
| Search/detail/queues | `admin_searchApplicants`, `admin_getApplicantDetail_json`, `admin_getReviewQueues`, `admin_getStageAggregation`, `admin_getActionabilityPreview`, `admin_getOpsLifecycleSummary` | SAFE_KEEP / OPS_FROZEN where OPS-only |
| Portal | `admin_getStudentPortalLink`, `admin_getPortalLink`, `admin_resetPortalSecret`, `admin_setPortalAccess`, `admin_backfillPortalTokens` | SAFE_KEEP for read/current actions; `admin_backfillPortalTokens` is KEEP_UNTIL_PROVEN |
| Documents | `admin_getApplicantDocumentManifest`, `admin_getApplicantDocumentImageRendition`, `admin_getApplicantDocumentFileAction`, `admin_updateDocStatuses` | SAFE_KEEP |
| Communications | `admin_getApplicantCommDerived_json`, `admin_previewApplicantMessage`, `admin_sendApplicantMessage`, `admin_previewStageBatch`, `admin_sendStageBatch`, `admin_sendDocsFollowupEmails`, `admin_runBounceScan` | SAFE_KEEP / HIGH_RISK for sends; bounce scan KEEP_UNTIL_PROVEN |
| Payment/Zoho | `admin_setPaymentVerified`, `admin_preflightZohoBooks`, `admin_previewZohoBooksFodePayload`, `admin_setZohoBooksOAuthProperties`, `admin_createZohoBooksFodeDraftInvoice`, `admin_sendZohoBooksTestInvoiceEmail` | HIGH_RISK / KEEP_UNTIL_PROVEN |
| OPS/classroom | `admin_previewOpsClassroomHandover`, `admin_notifyOpsClassroomAdmin` | OPS_FROZEN |
| Campaign report | `admin_getCampaignApplicationReport` | KEEP_UNTIL_PROVEN |
| Contact correction | `admin_updateParentEmailCorrected` | SAFE_KEEP |

## UI to Server Map

| UI surface | Server functions | Classification |
| --- | --- | --- |
| Admin boot/runtime | `admin_getRuntimeInfo`, `admin_getOperationalDashboardMetrics`, `admin_getReviewQueues`, `admin_getStageAggregation` | SAFE_KEEP |
| Applicant search/detail | `admin_searchApplicants`, `admin_getApplicantDetail_json` | SAFE_KEEP |
| Review modal document cards/gallery | `admin_getApplicantDocumentManifest`, `admin_getApplicantDocumentImageRendition`, `admin_getApplicantDocumentFileAction`, `admin_updateDocStatuses` | SAFE_KEEP |
| Portal controls | `admin_getPortalLink`, `admin_resetPortalSecret`, `admin_setPortalAccess`, `admin_getStudentPortalLink` | HIGH_RISK / SAFE_KEEP |
| Selected communication | `admin_getApplicantCommDerived_json`, `admin_previewApplicantMessage`, `admin_sendApplicantMessage` | SAFE_KEEP / HIGH_RISK |
| Stage Batch | `admin_previewStageBatch`, `admin_sendStageBatch` | SAFE_KEEP / HIGH_RISK |
| Zoho/Books | `admin_preflightZohoBooks`, `admin_previewZohoBooksFodePayload`, `admin_createZohoBooksFodeDraftInvoice`, `admin_sendZohoBooksTestInvoiceEmail`, `admin_setZohoBooksOAuthProperties` | HIGH_RISK |
| Backfill portal tokens UI | `admin_backfillPortalTokens` | KEEP_UNTIL_PROVEN |
| OPS surfaces | OPS preview/send/classroom/lifecycle RPCs | OPS_FROZEN |

## Trigger Map

| Trigger / runner candidate | File / line | Classification | Evidence / note |
| --- | --- | --- | --- |
| `automatedStageBatchRunner` | `Code.js:9286` | KEEP_UNTIL_PROVEN | Trigger handler candidate documented in `docs/stabilization/TRIGGER_INVENTORY.md`. |
| `runAutomatedStageBatchScheduled` | `Code.js:9315` | KEEP_UNTIL_PROVEN | Scheduled runner wrapper. |
| `admin_getAutomatedStageRunnerStatus` | `Code.js:9390` | KEEP_UNTIL_PROVEN | Status view; no UI RPC found in current AdminUI. |
| `admin_installOrUpdateAutomatedStageRunnerTrigger` | `Code.js:9397` | HIGH_RISK | Trigger mutation; do not remove or use without LAP decision. |
| `admin_runAutomatedStageBatchOnce` | `Admin.js:6827` | KEEP_UNTIL_PROVEN | Manual runner; mutation-capable. |
| `admin_installAutomatedStageRunnerTrigger` | `Admin.js:6841` | HIGH_RISK | Trigger mutation wrapper. |
| `admin_removeAutomatedStageRunnerTrigger` | `Admin.js:6854` | HIGH_RISK | Trigger mutation wrapper. |
| `campaign_processBounces_` | `Code.js:10423` | KEEP_UNTIL_PROVEN | Bounce/contactability path. |
| `campaign_syncResponses_` | `Code.js:9911` | KEEP_UNTIL_PROVEN | Legacy campaign path. |
| `campaign_sendLegacyFollowups_` | `Code.js:10427` | HIGH_RISK | Send-capable legacy path. |

## Dynamic Reference Map

| Dynamic reference source | Pattern | Risk | Classification |
| --- | --- | --- | --- |
| Generic UI RPC helper | `run_(fnName, payload, cb)` / string names | Could call functions not found by direct `.admin_*(` scan | UNKNOWN_DYNAMIC_REFERENCE |
| Communication action helper | `runCommunicationsAction_("admin_previewApplicantMessage", ...)` | String-based but observed explicit names | SAFE_KEEP |
| Stage Batch helpers | Shared preview/send UI paths | Function names partly dynamic by surface | SAFE_KEEP |
| Apps Script editor Run dropdown | Top-level `admin_*`, `test_*`, trigger, manual functions | Static caller absence does not prove dead code | UNKNOWN_DYNAMIC_REFERENCE |
| Route query parameter dispatch | `?view=...`, `?route=...`, `?view=file` | External URLs can call route handlers | UNKNOWN_DYNAMIC_REFERENCE |
| Trigger registrations | Script Properties / Apps Script triggers | Installed trigger state not proven by repo | UNKNOWN_DYNAMIC_REFERENCE |

## Test Coverage Map

| Test file | Runtime areas covered |
| --- | --- |
| `tests/admin-document-file-action.test.js` | Signed file action route, image/PDF rendition, no raw Drive exposure, Drive write limited to `FODE_PREVIEW` PNGs. |
| `tests/admin-document-gallery-ui.test.js` | AdminUI document gallery, image rendition, large viewer/lightbox branches. |
| `tests/admin-document-manifest.test.js` | Document manifest, file IDs, metadata, signed URLs, field mapping. |
| `tests/admin-document-preview-backfill.test.js` | Backfill dry-run/execute entrypoints and shared implementation. |
| `tests/admin-document-status-save-persistence.test.js` | Document status persistence, `Docs_Verified` sync, title-case stored values. |
| `tests/admin-document-verifier-role.test.js` | Document verifier role gates, Stage Batch role gates, payment/Zoho restricted gates. |
| `tests/admin-review-queue-rollup-consistency.test.js` | Queue tolerance for computed document verification and payment-stage routing. |
| `tests/communication-semantic-registry.test.js` | Message registry, selected-only `custom_email`, Stage Batch mapping safety, template placeholder rules. |
| `tests/fd-empty-document-payload-warning.test.js` | FD empty document payload warning and preview rendition hook. |

Coverage gaps:

- No generated test asserting probe routes are absent/disabled.
- No test proving every `admin_*` write RPC has zero-write failure handling.
- No test proving trigger install/remove functions are unreachable in normal Admin UI.
- No systematic test for OPS frozen status beyond role/surface guard checks.
- No machine-readable full call graph artifact committed; this report records static analysis summaries and F2B candidates.

## Candidate Classification Summary

| Classification | Count / scope | Notes |
| --- | ---: | --- |
| Functions statically indexed | 926 | All server-side `function` declarations across core runtime files. |
| Public `admin_*` functions | 78 | 35 directly referenced by UI RPCs; others require proof. |
| UI RPCs | 35 | All resolved to definitions. |
| Route handlers | 10 | 5 diagnostic/probe/smoke route candidates. |
| Trigger/runner candidates | 33 | LAP/campaign/trigger helpers; most are high-risk. |
| Static no-known-caller functions | 125 | Must not be removed without proof; many are editor/route/trigger/dynamic candidates. |
| Archive/remove candidate rows proposed | 46 | Candidate rows across Batches A-D, not approved removals. |
| High-confidence remove candidates | 14 | Mostly editor diagnostics and smoke/probe helpers, still require proof. |

## Archive Batches

### Batch A - Editor Diagnostics / `test_*` Helpers / Probe Routes

| Candidate | Why removable | Evidence | Risk | Rollback | Tests protecting removal | Confidence |
| --- | --- | --- | --- | --- | --- | --- |
| `test_ShowConfig` | Editor diagnostic | No UI RPC; named test helper | Low | Git revert | Syntax + health proof | High |
| `test_DumpConfigKeys` | Editor diagnostic | No UI RPC | Low | Git revert | Syntax + health proof | High |
| `test_LogSheetWrite` | Editor diagnostic with Sheet write risk | No UI RPC; writes log sheet | Medium | Git revert | Health proof; no Sheet mutation in tests | High |
| `_claspPing` | Historical clasp ping | No UI RPC | Low | Git revert | Syntax | High |
| `test_Smoke` | Utility smoke | No UI RPC | Low | Git revert | Syntax | Medium |
| `test_PortalLogWrite` | Portal log write diagnostic | No UI RPC; write-capable | Medium | Git revert | Health proof | High |
| `test_AdminAuth` | Admin auth diagnostic | No UI RPC | Low | Git revert | Role tests | Medium |
| `test_AdminResetPortalLink` | Portal mutation diagnostic | No UI RPC; reset risk | High | Git revert | Portal role tests/manual proof | High, if unused |
| `test_BackfillPortalTokens_DryRun` | Backfill diagnostic | No UI RPC | Low | Git revert | Syntax | Medium |
| `driveapiprobe` route | Diagnostic route | Route map only | Medium | Git revert | Health + whoami + no route dependency proof | Medium |
| `drivedeepprobe` route | Diagnostic route | Route map only | Medium | Git revert | Health + whoami | Medium |
| `driveprobe` route | Diagnostic route | Route map only | Medium | Git revert | Health + whoami | Medium |
| `portalsmoke` route | Smoke route | Route map only | Medium | Git revert | Portal smoke replacement proof | Medium |
| `uploadsmoke` route | Smoke route | Route map only | Medium | Git revert | Portal upload tests/manual proof | Medium |

Batch A recommendation: F2B should produce a removal patch for editor diagnostics first, then route probes only after confirming no current support workflow depends on those URLs.

### Batch B - Manual Wrappers / Maintenance UI

| Candidate | Why archive candidate | Evidence | Risk | Rollback | Tests protecting removal | Confidence |
| --- | --- | --- | --- | --- | --- | --- |
| `admin_backfillPortalTokensDryRun` | Historical migration wrapper | Calls `admin_backfillPortalTokens` | Medium | Git revert | Portal link tests/manual proof | Medium |
| `admin_backfillPortalTokensApply` | Historical migration wrapper | Calls `admin_backfillPortalTokens` | High | Git revert | Portal link tests/manual proof | Medium |
| `adminDryRunFirst50LegacyInvites` | Legacy campaign dry-run | Not UI RPC | Medium | Git revert | Communication tests | Medium |
| Property inventory display wrappers | Maintenance display only | No UI RPC found | Low | Git revert | Operational safety UI proof | Medium |
| Property cleanup dry-run wrappers | Maintenance cleanup path | No UI RPC found | Medium | Git revert | Communication tests | Medium |
| `admin_confirmCleanupCommLastBatch500` | Cleanup apply path | No UI RPC; mutation-capable | High | Git revert | Communication tests + property inventory proof | Medium |

Batch B recommendation: archive only after confirming Script Properties cleanup is no longer needed.

### Batch C - Campaign Legacy

| Candidate group | Why archive candidate | Evidence | Risk | Rollback | Tests protecting removal | Confidence |
| --- | --- | --- | --- | --- | --- | --- |
| `admin_campaignPrepareLegacyRows` / `campaign_prepareLegacyRows_` | Old campaign preparation | Not in current UI RPC list | Medium | Git revert | Communication tests | Low |
| `admin_campaignSendLegacyBatch` / `campaign_sendLegacyBatch_` | Legacy send batch | Stabilization blocks exist | High | Git revert | Communication send tests/manual proof | Low |
| `admin_campaignSyncResponses` / `campaign_syncResponses_` | Legacy sync | Not current priority | Medium | Git revert | Communication tests | Low |
| `admin_campaignProcessBounces` / `campaign_processBounces_` | Bounce/contactability path | H4 contactability not fully settled | High | Git revert | H4/Gmail proof needed | Low |
| `admin_campaignSendLegacyFollowups` / `campaign_sendLegacyFollowups_` | Legacy follow-up sends | Send-capable | High | Git revert | Communication tests/manual no-send proof | Low |
| `admin_campaignGetLegacyEmailSummary` / `campaign_getLegacyEmailSummary_` | Legacy reporting | Not current UI RPC list | Low | Git revert | Dashboard proof | Low |
| `admin_planLegacyInviteBatch` | Legacy invite planning | Uses current message model but legacy flow | Medium | Git revert | Communication tests | Low |

Batch C recommendation: do not remove until GF/marketing response architecture decides whether these flows are archived or replaced.

### Batch D - Maintenance Utilities / LAP Scaffolds

| Candidate group | Classification | Why not immediate removal |
| --- | --- | --- |
| `admin_backfillPortalTokens` | KEEP_UNTIL_PROVEN | Still referenced by AdminUI backfill control. |
| `admin_cleanupEphemeralCommunicationProperties` | KEEP_UNTIL_PROVEN | May be needed for Script Properties hygiene. |
| `admin_getPropertyInventorySummary` / `admin_getPropertyPrefixBreakdown` | KEEP_UNTIL_PROVEN | Operational safety diagnostics. |
| `admin_runAutomatedStageBatchOnce` | KEEP_UNTIL_PROVEN | LAP/manual runner; future automation work. |
| Trigger install/remove helpers | HIGH_RISK | Mutates trigger state; audit separately, do not prune casually. |
| `automatedStageBatchRunner` and helpers | KEEP_UNTIL_PROVEN | Documented trigger handler candidate. |

Batch D recommendation: planning only until LAP and maintenance policy are decided.

### Batch E - OPS Planning Only

OPS remains `OPS_FROZEN`.

Do not remove OPS files/functions in F2B. First create an OPS-specific dependency plan covering:

- `AdminUI_OpsLifecycle.html`
- `AdminUI_OpsCommunications.html`
- `AdminUI_OpsApplicantQueue.html`
- `AdminUI_SharedRowFacts.html`
- OPS safe-mode gates
- OPS classroom notify
- OPS legacy Admin bridges

## Removal Candidate Risk Assessment

| Risk class | Impact | Mitigation |
| --- | --- | --- |
| Static false orphan | Function callable by Apps Script editor, URL route, or trigger despite no static caller | Require manual/source proof before removal. |
| Support route removal | Probe/smoke route may still be used for emergency diagnosis | Replace with documented tooling or retain under disabled flag. |
| Maintenance utility removal | Could block future cleanup/backfill/portal recovery | Move to documented maintenance playbook before deletion. |
| Legacy campaign removal | Could remove marketing/contactability evidence path | Defer until GF/marketing architecture replacement. |
| OPS removal | Could break frozen secondary surface | Defer entirely. |

## Recommended F2B Sequence

F2B should be a narrow removal-proof package, not a broad prune.

Recommended F2B:

1. Confirm no current release/tooling docs mention editor `test_*` helpers or `_claspPing`.
2. Confirm probe/smoke route URLs are not used by F: Playwright, DR tooling, or release docs.
3. Prepare a removal diff for editor diagnostics only.
4. Run syntax/tests and Admin staging health only if a runtime release is separately approved.
5. Leave routes, maintenance wrappers, campaign legacy, LAP, OPS, Zoho/payment, and communication send paths untouched in F2B unless separately scoped.

## Whether F2B May Begin

F2B may begin as **Batch A proof and editor-diagnostic removal planning**.

F2B is not authorised to remove high-risk send, payment, OPS, trigger, campaign, Drive, Sheet, or portal-token paths without a new CIS.

## Safety Confirmation

This task produced an audit report only.

No runtime code was edited.
No deletion was performed.
No refactor was performed.
No Apps Script source push occurred.
No Apps Script version was created.
No deployment was repinned.
No Sheet edit occurred.
No Drive edit occurred.
No production action occurred.
No Student staging action occurred.
No OPS action occurred.
No email was sent.
