function buildQueueRow_(rowNumber, applicantId, name, extra) {
  var out = {
    rowNumber: Number(rowNumber || 0),
    applicantId: clean_(applicantId || ""),
    name: clean_(name || "")
  };
  var more = (extra && typeof extra === "object") ? extra : {};
  for (var k in more) {
    if (Object.prototype.hasOwnProperty.call(more, k)) out[k] = more[k];
  }
  return out;
}

function getQueueSlaBand_(ageDays) {
  var n = Number(ageDays);
  if (!Number.isFinite(n) || n < 0) return "unknown";
  if (n <= 3) return "green";
  if (n <= 7) return "orange";
  return "red";
}

function formatQueueTimestampDisplay_(value) {
  var ts = parseTime_(value);
  if (!(ts > 0)) return "";
  return Utilities.formatDate(new Date(ts), Session.getScriptTimeZone() || "GMT", "yyyy-MM-dd HH:mm");
}

function pickQueueReceivedInfo_(rowObj) {
  var row = rowObj || {};
  var candidates = [
    { key: "PortalTokenIssuedAt", value: row.PortalTokenIssuedAt || "" },
    { key: "PortalLastUpdateAt", value: row.PortalLastUpdateAt || "" },
    { key: "adapter_timestamp", value: row.adapter_timestamp || row.adapterTimestamp || "" },
    { key: "Timestamp", value: row.Timestamp || row.timestamp || "" },
    { key: "Created_At", value: row.Created_At || row.createdAt || row.created_at || "" }
  ];
  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i];
    var ts = parseTime_(candidate.value);
    if (!(ts > 0)) continue;
    var ageDays = Math.max(0, Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000)));
    return {
      source: candidate.key,
      receivedAt: new Date(ts).toISOString(),
      receivedDisplay: formatQueueTimestampDisplay_(candidate.value),
      ageDays: ageDays,
      ageLabel: ageDays + " day(s)",
      ageBand: getQueueSlaBand_(ageDays)
    };
  }
  return {
    source: "NONE",
    receivedAt: "",
    receivedDisplay: "",
    ageDays: null,
    ageLabel: "-",
    ageBand: "unknown"
  };
}

function applicantSuffix_(id) {
  var m = String(id || "").match(/(\d+)\s*$/);
  return m ? (Number(m[1]) || 0) : 0;
}

function compareQueueItems_(a, b) {
  var aTime = parseTime_(a && a.portalLastUpdateAt);
  var bTime = parseTime_(b && b.portalLastUpdateAt);
  if (bTime !== aTime) return bTime - aTime;
  var aToken = parseTime_(a && a.portalTokenIssuedAt);
  var bToken = parseTime_(b && b.portalTokenIssuedAt);
  if (bToken !== aToken) return bToken - aToken;
  var aSuffix = applicantSuffix_(a && a.applicantId);
  var bSuffix = applicantSuffix_(b && b.applicantId);
  if (bSuffix !== aSuffix) return bSuffix - aSuffix;
  return Number(a && a.rowNumber || 0) - Number(b && b.rowNumber || 0);
}

function hasMandatoryDocIssue_(rowObj, idx) {
  var row = rowObj || {};
  var mappings = adminDocumentMandatoryIssueMappings_();
  for (var i = 0; i < mappings.length; i++) {
    var m = mappings[i];
    if (idx && (!idx[m.file] || !idx[m.status])) continue;
    if (adminDocumentHasEvidence_(row, m.file) && adminDocumentFieldStatus_(row, m.status) !== "Verified") return true;
  }
  return false;
}

function isQueueCandidateRow_(rowObj) {
  var row = rowObj || {};
  var applicantId = clean_(row.ApplicantID || "");
  if (!applicantId) return false;

  var portalSubmitted = adminRowPortalSubmitted_(row);
  var docsVerified = adminRowDocsReviewVerified_(row);
  var paymentVerified = isCanonicalPaymentVerified_(row);

  return isExternalFdIntakeRow_(row) || portalSubmitted || docsVerified || paymentVerified;
}

