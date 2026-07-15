function eduopsFodeCanonicalSnapshot_() {
  return canonicalPopulationSnapshot_();
}

var EDUOPS_FODE_SNAPSHOT_CACHE_TTL_SECONDS = 120;
var EDUOPS_FODE_SNAPSHOT_CACHE_CHUNK_CHARS = 75000;

function eduopsFodeSourceVersion_() {
  var started = Date.now();
  var sheet = openDataSheet_();
  var spreadsheet = sheet && typeof sheet.getParent === "function" ? sheet.getParent() : null;
  var spreadsheetId = spreadsheet && typeof spreadsheet.getId === "function" ? spreadsheet.getId() : "";
  var updatedMs = 0;
  try {
    updatedMs = spreadsheetId ? DriveApp.getFileById(spreadsheetId).getLastUpdated().getTime() : 0;
  } catch (_driveErr) {
    updatedMs = 0;
  }
  var source = {
    product: "FODE",
    spreadsheetId: eduopsClean_(spreadsheetId),
    sheetName: sheet && typeof sheet.getName === "function" ? eduopsClean_(sheet.getName()) : "",
    lastRow: sheet && typeof sheet.getLastRow === "function" ? Number(sheet.getLastRow() || 0) : 0,
    lastColumn: sheet && typeof sheet.getLastColumn === "function" ? Number(sheet.getLastColumn() || 0) : 0,
    updatedMs: Number(updatedMs || 0)
  };
  source.cacheable = !!(source.spreadsheetId && source.sheetName && source.updatedMs);
  source.key = [source.product, source.spreadsheetId, source.sheetName, source.lastRow, source.lastColumn, source.updatedMs].join("|");
  source.durationMs = Date.now() - started;
  return source;
}

function eduopsFodeSnapshotCacheBaseKey_(sourceVersion, access) {
  var scope = [
    "EDUOPS_PASS1_FODE",
    sourceVersion && sourceVersion.key || "UNCACHEABLE",
    access && access.email || "",
    access && access.role || ""
  ].join("|");
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, scope, Utilities.Charset.UTF_8);
  return "eduops:fode:" + Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, "").slice(0, 28);
}

function eduopsFodeSnapshotCacheRead_(cache, baseKey) {
  var manifestRaw = cache && cache.get(baseKey + ":manifest");
  if (!manifestRaw) return null;
  var manifest = JSON.parse(manifestRaw);
  var chunkCount = Number(manifest.chunkCount || 0);
  if (!chunkCount || chunkCount > 100) return null;
  var keys = [];
  for (var i = 0; i < chunkCount; i++) keys.push(baseKey + ":" + i);
  var chunks = cache.getAll(keys);
  var json = keys.map(function (key) { return chunks[key] || ""; }).join("");
  if (!json || json.length !== Number(manifest.payloadChars || 0)) return null;
  return JSON.parse(json);
}

function eduopsFodeSnapshotCacheWrite_(cache, baseKey, record) {
  if (!cache) return;
  var json = JSON.stringify(record);
  var values = {};
  var chunkCount = Math.ceil(json.length / EDUOPS_FODE_SNAPSHOT_CACHE_CHUNK_CHARS);
  for (var i = 0; i < chunkCount; i++) {
    values[baseKey + ":" + i] = json.slice(i * EDUOPS_FODE_SNAPSHOT_CACHE_CHUNK_CHARS, (i + 1) * EDUOPS_FODE_SNAPSHOT_CACHE_CHUNK_CHARS);
  }
  cache.putAll(values, EDUOPS_FODE_SNAPSHOT_CACHE_TTL_SECONDS);
  cache.put(baseKey + ":manifest", JSON.stringify({ chunkCount: chunkCount, payloadChars: json.length }), EDUOPS_FODE_SNAPSHOT_CACHE_TTL_SECONDS);
}

