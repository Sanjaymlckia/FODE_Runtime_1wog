/******************** ADMIN APP (REWORKED FOR HASHED PORTAL TOKENS) ********************/
var ADMIN_DETAIL_SIG = "ADMIN_DETAIL_SIG_20260220_v1";

function makeDebugId_() {
  return adminDebugId_();
}

function adminDebugId_() {
  try {
    if (typeof newDebugId_ === "function") return newDebugId_();
  } catch (_e) {}
  return "ADM-" + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "yyyyMMdd-HHmmss") + "-" + Math.floor(Math.random() * 100000);
}

function ok_(data, debugId) {
  var out = { ok: true, debugId: String(debugId || adminDebugId_()) };
  var src = (data && typeof data === "object") ? data : {};
  for (var k in src) {
    if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = src[k];
  }
  return out;
}

function err_(code, message, debugId, extra) {
  var out = {
    ok: false,
    code: clean_(code || "ERROR"),
    message: clean_(message || "Server returned an error"),
    debugId: String(debugId || adminDebugId_())
  };
  var src = (extra && typeof extra === "object") ? extra : {};
  for (var k in src) {
    if (Object.prototype.hasOwnProperty.call(src, k)) out[k] = src[k];
  }
  if (!out.error) out.error = out.message;
  return out;
}

function parseOverrideFlag_(payload, key) {
  var p = payload || {};
  var v = p[key];
  return v === true || v === 1 || String(v || "").toLowerCase() === "true";
}

function logAdminApiException_(fnName, debugId, e) {
  try {
    logAudit_("ADMIN_API_EXCEPTION", {
      endpoint: String(fnName || ""),
      debugId: String(debugId || adminDebugId_()),
      message: String(e && e.message ? e.message : e),
      stack: String(e && e.stack ? e.stack : "")
    });
  } catch (_logErr) {
    try {
      Logger.log("ADMIN_API_EXCEPTION %s %s", String(debugId || ""), String(e && e.message ? e.message : e));
    } catch (_logErr2) {}
  }
}

function withEnvelope_(fnName, fn) {
  var debugId = makeDebugId_();
  try {
    var out = fn(debugId);
    if (out && typeof out === "object" && typeof out.ok === "boolean") {
      if (!out.debugId) out.debugId = debugId;
      return out;
    }
    if (out && typeof out === "object") return ok_(out, debugId);
    return ok_({ value: out }, debugId);
  } catch (e) {
    logAdminApiException_(fnName, debugId, e);
    return err_("EXCEPTION", String(e && e.message ? e.message : e), debugId);
  }
}