function compareFdReceivedQueueItems_(a, b) {
  var aTime = parseTime_((a && (a.receivedAt || a.adapter_timestamp || a.portalLastUpdateAt || a.portalTokenIssuedAt)) || "");
  var bTime = parseTime_((b && (b.receivedAt || b.adapter_timestamp || b.portalLastUpdateAt || b.portalTokenIssuedAt)) || "");
  if (bTime !== aTime) return bTime - aTime;
  var aSuffix = applicantSuffix_(a && a.applicantId);
  var bSuffix = applicantSuffix_(b && b.applicantId);
  if (bSuffix !== aSuffix) return bSuffix - aSuffix;
  return Number(b && b.rowNumber || 0) - Number(a && a.rowNumber || 0);
}

function sliceQueueByOffset_(rows, offset, limit) {
  var list = Array.isArray(rows) ? rows : [];
  var from = Math.max(0, Number(offset || 0));
  var size = Math.max(1, Number(limit || 20));
  return list.slice(from, from + size);
}

function normalizeReviewQueueData_(data) {
  var names = ["fdReceived", "docs", "awaitingPayment", "payments", "anomalies", "paidApproved", "postPaymentIssues"];
  var src = (data && typeof data === "object") ? data : {};
  var out = { counts: {} };
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    var list = Array.isArray(src[name]) ? src[name] : [];
    out[name] = list;
    out.counts[name] = Number((src.counts && src.counts[name]) || list.length || 0);
  }
  return out;
}

function filterDocumentsToVerifyQueue_(rows) {
  return (Array.isArray(rows) ? rows : []).filter(function (row) {
    var item = row && typeof row === "object" ? row : {};
    var portalSubmitted = clean_(item.Portal_Submitted || "") === "Yes";
    var requiredDocumentUploadComplete = item.requiredDocumentUploadComplete === true;
    var docsVerified = clean_(item.Docs_Verified || "") === "Yes";
    // r22xB.1: Documents to Verify is officer review-ready only:
    // portalSubmitted && requiredDocumentUploadComplete && !docsVerified.
    return portalSubmitted && requiredDocumentUploadComplete && !docsVerified;
  });
}

function mergeQueuePageMeta_(queues, offset, limit) {
  var names = ["fdReceived", "docs", "awaitingPayment", "payments", "anomalies", "paidApproved", "postPaymentIssues"];
  var hasMore = false;
  var nextOffset = "";
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    var total = Number((queues && queues.counts && queues.counts[name]) || 0);
    if (offset + limit < total) {
      hasMore = true;
      nextOffset = offset + limit;
      break;
    }
  }
  return {
    hasMore: hasMore,
    nextOffset: hasMore ? nextOffset : ""
  };
}

