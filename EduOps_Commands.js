var EDUOPS_COMMAND_DEFINITIONS = {
  DOCUMENT_REVIEW: { capability: "CAN_SAVE_DOCUMENT_STATUSES", batchSafe: false, risk: "STANDARD" },
  FINANCE_EVIDENCE_DECISION: { capability: "CAN_VERIFY_PAYMENT", batchSafe: false, risk: "HIGH" },
  SEND_INDIVIDUAL_COMMUNICATION: { capability: "CAN_SEND_INDIVIDUAL_EMAIL", batchSafe: false, risk: "HIGH" },
  CONTACTABILITY_CORRECTION: { capability: "CAN_OPEN_REVIEW_WORKSPACE", batchSafe: false, risk: "STANDARD" },
  PORTAL_ACCESS: { capability: "CAN_MANAGE_PORTAL_ACCESS", batchSafe: false, risk: "HIGH", dualApproval: true },
  BATCH_COMMUNICATION: { capability: "CAN_RUN_BATCH_COMMUNICATIONS", batchSafe: true, risk: "HIGH" }
};

function eduopsCommandDefinition_(operation) {
  var key = eduopsUpper_(operation, "");
  var definition = EDUOPS_COMMAND_DEFINITIONS[key];
  if (!definition) throw new Error("UNSUPPORTED_OPERATION: " + key);
  return { operation: key, capability: definition.capability, batchSafe: definition.batchSafe === true, risk: definition.risk || "STANDARD", dualApproval: definition.dualApproval === true };
}

function eduopsRequireCommandCapability_(access, definition) {
  var projection = access && access.capabilities || {};
  var capabilities = projection.capabilities || projection;
  if (capabilities[definition.capability] !== true) throw new Error("CAPABILITY_DENIED: " + definition.capability + " required");
}

function eduopsPreviewCacheKey_(previewId) {
  return "EDUOPS_PREVIEW_" + eduopsClean_(previewId).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 100);
}

function eduopsCommandRequiresDualApproval_(definition, request) {
  if (definition.dualApproval === true) return true;
  return false;
}

function eduopsBatchExecutionCap_() {
  if (typeof selectedApplicantBatchLimit_ === "function") return Math.max(1, Number(selectedApplicantBatchLimit_() || 30));
  return 30;
}

function eduopsNormalizeExecutionLimit_(value) {
  var cap = eduopsBatchExecutionCap_();
  var requested = Math.max(1, Math.floor(Number(value || cap)));
  return Math.min(cap, requested);
}

function eduopsQueryFingerprintForSelection_(query) {
  var q = eduopsNormalizeWorkloadQuery_(query || {});
  return JSON.stringify({
    product: q.product,
    actionabilityState: q.actionabilityState,
    worklistKey: q.worklistKey,
    workScope: q.workScope,
    filters: q.filters,
    sort: q.sort,
    pageSize: q.pageSize
  });
}