function renderAdminApp_(e) {
  var email = getCallerEmail_();
  if (!isAdmin_(email)) {
    var debugId = makeDebugId_();
    var activeUserEmail = "";
    var effectiveUserEmail = "";
    var safeUrl = "";
    try { activeUserEmail = String(Session.getActiveUser().getEmail() || ""); } catch (_au) {}
    try { effectiveUserEmail = String(Session.getEffectiveUser().getEmail() || ""); } catch (_eu) {}
    try {
      safeUrl = String(ScriptApp.getService().getUrl() || "").replace(/[?#].*$/, "");
    } catch (_urlErr) {}
    try {
      logAudit_("ADMIN_ACCESS_DENIED", {
        activeUserEmail: activeUserEmail,
        effectiveUserEmail: effectiveUserEmail,
        url: safeUrl,
        debugId: debugId
      });
    } catch (_logErr) {}
    return HtmlService.createHtmlOutput("<h3>Access denied</h3><p>Not authorized. Debug ID: " + debugId + "</p>")
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  var t = HtmlService.createTemplateFromFile("AdminUI");
  t.BRAND = CONFIG.BRAND || {};
  t.USER_EMAIL = email;
  t.WEBAPP_URL = CONFIG.WEBAPP_URL_ADMIN || CONFIG.WEBAPP_URL;
  t.ADMIN_ROLE = getAdminRole_(email);
  t.IS_SUPER = getAdminRole_(email) === "SUPER";
  t.SUPER_ADMIN_EMAILS = (CONFIG.SUPER_ADMIN_EMAILS || []).slice();
  t.ROLE_DECISION_SOURCE = "CONFIG.ADMIN_ROLES";
  t.CAN_OVERRIDE = canOverrideOverall_(email);
  t.PAYMENT_BADGE = "Payment Pending";
  t.PAYMENT_VERIFIED_BOOL = false;
  t.OVERALL_DOC_STATUS = "Pending";
  t.BUILD_VERSION = CONFIG.VERSION;
  t.BUILD_RENDERED_AT = new Date().toISOString();
  t.BUILD_SCRIPT_ID = ScriptApp.getScriptId();
  t.INITIAL_ADMIN_VIEW = String((e && e.parameter && e.parameter.view) || "admin");
  t.INITIAL_OPEN_APPLICANT_ID = clean_((e && e.parameter && (e.parameter.open || e.parameter.applicantId)) || "");
  t.STUDENT_URL_READY = isStudentUrlConfigured_();
  t.STUDENT_URL_WARNING = getStudentUrlWarning_();
  return t.evaluate()
    .setTitle((CONFIG.BRAND && CONFIG.BRAND.name ? CONFIG.BRAND.name : "FODE Admin") + (String((e && e.parameter && e.parameter.view) || "").toLowerCase() === "ops" ? " - Operations Cockpit" : " - Document Verification"))
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

// Access control helpers live in Admin_AccessControl.js.

function isStudentUrlConfigured_() {
  var studentBase = clean_(CONFIG.WEBAPP_URL_STUDENT || "");
  if (!studentBase) return false;
  if (/[<>]/.test(studentBase)) return false;
  if (studentBase.indexOf("STUDENT_DEPLOYMENT_ID") >= 0) return false;
  return /^https?:\/\//i.test(studentBase);
}

function getStudentUrlWarning_() {
  return isStudentUrlConfigured_() ? "" : "Student URL not configured. Set CONFIG.WEBAPP_URL_STUDENT to the student deployment /exec URL.";
}

/******************** ADMIN API ********************/

function admin_searchApplicants(payload) {
  var adminEmail = getCallerEmail_();
  if (!isAdmin_(adminEmail)) throw new Error("Access denied");

  payload = payload || {};
  var applicantId = clean_(payload.applicantId || "");
  var email = clean_(payload.email || "").toLowerCase();
  var nameQuery = clean_(payload.name || payload.applicantName || "").toLowerCase();
  var phoneQuery = clean_(payload.phone || "").toLowerCase();
  var stageFilter = clean_(payload.stage || "").toUpperCase();

  if (!applicantId && !email && !nameQuery && !phoneQuery && !stageFilter) return { ok: true, rows: [] };

  var sh = openDataSheet_();
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return { ok: true, rows: [] };

  var headers = values[0];
  var idx = headerIndex_(headers);
  requireHeaders_(idx, [
    "ApplicantID", "First_Name", "Last_Name",
    "Doc_Verification_Status", "Receipt_Status", "Portal_Access_Status"
  ]);
  var hasParentEmail = !!idx.Parent_Email;
  var hasParentEmailCorrected = !!idx.Parent_Email_Corrected;
  var hasParentPhone = !!idx.Parent_Phone;

  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var rowObj = {};
    for (var c = 0; c < headers.length; c++) {
      var hk = clean_(headers[c]);
      if (hk) rowObj[hk] = row[c];
    }
    var rid = clean_(row[idx.ApplicantID - 1]);
    var firstName = clean_(row[idx.First_Name - 1]);
    var lastName = clean_(row[idx.Last_Name - 1]);
    var fullName = (firstName + " " + lastName).trim();
    var parentEmail = hasParentEmail ? clean_(row[idx.Parent_Email - 1]).toLowerCase() : "";
    var correctedEmail = hasParentEmailCorrected ? clean_(row[idx.Parent_Email_Corrected - 1]).toLowerCase() : "";
    var effectiveEmail = correctedEmail || parentEmail;
    var parentPhone = hasParentPhone ? clean_(row[idx.Parent_Phone - 1]) : "";
    var textMatch = (!applicantId && !email && !nameQuery && !phoneQuery)
      || (applicantId && rid.toUpperCase().indexOf(applicantId.toUpperCase()) >= 0)
      || (email && effectiveEmail.indexOf(email) >= 0)
      || (nameQuery && fullName.toLowerCase().indexOf(nameQuery) >= 0)
      || (phoneQuery && parentPhone.toLowerCase().indexOf(phoneQuery) >= 0);
    if (!textMatch) continue;
    var stageInfo = null;
    if (stageFilter) {
      stageInfo = getApplicantStageAndEligibility_(rowObj);
      if (clean_(stageInfo.stage || "").toUpperCase() !== stageFilter) continue;
    }
    var statusRow = {
      Birth_ID_Status: idx.Birth_ID_Status ? clean_(row[idx.Birth_ID_Status - 1]) : "",
      Birth_Status: idx.Birth_Status ? clean_(row[idx.Birth_Status - 1]) : "",
      Report_Status: idx.Report_Status ? clean_(row[idx.Report_Status - 1]) : "",
      Photo_Status: idx.Photo_Status ? clean_(row[idx.Photo_Status - 1]) : "",
      Transfer_Status: idx.Transfer_Status ? clean_(row[idx.Transfer_Status - 1]) : "",
      Receipt_Status: idx.Receipt_Status ? clean_(row[idx.Receipt_Status - 1]) : ""
    };
    var paymentBadge = canonicalPaymentBadge_(statusRow);
    var docStage = computeDocVerificationStatus_(statusRow);
    var authorityProjection = compatibilityCommunicationAuthorityProjection_(rowObj, r + 1);
    out.push(Object.assign({
      rowNumber: r + 1,
      applicantId: rid,
      name: fullName,
      email: effectiveEmail,
      phone: parentPhone,
      docStatus: docStage,
      paymentVerified: paymentBadge === "Verified" ? "Payment Verified" : (paymentBadge === "Rejected" ? "Payment Rejected" : "Payment Pending"),
      portalAccess: clean_(row[idx.Portal_Access_Status - 1]) || "Open",
      docsFollowupSentAt: getDocsFollowupSentAt_(rowObj),
      stage: stageInfo ? clean_(stageInfo.stage || "") : "",
      priority: stageInfo ? mapStagePriority_(stageInfo.stage || "") : ""
    }, authorityProjection || {}));
  }

  return { ok: true, rows: out };
}

function compatibilityCommunicationAuthorityProjection_(rowObj, rowNumber) {
  var row = rowObj || {};
  var rowNum = Number(rowNumber || row._rowNumber || 0);
  if (typeof buildActionabilityPreviewRow_ !== "function") {
    return {
      actionabilityState: "",
      selectable: false,
      selectBlockReason: "",
      recommendedAction: "",
      recommendedMessageType: "",
      actionOwner: "",
      canonicalLifecycle: null
    };
  }
  var authorityRow = buildActionabilityPreviewRow_(row, rowNum);
  return {
    actionabilityState: clean_(authorityRow && authorityRow.actionabilityState || ""),
    selectable: !!(authorityRow && authorityRow.selectable === true),
    selectBlockReason: clean_(authorityRow && authorityRow.selectBlockReason || ""),
    recommendedAction: clean_(authorityRow && authorityRow.recommendedAction || ""),
    recommendedMessageType: clean_(authorityRow && authorityRow.recommendedMessageType || ""),
    actionOwner: clean_(authorityRow && authorityRow.actionOwner || ""),
    canonicalLifecycle: authorityRow && authorityRow.canonicalLifecycle ? {
      baseState: clean_(authorityRow.canonicalLifecycle.baseState || ""),
      lifecycleStage: clean_(authorityRow.canonicalLifecycle.lifecycleStage || ""),
      overlays: Array.isArray(authorityRow.canonicalLifecycle.overlays) ? authorityRow.canonicalLifecycle.overlays.slice() : [],
      recommendedNextAction: clean_(authorityRow.canonicalLifecycle.recommendedNextAction || ""),
      recommendedMessageType: clean_(authorityRow.canonicalLifecycle.recommendedMessageType || ""),
      actionOwner: clean_(authorityRow.canonicalLifecycle.actionOwner || ""),
      reason: clean_(authorityRow.canonicalLifecycle.reason || "")
    } : null
  };
}

function admin_getApplicantDetail(payload) {
  try {
    Logger.log("SIG admin_getApplicantDetail: %s row=%s id=%s", ADMIN_DETAIL_SIG, payload && payload.rowNumber, payload && payload.applicantId);
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) {
      return { ok: false, error: "Access denied" };
    }

    if (!payload) {
      return { ok: false, error: "Missing payload" };
    }

    var rowNumber = Number(payload.rowNumber);
    var applicantId = clean_(payload.applicantId || "");

    var sheet = openDataSheet_();
    if (!sheet) {
      return { ok: false, code: "DATA_SHEET_NOT_FOUND", debugId: newDebugId_(), error: "Data sheet not found" };
    }

    var lastRow = sheet.getLastRow();
    var rowNumberValid = !!(rowNumber && rowNumber >= 2 && Math.floor(rowNumber) === rowNumber && rowNumber <= lastRow);
    if (!rowNumberValid) {
      if (applicantId) {
        rowNumber = findRowByApplicantId_(sheet, applicantId);
        rowNumberValid = !!(rowNumber && rowNumber >= 2);
      }
    }
    if (!rowNumberValid) {
      var dbgMissing = newDebugId_();
      if (!applicantId) {
        return {
          ok: false,
          code: "MISSING_ROWNUMBER_AND_ID",
          message: "Cannot review record: missing rowNumber and ApplicantID.",
          debugId: dbgMissing,
          error: "Cannot review record: missing rowNumber and ApplicantID. Debug ID: " + dbgMissing
        };
      }
      return {
        ok: false,
        code: "DETAIL_ROW_NOT_FOUND",
        message: "Could not locate applicant record for review.",
        debugId: dbgMissing,
        error: "Could not locate applicant record for review. Debug ID: " + dbgMissing
      };
    }

    var lastCol = sheet.getLastColumn();
    var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
    var idx = headerIndex_(headers);
    var resolveLocalHeaderAlias_ = function(canonicalKey, aliases) {
      if (idx[canonicalKey]) return;
      for (var i = 0; i < aliases.length; i++) {
        var aliasKey = aliases[i];
        if (idx[aliasKey]) {
          idx[canonicalKey] = idx[aliasKey];
          return;
        }
      }
    };
    resolveLocalHeaderAlias_("First_Name", ["FirstName", "First Name"]);
    resolveLocalHeaderAlias_("Last_Name", ["LastName", "Last Name"]);
    if (!idx.First_Name) {
      throw new Error("Missing required identity header: First_Name (aliases checked: FirstName, First Name)");
    }
    if (!idx.Last_Name) {
      throw new Error("Missing required identity header: Last_Name (aliases checked: LastName, Last Name)");
    }
    requireHeaders_(idx, [
      "ApplicantID", "Parent_Email", "Parent_Email_Corrected",
      "Portal_Access_Status", "Doc_Verification_Status", "Doc_Last_Verified_At", "Doc_Last_Verified_By",
      "PortalTokenIssuedAt",
      "Birth_ID_Passport_File", "Latest_School_Report_File", "Transfer_Certificate_File", "Passport_Photo_File", "Fee_Receipt_File",
      "Birth_ID_Status", "Birth_ID_Comment", "Report_Status", "Report_Comment", "Transfer_Status", "Transfer_Comment",
      "Photo_Status", "Photo_Comment", "Receipt_Status", "Receipt_Comment"
    ]);

    var values = sheet.getRange(rowNumber, 1, 1, lastCol).getValues();
    var displayRow = sheet.getRange(rowNumber, 1, 1, lastCol).getDisplayValues()[0];
    if (!values || !values.length) {
      return { ok: false, code: "ROW_EMPTY", debugId: newDebugId_(), error: "Row empty for RowNumber=" + rowNumber };
    }

    var row = values[0];
    var rowApplicantId = clean_(row[idx.ApplicantID - 1]);
    if (!rowApplicantId) {
      if (applicantId) {
        return { ok: false, error: "Row not found for ApplicantID=" + applicantId + " RowNumber=" + rowNumber };
      }
      return { ok: false, code: "ROW_EMPTY", debugId: newDebugId_(), error: "Row empty for RowNumber=" + rowNumber };
    }

    var issuedAtRaw = row[idx.PortalTokenIssuedAt - 1];
    var issuedAtDate = issuedAtRaw ? new Date(issuedAtRaw) : null;
    var tokenAgeDays = null;
    if (issuedAtDate && !isNaN(issuedAtDate.getTime())) {
      tokenAgeDays = Math.floor((new Date().getTime() - issuedAtDate.getTime()) / (24 * 60 * 60 * 1000));
    }
    var tokenExpired = tokenAgeDays !== null && tokenAgeDays > Number(CONFIG.PORTAL_TOKEN_MAX_AGE_DAYS || 0);

    var detailObj = {
      _rowNumber: rowNumber,
      ApplicantID: rowApplicantId,
      First_Name: clean_(row[idx.First_Name - 1]),
      Last_Name: clean_(row[idx.Last_Name - 1]),
      Parent_Email: clean_(row[idx.Parent_Email - 1]),
      Parent_Email_Corrected: clean_(row[idx.Parent_Email_Corrected - 1]),
      Email_Status: idx.Email_Status ? clean_(row[idx.Email_Status - 1]) : "",
      Email_Verification_Status: idx.Email_Verification_Status ? clean_(row[idx.Email_Verification_Status - 1]) : "",
      Email_Bounce_Flag: idx.Email_Bounce_Flag ? clean_(row[idx.Email_Bounce_Flag - 1]) : "",
      Email_Bounce_Reason: idx.Email_Bounce_Reason ? clean_(row[idx.Email_Bounce_Reason - 1]) : "",
      Last_Delivery_Status: idx.Last_Delivery_Status ? clean_(row[idx.Last_Delivery_Status - 1]) : "",
      Last_Bounce_Date: idx.Last_Bounce_Date ? clean_(row[idx.Last_Bounce_Date - 1]) : "",
      Bounce_Reason: idx.Bounce_Reason ? clean_(row[idx.Bounce_Reason - 1]) : "",
      Delivery_Health: idx.Delivery_Health ? clean_(row[idx.Delivery_Health - 1]) : "",
      Delivery_Reconciliation_Key: idx.Delivery_Reconciliation_Key ? clean_(row[idx.Delivery_Reconciliation_Key - 1]) : "",
      Delivery_Reconciliation_Source: idx.Delivery_Reconciliation_Source ? clean_(row[idx.Delivery_Reconciliation_Source - 1]) : "",
      Email_Next_Action_Date: idx.Email_Next_Action_Date ? clean_(row[idx.Email_Next_Action_Date - 1]) : "",
      Last_Email_Error: idx.Last_Email_Error ? clean_(row[idx.Last_Email_Error - 1]) : "",
      Last_Email_To: idx.Last_Email_To ? clean_(row[idx.Last_Email_To - 1]) : "",
      Last_Contacted_At: idx.Last_Contacted_At ? clean_(row[idx.Last_Contacted_At - 1]) : "",
      Last_Contact_Type: idx.Last_Contact_Type ? clean_(row[idx.Last_Contact_Type - 1]) : "",
      Last_Contact_By: idx.Last_Contact_By ? clean_(row[idx.Last_Contact_By - 1]) : "",
      Last_Contact_Subject: idx.Last_Contact_Subject ? clean_(row[idx.Last_Contact_Subject - 1]) : "",
      Last_Contact_Result: idx.Last_Contact_Result ? clean_(row[idx.Last_Contact_Result - 1]) : "",
      Birth_ID_Status: idx.Birth_ID_Status ? clean_(row[idx.Birth_ID_Status - 1]) : "",
      Birth_Status: idx.Birth_Status ? clean_(row[idx.Birth_Status - 1]) : "",
      Report_Status: clean_(row[idx.Report_Status - 1]),
      Photo_Status: clean_(row[idx.Photo_Status - 1]),
      Transfer_Status: clean_(row[idx.Transfer_Status - 1]),
      Receipt_Status: clean_(row[idx.Receipt_Status - 1]),
      Portal_Submitted: idx.Portal_Submitted ? clean_(row[idx.Portal_Submitted - 1]) : "",
      Docs_Verified: idx.Docs_Verified ? clean_(row[idx.Docs_Verified - 1]) : "",
      Payment_Verified: idx.Payment_Verified ? clean_(row[idx.Payment_Verified - 1]) : "",
      Registration_Complete: idx.Registration_Complete ? clean_(row[idx.Registration_Complete - 1]) : "",
      Books_Contact_ID: idx.Books_Contact_ID ? clean_(row[idx.Books_Contact_ID - 1]) : "",
      Books_Contact_Name: idx.Books_Contact_Name ? clean_(row[idx.Books_Contact_Name - 1]) : "",
      Books_Invoice_ID: idx.Books_Invoice_ID ? clean_(row[idx.Books_Invoice_ID - 1]) : "",
      Books_Invoice_Number: idx.Books_Invoice_Number ? clean_(row[idx.Books_Invoice_Number - 1]) : "",
      Books_Invoice_Status: idx.Books_Invoice_Status ? clean_(row[idx.Books_Invoice_Status - 1]) : "",
      Books_Push_Status: idx.Books_Push_Status ? clean_(row[idx.Books_Push_Status - 1]) : "",
      Books_Push_At: idx.Books_Push_At ? clean_(row[idx.Books_Push_At - 1]) : "",
      Books_Last_Push_At: idx.Books_Last_Push_At ? clean_(row[idx.Books_Last_Push_At - 1]) : "",
      Books_Push_By: idx.Books_Push_By ? clean_(row[idx.Books_Push_By - 1]) : "",
      Books_Last_Error: idx.Books_Last_Error ? clean_(row[idx.Books_Last_Error - 1]) : "",
      Handled_By: idx.Handled_By ? clean_(row[idx.Handled_By - 1]) : "",
      Handled_At: idx.Handled_At ? clean_(row[idx.Handled_At - 1]) : "",
      Enrolled_By: idx.Enrolled_By ? clean_(row[idx.Enrolled_By - 1]) : "",
      Enrolled_At: idx.Enrolled_At ? clean_(row[idx.Enrolled_At - 1]) : "",
      Fee_Receipt_File: idx.Fee_Receipt_File ? clean_(row[idx.Fee_Receipt_File - 1]) : "",
      Fee_Total_Kina: idx.Fee_Total_Kina ? clean_(row[idx.Fee_Total_Kina - 1]) : "",
      Total_Fee_Kina: idx.Total_Fee_Kina ? clean_(row[idx.Total_Fee_Kina - 1]) : "",
      Total_Fee: idx.Total_Fee ? clean_(row[idx.Total_Fee - 1]) : "",
      Portal_Access_Status: clean_(row[idx.Portal_Access_Status - 1]) || "Open",
      Doc_Verification_Status: clean_(row[idx.Doc_Verification_Status - 1]) || "Pending",
      Doc_Last_Verified_At: row[idx.Doc_Last_Verified_At - 1],
      Doc_Last_Verified_By: clean_(row[idx.Doc_Last_Verified_By - 1]),
      PortalTokenIssuedAt: issuedAtDate && !isNaN(issuedAtDate.getTime()) ? issuedAtDate.toISOString() : "",
      PortalTokenAgeDays: tokenAgeDays,
      PortalTokenExpired: tokenExpired,
      PortalTokenMaxAgeDays: Number(CONFIG.PORTAL_TOKEN_MAX_AGE_DAYS || 0)
    };

    var map = CONFIG.DOC_FIELDS || [];
    detailObj._docs = map.map(function (m) {
      var rawValue = displayRow[idx[m.file] - 1];
      var resolvedUrls = normalizeToUrlList_(rawValue, m.file);
      var url = resolvedUrls.length ? clean_(resolvedUrls[0]) : clean_(rawValue);
      return {
        label: m.label,
        file: m.file,
        statusField: m.status,
        commentField: m.comment,
        required: m.required !== false,
        rawValue: rawValue,
        url: url,
        hasFile: hasUploadEvidence_(rawValue, m.file),
        status: normalizeDocStatus_(clean_(row[idx[m.status] - 1]) || "Pending"),
        comment: clean_(row[idx[m.comment] - 1])
      };
    });

    detailObj.Effective_Email = clean_(detailObj.Parent_Email_Corrected || detailObj.Parent_Email || "");
    detailObj.Parent_Email_Corrected = String(detailObj.Parent_Email_Corrected || "");
    var docStageComputed = computeDocVerificationStatus_(detailObj);
    var paymentBadge = canonicalPaymentBadge_(detailObj);
    var overallComputed = computeOverallStatus_(detailObj);
    var paymentVerifiedBool = isCanonicalPaymentVerified_(detailObj);
    var overallStored = idx.Overall_Status ? clean_(row[idx.Overall_Status - 1]) : "";
    var canOverride = canOverrideOverall_(adminEmail);
    var isSuperAdminCaller = canBypassPaymentFreeze_(adminEmail);
    var isOverridden = !!(canOverride && overallStored && overallStored !== overallComputed);
    detailObj.Payment_Received = hasUploadEvidence_(detailObj.Fee_Receipt_File, "Fee_Receipt_File") ? "Yes" : "No";
    detailObj.Docs_Verified = clean_(detailObj.Docs_Verified || "") === "Yes" ? "Yes" : "No";
    detailObj.Portal_Submitted = (nonEmpty_(clean_(detailObj.Portal_Submitted || "")) && clean_(detailObj.Portal_Submitted || "") !== "No") ? "Yes" : "No";
    var paymentVerifiedRaw = clean_(detailObj.Payment_Verified || "") === "Yes";
    detailObj.Payment_Verified_Raw = paymentVerifiedRaw ? "Yes" : "No";
    detailObj.Payment_Verified = paymentVerifiedBool ? "Yes" : "No";
    detailObj.Enrolled_Confirmed = clean_(detailObj.Enrolled_Confirmed || "") === "Yes" ? "Yes" : "No";
    detailObj.Payment_Verified_Bool = paymentVerifiedBool;
    detailObj.paymentVerified = paymentVerifiedBool;
    detailObj.isPaymentVerified = paymentVerifiedBool;
    detailObj.invoiceRaised = !!clean_(detailObj.Books_Invoice_ID || "");
    detailObj.Books_Last_Push_At = clean_(detailObj.Books_Last_Push_At || detailObj.Books_Push_At || "");
    detailObj.Invoice_Email_Status = "UNKNOWN";
    detailObj.isSuperAdmin = !!isSuperAdminCaller;
    detailObj.Payment_Badge = paymentBadge;
    detailObj.Doc_Verification_Status_Computed = docStageComputed;
    detailObj.Overall_Status_Computed = overallComputed;
    detailObj.Portal_Locked_Computed = isPortalLocked_(detailObj);
    detailObj.Portal_Lock_Reason = getPortalLockReason_(detailObj);
    detailObj.Overall_Status_Stored = overallStored;
    detailObj.Overall_IsOverridden = isOverridden;
    detailObj.Overall_OverrideValue = isOverridden ? overallStored : "";
    detailObj.overallComputed = overallComputed;
    detailObj.overallStored = overallStored;
    detailObj.isOverridden = isOverridden;
    detailObj.Doc_Verification_Status = docStageComputed;
    detailObj.Portal_Access_Status = String(detailObj.Portal_Access_Status || "");
    detailObj.Doc_Verification_Status = String(detailObj.Doc_Verification_Status || "Pending");
    detailObj._docs = (detailObj._docs || []).map(function (d) {
      d.url = asStringUrl_(d.url);
      d.hasFile = hasUploadEvidence_(d.rawValue || d.url, d.file);
      return d;
    });
    if (typeof buildActionabilityPreviewRow_ === "function") {
      var authorityRow = buildActionabilityPreviewRow_(detailObj, rowNumber);
      detailObj._authorityDisplay = {
        actionOwner: clean_(authorityRow && authorityRow.actionOwner || ""),
        nextAction: clean_(authorityRow && authorityRow.nextAction || ""),
        actionabilityState: clean_(authorityRow && authorityRow.actionabilityState || ""),
        selectable: !!(authorityRow && authorityRow.selectable === true),
        selectBlockReason: clean_(authorityRow && authorityRow.selectBlockReason || ""),
        recommendedAction: clean_(authorityRow && authorityRow.recommendedAction || ""),
        reasonCode: clean_(authorityRow && authorityRow.reasonCode || ""),
        communicationProgress: clean_(authorityRow && authorityRow.communicationProgress || ""),
        communicationProgressDetail: clean_(authorityRow && authorityRow.communicationProgressDetail || ""),
        recommendedMessageType: clean_(authorityRow && authorityRow.recommendedMessageType || ""),
        canonicalLifecycle: authorityRow && authorityRow.canonicalLifecycle ? {
          baseState: clean_(authorityRow.canonicalLifecycle.baseState || ""),
          lifecycleStage: clean_(authorityRow.canonicalLifecycle.lifecycleStage || ""),
          overlays: Array.isArray(authorityRow.canonicalLifecycle.overlays) ? authorityRow.canonicalLifecycle.overlays.slice() : [],
          recommendedNextAction: clean_(authorityRow.canonicalLifecycle.recommendedNextAction || ""),
          recommendedMessageType: clean_(authorityRow.canonicalLifecycle.recommendedMessageType || ""),
          actionOwner: clean_(authorityRow.canonicalLifecycle.actionOwner || ""),
          reason: clean_(authorityRow.canonicalLifecycle.reason || "")
        } : null,
        authorityState: authorityRow && authorityRow.authorityState ? {
          lifecycleStage: clean_(authorityRow.authorityState.lifecycleStage || ""),
          documentState: clean_(authorityRow.authorityState.documentState || ""),
          requiredDocumentUploadComplete: authorityRow.authorityState.requiredDocumentUploadComplete === true,
          uploadedRequiredDocumentCount: Number(authorityRow.authorityState.uploadedRequiredDocumentCount || 0),
          requiredDocumentCount: Number(authorityRow.authorityState.requiredDocumentCount || 0),
          missingRequiredDocuments: Array.isArray(authorityRow.authorityState.missingRequiredDocuments) ? authorityRow.authorityState.missingRequiredDocuments.slice() : [],
          docsVerified: authorityRow.authorityState.docsVerified === true,
          portalSubmitted: authorityRow.authorityState.portalSubmitted === true,
          paymentEvidencePresent: authorityRow.authorityState.paymentEvidencePresent === true,
          paymentVerified: authorityRow.authorityState.paymentVerified === true,
          hasValidEmail: authorityRow.authorityState.hasValidEmail === true,
          hasPhoneFallback: authorityRow.authorityState.hasPhoneFallback === true,
          contactabilityState: clean_(authorityRow.authorityState.contactabilityState || "")
        } : null
      };
    }

    if (!detailObj) {
      return { ok: false, error: "Failed to build detail object" };
    }

    Logger.log("DOC_URL_SAMPLE: %s", JSON.stringify(detailObj._docs.map(function (d) {
      return { file: d.file, url: d.url, t: typeof d.url };
    })));
    var resultObject = { ok: true, detail: detailObj };
    Logger.log("DETAIL RETURN SHAPE: %s", JSON.stringify(resultObject));
    return resultObject;
  } catch (e) {
    return { ok: false, error: "admin_getApplicantDetail failed: " + (e && e.message ? e.message : String(e)) };
  }
}

function safeJson_(obj) {
  return JSON.stringify(obj, function (key, val) {
    if (val === undefined) return null;
    if (val instanceof Date) return val.toISOString();
    return val;
  });
}

function admin_getApplicantDetail_json(payload) {
  var SIG = "DETAIL_JSON_V1_20260220";
  Logger.log("SIG admin_getApplicantDetail_json: %s row=%s id=%s",
    SIG,
    payload && payload.rowNumber,
    payload && payload.applicantId
  );

  var res = admin_getApplicantDetail(payload);

  var json = JSON.stringify(res, function (k, v) {
    if (v === undefined) return null;
    if (v instanceof Date) return v.toISOString();
    return v;
  });

  Logger.log("SIG admin_getApplicantDetail_json returning length=%s",
    json ? json.length : 0
  );

  return json;
}

// Document gallery, manifest, signed file-action, rendition, and preview backfill functions live in Admin_DocumentGallery.js.

function getZohoBooksWriteAdminEmails_() {
  var raw = "";
  try {
    raw = safeStr_(PropertiesService.getScriptProperties().getProperty("ZOHO_BOOKS_WRITE_ADMINS") || "");
  } catch (_e) {
    raw = "";
  }
  return raw.split(",").map(function (v) {
    return safeStr_(v).toLowerCase();
  }).filter(function (v) {
    return !!v;
  });
}

function canWriteZohoBooksForAdmin_(email) {
  var e = safeStr_(email || "").toLowerCase();
  if (!e) return false;
  if (getAdminRole_(e) === "SUPER") return true;
  return getZohoBooksWriteAdminEmails_().indexOf(e) >= 0;
}

function getZohoBooksOAuthSetupAllowedKeys_() {
  return [
    "ZOHO_BOOKS_CLIENT_ID",
    "ZOHO_BOOKS_CLIENT_SECRET",
    "ZOHO_BOOKS_REFRESH_TOKEN",
    "ZOHO_BOOKS_ACCOUNTS_URL",
    "ZOHO_BOOKS_API_DOMAIN",
    "ZOHO_BOOKS_ORGANIZATION_ID"
  ];
}

function admin_setZohoBooksOAuthProperties(payload) {
  return withEnvelope_("admin_setZohoBooksOAuthProperties", function (dbgId) {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    requireSuperAdmin_(adminEmail);
    if (CONFIG.ENABLE_ZOHO_BOOKS_SECRET_SETUP !== true) {
      return err_("SECRET_SETUP_DISABLED", "Temporary Zoho Books secret setup is disabled.", dbgId);
    }

    var p = payload && typeof payload === "object" ? payload : {};
    var wrapped = p.properties && typeof p.properties === "object";
    if (wrapped) {
      var outerRejected = Object.keys(p).filter(function (key) { return key !== "properties"; });
      if (outerRejected.length) {
        return err_("INVALID_PROPERTY_KEY", "Only the approved Zoho Books OAuth properties wrapper is accepted.", dbgId, {
          rejectedKeys: outerRejected
        });
      }
    }
    var values = wrapped ? p.properties : p;
    var allowed = getZohoBooksOAuthSetupAllowedKeys_();
    var allowedMap = {};
    allowed.forEach(function (key) { allowedMap[key] = true; });

    var submittedKeys = Object.keys(values || {});
    if (!submittedKeys.length) {
      return err_("NO_PROPERTIES_SUBMITTED", "No Zoho Books OAuth properties were submitted.", dbgId);
    }
    var rejected = submittedKeys.filter(function (key) { return !allowedMap[key]; });
    if (rejected.length) {
      return err_("INVALID_PROPERTY_KEY", "Only approved Zoho Books OAuth property keys are accepted.", dbgId, {
        rejectedKeys: rejected
      });
    }

    var missing = allowed.filter(function (key) {
      return !Object.prototype.hasOwnProperty.call(values, key) || !clean_(values[key]);
    });
    if (missing.length) {
      return err_("MISSING_PROPERTY_VALUES", "All approved Zoho Books OAuth properties are required for setup.", dbgId, {
        missingKeys: missing
      });
    }

    var fixed = {
      ZOHO_BOOKS_ACCOUNTS_URL: "https://accounts.zoho.com",
      ZOHO_BOOKS_API_DOMAIN: "https://www.zohoapis.com",
      ZOHO_BOOKS_ORGANIZATION_ID: "908427349"
    };
    var fixedKeys = Object.keys(fixed);
    for (var i = 0; i < fixedKeys.length; i++) {
      var fixedKey = fixedKeys[i];
      if (clean_(values[fixedKey]) !== fixed[fixedKey]) {
        return err_("INVALID_PROPERTY_VALUE", "A fixed Zoho Books setup property did not match the approved value.", dbgId, {
          key: fixedKey
        });
      }
    }

    var props = PropertiesService.getScriptProperties();
    var savedKeys = [];
    var valueLengths = {};
    allowed.forEach(function (key) {
      var value = clean_(values[key]);
      props.setProperty(key, value);
      savedKeys.push(key);
      valueLengths[key] = value.length;
    });

    var tokenStatus = getZohoBooksTokenReadiness_();
    return ok_({
      status: tokenStatus && tokenStatus.ok === true ? "TOKEN_READY" : "TOKEN_NOT_READY",
      savedKeys: savedKeys,
      valueLengths: valueLengths,
      tokenStatus: tokenStatus && typeof tokenStatus === "object" ? {
        ok: tokenStatus.ok === true,
        code: safeStr_(tokenStatus.code || ""),
        message: safeStr_(tokenStatus.message || ""),
        tokenSource: safeStr_(tokenStatus.tokenSource || ""),
        requiredScopes: tokenStatus.requiredScopes || []
      } : { ok: false, code: "TOKEN_STATUS_UNAVAILABLE" }
    }, dbgId);
  });
}

function findZohoBooksApplicantRow_(sheet, payload) {
  var p = payload || {};
  var rowNumber = Number(p.rowNumber || p.row || 0);
  if (rowNumber >= 2) return rowNumber;
  var applicantId = clean_(p.applicantId || p.applicantIdOrRowKey || p.lookup || "");
  if (applicantId) return findRowByApplicantId_(sheet, applicantId);
  return 0;
}

function buildZohoBooksRowObject_(sheet, rowNumber) {
  var sh = sheet;
  var rowNum = Number(rowNumber || 0);
  if (!sh || rowNum < 2) throw new Error("Invalid rowNumber for Zoho Books preview.");
  var lastCol = sh.getLastColumn();
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var values = sh.getRange(rowNum, 1, 1, lastCol).getValues()[0];
  var out = { _rowNumber: rowNum };
  for (var i = 0; i < headers.length; i++) {
    var key = clean_(headers[i]);
    if (key) out[key] = values[i];
  }
  out.ApplicantID = clean_(out.ApplicantID || "");
  out.Effective_Email = clean_(out.Parent_Email_Corrected || out.Parent_Email || "");
  out.Student_Name = rowStudentName_(out);
  out.Parent_Name = getWhatsAppFallbackParentName_(out);
  out.Parent_Phone_Effective = getWhatsAppFallbackPhoneRaw_(out);
  out.Program_Summary = rowProgramSummary_(out);
  out.Subjects_Summary = rowSubjectsSummary_(out);
  out.Books_Push_Status = clean_(out.Books_Push_Status || "NOT_READY");
  return { rowObj: out, headers: headers, idx: headerIndex_(headers) };
}

function evaluateZohoBooksHeaderReadiness_(headers) {
  var required = [
    "Books_Contact_ID",
    "Books_Contact_Name",
    "Books_Invoice_ID",
    "Books_Invoice_Number",
    "Books_Invoice_Status",
    "Books_Push_Status",
    "Books_Push_At",
    "Books_Push_By",
    "Books_Last_Error",
    "Books_Last_Attempt_At",
    "Books_Attempt_Count",
    "Books_Last_Payload_Hash",
    "FODE_Billing_Reference"
  ];
  var present = [];
  var missing = [];
  var map = headerIndex_(headers || []);
  required.forEach(function (key) {
    if (map[key]) present.push(key);
    else missing.push(key);
  });
  return {
    required: required,
    present: present,
    missing: missing,
    status: missing.length ? "COLUMN_MISSING" : "COLUMN_READY",
    writeBlocked: missing.length > 0
  };
}

function findSimilarZohoBooksHeaders_(headers, required) {
  var list = Array.isArray(headers) ? headers : [];
  var need = Array.isArray(required) ? required : [];
  function norm(s) {
    return safeStr_(s || "").toLowerCase().replace(/[^a-z0-9]/g, "");
  }
  var out = {};
  need.forEach(function (key) {
    if (!key) return;
    var target = norm(key);
    var exact = safeStr_(key);
    var matches = [];
    list.forEach(function (header) {
      var raw = safeStr_(header);
      if (!raw || raw === exact) return;
      if (norm(raw) === target) matches.push(raw);
    });
    if (matches.length) out[exact] = matches;
  });
  return out;
}

function ensureZohoBooksHeaders_(sheet) {
  var sh = sheet;
  if (!sh) {
    return { ok: false, code: "SHEET_NOT_CONFIRMED", message: "Main data sheet is not available." };
  }
  var expectedName = clean_(CONFIG.SHEET_NAME_WORKING || CONFIG.SHEET_TAB_WORKING || "");
  var actualName = clean_(sh.getName ? sh.getName() : "");
  if (!expectedName || !actualName || actualName !== expectedName) {
    return {
      ok: false,
      code: "SHEET_NOT_CONFIRMED",
      message: "Target sheet could not be confirmed safely.",
      expectedSheetName: expectedName,
      actualSheetName: actualName
    };
  }
  var lastCol = Math.max(1, Number(sh.getLastColumn() || 1));
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
  var readinessBefore = evaluateZohoBooksHeaderReadiness_(headers);
  var missing = readinessBefore.missing.slice();
  var added = [];
  if (missing.length) {
    sh.getRange(1, lastCol + 1, 1, missing.length).setValues([missing]);
    added = missing.slice();
    SpreadsheetApp.flush();
  }
  var finalHeaders = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var readinessAfter = evaluateZohoBooksHeaderReadiness_(finalHeaders);
  readinessAfter.added = added;
  readinessAfter.alreadyPresent = readinessBefore.present.slice();
  readinessAfter.similarNonExact = findSimilarZohoBooksHeaders_(finalHeaders, readinessAfter.required);
  readinessAfter.sheetName = actualName;
  readinessAfter.sheetConfirmed = true;
  readinessAfter.status = readinessAfter.missing.length ? "COLUMN_MISSING" : "COLUMN_READY";
  return { ok: true, headers: finalHeaders, readiness: readinessAfter };
}

function lookupZohoBooksInvoiceUrlById_(invoiceId) {
  var id = safeStr_(invoiceId || "");
  if (!id) return { ok: false, code: "NO_INVOICE_ID", url: "" };
  try {
    var res = zohoBooksApiRequest_("get", "invoices/" + encodeURIComponent(id), null, {});
    if (!res || res.ok !== true) {
      return {
        ok: false,
        code: safeStr_(res && res.code || "INVOICE_ID_LOOKUP_FAILED"),
        message: safeStr_(res && res.message || ""),
        url: ""
      };
    }
    var invoice = res.response && res.response.invoice ? res.response.invoice : {};
    var url = safeStr_(invoice.invoice_url || invoice.invoiceUrl || invoice.url || invoice.permalink_url || invoice.invoice_link || "");
    return {
      ok: !!url,
      code: url ? "INVOICE_URL_FOUND" : "INVOICE_URL_UNAVAILABLE",
      url: url
    };
  } catch (err) {
    return {
      ok: false,
      code: "INVOICE_ID_LOOKUP_ERROR",
      message: safeStr_(err && err.message || err || ""),
      url: ""
    };
  }
}

function buildZohoBooksPreviewResult_(rowObj, options) {
  var row = rowObj || {};
  var opts = options && typeof options === "object" ? options : {};
  var cfg = getZohoBooksConfig_();
  var payer = resolveFodePayerFromRecord_(row);
  var payerKey = buildFodePayerKey_(payer);
  var billingReference = buildFodeBillingReference_(row);
  var itemCandidate = buildZohoBooksItemCandidate_(row);
  var resolvedItems = buildZohoBooksResolvedLineItemsV3_(row, {
    liveItemsResult: opts.itemsDiscovery && opts.itemsDiscovery.ok === true ? opts.itemsDiscovery : null
  });
  var amountInfo = detectZohoBooksSourceAmount_(row, resolvedItems);
  var amount = Number(amountInfo.amount || 0);
  var contactPayload = buildZohoBooksContactPayload_(row, payer);
  var localContact = safeStr_(row.Books_Contact_ID || "");
  var localInvoice = safeStr_(row.Books_Invoice_ID || "");
  var localInvoiceNumber = safeStr_(row.Books_Invoice_Number || "");
  var localInvoiceStatus = safeStr_(row.Books_Invoice_Status || "");
  var localPushAt = safeStr_(row.Books_Last_Push_At || row.Books_Push_At || "");
  var localPushBy = safeStr_(row.Books_Push_By || "");
  var contactLookup = opts.contactLookup || { ok: true, code: "NOT_CHECKED", matches: [] };
  var invoiceLookup = opts.invoiceLookup || { ok: true, code: "NOT_CHECKED", matches: [] };
  var invoiceRaised = !!(localInvoice || (invoiceLookup.ok && Array.isArray(invoiceLookup.matches) && invoiceLookup.matches.length));
  var firstInvoiceMatch = invoiceLookup.ok && Array.isArray(invoiceLookup.matches) && invoiceLookup.matches.length
    ? (invoiceLookup.matches[0] || {})
    : {};
  var effectiveInvoiceId = safeStr_(localInvoice || firstInvoiceMatch.invoice_id || firstInvoiceMatch.invoiceId || "");
  var effectiveInvoiceNumber = safeStr_(localInvoiceNumber || firstInvoiceMatch.invoice_number || firstInvoiceMatch.invoiceNumber || "");
  var effectiveInvoiceStatus = safeStr_(localInvoiceStatus || firstInvoiceMatch.status || firstInvoiceMatch.invoice_status || firstInvoiceMatch.invoiceStatus || "");
  var currentInvoiceUrlSource = "";
  var currentInvoiceUrl = safeStr_(row.Books_Invoice_URL || row.Books_Invoice_Link || row.Invoice_URL
    || firstInvoiceMatch.invoice_url || firstInvoiceMatch.invoiceUrl || firstInvoiceMatch.url
    || firstInvoiceMatch.permalink_url || firstInvoiceMatch.invoice_link || "");
  if (currentInvoiceUrl) currentInvoiceUrlSource = safeStr_(row.Books_Invoice_URL || row.Books_Invoice_Link || row.Invoice_URL) ? "SHEET" : "REFERENCE_LOOKUP";
  var invoiceUrlLookup = { ok: false, code: effectiveInvoiceId ? "NOT_ATTEMPTED" : "NO_INVOICE_ID", url: "" };
  if (!currentInvoiceUrl && effectiveInvoiceId) {
    invoiceUrlLookup = lookupZohoBooksInvoiceUrlById_(effectiveInvoiceId);
    currentInvoiceUrl = safeStr_(invoiceUrlLookup.url || "");
    if (currentInvoiceUrl) currentInvoiceUrlSource = "INVOICE_ID_LOOKUP";
  }
  var missingFields = [];
  if (!safeStr_(payer.name || "")) missingFields.push("PAYER_NAME_MISSING");
  if (!safeStr_(row.Student_Name || rowStudentName_(row))) missingFields.push("STUDENT_MISSING");
  if (!safeStr_(payer.email || "") && !safeStr_(payer.phone || "")) missingFields.push("PAYER_CONTACT_MISSING");
  if ((resolvedItems.unresolvedSubjects || []).length) missingFields.push("ITEM_NOT_RESOLVED");
  else if (!(resolvedItems.lineItems || []).length && !safeStr_(itemCandidate.itemName || "")) missingFields.push("ITEM_NOT_RESOLVED");
  if (!(amount > 0)) missingFields.push("AMOUNT_MISSING");
  if (resolvedItems.amountMismatch === true && isZohoBooksSourceAmountAuthoritative_()) missingFields.push("AMOUNT_MISMATCH");

  var idempotencyStatus = "READY";
  if (localInvoice) idempotencyStatus = "ALREADY_PROCESSED";
  else if (invoiceLookup.ok && Array.isArray(invoiceLookup.matches) && invoiceLookup.matches.length) idempotencyStatus = "ALREADY_PROCESSED_REMOTE";
  else if (!invoiceLookup.ok && (invoiceLookup.code === "TOKEN_NOT_CONFIGURED" || invoiceLookup.code === "PREAUTH_REQUIRED")) idempotencyStatus = "REMOTE_CHECK_UNAVAILABLE";
  else if (contactLookup.ok && Array.isArray(contactLookup.matches) && contactLookup.matches.length > 1) idempotencyStatus = "AMBIGUOUS_CONTACT_MATCH";

  var booksContact = localContact ? {
    contact_id: localContact,
    contact_name: safeStr_(row.Books_Contact_Name || "")
  } : ((contactLookup.ok && Array.isArray(contactLookup.matches) && contactLookup.matches.length === 1) ? {
    contact_id: safeStr_(contactLookup.matches[0].contact_id || contactLookup.matches[0].contactId || ""),
    contact_name: safeStr_(contactLookup.matches[0].contact_name || contactLookup.matches[0].contactName || "")
  } : null);
  var invoicePayloadResult = buildZohoBooksDraftInvoicePayload_(row, payer, booksContact, {
    liveItemsResult: opts.itemsDiscovery && opts.itemsDiscovery.ok === true ? opts.itemsDiscovery : null
  });
  var invoicePayload = invoicePayloadResult && invoicePayloadResult.ok === true ? invoicePayloadResult.payload : null;
  var fallbackUsed = resolvedItems.fallbackUsed === true || invoicePayloadResult && invoicePayloadResult.fallbackUsed === true;
  var currentPushStatus = safeStr_(row.Books_Push_Status || "");
  var previewReady = missingFields.length === 0
    && (idempotencyStatus === "READY" || idempotencyStatus === "REMOTE_CHECK_UNAVAILABLE")
    && isZohoBooksTestApplicantAllowed_(row);
  var readinessStatus = "READY";
  if (cfg.enabled !== true || cfg.draftInvoiceCreateEnabled !== true) readinessStatus = "WRITE_DISABLED";
  else if (idempotencyStatus === "ALREADY_PROCESSED" || idempotencyStatus === "ALREADY_PROCESSED_REMOTE") readinessStatus = "ALREADY_PUSHED";
  else if (!safeStr_(payer.name || "")) readinessStatus = "BLOCKED_MISSING_PAYER";
  else if (!safeStr_(row.Student_Name || rowStudentName_(row))) readinessStatus = "BLOCKED_MISSING_STUDENT";
  else if (!safeStr_(resolvedItems.detectedGradeCode || "") && (resolvedItems.normalizedSelectedSubjects || []).length) readinessStatus = "BLOCKED_MISSING_GRADE_LEVEL";
  else if (!(amount > 0)) readinessStatus = "BLOCKED_MISSING_AMOUNT";
  else if ((resolvedItems.unresolvedSubjects || []).length || !(resolvedItems.lineItems || []).length) readinessStatus = "BLOCKED_ITEM_MAPPING";
  else if (!invoicePayload) readinessStatus = safeStr_(invoicePayloadResult && invoicePayloadResult.readinessStatus || "BLOCKED_ITEM_MAPPING");
  else if (resolvedItems.amountMismatch === true && isZohoBooksSourceAmountAuthoritative_()) readinessStatus = "BLOCKED_AMOUNT_MISMATCH";
  else if (!isZohoBooksTestApplicantAllowed_(row)) readinessStatus = "WRITE_DISABLED";
  else if (fallbackUsed) readinessStatus = "READY_WITH_FALLBACK";
  var safeToPush = readinessStatus === "READY" || readinessStatus === "READY_WITH_FALLBACK";
  var effectivePushStatus = safeToPush ? "READY" : (readinessStatus === "ALREADY_PUSHED" ? "DRAFT_INVOICE_CREATED" : readinessStatus);
  var blockReason = "";
  if (!safeToPush) {
    if (readinessStatus === "BLOCKED_ITEM_MAPPING" && Array.isArray(resolvedItems.unresolvedSubjectDetails) && resolvedItems.unresolvedSubjectDetails.length) {
      blockReason = resolvedItems.unresolvedSubjectDetails.map(function (x) {
        return safeStr_(x.normalizedSubjectCode || x.desiredItemName || x.subject || "");
      }).filter(function (x) { return !!x; }).join(", ");
    } else if (readinessStatus === "BLOCKED_MISSING_GRADE_LEVEL") {
      blockReason = "Applicant grade/FODE level could not be detected.";
    } else if (readinessStatus === "BLOCKED_AMOUNT_MISMATCH") {
      blockReason = safeStr_(resolvedItems.amountMismatchText || "AMOUNT_MISMATCH");
    } else {
      blockReason = safeStr_(missingFields[0] || readinessStatus);
    }
  }

  return {
    ok: true,
    result: "PREVIEW",
    targetOrgId: cfg.organizationId,
    targetOrgName: cfg.organizationName,
    sourceApplicantId: safeStr_(row.ApplicantID || ""),
    sourceRowNumber: Number(row._rowNumber || 0),
    studentName: safeStr_(row.Student_Name || rowStudentName_(row)),
    payerName: safeStr_(payer.name || ""),
    payerType: safeStr_(payer.payerType || ""),
    payerEmail: safeStr_(payer.email || ""),
    payerPhone: safeStr_(payer.phone || ""),
    payerKey: payerKey,
    proposedFodeBillingReference: billingReference,
    selectedItemId: (resolvedItems.lineItems || []).length ? "" : safeStr_(itemCandidate.itemId || ""),
    selectedItemName: (resolvedItems.lineItems || []).length ? "" : safeStr_(itemCandidate.itemName || ""),
    selectedItemDescription: (resolvedItems.lineItems || []).length ? "" : safeStr_(itemCandidate.description || ""),
    selectedItemAccount: (resolvedItems.lineItems || []).length ? "" : safeStr_(itemCandidate.account || ""),
    selectedItemRate: (resolvedItems.lineItems || []).length ? 0 : Number(itemCandidate.rate || 0),
    selectedItemStatus: (resolvedItems.lineItems || []).length ? "" : safeStr_(itemCandidate.status || ""),
    selectedItemWarning: (resolvedItems.lineItems || []).length ? "" : safeStr_(itemCandidate.warning || ""),
    selectedItemMatchConfidence: safeStr_(itemCandidate.matchConfidence || ""),
    selectedItemCatalogMatched: itemCandidate.catalogMatched === true,
    selectedItemLiveDiscoveryConfirmed: itemCandidate.liveDiscoveryConfirmed === true,
    selectedItemAmountMismatch: resolvedItems.amountMismatch === true || itemCandidate.amountMismatch === true,
    selectedItemAmountMismatchText: safeStr_(resolvedItems.amountMismatchText || itemCandidate.amountMismatchText || ""),
    selectedLineItems: redactZohoBooksPayloadForUi_(resolvedItems.lineItems || []),
    selectedLineCount: Array.isArray(resolvedItems.lineItems) ? resolvedItems.lineItems.length : 0,
    rawSelectedSubjectsSource: safeStr_(resolvedItems.rawSelectedSubjectsSource || ""),
    rawSelectedSubjectsValue: safeStr_(resolvedItems.rawSelectedSubjectsValue || ""),
    rawSelectedSubjects: resolvedItems.rawSelectedSubjects || [],
    detectedGradeCode: safeStr_(resolvedItems.detectedGradeCode || ""),
    detectedGradeLevelKey: safeStr_(resolvedItems.detectedGradeLevelKey || ""),
    detectedGradeSourceField: safeStr_(resolvedItems.detectedGradeSourceField || ""),
    detectedGradeSourceValue: safeStr_(resolvedItems.detectedGradeSourceValue || ""),
    detectedGradeCandidates: redactZohoBooksPayloadForUi_(resolvedItems.detectedGradeCandidates || []),
    normalizedSelectedSubjects: resolvedItems.normalizedSelectedSubjects || [],
    normalizedSelectedSubjectCodes: resolvedItems.normalizedSelectedSubjectCodes || [],
    subjectMappings: redactZohoBooksPayloadForUi_(resolvedItems.subjectMappings || []),
    unresolvedSubjects: resolvedItems.unresolvedSubjects || [],
    unresolvedSubjectDetails: resolvedItems.unresolvedSubjectDetails || [],
    fallbackUsed: fallbackUsed,
    fallbackItemName: safeStr_(resolvedItems.fallbackItemName || ""),
    fallbackMissingItems: resolvedItems.fallbackMissingItems || [],
    exactLineCount: Number(resolvedItems.exactLineCount || 0),
    fallbackLineCount: Number(resolvedItems.fallbackLineCount || 0),
    calculatedAmount: Number(resolvedItems.calculatedAmount || 0),
    sourceAmount: Number(resolvedItems.sourceAmount || 0),
    sourceAmountDetected: Number(amount || 0),
    sourceAmountSource: safeStr_(amountInfo.source || ""),
    amountDifference: Number(resolvedItems.amountDifference || 0),
    displayAmountDifference: Number((amount > 0 ? amount : Number(resolvedItems.sourceAmount || 0)) - Number(resolvedItems.calculatedAmount || 0)),
    includesRegistration: resolvedItems.includesRegistration === true,
    registrationIncluded: resolvedItems.registrationIncluded === true,
    registrationReason: safeStr_(resolvedItems.registrationReason || ""),
    testEmailRecipient: safeStr_(resolvedItems.testEmailRecipient || getZohoBooksTestEmailRecipient_() || ""),
    amount: amount > 0 ? amount : Number(resolvedItems.calculatedAmount || itemCandidate.amount || 0),
    contactPayloadPreview: redactZohoBooksPayloadForUi_(contactPayload),
    invoicePayloadPreview: redactZohoBooksPayloadForUi_(invoicePayload || invoicePayloadResult || {}),
    missingFields: missingFields,
    idempotencyStatus: idempotencyStatus,
    readinessStatus: readinessStatus,
    blockReason: blockReason,
    safe_to_push: safeToPush,
    currentBooksPushStatus: currentPushStatus,
    effectiveBooksPushStatus: effectivePushStatus,
    currentBooksContactId: localContact,
    currentBooksInvoiceId: effectiveInvoiceId,
    currentBooksInvoiceNumber: effectiveInvoiceNumber,
    currentBooksInvoiceStatus: effectiveInvoiceStatus,
    currentBooksInvoiceUrl: currentInvoiceUrl,
    currentBooksInvoiceUrlSource: currentInvoiceUrlSource,
    currentBooksInvoiceUrlLookup: invoiceUrlLookup,
    currentBooksPushAt: localPushAt,
    currentBooksPushBy: localPushBy,
    invoiceRaised: invoiceRaised,
    currentBooksLastError: safeStr_(row.Books_Last_Error || ""),
    currentBooksLastPayloadHash: safeStr_(row.Books_Last_Payload_Hash || ""),
    contactLookup: contactLookup,
    invoiceLookup: invoiceLookup,
    liveWriteEnabled: cfg.enabled === true && cfg.draftInvoiceCreateEnabled === true
  };
}

function admin_preflightZohoBooks(payload) {
  return withEnvelope_("admin_preflightZohoBooks", function (dbgId) {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    var cfg = getZohoBooksConfig_();
    var sh = openDataSheet_();
    var headerEnsure = ensureZohoBooksHeaders_(sh);
    if (!headerEnsure.ok) return headerEnsure;
    var fieldReadiness = headerEnsure.readiness;
    var tokenStatus = getZohoBooksTokenReadiness_();
    var contactFields = tokenStatus.ok ? zohoBooksDiscoverCustomFields_("contacts") : tokenStatus;
    var invoiceFields = tokenStatus.ok ? zohoBooksDiscoverCustomFields_("invoices") : tokenStatus;
    var items = tokenStatus.ok ? zohoBooksDiscoverItems_() : tokenStatus;
    var accounts = tokenStatus.ok ? zohoBooksDiscoverAccounts_() : tokenStatus;
    var itemCatalogStatus = tokenStatus.ok ? compareZohoBooksItemCatalogToDiscovery_(items) : tokenStatus;
    return {
      config: cfg,
      tokenStatus: tokenStatus,
      fieldReadiness: fieldReadiness,
      contactCustomFields: contactFields,
      invoiceCustomFields: invoiceFields,
      itemsDiscovery: items,
      accountsDiscovery: accounts,
      itemCatalogStatus: itemCatalogStatus,
      writeEnabled: cfg.enabled === true && cfg.draftInvoiceCreateEnabled === true,
      writeAdminAuthorized: canWriteZohoBooksForAdmin_(adminEmail),
      debugId: dbgId
    };
  });
}

function admin_previewZohoBooksFodePayload(payload) {
  return withEnvelope_("admin_previewZohoBooksFodePayload", function (dbgId) {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    var sh = openDataSheet_();
    var rowNumber = findZohoBooksApplicantRow_(sh, payload || {});
    if (!(rowNumber >= 2)) return err_("DETAIL_ROW_NOT_FOUND", "Could not locate applicant record for Zoho Books preview.", dbgId);
    var ctx = buildZohoBooksRowObject_(sh, rowNumber);
    var payer = resolveFodePayerFromRecord_(ctx.rowObj);
    var contactLookup = safeStr_(ctx.rowObj.Books_Contact_ID || "")
      ? { ok: true, code: "LOCAL_CONTACT_ID", matches: [{ contact_id: safeStr_(ctx.rowObj.Books_Contact_ID || ""), contact_name: safeStr_(ctx.rowObj.Books_Contact_Name || "") }] }
      : zohoBooksFindContact_(payer);
    var invoiceLookup = safeStr_(ctx.rowObj.Books_Invoice_ID || "")
      ? { ok: true, code: "LOCAL_INVOICE_ID", matches: [{ invoice_id: safeStr_(ctx.rowObj.Books_Invoice_ID || ""), invoice_number: safeStr_(ctx.rowObj.Books_Invoice_Number || "") }] }
      : zohoBooksFindInvoiceByFodeReference_(buildFodeBillingReference_(ctx.rowObj));
    var tokenStatus = getZohoBooksTokenReadiness_();
    var itemsDiscovery = tokenStatus.ok === true ? zohoBooksDiscoverItems_() : tokenStatus;
    var preview = buildZohoBooksPreviewResult_(ctx.rowObj, {
      contactLookup: contactLookup,
      invoiceLookup: invoiceLookup,
      itemsDiscovery: itemsDiscovery
    });
    preview.fieldReadiness = evaluateZohoBooksHeaderReadiness_(ctx.headers);
    preview.tokenStatus = tokenStatus;
    preview.itemsDiscovery = itemsDiscovery;
    preview.debugId = dbgId;
    return preview;
  });
}

function buildZohoBooksWritebackPatch_(row, preview, contactRes, invoiceRes, actorEmail) {
  var nowIso = new Date().toISOString();
  var patch = {
    Books_Push_Status: invoiceRes && invoiceRes.ok === true ? "DRAFT_INVOICE_CREATED" : "ERROR",
    Books_Last_Error: invoiceRes && invoiceRes.ok === true ? "" : safeStr_(invoiceRes && invoiceRes.message || invoiceRes && invoiceRes.code || "BOOKS_WRITE_FAILED"),
    Books_Last_Attempt_At: nowIso,
    Books_Last_Payload_Hash: invoiceRes && invoiceRes.payload ? hashZohoBooksPayload_(invoiceRes.payload) : "",
    FODE_Billing_Reference: buildFodeBillingReference_(row)
  };
  if (invoiceRes && invoiceRes.ok === true) {
    patch.Books_Push_At = nowIso;
    patch.Books_Push_By = safeStr_(actorEmail || "");
    patch.Books_Invoice_ID = safeStr_(invoiceRes.invoice_id || "");
    patch.Books_Invoice_Number = safeStr_(invoiceRes.invoice_number || "");
    patch.Books_Invoice_Status = safeStr_(invoiceRes.invoice_status || "draft");
  }
  if (contactRes && contactRes.ok === true) {
    patch.Books_Contact_ID = safeStr_(contactRes.contact_id || "");
    patch.Books_Contact_Name = safeStr_(contactRes.contact_name || "");
  }
  return patch;
}

function applyZohoBooksWritebackPatch_(sheet, rowNumber, patch) {
  var headerMap = headerIndex_(sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0]);
  var patchObj = {};
  Object.keys(patch || {}).forEach(function (header) {
    if (headerMap[header]) patchObj[header] = patch[header];
  });
  if (patchObj.Books_Push_At && headerMap.Books_Last_Push_At && !patchObj.Books_Last_Push_At) {
    patchObj.Books_Last_Push_At = patchObj.Books_Push_At;
  }
  if (Object.keys(patchObj).length) applyPatch_(sheet, rowNumber, patchObj);
  return patchObj;
}

function admin_createZohoBooksFodeDraftInvoice(payload) {
  return withEnvelope_("admin_createZohoBooksFodeDraftInvoice", function (dbgId) {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    if (!canWriteZohoBooksForAdmin_(adminEmail)) {
      return err_("ACCESS_DENIED", "SUPER admin or designated Zoho Books write admin required.", dbgId);
    }
    try {
      assertZohoBooksEnabledForWrite_();
    } catch (e) {
      var msg = String(e && e.message ? e.message : e);
      if (msg === "WRITE_DISABLED") return err_("WRITE_DISABLED", "Zoho Books live draft invoice creation is disabled.", dbgId);
      return err_("BOOKS_WRITE_CONFIG_ERROR", msg, dbgId);
    }
    var sh = openDataSheet_();
    var rowNumber = findZohoBooksApplicantRow_(sh, payload || {});
    if (!(rowNumber >= 2)) return err_("DETAIL_ROW_NOT_FOUND", "Could not locate applicant record.", dbgId);
    var ctx = buildZohoBooksRowObject_(sh, rowNumber);
    var row = ctx.rowObj;
    var lookupApplicantId = clean_(payload && payload.applicantId || "");
    var previewApplicantId = clean_(payload && payload.previewApplicantId || "");
    var effectiveApplicantId = clean_(row.ApplicantID || "");
    if (lookupApplicantId && effectiveApplicantId && lookupApplicantId !== effectiveApplicantId) {
      return err_("PREVIEW_APPLICANT_MISMATCH", "Create Draft Invoice must target the same applicant that was previewed.", dbgId);
    }
    if (previewApplicantId && effectiveApplicantId && previewApplicantId !== effectiveApplicantId) {
      return err_("PREVIEW_APPLICANT_MISMATCH", "Create Draft Invoice must target the same applicant that was previewed.", dbgId);
    }
    var payer = resolveFodePayerFromRecord_(row);
    var contactLookup = safeStr_(row.Books_Contact_ID || "")
      ? { ok: true, code: "LOCAL_CONTACT_ID", matches: [{ contact_id: safeStr_(row.Books_Contact_ID || ""), contact_name: safeStr_(row.Books_Contact_Name || "") }] }
      : zohoBooksFindContact_(payer);
    var invoiceLookup = safeStr_(row.Books_Invoice_ID || "")
      ? { ok: true, code: "LOCAL_INVOICE_ID", matches: [{ invoice_id: safeStr_(row.Books_Invoice_ID || ""), invoice_number: safeStr_(row.Books_Invoice_Number || "") }] }
      : zohoBooksFindInvoiceByFodeReference_(buildFodeBillingReference_(row));
    var tokenStatus = getZohoBooksTokenReadiness_();
    var itemsDiscovery = tokenStatus.ok === true ? zohoBooksDiscoverItems_() : tokenStatus;
    var preview = buildZohoBooksPreviewResult_(row, {
      contactLookup: contactLookup,
      invoiceLookup: invoiceLookup,
      itemsDiscovery: itemsDiscovery
    });
    if (preview.readinessStatus === "WRITE_DISABLED") {
      return err_("WRITE_DISABLED", "Zoho Books live draft invoice creation is disabled.", dbgId, {
        readinessStatus: preview.readinessStatus,
        idempotencyStatus: preview.idempotencyStatus
      });
    }
    if (preview.readinessStatus === "ALREADY_PUSHED" || safeStr_(row.Books_Invoice_ID || "")) {
      return err_("DRAFT_INVOICE_EXISTS", "A Zoho Books draft invoice already exists for this applicant.", dbgId, {
        invoiceId: safeStr_(row.Books_Invoice_ID || preview.currentBooksInvoiceId || ""),
        invoiceNumber: safeStr_(row.Books_Invoice_Number || preview.currentBooksInvoiceNumber || ""),
        invoiceStatus: safeStr_(row.Books_Invoice_Status || preview.currentBooksInvoiceStatus || "")
      });
    }
    if (preview.readinessStatus !== "READY" && preview.readinessStatus !== "READY_WITH_FALLBACK") {
      return err_(preview.readinessStatus || "NOT_READY", "Preview must be READY before draft invoice creation.", dbgId, {
        blockReason: preview.blockReason || "",
        missingFields: preview.missingFields || [],
        idempotencyStatus: preview.idempotencyStatus || ""
      });
    }
    if (!isZohoBooksTestApplicantAllowed_(row)) {
      return err_("WRITE_DISABLED", "Draft invoice creation is restricted to explicit Zoho Books test applicants.", dbgId);
    }
    var contactRes = zohoBooksCreateOrUpdateContact_(row, payer);
    if (!contactRes.ok) {
      var contactPatch = buildZohoBooksWritebackPatch_(row, preview, null, contactRes, adminEmail);
      applyZohoBooksWritebackPatch_(sh, rowNumber, contactPatch);
      return err_(safeStr_(contactRes.code || "CONTACT_CREATE_FAILED"), safeStr_(contactRes.message || "Zoho Books contact create/resolve failed."), dbgId, {
        readinessStatus: preview.readinessStatus,
        idempotencyStatus: preview.idempotencyStatus
      });
    }
    var invoiceRes = zohoBooksCreateDraftInvoice_(row, {
      contact_id: safeStr_(contactRes.contact_id || ""),
      contact_name: safeStr_(contactRes.contact_name || "")
    }, {
      liveItemsResult: itemsDiscovery && itemsDiscovery.ok === true ? itemsDiscovery : null
    });
    if (invoiceRes.ok && safeStr_(invoiceRes.code || "") === "ALREADY_PROCESSED") {
      return err_("DRAFT_INVOICE_EXISTS", "A Zoho Books draft invoice already exists for this applicant.", dbgId, {
        contactId: safeStr_(contactRes.contact_id || ""),
        contactName: safeStr_(contactRes.contact_name || ""),
        invoiceId: safeStr_(invoiceRes.invoice_id || ""),
        invoiceNumber: safeStr_(invoiceRes.invoice_number || ""),
        invoiceStatus: safeStr_(invoiceRes.invoice_status || "")
      });
    }
    if (!invoiceRes.ok) {
      var invoiceErrorPatch = buildZohoBooksWritebackPatch_(row, preview, contactRes, invoiceRes, adminEmail);
      applyZohoBooksWritebackPatch_(sh, rowNumber, invoiceErrorPatch);
      return err_(safeStr_(invoiceRes.code || "BOOKS_CREATE_FAILED"), safeStr_(invoiceRes.message || "Zoho Books draft invoice creation failed."), dbgId, {
        contactId: safeStr_(contactRes.contact_id || ""),
        contactName: safeStr_(contactRes.contact_name || "")
      });
    }
    var invoiceSuccessPatch = buildZohoBooksWritebackPatch_(row, preview, contactRes, invoiceRes, adminEmail);
    var appliedPatch = applyZohoBooksWritebackPatch_(sh, rowNumber, invoiceSuccessPatch);
    return ok_({
      status: "DRAFT_INVOICE_CREATED",
      message: "Zoho Books draft invoice created successfully.",
      readinessStatus: preview.readinessStatus,
      idempotencyStatus: "ALREADY_PUSHED",
      contactId: safeStr_(contactRes.contact_id || ""),
      contactName: safeStr_(contactRes.contact_name || ""),
      invoiceId: safeStr_(invoiceRes.invoice_id || ""),
      invoiceNumber: safeStr_(invoiceRes.invoice_number || ""),
      invoiceStatus: safeStr_(invoiceRes.invoice_status || "draft"),
      writeBackApplied: appliedPatch,
      sourceApplicantId: effectiveApplicantId
    }, dbgId);
  });
}

function admin_sendZohoBooksTestInvoiceEmail(payload) {
  return withEnvelope_("admin_sendZohoBooksTestInvoiceEmail", function (dbgId) {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    if (!canWriteZohoBooksForAdmin_(adminEmail)) {
      return err_("ACCESS_DENIED", "SUPER admin or designated Zoho Books write admin required.", dbgId);
    }
    var cfg = getZohoBooksConfig_();
    if (cfg.enabled !== true || cfg.testInvoiceEmailSendEnabled !== true) {
      return err_("WRITE_DISABLED", "Controlled Zoho Books test invoice email send is disabled.", dbgId);
    }
    var sh = openDataSheet_();
    var rowNumber = findZohoBooksApplicantRow_(sh, payload || {});
    if (!(rowNumber >= 2)) return err_("DETAIL_ROW_NOT_FOUND", "Could not locate applicant record.", dbgId);
    var ctx = buildZohoBooksRowObject_(sh, rowNumber);
    var row = ctx.rowObj;
    var lookupApplicantId = clean_(payload && payload.applicantId || "");
    var previewApplicantId = clean_(payload && payload.previewApplicantId || "");
    var effectiveApplicantId = clean_(row.ApplicantID || "");
    if (lookupApplicantId && effectiveApplicantId && lookupApplicantId !== effectiveApplicantId) {
      return err_("PREVIEW_APPLICANT_MISMATCH", "Test invoice email send must target the same applicant that was previewed.", dbgId);
    }
    if (previewApplicantId && effectiveApplicantId && previewApplicantId !== effectiveApplicantId) {
      return err_("PREVIEW_APPLICANT_MISMATCH", "Test invoice email send must target the same applicant that was previewed.", dbgId);
    }
    if (!isZohoBooksTestApplicantAllowed_(row)) {
      return err_("WRITE_DISABLED", "Test invoice email send is restricted to explicit Zoho Books test applicants.", dbgId);
    }
    var invoiceId = safeStr_(row.Books_Invoice_ID || "");
    if (!invoiceId) {
      return err_("DRAFT_INVOICE_REQUIRED", "A Zoho Books draft invoice must exist before test email send.", dbgId);
    }
    var sendRes = zohoBooksSendTestInvoiceEmail_(invoiceId, row, {});
    if (!sendRes.ok) {
      return err_(safeStr_(sendRes.code || "TEST_EMAIL_SEND_FAILED"), safeStr_(sendRes.message || "Controlled test invoice email send failed."), dbgId, {
        invoiceId: invoiceId,
        recipient: safeStr_(cfg.testEmailRecipient || "")
      });
    }
    return ok_({
      status: "TEST_INVOICE_EMAIL_SENT",
      message: "Controlled Zoho Books test invoice email sent successfully.",
      invoiceId: invoiceId,
      invoiceNumber: safeStr_(row.Books_Invoice_Number || ""),
      invoiceStatus: safeStr_(row.Books_Invoice_Status || ""),
      recipient: safeStr_(sendRes.recipient || cfg.testEmailRecipient || ""),
      sourceApplicantId: effectiveApplicantId
    }, dbgId);
  });
}

/**
 * Alias maintained for UI: "Generate Portal Link"
 */
function admin_generatePortalLink(payload) {
  return admin_getPortalLink(payload);
}

function admin_resetPortalSecret(payload) {
  return admin_resetPortalLink(payload);
}

function admin_getPortalLink(payload) {
  payload = payload || {};
  var debugId = clean_(payload.debugId || "") || adminDebugId_();
  var applicantIdForLog = clean_(payload.applicantId || payload.id || "");
  var callerEmail = "";
  try { callerEmail = String(Session.getActiveUser().getEmail() || ""); } catch (_callerErr) {}
  Logger.log("PORTAL_LINK_START " + JSON.stringify({
    debugId: debugId,
    applicantId: applicantIdForLog,
    caller: callerEmail
  }));
  try {
    var adminEmail = getActiveUserEmail_();
    if (!isAdmin_(adminEmail)) return { ok: false, code: "PORTAL_LINK_ERROR", debugId: debugId, message: "Link generation failed" };
    var rowNumber = Number(payload.rowNumber || 0);
    if (!rowNumber || rowNumber < 2) return { ok: false, code: "PORTAL_LINK_ERROR", debugId: debugId, message: "Link generation failed" };

    var sh = openDataSheet_();
    ensureHeadersExist_(sh, ["ApplicantID"]);
    var rowObj = getRowObject_(sh, rowNumber);
    var applicantId = clean_(rowObj.ApplicantID || "");
    if (!applicantId) return { ok: false, code: "PORTAL_LINK_ERROR", debugId: debugId, message: "Link generation failed" };

    var secretRes = getPortalSecretForApplicant_(applicantId);
    if (!secretRes || secretRes.ok !== true) return { ok: false, code: "PORTAL_LINK_ERROR", debugId: debugId, message: "Link generation failed" };
    var portalUrl = buildStudentPortalUrl_(applicantId, secretRes.secret);
    logAdminEvent_("PORTAL_URL_GENERATED", {
      operatorEmail: adminEmail || "",
      applicantId: applicantId,
      rowNumber: rowNumber,
      debugId: debugId
    });
    return {
      ok: true,
      link: portalUrl,
      portalUrl: portalUrl,
      applicantId: applicantId,
      debugId: debugId
    };
  } catch (e) {
    Logger.log("PORTAL_LINK_THROW " + JSON.stringify({
      debugId: debugId,
      message: String(e),
      stack: String((e && e.stack) || "")
    }));
    return { ok: false, code: "PORTAL_LINK_ERROR", debugId: debugId, message: "Link generation failed" };
  }
}

/**
 * Resets the portal secret using the shared PortalSecrets helper layer.
 * Existing schema only: no columns are created here.
 */
function admin_resetPortalLink(payload) {
  payload = payload || {};
  var debugId = clean_(payload.debugId || "") || adminDebugId_();
  var applicantIdForLog = clean_(payload.applicantId || payload.id || "");
  var callerEmail = "";
  try { callerEmail = String(Session.getActiveUser().getEmail() || ""); } catch (_callerErr) {}
  Logger.log("PORTAL_RESET_START " + JSON.stringify({
    debugId: debugId,
    applicantId: applicantIdForLog,
    caller: callerEmail
  }));
  try {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) return { ok: false, code: "PORTAL_RESET_ERROR", debugId: debugId, message: "Link generation failed" };
    try { requireSuperAdmin_(adminEmail); } catch (_superErr) {
      return { ok: false, code: "ACCESS_DENIED", debugId: debugId, message: "Access denied: SUPER admin required" };
    }
    var rowNumber = Number(payload.rowNumber || 0);
    if (!rowNumber || rowNumber < 2) return { ok: false, code: "PORTAL_RESET_ERROR", debugId: debugId, message: "Link generation failed" };

    var sh = openDataSheet_();
    ensureHeadersExist_(sh, ["ApplicantID"]);
    var rowObj = getRowObject_(sh, rowNumber);
    var applicantId = clean_(rowObj.ApplicantID || "");
    if (!applicantId) return { ok: false, code: "PORTAL_RESET_ERROR", debugId: debugId, message: "Link generation failed" };

    var fullName = (clean_(rowObj.First_Name || "") + " " + clean_(rowObj.Last_Name || "")).trim();
    var email = clean_(rowObj.Parent_Email_Corrected || rowObj.Parent_Email || "");
    var setRes = resetPortalSecretForApplicant_(applicantId, {
      email: email,
      fullName: fullName,
      admissionsSheet: sh,
      rowNumber: rowNumber
    });
    if (!setRes || setRes.ok !== true || !clean_(setRes.secretPlain || setRes.secret || "")) return { ok: false, code: "PORTAL_RESET_ERROR", debugId: debugId, message: "Link generation failed" };

    var portalUrl = buildStudentPortalUrl_(applicantId, clean_(setRes.secretPlain || setRes.secret || ""));
    logAdminEvent_("PORTAL_URL_RESET", {
      operatorEmail: adminEmail || "",
      applicantId: applicantId,
      rowNumber: rowNumber,
      debugId: debugId
    });
    logAdminEvent_("PORTAL_URL_GENERATED", {
      operatorEmail: adminEmail || "",
      applicantId: applicantId,
      rowNumber: rowNumber,
      debugId: debugId
    });
    return {
      ok: true,
      link: portalUrl,
      portalUrl: portalUrl,
      debugId: debugId
    };
  } catch (e) {
    Logger.log("PORTAL_RESET_THROW " + JSON.stringify({
      debugId: debugId,
      message: String(e),
      stack: String((e && e.stack) || "")
    }));
    return { ok: false, code: "PORTAL_RESET_ERROR", debugId: debugId, message: "Link generation failed" };
  }

}

