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

function isAdmin_(email) {
  email = String(email || "").toLowerCase().trim();
  return (CONFIG.ADMIN_EMAILS || []).map(function (e) {
    return String(e).toLowerCase().trim();
  }).indexOf(email) >= 0;
}

function getAdminRole_(email) {
  var e = String(email || "").toLowerCase().trim();
  var roles = CONFIG.ADMIN_ROLES || {};
  var role = String(roles[e] || "").toUpperCase();
  if (role === "SUPER") return "SUPER";
  if (role === "OPERATIONS") return "OPERATIONS";
  return "VERIFIER";
}

function requireSuperAdmin_(email) {
  if (getAdminRole_(email) !== "SUPER") {
    throw new Error("Access denied: SUPER admin required");
  }
}

function isOperationsAdmin_(email) {
  var role = getAdminRole_(email);
  return role === "SUPER" || role === "OPERATIONS";
}

function requireOperationsAdmin_(email) {
  if (!isOperationsAdmin_(email)) {
    throw new Error("Access denied: Operations Admin required");
  }
}

function isDocumentVerifier_(email) {
  return isAdmin_(email);
}

function requireDocumentVerifier_(email) {
  if (!isDocumentVerifier_(email)) {
    throw new Error("Access denied: document verifier required");
  }
}

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
    var paymentBadge = derivePaymentBadge_(statusRow);
    var docStage = computeDocVerificationStatus_(statusRow);
    var docsFollowupSentAt = getDocsFollowupSentAt_(rowObj);
    var eligibleDocsFollowUp = computeEligibleDocsFollowUp_(rowObj, docsFollowupSentAt);

    out.push({
      rowNumber: r + 1,
      applicantId: rid,
      name: fullName,
      email: effectiveEmail,
      phone: parentPhone,
      docStatus: docStage,
      paymentVerified: paymentBadge === "Verified" ? "Payment Verified" : (paymentBadge === "Rejected" ? "Payment Rejected" : "Payment Pending"),
      portalAccess: clean_(row[idx.Portal_Access_Status - 1]) || "Open",
      eligibleDocsFollowUp: !!eligibleDocsFollowUp,
      docsFollowupSentAt: safeStr_(docsFollowupSentAt || ""),
      stage: stageInfo ? clean_(stageInfo.stage || "") : "",
      priority: stageInfo ? mapStagePriority_(stageInfo.stage || "") : ""
    });
  }

  return { ok: true, rows: out };
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
    var paymentBadge = derivePaymentBadge_(detailObj);
    var overallComputed = computeOverallStatus_(detailObj);
    var paymentVerifiedBool = paymentBadge === "Verified";
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

function adminDocumentManifestTypeForField_(fieldName) {
  var map = {
    Birth_ID_Passport_File: "birth_id",
    Latest_School_Report_File: "school_report",
    Transfer_Certificate_File: "transfer_certificate",
    Passport_Photo_File: "passport_photo",
    Fee_Receipt_File: "payment_receipt"
  };
  return map[clean_(fieldName || "")] || "unknown";
}

function adminDocumentManifestExtension_(fileName) {
  var match = clean_(fileName || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

function adminDocumentManifestMimeExtensionMismatch_(fileName, mimeType) {
  var ext = adminDocumentManifestExtension_(fileName);
  var mime = clean_(mimeType || "").toLowerCase();
  if (!ext || !mime) return false;
  var expected = {
    pdf: ["application/pdf"],
    jpg: ["image/jpeg"],
    jpeg: ["image/jpeg"],
    png: ["image/png"],
    gif: ["image/gif"],
    webp: ["image/webp"],
    doc: ["application/msword"],
    docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
  };
  return !!expected[ext] && expected[ext].indexOf(mime) < 0;
}

function adminDocumentManifestIso_(value) {
  if (!value) return "";
  var date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? "" : date.toISOString();
}

function adminDocumentManifestFileIds_(value, fieldName) {
  var ids = [];
  var seen = {};
  var urls = normalizeToUrlList_(value, fieldName);
  for (var i = 0; i < urls.length; i++) {
    var fileId = extractDriveFileId_(urls[i]);
    if (!fileId || seen[fileId]) continue;
    seen[fileId] = true;
    ids.push(fileId);
  }
  return ids;
}

function adminDocumentManifestParentIds_(file) {
  var out = [];
  var parents = file && file.getParents ? file.getParents() : null;
  while (parents && parents.hasNext()) {
    var parent = parents.next();
    var id = clean_(parent && parent.getId ? parent.getId() : "");
    if (id) out.push(id);
  }
  return out;
}

function adminDocumentManifestFileMetadata_(file, folderId) {
  var parentIds = adminDocumentManifestParentIds_(file);
  var sizeBytes = null;
  try { sizeBytes = Number(file.getSize()); } catch (_sizeErr) {}
  if (!isFinite(sizeBytes)) sizeBytes = null;
  return {
    fileId: clean_(file.getId()),
    fileName: clean_(file.getName()),
    mimeType: clean_(file.getMimeType()),
    sizeBytes: sizeBytes,
    createdTime: adminDocumentManifestIso_(file.getDateCreated()),
    modifiedTime: adminDocumentManifestIso_(file.getLastUpdated()),
    parentFolderId: parentIds.length ? parentIds[0] : "",
    parentFolderIds: parentIds,
    expectedFolderId: clean_(folderId || "")
  };
}

function adminDocumentManifestPrefixField_(fileName, docFields) {
  var name = clean_(fileName || "");
  var docs = Array.isArray(docFields) ? docFields : [];
  for (var i = 0; i < docs.length; i++) {
    var field = clean_(docs[i] && docs[i].file || "");
    if (field && name.indexOf(field + "_") === 0) return field;
  }
  return "";
}

function adminDocumentManifestWarning_(code, detail) {
  return {
    code: clean_(code || "UNKNOWN_WARNING"),
    detail: clean_(detail || "")
  };
}

function admin_getApplicantDocumentManifest(payload) {
  var adminEmail = getCallerEmail_();
  try {
    try {
      requireDocumentVerifier_(adminEmail);
    } catch (_authErr) {
      return { ok: false, code: "ACCESS_DENIED", error: "Access denied: document verifier required" };
    }

    var p = payload && typeof payload === "object" ? payload : {};
    var applicantId = clean_(p.applicantId || p.ApplicantID || "");
    if (!applicantId) {
      return { ok: false, code: "MISSING_APPLICANT_ID", error: "ApplicantID is required" };
    }

    var sheet = openDataSheet_();
    var rowNumber = findRowByApplicantId_(sheet, applicantId);
    if (!rowNumber) {
      return { ok: false, code: "APPLICANT_NOT_FOUND", applicantId: applicantId, error: "Applicant not found" };
    }

    var row = getRowObject_(sheet, rowNumber);
    var rowApplicantId = clean_(row.ApplicantID || row[CONFIG.APPLICANT_ID_HEADER] || applicantId);
    var applicantName = [clean_(row.First_Name || ""), clean_(row.Last_Name || "")].filter(function (v) {
      return !!v;
    }).join(" ");
    var folderUrl = clean_(row.Folder_Url || row[SCHEMA.FOLDER_URL] || "");
    var warnings = [];
    if (!folderUrl) {
      return {
        ok: false,
        code: "MISSING_FOLDER_URL",
        applicantId: rowApplicantId,
        applicantName: applicantName,
        folderUrl: "",
        files: [],
        missingExpected: [],
        warnings: [adminDocumentManifestWarning_("MISSING_FOLDER_URL", "Applicant row has no Folder_Url.")]
      };
    }

    var folderId = folderIdFromUrl_(folderUrl);
    if (!folderId) {
      return {
        ok: false,
        code: "INVALID_FOLDER_URL",
        applicantId: rowApplicantId,
        applicantName: applicantName,
        folderUrl: folderUrl,
        files: [],
        missingExpected: [],
        warnings: [adminDocumentManifestWarning_("INVALID_FOLDER_URL", "Folder_Url does not contain a Drive folder ID.")]
      };
    }

    var folder;
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (folderErr) {
      return {
        ok: false,
        code: "FOLDER_INACCESSIBLE",
        applicantId: rowApplicantId,
        applicantName: applicantName,
        folderId: folderId,
        folderUrl: folderUrl,
        files: [],
        missingExpected: [],
        warnings: [adminDocumentManifestWarning_("FOLDER_INACCESSIBLE", "Drive folder was not found or is not accessible.")]
      };
    }

    var docFields = Array.isArray(CONFIG.DOC_FIELDS) ? CONFIG.DOC_FIELDS : [];
    var fieldByName = {};
    var fieldIds = {};
    var mappedIds = {};
    for (var d = 0; d < docFields.length; d++) {
      var doc = docFields[d] || {};
      var fieldName = clean_(doc.file || "");
      if (!fieldName) continue;
      fieldByName[fieldName] = doc;
      fieldIds[fieldName] = adminDocumentManifestFileIds_(row[fieldName], fieldName);
    }

    var rawFiles = [];
    var filesIt = folder.getFiles();
    while (filesIt.hasNext()) {
      rawFiles.push(adminDocumentManifestFileMetadata_(filesIt.next(), folderId));
    }

    var secret = "";
    try {
      var secretRes = getPortalSecretForApplicant_(rowApplicantId);
      if (secretRes && secretRes.ok !== false) secret = clean_(secretRes.secret || secretRes.secretPlain || "");
    } catch (_secretErr) {}
    var execUrl = clean_(CONFIG.WEBAPP_URL_STUDENT || getExecUrl_() || "");
    if (!secret || !execUrl) {
      warnings.push(adminDocumentManifestWarning_(
        "SECURE_FILE_URL_UNAVAILABLE",
        "Secure file URLs could not be generated from the current portal token configuration."
      ));
    }
    var signedPreviewExpiresAtMs = Date.now() + (5 * 60 * 1000);

    var files = [];
    for (var f = 0; f < rawFiles.length; f++) {
      var meta = rawFiles[f];
      var sourceField = "";
      var mappingMethod = "unmapped";
      var matches = [];
      for (var field in fieldIds) {
        if (!Object.prototype.hasOwnProperty.call(fieldIds, field)) continue;
        if (fieldIds[field].indexOf(meta.fileId) >= 0) matches.push(field);
      }
      if (matches.length) {
        sourceField = matches[0];
        mappingMethod = "row_file_id";
        if (matches.length > 1) {
          warnings.push(adminDocumentManifestWarning_(
            "DUPLICATE_FIELD_MAPPING",
            meta.fileId + " is referenced by multiple document fields: " + matches.join(", ")
          ));
        }
      } else {
        sourceField = adminDocumentManifestPrefixField_(meta.fileName, docFields);
        if (sourceField) {
          mappingMethod = "filename_prefix";
          warnings.push(adminDocumentManifestWarning_("FILE_NOT_REFERENCED_BY_SHEET", meta.fileId));
          warnings.push(adminDocumentManifestWarning_(
            "FILENAME_PREFIX_FALLBACK",
            meta.fileId + " mapped to " + sourceField + " from filename prefix."
          ));
        }
      }

      var fileWarnings = [];
      if (!sourceField) {
        fileWarnings.push(adminDocumentManifestWarning_("UNMAPPED_FILE", "File is not mapped to a configured document field."));
        warnings.push(adminDocumentManifestWarning_("FILE_NOT_REFERENCED_BY_SHEET", meta.fileId));
      }
      if (meta.parentFolderIds.indexOf(folderId) < 0) {
        fileWarnings.push(adminDocumentManifestWarning_("UNEXPECTED_PARENT_FOLDER", meta.parentFolderIds.join(", ")));
        warnings.push(adminDocumentManifestWarning_("UNEXPECTED_PARENT_FOLDER", meta.fileId));
      }
      if (adminDocumentManifestMimeExtensionMismatch_(meta.fileName, meta.mimeType)) {
        fileWarnings.push(adminDocumentManifestWarning_("MIME_EXTENSION_MISMATCH", meta.fileName + " | " + meta.mimeType));
        warnings.push(adminDocumentManifestWarning_("MIME_EXTENSION_MISMATCH", meta.fileId));
      }
      if (sourceField) mappedIds[meta.fileId] = true;
      var sourceFieldIds = sourceField ? (fieldIds[sourceField] || []) : [];
      var itemIndex = sourceField ? sourceFieldIds.indexOf(meta.fileId) : -1;
      var canBuildFileSpecificProxy = mappingMethod === "row_file_id"
        && itemIndex >= 0;
      var previewEligible = /^image\//i.test(meta.mimeType);
      var renditionEligible = previewEligible || /^application\/pdf$/i.test(meta.mimeType);
      var renditionKind = previewEligible ? "image-png" : (/^application\/pdf$/i.test(meta.mimeType) ? "pdf-first-page-png" : "");
      var previewUrl = previewEligible && canBuildFileSpecificProxy && secret && execUrl
        ? buildSignedDocumentFileActionUrl_(
          execUrl, rowApplicantId, sourceField, itemIndex, "open", signedPreviewExpiresAtMs, secret
        )
        : "";
      if (sourceField && !canBuildFileSpecificProxy) {
        fileWarnings.push(adminDocumentManifestWarning_(
          "FILE_SPECIFIC_PROXY_UNAVAILABLE",
          "Existing secure proxy is field-based and cannot identify this file independently."
        ));
      }

      files.push({
        fileId: meta.fileId,
        fileName: meta.fileName,
        label: sourceField ? clean_((fieldByName[sourceField] && fieldByName[sourceField].label) || sourceField) : "",
        mimeType: meta.mimeType,
        sizeBytes: meta.sizeBytes,
        createdTime: meta.createdTime,
        modifiedTime: meta.modifiedTime,
        parentFolderId: meta.parentFolderId,
        sourceField: sourceField,
        itemIndex: itemIndex >= 0 ? itemIndex : null,
        mappingMethod: mappingMethod,
        suspectedDocumentType: adminDocumentManifestTypeForField_(sourceField),
        previewEligible: previewEligible,
        renditionEligible: renditionEligible && canBuildFileSpecificProxy,
        renditionKind: renditionKind,
        thumbnailAvailable: !!(renditionEligible && canBuildFileSpecificProxy),
        previewUrl: previewUrl,
        openUrl: canBuildFileSpecificProxy && secret && execUrl
          ? buildTokenGatedFileUrl_(execUrl, rowApplicantId, secret, sourceField, "open")
          : "",
        downloadUrl: canBuildFileSpecificProxy && secret && execUrl
          ? buildTokenGatedFileUrl_(execUrl, rowApplicantId, secret, sourceField, "download")
          : "",
        warnings: fileWarnings
      });
    }

    var missingExpected = [];
    for (var expectedField in fieldByName) {
      if (!Object.prototype.hasOwnProperty.call(fieldByName, expectedField)) continue;
      var expectedDoc = fieldByName[expectedField] || {};
      var ids = fieldIds[expectedField] || [];
      var mappedCount = 0;
      for (var x = 0; x < ids.length; x++) {
        if (mappedIds[ids[x]]) mappedCount++;
        else warnings.push(adminDocumentManifestWarning_(
          "SHEET_FILE_ID_NOT_FOUND_IN_FOLDER",
          expectedField + ": " + ids[x]
        ));
      }
      if (expectedDoc.required !== false && mappedCount === 0) {
        missingExpected.push({
          sourceField: expectedField,
          label: clean_(expectedDoc.label || expectedField),
          required: true
        });
      }
    }

    return {
      ok: true,
      applicantId: rowApplicantId,
      applicantName: applicantName,
      folderId: folderId,
      folderName: clean_(folder.getName()),
      folderUrl: folderUrl,
      source: "drive",
      files: files,
      missingExpected: missingExpected,
      warnings: warnings
    };
  } catch (err) {
    return {
      ok: false,
      code: "DOCUMENT_MANIFEST_ERROR",
      error: "Document manifest could not be built."
    };
  }
}

function adminDocumentFileActionField_(fieldName) {
  var target = clean_(fieldName || "");
  var docs = Array.isArray(CONFIG.DOC_FIELDS) ? CONFIG.DOC_FIELDS : [];
  for (var i = 0; i < docs.length; i++) {
    if (clean_(docs[i] && docs[i].file || "") === target) return docs[i];
  }
  return null;
}

function adminResolveApplicantDocumentFile_(payload) {
  var p = payload && typeof payload === "object" ? payload : {};
  var applicantId = clean_(p.applicantId || p.ApplicantID || "");
  var rowNumber = Number(p.rowNumber);
  var sourceField = clean_(p.sourceField || "");
  var itemIndex = Number(p.itemIndex);
  if (!applicantId || !isFinite(rowNumber) || rowNumber < 2 || Math.floor(rowNumber) !== rowNumber) {
    return { ok: false, code: "INVALID_APPLICANT_CONTEXT", error: "Applicant context is invalid" };
  }
  if (!isFinite(itemIndex) || itemIndex < 0 || Math.floor(itemIndex) !== itemIndex) {
    return { ok: false, code: "INVALID_ITEM_INDEX", error: "Document item index is invalid" };
  }
  var docField = adminDocumentFileActionField_(sourceField);
  if (!docField) {
    return { ok: false, code: "INVALID_SOURCE_FIELD", error: "Document field is invalid" };
  }

  var sheet = openDataSheet_();
  var row = getRowObject_(sheet, rowNumber);
  var rowApplicantId = clean_(row.ApplicantID || row[CONFIG.APPLICANT_ID_HEADER] || "");
  if (!rowApplicantId || rowApplicantId !== applicantId) {
    return { ok: false, code: "APPLICANT_CONTEXT_MISMATCH", error: "Applicant context does not match" };
  }

  var folderUrl = clean_(row.Folder_Url || row[SCHEMA.FOLDER_URL] || "");
  var folderId = folderIdFromUrl_(folderUrl);
  if (!folderId) {
    return { ok: false, code: "DOCUMENT_SOURCE_UNAVAILABLE", error: "Document source is unavailable" };
  }
  var sourceUrls = normalizeToUrlList_(row[sourceField], sourceField);
  if (itemIndex >= sourceUrls.length) {
    return { ok: false, code: "ITEM_INDEX_OUT_OF_RANGE", error: "Document item is unavailable" };
  }
  var fileId = extractDriveFileId_(sourceUrls[itemIndex]);
  if (!fileId) {
    return { ok: false, code: "DOCUMENT_SOURCE_UNAVAILABLE", error: "Document source is unavailable" };
  }
  var file;
  try {
    file = DriveApp.getFileById(fileId);
  } catch (_fileErr) {
    return { ok: false, code: "DOCUMENT_SOURCE_UNAVAILABLE", error: "Document source is unavailable" };
  }
  if (!isFileInFolderChain_(file, folderId)) {
    return { ok: false, code: "DOCUMENT_SOURCE_MISMATCH", error: "Document source does not match applicant context" };
  }

  return {
    ok: true,
    applicantId: applicantId,
    rowNumber: rowNumber,
    sourceField: sourceField,
    itemIndex: itemIndex,
    docField: docField,
    file: file,
    folderId: folderId
  };
}

function adminDocumentGalleryRenditionHash_(value) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    clean_(value || ""),
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, "").slice(0, 32);
}

