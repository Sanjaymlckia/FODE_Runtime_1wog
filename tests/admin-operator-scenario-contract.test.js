const fs = require("node:fs");
const assert = require("node:assert/strict");

const adminUi = fs.readFileSync("AdminUI.html", "utf8");
const adminJs = fs.readFileSync("Admin.js", "utf8");

function mustMatch(source, pattern, message) {
  assert.match(source, pattern, message);
}

function mustNotMatch(source, pattern, message) {
  assert.doesNotMatch(source, pattern, message);
}

mustMatch(adminJs, /function buildActionabilityHiddenRecords_/, "Hidden Records DTO must exist");
mustMatch(adminJs, /applicantId:[\s\S]*name:[\s\S]*currentStage:[\s\S]*currentBucket:[\s\S]*hiddenReason:[\s\S]*suggestedAction:/, "Hidden records must expose identity, stage, bucket, reason, and action");
mustMatch(adminUi, /function actionabilityHiddenPanel_/, "Hidden bucket scenario must render a drill-down");
mustMatch(adminUi, /Show Hidden:/, "Hidden bucket scenario must provide Show Hidden");
mustMatch(adminUi, /Switch Filter/, "Hidden bucket scenario must provide Switch Filter");
mustMatch(adminUi, /Open Applicant/, "Hidden bucket scenario must provide Open Applicant");
mustMatch(adminUi, /Explain Only/, "Hidden bucket scenario must provide Explain Only fallback");
mustNotMatch(adminUi, />\s*1 hidden by current filter\s*</, "Hidden bucket scenario must not end at useless text");

mustMatch(adminUi, /function selectVisibleActionabilityRows_/, "Selection scenario must support Select Visible");
mustMatch(adminUi, /function selectAllActionabilityRows_/, "Selection scenario must support bounded Select All");
mustMatch(adminUi, /function clearActionabilitySelection_/, "Selection scenario must support Clear Selection");
mustMatch(adminUi, /Total selected[\s\S]*Contactable[\s\S]*No email/, "Selection scenario must expose cohort summary counts");

mustMatch(adminUi, /Batch Communication Handoff/, "Batch communication scenario must open a handoff panel");
mustMatch(adminUi, /Recommended templates/, "Batch handoff must expose recommended templates");
mustMatch(adminUi, /Blocked reasons/, "Batch handoff must expose blocked reasons");
mustMatch(adminUi, /Recommended next action/, "Batch handoff must expose next safe action");
mustNotMatch(adminUi, /function actionabilityBatchCommunication_[\s\S]{0,700}admin_sendApplicantMessage/, "Batch handoff must not create a send path");

mustMatch(adminUi, /function commContactabilityGate_/, "Contactability Gate scenario must be first-class");
mustMatch(adminUi, /Email workflow unavailable/, "Contactability Gate must suppress normal email workflow");
mustMatch(adminUi, /Email preview disabled by Contactability Gate/, "Contactability Gate must visibly disable preview");
mustMatch(adminUi, /Contactability Gate:[\s\S]*Alternative:/, "Contactability Gate must explain reason and alternative path");

mustMatch(adminUi, /\.btn:disabled,[\s\S]*background:#eef2f6;[\s\S]*color:#52677d;/, "Disabled buttons must remain readable");
["btnCommPreview", "btnCommGenerateEditable", "btnCommInsertPortalLink", "btnCommSend"].forEach((id) => {
  mustMatch(adminUi, new RegExp(`id="${id}"[\\s\\S]*>[^<]+<\\/button>`), `${id} must keep a visible label`);
});

mustMatch(adminUi, /All Required Missing/, "Document scenario must show all-required-missing state");
mustMatch(adminUi, /\d|uploadedRequiredDocumentCount[\s\S]*requiredDocumentCount/, "Document scenario must use uploaded/required evidence");
mustMatch(adminUi, /Required Complete/, "Document scenario must show complete state");
mustMatch(adminUi, /Missing Documents:<\/strong>/, "Document scenario details must name missing documents");

mustMatch(adminUi, /Priority \/ Next/, "Timing scenario must use honest Priority / Next label");
mustNotMatch(adminUi, /Due \/ Next/, "Timing scenario must not imply unsupported due-date scheduling");

console.log("PASS operator scenario contract");
