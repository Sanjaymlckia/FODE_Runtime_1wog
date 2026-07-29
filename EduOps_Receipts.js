function eduopsReceiptId_() {
  return "EDUOPS-RECEIPT-" + Utilities.getUuid();
}

function eduopsResultOutcome_(result, fallback) {
  var source = result && typeof result === "object" ? result : {};
  var outcome = eduopsUpper_(source.outcome || source.result || source.state || "", "");
  if (outcome === "ERROR") outcome = "FAILED";
  if (outcome === "PREVIEW") outcome = "";
  return outcome || eduopsUpper_(fallback || (source.ok === false ? "BLOCKED" : "COMPLETE"), "COMPLETE");
}

function eduopsReceiptBlockingOutcome_(outcome) {
  return /^(BLOCKED|FAILED|PARTIAL|UNCONFIRMED|MANUAL_REVIEW_REQUIRED|RECONCILIATION_REQUIRED)$/.test(eduopsUpper_(outcome || "", ""));
}

function eduopsApplicantOutcomes_(preview, result) {
  if (Array.isArray(result.applicantOutcomes)) {
    var seenApplicantIds = {};
    var outcomes = result.applicantOutcomes.map(function (item) {
      var blockReason = eduopsClean_(item && (item.blockReason || item.reason) || "");
      var outcome = eduopsUpper_(item && item.outcome || "", "FAILED");
      var applicantId = eduopsClean_(item && item.applicantId || "");
      if (applicantId) seenApplicantIds[applicantId] = true;
      return {
        applicantId: applicantId,
        outcome: outcome,
        idempotentReplay: item && item.idempotentReplay === true || outcome === "IDEMPOTENT_REPLAY" || outcome === "ALREADY_PROCESSED_FOR_OPERATION",
        replayOutcome: eduopsClean_(item && item.replayOutcome || ((outcome === "IDEMPOTENT_REPLAY" || outcome === "ALREADY_PROCESSED_FOR_OPERATION") ? "IDEMPOTENT_REPLAY" : "")),
        originalOutcome: eduopsClean_(item && item.originalOutcome || ""),
        blockCode: eduopsClean_(item && item.blockCode || ""),
        blockReason: blockReason,
        reason: blockReason,
        gmailAttempted: item && item.gmailAttempted === true,
        gmailAccepted: item && item.gmailAccepted === true,
        rowPatchConfirmed: item && item.rowPatchConfirmed === true,
        communicationRecorded: item && item.communicationRecorded === true,
        messageType: eduopsClean_(item && item.messageType || preview && preview.messageType || "")
      };
    });
    (Array.isArray(preview && preview.recipients) ? preview.recipients : []).forEach(function (recipient) {
      var applicantId = eduopsClean_(recipient && recipient.applicantId || "");
      if (!applicantId || seenApplicantIds[applicantId]) return;
      var included = recipient && recipient.included === true;
      var blockReason = included
        ? "The authorised recipient was not present in the authoritative execution result."
        : eduopsClean_(recipient && (recipient.blockReason || recipient.reason || recipient.status) || "");
      outcomes.push({
        applicantId: applicantId,
        outcome: included ? "UNCONFIRMED" : "BLOCKED",
        idempotentReplay: false,
        replayOutcome: "",
        blockCode: included ? "OUTCOME_UNCONFIRMED" : eduopsClean_(recipient && (recipient.blockCode || recipient.reasonCode) || "AUTHORITY_EXCLUDED"),
        blockReason: blockReason,
        reason: blockReason,
        gmailAttempted: false,
        gmailAccepted: false,
        rowPatchConfirmed: false,
        communicationRecorded: false,
        messageType: eduopsClean_(recipient && recipient.messageType || preview && preview.messageType || "")
      });
      seenApplicantIds[applicantId] = true;
    });
    (preview && preview.selectedApplicantIds || []).forEach(function (applicantIdValue) {
      var applicantId = eduopsClean_(applicantIdValue || "");
      if (!applicantId || seenApplicantIds[applicantId]) return;
      outcomes.push({
        applicantId: applicantId,
        outcome: "UNCONFIRMED",
        idempotentReplay: false,
        replayOutcome: "",
        blockCode: "OUTCOME_UNCONFIRMED",
        blockReason: "The selected applicant was not present in the authoritative execution result.",
        reason: "The selected applicant was not present in the authoritative execution result.",
        gmailAttempted: false,
        gmailAccepted: false,
        rowPatchConfirmed: false,
        communicationRecorded: false,
        messageType: eduopsClean_(preview && preview.messageType || "")
      });
    });
    return outcomes;
  }
  if (Array.isArray(result.recipients)) {
    return result.recipients.map(function (item) {
      var blockReason = eduopsClean_(item && (item.blockReason || item.reason || item.status) || "");
      return {
        applicantId: eduopsClean_(item && item.applicantId || ""),
        outcome: item && item.included === true ? "COMPLETE" : "BLOCKED",
        blockCode: item && item.included === true ? "" : eduopsClean_(item && (item.blockCode || item.reasonCode) || "BLOCKED"),
        blockReason: blockReason,
        reason: blockReason
      };
    });
  }
  var ids = (preview.selectedApplicantIds || []).slice();
  if (preview.applicantId) ids.push(preview.applicantId);
  if (preview.selectedApplicantIds && preview.selectedApplicantIds.length && (result.attempted !== undefined || result.sent !== undefined)) {
    var allSucceeded = Number(result.sent || 0) === ids.length && Number(result.failed || 0) === 0 && Number(result.blocked || 0) === 0;
    return ids.map(function (applicantId) {
      return { applicantId: applicantId, outcome: allSucceeded ? "COMPLETE" : "UNCONFIRMED", reason: allSucceeded ? "Existing batch authority confirmed the complete bounded cohort." : "Existing batch authority returned aggregate results without an exact applicant outcome." };
    });
  }
  return ids.map(function (applicantId) {
    var blockReason = eduopsClean_(result.blockReason || result.message || result.error || "");
    return {
      applicantId: applicantId,
      outcome: eduopsResultOutcome_(result, result.ok === false ? "BLOCKED" : "COMPLETE"),
      blockCode: eduopsClean_(result.blockCode || (result.ok === false ? result.code : "") || ""),
      blockReason: blockReason,
      reason: blockReason,
      gmailAttempted: result.gmailAttempted === true,
      gmailAccepted: result.gmailAccepted === true,
      rowPatchConfirmed: result.rowPatchConfirmed === true,
      communicationRecorded: result.communicationRecorded === true,
      idempotentReplay: result.idempotentReplay === true,
      replayOutcome: eduopsClean_(result.replayOutcome || result.originalOutcome || ""),
      messageType: eduopsClean_(result.messageType || preview && preview.messageType || "")
    };
  });
}

