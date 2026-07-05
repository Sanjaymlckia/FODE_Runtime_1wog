const fs = require("node:fs");
const assert = require("node:assert/strict");

const source = fs.readFileSync("AdminUI.html", "utf8");

function expectMatch(pattern, message) {
  assert.match(source, pattern, message);
}

function expectNoMatch(pattern, message) {
  assert.doesNotMatch(source, pattern, message);
}

expectMatch(/reviewIdentityKicker[\s\S]*Applicant Review Workspace/, "Review modal must expose a strong workspace identity header");
expectMatch(/id="mApplicantName"/, "Review header must include applicant name");
expectMatch(/id="mApplicantId"/, "Review header must include applicant ID");
expectMatch(/id="mHeaderEmail"[\s\S]*id="mHeaderPhone"[\s\S]*id="mHeaderSubmitted"/, "Review header must include contact and submitted facts");
expectMatch(/id="mHeaderStage"[\s\S]*id="mHeaderOwner"[\s\S]*id="mHeaderTokenAge"/, "Review header must include stage, owner, and token age facts");
expectMatch(/<div class="hidden" id="mTitle">Applicant Review<\/div>[\s\S]*<div class="hidden" id="mSub"><\/div>/, "Legacy title/subtitle nodes must remain for compatibility");
expectMatch(/function setReviewHeaderValue_\(/, "Header field updates must use a bounded local DOM setter");
expectMatch(/setReviewHeaderValue_\("mApplicantName", fullName \|\| opsDetailName_\(d\)/, "Loaded modal must bind applicant name from existing detail data");
expectMatch(/setReviewHeaderValue_\("mApplicantId", d\.ApplicantID/, "Loaded modal must bind applicant ID from existing detail data");
expectMatch(/setReviewHeaderValue_\("mHeaderEmail", emailLabel\)/, "Loaded modal must bind effective email label");
expectMatch(/setReviewHeaderValue_\("mHeaderSubmitted", submittedLabel/, "Loaded modal must bind submitted date");
expectMatch(/setReviewHeaderValue_\("mHeaderStage", deriveApplicantDisplayStage\(d\)/, "Loaded modal must bind current display stage");
expectMatch(/setReviewHeaderValue_\("mHeaderTokenAge", tokenText\)/, "Loaded modal must bind token age");
expectMatch(/class="kv reviewCardGrid"/, "Primary facts must use balanced review card grid");
expectMatch(/class="box reviewCardWide"[\s\S]*Workflow Fields/, "Workflow fields must be grouped into a wider balanced card");
expectMatch(/class="box reviewPanel" id="communicationsCard"/, "Communications must use the shared review panel rhythm");
expectMatch(/commTemplateCard\.selected\{[^}]*border-color:#1f5aa5[^}]*box-shadow:inset 4px 0 0 #1f5aa5/s, "Selected communication template must have a strong active state");
expectMatch(/commTemplateSelectedBanner[\s\S]*Selected template/, "Selected communication template card must show explicit selected label");
expectMatch(/Selected template:<\/strong>[\s\S]*previewMeta\.label/, "Communication preview must name the selected template it reflects");
expectMatch(/id="booksDryRunCard" class="box booksDryRunPanel reviewPanel"/, "Books preview must use the shared review panel rhythm");
expectMatch(/id="documentReviewWorkflow" class="reviewDocumentWorkflow reviewPanel"/, "Document verification must use the shared review panel rhythm");
expectMatch(/class="reviewGuidance"[\s\S]*Document saves remain authority-gated/, "Document section must keep concise authority guidance");
expectMatch(/class="documentReviewActionBar"[\s\S]*Review workflow[\s\S]*id="btnSaveDocs"[\s\S]*Secondary[\s\S]*id="btnRefreshDetails"[\s\S]*id="btnCopyLink"[\s\S]*id="btnResetLink"/, "Footer actions must be grouped into primary review workflow and secondary actions");
expectMatch(/id="btnOpenDocumentGallery"/, "Document gallery entry must remain available");
expectMatch(/id="btnSaveOverall"[\s\S]*onclick="saveOverall\(\)"/, "Overall save workflow must remain wired to existing handler");
expectMatch(/id="btnSaveDocs"[\s\S]*onclick="saveDocs\(\)"/, "Document status save workflow must remain wired to existing handler");
expectMatch(/id="btnResetLink"[\s\S]*onclick="resetPortalLink\(\)"/, "Reset link action must remain wired to existing authority-gated handler");
expectNoMatch(/admin_getApplicantDetailsModern|admin_updateReviewWorkspaceModern/, "Review UX pass must not introduce new review RPCs");

console.log("PASS review workspace benchmark UX surface contract");
