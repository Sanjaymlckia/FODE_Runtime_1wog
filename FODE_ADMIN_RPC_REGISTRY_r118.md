# FODE Admin RPC Registry r118

Date: 2026-05-03

Authority:
- Repo: `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog`
- Baseline: `r118 / 118`
- Mode: local source audit only; no clasp, deploy, git finalization, Sheet, Drive, Gmail, CRM, or trigger mutation.

## Summary

Admin UI exposes 20 `admin_*` RPC names.

Risk class counts for UI-exposed RPCs:

| Risk class | Count |
|---|---:|
| read-only | 10 |
| safe mutation | 5 |
| dangerous mutation | 5 |

Key finding:
- `admin_getStageAggregation` and `admin_getReviewQueues` now use `getCallerEmail_()`.
- Multiple other UI-exposed RPCs still use `getActiveUserEmail_()` directly or through a wrapper. In the current Admin deployment model, live `whoami` has previously shown `activeUser=""` and `effectiveUser=sanjay@minervacenters.com`; those remaining active-user-only guards are likely to fail for the same identity-source reason.

## UI-Exposed Admin RPC Registry

| RPC | UI call | Server definition | Risk | Identity source | Gate | Logging | Mutates Sheet/Drive/Gmail/CRM/trigger state |
|---|---:|---:|---|---|---|---|---|
| `admin_backfillPortalTokens` | `AdminUI.html:3481` | `Admin.js:2592` | dangerous mutation | `getActiveUserEmail_()` | `isAdmin_`, `requireSuperAdmin_` | `Logger.log`, `log_` | Sheet and PortalSecrets rows when `dryRun=false`; no schema creation expected |
| `admin_exportPortalLinksCsv` | `AdminUI.html:3524` | `Admin.js:2788` | read-only | `getActiveUserEmail_()` | `isAdmin_`, `requireSuperAdmin_` | `Logger.log`, `log_` | No mutation observed; security-sensitive token/link export |
| `admin_getApplicantCommDerived_json` | `AdminUI.html:1070` | `Code.js:7353` | read-only | active-first expression using `getActiveUserEmail_()` when function exists; fallback to `getCallerEmail_()` is not reached when active is blank | `isAdmin_` | none observed | No mutation observed |
| `admin_getApplicantDetail_json` | `AdminUI.html:1205`, `AdminUI.html:2839`, `AdminUI.html:3400` | `Admin.js:447` wrapper; delegates to `Admin.js:229` `admin_getApplicantDetail` | read-only | wrapper none; delegated function uses `getActiveUserEmail_()` | delegated `isAdmin_` | `Logger.log` | No mutation observed |
| `admin_getReviewQueues` | `AdminUI.html:2056` | `Admin.js:2105` | read-only | `getCallerEmail_()` | `isAdmin_` | `Logger.log` queue scan/summary | No listed external mutation; reads script properties for docs follow-up sent state |
| `admin_getRuntimeInfo` | `AdminUI.html:3597` | `Code.js:3846` | read-only | none observed | none observed | none observed | No mutation observed |
| `admin_getStageAggregation` | `AdminUI.html:2000` | `Admin.js:2051` | read-only | `getCallerEmail_()` | `isAdmin_` | none observed | No mutation observed |
| `admin_getStudentPortalLink` | `AdminUI.html:941`, `AdminUI.html:3342` | `Code.js:3851` | read-only | `isAdminCaller_()` -> `getCallerEmail_()` via helper | `isAdminCaller_` | `Logger.log` start/ok/fail | No mutation observed |
| `admin_previewApplicantMessage` | `AdminUI.html:1213` | `Admin.js:3917` | read-only | `getActiveUserEmail_()` | `isAdmin_` | `withEnvelope_` exception logging | No mutation observed |
| `admin_previewStageBatch` | `AdminUI.html:1852` | `Admin.js:3449` | read-only | `getActiveUserEmail_()` | `isAdmin_`, `requireSuperAdmin_` | `withEnvelope_` exception logging | No Sheet/Drive/Gmail/CRM/trigger mutation observed; writes preview cache |
| `admin_resetPortalSecret` | `AdminUI.html:3374` | `Admin.js:477` wrapper; delegates to `Admin.js:534` `admin_resetPortalLink` | dangerous mutation | delegated function uses `getActiveUserEmail_()` | delegated `isAdmin_` | `Logger.log`, `logAdminEvent_` | Portal secret reset; writes PortalSecrets and existing admission token hash/issued columns when present |
| `admin_runBounceScan` | `AdminUI.html:835` | `Admin.js:2914`; delegates to `Code.js:8064` `admin_scanBounces_` | safe mutation | `getActiveUserEmail_()` | `isAdmin_` | `withEnvelope_`; campaign log inside bounce ingestion | Gmail read and Sheet/log updates for bounce status/suppression |
| `admin_searchApplicants` | `AdminUI.html:2743` | `Admin.js:155` | read-only | `getCallerEmail_()` | `isAdmin_` | none observed | No mutation observed |
| `admin_sendApplicantMessage` | `AdminUI.html:1232` | `Admin.js:3943` | dangerous mutation | `getActiveUserEmail_()` | `isAdmin_` | `withEnvelope_` exception logging | Gmail send and applicant contact tracking updates |
| `admin_sendDocsFollowupEmails` | `AdminUI.html:2694` | `Admin.js:1336` | dangerous mutation | `getActiveUserEmail_()` | `isAdmin_` | `withEnvelope_`, `logAdminEvent_` | Gmail send, docs-followup sent marker/state, logging |
| `admin_sendStageBatch` | `AdminUI.html:1963` | `Admin.js:3609` | dangerous mutation | `getActiveUserEmail_()` | `isAdmin_`, `requireSuperAdmin_` | `withEnvelope_` exception logging | Bulk Gmail send and applicant contact tracking updates |
| `admin_setOverallStatus` | `AdminUI.html:3250` | `Admin.js:790` | safe mutation | `getActiveUserEmail_()` | `isAdmin_`; override check via role helpers | `logAudit_`, `log_` | Sheet status fields and audit log |
| `admin_setPortalAccess` | `AdminUI.html:3280` | `Admin.js:852` | safe mutation | `getActiveUserEmail_()` | `isAdmin_`, `requireSuperAdmin_` | `log_` | Sheet portal access/status fields |
| `admin_updateDocStatuses` | `AdminUI.html:3232` | `Admin.js:597` wrapper; implementation at `Admin.js:612` | safe mutation | implementation uses `getActiveUserEmail_()` | implementation `isAdmin_` | `Logger.log`, `withEnvelope_`, `logAdminApiException_`, audit helpers | Sheet document status fields; may invoke existing workflow side effects according to status logic |
| `admin_updateParentEmailCorrected` | `AdminUI.html:3435` | `Admin.js:1476` | safe mutation | `getActiveUserEmail_()` | `isAdmin_`, `requireSuperAdmin_` | `withEnvelope_`, `logAdminEvent_` | Sheet parent email correction and audit state |

