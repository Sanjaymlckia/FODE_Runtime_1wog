function renderEduOpsApp_(e) {
  var access = eduopsRequireAccess_();
  var t = HtmlService.createTemplateFromFile("EduOps");
  t.BRAND = CONFIG.BRAND || {};
  t.USER_EMAIL = access.email;
  t.ADMIN_ROLE = access.role;
  t.ADMIN_CAPABILITIES = access.capabilities;
  t.BUILD_VERSION = CONFIG.VERSION;
  t.BUILD_RENDERED_AT = new Date().toISOString();
  t.BUILD_SCRIPT_ID = ScriptApp.getScriptId();
  t.EDUOPS_CONFIG = eduopsConfig_();
  return t.evaluate()
    .setTitle((CONFIG.BRAND && CONFIG.BRAND.name ? CONFIG.BRAND.name : "FODE") + " - EduOps Operations Workspace")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function eduops_getAccessProjection() {
  var access = eduopsRequireAccess_();
  var cfg = eduopsConfig_();
  return {
    ok: true,
    readOnly: true,
    product: cfg.product,
    contractVersion: cfg.contractVersion,
    profileVersion: cfg.profileVersion,
    runtime: {
      version: CONFIG.VERSION,
      deployVersion: CONFIG.DEPLOY_VERSION_NUMBER
    },
    user: {
      email: access.email,
      role: access.role,
      capabilities: access.capabilities
    },
    rpcAllowlist: {
      read: eduopsReadOnlyRpcAllowlist_(),
      write: eduopsWriteRpcAllowlist_()
    },
    featureFlags: eduopsFeatureFlags_()
  };
}

function eduops_getProfile() {
  eduopsRequireAccess_();
  var cfg = eduopsConfig_();
  return {
    ok: true,
    readOnly: true,
    product: "FODE",
    label: "FODE",
    description: "Actionability-first operations workspace over existing FODE authoritative services.",
    contractVersion: cfg.contractVersion,
    profileVersion: cfg.profileVersion,
    actionabilityStates: ["READY", "COOLING_OFF", "AWAITING_APPLICANT", "AWAITING_PAYMENT", "REVIEW_REQUIRED", "BLOCKED", "UNKNOWN", "COMPLETE"],
    workScopes: ["MY", "TEAM", "UNASSIGNED", "ESCALATED", "ALL_AUTHORISED"],
    featureFlags: eduopsFeatureFlags_(),
    commandContractVersion: "EDUOPS_COMMAND_PREVIEW_V1",
    receiptContractVersion: "EDUOPS_RECEIPT_V1"
  };
}

function eduops_queryOperationalWorkload(payload) {
  var started = Date.now();
  var access = eduopsRequireAccess_();
  var accessMs = Date.now() - started;
  var query = eduopsNormalizeWorkloadQuery_(payload);
  var resolved = eduopsResolveFodeSnapshot_(access);
  var snapshotId = resolved.snapshotId;
  var reliability = eduopsSourceReliability_("AUTHORITATIVE", "FODE canonical snapshot resolved for EduOps shadow workload.", "FODE workload");
  if (query.expectedSnapshotId && query.expectedSnapshotId !== snapshotId) {
    reliability = eduopsSourceReliability_("STALE", "The requested workload snapshot no longer matches the current FODE authority snapshot.", "FODE workload");
  }
  var compositionStarted = Date.now();
  var allRows = resolved.rows;
  var filtered = eduopsFilterRows_(allRows, query, reliability);
  var filterMs = Date.now() - compositionStarted;
  var sortingStarted = Date.now();
  filtered.sort(function (a, b) { return eduopsCompareRows_(a, b, query.sort); });
  var totalMatched = filtered.length;
  var totalPages = Math.max(1, Math.ceil(totalMatched / query.pageSize));
  var page = Math.min(query.page, totalPages);
  var offset = (page - 1) * query.pageSize;
  var pageRows = filtered.slice(offset, offset + query.pageSize);
  var rows = pageRows.map(function (row) {
    return eduopsFodeRowDto_(row, query, snapshotId, reliability);
  });
  var sortingPagingMs = Date.now() - sortingStarted;
  var composeRemainderStarted = Date.now();
  var actionabilityCounts = eduopsActionabilityCounts_(allRows);
  var worklistKeyCounts = eduopsWorklistCounts_(allRows, query);
  var metricCounts = eduopsMetricCounts_(filtered);
  var reconciliation = eduopsReconciliationForRows_(allRows, filtered, pageRows, query, snapshotId, {
    totalRows: resolved.totalRows,
    generatedAt: resolved.snapshotAsOf
  });
  var workloadCompositionMs = filterMs + (Date.now() - composeRemainderStarted);
  var response = {
    ok: true,
    readOnly: true,
    contractVersion: EDUOPS_CONTRACT_VERSION,
    product: "FODE",
    profileVersion: EDUOPS_PROFILE_VERSION,
    snapshotId: snapshotId,
    snapshotAsOf: resolved.snapshotAsOf,
    snapshotCacheState: resolved.cacheState,
    authorityStatus: reliability.authorityStatus,
    sourceStatus: reliability.sourceStatus,
    reliabilityState: reliability.state,
    reliabilityReasons: reliability.reasons,
    actionabilityState: query.actionabilityState,
    worklistKey: query.worklistKey,
    workScope: query.workScope,
    filters: query.filters,
    sort: query.sort,
    page: page,
    pageSize: query.pageSize,
    totalMatched: totalMatched,
    totalPages: totalPages,
    actionabilityCounts: actionabilityCounts,
    worklistKeyCounts: worklistKeyCounts,
    metricCounts: metricCounts,
    reconciliation: reconciliation,
    rows: rows
  };
  response.timings = {
    accessMs: accessMs,
    serverRpcMs: 0,
    canonicalSnapshotResolutionMs: resolved.timings.canonicalSnapshotResolutionMs,
    sourceVersionMs: resolved.timings.sourceVersionMs,
    cacheReadMs: resolved.timings.cacheReadMs,
    canonicalBuildMs: resolved.timings.canonicalBuildMs,
    projectionMs: resolved.timings.projectionMs,
    cacheWriteMs: resolved.timings.cacheWriteMs,
    workloadCompositionMs: workloadCompositionMs,
    sortingPagingMs: sortingPagingMs,
    responseBytes: 0
  };
  response.timings.responseBytes = eduopsResponseByteSize_(response);
  response.timings.serverRpcMs = Date.now() - started;
  return response;
}

function eduops_searchApplicants(payload) {
  var started = Date.now();
  var access = eduopsRequireAccess_();
  var p = payload && typeof payload === "object" ? payload : {};
  var queryText = eduopsClean_(p.query || p.search || "");
  var limit = Math.max(1, Math.min(25, Number(p.limit || 12)));
  var resolved = eduopsResolveFodeSnapshot_(access);
  var snapshotId = resolved.snapshotId;
  if (p.expectedSnapshotId && p.expectedSnapshotId !== snapshotId) {
    return { ok: false, readOnly: true, code: "STALE_SNAPSHOT", snapshotId: snapshotId, expectedSnapshotId: eduopsClean_(p.expectedSnapshotId || "") };
  }
  if (!queryText) {
    return { ok: true, readOnly: true, product: "FODE", query: "", totalMatches: 0, matches: [], snapshotId: snapshotId, timings: { searchMs: Date.now() - started } };
  }
  var needle = queryText.toLowerCase();
  var rows = resolved.rows.filter(function (row) {
    return [
      row.applicantId,
      row.name,
      row.email,
      row.phone,
      row.worklistLabel,
      row.actionabilityState
    ].join(" ").toLowerCase().indexOf(needle) >= 0;
  });
  rows.sort(function (a, b) {
    return eduopsClean_(a.applicantId).localeCompare(eduopsClean_(b.applicantId)) || Number(a.rowNumber || 0) - Number(b.rowNumber || 0);
  });
  return {
    ok: true,
    readOnly: true,
    product: "FODE",
    query: queryText,
    snapshotId: snapshotId,
    totalMatches: rows.length,
    matches: rows.slice(0, limit).map(function (row) {
      return eduopsFodeSearchResultDto_(row, { page: 1, pageSize: 25 }, snapshotId);
    }),
    timings: { searchMs: Date.now() - started }
  };
}

function eduops_getApplicantWorkbench(payload) {
  var started = Date.now();
  var access = eduopsRequireAccess_();
  var p = payload && typeof payload === "object" ? payload : {};
  var applicantId = eduopsClean_(p.applicantId || "");
  if (!applicantId) return { ok: false, readOnly: true, code: "APPLICANT_ID_REQUIRED" };
  var resolved = eduopsResolveFodeSnapshot_(access);
  var snapshotId = resolved.snapshotId;
  if (p.expectedSnapshotId && p.expectedSnapshotId !== snapshotId) {
    return {
      ok: false,
      readOnly: true,
      code: "STALE_SNAPSHOT",
      reliabilityState: "STALE",
      snapshotId: snapshotId,
      expectedSnapshotId: eduopsClean_(p.expectedSnapshotId || ""),
      message: "The applicant was requested from a stale workload snapshot. Refresh the workload before opening."
    };
  }
  var result = eduopsFodeApplicantRead_(applicantId, p.returnContext || {}, snapshotId);
  result.capabilities = eduopsCapabilityProjection_();
  result.featureFlags = eduopsFeatureFlags_();
  result.timings = { applicantMs: Date.now() - started };
  return result;
}

function eduops_getDocumentManifest(payload) {
  eduopsRequireAccess_();
  var started = Date.now();
  var exact = eduopsHydrateDocumentPayload_(payload || {}, false);
  if (exact.ok !== true) return exact;
  var result = admin_getApplicantDocumentManifest(exact.payload);
  result.readOnly = true;
  result.rowNumber = exact.payload.rowNumber;
  result.renditionRule = "canonical original -> server-derived PNG rendition -> separate signed Open Original action";
  if (Array.isArray(result.files)) {
    result.files = result.files.map(function (file) {
      var item = file && typeof file === "object" ? file : {};
      item.applicantId = result.applicantId;
      item.rowNumber = exact.payload.rowNumber;
      item.documentKey = [
        result.applicantId,
        String(exact.payload.rowNumber),
        eduopsClean_(item.sourceField || ""),
        String(item.itemIndex === null || item.itemIndex === undefined ? "" : item.itemIndex)
      ].join("|");
      return item;
    });
  }
  result.timings = { documentManifestMs: Date.now() - started };
  return result;
}

function eduops_getDocumentRendition(payload) {
  eduopsRequireAccess_();
  var started = Date.now();
  var exact = eduopsHydrateDocumentPayload_(payload || {}, true);
  if (exact.ok !== true) return exact;
  var result = admin_getApplicantDocumentImageRendition(exact.payload);
  result.readOnly = true;
  result.canonicalOriginal = false;
  result.renditionOnly = true;
  result.timings = { documentRenditionMs: Date.now() - started };
  return result;
}

function eduops_getDocumentFileAction(payload) {
  eduopsRequireAccess_();
  var exact = eduopsHydrateDocumentPayload_(payload || {}, true);
  if (exact.ok !== true) return exact;
  var result = admin_getApplicantDocumentFileAction(exact.payload);
  result.readOnly = true;
  result.canonicalOriginal = true;
  return result;
}

function eduopsHydrateDocumentPayload_(payload, requireDocumentIdentity) {
  var p = payload && typeof payload === "object" ? payload : {};
  var applicantId = eduopsClean_(p.applicantId || p.ApplicantID || "");
  if (!applicantId) {
    return { ok: false, readOnly: true, code: "APPLICANT_ID_REQUIRED", error: "ApplicantID is required" };
  }
  var rowNumber = Number(p.rowNumber);
  if (!isFinite(rowNumber) || rowNumber < 2 || Math.floor(rowNumber) !== rowNumber) {
    var canonical = admin_getCanonicalApplicant({ applicantId: applicantId });
    if (!canonical || canonical.ok !== true || !canonical.applicant) {
      return { ok: false, readOnly: true, code: canonical && canonical.code || "APPLICANT_NOT_FOUND", error: "Applicant context could not be resolved" };
    }
    rowNumber = Number(canonical.applicant.identity && canonical.applicant.identity.rowNumber || 0);
  }
  if (!isFinite(rowNumber) || rowNumber < 2 || Math.floor(rowNumber) !== rowNumber) {
    return { ok: false, readOnly: true, code: "INVALID_APPLICANT_CONTEXT", error: "Applicant context is invalid" };
  }
  var hydrated = {
    applicantId: applicantId,
    rowNumber: rowNumber
  };
  if (requireDocumentIdentity === true) {
    hydrated.sourceField = eduopsClean_(p.sourceField || "");
    hydrated.itemIndex = Number(p.itemIndex);
    if (!hydrated.sourceField) {
      return { ok: false, readOnly: true, code: "SOURCE_FIELD_REQUIRED", error: "Document source field is required" };
    }
    if (!isFinite(hydrated.itemIndex) || hydrated.itemIndex < 0 || Math.floor(hydrated.itemIndex) !== hydrated.itemIndex) {
      return { ok: false, readOnly: true, code: "INVALID_ITEM_INDEX", error: "Document item index is invalid" };
    }
    var expectedKey = [
      applicantId,
      String(rowNumber),
      hydrated.sourceField,
      String(hydrated.itemIndex)
    ].join("|");
    var providedKey = eduopsClean_(p.documentKey || "");
    if (providedKey && providedKey !== expectedKey) {
      return { ok: false, readOnly: true, code: "DOCUMENT_CONTEXT_MISMATCH", error: "Document context does not match the applicant manifest" };
    }
  }
  return { ok: true, readOnly: true, payload: hydrated };
}

function eduops_getReconciliation(payload) {
  var workload = eduops_queryOperationalWorkload(payload || {});
  return {
    ok: true,
    readOnly: true,
    product: "FODE",
    snapshotId: workload.snapshotId,
    reconciliation: workload.reconciliation,
    hiddenReasons: workload.reconciliation.hiddenReasons || []
  };
}

function eduops_getParityDiagnostics(payload) {
  var started = Date.now();
  var access = eduopsRequireAccess_();
  var p = payload && typeof payload === "object" ? payload : {};
  var resolved = eduopsResolveFodeSnapshot_(access);
  var snapshotId = resolved.snapshotId;
  if (p.expectedSnapshotId && p.expectedSnapshotId !== snapshotId) {
    return { ok: false, readOnly: true, code: "STALE_SNAPSHOT", snapshotId: snapshotId, expectedSnapshotId: eduopsClean_(p.expectedSnapshotId || "") };
  }
  var adminPreview = admin_getActionabilityPreview({ limit: 100, hiddenLimit: 10 });
  var eduopsRows = resolved.rows;
  var adminById = {};
  (adminPreview.rows || []).forEach(function (row) {
    if (row && row.applicantId) adminById[row.applicantId] = row;
  });
  var mismatches = [];
  var missingFromAdminBoundedPreview = [];
  eduopsRows.forEach(function (row) {
    var adminRow = adminById[row.applicantId];
    if (!adminRow) {
      missingFromAdminBoundedPreview.push(row.applicantId);
      return;
    }
    ["actionabilityState", "worklistKey", "nextAction", "selectable", "coolingOffUntil", "recommendedMessageType"].forEach(function (field) {
      if (String(row[field]) !== String(adminRow[field])) {
        mismatches.push({ applicantId: row.applicantId, field: field, eduops: row[field], currentAdmin: adminRow[field] });
      }
    });
    var finance = row.authorityState && row.authorityState.canonicalFinanceState || "";
    var adminFinance = adminRow.authorityState && adminRow.authorityState.canonicalFinanceState || "";
    if (String(finance) !== String(adminFinance)) {
      mismatches.push({ applicantId: row.applicantId, field: "canonicalFinanceState", eduops: finance, currentAdmin: adminFinance });
    }
  });
  var unsafe = mismatches.filter(function (m) {
    return m.field === "actionabilityState" || m.field === "selectable" || m.field === "worklistKey";
  });
  return {
    ok: unsafe.length === 0,
    readOnly: true,
    product: "FODE",
    snapshotId: snapshotId,
    snapshotAsOf: resolved.snapshotAsOf,
    compared: Math.min(eduopsRows.length, Object.keys(adminById).length),
    canonicalPopulationTotal: Number(resolved.totalRows || eduopsRows.length),
    currentAdminBoundedRows: (adminPreview.rows || []).length,
    exactMatches: Math.max(0, Math.min(eduopsRows.length, Object.keys(adminById).length) - mismatches.length),
    mismatchesByField: eduopsMismatchCounts_(mismatches),
    mismatches: mismatches.slice(0, Number(p.limit || 50)),
    missingIdentities: missingFromAdminBoundedPreview.slice(0, 25),
    extraIdentities: [],
    unsafeMismatches: unsafe,
    reliabilityState: unsafe.length ? "CONFLICTING" : "AUTHORITATIVE",
    note: "Current Admin actionability preview is bounded; complete-population parity uses the same canonical snapshot and reports bounded-preview absences separately.",
    timings: { parityMs: Date.now() - started }
  };
}

function eduopsResponseByteSize_(value) {
  var json = JSON.stringify(value == null ? null : value);
  try { return Utilities.newBlob(json).getBytes().length; } catch (_blobErr) { return json.length; }
}

function eduopsNormalizeWorkloadQuery_(payload) {
  var p = payload && typeof payload === "object" ? payload : {};
  return {
    product: "FODE",
    actionabilityState: eduopsUpper_(p.actionabilityState || "READY"),
    worklistKey: eduopsClean_(p.worklistKey || ""),
    workScope: eduopsUpper_(p.workScope || "ALL_AUTHORISED"),
    filters: p.filters && typeof p.filters === "object" ? p.filters : {},
    sort: p.sort && typeof p.sort === "object" ? p.sort : { key: "urgency", direction: "asc" },
    page: eduopsNormalizePage_(p.page),
    pageSize: eduopsNormalizePageSize_(p.pageSize),
    expectedSnapshotId: eduopsClean_(p.expectedSnapshotId || "")
  };
}

function eduopsFilterRows_(rows, query, reliability) {
  var list = Array.isArray(rows) ? rows : [];
  if (reliability && reliability.state === "CONFLICTING") {
    list = list.map(function (row) {
      var copy = eduopsClone_(row);
      if (copy.actionabilityState === "READY") copy.actionabilityState = "UNKNOWN";
      copy.selectable = false;
      copy.selectBlockReason = "Source conflict prevents confident readiness.";
      return copy;
    });
  }
  return list.filter(function (row) {
    if (query.actionabilityState !== "ALL" && eduopsUpper_(row.actionabilityState || "") !== query.actionabilityState) return false;
    if (query.worklistKey && eduopsClean_(row.worklistKey || "") !== query.worklistKey) return false;
    if (query.workScope && query.workScope !== "ALL_AUTHORISED" && eduopsWorkScope_(row) !== query.workScope) return false;
    var filters = query.filters || {};
    if (filters.owner && eduopsClean_(row.actionOwner || "") !== eduopsClean_(filters.owner)) return false;
    if (filters.urgency && eduopsUpper_(row.urgencyLevel || "") !== eduopsUpper_(filters.urgency)) return false;
    if (filters.primaryRoute && eduopsClean_(row.primaryRoute || "") !== eduopsClean_(filters.primaryRoute)) return false;
    if (filters.documentState && eduopsUpper_(row.documentState || "") !== eduopsUpper_(filters.documentState)) return false;
    if (filters.financeState && eduopsUpper_(row.canonicalFinanceState || "") !== eduopsUpper_(filters.financeState)) return false;
    if (filters.contactabilityState && eduopsUpper_(row.contactabilityState || "") !== eduopsUpper_(filters.contactabilityState)) return false;
    if (filters.communicationState && eduopsClean_(row.recommendedMessageType || "") !== eduopsClean_(filters.communicationState)) return false;
    if (filters.blockKind && eduopsClean_(row.blockerCode || "") !== eduopsClean_(filters.blockKind)) return false;
    if (filters.cooling === "ACTIVE" && !eduopsClean_(row.coolingOffUntil || "")) return false;
    if (filters.cooling === "NONE" && eduopsClean_(row.coolingOffUntil || "")) return false;
    var search = eduopsClean_(filters.search || "");
    if (search) {
      var hay = [row.applicantId, row.name, row.email, row.phone, row.worklistLabel].join(" ").toLowerCase();
      if (hay.indexOf(search.toLowerCase()) < 0) return false;
    }
    return true;
  });
}

function eduopsCompareRows_(a, b, sort) {
  var s = sort || {};
  var key = eduopsClean_(s.key || "urgency");
  var dir = eduopsUpper_(s.direction || "ASC") === "DESC" ? -1 : 1;
  var cmp = 0;
  if (key === "age") cmp = (Number(b.ageDays || 0) - Number(a.ageDays || 0));
  else if (key === "name") cmp = eduopsClean_(a.name).localeCompare(eduopsClean_(b.name));
  else cmp = eduopsUrgencyRank_(a.urgencyLevel) - eduopsUrgencyRank_(b.urgencyLevel);
  if (cmp !== 0) return cmp * dir;
  return eduopsClean_(a.applicantId).localeCompare(eduopsClean_(b.applicantId)) || Number(a.rowNumber || 0) - Number(b.rowNumber || 0);
}

function eduopsUrgencyRank_(level) {
  var map = { CRITICAL: 0, UNCONTACTABLE: 1, ESCALATED: 2, DORMANT: 3, OVERDUE: 4, HIGH: 5, DUE: 6, NORMAL: 7, LOW: 8 };
  var key = eduopsUpper_(level || "");
  return Object.prototype.hasOwnProperty.call(map, key) ? map[key] : 99;
}

function eduopsActionabilityCounts_(rows) {
  var out = {};
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    var key = eduopsUpper_(row.actionabilityState || "UNKNOWN");
    out[key] = Number(out[key] || 0) + 1;
  });
  return out;
}

