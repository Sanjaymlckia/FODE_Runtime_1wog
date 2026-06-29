# H6D Communications Composition + Quote/Bank Details Integration

## Executive result
PASS

H6D was expanded from proof-only into a repair-first communications composition pass because preview evidence showed payment-related templates still exposed `[ACTION REQUIRED: ...]` placeholders for amount/payment instructions even when the FODE quote was computable.

The blocker was repaired locally. Payment-related selected-applicant templates now use a shared canonical payment information builder that computes the FODE KIA fee breakdown from subject count and inserts the approved bank/payment instructions. No Apps Script push, deployment, version creation, deployment repin, Sheet edit, Drive mutation, live send, production action, Student staging action, or OPS action occurred.

## Baseline
- Active repo: `D:\Repos\FODE_Runtime_1wog`
- Starting HEAD: `98134d0 feat: add communications template gallery and custom defaults`
- Admin staging: unchanged during this task
- Production: untouched
- Student staging: unchanged
- OPS: frozen

## Files changed
- `Code.js`
- `tests/communication-semantic-registry.test.js`
- `audits/h6d_communications_preview_release_readiness_v01.md`

## Composition repair summary
Added a canonical payment information builder in `Code.js`:
- `formatKinaCurrency_()`
- `canonicalFodePaymentInformationBlock_()`

Templates now using the shared payment block:
- `application_verified_quote`
- `payment_followup`
- `application_receipt_request`

The shared block inserts:
- Registration Fee: `K600.00`
- Subject Fee: `<count> x K450.00 = K<amount>`
- Total Amount Payable: `K<amount>`
- National FODE examination fee note, separate from KIA fee
- TISA Bank Ltd preferred bank option
- BSP Bank alternative bank option
- Applicant ID as payment reference
- Receipt upload/send instruction

## Canonical fee policy implemented
- Registration fee: `K600.00`
- Subject fee: `K450.00` per subject
- Total payable: `K600.00 + (subject count x K450.00)`
- National FODE examination fees are paid separately to DoE FODE and are not included.

Computed example proven by tests and preview proof:
- Subjects: `English, Mathematics`
- Subject count: `2`
- Registration Fee: `K600.00`
- Subject Fee: `2 x K450.00 = K900.00`
- Total Amount Payable: `K1,500.00`

## Canonical bank/payment block
Rendered payment block includes:

```text
Option 1 - TISA Bank Ltd (Preferred)
Bank: TISA Bank Ltd
Branch: Islander Drive (Branch 001), Port Moresby
Business Name: KUNDU INTERNATIONAL ACADEMY LIMITED
CASA Account No.: 0010250069

Option 2 - BSP Bank
Bank: BSP Bank
Branch: BSP Haus, Konedobu, Port Moresby
Account Name: Kundu International Academy
Account No.: 7027138796
BSB No.: 088950

Payment reference: Please include Applicant ID <Applicant ID> as the payment reference.
After payment, upload the receipt through the applicant portal or send it to Admissions for verification.
```

## Placeholder policy
Result: PASS

When applicant ID and subject count are available, `application_verified_quote` and `payment_followup` no longer show payment amount/instruction placeholders.

Send-blocking placeholders remain where required:
- missing applicant ID -> `[ACTION REQUIRED: confirm applicant ID for payment reference]`
- missing/undetermined subject count -> `[ACTION REQUIRED: confirm subjects before calculating FODE quote]`
- acceptance/enrolment confirmation still requires operator-authoritative acceptance/classroom wording where not present in the row

No values are invented when subject count cannot be determined.

## Preview proof
Previews were generated locally from the current `Code.js` template builder functions using representative fixture applicant rows. This avoided live sends and avoided mutating staging, Sheets, or Drive.

