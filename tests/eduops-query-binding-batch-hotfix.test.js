const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function read(file) { return fs.readFileSync(file, "utf8"); }

function jsonBoundary(value) {
  return JSON.parse(JSON.stringify(value));
}

function makeRows() {
  const rows = [];
  for (let i = 1; i <= 252; i += 1) {
    const suffix = String(i).padStart(6, "0");
    rows.push({
      applicantId: `FODE-26-${suffix}`,
      name: `Ready Applicant ${i}`,
      email: `ready${i}@example.test`,
      phone: `7000${suffix}`,
      actionabilityState: "READY",
      worklistKey: "DOCUMENT_FOLLOW_UP",
      worklistLabel: "Document follow-up",
      workScope: "ALL_AUTHORISED",
      actionOwner: "ADMIN",
      urgencyLevel: "NORMAL",
      primaryRoute: "DOCUMENTS",
      documentState: "MISSING",
      canonicalFinanceState: "NOT_REQUIRED",
      contactabilityState: "CONTACTABLE",
      recommendedMessageType: "documents_follow_up",
      blockerCode: "",
      coolingOffUntil: "",
      selectable: true,
      rowNumber: i
    });
  }
  for (let i = 253; i <= 331; i += 1) {
    const suffix = String(i).padStart(6, "0");
    rows.push({
      applicantId: `FODE-26-${suffix}`,
      name: `Review Applicant ${i}`,
      email: `review${i}@example.test`,
      phone: `7000${suffix}`,
      actionabilityState: "REVIEW_REQUIRED",
      worklistKey: "REVIEW_REQUIRED",
      worklistLabel: "Review required",
      workScope: "ALL_AUTHORISED",
      actionOwner: "ADMIN",
      urgencyLevel: "NORMAL",
      primaryRoute: "REVIEW",
      documentState: "REVIEW",
      canonicalFinanceState: "NOT_REQUIRED",
      contactabilityState: "CONTACTABLE",
      recommendedMessageType: "review_follow_up",
      blockerCode: "",
      coolingOffUntil: "",
      selectable: false,
      rowNumber: i
    });
  }
  return rows;
}

const context = {
  console,
  clean_: (value) => String(value == null ? "" : value).trim(),
  Utilities: {
    getUuid: () => "test-preview-id",
    newBlob: (text) => ({ getBytes: () => Buffer.from(String(text), "utf8") })
  },
  CacheService: {
    getUserCache: () => ({ put() {}, get() { return null; } })
  },
  eduopsPrimaryRouteForRow_: (row) => row.primaryRoute || ""
};
vm.createContext(context);
vm.runInContext([
  read("EduOps_Contracts.js"),
  read("EduOps_Workload.js"),
  read("EduOps_Commands.js")
].join("\n"), context, { filename: "eduops-query-binding-runtime.vm.js" });

