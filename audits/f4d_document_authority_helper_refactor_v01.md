# F4D Document Authority Helper Consolidation Refactor v01

## Executive result

PASS_WITH_WARNINGS.

F4D completed as a bounded refactor of Admin-side document authority helper logic. Runtime behaviour is intended to be unchanged.

Warning: Windows normal runner continued to fail intermittently with `CreateProcessAsUserW failed: 1312`; required repo-local validation was run through controlled local/elevated execution where needed.

## Baseline

- Current HEAD before work: `0e3a6f8`
- Baseline tag: `baseline/r301-dr-f1-readiness`
- Admin staging reference: `r301 / 301`
- Production: untouched
- Student staging: unchanged
- OPS: frozen

## Files changed

- `Admin.js`
- `tests/admin-review-queue-rollup-consistency.test.js`
- `tests/payment-authority-matrix.test.js`
- `audits/f4d_document_authority_helper_refactor_v01.md`

## Refactor summary

Added Admin-side helper functions to centralize document authority interpretation:

- `adminDocumentRequiredUploadFields_()`
- `adminDocumentMandatoryIssueMappings_()`
- `adminDocumentHasEvidence_()`
- `adminDocumentDisplayRowHasUrl_()`
- `adminDocumentFieldStatus_()`
- `adminDocumentReviewVerifiedForPaymentGate_()`
- `adminDocumentReviewVerifiedForAutomation_()`

Replaced duplicated inline checks in:

- document status save uploaded-file validation
- document-before-payment gate checks
- payment verification document gate check
- verification automation transition check
- actionability document review check
- required upload summary
- mandatory document issue check
- queue document review helper

No preview/gallery/lightbox, signed file route, communication, payment authority, Zoho, portal, Stage Batch, production, Student, Sheet, Drive, or OPS behaviour was changed.

## Behaviour preserved

- UI-readable document status values remain `Pending`, `Verified`, `Rejected`, and `Fraudulent`.
- `Docs_Verified` remains a compatibility/rollup output synced from computed document status.
- Missing uploaded evidence still blocks setting a document field to `Verified`.
- Required upload completeness remains limited to Birth ID/Passport, Latest School Report, and Passport Photo.
- Mandatory issue highlighting remains limited to Birth ID/Passport and Latest School Report.
- Optional transfer certificate remains optional.
- `Receipt_Status` remains payment authority and is not part of document verification rollup.
- Document status save still does not write canonical payment authority.
- Payment verification still does not write `Docs_Verified`.

## Document authority helper inventory

Before:

- Document review truth was repeatedly expressed as raw `Docs_Verified` plus `computeDocVerificationStatus_()`.
- Required upload fields were repeated in Admin OPS upload summary logic.
- Mandatory document issue mappings were local literals.
- Uploaded-file presence for verified status save was an inner helper inside `admin_updateDocStatuses_impl_()`.

After:

- Document review gates use `adminDocumentReviewVerifiedForPaymentGate_()` or `adminDocumentReviewVerifiedForAutomation_()` depending on the historical boolean semantics required by the consumer.
- Required upload fields and mandatory issue mappings are explicit named helpers.
- Uploaded-file validation for document save uses `adminDocumentDisplayRowHasUrl_()`.
- Row queue consumers continue through `adminRowDocsReviewVerified_()`.

## Docs_Verified compatibility boundary

`Docs_Verified` remains a compatibility field, not the sole source of document authority.

Document review authority remains:

- raw `Docs_Verified === "Yes"` for compatibility, or
- computed `computeDocVerificationStatus_(row) === "Verified"` when the rollup is stale or absent.

The canonical computed status still comes from document status fields, not payment receipt authority.

## Protected surfaces

Touched:

- Admin-side document authority interpretation helpers.
- Static invariant tests that assert document/payment boundary behaviour.

Not touched:

- `Code.js`
- `Routes.js`
- `Utils.js`
- `AdminUI.html`
- signed document routes
- preview/gallery/lightbox rendering
- Zoho/payment write behaviour
- communication templates or send gates
- Stage Batch
- portal/security
- production
- Student staging
- OPS
- Sheets/Drive data

## Tests run

- `node --check Code.js` PASS
- `node --check Admin.js` PASS
- `node --check Routes.js` PASS
- `node --check Utils.js` PASS
- `node tests/admin-document-status-save-persistence.test.js` PASS
- `node tests/admin-review-queue-rollup-consistency.test.js` PASS
- `node tests/admin-document-manifest.test.js` PASS
- `node tests/admin-document-file-action.test.js` PASS
- `node tests/admin-document-gallery-ui.test.js` PASS
- `node tests/payment-authority-matrix.test.js` PASS
- `node tests/payment-authority-drift.test.js` PASS
- `node tests/payment-authority-nonqueue-consumers.test.js` PASS
- `node tests/admin-role-boundary-matrix.test.js` PASS
- `node tests/admin-ui-rpc-contract.test.js` PASS
- `node tests/communication-send-gate-matrix.test.js` PASS
- `node tests/communication-semantic-registry.test.js` PASS
- `git diff --check` PASS

## Windows execution record

Normal runner failures observed:

- `windows sandbox: runner error: CreateProcessAsUserW failed: 1312`

Controlled local/elevated execution categories used:

- repo-local PowerShell reads for source mapping
- repo-local Node syntax checks
- repo-local Node test commands

Specific gallery validation record:

- Command: `node tests/admin-document-gallery-ui.test.js`
- Execution path: controlled repo-local Node execution
- Reason: normal runner/session failures had repeatedly blocked repo-local commands with `CreateProcessAsUserW failed: 1312`
- Scope confirmation: command ran from `E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog`; no external drive access, Apps Script push, deployment, Sheet/Drive mutation, production, Student, or OPS action
- Result: PASS

## Remaining risks

- This refactor did not attempt to consolidate shared `Code.js` document helpers or route-level document status conversion.
- `hasAnyRequiredDoc_()` still has its historical four-field definition, including transfer certificate; it was left untouched because its purpose is not identical to required upload completeness.
- OPS document state has legacy heuristics and remains outside this bounded refactor.

## Rollback path

Revert commit `refactor: consolidate document authority helpers` if a regression is found.

No deployment or live data action was performed in this slice.

## F4E recommendation

F4E may proceed only as another bounded refactor slice. Recommended next seam: either route/status-key normalization or document manifest/file-action helper naming, not both in one pass.
