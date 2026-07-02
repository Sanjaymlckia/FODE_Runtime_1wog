# Regression Fixture Bootstrap Preview

Status: dry run only

## Scope

This preview prepares six permanent communication authority fixtures:

- `TEST_COMM_A`
- `TEST_COMM_B`
- `TEST_COMM_C`
- `TEST_COMM_D`
- `TEST_COMM_E`
- `TEST_COMM_F`

No records were created or updated during this CIS.

## Existing Fixture Search

Local repository and Playwright sandbox search:

- `TEST_COMM_*`: not found in runtime source or Playwright env/config.
- `REG_COMM_*`: not found in runtime source or Playwright env/config.
- `REGRESSION_FIXTURE_DO_NOT_PROCESS`: not found in runtime source or Playwright env/config.

Live Sheet search:

- Not executed in this shell because no read-only Sheet search command or configured `FODE_ADMIN_URL`/fixture endpoint is available.
- Required before any mutation approval.
- Search keys: `TEST_COMM_A`, `TEST_COMM_B`, `TEST_COMM_C`, `TEST_COMM_D`, `TEST_COMM_E`, `TEST_COMM_F`, `REG_COMM_A`, `REG_COMM_B`, `REG_COMM_C`, `REG_COMM_D`, `REG_COMM_E`, `REG_COMM_F`, `REGRESSION_FIXTURE_DO_NOT_PROCESS`.

Live search must report:

- Applicant ID.
- Row number.
- Current lifecycle state.
- Email.
- Document state.
- Payment state.
- Communication state.

## Target Sheet

Target spreadsheet:

- Staging spreadsheet ID: `1YFgLtUExz__fzQ4zTNoIyGTu-nrnasS7dIaShNPl7Cs`

Target tab:

- `FODE_Data`

Target row behavior:

- If an existing `TEST_COMM_*` fixture row is found: update that exact row only after approval.
- If no existing fixture row is found: append one row per missing fixture only after approval.
- Do not update operational applicant rows.

## Applicant ID Strategy

Preferred strategy:

1. Run a read-only scan of `ApplicantID` values in `FODE_Data`.
2. Allocate the next six valid IDs using the runtime convention:
   - Prefix: `FODE-26-`
   - Digits: `6`
3. Reserve IDs in fixture order:
   - `TEST_COMM_A`
   - `TEST_COMM_B`
   - `TEST_COMM_C`
   - `TEST_COMM_D`
   - `TEST_COMM_E`
   - `TEST_COMM_F`

Do not hardcode final applicant IDs before the read-only scan confirms there is no collision.

## Common Fixture Values

These values apply to all six fixtures unless overridden below.

| Column | Value |
| --- | --- |
| `Parent_Email` | `sanjay@minervacenters.com` |
| `Parent_Email_Corrected` | `sanjay@minervacenters.com` |
| `Parent_Full_Name` | `Regression Fixture Guardian` |
| `Relationship_To_Student` | `Guardian` |
| `Parent_Phone` | `+67500000000` |
| `Gender` | `Not Specified` |
| `Date_Of_Birth` | `2009-01-01` |
| `Grade_Applying_For` | `Grade 10` |
| `Subjects_Selected_Canonical` | `English, Mathematics` |
| `Physical_Exam_Site` | `KIA` |
| `Program` | `FODE` |
| `Program_Applied_For` | `FODE` |
| `Intake_Year` | `2026` |
| `Type` | `Regression Fixture` |
| `Home_Address` | `REGRESSION_FIXTURE_DO_NOT_PROCESS` |
| `Prev_School_Name` | `Regression Fixture School` |
| `Prev_School_Grade` | `Grade 9` |
| `Reason_For_Transfer` | `REGRESSION_FIXTURE_DO_NOT_PROCESS` |
| `Portal_Access_Status` | `Regression Fixture` |
| `Email_Bounce_Flag` | blank |
| `Do_Not_Contact` | blank |

Marker fields:

- Applicant name prefix: `TEST_COMM_`
- Notes marker, if a notes-like column exists: `REGRESSION_FIXTURE_DO_NOT_PROCESS`
- If no notes-like column exists, use `Home_Address` and `Reason_For_Transfer` as the non-operational markers.

