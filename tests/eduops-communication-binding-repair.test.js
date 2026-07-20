const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

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

const client = read("EduOps_ClientWorkbench.html");
const workload = read("EduOps_Workload.js");
const commands = read("EduOps_Commands.js");

assert.doesNotThrow(() => new vm.Script(client.replace(/^<script>\s*/, "").replace(/\s*<\/script>\s*$/, ""), { filename: "EduOps_ClientWorkbench.html" }));
assert.doesNotThrow(() => new vm.Script(workload, { filename: "EduOps_Workload.js" }));

const context = { app: {
  state: { operationAvailability: {}, capabilities: {}, workbench: { actions: {}, communications: {} } },
  operationAvailable(operation) { return this.state.operationAvailability[operation]?.available === true; },
  operationUnavailableReason(operation) { return this.state.operationAvailability[operation]?.reason || "Authoritative operation availability was not returned. Refresh or retry."; },
  authorityUnavailable(domain) { return `Authoritative ${domain} decision was not returned. Refresh or retry before continuing.`; }
} };
vm.createContext(context);
vm.runInContext(`
${extractFunction(client, "identity")}
${extractFunction(client, "operationAvailable")}
${extractFunction(client, "actionDecision")}
${extractFunction(client, "commandEnabled")}
${extractFunction(client, "ensureCommunicationDraft")}
${extractFunction(client, "communicationTemplates")}
${extractFunction(client, "communicationTemplateById")}
${extractFunction(client, "selectedCommunicationTemplate")}
${extractFunction(client, "communicationEnabled")}
${extractFunction(client, "communicationDisabledReason")}
${extractFunction(client, "applyCommunicationTemplate")}
`, context);

context.app.state.workbench.actions.SEND_INDIVIDUAL_COMMUNICATION = { schemaVersion: "EDUOPS_WORKBENCH_ACTION_V1", available: true, reason: "Backend operation and capability authority permit preview." };
context.app.state.communicationDraft = { templateId: "payment_followup", messageType: "payment_followup" };
context.app.state.workbench.communications = { communicationTemplatePanel: { schemaVersion: "OPSEDU_COMMUNICATION_TEMPLATE_PANEL_V1", templates: [{ templateId: "payment_followup", messageType: "payment_followup", selectable: true }] } };
assert.equal(context.communicationEnabled(), true, "backend operation authority and per-template authority enable the EduOps communication control");

context.app.state.workbench.actions.SEND_INDIVIDUAL_COMMUNICATION = { schemaVersion: "EDUOPS_WORKBENCH_ACTION_V1", available: false, reason: "The authoritative capability projection does not permit individual communication." };
context.app.state.workbench.communications = { communicationTemplatePanel: { schemaVersion: "OPSEDU_COMMUNICATION_TEMPLATE_PANEL_V1", templates: [{ templateId: "payment_followup", messageType: "payment_followup", selectable: true }] } };
assert.equal(context.communicationEnabled(), false, "authoritative false capability must disable communication control");
assert.match(context.communicationDisabledReason(), /authoritative capability projection/i, "false capability must display capability reason");

context.app.state.workbench.actions.SEND_INDIVIDUAL_COMMUNICATION = { schemaVersion: "EDUOPS_WORKBENCH_ACTION_V1", available: true, reason: "Backend operation and capability authority permit preview." };
context.app.state.workbench.communications = { communicationTemplatePanel: { schemaVersion: "OPSEDU_COMMUNICATION_TEMPLATE_PANEL_V1", templates: [{ templateId: "payment_followup", messageType: "payment_followup", selectable: false, unavailableReason: "No effective parent email is available.", recommendedMessageType: "payment_followup" }] } };
assert.equal(context.communicationEnabled(), false, "Communication Authority block must disable communication even when capability is true");
assert.equal(context.communicationDisabledReason(), "No effective parent email is available.", "authoritative block reason must be displayed");

function configureTemplates(templates, selectedType, capability = true) {
  context.app.state.communicationDraft = { applicantId: "A1", templateId: selectedType, messageType: selectedType };
  context.app.state.workbench = {
    actions: { SEND_INDIVIDUAL_COMMUNICATION: { schemaVersion: "EDUOPS_WORKBENCH_ACTION_V1", available: capability, reason: capability ? "Backend operation and capability authority permit preview." : "The authoritative capability projection does not permit individual communication." } },
    identity: { applicantId: "A1", displayName: "Applicant One", email: "a@example.test" },
    exactAuthorityProjection: { canonicalLifecycle: "IGNORED", canonicalFinanceState: "IGNORED", Payment_Badge: "IGNORED", Receipt_Status: "IGNORED" },
    finance: { state: "IGNORED", paymentVerified: true },
    communications: { recommendedMessageType: templates[0] && templates[0].messageType, communicationTemplatePanel: { schemaVersion: "OPSEDU_COMMUNICATION_TEMPLATE_PANEL_V1", templates } }
  };
}

