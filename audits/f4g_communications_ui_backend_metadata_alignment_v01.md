# F4G Communications UI / Backend Metadata Alignment

Classification: Track H refactor-only / no runtime release

## Executive Result

PASS_WITH_WARNINGS.

F4G aligned the selected-applicant communications UI picker/editability metadata with backend communication registry metadata while preserving existing communication behavior.

No Apps Script push, deployment, version creation, deployment repin, Sheet mutation, Drive mutation, live send, production action, Student staging action, or OPS action occurred.

## Files Changed

- `Code.js`
- `AdminUI.html`
- `tests/communication-semantic-registry.test.js`
- `tests/communication-send-gate-matrix.test.js`
- `AGENTS.md`
- `tools/README.md`
- `docs/architecture/README.md`
- `audits/f4g_communications_ui_backend_metadata_alignment_v01.md`

## Refactor Summary

Backend communication registry metadata now includes selected-applicant picker metadata:

- `selectedOptionLabel`
- `selectedOptionOrder`
- `selectedPickerVisible`

`AdminUI.html` now derives runtime selected-applicant communication picker options and editable-template eligibility from `COMM_TEMPLATE_GALLERY`, which is rendered from `communicationTemplateGalleryMetadata_()`.

The original static `<select id="commMessageType">` remains as fallback/source-visible compatibility markup. Runtime synchronization preserves the existing visible option values, order, and labels.

## Metadata Inventory Before

- Backend registry owned message type semantics and send authority.
- Backend gallery metadata owned template cards.
- AdminUI separately hardcoded selected-applicant picker values, labels, order, and editability.
- Tests verified hardcoded picker markup but did not prove runtime UI/backend metadata alignment.

## Metadata Inventory After

- Backend registry still owns message type semantics and send authority.
- Backend gallery metadata still owns template card metadata.
- Backend metadata also owns selected-applicant picker labels, order, and visibility.
- AdminUI consumes backend-derived selected picker metadata at runtime.
- Static picker markup remains fallback only.

## UI / Backend Authority Alignment

`Code.js`:

- `communicationTemplateGalleryCopy_()` records selected picker labels/order/visibility.
- `communicationTemplateGalleryMetadata_()` exports those fields.
- `fd_acknowledgement` remains gallery-visible but selected-picker-hidden to preserve current selected-applicant surface.

`AdminUI.html`:

- `commTemplateOptionItems_()` filters/sorts backend metadata for selected-applicant picker options.
- `commTemplateOptionLabel_()` reads backend-selected picker labels.
- `syncCommMessageTypeOptions_()` hydrates the live picker from metadata.
- `isEditableCommType_()` now derives editability from backend metadata instead of a duplicated hardcoded list.

## Behaviour Preserved

- No template wording changed.
- No send gate changed.
- No Stage Batch mapping changed.
- No new template was added.
- No payment, document, queue, portal, Zoho, OPS, production, or Student behavior changed.
- `custom_email` remains selected-only and non-batch.
- ACTION REQUIRED placeholder blocking remains unchanged.
- Computed quote/payment rendering remains unchanged.

## Selected-Only / Batch-Safe Invariant Proof

Tests assert:

- selected picker metadata preserves the existing selected-applicant option list;
- picker labels remain unchanged;
- `fd_acknowledgement` remains hidden from the selected picker;
- editability is derived from backend metadata;
- `custom_email` remains selected-only/non-batch.

## Stage Batch Unchanged Proof

Stage Batch mapping logic was not edited. Communication tests continue to assert:

- `INVITE_PENDING` maps to `legacy_invite`;
- legacy reminder states map to `reminder`;
- `docs_missing`, `payment_followup`, and planned/manual templates are not Stage Batch mapped.

## Template Gallery Compatibility

Template gallery metadata and card rendering remain compatible. Gallery labels remain based on `label`/operator label, while selected picker labels use `selectedOptionLabel` to preserve the existing picker wording exactly.

## Validation Policy Update

Governance now records the validation-level policy:

- Level 1 refactor/default validation uses Node checks, targeted Node regression tests, `git diff --check`, and audit/report evidence.
- Level 2 feature/UI validation adds manual browser inspection when visible UI intentionally changed.
- Level 3 release validation uses release preflight, authorized Apps Script source/version/repin, `whoami`, and operator acceptance.
- Playwright is not part of default F4/F5 refactor validation.
- Playwright not required for this refactor.

## Tests Run

All required validation passed:

- `node --check Code.js Admin.js Routes.js Utils.js Config.js`
- `node tests/communication-semantic-registry.test.js`
- `node tests/communication-send-gate-matrix.test.js`
- `node tests/admin-ui-rpc-contract.test.js`
- `node tests/payment-authority-matrix.test.js`
- `node tests/payment-authority-drift.test.js`
- `node tests/payment-authority-nonqueue-consumers.test.js`
- `git diff --check`
- `git diff --cached --check`

Playwright not required for this refactor.

Normal runner recovery note:

- Normal Windows runner failed with `CreateProcessAsUserW failed: 1312` during repo-local file reads.
- Per the one-retry rule, validation continued through the approved stable repo-local execution path.
- Controlled execution was limited to repo-local Git, PowerShell reads, and Node validation under `D:\Repos\FODE_Runtime_1wog`.

## Remaining Risks

- AdminUI still includes static fallback picker markup. This is intentional for compatibility and source-visible tests, but a later UI cleanup could remove it after stronger runtime DOM tests exist.
- Some AdminUI tests remain static/regex-based because the Apps Script HTML template is not fully executable under Node.

## Rollback Path

Revert the F4G commit. No deployment rollback is required because this task performs no Apps Script source push, version creation, or staging repin.

## F4H Recommendation

F4H may proceed only as another bounded refactor slice after GitHub review. Recommended next seam: communications preview/edit payload normalization or another single metadata seam, not Stage Batch or send-gate behavior.
