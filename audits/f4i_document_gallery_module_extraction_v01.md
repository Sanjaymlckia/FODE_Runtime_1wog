# F4I Document Gallery Module Extraction

Classification: Track H refactor-only / no runtime release

## Executive Result

PASS_WITH_WARNINGS.

F4I completed the first physical `Admin.js` module extraction by moving the Document Gallery subsystem into `Admin_DocumentGallery.js`.

Behavior is intended to be unchanged. Public RPC names and signatures are preserved as Apps Script global functions. No Apps Script push, deployment, version creation, repin, Sheet mutation, Drive mutation, live send, production action, Student action, or OPS action occurred.

Playwright not required.

## Stash Handling Result

Preflight:

- repo was clean/aligned with `origin/main`
- `stash@{0}` was inspected before apply
- stash label: `WIP F4I document gallery extraction before F4H.1 governance`
- stash content: `Admin.js` plus `Admin_DocumentGallery.js`

Decision: apply stash.

Result: clean apply, no conflicts. The stash was applied but not dropped.

## Files Changed

- `Admin.js`
- `Admin_DocumentGallery.js`
- `tests/admin-document-manifest.test.js`
- `tests/admin-document-file-action.test.js`
- `tests/admin-document-preview-backfill.test.js`
- `tests/admin-document-verifier-role.test.js`
- `tests/admin-ui-rpc-contract.test.js`
- `audits/f4i_document_gallery_module_extraction_v01.md`

## Functions Moved

Moved to `Admin_DocumentGallery.js`:

- `adminDocumentManifestTypeForField_`
- `adminDocumentManifestExtension_`
- `adminDocumentManifestMimeExtensionMismatch_`
- `adminDocumentManifestIso_`
- `adminDocumentManifestFileIds_`
- `adminDocumentManifestParentIds_`
- `adminDocumentManifestFileMetadata_`
- `adminDocumentManifestPrefixField_`
- `adminDocumentManifestWarning_`
- `admin_getApplicantDocumentManifest`
- `adminDocumentFileActionField_`
- `adminResolveApplicantDocumentFile_`
- `adminDocumentGalleryRenditionHash_`
- `adminDocumentGalleryRenditionFolder_`
- `adminDocumentGalleryRenditionSourceStamp_`
- `adminDocumentGalleryRenditionKey_`
- `adminDocumentGalleryRenditionFileName_`
- `adminDocumentGalleryFindStoredRendition_`
- `adminDocumentGalleryFetchPdfThumbnailBlob_`
- `adminDocumentGalleryBuildPngRenditionBlob_`
- `adminDocumentGalleryGetOrCreateStoredRendition_`
- `adminDocumentGalleryInspectStoredRendition_`
- `adminDocumentGalleryPrepareStoredRendition_`
- `adminDocumentGalleryInspectRenditionCandidate_`
- `admin_getApplicantDocumentImageRendition`
- `adminResolveApplicantDocumentFileFromRow_`
- `adminDocumentPreviewBackfillBatch_`
- `admin_dryRunDocumentPreviewBackfill`
- `admin_runDocumentPreviewBackfillBatch`
- `admin_getApplicantDocumentFileAction`

## Functions Intentionally Left In `Admin.js`

Left in `Admin.js`:

- generic Admin app rendering and RPC envelope helpers
- role gates and authorization helpers
- applicant search/detail DTOs
- Zoho Books
- portal access/security
- document verification status save and Docs_Verified rollup authority
- payment authority
- queue/lifecycle/actionability
- communications and Stage Batch
- OPS/classroom/WhatsApp fallback
- reports/diagnostics/property utilities

## Public RPC Compatibility Proof

Public RPC names remain identical:

- `admin_getApplicantDocumentManifest`
- `admin_getApplicantDocumentImageRendition`
- `admin_getApplicantDocumentFileAction`
- `admin_dryRunDocumentPreviewBackfill`
- `admin_runDocumentPreviewBackfillBatch`

Apps Script global-scope behavior is preserved: moving these functions to another `.js` project file does not change their global symbol names.

`admin-ui-rpc-contract.test.js` now concatenates `Admin_DocumentGallery.js` with the server source set, proving `google.script.run` references still resolve to server functions.