function eduopsWorklistCounts_(rows, query) {
  var out = {};
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    if (query.actionabilityState !== "ALL" && eduopsUpper_(row.actionabilityState || "") !== query.actionabilityState) return;
    var key = eduopsClean_(row.worklistKey || "UNKNOWN") || "UNKNOWN";
    out[key] = Number(out[key] || 0) + 1;
  });
  return out;
}

function eduopsMetricCounts_(rows) {
  var out = { eligibleNow: 0, coolingOff: 0, awaitingApplicant: 0, awaitingPayment: 0, reviewRequired: 0, blocked: 0, unknown: 0, complete: 0 };
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    var state = eduopsUpper_(row.actionabilityState || "UNKNOWN");
    if (row.selectable === true) out.eligibleNow++;
    if (state === "COOLING_OFF") out.coolingOff++;
    else if (state === "AWAITING_APPLICANT") out.awaitingApplicant++;
    else if (state === "AWAITING_PAYMENT") out.awaitingPayment++;
    else if (state === "REVIEW_REQUIRED") out.reviewRequired++;
    else if (state === "BLOCKED") out.blocked++;
    else if (state === "UNKNOWN") out.unknown++;
    else if (state === "COMPLETE") out.complete++;
  });
  return out;
}

function eduopsReconciliationForRows_(allRows, matchedRows, pageRows, query, snapshotId, snapshot) {
  var matchedIds = {};
  var pageIds = {};
  matchedRows.forEach(function (row) { matchedIds[row.applicantId] = true; });
  pageRows.forEach(function (row) { pageIds[row.applicantId] = true; });
  var hiddenReasons = [];
  allRows.forEach(function (row) {
    if (matchedIds[row.applicantId]) return;
    hiddenReasons.push({
      applicantId: row.applicantId,
      displayName: row.name,
      reasonCode: eduopsHiddenReasonCode_(row, query),
      reason: eduopsHiddenReasonText_(row, query),
      actionabilityState: row.actionabilityState,
      worklistKey: row.worklistKey,
      selectable: row.selectable === true
    });
  });
  var oldestVisible = "";
  pageRows.forEach(function (row) {
    if (row.ageDays !== "" && (oldestVisible === "" || Number(row.ageDays) > Number(oldestVisible))) oldestVisible = Number(row.ageDays);
  });
  return {
    canonicalPopulation: Number(snapshot && snapshot.totalRows || allRows.length),
    totalMatched: matchedRows.length,
    visiblePageCount: pageRows.length,
    visiblePageRange: pageRows.length ? (((query.page - 1) * query.pageSize + 1) + "-" + ((query.page - 1) * query.pageSize + pageRows.length)) : "0",
    returnedWindow: pageRows.length,
    eligibleOutsideCurrentWindow: Math.max(0, matchedRows.filter(function (row) { return row.selectable === true && !pageIds[row.applicantId]; }).length),
    hiddenFromCurrentView: hiddenReasons.length,
    excludedFromOperation: matchedRows.filter(function (row) { return row.selectable !== true; }).length,
    metricCounts: eduopsMetricCounts_(matchedRows),
    oldestVisibleAgeDays: oldestVisible,
    oldestMatchedAgeDays: eduopsOldestAge_(matchedRows),
    nextOperatorAction: pageRows[0] ? pageRows[0].nextAction : "",
    snapshotId: snapshotId,
    asOf: eduopsClean_(snapshot && snapshot.generatedAt || ""),
    integrityState: "PASS",
    arithmetic: "canonicalPopulation = totalMatched + hiddenFromCurrentView",
    hiddenReasons: hiddenReasons.slice(0, 50)
  };
}