function adminDocumentGalleryRenditionFolder_(folderIdValue) {
  var folderId = clean_(folderIdValue || "");
  if (!folderId) throw new Error("Applicant folder ID missing for document rendition");
  return DriveApp.getFolderById(folderId);
}

function adminDocumentGalleryRenditionSourceStamp_(file) {
  var updated = "";
  try {
    updated = file && file.getLastUpdated ? adminDocumentManifestIso_(file.getLastUpdated()) : "";
  } catch (_updatedErr) {}
  var sizeBytes = 0;
  try {
    sizeBytes = Number(file && file.getSize ? file.getSize() : 0);
  } catch (_sizeErr) {}
  return {
    fileId: clean_(file && file.getId ? file.getId() : ""),
    fileName: clean_(file && file.getName ? file.getName() : ""),
    updated: clean_(updated || ""),
    sizeBytes: sizeBytes
  };
}

function adminDocumentGalleryRenditionKey_(resolved, mimeType) {
  var stamp = adminDocumentGalleryRenditionSourceStamp_(resolved.file);
  var raw = [
    clean_(resolved.applicantId || ""),
    clean_(resolved.sourceField || ""),
    String(Number(resolved.itemIndex || 0)),
    clean_(stamp.fileId || ""),
    clean_(stamp.updated || ""),
    String(Number(stamp.sizeBytes || 0)),
    clean_(mimeType || "")
  ].join("|");
  return adminDocumentGalleryRenditionHash_(raw);
}

function adminDocumentGalleryRenditionFileName_(resolved, key) {
  var applicant = clean_(resolved.applicantId || "applicant").replace(/[^A-Za-z0-9_-]+/g, "_");
  var field = clean_(resolved.sourceField || "document").replace(/[^A-Za-z0-9_-]+/g, "_");
  var index = String(Number(resolved.itemIndex || 0));
  return [applicant, "FODE_PREVIEW", field, "item" + index, clean_(key || "rendition")].join("__") + ".png";
}

function adminDocumentGalleryFindStoredRendition_(folder, fileName) {
  var files = folder.getFilesByName(fileName);
  return files.hasNext() ? files.next() : null;
}

function adminDocumentGalleryFetchPdfThumbnailBlob_(file) {
  var fileId = clean_(file && file.getId ? file.getId() : "");
  if (!fileId) throw new Error("PDF file ID unavailable");
  var meta = driveApiGet_("/files/" + encodeURIComponent(fileId), {
    fields: "id,name,mimeType,thumbnailLink,size,modifiedTime"
  });
  var thumb = clean_(meta && meta.json && meta.json.thumbnailLink || "");
  if (!meta || meta.ok !== true || !thumb) throw new Error("PDF thumbnailLink unavailable");
  var thumbUrl = thumb.replace(/=s\d+(-c)?/i, "=s1200");
  var resp = UrlFetchApp.fetch(thumbUrl, {
    headers: oauthHeaders_(),
    muteHttpExceptions: true
  });
  var status = Number(resp.getResponseCode ? resp.getResponseCode() : 0);
  if (status < 200 || status >= 300) throw new Error("PDF thumbnail fetch failed: " + status);
  return resp.getBlob();
}

function adminDocumentGalleryBuildPngRenditionBlob_(file, mimeType) {
  var sourceBlob = /^application\/pdf$/i.test(mimeType)
    ? adminDocumentGalleryFetchPdfThumbnailBlob_(file)
    : file.getBlob();
  var pngBlob = sourceBlob.getAs("image/png");
  if (!pngBlob) throw new Error("PNG rendition conversion unavailable");
  return pngBlob;
}

function adminDocumentGalleryGetOrCreateStoredRendition_(resolved, mimeType) {
  var folder = adminDocumentGalleryRenditionFolder_(resolved.folderId);
  var key = adminDocumentGalleryRenditionKey_(resolved, mimeType);
  var fileName = adminDocumentGalleryRenditionFileName_(resolved, key);
  var existing = adminDocumentGalleryFindStoredRendition_(folder, fileName);
  if (existing) {
    return {
      file: existing,
      key: key,
      fileName: fileName,
      folderName: clean_(folder.getName ? folder.getName() : ""),
      generated: false
    };
  }
  var pngBlob = adminDocumentGalleryBuildPngRenditionBlob_(resolved.file, mimeType);
  pngBlob.setName(fileName);
  var created = folder.createFile(pngBlob);
  return {
    file: created,
    key: key,
    fileName: fileName,
    folderName: clean_(folder.getName ? folder.getName() : ""),
    generated: true
  };
}

function adminDocumentGalleryInspectStoredRendition_(resolved, mimeType) {
  var folder = adminDocumentGalleryRenditionFolder_(resolved.folderId);
  var key = adminDocumentGalleryRenditionKey_(resolved, mimeType);
  var fileName = adminDocumentGalleryRenditionFileName_(resolved, key);
  var existing = adminDocumentGalleryFindStoredRendition_(folder, fileName);
  return {
    exists: !!existing,
    key: key,
    fileName: fileName,
    folderName: clean_(folder.getName ? folder.getName() : "")
  };
}

function adminDocumentGalleryPrepareStoredRendition_(resolved) {
  var file = resolved && resolved.file;
  var mimeType = clean_(file && file.getMimeType ? file.getMimeType() : "");
  var isImage = /^image\//i.test(mimeType);
  var isPdf = /^application\/pdf$/i.test(mimeType);
  if (!isImage && !isPdf) {
    return { ok: false, code: "UNSUPPORTED_RENDITION_TYPE", error: "Only image and PDF files can be rendered in-gallery." };
  }
  var maxBytes = Number((CONFIG && CONFIG.DOCUMENT_GALLERY_RENDITION_MAX_BYTES) || 6000000);
  var sizeBytes = Number(file && file.getSize ? file.getSize() : 0);
  if (maxBytes > 0 && sizeBytes > maxBytes) {
    return { ok: false, code: "RENDITION_TOO_LARGE", error: "File is too large for inline gallery rendering. Use Open or Download." };
  }
  var stored = adminDocumentGalleryGetOrCreateStoredRendition_(resolved, mimeType);
  return {
    ok: true,
    sourceField: resolved.sourceField,
    itemIndex: resolved.itemIndex,
    label: clean_(resolved.docField && resolved.docField.label || resolved.sourceField),
    fileName: clean_(file && file.getName ? file.getName() : ""),
    sourceMimeType: mimeType,
    renditionMimeType: "image/png",
    renditionKind: isPdf ? "pdf-first-page-png" : "image-png",
    renditionStorage: "applicant-folder",
    renditionFolderName: clean_(stored.folderName || ""),
    renditionKey: clean_(stored.key || ""),
    renditionFileName: clean_(stored.fileName || ""),
    generated: stored.generated === true,
    stalePolicy: "reuse-if-source-key-matches; regenerate-on-source-replacement",
    file: stored.file
  };
}

function adminDocumentGalleryInspectRenditionCandidate_(resolved) {
  var file = resolved && resolved.file;
  var mimeType = clean_(file && file.getMimeType ? file.getMimeType() : "");
  var isImage = /^image\//i.test(mimeType);
  var isPdf = /^application\/pdf$/i.test(mimeType);
  if (!isImage && !isPdf) {
    return { ok: false, code: "UNSUPPORTED_RENDITION_TYPE", error: "Only image and PDF files can be rendered in-gallery." };
  }
  var maxBytes = Number((CONFIG && CONFIG.DOCUMENT_GALLERY_RENDITION_MAX_BYTES) || 6000000);
  var sizeBytes = Number(file && file.getSize ? file.getSize() : 0);
  if (maxBytes > 0 && sizeBytes > maxBytes) {
    return { ok: false, code: "RENDITION_TOO_LARGE", error: "File is too large for inline gallery rendering. Use Open or Download." };
  }
  var inspected = adminDocumentGalleryInspectStoredRendition_(resolved, mimeType);
  return {
    ok: true,
    sourceMimeType: mimeType,
    renditionKind: isPdf ? "pdf-first-page-png" : "image-png",
    renditionFileName: inspected.fileName,
    renditionKey: inspected.key,
    exists: inspected.exists
  };
}

function admin_getApplicantDocumentImageRendition(payload) {
  var adminEmail = getCallerEmail_();
  try {
    requireDocumentVerifier_(adminEmail);
  } catch (_authErr) {
    return { ok: false, code: "ACCESS_DENIED", error: "Access denied: document verifier required" };
  }

  try {
    var resolved = adminResolveApplicantDocumentFile_(payload);
    if (!resolved || resolved.ok !== true) return resolved;
    var prepared = adminDocumentGalleryPrepareStoredRendition_(resolved);
    if (!prepared || prepared.ok !== true) return prepared;
    var blob = prepared.file.getBlob();
    var bytes = blob.getBytes();
    return {
      ok: true,
      sourceField: prepared.sourceField,
      itemIndex: prepared.itemIndex,
      label: prepared.label,
      fileName: prepared.fileName,
      sourceMimeType: prepared.sourceMimeType,
      renditionMimeType: "image/png",
      renditionKind: prepared.renditionKind,
      renditionStorage: "applicant-folder",
      renditionFolderName: prepared.renditionFolderName,
      renditionKey: prepared.renditionKey,
      generated: prepared.generated === true,
      stalePolicy: prepared.stalePolicy,
      dataUrl: "data:image/png;base64," + Utilities.base64Encode(bytes)
    };
  } catch (_err) {
    return {
      ok: false,
      code: "DOCUMENT_IMAGE_RENDITION_ERROR",
      error: "Document image preview could not be prepared"
    };
  }
}

function adminResolveApplicantDocumentFileFromRow_(rowObj, rowNumber, applicantId, sourceField, itemIndex) {
  var row = rowObj || {};
  var id = clean_(applicantId || row.ApplicantID || row[CONFIG.APPLICANT_ID_HEADER] || "");
  var field = clean_(sourceField || "");
  var index = Number(itemIndex);
  var docField = adminDocumentFileActionField_(field);
  if (!id || !docField || !isFinite(index) || index < 0 || Math.floor(index) !== index) {
    return { ok: false, code: "INVALID_DOCUMENT_CONTEXT" };
  }
  var folderUrl = clean_(row.Folder_Url || row[SCHEMA.FOLDER_URL] || "");
  var folderId = folderIdFromUrl_(folderUrl);
  if (!folderId) return { ok: false, code: "DOCUMENT_FOLDER_MISSING" };
  var sourceUrls = normalizeToUrlList_(row[field], field);
  if (index >= sourceUrls.length) return { ok: false, code: "DOCUMENT_ITEM_MISSING" };
  var fileId = extractDriveFileId_(sourceUrls[index]);
  if (!fileId) return { ok: false, code: "DOCUMENT_FILE_ID_MISSING" };
  var file;
  try {
    file = DriveApp.getFileById(fileId);
  } catch (_fileErr) {
    return { ok: false, code: "DOCUMENT_SOURCE_UNAVAILABLE" };
  }
  if (!isFileInFolderChain_(file, folderId)) return { ok: false, code: "DOCUMENT_SOURCE_MISMATCH" };
  return {
    ok: true,
    applicantId: id,
    rowNumber: Number(rowNumber),
    sourceField: field,
    itemIndex: index,
    docField: docField,
    file: file,
    folderId: folderId
  };
}

function adminDocumentPreviewBackfillBatch_(payload, execute) {
  var adminEmail = getCallerEmail_();
  try {
    requireDocumentVerifier_(adminEmail);
  } catch (_authErr) {
    return { ok: false, code: "ACCESS_DENIED", error: "Access denied: document verifier required" };
  }

  var p = payload && typeof payload === "object" ? payload : {};
  var startRow = Math.max(2, Number(p.startRow || p.offset || 2));
  var batchSize = Math.max(1, Math.min(25, Number(p.batchSize || p.limit || 10)));
  var startedAt = Date.now();
  var summary = {
    mode: execute ? "execute" : "dry-run",
    startRow: startRow,
    batchSize: batchSize,
    rowsScanned: 0,
    applicantFoldersFound: 0,
    sourceFilesFound: 0,
    previewsAlreadyPresent: 0,
    previewsWouldCreate: 0,
    previewsCreated: 0,
    skippedUnsupported: 0,
    skippedMissingFolder: 0,
    skippedMissingFile: 0,
    failedConversions: 0,
    items: []
  };

  try {
    var sh = openDataSheet_();
    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    if (lastRow < startRow) {
      summary.nextStartRow = "";
      summary.elapsedMs = Date.now() - startedAt;
      return { ok: true, summary: summary };
    }
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var idx = headerIndex_(headers);
    var count = Math.min(batchSize, lastRow - startRow + 1);
    var values = sh.getRange(startRow, 1, count, lastCol).getValues();
    var docs = Array.isArray(CONFIG.DOC_FIELDS) ? CONFIG.DOC_FIELDS : [];
    for (var r = 0; r < values.length; r++) {
      var rowNumber = startRow + r;
      var rowObj = {};
      for (var c = 0; c < headers.length; c++) {
        var h = clean_(headers[c]);
        if (h) rowObj[h] = values[r][c];
      }
      var applicantId = clean_(rowObj.ApplicantID || rowObj[CONFIG.APPLICANT_ID_HEADER] || "");
      if (!applicantId) continue;
      summary.rowsScanned++;
      if (!folderIdFromUrl_(clean_(rowObj.Folder_Url || ""))) summary.skippedMissingFolder++;
      else summary.applicantFoldersFound++;

      for (var d = 0; d < docs.length; d++) {
        var field = clean_(docs[d] && docs[d].file || "");
        if (!field) continue;
        var urls = normalizeToUrlList_(rowObj[field], field);
        for (var i = 0; i < urls.length; i++) {
          var item = {
            applicantId: applicantId,
            rowNumber: rowNumber,
            sourceField: field,
            itemIndex: i,
            action: ""
          };
          var resolved = adminResolveApplicantDocumentFileFromRow_(rowObj, rowNumber, applicantId, field, i);
          if (!resolved || resolved.ok !== true) {
            if (resolved && resolved.code === "DOCUMENT_FOLDER_MISSING") summary.skippedMissingFolder++;
            else summary.skippedMissingFile++;
            item.action = clean_(resolved && resolved.code || "SKIPPED");
            summary.items.push(item);
            continue;
          }
          summary.sourceFilesFound++;
          try {
            var prepared = execute
              ? adminDocumentGalleryPrepareStoredRendition_(resolved)
              : adminDocumentGalleryInspectRenditionCandidate_(resolved);
            if (!prepared || prepared.ok !== true) {
              summary.skippedUnsupported++;
              item.action = clean_(prepared && prepared.code || "UNSUPPORTED_RENDITION_TYPE");
              summary.items.push(item);
              continue;
            }
            if (execute ? prepared.generated === true : prepared.exists !== true) {
              if (execute) {
                summary.previewsCreated++;
                item.action = "created";
              } else {
                summary.previewsWouldCreate++;
                item.action = "would_create";
              }
            } else {
              summary.previewsAlreadyPresent++;
              item.action = "already_present";
            }
            item.renditionFileName = clean_(prepared.renditionFileName || "");
            item.renditionKind = clean_(prepared.renditionKind || "");
            summary.items.push(item);
          } catch (err) {
            summary.failedConversions++;
            item.action = "failed";
            item.error = clean_(err && err.message ? err.message : String(err));
            summary.items.push(item);
          }
        }
      }
    }
    summary.nextStartRow = (startRow + values.length <= lastRow) ? (startRow + values.length) : "";
    summary.elapsedMs = Date.now() - startedAt;
    return { ok: true, summary: summary };
  } catch (errOuter) {
    summary.elapsedMs = Date.now() - startedAt;
    return { ok: false, code: "DOCUMENT_PREVIEW_BACKFILL_ERROR", error: clean_(errOuter && errOuter.message ? errOuter.message : String(errOuter)), summary: summary };
  }
}

function admin_dryRunDocumentPreviewBackfill(payload) {
  return adminDocumentPreviewBackfillBatch_(payload, false);
}

function admin_runDocumentPreviewBackfillBatch(payload) {
  return adminDocumentPreviewBackfillBatch_(payload, true);
}

function admin_getApplicantDocumentFileAction(payload) {
  var adminEmail = getCallerEmail_();
  try {
    requireDocumentVerifier_(adminEmail);
  } catch (_authErr) {
    return { ok: false, code: "ACCESS_DENIED", error: "Access denied: document verifier required" };
  }

  try {
    var resolved = adminResolveApplicantDocumentFile_(payload);
    if (!resolved || resolved.ok !== true) return resolved;
    var applicantId = resolved.applicantId;
    var sourceField = resolved.sourceField;
    var itemIndex = resolved.itemIndex;
    var docField = resolved.docField;
    var file = resolved.file;

    var secretRes = getPortalSecretForApplicant_(applicantId);
    var secret = clean_(secretRes && (secretRes.secret || secretRes.secretPlain) || "");
    var baseUrl = clean_(CONFIG.WEBAPP_URL_STUDENT || "");
    if (!secret || !baseUrl) {
      return { ok: false, code: "SECURE_ACTION_UNAVAILABLE", error: "Secure document action is unavailable" };
    }
    var expiresAtMs = Date.now() + (5 * 60 * 1000);
    var openUrl = buildSignedDocumentFileActionUrl_(
      baseUrl, applicantId, sourceField, itemIndex, "open", expiresAtMs, secret
    );
    var downloadUrl = buildSignedDocumentFileActionUrl_(
      baseUrl, applicantId, sourceField, itemIndex, "download", expiresAtMs, secret
    );
    if (!openUrl || !downloadUrl) {
      return { ok: false, code: "SECURE_ACTION_UNAVAILABLE", error: "Secure document action is unavailable" };
    }

    var mimeType = clean_(file.getMimeType ? file.getMimeType() : "");
    return {
      ok: true,
      sourceField: sourceField,
      itemIndex: itemIndex,
      label: clean_(docField.label || sourceField),
      mimeType: mimeType,
      previewEligible: /^image\//i.test(mimeType),
      openUrl: openUrl,
      downloadUrl: downloadUrl,
      expiresAt: new Date(expiresAtMs).toISOString()
    };
  } catch (_err) {
    return {
      ok: false,
      code: "DOCUMENT_ACTION_ERROR",
      error: "Secure document action could not be built"
    };
  }
}

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
  function hasUploadedFileForMapping_(mapping) {
    if (!mapping || !mapping.file) return false;
    if (!idx[mapping.file]) return false;
    var url = clean_(displayRow[idx[mapping.file] - 1]);
    return /^https?:\/\//i.test(url);
  }

  var docMap = CONFIG.DOC_FIELDS || [];
  var prepared = [];
  for (var i = 0; i < docs.length; i++) {
    var d = docs[i] || {};
    var file = clean_(d.file || "");
    var mapping = findDocMapping_(file, d.statusField, d.commentField, docMap);
    if (!mapping) throw new Error("Invalid document mapping.");
    var status = normalizeDocStatus_(d.status);
    if (status === "Verified" && !hasUploadedFileForMapping_(mapping)) {
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
    var prospectivePaymentVerified = derivePaymentBadge_(prospectiveRow) === "Verified" || isPaymentVerifiedDerived_(prospectiveRow) === true;
    if (!beforePaymentVerified && prospectivePaymentVerified && !canBypassPaymentFreeze_(adminEmail)) {
      logAdminEvent_("PAYVER_NOT_ALLOWED_BLOCK", {
        applicantId: applicantId,
        rowNumber: rowNumber,
        actor: adminEmail || "",
        dbg: dbgId
      });
      return err_("PAYVER_NOT_ALLOWED", "Only Super Admin can verify payments.", dbgId);
    }
    var prospectiveDocStage = computeDocVerificationStatus_(prospectiveRow);
    var docsVerifiedAfterSave = (clean_(prospectiveRow.Docs_Verified || "") === "Yes") || prospectiveDocStage === "Verified";
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
  var paymentBadge = derivePaymentBadge_(refreshedRow);
  var paymentVerified = paymentBadge === "Verified";
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
  var paymentBadge = derivePaymentBadge_(rowObj);
  var paymentVerified = paymentBadge === "Verified";
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
  var paymentBadge = derivePaymentBadge_(rowObj);
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
    paymentBadge: derivePaymentBadge_(refreshed),
    portalAccessStatus: clean_(refreshed.Portal_Access_Status || status),
    detail: (detailRes && detailRes.ok === true) ? detailRes.detail : null
  };
}

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
  try { requireSuperAdmin_(adminEmail); } catch (_superErr) { return err_("ACCESS_DENIED", "Access denied: SUPER admin required", dbgId); }

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
  var docsVerifiedNow = (clean_(beforeRow.Docs_Verified || "") === "Yes") || computeDocVerificationStatus_(beforeRow) === "Verified";
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
  var paymentBadge = derivePaymentBadge_(refreshedRow);
  var paymentVerified = paymentBadge === "Verified";
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

