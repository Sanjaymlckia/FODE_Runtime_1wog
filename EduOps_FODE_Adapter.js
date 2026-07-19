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
    actionOwner: eduopsClean_(actionability.actionOwner || row.owner || lifecycle.actionOwner || ""),
    workloadGroupKey: eduopsClean_(actionability.workloadGroupKey || "").toUpperCase(),
    worklistKey: eduopsClean_(actionability.worklistKey || ""),
    worklistLabel: eduopsClean_(actionability.worklistLabel || ""),
    worklistReason: eduopsClean_(actionability.worklistReason || ""),
    nextAction: eduopsClean_(actionability.nextAction || ""),
    nextActionDate: eduopsClean_(actionability.nextActionDate || ""),
    actionabilityState: eduopsClean_(actionability.state || "").toUpperCase(),
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
      baseState: eduopsClean_(lifecycle.baseState || "").toUpperCase(),
      lifecycleStage: eduopsClean_(lifecycle.lifecycleStage || lifecycle.baseState || "").toUpperCase(),
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
      documentState: eduopsClean_(documents.state || ""),
      requiredDocumentUploadComplete: documents.requiredComplete === true,
      uploadedRequiredDocumentCount: Number(documents.uploadedRequiredCount || 0),
      requiredDocumentCount: Number(documents.requiredCount || 0),
      missingRequiredDocuments: Array.isArray(documents.missingRequiredDocuments) ? documents.missingRequiredDocuments.slice() : [],
      docsVerified: documents.verified === true,
      portalSubmitted: null,
      paymentEvidencePresent: financeAuthority.paymentEvidencePresent === true,
      paymentVerified: financeAuthority.paymentVerified === true,
      paymentApplicable: financeAuthority.paymentApplicable === true,
      canonicalFinanceState: eduopsClean_(financeAuthority.financeState || ""),
      hasValidEmail: contactability.hasValidEmail === true,
      hasPhoneFallback: contactability.hasPhoneFallback === true,
      contactabilityState: eduopsClean_(contactability.state || "")
    },
    canonical: row
  };
}

