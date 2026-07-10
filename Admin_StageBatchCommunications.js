function normalizeStageBatchStage_(stage) {
  var normalized = clean_(stage || "").toUpperCase();
  if (!normalized || normalized === "UNKNOWN") return "";
  return stageAggregationSortIndex_(normalized) < 99 ? normalized : "";
}

function getBatchMessageTypeForStage_(stage) {
  var normalized = normalizeStageBatchStage_(stage);
  if (!normalized) return "";
  return communicationRecommendedMessageTypeForStage_(normalized);
}

function isBatchSendableStage_(stage) {
  return !!getBatchMessageTypeForStage_(stage);
}

function clampStageBatchLimit_(rawLimit) {
  return batchPolicyClampStageLimit_(rawLimit);
}

function clampStageBatchOffset_(rawOffset) {
  var n = Math.floor(Number(rawOffset || 0));
  if (!(n >= 0)) return 0;
  return Math.max(0, n);
}

function stageBatchLimitMeta_(rawLimit) {
  var requested = Math.floor(Number(rawLimit || 0));
  var effective = clampStageBatchLimit_(rawLimit);
  var safeMax = Math.max(1, Number(CONFIG.MAX_STAGE_BATCH_SIZE || 30));
  var clamped = requested > safeMax;
  return {
    requested: requested,
    effective: effective,
    safeMax: safeMax,
    clamped: clamped,
    warning: clamped ? ("Batch size reduced to safe limit (" + safeMax + ") to prevent timeout") : ""
  };
}

function getStageBatchPreviewCacheKey_(adminEmail) {
  return batchPolicyPreviewCacheKey_("ADMIN_STAGE_BATCH_PREVIEW", adminEmail);
}

function readStageBatchPreviewCache_(adminEmail) {
  return batchPolicyReadPreviewCache_("ADMIN_STAGE_BATCH_PREVIEW", adminEmail);
}

function stageBatchPreviewCacheTtlSeconds_() {
  return batchPolicyPreviewCacheTtlSeconds_();
}

function writeStageBatchPreviewCache_(adminEmail, value) {
  batchPolicyWritePreviewCache_("ADMIN_STAGE_BATCH_PREVIEW", adminEmail, value, stageBatchPreviewCacheTtlSeconds_());
}

function clearStageBatchPreviewCache_(adminEmail) {
  batchPolicyClearPreviewCache_("ADMIN_STAGE_BATCH_PREVIEW", adminEmail);
}

function incrementStageBatchReason_(map, code) {
  var key = clean_(code || "BLOCKED").toUpperCase() || "BLOCKED";
  map[key] = Number(map[key] || 0) + 1;
}

function pushStageBatchSample_(list, applicantId) {
  var id = clean_(applicantId || "");
  if (!id) return;
  if (list.indexOf(id) >= 0) return;
  if (list.length < 10) list.push(id);
}

function stageBatchCandidateIds_(cohort) {
  var src = cohort && typeof cohort === "object" ? cohort : {};
  var candidates = Array.isArray(src.candidates) ? src.candidates : [];
  var out = [];
  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i] && typeof candidates[i] === "object" ? candidates[i] : {};
    var applicantId = clean_(candidate.applicantId || "");
    if (!applicantId) continue;
    out.push(applicantId);
  }
  return out;
}

function stageBatchCandidateHash_(candidateIds) {
  return batchPolicyCandidateHash_(candidateIds);
}

function stageBatchPreviewAgeSeconds_(writtenAt) {
  var raw = clean_(writtenAt || "");
  if (!raw) return -1;
  var parsed = new Date(raw).getTime();
  if (!(parsed > 0)) return -1;
  return Math.max(0, Math.floor((Date.now() - parsed) / 1000));
}

function stageBatchPreviewLog_(label, payload) {
  var data = payload && typeof payload === "object" ? payload : {};
  logOperationalBlock_(label, Object.assign({
    runtimeVersion: clean_(CONFIG.VERSION || ""),
    deployVersion: Number(CONFIG.DEPLOY_VERSION_NUMBER || 0)
  }, data));
}

function buildBatchPreviewIdempotencySummary_(cohort, messageType, batchId) {
  var candidates = Array.isArray(cohort && cohort.candidates) ? cohort.candidates : [];
  var alreadyProcessedCount = Number(cohort && cohort.alreadySentExcluded || 0);
  var replaySamples = [];
  candidates.forEach(function (candidate) {
    var ctx = {
      applicantId: clean_(candidate && candidate.applicantId || ""),
      messageType: clean_(messageType || ""),
      rowObj: candidate && candidate.rowObj ? candidate.rowObj : {},
      emailStatus: clean_(candidate && candidate.emailStatus || ""),
      batchLabel: ""
    };
    var key = typeof computeEmailIdempotencyKey_ === "function" ? computeEmailIdempotencyKey_(ctx, { batchLabel: "" }) : "";
    var replay = typeof wasEmailAlreadyProcessed_ === "function" ? wasEmailAlreadyProcessed_(ctx, key) : { alreadyProcessed: false };
    if (replay && replay.alreadyProcessed) {
      alreadyProcessedCount++;
      if (replaySamples.length < 10) replaySamples.push(ctx.applicantId);
    }
  });
  return {
    active: true,
    batchId: clean_(batchId || ""),
    candidateCount: candidates.length,
    alreadyProcessedCount: alreadyProcessedCount,
    replayBlockedCount: alreadyProcessedCount,
    replayApplicantIdsSample: replaySamples
  };
}

function stageBatchShouldExcludeFailedDefault_(rowObj, messageType) {
  // Production invite batches skip prior hard failures for the same message type until an explicit retry flow is used.
  var normalizedType = normalizeApplicantMessageType_(messageType || "");
  if (!normalizedType) return false;
  var row = rowObj || {};
  var status = clean_(row.Email_Status || "").toUpperCase();
  var flag = clean_(row.Email_Bounce_Flag || "").toUpperCase();
  var reason = clean_(row.Email_Bounce_Reason || "");
  var reasonLower = reason.toLowerCase();
  if (status === "FAILED") {
    if (["HARD", "DOMAIN", "UNKNOWN"].indexOf(flag) >= 0) return true;
    if (reasonLower.indexOf("missing required alias") >= 0) return true;
    if (flag === "TEMP") {
      var nextActionMs = typeof parseTime_ === "function" ? parseTime_(row.Email_Next_Action_Date || "") : 0;
      return !(nextActionMs > 0 && nextActionMs <= new Date().getTime());
    }
  }
  var communicationState = deriveCommunicationState_(row, normalizedType, {});
  return communicationState.durablePriorFailureSameType === true;
}

function stageBatchDurableGroupForStage_(stage, messageType) {
  var normalizedStage = normalizeStageBatchStage_(stage);
  var normalizedType = normalizeApplicantMessageType_(messageType || getBatchMessageTypeForStage_(normalizedStage) || "");
  if (!normalizedType) return "";
  if (normalizedType === "legacy_invite") return "legacy_invite";
  if (normalizedType !== "reminder") return "";
  switch (normalizedStage) {
    case "INVITED_AWAITING_RESPONSE":
    case "REMINDER_DUE":
      return "pre_response_reminder";
    case "DOCS_REQUIRED":
      return "docs_required_reminder";
    case "PAYMENT_REQUIRED":
      return "payment_required_reminder";
    case "RECEIPT_AWAITING_VERIFICATION":
      return "receipt_verification_reminder";
    default:
      return "";
  }
}

function stageBatchDurableGroupFromLastContactBatch_(rowObj) {
  var row = rowObj || {};
  var batchLabel = clean_(row.Last_Contact_Batch || "");
  if (!batchLabel) return "";
  var match = /^STAGE_SEND::([^:]+)::/.exec(batchLabel);
  if (!match || !match[1]) return "";
  var priorStage = normalizeStageBatchStage_(match[1] || "");
  if (!priorStage) return "";
  return stageBatchDurableGroupForStage_(priorStage, getBatchMessageTypeForStage_(priorStage));
}

function stageBatchShouldExcludePriorSuccessDefault_(rowObj, stage, messageType) {
  var normalizedType = normalizeApplicantMessageType_(messageType || "");
  if (!normalizedType) return false;
  var communicationState = deriveCommunicationState_(rowObj || {}, normalizedType, {});
  if (normalizedType === "legacy_invite") {
    return clean_(communicationState.base && communicationState.base.emailStatus || "") === "SENT";
  }
  if (normalizedType !== "reminder") return false;
  var currentGroup = stageBatchDurableGroupForStage_(stage, normalizedType);
  if (!currentGroup) return false;
  if (communicationState.lastContactMatchesScopedType !== true || communicationState.lastContactWasSent !== true) return false;
  var priorGroup = stageBatchDurableGroupFromLastContactBatch_(rowObj || {});
  if (!priorGroup) return false;
  return priorGroup === currentGroup;
}

