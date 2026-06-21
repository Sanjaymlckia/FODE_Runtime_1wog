# D1 Document Preview Derivative Architecture Analysis v01

Status: architecture / analyst note only
Track: L
Runtime release: none
Deployment changes: none

## Scope

Analyze the proposed `original + derived preview` document model, but first identify the real current FormDesigner handoff path and any actually provable source/destination folders from repo/config/log evidence.

This note does not:

- change runtime code
- change Drive behavior
- change Sheets
- create Apps Script versions
- deploy or repin

## Executive Summary

### Proven now

The repo strongly proves the destination-side canonical document flow:

1. FormDesigner intake webhook reaches `doPost` in `Code.js`.
2. The runtime creates an applicant folder under a configured FODE Drive root.
3. For each uploaded document URL in the intake payload, the runtime fetches the remote file by URL.
4. The runtime creates a copied/canonical file in the applicant folder.
5. The applicant row stores `Folder_Url` plus canonical file URLs in the `*_File` fields.

### Not proven now

The repo does **not** by itself prove the full FormDesigner Drive-side folder identity, folder name, or parent path.

The current runtime appears to work from:

- raw file URLs contained in the webhook payload

not from:

- a configured FormDesigner source folder lookup

Therefore:

- **FormDesigner Google Drive integration is configured to use `enquiries@kundu.ac`.**
- **The configured FD upload folder/disk value shown in FormDesigner is `13ONHanc5GIDfuIlppm30FDfq1Wxe_55j`.**
- **This strongly supports the Kundu Enquiries account as the source-side upload context.**
- **Operator-confirmed live source folder URL is `https://drive.google.com/drive/folders/17caMv_3gGuuBzKWhlsMP7mY3nqXqqQvp`.**
- **The operator has taken ownership/access into the Sanjay account, while the folder remains in the enquiries Drive context.**
- **The `13ONHanc5GIDfuIlppm30FDfq1Wxe_55j` value is still not proven as the literal source folder ID; it may be a FormDesigner-side token/value rather than the actual Drive folder ID.**

### Architecture recommendation

The `original + derived preview` model is sound, but conversion should happen **after canonical copy into the applicant folder**, and preferably **as a separate async/backfill-capable step**, not inline with webhook intake.

## Files Inspected

- [Config.js](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Config.js)
- [Code.js](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Code.js)
- [Admin.js](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Admin.js)
- [Routes.js](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Routes.js)
- [Utils.js](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Utils.js)
- [docs/architecture/fode_drive_backed_document_review_architecture_v01.md](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\docs\architecture\fode_drive_backed_document_review_architecture_v01.md)
- [docs/stabilization/WORKFLOW_STATE_AUDIT.md](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\docs\stabilization\WORKFLOW_STATE_AUDIT.md)
- [docs/architecture/Data_Source_Authority_Register.md](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\docs\architecture\Data_Source_Authority_Register.md)

## 1. Actual Current Folder and Handoff Findings

### 1.0 Operator-provided FormDesigner settings proof

Operator-provided FormDesigner settings screen evidence shows:

- Integration page: `Setting of application Google Drive`
- E-mail to Google Drive: `enquiries@kundu.ac`
- Folder on the disk: `13ONHanc5GIDfuIlppm30FDfq1Wxe_55j`
- Enabled upload fields:
  - Birth Certificate / NID / Passport (Required)
  - Latest School Reports / Documents
  - Transfer Certificate (Required if transfer)
  - Passport Size Colour Photo (Optional)
  - Admission Fee Payment Receipt (Optional)

Additional operator confirmation now proves:

- live enquiries source folder URL: `https://drive.google.com/drive/folders/17caMv_3gGuuBzKWhlsMP7mY3nqXqqQvp`
- the folder remains in the `enquiries@kundu.ac` Drive context
- ownership/access has been taken into the Sanjay account
- read-only folder listing showed populated FD-style PDFs/images in that source folder

Interpretation:

- this is strong source-side evidence that FormDesigner Google Drive integration is attached to the `enquiries@kundu.ac` account context
- this strongly supports the Kundu Enquiries Google account as the likely source-side upload context
- this proves a real source-side enquiries Drive folder exists and is populated
- it is still not proven from repo/config alone whether `13ONHanc5GIDfuIlppm30FDfq1Wxe_55j` is:
  - a literal Google Drive folder ID
  - a FormDesigner internal disk token
  - or a generated folder/path value shown by FormDesigner

