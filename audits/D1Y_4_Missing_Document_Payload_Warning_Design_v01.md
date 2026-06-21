# D1Y.4 Missing-Document Payload Warning Design v01

Status: Design-only diagnostic
Track: L
Runtime release: No

## 1. Objective

Design the smallest safe FODE-side diagnostic for submissions where expected FormDesigner document fields are present, but no usable document URLs arrive for canonicalization.

This note does not approve runtime implementation yet.

## 2. Current Confirmed State

Confirmed from current D1Y diagnostics:

- FODE canonicalization works when a usable FormDesigner raw URL is present.
- `FODE-26-003158` proved this:
  - `Latest_School_Report_File` carried a usable raw FormDesigner URL
  - canonical copy succeeded
  - applicant folder received one copied file
  - `File_Log` recorded `fetched_and_copied`
- `FODE-26-003157` showed the contrasting failure:
  - all configured document fields stored as `[]`
  - empty `File_Log`
  - applicant folder created but `0` files present
  - no canonicalization attempt occurred

Current failure class:

- intermittent / selective FormDesigner attachment payload absence

Not supported by current evidence:

- total FODE canonicalization outage
- total post-14 June pipeline outage

## 3. Real Runtime Hook Points

Relevant runtime path:

- `canonicalizeFdIntakeFiles_()` in [Code.js](E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Code.js:4829)
- document-field selection from `CONFIG.DOC_FIELDS` in [Code.js](E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Code.js:4844)
- normalization via `normalizeToUrlList_(out[field], field)` in [Code.js](E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Code.js:4852)
- successful per-file event `ACTIVATION_FILE_CANONICALIZED` in [Code.js](E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Code.js:4917)
- submit-state summary `ACTIVATION_SUBMIT_STATE_DECISION` in [Code.js](E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Code.js:4955)

This means the smallest later implementation point is inside `canonicalizeFdIntakeFiles_()`, after normalization and after attempted canonicalization counts are known.

## 4. Recommended Detection Condition

Recommended warning condition:

1. payload contains one or more configured `CONFIG.DOC_FIELDS`
2. normalization runs for those fields
3. all normalized document URL lists are empty
4. zero files are canonicalized
5. applicant folder may exist, but no files were created by this pass

Recommended diagnostic interpretation:

- the submission declared document-capable fields
- but the runtime received no usable file URLs to fetch/copy

Recommended non-blocking scope:

- warn only
- do not reject the applicant
- do not block applicant creation
- do not auto-send communications

## 5. Recommended Event Shape

Recommended log event name:

- `ACTIVATION_FILE_PAYLOAD_EMPTY_WARNING`

Recommended fields:

- `applicantId`
- `correlationId` if available
- `presentDocFields`
- `normalizedDocFieldCounts`
- `usableRawUrlCount`
- `canonicalizedFileCount`
- `folderPrepared`
- `folderFileCountAfterPass` if cheaply available
- `recommendedOperatorAction`

Recommended operator-action text:

- `Documents were not received in the intake payload. Request resend/upload and verify contactability.`

Important:

- do not include raw Drive IDs or raw source URLs in any operator-facing surface
- raw URL details may remain log-only if needed for backend diagnostics

## 6. Detection Location Recommendation

Recommended location:

- inside `canonicalizeFdIntakeFiles_()`

Recommended sequence:

1. identify configured doc fields from `CONFIG.DOC_FIELDS`
2. normalize each field with `normalizeToUrlList_()`
3. count usable URLs found
4. run canonicalization attempts as normal
5. count files successfully canonicalized
6. if all normalized lists are empty and canonicalized count is zero, emit warning event

Why this is the smallest safe location:

- it uses the same authoritative normalization path already used for canonicalization
- it avoids duplicating document-field interpretation elsewhere
- it captures the failure before later admin/report layers try to infer it indirectly

Not preferred as first implementation point:

- AdminUI-only warning
- source-folder scanner
- separate post-hoc Drive audit as primary detection

## 7. Recommended Operator Surface Later

This task does not implement operator UI. Later surfaces should be backend-driven and advisory only.

Recommended future surfaces:

1. document manifest warning
2. admin review warning
3. actionability/audit report

Preferred operator wording:

- `Advisory: expected document fields were present, but no uploaded file links were received in the intake payload.`
- `Request the applicant to resend documents.`

If contactability is also bad:

- surface separately as contactability failure
- do not merge it into the document-payload warning

## 8. What Must Not Happen

- do not treat this as applicant rejection
- do not auto-send reminder messages
- do not mutate Drive to compensate
- do not scan the FormDesigner source folder as record authority
- do not replace the applicant canonical folder as the evidence authority
- do not block application creation

## 9. Contactability Separation

Contactability is a separate dimension.

Example:

- invalid/bounced email such as `550 5.1.1 NoSuchUser` is a `NO_EFFECTIVE_EMAIL` problem
- missing document payload is an intake-file problem

If both occur:

- operator needs a fallback path such as phone/WhatsApp
- the warning model should preserve both findings separately

## 10. Recommended Implementation Sequence

Recommended later sequence:

1. `D1Y.4` design note
2. `D1Y.5` backend-only warning/logging helper
3. `D1Y.6` bounded audit/report for recent submissions with zero canonicalized document files
4. `E2.1C` AdminUI hydration isolation / validator before any AdminUI release carrying new warning surfaces
5. `G1` Google Forms / owned intake replacement as near-critical strategic follow-up

## 11. Risks

Primary risks:

- false positives when an applicant genuinely submits with no optional documents and no required uploads
- false positives if upstream payload shape changes but still contains non-URL evidence not handled by normalization
- overloading operators if warnings are shown without contactability/context pairing

Risk control:

- keep first implementation log-only
- require both:
  - document-capable fields present
  - zero usable normalized URLs
- avoid any automatic applicant-state or communication effect

## 12. Final Recommendation

Proceed later with a backend-only diagnostic event, not an AdminUI change first.

Recommended event:

- `ACTIVATION_FILE_PAYLOAD_EMPTY_WARNING`

Recommended trigger:

- configured doc fields present
- all normalized URL lists empty
- zero canonicalized files

Recommended first operator surface later:

- document manifest / review warning, after hydration-safe AdminUI release discipline exists

## 13. Safety Confirmation

- no runtime code changes
- no `AdminUI.html` changes
- no `Config.js` changes
- no Apps Script version
- no deployment
- no repin
- no Sheet edits
- no Drive data mutation
- no sends
- no OPS changes
