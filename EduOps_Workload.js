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
    .setTitle((CONFIG.BRAND && CONFIG.BRAND.name ? CONFIG.BRAND.name : "FODE") + " - OpsEdu Cockpit")
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function eduops_getAccessProjection() {
  var access = eduopsRequireAccess_();
  var cfg = eduopsConfig_();
  return {
    schemaVersion: "EDUOPS_ACCESS_PROJECTION_V1",
    authoritySource: "Admin access and capability authority",
    ok: true,
    readOnly: true,
    product: cfg.product,
    contractVersion: cfg.contractVersion,
    profileVersion: cfg.profileVersion,
    runtime: eduopsRuntimeProjection_(),
    user: {
      email: access.email,
      role: access.role,
      capabilities: access.capabilities
    },
    environment: "FODE live production operations",
    deployment: {
      adminDeploymentIdSafe: eduopsSafeDeploymentId_(CONFIG.DEPLOYMENT_ID_ADMIN || ""),
      studentDeploymentIdSafe: eduopsSafeDeploymentId_(CONFIG.DEPLOYMENT_ID_STUDENT || "")
    },
    rpcAllowlist: {
      read: eduopsReadOnlyRpcAllowlist_(),
      write: eduopsWriteRpcAllowlist_()
    },
    featureFlags: eduopsFeatureFlags_(),
    operationAvailability: eduopsOperationAvailability_()
  };
}

function eduopsRuntimeProjection_(snapshotId, snapshotAsOf) {
  var cfg = typeof CONFIG === "object" && CONFIG ? CONFIG : {};
  var appsScriptVersion = eduopsClean_(cfg.APPS_SCRIPT_VERSION || "");
  return {
    schemaVersion: "EDUOPS_RUNTIME_IDENTITY_V1",
    authoritySource: "FODE runtime configuration",
    operationalClassification: "FODE live production operations",
    deploymentRole: "LIVE_PRODUCTION_OPERATIONS",
    environment: "FODE live production operations",
    version: cfg.VERSION,
    deployVersion: cfg.DEPLOY_VERSION_NUMBER,
    runtimeIdentity: String(cfg.VERSION || "") + " / " + String(cfg.DEPLOY_VERSION_NUMBER || ""),
    deploymentIdSafe: eduopsSafeDeploymentId_(cfg.DEPLOYMENT_ID_ADMIN || ""),
    deploymentIdentity: eduopsClean_(cfg.DEPLOYMENT_ID_ADMIN || ""),
    sourceIdentity: eduopsClean_(cfg.SOURCE_COMMIT || ""),
    appsScriptVersion: appsScriptVersion,
    appsScriptVersionAvailable: !!appsScriptVersion,
    appsScriptVersionReason: appsScriptVersion ? "Projected by server configuration." : "The Apps Script runtime does not expose its immutable platform version; verify the deployment pin through deployment metadata.",
    snapshotId: eduopsClean_(snapshotId || ""),
    snapshotAsOf: eduopsClean_(snapshotAsOf || ""),
    dataAuthority: "FODE canonical applicant snapshot"
  };
}

function eduopsSafeDeploymentId_(deploymentId) {
  var value = eduopsClean_(deploymentId || "");
  if (!value) return "";
  if (value.length <= 16) return value;
  return value.slice(0, 8) + "..." + value.slice(-6);
}

