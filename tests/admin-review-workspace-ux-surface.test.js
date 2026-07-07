const fs = require("node:fs");
const assert = require("node:assert/strict");

const source = fs.readFileSync("AdminUI.html", "utf8");

function expectMatch(pattern, message) {
  assert.match(source, pattern, message);
}

function expectNoMatch(pattern, message) {
  assert.doesNotMatch(source, pattern, message);
}

function cssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = source.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\{([^}]*)\\}`, "s"));
  assert.ok(match, `Missing CSS rule: ${selector}`);
  return match[1];
}

function expectReadableHeader(selector) {
  const rule = cssRule(selector);
  expectMatch(new RegExp(`${selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\{[^}]*white-space:normal;`, "s"), `${selector} must wrap modal header text`);
  assert.match(rule, /overflow:visible;/, `${selector} must not hide modal header text`);
  assert.match(rule, /text-overflow:clip;/, `${selector} must not ellipsize modal header text`);
  assert.match(rule, /overflow-wrap:anywhere;/, `${selector} must support long identity values`);
}

function functionSource(name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `Missing function ${name}`);
  const next = source.indexOf("\n    function ", start + 1);
  return source.slice(start, next === -1 ? source.length : next);
}

expectMatch(/reviewIdentityKicker[\s\S]*Applicant Review Workspace/, "Review modal must expose a strong workspace identity header");
expectMatch(/\.modalHead\{[\s\S]*background:#0b1c30;[\s\S]*color:#eef6ff;/, "Review modal header must keep a high-contrast dark identity bar");
expectMatch(/\.reviewHeaderFactLabel\{ color:#e6f2ff;[\s\S]*opacity:1;/, "Review header labels must use explicit readable label class");
expectMatch(/\.reviewHeaderFactValue\{ color:#ffffff;[\s\S]*font-weight:900;[\s\S]*opacity:1;/, "Review header values must use explicit high-contrast value class");
expectReadableHeader(".reviewApplicantName");
expectReadableHeader(".reviewApplicantId");
expectReadableHeader(".reviewHeaderFactValue");
expectNoMatch(/\.reviewHeaderFactValue\{[^}]*opacity:\.(?:[0-9]+)/, "Review header identity values must not use low opacity");
expectNoMatch(/class="(?:k|v)" id="mHeader(?:Email|Phone|Submitted|Stage|Owner|DeliveryHealth|TokenAge)"/, "Review header identity values must not render through generic low-contrast modal value classes");
expectMatch(/id="mApplicantName"/, "Review header must include applicant name");
expectMatch(/id="mApplicantId"/, "Review header must include applicant ID");
expectMatch(/id="mHeaderEmail"[\s\S]*id="mHeaderPhone"[\s\S]*id="mHeaderSubmitted"/, "Review header must include contact and submitted facts");
expectMatch(/id="mHeaderStage"[\s\S]*id="mHeaderOwner"[\s\S]*id="mHeaderTokenAge"/, "Review header must include stage, owner, and token age facts");
expectMatch(/Delivery Health[\s\S]*id="mHeaderDeliveryHealth"/, "Review header must expose reconciled delivery health");
expectMatch(/id="reviewLoadingBanner"[\s\S]*Loading applicant details\.\.\./, "Review modal must show a clean loading banner");
expectMatch(/\.reviewHeaderGrid\.loading\{ display:none; \}/, "Review loading state must hide incomplete identity facts");
expectNoMatch(/id="mHeader(?:Email|Phone|Submitted|Stage|Owner|DeliveryHealth|TokenAge)"[^>]*>-\s*<\/div>/, "Review header markup must not seed fake dash identity facts");
expectNoMatch(/openModalLoading_[\s\S]*setReviewHeaderValue_\("mHeader(?:Email|Phone|Submitted|Stage|Owner|DeliveryHealth|TokenAge)",\s*"-"\)/, "Review loading path must not render fake dash identity facts");
expectMatch(/class="reviewHeaderFactLabel">Email[\s\S]*class="reviewHeaderFactValue" id="mHeaderEmail"/, "Email header fact must use explicit readable classes");
expectMatch(/class="reviewHeaderFactLabel">Phone[\s\S]*class="reviewHeaderFactValue" id="mHeaderPhone"/, "Phone header fact must use explicit readable classes");
expectMatch(/class="reviewHeaderFactLabel">Current Stage[\s\S]*class="reviewHeaderFactValue" id="mHeaderStage"/, "Current Stage header fact must use explicit readable classes");
expectMatch(/<div class="hidden" id="mTitle">Applicant Review<\/div>[\s\S]*<div class="hidden" id="mSub"><\/div>/, "Legacy title/subtitle nodes must remain for compatibility");
expectMatch(/function setReviewHeaderValue_\(/, "Header field updates must use a bounded local DOM setter");
expectMatch(/setReviewHeaderValue_\("mApplicantName", fullName \|\| opsDetailName_\(d\)/, "Loaded modal must bind applicant name from existing detail data");
expectMatch(/setReviewHeaderValue_\("mApplicantId", d\.ApplicantID/, "Loaded modal must bind applicant ID from existing detail data");
expectMatch(/setReviewHeaderValue_\("mHeaderEmail", emailLabel\)/, "Loaded modal must bind effective email label");
expectMatch(/setReviewHeaderValue_\("mHeaderSubmitted", submittedLabel/, "Loaded modal must bind submitted date");
expectMatch(/setReviewHeaderValue_\("mHeaderStage", deriveApplicantDisplayStage\(d\)/, "Loaded modal must bind current display stage");
expectMatch(/function reviewOwnerDisplayLabel_/, "Review owner display must normalize internal sentinel values");
expectMatch(/not_in_loaded_review_queue[\s\S]*Review Workspace \/ Unassigned \/ System-derived/, "Internal queue sentinel must map to operator-facing owner text");
expectMatch(/setReviewHeaderValue_\("mHeaderOwner", ownerLabel\)/, "Loaded modal must bind mapped owner label");
expectMatch(/setReviewHeaderValue_\("mHeaderDeliveryHealth", deliveryHealthLabel\)/, "Loaded modal must bind reconciled delivery health");
expectMatch(/setReviewHeaderValue_\("mHeaderTokenAge", tokenText\)/, "Loaded modal must bind token age");
expectMatch(/function resetReviewModalScroll_/, "Review modal must have an explicit scroll reset helper");
expectMatch(/openModalLoading_[\s\S]*resetReviewModalScroll_\(\)/, "Review modal open must reset scroll before hydration");
expectMatch(/focusActionabilityReviewTarget_[\s\S]*resetReviewModalScroll_\(\)/, "Review actionability focus must not leave the modal scrolled into documents");
assert.doesNotMatch(functionSource("focusActionabilityReviewTarget_"), /scrollIntoView/, "Review focus context must not scroll the modal into lower sections");
expectMatch(/class="kv reviewCardGrid"/, "Primary facts must use balanced review card grid");
expectMatch(/class="box reviewCardWide"[\s\S]*Workflow Fields/, "Workflow fields must be grouped into a wider balanced card");
expectMatch(/class="box reviewPanel" id="communicationsCard"/, "Communications must use the shared review panel rhythm");
expectMatch(/commTemplateCard\.selected\{[^}]*border-color:#1f5aa5[^}]*box-shadow:inset 4px 0 0 #1f5aa5/s, "Selected communication template must have a strong active state");
expectMatch(/\.commTemplateCard \.btn:disabled,[\s\S]*background:#e2eaf2;[\s\S]*border-color:#8da2b7;[\s\S]*color:#26384e;/, "Disabled template preview buttons must remain visible and readable");
expectMatch(/commTemplateSelectedBanner[\s\S]*Selected template/, "Selected communication template card must show explicit selected label");
expectMatch(/Selected template:<\/strong>[\s\S]*previewMeta\.label/, "Communication preview must name the selected template it reflects");
expectMatch(/\.btn:disabled,[\s\S]*background:#e2eaf2;[\s\S]*border-color:#8da2b7;[\s\S]*color:#26384e;/, "Disabled modal buttons must remain visible globally");
expectMatch(/id="btnCommPreview"[\s\S]*>Preview<\/button>/, "Preview button label must remain visible");
expectMatch(/id="btnCommGenerateEditable"[\s\S]*>Generate \/ Preview Email<\/button>/, "Generate / Preview Email button label must remain visible");
expectMatch(/id="btnCommInsertPortalLink"[\s\S]*>Insert Portal Link<\/button>/, "Insert Portal Link button label must remain visible");
expectMatch(/id="btnCommSend"[\s\S]*>Send<\/button>/, "Send button label must remain visible");
expectMatch(/Contactability Gate:[\s\S]*contactGate\.reason[\s\S]*Alternative:/, "Contactability Gate must explain disabled communication controls");
expectMatch(/\.commOverridePanel\{[\s\S]*background:#fff2dc;[\s\S]*color:#704500;/, "Override warning block must use readable dark warning text");
expectMatch(/\.commOverridePanel textarea\{[\s\S]*background:#fff;[\s\S]*color:#102030;/, "Override textarea must remain readable");
expectMatch(/\.modal \.commResultBox\.err\{[\s\S]*color:#8b1f1f;/, "Action blocked/error panel must keep strong readable contrast");
expectMatch(/\.modal #commDebug\{[\s\S]*opacity:\.82;[\s\S]*border-style:dashed;/, "Preview diagnostics must be visually demoted in normal modal flow");
expectMatch(/id="booksDryRunCard" class="box booksDryRunPanel reviewPanel"/, "Books preview must use the shared review panel rhythm");
expectMatch(/id="documentReviewWorkflow" class="reviewDocumentWorkflow reviewPanel"/, "Document verification must use the shared review panel rhythm");
expectMatch(/class="reviewGuidance"[\s\S]*Document saves remain authority-gated/, "Document section must keep concise authority guidance");
expectMatch(/\.modal \.docStatus\{[\s\S]*background:#fff;[\s\S]*color:#102030;[\s\S]*border:1px solid #9fb4ca;/, "Document status dropdowns must use readable light controls");
expectMatch(/\.docComment\{[\s\S]*background:#fff;[\s\S]*color:#102030;[\s\S]*border:1px solid #9fb4ca;/, "Document comments must use readable light controls");
expectMatch(/\.modal \.docStatus:disabled,[\s\S]*\.modal \.docComment:disabled\{[\s\S]*background:#e2eaf2;[\s\S]*color:#26384e;[\s\S]*opacity:1;/, "Disabled document controls must remain readable");
expectMatch(/\.docRecommendation\{[\s\S]*background:#fff;[\s\S]*color:#173451;[\s\S]*font-weight:850;/, "Document recommendation/download guidance must use readable contrast");
expectMatch(/class="docRecommendation" aria-label="Recommendation">Recommended: Download/, "Recommended download text must use the readable recommendation class");
expectMatch(/class="documentReviewActionBar"[\s\S]*Review workflow[\s\S]*id="btnSaveDocs"[\s\S]*Secondary[\s\S]*id="btnRefreshDetails"[\s\S]*id="btnCopyLink"[\s\S]*id="btnResetLink"/, "Footer actions must be grouped into primary review workflow and secondary actions");
expectMatch(/id="btnOpenDocumentGallery"/, "Document gallery entry must remain available");
expectMatch(/id="btnSaveOverall"[\s\S]*onclick="saveOverall\(\)"/, "Overall save workflow must remain wired to existing handler");
expectMatch(/id="btnSaveDocs"[\s\S]*onclick="saveDocs\(\)"/, "Document status save workflow must remain wired to existing handler");
expectMatch(/id="btnResetLink"[\s\S]*onclick="resetPortalLink\(\)"/, "Reset link action must remain wired to existing authority-gated handler");
expectNoMatch(/admin_getApplicantDetailsModern|admin_updateReviewWorkspaceModern/, "Review UX pass must not introduce new review RPCs");

console.log("PASS review workspace benchmark UX surface contract");