function stageBatchCanonicalLifecycleDiagnostics_(rowObj, selectedLegacyStage, rowLegacyStage) {
  var legacyStage = clean_(rowLegacyStage || deriveApplicantLifecycleStage_(rowObj || {}) || "UNKNOWN").toUpperCase() || "UNKNOWN";
  var selectedStage = clean_(selectedLegacyStage || "").toUpperCase();
  var canonical = typeof resolveCanonicalApplicantLifecycle_ === "function"
    ? resolveCanonicalApplicantLifecycle_(rowObj || {}, {})
    : null;
  var mismatch = typeof compareLegacyCanonicalLifecycle_ === "function"
    ? compareLegacyCanonicalLifecycle_(legacyStage, canonical)
    : { hasLifecycleMismatch: false };
  return {
    selectedLegacyStage: selectedStage,
    rowLegacyStage: legacyStage,
    canonicalBaseState: clean_(canonical && (canonical.baseState || canonical.lifecycleStage) || "UNKNOWN").toUpperCase() || "UNKNOWN",
    canonicalOverlays: Array.isArray(canonical && canonical.overlays) ? canonical.overlays.slice() : [],
    canonicalRecommendedMessageType: clean_(canonical && canonical.recommendedMessageType || ""),
    hasLegacyCanonicalMismatch: mismatch && mismatch.hasLifecycleMismatch === true,
    mismatchReason: clean_(mismatch && mismatch.mismatchReason || "")
  };
}

function stageBatchCommunicationCohortLabel_(messageType) {
  var normalized = normalizeApplicantMessageType_(messageType || "");
  if (normalized === "docs_missing") return "Missing Documents Follow-Up";
  if (normalized === "payment_followup") return "Payment Follow-Up";
  if (normalized === "reminder") return "Reminder";
  if (normalized === "legacy_invite") return "Portal Invitation";
  return normalized || "Unclassified";
}

function stageBatchAuthoritativeMessageTypeForRow_(rowObj, selectedLegacyStage, rowLegacyStage, diagnosticsOpt) {
  var diagnostics = diagnosticsOpt && typeof diagnosticsOpt === "object" ? diagnosticsOpt : stageBatchCanonicalLifecycleDiagnostics_(rowObj || {}, selectedLegacyStage, rowLegacyStage);
  var canonicalType = normalizeApplicantMessageType_(diagnostics.canonicalRecommendedMessageType || "");
  if (canonicalType && typeof isCommunicationTypeBatchSafe_ === "function" && isCommunicationTypeBatchSafe_(canonicalType) === true) {
    return {
      messageType: canonicalType,
      authoritySource: "CANONICAL_LIFECYCLE"
    };
  }
  var legacyStage = clean_(rowLegacyStage || selectedLegacyStage || "").toUpperCase();
  var legacyType = normalizeApplicantMessageType_(getBatchMessageTypeForStage_(legacyStage) || "");
  return {
    messageType: legacyType,
    authoritySource: legacyType ? "LEGACY_STAGE_FALLBACK" : ""
  };
}

function stageBatchRecordCommunicationCohort_(map, authoritative) {
  var out = map && typeof map === "object" ? map : {};
  var info = authoritative && typeof authoritative === "object" ? authoritative : {};
  var messageType = normalizeApplicantMessageType_(info.messageType || "");
  if (!messageType) return out;
  if (!out[messageType]) {
    out[messageType] = {
      messageType: messageType,
      label: stageBatchCommunicationCohortLabel_(messageType),
      count: 0,
      authoritySource: clean_(info.authoritySource || "")
    };
  }
  out[messageType].count = Number(out[messageType].count || 0) + 1;
  return out;
}

function stageBatchCommunicationCohortsList_(map) {
  var src = map && typeof map === "object" ? map : {};
  return Object.keys(src).map(function (key) {
    var item = src[key] && typeof src[key] === "object" ? src[key] : {};
    return {
      messageType: normalizeApplicantMessageType_(item.messageType || key),
      label: clean_(item.label || stageBatchCommunicationCohortLabel_(key) || key),
      count: Number(item.count || 0),
      authoritySource: clean_(item.authoritySource || "")
    };
  }).filter(function (item) {
    return !!item.messageType;
  }).sort(function (a, b) {
    return String(a.label || "").localeCompare(String(b.label || ""));
  });
}

function stageBatchCanonicalDiagnosticsSummary_() {
  return {
    readOnly: true,
    selectionUnaffected: true,
    messageMappingUnaffected: true,
    selectedLegacyStage: "",
    rowsInspected: 0,
    mismatchCount: 0,
    samples: []
  };
}

function stageBatchRecordCanonicalDiagnostics_(summary, diagnostics) {
  var out = summary && typeof summary === "object" ? summary : stageBatchCanonicalDiagnosticsSummary_();
  var diag = diagnostics && typeof diagnostics === "object" ? diagnostics : {};
  out.selectedLegacyStage = clean_(out.selectedLegacyStage || diag.selectedLegacyStage || "");
  out.rowsInspected = Number(out.rowsInspected || 0) + 1;
  if (diag.hasLegacyCanonicalMismatch === true) out.mismatchCount = Number(out.mismatchCount || 0) + 1;
  if (out.samples.length < 10) {
    out.samples.push({
      selectedLegacyStage: clean_(diag.selectedLegacyStage || ""),
      rowLegacyStage: clean_(diag.rowLegacyStage || ""),
      canonicalBaseState: clean_(diag.canonicalBaseState || ""),
      canonicalOverlays: Array.isArray(diag.canonicalOverlays) ? diag.canonicalOverlays.slice() : [],
      canonicalRecommendedMessageType: clean_(diag.canonicalRecommendedMessageType || ""),
      hasLegacyCanonicalMismatch: diag.hasLegacyCanonicalMismatch === true,
      mismatchReason: clean_(diag.mismatchReason || "")
    });
  }
  return out;
}

function stageBatchLogSummary_(eventName, payload) {
  var tag = clean_(eventName || "STAGE_BATCH");
  var data = payload && typeof payload === "object" ? payload : {};
  try {
    if (typeof campaignLog_ === "function") {
      campaignLog_(tag, data);
    } else {
      Logger.log(tag + " " + JSON.stringify(data));
    }
  } catch (_logErr) {
    try {
      Logger.log(tag + " " + JSON.stringify(data));
    } catch (_logErr2) {}
  }
}

