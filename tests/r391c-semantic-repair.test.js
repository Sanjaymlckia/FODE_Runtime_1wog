const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

function read(path) {
  return fs.readFileSync(path, "utf8");
}

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  let depth = 0;
  let opened = false;
  for (let i = start; i < source.length; i += 1) {
    const ch = source[i];
    if (ch === "{") {
      depth += 1;
      opened = true;
    } else if (ch === "}") {
      depth -= 1;
      if (opened && depth === 0) return source.slice(start, i + 1);
    }
  }
  throw new Error(`Unable to extract ${name}`);
}

const admin = read("Admin.js");
const code = read("Code.js");
const access = read("Admin_AccessControl.js");
const commands = read("EduOps_Commands.js");
const workload = read("EduOps_Workload.js");
const components = read("EduOps_ClientComponents.html");
const eduopsHtml = read("EduOps.html");

assert.match(admin, /Compatibility communication cadence requires manual review/, "Communication Review wording must not claim durable successful cycles");
assert.match(code, /Compatibility communication cadence requires manual review before another send/, "Communication block reason must label compatibility cadence");
assert.doesNotMatch(admin + code, /Two successful communication cycles are complete/, "Active communication review wording must not overstate durable send evidence");

assert.match(admin, /suppressor === "NO_EFFECTIVE_EMAIL" \|\| suppressor === "EMAIL_BLOCKED_OR_BOUNCED"[\s\S]*CONTACTABILITY_EXCEPTION/, "Contactability suppressors must route before document follow-up");

assert.match(workload, /Payment evidence verified/, "Finance evidence action must not be labelled as payment settlement");
assert.doesNotMatch(workload, /label: "Payment verified"/, "Workbench Finance option must not say Payment verified");
assert.match(components, /Paid state verified/, "Finance summary must distinguish paid-state authority from generic payment wording");

assert.match(workload, /displayedPageCount[\s\S]*batchSelectableOnPage[\s\S]*batchUnavailableOnPage[\s\S]*batchSelectableMatched[\s\S]*batchBlockedMatched/, "Workload selection DTO must expose corrected Batch-specific names");
assert.match(workload, /compatibilityFields:\s*\["visibleSelectable", "visibleBlocked", "totalAuthoritySelectable", "totalAuthorityBlocked"\]/, "Legacy selection fields must be marked compatibility-only");
assert.match(components, /displayed on this page[\s\S]*Batch-selectable[\s\S]*Batch-unavailable/, "Active selection UI must separate display count from Batch permission");
assert.match(components, /Matched outside current page[\s\S]*Batch-blocked matched/, "Reconciliation UI must use corrected page and Batch labels");
assert.match(eduopsHtml, /Matched, displayed and selected counts loading/, "Initial queue copy must not use visible for Batch-selectable rows");

assert.match(workload, /function eduopsRowAuthorityField_/, "Advanced filters must normalize nested authority fields");
assert.match(workload, /eduopsRowAuthorityField_\(row, "documentState"\)/, "Document filter must read normalized authority state");
assert.match(workload, /matchedOutsideCurrentPage[\s\S]*matchedBeforeCurrentPage[\s\S]*matchedAfterCurrentPage[\s\S]*matchingOnLaterPages/, "Page counts must expose corrected fields while retaining the compatibility alias");

assert.match(components, /Package actions[\s\S]*Current summary[\s\S]*Open workspace packages/, "Package panel controls must be honest actions, not unsupported modes");
assert.doesNotMatch(components, />Hidden<\/button>|>Expanded<\/button>|>Compact<\/button>/, "Unsupported package modes must not be presented as active controls");

assert.match(access, /"CAN_EDIT_CONTACT_DETAILS"/, "Dedicated contact-edit capability must be catalogued");
assert.match(access, /CAN_EDIT_CONTACT_DETAILS: "CONTACT_DETAILS_EDIT_CAPABILITY_REQUIRED"/, "Contact-edit capability must have a dedicated denial code");
assert.match(commands, /CONTACTABILITY_CORRECTION: \{ capability: "CAN_EDIT_CONTACT_DETAILS"/, "Command catalogue must require the dedicated contact capability");
assert.match(workload, /CONTACTABILITY_CORRECTION"[\s\S]*"CAN_EDIT_CONTACT_DETAILS"/, "Workbench action projection must require the same contact capability");
assert.match(admin, /admin_updateParentEmailCorrected[\s\S]*requireAdminCapability_\(operatorEmail, "CAN_EDIT_CONTACT_DETAILS"/, "Server contact mutation must enforce the dedicated capability");

const context = {
  clean_: (value) => String(value == null ? "" : value).trim()
};
vm.createContext(context);
vm.runInContext([
  extractFunction(admin, "actionabilityWorklistProjection_")
].join("\n\n"), context);

const contactBlockedDocs = context.actionabilityWorklistProjection_({
  nextAction: "UPLOAD_REQUIRED_DOCUMENTS",
  suppressor: "NO_EFFECTIVE_EMAIL"
});
assert.equal(contactBlockedDocs.worklistKey, "CONTACTABILITY_EXCEPTION", "Contactability must take precedence over document follow-up routing");
assert.match(contactBlockedDocs.worklistReason, /manual contactability review/, "Contactability route must explain manual review");

const communicationReview = context.actionabilityWorklistProjection_({
  nextAction: "UPLOAD_REQUIRED_DOCUMENTS",
  suppressor: "MANUAL_REVIEW_REQUIRED"
});
assert.equal(communicationReview.worklistKey, "COMMUNICATION_REVIEW", "Manual communication review remains an explicit route");
assert.match(communicationReview.worklistReason, /Compatibility communication cadence/, "Manual communication route must be labelled as compatibility cadence");

console.log("PASS R391C semantic classification, routing, Finance, DTO and capability contracts");
