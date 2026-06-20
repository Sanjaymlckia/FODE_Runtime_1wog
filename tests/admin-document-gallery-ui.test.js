const fs = require("node:fs");
const assert = require("node:assert/strict");

const source = fs.readFileSync("AdminUI.html", "utf8");

function expectMatch(pattern, message) {
  assert.match(source, pattern, message);
}

function expectNoMatch(pattern, message) {
  assert.doesNotMatch(source, pattern, message);
}

expectMatch(/id="btnOpenDocumentGallery"/, "Gallery button must exist in the review modal");
expectMatch(/id="documentGallery"/, "Gallery container must exist");
expectMatch(/Open Document Gallery/, "Gallery label must be present");
expectMatch(/admin_getApplicantDocumentManifest\(\{ applicantId: applicantId \}\)/, "Manifest must load on explicit gallery request");
expectMatch(/admin_getApplicantDocumentFileAction\(\{\s*applicantId: applicantId,\s*rowNumber: currentRowNumber,\s*sourceField: String\(sourceField \|\| ""\),\s*itemIndex: Number\(itemIndex\)/s, "Per-file action requests must use applicantId, rowNumber, sourceField, and itemIndex only");
expectMatch(/function parseSignedFileRouteUrl_\(/, "Preview flow must validate signed file-route URLs before loading the iframe");
expectMatch(/if \(!parsedPreview\.valid\) \{[\s\S]*Preview link could not be prepared\. Use Open in New Tab or Download\./, "Malformed preview URLs must not be loaded into the iframe");
expectMatch(/openDocPreview_\(label,\s*res\.openUrl \|\| \"\",\s*res\.downloadUrl \|\| \"\"\)/, "Preview action must use the signed openUrl returned by admin_getApplicantDocumentFileAction");
expectNoMatch(/openDocPreview_\(label,\s*res\.previewUrl/, "Client must not depend on a separate previewUrl or reconstruct preview links");
expectNoMatch(/fileId\s*:/, "Client UI must not send raw Drive file IDs");
expectNoMatch(/folderId\s*:/, "Client UI must not send folder IDs");
expectNoMatch(/rawValue\s*:/, "Client UI must not send raw evidence values");
expectMatch(/function renderDocCards_\(/, "Existing document card renderer must remain present");
expectMatch(/function renderDocumentGallery_\(/, "Gallery renderer must exist");
expectMatch(/safeFile\.previewEligible === true && safeFile\.previewUrl/, "Gallery thumbnail renderer must support inline image thumbnails only when a signed previewUrl is present");
expectMatch(/<img src="\$\{esc\(safeFile\.previewUrl\)\}"/, "Gallery thumbnail branch must render the signed previewUrl rather than reconstructing a raw file link");
expectMatch(/Latest School Report "\s*\+\s*String\(index \+ 1\)/, "Multi-file school reports should use short operator-facing labels");
expectMatch(/Fee Receipt/, "Missing fee receipt tile should use a short operator-facing label");
expectMatch(/Preview Image/, "Image preview affordance must exist");
expectMatch(/Download first|PDF \/ document file - open or download to review\./, "PDF or unknown tiles must remain download-primary");
expectMatch(/Not Uploaded/, "Missing required documents must render a Not Uploaded state");
expectMatch(/Secure per-file action unavailable for this mapping\./, "Gallery must handle unmapped or non-indexed files safely");

console.log("PASS gallery button exists in selected-applicant review modal");
console.log("PASS gallery loads manifest only after explicit click path");
console.log("PASS per-file action payload uses sourceField + itemIndex only");
console.log("PASS gallery preview validates and reuses signed openUrl before iframe navigation");
console.log("PASS client does not reference raw Drive IDs or raw evidence values in action payloads");
console.log("PASS existing renderDocCards_ flow remains present");
console.log("PASS gallery supports image, PDF/download-first, multi-file, and missing-required states");
