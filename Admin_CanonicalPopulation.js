var CANONICAL_POPULATION_SCHEMA_VERSION = "CANONICAL_POPULATION_V1";

function canonicalPopulationClone_(value) {
  if (value === null || value === undefined) return value;
  if (Array.isArray(value)) return value.map(canonicalPopulationClone_);
  if (value instanceof Date) return value.toISOString();
  if (typeof value !== "object") return value;
  var out = {};
  Object.keys(value).forEach(function (key) {
    if (key.indexOf("_internal") === 0) return;
    out[key] = canonicalPopulationClone_(value[key]);
  });
  return out;
}

function canonicalPopulationCommunicationProjection_(rowObj, authorityRow, messageType, opts) {
  var row = rowObj || {};
  var actionability = authorityRow || {};
  var options = opts && typeof opts === "object" ? opts : {};
  var requestedType = clean_(messageType || actionability.recommendedMessageType || "").toLowerCase();
  var out = {
    recommendedMessageType: clean_(actionability.recommendedMessageType || "").toLowerCase(),
    requestedMessageType: requestedType,
    authorityEvaluated: false,
    deliveryGatesEvaluated: false,
    permitted: null,
    sendableNow: null,
    authoritySource: "",
    blockCode: "",
    blockReason: "",
    evaluationScope: requestedType ? "COMMUNICATION_AUTHORITY_MATRIX" : "NO_RECOMMENDATION"
  };
  if (!requestedType || typeof evaluateCommunicationAuthority_ !== "function") return out;

  var baseState = typeof deriveCommunicationState_ === "function"
    ? deriveCommunicationState_(row, requestedType, {
        applicantId: clean_(row.ApplicantID || ""),
        cooldownLookup: options.cooldownLookup || { byApplicantId: {} },
        nowMs: Number(options.nowMs || Date.now())
      }).base
    : null;
  var result = evaluateCommunicationAuthority_(row, requestedType, baseState, {
    canonicalLifecycle: actionability.canonicalLifecycle || null,
    actor: options.actor || { email: "", role: "", isAdmin: true, isSuper: false }
  });
  var diagnostics = result && result.canonicalLifecycleAuthority || {};
  out.authorityEvaluated = true;
  out.permitted = result && result.ok === true;
  out.sendableNow = out.permitted === false ? false : null;
  out.authoritySource = clean_(diagnostics.authoritySource || "");
  out.blockCode = clean_(result && result.blockCode || "");
  out.blockReason = clean_(result && result.blockReason || "");
  return out;
}

function canonicalPopulationDisplayPhone_(rowObj) {
  var row = rowObj || {};
  if (typeof getWhatsAppFallbackPhoneRaw_ === "function") return clean_(getWhatsAppFallbackPhoneRaw_(row));
  return clean_(row.Phone || row.Phone_Number || row.WhatsApp_Number || "");
}

function canonicalPopulationFinanceProjection_(rowObj, authorityRow, rowNumber, sourceSheetName, lifecycleProjection, actionabilityProjection, communicationProjection) {
  var row = rowObj || {};
  var authority = authorityRow && authorityRow.authorityState || {};
  var lifecycle = lifecycleProjection || {};
  var actionability = actionabilityProjection || {};
  var communication = communicationProjection || {};
  var finance = resolveCanonicalFinance_(row, {
    identity: {
      applicantId: clean_(authorityRow && authorityRow.applicantId || row.ApplicantID || ""),
      rowNumber: Number(rowNumber || authorityRow && authorityRow.rowNumber || 0),
      sourceSheetName: clean_(sourceSheetName || ""),
      applicantName: clean_(authorityRow && authorityRow.name || "")
    },
    applicant: {
      name: clean_(authorityRow && authorityRow.name || "")
    },
    documents: {
      state: clean_(authority.documentState || ""),
      verified: authority.docsVerified === true,
      requiredComplete: authority.requiredDocumentUploadComplete === true
    },
    lifecycle: lifecycle,
    actionability: actionability,
    communication: communication,
    finance: {}
  }, {
    rowNumber: rowNumber,
    sourceSheetName: sourceSheetName
  });
  finance.state = clean_(finance.financeAuthority && finance.financeAuthority.financeState || "UNKNOWN");
  return finance;
}

