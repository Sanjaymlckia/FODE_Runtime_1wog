# FODE Drive-backed Document Review Architecture

## Status

Track L documentation only. No runtime release.

This note documents the architecture direction after r23D.7B.3. It does not modify document authority, runtime behavior, Drive evidence, sheets, deployments, or communication behavior.

## 1. Current Resolved State

r23D.7B.3 established the safe interim document-card behavior:

- Download is the reliable and recommended document action.
- Open in New Tab remains secondary and browser-dependent.
- Image preview appears only when file type is positively detected.
- Current Admin document cards are an interim access surface, not the final gallery architecture.
- Current proxy URLs do not expose trusted MIME metadata to the client, so client-side preview classification is limited.

The original uploaded Drive files remain the authoritative evidence.

## 2. Drive-backed Architecture Direction

FormDesigner intake and portal uploads place applicant evidence in Google Drive applicant folders. Future document review should use this Drive evidence structure rather than infer file characteristics from Admin proxy URLs.

Authority rules:

- Applicant-row `Folder_Url` is the primary folder locator.
- Folder-name search is fallback or diagnostic only because naming differs by implementation path.
- Drive metadata is the source for MIME type, size, timestamps, parent folder, and preview eligibility.
- Exact Drive file IDs stored in row document fields provide the primary file-to-field mapping.
- `CONFIG.DOC_FIELDS` defines expected document fields and their required/optional status.
- Filename-prefix mapping is a secondary fallback only.
- Drive MIME metadata outranks filename extension.
- Original Drive files remain authoritative; manifests, thumbnails, crops, and AI findings are derived read-only views.

## 3. Investigation Findings

### Configuration

| Item | Value |
| --- | --- |
| Root folder ID | `1vGD3DoOv1hlxYoTIfrNCZqAnrVKmghuB` |
| Root folder name | `Forms FODE` |
| Configured year folder | `2025` |
| Script Property fallback | `FODE_UPLOAD_ROOT_ID` |
| Document mapping | `CONFIG.DOC_FIELDS` |

Required document types:

- Birth Certificate / NID / Passport
- Latest School Reports / Documents
- Passport Size Colour Photo
- Admission Fee Payment Receipt

Optional:

- Transfer Certificate

### Fixture

| Item | Value |
| --- | --- |
| Applicant | `FODE-26-002959` / Keziah Waffi |
| Folder | `keziah_waffi_2026-05-25` |
| Folder ID | `11Uyp813DuF39yk5-dQj3JzCh1Q8frhGg` |
| Path | `Forms FODE / 2025 / keziah_waffi_2026-05-25` |

Files:

- Birth ID: one PDF.
- School reports: three separate PDFs.
- Passport photo: one image.

Findings:

- Multi-file school reports are separate Drive files and should become separate gallery tiles.
- File names begin with canonical source-field names and can assist fallback mapping.
- Applicant-row field values contain exact Drive file IDs and provide stronger mapping authority.
- The passport photo filename ends in `.jpg`, while Drive reports MIME type `image/png`. MIME metadata must outrank filename extension.
- A 2026 applicant is stored under the configured `2025` folder. Gallery work must not correct or migrate this structure without a separate configuration/migration decision.
- Folder creation currently supports mixed naming behavior: name/date folders and ApplicantID folders. Folder-name lookup is therefore not authoritative.

## 4. Manifest Authority Model

```text
Applicant row
  -> Folder_Url
  -> Drive folder metadata
  -> list folder files
  -> Drive file metadata
  -> correlate row file IDs with CONFIG.DOC_FIELDS
  -> filename-prefix fallback where required
  -> manifest JSON
  -> Admin gallery UI
```

Mapping priority:

1. Extract exact Drive IDs from each applicant-row document field.
2. Match those IDs to files listed in the applicant folder.
3. Use canonical filename prefixes only for unmatched files.
4. Mark unresolved files as unknown rather than guessing.

Warnings should identify:

- MIME/extension mismatch;
- row-referenced file missing from the folder;
- folder file not referenced by the row;
- duplicate or ambiguous field mapping;
- missing or invalid `Folder_Url`;
- unexpected parent folder;
- missing expected document type.

## 5. Read-only Backend Boundary

Proposed function:

`admin_getApplicantDocumentManifest(payload)`

Input:

```json
{
  "applicantId": "FODE-26-002959"
}
```

