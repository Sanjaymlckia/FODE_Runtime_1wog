# F4H Admin.js Module Split Feasibility and Extraction Plan

Classification: Track L audit/planning only / no runtime release

## Executive Decision

PASS_WITH_WARNINGS.

`Admin.js` is feasible to split into Apps Script module files, but not as one large extraction. The safe path is a sequence of small, domain-bounded moves that preserve global function names, keep public `admin_*` RPC entrypoints stable, and validate after every batch.

Recommendation: proceed to F4I only as a narrow first extraction of document gallery/manifest helpers, or payment authority helpers if the operator prefers the strongest test-protected authority seam. Do not extract Zoho, communications, OPS, or Stage Batch first.

No runtime files were modified. No code moves, Apps Script push, deployment, version creation, repin, Sheet mutation, Drive mutation, live send, production action, Student action, or OPS action occurred.

Playwright not required.

## Baseline

- Active repo: `D:\Repos\FODE_Runtime_1wog`
- Current HEAD at analysis: `f791bb5 refactor: align communications ui metadata with registry`
- Live Admin staging: `r305 / 305`
- Student staging unchanged: `@247`
- Production untouched
- OPS frozen
- GitHub remains committed-source/review authority
- Live Apps Script `whoami` remains runtime truth

## Static Inventory

Static `Admin.js` function inventory:

| Metric | Count |
|---|---:|
| Total `function ...` declarations | 307 |
| Public `admin_*` functions | 71 |
| Private/helper functions | 236 |

Domain grouping from function names and local references:

| Domain | Approx. functions | Notes |
|---|---:|---|
| Queue/lifecycle/actionability/stage batch | 66 | Largest coupled area; high behavior risk. |
| Core shared helpers/envelope/search/detail | 57 | Cross-cutting; split late or into shared module only after dependencies are clearer. |
| Document gallery/manifest/rendition/backfill | 35 | Strong tests; good early extraction candidate if split into one module. |
| OPS/classroom/contact/WhatsApp | 33 | Frozen/protected; plan only. |
| Communications/stage batch email | 27 | Recently stabilized; avoid first extraction. |
| Document authority/status save | 19 | Strong tests; good candidate after gallery or payment. |
| Zoho Books/payment invoice | 17 | Protected live-write surface; do not extract first. |
| Portal security/access/tokens | 15 | Protected; extract only after explicit security gate. |
| Campaign legacy | 13 | Legacy but still referenced; proof required before movement/removal. |
| Reports/diagnostics/safety | 13 | Lower behavior risk but public/manual wrappers complicate authority. |
| Payment authority | 12 | Strong tests; good first or second candidate. |

## Candidate Module Table

| Candidate module | Suggested contents | Risk | Test coverage | Recommendation |
|---|---|---:|---|---|
| `Admin_DocumentGallery.js` | `admin_getApplicantDocumentManifest`, signed file-action resolver, PNG rendition helpers, preview backfill helpers | Medium | Strong: manifest, file action, gallery UI, preview backfill, verifier role | Best first extraction if limited to contiguous document gallery/manifest block. |
| `Admin_PaymentAuthority.js` | payment facts helpers, `admin_setPaymentVerified`, payment verification authority helpers | Medium | Strong: payment matrix, drift, nonqueue, role boundary | Safe early extraction, but write authority means use after one read-heavy extraction. |
| `Admin_DocumentAuthority.js` | document status normalization, `admin_updateDocStatuses`, Docs_Verified rollup helpers | Medium | Strong: status save, rollup, document verifier role, payment separation | Safe after gallery/payment; avoid mixing with queue engine in same batch. |
| `Admin_RowFacts.js` | row facts helpers from F4C/F4E, queue row facts, payment/document projection helpers | Medium | Strong but cross-domain | Extract only after payment/document helpers are stable in modules. |
| `Admin_QueueEngine.js` | `admin_getReviewQueues`, queue filters, dashboard queue helpers | High | Strong partial tests | Not first; depends on row facts, document authority, payment authority. |
| `Admin_LifecycleActionability.js` | actionability preview, lifecycle summary, stage aggregation read models | High | Moderate/static | Extract after queue engine boundaries are clear. |
| `Admin_Communications.js` | selected message preview/send, Stage Batch preview/send, comm actor/gates | High | Strong tests but recently changed | Defer until F4F/F4G settles and one or two non-communications extractions pass. |
| `Admin_DocumentGallery.js` plus backfill wrappers | Same as gallery plus manual backfill wrappers | Medium-high | Good | Keep wrappers in same module only if explicitly retained; otherwise document separately. |
| `Admin_ZohoBooks.js` | OAuth setup, preview, draft invoice, test invoice email, writeback | Very high | Role tests exist; live-write behavior protected | Do not extract until late and under a Zoho-specific CIS. |
| `Admin_PortalSecurity.js` | portal link, reset, access lock/unlock, token backfill/export | High | Role/RPC tests partial | Security-sensitive; not first. |
| `Admin_OPS.js` | OPS lifecycle, classroom handover, WhatsApp fallback | High/frozen | Partial/static | Frozen; do not touch unless OPS is reactivated. |
| `Admin_ReportsDiagnostics.js` | dashboard metrics, campaign report, property inventory, cleanup displays | Medium | Mixed | Later low-risk cleanup, but manual wrappers must be inventoried first. |