function buildCanonicalPopulationRow_(rowObj, rowNumber, opts) {
  var row = rowObj || {};
  var options = opts && typeof opts === "object" ? opts : {};
  var authorityRow = options.authorityRow || buildActionabilityPreviewRow_(row, rowNumber);
  var applicantId = clean_(authorityRow.applicantId || row.ApplicantID || "");
  var lifecycle = authorityRow.canonicalLifecycle || {};
  var authorityState = authorityRow.authorityState || {};
  var communication = canonicalPopulationCommunicationProjection_(row, authorityRow, options.messageType, options);
  var actionability = {
    state: clean_(authorityRow.actionabilityState || "UNKNOWN").toUpperCase(),
    workloadGroupKey: clean_(authorityRow.workloadGroupKey || "UNKNOWN").toUpperCase(),
    worklistKey: clean_(authorityRow.worklistKey || ""),
    worklistLabel: clean_(authorityRow.worklistLabel || ""),
    worklistReason: clean_(authorityRow.worklistReason || ""),
    actionOwner: clean_(authorityRow.actionOwner || lifecycle.actionOwner || ""),
    nextAction: clean_(authorityRow.nextAction || ""),
    recommendedAction: clean_(authorityRow.recommendedAction || ""),
    recommendedMessageType: clean_(authorityRow.recommendedMessageType || ""),
    selectable: authorityRow.selectable === true,
    selectBlockReason: clean_(authorityRow.selectBlockReason || ""),
    reasonCode: clean_(authorityRow.reasonCode || ""),
    coolingOffUntil: clean_(authorityRow.coolingOffUntil || ""),
    suppressor: clean_(authorityRow.suppressor || ""),
    urgencyLevel: clean_(authorityRow.urgencyLevel || ""),
    urgencyReason: clean_(authorityRow.urgencyReason || ""),
    communicationProgress: clean_(authorityRow.communicationProgress || ""),
    communicationProgressDetail: clean_(authorityRow.communicationProgressDetail || ""),
    lastRelevantDate: clean_(authorityRow.lastRelevantDate || ""),
    lastRelevantDateSource: clean_(authorityRow.lastRelevantDateSource || ""),
    ageDays: authorityRow.ageDays === "" ? "" : Number(authorityRow.ageDays || 0),
    lastContactAgeDays: authorityRow.lastContactAgeDays === "" ? "" : Number(authorityRow.lastContactAgeDays || 0)
  };
  var finance = canonicalPopulationFinanceProjection_(row, authorityRow, rowNumber, options.sourceSheetName, {
    baseState: clean_(lifecycle.baseState || "UNKNOWN").toUpperCase(),
    lifecycleStage: clean_(lifecycle.lifecycleStage || lifecycle.baseState || "UNKNOWN").toUpperCase(),
    overlays: Array.isArray(lifecycle.overlays) ? lifecycle.overlays.slice() : [],
    recommendedNextAction: clean_(lifecycle.recommendedNextAction || ""),
    recommendedMessageType: clean_(lifecycle.recommendedMessageType || ""),
    actionOwner: clean_(lifecycle.actionOwner || ""),
    reason: clean_(lifecycle.reason || "")
  }, actionability, communication);
  return {
    schemaVersion: CANONICAL_POPULATION_SCHEMA_VERSION,
    identity: {
      applicantId: applicantId,
      rowNumber: Number(rowNumber || authorityRow.rowNumber || 0),
      sourceSheetName: clean_(options.sourceSheetName || ""),
      key: applicantId + "#" + String(Number(rowNumber || authorityRow.rowNumber || 0))
    },
    applicant: {
      name: clean_(authorityRow.name || ""),
      effectiveEmail: clean_(typeof stageAggregationEffectiveEmail_ === "function" ? stageAggregationEffectiveEmail_(row) : (row.Parent_Email_Corrected || row.Parent_Email || "")),
      phone: canonicalPopulationDisplayPhone_(row)
    },
    lifecycle: {
      baseState: clean_(lifecycle.baseState || "UNKNOWN").toUpperCase(),
      lifecycleStage: clean_(lifecycle.lifecycleStage || lifecycle.baseState || "UNKNOWN").toUpperCase(),
      overlays: Array.isArray(lifecycle.overlays) ? lifecycle.overlays.slice() : [],
      recommendedNextAction: clean_(lifecycle.recommendedNextAction || ""),
      recommendedMessageType: clean_(lifecycle.recommendedMessageType || ""),
      actionOwner: clean_(lifecycle.actionOwner || ""),
      reason: clean_(lifecycle.reason || "")
    },
    actionability: actionability,
    communication: communication,
    finance: finance,
    documents: {
      state: clean_(authorityState.documentState || "UNKNOWN"),
      requiredComplete: authorityState.requiredDocumentUploadComplete === true,
      uploadedRequiredCount: Number(authorityState.uploadedRequiredDocumentCount || 0),
      requiredCount: Number(authorityState.requiredDocumentCount || 0),
      missingRequiredDocuments: Array.isArray(authorityState.missingRequiredDocuments) ? authorityState.missingRequiredDocuments.slice() : [],
      verified: authorityState.docsVerified === true
    },
    contactability: {
      state: clean_(authorityState.contactabilityState || "UNKNOWN").toUpperCase(),
      hasValidEmail: authorityState.hasValidEmail === true,
      hasPhoneFallback: authorityState.hasPhoneFallback === true
    },
    owner: clean_(authorityRow.actionOwner || lifecycle.actionOwner || "UNKNOWN"),
    visibility: {
      hidden: authorityRow.actionabilityState === "COMPLETE",
      exception: clean_(authorityRow.workloadGroupKey || "").toUpperCase() === "CONTACTABILITY" || clean_(authorityRow.workloadGroupKey || "").toUpperCase() === "MANAGEMENT",
      hiddenReason: authorityRow.actionabilityState === "COMPLETE" ? "No current operator action." : ""
    },
    diagnostics: {
      lifecycleMismatch: canonicalPopulationClone_(authorityRow.lifecycleMismatch || {}),
      legacyLifecycleStage: clean_(authorityRow.authorityState && authorityRow.authorityState.lifecycleStage || ""),
      sourceAuthorities: Array.isArray(authorityRow.sourceAuthorities) ? authorityRow.sourceAuthorities.slice() : [],
      stageBatchClassification: "COMPATIBILITY_NOT_EVALUATED"
    },
    extensions: {
      registry: { status: "NOT_RESOLVED", authority: "FUTURE_REGISTRY_EXTENSION" },
      classroom: { status: "NOT_RESOLVED", authority: "FUTURE_CLASSROOM_EXTENSION" },
      approval: { status: "NOT_IMPLEMENTED", authority: "FUTURE_H2_EXTENSION" }
    }
  };
}