function stageBatchPreviewResponse_(data) {
  var src = data && typeof data === "object" ? data : {};
  var ok = src.ok === false ? false : true;
  var emptyReason = clean_(src.emptyReason || "");
  var message = clean_(src.message || "");
  var warning = clean_(src.warning || "");
  if (!message) {
    if (ok && emptyReason) message = emptyReason;
    else if (ok) message = "Preview ready.";
    else message = clean_(src.blockReason || src.error || "Preview failed.");
  }
  var phaseSrc = src.phaseTimings && typeof src.phaseTimings === "object" ? src.phaseTimings : {};
  var candidateIds = Array.isArray(src.candidateIds) ? src.candidateIds.map(function (id) {
    return clean_(id || "");
  }).filter(function (id) {
    return !!id;
  }) : [];
  return {
    ok: ok,
    action: "preview_stage_batch",
    result: ok ? (Number(src.count != null ? src.count : src.eligible || 0) > 0 ? "PREVIEW" : "EMPTY") : "ERROR",
    message: message,
    emptyReason: emptyReason,
    elapsedMs: Number(src.elapsedMs || 0),
    requestId: clean_(src.requestId || src.debugId || adminDebugId_()),
    debugId: clean_(src.debugId || src.requestId || adminDebugId_()),
    stage: clean_(src.stage || ""),
    messageType: clean_(src.messageType || ""),
    communicationCohorts: Array.isArray(src.communicationCohorts) ? src.communicationCohorts.map(function (cohort) {
      return {
        messageType: clean_(cohort && cohort.messageType || ""),
        label: clean_(cohort && cohort.label || ""),
        count: Number(cohort && cohort.count || 0),
        authoritySource: clean_(cohort && cohort.authoritySource || "")
      };
    }) : [],
    batchId: clean_(src.batchId || ""),
    count: Number(src.count != null ? src.count : src.eligible || 0),
    clientElapsedMs: Number(src.clientElapsedMs || 0),
    previewLimit: Number(src.previewLimit || src.limit || 0),
    limit: Number(src.limit || src.previewLimit || 0),
    requestedOffset: Number(src.requestedOffset || 0),
    offset: Number(src.offset || 0),
    offsetApplied: src.offsetApplied === true,
    offsetIgnored: src.offsetIgnored === true,
    offsetMode: clean_(src.offsetMode || "PRODUCTION_STATEFUL"),
    sendable: src.sendable === true,
    sendDisabledReason: clean_(src.sendDisabledReason || ""),
    writtenAt: clean_(src.writtenAt || ""),
    candidateIds: candidateIds,
    candidateCount: Number(src.candidateCount != null ? src.candidateCount : candidateIds.length),
    candidateHash: clean_(src.candidateHash || ""),
    firstScannedRow: Number(src.firstScannedRow || src.scanStartRow || 0),
    scanStartRow: Number(src.scanStartRow || 0),
    scanEndRow: Number(src.scanEndRow || 0),
    rowsScanned: Number(src.rowsScanned || src.scanned || 0),
    scanCap: Number(src.scanCap || 0),
    windowsScanned: Number(src.windowsScanned || 0),
    fallbackContinuationUsed: src.fallbackContinuationUsed === true,
    requestedLimit: Number(src.requestedLimit || src.previewLimit || src.limit || 0),
    partial: src.partial === true,
    partialReason: clean_(src.partialReason || ""),
    totalInStage: Number(src.totalInStage || 0),
    eligibleUnsentFound: Number(src.eligibleUnsentFound || 0),
    eligible: Number(src.eligible || src.count || 0),
    blocked: Number(src.blocked || 0),
    blockedCount: Number(src.blockedCount != null ? src.blockedCount : src.blocked || 0),
    alreadyProcessedCount: Number(src.alreadyProcessedCount || 0),
    idempotencySummary: src.idempotencySummary && typeof src.idempotencySummary === "object" ? src.idempotencySummary : {},
    propertyGuard: src.propertyGuard && typeof src.propertyGuard === "object" ? src.propertyGuard : {},
    alreadySentExcluded: Number(src.alreadySentExcluded || 0),
    failedExcluded: Number(src.failedExcluded || 0),
    blockedByReason: src.blockedByReason || {},
    canonicalLifecycleDiagnostics: src.canonicalLifecycleDiagnostics && typeof src.canonicalLifecycleDiagnostics === "object"
      ? JSON.parse(JSON.stringify(src.canonicalLifecycleDiagnostics))
      : stageBatchCanonicalDiagnosticsSummary_(),
    eligibleApplicantIdsSample: Array.isArray(src.eligibleApplicantIdsSample) ? src.eligibleApplicantIdsSample.slice(0, 10) : [],
    blockedApplicantIdsSample: Array.isArray(src.blockedApplicantIdsSample) ? src.blockedApplicantIdsSample.slice(0, 10) : [],
    warning: warning,
    warnings: Array.isArray(src.warnings) ? src.warnings.slice(0, 10).map(function (msg) { return clean_(msg || ""); }).filter(function (msg) { return !!msg; }) : (warning ? [warning] : []),
    processedCount: Number(src.processedCount || 0),
    remainingEligibleEstimate: Number(src.remainingEligibleEstimate || 0),
    priority: clean_(src.priority || ""),
    blockCode: clean_(src.blockCode || src.code || ""),
    blockReason: clean_(src.blockReason || src.error || ""),
    error: clean_(src.error || (!ok ? message : "")),
    phaseTimings: {
      candidateSelectionMs: Number(phaseSrc.candidateSelectionMs || 0),
      eligibilityFilteringMs: Number(phaseSrc.eligibilityFilteringMs || 0),
      rowHydrationMs: Number(phaseSrc.rowHydrationMs || 0),
      resolutionMs: Number(phaseSrc.resolutionMs || 0),
      payloadAssemblyMs: Number(phaseSrc.payloadAssemblyMs || 0)
    }
  };
}

function stageBatchPreviewFinalizeForRpc_(data) {
  var base = stageBatchPreviewResponse_(data);
  try {
    return JSON.parse(JSON.stringify(base));
  } catch (_err) {
    return stageBatchPreviewResponse_({
      ok: false,
      message: "Preview response serialization failed.",
      requestId: clean_(base.requestId || base.debugId || adminDebugId_()),
      debugId: clean_(base.debugId || base.requestId || adminDebugId_()),
      stage: clean_(base.stage || ""),
      messageType: clean_(base.messageType || ""),
      count: 0,
      elapsedMs: Number(base.elapsedMs || 0)
    });
  }
}

function stageBatchEmptyReason_(cohort) {
  var info = cohort && typeof cohort === "object" ? cohort : {};
  var totalInStage = Number(info.totalInStage || 0);
  var eligibleUnsentTotal = Number(info.eligibleUnsentTotal || 0);
  var alreadySentExcluded = Number(info.alreadySentExcluded || 0);
  var failedExcluded = Number(info.failedExcluded || 0);
  var blockedTotal = Number(info.blockedTotal || 0);
  var blockedByReason = info.blockedByReason || {};
  if (eligibleUnsentTotal > 0) return "";
  if (!clean_(info.messageType || "")) return "No batch message is supported for this stage.";
  if (totalInStage <= 0) return "No applicants are currently in this stage.";
  if (alreadySentExcluded >= totalInStage) return "Stage is populated, but all rows are already excluded by prior send state.";
  if (alreadySentExcluded + failedExcluded >= totalInStage && blockedTotal <= 0) {
    return "Stage is populated, but remaining rows are excluded by prior send state or automatic retry rules.";
  }
  var topReason = Object.keys(blockedByReason).sort(function(a, b) {
    return Number(blockedByReason[b] || 0) - Number(blockedByReason[a] || 0);
  })[0] || "";
  if (topReason) return "Stage is populated, but no send-eligible candidates remain under current rules. Primary block: " + topReason + ".";
  return "Stage is populated, but no send-eligible candidates remain under current rules.";
}

function getStageCursorKey_(stage, messageType) {
  return clean_(CONFIG.STAGE_CURSOR_PREFIX || "STAGE_CURSOR::") + clean_(stage || "") + "::" + clean_(messageType || "");
}

function getStageCursor_(stage, messageType) {
  var key = getStageCursorKey_(stage, messageType);
  var v = clean_(PropertiesService.getScriptProperties().getProperty(key) || "");
  var n = parseInt(v, 10);
  return n && n >= 2 ? n : 2;
}

function setStageCursor_(stage, messageType, row) {
  var key = getStageCursorKey_(stage, messageType);
  var n = parseInt(row, 10);
  PropertiesService.getScriptProperties().setProperty(key, String(n && n >= 2 ? n : 2));
}