delete context.app.state.workbench.actions.SEND_INDIVIDUAL_COMMUNICATION;
assert.equal(context.communicationEnabled(), false, "missing backend operation availability must fail closed");
assert.match(context.communicationDisabledReason(), /Authoritative communication operation decision was not returned/, "missing backend availability must display the fail-closed reason");

const recommendedPermitted = {
  templateId: "payment_followup",
  messageType: "payment_followup",
  selectedOptionLabel: "Payment / Receipt Follow-Up",
  label: "Payment Follow-Up",
  purpose: "Canonical payment follow-up",
  selectable: true,
  subject: "FODE KIA Application - Payment Follow-Up",
  body: "Payment authority body"
};
const docsBlocked = {
  templateId: "docs_missing",
  messageType: "docs_missing",
  selectedOptionLabel: "Missing Documents - Selected Applicant",
  label: "Missing Documents Follow-Up",
  purpose: "Canonical document follow-up",
  selectable: false,
  unavailableReason: "Documents follow-up is not permitted for this selected applicant.",
  subject: "FODE KIA Application - Missing Documents",
  body: "Documents authority body"
};
const customPermitted = {
  templateId: "custom_email",
  messageType: "custom_email",
  selectedOptionLabel: "Custom Email - Selected Applicant",
  label: "Custom Email",
  purpose: "Canonical custom selected-applicant message",
  selectable: true,
  subject: "Custom subject",
  body: "Custom body"
};
const customBlocked = Object.assign({}, customPermitted, {
  selectable: false,
  unavailableReason: "Custom email is blocked by its own authority result."
});

configureTemplates([recommendedPermitted, docsBlocked], "payment_followup");
assert.equal(context.communicationEnabled(), true, "A: recommended permitted selection must be enabled");
context.app.state.communicationDraft.templateId = docsBlocked.templateId;
context.app.state.communicationDraft.messageType = docsBlocked.messageType;
assert.equal(context.communicationEnabled(), false, "A: selecting an authority-blocked alternative must disable the control");
assert.equal(context.communicationDisabledReason(), docsBlocked.unavailableReason, "A: alternative block reason must govern after selection");

configureTemplates([Object.assign({}, recommendedPermitted, { selectable: false, unavailableReason: "Recommended payment follow-up blocked." }), customPermitted], "payment_followup");
assert.equal(context.communicationEnabled(), false, "B: default recommended blocked selection must be disabled");
context.applyCommunicationTemplate(customPermitted);
assert.equal(context.communicationEnabled(), true, "B: permitted alternative must enable the control");
assert.notEqual(context.communicationDisabledReason(), "Recommended payment follow-up blocked.", "B: recommended block reason must not govern the permitted alternative");

configureTemplates([Object.assign({}, recommendedPermitted, { selectable: false, unavailableReason: "Recommended blocked." }), customBlocked], "custom_email");
assert.equal(context.selectedCommunicationTemplate().messageType, "custom_email", "C: custom_email must map to its own canonical message type");
assert.equal(context.communicationEnabled(), false, "C: blocked custom_email must not inherit recommended eligibility");
assert.equal(context.communicationDisabledReason(), customBlocked.unavailableReason, "C: custom_email must display its own block reason");
configureTemplates([Object.assign({}, recommendedPermitted, { selectable: false, unavailableReason: "Recommended blocked." }), customPermitted], "custom_email");
assert.equal(context.communicationEnabled(), true, "C: independently permitted custom_email must enable");

configureTemplates([customPermitted], "custom_email", false);
assert.equal(context.communicationEnabled(), false, "D: operator capability remains mandatory even when selected type is authority-permitted");

configureTemplates([customPermitted], "custom_email");
context.app.state.workbench.exactAuthorityProjection.canonicalLifecycle = "BLOCKED_LOCALLY";
context.app.state.workbench.exactAuthorityProjection.canonicalFinanceState = "PAYMENT_PENDING_LOCALLY";
context.app.state.workbench.exactAuthorityProjection.Payment_Badge = "BLOCKED_LOCALLY";
context.app.state.workbench.exactAuthorityProjection.Receipt_Status = "BLOCKED_LOCALLY";
assert.equal(context.communicationEnabled(), true, "E: local lifecycle/payment/receipt labels cannot override selected template authority");