function canonicalPopulationCountBy_(rows, selector) {
  var out = {};
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    var key = clean_(selector(row) || "UNKNOWN").toUpperCase() || "UNKNOWN";
    out[key] = Number(out[key] || 0) + 1;
  });
  return out;
}

function canonicalPopulationSumCounts_(counts) {
  return Object.keys(counts || {}).reduce(function (sum, key) {
    return sum + Number(counts[key] || 0);
  }, 0);
}

function canonicalPopulationReconciliation_(rows, ledger, workingViewRows) {
  var list = Array.isArray(rows) ? rows : [];
  var working = Array.isArray(workingViewRows) ? workingViewRows : [];
  var lifecycleCounts = canonicalPopulationCountBy_(list, function (row) { return row.lifecycle.baseState; });
  var actionabilityCounts = canonicalPopulationCountBy_(list, function (row) { return row.actionability.state; });
  var financeCounts = canonicalPopulationCountBy_(list, function (row) { return row.finance.state; });
  var ids = {};
  var duplicateIds = [];
  list.forEach(function (row) {
    var id = clean_(row.identity.applicantId || "");
    if (ids[id]) duplicateIds.push(id);
    ids[id] = true;
  });
  var populationKeys = {};
  list.forEach(function (row) { populationKeys[clean_(row.identity.key || "")] = true; });
  var workingViewOutsidePopulation = working.filter(function (row) {
    return !populationKeys[clean_(row.identity && row.identity.key || "")];
  }).map(function (row) { return clean_(row.identity && row.identity.applicantId || ""); });
  var ledgerCount = Number(ledger && ledger.applicantIdRows || 0);
  var checks = {
    populationCountMatchesLedger: list.length === ledgerCount,
    lifecycleTotalsReconcile: canonicalPopulationSumCounts_(lifecycleCounts) === list.length,
    actionabilityTotalsReconcile: canonicalPopulationSumCounts_(actionabilityCounts) === list.length,
    financeTotalsReconcile: canonicalPopulationSumCounts_(financeCounts) === list.length,
    uniqueApplicantIds: duplicateIds.length === 0,
    workingViewIsSubset: workingViewOutsidePopulation.length === 0,
    opsDependencyPresent: false
  };
  return {
    status: Object.keys(checks).every(function (key) { return checks[key] === true || (key === "opsDependencyPresent" && checks[key] === false); }) ? "PASS" : "FAIL",
    checks: checks,
    populationRows: list.length,
    ledgerApplicantRows: ledgerCount,
    lifecycleCounts: lifecycleCounts,
    actionabilityCounts: actionabilityCounts,
    financeCounts: financeCounts,
    ledgerLifecycleCounts: Object.assign({}, ledger && ledger.lifecycleCounts || {}),
    duplicateApplicantIds: duplicateIds,
    workingView: {
      returnedRows: working.length,
      outsideCanonicalPopulation: workingViewOutsidePopulation,
      subsetDefinition: "Existing Actionability priority ordering, bounded to the Working View limit."
    },
    stageBatch: {
      status: "COMPATIBILITY_DRIFT_NOT_FORCED",
      authority: "Communication Authority remains final send gate; Stage Batch cohort selection remains compatibility-only."
    }
  };
}