function eduopsResolveBatchSelection_(selection, resolved, request) {
  var source = selection && typeof selection === "object" ? selection : {};
  var mode = eduopsUpper_(source.selectionMode || "EXPLICIT_SELECTION");
  if (mode === "EXPLICIT") mode = "EXPLICIT_SELECTION";
  var snapshotId = eduopsClean_(source.snapshotId || "");
  if (eduopsClean_(source.product || "") !== "FODE" || snapshotId !== resolved.snapshotId) throw new Error("STALE_SELECTION_BINDING");
  var requestFingerprint = eduopsClean_(request && request.queryFingerprint || "");
  var selectionFingerprint = eduopsClean_(source.queryFingerprint || "");
  if (!selectionFingerprint || selectionFingerprint !== requestFingerprint) throw new Error("QUERY_BINDING_MISMATCH");
  var excluded = {};
  normalizeSelectedApplicantBatchIds_(source.excludedApplicantIds || [], selectedApplicantBatchInputLimit_()).forEach(function (id) { excluded[id] = true; });
  var executionLimit = eduopsNormalizeExecutionLimit_(source.executionLimit || request && request.executionLimit);
  var masterIds = [];
  var blockedCount = 0;
  var query = source.query && typeof source.query === "object" ? source.query : null;
  if (mode === "ALL_ELIGIBLE_MATCHING_QUERY") {
    if (!query) throw new Error("QUERY_SELECTION_CONTEXT_REQUIRED");
    var queryFingerprint = eduopsQueryFingerprintForSelection_(query);
    if (queryFingerprint !== selectionFingerprint) throw new Error("QUERY_BINDING_MISMATCH");
    var matched = eduopsFilterRows_(resolved.rows, eduopsNormalizeWorkloadQuery_(query), null);
    matched.sort(function (a, b) { return eduopsCompareRows_(a, b, query.sort); });
    matched.forEach(function (row) {
      if (row.selectable === true) masterIds.push(row.applicantId);
      else blockedCount++;
    });
  } else if (mode === "EXPLICIT_SELECTION") {
    masterIds = normalizeSelectedApplicantBatchIds_(source.selectedApplicantIds || [], selectedApplicantBatchInputLimit_());
  } else {
    throw new Error("UNSUPPORTED_SELECTION_MODE: " + mode);
  }
  var remainingMasterIds = masterIds.filter(function (id) { return !excluded[id]; });
  if (!remainingMasterIds.length) throw new Error("EMPTY_SELECTION");
  var executionIds = remainingMasterIds.slice(0, executionLimit);
  return {
    selectionMode: mode,
    product: "FODE",
    snapshotId: resolved.snapshotId,
    queryFingerprint: selectionFingerprint,
    query: query,
    selectedApplicantIds: masterIds,
    excludedApplicantIds: Object.keys(excluded),
    executionApplicantIds: executionIds,
    masterCohortSize: masterIds.length,
    excludedCount: Math.max(0, masterIds.length - remainingMasterIds.length),
    blockedCount: blockedCount,
    executionCohortSize: executionIds.length,
    executionCap: eduopsBatchExecutionCap_(),
    executionLimit: executionLimit,
    remainingAfterExecution: Math.max(0, remainingMasterIds.length - executionIds.length)
  };
}

function eduopsAuthorityPreview_(definition, request, applicantId, selection) {
  var draft = request.draft || {};
  if (definition.operation === "SEND_INDIVIDUAL_COMMUNICATION") {
    return admin_previewApplicantMessage({
      applicantId: applicantId,
      messageType: draft.messageType,
      recipient: draft.recipient,
      subject: draft.subject,
      body: draft.body,
      sourceView: "eduops"
    });
  }
  if (definition.operation === "BATCH_COMMUNICATION") {
    return admin_previewSelectedApplicantBatch({
      applicantIds: selection.executionApplicantIds,
      excludedApplicantIds: [],
      messageType: draft.messageType,
      sourceLabel: "EduOps " + selection.selectionMode + " execution cohort",
      sourceType: "eduops"
    });
  }
  return { ok: true, result: "PREVIEW", code: "AUTHORITY_CONTEXT_VALIDATED" };
}

function eduopsAuthorityPreviewReady_(result) {
  if (!result || result.ok === false) return false;
  var state = eduopsUpper_(result.result || result.state || "PREVIEW", "PREVIEW");
  return state !== "BLOCKED" && state !== "DENIED" && state !== "ERROR";
}