function eduops_getProfile() {
  eduopsRequireAccess_();
  var cfg = eduopsConfig_();
  return {
    schemaVersion: "EDUOPS_PROFILE_V2",
    authoritySource: "EduOps backend profile service",
    ok: true,
    readOnly: true,
    product: "FODE",
    label: "FODE",
    description: "Actionability-first operations workspace over existing FODE authoritative services.",
    contractVersion: cfg.contractVersion,
    profileVersion: cfg.profileVersion,
    defaultQuery: { product: "FODE", actionabilityState: "READY", worklistKey: "", workScope: "ALL_AUTHORISED", filters: { search: "" }, sort: { key: "urgency", direction: "asc" }, page: 1, pageSize: 25 },
    actionabilityStates: eduopsActionabilityPresentation_({}),
    workScopes: eduopsWorkScopePresentation_(),
    featureFlags: eduopsFeatureFlags_(),
    operationAvailability: eduopsOperationAvailability_(),
    batchPolicy: { schemaVersion: "EDUOPS_BATCH_POLICY_V1", authoritySource: "Communication Authority", allowedExecutionLimits: [10, 25, eduopsBatchExecutionCap_()].filter(function (value, index, list) { return value <= eduopsBatchExecutionCap_() && list.indexOf(value) === index; }), executionCap: eduopsBatchExecutionCap_() },
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
  var reliability = eduopsSourceReliability_("AUTHORITATIVE", "FODE canonical snapshot resolved for operations workload.", "FODE workload");
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
  var queryBinding = eduopsWorkloadQueryBinding_(query, snapshotId, {
    generatedAt: resolved.snapshotAsOf
  });
  var workloadCompositionMs = filterMs + (Date.now() - composeRemainderStarted);
  var response = {
    ok: true,
    readOnly: true,
    contractVersion: EDUOPS_CONTRACT_VERSION,
    product: "FODE",
    profileVersion: EDUOPS_PROFILE_VERSION,
    runtime: eduopsRuntimeProjection_(snapshotId, resolved.snapshotAsOf),
    schemaVersion: "EDUOPS_OPERATIONAL_WORKLOAD_V2",
    authoritySource: "Population Ledger + Actionability Resolver",
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
    batchTemplateOptions: [],
    batchTemplateAuthority: "EXACT_COHORT_EVALUATION_REQUIRED",
    queryBinding: queryBinding,
    reconciliation: reconciliation,
    cockpit: eduopsCockpitProjection_(allRows, snapshotId, resolved.snapshotAsOf),
    presentation: eduopsWorkloadPresentation_(allRows, filtered, pageRows, query, reliability, reconciliation, actionabilityCounts, worklistKeyCounts),
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

function eduopsCommunicationPublicTemplateId_(messageType) {
  var internalId = eduopsClean_(messageType || "");
  if (internalId === "legacy_invite") return "application_portal_invitation";
  if (internalId === "reminder") return "application_reminder";
  return internalId;
}

function eduopsCommunicationInternalTemplateId_(templateId) {
  var publicId = eduopsClean_(templateId || "");
  if (publicId === "application_portal_invitation") return "legacy_invite";
  if (publicId === "application_reminder") return "reminder";
  return publicId;
}

function eduopsCommunicationPublicLabel_(entry) {
  var internalId = eduopsClean_(entry && entry.messageType || "");
  if (internalId === "legacy_invite") return "Application Portal Invitation";
  if (internalId === "reminder") return "Application Reminder";
  return eduopsClean_(entry && (entry.selectedOptionLabel || entry.label) || internalId);
}

function eduopsCommunicationTemplateMetadata_() {
  var metadata = typeof communicationTemplateGalleryMetadata_ === "function" ? communicationTemplateGalleryMetadata_() : [];
  return (Array.isArray(metadata) ? metadata : []).slice().sort(function (a, b) {
    return Number(a.selectedOptionOrder || 999) - Number(b.selectedOptionOrder || 999);
  }).map(function (entry) {
    var internalId = eduopsClean_(entry && entry.messageType || "");
    return {
      templateId: eduopsCommunicationPublicTemplateId_(internalId),
      internalTemplateId: internalId,
      label: eduopsCommunicationPublicLabel_(entry),
      description: eduopsClean_(entry && (entry.purpose || entry.whenToUse || entry.stageSuitability) || ""),
      purpose: eduopsClean_(entry && entry.purpose || ""),
      batchSafe: entry && entry.batchSafe === true || typeof isCommunicationTypeBatchSafe_ === "function" && isCommunicationTypeBatchSafe_(internalId) === true,
      editable: /^(freeform|limited)$/i.test(eduopsClean_(entry && entry.editableMode || "")),
      customisable: /^freeform$/i.test(eduopsClean_(entry && entry.editableMode || "")),
      retired: false,
      authoritySource: "communicationTemplateGalleryMetadata_"
    };
  }).filter(function (entry) { return !!entry.templateId; });
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
    return { ok: true, readOnly: true, schemaVersion: "EDUOPS_SEARCH_RESULTS_V1", authoritySource: "FODE canonical applicant snapshot", product: "FODE", query: "", totalMatches: 0, matches: [], snapshotId: snapshotId, timings: { searchMs: Date.now() - started } };
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
    schemaVersion: "EDUOPS_SEARCH_RESULTS_V1",
    authoritySource: "FODE canonical applicant snapshot",
    product: "FODE",
    query: queryText,
    snapshotId: snapshotId,
    totalMatches: rows.length,
    matches: rows.slice(0, limit).map(function (row) {
      var dto = eduopsFodeSearchResultDto_(row, { page: 1, pageSize: 25 }, snapshotId);
      dto.searchHandoff = eduopsSearchHandoff_(row, snapshotId, resolved.snapshotAsOf);
      return dto;
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
  result.capabilities = eduopsClientCapabilityProjection_(eduopsCapabilityProjection_());
  result.communications = eduopsWorkbenchCommunicationProjection_(result.communications, applicantId, access, snapshotId);
  result.featureFlags = eduopsFeatureFlags_();
  result.operationAvailability = eduopsOperationAvailability_();
  result.actions = eduopsWorkbenchActionAuthority_(result, result.capabilities, result.operationAvailability);
  result.timings = { applicantMs: Date.now() - started };
  return result;
}

function eduopsWorkbenchActionAuthority_(workbench, capabilityProjection, operationAvailability) {
  var capabilityMap = capabilityProjection && capabilityProjection.capabilities || {};
  function decision(operation, capability, domainAvailable, reason, options, domainReasonCode) {
    var operationDecision = operationAvailability && operationAvailability[operation];
    var available = !!operationDecision && operationDecision.available === true && capabilityMap[capability] === true && domainAvailable === true;
    return {
      schemaVersion: "EDUOPS_WORKBENCH_ACTION_V1",
      authoritySource: "EduOps backend operation authority",
      operation: operation,
      requiredCapability: capability,
      available: available,
      reasonCode: available ? "AVAILABLE" : !operationDecision ? "BACKEND_CONTRACT_MISSING" : operationDecision.available !== true ? operationDecision.reasonCode : capabilityMap[capability] !== true ? "CAPABILITY_DENIED" : domainReasonCode || "DOMAIN_AUTHORITY_UNAVAILABLE",
      reason: available ? "Preview is required before confirmation." : !operationDecision ? "Authoritative operation availability was not returned. Refresh or retry before continuing." : operationDecision.available !== true ? operationDecision.reason : capabilityMap[capability] !== true ? "The authoritative capability projection does not permit this action." : reason,
      options: Array.isArray(options) ? options : [],
      stale: false
    };
  }
  var documentOptions = Object.keys(CONFIG && CONFIG.DOC_STATUS || {}).map(function (code) {
    return { code: code, label: eduopsHumanize_(code), authoritySource: "CONFIG.DOC_STATUS" };
  });
  return {
    DOCUMENT_REVIEW: decision("DOCUMENT_REVIEW", "CAN_SAVE_DOCUMENT_STATUSES", workbench.documents && workbench.documents.available === true, "Authoritative document state was not returned. Refresh or retry before continuing.", documentOptions),
    FINANCE_EVIDENCE_DECISION: decision("FINANCE_EVIDENCE_DECISION", "CAN_VERIFY_PAYMENT", workbench.finance && workbench.finance.available === true && workbench.finance.paymentEvidencePresent === true, "Authoritative finance evidence decision was not returned. Refresh or retry before continuing.", [{ code: "VERIFIED", label: "Payment verified", authoritySource: "Finance authority" }]),
    SEND_INDIVIDUAL_COMMUNICATION: decision("SEND_INDIVIDUAL_COMMUNICATION", "CAN_SEND_INDIVIDUAL_EMAIL", workbench.communications && workbench.communications.schemaVersion === "EDUOPS_COMMUNICATION_SUMMARY_V1" && workbench.communications.blockCode !== "COMMUNICATION_AUTHORITY_UNAVAILABLE", "Authoritative communication decision was not returned. Refresh or retry before continuing."),
    CONTACTABILITY_CORRECTION: decision("CONTACTABILITY_CORRECTION", "CAN_OPEN_REVIEW_WORKSPACE", workbench.contactability && workbench.contactability.available === true, "Authoritative contactability decision was not returned. Refresh or retry before continuing."),
    PORTAL_ACCESS: decision("PORTAL_ACCESS", "CAN_MANAGE_PORTAL_ACCESS", false, "Authoritative portal-access decision was not returned. Refresh or retry before continuing.", [], "BACKEND_CONTRACT_MISSING")
  };
}

function eduopsClientCapabilityProjection_(projection) {
  var source = projection && typeof projection === "object" ? projection : {};
  var nested = source.capabilities && typeof source.capabilities === "object" ? source.capabilities : {};
  var map = nested.capabilities && typeof nested.capabilities === "object" ? nested.capabilities : nested;
  return {
    readOnly: source.readOnly === true,
    role: eduopsClean_(source.role || nested.normalizedRole || nested.configuredRole || ""),
    capabilities: map || {},
    capabilityEvidence: nested.capabilityEvidence || source.capabilityEvidence || {},
    capabilityDetails: nested.capabilityDetails || source.capabilityDetails || {},
    enforcement: eduopsClean_(source.enforcement || "Server-side capability checks are authoritative; browser controls are presentation only."),
    sourceShape: "EDUOPS_CLIENT_CAPABILITY_DTO_V1",
    pass2Actions: Array.isArray(source.pass2Actions) ? source.pass2Actions.slice() : []
  };
}

function eduopsWorkbenchCommunicationProjection_(summary, applicantId, access, snapshotId) {
  var base = summary && typeof summary === "object" ? summary : {};
  var out = eduopsClone_(base);
  var actorEmail = eduopsClean_(access && access.email || "");
  var actorRole = eduopsClean_(access && access.role || "");
  try {
    var sheet = mustGetDataSheet_(getWorkingSpreadsheet_());
    var rowNumber = findRowByApplicantId_(sheet, applicantId);
    if (!rowNumber) {
      out.sendableNow = false;
      out.canSendNow = false;
      out.blockCode = "APPLICANT_NOT_FOUND";
      out.blockReason = "Applicant not found.";
      out.eligibility = out.blockReason;
      return out;
    }
    var rowObj = getRowObject_(sheet, rowNumber);
    var requestedType = eduopsClean_(base.recommendedMessageType || "");
    var authority = buildApplicantCommunicationAuthorityProjection_(rowObj, rowNumber, sheet, requestedType, {
      actorEmail: actorEmail,
      actorRole: actorRole
    });
    var templates = eduopsCommunicationTemplateGalleryForWorkbench_(rowObj, rowNumber, sheet, authority, {
      actorEmail: actorEmail,
      actorRole: actorRole
    });
    var recommendedType = eduopsClean_(authority.recommendedMessageType || requestedType || "");
    var recommendedTemplate = eduopsCommunicationTemplateByType_(templates, recommendedType);
    out.authorityProjection = {
      Comm_Stage: eduopsClean_(authority.stage || ""),
      Comm_Status: eduopsClean_(authority.commStatus || ""),
      Comm_Recommended_Message_Type: eduopsClean_(authority.recommendedMessageType || ""),
      Comm_Requested_Message_Type: eduopsClean_(authority.requestedMessageType || ""),
      Comm_Selected_Message_Type: eduopsClean_(authority.selectedMessageType || ""),
      Comm_Permitted: authority.permitted === true,
      Comm_Sendable_Now: authority.sendableNow === true,
      Comm_Can_Send_Now: authority.sendableNow === true,
      Comm_Block_Code: eduopsClean_(authority.blockCode || ""),
      Comm_Block_Reason: eduopsClean_(authority.blockReason || ""),
      Comm_Awaiting_Response: authority.awaitingResponse === true,
      Comm_Authority_Source: eduopsClean_(authority.authoritySource || "")
    };
    out.recommendedMessageType = recommendedTemplate.templateId || eduopsCommunicationPublicTemplateId_(recommendedType);
    out.recommendedCommunication = eduopsCommunicationAuthorityDto_(authority, recommendedType);
    out.selectedMessageType = "";
    out.requestedMessageType = eduopsClean_(authority.requestedMessageType || "");
    out.recommendedTemplateId = recommendedTemplate.templateId || eduopsCommunicationPublicTemplateId_(recommendedType);
    out.operatorRecommendation = eduopsClean_(recommendedTemplate.label || "");
    out.templateGallery = templates;
    out.communicationTemplatePanel = eduopsCommunicationTemplatePanel_(templates, recommendedTemplate, applicantId, snapshotId);
    out.effectiveEmail = eduopsClean_(authority.authorityResult && authority.authorityResult.effectiveEmail || rowObj.Parent_Email || rowObj.Email || "");
    out.draft = {
      templateId: "",
      messageType: "",
      recipient: out.effectiveEmail,
      subject: "",
      body: ""
    };
    out.permitted = false;
    out.sendableNow = false;
    out.canSendNow = false;
    out.blockCode = "EXPLICIT_TEMPLATE_SELECTION_REQUIRED";
    out.blockReason = "Choose a communication before previewing.";
    out.awaitingResponse = false;
    out.authoritySource = "Communication Authority";
    out.evaluatedSnapshot = eduopsClean_(snapshotId || "");
    out.eligibility = out.blockReason;
  } catch (err) {
    out.sendableNow = false;
    out.canSendNow = false;
    out.blockCode = "COMMUNICATION_AUTHORITY_UNAVAILABLE";
    out.blockReason = String(err && err.message || err || "Communication Authority projection unavailable.");
    out.eligibility = out.blockReason;
    out.templateGallery = [];
    out.communicationTemplatePanel = eduopsAuthorityUnavailable_("communication template panel", "Communication Authority");
  }
  return out;
}

function eduopsCommunicationTemplatePanel_(templates, recommendedTemplate, applicantId, snapshotId) {
  return {
    schemaVersion: "OPSEDU_COMMUNICATION_TEMPLATE_PANEL_V1",
    authoritySource: "Communication Authority",
    applicantId: eduopsClean_(applicantId || ""),
    snapshotId: eduopsClean_(snapshotId || ""),
    recommendedTemplateId: eduopsClean_(recommendedTemplate && recommendedTemplate.templateId || ""),
    templates: (Array.isArray(templates) ? templates : []).map(function (template) {
      return {
        templateId: template.templateId,
        messageType: template.messageType,
        label: template.label,
        description: template.description,
        subject: template.defaultSubject,
        body: template.defaultBody,
        recommended: template.recommended === true,
        availability: template.availabilityState,
        availabilityLabel: template.availabilityLabel,
        unavailableReason: template.selectable === true ? "" : template.reason,
        selectable: template.selectable === true,
        editable: template.editable === true,
        customisable: template.customisable === true,
        selectedByDefault: false,
        authorityProjection: template.authorityProjection,
        authoritySource: template.authoritySource
      };
    }),
    stale: false
  };
}

function eduopsCommunicationTemplateGalleryForWorkbench_(rowObj, rowNumber, sheet, authority, actor) {
  var metadata = eduopsCommunicationTemplateMetadata_();
  var recommendedType = eduopsClean_(authority && (authority.recommendedMessageType || authority.selectedMessageType) || "");
  return metadata.map(function (entry) {
    var messageType = entry.internalTemplateId;
    var perTypeAuthority = eduopsCommunicationAuthorityForType_(rowObj, rowNumber, sheet, messageType, actor);
    var draft = eduopsCommunicationDraftForType_(rowObj, rowNumber, sheet, messageType, actor);
    var available = perTypeAuthority.Comm_Can_Send_Now === true && !draft.blockCode;
    return {
      templateId: entry.templateId,
      messageType: entry.templateId,
      label: entry.label,
      selectedOptionLabel: entry.label,
      description: entry.description,
      purpose: entry.purpose,
      batchSafe: entry.batchSafe === true,
      availabilityState: available ? "AVAILABLE_FOR_ALL" : "UNAVAILABLE",
      recommended: messageType === recommendedType,
      availableRecipientCount: available ? 1 : 0,
      unavailableRecipientCount: available ? 0 : 1,
      authorityProjection: perTypeAuthority,
      permitted: perTypeAuthority.Comm_Permitted === true,
      canSendNow: available,
      selectable: available,
      availabilityLabel: available ? "Available for this applicant" : "Unavailable",
      reasonCode: available ? "" : eduopsClean_(draft.blockCode || perTypeAuthority.Comm_Block_Code || "COMMUNICATION_NOT_AUTHORISED"),
      reason: available ? "Available for this applicant." : eduopsClean_(draft.blockReason || perTypeAuthority.Comm_Block_Reason || "Communication Authority did not authorise this template."),
      blockCode: available ? "" : eduopsClean_(draft.blockCode || perTypeAuthority.Comm_Block_Code || "COMMUNICATION_NOT_AUTHORISED"),
      blockReason: available ? "" : eduopsClean_(draft.blockReason || perTypeAuthority.Comm_Block_Reason || "Communication Authority did not authorise this template."),
      authoritySource: eduopsClean_(perTypeAuthority.Comm_Authority_Source || ""),
      awaitingResponse: perTypeAuthority.Comm_Awaiting_Response === true,
      editable: entry.editable === true,
      customisable: entry.customisable === true,
      retired: false,
      defaultSubject: draft.subject,
      defaultBody: draft.body,
      draftBlockCode: draft.blockCode,
      draftBlockReason: draft.blockReason
    };
  });
}

function eduopsCommunicationAuthorityForType_(rowObj, rowNumber, sheet, messageType, actor) {
  var requestedType = eduopsClean_(messageType || "");
  try {
    var ctx = resolveApplicantMessageContextFromRow_(rowObj, rowNumber, sheet, requestedType, {
      actorEmail: actor && actor.actorEmail,
      actorRole: actor && actor.actorRole,
      action: "preview",
      skipPortalUrlBuild: true
    });
    return {
      Comm_Stage: eduopsClean_(ctx && (ctx.lifecycleStage || ctx.legacyLifecycleStage) || ""),
      Comm_Status: ctx && ctx.sendableNow === true && ctx.eligible === true ? "ACTIONABLE" : "BLOCKED",
      Comm_Recommended_Message_Type: eduopsClean_(messageType || ""),
      Comm_Requested_Message_Type: requestedType,
      Comm_Selected_Message_Type: eduopsClean_(ctx && ctx.messageType || requestedType),
      Comm_Permitted: ctx && ctx.permitted === true,
      Comm_Sendable_Now: ctx && ctx.sendableNow === true && ctx.eligible === true,
      Comm_Can_Send_Now: ctx && ctx.sendableNow === true && ctx.eligible === true,
      Comm_Block_Code: eduopsClean_(ctx && ctx.blockCode || ""),
      Comm_Block_Reason: eduopsClean_(ctx && ctx.blockReason || ""),
      Comm_Awaiting_Response: false,
      Comm_Authority_Source: eduopsClean_(ctx && ctx.canonicalLifecycleAuthority && ctx.canonicalLifecycleAuthority.authoritySource || "")
    };
  } catch (err) {
    return {
      Comm_Stage: "",
      Comm_Status: "UNAVAILABLE",
      Comm_Recommended_Message_Type: eduopsClean_(messageType || ""),
      Comm_Requested_Message_Type: requestedType,
      Comm_Selected_Message_Type: requestedType,
      Comm_Permitted: false,
      Comm_Sendable_Now: false,
      Comm_Can_Send_Now: false,
      Comm_Block_Code: "COMMUNICATION_AUTHORITY_UNAVAILABLE",
      Comm_Block_Reason: String(err && err.message || err || "Communication Authority projection unavailable."),
      Comm_Awaiting_Response: false,
      Comm_Authority_Source: ""
    };
  }
}

function eduopsCommunicationAuthorityDto_(authority, messageType) {
  return {
    Comm_Stage: eduopsClean_(authority && authority.stage || ""),
    Comm_Status: eduopsClean_(authority && authority.commStatus || ""),
    Comm_Recommended_Message_Type: eduopsClean_(authority && authority.recommendedMessageType || messageType || ""),
    Comm_Requested_Message_Type: eduopsClean_(authority && authority.requestedMessageType || ""),
    Comm_Selected_Message_Type: eduopsClean_(authority && authority.selectedMessageType || messageType || ""),
    Comm_Permitted: authority && authority.permitted === true,
    Comm_Sendable_Now: authority && authority.sendableNow === true,
    Comm_Can_Send_Now: authority && authority.sendableNow === true,
    Comm_Block_Code: eduopsClean_(authority && authority.blockCode || ""),
    Comm_Block_Reason: eduopsClean_(authority && authority.blockReason || ""),
    Comm_Awaiting_Response: authority && authority.awaitingResponse === true,
    Comm_Authority_Source: eduopsClean_(authority && authority.authoritySource || "")
  };
}

function eduopsCommunicationDraftForType_(rowObj, rowNumber, sheet, messageType, actor) {
  try {
    var ctx = resolveApplicantMessageContextFromRow_(rowObj, rowNumber, sheet, messageType, {
      actorEmail: actor && actor.actorEmail,
      actorRole: actor && actor.actorRole,
      action: "preview",
      skipPortalUrlBuild: true
    });
    var built = buildApplicantMessage_(ctx);
    return {
      subject: eduopsClean_(built && built.subject || ""),
      body: built && built.body || "",
      blockCode: eduopsClean_(ctx && ctx.blockCode || ""),
      blockReason: eduopsClean_(ctx && ctx.blockReason || "")
    };
  } catch (err) {
    return {
      subject: "",
      body: "",
      blockCode: "TEMPLATE_DRAFT_UNAVAILABLE",
      blockReason: String(err && err.message || err || "Template draft unavailable.")
    };
  }
}

function eduopsCommunicationTemplateByType_(templates, messageType) {
  var wanted = eduopsClean_(messageType || "");
  var list = Array.isArray(templates) ? templates : [];
  for (var i = 0; i < list.length; i++) {
    if (eduopsClean_(list[i] && (list[i].messageType || list[i].templateId) || "") === wanted || eduopsCommunicationInternalTemplateId_(list[i] && list[i].templateId) === wanted) return list[i] || {};
  }
  return {};
}

function eduops_getDocumentManifest(payload) {
  var access = eduopsRequireAccess_();
  var started = Date.now();
  var exact = eduopsHydrateDocumentPayload_(payload || {}, false);
  if (exact.ok !== true) return exact;
  var result = admin_getApplicantDocumentManifest(exact.payload);
  result.readOnly = true;
  result.schemaVersion = "EDUOPS_DOCUMENT_MANIFEST_V2";
  result.authoritySource = "Document authority";
  result.snapshotId = eduopsClean_(payload && payload.expectedSnapshotId || "");
  result.snapshotAsOf = new Date().toISOString();
  result.actionAuthority = eduopsWorkbenchActionAuthority_({ documents: { available: result.ok === true }, finance: {}, contactability: {} }, { capabilities: access.capabilities || {} }, eduopsOperationAvailability_()).DOCUMENT_REVIEW;
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
      item.statusCode = eduopsUpper_(String(item.status || "").replace(/\s+/g, "_"), "PENDING_REVIEW");
      item.statusPresentation = eduopsCodePresentation_(item.statusCode, eduopsHumanize_(item.statusCode), "", "Document authority");
      item.availableDecisions = result.actionAuthority.options.slice();
      return item;
    });
  }
  result.documentGallery = eduopsDocumentGalleryProjection_(result);
  result.timings = { documentManifestMs: Date.now() - started };
  return result;
}

function eduopsDocumentGalleryProjection_(result) {
  return {
    schemaVersion: "OPSEDU_DOCUMENT_GALLERY_V1",
    authoritySource: "Document authority",
    applicantId: result.applicantId,
    snapshotId: result.snapshotId,
    snapshotTimestamp: result.snapshotAsOf,
    documents: (result.files || []).map(function (file) {
      return {
        documentType: eduopsClean_(file.documentType || file.type || file.sourceField || ""),
        label: eduopsClean_(file.displayName || file.name || file.sourceField || ""),
        status: eduopsClean_(file.statusCode || ""),
        statusLabel: file.statusPresentation && file.statusPresentation.label || "",
        statusPresentation: file.statusPresentation,
        fileUrl: eduopsClean_(file.fileUrl || file.url || ""),
        previewUrl: eduopsClean_(file.previewUrl || ""),
        thumbnailUrl: eduopsClean_(file.thumbnailUrl || ""),
        available: !!file.documentKey,
        unavailableReason: file.documentKey ? "" : "Document authority did not return a governed document identity.",
        reviewAction: result.actionAuthority,
        availableDecisions: file.availableDecisions || [],
        sourceField: file.sourceField,
        itemIndex: file.itemIndex,
        documentKey: file.documentKey,
        traceAvailable: true,
        authoritySource: "Document authority"
      };
    }),
    traceAudit: {
      schemaVersion: "OPSEDU_TRACE_AUDIT_V1",
      authoritySource: "Document authority",
      applicantId: result.applicantId,
      snapshotId: result.snapshotId,
      rowNumber: result.rowNumber,
      renditionRule: result.renditionRule
    },
    stale: false
  };
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
  var p = payload && typeof payload === "object" ? payload : {};
  var workload = eduops_queryOperationalWorkload(p);
  var hiddenPage = eduopsHiddenReasonPage_(
    workload.reconciliation && workload.reconciliation.hiddenReasonRows || [],
    Math.max(1, Math.floor(Number(p.hiddenPage || 1))),
    Math.max(1, Math.min(100, Math.floor(Number(p.hiddenPageSize || 50)))),
    workload.snapshotId,
    workload.reconciliation && workload.reconciliation.queryFingerprint || ""
  );
  return {
    ok: true,
    readOnly: true,
    schemaVersion: "EDUOPS_RECONCILIATION_RESPONSE_V1",
    authoritySource: "Population Ledger + Actionability Resolver",
    product: "FODE",
    snapshotId: workload.snapshotId,
    reconciliation: workload.reconciliation,
    hiddenReasons: hiddenPage.rows,
    hiddenReasonPage: hiddenPage
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
    if (filters.primaryRoute && eduopsClean_(eduopsPrimaryRouteForRow_(row)) !== eduopsClean_(filters.primaryRoute)) return false;
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

function eduopsActionabilityPresentation_(counts) {
  var order = ["READY", "COOLING_OFF", "AWAITING_APPLICANT", "AWAITING_PAYMENT", "REVIEW_REQUIRED", "BLOCKED", "UNKNOWN", "COMPLETE"];
  return order.map(function (code) {
    var item = eduopsStatePresentation_(code);
    item.count = Number(counts && counts[code] || 0);
    return item;
  });
}

function eduopsWorkScopePresentation_() {
  return [
    ["MY", "My Work"], ["TEAM", "Team Work"], ["UNASSIGNED", "Unassigned"],
    ["ESCALATED", "Escalated"], ["ALL_AUTHORISED", "All Authorised Work"]
  ].map(function (item) { return eduopsCodePresentation_(item[0], item[1], "Operator query scope projected by the backend.", "EduOps workload query service"); });
}

function eduopsCockpitProjection_(rows, snapshotId, snapshotTimestamp) {
  return {
    schemaVersion: "OPSEDU_COCKPIT_V1",
    authoritySource: "Population Ledger + Actionability Resolver + EduOps workload query service",
    productLabel: "FODE live production operations",
    heading: "Today's work",
    primaryBuckets: eduopsCockpitPrimaryBuckets_(rows, snapshotId, snapshotTimestamp),
    actionPackages: eduopsActionPackages_(rows, snapshotId, snapshotTimestamp),
    snapshotId: eduopsClean_(snapshotId || ""),
    snapshotTimestamp: eduopsClean_(snapshotTimestamp || ""),
    stale: false
  };
}

function eduopsCockpitPrimaryBuckets_(rows, snapshotId, snapshotTimestamp) {
  var counts = eduopsActionabilityCounts_(rows);
  return eduopsActionabilityPresentation_(counts).map(function (item) {
    var query = eduopsNormalizeWorkloadQuery_({
      product: "FODE",
      actionabilityState: item.code,
      worklistKey: "",
      workScope: "ALL_AUTHORISED",
      filters: { search: "" },
      sort: { key: "urgency", direction: "asc" },
      page: 1,
      pageSize: 25
    });
    return {
      schemaVersion: "OPSEDU_PRIMARY_BUCKET_V1",
      authoritySource: "Actionability Resolver + EduOps workload query service",
      code: item.code,
      label: item.label,
      count: Number(item.count || 0),
      reason: item.reason,
      defaultQueueBinding: eduopsWorkloadQueryBinding_(query, snapshotId, { generatedAt: snapshotTimestamp }),
      disabled: false,
      disabledReason: "",
      snapshotId: eduopsClean_(snapshotId || ""),
      snapshotTimestamp: eduopsClean_(snapshotTimestamp || "")
    };
  });
}

function eduopsActionPackageDescriptor_(row) {
  var state = eduopsUpper_(row && row.actionabilityState || "UNKNOWN");
  var worklistKey = eduopsUpper_(row && row.worklistKey || "");
  var worklistLabel = eduopsClean_(row && row.worklistLabel || "");
  var descriptors = {
    PAYMENT_FOLLOW_UP: { label: "Payment follow-ups due", shortLabel: "Payment follow-ups", ownerDomain: "Finance", sortPriority: 10, mutationBoundary: "Finance authority + Communication Authority" },
    DOCUMENT_REVIEW: { label: "Document review required", shortLabel: "Document review", ownerDomain: "Documents", sortPriority: 30, mutationBoundary: "Review Workspace + Document authority" },
    PAYMENT_REVIEW: { label: "Finance verification required", shortLabel: "Finance verification", ownerDomain: "Finance", sortPriority: 40, mutationBoundary: "Finance authority" },
    CONTACTABILITY_EXCEPTION: { label: "Contact issues", shortLabel: "Contact issues", ownerDomain: "Contactability", sortPriority: 50, mutationBoundary: "Review Workspace + Contactability authority" },
    ENROLMENT_COMPLETION: { label: "Ready for acceptance / classroom handoff", shortLabel: "Acceptance handoff", ownerDomain: "Academic Administration", sortPriority: 60, mutationBoundary: "Review Workspace + Canonical Lifecycle Resolver" }
  };
  if (worklistKey === "DOCUMENT_FOLLOW_UP" && state === "REVIEW_REQUIRED") {
    return { packageKey: state + ":" + worklistKey, actionabilityState: state, worklistKey: worklistKey, label: "Missing documents - review decision required", shortLabel: "Review missing documents", ownerDomain: "Documents Review", sortPriority: 25, mutationBoundary: "Review Workspace + Document authority" };
  }
  if (worklistKey === "DOCUMENT_FOLLOW_UP") {
    return { packageKey: state + ":" + worklistKey, actionabilityState: state, worklistKey: worklistKey, label: "Missing documents - applicant follow-up due", shortLabel: "Applicant missing documents", ownerDomain: "Documents", sortPriority: 20, mutationBoundary: "Document authority + Communication Authority" };
  }
  if (state === "COOLING_OFF") return { packageKey: "COOLING_OFF", actionabilityState: state, worklistKey: "", label: "Recently contacted / cooling off", shortLabel: "Waiting period", ownerDomain: "Operations", sortPriority: 70, mutationBoundary: "Actionability Resolver" };
  if (state === "REVIEW_REQUIRED" && !descriptors[worklistKey]) return { packageKey: "REVIEW_REQUIRED", actionabilityState: state, worklistKey: "", label: "Needs review", shortLabel: "Needs review", ownerDomain: "Review", sortPriority: 80, mutationBoundary: "Review Workspace" };
  if (state === "COMPLETE") return { packageKey: "COMPLETE", actionabilityState: state, worklistKey: "", label: "Completed / no action", shortLabel: "Completed", ownerDomain: "History", sortPriority: 900, mutationBoundary: "Canonical Lifecycle Resolver" };
  var descriptor = descriptors[worklistKey] || {};
  return {
    packageKey: state + ":" + (worklistKey || "ALL"),
    actionabilityState: state,
    worklistKey: worklistKey,
    label: descriptor.label || worklistLabel || eduopsStateLabel_(state),
    shortLabel: descriptor.shortLabel || worklistLabel || eduopsStateLabel_(state),
    ownerDomain: descriptor.ownerDomain || eduopsPrimaryRouteForRow_(row),
    sortPriority: Number(descriptor.sortPriority || 500),
    mutationBoundary: descriptor.mutationBoundary || "Authoritative backend service"
  };
}

function eduopsActionPackages_(rows, snapshotId, snapshotTimestamp) {
  var groups = {};
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    var descriptor = eduopsActionPackageDescriptor_(row);
    var key = descriptor.packageKey;
    if (!groups[key]) groups[key] = { descriptor: descriptor, rows: [] };
    groups[key].rows.push(row);
  });
  return Object.keys(groups).map(function (key) {
    var group = groups[key];
    var descriptor = group.descriptor;
    var query = eduopsNormalizeWorkloadQuery_({
      product: "FODE",
      actionabilityState: descriptor.actionabilityState,
      worklistKey: descriptor.worklistKey,
      workScope: "ALL_AUTHORISED",
      filters: { search: "" },
      sort: { key: "urgency", direction: "asc" },
      page: 1,
      pageSize: 25
    });
    var reasons = {};
    var recommendations = {};
    group.rows.forEach(function (row) {
      var reason = eduopsClean_(row && row.worklistReason || "");
      var messageType = eduopsClean_(row && row.recommendedMessageType || "");
      if (reason) reasons[reason] = true;
      if (messageType) recommendations[messageType] = true;
    });
    var reasonList = Object.keys(reasons);
    var recommendationList = Object.keys(recommendations);
    var disabled = !descriptor.actionabilityState || (descriptor.worklistKey && group.rows.some(function (row) { return eduopsUpper_(row.actionabilityState || "") !== descriptor.actionabilityState; }));
    return {
      schemaVersion: "OPSEDU_ACTION_PACKAGE_V1",
      packageId: "FODE:" + key,
      actionabilityState: descriptor.actionabilityState,
      worklistKey: descriptor.worklistKey,
      label: descriptor.label,
      shortOperatorLabel: descriptor.shortLabel,
      count: group.rows.length,
      primaryAction: "OPEN_ACTION_QUEUE",
      primaryActionLabel: "Open queue",
      workType: descriptor.worklistKey || descriptor.actionabilityState,
      ownerDomain: descriptor.ownerDomain,
      route: descriptor.ownerDomain,
      routeReason: reasonList.length === 1 ? reasonList[0] : reasonList.length > 1 ? "This package contains multiple backend-authored route reasons." : "Actionability Resolver assigned this package.",
      defaultQueueBinding: eduopsWorkloadQueryBinding_(query, snapshotId, { generatedAt: snapshotTimestamp }),
      recommendedCommunication: recommendationList.length === 1 ? (function () {
        var template = eduopsCommunicationTemplateByType_(eduopsCommunicationTemplateMetadata_(), recommendationList[0]);
        return eduopsCodePresentation_(eduopsCommunicationPublicTemplateId_(recommendationList[0]), template.label || eduopsHumanize_(recommendationList[0]), "Communication Authority recommendation for this package.", "Communication Authority");
      })() : recommendationList.length > 1 ? eduopsAuthorityUnavailable_("single package communication recommendation", "Communication Authority") : null,
      mutationBoundary: descriptor.mutationBoundary,
      disabled: disabled,
      disabledReason: disabled ? "Authoritative queue binding could not be composed for this package." : "",
      secondary: descriptor.actionabilityState === "COMPLETE",
      sortPriority: descriptor.sortPriority,
      authoritySource: "Actionability Resolver + EduOps workload query service",
      snapshotId: eduopsClean_(snapshotId || ""),
      snapshotTimestamp: eduopsClean_(snapshotTimestamp || "")
    };
  }).sort(function (a, b) { return Number(a.sortPriority || 0) - Number(b.sortPriority || 0) || a.label.localeCompare(b.label); });
}

function eduopsSearchHandoff_(row, snapshotId, snapshotTimestamp) {
  var descriptor = eduopsActionPackageDescriptor_(row);
  var query = eduopsNormalizeWorkloadQuery_({
    actionabilityState: descriptor.actionabilityState,
    worklistKey: descriptor.worklistKey,
    workScope: "ALL_AUTHORISED",
    filters: { search: "" },
    sort: { key: "urgency", direction: "asc" },
    page: 1,
    pageSize: 25
  });
  return {
    schemaVersion: "OPSEDU_SEARCH_HANDOFF_V1",
    authoritySource: "Actionability Resolver + EduOps workload query service",
    applicantId: eduopsClean_(row && row.applicantId || ""),
    actionPackageId: "FODE:" + descriptor.packageKey,
    actionPackageLabel: descriptor.label,
    openQueueLabel: "Open action queue: " + descriptor.label,
    routeReason: eduopsClean_(row && row.worklistReason || ""),
    nextAction: eduopsCodePresentation_(row && row.nextAction, eduopsHumanize_(row && row.nextAction), row && row.worklistReason, "Actionability Resolver"),
    queueBinding: eduopsWorkloadQueryBinding_(query, snapshotId, { generatedAt: snapshotTimestamp }),
    snapshotId: eduopsClean_(snapshotId || ""),
    stale: false
  };
}

function eduopsUniqueFilterOptions_(rows, field, authoritySource) {
  var seen = {};
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    var code = eduopsClean_(row && row[field] || "");
    if (!code || seen[code]) return;
    seen[code] = eduopsCodePresentation_(code, eduopsHumanize_(code), "", authoritySource);
  });
  return Object.keys(seen).sort().map(function (code) { return seen[code]; });
}

