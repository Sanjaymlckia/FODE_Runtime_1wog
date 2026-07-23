var EDUOPS_COMMAND_DEFINITIONS = {
  DOCUMENT_REVIEW: { capability: "CAN_SAVE_DOCUMENT_STATUSES", batchSafe: false, risk: "STANDARD", publicLabel: "Document review" },
  FINANCE_EVIDENCE_DECISION: { capability: "CAN_VERIFY_PAYMENT", batchSafe: false, risk: "HIGH", publicLabel: "Finance evidence decision" },
  SEND_INDIVIDUAL_COMMUNICATION: { capability: "CAN_SEND_INDIVIDUAL_EMAIL", batchSafe: false, risk: "HIGH", publicLabel: "Individual communication" },
  CONTACTABILITY_CORRECTION: { capability: "CAN_OPEN_REVIEW_WORKSPACE", batchSafe: false, risk: "STANDARD", publicLabel: "Contactability correction" },
  PORTAL_ACCESS: { capability: "CAN_MANAGE_PORTAL_ACCESS", batchSafe: false, risk: "HIGH", dualApproval: true, publicLabel: "Portal access" },
  BATCH_COMMUNICATION: { capability: "CAN_RUN_BATCH_COMMUNICATIONS", batchSafe: true, risk: "HIGH", publicLabel: "Batch communication" }
};

function eduopsCommandDefinition_(operation) {
  var key = eduopsUpper_(operation, "");
  var definition = EDUOPS_COMMAND_DEFINITIONS[key];
  if (!definition) throw new Error("UNSUPPORTED_OPERATION: " + key);
  return { operation: key, publicLabel: definition.publicLabel, capability: definition.capability, batchSafe: definition.batchSafe === true, risk: definition.risk || "STANDARD", dualApproval: definition.dualApproval === true };
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
  var requested = Math.floor(Number(value));
  if (!isFinite(requested) || requested < 1) throw new Error("EXECUTION_LIMIT_REQUIRED");
  return Math.min(cap, requested);
}

function eduopsQueryFingerprintForSelection_(query) {
  return eduopsWorkloadQueryFingerprint_(query);
}

function eduopsServerSelectionQueryBinding_(source, resolved, request) {
  var binding = source && source.queryBinding && typeof source.queryBinding === "object" ? source.queryBinding : null;
  if (!binding) throw new Error("QUERY_SELECTION_CONTEXT_REQUIRED");
  if (eduopsClean_(binding.schemaVersion || "") !== "EDUOPS_QUERY_BINDING_V1") throw new Error("QUERY_BINDING_MISMATCH");
  if (eduopsClean_(binding.authority || "") !== "SERVER_AUTHORED") throw new Error("QUERY_BINDING_MISMATCH");
  if (eduopsClean_(binding.product || "") !== "FODE") throw new Error("STALE_SELECTION_BINDING");
  if (eduopsClean_(binding.snapshotId || "") !== resolved.snapshotId) throw new Error("STALE_SELECTION_BINDING");
  var query = binding.query && typeof binding.query === "object" ? binding.query : null;
  if (!query) throw new Error("QUERY_SELECTION_CONTEXT_REQUIRED");
  var bindingFingerprint = eduopsClean_(binding.queryFingerprint || "");
  var serverFingerprint = eduopsQueryFingerprintForSelection_(query);
  if (!bindingFingerprint || serverFingerprint !== bindingFingerprint) throw new Error("QUERY_BINDING_MISMATCH");
  return {
    product: "FODE",
    snapshotId: resolved.snapshotId,
    query: query,
    queryFingerprint: bindingFingerprint,
    queryBinding: eduopsClone_(binding)
  };
}