function eduops_previewCommand(payload) {
  var access = eduopsRequireAccess_();
  var p = payload && typeof payload === "object" ? payload : {};
  var definition = eduopsCommandDefinition_(p.operation);
  eduopsRequireFeature_(definition.operation);
  eduopsRequireCommandCapability_(access, definition);
  var resolved = eduopsResolveFodeSnapshot_(access);
  var requestedSnapshotId = eduopsClean_(p.snapshotId || p.expectedSnapshotId || "");
  if (!requestedSnapshotId || requestedSnapshotId !== resolved.snapshotId) throw new Error("STALE_SNAPSHOT: refresh before preview");
  var selection = p.selection && typeof p.selection === "object" ? p.selection : null;
  var applicantId = eduopsClean_(p.applicantId || "");
  if (selection && !definition.batchSafe) throw new Error("BATCH_NOT_ALLOWED: " + definition.operation + " is individual-only");
  if (!selection && !applicantId) throw new Error("APPLICANT_ID_REQUIRED");
  if (selection) {
    selection = eduopsResolveBatchSelection_(selection, resolved, p);
  }
  if (applicantId) {
    var exact = eduopsFodeApplicantRead_(applicantId, {}, resolved.snapshotId);
    if (!exact || exact.ok !== true) throw new Error("APPLICANT_NOT_FOUND");
    if (p.rowKey && eduopsClean_(p.rowKey) !== eduopsClean_(exact.rowKey)) throw new Error("APPLICANT_CONTEXT_MISMATCH");
  }
  if (definition.operation === "DOCUMENT_REVIEW") {
    var documentContext = eduopsHydrateDocumentPayload_(p.document || {}, true);
    if (!documentContext || documentContext.ok !== true || eduopsClean_(documentContext.payload.applicantId) !== applicantId) {
      throw new Error("DOCUMENT_CONTEXT_MISMATCH");
    }
    if (Array.isArray(p.draft && p.draft.docs)) {
      var manifest = admin_getApplicantDocumentManifest({ applicantId: applicantId, rowNumber: documentContext.payload.rowNumber });
      var allowedDocumentFields = {};
      (manifest && manifest.files || []).forEach(function (file) { allowedDocumentFields[eduopsClean_(file && file.sourceField || "")] = true; });
      p.draft.docs.forEach(function (item) {
        if (!allowedDocumentFields[eduopsClean_(item && item.file || "")]) throw new Error("DOCUMENT_CONTEXT_MISMATCH");
      });
    }
  }
  if (definition.operation === "FINANCE_EVIDENCE_DECISION" && eduopsUpper_(p.draft && p.draft.decision || "", "") !== "VERIFIED") {
    throw new Error("UNSUPPORTED_FINANCE_DECISION: no dedicated rejection authority is proven");
  }
  var authorityPreview = eduopsAuthorityPreview_(definition, p, applicantId, selection);
  var authorityReady = eduopsAuthorityPreviewReady_(authorityPreview);
  var now = Date.now();
  var preview = {
    ok: true,
    state: authorityReady ? "READY" : "BLOCKED",
    schemaVersion: "EDUOPS_COMMAND_PREVIEW_V1",
    previewId: "EDUOPS-PREVIEW-" + Utilities.getUuid(),
    operation: definition.operation,
    product: "FODE",
    snapshotId: resolved.snapshotId,
    queryFingerprint: eduopsClean_(p.queryFingerprint || ""),
    applicantId: applicantId,
    selectedApplicantIds: selection ? selection.executionApplicantIds.slice() : [],
    requiredCapability: definition.capability,
    risk: definition.risk,
    dualApprovalRequired: eduopsCommandRequiresDualApproval_(definition, p),
    idempotencyKey: eduopsClean_(p.idempotencyKey || ""),
    summary: eduopsHumanize_(definition.operation) + " for " + (selection ? selection.selectedApplicantIds.length + " applicants" : applicantId),
    actor: access.email,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
    request: eduopsClone_(p),
    authorityPreview: eduopsClone_(authorityPreview),
    selectionBinding: selection ? eduopsClone_(selection) : null,
    masterCohortSize: selection ? selection.masterCohortSize : 0,
    executionCohortSize: selection ? selection.executionCohortSize : 0,
    remainingAfterExecution: selection ? selection.remainingAfterExecution : 0,
    executionCap: selection ? selection.executionCap : 0,
    partitions: selection ? [{
      partitionKey: draft.messageType,
      messageType: draft.messageType,
      label: eduopsHumanize_(draft.messageType || definition.operation),
      memberCount: selection.executionCohortSize,
      masterCohortSize: selection.masterCohortSize,
      remainingAfterExecution: selection.remainingAfterExecution,
      executionCap: selection.executionCap,
      requiredCapability: definition.capability
    }] : [],
    eligibleCount: selection ? Number(authorityPreview.eligible || authorityPreview.count || selection.executionCohortSize) : (authorityReady ? 1 : 0),
    blockedCount: selection ? Number(authorityPreview.blocked || 0) : (authorityReady ? 0 : 1),
    excludedCount: selection ? selection.excludedCount : 0
  };
  if (!preview.idempotencyKey) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  CacheService.getUserCache().put(eduopsPreviewCacheKey_(preview.previewId), JSON.stringify(preview), 600);
  return preview;
}

