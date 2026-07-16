function eduopsReceiptId_() {
  return "EDUOPS-RECEIPT-" + Utilities.getUuid();
}

function eduopsApplicantOutcomes_(preview, result) {
  if (Array.isArray(result.applicantOutcomes)) return result.applicantOutcomes;
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
  var completeCount = applicantOutcomes.filter(function (item) { return item.outcome === "COMPLETE"; }).length;
  var blockedCount = applicantOutcomes.filter(function (item) { return item.outcome === "BLOCKED"; }).length;
  var unresolvedCount = applicantOutcomes.length - completeCount - blockedCount;
  var receipt = {
    schemaVersion: "EDUOPS_RECEIPT_V1",
    receiptId: eduopsReceiptId_(),
    previewId: preview.previewId,
    operation: preview.operation,
    product: preview.product,
    snapshotId: preview.snapshotId,
    queryFingerprint: preview.queryFingerprint || "",
    applicantId: preview.applicantId || "",
    selectedApplicantIds: preview.selectedApplicantIds || [],
    actor: preview.actor || "",
    at: new Date().toISOString(),
    outcome: unresolvedCount ? "PARTIAL" : blockedCount && completeCount ? "PARTIAL" : ok && !blockedCount ? "COMPLETE" : "BLOCKED",
    authorityCode: eduopsClean_(result.code || (ok ? "OK" : "AUTHORITY_REJECTED")),
    authorityMessage: eduopsClean_(result.message || result.error || ""),
    applicantOutcomes: applicantOutcomes,
    completeCount: completeCount,
    blockedCount: blockedCount,
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
  return { ok: true, readOnly: true, applicantId: applicantId, receipts: receipts };
}