## Function / Domain Inventory

### Core entry and authorization

Representative functions:

- `renderAdminApp_`
- `isAdmin_`
- `getAdminRole_`
- `requireSuperAdmin_`
- `requireOperationsAdmin_`
- `requireDocumentVerifier_`
- `withEnvelope_`
- `ok_`
- `err_`

Recommendation: keep these in `Admin.js` or move only to a later `Admin_Core.js` after all domain modules are stable. They are cross-cutting and affect every module.

### Public `admin_*` RPCs That Must Remain Stable

Examples with visible UI/test references:

- `admin_getRuntimeInfo`
- `admin_getReviewQueues`
- `admin_getApplicantDetail_json`
- `admin_getApplicantDetail`
- `admin_searchApplicants`
- `admin_updateDocStatuses`
- `admin_setPaymentVerified`
- `admin_getApplicantDocumentManifest`
- `admin_getApplicantDocumentFileAction`
- `admin_getApplicantDocumentImageRendition`
- `admin_previewApplicantMessage`
- `admin_sendApplicantMessage`
- `admin_previewStageBatch`
- `admin_sendStageBatch`
- `admin_previewZohoBooksFodePayload`
- `admin_createZohoBooksFodeDraftInvoice`
- `admin_sendZohoBooksTestInvoiceEmail`
- `admin_getPortalLink`
- `admin_resetPortalLink`
- `admin_setPortalAccess`
- `admin_previewOpsClassroomHandover`

Apps Script RPC names are global symbols. Extraction must preserve exact public names and signatures. Do not rename public entrypoints during module split.

### Document gallery / signed file routes

Representative functions:

- `adminDocumentManifestTypeForField_`
- `adminDocumentManifestFileIds_`
- `admin_getApplicantDocumentManifest`
- `adminResolveApplicantDocumentFile_`
- `admin_getApplicantDocumentFileAction`
- `adminDocumentGalleryRendition*`
- `admin_getApplicantDocumentImageRendition`
- `adminDocumentPreviewBackfillBatch_`
- `admin_dryRunDocumentPreviewBackfill`
- `admin_runDocumentPreviewBackfillBatch`

This is the best read-heavy extraction candidate, but the signed file action and rendition helpers are security/Drive-sensitive. Keep the full domain in one module and do not split file action from its resolver.

### Payment authority

Representative functions:

- `adminRowPaymentEvidencePresent_`
- `adminRowPaymentCompatibilityRawVerified_`
- `adminRowPaymentAuthorityFacts_`
- `admin_setPaymentVerified`
- `admin_setPaymentVerified_impl_`
- payment verification trigger helpers

This is well covered by F3/F4 tests. It remains a mutation surface, so extract after one read-heavy module proves Apps Script load order and global references remain stable.

### Document authority

Representative functions:

- `admin_updateDocStatuses`
- `admin_updateDocStatuses_impl_`
- `normalizeDocStatus_`
- `recomputeOverallDocStatus_`
- `adminDocumentRequiredUploadFields_`
- `adminDocumentReviewVerifiedForPaymentGate_`
- `adminDocumentReviewVerifiedForAutomation_`

This is well covered but writes document status and compatibility rollups. Keep separate from queue engine in its own extraction.

### Queue/lifecycle/actionability

Representative functions:

- `admin_getReviewQueues`
- `isQueueCandidateRow_`
- `filterDocumentsToVerifyQueue_`
- `deriveOperationalPipelineStage_`
- `admin_getActionabilityPreview`
- `admin_getStageAggregation`
- `admin_traceStageBatchEligibility`
- stage aggregation helpers

High coupling. Extract only after row facts, payment, and document authority seams are already modularized and validated.

### Communications

Representative functions:

- `admin_previewApplicantMessage`
- `admin_sendApplicantMessage`
- `admin_previewStageBatch`
- `admin_sendStageBatch`
- stage batch preview cache helpers
- `resolveAdminCommActor_`
- message-type/stage helpers

Communications v1.0 is stable and recently refactored through F4F/F4G. Avoid extraction until the module split process proves safe on less recently touched domains.

### Zoho Books

Representative functions:

- `admin_previewZohoBooksFodePayload`
- `admin_createZohoBooksFodeDraftInvoice`
- `admin_sendZohoBooksTestInvoiceEmail`
- `buildZohoBooksPreviewResult_`
- `applyZohoBooksWritebackPatch_`
- OAuth property setup helpers

Protected live-write surface. Do not extract early. Use a Zoho-specific CIS with live-write boundary review when ready.

### Portal security

Representative functions:

- `admin_getPortalLink`
- `admin_resetPortalLink`
- `admin_setPortalAccess`
- `admin_backfillPortalTokens`
- portal token/export helpers

Security-sensitive and partially manual/backfill oriented. Extract only after a portal security-specific proof pass.

### OPS / classroom / WhatsApp fallback

Representative functions:

- `admin_getOpsLifecycleSummary`
- `buildOpsClassroomHandoverContext_`
- `admin_previewOpsClassroomHandover`
- `admin_notifyOpsClassroomAdmin`
- WhatsApp fallback export/email helpers

OPS is frozen. Treat as protected/frozen; do not extract unless the operator explicitly reopens OPS work.

## Dependency-Risk Matrix

| Dependency type | Risk | Notes |
|---|---:|---|
| Apps Script global load order | Medium | Apps Script loads project files into one global scope, but file ordering can affect initialization if top-level constants or immediate calls are introduced. Extraction must move function declarations only, no top-level side effects. |
| Public RPC names | High | `google.script.run` calls depend on exact `admin_*` names. Public entrypoints must not be renamed or wrapped differently. |
| Shared helpers (`clean_`, payment/document helpers, sheet helpers) | Medium | Many domain helpers consume shared utilities from `Code.js`, `Utils.js`, and `Admin.js`. Move shared helpers late or keep them in `Admin.js` initially. |
| Tests using extraction by function name | Medium | Tests use source extraction helpers against `Admin.js`. First extraction must update test harnesses to read module files or concatenate Admin modules. |
| Signed file/action routes | High | File action/rendition uses token/security helpers and Drive access. Keep resolver, signer usage, and public RPCs together. |
| Mutation surfaces | High | Payment, document status, Zoho, portal, Stage Batch send, selected send all mutate or can send. Extract only with targeted authority tests. |
| OPS frozen code | High | Frozen surface; avoid movement until explicitly reopened. |

## Apps Script Load-Order Notes

Apps Script does not use Node-style imports. All `.js` files share a global project scope.

Extraction rules:

1. New module files must contain only function declarations and safe constants.
2. Do not introduce `require`, `import`, `export`, or module wrappers.
3. Do not introduce top-level execution.
4. Preserve exact public `admin_*` function names.
5. Keep shared helpers available globally.
6. Keep `.clasp.json` unchanged.
7. After any extraction, source push/release must verify the new files appear in Apps Script remote source before versioning.

## Test Coverage Matrix