function admin_getReviewQueues(payload) {
  var adminEmail = getCallerEmail_();
  if (!isAdmin_(adminEmail)) throw new Error("Access denied");
  payload = payload || {};
  var offset = Math.max(0, Number(payload.offset || 0));
  var limit = Math.max(1, Number(payload.limit || 20));
  var operational = buildOperationalRouteSnapshot_(canonicalPopulationSnapshot_(), {});
  var allRows = operational.rows || [];

  function buildReviewQueueRow_(row) {
    var item = row || {};
    var financeState = clean_(item.financeState || "").toUpperCase();
    return buildQueueRow_(item.rowNumber, item.applicantId, item.name, {
      ApplicantID: clean_(item.applicantId || ""),
      applicantId: clean_(item.applicantId || ""),
      effectiveEmail: clean_(item.effectiveEmail || ""),
      parentEmail: clean_(item.effectiveEmail || ""),
      correctedEmail: "",
      Parent_Phone: clean_(item.phone || ""),
      receivedAt: clean_(item.lastRelevantDate || ""),
      receivedDisplay: formatQueueTimestampDisplay_(item.lastRelevantDate || ""),
      receivedSource: clean_(item.lastRelevantDateSource || ""),
      ageDays: item.ageDays === "" ? "" : Number(item.ageDays || 0),
      ageLabel: item.ageDays === "" ? "" : String(Number(item.ageDays || 0)) + " day(s)",
      ageBand: getQueueSlaBand_(item.ageDays),
      actionabilityState: clean_(item.actionabilityState || ""),
      selectable: item.selectable === true,
      selectBlockReason: clean_(item.selectBlockReason || ""),
      recommendedMessageType: clean_(item.recommendedMessageType || ""),
      actionOwner: clean_(item.actionOwner || ""),
      canonicalLifecycle: {
        baseState: clean_(item.lifecycleBaseState || ""),
        lifecycleStage: clean_(item.lifecycleStage || ""),
        overlays: []
      },
      Portal_Submitted: clean_(item.lifecycleBaseState || "").toUpperCase() === "APPLICATION_RECEIVED" ? "No" : "Yes",
      Docs_Verified: clean_(item.lifecycleBaseState || "").toUpperCase() === "DOCUMENTS_TO_VERIFY" ? "No" : "Yes",
      Payment_Received: item.paymentEvidencePresent === true ? "Yes" : "No",
      Payment_Verified: item.paymentVerified === true ? "Yes" : "No",
      Payment_Badge: financeState === "PAID_VERIFIED" ? "Verified" : (financeState === "PAYMENT_TO_VERIFY" ? "Pending" : "Pending"),
      opsDocumentState: clean_(item.lifecycleBaseState || ""),
      opsLifecycleStageKey: clean_(item.lifecycleStage || item.lifecycleBaseState || ""),
      requiredDocumentUploadComplete: clean_(item.lifecycleBaseState || "").toUpperCase() !== "INCOMPLETE_DOCUMENTS",
      uploadedRequiredDocumentCount: 0,
      requiredDocumentCount: 0,
      missingRequiredDocuments: "",
      Books_Invoice_ID: "",
      Books_Invoice_Number: "",
      Books_Invoice_Status: "",
      docsFollowupSentAt: ""
    });
  }

  var fullData = normalizeReviewQueueData_({
    fdReceived: allRows.filter(function (row) {
      var base = clean_(row.lifecycleBaseState || "").toUpperCase();
      return base === "APPLICATION_RECEIVED" || base === "AWAITING_PORTAL_OR_INTAKE";
    }).map(buildReviewQueueRow_),
    docs: (operational.routeRows && operational.routeRows.ADMISSIONS_REVIEW || []).map(buildReviewQueueRow_),
    awaitingPayment: allRows.filter(function (row) {
      return clean_(row.financeState || "").toUpperCase() === "PAYMENT_PENDING" && row.activeFinanceWork === true;
    }).map(buildReviewQueueRow_),
    payments: allRows.filter(function (row) {
      return clean_(row.financeState || "").toUpperCase() === "PAYMENT_TO_VERIFY" && row.activeFinanceWork === true;
    }).map(buildReviewQueueRow_),
    anomalies: allRows.filter(function (row) {
      var routeKey = clean_(row.routeKey || "").toUpperCase();
      return !!clean_(row.financeExceptionCode || "") || routeKey === "MANAGEMENT_EXCEPTIONS" || routeKey === "UNKNOWN_UNCLASSIFIED";
    }).map(buildReviewQueueRow_),
    paidApproved: allRows.filter(function (row) {
      return clean_(row.financeState || "").toUpperCase() === "PAID_VERIFIED";
    }).map(buildReviewQueueRow_),
    postPaymentIssues: allRows.filter(function (row) {
      return clean_(row.financeState || "").toUpperCase() === "PAID_VERIFIED" && !!clean_(row.financeExceptionCode || "");
    }).map(buildReviewQueueRow_),
    counts: {}
  });

  fullData.counts = {
    fdReceived: fullData.fdReceived.length,
    docs: fullData.docs.length,
    awaitingPayment: fullData.awaitingPayment.length,
    payments: fullData.payments.length,
    anomalies: fullData.anomalies.length,
    paidApproved: fullData.paidApproved.length,
    postPaymentIssues: fullData.postPaymentIssues.length
  };

  var pageMeta = mergeQueuePageMeta_(fullData, offset, limit);
  return {
    ok: true,
    fdReceived: sliceQueueByOffset_(fullData.fdReceived, offset, limit),
    docs: sliceQueueByOffset_(fullData.docs, offset, limit),
    awaitingPayment: sliceQueueByOffset_(fullData.awaitingPayment, offset, limit),
    payments: sliceQueueByOffset_(fullData.payments, offset, limit),
    anomalies: sliceQueueByOffset_(fullData.anomalies, offset, limit),
    paidApproved: sliceQueueByOffset_(fullData.paidApproved, offset, limit),
    postPaymentIssues: sliceQueueByOffset_(fullData.postPaymentIssues, offset, limit),
    counts: fullData.counts,
    offset: offset,
    limit: limit,
    hasMore: pageMeta.hasMore,
    nextOffset: pageMeta.nextOffset
  };
}