function buildCanonicalPopulationFromValues_(data, sourceSheetName, opts) {
  var options = opts && typeof opts === "object" ? opts : {};
  var headers = data && data[0] || [];
  var rows = [];
  var sourceRowsByRowNumber = {};
  var authorityRowsByRowNumber = {};
  var authorityRows = [];
  for (var r = 1; data && r < data.length; r++) {
    var rowObj = populationLedgerRowObjectFromValues_(headers, data[r] || []);
    if (!clean_(rowObj.ApplicantID || "")) continue;
    var rowNumber = r + 1;
    var authorityRow = buildActionabilityPreviewRow_(rowObj, rowNumber);
    authorityRowsByRowNumber[rowNumber] = authorityRow;
    authorityRows.push(authorityRow);
    sourceRowsByRowNumber[rowNumber] = rowObj;
    rows.push(buildCanonicalPopulationRow_(rowObj, rowNumber, {
      authorityRow: authorityRow,
      sourceSheetName: sourceSheetName,
      actor: options.actor,
      nowMs: options.nowMs
    }));
  }
  rows.sort(function (a, b) {
    var byId = clean_(a.identity.applicantId).localeCompare(clean_(b.identity.applicantId));
    return byId || Number(a.identity.rowNumber || 0) - Number(b.identity.rowNumber || 0);
  });
  var ledger = buildPopulationLedgerFromValues_(data, sourceSheetName, {
    includeEntries: false,
    authorityRowsByRowNumber: authorityRowsByRowNumber
  });
  var workingViewLimit = Math.max(1, Math.min(100, Number(options.workingViewLimit || 100)));
  authorityRows.sort(compareActionabilityPreviewRows_);
  var canonicalByKey = {};
  rows.forEach(function (row) { canonicalByKey[row.identity.key] = row; });
  var workingViewRows = authorityRows.slice(0, workingViewLimit).map(function (row) {
    return canonicalByKey[clean_(row.applicantId || "") + "#" + String(Number(row.rowNumber || 0))];
  }).filter(Boolean);
  return {
    ok: true,
    readOnly: true,
    schemaVersion: CANONICAL_POPULATION_SCHEMA_VERSION,
    generatedAt: new Date().toISOString(),
    sourceSheetName: clean_(sourceSheetName || ""),
    totalRows: rows.length,
    rows: rows,
    summary: {
      lifecycle: canonicalPopulationCountBy_(rows, function (row) { return row.lifecycle.baseState; }),
      actionability: canonicalPopulationCountBy_(rows, function (row) { return row.actionability.state; }),
      workloadGroups: canonicalPopulationCountBy_(rows, function (row) { return row.actionability.workloadGroupKey; }),
      finance: canonicalPopulationCountBy_(rows, function (row) { return row.finance.state; }),
      communication: canonicalPopulationCountBy_(rows, function (row) { return row.communication.recommendedMessageType || "NONE"; }),
      contactability: canonicalPopulationCountBy_(rows, function (row) { return row.contactability.state; })
    },
    populationLedger: populationLedgerPublicSummary_(ledger),
    reconciliation: canonicalPopulationReconciliation_(rows, ledger, workingViewRows),
    _internalSourceRowsByRowNumber: sourceRowsByRowNumber
  };
}

function canonicalPopulationArrayFilter_(actual, requested) {
  var wanted = Array.isArray(requested) ? requested : (requested ? [requested] : []);
  if (!wanted.length) return true;
  var normalizedActual = clean_(actual || "").toUpperCase();
  return wanted.some(function (value) { return clean_(value || "").toUpperCase() === normalizedActual; });
}

function canonicalPopulationRowMatchesFilters_(row, filters) {
  var f = filters && typeof filters === "object" ? filters : {};
  if (!canonicalPopulationArrayFilter_(row.lifecycle.baseState, f.lifecycleBaseStates || f.lifecycleBaseState)) return false;
  if (!canonicalPopulationArrayFilter_(row.actionability.state, f.actionabilityStates || f.actionabilityState)) return false;
  if (!canonicalPopulationArrayFilter_(row.actionability.workloadGroupKey, f.workloadGroupKeys || f.workloadGroupKey)) return false;
  if (!canonicalPopulationArrayFilter_(row.actionability.worklistKey, f.worklistKeys || f.worklistKey)) return false;
  if (!canonicalPopulationArrayFilter_(row.finance.state, f.financeStates || f.financeState)) return false;
  if (!canonicalPopulationArrayFilter_(row.contactability.state, f.contactabilityStates || f.contactabilityState)) return false;
  if (f.selectable === true && row.actionability.selectable !== true) return false;
  if (f.selectable === false && row.actionability.selectable === true) return false;
  if (f.coolingOff === true && row.actionability.state !== "COOLING_OFF") return false;
  if (f.coolingOff === false && row.actionability.state === "COOLING_OFF") return false;
  var overlays = Array.isArray(row.lifecycle.overlays) ? row.lifecycle.overlays.map(function (v) { return clean_(v).toUpperCase(); }) : [];
  var requestedOverlay = clean_(f.lifecycleOverlay || "").toUpperCase();
  if (requestedOverlay && overlays.indexOf(requestedOverlay) < 0) return false;
  return true;
}