function eduopsFodeCacheableRows_(snapshot) {
  return eduopsFodeRowsForSnapshot_(snapshot).map(function (row) {
    var compact = eduopsClone_(row);
    delete compact.canonical;
    return compact;
  });
}

function eduopsResolveFodeSnapshot_(access) {
  var started = Date.now();
  var sourceVersion = eduopsFodeSourceVersion_();
  var sourceVersionMs = Date.now() - started;
  var cache = sourceVersion.cacheable ? CacheService.getScriptCache() : null;
  var baseKey = sourceVersion.cacheable ? eduopsFodeSnapshotCacheBaseKey_(sourceVersion, access) : "";
  var cacheReadStarted = Date.now();
  var cached = null;
  if (cache) {
    try { cached = eduopsFodeSnapshotCacheRead_(cache, baseKey); } catch (_cacheReadErr) { cached = null; }
  }
  var cacheReadMs = Date.now() - cacheReadStarted;
  if (cached && cached.snapshotId && Array.isArray(cached.rows)) {
    return {
      snapshotId: cached.snapshotId,
      snapshotAsOf: cached.snapshotAsOf,
      sourceSheetName: cached.sourceSheetName,
      totalRows: Number(cached.totalRows || cached.rows.length),
      rows: cached.rows,
      sourceVersion: sourceVersion,
      cacheState: "HIT",
      timings: {
        canonicalSnapshotResolutionMs: Date.now() - started,
        sourceVersionMs: sourceVersionMs,
        cacheReadMs: cacheReadMs,
        canonicalBuildMs: 0,
        projectionMs: 0,
        cacheWriteMs: 0
      }
    };
  }

  var canonicalStarted = Date.now();
  var snapshot = eduopsFodeCanonicalSnapshot_();
  var canonicalBuildMs = Date.now() - canonicalStarted;
  var projectionStarted = Date.now();
  var record = {
    snapshotId: eduopsRuntimeSnapshotId_(snapshot),
    snapshotAsOf: eduopsClean_(snapshot.generatedAt || ""),
    sourceSheetName: eduopsClean_(snapshot.sourceSheetName || sourceVersion.sheetName || ""),
    totalRows: Number(snapshot.totalRows || 0),
    rows: eduopsFodeCacheableRows_(snapshot)
  };
  var projectionMs = Date.now() - projectionStarted;
  var cacheWriteStarted = Date.now();
  if (cache) {
    try { eduopsFodeSnapshotCacheWrite_(cache, baseKey, record); } catch (_cacheWriteErr) { /* Cache loss is recoverable from canonical authority. */ }
  }
  var cacheWriteMs = Date.now() - cacheWriteStarted;
  return {
    snapshotId: record.snapshotId,
    snapshotAsOf: record.snapshotAsOf,
    sourceSheetName: record.sourceSheetName,
    totalRows: record.totalRows || record.rows.length,
    rows: record.rows,
    sourceVersion: sourceVersion,
    cacheState: sourceVersion.cacheable ? "MISS_REHYDRATED" : "UNCACHEABLE_REHYDRATED",
    timings: {
      canonicalSnapshotResolutionMs: Date.now() - started,
      sourceVersionMs: sourceVersionMs,
      cacheReadMs: cacheReadMs,
      canonicalBuildMs: canonicalBuildMs,
      projectionMs: projectionMs,
      cacheWriteMs: cacheWriteMs
    }
  };
}