## Dependency Map

`Admin_DocumentGallery.js` depends on existing global helpers/config:

- `clean_`
- `safeJson_`
- `ok_`
- `err_`
- `withEnvelope_`
- `getCallerEmail_`
- `requireDocumentVerifier_`
- `openDataSheet_`
- `extractDriveFolderId_`
- `extractDriveFileIds_`
- `buildSignedDocumentFileActionUrl_`
- `getPortalSecretForApplicant_`
- `CONFIG.DOC_FIELDS`
- `DriveApp`
- `Utilities`

No shared helper was moved. This keeps the first extraction low-risk and proves module separation without changing shared utility ownership.

## Reusable Extraction Pattern For Future Modules

Future Admin module splits should follow this pattern:

1. Preserve public RPC names exactly.
2. Move only one authority seam per CIS.
3. Keep Apps Script global functions as plain `function` declarations; do not introduce `import`, `export`, `require`, or wrappers.
4. Add no top-level executable side effects.
5. Move private helpers only when they are exclusive to the extracted seam.
6. Leave shared helpers in place unless the CIS explicitly defines a shared-helper extraction.
7. Update tests to read the new module file when they inspect moved functions.
8. Validate only changed runtime files and tests protecting the changed authority surface.
9. Do not run Playwright for refactor-only extraction.
10. Roll back by reverting the extraction commit; no deployment rollback is needed unless a later release deployed it.

Naming convention:

- `Admin_<Domain>.js`
- keep public `admin_*` names unchanged
- keep private helpers with their existing trailing `_` convention

Apps Script load-order note:

- Apps Script loads `.js` project files into one global scope.
- This pattern is safe only for function declarations and passive constants.
- Avoid top-level execution that depends on file load order.

## Admin.js Line-Count Reduction

Measured line counts:

- `Admin.js` before extraction: 8,495 lines
- `Admin.js` after extraction: 7,705 lines
- new `Admin_DocumentGallery.js`: 793 lines
- `git diff --numstat` for `Admin.js`: 1 insertion, 843 deletions

## Tests Run

Changed runtime syntax:

- `node --check Admin.js` PASS
- `node --check Admin_DocumentGallery.js` PASS

Document Gallery protected surface:

- `node tests/admin-document-manifest.test.js` PASS
- `node tests/admin-document-file-action.test.js` PASS
- `node tests/admin-document-gallery-ui.test.js` PASS
- `node tests/admin-ui-rpc-contract.test.js` PASS
- `node tests/admin-document-preview-backfill.test.js` PASS
- `node tests/admin-document-verifier-role.test.js` PASS

Repository checks:

- `git diff --check` PASS
- `git diff --cached --check` PASS

## Behaviour Preserved Statement

Document Gallery behavior is preserved:

- manifest lookup remains document-verifier gated
- file action lookup remains document-verifier gated
- signed file action route compatibility is unchanged
- image/PDF rendition helpers remain available
- backfill dry-run/execute wrappers keep the same names and behavior
- AdminUI RPC names remain unchanged
- no UI rendering, gallery layout, lightbox, download/open-original, or preview behavior was intentionally changed

## Rollback Strategy

Revert the F4I commit to restore the monolithic `Admin.js` layout. No deployment rollback is required because this CIS performs no Apps Script source push, version creation, or staging repin.

If a later release deploys this extraction and fails, rollback staging first by repinning Admin staging to the previous accepted Apps Script version, then revert or patch forward from GitHub source.

## Recommended Next Extraction Candidate

Recommended F4J:

`Admin_PaymentAuthority.js`

Reason:

- strong payment authority tests already exist
- smaller seam than queue/lifecycle
- should be performed after one read-heavy module extraction has proven the Apps Script global module pattern

Do not extract communications, Zoho, portal/security, queue engine, or OPS next.

## Windows Runner Note

Normal runner failed once with `CreateProcessAsUserW failed: 1312` during stash/test inspection. Per governance, execution switched immediately to the approved repo-local path. All fallback commands stayed within `D:\Repos\FODE_Runtime_1wog` and were limited to repo-local Git, PowerShell reads, and Node validation.
