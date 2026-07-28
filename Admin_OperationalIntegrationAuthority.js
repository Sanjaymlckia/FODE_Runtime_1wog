var FODE_PORTAL_STATUS_SCHEMA_VERSION = "FODE_PORTAL_STATUS_V1";
var FODE_FINANCE_HANDOFF_SCHEMA_VERSION = "FODE_FINANCE_HANDOFF_V1";
var FODE_CLASSROOM_HANDOFF_SCHEMA_VERSION = "FODE_CLASSROOM_HANDOFF_V1";
var FODE_DELIVERY_HISTORY_SCHEMA_VERSION = "FODE_DELIVERY_HISTORY_V1";
var FODE_INTEGRATION_PREVIEW_TTL_SECONDS = 600;

function fodeRecentAuditEvents_(labels, applicantId, limit) {
  var wanted = {};
  (Array.isArray(labels) ? labels : []).forEach(function (label) { wanted[fodeAuthorityClean_(label)] = true; });
  var id = fodeAuthorityClean_(applicantId);
  var max = Math.max(1, Math.min(100, Number(limit || 25)));
  var sheet = openLogSheet_();
  var lastRow = Number(sheet.getLastRow() || 0);
  if (!lastRow) return [];
  var firstRow = Math.max(1, lastRow - 1999);
  var values = sheet.getRange(firstRow, 1, lastRow - firstRow + 1, Math.min(3, Math.max(1, sheet.getLastColumn()))).getValues();
  var out = [];
  for (var i = values.length - 1; i >= 0 && out.length < max; i--) {
    var label = fodeAuthorityClean_(values[i][1] || "");
    if (Object.keys(wanted).length && !wanted[label]) continue;
    var payload = fodeAuthorityJson_(values[i][2], { message: fodeAuthorityClean_(values[i][2] || "") });
    if (id && fodeAuthorityClean_(payload && payload.applicantId || "") !== id && fodeAuthorityClean_(payload && payload.id || "") !== id) continue;
    out.push({
      at: values[i][0] instanceof Date ? values[i][0].toISOString() : fodeAuthorityClean_(values[i][0] || ""),
      event: label,
      evidence: fodeSafeAuditValue_(payload)
    });
  }
  return out;
}

function fodePortalStatusProjection_(rowObj, secretRecord) {
  var row = rowObj || {};
  var id = fodeAuthorityClean_(row.ApplicantID);
  var secret = secretRecord && typeof secretRecord === "object" ? secretRecord : {};
  if (secret.applicantId && fodeAuthorityClean_(secret.applicantId) !== id) {
    return {
      ok: false,
      readOnly: true,
      schemaVersion: FODE_PORTAL_STATUS_SCHEMA_VERSION,
      applicantId: id,
      accessState: "UNAVAILABLE",
      tokenState: "MISSING",
      blockCode: "PORTAL_RECORD_MISMATCH",
      blockReason: "Portal authority record does not belong to the selected applicant.",
      lastActivityAt: fodeAuthorityClean_(row.PortalLastUpdateAt || ""),
      availableActions: []
    };
  }
  var rawStatus = fodeAuthorityUpper_(secret.status || "");
  var tokenState = secret.ok === true && (!rawStatus || rawStatus === "ACTIVE") ? "ACTIVE" : (rawStatus && rawStatus !== "ACTIVE" ? "INACTIVE" : "MISSING");
  var locked = /^(LOCKED|INACTIVE|DISABLED)$/.test(fodeAuthorityUpper_(row.Portal_Access_Status || ""));
  var accessState = locked ? "INACTIVE" : (tokenState === "ACTIVE" ? "ACTIVE" : tokenState);
  var blockCode = locked ? "PORTAL_ACCESS_DEACTIVATED" : (tokenState === "INACTIVE" ? "PORTAL_SECRET_INACTIVE" : (tokenState === "MISSING" ? "PORTAL_LINK_UNAVAILABLE" : ""));
  return {
    ok: true,
    readOnly: true,
    schemaVersion: FODE_PORTAL_STATUS_SCHEMA_VERSION,
    authoritySource: "Portal Access Domain",
    applicantId: id,
    accessState: accessState,
    tokenState: tokenState,
    available: accessState === "ACTIVE",
    blockCode: blockCode,
    blockReason: blockCode ? "Portal access requires an explicit authorized administration action." : "",
    lastActivityAt: fodeAuthorityClean_(row.PortalLastUpdateAt || ""),
    issuedAt: tokenState === "ACTIVE" ? fodeAuthorityClean_(secret.issuedAt || "") : "",
    availableActions: tokenState === "MISSING" ? ["CREATE"] : (tokenState === "ACTIVE" ? ["DEACTIVATE", "ROTATE"] : ["ACTIVATE", "ROTATE"])
  };
}

function fodeApplyPortalTerminationAuthority_(projection, terminationCase) {
  var out = projection && typeof projection === "object" ? projection : {};
  var termination = terminationCase && typeof terminationCase === "object" ? terminationCase : {};
  var state = fodeAuthorityUpper_(termination.state || "");
  out.terminationState = state;
  if (state === "PENDING_FRAUD_CONFIRMATION") {
    out.accessState = "PENDING_FRAUD_CONFIRMATION";
    out.available = false;
    out.blockCode = "PORTAL_TERMINATION_RECONCILIATION_REQUIRED";
    out.blockReason = "Fraud confirmation is pending reconciliation before portal administration can continue.";
    out.availableActions = [];
  } else if (state === "PORTAL_ACCESS_TERMINATION_REQUIRED") {
    out.accessState = "PORTAL_ACCESS_TERMINATION_REQUIRED";
    out.available = false;
    out.blockCode = "PORTAL_ACCESS_TERMINATION_REQUIRED";
    out.blockReason = "Confirmed document fraud requires explicit portal deactivation.";
    out.availableActions = ["DEACTIVATE"];
  } else if (state === "PORTAL_ACCESS_TERMINATED") {
    out.accessState = "PORTAL_ACCESS_TERMINATED";
    out.available = false;
    out.blockCode = "PORTAL_ACCESS_TERMINATED";
    out.blockReason = "Portal access was terminated after confirmed document fraud.";
    out.availableActions = [];
  }
  return out;
}

function fodePortalStatusIndex_() {
  var opened = openPortalSecretsExistingSheet_(newDebugId_(), { source: "config" });
  if (!opened || opened.ok !== true) return {};
  var sheet = opened.sheet;
  var lastColumn = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  if (lastColumn < 1 || lastRow < 2) return {};
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var idx = buildPortalSecretHeaderIndex_(headers);
  if (!idx.ApplicantID) return {};
  var values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  var out = {};
  for (var i = 0; i < values.length; i++) {
    var applicantId = fodeAuthorityClean_(values[i][idx.ApplicantID - 1]);
    if (!applicantId) continue;
    var status = idx.Status ? fodeAuthorityUpper_(values[i][idx.Status - 1]) : "ACTIVE";
    var current = out[applicantId];
    if (!current || status === "ACTIVE") {
      out[applicantId] = {
        applicantId: applicantId,
        ok: status === "ACTIVE",
        found: true,
        status: status,
        issuedAt: idx.Issued_At ? fodeAuthorityClean_(values[i][idx.Issued_At - 1]) : ""
      };
    }
  }
  return out;
}

function admin_getFodePortalStatus(payload) {
  fodeAuthorityActor_("CAN_READ_PORTAL_STATUS");
  var context = fodeExactApplicantRow_(payload && payload.applicantId);
  var secret = lookupPortalSecretForApplicant_(context.applicantId, { source: "config" });
  var termination = fodeReadAuthorityState_("PORTAL_TERMINATION", context.applicantId);
  var projection = fodeApplyPortalTerminationAuthority_(
    fodePortalStatusProjection_(context.rowObj, secret),
    termination
  );
  projection.history = fodeRecentAuditEvents_(
    ["FODE_PORTAL_ACCESS_CREATED", "FODE_PORTAL_ACCESS_ACTIVATED", "FODE_PORTAL_ACCESS_DEACTIVATED", "FODE_PORTAL_ACCESS_ROTATED"],
    context.applicantId,
    25
  );
  return projection;
}

function admin_getFodePortalStatusWorklist(payload) {
  fodeAuthorityActor_("CAN_READ_PORTAL_STATUS");
  var snapshot = canonicalPopulationSnapshot_();
  var portalIndex = fodePortalStatusIndex_();
  var terminationIndex = fodeAuthorityStateIndex_("PORTAL_TERMINATION");
  var rows = [];
  Object.keys(snapshot._internalSourceRowsByRowNumber || {}).forEach(function (rowNumber) {
    var rowObj = snapshot._internalSourceRowsByRowNumber[rowNumber];
    var applicantId = fodeAuthorityClean_(rowObj && rowObj.ApplicantID);
    if (!applicantId) return;
    rows.push(fodeApplyPortalTerminationAuthority_(
      fodePortalStatusProjection_(rowObj, portalIndex[applicantId] || {}),
      terminationIndex[applicantId] || null
    ));
  });
  var requestedState = fodeAuthorityUpper_(payload && payload.state || "");
  if (requestedState) rows = rows.filter(function (row) { return row.accessState === requestedState; });
  var counts = fodeCompletionAggregate_(rows, function (row) { return row.accessState; });
  var limit = Math.max(1, Math.min(200, Number(payload && payload.limit || 100)));
  return {
    ok: true,
    readOnly: true,
    schemaVersion: "FODE_PORTAL_STATUS_WORKLIST_V1",
    total: rows.length,
    counts: counts,
    rows: rows.slice(0, limit)
  };
}

function fodeFraudReconciliationFingerprint_(terminationCase, rowObj) {
  return fodeAuthorityFingerprint_({
    terminationCase: terminationCase || {},
    currentFraudEvidence: fodeRegistryDocumentAuthority_(rowObj)
  });
}

