# Regression Fixture Dataset

## Purpose

The regression fixture dataset defines permanent, read-only test applicants used to verify FODE Admin authority behavior across communication, payment, document, lifecycle, and review workflows.

The dataset is infrastructure. It must not be created silently from Playwright, and it must not mutate production records during verification.

## Fixture Lifecycle

Each fixture has a stable applicant ID, stable email, known lifecycle state, and documented expected authority. Fixtures are maintained deliberately by release operators.

Suggested fixture email:

`sanjay@minervacenters.com`

The Playwright verifier reads fixture IDs from environment variables and fails configured fixture mismatches with diagnostics.

## Fixture Ownership

Owner: FODE release engineering.

Responsibilities:

- Keep fixture applicants in their documented lifecycle state.
- Replace fixtures when source records become unsuitable.
- Record replacements in Playwright sandbox `.env` and release evidence.
- Never use live operational applicants as implicit fallbacks.

## Canonical Fixtures

| Fixture | Env var | Permanent name | Workflow state | Document state | Payment state | Expected recommendation |
| --- | --- | --- | --- | --- | --- | --- |
| COMM-A | `FODE_COMM_AUTHORITY_APPLICANT_A` | `TEST_COMM_A` | Application Received | Documents Pending | Payment Not Due | `docs_missing` |
| COMM-B | `FODE_COMM_AUTHORITY_APPLICANT_B` | `TEST_COMM_B` | Awaiting Payment | Documents Verified | Payment Outstanding | `application_verified_quote` or `payment_followup` |
| COMM-C | `FODE_COMM_AUTHORITY_APPLICANT_C` | `TEST_COMM_C` | Awaiting Payment Verification | Documents Verified | Payment Evidence Uploaded | No applicant send action or payment verification workflow |
| COMM-D | `FODE_COMM_AUTHORITY_APPLICANT_D` | `TEST_COMM_D` | Ready for Acceptance | Documents Verified | Payment Verified | `application_acceptance_confirmation` |
| COMM-E | `FODE_COMM_AUTHORITY_APPLICANT_E` | `TEST_COMM_E` | Accepted | Documents Verified | Payment Verified or Closed | No recommended send action |
| COMM-F | `FODE_COMM_AUTHORITY_APPLICANT_F` | `TEST_COMM_F` | Dormant / Rejected / Archived | Closed or Not Actionable | Closed or Not Actionable | No recommended send action |

## Expected Authority

### COMM-A

Allowed templates:

- `docs_missing`

Blocked templates:

- `payment_followup`
- `application_receipt_request`
- `application_verified_quote`
- `application_acceptance_confirmation`

Override behavior:

Protected payment and acceptance templates require Super Admin override and justification.

### COMM-B

Allowed templates:

- `application_verified_quote`
- `payment_followup`

Blocked templates:

- `application_acceptance_confirmation`

Override behavior:

Acceptance requires Super Admin override until payment authority is satisfied.

### COMM-C

Allowed templates:

- No routine applicant send action is expected.

Blocked templates:

- `application_receipt_request`
- `application_acceptance_confirmation`

Override behavior:

Acceptance requires Super Admin override until payment is verified.

### COMM-D

Allowed templates:

- `application_acceptance_confirmation`

Blocked templates:

- `payment_followup`
- `application_receipt_request`

Override behavior:

No override should be required for acceptance when document and payment authority are satisfied.

### COMM-E

Allowed templates:

- No routine applicant send action is expected.

Blocked templates:

- `application_acceptance_confirmation`
- `payment_followup`
- `application_receipt_request`

Override behavior:

Repeat acceptance and payment follow-up are blocked.

### COMM-F

Allowed templates:

- Only appropriate manual communication, if authority permits it.

Blocked templates:

- `docs_missing`
- `payment_followup`
- `application_receipt_request`
- `application_verified_quote`
- `application_acceptance_confirmation`

Override behavior:

Operational communications require exceptional Super Admin override where allowed.

## Fixture Verification Utility

Playwright command:

```powershell
npm run test:comm-authority-fixtures
```

The verifier checks:

- Fixture applicant exists.
- Expected lifecycle text is visible.
- Expected document state is visible.
- Expected payment state is visible.
- Expected workflow state is visible.
- Expected recommendation is present.
- Expected blocked templates are blocked.
- Expected allowed templates can produce preview evidence.

Configured fixture mismatches fail with explicit diagnostics. Missing fixture environment variables are reported as setup warnings because this CIS does not create live applicants.

## Bootstrap Plan

Recommended implementation: Option 1, but gated.

Create a helper utility in a future CIS that can prepare or verify fixture records only after explicit operator approval. The helper should support dry-run, proposed changes, and exact mutation preview before any Sheet or Drive write.

Do not create applicants automatically in Playwright. Do not silently mutate production records.

Until that helper exists, operators may create the fixtures manually using this document as the required state contract.

## Playwright Alignment

Communication authority smoke uses only:

- `FODE_COMM_AUTHORITY_APPLICANT_A`
- `FODE_COMM_AUTHORITY_APPLICANT_B`
- `FODE_COMM_AUTHORITY_APPLICANT_C`
- `FODE_COMM_AUTHORITY_APPLICANT_D`
- `FODE_COMM_AUTHORITY_APPLICANT_E`
- `FODE_COMM_AUTHORITY_APPLICANT_F`

The communication visibility smoke uses `FODE_COMM_AUTHORITY_APPLICANT_A`.

No hardcoded applicant IDs are permitted in communication fixture tests.

## Future Regression Roadmap

Future fixture expansion should cover:

- Admissions acceptance and rejection flows.
- Payment authority and receipt verification.
- Document gallery rendering.
- Review queue rollups.
- Lifecycle authority transitions.
- Communication authority matrix.
- Stage batch communications.
- OPS workflows when OPS is unfrozen.

Each future area should define fixture state, allowed actions, blocked actions, expected recommendation, and override behavior before implementation.

## Boundaries

Regression fixture verification must not:

- Create production applicants automatically.
- Send email or WhatsApp.
- Modify Sheets.
- Modify Drive.
- Change payment status.
- Change document status.
- Touch Student, Production, or OPS.