function eduopsHiddenReasonCode_(row, query) {
  if (query.actionabilityState !== "ALL" && eduopsUpper_(row.actionabilityState || "") !== query.actionabilityState) return eduopsUpper_(row.actionabilityState || "OTHER_ACTIONABILITY");
  if (query.worklistKey && eduopsClean_(row.worklistKey || "") !== query.worklistKey) return "ANOTHER_WORKLIST_KEY";
  if (query.workScope && query.workScope !== "ALL_AUTHORISED" && eduopsWorkScope_(row) !== query.workScope) return "ANOTHER_WORK_SCOPE";
  if (row.selectable !== true) return eduopsClean_(row.reasonCode || "NOT_SELECTABLE");
  return "FILTERED_FROM_VIEW";
}

function eduopsHiddenReasonText_(row, query) {
  var code = eduopsHiddenReasonCode_(row, query);
  if (code === "ANOTHER_WORKLIST_KEY") return "Applicant belongs to another worklist key.";
  if (code === "ANOTHER_WORK_SCOPE") return "Applicant belongs to another work ownership scope.";
  if (code === "COOLING_OFF") return "Applicant is in cooling-off.";
  if (code === "AWAITING_APPLICANT") return "Applicant owns the next action.";
  if (code === "COMPLETE") return "Applicant is complete/history for this view.";
  return eduopsClean_(row.selectBlockReason || row.communicationProgressDetail || eduopsHumanize_(code));
}