function eduopsFodeActionabilityRowFromCanonical_(canonical) {
  var row = canonical || {};
  var identity = row.identity || {};
  var applicant = row.applicant || {};
  var actionability = row.actionability || {};
  var financeAuthority = row.finance && row.finance.financeAuthority || {};
  var documents = row.documents || {};
  var contactability = row.contactability || {};
  var lifecycle = row.lifecycle || {};
  return {
    rowNumber: Number(identity.rowNumber || 0),
    applicantId: eduopsClean_(identity.applicantId || ""),
    name: eduopsClean_(applicant.name || ""),
    email: eduopsClean_(applicant.effectiveEmail || applicant.email || ""),
    phone: eduopsClean_(applicant.phone || ""),
    actionOwner: eduopsClean_(actionability.actionOwner || row.owner || lifecycle.actionOwner || "NONE"),
    workloadGroupKey: eduopsUpper_(actionability.workloadGroupKey || "UNKNOWN"),
    worklistKey: eduopsClean_(actionability.worklistKey || ""),
    worklistLabel: eduopsClean_(actionability.worklistLabel || ""),
    worklistReason: eduopsClean_(actionability.worklistReason || ""),
    nextAction: eduopsClean_(actionability.nextAction || ""),
    actionabilityState: eduopsUpper_(actionability.state || "UNKNOWN"),
    selectable: actionability.selectable === true,
    selectBlockReason: eduopsClean_(actionability.selectBlockReason || ""),
    coolingOffUntil: eduopsClean_(actionability.coolingOffUntil || ""),
    recommendedAction: eduopsClean_(actionability.recommendedAction || ""),
    reasonCode: eduopsClean_(actionability.reasonCode || ""),
    urgencyLevel: eduopsClean_(actionability.urgencyLevel || ""),
    urgencyReason: eduopsClean_(actionability.urgencyReason || ""),
    suppressor: eduopsClean_(actionability.suppressor || ""),
    recommendedMessageType: eduopsClean_(actionability.recommendedMessageType || lifecycle.recommendedMessageType || ""),
    communicationProgress: eduopsClean_(actionability.communicationProgress || ""),
    communicationProgressDetail: eduopsClean_(actionability.communicationProgressDetail || ""),
    canonicalLifecycle: {
      baseState: eduopsUpper_(lifecycle.baseState || "UNKNOWN"),
      lifecycleStage: eduopsUpper_(lifecycle.lifecycleStage || lifecycle.baseState || "UNKNOWN"),
      overlays: Array.isArray(lifecycle.overlays) ? lifecycle.overlays.slice() : [],
      recommendedNextAction: eduopsClean_(lifecycle.recommendedNextAction || ""),
      recommendedMessageType: eduopsClean_(lifecycle.recommendedMessageType || ""),
      actionOwner: eduopsClean_(lifecycle.actionOwner || ""),
      reason: eduopsClean_(lifecycle.reason || "")
    },
    lifecycleMismatch: row.diagnostics && row.diagnostics.lifecycleMismatch ? row.diagnostics.lifecycleMismatch : { hasLifecycleMismatch: false },
    explanation: eduopsClean_(financeAuthority.financeReason || lifecycle.reason || ""),
    lastRelevantDate: eduopsClean_(actionability.lastRelevantDate || ""),
    lastRelevantDateSource: eduopsClean_(actionability.lastRelevantDateSource || ""),
    ageDays: actionability.ageDays === "" ? "" : Number(actionability.ageDays || 0),
    lastContactAgeDays: actionability.lastContactAgeDays === "" ? "" : Number(actionability.lastContactAgeDays || 0),
    sourceAuthorities: Array.isArray(row.diagnostics && row.diagnostics.sourceAuthorities) ? row.diagnostics.sourceAuthorities.slice() : [],
    authorityState: {
      lifecycleStage: eduopsClean_(row.diagnostics && row.diagnostics.legacyLifecycleStage || lifecycle.lifecycleStage || ""),
      documentState: eduopsClean_(documents.state || "UNKNOWN"),
      requiredDocumentUploadComplete: documents.requiredComplete === true,
      uploadedRequiredDocumentCount: Number(documents.uploadedRequiredCount || 0),
      requiredDocumentCount: Number(documents.requiredCount || 0),
      missingRequiredDocuments: Array.isArray(documents.missingRequiredDocuments) ? documents.missingRequiredDocuments.slice() : [],
      docsVerified: documents.verified === true,
      portalSubmitted: eduopsClean_(lifecycle.baseState || "") !== "APPLICATION_RECEIVED",
      paymentEvidencePresent: financeAuthority.paymentEvidencePresent === true,
      paymentVerified: financeAuthority.paymentVerified === true,
      paymentApplicable: financeAuthority.paymentApplicable === true,
      canonicalFinanceState: eduopsClean_(financeAuthority.financeState || "UNKNOWN"),
      hasValidEmail: contactability.hasValidEmail === true,
      hasPhoneFallback: contactability.hasPhoneFallback === true,
      contactabilityState: eduopsClean_(contactability.state || "UNKNOWN")
    },
    canonical: row
  };
}

