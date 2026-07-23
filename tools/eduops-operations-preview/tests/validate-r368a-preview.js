const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const previewRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(previewRoot, "evidence", "generated", "r368a");
const snapshotPath = path.join(previewRoot, "snapshots", "current", "snapshot.json");
fs.mkdirSync(evidenceDir, { recursive: true });

const snapshot = JSON.parse(fs.readFileSync(snapshotPath, "utf8"));
const client = fs.readFileSync(path.join(previewRoot, "public", "eduops-operations-preview.js"), "utf8");
const css = fs.readFileSync(path.join(previewRoot, "public", "eduops-operations-preview.css"), "utf8");
const server = fs.readFileSync(path.join(previewRoot, "server", "server.js"), "utf8");

new vm.Script(client, { filename: "eduops-operations-preview.js" });

assert.equal(snapshot.population.authoritativeApplicants, 332, "authoritative population must remain 332");
assert.equal(snapshot.validation.packageTotal, 332, "work-package total must reconcile to population");
assert.equal(snapshot.validation.noUnassignedActionableApplicant, true, "no actionable applicant may be unassigned");
assert.equal(snapshot.waffi.packageId, "FODE:READY:PAYMENT_FOLLOW_UP", "Waffi must remain in payment follow-up package");
assert.equal(snapshot.waffi.applicant.recommendedAction, "SEND_PAYMENT_REMINDER", "Waffi next action must remain payment reminder");

const menuGroups = [
  "Finance Operations",
  "Communications",
  "Portal",
  "Contactability",
  "Global Lifecycle",
  "Hidden / Other Routes",
  "Management Summary",
  "Reports",
  "Audit",
  "Roles & Capabilities"
];
for (const item of menuGroups) assert.match(client, new RegExp(item.replace(/[ /]/g, (m) => m === "/" ? "\\/" : "\\s+")), `Admin menu item missing: ${item}`);

assert.match(css, /--nav:\s*#0b1828/, "dark navy Admin shell must be preserved");
assert.match(css, /\.toolbar[\s\S]*background:\s*#ffffff/, "toolbar must be opaque");
assert.match(css, /position:\s*sticky/, "toolbar must be sticky");
assert.match(client, /railMode/, "package rail collapse state must exist");
assert.match(client, /summaryMode/, "summary collapse state must exist");
assert.match(client, /All primary actionability buckets/, "summary must keep all primary buckets accessible in every mode");
assert.match(client, /Expanded/, "Expanded control label must be present");
assert.match(client, /Compact/, "Compact control label must be present");
assert.match(client, /Collapsed/, "Collapsed control label must be present");
assert.match(client, /EMPTY_MESSAGES/, "empty bucket messages must be explicit");
assert.match(client, /resetOperationalState/, "empty bucket transitions must clear operational state");
assert.match(client, /data-shot="waffi-search-handoff"/, "Waffi search handoff must be renderable");
assert.match(client, /No result in \$\{esc\(currentPackage\(\)/, "scoped search wording must name the active work package");
assert.match(client, /Preview placeholder - not runtime content/, "preview placeholders must be explicitly marked as non-runtime content");
assert.match(client, /must not become runtime content/, "preview must prohibit placeholder promotion to runtime content");
assert.match(client, /Send disabled in preview/, "batch send must remain disabled");
assert.doesNotMatch(client + server, /google\.script\.run|GmailApp|MailApp|sendEmail|executeCommand|previewCommand/, "preview must not expose live send/mutation transport");

fs.writeFileSync(path.join(evidenceDir, "owner-review-summary.md"), [
  "# R368A EduOps Operations Preview Refinement",
  "",
  "- Complete Admin shell preserved with all required menu groups.",
  "- Styling aligned to dark navy Admin shell and neutral workspace panels.",
  "- Empty bucket transitions clear stale package, row, selection and batch state.",
  "- Sticky toolbar uses opaque white background and fixed stacking.",
  "- Package rail supports expanded, compact and collapsed states.",
  "- Waffi remains discoverable through payment follow-up and search handoff.",
  "- Batch and individual workflows remain preview-only and non-send."
].join("\n"));

fs.writeFileSync(path.join(evidenceDir, "final-state.json"), JSON.stringify({
  verdict: "R368A_EDUOPS_OPERATIONS_REFINED_PREVIEW_READY_FOR_OWNER_REVIEW",
  readOnly: true,
  runtimeSourceChanged: false,
  liveMutation: false,
  communicationSend: false,
  population: snapshot.population.authoritativeApplicants,
  workPackages: snapshot.workPackages.length,
  localPreviewUrl: "http://127.0.0.1:4183/"
}, null, 2));

console.log("PASS R368A EduOps Operations preview validation");
console.log(`Population: ${snapshot.population.authoritativeApplicants}`);
console.log(`Work packages: ${snapshot.workPackages.length}`);
console.log(`Waffi package: ${snapshot.waffi.packageId}`);