function buildCanonicalCohort_(snapshot, request, opts) {
  var source = snapshot && typeof snapshot === "object" ? snapshot : { rows: [] };
  var p = request && typeof request === "object" ? request : {};
  var options = opts && typeof opts === "object" ? opts : {};
  var scope = clean_(p.scope || "FULL_POPULATION").toUpperCase();
  var selectedIds = [];
  var selected = {};
  (Array.isArray(p.applicantIds) ? p.applicantIds : []).forEach(function (value) {
    var id = clean_(value || "");
    if (!id || selected[id]) return;
    selected[id] = true;
    selectedIds.push(id);
  });
  var seenSelected = {};
  var included = [];
  var excluded = [];
  var blocked = [];
  var messageType = clean_(p.messageType || "").toLowerCase();

  (Array.isArray(source.rows) ? source.rows : []).forEach(function (row) {
    var id = clean_(row.identity && row.identity.applicantId || "");
    if (scope === "SELECTED" && !selected[id]) return;
    if (scope === "SELECTED") seenSelected[id] = true;
    if (!canonicalPopulationRowMatchesFilters_(row, p.filters)) {
      excluded.push({ row: row, reasonCode: "FILTER_MISMATCH", reason: "Applicant does not match the requested canonical cohort filters." });
      return;
    }
    var communication = row.communication;
    if (messageType) {
      var sourceRow = source._internalSourceRowsByRowNumber && source._internalSourceRowsByRowNumber[row.identity.rowNumber] || {};
      communication = canonicalPopulationCommunicationProjection_(sourceRow, {
        recommendedMessageType: row.communication.recommendedMessageType,
        canonicalLifecycle: row.lifecycle
      }, messageType, options);
      if (communication.permitted !== true) {
        blocked.push({ row: row, communication: communication, reasonCode: communication.blockCode || "COMMUNICATION_BLOCKED", reason: communication.blockReason || "Communication Authority blocked this applicant." });
        return;
      }
    }
    if (p.requireSelectable === true && row.actionability.selectable !== true) {
      blocked.push({ row: row, communication: communication, reasonCode: row.actionability.reasonCode || "NOT_SELECTABLE", reason: row.actionability.selectBlockReason || "Applicant is not selectable." });
      return;
    }
    included.push({ row: row, communication: communication });
  });

  function sortPartition(list) {
    list.sort(function (a, b) {
      return clean_(a.row.identity.applicantId).localeCompare(clean_(b.row.identity.applicantId)) || Number(a.row.identity.rowNumber || 0) - Number(b.row.identity.rowNumber || 0);
    });
  }
  sortPartition(included);
  sortPartition(excluded);
  sortPartition(blocked);
  var missingSelectedApplicantIds = selectedIds.filter(function (id) { return !seenSelected[id]; });
  var returnedIds = included.concat(excluded, blocked).map(function (item) { return item.row.identity.applicantId; });
  var scopeViolationIds = scope === "SELECTED" ? returnedIds.filter(function (id) { return !selected[id]; }) : [];
  return {
    ok: scopeViolationIds.length === 0,
    readOnly: true,
    schemaVersion: CANONICAL_POPULATION_SCHEMA_VERSION,
    scope: scope,
    requestedApplicantIds: selectedIds,
    missingSelectedApplicantIds: missingSelectedApplicantIds,
    scopeViolationIds: scopeViolationIds,
    messageType: messageType,
    counts: { included: included.length, excluded: excluded.length, blocked: blocked.length },
    included: included,
    excluded: excluded,
    blocked: blocked,
    approvalExtension: { status: "NOT_IMPLEMENTED", fingerprint: "", approvalId: "" }
  };
}

function canonicalPopulationSnapshot_() {
  var adminEmail = getCallerEmail_();
  if (!isAdmin_(adminEmail)) throw new Error("Access denied");
  var sheet = openDataSheet_();
  var data = sheet.getDataRange().getValues();
  var sourceSheetName = sheet && typeof sheet.getName === "function" ? sheet.getName() : "";
  return buildCanonicalPopulationFromValues_(data, sourceSheetName, {
    actor: typeof communicationGetActorInfo_ === "function" ? communicationGetActorInfo_({ actorEmail: adminEmail }) : null
  });
}

function canonicalPopulationPublicSnapshot_(snapshot, includeRows) {
  var out = canonicalPopulationClone_(snapshot || {});
  if (includeRows !== true) delete out.rows;
  return out;
}

function canonicalPopulationSearchIndex_(row) {
  var item = row || {};
  return clean_([
    item.identity && item.identity.applicantId || "",
    item.applicant && item.applicant.name || "",
    item.applicant && item.applicant.effectiveEmail || "",
    item.applicant && item.applicant.phone || "",
    item.lifecycle && item.lifecycle.baseState || "",
    item.actionability && item.actionability.state || "",
    item.actionability && item.actionability.worklistLabel || "",
    item.finance && item.finance.financeAuthority && item.finance.financeAuthority.financeState || ""
  ].join(" ").toLowerCase());
}

function canonicalPopulationSearchResultRow_(row) {
  var item = row || {};
  return {
    applicantId: clean_(item.identity && item.identity.applicantId || ""),
    rowNumber: Number(item.identity && item.identity.rowNumber || 0),
    name: clean_(item.applicant && item.applicant.name || ""),
    effectiveEmail: clean_(item.applicant && item.applicant.effectiveEmail || ""),
    phone: clean_(item.applicant && item.applicant.phone || ""),
    lifecycleBaseState: clean_(item.lifecycle && item.lifecycle.baseState || "UNKNOWN"),
    actionabilityState: clean_(item.actionability && item.actionability.state || "UNKNOWN"),
    worklistLabel: clean_(item.actionability && item.actionability.worklistLabel || ""),
    financeState: clean_(item.finance && item.finance.financeAuthority && item.finance.financeAuthority.financeState || "UNKNOWN"),
    selectable: item.actionability && item.actionability.selectable === true,
    recommendation: clean_(item.actionability && item.actionability.recommendedMessageType || item.actionability && item.actionability.nextAction || ""),
    reviewTarget: {
      applicantId: clean_(item.identity && item.identity.applicantId || ""),
      rowNumber: Number(item.identity && item.identity.rowNumber || 0)
    }
  };
}