function eduopsWorklistPresentation_(counts, rows) {
  var labels = {};
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    var key = eduopsClean_(row && row.worklistKey || "");
    if (key && !labels[key]) labels[key] = eduopsClean_(eduopsActionPackageDescriptor_(row).shortLabel || row.worklistLabel || "");
  });
  var total = Object.keys(counts || {}).reduce(function (sum, key) { return sum + Number(counts[key] || 0); }, 0);
  var out = [{ schemaVersion: "EDUOPS_CODE_PRESENTATION_V1", authoritySource: "Actionability Resolver", code: "", label: "All work types", reason: "All worklist types in the selected Actionability state.", available: true, stale: false, count: total }];
  Object.keys(counts || {}).sort().forEach(function (key) {
    var item = eduopsCodePresentation_(key, labels[key], "", "Actionability Resolver");
    item.count = Number(counts[key] || 0);
    out.push(item);
  });
  return out;
}

function eduopsDistribution_(rows, field, authoritySource) {
  var counts = {};
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    var code = eduopsClean_(row && row[field] || "");
    if (!code) return;
    counts[code] = Number(counts[code] || 0) + 1;
  });
  return Object.keys(counts).sort().map(function (code) {
    var item = eduopsCodePresentation_(code, eduopsHumanize_(code), "", authoritySource);
    item.count = counts[code];
    return item;
  });
}