// Review/status authority RPCs live in Admin_ReviewStatusAuthority.js.

function admin_setOverallStatus(payload) {
  var adminEmail = getCallerEmail_();
  if (!isAdmin_(adminEmail)) throw new Error("Access denied");
  requireSuperAdmin_(adminEmail);

  payload = payload || {};
  var rowNumber = Number(payload.rowNumber || 0);
  var requested = clean_(payload.action || "");
  var reason = clean_(payload.reason || "");
  if (!rowNumber || rowNumber < 2) throw new Error("Invalid rowNumber");
  if (["Pending", "Docs_Verified", "Verified", "Rejected", "Fraudulent"].indexOf(requested) === -1) throw new Error("Invalid action");
  if ((requested === "Rejected" || requested === "Fraudulent") && !reason) throw new Error("Reason required");

  var sh = openDataSheet_();
  var idx = headerIndex_(sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]);
  requireHeaders_(idx, ["Doc_Verification_Status", "Portal_Access_Status", "Doc_Last_Verified_At", "Doc_Last_Verified_By"]);
  var cols = resolveStatusCols_(idx);
  var rowObj = getRowObject_(sh, rowNumber);
  var docStage = computeDocVerificationStatus_(rowObj);
  var paymentBadge = canonicalPaymentBadge_(rowObj);
  var paymentVerified = isCanonicalPaymentVerified_(rowObj);
  var computed = computeOverallStatus_(rowObj);
  var canOverride = canOverrideOverall_(adminEmail);
  var finalStatus = canOverride ? requested : computed;

  if (canOverride && requested !== computed) {
    logAudit_("OVERRIDE_OVERALL", {
      user: adminEmail,
      rowNumber: rowNumber,
      computed: computed,
      forced: requested
    });
  }

  var patch = {};
  if (cols.paymentCompat) patch[cols.paymentCompat] = paymentVerified ? "Yes" : "";
  if (cols.docStage) patch[cols.docStage] = docStage;
  if (cols.overall) patch[cols.overall] = finalStatus;
  if (finalStatus === "Fraudulent") {
    patch[SCHEMA.PORTAL_ACCESS_STATUS] = "Locked";
  }
  patch[SCHEMA.DOC_LAST_VERIFIED_AT] = new Date();
  patch[SCHEMA.DOC_LAST_VERIFIED_BY] = adminEmail || "admin";
  applyPatch_(sh, rowNumber, patch);
  captureOperatorAttribution_(sh, rowNumber, idx, {
    action: "OVERALL_STATUS",
    operatorEmail: adminEmail,
    rowObj: rowObj
  });

  log_(openLogSheet_(), "ADMIN_OVERALL_STATUS", "row=" + rowNumber + " action=" + finalStatus + " requested=" + requested + " by=" + (adminEmail || "admin") + " reason=" + (reason || "-"));
  return {
    ok: true,
    overallStatus: finalStatus,
    overallStatusComputed: computed,
    overallComputed: computed,
    overallStored: finalStatus,
    docVerificationStatusComputed: docStage,
    paymentBadge: paymentBadge,
    computed: computed,
    overridden: !!(canOverride && requested !== computed),
    overallIsOverridden: !!(canOverride && requested !== computed),
    isOverridden: !!(canOverride && requested !== computed),
    overallOverrideValue: !!(canOverride && requested !== computed) ? finalStatus : "",
    paymentVerified: paymentVerified ? "Yes" : ""
  };
}

function admin_setPortalAccess(payload) {
  var adminEmail = getCallerEmail_();
  if (!isAdmin_(adminEmail)) throw new Error("Access denied");
  requireSuperAdmin_(adminEmail);

  payload = payload || {};
  var rowNumber = Number(payload.rowNumber || 0);
  var status = clean_(payload.status || "");
  if (!rowNumber || rowNumber < 2) throw new Error("Invalid rowNumber");
  if (status !== "Open" && status !== "Locked") throw new Error("Invalid status");

  var sh = openDataSheet_();
  var idx = headerIndex_(sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]);
  requireHeaders_(idx, ["Portal_Access_Status", "Doc_Last_Verified_At", "Doc_Last_Verified_By"]);
  var rowObj = getRowObject_(sh, rowNumber);
  var paymentBadge = canonicalPaymentBadge_(rowObj);
  if (status === "Open" && paymentBadge === "Verified") {
    throw new Error("Cannot unlock after payment verification.");
  }

  setCell_(sh, rowNumber, idx, "Portal_Access_Status", status);
  setCell_(sh, rowNumber, idx, "Doc_Last_Verified_At", new Date());
  setCell_(sh, rowNumber, idx, "Doc_Last_Verified_By", adminEmail || "admin");
  captureOperatorAttribution_(sh, rowNumber, idx, {
    action: "PORTAL_ACCESS",
    operatorEmail: adminEmail,
    rowObj: rowObj
  });

  log_(openLogSheet_(), "ADMIN_PORTAL_ACCESS", "row=" + rowNumber + " status=" + status + " by=" + (adminEmail || "admin"));
  var refreshed = getRowObject_(sh, rowNumber);
  var applicantId = clean_(refreshed.ApplicantID || "");
  var detailRes = applicantId ? admin_getApplicantDetail({ rowNumber: rowNumber, applicantId: applicantId }) : null;
  return {
    ok: true,
    paymentBadge: canonicalPaymentBadge_(refreshed),
    portalAccessStatus: clean_(refreshed.Portal_Access_Status || status),
    detail: (detailRes && detailRes.ok === true) ? detailRes.detail : null
  };
}

// Payment authority RPCs live in Admin_PaymentAuthority.js.

function triggerCrmDealForFode_(rowObj, rowNumber, sh, idx) {
  var quarantine = assertCrmLegacyQuarantined_({
    action: "trigger_crm_deal_for_fode",
    sourceFunction: "triggerCrmDealForFode_",
    applicantId: clean_((rowObj || {}).ApplicantID || ""),
    formId: clean_((rowObj || {}).FormID || (rowObj || {}).FD_FormID || ""),
    rowNumber: Number(rowNumber || 0),
    operationType: "crm_deal_trigger"
  });
  logOperationalBlock_("STABILIZATION_CRM_WRITE_BLOCK", {
    action: "trigger_crm_deal_for_fode",
    rowNumber: Number(rowNumber || 0),
    applicantId: clean_((rowObj || {}).ApplicantID || "")
  });
  logAdminEvent_("STABILIZATION_CRM_WRITE_BLOCK", {
    action: "trigger_crm_deal_for_fode",
    rowNumber: Number(rowNumber || 0),
    applicantId: clean_((rowObj || {}).ApplicantID || "")
  });
  var row = rowObj || {};
  return {
    attempted: false,
    ok: true,
    enabled: false,
    blocked: true,
    reason: quarantine && quarantine.code ? quarantine.code : "STABILIZATION_DISABLED",
    shouldCreateDeal: false,
    rowNumber: Number(rowNumber || 0)
  };
}

function syncFodeCrmStage_(rowObj, rowNumber, sh, idx) {
  var quarantine = assertCrmLegacyQuarantined_({
    action: "sync_fode_crm_stage",
    sourceFunction: "syncFodeCrmStage_",
    applicantId: clean_((rowObj || {}).ApplicantID || ""),
    formId: clean_((rowObj || {}).FormID || (rowObj || {}).FD_FormID || ""),
    rowNumber: Number(rowNumber || 0),
    operationType: "crm_stage_sync"
  });
  logOperationalBlock_("STABILIZATION_CRM_WRITE_BLOCK", {
    action: "sync_fode_crm_stage",
    rowNumber: Number(rowNumber || 0),
    applicantId: clean_((rowObj || {}).ApplicantID || "")
  });
  logAdminEvent_("STABILIZATION_CRM_WRITE_BLOCK", {
    action: "sync_fode_crm_stage",
    rowNumber: Number(rowNumber || 0),
    applicantId: clean_((rowObj || {}).ApplicantID || "")
  });
  var row = rowObj || {};
  return {
    attempted: false,
    ok: true,
    enabled: false,
    blocked: true,
    reason: quarantine && quarantine.code ? quarantine.code : "STABILIZATION_DISABLED",
    crmStage: "",
    shouldCreateInvoice: false,
    rowNumber: Number(rowNumber || 0)
  };
}

function crm_syncOnPaymentVerified_(rowNumber, sh, idx) {
  var rowObj = {};
  try {
    var sheet = sh || openDataSheet_();
    if (sheet) rowObj = getRowObject_(sheet, rowNumber) || {};
  } catch (_sheetErr) {}
  var applicantId = clean_(rowObj.ApplicantID || "");
  var quarantine = assertCrmLegacyQuarantined_({
    action: "crm_sync_on_payment_verified",
    sourceFunction: "crm_syncOnPaymentVerified_",
    applicantId: applicantId,
    formId: clean_(rowObj.FormID || rowObj.FD_FormID || ""),
    rowNumber: Number(rowNumber || 0),
    operationType: "crm_payment_verified_sync"
  });
  logOperationalBlock_("STABILIZATION_CRM_WRITE_BLOCK", {
    action: "crm_sync_on_payment_verified",
    rowNumber: Number(rowNumber || 0),
    applicantId: applicantId
  });
  logAdminEvent_("STABILIZATION_CRM_WRITE_BLOCK", {
    action: "crm_sync_on_payment_verified",
    rowNumber: Number(rowNumber || 0),
    applicantId: applicantId
  });
  return {
    attempted: false,
    ok: true,
    blocked: true,
    reason: quarantine && quarantine.code ? quarantine.code : "STABILIZATION_DISABLED",
    debugId: newDebugId_(),
    applicantId: applicantId
  };
}

/******************** ADMIN HELPERS ********************/

function openDataSheet_() {
  return getWorkingSheet_();
}

function openLogSheet_() {
  var ss = getWorkingSpreadsheet_();
  return mustGetSheet_(ss, CONFIG.LOG_SHEET);
}

function logAudit_(label, payload) {
  log_(openLogSheet_(), clean_(label || "AUDIT"), JSON.stringify(payload || {}));
}

function patchIfHeadersPresent_(sh, rowNumber, idx, patchObj) {
  var patch = {};
  var src = patchObj || {};
  for (var k in src) {
    if (!Object.prototype.hasOwnProperty.call(src, k)) continue;
    if (idx && idx[k]) patch[k] = src[k];
  }
  if (!Object.keys(patch).length) return false;
  applyPatch_(sh, rowNumber, patch);
  return true;
}

function joinEmails_(arr) {
  var list = Array.isArray(arr) ? arr : [];
  return list.map(function(v){ return safeStr_(v); }).filter(function(v){ return !!v; }).join(",");
}

function rowStudentName_(row) {
  var r = row || {};
  return (safeStr_(r.First_Name || "") + " " + safeStr_(r.Last_Name || "")).trim();
}

function rowProgramSummary_(row) {
  var r = row || {};
  return safeStr_(r.Program || r.Program_Applied_For || r.Intake || r.Intake_Name || "");
}

function rowSubjectsSummary_(row) {
  var r = row || {};
  return safeStr_(r.Subjects_Selected_Canonical || r.Subjects_Selected || "");
}

function sendQuoteEmail_(rowObj, debugId) {
  var row = rowObj || {};
  var to = pickParentEmail_(row);
  if (!to) {
    logAdminEvent_("QUOTE_EMAIL_MISSING_RECIPIENT", { applicantId: safeStr_(row.ApplicantID), debugId: debugId });
    return { ok: true, status: "skipped", reason: "missing_recipient" };
  }
  var applicantId = safeStr_(row.ApplicantID);
  var studentName = rowStudentName_(row) || "Student";
  var program = rowProgramSummary_(row) || "(program pending)";
  var subjects = rowSubjectsSummary_(row) || "(subjects not listed)";
  var subject = "FODE Application Docs Verified - Next Steps (" + applicantId + ")";
  var body = [
    "Dear Parent/Guardian,",
    "",
    "Your student's FODE application documents have been verified.",
    "",
    "Student: " + studentName,
    "Applicant ID: " + applicantId,
    "Program/Intake: " + program,
    "Subjects: " + subjects,
    "",
    "Next steps:",
    "1. Please proceed with payment.",
    "2. Upload the payment receipt in the student portal.",
    "3. Wait for payment verification and enrollment processing.",
    "",
    "Payment instructions:",
    safeStr_(CONFIG.PAYMENT_INSTRUCTIONS_TEXT || "Please contact the office for payment instructions."),
    "",
    "Support: WhatsApp +675 7860 4013 | Email: mlc@minervacenters.com",
    "",
    "Regards,",
    "Minerva Learning Centers Ltd"
  ].join("\n");
  var cc = safeStr_(CONFIG.EMAIL_ADMIN_ALERTS_TO || "");
  var sent = adminSendEmail_(to, subject, body, {
    cc: cc,
    templateType: "docs_verified_quote_email",
    sendSource: "DOCS_VERIFIED_WORKFLOW",
    unattended: true,
    applicantId: applicantId,
    rowObj: row,
    debugId: debugId,
    action: "docs_verified_quote_email"
  });
  if (!sent.ok) {
    logAdminEvent_("QUOTE_EMAIL_FAILED", {
      applicantId: applicantId,
      to: to,
      cc: cc,
      from: safeStr_(sent.from || CONFIG.EMAIL_FROM_ADDRESS || ""),
      replyTo: safeStr_(sent.replyTo || CONFIG.EMAIL_REPLY_TO || ""),
      debugId: debugId,
      error: safeStr_(sent.error || "Quote email failed")
    });
    return { ok: false, status: "failed", code: "EMAIL_SEND_FAILED", message: safeStr_(sent.error || "Quote email failed") };
  }
  logAdminEvent_("QUOTE_EMAIL_SENT", {
    applicantId: applicantId,
    to: to,
    cc: safeStr_(sent.cc || cc),
    from: safeStr_(sent.from || CONFIG.EMAIL_FROM_ADDRESS || ""),
    replyTo: safeStr_(sent.replyTo || CONFIG.EMAIL_REPLY_TO || ""),
    debugId: debugId
  });
  return { ok: true, status: "sent" };
}

function sendPaymentEmail_(rowObj, debugId) {
  var row = rowObj || {};
  var to = pickParentEmail_(row);
  if (!to) {
    logAdminEvent_("PAYMENT_EMAIL_MISSING_RECIPIENT", { applicantId: safeStr_(row.ApplicantID), debugId: debugId });
    return { ok: true, status: "skipped", reason: "missing_recipient" };
  }
  var applicantId = safeStr_(row.ApplicantID);
  var studentName = rowStudentName_(row) || "Student";
  var subject = "FODE Payment Verified - Enrollment Processing (" + applicantId + ")";
  var body = [
    "Dear Parent/Guardian,",
    "",
    "We confirm that payment for the FODE application has been verified.",
    "",
    "Student: " + studentName,
    "Applicant ID: " + applicantId,
    "",
    "Next steps:",
    "Your enrollment and study access will now be processed. We will contact you shortly with the next instructions.",
    "",
    "Support: WhatsApp +675 7860 4013 | Email: mlc@minervacenters.com",
    "",
    "Regards,",
    "Minerva Learning Centers Ltd"
  ].join("\n");
  var cc = joinEmails_(CONFIG.INTERNAL_FINANCE_EMAILS || []);
  var sent = adminSendEmail_(to, subject, body, {
    cc: cc,
    templateType: "payment_verified_notice",
    sendSource: "INVOICE_TRIGGER_PAYMENT_NOTICE",
    unattended: true,
    applicantId: applicantId,
    rowObj: row,
    debugId: debugId,
    action: "invoice_trigger_payment_notice_email"
  });
  if (!sent.ok) return { ok: false, status: "failed", code: "EMAIL_SEND_FAILED", message: safeStr_(sent.error || "Payment email failed") };
  logAdminEvent_("PAYMENT_CONFIRM_EMAIL_SENT", { applicantId: applicantId, to: to, cc: cc, debugId: debugId });
  return { ok: true, status: "sent" };
}

function triggerInvoiceWebhook_(rowObj, debugId) {
  var row = rowObj || {};
  if (CONFIG.ENABLE_INVOICE_WEBHOOK_HANDOFF !== true) {
    var blockPayload = {
      applicantId: safeStr_(row.ApplicantID || ""),
      formId: safeStr_(row.FormID || row.FD_FormID || ""),
      debugId: safeStr_(debugId || ""),
      destinationHost: redactUrlForLog_(safeStr_(CONFIG.INVOICE_WEBHOOK_URL || ""))
    };
    logOperationalBlock_("INVOICE_WEBHOOK_QUARANTINE_BLOCK", blockPayload);
    logAdminEvent_("INVOICE_WEBHOOK_QUARANTINE_BLOCK", blockPayload);
    return {
      ok: false,
      code: "INVOICE_WEBHOOK_QUARANTINED",
      message: "Invoice webhook handoff is quarantined during stabilization."
    };
  }
  var mode = safeStr_(CONFIG.INVOICE_TRIGGER_MODE || "LOG_ONLY") || "LOG_ONLY";
  if (mode === "LOG_ONLY") {
    logAdminEvent_("INVOICE_TRIGGER_LOG_ONLY", { applicantId: safeStr_(row.ApplicantID), debugId: debugId });
    return { ok: true, mode: mode, httpStatus: 0 };
  }
  if (mode !== "WEBHOOK") {
    return { ok: false, code: "INVOICE_TRIGGER_MODE_INVALID", message: "Invalid invoice trigger mode: " + mode };
  }
  var url = safeStr_(CONFIG.INVOICE_WEBHOOK_URL || "");
  if (!url) return { ok: false, code: "INVOICE_WEBHOOK_URL_MISSING", message: "Invoice webhook URL is not configured" };
  var tracePayload = {
    sourceFunction: "triggerInvoiceWebhook_",
    configKeyName: "INVOICE_WEBHOOK_URL",
    destinationHost: redactUrlForLog_(url),
    applicantId: safeStr_(row.ApplicantID || ""),
    formId: safeStr_(row.FormID || row.FD_FormID || ""),
    operationType: "invoice_webhook",
    timestamp: new Date().toISOString()
  };
  logS4aOutboundTrace_("S4A_OUTBOUND_TRACE", tracePayload);
  logS4aOutboundTrace_("S4A_INVOICE_WEBHOOK_TRACE", tracePayload);
  logS4aOutboundTrace_("S4A_CRM_SUSPECT_PATH", tracePayload);
  var payload = {
    applicantId: safeStr_(row.ApplicantID),
    firstName: safeStr_(row.First_Name),
    lastName: safeStr_(row.Last_Name),
    name: rowStudentName_(row),
    email: pickParentEmail_(row),
    program: rowProgramSummary_(row),
    subjects: rowSubjectsSummary_(row),
    amountK: safeStr_(row.Fee_Total_Kina || row.Total_Fee_Kina || row.Total_Fee || ""),
    debugId: String(debugId || "")
  };
  var res = UrlFetchApp.fetch(url, {
    method: "post",
    contentType: "application/json",
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });
  var code = Number(res && res.getResponseCode ? res.getResponseCode() : 0);
  if (code >= 200 && code < 300) return { ok: true, mode: mode, httpStatus: code };
  return { ok: false, code: "INVOICE_WEBHOOK_HTTP_" + String(code || 0), message: "Invoice webhook failed with HTTP " + String(code || 0), httpStatus: code };
}

function getDocsFollowupSentAt_(rowObj) {
  var row = rowObj || {};
  var applicantId = clean_(row.ApplicantID || row.applicantId || "");
  var key = buildDocsFollowupKey_(CONFIG.DATA_MODE, applicantId);
  try {
    return safeStr_(PropertiesService.getScriptProperties().getProperty(key) || "");
  } catch (_e) {
    return "";
  }
}

function admin_sendDocsFollowupEmails(payload) {
  return withEnvelope_("admin_sendDocsFollowupEmails", function(dbgId) {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) return err_("ACCESS_DENIED", "Access denied", dbgId);
    requireSuperAdmin_(adminEmail);
    payload = payload || {};
    var rowNumbers = Array.isArray(payload.rowNumbers) ? payload.rowNumbers : [];
    var normalized = [];
    var seen = {};
    for (var i = 0; i < rowNumbers.length; i++) {
      var n = Number(rowNumbers[i] || 0);
      if (!Number.isFinite(n) || n < 2) continue;
      n = Math.floor(n);
      if (seen[n]) continue;
      seen[n] = true;
      normalized.push(n);
    }
    if (!normalized.length) {
      return err_("VALIDATION", "rowNumbers is required.", dbgId);
    }

    var sh = getWorkingSheet_();
    var results = normalized.map(function(rowNumber) {
      var rowObj = getRowObject_(sh, rowNumber);
      rowObj._rowNumber = rowNumber;
      var applicantId = safeStr_(rowObj.ApplicantID || ("ROW-" + rowNumber));
      var authority = compatibilityCommunicationAuthorityProjection_(rowObj, rowNumber);
      return {
        ok: false,
        code: "LEGACY_DOCS_FOLLOWUP_RETIRED",
        message: "Legacy Docs Follow-Up send has been retired. Use Review Workspace for one applicant or Batch Communication for a selected authoritative cohort.",
        applicantId: applicantId,
        ApplicantID: applicantId,
        rowNumber: rowNumber,
        recommendedMessageType: clean_(authority && authority.recommendedMessageType || ""),
        selectable: !!(authority && authority.selectable === true),
        selectBlockReason: clean_(authority && authority.selectBlockReason || "")
      };
    });

    return ok_({
      summary: { sentCount: 0, failedCount: results.length },
      retiredLegacyRoute: true,
      message: "Legacy Docs Follow-Up send has been retired. Use Review Workspace or Batch Communication.",
      results: results,
      dbg: dbgId
    }, dbgId);
  });
}

function admin_updateParentEmailCorrected(payload) {
  return withEnvelope_("admin_updateParentEmailCorrected", function (dbgId) {
    var operatorEmail = getCallerEmail_();
    if (!isAdmin_(operatorEmail)) return err_("ACCESS_DENIED", "Access denied", dbgId);
    requireOperationsAdmin_(operatorEmail);
    if (!(CONFIG && CONFIG.SUPERADMIN_ALLOW_EMAIL_OVERRIDE_POST_DOCS_VERIFIED === true)) {
      return err_("FEATURE_DISABLED", "Email override is disabled by config.", dbgId);
    }

    payload = payload || {};
    var rowNumber = Number(payload.rowNumber || 0);
    var applicantIdInput = clean_(payload.applicantId || "");
    var newEmail = clean_(payload.newEmail || "").toLowerCase();
    var reason = clean_(payload.reason || "");
    if (!rowNumber || rowNumber < 2) return err_("VALIDATION", "rowNumber is required.", dbgId);
    if (!applicantIdInput) return err_("VALIDATION", "applicantId is required.", dbgId);
    if (!newEmail) return err_("VALIDATION", "newEmail is required.", dbgId);
    if (!reason) return err_("VALIDATION", "reason is required.", dbgId);
    var emailOk = false;
    if (typeof isValidEmail_ === "function") emailOk = !!isValidEmail_(newEmail);
    else emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail);
    if (!emailOk) return err_("VALIDATION", "Invalid email format.", dbgId);

    var sh = openDataSheet_();
    var idx = headerIndex_(sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]);
    requireHeaders_(idx, ["ApplicantID", "Parent_Email", "Parent_Email_Corrected", "Docs_Verified", "Payment_Verified"]);
    var rowObj = getRowObject_(sh, rowNumber);
    var applicantId = clean_(rowObj.ApplicantID || "");
    if (!applicantId) return err_("ROW_NOT_FOUND", "Applicant row not found.", dbgId);
    if (applicantId !== applicantIdInput) {
      return err_("VALIDATION", "ApplicantID mismatch for row.", dbgId);
    }

    var beforeEmail = clean_(rowObj.Parent_Email_Corrected || rowObj.Parent_Email || "");
    var beforeDocsVerified = clean_(rowObj.Docs_Verified || "");
    var beforePaymentVerified = clean_(rowObj.Payment_Verified || "");
    applyPatch_(sh, rowNumber, { Parent_Email_Corrected: newEmail });

    var deletedKey = deleteDocsFollowupKey_(CONFIG.DATA_MODE, applicantId);
    logAdminEvent_("EMAIL_OVERRIDE_SUPERADMIN", {
      operatorEmail: operatorEmail || "",
      applicantId: applicantId,
      rowNumber: rowNumber,
      beforeEmail: beforeEmail,
      afterEmail: newEmail,
      beforeDocsVerified: beforeDocsVerified,
      beforePaymentVerified: beforePaymentVerified,
      reason: reason,
      debugId: dbgId
    });
    logAdminEvent_("DOCS_FOLLOWUP_RESET_EMAIL_OVERRIDE", {
      operatorEmail: operatorEmail || "",
      applicantId: applicantId,
      rowNumber: rowNumber,
      key: deletedKey,
      debugId: dbgId
    });

    return ok_({
      applicantId: applicantId,
      newEmail: newEmail,
      docsFollowupReset: true,
      dbg: dbgId
    }, dbgId);
  });
}

function countSubjectsFromRow_(rowObj) {
  var row = rowObj || {};
  var csv = safeStr_(row.Subjects_Selected_Canonical || row.Subjects_Selected || "");
  if (!csv) return 0;
  return csv.split(",").map(function(v){ return safeStr_(v); }).filter(function(v){ return !!v; }).length;
}

function buildPaymentVerifiedEmailOptions_() {
  var opts = {};
  var senderMode = safeStr_(CONFIG.EMAIL_SENDER_MODE || "DEFAULT").toUpperCase();
  if (senderMode === "ALIAS" && safeStr_(CONFIG.EMAIL_FROM_ADDRESS || "")) {
    opts.from = safeStr_(CONFIG.EMAIL_FROM_ADDRESS || "");
  }
  if (safeStr_(CONFIG.EMAIL_REPLY_TO || "")) opts.replyTo = safeStr_(CONFIG.EMAIL_REPLY_TO || "");
  return opts;
}

function sendPaymentVerifiedStudentQuoteEmail_(rowObj, debugId) {
  var row = rowObj || {};
  var to = getRowEmailForStudent_(row);
  if (!to) {
    logAdminEvent_("EMAIL_STUDENT_SKIPPED_NO_EMAIL", {
      applicantId: safeStr_(row.ApplicantID || ""),
      debugId: debugId
    });
    return { ok: true, status: "skipped", warning: "Student/parent email missing or invalid" };
  }
  var applicantId = safeStr_(row.ApplicantID || "");
  var studentName = rowStudentName_(row) || "Student";
  var subjectCount = countSubjectsFromRow_(row);
  var baseK = Number(CONFIG.FODE_FEE_BASE_K || 600);
  var perSubjectK = Number(CONFIG.FODE_FEE_PER_SUBJECT_K || 450);
  var totalK = baseK + (perSubjectK * subjectCount);
  var subject = safeStr_(CONFIG.EMAIL_STUDENT_SUBJECT_PAYMENT_VERIFIED || "FODE Application - Payment Verified | Next Steps & Bank Details");
  var body = [
    "Dear Parent/Guardian,",
    "",
    "Payment for the FODE application has been verified.",
    "",
    "Student: " + studentName,
    "Applicant ID: " + applicantId,
    "Subjects: " + safeStr_(row.Subjects_Selected_Canonical || row.Subjects_Selected || "(not listed)"),
    "",
    "Fee summary:",
    "- Base fee: K" + String(baseK),
    "- Per subject: K" + String(perSubjectK),
    "- Subject count: " + String(subjectCount),
    "- Estimated total: K" + String(totalK),
    "",
    String(CONFIG.FODE_BANK_DETAILS_TEXT || ""),
    "",
    String(CONFIG.FODE_NEXT_STEPS_TEXT || ""),
    "",
    "For assistance, please reply to " + safeStr_(CONFIG.EMAIL_REPLY_TO || "fode@kundu.ac") + ".",
    "",
    "Regards,",
    "FODE Admissions"
  ].join("\n");
  var sendOpts = buildPaymentVerifiedEmailOptions_();
  var sent = adminSendEmail_(to, subject, body, sendOpts);
  if (!sent.ok) {
    return { ok: false, code: "EMAIL_SEND_FAILED", message: safeStr_(sent.error || "Failed to send student payment verified email") };
  }
  return { ok: true, status: "sent", to: to };
}

function sendPaymentVerifiedAdminReleaseEmail_(rowObj, debugId) {
  var row = rowObj || {};
  var adminTo = parseCsvEmails_(CONFIG.EMAIL_RELEASE_ADMIN_TO || "");
  if (!adminTo) {
    return { ok: false, code: "EMAIL_CONFIG_MISSING", message: "EMAIL_RELEASE_ADMIN_TO is empty or invalid" };
  }
  var applicantId = safeStr_(row.ApplicantID || "");
  var subjectTpl = safeStr_(CONFIG.EMAIL_ADMIN_SUBJECT_PAYMENT_VERIFIED || "FODE - Payment Verified | Release Access for ApplicantID");
  var subject = subjectTpl.indexOf("ApplicantID") >= 0 ? subjectTpl.replace("ApplicantID", applicantId || "UNKNOWN") : (subjectTpl + " " + applicantId);
  var body = [
    "Payment Verified - Release Access Required",
    "",
    "Applicant ID: " + applicantId,
    "Student Name: " + (rowStudentName_(row) || "(unknown)"),
    "Program/Grade: " + safeStr_(row.Program_Applied_For || row.Grade_Applying_For || row.Program || ""),
    "Subjects: " + safeStr_(row.Subjects_Selected_Canonical || row.Subjects_Selected || ""),
    "Parent Name: " + safeStr_(row.Parent_Name || ""),
    "Parent Phone: " + safeStr_(row.Parent_Phone || row.Phone_Number || ""),
    "Parent Email: " + getRowEmailForStudent_(row),
    "",
    "Action: Release access / enable program / add to LMS / allow next stage.",
    "Debug ID: " + String(debugId || "")
  ].join("\n");
  var sendOpts = buildPaymentVerifiedEmailOptions_();
  var sent = adminSendEmail_(adminTo, subject, body, sendOpts);
  if (!sent.ok) {
    return { ok: false, code: "EMAIL_SEND_FAILED", message: safeStr_(sent.error || "Failed to send admin release email") };
  }
  return { ok: true, status: "sent", to: adminTo };
}