function eduopsFodeRowDto_(row, query, snapshotId, reliability) {
  var sourceReliability = reliability || eduopsSourceReliability_("AUTHORITATIVE", "", "FODE adapter");
  var authorityState = row.authorityState || {};
  var safeState = sourceReliability.state === "CONFLICTING" && row.actionabilityState === "READY" ? "UNKNOWN" : row.actionabilityState;
  return {
    rowKey: "FODE:" + eduopsClean_(row.applicantId || "") + ":" + Number(row.rowNumber || 0),
    rowNumber: Number(row.rowNumber || 0),
    applicantId: eduopsClean_(row.applicantId || ""),
    displayName: eduopsClean_(row.name || ""),
    email: eduopsClean_(row.email || ""),
    phone: eduopsClean_(row.phone || ""),
    actionabilityState: safeState,
    actionabilityLabel: eduopsStateLabel_(safeState),
    worklistKey: eduopsClean_(row.worklistKey || ""),
    worklistLabel: eduopsClean_(row.worklistLabel || eduopsHumanize_(row.worklistKey || "")),
    primaryRoute: eduopsPrimaryRouteForRow_(row),
    actionOwner: eduopsClean_(row.actionOwner || ""),
    workOwnership: eduopsWorkOwnership_(row),
    nextAction: eduopsClean_(row.nextAction || ""),
    selectable: row.selectable === true && sourceReliability.state !== "CONFLICTING",
    selectBlockReason: sourceReliability.state === "CONFLICTING" ? "Source conflict prevents confident readiness." : eduopsClean_(row.selectBlockReason || ""),
    blockerCode: eduopsClean_(row.reasonCode || row.suppressor || ""),
    blockerReason: eduopsClean_(row.selectBlockReason || row.communicationProgressDetail || row.explanation || ""),
    urgencyLevel: eduopsClean_(row.urgencyLevel || ""),
    urgencyReason: eduopsClean_(row.urgencyReason || ""),
    coolingOffUntil: eduopsClean_(row.coolingOffUntil || ""),
    recommendedMessageType: eduopsClean_(row.recommendedMessageType || ""),
    communicationAuthoritySummary: eduopsClean_(row.communicationProgress || row.communicationProgressDetail || ""),
    canonicalLifecycle: eduopsClone_(row.canonicalLifecycle || {}),
    canonicalFinanceState: eduopsClean_(authorityState.canonicalFinanceState || "UNKNOWN"),
    documentState: eduopsClean_(authorityState.documentState || "UNKNOWN"),
    contactabilityState: eduopsClean_(authorityState.contactabilityState || "UNKNOWN"),
    portalState: authorityState.portalSubmitted === true ? "SUBMITTED" : "NOT_SUBMITTED",
    sourceReliability: sourceReliability,
    authorityProjectionVersion: EDUOPS_CONTRACT_VERSION,
    returnContext: eduopsReturnContext_(query, row),
    snapshotId: snapshotId
  };
}

function eduopsPrimaryRouteForRow_(row) {
  var owner = eduopsUpper_(row && row.actionOwner || "");
  var nextAction = eduopsUpper_(row && row.nextAction || "");
  if (nextAction === "VERIFY_PAYMENT" || nextAction === "SEND_PAYMENT_REMINDER") return "Finance";
  if (nextAction === "ENROLL") return "Academic Administration";
  if (nextAction === "FIX_CONTACT_DETAILS") return "Contactability";
  if (owner === "OFFICER" || nextAction === "REVIEW_DOCUMENTS") return "Admissions Review";
  if (owner === "APPLICANT") return "Applicant Action";
  return "Operations";
}

