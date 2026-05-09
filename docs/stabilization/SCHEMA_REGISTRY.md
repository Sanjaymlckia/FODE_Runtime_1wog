# S1 Schema Registry

Date: 2026-05-09
Scope: Working-sheet baseline for `CONFIG.DATA_SHEET = FODE_Data`
Method: Local source audit only. No sheet reads or mutations were performed.

## Registry Rules

- Header authority is split across `Config.js`, `SCHEMA`, `CONFIG.DOC_FIELDS`, `CONFIG.CAMPAIGN_COLUMNS`, and runtime header guards in `Admin.js` and `Code.js`
- Initial working-sheet order is partially payload-driven: `ensureHeaders_(sheet, payload)` creates headers as `Object.keys(payload)` followed by appended runtime metadata
- Because intake payload keys are not statically frozen in one file, the list below is the best documented column inventory from source, not a live spreadsheet dump

## Known Tabs

- `FODE_Data`: working admissions/runtime sheet
- `Webhook_Log`: runtime log sheet alias in `Config.js`
- `Submissions`: portal log sheet in the separate portal log spreadsheet
- `Exam_Sites`: exam site reference sheet
- `PortalSecrets`: portal secret store in the separate secrets spreadsheet

## Working-Sheet Column Inventory

### Identity / applicant core

| Column | Class | Notes |
| --- | --- | --- |
| `ApplicantID` | SYSTEM | Primary row identity |
| `First_Name` | RAW | Portal-visible |
| `Last_Name` | RAW | Portal-visible |
| `Gender` | RAW | Portal-visible |
| `Date_Of_Birth` | RAW | Portal-visible |
| `Grade_Applying_For` | RAW | Portal-visible |
| `Upgrade_Grade_Stream` | RAW | Portal-visible |
| `Country_Of_Birth` | RAW | Portal-visible |
| `Province_Of_Birth` | RAW | Portal-visible |
| `Citizenship` | RAW | Portal-visible |
| `Mother_Tongue` | RAW | Portal-visible |

### Family / contact / address

| Column | Class | Notes |
| --- | --- | --- |
| `Parent_Full_Name` | RAW | Portal-visible |
| `Relationship_To_Student` | RAW | Portal-visible |
| `Parent_Phone` | RAW | Portal-visible; reused by WhatsApp fallback |
| `Parent_Email` | RAW | Original intake email |
| `Parent_Email_Corrected` | DERIVED | Controlled correction path; must not overwrite `Parent_Email` |
| `Home_Address` | RAW | Portal-editable |
| `Travel_Mode` | RAW | Portal-editable but excluded in some portal edit modes |

### School / transfer / program

| Column | Class | Notes |
| --- | --- | --- |
| `Prev_School_Name` | RAW | Portal-editable |
| `Prev_School_Grade` | RAW | Portal-editable |
| `Reason_For_Transfer` | RAW | Portal-editable |
| `Siblings_Name_Grade` | RAW | Portal-editable |
| `Program` | RAW | Portal-visible |
| `Program_Applied_For` | RAW | Portal-visible |
| `Intake_Year` | RAW | Portal-visible |
| `Type` | RAW | Portal-visible |
| `Physical_Exam_Site` | RAW | Also appended as runtime metadata if missing |
| `Subjects_Selected_Canonical` | DERIVED | Canonicalized subjects field |

### Portal / storage / token state

| Column | Class | Notes |
| --- | --- | --- |
| `Folder_Url` | PORTAL | Drive folder reference |
| `File_Log` | PORTAL | Upload/log aggregation field |
| `PortalLastUpdateAt` | PORTAL | Last portal write timestamp |
| `Portal_Submitted` | PORTAL | Submission state |
| `PortalTokenHash` | PORTAL | Secret hash only; no plain secret in working sheet |
| `PortalTokenIssuedAt` | PORTAL | Token issuance timestamp |
| `Portal_Access_Status` | PORTAL | Open/locked state |

### Document files