function operationalRouteKeyFromCanonicalRow_(row) {
  var item = row || {};
  var groupKey = clean_(item.actionability && item.actionability.workloadGroupKey || "").toUpperCase();
  if (groupKey === "APPLICANT") return "APPLICANT_ACTION";
  if (groupKey === "ADMISSIONS") return "ADMISSIONS_REVIEW";
  if (groupKey === "FINANCE") return "FINANCE";
  if (groupKey === "ACADEMIC") return "ACADEMIC_ADMIN";
  if (groupKey === "CONTACTABILITY") return "CONTACTABILITY_EXCEPTIONS";
  if (groupKey === "MANAGEMENT") return "MANAGEMENT_EXCEPTIONS";
  if (groupKey === "DORMANT") return "DORMANT";
  if (groupKey === "COMPLETE") return "COMPLETED_NO_ACTION";
  return "UNKNOWN_UNCLASSIFIED";
}

function operationalRouteLabel_(routeKey) {
  var key = clean_(routeKey || "").toUpperCase();
  if (key === "APPLICANT_ACTION") return "Applicant Action";
  if (key === "ADMISSIONS_REVIEW") return "Admissions Review";
  if (key === "FINANCE") return "Finance";
  if (key === "ACADEMIC_ADMIN") return "Academic Administration";
  if (key === "CONTACTABILITY_EXCEPTIONS") return "Contactability Exceptions";
  if (key === "MANAGEMENT_EXCEPTIONS") return "Management Exceptions";
  if (key === "DORMANT") return "Dormant";
  if (key === "COMPLETED_NO_ACTION") return "Completed / No Action";
  return "Unknown / Unclassified";
}

function operationalRouteSearchIndex_(row) {
  var item = row || {};
  return clean_([
    item.applicantId || "",
    item.name || "",
    item.effectiveEmail || "",
    item.phone || "",
    item.routeKey || "",
    item.routeLabel || "",
    item.lifecycleBaseState || "",
    item.actionabilityState || "",
    item.worklistKey || "",
    item.worklistLabel || "",
    item.financeState || "",
    item.recommendedMessageType || "",
    item.selectBlockReason || ""
  ].join(" ").toLowerCase());
}

function operationalRouteRowFromCanonical_(row) {
  var item = row || {};
  var actionability = item.actionability || {};
  var lifecycle = item.lifecycle || {};
  var finance = item.finance && item.finance.financeAuthority || {};
  var routeKey = operationalRouteKeyFromCanonicalRow_(item);
  return {
    routeKey: routeKey,
    routeLabel: operationalRouteLabel_(routeKey),
    applicantId: clean_(item.identity && item.identity.applicantId || ""),
    rowNumber: Number(item.identity && item.identity.rowNumber || 0),
    name: clean_(item.applicant && item.applicant.name || ""),
    effectiveEmail: clean_(item.applicant && item.applicant.effectiveEmail || ""),
    phone: clean_(item.applicant && item.applicant.phone || ""),
    lifecycleBaseState: clean_(lifecycle.baseState || "UNKNOWN"),
    lifecycleStage: clean_(lifecycle.lifecycleStage || lifecycle.baseState || "UNKNOWN"),
    lifecycleReason: clean_(lifecycle.reason || ""),
    actionOwner: clean_(actionability.actionOwner || item.owner || lifecycle.actionOwner || ""),
    actionabilityState: clean_(actionability.state || "UNKNOWN"),
    selectable: actionability.selectable === true,
    selectBlockReason: clean_(actionability.selectBlockReason || ""),
    worklistKey: clean_(actionability.worklistKey || ""),
    worklistLabel: clean_(actionability.worklistLabel || ""),
    worklistReason: clean_(actionability.worklistReason || ""),
    nextAction: clean_(actionability.nextAction || ""),
    recommendedAction: clean_(actionability.recommendedAction || ""),
    recommendedMessageType: clean_(actionability.recommendedMessageType || ""),
    coolingOffUntil: clean_(actionability.coolingOffUntil || ""),
    urgencyLevel: clean_(actionability.urgencyLevel || ""),
    urgencyReason: clean_(actionability.urgencyReason || ""),
    communicationProgress: clean_(actionability.communicationProgress || ""),
    communicationProgressDetail: clean_(actionability.communicationProgressDetail || ""),
    lastRelevantDate: clean_(actionability.lastRelevantDate || ""),
    lastRelevantDateSource: clean_(actionability.lastRelevantDateSource || ""),
    ageDays: actionability.ageDays === "" ? "" : Number(actionability.ageDays || 0),
    lastContactAgeDays: actionability.lastContactAgeDays === "" ? "" : Number(actionability.lastContactAgeDays || 0),
    financeState: clean_(finance.financeState || "UNKNOWN"),
    financeApplicable: finance.paymentApplicable === true,
    activeFinanceWork: finance.activeFinanceWork === true,
    financeReasonCode: clean_(finance.financeReasonCode || ""),
    financeReason: clean_(finance.financeReason || ""),
    paymentEvidencePresent: finance.paymentEvidencePresent === true,
    paymentVerified: finance.paymentVerified === true,
    financeExceptionCode: clean_(item.finance && item.finance.exceptions && item.finance.exceptions.financeExceptionCode || ""),
    contactabilityState: clean_(item.contactability && item.contactability.state || "UNKNOWN"),
    reviewTarget: {
      applicantId: clean_(item.identity && item.identity.applicantId || ""),
      rowNumber: Number(item.identity && item.identity.rowNumber || 0),
      originRoute: routeKey,
      returnRoute: routeKey
    },
    diagnostics: {
      lifecycleMismatch: canonicalPopulationClone_(item.diagnostics && item.diagnostics.lifecycleMismatch || {})
    },
    searchIndex: operationalRouteSearchIndex_({
      applicantId: item.identity && item.identity.applicantId || "",
      name: item.applicant && item.applicant.name || "",
      effectiveEmail: item.applicant && item.applicant.effectiveEmail || "",
      phone: item.applicant && item.applicant.phone || "",
      routeKey: routeKey,
      routeLabel: operationalRouteLabel_(routeKey),
      lifecycleBaseState: lifecycle.baseState || "",
      actionabilityState: actionability.state || "",
      worklistKey: actionability.worklistKey || "",
      worklistLabel: actionability.worklistLabel || "",
      financeState: finance.financeState || "",
      recommendedMessageType: actionability.recommendedMessageType || "",
      selectBlockReason: actionability.selectBlockReason || ""
    })
  };
}

