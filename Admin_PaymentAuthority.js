function admin_verifyPayment(payload) {
  return admin_setPaymentVerified(payload);
}

function admin_setPaymentVerified(payload) {
  return withEnvelope_("admin_setPaymentVerified", function(dbgId) {
    return admin_setPaymentVerified_impl_(payload, dbgId);
  });
}

function admin_setPaymentVerified_impl_(payload, dbgId) {
  dbgId = String(dbgId || adminDebugId_());
  try {
  var adminEmail = getActiveUserEmail_();
  if (!isAdmin_(adminEmail)) return err_("ACCESS_DENIED", "Access denied", dbgId);
  try { requireAdminCapability_(adminEmail, "CAN_VERIFY_PAYMENT", "Access denied: payment verification capability required"); } catch (_superErr) { return err_("ACCESS_DENIED", "Access denied: payment verification capability required", dbgId); }

  payload = payload || {};
  var rowNumber = Number(payload.rowNumber || 0);
  var overridePaymentBeforeDocs = parseOverrideFlag_(payload, "overridePaymentBeforeDocs");
  var bypassPaymentFreeze = parseOverrideFlag_(payload, "bypassPaymentFreeze") || parseOverrideFlag_(payload, "overridePaymentFreeze");
  if (!rowNumber || rowNumber < 2) return err_("VALIDATION", "Invalid rowNumber", dbgId);
  var note = clean_(payload.comment || payload.reason || "");

  var sh = openDataSheet_();
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var idx = headerIndex_(headers);
  requireHeaders_(idx, ["ApplicantID", "Receipt_Status", "Doc_Last_Verified_At", "Doc_Last_Verified_By"]);
  var cols = resolveStatusCols_(idx);
  if (!cols.receipt) return err_("VALIDATION", "Missing Receipt_Status column mapping.", dbgId);

  var beforeRow = getRowObject_(sh, rowNumber);
  var priorRowObj = {};
  for (var bk in beforeRow) {
    if (Object.prototype.hasOwnProperty.call(beforeRow, bk)) priorRowObj[bk] = beforeRow[bk];
  }
  var paymentFreezeActive = isPaymentFreezeActive_(beforeRow);
  if (paymentFreezeActive) {
    if (!bypassPaymentFreeze) {
      return err_("PAYMENT_FREEZE_REQUIRES_BYPASS", "Payment is already verified. Use Unlock to enable Super Admin override before saving.", dbgId);
    }
    logAudit_("PAYMENT_FREEZE_BYPASS", {
      endpoint: "admin_setPaymentVerified",
      applicantId: clean_(beforeRow.ApplicantID || ""),
      rowNumber: rowNumber,
      actor: adminEmail || "",
      debugId: dbgId,
      changedFields: ["Receipt_Status"]
    });
  }
  var docsVerifiedNow = adminDocumentReviewVerifiedForPaymentGate_(beforeRow);
  if (!docsVerifiedNow) {
    if (!overridePaymentBeforeDocs) {
      logAudit_("PAYMENT_BEFORE_DOCS_BLOCK", {
        applicantId: clean_(beforeRow.ApplicantID || ""),
        actor: adminEmail || "",
        rowNumber: rowNumber,
        debugId: dbgId
      });
      return err_("PAYMENT_BEFORE_DOCS_REQUIRES_OVERRIDE", "Docs not verified. Confirm override to verify payment.", dbgId);
    }
    logAudit_("PAYMENT_BEFORE_DOCS_OVERRIDE", {
      applicantId: clean_(beforeRow.ApplicantID || ""),
      rowNumber: rowNumber,
      actor: adminEmail || "",
      debugId: dbgId
    });
  }
  // Legacy endpoint is mapped to receipt verification only.
  setCell_(sh, rowNumber, idx, "Receipt_Status", "Verified");
  if (idx.Receipt_Comment && note) setCell_(sh, rowNumber, idx, "Receipt_Comment", note);

  var refreshedRow = getRowObject_(sh, rowNumber);
  var docStage = computeDocVerificationStatus_(refreshedRow);
  var paymentBadge = canonicalPaymentBadge_(refreshedRow);
  var paymentVerified = isCanonicalPaymentVerified_(refreshedRow);
  var computedOverall = computeOverallStatus_(refreshedRow);
  if (cols.paymentCompat) setCell_(sh, rowNumber, idx, cols.paymentCompat, paymentVerified ? "Yes" : "");
  if (cols.docStage) setCell_(sh, rowNumber, idx, cols.docStage, docStage);
  if (cols.docsCompat) setCell_(sh, rowNumber, idx, cols.docsCompat, docStage === "Verified" ? "Yes" : "");
  if (cols.overall) setCell_(sh, rowNumber, idx, cols.overall, computedOverall);
  setCell_(sh, rowNumber, idx, "Doc_Last_Verified_At", new Date());
  setCell_(sh, rowNumber, idx, "Doc_Last_Verified_By", adminEmail || "admin");
  var finalRowObj = getRowObject_(sh, rowNumber);
  captureOperatorAttribution_(sh, rowNumber, idx, {
    action: "PAYMENT_VERIFY",
    operatorEmail: adminEmail,
    rowObj: finalRowObj
  });
  var actions = runVerificationAutomations_(sh, rowNumber, idx, priorRowObj, finalRowObj, dbgId);

  var beforeVerified = isPaymentVerifiedDerived_(priorRowObj) === true;
  var afterVerified = isPaymentVerifiedDerived_(finalRowObj) === true;
  var transitionToYes = (!beforeVerified && afterVerified);
  var workflowWarnings = [];
  var crm = { attempted: false, ok: true, debugId: "", dryRun: CONFIG.CRM_PUSH_DRY_RUN === true };
  if (transitionToYes && CONFIG.EMAIL_ENABLE_PAYMENT_VERIFIED_TRIGGERS === true) {
    var wf = handlePaymentVerifiedTrigger_(finalRowObj, dbgId);
    actions.payverWorkflow = safeStr_(wf && wf.code || "");
    if (wf && Array.isArray(wf.warnings) && wf.warnings.length) {
      workflowWarnings = workflowWarnings.concat(wf.warnings);
    }
  }

  log_(openLogSheet_(), "ADMIN_PAYMENT_VERIFIED", "row=" + rowNumber + " by=" + (adminEmail || "admin") + " via=Receipt_Status transitionToYes=" + (transitionToYes ? "1" : "0"));
  var applicantId = clean_(refreshedRow.ApplicantID || "");
  return ok_({
    rowNumber: rowNumber,
    applicantId: applicantId,
    paymentVerified: paymentVerified ? "Yes" : "",
    paymentBadge: paymentBadge,
    docVerificationStatusComputed: docStage,
    overallStatusComputed: computedOverall,
    overallStatus: computedOverall,
    actions: actions,
    emailTriggered: !!(actions && actions.emailTriggered),
    warnings: ((actions && Array.isArray(actions.warnings)) ? actions.warnings : []).concat(workflowWarnings),
    dbg: dbgId,
    crm: crm
  }, dbgId);
  } catch (e) {
    logAdminApiException_("admin_setPaymentVerified", dbgId, e);
    return err_("EXCEPTION", String(e && e.message ? e.message : e), dbgId);
  }
}
