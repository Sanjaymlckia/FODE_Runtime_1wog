const assert = require("assert");
const fs = require("fs");
const path = require("path");
const vm = require("vm");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function serverContext() {
  const context = {
    console,
    Date,
    JSON,
    Math,
    Object,
    Array,
    String,
    Number,
    RegExp,
    isFinite,
    clean_: (value) => String(value == null ? "" : value).trim(),
    CONFIG: { DOC_STATUS: { VERIFIED: "VERIFIED", REJECTED: "REJECTED" } },
    EDUOPS_CONTRACT_VERSION: "TEST",
    EDUOPS_PROFILE_VERSION: "TEST",
    Utilities: {
      computeDigest: (_algorithm, value) => Array.from(Buffer.from(String(value))),
      DigestAlgorithm: { SHA_256: "SHA_256" },
      base64EncodeWebSafe: (value) => Buffer.from(value).toString("base64url"),
      newBlob: (value) => ({ getBytes: () => Array.from(Buffer.from(String(value))) })
    },
    communicationTemplateGalleryMetadata_: () => [
      { messageType: "payment_followup", selectedOptionLabel: "Payment Follow-up", purpose: "Payment follow-up", selectedOptionOrder: 1, batchSafe: true, editableMode: "fixed" },
      { messageType: "docs_missing", selectedOptionLabel: "Missing Documents Follow-up", purpose: "Documents follow-up", selectedOptionOrder: 2, batchSafe: true, editableMode: "fixed" }
    ],
    isCommunicationTypeBatchSafe_: () => true
  };
  vm.createContext(context);
  ["EduOps_Contracts.js", "EduOps_Workload.js", "EduOps_FODE_Adapter.js"].forEach((file) => vm.runInContext(read(file), context, { filename: file }));
  return context;
}

function authorityRow(overrides = {}) {
  return Object.assign({
    applicantId: "FODE-26-002959",
    rowNumber: 50,
    name: "Keziah Waffi",
    actionabilityState: "READY",
    worklistKey: "PAYMENT_FOLLOW_UP",
    worklistLabel: "Payment Follow-up",
    worklistReason: "Payment follow-up is due.",
    nextAction: "SEND_PAYMENT_REMINDER",
    nextActionDate: "2026-07-19T00:00:00.000Z",
    actionOwner: "FINANCE",
    selectable: true,
    urgencyLevel: "DUE",
    recommendedMessageType: "payment_followup",
    canonicalLifecycle: { baseState: "AWAITING_PAYMENT", lifecycleStage: "AWAITING_PAYMENT", reason: "Payment remains pending." },
    authorityState: { canonicalFinanceState: "PAYMENT_PENDING", documentState: "DOCS_VERIFIED", contactabilityState: "EMAIL_AVAILABLE" },
    sourceAuthorities: ["Canonical Lifecycle Resolver", "Actionability Resolver"]
  }, overrides);
}