Required behavior:

- require existing Admin authorization;
- locate the applicant row;
- read `Folder_Url`;
- read folder metadata;
- list folder files once;
- obtain required file metadata in as few Drive calls as practical;
- normalize all row document URLs, including multi-file values;
- map files using exact IDs and `CONFIG.DOC_FIELDS`;
- use filename-prefix fallback only where needed;
- return manifest JSON;
- perform no writes;
- perform no cache or Script Properties mutation unless separately approved;
- perform no document, lifecycle, payment, enrolment, queue, or communication decision.

The function should return explicit errors and warnings without creating audit-sheet writes as a side effect.

## 6. Proposed Manifest Schema

```json
{
  "ok": true,
  "applicantId": "FODE-26-002959",
  "applicantName": "Keziah Waffi",
  "folderId": "11Uyp813DuF39yk5-dQj3JzCh1Q8frhGg",
  "folderName": "keziah_waffi_2026-05-25",
  "folderUrl": "https://drive.google.com/drive/folders/...",
  "source": "FormDesigner / Drive",
  "files": [
    {
      "fileId": "Drive file ID",
      "fileName": "Birth_ID_Passport_File_....pdf",
      "mimeType": "application/pdf",
      "sizeBytes": 799338,
      "createdTime": "2026-05-25T22:47:25.110Z",
      "modifiedTime": "2026-05-25T22:47:25.762Z",
      "parentFolderId": "11Uyp813DuF39yk5-dQj3JzCh1Q8frhGg",
      "sourceField": "Birth_ID_Passport_File",
      "mappingMethod": "row_file_id",
      "suspectedDocumentType": "birth_id",
      "previewEligible": false,
      "thumbnailAvailable": false,
      "openUrl": "secure token-gated URL",
      "downloadUrl": "secure token-gated URL",
      "warnings": []
    }
  ],
  "missingExpected": [
    {
      "sourceField": "Fee_Receipt_File",
      "label": "Admission Fee Payment Receipt",
      "required": true
    }
  ],
  "warnings": []
}
```

`thumbnailAvailable` must reflect confirmed metadata or a generated derived preview. It must not be assumed.

## 7. Gallery UI Direction

Future r23D.7C-C should provide one applicant-level action:

`Open Document Gallery` or `Review All Documents`

Gallery behavior:

- show all uploaded files together;
- render one tile per Drive file;
- render multi-file school reports as separate tiles;
- use trusted Drive MIME metadata for image thumbnails/previews;
- make PDF and unknown tiles Download-primary;
- keep Open in New Tab secondary and browser-dependent;
- show missing expected documents as compact `Not Uploaded` tiles;
- keep status/comment controls available but visually separate from viewing controls;
- avoid embedded PDF iframe dependency;
- preserve access to original evidence.

The gallery is a read-only evidence presentation layer. Existing officer verification controls remain the document authority.

## 8. AI-assisted Precheck Boundary

AI output is advisory only.

Permitted findings:

- probable document type;
- blur or low resolution;
- cropping or cut-off edges;
- distant face or photo;
- unreadable text;
- missing expected type;
- MIME/extension mismatch;
- possible duplicate or unmapped file.

AI must never:

- verify, accept, or reject documents;
- accept or reject applicants;
- mark payment verified;
- change lifecycle or queues;
- enrol students;
- mutate or replace original evidence.

Derived thumbnails or crops:

- are viewing aids only;
- must be labelled `AI-assisted preview crop`;
- must not replace the official upload;
- should be temporary or stored separately as derived material;
- must preserve a clear link to the original secure evidence.

## 9. Release Sequence

1. `r23D.7B.3`: closed interim document-card behavior, Download-primary.
2. `r23D.7C-A/A2`: architecture and design documentation.
3. `r23D.7C-B`: read-only `admin_getApplicantDocumentManifest()`.
4. `r23D.7C-C`: Admin document gallery UI.
5. `r23D.7D`: advisory AI precheck and derived preview crops.

Each runtime stage requires a separate Track H CIS, release identity, remote-source proof, staging verification, rollback plan, and manual acceptance.

## 10. Non-goals

This architecture note does not authorize:

- runtime implementation;
- Drive or sheet mutation;
- folder migration;
- correction of the configured year folder;
- AI authority decisions;
- deployment, version creation, or repinning;
- production or Student changes;
- communication sends.