## Proposed Fixture Rows

### TEST_COMM_A

Purpose: Documents Pending.

Expected Playwright env var:

- `FODE_COMM_AUTHORITY_APPLICANT_A=<allocated ApplicantID>`

Proposed values:

| Column | Value |
| --- | --- |
| `ApplicantID` | allocate next safe ID |
| `First_Name` | `TEST_COMM_A` |
| `Last_Name` | `Documents_Pending` |
| `Portal_Submitted` | ISO timestamp at creation |
| `PortalLastUpdateAt` | ISO timestamp at creation |
| `Birth_ID_Passport_File` | blank |
| `Latest_School_Report_File` | blank |
| `Passport_Photo_File` | blank |
| `Fee_Receipt_File` | blank |
| `Birth_ID_Status` | blank |
| `Report_Status` | blank |
| `Photo_Status` | blank |
| `Receipt_Status` | blank |
| `Docs_Verified` | blank |
| `Doc_Verification_Status` | `Pending` |
| `Payment_Verified` | blank |
| `Email_Status` | blank |

Expected communication authority:

- Recommended: `docs_missing`
- Allowed: `docs_missing`
- Blocked: `payment_followup`, `application_receipt_request`, `application_verified_quote`, `application_acceptance_confirmation`
- Override: protected payment/acceptance templates require Super Admin justification.

### TEST_COMM_B

Purpose: Documents Verified / Payment Outstanding.

Expected Playwright env var:

- `FODE_COMM_AUTHORITY_APPLICANT_B=<allocated ApplicantID>`

Proposed values:

| Column | Value |
| --- | --- |
| `ApplicantID` | allocate next safe ID |
| `First_Name` | `TEST_COMM_B` |
| `Last_Name` | `Docs_Verified_Payment_Outstanding` |
| `Portal_Submitted` | ISO timestamp at creation |
| `PortalLastUpdateAt` | ISO timestamp at creation |
| `Birth_ID_Passport_File` | `REGRESSION_FIXTURE_DOC_PLACEHOLDER` |
| `Latest_School_Report_File` | `REGRESSION_FIXTURE_DOC_PLACEHOLDER` |
| `Passport_Photo_File` | `REGRESSION_FIXTURE_DOC_PLACEHOLDER` |
| `Fee_Receipt_File` | blank |
| `Birth_ID_Status` | `VERIFIED` |
| `Report_Status` | `VERIFIED` |
| `Photo_Status` | `VERIFIED` |
| `Receipt_Status` | blank |
| `Docs_Verified` | `Yes` |
| `Doc_Verification_Status` | `Verified` |
| `Payment_Verified` | blank |
| `Email_Status` | blank |

Expected communication authority:

- Recommended: `application_verified_quote` or `payment_followup`
- Allowed: `application_verified_quote`, `payment_followup`
- Blocked: `application_acceptance_confirmation`
- Override: acceptance requires Super Admin justification until payment authority is satisfied.

### TEST_COMM_C

Purpose: Payment Evidence Uploaded.

Expected Playwright env var:

- `FODE_COMM_AUTHORITY_APPLICANT_C=<allocated ApplicantID>`

Proposed values:

| Column | Value |
| --- | --- |
| `ApplicantID` | allocate next safe ID |
| `First_Name` | `TEST_COMM_C` |
| `Last_Name` | `Payment_Evidence_Uploaded` |
| `Portal_Submitted` | ISO timestamp at creation |
| `PortalLastUpdateAt` | ISO timestamp at creation |
| `Birth_ID_Passport_File` | `REGRESSION_FIXTURE_DOC_PLACEHOLDER` |
| `Latest_School_Report_File` | `REGRESSION_FIXTURE_DOC_PLACEHOLDER` |
| `Passport_Photo_File` | `REGRESSION_FIXTURE_DOC_PLACEHOLDER` |
| `Fee_Receipt_File` | `REGRESSION_FIXTURE_RECEIPT_PLACEHOLDER` |
| `Birth_ID_Status` | `VERIFIED` |
| `Report_Status` | `VERIFIED` |
| `Photo_Status` | `VERIFIED` |
| `Receipt_Status` | `PENDING_REVIEW` |
| `Docs_Verified` | `Yes` |
| `Doc_Verification_Status` | `Verified` |
| `Payment_Verified` | blank |
| `Email_Status` | blank |