function admin_getFodeFraudReconciliationQueue(payload) {
  fodeAuthorityActorAll_(["CAN_ADMIN_PORTAL_ACCESS", "CAN_MANAGE_REGISTRY"]);
  var snapshot = canonicalPopulationSnapshot_();
  var terminationIndex = fodeAuthorityStateIndex_("PORTAL_TERMINATION");
  var rows = [];
  Object.keys(snapshot._internalSourceRowsByRowNumber || {}).forEach(function (rowNumber) {
    var rowObj = snapshot._internalSourceRowsByRowNumber[rowNumber];
    var applicantId = fodeAuthorityClean_(rowObj && rowObj.ApplicantID);
    var termination = terminationIndex[applicantId] || null;
    if (!termination || fodeAuthorityUpper_(termination.state) !== "PENDING_FRAUD_CONFIRMATION") return;
    var documents = fodeRegistryDocumentAuthority_(rowObj);
    rows.push({
      applicantId: applicantId,
      state: "PENDING_FRAUD_CONFIRMATION",
      currentFraudStatus: documents.fraudStatus,
      documentState: documents.state,
      createdAt: fodeAuthorityClean_(termination.createdAt || termination.updatedAt || ""),
      createdBy: fodeAuthorityClean_(termination.createdBy || termination.updatedBy || ""),
      sourceFingerprint: fodeFraudReconciliationFingerprint_(termination, rowObj),
      portalAdministrationBlocked: true,
      availableResolutions: documents.fraudStatus === "CONFIRMED" ? ["CONFIRM_FRAUD"] : ["DISMISS_ABORTED_CONFIRMATION"]
    });
  });
  var limit = Math.max(1, Math.min(200, Number(payload && payload.limit || 100)));
  return {
    ok: true,
    readOnly: true,
    schemaVersion: "FODE_FRAUD_RECONCILIATION_QUEUE_V1",
    total: rows.length,
    rows: rows.slice(0, limit)
  };
}

function admin_previewFodeFraudReconciliationResolution(payload) {
  var actor = fodeAuthorityActorAll_(["CAN_ADMIN_PORTAL_ACCESS", "CAN_MANAGE_REGISTRY"]);
  var p = payload && typeof payload === "object" ? payload : {};
  var context = fodeExactApplicantRow_(p.applicantId);
  var termination = fodeReadAuthorityState_("PORTAL_TERMINATION", context.applicantId);
  if (!termination || fodeAuthorityUpper_(termination.state) !== "PENDING_FRAUD_CONFIRMATION") {
    throw new Error("PENDING_FRAUD_CONFIRMATION_NOT_FOUND");
  }
  var documents = fodeRegistryDocumentAuthority_(context.rowObj);
  var resolution = fodeAuthorityUpper_(p.resolution);
  if (resolution === "CONFIRM_FRAUD" && documents.fraudStatus !== "CONFIRMED") throw new Error("CONFIRMED_FRAUD_EVIDENCE_REQUIRED");
  if (resolution === "DISMISS_ABORTED_CONFIRMATION" && documents.fraudStatus === "CONFIRMED") throw new Error("CONFIRMED_FRAUD_CANNOT_BE_DISMISSED");
  if (["CONFIRM_FRAUD", "DISMISS_ABORTED_CONFIRMATION"].indexOf(resolution) < 0) throw new Error("FRAUD_RECONCILIATION_RESOLUTION_INVALID");
  var evidenceReference = fodeAuthorityClean_(p.evidenceReference);
  var reason = fodeAuthorityClean_(p.reason);
  var idempotencyKey = fodeAuthorityClean_(p.idempotencyKey);
  if (!evidenceReference) throw new Error("EVIDENCE_REFERENCE_REQUIRED");
  if (reason.length < 8) throw new Error("RECONCILIATION_REASON_REQUIRED");
  if (!idempotencyKey) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  return fodeStoreIntegrationPreview_("FRAUD_RECONCILIATION", {
    ok: true,
    schemaVersion: "FODE_FRAUD_RECONCILIATION_PREVIEW_V1",
    previewId: "FODE-FRAUD-RECONCILIATION-" + Utilities.getUuid(),
    applicantId: context.applicantId,
    actor: actor.email,
    actorRole: actor.role,
    idempotencyKey: idempotencyKey,
    resolution: resolution,
    evidenceReference: evidenceReference,
    reason: reason,
    sourceFingerprint: fodeFraudReconciliationFingerprint_(termination, context.rowObj),
    state: "READY",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + FODE_INTEGRATION_PREVIEW_TTL_SECONDS * 1000).toISOString()
  });
}

function admin_executeFodeFraudReconciliationResolution(payload) {
  var actor = fodeAuthorityActorAll_(["CAN_ADMIN_PORTAL_ACCESS", "CAN_MANAGE_REGISTRY"]);
  var p = payload && typeof payload === "object" ? payload : {};
  if (fodeAuthorityClean_(p.confirmation) !== "CONFIRM_FRAUD_RECONCILIATION") throw new Error("EXPLICIT_CONFIRMATION_REQUIRED");
  var preview = fodeReadIntegrationPreview_("FRAUD_RECONCILIATION", p.previewId, actor).preview;
  var receiptFingerprint = fodeAuthorityFingerprint_({
    operation: "FRAUD_RECONCILIATION",
    applicantId: preview.applicantId,
    resolution: preview.resolution,
    evidenceReference: preview.evidenceReference,
    reason: preview.reason
  });
  var prior = fodeReadAuthorityReceipt_(preview.idempotencyKey, receiptFingerprint);
  if (prior) return prior;
  return fodeWithAuthorityLock_(function () {
    fodeRevalidateMutationActorAll_(actor, ["CAN_ADMIN_PORTAL_ACCESS", "CAN_MANAGE_REGISTRY"]);
    var replay = fodeReadAuthorityReceipt_(preview.idempotencyKey, receiptFingerprint);
    if (replay) return replay;
    var context = fodeExactApplicantRow_(preview.applicantId);
    var termination = fodeReadAuthorityState_("PORTAL_TERMINATION", context.applicantId);
    if (!termination || fodeAuthorityUpper_(termination.state) !== "PENDING_FRAUD_CONFIRMATION") {
      throw new Error("PENDING_FRAUD_CONFIRMATION_NOT_FOUND");
    }
    if (fodeFraudReconciliationFingerprint_(termination, context.rowObj) !== preview.sourceFingerprint) {
      throw new Error("FRAUD_RECONCILIATION_AUTHORITY_CHANGED");
    }
    var documents = fodeRegistryDocumentAuthority_(context.rowObj);
    if (preview.resolution === "CONFIRM_FRAUD" && documents.fraudStatus !== "CONFIRMED") throw new Error("CONFIRMED_FRAUD_EVIDENCE_REQUIRED");
    if (preview.resolution === "DISMISS_ABORTED_CONFIRMATION" && documents.fraudStatus === "CONFIRMED") throw new Error("CONFIRMED_FRAUD_CANNOT_BE_DISMISSED");
    var now = new Date().toISOString();
    var nextState = preview.resolution === "CONFIRM_FRAUD" ? "PORTAL_ACCESS_TERMINATION_REQUIRED" : "FRAUD_CONFIRMATION_RECONCILED_NO_FRAUD";
    var record = fodeWriteAuthorityState_("PORTAL_TERMINATION", context.applicantId, {
      state: nextState,
      fraudStatus: preview.resolution === "CONFIRM_FRAUD" ? "CONFIRMED" : "NOT_CONFIRMED",
      fraudSourceFingerprint: fodeAuthorityClean_(termination.fraudSourceFingerprint || fodeFraudTerminationFingerprint_(context.rowObj)),
      createdAt: fodeAuthorityClean_(termination.createdAt || now),
      createdBy: fodeAuthorityClean_(termination.createdBy || actor.email),
      requiredAt: preview.resolution === "CONFIRM_FRAUD" ? now : "",
      reconciledAt: now,
      reconciledBy: actor.email,
      reconciliationResolution: preview.resolution,
      evidenceReference: preview.evidenceReference,
      reason: preview.reason,
      portalAccessMutationPerformed: false
    }, preview.resolution === "CONFIRM_FRAUD" ? "FODE_PORTAL_TERMINATION_REQUIRED" : "FODE_FRAUD_CONFIRMATION_RECONCILED", actor);
    return fodeWriteAuthorityReceipt_(preview.idempotencyKey, receiptFingerprint, {
      ok: true,
      schemaVersion: "FODE_FRAUD_RECONCILIATION_RESULT_V1",
      applicantId: context.applicantId,
      state: record.state,
      resolution: record.reconciliationResolution,
      portalAdministrationBlocked: record.state === "PORTAL_ACCESS_TERMINATION_REQUIRED",
      portalAccessMutationPerformed: false,
      reconciledAt: record.reconciledAt,
      reconciledBy: record.reconciledBy
    });
  });
}

function fodeIntegrationPreviewKey_(domain, previewId) {
  return "FODE_" + fodeAuthorityUpper_(domain).replace(/[^A-Z0-9_]/g, "_") + "_PREVIEW_" + fodeAuthorityClean_(previewId).replace(/[^A-Za-z0-9_-]/g, "_");
}

function fodeStoreIntegrationPreview_(domain, preview) {
  CacheService.getUserCache().put(
    fodeIntegrationPreviewKey_(domain, preview.previewId),
    JSON.stringify(preview),
    FODE_INTEGRATION_PREVIEW_TTL_SECONDS
  );
  return preview;
}

function fodeReadIntegrationPreview_(domain, previewId, actor) {
  var key = fodeIntegrationPreviewKey_(domain, previewId);
  var raw = CacheService.getUserCache().get(key);
  if (!raw) throw new Error("PREVIEW_EXPIRED_OR_UNKNOWN");
  var preview = JSON.parse(raw);
  if (preview.actor !== actor.email) throw new Error("PREVIEW_ACTOR_MISMATCH");
  if (Date.parse(preview.expiresAt) <= Date.now()) throw new Error("PREVIEW_EXPIRED");
  return { key: key, preview: preview };
}

function fodePortalSecretStatusFingerprint_(secret) {
  return fodeAuthorityFingerprint_({
    applicantId: fodeAuthorityClean_(secret && secret.applicantId || ""),
    status: fodeAuthorityUpper_(secret && secret.status || ""),
    found: secret && secret.found === true,
    rowIndex: Number(secret && secret.rowIndex || 0)
  });
}

function fodePortalActionSourceFingerprint_(secret, terminationCase) {
  return fodeAuthorityFingerprint_({
    portalAuthority: fodePortalSecretStatusFingerprint_(secret),
    terminationState: fodeAuthorityUpper_(terminationCase && terminationCase.state || ""),
    fraudSourceFingerprint: fodeAuthorityClean_(terminationCase && terminationCase.fraudSourceFingerprint || "")
  });
}