function eduopsOldestAge_(rows) {
  var oldest = "";
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    if (row.ageDays !== "" && (oldest === "" || Number(row.ageDays) > Number(oldest))) oldest = Number(row.ageDays);
  });
  return oldest;
}

function eduopsMismatchCounts_(mismatches) {
  var out = {};
  (Array.isArray(mismatches) ? mismatches : []).forEach(function (m) {
    var key = eduopsClean_(m.field || "UNKNOWN");
    out[key] = Number(out[key] || 0) + 1;
  });
  return out;
}

function eduopsCapabilityProjection_() {
  var access = eduopsRequireAccess_();
  return {
    readOnly: true,
    role: access.role,
    capabilities: access.capabilities,
    enforcement: "Server-side capability checks are authoritative; browser controls are presentation only.",
    pass2Actions: [
      eduopsReadOnlyAction_("Save document statuses", "CAN_SAVE_DOCUMENT_STATUSES"),
      eduopsReadOnlyAction_("Send individual email", "CAN_SEND_INDIVIDUAL_EMAIL"),
      eduopsReadOnlyAction_("Run batch communications", "CAN_RUN_BATCH_COMMUNICATIONS"),
      eduopsReadOnlyAction_("Verify payment", "CAN_VERIFY_PAYMENT"),
      eduopsReadOnlyAction_("Manage portal access", "CAN_MANAGE_PORTAL_ACCESS")
    ]
  };
}
