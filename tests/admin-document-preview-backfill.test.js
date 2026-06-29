const fs = require("node:fs");
const assert = require("node:assert/strict");

const source = [
  fs.readFileSync("Admin.js", "utf8"),
  fs.readFileSync("Admin_DocumentServices.js", "utf8"),
  fs.readFileSync("Admin_DocumentGallery.js", "utf8")
].join("\n");

function expectMatch(pattern, message) {
  assert.match(source, pattern, message);
}

function expectNoMatch(pattern, message) {
  assert.doesNotMatch(source, pattern, message);
}

expectMatch(/function admin_dryRunDocumentPreviewBackfill\(payload\)/, "Dry-run preview backfill entrypoint must exist");
expectMatch(/function admin_runDocumentPreviewBackfillBatch\(payload\)/, "Execute preview backfill entrypoint must exist");
expectMatch(/return adminDocumentPreviewBackfillBatch_\(payload, false\)/, "Dry-run entrypoint must call shared implementation with execute=false");
expectMatch(/return adminDocumentPreviewBackfillBatch_\(payload, true\)/, "Execute entrypoint must call shared implementation with execute=true");
expectMatch(/Math\.min\(25,\s*Number\(p\.batchSize \|\| p\.limit \|\| 10\)\)/, "Backfill must cap batch size to avoid Drive quota/timeouts");
expectMatch(/Array\.isArray\(CONFIG\.DOC_FIELDS\) \? CONFIG\.DOC_FIELDS : \[\]/, "Backfill must use configured document fields only");
expectMatch(/adminResolveApplicantDocumentFileFromRow_/, "Backfill must validate applicant row, folder, source field, item index, and folder membership");
expectMatch(/execute\s*\?\s*adminDocumentGalleryPrepareStoredRendition_\(resolved\)\s*:\s*adminDocumentGalleryInspectRenditionCandidate_\(resolved\)/, "Dry-run must inspect only; execute mode may create");
expectMatch(/previewsWouldCreate/, "Dry-run report must include previews that would be created");
expectMatch(/previewsCreated/, "Execute report must include previews created");
expectMatch(/previewsAlreadyPresent/, "Backfill report must include existing preview reuse");
expectMatch(/skippedUnsupported/, "Backfill report must include unsupported files");
expectMatch(/skippedMissingFolder/, "Backfill report must include missing folders");
expectMatch(/failedConversions/, "Backfill report must include failed conversions");
expectNoMatch(/setTrashed\(|DriveApp\.removeFile|deleteFile|trash/i, "Backfill must not delete stale applicant previews or old central preview files");

console.log("PASS document preview backfill dry-run and execute contracts");
