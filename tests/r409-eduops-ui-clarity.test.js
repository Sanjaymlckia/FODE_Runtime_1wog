const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function read(file) { return fs.readFileSync(file, "utf8"); }
function clientSource(file) {
  return read(file).replace(/^<script>\s*/, "").replace(/\s*<\/script>\s*$/, "");
}

const core = clientSource("EduOps_ClientCore.html");
const components = clientSource("EduOps_ClientComponents.html");
const workbench = clientSource("EduOps_ClientWorkbench.html");
const operations = clientSource("EduOps_ClientOperationsWorkspace.html");
const previewData = read("tools/eduops-snapshot-capture/server/preview-data.js");

assert.doesNotThrow(() => new vm.Script(core), "Core client must remain syntactically valid");
assert.doesNotThrow(() => new vm.Script(components), "Components client must remain syntactically valid");
assert.doesNotThrow(() => new vm.Script(workbench), "Workbench client must remain syntactically valid");
assert.doesNotThrow(() => new vm.Script(operations), "Operations client must remain syntactically valid");

assert.match(core, /timeZone: "Pacific\/Port_Moresby"/, "shared date formatter must pin Papua New Guinea local time");
assert.match(core, /app\.formatPngDisplay\s*=\s*function/, "shared PNG-local display formatter must exist");
assert.match(core, /app\.displayRecipientEmail\s*=\s*function/, "shared recipient display normalizer must exist");
assert.match(components, /"Email: " \+ app\.displayRecipientEmail\(row\.email\)/, "worklist status must show the authoritative recipient email");
assert.match(components, /Recipient email[\s\S]*app\.displayRecipientEmail\(row\.email\)/, "quick view must show the actual recipient or No email recorded");
assert.match(components, /app\.formatPngDisplay\(snapshotAsOf\)/, "snapshot timestamps must use the shared PNG-local formatter");
assert.match(components, /app\.formatPngDisplay\(op\.nextActionTimestamp/, "row detail timestamps must use the shared PNG-local formatter");
assert.match(components, /function completionRowsHtml[\s\S]*app\.formatPngDisplay\(value/, "diagnostic date columns must use the shared PNG-local formatter");
assert.match(components, /Temporary expiry[\s\S]*app\.formatPngDisplay\(grant\.expiresAt/, "expiry information must use the shared PNG-local formatter");
assert.match(workbench, /Applicant identity and contact/, "Workbench must expose one primary identity/contact block");
assert.match(workbench, /contact\.hasValidEmail === true && recipient !== ""/, "communication preview must fail closed without a valid authoritative email");
assert.match(workbench, /comm\.effectiveEmail \|\| .*contactability.*effectiveEmail/, "communication draft must bind to the authoritative communication recipient");
assert.doesNotMatch(workbench, /\[\["ApplicantID", identity\(\)\.applicantId\], \["Row identity"/, "overview must not repeat the primary ApplicantID block");
assert.match(operations, /app\.formatPngDisplay\(cockpit\.snapshotTimestamp/, "Operations workspace timestamp must use PNG-local display");
assert.match(previewData, /\["long-display-values"/, "Preview Lab must include long-value clarity coverage");
assert.match(previewData, /operationalRow:\s*\{[\s\S]*OPSEDU_OPERATIONAL_ROW_V1/, "Preview fixtures must provide the operational row display contract");
assert.match(previewData, /email: ""[\s\S]*contactabilityState: "EMAIL_SUPPRESSED"/, "Preview Lab must include a no-email contactability fixture");

console.log("PASS R409 EduOps UI clarity static contracts");