function testBackendProjection() {
  const context = serverContext();
  const rows = [
    authorityRow(),
    authorityRow({ applicantId: "FODE-26-TEST-002", rowNumber: 51 }),
    authorityRow({ applicantId: "FODE-26-TEST-003", rowNumber: 52, worklistKey: "DOCUMENT_FOLLOW_UP", worklistLabel: "Missing Documents", nextAction: "REQUEST_DOCUMENTS", recommendedMessageType: "docs_missing", authorityState: { canonicalFinanceState: "NOT_APPLICABLE", documentState: "MISSING_DOCUMENTS", contactabilityState: "EMAIL_AVAILABLE" } })
  ];
  const cockpit = context.eduopsCockpitProjection_(rows, "SNAP-R366", "2026-07-20T00:00:00.000Z");
  assert.equal(cockpit.schemaVersion, "OPSEDU_COCKPIT_V1");
  const payment = cockpit.actionPackages.find((item) => item.label === "Payment follow-ups due");
  assert(payment, "payment follow-up package must be backend projected");
  assert.equal(payment.count, 2);
  assert.equal(payment.defaultQueueBinding.authority, "SERVER_AUTHORED");
  assert.equal(payment.defaultQueueBinding.query.actionabilityState, "READY");
  assert.equal(payment.defaultQueueBinding.query.worklistKey, "PAYMENT_FOLLOW_UP");
  assert.equal(payment.defaultQueueBinding.snapshotId, "SNAP-R366");
  assert.equal(payment.recommendedCommunication.label, "Payment Follow-up");
  const documents = cockpit.actionPackages.find((item) => item.label === "Missing documents follow-ups due");
  assert.equal(documents.count, 1);

  const handoff = context.eduopsSearchHandoff_(rows[0], "SNAP-R366", "2026-07-20T00:00:00.000Z");
  assert.equal(handoff.actionPackageLabel, "Payment follow-ups due");
  assert.equal(handoff.queueBinding.query.worklistKey, "PAYMENT_FOLLOW_UP");

  const target = context.eduopsPrimaryActionTarget_(rows[0]);
  assert.equal(target.targetTab, "finance");
  assert.equal(target.targetAction, "SEND_PAYMENT_REMINDER");
  const ribbon = context.eduopsApplicantContextRibbon_(rows[0], "SNAP-R366");
  assert.equal(ribbon.items.find((item) => item.key === "finance").displayValue, "Payment Pending");
  assert.equal(ribbon.items.find((item) => item.key === "documents").displayValue, "Docs Verified");

  const templateSource = [
    { templateId: "payment_followup", messageType: "payment_followup", label: "Payment Follow-up", description: "Canonical payment message", defaultSubject: "Payment subject", defaultBody: "Payment body", recommended: true, availabilityState: "AVAILABLE", availabilityLabel: "Available", selectable: true, editable: false, customisable: false, authoritySource: "Communication Authority" },
    { templateId: "docs_missing", messageType: "docs_missing", label: "Missing Documents", description: "Canonical documents message", defaultSubject: "Documents subject", defaultBody: "Documents body", recommended: false, availabilityState: "UNAVAILABLE", availabilityLabel: "Unavailable", selectable: false, reason: "Not authorised for this applicant.", editable: false, customisable: false, authoritySource: "Communication Authority" }
  ];
  const panel = context.eduopsCommunicationTemplatePanel_(templateSource, templateSource[0], rows[0].applicantId, "SNAP-R366");
  assert.equal(panel.recommendedTemplateId, "payment_followup");
  assert.equal(panel.templates[0].subject, "Payment subject");
  assert.equal(panel.templates[0].body, "Payment body");
  assert.equal(panel.templates[0].selectedByDefault, false);
  assert.equal(panel.templates[1].unavailableReason, "Not authorised for this applicant.");
  const changedRecommendation = context.eduopsCommunicationTemplatePanel_(templateSource.map((item) => Object.assign({}, item, { recommended: item.templateId === "docs_missing" })), templateSource[1], rows[0].applicantId, "SNAP-R366");
  assert.equal(changedRecommendation.recommendedTemplateId, "docs_missing", "backend recommendation alone controls the highlighted template id");

  const gallery = context.eduopsDocumentGalleryProjection_({ applicantId: rows[0].applicantId, snapshotId: "SNAP-R366", snapshotAsOf: "2026-07-20T00:00:00.000Z", rowNumber: 50, renditionRule: "governed", actionAuthority: { available: true }, files: [{ documentType: "BIRTH_CERTIFICATE", displayName: "Birth certificate", statusCode: "VERIFIED", statusPresentation: context.eduopsCodePresentation_("VERIFIED", "Verified", "", "Document authority"), documentKey: "DOC-1", sourceField: "Birth_Certificate", itemIndex: 0, availableDecisions: [] }] });
  assert.equal(gallery.schemaVersion, "OPSEDU_DOCUMENT_GALLERY_V1");
  assert.equal(gallery.documents[0].statusLabel, "Verified");
  assert.equal(gallery.documents[0].available, true);
}