function admin_previewFodePortalAccessAction(payload) {
  var actor = fodeAuthorityActor_("CAN_ADMIN_PORTAL_ACCESS");
  var p = payload && typeof payload === "object" ? payload : {};
  var context = fodeExactApplicantRow_(p.applicantId);
  var action = fodeAuthorityUpper_(p.action);
  var idempotencyKey = fodeAuthorityClean_(p.idempotencyKey);
  if (["CREATE", "ACTIVATE", "DEACTIVATE", "ROTATE"].indexOf(action) < 0) throw new Error("UNSUPPORTED_PORTAL_ACTION");
  if (!idempotencyKey) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  var secret = lookupPortalSecretForApplicant_(context.applicantId, { source: "config" });
  var termination = fodeReadAuthorityState_("PORTAL_TERMINATION", context.applicantId);
  var terminationState = fodeAuthorityUpper_(termination && termination.state || "");
  var status = fodeApplyPortalTerminationAuthority_(fodePortalStatusProjection_(context.rowObj, secret), termination);
  if (terminationState === "PENDING_FRAUD_CONFIRMATION") throw new Error("PORTAL_TERMINATION_RECONCILIATION_REQUIRED");
  if (terminationState === "PORTAL_ACCESS_TERMINATION_REQUIRED" && action !== "DEACTIVATE") {
    throw new Error("PORTAL_TERMINATION_DEACTIVATION_REQUIRED");
  }
  if (terminationState === "PORTAL_ACCESS_TERMINATED") throw new Error("PORTAL_ACCESS_TERMINATED");
  if (action === "CREATE" && status.tokenState !== "MISSING") throw new Error("PORTAL_AUTHORITY_ALREADY_EXISTS");
  if ((action === "ACTIVATE" || action === "DEACTIVATE") && status.tokenState === "MISSING" &&
      !(action === "DEACTIVATE" && terminationState === "PORTAL_ACCESS_TERMINATION_REQUIRED")) {
    throw new Error("PORTAL_AUTHORITY_MISSING");
  }
  var previewId = "FODE-PORTAL-" + Utilities.getUuid();
  return fodeStoreIntegrationPreview_("PORTAL", {
    ok: true,
    schemaVersion: "FODE_PORTAL_ACTION_PREVIEW_V1",
    previewId: previewId,
    applicantId: context.applicantId,
    rowNumber: context.rowNumber,
    action: action,
    idempotencyKey: idempotencyKey,
    actor: actor.email,
    actorRole: actor.role,
    currentStatus: status,
    sourceFingerprint: fodePortalActionSourceFingerprint_(secret, termination),
    state: "READY",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + FODE_INTEGRATION_PREVIEW_TTL_SECONDS * 1000).toISOString()
  });
}

function fodeSetPortalSecretStatus_(applicantId, active, targetRowIndex) {
  var opened = openPortalSecretsExistingSheet_(newDebugId_(), { source: "config" });
  if (!opened || opened.ok !== true) throw new Error(fodeAuthorityClean_(opened && opened.code || "PORTAL_SECRETS_UNAVAILABLE"));
  var sheet = opened.sheet;
  var lastColumn = sheet.getLastColumn();
  var lastRow = sheet.getLastRow();
  if (lastColumn < 1 || lastRow < 2) throw new Error("PORTAL_AUTHORITY_MISSING");
  var headers = sheet.getRange(1, 1, 1, lastColumn).getValues()[0];
  var idx = buildPortalSecretHeaderIndex_(headers);
  if (!idx.ApplicantID || !idx.Status) throw new Error("PORTAL_STATUS_SCHEMA_UNAVAILABLE");
  var values = sheet.getRange(2, 1, lastRow - 1, lastColumn).getValues();
  var matches = [];
  for (var i = 0; i < values.length; i++) {
    if (fodeAuthorityClean_(values[i][idx.ApplicantID - 1]).toLowerCase() === fodeAuthorityClean_(applicantId).toLowerCase()) matches.push(i + 2);
  }
  if (!matches.length) throw new Error("PORTAL_AUTHORITY_MISSING");
  if (active) {
    var target = Number(targetRowIndex || 0);
    if (matches.indexOf(target) < 0) throw new Error("PORTAL_AUTHORITY_RECORD_CHANGED");
    matches.forEach(function (rowNumber) {
      sheet.getRange(rowNumber, idx.Status).setValue(rowNumber === target ? "Active" : "Inactive");
    });
  } else {
    matches.forEach(function (rowNumber) { sheet.getRange(rowNumber, idx.Status).setValue("Inactive"); });
  }
  return { updated: matches.length, state: active ? "ACTIVE" : "INACTIVE" };
}

function fodePortalDurableReceiptResult_(projection, action, status) {
  var source = projection && typeof projection === "object" ? projection : {};
  return {
    ok: source.ok !== false,
    schemaVersion: "FODE_PORTAL_ACTION_RECEIPT_V1",
    applicantId: fodeAuthorityClean_(source.applicantId || ""),
    action: fodeAuthorityUpper_(action),
    status: fodeAuthorityUpper_(status),
    accessState: fodeAuthorityUpper_(source.accessState || ""),
    terminationState: fodeAuthorityUpper_(source.terminationState || ""),
    blockCode: fodeAuthorityClean_(source.blockCode || ""),
    available: source.available === true,
    portalAccessMutationPerformed: status === "COMPLETED",
    completedAt: status === "COMPLETED" ? new Date().toISOString() : ""
  };
}

function admin_getFodePortalActionReconciliationQueue(payload) {
  fodeAuthorityActor_("CAN_ADMIN_PORTAL_ACCESS");
  var rows = fodeDurableReceiptIndex_("PORTAL_ACTION").filter(function (record) {
    return ["PENDING", "RECONCILIATION_REQUIRED"].indexOf(fodeAuthorityUpper_(record.status)) >= 0;
  }).map(function (record) {
    return {
      applicantId: fodeAuthorityClean_(record.applicantId || ""),
      status: fodeAuthorityUpper_(record.status),
      action: fodeAuthorityUpper_(record.result && record.result.action || ""),
      recordedAt: fodeAuthorityClean_(record.recordedAt || ""),
      recordedBy: fodeAuthorityClean_(record.recordedBy || ""),
      blockCode: fodeAuthorityClean_(record.result && record.result.blockCode || "PORTAL_ACTION_RECONCILIATION_REQUIRED")
    };
  });
  var limit = Math.max(1, Math.min(200, Number(payload && payload.limit || 100)));
  return {
    ok: true,
    readOnly: true,
    schemaVersion: "FODE_PORTAL_ACTION_RECONCILIATION_QUEUE_V1",
    total: rows.length,
    rows: rows.slice(0, limit)
  };
}

function admin_executeFodePortalAccessAction(payload) {
  var actor = fodeAuthorityActor_("CAN_ADMIN_PORTAL_ACCESS");
  var p = payload && typeof payload === "object" ? payload : {};
  if (fodeAuthorityClean_(p.confirmation) !== "CONFIRM_PORTAL_ACCESS_ACTION") throw new Error("EXPLICIT_CONFIRMATION_REQUIRED");
  var cached = fodeReadIntegrationPreview_("PORTAL", p.previewId, actor);
  var preview = cached.preview;
  var receiptFingerprint = fodeAuthorityFingerprint_({
    operation: "PORTAL_ACCESS",
    applicantId: preview.applicantId,
    action: preview.action
  });
  var prior = fodeReadDurableReceipt_("PORTAL_ACTION", preview.idempotencyKey, receiptFingerprint);
  if (prior && prior.status === "COMPLETED") return prior.result;
  if (prior) throw new Error("PORTAL_ACTION_RECONCILIATION_REQUIRED");
  return fodeWithAuthorityLock_(function () {
    fodeRevalidateMutationActor_(actor, "CAN_ADMIN_PORTAL_ACCESS");
    var replay = fodeReadDurableReceipt_("PORTAL_ACTION", preview.idempotencyKey, receiptFingerprint);
    if (replay && replay.status === "COMPLETED") return replay.result;
    if (replay) throw new Error("PORTAL_ACTION_RECONCILIATION_REQUIRED");
    var context = fodeExactApplicantRow_(preview.applicantId);
    var persistedAction = fodeReadAuthorityState_("PORTAL_ACTION", context.applicantId);
    if (persistedAction && persistedAction.state === "AUTHORIZED_PENDING_EXECUTION") {
      throw new Error("PORTAL_ACTION_RECONCILIATION_REQUIRED");
    }
    var currentSecret = lookupPortalSecretForApplicant_(context.applicantId, { source: "config" });
    var currentTermination = fodeReadAuthorityState_("PORTAL_TERMINATION", context.applicantId);
    if (fodePortalActionSourceFingerprint_(currentSecret, currentTermination) !== preview.sourceFingerprint) throw new Error("PORTAL_AUTHORITY_CHANGED");
    fodeWriteDurableReceipt_(
      "PORTAL_ACTION",
      preview.idempotencyKey,
      receiptFingerprint,
      "PENDING",
      {
        applicantId: context.applicantId,
        action: preview.action,
        blockCode: "PORTAL_ACTION_EXECUTION_PENDING",
        portalAccessMutationPerformed: false
      },
      actor,
      "FODE_PORTAL_ACTION_RECEIPT_PENDING"
    );
    fodeWriteAuthorityState_("PORTAL_ACTION", context.applicantId, {
      state: "AUTHORIZED_PENDING_EXECUTION",
      action: preview.action,
      idempotencyKey: preview.idempotencyKey,
      sourceFingerprint: preview.sourceFingerprint,
      authorizedAt: new Date().toISOString(),
      portalAccessMutationPerformed: false
    }, "FODE_PORTAL_ACCESS_EXECUTION_AUTHORIZED", actor);
    try {
      if (preview.action === "CREATE" || preview.action === "ROTATE") {
        var result = resetPortalSecretForApplicant_(context.applicantId, {
          email: fodeAuthorityClean_(context.rowObj.Parent_Email_Corrected || context.rowObj.Parent_Email || ""),
          fullName: fodeAuthorityClean_((context.rowObj.First_Name || "") + " " + (context.rowObj.Last_Name || "")),
          admissionsSheet: context.sheet,
          rowNumber: context.rowNumber
        });
        if (!result || result.ok !== true) throw new Error("PORTAL_SECRET_WRITE_FAILED");
        applyPatch_(context.sheet, context.rowNumber, { Portal_Access_Status: "Open" });
      } else {
        var terminationRequired = fodeAuthorityUpper_(currentTermination && currentTermination.state || "") === "PORTAL_ACCESS_TERMINATION_REQUIRED";
        if (!(preview.action === "DEACTIVATE" && terminationRequired && (!currentSecret || currentSecret.found !== true))) {
          fodeSetPortalSecretStatus_(context.applicantId, preview.action === "ACTIVATE", Number(currentSecret.rowIndex || 0));
        }
        applyPatch_(context.sheet, context.rowNumber, { Portal_Access_Status: preview.action === "ACTIVATE" ? "Open" : "Locked" });
      }
      var event = "FODE_PORTAL_ACCESS_" + (preview.action === "CREATE" ? "CREATED" : (preview.action === "ROTATE" ? "ROTATED" : (preview.action === "ACTIVATE" ? "ACTIVATED" : "DEACTIVATED")));
      if (preview.action === "DEACTIVATE" && fodeAuthorityUpper_(currentTermination && currentTermination.state || "") === "PORTAL_ACCESS_TERMINATION_REQUIRED") {
        fodeWriteAuthorityState_("PORTAL_TERMINATION", context.applicantId, {
          state: "PORTAL_ACCESS_TERMINATED",
          fraudStatus: "CONFIRMED",
          fraudSourceFingerprint: fodeAuthorityClean_(currentTermination.fraudSourceFingerprint || ""),
          createdAt: fodeAuthorityClean_(currentTermination.createdAt || ""),
          createdBy: fodeAuthorityClean_(currentTermination.createdBy || ""),
          requiredAt: fodeAuthorityClean_(currentTermination.requiredAt || ""),
          terminatedAt: new Date().toISOString(),
          terminatedBy: actor.email,
          portalAccessMutationPerformed: true
        }, "FODE_PORTAL_ACCESS_TERMINATED", actor);
      }
      fodeWriteAuthorityState_("PORTAL_ACTION", context.applicantId, {
        state: "COMPLETED",
        action: preview.action,
        idempotencyKey: preview.idempotencyKey,
        sourceFingerprint: preview.sourceFingerprint,
        authorizedAt: new Date().toISOString(),
        completedAt: new Date().toISOString(),
        portalAccessMutationPerformed: true
      }, event, actor);
      var refreshedRow = getRowObject_(context.sheet, context.rowNumber);
      var refreshedSecret = lookupPortalSecretForApplicant_(context.applicantId, { source: "config" });
      var refreshedTermination = fodeReadAuthorityState_("PORTAL_TERMINATION", context.applicantId);
      var projection = fodeApplyPortalTerminationAuthority_(
        fodePortalStatusProjection_(refreshedRow, refreshedSecret),
        refreshedTermination
      );
      projection.history = fodeRecentAuditEvents_(
        ["FODE_PORTAL_ACCESS_CREATED", "FODE_PORTAL_ACCESS_ACTIVATED", "FODE_PORTAL_ACCESS_DEACTIVATED", "FODE_PORTAL_ACCESS_ROTATED"],
        context.applicantId,
        25
      );
      var durableResult = fodePortalDurableReceiptResult_(projection, preview.action, "COMPLETED");
      fodeWriteDurableReceipt_(
        "PORTAL_ACTION",
        preview.idempotencyKey,
        receiptFingerprint,
        "COMPLETED",
        durableResult,
        actor,
        "FODE_PORTAL_ACTION_RECEIPT_COMPLETED"
      );
      return durableResult;
    } catch (executionError) {
      try {
        fodeWriteDurableReceipt_(
          "PORTAL_ACTION",
          preview.idempotencyKey,
          receiptFingerprint,
          "RECONCILIATION_REQUIRED",
          {
            applicantId: context.applicantId,
            action: preview.action,
            blockCode: "PORTAL_ACTION_RECONCILIATION_REQUIRED",
            portalAccessMutationPerformed: true
          },
          actor,
          "FODE_PORTAL_ACTION_RECEIPT_RECONCILIATION_REQUIRED"
        );
      } catch (_receiptError) {}
      throw executionError;
    }
  });
}

