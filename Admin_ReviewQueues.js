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
  var force = payload && (payload.force === 1 || payload.force === true);
  var cache = CacheService.getUserCache();
  var cacheKey = getDashboardCacheKey_(adminEmail);
  var fullData = null;
  Logger.log("R232_QUEUE_CANARY ENTRY " + JSON.stringify({
    force: force,
    offset: offset,
    limit: limit
  }));
  if (!force) {
    try {
      var cached = cache.get(cacheKey);
      if (cached) fullData = JSON.parse(cached);
    } catch (_cacheReadErr) {}
  }

  if (!fullData || typeof fullData !== "object") {
    var sheet = openDataSheet_();
    var data = sheet.getDataRange().getValues();
    if (!data || data.length < 2) {
      fullData = {
        fdReceived: [],
        docs: [],
        awaitingPayment: [],
        payments: [],
        anomalies: [],
        paidApproved: [],
        postPaymentIssues: [],
        counts: { fdReceived: 0, payments: 0, docs: 0, awaitingPayment: 0, anomalies: 0, paidApproved: 0, postPaymentIssues: 0 }
      };
    } else {
      var headers = data[0];
      var idx = headerIndex_(headers);
      var payments = [];
      var fdReceived = [];
      var docs = [];
      var awaitingPayment = [];
      var anomalies = [];
      var paidApproved = [];
      var postPaymentIssues = [];
      var debugRows = [];
      var scannedCount = 0;
      var skippedCount = 0;
      var candidateCount = 0;
      function pushQueueItem_(target, item) {
        var rowNum = Number(item && item.rowNumber || 0);
        if (!Number.isFinite(rowNum) || rowNum < 2) return;
        target.push(item);
      }

      Logger.log("QUEUE_SCAN_START " + JSON.stringify({
        user: Session.getEffectiveUser().getEmail(),
        force: force
      }));

      for (var r = 1; r < data.length; r++) {
        var row = data[r] || [];
        var rowObj = {};
        for (var c = 0; c < headers.length; c++) {
          var h = clean_(headers[c]);
          if (!h) continue;
          rowObj[h] = row[c];
        }

        scannedCount++;
        if (!isQueueCandidateRow_(rowObj)) {
          skippedCount++;
          continue;
        }
        candidateCount++;

        var applicantId = clean_(rowObj.ApplicantID || "");
        var firstName = clean_(rowObj.First_Name || "");
        var lastName = clean_(rowObj.Last_Name || "");
        var name = (firstName + " " + lastName).trim();
        var parentEmail = clean_(rowObj.Parent_Email || "");
        var correctedEmail = clean_(rowObj.Parent_Email_Corrected || "");
        var effectiveEmail = correctedEmail || parentEmail;
        var parentPhone = clean_(rowObj.Parent_Phone || rowObj.Mobile || rowObj.WhatsApp || rowObj.Contact_Number || rowObj.Phone || rowObj.Phone_Number || "");

        var paymentFacts = adminRowPaymentAuthorityFacts_(rowObj);
        var paymentVerifiedRaw = paymentFacts.paymentVerifiedRaw;
        var paymentBadge = paymentFacts.paymentBadge;
        var receiptUrl = clean_(rowObj.Fee_Receipt_File || "");
        var mandatoryDocIssue = hasMandatoryDocIssue_(rowObj, idx);

        var docsFollowupSentAt = getDocsFollowupSentAt_(rowObj);
        var authorityProjection = typeof compatibilityCommunicationAuthorityProjection_ === "function"
          ? compatibilityCommunicationAuthorityProjection_(rowObj, r + 1)
          : null;
        var receivedInfo = pickQueueReceivedInfo_(rowObj);
        var qItem = {
          rowNumber: r + 1,
          applicantId: applicantId,
          name: name,
          ApplicantID: applicantId,
          parentEmail: parentEmail,
          correctedEmail: correctedEmail,
          effectiveEmail: effectiveEmail,
          Parent_Phone: parentPhone,
          portalLastUpdateAt: rowObj.PortalLastUpdateAt || "",
          portalTokenIssuedAt: rowObj.PortalTokenIssuedAt || "",
          receivedAt: receivedInfo.receivedAt,
          receivedDisplay: receivedInfo.receivedDisplay,
          receivedSource: receivedInfo.source,
          ageDays: receivedInfo.ageDays,
          ageLabel: receivedInfo.ageLabel,
          ageBand: receivedInfo.ageBand,
          Handled_By: clean_(rowObj.Handled_By || ""),
          Handled_At: clean_(rowObj.Handled_At || ""),
          Last_Contacted_At: clean_(rowObj.Last_Contacted_At || ""),
          Email_Last_Sent_At: clean_(rowObj.Email_Last_Sent_At || ""),
          Ack_Email_Sent_At: clean_(rowObj.Ack_Email_Sent_At || ""),
          Payment_Verified_At: clean_(rowObj.Payment_Verified_At || rowObj.Payment_Verified_Date || ""),
          Classroom_Handover_At: clean_(rowObj.Classroom_Handover_At || rowObj.Classroom_Notified_At || ""),
          Enrolled_By: clean_(rowObj.Enrolled_By || ""),
          Enrolled_At: clean_(rowObj.Enrolled_At || ""),
          docsFollowupSentAt: safeStr_(docsFollowupSentAt || "")
        };
        if (authorityProjection && typeof authorityProjection === "object") {
          for (var authorityKey in authorityProjection) {
            if (Object.prototype.hasOwnProperty.call(authorityProjection, authorityKey)) qItem[authorityKey] = authorityProjection[authorityKey];
          }
        }

        var hasActivity = hasStudentActivity_(rowObj);
        var portalSubmitted = adminRowPortalSubmitted_(rowObj);
        var docsReviewVerified = adminRowDocsReviewVerified_(rowObj);
        var paymentEvidencePresent = paymentFacts.paymentEvidencePresent;
        var paymentReceived = paymentEvidencePresent;
        var paymentVerified = paymentFacts.paymentVerified;
        var enrolledConfirmed = paymentVerified;
        var opsRequiredDocsSummary = adminOpsRequiredDocumentUploadSummary_(rowObj);
        var opsDocumentState = adminOpsDocumentStateFromRow_(rowObj);
        var opsLifecycleStageKey = adminOpsLifecycleStageKeyFromRow_(rowObj);
        var requiredDocumentUploadComplete = !!(opsRequiredDocsSummary && opsRequiredDocsSummary.requiredDocumentUploadComplete);
        // r22xB.1: Documents to Verify is officer review-ready only:
        // portalSubmitted && requiredDocumentUploadComplete && !docsVerified.
        var docsQueueMatch = portalSubmitted && requiredDocumentUploadComplete && !docsReviewVerified;
        var awaitingPaymentQueueMatch = docsReviewVerified && !paymentVerified && !paymentEvidencePresent;
        var paymentsQueueMatch = docsReviewVerified && !paymentVerified && paymentEvidencePresent;
        var anomaliesQueueMatch = paymentVerified && !docsReviewVerified;
        var paidApprovedQueueMatch = paymentVerified;
        var fdReceivedQueueMatch = isExternalFdIntakeRow_(rowObj) && !portalSubmitted && !docsReviewVerified && !paymentVerified;

        qItem.Portal_Submitted = portalSubmitted ? "Yes" : "No";
        qItem.Docs_Verified = docsReviewVerified ? "Yes" : "No";
        qItem.Payment_Received = paymentReceived ? "Yes" : "No";
        qItem.Payment_Verified = paymentVerified ? "Yes" : "No";
        qItem.Payment_Verified_Raw = paymentVerifiedRaw ? "Yes" : "No";
        qItem.Payment_Badge = paymentBadge;
        qItem.Enrolled_Confirmed = enrolledConfirmed ? "Yes" : "No";
        qItem.Fee_Receipt_File = receiptUrl;
        qItem.opsDocumentState = opsDocumentState;
        qItem.opsLifecycleStageKey = opsLifecycleStageKey;
        qItem.hasDocumentUploadEvidence = adminOpsHasUploadEvidence_(rowObj);
        qItem.requiredDocumentUploadComplete = !!opsRequiredDocsSummary.requiredDocumentUploadComplete;
        qItem.uploadedRequiredDocumentCount = Number(opsRequiredDocsSummary.uploadedRequiredCount || 0);
        qItem.requiredDocumentCount = Number(opsRequiredDocsSummary.requiredCount || 0);
        qItem.missingRequiredDocuments = (opsRequiredDocsSummary.missingRequiredDocuments || []).join(", ");
        qItem.Registration_Complete = clean_(rowObj.Registration_Complete || "") === "Yes" ? "Yes" : "No";
        qItem.Books_Invoice_ID = clean_(rowObj.Books_Invoice_ID || "");
        qItem.Books_Invoice_Number = clean_(rowObj.Books_Invoice_Number || "");
        qItem.Books_Invoice_Status = clean_(rowObj.Books_Invoice_Status || "");
        qItem.Books_Push_Status = clean_(rowObj.Books_Push_Status || "");
        qItem.Books_Push_At = clean_(rowObj.Books_Push_At || rowObj.Books_Last_Push_At || "");
        qItem.Books_Push_By = clean_(rowObj.Books_Push_By || "");
        qItem.Books_Last_Error = clean_(rowObj.Books_Last_Error || "");
        qItem.Invoice_Email_Status = "UNKNOWN";
        qItem.invoiceRaised = !!qItem.Books_Invoice_ID;
        qItem.FD_FormID = clean_(rowObj.FD_FormID || "");
        qItem.FormID = clean_(rowObj.FormID || "");
        qItem.correlation_id = clean_(rowObj.correlation_id || rowObj.Correlation_ID || "");
        qItem.__reqId = clean_(rowObj.__reqId || "");
        qItem.adapter_forwarded = clean_(rowObj.adapter_forwarded || rowObj.Adapter_Forwarded || "");
        qItem.adapter_source = clean_(rowObj.adapter_source || rowObj.Adapter_Source || "");
        qItem.adapter_version = clean_(rowObj.adapter_version || "");
        qItem.adapter_mode = clean_(rowObj.adapter_mode || "");
        qItem.adapter_crm_result = clean_(rowObj.adapter_crm_result || "");
        qItem.adapter_timestamp = clean_(rowObj.adapter_timestamp || rowObj.adapterTimestamp || "");
        qItem.CRM_Response = clean_(rowObj.CRM_Response || "");
        qItem.Contact_ID = clean_(rowObj.Contact_ID || "");
        qItem.Deal_ID = clean_(rowObj.Deal_ID || "");
        qItem.Email_Status = clean_(rowObj.Email_Status || "");
        qItem.Email_Verification_Status = clean_(rowObj.Email_Verification_Status || "");
        qItem.Email_Bounce_Flag = clean_(rowObj.Email_Bounce_Flag || "");
        qItem.Email_Bounce_Reason = clean_(rowObj.Email_Bounce_Reason || "");
        qItem.Last_Email_Error = clean_(rowObj.Last_Email_Error || "");
        qItem.Last_Email_To = clean_(rowObj.Last_Email_To || "");
        qItem.Parent_Email = clean_(rowObj.Parent_Email || "");
        qItem.Parent_Email_Corrected = clean_(rowObj.Parent_Email_Corrected || "");
        qItem.Ack_Email_Status = clean_(rowObj.Ack_Email_Status || "");
        qItem.Last_Contact_Type = clean_(rowObj.Last_Contact_Type || "");
        qItem.Last_Contact_Result = clean_(rowObj.Last_Contact_Result || "");
        qItem.Last_Contact_DebugId = clean_(rowObj.Last_Contact_DebugId || "");
        qItem.PortalURL = clean_(rowObj.PortalURL || "");
        qItem.Pipeline_Stage = clean_(rowObj.Pipeline_Stage || "");
        qItem.Operational_Stage = clean_(rowObj.Operational_Stage || "");
        qItem.CRM_Stage = clean_(rowObj.CRM_Stage || "");
        qItem.Stage = clean_(rowObj.Stage || "");
        if (Object.prototype.hasOwnProperty.call(rowObj, "Overall_Status")) {
          qItem.Overall_Status = clean_(rowObj.Overall_Status || "");
        }

        debugRows.push({
          id: clean_(rowObj.ApplicantID || rowObj.ID || rowObj["Applicant ID"] || "unknown"),
          activity: hasActivity,
          portalSubmitted: portalSubmitted,
          docsVerified: docsReviewVerified,
          paymentVerified: paymentVerified,
          paymentEvidencePresent: paymentEvidencePresent,
          receipt: paymentEvidencePresent,
          opsDocumentState: opsDocumentState,
          opsLifecycleStageKey: opsLifecycleStageKey,
          uploadedRequiredDocumentCount: opsRequiredDocsSummary.uploadedRequiredCount,
          missingRequiredDocuments: opsRequiredDocsSummary.missingRequiredDocuments,
          portalTs: clean_(rowObj.PortalLastUpdateAt || ""),
          docsQueue: docsQueueMatch,
          awaitingPaymentQueue: awaitingPaymentQueueMatch,
          paymentsQueue: paymentsQueueMatch,
          anomaliesQueue: anomaliesQueueMatch,
          paidApprovedQueue: paidApprovedQueueMatch,
          fdReceivedQueue: fdReceivedQueueMatch
        });
        Logger.log("QUEUE_CLASSIFY " + JSON.stringify({
          applicantId: rowObj.ApplicantID,
          portalSubmitted: portalSubmitted,
          docsVerifiedRaw: rowObj.Docs_Verified,
          docsVerified: docsReviewVerified,
          paymentVerifiedRaw: rowObj.Payment_Verified,
          paymentVerified: paymentVerified,
          opsDocumentState: opsDocumentState,
          opsLifecycleStageKey: opsLifecycleStageKey,
          paymentEvidencePresent: paymentEvidencePresent,
          awaitingPaymentQueue: awaitingPaymentQueueMatch,
          hasActivity: hasActivity
        }));
        if (applicantId.indexOf("FODE-26-TEST-") === 0 || applicantId === "FODE-26-000084" || applicantId === "FODE-26-000007") {
          Logger.log("R232_QUEUE_CANARY ROW " + JSON.stringify({
            applicantId: applicantId,
            portalSubmitted: portalSubmitted,
            docsVerified: docsReviewVerified,
            paymentEvidencePresent: paymentEvidencePresent,
            paymentVerified: paymentVerified,
            opsDocumentState: opsDocumentState,
            opsLifecycleStageKey: opsLifecycleStageKey,
            docsQueue: docsQueueMatch,
            awaitingPaymentQueue: awaitingPaymentQueueMatch,
            paymentsQueue: paymentsQueueMatch,
            anomaliesQueue: anomaliesQueueMatch,
            paidApprovedQueue: paidApprovedQueueMatch
          }));
        }

        if (paidApprovedQueueMatch) {
          pushQueueItem_(paidApproved, qItem);
        } else if (paymentsQueueMatch) {
          pushQueueItem_(payments, qItem);
        } else if (awaitingPaymentQueueMatch) {
          pushQueueItem_(awaitingPayment, qItem);
        } else if (docsQueueMatch) {
          pushQueueItem_(docs, qItem);
        } else if (fdReceivedQueueMatch) {
          qItem.queueBucket = "fdReceived";
          pushQueueItem_(fdReceived, qItem);
        }

        if (anomaliesQueueMatch) {
          pushQueueItem_(anomalies, qItem);
        }
        if (paymentVerified && mandatoryDocIssue) {
          pushQueueItem_(postPaymentIssues, qItem);
        }
      }
      fdReceived.sort(compareFdReceivedQueueItems_);
      docs.sort(compareQueueItems_);
      awaitingPayment.sort(compareQueueItems_);
      payments.sort(compareQueueItems_);
      anomalies.sort(compareQueueItems_);
      paidApproved.sort(compareQueueItems_);
      postPaymentIssues.sort(compareQueueItems_);

      function stripQueue_(items) {
        return (items || []).map(function (it) {
          var row = buildQueueRow_(it.rowNumber, it.applicantId, it.name, {
            ApplicantID: clean_(it.ApplicantID || it.applicantId || ""),
            parentEmail: clean_(it.parentEmail || ""),
            correctedEmail: clean_(it.correctedEmail || ""),
            effectiveEmail: clean_(it.effectiveEmail || ""),
            Parent_Phone: clean_(it.Parent_Phone || ""),
            receivedAt: clean_(it.receivedAt || ""),
            receivedDisplay: clean_(it.receivedDisplay || ""),
            receivedSource: clean_(it.receivedSource || ""),
            ageDays: (it.ageDays === null || it.ageDays === undefined || it.ageDays === "") ? "" : Number(it.ageDays),
            ageLabel: clean_(it.ageLabel || ""),
            ageBand: clean_(it.ageBand || ""),
            Handled_By: clean_(it.Handled_By || ""),
            Handled_At: clean_(it.Handled_At || ""),
            Last_Contacted_At: clean_(it.Last_Contacted_At || ""),
            Email_Last_Sent_At: clean_(it.Email_Last_Sent_At || ""),
            Ack_Email_Sent_At: clean_(it.Ack_Email_Sent_At || ""),
            Payment_Verified_At: clean_(it.Payment_Verified_At || ""),
            Classroom_Handover_At: clean_(it.Classroom_Handover_At || ""),
            Enrolled_By: clean_(it.Enrolled_By || ""),
            Enrolled_At: clean_(it.Enrolled_At || ""),
            docsFollowupSentAt: safeStr_(it.docsFollowupSentAt || ""),
            Portal_Submitted: clean_(it.Portal_Submitted || ""),
            Docs_Verified: clean_(it.Docs_Verified || ""),
            opsDocumentState: clean_(it.opsDocumentState || ""),
            opsLifecycleStageKey: clean_(it.opsLifecycleStageKey || ""),
            hasDocumentUploadEvidence: !!it.hasDocumentUploadEvidence,
            requiredDocumentUploadComplete: !!it.requiredDocumentUploadComplete,
            uploadedRequiredDocumentCount: Number(it.uploadedRequiredDocumentCount || 0),
            requiredDocumentCount: Number(it.requiredDocumentCount || 0),
            missingRequiredDocuments: clean_(it.missingRequiredDocuments || ""),
            Payment_Received: clean_(it.Payment_Received || ""),
            Payment_Verified: clean_(it.Payment_Verified || ""),
            Enrolled_Confirmed: clean_(it.Enrolled_Confirmed || ""),
            Fee_Receipt_File: clean_(it.Fee_Receipt_File || ""),
            Registration_Complete: clean_(it.Registration_Complete || ""),
            Books_Invoice_ID: clean_(it.Books_Invoice_ID || ""),
            Books_Invoice_Number: clean_(it.Books_Invoice_Number || ""),
            Books_Invoice_Status: clean_(it.Books_Invoice_Status || ""),
            Books_Push_Status: clean_(it.Books_Push_Status || ""),
            Books_Push_At: clean_(it.Books_Push_At || ""),
            Books_Push_By: clean_(it.Books_Push_By || ""),
            Books_Last_Error: clean_(it.Books_Last_Error || ""),
            Invoice_Email_Status: clean_(it.Invoice_Email_Status || "UNKNOWN"),
            invoiceRaised: !!it.invoiceRaised,
            FD_FormID: clean_(it.FD_FormID || ""),
            FormID: clean_(it.FormID || ""),
            correlation_id: clean_(it.correlation_id || ""),
            __reqId: clean_(it.__reqId || ""),
            adapter_forwarded: clean_(it.adapter_forwarded || ""),
            adapter_source: clean_(it.adapter_source || ""),
            adapter_version: clean_(it.adapter_version || ""),
            adapter_mode: clean_(it.adapter_mode || ""),
            adapter_crm_result: clean_(it.adapter_crm_result || ""),
            adapter_timestamp: clean_(it.adapter_timestamp || ""),
            queueBucket: clean_(it.queueBucket || ""),
            CRM_Response: clean_(it.CRM_Response || ""),
            Contact_ID: clean_(it.Contact_ID || ""),
            Deal_ID: clean_(it.Deal_ID || ""),
            Email_Status: clean_(it.Email_Status || ""),
            Ack_Email_Status: clean_(it.Ack_Email_Status || ""),
            Last_Contact_Type: clean_(it.Last_Contact_Type || ""),
            Last_Contact_Result: clean_(it.Last_Contact_Result || ""),
            Last_Contact_DebugId: clean_(it.Last_Contact_DebugId || ""),
            PortalURL: clean_(it.PortalURL || ""),
            Pipeline_Stage: clean_(it.Pipeline_Stage || ""),
            Operational_Stage: clean_(it.Operational_Stage || ""),
            CRM_Stage: clean_(it.CRM_Stage || ""),
            Stage: clean_(it.Stage || ""),
            Overall_Status: Object.prototype.hasOwnProperty.call(it, "Overall_Status") ? clean_(it.Overall_Status || "") : ""
          });
          if (!Object.prototype.hasOwnProperty.call(it, "Overall_Status")) delete row.Overall_Status;
          return row;
        });
      }
      fullData = {
        fdReceived: stripQueue_(fdReceived),
        docs: stripQueue_(docs),
        awaitingPayment: stripQueue_(awaitingPayment),
        payments: stripQueue_(payments),
        anomalies: stripQueue_(anomalies),
        paidApproved: stripQueue_(paidApproved),
        postPaymentIssues: stripQueue_(postPaymentIssues),
        counts: {
          fdReceived: fdReceived.length,
          payments: payments.length,
          docs: docs.length,
          awaitingPayment: awaitingPayment.length,
          anomalies: anomalies.length,
          paidApproved: paidApproved.length,
          postPaymentIssues: postPaymentIssues.length
        }
      };
      debugRows.forEach(function (d) {
        if (d.id === "FODE-26-000084" || d.id === "FODE-26-000007") {
          Logger.log("CIS-r231 QUEUE DEBUG for %s: %s", d.id, JSON.stringify(d));
        }
      });
      Logger.log("QUEUE_SUMMARY " + JSON.stringify({
        fdReceived: fdReceived.length,
        docs: docs.length,
        awaitingPayment: awaitingPayment.length,
        payments: payments.length,
        anomalies: anomalies.length,
        paidApproved: paidApproved.length
      }));
      Logger.log("R232_QUEUE_CANARY SUMMARY " + JSON.stringify({
        fdReceived: fdReceived.length,
        docs: docs.length,
        awaitingPayment: awaitingPayment.length,
        payments: payments.length,
        anomalies: anomalies.length,
        paidApproved: paidApproved.length
      }));
      Logger.log("QUEUE_PREFILTER_SUMMARY " + JSON.stringify({
        scanned: scannedCount,
        skipped: skippedCount,
        candidates: candidateCount,
        fdReceived: fdReceived.length,
        docs: docs.length,
        awaitingPayment: awaitingPayment.length,
        payments: payments.length,
        anomalies: anomalies.length,
        paidApproved: paidApproved.length
      }));
    }
    try {
      cache.put(cacheKey, JSON.stringify(fullData), 60);
    } catch (_cacheWriteErr) {}
  }

  fullData = normalizeReviewQueueData_(fullData);
  fullData.docs = filterDocumentsToVerifyQueue_(fullData.docs);
  fullData.counts.docs = fullData.docs.length;
  var pageMeta = mergeQueuePageMeta_(fullData, offset, limit);
  function refreshDocsFollowupRuntime_(rows) {
    var list = Array.isArray(rows) ? rows : [];
    return list.map(function (row) {
      var out = {};
      var src = row && typeof row === "object" ? row : {};
      for (var k in src) {
        if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = src[k];
      }
      var applicantId = clean_(out.ApplicantID || out.applicantId || "");
      out.ApplicantID = clean_(out.ApplicantID || applicantId || "");
      out.applicantId = clean_(out.applicantId || applicantId || "");
      out.name = clean_(out.name || "");
      out.rowNumber = Number(out.rowNumber || 0);
      var sentAt = "";
      if (applicantId) {
        try {
          var key = buildDocsFollowupKey_(CONFIG.DATA_MODE, applicantId);
          sentAt = safeStr_(PropertiesService.getScriptProperties().getProperty(key) || "");
        } catch (_propErr) {}
      }
      out.docsFollowupSentAt = sentAt;
      return out;
    });
  }

  return {
    ok: true,
    fdReceived: refreshDocsFollowupRuntime_(sliceQueueByOffset_(fullData.fdReceived, offset, limit)),
    docs: refreshDocsFollowupRuntime_(sliceQueueByOffset_(fullData.docs, offset, limit)),
    awaitingPayment: refreshDocsFollowupRuntime_(sliceQueueByOffset_(fullData.awaitingPayment, offset, limit)),
    payments: refreshDocsFollowupRuntime_(sliceQueueByOffset_(fullData.payments, offset, limit)),
    anomalies: refreshDocsFollowupRuntime_(sliceQueueByOffset_(fullData.anomalies, offset, limit)),
    paidApproved: refreshDocsFollowupRuntime_(sliceQueueByOffset_(fullData.paidApproved, offset, limit)),
    postPaymentIssues: refreshDocsFollowupRuntime_(sliceQueueByOffset_(fullData.postPaymentIssues, offset, limit)),
    counts: fullData.counts || { fdReceived: 0, payments: 0, docs: 0, awaitingPayment: 0, anomalies: 0, paidApproved: 0, postPaymentIssues: 0 },
    offset: offset,
    limit: limit,
    hasMore: pageMeta.hasMore,
    nextOffset: pageMeta.nextOffset
  };
}
