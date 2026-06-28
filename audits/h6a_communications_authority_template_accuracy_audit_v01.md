# H6A Communications Authority & Template Accuracy Audit

## Executive result

PASS_WITH_WARNINGS

H6A audited the communications subsystem at `afc96ad` without runtime repair. Communications is now treated as a protected operational surface. No Apps Script push, deployment, version creation, repin, Sheet mutation, Drive mutation, production action, Student action, or OPS action occurred.

The subsystem is operationally usable for selected-applicant preview/send under existing gates, but it is not fully reconciled for parent-facing accuracy, automatic stage selection, quote/invoice integration, or classroom handover. H6B should be an implementation pass focused on communications only.

## Scope and evidence

Reviewed files/surfaces:

- `Config.js`: `COMMUNICATION_ALLOWED_MESSAGE_TYPES`, `COMMUNICATION_ALLOWED_BATCH_FILTER_TYPES`
- `Code.js`: semantic registry, template builders, context resolution, send gates, batch planning, legacy quote/payment emails
- `Admin.js`: selected-applicant preview/send RPCs, Stage Batch preview/send, applicant batch planning RPCs
- `AdminUI.html`: selected-applicant message picker, Stage Batch UI, OPS communication/payment surfaces
- `AdminUI_SharedRowFacts.html`: communication row-facts and OPS shared status helpers
- `tests/communication-semantic-registry.test.js`
- `tests/communication-send-gate-matrix.test.js`
- payment/Zoho role-boundary tests and prior F3/F4 audits where relevant

Search themes:

- `COMMUNICATION_ALLOWED_MESSAGE_TYPES`, `getCommunicationSemanticRegistry_`, `buildApplicantMessage_`
- `custom_email`, `docs_missing`, `payment_followup`, `application_verified_quote`, `application_acceptance_confirmation`, `application_receipt_request`, `application_final_reminder`, `application_exam_fee_reminder`, `contact_fallback_manual`
- `legacy_invite`, `reminder`, `fd_acknowledgement`, `application_feedback`
- `Stage Batch`, `getBatchMessageTypeForStage_`, `communicationMessageTypeForFilter_`, `admin_planApplicantBatch`
- `computeFodeFeeQuote_`, `sendDocsVerifiedPaymentRequiredEmail_`, `Zoho`, `Books`, `invoice`, `quote`, `payment receipt`

## Template inventory