function fodeCanonicalFinanceForContext_(context) {
  var canonical = buildCanonicalPopulationRow_(context.rowObj, context.rowNumber, {
    sourceSheetName: context.sheet && typeof context.sheet.getName === "function" ? context.sheet.getName() : ""
  });
  var finance = canonical.finance || {};
  return {
    dto: finance,
    authority: finance.financeAuthority || {},
    exceptions: finance.exceptions || {},
    objects: finance.objects || {},
    amounts: finance.amounts || {}
  };
}

function fodeFinancePolicyKind_(value) {
  var kind = fodeAuthorityUpper_(value);
  return ["REFUND", "CREDIT", "ADJUSTMENT"].indexOf(kind) >= 0 ? kind : "FINANCE_EXCEPTION";
}

function fodeFinanceHandoffProjection_(context, storedRecord) {
  var finance = fodeCanonicalFinanceForContext_(context);
  var stored = storedRecord && typeof storedRecord === "object" ? storedRecord : {};
  var kind = fodeFinancePolicyKind_(stored.caseKind || finance.exceptions.financeExceptionCode || "FINANCE_EXCEPTION");
  var policyRequired = kind !== "FINANCE_EXCEPTION";
  var row = context.rowObj || {};
  var applicantName = typeof canonicalFinanceApplicantName_ === "function"
    ? canonicalFinanceApplicantName_(row, finance.dto && finance.dto.identity && finance.dto.identity.applicantName)
    : fodeAuthorityClean_(row.Student_Name || row.Applicant_Name || ((row.First_Name || "") + " " + (row.Last_Name || "")));
  var testRecord = typeof canonicalFinanceTestRecordProjection_ === "function"
    ? canonicalFinanceTestRecordProjection_(row, context.applicantId)
    : { isTestRecord: false, source: "" };
  return {
    ok: true,
    readOnly: true,
    schemaVersion: FODE_FINANCE_HANDOFF_SCHEMA_VERSION,
    authoritySource: "FODE Finance Exception and Handoff Authority",
    applicantId: context.applicantId,
    applicantName: applicantName,
    testRecord: testRecord.isTestRecord === true,
    testRecordSource: fodeAuthorityClean_(testRecord.source || ""),
    state: policyRequired ? "POLICY_REQUIRED" : fodeAuthorityUpper_(stored.state || "REQUESTED"),
    caseKind: kind,
    financeState: fodeAuthorityClean_(finance.authority.financeState || "UNKNOWN"),
    financeReasonCode: fodeAuthorityClean_(finance.authority.financeReasonCode || ""),
    exceptionCode: fodeAuthorityClean_(finance.exceptions.financeExceptionCode || ""),
    zohoReference: fodeAuthorityClean_(stored.zohoReference || ""),
    evidenceReference: fodeAuthorityClean_(stored.evidenceReference || ""),
    reviewedBy: fodeAuthorityClean_(stored.reviewedBy || ""),
    reviewedAt: fodeAuthorityClean_(stored.reviewedAt || ""),
    updatedAt: fodeAuthorityClean_(stored.updatedAt || ""),
    policy: {
      refunds: "POLICY_REQUIRED",
      credits: "POLICY_REQUIRED",
      adjustments: "POLICY_REQUIRED",
      schoolCancelledProgramme: "PRINCIPAL_APPROVAL_REQUIRED"
    },
    externalWritePerformed: false
  };
}

function admin_getFodeFinanceExceptionApplicant(payload) {
  fodeAuthorityActor_("CAN_REVIEW_FINANCE_EXCEPTIONS");
  var context = fodeExactApplicantRow_(payload && payload.applicantId);
  return fodeFinanceHandoffProjection_(context, fodeReadAuthorityState_("FINANCE_HANDOFF", context.applicantId));
}

function admin_getFodeFinanceExceptionWorklist(payload) {
  fodeAuthorityActor_("CAN_REVIEW_FINANCE_EXCEPTIONS");
  var snapshot = canonicalPopulationSnapshot_();
  var stateIndex = fodeAuthorityStateIndex_("FINANCE_HANDOFF");
  var rows = [];
  Object.keys(snapshot._internalSourceRowsByRowNumber || {}).forEach(function (rowNumber) {
    var rowObj = snapshot._internalSourceRowsByRowNumber[rowNumber];
    var applicantId = fodeAuthorityClean_(rowObj && rowObj.ApplicantID);
    if (!applicantId) return;
    var context = { applicantId: applicantId, rowNumber: Number(rowNumber), rowObj: rowObj, sheet: null };
    var projection = fodeFinanceHandoffProjection_(context, stateIndex[applicantId] || null);
    if (projection.exceptionCode || stateIndex[applicantId]) rows.push(projection);
  });
  var limit = Math.max(1, Math.min(200, Number(payload && payload.limit || 100)));
  return { ok: true, readOnly: true, schemaVersion: "FODE_FINANCE_EXCEPTION_WORKLIST_V1", total: rows.length, rows: rows.slice(0, limit) };
}

function fodeFinanceTransitionAllowed_(fromState, toState) {
  var map = {
    REQUESTED: ["UNDER_REVIEW", "POLICY_REQUIRED"],
    UNDER_REVIEW: ["APPROVED", "REJECTED", "POLICY_REQUIRED"],
    APPROVED: ["HANDED_TO_ZOHO"],
    HANDED_TO_ZOHO: ["COMPLETED_EXTERNALLY"],
    REJECTED: [],
    COMPLETED_EXTERNALLY: [],
    POLICY_REQUIRED: []
  };
  return (map[fodeAuthorityUpper_(fromState)] || []).indexOf(fodeAuthorityUpper_(toState)) >= 0;
}

function admin_previewFodeFinanceHandoff(payload) {
  var actor = fodeAuthorityActor_("CAN_MANAGE_FINANCE_HANDOFF");
  var p = payload && typeof payload === "object" ? payload : {};
  var context = fodeExactApplicantRow_(p.applicantId);
  var current = fodeFinanceHandoffProjection_(context, fodeReadAuthorityState_("FINANCE_HANDOFF", context.applicantId));
  var nextState = fodeAuthorityUpper_(p.nextState);
  var idempotencyKey = fodeAuthorityClean_(p.idempotencyKey);
  var caseKind = fodeFinancePolicyKind_(p.caseKind || current.caseKind);
  if (!idempotencyKey) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  if (!fodeFinanceTransitionAllowed_(current.state, nextState)) throw new Error("FINANCE_HANDOFF_TRANSITION_DENIED");
  if (caseKind !== "FINANCE_EXCEPTION" && nextState !== "POLICY_REQUIRED") throw new Error("FINANCE_POLICY_REQUIRED");
  var evidenceReference = fodeAuthorityClean_(p.evidenceReference || current.evidenceReference);
  var zohoReference = fodeAuthorityClean_(p.zohoReference);
  if (["APPROVED", "REJECTED", "POLICY_REQUIRED", "HANDED_TO_ZOHO", "COMPLETED_EXTERNALLY"].indexOf(nextState) >= 0 && !evidenceReference) throw new Error("EVIDENCE_REFERENCE_REQUIRED");
  if (["HANDED_TO_ZOHO", "COMPLETED_EXTERNALLY"].indexOf(nextState) >= 0 && !zohoReference) throw new Error("ZOHO_REFERENCE_REQUIRED");
  return fodeStoreIntegrationPreview_("FINANCE", {
    ok: true,
    schemaVersion: "FODE_FINANCE_HANDOFF_PREVIEW_V1",
    previewId: "FODE-FINANCE-" + Utilities.getUuid(),
    applicantId: context.applicantId,
    applicantName: current.applicantName,
    testRecord: current.testRecord === true,
    testRecordSource: current.testRecordSource,
    actor: actor.email,
    actorRole: actor.role,
    idempotencyKey: idempotencyKey,
    fromState: current.state,
    nextState: nextState,
    caseKind: caseKind,
    evidenceReference: evidenceReference,
    zohoReference: zohoReference,
    sourceFingerprint: fodeAuthorityFingerprint_(current),
    state: "READY",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + FODE_INTEGRATION_PREVIEW_TTL_SECONDS * 1000).toISOString()
  });
}

