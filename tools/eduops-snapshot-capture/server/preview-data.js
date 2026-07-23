const fs = require("node:fs");
const path = require("node:path");

const CONTRACT_VERSION = "EDUOPS_SHADOW_V1";
const PROFILE_VERSION = "FODE_SHADOW_V1";
const SNAPSHOT_ID = "FODE-PREVIEW-SNAPSHOT-001";
const CHANGED_SNAPSHOT_ID = "FODE-PREVIEW-SNAPSHOT-002";
const PRODUCT_SNAPSHOT_IDS = { FODE: SNAPSHOT_ID, KIA: "KIA-PREVIEW-SNAPSHOT-001", MLC: "MLC-PREVIEW-SNAPSHOT-001" };
const SNAPSHOT_AS_OF = "2026-07-15T00:00:00.000Z";
const SNAPSHOT_FORMAT_VERSION = "EDUOPS_PREVIEW_SNAPSHOT_V1";
const SANITISATION_VERSION = "EDUOPS_PREVIEW_SANITISER_V1";
const previewStore = { previews: new Map(), receipts: new Map(), history: new Map() };
const PREVIEW_CAPABILITIES = {
  CAN_OPEN_REVIEW_WORKSPACE: true,
  CAN_SAVE_DOCUMENT_STATUSES: true,
  CAN_VERIFY_PAYMENT: true,
  CAN_PREVIEW_APPLICANT_COMMUNICATION: true,
  CAN_SEND_INDIVIDUAL_EMAIL: true,
  CAN_RUN_BATCH_COMMUNICATIONS: true,
  CAN_MANAGE_PORTAL_ACCESS: true,
  CAN_EDIT_CONTACT_DETAILS: true,
  CAN_WRITE_ZOHO_BOOKS: true
};
const PREVIEW_FLAGS = {
  DOCUMENT_REVIEW: true,
  FINANCE_EVIDENCE_DECISION: true,
  SEND_INDIVIDUAL_COMMUNICATION: true,
  CONTACTABILITY_CORRECTION: true,
  PORTAL_ACCESS: true,
  BATCH_COMMUNICATION: true,
  BOOKS_ACTION: false
};

const STATE_LABELS = {
  READY: "Ready Now",
  COOLING_OFF: "Cooling Off",
  AWAITING_APPLICANT: "Awaiting Applicant",
  AWAITING_PAYMENT: "Awaiting Payment",
  REVIEW_REQUIRED: "Review Required",
  BLOCKED: "Blocked",
  UNKNOWN: "Unknown",
  COMPLETE: "Complete"
};

const STATE_COUNTS = {
  READY: 60,
  COOLING_OFF: 12,
  AWAITING_APPLICANT: 22,
  AWAITING_PAYMENT: 18,
  REVIEW_REQUIRED: 75,
  BLOCKED: 8,
  UNKNOWN: 4,
  COMPLETE: 1
};

const SCENARIOS = [
  ["normal-authoritative", "Normal authoritative", "Stable snapshot, representative workload, exact Workbench and document PNG available."],
  ["slow-6s", "Slow request - 6 seconds", "Workload call is delayed six seconds to inspect pending state and supersession."],
  ["timeout-10s", "Timeout - over 10 seconds", "Workload call exceeds the client timeout and exposes retry."],
  ["stale-snapshot", "Stale snapshot", "A prior expected snapshot is rejected without silent rebasing."],
  ["conflicting-authority", "Conflicting authority", "Rows are visible but no confident READY state is presented."],
  ["source-unavailable", "Source unavailable", "Workload is unavailable with no false confidence."],
  ["empty-escalated-scope", "Empty Escalated scope", "Non-zero Actionability total with zero scoped matches is explicit."],
  ["pinned-ownership-scope", "Pinned ownership scope", "Pinned Escalated scope persists across Actionability."],
  ["unpinned-ownership-scope", "Unpinned ownership scope", "Changing Actionability resets to All Authorised."],
  ["rapid-supersession", "Rapid supersession", "Fast navigation keeps only the latest useful workload response."],
  ["document-png-available", "Document PNG available", "Derived PNG rendition and separate original action are available."],
  ["document-preview-unavailable", "Document preview unavailable", "PNG fallback wording and Open Original representation remain available."],
  ["invalid-cross-applicant-document", "Invalid cross-applicant document context", "Another applicant document context is rejected."],
  ["successful-document-review", "Successful document review", "A document decision returns a versioned simulated receipt."],
  ["rejected-document", "Rejected document", "A rejected document remains applicant-specific and receipted."],
  ["correction-request", "Correction request", "A document correction request hands off to an individual reviewed communication."],
  ["dirty-document-state", "Dirty document state", "Unsaved document edits invoke the shared navigation guard."],
  ["contact-correction", "Contact correction", "An exact applicant email correction returns a simulated receipt."],
  ["communication-preview", "Communication preview", "Recipient, template, cooling-off and contactability are previewed."],
  ["communication-send-receipt", "Communication send receipt", "A simulated individual send returns a versioned receipt."],
  ["cooling-off-denial", "Cooling-off denial", "Communication preview fails closed while the applicant is cooling off."],
  ["contactability-failure", "Contactability failure", "No effective email and suppressed communication state are explained."],
  ["duplicate-send-replay", "Duplicate send replay", "Repeated send execution returns the original idempotent receipt."],
  ["finance-verification", "Finance verification", "A supported individual verification returns a simulated receipt."],
  ["finance-rejection", "Finance rejection unavailable", "Rejection remains blocked because no dedicated authority is proven."],
  ["books-approval-blocked", "Books approval blocked", "Books execution remains disabled and independently approval-gated."],
  ["portal-resend", "Portal resend", "Portal resend hands off to the reviewed Communications surface."],
  ["portal-reset-approval-blocked", "Portal reset approval blocked", "Reset cannot execute without independent approval."],
  ["large-workload", "Large workload", "Population-scale deterministic paging without browser-wide data loading."],
  ["expired-command-preview", "Expired command preview", "A command preview expires before confirmation and cannot execute."],
  ["stale-command-preview", "Stale command preview", "The product snapshot changes after preview and execution fails closed."],
  ["capability-denied", "Capability denied", "The simulated operator lacks the operation capability."],
  ["feature-flag-disabled", "Feature flag disabled", "The domain operation is not enabled."],
  ["operation-lock-conflict", "Operation lock conflict", "Another simulated operation holds the guarded lock."],
  ["partial-batch-failure", "Partial batch failure", "One applicant changes authority after preview and is handed off as an exception."],
  ["successful-batch", "Successful batch", "A bounded communication cohort returns applicant-level receipts."],
  ["batch-cap-exceeded", "Batch cap exceeded", "A cohort above the execution cap fails closed before confirmation."],
  ["exception-handoff", "Batch exception handoff", "A blocked applicant opens in the exact Individual Workbench."],
  ["work-session-progress", "Work Session progress", "Exact ApplicantID, position and outcomes remain visible through the session."],
  ["idempotent-replay", "Idempotent replay", "Repeated execution returns the original versioned receipt."],
  ["altered-replay-payload", "Altered replay payload", "A reused idempotency context with altered confirmation is rejected."],
  ["product-isolation", "Product state isolation", "FODE, KIA and MLC retain independent snapshots and workspace state."]
].map(([id, label, description]) => ({ id, label, description }));

function listScenarios() {
  return SCENARIOS.slice();
}

function scenarioById(id) {
  return SCENARIOS.find((item) => item.id === id) || SCENARIOS[0];
}

function nowIso() {
  return new Date().toISOString();
}

function productCode(value) {
  const key = String(value || "FODE").toUpperCase();
  return Object.prototype.hasOwnProperty.call(PRODUCT_SNAPSHOT_IDS, key) ? key : "FODE";
}