| Message type / family | Current source | Purpose | Trigger / intended context | Recipient | Mandatory info | Current suitability | Status |
|---|---|---|---|---|---|---|---|
| `legacy_invite` | Registry + `buildCampaignEmailBody_` / `campaignSubjectForAttempt_` | Application portal invitation | `INVITE_PENDING`; selected or Stage Batch | Parent/applicant effective email | Applicant ID, portal URL, parent email | Existing legacy portal workflow; batch-safe but applicant workflow only | READY |
| `reminder` | Registry + `buildReminderEmailBody_` | Legacy application reminder | `INVITED_AWAITING_RESPONSE`, `REMINDER_DUE`, `DOCS_REQUIRED`, `PAYMENT_REQUIRED`, `RECEIPT_AWAITING_VERIFICATION` via Stage Batch | Parent/guardian | Applicant ID, portal URL | Intentionally overloaded; does not expose docs/payment specifics; safe but semantically weak | MINOR REPAIR |
| `fd_acknowledgement` | Registry + `buildFdAcknowledgementEmailBody_` | Application received acknowledgement | Post-FD intake / selected preview | Parent/guardian | Applicant ID, portal URL, document state | Does not imply acceptance; good operational language | READY |
| `application_feedback` | Registry + `buildApplicationFeedbackEmailBody_` | Correction/resubmission feedback | Selected-applicant correction or rejected/fraudulent document context | Parent/guardian | Applicant ID, portal URL, document comments | Operationally usable; depends on operator review of comments | READY |
| `custom_email` | Registry + `buildCustomSelectedEmailSubject_` / `buildCustomSelectedEmailBody_` | Freeform selected-recipient email | Selected applicant only | Parent/applicant effective email | Applicant ID; operator edits subject/body | Subject/body initialize correctly; not batch-safe; intentionally not placeholder-blocked | READY |
| `docs_missing` | Registry + `buildDocsMissingEmailBody_` | Missing/incomplete/not received documents | Selected applicant; batch filter can map `docs_missing`; Stage Batch currently does not map to it | Parent/guardian | Applicant ID, portal URL, document attention lines | Parent-facing and non-blaming; consequence language is firm; not auto-selected from Review Queue Stage Batch | MINOR REPAIR |
| `payment_followup` | Registry + `buildPaymentFollowupEmailBody_` | Payment/receipt follow-up | Selected applicant; batch filter can map `payment_pending`; Stage Batch currently does not map to it | Parent/guardian | Applicant ID, grade, subjects, payment/quote, payment instructions, portal URL | Safe against acceptance implication; still uses `[ACTION REQUIRED]` placeholders when row lacks payment details | MINOR REPAIR |
| `application_verified_quote` | Registry + `buildApplicationVerifiedQuoteBody_` | Documents verified, fee/subject/payment guidance | Selected applicant after docs verified | Parent/guardian | Applicant ID, name, grade, subjects, quote/amount, payment instructions | Useful but not integrated with computed quote/Zoho data; unresolved placeholders are common and send-blocking | MAJOR REWRITE |
| `application_receipt_request` | Registry + `buildApplicationReceiptRequestBody_` | Request payment receipt/proof | Selected applicant when payment evidence missing | Parent/guardian | Applicant ID, receipt/upload instruction | Clear and safe; should be linked to payment-pending/payment-evidence states | MINOR REPAIR |
| `application_acceptance_confirmation` | Registry + `buildApplicationAcceptanceConfirmationBody_` | Acceptance/enrolment confirmation | Selected applicant only after explicit authority | Parent/guardian | Applicant ID, name, grade, subjects, acceptance/enrolment status, next steps | High-risk template; current body contains operator-facing wording and placeholder-heavy language | MAJOR REWRITE |
| `application_exam_fee_reminder` | Registry + `buildApplicationExamFeeReminderBody_` | National exam fee reminder | Selected applicant only after exam-fee authority | Parent/guardian | Applicant ID, confirmed subject count, fee total | Safe because it states fee basis and no acceptance; too generic until exam authority exists | MINOR REPAIR |
| `application_final_reminder` | Registry + `buildApplicationFinalReminderBody_` | Final outstanding-action follow-up | Selected applicant only after operator cadence review | Parent/guardian | Applicant ID, outstanding action, deadline/urgency | Operationally safe because placeholders block send; needs contextual defaults | MINOR REPAIR |
| `prospect_general_guidance` | Registry + `buildProspectGeneralGuidanceBody_` | General FODE guidance | Selected-recipient/manual only, not applicant Stage Batch | Interested person or selected applicant contact | Application link/info/FAQ where available | Safe generic prospect language; not true bulk prospect tooling yet | READY |
| `contact_fallback_manual` | Registry + `buildContactFallbackManualBody_` | Manual fallback advisory | Invalid/no effective email | Operator, not parent | Applicant ID, manual contact instruction | Correctly operator-facing and not bulk email; should not be treated as parent template | READY |
| `docs_verified_payment_required` legacy external email | `sendDocsVerifiedPaymentRequiredEmail_` | Documents verified quote/payment required email | Older docs-verified workflow outside normalized registry | Parent/guardian | Applicant ID, computed quote, payment instructions, portal URL | Still present and more payment-complete than `application_verified_quote`, but outside normalized registry/send-surface authority | MAJOR REWRITE |
| `payment_receipt_alert` admin alert | `notifyAdminPaymentReceiptUploaded_` | Admin notification of receipt upload | Fee receipt transition | Admin alert address | Applicant ID, row, admin deep link | Not parent-facing; distinct operational alert | READY |
| `verified_invoice` / `verified_receipt` | No dedicated normalized type found | Named in requested scope but not present as first-class types | N/A | N/A | Covered only indirectly by Zoho/Books and receipt request/payment follow-up | MAJOR REWRITE |
| Classroom-related templates | No dedicated parent-facing normalized template found | Classroom acceptance/handover future communication | Future classroom handover/acceptance | Parent/guardian and/or classroom operator | Acceptance, enrolment, subjects, classroom readiness | Current classroom references are OPS/handover context, not a parent template family | MAJOR REWRITE |