let previewAuthorityCalls = 0;
const rows = makeRows();
Object.assign(context, {
  eduopsRequireAccess_: () => ({
    email: "owner@example.test",
    role: "SUPER",
    capabilities: { CAN_RUN_BATCH_COMMUNICATIONS: true }
  }),
  eduopsRequireFeature_: () => true,
  eduopsResolveFodeSnapshot_: () => ({
    snapshotId: "SNAP-QUERY-BINDING",
    snapshotAsOf: "2026-07-18T00:00:00.000Z",
    cacheState: "TEST",
    totalRows: rows.length,
    rows,
    timings: {
      canonicalSnapshotResolutionMs: 0,
      sourceVersionMs: 0,
      cacheReadMs: 0,
      canonicalBuildMs: 0,
      projectionMs: 0,
      cacheWriteMs: 0
    }
  }),
  eduopsFodeRowDto_: (row) => ({
    applicantId: row.applicantId,
    displayName: row.name,
    actionabilityState: row.actionabilityState,
    worklistKey: row.worklistKey,
    selectable: row.selectable
  }),
  communicationTemplateGalleryMetadata_: () => [{
    messageType: "documents_follow_up",
    label: "Documents follow-up",
    selectedOptionLabel: "Documents follow-up",
    selectedOptionOrder: 1,
    purpose: "Request missing documents",
    batchSafe: true
  }],
  isCommunicationTypeBatchSafe_: (messageType) => messageType === "documents_follow_up",
  selectedApplicantBatchLimit_: () => 30,
  selectedApplicantBatchInputLimit_: () => 500,
  normalizeSelectedApplicantBatchIds_: (ids, limit) => Array.from(new Set((ids || []).map(String))).slice(0, limit || 500),
  admin_previewSelectedApplicantBatch: (payload) => {
    previewAuthorityCalls += 1;
    assert.equal(payload.messageType, "documents_follow_up", "batch preview must use the canonical selected template");
    assert.equal(payload.applicantIds.length, 30, "Communication Authority preview receives only the execution cohort");
    return {
      ok: true,
      result: "PREVIEW",
      eligible: payload.applicantIds.length,
      blocked: 0,
      count: payload.applicantIds.length,
      requestId: "AUTH-PREVIEW-1",
      candidateHash: "AUTH-HASH-1",
      subject: "Canonical documents subject",
      body: "Canonical documents body",
      recipients: payload.applicantIds.map((applicantId) => ({ applicantId, name: applicantId, email: `${applicantId}@example.test`, included: true, status: "Included", reason: "Communication Authority permits this recipient." }))
    };
  }
});

const browserWorkloadRequest = {
  product: "FODE",
  actionabilityState: "READY",
  worklistKey: "",
  workScope: "ALL_AUTHORISED",
  filters: { search: "" },
  sort: { key: "urgency", direction: "asc" },
  page: 1,
  pageSize: 25,
  expectedSnapshotId: ""
};

const oldClientGeneratedFingerprint = JSON.stringify({
  product: browserWorkloadRequest.product,
  actionabilityState: browserWorkloadRequest.actionabilityState,
  worklistKey: browserWorkloadRequest.worklistKey,
  workScope: browserWorkloadRequest.workScope,
  filters: browserWorkloadRequest.filters,
  sort: browserWorkloadRequest.sort,
  pageSize: browserWorkloadRequest.pageSize
});

const workloadResponse = jsonBoundary(context.eduops_queryOperationalWorkload(jsonBoundary(browserWorkloadRequest)));
const batchClientSource = read("EduOps_ClientBatch.html");
const eduopsHtmlSource = read("EduOps.html");

assert.equal(workloadResponse.ok, true, "workload query succeeds");
assert.equal(workloadResponse.totalMatched, 252, "workload query resolves the 252-member master cohort");
assert.equal(workloadResponse.reconciliation.totalAuthoritySelectable, 252, "authority-selectable cohort is 252");
assert.equal(workloadResponse.rows.length, 25, "page one remains bounded to 25 rows");
assert.equal(workloadResponse.queryBinding.schemaVersion, "EDUOPS_QUERY_BINDING_V1", "workload response carries a query binding schema");
assert.equal(workloadResponse.queryBinding.authority, "SERVER_AUTHORED", "query binding is server-authored");
assert.equal(workloadResponse.queryBinding.product, "FODE", "query binding is product-scoped");
assert.equal(workloadResponse.queryBinding.snapshotId, "SNAP-QUERY-BINDING", "query binding is snapshot-scoped");
assert.equal(workloadResponse.queryBinding.query.filters.search, "", "canonical binding carries default search");
assert.equal(workloadResponse.queryBinding.query.filters.owner, "", "canonical binding carries default owner");
assert.equal(workloadResponse.queryBinding.query.filters.urgency, "", "canonical binding carries default urgency");
assert.equal(workloadResponse.queryBinding.query.sort.direction, "ASC", "canonical binding normalizes sort direction");
assert.notEqual(
  oldClientGeneratedFingerprint,
  workloadResponse.queryBinding.queryFingerprint,
  "r360-style client fingerprint differs from the canonical server binding and reproduces the live mismatch class"
);