## Additional Top-Level `admin_*` Functions Not Observed In AdminUI

These are public-looking top-level functions but were not found as direct or string-based `AdminUI.html` calls in this audit.

| Function | Definition | Risk | Identity source | Notes |
|---|---:|---|---|---|
| `admin_getApplicantDetail` | `Admin.js:229` | read-only | `getActiveUserEmail_()` | Called by `admin_getApplicantDetail_json`; should normalize with the UI wrapper path. |
| `admin_generatePortalLink` | `Admin.js:473` | read-only | delegated | Alias to `admin_getPortalLink`. |
| `admin_getPortalLink` | `Admin.js:481` | read-only | `getActiveUserEmail_()` | Similar purpose to `Code.js` `admin_getStudentPortalLink`, but not observed in AdminUI. |
| `admin_resetPortalLink` | `Admin.js:534` | dangerous mutation | `getActiveUserEmail_()` | Underlying implementation for UI `admin_resetPortalSecret`. |
| `admin_verifyPayment` | `Admin.js:888` | safe mutation | delegated | Alias to `admin_setPaymentVerified`. |
| `admin_setPaymentVerified` | `Admin.js:892` | safe mutation | delegated to private implementation | Not observed in AdminUI. |
| `admin_backfillPortalTokensDryRun` | `Admin.js:2776` | read-only dry-run wrapper | delegated | Forces `dryRun=true` then calls `admin_backfillPortalTokens`. |
| `admin_backfillPortalTokensApply` | `Admin.js:2782` | dangerous mutation | delegated | Forces `dryRun=false` then calls `admin_backfillPortalTokens`. |
| `admin_campaignPrepareLegacyRows` | `Admin.js:2881` | safe mutation | `getActiveUserEmail_()` | Legacy campaign wrapper. |
| `admin_campaignSendLegacyBatch` | `Admin.js:2889` | dangerous mutation | `getActiveUserEmail_()` | Legacy campaign send wrapper. |
| `admin_campaignSyncResponses` | `Admin.js:2898` | safe mutation | `getActiveUserEmail_()` | Legacy response sync wrapper. |
| `admin_campaignProcessBounces` | `Admin.js:2906` | safe mutation | `getActiveUserEmail_()` | Delegates to bounce ingestion. |
| `admin_runAutomatedStageBatchOnce` | `Admin.js:2922` | dangerous mutation | `getActiveUserEmail_()` | Super-admin; can run automated send flow if invoked. |
| `admin_installAutomatedStageRunnerTrigger` | `Admin.js:2936` | dangerous mutation | `getActiveUserEmail_()` | Super-admin trigger installation. |
| `admin_removeAutomatedStageRunnerTrigger` | `Admin.js:2945` | dangerous mutation | `getActiveUserEmail_()` | Super-admin trigger removal. |
| `admin_campaignSendLegacyFollowups` | `Admin.js:2954` | dangerous mutation | `getActiveUserEmail_()` | Legacy follow-up sends. |
| `admin_campaignGetLegacyEmailSummary` | `Admin.js:2963` | read-only | `getActiveUserEmail_()` | Legacy summary read. |
| `admin_planApplicantBatch` | `Admin.js:3969` | read-only | `getActiveUserEmail_()` | Planning only; not observed in AdminUI. |
| `admin_planLegacyInviteBatch` | `Admin.js:4009` | read-only | delegated | Wrapper around `admin_planApplicantBatch`. |

