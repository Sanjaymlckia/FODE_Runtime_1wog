# H6H Custom Email Subject Display Normalization Fix

## Executive Result

PASS.

H6H fixed a narrow communications display defect where Custom Email applicant summaries could show subject selections as raw object/map text instead of a parent-readable subject list.

## Baseline

- Active repo: `D:\Repos\FODE_Runtime_1wog`
- Live Admin staging before release: `r303 / 303`
- Scope: small communications display defect only
- Production: untouched
- Student staging: untouched
- OPS: frozen

## Bug

Observed Custom Email summary rendering:

`Subjects: {"10272728":"English","10272729":"Mathematics"}`

Expected rendering:

`Subjects: English, Mathematics`

## Root Cause

The shared applicant subject display helpers selected the first non-empty row value and returned it directly. When the value was an object-map from FormDesigner-style subject data, the display path could expose raw JSON/object representation instead of normalizing through `subjectsToCsv_()`.

## Fix

Changed `subjectsToCsv_()` and applicant subject display helpers so:

- arrays normalize to comma-separated subject names
- object maps normalize to their values
- JSON-map strings still normalize through the existing parser
- comma-separated strings remain unchanged
- blank/missing subject values render as existing fallback text

No stored subject authority or row values are changed.

## Files Changed

- `Code.js`
- `tests/communication-semantic-registry.test.js`
- `audits/h6h_custom_email_subject_display_fix_v01.md`

## Tests Added / Updated

`tests/communication-semantic-registry.test.js` now proves:

- Custom Email default renders `Subjects: English, Mathematics` for object-map input
- raw JSON subject maps do not appear in Custom Email body
- `[object Object]` does not appear in Custom Email body
- quote/payment subject rendering remains `English, Mathematics`
- Custom Email selected-only/non-batch behavior remains covered by existing tests

## Validation

Commands run:

- `node --check Code.js` PASS
- `node --check Admin.js` PASS
- `node --check Routes.js` PASS
- `node --check Utils.js` PASS
- `node tests\communication-semantic-registry.test.js` PASS
- `node tests\communication-send-gate-matrix.test.js` PASS
- `node tests\admin-ui-rpc-contract.test.js` PASS

`git diff --check` and staged diff checks are recorded in the final task output.

## Protected Surfaces

Untouched:

- template redesign
- gallery/lightbox
- send gates
- payment authority
- document authority
- queue logic
- portal security
- Zoho behavior
- production
- Student staging
- OPS

## Release Proof Required

After commit, H6H requires Admin staging release proof only:

- push source to the verified Apps Script project
- create the next version after `Config.js` identity is updated and remote source is verified
- repin Admin staging only
- verify `whoami`
- manually preview Custom Email for `FODE-26-002985`
- confirm `Subjects: English, Mathematics`
- confirm no email send