function computeEligibleDocsFollowUp_(rowObj, sentAtOpt) {
  if (CONFIG.DOCS_FOLLOWUP_ENABLE !== true) return false;
  var row = rowObj || {};
  var docsVerified = isYes_(row.Docs_Verified) || computeDocVerificationStatus_(row) === "Verified";
  if (!docsVerified) return false;
  if (!getRowEmailForStudent_(row)) return false;
  var sentAt = safeStr_(sentAtOpt || getDocsFollowupSentAt_(row));
  if (sentAt) return false;
  return true;
}

function composeDocsFollowupBody_(rowObj, portalUrl) {
  var row = rowObj || {};
  var applicantId = safeStr_(row.ApplicantID || "");
  var studentName = rowStudentName_(row) || "Student";
  var subjectCount = countSubjectsFromRow_(row);
  var baseK = Number(CONFIG.FODE_FEE_BASE_K || 600);
  var perSubjectK = Number(CONFIG.FODE_FEE_PER_SUBJECT_K || 450);
  var totalK = baseK + (subjectCount * perSubjectK);
  var url = safeStr_(portalUrl || "");
  return [
    "Dear Parent/Guardian,",
    "",
    "Your student's FODE application documents have been verified.",
    "",
    "Student: " + studentName,
    "Applicant ID: " + applicantId,
    "Program/Intake: " + safeStr_(row.Program_Applied_For || row.Program || row.Intake || ""),
    "Subjects: " + safeStr_(row.Subjects_Selected_Canonical || row.Subjects_Selected || ""),
    "",
    "Quote summary:",
    "- Base fee: K" + String(baseK),
    "- Per subject fee: K" + String(perSubjectK),
    "- Subject count: " + String(subjectCount),
    "- Estimated total: K" + String(totalK),
    "",
    "Student Portal Link:",
    url,
    "",
    "Bank Details:",
    "Kundu International Academy",
    "Account Number: 7027138796",
    "BSP BANK, BSP Haus, Konedobu, Port Moresby",
    "BSB No: 088950",
    "",
    "Next steps:",
    "1. Pay the total fee shown in your quote by bank deposit/transfer.",
    "2. In the payment reference, write: Applicant ID + Student Name.",
    "3. After payment, reopen your student portal link above and upload your payment receipt.",
    "4. Once receipt is verified, we will confirm enrolment and release program access.",
    "5. Keep this email and your portal link safe for re-uploads/updates.",
    "",
    "Support: fode@kundu.ac",
    "",
    "Regards,",
    "FODE Admissions"
  ].join("\n");
}

