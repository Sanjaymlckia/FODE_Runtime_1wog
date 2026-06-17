# Data Source Authority Register

Status: r23C prerequisite register
Scope: documentation/audit only

This register prevents confusion between production, staging, cleaned, historical, diagnostic, log, and secret sheets before any read-only r23C Operator Actionability Discovery continues.

No runtime code, Apps Script source, Sheet data, deployment, version, repin, commit, tag, send, or deletion is changed by this document.

## Mandatory Warning

`Config.js` alone is not sufficient to prove production data authority.

Before drawing a production or operational conclusion from a Sheet, confirm:

- spreadsheet ID
- live title
- tab name
- environment
- purpose of read
- required headers
- whether the source is production/live, staging/cleaned, historical, diagnostic, log-only, or secrets-only

Runtime `whoami` remains deployment truth. Sheet metadata remains data-source proof. Local source constants alone are not enough.

## Source Discovery Basis

Sources were identified from:

- `Config.js`
- code references to configured sheets
- existing architecture/stabilization docs
- read-only Google Sheets metadata
- bounded read-only header checks

Script Properties values were not read. Code references show Script Properties are used for runtime state such as portal secrets, docs follow-up keys, stage cursors, and telemetry, but Script Properties are not a spreadsheet data authority for r23C row backtesting unless a separate read-only runtime diagnostic is approved.

## Data Source Register

| Source | Spreadsheet ID | Live Title | Tabs Observed | Environment | Authority Level | Allowed Uses | Forbidden Uses | Known Limitations | Communication-History Fields |
|---|---|---|---|---|---|---|---|---|---|
| Production admissions/runtime sheet | `1fHmeGNmpOj9PEPQ5Fp4tUyCP4UdH70lltukraD4SalU` | `FODE_Applications_2026` | `FODE_Data`, `Initial_to_28_May_2026_data`, `Webhook_Log`, `Exam_Sites` | production/live operational | High, if runtime/deployment context confirms production use | Production/live operational analysis with explicit approval; row-level actionability discovery; communication-history backtest from `FODE_Data` only | Staging validation; destructive edits; schema assumptions without header proof; using historical tab as live truth | `Initial_to_28_May_2026_data` header read returned no values in checked range; `Webhook_Log` is minimal event log; production conclusions require explicit source preflight | Present in `FODE_Data`: `Email_Status`, `Email_Last_Sent_At`, `Email_Attempt_Count`, `Email_Bounce_Flag`, `Email_Next_Action_Date`, `Email_Bounce_Reason`, `Last_Contact_Batch`, `Last_Contact_DebugId`, `Last_Contacted_At`, `Last_Contact_Type`, `Last_Contact_By`, `Last_Contact_Subject`, `Last_Contact_Result`, `Ack_Email_Status`, `Ack_Email_Sent_At`, `Last_Email_To`, `Last_Email_Error` |
| Staging cleaned admissions/runtime sheet | `1YFgLtUExz__fzQ4zTNoIyGTu-nrnasS7dIaShNPl7Cs` | `FODE_Clean_Staged_2026` | `FODE_Data`, `Exam_Sites`, `Webhook_Log` | staging / cleaned | Medium for staging behavior; not production authority | Staging runtime verification; safe diagnostics; non-production UI/queue checks | Production workload percentage; production communication-cadence backtest; final operational conclusions | `FODE_Data` row count differs from production; checked header row did not expose durable communication-history columns; cleaned state may not match live production | Not present in checked `FODE_Data` header row through `Quote_Sent_At`; communication reconstruction is not reliable from this source |
| Production main `Webhook_Log` tab | `1fHmeGNmpOj9PEPQ5Fp4tUyCP4UdH70lltukraD4SalU` | `FODE_Applications_2026` | `Webhook_Log` | production log tab | Low for actionability; event-log support only | Confirm limited webhook/event activity shape | Applicant actionability authority; communication cadence authority; row truth | Header only: `ts`, `applicant_folder`, `first_name`, `last_name`, `raw_keys`; no ApplicantID-centered communication history | No reliable communication-history fields |
| Staging main `Webhook_Log` tab | `1YFgLtUExz__fzQ4zTNoIyGTu-nrnasS7dIaShNPl7Cs` | `FODE_Clean_Staged_2026` | `Webhook_Log` | staging log tab | Low for actionability; event-log support only | Staging event-log inspection | Production conclusions; communication cadence authority | Header only: `ts`, `applicant_folder`, `first_name`, `last_name`, `raw_keys` | No reliable communication-history fields |
| Portal log spreadsheet | `1AQbkHUafLFxqHDqwH3dVHR8gTuOZYtyUPkheby5ejhU` | `FODE Portal Log 2026` | `Portal_Log` | portal log / diagnostic | Medium for portal route events; low for actionability | Portal route/status troubleshooting; confirming portal log event shape | Applicant workload authority; communication cadence authority; lifecycle/payment/document truth | `Config.js` says `LOG_SHEET_NAME: "Submissions"`, but live metadata shows `Portal_Log`; this mismatch must be resolved before relying on config constants | Header: `Timestamp`, `Version`, `Route`, `ApplicantID`, `Email`, `Status`, `Message`; not enough for full communication history |
| Portal secrets spreadsheet | `1HEJPtSov-iE5YTpSWWZ89YLIQAw4Eju9DDMG46HkTRc` | `FODE Portal Secrets 2026` | `PortalSecrets` | portal secret store | High for portal token/secret authority; not workload authority | Metadata/header verification only unless a security-specific CIS approves more | r23C actionability sampling; communication backtest; broad row reads; exposing secrets | Contains sensitive portal secret material; do not use as actionability data source | No communication-history fields; header includes `ApplicantID`, `Email`, `Full_Name`, `Secret_Plain`, `Secret_Hash`, `Created_At`, `Last_Rotated_At`, `Status` |
| Historical production intake tab | `1fHmeGNmpOj9PEPQ5Fp4tUyCP4UdH70lltukraD4SalU` | `FODE_Applications_2026` | `Initial_to_28_May_2026_data` | historical / migrated | Low for current actionability; possible historical reference | Historical baseline comparison only after header proof | Today's workload calculations; live actionability conclusions | Header read `A1:KF1` returned no values; must not be used until tab structure is proven | Unknown |
| Exam site reference tab | production/staging main sheet IDs | `FODE_Applications_2026` / `FODE_Clean_Staged_2026` | `Exam_Sites` | reference/config data | Low for actionability | Exam-site lookup/reference validation | Workload/actionability/communication conclusions | Not applicant row authority | No |
| Legacy/fallback `CONFIG.SHEET_ID` | `1fHmeGNmpOj9PEPQ5Fp4tUyCP4UdH70lltukraD4Salu` | Not verified | Not verified | unknown / legacy fallback | None until verified | None for r23C | Any production, staging, or communication conclusion | Differs from production ID casing at the end; Google IDs are case-sensitive; treat as untrusted until metadata verifies | Unknown |

