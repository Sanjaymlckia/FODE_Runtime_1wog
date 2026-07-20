const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { buildSnapshotFromEvidence, writeSnapshotFiles, SNAPSHOT_SCHEMA } = require("../server/snapshot-adapter");

const previewRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(previewRoot, "..", "..");
const evidenceDir = path.join(previewRoot, "evidence", "r368");
fs.mkdirSync(evidenceDir, { recursive: true });

function writeJson(name, value) {
  fs.writeFileSync(path.join(evidenceDir, name), JSON.stringify(value, null, 2));
}

function read(file) {
  return fs.readFileSync(path.join(previewRoot, file), "utf8");
}

const currentSnapshotPath = path.join(previewRoot, "snapshots", "current", "snapshot.json");
const snapshot = fs.existsSync(currentSnapshotPath)
  ? JSON.parse(fs.readFileSync(currentSnapshotPath, "utf8"))
  : buildSnapshotFromEvidence(repoRoot);
if (!fs.existsSync(currentSnapshotPath)) writeSnapshotFiles(snapshot, previewRoot);

assert.equal(snapshot.schemaVersion, SNAPSHOT_SCHEMA, "snapshot schema must match");
assert.equal(snapshot.population.authoritativeApplicants, 332, "snapshot must contain 332 authoritative applicants");
assert.equal(snapshot.population.distinctApplicantIds, 332, "ApplicantID count must reconcile");
assert.deepEqual(snapshot.population.duplicates, [], "duplicate ApplicantIDs must be absent");
assert.equal(snapshot.validation.packageTotal, snapshot.population.authoritativeApplicants, "work-package total must reconcile to population");
assert.equal(snapshot.validation.noUnassignedActionableApplicant, true, "no actionable applicant may be hidden in an unmapped package");
assert.equal(snapshot.waffi.packageId, "FODE:READY:PAYMENT_FOLLOW_UP", "Waffi must route to payment follow-up package");
assert.equal(snapshot.waffi.applicant.lifecycle, "PAYMENT_PENDING", "Waffi lifecycle must be payment pending");
assert.equal(snapshot.waffi.applicant.actionability, "READY", "Waffi actionability must be ready");
assert.equal(snapshot.waffi.applicant.recommendedAction, "SEND_PAYMENT_REMINDER", "Waffi recommended action must be payment reminder");

const readyDocs = snapshot.workPackages.find((pkg) => pkg.packageId === "FODE:READY:DOCUMENT_FOLLOW_UP");
const reviewDocs = snapshot.workPackages.find((pkg) => pkg.packageId === "FODE:REVIEW_REQUIRED:DOCUMENT_FOLLOW_UP");
assert.ok(readyDocs, "READY document follow-up package must exist");
assert.ok(reviewDocs, "REVIEW_REQUIRED document follow-up package must exist");
assert.notEqual(readyDocs.displayLabel, reviewDocs.displayLabel, "duplicate document-follow-up labels must be resolved");

const primaryCounts = Object.fromEntries(snapshot.primaryBuckets.map((bucket) => [bucket.code, bucket.count]));
assert.equal(primaryCounts.READY, 253, "READY count must match accepted live count");
assert.equal(primaryCounts.REVIEW_REQUIRED, 76, "REVIEW_REQUIRED count must match accepted live count");
assert.equal(primaryCounts.COOLING_OFF, 2, "COOLING_OFF count must match accepted live count");
assert.equal(primaryCounts.COMPLETE, 1, "COMPLETE count must match accepted live count");

const clientSource = read("public/opsedu-preview.js");
new vm.Script(clientSource, { filename: "opsedu-preview.js" });
assert.match(clientSource, /Send disabled in preview/, "batch send must be visibly disabled");
assert.match(clientSource, /data-shot="search-handoff"/, "global search handoff state must be renderable");
assert.doesNotMatch(clientSource, /google\.script\.run|GmailApp|MailApp|sendEmail|executeCommand|previewCommand/, "preview client must not call live mutation/send transports");
assert.doesNotMatch(read("server/server.js"), /POST.*execute|sendEmail|GmailApp|MailApp/, "preview server must not expose mutation/send routes");

writeJson("snapshot-summary.json", {
  schemaVersion: snapshot.schemaVersion,
  population: snapshot.population,
  source: snapshot.source,
  validation: snapshot.validation
});
writeJson("work-package-inventory.json", snapshot.packageInventory);
writeJson("primary-bucket-counts.json", primaryCounts);
writeJson("waffi-trace.json", snapshot.waffi);
writeJson("final-state.json", {
  verdict: "R368_OPSEDU_PREVIEW_READY_FOR_OWNER_REVIEW",
  readOnly: true,
  runtimeSourceChanged: false,
  liveMutation: false,
  communicationSend: false,
  snapshotPopulation: snapshot.population.authoritativeApplicants,
  workPackageCount: snapshot.workPackages.length,
  duplicateLabelResolution: snapshot.duplicateLabelResolution
});

console.log("PASS R368 OpsEdu preview validation");
console.log(`Population: ${snapshot.population.authoritativeApplicants}`);
console.log(`Work packages: ${snapshot.workPackages.length}`);
console.log(`Waffi package: ${snapshot.waffi.packageId}`);
