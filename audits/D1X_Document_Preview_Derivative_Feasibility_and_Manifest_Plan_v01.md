# D1X Document Preview Derivative Feasibility and Manifest Plan v01

Status: Discovery / design only
Track: L
Runtime release: No
Files changed in this slice: this note only

## 1. Objective

Combine the D1 source-path, manifest, and derivative-preview questions into one safe planning note.

This slice does not change runtime behavior, AdminUI, Apps Script versions, deployments, Sheets, or Drive data.

## 2. Current Proven Baseline

### 2.1 Destination-side FODE storage

- Applicant destination root is configured in `Config.js` as `1vGD3DoOv1hlxYoTIfrNCZqAnrVKmghuB`.
- Root name is known as `Forms FODE`.
- Local synced destination path is:
  `E:\Gdrive\01_SANJAY\2026 Enrolments and Policies\Forms FODE`

### 2.2 Current intake/canonicalization path

Repo evidence confirms the current intake path is:

- `Code.js`
- `doPost`
- `createApplicantFolder_()`
- `canonicalizeFdIntakeFiles_()`

Current behavior:

- raw FormDesigner file URLs are received in the webhook payload
- `canonicalizeFdIntakeFiles_()` fetches those raw URLs with `UrlFetchApp.fetch(...)`
- blobs are copied into the applicant folder
- copied files are renamed to canonical field-based names
- applicant row stores canonical file URLs
- `Folder_Url` stores the applicant folder URL
- `File_Log` records the copy/update trail

This means the applicant folder copy is already the correct canonical evidence boundary.

### 2.3 Current manifest behavior

Repo evidence confirms `Admin.js` already derives a read-only manifest via:

- `admin_getApplicantDocumentManifest(payload)`

Current manifest can already derive:

- folder and file listing from `Folder_Url`
- row-to-file mapping by row file IDs
- MIME/type evidence
- `previewEligible`
- `thumbnailAvailable`
- image-only signed `previewUrl`
- signed `openUrl`
- signed `downloadUrl`

What does **not** exist yet:

- durable preview derivative files
- durable preview status fields
- durable preview page metadata
- retry/error state for derivative generation

## 3. FormDesigner Source-Folder Finding

### 3.1 Operator-provided FormDesigner settings proof

- FormDesigner Google Drive integration account: `enquiries@kundu.ac`
- FormDesigner disk/folder value: `13ONHanc5GIDfuIlppm30FDfq1Wxe_55j`
- Live enquiries source folder URL: `https://drive.google.com/drive/folders/17caMv_3gGuuBzKWhlsMP7mY3nqXqqQvp`
- Operator has taken ownership/access into the Sanjay account while the folder remains in the enquiries Drive context
- Enabled upload fields:
  - Birth Certificate / NID / Passport
  - Latest School Reports / Documents
  - Transfer Certificate
  - Passport Size Colour Photo
  - Admission Fee Payment Receipt

### 3.2 Drive-resolution result

Read-only Drive metadata lookup was attempted for:

- `13ONHanc5GIDfuIlppm30FDfq1Wxe_55j`

Result:

- current connected Drive context returned `404 notFound`
- therefore this value is **not proven** as an accessible Drive file/folder ID in the currently connected account context
- current connected Drive context can list the live enquiries source folder `17caMv_3gGuuBzKWhlsMP7mY3nqXqqQvp` and its FD-style PDFs/images

Interpretation:

- this strongly supports `enquiries@kundu.ac` as the source-side upload context
- this proves a real source-side enquiries Drive folder exists and is populated
- it does **not** yet prove whether `13ONHanc5GIDfuIlppm30FDfq1Wxe_55j` is:
  - a real Drive folder ID in another account context
  - a FormDesigner-side token/value
  - an inaccessible or moved folder

### 3.3 Remaining proof gap

Still required:

- Drive-side confirmation from the `enquiries@kundu.ac` context
- folder name
- owner
- parent/root location
- whether FODE runtime can read from it directly

Conclusion:

- FormDesigner source folder is **source trace only**
- applicant canonical folder remains the correct authoritative derivative-generation location

### 3.4 Corrected FD Flow Finding

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

## 4. Preview Metadata Storage Assessment

### 4.1 Existing candidate locations

Assessed options:

- row fields
- `File_Log`
- current derived manifest
- sidecar JSON in applicant folder
- separate preview index sheet

### 4.2 Assessment

#### Row fields

Not preferred.

Reasons:

- expands sheet schema for non-authoritative derivative state
- poor fit for per-page preview data
- creates write pressure on the admissions sheet for non-core authority

#### File_Log

Not preferred as authority.

Reasons:

- append-log format is useful for audit trace, not structured preview state
- hard to reconcile retry/page/file-level derivative metadata

#### Derived manifest only

Good read surface, but insufficient alone for generation state.

Reasons:

- safe for runtime consumption
- does not by itself persist retry/error/generated-page state

#### Separate preview index sheet

Possible but not preferred first.

Reasons:

- introduces another operational datastore
- adds sheet-write complexity for derivative-only data

#### Sidecar JSON near derivatives

Lowest-risk durable option for first implementation.

Reasons:

- keeps derivative metadata beside derivative files
- avoids admissions-sheet schema expansion
- supports per-file and per-page data cleanly
- can be rebuilt from the applicant folder if needed
- derived manifest can merge it into the existing runtime read model later

### 4.3 Recommendation

Recommended first durable location:

- derivative preview subfolder inside each applicant folder
- sidecar manifest JSON inside that preview subfolder
- runtime read path continues to expose a derived manifest DTO

## 5. Conversion Feasibility

### 5.1 True image files

Feasible now.

Reasons:

- current manifest already detects `image/*`
- current secure file route already supports signed image preview/open/download
- inline image preview already works without generating derivative pages