function eduopsCommunicationFingerprint_(value) {
  var text = String(value || "");
  try {
    var bytes = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
    return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, "");
  } catch (_err) {
    return String(text.length);
  }
}

function eduopsPngTimestamp_(value) {
  if (value === null || value === undefined || value === "") return "";
  var date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (isNaN(date.getTime())) return "";
  try {
    return Utilities.formatDate(date, "Pacific/Port_Moresby", "d MMMM yyyy, h:mm a");
  } catch (_err) {
    var shifted = new Date(date.getTime() + (10 * 60 * 60 * 1000));
    var months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    var hour = shifted.getUTCHours();
    var minute = String(shifted.getUTCMinutes()).padStart(2, "0");
    var suffix = hour >= 12 ? "pm" : "am";
    hour = hour % 12 || 12;
    return shifted.getUTCDate() + " " + months[shifted.getUTCMonth()] + " " + shifted.getUTCFullYear() + ", " + hour + ":" + minute + " " + suffix;
  }
}

function eduopsDeliveryEvidence_(result) {
  var source = result && typeof result === "object" ? result : {};
  var evidence = source.deliveryEvidence && typeof source.deliveryEvidence === "object"
    ? eduopsClone_(source.deliveryEvidence)
    : {};
  var outcomes = Array.isArray(source.applicantOutcomes) ? source.applicantOutcomes : [];
  var gmailAttemptedCount = outcomes.filter(function (item) { return item && item.gmailAttempted === true; }).length;
  var gmailAcceptedCount = outcomes.filter(function (item) { return item && item.gmailAccepted === true; }).length;
  var rowPatchConfirmedCount = outcomes.filter(function (item) { return item && item.rowPatchConfirmed === true; }).length;
  var communicationRecordedCount = outcomes.filter(function (item) { return item && item.communicationRecorded === true; }).length;
  var reconciliationRequiredCount = outcomes.filter(function (item) { return eduopsUpper_(item && item.outcome || "", "") === "RECONCILIATION_REQUIRED"; }).length;
  var idempotentReplayCount = outcomes.filter(function (item) {
    var outcome = eduopsUpper_(item && item.outcome || "", "");
    return item && item.idempotentReplay === true || outcome === "IDEMPOTENT_REPLAY" || outcome === "ALREADY_PROCESSED_FOR_OPERATION";
  }).length;
  var acceptedOutcomeCount = gmailAcceptedCount;
  evidence.gmailAttempted = evidence.gmailAttempted === true || source.gmailAttempted === true || gmailAttemptedCount > 0;
  evidence.gmailAccepted = evidence.gmailAccepted === true || source.gmailAccepted === true || gmailAcceptedCount > 0;
  evidence.rowPatchConfirmed = evidence.rowPatchConfirmed === true
    || source.rowPatchConfirmed === true
    || acceptedOutcomeCount > 0 && rowPatchConfirmedCount === acceptedOutcomeCount;
  evidence.communicationRecorded = evidence.communicationRecorded === true
    || source.communicationRecorded === true
    || acceptedOutcomeCount > 0 && communicationRecordedCount === acceptedOutcomeCount;
  evidence.effectiveEmail = eduopsClean_(evidence.effectiveEmail || source.effectiveEmail || "");
  evidence.sentAt = eduopsClean_(evidence.sentAt || source.sentAt || "");
  if (outcomes.length) {
    evidence.applicantOutcomeCount = outcomes.length;
    evidence.gmailAttemptedCount = gmailAttemptedCount;
    evidence.gmailAcceptedCount = gmailAcceptedCount;
    evidence.rowPatchConfirmedCount = rowPatchConfirmedCount;
    evidence.communicationRecordedCount = communicationRecordedCount;
    evidence.reconciliationRequiredCount = reconciliationRequiredCount;
    evidence.idempotentReplayCount = idempotentReplayCount;
    evidence.gmailAttemptedAny = gmailAttemptedCount > 0;
    evidence.gmailAcceptedAny = gmailAcceptedCount > 0;
    evidence.rowPatchConfirmedAllAccepted = acceptedOutcomeCount > 0 && rowPatchConfirmedCount === acceptedOutcomeCount;
    evidence.communicationRecordedAllAccepted = acceptedOutcomeCount > 0 && communicationRecordedCount === acceptedOutcomeCount;
  }
  return evidence;
}

