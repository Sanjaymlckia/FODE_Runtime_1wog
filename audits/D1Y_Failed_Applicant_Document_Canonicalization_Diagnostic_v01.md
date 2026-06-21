# D1Y Failed Applicant Document Canonicalization Diagnostic v01

Status: Read-only diagnostic
Track: L
Runtime release: No

## 1. Diagnostic Target

Selected applicant:

- ApplicantID: `FODE-26-003157`
- Name: `Jessica Wabianik`
- Submission / intake date: `2026-06-21`
- FD/Form identifier: `31951943`
- Correlation ID: `238943`

Reason selected:

- real applicant row exists
- `Folder_Url` exists
- all FD document fields are empty placeholders
- `File_Log` is empty
- applicant folder exists but is empty
- webhook log evidence is available

## 2. Applicant Row Findings

Working sheet:

- Spreadsheet: `1fHmeGNmpOj9PEPQ5Fp4tUyCP4UdH70lltukraD4SalU`
- Sheet: `FODE_Data`
- Row: `248`

Key row findings:

- `ApplicantID`: `FODE-26-003157`
- `Folder_Url`: `https://drive.google.com/drive/folders/1sctV3QNhi-Ih-p12GUIMRS7gplYjqa0A`
- `Birth_ID_Passport_File`: `[]`
- `Latest_School_Report_File`: `[]`
- `Transfer_Certificate_File`: `[]`
- `Passport_Photo_File`: `[]`
- `Fee_Receipt_File`: `[]`
- `File_Log`: empty

Interpretation:

- the row contains the expected document field names
- those fields did not receive usable raw file URLs
- there is no row-level evidence of successful canonical copy

## 3. CONFIG.DOC_FIELDS Comparison

Configured runtime document fields in `Config.js`:

- `Birth_ID_Passport_File`
- `Latest_School_Report_File`
- `Transfer_Certificate_File`
- `Passport_Photo_File`
- `Fee_Receipt_File`

Webhook `PAYLOAD KEYS` log for this applicant included:

- `Birth_ID_Passport_File`
- `Latest_School_Report_File`
- `Transfer_Certificate_File`
- `Passport_Photo_File`
- `Fee_Receipt_File`

Conclusion:

- this is **not** a payload-field-name mismatch
- the payload field names align with `CONFIG.DOC_FIELDS`
- the issue is with the values carried in those fields, not the field-name mapping

## 4. Canonicalization Trace Findings

Webhook log evidence for `FODE-26-003157` shows:

- `PAYLOAD KEYS` included all expected FD document fields
- `ACTIVATION_START` ran normally
- `ACTIVATION_FOLDER_PREPARED` succeeded
- `ACTIVATION_SUBMIT_STATE_DECISION` recorded:
  - `shouldStampSubmitState: false`
  - `qualifyingFieldsDetected: []`
- `ACTIVATION_ROW_COMMIT` succeeded
- `ACTIVATION_VERIFY` succeeded for row/folder/token presence
- `ACTIVATION_OK` completed

What is absent:

- no `ACTIVATION_FILE_CANONICALIZED`
- no `ACTIVATION_FILE_CANONICALIZE_SKIP`
- no `fetched_and_copied`
- no non-200 fetch trace for document URLs

Interpretation:

- canonicalization did not process any usable document URLs
- the runtime never reached per-file fetch/copy logging for this applicant
- this strongly indicates the document fields arrived empty or as empty placeholders before canonicalization

## 5. Applicant Folder Findings

Applicant folder:

- `https://drive.google.com/drive/folders/1sctV3QNhi-Ih-p12GUIMRS7gplYjqa0A`

Read-only folder listing result:

- folder exists
- file count observed: `0`

Interpretation:

- there are no canonical applicant-folder copies for this applicant
- this matches the empty row doc fields and empty `File_Log`

## 6. Enquiries Source-Folder Evidence

Known source folder:

- `https://drive.google.com/drive/folders/17caMv_3gGuuBzKWhlsMP7mY3nqXqqQvp`

Known source-side facts:

- folder is real and populated
- it remains in the `enquiries@kundu.ac` context
- operator ownership/access into Sanjay account is improved

Comparison result for this diagnostic:

- the source folder was previously listed read-only
- that listing showed no obvious `2026-06-21` upload cluster near the time of `FODE-26-003157`
- no applicant-specific source-side file could be safely proven for `Jessica Wabianik` from the current bounded evidence alone

Interpretation:

- source-folder presence is not ingestion proof
- for this applicant, current evidence does not show that the runtime was handed any source document URLs to copy

## 7. Failure Classification

Primary classification:

- `payload missing file URLs`

Secondary classification:

- `source folder contains files but webhook payload did not hand them to runtime` is plausible in general, but **not proven for this exact applicant**

Explicitly not supported by current evidence:

- field name mismatch with `CONFIG.DOC_FIELDS`
- raw URL fetch non-200
- canonical copy failure after fetch started
- copied file exists but row / `File_Log` / manifest mismatch

## 8. Most Likely Failure Path

For `FODE-26-003157`, the most likely live sequence was:

1. FormDesigner webhook payload reached `doPost`
2. payload included the correct FD document field names
3. those document fields contained empty placeholders (`[]`) rather than usable raw file URLs
4. `canonicalizeFdIntakeFiles_()` found no qualifying document URLs
5. no `UrlFetchApp.fetch(rawUrl)` calls were executed for docs
6. no canonical applicant-folder files were created
7. row committed successfully anyway with an empty document state

## 9. Recommended Fix Path

Immediate next diagnostic:

1. inspect the exact raw webhook payload/value shape upstream of normalization for one failed submission like this
2. confirm whether FormDesigner is now sending:
   - empty arrays
   - empty strings
   - placeholder values
   - or document references in a changed format not convertible to URL list

Recommended code-path focus after approval:

- payload value normalization for the five configured doc fields
- exact behavior of `normalizeToUrlList_(out[field], field)`
- whether the adapter or upstream webhook transform is zeroing file-field values before `canonicalizeFdIntakeFiles_()`

Recommended operational conclusion:

- do **not** build a source-folder scanner as the first fix
- investigate payload generation / forwarding / normalization first

Potential later hardening:

- add a diagnostic-only activation warning when doc field names are present but all values are empty placeholders
- add an admin-only audit/report function for applicants whose payload declared doc fields but yielded zero canonicalized files

## 10. Final Conclusion

For applicant `FODE-26-003157`, current evidence indicates:

- field names matched runtime expectations
- no raw document URLs were available to canonicalize
- applicant folder remained empty
- `File_Log` remained empty

This is a payload-value absence problem first, not a folder-scanner problem and not yet a fetch/copy failure problem.

## 11. Safety Confirmation

- no runtime files changed
- no `AdminUI.html` changes
- no `Config.js` changes
- no Apps Script version
- no deployment
- no repin
- no Sheet edits
- no Drive data mutation
- no sends
- no OPS changes