function productSnapshotId(product) {
  return PRODUCT_SNAPSHOT_IDS[productCode(product)];
}

function rowsForProduct(product, scenarioId) {
  const key = productCode(product);
  const rows = rowsForScenario(scenarioId);
  if (key === "FODE") return rows;
  return rows.map((source) => {
    const applicantId = String(source.applicantId).replace(/^FODE/, key);
    return {
      ...source,
      product: key,
      applicantId,
      rowKey: String(source.rowKey || "").replace(/^FODE/, key),
      displayName: `${key} ${source.displayName}`,
      snapshotId: productSnapshotId(key),
      returnContext: { ...source.returnContext, product: key, applicantId }
    };
  });
}

function scopeFor(row) {
  if (row.urgencyLevel === "ESCALATED" || row.urgencyLevel === "CRITICAL") return "ESCALATED";
  if (row.actionOwner === "NONE") return "UNASSIGNED";
  if (row.actionOwner === "APPLICANT") return "TEAM";
  return "MY";
}

function exactRows() {
  return [
    row({
      index: 1,
      applicantId: "FODE-26-002985",
      rowNumber: 2985,
      name: "Jackson Numa",
      email: "jackson.numa@example.test",
      phone: "+675 7000 2985",
      actionabilityState: "READY",
      worklistKey: "DOCUMENT_REVIEW",
      worklistLabel: "Document review",
      nextAction: "Review document evidence",
      actionOwner: "OFFICER",
      urgencyLevel: "CRITICAL",
      documentState: "REVIEW_REQUIRED",
      financeState: "NOT_YET_PAYMENT_APPLICABLE",
      contactabilityState: "EMAIL_AVAILABLE",
      recommendedMessageType: "DOCUMENT_REVIEW_REQUIRED"
    }),
    row({
      index: 2,
      applicantId: "FODE-26-002959",
      rowNumber: 2959,
      name: "Keziah Waffi",
      email: "keziah.waffi@example.test",
      phone: "+675 7000 2959",
      actionabilityState: "REVIEW_REQUIRED",
      worklistKey: "DOCUMENT_REVIEW",
      worklistLabel: "Document review",
      nextAction: "Inspect document PNG rendition",
      actionOwner: "OFFICER",
      urgencyLevel: "ESCALATED",
      documentState: "REVIEW_REQUIRED",
      financeState: "PAYMENT_NOT_APPLICABLE",
      contactabilityState: "EMAIL_AVAILABLE",
      recommendedMessageType: "DOCUMENT_REVIEW_REQUIRED"
    }),
    row({
      index: 3,
      applicantId: "FODE-26-TEST-004",
      rowNumber: 9004,
      name: "TEST_COMM_D Payment Verified",
      email: "test.comm.d@example.test",
      phone: "+675 7000 9004",
      actionabilityState: "COMPLETE",
      worklistKey: "PAYMENT_VERIFIED",
      worklistLabel: "Payment verified",
      nextAction: "No immediate operator action",
      actionOwner: "FINANCE",
      urgencyLevel: "NORMAL",
      documentState: "VERIFIED",
      financeState: "PAID_VERIFIED",
      contactabilityState: "EMAIL_AVAILABLE",
      recommendedMessageType: "PAYMENT_VERIFIED_RECEIPT"
    })
  ];
}

function row(input) {
  const scope = input.workScope || scopeFor(input);
  return {
    rowKey: `FODE:${input.applicantId}:${input.rowNumber}`,
    rowNumber: input.rowNumber,
    applicantId: input.applicantId,
    displayName: input.name,
    email: input.email,
    phone: input.phone,
    actionabilityState: input.actionabilityState,
    actionabilityLabel: STATE_LABELS[input.actionabilityState] || input.actionabilityState,
    worklistKey: input.worklistKey,
    worklistLabel: input.worklistLabel,
    primaryRoute: input.primaryRoute || routeFor(input.nextAction),
    actionOwner: input.actionOwner,
    workOwnership: {
      scope,
      assignedOperator: scope === "MY" ? "Current authorised operator" : "",
      assignedTeam: input.actionOwner,
      assignmentSource: "Preview fixture projection",
      dueAt: "2026-07-15",
      escalationState: scope === "ESCALATED" ? "Escalated projection" : "Not escalated",
      unassignedReason: scope === "UNASSIGNED" ? "No current operator owner in fixture projection" : ""
    },
    nextAction: input.nextAction,
    selectable: input.selectable !== false,
    selectBlockReason: input.selectBlockReason || "",
    blockerCode: input.blockerCode || "",
    blockerReason: input.blockerReason || input.selectBlockReason || "",
    urgencyLevel: input.urgencyLevel || "NORMAL",
    urgencyReason: input.urgencyReason || "Preview deterministic ordering",
    coolingOffUntil: input.coolingOffUntil || "",
    recommendedMessageType: input.recommendedMessageType || "",
    communicationAuthoritySummary: input.communicationAuthoritySummary || "Read-only preview communication authority",
    canonicalLifecycle: {
      baseState: input.actionabilityState,
      lifecycleStage: input.actionabilityState,
      overlays: [],
      recommendedNextAction: input.nextAction,
      recommendedMessageType: input.recommendedMessageType || "",
      actionOwner: input.actionOwner,
      reason: "Preview fixture authority"
    },
    canonicalFinanceState: input.financeState || "UNKNOWN",
    documentState: input.documentState || "UNKNOWN",
    contactabilityState: input.contactabilityState || "EMAIL_AVAILABLE",
    portalState: input.portalState || "SUBMITTED",
    sourceReliability: reliability("AUTHORITATIVE", "Preview fixture authority is deterministic."),
    authorityProjectionVersion: CONTRACT_VERSION,
    returnContext: {
      product: "FODE",
      actionabilityState: input.actionabilityState,
      worklistKey: input.worklistKey,
      workScope: scope,
      page: 1,
      pageSize: 25,
      applicantId: input.applicantId
    },
    snapshotId: SNAPSHOT_ID
  };
}

function routeFor(nextAction) {
  if (/payment/i.test(nextAction || "")) return "Finance";
  if (/contact/i.test(nextAction || "")) return "Contactability";
  if (/portal/i.test(nextAction || "")) return "Portal";
  return "Admissions Review";
}

function generatedRows(size = 200) {
  const rows = exactRows();
  const stateKeys = Object.keys(STATE_COUNTS);
  for (let i = 4; i <= size; i += 1) {
    const state = stateKeys[(i - 4) % stateKeys.length];
    const escalated = state === "REVIEW_REQUIRED" && i % 5 !== 0;
    rows.push(row({
      index: i,
      applicantId: `FODE-26-PREVIEW-${String(i).padStart(4, "0")}`,
      rowNumber: 5000 + i,
      name: `Preview Applicant ${String(i).padStart(3, "0")}`,
      email: `preview.${i}@example.test`,
      phone: `+675 7000 ${String(i).padStart(4, "0")}`,
      actionabilityState: state,
      worklistKey: state === "AWAITING_PAYMENT" || state === "COMPLETE" ? "FINANCE_REVIEW" : "DOCUMENT_REVIEW",
      worklistLabel: state === "AWAITING_PAYMENT" || state === "COMPLETE" ? "Finance review" : "Document review",
      nextAction: state === "COMPLETE" ? "No immediate operator action" : "Review authoritative fixture",
      actionOwner: escalated ? "OFFICER" : (i % 7 === 0 ? "APPLICANT" : "OFFICER"),
      urgencyLevel: escalated ? "ESCALATED" : (i % 11 === 0 ? "HIGH" : "NORMAL"),
      documentState: i % 3 === 0 ? "REVIEW_REQUIRED" : "VERIFIED",
      financeState: state === "AWAITING_PAYMENT" ? "PAYMENT_PENDING" : "NOT_YET_PAYMENT_APPLICABLE",
      contactabilityState: i % 13 === 0 ? "EMAIL_SUPPRESSED" : "EMAIL_AVAILABLE",
      recommendedMessageType: "PREVIEW_NOTICE"
    }));
  }
  return rows;
}