function eduopsBuildReceipt_(preview, authorityResult) {
  var result = authorityResult && typeof authorityResult === "object" ? authorityResult : {};
  var resultState = eduopsResultOutcome_(result, result.ok === false ? "BLOCKED" : "COMPLETE");
  var ok = result.ok !== false && resultState !== "BLOCKED" && resultState !== "ERROR";
  var applicantOutcomes = eduopsApplicantOutcomes_(preview, result);
  var sentCount = applicantOutcomes.filter(function (item) { return item.outcome === "SENT" || item.outcome === "COMPLETE"; }).length;
  var replayCount = applicantOutcomes.filter(function (item) { return item.outcome === "IDEMPOTENT_REPLAY" || item.outcome === "ALREADY_PROCESSED_FOR_OPERATION"; }).length;
  var completeCount = sentCount + replayCount;
  var blockedCount = applicantOutcomes.filter(function (item) { return item.outcome === "BLOCKED" || item.outcome === "MANUAL_REVIEW_REQUIRED"; }).length;
  var failedCount = applicantOutcomes.filter(function (item) { return item.outcome === "FAILED"; }).length;
  var reconciliationRequiredCount = applicantOutcomes.filter(function (item) { return item.outcome === "RECONCILIATION_REQUIRED"; }).length;
  var unresolvedCount = applicantOutcomes.length - sentCount - replayCount - blockedCount - failedCount - reconciliationRequiredCount;
  var receiptOutcome = resultState;
  if (!receiptOutcome || receiptOutcome === "COMPLETE" && applicantOutcomes.length > 1) {
    receiptOutcome = reconciliationRequiredCount || unresolvedCount
      ? "RECONCILIATION_REQUIRED"
      : (sentCount + replayCount) && (blockedCount || failedCount)
        ? "PARTIAL"
        : (sentCount + replayCount) && !blockedCount && !failedCount
          ? "COMPLETE"
          : blockedCount && !(sentCount + replayCount) && !failedCount
            ? "BLOCKED"
            : "PARTIAL";
  }
  var firstBlocked = applicantOutcomes.filter(function (item) {
    return eduopsReceiptBlockingOutcome_(item && item.outcome)
      && !!eduopsClean_(item && (item.blockCode || item.blockReason || item.reason) || "");
  })[0] || {};
  var hasBlockingOutcome = !/^(SENT|COMPLETE|IDEMPOTENT_REPLAY|ALREADY_PROCESSED_FOR_OPERATION)$/.test(receiptOutcome);
  var blockCode = hasBlockingOutcome
    ? eduopsClean_(result.blockCode || result.code || firstBlocked.blockCode || "")
    : "";
  var blockReason = hasBlockingOutcome
    ? eduopsClean_(result.blockReason || result.error || firstBlocked.blockReason || firstBlocked.reason || result.message || "")
    : "";
  var authorityMessage = eduopsClean_(result.message || result.error || result.blockReason || "");
  var operationReplay = result.idempotentReplay === true
    || resultState === "IDEMPOTENT_REPLAY"
    || resultState === "ALREADY_PROCESSED_FOR_OPERATION";
  var occurredAt = new Date().toISOString();
  var commandType = eduopsClean_(preview.commandType || preview.operation || "");
  var messageType = eduopsClean_(preview.messageType || preview.executionAuthority && preview.executionAuthority.messageType || result.messageType || "");
  var receiptId = eduopsClean_(preview.receiptId || "");
  if (!receiptId) throw new Error("RECEIPT_IDENTITY_REQUIRED");
  var receipt = {
    schemaVersion: "EDUOPS_RECEIPT_V1",
    contractVersion: "R390B1",
    receiptId: receiptId,
    operationId: eduopsClean_(preview.operationId || result.operationId || ""),
    previewId: eduopsClean_(preview.previewId || result.previewId || ""),
    operation: commandType,
    commandType: commandType,
    messageType: messageType,
    eventType: /COMMUNICATION$/.test(commandType) ? "COMMUNICATION" : "OPERATION",
    publicLabel: eduopsClean_(preview.operationLabel || ""),
    product: preview.product,
    snapshotId: preview.snapshotId,
    queryFingerprint: preview.queryFingerprint || "",
    applicantId: eduopsClean_(preview.applicantId || result.applicantId || ""),
    selectedApplicantIds: preview.selectedApplicantIds || [],
    communication: preview.selectedTemplate ? {
      templateId: eduopsClean_(preview.selectedTemplate.templateId || ""),
      templateVersionId: eduopsClean_(preview.selectedTemplate.templateVersionId || preview.selectedTemplate.templateVersion || "1"),
      templateSource: eduopsClean_(preview.selectedTemplate.templateSource || "BUILT_IN"),
      templateLabel: eduopsClean_(preview.selectedTemplate.label || ""),
      contentEdited: preview.selectedTemplate.contentEdited === true || (preview.request && preview.request.draft && (preview.request.draft.subject || preview.request.draft.body) ? true : false),
      subject: eduopsClean_(preview.subject || ""),
      subjectFingerprint: typeof eduopsCommunicationFingerprint_ === "function" ? eduopsCommunicationFingerprint_(preview.subject || "") : String(preview.subject || "").length,
      bodyFingerprint: typeof eduopsCommunicationFingerprint_ === "function" ? eduopsCommunicationFingerprint_(preview.body || "") : String(preview.body || "").length,
      cc: eduopsClean_(preview.cc || preview.authorityPreview && preview.authorityPreview.cc || ""),
      bcc: eduopsClean_(preview.bcc || preview.authorityPreview && preview.authorityPreview.bcc || ""),
      portalLinkRequired: preview.authorityPreview && preview.authorityPreview.portalLinkRequired === true,
      portalLinkHydrated: preview.authorityPreview && preview.authorityPreview.portalLinkHydrated === true
    } : null,
    actor: eduopsClean_(preview.actor || result.actor || result.actorEmail || ""),
    occurredAt: occurredAt,
    occurredAtPng: eduopsPngTimestamp_(occurredAt),
    at: occurredAt,
    outcome: receiptOutcome,
    blockCode: blockCode,
    blockReason: blockReason,
    deliveryEvidence: eduopsDeliveryEvidence_(result),
    idempotentReplay: operationReplay,
    replayOutcome: operationReplay ? eduopsClean_(result.replayOutcome || "IDEMPOTENT_REPLAY") : "",
    originalOutcome: operationReplay ? eduopsClean_(result.originalOutcome || "") : "",
    replayCode: operationReplay ? eduopsClean_(result.blockCode || result.code || "ALREADY_PROCESSED_FOR_OPERATION") : "",
    stateFingerprint: eduopsClean_(preview.stateFingerprint || result.stateFingerprint || ""),
    cooldownCycle: eduopsClean_(preview.cooldownCycle || result.cooldownCycle || ""),
    idempotencyKey: eduopsClean_(preview.idempotencyKey || result.idempotencyKey || ""),
    idempotencyAuthority: "TRANSIENT_USER_CACHE",
    idempotencyDurability: "TRANSIENT_CACHE_ONLY",
    durableIdempotency: false,
    authorityCode: eduopsClean_(result.code || (ok ? "OK" : "AUTHORITY_REJECTED")),
    authorityMessage: authorityMessage || blockReason,
    applicantOutcomes: applicantOutcomes,
    completeCount: completeCount,
    sentCount: sentCount,
    replayCount: replayCount,
    blockedCount: blockedCount,
    failedCount: failedCount,
    reconciliationRequiredCount: reconciliationRequiredCount,
    unresolvedCount: unresolvedCount
  };
  try {
    if (typeof logAdminEvent_ === "function") logAdminEvent_("EDUOPS_GUARDED_OPERATION_RECEIPT", receipt);
    else Logger.log("EDUOPS_GUARDED_OPERATION_RECEIPT " + JSON.stringify(receipt));
  } catch (_logErr) {}
  eduopsRecordReceiptHistory_(receipt);
  return receipt;
}

