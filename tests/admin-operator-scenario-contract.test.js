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
mustMatch(adminUi, /actionabilityBucketHiddenPanel[\s\S]*Hidden ' \+ esc\(hiddenCount\)/, "Hidden bucket scenario must provide embedded Hidden count control");
mustMatch(adminUi, /Switch Filter/, "Hidden bucket scenario must provide Switch Filter");
mustMatch(adminUi, /Open Applicant/, "Hidden bucket scenario must provide Open Applicant");
mustMatch(adminUi, /Explain Only/, "Hidden bucket scenario must provide Explain Only fallback");
mustNotMatch(adminUi, />\s*1 hidden by current filter\s*</, "Hidden bucket scenario must not end at useless text");

mustMatch(adminUi, /function selectVisibleActionabilityRows_/, "Selection scenario must support Select Visible");
mustMatch(adminUi, /function selectAllActionabilityRows_/, "Selection scenario must support bounded Select All");
mustMatch(adminUi, /function clearActionabilitySelection_/, "Selection scenario must support Clear Selection");
mustMatch(adminUi, /Total selected[\s\S]*Contactable[\s\S]*No email/, "Selection scenario must expose cohort summary counts");
mustMatch(adminUi, /const ACTIONABILITY_PAGE_SIZE = 10/, "Selection scenario must paginate the worklist at 10 rows");
mustMatch(adminUi, /Showing " \+ String\(Number\(meta\.start \|\| 0\) \+ 1\) \+ "-" \+ String\(Number\(meta\.end/, "Selection scenario must show visible page range");
mustMatch(adminUi, /Current page selection/, "Select Visible scenario must identify current-page cohort source");
mustMatch(adminUi, /Full Bounded Cohort/, "Select All scenario must identify full bounded cohort source");

mustMatch(adminUi, /id="batchCommModalBack"/, "Batch communication scenario must open a dedicated modal");
mustMatch(adminUi, /id="batchCommModalBack" class="modalBack"/, "Batch communication scenario must render an actual modal container");
mustMatch(adminUi, /back\.classList\.add\("open"\)/, "Batch communication scenario must visibly open the modal");
mustMatch(adminUi, /id="batchCommTemplateGallery"/, "Batch communication scenario must show the template gallery inside the modal");
mustMatch(adminUi, /Selected template[\s\S]*Recommended/, "Batch communication scenario must highlight the recommended template");
mustMatch(adminUi, /Recipient count/, "Batch communication scenario must show recipient count");
mustMatch(adminUi, /id="btnBatchCommPreview"[\s\S]*>Preview<\/button>[\s\S]*id="btnBatchCommSend"[\s\S]*>Send Batch<\/button>/, "Batch communication scenario must expose preview and confirm flow");
mustNotMatch(adminUi, /Batch Communication Handoff|Batch Reminder Handoff/, "Batch communication scenario must not stop at a handoff panel");
mustNotMatch(adminUi, /Open first eligible in Review/, "Batch communication scenario must not route multi-applicant cohorts through Review");
mustNotMatch(adminUi, /function actionabilityBatchCommunication_[\s\S]{0,700}admin_sendApplicantMessage/, "Batch modal must not create a single-applicant send path");
mustMatch(adminUi, /admin_previewSelectedApplicantBatch/, "Selected cohorts must use the selected batch preview wrapper");
mustMatch(adminUi, /admin_sendSelectedApplicantBatch/, "Selected cohorts must use the selected batch send wrapper");
mustNotMatch(adminUi, /function sendBatchCommunicationModal_[\s\S]*admin_sendApplicantMessage/, "Batch modal must not route through the single-applicant Review RPC");
mustMatch(adminUi, /onclick="openBatchCommunicationFromStage_\(\)">Open Batch Communication/, "Stage cohort scenario must open the Batch Communication modal as the primary path");
mustNotMatch(adminUi, /Confirm in Batch Modal/, "Stage batch scenario must not expose a competing inline confirmation path");
mustMatch(adminUi, /Default batch size: 30\. Larger batches may be restricted by send policy\./, "Batch scenario must explain the 30-row default and policy cap");
mustNotMatch(adminUi, /id="(?:opsStageBatchLimit|stageBatchLimit)"[^>]*value="50"/, "Batch scenario must not default to 50-row production batches");
mustMatch(adminUi, /ids\.length === 1[\s\S]*Single applicant selected[\s\S]*Review Workspace communication flow/, "Single applicant scenario must route operators to the single-recipient Review path");
mustMatch(adminUi, /!ids\.length[\s\S]*Select at least two applicants/, "No-cohort scenario must provide clear guidance instead of opening an empty batch modal");
mustMatch(adminUi, /Recipients[\s\S]*Valid email[\s\S]*Blocked[\s\S]*Missing email[\s\S]*Excluded/, "Batch modal must reconcile recipient readiness counts");
["Preview required", "Ready to Send", "Sending", "Completed", "Failed / Partial"].forEach((label) => {
  mustMatch(adminUi, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Batch modal must expose send lifecycle state: ${label}`);
});
mustMatch(adminUi, /You are about to send [\s\S]* to [\s\S]* applicants/, "Batch modal confirmation must name template and recipient count");
mustMatch(adminUi, /Technical Diagnostics/, "Batch modal diagnostics must remain available but separated");

mustMatch(adminUi, /function commContactabilityGate_/, "Contactability Gate scenario must be first-class");
mustMatch(adminUi, /Email workflow unavailable/, "Contactability Gate must suppress normal email workflow");
mustMatch(adminUi, /Email preview disabled by Contactability Gate/, "Contactability Gate must visibly disable preview");
mustMatch(adminUi, /Contactability Gate:[\s\S]*Alternative:/, "Contactability Gate must explain reason and alternative path");

mustMatch(adminUi, /\.btn:disabled,[\s\S]*background:#e2eaf2;[\s\S]*border-color:#8da2b7;[\s\S]*color:#26384e;/, "Disabled buttons must remain readable");
["btnCommPreview", "btnCommGenerateEditable", "btnCommInsertPortalLink", "btnCommSend"].forEach((id) => {
  mustMatch(adminUi, new RegExp(`id="${id}"[\\s\\S]*>[^<]+<\\/button>`), `${id} must keep a visible label`);
});

mustMatch(adminUi, /All Required Missing/, "Document scenario must show all-required-missing state");
mustMatch(adminUi, /\d|uploadedRequiredDocumentCount[\s\S]*requiredDocumentCount/, "Document scenario must use uploaded/required evidence");
mustMatch(adminUi, /Required Complete/, "Document scenario must show complete state");
mustMatch(adminUi, /Missing Documents:<\/strong>/, "Document scenario details must name missing documents");
mustNotMatch(adminUi, /"Docs Missing"/, "Document scenario must not use the old ambiguous Docs Missing fallback");
mustMatch(adminUi, /Document State Unknown/, "Document scenario must use an honest unknown-state fallback");

mustMatch(adminUi, /Priority \/ Next/, "Timing scenario must use honest Priority / Next label");
mustNotMatch(adminUi, /Due \/ Next/, "Timing scenario must not imply unsupported due-date scheduling");

console.log("PASS operator scenario contract");