| Column | Class | Notes |
| --- | --- | --- |
| `Birth_ID_Passport_File` | RAW | Required doc file |
| `Latest_School_Report_File` | RAW | Required doc file; multiple allowed |
| `Transfer_Certificate_File` | RAW | Optional doc file |
| `Passport_Photo_File` | RAW | Required doc file |
| `Fee_Receipt_File` | PAYMENT | Payment evidence file |

### Document verification status / comments

| Column | Class | Notes |
| --- | --- | --- |
| `Birth_ID_Status` | DERIVED | Doc review result |
| `Birth_ID_Comment` | DERIVED | Reviewer note |
| `Report_Status` | DERIVED | Doc review result |
| `Report_Comment` | DERIVED | Reviewer note |
| `Transfer_Status` | DERIVED | Doc review result |
| `Transfer_Comment` | DERIVED | Reviewer note |
| `Photo_Status` | DERIVED | Doc review result |
| `Photo_Comment` | DERIVED | Reviewer note |
| `Receipt_Status` | PAYMENT | Payment receipt verification result |
| `Receipt_Comment` | PAYMENT | Reviewer note for receipt |
| `Docs_Verified` | DERIVED | Compatibility rollup |
| `Doc_Verification_Status` | DERIVED | Computed/controlled workflow stage |
| `Doc_Last_Verified_At` | SYSTEM | Audit timestamp |
| `Doc_Last_Verified_By` | SYSTEM | Audit actor |
| `Verified_At` | LEGACY | Optional existing rollup in `SCHEMA` |
| `Verified_By` | LEGACY | Optional existing rollup in `SCHEMA` |

### Payment / communication / lifecycle

| Column | Class | Notes |
| --- | --- | --- |
| `Payment_Verified` | PAYMENT | Compatibility/boolean-style payment state |
| `Email_Status` | COMMUNICATION | Campaign/send state |
| `Email_Last_Sent_At` | COMMUNICATION | Last send timestamp |
| `Email_Attempt_Count` | COMMUNICATION | Attempt counter |
| `Email_Bounce_Flag` | COMMUNICATION | Bounce classification |
| `Email_Bounce_Reason` | COMMUNICATION | Last failure / bounce text |
| `Email_Next_Action_Date` | COMMUNICATION | Retry gating field |
| `Email_Campaign_Batch` | COMMUNICATION | Campaign batch marker |

### CRM / external handoff / finance

| Column | Class | Notes |
| --- | --- | --- |
| `Contact_ID` | CRM | Zoho CRM back-reference if sync was ever active |
| `Deal_ID` | CRM | Zoho CRM deal back-reference if sync was ever active |
| `CRM_Response` | CRM | Sync/debug response payload |
| `CRM_Invoice_Triggered` | CRM | Invoice-trigger marker used in automation logic |
| `CRM_Email` | CRM | Referenced in duplicate/index helper logic |
| `FormID` | SYSTEM | Stable external dedupe / handoff identity |
| `FD_FormID` | LEGACY | Alternate form id alias still handled |

## Contradictions And Ambiguities

- `ensureHeaders_(sheet, payload)` makes the leading column order dependent on incoming payload key order. Static source does not guarantee a single immutable full-sheet order.
- `Docs_Verified`, `Doc_Verification_Status`, and per-document status fields overlap. The source treats `Doc_Verification_Status` as the richer computed state, while `Docs_Verified` remains a compatibility flag.
- `Payment_Verified` and `Receipt_Status` both express payment state. The code often derives payment truth from `Receipt_Status` and then mirrors it back into `Payment_Verified`.
- `Portal_Access_Status` is explicit state, but lock behavior is also derived from payment/token conditions. This creates both stored and computed portal-state paths.
- `Verified_At` and `Verified_By` remain in `SCHEMA` as optional existing rollups, but `Doc_Last_Verified_At` and `Doc_Last_Verified_By` are the actively written audit fields.
- CRM fields are still present in source even though `ENABLE_FODE_CRM_PIPELINE = false`, so field presence does not imply live dependency.