## Required Production Sheet Preflight

Use this checklist before any r23C row-level read or backtest.

| Check | Required Value / Evidence |
|---|---|
| Spreadsheet ID | Exact ID copied into the read request |
| Title | Live metadata title, not inferred from local source |
| Tab | Exact live tab name |
| Environment | production / staging / cleaned / historical / diagnostic / unknown |
| Purpose of read | e.g. actionability discovery, header check, communication-history validation |
| Allowed conclusion type | e.g. production workload, staging behavior only, log-shape only |
| Required columns present | All required headers observed before row sampling |
| Read range bounded | Yes; no whole-grid scans |
| Mutation risk | Confirm read-only connector action only |
| Sensitive data exposure | Confirm no secrets or raw document URLs are requested unless explicitly approved |

## Required Columns For r23C Production Backtest

Minimum production actionability read columns:

- `ApplicantID`
- `First_Name`
- `Last_Name`
- `Parent_Email`
- `Parent_Email_Corrected`
- `Portal_Submitted`
- `PortalLastUpdateAt`
- `Birth_ID_Passport_File`
- `Latest_School_Report_File`
- `Passport_Photo_File`
- `Fee_Receipt_File`
- `Docs_Verified`
- `Doc_Verification_Status`
- `Payment_Verified`
- `Receipt_Status`
- `Email_Status`
- `Email_Last_Sent_At`
- `Email_Bounce_Flag`
- `Email_Next_Action_Date`
- `Email_Bounce_Reason`
- `Last_Contacted_At`
- `Last_Contact_Type`
- `Last_Contact_Result`
- `Last_Contact_Subject`
- `Ack_Email_Status`
- `Ack_Email_Sent_At`

If any required communication-history columns are absent, r23C may only produce a partial non-communication actionability analysis unless separately approved.

## r23C Source Decision

For r23C Operator Actionability Discovery:

- Use production `FODE_Applications_2026` / `FODE_Data` only if the operator explicitly approves production read-only analysis.
- Do not use staging `FODE_Clean_Staged_2026` for production workload percentages.
- Do not use `Webhook_Log` tabs as communication-history authority.
- Do not use `PortalSecrets` for actionability discovery.
- Do not use `Initial_to_28_May_2026_data` until its structure is proven.

## Stop Condition Status

Production/live operational sheet can be identified safely:

- Spreadsheet: `FODE_Applications_2026`
- Spreadsheet ID: `1fHmeGNmpOj9PEPQ5Fp4tUyCP4UdH70lltukraD4SalU`
- Candidate live tab: `FODE_Data`
- Communication-history headers: present in `FODE_Data`

r23C row-level backtest remains stopped until the operator approves read-only production analysis using this source.