function admin_executeFodeFinanceHandoff(payload) {
  var actor = fodeAuthorityActor_("CAN_MANAGE_FINANCE_HANDOFF");
  var p = payload && typeof payload === "object" ? payload : {};
  if (fodeAuthorityClean_(p.confirmation) !== "CONFIRM_FINANCE_HANDOFF") throw new Error("EXPLICIT_CONFIRMATION_REQUIRED");
  var cached = fodeReadIntegrationPreview_("FINANCE", p.previewId, actor);
  var preview = cached.preview;
  var receiptFingerprint = fodeAuthorityFingerprint_({
    operation: "FINANCE_HANDOFF",
    applicantId: preview.applicantId,
    fromState: preview.fromState,
    nextState: preview.nextState,
    caseKind: preview.caseKind,
    evidenceReference: preview.evidenceReference,
    zohoReference: preview.zohoReference
  });
  var prior = fodeReadAuthorityReceipt_(preview.idempotencyKey, receiptFingerprint);
  if (prior) return prior;
  return fodeWithAuthorityLock_(function () {
    fodeRevalidateMutationActor_(actor, "CAN_MANAGE_FINANCE_HANDOFF");
    var replay = fodeReadAuthorityReceipt_(preview.idempotencyKey, receiptFingerprint);
    if (replay) return replay;
    var context = fodeExactApplicantRow_(preview.applicantId);
    var current = fodeFinanceHandoffProjection_(context, fodeReadAuthorityState_("FINANCE_HANDOFF", context.applicantId));
    if (fodeAuthorityFingerprint_(current) !== preview.sourceFingerprint) throw new Error("FINANCE_HANDOFF_AUTHORITY_CHANGED");
    var record = fodeWriteAuthorityState_("FINANCE_HANDOFF", context.applicantId, {
      state: preview.nextState,
      caseKind: preview.caseKind,
      evidenceReference: preview.evidenceReference,
      zohoReference: preview.zohoReference,
      reviewedBy: actor.email,
      reviewedAt: new Date().toISOString(),
      externalWritePerformed: false
    }, "FODE_FINANCE_HANDOFF_STATE_CHANGED", actor);
    return fodeWriteAuthorityReceipt_(
      preview.idempotencyKey,
      receiptFingerprint,
      fodeFinanceHandoffProjection_(context, record)
    );
  });
}

function fodeClassroomMappingAuthority_(rowObj, storedRecord) {
  var row = rowObj || {};
  var stored = storedRecord && typeof storedRecord === "object" ? storedRecord : {};
  if (stored.state === "CONFIRMED" && stored.mappings && typeof stored.mappings === "object") {
    return {
      available: true,
      sourceField: "FODE_CLASSROOM_MAPPING_V1",
      evidenceSource: fodeAuthorityClean_(stored.evidenceSource || ""),
      confirmedBy: fodeAuthorityClean_(stored.confirmedBy || ""),
      confirmedAt: fodeAuthorityClean_(stored.confirmedAt || ""),
      mappings: stored.mappings
    };
  }
  var sourceField = fodeAuthorityClean_(row.FODE_Classroom_Subject_Mapping_JSON) ? "FODE_Classroom_Subject_Mapping_JSON" : (fodeAuthorityClean_(row.Classroom_Subject_Mapping_JSON) ? "Classroom_Subject_Mapping_JSON" : "");
  var parsed = sourceField ? fodeAuthorityJson_(row[sourceField], null) : null;
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
    return {
      available: false,
      sourceField: sourceField,
      evidenceSource: "Legacy row evidence",
      confirmedBy: "",
      confirmedAt: "",
      mappings: {},
      legacyEvidencePresent: true,
      reasonCode: "CLASSROOM_MAPPING_INGESTION_REQUIRED"
    };
  }
  return {
    available: false,
    sourceField: sourceField,
    evidenceSource: "",
    confirmedBy: "",
    confirmedAt: "",
    mappings: {},
    reasonCode: sourceField ? "CLASSROOM_MAPPING_MALFORMED" : "CLASSROOM_MAPPING_MISSING"
  };
}

function fodeClassroomReadinessProjection_(context, registry, storedRecord, mappingRecord) {
  var row = context.rowObj || {};
  var stored = storedRecord && typeof storedRecord === "object" ? storedRecord : {};
  var mappingAuthority = fodeClassroomMappingAuthority_(row, mappingRecord);
  var mapping = mappingAuthority.mappings;
  var confirmedSubjects = registry.confirmedSubjects || [];
  var mappedSubjects = [];
  var missingMappings = [];
  confirmedSubjects.forEach(function (subject) {
    var reference = mapping[subject] || mapping[fodeAuthorityClean_(subject).toLowerCase()] || "";
    if (fodeAuthorityClean_(reference)) mappedSubjects.push({ subject: subject, courseReference: fodeAuthorityClean_(reference) });
    else missingMappings.push(subject);
  });
  var registrationComplete = /^(YES|TRUE|COMPLETE|REGISTERED)$/.test(fodeAuthorityUpper_(row.Registration_Complete || row.Registration_Status || ""));
  var paymentComplete = typeof isCanonicalPaymentVerified_ === "function" ? isCanonicalPaymentVerified_(row) : /^(YES|TRUE|VERIFIED)$/.test(fodeAuthorityUpper_(row.Payment_Verified || row.Receipt_Status || ""));
  var notReady = [];
  var reviewRequired = [];
  if (!registrationComplete) notReady.push("REGISTRATION_INCOMPLETE");
  if (!paymentComplete) notReady.push("PAYMENT_INCOMPLETE");
  if (registry.state !== "CONFIRMED") reviewRequired.push("REGISTRY_SUBJECT_EVIDENCE_" + fodeAuthorityUpper_(registry.state || "UNAVAILABLE"));
  if (mappingAuthority.available !== true) {
    if (mappingAuthority.reasonCode === "CLASSROOM_MAPPING_INGESTION_REQUIRED") {
      reviewRequired.push(mappingAuthority.reasonCode);
    } else {
      notReady.push(mappingAuthority.reasonCode || "CLASSROOM_MAPPING_MISSING");
    }
  }
  if (missingMappings.length && mappingAuthority.reasonCode !== "CLASSROOM_MAPPING_INGESTION_REQUIRED") notReady.push("SUBJECT_MAPPING_MISSING");
  if ((registry.documentVerification || {}).verified !== true) reviewRequired.push("DOCUMENT_VERIFICATION_" + fodeAuthorityUpper_(registry.documentVerification && registry.documentVerification.state || "INCOMPLETE"));
  var baseState = notReady.length ? "NOT_READY" : (reviewRequired.length ? "REVIEW_REQUIRED" : "READY");
  if (registry.fraudStatus === "CONFIRMED") {
    baseState = "NOT_READY";
    notReady.push("CONFIRMED_DOCUMENT_FRAUD");
  }
  var storedState = fodeAuthorityUpper_(stored.state || "");
  var state = ["APPROVED_FOR_HANDOFF", "HANDED_TO_CLASSROOM", "COMPLETED_EXTERNALLY"].indexOf(storedState) >= 0 && baseState === "READY" ? storedState : baseState;
  return {
    ok: true,
    readOnly: true,
    schemaVersion: FODE_CLASSROOM_HANDOFF_SCHEMA_VERSION,
    authoritySource: "FODE Classroom Readiness and Handoff Authority",
    applicantId: context.applicantId,
    state: state,
    baseReadinessState: baseState,
    registered: registrationComplete,
    paid: paymentComplete,
    registryState: registry.state,
    documentVerificationState: registry.documentVerification && registry.documentVerification.state || "INCOMPLETE",
    fraudStatus: registry.fraudStatus,
    confirmedGrade: registry.confirmedGrade,
    confirmedSubjects: confirmedSubjects,
    mappingAuthority: mappingAuthority,
    mappedSubjects: mappedSubjects,
    missingMappings: missingMappings,
    missingRequirements: fodeAuthorityUnique_(notReady.concat(reviewRequired)),
    classroomReference: fodeAuthorityClean_(stored.classroomReference || ""),
    evidenceReference: fodeAuthorityClean_(stored.evidenceReference || ""),
    externalWritePerformed: false
  };
}

function admin_getFodeClassroomReadiness(payload) {
  fodeAuthorityActor_("CAN_READ_CLASSROOM");
  var context = fodeExactApplicantRow_(payload && payload.applicantId);
  var registry = resolveFodeRegistryAuthority_(context.rowObj, fodeReadAuthorityState_("REGISTRY", context.applicantId));
  return fodeClassroomReadinessProjection_(
    context,
    registry,
    fodeReadAuthorityState_("CLASSROOM_HANDOFF", context.applicantId),
    fodeReadAuthorityState_("CLASSROOM_MAPPING", context.applicantId)
  );
}

function fodeNormalizeClassroomMappings_(value, confirmedSubjects) {
  var raw = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  var canonical = Array.isArray(confirmedSubjects) ? confirmedSubjects : [];
  var keyed = {};
  Object.keys(raw).forEach(function (subject) {
    keyed[fodeAuthorityClean_(subject).toLowerCase()] = fodeAuthorityClean_(raw[subject]);
  });
  var allowed = canonical.map(function (subject) { return fodeAuthorityClean_(subject).toLowerCase(); });
  var unknown = Object.keys(keyed).filter(function (subject) { return allowed.indexOf(subject) < 0; });
  if (unknown.length) throw new Error("CLASSROOM_MAPPING_SUBJECT_NOT_REGISTERED: " + unknown.join(", "));
  var normalized = {};
  canonical.forEach(function (subject) {
    var reference = keyed[fodeAuthorityClean_(subject).toLowerCase()];
    if (!reference) throw new Error("CLASSROOM_REFERENCE_REQUIRED: " + subject);
    normalized[subject] = reference;
  });
  return normalized;
}