Private/helper-like functions found and intentionally not counted as Admin UI RPCs:
- `Admin.js:612` `admin_updateDocStatuses_impl_`
- `Admin.js:898` `admin_setPaymentVerified_impl_`
- `Code.js:5797` `admin_listQueueRowObjects_`
- `Code.js:8064` `admin_scanBounces_`
- `Code.js:5705` `legacy_admin_getReviewQueues`
- `Code.js:5761` `legacy_admin_getQueueItems`

## Remaining `getActiveUserEmail_()` Call Sites

Direct call sites found:

| Location | Function/path | UI impact | Recommendation |
|---:|---|---|---|
| `Admin.js:232` | `admin_getApplicantDetail` | UI detail JSON delegates here | Normalize to `getCallerEmail_()`. |
| `Admin.js:493` | `admin_getPortalLink` | Not observed in current UI; related to portal link generation | Normalize to `getCallerEmail_()` in portal-link CIS. |
| `Admin.js:546` | `admin_resetPortalLink` | UI `admin_resetPortalSecret` delegates here | Normalize to `getCallerEmail_()`; preserve reset semantics. |
| `Admin.js:615` | `admin_updateDocStatuses_impl_` | UI save docs | Normalize to `getCallerEmail_()`; gate only. |
| `Admin.js:791` | `admin_setOverallStatus` | UI overall status update | Normalize to `getCallerEmail_()`; preserve role/override logic. |
| `Admin.js:853` | `admin_setPortalAccess` | UI portal lock/open | Normalize to `getCallerEmail_()`; preserve super-admin gate. |
| `Admin.js:901` | `admin_setPaymentVerified_impl_` | Not observed in current UI | Normalize in same mutation-gate cleanup phase if retained. |
| `Admin.js:1338` | `admin_sendDocsFollowupEmails` | UI docs follow-up send | Normalize to `getCallerEmail_()`; preserve send guards. |
| `Admin.js:1478` | `admin_updateParentEmailCorrected` | UI parent email correction | Normalize to `getCallerEmail_()`; preserve super-admin gate. |
| `Admin.js:2593` | `admin_backfillPortalTokens` | UI backfill tool | Normalize to `getCallerEmail_()`; preserve super-admin and dry-run/apply behavior. |
| `Admin.js:2789` | `admin_exportPortalLinksCsv` | UI export | Normalize to `getCallerEmail_()`; preserve super-admin gate. |
| `Admin.js:2883` | `admin_campaignPrepareLegacyRows` | Not observed in current UI | Normalize later if wrapper remains callable. |
| `Admin.js:2891` | `admin_campaignSendLegacyBatch` | Not observed in current UI | Normalize later if wrapper remains callable. |
| `Admin.js:2900` | `admin_campaignSyncResponses` | Not observed in current UI | Normalize later if wrapper remains callable. |
| `Admin.js:2908` | `admin_campaignProcessBounces` | Not observed in current UI | Normalize later if wrapper remains callable. |
| `Admin.js:2916` | `admin_runBounceScan` | UI bounce scan | Normalize to `getCallerEmail_()`. |
| `Admin.js:2924` | `admin_runAutomatedStageBatchOnce` | Not observed in current UI | Normalize only if keeping callable; preserve super-admin gate. |
| `Admin.js:2938` | `admin_installAutomatedStageRunnerTrigger` | Not observed in current UI | Normalize only if keeping callable; preserve super-admin gate. |
| `Admin.js:2947` | `admin_removeAutomatedStageRunnerTrigger` | Not observed in current UI | Normalize only if keeping callable; preserve super-admin gate. |
| `Admin.js:2956` | `admin_campaignSendLegacyFollowups` | Not observed in current UI | Normalize later if wrapper remains callable. |
| `Admin.js:2965` | `admin_campaignGetLegacyEmailSummary` | Not observed in current UI | Normalize later if wrapper remains callable. |
| `Admin.js:2974` | `serverEmail = clean_(getActiveUserEmail_() || "")` | Diagnostic/server context near campaign helpers | Review before changing; not a normal admin gate. |
| `Admin.js:3465` | `admin_previewStageBatch` | UI stage preview | Normalize to `getCallerEmail_()`; preserve super-admin gate and preview cache key behavior. |
| `Admin.js:3612` | `admin_sendStageBatch` | UI stage send | Normalize to `getCallerEmail_()`; preserve super-admin gate and preview/send parity. |
| `Admin.js:3919` | `admin_previewApplicantMessage` | UI single-message preview | Normalize to `getCallerEmail_()`. |
| `Admin.js:3945` | `admin_sendApplicantMessage` | UI single-message send | Normalize to `getCallerEmail_()`; preserve send safeguards. |
| `Admin.js:3971` | `admin_planApplicantBatch` | Not observed in current UI | Normalize later if wrapper remains callable. |
| `Code.js:7355` | `admin_getApplicantCommDerived_json` | UI comm derived panel | Normalize expression to prefer `getCallerEmail_()`; current active-first expression blocks fallback when active user is blank. |