function eduopsFodeRowDto_(row, query, snapshotId, reliability) {
  var sourceReliability = reliability || eduopsSourceReliability_("AUTHORITATIVE", "", "FODE adapter");
  var authorityState = row.authorityState || {};
  var actionabilityPresentation = eduopsStatePresentation_(row.actionabilityState);
  var reliabilityPresentation = eduopsStatePresentation_(sourceReliability.state);
  var worklistPresentation = eduopsCodePresentation_(row.worklistKey, row.worklistLabel, row.worklistReason, "Actionability Resolver");
  var lifecycleState = row.canonicalLifecycle && (row.canonicalLifecycle.lifecycleStage || row.canonicalLifecycle.baseState) || "";
  var coolingPresentation = row.actionabilityState === "COOLING_OFF"
    ? (row.coolingOffUntil ? eduopsCodePresentation_("COOLING_OFF", "Recently contacted - waiting period", "Cooling-off expires " + row.coolingOffUntil + ".", "Actionability Resolver") : eduopsAuthorityUnavailable_("cooling-off expiry", "Actionability Resolver"))
    : eduopsCodePresentation_("NOT_COOLING_OFF", "No waiting period", "Actionability Resolver did not return an active cooling-off gate.", "Actionability Resolver");
  return {
    schemaVersion: "EDUOPS_WORKLOAD_ROW_V2",
    authoritySource: "Actionability Resolver",
    rowKey: "FODE:" + eduopsClean_(row.applicantId || "") + ":" + Number(row.rowNumber || 0),
    rowNumber: Number(row.rowNumber || 0),
    applicantId: eduopsClean_(row.applicantId || ""),
    displayName: eduopsClean_(row.name || ""),
    email: eduopsClean_(row.email || ""),
    phone: eduopsClean_(row.phone || ""),
    actionabilityState: row.actionabilityState,
    actionabilityLabel: actionabilityPresentation.label || "",
    worklistKey: eduopsClean_(row.worklistKey || ""),
    worklistLabel: worklistPresentation.label || "",
    primaryRoute: eduopsPrimaryRouteForRow_(row),
    actionOwner: eduopsClean_(row.actionOwner || ""),
    workOwnership: eduopsWorkOwnership_(row),
    nextAction: eduopsClean_(row.nextAction || ""),
    nextActionDate: eduopsClean_(row.nextActionDate || ""),
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
    canonicalFinanceState: eduopsClean_(authorityState.canonicalFinanceState || ""),
    documentState: eduopsClean_(authorityState.documentState || ""),
    contactabilityState: eduopsClean_(authorityState.contactabilityState || ""),
    portalState: "",
    presentation: {
      actionability: actionabilityPresentation,
      worklist: worklistPresentation,
      nextAction: eduopsCodePresentation_(row.nextAction, eduopsHumanize_(row.nextAction), row.worklistReason, "Actionability Resolver"),
      coolingOff: coolingPresentation,
      route: eduopsCodePresentation_(eduopsPrimaryRouteForRow_(row), eduopsPrimaryRouteForRow_(row), "", "Actionability Resolver"),
      owner: eduopsCodePresentation_(row.actionOwner, eduopsHumanize_(row.actionOwner), "", "Actionability Resolver"),
      urgency: eduopsCodePresentation_(row.urgencyLevel, eduopsHumanize_(row.urgencyLevel), row.urgencyReason, "Actionability Resolver"),
      workScope: eduopsCodePresentation_(eduopsWorkScope_(row), eduopsHumanize_(eduopsWorkScope_(row)), "", "EduOps workload query service"),
      lifecycle: eduopsCodePresentation_(lifecycleState, row.canonicalLifecycle && row.canonicalLifecycle.label || eduopsHumanize_(lifecycleState), row.canonicalLifecycle && row.canonicalLifecycle.reason || "", "Canonical Lifecycle Resolver"),
      finance: eduopsCodePresentation_(authorityState.canonicalFinanceState, eduopsHumanize_(authorityState.canonicalFinanceState), row.explanation, "Finance authority"),
      documents: eduopsCodePresentation_(authorityState.documentState, eduopsHumanize_(authorityState.documentState), "", "Document authority"),
      contactability: eduopsCodePresentation_(authorityState.contactabilityState, eduopsHumanize_(authorityState.contactabilityState), "", "Contactability authority"),
      reliability: reliabilityPresentation
    },
    authorityDecision: {
      schemaVersion: "EDUOPS_ROW_AUTHORITY_DECISION_V1",
      authoritySource: "Actionability Resolver",
      evaluatedApplicantId: eduopsClean_(row.applicantId || ""),
      snapshotId: snapshotId,
      snapshotAsOf: sourceReliability.asOf || "",
      state: row.actionabilityState,
      reasonCode: eduopsClean_(row.reasonCode || ""),
      reason: eduopsClean_(row.selectBlockReason || row.communicationProgressDetail || row.explanation || ""),
      actionAvailable: row.selectable === true && sourceReliability.state !== "CONFLICTING",
      stale: sourceReliability.state === "STALE",
      expiryAt: eduopsClean_(row.coolingOffUntil || "")
    },
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
    presentation: dto.presentation,
    authorityDecision: dto.authorityDecision,
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
    schemaVersion: "EDUOPS_APPLICANT_WORKBENCH_V2",
    authoritySource: "Canonical applicant authorities",
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
  var state = eduopsClean_(docs.state || "");
  return {
    schemaVersion: "EDUOPS_DOCUMENT_AUTHORITY_V1",
    authoritySource: "Document authority",
    available: !!state,
    reasonCode: state ? "DOCUMENT_STATE_RETURNED" : "BACKEND_CONTRACT_MISSING",
    reason: state ? eduopsClean_(docs.reason || "Canonical document state returned.") : "Authoritative document state was not returned. Refresh or retry before continuing.",
    state: state,
    presentation: eduopsCodePresentation_(state, eduopsHumanize_(state), docs.reason, "Document authority"),
    verified: docs.verified === true,
    requiredComplete: docs.requiredComplete === true,
    uploadedRequiredCount: Number(docs.uploadedRequiredCount || 0),
    requiredCount: Number(docs.requiredCount || 0),
    missingRequiredDocuments: Array.isArray(docs.missingRequiredDocuments) ? docs.missingRequiredDocuments.slice() : []
  };
}

function eduopsFinanceSummary_(canonical) {
  var finance = canonical && canonical.finance && canonical.finance.financeAuthority || {};
  var state = eduopsClean_(finance.financeState || "");
  return {
    schemaVersion: "EDUOPS_FINANCE_AUTHORITY_V1",
    authoritySource: "Finance authority",
    available: !!state,
    reasonCode: state ? "FINANCE_STATE_RETURNED" : "BACKEND_CONTRACT_MISSING",
    reason: state ? eduopsClean_(finance.financeReason || "Canonical finance state returned.") : "Authoritative finance decision was not returned. Refresh or retry before continuing.",
    state: state,
    presentation: eduopsCodePresentation_(state, eduopsHumanize_(state), finance.financeReason, "Finance authority"),
    paymentApplicable: finance.paymentApplicable === true,
    paymentEvidencePresent: finance.paymentEvidencePresent === true,
    paymentVerified: finance.paymentVerified === true,
    owner: eduopsClean_(canonical && canonical.owner || ""),
    blocker: eduopsClean_(finance.financeReason || ""),
    nextAction: eduopsClean_(canonical && canonical.actionability && canonical.actionability.nextAction || ""),
    nextActionDate: eduopsClean_(canonical && canonical.actionability && canonical.actionability.nextActionDate || canonical && canonical.actionability && canonical.actionability.coolingOffUntil || ""),
    invoiceReadiness: eduopsClean_(finance.invoiceReadiness || finance.invoiceStatus || ""),
    booksMatch: eduopsClean_(finance.booksMatch || finance.booksStatus || "")
  };
}

function eduopsCommunicationsSummary_(canonical) {
  var comm = canonical && canonical.communication || {};
  var actionability = canonical && canonical.actionability || {};
  return {
    schemaVersion: "EDUOPS_COMMUNICATION_SUMMARY_V1",
    authoritySource: "Communication Authority",
    recommendedMessageType: eduopsClean_(actionability.recommendedMessageType || comm.recommendedMessageType || ""),
    eligibility: eduopsClean_(comm.authorityResult || actionability.communicationProgress || ""),
    coolingOffUntil: eduopsClean_(actionability.coolingOffUntil || ""),
    latestCommunication: eduopsClean_(comm.latestCommunicationAt || ""),
    deliveryState: eduopsClean_(comm.deliveryState || ""),
    suppressionState: eduopsClean_(comm.suppressionState || comm.bounceState || "")
  };
}

function eduopsPortalSummary_(canonical) {
  var portal = canonical && canonical.portal || {};
  var hasContract = !!eduopsClean_(portal.accessState || portal.state || "");
  return {
    schemaVersion: "EDUOPS_PORTAL_AUTHORITY_V1",
    authoritySource: hasContract ? "Portal Access Domain" : "",
    available: hasContract,
    reasonCode: hasContract ? "PORTAL_STATE_RETURNED" : "BACKEND_CONTRACT_MISSING",
    reason: hasContract ? eduopsClean_(portal.reason || "Portal Access Domain state returned.") : "Authoritative portal-access decision was not returned. Refresh or retry before continuing.",
    submitted: portal.submitted === true,
    accessState: eduopsClean_(portal.accessState || ""),
    locked: portal.locked === true,
    tokenState: eduopsClean_(portal.tokenState || ""),
    expiresAt: eduopsClean_(portal.expiresAt || ""),
    availableActions: []
  };
}

function eduopsContactabilitySummary_(canonical) {
  var c = canonical && canonical.contactability || {};
  var applicant = canonical && canonical.applicant || {};
  return {
    schemaVersion: "EDUOPS_CONTACTABILITY_AUTHORITY_V1",
    authoritySource: "Contactability authority",
    available: !!eduopsClean_(c.state || ""),
    reasonCode: c.state ? "CONTACTABILITY_STATE_RETURNED" : "BACKEND_CONTRACT_MISSING",
    reason: c.state ? eduopsClean_(c.reason || "Canonical contactability state returned.") : "Authoritative contactability decision was not returned. Refresh or retry before continuing.",
    state: eduopsClean_(c.state || ""),
    presentation: eduopsCodePresentation_(c.state, eduopsHumanize_(c.state), c.reason, "Contactability authority"),
    effectiveEmail: eduopsClean_(applicant.effectiveEmail || applicant.email || ""),
    emailSource: eduopsClean_(c.emailSource || applicant.emailSource || ""),
    phone: eduopsClean_(applicant.phone || ""),
    hasValidEmail: c.hasValidEmail === true,
    hasPhoneFallback: c.hasPhoneFallback === true,
    suppressionState: eduopsClean_(c.suppressionState || c.bounceState || "")
  };
}

function eduopsAuditSummary_(canonical) {
  return {
    schemaVersion: "EDUOPS_AUDIT_SUMMARY_V1",
    authoritySource: "Audit/history services",
    provenance: canonical && canonical.diagnostics || {},
    readOnly: true,
    note: "Audit facts and EduOps command receipts are projected separately."
  };
}
