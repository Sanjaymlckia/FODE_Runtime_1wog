const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function read(file) { return fs.readFileSync(file, "utf8"); }

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const code = read("Code.js");
const commands = read("EduOps_Commands.js");
const workbench = read("EduOps_ClientWorkbench.html");
const batch = read("EduOps_ClientBatch.html");
const selected = read("Admin_SelectedApplicantCommunications.js");

assert.match(code, /function normalizePortalSecretStatus_[\s\S]*ACTIVE/, "portal secret status must normalize Active/ACTIVE to ACTIVE");
assert.match(code, /PORTAL_RECORD_MISMATCH/, "provider must reject cached portal records for the wrong applicant");
assert.match(code, /function communicationRenderFinalBody_[\s\S]*communicationApplyMandatoryPolicyBlocks_[\s\S]*communicationRenderTemplateText_/, "final body render must apply policy blocks before final merge-field rendering");
assert.match(code, /previewSubject = communicationRenderTemplateText_\(previewSubject, context\);[\s\S]*previewBody = communicationRenderFinalBody_\(context, previewBody\);/, "individual preview must final-render edited subject/body before validation");
assert.match(code, /editedSubject = communicationRenderTemplateText_\(editedSubject, context\);[\s\S]*editedBody = communicationRenderFinalBody_\(context, editedBody\);/, "individual send must repeat final rendering before execution");
assert.match(commands, /statusReason:[\s\S]*authorityPreview[\s\S]*blockReason[\s\S]*blockCode/, "EduOps preview must surface exact Communication Authority block details");
assert.match(commands, /portalLinkRequired:/, "EduOps preview must carry portal-required diagnostics");
assert.match(commands, /portalLinkHydrated:/, "EduOps preview must carry portal-hydrated diagnostics");
assert.match(commands, /unresolvedToken:/, "EduOps preview must carry unresolved-token diagnostics");
assert.match(workbench, /Portal link required:/, "operator blocked-preview status must show portal requirement diagnostics");
assert.match(workbench, /not hydrated/, "operator blocked-preview status must show failed hydration state");
assert.match(workbench, /Unresolved:/, "operator blocked-preview status must show unresolved-token diagnostics");
assert.match(selected, /var renderedSubject = communicationRenderTemplateText_\(built\.subject[\s\S]*var renderedBody = communicationRenderFinalBody_\(context, built\.body/, "selected batch preview must display final-rendered recipient body");
assert.match(batch, /formatPngDate\(preview\.expiresAt\)[\s\S]*Expiry \(ISO\)[\s\S]*formatPngDate\(batch\.preview\.expiresAt\)/, "batch preview and confirmation dates must use PNG-local display with ISO diagnostics");

const ctx = {
  clean_: value => String(value == null ? "" : value).trim(),
  normalizeApplicantMessageType_: value => String(value == null ? "" : value).trim(),
  resolvePortalCommunicationSecret_: id => ({ ok: true, applicantId: id, status: "ACTIVE", secretPlain: `token-${id}` }),
  buildPortalCommunicationUrl_: (id, token) => `https://student.example/exec?view=portal&id=${encodeURIComponent(id)}&s=${encodeURIComponent(token)}`,
  communicationPortalInstructionBlock_: c => `Secure portal link:\n{{portal_url}}\nApplicant {{applicant_id}}`,
  communicationShouldApplyUnderReviewNoPaymentNotice_: () => false,
  communicationShouldApplyDocumentVerificationCaution_: () => false,
  communicationUnderReviewNoPaymentNotice_: () => "NO_PAYMENT",
  communicationDocumentVerificationCaution_: () => "DOC_CAUTION",
  customEmailOperatorPrompt_: () => "[Write your message here",
  communicationUnresolvedTokens_: (subject, body) => (String(subject || "") + "\n" + String(body || "")).match(/\{\{[^}]+\}\}|\[ACTION REQUIRED:[^\]]+\]|\[Write your message here/g) || []
};
vm.createContext(ctx);
[
  "normalizePortalSecretStatus_",
  "resolveExistingStudentPortalAuthority_",
  "communicationRenderTemplateText_",
  "communicationApplyMandatoryPolicyBlocks_",
  "communicationRenderFinalBody_",
  "communicationValidateRenderedContent_"
].forEach(name => vm.runInContext(extractFunction(code, name), ctx));

const albert = ctx.resolveExistingStudentPortalAuthority_("FODE-26-000006");
assert.equal(albert.available, true, "Albert-style ACTIVE portal record must resolve");
assert.equal(albert.tokenState, "ACTIVE");
assert.match(albert.portalUrl, /FODE-26-000006/, "secure URL must be applicant-specific");
assert.equal(Object.prototype.hasOwnProperty.call(albert, "secretPlain"), false, "provider must not expose plain token");

const mismatch = ctx.resolveExistingStudentPortalAuthority_("FODE-26-000006", {
  secretRecord: { ok: true, applicantId: "FODE-26-OTHER", status: "ACTIVE", secretPlain: "token" },
  statusRequired: true
});
assert.equal(mismatch.available, false);
assert.equal(mismatch.reasonCode, "PORTAL_RECORD_MISMATCH");

const inactive = ctx.resolveExistingStudentPortalAuthority_("FODE-26-000006", {
  secretRecord: { ok: true, applicantId: "FODE-26-000006", status: "Inactive", secretPlain: "token" },
  statusRequired: true
});
assert.equal(inactive.available, false);
assert.equal(inactive.reasonCode, "PORTAL_SECRET_INACTIVE");

const finalBody = ctx.communicationRenderFinalBody_({
  requiresPortalUrl: true,
  portalUrl: albert.portalUrl,
  applicantId: "FODE-26-000006",
  rowObj: { Name: "Albert Tapu" }
}, "Edited missing-documents message without an explicit link.");
assert.match(finalBody, /https:\/\/student\.example\/exec/);
assert.doesNotMatch(finalBody, /\{\{portal_url\}\}/);
assert.doesNotMatch(finalBody, /\{\{applicant_id\}\}/);
assert.equal(ctx.communicationValidateRenderedContent_("Subject", finalBody).ok, true);

const a = ctx.resolveExistingStudentPortalAuthority_("A-1").portalUrl;
const b = ctx.resolveExistingStudentPortalAuthority_("B-2").portalUrl;
assert.notEqual(a, b, "batch recipients must receive distinct portal URLs");

console.log("PASS R376G portal hydration ordering, exact diagnostics, and PNG dates");