| Template | Fixture context | Result | Payment block | Unresolved placeholders | Notes |
| --- | --- | --- | --- | --- | --- |
| `docs_missing` | missing/incomplete documents | PASS | Not applicable | No | Parent-facing, no blame/rejection wording. |
| `application_verified_quote` | documents verified, two subjects, no payment | PASS | Yes | No | Renders `K1,500.00`, TISA, BSP, Applicant ID reference, exam-fee note. |
| `payment_followup` | receipt/payment evidence pending verification, two subjects | PASS | Yes | No | Renders same canonical quote/payment block and no acceptance/enrolment commitment. |
| `application_acceptance_confirmation` | payment verified acceptance fixture | PASS | Not applicable | Yes | Placeholder remains intentional where acceptance/enrolment authority text must be confirmed. |
| `custom_email` | generic selected-applicant context | PASS | Not applicable | No | Safe generic admissions/program body remains editable and selected-only. |

Compact local preview proof results:

```json
[
  { "type": "docs_missing", "result": "PASS", "unresolvedPlaceholders": false, "internalLanguage": false },
  { "type": "application_verified_quote", "result": "PASS", "unresolvedPlaceholders": false, "hasK1500": true, "hasFeeBreakdown": true, "hasTisa": true, "hasBsp": true, "hasPaymentReference": true, "hasExamFeeNote": true, "internalLanguage": false },
  { "type": "payment_followup", "result": "PASS", "unresolvedPlaceholders": false, "hasK1500": true, "hasFeeBreakdown": true, "hasTisa": true, "hasBsp": true, "hasPaymentReference": true, "hasExamFeeNote": true, "internalLanguage": false },
  { "type": "application_acceptance_confirmation", "result": "PASS", "unresolvedPlaceholders": true, "internalLanguage": false },
  { "type": "custom_email", "result": "PASS", "unresolvedPlaceholders": false, "internalLanguage": false }
]
```

## Template gallery and recommendation review
Result: PASS

No `AdminUI.html` changes were made in H6D. H6C gallery/recommendation behavior remains covered by `tests/communication-semantic-registry.test.js`:
- selected-applicant gallery metadata is generated from the backend registry
- selected-only and batch-safe indicators remain intact
- `application_verified_quote` remains flagged as requiring payment/quote data
- recommendations remain advisory/default only
- Stage Batch mappings remain unchanged

## Send gate behavior
Result: PASS

Verified by communication tests:
- unresolved operational `[ACTION REQUIRED: ...]` placeholders remain send-blocking where required
- selected-applicant/manual templates remain non-batch
- `custom_email` remains selected-only and non-batch
- Stage Batch mappings remain separated from selected/manual templates
- no live send path was executed

## Protected surfaces
Untouched:
- Zoho write/send behavior
- payment authority
- document authority
- queue logic
- portal/security
- Stage Batch mappings
- gallery/lightbox
- Apps Script deployments
- Sheets
- Drive data
- production
- Student staging
- OPS

## Validation
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

Validation result: PASS.

Windows execution note:
- Commands were run as repo-local D: operations because the active repository is outside the current Codex sandbox writable root.
- No external F: access was used.
- No Apps Script, Drive, Sheet, production, Student, or OPS command was run.

## Remaining wording issues
No blocking wording issue remains for the repaired payment composition.

Known manual placeholders that remain intentional:
- acceptance/enrolment confirmation may still require operator-authoritative classroom/enrolment wording depending on row state
- quote/payment templates block if subject count or applicant ID is unavailable

## Release recommendation
H6E deployment may begin under normal release discipline.

Recommended H6E scope:
- bump release identity
- verify `.clasp.json`, `Config.js`, and Admin deployment target from the D: repo before any Apps Script operation
- remote-source proof
- create next Apps Script version
- repin Admin staging only
- run Admin whoami/hydration proof
- live selected-applicant communication gallery proof
- preview `application_verified_quote`, `payment_followup`, `docs_missing`, `application_acceptance_confirmation`, and `custom_email`
- do not send live emails unless separately approved