function eduopsWorkloadPresentation_(allRows, matchedRows, pageRows, query, reliability, reconciliation, actionabilityCounts, worklistKeyCounts) {
  var lifecycleRows = (Array.isArray(allRows) ? allRows : []).map(function (row) {
    var copy = eduopsClone_(row);
    copy.lifecyclePresentationCode = row.canonicalLifecycle && (row.canonicalLifecycle.lifecycleStage || row.canonicalLifecycle.baseState) || "";
    return copy;
  });
  var routeRows = (Array.isArray(allRows) ? allRows : []).map(function (row) { return { primaryRoute: eduopsPrimaryRouteForRow_(row) }; });
  return {
    schemaVersion: "EDUOPS_WORKLOAD_PRESENTATION_V1",
    authoritySource: "EduOps backend projection services",
    actionabilityBuckets: eduopsActionabilityPresentation_(actionabilityCounts),
    allActionability: { code: "ALL", label: "All authoritative records", count: Object.keys(actionabilityCounts || {}).reduce(function (sum, key) { return sum + Number(actionabilityCounts[key] || 0); }, 0), authoritySource: "Actionability Resolver" },
    worklists: eduopsWorklistPresentation_(worklistKeyCounts, allRows),
    workScopes: eduopsWorkScopePresentation_(),
    reliability: eduopsStatePresentation_(reliability && reliability.state || "UNAVAILABLE"),
    metrics: [
      { code: "CANONICAL_POPULATION", label: "Canonical population", value: Number(reconciliation.canonicalPopulation || 0), authoritySource: "Population Ledger" },
      { code: "ELIGIBLE_NOW", label: "Eligible now", value: Number(reconciliation.metricCounts && reconciliation.metricCounts.eligibleNow || 0), authoritySource: "Actionability Resolver" },
      { code: "MATCHING_LATER_PAGES", label: "Matching on later pages", value: Number(reconciliation.matchingOnLaterPages || 0), authoritySource: "EduOps workload query service" },
      { code: "OUTSIDE_CURRENT_VIEW", label: "Outside current view", value: Number(reconciliation.hiddenFromCurrentView || 0), authoritySource: "Population Ledger" },
      { code: "OLDEST_MATCHED", label: "Oldest matched", value: reconciliation.oldestMatchedAgeDays === "" ? "-" : String(reconciliation.oldestMatchedAgeDays) + " days", authoritySource: "Actionability Resolver" }
    ],
    filterOptions: {
      owner: eduopsUniqueFilterOptions_(allRows, "actionOwner", "Actionability Resolver"),
      urgency: eduopsUniqueFilterOptions_(allRows, "urgencyLevel", "Actionability Resolver"),
      primaryRoute: eduopsUniqueFilterOptions_(routeRows, "primaryRoute", "Actionability Resolver"),
      documentState: eduopsUniqueFilterOptions_(allRows, "documentState", "Document authority"),
      financeState: eduopsUniqueFilterOptions_(allRows, "canonicalFinanceState", "Finance authority"),
      contactabilityState: eduopsUniqueFilterOptions_(allRows, "contactabilityState", "Contactability authority"),
      communicationState: eduopsUniqueFilterOptions_(allRows, "recommendedMessageType", "Communication Authority"),
      cooling: [eduopsCodePresentation_("ACTIVE", "Cooling-off active", "", "Actionability Resolver"), eduopsCodePresentation_("NONE", "No cooling-off", "", "Actionability Resolver")],
      blockKind: eduopsUniqueFilterOptions_(allRows, "reasonCode", "Actionability Resolver")
    },
    modules: {
      overview: { schemaVersion: "EDUOPS_MODULE_PROJECTION_V1", authoritySource: "Population Ledger + Actionability Resolver", available: true, metrics: [] },
      lifecycle: { schemaVersion: "EDUOPS_MODULE_PROJECTION_V1", authoritySource: "Canonical Lifecycle Resolver", available: true, distribution: eduopsDistribution_(lifecycleRows, "lifecyclePresentationCode", "Canonical Lifecycle Resolver") },
      finance: { schemaVersion: "EDUOPS_MODULE_PROJECTION_V1", authoritySource: "Finance authority", available: true, distribution: eduopsDistribution_(allRows, "canonicalFinanceState", "Finance authority") },
      documents: { schemaVersion: "EDUOPS_MODULE_PROJECTION_V1", authoritySource: "Document authority", available: true, distribution: eduopsDistribution_(allRows, "documentState", "Document authority") },
      communications: { schemaVersion: "EDUOPS_MODULE_PROJECTION_V1", authoritySource: "Communication Authority", available: true, distribution: eduopsDistribution_(allRows, "recommendedMessageType", "Communication Authority") },
      contactability: { schemaVersion: "EDUOPS_MODULE_PROJECTION_V1", authoritySource: "Contactability authority", available: true, distribution: eduopsDistribution_(allRows, "contactabilityState", "Contactability authority") },
      portal: eduopsAuthorityUnavailable_("portal-access", "Portal Access Domain"),
      population: { schemaVersion: "EDUOPS_MODULE_PROJECTION_V1", authoritySource: "Population Ledger", available: true, reconciliation: eduopsClone_(reconciliation) },
      health: { schemaVersion: "EDUOPS_MODULE_PROJECTION_V1", authoritySource: "EduOps runtime projection", available: true, reliability: eduopsStatePresentation_(reliability && reliability.state || "UNAVAILABLE") }
    },
    evaluatedCohort: { totalMatched: matchedRows.length, visiblePageCount: pageRows.length, snapshotId: reconciliation.snapshotId, snapshotAsOf: reconciliation.asOf },
    selection: { totalMatched: matchedRows.length, visibleSelectable: pageRows.filter(function (row) { return row.selectable === true; }).length, visibleBlocked: pageRows.filter(function (row) { return row.selectable !== true; }).length, totalAuthoritySelectable: Number(reconciliation.totalAuthoritySelectable || 0), authoritySource: "Actionability Resolver" }
  };
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
    schemaVersion: "EDUOPS_RECONCILIATION_V1",
    authoritySource: "Population Ledger + Actionability Resolver",
    canonicalPopulation: Number(snapshot && snapshot.totalRows || allRows.length),
    totalMatched: matchedRows.length,
    visiblePageCount: pageRows.length,
    visiblePageRange: pageRows.length ? (((query.page - 1) * query.pageSize + 1) + "-" + ((query.page - 1) * query.pageSize + pageRows.length)) : "0",
    returnedWindow: pageRows.length,
    eligibleOutsideCurrentWindow: Math.max(0, matchedRows.filter(function (row) { return row.selectable === true && !pageIds[row.applicantId]; }).length),
    matchingOnLaterPages: Math.max(0, matchedRows.length - pageRows.length),
    hiddenFromCurrentView: hiddenReasons.length,
    excludedFromOperation: matchedRows.filter(function (row) { return row.selectable !== true; }).length,
    totalAuthoritySelectable: matchedRows.filter(function (row) { return row.selectable === true; }).length,
    totalAuthorityBlocked: matchedRows.filter(function (row) { return row.selectable !== true; }).length,
    metricCounts: eduopsMetricCounts_(matchedRows),
    oldestVisibleAgeDays: oldestVisible,
    oldestMatchedAgeDays: eduopsOldestAge_(matchedRows),
    nextOperatorAction: pageRows[0] ? pageRows[0].nextAction : "",
    snapshotId: snapshotId,
    asOf: eduopsClean_(snapshot && snapshot.generatedAt || ""),
    integrityState: "PASS",
    queryFingerprint: eduopsWorkloadQueryFingerprint_(query),
    queryBinding: eduopsWorkloadQueryBinding_(query, snapshotId, snapshot),
    arithmetic: {
      population: "canonicalPopulation = totalMatched + hiddenFromCurrentView",
      matched: "totalMatched = visiblePageCount + matchingOnLaterPages"
    },
    hiddenReasonGroups: eduopsHiddenReasonGroups_(hiddenReasons),
    hiddenReasonPage: eduopsHiddenReasonPage_(hiddenReasons, 1, 50, snapshotId, eduopsWorkloadQueryFingerprint_(query)),
    hiddenReasonRows: hiddenReasons,
    hiddenReasons: hiddenReasons.slice(0, 50)
  };
}

