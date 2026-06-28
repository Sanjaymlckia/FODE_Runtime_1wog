# H6B Communications Template Repair and Stage-Aware Defaults

## Executive result
PASS_WITH_WARNINGS

H6B repaired selected-applicant communication templates so parent-facing operational messages are more complete, stage-aware, and safer to preview/send. The change is limited to communications template text, communication helper metadata, and communication tests.

No Apps Script push, deployment, version creation, deployment repin, Sheet edit, Drive mutation, production action, Student staging action, or OPS action occurred.

## Baseline
- Active repo: `D:\Repos\FODE_Runtime_1wog`
- Starting HEAD: `5d727d8 docs: audit communications authority and template accuracy`
- Admin staging reference: `r301 / 301`
- Production: untouched
- Student staging: unchanged
- OPS: frozen

## Files changed
- `Code.js`
- `tests/communication-semantic-registry.test.js`
- `audits/h6b_communications_template_repair_v01.md`

## Implementation summary
- Added communication display/status helpers for parent-facing template content:
  - `applicantGradeDisplayOrUnconfirmed_()`
  - `applicantSubjectsDisplayOrUnconfirmed_()`
  - `applicantDocumentStatusSummary_()`
  - `applicantPaymentStatusSummary_()`
  - `applicantComputedFeeQuoteText_()`
  - `applicantOutstandingActionOrPlaceholder_()`
- Repaired selected-applicant template bodies:
  - `buildReminderEmailBody_()`
  - `buildDocsMissingEmailBody_()`
  - `buildPaymentFollowupEmailBody_()`
  - `buildCustomSelectedEmailBody_()`
  - `buildApplicationVerifiedQuoteBody_()`
  - `buildApplicationAcceptanceConfirmationBody_()`
  - `buildApplicationFinalReminderBody_()`
- Reconnected `application_verified_quote` to computed FODE fee quote text when selected subjects are available.
- Added fallback to `CONFIG.PAYMENT_INSTRUCTIONS_TEXT` for payment instructions before using a blocking placeholder.
- Preserved blocking placeholders for operational templates when essential grade, subject, payment amount, payment instruction, deadline, or acceptance/enrolment fields are missing.
- Kept `custom_email` selected-only and non-batch; its default body now initializes without blocking placeholders.
- Kept `reminder` non-specific and parent-facing; it now initializes without blocking placeholders.

## Template repair findings
| Template | H6B status | Notes |
| --- | --- | --- |
| `docs_missing` | Repaired | Parent-facing, no blame, no rejection language, includes document/payment summary and next steps. |
| `payment_followup` | Repaired | Parent-facing payment evidence/receipt guidance; explicitly avoids acceptance/enrolment confirmation. |
| `application_verified_quote` | Repaired | Uses computed quote when subjects are present; otherwise blocks on explicit payment/quote placeholder. |
| `application_acceptance_confirmation` | Repaired | Removes operator/internal wording and keeps acceptance/enrolment status placeholder when not known. |
| `application_final_reminder` | Repaired | Uses current missing-doc/payment state to describe the outstanding action when possible. |
| `custom_email` | Repaired | Selected-applicant default subject/body initialize safely and remain editable. |
| `reminder` | Repaired | Parent-facing general reminder with applicant context; no forced payment/acceptance claims. |
| `legacy_invite` | Preserved | No behaviour change in this slice. |

## Payment / quote behavior
- `Receipt_Status` / canonical payment authority remains unchanged.
- Payment quote text is computed only from existing fee configuration and selected subjects.
- H6B does not invent fees.
- If no amount, invoice reference, or computable quote is available, `application_verified_quote` keeps `[ACTION REQUIRED: insert payment/quote amount]` and remains send-blocked by the existing placeholder gate.
- If configured payment instructions are unavailable, operational payment templates keep `[ACTION REQUIRED: confirm payment instructions]` and remain send-blocked.

## Stage/action-aware defaults
H6B implemented stage-aware wording inside selected-applicant templates, not forced UI auto-selection.

Current safe mapping guidance:
- Missing documents: use `docs_missing`.
- Documents verified and no receipt/payment evidence: use `application_verified_quote` / payment guidance.
- Receipt uploaded but not verified: use `payment_followup` receipt-review wording.
- Payment verified: use `application_acceptance_confirmation` only when acceptance/enrolment status is available or explicitly completed by the operator.

No Stage Batch mappings were changed. Selected/manual templates remain non-batch unless separately approved and guarded.

## Custom email
- `custom_email` remains selected-only.
- `custom_email` remains non-batch.
- Default subject/body generation works without `[ACTION REQUIRED]` placeholders.
- The body is editable and includes applicant ID, student name, grade/subjects when available, and current document/payment summaries.

## Protected surfaces not changed
- No `AdminUI.html` change.
- No Stage Batch mapping change.
- No payment authority change.
- No document authority change.
- No queue logic change.
- No Zoho live write/send behavior change.
- No portal/security change.
- No Sheet or Drive mutation.
- No Apps Script source push, version, deployment, or repin.
- No production, Student staging, or OPS action.

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

Validation result: PASS. `git diff --check` reported only line-ending warnings for modified files.

## Windows runner recovery
Normal sandbox execution intermittently failed with `CreateProcessAsUserW failed: 1312` during repo-local file inspection. Controlled local execution was used only for repo-local PowerShell, Git, and Node validation commands in `D:\Repos\FODE_Runtime_1wog`. No Apps Script, Drive, Sheet, production, Student, or OPS operation used the controlled execution path.

## Remaining warnings
- H6B does not implement forced automatic template preselection in AdminUI; this remains a future UX/operator workflow slice if desired.
- Stage Batch still uses the existing mappings and remains intentionally conservative.
- Acceptance/enrolment confirmation still requires an authoritative acceptance/enrolment status before send; unresolved placeholders remain send-blocking.

## Recommendation
Proceed to H6C only if the next slice is specifically approved for operator UI/default selection or Stage Batch communication mapping. Otherwise, H6B is ready for GitHub review and later staging release planning under the normal release identity and remote-source gates.