| Candidate module | Existing tests |
|---|---|
| Document gallery/manifest/rendition | `admin-document-manifest`, `admin-document-file-action`, `admin-document-gallery-ui`, `admin-document-preview-backfill`, `admin-document-verifier-role`, `admin-ui-rpc-contract` |
| Payment authority | `payment-authority-matrix`, `payment-authority-drift`, `payment-authority-nonqueue-consumers`, `admin-role-boundary-matrix`, `admin-review-queue-rollup-consistency` |
| Document authority/status save | `admin-document-status-save-persistence`, `admin-review-queue-rollup-consistency`, `admin-document-verifier-role`, payment authority tests |
| Communications | `communication-semantic-registry`, `communication-send-gate-matrix`, `admin-ui-rpc-contract` |
| Queue engine | `admin-review-queue-rollup-consistency`, payment authority tests, Admin UI RPC contract |
| Portal security | `admin-role-boundary-matrix`, Admin UI RPC contract; needs stronger portal-specific tests before extraction |
| Zoho Books | `admin-document-verifier-role`, `admin-role-boundary-matrix`, Admin UI RPC contract; needs Zoho-specific no-write extraction tests |
| OPS/classroom | payment nonqueue tests touch classroom handover; coverage is insufficient for first extraction |
| Reports/diagnostics | Sparse/static; not first |

## Recommended Extraction Sequence

### F4I - First extraction

Recommended:

`Admin_DocumentGallery.js`

Move one contiguous document gallery/manifest/rendition/backfill block only:

- document manifest helpers
- file action resolver helpers
- PNG rendition helpers
- document preview backfill helpers
- public document gallery/file action RPCs

Keep unchanged:

- public function names
- signed URL behavior
- Drive access behavior
- manifest DTO shapes
- backfill dry-run/execute behavior
- all route functions in `Routes.js`

Why first:

- Strongest self-contained read-heavy domain.
- Good tests already exist.
- Less entangled with payment/queue/communication than queue engine.
- Proves Apps Script multi-file load behavior without touching send/payment/Zoho.

Batch size:

- One module file only.
- Move no more than the document gallery/manifest/rendition/backfill domain.
- Do not combine with document status save.

### F4J - Second extraction

`Admin_PaymentAuthority.js`

Move payment authority helpers and payment verification RPC only after F4I validates the extraction pattern.

### F4K - Third extraction

`Admin_DocumentAuthority.js`

Move document status save and Docs_Verified rollup helpers only after payment authority remains stable.

### Later candidates

1. `Admin_RowFacts.js`
2. `Admin_QueueEngine.js`
3. `Admin_LifecycleActionability.js`
4. `Admin_Communications.js`
5. `Admin_PortalSecurity.js`
6. `Admin_ZohoBooks.js`
7. `Admin_ReportsDiagnostics.js`
8. `Admin_OPS.js` only if OPS is unfrozen

## Files That Must Not Be Split Yet

Do not split these first:

- Zoho Books functions
- selected-applicant send/Stage Batch send functions
- OPS/classroom/WhatsApp fallback functions
- portal secret/reset/access lock functions
- queue engine and stage aggregation
- core envelope/authorization helpers

Reason: these are protected, mutation-capable, recently stabilized, or high-coupling surfaces.

## First Extraction CIS Recommendation

Suggested next CIS:

`F4I Admin Document Gallery Module Extraction`

Scope:

- create `Admin_DocumentGallery.js`
- move only document gallery/manifest/file-action/rendition/backfill functions
- update tests to read concatenated Admin module sources or include the new module explicitly
- no behavior changes
- no Apps Script push/deploy/version/repin
- no Drive/Sheet/send action

Validation:

- `node --check Admin.js Admin_DocumentGallery.js Code.js Routes.js Utils.js Config.js`
- `node tests/admin-document-manifest.test.js`
- `node tests/admin-document-file-action.test.js`
- `node tests/admin-document-gallery-ui.test.js`
- `node tests/admin-document-preview-backfill.test.js`
- `node tests/admin-document-verifier-role.test.js`
- `node tests/admin-ui-rpc-contract.test.js`
- `git diff --check`

Playwright not required unless a release CIS later requests browser proof.

## Rollback Strategy

For planning/audit only: revert the F4H docs commit.

For future extraction:

1. Revert the extraction commit.
2. No deployment rollback is needed if no Apps Script source push occurred.
3. If extraction was released later, rollback by repinning Admin staging to the previous accepted Apps Script version first, then patch forward only after source is corrected.

## Whether F4I May Begin

F4I may begin after review if it is limited to one module: `Admin_DocumentGallery.js`.

F4I should not include payment, document status save, communications, Stage Batch, portal security, Zoho, queue engine, or OPS.

## Validation

- repo search/static analysis only: PASS
- `git diff --check`: PASS
- `git diff --cached --check`: PASS
- runtime files modified: NO
- Apps Script push/deploy/version/repin: NO
- Sheet/Drive/send/production/Student/OPS actions: NO
