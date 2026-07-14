const fs = require("node:fs");
const assert = require("node:assert/strict");

const adminUi = fs.readFileSync("AdminUI.html", "utf8");
const adminJs = fs.readFileSync("Admin.js", "utf8");
const operatorNextUi = fs.readFileSync("AdminUI_OperatorNext.html", "utf8");

function expectMatch(source, pattern, message) {
  assert.match(source, pattern, message);
}

function expectNoMatch(source, pattern, message) {
  assert.doesNotMatch(source, pattern, message);
}

function sliceBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `Missing ${startNeedle}`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.notEqual(end, -1, `Missing ${endNeedle}`);
  return source.slice(start, end);
}

const component = sliceBetween(adminUi, '<div id="reviewV2Root"', '<!-- Modal -->');
const v2Functions = sliceBetween(adminUi, "var reviewWorkspaceV2State", "function openModalLoading_");
const v2Facts = sliceBetween(adminUi, "function reviewWorkspaceV2Facts_", "function renderReviewWorkspaceV2_");
const v2Render = sliceBetween(adminUi, "function renderReviewWorkspaceV2_", "function renderReviewWorkspaceV2Overview_");
const applicantDetail = sliceBetween(adminJs, "function admin_getApplicantDetail", "function admin_getApplicantDetail_json");

expectMatch(component, /id="reviewV2Root"/, "Review V2 root must exist");
expectMatch(component, /role="dialog" aria-modal="true" aria-labelledby="reviewV2Title"/, "Review V2 must expose dialog semantics");
expectMatch(component, /role="tablist"[\s\S]*role="tab"[\s\S]*role="tabpanel"/, "Review V2 must use accessible tab semantics");
expectMatch(component, /data-review-v2-tab="overview"[\s\S]*data-review-v2-tab="documents"[\s\S]*data-review-v2-tab="finance"[\s\S]*data-review-v2-tab="communications"[\s\S]*data-review-v2-tab="portal"[\s\S]*data-review-v2-tab="audit"/, "Review V2 must expose all required tabs");
expectMatch(component, /reviewV2-header[\s\S]*reviewV2-tabs[\s\S]*reviewV2-main/, "Review V2 tabs must sit directly below the compact header");
expectNoMatch(component, /reviewV2-footer/, "Legacy fallback must not remain a persistent footer");

for (const legacyClass of ["modal", "box", "btn", "k", "v", "small", "muted", "pill"]) {
  expectNoMatch(component, new RegExp(`class="[^"]*\\b${legacyClass}\\b`), `Review V2 must not use legacy .${legacyClass} class`);
}