function handlePaymentVerifiedEmailTriggers_(rowObj, debugId) {
  var row = rowObj || {};
  var warnings = [];
  if (CONFIG.EMAIL_ENABLE_PAYMENT_VERIFIED_TRIGGERS !== true) {
    return { ok: true, status: "disabled", warnings: warnings };
  }
  var applicantId = safeStr_(row.ApplicantID || "");
  var mode = safeStr_(CONFIG.DATA_MODE || "UNKNOWN") || "UNKNOWN";
  var key = "PAYVER_SENT::" + mode + "::" + (applicantId || ("ROW-" + safeStr_(row._rowNumber || "")));
  var props = PropertiesService.getScriptProperties();
  var already = safeStr_(props.getProperty(key) || "");
  if (already) {
    warnings.push("Payment verified email already sent");
    logAdminEvent_("PAYVER_EMAIL_SKIPPED_ALREADY_SENT", { applicantId: applicantId, sentKey: key, debugId: debugId });
    return { ok: true, status: "skipped", warnings: warnings, sentKey: key, alreadySentAt: already };
  }

  var studentRes = sendPaymentVerifiedStudentQuoteEmail_(row, debugId);
  if (!studentRes.ok) {
    logAdminEvent_("PAYMENT_EMAIL_SEND_FAILED", { applicantId: applicantId, debugId: debugId, stage: "student", error: studentRes.message || "" });
    return { ok: false, status: "failed", code: studentRes.code || "EMAIL_SEND_FAILED", message: studentRes.message || "Student email failed", warnings: warnings };
  }
  if (studentRes.warning) warnings.push(studentRes.warning);

  var adminRes = sendPaymentVerifiedAdminReleaseEmail_(row, debugId);
  if (!adminRes.ok) {
    logAdminEvent_("PAYMENT_EMAIL_SEND_FAILED", { applicantId: applicantId, debugId: debugId, stage: "admin", error: adminRes.message || "" });
    return { ok: false, status: "failed", code: adminRes.code || "EMAIL_SEND_FAILED", message: adminRes.message || "Admin email failed", warnings: warnings };
  }

  var ts = nowIso_();
  props.setProperty(key, ts);
  logAdminEvent_("PAYMENT_VERIFIED_EMAIL_SENT", {
    applicantId: applicantId,
    studentEmail: getRowEmailForStudent_(row),
    adminTo: parseCsvEmails_(CONFIG.EMAIL_RELEASE_ADMIN_TO || ""),
    sentKey: key,
    dbg: debugId
  });
  return { ok: true, status: "sent", warnings: warnings, sentKey: key, sentAt: ts };
}

function handleInvoiceTrigger_(sh, rowNumber, idx, rowObj, debugId) {
  var row = rowObj || {};
  var applicantId = safeStr_(row.ApplicantID);
  // `CRM_Invoice_Triggered` remains a legacy compatibility marker until a Books-native finance status replaces it.
  logS4aOutboundTrace_("S4A_CRM_SUSPECT_PATH", {
    sourceFunction: "handleInvoiceTrigger_",
    configKeyName: "INVOICE_WEBHOOK_URL",
    destinationHost: redactUrlForLog_(safeStr_(CONFIG.INVOICE_WEBHOOK_URL || "")),
    applicantId: applicantId,
    formId: safeStr_(row.FormID || row.FD_FormID || ""),
    operationType: "invoice_trigger_gate",
    timestamp: new Date().toISOString()
  });
  if (hasValue_(row.CRM_Invoice_Triggered)) {
    logAdminEvent_("INVOICE_TRIGGER_SKIPPED_ALREADY", { applicantId: applicantId, debugId: debugId });
    return { status: "skipped", reason: "already_triggered" };
  }
  if (CONFIG.INVOICE_TRIGGER_ENABLED !== true) {
    logAdminEvent_("INVOICE_TRIGGER_DISABLED", { applicantId: applicantId, debugId: debugId });
    return { status: "disabled", reason: "config_disabled" };
  }

  var trig = triggerInvoiceWebhook_(row, debugId);
  if (!trig.ok) {
    logAdminEvent_("INVOICE_TRIGGER_FAILED", { applicantId: applicantId, debugId: debugId, code: trig.code || "", message: trig.message || "" });
    return { status: "failed", code: trig.code || "INVOICE_TRIGGER_FAILED", message: trig.message || "Invoice trigger failed" };
  }

  var ts = nowIso_();
  patchIfHeadersPresent_(sh, rowNumber, idx, {
    CRM_Invoice_Triggered: "Yes",
    Invoice_Sent_At: ts
  });
  row.CRM_Invoice_Triggered = "Yes";
  row.Invoice_Sent_At = ts;
  var paymentEmail = sendPaymentEmail_(row, debugId);
  if (!paymentEmail.ok) {
    logAdminEvent_("INVOICE_TRIGGERED_EMAIL_FAILED", { applicantId: applicantId, debugId: debugId, code: paymentEmail.code || "", message: paymentEmail.message || "" });
    return { status: "failed", code: paymentEmail.code || "PAYMENT_EMAIL_FAILED", message: paymentEmail.message || "Payment email failed" };
  }
  logAdminEvent_("INVOICE_TRIGGERED", { applicantId: applicantId, debugId: debugId, mode: trig.mode || "", httpStatus: trig.httpStatus || 0 });
  return { status: "triggered", mode: trig.mode || "LOG_ONLY" };
}

function runVerificationAutomations_(sh, rowNumber, idx, beforeRowObj, afterRowObj, debugId) {
  var beforeRow = beforeRowObj || {};
  var afterRow = afterRowObj || {};
  var actions = {
    quoteEmail: "skipped",
    invoice: "skipped",
    paymentVerifiedEmails: "skipped",
    warnings: []
  };
  var applicantId = safeStr_(afterRow.ApplicantID || beforeRow.ApplicantID || "");
  try {
    var docsBefore = isYes_(beforeRow.Docs_Verified);
    var docsAfter = adminDocumentReviewVerifiedForAutomation_(afterRow);
    if (!docsBefore && docsAfter) {
      actions.quoteEmail = "manual_only";
      logAdminEvent_("QUOTE_EMAIL_SKIPPED", { applicantId: applicantId, debugId: debugId, reason: "manual_only_cis91" });
    }
  } catch (quoteErr) {
    actions.quoteEmail = "failed";
    logAdminEvent_("QUOTE_EMAIL_FAILED", { applicantId: applicantId, debugId: debugId, message: String(quoteErr && quoteErr.message ? quoteErr.message : quoteErr) });
  }

  try {
    var payBefore = isPaymentVerifiedDerived_(beforeRow) === true;
    var payAfter = isPaymentVerifiedDerived_(afterRow) === true;
    if (!payBefore && payAfter) {
      logS4aOutboundTrace_("S4A_CRM_SUSPECT_PATH", {
        sourceFunction: "runVerificationAutomations_",
        configKeyName: "INVOICE_WEBHOOK_URL",
        destinationHost: redactUrlForLog_(safeStr_(CONFIG.INVOICE_WEBHOOK_URL || "")),
        applicantId: applicantId,
        formId: safeStr_(afterRow.FormID || afterRow.FD_FormID || ""),
        operationType: "payment_verified_invoice_handoff_check",
        timestamp: new Date().toISOString()
      });
      // Payment verified email workflow is triggered explicitly in save handlers.
      actions.paymentVerifiedEmails = "handled_in_save_handler";
      var invRes = handleInvoiceTrigger_(sh, rowNumber, idx, afterRow, debugId);
      actions.invoice = safeStr_(invRes && invRes.status) || "failed";
      if (invRes && invRes.code) actions.invoiceCode = safeStr_(invRes.code);
      if (invRes && invRes.message) actions.invoiceMessage = safeStr_(invRes.message);
    }
  } catch (invErr) {
    actions.invoice = "failed";
    actions.invoiceCode = "INVOICE_TRIGGER_FAILED";
    actions.invoiceMessage = String(invErr && invErr.message ? invErr.message : invErr);
    logAdminEvent_("INVOICE_TRIGGER_FAILED", { applicantId: applicantId, debugId: debugId, message: actions.invoiceMessage });
  }
  actions.emailTriggered = (safeStr_(actions.paymentVerifiedEmails) === "sent");
  return actions;
}

function getCol_(idx, candidates) {
  var names = Array.isArray(candidates) ? candidates : [candidates];
  for (var i = 0; i < names.length; i++) {
    var k = clean_(names[i]);
    if (k && idx[k]) return k;
  }
  return "";
}

// resolveStatusCols_ lives in Admin_ReviewStatusAuthority.js.

function headerIndex_(headersRow) {
  var out = {};
  for (var i = 0; i < headersRow.length; i++) {
    var h = clean_(headersRow[i]);
    if (h) out[h] = i + 1;
  }
  return out;
}

function requireHeaders_(idx, required) {
  for (var i = 0; i < required.length; i++) {
    if (!idx[required[i]]) throw new Error("Missing required header: " + required[i]);
  }
}

function setCell_(sh, rowNumber, idx, header, value) {
  sh.getRange(rowNumber, idx[header]).setValue(value);
}

function ensureHeadersExist_(sh, headers) {
  var current = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  var changed = false;
  for (var i = 0; i < headers.length; i++) {
    if (current.indexOf(headers[i]) === -1) {
      current.push(headers[i]);
      changed = true;
    }
  }
  if (changed) sh.getRange(1, 1, 1, current.length).setValues([current]);
}

function getActiveUserEmail_() {
  try { return clean_(Session.getActiveUser().getEmail()); } catch (e) { return ""; }
}

function buildPortalLink_(applicantId, secret) {
  var base = clean_(CONFIG.WEBAPP_URL_STUDENT || "");
  if (!isStudentUrlConfigured_()) throw new Error(getStudentUrlWarning_());
  return base + "?view=portal&id=" + encodeURIComponent(applicantId) + "&s=" + encodeURIComponent(secret);
}

function buildPortalLinkFromBase_(base, applicantId, secret) {
  return base + "?view=portal&id=" + encodeURIComponent(applicantId) + "&s=" + encodeURIComponent(secret);
}

function buildCsvLine_(cells) {
  return cells.map(function (cell) {
    var v = String(cell === null || cell === undefined ? "" : cell);
    if (/[",\n]/.test(v)) v = '"' + v.replace(/"/g, '""') + '"';
    return v;
  }).join(",");
}

// Review queue read-model helpers live in Admin_ReviewQueues.js.

function nonEmpty_(v) {
  var s = String(v === null || v === undefined ? "" : v).trim();
  if (!s) return false;
  var n = s.toLowerCase();
  if (n === "0" || n === "false" || n === "n/a") return false;
  return true;
}

// adminDocumentRequiredUploadFields_ lives in Admin_DocumentServices.js.

// adminDocumentMandatoryIssueMappings_ lives in Admin_DocumentServices.js.

// adminDocumentHasEvidence_ lives in Admin_DocumentServices.js.

// adminDocumentDisplayRowHasUrl_ lives in Admin_DocumentServices.js.

// adminDocumentFieldStatus_ lives in Admin_DocumentServices.js.

// Document review authority helpers live in Admin_ReviewStatusAuthority.js.

// hasAnyRequiredDoc_ lives in Admin_DocumentServices.js.

function parseTime_(v) {
  if (v instanceof Date) return v.getTime();
  var s = String(v === null || v === undefined ? "" : v).trim();
  if (!s) return 0;
  var t = Date.parse(s);
  return Number.isFinite(t) ? t : 0;
}

function resolveOperatorIdentity_() {
  var active = "";
  try { active = clean_(getActiveUserEmail_() || ""); } catch (_activeErr) {}
  var caller = "";
  try { caller = clean_(typeof getCallerEmail_ === "function" ? getCallerEmail_() : ""); } catch (_callerErr) {}
  return clean_(active || caller || "admin");
}

function captureOperatorAttribution_(sh, rowNumber, idx, opts) {
  var o = (opts && typeof opts === "object") ? opts : {};
  var row = (o.rowObj && typeof o.rowObj === "object") ? o.rowObj : null;
  var action = clean_(o.action || "");
  var operator = clean_(o.operatorEmail || resolveOperatorIdentity_() || "admin");
  var out = {
    handledSet: false,
    enrolledSet: false,
    operatorEmail: operator
  };

  if (!sh || !idx || !rowNumber || rowNumber < 2) return out;
  if (!row) row = getRowObject_(sh, rowNumber) || {};

  if (idx.Handled_By && idx.Handled_At && !clean_(row.Handled_By || "")) {
    setCell_(sh, rowNumber, idx, "Handled_By", operator);
    setCell_(sh, rowNumber, idx, "Handled_At", new Date());
    out.handledSet = true;
    logAdminEvent_("ATTRIBUTION_HANDLED_SET", {
      rowNumber: rowNumber,
      action: action,
      operatorEmail: operator
    });
    try { row.Handled_By = operator; row.Handled_At = new Date().toISOString(); } catch (_handledRowErr) {}
  }

  return out;
}

// Queue SLA and received timestamp helpers live in Admin_ReviewQueues.js.

function hasStudentActivity_(row) {
  var r = row || {};
  var lastUpdateRaw = r.PortalLastUpdateAt;
  var lastUpdateTs = parseTime_(lastUpdateRaw);
  if (!(lastUpdateTs > 0)) return false;
  var submitted = clean_(r.Portal_Submitted || "");
  if (!submitted) return true;
  return submitted === "Yes" || submitted.indexOf("T") > 0;
}

// Queue sort, issue, and candidate helpers live in Admin_ReviewQueues.js.

// Shared row authority helpers live in Admin_RowFacts.js.

function isExternalFdIntakeRow_(rowObj) {
  var row = rowObj || {};
  if (!clean_(row.ApplicantID || "")) return false;
  var adapterSource = clean_(row.adapter_source || row.Adapter_Source || "").toLowerCase();
  var forwarded = clean_(row.adapter_forwarded || row.Adapter_Forwarded || "").toLowerCase();
  var hasForwarded = forwarded === "1" || forwarded === "true" || forwarded === "yes";
  var hasAdapterVersion = !!clean_(row.adapter_version || row.Adapter_Version || "");
  return adapterSource === "sheet_bound_adapter" || hasForwarded || hasAdapterVersion;
}

// Fd-received queue sorting lives in Admin_ReviewQueues.js.

function getDashboardCacheKey_(adminEmail) {
  return "ADMIN_DASHBOARD::" + clean_(adminEmail || "").toLowerCase();
}

function getOperationalMetricsCacheKey_(adminEmail) {
  return "ADMIN_OPS_METRICS::" + clean_(adminEmail || "").toLowerCase();
}

function isSameLocalDate_(value, now) {
  var ts = parseTime_(value);
  if (!(ts > 0)) return false;
  var tz = Session.getScriptTimeZone() || "GMT";
  return Utilities.formatDate(new Date(ts), tz, "yyyy-MM-dd") === Utilities.formatDate(now || new Date(), tz, "yyyy-MM-dd");
}

function isSameLocalMonth_(value, now) {
  var ts = parseTime_(value);
  if (!(ts > 0)) return false;
  var tz = Session.getScriptTimeZone() || "GMT";
  return Utilities.formatDate(new Date(ts), tz, "yyyy-MM") === Utilities.formatDate(now || new Date(), tz, "yyyy-MM");
}

function isPreviousLocalMonth_(value, now) {
  var ts = parseTime_(value);
  if (!(ts > 0)) return false;
  var ref = now || new Date();
  var previous = new Date(ref.getFullYear(), ref.getMonth() - 1, 1);
  var tz = Session.getScriptTimeZone() || "GMT";
  return Utilities.formatDate(new Date(ts), tz, "yyyy-MM") === Utilities.formatDate(previous, tz, "yyyy-MM");
}

function buildCommunicationsActivityShell_() {
  return {
    reliable: true,
    sourceType: "communications_ledger_latest_row_state",
    authorityName: "Communications Ledger",
    sourceLabel: "Source: Communications Ledger - latest row state only",
    sourceDetail: "Window counts are rows whose latest communication state falls in the period. Mailbox bounces affect reliability metrics only after deterministic runtime reconciliation.",
    authorityDetail: "Single runtime communications accounting DTO derived from row communication fields; not Gmail and not System Health send caps.",
    lifetimePolicy: "Latest-row proxy; true lifetime counters require historical send records and must not be compared to cumulative Gmail volume.",
    cumulativeIsHistorical: false,
    cumulativeLabel: "Current applicants with latest status SENT",
    sent: { today: 0, last7Days: 0, monthToDate: 0, previousMonth: 0, cumulative: 0 },
    failed: { today: 0, last7Days: 0, monthToDate: 0, previousMonth: 0 },
    suppressed: { total: 0 },
    bounced: { total: 0 },
    suppressedBounced: { total: 0 },
    deliveryHealth: {
      available: false,
      permanentBounces: 0,
      temporaryBounces: 0,
      successfulDeliveries: 0,
      unknown: 0,
      lastBounce: "",
      bounceRate: null,
      sourceLabel: "Source: reconciled runtime delivery health"
    },
    lastSuccessfulSend: "",
    lastSentAt: "",
    metricAuthority: {
      today: "Communications Ledger latest-row timestamp",
      last7Days: "Communications Ledger latest-row timestamp",
      monthToDate: "Communications Ledger latest-row timestamp",
      previousMonth: "Communications Ledger latest-row timestamp",
      cumulative: "Current applicants whose latest communication status is SENT",
      failures: "Latest Email_Status / Last_Contact_Result evidence",
      suppressedBounced: "Latest runtime row reliability evidence",
      lastSuccessfulSend: "Latest successful row timestamp"
    },
    sourceFields: ["Email_Last_Sent_At", "Last_Contacted_At", "Email_Status", "Last_Contact_Result", "Email_Bounce_Flag", "Delivery_Health", "Last_Delivery_Status", "Last_Bounce_Date"]
  };
}

function buildEmailResponseTrafficShell_() {
  return buildCommunicationsActivityShell_();
}

function actionabilityWorkloadExplanationEmpty_() {
  return {
    "Awaiting applicant upload": 0,
    "Contactability exception": 0,
    "Payment evidence required": 0,
    "Payment reminder sent today": 0,
    "Reminder sent today": 0,
    "Awaiting applicant response": 0,
    "Awaiting payment evidence": 0,
    "Cooling-off": 0,
    "Escalation due": 0,
    "Ready for reminder": 0,
    "Ready for academic review": 0,
    "Document received today": 0,
    "Other": 0
  };
}

function incrementActionabilityWorkloadExplanation_(summary, label) {
  var key = clean_(label || "Other") || "Other";
  if (!summary || typeof summary !== "object") summary = actionabilityWorkloadExplanationEmpty_();
  if (!Object.prototype.hasOwnProperty.call(summary, key)) summary[key] = 0;
  summary[key] = Number(summary[key] || 0) + 1;
  return summary;
}

function actionabilityWorkloadExplanationForRow_(row) {
  var r = row || {};
  var state = clean_(r.actionabilityState || "").toUpperCase();
  var reason = clean_(r.reasonCode || "").toUpperCase();
  var next = clean_(r.nextAction || "").toUpperCase();
  var suppressor = clean_(r.suppressor || "").toUpperCase();
  var recommended = clean_(r.recommendedAction || r.recommendedMessageType || "").toLowerCase();
  var authority = r.authorityState || {};
  var uploaded = Number(authority.uploadedRequiredDocumentCount || 0);
  var required = Number(authority.requiredDocumentCount || 0);
  if (reason === "NO_EFFECTIVE_EMAIL" || reason === "EMAIL_BLOCKED_OR_BOUNCED" || suppressor === "NO_EFFECTIVE_EMAIL" || suppressor === "EMAIL_BLOCKED_OR_BOUNCED") {
    return "Contactability exception";
  }
  if (state === "COOLING_OFF" || reason === "COOLDOWN_ACTIVE") return "Cooling-off";
  if (isSameLocalDate_(r.lastRelevantDate || "", new Date()) && uploaded > 0 && required > uploaded) return "Document received today";
  if (next === "REVIEW_DOCUMENTS" || reason === "OFFICER_ACTION_PENDING") return "Ready for academic review";
  if (reason === "FINANCE_ACTION_PENDING") return "Awaiting finance review";
  if (reason === "ADMIN_ACTION_PENDING") return "Awaiting admin completion";
  if (next === "SEND_PAYMENT_REMINDER") {
    if (Number(r.lastContactAgeDays || 0) === 0) return "Payment reminder sent today";
    if (state === "READY") return "Payment evidence required";
    return "Awaiting payment evidence";
  }
  if (state === "AWAITING_APPLICANT") return "Awaiting applicant response";
  if (next === "UPLOAD_REQUIRED_DOCUMENTS") {
    if (Number(r.lastContactAgeDays || 0) === 0) return "Reminder sent today";
    if (recommended.indexOf("escalation") >= 0 || Number(r.lastContactAgeDays || 0) >= 14) return "Escalation due";
    if (state === "READY") return "Ready for reminder";
    return "Awaiting applicant upload";
  }
  if (state === "AWAITING_PAYMENT") return "Awaiting payment evidence";
  return "Other";
}

function addEmailTrafficPeriod_(bucket, timestamp, now) {
  var ts = parseTime_(timestamp);
  if (!(ts > 0) || !bucket) return;
  if (isSameLocalDate_(timestamp, now)) bucket.today = Number(bucket.today || 0) + 1;
  if ((now.getTime() - ts) <= (7 * 24 * 60 * 60 * 1000)) {
    bucket.last7Days = Number(bucket.last7Days || 0) + 1;
    bucket.thisWeek = Number(bucket.thisWeek || 0) + 1;
  }
  if (isSameLocalMonth_(timestamp, now)) {
    bucket.monthToDate = Number(bucket.monthToDate || 0) + 1;
    bucket.thisMonth = Number(bucket.thisMonth || 0) + 1;
  }
  if (isPreviousLocalMonth_(timestamp, now)) bucket.previousMonth = Number(bucket.previousMonth || 0) + 1;
}

// Lifecycle and stage authority helpers live in Admin_LifecycleAuthority.js.

function buildDuplicateSignatureMetrics_(rowObj) {
  var row = rowObj || {};
  var first = clean_(row.First_Name || "").toLowerCase().replace(/\s+/g, " ").trim();
  var last = clean_(row.Last_Name || "").toLowerCase().replace(/\s+/g, " ").trim();
  var name = clean_(row.StudentName || row.Student_Name || row.Full_Name || ((first + " " + last).trim())).toLowerCase().replace(/\s+/g, " ").trim();
  var dob = toIsoDateInput_(row.Date_Of_Birth || row.DOB || "") || clean_(row.Date_Of_Birth || row.DOB || "").toLowerCase();
  return {
    applicantId: clean_(row.ApplicantID || "").toLowerCase(),
    parentContact: clean_(row.Parent_Email_Corrected || row.Parent_Email || "").toLowerCase() + "::" + clean_(row.Parent_Phone || row.Parent_Mobile || row.Phone_Number || row.Mobile || row.Phone || "").replace(/\D/g, ""),
    studentDob: name && dob ? (name + "::" + dob) : "",
    portalToken: clean_(row.PortalTokenHash || "").toLowerCase()
  };
}

function countDuplicateRisk_(signatureCounts) {
  var risk = 0;
  Object.keys(signatureCounts || {}).forEach(function (key) {
    if (Number(signatureCounts[key] || 0) > 1) risk++;
  });
  return risk;
}

function buildOperationalDashboardMetrics_() {
  var now = new Date();
  var startedAt = now.getTime();
  var sheet = openDataSheet_();
  var values = sheet.getDataRange().getValues();
  var ledger = buildPopulationLedgerFromValues_(values, sheet && typeof sheet.getName === "function" ? sheet.getName() : "", { includeEntries: false });
  var headers = values && values.length ? values[0] : [];
  var rows = Math.max(0, (values || []).length - 1);
  var pipelineCounts = {
    "New To MLCKIA": 0,
    "Contacted": 0,
    "Documents Pending": 0,
    "Payment Pending": 0,
    "Enrolled": 0,
    "Closed Lost": 0
  };
  var emailStates = {
    SEND_ATTEMPT: 0,
    SENT: 0,
    FAILED: 0,
    BOUNCED: 0,
    SUPPRESSED: 0,
    FALLBACK_PENDING: 0
  };
  var signatureCounts = {};
  var out = {
    ok: true,
    formsReceivedToday: 0,
    pendingIntakeReview: 0,
    openLifecycleRows: 0,
    awaitingDocuments: 0,
    readyForReview: 0,
    rowLoggedCommunicationsToday: 0,
    emailRowsSentToday: 0,
    docsPending: 0,
    paymentPending: 0,
    emailSentToday: 0,
    emailFailures: 0,
    whatsappFallbackQueue: 0,
    queueBacklog: 0,
    duplicateRisk: 0,
    pipelineCounts: pipelineCounts,
    emailStates: emailStates,
    communicationsActivity: buildCommunicationsActivityShell_(),
    emailResponseTraffic: null,
    populationLedger: populationLedgerPublicSummary_(ledger),
    scannedRows: rows,
    scanDurationMs: 0
  };
  out.emailResponseTraffic = out.communicationsActivity;
  for (var r = 1; r < values.length; r++) {
    var rowObj = campaignRowObjectFromValues_(headers, values[r]);
    if (!clean_(rowObj.ApplicantID || "")) continue;
    if (isSameLocalDate_(rowObj.Timestamp || rowObj.timestamp || rowObj.adapter_timestamp || rowObj.Created_At || rowObj.PortalTokenIssuedAt || "", now)) out.formsReceivedToday++;
    var pipeline = deriveOperationalPipelineStage_(rowObj);
    var lifecycleStage = clean_(deriveApplicantLifecycleStage_(rowObj) || "UNKNOWN").toUpperCase() || "UNKNOWN";
    var portalSubmitted = adminRowPortalSubmitted_(rowObj);
    var completeness = adminOpsRequiredDocumentUploadSummary_(rowObj);
    var docsReviewVerified = adminRowDocsReviewVerified_(rowObj);
    if (Object.prototype.hasOwnProperty.call(pipelineCounts, pipeline)) pipelineCounts[pipeline]++;
    var emailStatus = normalizeEmailStatus_(rowObj.Email_Status || "");
    if (emailStatus && Object.prototype.hasOwnProperty.call(emailStates, emailStatus)) emailStates[emailStatus]++;
    if (lifecycleStage !== "COMPLETE") out.openLifecycleRows++;
    if (portalSubmitted && !docsReviewVerified && !(completeness && completeness.requiredDocumentUploadComplete)) out.awaitingDocuments++;
    if (portalSubmitted && completeness && completeness.requiredDocumentUploadComplete && !docsReviewVerified) out.readyForReview++;
    if (isSameLocalDate_(rowObj.Email_Last_Sent_At || rowObj.Last_Contacted_At || "", now)) out.rowLoggedCommunicationsToday++;
    if (isSameLocalDate_(rowObj.Email_Last_Sent_At || "", now)) out.emailRowsSentToday++;
    out.emailSentToday = out.rowLoggedCommunicationsToday;
    var lastResult = clean_(rowObj.Last_Contact_Result || "").toUpperCase();
    var trafficTimestamp = rowObj.Email_Last_Sent_At || rowObj.Last_Contacted_At || "";
    var sentLike = emailStatus === "SENT" || lastResult === "SENT" || lastResult === "SUCCESS" || lastResult === "DELIVERED";
    if (sentLike) {
      out.communicationsActivity.sent.cumulative = Number(out.communicationsActivity.sent.cumulative || 0) + 1;
      addEmailTrafficPeriod_(out.communicationsActivity.sent, trafficTimestamp, now);
      var sentTs = parseTime_(trafficTimestamp);
      var currentLastTs = parseTime_(out.communicationsActivity.lastSuccessfulSend || out.communicationsActivity.lastSentAt || "");
      if (sentTs > currentLastTs) {
        out.communicationsActivity.lastSuccessfulSend = new Date(sentTs).toISOString();
        out.communicationsActivity.lastSentAt = out.communicationsActivity.lastSuccessfulSend;
      }
    }
    if (lastResult === "FAILED") emailStates.FAILED++;
    if (lastResult === "SUPPRESSED") emailStates.SUPPRESSED++;
    if (emailStatus === "FAILED" || emailStatus === "BOUNCED" || lastResult === "FAILED") {
      out.emailFailures++;
      addEmailTrafficPeriod_(out.communicationsActivity.failed, trafficTimestamp, now);
    }
    if (emailStatus === "SUPPRESSED" || lastResult === "SUPPRESSED") {
      out.communicationsActivity.suppressed.total = Number(out.communicationsActivity.suppressed.total || 0) + 1;
      out.communicationsActivity.suppressedBounced.total = Number(out.communicationsActivity.suppressedBounced.total || 0) + 1;
    }
    if (emailStatus === "BOUNCED" || isCampaignBounceFlagTrue_(rowObj.Email_Bounce_Flag)) {
      out.communicationsActivity.bounced.total = Number(out.communicationsActivity.bounced.total || 0) + 1;
      out.communicationsActivity.suppressedBounced.total = Number(out.communicationsActivity.suppressedBounced.total || 0) + 1;
    }
    var deliveryHealth = clean_(rowObj.Delivery_Health || rowObj.Last_Delivery_Status || "").toUpperCase();
    var hasDeliveryEvidence = !!clean_(rowObj.Delivery_Health || rowObj.Last_Delivery_Status || rowObj.Last_Bounce_Date || rowObj.Delivery_Reconciliation_Key || "");
    if (hasDeliveryEvidence) {
      out.communicationsActivity.deliveryHealth.available = true;
      if (deliveryHealth === "PERMANENT FAILURE") out.communicationsActivity.deliveryHealth.permanentBounces++;
      else if (deliveryHealth === "TEMPORARY FAILURE") out.communicationsActivity.deliveryHealth.temporaryBounces++;
      else if (deliveryHealth === "DELIVERED") out.communicationsActivity.deliveryHealth.successfulDeliveries++;
      else out.communicationsActivity.deliveryHealth.unknown++;
      var bounceTs = parseTime_(rowObj.Last_Bounce_Date || "");
      var currentBounceTs = parseTime_(out.communicationsActivity.deliveryHealth.lastBounce || "");
      if (bounceTs > currentBounceTs) out.communicationsActivity.deliveryHealth.lastBounce = new Date(bounceTs).toISOString();
    }
    if (isWhatsAppFallbackCandidate_(rowObj, "ALL_FALLBACK") || emailStatus === "FALLBACK_PENDING") {
      out.whatsappFallbackQueue++;
    }
    if (isQueueCandidateRow_(rowObj)) out.queueBacklog++;
    if (pipeline === "Documents Pending") out.docsPending++;
    if (pipeline === "Payment Pending") out.paymentPending++;
    if (pipeline !== "Enrolled" && pipeline !== "Closed Lost") out.pendingIntakeReview++;

    var sig = buildDuplicateSignatureMetrics_(rowObj);
    ["applicantId", "parentContact", "studentDob", "portalToken"].forEach(function (key) {
      var value = clean_(sig[key] || "");
      if (key === "parentContact" && value.indexOf("::") <= 0) return;
      if (key === "parentContact" && (!value.split("::")[0] || !value.split("::")[1])) return;
      if (!value) return;
      var compound = key + "::" + value;
      signatureCounts[compound] = Number(signatureCounts[compound] || 0) + 1;
    });
  }
  out.duplicateRisk = countDuplicateRisk_(signatureCounts);
  var dh = out.communicationsActivity.deliveryHealth;
  if (dh && dh.available === true) {
    var attempted = Number(dh.successfulDeliveries || 0) + Number(dh.permanentBounces || 0) + Number(dh.temporaryBounces || 0);
    dh.bounceRate = attempted > 0 ? ((Number(dh.permanentBounces || 0) + Number(dh.temporaryBounces || 0)) / attempted) : null;
  }
  out.scanDurationMs = new Date().getTime() - startedAt;
  return out;
}

function admin_getOperationalDashboardMetrics(payload) {
  var adminEmail = getCallerEmail_();
  if (!isAdmin_(adminEmail)) throw new Error("Access denied");
  var p = payload && typeof payload === "object" ? payload : {};
  var force = p.force === 1 || p.force === true;
  var cache = CacheService.getUserCache();
  var cacheKey = getOperationalMetricsCacheKey_(adminEmail);
  if (!force) {
    try {
      var cached = cache.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (_cacheReadErr) {}
  }
  var out = buildOperationalDashboardMetrics_();
  try { cache.put(cacheKey, JSON.stringify(out), 60); } catch (_cacheWriteErr) {}
  return out;
}

function campaignReportDateKey_(dateObj) {
  return Utilities.formatDate(dateObj, Session.getScriptTimeZone() || "GMT", "yyyy-MM-dd");
}

function campaignReportParseDateKey_(value) {
  var raw = clean_(value || "");
  var match = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return null;
  var year = Number(match[1]);
  var month = Number(match[2]);
  var day = Number(match[3]);
  if (!(year > 2000) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  var parsed = new Date(year, month - 1, day);
  if (parsed.getFullYear() !== year || parsed.getMonth() !== month - 1 || parsed.getDate() !== day) return null;
  return parsed;
}

function resolveCampaignApplicationReportRange_(payload) {
  var now = new Date();
  var defaultEnd = campaignReportDateKey_(now);
  var defaultStartDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 6);
  var defaultStart = campaignReportDateKey_(defaultStartDate);
  var p = payload && typeof payload === "object" ? payload : {};
  var startDate = campaignReportParseDateKey_(p.startDate || p.from || defaultStart) || campaignReportParseDateKey_(defaultStart);
  var endDate = campaignReportParseDateKey_(p.endDate || p.to || defaultEnd) || campaignReportParseDateKey_(defaultEnd);
  if (startDate.getTime() > endDate.getTime()) {
    var tmp = startDate;
    startDate = endDate;
    endDate = tmp;
  }
  var startTs = new Date(startDate.getFullYear(), startDate.getMonth(), startDate.getDate(), 0, 0, 0, 0).getTime();
  var endTs = new Date(endDate.getFullYear(), endDate.getMonth(), endDate.getDate(), 23, 59, 59, 999).getTime();
  return {
    startDate: campaignReportDateKey_(startDate),
    endDate: campaignReportDateKey_(endDate),
    startTs: startTs,
    endTs: endTs
  };
}

function campaignReportRowReceivedInfo_(rowObj) {
  var row = rowObj || {};
  var candidates = [
    { key: "PortalLastUpdateAt", value: row.PortalLastUpdateAt || "" },
    { key: "adapter_timestamp", value: row.adapter_timestamp || row.adapterTimestamp || "" },
    { key: "Timestamp", value: row.Timestamp || row.timestamp || "" },
    { key: "Created_At", value: row.Created_At || row.createdAt || row.created_at || "" },
    { key: "PortalTokenIssuedAt", value: row.PortalTokenIssuedAt || "" }
  ];
  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i];
    var ts = parseTime_(candidate.value);
    if (ts > 0) return { ts: ts, source: candidate.key };
  }
  return { ts: 0, source: "" };
}

// Campaign lifecycle classification helpers live in Admin_LifecycleAuthority.js.

function admin_getCampaignApplicationReport(payload) {
  var adminEmail = getCallerEmail_();
  if (!isAdmin_(adminEmail)) throw new Error("Access denied");
  var range = resolveCampaignApplicationReportRange_(payload);
  var sheet = openDataSheet_();
  var values = sheet.getDataRange().getValues();
  var rows = Math.max(0, (values || []).length - 1);
  var out = {
    ok: true,
    readOnly: true,
    startDate: range.startDate,
    endDate: range.endDate,
    portalApplicationsReceived: 0,
    validPortalApplications: 0,
    validPortalApplicationsAvailable: false,
    duplicateBlockedIneligible: 0,
    duplicateBlockedIneligibleAvailable: false,
    applicantIdsGenerated: 0,
    lifecycleStageCounts: {},
    scannedRows: rows,
    includedRows: 0,
    dateSourceFields: ["PortalLastUpdateAt", "adapter_timestamp", "Timestamp", "Created_At", "PortalTokenIssuedAt"]
  };
  if (!values || values.length < 2) return out;

  var headers = values[0];
  var headerMap = headerIndex_(headers);
  out.validPortalApplicationsAvailable = !!(headerMap.Docs_Verified || headerMap.Payment_Verified || headerMap.Registration_Complete);
  out.duplicateBlockedIneligibleAvailable = !!(headerMap.Duplicate_Status || headerMap.Duplicate_Flag || headerMap.Is_Duplicate || headerMap.Overall_Status || headerMap.Pipeline_Stage || headerMap.Operational_Stage || headerMap.CRM_Stage || headerMap.Stage);

  for (var r = 1; r < values.length; r++) {
    var rowObj = campaignRowObjectFromValues_(headers, values[r]);
    var applicantId = clean_(rowObj.ApplicantID || "");
    if (!applicantId) continue;
    var received = campaignReportRowReceivedInfo_(rowObj);
    if (!(received.ts >= range.startTs && received.ts <= range.endTs)) continue;
    out.includedRows++;
    out.applicantIdsGenerated++;
    if (!isCampaignReportApplicationRow_(rowObj)) continue;

    out.portalApplicationsReceived++;
    if (out.validPortalApplicationsAvailable && campaignReportValidApplication_(rowObj)) out.validPortalApplications++;
    if (out.duplicateBlockedIneligibleAvailable && campaignReportDuplicateBlockedIneligible_(rowObj)) out.duplicateBlockedIneligible++;

    var stage = clean_(deriveApplicantLifecycleStage_(rowObj) || deriveOperationalPipelineStage_(rowObj) || "UNKNOWN").toUpperCase() || "UNKNOWN";
    out.lifecycleStageCounts[stage] = Number(out.lifecycleStageCounts[stage] || 0) + 1;
  }
  return out;
}

// Review queue pagination and filtering helpers live in Admin_ReviewQueues.js.

function actionabilityPreviewDateInfo_(rowObj) {
  var row = rowObj || {};
  var candidates = [
    { key: "Email_Next_Action_Date", value: row.Email_Next_Action_Date || "" },
    { key: "Last_Contacted_At", value: row.Last_Contacted_At || "" },
    { key: "Email_Last_Sent_At", value: row.Email_Last_Sent_At || "" },
    { key: "PortalLastUpdateAt", value: row.PortalLastUpdateAt || "" },
    { key: "Portal_Submitted", value: row.Portal_Submitted || "" },
    { key: "PortalTokenIssuedAt", value: row.PortalTokenIssuedAt || "" },
    { key: "adapter_timestamp", value: row.adapter_timestamp || row.adapterTimestamp || "" }
  ];
  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i];
    var ts = parseTime_(candidate.value);
    if (!(ts > 0)) continue;
    return {
      source: candidate.key,
      value: new Date(ts).toISOString(),
      ageDays: Math.max(0, Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000)))
    };
  }
  return { source: "NONE", value: "", ageDays: "" };
}

