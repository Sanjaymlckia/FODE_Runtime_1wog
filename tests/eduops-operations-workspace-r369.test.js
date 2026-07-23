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
    "EduOps_ClientOperationsWorkspace.html",
    "EduOps_OperationsWorkspaceStyles.html"
  ].map(read).join("\n");
  assert.doesNotMatch(runtime, /backend DTO preview|preview placeholder/i, "runtime must not inherit preview-only placeholder wording");
  assert.doesNotMatch(runtime, />\s*Not returned\s*</i, "runtime identity details must not expose preview-style Not returned placeholders");
  assert.doesNotMatch(runtime, /data-eduops-operations-package-rail|eduopsOperationsPackageHeading|data-package-rail/i, "runtime must remove the former large package rail");
  assert.match(read("EduOps.html"), /eduops-operations-ribbon-row[\s\S]*eduopsOperationsPrimaryBuckets[\s\S]*eduops-operations-ribbon-divider[\s\S]*eduopsOperationsActionPackages/, "primary buckets and selected work packages must share one OPS ribbon");
  assert.match(read("EduOps_OperationsWorkspaceStyles.html"), /\.eduops-operations-primary-buckets\s*\{[\s\S]*grid-template-columns:\s*repeat\(8,\s*minmax\(74px,\s*1fr\)\)/, "all eight primary states must be retained in the compact normal-zoom ribbon");
  assert.match(read("EduOps_OperationsWorkspaceStyles.html"), /\.eduops-operations-split-workspace\s*\{[\s\S]*grid-template-columns:\s*clamp\(240px,\s*18vw,\s*280px\)\s*minmax\(0,\s*1fr\)/, "wide desktop context pane must be bounded to 240-280px");
  assert.match(read("EduOps_OperationsWorkspaceStyles.html"), /@media \(max-width:\s*1599px\)[\s\S]*\.eduops-operations-split-workspace\s*\{[\s\S]*grid-template-columns:\s*240px\s*minmax\(0,\s*1fr\)/, "medium desktop context pane must remain bounded for normal zoom");
  assert.match(read("EduOps_ClientOperationsWorkspace.html"), /shortLabels\s*=\s*\{[\s\S]*READY:\s*"Ready"[\s\S]*COMPLETE:\s*"Complete"/, "short labels must preserve the eight primary states without clipping");
  assert.match(read("EduOps_ClientComponents.html"), /Search within/, "scoped search wording must name the active backend package or workload");
  assert.equal((read("EduOps.html").match(/id="eduopsGlobalSearch"/g) || []).length, 1, "persistent global applicant search must have one active field");
  assert.match(read("EduOps.html"), /eduops-global-search-strip[\s\S]*Find any applicant[\s\S]*eduops-shell/, "global applicant search must sit persistently above the operator shell");
  assert.match(read("EduOps_ClientComponents.html"), /eduops_searchApplicants",\s*\{\s*product:\s*app\.state\.product,\s*query:\s*query,\s*limit:\s*12,\s*expectedSnapshotId:\s*app\.state\.snapshotId\s*\}/, "global applicant search request must not include active work-package filters");
  assert.match(read("EduOps_ClientComponents.html"), /the authoritative FODE population/, "global no-match state must retain authoritative FODE population wording");
  assert.match(read("EduOps_ClientComponents.html"), /No applicant found in '\s*\+\s*app\.esc\(productLabel\)\s*\+\s*'\./, "global no-match state must render the product-specific population label");
  assert.match(read("EduOps_ClientComponents.html"), /Find any '\s*\+\s*app\.esc/, "global search placeholder must render the product-specific person label");
  assert.doesNotMatch(read("EduOps_ClientComponents.html"), /searchOpen[\s\S]{0,160}dismissGlobalSearch/, "opening a global-search applicant must preserve search context");
  assert.doesNotMatch(read("EduOps_ClientComponents.html"), /searchWorklist[\s\S]{0,260}dismissGlobalSearch/, "opening a global-search work package must preserve search context");
  assert.match(read("EduOps_Styles.html"), /\.eduops-global-search-strip[\s\S]*min-height:\s*38px/, "global search strip must be compact and persistent");
  assert.match(read("EduOps_Styles.html"), /\.eduops-work-scope-band\s*\{[\s\S]*padding:\s*5px 7px/, "work-scope controls must be compact for normal zoom");
  assert.match(read("EduOps_Styles.html"), /\.eduops-selection-bar\s*\{[\s\S]*padding:\s*4px 7px/, "selection controls must be compact for normal zoom");
  assert.match(read("EduOps.html"), /eduops-operations-context-action[\s\S]*Open composition/, "Open composition must remain available as a secondary context action");
  assert.doesNotMatch(read("EduOps.html"), /eduops-work-scope-band[\s\S]*eduopsOpenReconciliation[\s\S]*<\/div>\s*<div class="eduops-filter-toolbar"/, "Open composition must not occupy the main queue-control row");
}

function testIndependentScrollingContracts() {
  const styles = read("EduOps_Styles.html");
  assert.match(styles, /\.eduops-rail\s*\{[\s\S]*overflow:\s*hidden auto/, "Admin navigation must scroll independently");
  assert.match(styles, /\.eduops-table-scroller\s*\{[\s\S]*overflow:\s*auto/, "Applicant worklist must scroll independently");
  assert.match(styles, /\.eduops-workbench-panel,\s*\n\.eduops-batch-panel\s*\{[\s\S]*overflow:\s*auto/, "Workbench and Batch surfaces must scroll independently");
  assert.match(read("EduOps_OperationsWorkspaceStyles.html"), /\.eduops-operations-context-pane\s*\{[\s\S]*overflow:\s*auto/, "Operational context pane must scroll independently when needed");
  assert.match(read("EduOps_OperationsWorkspaceStyles.html"), /\.eduops-operations-queue-pane\s*\{[\s\S]*overflow:\s*hidden/, "Applicant queue pane must own the dominant scroll region");
  assert.match(read("EduOps_OperationsWorkspaceStyles.html"), /\.eduops-operations-queue-toolbar\s*\{[\s\S]*position:\s*sticky[\s\S]*background:\s*#fff/, "Queue toolbar must be sticky and opaque");
}

testBackendWorkspaceProjection();
testRuntimePlaceholderAndControlPolicy();
testIndependentScrollingContracts();
console.log("PASS eduops-operations-workspace-r370");
