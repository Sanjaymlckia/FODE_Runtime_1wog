const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

const html = read("EduOps.html");
const client = read("EduOps_Client.html");
const core = read("EduOps_ClientCore.html");
const components = read("EduOps_ClientComponents.html");
const contracts = read("EduOps_Contracts.js");
const workload = read("EduOps_Workload.js");

for (const [file, source] of [
  ["EduOps_Client.html", client],
  ["EduOps_ClientCore.html", core],
  ["EduOps_ClientComponents.html", components]
]) {
  const script = source.replace(/^<script>\s*/, "").replace(/\s*<\/script>\s*$/, "");
  assert.doesNotThrow(() => new vm.Script(script, { filename: file }), `${file} must parse`);
}

assert.match(html, /<strong>EduOps Operations<\/strong>/, "operator title must be EduOps Operations");
assert.doesNotMatch(html, /<strong>EduOps Operations Workspace<\/strong>/, "old visible title must be retired");
for (const id of ["eduopsUserEmail", "eduopsRole", "eduopsActiveGrants", "eduopsCapabilitySummary"]) {
  assert.match(html, new RegExp(`id="${id}"`), `identity footer must include ${id}`);
  assert.match(client, new RegExp(id), `bootstrap must hydrate ${id}`);
}
for (const report of ["academic", "portal", "classroom", "delivery"]) {
  assert.match(html, new RegExp(`data-report="${report}"`), `navigation must expose ${report}`);
}

const readRpcs = [
  "admin_getFodeRegistryApplicant",
  "admin_getFodeRegistryWorklist",
  "admin_getFodeExamEligibility",
  "admin_getFodeAcademicAuthorityOverview",
  "admin_getFodePortalStatus",
  "admin_getFodePortalStatusWorklist",
  "admin_getFodeFraudReconciliationQueue",
  "admin_getFodePortalActionReconciliationQueue",
  "admin_getFodeClassroomReadiness",
  "admin_getFodeClassroomReadinessWorklist",
  "admin_getFodeClassroomHandoffPackage",
  "admin_getFodeDeliveryHistory",
  "admin_getFodeManagementSummary",
  "admin_getFodeAssignmentsAndApprovals",
  "admin_getFodeDataQuality",
  "admin_getFodeSystemHealth",
  "admin_getFodeAuditProjection"
];
const actionRpcs = [
  "admin_previewFodeRegistryConfirmation",
  "admin_confirmFodeRegistry",
  "admin_previewFodeAcademicEvidenceIngestion",
  "admin_confirmFodeAcademicEvidenceIngestion",
  "admin_previewFodePortalAccessAction",
  "admin_executeFodePortalAccessAction",
  "admin_previewFodeFraudReconciliationResolution",
  "admin_executeFodeFraudReconciliationResolution",
  "admin_previewFodeFinanceHandoff",
  "admin_executeFodeFinanceHandoff",
  "admin_previewFodeClassroomSubjectMapping",
  "admin_confirmFodeClassroomSubjectMapping",
  "admin_previewFodeClassroomHandoff",
  "admin_executeFodeClassroomHandoff"
];
for (const rpc of [...readRpcs, ...actionRpcs]) {
  assert.match(core, new RegExp(`${rpc}:\\s*true`), `client must exactly allowlist ${rpc}`);
  assert.match(contracts, new RegExp(`"${rpc}"`), `server contract must exactly allowlist ${rpc}`);
  assert.match(components, new RegExp(rpc), `completion surface must bind ${rpc}`);
}

for (const capability of [
  "CAN_READ_REGISTRY",
  "CAN_MANAGE_REGISTRY",
  "CAN_REVIEW_EXAM_ELIGIBILITY",
  "CAN_READ_PORTAL_STATUS",
  "CAN_ADMIN_PORTAL_ACCESS",
  "CAN_READ_CLASSROOM",
  "CAN_MANAGE_CLASSROOM_HANDOFF",
  "CAN_READ_MANAGEMENT_REPORTS",
  "CAN_READ_DELIVERY_HISTORY"
]) {
  assert.match(components, new RegExp(capability), `Roles surface must present ${capability}`);
}

assert.match(components, /previewCompletionAction[\s\S]*app\.openConfirm/, "completion mutations must use explicit preview and confirmation");
assert.match(components, /approvals:\s*\["Assignments and Approvals",\s*"READ-ONLY"/, "Assignments and Approvals must be a read-only authority surface");
assert.match(components, /"data-quality":\s*\["Data Quality",\s*"READ-ONLY"/, "Data Quality must be a read-only authority surface");
assert.match(components, /approvals:\s*"admin_getFodeAssignmentsAndApprovals"/, "Assignments and Approvals must hydrate from its backend RPC");
assert.match(components, /"data-quality":\s*"admin_getFodeDataQuality"/, "Data Quality must hydrate from its backend RPC");
assert.match(workload, /operationalClassification:\s*"FODE Admin staging operations"/, "runtime classification must retain Admin staging");
assert.doesNotMatch([core, components, contracts].join("\n"), /admin_(?:createZohoBooks|sendZohoBooks|setZohoBooks|preflightZohoBooks)|\bClassroomApp\b|\bGmailApp\b|\bMailApp\b/, "completion UI path must expose no external mutation RPC");

console.log("PASS FODE completion UI integration, identity, exact RPC allowlists, and external-write boundary");