function actionabilityPreviewLastContactAgeDays_(rowObj) {
  var row = rowObj || {};
  var ts = parseTime_(row.Last_Contacted_At || row.Email_Last_Sent_At || row.Ack_Email_Sent_At || "");
  if (!(ts > 0)) return "";
  return Math.max(0, Math.floor((Date.now() - ts) / (24 * 60 * 60 * 1000)));
}

function actionabilityPreviewUrgency_(owner, nextAction, dateInfo, suppressor, cooldownActive) {
  if (owner === "NONE" || nextAction === "NO_ACTION") return { level: "NORMAL", reason: "No operator action is currently required." };
  if (suppressor === "NO_EFFECTIVE_EMAIL" || suppressor === "EMAIL_BLOCKED_OR_BOUNCED") {
    return { level: "ESCALATED", reason: "Applicant action is blocked by contactability issue." };
  }
  if (cooldownActive) return { level: "NORMAL", reason: "Communication cooldown or next-action date is still active." };
  var ageDays = Number(dateInfo && dateInfo.ageDays);
  if (Number.isFinite(ageDays)) {
    if (ageDays >= 60) return { level: "DORMANT", reason: "Case has been stale for 60+ days from " + clean_(dateInfo.source || "source date") + "." };
    if (ageDays >= 21) return { level: "ESCALATED", reason: "Case has been stale for 21+ days from " + clean_(dateInfo.source || "source date") + "." };
    if (ageDays >= 14) return { level: "OVERDUE", reason: "Case has been stale for 14+ days from " + clean_(dateInfo.source || "source date") + "." };
    if (ageDays >= 3) return { level: "DUE", reason: "Case has been waiting for 3+ days from " + clean_(dateInfo.source || "source date") + "." };
  }
  return { level: "NORMAL", reason: "Case is current or has insufficient date evidence for escalation." };
}

function actionabilityBatchMessageTypeForRecommendation_(recommendedMessageType) {
  var normalized = clean_(recommendedMessageType || "").toLowerCase();
  if (normalized === "document_completion_reminder" || normalized === "document_completion_escalation") return "docs_missing";
  if (normalized === "payment_reminder" || normalized === "payment_escalation") return "payment_followup";
  if (normalized === "docs_missing" || normalized === "payment_followup" || normalized === "legacy_invite" || normalized === "reminder") return normalized;
  return "";
}

function resolveActionabilityState_(facts) {
  var f = facts && typeof facts === "object" ? facts : {};
  var owner = clean_(f.owner || "").toUpperCase();
  var nextAction = clean_(f.nextAction || "").toUpperCase();
  var suppressor = clean_(f.suppressor || "").toUpperCase();
  var lifecycleStage = clean_(f.lifecycleStage || "").toUpperCase();
  var recommendedMessageType = clean_(f.recommendedMessageType || "");
  var recommendedBatchType = actionabilityBatchMessageTypeForRecommendation_(recommendedMessageType);
  var canonicalRecommendedMessageType = clean_(f.canonicalRecommendedMessageType || "");
  var canonicalRecommendedBatchType = actionabilityBatchMessageTypeForRecommendation_(canonicalRecommendedMessageType);
  var legacyStageRecommendedType = typeof communicationRecommendedMessageTypeForStage_ === "function"
    ? clean_(communicationRecommendedMessageTypeForStage_(lifecycleStage) || "")
    : "";
  var stageRecommendedType = canonicalRecommendedBatchType || legacyStageRecommendedType;
  var coolingOffUntil = clean_(f.coolingOffUntil || "");
  var out = {
    actionabilityState: "UNKNOWN",
    selectable: false,
    selectBlockReason: "Actionability could not be derived. Open Review Workspace before batch action.",
    coolingOffUntil: coolingOffUntil,
    recommendedAction: clean_(f.nextAction || "REVIEW"),
    reasonCode: "UNKNOWN"
  };

  if (owner === "NONE" || nextAction === "NO_ACTION" || suppressor === "COMPLETED_OR_ENROLLED") {
    out.actionabilityState = "COMPLETE";
    out.selectBlockReason = "No operator action is required.";
    out.recommendedAction = "NO_ACTION";
    out.reasonCode = "COMPLETE";
    return out;
  }
  if (suppressor === "COOLDOWN_ACTIVE") {
    out.actionabilityState = "COOLING_OFF";
    out.selectBlockReason = coolingOffUntil
      ? "Cooling-off active until " + coolingOffUntil + "."
      : "Cooling-off active after a recent communication.";
    out.recommendedAction = "WAIT";
    out.reasonCode = "COOLDOWN_ACTIVE";
    return out;
  }
  if (suppressor === "NO_EFFECTIVE_EMAIL" || suppressor === "EMAIL_BLOCKED_OR_BOUNCED") {
    out.actionabilityState = "REVIEW_REQUIRED";
    out.selectBlockReason = "Contactability Gate must be resolved before batch communication.";
    out.recommendedAction = "FIX_CONTACT_DETAILS";
    out.reasonCode = suppressor;
    return out;
  }
  if (suppressor === "OFFICER_ACTION_PENDING" || owner === "OFFICER") {
    out.actionabilityState = "REVIEW_REQUIRED";
    out.selectBlockReason = "Admissions review is required before applicant communication.";
    out.recommendedAction = "REVIEW_DOCUMENTS";
    out.reasonCode = "OFFICER_ACTION_PENDING";
    return out;
  }
  if (suppressor === "FINANCE_ACTION_PENDING" || owner === "FINANCE") {
    out.actionabilityState = "REVIEW_REQUIRED";
    out.selectBlockReason = "Finance verification is required before applicant communication.";
    out.recommendedAction = "VERIFY_PAYMENT";
    out.reasonCode = "FINANCE_ACTION_PENDING";
    return out;
  }
  if (suppressor === "ADMIN_ACTION_PENDING" || owner === "ADMIN") {
    out.actionabilityState = "REVIEW_REQUIRED";
    out.selectBlockReason = "Admin review is required before batch communication.";
    out.recommendedAction = clean_(f.nextAction || "REVIEW");
    out.reasonCode = "ADMIN_ACTION_PENDING";
    return out;
  }
  if (owner === "APPLICANT") {
    if (!recommendedBatchType) {
      out.actionabilityState = nextAction === "SEND_PAYMENT_REMINDER" ? "AWAITING_PAYMENT" : "AWAITING_APPLICANT";
      out.selectBlockReason = nextAction === "SEND_PAYMENT_REMINDER"
        ? "Waiting for payment action; no batch-safe payment follow-up is currently recommended."
        : "Waiting for applicant action; no batch-safe communication is currently recommended.";
      out.recommendedAction = clean_(f.nextAction || "WAIT");
      out.reasonCode = out.actionabilityState;
      return out;
    }
    if (stageRecommendedType && stageRecommendedType !== recommendedBatchType) {
      out.actionabilityState = nextAction === "SEND_PAYMENT_REMINDER" ? "AWAITING_PAYMENT" : "AWAITING_APPLICANT";
      out.selectBlockReason = "Current applicant state is not ready for " + recommendedBatchType + ". Recommended action: " + stageRecommendedType + ".";
      out.recommendedAction = "WAIT";
      out.reasonCode = "TEMPLATE_STAGE_MISMATCH";
      return out;
    }
    out.actionabilityState = "READY";
    out.selectable = true;
    out.selectBlockReason = "";
    out.recommendedAction = recommendedBatchType;
    out.reasonCode = "READY";
    return out;
  }
  if (nextAction === "SEND_PAYMENT_REMINDER") {
    out.actionabilityState = "AWAITING_PAYMENT";
    out.selectBlockReason = "Payment follow-up is not currently ready for batch communication.";
    out.recommendedAction = "WAIT";
    out.reasonCode = "AWAITING_PAYMENT";
    return out;
  }
  return out;
}

function buildActionabilityPreviewRow_(rowObj, rowNumber) {
  var row = rowObj || {};
  var applicantId = clean_(row.ApplicantID || "");
  var firstName = clean_(row.First_Name || "");
  var lastName = clean_(row.Last_Name || "");
  var name = (firstName + " " + lastName).trim();
  var effectiveEmail = stageAggregationEffectiveEmail_(row);
  var hasValidEmail = stageAggregationIsValidEmail_(effectiveEmail);
  var phoneFallbackInfo = typeof normalizePngWhatsAppPhone_ === "function"
    ? normalizePngWhatsAppPhone_(getWhatsAppFallbackPhoneRaw_(row))
    : { ok: !!clean_(getWhatsAppFallbackPhoneRaw_(row) || "") };
  var hasPhoneFallback = phoneFallbackInfo && phoneFallbackInfo.ok === true;
  var isUncontactable = !hasValidEmail && !hasPhoneFallback;
  var emailIssue = adminOpsHasEmailIssue_(row);
  var uploadSummary = adminOpsRequiredDocumentUploadSummary_(row);
  var docsVerified = adminDocumentReviewVerifiedForAutomation_(row);
  var portalSubmitted = adminRowPortalSubmitted_(row);
  var paymentFacts = adminRowPaymentAuthorityFacts_(row);
  var paymentEvidencePresent = paymentFacts.paymentEvidencePresent;
  var paymentBadge = paymentFacts.paymentBadge;
  var paymentVerified = paymentFacts.paymentVerified;
  var enrolled = isYes_(row.Registration_Complete) || isYes_(row.Enrolled_Confirmed) || !!clean_(row.Enrolled_At || "");
  var lifecycleStage = clean_(deriveApplicantLifecycleStage_(row) || deriveOperationalPipelineStage_(row) || "UNKNOWN").toUpperCase();
  var canonicalLifecycle = resolveCanonicalApplicantLifecycle_(row, {
    uploadSummary: uploadSummary,
    paymentFacts: paymentFacts,
    portalSubmitted: portalSubmitted,
    docsVerified: docsVerified
  });
  var lifecycleMismatch = compareLegacyCanonicalLifecycle_(lifecycleStage, canonicalLifecycle);
  var documentState = adminOpsDocumentStateFromRow_(row);
  var dateInfo = actionabilityPreviewDateInfo_(row);
  var lastContactAgeDays = actionabilityPreviewLastContactAgeDays_(row);
  var nextActionTs = parseTime_(row.Email_Next_Action_Date || "");
  var cooldownActive = nextActionTs > Date.now();
  var postDocsMissingSentCoolingOff = cooldownActive
    && clean_(row.Last_Contact_Type || "").toLowerCase() === "docs_missing"
    && clean_(row.Last_Contact_Result || "").toUpperCase() === "SENT";
  var owner = "NONE";
  var nextAction = "NO_ACTION";
  var recommendedMessageType = "";
  var suppressor = "";
  var explanation = "";

  if (!hasValidEmail) suppressor = "NO_EFFECTIVE_EMAIL";
  else if (emailIssue) suppressor = "EMAIL_BLOCKED_OR_BOUNCED";
  else if (postDocsMissingSentCoolingOff || cooldownActive) suppressor = "COOLDOWN_ACTIVE";

  if (enrolled) {
    owner = "NONE";
    nextAction = "NO_ACTION";
    suppressor = suppressor || "COMPLETED_OR_ENROLLED";
    explanation = "Application appears enrolled or complete; no actionability recommendation is made.";
  } else if (!hasValidEmail) {
    owner = "ADMIN";
    nextAction = "FIX_CONTACT_DETAILS";
    explanation = "Applicant action cannot proceed because no valid effective email is available.";
  } else if (!portalSubmitted || !uploadSummary.requiredDocumentUploadComplete) {
    owner = "APPLICANT";
    nextAction = "UPLOAD_REQUIRED_DOCUMENTS";
    recommendedMessageType = suppressor ? "" : (Number(lastContactAgeDays || 0) >= 14 ? "document_completion_escalation" : "document_completion_reminder");
    explanation = "Mandatory upload completeness authority shows missing required document evidence.";
  } else if (!docsVerified) {
    owner = "OFFICER";
    nextAction = "REVIEW_DOCUMENTS";
    suppressor = suppressor || "OFFICER_ACTION_PENDING";
    explanation = "Mandatory uploads are present, but document review authority is not verified.";
  } else if (!paymentEvidencePresent && !paymentVerified) {
    owner = "APPLICANT";
    nextAction = "SEND_PAYMENT_REMINDER";
    recommendedMessageType = suppressor ? "" : (Number(lastContactAgeDays || 0) >= 14 ? "payment_escalation" : "payment_reminder");
    explanation = "Document review is verified, but payment evidence is not present.";
  } else if (paymentEvidencePresent && !paymentVerified) {
    owner = "FINANCE";
    nextAction = "VERIFY_PAYMENT";
    suppressor = suppressor || "FINANCE_ACTION_PENDING";
    explanation = "Payment evidence is present, but payment authority has not verified it.";
  } else if (docsVerified && paymentVerified) {
    owner = "ADMIN";
    nextAction = "ENROLL";
    suppressor = suppressor || "ADMIN_ACTION_PENDING";
    explanation = "Document and payment authorities appear satisfied; enrollment/admin completion is next.";
  }

  if (suppressor === "COOLDOWN_ACTIVE") recommendedMessageType = "";
  var urgency = actionabilityPreviewUrgency_(owner, nextAction, dateInfo, suppressor, cooldownActive);
  if (isUncontactable) {
    urgency = { level: "UNCONTACTABLE", reason: "No valid email or phone fallback is available." };
  }
  var actionabilityState = resolveActionabilityState_({
    owner: owner,
    nextAction: nextAction,
    suppressor: suppressor,
    lifecycleStage: lifecycleStage,
    recommendedMessageType: recommendedMessageType,
    canonicalRecommendedMessageType: canonicalLifecycle && canonicalLifecycle.recommendedMessageType || "",
    coolingOffUntil: row.Email_Next_Action_Date || ""
  });
  var communicationProgress = actionabilityWorkloadExplanationForRow_({
    actionabilityState: actionabilityState.actionabilityState,
    reasonCode: actionabilityState.reasonCode,
    nextAction: nextAction,
    recommendedAction: actionabilityState.recommendedAction,
    recommendedMessageType: recommendedMessageType,
    lastRelevantDate: dateInfo.value,
    lastContactAgeDays: lastContactAgeDays,
    authorityState: {
      uploadedRequiredDocumentCount: Number(uploadSummary.uploadedRequiredCount || 0),
      requiredDocumentCount: Number(uploadSummary.requiredCount || 0)
    }
  });
  var worklistProjection = actionabilityWorklistProjection_({
    nextAction: nextAction,
    authorityState: {
      paymentEvidencePresent: paymentEvidencePresent,
      paymentVerified: paymentVerified,
      docsVerified: docsVerified
    }
  });
  return {
    rowNumber: rowNumber,
    applicantId: applicantId,
    name: name,
    actionOwner: owner,
    workloadGroupKey: actionabilityWorkloadGroupKey_({ actionOwner: owner, nextAction: nextAction, urgencyLevel: urgency.level, suppressor: suppressor }),
    worklistKey: clean_(worklistProjection.worklistKey || ""),
    worklistLabel: clean_(worklistProjection.worklistLabel || ""),
    worklistReason: clean_(worklistProjection.worklistReason || ""),
    nextAction: nextAction,
    actionabilityState: actionabilityState.actionabilityState,
    selectable: actionabilityState.selectable === true,
    selectBlockReason: actionabilityState.selectBlockReason,
    coolingOffUntil: actionabilityState.coolingOffUntil,
    recommendedAction: actionabilityState.recommendedAction,
    reasonCode: actionabilityState.reasonCode,
    urgencyLevel: urgency.level,
    urgencyReason: urgency.reason,
    suppressor: suppressor,
    recommendedMessageType: recommendedMessageType,
    communicationProgress: communicationProgress,
    communicationProgressDetail: actionabilityState.selectable === true
      ? "Ready for batch preview; Communication Authority remains the send gate."
      : (actionabilityState.selectBlockReason || explanation || communicationProgress),
    canonicalLifecycle: {
      baseState: clean_(canonicalLifecycle && canonicalLifecycle.baseState || "UNKNOWN").toUpperCase(),
      lifecycleStage: clean_(canonicalLifecycle && canonicalLifecycle.lifecycleStage || "UNKNOWN").toUpperCase(),
      overlays: Array.isArray(canonicalLifecycle && canonicalLifecycle.overlays) ? canonicalLifecycle.overlays.slice() : [],
      recommendedNextAction: clean_(canonicalLifecycle && canonicalLifecycle.recommendedNextAction || ""),
      recommendedMessageType: clean_(canonicalLifecycle && canonicalLifecycle.recommendedMessageType || ""),
      actionOwner: clean_(canonicalLifecycle && canonicalLifecycle.actionOwner || ""),
      reason: clean_(canonicalLifecycle && canonicalLifecycle.reason || "")
    },
    lifecycleMismatch: {
      hasLifecycleMismatch: lifecycleMismatch.hasLifecycleMismatch === true,
      legacyLifecycle: clean_(lifecycleMismatch.legacyLifecycle || ""),
      canonicalBaseState: clean_(lifecycleMismatch.canonicalBaseState || ""),
      canonicalOverlays: Array.isArray(lifecycleMismatch.canonicalOverlays) ? lifecycleMismatch.canonicalOverlays.slice() : [],
      mismatchReason: clean_(lifecycleMismatch.mismatchReason || "")
    },
    explanation: explanation,
    lastRelevantDate: dateInfo.value,
    lastRelevantDateSource: dateInfo.source,
    ageDays: dateInfo.ageDays,
    lastContactAgeDays: lastContactAgeDays,
    sourceAuthorities: [
      "Document Completeness: adminOpsRequiredDocumentUploadSummary_",
      "Document Review: computeDocVerificationStatus_",
      "Lifecycle: deriveApplicantLifecycleStage_",
      "Payment: Receipt_Status/Fee_Receipt_File canonical row facts",
      "Communication: Last_Contact_* / Email_* row facts"
    ],
    authorityState: {
      lifecycleStage: lifecycleStage,
      documentState: documentState,
      requiredDocumentUploadComplete: !!uploadSummary.requiredDocumentUploadComplete,
      uploadedRequiredDocumentCount: Number(uploadSummary.uploadedRequiredCount || 0),
      requiredDocumentCount: Number(uploadSummary.requiredCount || 0),
      missingRequiredDocuments: uploadSummary.missingRequiredDocuments || [],
      docsVerified: !!docsVerified,
      portalSubmitted: !!portalSubmitted,
      paymentEvidencePresent: !!paymentEvidencePresent,
      paymentVerified: !!paymentVerified,
      hasValidEmail: !!hasValidEmail,
      hasPhoneFallback: !!hasPhoneFallback,
      contactabilityState: isUncontactable ? "UNCONTACTABLE" : (hasValidEmail ? "EMAIL_AVAILABLE" : "PHONE_FALLBACK_AVAILABLE")
    }
  };
}

function compareActionabilityPreviewRows_(a, b) {
  var order = { UNCONTACTABLE: 1, DORMANT: 2, ESCALATED: 3, OVERDUE: 4, DUE: 5, NORMAL: 6 };
  var aRank = order[clean_(a && a.urgencyLevel || "").toUpperCase()] || 99;
  var bRank = order[clean_(b && b.urgencyLevel || "").toUpperCase()] || 99;
  if (aRank !== bRank) return aRank - bRank;
  return Number(b && b.ageDays || 0) - Number(a && a.ageDays || 0);
}

function actionabilityWorkloadGroupKey_(row) {
  var r = row || {};
  var urgency = clean_(r.urgencyLevel || "").toUpperCase();
  var owner = clean_(r.actionOwner || r.owner || "").toUpperCase();
  var suppressor = clean_(r.suppressor || "").toUpperCase();
  var nextAction = clean_(r.nextAction || "").toUpperCase();
  if (owner === "NONE" || nextAction === "NO_ACTION") return "COMPLETE";
  if (urgency === "DORMANT") return "DORMANT";
  if (suppressor === "NO_EFFECTIVE_EMAIL" || suppressor === "EMAIL_BLOCKED_OR_BOUNCED") return "CONTACTABILITY";
  if (nextAction === "SEND_PAYMENT_REMINDER" || nextAction === "VERIFY_PAYMENT") return "FINANCE";
  if (owner === "APPLICANT") return "APPLICANT";
  if (owner === "OFFICER") return "ADMISSIONS";
  if (owner === "FINANCE") return "FINANCE";
  if (owner === "ADMIN") return "ACADEMIC";
  if (owner === "SYSTEM") return "MANAGEMENT";
  return "UNKNOWN";
}

function actionabilityWorklistProjection_(row) {
  var r = row || {};
  var nextAction = clean_(r.nextAction || "").toUpperCase();
  var authority = r.authorityState || {};
  if (nextAction === "SEND_PAYMENT_REMINDER") {
    return {
      worklistKey: "PAYMENT_FOLLOW_UP",
      worklistLabel: "Payment Follow-up",
      worklistReason: "Awaiting payment evidence"
    };
  }
  if (nextAction === "VERIFY_PAYMENT") {
    return {
      worklistKey: "PAYMENT_REVIEW",
      worklistLabel: "Payment Review",
      worklistReason: authority.paymentEvidencePresent === true ? "Receipt pending verification" : "Finance verification required"
    };
  }
  if (nextAction === "UPLOAD_REQUIRED_DOCUMENTS") {
    return {
      worklistKey: "DOCUMENT_FOLLOW_UP",
      worklistLabel: "Missing Documents",
      worklistReason: "Awaiting applicant upload"
    };
  }
  if (nextAction === "REVIEW_DOCUMENTS") {
    return {
      worklistKey: "DOCUMENT_REVIEW",
      worklistLabel: "Document Review",
      worklistReason: "Required uploads are ready for review"
    };
  }
  if (nextAction === "FIX_CONTACT_DETAILS") {
    return {
      worklistKey: "CONTACTABILITY_EXCEPTION",
      worklistLabel: "Contactability Exception",
      worklistReason: "No effective contact path"
    };
  }
  if (nextAction === "ENROLL") {
    return {
      worklistKey: "ENROLMENT_COMPLETION",
      worklistLabel: "Academic Administration",
      worklistReason: "Ready for enrolment completion"
    };
  }
  return {
    worklistKey: clean_(nextAction || "UNKNOWN"),
    worklistLabel: clean_(nextAction || "Unknown").replace(/_/g, " "),
    worklistReason: ""
  };
}

function actionabilityPreviewGroupKey_(row) {
  return actionabilityWorkloadGroupKey_(row);
}

function actionabilityHiddenReasonForGroup_(groupKey) {
  var key = clean_(groupKey || "").toUpperCase();
  if (key === "COMPLETE") return "COMPLETED_NO_ACTION";
  if (key === "DORMANT") return "DORMANT";
  if (key === "UNKNOWN") return "UNKNOWN";
  if (key === "ACADEMIC" || key === "ADMISSIONS" || key === "FINANCE" || key === "MANAGEMENT" || key === "CONTACTABILITY") return "OTHER_AUTHORITY";
  return "FILTERED_BY_WORKLIST";
}

function actionabilityHiddenSuggestedAction_(groupKey, row) {
  var key = clean_(groupKey || "").toUpperCase();
  if (key === "COMPLETE") return "Explain Only";
  if (key === "DORMANT") return "Open Applicant";
  if (key === "UNKNOWN") return "Open Applicant";
  if (key === "FINANCE") return "Open Applicant";
  if (key === "ADMISSIONS" || key === "ACADEMIC" || key === "MANAGEMENT" || key === "CONTACTABILITY") return "Open Applicant";
  return clean_(row && row.nextAction || "").toUpperCase() === "NO_ACTION" ? "Explain Only" : "Switch Filter";
}

function actionabilityPopulationBucketForGroupKey_(groupKey) {
  var key = clean_(groupKey || "").toUpperCase();
  if (key === "APPLICANT") return "Applicant Action";
  if (key === "ADMISSIONS") return "Admissions Review";
  if (key === "FINANCE") return "Finance";
  if (key === "ACADEMIC") return "Academic Admin";
  if (key === "CONTACTABILITY") return "Contactability Exceptions";
  if (key === "MANAGEMENT") return "Management Exceptions";
  if (key === "DORMANT") return "Dormant";
  if (key === "COMPLETE") return "Completed / No Action";
  return "Unknown / Unclassified";
}

function actionabilityDisplayRowsForGroup_(groupKey, rows) {
  var key = clean_(groupKey || "").toUpperCase();
  var list = Array.isArray(rows) ? rows.slice() : [];
  if (key === "APPLICANT") {
    return list.filter(function (row) {
      return row && row.selectable === true && clean_(row.actionabilityState || "").toUpperCase() === "READY";
    });
  }
  return list;
}

function actionabilityBucketSummarySkeleton_(groupKey) {
  return {
    groupKey: groupKey,
    populationBucket: actionabilityPopulationBucketForGroupKey_(groupKey),
    totalRows: 0,
    visibleCount: 0,
    eligibleNowCount: 0,
    coolingOffCount: 0,
    hiddenCount: 0,
    hiddenByWindowCount: 0,
    oldestVisibleAgeDays: "",
    nextAction: "NO_ACTION"
  };
}

function buildActionabilityBucketSummaries_(rows, visibleRows, ledger, hiddenRecords) {
  var allRows = Array.isArray(rows) ? rows : [];
  var boundedRows = Array.isArray(visibleRows) ? visibleRows : [];
  var keys = ["APPLICANT", "ADMISSIONS", "FINANCE", "ACADEMIC", "CONTACTABILITY", "MANAGEMENT", "DORMANT", "COMPLETE", "UNKNOWN"];
  var counts = ledger && ledger.operationalBucketCounts && typeof ledger.operationalBucketCounts === "object"
    ? ledger.operationalBucketCounts
    : {};
  var hiddenTotals = hiddenRecords && hiddenRecords.totalByGroup && typeof hiddenRecords.totalByGroup === "object"
    ? hiddenRecords.totalByGroup
    : {};
  var summaries = {};
  var allByGroup = {};
  var visibleByGroup = {};
  keys.forEach(function (key) {
    summaries[key] = actionabilityBucketSummarySkeleton_(key);
    allByGroup[key] = [];
    visibleByGroup[key] = [];
  });
  allRows.forEach(function (row) {
    var key = actionabilityPreviewGroupKey_(row);
    if (!summaries[key]) summaries[key] = actionabilityBucketSummarySkeleton_(key);
    if (!allByGroup[key]) allByGroup[key] = [];
    allByGroup[key].push(row);
    summaries[key].totalRows++;
    if (row && row.selectable === true && clean_(row.actionabilityState || "").toUpperCase() === "READY") {
      summaries[key].eligibleNowCount++;
    }
    if (clean_(row && row.actionabilityState || "").toUpperCase() === "COOLING_OFF") {
      summaries[key].coolingOffCount++;
    }
  });
  boundedRows.forEach(function (row) {
    var key = actionabilityPreviewGroupKey_(row);
    if (!visibleByGroup[key]) visibleByGroup[key] = [];
    visibleByGroup[key].push(row);
  });
  Object.keys(summaries).forEach(function (key) {
    var summary = summaries[key];
    var bucket = summary.populationBucket;
    var ledgerPopulation = Number(counts[bucket]);
    var populationCount = Number.isFinite(ledgerPopulation) ? ledgerPopulation : Number(summary.totalRows || 0);
    var displayRows = actionabilityDisplayRowsForGroup_(key, visibleByGroup[key] || []);
    var oldestVisible = "";
    displayRows.forEach(function (row) {
      var age = Number(row && row.ageDays);
      if (Number.isFinite(age) && (oldestVisible === "" || age > Number(oldestVisible))) oldestVisible = age;
    });
    summary.populationCount = populationCount;
    summary.visibleCount = displayRows.length;
    summary.hiddenByWindowCount = Number(hiddenTotals[key] || 0);
    summary.oldestVisibleAgeDays = oldestVisible;
    summary.nextAction = clean_((displayRows[0] && displayRows[0].nextAction) || ((visibleByGroup[key] || [])[0] && (visibleByGroup[key] || [])[0].nextAction) || "NO_ACTION").toUpperCase() || "NO_ACTION";
    summary.hiddenCount = key === "APPLICANT"
      ? Math.max(0, populationCount - Number(summary.eligibleNowCount || 0) - Number(summary.coolingOffCount || 0))
      : Math.max(0, populationCount - Number(summary.visibleCount || 0));
  });
  return summaries;
}

function buildActionabilityWorklistSummary_(rows, visibleRows, limit) {
  var allRows = Array.isArray(rows) ? rows : [];
  var boundedRows = Array.isArray(visibleRows) ? visibleRows : [];
  return {
    totalRows: allRows.length,
    returnedRows: boundedRows.length,
    boundedRows: boundedRows.length,
    limit: Math.max(1, Number(limit || 0) || 0)
  };
}

function buildActionabilityHiddenRecords_(rows, visibleRows, perBucketLimit) {
  var limit = Math.max(1, Math.min(10, Number(perBucketLimit || 5)));
  var visible = {};
  (Array.isArray(visibleRows) ? visibleRows : []).forEach(function(row) {
    var key = clean_(row && (row.applicantId || row.rowNumber) || "");
    if (key) visible[key] = true;
  });
  var out = { perBucketLimit: limit, byGroup: {}, totalByGroup: {} };
  (Array.isArray(rows) ? rows : []).forEach(function(row) {
    var key = clean_(row && (row.applicantId || row.rowNumber) || "");
    if (!key || visible[key]) return;
    var groupKey = actionabilityPreviewGroupKey_(row);
    out.totalByGroup[groupKey] = Number(out.totalByGroup[groupKey] || 0) + 1;
    if (!out.byGroup[groupKey]) out.byGroup[groupKey] = [];
    if (out.byGroup[groupKey].length >= limit) return;
    out.byGroup[groupKey].push({
      rowNumber: Number(row.rowNumber || 0) || 0,
      applicantId: clean_(row.applicantId || ""),
      name: clean_(row.name || ""),
      currentStage: clean_((row.authorityState && row.authorityState.lifecycleStage) || ""),
      currentBucket: groupKey,
      hiddenReason: actionabilityHiddenReasonForGroup_(groupKey),
      suggestedAction: actionabilityHiddenSuggestedAction_(groupKey, row),
      actionOwner: clean_(row.actionOwner || ""),
      nextAction: clean_(row.nextAction || ""),
      urgencyLevel: clean_(row.urgencyLevel || ""),
      suppressor: clean_(row.suppressor || ""),
      recommendedMessageType: clean_(row.recommendedMessageType || ""),
      ageDays: row.ageDays,
      lastContactAgeDays: row.lastContactAgeDays,
      authorityState: row.authorityState || {}
    });
  });
  return out;
}

function lifecycleDriftEmptySummary_() {
  return {
    totalRows: 0,
    mismatchCount: 0,
    mismatchByLegacyStage: {},
    mismatchByCanonicalBaseState: {},
    topMismatchReasons: []
  };
}

function lifecycleDriftIncrement_(map, key) {
  var target = map && typeof map === "object" ? map : {};
  var normalized = clean_(key || "UNKNOWN").toUpperCase() || "UNKNOWN";
  target[normalized] = Number(target[normalized] || 0) + 1;
  return target;
}

function lifecycleDriftRecordReason_(summary, reason) {
  var s = summary && typeof summary === "object" ? summary : lifecycleDriftEmptySummary_();
  var label = clean_(reason || "Unspecified lifecycle mismatch.");
  var reasons = Array.isArray(s.topMismatchReasons) ? s.topMismatchReasons : [];
  var found = false;
  for (var i = 0; i < reasons.length; i++) {
    if (clean_(reasons[i] && reasons[i].reason || "") === label) {
      reasons[i].count = Number(reasons[i].count || 0) + 1;
      found = true;
      break;
    }
  }
  if (!found) reasons.push({ reason: label, count: 1 });
  reasons.sort(function(a, b) {
    return Number(b && b.count || 0) - Number(a && a.count || 0);
  });
  s.topMismatchReasons = reasons.slice(0, 5);
  return s;
}

function lifecycleDriftRecord_(summary, mismatch) {
  var s = summary && typeof summary === "object" ? summary : lifecycleDriftEmptySummary_();
  var m = mismatch && typeof mismatch === "object" ? mismatch : {};
  s.totalRows = Number(s.totalRows || 0) + 1;
  if (m.hasLifecycleMismatch !== true) return s;
  s.mismatchCount = Number(s.mismatchCount || 0) + 1;
  s.mismatchByLegacyStage = lifecycleDriftIncrement_(s.mismatchByLegacyStage, m.legacyLifecycle);
  s.mismatchByCanonicalBaseState = lifecycleDriftIncrement_(s.mismatchByCanonicalBaseState, m.canonicalBaseState);
  return lifecycleDriftRecordReason_(s, m.mismatchReason);
}

