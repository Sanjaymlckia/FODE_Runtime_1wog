# D1Y FormDesigner Attachment Pipeline Date-Break Diagnostic v01

Status: Read-only diagnostic
Track: L
Runtime release: No

## 1. Objective

Determine whether FormDesigner file uploads stopped flowing into FODE around `2026-06-14`.

This diagnostic is read-only and does not modify runtime code, Sheets, Drive data, deployments, or OPS.

## 2. Working Hypothesis

Current hypothesis was:

- FormDesigner submissions may still be reaching FODE
- but file uploads / file URLs may have stopped being included in webhook payloads after around `2026-06-14`

## 3. Sample Window

Bounded sample reviewed:

- before / boundary sample size: `4`
- after-break sample size: `6`

Sample selection:

- pre-break rows with proven canonicalization and non-empty applicant folders
- boundary row on `2026-06-14`
- post-break rows on `2026-06-14` daytime and `2026-06-18` to `2026-06-21`

## 4. Sample Table

| ApplicantID | Name | Date | Birth_ID_Passport_File | Latest_School_Report_File | Transfer_Certificate_File | Passport_Photo_File | Fee_Receipt_File | Folder file count | File_Log state | Classification |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `FODE-26-002959` | Keziah Waffi | `2026-05-25 / 2026-05-26` | real URL | 3 real URLs | `[]` | real URL | `[]` | `5` | multiple `fetched_and_copied` lines | pre-break canonicalization healthy |
| `FODE-26-002967` | Emmanuel Yawiapui | `2026-05-26` | real URL | real URL | real URL | real URL | `[]` | `4` | multiple `fetched_and_copied` lines | pre-break canonicalization healthy |
| `FODE-26-002985` | Jackson Numa | `2026-05-27` | real URL | real URL | real URL | real URL | real URL | `5` | multiple `fetched_and_copied` lines | pre-break canonicalization healthy |
| `FODE-26-003111` | Sira Noyu | `2026-06-14` | real URL | `[]` | `[]` | `[]` | `[]` | `1` | one `fetched_and_copied` line | boundary row still receiving raw file URL(s) |
| `FODE-26-003112` | Degari Muraise | `2026-06-14` | `[]` | `[]` | `[]` | `[]` | `[]` | `0` | empty | post-break empty payload doc fields |
| `FODE-26-003113` | Graham Ekiawa | `2026-06-14` | `[]` | `[]` | `[]` | `[]` | `[]` | `0` | empty | post-break empty payload doc fields |
| `FODE-26-003114` | Martin Samuel | `2026-06-14` | `[]` | `[]` | `[]` | `[]` | `[]` | not folder-listed in this pass | empty | post-break empty payload doc fields |
| `FODE-26-003154` | Cletus Tuke | `2026-06-20` | `[]` | `[]` | `[]` | `[]` | `[]` | `0` | empty | post-break empty payload doc fields |
| `FODE-26-003156` | Junior Ikup | `2026-06-20` | `[]` | `[]` | `[]` | `[]` | `[]` | `0` | empty | post-break empty payload doc fields |
| `FODE-26-003157` | Jessica Wabianik | `2026-06-21` | `[]` | `[]` | `[]` | `[]` | `[]` | `0` | empty | post-break empty payload doc fields |

## 5. What Changed Around 14 June

### 5.1 Before / boundary behavior

Before the break, sampled rows show:

- real Drive URLs stored in row doc fields
- applicant folders populated with canonical files
- `File_Log` populated with `fetched_and_copied`
- successful canonicalization from FormDesigner raw URLs

Boundary evidence:

- `FODE-26-003111` on `2026-06-14` still shows one successful canonicalized file
- `File_Log` includes:
  - `Birth_ID_Passport_File | fetched_and_copied`
- applicant folder contains `1` file

### 5.2 After-break behavior

Immediately after that boundary row, sampled rows show:

- all five document fields stored as `[]`
- applicant folders created but empty
- `File_Log` empty
- no row evidence of any canonicalization attempt

