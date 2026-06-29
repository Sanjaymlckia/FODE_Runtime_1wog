# F4J Document Services Module Consolidation

Classification: Track H refactor-only / no runtime release

## Executive Summary

PASS_WITH_WARNINGS.

F4J consolidated the Document Services implementation behind the F4I Document Gallery facade. `Admin_DocumentGallery.js` now owns public document-gallery RPC entrypoints, while `Admin_DocumentServices.js` owns the private document service helpers used by manifest, file-action, rendition, preview backfill, and shared document completeness/normalization flows.

Behavior is intended to be unchanged. Public RPC names/signatures remain unchanged. No Apps Script push, deployment, version creation, deployment repin, Sheet mutation, Drive mutation, live send, production action, Student action, or OPS action occurred.

Playwright not required.

## Files Changed

- `Admin.js`
- `Admin_DocumentGallery.js`
- `Admin_DocumentServices.js`
- `tests/admin-document-manifest.test.js`
- `tests/admin-document-file-action.test.js`
- `tests/admin-document-preview-backfill.test.js`
- `tests/admin-document-verifier-role.test.js`
- `tests/admin-ui-rpc-contract.test.js`
- `audits/f4j_document_services_module_consolidation_v01.md`

## Functions Moved

Moved into `Admin_DocumentServices.js` from `Admin_DocumentGallery.js`:

- `adminDocumentManifestTypeForField_`
- `adminDocumentManifestExtension_`
- `adminDocumentManifestMimeExtensionMismatch_`
- `adminDocumentManifestIso_`
- `adminDocumentManifestFileIds_`
- `adminDocumentManifestParentIds_`
- `adminDocumentManifestFileMetadata_`
- `adminDocumentManifestPrefixField_`
- `adminDocumentManifestWarning_`
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
- `adminResolveApplicantDocumentFileFromRow_`
- `adminDocumentPreviewBackfillBatch_`

Moved into `Admin_DocumentServices.js` from `Admin.js`:

- `adminDocumentRequiredUploadFields_`
- `adminDocumentMandatoryIssueMappings_`
- `adminDocumentHasEvidence_`
- `adminDocumentDisplayRowHasUrl_`
- `adminDocumentFieldStatus_`
- `hasAnyRequiredDoc_`
- `findDocMapping_`
- `normalizeDocStatus_`
- `toRouteStatusKey_`

## Public RPCs Preserved

Left in `Admin_DocumentGallery.js` with unchanged names:

- `admin_getApplicantDocumentManifest(payload)`
- `admin_getApplicantDocumentImageRendition(payload)`
- `admin_dryRunDocumentPreviewBackfill(payload)`
- `admin_runDocumentPreviewBackfillBatch(payload)`
- `admin_getApplicantDocumentFileAction(payload)`

These remain Apps Script global functions and preserve the `google.script.run` contract.

## Remaining Admin.js Responsibilities

`Admin.js` remains the orchestration owner for:

- Admin app rendering and RPC envelope helpers
- role gates and authorization helpers
- applicant search/detail DTOs
- document status save and Docs_Verified rollup authority
- payment authority
- queues/lifecycle/actionability
- communications and Stage Batch
- Zoho Books
- portal access/security
- OPS/classroom/WhatsApp fallback
- reports, diagnostics, and property utilities

F4J did not move payment authority, Docs_Verified authority, queue logic, lifecycle decisions, communications, Zoho, portal/security, OPS, or row facts.

## Dependency Graph

```text
AdminUI.html google.script.run
  -> Admin_DocumentGallery.js public RPC facade
       -> Admin_DocumentServices.js private service helpers
            -> shared Admin.js / Code.js / Utils.js globals
            -> CONFIG.DOC_FIELDS
            -> DriveApp / Utilities
```

Shared globals consumed by `Admin_DocumentServices.js`:

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
- `DriveApp`
- `Utilities`

No new import/export/require convention was introduced.

## Line-Count Reduction

Measured line counts:

- `Admin.js` before F4J: 7,705 lines
- `Admin.js` after F4J: 7,647 lines
- `Admin_DocumentGallery.js` after F4J: 322 lines
- `Admin_DocumentServices.js` after F4J: 541 lines
- `Admin.js` reduction in F4J: 58 lines

The larger structural change is ownership consolidation: private document service functions moved out of the public gallery facade into a reusable services module.

## Extraction-Pattern Compliance

F4J followed the F4I extraction pattern:

- public RPC names preserved exactly
- private helpers keep trailing `_` naming convention
- no Node-style module syntax introduced
- no top-level executable side effects introduced
- Apps Script global-scope behavior preserved
- shared helpers were not moved unless clearly document-service scoped
- tests were updated to concatenate new Apps Script module files
- validation was limited to changed runtime files and document-service tests
- rollback remains a commit revert

## Tests Run

Changed runtime syntax:

- `node --check Admin.js` PASS
- `node --check Admin_DocumentGallery.js` PASS
- `node --check Admin_DocumentServices.js` PASS

Document Services protected surface:

- `node tests/admin-document-manifest.test.js` PASS
- `node tests/admin-document-file-action.test.js` PASS
- `node tests/admin-document-preview-backfill.test.js` PASS
- `node tests/admin-document-verifier-role.test.js` PASS
- `node tests/admin-ui-rpc-contract.test.js` PASS

Repository checks:

- `git diff --check`
- `git diff --cached --check`

## Behaviour Preserved

Document Services behavior is preserved:

- public RPC names/signatures unchanged
- manifest authorization remains document-verifier gated
- secure file actions remain document-verifier gated
- signed route compatibility unchanged
- image/PDF rendition helpers remain available
- preview backfill dry-run and execute wrappers retain their names and behavior
- AdminUI RPC contract remains unchanged
- no UI rendering, gallery layout, lightbox, communications, payment, queue, lifecycle, Zoho, portal/security, production, Student, or OPS behavior was intentionally changed

## Rollback Strategy

Revert the F4J commit. No deployment rollback is required because this task performs no Apps Script source push, version creation, or staging repin.

If a later release deploys this structure and fails, rollback staging first by repinning Admin staging to the previous accepted Apps Script version, then revert or patch forward from GitHub source.

## Next Recommended Module

Recommended next extraction candidate:

`Admin_PaymentAuthority.js`

Reason:

- strong payment authority tests exist
- payment authority is smaller than queue/lifecycle
- F4I/F4J have now proven the Apps Script global-scope module extraction pattern

Do not extract communications, Zoho, portal/security, queue engine, lifecycle/actionability, or OPS next.

## Windows Runner Note

Normal runner had already failed in this F4/F4I/F4J sequence with `CreateProcessAsUserW failed: 1312`. Per governance, repo-local validation used the approved local execution path. All fallback commands stayed within `D:\Repos\FODE_Runtime_1wog`.