function admin_getActionabilityPreview(payload) {
  var adminEmail = getCallerEmail_();
  if (!isAdmin_(adminEmail)) throw new Error("Access denied");
  var p = payload && typeof payload === "object" ? payload : {};
  var limit = Math.max(1, Math.min(100, Number(p.limit || 40)));
  var sheet = openDataSheet_();
  var data = sheet.getDataRange().getValues();
  var ledger = buildPopulationLedgerFromValues_(data, sheet && typeof sheet.getName === "function" ? sheet.getName() : "", { includeEntries: false });
  var out = {
    ok: true,
    readOnly: true,
    experimental: true,
    generatedAt: new Date().toISOString(),
    limit: limit,
    scannedRows: Math.max(0, (data || []).length - 1),
    includedRows: 0,
    countsByOwner: { APPLICANT: 0, OFFICER: 0, FINANCE: 0, ADMIN: 0, SYSTEM: 0, NONE: 0 },
    workloadSummary: { READY: 0, COOLING_OFF: 0, AWAITING_APPLICANT: 0, AWAITING_PAYMENT: 0, REVIEW_REQUIRED: 0, COMPLETE: 0, UNKNOWN: 0 },
    workloadExplanation: actionabilityWorkloadExplanationEmpty_(),
    lifecycleDriftSummary: lifecycleDriftEmptySummary_(),
    populationLedger: populationLedgerPublicSummary_(ledger),
    bucketSummaries: {},
    worklistSummary: { totalRows: 0, returnedRows: 0, boundedRows: 0, limit: limit },
    rows: [],
    hiddenRecords: { perBucketLimit: 5, byGroup: {}, totalByGroup: {} }
  };
  if (!data || data.length < 2) return out;
  var headers = data[0] || [];
  var rows = [];
  for (var r = 1; r < data.length; r++) {
    var rowValues = data[r] || [];
    var rowObj = {};
    for (var c = 0; c < headers.length; c++) {
      var h = clean_(headers[c]);
      if (h) rowObj[h] = rowValues[c];
    }
    if (!clean_(rowObj.ApplicantID || "")) continue;
    var item = buildActionabilityPreviewRow_(rowObj, r + 1);
    var owner = clean_(item.actionOwner || "NONE").toUpperCase() || "NONE";
    if (!Object.prototype.hasOwnProperty.call(out.countsByOwner, owner)) out.countsByOwner[owner] = 0;
    out.countsByOwner[owner]++;
    var state = clean_(item.actionabilityState || "UNKNOWN").toUpperCase() || "UNKNOWN";
    if (!Object.prototype.hasOwnProperty.call(out.workloadSummary, state)) out.workloadSummary[state] = 0;
    out.workloadSummary[state]++;
    out.workloadExplanation = incrementActionabilityWorkloadExplanation_(out.workloadExplanation, item.communicationProgress);
    out.lifecycleDriftSummary = lifecycleDriftRecord_(out.lifecycleDriftSummary, item.lifecycleMismatch);
    rows.push(item);
  }
  rows.sort(compareActionabilityPreviewRows_);
  out.includedRows = rows.length;
  out.rows = rows.slice(0, limit);
  out.hiddenRecords = buildActionabilityHiddenRecords_(rows, out.rows, p.hiddenLimit || 5);
  out.bucketSummaries = buildActionabilityBucketSummaries_(rows, out.rows, ledger, out.hiddenRecords);
  out.worklistSummary = buildActionabilityWorklistSummary_(rows, out.rows, limit);
  return out;
}

function populationLedgerBucketNames_() {
  return [
    "Applicant Action",
    "Admissions Review",
    "Finance",
    "Academic Admin",
    "Contactability Exceptions",
    "Management Exceptions",
    "Dormant",
    "Completed / No Action",
    "Unknown / Unclassified"
  ];
}

function populationLedgerEmptyBucketCounts_() {
  var out = {};
  var names = populationLedgerBucketNames_();
  for (var i = 0; i < names.length; i++) out[names[i]] = 0;
  return out;
}

function populationLedgerRowObjectFromValues_(headers, values) {
  var rowObj = {};
  var head = Array.isArray(headers) ? headers : [];
  var vals = Array.isArray(values) ? values : [];
  for (var c = 0; c < head.length; c++) {
    var h = clean_(head[c]);
    if (h) rowObj[h] = vals[c];
  }
  return rowObj;
}

function populationLedgerNextActionFamily_(nextAction) {
  var action = clean_(nextAction || "").toUpperCase();
  if (!action) return "UNKNOWN";
  if (action === "NO_ACTION") return "NO_ACTION";
  if (action === "UPLOAD_REQUIRED_DOCUMENTS" || action === "SEND_PAYMENT_REMINDER") return "APPLICANT_ACTION";
  if (action === "REVIEW_DOCUMENTS") return "ADMISSIONS_REVIEW";
  if (action === "VERIFY_PAYMENT") return "FINANCE";
  if (action === "ENROLL") return "ACADEMIC_ADMIN";
  if (action === "FIX_CONTACT_DETAILS") return "CONTACTABILITY_EXCEPTION";
  return "MANAGEMENT_EXCEPTION";
}

function populationLedgerBucketFromActionability_(item) {
  var row = item || {};
  var owner = clean_(row.actionOwner || "").toUpperCase();
  var nextAction = clean_(row.nextAction || "").toUpperCase();
  if (!owner || !nextAction) return { bucket: "Unknown / Unclassified", reason: "Missing actionability owner or next action." };
  var groupKey = actionabilityWorkloadGroupKey_(row);
  var bucket = actionabilityPopulationBucketForGroupKey_(groupKey);
  if (bucket && bucket !== "Unknown / Unclassified") return { bucket: bucket, reason: "" };
  return { bucket: "Unknown / Unclassified", reason: "Unrecognized workload group: " + groupKey };
}

function populationLedgerClassifyRow_(rowObj, rowNumber) {
  var row = rowObj || {};
  var applicantId = clean_(row.ApplicantID || "");
  var entry = {
    rowNumber: rowNumber,
    applicantId: applicantId,
    lifecycleState: "UNKNOWN",
    operationalBucket: "Unknown / Unclassified",
    nextActionFamily: "UNKNOWN",
    actionOwner: "UNKNOWN",
    nextAction: "UNKNOWN",
    urgencyLevel: "UNKNOWN",
    unclassifiedReason: ""
  };

  if (!applicantId) {
    entry.unclassifiedReason = "Missing ApplicantID.";
    return entry;
  }

  try {
    var item = buildActionabilityPreviewRow_(row, rowNumber);
    var bucketInfo = populationLedgerBucketFromActionability_(item);
    entry.lifecycleState = clean_(item && item.authorityState && item.authorityState.lifecycleStage || "UNKNOWN").toUpperCase() || "UNKNOWN";
    entry.operationalBucket = bucketInfo.bucket;
    entry.nextActionFamily = populationLedgerNextActionFamily_(item && item.nextAction);
    entry.actionOwner = clean_(item && item.actionOwner || "UNKNOWN").toUpperCase() || "UNKNOWN";
    entry.nextAction = clean_(item && item.nextAction || "UNKNOWN").toUpperCase() || "UNKNOWN";
    entry.urgencyLevel = clean_(item && item.urgencyLevel || "UNKNOWN").toUpperCase() || "UNKNOWN";
    entry.unclassifiedReason = bucketInfo.reason || "";
  } catch (err) {
    entry.unclassifiedReason = "Actionability resolver failed: " + (err && err.message ? err.message : String(err));
  }

  if (entry.lifecycleState === "UNKNOWN" || entry.operationalBucket === "Unknown / Unclassified" || entry.nextActionFamily === "UNKNOWN") {
    entry.unclassifiedReason = entry.unclassifiedReason || "Lifecycle, operational bucket, or next action family is unknown.";
  }
  return entry;
}

function populationLedgerPublicSummary_(ledger) {
  var src = ledger || {};
  return {
    ok: src.ok === true,
    readOnly: true,
    generatedAt: clean_(src.generatedAt || ""),
    sourceSheetName: clean_(src.sourceSheetName || ""),
    scannedRows: Number(src.scannedRows || 0),
    applicantIdRows: Number(src.applicantIdRows || 0),
    classifiedRows: Number(src.classifiedRows || 0),
    unclassifiedRows: Number(src.unclassifiedRows || 0),
    duplicateApplicantIds: Array.isArray(src.duplicateApplicantIds) ? src.duplicateApplicantIds.slice() : [],
    hiddenByLimit: 0,
    lifecycleCounts: Object.assign({}, src.lifecycleCounts || {}),
    operationalBucketCounts: Object.assign({}, src.operationalBucketCounts || {}),
    nextActionFamilyCounts: Object.assign({}, src.nextActionFamilyCounts || {}),
    unknownUnclassifiedCount: Number(src.unknownUnclassifiedCount || 0),
    sampleUnclassifiedRows: Array.isArray(src.sampleUnclassifiedRows) ? src.sampleUnclassifiedRows.slice() : [],
    integrityStatus: clean_(src.integrityStatus || "FAIL"),
    integrityMessages: Array.isArray(src.integrityMessages) ? src.integrityMessages.slice() : []
  };
}

function buildPopulationLedgerFromValues_(data, sourceSheetName, opts) {
  var options = opts && typeof opts === "object" ? opts : {};
  var sampleLimit = Math.max(1, Math.min(25, Number(options.sampleLimit || 10)));
  var includeEntries = options.includeEntries !== false;
  var out = {
    ok: true,
    readOnly: true,
    generatedAt: new Date().toISOString(),
    sourceSheetName: clean_(sourceSheetName || ""),
    scannedRows: Math.max(0, (data || []).length - 1),
    applicantIdRows: 0,
    classifiedRows: 0,
    unclassifiedRows: 0,
    duplicateApplicantIds: [],
    hiddenByLimit: 0,
    lifecycleCounts: {},
    operationalBucketCounts: populationLedgerEmptyBucketCounts_(),
    nextActionFamilyCounts: {},
    unknownUnclassifiedCount: 0,
    sampleUnclassifiedRows: [],
    entries: [],
    integrityStatus: "PASS",
    integrityMessages: []
  };

  if (!data || data.length < 2) {
    out.integrityMessages.push("No applicant data rows found.");
    return out;
  }

  var headers = data[0] || [];
  var applicantRowsById = {};
  for (var r = 1; r < data.length; r++) {
    var rowObj = populationLedgerRowObjectFromValues_(headers, data[r] || []);
    var applicantId = clean_(rowObj.ApplicantID || "");
    if (!applicantId) continue;

    out.applicantIdRows++;
    if (!applicantRowsById[applicantId]) applicantRowsById[applicantId] = [];
    applicantRowsById[applicantId].push(r + 1);

    var entry = populationLedgerClassifyRow_(rowObj, r + 1);
    if (includeEntries) out.entries.push(entry);

    out.lifecycleCounts[entry.lifecycleState] = Number(out.lifecycleCounts[entry.lifecycleState] || 0) + 1;
    if (!Object.prototype.hasOwnProperty.call(out.operationalBucketCounts, entry.operationalBucket)) {
      out.operationalBucketCounts[entry.operationalBucket] = 0;
    }
    out.operationalBucketCounts[entry.operationalBucket]++;
    out.nextActionFamilyCounts[entry.nextActionFamily] = Number(out.nextActionFamilyCounts[entry.nextActionFamily] || 0) + 1;

    if (entry.operationalBucket === "Unknown / Unclassified" || entry.lifecycleState === "UNKNOWN" || entry.nextActionFamily === "UNKNOWN") {
      out.unclassifiedRows++;
      if (out.sampleUnclassifiedRows.length < sampleLimit) {
        out.sampleUnclassifiedRows.push({
          rowNumber: entry.rowNumber,
          applicantId: entry.applicantId,
          lifecycleState: entry.lifecycleState,
          operationalBucket: entry.operationalBucket,
          nextActionFamily: entry.nextActionFamily,
          reason: entry.unclassifiedReason
        });
      }
    } else {
      out.classifiedRows++;
    }
  }

  var ids = Object.keys(applicantRowsById);
  for (var i = 0; i < ids.length; i++) {
    var id = ids[i];
    if (applicantRowsById[id].length > 1) {
      out.duplicateApplicantIds.push({ applicantId: id, rowNumbers: applicantRowsById[id] });
    }
  }

  out.unknownUnclassifiedCount = out.unclassifiedRows;
  var bucketTotal = 0;
  var bucketNames = Object.keys(out.operationalBucketCounts);
  for (var b = 0; b < bucketNames.length; b++) bucketTotal += Number(out.operationalBucketCounts[bucketNames[b]] || 0);

  if (includeEntries && out.entries.length !== out.applicantIdRows) {
    out.integrityStatus = "FAIL";
    out.integrityMessages.push("Ledger entry count does not equal ApplicantID row count.");
  }
  if (bucketTotal !== out.applicantIdRows) {
    out.integrityStatus = "FAIL";
    out.integrityMessages.push("Operational bucket counts do not sum to ApplicantID row count.");
  }
  if (out.unclassifiedRows > 0 && out.integrityStatus !== "FAIL") {
    out.integrityStatus = "WARN";
    out.integrityMessages.push("Unknown / Unclassified applicant rows are present.");
  }
  if (out.duplicateApplicantIds.length > 0 && out.integrityStatus !== "FAIL") {
    out.integrityStatus = "WARN";
    out.integrityMessages.push("Duplicate ApplicantID values are present.");
  }
  if (out.integrityMessages.length === 0) out.integrityMessages.push("Population ledger reconciles.");
  return out;
}

function admin_getPopulationLedger(payload) {
  var adminEmail = getCallerEmail_();
  if (!isAdmin_(adminEmail)) throw new Error("Access denied");
  var p = payload && typeof payload === "object" ? payload : {};
  var sheet = openDataSheet_();
  var data = sheet.getDataRange().getValues();
  var sourceSheetName = sheet && typeof sheet.getName === "function"
    ? clean_(sheet.getName() || "")
    : clean_(typeof CONFIG !== "undefined" && CONFIG && (CONFIG.DATA_SHEET || CONFIG.SHEET_NAME_WORKING) || "");
  return buildPopulationLedgerFromValues_(data, sourceSheetName, {
    sampleLimit: p.sampleLimit,
    includeEntries: p.includeEntries !== false
  });
}

// Review queue page metadata helper lives in Admin_ReviewQueues.js.

// Stage priority and ordering helpers live in Admin_LifecycleAuthority.js.

function getStageAggregationCacheKey_(adminEmail) {
  return "ADMIN_STAGE_AGG::" + clean_(adminEmail || "").toLowerCase();
}

function stageAggregationRecommendedMessageType_(stage) {
  switch (clean_(stage || "").toUpperCase()) {
    case "INVITE_PENDING":
      return "legacy_invite";
    case "INVITED_AWAITING_RESPONSE":
    case "REMINDER_DUE":
    case "DOCS_REQUIRED":
    case "PAYMENT_REQUIRED":
    case "RECEIPT_AWAITING_VERIFICATION":
      return "reminder";
    default:
      return "";
  }
}

function stageAggregationEffectiveEmail_(rowObj) {
  var row = rowObj || {};
  return clean_(row.Effective_Email || row.Parent_Email_Corrected || row.Parent_Email || "");
}

function stageAggregationIsValidEmail_(email) {
  var value = String(email || "").trim();
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function stageAggregationSnapshot_(rowObj) {
  var row = rowObj || {};
  var stage = deriveApplicantLifecycleStage_(row);
  var actionability = deriveApplicantActionability_(row, stage, {
    getEffectiveEmail: stageAggregationEffectiveEmail_,
    isValidEmail: stageAggregationIsValidEmail_,
    getRecommendedMessageType: stageAggregationRecommendedMessageType_,
    resolveEligibility: false
  });

  return {
    stage: stage,
    priority: mapStagePriority_(stage),
    commStatus: actionability.commStatus,
    canSendNow: actionability.canSendNow
  };
}

function stageBatchTraceFirstDivergence_(info) {
  var data = info && typeof info === "object" ? info : {};
  if (data.stageMatch !== true) {
    return {
      functionName: "collectStageBatchCohort_",
      condition: "snapshot.stage !== selectedStage",
      reason: "Preview excludes the row before resolver checks because the selected stage does not match the row lifecycle stage."
    };
  }
  if (!clean_(data.messageType || "")) {
    return {
      functionName: "collectStageBatchCohort_",
      condition: "!messageType",
      reason: "Preview stage has no supported batch message type."
    };
  }
  if (data.priorSuccessExcluded === true) {
    return {
      functionName: "stageBatchShouldExcludePriorSuccessDefault_",
      condition: "priorSuccessExcluded === true",
      reason: "Preview excludes the row because prior send state already satisfies the durable success rule for this stage/message type."
    };
  }
  if (data.failedExcluded === true) {
    return {
      functionName: "stageBatchShouldExcludeFailedDefault_",
      condition: "failedExcluded === true",
      reason: "Preview excludes the row because prior failure state blocks automatic retry for this message type."
    };
  }
  if (data.resolverEligible !== true) {
    return {
      functionName: "resolveApplicantMessageContextFromRow_",
      condition: clean_(data.resolverBlockCode || "") || "eligible !== true",
      reason: clean_(data.resolverBlockReason || "") || "Resolver marked the row ineligible."
    };
  }
  if (data.dashboardCanSendNow !== true) {
    return {
      functionName: "deriveApplicantActionability_",
      condition: "dashboard canSendNow !== true",
      reason: "Dashboard does not currently classify the row as actionable."
    };
  }
  return {
    functionName: "",
    condition: "",
    reason: "No divergence detected for the selected stage and message type."
  };
}

function admin_traceStageBatchEligibility(payload) {
  var dbgId = makeDebugId_();
  try {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) {
      return {
        ok: false,
        debugId: dbgId,
        code: "ACCESS_DENIED",
        message: "Access denied"
      };
    }
    requireSuperAdmin_(adminEmail);

    var p = payload && typeof payload === "object" ? payload : {};
    var applicantId = clean_(p.applicantId || p.ApplicantID || "");
    var selectedStage = normalizeStageBatchStage_(p.stage || p.selectedStage || "");
    if (!applicantId) {
      return {
        ok: false,
        debugId: dbgId,
        code: "MISSING_APPLICANT_ID",
        message: "ApplicantID is required"
      };
    }

    var sh = openDataSheet_();
    var rowNumber = findRowByApplicantId_(sh, applicantId);
    if (!rowNumber) {
      return {
        ok: false,
        debugId: dbgId,
        code: "APPLICANT_NOT_FOUND",
        message: "Applicant not found",
        applicantId: applicantId
      };
    }

    var rowObj = getRowObject_(sh, rowNumber);
    var dashboardSnapshot = stageAggregationSnapshot_(rowObj);
    var dashboardStage = clean_(dashboardSnapshot.stage || "");
    var comparisonStage = selectedStage || dashboardStage;
    var canonicalLifecycleDiagnostics = typeof stageBatchCanonicalLifecycleDiagnostics_ === "function"
      ? stageBatchCanonicalLifecycleDiagnostics_(rowObj, comparisonStage, dashboardStage)
      : {};
    var messageType = normalizeApplicantMessageType_(getBatchMessageTypeForStage_(comparisonStage) || "");
    var actorRole = getAdminRole_(adminEmail);
    var communicationState = deriveCommunicationState_(rowObj, messageType, {
      applicantId: applicantId
    });
    var baseState = communicationState && communicationState.base ? communicationState.base : {};
    var dashboardActionability = deriveApplicantActionability_(rowObj, dashboardStage, {
      getEffectiveEmail: stageAggregationEffectiveEmail_,
      isValidEmail: stageAggregationIsValidEmail_,
      getRecommendedMessageType: stageAggregationRecommendedMessageType_,
      resolveEligibility: false
    });
    var stageMatch = !comparisonStage || clean_(dashboardStage).toUpperCase() === clean_(comparisonStage).toUpperCase();
    var inviteStatefulFlow = comparisonStage === "INVITE_PENDING" || messageType === "legacy_invite";
    var priorSuccessExcluded = stageMatch && !!messageType && stageBatchShouldExcludePriorSuccessDefault_(rowObj, comparisonStage, messageType);
    var failedExcluded = stageMatch && !!messageType && inviteStatefulFlow && stageBatchShouldExcludeFailedDefault_(rowObj, messageType);
    var resolver = null;
    if (stageMatch && messageType && !priorSuccessExcluded && !failedExcluded) {
      resolver = resolveApplicantMessageContextFromRow_(rowObj, rowNumber, sh, messageType, {
        action: "preview",
        actorEmail: adminEmail,
        actorRole: actorRole,
        applicantId: applicantId,
        debugId: dbgId,
        requestId: dbgId
      });
    }

    var previewIncluded = stageMatch && !!messageType && !priorSuccessExcluded && !failedExcluded && !!(resolver && resolver.eligible);
    var firstDivergence = stageBatchTraceFirstDivergence_({
      stageMatch: stageMatch,
      messageType: messageType,
      priorSuccessExcluded: priorSuccessExcluded,
      failedExcluded: failedExcluded,
      resolverEligible: !!(resolver && resolver.eligible),
      resolverBlockCode: resolver && resolver.blockCode,
      resolverBlockReason: resolver && resolver.blockReason,
      dashboardCanSendNow: dashboardActionability.canSendNow === true
    });

    return {
      ok: true,
      debugId: dbgId,
      helper: "admin_traceStageBatchEligibility",
      readOnly: true,
      superAdminOnly: true,
      applicantId: applicantId,
      rowNumber: Number(rowNumber || 0),
      selectedStage: comparisonStage,
      dashboardPath: [
        "admin_getStageAggregation()",
        "stageAggregationSnapshot_()",
        "deriveApplicantActionability_(..., { resolveEligibility: false })"
      ],
      previewPath: [
        "admin_previewStageBatch()",
        "collectStageBatchCohort_()",
        "resolveApplicantMessageContextFromRow_()"
      ],
      rowState: {
        effectiveEmail: clean_(baseState.effectiveEmail || stageAggregationEffectiveEmail_(rowObj)),
        emailStatus: clean_(rowObj.Email_Status || ""),
        lastContactType: clean_(rowObj.Last_Contact_Type || ""),
        lastContactResult: clean_(rowObj.Last_Contact_Result || ""),
        lastContactedAt: clean_(rowObj.Last_Contacted_At || ""),
        emailNextActionDate: clean_(rowObj.Email_Next_Action_Date || ""),
        bounceFlag: baseState.bounceFlag === true || isCampaignBounceFlagTrue_(rowObj.Email_Bounce_Flag),
        bounceReason: clean_(baseState.bounceReason || rowObj.Email_Bounce_Reason || ""),
        doNotContact: clean_(baseState.emailStatus || normalizeEmailStatus_(rowObj.Email_Status || "")) === "DO_NOT_CONTACT",
        hasEffectiveEmail: baseState.hasEffectiveEmail === true || !!clean_(stageAggregationEffectiveEmail_(rowObj)),
        hasValidEffectiveEmail: baseState.hasValidEffectiveEmail === true || stageAggregationIsValidEmail_(stageAggregationEffectiveEmail_(rowObj)),
        cooldownActive: communicationState.cooldownActive === true,
        cooldownLastSentAt: clean_(communicationState.cooldownLastSentAt || "")
      },
      dashboard: {
        stage: dashboardStage,
        actionableMeaning: "operator_actionable",
        commStatus: clean_(dashboardActionability.commStatus || dashboardSnapshot.commStatus || ""),
        canSendNow: dashboardActionability.canSendNow === true,
        recommendedMessageType: clean_(dashboardActionability.recommendedMessageType || ""),
        actionableReason: dashboardActionability.canSendNow === true
          ? "Dashboard counts this row as operator-actionable under resolveEligibility=false."
          : clean_(dashboardActionability.blockReason || "")
      },
      canonicalLifecycleDiagnostics: canonicalLifecycleDiagnostics,
      preview: {
        selectedStage: comparisonStage,
        messageType: messageType,
        stageMatch: stageMatch,
        priorSuccessExcluded: priorSuccessExcluded,
        failedExcluded: failedExcluded,
        included: previewIncluded,
        exclusionReason: previewIncluded ? "" : clean_(
          (firstDivergence && firstDivergence.reason) ||
          (resolver && resolver.blockReason) ||
          (!stageMatch ? "Selected stage does not match row lifecycle stage." : "")
        ),
        resolver: resolver ? {
          eligible: resolver.eligible === true,
          blockCode: clean_(resolver.blockCode || ""),
          blockReason: clean_(resolver.blockReason || ""),
          messageType: clean_(resolver.messageType || ""),
          communicationFamily: clean_(resolver.communicationFamily || ""),
          portalSubmittedActive: resolver.portalSubmittedActive === true,
          docsVerified: resolver.docsVerified === true,
          paymentVerified: resolver.paymentVerified === true
        } : {
          eligible: false,
          blockCode: stageMatch ? (messageType ? (priorSuccessExcluded ? "PRIOR_SUCCESS_EXCLUDED" : (failedExcluded ? "FAILED_RETRY_EXCLUDED" : "")) : "UNKNOWN_MESSAGE_TYPE") : "STAGE_MISMATCH",
          blockReason: clean_(firstDivergence.reason || "")
        }
      },
      firstDivergence: firstDivergence,
      analysis: {
        dashboardActionableMeaning: "Dashboard actionable currently means operator-actionable / needs attention, not guaranteed batch-mail eligible.",
        previewEligibilityStricter: true,
        shouldShowSeparateCounts: true,
        shouldRenameReminderDueIfNeeded: true,
        opsUsesSameBackendPath: true,
        sharedBackendFixBenefitsOps: true
      },
      opsImpact: {
        sharedBackendPreviewContract: true,
        uiChangesRequiredForThisTrace: false,
        notes: "OPS preview buttons call the same previewStageBatchUi_() path backed by admin_previewStageBatch()."
      }
    };
  } catch (e) {
    return {
      ok: false,
      debugId: dbgId,
      code: "TRACE_HELPER_ERROR",
      message: String(e && e.message ? e.message : e)
    };
  }
}

