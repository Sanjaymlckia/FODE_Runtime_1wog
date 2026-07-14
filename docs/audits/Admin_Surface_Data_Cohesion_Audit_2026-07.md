# Admin Surface Data Cohesion Audit 2026-07

- Classification: `PASS`
- Runtime: `r346 / 346`
- Apps Script version: `379`
- Admin deployment pin: `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ @379`
- Feature commit: `a4ce7c9`
- Runtime bump commit: `c59e7da`
- Live audit evidence: `.release-proof/r346-finance-routing-live/live-proof.json`
- Live screenshots:
  - `.release-proof/r346-finance-routing-live/01-payment-pending-direct.png`
  - `.release-proof/r346-finance-routing-live/02-payment-to-verify-direct.png`
  - `.release-proof/r346-finance-routing-live/03-non-first-row-review.png`
  - `.release-proof/r346-finance-routing-live/04-waffi-search-review.png`
  - `.release-proof/r346-finance-routing-live/05-current-admin-fallback.png`

## Scope

This audit covers the Admin staging release that restored one shared operational authority chain:

`Google Sheet -> Canonical Population -> Canonical Lifecycle -> Actionability -> Communication Authority -> Canonical Finance -> shared operational-route projection -> Current Admin and Operator Next`

No Sheet, applicant, email, WhatsApp, Books, Student, Production, or portal mutation was performed.

## Root Cause

The r345 release restored shared authority, but three bounded acceptance gaps remained:

- `activeFinanceWork` still over-counted rows that had Finance facts but no current Finance action.
- Lifecycle payment helpers did not open the exact Finance cohort directly.
- Generic `Open first Review` affordances still allowed implicit row selection instead of exact row-level review.

This follow-up tightened both shells onto the same authority semantics: Finance facts remain visible for reporting, but active Finance work now means a current Finance-owned action, and payment helpers open the exact shared Finance cohort directly.

## Authoritative Sheet Identity

- Spreadsheet ID: `1fHmeGNmpOj9PEPQ5Fp4tUyCP4UdH70lltukraD4SalU`
- Primary tab: `FODE_Data`
- Population ledger timestamp: `2026-07-14T02:36:23.598Z`
- Operational route timestamp: `2026-07-14T02:36:23.598Z`
- Finance timestamp: `2026-07-14T02:36:20.634Z`

## Population Reconciliation

- Physical data rows: `329`
- Rows with ApplicantID: `329`
- Blank ApplicantID rows: `0`
- Duplicate ApplicantIDs: `0`
- Canonical population: `329`
- Route summary total: `329`
- Population integrity: `PASS`

## Lifecycle Distribution

| Lifecycle | Count |
| --- | ---: |
| `INCOMPLETE_DOCUMENTS` | 308 |
| `APPLICATION_RECEIVED` | 8 |
| `DOCUMENTS_TO_VERIFY` | 7 |
| `PAYMENT_PENDING` | 2 |
| `DOCUMENT_CORRECTION_REQUIRED` | 1 |
| `PAYMENT_TO_VERIFY` | 1 |
| `ENROLMENT_READY` | 1 |
| `COMPLETE` | 1 |

## Actionability Distribution

| Actionability | Count |
| --- | ---: |
| `COOLING_OFF` | 133 |
| `READY` | 122 |
| `REVIEW_REQUIRED` | 73 |
| `COMPLETE` | 1 |

Actionability totals reconcile exactly to canonical population.

## Primary Operational Route Distribution

| Primary route | Count |
| --- | ---: |
| Applicant Action | 249 |
| Contactability Exceptions | 66 |
| Admissions Review | 7 |
| Finance | 3 |
| Dormant | 2 |
| Academic Administration | 1 |
| Completed / No Action | 1 |

Additional bucket checks:

- Management Exceptions: `0`
- Unknown / Unclassified: `0`
- Duplicate bucket membership: `0` observed in the shared route summary
- Missing bucket membership: `0`

## Finance Evidence and Applicability

| Finance state | Count |
| --- | ---: |
| `NOT_YET_PAYMENT_APPLICABLE` | 322 |
| `PAYMENT_TO_VERIFY` | 3 |
| `PAID_VERIFIED` | 2 |
| `PAYMENT_PENDING` | 2 |