function operationalRouteSummarySkeleton_(routeKey) {
  return {
    routeKey: routeKey,
    routeLabel: operationalRouteLabel_(routeKey),
    populationTotal: 0,
    eligibleNow: 0,
    coolingOff: 0,
    hidden: 0,
    visible: 0,
    financePending: 0,
    financeToVerify: 0,
    financeVerified: 0,
    notYetPaymentApplicable: 0,
    exceptions: 0,
    oldestActionableAgeDays: ""
  };
}

function buildOperationalRouteSnapshot_(snapshot, payload) {
  var source = snapshot && typeof snapshot === "object" ? snapshot : { rows: [] };
  var p = payload && typeof payload === "object" ? payload : {};
  var routeRows = (source.rows || []).map(operationalRouteRowFromCanonical_);
  var byRoute = {};
  var summaries = {};
  routeRows.forEach(function (row) {
    var routeKey = clean_(row.routeKey || "UNKNOWN_UNCLASSIFIED").toUpperCase();
    if (!byRoute[routeKey]) byRoute[routeKey] = [];
    if (!summaries[routeKey]) summaries[routeKey] = operationalRouteSummarySkeleton_(routeKey);
    byRoute[routeKey].push(row);
    summaries[routeKey].populationTotal++;
    summaries[routeKey].visible++;
    if (row.selectable === true && clean_(row.actionabilityState || "").toUpperCase() === "READY") summaries[routeKey].eligibleNow++;
    if (clean_(row.actionabilityState || "").toUpperCase() === "COOLING_OFF") summaries[routeKey].coolingOff++;
    if (row.financeState === "PAYMENT_PENDING") summaries[routeKey].financePending++;
    if (row.financeState === "PAYMENT_TO_VERIFY") summaries[routeKey].financeToVerify++;
    if (row.financeState === "PAID_VERIFIED") summaries[routeKey].financeVerified++;
    if (row.financeState === "NOT_YET_PAYMENT_APPLICABLE") summaries[routeKey].notYetPaymentApplicable++;
    if (row.financeExceptionCode) summaries[routeKey].exceptions++;
    if (row.ageDays !== "" && row.selectable === true) {
      if (summaries[routeKey].oldestActionableAgeDays === "" || Number(row.ageDays || 0) > Number(summaries[routeKey].oldestActionableAgeDays || 0)) {
        summaries[routeKey].oldestActionableAgeDays = Number(row.ageDays || 0);
      }
    }
  });
  Object.keys(byRoute).forEach(function (routeKey) {
    byRoute[routeKey].sort(function (a, b) {
      return clean_(a.applicantId).localeCompare(clean_(b.applicantId))
        || Number(a.rowNumber || 0) - Number(b.rowNumber || 0);
    });
  });
  return {
    ok: true,
    readOnly: true,
    schemaVersion: CANONICAL_POPULATION_SCHEMA_VERSION,
    generatedAt: source.generatedAt || new Date().toISOString(),
    canonicalPopulationCount: Number(source.totalRows || routeRows.length),
    routeSummaries: summaries,
    routeRows: byRoute,
    rows: routeRows,
    reconciliation: canonicalPopulationClone_(source.reconciliation || {})
  };
}

