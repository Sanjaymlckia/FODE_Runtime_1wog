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

function row(overrides = {}) {
  return Object.assign({
    applicantId: "FODE-26-002959",
    rowNumber: 50,
    name: "Keziah Waffi",
    email: "waffi@example.test",
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
    canonicalLifecycle: { lifecycleStage: "PAYMENT_PENDING", reason: "Payment remains pending." },
    authorityState: { canonicalFinanceState: "PAYMENT_PENDING", documentState: "DOCS_VERIFIED", contactabilityState: "EMAIL_AVAILABLE" }
  }, overrides);
}

function testBackendWorkspaceProjection() {
  const context = serverContext();
  const rows = [
    row(),
    row({ applicantId: "FODE-26-003000", worklistKey: "DOCUMENT_FOLLOW_UP", worklistLabel: "Document Follow-Up", worklistReason: "Applicant document follow-up is due.", nextAction: "REQUEST_DOCUMENTS", recommendedMessageType: "docs_missing", authorityState: { canonicalFinanceState: "NOT_APPLICABLE", documentState: "MISSING_DOCUMENTS", contactabilityState: "EMAIL_AVAILABLE" } }),
    row({ applicantId: "FODE-26-003001", actionabilityState: "REVIEW_REQUIRED", worklistKey: "DOCUMENT_FOLLOW_UP", worklistLabel: "Document Follow-Up", worklistReason: "Internal document decision is required.", nextAction: "REVIEW_DOCUMENTS", recommendedMessageType: "", actionOwner: "OFFICER" }),
    row({ applicantId: "FODE-26-003002", actionabilityState: "COOLING_OFF", worklistKey: "", worklistLabel: "", worklistReason: "Recently contacted.", nextAction: "WAIT", recommendedMessageType: "" }),
    row({ applicantId: "FODE-26-003003", actionabilityState: "AWAITING_APPLICANT", worklistKey: "", worklistLabel: "", nextAction: "WAIT_FOR_APPLICANT", recommendedMessageType: "" }),
    row({ applicantId: "FODE-26-003004", actionabilityState: "AWAITING_PAYMENT", worklistKey: "", worklistLabel: "", nextAction: "WAIT_FOR_PAYMENT", recommendedMessageType: "" }),
    row({ applicantId: "FODE-26-003005", actionabilityState: "BLOCKED", worklistKey: "", worklistLabel: "", nextAction: "INTERVENE", recommendedMessageType: "" }),
    row({ applicantId: "FODE-26-003006", actionabilityState: "UNKNOWN", worklistKey: "", worklistLabel: "", nextAction: "CLASSIFY", recommendedMessageType: "" }),
    row({ applicantId: "FODE-26-003007", actionabilityState: "COMPLETE", worklistKey: "", worklistLabel: "", nextAction: "NO_ACTION", recommendedMessageType: "" })
  ];
  const cockpit = context.eduopsCockpitProjection_(rows, "SNAP-R369", "2026-07-20T00:00:00.000Z");
  assert.deepEqual(cockpit.primaryBuckets.map((item) => item.code), ["READY", "COOLING_OFF", "AWAITING_APPLICANT", "AWAITING_PAYMENT", "REVIEW_REQUIRED", "BLOCKED", "UNKNOWN", "COMPLETE"]);
  assert(cockpit.primaryBuckets.every((item) => item.defaultQueueBinding.authority === "SERVER_AUTHORED"), "every primary bucket must open through a server-authored query binding");
  const readyDocs = cockpit.actionPackages.find((item) => item.packageId === "FODE:READY:DOCUMENT_FOLLOW_UP");
  const reviewDocs = cockpit.actionPackages.find((item) => item.packageId === "FODE:REVIEW_REQUIRED:DOCUMENT_FOLLOW_UP");
  assert.equal(readyDocs.label, "Missing documents - applicant follow-up due");
  assert.equal(reviewDocs.label, "Missing documents - review decision required");
  assert.notEqual(readyDocs.label, reviewDocs.label, "document follow-up work packages must not share the same operator label");
  assert.equal(cockpit.actionPackages.find((item) => item.packageId === "FODE:READY:PAYMENT_FOLLOW_UP").defaultQueueBinding.query.worklistKey, "PAYMENT_FOLLOW_UP");
}