expectNoMatch(component, /(?:^|\n)\s*(?:label|button|input|select|textarea|table|div|span)\s*\{/, "Review V2 must not introduce global element CSS selectors");
expectMatch(adminUi, /#reviewV2Root \.reviewV2-field/, "Review V2 CSS must be rooted under #reviewV2Root");
expectMatch(adminUi, /#reviewV2Root \.reviewV2-action\[disabled\][\s\S]*opacity:1;/, "Disabled V2 controls must remain readable");

expectMatch(v2Functions, /function openReviewWorkspaceV2\(context\)/, "Review V2 opening contract must exist");
expectMatch(v2Functions, /validateReviewWorkspaceV2Identity_[\s\S]*requestedId[\s\S]*loadedId[\s\S]*requestedId !== loadedId/, "Review V2 must validate exact ApplicantID");
expectMatch(v2Functions, /requestedRow[\s\S]*loadedRow[\s\S]*requestedRow !== loadedRow/, "Review V2 must validate exact row number when available");
expectMatch(adminUi, /renderReviewWorkspaceV2Error_[\s\S]*No applicant was opened/, "Review V2 failures must not silently open a fallback applicant");
expectMatch(adminUi, /openReviewWorkspaceV2\(reviewV2Context\)/, "Current Admin review path must open Review V2");
expectMatch(operatorNextUi, /originSurface:'Operator Next'/, "Operator Next handoff must identify the V2 origin surface");
expectMatch(operatorNextUi, /returnContext:\{route:String\(operatorNextState_\.route/, "Operator Next handoff must preserve return context");

expectMatch(v2Functions, /openReviewWorkspaceV2LegacyFallback_[\s\S]*openModal\(currentDetail\)/, "Legacy fallback must reopen the exact loaded applicant");
expectMatch(v2Functions, /legacyBack\.style\.display = "none"/, "Review V2 must not run both modals visibly at once");
expectMatch(adminUi, /openModal\(currentDetail, \{ populateOnly: true \}\)/, "V2 must populate legacy state without displaying the legacy modal");
expectMatch(adminUi, /function openModal\(d, opts\)/, "Legacy openModal must remain available with compatibility options");

expectMatch(v2Functions, /Save document statuses[\s\S]*saveDocs/, "Document actions must call the existing document save handler");
expectMatch(v2Functions, /Preview Books payload[\s\S]*previewZohoBooksPayloadUi_/, "Finance actions must call the existing Books preview handler");
expectMatch(v2Functions, /Preview communication[\s\S]*reviewWorkspaceV2PreviewCommunication_/, "Communication preview must route through the existing communication handler wrapper");
expectMatch(v2Functions, /reviewWorkspaceV2PreviewCommunication_[\s\S]*previewApplicantMessageUi_/, "Communication preview wrapper must call the existing preview handler");
expectMatch(v2Functions, /Copy portal link[\s\S]*copyPortalLink/, "Portal copy must call the existing portal handler");
expectMatch(v2Functions, /Reset portal link[\s\S]*resetPortalLink/, "Portal reset must call the existing gated reset handler");
expectMatch(v2Functions, /!CAN_SAVE_DOCUMENT_STATUSES/, "Document save capability gate must remain visible in V2");
expectMatch(v2Functions, /!CAN_WRITE_ZOHO_BOOKS/, "Books write capability gate must remain visible in V2");
expectMatch(v2Functions, /!CAN_SEND_INDIVIDUAL_EMAIL/, "Individual send capability gate must remain visible in V2");
expectMatch(v2Functions, /!IS_SUPER/, "Portal reset Super Admin gate must remain visible in V2");

expectMatch(v2Functions, /PAYMENT_PENDING: "Payment pending"/, "Payment pending enum must be human-readable");
expectMatch(v2Functions, /PAYMENT_TO_VERIFY: "Payment to verify"/, "Payment to verify enum must be human-readable");
expectMatch(v2Functions, /PAID_VERIFIED: "Payment verified"/, "Payment verified enum must be human-readable");
expectMatch(v2Functions, /Raw enums intentionally limited to this Audit tab/, "Raw diagnostics must be isolated to Audit");

expectMatch(applicantDetail, /buildActionabilityPreviewRow_\(detailObj,\s*rowNumber\)/, "Applicant detail must reuse the shared actionability projection builder");
expectMatch(applicantDetail, /detailObj\._authorityProjection\s*=\s*\{/, "Applicant detail must attach the shared authority projection DTO for V2");
[
  "workloadGroupKey",
  "worklistKey",
  "worklistReason",
  "nextAction",
  "actionabilityState",
  "selectBlockReason",
  "coolingOffUntil",
  "recommendedMessageType",
  "communicationProgressDetail",
  "canonicalFinanceState",
  "contactabilityState"
].forEach((field) => {
  expectMatch(applicantDetail, new RegExp(field), `Authority projection must carry ${field}`);
});

expectMatch(v2Functions, /function reviewWorkspaceV2Projection_/, "Review V2 must read the shared authority projection DTO");
expectMatch(v2Facts, /reviewWorkspaceV2Projection_\(d\)/, "Review V2 facts must start from the shared authority projection");
expectMatch(v2Facts, /actionabilityPrimaryRouteLabel_\(projection\)/, "Primary route must use Current Admin actionability helper");
expectMatch(v2Facts, /actionabilityNextActionLabel_\(projection\.nextAction\)/, "Next action must use Current Admin actionability helper");
expectMatch(v2Facts, /actionabilityCommsLabel_\(projection\.recommendedMessageType\)/, "Communication recommendation must use Current Admin actionability helper");
expectMatch(v2Facts, /reviewWorkspaceV2FinanceState_\(projection\)/, "Finance state must be derived from the shared projection");
expectMatch(v2Facts, /reviewWorkspaceV2Contactability_\(projection\)/, "Contactability must be derived from the shared projection");
expectMatch(v2Functions, /function reviewWorkspaceV2PngTime_/, "Review V2 must format authority timestamps in PNG time");
expectMatch(v2Functions, /function reviewWorkspaceV2Owner_[\s\S]*ACADEMIC[\s\S]*actionabilityAuthorityLabel_\(projection\)[\s\S]*actionabilityOwnerLabel_/, "Review V2 owner labels must preserve LAP A1 for academic routes and Applicant for applicant-owned routes");
expectNoMatch(v2Facts, /opsPortalDiagnosticsFacts_/, "Review V2 facts must not consume legacy diagnostics as authority");
expectNoMatch(v2Facts, /_authorityDisplay/, "Review V2 facts must not bind directly to reduced authority display when the shared projection is available");

expectMatch(v2Render, /reviewV2CurrentStatus/, "Review V2 compact header must show current authority status");
expectNoMatch(v2Render, /reviewV2RowNumber|reviewV2Owner|reviewV2FinanceState/, "Removed header facts must not be populated by the V2 renderer");
expectNoMatch(v2Render, /Loaded exact applicant|Mutation actions remain delegated/, "Operator-facing V2 status must not expose implementation wording");
expectNoMatch(v2Functions, /Finance authority returned in applicant detail|No contactability status returned|No active blocker returned/, "V2 normal panels must not render diagnostic fallback strings");
expectMatch(v2Functions, /Open Legacy Review/, "Legacy fallback must be available only as an explicit Audit support action");

expectNoMatch(adminUi, /admin_getApplicantDetailsModern|admin_updateReviewWorkspaceModern/, "Review V2 must not introduce parallel review RPCs");
expectNoMatch(v2Functions, /admin_updateDocStatuses|admin_setPortalAccess|admin_sendApplicantMessage\(/, "Review V2 must not introduce direct mutation RPC calls");

console.log("PASS review workspace v2 isolated surface contract");