function admin_previewFodeClassroomSubjectMapping(payload) {
  var actor = fodeAuthorityActor_("CAN_MANAGE_CLASSROOM_HANDOFF");
  var p = payload && typeof payload === "object" ? payload : {};
  var context = fodeExactApplicantRow_(p.applicantId);
  var registry = resolveFodeRegistryAuthority_(context.rowObj, fodeReadAuthorityState_("REGISTRY", context.applicantId));
  if (registry.state !== "CONFIRMED") throw new Error("REGISTRY_CONFIRMATION_REQUIRED");
  var mappings = fodeNormalizeClassroomMappings_(p.mappings, registry.confirmedSubjects);
  var evidenceSource = fodeAuthorityClean_(p.evidenceSource);
  var idempotencyKey = fodeAuthorityClean_(p.idempotencyKey);
  if (!evidenceSource) throw new Error("CLASSROOM_MAPPING_EVIDENCE_SOURCE_REQUIRED");
  if (!idempotencyKey) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  var current = fodeReadAuthorityState_("CLASSROOM_MAPPING", context.applicantId) || {};
  return fodeStoreIntegrationPreview_("CLASSROOM_MAPPING", {
    ok: true,
    schemaVersion: "FODE_CLASSROOM_MAPPING_PREVIEW_V1",
    previewId: "FODE-CLASSROOM-MAPPING-" + Utilities.getUuid(),
    applicantId: context.applicantId,
    actor: actor.email,
    actorRole: actor.role,
    idempotencyKey: idempotencyKey,
    mappings: mappings,
    evidenceSource: evidenceSource,
    sourceFingerprint: fodeAuthorityFingerprint_({
      registry: registry.sourceFingerprint,
      currentMapping: current
    }),
    state: "READY",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + FODE_INTEGRATION_PREVIEW_TTL_SECONDS * 1000).toISOString()
  });
}

function admin_confirmFodeClassroomSubjectMapping(payload) {
  var actor = fodeAuthorityActor_("CAN_MANAGE_CLASSROOM_HANDOFF");
  var p = payload && typeof payload === "object" ? payload : {};
  if (fodeAuthorityClean_(p.confirmation) !== "CONFIRM_CLASSROOM_MAPPING") throw new Error("EXPLICIT_CONFIRMATION_REQUIRED");
  var preview = fodeReadIntegrationPreview_("CLASSROOM_MAPPING", p.previewId, actor).preview;
  var receiptFingerprint = fodeAuthorityFingerprint_({
    operation: "CLASSROOM_MAPPING",
    applicantId: preview.applicantId,
    mappings: preview.mappings,
    evidenceSource: preview.evidenceSource
  });
  var prior = fodeReadAuthorityReceipt_(preview.idempotencyKey, receiptFingerprint);
  if (prior) return prior;
  return fodeWithAuthorityLock_(function () {
    fodeRevalidateMutationActor_(actor, "CAN_MANAGE_CLASSROOM_HANDOFF");
    var replay = fodeReadAuthorityReceipt_(preview.idempotencyKey, receiptFingerprint);
    if (replay) return replay;
    var context = fodeExactApplicantRow_(preview.applicantId);
    var registry = resolveFodeRegistryAuthority_(context.rowObj, fodeReadAuthorityState_("REGISTRY", context.applicantId));
    var current = fodeReadAuthorityState_("CLASSROOM_MAPPING", context.applicantId) || {};
    if (fodeAuthorityFingerprint_({ registry: registry.sourceFingerprint, currentMapping: current }) !== preview.sourceFingerprint) {
      throw new Error("CLASSROOM_MAPPING_AUTHORITY_CHANGED");
    }
    if (registry.state !== "CONFIRMED") throw new Error("REGISTRY_CONFIRMATION_REQUIRED");
    var now = new Date().toISOString();
    var record = fodeWriteAuthorityState_("CLASSROOM_MAPPING", context.applicantId, {
      schemaVersion: "FODE_CLASSROOM_MAPPING_V1",
      state: "CONFIRMED",
      mappings: preview.mappings,
      evidenceSource: preview.evidenceSource,
      confirmedBy: actor.email,
      confirmedAt: now,
      externalWritePerformed: false
    }, "FODE_CLASSROOM_MAPPING_CONFIRMED", actor);
    return fodeWriteAuthorityReceipt_(preview.idempotencyKey, receiptFingerprint, {
      ok: true,
      schemaVersion: "FODE_CLASSROOM_MAPPING_V1",
      applicantId: context.applicantId,
      state: record.state,
      mappings: record.mappings,
      evidenceSource: record.evidenceSource,
      confirmedBy: record.confirmedBy,
      confirmedAt: record.confirmedAt,
      externalWritePerformed: false
    });
  });
}

function admin_getFodeClassroomReadinessWorklist(payload) {
  fodeAuthorityActor_("CAN_READ_CLASSROOM");
  var snapshot = canonicalPopulationSnapshot_();
  var registryIndex = fodeAuthorityStateIndex_("REGISTRY");
  var classroomIndex = fodeAuthorityStateIndex_("CLASSROOM_HANDOFF");
  var mappingIndex = fodeAuthorityStateIndex_("CLASSROOM_MAPPING");
  var rows = [];
  Object.keys(snapshot._internalSourceRowsByRowNumber || {}).forEach(function (rowNumber) {
    var rowObj = snapshot._internalSourceRowsByRowNumber[rowNumber];
    var applicantId = fodeAuthorityClean_(rowObj && rowObj.ApplicantID);
    if (!applicantId) return;
    var context = { applicantId: applicantId, rowNumber: Number(rowNumber), rowObj: rowObj, sheet: null };
    var registry = resolveFodeRegistryAuthority_(rowObj, registryIndex[applicantId] || null);
    rows.push(fodeClassroomReadinessProjection_(context, registry, classroomIndex[applicantId] || null, mappingIndex[applicantId] || null));
  });
  var requestedState = fodeAuthorityUpper_(payload && payload.state || "");
  if (requestedState) rows = rows.filter(function (row) { return row.state === requestedState; });
  var counts = fodeCompletionAggregate_(rows, function (row) { return row.state; });
  var limit = Math.max(1, Math.min(200, Number(payload && payload.limit || 100)));
  return {
    ok: true,
    readOnly: true,
    schemaVersion: "FODE_CLASSROOM_READINESS_WORKLIST_V1",
    total: rows.length,
    counts: counts,
    rows: rows.slice(0, limit)
  };
}

function admin_getFodeClassroomHandoffPackage(payload) {
  fodeAuthorityActor_("CAN_READ_CLASSROOM");
  var context = fodeExactApplicantRow_(payload && payload.applicantId);
  var registry = resolveFodeRegistryAuthority_(context.rowObj, fodeReadAuthorityState_("REGISTRY", context.applicantId));
  var readiness = fodeClassroomReadinessProjection_(
    context,
    registry,
    fodeReadAuthorityState_("CLASSROOM_HANDOFF", context.applicantId),
    fodeReadAuthorityState_("CLASSROOM_MAPPING", context.applicantId)
  );
  return {
    ok: readiness.state !== "NOT_READY",
    readOnly: true,
    schemaVersion: "FODE_CLASSROOM_HANDOFF_PACKAGE_V1",
    applicantId: context.applicantId,
    applicantName: fodeAuthorityClean_((context.rowObj.First_Name || "") + " " + (context.rowObj.Last_Name || "")),
    readiness: readiness,
    handoffPackage: {
      confirmedGrade: readiness.confirmedGrade,
      confirmedSubjects: readiness.confirmedSubjects,
      mappedSubjects: readiness.mappedSubjects,
      evidenceReference: readiness.evidenceReference
    },
    externalWritePerformed: false
  };
}

function fodeClassroomTransitionAllowed_(fromState, toState) {
  var map = {
    READY: ["APPROVED_FOR_HANDOFF"],
    APPROVED_FOR_HANDOFF: ["HANDED_TO_CLASSROOM"],
    HANDED_TO_CLASSROOM: ["COMPLETED_EXTERNALLY"]
  };
  return (map[fodeAuthorityUpper_(fromState)] || []).indexOf(fodeAuthorityUpper_(toState)) >= 0;
}

function admin_previewFodeClassroomHandoff(payload) {
  var actor = fodeAuthorityActor_("CAN_MANAGE_CLASSROOM_HANDOFF");
  var p = payload && typeof payload === "object" ? payload : {};
  var context = fodeExactApplicantRow_(p.applicantId);
  var registry = resolveFodeRegistryAuthority_(context.rowObj, fodeReadAuthorityState_("REGISTRY", context.applicantId));
  var current = fodeClassroomReadinessProjection_(
    context,
    registry,
    fodeReadAuthorityState_("CLASSROOM_HANDOFF", context.applicantId),
    fodeReadAuthorityState_("CLASSROOM_MAPPING", context.applicantId)
  );
  var nextState = fodeAuthorityUpper_(p.nextState);
  var idempotencyKey = fodeAuthorityClean_(p.idempotencyKey);
  if (!idempotencyKey) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  if (!fodeClassroomTransitionAllowed_(current.state, nextState)) throw new Error("CLASSROOM_HANDOFF_TRANSITION_DENIED");
  var evidenceReference = fodeAuthorityClean_(p.evidenceReference);
  var classroomReference = fodeAuthorityClean_(p.classroomReference);
  if (!evidenceReference) throw new Error("EVIDENCE_REFERENCE_REQUIRED");
  if (["HANDED_TO_CLASSROOM", "COMPLETED_EXTERNALLY"].indexOf(nextState) >= 0 && !classroomReference) throw new Error("CLASSROOM_REFERENCE_REQUIRED");
  return fodeStoreIntegrationPreview_("CLASSROOM", {
    ok: true,
    schemaVersion: "FODE_CLASSROOM_HANDOFF_PREVIEW_V1",
    previewId: "FODE-CLASSROOM-" + Utilities.getUuid(),
    applicantId: context.applicantId,
    actor: actor.email,
    actorRole: actor.role,
    idempotencyKey: idempotencyKey,
    fromState: current.state,
    nextState: nextState,
    evidenceReference: evidenceReference,
    classroomReference: classroomReference,
    sourceFingerprint: fodeAuthorityFingerprint_(current),
    state: "READY",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + FODE_INTEGRATION_PREVIEW_TTL_SECONDS * 1000).toISOString()
  });
}

