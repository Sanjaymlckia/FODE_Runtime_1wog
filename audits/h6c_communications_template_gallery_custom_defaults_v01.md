# H6C Communications Template Gallery + Custom Email Info Defaults

## Executive result
PASS_WITH_WARNINGS

H6C implemented a selected-applicant communications template gallery/selector and advisory stage-aware recommendation while preserving existing preview/edit/send gates. The implementation is limited to communications UI, communication metadata, and communication tests.

No Apps Script push, deployment, version creation, deployment repin, Sheet edit, Drive mutation, production action, Student staging action, or OPS action occurred.

## Baseline
- Active repo: `D:\Repos\FODE_Runtime_1wog`
- Starting HEAD: `e7983ea fix: repair communications templates and defaults`
- Admin staging reference: `r301 / 301`
- Production: untouched
- Student staging: unchanged
- OPS: frozen

## Files changed
- `Code.js`
- `AdminUI.html`
- `tests/communication-semantic-registry.test.js`
- `audits/h6c_communications_template_gallery_custom_defaults_v01.md`

## UI/UX summary
The selected-applicant Communications card now includes:
- Backend-derived template gallery metadata rendered into `COMM_TEMPLATE_GALLERY` from `communicationTemplateGalleryMetadata_()`.
- A visible advisory recommendation banner with a `Use recommended` action.
- Template cards showing label, message type, purpose, use case, stage suitability, selected-only/batch-safe status, payment/quote dependency, portal-link dependency, placeholder policy, semantic risk, and operator warning.
- Existing editable draft preview/send workflow remains unchanged: choose template, preview/generate, edit recipient/subject/body, then send only through the existing gated send path.

## Template gallery behavior
- Gallery metadata is derived from the backend communication semantic registry plus display copy in `communicationTemplateGalleryCopy_()`.
- The UI does not maintain a separate send-authority list.
- Cards call `selectCommTemplateFromGallery_()` which updates the existing `commMessageType` selector and uses the existing preview path.
- Existing `commMessageType` dropdown remains available for operator familiarity and fallback.
- Current preview placeholder status is reflected for the selected template after preview.

## Stage-aware recommendation behavior
Recommendation is advisory/default only and does not force a send action.

Implemented selected-applicant recommendation logic:
- Email/contact issue -> `contact_fallback_manual`
- Missing/incomplete/correction-required documents -> `docs_missing`
- Documents verified + no receipt/payment evidence -> `application_verified_quote`
- Receipt/payment evidence present but not verified -> `payment_followup`
- Payment verified -> `application_acceptance_confirmation`, with operator caveat that acceptance/enrolment authority must be confirmed
- Unclear state -> `custom_email`

For a newly opened applicant, the selected template defaults to the advisory recommendation. Operators can still choose any available selected-applicant template manually.

## Custom email default behavior
`custom_email` retains the H6B safe defaults:
- Safe generic subject: `FODE KIA Information and Next Steps`
- Parent-facing selected-applicant context body
- Applicant ID, student name, grade/subjects when available
- Document/payment summaries
- No payment, acceptance, or enrolment commitment
- Selected-only
- Non-batch
- No mandatory placeholder gate

## Template registry/metadata changes
Added backend metadata helpers:
- `communicationTemplateGalleryCopy_()`
- `communicationTemplateGalleryMetadata_()`

Metadata fields include:
- `messageType`
- `label`
- `purpose`
- `whenToUse`
- `stageSuitability`
- `selectedOnly`
- `batchSafe`
- `allowedSendModes`
- `requiresPaymentQuoteData`
- `requiresPortalLink`
- `requiresResolvedPlaceholders`
- `placeholderPolicy`
- `editableMode`
- `semanticRisk`
- `operatorWarning`
- `auditMeaning`

## Protected behavior preserved
- No Stage Batch mapping expansion.
- No send gate weakening.
- No placeholder gate weakening.
- No payment authority change.
- No document authority change.
- No queue logic change.
- No Zoho live write/send behavior change.
- No portal/security change.
- No Sheet or Drive mutation.

## Tests run
Commands run from `D:\Repos\FODE_Runtime_1wog`:
- `node --check Code.js`
- `node --check Admin.js`
- `node --check Routes.js`
- `node --check Utils.js`
- `node --check tests\communication-semantic-registry.test.js`
- `node tests\communication-send-gate-matrix.test.js`
- `node tests\communication-semantic-registry.test.js`
- `node tests\admin-ui-rpc-contract.test.js`
- `node tests\payment-authority-matrix.test.js`
- `node tests\payment-authority-drift.test.js`
- `node tests\payment-authority-nonqueue-consumers.test.js`
- `git diff --check`

Validation result: PASS. `git diff --check` reported only line-ending warnings for modified files.

## Test coverage added
`tests/communication-semantic-registry.test.js` now proves:
- Every selected-applicant displayed/active template has gallery metadata.
- Gallery metadata includes label, purpose, use guidance, and stage suitability.
- `custom_email` remains selected-only.
- `application_verified_quote` flags payment/quote data dependency.
- Operational placeholder policy remains represented.
- AdminUI uses backend-rendered `communicationTemplateGalleryMetadata_()`.
- Stage-aware recommendation returns expected templates for missing-docs, verified-docs/no-receipt, receipt-present/not-verified, payment-verified, unclear, and email-issue fixtures.
- Stage Batch mappings remain unchanged.

## Windows runner recovery
The work used controlled repo-local PowerShell/Git/Node execution in `D:\Repos\FODE_Runtime_1wog` because the current session sandbox root remains the archived E: path. No Apps Script, Drive, Sheet, production, Student, or OPS operation used controlled execution.

## Remaining risks
- Live visual/operator proof is still required in a later staging release before accepting the UI change operationally.
- Recommendation logic is advisory and based on loaded selected-applicant row facts; it does not replace backend send authority.
- Stage Batch remains intentionally conservative. If broader batch communication is desired, it should be a separate guarded CIS.

## Whether H6D is required
H6D is not required for the selected-applicant template gallery itself. A future H6D may be useful only if the next objective is one of:
- live staging release/proof for the gallery,
- Stage Batch communication expansion,
- deeper communication workflow UX cleanup,
- visual refinement after operator feedback.