### 1.1 Where the runtime detects documents today

The FormDesigner intake path is in [Code.js](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Code.js):

- `doPost`
- `createApplicantFolder_`
- `canonicalizeFdIntakeFiles_`
- `buildActivatedIntakeRow_`

The key document handoff step is:

- `canonicalizeFdIntakeFiles_(payload, applicantFolder, ...)`

That function:

1. reads document-field URLs from the webhook payload
2. calls `UrlFetchApp.fetch(rawUrl, ...)`
3. gets the blob
4. creates a new file inside the applicant folder
5. rewrites the payload field to the new canonical Drive URL

This proves the current intake handoff is **URL-fetch-and-copy**, not source-folder lookup.

### 1.2 FormDesigner source folder detection/reference

No direct FormDesigner source-folder ID, folder-name constant, or parent-path constant was proven in:

- `Config.js`
- `Code.js`
- `Admin.js`
- `Routes.js`
- `Utils.js`

No code path was found that says, in effect:

- open FormDesigner upload folder by ID
- enumerate files from that folder
- move/copy from a configured FD source folder

Instead, the current runtime trusts raw uploaded file URLs carried in the intake payload.

Conclusion:

- repo/config does not contain a direct FD source-folder lookup path
- operator-provided settings now add strong source-side context:
  - Google Drive integration account: `enquiries@kundu.ac`
  - FormDesigner disk/folder value: `13ONHanc5GIDfuIlppm30FDfq1Wxe_55j`
  - live source folder URL: `17caMv_3gGuuBzKWhlsMP7mY3nqXqqQvp`
  - ownership/access now improved into the Sanjay account
- this strongly supports the Kundu Enquiries account as the source-side upload context
- it remains unproven whether `13ONHanc5GIDfuIlppm30FDfq1Wxe_55j` is an actual Drive folder ID versus a FormDesigner-side token/value

### 1.2A Corrected FD Flow Finding

The historical FODE FD document flow is not folder-scan-driven.

It is payload-URL-driven:

1. FormDesigner submits the webhook payload.
2. Configured document fields are read from that payload.
3. `canonicalizeFdIntakeFiles_()` processes those configured document fields.
4. Raw FD file URLs are fetched using `UrlFetchApp.fetch(rawUrl)`.
5. Canonical copies are created inside the applicant folder.
6. Canonical filenames are field-based.
7. `File_Log` records fetch/copy outcomes.
8. Runtime manifest is derived later from row/folder/Drive metadata.

Therefore:

- FD source folder = source evidence / fallback trace
- webhook payload fields = actual runtime input
- applicant folder canonical files = authority
- `File_Log` = decisive processing trace
- do not design a folder-scanner ingestion solution unless separately approved

### 1.3 Destination admissions folder ID/path

Destination root is explicitly configured in [Config.js](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Config.js):

- `ROOT_FOLDER_ID = 1vGD3DoOv1hlxYoTIfrNCZqAnrVKmghuB`
- `APPLICANT_ROOT_FOLDER_ID_PRIMARY = 1vGD3DoOv1hlxYoTIfrNCZqAnrVKmghuB`
- `SCRIPT_PROP_UPLOAD_ROOT_ID = FODE_UPLOAD_ROOT_ID`
- `APPLICANT_ROOT_YEAR_FOLDER_NAME = 2025`

Existing architecture evidence already identifies that root as:

- `Forms FODE`

Bounded local Drive-sync proof found:

- `E:\Gdrive\01_SANJAY\2026 Enrolments and Policies\Forms FODE`

### 1.4 Applicant subfolder naming/location convention

Current intake creation path in `createApplicantFolder_` uses:

- `slug(First_Name) + "_" + slug(Last_Name) + "_" + yyyy-mm-dd`

So the current intake convention is name/date based.

Example fixture local path proven:

- `E:\Gdrive\01_SANJAY\2026 Enrolments and Policies\Forms FODE\2025\keziah_waffi_2026-05-25`

There is also a second helper path:

- `buildApplicantFolderName_`

which can use `ApplicantID` when available in some fallback/rest flows.

Therefore current naming behavior is mixed:

- primary intake path: `first_last_date`
- some fallback/recovery paths: `ApplicantID`

### 1.5 Actual fixture destination evidence

Fixture folder proven locally:

- folder name: `keziah_waffi_2026-05-25`
- folder ID from existing tests/docs: `11Uyp813DuF39yk5-dQj3JzCh1Q8frhGg`
- local synced path:
  - `E:\Gdrive\01_SANJAY\2026 Enrolments and Policies\Forms FODE\2025\keziah_waffi_2026-05-25`

Files present:

- `Birth_ID_Passport_File_20260526_084724_396.pdf`
- `Latest_School_Report_File_20260526_084727_744.pdf`
- `Latest_School_Report_File_20260526_084730_843.pdf`
- `Latest_School_Report_File_20260526_084733_562.pdf`
- `Passport_Photo_File_20260526_084736_611.jpg`

This is strong destination-side proof for the canonical applicant folder structure.

### 1.6 Copy / move / rename / link behavior

Current verified behavior:

- intake canonicalization:
  - fetches remote URL
  - creates a new file in applicant folder
  - renames that new file to canonical field-based naming
- portal upload path:
  - creates files directly in applicant folder
- portal delete path:
  - may trash files in applicant folder if folder lineage is proven

What is proven:

- **copy/create** into applicant folders
- **rename** into canonical field-based filenames

What is not proven:

- move from a known FD source folder
- cleanup or deletion of FD source files/folders

### 1.7 Are originals preserved today?

For FormDesigner intake:

- current runtime copies fetched source content into the applicant folder
- current runtime does **not** show deletion of the source raw URL artifact

Therefore the repo supports this conclusion:

- the canonical applicant-folder file is a copied original in FODE storage
- the source artifact is not actively deleted by the FODE runtime during handoff

But this is still limited:

- the repo does **not** prove whether FormDesigner or another external automation later cleans up its own upload area

For portal uploads:

- the created file in the applicant folder is the only FODE-managed original

### 1.8 Does any manifest already record source file ID / copied file ID / mime / URL?

Current state:

- row `*_File` fields store canonical Drive URLs
- `File_Log` stores text traces such as:
  - raw URL
  - copied file ID
  - folder ID
- `admin_getApplicantDocumentManifest()` derives a runtime manifest from:
  - `Folder_Url`
  - folder listing
  - Drive metadata
  - row file IDs extracted from stored URLs

What exists:

- derived runtime manifest with:
  - `fileId`
  - `fileName`
  - `mimeType`
  - `sizeBytes`
  - timestamps
  - `sourceField`
  - `itemIndex`
  - `previewEligible`
  - secure `openUrl` / `downloadUrl`
  - image-only `previewUrl`

What does **not** exist as a durable stored schema today:

- `sourceFolderId`
- `sourceFolderName`
- `sourceOriginalFileId`
- persistent copied-file manifest row
- preview derivative manifest

### 1.9 Are FD root/source folders cleaned up?

Not proven.

No current repo/config evidence shows:

- explicit deletion of FormDesigner source folders
- explicit trashing of FormDesigner source files after handoff
- retention policy for the FD source location

Current safest conclusion:

- **FD source-folder cleanup/retention is not proven from repo/config.**

### 1.10 Missing Document Diagnostic Implication

If FD documents exist in the enquiries source folder but are missing from the applicant folder or manifest, the correct diagnostic is not to scan the enquiries folder as runtime authority.

The correct per-applicant diagnostic is:

- inspect `Folder_Url`
- inspect document `*_File` fields
- inspect `File_Log`
- inspect webhook payload/log evidence
- inspect `ACTIVATION_FILE_CANONICALIZE_SKIP`
- inspect `ACTIVATION_FILE_CANONICALIZED`
- inspect configured `CONFIG.DOC_FIELDS`
- determine whether `UrlFetchApp.fetch(rawUrl)` returned non-200 or the file was skipped

Likely failure classes:

- payload missing file URLs
- payload field names mismatched to `CONFIG.DOC_FIELDS`
- raw URL fetch non-200
- canonical copy failure
- row / `File_Log` / manifest mismatch

## 2. Folder Proof Boundary and Missing Evidence

### Proven from repo/config/local destination proof

- FODE destination root folder ID
- destination root name `Forms FODE`
- year-folder convention `2025`
- applicant-folder destination convention
- fixture applicant folder path and files
- canonical copy/create behavior into applicant folders

### Not proven from repo/config