function eduops_executeCommand(payload) {
  var access = eduopsRequireAccess_();
  var p = payload && typeof payload === "object" ? payload : {};
  if (p.confirmation !== true) throw new Error("EXPLICIT_CONFIRMATION_REQUIRED");
  var cached = CacheService.getUserCache().get(eduopsPreviewCacheKey_(p.previewId));
  if (!cached) throw new Error("PREVIEW_EXPIRED_OR_UNKNOWN");
  var preview = JSON.parse(cached);
  if (Date.parse(preview.expiresAt) <= Date.now()) throw new Error("PREVIEW_EXPIRED");
  if (preview.state !== "READY") throw new Error("PREVIEW_NOT_EXECUTABLE");
  if (eduopsClean_(p.idempotencyKey) !== eduopsClean_(preview.idempotencyKey)) throw new Error("IDEMPOTENCY_CONTEXT_MISMATCH");
  var contextFingerprint = eduopsIdempotencyContext_(preview);
  var prior = eduopsReadIdempotentReceipt_(preview.idempotencyKey, contextFingerprint);
  if (prior) return prior;
  var definition = eduopsCommandDefinition_(preview.operation);
  eduopsRequireFeature_(definition.operation);
  eduopsRequireCommandCapability_(access, definition);
  var current = eduopsResolveFodeSnapshot_(access);
  if (current.snapshotId !== preview.snapshotId) throw new Error("STALE_SNAPSHOT: source changed after preview");
  if (preview.dualApprovalRequired === true && !preview.request.approvalId) throw new Error("DUAL_APPROVAL_REQUIRED");
  return eduopsWithOperationLock_(preview.operation, preview.applicantId, function () {
    var replay = eduopsReadIdempotentReceipt_(preview.idempotencyKey, contextFingerprint);
    if (replay) return replay;
    var authorityResult = eduopsDispatchCommand_(preview);
    var receipt = eduopsBuildReceipt_(preview, authorityResult);
    return eduopsStoreIdempotentReceipt_(preview.idempotencyKey, receipt, contextFingerprint);
  });
}

function eduopsDispatchCommand_(preview) {
  var request = preview.request || {};
  var draft = request.draft || {};
  if (preview.operation === "BATCH_COMMUNICATION") {
    var batchAuthority = preview.authorityPreview || {};
    return admin_sendSelectedApplicantBatch({
      previewRequestId: batchAuthority.requestId,
      candidateHash: batchAuthority.candidateHash,
      messageType: draft.messageType,
      confirmSend: true,
      sourceView: "eduops"
    });
  }
  var identity = eduopsFodeApplicantRead_(preview.applicantId, {}, preview.snapshotId);
  var rowNumber = Number(identity && identity.identity && identity.identity.rowNumber || 0);
  if (preview.operation === "DOCUMENT_REVIEW") {
    var document = request.document || {};
    var docs = Array.isArray(draft.docs) && draft.docs.length ? draft.docs : [{ file: document.sourceField, status: draft.status, comment: draft.note }];
    return admin_updateDocStatuses({ applicantId: preview.applicantId, rowNumber: rowNumber, docs: docs });
  }
  if (preview.operation === "FINANCE_EVIDENCE_DECISION") {
    if (eduopsUpper_(draft.decision || "", "") !== "VERIFIED") throw new Error("UNSUPPORTED_FINANCE_DECISION: no dedicated rejection authority is proven");
    return admin_setPaymentVerified({ rowNumber: rowNumber, comment: draft.reason || "EduOps Finance verification" });
  }
  if (preview.operation === "SEND_INDIVIDUAL_COMMUNICATION") return admin_sendApplicantMessage({ applicantId: preview.applicantId, messageType: draft.messageType, recipient: draft.recipient, subject: draft.subject, body: draft.body, confirmManualSingleSend: true, sourceView: "eduops" });
  if (preview.operation === "CONTACTABILITY_CORRECTION") {
    if (!eduopsClean_(draft.email || "")) throw new Error("CORRECTED_EMAIL_REQUIRED");
    return admin_updateParentEmailCorrected({ applicantId: preview.applicantId, rowNumber: rowNumber, newEmail: draft.email, reason: draft.reason });
  }
  if (preview.operation === "PORTAL_ACCESS") {
    var portalAction = eduopsUpper_(draft.action || "", "");
    if (portalAction === "RESET") return admin_resetPortalLink({ applicantId: preview.applicantId, rowNumber: rowNumber });
    if (portalAction === "LOCK" || portalAction === "UNLOCK") return admin_setPortalAccess({ rowNumber: rowNumber, status: portalAction === "LOCK" ? "Locked" : "Open" });
    throw new Error("UNSUPPORTED_PORTAL_ACTION");
  }
  throw new Error("COMMAND_HANDLER_NOT_IMPLEMENTED: " + preview.operation);
}
