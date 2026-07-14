# Review Workspace V2 Implementation Note

## Scope

Track L, no runtime release. Review Workspace V2 is a presentation replacement for the existing Current Admin Review modal. It uses the existing `review()` loader, `admin_getApplicantDetail_json` detail RPC, existing DTO authority fields, and existing client mutation handlers. No server authority, lifecycle, Finance, communication, portal, Sheet, Books, or send logic is changed.

## Current Rendering Path

Current Admin:

`Admin.js -> AdminUI.html -> view=admin -> review(rowNumber, applicantId, triggerBtn, opts) -> admin_getApplicantDetail_json -> Review Workspace V2`

Operator Next:

`AdminUI_OperatorNext.html -> operatorNextOpenReview_(row) -> review(rowNumber, applicantId, null, opts) -> admin_getApplicantDetail_json -> Review Workspace V2`

Legacy fallback:

`Review Workspace V2 -> openReviewWorkspaceV2LegacyFallback_() -> openModal(currentDetail)`

## Legacy Modal Inventory

The frozen legacy modal remains at `#modalBack .modal`. Its active entry points are:

- Loading: `openModalLoading_()`
- Loaded render: `openModal()`
- Close: `closeModal()`
- Section nav: `bindReviewWorkspaceNav_()`, `setActiveReviewSection_()`
- Detail refresh: `refreshDetails()`
- Document render/save: `renderDocCards_()`, `saveDocs()`, `saveOverall()`
- Finance/Books actions: `preflightZohoBooksUi_()`, `previewZohoBooksPayloadUi_()`, `createZohoBooksDraftUi_()`, `sendZohoBooksTestInvoiceEmail()`
- Communications: `previewApplicantMessageUi_()`, `sendApplicantMessageUi_()`, `insertPortalLinkIntoCommBody_()`
- Portal: `copyPortalLink()`, `resetPortalLink()`, `setPortal()`
- Contact correction: `applyEmailOverride_()`
- Capability and lock state: `setActionButtonsEnabled()`, `syncModalEditControls_()`, `applyPortalLockControls_()`

## Handler Parity Map

V2 action display delegates to existing handlers:

- Documents: `saveDocs()`, with `CAN_SAVE_DOCUMENT_STATUSES`
- Finance preview: `preflightZohoBooksUi_()`, `previewZohoBooksPayloadUi_()`
- Finance write controls: `createZohoBooksDraftUi_()`, gated by `CAN_WRITE_ZOHO_BOOKS`
- Communications preview: `reviewWorkspaceV2PreviewCommunication_()` -> `previewApplicantMessageUi_()`, gated by `CAN_PREVIEW_APPLICANT_COMMUNICATION`
- Communications send: `sendApplicantMessageUi_()`, gated by `CAN_SEND_INDIVIDUAL_EMAIL`
- Portal copy/reset: `copyPortalLink()`, `resetPortalLink()`, with Super Admin reset gate preserved
- Legacy fallback: `openReviewWorkspaceV2LegacyFallback_()` -> `openModal(currentDetail)`

## Retirement Gate

Do not delete the legacy modal until owner manual visual acceptance confirms:

- V2 opens exact requested ApplicantID and row.
- V2 covers Overview, Documents, Finance, Communications, Portal, and Audit for ordinary and non-first-row applicants.
- Existing mutation handlers remain reachable and capability-gated.
- Current Admin and Operator Next both hand off through the same V2 contract.
- Browser evidence at 1920x1080, 1440x900, and 1366x768 shows no overlap, clipping, vertical controls, or critical microtext.
- Legacy fallback opens the same applicant and never runs visibly at the same time as V2.

