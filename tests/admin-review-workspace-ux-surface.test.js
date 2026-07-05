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
expectMatch(/\.modalHead\{[\s\S]*background:#0b1c30;[\s\S]*color:#eef6ff;/, "Review modal header must keep a high-contrast dark identity bar");
expectMatch(/\.reviewHeaderFact \.k\{ color:#c8dcf0;[\s\S]*\.reviewHeaderFact \.v\{ color:#ffffff;[\s\S]*font-weight:900;/, "Review header labels and values must remain readable");
expectMatch(/id="mApplicantName"/, "Review header must include applicant name");
expectMatch(/id="mApplicantId"/, "Review header must include applicant ID");
expectMatch(/id="mHeaderEmail"[\s\S]*id="mHeaderPhone"[\s\S]*id="mHeaderSubmitted"/, "Review header must include contact and submitted facts");
expectMatch(/id="mHeaderStage"[\s\S]*id="mHeaderOwner"[\s\S]*id="mHeaderTokenAge"/, "Review header must include stage, owner, and token age facts");
expectMatch(/Delivery Health[\s\S]*id="mHeaderDeliveryHealth"/, "Review header must expose reconciled delivery health");
expectMatch(/<div class="hidden" id="mTitle">Applicant Review<\/div>[\s\S]*<div class="hidden" id="mSub"><\/div>/, "Legacy title/subtitle nodes must remain for compatibility");
expectMatch(/function setReviewHeaderValue_\(/, "Header field updates must use a bounded local DOM setter");
expectMatch(/setReviewHeaderValue_\("mApplicantName", fullName \|\| opsDetailName_\(d\)/, "Loaded modal must bind applicant name from existing detail data");
expectMatch(/setReviewHeaderValue_\("mApplicantId", d\.ApplicantID/, "Loaded modal must bind applicant ID from existing detail data");
expectMatch(/setReviewHeaderValue_\("mHeaderEmail", emailLabel\)/, "Loaded modal must bind effective email label");
expectMatch(/setReviewHeaderValue_\("mHeaderSubmitted", submittedLabel/, "Loaded modal must bind submitted date");
expectMatch(/setReviewHeaderValue_\("mHeaderStage", deriveApplicantDisplayStage\(d\)/, "Loaded modal must bind current display stage");
expectMatch(/setReviewHeaderValue_\("mHeaderDeliveryHealth", deliveryHealthLabel\)/, "Loaded modal must bind reconciled delivery health");
expectMatch(/setReviewHeaderValue_\("mHeaderTokenAge", tokenText\)/, "Loaded modal must bind token age");
expectMatch(/class="kv reviewCardGrid"/, "Primary facts must use balanced review card grid");
expectMatch(/class="box reviewCardWide"[\s\S]*Workflow Fields/, "Workflow fields must be grouped into a wider balanced card");
expectMatch(/class="box reviewPanel" id="communicationsCard"/, "Communications must use the shared review panel rhythm");
expectMatch(/commTemplateCard\.selected\{[^}]*border-color:#1f5aa5[^}]*box-shadow:inset 4px 0 0 #1f5aa5/s, "Selected communication template must have a strong active state");
expectMatch(/\.commTemplateCard \.btn:disabled,[\s\S]*background:#eef2f6;[\s\S]*color:#40556b;/, "Disabled template preview buttons must remain visible and readable");
expectMatch(/commTemplateSelectedBanner[\s\S]*Selected template/, "Selected communication template card must show explicit selected label");
expectMatch(/Selected template:<\/strong>[\s\S]*previewMeta\.label/, "Communication preview must name the selected template it reflects");
expectMatch(/\.commOverridePanel\{[\s\S]*background:#fff2dc;[\s\S]*color:#704500;/, "Override warning block must use readable dark warning text");
expectMatch(/\.commOverridePanel textarea\{[\s\S]*background:#fff;[\s\S]*color:#102030;/, "Override textarea must remain readable");
expectMatch(/\.modal \.commResultBox\.err\{[\s\S]*color:#8b1f1f;/, "Action blocked/error panel must keep strong readable contrast");
expectMatch(/\.modal #commDebug\{[\s\S]*opacity:\.82;[\s\S]*border-style:dashed;/, "Preview diagnostics must be visually demoted in normal modal flow");
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
