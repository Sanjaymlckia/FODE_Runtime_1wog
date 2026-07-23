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

const core = read("EduOps_ClientCore.html");
const workbench = read("EduOps_ClientWorkbench.html");
const adapter = read("EduOps_FODE_Adapter.js");
const code = read("Code.js");

assert.match(core, /app\.clean = function \(value\) \{ return String\(value == null \? "" : value\)\.trim\(\); \};/, "shared client normalizer must exist");
assert.equal((workbench.match(/app\.clean\(/g) || []).length, 2, "Documents tab may use the one shared client normalizer");
assert.match(core, /app\.formatPngDate = function[\s\S]*Pacific\/Port_Moresby[\s\S]*formatToParts/, "shared PNG-local date formatter must be deterministic");
assert.match(workbench, /formatPngDate\(receipt\.at\)[\s\S]*formatPngDate\(preview\.expiresAt\)/, "receipt and preview dates must use the shared formatter");

assert.match(code, /function resolveExistingStudentPortalAuthority_[\s\S]*available:[\s\S]*applicantId:[\s\S]*portalUrl:[\s\S]*tokenState:[\s\S]*reasonCode:[\s\S]*reason:/, "portal provider must return the bounded authority DTO");
assert.match(code, /resolveExistingStudentPortalAuthority_\(context\.applicantId/, "communication context must use the shared portal provider");
assert.match(code, /text\.replace\(\/\\\{\\\{\\s\*portal_url/, "server policy must hydrate an edited portal merge token");
assert.match(code, /context\.requiresPortalUrl === true[\s\S]*text\.indexOf\(portalUrl\) < 0[\s\S]*communicationPortalInstructionBlock_/, "server policy must restore a required portal link omitted by edited content");
assert.match(adapter, /resolveExistingStudentPortalAuthority_\(applicantId\)[\s\S]*eduopsPortalSummary_\(portalAuthority\)/, "Workbench Portal tab must consume the shared read-only authority projection");

const portalContext = {
  clean_: value => String(value == null ? "" : value).trim(),
  resolvePortalCommunicationSecret_: id => ({ ok: true, applicantId: id, status: "Active", secretPlain: `secret-${id}` }),
  buildPortalCommunicationUrl_: (id, secret) => `https://student.example/exec?view=portal&id=${id}&s=${secret}`
};
vm.createContext(portalContext);
vm.runInContext(extractFunction(code, "normalizePortalSecretStatus_"), portalContext);
vm.runInContext(extractFunction(code, "resolveExistingStudentPortalAuthority_"), portalContext);
const portalA = portalContext.resolveExistingStudentPortalAuthority_("A-1");
const portalB = portalContext.resolveExistingStudentPortalAuthority_("B-2");
assert.equal(portalA.available, true);
assert.equal(portalA.applicantId, "A-1");
assert.notEqual(portalA.portalUrl, portalB.portalUrl, "batch recipients must resolve distinct applicant URLs");
assert.equal(Object.prototype.hasOwnProperty.call(portalA, "secretPlain"), false, "provider must not expose the token separately");
const missingPortal = portalContext.resolveExistingStudentPortalAuthority_("A-1", { secretRecord: null });
assert.equal(missingPortal.available, false);
assert.equal(missingPortal.reasonCode, "PORTAL_LINK_UNAVAILABLE");

const policyContext = {
  clean_: value => String(value == null ? "" : value).trim(),
  communicationPortalInstructionBlock_: ctx => `Use the secure portal.\n${ctx.portalUrl}`,
  communicationShouldApplyUnderReviewNoPaymentNotice_: () => false,
  communicationShouldApplyDocumentVerificationCaution_: () => false,
  communicationUnderReviewNoPaymentNotice_: () => "NO_PAYMENT",
  communicationDocumentVerificationCaution_: () => "DOCUMENT_CAUTION"
};
vm.createContext(policyContext);
vm.runInContext(extractFunction(code, "communicationApplyMandatoryPolicyBlocks_"), policyContext);
const hydrated = policyContext.communicationApplyMandatoryPolicyBlocks_({ requiresPortalUrl: true, portalUrl: portalA.portalUrl }, "Continue at {{portal_url}}");
assert.equal(hydrated, `Continue at ${portalA.portalUrl}`);
const restored = policyContext.communicationApplyMandatoryPolicyBlocks_({ requiresPortalUrl: true, portalUrl: portalA.portalUrl }, "Edited message core");
assert.match(restored, new RegExp(portalA.portalUrl.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
assert.equal(policyContext.communicationApplyMandatoryPolicyBlocks_({ requiresPortalUrl: false, portalUrl: portalA.portalUrl }, "Unrelated message"), "Unrelated message");

assert.match(code, /var readBackIndex = communicationReadTemplateVariantIndex_\(\)[\s\S]*communicationLoadActiveTemplateVariant_\(templateId, versionId\)/, "template save must read back index and version in the same RPC cycle");
assert.match(code, /REUSABLE_TEMPLATE_READBACK_FAILED/, "template read-back mismatch must fail closed");
assert.match(code, /active: true, readBackVerified: true/, "successful save response must prove active read-back");
assert.match(workbench, /function refreshWorkbenchAfterTemplateSave[\s\S]*eduops_getApplicantWorkbench[\s\S]*communicationTemplateById\(saveResult\.templateId[\s\S]*applyCommunicationTemplate\(saved\)/, "successful save must refresh and auto-select the saved variant");
assert.match(workbench, /Reusable template saved and selected:[\s\S]*result\.templateId[\s\S]*result\.versionId/, "operator success must identify template and version");

console.log("PASS R376F Documents runtime, portal authority, reusable template persistence, and PNG dates");