function testRuntimePlaceholderAndControlPolicy() {
  const runtime = [
    "EduOps.html",
    "EduOps_ClientComponents.html",
    "OpsEdu_ClientCockpit.html",
    "OpsEdu_CockpitStyles.html"
  ].map(read).join("\n");
  assert.doesNotMatch(runtime, /backend DTO preview|preview placeholder/i, "runtime must not inherit preview-only placeholder wording");
  assert.doesNotMatch(runtime, />\s*Not returned\s*</i, "runtime identity details must not expose preview-style Not returned placeholders");
  assert.doesNotMatch(runtime, /data-opsedu-package-rail|opseduPackageHeading|data-package-rail/i, "runtime must remove the former large package rail");
  assert.match(read("EduOps.html"), /opsedu-ribbon-row[\s\S]*opseduPrimaryBuckets[\s\S]*opsedu-ribbon-divider[\s\S]*opseduActionPackages/, "primary buckets and selected work packages must share one OPS ribbon");
  assert.match(read("OpsEdu_CockpitStyles.html"), /\.opsedu-primary-buckets\s*\{[\s\S]*grid-template-columns:\s*repeat\(8,\s*minmax\(82px,\s*1fr\)\)/, "all eight primary states must be retained in the ribbon");
  assert.match(read("OpsEdu_CockpitStyles.html"), /\.opsedu-split-workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(260px,\s*28%\)\s*minmax\(0,\s*72%\)/, "wide desktop split must allocate 28 percent to context and 72 percent to queue");
  assert.match(read("OpsEdu_CockpitStyles.html"), /@media \(max-width:\s*1599px\)[\s\S]*\.opsedu-split-workspace\s*\{[\s\S]*grid-template-columns:\s*minmax\(260px,\s*32%\)\s*minmax\(0,\s*68%\)/, "medium desktop split must allocate approximately 32 percent to context and 68 percent to queue");
  assert.match(read("OpsEdu_ClientCockpit.html"), /shortLabels\s*=\s*\{[\s\S]*READY:\s*"Ready"[\s\S]*COMPLETE:\s*"Complete"/, "short labels must preserve the eight primary states without clipping");
  assert.match(read("EduOps_ClientComponents.html"), /Search within/, "scoped search wording must name the active backend package or workload");
}

function testIndependentScrollingContracts() {
  const styles = read("EduOps_Styles.html");
  assert.match(styles, /\.eduops-rail\s*\{[\s\S]*overflow:\s*hidden auto/, "Admin navigation must scroll independently");
  assert.match(styles, /\.eduops-table-scroller\s*\{[\s\S]*overflow:\s*auto/, "Applicant worklist must scroll independently");
  assert.match(styles, /\.eduops-workbench-panel,\s*\n\.eduops-batch-panel\s*\{[\s\S]*overflow:\s*auto/, "Workbench and Batch surfaces must scroll independently");
  assert.match(read("OpsEdu_CockpitStyles.html"), /\.opsedu-context-pane\s*\{[\s\S]*overflow:\s*auto/, "Operational context pane must scroll independently when needed");
  assert.match(read("OpsEdu_CockpitStyles.html"), /\.opsedu-queue-pane\s*\{[\s\S]*overflow:\s*hidden/, "Applicant queue pane must own the dominant scroll region");
  assert.match(read("OpsEdu_CockpitStyles.html"), /\.opsedu-queue-toolbar\s*\{[\s\S]*position:\s*sticky[\s\S]*background:\s*#fff/, "Queue toolbar must be sticky and opaque");
}

testBackendWorkspaceProjection();
testRuntimePlaceholderAndControlPolicy();
testIndependentScrollingContracts();
console.log("PASS opsedu-workspace-r370");