const selection = jsonBoundary({
  product: workloadResponse.queryBinding.product,
  snapshotId: workloadResponse.queryBinding.snapshotId,
  queryFingerprint: workloadResponse.queryBinding.queryFingerprint,
  query: workloadResponse.queryBinding.query,
  queryBinding: workloadResponse.queryBinding,
  selectionMode: "ALL_ELIGIBLE_MATCHING_QUERY",
  selectedApplicantIds: [],
  excludedApplicantIds: [],
  executionLimit: 30
});

const previewRequest = jsonBoundary({
  operation: "BATCH_COMMUNICATION",
  product: "FODE",
  snapshotId: workloadResponse.snapshotId,
  queryFingerprint: selection.queryFingerprint,
  executionLimit: 30,
  selection,
  idempotencyKey: "EDUOPS::BATCH_COMMUNICATION::COHORT::TEST",
  draft: { messageType: "documents_follow_up" }
});

const preview = context.eduops_previewCommand(previewRequest);

assert.equal(preview.ok, true, "batch preview succeeds without execution");
assert.equal(preview.state, "READY", "server-authored partition is ready");
assert.equal(preview.masterCohortSize, 252, "master cohort remains 252 after server revalidation");
assert.equal(preview.executionCohortSize, 30, "execution cohort is bounded to 30");
assert.equal(preview.remainingAfterExecution, 222, "remaining cohort is 222");
assert.equal(preview.partitions.length, 1, "server returns an executable partition");
assert.equal(preview.partitions[0].memberCount, 30, "partition member count is 30");
assert.equal(preview.selectionBinding.queryBinding.schemaVersion, "EDUOPS_QUERY_BINDING_V1", "preview retains the authoritative query binding");
assert.equal(previewAuthorityCalls, 1, "test performed preview only and did not execute or send");