function collectStageBatchCohort_(stage, limit, offset, opts) {
  var normalizedStage = normalizeStageBatchStage_(stage);
  var batchLimit = clampStageBatchLimit_(limit);
  var requestedOffset = clampStageBatchOffset_(offset);
  var options = opts && typeof opts === "object" ? opts : {};
  var requestedMessageType = normalizeApplicantMessageType_(options.messageType || "");
  var discoverOnly = options.discoverOnly === true;
  var messageType = requestedMessageType || (discoverOnly ? "" : normalizeApplicantMessageType_(getBatchMessageTypeForStage_(normalizedStage) || ""));
  var actorEmail = clean_(options.actorEmail || "");
  var actorRole = clean_(options.actorRole || "");
  var debugId = clean_(options.debugId || newDebugId_());
  var requestId = clean_(options.requestId || debugId || newDebugId_());
  var inviteStatefulFlow = normalizedStage === "INVITE_PENDING" || messageType === "legacy_invite";
  var phaseTimings = options.phaseTimings && typeof options.phaseTimings === "object" ? options.phaseTimings : {};
  phaseTimings.candidateSelectionMs = Number(phaseTimings.candidateSelectionMs || 0);
  phaseTimings.eligibilityFilteringMs = Number(phaseTimings.eligibilityFilteringMs || 0);
  phaseTimings.rowHydrationMs = Number(phaseTimings.rowHydrationMs || 0);
  phaseTimings.resolutionMs = Number(phaseTimings.resolutionMs || 0);
  phaseTimings.payloadAssemblyMs = Number(phaseTimings.payloadAssemblyMs || 0);
  var sh = openDataSheet_();
  var values = sh.getDataRange().getValues();
  var headers = (values && values.length) ? values[0] : [];
  var totalInStage = 0;
  var eligibleUnsentTotal = 0;
  var alreadySentExcluded = 0;
  var failedExcluded = 0;
  var blockedTotal = 0;
  var blockedByReason = {};
  var blockedApplicantIdsSample = [];
  var candidates = [];
  var communicationCohortMap = {};
  var canonicalLifecycleDiagnostics = stageBatchCanonicalDiagnosticsSummary_();
  canonicalLifecycleDiagnostics.selectedLegacyStage = normalizedStage;
  var startedAtMs = new Date().getTime();
  var portalSecretLookup = options.portalSecretLookup && typeof options.portalSecretLookup === "object" ? options.portalSecretLookup : null;
  var cooldownLookup = options.cooldownLookup && typeof options.cooldownLookup === "object" ? options.cooldownLookup : null;
  var previewEarlyStop = options.previewEarlyStop === true;
  var previewEligibleBuffer = Math.max(0, Math.min(10, Math.floor(Number(options.previewEligibleBuffer || 2))));
  var previewEligibleTarget = previewEarlyStop ? Math.max(batchLimit, batchLimit + previewEligibleBuffer) : 0;
  var deterministicPreview = options.deterministicPreview === true;
  var eligibleCountBounded = false;
  var lastRow = values.length;
  var savedCursor = Math.max(2, getStageCursor_(normalizedStage, messageType));
  var cursor = savedCursor > lastRow ? 2 : savedCursor;
  var nextCursor = cursor;
  var scanned = 0;
  var scanStartRow = cursor;
  var scanEndRow = 0;
  var previewScanCap = deterministicPreview ? Math.max(1, Math.floor(Number(CONFIG.BATCH_PREVIEW_SCAN_ROW_CAP || 500))) : 0;
  var windowsScanned = 0;
  var fallbackContinuationUsed = false;
  var scanStoppedBySafetyCap = false;
  var scanWrapped = false;
  var maxRowsToScan = deterministicPreview ? Math.max(0, lastRow - 1) : 0;
  var rowsVisited = 0;
  var timeBudgetMs = Math.max(1, Number(CONFIG.SCAN_TIME_BUDGET_MS || 240000));
  var scanStoppedByTimeBudget = false;
  var scanStoppedByCap = false;
  if (!headers.length || values.length < 2 || !normalizedStage) {
    var emptyCohort = {
      stage: normalizedStage,
      messageType: messageType,
      requestId: requestId,
      limit: batchLimit,
      requestedOffset: requestedOffset,
      offset: 0,
      offsetApplied: false,
      offsetIgnored: requestedOffset > 0,
      offsetMode: "PRODUCTION_STATEFUL",
      totalInStage: 0,
      eligibleUnsentTotal: 0,
      alreadySentExcluded: 0,
      failedExcluded: 0,
      blockedTotal: 0,
      blockedByReason: {},
      blockedApplicantIdsSample: [],
      candidates: [],
      canonicalLifecycleDiagnostics: canonicalLifecycleDiagnostics,
      elapsedMs: new Date().getTime() - startedAtMs,
      phaseTimings: phaseTimings
    };
    emptyCohort.emptyReason = stageBatchEmptyReason_(emptyCohort);
    return emptyCohort;
  }
  var windowStartIndex = cursor - 1;
  while (windowStartIndex >= 1 && windowStartIndex < values.length) {
    windowsScanned++;
    if (windowsScanned > 1) fallbackContinuationUsed = true;
    var windowRowsScanned = 0;
    var windowEndIndex = scanWrapped ? Math.min(values.length, cursor - 1) : values.length;
    var r = windowStartIndex;
    for (; r < windowEndIndex; r++) {
      if (deterministicPreview && previewScanCap > 0 && windowRowsScanned >= previewScanCap) {
        scanStoppedByCap = true;
        break;
      }
      if (deterministicPreview && rowsVisited >= maxRowsToScan) {
        scanStoppedBySafetyCap = true;
        break;
      }
      if (new Date().getTime() - startedAtMs > timeBudgetMs) {
        scanStoppedByTimeBudget = true;
        Logger.log("AUTO_STAGE_RUN_TIMEOUT_NEAR");
        break;
      }
      var hydrateStartedAtMs = new Date().getTime();
      var row = values[r] || [];
      var rowObj = {};
      for (var c = 0; c < headers.length; c++) {
        var h = clean_(headers[c]);
        if (h) rowObj[h] = row[c];
      }
      phaseTimings.rowHydrationMs += new Date().getTime() - hydrateStartedAtMs;
      scanned++;
      rowsVisited++;
      windowRowsScanned++;
      scanEndRow = r + 1;
      nextCursor = r + 2;
      var applicantId = clean_(rowObj.ApplicantID || "");
      if (!applicantId) continue;
      var candidateStartedAtMs = new Date().getTime();
      var snapshot = stageAggregationSnapshot_(rowObj);
      phaseTimings.candidateSelectionMs += new Date().getTime() - candidateStartedAtMs;
      var rowDiagnostics = stageBatchCanonicalLifecycleDiagnostics_(rowObj, normalizedStage, snapshot.stage);
      canonicalLifecycleDiagnostics = stageBatchRecordCanonicalDiagnostics_(
        canonicalLifecycleDiagnostics,
        rowDiagnostics
      );
      if (clean_(snapshot.stage || "").toUpperCase() !== normalizedStage) continue;
      totalInStage++;
      var authoritative = stageBatchAuthoritativeMessageTypeForRow_(rowObj, normalizedStage, snapshot.stage, rowDiagnostics);
      stageBatchRecordCommunicationCohort_(communicationCohortMap, authoritative);
      var filterStartedAtMs = new Date().getTime();
      if (!messageType) {
        phaseTimings.eligibilityFilteringMs += new Date().getTime() - filterStartedAtMs;
        continue;
      }
      if (!authoritative.messageType || authoritative.messageType !== messageType) {
        phaseTimings.eligibilityFilteringMs += new Date().getTime() - filterStartedAtMs;
        continue;
      }
      if (stageBatchShouldExcludePriorSuccessDefault_(rowObj, normalizedStage, messageType)) {
        alreadySentExcluded++;
        phaseTimings.eligibilityFilteringMs += new Date().getTime() - filterStartedAtMs;
        continue;
      }
      if (inviteStatefulFlow && stageBatchShouldExcludeFailedDefault_(rowObj, messageType)) {
        failedExcluded++;
        phaseTimings.eligibilityFilteringMs += new Date().getTime() - filterStartedAtMs;
        continue;
      }
      phaseTimings.eligibilityFilteringMs += new Date().getTime() - filterStartedAtMs;
      var resolved = resolveApplicantMessageContextFromRow_(rowObj, r + 1, sh, messageType, {
        action: "stageBatchCollect",
        actorEmail: actorEmail,
        actorRole: actorRole,
        debugId: debugId,
        applicantId: applicantId,
        requestId: requestId,
        previewMetrics: phaseTimings,
        portalSecretLookup: portalSecretLookup,
        cooldownLookup: cooldownLookup,
        skipPortalUrlBuild: !!portalSecretLookup
      });
      if (resolved && resolved.eligible) {
        eligibleUnsentTotal++;
        if (candidates.length < batchLimit) {
          candidates.push({
            applicantId: applicantId,
            rowNumber: Number(resolved.rowNumber || (r + 1) || 0),
            effectiveEmail: clean_(resolved.effectiveEmail || ""),
            rowObj: rowObj,
            emailStatus: clean_(rowObj.Email_Status || "")
          });
        }
        if (candidates.length >= batchLimit || (previewEligibleTarget > 0 && eligibleUnsentTotal >= previewEligibleTarget)) {
          eligibleCountBounded = true;
          nextCursor = r + 2;
          break;
        }
        continue;
      }
      blockedTotal++;
      var blockedCode = clean_(resolved && (resolved.blockCode || resolved.code || "BLOCKED"));
      var blockedReason = clean_(resolved && (resolved.blockReason || resolved.message || resolved.error || blockedCode));
      incrementStageBatchReason_(blockedByReason, blockedCode);
      pushStageBatchSample_(blockedApplicantIdsSample, applicantId);
    }
    if (!deterministicPreview) break;
    if (candidates.length > 0 || scanStoppedByTimeBudget || scanStoppedBySafetyCap) break;
    if (r < windowEndIndex) {
      windowStartIndex = r;
      continue;
    }
    if (!scanWrapped && cursor > 2) {
      scanWrapped = true;
      windowStartIndex = 1;
      continue;
    }
    break;
  }
  if (nextCursor > lastRow) nextCursor = 2;
  if (!deterministicPreview) {
    setStageCursor_(normalizedStage, messageType, nextCursor);
    Logger.log("AUTO_STAGE_CURSOR_UPDATE " + JSON.stringify({
      stage: normalizedStage,
      messageType: messageType,
      nextCursor: nextCursor,
      scanned: scanned,
      found: candidates.length,
      timeBudgetMs: timeBudgetMs,
      scanStoppedByTimeBudget: scanStoppedByTimeBudget,
      scanStoppedByCap: scanStoppedByCap,
      windowsScanned: windowsScanned,
      fallbackContinuationUsed: fallbackContinuationUsed
    }));
  }
  var partial = deterministicPreview && candidates.length < batchLimit && (scanStoppedByCap || scanStoppedBySafetyCap || scanStoppedByTimeBudget || nextCursor > lastRow || candidates.length > 0);
  var partialReason = "";
  if (partial) {
    if (scanStoppedByTimeBudget) partialReason = "PREVIEW_TIME_BUDGET_EXHAUSTED";
    else if (scanStoppedBySafetyCap) partialReason = "PREVIEW_SAFETY_CAP_REACHED";
    else if (candidates.length > 0) partialReason = "PREVIEW_CANDIDATES_FOUND_BELOW_LIMIT";
    else partialReason = "PREVIEW_WINDOW_EXHAUSTED";
  }
  var cohort = {
    stage: normalizedStage,
    messageType: messageType,
    requestId: requestId,
    limit: batchLimit,
    requestedOffset: requestedOffset,
    offset: 0,
    offsetApplied: false,
    offsetIgnored: requestedOffset > 0,
    offsetMode: "PRODUCTION_STATEFUL",
    totalInStage: totalInStage,
    eligibleUnsentTotal: eligibleUnsentTotal,
    alreadySentExcluded: alreadySentExcluded,
    failedExcluded: failedExcluded,
    blockedTotal: blockedTotal,
    blockedByReason: blockedByReason,
    blockedApplicantIdsSample: blockedApplicantIdsSample,
    candidates: candidates,
    communicationCohorts: stageBatchCommunicationCohortsList_(communicationCohortMap),
    eligibleCountBounded: eligibleCountBounded,
    scanCursor: cursor,
    firstScannedRow: scanStartRow,
    scanStartRow: scanStartRow,
    scanEndRow: scanEndRow,
    rowsScanned: scanned,
    scanCap: previewScanCap,
    windowsScanned: windowsScanned,
    fallbackContinuationUsed: fallbackContinuationUsed,
    nextCursor: nextCursor,
    scanned: scanned,
    scanStoppedByTimeBudget: scanStoppedByTimeBudget,
    scanStoppedByCap: scanStoppedByCap,
    scanStoppedBySafetyCap: scanStoppedBySafetyCap,
    partial: partial,
    partialReason: partialReason,
    canonicalLifecycleDiagnostics: canonicalLifecycleDiagnostics,
    elapsedMs: new Date().getTime() - startedAtMs,
    phaseTimings: phaseTimings
  };
  cohort.emptyReason = stageBatchEmptyReason_(cohort);
  return cohort;
}