Template count summary:

- Configured normalized message types: 14
- Selected-applicant UI options: 14
- Stage Batch lifecycle message types: 2 effective types (`legacy_invite`, `reminder`)
- Applicant batch filter types: 3 (`legacy_invite_eligible`, `docs_missing`, `payment_pending`)
- Legacy/external communication-like workflows outside registry: at least 2 (`docs_verified_payment_required`, `payment_receipt_alert`)
- Requested but missing dedicated types: `verified_invoice`, `verified_receipt`, classroom handover/acceptance variants

## Stage mapping matrix

| Stage/filter | Current mapping | Surface | Desired direction | Finding |
|---|---|---|---|---|
| `INVITE_PENDING` | `legacy_invite` | Stage Batch | Keep | Correct for portal invitation |
| `INVITED_AWAITING_RESPONSE` | `reminder` | Stage Batch | Keep or eventually more specific reminder subtype | Safe but overloaded |
| `REMINDER_DUE` | `reminder` | Stage Batch | Keep or eventually subtype | Safe but overloaded |
| `DOCS_REQUIRED` | `reminder` | Stage Batch | Prefer `docs_missing` after authority proof | Current mapping hides specific H2/H3 docs-missing wording |
| `PAYMENT_REQUIRED` | `reminder` | Stage Batch | Prefer `payment_followup` or `application_receipt_request` depending evidence | Current mapping hides specific payment wording |
| `RECEIPT_AWAITING_VERIFICATION` | `reminder` | Stage Batch | Prefer receipt/payment verification wording | Current mapping hides specific receipt workflow |
| `PROCESSING` | unsupported | Stage Batch | Keep unsupported | Correct; no batch send |
| `legacy_invite_eligible` | `legacy_invite` | Applicant batch planner | Keep | Super-only planning path |
| `docs_missing` filter | `docs_missing` | Applicant batch planner | Reconcile with Stage Batch | Exists, but operator workflow is less visible than Stage Batch |
| `payment_pending` filter | `payment_followup` | Applicant batch planner | Reconcile with Stage Batch | Exists, but operator workflow is less visible than Stage Batch |

## Parent communication assessment

Ready or near-ready:

- `fd_acknowledgement`: good receipt language; explicitly avoids acceptance/enrolment implication.
- `application_feedback`: useful for correction/resubmission; parent-facing.
- `docs_missing`: non-blaming and clear; consequence wording is acceptable but should be softened if operator wants a warmer tone.
- `payment_followup`: does not imply acceptance; includes payment evidence next steps.
- `application_receipt_request`: clear and bounded to payment evidence.
- `prospect_general_guidance`: safe generic guidance and no applicant-specific claims.

Needs repair:

- `application_verified_quote`: should pull computed fee quote where possible via `computeFodeFeeQuote_()` and/or payment instruction config, rather than relying heavily on `[ACTION REQUIRED]` placeholders.
- `application_acceptance_confirmation`: currently says “operator-confirmed” and “Do not rely on this message unless...” in parent-facing text. That is implementation/operator language and should be rewritten before real use.
- `application_final_reminder`: needs contextual defaults from applicant stage/actionability so operators do not manually fill every critical field.
- `application_exam_fee_reminder`: needs confirmed subject-count insertion and authority gate before routine use.
- `contact_fallback_manual`: correct as an operator advisory; should not be sent as a normal parent email.

## Payment communication assessment

Current normalized payment templates:

- `payment_followup`: selected and batch-filter capable; blocks unresolved placeholders. Good for outstanding payment/receipt state, but not quote-complete.
- `application_receipt_request`: selected only. Good for receipt evidence request.
- `application_verified_quote`: selected only. Intended to cover docs verified to quote/payment guidance but currently does not use the legacy computed quote function.

