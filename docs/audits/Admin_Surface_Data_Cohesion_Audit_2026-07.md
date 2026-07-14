# Admin Surface Data Cohesion Audit 2026-07

- Classification: `PASS_WITH_FINDINGS`
- Runtime: `r345 / 345`
- Apps Script version: `378`
- Admin deployment pin: `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ @378`
- Feature commit: `47fb171`
- Runtime bump commit: `5731e9d`
- Live audit evidence: `.release-proof/r345-live-acceptance/live-audit.json`
- Live screenshots:
  - `.release-proof/r345-live-acceptance/01-global-search-waffi.png`
  - `.release-proof/r345-live-acceptance/02-review-waffi.png`
  - `.release-proof/r345-live-acceptance/03-finance-search-waffi.png`
  - `.release-proof/r345-live-acceptance/04-finance-search-id.png`
  - `.release-proof/r345-live-acceptance/05-current-admin-fallback.png`

## Scope

This audit covers the Admin staging release that restored one shared operational authority chain:

`Google Sheet -> Canonical Population -> Canonical Lifecycle -> Actionability -> Communication Authority -> Canonical Finance -> shared operational-route projection -> Current Admin and Operator Next`

No Sheet, applicant, email, WhatsApp, Books, Student, Production, or portal mutation was performed.

## Root Cause

Current Admin and Operator Next had drifted into parallel interpretations of the same rows:

- Current Admin Finance followed actionability ownership and showed a small active Finance cohort.
- Operator Next Canonical Finance treated nearly all missing payment evidence as `PAYMENT_PENDING`.
- Finance search accepted a term in the UI but could ignore top-level `searchQuery` when `filters` was present.
- Review queues and route cards could require extra navigation instead of opening the exact working queue directly.

The repair moved both shells onto shared canonical population, finance, search, and operational-route authorities.

## Authoritative Sheet Identity

- Spreadsheet ID: `1fHmeGNmpOj9PEPQ5Fp4tUyCP4UdH70lltukraD4SalU`
- Primary tab: `FODE_Data`
- Population ledger timestamp: `2026-07-14T01:39:46.637Z`
- Operational route timestamp: `2026-07-14T01:39:47.365Z`
- Finance timestamp: `2026-07-14T01:39:45.705Z`

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
- Active Finance work total: `5`
- Finance exceptions: `1`

This confirms the repaired contract: missing evidence no longer defaults the whole population into active Finance work.

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

- Current Admin active Finance cohort: `5`
- Canonical active Finance cohort: `5`
- Active Finance ApplicantID membership parity: `PASS`
- Current Admin Admissions queue count: `7`
- Canonical Admissions route count: `7`
- Current Admin paid-approved count: `2`
- Canonical paid-verified count: `2`
- Shared search by name: `1`
- Shared search by ApplicantID: `1`
- Legacy search by name: `1`
- Legacy search by ApplicantID: `1`
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
- Global search found Waffi by name and ApplicantID.
- Finance search found Waffi by name and ApplicantID.
- Review handoff opened the exact approved ApplicantID.
- No `Continue to queue` control was present.

Finding:

- The lifecycle stage helper for `PAYMENT_PENDING` still did not switch from Lifecycle to the Finance route during live browser interaction.
- The same helper still exposes a generic `Open first Review` secondary control.

## Confidence and Limitations

Confidence: `PASS_WITH_FINDINGS`

Reasons:

- Sheet population, lifecycle, actionability, route totals, and Finance applicability reconcile.
- Current Admin and Operator Next now share the same server authorities for route projection and search.
- Live parity passed for Finance active membership, Admissions count, paid-verified history, search, and review target identity.
- A bounded route-handoff issue remains on the Lifecycle helper for `PAYMENT_PENDING`.

Limitations:

- Committed evidence excludes row-level PII beyond approved ApplicantID `FODE-26-002959`.
- Live aggregate RPCs do not expose raw empty-upload placeholder subtype counts for document and receipt fields; those subtype rules are covered by focused regression tests.