Expected communication authority:

- Recommended: no routine applicant send action or payment verification workflow.
- Allowed: none for routine applicant sends.
- Blocked: `application_receipt_request`, `application_acceptance_confirmation`
- Override: acceptance requires Super Admin justification until payment is verified.

### TEST_COMM_D

Purpose: Payment Verified.

Expected Playwright env var:

- `FODE_COMM_AUTHORITY_APPLICANT_D=<allocated ApplicantID>`

Proposed values:

| Column | Value |
| --- | --- |
| `ApplicantID` | allocate next safe ID |
| `First_Name` | `TEST_COMM_D` |
| `Last_Name` | `Payment_Verified` |
| `Portal_Submitted` | ISO timestamp at creation |
| `PortalLastUpdateAt` | ISO timestamp at creation |
| `Birth_ID_Passport_File` | `REGRESSION_FIXTURE_DOC_PLACEHOLDER` |
| `Latest_School_Report_File` | `REGRESSION_FIXTURE_DOC_PLACEHOLDER` |
| `Passport_Photo_File` | `REGRESSION_FIXTURE_DOC_PLACEHOLDER` |
| `Fee_Receipt_File` | `REGRESSION_FIXTURE_RECEIPT_PLACEHOLDER` |
| `Birth_ID_Status` | `VERIFIED` |
| `Report_Status` | `VERIFIED` |
| `Photo_Status` | `VERIFIED` |
| `Receipt_Status` | `VERIFIED` |
| `Docs_Verified` | `Yes` |
| `Doc_Verification_Status` | `Verified` |
| `Payment_Verified` | `Yes` |
| `Email_Status` | blank |

Expected communication authority:

- Recommended: `application_acceptance_confirmation`
- Allowed: `application_acceptance_confirmation`
- Blocked: `payment_followup`, `application_receipt_request`
- Override: no override expected for acceptance when document and payment authority are satisfied.

### TEST_COMM_E

Purpose: Accepted.

Expected Playwright env var:

- `FODE_COMM_AUTHORITY_APPLICANT_E=<allocated ApplicantID>`

Proposed values:

| Column | Value |
| --- | --- |
| `ApplicantID` | allocate next safe ID |
| `First_Name` | `TEST_COMM_E` |
| `Last_Name` | `Accepted` |
| `Portal_Submitted` | ISO timestamp at creation |
| `PortalLastUpdateAt` | ISO timestamp at creation |
| `Birth_ID_Passport_File` | `REGRESSION_FIXTURE_DOC_PLACEHOLDER` |
| `Latest_School_Report_File` | `REGRESSION_FIXTURE_DOC_PLACEHOLDER` |
| `Passport_Photo_File` | `REGRESSION_FIXTURE_DOC_PLACEHOLDER` |
| `Fee_Receipt_File` | `REGRESSION_FIXTURE_RECEIPT_PLACEHOLDER` |
| `Birth_ID_Status` | `VERIFIED` |
| `Report_Status` | `VERIFIED` |
| `Photo_Status` | `VERIFIED` |
| `Receipt_Status` | `VERIFIED` |
| `Docs_Verified` | `Yes` |
| `Doc_Verification_Status` | `Verified` |
| `Payment_Verified` | `Yes` |
| `Registration_Complete` | `Yes` |
| `Overall_Status` | `Accepted` |
| `Email_Status` | blank |

Expected communication authority:

- Recommended: no recommended send action.
- Allowed: none for routine applicant sends.
- Blocked: `application_acceptance_confirmation`, `payment_followup`, `application_receipt_request`
- Override: repeat acceptance and payment follow-up are blocked.

### TEST_COMM_F

Purpose: Dormant / Rejected / Archived.