Legacy payment/quote workflow:

- `computeFodeFeeQuote_()` still exists and computes registration + per-subject fee from selected subjects.
- `sendDocsVerifiedPaymentRequiredEmail_()` still exists and produces a quote/payment-required email with computed fee breakdown and portal link.
- That legacy workflow uses `sendEmailBestEffort_()` and external type `docs_verified_payment_required`, not normalized `sendApplicantMessage_()` / registry authority.
- `application_verified_quote` has metadata `legacyExternalType: "docs_verified_quote_email"`, but no direct reconciliation with `sendDocsVerifiedPaymentRequiredEmail_()` is implemented.

Payment finding:

- Quote/payment authority is split between a better legacy quote builder and safer normalized selected-template send gates.
- H6B should merge computed quote/payment instruction insertion into normalized `application_verified_quote`, while preserving send gates and not changing Zoho/payment authority.

## Quote / invoice workflow assessment

Zoho/Books workflow status:

- Zoho Books preview/draft/test-email controls are present in `AdminUI.html` and protected by existing backend gates.
- Prior tests cover visibility and role-boundary expectations for `admin_previewZohoBooksFodePayload`, `admin_createZohoBooksFodeDraftInvoice`, and related gated surfaces.
- Invoice/draft/test-email is not part of the normalized communication template registry.
- No dedicated `verified_invoice` or `verified_receipt` normalized message type exists.

Classification:

- Zoho/Books is a protected live financial surface and must not be changed as part of H6 template copy work unless a separate payment/Zoho CIS approves it.
- Communications can read/display quote/invoice evidence if already present, but must not create invoice authority or change Books behavior in H6B.

## Custom email findings

- `custom_email` is configured, active, selected-only, not batch-safe, and editable/freeform.
- Subject defaults to `FODE KIA Information and Next Steps`.
- Body defaults to a generic selected-applicant message with Applicant ID and admissions contact details.
- `communicationRequiresResolvedActionPlaceholders_("custom_email")` is false, which is appropriate because custom email is operator-authored/freeform.
- Send path still uses selected-applicant gates, effective email validation, production-send/stabilization gates, idempotency, and cooldown.

Finding: `custom_email` is operationally correct and should remain selected-only. Do not make it batch-safe.

## Missing information matrix

| Information need | Current source | Used by templates | Gap |
|---|---|---|---|
| Applicant ID | Row / context | Most templates | Good |
| Applicant name | Row helper `buildApplicantFullName_()` | Payment, quote, acceptance, feedback | Good when names present |
| Parent/guardian name | Row helper `buildParentOrApplicantName_()` | Feedback, acknowledgement, custom | Not consistently used in all parent templates |
| Portal URL | Portal secret resolution | invite/reminder/fd_ack/feedback/docs/payment | Required for many templates; blocks if missing |
| Document attention lines | `CONFIG.DOC_FIELDS`, row status/comment | feedback/docs/fd_ack | Good |
| Grade | row fields or placeholder | payment/quote/acceptance | Placeholder often required |
| Subjects | row fields or placeholder | payment/quote/acceptance/exam fee | Placeholder often required; exam fee needs count |
| Computed fee quote | `computeFodeFeeQuote_()` | Legacy quote only | Not integrated into normalized verified quote/payment follow-up |
| Payment instructions | row fields or placeholder | payment/quote | Should fallback to `CONFIG.PAYMENT_INSTRUCTIONS_TEXT` where safe |
| Invoice number/status | Zoho/Books fields | legacy/OPS/Books, not normalized templates | No normalized verified invoice template |
| Acceptance/enrolment authority | row fields / future classroom authority | acceptance | Not strong enough; template must remain manually gated |
| Classroom handover | OPS/classroom context | none normalized | Future template family needed |
| Contactability/bounce evidence | runtime row fields only | gates | External mailbox bounce evidence still not automatically ingested |

## Auto-selection recommendations

Recommended H6B strategy:

1. Keep `custom_email` selected-only and never batch-safe.
2. Keep `legacy_invite` for `INVITE_PENDING`.
3. Keep `reminder` for generic invite-response reminders only.
4. Map document-specific contexts to `docs_missing` only when authoritative missing/incomplete document state is available.
5. Map payment-required with no receipt to `payment_followup` or `application_receipt_request` based on whether the message asks for payment or receipt evidence.
6. Map docs verified + no payment evidence to `application_verified_quote` only after the normalized template can insert computed quote/payment instructions safely.
7. Keep acceptance/enrolment confirmation manual-selected only until classroom/acceptance authority is explicit.
8. Do not map `application_exam_fee_reminder`, `prospect_general_guidance`, `contact_fallback_manual`, or acceptance templates into Stage Batch.

## Repair priority

| Priority | Item | Recommended action |
|---|---|---|
| P0 | Acceptance confirmation parent wording | Rewrite to remove operator/implementation wording before live use |
| P0 | Verified quote/payment guidance | Integrate computed quote and safe payment instruction fallback into normalized template |
| P1 | Stage Batch DOCS/PAYMENT contexts | Decide whether Stage Batch should use `docs_missing` / `payment_followup` instead of overloaded `reminder`; add tests before changing |
| P1 | `verified_invoice` / `verified_receipt` | Define whether these become normalized selected templates or remain Zoho/Books-only workflow states |
| P1 | Final reminder defaults | Generate outstanding action/deadline hints from lifecycle/actionability where safe |
| P2 | Exam fee reminder | Insert confirmed subject count and computed K150 x subjects only after authority exists |
| P2 | Classroom templates | Create future classroom handover/acceptance communication family after classroom authority is defined |
| P2 | Prospect bulk guidance | Keep out of applicant Stage Batch; implement only under separate marketing/prospect authority |

## Suggested implementation sequence

H6B, narrow runtime patch:

- Rewrite `application_acceptance_confirmation` parent-facing body.
- Improve `application_verified_quote` to use `computeFodeFeeQuote_()` and `CONFIG.PAYMENT_INSTRUCTIONS_TEXT` fallback where row-specific values are absent.
- Improve `payment_followup` with the same safe payment instruction fallback.
- Add tests proving reduced placeholders when row data is sufficient and continued send-block when mandatory unresolved placeholders remain.

H6C, authority mapping:

- Decide and test whether `DOCS_REQUIRED` maps to `docs_missing` and payment stages map to `payment_followup` / `application_receipt_request`.
- Preserve Stage Batch preview/send parity and idempotency.

H6D, payment/Zoho reconciliation:

- Decide whether `docs_verified_payment_required` legacy external workflow is retired, wrapped, or retained as a separate legacy compatibility path.
- Do not alter Zoho write behavior without a payment/Zoho-specific CIS.

H6E, classroom/contactability future work:

- Define classroom acceptance/handover template authority.
- Define contactability warnings from runtime-readable bounce/manual-contact fields only.

## Validation

Required validation for audit-only pass:

- `node --check Code.js`
- `node --check Admin.js`
- `node --check Routes.js`
- `node --check Utils.js`
- `node tests/communication-send-gate-matrix.test.js`
- `node tests/communication-semantic-registry.test.js`
- `node tests/admin-ui-rpc-contract.test.js`
- `git diff --check`

## Windows runner recovery

- Normal runner hit `CreateProcessAsUserW failed: 1312` during repo-local reads.
- Controlled local execution was used for repo-local git/search/read/validation only under `D:\Repos\FODE_Runtime_1wog`.
- No controlled execution was used for Apps Script push, deployment, versioning, repin, Sheet/Drive mutation, production, Student, or OPS actions.

## Acceptance conclusion

PASS_WITH_WARNINGS because:

- Every configured message type and legacy communication-like workflow found in scope was audited.
- Missing operational information is identified.
- Quote/payment workflow split is determined.
- `custom_email` is verified as selected-only and operational.
- Auto-selection and repair recommendations are prioritized.
- No runtime repair was needed for an obvious broken custom-email initialization defect.

H6B implementation may begin as a communications-only runtime patch after review.