## Recommended Safe Normalization List

Recommended for the next small CIS, with no allowlist change and no behavior change beyond identity source:

1. UI read-only RPCs:
   - `admin_getApplicantDetail` / `admin_getApplicantDetail_json`
   - `admin_getApplicantCommDerived_json`
   - `admin_previewApplicantMessage`
   - `admin_previewStageBatch`
   - `admin_exportPortalLinksCsv`

2. UI safe mutations:
   - `admin_updateDocStatuses_impl_`
   - `admin_setOverallStatus`
   - `admin_setPortalAccess`
   - `admin_updateParentEmailCorrected`
   - `admin_runBounceScan`

3. UI dangerous mutations, still recommended because the change is gate identity only:
   - `admin_resetPortalLink` via `admin_resetPortalSecret`
   - `admin_sendDocsFollowupEmails`
   - `admin_sendApplicantMessage`
   - `admin_sendStageBatch`
   - `admin_backfillPortalTokens`

4. Lower priority, not observed in current Admin UI:
   - Legacy campaign wrappers at `Admin.js:2881` through `Admin.js:2963`
   - Automated runner/trigger admin wrappers at `Admin.js:2922`, `Admin.js:2936`, `Admin.js:2945`
   - Planning wrappers at `Admin.js:3969`, `Admin.js:4009`
   - Portal link aliases not used by current UI: `admin_getPortalLink`, `admin_generatePortalLink`
   - Payment verification aliases not used by current UI: `admin_verifyPayment`, `admin_setPaymentVerified`

Do not normalize `Admin.js:2974` blindly. It is a diagnostic/server-email read, not a standard `isAdmin_` authorization gate.

## Urgent Issues

1. Many UI actions still use active-user-only authorization and can fail in the r116+ Admin deployment identity model where `activeUser` is blank and `effectiveUser` is populated.
2. `Code.js:7355` has an active-first fallback expression that does not fall back when `getActiveUserEmail_()` exists but returns blank.
3. Stage preview/send and single applicant preview/send still use `getActiveUserEmail_()`; if Admin UI loads but these RPCs fail, the failure mode should match the earlier Stage/Queues access-denied defect.

## Validation Commands

Requested commands run locally:

```powershell
git rev-parse --show-toplevel
git status -sb
rg "function admin_|admin_[A-Za-z0-9_]+|google.script.run" Admin.js AdminUI.html Code.js
rg "getActiveUserEmail_|getCallerEmail_|isAdmin_|requireSuperAdmin_|Access denied|Not authorized" Code.js Admin.js Utils.js
```

Validation notes:
- Repo root matched `E:/Gdrive/01 SANJAY/Codex_Sync/FODE_Runtime_1wog`.
- No source/runtime file edits were made for this audit.
- Existing untracked file observed before this audit: `FODE_CODE_HEALTH_AUDIT_r118.md`.
- This audit created only `FODE_ADMIN_RPC_REGISTRY_r118.md`.

## Verdict

AUDIT COMPLETE
