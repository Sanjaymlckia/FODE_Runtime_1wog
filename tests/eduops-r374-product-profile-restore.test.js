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
    getCallerEmail_: () => "owner@example.test",
    isAdmin_: () => true,
    adminHasCapability_: () => true,
    getAdminRole_: () => "SUPER",
    resolveAdminCapabilities_: () => ({}),
    CONFIG: {
      VERSION: "r370",
      DEPLOY_VERSION_NUMBER: 370,
      DEPLOYMENT_ID_ADMIN: "AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ",
      DOC_STATUS: { VERIFIED: "VERIFIED", REJECTED: "REJECTED" }
    },
    EDUOPS_CONTRACT_VERSION: "TEST",
    EDUOPS_PROFILE_VERSION: "TEST",
    Utilities: {
      computeDigest: (_algorithm, value) => Array.from(Buffer.from(String(value))),
      DigestAlgorithm: { SHA_256: "SHA_256" },
      base64EncodeWebSafe: (value) => Buffer.from(value).toString("base64url"),
      newBlob: (value) => ({ getBytes: () => Array.from(Buffer.from(String(value))) })
    },
    eduopsRequireAccess_: () => ({ email: "owner@example.test", role: "SUPER", capabilities: {} }),
    eduopsFeatureFlags_: () => ({ PORTAL_ACCESS: false, BOOKS_ACTION: false }),
    eduopsBatchExecutionCap_: () => 30,
    eduopsOperationAvailability_: () => ({
      BATCH_COMMUNICATION: { available: true, reason: "FODE live authority only." },
      PORTAL_ACCESS: { available: false, reason: "Portal unavailable." },
      BOOKS_ACTION: { available: false, reason: "Books unavailable." }
    }),
    communicationTemplateGalleryMetadata_: () => [
      { messageType: "admissions_reminder", selectedOptionLabel: "Admissions Reminder", purpose: "Admissions reminder", selectedOptionOrder: 1, batchSafe: true, editableMode: "fixed" },
      { messageType: "fee_reminder", selectedOptionLabel: "Fee Reminder", purpose: "Fee reminder", selectedOptionOrder: 2, batchSafe: true, editableMode: "fixed" },
      { messageType: "cohort_notice", selectedOptionLabel: "Cohort Notice", purpose: "Cohort notice", selectedOptionOrder: 3, batchSafe: true, editableMode: "fixed" }
    ],
    isCommunicationTypeBatchSafe_: () => true
  };
  vm.createContext(context);
  ["EduOps_Contracts.js", "EduOps_FODE_Adapter.js", "EduOps_Workload.js"].forEach((file) => vm.runInContext(read(file), context, { filename: file }));
  return context;
}

function testProfileRegistry() {
  const context = serverContext();
  const profile = context.eduops_getProfile();
  assert.deepEqual(profile.products.map((item) => item.code), ["FODE", "KIA", "MLC"]);
  assert.equal(profile.products.find((item) => item.code === "FODE").mode, "LIVE_OPERATIONS");
  assert.equal(profile.products.find((item) => item.code === "KIA").mode, "DEMONSTRATION_READ_ONLY");
  assert.equal(profile.products.find((item) => item.code === "MLC").mode, "DEMONSTRATION_READ_ONLY");
}

function testDemoProfileWorkload(product, expectedName, expectedPrefix) {
  const context = serverContext();
  const response = context.eduops_queryOperationalWorkload({
    product,
    actionabilityState: "READY",
    worklistKey: "",
    workScope: "ALL_AUTHORISED",
    filters: { search: "" },
    sort: { key: "urgency", direction: "asc" },
    page: 1,
    pageSize: 25
  });
  assert.equal(response.ok, true);
  assert.equal(response.readOnly, true);
  assert.equal(response.demoOnly, true);
  assert.equal(response.product, product);
  assert.match(response.runtime.operationalClassification, new RegExp(expectedName));
  assert.equal(response.runtime.deploymentRole, "DEMONSTRATION_READ_ONLY");
  assert.match(response.snapshotId, new RegExp(`^SNAP-${product}-`));
  assert(response.rows.length > 0, `${product} demo workload must render preserved rows`);
  assert(response.rows.every((row) => row.applicantId.startsWith(expectedPrefix)), `${product} rows must not leak FODE or another profile`);
  assert(response.rows.every((row) => row.selectable === false), `${product} demo rows must be non-selectable`);
  assert.equal(response.presentation.selection.visibleSelectable, 0, `${product} must not expose selectable live-action rows`);
  assert.equal(response.operationAvailability.BATCH_COMMUNICATION.available, false, `${product} must not expose batch communication as available`);
  assert.equal(response.operationAvailability.DOCUMENT_REVIEW.available, false, `${product} must not expose document review as available`);
  assert.equal(response.queryBinding.product, product);
  assert.equal(response.queryBinding.query.product, product);
  assert(response.cockpit.actionPackages.every((item) => item.disabled === true), `${product} action packages must be visibly read-only/demo`);
  assert(response.cockpit.actionPackages.every((item) => item.packageId.startsWith(product + ":")), `${product} packages must be product-scoped`);
}

function testDemoSearchIsolation() {
  const context = serverContext();
  const kia = context.eduops_searchApplicants({ product: "KIA", query: "KIA-26-", limit: 5 });
  const mlc = context.eduops_searchApplicants({ product: "MLC", query: "MLC-26-", limit: 5 });
  assert(kia.matches.length > 0);
  assert(mlc.matches.length > 0);
  assert(kia.matches.every((row) => row.applicantId.startsWith("KIA-")));
  assert(mlc.matches.every((row) => row.applicantId.startsWith("MLC-")));
  assert(kia.matches.every((row) => row.searchHandoff.queueBinding.product === "KIA"));
  assert(mlc.matches.every((row) => row.searchHandoff.queueBinding.product === "MLC"));
}

function testClientSelectorAndGuardRemoval() {
  const html = read("EduOps.html");
  const client = read("EduOps_ClientComponents.html");
  assert.match(html, /<option value="FODE">FODE<\/option>[\s\S]*<option value="KIA">KIA<\/option>[\s\S]*<option value="MLC">MLC<\/option>/);
  assert.doesNotMatch(client, /Only FODE Operations is released on this surface/);
  assert.match(html, /KIA and MLC are demonstration profiles with no live operational actions/);
}

testProfileRegistry();
testDemoProfileWorkload("KIA", "KIA Admissions", "KIA-");
testDemoProfileWorkload("MLC", "MLC Admissions and Training", "MLC-");
testDemoSearchIsolation();
testClientSelectorAndGuardRemoval();
console.log("PASS R374 product profile restore: FODE KIA MLC registry, demo isolation, no live KIA/MLC actions");