- whether `13ONHanc5GIDfuIlppm30FDfq1Wxe_55j` resolves to a real Google Drive folder ID
- exact relationship between the FormDesigner disk/token value and the live source folder `17caMv_3gGuuBzKWhlsMP7mY3nqXqqQvp`
- FormDesigner source folder parent/root path
- final owner/permissions model of the source-side folder across enquiries and Sanjay contexts
- whether the source folder lives under:
  - Sanjay sync
  - Kundu Enquiries Drive root
  - Shared with me
  - app-created hidden area

### Required secondary trace

- **Likely secondary trace: Kundu Enquiries Google Drive root/account.**

Required proof from operator/Drive inspection:

1. confirm whether `13ONHanc5GIDfuIlppm30FDfq1Wxe_55j` maps to the live source folder or is only a FormDesigner token/value
2. account/user that owns the FormDesigner upload folder
3. parent/root location
4. whether the FODE Apps Script account can read/copy from the raw payload URLs it receives
7. whether it appears in:
   - Drive root
   - Shared with me
   - app-created folder area

Safest confirmation method:

- Drive connector/manual Drive inspection on the owning Google account
- or direct FormDesigner configuration/admin-screen evidence

## 3. Architecture Fit: Original + Derived Preview Model

The proposed model fits the proven current flow.

Best insertion point:

- **after canonical copy into the applicant folder**

Why:

- by that point FODE has established its own authoritative original
- destination path is known and controlled
- preview derivatives can be treated as read-only secondary artifacts
- source-location ambiguity becomes less important once original copy is canonicalized

Recommended conversion timing:

1. do not block intake webhook on rasterization
2. store canonical original first
3. set preview status to pending
4. generate derivatives in a separate async or backfill-capable step

This is safer than inline conversion during webhook intake because:

- it reduces webhook latency
- it isolates conversion failures from admissions-row creation
- it allows preview regeneration later without re-running intake

## 4. Original Record Preservation

Strong recommendation:

- original PDFs/images must always be preserved

Rules:

- original PDF = authoritative evidence
- preview image derivatives = review-only artifacts
- derivatives must never replace the original

Recommended naming:

- originals:
  - keep current canonical field-based naming
- previews:
  - append deterministic page/derivative suffixes
  - example:
    - `Birth_ID_Passport_File_20260526_084724_396__preview_p01.png`

Recommended storage model:

- `originals/` optional later if folder restructuring is approved
- `previews/` optional later if folder restructuring is approved

For initial rollout, avoid broad folder restructuring.

Safer first model:

- keep originals where they are
- place derivatives in a tightly controlled sibling preview location only after dry run

## 5. Preview Format Recommendation

### Recommended first implementation

- all-page preview images for PDFs
- cap total generated pages
- one review-size image per page
- no PDF iframe as primary gallery path

Recommended first format:

- **PNG** for first implementation if readability is the main goal

Why:

- IDs, school reports, and receipts are document/text-heavy
- text readability matters more than photo compression
- JPEG risks visible text degradation

What not to do first:

- WebP-first implementation
  - workable later, but adds more compatibility/testing surface
- first-page-thumbnail-only as the only derivative
  - insufficient for multi-page review workflows

Practical compromise:

- generate full-page PNG previews for a bounded page count
- optional small first-page thumbnail later from the same derivative pipeline

## 6. Conversion Feasibility

Repo inspection found no existing PDF rasterization pipeline.

Current code supports:

- image preview for true `image/*`
- secure open/download for originals

Current code does **not** prove:

- native PDF-to-image conversion already exists

Assessment:

- reliable PDF rasterization inside plain Apps Script is not proven in this repo
- Drive thumbnail behavior alone is not sufficient as the primary review strategy
- a true PDF-to-image derivative pipeline may require:
  - external service
  - advanced Google-side conversion mechanism not yet present
  - or a carefully scoped spike

Recommendation:

- treat conversion feasibility as a dedicated spike before any production mutation plan

Fallback if rasterization is not yet practical:

- keep PDF original as Download/Open
- support image derivatives only when conversion pipeline is proven

## 7. Gallery Impact

This architecture is good for future gallery design because:

- gallery can consume image derivatives instead of trying to embed PDFs
- original PDF remains available as fallback
- page count can be shown in manifest
- preview generation failure can degrade gracefully to:
  - Open Original
  - Download Original

Important boundary:

- this reduces future gallery complexity
- it does **not** remove the need for `E2.1C` AdminUI hydration diagnostics before new UI releases