function admin_previewStageBatch(payload) {
  return withEnvelope_("admin_previewStageBatch", function (dbgId) {
    var startedAtMs = new Date().getTime();
    var requestId = clean_(dbgId || newDebugId_());
    var stage = "";
    var messageType = "";
    var limit = 0;
    var requestedOffset = 0;
    var phaseTimings = {
      candidateSelectionMs: 0,
      eligibilityFilteringMs: 0,
      rowHydrationMs: 0,
      resolutionMs: 0,
      payloadAssemblyMs: 0
    };
    try {
      var adminEmail = getCallerEmail_();
      if (!isAdmin_(adminEmail)) throw new Error("Access denied");
      requireOperationsAdmin_(adminEmail);
      var p = payload && typeof payload === "object" ? payload : {};
      var propertyGuard = buildScriptPropertyRegressionGuard_();
      var propertyGuardWarning = "";
      var propertyGuardWarningText = "";
      if (!propertyGuard.ok) {
        if (propertyGuard.warning === "SCRIPT_PROPERTY_COUNT_GREW") {
          propertyGuardWarning = propertyGuard.warning;
          propertyGuardWarningText = "Script property count is above the cleanup baseline; batch preview is allowed, but property cleanup review is recommended.";
        } else {
        stageBatchPreviewLog_("MANUAL_BATCH_PREVIEW_BLOCKED", {
          batchId: "",
          stage: clean_(p.stage || ""),
          candidateCount: 0,
          limit: Number(p.limit || 0),
          replaySummary: {},
          blockCode: propertyGuard.warning,
          propertyGuard: propertyGuard
        });
        return stageBatchPreviewFinalizeForRpc_(stageBatchPreviewResponse_({
          ok: false,
          message: "Batch preview blocked by property regression guard.",
          blockCode: propertyGuard.warning,
          blockReason: propertyGuard.warning,
          requestId: requestId,
          debugId: dbgId,
          stage: clean_(p.stage || ""),
          count: 0,
          previewLimit: Number(p.limit || 0),
          propertyGuard: propertyGuard
        }));
        }
      }
      if (isBatchPreviewModeEnabled_() !== true) {
        stageBatchPreviewLog_("MANUAL_BATCH_PREVIEW_BLOCKED", {
          batchId: "",
          stage: clean_(p.stage || ""),
          candidateCount: 0,
          limit: Number(p.limit || 0),
          replaySummary: {},
          blockCode: "BATCH_PREVIEW_MODE_DISABLED"
        });
        return stageBatchPreviewFinalizeForRpc_(stageBatchPreviewResponse_({
          ok: false,
          message: "Batch preview mode is disabled.",
          blockCode: "BATCH_PREVIEW_MODE_DISABLED",
          blockReason: "Batch preview mode is disabled.",
          requestId: requestId,
          debugId: dbgId,
          stage: clean_(p.stage || ""),
          count: 0,
          previewLimit: Number(p.limit || 0)
        }));
      }
      var actor = resolveAdminCommActor_(p);
      stage = normalizeStageBatchStage_(p.stage || "");
      var discoverOnly = p.discoverOnly === true;
      var limitMeta = stageBatchLimitMeta_(p.limit);
      limit = limitMeta.effective;
      requestedOffset = clampStageBatchOffset_(p.offset);
      messageType = normalizeApplicantMessageType_(p.messageType || "") || (discoverOnly ? "" : getBatchMessageTypeForStage_(stage));
      stageBatchPreviewLog_("MANUAL_BATCH_PREVIEW_BEGIN", {
        batchId: "",
        stage: stage,
        candidateCount: 0,
        limit: limit,
        replaySummary: {}
      });
      if (!stage) {
        var invalidOut = stageBatchPreviewResponse_({
          ok: false,
          message: "Unsupported stage for batch preview.",
          requestId: requestId,
          debugId: dbgId,
          stage: stage,
          messageType: messageType,
          count: 0,
          previewLimit: limit,
          requestedOffset: requestedOffset,
          offsetIgnored: requestedOffset > 0,
          elapsedMs: new Date().getTime() - startedAtMs,
          phaseTimings: phaseTimings
        });
        return typeof previewRpcTerminalSummary_ === "function" ? previewRpcTerminalSummary_(stageBatchPreviewFinalizeForRpc_(invalidOut)) : stageBatchPreviewFinalizeForRpc_(invalidOut);
      }
      var sendable = !!messageType;
      var priority = mapStagePriority_(stage);
      var previewPortalSecretLookup = null;
      if (sendable && typeof communicationRequiresPortalUrl_ === "function" && communicationRequiresPortalUrl_(messageType) && typeof buildPortalSecretPreviewLookup_ === "function") {
        previewPortalSecretLookup = buildPortalSecretPreviewLookup_();
      }
      var previewCooldownLookup = null;
      if (sendable && typeof buildCommunicationCooldownPreviewLookup_ === "function") {
        previewCooldownLookup = buildCommunicationCooldownPreviewLookup_(messageType);
      }
      var cohort = collectStageBatchCohort_(stage, limit, requestedOffset, {
        messageType: messageType,
        actorEmail: actor.actorEmail,
        actorRole: actor.actorRole,
        debugId: dbgId,
        requestId: requestId,
        phaseTimings: phaseTimings,
        portalSecretLookup: previewPortalSecretLookup && previewPortalSecretLookup.ok ? previewPortalSecretLookup : null,
        cooldownLookup: previewCooldownLookup && previewCooldownLookup.ok ? previewCooldownLookup : null,
        discoverOnly: discoverOnly,
        previewEarlyStop: true,
        previewEligibleBuffer: 2,
        deterministicPreview: true
      });
      var candidateIds = stageBatchCandidateIds_(cohort);
      var candidateCount = candidateIds.length;
      var candidateHash = stageBatchCandidateHash_(candidateIds);
      var batchId = ["BATCH_PREVIEW", stage, messageType, String(limit), candidateHash].join("::");
      var idempotencySummary = buildBatchPreviewIdempotencySummary_(cohort, messageType, batchId);
      var writtenAt = new Date().toISOString();
      var assemblyStartedAtMs = new Date().getTime();
      var emptyReason = clean_(cohort.emptyReason || "");
      var previewWarnings = [];
      if (limitMeta.warning) previewWarnings.push(limitMeta.warning);
      if (propertyGuardWarningText) previewWarnings.push(propertyGuardWarningText);
      var out = stageBatchPreviewResponse_({
        ok: true,
        message: emptyReason || (previewWarnings.length ? ("Preview ready. " + previewWarnings.join(" ")) : "Preview ready."),
        warning: previewWarnings.length ? previewWarnings[0] : "",
        warnings: previewWarnings,
        stage: stage,
        priority: priority,
        batchId: batchId,
        requestId: requestId,
        debugId: dbgId,
        messageType: messageType,
        communicationCohorts: cohort.communicationCohorts || [],
        sendable: sendable,
        sendDisabledReason: sendable ? "" : "No batch message is supported for this stage.",
        totalInStage: Number(cohort.totalInStage || 0),
        eligibleUnsentFound: Number(cohort.eligibleUnsentTotal || 0),
        previewLimit: Number(cohort.limit || limit),
        processedCount: 0,
        remainingEligibleEstimate: Math.max(0, Number(cohort.eligibleUnsentTotal || 0) - Number((cohort.candidates || []).length || 0)),
        requestedOffset: requestedOffset,
        offset: Number(cohort.offset || 0),
        offsetApplied: cohort.offsetApplied === true,
        offsetIgnored: cohort.offsetIgnored === true,
        offsetMode: clean_(cohort.offsetMode || "PRODUCTION_STATEFUL"),
        writtenAt: writtenAt,
        candidateIds: candidateIds,
        candidateCount: candidateCount,
        candidateHash: candidateHash,
        firstScannedRow: Number(cohort.firstScannedRow || cohort.scanStartRow || 0),
        scanStartRow: Number(cohort.scanStartRow || 0),
        scanEndRow: Number(cohort.scanEndRow || 0),
        rowsScanned: Number(cohort.rowsScanned || cohort.scanned || 0),
        scanCap: Number(cohort.scanCap || 0),
        windowsScanned: Number(cohort.windowsScanned || 0),
        fallbackContinuationUsed: cohort.fallbackContinuationUsed === true,
        requestedLimit: limit,
        partial: cohort.partial === true,
        partialReason: clean_(cohort.partialReason || ""),
        limit: Number(cohort.limit || limit),
        idempotencySummary: idempotencySummary,
        alreadyProcessedCount: Number(idempotencySummary.alreadyProcessedCount || 0),
        count: Number((cohort.candidates || []).length || 0),
        eligible: Number((cohort.candidates || []).length || 0),
        blocked: Number(cohort.blockedTotal || 0),
        alreadySentExcluded: Number(cohort.alreadySentExcluded || 0),
        failedExcluded: Number(cohort.failedExcluded || 0),
        blockedByReason: cohort.blockedByReason || {},
        eligibleApplicantIdsSample: [],
        blockedApplicantIdsSample: Array.isArray(cohort.blockedApplicantIdsSample) ? cohort.blockedApplicantIdsSample.slice(0, 10) : [],
        canonicalLifecycleDiagnostics: cohort.canonicalLifecycleDiagnostics || stageBatchCanonicalDiagnosticsSummary_(),
        propertyGuard: propertyGuard,
        emptyReason: emptyReason,
        eligibleCountBounded: cohort.eligibleCountBounded === true,
        elapsedMs: Number(cohort.elapsedMs || 0),
        phaseTimings: cohort.phaseTimings || phaseTimings
      });
      (cohort.candidates || []).forEach(function (candidate) {
        pushStageBatchSample_(out.eligibleApplicantIdsSample, candidate.applicantId);
      });
      phaseTimings.payloadAssemblyMs += new Date().getTime() - assemblyStartedAtMs;
      if (!sendable || out.count <= 0) {
        clearStageBatchPreviewCache_(adminEmail);
      } else if (!discoverOnly) {
        writeStageBatchPreviewCache_(adminEmail, {
          stage: stage,
          limit: Number(out.previewLimit || limit),
          offset: requestedOffset,
          messageType: messageType,
          eligible: Number(out.count || 0),
          eligibleUnsentFound: Number(out.eligibleUnsentFound || 0),
          debugId: dbgId,
          requestId: requestId,
          writtenAt: writtenAt,
          candidateIds: candidateIds,
          candidateCount: candidateCount,
          candidateHash: candidateHash,
          batchId: batchId,
          idempotencySummary: idempotencySummary
        });
      }
      out.elapsedMs = Math.max(Number(out.elapsedMs || 0), new Date().getTime() - startedAtMs);
      out.phaseTimings = phaseTimings;
      out.message = discoverOnly
        ? (out.communicationCohorts.length
          ? "Communication cohorts discovered for the selected stage."
          : "No communication cohorts are available for the selected stage.")
        : out.count > 0
        ? (cohort.partial === true && clean_(cohort.partialReason || "") === "PREVIEW_CANDIDATES_FOUND_BELOW_LIMIT"
          ? "Partial preview ready. Candidates found below requested limit."
          : (cohort.partial === true
          ? "Partial preview ready. Scan window exhausted before requested limit."
          : (cohort.eligibleCountBounded === true
          ? "Preview ready. Eligible unsent count shown is bounded to the preview window, not a full-stage total."
          : "Preview ready.")))
        : (out.emptyReason || "No eligible unsent invite candidates found under current rules.");
      stageBatchPreviewLog_("MANUAL_BATCH_PREVIEW_RESULT", {
        batchId: batchId,
        stage: stage,
        candidateCount: candidateCount,
        limit: limit,
        replaySummary: idempotencySummary,
        blockedCount: Number(out.blocked || 0),
        alreadyProcessedCount: Number(idempotencySummary.alreadyProcessedCount || 0),
        firstScannedRow: Number(out.firstScannedRow || out.scanStartRow || 0),
        rowsScanned: Number(out.rowsScanned || 0),
        scanStartRow: Number(out.scanStartRow || 0),
        scanEndRow: Number(out.scanEndRow || 0),
        windowsScanned: Number(out.windowsScanned || 0),
        fallbackContinuationUsed: out.fallbackContinuationUsed === true,
        partial: out.partial === true,
        partialReason: clean_(out.partialReason || "")
      });
      if (Number(idempotencySummary.alreadyProcessedCount || 0) > 0) {
        stageBatchPreviewLog_("MANUAL_BATCH_PREVIEW_REPLAY", {
          batchId: batchId,
          stage: stage,
          candidateCount: candidateCount,
          limit: limit,
          replaySummary: idempotencySummary
        });
      }
      return typeof previewRpcTerminalSummary_ === "function" ? previewRpcTerminalSummary_(stageBatchPreviewFinalizeForRpc_(out)) : stageBatchPreviewFinalizeForRpc_(out);
    } catch (e) {
      var errorOut = stageBatchPreviewResponse_({
        ok: false,
        message: String(e && e.message ? e.message : e || "Preview failed."),
        requestId: requestId,
        debugId: dbgId,
        stage: stage,
        messageType: messageType,
        count: 0,
        previewLimit: limit,
        requestedOffset: requestedOffset,
        offsetIgnored: requestedOffset > 0,
        elapsedMs: new Date().getTime() - startedAtMs,
        phaseTimings: phaseTimings,
        blockCode: "PREVIEW_BACKEND_ERROR",
        blockReason: "PREVIEW_BACKEND_ERROR",
        error: String(e && e.message ? e.message : e || "Preview failed.")
      });
      return typeof previewRpcTerminalSummary_ === "function" ? previewRpcTerminalSummary_(stageBatchPreviewFinalizeForRpc_(errorOut)) : stageBatchPreviewFinalizeForRpc_(errorOut);
    }
  });
}