This pattern persists through at least:

- `2026-06-14`
- `2026-06-18`
- `2026-06-19`
- `2026-06-20`
- `2026-06-21`

## 6. Webhook / Canonicalization Trace Findings

For the failed post-break example `FODE-26-003157`:

- webhook `PAYLOAD KEYS` included all expected FD document field names
- field names still matched `CONFIG.DOC_FIELDS`
- `ACTIVATION_FOLDER_PREPARED` succeeded
- `ACTIVATION_SUBMIT_STATE_DECISION` logged:
  - `shouldStampSubmitState: false`
  - `qualifyingFieldsDetected: []`
- `ACTIVATION_ROW_COMMIT` succeeded
- `ACTIVATION_OK` succeeded

Absent for this applicant:

- `ACTIVATION_FILE_CANONICALIZED`
- `ACTIVATION_FILE_CANONICALIZE_SKIP`
- `fetched_and_copied`
- non-200 fetch trace

Interpretation:

- the runtime did not receive usable raw file URLs to process
- this is happening before `UrlFetchApp.fetch(rawUrl)` can even become relevant

## 7. Source Folder Evidence

Source folder:

- `https://drive.google.com/drive/folders/17caMv_3gGuuBzKWhlsMP7mY3nqXqqQvp`

Read-only evidence from previous inspection:

- folder is real and populated
- latest visible file in listing was created at `2026-06-13T14:59:53Z`
  - which aligns with operator-observed `2026-06-14 12:59:51 AM` local evidence
- no later visible uploads were observed in the bounded listing

Interpretation:

- the operator’s “around 14 June” break observation is supported
- this supports an upstream FD upload/storage/payload change, not a new FODE folder-copy regression

## 8. Josephine / Josie Contactability Finding

Identifiable row:

- `FODE-26-003157` / Jessica Wabianik
- row email: `josiewabby27@gmail.com`

Operator-provided evidence:

- Gmail bounce: `550 5.1.1 NoSuchUser`

Classification:

- separate contactability issue
- `NO_EFFECTIVE_EMAIL / invalid email`

Important separation:

- email bounce does **not** explain the missing document canonicalization
- document failure and contactability failure should be treated as separate problems

## 9. Failure Classification

Supported by current evidence:

- `FD attachment upload stopped after 14 June`
- `FD webhook payload now sends empty arrays for upload fields`
- `FD upload module/storage/Google Drive integration issue`
- `contactability issue separate from documents`

Not supported as primary cause:

- `FODE canonicalization issue`

Reason:

- FODE canonicalization worked before the break
- post-break rows show no usable file URLs to canonicalize

## 10. Recommended Next Operational Fix

Immediate next step:

1. Inspect upstream FormDesigner attachment behavior around `2026-06-14`.
2. Confirm whether FormDesigner:
   - stopped receiving uploads
   - stopped storing uploads
   - stopped including upload URLs in webhook payloads
   - or changed the value shape from URL strings to empty arrays/placeholders

Recommended FODE-side follow-up after approval:

- add a diagnostic-only warning when:
  - payload contains expected doc field names
  - but all doc field values normalize to empty arrays/placeholders
- optionally add an admin-only audit/report function for zero-canonicalization intakes

Not recommended as first fix:

- building a source-folder scanner

## 11. Conclusion

A date breakpoint around `2026-06-14` is supported.

Observed transition:

- up to the boundary row, FODE still received and canonicalized real file URLs
- immediately after, rows consistently show `[]` document field values, empty applicant folders, and empty `File_Log`

Most likely cause class:

- upstream FormDesigner attachment pipeline / payload generation failure

Not most likely:

- downstream FODE canonicalization failure

## 12. Safety Confirmation

- no runtime code changes
- no `AdminUI.html` changes
- no `Config.js` changes
- no Sheet edits
- no Drive data mutation
- no deployment
- no repin
- no Apps Script version
- no sends
- no OPS changes