function rowsForScenario(scenarioId) {
  const rows = generatedRows(scenarioId === "large-workload" ? 360 : 200);
  if (scenarioId === "contactability-failure") {
    rows.unshift(row({
      index: 1001,
      applicantId: "FODE-26-CONTACT-001",
      rowNumber: 9101,
      name: "Contactability Failure Fixture",
      email: "",
      phone: "+675 7000 1111",
      actionabilityState: "READY",
      worklistKey: "CONTACTABILITY",
      worklistLabel: "Contactability",
      nextAction: "Fix contact details",
      actionOwner: "OFFICER",
      urgencyLevel: "HIGH",
      documentState: "REVIEW_REQUIRED",
      financeState: "NOT_YET_PAYMENT_APPLICABLE",
      contactabilityState: "EMAIL_SUPPRESSED",
      communicationAuthoritySummary: "No effective email; communication is suppressed in preview."
    }));
  }
  return rows;
}

function getDelayMs(scenarioId, overrideMs) {
  if (Number.isFinite(Number(overrideMs)) && Number(overrideMs) >= 0) return Number(overrideMs);
  if (scenarioId === "slow-6s") return 6000;
  if (scenarioId === "timeout-10s") return 11200;
  if (scenarioId === "rapid-supersession") return 750;
  return 250;
}

function snapshotIncompatible(message, snapshot) {
  return {
    ok: false,
    readOnly: true,
    code: "SNAPSHOT_INCOMPATIBLE",
    message: message || "Snapshot incompatible with this EduOps build. Capture a new FODE snapshot or select a compatible deterministic scenario.",
    snapshotMetadata: snapshot && snapshot.metadata || null
  };
}

function snapshotMissing() {
  return {
    ok: false,
    readOnly: true,
    code: "SNAPSHOT_REQUIRED",
    message: "Select a compatible Fresh FODE snapshot or use deterministic scenario mode."
  };
}

function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return snapshotMissing();
  var metadata = snapshot.metadata || {};
  if (metadata.snapshotFormatVersion !== SNAPSHOT_FORMAT_VERSION) return snapshotIncompatible("Snapshot incompatible with this EduOps build. Capture a new FODE snapshot or select a compatible deterministic scenario.", snapshot);
  if (metadata.contractVersion !== CONTRACT_VERSION) return snapshotIncompatible("Snapshot incompatible with this EduOps build. Capture a new FODE snapshot or select a compatible deterministic scenario.", snapshot);
  if (!snapshot.workloads || !snapshot.workloads.default || !Array.isArray(snapshot.workloads.default.rows)) return snapshotIncompatible("Incomplete snapshot: default workload rows are missing.", snapshot);
  if (!snapshot.exactApplicants || typeof snapshot.exactApplicants !== "object") return snapshotIncompatible("Incomplete snapshot: exact applicant Workbench fixtures are missing.", snapshot);
  return { ok: true };
}

function snapshotRows(snapshot) {
  var valid = validateSnapshot(snapshot);
  if (valid.ok !== true) return valid;
  return (snapshot.workloads.default.rows || []).map(function (item) {
    var copy = { ...item };
    copy.sourceReliability = copy.sourceReliability || reliability(snapshot.metadata.sourceReliability || "AUTHORITATIVE", "Captured snapshot fixture.");
    return copy;
  });
}

function snapshotActionabilityCounts(snapshot) {
  return snapshot.counts && snapshot.counts.actionabilityCounts || snapshot.workloads && snapshot.workloads.default && snapshot.workloads.default.actionabilityCounts || {};
}

function snapshotWorklistCounts(snapshot, state) {
  var rows = snapshotRows(snapshot);
  if (!Array.isArray(rows)) return {};
  return worklistCounts(rows, state);
}

function snapshotWorkload(context, payload) {
  var snapshot = context.snapshot;
  var valid = validateSnapshot(snapshot);
  if (valid.ok !== true) return valid;
  var query = normalizePayload(payload);
  var metadata = snapshot.metadata || {};
  if (query.expectedSnapshotId && query.expectedSnapshotId !== metadata.snapshotId) {
    return staleResponse(query, metadata.snapshotId);
  }
  var rows = snapshotRows(snapshot);
  var filtered = filterRows(rows, query);
  var sorted = sortRows(filtered, query.sort);
  var totalMatched = sorted.length;
  var totalPages = Math.max(1, Math.ceil(totalMatched / query.pageSize));
  var page = Math.min(query.page, totalPages);
  var pageRows = sorted.slice((page - 1) * query.pageSize, page * query.pageSize);
  var rel = reliability(metadata.sourceReliability || "AUTHORITATIVE", "Fresh FODE snapshot fixture captured from read-only EduOps DTOs.");
  var response = {
    ok: true,
    readOnly: true,
    contractVersion: metadata.contractVersion,
    product: "FODE",
    profileVersion: metadata.profileVersion || PROFILE_VERSION,
    snapshotId: metadata.snapshotId,
    snapshotAsOf: metadata.sourceAsOf || metadata.capturedAt,
    snapshotCacheState: "LOCAL_CAPTURE",
    authorityStatus: rel.authorityStatus,
    sourceStatus: rel.sourceStatus,
    reliabilityState: rel.state,
    reliabilityReasons: rel.reasons,
    actionabilityState: query.actionabilityState,
    worklistKey: query.worklistKey,
    workScope: query.workScope,
    filters: query.filters,
    sort: query.sort,
    page: page,
    pageSize: query.pageSize,
    totalMatched: totalMatched,
    totalPages: totalPages,
    actionabilityCounts: snapshotActionabilityCounts(snapshot),
    worklistKeyCounts: snapshotWorklistCounts(snapshot, query.actionabilityState),
    metricCounts: metricCounts(filtered),
    reconciliation: snapshot.reconciliation || reconciliation(rows, filtered, pageRows, query, metadata.snapshotId),
    rows: pageRows.map(function (rowItem) { return { ...rowItem, snapshotId: metadata.snapshotId, sourceReliability: rel }; })
  };
  response.timings = timings(response, context.serverDurationMs || 0);
  return response;
}

function normalizePayload(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  return {
    product: productCode(p.product),
    actionabilityState: String(p.actionabilityState || "READY").toUpperCase(),
    worklistKey: String(p.worklistKey || ""),
    workScope: String(p.workScope || "ALL_AUTHORISED").toUpperCase(),
    filters: p.filters && typeof p.filters === "object" ? p.filters : {},
    sort: p.sort && typeof p.sort === "object" ? p.sort : { key: "urgency", direction: "asc" },
    page: Math.max(1, Number(p.page || 1) || 1),
    pageSize: [10, 25, 50].includes(Number(p.pageSize)) ? Number(p.pageSize) : 25,
    expectedSnapshotId: String(p.expectedSnapshotId || "")
  };
}