function eduopsRecordReceiptHistory_(receipt) {
  var cache = CacheService.getUserCache();
  var applicantIds = (receipt.selectedApplicantIds || []).slice();
  if (receipt.applicantId) applicantIds.push(receipt.applicantId);
  applicantIds.forEach(function (applicantId) {
    var key = "EDUOPS_HISTORY_" + eduopsClean_(applicantId).replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);
    var existing = [];
    try { existing = JSON.parse(cache.get(key) || "[]"); } catch (_err) {}
    existing.unshift(receipt);
    cache.put(key, JSON.stringify(existing.slice(0, 25)), 21600);
  });
}

function eduopsReceiptHistoryProjection_(receipt) {
  var source = receipt && typeof receipt === "object" ? eduopsClone_(receipt) : {};
  var occurredAt = eduopsClean_(source.occurredAt || source.at || "");
  var firstBlocked = (Array.isArray(source.applicantOutcomes) ? source.applicantOutcomes : []).filter(function (item) {
    return eduopsReceiptBlockingOutcome_(item && item.outcome)
      && !!eduopsClean_(item && (item.blockCode || item.blockReason || item.reason) || "");
  })[0] || {};
  var receiptHasBlocker = eduopsReceiptBlockingOutcome_(source.outcome);
  source.operationId = eduopsClean_(source.operationId || "");
  source.previewId = eduopsClean_(source.previewId || "");
  source.receiptId = eduopsClean_(source.receiptId || "");
  source.commandType = eduopsClean_(source.commandType || source.operation || "");
  source.operation = source.commandType;
  source.messageType = eduopsClean_(source.messageType || source.communication && source.communication.messageType || "");
  source.blockCode = receiptHasBlocker ? eduopsClean_(source.blockCode || firstBlocked.blockCode || "") : "";
  source.blockReason = receiptHasBlocker ? eduopsClean_(source.blockReason || firstBlocked.blockReason || firstBlocked.reason || "") : "";
  source.actor = eduopsClean_(source.actor || "");
  source.occurredAt = occurredAt;
  source.occurredAtPng = eduopsClean_(source.occurredAtPng || "") || eduopsPngTimestamp_(occurredAt);
  source.at = occurredAt;
  source.deliveryEvidence = source.deliveryEvidence && typeof source.deliveryEvidence === "object" ? source.deliveryEvidence : {};
  source.idempotentReplay = source.idempotentReplay === true;
  source.idempotencyAuthority = "TRANSIENT_USER_CACHE";
  source.idempotencyDurability = "TRANSIENT_CACHE_ONLY";
  source.durableIdempotency = false;
  return source;
}