Implication:

- true image originals do not urgently need separate preview derivatives
- they may still benefit later from normalized thumbnail sizing, but not as the first risk-reduction priority

### 5.2 PDF files inside current Apps Script runtime

True PDF page rasterization is **not proven feasible** inside the current Apps Script implementation.

Current evidence:

- repo has no PDF rasterization pipeline
- repo has no Ghostscript/Poppler/ImageMagick/local worker integration
- current Apps Script code only handles original file copy plus secure delivery
- Drive metadata may expose thumbnail indicators, but not a trusted multi-page derivative pipeline
- Drive export behavior is relevant for Google-native file types, not general raw PDF-to-image conversion

Conclusion:

- do not assume native Apps Script PDF-to-image generation is available
- do not design first implementation around undocumented rasterization behavior

### 5.3 Google Docs conversion workaround

Not recommended as first production method.

Reasons:

- arbitrary PDF import/conversion is lossy and operationally brittle
- unclear page fidelity
- adds complexity and quota/runtime risk

### 5.4 External/local converter fallback

Feasible as a later architecture option, not as current live runtime scope.

Reasons:

- strongest technical path for reliable PDF page rasterization
- but introduces a new execution surface and operational boundary
- needs explicit security/runtime approval before adoption

## 6. Recommended First Implementation

### 6.1 Order of work

1. Preserve current original-file authority unchanged.
2. Add preview manifest capability first.
3. Keep derivative generation behind a disabled flag.
4. Do not change AdminUI/gallery consumption yet.
5. Add gallery/runtime consumption only after hydration/parser safety work is complete.

### 6.2 Recommended preview policy

For original file authority:

- originals remain authoritative
- derivatives are advisory/viewer assets only

For image files:

- continue using signed original preview path
- no forced derivative generation needed in first slice

For PDFs:

- plan derivative preview pages as optional generated assets
- do not replace original PDFs

### 6.3 Recommended preview manifest shape

Logical fields:

- `previewStatus`
- `previewFiles[]`
- `previewPageCount`
- `previewGeneratedAt`
- `conversionError`
- `galleryReady`
- `fallbackToOriginal`

Recommended per-preview-file shape:

- `sourceField`
- `itemIndex`
- `sourceMimeType`
- `pageIndex`
- `previewMimeType`
- `previewFileName`
- `relativePath`
- `width`
- `height`
- `generatedAt`
- `generator`
- `status`
- `error`

### 6.4 Recommended storage convention

Within applicant folder:

- originals remain where they are now
- create a dedicated preview folder, for example:
  - `_previews`
  - or `_derived_previews`

Within preview folder:

- one subfolder or file-prefix grouping per source file
- one JSON sidecar manifest for the applicant folder preview state

### 6.5 Recommended file format and page strategy

Recommended first target for PDF-derived pages:

- format: `PNG`
- page strategy: all pages, but capped
- page cap: start with a conservative cap such as `5`
- file size cap: skip or defer very large PDFs

Reasoning:

- PNG is safer for text-heavy review fidelity
- all-pages with cap is operationally better than first-page-only for school reports and IDs with back pages

### 6.6 Naming convention

Recommended preview naming:

- `{sourceField}__{itemIndex}__p{pageIndex}.png`

Example:

- `Latest_School_Report_File__1__p1.png`

Recommended manifest file:

- `_previews/preview-manifest.json`

## 7. Dry-Run / Flag Strategy

Recommended first runtime safety controls:

- global feature flag: off by default
- dry-run mode that derives intended preview jobs without creating files
- per-applicant/job idempotency check
- skip existing generated pages unless forced
- bounded retry with explicit error recording

Recommended statuses:

- `NOT_REQUESTED`
- `PENDING`
- `GENERATED`
- `PARTIAL`
- `FAILED`
- `SKIPPED_TOO_LARGE`
- `SKIPPED_UNSUPPORTED`

## 8. Missing Document Diagnostic Implication

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

## 9. Sample-Proof Position

Sample conversion proof was **deferred** in this slice.

Reason:

- no approved non-production sample workflow was provided
- no live applicant-folder mutation is allowed in this slice
- current evidence is sufficient to recommend architecture without touching production data

## 10. Risks and Mitigations

### 9.1 Risk: webhook timeout/quota pressure

Mitigation:

- do not generate previews inline inside the webhook response path
- run derivative generation after canonical copy, asynchronously or by later maintenance pass

### 9.2 Risk: sheet/schema sprawl

Mitigation:

- keep derivative state out of primary admissions-sheet authority columns

### 9.3 Risk: PDF rasterization not actually available in Apps Script

Mitigation:

- treat PDF conversion as unproven until separately demonstrated
- build manifest/flag scaffolding first

### 9.4 Risk: preview data becomes mistaken as authority

Mitigation:

- originals remain authoritative
- derivatives are explicitly viewer-only

### 9.5 Risk: source-side FormDesigner folder assumptions are wrong

Mitigation:

- do not design around the source folder
- use source folder only as intake/source trace
- generate derivatives from canonical applicant-folder copies

## 11. Recommendation

Proceed with a future backend-only slice, not an AdminUI slice:

1. add preview-manifest read model and schema design
2. add disabled/dry-run derivative job planning
3. keep originals authoritative
4. defer actual PDF raster generation until a concrete converter path is proven

Most likely safe first implementation:

- no AdminUI change
- no gallery change
- no production mutation during proof
- manifest-first, flag-controlled, derivative generation later

## 12. Recommended Next Steps

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

## 13. Final Classification

PASS

Meaning:

- planning question answered
- source token remains partially unproven
- current storage and manifest path is understood
- a low-risk implementation path exists
- no runtime or data mutation was performed
