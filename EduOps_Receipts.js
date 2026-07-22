function eduopsReceiptId_() {
  return "EDUOPS-RECEIPT-" + Utilities.getUuid();
}

function eduopsApplicantOutcomes_(preview, result) {
  if (Array.isArray(result.applicantOutcomes)) return result.applicantOutcomes.map(function (item) {
    return {
      applicantId: eduopsClean_(item && item.applicantId || ""),
      outcome: eduopsUpper_(item && item.outcome || "", "FAILED"),
      blockCode: eduopsClean_(item && item.blockCode || ""),
      reason: eduopsClean_(item && item.reason || ""),
      gmailAttempted: item && item.gmailAttempted === true,
      gmailAccepted: item && item.gmailAccepted === true,
      rowPatchConfirmed: item && item.rowPatchConfirmed === true,
      communicationRecorded: item && item.communicationRecorded === true
    };
  });
  if (Array.isArray(result.recipients)) {
    return result.recipients.map(function (item) {
      return {
        applicantId: eduopsClean_(item && item.applicantId || ""),
        outcome: item && item.included === true ? "COMPLETE" : "BLOCKED",
        reason: eduopsClean_(item && (item.reason || item.status) || "")
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
    return { applicantId: applicantId, outcome: result.ok === false ? "BLOCKED" : "COMPLETE", reason: eduopsClean_(result.message || result.error || "") };
  });
}

function eduopsBuildReceipt_(preview, authorityResult) {
  var result = authorityResult && typeof authorityResult === "object" ? authorityResult : {};
  var resultState = eduopsUpper_(result.result || result.state || "", "");
  var ok = result.ok !== false && resultState !== "BLOCKED" && resultState !== "ERROR";
  var applicantOutcomes = eduopsApplicantOutcomes_(preview, result);
  var sentCount = applicantOutcomes.filter(function (item) { return item.outcome === "SENT" || item.outcome === "COMPLETE"; }).length;
  var completeCount = sentCount;
  var blockedCount = applicantOutcomes.filter(function (item) { return item.outcome === "BLOCKED"; }).length;
  var failedCount = applicantOutcomes.filter(function (item) { return item.outcome === "FAILED"; }).length;
  var reconciliationRequiredCount = applicantOutcomes.filter(function (item) { return item.outcome === "RECONCILIATION_REQUIRED"; }).length;
  var unresolvedCount = applicantOutcomes.length - sentCount - blockedCount - failedCount - reconciliationRequiredCount;
  var receiptOutcome = reconciliationRequiredCount || unresolvedCount ? "RECONCILIATION_REQUIRED" : (sentCount && (blockedCount || failedCount) ? "PARTIAL" : (sentCount && !blockedCount && !failedCount ? "COMPLETE" : (blockedCount && !sentCount && !failedCount ? "BLOCKED" : "PARTIAL")));
  var receipt = {
    schemaVersion: "EDUOPS_RECEIPT_V1",
    receiptId: eduopsReceiptId_(),
    previewId: preview.previewId,
    operation: preview.operation,
    eventType: /COMMUNICATION$/.test(preview.operation) ? "COMMUNICATION" : "OPERATION",
    publicLabel: eduopsClean_(preview.operationLabel || ""),
    product: preview.product,
    snapshotId: preview.snapshotId,
    queryFingerprint: preview.queryFingerprint || "",
    applicantId: preview.applicantId || "",
    selectedApplicantIds: preview.selectedApplicantIds || [],
    communication: preview.selectedTemplate ? {
      templateId: eduopsClean_(preview.selectedTemplate.templateId || ""),
      templateLabel: eduopsClean_(preview.selectedTemplate.label || ""),
      subject: eduopsClean_(preview.subject || "")
    } : null,
    actor: preview.actor || "",
    at: new Date().toISOString(),
    outcome: receiptOutcome,
    authorityCode: eduopsClean_(result.code || (ok ? "OK" : "AUTHORITY_REJECTED")),
    authorityMessage: eduopsClean_(result.message || result.error || ""),
    applicantOutcomes: applicantOutcomes,
    completeCount: completeCount,
    sentCount: sentCount,
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

function eduops_getOperationHistory(payload) {
  eduopsRequireAccess_();
  var applicantId = eduopsClean_(payload && payload.applicantId || "");
  if (!applicantId) return { ok: false, code: "APPLICANT_ID_REQUIRED", receipts: [] };
  var key = "EDUOPS_HISTORY_" + applicantId.replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);
  var receipts = [];
  try { receipts = JSON.parse(CacheService.getUserCache().get(key) || "[]"); } catch (_err) {}
  return { ok: true, readOnly: true, schemaVersion: "EDUOPS_OPERATION_HISTORY_V1", authoritySource: "Audit/history services", applicantId: applicantId, receipts: receipts, communicationReceipts: receipts.filter(function (receipt) { return receipt.eventType === "COMMUNICATION"; }) };
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