function testHollowClientBinding() {
  const elements = {};
  const clickHandlers = [];
  const element = (id) => elements[id] || (elements[id] = { id, innerHTML: "", textContent: "", scrollIntoView() {} });
  const app = {
    state: { workload: null, selected: { stale: true }, filters: {}, sort: {} },
    esc: (value) => String(value == null ? "" : value),
    clone: (value) => JSON.parse(JSON.stringify(value)),
    clearSelection() { this.state.selected = {}; },
    setInteractionState() {},
    requestWorkload() { this.requestedPayload = this.queryPayload(); return Promise.resolve({ ok: true }); },
    queryPayload() { return { product: this.state.product, actionabilityState: this.state.actionabilityState, worklistKey: this.state.worklistKey, workScope: this.state.workScope, filters: this.state.filters, sort: this.state.sort, page: this.state.page, pageSize: this.state.pageSize, expectedSnapshotId: this.state.snapshotId }; }
  };
  const document = {
    getElementById: element,
    addEventListener: (name, handler) => { if (name === "click") clickHandlers.push(handler); }
  };
  const context = { window: { EduOpsApp: app }, document, Promise, Array, JSON, Number, String };
  vm.createContext(context);
  const client = read("OpsEdu_ClientCockpit.html").replace(/^\s*<script>\s*/, "").replace(/\s*<\/script>\s*$/, "");
  vm.runInContext(client, context, { filename: "OpsEdu_ClientCockpit.html" });

  const binding = {
    schemaVersion: "EDUOPS_QUERY_BINDING_V1",
    authority: "SERVER_AUTHORED",
    snapshotId: "SNAP-R366",
    query: { product: "FODE", actionabilityState: "READY", worklistKey: "PAYMENT_FOLLOW_UP", workScope: "ALL_AUTHORISED", filters: { search: "" }, sort: { key: "urgency", direction: "ASC" }, pageSize: 25 }
  };
  const cockpit = { schemaVersion: "OPSEDU_COCKPIT_V1", productLabel: "FODE live production operations", heading: "Today's work", snapshotId: "SNAP-R366", snapshotTimestamp: "2026-07-20T00:00:00.000Z", actionPackages: [{ packageId: "FODE:READY:PAYMENT_FOLLOW_UP", label: "Payment follow-ups due", ownerDomain: "Finance", count: 2, routeReason: "Payment follow-up is due.", mutationBoundary: "Finance authority", primaryActionLabel: "Open queue", defaultQueueBinding: binding, disabled: false }] };
  app.state.workload = { cockpit };
  app.renderOpsEduCockpit({ cockpit });
  assert.match(element("opseduActionPackages").innerHTML, /Payment follow-ups due/);
  assert.doesNotMatch(element("opseduActionPackages").innerHTML, /Continue/);
  clickHandlers[0]({ target: { closest: () => ({ disabled: false, getAttribute: () => "FODE:READY:PAYMENT_FOLLOW_UP" }) } });
  assert.equal(app.state.worklistKey, "PAYMENT_FOLLOW_UP");
  assert.equal(app.state.snapshotId, "SNAP-R366");
  assert.deepEqual(app.requestedPayload.filters, { search: "" });

  app.renderOpsEduCockpit({ cockpit: null });
  assert.match(element("opseduActionPackages").innerHTML, /Authoritative OpsEdu cockpit decision was not returned/);
}

function testPresentationCleanliness() {
  const cockpitClient = read("OpsEdu_ClientCockpit.html");
  const workbenchClient = read("EduOps_ClientWorkbench.html");
  const allClient = ["EduOps_Client.html", "EduOps_ClientCore.html", "EduOps_ClientComponents.html", "EduOps_ClientWorkbench.html", "EduOps_ClientBatch.html", "OpsEdu_ClientCockpit.html"].map(read).join("\n");
  assert.doesNotMatch(workbenchClient, /\/payment\|finance\|invoice|\/email\|communicat\|contact/);
  assert.doesNotMatch(cockpitClient, /docs_missing|payment_followup|legacy_invite/);
  assert.doesNotMatch(allClient, /defaultSubject|defaultBody/);
  assert.doesNotMatch(cockpitClient, /switch\s*\([^)]*(lifecycle|finance|document|message|actionability)/i);
  assert.match(cockpitClient, /binding\.authority !== "SERVER_AUTHORED"/);
  assert.match(workbenchClient, /Authoritative primary action target unavailable/);
  assert.match(workbenchClient, /OPSEDU_DOCUMENT_GALLERY_V1/);
  assert.match(workbenchClient, /OPSEDU_COMMUNICATION_TEMPLATE_PANEL_V1/);
  assert.doesNotMatch(cockpitClient, /eduops_executeCommand|sendEmail|MailApp|GmailApp/);
}

testBackendProjection();
testHollowClientBinding();
testPresentationCleanliness();
console.log("PASS opsedu-cockpit-stage1");
