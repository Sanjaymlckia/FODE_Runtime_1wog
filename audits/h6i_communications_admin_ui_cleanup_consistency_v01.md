# H6I Communications Admin UI Cleanup / Consistency Pass

## Executive Result

PASS.

H6I performed a small communications Admin UI consistency refactor after H6A-H6H stabilized the communications engine, templates, quote logic, and Custom Email subject display.

## Scope

Allowed:

- selected-applicant communications UI consistency cleanup
- normalized applicant/grade/subject display helpers
- common preview display text helper
- maintainability improvements around communications rendering

Not changed:

- send gates
- Stage Batch mappings
- message type registry semantics
- backend templates
- payment authority
- document authority
- queue logic
- portal security
- Zoho behavior
- production
- Student staging
- OPS

## Files Changed

- `AdminUI.html`
- `tests/communication-semantic-registry.test.js`
- `audits/h6i_communications_admin_ui_cleanup_consistency_v01.md`

## Refactor Summary

Added UI-local display helpers:

- `commFirstValue_()`
- `commNormalizeCsvList_()`
- `commApplicantNameDisplay_()`
- `commGradeDisplay_()`
- `commSubjectsDisplay_()`
- `commTemplatePreviewText_()`
- `renderCommunicationsApplicantSummary_()`

The selected-applicant Communications card now shows a normalized applicant communication summary using the same display strategy for:

- applicant ID/name
- grade
- subjects
- selected template

Preview rendering now passes recipient, subject, and body through the same text-normalization helper before display.

## Behaviour Preserved

- Custom Email remains selected-only and non-batch.
- Stage Batch remains unchanged.
- Send controls remain gated by the existing preview, role, cooldown, and backend checks.
- `admin_sendApplicantMessage` / `sendApplicantMessage_` were not modified.
- Existing backend template composition remains unchanged.
- H6H subject normalization remains intact.

## Tests Added / Updated

`tests/communication-semantic-registry.test.js` now proves the AdminUI communications display helpers normalize:

- object-map subjects: `{"10272728":"English","10272729":"Mathematics"}` -> `English, Mathematics`
- array subjects
- comma-separated subjects
- blank/missing subjects
- applicant name
- grade
- preview text trimming

It also asserts that the communications UI exposes the normalized applicant summary block.

## Validation

Commands run:

- `node --check Code.js` PASS
- `node --check Admin.js` PASS
- `node --check Routes.js` PASS
- `node --check Utils.js` PASS
- `node tests\communication-semantic-registry.test.js` PASS
- `node tests\communication-send-gate-matrix.test.js` PASS
- `node tests\admin-ui-rpc-contract.test.js` PASS

`git diff --check` and staged diff checks are recorded in final task output.

## Release Gate

Because `AdminUI.html` changed, H6I requires Full gate for any staging release:

- inline-script parse
- Admin staging whoami
- hydration proof
- Custom Email preview smoke
- Verified Quote preview smoke
- no-send proof
- Stage Batch unchanged proof

## Remaining Risks

- Browser/operator proof is still required after deployment because this touches the AdminUI communications surface.
- The change is UI display-only, but any AdminUI release remains hydration-sensitive.

## Recommendation

Proceed to Admin staging release only after local validation passes and release identity/remote-source gates pass. Target runtime identity should be `r305 / 305`; Apps Script platform version is expected to be the next available platform version, likely `306`, but must be verified before versioning.