function admin_getCanonicalPopulationSummary(payload) {
  var p = payload && typeof payload === "object" ? payload : {};
  return canonicalPopulationPublicSnapshot_(canonicalPopulationSnapshot_(), p.includeRows === true);
}

function admin_getCanonicalLifecycleGroups() {
  var snapshot = canonicalPopulationSnapshot_();
  return { ok: true, readOnly: true, schemaVersion: snapshot.schemaVersion, groups: snapshot.summary.lifecycle, reconciliation: snapshot.reconciliation };
}

function admin_getCanonicalActionabilityGroups() {
  var snapshot = canonicalPopulationSnapshot_();
  return { ok: true, readOnly: true, schemaVersion: snapshot.schemaVersion, states: snapshot.summary.actionability, workloadGroups: snapshot.summary.workloadGroups, reconciliation: snapshot.reconciliation };
}

function admin_getCanonicalFinanceGroups() {
  var snapshot = canonicalPopulationSnapshot_();
  return { ok: true, readOnly: true, schemaVersion: snapshot.schemaVersion, groups: snapshot.summary.finance, reconciliation: snapshot.reconciliation };
}

function admin_getCanonicalCommunicationCohort(payload) {
  return buildCanonicalCohort_(canonicalPopulationSnapshot_(), payload || {}, {});
}

function admin_getCanonicalPopulationExceptions(payload) {
  var snapshot = canonicalPopulationSnapshot_();
  var p = payload && typeof payload === "object" ? payload : {};
  var rows = snapshot.rows.filter(function (row) { return row.visibility.exception === true || row.lifecycle.baseState === "UNKNOWN" || row.actionability.state === "UNKNOWN"; });
  var limit = Math.max(1, Math.min(200, Number(p.limit || 100)));
  return { ok: true, readOnly: true, schemaVersion: snapshot.schemaVersion, total: rows.length, rows: canonicalPopulationClone_(rows.slice(0, limit)) };
}

function admin_getCanonicalApplicant(payload) {
  var applicantId = clean_(payload && payload.applicantId || "");
  if (!applicantId) return { ok: false, readOnly: true, code: "APPLICANT_ID_REQUIRED", applicant: null };
  var adminEmail = getCallerEmail_();
  if (!isAdmin_(adminEmail)) throw new Error("Access denied");
  var sheet = openDataSheet_();
  var data = sheet.getDataRange().getValues();
  var headers = data && data[0] || [];
  var sourceSheetName = sheet && typeof sheet.getName === "function" ? sheet.getName() : "";
  var matches = [];
  for (var r = 1; data && r < data.length; r++) {
    var rowObj = populationLedgerRowObjectFromValues_(headers, data[r] || []);
    if (clean_(rowObj.ApplicantID || "") !== applicantId) continue;
    matches.push(buildCanonicalPopulationRow_(rowObj, r + 1, {
      sourceSheetName: sourceSheetName,
      actor: typeof communicationGetActorInfo_ === "function" ? communicationGetActorInfo_({ actorEmail: adminEmail }) : null
    }));
  }
  return { ok: matches.length === 1, readOnly: true, code: matches.length > 1 ? "DUPLICATE_APPLICANT_ID" : (matches.length ? "" : "APPLICANT_NOT_FOUND"), applicant: matches.length ? canonicalPopulationClone_(matches[0]) : null };
}

function admin_searchCanonicalPopulation(payload) {
  var p = payload && typeof payload === "object" ? payload : {};
  var query = clean_(p.query || p.searchQuery || p.search || "");
  var limit = Math.max(1, Math.min(50, Number(p.limit || 12)));
  if (!query) return { ok: true, readOnly: true, query: "", totalMatches: 0, matches: [] };
  var needle = query.toLowerCase();
  var snapshot = canonicalPopulationSnapshot_();
  var matches = snapshot.rows.filter(function (row) {
    return canonicalPopulationSearchIndex_(row).indexOf(needle) >= 0;
  });
  matches.sort(function (a, b) {
    return clean_(a.identity && a.identity.applicantId || "").localeCompare(clean_(b.identity && b.identity.applicantId || ""))
      || Number(a.identity && a.identity.rowNumber || 0) - Number(b.identity && b.identity.rowNumber || 0);
  });
  return {
    ok: true,
    readOnly: true,
    query: query,
    totalMatches: matches.length,
    matches: matches.slice(0, limit).map(canonicalPopulationSearchResultRow_)
  };
}

function admin_getCanonicalPopulationReconciliation() {
  var snapshot = canonicalPopulationSnapshot_();
  return { ok: snapshot.reconciliation.status === "PASS", readOnly: true, schemaVersion: snapshot.schemaVersion, reconciliation: canonicalPopulationClone_(snapshot.reconciliation) };
}

function admin_getOperationalRouteSnapshot(payload) {
  return buildOperationalRouteSnapshot_(canonicalPopulationSnapshot_(), payload || {});
}