function admin_getStageAggregation(payload) {
  var adminEmail = getCallerEmail_();
  if (!isAdmin_(adminEmail)) throw new Error("Access denied");
  var p = payload && typeof payload === "object" ? payload : {};
  var force = p.force === 1 || p.force === true;
  var cache = CacheService.getUserCache();
  var cacheKey = getStageAggregationCacheKey_(adminEmail);
  if (!force) {
    try {
      var cached = cache.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (_cacheReadErr) {}
  }

  var sh = openDataSheet_();
  var values = sh.getDataRange().getValues();
  var ledger = buildPopulationLedgerFromValues_(values, sh && typeof sh.getName === "function" ? sh.getName() : "", { includeEntries: false });
  var out = { ok: true, stages: [], populationLedger: populationLedgerPublicSummary_(ledger) };
  if (!values || values.length < 2) return out;

  var headers = values[0];
  var summary = {};
  for (var r = 1; r < values.length; r++) {
    var row = values[r] || [];
    var rowObj = {};
    for (var c = 0; c < headers.length; c++) {
      var h = clean_(headers[c]);
      if (h) rowObj[h] = row[c];
    }
    if (!clean_(rowObj.ApplicantID || "")) continue;
    // Keep dashboard aggregation O(N): row snapshot only, no send resolver or sheet re-lookups.
    var derived = stageAggregationSnapshot_(rowObj);
    var stage = clean_(derived.stage || "UNKNOWN").toUpperCase() || "UNKNOWN";
    var priority = clean_(derived.priority || mapStagePriority_(stage)).toUpperCase() || "LOW";
    if (!summary[stage]) {
      summary[stage] = {
        stage: stage,
        priority: priority,
        total: 0,
        actionable: 0,
        blocked: 0
      };
    }
    summary[stage].total++;
    if (derived.canSendNow) summary[stage].actionable++;
    else summary[stage].blocked++;
  }

  out.stages = Object.keys(summary).map(function (key) { return summary[key]; }).sort(function (a, b) {
    return stageAggregationSortIndex_(a.stage) - stageAggregationSortIndex_(b.stage);
  });
  try { cache.put(cacheKey, JSON.stringify(out), 120); } catch (_cacheWriteErr) {}
  return out;
}

function getOpsLifecycleSummaryCacheKey_(adminEmail) {
  return "ADMIN_OPS_LIFECYCLE_SUMMARY::" + clean_(adminEmail || "").toLowerCase();
}

function adminOpsFirstNonBlank_() {
  for (var i = 0; i < arguments.length; i++) {
    var value = arguments[i];
    if (clean_(value || "")) return clean_(value || "");
  }
  return "";
}

function adminOpsIsYes_(value) {
  return value === true || clean_(value || "").toUpperCase() === "YES";
}

function adminOpsTextIncludes_(text, pattern) {
  return pattern.test(String(text || "").toLowerCase());
}

function adminOpsHasUploadEvidence_(rowObj) {
  var row = rowObj || {};
  var fields = [
    "Birth_ID_Passport_File", "Birth_ID_File", "Passport_File", "Passport_ID_File",
    "Latest_School_Report_File", "School_Report_File", "Report_Card_File",
    "Transfer_Certificate_File", "Transfer_File",
    "Passport_Photo_File", "Student_Photo_File", "Photo_File",
    "Document_File", "Documents_File", "Document_Evidence_File",
    "Birth_ID_Passport_URL", "Latest_School_Report_URL", "Transfer_Certificate_URL", "Passport_Photo_URL"
  ];
  for (var i = 0; i < fields.length; i++) {
    if (hasUploadEvidence_(row[fields[i]], fields[i])) return true;
  }
  return false;
}

function adminOpsRequiredDocumentUploadSummary_(rowObj) {
  var row = rowObj || {};
  var required = adminDocumentRequiredUploadFields_();
  var uploaded = [];
  var missing = [];
  for (var i = 0; i < required.length; i++) {
    var item = required[i];
    if (adminDocumentHasEvidence_(row, item.field)) uploaded.push(item.field);
    else missing.push(item.field);
  }
  return {
    requiredCount: required.length,
    uploadedRequiredCount: uploaded.length,
    missingRequiredDocuments: missing,
    uploadedRequiredDocuments: uploaded,
    requiredDocumentUploadComplete: uploaded.length === required.length
  };
}

function adminOpsDroppedIneligibleReason_(rowObj) {
  var row = rowObj || {};
  var fields = [
    ["Pipeline_Stage", row.Pipeline_Stage],
    ["Operational_Stage", row.Operational_Stage],
    ["CRM_Stage", row.CRM_Stage],
    ["Stage", row.Stage],
    ["Overall_Status", row.Overall_Status],
    ["Application_Status", row.Application_Status],
    ["Status", row.Status]
  ];
  for (var i = 0; i < fields.length; i++) {
    var raw = clean_(fields[i][1] || "");
    if (!raw) continue;
    var normalized = raw.toLowerCase().replace(/[\/_-]+/g, " ").replace(/\s+/g, " ").trim();
    if (normalized.indexOf("closed lost") >= 0
      || normalized.indexOf("ineligible") >= 0
      || normalized.indexOf("not eligible") >= 0
      || normalized.indexOf("dropped") >= 0
      || normalized.indexOf("drop out") >= 0
      || normalized === "dropout"
      || normalized.indexOf("withdrawn") >= 0
      || normalized === "withdraw"
      || normalized.indexOf("disqualified") >= 0) {
      return fields[i][0] + ": " + raw;
    }
  }
  return "";
}

function adminOpsHasEmailIssue_(rowObj) {
  var row = rowObj || {};
  var emailStatus = clean_(row.Email_Status || "").toUpperCase();
  var verification = clean_(row.Email_Verification_Status || "").toUpperCase();
  var lastResult = clean_(row.Last_Contact_Result || "").toUpperCase();
  var bounceFlag = isCampaignBounceFlagTrue_(row.Email_Bounce_Flag);
  return bounceFlag
    || !!adminOpsFirstNonBlank_(
      row.Email_Bounce_Reason,
      row.Last_Email_Error,
      (/^(BOUNCED|SUPPRESSED|DO_NOT_CONTACT)$/i.test(clean_(row.Email_Status || "")) ? row.Email_Status : ""),
      (/^(BOUNCED|SUPPRESSED|INVALID)$/i.test(clean_(row.Email_Verification_Status || "")) ? row.Email_Verification_Status : ""),
      (/^(BOUNCED|SUPPRESSED|FAILED|BLOCKED)$/i.test(clean_(row.Last_Contact_Result || "")) ? row.Last_Contact_Result : "")
    )
    || emailStatus === "BOUNCED"
    || emailStatus === "SUPPRESSED"
    || emailStatus === "DO_NOT_CONTACT"
    || verification === "BOUNCED"
    || verification === "INVALID"
    || verification === "SUPPRESSED"
    || lastResult === "BOUNCED"
    || lastResult === "SUPPRESSED";
}

function adminOpsDocumentStateFromRow_(rowObj) {
  var row = rowObj || {};
  var rawDocStatus = adminOpsFirstNonBlank_(row.Docs_Status, row.Document_Status, row.Documents_Status, row.Overall_Doc_Status, row.Documents_Ready, row.docsStatus, "");
  var statusFields = adminOpsFirstNonBlank_(row.Birth_ID_Status, row.Birth_Status, row.Report_Status, row.Photo_Status, row.Transfer_Status, row.Document_Review_Status, row.Eligibility_Status, row.Doc_Verification_Status, "");
  var computed = "";
  try { computed = computeDocVerificationStatus_(row); } catch (_docErr) {}
  var docText = String((rawDocStatus || "") + " " + statusFields + " " + computed).toLowerCase();
  var docsVerified = adminOpsIsYes_(row.Docs_Verified) || computed === "Verified" || /verified|approved|cleared/.test(docText);
  var uploadSummary = adminOpsRequiredDocumentUploadSummary_(row);
  var portalSubmitted = adminOpsIsYes_(row.Portal_Submitted);
  if (docsVerified) return "docs_verified";
  if (adminOpsTextIncludes_(docText, /correction|wrong|reject|invalid|resubmit|reupload/)) return "document_correction_required";
  if (uploadSummary.requiredDocumentUploadComplete) return "uploaded_review_required";
  if (uploadSummary.uploadedRequiredCount > 0) return "partially_uploaded";
  if (adminOpsTextIncludes_(docText, /no file|not upload|missing|required|awaiting/) || portalSubmitted) return "awaiting_uploads";
  return "unknown";
}

function adminOpsLifecycleStageKeyFromRow_(rowObj) {
  var row = rowObj || {};
  var receiptStatus = clean_(row.Receipt_Status || row.Payment_Status || row.Payment_Review_Status || "").toLowerCase();
  var paymentBadge = canonicalPaymentBadge_(row);
  var paymentState = "EVIDENCE_PENDING";
  if (/reject|invalid|failed/.test(receiptStatus)) paymentState = "CORRECTION_REQUIRED";
  else if (/verified|approved|cleared/.test(receiptStatus) || paymentBadge === "Verified") paymentState = "VERIFIED";
  else if (adminOpsIsYes_(row.Payment_Received)
    || hasUploadEvidence_(row.Fee_Receipt_File, "Fee_Receipt_File")
    || /pending|review|received|uploaded/.test(receiptStatus)) paymentState = "UNDER_REVIEW";

  var invoiceRaised = !!adminOpsFirstNonBlank_(row.Books_Invoice_ID, row.Books_Invoice_Number, row.Books_Push_Status, row.Invoice_Email_Status);
  var docState = adminOpsDocumentStateFromRow_(row);
  var resolverDocState = "PENDING";
  if (docState === "eligibility_cleared" || docState === "verified" || docState === "docs_verified") resolverDocState = "VERIFIED";
  else if (docState === "document_correction_required") resolverDocState = "CORRECTION_REQUIRED";
  else if (docState === "uploaded_review_required") resolverDocState = "UNDER_REVIEW";

  var terminalReason = adminOpsDroppedIneligibleReason_(row);
  var emailStatus = clean_(row.Email_Status || "").toUpperCase();
  var resolverStage = "";
  if (emailStatus === "DO_NOT_CONTACT" || adminOpsIsYes_(row.Do_Not_Contact) || adminOpsIsYes_(row.DO_NOT_CONTACT)) resolverStage = "DO_NOT_CONTACT";
  else if (terminalReason) resolverStage = "DROPPED";
  else if (adminOpsIsYes_(row.Enrolled_Confirmed) || adminOpsFirstNonBlank_(row.Enrolled_At)) resolverStage = "ENROLLED";
  else if (paymentState === "VERIFIED" && resolverDocState === "VERIFIED") resolverStage = "ENROLMENT_READY";
  else if (paymentState === "VERIFIED") resolverStage = "PAYMENT_VERIFIED";
  else if (paymentState === "UNDER_REVIEW" && resolverDocState === "VERIFIED") resolverStage = "PAYMENT_UNDER_REVIEW";
  else if (resolverDocState === "VERIFIED") resolverStage = "PAYMENT_EVIDENCE_PENDING";
  else if (resolverDocState === "CORRECTION_REQUIRED") resolverStage = "DOCS_CORRECTION_REQUIRED";
  else if (resolverDocState === "UNDER_REVIEW") resolverStage = "DOCS_UNDER_REVIEW";
  else {
    var portalState = "PENDING";
    if (adminOpsIsYes_(row.Portal_Submitted)) portalState = "SUBMITTED";
    else if (adminOpsFirstNonBlank_(row.PortalURL, row.Portal_Link, row.Portal_Token_Status, row.portalLastUpdateAt, row.PortalLastUpdateAt)) portalState = "ISSUED";
    resolverStage = portalState === "SUBMITTED" ? "DOCS_PENDING" : (portalState === "ISSUED" ? "PORTAL_ISSUED" : "RECEIVED");
  }

  if (resolverStage === "RECEIVED") return "fd_received";
  if (resolverStage === "PORTAL_ISSUED") return "portal";
  if (resolverStage === "PORTAL_SUBMITTED" || resolverStage === "DOCS_PENDING") return "docs";
  if (resolverStage === "DOCS_UNDER_REVIEW" || resolverStage === "DOCS_CORRECTION_REQUIRED") return "uploaded_review_required";
  if (resolverStage === "PAYMENT_EVIDENCE_PENDING" || resolverStage === "PAYMENT_UNDER_REVIEW") return invoiceRaised ? "invoice" : "payment";
  if (resolverStage === "PAYMENT_VERIFIED" || resolverStage === "ENROLMENT_READY") return "enrolment";
  if (resolverStage === "ENROLLED") return "classroom";
  if (resolverStage === "DO_NOT_CONTACT") return "email_issue";
  if (resolverStage === "DROPPED" || resolverStage === "INELIGIBLE" || resolverStage === "CLOSED_LOST" || resolverStage === "DUPLICATE") return "dropped_ineligible";
  if (adminOpsHasEmailIssue_(row)) return "email_issue";
  var lastResult = clean_(row.Last_Contact_Result || row.Email_Status || row.Ack_Email_Status || row.Books_Last_Error || "").toUpperCase();
  if (lastResult.indexOf("FAILED") >= 0 || lastResult.indexOf("BLOCK") >= 0 || lastResult.indexOf("ERROR") >= 0) return "exceptions";
  return "fd_received";
}

function admin_getOpsLifecycleSummary(payload) {
  var adminEmail = getCallerEmail_();
  if (!isAdmin_(adminEmail)) throw new Error("Access denied");
  var p = payload && typeof payload === "object" ? payload : {};
  var force = p.force === 1 || p.force === true;
  var cache = CacheService.getUserCache();
  var cacheKey = getOpsLifecycleSummaryCacheKey_(adminEmail);
  if (!force) {
    try {
      var cached = cache.get(cacheKey);
      if (cached) return JSON.parse(cached);
    } catch (_cacheReadErr) {}
  }

  var counts = {
    fd_received: 0,
    portal: 0,
    docs: 0,
    uploaded_review_required: 0,
    document_correction_required: 0,
    eligibility_review: 0,
    payment: 0,
    invoice: 0,
    enrolment: 0,
    classroom: 0,
    exceptions: 0,
    email_issue: 0,
    dropped_ineligible: 0
  };
  var sheet = openDataSheet_();
  var data = sheet.getDataRange().getValues();
  var scannedRows = Math.max(0, (data || []).length - 1);
  var activeApplicantCount = 0;
  if (data && data.length >= 2) {
    var headers = data[0] || [];
    for (var r = 1; r < data.length; r++) {
      var row = data[r] || [];
      var rowObj = {};
      for (var c = 0; c < headers.length; c++) {
        var h = clean_(headers[c]);
        if (h) rowObj[h] = row[c];
      }
      if (!clean_(rowObj.ApplicantID || "")) continue;
      activeApplicantCount++;
      var key = adminOpsLifecycleStageKeyFromRow_(rowObj);
      if (!Object.prototype.hasOwnProperty.call(counts, key)) key = "fd_received";
      counts[key]++;
    }
  }

  var out = {
    ok: true,
    mode: "global",
    source: "full_active_admissions_population",
    counts: counts,
    activeApplicantCount: activeApplicantCount,
    scannedRows: scannedRows,
    generatedAt: new Date().toISOString(),
    version: clean_(CONFIG.VERSION || "")
  };
  try { cache.put(cacheKey, JSON.stringify(out), 60); } catch (_cacheWriteErr) {}
  return out;
}

// Review queue RPC lives in Admin_ReviewQueues.js.

function resolveExportRowNumbers_(payload, lastRow) {
  payload = payload || {};
  var scope = clean_(payload.scope || "");
  if (scope === "auto") scope = "search_first";
  if (scope === "search") scope = "search_only";
  var requested = Array.isArray(payload.currentSearchRowNumbers)
    ? payload.currentSearchRowNumbers
    : (Array.isArray(payload.rowNumbers) ? payload.rowNumbers : []);
  var out = [];
  var emptySearchAllowed = scope === "search_only";
  var startRow = Math.max(2, Number(payload.startRow || 2));
  var batchSize = Math.max(1, Number(payload.batchSize || payload.maxRows || payload.limit || 200));
  var maxRows = Math.max(0, Number(payload.maxRows || payload.batchSize || payload.limit || 0));

  if (scope === "range") {
    var rangeOut = [];
    var endRowRange = Math.min(lastRow, startRow + batchSize - 1);
    for (var rr = startRow; rr <= endRowRange; rr++) rangeOut.push(rr);
    return rangeOut;
  }

  if (scope === "search_only" || scope === "search_first") {
    var seenSearch = {};
    for (var s = 0; s < requested.length; s++) {
      var ns = Number(requested[s] || 0);
      if (!ns || ns < 2 || ns > lastRow || seenSearch[ns]) continue;
      seenSearch[ns] = true;
      out.push(ns);
      if (scope === "search_first" && out.length >= batchSize) break;
    }
    if (out.length || emptySearchAllowed) return out;
    // search_first fallback when no current search results
  }

  if (requested.length && scope !== "all") {
    var seen = {};
    for (var i = 0; i < requested.length; i++) {
      var n = Number(requested[i] || 0);
      if (!n || n < 2 || n > lastRow || seen[n]) continue;
      seen[n] = true;
      out.push(n);
      if (maxRows > 0 && out.length >= maxRows) break;
    }
    return out;
  }
  var endRow = Math.min(lastRow, startRow + batchSize - 1);
  for (var row = startRow; row <= endRow; row++) out.push(row);
  return out;
}

function syncPortalSecretsActive_(applicantId, email, fullName, secretPlain, secretHash) {
  var sh = openPortalSecrets_();
  var idx = getHeaderIndexMap_(sh);
  var rowIndex = findPortalSecretsRowByApplicantId_(sh, applicantId);
  var nowIso = new Date().toISOString();
  var patch = {
    ApplicantID: clean_(applicantId),
    Email: clean_(email),
    Full_Name: clean_(fullName),
    Secret_Plain: clean_(secretPlain),
    Secret_Hash: clean_(secretHash),
    Last_Rotated_At: nowIso,
    Status: "Active"
  };
  if (rowIndex) {
    if (!idx.Created_At || !idx.Last_Rotated_At) throw new Error("PortalSecrets schema missing required headers");
    var existingCreatedAt = sh.getRange(rowIndex, idx.Created_At).getValue();
    if (!clean_(existingCreatedAt)) patch.Created_At = nowIso;
    applyPatch_(sh, rowIndex, patch);
    return rowIndex;
  }
  sh.appendRow([
    clean_(applicantId),
    clean_(email),
    clean_(fullName),
    clean_(secretPlain),
    clean_(secretHash),
    nowIso,
    nowIso,
    "Active"
  ]);
  return sh.getLastRow();
}

// findDocMapping_ lives in Admin_DocumentServices.js.

// normalizeDocStatus_ lives in Admin_DocumentServices.js.

function toPlainString_(v) {
  if (v === null || v === undefined) return "";
  if (Array.isArray(v)) {
    return v.filter(function (x) { return !!x; }).map(function (x) {
      return String(x).trim();
    }).filter(function (x) { return !!x; }).join(", ");
  }
  if (typeof v === "string") return v.trim();
  if (typeof v === "number" || typeof v === "boolean") return String(v);
  if (v && typeof v.getUrl === "function") {
    try { return String(v.getUrl() || "").trim(); } catch (e) {}
  }
  return String(v).trim();
}

function asStringUrl_(v) {
  var out = "";
  if (v === null || v === undefined) {
    out = "";
  } else if (Array.isArray(v)) {
    var first = "";
    for (var i = 0; i < v.length; i++) {
      var candidate = String(v[i] === null || v[i] === undefined ? "" : v[i]).trim();
      if (candidate) {
        first = candidate;
        break;
      }
    }
    if (first) out = first;
    else {
      out = v.map(function (x) {
        return String(x === null || x === undefined ? "" : x).trim();
      }).filter(function (x) { return !!x; }).join(", ");
    }
  } else if (typeof v === "string") {
    out = v.trim();
  } else {
    out = String(v).trim();
  }
  if (out.indexOf("[Ljava.lang.Object;") >= 0) return "";
  if (out === "undefined" || out === "null") return "";
  return out;
}

// toRouteStatusKey_ lives in Admin_DocumentServices.js.

function recomputeOverallDocStatus_(sh, rowNumber, idx, docMap) {
  var row = sh.getRange(rowNumber, 1, 1, sh.getLastColumn()).getValues()[0];
  var requiredVerified = true;
  var hasFraudulent = false;
  var hasRejected = false;

  for (var i = 0; i < docMap.length; i++) {
    var m = docMap[i];
    var st = normalizeDocStatus_(row[idx[m.status] - 1]);
    if (st === "Fraudulent") hasFraudulent = true;
    if (st === "Rejected") hasRejected = true;
    if (m.required !== false && st !== "Verified") requiredVerified = false;
  }

  if (hasFraudulent) return "Fraudulent";
  if (hasRejected) return "Rejected";
  if (requiredVerified) return "Verified";
  return "Pending";
}

function admin_backfillPortalTokens(payload) {
  var adminEmail = getCallerEmail_();
  if (!isAdmin_(adminEmail)) throw new Error("Access denied");
  requireSuperAdmin_(adminEmail);

  payload = payload || {};
  var dryRun = payload.dryRun !== false;
  var startRow = Math.max(2, Number(payload.startRow || 2));
  var limit = Number(payload.limit);
  if (!limit || limit < 1) limit = 200;

  var sh = openDataSheet_();
  ensureHeadersExist_(sh, ["PortalTokenHash", "PortalTokenIssuedAt", "Portal_Access_Status"]);
  var lastCol = withSpreadsheetRetry_(function () { return sh.getLastColumn(); });
  var headers = withSpreadsheetRetry_(function () { return sh.getRange(1, 1, 1, lastCol).getValues()[0]; });
  var idx = headerIndex_(headers);
  requireHeaders_(idx, ["ApplicantID", "PortalTokenHash", "PortalTokenIssuedAt"]);

  var lastRow = withSpreadsheetRetry_(function () { return sh.getLastRow(); });
  if (startRow > lastRow) {
    return {
      ok: true,
      dryRun: dryRun,
      startRow: startRow,
      limit: limit,
      endRow: startRow - 1,
      lastRow: lastRow,
      nextStartRow: "",
      checked: 0,
      updated: 0,
      skipped: 0,
      generatedCount: 0,
      rekeyedCount: 0,
      createdSecretsRows: 0
    };
  }
  var endRow = Math.min(lastRow, startRow + limit - 1);
  var batchSize = endRow - startRow + 1;
  var batchValues = withSpreadsheetRetry_(function () {
    return sh.getRange(startRow, 1, batchSize, lastCol).getValues();
  });

  var secretsSheet = openPortalSecrets_();
  var secretsIndex = buildPortalSecretsIndex_(secretsSheet);

  var checked = 0;
  var updated = 0;
  var skipped = 0;
  var generatedCount = 0;
  var rekeyedCount = 0;
  var createdSecretsRows = 0;
  var admissionsTouched = false;
  var secretsAppendRows = [];
  var now = new Date();
  var nowIso = now.toISOString();

  for (var i = 0; i < batchValues.length; i++) {
    var rowNumber = startRow + i;
    var row = batchValues[i];
    var applicantId = clean_(idx.ApplicantID ? row[idx.ApplicantID - 1] : "");
    if (!applicantId) continue;
    checked++;
    var admissionsHash = clean_(idx.PortalTokenHash ? row[idx.PortalTokenHash - 1] : "");
    var emailCorrected = clean_(idx.Parent_Email_Corrected ? row[idx.Parent_Email_Corrected - 1] : "");
    var emailRaw = clean_(idx.Parent_Email ? row[idx.Parent_Email - 1] : "");
    var emailForSecret = emailCorrected || emailRaw;
    var firstName = clean_(idx.First_Name ? row[idx.First_Name - 1] : "");
    var lastName = clean_(idx.Last_Name ? row[idx.Last_Name - 1] : "");
    var fullName = (firstName + " " + lastName).trim();
    var portalRec = secretsIndex.byApplicantId[applicantId] || null;
    var hasSecretRecord = !!portalRec;
    var hasActiveSecret = !!(portalRec && portalRec.status === "Active" && portalRec.secretHash);

    if (!admissionsHash) {
      var secretPlain1 = newPortalSecret_();
      var secretHash1 = hashPortalSecret_(secretPlain1);
      updated++;
      generatedCount++;
      createdSecretsRows++;
      secretsAppendRows.push([
        applicantId,
        emailForSecret,
        fullName,
        secretPlain1,
        secretHash1,
        nowIso,
        nowIso,
        "Active"
      ]);
      secretsIndex.byApplicantId[applicantId] = {
        rowIndex: (secretsIndex.lastRow || 1) + secretsAppendRows.length,
        status: "Active",
        secretHash: secretHash1
      };
      if (!dryRun) {
        if (idx.PortalTokenHash) row[idx.PortalTokenHash - 1] = secretHash1;
        if (idx.PortalTokenIssuedAt) row[idx.PortalTokenIssuedAt - 1] = now;
        admissionsTouched = true;
      }
      continue;
    }

    if (!hasSecretRecord) {
      var secretPlain2 = newPortalSecret_();
      var secretHash2 = hashPortalSecret_(secretPlain2);
      updated++;
      rekeyedCount++;
      createdSecretsRows++;
      secretsAppendRows.push([
        applicantId,
        emailForSecret,
        fullName,
        secretPlain2,
        secretHash2,
        nowIso,
        nowIso,
        "Active"
      ]);
      secretsIndex.byApplicantId[applicantId] = {
        rowIndex: (secretsIndex.lastRow || 1) + secretsAppendRows.length,
        status: "Active",
        secretHash: secretHash2
      };
      continue;
    }

    if (hasActiveSecret || hasSecretRecord) {
      skipped++;
    } else {
      skipped++;
    }
  }

  if (!dryRun) {
    if (admissionsTouched) {
      withSpreadsheetRetry_(function () {
        sh.getRange(startRow, 1, batchSize, lastCol).setValues(batchValues);
      });
    }
    if (secretsAppendRows.length) {
      var startAppendRow = withSpreadsheetRetry_(function () { return secretsSheet.getLastRow(); }) + 1;
      withSpreadsheetRetry_(function () {
        secretsSheet.getRange(startAppendRow, 1, secretsAppendRows.length, 8).setValues(secretsAppendRows);
      });
    }
  }

  var nextStartRow = endRow < lastRow ? (endRow + 1) : "";
  Logger.log(
    "ADMIN_TOKEN_BACKFILL batch dryRun=%s start=%s end=%s limit=%s lastRow=%s nextStart=%s checked=%s updated=%s skipped=%s generated=%s rekeyed=%s createdSecretsRows=%s",
    dryRun, startRow, endRow, limit, lastRow, nextStartRow, checked, updated, skipped, generatedCount, rekeyedCount, createdSecretsRows
  );
  log_(openLogSheet_(), "ADMIN_TOKEN_BACKFILL",
    "dryRun=" + dryRun
    + " startRow=" + startRow
    + " endRow=" + endRow
    + " limit=" + limit
    + " lastRow=" + lastRow
    + " nextStartRow=" + nextStartRow
    + " checked=" + checked
    + " updated=" + updated
    + " skipped=" + skipped
    + " generated=" + generatedCount
    + " rekeyed=" + rekeyedCount
    + " createdSecretsRows=" + createdSecretsRows
    + " by=" + (adminEmail || "admin"));

  return {
    ok: true,
    dryRun: dryRun,
    startRow: startRow,
    limit: limit,
    endRow: endRow,
    lastRow: lastRow,
    nextStartRow: nextStartRow,
    checked: checked,
    updated: updated,
    skipped: skipped,
    generatedCount: generatedCount,
    rekeyedCount: rekeyedCount,
    createdSecretsRows: createdSecretsRows
  };
}

function admin_backfillPortalTokensDryRun(payload) {
  payload = payload || {};
  payload.dryRun = true;
  return admin_backfillPortalTokens(payload);
}

function admin_backfillPortalTokensApply(payload) {
  payload = payload || {};
  payload.dryRun = false;
  return admin_backfillPortalTokens(payload);
}

function admin_exportPortalLinksCsv(payload) {
  var adminEmail = getCallerEmail_();
  if (!isAdmin_(adminEmail)) throw new Error("Access denied");
  requireSuperAdmin_(adminEmail);
  if (!isStudentUrlConfigured_()) throw new Error(getStudentUrlWarning_());

  payload = payload || {};
  Logger.log("EXPORT_PORTAL_LINKS " + JSON.stringify({
    scope: clean_(payload.scope || ""),
    startRow: Number(payload.startRow || 0),
    batchSize: Number(payload.batchSize || 0)
  }));
  var sh = openDataSheet_();
  var secretsSheet = openPortalSecrets_();
  var lastRow = sh.getLastRow();
  var rows = resolveExportRowNumbers_(payload, lastRow);
  var out = [["ApplicantID", "PortalUrl"]];
  var exportedCount = 0;
  var generatedCount = 0;
  var rekeyedCount = 0;

  for (var i = 0; i < rows.length; i++) {
    var rowNumber = rows[i];
    var rowObj = getRowObject_(sh, rowNumber);
    var applicantId = clean_(rowObj.ApplicantID || "");
    if (!applicantId) continue;

    var emailCorrected = clean_(rowObj.Parent_Email_Corrected || "");
    var emailRaw = clean_(rowObj.Parent_Email || "");
    var email = emailCorrected || emailRaw || "";
    var fullName = (clean_(rowObj.First_Name || "") + " " + clean_(rowObj.Last_Name || "")).trim();
    var admissionsHash = clean_(rowObj.PortalTokenHash || "");
    var hasSecretRecord = !!findPortalSecretsRowByApplicantId_(secretsSheet, applicantId);

    var secretInfo = getOrCreateActivePortalSecret_(applicantId, email, fullName, sh, rowNumber, {
      secretsSheet: secretsSheet
    });
    if (secretInfo.created) generatedCount++;
    if (admissionsHash && !hasSecretRecord) rekeyedCount++;

    var link = buildPortalLinkFromBase_(clean_(CONFIG.WEBAPP_URL_STUDENT || ""), applicantId, secretInfo.secretPlain);
    out.push([applicantId, link]);
    exportedCount++;
  }

  var lines = out.map(function (row) { return buildCsvLine_(row); });
  var csv = lines.join("\n");
  var fileStamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "GMT", "yyyyMMdd_HHmmss");
  var filename = "portal-links-" + fileStamp + ".csv";

  log_(openLogSheet_(), "ADMIN_EXPORT_PORTAL_LINKS",
    "exported=" + exportedCount + " generated=" + generatedCount + " rekeyed=" + rekeyedCount + " by=" + (adminEmail || "admin"));

  return {
    ok: true,
    detail: {
      csv: csv,
      filename: filename,
      exportedCount: exportedCount,
      generatedCount: generatedCount,
      rekeyedCount: rekeyedCount
    }
  };
}

function audit_NoHardcodedRowDefaults() {
  Logger.log("Run: rg -n \"\\|\\|\\s*17|payload\\.rowNumber\\s*\\|\\|\\s*[0-9]+|selectedRow\\s*=\\s*[0-9]+\" Admin.js AdminUI.html Code.js");
}


function admin_campaignPrepareLegacyRows(payload) {
  return withEnvelope_("admin_campaignPrepareLegacyRows", function () {
    var adminEmail = getActiveUserEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    requireSuperAdmin_(adminEmail);
    return campaign_prepareLegacyRows_();
  });
}

function admin_campaignSendLegacyBatch(payload) {
  return withEnvelope_("admin_campaignSendLegacyBatch", function () {
    var adminEmail = getActiveUserEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    requireSuperAdmin_(adminEmail);
    var p = payload || {};
    if (isSystemStabilizationModeActive_() || CONFIG.ENABLE_PRODUCTION_EMAIL_SENDS !== true) {
      var blockCode = isSystemStabilizationModeActive_() ? "SYSTEM_STABILIZATION_MODE_ACTIVE" : "PRODUCTION_EMAIL_SENDS_DISABLED";
      if (isSystemStabilizationModeActive_()) logOperationalBlock_("SYSTEM_STABILIZATION_MODE_ACTIVE", {
        action: "campaign_send_legacy_batch",
        actorEmail: clean_(adminEmail || "")
      });
      logOperationalBlock_("EMAIL_SEND_BLOCKED", {
        action: "campaign_send_legacy_batch",
        blockCode: blockCode,
        actorEmail: clean_(adminEmail || "")
      });
      return adminCommBlockedResult_("campaign_send_legacy_batch", blockCode, "", {
        blockReason: "Legacy campaign sends are disabled during stabilization."
      });
    }
    return campaign_sendLegacyBatch_(p.limit, p);
  });
}

function admin_campaignSyncResponses(payload) {
  return withEnvelope_("admin_campaignSyncResponses", function () {
    var adminEmail = getActiveUserEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    requireSuperAdmin_(adminEmail);
    return campaign_syncResponses_();
  });
}

function admin_campaignProcessBounces(payload) {
  return withEnvelope_("admin_campaignProcessBounces", function () {
    var adminEmail = getActiveUserEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    requireSuperAdmin_(adminEmail);
    return admin_scanBounces_();
  });
}

function admin_runBounceScan(payload) {
  return withEnvelope_("admin_runBounceScan", function () {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    requireSuperAdmin_(adminEmail);
    return admin_scanBounces_();
  });
}

function admin_getPropertyInventorySummary() {
  return withEnvelope_("admin_getPropertyInventorySummary", function () {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    requireSuperAdmin_(adminEmail);
    return getPropertyInventorySummary_();
  });
}

function admin_getPropertyPrefixBreakdown() {
  return withEnvelope_("admin_getPropertyPrefixBreakdown", function () {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    requireSuperAdmin_(adminEmail);
    return getPropertyPrefixBreakdown_();
  });
}

function admin_cleanupEphemeralCommunicationProperties(payload) {
  return withEnvelope_("admin_cleanupEphemeralCommunicationProperties", function () {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    requireSuperAdmin_(adminEmail);
    return cleanupEphemeralCommunicationProperties_(payload || {});
  });
}

function admin_logPropertyInventorySummary() {
  var result = admin_getPropertyInventorySummary();
  console.log("PROPERTY_INVENTORY_RESULT_START");
  console.log(JSON.stringify(result, null, 2));
  console.log("PROPERTY_INVENTORY_RESULT_END");
  return result;
}

function admin_logPropertyPrefixBreakdown() {
  var result = admin_getPropertyPrefixBreakdown();
  console.log("PROPERTY_PREFIX_BREAKDOWN_RESULT_START");
  console.log(JSON.stringify(result, null, 2));
  console.log("PROPERTY_PREFIX_BREAKDOWN_RESULT_END");
  return result;
}

function admin_dryRunCleanupCommLastProperties() {
  var result = admin_cleanupEphemeralCommunicationProperties({ prefix: "COMM_LAST::" });
  console.log("PROPERTY_CLEANUP_DRY_RUN_RESULT_START");
  console.log(JSON.stringify(result, null, 2));
  console.log("PROPERTY_CLEANUP_DRY_RUN_RESULT_END");
  return result;
}

function admin_dryRunCleanupAllCommLastProperties() {
  var result = admin_cleanupEphemeralCommunicationProperties({ prefix: "COMM_LAST::", limit: 500 });
  console.log("PROPERTY_CLEANUP_ALL_DRY_RUN_RESULT_START");
  console.log(JSON.stringify(result, null, 2));
  console.log("PROPERTY_CLEANUP_ALL_DRY_RUN_RESULT_END");
  return result;
}

function admin_confirmCleanupCommLastBatch500() {
  var result = admin_cleanupEphemeralCommunicationProperties({
    prefix: "COMM_LAST::",
    limit: 500,
    confirm: true
  });
  console.log("PROPERTY_CLEANUP_CONFIRM_BATCH500_RESULT_START");
  console.log(JSON.stringify(result, null, 2));
  console.log("PROPERTY_CLEANUP_CONFIRM_BATCH500_RESULT_END");
  return result;
}

function admin_getPropertyInventoryDisplaySummary() {
  var result = admin_getPropertyInventorySummary();
  var summary = {
    ok: result && result.ok === true,
    totalProperties: Number(result && result.totalPropertyCount || 0),
    totalSerializedSizeEstimate: Number(result && result.totalSerializedSizeEstimate || 0),
    commLastCount: Number(result && result.commLastCount || 0),
    eligibleDeletionCount: Number(result && result.eligibleCommLastDeletionCount || 0),
    protectedCount: Number(result && result.protectedCount || 0),
    dryRun: true,
    blocked: "",
    deleteLimit: Number(CONFIG.MAX_PROPERTY_DELETE_BATCH || 500),
    version: clean_(CONFIG.VERSION || ""),
    deployVersion: Number(CONFIG.DEPLOY_VERSION_NUMBER || 0)
  };
  summary.displayText = [
    "Property inventory",
    "Total properties: " + summary.totalProperties,
    "Estimated serialized size: " + summary.totalSerializedSizeEstimate,
    "COMM_LAST::* count: " + summary.commLastCount,
    "Eligible deletion count: " + summary.eligibleDeletionCount,
    "Protected count: " + summary.protectedCount,
    "Delete limit: " + summary.deleteLimit,
    "Runtime: " + summary.version + " / " + summary.deployVersion
  ].join("\n");
  return summary;
}

function admin_getPropertyPrefixDisplaySummary() {
  var result = admin_getPropertyPrefixBreakdown();
  var prefixes = Array.isArray(result && result.prefixes) ? result.prefixes.slice(0, 10) : [];
  var summary = {
    ok: result && result.ok === true,
    totalProperties: Number(result && result.totalPropertyCount || 0),
    totalSerializedSizeEstimate: Number(result && result.totalSerializedSizeEstimate || 0),
    commLastCount: Number(result && result.commLastCount || 0),
    eligibleDeletionCount: Number(result && result.eligibleCommLastDeletionCount || 0),
    protectedCount: Number(result && result.protectedCount || 0),
    dryRun: true,
    blocked: "",
    deleteLimit: Number(CONFIG.MAX_PROPERTY_DELETE_BATCH || 500),
    topPrefixes: prefixes
  };
  summary.displayText = [
    "Property prefix breakdown",
    "Total properties: " + summary.totalProperties,
    "COMM_LAST::* count: " + summary.commLastCount,
    "Protected count: " + summary.protectedCount,
    "Top prefixes:",
    prefixes.map(function (p) {
      return "- " + clean_(p.prefix || "") + " count=" + Number(p.count || 0) + " size=" + Number(p.serializedSizeEstimate || 0);
    }).join("\n")
  ].join("\n");
  return summary;
}

function admin_getDryRunCleanupCommLastDisplaySummary() {
  var result = admin_cleanupEphemeralCommunicationProperties({ prefix: "COMM_LAST::" });
  var summary = {
    ok: result && result.ok === true,
    totalProperties: Number(result && result.totalBefore || 0),
    totalPropertiesAfter: Number(result && result.totalAfter || 0),
    commLastCount: Number(result && result.commLastBefore || 0),
    commLastCountAfter: Number(result && result.commLastAfter || 0),
    eligibleDeletionCount: Number(result && result.eligible || 0),
    protectedSkipped: Number(result && result.protectedSkipped || 0),
    estimatedSizeReduction: Number(result && result.estimatedSizeReduction || 0),
    dryRun: result ? result.dryRun === true : true,
    blocked: clean_(result && result.blocked || ""),
    deleted: Number(result && result.deleted || 0),
    deleteLimit: Number(result && result.maxDeleteBatch || CONFIG.MAX_PROPERTY_DELETE_BATCH || 500)
  };
  summary.displayText = [
    "COMM_LAST::* cleanup dry-run",
    "Dry run: " + summary.dryRun,
    "Blocked: " + (summary.blocked || "no"),
    "Deleted: " + summary.deleted,
    "Total properties before: " + summary.totalProperties,
    "Total properties after: " + summary.totalPropertiesAfter,
    "COMM_LAST::* before: " + summary.commLastCount,
    "COMM_LAST::* after: " + summary.commLastCountAfter,
    "Eligible deletion count: " + summary.eligibleDeletionCount,
    "Protected skipped: " + summary.protectedSkipped,
    "Estimated size reduction: " + summary.estimatedSizeReduction,
    "Delete limit: " + summary.deleteLimit
  ].join("\n");
  return summary;
}

function admin_getDryRunCleanupAllCommLastDisplaySummary() {
  var result = admin_cleanupEphemeralCommunicationProperties({ prefix: "COMM_LAST::", limit: 500 });
  var summary = {
    ok: result && result.ok === true,
    totalProperties: Number(result && result.totalBefore || 0),
    totalPropertiesAfter: Number(result && result.totalAfter || 0),
    commLastCount: Number(result && result.commLastBefore || 0),
    commLastCountAfter: Number(result && result.commLastAfter || 0),
    eligibleDeletionCount: Number(result && result.eligible || 0),
    protectedSkipped: Number(result && result.protectedSkipped || 0),
    estimatedSizeReduction: Number(result && result.estimatedSizeReduction || 0),
    dryRun: result ? result.dryRun === true : true,
    blocked: clean_(result && result.blocked || ""),
    deleted: Number(result && result.deleted || 0),
    deleteLimit: Number(result && result.maxDeleteBatch || CONFIG.MAX_PROPERTY_DELETE_BATCH || 500),
    requestedLimit: 500
  };
  summary.displayText = [
    "COMM_LAST::* cleanup full dry-run",
    "Dry run: " + summary.dryRun,
    "Blocked: " + (summary.blocked || "no"),
    "Deleted: " + summary.deleted,
    "Total properties before: " + summary.totalProperties,
    "Total properties after: " + summary.totalPropertiesAfter,
    "COMM_LAST::* before: " + summary.commLastCount,
    "COMM_LAST::* after: " + summary.commLastCountAfter,
    "Eligible deletion count: " + summary.eligibleDeletionCount,
    "Protected skipped: " + summary.protectedSkipped,
    "Estimated size reduction: " + summary.estimatedSizeReduction,
    "Delete limit: " + summary.deleteLimit,
    "Requested limit: " + summary.requestedLimit
  ].join("\n");
  return summary;
}

function propertyHealthLevel_(summary) {
  var total = Number(summary && summary.totalPropertyCount || 0);
  var size = Number(summary && summary.totalSerializedSizeEstimate || 0);
  var countLimit = Math.max(1, Number(CONFIG.SCRIPT_PROPERTY_HEALTH_COUNT_LIMIT || 500));
  var sizeLimit = Math.max(1, Number(CONFIG.SCRIPT_PROPERTY_HEALTH_SIZE_LIMIT || 500000));
  var ratio = Math.max(total / countLimit, size / sizeLimit);
  if (ratio >= 0.75) return "CRITICAL";
  if (ratio >= 0.50) return "WARNING";
  return "HEALTHY";
}

function getBounceVisibilitySummary_() {
  var ctx = campaignGetContext_();
  var headers = ctx.headers || [];
  var values = ctx.values || [];
  var out = {
    ok: true,
    source: "sheet_existing_fields",
    totalRows: Math.max(0, values.length - 1),
    bouncedRows: 0,
    bounceFlagRows: 0,
    hardBounceRows: 0,
    temporaryBounceRows: 0,
    retryScheduledRows: 0,
    lastBounceReason: "",
    lastBounceRow: null
  };
  for (var r = 1; r < values.length; r++) {
    var rowNumber = r + 1;
    var rowObj = campaignRowObjectFromValues_(headers, values[r]);
    var status = normalizeEmailStatus_(rowObj.Email_Status || "");
    var flag = clean_(rowObj.Email_Bounce_Flag || "").toUpperCase();
    var reason = clean_(rowObj.Email_Bounce_Reason || "");
    var nextAction = clean_(rowObj.Email_Next_Action_Date || "");
    var isFlagged = isCampaignBounceFlagTrue_(rowObj.Email_Bounce_Flag);
    var isBounced = status === "BOUNCED" || isFlagged || !!reason;
    if (!isBounced) continue;
    out.bouncedRows++;
    if (isFlagged) out.bounceFlagRows++;
    if (status === "BOUNCED" || flag === "YES" || /^HARD:|^INVALID:|^BLOCKED:/i.test(reason)) out.hardBounceRows++;
    if (/^TEMPORARY:/i.test(reason)) out.temporaryBounceRows++;
    if (nextAction) out.retryScheduledRows++;
    if (reason) {
      out.lastBounceReason = reason;
      out.lastBounceRow = rowNumber;
    }
  }
  return out;
}