function eduopsFodeRowsForSnapshot_(snapshot) {
  return (snapshot.rows || []).map(eduopsFodeActionabilityRowFromCanonical_);
}

function eduopsFodeSearchResultDto_(row, query, snapshotId) {
  var reliability = eduopsSourceReliability_("AUTHORITATIVE", "Search result is projected from the same canonical FODE snapshot.", "FODE search");
  var dto = eduopsFodeRowDto_(row, query || {}, snapshotId, reliability);
  return {
    applicantId: dto.applicantId,
    rowKey: dto.rowKey,
    displayName: dto.displayName,
    email: dto.email,
    phone: dto.phone,
    actionabilityState: dto.actionabilityState,
    actionabilityLabel: dto.actionabilityLabel,
    worklistKey: dto.worklistKey,
    worklistLabel: dto.worklistLabel,
    owner: dto.actionOwner,
    nextAction: dto.nextAction,
    blocker: dto.blockerReason,
    primaryRoute: dto.primaryRoute,
    reliability: dto.sourceReliability,
    returnContext: dto.returnContext
  };
}

function eduopsFodeApplicantRead_(applicantId, query, snapshotId) {
  var canonicalRes = admin_getCanonicalApplicant({ applicantId: applicantId });
  if (!canonicalRes || canonicalRes.ok !== true || !canonicalRes.applicant) {
    return { ok: false, code: canonicalRes && canonicalRes.code || "APPLICANT_NOT_FOUND", applicantId: applicantId };
  }
  var row = eduopsFodeActionabilityRowFromCanonical_(canonicalRes.applicant);
  var reliability = eduopsSourceReliability_("AUTHORITATIVE", "Exact applicant read is composed from canonical FODE authorities.", "FODE adapter");
  var projection = eduopsFodeRowDto_(row, query || {}, snapshotId, reliability);
  var detail = {};
  try {
    detail = admin_getApplicantDetail({ applicantId: applicantId });
  } catch (_detailErr) {
    detail = { ok: false, code: "DETAIL_UNAVAILABLE" };
  }
  return {
    ok: true,
    product: "FODE",
    snapshotId: snapshotId,
    rowKey: projection.rowKey,
    applicantId: applicantId,
    identity: {
      applicantId: applicantId,
      rowNumber: projection.rowNumber,
      displayName: projection.displayName,
      email: projection.email,
      phone: projection.phone
    },
    exactAuthorityProjection: projection,
    applicantDetail: eduopsBoundApplicantDetail_(detail),
    documents: eduopsDocumentsSummary_(canonicalRes.applicant),
    finance: eduopsFinanceSummary_(canonicalRes.applicant),
    communications: eduopsCommunicationsSummary_(canonicalRes.applicant),
    portal: eduopsPortalSummary_(canonicalRes.applicant),
    contactability: eduopsContactabilitySummary_(canonicalRes.applicant),
    auditSummary: eduopsAuditSummary_(canonicalRes.applicant),
    sourceReliability: reliability,
    returnContext: projection.returnContext
  };
}

function eduopsBoundApplicantDetail_(detail) {
  var d = detail && typeof detail === "object" ? detail : {};
  return {
    ok: d.ok !== false,
    applicantId: eduopsClean_(d.ApplicantID || d.applicantId || ""),
    displayName: [eduopsClean_(d.First_Name || ""), eduopsClean_(d.Last_Name || "")].filter(function (v) { return !!v; }).join(" "),
    rowNumber: Number(d.rowNumber || d.Row_Number || 0),
    readOnly: true
  };
}