function eduopsWorkloadQueryFingerprint_(query) {
  return JSON.stringify(eduopsCanonicalWorkloadQueryForBinding_(query));
}

function eduopsCanonicalWorkloadQueryForBinding_(query) {
  var q = eduopsNormalizeWorkloadQuery_(query || {});
  var filters = q.filters && typeof q.filters === "object" ? q.filters : {};
  var sort = q.sort && typeof q.sort === "object" ? q.sort : {};
  return {
    product: q.product,
    actionabilityState: q.actionabilityState,
    worklistKey: q.worklistKey,
    workScope: q.workScope,
    filters: {
      search: eduopsClean_(filters.search || ""),
      owner: eduopsClean_(filters.owner || ""),
      urgency: eduopsOptionalUpper_(filters.urgency),
      primaryRoute: eduopsClean_(filters.primaryRoute || ""),
      documentState: eduopsOptionalUpper_(filters.documentState),
      financeState: eduopsOptionalUpper_(filters.financeState),
      contactabilityState: eduopsOptionalUpper_(filters.contactabilityState),
      communicationState: eduopsClean_(filters.communicationState || ""),
      cooling: eduopsOptionalUpper_(filters.cooling),
      blockKind: eduopsClean_(filters.blockKind || "")
    },
    sort: {
      key: eduopsClean_(sort.key || "urgency"),
      direction: eduopsUpper_(sort.direction || "ASC") === "DESC" ? "DESC" : "ASC"
    },
    pageSize: q.pageSize
  };
}

