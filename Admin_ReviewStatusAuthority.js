function admin_updateDocStatuses(payload) {
  return withEnvelope_("admin_updateDocStatuses", function(dbgId) {
    try {
      Logger.log("SAVE_CALLED " + JSON.stringify({
        debugId: String(dbgId || ""),
        keys: payload && typeof payload === "object" ? Object.keys(payload) : null,
        applicantId: payload && payload.applicantId ? String(payload.applicantId) : "",
        rowNumber: payload && payload.rowNumber ? Number(payload.rowNumber) : null,
        actor: String((Session.getActiveUser && Session.getActiveUser().getEmail && Session.getActiveUser().getEmail()) || "")
      }));
    } catch (_logErr) {}
    return admin_updateDocStatuses_impl_(payload, dbgId);
  });
}

function admin_updateDocStatuses_impl_(payload, dbgId) {
  dbgId = String(dbgId || adminDebugId_());
  try {
  var adminEmail = getCallerEmail_();
  try {
    requireDocumentVerifier_(adminEmail);
  } catch (_authErr) {
    return err_("ACCESS_DENIED", "Access denied: document verifier required", dbgId);
  }

  payload = payload || {};
  var rowNumber = Number(payload.rowNumber || 0);
  var docs = payload.docs || [];
  if (!rowNumber || rowNumber < 2) return err_("VALIDATION", "Invalid rowNumber", dbgId);
  if (!Array.isArray(docs)) return err_("VALIDATION", "Invalid docs payload", dbgId);

  var sh = openDataSheet_();
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var idx = headerIndex_(headers);
  var cols = resolveStatusCols_(idx);
  var overridePaymentBeforeDocs = parseOverrideFlag_(payload, "overridePaymentBeforeDocs");
  var bypassPaymentFreeze = parseOverrideFlag_(payload, "bypassPaymentFreeze") || parseOverrideFlag_(payload, "overridePaymentFreeze");
  var displayRow = sh.getRange(rowNumber, 1, 1, lastCol).getDisplayValues()[0];
  requireHeaders_(idx, ["ApplicantID", "Doc_Verification_Status", "Doc_Last_Verified_At", "Doc_Last_Verified_By", "Portal_Access_Status"]);
  var applicantId = clean_(sh.getRange(rowNumber, idx.ApplicantID).getValue());
  if (!applicantId) return err_("VALIDATION", "Missing ApplicantID in target row.", dbgId);
  if (!cols.receipt) return err_("VALIDATION", "Missing Receipt_Status column mapping.", dbgId);
  var currentRowObj = getRowObject_(sh, rowNumber);
  var priorRowObj = {};
  for (var bk in currentRowObj) {
    if (Object.prototype.hasOwnProperty.call(currentRowObj, bk)) priorRowObj[bk] = currentRowObj[bk];
  }
  var paymentFreezeActive = isPaymentFreezeActive_(currentRowObj);
  var canBypassFreeze = canBypassPaymentFreeze_(adminEmail);
  if (paymentFreezeActive) {
    if (!canBypassFreeze) {
      return err_("PAYMENT_FREEZE", "Payment is verified. Only Super Admin can unlock this record for editing.", dbgId);
    }
    if (!bypassPaymentFreeze) {
      return err_("PAYMENT_FREEZE_REQUIRES_BYPASS", "Payment is verified. Use Unlock to enable Super Admin override before saving.", dbgId);
    }
  }
  var docMap = CONFIG.DOC_FIELDS || [];
  var prepared = [];
  for (var i = 0; i < docs.length; i++) {
    var d = docs[i] || {};
    var file = clean_(d.file || "");
    var mapping = findDocMapping_(file, d.statusField, d.commentField, docMap);
    if (!mapping) throw new Error("Invalid document mapping.");
    var status = normalizeDocStatus_(d.status);
    if (status === "Verified" && !adminDocumentDisplayRowHasUrl_(displayRow, idx, mapping)) {
      throw new Error("Cannot set Verified: " + (mapping.label || mapping.file) + " has no uploaded file.");
    }
    var comment = clean_(d.comment || "");
    prepared.push({
      mapping: mapping,
      status: status,
      comment: comment
    });
  }
  var canWritePaymentAuthority = canBypassPaymentFreeze_(adminEmail);
  var writePrepared = [];
  for (var wp = 0; wp < prepared.length; wp++) {
    var writeItem = prepared[wp];
    var writeStatusField = writeItem && writeItem.mapping ? String(writeItem.mapping.status || "") : "";
    var writeCommentField = writeItem && writeItem.mapping ? String(writeItem.mapping.comment || "") : "";
    if (writeStatusField === cols.receipt) {
      var receiptStatusBefore = clean_(currentRowObj[writeStatusField] || "");
      var receiptCommentBefore = writeCommentField ? clean_(currentRowObj[writeCommentField] || "") : "";
      var receiptChanged = writeItem.status !== receiptStatusBefore || writeItem.comment !== receiptCommentBefore;
      if (receiptChanged && !canWritePaymentAuthority) {
        logAudit_("PAYMENT_STATUS_ROLE_BLOCK", {
          endpoint: "admin_updateDocStatuses",
          applicantId: applicantId,
          rowNumber: rowNumber,
          actor: adminEmail || "",
          debugId: dbgId,
          changedFields: [writeStatusField, writeCommentField].filter(function(v) { return !!v; })
        });
        return err_("PAYMENT_AUTHORITY_REQUIRED", "Payment/receipt status updates require Super Admin authority.", dbgId);
      }
      if (!receiptChanged && !canWritePaymentAuthority) continue;
    }
    writePrepared.push(writeItem);
  }
  prepared = writePrepared;
  if (!prepared.length) {
    return err_("NO_DOCUMENT_STATUS_FIELDS_WRITTEN", "No document status fields were written.", dbgId);
  }

  var wantsReceiptVerified = false;
    var beforePaymentVerified = isPaymentVerifiedDerived_(currentRowObj) === true;
  var prospectiveRow = {};
  for (var key in currentRowObj) {
    if (Object.prototype.hasOwnProperty.call(currentRowObj, key)) prospectiveRow[key] = currentRowObj[key];
  }
  for (var p0 = 0; p0 < prepared.length; p0++) {
    var prep = prepared[p0];
    if (prep.mapping && prep.mapping.status) prospectiveRow[prep.mapping.status] = prep.status;
    if (prep.mapping && prep.mapping.comment) prospectiveRow[prep.mapping.comment] = prep.comment;
    if (prep.mapping && prep.mapping.status === cols.receipt && prep.status === "Verified") wantsReceiptVerified = true;
  }
  if (wantsReceiptVerified) {
    var prospectivePaymentVerified = isCanonicalPaymentVerified_(prospectiveRow) || isPaymentVerifiedDerived_(prospectiveRow) === true;
    if (!beforePaymentVerified && prospectivePaymentVerified && !canBypassPaymentFreeze_(adminEmail)) {
      logAdminEvent_("PAYVER_NOT_ALLOWED_BLOCK", {
        applicantId: applicantId,
        rowNumber: rowNumber,
        actor: adminEmail || "",
        dbg: dbgId
      });
      return err_("PAYVER_NOT_ALLOWED", "Only Super Admin can verify payments.", dbgId);
    }
    var docsVerifiedAfterSave = adminDocumentReviewVerifiedForPaymentGate_(prospectiveRow);
    if (!docsVerifiedAfterSave) {
      if (!overridePaymentBeforeDocs) {
        logAudit_("PAYMENT_BEFORE_DOCS_BLOCK", {
          applicantId: applicantId,
          actor: adminEmail || "",
          rowNumber: rowNumber,
          debugId: dbgId
        });
        return err_("PAYMENT_BEFORE_DOCS_REQUIRES_OVERRIDE", "Docs not verified. Confirm override to verify payment.", dbgId);
      }
      logAudit_("PAYMENT_BEFORE_DOCS_OVERRIDE", {
        applicantId: applicantId,
        rowNumber: rowNumber,
        actor: adminEmail || "",
        debugId: dbgId
      });
    }
  }

  for (var p = 0; p < prepared.length; p++) {
    var item = prepared[p];
    adminVerifyDocument(applicantId, item.mapping.file, toRouteStatusKey_(item.status), adminEmail || "admin", item.comment);
  }
  if (paymentFreezeActive && canBypassFreeze && bypassPaymentFreeze) {
    logAudit_("PAYMENT_FREEZE_BYPASS", {
      endpoint: "admin_updateDocStatuses",
      applicantId: applicantId,
      rowNumber: rowNumber,
      actor: adminEmail || "",
      debugId: dbgId,
      changedFields: prepared.map(function(item) {
        return item && item.mapping ? String(item.mapping.status || "") : "";
      }).filter(function(v){ return !!v; })
    });
  }

  var refreshedRow = getRowObject_(sh, rowNumber);
  var docStage = computeDocVerificationStatus_(refreshedRow);
  var paymentBadge = canonicalPaymentBadge_(refreshedRow);
  var paymentVerified = isCanonicalPaymentVerified_(refreshedRow);
  var overallComputed = computeOverallStatus_(refreshedRow);
  if (cols.paymentCompat) setCell_(sh, rowNumber, idx, cols.paymentCompat, paymentVerified ? "Yes" : "");
  if (cols.docStage) setCell_(sh, rowNumber, idx, cols.docStage, docStage);
  if (cols.docsCompat) setCell_(sh, rowNumber, idx, cols.docsCompat, docStage === "Verified" ? "Yes" : "");
  if (cols.overall) setCell_(sh, rowNumber, idx, cols.overall, overallComputed);
  setCell_(sh, rowNumber, idx, "Doc_Last_Verified_At", new Date());
  setCell_(sh, rowNumber, idx, "Doc_Last_Verified_By", adminEmail || "admin");
  var finalRowObj = getRowObject_(sh, rowNumber);
  var refreshedDocStatuses = {};
  var refreshedDocStatusFields = [];
  var refreshedDocMappings = Array.isArray(CONFIG.DOC_FIELDS) ? CONFIG.DOC_FIELDS : [];
  for (var rd = 0; rd < refreshedDocMappings.length; rd++) {
    var rdMap = refreshedDocMappings[rd] || {};
    if (!rdMap.status) continue;
    refreshedDocStatuses[rdMap.status] = normalizeDocStatus_(finalRowObj[rdMap.status] || "");
    refreshedDocStatusFields.push({
      file: String(rdMap.file || ""),
      statusField: String(rdMap.status || ""),
      commentField: String(rdMap.comment || ""),
      status: normalizeDocStatus_(finalRowObj[rdMap.status] || ""),
      comment: rdMap.comment ? clean_(finalRowObj[rdMap.comment] || "") : ""
    });
  }
  var actions = runVerificationAutomations_(sh, rowNumber, idx, priorRowObj, finalRowObj, dbgId);
  captureOperatorAttribution_(sh, rowNumber, idx, {
    action: "DOCS_UPDATE",
    operatorEmail: adminEmail,
    rowObj: finalRowObj
  });
  var beforeVerified = isPaymentVerifiedDerived_(priorRowObj) === true;
  var afterVerified = isPaymentVerifiedDerived_(finalRowObj) === true;
  var transition = (!beforeVerified && afterVerified);
  var workflowWarnings = [];
  if (transition && CONFIG.EMAIL_ENABLE_PAYMENT_VERIFIED_TRIGGERS === true) {
    var wf = handlePaymentVerifiedTrigger_(finalRowObj, dbgId);
    actions.payverWorkflow = safeStr_(wf && wf.code || "");
    if (wf && Array.isArray(wf.warnings) && wf.warnings.length) {
      workflowWarnings = workflowWarnings.concat(wf.warnings);
    }
  }

  log_(openLogSheet_(), "ADMIN_DOC_UPDATE", "row=" + rowNumber + " by=" + (adminEmail || "admin") + " docStage=" + docStage + " payment=" + paymentBadge + " overall=" + overallComputed);
  log_(openLogSheet_(), "DOC_STATUS_SAVE", JSON.stringify({
    applicantId: applicantId,
    rowNumber: rowNumber,
    actor: adminEmail || "",
    receiptStatus: clean_(refreshedRow.Receipt_Status || ""),
    docStageComputed: docStage,
    overallComputed: overallComputed,
    changedFields: prepared.map(function(item) {
      return item && item.mapping ? {
        statusField: String(item.mapping.status || ""),
        commentField: String(item.mapping.comment || ""),
        previousStatus: clean_(priorRowObj[item.mapping.status] || ""),
        newStatus: clean_(finalRowObj[item.mapping.status] || ""),
        previousComment: clean_(priorRowObj[item.mapping.comment] || ""),
        newComment: clean_(finalRowObj[item.mapping.comment] || "")
      } : null;
    }).filter(function(item) { return !!item; }),
    dbgId: dbgId
  }));
  return ok_({
    rowNumber: rowNumber,
    applicantId: applicantId,
    changedCount: prepared.length,
    docVerificationStatusComputed: docStage,
    paymentBadge: paymentBadge,
    paymentVerified: paymentVerified ? "Yes" : "",
    overallStatusComputed: overallComputed,
    overallStatus: overallComputed,
    documentStatuses: refreshedDocStatuses,
    documentStatusFields: refreshedDocStatusFields,
    changedFields: prepared.map(function(item) {
      return item && item.mapping ? {
        file: String(item.mapping.file || ""),
        statusField: String(item.mapping.status || ""),
        commentField: String(item.mapping.comment || ""),
        previousStatus: normalizeDocStatus_(priorRowObj[item.mapping.status] || ""),
        newStatus: normalizeDocStatus_(finalRowObj[item.mapping.status] || "")
      } : null;
    }).filter(function(item) { return !!item; }),
    actions: actions,
    emailTriggered: !!(actions && actions.emailTriggered),
    warnings: ((actions && Array.isArray(actions.warnings)) ? actions.warnings : []).concat(workflowWarnings),
    dbg: dbgId
  }, dbgId);
  } catch (e) {
    logAdminApiException_("admin_updateDocStatuses", dbgId, e);
    return err_("EXCEPTION", String(e && e.message ? e.message : e), dbgId);
  }
}

function resolveStatusCols_(idx) {
  return {
    docStage: getCol_(idx, ["Doc_Verification_Status"]),
    docsCompat: getCol_(idx, ["Docs_Verified"]),
    overall: getCol_(idx, ["Overall_Status"]),
    paymentCompat: getCol_(idx, ["Payment_Verified"]),
    receipt: getCol_(idx, ["Receipt_Status"])
  };
}

function adminDocumentReviewVerifiedForPaymentGate_(rowObj) {
  var row = rowObj || {};
  return clean_(row.Docs_Verified || "") === "Yes" || computeDocVerificationStatus_(row) === "Verified";
}

function adminDocumentReviewVerifiedForAutomation_(rowObj) {
  var row = rowObj || {};
  return isYes_(row.Docs_Verified) || computeDocVerificationStatus_(row) === "Verified";
}