function eduops_getOperationHistory(payload) {
  eduopsRequireAccess_();
  var applicantId = eduopsClean_(payload && payload.applicantId || "");
  if (!applicantId) return { ok: false, code: "APPLICANT_ID_REQUIRED", receipts: [] };
  var key = "EDUOPS_HISTORY_" + applicantId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);
  var receipts = [];
  try { receipts = JSON.parse(CacheService.getUserCache().get(key) || "[]"); } catch (_err) {}
  receipts = receipts.map(eduopsReceiptHistoryProjection_);
  return {
    ok: true,
    readOnly: true,
    transient: true,
    durableLedger: false,
    schemaVersion: "EDUOPS_OPERATION_HISTORY_V1",
    authoritySource: "Transient User Cache receipt history; not a durable communication ledger",
    applicantId: applicantId,
    receipts: receipts,
    communicationReceipts: receipts.filter(function (receipt) { return receipt.eventType === "COMMUNICATION"; })
  };
}

function eduops_recoverCommandReceipt(payload) {
  eduopsRequireAccess_();
  var p = payload && typeof payload === "object" ? payload : {};
  var previewId = eduopsClean_(p.previewId || "");
  var idempotencyKey = eduopsClean_(p.idempotencyKey || "");
  if (!previewId || !idempotencyKey) return { ok: false, readOnly: true, code: "RECOVERY_CONTEXT_REQUIRED", receipt: null };
  var cached = CacheService.getUserCache().get(eduopsPreviewCacheKey_(previewId));
  var contextFingerprint = "";
  if (cached) {
    try { contextFingerprint = eduopsIdempotencyContext_(JSON.parse(cached)); } catch (_err) {}
  }
  var receipt = eduopsReadIdempotentReceipt_(idempotencyKey, contextFingerprint);
  return {
    ok: !!receipt,
    readOnly: true,
    code: receipt ? "RECEIPT_FOUND" : "RECEIPT_NOT_FOUND",
    previewId: previewId,
    idempotencyKey: idempotencyKey,
    receipt: receipt || null
  };
}