context.applyCommunicationTemplate(recommendedPermitted);
assert.equal(context.app.state.communicationDraft.messageType, "payment_followup", "F: recommended path keeps canonical message type");
assert.equal(context.app.state.communicationDraft.subject, recommendedPermitted.subject, "F: recommended path uses canonical subject");
assert.equal(context.app.state.communicationDraft.body, recommendedPermitted.body, "F: recommended path uses canonical body");
assert.equal(recommendedPermitted.selectedOptionLabel, "Payment / Receipt Follow-Up", "F: recommended path uses canonical title");
assert.equal(recommendedPermitted.purpose, "Canonical payment follow-up", "F: recommended path uses canonical description");
context.applyCommunicationTemplate(Object.assign({}, docsBlocked, { selectable: true }));
assert.equal(context.app.state.communicationDraft.messageType, "docs_missing", "F: alternative path keeps canonical message type");
assert.equal(context.app.state.communicationDraft.subject, docsBlocked.subject, "F: alternative path uses canonical subject");
assert.equal(context.app.state.communicationDraft.body, docsBlocked.body, "F: alternative path uses canonical body");
context.applyCommunicationTemplate(customPermitted);
assert.equal(context.app.state.communicationDraft.messageType, "custom_email", "F: custom path keeps canonical custom_email type");
assert.equal(context.app.state.communicationDraft.subject, customPermitted.subject, "F: custom path uses established custom draft subject");
assert.equal(context.app.state.communicationDraft.body, customPermitted.body, "F: custom path uses established custom draft body");

configureTemplates([Object.assign({}, recommendedPermitted, { selectable: false, unavailableReason: "Cooling-off authority result supplied for selected type." })], "payment_followup");
assert.equal(context.communicationDisabledReason(), "Cooling-off authority result supplied for selected type.", "H: cooling-off contrast consumes supplied selected-type authority result without changing cooldown calculations");

assert.match(workload, /function eduopsClientCapabilityProjection_/, "server must produce a documented EduOps client capability DTO");
assert.match(workload, /buildApplicantCommunicationAuthorityProjection_/, "workbench communications must use the existing Communication Authority projection");
assert.match(workload, /communicationTemplateGalleryMetadata_/, "workbench template gallery must come from canonical template metadata");
assert.match(workload, /buildApplicantMessage_/, "workbench draft subject/body must use the established message builder");
assert.match(workload, /recommendedTemplateId/, "recommended message type must resolve to a template id");
assert.match(workload, /function eduopsCommunicationAuthorityForType_/, "server must project authority for each selectable message type");
assert.match(workload, /resolveApplicantMessageContextFromRow_\(rowObj, rowNumber, sheet, requestedType/, "per-template authority must evaluate the selected canonical message type explicitly");

assert.doesNotMatch(client, /FODE - Applicant follow-up/, "EduOps must not keep the generic hard-coded communication subject");
assert.doesNotMatch(client, /Request outstanding document evidence\./, "EduOps must not keep local docs_missing template copy");
assert.doesNotMatch(client, /Follow up while receipt\/payment verification is pending\./, "EduOps must not keep local payment_followup template copy");
assert.match(client, /communicationTemplatePanel/, "client must render the server-projected canonical template panel");
assert.match(client, /custom_email|communicationTemplateById/, "custom_email mapping must remain supported through canonical template metadata");
assert.match(extractFunction(commands, "eduopsAuthorityPreview_"), /admin_previewApplicantMessage/, "individual communication preview must route through the existing preview authority");
assert.match(extractFunction(commands, "eduops_executeCommand"), /PREVIEW_EXPIRED_OR_UNKNOWN[\s\S]*PREVIEW_NOT_EXECUTABLE/, "execute must require a cached executable preview");
assert.match(extractFunction(commands, "eduopsDispatchCommand_"), /admin_sendApplicantMessage/, "individual communication send must remain inside guarded execute dispatch");
assert.doesNotMatch(extractFunction(client, "communicationEnabled"), /comm\.canSendNow/, "selected template authority must replace the global recommended-type sendability gate");

for (const forbidden of ["canonicalLifecycle", "canonicalFinance", "Payment_Badge", "Receipt_Status"]) {
  assert.doesNotMatch(extractFunction(client, "communicationEnabled"), new RegExp(forbidden), `client communication gate must not infer from ${forbidden}`);
}

console.log("PASS EduOps communication binding repair capabilityDto=true templateAuthority=true noDirectSendBypass=true");