function queryOperationalWorkload(context, payload) {
  if (context.mode === "snapshot") return snapshotWorkload(context, payload);
  const scenarioId = context.scenarioId || "normal-authoritative";
  const query = normalizePayload(payload);
  if (scenarioId === "source-unavailable") {
    return unavailableResponse(query, "SOURCE_UNAVAILABLE", "Preview source authority is unavailable.");
  }
  const currentSnapshotId = scenarioId === "stale-snapshot" && query.expectedSnapshotId ? (query.product === "FODE" ? CHANGED_SNAPSHOT_ID : query.product + "-PREVIEW-SNAPSHOT-002") : productSnapshotId(query.product);
  if (query.expectedSnapshotId && query.expectedSnapshotId !== currentSnapshotId) {
    return staleResponse(query, currentSnapshotId);
  }
  let rows = rowsForProduct(query.product, scenarioId);
  const rel = scenarioId === "conflicting-authority"
    ? reliability("CONFLICTING", "Preview scenario reports conflicting source authorities.")
    : reliability("AUTHORITATIVE", "Preview fixture authority is deterministic.");
  if (scenarioId === "conflicting-authority") {
    rows = rows.map((item) => ({ ...item, actionabilityState: item.actionabilityState === "READY" ? "UNKNOWN" : item.actionabilityState, actionabilityLabel: item.actionabilityState === "READY" ? "Unknown" : item.actionabilityLabel, selectable: false, selectBlockReason: "Source conflict prevents confident readiness.", sourceReliability: rel }));
  }
  const actionabilityCounts = { ...STATE_COUNTS };
  if (scenarioId === "large-workload") actionabilityCounts.READY = 134;
  const filtered = filterRows(rows, query);
  const sorted = sortRows(filtered, query.sort);
  const totalMatched = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalMatched / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const pageRows = sorted.slice((page - 1) * query.pageSize, page * query.pageSize).map((item) => ({ ...item, sourceReliability: rel, snapshotId: currentSnapshotId }));
  const response = {
    ok: true,
    readOnly: true,
    contractVersion: CONTRACT_VERSION,
    product: query.product,
    profileVersion: PROFILE_VERSION,
    snapshotId: currentSnapshotId,
    snapshotAsOf: SNAPSHOT_AS_OF,
    snapshotCacheState: "PREVIEW",
    authorityStatus: rel.authorityStatus,
    sourceStatus: rel.sourceStatus,
    reliabilityState: rel.state,
    reliabilityReasons: rel.reasons,
    actionabilityState: query.actionabilityState,
    worklistKey: query.worklistKey,
    workScope: query.workScope,
    filters: query.filters,
    sort: query.sort,
    page,
    pageSize: query.pageSize,
    totalMatched,
    totalPages,
    actionabilityCounts,
    worklistKeyCounts: worklistCounts(rows, query.actionabilityState),
    metricCounts: metricCounts(filtered),
    reconciliation: reconciliation(rows, filtered, pageRows, query, currentSnapshotId),
    rows: pageRows
  };
  response.timings = timings(response, context.serverDurationMs || 0);
  return response;
}