function admin_sendStageBatch(payload) {
  return withEnvelope_("admin_sendStageBatch", function (dbgId) {
    var requestId = clean_(dbgId || newDebugId_());
    var adminEmail = getCallerEmail_();
    var stage = "";
    var messageType = "";
    var stageBatchSendLock = null;
    try {
      if (!isAdmin_(adminEmail)) throw new Error("Access denied");
      requireOperationsAdmin_(adminEmail);
      stageBatchSendLock = LockService.getUserLock();
      if (!stageBatchSendLock.tryLock(30000)) {
        return adminCommBlockedResult_("send_stage_batch", "BATCH_SEND_IN_PROGRESS", requestId, {
          blockReason: "A stage batch send is already in progress for this operator. Wait for it to finish before retrying."
        });
      }
      var p = payload && typeof payload === "object" ? payload : {};
      if (isBatchSendEnabled_() !== true) {
        var blockCode = "BATCH_SENDS_DISABLED_PREVIEW_ONLY_MODE";
        if (isSystemStabilizationModeActive_()) logOperationalBlock_("SYSTEM_STABILIZATION_MODE_ACTIVE", {
          action: "send_stage_batch",
          requestId: requestId,
          actorEmail: clean_(adminEmail || "")
        });
        logOperationalBlock_("EMAIL_SEND_BLOCKED", {
          action: "send_stage_batch",
          blockCode: blockCode,
          requestId: requestId,
          actorEmail: clean_(adminEmail || "")
        });
        return adminCommBlockedResult_("send_stage_batch", blockCode, requestId, {
          blockReason: "Batch sends are disabled in preview-only mode."
        });
      }
      var actor = resolveAdminCommActor_(p);
      stage = normalizeStageBatchStage_(p.stage || "");
      var limitMeta = stageBatchLimitMeta_(p.limit);
      var limit = limitMeta.effective;
      var requestedOffset = clampStageBatchOffset_(p.offset);
      var previewRequestId = clean_(p.previewRequestId || "");
      var requestCandidateHash = clean_(p.candidateHash || "");
      if (p.confirmSend !== true) {
        return adminCommBlockedResult_("send_stage_batch", "CONFIRM_REQUIRED", requestId, {
          blockReason: "Explicit confirmation is required before batch send.",
          limit: limit,
          offset: requestedOffset
        });
      }
      if (!stage) {
        return adminCommBlockedResult_("send_stage_batch", "UNSUPPORTED_STAGE", requestId, {
          blockReason: "Unsupported stage for batch send.",
          limit: limit,
          offset: requestedOffset
        });
      }
      messageType = normalizeApplicantMessageType_(p.messageType || "") || getBatchMessageTypeForStage_(stage);
      if (!messageType) {
        return adminCommBlockedResult_("send_stage_batch", "STAGE_NOT_SENDABLE", requestId, {
          blockReason: "No batch message is supported for this stage.",
          limit: limit,
          offset: requestedOffset
        });
      }
      var previewGate = readStageBatchPreviewCache_(adminEmail);
      var cachedStage = clean_(previewGate && previewGate.stage || "").toUpperCase();
      var cachedMessageType = clean_(previewGate && previewGate.messageType || "");
      var cachedRequestId = clean_(previewGate && previewGate.requestId || "");
      var cachedOffset = Number(previewGate && previewGate.offset || 0);
      var cachedLimit = Number(previewGate && previewGate.limit || 0);
      var cachedCandidateCount = Number(previewGate && previewGate.candidateCount || 0);
      var cachedEligibleUnsentFound = Number(previewGate && previewGate.eligibleUnsentFound || 0);
      var cachedCandidateIdsSample = Array.isArray(previewGate && previewGate.candidateIds)
        ? previewGate.candidateIds.map(function (id) { return clean_(id || ""); }).filter(function (id) { return !!id; }).slice(0, 5)
        : [];
      var previewWrittenAt = clean_(previewGate && previewGate.writtenAt || "");
      var previewAgeSeconds = stageBatchPreviewAgeSeconds_(previewWrittenAt);
      var previewFreshnessWindowSeconds = stageBatchPreviewCacheTtlSeconds_();
      stageBatchLogSummary_("STAGE_SEND_PREVIEW_PARITY_BEGIN", {
        requestId: requestId,
        previewRequestId: previewRequestId,
        stage: stage,
        messageType: messageType,
        limit: limit,
        offset: requestedOffset,
        candidateCount: cachedCandidateCount,
        candidateHash: clean_(previewGate && previewGate.candidateHash || ""),
        previewAgeSeconds: previewAgeSeconds,
        previewFreshnessWindowSeconds: previewFreshnessWindowSeconds
      });
      var previewCandidateIds = Array.isArray(previewGate && previewGate.candidateIds) ? previewGate.candidateIds.map(function (id) {
        return clean_(id || "");
      }).filter(function (id) {
        return !!id;
      }) : [];
      var previewCandidateCount = Number(previewGate && previewGate.candidateCount != null ? previewGate.candidateCount : previewCandidateIds.length);
      var previewCandidateHash = clean_(previewGate && previewGate.candidateHash || "");
      var cachedCandidateHashPresent = !!previewCandidateHash;
      var payloadCandidateHashPresent = !!requestCandidateHash;
      var computedCandidateHash = stageBatchCandidateHash_(previewCandidateIds);
      var cacheHashMatchesCandidateIds = !cachedCandidateHashPresent || previewCandidateHash === computedCandidateHash;
      var payloadHashMatchesCache = !cachedCandidateHashPresent || requestCandidateHash === previewCandidateHash;
      function buildPreviewParityDecision_(rejectionSubtype, blockCode, blockReason) {
        return {
          blockCode: clean_(blockCode || "PREVIEW_STALE"),
          blockReason: clean_(blockReason || "A matching preview snapshot is required before send."),
          rejectionSubtype: clean_(rejectionSubtype || "UNKNOWN"),
          snapshotExists: !!previewGate,
          previewRequestId: previewRequestId,
          cachedRequestId: cachedRequestId,
          requestedStage: stage,
          cachedStage: cachedStage,
          requestedMessageType: messageType,
          cachedMessageType: cachedMessageType,
          requestedOffset: requestedOffset,
          cachedOffset: cachedOffset,
          requestedLimit: limit,
          cachedLimit: cachedLimit,
          cachedCandidateCount: cachedCandidateCount,
          cachedCandidateIdsSample: cachedCandidateIdsSample,
          previewWrittenAt: previewWrittenAt,
          previewAgeSeconds: previewAgeSeconds,
          previewFreshnessWindowSeconds: previewFreshnessWindowSeconds,
          candidateHashPresent: cachedCandidateHashPresent,
          payloadCandidateHashPresent: payloadCandidateHashPresent,
          hashMatch: payloadHashMatchesCache,
          cacheHashMatchesCandidateIds: cacheHashMatchesCandidateIds
        };
      }
      function buildPreviewParityBlock_(rejectionSubtype) {
        switch (clean_(rejectionSubtype || "").toUpperCase()) {
          case "SNAPSHOT_MISSING":
          case "PREVIEW_REQUEST_ID_MISSING":
            return { blockCode: "PREVIEW_REQUIRED", blockReason: "Preview Cohort is required before batch send.", clearCache: false };
          case "WRITTEN_AT_MISSING":
          case "WRITTEN_AT_INVALID":
          case "PREVIEW_EXPIRED":
            return { blockCode: "PREVIEW_EXPIRED", blockReason: "Preview expired or is stale. Run Preview Cohort again before send.", clearCache: true };
          case "STAGE_MISMATCH":
          case "LIMIT_MISMATCH":
          case "OFFSET_MISMATCH":
          case "MESSAGE_TYPE_MISMATCH":
          case "REQUEST_ID_MISMATCH":
            return { blockCode: "PREVIEW_MISMATCH", blockReason: "Selected stage or preview details no longer match. Run Preview Cohort again.", clearCache: false };
          case "ELIGIBLE_ZERO":
            return { blockCode: "PREVIEW_NOT_SENDABLE", blockReason: "Preview has no mail-eligible applicants for send.", clearCache: false };
          case "CANDIDATE_IDS_MISSING":
          case "CANDIDATE_COUNT_MISMATCH":
          case "CANDIDATE_IDS_EMPTY":
          case "CANDIDATE_HASH_MISSING_CACHED":
          case "CANDIDATE_HASH_CACHE_MISMATCH":
            return { blockCode: "PREVIEW_CHANGED_RETRY", blockReason: "Preview authority is incomplete or changed. Run Preview Cohort again before send.", clearCache: true };
          case "CANDIDATE_HASH_MISSING":
          case "CANDIDATE_HASH_PAYLOAD_MISMATCH":
            return { blockCode: "PREVIEW_MISMATCH", blockReason: "Preview authority hash does not match this send request. Run Preview Cohort again.", clearCache: false };
          default:
            return { blockCode: "PREVIEW_STALE", blockReason: "A matching preview snapshot is required before send.", clearCache: false };
        }
      }
      var staleSubtype = "";
      if (!previewGate) staleSubtype = "SNAPSHOT_MISSING";
      else if (!previewRequestId) staleSubtype = "PREVIEW_REQUEST_ID_MISSING";
      else if (!previewWrittenAt) staleSubtype = "WRITTEN_AT_MISSING";
      else if (!(previewAgeSeconds >= 0)) staleSubtype = "WRITTEN_AT_INVALID";
      else if (previewAgeSeconds > previewFreshnessWindowSeconds) staleSubtype = "PREVIEW_EXPIRED";
      else if (cachedStage !== stage) staleSubtype = "STAGE_MISMATCH";
      else if (cachedLimit !== limit) staleSubtype = "LIMIT_MISMATCH";
      else if (cachedOffset !== requestedOffset) staleSubtype = "OFFSET_MISMATCH";
      else if (cachedMessageType !== messageType) staleSubtype = "MESSAGE_TYPE_MISMATCH";
      else if (cachedRequestId !== previewRequestId) staleSubtype = "REQUEST_ID_MISMATCH";
      else if (!(Number(previewGate.eligible || 0) > 0)) staleSubtype = "ELIGIBLE_ZERO";
      if (staleSubtype) {
        var previewStaleMeta = buildPreviewParityBlock_(staleSubtype);
        if (previewStaleMeta.clearCache === true) clearStageBatchPreviewCache_(adminEmail);
        var previewStaleDecision = buildPreviewParityDecision_(staleSubtype, previewStaleMeta.blockCode, previewStaleMeta.blockReason);
        stageBatchLogSummary_("STAGE_SEND_PREVIEW_PARITY_DECISION", Object.assign({
          requestId: requestId,
          decision: "REJECT"
        }, previewStaleDecision));
        stageBatchLogSummary_("STAGE_SEND_PREVIEW_PARITY_FAIL", Object.assign({
          requestId: requestId,
          reason: "PREVIEW_STALE"
        }, previewStaleDecision));
        var previewStaleResult = adminCommBlockedResult_("send_stage_batch", previewStaleDecision.blockCode, requestId, {
          blockReason: previewStaleDecision.blockReason,
          limit: limit,
          offset: requestedOffset,
          messageType: messageType
        });
        Object.keys(previewStaleDecision).forEach(function (key) {
          previewStaleResult[key] = previewStaleDecision[key];
        });
        previewStaleResult.offset = requestedOffset;
        return previewStaleResult;
      }
      var previewChangedSubtype = "";
      if (!Array.isArray(previewGate.candidateIds)) previewChangedSubtype = "CANDIDATE_IDS_MISSING";
      else if (previewCandidateCount !== previewCandidateIds.length) previewChangedSubtype = "CANDIDATE_COUNT_MISMATCH";
      else if (!previewCandidateIds.length) previewChangedSubtype = "CANDIDATE_IDS_EMPTY";
      else if (!cachedCandidateHashPresent) previewChangedSubtype = "CANDIDATE_HASH_MISSING_CACHED";
      else if (!payloadCandidateHashPresent) previewChangedSubtype = "CANDIDATE_HASH_MISSING";
      else if (!payloadHashMatchesCache) previewChangedSubtype = "CANDIDATE_HASH_PAYLOAD_MISMATCH";
      else if (!cacheHashMatchesCandidateIds) previewChangedSubtype = "CANDIDATE_HASH_CACHE_MISMATCH";
      if (previewChangedSubtype) {
        var previewChangedMeta = buildPreviewParityBlock_(previewChangedSubtype);
        if (previewChangedMeta.clearCache === true) clearStageBatchPreviewCache_(adminEmail);
        var previewChangedDecision = buildPreviewParityDecision_(previewChangedSubtype, previewChangedMeta.blockCode, previewChangedMeta.blockReason);
        stageBatchLogSummary_("STAGE_SEND_PREVIEW_PARITY_DECISION", Object.assign({
          requestId: requestId,
          decision: "REJECT"
        }, previewChangedDecision));
        stageBatchLogSummary_("STAGE_SEND_PREVIEW_PARITY_FAIL", Object.assign({
          requestId: requestId,
          reason: "PREVIEW_CHANGED_RETRY"
        }, previewChangedDecision));
        var previewChangedRetryResult = adminCommBlockedResult_("send_stage_batch", previewChangedDecision.blockCode, requestId, {
          blockReason: previewChangedDecision.blockReason,
          limit: limit,
          offset: requestedOffset,
          messageType: messageType
        });
        Object.keys(previewChangedDecision).forEach(function (key) {
          previewChangedRetryResult[key] = previewChangedDecision[key];
        });
        previewChangedRetryResult.offset = requestedOffset;
        return previewChangedRetryResult;
      }
      stageBatchLogSummary_("STAGE_SEND_PREVIEW_PARITY_DECISION", {
        requestId: requestId,
        decision: "MATCH",
        blockCode: "",
        blockReason: "",
        rejectionSubtype: "",
        snapshotExists: true,
        previewRequestId: previewRequestId,
        cachedRequestId: cachedRequestId,
        requestedStage: stage,
        cachedStage: cachedStage,
        requestedMessageType: messageType,
        cachedMessageType: cachedMessageType,
        requestedOffset: requestedOffset,
        cachedOffset: cachedOffset,
        requestedLimit: limit,
        cachedLimit: cachedLimit,
        cachedCandidateCount: cachedCandidateCount,
        cachedCandidateIdsSample: cachedCandidateIdsSample,
        previewWrittenAt: previewWrittenAt,
        previewAgeSeconds: previewAgeSeconds,
        previewFreshnessWindowSeconds: previewFreshnessWindowSeconds,
        candidateHashPresent: cachedCandidateHashPresent,
        payloadCandidateHashPresent: payloadCandidateHashPresent,
        hashMatch: payloadHashMatchesCache,
        cacheHashMatchesCandidateIds: cacheHashMatchesCandidateIds
      });
      stageBatchLogSummary_("STAGE_SEND_PREVIEW_PARITY_MATCH", {
        requestId: requestId,
        previewRequestId: previewRequestId,
        stage: stage,
        messageType: messageType,
        limit: limit,
        offset: requestedOffset,
        candidateCount: previewCandidateCount,
        candidateHash: previewCandidateHash,
        previewAgeSeconds: previewAgeSeconds,
        previewFreshnessWindowSeconds: previewFreshnessWindowSeconds
      });
      stageBatchLogSummary_("STAGE_SEND_START", {
        requestId: requestId,
        stage: stage,
        messageType: messageType
      });
      var priority = mapStagePriority_(stage);
      stageBatchLogSummary_("STAGE_SEND_COHORT_READY", {
        requestId: requestId,
        stage: stage,
        messageType: messageType,
        total: previewCandidateIds.length
      });
      var out = {
        ok: true,
        stage: stage,
        priority: priority,
        messageType: messageType,
        sendable: true,
        requestId: requestId,
        totalInStageAtSend: 0,
        eligibleUnsentFoundAtSend: previewCandidateIds.length,
        sendLimit: limit,
        warning: limitMeta.warning,
        warnings: limitMeta.warning ? [limitMeta.warning] : [],
        requestedOffset: requestedOffset,
        offset: requestedOffset,
        offsetApplied: false,
        offsetIgnored: requestedOffset > 0,
        offsetMode: "PRODUCTION_STATEFUL",
        alreadySentExcluded: 0,
        failedExcluded: 0,
        attempted: 0,
        sent: 0,
        blocked: 0,
        failed: 0,
        blockedByReason: {},
        sentApplicantIdsSample: [],
        processedCount: 0,
        remainingEligibleEstimate: 0
      };
      var batchLabel = "STAGE_SEND::" + stage + "::" + requestId;
      previewCandidateIds.forEach(function (applicantId, index) {
        out.attempted++;
        stageBatchLogSummary_("STAGE_SEND_CANDIDATE_BEGIN", {
          requestId: requestId,
          applicantId: applicantId,
          stage: stage,
          messageType: messageType,
          index: index + 1,
          total: previewCandidateIds.length
        });
        var sendResult = sendApplicantMessage_(applicantId, messageType, {
          actorEmail: actor.actorEmail,
          actorRole: actor.actorRole,
          batchLabel: batchLabel,
          debugId: requestId,
          sendSource: "ADMIN_STAGE_BATCH",
          unattended: false
        });
        stageBatchLogSummary_("STAGE_SEND_CANDIDATE_END", {
          requestId: requestId,
          applicantId: applicantId,
          stage: stage,
          messageType: messageType,
          index: index + 1,
          total: previewCandidateIds.length,
          result: clean_(sendResult && sendResult.result || "")
        });
        var resultType = clean_(sendResult && sendResult.result || "").toUpperCase();
        if (resultType === "SENT") {
          out.sent++;
          pushStageBatchSample_(out.sentApplicantIdsSample, applicantId);
        } else if (resultType === "BLOCKED") {
          out.blocked++;
          incrementStageBatchReason_(out.blockedByReason, sendResult && (sendResult.blockCode || sendResult.code || "BLOCKED"));
        } else {
          out.failed++;
        }
      });
      clearStageBatchPreviewCache_(adminEmail);
      stageBatchLogSummary_("STAGE_BATCH_SEND_SUMMARY", {
        debugId: requestId,
        requestId: requestId,
        stage: stage,
        batchSizeRequested: limit,
        requestedOffset: requestedOffset,
        offsetIgnored: out.offsetIgnored === true,
        totalEligibleUnsentRowsFound: out.eligibleUnsentFoundAtSend,
        rowsAttempted: out.attempted,
        rowsSent: out.sent,
        rowsBlocked: out.blocked,
        rowsFailed: out.failed,
        alreadySentExcluded: out.alreadySentExcluded,
        failedExcluded: out.failedExcluded,
        blockedByReason: out.blockedByReason
      });
      out.processedCount = Number(out.attempted || 0);
      out.remainingEligibleEstimate = Math.max(0, cachedEligibleUnsentFound - out.processedCount);
      out.message = out.remainingEligibleEstimate > 0
        ? "Batch completed safely. Re-run to continue remaining records."
        : "Batch completed safely.";
      if (limitMeta.warning) out.message += " " + limitMeta.warning;
      stageBatchLogSummary_("STAGE_SEND_COMPLETE", {
        requestId: requestId,
        stage: stage,
        messageType: messageType,
        index: Number(out.attempted || 0),
        total: previewCandidateIds.length,
        sent: Number(out.sent || 0),
        blocked: Number(out.blocked || 0),
        failed: Number(out.failed || 0)
      });
      return out;
    } catch (e) {
      stageBatchLogSummary_("STAGE_SEND_FAIL", {
        requestId: requestId,
        applicantId: "",
        stage: stage,
        messageType: messageType,
        index: 0,
        total: 0,
        error: String(e && e.message ? e.message : e || "Stage batch send failed.")
      });
      throw e;
    } finally {
      try {
        if (stageBatchSendLock) stageBatchSendLock.releaseLock();
      } catch (_stageBatchLockReleaseErr) {}
    }
  });
}