const batchElements = {};
function batchElement(id) {
  if (!batchElements[id]) {
    batchElements[id] = {
      hidden: true,
      innerHTML: "",
      textContent: "",
      attributes: {},
      setAttribute(name, value) { this.attributes[name] = String(value); },
      focus() {},
      querySelector() { return null; }
    };
  }
  return batchElements[id];
}
const browserApp = {
  state: {
    product: "FODE",
    profile: { batchPolicy: { allowedExecutionLimits: [30], maximumExecutionLimit: 30 } },
    snapshotId: workloadResponse.snapshotId,
    workload: workloadResponse,
    selected: {},
    selectionMode: "ALL_ELIGIBLE_MATCHING_QUERY",
    selectionQueryBinding: workloadResponse.queryBinding,
    selectionExcluded: {},
    selectionExecutionLimit: 30,
    selectionMessageType: "",
    worklistKey: "",
    workbench: null,
    dirty: false
  },
  clone: jsonBoundary,
  esc: (value) => String(value == null ? "" : value),
  formatCode: (value) => String(value == null ? "" : value).replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()),
  humanize: (value) => String(value == null ? "" : value).replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase()),
  authorityUnavailable: (domain) => `Authoritative ${domain} decision was not returned. Refresh or retry before continuing.`,
  authorityLabel: (presentation, domain) => presentation && presentation.label ? presentation.label : `Authoritative ${domain} decision was not returned. Refresh or retry before continuing.`,
  operationAvailable: (operation) => operation === "BATCH_COMMUNICATION",
  operationUnavailableReason: () => "Authoritative operation availability was not returned. Refresh or retry.",
  setInteractionState() {},
  snapshotReturnContext: () => ({}),
  pushRoute() {}
};
const browserContext = {
  window: { EduOpsApp: browserApp },
  document: { getElementById: batchElement }
};
vm.createContext(browserContext);
vm.runInContext(batchClientSource.replace(/^<script>\s*/, "").replace(/\s*<\/script>\s*$/, ""), browserContext, { filename: "EduOps_ClientBatch.html" });
browserApp.openBatch({});
assert.equal(batchElements.eduopsBatchOperationStatus.textContent, "Operation: Operator intent captured - not yet revalidated", "query-wide cohort is identified as unvalidated operator intent");
assert.equal(batchElements.eduopsBatchOperationStatus.attributes["data-state"], "PENDING", "query-wide cohort remains pending until server revalidation");
assert.equal(batchElements.eduopsBatchExecutionStatus.textContent, "Execution: No execution performed", "batch header does not claim confirmed execution before execution");
assert.equal(browserApp.state.batch.masterCohortSize, 252, "client initial batch DTO retains the query-wide master cohort");
assert.equal(browserApp.state.batch.binding.selectedApplicantIds.length, 0, "opaque query-wide selection correctly carries no explicit applicant IDs");
assert.match(
  batchClientSource,
  /return "Operator intent captured - not yet revalidated"/,
  "query-wide master cohorts are not presented as authorised before server revalidation"
);
assert.doesNotMatch(
  batchClientSource,
  /batch\.binding\.selectedApplicantIds\.length \? "READY" : "BLOCKED"/,
  "batch operation status must not mistake an opaque query-wide selection for an empty explicit selection"
);
assert.doesNotMatch(
  batchClientSource,
  /app\.humanize\(batch\.preview[\s\S]*state/,
  "batch status must not map operation state through applicant Actionability labels"
);
assert.match(
  batchClientSource,
  /batch\.receipt \? "Execution completed" : "Execution: No execution performed"/,
  "execution status remains truthful before an execution receipt exists"
);
assert.match(eduopsHtmlSource, /id="eduopsBatchExecutionStatus"[\s\S]*No execution performed/, "batch shell starts with a truthful non-executed status");
assert.doesNotMatch(eduopsHtmlSource, />Confirmed execution</, "batch shell must not claim confirmed execution before confirmation or execution");

const missingBindingRequest = jsonBoundary(previewRequest);
delete missingBindingRequest.selection.queryBinding;
assert.throws(
  () => context.eduops_previewCommand(missingBindingRequest),
  /QUERY_SELECTION_CONTEXT_REQUIRED/,
  "all-query batch preview fails closed when the server binding is absent"
);

const staleClientFingerprintRequest = jsonBoundary(previewRequest);
staleClientFingerprintRequest.queryFingerprint = oldClientGeneratedFingerprint;
staleClientFingerprintRequest.selection.queryFingerprint = oldClientGeneratedFingerprint;
staleClientFingerprintRequest.selection.query = {
  product: "FODE",
  actionabilityState: "REVIEW_REQUIRED",
  worklistKey: "REVIEW_REQUIRED",
  workScope: "ALL_AUTHORISED",
  filters: { search: "client drift" },
  sort: { key: "name", direction: "desc" },
  pageSize: 50
};
const ignoredClientFieldsPreview = context.eduops_previewCommand(staleClientFingerprintRequest);
assert.equal(ignoredClientFieldsPreview.masterCohortSize, 252, "client-regenerated query fields are ignored for all-query validation");
assert.equal(ignoredClientFieldsPreview.executionCohortSize, 30, "server-issued binding still drives execution cohort resolution");

const staleSnapshotRequest = jsonBoundary(previewRequest);
staleSnapshotRequest.selection.queryBinding.snapshotId = "SNAP-OLD";
assert.throws(
  () => context.eduops_previewCommand(staleSnapshotRequest),
  /STALE_SELECTION_BINDING/,
  "snapshot expiry protection remains enforced"
);

console.log("PASS EduOps query binding hotfix: server-authored 252 -> 30 batch partition path verified without send");