Expected Playwright env var:

- `FODE_COMM_AUTHORITY_APPLICANT_F=<allocated ApplicantID>`

Proposed values:

| Column | Value |
| --- | --- |
| `ApplicantID` | allocate next safe ID |
| `First_Name` | `TEST_COMM_F` |
| `Last_Name` | `Dormant_Rejected` |
| `Portal_Submitted` | ISO timestamp at creation |
| `PortalLastUpdateAt` | ISO timestamp at creation |
| `Birth_ID_Passport_File` | blank |
| `Latest_School_Report_File` | blank |
| `Passport_Photo_File` | blank |
| `Fee_Receipt_File` | blank |
| `Birth_ID_Status` | blank |
| `Report_Status` | blank |
| `Photo_Status` | blank |
| `Receipt_Status` | blank |
| `Docs_Verified` | blank |
| `Doc_Verification_Status` | `Rejected` |
| `Payment_Verified` | blank |
| `Overall_Status` | `Rejected` |
| `Email_Status` | `DO_NOT_CONTACT` |
| `Do_Not_Contact` | `Yes` |

Expected communication authority:

- Recommended: no recommended send action.
- Allowed: only appropriate manual communication if authority permits.
- Blocked: `docs_missing`, `payment_followup`, `application_receipt_request`, `application_verified_quote`, `application_acceptance_confirmation`
- Override: operational communications require exceptional Super Admin override where allowed.

## Mutation Preview

No mutation is approved in this CIS.

If approved in a future CIS, the proposed writes are:

- Target sheet: `FODE_Data`
- Target spreadsheet: staging spreadsheet ID `1YFgLtUExz__fzQ4zTNoIyGTu-nrnasS7dIaShNPl7Cs`
- Target rows: append one row per missing fixture, or update exact existing fixture rows found by read-only search.
- Target columns: the columns listed in Common Fixture Values plus each fixture-specific table above.
- Expected resulting env mapping: each `FODE_COMM_AUTHORITY_APPLICANT_*` points to the allocated `ApplicantID` for the matching `TEST_COMM_*` row.

Rows must be visibly non-operational through:

- `First_Name` prefix `TEST_COMM_`
- `Type` value `Regression Fixture`
- `Home_Address` marker `REGRESSION_FIXTURE_DO_NOT_PROCESS`
- `Reason_For_Transfer` marker `REGRESSION_FIXTURE_DO_NOT_PROCESS`

## Approval Gate

Operator approval is required before any write.

The approval must explicitly authorize:

- Staging `FODE_Data` fixture row creation/update.
- The exact six fixture names.
- Use of `sanjay@minervacenters.com`.
- No email send.
- No Drive folder/document creation unless separately approved.

## Playwright Environment Mapping

After approved creation and verification, set:

```powershell
$env:FODE_COMM_AUTHORITY_APPLICANT_A="<TEST_COMM_A ApplicantID>"
$env:FODE_COMM_AUTHORITY_APPLICANT_B="<TEST_COMM_B ApplicantID>"
$env:FODE_COMM_AUTHORITY_APPLICANT_C="<TEST_COMM_C ApplicantID>"
$env:FODE_COMM_AUTHORITY_APPLICANT_D="<TEST_COMM_D ApplicantID>"
$env:FODE_COMM_AUTHORITY_APPLICANT_E="<TEST_COMM_E ApplicantID>"
$env:FODE_COMM_AUTHORITY_APPLICANT_F="<TEST_COMM_F ApplicantID>"
```

Then run from the Playwright sandbox:

```powershell
Set-Location -LiteralPath "F:\Playwright\fode-secure-link-diagnostic"
npm run test:comm-authority-fixtures
```

## Recommendation

F4P.4 should implement an operator-approved bootstrap helper with:

- Read-only search mode.
- Dry-run mutation preview.
- Collision check for `ApplicantID`.
- Exact append/update plan.
- Explicit approval parameter required for writes.
- No email, no Drive, no Student, no Production, no OPS.

Do not create fixtures manually unless the operator accepts that manual rows can drift from the documented authority contract.
