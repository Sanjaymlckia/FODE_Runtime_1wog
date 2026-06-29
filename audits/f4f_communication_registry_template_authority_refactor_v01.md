# F4F Communication Registry / Template Authority Consolidation

## Executive Result

PASS.

F4F performed a bounded refactor-only pass on the communications registry/template authority layer. Communications behaviour was preserved.

## Baseline

- Active repo: `D:\Repos\FODE_Runtime_1wog`
- Live Admin staging before task: `r305 / 305`
- Communications v1.0: stable
- Student staging: unchanged `@247`
- Production: untouched
- OPS: frozen

## Files Changed

- `Code.js`
- `tests/communication-semantic-registry.test.js`
- `tests/communication-send-gate-matrix.test.js`
- `audits/f4f_communication_registry_template_authority_refactor_v01.md`

## Refactor Summary

Added centralized communication send-authority helpers:

- `communicationSendAuthorityForDefinition_()`
- `communicationDefinitionSupportsMode_()`

Updated existing consumers to use the centralized authority interpretation:

- `communicationTemplateGalleryMetadata_()`
- `isCommunicationTypeBatchSafe_()`
- `getCommunicationAllowedSendModes_()`

This consolidates the selected-only / batch-safe interpretation without changing registry entries, message type keys, template builders, Stage Batch mappings, or send gates.

## Registry Inventory Before / After

External message types preserved:

- `legacy_invite`
- `reminder`
- `fd_acknowledgement`
- `application_feedback`
- `custom_email`
- `docs_missing`
- `payment_followup`
- `prospect_general_guidance`
- `application_receipt_request`
- `application_verified_quote`
- `application_acceptance_confirmation`
- `application_exam_fee_reminder`
- `application_final_reminder`
- `contact_fallback_manual`

No message type was added, removed, renamed, activated, deactivated, or remapped.

## Behaviour Preserved

- `custom_email` remains selected-only and non-batch.
- `application_feedback` remains selected-only and non-batch.
- `application_verified_quote` remains selected-only and non-batch.
- `application_acceptance_confirmation` remains selected-only and non-batch.
- `application_receipt_request` remains selected-only and non-batch.
- `application_final_reminder` remains selected-only and non-batch.
- `application_exam_fee_reminder` remains selected-only and non-batch.
- `contact_fallback_manual` remains selected-only and non-batch.
- `prospect_general_guidance` remains selected-only and non-batch.
- `docs_missing` and `payment_followup` retain selected + batch authority.
- `application_verified_quote` and `payment_followup` still render through their existing template builders.
- ACTION REQUIRED placeholder blocking remains unchanged.
- Template gallery metadata still derives from backend registry metadata.

## Stage Batch Unchanged Proof

Stage Batch mappings remain:

- `DOCS_REQUIRED` -> `reminder`
- `REMINDER_DUE` -> `reminder`
- `INVITED_AWAITING_RESPONSE` -> `reminder`
- `INVITE_PENDING` -> `legacy_invite`
- `PROCESSING` -> unsupported

Selected/manual templates remain unmapped from Stage Batch:

- `custom_email`
- `docs_missing`
- `payment_followup`
- `application_verified_quote`
- `application_acceptance_confirmation`
- `application_exam_fee_reminder`

## Template Gallery Compatibility

The gallery still includes active selected-applicant templates and now receives its `selectedOnly`, `batchSafe`, and `allowedSendModes` values from the centralized send-authority helper.

No gallery labels, descriptions, template bodies, or user-facing template wording were changed.

## Validation

Commands run:

- `node --check Code.js` PASS
- `node --check Admin.js` PASS
- `node --check Routes.js` PASS
- `node --check Utils.js` PASS
- `node --check Config.js` PASS
- `node tests\communication-semantic-registry.test.js` PASS
- `node tests\communication-send-gate-matrix.test.js` PASS
- `node tests\admin-ui-rpc-contract.test.js` PASS
- `node tests\payment-authority-matrix.test.js` PASS
- `node tests\payment-authority-drift.test.js` PASS
- `node tests\payment-authority-nonqueue-consumers.test.js` PASS

`git diff --check` and staged diff checks are recorded in final task output.

## Protected Surfaces

Untouched:

- template wording
- send gates
- Stage Batch mappings
- payment authority
- document authority
- queue logic
- portal security
- Zoho behavior
- Admin staging deployment
- production
- Student staging
- OPS
- Sheets
- Drive data

## Remaining Risks

- The registry still contains explicit per-entry `allowedSendModes` and `batchSafe` fields. F4F centralized interpretation but did not rewrite the registry shape, which keeps this pass low risk.
- A later refactor could convert entries to a smaller authority-key form, but only after another proof-backed slice.

## Rollback Path

Revert commit `refactor: consolidate communication registry authority`.

## F4G Recommendation

F4G may proceed as another bounded refactor slice. Recommended next seam: reduce duplicated selected-applicant message-type lists between AdminUI picker/editability and backend registry metadata, while preserving all labels and send behaviour.