function eduopsOptionalUpper_(value) {
  var cleaned = eduopsClean_(value || "");
  return cleaned ? cleaned.toUpperCase() : "";
}

function eduopsWorkloadQueryBinding_(query, snapshotId, snapshot) {
  var canonicalQuery = eduopsCanonicalWorkloadQueryForBinding_(query);
  return {
    schemaVersion: "EDUOPS_QUERY_BINDING_V1",
    authority: "SERVER_AUTHORED",
    product: canonicalQuery.product,
    snapshotId: eduopsClean_(snapshotId || ""),
    snapshotAsOf: eduopsClean_(snapshot && snapshot.generatedAt || snapshot && snapshot.snapshotAsOf || ""),
    query: canonicalQuery,
    queryFingerprint: eduopsWorkloadQueryFingerprint_(canonicalQuery)
  };
}

function eduopsHiddenReasonGroups_(hiddenReasons) {
  var out = {};
  (Array.isArray(hiddenReasons) ? hiddenReasons : []).forEach(function (item) {
    var key = eduopsClean_(item && item.reasonCode || "UNKNOWN") || "UNKNOWN";
    out[key] = Number(out[key] || 0) + 1;
  });
  return out;
}

function eduopsHiddenReasonPage_(hiddenReasons, page, pageSize, snapshotId, queryFingerprint) {
  var rows = Array.isArray(hiddenReasons) ? hiddenReasons : [];
  var totalHidden = rows.length;
  var totalPages = Math.max(1, Math.ceil(totalHidden / pageSize));
  var safePage = Math.min(Math.max(1, page), totalPages);
  var start = (safePage - 1) * pageSize;
  return {
    totalHidden: totalHidden,
    groupedCounts: eduopsHiddenReasonGroups_(rows),
    page: safePage,
    pageSize: pageSize,
    totalPages: totalPages,
    rows: rows.slice(start, start + pageSize),
    snapshotId: snapshotId,
    queryFingerprint: queryFingerprint
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
    enforcement: "Server-side capability checks are authoritative; browser controls are presentation only."
  };
}