function eduopsDocumentsSummary_(canonical) {
  var docs = canonical && canonical.documents || {};
  return {
    state: eduopsClean_(docs.state || "UNKNOWN"),
    verified: docs.verified === true,
    requiredComplete: docs.requiredComplete === true,
    uploadedRequiredCount: Number(docs.uploadedRequiredCount || 0),
    requiredCount: Number(docs.requiredCount || 0),
    missingRequiredDocuments: Array.isArray(docs.missingRequiredDocuments) ? docs.missingRequiredDocuments.slice() : [],
    actions: [eduopsReadOnlyAction_("Save document statuses", "CAN_SAVE_DOCUMENT_STATUSES")]
  };
}

function eduopsFinanceSummary_(canonical) {
  var finance = canonical && canonical.finance && canonical.finance.financeAuthority || {};
  return {
    state: eduopsClean_(finance.financeState || "UNKNOWN"),
    paymentApplicable: finance.paymentApplicable === true,
    paymentEvidencePresent: finance.paymentEvidencePresent === true,
    paymentVerified: finance.paymentVerified === true,
    owner: eduopsClean_(canonical && canonical.owner || ""),
    blocker: eduopsClean_(finance.financeReason || ""),
    nextAction: finance.paymentVerified === true ? "No payment action" : "Review payment context",
    actions: [
      eduopsReadOnlyAction_("Verify payment", "CAN_VERIFY_PAYMENT"),
      eduopsReadOnlyAction_("Create Books invoice", "CAN_WRITE_ZOHO_BOOKS")
    ]
  };
}

function eduopsCommunicationsSummary_(canonical) {
  var comm = canonical && canonical.communication || {};
  var actionability = canonical && canonical.actionability || {};
  return {
    recommendedMessageType: eduopsClean_(actionability.recommendedMessageType || comm.recommendedMessageType || ""),
    eligibility: eduopsClean_(comm.authorityResult || actionability.communicationProgress || ""),
    coolingOffUntil: eduopsClean_(actionability.coolingOffUntil || ""),
    latestCommunication: eduopsClean_(comm.latestCommunicationAt || ""),
    deliveryState: eduopsClean_(comm.deliveryState || ""),
    actions: [
      eduopsReadOnlyAction_("Preview communication", "CAN_PREVIEW_APPLICANT_COMMUNICATION"),
      eduopsReadOnlyAction_("Send communication", "CAN_SEND_INDIVIDUAL_EMAIL")
    ]
  };
}

function eduopsPortalSummary_(canonical) {
  var portal = canonical && canonical.portal || {};
  return {
    submitted: canonical && canonical.actionability && canonical.actionability.authorityState && canonical.actionability.authorityState.portalSubmitted === true,
    accessState: eduopsClean_(portal.accessState || ""),
    locked: portal.locked === true,
    tokenState: eduopsClean_(portal.tokenState || ""),
    actions: [
      eduopsReadOnlyAction_("Reset portal link", "CAN_MANAGE_PORTAL_ACCESS"),
      eduopsReadOnlyAction_("Set portal access", "CAN_MANAGE_PORTAL_ACCESS")
    ]
  };
}

function eduopsContactabilitySummary_(canonical) {
  var c = canonical && canonical.contactability || {};
  return {
    state: eduopsClean_(c.state || "UNKNOWN"),
    effectiveEmail: eduopsClean_(canonical && canonical.applicant && canonical.applicant.effectiveEmail || ""),
    phone: eduopsClean_(canonical && canonical.applicant && canonical.applicant.phone || ""),
    hasValidEmail: c.hasValidEmail === true,
    hasPhoneFallback: c.hasPhoneFallback === true,
    actions: [eduopsReadOnlyAction_("Correct contact details", "CAN_OPEN_REVIEW_WORKSPACE")]
  };
}

function eduopsAuditSummary_(canonical) {
  return {
    provenance: canonical && canonical.diagnostics || {},
    readOnly: true,
    note: "Audit details are projected for Pass 1 inspection only."
  };
}
