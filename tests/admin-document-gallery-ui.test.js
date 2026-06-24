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
expectMatch(/id="documentReviewWorkflow"/, "Document evidence and verification workflow wrapper must exist");
expectMatch(/class="documentReviewActionBar"/, "Document verification must have a local sticky action bar");
expectMatch(/id="btnSaveDocs"[\s\S]*id="dirtyWarn"/, "Unsaved warning must be visually attached to the document status save action");
expectMatch(/id="reviewSecondaryTools"[\s\S]*Contact fallback \/ CRM \/ admin support details/, "Secondary support details must be collapsed below the primary document and communication flow");
expectMatch(/admin_getApplicantDocumentManifest\(\{ applicantId: applicantId \}\)/, "Manifest must load on explicit gallery request");
expectMatch(/admin_getApplicantDocumentFileAction\(\{\s*applicantId: applicantId,\s*rowNumber: currentRowNumber,\s*sourceField: String\(sourceField \|\| ""\),\s*itemIndex: Number\(itemIndex\)/s, "Per-file action requests must use applicantId, rowNumber, sourceField, and itemIndex only");
expectMatch(/admin_getApplicantDocumentImageRendition\(\{\s*applicantId: applicantId,\s*rowNumber: currentRowNumber,\s*sourceField: sourceField,\s*itemIndex: itemIndex\s*\}\)/s, "Image rendition requests must use applicantId, rowNumber, sourceField, and itemIndex only");
expectMatch(/function parseSignedFileRouteUrl_\(/, "Preview flow must validate signed file-route URLs before loading the iframe");
expectMatch(/if \(!parsedPreview\.valid\) \{[\s\S]*Preview link could not be prepared\. Use Open in New Tab or Download\./, "Malformed preview URLs must not be loaded into the iframe");
expectMatch(/openDocPreview_\(label,\s*res\.openUrl \|\| \"\",\s*res\.downloadUrl \|\| \"\"\)/, "Preview action must use the signed openUrl returned by admin_getApplicantDocumentFileAction");
expectNoMatch(/openDocPreview_\(label,\s*res\.previewUrl/, "Client must not depend on a separate previewUrl or reconstruct preview links");
expectNoMatch(/fileId\s*:/, "Client UI must not send raw Drive file IDs");
expectNoMatch(/folderId\s*:/, "Client UI must not send folder IDs");
expectNoMatch(/rawValue\s*:/, "Client UI must not send raw evidence values");
expectMatch(/function renderDocCards_\(/, "Existing document card renderer must remain present");
expectMatch(/function renderDocumentGallery_\(/, "Gallery renderer must exist");
expectMatch(/function documentGallerySortRank_\(/, "Gallery sort rank helper must exist");
expectMatch(/function documentGallerySortedItems_\(/, "Gallery sorted item helper must exist");
expectMatch(/Passport_Photo_File[\s\S]*return 10/, "Gallery should prioritize student/passport photo evidence");
expectMatch(/Birth_ID_Passport_File[\s\S]*return 20/, "Gallery should prioritize ID/birth/passport evidence after photo");
expectMatch(/Latest_School_Report_File[\s\S]*return 30/, "Gallery should sort school reports predictably");
expectMatch(/Transfer_Certificate_File[\s\S]*return 40/, "Gallery should sort transfer certificate predictably");
expectMatch(/Fee_Receipt_File[\s\S]*return 50/, "Gallery should sort payment evidence predictably");
expectMatch(/var sourceText = sourceField \? \("Source: " \+ sourceField/, "Gallery tiles must prepare source field and item index context");
expectMatch(/<span class="documentGalleryFileType">\$\{esc\(sourceText\)\}<\/span>/, "Gallery tiles must render source field and item index context");
expectMatch(/<span class="documentGalleryFileType">Type: \$\{esc\(mimeType\)\}<\/span>/, "Gallery tiles must show file type context");
expectMatch(/admin_getApplicantDocumentImageRendition/, "Gallery must request server-prepared image renditions for inline visual display");
expectMatch(/function documentGalleryCanRenderVisual_\(/, "Gallery must include a shared image/PDF visual-render eligibility helper");
expectMatch(/documentGalleryCanRenderVisual_\(safeFile\) && rendition && rendition\.dataUrl/, "Gallery thumbnail renderer must display image/PDF renditions only when a server-prepared data URL is present");
expectMatch(/<img src="\$\{esc\(rendition\.dataUrl\)\}"/, "Gallery thumbnail branch must render the server-prepared image data URL rather than a raw file link");
expectMatch(/PDF preview - first page\./, "PDF files with renditions must be labelled as first-page previews");
expectMatch(/class="documentGalleryZoomBtn galleryImageZoomBtn"/, "Image gallery tiles must provide an explicit enlarge control");
expectMatch(/function openGalleryLightbox_\(/, "Image gallery must support click-to-enlarge lightbox behavior");
expectMatch(/function parseGalleryRenditionDataUrl_\(/, "Gallery lightbox must validate image data URLs before display");
expectMatch(/id="galleryLightboxBack"/, "Gallery lightbox shell must exist");
expectMatch(/documentGalleryTile image/, "Image files must render as visually larger gallery cards");
expectMatch(/documentGalleryThumb image/, "Image files must render in a larger visual thumbnail region");
expectMatch(/grid-template-columns:repeat\(auto-fit, minmax\(280px, 1fr\)\)/, "Gallery grid must use wider responsive visual cards");
expectMatch(/min-height:240px/, "Image thumbnails must have a larger operator-identification visual area");
expectMatch(/Latest School Report "\s*\+\s*String\(index \+ 1\)/, "Multi-file school reports should use short operator-facing labels");
expectMatch(/Fee Receipt/, "Missing fee receipt tile should use a short operator-facing label");
expectMatch(/Preview Image/, "Image preview affordance must exist");
expectMatch(/Download first|PDF \/ document file - open or download to review\./, "PDF or unknown tiles must remain download-primary");
expectMatch(/Not Uploaded/, "Missing required documents must render a Not Uploaded state");
expectMatch(/Secure per-file action unavailable for this mapping\./, "Gallery must handle unmapped or non-indexed files safely");

console.log("PASS gallery button exists in selected-applicant review modal");
console.log("PASS gallery loads manifest only after explicit click path");
console.log("PASS per-file action payload uses sourceField + itemIndex only");
console.log("PASS image rendition payload uses sourceField + itemIndex only");
console.log("PASS gallery preview validates and reuses signed openUrl before iframe navigation");
console.log("PASS gallery image tiles use server-prepared data URL renditions");
console.log("PASS client does not reference raw Drive IDs or raw evidence values in action payloads");
console.log("PASS existing renderDocCards_ flow remains present");
console.log("PASS r288 review modal document workflow action bar and secondary collapse source checks");
console.log("PASS r288 gallery sort and source/type labeling source checks");
console.log("PASS gallery supports image, PDF/download-first, multi-file, and missing-required states");