function filterRows(rows, query) {
  const filters = query.filters || {};
  const search = String(filters.search || "").toLowerCase();
  return rows.filter((rowItem) => {
    if (query.actionabilityState !== "ALL" && rowItem.actionabilityState !== query.actionabilityState) return false;
    if (query.worklistKey && rowItem.worklistKey !== query.worklistKey) return false;
    if (query.workScope !== "ALL_AUTHORISED" && rowItem.workOwnership.scope !== query.workScope) return false;
    if (filters.owner && rowItem.actionOwner !== filters.owner) return false;
    if (filters.urgency && rowItem.urgencyLevel !== filters.urgency) return false;
    if (filters.primaryRoute && rowItem.primaryRoute !== filters.primaryRoute) return false;
    if (filters.documentState && rowItem.documentState !== filters.documentState) return false;
    if (filters.financeState && rowItem.canonicalFinanceState !== filters.financeState) return false;
    if (filters.contactabilityState && rowItem.contactabilityState !== filters.contactabilityState) return false;
    if (filters.communicationState && rowItem.recommendedMessageType !== filters.communicationState) return false;
    if (filters.blockKind && rowItem.blockerCode !== filters.blockKind) return false;
    if (filters.cooling === "ACTIVE" && !rowItem.coolingOffUntil) return false;
    if (filters.cooling === "NONE" && rowItem.coolingOffUntil) return false;
    if (search) {
      const hay = [rowItem.applicantId, rowItem.displayName, rowItem.email, rowItem.phone, rowItem.worklistLabel].join(" ").toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

function sortRows(rows, sort) {
  const direction = String(sort && sort.direction || "asc").toLowerCase() === "desc" ? -1 : 1;
  return rows.slice().sort((a, b) => {
    const cmp = urgencyRank(a.urgencyLevel) - urgencyRank(b.urgencyLevel)
      || String(a.applicantId).localeCompare(String(b.applicantId))
      || Number(a.rowNumber || 0) - Number(b.rowNumber || 0);
    return cmp * direction;
  });
}

function urgencyRank(value) {
  const map = { CRITICAL: 0, UNCONTACTABLE: 1, ESCALATED: 2, DORMANT: 3, OVERDUE: 4, HIGH: 5, DUE: 6, NORMAL: 7, LOW: 8 };
  return Object.prototype.hasOwnProperty.call(map, String(value || "").toUpperCase()) ? map[String(value || "").toUpperCase()] : 99;
}

function worklistCounts(rows, state) {
  return rows.reduce((out, rowItem) => {
    if (state === "ALL" || rowItem.actionabilityState === state) out[rowItem.worklistKey] = Number(out[rowItem.worklistKey] || 0) + 1;
    return out;
  }, {});
}

function metricCounts(rows) {
  return rows.reduce((out, rowItem) => {
    if (rowItem.selectable) out.eligibleNow += 1;
    const key = rowItem.actionabilityState.toLowerCase().replace(/_([a-z])/g, (_m, c) => c.toUpperCase());
    if (Object.prototype.hasOwnProperty.call(out, key)) out[key] += 1;
    return out;
  }, { eligibleNow: 0, coolingOff: 0, awaitingApplicant: 0, awaitingPayment: 0, reviewRequired: 0, blocked: 0, unknown: 0, complete: 0 });
}

function reconciliation(allRows, matchedRows, pageRows, query, snapshotId) {
  const matched = new Set(matchedRows.map((rowItem) => rowItem.applicantId));
  const page = new Set(pageRows.map((rowItem) => rowItem.applicantId));
  const hiddenReasons = allRows.filter((rowItem) => !matched.has(rowItem.applicantId)).slice(0, 50).map((rowItem) => ({
    applicantId: rowItem.applicantId,
    displayName: rowItem.displayName,
    reasonCode: query.actionabilityState !== "ALL" && rowItem.actionabilityState !== query.actionabilityState ? rowItem.actionabilityState : "FILTERED_FROM_VIEW",
    reason: query.actionabilityState !== "ALL" && rowItem.actionabilityState !== query.actionabilityState ? `${STATE_LABELS[rowItem.actionabilityState]} is outside this Actionability state.` : "Applicant is outside the selected work scope or filter.",
    actionabilityState: rowItem.actionabilityState,
    worklistKey: rowItem.worklistKey,
    selectable: rowItem.selectable
  }));
  return {
    canonicalPopulation: allRows.length,
    totalMatched: matchedRows.length,
    visiblePageCount: pageRows.length,
    visiblePageRange: pageRows.length ? `${((query.page - 1) * query.pageSize) + 1}-${((query.page - 1) * query.pageSize) + pageRows.length}` : "0",
    returnedWindow: pageRows.length,
    eligibleOutsideCurrentWindow: matchedRows.filter((rowItem) => rowItem.selectable && !page.has(rowItem.applicantId)).length,
    hiddenFromCurrentView: hiddenReasons.length,
    excludedFromOperation: matchedRows.filter((rowItem) => !rowItem.selectable).length,
    metricCounts: metricCounts(matchedRows),
    oldestVisibleAgeDays: 14,
    oldestMatchedAgeDays: 29,
    nextOperatorAction: pageRows[0] ? pageRows[0].nextAction : "",
    snapshotId,
    asOf: SNAPSHOT_AS_OF,
    integrityState: "PASS",
    arithmetic: "canonicalPopulation = totalMatched + hiddenFromCurrentView",
    hiddenReasons
  };
}

function reliability(state, reason) {
  return {
    state,
    sourceStatus: state,
    authorityStatus: state === "AUTHORITATIVE" ? "AUTHORITATIVE" : state,
    reasons: [reason],
    domain: "EduOps Preview Lab",
    asOf: nowIso()
  };
}

function timings(response, serverDurationMs) {
  const approx = Number(serverDurationMs || 0);
  return {
    accessMs: 1,
    serverRpcMs: approx,
    canonicalSnapshotResolutionMs: Math.min(120, Math.max(2, Math.round(approx * 0.1))),
    sourceVersionMs: 1,
    cacheReadMs: 1,
    canonicalBuildMs: 0,
    projectionMs: 2,
    cacheWriteMs: 0,
    workloadCompositionMs: Math.min(180, Math.max(3, Math.round(approx * 0.2))),
    sortingPagingMs: Math.min(80, Math.max(1, Math.round(approx * 0.05))),
    responseBytes: Buffer.byteLength(JSON.stringify(response), "utf8")
  };
}

function staleResponse(query, snapshotId) {
  return {
    ok: true,
    readOnly: true,
    contractVersion: CONTRACT_VERSION,
    product: "FODE",
    profileVersion: PROFILE_VERSION,
    snapshotId,
    snapshotAsOf: SNAPSHOT_AS_OF,
    reliabilityState: "STALE",
    reliabilityReasons: ["The requested preview workload snapshot no longer matches the current fixture authority snapshot."],
    actionabilityState: query.actionabilityState,
    worklistKey: query.worklistKey,
    workScope: query.workScope,
    filters: query.filters,
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
    totalMatched: 0,
    totalPages: 1,
    actionabilityCounts: { ...STATE_COUNTS },
    worklistKeyCounts: {},
    metricCounts: metricCounts([]),
    reconciliation: { integrityState: "STALE", hiddenReasons: [], snapshotId },
    rows: [],
    timings: { serverRpcMs: 0, canonicalSnapshotResolutionMs: 1, workloadCompositionMs: 1, sortingPagingMs: 1, responseBytes: 0 }
  };
}

function unavailableResponse(query, code, message) {
  return {
    ok: false,
    readOnly: true,
    code,
    message,
    reliabilityState: "UNKNOWN",
    reliabilityReasons: [message],
    actionabilityState: query.actionabilityState,
    page: query.page,
    pageSize: query.pageSize
  };
}

function searchApplicants(context, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const product = productCode(p.product);
  if (context.mode === "snapshot") {
    var valid = validateSnapshot(context.snapshot);
    if (valid.ok !== true) return valid;
    var metadata = context.snapshot.metadata || {};
    if (p.expectedSnapshotId && p.expectedSnapshotId !== metadata.snapshotId) return { ok: false, readOnly: true, code: "STALE_SNAPSHOT", snapshotId: metadata.snapshotId, expectedSnapshotId: String(p.expectedSnapshotId || "") };
    var snapshotNeedle = String(p.query || "").toLowerCase();
    var snapshotMatches = snapshotRows(context.snapshot).filter(function (rowItem) {
      return [rowItem.applicantId, rowItem.displayName, rowItem.email, rowItem.phone].join(" ").toLowerCase().indexOf(snapshotNeedle) >= 0;
    });
    return { ok: true, readOnly: true, product: "FODE", query: p.query || "", snapshotId: metadata.snapshotId, totalMatches: snapshotMatches.length, matches: snapshotMatches.slice(0, Number(p.limit || 12)), timings: { searchMs: 4 } };
  }
  const snapshotId = productSnapshotId(product);
  if (p.expectedSnapshotId && p.expectedSnapshotId !== snapshotId) {
    return { ok: false, readOnly: true, code: "STALE_SNAPSHOT", snapshotId, expectedSnapshotId: String(p.expectedSnapshotId || "") };
  }
  const query = String(p.query || "").toLowerCase();
  const rows = rowsForProduct(product, context.scenarioId).filter((rowItem) => [rowItem.applicantId, rowItem.displayName, rowItem.email, rowItem.phone].join(" ").toLowerCase().includes(query));
  return { ok: true, readOnly: true, product, query: p.query || "", snapshotId, totalMatches: rows.length, matches: rows.slice(0, Number(p.limit || 12)), timings: { searchMs: 4 } };
}

function getApplicantWorkbench(context, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const product = productCode(p.product || String(p.applicantId || "").split("-")[0]);
  if (context.mode === "snapshot") {
    var valid = validateSnapshot(context.snapshot);
    if (valid.ok !== true) return valid;
    var metadata = context.snapshot.metadata || {};
    if (p.expectedSnapshotId && p.expectedSnapshotId !== metadata.snapshotId) return { ok: false, readOnly: true, code: "STALE_SNAPSHOT", reliabilityState: "STALE", snapshotId: metadata.snapshotId, expectedSnapshotId: String(p.expectedSnapshotId || ""), message: "The applicant was requested from a stale captured snapshot." };
    var captured = context.snapshot.exactApplicants[String(p.applicantId || "")];
    if (!captured) return { ok: false, readOnly: true, code: "APPLICANT_NOT_FOUND", applicantId: p.applicantId };
    return captured.workbench || captured;
  }
  const snapshotId = productSnapshotId(product);
  if (p.expectedSnapshotId && p.expectedSnapshotId !== snapshotId) {
    return { ok: false, readOnly: true, code: "STALE_SNAPSHOT", reliabilityState: "STALE", snapshotId, expectedSnapshotId: String(p.expectedSnapshotId || ""), message: "The applicant was requested from a stale workload snapshot." };
  }
  const allRows = rowsForProduct(product, context.scenarioId);
  const found = allRows.find((rowItem) => rowItem.applicantId === p.applicantId);
  if (!found) return { ok: false, readOnly: true, code: "APPLICANT_NOT_FOUND", applicantId: p.applicantId };
  return {
    ok: true,
    readOnly: true,
    product,
    snapshotId,
    rowKey: found.rowKey,
    applicantId: found.applicantId,
    identity: {
      applicantId: found.applicantId,
      rowNumber: found.rowNumber,
      displayName: found.displayName,
      email: found.email,
      phone: found.phone
    },
    exactAuthorityProjection: found,
    applicantDetail: { ok: true, applicantId: found.applicantId, displayName: found.displayName, rowNumber: found.rowNumber, readOnly: true },
    documents: { state: found.documentState, verified: found.documentState === "VERIFIED", requiredComplete: found.documentState === "VERIFIED", uploadedRequiredCount: 2, requiredCount: 3, missingRequiredDocuments: found.documentState === "VERIFIED" ? [] : ["Proof of identity"], actions: [readOnlyAction("Save document statuses", "CAN_SAVE_DOCUMENT_STATUSES")] },
    finance: { state: found.canonicalFinanceState, paymentApplicable: found.canonicalFinanceState !== "NOT_YET_PAYMENT_APPLICABLE", paymentEvidencePresent: found.canonicalFinanceState === "PAID_VERIFIED" || found.applicantId === "FODE-26-002959", paymentVerified: found.canonicalFinanceState === "PAID_VERIFIED", owner: found.actionOwner, blocker: "", nextAction: found.nextAction, invoiceReadiness: "Preview only", booksMatch: "Informational fixture", actions: [readOnlyAction("Verify payment", "CAN_VERIFY_PAYMENT")] },
    communications: { recommendedMessageType: found.recommendedMessageType || "docs_missing", eligibility: found.communicationAuthoritySummary, coolingOffUntil: found.coolingOffUntil, latestCommunication: "2026-07-10T08:00:00.000Z", deliveryState: "No active bounce", suppressionState: "None", actions: [readOnlyAction("Send individual email", "CAN_SEND_INDIVIDUAL_EMAIL")] },
    portal: { state: found.portalState, submitted: found.portalState === "SUBMITTED", accessState: "Open", locked: false, tokenState: "Authoritative token retained server-side", expiresAt: "2026-08-15T00:00:00.000Z", actions: [readOnlyAction("Manage portal access", "CAN_MANAGE_PORTAL_ACCESS")] },
    contactability: { state: found.contactabilityState, effectiveEmail: found.email, emailSource: "Deterministic applicant fixture", phone: found.phone, hasValidEmail: !!found.email && found.contactabilityState !== "EMAIL_SUPPRESSED", hasPhoneFallback: !!found.phone, suppressionState: found.contactabilityState === "EMAIL_SUPPRESSED" ? "Suppressed" : "None", actions: [readOnlyAction("Correct contact details", "CAN_EDIT_CONTACT_DETAILS")] },
    auditSummary: { preview: true, source: "Deterministic Preview Lab fixture", applicantId: found.applicantId },
    sourceReliability: found.sourceReliability,
    capabilities: { readOnly: false, role: "PREVIEW_ADMIN", capabilities: PREVIEW_CAPABILITIES, enforcement: "Preview transport simulates guarded contracts without live dependencies.", pass2Actions: [readOnlyAction("Run batch communications", "CAN_RUN_BATCH_COMMUNICATIONS")] },
    featureFlags: PREVIEW_FLAGS,
    returnContext: found.returnContext,
    timings: { applicantMs: 5 }
  };
}

function readOnlyAction(label, capability) {
  return { label, enabled: false, readOnly: true, requiredCapability: capability, reason: "Available in EduOps Pass 2. Current Admin remains the operational path." };
}

function documentManifest(context, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  if (context.mode === "snapshot") {
    var valid = validateSnapshot(context.snapshot);
    if (valid.ok !== true) return valid;
    var applicant = context.snapshot.exactApplicants[String(p.applicantId || "")];
    if (!applicant || !applicant.documentManifest) return { ok: false, readOnly: true, code: "DOCUMENT_MANIFEST_UNAVAILABLE", error: "Captured snapshot does not include this document manifest." };
    return applicant.documentManifest;
  }
  const applicantId = String(p.applicantId || "");
  const product = productCode(p.product || applicantId.split("-")[0]);
  const wb = getApplicantWorkbench(context, { product, applicantId, expectedSnapshotId: productSnapshotId(product) });
  if (wb.ok !== true) return wb;
  const unavailable = context.scenarioId === "document-preview-unavailable";
  const file = {
    fileId: `preview-file-${applicantId}`,
    fileName: unavailable ? "Preview-document-original.pdf" : "Preview-derived-document.png",
    label: "Proof of identity",
    mimeType: unavailable ? "application/pdf" : "image/png",
    sizeBytes: 12048,
    createdTime: SNAPSHOT_AS_OF,
    modifiedTime: SNAPSHOT_AS_OF,
    parentFolderId: "preview-folder",
    sourceField: "Proof_Of_Identity",
    itemIndex: 0,
    mappingMethod: "row_file_id",
    suspectedDocumentType: "identity",
    previewEligible: !unavailable,
    renditionEligible: !unavailable,
    renditionKind: unavailable ? "" : "image-png",
    thumbnailAvailable: !unavailable,
    previewUrl: "",
    openUrl: "preview://open-original",
    downloadUrl: "preview://download-original",
    warnings: unavailable ? [{ code: "RENDITION_UNAVAILABLE", message: "PNG rendition is unavailable in this scenario." }] : []
  };
  file.documentKey = [applicantId, String(wb.identity.rowNumber), file.sourceField, String(file.itemIndex)].join("|");
  return {
    ok: true,
    readOnly: true,
    applicantId,
    applicantName: wb.identity.displayName,
    rowNumber: wb.identity.rowNumber,
    folderId: "preview-folder",
    folderName: "Preview simulated folder",
    folderUrl: "",
    source: "preview-fixture",
    files: [file],
    missingExpected: [],
    warnings: file.warnings,
    renditionRule: "canonical original -> server-derived PNG rendition -> separate signed Open Original action",
    timings: { documentManifestMs: 3 }
  };
}

function validateDocumentContext(context, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const manifest = documentManifest(context, p);
  if (manifest.ok !== true) return manifest;
  const expected = manifest.files[0];
  if (context.scenarioId === "invalid-cross-applicant-document") {
    return { ok: false, readOnly: true, code: "DOCUMENT_CONTEXT_MISMATCH", error: "Document context does not match the applicant manifest" };
  }
  if (p.documentKey && p.documentKey !== expected.documentKey) {
    return { ok: false, readOnly: true, code: "DOCUMENT_CONTEXT_MISMATCH", error: "Document context does not match the applicant manifest" };
  }
  if (String(p.sourceField || "") !== expected.sourceField || Number(p.itemIndex) !== expected.itemIndex) {
    return { ok: false, readOnly: true, code: "DOCUMENT_CONTEXT_MISMATCH", error: "Document context does not match the applicant manifest" };
  }
  return { ok: true, manifest, file: expected };
}

function documentRendition(context, payload, rootDir) {
  if (context.mode === "snapshot") {
    var validSnapshot = validateSnapshot(context.snapshot);
    if (validSnapshot.ok !== true) return validSnapshot;
    var applicant = context.snapshot.exactApplicants[String(payload && payload.applicantId || "")];
    if (!applicant || !applicant.documentRenditions) return { ok: false, readOnly: true, code: "RENDITION_UNAVAILABLE", error: "Captured snapshot does not include a PNG rendition for this document." };
    var key = String(payload && payload.documentKey || "");
    return applicant.documentRenditions[key] || { ok: false, readOnly: true, code: "RENDITION_UNAVAILABLE", error: "Captured snapshot does not include this PNG rendition." };
  }
  const valid = validateDocumentContext(context, payload);
  if (valid.ok !== true) return valid;
  if (context.scenarioId === "document-preview-unavailable") {
    return { ok: false, readOnly: true, code: "RENDITION_UNAVAILABLE", error: "PNG preview is unavailable for this document." };
  }
  const pngPath = path.join(rootDir, "tools", "eduops-preview", "fixtures", "document-rendition.png");
  const data = fs.existsSync(pngPath)
    ? fs.readFileSync(pngPath).toString("base64")
    : "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR4nGNgYGD4DwABBAEAgh6FOQAAAABJRU5ErkJggg==";
  return {
    ok: true,
    readOnly: true,
    sourceField: valid.file.sourceField,
    itemIndex: valid.file.itemIndex,
    label: valid.file.label,
    fileName: valid.file.fileName,
    sourceMimeType: valid.file.mimeType,
    renditionMimeType: "image/png",
    renditionKind: "image-png",
    renditionStorage: "preview-fixture",
    renditionFolderName: "Preview simulated folder",
    renditionKey: `preview-rendition-${valid.manifest.applicantId}`,
    generated: false,
    stalePolicy: "Preview fixture is immutable for the scenario.",
    canonicalOriginal: false,
    renditionOnly: true,
    dataUrl: `data:image/png;base64,${data}`,
    timings: { documentRenditionMs: 4 }
  };
}

function documentFileAction(context, payload) {
  if (context.mode === "snapshot") {
    var validSnapshot = validateSnapshot(context.snapshot);
    if (validSnapshot.ok !== true) return validSnapshot;
    var applicant = context.snapshot.exactApplicants[String(payload && payload.applicantId || "")];
    if (!applicant || !applicant.documentManifest) return { ok: false, readOnly: true, code: "DOCUMENT_ACTION_UNAVAILABLE", error: "Captured snapshot does not include this document action." };
    return {
      ok: true,
      readOnly: true,
      canonicalOriginal: true,
      openUrl: "preview://captured-open-original-representation",
      downloadUrl: "preview://captured-download-original-representation",
      expiresAt: "",
      label: "Captured Open Original representation",
      previewEligible: false
    };
  }
  const valid = validateDocumentContext(context, payload);
  if (valid.ok !== true) return valid;
  return {
    ok: true,
    readOnly: true,
    sourceField: valid.file.sourceField,
    itemIndex: valid.file.itemIndex,
    label: valid.file.label,
    mimeType: valid.file.mimeType,
    previewEligible: valid.file.previewEligible,
    canonicalOriginal: true,
    openUrl: `http://localhost:4173/preview-open-original/${encodeURIComponent(valid.manifest.applicantId)}`,
    downloadUrl: `http://localhost:4173/preview-download-original/${encodeURIComponent(valid.manifest.applicantId)}`,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
  };
}

function reconciliationRpc(context, payload) {
  const workload = queryOperationalWorkload(context, payload || {});
  if (workload.ok === false) return { ...workload, readOnly: true, product: workload.product || "FODE", hiddenReasons: [] };
  return { ok: true, readOnly: true, product: workload.product || "FODE", snapshotId: workload.snapshotId, reconciliation: workload.reconciliation, hiddenReasons: workload.reconciliation && workload.reconciliation.hiddenReasons || [] };
}

function parityDiagnostics(context, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  if (context.mode === "snapshot") {
    var valid = validateSnapshot(context.snapshot);
    if (valid.ok !== true) return valid;
    var metadata = context.snapshot.metadata || {};
    if (p.expectedSnapshotId && p.expectedSnapshotId !== metadata.snapshotId) return { ok: false, readOnly: true, code: "STALE_SNAPSHOT", snapshotId: metadata.snapshotId, expectedSnapshotId: p.expectedSnapshotId };
    return context.snapshot.paritySummary || { ok: true, readOnly: true, product: "FODE", snapshotId: metadata.snapshotId, reliabilityState: metadata.sourceReliability || "AUTHORITATIVE", note: "Captured parity summary was not available." };
  }
  if (p.expectedSnapshotId && p.expectedSnapshotId !== SNAPSHOT_ID) return { ok: false, readOnly: true, code: "STALE_SNAPSHOT", snapshotId: SNAPSHOT_ID, expectedSnapshotId: p.expectedSnapshotId };
  const conflict = context.scenarioId === "conflicting-authority";
  return {
    ok: !conflict,
    readOnly: true,
    product: "FODE",
    snapshotId: SNAPSHOT_ID,
    snapshotAsOf: SNAPSHOT_AS_OF,
    compared: 100,
    canonicalPopulationTotal: rowsForScenario(context.scenarioId).length,
    currentAdminBoundedRows: 100,
    exactMatches: conflict ? 92 : 100,
    mismatchesByField: conflict ? { actionabilityState: 3, selectable: 5 } : {},
    mismatches: conflict ? [{ applicantId: "FODE-26-PREVIEW-0042", field: "actionabilityState", eduops: "UNKNOWN", currentAdmin: "READY" }] : [],
    missingIdentities: [],
    extraIdentities: [],
    unsafeMismatches: conflict ? [{ applicantId: "FODE-26-PREVIEW-0042", field: "selectable" }] : [],
    reliabilityState: conflict ? "CONFLICTING" : "AUTHORITATIVE",
    note: "Preview parity diagnostics are deterministic and use simulated contracts.",
    timings: { parityMs: 5 }
  };
}

function operationHistory(payload) {
  const applicantId = String(payload && payload.applicantId || "");
  return { ok: true, readOnly: true, applicantId, receipts: (previewStore.history.get(applicantId) || []).slice() };
}

function commandDefinition(operation) {
  const definitions = {
    DOCUMENT_REVIEW: ["CAN_SAVE_DOCUMENT_STATUSES", false, "STANDARD"],
    FINANCE_EVIDENCE_DECISION: ["CAN_VERIFY_PAYMENT", false, "HIGH"],
    SEND_INDIVIDUAL_COMMUNICATION: ["CAN_SEND_INDIVIDUAL_EMAIL", false, "HIGH"],
    CONTACTABILITY_CORRECTION: ["CAN_OPEN_REVIEW_WORKSPACE", false, "STANDARD"],
    PORTAL_ACCESS: ["CAN_MANAGE_PORTAL_ACCESS", false, "HIGH"],
    BATCH_COMMUNICATION: ["CAN_RUN_BATCH_COMMUNICATIONS", true, "HIGH"],
    BOOKS_ACTION: ["CAN_WRITE_ZOHO_BOOKS", false, "CRITICAL"]
  };
  return definitions[String(operation || "").toUpperCase()] || null;
}

function previewCommand(context, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const operation = String(p.operation || "").toUpperCase();
  const definition = commandDefinition(operation);
  if (!definition) return { ok: false, code: "UNSUPPORTED_OPERATION", message: `Unsupported Preview operation ${operation}` };
  if (context.scenarioId === "feature-flag-disabled") return { ok: false, code: "DISABLED_BY_FLAG", message: `${operation} is disabled by the simulated feature flag.` };
  if (operation === "BOOKS_ACTION") return { ok: false, code: "DISABLED_BY_FLAG", message: "Books execution is disabled in this pass." };
  if (context.scenarioId === "capability-denied") return { ok: false, code: "CAPABILITY_DENIED", message: `${definition[0]} is required.` };
  const currentSnapshot = context.mode === "snapshot" ? context.snapshot && context.snapshot.metadata && context.snapshot.metadata.snapshotId : productSnapshotId(p.product);
  if (!p.snapshotId || p.snapshotId !== currentSnapshot) return { ok: false, code: "STALE_SNAPSHOT", message: "The command is not bound to the current product snapshot." };
  const selection = p.selection && typeof p.selection === "object" ? p.selection : null;
  if (selection && definition[1] !== true) return { ok: false, code: "BATCH_NOT_ALLOWED", message: "This operation is individual-only." };
  if (selection && selection.queryFingerprint !== p.queryFingerprint) return { ok: false, code: "QUERY_BINDING_MISMATCH", message: "The selection query changed after selection." };
  const selected = selection && Array.isArray(selection.selectedApplicantIds) ? selection.selectedApplicantIds.slice() : [];
  if (selection && !selected.length) return { ok: false, code: "EMPTY_SELECTION", message: "No selected applicants remain eligible." };
  if (selection && selected.length > 50) return { ok: false, code: "BATCH_CAP_EXCEEDED", message: "The selected cohort exceeds the bounded execution cap." };
  if (!selection && !p.applicantId) return { ok: false, code: "APPLICANT_ID_REQUIRED", message: "ApplicantID is required." };
  if (operation === "FINANCE_EVIDENCE_DECISION" && String(p.draft && p.draft.decision || "").toUpperCase() !== "VERIFIED") return { ok: false, code: "UNSUPPORTED_FINANCE_DECISION", message: "No dedicated Finance rejection authority is proven." };
  if (operation === "SEND_INDIVIDUAL_COMMUNICATION" && (context.scenarioId === "cooling-off-denial" || context.scenarioId === "contactability-failure")) return { ok: false, code: context.scenarioId === "cooling-off-denial" ? "COOLDOWN_ACTIVE" : "NO_EFFECTIVE_EMAIL", message: "Communication Authority blocked this preview." };
  const id = `PREVIEW-${operation}-${String(previewStore.previews.size + 1).padStart(4, "0")}`;
  const createdAt = new Date();
  const preview = {
    ok: true,
    state: context.scenarioId === "expired-command-preview" ? "EXPIRED" : "READY",
    schemaVersion: "EDUOPS_COMMAND_PREVIEW_V1",
    previewId: id,
    operation,
    product: p.product || "FODE",
    snapshotId: currentSnapshot,
    queryFingerprint: p.queryFingerprint || "",
    applicantId: p.applicantId || "",
    selectedApplicantIds: selected,
    requiredCapability: definition[0],
    risk: definition[2],
    dualApprovalRequired: operation === "PORTAL_ACCESS" || (operation === "BATCH_COMMUNICATION" && selected.length >= 25),
    idempotencyKey: p.idempotencyKey,
    summary: `${operation.replace(/_/g, " ")} / ${selection ? selected.length + " applicants" : p.applicantId}`,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + (context.scenarioId === "expired-command-preview" ? -1000 : 600000)).toISOString(),
    eligibleCount: selection ? selected.length : 1,
    blockedCount: 0,
    excludedCount: 0,
    partitions: selection ? [{ partitionKey: operation, label: operation.replace(/_/g, " "), memberCount: selected.length, executionCap: 50, requiredCapability: definition[0] }] : [],
    request: JSON.parse(JSON.stringify(p)),
    contextFingerprint: JSON.stringify({ operation, product: p.product || "FODE", snapshotId: currentSnapshot, queryFingerprint: p.queryFingerprint || "", applicantId: p.applicantId || "", selectedApplicantIds: selected, document: p.document || null, draft: p.draft || null, approvalId: p.approvalId || "" })
  };
  previewStore.previews.set(id, preview);
  return preview;
}

function executeCommand(context, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  if (p.confirmation !== true) return { ok: false, code: "EXPLICIT_CONFIRMATION_REQUIRED", message: "Explicit confirmation is required." };
  const preview = previewStore.previews.get(String(p.previewId || ""));
  if (!preview) return { ok: false, code: "PREVIEW_EXPIRED_OR_UNKNOWN", message: "The preview is unavailable." };
  if (Date.parse(preview.expiresAt) <= Date.now()) return { ok: false, code: "PREVIEW_EXPIRED", message: "The preview expired before execution." };
  if (preview.dualApprovalRequired === true && !preview.request.approvalId) return { ok: false, code: "DUAL_APPROVAL_REQUIRED", message: "Independent approval is required for this operation." };
  if (preview.idempotencyKey !== p.idempotencyKey) return { ok: false, code: "IDEMPOTENCY_CONTEXT_MISMATCH", message: "The confirmation does not match the preview." };
  if (context.scenarioId === "stale-command-preview") return { ok: false, code: "STALE_SNAPSHOT", message: "The source snapshot changed after preview." };
  if (context.scenarioId === "operation-lock-conflict") return { ok: false, code: "OPERATION_LOCKED", message: "Another simulated operation holds the guarded lock." };
  if (previewStore.receipts.has(p.idempotencyKey)) {
    const stored = previewStore.receipts.get(p.idempotencyKey);
    if (stored.contextFingerprint !== preview.contextFingerprint) return { ok: false, code: "IDEMPOTENCY_CONTEXT_CONFLICT", message: "The idempotency key was already used for another command context." };
    return stored.receipt;
  }
  const ids = preview.selectedApplicantIds.length ? preview.selectedApplicantIds : [preview.applicantId];
  const applicantOutcomes = ids.map((applicantId, index) => ({ applicantId, outcome: context.scenarioId === "partial-batch-failure" && index === ids.length - 1 ? "BLOCKED" : "COMPLETE", reason: context.scenarioId === "partial-batch-failure" && index === ids.length - 1 ? "Simulated authority change" : "Simulated authoritative receipt" }));
  const completeCount = applicantOutcomes.filter((item) => item.outcome === "COMPLETE").length;
  const receipt = {
    ok: true,
    simulated: true,
    schemaVersion: "EDUOPS_RECEIPT_V1",
    receiptId: `RECEIPT-${String(previewStore.receipts.size + 1).padStart(4, "0")}`,
    previewId: preview.previewId,
    operation: preview.operation,
    product: preview.product,
    snapshotId: preview.snapshotId,
    queryFingerprint: preview.queryFingerprint,
    applicantId: preview.applicantId,
    selectedApplicantIds: preview.selectedApplicantIds,
    at: nowIso(),
    outcome: completeCount === applicantOutcomes.length ? "COMPLETE" : completeCount ? "PARTIAL" : "BLOCKED",
    applicantOutcomes
  };
  previewStore.receipts.set(p.idempotencyKey, { contextFingerprint: preview.contextFingerprint, receipt });
  ids.forEach((applicantId) => previewStore.history.set(applicantId, [receipt].concat(previewStore.history.get(applicantId) || []).slice(0, 25)));
  return receipt;
}

function getAccessProjection() {
  return {
    ok: true,
    readOnly: true,
    product: "FODE",
    contractVersion: CONTRACT_VERSION,
    profileVersion: PROFILE_VERSION,
    runtime: { version: "r352-preview", deployVersion: 352 },
    user: { email: "preview.owner@example.test", role: "PREVIEW_ADMIN", capabilities: PREVIEW_CAPABILITIES },
    featureFlags: PREVIEW_FLAGS,
    rpcAllowlist: { read: [
      "eduops_getAccessProjection",
      "eduops_getProfile",
      "eduops_queryOperationalWorkload",
      "eduops_searchApplicants",
      "eduops_getApplicantWorkbench",
      "eduops_getDocumentManifest",
      "eduops_getDocumentRendition",
      "eduops_getDocumentFileAction",
      "eduops_getReconciliation",
      "eduops_getParityDiagnostics",
      "eduops_getOperationHistory",
      "eduops_previewCommand"
    ], write: ["eduops_executeCommand"] }
  };
}

function getProfile() {
  return {
    ok: true,
    readOnly: true,
    product: "FODE",
    label: "FODE",
    description: "Preview Lab over deterministic EduOps Pass 1 contracts.",
    contractVersion: CONTRACT_VERSION,
    profileVersion: PROFILE_VERSION,
    actionabilityStates: Object.keys(STATE_LABELS),
    workScopes: ["MY", "TEAM", "UNASSIGNED", "ESCALATED", "ALL_AUTHORISED"],
    featureFlags: PREVIEW_FLAGS,
    commandContractVersion: "EDUOPS_COMMAND_PREVIEW_V1",
    receiptContractVersion: "EDUOPS_RECEIPT_V1"
  };
}

function handleRpc(name, context, payload, rootDir) {
  if (name === "eduops_getAccessProjection") return getAccessProjection();
  if (name === "eduops_getProfile") return getProfile();
  if (name === "eduops_queryOperationalWorkload") return queryOperationalWorkload(context, payload);
  if (name === "eduops_searchApplicants") return searchApplicants(context, payload);
  if (name === "eduops_getApplicantWorkbench") return getApplicantWorkbench(context, payload);
  if (name === "eduops_getDocumentManifest") return documentManifest(context, payload);
  if (name === "eduops_getDocumentRendition") return documentRendition(context, payload, rootDir);
  if (name === "eduops_getDocumentFileAction") return documentFileAction(context, payload);
  if (name === "eduops_getReconciliation") return reconciliationRpc(context, payload);
  if (name === "eduops_getParityDiagnostics") return parityDiagnostics(context, payload);
  if (name === "eduops_getOperationHistory") return operationHistory(payload);
  if (name === "eduops_previewCommand") return previewCommand(context, payload);
  if (name === "eduops_executeCommand") return executeCommand(context, payload);
  return { ok: false, readOnly: true, code: "UNKNOWN_RPC", message: `Preview transport does not implement ${name}` };
}

module.exports = {
  CONTRACT_VERSION,
  PROFILE_VERSION,
  SNAPSHOT_FORMAT_VERSION,
  SANITISATION_VERSION,
  SNAPSHOT_ID,
  listScenarios,
  scenarioById,
  validateSnapshot,
  getDelayMs,
  handleRpc
};