| Finance worklist / recommendation | Count |
| --- | ---: |
| `PAYMENT_REVIEW` | 3 |
| `PAYMENT_FOLLOW_UP` | 2 |
| `NOT_YET_PAYMENT_APPLICABLE` | 322 |
| `NO_PAYMENT_ACTION` | 2 |

Applicability separation:

- No evidence and payment not yet applicable: `322`
- No evidence and payment applicable now: `2`
- Genuine evidence requiring verification: `3`
- Paid verified: `2`
- Active Finance work total: `2`
- Finance exceptions: `1`

Active-work reconciliation:

- Primary Finance route population: `3`
  - `FODE-26-002959`
  - `FODE-26-TEST-002`
  - `FODE-26-TEST-003`
- Active Finance work population: `2`
  - `FODE-26-TEST-002`
  - `FODE-26-TEST-003`
- Removed from active Finance work:
  - `FODE-26-002959` remains a Finance primary-route row, but cooling-off means no current operator Finance action.
  - `FODE-26-002964` and `FODE-26-002985` remain `PAYMENT_TO_VERIFY` Finance facts, but Actionability still owns them as Admissions document review, so they are not active Finance work.

This confirms the repaired contract: Finance facts can remain visible for reporting, but active Finance work is limited to rows where the operator can presently perform the Finance action.

## Document, Contactability, and Communication Cohesion

Document-stage proxy distribution from canonical lifecycle:

- Incomplete documents: `308`
- Documents to verify: `7`
- Document correction required: `1`
- Post-document-complete states: `13`

Contactability distribution:

- `EMAIL_AVAILABLE`: `267`
- `PHONE_FALLBACK_AVAILABLE`: `58`
- `UNCONTACTABLE`: `4`

Communication progress distribution:

- `Cooling-off`: `133`
- `Ready for reminder`: `118`
- `Contactability exception`: `66`
- `Ready for academic review`: `5`
- `Escalation due`: `3`
- `Payment reminder sent today`: `1`
- `Awaiting finance review`: `1`
- `Awaiting admin completion`: `1`
- `Other`: `1`

Communication recommendation distribution:

- `docs_missing`: `309`
- `legacy_invite`: `8`
- `payment_followup`: `2`
- `UNKNOWN`: `10`

## Cross-Shell Parity

Verified live:

- Current Admin payment follow-up cohort: `1`
- Operator Next active payment follow-up cohort: `1`
- Payment follow-up ApplicantID parity: `PASS`
- Current Admin payment verification cohort: `1`
- Operator Next active payment verification cohort: `1`
- Payment verification ApplicantID parity: `PASS`
- Canonical primary Finance route count: `3`
- Shared search by name: `1`
- Shared search by ApplicantID: `1`
- Review target parity for approved case `FODE-26-002959`: `PASS`

Waffi ordinary-case proof:

- ApplicantID: `FODE-26-002959`
- Shared search row: `50`
- Legacy search row: `50`
- Finance search row: `50`
- Finance state: `PAYMENT_PENDING`

## Browser Acceptance

PASS:

- Operator Next loaded without console errors.
- Current Admin fallback loaded without console errors.
- `PAYMENT_PENDING` helper opened Finance `PAYMENT_FOLLOW_UP` directly with no intermediate step.
- `PAYMENT_TO_VERIFY` helper opened Finance `PAYMENT_REVIEW` directly with no intermediate step.
- No `Continue to queue` control appeared on the affected helper flow.
- No `Open first Review` control remained.
- Non-first-row Finance review opened the exact ApplicantID `FODE-26-002985`.
- Closing Review returned to the exact Finance `ALL_APPLICANTS / PAYMENT_REVIEW` cohort.
- Global search found Waffi by name and ApplicantID.
- Review handoff opened the exact approved ApplicantID.
- Waffi search and exact review handoff still passed.

## Confidence and Limitations

Confidence: `PASS`

Reasons:

- Sheet population, lifecycle, route totals, and Finance applicability reconcile.
- Current Admin and Operator Next match on the affected live Finance cohorts and ApplicantID membership.
- Direct helper routing, exact row review, return context, and Waffi regression all passed on live Admin staging `r346 / 346`.

Limitations:

- Committed evidence excludes row-level PII beyond approved ApplicantID `FODE-26-002959`.
- Evidence is sufficient for operator manual inspection, but owner visual acceptance remains a separate manual decision.