function eduopsResolveBatchSelection_(selection, resolved, request) {
  var source = selection && typeof selection === "object" ? selection : {};
  var mode = eduopsUpper_(source.selectionMode || "EXPLICIT_SELECTION");
  if (mode === "EXPLICIT") mode = "EXPLICIT_SELECTION";
  var snapshotId = eduopsClean_(source.snapshotId || "");
  if (eduopsClean_(source.product || "") !== "FODE" || snapshotId !== resolved.snapshotId) throw new Error("STALE_SELECTION_BINDING");
  var requestFingerprint = eduopsClean_(request && request.queryFingerprint || "");
  var selectionFingerprint = eduopsClean_(source.queryFingerprint || "");
  var excluded = {};
  normalizeSelectedApplicantBatchIds_(source.excludedApplicantIds || [], selectedApplicantBatchInputLimit_()).forEach(function (id) { excluded[id] = true; });
  var executionLimit = eduopsNormalizeExecutionLimit_(source.executionLimit != null ? source.executionLimit : request && request.executionLimit);
  var masterIds = [];
  var blockedCount = 0;
  var query = source.query && typeof source.query === "object" ? source.query : null;
  var queryBinding = null;
  if (mode === "ALL_ELIGIBLE_MATCHING_QUERY") {
    queryBinding = eduopsServerSelectionQueryBinding_(source, resolved, request);
    query = queryBinding.query;
    selectionFingerprint = queryBinding.queryFingerprint;
    var matched = eduopsFilterRows_(resolved.rows, eduopsNormalizeWorkloadQuery_(query), null);
    matched.sort(function (a, b) { return eduopsCompareRows_(a, b, query.sort); });
    matched.forEach(function (row) {
      if (row.selectable === true) masterIds.push(row.applicantId);
      else blockedCount++;
    });
  } else if (mode === "EXPLICIT_SELECTION") {
    if (selectionFingerprint && requestFingerprint && selectionFingerprint !== requestFingerprint) throw new Error("QUERY_BINDING_MISMATCH");
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
    queryBinding: queryBinding ? queryBinding.queryBinding : null,
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

function eduopsResolveCommunicationTemplate_(templateId) {
  var wanted = eduopsClean_(templateId || "");
  if (!wanted) throw new Error("EXPLICIT_TEMPLATE_SELECTION_REQUIRED");
  var metadata = eduopsCommunicationTemplateMetadata_();
  var sourceMetadata = typeof communicationTemplateGalleryMetadata_ === "function" ? communicationTemplateGalleryMetadata_() : [];
  var sourceByTemplateId = {};
  (Array.isArray(sourceMetadata) ? sourceMetadata : []).forEach(function (entry) {
    var id = eduopsClean_(entry && (entry.templateId || entry.messageType) || "");
    if (id) sourceByTemplateId[id] = entry;
  });
  for (var i = 0; i < metadata.length; i++) {
    if (metadata[i].templateId === wanted) {
      var template = eduopsClone_(metadata[i]);
      var source = sourceByTemplateId[wanted] || {};
      template.parentMessageType = eduopsClean_(source.parentMessageType || template.internalTemplateId || "");
      template.templateVersionId = eduopsClean_(source.templateVersionId || template.templateVersionId || "1");
      template.templateSource = eduopsClean_(source.templateSource || template.templateSource || "BUILT_IN");
      template.subjectTemplate = source.subjectTemplate;
      template.bodyTemplate = source.bodyTemplate;
      return template;
    }
  }
  throw new Error("UNKNOWN_COMMUNICATION_TEMPLATE");
}

function eduopsBatchRecipientProjection_(applicantId, canonical, rowObj, decision, template) {
  var row = canonical || {};
  var ctx = decision || {};
  var included = ctx.eligible === true && ctx.permitted === true && ctx.sendableNow === true;
  return {
    applicantId: applicantId,
    name: eduopsClean_(row.displayName || row.name || (typeof selectedApplicantBatchRecipientName_ === "function" ? selectedApplicantBatchRecipientName_(rowObj || {}) : "")),
    email: eduopsClean_(ctx.effectiveEmail || row.email || ""),
    actionability: eduopsClean_(row.actionabilityState || ""),
    lifecycle: eduopsClean_(row.canonicalLifecycle && (row.canonicalLifecycle.label || row.canonicalLifecycle.baseState || row.canonicalLifecycle.lifecycleStage) || ""),
    finance: eduopsClean_(row.canonicalFinanceState || ""),
    documentState: eduopsClean_(row.documentState || ""),
    coolingOffUntil: eduopsClean_(row.coolingOffUntil || ""),
    templateId: template.templateId,
    templateLabel: template.label,
    authorityDecision: included ? "INCLUDED" : "BLOCKED",
    authorityDecisionLabel: included ? "Included by Communication Authority" : "Blocked by Communication Authority",
    included: included,
    reasonCode: included ? "" : eduopsClean_(ctx.blockCode || ctx.code || "COMMUNICATION_NOT_AUTHORISED"),
    reason: included ? "Communication Authority permits this recipient." : eduopsClean_(ctx.blockReason || ctx.message || "Communication Authority did not authorise this recipient."),
    authoritySource: eduopsClean_(ctx.canonicalLifecycleAuthority && ctx.canonicalLifecycleAuthority.authoritySource || "Communication Authority"),
    presentation: {
      actionability: eduopsStatePresentation_(row.actionabilityState),
      lifecycle: eduopsCodePresentation_(row.canonicalLifecycle && (row.canonicalLifecycle.lifecycleStage || row.canonicalLifecycle.baseState), eduopsHumanize_(row.canonicalLifecycle && (row.canonicalLifecycle.lifecycleStage || row.canonicalLifecycle.baseState)), "", "Canonical Lifecycle Resolver"),
      finance: eduopsCodePresentation_(row.canonicalFinanceState, eduopsHumanize_(row.canonicalFinanceState), "", "Finance authority")
    }
  };
}

function eduopsBatchPreviewRecipientProjection_(authorityRecipient, canonical, template) {
  var recipient = authorityRecipient || {};
  var row = canonical || {};
  return {
    applicantId: eduopsClean_(recipient.applicantId || row.applicantId || ""),
    name: eduopsClean_(recipient.name || row.displayName || row.name || ""),
    email: eduopsClean_(recipient.email || row.email || ""),
    actionability: eduopsClean_(row.actionabilityState || ""),
    lifecycle: eduopsClean_(row.canonicalLifecycle && (row.canonicalLifecycle.label || row.canonicalLifecycle.baseState || row.canonicalLifecycle.lifecycleStage) || ""),
    finance: eduopsClean_(row.canonicalFinanceState || ""),
    documentState: eduopsClean_(row.documentState || ""),
    coolingOffUntil: eduopsClean_(row.coolingOffUntil || ""),
    templateId: template.templateId,
    templateLabel: template.label,
    authorityDecision: recipient.included === true ? "INCLUDED" : "BLOCKED",
    authorityDecisionLabel: recipient.included === true ? "Included by Communication Authority" : "Blocked by Communication Authority",
    included: recipient.included === true,
    reasonCode: recipient.included === true ? "" : eduopsClean_(recipient.authorityDiagnostics && recipient.authorityDiagnostics.blockCode || "COMMUNICATION_NOT_AUTHORISED"),
    reason: eduopsClean_(recipient.reason || (recipient.included === true ? "Communication Authority permits this recipient." : "Communication Authority did not authorise this recipient.")),
    authoritySource: eduopsClean_(recipient.authorityDiagnostics && recipient.authorityDiagnostics.authoritySource || "Communication Authority"),
    presentation: {
      actionability: eduopsStatePresentation_(row.actionabilityState),
      lifecycle: eduopsCodePresentation_(row.canonicalLifecycle && (row.canonicalLifecycle.lifecycleStage || row.canonicalLifecycle.baseState), eduopsHumanize_(row.canonicalLifecycle && (row.canonicalLifecycle.lifecycleStage || row.canonicalLifecycle.baseState)), "", "Canonical Lifecycle Resolver"),
      finance: eduopsCodePresentation_(row.canonicalFinanceState, eduopsHumanize_(row.canonicalFinanceState), "", "Finance authority")
    }
  };
}

function eduopsNormalizeDocumentReviewDocs_(docs, allowedFields) {
  var list = Array.isArray(docs) ? docs : [];
  var allowed = allowedFields && typeof allowedFields === "object" ? allowedFields : {};
  var seen = {};
  var out = [];
  list.forEach(function (item) {
    var field = eduopsClean_(item && item.file || "");
    if (!field) throw new Error("DOCUMENT_SOURCE_FIELD_REQUIRED");
    if (allowed[field] !== true) throw new Error("DOCUMENT_CONTEXT_MISMATCH");
    if (seen[field]) throw new Error("DUPLICATE_DOCUMENT_SOURCE_FIELD: " + field);
    seen[field] = true;
    out.push({
      file: field,
      status: eduopsClean_(item && item.status || ""),
      comment: eduopsClean_(item && item.comment || "")
    });
  });
  if (!out.length) throw new Error("DOCUMENT_DECISION_REQUIRED");
  return out;
}

function eduopsAllowedDocumentReviewFields_(manifest) {
  var allowed = {};
  (manifest && manifest.files || []).forEach(function (file) {
    var field = eduopsClean_(file && file.sourceField || "");
    if (field) allowed[field] = true;
  });
  return allowed;
}

function eduops_getBatchCommunicationCatalogue(payload) {
  var access = eduopsRequireAccess_();
  var definition = eduopsCommandDefinition_("BATCH_COMMUNICATION");
  eduopsRequireFeature_(definition.operation);
  eduopsRequireCommandCapability_(access, definition);
  var p = payload && typeof payload === "object" ? payload : {};
  var resolved = eduopsResolveFodeSnapshot_(access);
  var selection = eduopsResolveBatchSelection_(p.selection, resolved, p);
  var sheet = openDataSheet_();
  var rowLookup = buildSelectedApplicantRowLookup_(sheet);
  var canonicalLookup = {};
  resolved.rows.forEach(function (row) { canonicalLookup[row.applicantId] = row; });
  var recommendationCounts = {};
  selection.executionApplicantIds.forEach(function (id) {
    var recommended = eduopsCommunicationInternalTemplateId_(canonicalLookup[id] && canonicalLookup[id].recommendedMessageType || "");
    if (recommended) recommendationCounts[recommended] = Number(recommendationCounts[recommended] || 0) + 1;
  });
  var topRecommendation = Object.keys(recommendationCounts).sort(function (a, b) { return recommendationCounts[b] - recommendationCounts[a] || a.localeCompare(b); })[0] || "";
  var excludedLookup = {};
  selection.excludedApplicantIds.forEach(function (id) { excludedLookup[id] = true; });
  var masterRecipients = selection.selectedApplicantIds.filter(function (id) { return !excludedLookup[id]; }).map(function (id) {
    var row = canonicalLookup[id] || {};
    return {
      applicantId: id,
      name: eduopsClean_(row.displayName || row.name || ""),
      email: eduopsClean_(row.email || ""),
      actionability: eduopsClean_(row.actionabilityState || ""),
      lifecycle: eduopsClean_(row.canonicalLifecycle && (row.canonicalLifecycle.label || row.canonicalLifecycle.baseState || row.canonicalLifecycle.lifecycleStage) || ""),
      finance: eduopsClean_(row.canonicalFinanceState || ""),
      documentState: eduopsClean_(row.documentState || ""),
      coolingOffUntil: eduopsClean_(row.coolingOffUntil || ""),
      authorityDecision: "OPERATOR_SELECTED_NOT_EVALUATED",
      authorityDecisionLabel: "Operator selected - communication not yet evaluated",
      included: false,
      reasonCode: "AWAITING_COMMUNICATION_AUTHORITY",
      reason: "Communication Authority evaluates this applicant after an explicit communication is selected.",
      authoritySource: "Communication Authority",
      presentation: {
        actionability: eduopsStatePresentation_(row.actionabilityState),
        lifecycle: eduopsCodePresentation_(row.canonicalLifecycle && (row.canonicalLifecycle.lifecycleStage || row.canonicalLifecycle.baseState), row.canonicalLifecycle && row.canonicalLifecycle.label || eduopsHumanize_(row.canonicalLifecycle && (row.canonicalLifecycle.lifecycleStage || row.canonicalLifecycle.baseState)), "", "Canonical Lifecycle Resolver"),
        finance: eduopsCodePresentation_(row.canonicalFinanceState, eduopsHumanize_(row.canonicalFinanceState), "", "Finance authority")
      }
    };
  });
  var templates = eduopsCommunicationTemplateMetadata_().map(function (template) {
    var recipients = [];
    if (template.batchSafe) {
      selection.executionApplicantIds.forEach(function (id) {
        var rowObj = rowLookup[id] || null;
        var decision = rowObj ? resolveApplicantMessageContextFromRow_(rowObj, Number(rowObj._rowNumber || 0), sheet, template.internalTemplateId, {
          action: "selectedBatchPreview",
          actorEmail: access.email,
          actorRole: access.role,
          skipPortalUrlBuild: true
        }) : { eligible: false, permitted: false, sendableNow: false, blockCode: "APPLICANT_NOT_FOUND", blockReason: "Applicant record not found." };
        recipients.push(eduopsBatchRecipientProjection_(id, canonicalLookup[id], rowObj, decision, template));
      });
    } else {
      recipients = selection.executionApplicantIds.map(function (id) {
        return eduopsBatchRecipientProjection_(id, canonicalLookup[id], rowLookup[id], {
          eligible: false,
          permitted: false,
          sendableNow: false,
          blockCode: "MESSAGE_TYPE_NOT_BATCH_SAFE",
          blockReason: "This communication is not approved for batch use."
        }, template);
      });
    }
    var available = recipients.filter(function (recipient) { return recipient.included === true; }).length;
    var unavailable = recipients.length - available;
    var state = available === recipients.length && available > 0 ? "AVAILABLE_FOR_ALL" : available > 0 ? "AVAILABLE_FOR_SERVER_PARTITION" : "UNAVAILABLE";
    var firstBlocked = recipients.filter(function (recipient) { return recipient.included !== true; })[0] || {};
    return {
      templateId: template.templateId,
      label: template.label,
      description: template.description,
      availabilityState: state,
      selectable: available > 0,
      availabilityLabel: state === "AVAILABLE_FOR_ALL" ? "Available for " + available + " of " + recipients.length : state === "AVAILABLE_FOR_SERVER_PARTITION" ? "Available for server-authored partition of " + available : "Unavailable",
      recommended: template.internalTemplateId === topRecommendation,
      availableRecipientCount: available,
      unavailableRecipientCount: unavailable,
      reasonCode: state === "AVAILABLE_FOR_ALL" ? "" : eduopsClean_(firstBlocked.reasonCode || "COMMUNICATION_PARTITION_REQUIRED"),
      reason: state === "AVAILABLE_FOR_ALL" ? "Available for every applicant in the evaluated execution cohort." : state === "AVAILABLE_FOR_SERVER_PARTITION" ? "Communication Authority permits a server-authored partition of " + available + " recipients; " + unavailable + " are unavailable." : eduopsClean_(firstBlocked.reason || "No applicant in this execution cohort is currently authorised."),
      editable: false,
      editingReason: "Batch Communication Authority uses canonical server-rendered copy; editing is not permitted.",
      customisable: false,
      retired: false,
      authoritySource: "resolveApplicantMessageContextFromRow_",
      evaluatedSnapshot: resolved.snapshotId,
      evaluatedCohortBinding: eduopsClean_(selection.queryFingerprint || selection.snapshotId),
      recipients: recipients
    };
  });
  return {
    ok: true,
    schemaVersion: "EDUOPS_BATCH_COMMUNICATION_CATALOGUE_V1",
    state: "READY",
    statusLabel: "Cohort revalidated",
    executable: templates.some(function (template) { return template.selectable === true; }),
    authoritySource: "Communication Authority",
    snapshotId: resolved.snapshotId,
    selectionBinding: eduopsClone_(selection),
    masterCohortSize: Math.max(0, selection.masterCohortSize - selection.excludedCount),
    evaluatedCohortSize: selection.executionCohortSize,
    executionLimit: selection.executionLimit,
    remainingAfterEvaluation: selection.remainingAfterExecution,
    excludedCount: selection.excludedCount,
    blockedCount: selection.blockedCount,
    masterRecipients: masterRecipients,
    templates: templates
  };
}

function eduopsAuthorityPreview_(definition, request, applicantId, selection, communicationTemplate) {
  var draft = request.draft || {};
  if (definition.operation === "SEND_INDIVIDUAL_COMMUNICATION") {
    return admin_previewApplicantMessage({
      applicantId: applicantId,
      messageType: communicationTemplate.internalTemplateId,
      templateId: communicationTemplate.templateId,
      templateVersionId: communicationTemplate.templateVersionId,
      recipient: draft.recipient,
      cc: draft.cc,
      bcc: draft.bcc,
      subject: draft.subject,
      body: draft.body,
      sourceView: "eduops"
    });
  }
  if (definition.operation === "BATCH_COMMUNICATION") {
    return admin_previewSelectedApplicantBatch({
      applicantIds: selection.executionApplicantIds,
      excludedApplicantIds: [],
      messageType: communicationTemplate.internalTemplateId,
      templateId: communicationTemplate.templateId,
      templateVersionId: communicationTemplate.templateVersionId,
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

function eduopsSameApplicantIds_(left, right) {
  var a = (Array.isArray(left) ? left : []).map(eduopsClean_).filter(Boolean);
  var b = (Array.isArray(right) ? right : []).map(eduopsClean_).filter(Boolean);
  return a.length === b.length && a.every(function (id, index) { return id === b[index]; });
}

function eduopsRevalidateCommandForExecution_(preview, access) {
  var request = preview && preview.request && typeof preview.request === "object" ? preview.request : {};
  var definition = eduopsCommandDefinition_(preview && preview.operation);
  if (eduopsClean_(request.operation || "") !== definition.operation) throw new Error("OPERATION_CONTEXT_MISMATCH");
  eduopsRequireFeature_(definition.operation);
  eduopsRequireCommandCapability_(access, definition);
  var current = eduopsResolveFodeSnapshot_(access);
  if (current.snapshotId !== preview.snapshotId || eduopsClean_(request.snapshotId || request.expectedSnapshotId || "") !== current.snapshotId) throw new Error("STALE_SNAPSHOT: source changed before execution");
  var applicantId = eduopsClean_(preview.applicantId || "");
  var selection = request.selection && typeof request.selection === "object" ? eduopsResolveBatchSelection_(request.selection, current, request) : null;
  if (selection && !definition.batchSafe) throw new Error("BATCH_NOT_ALLOWED");
  if (selection && !eduopsSameApplicantIds_(selection.executionApplicantIds, preview.selectedApplicantIds)) throw new Error("EXECUTION_COHORT_MISMATCH");
  if (applicantId) {
    var exact = eduopsFodeApplicantRead_(applicantId, {}, current.snapshotId);
    if (!exact || exact.ok !== true || request.rowKey && eduopsClean_(request.rowKey) !== eduopsClean_(exact.rowKey)) throw new Error("APPLICANT_CONTEXT_MISMATCH");
  }
  if (definition.operation === "DOCUMENT_REVIEW") {
    var documentContext = eduopsHydrateDocumentPayload_(request.document || {}, true);
    if (!documentContext || documentContext.ok !== true || eduopsClean_(documentContext.payload.applicantId) !== applicantId) throw new Error("DOCUMENT_CONTEXT_MISMATCH");
    if (Array.isArray(request.draft && request.draft.docs)) {
      var manifest = admin_getApplicantDocumentManifest({ applicantId: applicantId, rowNumber: documentContext.payload.rowNumber });
      request.draft.docs = eduopsNormalizeDocumentReviewDocs_(request.draft.docs, eduopsAllowedDocumentReviewFields_(manifest));
    }
  }
  if (definition.operation === "FINANCE_EVIDENCE_DECISION" && eduopsUpper_(request.draft && request.draft.decision || "", "") !== "VERIFIED") throw new Error("UNSUPPORTED_FINANCE_DECISION: no dedicated rejection authority is proven");
  var communicationTemplate = null;
  if (definition.operation === "SEND_INDIVIDUAL_COMMUNICATION" || definition.operation === "BATCH_COMMUNICATION") communicationTemplate = eduopsResolveCommunicationTemplate_(request.draft && (request.draft.templateId || request.draft.messageType));
  var authorityResult = eduopsAuthorityPreview_(definition, request, applicantId, selection, communicationTemplate);
  if (!eduopsAuthorityPreviewReady_(authorityResult)) throw new Error("AUTHORITY_REVALIDATION_BLOCKED");
  if (selection) {
    var lookup = {};
    current.rows.forEach(function (row) { lookup[row.applicantId] = row; });
    var currentRecipients = (authorityResult.recipients || []).map(function (recipient) { return eduopsBatchPreviewRecipientProjection_(recipient, lookup[recipient && recipient.applicantId], communicationTemplate); }).filter(function (recipient) { return recipient.included === true; }).map(function (recipient) { return recipient.applicantId; });
    var previewRecipients = (preview.recipients || []).filter(function (recipient) { return recipient.included === true; }).map(function (recipient) { return recipient.applicantId; });
    if (!eduopsSameApplicantIds_(currentRecipients, previewRecipients)) throw new Error("RECIPIENT_AUTHORITY_CHANGED");
  }
  preview.authorityPreview = eduopsClone_(authorityResult);
  preview.executionAuthority = communicationTemplate ? { messageType: communicationTemplate.internalTemplateId } : null;
  return preview;
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
  var draft = p.draft && typeof p.draft === "object" ? p.draft : {};
  var communicationTemplate = null;
  if (definition.operation === "SEND_INDIVIDUAL_COMMUNICATION" || definition.operation === "BATCH_COMMUNICATION") {
    communicationTemplate = eduopsResolveCommunicationTemplate_(draft.templateId || draft.messageType);
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
      p.draft.docs = eduopsNormalizeDocumentReviewDocs_(p.draft.docs, eduopsAllowedDocumentReviewFields_(manifest));
    }
  }
  if (definition.operation === "FINANCE_EVIDENCE_DECISION" && eduopsUpper_(p.draft && p.draft.decision || "", "") !== "VERIFIED") {
    throw new Error("UNSUPPORTED_FINANCE_DECISION: no dedicated rejection authority is proven");
  }
  var authorityPreview = eduopsAuthorityPreview_(definition, p, applicantId, selection, communicationTemplate);
  var authorityReady = eduopsAuthorityPreviewReady_(authorityPreview) && (definition.operation !== "BATCH_COMMUNICATION" || Number(authorityPreview.eligible || authorityPreview.count || 0) > 0);
  var canonicalRecipientLookup = {};
  resolved.rows.forEach(function (row) { canonicalRecipientLookup[row.applicantId] = row; });
  var previewRecipients = selection && Array.isArray(authorityPreview.recipients) ? authorityPreview.recipients.map(function (recipient) { return eduopsBatchPreviewRecipientProjection_(recipient, canonicalRecipientLookup[recipient && recipient.applicantId], communicationTemplate); }) : [];
  var authorisedRecipients = previewRecipients.filter(function (recipient) { return recipient.included === true; });
  var executionSize = selection ? authorisedRecipients.length : 0;
  var templateLabel = communicationTemplate ? communicationTemplate.label : "";
  var now = Date.now();
  var preview = {
    ok: true,
    state: authorityReady ? "READY" : "BLOCKED",
    executable: authorityReady,
    statusLabel: authorityReady ? "Preview ready" : "Blocked by authority",
    statusReason: authorityReady ? "Final confirmation is required before execution." : eduopsClean_(authorityPreview && (authorityPreview.blockReason || authorityPreview.message || authorityPreview.error || authorityPreview.blockCode) || "Authoritative preview is not executable."),
    blockCode: authorityReady ? "" : eduopsClean_(authorityPreview && (authorityPreview.blockCode || authorityPreview.code) || ""),
    blockReason: authorityReady ? "" : eduopsClean_(authorityPreview && (authorityPreview.blockReason || authorityPreview.message || authorityPreview.error) || ""),
    unresolvedToken: authorityReady ? "" : eduopsClean_(authorityPreview && authorityPreview.unresolvedToken || ""),
    portalLinkRequired: authorityPreview && authorityPreview.portalLinkRequired === true,
    portalLinkHydrated: authorityPreview && authorityPreview.portalLinkHydrated === true,
    schemaVersion: "EDUOPS_COMMAND_PREVIEW_V1",
    previewId: "EDUOPS-PREVIEW-" + Utilities.getUuid(),
    operation: definition.operation,
    operationLabel: definition.publicLabel,
    product: "FODE",
    snapshotId: resolved.snapshotId,
    queryFingerprint: selection ? selection.queryFingerprint : eduopsClean_(p.queryFingerprint || ""),
    applicantId: applicantId,
    selectedApplicantIds: selection ? selection.executionApplicantIds.slice() : [],
    requiredCapability: definition.capability,
    risk: definition.risk,
    dualApprovalRequired: eduopsCommandRequiresDualApproval_(definition, p),
    idempotencyKey: eduopsClean_(p.idempotencyKey || ""),
    summary: selection ? "Send " + templateLabel + " to " + executionSize + " recipients" : eduopsHumanize_(definition.operation) + " for " + applicantId,
    actor: access.email,
    createdAt: new Date(now).toISOString(),
    expiresAt: new Date(now + 10 * 60 * 1000).toISOString(),
    request: eduopsClone_(p),
    executionAuthority: communicationTemplate ? { messageType: communicationTemplate.parentMessageType || communicationTemplate.internalTemplateId, templateId: communicationTemplate.templateId, templateVersionId: communicationTemplate.templateVersionId || "1" } : null,
    selectedTemplate: communicationTemplate ? {
      templateId: communicationTemplate.templateId,
      templateVersionId: communicationTemplate.templateVersionId || communicationTemplate.templateVersion || "1",
      templateSource: communicationTemplate.templateSource || "BUILT_IN",
      label: communicationTemplate.label,
      editable: definition.operation === "SEND_INDIVIDUAL_COMMUNICATION" && communicationTemplate.editable === true,
      customisable: definition.operation === "SEND_INDIVIDUAL_COMMUNICATION" && communicationTemplate.customisable === true,
      editingReason: definition.operation === "BATCH_COMMUNICATION" ? "Batch Communication Authority uses canonical server-rendered copy; editing is not permitted." : "Communication Authority controls editability."
    } : null,
    authorityPreview: eduopsClone_(authorityPreview),
    selectionBinding: selection ? eduopsClone_(selection) : null,
    masterCohortSize: selection ? Math.max(0, selection.masterCohortSize - selection.excludedCount) : 0,
    evaluatedCohortSize: selection ? selection.executionCohortSize : 0,
    executionCohortSize: executionSize,
    remainingAfterExecution: selection ? Math.max(0, selection.masterCohortSize - selection.excludedCount - executionSize) : 0,
    executionCap: selection ? selection.executionCap : 0,
    partitions: selection && authorityReady ? [{
      partitionKey: communicationTemplate.templateId,
      templateId: communicationTemplate.templateId,
      label: communicationTemplate.label,
      memberCount: executionSize,
      masterCohortSize: Math.max(0, selection.masterCohortSize - selection.excludedCount),
      remainingAfterExecution: Math.max(0, selection.masterCohortSize - selection.excludedCount - executionSize),
      executionCap: selection.executionCap,
      recipients: authorisedRecipients.map(function (recipient) { return eduopsClone_(recipient); })
    }] : [],
    recipients: selection ? eduopsClone_(previewRecipients) : [],
    subject: eduopsClean_(authorityPreview.subject || ""),
    body: authorityPreview.body || "",
    cc: eduopsClean_(authorityPreview.cc || ""),
    bcc: eduopsClean_(authorityPreview.bcc || ""),
    eligibleCount: selection ? executionSize : (authorityReady ? 1 : 0),
    blockedCount: selection ? Number(authorityPreview.blocked || 0) : (authorityReady ? 0 : 1),
    excludedCount: selection ? selection.excludedCount : 0
  };
  if (!preview.idempotencyKey) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  CacheService.getUserCache().put(eduopsPreviewCacheKey_(preview.previewId), JSON.stringify(preview), 600);
  var clientPreview = eduopsClone_(preview);
  delete clientPreview.executionAuthority;
  delete clientPreview.request;
  return clientPreview;
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
    preview = eduopsRevalidateCommandForExecution_(preview, access);
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
      messageType: preview.executionAuthority && preview.executionAuthority.messageType,
      templateId: preview.executionAuthority && preview.executionAuthority.templateId,
      templateVersionId: preview.executionAuthority && preview.executionAuthority.templateVersionId,
      confirmSend: true,
      sourceView: "eduops"
    });
  }
  var identity = eduopsFodeApplicantRead_(preview.applicantId, {}, preview.snapshotId);
  var rowNumber = Number(identity && identity.identity && identity.identity.rowNumber || 0);
  if (preview.operation === "DOCUMENT_REVIEW") {
    var document = request.document || {};
    var manifest = admin_getApplicantDocumentManifest({ applicantId: preview.applicantId, rowNumber: rowNumber });
    var docs = Array.isArray(draft.docs) && draft.docs.length ? draft.docs : [{ file: document.sourceField, status: draft.status, comment: draft.note }];
    docs = eduopsNormalizeDocumentReviewDocs_(docs, eduopsAllowedDocumentReviewFields_(manifest));
    return admin_updateDocStatuses({ applicantId: preview.applicantId, rowNumber: rowNumber, docs: docs });
  }
  if (preview.operation === "FINANCE_EVIDENCE_DECISION") {
    if (eduopsUpper_(draft.decision || "", "") !== "VERIFIED") throw new Error("UNSUPPORTED_FINANCE_DECISION: no dedicated rejection authority is proven");
    return admin_setPaymentVerified({ rowNumber: rowNumber, comment: draft.reason || "EduOps Finance verification" });
  }
  if (preview.operation === "SEND_INDIVIDUAL_COMMUNICATION") return admin_sendApplicantMessage({ applicantId: preview.applicantId, messageType: preview.executionAuthority && preview.executionAuthority.messageType, templateId: preview.executionAuthority && preview.executionAuthority.templateId, templateVersionId: preview.executionAuthority && preview.executionAuthority.templateVersionId, recipient: draft.recipient, cc: draft.cc, bcc: draft.bcc, subject: draft.subject, body: draft.body, confirmManualSingleSend: true, sourceView: "eduops" });
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