function admin_executeFodeClassroomHandoff(payload) {
  var actor = fodeAuthorityActor_("CAN_MANAGE_CLASSROOM_HANDOFF");
  var p = payload && typeof payload === "object" ? payload : {};
  if (fodeAuthorityClean_(p.confirmation) !== "CONFIRM_CLASSROOM_HANDOFF") throw new Error("EXPLICIT_CONFIRMATION_REQUIRED");
  var cached = fodeReadIntegrationPreview_("CLASSROOM", p.previewId, actor);
  var preview = cached.preview;
  var receiptFingerprint = fodeAuthorityFingerprint_({
    operation: "CLASSROOM_HANDOFF",
    applicantId: preview.applicantId,
    fromState: preview.fromState,
    nextState: preview.nextState,
    evidenceReference: preview.evidenceReference,
    classroomReference: preview.classroomReference
  });
  var prior = fodeReadAuthorityReceipt_(preview.idempotencyKey, receiptFingerprint);
  if (prior) return prior;
  return fodeWithAuthorityLock_(function () {
    fodeRevalidateMutationActor_(actor, "CAN_MANAGE_CLASSROOM_HANDOFF");
    var replay = fodeReadAuthorityReceipt_(preview.idempotencyKey, receiptFingerprint);
    if (replay) return replay;
    var context = fodeExactApplicantRow_(preview.applicantId);
    var registry = resolveFodeRegistryAuthority_(context.rowObj, fodeReadAuthorityState_("REGISTRY", context.applicantId));
    var mappingRecord = fodeReadAuthorityState_("CLASSROOM_MAPPING", context.applicantId);
    var current = fodeClassroomReadinessProjection_(context, registry, fodeReadAuthorityState_("CLASSROOM_HANDOFF", context.applicantId), mappingRecord);
    if (fodeAuthorityFingerprint_(current) !== preview.sourceFingerprint) throw new Error("CLASSROOM_HANDOFF_AUTHORITY_CHANGED");
    var record = fodeWriteAuthorityState_("CLASSROOM_HANDOFF", context.applicantId, {
      state: preview.nextState,
      evidenceReference: preview.evidenceReference,
      classroomReference: preview.classroomReference,
      approvedBy: actor.email,
      approvedAt: new Date().toISOString(),
      externalWritePerformed: false
    }, "FODE_CLASSROOM_HANDOFF_STATE_CHANGED", actor);
    return fodeWriteAuthorityReceipt_(
      preview.idempotencyKey,
      receiptFingerprint,
      fodeClassroomReadinessProjection_(context, registry, record, mappingRecord)
    );
  });
}

function resolveFodeDeliveryState_(rowObj) {
  var row = rowObj || {};
  var bounce = /^(YES|TRUE|1|BOUNCED)$/.test(fodeAuthorityUpper_(row.Email_Bounce_Flag || row.Email_Status)) ||
    /PERMANENT FAILURE|TEMPORARY FAILURE|BOUNCED/.test(fodeAuthorityUpper_(row.Delivery_Health || row.Last_Delivery_Status));
  var reconciliation = /RECONCILIATION_REQUIRED/.test(fodeAuthorityUpper_(row.Last_Delivery_Status || row.Delivery_Health));
  var emailStatus = fodeAuthorityUpper_(row.Email_Status);
  var lastStatus = fodeAuthorityUpper_(row.Last_Delivery_Status);
  var state = "DELIVERY_UNKNOWN";
  if (reconciliation) state = "RECONCILIATION_REQUIRED";
  else if (bounce) state = "BOUNCED";
  else if (lastStatus === "GMAIL_ACCEPTED" || /GMAIL.*ACCEPT/.test(lastStatus)) state = "GMAIL_ACCEPTED";
  else if (emailStatus === "SENT" || lastStatus === "SENT") state = "SENT";
  return {
    applicantId: fodeAuthorityClean_(row.ApplicantID),
    state: state,
    sentAt: fodeAuthorityClean_(row.Email_Last_Sent_At || ""),
    lastStatusAt: fodeAuthorityClean_(row.Last_Bounce_Date || row.Email_Last_Sent_At || ""),
    bounceReason: state === "BOUNCED" ? fodeAuthorityClean_(row.Bounce_Reason || row.Email_Bounce_Reason || "") : "",
    reconciliationSource: fodeAuthorityClean_(row.Delivery_Reconciliation_Source || ""),
    claim: state === "GMAIL_ACCEPTED" ? "Gmail accepted the message; delivery is not proven." : (state === "SENT" ? "An authoritative send receipt exists; delivery is not proven." : "")
  };
}

function admin_getFodeDeliveryHistory(payload) {
  fodeAuthorityActor_("CAN_READ_DELIVERY_HISTORY");
  var snapshot = canonicalPopulationSnapshot_();
  var applicantId = fodeAuthorityClean_(payload && payload.applicantId || "");
  var rows = [];
  Object.keys(snapshot._internalSourceRowsByRowNumber || {}).forEach(function (rowNumber) {
    var rowObj = snapshot._internalSourceRowsByRowNumber[rowNumber];
    if (applicantId && fodeAuthorityClean_(rowObj.ApplicantID) !== applicantId) return;
    var projection = resolveFodeDeliveryState_(rowObj);
    if (projection.state !== "DELIVERY_UNKNOWN" || applicantId) rows.push(projection);
  });
  var counts = {};
  rows.forEach(function (row) { counts[row.state] = Number(counts[row.state] || 0) + 1; });
  var limit = Math.max(1, Math.min(200, Number(payload && payload.limit || 100)));
  return {
    ok: true,
    readOnly: true,
    schemaVersion: FODE_DELIVERY_HISTORY_SCHEMA_VERSION,
    authoritySource: "Authoritative communication receipts and reconciled bounce evidence",
    total: rows.length,
    counts: counts,
    rows: rows.slice(0, limit),
    automaticRetry: false
  };
}

function fodeCompletionAggregate_(rows, selector) {
  var out = {};
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    var key = fodeAuthorityUpper_(selector(row) || "UNKNOWN") || "UNKNOWN";
    out[key] = Number(out[key] || 0) + 1;
  });
  return out;
}

function admin_getFodeManagementSummary(payload) {
  fodeAuthorityActor_("CAN_READ_MANAGEMENT_REPORTS");
  var snapshot = canonicalPopulationSnapshot_();
  var registryIndex = fodeAuthorityStateIndex_("REGISTRY");
  var evidenceIndex = fodeAuthorityStateIndex_("ACADEMIC_EVIDENCE");
  var financeIndex = fodeAuthorityStateIndex_("FINANCE_HANDOFF");
  var classroomIndex = fodeAuthorityStateIndex_("CLASSROOM_HANDOFF");
  var mappingIndex = fodeAuthorityStateIndex_("CLASSROOM_MAPPING");
  var portalIndex = fodePortalStatusIndex_();
  var registryRows = [];
  var examRows = [];
  var portalRows = [];
  var classroomRows = [];
  var deliveryRows = [];
  Object.keys(snapshot._internalSourceRowsByRowNumber || {}).forEach(function (rowNumber) {
    var rowObj = snapshot._internalSourceRowsByRowNumber[rowNumber];
    var applicantId = fodeAuthorityClean_(rowObj.ApplicantID);
    var context = { applicantId: applicantId, rowNumber: Number(rowNumber), rowObj: rowObj, sheet: null };
    var registry = resolveFodeRegistryAuthority_(rowObj, registryIndex[applicantId] || null);
    var academicEvidence = evidenceIndex[applicantId] || null;
    registryRows.push(registry);
    examRows.push(resolveFodeExamEligibility_(
      registry,
      fodeAssessmentEvidenceFromRow_(rowObj, academicEvidence),
      fodeTimelineEvidenceFromRow_(rowObj, academicEvidence),
      fodeAttemptEvidenceFromRow_(rowObj, academicEvidence),
      new Date()
    ));
    portalRows.push(fodePortalStatusProjection_(rowObj, portalIndex[applicantId] || {}));
    classroomRows.push(fodeClassroomReadinessProjection_(context, registry, classroomIndex[applicantId] || null, mappingIndex[applicantId] || null));
    deliveryRows.push(resolveFodeDeliveryState_(rowObj));
  });
  return {
    ok: true,
    readOnly: true,
    schemaVersion: "FODE_MANAGEMENT_SUMMARY_V1",
    population: snapshot.totalRows,
    lifecycle: snapshot.summary.lifecycle,
    actionability: snapshot.summary.actionability,
    finance: snapshot.summary.finance,
    registry: fodeCompletionAggregate_(registryRows, function (row) { return row.state; }),
    examEligibility: fodeCompletionAggregate_(examRows, function (row) { return row.state; }),
    portal: fodeCompletionAggregate_(portalRows, function (row) { return row.accessState; }),
    classroom: fodeCompletionAggregate_(classroomRows, function (row) { return row.state; }),
    delivery: fodeCompletionAggregate_(deliveryRows, function (row) { return row.state; }),
    financeHandoffs: fodeCompletionAggregate_(Object.keys(financeIndex).map(function (key) { return financeIndex[key]; }), function (row) { return row.state; }),
    generatedAt: new Date().toISOString()
  };
}