## 8. Storage / Performance / Quota Risks

Main risks:

- Drive storage growth
- multipage PDF explosion
- conversion time
- Apps Script execution limits
- repeated conversion of same original
- duplicate preview generation
- backfill load on historical folders

Recommended controls:

- page-count cap
- file-size cap
- explicit `previewStatus`
- skip already converted files
- deterministic regeneration rule
- separate dry-run audit before broad backfill

## 9. Backfill Strategy

Recommended first posture:

- no full backfill initially

Safer order:

1. dry-run manifest audit on active applicants only
2. sample conversion spike on a few PDFs
3. active-applicant backfill only if needed
4. broader backfill later

This avoids:

- large Drive churn
- quota surprises
- accidental duplicate preview trees

## 10. Recommended Manifest Fields

Recommended future manifest extension:

- `documentType`
- `sourceField`
- `originalFileId`
- `originalFileName`
- `originalMimeType`
- `originalUrl`
- `originalFolderId`
- `previewStatus`
  - `not_required`
  - `pending`
  - `ready`
  - `failed`
- `previewFiles`
  - `pageNumber`
  - `previewFileId`
  - `previewMimeType`
  - `previewUrl`
  - `width`
  - `height`
- `previewPageCount`
- `previewGeneratedAt`
- `conversionError`
- `galleryReady`
- `fallbackToOriginal`

Important rule:

- preview metadata should be derived and stored as preview-state metadata
- original record must remain the authority

## 11. Recommended Sequencing

Recommended sequence:

1. `D1`
   - architecture note only
2. `D1A`
   - real folder/source-path proof and manifest audit
3. `D1B`
   - PDF conversion feasibility spike on sample PDFs only
4. `D1C`
   - manifest/schema extension with no-op preview fields
5. `D1D`
   - new-upload pipeline for preview generation after FD handoff
6. `D1E`
   - backfill dry run for existing applicant PDFs
7. `D1F`
   - Admin gallery reads preview manifest when available, else original fallback
8. `D1G`
   - optional advisory quality/precheck later

## 12. What Must Not Happen

Do not:

- release new AdminUI gallery work before `E2.1C` hydration diagnostic
- delete or replace original PDFs
- assume a FormDesigner source folder without proof
- restructure Drive folders broadly without dry run
- mutate production Drive data before proof
- revive OPS

## Conclusion

### Actual folder/path conclusion

Proven:

- destination FODE admissions root and applicant folder path
- current URL-fetch-and-copy handoff into canonical applicant folders

Not proven:

- actual FormDesigner source folder ID/path/account

Required explicit statement:

- **FormDesigner Google Drive integration is configured to use `enquiries@kundu.ac`.**
- **The configured FD upload folder/disk value shown in FormDesigner is `13ONHanc5GIDfuIlppm30FDfq1Wxe_55j`.**
- **The live enquiries source folder URL is `17caMv_3gGuuBzKWhlsMP7mY3nqXqqQvp`, and operator ownership/access has been taken into the Sanjay account while the folder remains in enquiries context.**
- **The current runtime is payload-URL-driven, not folder-scan-driven.**
- **The `13ONHanc5GIDfuIlppm30FDfq1Wxe_55j` value is still not proven as the literal source folder ID.**

### Architecture conclusion

The `original + derived preview` model is a good fit, but only if:

- canonical original copy remains authoritative
- conversion happens after handoff, not before
- conversion is validated separately before rollout
- UI rollout remains blocked on AdminUI hydration diagnostics

## 7. Recommended Next Steps

1. Commit D1/D1X docs checkpoint.
2. Run a narrow failed-applicant document canonicalization diagnostic using one real applicant where FD docs are expected but missing from the applicant folder/manifest.
3. Determine whether the failure class is:
   - payload missing file URLs
   - payload field names mismatched to `CONFIG.DOC_FIELDS`
   - raw URL fetch non-200
   - canonical copy failure
   - row / `File_Log` / manifest mismatch
4. Then proceed to backend-only preview manifest sidecar proof.
5. Keep AdminUI gallery and communication UI paused until `E2.1C` hydration isolation/validator exists.

## Safety Confirmation

- no runtime files changed
- no Apps Script version created
- no deployment or repin performed
- no commit or push performed
- no Sheet edits
- no Drive data edits
- no sends
- OPS remains frozen
