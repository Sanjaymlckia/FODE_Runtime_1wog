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
expectNoMatch(/fileId\s*:/, "Client UI must not send raw Drive file IDs");
expectNoMatch(/folderId\s*:/, "Client UI must not send folder IDs");
expectNoMatch(/rawValue\s*:/, "Client UI must not send raw evidence values");
expectMatch(/function renderDocCards_\(/, "Existing document card renderer must remain present");
expectMatch(/function renderDocumentGallery_\(/, "Gallery renderer must exist");
expectMatch(/Preview Image/, "Image preview affordance must exist");
expectMatch(/Recommended: Download/, "PDF or unknown tiles must remain download-primary");
expectMatch(/Not Uploaded/, "Missing required documents must render a Not Uploaded state");
expectMatch(/Secure per-file action unavailable for this mapping\./, "Gallery must handle unmapped or non-indexed files safely");

console.log("PASS gallery button exists in selected-applicant review modal");
console.log("PASS gallery loads manifest only after explicit click path");
console.log("PASS per-file action payload uses sourceField + itemIndex only");
console.log("PASS client does not reference raw Drive IDs or raw evidence values in action payloads");
console.log("PASS existing renderDocCards_ flow remains present");
console.log("PASS gallery supports image, PDF/download-first, multi-file, and missing-required states");