function admin_getFodeAssignmentsAndApprovals(payload) {
  fodeAuthorityActor_("CAN_READ_MANAGEMENT_REPORTS");
  var snapshot = canonicalPopulationSnapshot_();
  var registryIndex = fodeAuthorityStateIndex_("REGISTRY");
  var evidenceIndex = fodeAuthorityStateIndex_("ACADEMIC_EVIDENCE");
  var financeIndex = fodeAuthorityStateIndex_("FINANCE_HANDOFF");
  var classroomIndex = fodeAuthorityStateIndex_("CLASSROOM_HANDOFF");
  var terminationIndex = fodeAuthorityStateIndex_("PORTAL_TERMINATION");
  var portalActionReconciliation = fodeDurableReceiptIndex_("PORTAL_ACTION").filter(function (record) {
    return ["PENDING", "RECONCILIATION_REQUIRED"].indexOf(fodeAuthorityUpper_(record.status)) >= 0;
  });
  var rows = [];
  Object.keys(snapshot._internalSourceRowsByRowNumber || {}).forEach(function (rowNumber) {
    var rowObj = snapshot._internalSourceRowsByRowNumber[rowNumber];
    var applicantId = fodeAuthorityClean_(rowObj.ApplicantID);
    var registry = resolveFodeRegistryAuthority_(rowObj, registryIndex[applicantId] || null);
    var context = { applicantId: applicantId, rowNumber: Number(rowNumber), rowObj: rowObj, sheet: null };
    if (registry.state === "CONFLICT") rows.push({ applicantId: applicantId, caseType: "REGISTRY_CONFLICT", state: "REVIEW_REQUIRED" });
    var academicEvidence = evidenceIndex[applicantId] || null;
    var exam = resolveFodeExamEligibility_(registry, fodeAssessmentEvidenceFromRow_(rowObj, academicEvidence), fodeTimelineEvidenceFromRow_(rowObj, academicEvidence), fodeAttemptEvidenceFromRow_(rowObj, academicEvidence), new Date());
    if (exam.state === "REVIEW_REQUIRED" || exam.state === "POLICY_REQUIRED") rows.push({ applicantId: applicantId, caseType: "EXAM_ELIGIBILITY", state: exam.state });
    var finance = fodeCanonicalFinanceForContext_(context);
    if (finance.exceptions.financeExceptionCode) rows.push({ applicantId: applicantId, caseType: "FINANCE_EXCEPTION", state: "REQUESTED" });
    if (financeIndex[applicantId] && ["REQUESTED", "UNDER_REVIEW", "APPROVED"].indexOf(fodeAuthorityUpper_(financeIndex[applicantId].state)) >= 0) rows.push({ applicantId: applicantId, caseType: "FINANCE_HANDOFF", state: fodeAuthorityUpper_(financeIndex[applicantId].state) });
    if (classroomIndex[applicantId] && fodeAuthorityUpper_(classroomIndex[applicantId].state) === "APPROVED_FOR_HANDOFF") rows.push({ applicantId: applicantId, caseType: "CLASSROOM_HANDOFF", state: "APPROVED_FOR_HANDOFF" });
    var terminationCase = terminationIndex[applicantId] || null;
    if (terminationCase && ["PENDING_FRAUD_CONFIRMATION", "PORTAL_ACCESS_TERMINATION_REQUIRED"].indexOf(fodeAuthorityUpper_(terminationCase.state)) >= 0) {
      rows.push({
        applicantId: applicantId,
        caseType: "PORTAL_ACCESS_TERMINATION",
        state: fodeAuthorityUpper_(terminationCase.state),
        portalAccessMutationPerformed: terminationCase.portalAccessMutationPerformed === true
      });
    } else if (registry.fraudStatus === "CONFIRMED") {
      rows.push({ applicantId: applicantId, caseType: "PORTAL_TERMINATION_CASE_MISSING", state: "RECONCILIATION_REQUIRED" });
    }
  });
  portalActionReconciliation.forEach(function (record) {
    rows.push({
      applicantId: fodeAuthorityClean_(record.applicantId || ""),
      caseType: "PORTAL_ACTION_RECONCILIATION",
      state: fodeAuthorityUpper_(record.status)
    });
  });
  var limit = Math.max(1, Math.min(200, Number(payload && payload.limit || 100)));
  return { ok: true, readOnly: true, schemaVersion: "FODE_ASSIGNMENTS_APPROVALS_V1", total: rows.length, rows: rows.slice(0, limit) };
}

function admin_getFodeDataQuality(payload) {
  fodeAuthorityActor_("CAN_READ_MANAGEMENT_REPORTS");
  var snapshot = canonicalPopulationSnapshot_();
  var registryIndex = fodeAuthorityStateIndex_("REGISTRY");
  var terminationIndex = fodeAuthorityStateIndex_("PORTAL_TERMINATION");
  var mappingIndex = fodeAuthorityStateIndex_("CLASSROOM_MAPPING");
  var portalActionReconciliation = fodeDurableReceiptIndex_("PORTAL_ACTION").filter(function (record) {
    return ["PENDING", "RECONCILIATION_REQUIRED"].indexOf(fodeAuthorityUpper_(record.status)) >= 0;
  });
  var portalIndex = fodePortalStatusIndex_();
  var rows = [];
  Object.keys(snapshot._internalSourceRowsByRowNumber || {}).forEach(function (rowNumber) {
    var rowObj = snapshot._internalSourceRowsByRowNumber[rowNumber];
    var applicantId = fodeAuthorityClean_(rowObj.ApplicantID);
    var context = { applicantId: applicantId, rowNumber: Number(rowNumber), rowObj: rowObj, sheet: null };
    var registry = resolveFodeRegistryAuthority_(rowObj, registryIndex[applicantId] || null);
    (registry.missingRequirements || []).forEach(function (code) { rows.push({ applicantId: applicantId, domain: "REGISTRY", code: code }); });
    (registry.conflicts || []).forEach(function (code) { rows.push({ applicantId: applicantId, domain: "REGISTRY", code: code }); });
    if (registry.fraudStatus === "CONFIRMED" && !terminationIndex[applicantId]) {
      rows.push({ applicantId: applicantId, domain: "PORTAL", code: "PORTAL_TERMINATION_CASE_MISSING" });
    }
    if (!portalIndex[applicantId] || portalIndex[applicantId].ok !== true) rows.push({ applicantId: applicantId, domain: "PORTAL", code: "PORTAL_AUTHORITY_GAP" });
    var delivery = resolveFodeDeliveryState_(rowObj);
    if (delivery.state === "RECONCILIATION_REQUIRED") rows.push({ applicantId: applicantId, domain: "DELIVERY", code: "DELIVERY_RECONCILIATION_REQUIRED" });
    var classroom = fodeClassroomReadinessProjection_(context, registry, null, mappingIndex[applicantId] || null);
    if (classroom.missingMappings.length) rows.push({ applicantId: applicantId, domain: "CLASSROOM", code: "CLASSROOM_MAPPING_GAP" });
    var finance = fodeCanonicalFinanceForContext_(context);
    if (typeof canonicalFinanceReconciliationForRow_ === "function") {
      var reconciliation = canonicalFinanceReconciliationForRow_(finance.dto, null);
      (reconciliation.codes || []).forEach(function (code) {
        if (fodeAuthorityUpper_(code) !== "FINANCE_CONSISTENT") rows.push({ applicantId: applicantId, domain: "FINANCE", code: fodeAuthorityClean_(code) });
      });
    } else if (finance.exceptions.financeExceptionCode) {
      rows.push({ applicantId: applicantId, domain: "FINANCE", code: finance.exceptions.financeExceptionCode });
    }
  });
  portalActionReconciliation.forEach(function (record) {
    rows.push({
      applicantId: fodeAuthorityClean_(record.applicantId || ""),
      domain: "PORTAL",
      code: "PORTAL_ACTION_" + fodeAuthorityUpper_(record.status)
    });
  });
  var limit = Math.max(1, Math.min(200, Number(payload && payload.limit || 100)));
  return { ok: true, readOnly: true, schemaVersion: "FODE_DATA_QUALITY_V1", total: rows.length, rows: rows.slice(0, limit) };
}

function admin_getFodeSystemHealth() {
  fodeAuthorityActor_("CAN_READ_MANAGEMENT_REPORTS");
  var zoho = typeof getZohoBooksCachedReadOnlyHealth_ === "function" ? getZohoBooksCachedReadOnlyHealth_() : { available: false, label: "Connection unavailable - reauthorization required" };
  var portal = {};
  try { portal = fodePortalStatusIndex_(); } catch (_portalHealthError) { portal = null; }
  var portalActionReconciliation = fodeDurableReceiptIndex_("PORTAL_ACTION").filter(function (record) {
    return ["PENDING", "RECONCILIATION_REQUIRED"].indexOf(fodeAuthorityUpper_(record.status)) >= 0;
  });
  return {
    ok: true,
    readOnly: true,
    schemaVersion: "FODE_SYSTEM_HEALTH_V1",
    externalRefreshPerformed: false,
    components: {
      zohoAuthentication: {
        state: zoho.available === true ? "CACHED_AVAILABLE" : "REAUTHORIZATION_REQUIRED",
        reason: fodeAuthorityClean_(zoho.label || zoho.reason || "Connection unavailable - reauthorization required")
      },
      financeProjection: { state: typeof resolveCanonicalFinance_ === "function" ? "AVAILABLE" : "UNAVAILABLE" },
      gmailDeliveryReconciliation: { state: typeof resolveFodeDeliveryState_ === "function" ? "AVAILABLE" : "UNAVAILABLE" },
      portalAuthority: {
        state: portal ? (portalActionReconciliation.length ? "RECONCILIATION_REQUIRED" : "AVAILABLE") : "UNAVAILABLE",
        indexedAuthorityRecords: portal ? Object.keys(portal).length : 0,
        actionReconciliationCases: portalActionReconciliation.length
      },
      classroomHandoff: { state: "READ_ONLY_HANDOFF_ONLY" },
      registry: { state: "AVAILABLE" },
      examPolicy: {
        state: "AVAILABLE",
        assessmentsPerSubject: 6,
        minimumScoreEach: 70,
        maximumAttempts: 4,
        attemptWindowYears: 2
      }
    }
  };
}

function admin_getFodeAuditProjection(payload) {
  fodeAuthorityActor_("CAN_READ_MANAGEMENT_REPORTS");
  var p = payload && typeof payload === "object" ? payload : {};
  var events = fodeRecentAuditEvents_([
    "TEMP_CAPABILITY_GRANT_CREATED",
    "TEMP_CAPABILITY_GRANT_REVOKED",
    "TEMP_CAPABILITY_GRANT_EXPIRED",
    "FODE_REGISTRY_CONFIRMED",
    "FODE_ACADEMIC_EVIDENCE_CONFIRMED",
    "FODE_PORTAL_TERMINATION_PENDING",
    "FODE_PORTAL_TERMINATION_REQUIRED",
    "FODE_FRAUD_CONFIRMATION_RECONCILED",
    "FODE_PORTAL_ACCESS_TERMINATED",
    "FODE_FINANCE_HANDOFF_STATE_CHANGED",
    "FODE_CLASSROOM_MAPPING_CONFIRMED",
    "FODE_CLASSROOM_HANDOFF_STATE_CHANGED",
    "FODE_PORTAL_ACCESS_EXECUTION_AUTHORIZED",
    "FODE_PORTAL_ACTION_RECEIPT_PENDING",
    "FODE_PORTAL_ACTION_RECEIPT_COMPLETED",
    "FODE_PORTAL_ACTION_RECEIPT_RECONCILIATION_REQUIRED",
    "FODE_PORTAL_ACCESS_CREATED",
    "FODE_PORTAL_ACCESS_ACTIVATED",
    "FODE_PORTAL_ACCESS_DEACTIVATED",
    "FODE_PORTAL_ACCESS_ROTATED"
  ], "", Math.max(1, Math.min(100, Number(p.limit || 50))));
  return {
    ok: true,
    readOnly: true,
    schemaVersion: "FODE_MANAGEMENT_AUDIT_PROJECTION_V1",
    total: events.length,
    events: events
  };
}