function admin_getOperationalSafetyStatus(payload) {
  var adminEmail = typeof getCallerEmail_ === "function" ? clean_(getCallerEmail_() || "") : "";
  if (typeof isAdmin_ === "function" && !isAdmin_(adminEmail)) throw new Error("Access denied");
  var runtime = typeof buildRuntimeTruth_ === "function"
    ? buildRuntimeTruth_({ parameter: { view: "admin" } }, "admin")
    : { ok: true, version: clean_(CONFIG.VERSION || ""), deployVersion: Number(CONFIG.DEPLOY_VERSION_NUMBER || 0) };
  var triggerStatus = null;
  try {
    triggerStatus = typeof getAutomatedStageRunnerStatus_ === "function" ? getAutomatedStageRunnerStatus_() : null;
  } catch (triggerErr) {
    triggerStatus = { ok: false, triggerCount: null, error: clean_(triggerErr && triggerErr.message ? triggerErr.message : triggerErr) };
  }
  var bounceVisibility = null;
  try {
    bounceVisibility = getBounceVisibilitySummary_();
  } catch (bounceErr) {
    bounceVisibility = {
      ok: false,
      source: "sheet_existing_fields",
      error: clean_(bounceErr && bounceErr.message ? bounceErr.message : bounceErr)
    };
  }
  var propertySummary = getPropertyInventorySummary_();
  var lastRun = triggerStatus && triggerStatus.lastRun && typeof triggerStatus.lastRun === "object" ? triggerStatus.lastRun : null;
  var stabilizationMode = isSystemStabilizationModeActive_();
  var manualProbeEnabled = isManualSingleSendProbeEnabled_() === true;
  var productionSendsEnabled = CONFIG.ENABLE_PRODUCTION_EMAIL_SENDS === true && stabilizationMode !== true;
  var batchSendsEnabled = isBatchSendEnabled_() === true;
  var triggerSendsEnabled = isTriggerSendEnabled_() === true;
  var automatedRunnerEnabled = CONFIG.ENABLE_AUTOMATED_STAGE_RUNNER === true && triggerSendsEnabled === true;
  var manualStatus = getManualSendProbeStatus_() || {};
  var lastBlockedReason = stabilizationMode
    ? (manualProbeEnabled ? "" : "SYSTEM_STABILIZATION_MODE_ACTIVE")
    : (!productionSendsEnabled ? "PRODUCTION_EMAIL_SENDS_DISABLED" : "");
  var propertyWarning = "";
  var expectedPropertyCount = Math.max(0, Number(CONFIG.EXPECTED_SCRIPT_PROPERTY_COUNT_AFTER_CLEANUP || 0));
  if (Number(propertySummary.commLastCount || 0) > 0) propertyWarning = "COMM_LAST_PROPERTY_REGRESSION";
  else if (expectedPropertyCount && Number(propertySummary.totalPropertyCount || 0) > expectedPropertyCount) propertyWarning = "SCRIPT_PROPERTY_COUNT_GREW";
  return {
    ok: true,
    actorEmail: adminEmail,
    runtime: {
      version: clean_(runtime.version || CONFIG.VERSION || ""),
      deployVersion: Number(runtime.deployVersion || CONFIG.DEPLOY_VERSION_NUMBER || 0),
      mismatch: runtime.mismatch === true,
      warning: clean_(runtime.warning || ""),
      canonicalAdminUrl: clean_(runtime.canonicalAdminUrl || CONFIG.WEBAPP_URL_ADMIN || ""),
      canonicalStudentUrl: clean_(runtime.canonicalStudentUrl || CONFIG.WEBAPP_URL_STUDENT || "")
    },
    gates: {
      stabilizationMode: stabilizationMode,
      productionSendsEnabled: productionSendsEnabled,
      manualProbeMode: manualProbeEnabled,
      manualSendEnabled: manualProbeEnabled,
      batchPreviewMode: isBatchPreviewModeEnabled_() === true,
      batchSendEnabled: batchSendsEnabled,
      triggerSendsEnabled: triggerSendsEnabled,
      automatedStageRunnerEnabled: automatedRunnerEnabled,
      bounceIngestionEnabled: CONFIG.ENABLE_BOUNCE_INGESTION === true && stabilizationMode !== true,
      dailyCap: Number(CONFIG.DAILY_SEND_CAP || CONFIG.AUTOMATED_STAGE_DAILY_CAP || 0),
      automatedDailyCap: Number(CONFIG.AUTOMATED_STAGE_DAILY_CAP || CONFIG.DAILY_SEND_CAP || 0),
      perRunCap: Number(CONFIG.PER_RUN_BATCH_SIZE || CONFIG.DEFAULT_STAGE_BATCH_SIZE || 0),
      maxPerRunCap: Number(CONFIG.MAX_PER_RUN_BATCH_SIZE || CONFIG.MAX_STAGE_BATCH_SIZE || 0),
      lastBlockedReason: lastBlockedReason
    },
    trigger: {
      installed: !!(triggerStatus && triggerStatus.triggerInspection && triggerStatus.triggerInspection.ok === true && Number(triggerStatus.triggerCount || 0) > 0),
      triggerCount: triggerStatus ? triggerStatus.triggerCount : null,
      functionName: clean_(triggerStatus && triggerStatus.functionName || ""),
      inspectionOk: !!(triggerStatus && triggerStatus.triggerInspection && triggerStatus.triggerInspection.ok),
      inspectionCode: clean_(triggerStatus && triggerStatus.triggerInspection && triggerStatus.triggerInspection.error && triggerStatus.triggerInspection.error.code || ""),
      inspectionMessage: clean_(triggerStatus && triggerStatus.triggerInspection && triggerStatus.triggerInspection.error && triggerStatus.triggerInspection.error.message || triggerStatus && triggerStatus.error || "")
    },
    automation: {
      lastRun: clean_(lastRun && (lastRun.writtenAt || lastRun.timestamp || lastRun.startedAt) || ""),
      lastSuccessfulRun: clean_(lastRun && lastRun.lastSuccessfulRun || ""),
      lastFailedRun: clean_(lastRun && lastRun.lastFailedRun || ""),
      consecutiveFailures: Number(lastRun && lastRun.consecutiveFailures || 0),
      queueScanDurationMs: Number(lastRun && lastRun.elapsedMs || 0),
      batchSizeUsed: Number(lastRun && (lastRun.effectiveRunSize || lastRun.batchSize || 0) || 0),
      dailySendCount: Number(triggerStatus && triggerStatus.sentToday || lastRun && lastRun.dailyUsedAfter || 0),
      dailyCapRemaining: Math.max(0, Number(triggerStatus && triggerStatus.dailyCap || 0) - Number(triggerStatus && triggerStatus.sentToday || 0)),
      lastBatchId: clean_(lastRun && (lastRun.batchId || lastRun.batchLabel || lastRun.requestId || lastRun.debugId) || ""),
      lastBatchResult: clean_(lastRun && (lastRun.result || lastRun.blockCode || lastRun.message || "") || "")
    },
    propertyHealth: {
      totalPropertyCount: Number(propertySummary.totalPropertyCount || 0),
      totalSerializedSizeEstimate: Number(propertySummary.totalSerializedSizeEstimate || 0),
      commLastCount: Number(propertySummary.commLastCount || 0),
      eligibleCommLastDeletionCount: Number(propertySummary.eligibleCommLastDeletionCount || 0),
      protectedCount: Number(propertySummary.protectedCount || 0),
      healthLevel: propertyHealthLevel_(propertySummary),
      warning: propertyWarning,
      countLimit: Number(CONFIG.SCRIPT_PROPERTY_HEALTH_COUNT_LIMIT || 500),
      sizeLimit: Number(CONFIG.SCRIPT_PROPERTY_HEALTH_SIZE_LIMIT || 500000)
    },
    manualProbe: {
      enabled: manualProbeEnabled,
      lastManualSend: clean_(manualStatus.sentAt || manualStatus.recordedAt || ""),
      lastManualRecipient: clean_(manualStatus.maskedRecipient || ""),
      lastManualResult: clean_(manualStatus.result || ""),
      idempotencyActive: true,
      lastIdempotencyKey: clean_(manualStatus.idempotencyKey || "")
    },
    bounceVisibility: bounceVisibility,
    cooldown: {
      source: "CacheService.getScriptCache",
      ttlSeconds: Number(CONFIG.COMMUNICATION_COOLDOWN_CACHE_TTL_SECONDS || 3600),
      maxTtlSeconds: Number(CONFIG.COMMUNICATION_COOLDOWN_CACHE_MAX_TTL_SECONDS || 21600),
      scriptPropertiesCommLastWritesEnabled: false
    }
  };
}

function admin_runAutomatedStageBatchOnce(payload) {
  return withEnvelope_("admin_runAutomatedStageBatchOnce", function () {
    var adminEmail = getActiveUserEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    requireSuperAdmin_(adminEmail);
    var p = payload && typeof payload === "object" ? payload : {};
    return runAutomatedStageBatchWithLock_({
      source: "ADMIN",
      force: p.force === true,
      forceBounceIngestion: p.forceBounceIngestion === true
    });
  });
}

function admin_installAutomatedStageRunnerTrigger(payload) {
  return withEnvelope_("admin_installAutomatedStageRunnerTrigger", function () {
    var adminEmail = getActiveUserEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    requireSuperAdmin_(adminEmail);
    logOperationalBlock_("STABILIZATION_TRIGGER_BLOCK", {
      action: "admin_install_automated_stage_runner_trigger",
      actor: clean_(adminEmail || "")
    });
    return ensureAutomatedStageRunnerTrigger_();
  });
}

function admin_removeAutomatedStageRunnerTrigger(payload) {
  return withEnvelope_("admin_removeAutomatedStageRunnerTrigger", function () {
    var adminEmail = getActiveUserEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    requireSuperAdmin_(adminEmail);
    logOperationalBlock_("STABILIZATION_TRIGGER_BLOCK", {
      action: "admin_remove_automated_stage_runner_trigger",
      actor: clean_(adminEmail || "")
    });
    return removeAutomatedStageRunnerTrigger_();
  });
}

function admin_campaignSendLegacyFollowups(payload) {
  return withEnvelope_("admin_campaignSendLegacyFollowups", function () {
    var adminEmail = getActiveUserEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    requireSuperAdmin_(adminEmail);
    var p = payload || {};
    if (isSystemStabilizationModeActive_() || CONFIG.ENABLE_PRODUCTION_EMAIL_SENDS !== true) {
      var blockCode = isSystemStabilizationModeActive_() ? "SYSTEM_STABILIZATION_MODE_ACTIVE" : "PRODUCTION_EMAIL_SENDS_DISABLED";
      if (isSystemStabilizationModeActive_()) logOperationalBlock_("SYSTEM_STABILIZATION_MODE_ACTIVE", {
        action: "campaign_send_legacy_followups",
        actorEmail: clean_(adminEmail || "")
      });
      logOperationalBlock_("EMAIL_SEND_BLOCKED", {
        action: "campaign_send_legacy_followups",
        blockCode: blockCode,
        actorEmail: clean_(adminEmail || "")
      });
      return adminCommBlockedResult_("campaign_send_legacy_followups", blockCode, "", {
        blockReason: "Legacy campaign follow-up sends are disabled during stabilization."
      });
    }
    return campaign_sendLegacyFollowups_(p.limit);
  });
}

function admin_campaignGetLegacyEmailSummary(payload) {
  return withEnvelope_("admin_campaignGetLegacyEmailSummary", function () {
    var adminEmail = getActiveUserEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    return campaign_getLegacyEmailSummary_();
  });
}

function resolveAdminCommActor_(payload) {
  var p = payload && typeof payload === "object" ? payload : {};
  var trusted = parseOverrideFlag_(p, "trustedInternal") || parseOverrideFlag_(p, "internal");
  var serverEmail = clean_(getActiveUserEmail_() || "");
  var actorEmail = serverEmail || (trusted ? clean_(p.actorEmail || "") : "");
  var actorRole = serverEmail ? clean_(getAdminRole_(serverEmail) || "") : "";
  if (!actorRole && trusted) actorRole = clean_(p.actorRole || "");
  actorRole = String(actorRole || "VERIFIER").toUpperCase();
  return {
    actorEmail: actorEmail || "",
    actorRole: actorRole,
    isSuper: actorRole === "SUPER"
  };
}

function adminCommBlockedResult_(action, blockCode, debugId, extra) {
  var more = extra && typeof extra === "object" ? extra : {};
  return {
    ok: false,
    action: clean_(action || ""),
    result: "BLOCKED",
    eligible: false,
    blockCode: clean_(blockCode || "BLOCKED"),
    blockReason: clean_(more.blockReason || ""),
    applicantId: clean_(more.applicantId || ""),
    messageType: clean_(more.messageType || ""),
    effectiveEmail: clean_(more.effectiveEmail || ""),
    filterType: clean_(more.filterType || ""),
    limit: Number(more.limit || 0),
    debugId: clean_(debugId || adminDebugId_())
  };
}

function admin_runFdAcknowledgementForApplicant(payload) {
  return withEnvelope_("admin_runFdAcknowledgementForApplicant", function (dbgId) {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    var p = payload && typeof payload === "object" ? payload : {};
    if (Array.isArray(p.applicantIds) || Array.isArray(p.recipients) || Array.isArray(p.messages)) {
      return adminCommBlockedResult_("fd_acknowledgement", "BULK_NOT_ALLOWED", dbgId, {
        blockReason: "fd_acknowledgement accepts one ApplicantID only."
      });
    }
    var applicantId = clean_(p.applicantId || p.ApplicantID || "");
    var dryRun = p.dryRun !== false;
    if (!applicantId) {
      return adminCommBlockedResult_("fd_acknowledgement", "MISSING_APPLICANT_ID", dbgId, {
        blockReason: "ApplicantID is required."
      });
    }
    if (!dryRun) {
      requireSuperAdmin_(adminEmail);
      var confirmedSingleSend = p.confirmFdAcknowledgementSingleSend === true || p.confirmManualSingleSend === true;
      if (confirmedSingleSend !== true || clean_(p.confirmApplicantId || "") !== applicantId) {
        return adminCommBlockedResult_("fd_acknowledgement", "CONFIRM_REQUIRED", dbgId, {
          applicantId: applicantId,
          messageType: "fd_acknowledgement",
          blockReason: "Live fd_acknowledgement send requires explicit single-ApplicantID confirmation."
        });
      }
      var opsGate = runOpsSafeModeGate_("applicant_email_send", {
        payload: p,
        adminEmail: adminEmail,
        applicantId: applicantId,
        debugId: dbgId
      });
      if (opsGate && opsGate.ok !== true) {
        return adminCommBlockedResult_("fd_acknowledgement", safeStr_(opsGate.blockCode || "OPS_SAFE_MODE_ACTION_BLOCKED"), dbgId, {
          applicantId: applicantId,
          messageType: "fd_acknowledgement",
          blockReason: safeStr_(opsGate.blockReason || "Ops Safe Mode blocked this action."),
          safeMode: opsGate.safeMode === true,
          diagnosticsLabel: safeStr_(opsGate.diagnosticsLabel || "OPS_SAFE_MODE_ACTION_BLOCKED")
        });
      }
    }
    return runFdAcknowledgementForApplicantId_(applicantId, {
      dryRun: dryRun,
      debugId: clean_(p.debugId || dbgId),
      source: dryRun ? "admin_dry_run" : "admin_single",
      manualSingleSendProbe: !dryRun && p.confirmManualSingleSend === true,
      unattended: dryRun ? true : false,
      sendSource: dryRun ? "FD_ACK_DRY_RUN" : "FD_ACK_MANUAL_SINGLE"
    });
  });
}

function getOpsClassroomAdminRecipients_() {
  var configured = Array.isArray(CONFIG.OPS_CLASSROOM_ADMIN_EMAILS) ? CONFIG.OPS_CLASSROOM_ADMIN_EMAILS : [];
  var fallback = Array.isArray(CONFIG.INTERNAL_FINANCE_EMAILS) ? CONFIG.INTERNAL_FINANCE_EMAILS : [];
  var src = configured.length ? configured : fallback;
  var out = [];
  var seen = {};
  for (var i = 0; i < src.length; i++) {
    var email = clean_(src[i] || "").toLowerCase();
    if (!email || seen[email]) continue;
    if (typeof isValidEmail_ === "function" && !isValidEmail_(email)) continue;
    seen[email] = true;
    out.push(email);
  }
  return out;
}

function isOpsSafeModeSource_(payload) {
  var p = payload && typeof payload === "object" ? payload : {};
  return clean_(p.sourceSurface || p.sourceView || "").toLowerCase() === "ops";
}

function logOpsSafeModeEvent_(label, payload) {
  var eventLabel = clean_(label || "OPS_SAFE_MODE_ACTION_BLOCKED");
  var body = payload && typeof payload === "object" ? payload : {};
  body.label = eventLabel;
  if (typeof logAdminEvent_ === "function") {
    logAdminEvent_(eventLabel, body);
    return;
  }
  try {
    Logger.log(eventLabel + " " + JSON.stringify(body));
  } catch (_opsLogErr) {}
}

function buildOpsSafeModeRowIdentity_(rowObj, rowNumber) {
  var row = rowObj && typeof rowObj === "object" ? rowObj : {};
  var first = clean_(row.First_Name || row.Student_First_Name || row.name || "");
  var last = clean_(row.Last_Name || row.Student_Last_Name || "");
  return {
    applicantId: clean_(row.ApplicantID || ""),
    rowNumber: Number(rowNumber || row._rowNumber || 0),
    email: clean_(row.Effective_Email || row.Parent_Email_Corrected || row.Parent_Email || row.Email || "").toLowerCase(),
    fullName: clean_((first + " " + last).trim() || row.Student_Name || row.Full_Name || "")
  };
}

function findOpsSafeModeTargetMatches_(approvedTarget) {
  var cfg = approvedTarget && typeof approvedTarget === "object" ? approvedTarget : {};
  var applicantId = clean_(cfg.applicantId || "");
  var email = clean_(cfg.rowEmail || cfg.email || "").toLowerCase();
  var fullName = clean_(cfg.fullName || "");
  var out = [];
  if (applicantId) {
    var shById = getWorkingSheet_();
    var rowNumberById = findRowByApplicantId_(shById, applicantId);
    if (rowNumberById) {
      var rowObjById = getRowObject_(shById, rowNumberById);
      rowObjById._rowNumber = rowNumberById;
      out.push(buildOpsSafeModeRowIdentity_(rowObjById, rowNumberById));
    }
    return { priority: "applicantId", matches: out };
  }
  var sh = getWorkingSheet_();
  var values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return { priority: email ? "email" : (fullName ? "fullName" : ""), matches: [] };
  var headers = values[0];
  function idxOf(name) {
    for (var i = 0; i < headers.length; i++) {
      if (String(headers[i] || "").trim() === name) return i;
    }
    return -1;
  }
  var idxApplicant = idxOf("ApplicantID");
  var idxEffective = idxOf("Effective_Email");
  var idxParentCorrected = idxOf("Parent_Email_Corrected");
  var idxParent = idxOf("Parent_Email");
  var idxEmail = idxOf("Email");
  var idxFirst = idxOf("First_Name");
  var idxStudentFirst = idxOf("Student_First_Name");
  var idxName = idxOf("name");
  var idxLast = idxOf("Last_Name");
  var idxStudentLast = idxOf("Student_Last_Name");
  var idxStudentName = idxOf("Student_Name");
  var idxFullName = idxOf("Full_Name");
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var rowApplicantId = idxApplicant >= 0 ? clean_(row[idxApplicant]) : "";
    var rowEmail = clean_(
      (idxEffective >= 0 ? row[idxEffective] : "")
      || (idxParentCorrected >= 0 ? row[idxParentCorrected] : "")
      || (idxParent >= 0 ? row[idxParent] : "")
      || (idxEmail >= 0 ? row[idxEmail] : "")
    ).toLowerCase();
    var rowFirst = clean_((idxFirst >= 0 ? row[idxFirst] : "") || (idxStudentFirst >= 0 ? row[idxStudentFirst] : "") || (idxName >= 0 ? row[idxName] : ""));
    var rowLast = clean_((idxLast >= 0 ? row[idxLast] : "") || (idxStudentLast >= 0 ? row[idxStudentLast] : ""));
    var rowFullName = clean_((rowFirst + " " + rowLast).trim() || (idxStudentName >= 0 ? row[idxStudentName] : "") || (idxFullName >= 0 ? row[idxFullName] : ""));
    if (email && rowEmail === email) {
      out.push({ applicantId: rowApplicantId, rowNumber: r + 1, email: rowEmail, fullName: rowFullName });
      continue;
    }
    if (!email && fullName && rowFullName === fullName) {
      out.push({ applicantId: rowApplicantId, rowNumber: r + 1, email: rowEmail, fullName: rowFullName });
    }
  }
  return { priority: email ? "email" : "fullName", matches: out };
}

function runOpsSafeModeGate_(actionType, options) {
  var opt = options && typeof options === "object" ? options : {};
  var payload = opt.payload && typeof opt.payload === "object" ? opt.payload : {};
  if (!isOpsSafeModeSource_(payload)) return { ok: true, safeMode: false, bypassed: true };
  var adminEmail = clean_(opt.adminEmail || "");
  var applicantId = clean_(opt.applicantId || payload.applicantId || "");
  var dbgId = clean_(opt.debugId || payload.debugId || "");
  var action = clean_(actionType || "");
  var allowAction = (action === "applicant_email_send" && CONFIG.OPS_SAFE_MODE_ALLOW_APPLICANT_EMAIL_SENDS === true)
    || (action === "classroom_notify" && CONFIG.OPS_SAFE_MODE_ALLOW_CLASSROOM_NOTIFY === true);
  var actionRole = getAdminRole_(adminEmail);
  var operationsApplicantSendAllowed = actionRole === "OPERATIONS" && action === "applicant_email_send";
  logOpsSafeModeEvent_("OPS_SAFE_MODE_ACTION_REQUESTED", {
    actionType: action,
    operator: adminEmail,
    applicantId: applicantId,
    debugId: dbgId
  });
  if (actionRole !== "SUPER" && !operationsApplicantSendAllowed) {
    logOpsSafeModeEvent_("OPS_SAFE_MODE_ACTION_BLOCKED", {
      actionType: action,
      operator: adminEmail,
      applicantId: applicantId,
      debugId: dbgId,
      blockCode: "OPS_SAFE_MODE_AUTHORIZED_ROLE_REQUIRED"
    });
    return {
      ok: false,
      safeMode: true,
      diagnosticsLabel: "OPS_SAFE_MODE_ACTION_BLOCKED",
      blockCode: "OPS_SAFE_MODE_AUTHORIZED_ROLE_REQUIRED",
      blockReason: "Ops Safe Mode action requires an authorized Operations Admin or Super Admin."
    };
  }
  if (!allowAction) {
    logOpsSafeModeEvent_("OPS_SAFE_MODE_ACTION_BLOCKED", {
      actionType: action,
      operator: adminEmail,
      applicantId: applicantId,
      debugId: dbgId,
      blockCode: "OPS_SAFE_MODE_ACTION_NOT_ALLOWED"
    });
    return {
      ok: false,
      safeMode: true,
      diagnosticsLabel: "OPS_SAFE_MODE_ACTION_BLOCKED",
      blockCode: "OPS_SAFE_MODE_ACTION_NOT_ALLOWED",
      blockReason: "This Ops action is not enabled."
    };
  }
  var runtime = null;
  try {
    runtime = typeof buildRuntimeTruth_ === "function" ? buildRuntimeTruth_({ parameter: { view: "ops" } }, "admin") : null;
  } catch (_runtimeErr) {}
  if (runtime && runtime.ok === true && runtime.mismatch === true) {
    logOpsSafeModeEvent_("OPS_SAFE_MODE_ACTION_BLOCKED", {
      actionType: action,
      operator: adminEmail,
      applicantId: applicantId,
      debugId: dbgId,
      blockCode: "OPS_SAFE_MODE_RUNTIME_MISMATCH"
    });
    return {
      ok: false,
      safeMode: true,
      diagnosticsLabel: "OPS_SAFE_MODE_ACTION_BLOCKED",
      blockCode: "OPS_SAFE_MODE_RUNTIME_MISMATCH",
      blockReason: "Runtime identity mismatch. Verify Admin and Student whoami before running Ops Safe Mode actions."
    };
  }
  if (!applicantId) {
    logOpsSafeModeEvent_("OPS_SAFE_MODE_ACTION_BLOCKED", {
      actionType: action,
      operator: adminEmail,
      debugId: dbgId,
      blockCode: "OPS_SAFE_MODE_MISSING_TARGET"
    });
    return {
      ok: false,
      safeMode: true,
      diagnosticsLabel: "OPS_SAFE_MODE_ACTION_BLOCKED",
      blockCode: "OPS_SAFE_MODE_MISSING_TARGET",
      blockReason: "Select a single applicant before running this Ops action."
    };
  }
  if (Array.isArray(payload.applicantIds) || Array.isArray(payload.recipients) || Array.isArray(payload.messages)) {
    logOpsSafeModeEvent_("OPS_SAFE_MODE_ACTION_BLOCKED", {
      actionType: action,
      operator: adminEmail,
      applicantId: applicantId,
      debugId: dbgId,
      blockCode: "OPS_SAFE_MODE_BULK_NOT_ALLOWED"
    });
    return {
      ok: false,
      safeMode: true,
      diagnosticsLabel: "OPS_SAFE_MODE_ACTION_BLOCKED",
      blockCode: "OPS_SAFE_MODE_BULK_NOT_ALLOWED",
      blockReason: "Ops Safe Mode permits single-record actions only."
    };
  }
  if (CONFIG.OPS_SAFE_MODE_ENABLED !== true) {
    var disabledSafeModeAllowedLabel = actionRole === "SUPER" ? "OPS_SUPER_ADMIN_PARITY_ALLOWED" : "OPS_OPERATIONS_ADMIN_ALLOWED";
    logOpsSafeModeEvent_(disabledSafeModeAllowedLabel, {
      actionType: action,
      operator: adminEmail,
      applicantId: applicantId,
      debugId: dbgId,
      reason: actionRole === "SUPER" ? "ops_safe_mode_disabled_but_super_admin_selected_applicant_parity" : "ops_safe_mode_disabled_but_authorized_operations_admin_selected_applicant"
    });
    return {
      ok: true,
      safeMode: false,
      authorizedRole: actionRole,
      diagnosticsLabel: disabledSafeModeAllowedLabel
    };
  }
  var allowedLabel = actionRole === "SUPER" ? "OPS_SUPER_ADMIN_PARITY_ALLOWED" : "OPS_OPERATIONS_ADMIN_ALLOWED";
  logOpsSafeModeEvent_(allowedLabel, {
    actionType: action,
    operator: adminEmail,
    applicantId: applicantId,
    debugId: dbgId,
    reason: actionRole === "SUPER" ? "approved_target_gate_bypassed_for_super_admin_selected_applicant" : "authorized_operations_admin_selected_applicant_after_existing_safe_mode_gates"
  });
  return {
    ok: true,
    safeMode: false,
    authorizedRole: actionRole,
    diagnosticsLabel: allowedLabel
  };
}

function buildOpsClassroomHandoverContext_(applicantId, dbgId) {
  var id = clean_(applicantId || "");
  if (!id) {
    return {
      ok: false,
      result: "BLOCKED",
      blockCode: "MISSING_APPLICANT_ID",
      blockReason: "Applicant ID is required.",
      applicantId: "",
      debugId: dbgId
    };
  }
  var sh = getWorkingSheet_();
  var rowNumber = findRowByApplicantId_(sh, id);
  if (!rowNumber) {
    return {
      ok: false,
      result: "BLOCKED",
      blockCode: "APPLICANT_NOT_FOUND",
      blockReason: "Applicant was not found.",
      applicantId: id,
      debugId: dbgId
    };
  }
  var rowObj = getRowObject_(sh, rowNumber);
  rowObj._rowNumber = rowNumber;
  var recipients = getOpsClassroomAdminRecipients_();
  if (!recipients.length) {
    return {
      ok: false,
      result: "BLOCKED",
      blockCode: "NO_INTERNAL_CLASSROOM_RECIPIENT",
      blockReason: "No internal classroom admin recipient is configured.",
      applicantId: id,
      debugId: dbgId
    };
  }
  var firstName = clean_(rowObj.First_Name || rowObj.Student_First_Name || rowObj.name || "");
  var lastName = clean_(rowObj.Last_Name || rowObj.Student_Last_Name || "");
  var studentName = clean_((firstName + " " + lastName).trim() || rowObj.Student_Name || rowObj.Full_Name || id);
  var paymentVerified = isCanonicalPaymentVerified_(rowObj);
  var enrolledConfirmed = clean_(rowObj.Enrolled_Confirmed || "").toUpperCase() === "YES";
  if (!paymentVerified || !enrolledConfirmed) {
    return {
      ok: false,
      result: "BLOCKED",
      blockCode: "CLASSROOM_HANDOVER_NOT_READY",
      blockReason: "Classroom notification requires payment verified and enrolled confirmed.",
      applicantId: id,
      rowNumber: rowNumber,
      debugId: dbgId
    };
  }
  var level = clean_(rowObj.FODE_Level || rowObj.Grade_Applying_For || rowObj.Upgrade_Grade_Stream || rowObj.Grade || "Unknown");
  var subjects = clean_(rowObj.Subjects_Selected_Canonical || rowObj.Selected_Subjects || rowObj.Subjects || "Unknown");
  var invoiceNumber = clean_(rowObj.Books_Invoice_Number || rowObj.Invoice_Number || "Unknown");
  var invoiceStatus = clean_(rowObj.Books_Invoice_Status || rowObj.Invoice_Status || "Unknown");
  var classroomStatus = clean_(rowObj.Classroom_Status || rowObj.Classroom_Handover_Status || "Classroom Pending");
  var subject = "FODE classroom handover review: " + id + " - " + studentName;
  var body = [
    "FODE Classroom Handover Review",
    "",
    "Applicant ID: " + id,
    "Student: " + studentName,
    "Grade / FODE level: " + level,
    "Selected subjects: " + subjects,
    "Invoice: " + invoiceNumber + " / " + invoiceStatus,
    "Payment verified: YES",
    "Enrolled confirmed: YES",
    "Classroom handover status: " + classroomStatus,
    "",
    "Operator action: review classroom package readiness and LMS/timetable provisioning.",
    "",
    "This Ops cockpit action sends an internal notification only. It does not update classroom, enrolment, payment, or invoice fields.",
    "",
    "Debug ID: " + dbgId
  ].join("\n");
  return {
    ok: true,
    result: "PREVIEW",
    eligible: true,
    applicantId: id,
    rowNumber: rowNumber,
    studentName: studentName,
    recipients: recipients,
    effectiveEmail: recipients.join(", "),
    subject: subject,
    body: body,
    debugId: dbgId
  };
}

function admin_previewOpsClassroomHandover(payload) {
  return withEnvelope_("admin_previewOpsClassroomHandover", function (dbgId) {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) return err_("ACCESS_DENIED", "Access denied", dbgId);
    var p = payload && typeof payload === "object" ? payload : {};
    if (Array.isArray(p.applicantIds) || Array.isArray(p.recipients)) {
      return adminCommBlockedResult_("preview_classroom_handover", "BULK_NOT_ALLOWED", dbgId, {
        blockReason: "Classroom handover preview accepts one applicant only."
      });
    }
    var ctx = buildOpsClassroomHandoverContext_(p.applicantId, dbgId);
    if (ctx.ok !== true) return adminCommBlockedResult_("preview_classroom_handover", ctx.blockCode, dbgId, ctx);
    logAdminEvent_("OPS_CLASSROOM_HANDOVER_PREVIEW", {
      operator: adminEmail,
      applicantId: ctx.applicantId,
      rowNumber: ctx.rowNumber,
      recipients: ctx.effectiveEmail,
      debugId: dbgId
    });
    return ctx;
  });
}

function admin_notifyOpsClassroomAdmin(payload) {
  return withEnvelope_("admin_notifyOpsClassroomAdmin", function (dbgId) {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) return err_("ACCESS_DENIED", "Access denied", dbgId);
    requireSuperAdmin_(adminEmail);
    var p = payload && typeof payload === "object" ? payload : {};
    if (Array.isArray(p.applicantIds) || Array.isArray(p.recipients) || Array.isArray(p.messages)) {
      return adminCommBlockedResult_("notify_classroom_admin", "BULK_NOT_ALLOWED", dbgId, {
        blockReason: "Classroom notification accepts one applicant only."
      });
    }
    if (p.confirmInternalSingleSend !== true) {
      return adminCommBlockedResult_("notify_classroom_admin", "CONFIRM_REQUIRED", dbgId, {
        applicantId: clean_(p.applicantId || ""),
        blockReason: "Preview and explicit internal single-send confirmation are required."
      });
    }
    var opsGate = runOpsSafeModeGate_("classroom_notify", {
      payload: p,
      adminEmail: adminEmail,
      applicantId: clean_(p.applicantId || ""),
      debugId: dbgId
    });
    if (opsGate && opsGate.ok !== true) {
      return adminCommBlockedResult_("notify_classroom_admin", safeStr_(opsGate.blockCode || "OPS_SAFE_MODE_ACTION_BLOCKED"), dbgId, {
        applicantId: clean_(p.applicantId || ""),
        blockReason: safeStr_(opsGate.blockReason || "Ops Safe Mode blocked this action."),
        safeMode: opsGate.safeMode === true,
        diagnosticsLabel: safeStr_(opsGate.diagnosticsLabel || "OPS_SAFE_MODE_ACTION_BLOCKED")
      });
    }
    var ctx = buildOpsClassroomHandoverContext_(p.applicantId, dbgId);
    if (ctx.ok !== true) return adminCommBlockedResult_("notify_classroom_admin", ctx.blockCode, dbgId, ctx);
    var sent = adminSendEmail_(ctx.recipients.join(","), ctx.subject, ctx.body, {
      replyTo: safeStr_(CONFIG.EMAIL_REPLY_TO || CONFIG.DOCS_FOLLOWUP_REPLY_TO || ""),
      name: safeStr_(CONFIG.EMAIL_FROM_NAME || "FODE Admissions"),
      senderMode: safeStr_(CONFIG.EMAIL_SENDER_MODE || "DEFAULT")
    });
    if (!sent || sent.ok !== true) {
      logOpsSafeModeEvent_("OPS_SAFE_MODE_ACTION_FAILED", {
        actionType: "classroom_notify",
        operator: adminEmail,
        applicantId: ctx.applicantId,
        rowNumber: ctx.rowNumber,
        debugId: dbgId
      });
      logAdminEvent_("OPS_CLASSROOM_HANDOVER_NOTIFY", {
        operator: adminEmail,
        applicantId: ctx.applicantId,
        rowNumber: ctx.rowNumber,
        outcome: "FAILED",
        error: safeStr_(sent && sent.error || "Email send failed"),
        debugId: dbgId
      });
      return {
        ok: true,
        result: "FAILED",
        eligible: false,
        blockCode: "EMAIL_SEND_FAILED",
        blockReason: safeStr_(sent && sent.error || "Email send failed"),
        applicantId: ctx.applicantId,
        effectiveEmail: ctx.effectiveEmail,
        subject: ctx.subject,
        debugId: dbgId
      };
    }
    logOpsSafeModeEvent_("OPS_SAFE_MODE_ACTION_COMPLETED", {
      actionType: "classroom_notify",
      operator: adminEmail,
      applicantId: ctx.applicantId,
      rowNumber: ctx.rowNumber,
      debugId: dbgId
    });
    logAdminEvent_("OPS_CLASSROOM_HANDOVER_NOTIFY", {
      operator: adminEmail,
      applicantId: ctx.applicantId,
      rowNumber: ctx.rowNumber,
      outcome: "SENT",
      recipients: ctx.effectiveEmail,
      debugId: dbgId
    });
    return {
      ok: true,
      action: "notify_classroom_admin",
      result: "SENT",
      eligible: true,
      applicantId: ctx.applicantId,
      effectiveEmail: ctx.effectiveEmail,
      subject: ctx.subject,
      body: ctx.body,
      debugId: dbgId
    };
  });
}

function admin_planApplicantBatch(payload) {
  return withEnvelope_("admin_planApplicantBatch", function (dbgId) {
    var adminEmail = getActiveUserEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    var p = payload && typeof payload === "object" ? payload : {};
    var requestedFilter = clean_(p.filterType || "");
    var filterType = normalizeApplicantBatchFilterType_(requestedFilter);
    var rawLimit = Number(p.limit || 0);
    var limit = Math.max(1, Math.min(100, Math.floor(rawLimit || 0)));
    var actor = resolveAdminCommActor_(p);
    if (!filterType) {
      return adminCommBlockedResult_("plan", "UNSUPPORTED_FILTER_TYPE", dbgId, {
        filterType: requestedFilter,
        limit: rawLimit,
        blockReason: "Unsupported filter type."
      });
    }
    if (!(rawLimit > 0)) {
      return adminCommBlockedResult_("plan", "INVALID_LIMIT", dbgId, {
        filterType: filterType,
        limit: rawLimit,
        blockReason: "Limit must be a positive integer."
      });
    }
    if (!actor.isSuper) {
      return adminCommBlockedResult_("plan", "ROLE_BLOCKED", dbgId, {
        filterType: filterType,
        limit: limit,
        blockReason: "Your role is not allowed to perform this action."
      });
    }
    return planApplicantBatch_(filterType, limit, {
      actorEmail: actor.actorEmail,
      actorRole: actor.actorRole,
      batchLabel: clean_(p.batchLabel || ""),
      debugId: clean_(p.debugId || dbgId)
    });
  });
}

function admin_planLegacyInviteBatch(payload) {
  var p = payload && typeof payload === "object" ? payload : {};
  var merged = {};
  Object.keys(p).forEach(function (k) { merged[k] = p[k]; });
  merged.filterType = "legacy_invite_eligible";
  return admin_planApplicantBatch(merged);
}

function adminDryRunFirst50LegacyInvites() {
  var ss = SpreadsheetApp.openById('1fHmeGNmpOj9PEPQ5Fp4tUyCP4UdH70lltukraD4SalU');
  var sh = ss.getSheetByName('FODE_Applications_2026');
  if (!sh) throw new Error('Missing sheet: FODE_Applications_2026');

  var values = sh.getDataRange().getDisplayValues();
  if (!values || values.length < 2) {
    return {
      ok: true,
      dryRun: true,
      scanned: 0,
      eligible: 0,
      blocked: 0,
      failed: 0,
      firstEligibleApplicantId: '',
      lastEligibleApplicantId: ''
    };
  }

  var headers = values[0];
  var idIdx = headers.indexOf('ApplicantID');
  if (idIdx < 0) throw new Error('Missing ApplicantID header');

  var summary = {
    ok: true,
    dryRun: true,
    scanned: 0,
    eligible: 0,
    blocked: 0,
    failed: 0,
    firstEligibleApplicantId: '',
    lastEligibleApplicantId: ''
  };

  for (var r = 1; r < values.length; r++) {
    if (summary.eligible >= 50) break;

    var applicantId = String(values[r][idIdx] || '').trim();
    if (!applicantId) continue;

    summary.scanned++;

    try {
      var preview = admin_previewApplicantMessage({
        applicantId: applicantId,
        messageType: 'legacy_invite'
      });

      if (preview && preview.ok === true) {
        summary.eligible++;
        if (!summary.firstEligibleApplicantId) summary.firstEligibleApplicantId = applicantId;
        summary.lastEligibleApplicantId = applicantId;
      } else {
        summary.blocked++;
      }
    } catch (err) {
      summary.failed++;
    }
  }

  console.log('DRYRUN_50 ' + JSON.stringify(summary));
  return summary;
}
