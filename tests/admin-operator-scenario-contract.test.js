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

function functionSource(name) {
  const start = adminUi.indexOf(`function ${name}(`);
  assert.ok(start >= 0, `Missing function ${name}`);
  const next = adminUi.indexOf("\n    function ", start + 1);
  return adminUi.slice(start, next >= 0 ? next : adminUi.length);
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
mustMatch(adminJs, /function resolveActionabilityState_/, "Selection scenario must use server-side Actionability Resolver");
mustMatch(adminJs, /COOLING_OFF[\s\S]*COOLDOWN_ACTIVE/, "Cooling-off rows must be explicitly classified before batch preview");
mustMatch(adminUi, /function actionabilityIsSelectable_/, "Selection scenario must have a single client helper for server selectable state");
mustMatch(adminUi, /if \(!actionabilityIsSelectable_\(row\)\) return;/, "Select Visible/All must leave non-READY rows unselected");
mustMatch(adminUi, /READY rows selected/, "Selection scenario must explain that auto-selection uses READY rows only");
mustMatch(adminUi, /selectBlockReason/, "Disabled row selection must expose the server-provided reason");
mustMatch(adminUi, /Total selected[\s\S]*Contactable[\s\S]*No email/, "Selection scenario must expose cohort summary counts");
mustMatch(adminUi, /const ACTIONABILITY_PAGE_SIZE = 10/, "Selection scenario must paginate the worklist at 10 rows");
mustMatch(adminUi, /Showing " \+ String\(Number\(meta\.start \|\| 0\) \+ 1\) \+ "-" \+ String\(Number\(meta\.end/, "Selection scenario must show visible page range");
mustMatch(adminUi, /Current page selection/, "Select Visible scenario must identify current-page cohort source");
mustMatch(adminUi, /Full Bounded Cohort/, "Select All scenario must identify full bounded cohort source");

mustMatch(adminUi, /id="standaloneBatchCommModalBack"/, "Batch communication scenario must open a dedicated standalone modal");
mustMatch(adminUi, /id="standaloneBatchCommModalBack" class="modalBack standaloneBatchCommBack"/, "Batch communication scenario must render an actual standalone modal container");
mustMatch(adminUi, /\.standaloneBatchCommBack\.open\{ display:flex; \}/, "Batch communication scenario must visibly display the standalone modal");
mustMatch(adminUi, /standaloneBatchCommModalBack[\s\S]*back\.classList\.add\("open"\)[\s\S]*back\.style\.display = "flex"/, "Batch communication scenario must open the standalone modal every time");
mustMatch(adminUi, /BLOCKED: Batch Communication modal container is missing/, "Batch communication scenario must show a blocked reason instead of failing silently");
mustMatch(adminUi, /id="standaloneBatchCommTemplateGallery"/, "Batch communication scenario must show the template gallery inside the modal");
mustMatch(adminUi, /Selected template[\s\S]*Recommended/, "Batch communication scenario must highlight the recommended template");
mustMatch(adminUi, /Recipient count/, "Batch communication scenario must show recipient count");
mustMatch(adminUi, /id="btnStandaloneBatchCommPreview"[\s\S]*>Generate Preview<\/button>[\s\S]*id="btnStandaloneBatchCommSend"[\s\S]*onclick="requestBatchCommunicationConfirmation_\(\)"[\s\S]*>Review Send<\/button>/, "Batch communication scenario must expose generate preview and in-app confirmation flow");
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
mustMatch(adminUi, /id="standaloneBatchCommConfirm"/, "Batch modal must render an in-app confirmation panel");
mustMatch(adminUi, /batchCommWorkflow[\s\S]*Template[\s\S]*Preview[\s\S]*Recipients[\s\S]*Confirm[\s\S]*Send/, "Batch modal must show the workflow checklist");
mustMatch(adminUi, /commTemplateOtherBanner[\s\S]*Other option/, "Batch modal must mark non-recommended templates as other options");
mustMatch(adminUi, /Excluded \/ Blocked/, "Batch modal summary must expose exclusions and blocked records");
mustMatch(adminUi, /This action will immediately send[\s\S]*emails[\s\S]*<strong>Template<\/strong>[\s\S]*<strong>Recipients<\/strong>[\s\S]*<strong>Cap<\/strong>[\s\S]*<strong>Authority<\/strong>/, "Batch modal confirmation must name template, recipient count, cap, and authority");
mustMatch(adminUi, /Send ' \+ esc\(recipients\) \+ ' Emails/, "Batch modal confirmation button must use the exact send count");
mustNotMatch(functionSource("sendBatchCommunicationModal_"), /window\.confirm/, "Batch modal must not use browser-native confirmation");
mustMatch(functionSource("batchCommCanSend_"), /sendResult[\s\S]*ok !== false[\s\S]*return false/, "Batch modal must disable repeat sends after completion");
mustMatch(functionSource("handleBatchCommSendResult_"), /previewStale = true[\s\S]*refreshActionabilityAfterBatchSend_\("send_success"\)/, "Batch modal must invalidate preview and delegate post-send worklist refresh through the shared helper");
mustMatch(functionSource("refreshActionabilityAfterBatchSend_"), /loadActionabilityPreview_\(\{[\s\S]*force: true/, "Post-send batch refresh helper must force a server-derived actionability reload");
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