function admin_sendDocsFollowupEmails(payload) {
  return withEnvelope_("admin_sendDocsFollowupEmails", function(dbgId) {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) return err_("ACCESS_DENIED", "Access denied", dbgId);
    requireSuperAdmin_(adminEmail);
    if (CONFIG.DOCS_FOLLOWUP_ENABLE !== true) return ok_({
      summary: { sentCount: 0, failedCount: 0 },
      results: [],
      dbg: dbgId
    }, dbgId);

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
    var results = [];
    var sentCount = 0;
    var failedCount = 0;
    for (var ri = 0; ri < normalized.length; ri++) {
      var rowNumber = normalized[ri];
      var rowObj = getRowObject_(sh, rowNumber);
      rowObj._rowNumber = rowNumber;
      var applicantId = safeStr_(rowObj.ApplicantID || ("ROW-" + rowNumber));
      var sentAt = getDocsFollowupSentAt_(rowObj);
      var eligible = computeEligibleDocsFollowUp_(rowObj, sentAt);
      var baseAudit = {
        operator: adminEmail || "",
        applicantId: applicantId,
        rowNumber: rowNumber,
        debugId: dbgId
      };
      if (!eligible) {
        logAdminEvent_("DOCS_FOLLOWUP_CLICK", {
          operator: baseAudit.operator,
          applicantId: applicantId,
          rowNumber: rowNumber,
          outcome: "NOT_ELIGIBLE",
          debugId: dbgId
        });
        results.push({ ok: false, code: "NOT_ELIGIBLE", message: "Not eligible for docs follow-up.", applicantId: applicantId, ApplicantID: applicantId, rowNumber: rowNumber });
        failedCount++;
        continue;
      }
      var to = getRowEmailForStudent_(rowObj);
      if (!to) {
        logAdminEvent_("DOCS_FOLLOWUP_CLICK", {
          operator: baseAudit.operator,
          applicantId: applicantId,
          rowNumber: rowNumber,
          outcome: "NO_PARENT_EMAIL",
          debugId: dbgId
        });
        results.push({ ok: false, code: "NO_PARENT_EMAIL", message: "Parent/guardian email is missing or invalid.", applicantId: applicantId, ApplicantID: applicantId, rowNumber: rowNumber });
        failedCount++;
        continue;
      }

      var secretRes = getPortalSecretForApplicant_(applicantId);
      if (!secretRes || secretRes.ok !== true) {
        logAdminEvent_("DOCS_FOLLOWUP_CLICK", {
          operator: baseAudit.operator,
          applicantId: applicantId,
          rowNumber: rowNumber,
          outcome: "PORTAL_LINK_ERROR",
          debugId: dbgId
        });
        results.push({ ok: false, code: "PORTAL_LINK_ERROR", message: "Portal link error.", applicantId: applicantId, ApplicantID: applicantId, rowNumber: rowNumber });
        failedCount++;
        continue;
      }
      var portalUrl = buildStudentPortalUrl_(applicantId, secretRes.secret);
      var subject = safeStr_(CONFIG.DOCS_FOLLOWUP_EMAIL_SUBJECT || "FODE Application - Documents Verified | Quote, Payment Instructions & Next Steps");
      var body = composeDocsFollowupBody_(rowObj, portalUrl);
      var sendOpts = {
        cc: safeStr_(CONFIG.DOCS_FOLLOWUP_CC || ""),
        replyTo: safeStr_(CONFIG.DOCS_FOLLOWUP_REPLY_TO || CONFIG.EMAIL_REPLY_TO || ""),
        name: safeStr_(CONFIG.EMAIL_FROM_NAME || "FODE Admissions"),
        senderMode: safeStr_(CONFIG.DOCS_FOLLOWUP_SENDER_MODE || CONFIG.EMAIL_SENDER_MODE || "DEFAULT")
      };
      var sent = adminSendEmail_(to, subject, body, sendOpts);
      if (!sent.ok) {
        logAdminEvent_("DOCS_FOLLOWUP_CLICK", {
          operator: baseAudit.operator,
          applicantId: applicantId,
          rowNumber: rowNumber,
          outcome: "EMAIL_SEND_FAILED",
          error: safeStr_(sent.error || ""),
          debugId: dbgId
        });
        results.push({ ok: false, code: "EMAIL_SEND_FAILED", message: safeStr_(sent.error || "Email send failed"), applicantId: applicantId, ApplicantID: applicantId, rowNumber: rowNumber });
        failedCount++;
        continue;
      }

      var idx = headerIndex_(sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]);
      captureOperatorAttribution_(sh, rowNumber, idx, {
        action: "SEND_QUOTE",
        operatorEmail: adminEmail,
        rowObj: rowObj
      });
      var key = buildDocsFollowupKey_(CONFIG.DATA_MODE, applicantId);
      var ts = nowIso_();
      PropertiesService.getScriptProperties().setProperty(key, ts);
      logAdminEvent_("DOCS_FOLLOWUP_CLICK", {
        operator: baseAudit.operator,
        applicantId: applicantId,
        rowNumber: rowNumber,
        outcome: "SENT",
        debugId: dbgId
      });
      logAdminEvent_("DOCS_FOLLOWUP_EMAIL_SENT", {
        operator: baseAudit.operator,
        applicantId: applicantId,
        rowNumber: rowNumber,
        to: to,
        portalUrl: portalUrl,
        cc: safeStr_(CONFIG.DOCS_FOLLOWUP_CC || ""),
        replyTo: safeStr_(CONFIG.DOCS_FOLLOWUP_REPLY_TO || CONFIG.EMAIL_REPLY_TO || ""),
        sentKey: key,
        sentAt: ts,
        debugId: dbgId
      });
      results.push({ ok: true, code: "SENT", message: "Docs follow-up sent.", applicantId: applicantId, ApplicantID: applicantId, rowNumber: rowNumber, sentAt: ts });
      sentCount++;
    }

    return ok_({
      summary: { sentCount: sentCount, failedCount: failedCount },
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
    var docsAfter = isYes_(afterRow.Docs_Verified) || computeDocVerificationStatus_(afterRow) === "Verified";
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

function resolveStatusCols_(idx) {
  return {
    docStage: getCol_(idx, ["Doc_Verification_Status"]),
    docsCompat: getCol_(idx, ["Docs_Verified"]),
    overall: getCol_(idx, ["Overall_Status"]),
    paymentCompat: getCol_(idx, ["Payment_Verified"]),
    receipt: getCol_(idx, ["Receipt_Status"])
  };
}

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

function normalizeWhatsAppFallbackLimit_(limit) {
  var def = Math.max(1, Math.floor(Number(CONFIG.WHATSAPP_FALLBACK_DEFAULT_LIMIT || 20)));
  var max = Math.max(def, Math.floor(Number(CONFIG.WHATSAPP_FALLBACK_MAX_LIMIT || 100)));
  var n = Math.floor(Number(limit || def));
  if (!isFinite(n) || n < 1) return def;
  if (n > max) return max;
  return n;
}

function normalizeWhatsAppFallbackFilter_(filter) {
  var f = clean_(filter || "ALL_FALLBACK").toUpperCase();
  return ["ALL_FALLBACK", "INVALID_EMAIL", "BOUNCED", "BLOCKED"].indexOf(f) >= 0 ? f : "ALL_FALLBACK";
}

function normalizePngWhatsAppPhone_(value) {
  var raw = clean_(value || "");
  var digits = raw.replace(/\D/g, "");
  if (!digits) return { ok: false, raw: raw, normalized: "", code: "INVALID_PHONE" };
  if (digits.indexOf("675") === 0) digits = digits.slice(3);
  if (digits.length !== 8) return { ok: false, raw: raw, normalized: "", code: "INVALID_PHONE" };
  if (!/^[78]\d{7}$/.test(digits)) return { ok: false, raw: raw, normalized: "", code: "INVALID_PHONE" };
  return { ok: true, raw: raw, normalized: "675" + digits, code: "OK" };
}

function getWhatsAppFallbackPhoneRaw_(rowObj) {
  var row = rowObj || {};
  return clean_(row.Parent_Phone || row.Parent_Mobile || row.Phone_Number || row.Mobile || row.Phone || "");
}

function getWhatsAppFallbackStudentName_(rowObj) {
  var row = rowObj || {};
  return clean_(row.StudentName || row.Student_Name || row.Full_Name || ((clean_(row.First_Name || "") + " " + clean_(row.Last_Name || "")).trim()));
}

function getWhatsAppFallbackParentName_(rowObj) {
  var row = rowObj || {};
  return clean_(row.ParentName || row.Parent_Name || row.Parent_Full_Name || row.Parent || "");
}

function getWhatsAppFallbackEmailIssue_(rowObj) {
  var row = rowObj || {};
  var status = normalizeEmailStatus_(row.Email_Status || "");
  var bounceFlag = isCampaignBounceFlagTrue_(row.Email_Bounce_Flag);
  var lastResult = clean_(row.Last_Contact_Result || "").toUpperCase();
  var emailRaw = clean_(row.Parent_Email || "");
  var emailCorrected = clean_(row.Parent_Email_Corrected || "");
  var effective = emailCorrected || emailRaw;
  var validEffective = typeof isValidEmail_ === "function" ? isValidEmail_(effective) : stageAggregationIsValidEmail_(effective);
  if (status === "BOUNCED" || bounceFlag) return "BOUNCED";
  if (status === "FAILED" || status === "FALLBACK_PENDING" || lastResult === "FAILED") return "FAILED_EMAIL";
  if (lastResult === "BLOCKED") return "BLOCKED";
  if (!effective) return "MISSING_EMAIL";
  if (!validEffective) return "INVALID_EMAIL";
  return "";
}

function isWhatsAppFallbackCandidate_(rowObj, filter) {
  var issue = getWhatsAppFallbackEmailIssue_(rowObj);
  if (!issue) return false;
  var f = normalizeWhatsAppFallbackFilter_(filter);
  if (f === "ALL_FALLBACK") return true;
  if (f === "INVALID_EMAIL") return issue === "MISSING_EMAIL" || issue === "INVALID_EMAIL";
  if (f === "BOUNCED") return issue === "BOUNCED";
  if (f === "BLOCKED") return issue === "BLOCKED";
  return false;
}

function resolveWhatsAppFallbackAdminRecipients_() {
  var sources = [
    { key: "WHATSAPP_FALLBACK_ADMIN_RECIPIENTS", value: CONFIG.WHATSAPP_FALLBACK_ADMIN_RECIPIENTS || "" },
    { key: "EMAIL_RELEASE_ADMIN_TO", value: CONFIG.EMAIL_RELEASE_ADMIN_TO || "" },
    { key: "EMAIL_ADMIN_ALERTS_TO", value: CONFIG.EMAIL_ADMIN_ALERTS_TO || "" }
  ];
  for (var i = 0; i < sources.length; i++) {
    var source = sources[i];
    var raw = clean_(source.value || "");
    if (!raw) continue;
    var recipients = parseCsvEmails_(raw).split(",").map(function (v) { return clean_(v || ""); }).filter(function (v) { return !!v; });
    if (recipients.length) {
      return {
        source: source.key,
        recipients: recipients
      };
    }
  }
  return {
    source: "NONE",
    recipients: []
  };
}

function getWhatsAppFallbackAdminRecipients_() {
  return resolveWhatsAppFallbackAdminRecipients_().recipients;
}

function buildWhatsAppFallbackPortalInfo_(applicantId, portalLookup) {
  var id = clean_(applicantId || "");
  if (!id) return { status: "MISSING_APPLICANT_ID", url: "" };
  var lookup = portalLookup && portalLookup.byApplicantId ? portalLookup.byApplicantId : {};
  var rec = lookup[id] || lookup[id.toLowerCase()] || null;
  if (!rec) return { status: "MISSING_SECRET", url: "" };
  if (portalLookup && portalLookup.hasStatus === true && clean_(rec.status || "") !== "Active") {
    return { status: "MISSING_SECRET", url: "" };
  }
  var secret = clean_(rec.secretPlain || rec.secret || rec.secretHash || "");
  if (!secret) return { status: "MISSING_SECRET", url: "" };
  try {
    return { status: "READY", url: buildStudentPortalUrl_(id, secret) };
  } catch (_err) {
    return { status: "PORTAL_URL_ERROR", url: "" };
  }
}

function getWhatsAppFallbackMessageTemplate_() {
  return clean_(CONFIG.WHATSAPP_FALLBACK_MESSAGE_TEMPLATE || "Hello, this is FODE Admissions. We are following up on your application (ApplicantID: {{ApplicantID}}). Please check your email or contact us if you need help completing your application.");
}

function buildWhatsAppFallbackTemplateTokens_(rowObj, portalInfo) {
  var row = rowObj || {};
  var studentName = getWhatsAppFallbackStudentName_(row);
  var parentName = getWhatsAppFallbackParentName_(row);
  var applicantId = clean_(row.ApplicantID || "");
  var program = rowProgramSummary_(row) || "";
  var portalLink = portalInfo && portalInfo.status === "READY" ? clean_(portalInfo.url || "") : "";
  return {
    ApplicantID: applicantId,
    First_Name: clean_(row.First_Name || ""),
    Parent_Full_Name: parentName,
    Program: program,
    PortalLink: portalLink,
    StudentName: studentName
  };
}

function renderWhatsAppFallbackTemplate_(template, tokens) {
  var text = String(template || "");
  var map = tokens && typeof tokens === "object" ? tokens : {};
  Object.keys(map).forEach(function (key) {
    var value = clean_(map[key] || "");
    text = text.split("{{" + key + "}}").join(value);
  });
  return text.replace(/\s+/g, " ").replace(/\s+([,.;:!?])/g, "$1").trim();
}

function buildWhatsAppFallbackMessage_(rowObj, portalInfo) {
  var row = rowObj || {};
  var template = getWhatsAppFallbackMessageTemplate_();
  var tokens = buildWhatsAppFallbackTemplateTokens_(row, portalInfo);
  var message = renderWhatsAppFallbackTemplate_(template, tokens);
  if (tokens.PortalLink && message.indexOf(tokens.PortalLink) < 0) {
    message = (message + " Portal link: " + tokens.PortalLink).trim();
  }
  return message;
}

function buildWhatsAppFallbackPhoneFormatted_(phoneNormalized) {
  var normalized = clean_(phoneNormalized || "");
  if (!/^675\d{8}$/.test(normalized)) return normalized;
  return "+675 " + normalized.slice(3, 4) + " " + normalized.slice(4, 7) + " " + normalized.slice(7);
}

function buildWhatsAppFallbackWebLink_(phoneNormalized, messageText) {
  var phone = clean_(phoneNormalized || "");
  var msg = clean_(messageText || "");
  if (!phone) return "";
  return "https://web.whatsapp.com/send?phone=" + encodeURIComponent(phone) + "&text=" + encodeURIComponent(msg);
}

function getWhatsAppFallbackCacheKey_(adminEmail, batchLabel) {
  return "WA_FALLBACK_CSV::" + clean_(adminEmail || "").toLowerCase() + "::" + clean_(batchLabel || "");
}

function getWhatsAppFallbackLastCacheKey_(adminEmail) {
  return "WA_FALLBACK_LAST::" + clean_(adminEmail || "").toLowerCase();
}

function writeWhatsAppFallbackCsvCache_(adminEmail, snapshot) {
  var userCache = CacheService.getUserCache();
  var admin = clean_(adminEmail || "").toLowerCase();
  var data = snapshot && typeof snapshot === "object" ? snapshot : {};
  var batchLabel = clean_(data.batchLabel || "");
  if (!admin || !batchLabel || !clean_(data.csv || "")) return;
  var ttl = Math.max(60, Math.floor(Number(CONFIG.WHATSAPP_FALLBACK_CACHE_TTL_SECONDS || 3600)));
  var payload = {
    batchLabel: batchLabel,
    filename: clean_(data.filename || ("fode-whatsapp-fallback-" + batchLabel + ".csv")),
    csv: String(data.csv || ""),
    summary: data.summary && typeof data.summary === "object" ? data.summary : {},
    createdAt: new Date().toISOString()
  };
  try { userCache.put(getWhatsAppFallbackCacheKey_(admin, batchLabel), JSON.stringify(payload), ttl); } catch (_e) {}
  try { userCache.put(getWhatsAppFallbackLastCacheKey_(admin), JSON.stringify({ batchLabel: batchLabel, createdAt: payload.createdAt }), ttl); } catch (_e2) {}
}

function readWhatsAppFallbackCsvCache_(adminEmail, batchLabel) {
  var admin = clean_(adminEmail || "").toLowerCase();
  var label = clean_(batchLabel || "");
  if (!admin || !label) return null;
  try {
    var raw = CacheService.getUserCache().get(getWhatsAppFallbackCacheKey_(admin, label));
    return raw ? JSON.parse(raw) : null;
  } catch (_e) {
    return null;
  }
}

function readWhatsAppFallbackLastCsvCache_(adminEmail) {
  var admin = clean_(adminEmail || "").toLowerCase();
  if (!admin) return null;
  try {
    var raw = CacheService.getUserCache().get(getWhatsAppFallbackLastCacheKey_(admin));
    if (!raw) return null;
    var last = JSON.parse(raw);
    if (!last || !clean_(last.batchLabel || "")) return null;
    return readWhatsAppFallbackCsvCache_(admin, last.batchLabel);
  } catch (_e) {
    return null;
  }
}

function buildWhatsAppFallbackEmailSubject_(batchLabel) {
  var label = clean_(batchLabel || "");
  return "FODE WhatsApp Fallback CSV" + (label ? (" - " + label) : "");
}

function buildWhatsAppFallbackEmailBody_(snapshot) {
  var s = snapshot && typeof snapshot === "object" ? snapshot : {};
  var summary = s.summary && typeof s.summary === "object" ? s.summary : {};
  var lines = [
    "Attached is the WhatsApp fallback CSV for manual operator use only.",
    "",
    "Batch label: " + clean_(s.batchLabel || ""),
    "Exported rows: " + Number(summary.exported || 0),
    "Scanned rows: " + Number(summary.scanned || 0),
    "Filter: " + clean_(summary.filter || "ALL_FALLBACK"),
    "Batch size: " + Number(summary.limit || 0),
    "",
    "Use the CSV rows as the source of truth for review.",
    "Do not bulk send WhatsApp messages.",
    "Do not automate browser clicks or sends.",
    "Use the MessageText and WhatsAppWebLink columns for manual copy/paste or single-recipient opening only."
  ];
  return lines.join("\n");
}

function buildWhatsAppFallbackBatchLabel_() {
  var tz = Session.getScriptTimeZone() || "GMT";
  return "WA-FODE-" + Utilities.formatDate(new Date(), tz, "yyyyMMdd") + "-BATCH-001";
}

function admin_exportWhatsAppFallbackCsv(payload) {
  return withEnvelope_("admin_exportWhatsAppFallbackCsv", function () {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    requireOperationsAdmin_(adminEmail);
    var p = payload && typeof payload === "object" ? payload : {};
    var limit = normalizeWhatsAppFallbackLimit_(p.limit || p.batchSize || CONFIG.WHATSAPP_FALLBACK_DEFAULT_LIMIT || 20);
    var filter = normalizeWhatsAppFallbackFilter_(p.filter || "ALL_FALLBACK");
    var startRow = Math.max(2, Math.floor(Number(p.startRow || 2)));
    var batchLabel = buildWhatsAppFallbackBatchLabel_();
    var sh = openDataSheet_();
    var values = sh.getDataRange().getValues();
    var headers = values && values.length ? values[0] : [];
    var portalLookup = typeof buildPortalSecretPreviewLookup_ === "function"
      ? buildPortalSecretPreviewLookup_()
      : { ok: false, byApplicantId: {} };
    if (!portalLookup || portalLookup.ok !== true) portalLookup = { ok: false, byApplicantId: {} };
    var rows = [[
      "BatchLabel", "ApplicantID", "StudentName", "ParentName", "PhoneRaw", "PhoneNormalized",
      "PhoneFormatted", "EmailRaw", "EmailCorrected", "EmailIssue", "Stage", "LastContactResult", "BounceFlag",
      "BounceReason", "PortalUrlStatus", "PortalUrl", "MessageText", "WhatsAppLink", "WhatsAppWebLink", "OperatorNotes"
    ]];
    var summary = {
      scanned: 0,
      exported: 0,
      invalidPhone: 0,
      skipped: 0,
      skippedDuplicatePhone: 0,
      batchLabel: batchLabel,
      limit: limit,
      filter: filter,
      startRow: startRow
    };
    var seenPhone = {};
    for (var r = Math.max(1, startRow - 1); r < values.length; r++) {
      summary.scanned++;
      var rowObj = campaignRowObjectFromValues_(headers, values[r]);
      if (!isWhatsAppFallbackCandidate_(rowObj, filter)) continue;
      var phoneRaw = getWhatsAppFallbackPhoneRaw_(rowObj);
      var phone = normalizePngWhatsAppPhone_(phoneRaw);
      if (!phone.ok) {
        summary.invalidPhone++;
        continue;
      }
      if (seenPhone[phone.normalized]) {
        summary.skippedDuplicatePhone++;
        summary.skipped++;
        continue;
      }
      seenPhone[phone.normalized] = true;
      var applicantId = clean_(rowObj.ApplicantID || "");
      if (!applicantId) {
        summary.skipped++;
        continue;
      }
      var studentName = getWhatsAppFallbackStudentName_(rowObj);
      var parentName = getWhatsAppFallbackParentName_(rowObj);
      var emailIssue = getWhatsAppFallbackEmailIssue_(rowObj);
      var portalInfo = buildWhatsAppFallbackPortalInfo_(applicantId, portalLookup);
      var messageText = buildWhatsAppFallbackMessage_(rowObj, portalInfo);
      var waLink = "https://wa.me/" + phone.normalized + "?text=" + encodeURIComponent(messageText);
      var waWebLink = buildWhatsAppFallbackWebLink_(phone.normalized, messageText);
      var stage = "";
      try {
        stage = clean_(stageAggregationSnapshot_(rowObj).stage || "");
      } catch (_stageErr) {
        stage = clean_(rowObj.Comm_Stage || rowObj.Stage || "");
      }
      rows.push([
        batchLabel,
        applicantId,
        studentName,
        parentName,
        phoneRaw,
        phone.normalized,
        buildWhatsAppFallbackPhoneFormatted_(phone.normalized),
        clean_(rowObj.Parent_Email || ""),
        clean_(rowObj.Parent_Email_Corrected || ""),
        emailIssue,
        stage,
        clean_(rowObj.Last_Contact_Result || ""),
        clean_(rowObj.Email_Bounce_Flag || ""),
        clean_(rowObj.Email_Bounce_Reason || ""),
        portalInfo.status,
        portalInfo.url,
        messageText,
        waLink,
        waWebLink,
        "Operator review required. Use individual link or broadcast list; do not create applicant groups."
      ]);
      summary.exported++;
      if (summary.exported >= limit) break;
    }
    var csv = rows.map(function (row) { return buildCsvLine_(row); }).join("\n");
    var filename = "fode-whatsapp-fallback-" + batchLabel + ".csv";
    summary.filename = filename;
    writeWhatsAppFallbackCsvCache_(adminEmail, {
      batchLabel: batchLabel,
      filename: filename,
      csv: csv,
      summary: summary
    });
    logAdminEvent_("WHATSAPP_CSV_GENERATED", {
      batchLabel: batchLabel,
      adminEmail: adminEmail,
      limit: limit,
      filter: filter,
      exported: summary.exported,
      scanned: summary.scanned
    });
    return {
      detail: {
        filename: filename,
        csv: csv,
        summary: summary
      }
    };
  });
}

function admin_emailWhatsAppFallbackCsv(payload) {
  return withEnvelope_("admin_emailWhatsAppFallbackCsv", function () {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    requireSuperAdmin_(adminEmail);
    var p = payload && typeof payload === "object" ? payload : {};
    var batchLabel = clean_(p.batchLabel || "");
    var snapshot = batchLabel ? readWhatsAppFallbackCsvCache_(adminEmail, batchLabel) : readWhatsAppFallbackLastCsvCache_(adminEmail);
    if (!snapshot || !clean_(snapshot.csv || "")) {
      throw new Error("No cached WhatsApp fallback CSV found. Export the CSV first.");
    }
    var recipientResolution = resolveWhatsAppFallbackAdminRecipients_();
    var recipients = recipientResolution.recipients || [];
    var recipientSource = clean_(recipientResolution.source || "NONE");
    if (!recipients.length) {
      throw new Error("No admin recipients configured for WhatsApp fallback CSV email.");
    }
    logAdminEvent_("S5C_WHATSAPP_FALLBACK_EMAIL_RECIPIENTS", {
      batchLabel: snapshot.batchLabel || batchLabel || "",
      recipientCount: recipients.length,
      recipients: recipients.join(","),
      recipientSource: recipientSource
    });
    var subject = buildWhatsAppFallbackEmailSubject_(snapshot.batchLabel || batchLabel);
    var body = buildWhatsAppFallbackEmailBody_(snapshot);
    var blob = Utilities.newBlob(String(snapshot.csv || ""), "text/csv", clean_(snapshot.filename || ("fode-whatsapp-fallback-" + (snapshot.batchLabel || batchLabel || "batch") + ".csv")));
    var sent = adminSendEmail_(recipients.join(","), subject, body, {
      attachments: [blob],
      name: clean_(CONFIG.EMAIL_FROM_NAME || "FODE Admissions"),
      replyTo: clean_(CONFIG.EMAIL_REPLY_TO || ""),
      cc: "",
      sendSource: "WHATSAPP_FALLBACK_ADMIN_EMAIL",
      unattended: false,
      action: "whatsapp_fallback_csv_admin_email",
      templateType: "whatsapp_fallback_csv_admin_email"
    });
    if (!sent.ok) {
      logAdminEvent_("WHATSAPP_CSV_ADMIN_EMAIL_FAILED", {
        batchLabel: snapshot.batchLabel || batchLabel || "",
        recipients: recipients.join(","),
        recipientCount: recipients.length,
        recipientSource: recipientSource,
        error: clean_(sent.error || "WhatsApp fallback CSV email failed")
      });
      return {
        ok: false,
        code: "WHATSAPP_CSV_ADMIN_EMAIL_FAILED",
        message: clean_(sent.error || "WhatsApp fallback CSV email failed"),
        recipientCount: recipients.length,
        recipients: recipients.join(","),
        recipientSource: recipientSource,
        sent: false
      };
    }
    logAdminEvent_("WHATSAPP_CSV_ADMIN_EMAIL_SENT", {
      batchLabel: snapshot.batchLabel || batchLabel || "",
      recipients: recipients.join(","),
      recipientCount: recipients.length,
      recipientSource: recipientSource,
      filename: clean_(snapshot.filename || ""),
      summary: snapshot.summary || {}
    });
    return {
      ok: true,
      batchLabel: snapshot.batchLabel || batchLabel || "",
      recipientCount: recipients.length,
      recipients: recipients.join(","),
      recipientSource: recipientSource,
      sent: !!(sent && sent.ok),
      filename: clean_(snapshot.filename || "")
    };
  });
}

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

function nonEmpty_(v) {
  var s = String(v === null || v === undefined ? "" : v).trim();
  if (!s) return false;
  var n = s.toLowerCase();
  if (n === "0" || n === "false" || n === "n/a") return false;
  return true;
}

function hasAnyRequiredDoc_(rowObj) {
  var row = rowObj || {};
  var required = [
    "Birth_ID_Passport_File",
    "Latest_School_Report_File",
    "Transfer_Certificate_File",
    "Passport_Photo_File"
  ];
  for (var i = 0; i < required.length; i++) {
    if (hasUploadEvidence_(row[required[i]], required[i])) return true;
  }
  return false;
}

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

function hasStudentActivity_(row) {
  var r = row || {};
  var lastUpdateRaw = r.PortalLastUpdateAt;
  var lastUpdateTs = parseTime_(lastUpdateRaw);
  if (!(lastUpdateTs > 0)) return false;
  var submitted = clean_(r.Portal_Submitted || "");
  if (!submitted) return true;
  return submitted === "Yes" || submitted.indexOf("T") > 0;
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
  var mappings = [
    { file: "Birth_ID_Passport_File", status: "Birth_ID_Status" },
    { file: "Latest_School_Report_File", status: "Report_Status" }
  ];
  for (var i = 0; i < mappings.length; i++) {
    var m = mappings[i];
    if (idx && (!idx[m.file] || !idx[m.status])) continue;
    var hasFile = hasUploadEvidence_(row[m.file], m.file);
    var status = clean_(row[m.status] || "");
    if (hasFile && normalizeDocStatus_(status || "Pending") !== "Verified") return true;
  }
  return false;
}

function isQueueCandidateRow_(rowObj) {
  var row = rowObj || {};
  var applicantId = clean_(row.ApplicantID || "");
  if (!applicantId) return false;

  var portalSubmittedRaw = clean_(row.Portal_Submitted || "");
  var portalSubmitted = nonEmpty_(portalSubmittedRaw) && portalSubmittedRaw !== "No";
  var docsVerified = clean_(row.Docs_Verified || "") === "Yes" || computeDocVerificationStatus_(row) === "Verified";
  var paymentVerified = derivePaymentBadge_(row) === "Verified";

  return isExternalFdIntakeRow_(row) || portalSubmitted || docsVerified || paymentVerified;
}

function isExternalFdIntakeRow_(rowObj) {
  var row = rowObj || {};
  if (!clean_(row.ApplicantID || "")) return false;
  var adapterSource = clean_(row.adapter_source || row.Adapter_Source || "").toLowerCase();
  var forwarded = clean_(row.adapter_forwarded || row.Adapter_Forwarded || "").toLowerCase();
  var hasForwarded = forwarded === "1" || forwarded === "true" || forwarded === "yes";
  var hasAdapterVersion = !!clean_(row.adapter_version || row.Adapter_Version || "");
  return adapterSource === "sheet_bound_adapter" || hasForwarded || hasAdapterVersion;
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

function deriveOperationalPipelineStage_(rowObj) {
  var row = rowObj || {};
  var raw = clean_(row.Pipeline_Stage || row.Operational_Stage || row.CRM_Stage || row.Stage || "");
  var normalized = raw.toLowerCase();
  if (normalized === "new to mlckia") return "New To MLCKIA";
  if (normalized === "contacted") return "Contacted";
  if (normalized === "documents pending") return "Documents Pending";
  if (normalized === "payment pending") return "Payment Pending";
  if (normalized === "enrolled") return "Enrolled";
  if (normalized === "closed lost") return "Closed Lost";

  var portalSubmitted = nonEmpty_(row.Portal_Submitted || "") && clean_(row.Portal_Submitted || "") !== "No";
  var docsVerified = clean_(row.Docs_Verified || "") === "Yes" || computeDocVerificationStatus_(row) === "Verified";
  var paymentVerified = derivePaymentBadge_(row) === "Verified";
  var registrationComplete = clean_(row.Registration_Complete || "") === "Yes";
  var receiptPresent = hasUploadEvidence_(row.Fee_Receipt_File, "Fee_Receipt_File");
  var emailStatus = normalizeEmailStatus_(row.Email_Status || "");
  var lastContact = clean_(row.Last_Contact_Result || "").toUpperCase();

  if (/closed|lost|withdraw/i.test(raw)) return "Closed Lost";
  if (registrationComplete || paymentVerified) return "Enrolled";
  if (docsVerified || receiptPresent) return "Payment Pending";
  if (portalSubmitted) return "Documents Pending";
  if (emailStatus === "SENT" || emailStatus === "SEND_ATTEMPT" || lastContact) return "Contacted";
  return "New To MLCKIA";
}

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
    scannedRows: rows,
    scanDurationMs: 0
  };
  for (var r = 1; r < values.length; r++) {
    var rowObj = campaignRowObjectFromValues_(headers, values[r]);
    if (!clean_(rowObj.ApplicantID || "")) continue;
    if (isSameLocalDate_(rowObj.Timestamp || rowObj.timestamp || rowObj.adapter_timestamp || rowObj.Created_At || rowObj.PortalTokenIssuedAt || "", now)) out.formsReceivedToday++;
    var pipeline = deriveOperationalPipelineStage_(rowObj);
    var lifecycleStage = clean_(deriveApplicantLifecycleStage_(rowObj) || "UNKNOWN").toUpperCase() || "UNKNOWN";
    var portalSubmitted = nonEmpty_(rowObj.Portal_Submitted || "") && clean_(rowObj.Portal_Submitted || "") !== "No";
    var completeness = adminOpsRequiredDocumentUploadSummary_(rowObj);
    var docsReviewVerified = clean_(rowObj.Docs_Verified || "") === "Yes" || computeDocVerificationStatus_(rowObj) === "Verified";
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
    if (lastResult === "FAILED") emailStates.FAILED++;
    if (lastResult === "SUPPRESSED") emailStates.SUPPRESSED++;
    if (emailStatus === "FAILED" || emailStatus === "BOUNCED" || lastResult === "FAILED") out.emailFailures++;
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

function campaignReportPortalSubmitted_(rowObj) {
  var row = rowObj || {};
  var raw = clean_(row.Portal_Submitted || "");
  return nonEmpty_(raw) && raw !== "No";
}

function isCampaignReportApplicationRow_(rowObj) {
  var row = rowObj || {};
  if (!clean_(row.ApplicantID || "")) return false;
  if (campaignReportPortalSubmitted_(row)) return true;
  if (isExternalFdIntakeRow_(row)) return true;
  if (hasStudentActivity_(row)) return true;
  return !!clean_(row.FD_FormID || row.FormID || "");
}

function campaignReportValidApplication_(rowObj) {
  var row = rowObj || {};
  return clean_(row.Docs_Verified || "") === "Yes"
    || computeDocVerificationStatus_(row) === "Verified"
    || derivePaymentBadge_(row) === "Verified"
    || clean_(row.Registration_Complete || "") === "Yes";
}

function campaignReportStatusText_(rowObj) {
  var row = rowObj || {};
  return [
    row.Duplicate_Status,
    row.Duplicate_Flag,
    row.Is_Duplicate,
    row.Overall_Status,
    row.Pipeline_Stage,
    row.Operational_Stage,
    row.CRM_Stage,
    row.Stage
  ].map(function (value) { return clean_(value || ""); }).filter(Boolean).join(" | ").toLowerCase();
}

function campaignReportDuplicateBlockedIneligible_(rowObj) {
  var row = rowObj || {};
  var duplicateFlag = clean_(row.Is_Duplicate || row.Duplicate_Flag || "");
  if (/^(yes|true|1)$/i.test(duplicateFlag)) return true;
  var text = campaignReportStatusText_(rowObj);
  if (!text) return false;
  return /duplicate|blocked|ineligible|dropped|disqualified|closed\s*lost|withdrawn|not\s*eligible/.test(text);
}

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

function buildActionabilityPreviewRow_(rowObj, rowNumber) {
  var row = rowObj || {};
  var applicantId = clean_(row.ApplicantID || "");
  var firstName = clean_(row.First_Name || "");
  var lastName = clean_(row.Last_Name || "");
  var name = (firstName + " " + lastName).trim();
  var effectiveEmail = stageAggregationEffectiveEmail_(row);
  var hasValidEmail = stageAggregationIsValidEmail_(effectiveEmail);
  var emailIssue = adminOpsHasEmailIssue_(row);
  var uploadSummary = adminOpsRequiredDocumentUploadSummary_(row);
  var docsVerified = isYes_(row.Docs_Verified) || computeDocVerificationStatus_(row) === "Verified";
  var portalSubmittedRaw = clean_(row.Portal_Submitted || "");
  var portalSubmitted = nonEmpty_(portalSubmittedRaw) && portalSubmittedRaw !== "No";
  var paymentEvidencePresent = hasUploadEvidence_(row.Fee_Receipt_File, "Fee_Receipt_File");
  var paymentBadge = derivePaymentBadge_(row);
  var paymentVerified = paymentBadge === "Verified";
  var enrolled = isYes_(row.Registration_Complete) || isYes_(row.Enrolled_Confirmed) || !!clean_(row.Enrolled_At || "");
  var lifecycleStage = clean_(deriveApplicantLifecycleStage_(row) || deriveOperationalPipelineStage_(row) || "UNKNOWN").toUpperCase();
  var documentState = adminOpsDocumentStateFromRow_(row);
  var dateInfo = actionabilityPreviewDateInfo_(row);
  var lastContactAgeDays = actionabilityPreviewLastContactAgeDays_(row);
  var nextActionTs = parseTime_(row.Email_Next_Action_Date || "");
  var cooldownActive = nextActionTs > Date.now();
  var owner = "NONE";
  var nextAction = "NO_ACTION";
  var recommendedMessageType = "";
  var suppressor = "";
  var explanation = "";

  if (!hasValidEmail) suppressor = "NO_EFFECTIVE_EMAIL";
  else if (emailIssue) suppressor = "EMAIL_BLOCKED_OR_BOUNCED";
  else if (cooldownActive) suppressor = "COOLDOWN_ACTIVE";

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
  return {
    rowNumber: rowNumber,
    applicantId: applicantId,
    name: name,
    actionOwner: owner,
    nextAction: nextAction,
    urgencyLevel: urgency.level,
    urgencyReason: urgency.reason,
    suppressor: suppressor,
    recommendedMessageType: recommendedMessageType,
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
      hasValidEmail: !!hasValidEmail
    }
  };
}

function compareActionabilityPreviewRows_(a, b) {
  var order = { DORMANT: 1, ESCALATED: 2, OVERDUE: 3, DUE: 4, NORMAL: 5 };
  var aRank = order[clean_(a && a.urgencyLevel || "").toUpperCase()] || 99;
  var bRank = order[clean_(b && b.urgencyLevel || "").toUpperCase()] || 99;
  if (aRank !== bRank) return aRank - bRank;
  return Number(b && b.ageDays || 0) - Number(a && a.ageDays || 0);
}

function admin_getActionabilityPreview(payload) {
  var adminEmail = getCallerEmail_();
  if (!isAdmin_(adminEmail)) throw new Error("Access denied");
  var p = payload && typeof payload === "object" ? payload : {};
  var limit = Math.max(1, Math.min(100, Number(p.limit || 40)));
  var sheet = openDataSheet_();
  var data = sheet.getDataRange().getValues();
  var out = {
    ok: true,
    readOnly: true,
    experimental: true,
    generatedAt: new Date().toISOString(),
    limit: limit,
    scannedRows: Math.max(0, (data || []).length - 1),
    includedRows: 0,
    countsByOwner: { APPLICANT: 0, OFFICER: 0, FINANCE: 0, ADMIN: 0, SYSTEM: 0, NONE: 0 },
    rows: []
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
    rows.push(item);
  }
  rows.sort(compareActionabilityPreviewRows_);
  out.includedRows = rows.length;
  out.rows = rows.slice(0, limit);
  return out;
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

function mapStagePriority_(stage) {
  switch (clean_(stage || "").toUpperCase()) {
    case "PAYMENT_REQUIRED":
    case "RECEIPT_AWAITING_VERIFICATION":
      return "HIGH";
    case "DOCS_REQUIRED":
    case "REMINDER_DUE":
    case "INVITED_AWAITING_RESPONSE":
      return "NORMAL";
    default:
      return "LOW";
  }
}

function stageAggregationSortIndex_(stage) {
  var order = {
    PAYMENT_REQUIRED: 1,
    RECEIPT_AWAITING_VERIFICATION: 2,
    DOCS_REQUIRED: 3,
    REMINDER_DUE: 4,
    INVITED_AWAITING_RESPONSE: 5,
    INVITE_PENDING: 6,
    PROCESSING: 7,
    COMPLETE: 8,
    UNKNOWN: 99
  };
  var normalized = clean_(stage || "").toUpperCase();
  return Object.prototype.hasOwnProperty.call(order, normalized) ? order[normalized] : 99;
}

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
  var out = { ok: true, stages: [] };
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
  var required = [
    { field: "Birth_ID_Passport_File", label: "Birth Certificate / NID / Passport" },
    { field: "Latest_School_Report_File", label: "Latest School Reports / Documents" },
    { field: "Passport_Photo_File", label: "Passport Size Colour Photo" }
  ];
  var uploaded = [];
  var missing = [];
  for (var i = 0; i < required.length; i++) {
    var item = required[i];
    if (hasUploadEvidence_(row[item.field], item.field)) uploaded.push(item.field);
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
  var paymentBadge = derivePaymentBadge_(row);
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

        var paymentVerifiedRaw = clean_(rowObj.Payment_Verified || "") === "Yes";
        var paymentBadge = derivePaymentBadge_(rowObj);
        var receiptUrl = clean_(rowObj.Fee_Receipt_File || "");
        var docsVerifiedRaw = clean_(rowObj.Docs_Verified || "");
        var mandatoryDocIssue = hasMandatoryDocIssue_(rowObj, idx);

        var docsVerifiedForFollowup = isYes_(rowObj.Docs_Verified) || computeDocVerificationStatus_(rowObj) === "Verified";
        var hasValidEmailForFollowup = !!getRowEmailForStudent_(rowObj);
        var docsFollowupEligibleBase = CONFIG.DOCS_FOLLOWUP_ENABLE === true && docsVerifiedForFollowup && hasValidEmailForFollowup;
        var docsFollowupSentAt = getDocsFollowupSentAt_(rowObj);
        var eligibleDocsFollowUp = docsFollowupEligibleBase && !safeStr_(docsFollowupSentAt || "");
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
          docsFollowupEligibleBase: !!docsFollowupEligibleBase,
          eligibleDocsFollowUp: !!eligibleDocsFollowUp,
          docsFollowupSentAt: safeStr_(docsFollowupSentAt || "")
        };

        var hasActivity = hasStudentActivity_(rowObj);
        var portalSubmittedRaw = clean_(rowObj.Portal_Submitted || "");
        var portalSubmitted = nonEmpty_(portalSubmittedRaw) && portalSubmittedRaw !== "No";
        var docsReviewVerified = docsVerifiedRaw === "Yes" || computeDocVerificationStatus_(rowObj) === "Verified";
        var paymentEvidencePresent = hasUploadEvidence_(rowObj.Fee_Receipt_File, "Fee_Receipt_File");
        var paymentReceived = paymentEvidencePresent;
        var paymentVerified = paymentBadge === "Verified";
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
            docsFollowupEligibleBase: !!it.docsFollowupEligibleBase,
            eligibleDocsFollowUp: !!it.eligibleDocsFollowUp,
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
      var eligibleBase = !!out.docsFollowupEligibleBase;
      out.eligibleDocsFollowUp = !!(applicantId && eligibleBase && !sentAt);
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

function findDocMapping_(file, statusField, commentField, docMap) {
  var i;
  if (file) {
    for (i = 0; i < docMap.length; i++) if (docMap[i].file === file) return docMap[i];
  }
  if (statusField && commentField) {
    for (i = 0; i < docMap.length; i++) {
      if (docMap[i].status === statusField && docMap[i].comment === commentField) return docMap[i];
    }
  }
  return null;
}

function normalizeDocStatus_(s) {
  var v = clean_(s).toLowerCase();
  if (v === "verified") return "Verified";
  if (v === "rejected") return "Rejected";
  if (v === "fraudulent") return "Fraudulent";
  return "Pending";
}

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

function toRouteStatusKey_(status) {
  if (status === "Verified") return "VERIFIED";
  if (status === "Rejected") return "REJECTED";
  if (status === "Fraudulent") return "FRAUDULENT";
  return "PENDING_REVIEW";
}

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

function normalizeStageBatchStage_(stage) {
  var normalized = clean_(stage || "").toUpperCase();
  if (!normalized || normalized === "UNKNOWN") return "";
  return stageAggregationSortIndex_(normalized) < 99 ? normalized : "";
}

function getBatchMessageTypeForStage_(stage) {
  var normalized = normalizeStageBatchStage_(stage);
  switch (normalized) {
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

function isBatchSendableStage_(stage) {
  return !!getBatchMessageTypeForStage_(stage);
}

function clampStageBatchLimit_(rawLimit) {
  var n = Math.floor(Number(rawLimit || 0));
  var safeDefault = Math.max(1, Number(CONFIG.DEFAULT_STAGE_BATCH_SIZE || 20));
  var safeMax = Math.max(1, Number(CONFIG.MAX_STAGE_BATCH_SIZE || 30));
  if (!(n > 0)) return Math.min(safeDefault, safeMax);
  return Math.max(1, Math.min(safeMax, n));
}

function clampStageBatchOffset_(rawOffset) {
  var n = Math.floor(Number(rawOffset || 0));
  if (!(n >= 0)) return 0;
  return Math.max(0, n);
}

function stageBatchLimitMeta_(rawLimit) {
  var requested = Math.floor(Number(rawLimit || 0));
  var effective = clampStageBatchLimit_(rawLimit);
  var safeMax = Math.max(1, Number(CONFIG.MAX_STAGE_BATCH_SIZE || 30));
  var clamped = requested > safeMax;
  return {
    requested: requested,
    effective: effective,
    safeMax: safeMax,
    clamped: clamped,
    warning: clamped ? ("Batch size reduced to safe limit (" + safeMax + ") to prevent timeout") : ""
  };
}

function getStageBatchPreviewCacheKey_(adminEmail) {
  return "ADMIN_STAGE_BATCH_PREVIEW::" + clean_(adminEmail || "").toLowerCase();
}

function readStageBatchPreviewCache_(adminEmail) {
  try {
    var raw = CacheService.getUserCache().get(getStageBatchPreviewCacheKey_(adminEmail));
    return raw ? JSON.parse(raw) : null;
  } catch (_cacheErr) {
    return null;
  }
}

function stageBatchPreviewCacheTtlSeconds_() {
  return 600;
}

function writeStageBatchPreviewCache_(adminEmail, value) {
  try {
    CacheService.getUserCache().put(getStageBatchPreviewCacheKey_(adminEmail), JSON.stringify(value || {}), stageBatchPreviewCacheTtlSeconds_());
  } catch (_cacheErr) {}
}

function clearStageBatchPreviewCache_(adminEmail) {
  try {
    CacheService.getUserCache().remove(getStageBatchPreviewCacheKey_(adminEmail));
  } catch (_cacheErr) {}
}

function incrementStageBatchReason_(map, code) {
  var key = clean_(code || "BLOCKED").toUpperCase() || "BLOCKED";
  map[key] = Number(map[key] || 0) + 1;
}

function pushStageBatchSample_(list, applicantId) {
  var id = clean_(applicantId || "");
  if (!id) return;
  if (list.indexOf(id) >= 0) return;
  if (list.length < 10) list.push(id);
}

function stageBatchCandidateIds_(cohort) {
  var src = cohort && typeof cohort === "object" ? cohort : {};
  var candidates = Array.isArray(src.candidates) ? src.candidates : [];
  var out = [];
  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i] && typeof candidates[i] === "object" ? candidates[i] : {};
    var applicantId = clean_(candidate.applicantId || "");
    if (!applicantId) continue;
    out.push(applicantId);
  }
  return out;
}

function stageBatchCandidateHash_(candidateIds) {
  var ids = Array.isArray(candidateIds) ? candidateIds : [];
  var normalized = [];
  for (var i = 0; i < ids.length; i++) {
    var applicantId = clean_(ids[i] || "");
    if (!applicantId) continue;
    normalized.push(applicantId);
  }
  return normalized.join("|");
}

function stageBatchPreviewAgeSeconds_(writtenAt) {
  var raw = clean_(writtenAt || "");
  if (!raw) return -1;
  var parsed = new Date(raw).getTime();
  if (!(parsed > 0)) return -1;
  return Math.max(0, Math.floor((Date.now() - parsed) / 1000));
}

function stageBatchPreviewLog_(label, payload) {
  var data = payload && typeof payload === "object" ? payload : {};
  logOperationalBlock_(label, Object.assign({
    runtimeVersion: clean_(CONFIG.VERSION || ""),
    deployVersion: Number(CONFIG.DEPLOY_VERSION_NUMBER || 0)
  }, data));
}

function buildBatchPreviewIdempotencySummary_(cohort, messageType, batchId) {
  var candidates = Array.isArray(cohort && cohort.candidates) ? cohort.candidates : [];
  var alreadyProcessedCount = Number(cohort && cohort.alreadySentExcluded || 0);
  var replaySamples = [];
  candidates.forEach(function (candidate) {
    var ctx = {
      applicantId: clean_(candidate && candidate.applicantId || ""),
      messageType: clean_(messageType || ""),
      rowObj: candidate && candidate.rowObj ? candidate.rowObj : {},
      emailStatus: clean_(candidate && candidate.emailStatus || ""),
      batchLabel: ""
    };
    var key = typeof computeEmailIdempotencyKey_ === "function" ? computeEmailIdempotencyKey_(ctx, { batchLabel: "" }) : "";
    var replay = typeof wasEmailAlreadyProcessed_ === "function" ? wasEmailAlreadyProcessed_(ctx, key) : { alreadyProcessed: false };
    if (replay && replay.alreadyProcessed) {
      alreadyProcessedCount++;
      if (replaySamples.length < 10) replaySamples.push(ctx.applicantId);
    }
  });
  return {
    active: true,
    batchId: clean_(batchId || ""),
    candidateCount: candidates.length,
    alreadyProcessedCount: alreadyProcessedCount,
    replayBlockedCount: alreadyProcessedCount,
    replayApplicantIdsSample: replaySamples
  };
}

function stageBatchShouldExcludeFailedDefault_(rowObj, messageType) {
  // Production invite batches skip prior hard failures for the same message type until an explicit retry flow is used.
  var normalizedType = normalizeApplicantMessageType_(messageType || "");
  if (!normalizedType) return false;
  var row = rowObj || {};
  var status = clean_(row.Email_Status || "").toUpperCase();
  var flag = clean_(row.Email_Bounce_Flag || "").toUpperCase();
  var reason = clean_(row.Email_Bounce_Reason || "");
  var reasonLower = reason.toLowerCase();
  if (status === "FAILED") {
    if (["HARD", "DOMAIN", "UNKNOWN"].indexOf(flag) >= 0) return true;
    if (reasonLower.indexOf("missing required alias") >= 0) return true;
    if (flag === "TEMP") {
      var nextActionMs = typeof parseTime_ === "function" ? parseTime_(row.Email_Next_Action_Date || "") : 0;
      return !(nextActionMs > 0 && nextActionMs <= new Date().getTime());
    }
  }
  var communicationState = deriveCommunicationState_(row, normalizedType, {});
  return communicationState.durablePriorFailureSameType === true;
}

function stageBatchDurableGroupForStage_(stage, messageType) {
  var normalizedStage = normalizeStageBatchStage_(stage);
  var normalizedType = normalizeApplicantMessageType_(messageType || getBatchMessageTypeForStage_(normalizedStage) || "");
  if (!normalizedType) return "";
  if (normalizedType === "legacy_invite") return "legacy_invite";
  if (normalizedType !== "reminder") return "";
  switch (normalizedStage) {
    case "INVITED_AWAITING_RESPONSE":
    case "REMINDER_DUE":
      return "pre_response_reminder";
    case "DOCS_REQUIRED":
      return "docs_required_reminder";
    case "PAYMENT_REQUIRED":
      return "payment_required_reminder";
    case "RECEIPT_AWAITING_VERIFICATION":
      return "receipt_verification_reminder";
    default:
      return "";
  }
}

function stageBatchDurableGroupFromLastContactBatch_(rowObj) {
  var row = rowObj || {};
  var batchLabel = clean_(row.Last_Contact_Batch || "");
  if (!batchLabel) return "";
  var match = /^STAGE_SEND::([^:]+)::/.exec(batchLabel);
  if (!match || !match[1]) return "";
  var priorStage = normalizeStageBatchStage_(match[1] || "");
  if (!priorStage) return "";
  return stageBatchDurableGroupForStage_(priorStage, getBatchMessageTypeForStage_(priorStage));
}

function stageBatchShouldExcludePriorSuccessDefault_(rowObj, stage, messageType) {
  var normalizedType = normalizeApplicantMessageType_(messageType || "");
  if (!normalizedType) return false;
  var communicationState = deriveCommunicationState_(rowObj || {}, normalizedType, {});
  if (normalizedType === "legacy_invite") {
    return clean_(communicationState.base && communicationState.base.emailStatus || "") === "SENT";
  }
  if (normalizedType !== "reminder") return false;
  var currentGroup = stageBatchDurableGroupForStage_(stage, normalizedType);
  if (!currentGroup) return false;
  if (communicationState.lastContactMatchesScopedType !== true || communicationState.lastContactWasSent !== true) return false;
  var priorGroup = stageBatchDurableGroupFromLastContactBatch_(rowObj || {});
  if (!priorGroup) return false;
  return priorGroup === currentGroup;
}

function stageBatchLogSummary_(eventName, payload) {
  var tag = clean_(eventName || "STAGE_BATCH");
  var data = payload && typeof payload === "object" ? payload : {};
  try {
    if (typeof campaignLog_ === "function") {
      campaignLog_(tag, data);
    } else {
      Logger.log(tag + " " + JSON.stringify(data));
    }
  } catch (_logErr) {
    try {
      Logger.log(tag + " " + JSON.stringify(data));
    } catch (_logErr2) {}
  }
}

function stageBatchPreviewResponse_(data) {
  var src = data && typeof data === "object" ? data : {};
  var ok = src.ok === false ? false : true;
  var emptyReason = clean_(src.emptyReason || "");
  var message = clean_(src.message || "");
  var warning = clean_(src.warning || "");
  if (!message) {
    if (ok && emptyReason) message = emptyReason;
    else if (ok) message = "Preview ready.";
    else message = clean_(src.blockReason || src.error || "Preview failed.");
  }
  var phaseSrc = src.phaseTimings && typeof src.phaseTimings === "object" ? src.phaseTimings : {};
  var candidateIds = Array.isArray(src.candidateIds) ? src.candidateIds.map(function (id) {
    return clean_(id || "");
  }).filter(function (id) {
    return !!id;
  }) : [];
  return {
    ok: ok,
    action: "preview_stage_batch",
    result: ok ? (Number(src.count != null ? src.count : src.eligible || 0) > 0 ? "PREVIEW" : "EMPTY") : "ERROR",
    message: message,
    emptyReason: emptyReason,
    elapsedMs: Number(src.elapsedMs || 0),
    requestId: clean_(src.requestId || src.debugId || adminDebugId_()),
    debugId: clean_(src.debugId || src.requestId || adminDebugId_()),
    stage: clean_(src.stage || ""),
    messageType: clean_(src.messageType || ""),
    batchId: clean_(src.batchId || ""),
    count: Number(src.count != null ? src.count : src.eligible || 0),
    clientElapsedMs: Number(src.clientElapsedMs || 0),
    previewLimit: Number(src.previewLimit || src.limit || 0),
    limit: Number(src.limit || src.previewLimit || 0),
    requestedOffset: Number(src.requestedOffset || 0),
    offset: Number(src.offset || 0),
    offsetApplied: src.offsetApplied === true,
    offsetIgnored: src.offsetIgnored === true,
    offsetMode: clean_(src.offsetMode || "PRODUCTION_STATEFUL"),
    sendable: src.sendable === true,
    sendDisabledReason: clean_(src.sendDisabledReason || ""),
    writtenAt: clean_(src.writtenAt || ""),
    candidateIds: candidateIds,
    candidateCount: Number(src.candidateCount != null ? src.candidateCount : candidateIds.length),
    candidateHash: clean_(src.candidateHash || ""),
    firstScannedRow: Number(src.firstScannedRow || src.scanStartRow || 0),
    scanStartRow: Number(src.scanStartRow || 0),
    scanEndRow: Number(src.scanEndRow || 0),
    rowsScanned: Number(src.rowsScanned || src.scanned || 0),
    scanCap: Number(src.scanCap || 0),
    windowsScanned: Number(src.windowsScanned || 0),
    fallbackContinuationUsed: src.fallbackContinuationUsed === true,
    requestedLimit: Number(src.requestedLimit || src.previewLimit || src.limit || 0),
    partial: src.partial === true,
    partialReason: clean_(src.partialReason || ""),
    totalInStage: Number(src.totalInStage || 0),
    eligibleUnsentFound: Number(src.eligibleUnsentFound || 0),
    eligible: Number(src.eligible || src.count || 0),
    blocked: Number(src.blocked || 0),
    blockedCount: Number(src.blockedCount != null ? src.blockedCount : src.blocked || 0),
    alreadyProcessedCount: Number(src.alreadyProcessedCount || 0),
    idempotencySummary: src.idempotencySummary && typeof src.idempotencySummary === "object" ? src.idempotencySummary : {},
    propertyGuard: src.propertyGuard && typeof src.propertyGuard === "object" ? src.propertyGuard : {},
    alreadySentExcluded: Number(src.alreadySentExcluded || 0),
    failedExcluded: Number(src.failedExcluded || 0),
    blockedByReason: src.blockedByReason || {},
    eligibleApplicantIdsSample: Array.isArray(src.eligibleApplicantIdsSample) ? src.eligibleApplicantIdsSample.slice(0, 10) : [],
    blockedApplicantIdsSample: Array.isArray(src.blockedApplicantIdsSample) ? src.blockedApplicantIdsSample.slice(0, 10) : [],
    warning: warning,
    warnings: Array.isArray(src.warnings) ? src.warnings.slice(0, 10).map(function (msg) { return clean_(msg || ""); }).filter(function (msg) { return !!msg; }) : (warning ? [warning] : []),
    processedCount: Number(src.processedCount || 0),
    remainingEligibleEstimate: Number(src.remainingEligibleEstimate || 0),
    priority: clean_(src.priority || ""),
    blockCode: clean_(src.blockCode || src.code || ""),
    blockReason: clean_(src.blockReason || src.error || ""),
    error: clean_(src.error || (!ok ? message : "")),
    phaseTimings: {
      candidateSelectionMs: Number(phaseSrc.candidateSelectionMs || 0),
      eligibilityFilteringMs: Number(phaseSrc.eligibilityFilteringMs || 0),
      rowHydrationMs: Number(phaseSrc.rowHydrationMs || 0),
      resolutionMs: Number(phaseSrc.resolutionMs || 0),
      payloadAssemblyMs: Number(phaseSrc.payloadAssemblyMs || 0)
    }
  };
}

function stageBatchPreviewFinalizeForRpc_(data) {
  var base = stageBatchPreviewResponse_(data);
  try {
    return JSON.parse(JSON.stringify(base));
  } catch (_err) {
    return stageBatchPreviewResponse_({
      ok: false,
      message: "Preview response serialization failed.",
      requestId: clean_(base.requestId || base.debugId || adminDebugId_()),
      debugId: clean_(base.debugId || base.requestId || adminDebugId_()),
      stage: clean_(base.stage || ""),
      messageType: clean_(base.messageType || ""),
      count: 0,
      elapsedMs: Number(base.elapsedMs || 0)
    });
  }
}

function stageBatchEmptyReason_(cohort) {
  var info = cohort && typeof cohort === "object" ? cohort : {};
  var totalInStage = Number(info.totalInStage || 0);
  var eligibleUnsentTotal = Number(info.eligibleUnsentTotal || 0);
  var alreadySentExcluded = Number(info.alreadySentExcluded || 0);
  var failedExcluded = Number(info.failedExcluded || 0);
  var blockedTotal = Number(info.blockedTotal || 0);
  var blockedByReason = info.blockedByReason || {};
  if (eligibleUnsentTotal > 0) return "";
  if (!clean_(info.messageType || "")) return "No batch message is supported for this stage.";
  if (totalInStage <= 0) return "No applicants are currently in this stage.";
  if (alreadySentExcluded >= totalInStage) return "Stage is populated, but all rows are already excluded by prior send state.";
  if (alreadySentExcluded + failedExcluded >= totalInStage && blockedTotal <= 0) {
    return "Stage is populated, but remaining rows are excluded by prior send state or automatic retry rules.";
  }
  var topReason = Object.keys(blockedByReason).sort(function(a, b) {
    return Number(blockedByReason[b] || 0) - Number(blockedByReason[a] || 0);
  })[0] || "";
  if (topReason) return "Stage is populated, but no send-eligible candidates remain under current rules. Primary block: " + topReason + ".";
  return "Stage is populated, but no send-eligible candidates remain under current rules.";
}

function getStageCursorKey_(stage, messageType) {
  return clean_(CONFIG.STAGE_CURSOR_PREFIX || "STAGE_CURSOR::") + clean_(stage || "") + "::" + clean_(messageType || "");
}

function getStageCursor_(stage, messageType) {
  var key = getStageCursorKey_(stage, messageType);
  var v = clean_(PropertiesService.getScriptProperties().getProperty(key) || "");
  var n = parseInt(v, 10);
  return n && n >= 2 ? n : 2;
}

function setStageCursor_(stage, messageType, row) {
  var key = getStageCursorKey_(stage, messageType);
  var n = parseInt(row, 10);
  PropertiesService.getScriptProperties().setProperty(key, String(n && n >= 2 ? n : 2));
}

function collectStageBatchCohort_(stage, limit, offset, opts) {
  var normalizedStage = normalizeStageBatchStage_(stage);
  var batchLimit = clampStageBatchLimit_(limit);
  var requestedOffset = clampStageBatchOffset_(offset);
  var options = opts && typeof opts === "object" ? opts : {};
  var messageType = normalizeApplicantMessageType_(options.messageType || getBatchMessageTypeForStage_(normalizedStage) || "");
  var actorEmail = clean_(options.actorEmail || "");
  var actorRole = clean_(options.actorRole || "");
  var debugId = clean_(options.debugId || newDebugId_());
  var requestId = clean_(options.requestId || debugId || newDebugId_());
  var inviteStatefulFlow = normalizedStage === "INVITE_PENDING" || messageType === "legacy_invite";
  var phaseTimings = options.phaseTimings && typeof options.phaseTimings === "object" ? options.phaseTimings : {};
  phaseTimings.candidateSelectionMs = Number(phaseTimings.candidateSelectionMs || 0);
  phaseTimings.eligibilityFilteringMs = Number(phaseTimings.eligibilityFilteringMs || 0);
  phaseTimings.rowHydrationMs = Number(phaseTimings.rowHydrationMs || 0);
  phaseTimings.resolutionMs = Number(phaseTimings.resolutionMs || 0);
  phaseTimings.payloadAssemblyMs = Number(phaseTimings.payloadAssemblyMs || 0);
  var sh = openDataSheet_();
  var values = sh.getDataRange().getValues();
  var headers = (values && values.length) ? values[0] : [];
  var totalInStage = 0;
  var eligibleUnsentTotal = 0;
  var alreadySentExcluded = 0;
  var failedExcluded = 0;
  var blockedTotal = 0;
  var blockedByReason = {};
  var blockedApplicantIdsSample = [];
  var candidates = [];
  var startedAtMs = new Date().getTime();
  var portalSecretLookup = options.portalSecretLookup && typeof options.portalSecretLookup === "object" ? options.portalSecretLookup : null;
  var cooldownLookup = options.cooldownLookup && typeof options.cooldownLookup === "object" ? options.cooldownLookup : null;
  var previewEarlyStop = options.previewEarlyStop === true;
  var previewEligibleBuffer = Math.max(0, Math.min(10, Math.floor(Number(options.previewEligibleBuffer || 2))));
  var previewEligibleTarget = previewEarlyStop ? Math.max(batchLimit, batchLimit + previewEligibleBuffer) : 0;
  var deterministicPreview = options.deterministicPreview === true;
  var eligibleCountBounded = false;
  var lastRow = values.length;
  var savedCursor = Math.max(2, getStageCursor_(normalizedStage, messageType));
  var cursor = savedCursor > lastRow ? 2 : savedCursor;
  var nextCursor = cursor;
  var scanned = 0;
  var scanStartRow = cursor;
  var scanEndRow = 0;
  var previewScanCap = deterministicPreview ? Math.max(1, Math.floor(Number(CONFIG.BATCH_PREVIEW_SCAN_ROW_CAP || 500))) : 0;
  var windowsScanned = 0;
  var fallbackContinuationUsed = false;
  var scanStoppedBySafetyCap = false;
  var scanWrapped = false;
  var maxRowsToScan = deterministicPreview ? Math.max(0, lastRow - 1) : 0;
  var rowsVisited = 0;
  var timeBudgetMs = Math.max(1, Number(CONFIG.SCAN_TIME_BUDGET_MS || 240000));
  var scanStoppedByTimeBudget = false;
  var scanStoppedByCap = false;
  if (!headers.length || values.length < 2 || !normalizedStage) {
    var emptyCohort = {
      stage: normalizedStage,
      messageType: messageType,
      requestId: requestId,
      limit: batchLimit,
      requestedOffset: requestedOffset,
      offset: 0,
      offsetApplied: false,
      offsetIgnored: requestedOffset > 0,
      offsetMode: "PRODUCTION_STATEFUL",
      totalInStage: 0,
      eligibleUnsentTotal: 0,
      alreadySentExcluded: 0,
      failedExcluded: 0,
      blockedTotal: 0,
      blockedByReason: {},
      blockedApplicantIdsSample: [],
      candidates: [],
      elapsedMs: new Date().getTime() - startedAtMs,
      phaseTimings: phaseTimings
    };
    emptyCohort.emptyReason = stageBatchEmptyReason_(emptyCohort);
    return emptyCohort;
  }
  var windowStartIndex = cursor - 1;
  while (windowStartIndex >= 1 && windowStartIndex < values.length) {
    windowsScanned++;
    if (windowsScanned > 1) fallbackContinuationUsed = true;
    var windowRowsScanned = 0;
    var windowEndIndex = scanWrapped ? Math.min(values.length, cursor - 1) : values.length;
    var r = windowStartIndex;
    for (; r < windowEndIndex; r++) {
      if (deterministicPreview && previewScanCap > 0 && windowRowsScanned >= previewScanCap) {
        scanStoppedByCap = true;
        break;
      }
      if (deterministicPreview && rowsVisited >= maxRowsToScan) {
        scanStoppedBySafetyCap = true;
        break;
      }
      if (new Date().getTime() - startedAtMs > timeBudgetMs) {
        scanStoppedByTimeBudget = true;
        Logger.log("AUTO_STAGE_RUN_TIMEOUT_NEAR");
        break;
      }
      var hydrateStartedAtMs = new Date().getTime();
      var row = values[r] || [];
      var rowObj = {};
      for (var c = 0; c < headers.length; c++) {
        var h = clean_(headers[c]);
        if (h) rowObj[h] = row[c];
      }
      phaseTimings.rowHydrationMs += new Date().getTime() - hydrateStartedAtMs;
      scanned++;
      rowsVisited++;
      windowRowsScanned++;
      scanEndRow = r + 1;
      nextCursor = r + 2;
      var applicantId = clean_(rowObj.ApplicantID || "");
      if (!applicantId) continue;
      var candidateStartedAtMs = new Date().getTime();
      var snapshot = stageAggregationSnapshot_(rowObj);
      phaseTimings.candidateSelectionMs += new Date().getTime() - candidateStartedAtMs;
      if (clean_(snapshot.stage || "").toUpperCase() !== normalizedStage) continue;
      totalInStage++;
      var filterStartedAtMs = new Date().getTime();
      if (!messageType) {
        phaseTimings.eligibilityFilteringMs += new Date().getTime() - filterStartedAtMs;
        continue;
      }
      if (stageBatchShouldExcludePriorSuccessDefault_(rowObj, normalizedStage, messageType)) {
        alreadySentExcluded++;
        phaseTimings.eligibilityFilteringMs += new Date().getTime() - filterStartedAtMs;
        continue;
      }
      if (inviteStatefulFlow && stageBatchShouldExcludeFailedDefault_(rowObj, messageType)) {
        failedExcluded++;
        phaseTimings.eligibilityFilteringMs += new Date().getTime() - filterStartedAtMs;
        continue;
      }
      phaseTimings.eligibilityFilteringMs += new Date().getTime() - filterStartedAtMs;
      var resolved = resolveApplicantMessageContextFromRow_(rowObj, r + 1, sh, messageType, {
        action: "stageBatchCollect",
        actorEmail: actorEmail,
        actorRole: actorRole,
        debugId: debugId,
        applicantId: applicantId,
        requestId: requestId,
        previewMetrics: phaseTimings,
        portalSecretLookup: portalSecretLookup,
        cooldownLookup: cooldownLookup,
        skipPortalUrlBuild: !!portalSecretLookup
      });
      if (resolved && resolved.eligible) {
        eligibleUnsentTotal++;
        if (candidates.length < batchLimit) {
          candidates.push({
            applicantId: applicantId,
            rowNumber: Number(resolved.rowNumber || (r + 1) || 0),
            effectiveEmail: clean_(resolved.effectiveEmail || ""),
            rowObj: rowObj,
            emailStatus: clean_(rowObj.Email_Status || "")
          });
        }
        if (candidates.length >= batchLimit || (previewEligibleTarget > 0 && eligibleUnsentTotal >= previewEligibleTarget)) {
          eligibleCountBounded = true;
          nextCursor = r + 2;
          break;
        }
        continue;
      }
      blockedTotal++;
      var blockedCode = clean_(resolved && (resolved.blockCode || resolved.code || "BLOCKED"));
      var blockedReason = clean_(resolved && (resolved.blockReason || resolved.message || resolved.error || blockedCode));
      incrementStageBatchReason_(blockedByReason, blockedCode);
      pushStageBatchSample_(blockedApplicantIdsSample, applicantId);
    }
    if (!deterministicPreview) break;
    if (candidates.length > 0 || scanStoppedByTimeBudget || scanStoppedBySafetyCap) break;
    if (r < windowEndIndex) {
      windowStartIndex = r;
      continue;
    }
    if (!scanWrapped && cursor > 2) {
      scanWrapped = true;
      windowStartIndex = 1;
      continue;
    }
    break;
  }
  if (nextCursor > lastRow) nextCursor = 2;
  if (!deterministicPreview) {
    setStageCursor_(normalizedStage, messageType, nextCursor);
    Logger.log("AUTO_STAGE_CURSOR_UPDATE " + JSON.stringify({
      stage: normalizedStage,
      messageType: messageType,
      nextCursor: nextCursor,
      scanned: scanned,
      found: candidates.length,
      timeBudgetMs: timeBudgetMs,
      scanStoppedByTimeBudget: scanStoppedByTimeBudget,
      scanStoppedByCap: scanStoppedByCap,
      windowsScanned: windowsScanned,
      fallbackContinuationUsed: fallbackContinuationUsed
    }));
  }
  var partial = deterministicPreview && candidates.length < batchLimit && (scanStoppedByCap || scanStoppedBySafetyCap || scanStoppedByTimeBudget || nextCursor > lastRow || candidates.length > 0);
  var partialReason = "";
  if (partial) {
    if (scanStoppedByTimeBudget) partialReason = "PREVIEW_TIME_BUDGET_EXHAUSTED";
    else if (scanStoppedBySafetyCap) partialReason = "PREVIEW_SAFETY_CAP_REACHED";
    else if (candidates.length > 0) partialReason = "PREVIEW_CANDIDATES_FOUND_BELOW_LIMIT";
    else partialReason = "PREVIEW_WINDOW_EXHAUSTED";
  }
  var cohort = {
    stage: normalizedStage,
    messageType: messageType,
    requestId: requestId,
    limit: batchLimit,
    requestedOffset: requestedOffset,
    offset: 0,
    offsetApplied: false,
    offsetIgnored: requestedOffset > 0,
    offsetMode: "PRODUCTION_STATEFUL",
    totalInStage: totalInStage,
    eligibleUnsentTotal: eligibleUnsentTotal,
    alreadySentExcluded: alreadySentExcluded,
    failedExcluded: failedExcluded,
    blockedTotal: blockedTotal,
    blockedByReason: blockedByReason,
    blockedApplicantIdsSample: blockedApplicantIdsSample,
    candidates: candidates,
    eligibleCountBounded: eligibleCountBounded,
    scanCursor: cursor,
    firstScannedRow: scanStartRow,
    scanStartRow: scanStartRow,
    scanEndRow: scanEndRow,
    rowsScanned: scanned,
    scanCap: previewScanCap,
    windowsScanned: windowsScanned,
    fallbackContinuationUsed: fallbackContinuationUsed,
    nextCursor: nextCursor,
    scanned: scanned,
    scanStoppedByTimeBudget: scanStoppedByTimeBudget,
    scanStoppedByCap: scanStoppedByCap,
    scanStoppedBySafetyCap: scanStoppedBySafetyCap,
    partial: partial,
    partialReason: partialReason,
    elapsedMs: new Date().getTime() - startedAtMs,
    phaseTimings: phaseTimings
  };
  cohort.emptyReason = stageBatchEmptyReason_(cohort);
  return cohort;
}

function admin_previewStageBatch(payload) {
  return withEnvelope_("admin_previewStageBatch", function (dbgId) {
    var startedAtMs = new Date().getTime();
    var requestId = clean_(dbgId || newDebugId_());
    var stage = "";
    var messageType = "";
    var limit = 0;
    var requestedOffset = 0;
    var phaseTimings = {
      candidateSelectionMs: 0,
      eligibilityFilteringMs: 0,
      rowHydrationMs: 0,
      resolutionMs: 0,
      payloadAssemblyMs: 0
    };
    try {
      var adminEmail = getCallerEmail_();
      if (!isAdmin_(adminEmail)) throw new Error("Access denied");
      requireOperationsAdmin_(adminEmail);
      var p = payload && typeof payload === "object" ? payload : {};
      var propertyGuard = buildScriptPropertyRegressionGuard_();
      var propertyGuardWarning = "";
      var propertyGuardWarningText = "";
      if (!propertyGuard.ok) {
        if (propertyGuard.warning === "SCRIPT_PROPERTY_COUNT_GREW") {
          propertyGuardWarning = propertyGuard.warning;
          propertyGuardWarningText = "Script property count is above the cleanup baseline; batch preview is allowed, but property cleanup review is recommended.";
        } else {
        stageBatchPreviewLog_("MANUAL_BATCH_PREVIEW_BLOCKED", {
          batchId: "",
          stage: clean_(p.stage || ""),
          candidateCount: 0,
          limit: Number(p.limit || 0),
          replaySummary: {},
          blockCode: propertyGuard.warning,
          propertyGuard: propertyGuard
        });
        return stageBatchPreviewFinalizeForRpc_(stageBatchPreviewResponse_({
          ok: false,
          message: "Batch preview blocked by property regression guard.",
          blockCode: propertyGuard.warning,
          blockReason: propertyGuard.warning,
          requestId: requestId,
          debugId: dbgId,
          stage: clean_(p.stage || ""),
          count: 0,
          previewLimit: Number(p.limit || 0),
          propertyGuard: propertyGuard
        }));
        }
      }
      if (isBatchPreviewModeEnabled_() !== true) {
        stageBatchPreviewLog_("MANUAL_BATCH_PREVIEW_BLOCKED", {
          batchId: "",
          stage: clean_(p.stage || ""),
          candidateCount: 0,
          limit: Number(p.limit || 0),
          replaySummary: {},
          blockCode: "BATCH_PREVIEW_MODE_DISABLED"
        });
        return stageBatchPreviewFinalizeForRpc_(stageBatchPreviewResponse_({
          ok: false,
          message: "Batch preview mode is disabled.",
          blockCode: "BATCH_PREVIEW_MODE_DISABLED",
          blockReason: "Batch preview mode is disabled.",
          requestId: requestId,
          debugId: dbgId,
          stage: clean_(p.stage || ""),
          count: 0,
          previewLimit: Number(p.limit || 0)
        }));
      }
      var actor = resolveAdminCommActor_(p);
      stage = normalizeStageBatchStage_(p.stage || "");
      var limitMeta = stageBatchLimitMeta_(p.limit);
      limit = limitMeta.effective;
      requestedOffset = clampStageBatchOffset_(p.offset);
      messageType = getBatchMessageTypeForStage_(stage);
      stageBatchPreviewLog_("MANUAL_BATCH_PREVIEW_BEGIN", {
        batchId: "",
        stage: stage,
        candidateCount: 0,
        limit: limit,
        replaySummary: {}
      });
      if (!stage) {
        var invalidOut = stageBatchPreviewResponse_({
          ok: false,
          message: "Unsupported stage for batch preview.",
          requestId: requestId,
          debugId: dbgId,
          stage: stage,
          messageType: messageType,
          count: 0,
          previewLimit: limit,
          requestedOffset: requestedOffset,
          offsetIgnored: requestedOffset > 0,
          elapsedMs: new Date().getTime() - startedAtMs,
          phaseTimings: phaseTimings
        });
        return typeof previewRpcTerminalSummary_ === "function" ? previewRpcTerminalSummary_(stageBatchPreviewFinalizeForRpc_(invalidOut)) : stageBatchPreviewFinalizeForRpc_(invalidOut);
      }
      var sendable = !!messageType;
      var priority = mapStagePriority_(stage);
      var previewPortalSecretLookup = null;
      if (sendable && typeof communicationRequiresPortalUrl_ === "function" && communicationRequiresPortalUrl_(messageType) && typeof buildPortalSecretPreviewLookup_ === "function") {
        previewPortalSecretLookup = buildPortalSecretPreviewLookup_();
      }
      var previewCooldownLookup = null;
      if (sendable && typeof buildCommunicationCooldownPreviewLookup_ === "function") {
        previewCooldownLookup = buildCommunicationCooldownPreviewLookup_(messageType);
      }
      var cohort = collectStageBatchCohort_(stage, limit, requestedOffset, {
        messageType: messageType,
        actorEmail: actor.actorEmail,
        actorRole: actor.actorRole,
        debugId: dbgId,
        requestId: requestId,
        phaseTimings: phaseTimings,
        portalSecretLookup: previewPortalSecretLookup && previewPortalSecretLookup.ok ? previewPortalSecretLookup : null,
        cooldownLookup: previewCooldownLookup && previewCooldownLookup.ok ? previewCooldownLookup : null,
        previewEarlyStop: true,
        previewEligibleBuffer: 2,
        deterministicPreview: true
      });
      var candidateIds = stageBatchCandidateIds_(cohort);
      var candidateCount = candidateIds.length;
      var candidateHash = stageBatchCandidateHash_(candidateIds);
      var batchId = ["BATCH_PREVIEW", stage, messageType, String(limit), candidateHash].join("::");
      var idempotencySummary = buildBatchPreviewIdempotencySummary_(cohort, messageType, batchId);
      var writtenAt = new Date().toISOString();
      var assemblyStartedAtMs = new Date().getTime();
      var emptyReason = clean_(cohort.emptyReason || "");
      var previewWarnings = [];
      if (limitMeta.warning) previewWarnings.push(limitMeta.warning);
      if (propertyGuardWarningText) previewWarnings.push(propertyGuardWarningText);
      var out = stageBatchPreviewResponse_({
        ok: true,
        message: emptyReason || (previewWarnings.length ? ("Preview ready. " + previewWarnings.join(" ")) : "Preview ready."),
        warning: previewWarnings.length ? previewWarnings[0] : "",
        warnings: previewWarnings,
        stage: stage,
        priority: priority,
        batchId: batchId,
        requestId: requestId,
        debugId: dbgId,
        messageType: messageType,
        sendable: sendable,
        sendDisabledReason: sendable ? "" : "No batch message is supported for this stage.",
        totalInStage: Number(cohort.totalInStage || 0),
        eligibleUnsentFound: Number(cohort.eligibleUnsentTotal || 0),
        previewLimit: Number(cohort.limit || limit),
        processedCount: 0,
        remainingEligibleEstimate: Math.max(0, Number(cohort.eligibleUnsentTotal || 0) - Number((cohort.candidates || []).length || 0)),
        requestedOffset: requestedOffset,
        offset: Number(cohort.offset || 0),
        offsetApplied: cohort.offsetApplied === true,
        offsetIgnored: cohort.offsetIgnored === true,
        offsetMode: clean_(cohort.offsetMode || "PRODUCTION_STATEFUL"),
        writtenAt: writtenAt,
        candidateIds: candidateIds,
        candidateCount: candidateCount,
        candidateHash: candidateHash,
        firstScannedRow: Number(cohort.firstScannedRow || cohort.scanStartRow || 0),
        scanStartRow: Number(cohort.scanStartRow || 0),
        scanEndRow: Number(cohort.scanEndRow || 0),
        rowsScanned: Number(cohort.rowsScanned || cohort.scanned || 0),
        scanCap: Number(cohort.scanCap || 0),
        windowsScanned: Number(cohort.windowsScanned || 0),
        fallbackContinuationUsed: cohort.fallbackContinuationUsed === true,
        requestedLimit: limit,
        partial: cohort.partial === true,
        partialReason: clean_(cohort.partialReason || ""),
        limit: Number(cohort.limit || limit),
        idempotencySummary: idempotencySummary,
        alreadyProcessedCount: Number(idempotencySummary.alreadyProcessedCount || 0),
        count: Number((cohort.candidates || []).length || 0),
        eligible: Number((cohort.candidates || []).length || 0),
        blocked: Number(cohort.blockedTotal || 0),
        alreadySentExcluded: Number(cohort.alreadySentExcluded || 0),
        failedExcluded: Number(cohort.failedExcluded || 0),
        blockedByReason: cohort.blockedByReason || {},
        eligibleApplicantIdsSample: [],
        blockedApplicantIdsSample: Array.isArray(cohort.blockedApplicantIdsSample) ? cohort.blockedApplicantIdsSample.slice(0, 10) : [],
        propertyGuard: propertyGuard,
        emptyReason: emptyReason,
        eligibleCountBounded: cohort.eligibleCountBounded === true,
        elapsedMs: Number(cohort.elapsedMs || 0),
        phaseTimings: cohort.phaseTimings || phaseTimings
      });
      (cohort.candidates || []).forEach(function (candidate) {
        pushStageBatchSample_(out.eligibleApplicantIdsSample, candidate.applicantId);
      });
      phaseTimings.payloadAssemblyMs += new Date().getTime() - assemblyStartedAtMs;
      if (!sendable || out.count <= 0) {
        clearStageBatchPreviewCache_(adminEmail);
      } else {
        writeStageBatchPreviewCache_(adminEmail, {
          stage: stage,
          limit: Number(out.previewLimit || limit),
          offset: requestedOffset,
          messageType: messageType,
          eligible: Number(out.count || 0),
          eligibleUnsentFound: Number(out.eligibleUnsentFound || 0),
          debugId: dbgId,
          requestId: requestId,
          writtenAt: writtenAt,
          candidateIds: candidateIds,
          candidateCount: candidateCount,
          candidateHash: candidateHash,
          batchId: batchId,
          idempotencySummary: idempotencySummary
        });
      }
      out.elapsedMs = Math.max(Number(out.elapsedMs || 0), new Date().getTime() - startedAtMs);
      out.phaseTimings = phaseTimings;
      out.message = out.count > 0
        ? (cohort.partial === true && clean_(cohort.partialReason || "") === "PREVIEW_CANDIDATES_FOUND_BELOW_LIMIT"
          ? "Partial preview ready. Candidates found below requested limit."
          : (cohort.partial === true
          ? "Partial preview ready. Scan window exhausted before requested limit."
          : (cohort.eligibleCountBounded === true
          ? "Preview ready. Eligible unsent count shown is bounded to the preview window, not a full-stage total."
          : "Preview ready.")))
        : (out.emptyReason || "No eligible unsent invite candidates found under current rules.");
      stageBatchPreviewLog_("MANUAL_BATCH_PREVIEW_RESULT", {
        batchId: batchId,
        stage: stage,
        candidateCount: candidateCount,
        limit: limit,
        replaySummary: idempotencySummary,
        blockedCount: Number(out.blocked || 0),
        alreadyProcessedCount: Number(idempotencySummary.alreadyProcessedCount || 0),
        firstScannedRow: Number(out.firstScannedRow || out.scanStartRow || 0),
        rowsScanned: Number(out.rowsScanned || 0),
        scanStartRow: Number(out.scanStartRow || 0),
        scanEndRow: Number(out.scanEndRow || 0),
        windowsScanned: Number(out.windowsScanned || 0),
        fallbackContinuationUsed: out.fallbackContinuationUsed === true,
        partial: out.partial === true,
        partialReason: clean_(out.partialReason || "")
      });
      if (Number(idempotencySummary.alreadyProcessedCount || 0) > 0) {
        stageBatchPreviewLog_("MANUAL_BATCH_PREVIEW_REPLAY", {
          batchId: batchId,
          stage: stage,
          candidateCount: candidateCount,
          limit: limit,
          replaySummary: idempotencySummary
        });
      }
      return typeof previewRpcTerminalSummary_ === "function" ? previewRpcTerminalSummary_(stageBatchPreviewFinalizeForRpc_(out)) : stageBatchPreviewFinalizeForRpc_(out);
    } catch (e) {
      var errorOut = stageBatchPreviewResponse_({
        ok: false,
        message: String(e && e.message ? e.message : e || "Preview failed."),
        requestId: requestId,
        debugId: dbgId,
        stage: stage,
        messageType: messageType,
        count: 0,
        previewLimit: limit,
        requestedOffset: requestedOffset,
        offsetIgnored: requestedOffset > 0,
        elapsedMs: new Date().getTime() - startedAtMs,
        phaseTimings: phaseTimings,
        blockCode: "PREVIEW_BACKEND_ERROR",
        blockReason: "PREVIEW_BACKEND_ERROR",
        error: String(e && e.message ? e.message : e || "Preview failed.")
      });
      return typeof previewRpcTerminalSummary_ === "function" ? previewRpcTerminalSummary_(stageBatchPreviewFinalizeForRpc_(errorOut)) : stageBatchPreviewFinalizeForRpc_(errorOut);
    }
  });
}

function admin_sendStageBatch(payload) {
  return withEnvelope_("admin_sendStageBatch", function (dbgId) {
    var requestId = clean_(dbgId || newDebugId_());
    var adminEmail = getCallerEmail_();
    var stage = "";
    var messageType = "";
    try {
      if (!isAdmin_(adminEmail)) throw new Error("Access denied");
      requireOperationsAdmin_(adminEmail);
      var p = payload && typeof payload === "object" ? payload : {};
      if (isBatchSendEnabled_() !== true) {
        var blockCode = "BATCH_SENDS_DISABLED_PREVIEW_ONLY_MODE";
        if (isSystemStabilizationModeActive_()) logOperationalBlock_("SYSTEM_STABILIZATION_MODE_ACTIVE", {
          action: "send_stage_batch",
          requestId: requestId,
          actorEmail: clean_(adminEmail || "")
        });
        logOperationalBlock_("EMAIL_SEND_BLOCKED", {
          action: "send_stage_batch",
          blockCode: blockCode,
          requestId: requestId,
          actorEmail: clean_(adminEmail || "")
        });
        return adminCommBlockedResult_("send_stage_batch", blockCode, requestId, {
          blockReason: "Batch sends are disabled in preview-only mode."
        });
      }
      var actor = resolveAdminCommActor_(p);
      stage = normalizeStageBatchStage_(p.stage || "");
      var limitMeta = stageBatchLimitMeta_(p.limit);
      var limit = limitMeta.effective;
      var requestedOffset = clampStageBatchOffset_(p.offset);
      var previewRequestId = clean_(p.previewRequestId || "");
      var requestCandidateHash = clean_(p.candidateHash || "");
      if (p.confirmSend !== true) {
        return adminCommBlockedResult_("send_stage_batch", "CONFIRM_REQUIRED", requestId, {
          blockReason: "Explicit confirmation is required before batch send.",
          limit: limit,
          offset: requestedOffset
        });
      }
      if (!stage) {
        return adminCommBlockedResult_("send_stage_batch", "UNSUPPORTED_STAGE", requestId, {
          blockReason: "Unsupported stage for batch send.",
          limit: limit,
          offset: requestedOffset
        });
      }
      messageType = getBatchMessageTypeForStage_(stage);
      if (!messageType) {
        return adminCommBlockedResult_("send_stage_batch", "STAGE_NOT_SENDABLE", requestId, {
          blockReason: "No batch message is supported for this stage.",
          limit: limit,
          offset: requestedOffset
        });
      }
      var previewGate = readStageBatchPreviewCache_(adminEmail);
      var cachedStage = clean_(previewGate && previewGate.stage || "").toUpperCase();
      var cachedMessageType = clean_(previewGate && previewGate.messageType || "");
      var cachedRequestId = clean_(previewGate && previewGate.requestId || "");
      var cachedOffset = Number(previewGate && previewGate.offset || 0);
      var cachedLimit = Number(previewGate && previewGate.limit || 0);
      var cachedCandidateCount = Number(previewGate && previewGate.candidateCount || 0);
      var cachedEligibleUnsentFound = Number(previewGate && previewGate.eligibleUnsentFound || 0);
      var cachedCandidateIdsSample = Array.isArray(previewGate && previewGate.candidateIds)
        ? previewGate.candidateIds.map(function (id) { return clean_(id || ""); }).filter(function (id) { return !!id; }).slice(0, 5)
        : [];
      var previewWrittenAt = clean_(previewGate && previewGate.writtenAt || "");
      var previewAgeSeconds = stageBatchPreviewAgeSeconds_(previewWrittenAt);
      var previewFreshnessWindowSeconds = stageBatchPreviewCacheTtlSeconds_();
      stageBatchLogSummary_("STAGE_SEND_PREVIEW_PARITY_BEGIN", {
        requestId: requestId,
        previewRequestId: previewRequestId,
        stage: stage,
        messageType: messageType,
        limit: limit,
        offset: requestedOffset,
        candidateCount: cachedCandidateCount,
        candidateHash: clean_(previewGate && previewGate.candidateHash || ""),
        previewAgeSeconds: previewAgeSeconds,
        previewFreshnessWindowSeconds: previewFreshnessWindowSeconds
      });
      var previewCandidateIds = Array.isArray(previewGate && previewGate.candidateIds) ? previewGate.candidateIds.map(function (id) {
        return clean_(id || "");
      }).filter(function (id) {
        return !!id;
      }) : [];
      var previewCandidateCount = Number(previewGate && previewGate.candidateCount != null ? previewGate.candidateCount : previewCandidateIds.length);
      var previewCandidateHash = clean_(previewGate && previewGate.candidateHash || "");
      var cachedCandidateHashPresent = !!previewCandidateHash;
      var payloadCandidateHashPresent = !!requestCandidateHash;
      var computedCandidateHash = stageBatchCandidateHash_(previewCandidateIds);
      var cacheHashMatchesCandidateIds = !cachedCandidateHashPresent || previewCandidateHash === computedCandidateHash;
      var payloadHashMatchesCache = !cachedCandidateHashPresent || requestCandidateHash === previewCandidateHash;
      function buildPreviewParityDecision_(rejectionSubtype, blockCode, blockReason) {
        return {
          blockCode: clean_(blockCode || "PREVIEW_STALE"),
          blockReason: clean_(blockReason || "A matching preview snapshot is required before send."),
          rejectionSubtype: clean_(rejectionSubtype || "UNKNOWN"),
          snapshotExists: !!previewGate,
          previewRequestId: previewRequestId,
          cachedRequestId: cachedRequestId,
          requestedStage: stage,
          cachedStage: cachedStage,
          requestedMessageType: messageType,
          cachedMessageType: cachedMessageType,
          requestedOffset: requestedOffset,
          cachedOffset: cachedOffset,
          requestedLimit: limit,
          cachedLimit: cachedLimit,
          cachedCandidateCount: cachedCandidateCount,
          cachedCandidateIdsSample: cachedCandidateIdsSample,
          previewWrittenAt: previewWrittenAt,
          previewAgeSeconds: previewAgeSeconds,
          previewFreshnessWindowSeconds: previewFreshnessWindowSeconds,
          candidateHashPresent: cachedCandidateHashPresent,
          payloadCandidateHashPresent: payloadCandidateHashPresent,
          hashMatch: payloadHashMatchesCache,
          cacheHashMatchesCandidateIds: cacheHashMatchesCandidateIds
        };
      }
      function buildPreviewParityBlock_(rejectionSubtype) {
        switch (clean_(rejectionSubtype || "").toUpperCase()) {
          case "SNAPSHOT_MISSING":
          case "PREVIEW_REQUEST_ID_MISSING":
            return { blockCode: "PREVIEW_REQUIRED", blockReason: "Preview Cohort is required before batch send.", clearCache: false };
          case "WRITTEN_AT_MISSING":
          case "WRITTEN_AT_INVALID":
          case "PREVIEW_EXPIRED":
            return { blockCode: "PREVIEW_EXPIRED", blockReason: "Preview expired or is stale. Run Preview Cohort again before send.", clearCache: true };
          case "STAGE_MISMATCH":
          case "LIMIT_MISMATCH":
          case "OFFSET_MISMATCH":
          case "MESSAGE_TYPE_MISMATCH":
          case "REQUEST_ID_MISMATCH":
            return { blockCode: "PREVIEW_MISMATCH", blockReason: "Selected stage or preview details no longer match. Run Preview Cohort again.", clearCache: false };
          case "ELIGIBLE_ZERO":
            return { blockCode: "PREVIEW_NOT_SENDABLE", blockReason: "Preview has no mail-eligible applicants for send.", clearCache: false };
          case "CANDIDATE_IDS_MISSING":
          case "CANDIDATE_COUNT_MISMATCH":
          case "CANDIDATE_IDS_EMPTY":
          case "CANDIDATE_HASH_MISSING_CACHED":
          case "CANDIDATE_HASH_CACHE_MISMATCH":
            return { blockCode: "PREVIEW_CHANGED_RETRY", blockReason: "Preview authority is incomplete or changed. Run Preview Cohort again before send.", clearCache: true };
          case "CANDIDATE_HASH_MISSING":
          case "CANDIDATE_HASH_PAYLOAD_MISMATCH":
            return { blockCode: "PREVIEW_MISMATCH", blockReason: "Preview authority hash does not match this send request. Run Preview Cohort again.", clearCache: false };
          default:
            return { blockCode: "PREVIEW_STALE", blockReason: "A matching preview snapshot is required before send.", clearCache: false };
        }
      }
      var staleSubtype = "";
      if (!previewGate) staleSubtype = "SNAPSHOT_MISSING";
      else if (!previewRequestId) staleSubtype = "PREVIEW_REQUEST_ID_MISSING";
      else if (!previewWrittenAt) staleSubtype = "WRITTEN_AT_MISSING";
      else if (!(previewAgeSeconds >= 0)) staleSubtype = "WRITTEN_AT_INVALID";
      else if (previewAgeSeconds > previewFreshnessWindowSeconds) staleSubtype = "PREVIEW_EXPIRED";
      else if (cachedStage !== stage) staleSubtype = "STAGE_MISMATCH";
      else if (cachedLimit !== limit) staleSubtype = "LIMIT_MISMATCH";
      else if (cachedOffset !== requestedOffset) staleSubtype = "OFFSET_MISMATCH";
      else if (cachedMessageType !== messageType) staleSubtype = "MESSAGE_TYPE_MISMATCH";
      else if (cachedRequestId !== previewRequestId) staleSubtype = "REQUEST_ID_MISMATCH";
      else if (!(Number(previewGate.eligible || 0) > 0)) staleSubtype = "ELIGIBLE_ZERO";
      if (staleSubtype) {
        var previewStaleMeta = buildPreviewParityBlock_(staleSubtype);
        if (previewStaleMeta.clearCache === true) clearStageBatchPreviewCache_(adminEmail);
        var previewStaleDecision = buildPreviewParityDecision_(staleSubtype, previewStaleMeta.blockCode, previewStaleMeta.blockReason);
        stageBatchLogSummary_("STAGE_SEND_PREVIEW_PARITY_DECISION", Object.assign({
          requestId: requestId,
          decision: "REJECT"
        }, previewStaleDecision));
        stageBatchLogSummary_("STAGE_SEND_PREVIEW_PARITY_FAIL", Object.assign({
          requestId: requestId,
          reason: "PREVIEW_STALE"
        }, previewStaleDecision));
        var previewStaleResult = adminCommBlockedResult_("send_stage_batch", previewStaleDecision.blockCode, requestId, {
          blockReason: previewStaleDecision.blockReason,
          limit: limit,
          offset: requestedOffset,
          messageType: messageType
        });
        Object.keys(previewStaleDecision).forEach(function (key) {
          previewStaleResult[key] = previewStaleDecision[key];
        });
        previewStaleResult.offset = requestedOffset;
        return previewStaleResult;
      }
      var previewChangedSubtype = "";
      if (!Array.isArray(previewGate.candidateIds)) previewChangedSubtype = "CANDIDATE_IDS_MISSING";
      else if (previewCandidateCount !== previewCandidateIds.length) previewChangedSubtype = "CANDIDATE_COUNT_MISMATCH";
      else if (!previewCandidateIds.length) previewChangedSubtype = "CANDIDATE_IDS_EMPTY";
      else if (!cachedCandidateHashPresent) previewChangedSubtype = "CANDIDATE_HASH_MISSING_CACHED";
      else if (!payloadCandidateHashPresent) previewChangedSubtype = "CANDIDATE_HASH_MISSING";
      else if (!payloadHashMatchesCache) previewChangedSubtype = "CANDIDATE_HASH_PAYLOAD_MISMATCH";
      else if (!cacheHashMatchesCandidateIds) previewChangedSubtype = "CANDIDATE_HASH_CACHE_MISMATCH";
      if (previewChangedSubtype) {
        var previewChangedMeta = buildPreviewParityBlock_(previewChangedSubtype);
        if (previewChangedMeta.clearCache === true) clearStageBatchPreviewCache_(adminEmail);
        var previewChangedDecision = buildPreviewParityDecision_(previewChangedSubtype, previewChangedMeta.blockCode, previewChangedMeta.blockReason);
        stageBatchLogSummary_("STAGE_SEND_PREVIEW_PARITY_DECISION", Object.assign({
          requestId: requestId,
          decision: "REJECT"
        }, previewChangedDecision));
        stageBatchLogSummary_("STAGE_SEND_PREVIEW_PARITY_FAIL", Object.assign({
          requestId: requestId,
          reason: "PREVIEW_CHANGED_RETRY"
        }, previewChangedDecision));
        var previewChangedRetryResult = adminCommBlockedResult_("send_stage_batch", previewChangedDecision.blockCode, requestId, {
          blockReason: previewChangedDecision.blockReason,
          limit: limit,
          offset: requestedOffset,
          messageType: messageType
        });
        Object.keys(previewChangedDecision).forEach(function (key) {
          previewChangedRetryResult[key] = previewChangedDecision[key];
        });
        previewChangedRetryResult.offset = requestedOffset;
        return previewChangedRetryResult;
      }
      stageBatchLogSummary_("STAGE_SEND_PREVIEW_PARITY_DECISION", {
        requestId: requestId,
        decision: "MATCH",
        blockCode: "",
        blockReason: "",
        rejectionSubtype: "",
        snapshotExists: true,
        previewRequestId: previewRequestId,
        cachedRequestId: cachedRequestId,
        requestedStage: stage,
        cachedStage: cachedStage,
        requestedMessageType: messageType,
        cachedMessageType: cachedMessageType,
        requestedOffset: requestedOffset,
        cachedOffset: cachedOffset,
        requestedLimit: limit,
        cachedLimit: cachedLimit,
        cachedCandidateCount: cachedCandidateCount,
        cachedCandidateIdsSample: cachedCandidateIdsSample,
        previewWrittenAt: previewWrittenAt,
        previewAgeSeconds: previewAgeSeconds,
        previewFreshnessWindowSeconds: previewFreshnessWindowSeconds,
        candidateHashPresent: cachedCandidateHashPresent,
        payloadCandidateHashPresent: payloadCandidateHashPresent,
        hashMatch: payloadHashMatchesCache,
        cacheHashMatchesCandidateIds: cacheHashMatchesCandidateIds
      });
      stageBatchLogSummary_("STAGE_SEND_PREVIEW_PARITY_MATCH", {
        requestId: requestId,
        previewRequestId: previewRequestId,
        stage: stage,
        messageType: messageType,
        limit: limit,
        offset: requestedOffset,
        candidateCount: previewCandidateCount,
        candidateHash: previewCandidateHash,
        previewAgeSeconds: previewAgeSeconds,
        previewFreshnessWindowSeconds: previewFreshnessWindowSeconds
      });
      stageBatchLogSummary_("STAGE_SEND_START", {
        requestId: requestId,
        stage: stage,
        messageType: messageType
      });
      var priority = mapStagePriority_(stage);
      stageBatchLogSummary_("STAGE_SEND_COHORT_READY", {
        requestId: requestId,
        stage: stage,
        messageType: messageType,
        total: previewCandidateIds.length
      });
      var out = {
        ok: true,
        stage: stage,
        priority: priority,
        messageType: messageType,
        sendable: true,
        requestId: requestId,
        totalInStageAtSend: 0,
        eligibleUnsentFoundAtSend: previewCandidateIds.length,
        sendLimit: limit,
        warning: limitMeta.warning,
        warnings: limitMeta.warning ? [limitMeta.warning] : [],
        requestedOffset: requestedOffset,
        offset: requestedOffset,
        offsetApplied: false,
        offsetIgnored: requestedOffset > 0,
        offsetMode: "PRODUCTION_STATEFUL",
        alreadySentExcluded: 0,
        failedExcluded: 0,
        attempted: 0,
        sent: 0,
        blocked: 0,
        failed: 0,
        blockedByReason: {},
        sentApplicantIdsSample: [],
        processedCount: 0,
        remainingEligibleEstimate: 0
      };
      var batchLabel = "STAGE_SEND::" + stage + "::" + requestId;
      previewCandidateIds.forEach(function (applicantId, index) {
        out.attempted++;
        stageBatchLogSummary_("STAGE_SEND_CANDIDATE_BEGIN", {
          requestId: requestId,
          applicantId: applicantId,
          stage: stage,
          messageType: messageType,
          index: index + 1,
          total: previewCandidateIds.length
        });
        var sendResult = sendApplicantMessage_(applicantId, messageType, {
          actorEmail: actor.actorEmail,
          actorRole: actor.actorRole,
          batchLabel: batchLabel,
          debugId: requestId,
          sendSource: "ADMIN_STAGE_BATCH",
          unattended: false
        });
        stageBatchLogSummary_("STAGE_SEND_CANDIDATE_END", {
          requestId: requestId,
          applicantId: applicantId,
          stage: stage,
          messageType: messageType,
          index: index + 1,
          total: previewCandidateIds.length,
          result: clean_(sendResult && sendResult.result || "")
        });
        var resultType = clean_(sendResult && sendResult.result || "").toUpperCase();
        if (resultType === "SENT") {
          out.sent++;
          pushStageBatchSample_(out.sentApplicantIdsSample, applicantId);
        } else if (resultType === "BLOCKED") {
          out.blocked++;
          incrementStageBatchReason_(out.blockedByReason, sendResult && (sendResult.blockCode || sendResult.code || "BLOCKED"));
        } else {
          out.failed++;
        }
      });
      clearStageBatchPreviewCache_(adminEmail);
      stageBatchLogSummary_("STAGE_BATCH_SEND_SUMMARY", {
        debugId: requestId,
        requestId: requestId,
        stage: stage,
        batchSizeRequested: limit,
        requestedOffset: requestedOffset,
        offsetIgnored: out.offsetIgnored === true,
        totalEligibleUnsentRowsFound: out.eligibleUnsentFoundAtSend,
        rowsAttempted: out.attempted,
        rowsSent: out.sent,
        rowsBlocked: out.blocked,
        rowsFailed: out.failed,
        alreadySentExcluded: out.alreadySentExcluded,
        failedExcluded: out.failedExcluded,
        blockedByReason: out.blockedByReason
      });
      out.processedCount = Number(out.attempted || 0);
      out.remainingEligibleEstimate = Math.max(0, cachedEligibleUnsentFound - out.processedCount);
      out.message = out.remainingEligibleEstimate > 0
        ? "Batch completed safely. Re-run to continue remaining records."
        : "Batch completed safely.";
      if (limitMeta.warning) out.message += " " + limitMeta.warning;
      stageBatchLogSummary_("STAGE_SEND_COMPLETE", {
        requestId: requestId,
        stage: stage,
        messageType: messageType,
        index: Number(out.attempted || 0),
        total: previewCandidateIds.length,
        sent: Number(out.sent || 0),
        blocked: Number(out.blocked || 0),
        failed: Number(out.failed || 0)
      });
      return out;
    } catch (e) {
      stageBatchLogSummary_("STAGE_SEND_FAIL", {
        requestId: requestId,
        applicantId: "",
        stage: stage,
        messageType: messageType,
        index: 0,
        total: 0,
        error: String(e && e.message ? e.message : e || "Stage batch send failed.")
      });
      throw e;
    }
  });
}
function admin_previewApplicantMessage(payload) {
  return withEnvelope_("admin_previewApplicantMessage", function (dbgId) {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    var p = payload && typeof payload === "object" ? payload : {};
    var applicantId = clean_(p.applicantId || "");
    var requestedType = clean_(p.messageType || "");
    var messageType = normalizeApplicantMessageType_(requestedType);
    var actor = resolveAdminCommActor_(p);
    if (!applicantId) return adminCommBlockedResult_("preview", "MISSING_APPLICANT_ID", dbgId, { blockReason: "Applicant ID is required." });
    if (!messageType) {
      return adminCommBlockedResult_("preview", "UNSUPPORTED_MESSAGE_TYPE", dbgId, {
        applicantId: applicantId,
        messageType: requestedType,
        blockReason: "Unsupported message type."
      });
    }
    var previewOptions = {
      actorEmail: actor.actorEmail,
      actorRole: actor.actorRole,
      batchLabel: clean_(p.batchLabel || ""),
      debugId: clean_(p.debugId || dbgId),
      editedRecipient: clean_(p.recipient || "")
    };
    if (Object.prototype.hasOwnProperty.call(p, "subject")) previewOptions.editedSubject = String(p.subject || "");
    if (Object.prototype.hasOwnProperty.call(p, "body")) previewOptions.editedBody = String(p.body || "");
    return previewApplicantMessage_(applicantId, messageType, previewOptions);
  });
}

function admin_sendApplicantMessage(payload) {
  return withEnvelope_("admin_sendApplicantMessage", function (dbgId) {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    requireOperationsAdmin_(adminEmail);
    var p = payload && typeof payload === "object" ? payload : {};
    if (getAdminRole_(adminEmail) === "OPERATIONS") {
      p.sourceSurface = "ops";
      p.sourceView = clean_(p.sourceView || "admin");
    }
    var applicantId = clean_(p.applicantId || "");
    var requestedType = clean_(p.messageType || "");
    var messageType = normalizeApplicantMessageType_(requestedType);
    var actor = resolveAdminCommActor_(p);
    if (Array.isArray(p.applicantIds) || Array.isArray(p.recipients) || Array.isArray(p.messages)) {
      return adminCommBlockedResult_("send", "BULK_NOT_ALLOWED", dbgId, {
        blockReason: "Manual single-send probe accepts one applicant only."
      });
    }
    if (p.confirmManualSingleSend !== true) {
      return adminCommBlockedResult_("send", "CONFIRM_REQUIRED", dbgId, {
        applicantId: applicantId,
        messageType: requestedType,
        blockReason: "Preview and explicit manual single-send confirmation are required."
      });
    }
    if (!applicantId) return adminCommBlockedResult_("send", "MISSING_APPLICANT_ID", dbgId, { blockReason: "Applicant ID is required." });
    if (!messageType) {
      return adminCommBlockedResult_("send", "UNSUPPORTED_MESSAGE_TYPE", dbgId, {
        applicantId: applicantId,
        messageType: requestedType,
        blockReason: "Unsupported message type."
      });
    }
    var opsGate = runOpsSafeModeGate_("applicant_email_send", {
      payload: p,
      adminEmail: adminEmail,
      applicantId: applicantId,
      debugId: dbgId
    });
    if (opsGate && opsGate.ok !== true) {
      return adminCommBlockedResult_("send", safeStr_(opsGate.blockCode || "OPS_SAFE_MODE_ACTION_BLOCKED"), dbgId, {
        applicantId: applicantId,
        messageType: requestedType,
        blockReason: safeStr_(opsGate.blockReason || "Ops Safe Mode blocked this action."),
        safeMode: opsGate.safeMode === true,
        diagnosticsLabel: safeStr_(opsGate.diagnosticsLabel || "OPS_SAFE_MODE_ACTION_BLOCKED")
      });
    }
    var opsRecipientOverride = opsGate && opsGate.safeMode === true
      ? clean_(CONFIG.OPS_SAFE_MODE_TEST_RECIPIENT_OVERRIDE || "")
      : "";
    var sendOptions = {
      actorEmail: actor.actorEmail,
      actorRole: actor.actorRole,
      batchLabel: clean_(p.batchLabel || ""),
      debugId: clean_(p.debugId || dbgId),
      manualSingleSendProbe: true,
      editedRecipient: opsRecipientOverride || clean_(p.recipient || "")
    };
    if (Object.prototype.hasOwnProperty.call(p, "subject")) sendOptions.editedSubject = String(p.subject || "");
    if (Object.prototype.hasOwnProperty.call(p, "body")) sendOptions.editedBody = String(p.body || "");
    var sendResult = sendApplicantMessage_(applicantId, messageType, sendOptions);
    if (opsGate && opsGate.safeMode === true) {
      logOpsSafeModeEvent_(String(sendResult && sendResult.result || "").toUpperCase() === "SENT"
        ? "OPS_SAFE_MODE_ACTION_COMPLETED"
        : "OPS_SAFE_MODE_ACTION_FAILED", {
        actionType: "applicant_email_send",
        operator: adminEmail,
        applicantId: applicantId,
        debugId: dbgId,
        recipientOverride: opsRecipientOverride,
        overrideApplied: !!opsRecipientOverride,
        result: clean_(sendResult && sendResult.result || "")
      });
    }
    return sendResult;
  });
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
  var paymentVerified = derivePaymentBadge_(rowObj) === "Verified";
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












