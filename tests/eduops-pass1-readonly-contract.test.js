const fs = require("node:fs");
const assert = require("node:assert/strict");
const vm = require("node:vm");

function read(path) {
  return fs.readFileSync(path, "utf8");
}

const files = {
  code: read("Code.js"),
  contracts: read("EduOps_Contracts.js"),
  adapter: read("EduOps_FODE_Adapter.js"),
  workload: read("EduOps_Workload.js"),
  html: read("EduOps.html"),
  styles: read("EduOps_Styles.html"),
  client: ["EduOps_ClientCore.html", "EduOps_ClientComponents.html", "EduOps_ClientWorkbench.html", "EduOps_ClientBatch.html", "EduOps_Client.html"].map(read).join("\n"),
  adminUi: read("AdminUI.html"),
  operatorNext: read("AdminUI_OperatorNext.html"),
  claspignore: read(".claspignore")
};

function scriptBlocks(source) {
  return Array.from(source.matchAll(/<script\b[^>]*>([\s\S]*?)<\/script>/gi), (match) => match[1])
    .map((block) => block
      .replace(/(["'])<\?[\s\S]*?\?>\1/g, '"__APPS_SCRIPT_TEMPLATE__"')
      .replace(/<\?[\s\S]*?\?>/g, '"__APPS_SCRIPT_TEMPLATE__"'));
}

for (const [name, source] of Object.entries({
  "EduOps_Contracts.js": files.contracts,
  "EduOps_FODE_Adapter.js": files.adapter,
  "EduOps_Workload.js": files.workload
})) {
  assert.doesNotThrow(() => new vm.Script(source, { filename: name }), `${name} must parse as JavaScript`);
}

for (const [index, block] of scriptBlocks(files.html + "\n" + files.client).entries()) {
  assert.doesNotThrow(() => new vm.Script(block, { filename: `EduOps.script.${index}.js` }), `EduOps script block ${index} must parse`);
}

assert.match(files.code, /if \(route === "eduops"\) return renderEduOpsApp_;/, "?view=eduops must route to the isolated EduOps renderer");
assert.doesNotMatch(files.adminUi, /EduOps|eduops_/i, "AdminUI.html must not contain EduOps implementation");
assert.doesNotMatch(files.operatorNext, /eduops_queryOperationalWorkload|EduOps Shadow/i, "Operator Next must not contain EduOps implementation");

for (const name of [
  "EduOps.html",
  "EduOps_Client.html",
  "EduOps_ClientBatch.html",
  "EduOps_ClientComponents.html",
  "EduOps_ClientCore.html",
  "EduOps_ClientWorkbench.html",
  "EduOps_Contracts.js",
  "EduOps_FODE_Adapter.js",
  "EduOps_Styles.html",
  "EduOps_Workload.js"
]) {
  assert.match(files.claspignore, new RegExp(`!${name.replace(".", "\\.")}`), `${name} must be part of the deployable contract`);
}

const publicEduopsFunctions = Array.from((files.contracts + "\n" + files.workload).matchAll(/\bfunction\s+(eduops_[A-Za-z0-9_]+)\s*\(/g), (match) => match[1])
  .filter((name) => !name.endsWith("_"));
assert.deepEqual(publicEduopsFunctions.sort(), [
  "eduops_getAccessProjection",
  "eduops_getApplicantWorkbench",
  "eduops_getDocumentFileAction",
  "eduops_getDocumentManifest",
  "eduops_getDocumentRendition",
  "eduops_getParityDiagnostics",
  "eduops_getProfile",
  "eduops_getReconciliation",
  "eduops_queryOperationalWorkload",
  "eduops_searchApplicants"
].sort(), "Pass 1 public EduOps RPC surface must remain read-only and explicit");

const mutationTerms = [
  "admin_updateDocStatuses",
  "admin_sendApplicantMessage",
  "admin_sendStageBatch",
  "admin_sendSelectedApplicantBatch",
  "admin_createZohoBooksFodeDraftInvoice",
  "admin_setPaymentVerified",
  "admin_resetPortalLink",
  "admin_setPortalAccess",
  "GmailApp.sendEmail",
  "MailApp.sendEmail",
  "setValue(",
  "setValues(",
  "appendRow(",
  "PropertiesService.getScriptProperties().set"
];
const eduopsSource = [files.contracts, files.adapter, files.workload, files.html, files.client].join("\n");
for (const term of mutationTerms) {
  assert.doesNotMatch(eduopsSource, new RegExp(term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `EduOps Pass 1 source must not expose mutation term: ${term}`);
}

assert.match(files.adapter, /canonicalPopulationSnapshot_/, "FODE adapter must consume canonical FODE authority");
assert.match(files.adapter, /admin_getCanonicalApplicant/, "FODE adapter must use exact canonical applicant authority");
assert.match(files.workload, /admin_getApplicantDocumentManifest/, "Document manifest wrapper must reuse existing document gallery authority");
assert.match(files.workload, /admin_getApplicantDocumentImageRendition/, "Document PNG rendition wrapper must reuse existing gallery authority");
assert.match(files.workload, /admin_getApplicantDocumentFileAction/, "Open Original wrapper must reuse signed file-action authority");
assert.match(files.workload, /eduopsRequireAccess_\(\)/g, "EduOps RPCs must perform server-side access checks");
assert.match(files.client, /readRpcAllowlist[\s\S]*writeRpcAllowlist/, "EduOps client must use closed read and write RPC allowlists");
assert.doesNotMatch(files.client, /google\.script\.run\[[^\]]+\]/, "EduOps client must not use dynamic google.script.run dispatch");
assert.doesNotMatch(files.client, /admin_[A-Za-z0-9_]+\(/, "EduOps client must not call legacy Admin RPCs directly");
assert.doesNotMatch(files.adapter + files.workload, /prototypes\/eduops|mock-authority|eduops-next/i, "Runtime EduOps must not import prototype mock authority");
assert.match(files.workload, /pageSize === 10 \|\| pageSize === 25 \|\| pageSize === 50|eduopsNormalizePageSize_/, "Workload must enforce bounded server page sizes");
assert.match(files.workload, /expectedSnapshotId[\s\S]*STALE/, "Workload/Workbench must surface stale snapshot handling");
assert.match(files.workload, /eduopsUrgencyRank_/, "Workload must use deterministic server sorting");
assert.match(files.workload, /applicantId/, "Exact ApplicantID must be part of server DTOs");
assert.match(files.workload, /eduops_getParityDiagnostics/, "Pass 1 must include parity diagnostics");
assert.match(files.adapter, /eduopsResolveFodeSnapshot_/, "Pass 1 must resolve a bounded, source-versioned snapshot projection");
assert.match(files.workload, /canonicalSnapshotResolutionMs[\s\S]*workloadCompositionMs[\s\S]*sortingPagingMs[\s\S]*responseBytes/, "Workload must report segmented server timings and response size");
assert.match(files.client, /workloadTimeoutMs[\s\S]*DISCARDED_SUPERSEDED[\s\S]*data-retry-workload/, "Client workload requests must be bounded, supersedable and retryable");
assert.match(files.client, /workScopePinned[\s\S]*ALL_AUTHORISED/, "Actionability navigation must reset unpinned ownership scope");
assert.match(files.client, /if \(!app\.state\.workScopePinned\) app\.state\.workScope = "ALL_AUTHORISED"/, "Actionability changes must reset an unpinned ownership scope");

console.log(`PASS EduOps Pass 1 read-only architecture contract publicRpcs=${publicEduopsFunctions.length}`);
