/************************************************************
FODE ADMISSIONS ?????????????????????????????????????? STAGING SCRIPT (PORTAL + DRIVE UPLOADS + ALLOWLIST)

Fixes included:
1) Student portal shows ONLY allowlisted fields (no CRM/IDs/logs/tokens)
2) Portal POST blank-screen fix: hardcode WEBAPP_URL for <form action=...>
3) doGet accepts email param aliases: email= OR Parent_Email=
4) Portal updates DO NOT overwrite Parent_Email (prevents lookup breaking)
   - saves to Parent_Email_Corrected instead
5) Drive uploads from portal replace the *_File URL and append File_Log
6) Portal locks when Payment_Verified == "Yes"
7) Subjects always prefill correctly (JSON / map style / CSV) + display nicely

Sheet:
- Spreadsheet: CONFIG.SHEET_ID
- Data sheet: CONFIG.DATA_SHEET
- Log sheet:  CONFIG.LOG_SHEET
************************************************************/


var PORTAL_SECRETS_SPREADSHEET_ID = "1HEJPtSov-iE5YTpSWWZ89YLIQAw4Eju9DDMG46HkTRc";
var PORTAL_SECRETS_TAB = "PortalSecrets";
var STUDENT_EXEC_BASE = "https://script.google.com/macros/s/AKfycbx2ve4bfCEofF_pJnra-UR02BaoumJaUeDS19Amftm2con2e7ggblMfHRzcn6fYAC4g";
var AUTHORITATIVE_DOWNSTREAM_DEPLOYMENT_ID = "AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ";

/******************** ENTRYPOINT: POST ********************/
function doPost(e) {
  var reqId = makeReqId_();
  var params = (e && e.parameter && typeof e.parameter === "object") ? e.parameter : {};
  var postView = clean_(typeof getParam_ === "function" ? getParam_(e, "view") : (params.view || "")).toLowerCase();
  if (postView === "portalupload") {
    return doPost_portalUpload_(e);
  }
  var paramKeys = Object.keys(params);
  var rawPostData = (e && e.postData) ? e.postData : null;
  var postType = clean_(rawPostData && (rawPostData.type || rawPostData.contentType) || "");
  var postLen = rawPostData && rawPostData.contents ? String(rawPostData.contents).length : 0;
  var payload;
  try {
    payload = parseRequestPayload_(e);
  } catch (err) {
    var dbgFromParams = clean_(params.dbg || "") === "1";
    logPortalPostEvent_("PORTAL_POST_START", {
      reqId: reqId,
      keys: paramKeys,
      view: clean_(params.view || ""),
      action: clean_(params.action || params._action || params.route || ""),
      id: clean_(params.id || params.ApplicantID || ""),
      s: redactToken_(params.s || params.secret || ""),
      postDataType: postType,
      postDataLength: postLen,
      parseError: String(err && err.message ? err.message : err)
    });
    var dbgBadPayload = newDebugId_();
    var badPayloadResult = {
      ok: false,
      debugId: dbgBadPayload,
      applicantId: "",
      error: { message: "Invalid request payload.", code: "BAD_PAYLOAD" }
    };
    var badPayloadRedirect = buildPortalRedirectUrl_("", "", { error: true, dbg: dbgBadPayload });
    logPortalPostEvent_("PORTAL_POST_REDIRECT", {
      reqId: reqId,
      redirectUrl: badPayloadRedirect,
      id: "",
      s: "",
      saved: false
    });
    return returnPortalRedirectOutput_(badPayloadRedirect, {
      debug: CONFIG.DEBUG_PORTAL_SHOW_ON_PAGE === true && dbgFromParams,
      reqId: reqId,
      applicantId: "",
      secret: "",
      redirectUrl: badPayloadRedirect,
      tokenValidationPassed: false,
      result: badPayloadResult,
      debugId: dbgBadPayload
    });
  }
  var action = clean_(payload.action || payload._action || payload.route || "");
  payload.__reqId = reqId;
  payload.__paramKeys = paramKeys.slice();
  var debugPost = CONFIG.DEBUG_PORTAL_SHOW_ON_PAGE === true && clean_(payload.dbg || params.dbg || "") === "1";
  logPortalPostEvent_("PORTAL_POST_START", {
    reqId: reqId,
    keys: paramKeys,
    view: clean_(params.view || ""),
    action: action,
    id: clean_(payload.id || payload.ApplicantID || params.id || ""),
    s: redactToken_(payload.s || payload.secret || params.s || ""),
    postDataType: postType,
    postDataLength: postLen
  });

  if (action === "portal_update") {
    var debugId = newDebugId_();
    var applicantId = clean_(payload.id || payload.ApplicantID || "");
    var secret = clean_(payload.s || payload.secret || "");
    try {
      if (hasOwn_(payload, "payload")) {
        payload = mergePortalPayload_(payload, parsePortalPayloadField_(payload.payload));
        applicantId = clean_(payload.id || payload.ApplicantID || applicantId);
        secret = clean_(payload.s || payload.secret || secret);
      }
      if (!applicantId || !secret) {
        try {
          var ssMissing = getWorkingSpreadsheet_();
          var logSheetMissing = mustGetSheet_(ssMissing, CONFIG.LOG_SHEET);
          log_(logSheetMissing, "PORTAL_UPDATE_FATAL", debugId + " Missing portal token (id/s)");
        } catch (logErr0) {}
        var missRedirect = buildPortalRedirectUrl_(applicantId, secret, {
          error: true,
          dbg: debugId
        });
        var missResult = {
          ok: false,
          debugId: debugId,
          applicantId: applicantId,
          error: { message: "Missing portal token (id/s).", code: "MISSING_TOKEN" }
        };
        logPortalPostEvent_("PORTAL_POST_REDIRECT", {
          reqId: reqId,
          redirectUrl: missRedirect,
          id: applicantId,
          s: redactToken_(secret),
          saved: false
        });
        return returnPortalRedirectOutput_(missRedirect, {
          debug: debugPost,
          reqId: reqId,
          applicantId: applicantId,
          secret: secret,
          redirectUrl: missRedirect,
          tokenValidationPassed: false,
          result: missResult,
          debugId: debugId
        });
      }
      var ssPortal = getWorkingSpreadsheet_();
      var dataSheetPortal = mustGetDataSheet_(ssPortal);
      var logSheetPortal = mustGetSheet_(ssPortal, CONFIG.LOG_SHEET);
      log_(logSheetPortal, "PORTAL_UPDATE_DEBUG", debugId + " " + applicantId);
      var resultObj = handlePortalUpdate_(ssPortal, dataSheetPortal, logSheetPortal, payload, params, debugId);
      resultObj = outputToJsonObject_(resultObj) || {};
      if (resultObj.ok === true) {
        var okRedirect = buildPortalRedirectUrl_(clean_(resultObj.applicantId || applicantId), secret, { saved: true });
        logPortalPostEvent_("PORTAL_POST_REDIRECT", {
          reqId: reqId,
          redirectUrl: okRedirect,
          id: applicantId,
          s: redactToken_(secret),
          saved: okRedirect.indexOf("saved=1") >= 0
        });
        return returnPortalRedirectOutput_(okRedirect, {
          debug: debugPost,
          reqId: reqId,
          applicantId: applicantId,
          secret: secret,
          redirectUrl: okRedirect,
          tokenValidationPassed: true,
          result: resultObj,
          debugId: clean_(resultObj.debugId || debugId)
        });
      }
      var failDbgId = clean_(resultObj.debugId || debugId) || debugId;
      var failCode = clean_(resultObj && resultObj.error && resultObj.error.code || "");
      var failValidationErrors = Array.isArray(resultObj.validationErrors) ? resultObj.validationErrors : [];
      var failFields = failValidationErrors.map(function (item) { return clean_(item && item.field || ""); }).filter(function (item) { return !!item; });
      var failCodes = failValidationErrors.map(function (item) { return clean_(item && item.code || ""); }).filter(function (item) { return !!item; });
      var isPaymentVerifiedLock = failCode === "PAYMENT_VERIFIED_LOCK";
      var failRedirect = isPaymentVerifiedLock
        ? buildPortalRedirectUrl_(applicantId, secret, { locked: true, msg: "enrolled" })
        : buildPortalRedirectUrl_(applicantId, secret, { error: true, dbg: failDbgId, val: failValidationErrors.length > 0, fields: failFields.join(","), errCode: failCodes.join(",") });
      logPortalPostEvent_("PORTAL_POST_REDIRECT", {
        reqId: reqId,
        redirectUrl: failRedirect,
        id: applicantId,
        s: redactToken_(secret),
        saved: false
      });
      return returnPortalRedirectOutput_(failRedirect, {
        debug: debugPost,
        reqId: reqId,
        applicantId: applicantId,
        secret: secret,
        redirectUrl: failRedirect,
        tokenValidationPassed: isPaymentVerifiedLock ? true : false,
        result: resultObj,
        debugId: failDbgId
      });
    } catch (errPortal) {
      try {
        var ssLog = getWorkingSpreadsheet_();
        var logSheetFatal = mustGetSheet_(ssLog, CONFIG.LOG_SHEET);
        log_(logSheetFatal, "PORTAL_UPDATE_FATAL", debugId + " " + String(errPortal && errPortal.message ? errPortal.message : errPortal));
      } catch (logErr) {}
      var excResult = {
        ok: false,
        debugId: debugId,
        applicantId: applicantId,
        error: {
          code: "PORTAL_UPDATE_EXCEPTION",
          message: String(errPortal && errPortal.message ? errPortal.message : errPortal)
        }
      };
      var excRedirect = buildPortalRedirectUrl_(applicantId, secret, { error: true, dbg: debugId });
      logPortalPostEvent_("PORTAL_POST_REDIRECT", {
        reqId: reqId,
        redirectUrl: excRedirect,
        id: applicantId,
        s: redactToken_(secret),
        saved: false
      });
      return returnPortalRedirectOutput_(excRedirect, {
        debug: debugPost,
        reqId: reqId,
        applicantId: applicantId,
        secret: secret,
        redirectUrl: excRedirect,
        tokenValidationPassed: false,
        result: excResult,
        debugId: debugId
      });
    }
  }

  var ss = getWorkingSpreadsheet_();
  var dataSheet = mustGetDataSheet_(ss);
  var logSheet = mustGetSheet_(ss, CONFIG.LOG_SHEET);
  appendPortalLog_({ route: "doPost", status: "HIT", message: "doPost called", email: payload.email || payload.Parent_Email || "", applicantId: payload.id || payload.ApplicantID || "" });


  log_(logSheet, "doPost HIT", payloadSummary_(payload));
  log_(logSheet, "ACTION", action || "(blank)");

  // Intake webhook (FormDesigner)
  log_(logSheet, "POST HIT", payloadSummary_(payload));
  log_(logSheet, "PAYLOAD KEYS", Object.keys(payload).join(", "));

  ensureHeaders_(dataSheet, payload);

  var correlationId = clean_(payload.correlation_id || "");
  var activationStage = "START";
  var activationCode = "ACTIVATION_FAILED";
  var targetRow = 0;
  var applicantId = "";
  var folder = null;
  var folderUrl = "";
  var tokenState = null;
  var rowCommitted = false;
  var verification = null;
  var intakeLock = LockService.getScriptLock();
  var intakeLockReleased = false;

  try {
    intakeLock.waitLock(30000);
    logActivation_(logSheet, "ACTIVATION_START", {
      correlation_id: correlationId,
      payloadKeyCount: Object.keys(payload || {}).length,
      spreadsheetId: clean_(getWorkingSpreadsheetId_() || ""),
      dataSheet: clean_(dataSheet.getName() || "")
    });

    activationStage = "DUPLICATE_CHECK";
    var duplicateCheck = findPotentialIntakeDuplicate_(dataSheet, payload);
    if (duplicateCheck && duplicateCheck.duplicate === true) {
      activationCode = "DUPLICATE_INTAKE_REVIEW_REQUIRED";
      logActivation_(logSheet, "DUPLICATE_INTAKE_BLOCKED", {
        correlation_id: correlationId,
        matches: duplicateCheck.matches || []
      });
      return jsonOut_({
        status: "duplicate_review_required",
        ok: false,
        code: activationCode,
        message: "Potential duplicate intake found. Operator review required before creating another applicant.",
        matches: duplicateCheck.matches || []
      });
    }

    activationStage = "APPLICANTID_PREPARE";
    var applicantIdState = scanApplicantIdState_(dataSheet);
    applicantId = clean_(applicantIdState.applicantId || "");
    if (!applicantId) {
      activationCode = "APPLICANTID_PREPARE_FAILED";
      throw new Error("APPLICANTID_PREPARE_FAILED");
    }
    logActivation_(logSheet, "ACTIVATION_ID_PREPARED", {
      correlation_id: correlationId,
      applicantId: applicantId,
      validCount: applicantIdState.validCount,
      maxSuffix: applicantIdState.maxSuffix,
      skippedBlankCount: applicantIdState.skippedBlankCount,
      skippedMalformedCount: applicantIdState.skippedMalformedCount
    });

    activationStage = "FOLDER_PREPARE";
    folder = createApplicantFolder_(payload);
    folderUrl = clean_(folder && folder.getUrl ? folder.getUrl() : "");
    if (!folderUrl) {
      activationCode = "FOLDER_PREPARE_FAILED";
      throw new Error("FOLDER_PREPARE_FAILED");
    }
    logActivation_(logSheet, "ACTIVATION_FOLDER_PREPARED", {
      correlation_id: correlationId,
      folderUrl: folderUrl,
      folderId: clean_(folder && folder.getId ? folder.getId() : "")
    });

    activationStage = "FILE_CANONICALIZE";
    payload = canonicalizeFdIntakeFiles_(payload, folder, logSheet, {
      correlationId: correlationId,
      applicantId: applicantId
    });
    payload = maybeStampActivationSubmitState_(payload, logSheet, {
      applicantId: applicantId
    });

    activationStage = "TOKEN_PREPARE";
    tokenState = preparePortalActivationState_(dataSheet, applicantId);
    logActivation_(logSheet, "ACTIVATION_TOKEN_PREPARED", {
      correlation_id: correlationId,
      hasPortalTokenHashHeader: tokenState.hasTokenHashHeader === true,
      hasPortalTokenIssuedAtHeader: tokenState.hasTokenIssuedAtHeader === true,
      portalSecretsPrepared: tokenState.portalSecretsRequired === true
    });

    var formId = clean_(payload.FormID || payload.FD_FormID || "");
    var cid = correlationId || applicantId || formId || "";
    logActivation_(logSheet, "TOKEN_TRACE_REACHED", {
      downstream_deployment_id: AUTHORITATIVE_DOWNSTREAM_DEPLOYMENT_ID,
      correlation_id: cid,
      applicantId: applicantId || "",
      formId: formId || "",
      targetRow: targetRow || 0
    });
    log_(logSheet, "TOKEN_WRITE_TRACE", JSON.stringify({
      downstream_deployment_id: AUTHORITATIVE_DOWNSTREAM_DEPLOYMENT_ID,
      correlation_id: cid,
      applicantId: applicantId || "",
      formId: formId || "",
      portalTokenIssuedAt: tokenState && tokenState.hasTokenIssuedAtHeader ? String(tokenState.tokenIssuedAt || "") : "",
      portalTokenHash: tokenState && tokenState.hasTokenHashHeader ? String(tokenState.tokenHash || "") : "",
      tokenDerivationSource: "preparePortalActivationState_: newPortalSecret_() -> hashPortalSecret_(plainSecret)"
    }));

    activationStage = "ROW_COMMIT";
    targetRow = dataSheet.getLastRow() + 1;
    var activatedRow = buildActivatedIntakeRow_(dataSheet, payload, folderUrl, applicantId, tokenState);
    insertActivatedRowAt_(dataSheet, targetRow, activatedRow);
    rowCommitted = true;
    logActivation_(logSheet, "ACTIVATION_ROW_COMMIT", {
      correlation_id: correlationId,
      targetRow: targetRow,
      applicantId: applicantId
    });

    activationStage = "PORTALSECRETS_COMMIT";
    if (tokenState.portalSecretsRequired === true) {
      commitPortalActivationState_(payload, applicantId, tokenState);
    }

    activationStage = "VERIFY";
    verification = verifyActivatedState_(dataSheet, targetRow, applicantId, folderUrl, tokenState);
    logActivation_(logSheet, "ACTIVATION_VERIFY", {
      correlation_id: correlationId,
      targetRow: targetRow,
      applicantIdActual: clean_(verification.applicantIdActual || ""),
      folderUrlPresent: verification.folderUrlPresent === true,
      portalTokenHashPresent: verification.portalTokenHashPresent === true,
      portalTokenIssuedAtPresent: verification.portalTokenIssuedAtPresent === true,
      portalSecretsResolvable: verification.portalSecretsResolvable === true
    });
    if (verification.ok !== true) {
      activationCode = clean_(verification.code || "ACTIVATION_VERIFY_FAILED") || "ACTIVATION_VERIFY_FAILED";
      throw new Error(clean_(verification.message || activationCode) || activationCode);
    }

    var committedSnapshot = readCommittedActivationSnapshot_(dataSheet, targetRow);
    log_(logSheet, "TOKEN_ROW_COMMIT_TRACE", JSON.stringify({
      downstream_deployment_id: AUTHORITATIVE_DOWNSTREAM_DEPLOYMENT_ID,
      correlation_id: cid,
      applicantId: applicantId || "",
      targetRow: targetRow || 0,
      portalTokenIssuedAt: committedSnapshot.portalTokenIssuedAt || "",
      portalTokenHash: committedSnapshot.portalTokenHash || ""
    }));
    log_(logSheet, "TOKEN_PROOF_SEAM_BEFORE", JSON.stringify({
      downstream_deployment_id: AUTHORITATIVE_DOWNSTREAM_DEPLOYMENT_ID,
      correlation_id: cid,
      applicantId: applicantId || "",
      targetRow: targetRow || 0
    }));
    var postHocProof = buildPostHocTokenProofDownstream_(committedSnapshot);
    log_(logSheet, "TOKEN_POSTHOC_PROOF_DOWNSTREAM", JSON.stringify({
      downstream_deployment_id: AUTHORITATIVE_DOWNSTREAM_DEPLOYMENT_ID,
      correlation_id: cid,
      applicantId: applicantId || "",
      proof: postHocProof
    }));
    var tokenProbeSuite = runTokenProbeSuite_(committedSnapshot);
    log_(logSheet, "TOKEN_PROBE_SUITE_DOWNSTREAM", JSON.stringify({
      downstream_deployment_id: AUTHORITATIVE_DOWNSTREAM_DEPLOYMENT_ID,
      correlation_id: cid,
      applicantId: applicantId || "",
      suite: tokenProbeSuite
    }));

    log_(logSheet, "TOKEN_PROOF_SEAM_AFTER", JSON.stringify({
      downstream_deployment_id: AUTHORITATIVE_DOWNSTREAM_DEPLOYMENT_ID,
      correlation_id: cid,
      applicantId: applicantId || "",
      targetRow: targetRow || 0
    }));

    activationStage = "OK";
    logActivation_(logSheet, "ACTIVATION_OK", {
      correlation_id: correlationId,
      targetRow: targetRow,
      applicantId: applicantId
    });
    var fdAckLockReleased = false;
    try {
      intakeLock.releaseLock();
      intakeLockReleased = true;
      fdAckLockReleased = true;
    } catch (_releaseErr) {}
    if (fdAckLockReleased) {
      try {
        runFdAcknowledgementForCommittedRow_(dataSheet, targetRow, {
          applicantId: applicantId,
          correlationId: correlationId,
          debugId: cid || newDebugId_(),
          source: "intake_post_commit"
        });
      } catch (fdAckErr) {
        recordFdAcknowledgementPostCommitTrace_(dataSheet, targetRow, "FAILED", {
          source: "intake_post_commit",
          correlationId: correlationId,
          debugId: cid || "",
          code: "FD_ACK_POST_COMMIT_NON_FATAL",
          reason: String(fdAckErr && fdAckErr.message ? fdAckErr.message : fdAckErr)
        });
        logActivation_(logSheet, "FD_ACK_POST_COMMIT_NON_FATAL", {
          correlation_id: correlationId,
          targetRow: targetRow,
          applicantId: applicantId,
          error: String(fdAckErr && fdAckErr.message ? fdAckErr.message : fdAckErr)
        });
      }
    } else {
      recordFdAcknowledgementPostCommitTrace_(dataSheet, targetRow, "SKIPPED", {
        source: "intake_post_commit",
        correlationId: correlationId,
        debugId: cid || "",
        code: "INTAKE_LOCK_RELEASE_FAILED",
        reason: "INTAKE_LOCK_RELEASE_FAILED"
      });
      logActivation_(logSheet, "FD_ACK_POST_COMMIT_SKIPPED", {
        correlation_id: correlationId,
        targetRow: targetRow,
        applicantId: applicantId,
        reason: "INTAKE_LOCK_RELEASE_FAILED"
      });
    }
    return jsonOut_({ status: "ok", ApplicantID: applicantId });
  } catch (errActivation) {
    if (rowCommitted && targetRow >= 2) {
      try { dataSheet.deleteRow(targetRow); } catch (_deleteErr) {}
    }
    logActivation_(logSheet, "ACTIVATION_FAIL", {
      correlation_id: correlationId,
      stage: activationStage,
      targetRow: targetRow || 0,
      applicantId: applicantId,
      error: String(errActivation && errActivation.message ? errActivation.message : errActivation)
    });
    return jsonOut_({
      status: "error",
      code: clean_(activationCode || "ACTIVATION_FAILED") || "ACTIVATION_FAILED",
      message: String(errActivation && errActivation.message ? errActivation.message : errActivation),
      correlation_id: correlationId
    });
  } finally {
    if (!intakeLockReleased) {
      try { intakeLock.releaseLock(); } catch (_lockErr) {}
    }
  }}

/******************** ENTRYPOINT: GET ********************/
function maybeRedirectToCanonical_(e) {
  var params = (e && e.parameter && typeof e.parameter === "object") ? e.parameter : {};
  var currentUrl = clean_(ScriptApp.getService().getUrl() || "");
  var canonicalBase = pickCanonicalExecBase_(e);

  if (!currentUrl || !canonicalBase) return null;

  if (currentUrl.indexOf("/a/macros/") !== -1) {
    var redirectHtml = HtmlService.createHtmlOutput(
      '<script>location.replace("' + canonicalBase + '" + location.search);</script>'
    );

    redirectHtml
      .addMetaTag("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
      .addMetaTag("Pragma", "no-cache")
      .addMetaTag("Expires", "0");

    return redirectHtml;
  }

  return null;
}

function doGet(e) {
  var dbg = (typeof newDebugId_ === "function") ? newDebugId_() : ("DBG-" + Utilities.getUuid().slice(0, 8));
  var params = (e && e.parameter && typeof e.parameter === "object") ? e.parameter : {};
  var view = clean_(params.view || "").toLowerCase();
  var serviceUrl = "";
  var currentUrl = "";
  var isAdminDeployment = false;

  try {
    var redirect = maybeRedirectToCanonical_(e);
    if (redirect) return redirect;

    try {
      serviceUrl = clean_(ScriptApp.getService().getUrl() || "");
      currentUrl = serviceUrl;
    } catch (_serviceErr) {}

    isAdminDeployment = isAdminDeploymentRequest_();
    Logger.log("ROUTE doGet START dbg=%s view=%s isAdmin=%s url=%s", dbg, view || "(blank)", isAdminDeployment ? "true" : "false", currentUrl || "");

    var handler = resolveDoGetHandler_(view, isAdminDeployment);
    var result = handler(e);
    if (!result) {
      throw new Error("Route handler returned empty response. view=" + (view || "(blank)"));
    }

    Logger.log("ROUTE doGet OK dbg=%s view=%s", dbg, view || "(blank)");
    return result;
  } catch (err) {
    var errMsg = stringifyGsError_(err);
    try {
      Logger.log("ROUTE doGet FAIL dbg=%s view=%s url=%s err=%s", dbg, view || "(blank)", currentUrl || "", errMsg);
    } catch (_logErr) {}
    return renderDoGetFatalHtml_(dbg, view, currentUrl, errMsg);
  }
}

function resolveDoGetHandler_(view, isAdminDeployment) {
  var route = clean_(view || "").toLowerCase();
  if (route === "diag") return respondDiag_;
  if (route === "whoami") return doGet_whoami_;
  if (route === "file") return doGet_file_;
  if (route === "eduops") return renderEduOpsApp_;
  if (route === "ops") return renderAdminApp_;
  if (route === "operator-next") return renderAdminApp_;
  if (route === "admin") return renderAdminApp_;
  if (!route) return isAdminDeployment ? renderAdminApp_ : renderPortalAppFromDoGet_;
  return isAdminDeployment ? renderAdminApp_ : renderPortalAppFromDoGet_;
}

function renderPortalAppFromDoGet_(e) {
  return renderPortalPageResponse_(e, { uploadResult: null, viewName: "portal" });
}

function renderDoGetFatalHtml_(dbg, view, url, errMsg) {
  var html = ''
    + '<!doctype html><html><head><meta charset="utf-8"><base target="_top">'
    + '<meta name="viewport" content="width=device-width, initial-scale=1">'
    + '<meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate, max-age=0">'
    + '<meta http-equiv="Pragma" content="no-cache">'
    + '<meta http-equiv="Expires" content="0">'
    + '<style>body{font-family:Arial,Helvetica,sans-serif;background:#0f172a;color:#e2e8f0;margin:0;padding:24px}.card{max-width:900px;margin:0 auto;background:#111827;border:1px solid #7f1d1d;border-radius:12px;padding:16px}.k{color:#93c5fd;font-weight:700}.v{word-break:break-word}.err{margin-top:12px;padding:10px;border:1px solid #7f1d1d;background:#3f1d1d;border-radius:8px;color:#fee2e2}</style>'
    + '</head><body><div class="card">'
    + '<h2 style="margin:0 0 12px 0;color:#fecaca">ROUTE FAILURE</h2>'
    + '<div><span class="k">Debug ID:</span> <span class="v">' + esc_(clean_(dbg || "")) + '</span></div>'
    + '<div style="margin-top:8px"><span class="k">View:</span> <span class="v">' + esc_(clean_(view || "(blank)")) + '</span></div>'
    + '<div style="margin-top:8px"><span class="k">URL:</span> <span class="v">' + esc_(clean_(url || "")) + '</span></div>'
    + '<div class="err"><span class="k">Error:</span> ' + esc_(clean_(errMsg || "Unknown error")) + '</div>'
    + '</div></body></html>';
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function renderPortalPageResponse_(e, opts) {
  var params = (e && e.parameter && typeof e.parameter === "object") ? e.parameter : {};
  var o = (opts && typeof opts === "object") ? opts : {};
  var uploadRes = (o.uploadResult && typeof o.uploadResult === "object" && !Array.isArray(o.uploadResult)) ? o.uploadResult : null;
  var id = clean_(o.applicantId || params.id || "");
  var secret = clean_(o.secret || params.s || "");
  var saved = clean_(params.saved || "") === "1";
  var errorFlag = clean_(params.error || "") === "1";
  var lockedFlag = clean_(params.locked || "") === "1";
  var msgToken = clean_(params.msg || "");
  var dbg = clean_(params.dbg || "");
  var uploadFail = clean_(params.uploadFail || "") === "1";
  var uploadField = clean_(params.field || "");
  var uploadResult = clean_(params.u || "") === "1";
  var uploadOk = clean_(params.ok || "") === "1";
  var uploadDocKey = clean_(params.docKey || "");
  var uploadErrCode = clean_(params.errCode || "");
  var validationFlag = clean_(params.val || "") === "1";
  var validationFields = parsePortalCsvParam_(params.fields || "");
  var validationCodes = parsePortalCsvParam_(params.errCode || "");
  if (uploadRes) {
    uploadResult = true;
    uploadOk = uploadRes.ok === true;
    uploadDocKey = clean_(uploadRes.docKey || uploadDocKey || "");
    uploadErrCode = clean_(uploadRes.errCode || uploadErrCode || "");
    if (clean_(uploadRes.dbg || "")) dbg = clean_(uploadRes.dbg || "");
    uploadFail = uploadOk !== true;
  }
  var reqId = makeReqId_();
  var debugPage = CONFIG.DEBUG_PORTAL_SHOW_ON_PAGE === true && dbg === "1";
  var reqMeta = getPortalRequestMeta_(e);
  var isAdminDeployment = isAdminDeploymentRequest_();
  function invalidPortalLinkMsg_(reasonCode, dbgId, extra) {
    var reason = clean_(reasonCode || "") || "invalid";
    var debugId = clean_(dbgId || "");
    var extraText = clean_(extra || "");
    var msg = "Invalid portal link (" + reason + ")";
    if (extraText) msg += " - " + extraText;
    if (debugId) msg += " Debug: " + debugId;
    return msg;
  }
  if (!id || !secret) {
    var missingTokenDbg = newDebugId_();
    safePortalLog_({
      route: "doGet:portal",
      applicantId: id || "",
      email: reqMeta.ip || "",
      status: "invalid_token",
      message: "missing_params dbg=" + missingTokenDbg + " | ua=" + (reqMeta.ua || "")
    }, false);
    var msg = invalidPortalLinkMsg_("missingToken", errorFlag && dbg ? dbg : missingTokenDbg, "Please reopen your portal link.");
    return htmlOutput_(renderErrorHtml_(msg));
  }

  var secretRes = getPortalSecretForApplicant_(id);
  if (!secretRes || secretRes.ok !== true || clean_(secretRes.secret || "") !== secret) {
    var secretMismatchDbg = newDebugId_();
    var badCount = incrementInvalidPortalAttempt_(id);
    if (badCount > 10) return htmlOutput_(renderErrorHtml_("Too many invalid attempts. Please try again later."));
    safePortalLog_({
      route: "doGet:portal",
      applicantId: id,
      email: reqMeta.ip || "",
      status: "invalid_token",
      message: "hash_mismatch attempts=" + badCount + " dbg=" + secretMismatchDbg + " | ua=" + (reqMeta.ua || "")
    }, false);
    return htmlOutput_(renderErrorHtml_("Invalid or expired link. Please request a new link."));
  }

  var ss = getWorkingSpreadsheet_();
  var sheet = mustGetDataSheet_(ss);
  var rowNum = findRowByApplicantId_(sheet, id);
  if (!rowNum) {
    var applicantNotFoundDbg = newDebugId_();
    var missingCount = incrementInvalidPortalAttempt_(id);
    if (missingCount > 10) return htmlOutput_(renderErrorHtml_("Too many invalid attempts. Please try again later."));
    safePortalLog_({
      route: "doGet:portal",
      applicantId: id,
      email: reqMeta.ip || "",
      status: "invalid_token",
      message: "row_not_found attempts=" + missingCount + " dbg=" + applicantNotFoundDbg + " | ua=" + (reqMeta.ua || "")
    }, false);
    return htmlOutput_(renderErrorHtml_(invalidPortalLinkMsg_("applicantNotFound", applicantNotFoundDbg)));
  }
  var rowObj = getRowObject_(sheet, rowNum);
  var record = rowObj;
  if (String(record[SCHEMA.PORTAL_ACCESS_STATUS] || "").trim() === "Locked") {
    var lockedDbg = newDebugId_();
    safePortalLog_({
      route: "doGet:portal",
      applicantId: id,
      email: reqMeta.ip || "",
      status: "locked",
      message: "portal_locked dbg=" + lockedDbg + " | ua=" + (reqMeta.ua || "")
    }, false);
    return htmlOutput_(renderErrorHtml_(invalidPortalLinkMsg_("locked", lockedDbg, "Access suspended")));
  }

  record._PortalLockReason = getPortalLockReason_(record);
  record._PortalLocked = isPortalLocked_(record);
  safePortalLog_({
    route: "doGet:portal",
    applicantId: id,
    email: reqMeta.ip || "",
    status: "success",
    message: "open_ok | ua=" + (reqMeta.ua || "")
  }, false);

  var canonical = clean_(record.Subjects_Selected_Canonical || "");
  var fallbackCsv = subjectsToCsv_(record.Subjects_Selected || "");
  record._SubjectsCsv = canonical || fallbackCsv;

  var examSites = getExamSites_(ss);
  var portalHtml = renderPortalHtml_({
    id: id,
    secret: secret,
    reqId: reqId,
    debugPage: debugPage,
    saved: saved,
    errorFlag: errorFlag,
    lockedFlag: lockedFlag,
    msgToken: msgToken,
    dbg: dbg,
    uploadFail: uploadFail,
    uploadField: uploadField,
    uploadResult: uploadResult,
    uploadOk: uploadOk,
    uploadDocKey: uploadDocKey,
    uploadErrCode: uploadErrCode,
    validationFlag: validationFlag,
    validationFields: validationFields,
    validationCodes: validationCodes,
    record: record,
    subjects: CONFIG.PORTAL_SUBJECTS,
    examSites: examSites,
    editFields: getPortalEditableFields_(),
    docs: getDocUiFields_(),
    visibleFields: CONFIG.PORTAL_VISIBLE_FIELDS,
    subjectsLocked: isDocsVerified_(record),
    version: CONFIG.VERSION,
    versionShort: portalVersionShort_(CONFIG.VERSION),
    buildRenderedAt: new Date().toISOString(),
    buildScriptId: ScriptApp.getScriptId()
  });

  Logger.log(
    "PORTAL_RENDER_DIAG version=%s view=%s applicantId=%s isAdmin=%s cache=%s",
    clean_(CONFIG.VERSION || ""),
    clean_(clean_(o.viewName || "portal")),
    clean_(id || "-") || "-",
    isAdminDeployment ? "true" : "false",
    "DISABLED"
  );

  return htmlOutput_(portalHtml);
}

function diagStatus_(e) {
  var activeUser = "";
  var effectiveUser = "";
  var serviceUrl = "";
  var isAdmin = false;
  if (CONFIG.DIAG_RUNTIME !== true) {
    return { ok: false, err: "diag disabled" };
  }
  try { activeUser = clean_(Session.getActiveUser().getEmail() || ""); } catch (_au) {}
  try { effectiveUser = clean_(Session.getEffectiveUser().getEmail() || ""); } catch (_eu) {}
  try { serviceUrl = clean_(ScriptApp.getService().getUrl() || ""); } catch (_su) {}
  try {
    var allowlist = (CONFIG.ADMIN_EMAILS || []).map(function (x) { return clean_(x).toLowerCase(); });
    isAdmin = allowlist.indexOf(clean_(activeUser).toLowerCase()) >= 0;
  } catch (_adm) {}
  var out = {
    ok: true,
    version: CONFIG.VERSION,
    changelog: CONFIG.CHANGELOG_LAST || "",
    nowIso: new Date().toISOString(),
    scriptId: ScriptApp.getScriptId(),
    serviceUrl: serviceUrl,
    studentBaseUrl: getStudentBaseUrl_(),
    user: activeUser,
    effectiveUser: effectiveUser
  };
  if (isAdmin) {
    var propKey = clean_(CONFIG.SCRIPT_PROP_UPLOAD_ROOT_ID || "FODE_UPLOAD_ROOT_ID") || "FODE_UPLOAD_ROOT_ID";
    out.rootPrimaryId = clean_(CONFIG.APPLICANT_ROOT_FOLDER_ID_PRIMARY || "");
    out.rootFallbackId = clean_(CONFIG.APPLICANT_ROOT_FOLDER_ID_FALLBACK || "");
    out.yearFolderName = clean_(CONFIG.APPLICANT_ROOT_YEAR_FOLDER_NAME || "");
    out.autoUploadRootEnabled = CONFIG.AUTO_UPLOAD_ROOT_ENABLED === true;
    out.scriptPropUploadRootKey = propKey;
    out.scriptPropUploadRootId = (typeof getScriptProp_ === "function") ? clean_(getScriptProp_(propKey) || "") : "";
    out.driveAuthHint = "If Drive operations fail with server error, run authDrive() in the Apps Script editor as the owner.";
  }
  return out;
}

function authDrive() {
  var rootId = clean_(CONFIG.APPLICANT_ROOT_FOLDER_ID_PRIMARY || "");
  var out = {
    ok: false,
    rootId: rootId,
    version: CONFIG.VERSION
  };
  try {
    var myDriveRoot = DriveApp.getRootFolder();
    var _myDriveRootName = clean_(myDriveRoot.getName() || "");
    var root = DriveApp.getFolderById(rootId);
    out.rootName = clean_(root.getName() || "");
    out.rootUrl = clean_(root.getUrl() || "");
    try {
      var it = root.getFolders();
      if (it && typeof it.hasNext === "function") it.hasNext();
    } catch (_iterErr) {}
    out.ok = true;
  } catch (e) {
    var se = safeErr_(e);
    out.errName = clean_(se.name || "Error") || "Error";
    out.errMessage = clean_(se.message || "Drive auth failed") || "Drive auth failed";
  }
  var text = JSON.stringify(out);
  Logger.log(text);
  return text;
}

function authDriveYearFolder() {
  var out = {
    ok: false,
    version: CONFIG.VERSION
  };
  try {
    var rootId = clean_(CONFIG.APPLICANT_ROOT_FOLDER_ID_PRIMARY || "");
    var yearFolderName = clean_(CONFIG.APPLICANT_ROOT_YEAR_FOLDER_NAME || CONFIG.YEAR_FOLDER || "");
    if (!rootId) throw new Error("Missing CONFIG.APPLICANT_ROOT_FOLDER_ID_PRIMARY");
    if (!yearFolderName) throw new Error("Missing year folder config");
    var root = DriveApp.getFolderById(rootId);
    var yearFolder = (typeof getOrCreateFolderByName_ === "function")
      ? getOrCreateFolderByName_(root, yearFolderName, "AUTH")
      : getOrCreateFolder_(root, yearFolderName);
    out.ok = true;
    out.rootId = rootId;
    out.yearFolderId = clean_(yearFolder.getId() || "");
    out.yearFolderName = clean_(yearFolder.getName() || yearFolderName);
  } catch (e) {
    var se = safeErr_(e);
    out.errName = clean_(se.name || "Error") || "Error";
    out.errMessage = clean_(se.message || "Drive year-folder auth failed") || "Drive year-folder auth failed";
  }
  var text = JSON.stringify(out);
  Logger.log(text);
  return text;
}


/******************** PORTAL UPDATE HANDLER ********************/
function parsePortalCsvParam_(raw) {
  return clean_(raw).split(",").map(function (part) {
    return clean_(part);
  }).filter(function (part) {
    return !!part;
  });
}

function portalValidationMessageForCode_(code) {
  var key = clean_(code || "");
  if (key === "DOB_REQUIRED") return "Date of Birth is required.";
  if (key === "DOB_INVALID") return "Enter a valid Date of Birth.";
  if (key === "SUBJECTS_REQUIRED") return "Select at least one subject.";
  if (key === "SUBJECTS_INVALID_FOR_GRADE") return "Selected subjects are not valid for the chosen grade.";
  if (key === "SUBJECT_LOCK_DOCS_VERIFIED") return "Subjects are locked because documents have been verified by Admin.";
  return "Please correct the highlighted fields before submitting.";
}

function sanitizePortalUpdateValue_(field, value) {
  var raw = value;
  var cleaned = clean_(value);
  if (field === "Parent_Phone") cleaned = cleaned.replace(/\s+/g, " ");
  if (field === "Date_Of_Birth") {
    if (!cleaned) return { raw: raw, sanitized: "", omit: false, blank: true, typed: true };
    var iso = toIsoDateInput_(cleaned);
    if (!iso) return { raw: raw, sanitized: cleaned, omit: false, invalid: true, typed: true };
    return { raw: raw, sanitized: iso, omit: false, typed: true };
  }
  if (field === "Physical_Exam_Site") {
    if (!cleaned) return { raw: raw, sanitized: "", omit: true, typed: true };
    return { raw: raw, sanitized: cleaned, omit: false, typed: true };
  }
  if (!cleaned) return { raw: raw, sanitized: "", omit: true };
  return { raw: raw, sanitized: cleaned, omit: false };
}

function normalizePortalSubjectsCsv_(raw) {
  var csv = subjectsToCsv_(raw);
  if (!csv) return "";
  var known = {};
  var ordered = [];
  var configured = CONFIG.PORTAL_SUBJECTS || [];
  for (var i = 0; i < configured.length; i++) {
    var configuredName = clean_(configured[i]);
    if (!configuredName) continue;
    known[configuredName.toLowerCase()] = configuredName;
  }
  var seen = {};
  var parts = csv.split(",");
  for (var j = 0; j < parts.length; j++) {
    var part = clean_(parts[j]);
    if (!part) continue;
    var key = part.toLowerCase();
    if (seen[key]) continue;
    seen[key] = true;
    ordered.push(known[key] || part);
  }
  ordered.sort(function (a, b) {
    var ai = configured.indexOf(a);
    var bi = configured.indexOf(b);
    if (ai >= 0 && bi >= 0) return ai - bi;
    if (ai >= 0) return -1;
    if (bi >= 0) return 1;
    return a.toLowerCase() < b.toLowerCase() ? -1 : (a.toLowerCase() > b.toLowerCase() ? 1 : 0);
  });
  return ordered.join(", ");
}

function validatePortalSubjectsForGrade_(gradeRaw, subjectsCsv) {
  var csv = normalizePortalSubjectsCsv_(subjectsCsv);
  if (!csv) return { ok: false, invalidSubjects: [], reason: "SUBJECTS_REQUIRED" };
  var gradeMatch = clean_(gradeRaw).match(/(\d{1,2})/);
  var gradeNum = gradeMatch ? Number(gradeMatch[1]) : 0;
  var disallow = {};
  if (gradeNum === 7 || gradeNum === 8) {
    ["Biology", "Chemistry", "Physics", "History", "Geography", "Economics", "Business Studies", "Accounting"].forEach(function (name) {
      disallow[name.toLowerCase()] = true;
    });
  } else if (gradeNum === 11 || gradeNum === 12) {
    ["Science", "Social Science"].forEach(function (name) {
      disallow[name.toLowerCase()] = true;
    });
  }
  var invalid = csv.split(",").map(function (part) { return clean_(part); }).filter(function (part) {
    return !!disallow[part.toLowerCase()];
  });
  return {
    ok: invalid.length === 0,
    invalidSubjects: invalid,
    reason: invalid.length ? "SUBJECTS_INVALID_FOR_GRADE" : ""
  };
}

function handlePortalUpdate_(ss, dataSheet, logSheet, payload, postParams, debugId) {
  if (!dataSheet || dataSheet.getName() !== CONFIG.DATA_SHEET) {
    throw new Error("DATA_SHEET mismatch");
  }
  log_(logSheet, "PORTAL_UPDATE payload", payloadSummary_(payload));
  var effectiveEditFields = getPortalEditableFields_().slice();
  ["Date_Of_Birth", "Physical_Exam_Site", "Subjects_Selected_Canonical"].forEach(function (f) {
    if (effectiveEditFields.indexOf(f) === -1) effectiveEditFields.push(f);
  });
  log_(logSheet, "PORTAL_UPDATE editFields", JSON.stringify(effectiveEditFields));

  var id = clean_(payload.id || "");
  var secret = clean_(payload.s || "");
  var safeDebugId = clean_(debugId || newDebugId_()) || newDebugId_();
  var rowIndex = 0;
  var failResult = function (message, code, extras) {
    var extra = (extras && typeof extras === "object") ? extras : {};
    return {
      ok: false,
      debugId: safeDebugId,
      applicantId: id,
      error: {
        message: clean_(message || "Portal update failed."),
        code: clean_(code || "PORTAL_UPDATE_FAILED")
      },
      validationErrors: Array.isArray(extra.validationErrors) ? extra.validationErrors : []
    };
  };
  var logValidationError = function (field, rawValue, sanitizedValue, code, reason) {
    var entry = {
      dbgId: safeDebugId,
      applicantId: id,
      field: clean_(field || ""),
      rawValue: rawValue == null ? "" : String(rawValue),
      sanitizedValue: sanitizedValue == null ? "" : String(sanitizedValue),
      reason: clean_(reason || code || "")
    };
    try { log_(logSheet, "PORTAL_UPDATE_VALIDATION_ERRORS", JSON.stringify(entry)); } catch (_logValidationErr) {}
    return {
      field: entry.field,
      rawValue: entry.rawValue,
      sanitizedValue: entry.sanitizedValue,
      reason: entry.reason,
      code: clean_(code || "VALIDATION_FAILED"),
      message: portalValidationMessageForCode_(code)
    };
  };
  if (!id || !secret) {
    return failResult("Missing portal link parameters. Please reopen your portal link.", "MISSING_TOKEN");
  }

  var found = findPortalRowByIdSecret_(dataSheet, id, secret);
  if (!found) {
    return failResult("No matching record found. Please reopen your portal link.", "ROW_NOT_FOUND");
  }
  rowIndex = found.rowNum;
  log_(logSheet, "PORTAL_UPDATE_TARGET", "row=" + rowIndex + " applicantId=" + id);
  log_(logSheet, "PORTAL_UPDATE rowIndex", String(rowIndex));
  portalDebugLog_("PORTAL_UPDATE_TARGET", {
    applicantId: id,
    rowNumber: rowIndex,
    email: clean_(found.record.Parent_Email_Corrected || found.record.Parent_Email || ""),
    sheet: CONFIG.DATA_SHEET
  });

  if (String(found.record[SCHEMA.PORTAL_ACCESS_STATUS] || "").trim() === "Locked") {
    return failResult("Access suspended. Please contact admissions.", "ACCESS_LOCKED");
  }

  if (isPortalLocked_(found.record)) {
    return failResult("Your record is locked because payment has been verified. No further changes are allowed.", "PAYMENT_VERIFIED_LOCK");
  }

  var posted = (postParams && typeof postParams === "object") ? postParams : {};
  var postKeys = Object.keys(posted || {}).sort();
  if (!postKeys.length && payload.__paramKeys && Array.isArray(payload.__paramKeys)) {
    postKeys = payload.__paramKeys.slice().sort();
  }
  logPortalPostEvent_("PORTAL_POST_KEYS", {
    reqId: clean_(payload.__reqId || ""),
    applicantId: id,
    keys: postKeys
  });
  var postedSample = function (key) {
    if (hasOwn_(posted, key)) return clean_(posted[key]);
    return clean_(payload[key] || "");
  };
  logPortalPostEvent_("PORTAL_POST_SAMPLE", {
    reqId: clean_(payload.__reqId || ""),
    applicantId: id,
    Gender: postedSample("Gender"),
    Date_Of_Birth: postedSample("Date_Of_Birth"),
    Grade_Applying_For: postedSample("Grade_Applying_For"),
    Parent_Phone: postedSample("Parent_Phone"),
    Subjects_Selected_Canonical: postedSample("Subjects_Selected_Canonical"),
    dbg: postedSample("dbg"),
    id: postedSample("id") || clean_(payload.ApplicantID || ""),
    s: redactToken_(hasOwn_(posted, "s") ? posted.s : (payload.s || payload.secret || ""))
  });

  var sourceFields = postKeys.length ? posted : payload;
  var validatedUpdates = {};
  var rawByField = {};
  var validationErrors = [];
  var includeUpdate = function (field, rawValue, sanitizedValue) {
    validatedUpdates[field] = sanitizedValue;
    rawByField[field] = rawValue == null ? "" : String(rawValue);
  };
  var addValidationError = function (field, rawValue, sanitizedValue, code, reason) {
    validationErrors.push(logValidationError(field, rawValue, sanitizedValue, code, reason));
  };

  if (effectiveEditFields.indexOf("Subjects_Selected_Canonical") >= 0 && isDocsVerified_(found.record)) {
    var attemptedSubjectsCanonical = hasOwn_(sourceFields, "Subjects_Selected_Canonical")
      ? clean_(sourceFields.Subjects_Selected_Canonical)
      : "";
    var attemptedSubjectsLegacy = hasOwn_(sourceFields, "Subjects_Selected")
      ? sourceFields.Subjects_Selected
      : (payload.Subjects_Selected || payload.field_Subjects_Selected || "");
    var attemptedSubjectsCsv = normalizePortalSubjectsCsv_(attemptedSubjectsCanonical || subjectsToCsv_(attemptedSubjectsLegacy));
    var existingSubjectsCsv = normalizePortalSubjectsCsv_(clean_(found.record.Subjects_Selected_Canonical || "") || subjectsToCsv_(found.record.Subjects_Selected || ""));
    if (attemptedSubjectsCsv && attemptedSubjectsCsv !== existingSubjectsCsv) {
      var attemptedFields = Object.keys(sourceFields || {}).filter(function (k) {
        return k === "Subjects_Selected_Canonical" || k === "Subjects_Selected" || k === "subj";
      });
      try {
        log_(logSheet, "SUBJECT_LOCK_BLOCK", JSON.stringify({
          applicantId: id,
          debugId: safeDebugId,
          actor: "portal_student",
          attemptedFields: attemptedFields
        }));
      } catch (_subjectLockBlockLogErr) {}
      addValidationError("Subjects_Selected_Canonical", attemptedSubjectsCanonical || attemptedSubjectsLegacy, attemptedSubjectsCsv, "SUBJECT_LOCK_DOCS_VERIFIED", "docs_verified_locked");
      return failResult("Subjects are locked because documents have been verified by Admin.", "SUBJECT_LOCK_DOCS_VERIFIED", {
        validationErrors: validationErrors
      });
    }
  }

  var genericSkip = {
    Parent_Email: true,
    Date_Of_Birth: true,
    Physical_Exam_Site: true,
    Subjects_Selected_Canonical: true
  };
  for (var i = 0; i < effectiveEditFields.length; i++) {
    var h = effectiveEditFields[i];
    if (genericSkip[h]) continue;
    if (!hasOwn_(sourceFields, h)) continue;
    var sanitizedGeneric = sanitizePortalUpdateValue_(h, sourceFields[h]);
    if (sanitizedGeneric.omit) continue;
    includeUpdate(h, sourceFields[h], sanitizedGeneric.sanitized);
  }

  var dobSubmitted = hasOwn_(sourceFields, "Date_Of_Birth");
  var storedDobIso = toIsoDateInput_(found.record.Date_Of_Birth);
  if (dobSubmitted) {
    var dobSanitized = sanitizePortalUpdateValue_("Date_Of_Birth", sourceFields.Date_Of_Birth);
    if (dobSanitized.blank) {
      addValidationError("Date_Of_Birth", sourceFields.Date_Of_Birth, "", "DOB_REQUIRED", "submitted_blank");
    } else if (dobSanitized.invalid) {
      addValidationError("Date_Of_Birth", sourceFields.Date_Of_Birth, dobSanitized.sanitized, "DOB_INVALID", "submitted_invalid");
    } else {
      includeUpdate("Date_Of_Birth", sourceFields.Date_Of_Birth, dobSanitized.sanitized);
    }
  } else if (!storedDobIso) {
    addValidationError("Date_Of_Birth", found.record.Date_Of_Birth, "", "DOB_REQUIRED", "effective_blank_on_submit");
  }

  if (hasOwn_(sourceFields, "Physical_Exam_Site")) {
    var examSanitized = sanitizePortalUpdateValue_("Physical_Exam_Site", sourceFields.Physical_Exam_Site);
    if (!examSanitized.omit) includeUpdate("Physical_Exam_Site", sourceFields.Physical_Exam_Site, examSanitized.sanitized);
  }

  var storedSubjectsCsv = normalizePortalSubjectsCsv_(clean_(found.record.Subjects_Selected_Canonical || "") || subjectsToCsv_(found.record.Subjects_Selected || ""));
  var hasSubmittedSubjects = hasOwn_(sourceFields, "Subjects_Selected_Canonical") || hasOwn_(sourceFields, "Subjects_Selected") || hasOwn_(sourceFields, "subj");
  var submittedSubjectsRaw = hasOwn_(sourceFields, "Subjects_Selected_Canonical")
    ? sourceFields.Subjects_Selected_Canonical
    : (hasOwn_(sourceFields, "Subjects_Selected") ? sourceFields.Subjects_Selected : (payload.Subjects_Selected || payload.field_Subjects_Selected || ""));
  var submittedSubjectsCsv = normalizePortalSubjectsCsv_(submittedSubjectsRaw);
  var effectiveGrade = clean_(validatedUpdates.Grade_Applying_For || found.record.Grade_Applying_For || "");
  if (hasSubmittedSubjects) {
    if (!submittedSubjectsCsv) {
      addValidationError("Subjects_Selected_Canonical", submittedSubjectsRaw, submittedSubjectsCsv, "SUBJECTS_REQUIRED", "submitted_blank");
    } else {
      var subjectsValidation = validatePortalSubjectsForGrade_(effectiveGrade, submittedSubjectsCsv);
      if (!subjectsValidation.ok) {
        if (submittedSubjectsCsv !== storedSubjectsCsv) {
          addValidationError("Subjects_Selected_Canonical", submittedSubjectsRaw, submittedSubjectsCsv, "SUBJECTS_INVALID_FOR_GRADE", subjectsValidation.invalidSubjects.join(", "));
        }
      } else {
        includeUpdate("Subjects_Selected_Canonical", submittedSubjectsRaw, submittedSubjectsCsv);
      }
    }
  } else if (!storedSubjectsCsv) {
    addValidationError("Subjects_Selected_Canonical", "", "", "SUBJECTS_REQUIRED", "effective_blank_on_submit");
  }

  if (validationErrors.length) {
    return failResult("Please correct the highlighted fields before submitting.", validationErrors[0].code || "VALIDATION_FAILED", {
      validationErrors: validationErrors
    });
  }
  validatedUpdates.PortalLastUpdateAt = new Date().toISOString();
  rawByField.PortalLastUpdateAt = validatedUpdates.PortalLastUpdateAt;
  if (!clean_(found.record.Portal_Submitted)) {
    validatedUpdates.Portal_Submitted = new Date().toISOString();
    rawByField.Portal_Submitted = validatedUpdates.Portal_Submitted;
  }

  var updateKeys = Object.keys(validatedUpdates);
  var emailBefore = clean_(found.record.Parent_Email_Corrected || "");
  var emailAfter = hasOwn_(validatedUpdates, "Parent_Email_Corrected") ? clean_(validatedUpdates.Parent_Email_Corrected) : emailBefore;
  var emailChanged = hasOwn_(validatedUpdates, "Parent_Email_Corrected")
    && emailAfter.toLowerCase() !== emailBefore.toLowerCase();
  var patchSample = {};
  for (var ps = 0; ps < updateKeys.length && ps < 5; ps++) {
    var patchKey = updateKeys[ps];
    var patchVal = clean_(validatedUpdates[patchKey]);
    patchSample[patchKey] = patchVal.length > 120 ? patchVal.slice(0, 120) : patchVal;
  }
  portalDebugLog_("PORTAL_UPDATE_PATCH", {
    applicantId: id,
    rowNumber: rowIndex,
    keys: updateKeys,
    patchSample: patchSample
  });

  log_(logSheet, "PORTAL_UPDATE_PATCH", "keys=" + updateKeys.join(","));
  log_(logSheet, "PORTAL_UPDATE updates", JSON.stringify(validatedUpdates));
  var beforeReceiptRow = {
    ApplicantID: clean_(found.record.ApplicantID || id || ""),
    First_Name: clean_(found.record.First_Name || ""),
    Last_Name: clean_(found.record.Last_Name || ""),
    Fee_Receipt_File: clean_(found.record.Fee_Receipt_File || "")
  };
  var headers = dataSheet.getRange(1, 1, 1, dataSheet.getLastColumn()).getValues()[0];
  try {
    for (var uk = 0; uk < updateKeys.length; uk++) {
      var key = updateKeys[uk];
      var colIndex = headers.indexOf(key);
      if (colIndex < 0) continue;
      try {
        dataSheet.getRange(rowIndex, colIndex + 1).setValue(validatedUpdates[key]);
      } catch (writeFieldErr) {
        var writeEntry = {
          dbgId: safeDebugId,
          applicantId: id,
          rowIndex: rowIndex,
          field: key,
          rawValue: rawByField[key] == null ? "" : String(rawByField[key]),
          sanitizedValue: validatedUpdates[key] == null ? "" : String(validatedUpdates[key]),
          error: String(writeFieldErr && writeFieldErr.message ? writeFieldErr.message : writeFieldErr),
          stack: clean_(writeFieldErr && writeFieldErr.stack ? writeFieldErr.stack : "")
        };
        try { log_(logSheet, "PORTAL_UPDATE_WRITE_ERROR", JSON.stringify(writeEntry)); } catch (_writeLogErr) {}
        portalDebugLog_("PORTAL_UPDATE_WRITE_ERROR", writeEntry);
        throw writeFieldErr;
      }
    }
    SpreadsheetApp.flush();
  } catch (e) {
    try {
      log_(logSheet, "PORTAL_UPDATE_WRITE_ERROR", JSON.stringify({
        dbgId: safeDebugId,
        applicantId: id,
        rowIndex: rowIndex,
        error: String(e && e.message ? e.message : e),
        stack: clean_(e && e.stack ? e.stack : "")
      }));
    } catch (_writeSummaryErr) {}
    return failResult("We could not save your update. Please try again or contact admissions.", "WRITE_FAILED");
  }
  if (emailChanged) {
    var docsKey = buildDocsFollowupKey_(id);
    try {
      PropertiesService.getScriptProperties().deleteProperty(docsKey);
    } catch (_propDelErr) {}
    try {
      log_(logSheet, "DOCS_FOLLOWUP_RESET_EMAIL_CHANGE", JSON.stringify({
        applicantId: id,
        rowNumber: rowIndex,
        key: docsKey,
        oldEmail: emailBefore,
        newEmail: emailAfter,
        debugId: safeDebugId
      }));
    } catch (_docsResetLogErr) {}
  }
  try {
    if (Object.prototype.hasOwnProperty.call(validatedUpdates, "Fee_Receipt_File")) {
      var afterReceiptRow = getRowObject_(dataSheet, rowIndex);
      maybeNotifyPaymentReceiptUploadTransition_(beforeReceiptRow, afterReceiptRow, rowIndex, { source: "portal_update" });
    }
  } catch (receiptAlertErr) {
    portalDebugLog_("PAYMENT_RECEIPT_ALERT_ERROR", {
      applicantId: id,
      rowNumber: rowIndex,
      error: String(receiptAlertErr && receiptAlertErr.message ? receiptAlertErr.message : receiptAlertErr)
    });
  }
  portalDebugLog_("PORTAL_UPDATE_RESULT", {
    applicantId: id,
    rowNumber: rowIndex,
    ok: true,
    saved: 1
  });
  log_(logSheet, "PORTAL_UPDATE_RESULT", "updated=" + updateKeys.length);
  log_(logSheet, "PORTAL UPDATE", "ApplicantID=" + id + " viaSecret=yes");
  return {
    ok: true,
    debugId: safeDebugId,
    applicantId: id,
    rowNumber: rowIndex,
    saved: 1
  };
}

function isAllowedPortalUploadField_(fieldKey) {
  var key = clean_(fieldKey || "");
  var allow = CONFIG.PORTAL_UPLOAD_KEYS || [];
  return allow.indexOf(key) >= 0;
}

function savePortalUpload_(applicantId, fieldKey, fileName, mimeType, bytes, ctx) {
  var id = clean_(applicantId || "");
  var key = clean_(fieldKey || "");
  var context = ctx || {};
  if (!id) throw new Error("Missing ApplicantID");
  if (!isAllowedPortalUploadField_(key)) throw new Error("Invalid upload field");

  var ss = context.ss || getWorkingSpreadsheet_();
  var sheet = context.sheet || mustGetSheet_(ss, CONFIG.DATA_SHEET);
  var dbg = clean_(context.dbg || "");
  var preferRestOnly = context.preferRest === true && CONFIG.DRIVE_REST_FALLBACK_ENABLED === true && CONFIG.PORTAL_UPLOAD_PREFER_REST === true;
  var onStage = (typeof context.onStage === "function") ? context.onStage : null;
  function emitUploadStage_(name, extra) {
    if (!onStage) return;
    try { onStage(clean_(name), extra && typeof extra === "object" ? extra : {}); } catch (_stageErr) {}
  }
  var rowNumber = Number(context.rowNumber || 0);
  var rowObj = context.rowObj || (rowNumber >= 2 ? getRowObject_(sheet, rowNumber) : null) || {};
  if (!rowNumber && id) rowNumber = findRowByApplicantId_(sheet, id);
  if (!rowNumber || rowNumber < 2) throw new Error("Applicant row not found");

  var tFolder = nowMs_();
  var folderUrl = clean_(rowObj.Folder_Url || "");
  var folderId = folderIdFromUrl_(folderUrl);
  var folder = null;
  var folderHandle = null;
  var folderIdKnown = !!folderId;
  emitUploadStage_("folder", {
    applicantId: id,
    field: key,
    folderIdKnown: folderIdKnown
  });
  if (preferRestOnly) {
    if (folderId) {
      folderHandle = driveApiBuildFolderHandleById_(folderId, dbg, folderUrl);
    }
  } else if (folderId) {
    try {
      folder = withRetries_(function () { return DriveApp.getFolderById(folderId); }, { dbg: dbg, label: "savePortalUpload:getFolderById" });
      withRetries_(function () { return folder.getName(); }, { dbg: dbg, label: "savePortalUpload:folderGetName" });
      folderHandle = {
        kind: "driveapp",
        folder: folder,
        id: clean_(folder.getId() || folderId),
        url: clean_(folder.getUrl() || folderUrl)
      };
    } catch (e) {
      folder = null;
      if (typeof isDriveServerError_ === "function" && isDriveServerError_(e) && CONFIG.DRIVE_REST_FALLBACK_ENABLED === true) {
        folderHandle = driveApiBuildFolderHandleById_(folderId, dbg, folderUrl);
      }
    }
  }
  if (!folderHandle) {
    if (preferRestOnly) {
      folderHandle = createApplicantFolderHandleWithRestFallback_(rowObj, dbg, id);
    } else {
      try {
        folder = createApplicantFolder_(rowObj, { dbg: dbg });
        folderHandle = {
          kind: "driveapp",
          folder: folder,
          id: clean_(folder.getId() || ""),
          url: clean_(folder.getUrl() || "")
        };
      } catch (createErr) {
        if (typeof isDriveServerError_ === "function" && isDriveServerError_(createErr) && CONFIG.DRIVE_REST_FALLBACK_ENABLED === true) {
          folderHandle = createApplicantFolderHandleWithRestFallback_(rowObj, dbg, id);
        } else {
          throw createErr;
        }
      }
    }
    if (!folderHandle) throw new Error("folder_root_unusable: folder handle missing");
    writeBack_(sheet, rowNumber, { Folder_Url: clean_(folderHandle.url || "") });
    rowObj.Folder_Url = clean_(folderHandle.url || "");
  }
  logExecTrace_("UPLOAD_T_FOLDER", dbg, {
    applicantId: id,
    field: key,
    ms: elapsedMs_(tFolder),
    folderIdKnown: folderIdKnown
  });

  var meta = docMetaByField_(key) || {};
  var prefix = safeFileName_(id) + "__" + safeFileName_(key) + "__";
  var finalName = prefix + safeFileName_(fileName || ((meta.label || key) + ".bin"));
  var blob = Utilities.newBlob(bytes || [], clean_(mimeType || "application/octet-stream") || "application/octet-stream", finalName);
  emitUploadStage_("drive", {
    applicantId: id,
    field: key
  });
  var tDrive = nowMs_();
  var file = null;
  var fileInfo = null;
  if (folderHandle.kind === "driveapp") {
    file = withRetries_(function () {
      return folderHandle.folder.createFile(blob);
    }, { dbg: dbg, label: "savePortalUpload:createFile" });
    fileInfo = {
      fileId: clean_(file.getId() || ""),
      fileUrl: clean_(file.getUrl() || ""),
      fileName: clean_(file.getName() || finalName)
    };
  } else if (folderHandle.kind === "rest") {
    fileInfo = driveApiUploadBlobToFolder_(clean_(folderHandle.id || ""), finalName, blob, dbg);
  } else {
    throw new Error("folder_root_unusable: unknown folder handle kind");
  }
  logExecTrace_("UPLOAD_T_DRIVE", dbg, {
    applicantId: id,
    field: key,
    ms: elapsedMs_(tDrive)
  });
  return {
    fileId: clean_(fileInfo && fileInfo.fileId || ""),
    fileUrl: clean_(fileInfo && fileInfo.fileUrl || ""),
    fileName: clean_(fileInfo && fileInfo.fileName || finalName),
    rowNumber: rowNumber,
    folderUrl: clean_(folderHandle && folderHandle.url || ""),
    driveMode: folderHandle && folderHandle.kind === "rest" ? "REST" : "DRIVEAPP"
  };
}

function applyPortalUploadSheetUpdate_(sheet, rowNumber, rowObj, fieldKey, uploadResult, opts) {
  var sh = sheet;
  var rowNum = Number(rowNumber || 0);
  var record = rowObj || getRowObject_(sh, rowNum);
  var key = clean_(fieldKey || "");
  var res = uploadResult || {};
  var logSheet = (opts && opts.logSheet) || mustGetSheet_(getWorkingSpreadsheet_(), CONFIG.LOG_SHEET);
  var dbg = clean_((opts && opts.dbg) || "");
  var docMeta = docMetaByField_(key);
  if (!docMeta) throw new Error("Invalid document field");

  var oldCell = clean_(record[key] || "");
  var isMultiple = docMeta.multiple === true;
  var fileUrl = clean_(res.fileUrl || "");
  if (!fileUrl) throw new Error("Missing uploaded file URL");
  var updates = {};
  updates[key] = isMultiple ? appendUrlToCell_(oldCell, fileUrl) : fileUrl;
  updates.PortalLastUpdateAt = new Date().toISOString();
  if (!clean_(record.Portal_Submitted)) updates.Portal_Submitted = new Date().toISOString();
  if (docMeta.status && hasHeader_(sh, docMeta.status)) updates[docMeta.status] = "PENDING_REVIEW";
  var line = new Date().toISOString()
    + " | " + key
    + " | " + (isMultiple ? "uploaded" : "replaced")
    + " | old=" + (oldCell || "-")
    + " | new=" + fileUrl;
  updates.File_Log = appendLog_(clean_(record.File_Log || ""), line);

  var receiptBeforeRow = null;
  if (key === "Fee_Receipt_File") {
    receiptBeforeRow = {
      ApplicantID: clean_(record.ApplicantID || ""),
      First_Name: clean_(record.First_Name || ""),
      Last_Name: clean_(record.Last_Name || ""),
      Fee_Receipt_File: clean_(record.Fee_Receipt_File || "")
    };
  }

  var tSheet = nowMs_();
  writeBack_(sh, rowNum, updates);
  SpreadsheetApp.flush();
  var verifyRow = getRowObject_(sh, rowNum);
  logExecTrace_("UPLOAD_T_SHEET", dbg, {
    applicantId: clean_(record.ApplicantID || ""),
    field: key,
    ms: elapsedMs_(tSheet)
  });
  var verifyCell = clean_(verifyRow[key] || "");
  if (verifyCell.indexOf(fileUrl) < 0) throw new Error("Upload URL was not saved. Please try again.");

  log_(logSheet, "PORTAL_UPLOAD_OK", JSON.stringify({
    applicantId: clean_(record.ApplicantID || ""),
    fieldKey: key,
    fileId: clean_(res.fileId || ""),
    rowNumber: rowNum
  }));

  if (key === "Fee_Receipt_File") {
    try {
      maybeNotifyPaymentReceiptUploadTransition_(receiptBeforeRow || {}, verifyRow, rowNum, { source: "portalUploadFile_" });
    } catch (receiptAlertErr) {
      log_(logSheet, "PAYMENT_RECEIPT_ALERT_ERROR", String(receiptAlertErr && receiptAlertErr.message ? receiptAlertErr.message : receiptAlertErr));
    }
  }

  return {
    fileUrl: fileUrl,
    fileId: clean_(res.fileId || ""),
    rowNumber: rowNum,
    fieldKey: key,
    multiple: isMultiple,
    currentUrls: normalizeToUrlList_(verifyRow[key] || "")
  };
}

/******************** PORTAL B64 UPLOAD (student portal) ********************/
function portalUploadExt_(fileName) {
  var n = clean_(fileName || "").toLowerCase();
  var idx = n.lastIndexOf(".");
  if (idx < 0 || idx === n.length - 1) return "";
  return n.slice(idx + 1);
}

function sanitizePortalUploadFileName_(fileName, fieldName) {
  var raw = clean_(fileName || "");
  raw = raw.replace(/[\\\/:*?"<>|]+/g, "_");
  raw = raw.replace(/\s+/g, " ").trim();
  if (!raw) raw = clean_(fieldName || "upload") + ".bin";
  var ext = portalUploadExt_(raw);
  var base = raw;
  if (ext) base = raw.slice(0, -(ext.length + 1));
  base = safeFileName_(base || "upload");
  if (!base) base = "upload";
  if (base.length > 80) base = base.slice(0, 80);
  if (ext) {
    ext = ext.replace(/[^a-z0-9]/g, "");
    if (ext.length > 10) ext = ext.slice(0, 10);
    return ext ? (base + "." + ext) : base;
  }
  return base;
}

function isPortalUploadTypeAllowed_(mimeType, fileName) {
  var mime = clean_(mimeType || "").toLowerCase();
  var ext = portalUploadExt_(fileName);
  var mimeAllow = (CONFIG.PORTAL_ALLOWED_MIME || []).map(function (x) { return clean_(x).toLowerCase(); });
  var extAllow = (CONFIG.PORTAL_ALLOWED_EXT || []).map(function (x) { return clean_(x).toLowerCase(); });
  return (mime && mimeAllow.indexOf(mime) >= 0) || (ext && extAllow.indexOf(ext) >= 0);
}

function portalUploadBase64(data) {
  Logger.log("UPLOAD_B64_RPC_ENTER " + JSON.stringify({
    id: data && data.id,
    field: data && data.field,
    name: data && data.name,
    mime: data && data.mime,
    b64Len: data && data.base64 ? data.base64.length : 0
  }));
  return portalUpload_handleBase64_(data);
}

function portalUpload_handleBase64_(data) {
  var payload = (data && typeof data === "object") ? data : {};
  var dbg = makeDebugId_();
  var applicantId = clean_(payload.id || payload.applicantId || "");
  var secret = clean_(payload.s || payload.secret || "");
  var fieldName = clean_(payload.field || payload.docKey || "");
  var fileName = clean_(payload.name || "");
  var mimeType = clean_(payload.mime || payload.mimeType || "");
  var b64 = String(payload.base64 || payload.b64 || "");

  function fail_(code, message, extra) {
    var out = {
      ok: false,
      dbg: dbg,
      code: clean_(code || "UPLOAD_FAILED"),
      message: clean_(message || "Upload failed.")
    };
    if (extra && typeof extra === "object") {
      if (extra.field) out.field = clean_(extra.field);
      if (extra.fileUrl) out.fileUrl = clean_(extra.fileUrl);
    }
    logExecTrace_("UPLOAD_B64_FAIL", dbg, {
      dbg: dbg,
      code: out.code,
      field: fieldName,
      id: applicantId
    });
    return out;
  }

  logExecTrace_("UPLOAD_B64_ENTER", dbg, {
    dbg: dbg,
    id: applicantId,
    field: fieldName,
    name: fileName,
    mime: mimeType,
    b64Len: Number(b64.length || 0)
  });

  if (!applicantId || !secret || !fieldName || !fileName || !b64) {
    return fail_("BAD_REQUEST", "Missing upload fields.", { field: fieldName });
  }
  if (!isAllowedPortalUploadField_(fieldName) || !docMetaByField_(fieldName)) {
    return fail_("INVALID_FIELD", "Invalid document field.", { field: fieldName });
  }
  if (/^data:/i.test(b64) && b64.indexOf(",") >= 0) b64 = b64.split(",").slice(1).join(",");

  var bytes = [];
  try {
    bytes = Utilities.base64Decode(b64);
  } catch (_b64Err) {
    return fail_("BAD_BASE64", "Upload payload is invalid. Please retry.", { field: fieldName });
  }
  if (!bytes || !bytes.length) {
    return fail_("NO_FILE", "Please select a file.", { field: fieldName });
  }
  if (Number(bytes.length || 0) > Number(CONFIG.PORTAL_MAX_UPLOAD_BYTES || (5 * 1024 * 1024))) {
    return fail_("FILE_TOO_LARGE", "File too large (max 5 MB). Please compress and retry.", { field: fieldName });
  }
  if (!isPortalUploadTypeAllowed_(mimeType, fileName)) {
    return fail_("UNSUPPORTED_TYPE", "Unsupported file type. Use PDF/JPG/PNG (or DOC/DOCX if enabled).", { field: fieldName });
  }

  var ss = getWorkingSpreadsheet_();
  var sheet = mustGetDataSheet_(ss);
  var logSheet = mustGetSheet_(ss, CONFIG.LOG_SHEET);
  var found = findPortalRowByIdSecret_(sheet, applicantId, secret);
  if (!found) return fail_("TOKEN_INVALID", "Invalid or expired portal link token.", { field: fieldName });
  if (String(found.record[SCHEMA.PORTAL_ACCESS_STATUS] || "").trim() === "Locked") {
    return fail_("ACCESS_LOCKED", "Portal access is locked. Please contact admissions.", { field: fieldName });
  }
  if (isPortalLocked_(found.record)) {
    return fail_("ACCESS_LOCKED", "Portal access is locked. Please contact admissions.", { field: fieldName });
  }
  if (isPaymentFreezeActive_(found.record)) {
    return fail_("PAYMENT_FREEZE", "Uploads are disabled after payment verification.", { field: fieldName });
  }

  try {
    var safeName = sanitizePortalUploadFileName_(fileName, fieldName);
    var uploadRes = savePortalUpload_(applicantId, fieldName, safeName, mimeType || "application/octet-stream", bytes, {
      ss: ss,
      sheet: sheet,
      rowNumber: found.rowNum,
      rowObj: found.record,
      dbg: dbg
    });
    var applyRes = applyPortalUploadSheetUpdate_(sheet, found.rowNum, found.record, fieldName, uploadRes, {
      logSheet: logSheet,
      dbg: dbg
    });
    logExecTrace_("UPLOAD_B64_OK", dbg, {
      dbg: dbg,
      fileId: clean_(applyRes.fileId || uploadRes.fileId || "")
    });
    return {
      ok: true,
      dbg: dbg,
      field: fieldName,
      fileId: clean_(applyRes.fileId || uploadRes.fileId || ""),
      fileUrl: clean_(applyRes.fileUrl || uploadRes.fileUrl || ""),
      name: clean_(uploadRes.fileName || safeName),
      currentUrls: Array.isArray(applyRes.currentUrls) ? applyRes.currentUrls : []
    };
  } catch (e) {
    return fail_("UPLOAD_FAILED", clean_(stringifyGsError_(e) || "Upload failed."), { field: fieldName });
  }
}

/******************** DRIVE UPLOAD (called via google.script.run) ********************/
function uploadPortalFile(applicantId, secret, fieldName, fileName, mimeType, base64Data) {
  applicantId = clean_(applicantId);
  secret = clean_(secret);
  fieldName = clean_(fieldName);
  var fileNames = Array.isArray(fileName) ? fileName : [fileName];
  var mimeTypes = Array.isArray(mimeType) ? mimeType : [mimeType];
  var base64List = Array.isArray(base64Data) ? base64Data : [base64Data];
  var dbgId = newDebugId_();

  try {
    var ss = getWorkingSpreadsheet_();
    var sheet = mustGetDataSheet_(ss);
    var logSheet = mustGetSheet_(ss, CONFIG.LOG_SHEET);

    var found = findPortalRowByIdSecret_(sheet, applicantId, secret);
    if (!found) throw new Error("Record not found.");
    if (String(found.record[SCHEMA.PORTAL_ACCESS_STATUS] || "").trim() === "Locked") throw new Error("Access suspended.");
    if (isPortalLocked_(found.record)) throw new Error("Record locked.");

    var docMeta = docMetaByField_(fieldName);
    var isMultiple = !!(docMeta && docMeta.multiple === true);
    if (fileNames.length !== mimeTypes.length || fileNames.length !== base64List.length) {
      throw new Error("Upload payload mismatch.");
    }
    if (!fileNames.length) throw new Error("No files selected.");

    var folderUrl = clean_(found.record.Folder_Url || "");
    var folderId = folderIdFromUrl_(folderUrl);
    if (!folderId) throw new Error("Applicant folder missing. Please contact admissions.");
    var folder;
    try {
      folder = DriveApp.getFolderById(folderId);
      folder.getName();
    } catch (folderErr) {
      throw new Error("Applicant folder is unavailable or inaccessible.");
    }

    var createdUrls = [];
    try {
      for (var i = 0; i < fileNames.length; i++) {
        var fName = clean_(fileNames[i]) || ("upload_" + Date.now() + "_" + i);
        var fType = clean_(mimeTypes[i]) || "application/octet-stream";
        var b64 = String(base64List[i] || "");
        if (!b64) continue;
        var bytes = Utilities.base64Decode(b64);
        var blob = Utilities.newBlob(bytes, fType, fName);
        var file = folder.createFile(blob);
        createdUrls.push(file.getUrl());
      }
    } catch (driveErr) {
      throw new Error("Drive upload failed: " + String(driveErr && driveErr.message ? driveErr.message : driveErr));
    }
    if (!createdUrls.length) throw new Error("No valid files to upload.");

    var updates = {};
    var oldCell = clean_(found.record[fieldName] || "");
    if (isMultiple) {
      var merged = oldCell;
      for (var j = 0; j < createdUrls.length; j++) {
        merged = appendUrlToCell_(merged, createdUrls[j]);
      }
      updates[fieldName] = merged;
    } else {
      updates[fieldName] = createdUrls[createdUrls.length - 1];
    }
    updates.PortalLastUpdateAt = new Date().toISOString();
    if (!clean_(found.record.Portal_Submitted)) updates.Portal_Submitted = new Date().toISOString();

    // If status column exists, set PENDING_REVIEW
    if (docMeta && hasHeader_(sheet, docMeta.status)) updates[docMeta.status] = "PENDING_REVIEW";

    var fileLog = clean_(found.record.File_Log || "");
    for (var k = 0; k < createdUrls.length; k++) {
      var line = new Date().toISOString()
        + " | " + fieldName
        + " | " + (isMultiple ? "uploaded" : "replaced")
        + " | old=" + (oldCell || "-")
        + " | new=" + createdUrls[k];
      fileLog = appendLog_(fileLog, line);
    }
    updates.File_Log = fileLog;

    var receiptBeforeRow = null;
    if (fieldName === "Fee_Receipt_File") {
      receiptBeforeRow = {
        ApplicantID: clean_(found.record.ApplicantID || applicantId || ""),
        First_Name: clean_(found.record.First_Name || ""),
        Last_Name: clean_(found.record.Last_Name || ""),
        Fee_Receipt_File: clean_(found.record.Fee_Receipt_File || "")
      };
    }
    writeBack_(sheet, found.rowNum, updates);
    SpreadsheetApp.flush();
    var verifyRow = getRowObject_(sheet, found.rowNum);
    var verifyCell = clean_(verifyRow[fieldName] || "");
    var latestUrl = clean_(createdUrls[createdUrls.length - 1] || "");
    if (!latestUrl || verifyCell.indexOf(latestUrl) < 0) {
      throw new Error("Upload URL was not saved. Please try again.");
    }
    log_(logSheet, "PORTAL UPLOAD", "ApplicantID=" + applicantId + " field=" + fieldName + " files=" + createdUrls.length);
    if (fieldName === "Fee_Receipt_File") {
      try {
        maybeNotifyPaymentReceiptUploadTransition_(receiptBeforeRow || {}, verifyRow, found.rowNum, { source: "uploadPortalFile" });
      } catch (receiptUploadAlertErr) {
        log_(logSheet, "PAYMENT_RECEIPT_ALERT_ERROR", String(receiptUploadAlertErr && receiptUploadAlertErr.message ? receiptUploadAlertErr.message : receiptUploadAlertErr));
      }
    }

    return {
      ok: true,
      field: fieldName,
      url: createdUrls[createdUrls.length - 1],
      urls: createdUrls,
      multiple: isMultiple
    };
  } catch (e) {
    var msg = String(e && e.message ? e.message : e);
    var stack = String(e && e.stack ? e.stack : "");
    logPortalUploadError_(dbgId, applicantId, fieldName, msg, {
      code: "UPLOAD_FAILED",
      stack: stack,
      fileCount: fileNames.length,
      hasToken: !!(applicantId && secret)
    });
    return {
      ok: false,
      debugId: dbgId,
      field: fieldName,
      error: "Upload failed. Please try again. Debug: " + dbgId,
      redirectUrl: buildPortalRedirectUrl_(applicantId, secret, {
        error: true,
        dbg: dbgId,
        uploadFail: true,
        field: fieldName
      })
    };
  }
}

function portal_deleteUploadedFile(payload) {
  payload = payload || {};
  var applicantId = clean_(payload.applicantId || "");
  var secret = clean_(payload.secret || payload.s || "");
  var fieldName = clean_(payload.field || "");
  var targetUrl = clean_(payload.url || "");
  var rowNumber = Number(payload.rowNumber || 0);
  var dbgId = newDebugId_();

  if (!applicantId || !secret || !fieldName || !targetUrl) {
    return {
      ok: false,
      debugId: dbgId,
      error: "Missing delete payload fields",
      redirectUrl: buildPortalRedirectUrl_(applicantId, secret, { error: true, dbg: dbgId })
    };
  }

  var ss = getWorkingSpreadsheet_();
  var sheet = mustGetDataSheet_(ss);
  var logSheet = mustGetSheet_(ss, CONFIG.LOG_SHEET);
  var found = findPortalRowByIdSecret_(sheet, applicantId, secret);
  if (!found) return { ok: false, debugId: dbgId, error: "Record not found.", redirectUrl: buildPortalRedirectUrl_(applicantId, secret, { error: true, dbg: dbgId }) };
  if (rowNumber >= 2 && rowNumber !== found.rowNum) return { ok: false, debugId: dbgId, error: "Row mismatch.", redirectUrl: buildPortalRedirectUrl_(applicantId, secret, { error: true, dbg: dbgId }) };
  portalDebugLog_("PORTAL_DELETE_TARGET", {
    applicantId: applicantId,
    rowNumber: found.rowNum,
    fileField: fieldName,
    url: targetUrl
  });
  if (String(found.record[SCHEMA.PORTAL_ACCESS_STATUS] || "").trim() === "Locked") return { ok: false, debugId: dbgId, error: "Locked", redirectUrl: buildPortalRedirectUrl_(applicantId, secret, { error: true, dbg: dbgId }) };
  if (isPortalLocked_(found.record)) return { ok: false, debugId: dbgId, error: "Locked", redirectUrl: buildPortalRedirectUrl_(applicantId, secret, { error: true, dbg: dbgId }) };

  try {
    var docMeta = docMetaByField_(fieldName);
    if (!docMeta) return { ok: false, debugId: dbgId, error: "Invalid field.", redirectUrl: buildPortalRedirectUrl_(applicantId, secret, { error: true, dbg: dbgId }) };

    var existing = clean_(found.record[fieldName] || "");
    var updatedCell = removeUrlFromCell_(existing, targetUrl);
    var remainingUrls = normalizeToUrlList_(updatedCell);
    var removed = existing !== updatedCell;
    if (!removed) return { ok: false, debugId: dbgId, error: "File URL not found.", redirectUrl: buildPortalRedirectUrl_(applicantId, secret, { error: true, dbg: dbgId }) };

    var updates = {};
    updates[fieldName] = updatedCell;
    updates.PortalLastUpdateAt = new Date().toISOString();
    if (docMeta.status && hasHeader_(sheet, docMeta.status)) updates[docMeta.status] = "PENDING_REVIEW";
    var line = new Date().toISOString() + " | " + fieldName + ": DELETE " + targetUrl;
    updates.File_Log = appendLog_(clean_(found.record.File_Log || ""), line);
    writeBack_(sheet, found.rowNum, updates);

    var trashed = false;
    var warning = "";
    var fileId = extractDriveFileId_(targetUrl);
    if (fileId) {
      try {
        var file = DriveApp.getFileById(fileId);
        var folderId = folderIdFromUrl_(clean_(found.record.Folder_Url || ""));
        if (folderId && isFileInFolderChain_(file, folderId)) {
          file.setTrashed(true);
          trashed = true;
        } else {
          warning = "File not in applicant folder; URL removed only.";
        }
      } catch (e) {
        warning = "Could not trash file: " + (e && e.message ? e.message : String(e));
      }
    } else {
      warning = "Could not parse file id; URL removed only.";
    }

    portalDebugLog_("PORTAL_DELETE_RESULT", {
      applicantId: applicantId,
      rowNumber: found.rowNum,
      fileField: fieldName,
      removed: removed,
      trashed: trashed,
      warning: warning
    });
    log_(logSheet, "PORTAL_DOC_DELETE", "ApplicantID=" + applicantId + " field=" + fieldName + " trashed=" + trashed);
    return { ok: true, remainingUrls: remainingUrls, trashed: trashed, warning: warning };
  } catch (e2) {
    portalDebugLog_("PORTAL_DELETE_ERROR", {
      applicantId: applicantId,
      rowNumber: found.rowNum,
      fileField: fieldName,
      error: String(e2 && e2.message ? e2.message : e2)
    });
    return {
      ok: false,
      debugId: dbgId,
      error: String(e2 && e2.message ? e2.message : e2),
      redirectUrl: buildPortalRedirectUrl_(applicantId, secret, { error: true, dbg: dbgId })
    };
  }
}

/******************** PORTAL HTML ********************/
function portalVersionShort_(rawVersion) {
  var v = String(rawVersion || "");
  var tail = v.split("-").pop();
  if (/^r\d+$/i.test(tail)) return tail;
  var m = v.match(/-r(\d+)\b/i);
  return m ? ("r" + m[1]) : "r?";
}

function renderPortalHtml_(opts) {
  var id = opts.id, secret = opts.secret, record = opts.record;
  var reqId = clean_(opts.reqId || "");
  var debugPage = opts.debugPage === true;
  var saved = opts.saved === true;
  var hasErr = opts.errorFlag === true;
  var lockedFlag = opts.lockedFlag === true;
  var msgToken = clean_(opts.msgToken || "");
  var dbg = clean_(opts.dbg || "");
  var uploadFail = opts.uploadFail === true;
  var uploadField = clean_(opts.uploadField || "");
  var uploadResult = opts.uploadResult === true;
  var uploadOk = opts.uploadOk === true;
  var uploadDocKey = clean_(opts.uploadDocKey || "");
  var uploadErrCode = clean_(opts.uploadErrCode || "");
  var validationFlag = opts.validationFlag === true;
  var validationFields = Array.isArray(opts.validationFields) ? opts.validationFields : [];
  var validationCodes = Array.isArray(opts.validationCodes) ? opts.validationCodes : [];
  var subjects = opts.subjects || [];
  var examSites = opts.examSites || [];
  var editFields = opts.editFields || [];
  var docs = opts.docs || [];
  var visibleFields = opts.visibleFields || [];
  var subjectsLocked = opts.subjectsLocked === true;
  var error = opts.error || "";
  var milestoneStatus = computeOverallStatus_(record);
  var actionUrl = canonicalStudentExecBase_() + "?view=portal";
  var actionWarn = actionUrl ? "" : "Student URL not configured. Saving may not work for external users.";
  var scriptId = clean_(CONFIG.SCRIPT_ID || ScriptApp.getScriptId());
  var deploymentId = clean_(CONFIG.DEPLOYMENT_ID_STUDENT || "");
  var actionUrlShort = actionUrl.length > 140 ? (actionUrl.slice(0, 137) + "...") : actionUrl;
  var buildVersion = clean_(opts.version || CONFIG.VERSION || "");
  var shortVersion = clean_(opts.versionShort || portalVersionShort_(buildVersion));
  var buildRenderedAt = clean_(opts.buildRenderedAt || new Date().toISOString());
  var buildScriptId = clean_(opts.buildScriptId || scriptId || "");
  var buildLabel = clean_(CONFIG.BUILD_LABEL || "");
  var redactedSecret = redactToken_(secret);

  var locked = record._PortalLocked === true;
  var lockReason = clean_(record._PortalLockReason || "");
  var isPaymentVerifiedLock = locked && lockReason === "payment_verified";
  var dis = locked ? "disabled" : "";
  var subjectsDis = (locked || subjectsLocked) ? "disabled" : "";
  var ro = locked ? "readonly" : "";

  // subject selections: canonical preferred, else fallback
  var csv = clean_(record.Subjects_Selected_Canonical || record._SubjectsCsv || "");
  var selected = parseSubjects_(csv);

  var dobVal = esc_(toIsoDateInput_(record.Date_Of_Birth));

  var examVal = clean_(record.Physical_Exam_Site || "");
  var validationFieldSet = {};
  for (var vf = 0; vf < validationFields.length; vf++) validationFieldSet[validationFields[vf]] = true;
  var validationCodeSet = {};
  for (var vc = 0; vc < validationCodes.length; vc++) validationCodeSet[validationCodes[vc]] = true;
  var dobAttention = !!(validationFieldSet.Date_Of_Birth || validationCodeSet.DOB_REQUIRED || validationCodeSet.DOB_INVALID || (!dobVal && !locked));
  var dobMessage = validationCodeSet.DOB_REQUIRED
    ? "Date of Birth is required."
    : (validationCodeSet.DOB_INVALID
        ? "Enter a valid Date of Birth."
        : ((!dobVal && !locked) ? "Date of Birth is required to complete your application." : ""));
  var subjectsAttention = !!(validationFieldSet.Subjects_Selected_Canonical || validationCodeSet.SUBJECTS_REQUIRED || validationCodeSet.SUBJECTS_INVALID_FOR_GRADE || validationCodeSet.SUBJECT_LOCK_DOCS_VERIFIED);
  var subjectsMessage = validationCodeSet.SUBJECTS_REQUIRED
    ? "Select at least one subject."
    : ((validationCodeSet.SUBJECTS_INVALID_FOR_GRADE || validationCodeSet.SUBJECT_LOCK_DOCS_VERIFIED)
        ? portalValidationMessageForCode_(validationCodes[0] || "SUBJECTS_INVALID_FOR_GRADE")
        : "");
  var dobInputStyle = 'padding:8px;width:260px;' + (dobAttention ? 'border:2px solid #b30000;background:#fff7f7;' : '');
  var examInputStyle = 'padding:8px;width:520px;';
  var subjectsBoxStyle = 'margin-top:8px;padding:12px;border:' + (subjectsAttention ? '2px solid #b30000' : '1px solid #eee') + ';border-radius:10px;' + (subjectsAttention ? 'background:#fff7f7;' : '');

  // exam site options
  var examList = (examSites.length ? examSites : ["Port Moresby - HQ"]);
  var examOptions = "";
  for (var i = 0; i < examList.length; i++) {
    var s = examList[i];
    var sel = (s === examVal) ? "selected" : "";
    examOptions += '<option value="' + esc_(s) + '" ' + sel + ">" + esc_(s) + "</option>";
  }

  // subject checkboxes
  var subjectChecks = "";
  for (var j = 0; j < subjects.length; j++) {
    var subj = subjects[j];
    var checked = selected.has(subj.toLowerCase()) ? "checked" : "";
    subjectChecks += ''
      + '<label style="display:block;margin:6px 0;">'
      + '<input type="checkbox" name="subj" value="' + esc_(subj) + '" ' + checked + " " + subjectsDis + " /> "
      + esc_(subj)
      + "</label>";
  }
  var subjectsLockedNotice = subjectsLocked
    ? '<div style="margin-top:8px;padding:10px;border:1px solid #dbeafe;border-radius:8px;background:#eff6ff;color:#1e3a8a;font-size:13px;">Subjects are locked because your documents have been verified. Please contact administration for any changes.</div>'
    : "";

  var errorBlock = error
    ? '<div style="background:#ffecec;border:1px solid #ffb3b3;padding:12px;border-radius:10px;margin-bottom:16px;"><b>Action required:</b> ' + esc_(error) + "</div>"
    : "";

  var lockedMsg = (lockReason === "portal_access_locked")
    ? "Portal access is locked. Please contact admissions."
    : "Payment is verified. No further changes are needed.";
  var lockedBlock = locked
    ? '<div style="background:#e8f0ff;border:1px solid #b6ccff;padding:12px;border-radius:10px;margin-bottom:16px;"><b>' + (lockReason === "portal_access_locked" ? "Locked:" : "Locked for processing:") + '</b> ' + esc_(lockedMsg) + "</div>"
    : "";
  var enrollmentConfirmedBlock = (isPaymentVerifiedLock || (lockedFlag && msgToken === "enrolled" && locked))
    ? '<div style="background:#eaf7ea;border:1px solid #2e7d32;padding:12px;border-radius:10px;margin-bottom:16px;color:#000;"><b>Enrollment confirmed:</b> Your payment has been verified. Your application is now locked for processing. We will shortly provide you access to online studies.</div>'
    : "";
  var actionWarnBlock = actionWarn
    ? '<div style="background:#fff6e5;border:1px solid #f5c26b;padding:12px;border-radius:10px;margin-bottom:16px;"><b>Warning:</b> ' + esc_(actionWarn) + "</div>"
    : "";
  var savedBlock = saved
    ? '<div id="savedBanner" style="background:#eaf7ea;border:1px solid #2e7d32;padding:8px;margin-bottom:12px;color:#000;">Saved. Your updates are now shown below.</div>'
    : "";
  var errText = uploadFail
    ? ("Upload failed. Please try again." + (uploadField ? (" Field: " + uploadField + ".") : ""))
    : "Portal update failed.";
  var showErrorBanner = hasErr && !isPaymentVerifiedLock && !validationFlag;
  var errBlock = showErrorBanner
    ? '<div style="background:#ffecec;border:1px solid #b30000;padding:8px;margin-bottom:12px;color:#000;">' + esc_(errText) + (dbg ? (" Debug: " + esc_(dbg)) : "") + "</div>"
    : "";
  var validationSummaryBlock = validationFlag
    ? '<div style="background:#ffecec;border:1px solid #b30000;padding:10px;border-radius:8px;margin-bottom:12px;color:#000;"><b>Please correct the highlighted fields before submitting.</b></div>'
    : "";
  var uploadBannerId = "portalUploadResultBanner";
  var uploadResultBlock = "";
  if (uploadResult) {
    var uploadText = uploadOk
      ? ("Upload successful." + (dbg ? (" Debug: " + dbg) : ""))
      : ("Upload failed" + (uploadErrCode ? (" (" + uploadErrCode + ")") : "") + ". Please retry." + (dbg ? (" Debug: " + dbg) : ""));
    if (uploadDocKey) uploadText += " Field: " + uploadDocKey + ".";
    uploadResultBlock = ''
      + '<div id="' + uploadBannerId + '" style="'
      + (uploadOk
        ? 'background:#eaf7ea;border:1px solid #2e7d32;'
        : 'background:#ffecec;border:1px solid #b30000;')
      + 'padding:10px;border-radius:8px;margin:0 0 12px 0;color:#000;">'
      + '<span>' + esc_(uploadText) + '</span>'
      + '</div>';
  }
  var debugComment = debugPage
    ? '<!-- DEBUG_PORTAL_GET reqId=' + esc_(reqId) + ' id=' + esc_(id) + ' s(redacted)=' + esc_(redactedSecret) + ' -->'
    : "";
  var debugFooter = debugPage
    ? '<div id="debugPortalFooter" style="margin-top:10px;padding:8px;border:1px dashed #999;color:#000;font-size:12px;">'
      + "<div><b>DEBUG_PORTAL_RENDER</b></div>"
      + "<div>reqId: " + esc_(reqId) + "</div>"
      + "<div>applicantId: " + esc_(id) + "</div>"
      + "<div>form.action: " + esc_(actionUrl) + "</div>"
      + "<div>hidden id: " + esc_(id) + "</div>"
      + "<div>hidden s(redacted): " + esc_(redactedSecret) + "</div>"
      + "<div>form named elements count: <span id='dbgFormNameCount'>(loading...)</span></div>"
      + "<div>form field names (first 10): <span id='dbgFormNameList'>(loading...)</span></div>"
      + "<div>cleanup ran: <span id='dbgCleanupRan'>(loading...)</span></div>"
      + "<div>current URL (after cleanup): <span id='dbgHrefAfterCleanup'>(loading...)</span></div>"
      + "<div>window.location.href: <span id='dbgCurrentHref'>(loading...)</span></div>"
      + "</div>"
    : "";

  // allowlist-only summary
  var summaryHtml = renderAllowlistSummary_(record, visibleFields);

  // editable fields UI
  var extraInputs = renderEditableFields_(record, editFields, dis);

  // docs upload UI
  var docsHtml = renderDocsSection_(id, secret, record, docs, locked);

  var saveButton = locked
    ? '<div style="margin-top:12px;color:#1a4fb3;"><b>No action available.</b></div>'
    : '<button type="submit" style="padding:10px 16px;border:0;border-radius:10px;background:#1a73e8;color:#fff;">Save Updates</button>';

  return ''
    + '<!doctype html><html><head><meta charset="utf-8" />'
    + debugComment
    + '<!-- BUILD: ' + esc_(buildVersion) + " | " + esc_(buildLabel) + " -->"
    + "<title>FODE Student Portal</title>"
    + '<base target="_top" />'
    + '<meta name="viewport" content="width=device-width, initial-scale=1" />'
    + '<meta http-equiv="Cache-Control" content="no-store, no-cache, must-revalidate, max-age=0" />'
    + '<meta http-equiv="Pragma" content="no-cache" />'
    + '<meta http-equiv="Expires" content="0" />'
    + "<style>"
    + ".milestone{padding:12px;margin-bottom:16px;border-radius:6px;font-size:14px;}"
    + ".docs-stage{background:#1f2937;color:#fbbf24;}"
    + ".payment-stage{background:#064e3b;color:#34d399;}"
    + ".pending-stage{background:#1e3a8a;color:#93c5fd;}"
    + "</style>"
    + "</head>"
    + '<body style="font-family:Arial,Helvetica,sans-serif;max-width:980px;margin:24px auto;padding:0 16px;">'
    + '<div style="position:fixed;top:10px;right:12px;z-index:9;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;color:#0f172a;background:#dbeafe;border:1px solid #93c5fd;" title="' + esc_(buildVersion) + '">' + esc_(shortVersion) + "</div>"
    + "<h2>FODE Student Portal</h2>"
    + '<div id="portalFlashMount"></div>'
    + '<div id="portalErrorBanner" style="display:none;background:#ffecec;border:1px solid #b30000;padding:10px;border-radius:8px;margin-bottom:12px;color:#000;"></div>'
    + savedBlock
    + errBlock
    + validationSummaryBlock
    + enrollmentConfirmedBlock
    + '<div style="padding:12px;border:1px solid #ddd;border-radius:10px;margin-bottom:16px;">'
    + "<div><b>Applicant ID:</b> " + esc_(id) + "</div>"
    + "<div><b>Secure Link:</b> verified</div>"
    + '<div style="margin-top:6px;color:#555;font-size:12px;" title="Script ID: ' + esc_(buildScriptId) + '">Build: ' + esc_(buildVersion) + ' | Rendered: ' + esc_(buildRenderedAt) + '</div>'
    + "</div>"
    + lockedBlock
    + errorBlock
    + actionWarnBlock

    + '<div style="padding:12px;border:1px solid #ddd;border-radius:10px;margin-bottom:16px;">'
    + '<h3 style="margin-top:0;">Submitted Details (read-only)</h3>'
    + summaryHtml
    + "</div>"

    + '<div id="milestoneBanner" class="milestone pending-stage">Your application is under review.</div>'

    + '<div style="padding:12px;border:1px solid #ddd;border-radius:10px;margin-bottom:16px;">'
    + '<h3 style="margin-top:0;">Documents & Payment Proof</h3>'
    + uploadResultBlock
    + docsHtml
    + "</div>"

    // ??????????????????????????????????? hardcoded action URL to prevent blank screen / doPost not firing
    + '<form id="portalForm" method="post" target="_top" action="' + esc_(actionUrl) + '" onsubmit="return beforePortalSubmit(event,this);"'
    + ' style="padding:12px;border:1px solid #ddd;border-radius:10px;">'
    + '<input type="hidden" name="action" value="portal_update" />'
    + '<input type="hidden" name="route" value="portal_update" />'
    + '<input type="hidden" name="id" value="' + esc_(id) + '" />'
    + '<input type="hidden" name="s" value="' + esc_(secret) + '" />'
    + (CONFIG.DEBUG_PORTAL_POST === true ? '<input type="hidden" name="dbg" value="1" />' : "")
    + '<input type="hidden" id="portal_payload" name="payload" value="" />'
    + '<input type="hidden" id="Subjects_Selected_Canonical" name="Subjects_Selected_Canonical" value="" />'

    + '<h3 style="margin-top:0;">Update / Confirm Information</h3>'

    + '<div style="margin:12px 0;">'
    + "<label for=\"portalDobInput\"><b>Date of Birth <span style=\"color:#b30000;\">*</span></b></label><br/>"
    + '<input id="portalDobInput" type="date" name="Date_Of_Birth" value="' + dobVal + '" style="' + dobInputStyle + '" ' + ro + " />"
    + '<div id="portalDobError" style="margin-top:6px;color:#b30000;display:' + (dobMessage ? 'block' : 'none') + ';">' + esc_(dobMessage) + '</div>'
    + "</div>"

    + '<div style="margin:12px 0;">'
    + "<label><b>Physical Exam Site (optional):</b></label><br/>"
    + '<select name="Physical_Exam_Site" style="' + examInputStyle + '" ' + dis + ">"
    + '<option value="">-- Select Exam Site --</option>'
    + examOptions
    + "</select>"
    + (locked ? ('<input type="hidden" name="Physical_Exam_Site" value="' + esc_(examVal) + '" />') : "")
    + "</div>"

    + '<div style="margin:12px 0;">'
    + "<label><b>Select Subjects <span style=\"color:#b30000;\">*</span></b></label>"
    + '<div id="portalSubjectsBox" style="' + subjectsBoxStyle + '">'
    + subjectChecks
    + subjectsLockedNotice
    + '</div>'
    + '<div id="portalSubjectsError" style="margin-top:6px;color:#b30000;display:' + (subjectsMessage ? 'block' : 'none') + ';">' + esc_(subjectsMessage) + '</div>'
    + "</div>"

    + (editFields.length ? ('<div style="margin:12px 0;">'
      + "<h4 style='margin:8px 0;'>Additional Editable Fields</h4>"
      + extraInputs
      + "</div>") : "")

    + saveButton
    + "</form>"
    + debugFooter
    + '<div class="footer-version" id="studentVersion" style="margin-top:16px;color:#666;font-size:12px;" title="Script ID: ' + esc_(buildScriptId) + '"></div>'
    + '<div style="margin-top:8px;color:#000;">Script ID: ' + esc_(scriptId) + " | Deployment: " + esc_(deploymentId || "-") + " | View: portal</div>"
    + '<div style="margin-top:8px;color:#666;font-size:12px;">URL: ' + esc_(actionUrlShort) + "</div>"

    + "<script>"
    + "console.log('PORTAL BUILD: ' + " + JSON.stringify(buildVersion) + ");"
    + "function packSubjects(){"
    + "var boxes=[].slice.call(document.querySelectorAll('input[name=\"subj\"]:checked'));"
    + "var vals=boxes.map(function(b){return b.value;}).filter(Boolean);"
    + "document.getElementById('Subjects_Selected_Canonical').value=vals.join(', ');"
    + "return vals.length>0;}"
    + "function setPortalFieldMessage_(field,msg){"
    + "var el=null;"
    + "if(field==='Date_Of_Birth') el=document.getElementById('portalDobError');"
    + "else if(field==='Subjects_Selected_Canonical') el=document.getElementById('portalSubjectsError');"
    + "if(!el) return;"
    + "var text=String(msg||'').trim();"
    + "el.textContent=text;"
    + "el.style.display=text?'block':'none';"
    + "}"
    + "function markPortalFieldInvalid_(field){"
    + "if(field==='Date_Of_Birth'){ var dob=document.getElementById('portalDobInput'); if(dob){ dob.style.border='2px solid #b30000'; dob.style.background='#fff7f7'; } return; }"
    + "if(field==='Subjects_Selected_Canonical'){ var box=document.getElementById('portalSubjectsBox'); if(box){ box.style.border='2px solid #b30000'; box.style.background='#fff7f7'; } return; }"
    + "var form=document.getElementById('portalForm');"
    + "if(!form) return;"
    + "var nodes=form.querySelectorAll('[name=\"'+field+'\"]');"
    + "[].slice.call(nodes).forEach(function(node){ if(node){ node.style.border='2px solid #b30000'; node.style.background='#fff7f7'; } });"
    + "}"
    + "function applyPortalValidationState_(){"
    + "var fields=" + JSON.stringify(validationFields) + ";"
    + "var codes=" + JSON.stringify(validationCodes) + ";"
    + "fields.forEach(function(field){ markPortalFieldInvalid_(field); });"
    + "if(codes.indexOf('DOB_REQUIRED')>=0) setPortalFieldMessage_('Date_Of_Birth','Date of Birth is required.');"
    + "else if(codes.indexOf('DOB_INVALID')>=0) setPortalFieldMessage_('Date_Of_Birth','Enter a valid Date of Birth.');"
    + "if(codes.indexOf('SUBJECTS_REQUIRED')>=0) setPortalFieldMessage_('Subjects_Selected_Canonical','Select at least one subject.');"
    + "else if(codes.indexOf('SUBJECTS_INVALID_FOR_GRADE')>=0) setPortalFieldMessage_('Subjects_Selected_Canonical','Selected subjects are not valid for the chosen grade.');"
    + "else if(codes.indexOf('SUBJECT_LOCK_DOCS_VERIFIED')>=0) setPortalFieldMessage_('Subjects_Selected_Canonical','Subjects are locked because documents have been verified by Admin.');"
    + "}"
    + "function ensurePortalFormSerialization(form){"
    + "if(!form) return;"
    + "var oldClones=[].slice.call(form.querySelectorAll('input[data-portal-clone=\"1\"]'));"
    + "oldClones.forEach(function(n){ if(n && n.parentNode) n.parentNode.removeChild(n); });"
    + "var fd=new FormData(form);"
    + "var els=[].slice.call(form.querySelectorAll('input[name],select[name],textarea[name]'));"
    + "els.forEach(function(el){"
    + "  if(!el || !el.name || el.disabled) return;"
    + "  var type=(el.type||'').toLowerCase();"
    + "  if((type==='checkbox' || type==='radio') && !el.checked) return;"
    + "  if(fd.has(el.name)) return;"
    + "  var hidden=document.createElement('input');"
    + "  hidden.type='hidden';"
    + "  hidden.name=el.name;"
    + "  hidden.value=(el.value===undefined || el.value===null)?'':String(el.value);"
    + "  hidden.setAttribute('data-portal-clone','1');"
    + "  form.appendChild(hidden);"
    + "});"
    + "}"
    + "function beforePortalSubmit(evt,form){"
    + "clearPortalError_();"
    + "setPortalFieldMessage_('Date_Of_Birth','');"
    + "setPortalFieldMessage_('Subjects_Selected_Canonical','');"
    + "if(!packSubjects()){"
    + "setPortalError_('Please correct the highlighted fields before submitting.');"
    + "setPortalFieldMessage_('Subjects_Selected_Canonical','Select at least one subject.');"
    + "markPortalFieldInvalid_('Subjects_Selected_Canonical');"
    + "return false;}"
    + "var dobInput=document.getElementById('portalDobInput');"
    + "var dobValue=dobInput?String(dobInput.value||'').trim():'';"
    + "if(!dobValue){"
    + "setPortalError_('Please correct the highlighted fields before submitting.');"
    + "setPortalFieldMessage_('Date_Of_Birth','Date of Birth is required.');"
    + "markPortalFieldInvalid_('Date_Of_Birth');"
    + "if(dobInput && typeof dobInput.focus==='function') dobInput.focus();"
    + "return false;}"
    + "ensurePortalFormSerialization(form);"
    + "var fd=new FormData(form);"
    + "var obj={};"
    + "fd.forEach(function(v,k){"
    + "  if(k==='payload' || k==='subj') return;"
    + "  if(Object.prototype.hasOwnProperty.call(obj,k)){"
    + "    if(Array.isArray(obj[k])) obj[k].push(v);"
    + "    else obj[k]=[obj[k],v];"
    + "  } else obj[k]=v;"
    + "});"
    + "var p=document.getElementById('portal_payload');"
    + "if(p) p.value=JSON.stringify(obj);"
    + "var submitBtn=form && form.querySelector ? form.querySelector('button[type=\"submit\"]') : null;"
    + "if(submitBtn) submitBtn.disabled=true;"
    + "return true;"
    + "}"
    + "function escText(v){"
    + "return String(v===undefined||v===null?'':v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\\"/g,'&quot;').replace(/'/g,'&#039;');"
    + "}"
    + "function renderPortalFlash(type,dbg,mode,field){"
    + "var mount=document.getElementById('portalFlashMount');"
    + "if(!mount) return;"
    + "if(type==='success'){"
    + "mount.innerHTML='<div id=\"portalFlashBanner\" style=\"background:#eaf7ea;border:1px solid #2e7d32;padding:8px;margin-bottom:12px;color:#000;\">Saved. Your updates are now shown below.</div>';"
    + "return;"
    + "}"
    + "if(type==='error'){"
    + "var text=(mode==='upload')?'Upload failed. Please try again.'+((field&&String(field).trim())?(' Field: '+escText(field)+'.'):''):'Portal update failed.';"
    + "var d=dbg?(' Debug: '+escText(dbg)):'';"
    + "mount.innerHTML='<div id=\"portalFlashBanner\" style=\"background:#ffecec;border:1px solid #b30000;padding:8px;margin-bottom:12px;color:#000;\">'+text+d+'</div>';"
    + "}"
    + "}"
    + "function initPortalFlashAndCleanup(){"
    + "var cleanupRan=false;"
    + "var hasSaved=false;"
    + "var hasError=false;"
    + "try{"
    + "var url=new URL(window.location.href);"
    + "var params=url.searchParams;"
    + "hasSaved=(params.get('saved')==='1');"
    + "hasError=(params.get('error')==='1');"
    + "var dbgQ=params.get('dbg')||'';"
    + "var uploadFailQ=(params.get('uploadFail')==='1');"
    + "var fieldQ=params.get('field')||'';"
    + "if(hasSaved){ sessionStorage.setItem('portalFlash', JSON.stringify({type:'success',ts:Date.now()})); }"
    + "var validationQ=(params.get('val')==='1');"
    + "if(hasError && !validationQ){ sessionStorage.setItem('portalFlash', JSON.stringify({type:'error',dbg:dbgQ,mode:(uploadFailQ?'upload':'update'),field:fieldQ,ts:Date.now()})); }"
    + "if(params.get('u')==='1'){"
    + "params.delete('u');"
    + "params.delete('ok');"
    + "params.delete('docKey');"
    + "params.delete('errCode');"
    + "}"
    + "if(params.has('id') || params.has('s')){"
    + "params.delete('id');"
    + "params.delete('s');"
    + "var q=params.toString();"
    + "var newUrl=url.pathname + (q?('?'+q):'') + url.hash;"
    + "history.replaceState(null,'',newUrl);"
    + "cleanupRan=true;"
    + "}"
    + "}catch(e){}"
    + "if(!hasSaved && !hasError){"
    + "try{"
    + "var raw=sessionStorage.getItem('portalFlash');"
    + "if(raw){"
    + "var flash=JSON.parse(raw);"
    + "var age=Date.now()-Number((flash&&flash.ts)||0);"
    + "if(age>=0 && age<=120000){"
    + "renderPortalFlash(String(flash.type||''), String((flash&&flash.dbg)||''), String((flash&&flash.mode)||''), String((flash&&flash.field)||''));"
    + "}"
    + "sessionStorage.removeItem('portalFlash');"
    + "}"
    + "}catch(e2){"
    + "try{sessionStorage.removeItem('portalFlash');}catch(e3){}"
    + "}"
    + "}"
    + "var dbgCleanupEl=document.getElementById('dbgCleanupRan'); if(dbgCleanupEl){ dbgCleanupEl.textContent=cleanupRan ? 'true' : 'false'; }"
    + "var dbgAfterEl=document.getElementById('dbgHrefAfterCleanup'); if(dbgAfterEl){ dbgAfterEl.textContent=window.location.href; }"
    + "var dbgHrefEl=document.getElementById('dbgCurrentHref'); if(dbgHrefEl){ dbgHrefEl.textContent=window.location.href; }"
    + "var uploadBanner=document.getElementById('portalUploadResultBanner');"
    + "if(uploadBanner){ setTimeout(function(){ try{ uploadBanner.style.display='none'; }catch(_e){} },10000); }"
    + "}"
    + "function initStudentVersionFooter(){"
    + "var full=" + JSON.stringify(buildVersion) + ";"
    + "var shortV=" + JSON.stringify(shortVersion) + ";"
    + "var el=document.getElementById('studentVersion');"
    + "if(el){ el.textContent='Version ' + shortV + ' | Rendered ' + " + JSON.stringify(buildRenderedAt) + "; el.title=full; }"
    + "}"
    + "function renderMilestone(status){"
    + "var el=document.getElementById('milestoneBanner');"
    + "if(!el) return;"
    + "if(status==='Docs_Verified'){"
    + "el.innerHTML='<strong>Documents Verified.</strong><br>Your documents have been verified. Please allow 10-15 working days after payment confirmation for login access.';"
    + "el.className='milestone docs-stage';"
    + "} else if(status==='Verified'){"
    + "el.innerHTML='<strong>Payment Confirmed.</strong><br>Your admission is confirmed. Login credentials will be issued within 10-15 working days.';"
    + "el.className='milestone payment-stage';"
    + "} else {"
    + "el.innerHTML='Your application is under review.';"
    + "el.className='milestone pending-stage';"
    + "}"
    + "}"
    + "function initPortalPage(){"
    + "initPortalFlashAndCleanup();"
    + "applyPortalValidationState_();"
    + "initStudentVersionFooter();"
    + "renderMilestone(" + JSON.stringify(milestoneStatus) + ");"
    + "}"
    + "if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', initPortalPage); } else { initPortalPage(); }"
    + "setTimeout(function(){var b=document.getElementById('savedBanner');if(b){b.style.display='none';}},5000);"
    + "var dbgForm=document.getElementById('portalForm');"
    + "if(dbgForm){"
    + "  var named=[].slice.call(dbgForm.querySelectorAll('[name]'));"
    + "  var c=document.getElementById('dbgFormNameCount');"
    + "  var l=document.getElementById('dbgFormNameList');"
    + "  if(c) c.textContent=String(named.length);"
    + "  if(l) l.textContent=named.map(function(n){return n.name;}).slice(0,10).join(', ');"
    + "}"
    + "</script>"

    + "</body></html>";
}

function renderDocsSection_(id, secret, record, docs, locked) {
  var out = "";
  var portalReloadUrl = buildPortalRedirectUrl_(id, secret, {});
  var execUrl = clean_(typeof getExecUrl_ === "function" ? getExecUrl_() : "");
  if (!execUrl) execUrl = clean_(canonicalStudentExecBase_() || "");
  var uploadAction = execUrl ? (execUrl + (execUrl.indexOf("?") >= 0 ? "&" : "?") + "view=portalUpload") : "?view=portalUpload";
  for (var i = 0; i < docs.length; i++) {
    var d = docs[i];
    var cur = clean_(record[d.field] || "");
    var st = mapDocStatusForDisplay_(record[d.status]);
    var cm = clean_(record[d.comment] || "");

    var stBadge = "<b>Status:</b> " + esc_(st || "Pending Review");
    var cmBlock = cm ? ("<div style='margin-top:6px;'><b>Admin comment:</b> " + esc_(cm) + "</div>") : "";

    var urlList = normalizeToUrlList_(cur);
    var secureOpenUrl = buildTokenGatedFileUrl_(execUrl, id, secret, d.field, "open");
    var secureDownloadUrl = buildTokenGatedFileUrl_(execUrl, id, secret, d.field, "download");
    Logger.log("PORTAL_DOC_LINK " + JSON.stringify({
      applicantId: clean_(id || ""),
      field: clean_(d.field || ""),
      hasValidUrl: urlList.length > 0,
      urlCount: urlList.length
    }));
    var curLinks = "";
    if (urlList.length) {
      var deleteControls = [];
      for (var u = 0; u < urlList.length; u++) {
        var delBtn = (!locked)
          ? " <button type='button' onclick=\"deleteDocUrl('" + esc_(d.field) + "','" + esc_(encodeURIComponent(urlList[u])) + "')\">Delete " + String(u + 1) + "</button>"
          : "";
        if (delBtn) deleteControls.push(delBtn);
      }
      curLinks = "<div style='margin-top:6px;'>"
        + "<b>Current files:</b> " + String(urlList.length) + " uploaded."
        + (secureOpenUrl ? (" <a href='" + esc_(secureOpenUrl) + "' target='_blank' rel='noopener noreferrer'>Open</a>") : "")
        + (secureDownloadUrl ? (" | <a href='" + esc_(secureDownloadUrl) + "' target='_blank' rel='noopener noreferrer'>Download</a>") : "")
        + (deleteControls.length ? ("<div style='margin-top:6px;'>" + deleteControls.join(" ") + "</div>") : "")
        + "</div>";
    } else {
      curLinks = "<div style='margin-top:6px;'><b>Current files:</b> Not uploaded</div>";
    }
    var multipleAttr = d.multiple ? " multiple" : "";
    var multiBadge = d.multiple ? "<div class='muted' style='font-size:12px;margin-top:4px;'>Upload one file at a time (multi-file upload temporarily disabled).</div>" : "";
    var noteHtml = "";

    var uploadUi = locked
      ? "<div style='margin-top:10px;color:#666;'><i>Uploads disabled (locked).</i></div>"
      : "<div style='margin-top:10px;'>"
        + "<div id='uf_" + esc_(d.field) + "' style='margin:0;'>"
        + "<input type='hidden' name='dbg' id='dbg_" + esc_(d.field) + "' value='' />"
        + "<input type='file' name='file' required id='f_" + esc_(d.field) + "' data-upload-input='1' data-field='" + esc_(d.field) + "' data-multi='" + (d.multiple ? "1" : "0") + "' /> "
        + "<button type='button' id='btn_" + esc_(d.field) + "' data-upload-btn='1' data-field='" + esc_(d.field) + "'>Upload / Replace</button>"
        + "</div>"
        + noteHtml
        + "<div id='cur_" + esc_(d.field) + "' style='margin-top:6px;font-size:12px;'>" + curLinks + "</div>"
        + "<div id='msg_" + esc_(d.field) + "' style='margin-top:6px;font-size:12px;'></div>"
        + "<div id='ust_" + esc_(d.field) + "' style='margin-top:6px;padding:8px;border:1px solid #e5e7eb;border-radius:8px;background:#f8fafc;font-size:11px;'>"
        + "<div><b>Upload Status:</b> <span id='ust_text_" + esc_(d.field) + "'>Idle</span></div>"
        + "<div>dbg: <span id='ust_dbg_" + esc_(d.field) + "'>-</span></div>"
        + "<div>stage: <span id='ust_stage_" + esc_(d.field) + "'>-</span></div>"
        + "<div>errCode: <span id='ust_err_" + esc_(d.field) + "'>-</span></div>"
        + "<div>driveMode: <span id='ust_mode_" + esc_(d.field) + "'>-</span></div>"
        + "<div>serverMs: <span id='ust_ms_" + esc_(d.field) + "'>-</span></div>"
        + "<div>fileUrl: <span id='ust_url_" + esc_(d.field) + "'>-</span></div>"
        + "</div>"
        + multiBadge
        + "</div>";

    out += ""
      + "<div style='padding:10px;border:1px solid #eee;border-radius:10px;margin:10px 0;'>"
      + "<div><b>" + esc_(d.label) + "</b></div>"
      + "<div id='st_" + esc_(d.field) + "' style='margin-top:6px;'>" + stBadge + "</div>"
      + cmBlock
      + curLinks
      + uploadUi
      + "</div>";
  }

  // uploader script
  out += ""
    + "<script>"
    + "var PORTAL_AUTO_UPLOAD=false;"
    + "var PORTAL_LOCKED=" + (locked ? "true" : "false") + ";"
    + "var PORTAL_UPLOAD_MAX_MB=" + String(Number(CONFIG.PORTAL_UPLOAD_MAX_MB || 5)) + ";"
    + "var PORTAL_MAX_UPLOAD_BYTES=" + String(Number(CONFIG.PORTAL_MAX_UPLOAD_BYTES || (5*1024*1024))) + ";"
    + "var PORTAL_UPLOAD_MAX_SERVER_MS=" + String(Number(CONFIG.PORTAL_UPLOAD_MAX_SERVER_MS || 20000)) + ";"
    + "var PORTAL_UPLOAD_TIMEOUT_MS=" + String(Number(CONFIG.PORTAL_UPLOAD_TIMEOUT_MS || 25000)) + ";"
    + "var PORTAL_UPLOAD_ID=" + JSON.stringify(clean_(id || "")) + ";"
    + "var PORTAL_UPLOAD_S=" + JSON.stringify(clean_(secret || "")) + ";"
    + "var DOC_MULTI_MAP={"
    + (docs || []).map(function (x) { return "'" + esc_(x.field) + "':" + (x.multiple ? "true" : "false"); }).join(",")
    + "};"
    + "var PORTAL_UPLOAD_PENDING={};"
    + "function escHtml(s){return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/\\\"/g,'&quot;').replace(/'/g,'&#039;');}"
    + "function makeClientDebugId_(){"
    + "  var ts='';"
    + "  try{ ts=new Date().toISOString().replace(/[-:.TZ]/g,'').slice(0,14); }catch(e){ ts=String(Date.now()); }"
    + "  return 'CDBG-'+ts+'-'+Math.random().toString(16).slice(2,10);"
    + "}"
    + "function stringifyGsError_(err){"
    + "  if(err===null || err===undefined) return 'Unknown error';"
    + "  if(typeof err==='string') return err;"
    + "  if(err && typeof err.message==='string' && err.message) return err.message;"
    + "  try{return JSON.stringify(err);}catch(e){}"
    + "  try{return String(err);}catch(e2){}"
    + "  return 'Unknown error';"
    + "}"
    + "function setPortalError_(msg){"
    + "  var el=document.getElementById('portalErrorBanner');"
    + "  if(!el) return;"
    + "  var t=String(msg||'').trim();"
    + "  if(!t){ el.style.display='none'; el.textContent=''; return; }"
    + "  el.textContent=t;"
    + "  el.style.display='block';"
    + "}"
    + "function clearPortalError_(){ setPortalError_(''); }"
    + "function getPortalTokens_(){"
    + "  var q=new URLSearchParams(window.location.search||'');"
    + "  var id=(q.get('id')||'').trim();"
    + "  var s=(q.get('s')||'').trim();"
    + "  if((!id || !s)){"
    + "    var form=document.getElementById('portalForm');"
    + "    if(form){"
    + "      var idEl=form.querySelector('input[name=\"id\"]');"
    + "      var sEl=form.querySelector('input[name=\"s\"]');"
    + "      if(!id && idEl) id=String(idEl.value||'').trim();"
    + "      if(!s && sEl) s=String(sEl.value||'').trim();"
    + "    }"
    + "  }"
    + "  if(!id || !s){"
    + "    setPortalError_('Missing portal link token. Please reopen your portal link.');"
    + "    return null;"
    + "  }"
    + "  return {id:id,s:s};"
    + "}"
    + "function setRowMsg(fieldName, txt, isErr){"
    + "  var msg=document.getElementById('msg_'+fieldName);"
    + "  if(!msg) return;"
    + "  msg.style.color=isErr ? '#b30000' : '';"
    + "  msg.innerHTML=txt||'';"
    + "}"
    + "function setUploadStatusPanel_(fieldName, info){"
    + "  var x=info||{};"
    + "  function set_(id,val,isLink){"
    + "    var el=document.getElementById(id+'_'+fieldName);"
    + "    if(!el) return;"
    + "    var v=(val===undefined||val===null||val==='')?'-':String(val);"
    + "    if(isLink && v && v!=='-'){ el.innerHTML='<a target=\"_blank\" href=\"'+escHtml(v)+'\">'+escHtml(v)+'</a>'; }"
    + "    else { el.textContent=v; }"
    + "  }"
    + "  set_('ust_text', x.text||'');"
    + "  set_('ust_dbg', x.dbg||'');"
    + "  set_('ust_stage', x.stage||'');"
    + "  set_('ust_err', x.errCode||'');"
    + "  set_('ust_mode', x.driveMode||'');"
    + "  set_('ust_ms', x.serverMs!==undefined&&x.serverMs!==null ? String(x.serverMs) : '');"
    + "  set_('ust_url', x.fileUrl||'', true);"
    + "}"
    + "function setUploadUiError_(fieldName, txt, meta){"
    + "  var m=meta||{};"
    + "  setPortalError_(txt);"
    + "  setRowMsg(fieldName, txt, true);"
    + "  setUploadStatusPanel_(fieldName, { text:'Error', dbg:m.dbg||'', stage:m.stage||'', errCode:m.errCode||'', driveMode:m.driveMode||'', serverMs:m.serverMs, fileUrl:m.fileUrl||'' });"
    + "}"
    + "function setUploadUiSuccess_(fieldName, txt, meta){"
    + "  var m=meta||{};"
    + "  clearPortalError_();"
    + "  setRowMsg(fieldName, txt, false);"
    + "  setUploadStatusPanel_(fieldName, { text:'Uploaded', dbg:m.dbg||'', stage:m.stage||'done', errCode:m.errCode||'', driveMode:m.driveMode||'', serverMs:m.serverMs, fileUrl:m.fileUrl||'' });"
    + "}"
    + "function markDocStatusPendingReviewUi_(fieldName){"
    + "  var el=document.getElementById('st_'+fieldName);"
    + "  if(el) el.innerHTML='<b>Status:</b> Pending Review';"
    + "}"
    + "function setUploadBusy(fieldName,busy){"
    + "  var input=document.getElementById('f_'+fieldName);"
    + "  var btn=document.getElementById('btn_'+fieldName);"
    + "  if(input) input.disabled=!!busy;"
    + "  if(btn) btn.disabled=!!busy;"
    + "}"
    + "function getCurrentUrlsFromDom(fieldName){"
    + "  var links=[].slice.call(document.querySelectorAll('#cur_'+fieldName+' a'));"
    + "  return links.map(function(a){return a.getAttribute('href');}).filter(Boolean);"
    + "}"
    + "function renderCurrentUrls(fieldName, urls){"
    + "  var box=document.getElementById('cur_'+fieldName);"
    + "  if(!box) return;"
    + "  if(!urls || !urls.length){ box.innerHTML='<b>Current files:</b> Not uploaded'; return; }"
    + "  var parts=urls.map(function(u,i){"
    + "    var line='<a href=\"'+escHtml(u)+'\" target=\"_blank\" rel=\"noopener noreferrer\">Open '+(i+1)+'</a>';"
    + "    if(!PORTAL_LOCKED){ line += ' <button type=\"button\" onclick=\"deleteDocUrl(\\''+fieldName+'\\',\\''+encodeURIComponent(u)+'\\')\">Delete</button>'; }"
    + "    return line;"
    + "  });"
    + "  box.innerHTML='<b>Current files:</b><br/>'+parts.join('<br/>');"
    + "}"
    + "function onDocFileChange(fieldName, isMultiple){"
    + "  var input=document.getElementById('f_'+fieldName);"
    + "  var btn=document.getElementById('btn_'+fieldName);"
    + "  if(!input){ return; }"
    + "  var files=[].slice.call(input.files||[]);"
    + "  if(!files.length){ if(btn) btn.disabled=false; setRowMsg(fieldName,'Select a file first.',true); return; }"
    + "  if(!isMultiple) files=[files[0]];"
    + "  var tooBig=files.some(function(f){ return Number(f && f.size || 0) > Math.max(1,Number(PORTAL_MAX_UPLOAD_BYTES||0)); });"
    + "  if(tooBig){ if(btn) btn.disabled=false; setUploadUiError_(fieldName,'File too large. Maximum '+String(Math.round((Number(PORTAL_MAX_UPLOAD_BYTES||0)/(1024*1024))||5))+' MB allowed.',{errCode:'FILE_TOO_LARGE',stage:'validate'}); return; }"
    + "  var names=files.map(function(f){ return f.name; }).join(', ');"
    + "  clearPortalError_();"
    + "  setRowMsg(fieldName,'Selected: '+escHtml(names),false);"
    + "  setUploadStatusPanel_(fieldName,{text:'Ready',stage:'validate',driveMode:'B64'});"
    + "  if(btn) btn.disabled=false;"
    + "  setRowMsg(fieldName,'Selected: '+escHtml(names)+'<br/>Click Upload / Replace to submit.',false);"
    + "}"
    + "function uploadFile(fieldName){"
    + "  if(PORTAL_LOCKED){ setUploadUiError_(fieldName,'Uploads are disabled (locked).',{errCode:'LOCKED',stage:'validate'}); return; }"
    + "  var input=document.getElementById('f_'+fieldName);"
    + "  var btn=document.getElementById('btn_'+fieldName);"
    + "  if(!input || !btn){ setUploadUiError_(fieldName,'Upload controls not found.',{errCode:'UI_MISSING',stage:'validate'}); return; }"
    + "  if(PORTAL_UPLOAD_PENDING[fieldName]){ return; }"
    + "  var files=[].slice.call(input.files||[]);"
    + "  if(!files.length){ setUploadUiError_(fieldName,'Please select a file.',{errCode:'NO_FILE',stage:'validate'}); return; }"
    + "  var file=files[0];"
    + "  if(Number(file && file.size || 0) > Math.max(1,Number(PORTAL_MAX_UPLOAD_BYTES||0))){ setUploadUiError_(fieldName,'File too large. Maximum '+String(Math.round((Number(PORTAL_MAX_UPLOAD_BYTES||0)/(1024*1024))||5))+' MB allowed.',{errCode:'FILE_TOO_LARGE',stage:'validate'}); return; }"
    + "  var dbg=makeClientDebugId_();"
    + "  var dbgEl=document.getElementById('dbg_'+fieldName);"
    + "  if(dbgEl) dbgEl.value=dbg;"
    + "  PORTAL_UPLOAD_PENDING[fieldName]={dbg:dbg,startedAt:Date.now()};"
    + "  setUploadBusy(fieldName,true);"
    + "  clearPortalError_();"
    + "  setRowMsg(fieldName,'Reading file...',false);"
    + "  setUploadStatusPanel_(fieldName,{text:'Reading...',dbg:dbg,stage:'read',driveMode:'B64'});"
    + "  var reader=new FileReader();"
    + "  reader.onerror=function(){"
    + "    delete PORTAL_UPLOAD_PENDING[fieldName];"
    + "    setUploadBusy(fieldName,false);"
    + "    setUploadUiError_(fieldName,'Could not read file.',{dbg:dbg,errCode:'READ_FAIL',stage:'read',driveMode:'B64'});"
    + "  };"
    + "  reader.onload=function(){"
    + "    var result=String(reader.result||'');"
    + "    var comma=result.indexOf(',');"
    + "    var base64=(comma>=0)?result.slice(comma+1):result;"
    + "    if(!base64){"
    + "      delete PORTAL_UPLOAD_PENDING[fieldName];"
    + "      setUploadBusy(fieldName,false);"
    + "      setUploadUiError_(fieldName,'Could not read file.',{dbg:dbg,errCode:'READ_EMPTY',stage:'read',driveMode:'B64'});"
    + "      return;"
    + "    }"
    + "    setRowMsg(fieldName,'Uploading...',false);"
    + "    setUploadStatusPanel_(fieldName,{text:'Uploading...',dbg:dbg,stage:'call',driveMode:'B64'});"
    + "    google.script.run"
    + "      .withSuccessHandler(function(res){"
    + "        delete PORTAL_UPLOAD_PENDING[fieldName];"
    + "        setUploadBusy(fieldName,false);"
    + "        if(!res || res.ok!==true){"
    + "          var code=String((res&&res.code)||'UPLOAD_FAILED');"
    + "          var dbgOut=String((res&&res.dbg)||dbg);"
    + "          var msg=String((res&&res.message)||('Upload failed ('+code+').'));"
    + "          setUploadUiError_(fieldName,msg+(dbgOut?(' Debug: '+dbgOut):''),{dbg:dbgOut,errCode:code,stage:'call',driveMode:'B64'});"
    + "          return;"
    + "        }"
    + "        var urls=(res.currentUrls && res.currentUrls.length)?res.currentUrls:getCurrentUrlsFromDom(fieldName);"
    + "        if(res.fileUrl && urls.indexOf(String(res.fileUrl))<0){ urls.push(String(res.fileUrl)); }"
    + "        renderCurrentUrls(fieldName, urls);"
    + "        markDocStatusPendingReviewUi_(fieldName);"
    + "        setUploadUiSuccess_(fieldName,'Uploaded (Pending Review).',{dbg:String(res.dbg||dbg),stage:'done',driveMode:'B64',fileUrl:String(res.fileUrl||'')});"
    + "        setRowMsg(fieldName,'Uploaded: '+escHtml(String(res.name||file.name||'')),false);"
    + "        try{ input.value=''; }catch(_e){}"
    + "      })"
    + "      .withFailureHandler(function(err){"
    + "        delete PORTAL_UPLOAD_PENDING[fieldName];"
    + "        setUploadBusy(fieldName,false);"
    + "        setUploadUiError_(fieldName,'Upload failed: '+(err&&err.message?err.message:err),{dbg:dbg,errCode:'RPC_FAIL',stage:'call',driveMode:'B64'});"
    + "      })"
    + "      .portalUploadBase64({id:PORTAL_UPLOAD_ID,s:PORTAL_UPLOAD_S,field:fieldName,name:String(file&&file.name||''),mime:String(file&&file.type||''),base64:base64});"
    + "  };"
    + "  reader.readAsDataURL(file);"
    + "}"
    + "function bindPortalUploadUi_(){"
    + "  var inputs=[].slice.call(document.querySelectorAll('[data-upload-input]'));"
    + "  inputs.forEach(function(input){"
    + "    if(!input || input.__fodeBoundUploadChange) return;"
    + "    input.__fodeBoundUploadChange=true;"
    + "    input.addEventListener('change', function(){"
    + "      var field=String(input.getAttribute('data-field')||'');"
    + "      var isMultiple=String(input.getAttribute('data-multi')||'0')==='1';"
    + "      onDocFileChange(field, isMultiple);"
    + "    });"
    + "  });"
    + "  var btns=[].slice.call(document.querySelectorAll('[data-upload-btn]'));"
    + "  btns.forEach(function(btn){"
    + "    if(!btn || btn.__fodeBoundUploadClick) return;"
    + "    btn.__fodeBoundUploadClick=true;"
    + "    btn.addEventListener('click', function(){"
    + "      var field=String(btn.getAttribute('data-field')||'');"
    + "      if(!field) return;"
    + "      uploadFile(field);"
    + "    });"
    + "  });"
    + "}"
    + "if(document.readyState==='loading'){ document.addEventListener('DOMContentLoaded', bindPortalUploadUi_); } else { bindPortalUploadUi_(); }"
    + "function deleteDocUrl(fieldName, encodedUrl){"
    + "  if(PORTAL_LOCKED){ return; }"
    + "  var msg=document.getElementById('msg_'+fieldName);"
    + "  var url=decodeURIComponent(encodedUrl||'');"
    + "  if(!url){ if(msg) msg.innerHTML='Invalid file URL.'; return; }"
    + "  setUploadBusy(fieldName,true);"
    + "  if(msg) msg.innerHTML='Deleting...';"
    + "  google.script.run"
    + "    .withSuccessHandler(function(res){"
    + "      if(!res || res.ok!==true){"
    + "        var redirect=(res&&res.redirectUrl)?String(res.redirectUrl):'';"
    + "        if(msg) msg.innerHTML='Delete failed: '+((res&&res.error)?res.error:'Unknown error');"
    + "        if(redirect){ window.location.replace(redirect); return; }"
        + "        setUploadBusy(fieldName,false);"
        + "        return;"
        + "      }"
    + "      if(msg) msg.innerHTML='Deleted.'+(res.warning?(' '+res.warning):'');"
    + "      window.location.replace(" + JSON.stringify(portalReloadUrl) + ");"
    + "    })"
    + "    .withFailureHandler(function(err){"
    + "      if(msg) msg.innerHTML='Delete failed: '+(err&&err.message?err.message:err);"
    + "      setUploadBusy(fieldName,false);"
    + "    })"
    + "    .portal_deleteUploadedFile({ applicantId:'" + esc_(id) + "', secret:'" + esc_(secret) + "', field:fieldName, url:url });"
    + "}"
    + "</script>";

  return out || "<i>No document fields configured.</i>";
}

function renderAllowlistSummary_(record, visibleFields) {
  var keys = visibleFields || [];
  var deny = { Physical_Exam_Site: true };
  var docFields = CONFIG.DOC_FIELDS || [];
  for (var df = 0; df < docFields.length; df++) {
    var fileField = clean_(docFields[df] && docFields[df].file);
    if (fileField) deny[fileField] = true;
  }
  var rows = "";

  for (var i = 0; i < keys.length; i++) {
    var k = keys[i];
    if (deny[k]) continue;
    if (/_File$/i.test(k)) continue;
    var rawVal = record[k];
    var v = clean_(rawVal);
    var display = v ? v : "-";

    // Pretty subjects display
    if (k === "Subjects_Selected_Canonical") {
      var csv = clean_(record.Subjects_Selected_Canonical || "") || subjectsToCsv_(record.Subjects_Selected || "");
      display = csv ? csv : "-";
    }

    // Keep DOB summary human-friendly while date input remains yyyy-mm-dd.
    if (k === "Date_Of_Birth") {
      if (rawVal instanceof Date && !isNaN(rawVal.getTime())) {
        var tz = Session.getScriptTimeZone() || "Pacific/Port_Moresby";
        display = Utilities.formatDate(rawVal, tz, "dd/MM/yyyy");
      } else {
        display = v || "-";
      }
    }

    // make URLs clickable
    if (/^https?:\/\//i.test(display)) {
      display = "<a target='_blank' href='" + esc_(display) + "'>Open</a>";
    } else {
      display = esc_(display);
    }

    rows += "<tr>"
      + "<td style='padding:6px 10px;border-bottom:1px solid #f0f0f0;vertical-align:top;width:34%;'><b>" + esc_(k) + "</b></td>"
      + "<td style='padding:6px 10px;border-bottom:1px solid #f0f0f0;vertical-align:top;'>" + display + "</td>"
      + "</tr>";
  }

  return "<table style='width:100%;border-collapse:collapse;font-size:13px;'>" + rows + "</table>";
}

function mapDocStatusForDisplay_(raw) {
  var s = clean_(raw);
  if (!s) return "Pending Review";
  var upper = s.toUpperCase();
  if (upper === "VERIFIED") return "Verified";
  if (upper === "REJECTED") return "Rejected";
  if (upper === "FRAUDULENT") return "Fraudulent";
  if (upper === "PENDING_REVIEW") return "Pending Review";
  if (upper === "PENDING REVIEW") return "Pending Review";
  if (upper === "PENDING") return "Pending Review";
  if (upper === "VERIFIED" || upper === "REJECTED" || upper === "FRAUDULENT") return s;
  if (s === "Verified" || s === "Rejected" || s === "Fraudulent" || s === "Pending Review") return s;
  return "Pending Review";
}

function renderEditableFields_(record, editFields, dis) {
  var out = "";
  var ro = (dis === "disabled") ? "readonly" : "";
  for (var i = 0; i < editFields.length; i++) {
    var h = editFields[i];
    var val = clean_(record[h] || "");
    var isUrl = isHttpUrl_(val);
    var linkHtml = isUrl ? (" <a target='_blank' rel='noopener' href='" + esc_(val) + "'>Open</a>") : "";
    out += "<div style='margin:10px 0;'>"
      + "<label><b>" + esc_(h) + ":</b></label><br/>"
      + "<input type='text' name='" + esc_(h) + "' value='" + esc_(val) + "' style='padding:8px;width:520px;' " + ro + " />"
      + linkHtml
      + "</div>";
  }
  return out || "<div><i>No additional editable fields configured.</i></div>";
}

function renderErrorHtml_(msg) {
  return '<!doctype html><html><body style="font-family:Arial;max-width:780px;margin:24px auto;padding:0 16px;">'
    + "<h2>FODE Student Portal</h2>"
    + '<div style="background:#ffecec;border:1px solid #ffb3b3;padding:12px;border-radius:10px;">'
    + esc_(msg) + "</div></body></html>";
}

function renderExpiredHtml_() {
  return '<!doctype html><html><body style="font-family:Arial;max-width:780px;margin:24px auto;padding:0 16px;">'
    + "<h2>FODE Student Portal</h2>"
    + '<div style="background:#fff6e5;border:1px solid #f5c26b;padding:12px;border-radius:10px;">'
    + "This portal link has expired. Please contact admissions for a new link."
    + "</div></body></html>";
}

function renderSuccessHtml_(applicantId) {
  return '<!doctype html><html><body style="font-family:Arial;max-width:780px;margin:24px auto;padding:0 16px;">'
    + "<h2>FODE Student Portal</h2>"
    + '<div style="background:#e8fff0;border:1px solid #9be7b2;padding:12px;border-radius:10px;">'
    + "Updates saved successfully for <b>" + esc_(applicantId) + "</b>."
    + "</div></body></html>";
}

function getStudentActionUrl_() {
  var studentExec = clean_(CONFIG.WEBAPP_URL_STUDENT_EXEC || "");
  var hasStudentExec = /^https:\/\/script\.google\.com\//i.test(studentExec);
  if (hasStudentExec) return { url: getStudentBaseUrl_() || studentExec, isStudentReady: true, warning: "" };
  var studentUrl = clean_(CONFIG.WEBAPP_URL_STUDENT || "");
  var isStudentReady = /^https:\/\/script\.google\.com\//i.test(studentUrl);
  var url = isStudentReady ? (getStudentBaseUrl_() || studentUrl) : "";
  var warning = isStudentReady ? "" : "Student URL not configured. Saving may not work for external users.";
  return {
    url: url,
    isStudentReady: isStudentReady,
    warning: warning
  };
}

function boundaryFromContentType_(ct) {
  var s = String(ct || "");
  var m = s.match(/boundary=(?:"([^"]+)"|([^;]+))/i);
  return clean_((m && (m[1] || m[2])) || "");
}

function boundaryFromContents_(contents) {
  var line = (typeof firstLine_ === "function")
    ? firstLine_(contents, 400)
    : String(contents || "").split(/\r?\n/, 1)[0];
  if (line.indexOf("--") !== 0) return "";
  return clean_(line.substring(2));
}

function parseMultipartForm_(e) {
  try {
    var pd = (e && e.postData) ? e.postData : null;
    var contentType = String((pd && (pd.type || pd.contentType)) || "");
    var raw = (pd && typeof pd.contents === "string") ? pd.contents : "";
    var contentLen = raw ? raw.length : 0;
    var firstLinePrefix = (typeof firstLine_ === "function") ? firstLine_(raw, 80) : String(raw || "").slice(0, 80);
    var boundary = boundaryFromContentType_(contentType);
    var boundaryFoundFrom = boundary ? "type" : "none";
    var boundaryDerived = false;
    if (!boundary) {
      boundary = boundaryFromContents_(raw);
      boundaryDerived = !!boundary;
      boundaryFoundFrom = boundary ? "contents" : "none";
    }
    if (!boundary) {
      return {
        ok: false,
        code: "MULTIPART_PARSE_FAIL",
        message: "Multipart parse failed. Missing boundary.",
        contentTypeSeen: (typeof truncate_ === "function") ? truncate_(contentType, 120) : String(contentType || "").slice(0, 120),
        contentLen: contentLen,
        boundaryDerived: false,
        boundaryFoundFrom: "none",
        firstLinePrefix: clean_(firstLinePrefix || "")
      };
    }
    if (!raw) {
      return {
        ok: false,
        code: "MULTIPART_PARSE_FAIL",
        message: "Empty multipart body.",
        contentTypeSeen: (typeof truncate_ === "function") ? truncate_(contentType, 120) : String(contentType || "").slice(0, 120),
        contentLen: contentLen,
        boundaryDerived: boundaryDerived,
        boundaryFoundFrom: boundaryFoundFrom,
        firstLinePrefix: clean_(firstLinePrefix || "")
      };
    }

    var out = {
      ok: true,
      fields: {},
      files: {},
      contentTypeSeen: (typeof truncate_ === "function") ? truncate_(contentType, 120) : String(contentType || "").slice(0, 120),
      contentLen: contentLen,
      boundaryDerived: boundaryDerived,
      boundaryFoundFrom: boundaryFoundFrom,
      firstLinePrefix: clean_(firstLinePrefix || "")
    };
    var delimiter = "--" + boundary;
    var parts = raw.split(delimiter);
    for (var i = 0; i < parts.length; i++) {
      var part = parts[i];
      if (!part) continue;
      if (part === "--" || part === "--\r\n" || part === "--\n") continue;
      if (/^\r?\n/.test(part)) part = part.replace(/^\r?\n/, "");
      if (!part || part === "--") continue;
      if (/--\r?\n?$/.test(part)) part = part.replace(/--\r?\n?$/, "");
      var sepIdx = part.indexOf("\r\n\r\n");
      var sepLen = 4;
      if (sepIdx < 0) {
        sepIdx = part.indexOf("\n\n");
        sepLen = 2;
      }
      if (sepIdx < 0) continue;
      var headerText = part.slice(0, sepIdx);
      var body = part.slice(sepIdx + sepLen);
      body = body.replace(/\r?\n$/, "");

      var headers = {};
      var lines = headerText.split(/\r?\n/);
      for (var h = 0; h < lines.length; h++) {
        var line = String(lines[h] || "");
        var colon = line.indexOf(":");
        if (colon < 0) continue;
        var hk = line.slice(0, colon).trim().toLowerCase();
        var hv = line.slice(colon + 1).trim();
        headers[hk] = hv;
      }
      var disp = String(headers["content-disposition"] || "");
      if (!disp) continue;
      var nameMatch = disp.match(/name="([^"]*)"/i);
      var fileMatch = disp.match(/filename="([^"]*)"/i);
      var fieldName = clean_((nameMatch && nameMatch[1]) || "");
      if (!fieldName) continue;
      if (fileMatch && fileMatch[1] !== undefined) {
        var fileName = String(fileMatch[1] || "");
        var ct = clean_(headers["content-type"] || "application/octet-stream");
        var blob = Utilities.newBlob(body || "", ct || "application/octet-stream", fileName || "upload.bin");
        var bytes = blob.getBytes();
        var fileObj = {
          fileName: fileName,
          contentType: ct,
          bytes: bytes,
          blob: blob
        };
        if (hasOwn_(out.files, fieldName)) {
          if (!Array.isArray(out.files[fieldName])) out.files[fieldName] = [out.files[fieldName]];
          out.files[fieldName].push(fileObj);
        } else {
          out.files[fieldName] = fileObj;
        }
      } else {
        out.fields[fieldName] = body;
      }
    }
    return out;
  } catch (err) {
    return {
      ok: false,
      code: "MULTIPART_PARSE_FAIL",
      message: String(err && err.message ? err.message : err),
      contentTypeSeen: "",
      contentLen: 0,
      boundaryDerived: false,
      boundaryFoundFrom: "none",
      firstLinePrefix: ""
    };
  }
}

function portal_uploadMultipart_(e) {
  var t0 = nowMs_();
  var dbg = makeDebugId_();
  var reqParams = (e && e.parameter && typeof e.parameter === "object") ? e.parameter : {};
  var redirectApplicantId = clean_(reqParams.id || reqParams.applicantId || "");
  var redirectSecret = clean_(reqParams.s || reqParams.secret || "");
  var diagBase = {
    runtimeVersion: clean_(CONFIG.VERSION || ""),
    portalBuildParam: clean_(typeof getParam_ === "function" ? getParam_(e, "portalBuild") : (reqParams.portalBuild || "")),
    viewParam: clean_(typeof getParam_ === "function" ? getParam_(e, "view") : (reqParams.view || "")),
    method: "POST"
  };
  function diag_(extra) {
    var out = {};
    var k;
    for (k in diagBase) if (Object.prototype.hasOwnProperty.call(diagBase, k)) out[k] = diagBase[k];
    if (extra && typeof extra === "object") {
      for (k in extra) if (Object.prototype.hasOwnProperty.call(extra, k)) out[k] = extra[k];
    }
    return out;
  }
  function out_(ok, code, message, extra) {
    var x = (extra && typeof extra === "object") ? extra : {};
    var dbgOut = clean_(x.debugId || dbg);
    var errCodeOut = clean_(x.errCode || code || "");
    var idOut = clean_(x.applicantId || redirectApplicantId || "");
    var secretOut = clean_(x.secret || redirectSecret || "");
    var docKeyOut = clean_(x.docKey || "");
    logExecTrace_("PORTAL_UPLOAD_RESULT_RENDER", dbgOut || dbg, {
      dbg: dbgOut || dbg,
      ok: ok ? 1 : 0,
      docKey: docKeyOut,
      runtimeVersion: clean_(CONFIG.VERSION || "")
    });
    try {
      return renderPortalPageResponse_(e, {
        applicantId: idOut,
        secret: secretOut,
        viewName: "portal",
        uploadResult: {
          ok: !!ok,
          dbg: dbgOut || dbg,
          errCode: ok ? "" : errCodeOut,
          docKey: docKeyOut,
          message: clean_(message || "")
        }
      });
    } catch (renderErr) {
      logExecTrace_("PORTAL_UPLOAD_FAIL", dbgOut || dbg, diag_({
        code: "PORTAL_UPLOAD_RENDER_FAIL",
        stage: "render",
        err: clean_(stringifyGsError_(renderErr) || "")
      }));
      return htmlOutput_(renderErrorHtml_("Upload processed, but portal page could not be rendered. Debug: " + (dbgOut || dbg)));
    }
  }

  try {
    var pd = (e && e.postData) ? e.postData : null;
    var pdKeys = (typeof safeKeys_ === "function") ? safeKeys_(pd) : (pd && typeof pd === "object" ? Object.keys(pd) : []);
    var parameterKeys = (typeof safeKeys_ === "function") ? safeKeys_(reqParams) : (reqParams && typeof reqParams === "object" ? Object.keys(reqParams) : []);
    var nativeParamFile = (reqParams && typeof reqParams === "object") ? reqParams.file : null;
    var nativeFileName = "";
    var nativeFileBytes = [];
    var nativeFileBytesLen = 0;
    var nativeFileContentType = "";
    var hasNativeParameterFile = !!nativeParamFile;
    try { nativeFileName = (nativeParamFile && nativeParamFile.getName) ? clean_(nativeParamFile.getName()) : ""; } catch (_eName) {}
    try { nativeFileContentType = (nativeParamFile && nativeParamFile.getContentType) ? clean_(nativeParamFile.getContentType()) : ""; } catch (_eCt) {}
    try {
      if (nativeParamFile && nativeParamFile.getBytes) {
        nativeFileBytes = nativeParamFile.getBytes() || [];
        nativeFileBytesLen = Number(nativeFileBytes.length || 0);
      }
    } catch (_eBytes) {
      nativeFileBytes = [];
      nativeFileBytesLen = 0;
    }
    var pdContentLen = (pd && typeof pd.contents === "string") ? pd.contents.length : 0;
    var parsed = null;
    if (nativeParamFile && nativeFileBytesLen > 0) {
      parsed = {
        ok: true,
        fields: reqParams,
        files: {
          file: {
            fileName: nativeFileName || "portal-upload.bin",
            contentType: nativeFileContentType || "application/octet-stream",
            bytes: nativeFileBytes,
            blob: nativeParamFile
          }
        },
        contentTypeSeen: clean_((pd && (pd.type || pd.contentType)) || ""),
        contentLen: pdContentLen,
        boundaryDerived: false,
        boundaryFoundFrom: "native_parameter_file",
        firstLinePrefix: ""
      };
    } else if (!pd || pdContentLen <= 0) {
      logExecTrace_("PORTAL_UPLOAD_ENTER", dbg, {
        dbg: dbg,
        runtimeVersion: clean_(CONFIG.VERSION || ""),
        view: clean_(typeof getParam_ === "function" ? getParam_(e, "view") : (reqParams.view || "")),
        hasPostData: !!pd,
        postDataKeys: pdKeys,
        hasParameterFile: hasNativeParameterFile,
        parameterKeys: parameterKeys,
        fileName: nativeFileName,
        fileBytesLen: nativeFileBytesLen,
        contentTypeSeen: clean_((pd && (pd.type || pd.contentType)) || ""),
        contentLen: Number(pdContentLen || 0),
        applicantId: clean_(reqParams.id || reqParams.applicantId || ""),
        docKey: clean_(reqParams.docKey || reqParams.field || "")
      });
      logExecTrace_("PORTAL_UPLOAD_FAIL", dbg, diag_({
        code: "NO_POSTDATA",
        stage: "parse",
        contentTypeSeen: clean_((pd && (pd.type || pd.contentType)) || ""),
        contentLen: Number(pdContentLen || 0)
      }));
      return out_(false, "NO_POSTDATA", "Upload payload missing (empty POST). This usually means the browser did not submit the form containing the file input.", {
        stage: "parse",
        contentTypeSeen: clean_((pd && (pd.type || pd.contentType)) || ""),
        contentLen: Number(pdContentLen || 0),
        postDataKeys: pdKeys,
        applicantId: clean_(reqParams.id || reqParams.applicantId || ""),
        secret: clean_(reqParams.s || reqParams.secret || ""),
        docKey: clean_(reqParams.docKey || reqParams.field || "")
      });
    } else {
      parsed = parseMultipartForm_(e);
    }
    var enterFields = (parsed && parsed.fields && typeof parsed.fields === "object") ? parsed.fields : {};
    logExecTrace_("PORTAL_UPLOAD_ENTER", dbg, {
      dbg: dbg,
      runtimeVersion: clean_(CONFIG.VERSION || ""),
      view: clean_(typeof getParam_ === "function" ? getParam_(e, "view") : (reqParams.view || "")),
      hasPostData: !!pd,
      postDataKeys: pdKeys,
      hasParameterFile: hasNativeParameterFile,
      parameterKeys: parameterKeys,
      fileName: nativeFileName,
      fileBytesLen: nativeFileBytesLen,
      contentTypeSeen: clean_(parsed && parsed.contentTypeSeen || ((pd && (pd.type || pd.contentType)) || "")),
      contentLen: Number(parsed && parsed.contentLen || ((pd && typeof pd.contents === "string") ? pd.contents.length : 0)),
      applicantId: clean_(enterFields.id || enterFields.applicantId || reqParams.id || reqParams.applicantId || ""),
      docKey: clean_(enterFields.docKey || enterFields.field || reqParams.docKey || reqParams.field || "")
    });
    logExecTrace_("PORTAL_UPLOAD_DIAG", dbg, diag_({
      hasPostData: !!pd,
      postDataKeys: pdKeys,
      contentTypeSeen: clean_(parsed && parsed.contentTypeSeen || ((pd && (pd.type || pd.contentType)) || "")),
      contentLen: Number(parsed && parsed.contentLen || ((pd && typeof pd.contents === "string") ? pd.contents.length : 0)),
      firstLinePrefix: clean_(parsed && parsed.firstLinePrefix || ((typeof firstLine_ === "function") ? firstLine_((pd && pd.contents) || "", 80) : "")),
      boundaryFoundFrom: clean_(parsed && parsed.boundaryFoundFrom || "none"),
      boundaryDerived: !!(parsed && parsed.boundaryDerived)
    }));
    if (!parsed || parsed.ok !== true) {
      logExecTrace_("PORTAL_UPLOAD_FAIL", dbg, diag_({
        code: "MULTIPART_PARSE_FAIL",
        stage: "parse",
        err: clean_(parsed && parsed.message || ""),
        contentTypeSeen: clean_(parsed && parsed.contentTypeSeen || ""),
        contentLen: Number(parsed && parsed.contentLen || 0),
        boundaryDerived: !!(parsed && parsed.boundaryDerived),
        boundaryFoundFrom: clean_(parsed && parsed.boundaryFoundFrom || "none"),
        firstLinePrefix: clean_(parsed && parsed.firstLinePrefix || "")
      }));
      return out_(false, "MULTIPART_PARSE_FAIL", clean_(parsed && parsed.message || "Multipart parse failed. Missing boundary."), {
        stage: "parse",
        contentTypeSeen: clean_(parsed && parsed.contentTypeSeen || ""),
        boundaryDerived: !!(parsed && parsed.boundaryDerived),
        boundaryFoundFrom: clean_(parsed && parsed.boundaryFoundFrom || "none"),
        contentLen: Number(parsed && parsed.contentLen || 0),
        postDataKeys: pdKeys,
        firstLinePrefix: clean_(parsed && parsed.firstLinePrefix || "")
      });
    }

    var fields = parsed.fields || {};
    var queryParams = (e && e.parameter && typeof e.parameter === "object") ? e.parameter : {};
    var queryId = clean_(queryParams.id || queryParams.applicantId || "");
    var queryS = clean_(queryParams.s || queryParams.secret || "");
    var multipartId = clean_(fields.id || fields.applicantId || "");
    var multipartS = clean_(fields.s || fields.secret || "");
    var recvIdSource = "missing";
    var applicantId = "";
    var secret = "";
    if (queryId && queryS) {
      applicantId = queryId;
      secret = queryS;
      recvIdSource = "query";
    } else if (multipartId && multipartS) {
      applicantId = multipartId;
      secret = multipartS;
      recvIdSource = "multipart";
    } else {
      applicantId = clean_(queryId || multipartId || "");
      secret = clean_(queryS || multipartS || "");
      recvIdSource = "missing";
    }
    redirectApplicantId = applicantId || redirectApplicantId;
    redirectSecret = secret || redirectSecret;
    var recvSHashed = (typeof secretHashPrefix_ === "function")
      ? secretHashPrefix_(secret)
      : clean_(hashPortalSecret_(secret || "")).slice(0, 8);
    var docKey = clean_(fields.docKey || fields.field || "");
    var postedDbg = clean_(fields.dbg || "");
    if (postedDbg) dbg = postedDbg;
    var fileEntry = parsed.files && parsed.files.file ? parsed.files.file : null;
    if (Array.isArray(fileEntry)) fileEntry = fileEntry[0] || null;
    if (!applicantId || !secret) {
      return out_(false, "TOKEN_MISSING", "Missing portal token.", {
        stage: "auth",
        docKey: docKey,
        recvIdSource: recvIdSource,
        recvSHashed: recvSHashed,
        contentTypeSeen: clean_(parsed.contentTypeSeen || ""),
        boundaryDerived: !!parsed.boundaryDerived,
        boundaryFoundFrom: clean_(parsed.boundaryFoundFrom || "none"),
        contentLen: Number(parsed.contentLen || 0)
      });
    }
    if (!docKey) {
      return out_(false, "INVALID_FIELD", "Missing document field.", {
        stage: "validate",
        recvIdSource: recvIdSource,
        recvSHashed: recvSHashed,
        contentTypeSeen: clean_(parsed.contentTypeSeen || ""),
        boundaryDerived: !!parsed.boundaryDerived,
        boundaryFoundFrom: clean_(parsed.boundaryFoundFrom || "none"),
        contentLen: Number(parsed.contentLen || 0)
      });
    }

    if (!fileEntry || !Array.isArray(fileEntry.bytes) || !fileEntry.bytes.length) {
      logExecTrace_("PORTAL_UPLOAD_FAIL", dbg, diag_({ code: "NO_FILE", stage: "parse", applicantId: applicantId, docKey: docKey }));
      return out_(false, "NO_FILE", "Please select a file.", {
        stage: "parse",
        docKey: docKey,
        recvIdSource: recvIdSource,
        recvSHashed: recvSHashed,
        contentTypeSeen: clean_(parsed.contentTypeSeen || ""),
        boundaryDerived: !!parsed.boundaryDerived,
        boundaryFoundFrom: clean_(parsed.boundaryFoundFrom || "none"),
        contentLen: Number(parsed.contentLen || 0)
      });
    }

    var ss = getWorkingSpreadsheet_();
    var sheet = mustGetDataSheet_(ss);
    var found = findPortalRowByIdSecret_(sheet, applicantId, secret);
    if (!found) {
      logExecTrace_("PORTAL_UPLOAD_FAIL", dbg, diag_({ code: "TOKEN_INVALID", stage: "auth", applicantId: applicantId, docKey: docKey }));
      return out_(false, "TOKEN_INVALID", "Invalid or expired portal link token.", {
        stage: "auth",
        docKey: docKey,
        recvIdSource: recvIdSource,
        recvSHashed: recvSHashed,
        contentTypeSeen: clean_(parsed.contentTypeSeen || ""),
        boundaryDerived: !!parsed.boundaryDerived,
        boundaryFoundFrom: clean_(parsed.boundaryFoundFrom || "none"),
        contentLen: Number(parsed.contentLen || 0)
      });
    }
    if (String(found.record[SCHEMA.PORTAL_ACCESS_STATUS] || "").trim() === "Locked") {
      return out_(false, "ACCESS_LOCKED", "Portal access is locked. Please contact admissions.", {
        stage: "auth",
        docKey: docKey,
        recvIdSource: recvIdSource,
        recvSHashed: recvSHashed,
        contentTypeSeen: clean_(parsed.contentTypeSeen || ""),
        boundaryDerived: !!parsed.boundaryDerived,
        boundaryFoundFrom: clean_(parsed.boundaryFoundFrom || "none"),
        contentLen: Number(parsed.contentLen || 0)
      });
    }
    if (isPaymentFreezeActive_(found.record)) {
      logExecTrace_("PORTAL_UPLOAD_FAIL", dbg, diag_({ code: "PAYMENT_FREEZE", stage: "auth", applicantId: applicantId, docKey: docKey }));
      return out_(false, "PAYMENT_FREEZE", "Uploads are disabled after payment verification.", {
        stage: "auth",
        docKey: docKey,
        recvIdSource: recvIdSource,
        recvSHashed: recvSHashed
      });
    }

    var fileName = clean_(fileEntry.fileName || fields.name || "portal-upload.bin");
    var mimeType = clean_(fileEntry.contentType || fields.mimeType || "application/octet-stream");
    var b64 = Utilities.base64Encode(fileEntry.bytes);
    var res = portalUpload_fromUi_({
      id: applicantId,
      s: secret,
      field: docKey,
      name: fileName,
      mimeType: mimeType,
      b64: b64,
      dbg: dbg
    }) || {};

    var code = clean_(res.errCode || (res.ok ? "OK" : "UPLOAD_FAILED")) || (res.ok ? "OK" : "UPLOAD_FAILED");
    if (res.ok === true) {
      logExecTrace_("PORTAL_UPLOAD", dbg, {
        applicantId: applicantId,
        docKey: docKey,
        fileName: fileName,
        byteSize: Number(fileEntry.bytes.length || 0),
        serverMs: Number(res.serverMs || elapsedMs_(t0)),
        driveMode: clean_(res.driveMode || "")
      });
      logExecTrace_("PORTAL_UPLOAD_OK", dbg, {
        dbg: clean_(res.dbg || dbg),
        docKey: docKey,
        runtimeVersion: clean_(CONFIG.VERSION || ""),
        applicantId: applicantId,
        driveMode: clean_(res.driveMode || ""),
        serverMs: Number(res.serverMs || elapsedMs_(t0))
      });
      return out_(true, "OK", "Uploaded", {
        debugId: clean_(res.dbg || dbg),
        applicantId: applicantId,
        secret: secret,
        docKey: docKey,
        fileUrl: res.fileUrl,
        fileId: res.fileId,
        currentUrls: res.currentUrls,
        driveMode: res.driveMode,
        stage: res.stage || "done",
        serverMs: res.serverMs,
        recvIdSource: recvIdSource,
        recvSHashed: recvSHashed,
        contentTypeSeen: clean_(parsed.contentTypeSeen || ""),
        boundaryDerived: !!parsed.boundaryDerived,
        boundaryFoundFrom: clean_(parsed.boundaryFoundFrom || "none"),
        contentLen: Number(parsed.contentLen || 0)
      });
    }

    logExecTrace_("PORTAL_UPLOAD_FAIL", dbg, diag_({
      applicantId: applicantId,
      docKey: docKey,
      fileName: fileName,
      byteSize: Number(fileEntry.bytes.length || 0),
      stage: clean_(res.stage || "call"),
      errCode: clean_(res.errCode || code),
      serverMs: Number(res.serverMs || elapsedMs_(t0))
    }));
    return out_(false, code.toUpperCase(), clean_(res.err || "Upload failed."), {
      debugId: clean_(res.dbg || dbg),
      applicantId: applicantId,
      secret: secret,
      docKey: docKey,
      fileUrl: res.fileUrl,
      fileId: res.fileId,
      currentUrls: res.currentUrls,
      driveMode: res.driveMode,
      stage: res.stage || "call",
      serverMs: res.serverMs,
      errCode: res.errCode || code,
      recvIdSource: recvIdSource,
      recvSHashed: recvSHashed,
      contentTypeSeen: clean_(parsed.contentTypeSeen || ""),
      boundaryDerived: !!parsed.boundaryDerived,
      boundaryFoundFrom: clean_(parsed.boundaryFoundFrom || "none"),
      contentLen: Number(parsed.contentLen || 0)
    });
  } catch (err) {
    var msg = String(err && err.message ? err.message : err);
    logExecTrace_("PORTAL_UPLOAD_FAIL", dbg, diag_({ code: "PORTAL_UPLOAD_EXCEPTION", stage: "call", e: safeErr_(err) }));
    return out_(false, "PORTAL_UPLOAD_EXCEPTION", msg || "Upload failed.", { stage: "call" });
  }
}

function buildPortalRedirectUrl_(applicantId, secret) {
  var baseUrl = canonicalStudentExecBase_();
  var opts = (arguments.length > 2 && arguments[2]) ? arguments[2] : {};
  var sep = baseUrl.indexOf("?") === -1 ? "?" : "&";
  var url = baseUrl
    + sep + "view=portal";
  var idNorm = clean_(applicantId);
  var secretNorm = clean_(secret);
  if (idNorm) url += "&id=" + encodeURIComponent(idNorm);
  if (secretNorm) url += "&s=" + encodeURIComponent(secretNorm);
  if (opts.saved === true) url += "&saved=1";
  var hasError = opts.error === true || opts.err === true;
  if (hasError) url += "&error=1";
  if (opts.locked === true) url += "&locked=1";
  if (opts.msg) url += "&msg=" + encodeURIComponent(clean_(opts.msg));
  if (opts.dbg) url += "&dbg=" + encodeURIComponent(clean_(opts.dbg));
  if (opts.uploadFail === true) url += "&uploadFail=1";
  if (opts.field) url += "&field=" + encodeURIComponent(clean_(opts.field));
  if (opts.val === true) url += "&val=1";
  if (opts.fields) url += "&fields=" + encodeURIComponent(clean_(opts.fields));
  if (opts.errCode) url += "&errCode=" + encodeURIComponent(clean_(opts.errCode));
  return url;
}

function returnPortalRedirectOutput_(url) {
  var opts = (arguments.length > 1 && arguments[1]) ? arguments[1] : {};
  var u = canonicalizePortalRedirectUrl_(url);
  if (!u) return htmlOutput_(renderErrorHtml_("Missing redirect URL"));
  var showDebugBlock = CONFIG.DEBUG_PORTAL_SHOW_ON_PAGE === true && opts.debug === true;
  var debugBlock = showDebugBlock
    ? '<div style="font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:12px auto;padding:8px;border:1px dashed #999;color:#000;font-size:12px;">'
      + "<div><b>DEBUG_PORTAL_POST</b></div>"
      + "<div>reqId: " + esc_(clean_(opts.reqId || "")) + "</div>"
      + "<div>received id: " + esc_(clean_(opts.applicantId || "")) + "</div>"
      + "<div>received s(redacted): " + esc_(redactToken_(opts.secret || "")) + "</div>"
      + "<div>result.ok: " + (opts.result && opts.result.ok === true ? "true" : "false") + "</div>"
      + "<div>debugId: " + esc_(clean_(opts.debugId || (opts.result && opts.result.debugId) || "")) + "</div>"
      + "<div>redirectUrl: " + esc_(clean_(opts.redirectUrl || u)) + "</div>"
      + "<div>token validation passed: " + (opts.tokenValidationPassed === true ? "true" : "false") + "</div>"
      + "</div>"
    : "";
  var html = '<!doctype html><html><head>'
    + '<meta charset="utf-8" />'
    + '<base target="_top" />'
    + '<meta name="viewport" content="width=device-width, initial-scale=1" />'
    + '<meta http-equiv="refresh" content="0;url=' + esc_(u) + '" />'
    + '<title>Redirecting</title>'
    + '</head><body>'
    + debugBlock
    + '<div style="font-family:Arial,Helvetica,sans-serif;max-width:720px;margin:24px auto;padding:0 16px;">'
    + '<h3>Redirecting...</h3>'
    + '<p>If you are not redirected, click <a href="' + esc_(u) + '" target="_top">Continue</a>.</p>'
    + "</div>"
    + "<script>"
    + "(function(){"
    + "var t=" + JSON.stringify(u) + ";"
    + "try{ if(window.top && window.top.location){ window.top.location.replace(t); return; } }catch(e){}"
    + "window.location.replace(t);"
    + "})();"
    + "</script>"
    + '<noscript><p><a href="' + esc_(u) + '" target="_top">Continue</a></p></noscript>'
    + "</body></html>";
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function canonicalizePortalRedirectUrl_(url) {
  var raw = clean_(url);
  if (!raw) return "";
  var canonicalBase = getStudentBaseUrl_() || clean_(CONFIG.WEBAPP_URL_STUDENT_EXEC || "");
  var qIndex = raw.indexOf("?");
  var query = qIndex >= 0 ? raw.slice(qIndex) : "";
  if (/^https:\/\/script\.google\.com\/a\//i.test(raw)) {
    if (canonicalBase) return canonicalBase + query;
    return raw.replace(/^https:\/\/script\.google\.com\/a\/[^/]+\//i, "https://script.google.com/");
  }
  if (canonicalBase && /^https:\/\/script\.google\.com\//i.test(raw)) {
    return canonicalBase + query;
  }
  return raw;
}

function canonicalStudentExecBase_() {
  return getStudentBaseUrl_() || clean_(CONFIG.WEBAPP_URL_STUDENT_EXEC || CONFIG.WEBAPP_URL_STUDENT || "");
}

function normalizeWebAppUrl_(url) {
  var out = clean_(url || "");
  if (!out) return "";
  out = out.replace(/\?.*$/, "");
  out = out.replace(/\/+$/, "");
  return out;
}

function isAdminDeploymentRequest_() {
  try {
    var current = normalizeWebAppUrl_(ScriptApp.getService().getUrl() || "");
    var adminBase = normalizeWebAppUrl_(CONFIG.WEBAPP_URL_ADMIN || CONFIG.WEBAPP_URL || "");

    // normalize domain-specific paths
    current = current.replace("/a/macros/", "/macros/");
    adminBase = adminBase.replace("/a/macros/", "/macros/");

    return !!(current && adminBase && current === adminBase);
  } catch (e) {
    Logger.log("ADMIN_URL_MATCH_FAIL " + (e.message || e));
    return false;
  }
}

function parsePortalPayloadField_(raw) {
  var txt = clean_(raw);
  if (!txt) return {};
  try {
    var parsed = JSON.parse(txt);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      throw new Error("payload must be object");
    }
    return parsed;
  } catch (e) {
    throw new Error("Invalid payload JSON");
  }
}

function mergePortalPayload_(basePayload, payloadObj) {
  var out = {};
  var src = basePayload || {};
  Object.keys(src).forEach(function (k) { out[k] = src[k]; });
  Object.keys(payloadObj || {}).forEach(function (k2) { out[k2] = payloadObj[k2]; });
  return out;
}

function outputToJsonObject_(res) {
  if (!res) return null;
  if (typeof res.getContent === "function") {
    var txt = clean_(res.getContent());
    if (!txt) return null;
    try {
      return JSON.parse(txt);
    } catch (e) {
      return null;
    }
  }
  if (typeof res === "object") return res;
  return null;
}

function logPortalPostEvent_(label, payload) {
  try {
    var ss = getWorkingSpreadsheet_();
    var sh = mustGetSheet_(ss, CONFIG.LOG_SHEET);
    log_(sh, label, JSON.stringify(payload || {}));
  } catch (e) {
    // Diagnostic logging must never break request flow.
  }
}

function mustGetDataSheet_(ss) {
  var expectedName = clean_(CONFIG.SHEET_TAB_WORKING || CONFIG.DATA_SHEET || "FODE_Data");
  var sheet = mustGetSheet_(ss, expectedName);
  if (sheet.getName() !== expectedName) {
    throw new Error("DATA_SHEET mismatch");
  }
  return sheet;
}
function htmlOutput_(html) {
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

/******************** LOOKUP ********************/
function getPortalSecretsStoreConfig_(opts) {
  var options = (opts && typeof opts === "object") ? opts : {};
  var source = clean_(options.source || "").toLowerCase();
  var sheetId = "";
  var tabName = "";
  if (clean_(options.spreadsheetId || "")) sheetId = clean_(options.spreadsheetId || "");
  else if (clean_(options.sheetId || "")) sheetId = clean_(options.sheetId || "");
  try {
    if (!sheetId && source === "config" && typeof CONFIG !== "undefined") sheetId = clean_(CONFIG.PORTAL_SECRETS_SHEET_ID || "");
  } catch (_cfgOnlyIdErr) {}
  try {
    if (!sheetId && source !== "config" && typeof PORTAL_SECRETS_SPREADSHEET_ID !== "undefined") sheetId = clean_(PORTAL_SECRETS_SPREADSHEET_ID || "");
  } catch (_idErr) {}
  try {
    if (!sheetId && source !== "config" && typeof CONFIG !== "undefined") sheetId = clean_(CONFIG.PORTAL_SECRETS_SHEET_ID || "");
  } catch (_cfgIdErr) {}
  if (clean_(options.tabName || "")) tabName = clean_(options.tabName || "");
  try {
    if (!tabName && source === "config" && typeof CONFIG !== "undefined") tabName = clean_(CONFIG.PORTAL_SECRETS_TAB || "");
  } catch (_cfgOnlyTabErr) {}
  try {
    if (!tabName && source !== "config" && typeof PORTAL_SECRETS_TAB !== "undefined") tabName = clean_(PORTAL_SECRETS_TAB || "");
  } catch (_tabErr) {}
  try {
    if (!tabName && source !== "config" && typeof CONFIG !== "undefined") tabName = clean_(CONFIG.PORTAL_SECRETS_TAB || "");
  } catch (_cfgTabErr) {}
  return {
    sheetId: sheetId,
    tabName: tabName || "PortalSecrets"
  };
}

function openPortalSecretsExistingSheet_(debugId, opts) {
  var dbg = clean_(debugId || newDebugId_());
  var cfg = getPortalSecretsStoreConfig_(opts);
  if (!cfg.sheetId) return { ok: false, code: "SECRETS_CONFIG_MISSING", debugId: dbg };
  try {
    var ss = SpreadsheetApp.openById(cfg.sheetId);
    var sh = ss.getSheetByName(cfg.tabName);
    if (!sh) return { ok: false, code: "SECRETS_TAB_NOT_FOUND", debugId: dbg };
    return { ok: true, sheet: sh, debugId: dbg };
  } catch (e) {
    return {
      ok: false,
      code: "SECRET_LOOKUP_FAILED",
      debugId: dbg,
      error: clean_(stringifyGsError_(e) || String(e && e.message ? e.message : e))
    };
  }
}

function resolvePortalSecretPlainColumnIndex_(idx) {
  var map = idx || {};
  if (map.Secret_Plain) return map.Secret_Plain;
  if (map.Secret) return map.Secret;
  return 0;
}

function resolvePortalSecretColumnIndex_(idx) {
  var map = idx || {};
  return resolvePortalSecretPlainColumnIndex_(map) || map.Secret_Hash || 0;
}

function buildPortalSecretHeaderIndex_(headers) {
  var idx = {};
  var values = headers || [];
  for (var i = 0; i < values.length; i++) {
    var h = clean_(values[i]);
    if (h) idx[h] = i + 1;
  }
  return idx;
}

function normalizePortalSecretRow_(idx, row, rowIndex) {
  var map = idx || {};
  var values = row || [];
  var plainCol = resolvePortalSecretPlainColumnIndex_(map);
  var issuedCol = map.Issued_At || map.IssuedAt || map.PortalTokenIssuedAt || map.Last_Rotated_At || map.Created_At || 0;
  return {
    applicantId: clean_(map.ApplicantID ? values[map.ApplicantID - 1] : ""),
    secretPlain: clean_(plainCol ? values[plainCol - 1] : ""),
    secretHash: clean_(map.Secret_Hash ? values[map.Secret_Hash - 1] : ""),
    issuedAt: issuedCol ? values[issuedCol - 1] : "",
    status: clean_(map.Status ? values[map.Status - 1] : ""),
    found: false,
    reason: "",
    rowIndex: Number(rowIndex || 0)
  };
}

function normalizePortalSecretStatus_(value) {
  var status = clean_(value || "");
  if (!status) return "";
  if (status.toUpperCase() === "ACTIVE") return "ACTIVE";
  if (status.toUpperCase() === "INACTIVE") return "INACTIVE";
  return status.toUpperCase();
}

function emptyPortalSecretLookup_(applicantId, reason, debugId, extra) {
  var out = {
    applicantId: clean_(applicantId || ""),
    secretPlain: "",
    secretHash: "",
    issuedAt: "",
    status: "",
    found: false,
    reason: clean_(reason || "NO_SECRET"),
    ok: false,
    code: clean_(reason || "NO_SECRET"),
    debugId: clean_(debugId || newDebugId_())
  };
  var more = (extra && typeof extra === "object") ? extra : {};
  for (var k in more) {
    if (Object.prototype.hasOwnProperty.call(more, k)) out[k] = more[k];
  }
  return out;
}

function lookupPortalSecretForApplicant_(applicantId, opts) {
  var debugId = newDebugId_();
  var idNorm = clean_(applicantId || "");
  if (!idNorm) return emptyPortalSecretLookup_(idNorm, "MISSING_APPLICANT_ID", debugId);
  var opened = openPortalSecretsExistingSheet_(debugId, opts);
  if (!opened || opened.ok !== true) {
    return emptyPortalSecretLookup_(idNorm, clean_(opened && opened.code || "SECRET_LOOKUP_FAILED"), debugId, {
      error: clean_(opened && opened.error || "")
    });
  }
  try {
    var sh = opened.sheet;
    var lastCol = sh.getLastColumn();
    var lastRow = sh.getLastRow();
    if (lastCol < 1 || lastRow < 2) return emptyPortalSecretLookup_(idNorm, "NO_SECRET", debugId);
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var idx = buildPortalSecretHeaderIndex_(headers);
    if (!idx.ApplicantID) return emptyPortalSecretLookup_(idNorm, "APPLICANT_ID_COLUMN_MISSING", debugId);
    if (!resolvePortalSecretColumnIndex_(idx)) return emptyPortalSecretLookup_(idNorm, "SECRET_COLUMN_MISSING", debugId);
    var data = sh.getRange(2, 1, lastRow - 1, lastCol).getValues();
    var idLower = idNorm.toLowerCase();
    var inactiveMatch = null;
    var unusableMatch = null;
    var hasStatus = !!idx.Status;
    for (var r = 0; r < data.length; r++) {
      var rec = normalizePortalSecretRow_(idx, data[r], r + 2);
      if (!rec.applicantId || rec.applicantId.toLowerCase() !== idLower) continue;
      rec.status = normalizePortalSecretStatus_(rec.status || "");
      if (hasStatus && rec.status !== "ACTIVE") {
        if (!inactiveMatch) inactiveMatch = rec;
        continue;
      }
      if (!rec.secretPlain && !rec.secretHash) {
        if (!unusableMatch) unusableMatch = rec;
        continue;
      }
      rec.found = true;
      rec.reason = "FOUND";
      rec.ok = true;
      rec.code = "OK";
      rec.secret = rec.secretPlain || rec.secretHash;
      rec.debugId = debugId;
      return rec;
    }
    if (unusableMatch) {
      return emptyPortalSecretLookup_(idNorm, "UNUSABLE_SECRET", debugId, {
        rowIndex: unusableMatch.rowIndex,
        status: unusableMatch.status
      });
    }
    if (inactiveMatch) {
      return emptyPortalSecretLookup_(idNorm, "INACTIVE_SECRET", debugId, {
        rowIndex: inactiveMatch.rowIndex,
        status: inactiveMatch.status
      });
    }
    return emptyPortalSecretLookup_(idNorm, "NO_SECRET", debugId);
  } catch (e) {
    return emptyPortalSecretLookup_(idNorm, "SECRET_LOOKUP_FAILED", debugId, {
      error: clean_(stringifyGsError_(e) || String(e && e.message ? e.message : e))
    });
  }
}

function getPortalSecretForApplicant_(applicantId) {
  var res = lookupPortalSecretForApplicant_(applicantId);
  if (!res || res.found !== true || !clean_(res.secret || res.secretPlain || "")) {
    return {
      ok: false,
      code: clean_(res && res.reason || res && res.code || "NO_SECRET"),
      debugId: clean_(res && res.debugId || newDebugId_()),
      applicantId: clean_(applicantId || ""),
      found: false,
      reason: clean_(res && res.reason || "NO_SECRET"),
      status: clean_(res && res.status || "")
    };
  }
  res.secret = clean_(res.secret || res.secretPlain || "");
  return res;
}

function makePortalSecretForReset_() {
  return Utilities.getUuid();
}

function buildPortalSecretOutputRow_(idx, lastCol, applicantId, secretPlain, secretHash, nowIso, opts) {
  var row = [];
  for (var i = 0; i < lastCol; i++) row.push("");
  var map = idx || {};
  var options = (opts && typeof opts === "object") ? opts : {};
  if (map.ApplicantID) row[map.ApplicantID - 1] = clean_(applicantId || "");
  if (map.Email) row[map.Email - 1] = clean_(options.email || "");
  if (map.Full_Name) row[map.Full_Name - 1] = clean_(options.fullName || "");
  if (map.Secret_Plain) row[map.Secret_Plain - 1] = clean_(secretPlain || "");
  if (map.Secret) row[map.Secret - 1] = clean_(secretPlain || "");
  if (map.Secret_Hash) row[map.Secret_Hash - 1] = clean_(secretHash || "");
  if (map.Created_At) row[map.Created_At - 1] = nowIso;
  if (map.Last_Rotated_At) row[map.Last_Rotated_At - 1] = nowIso;
  if (map.Issued_At) row[map.Issued_At - 1] = nowIso;
  if (map.IssuedAt) row[map.IssuedAt - 1] = nowIso;
  if (map.Status) row[map.Status - 1] = "Active";
  return row;
}

function writeAdmissionPortalSecretMetadata_(sheet, rowNumber, secretHash, issuedAt) {
  var targetRow = Number(rowNumber || 0);
  if (!sheet || !targetRow || targetRow < 2) return { updated: false, fields: [] };
  var idx = getHeaderIndexMap_(sheet);
  var fields = [];
  if (idx.PortalTokenHash && clean_(secretHash || "")) {
    sheet.getRange(targetRow, idx.PortalTokenHash).setValue(clean_(secretHash || ""));
    fields.push("PortalTokenHash");
  }
  if (idx.PortalTokenIssuedAt) {
    sheet.getRange(targetRow, idx.PortalTokenIssuedAt).setValue(issuedAt || new Date());
    fields.push("PortalTokenIssuedAt");
  }
  return { updated: fields.length > 0, fields: fields };
}

function resetPortalSecretForApplicant_(applicantId, opts) {
  var debugId = newDebugId_();
  var options = (opts && typeof opts === "object") ? opts : {};
  var idNorm = clean_(applicantId || "");
  if (!idNorm) return emptyPortalSecretLookup_(idNorm, "MISSING_APPLICANT_ID", debugId);
  var secretPlain = clean_(options.secretPlain || "") || (options.usePortalSecretGenerator === true && typeof newPortalSecret_ === "function" ? newPortalSecret_() : makePortalSecretForReset_());
  var secretHash = typeof hashPortalSecret_ === "function" ? hashPortalSecret_(secretPlain) : "";
  var opened = openPortalSecretsExistingSheet_(debugId);
  if (!opened || opened.ok !== true) {
    return emptyPortalSecretLookup_(idNorm, clean_(opened && opened.code || "SECRET_LOOKUP_FAILED"), debugId, {
      error: clean_(opened && opened.error || "")
    });
  }
  try {
    var sh = opened.sheet;
    var lastCol = sh.getLastColumn();
    var lastRow = sh.getLastRow();
    if (lastCol < 1) return emptyPortalSecretLookup_(idNorm, "PORTAL_SECRETS_SCHEMA_EMPTY", debugId);
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var idx = buildPortalSecretHeaderIndex_(headers);
    var plainCol = resolvePortalSecretPlainColumnIndex_(idx);
    if (!idx.ApplicantID) return emptyPortalSecretLookup_(idNorm, "APPLICANT_ID_COLUMN_MISSING", debugId);
    if (!plainCol && !idx.Secret_Hash) return emptyPortalSecretLookup_(idNorm, "SECRET_COLUMN_MISSING", debugId);

    var data = lastRow >= 2 ? sh.getRange(2, 1, lastRow - 1, lastCol).getValues() : [];
    var idLower = idNorm.toLowerCase();
    var matchingRows = [];
    for (var r = 0; r < data.length; r++) {
      var rowId = clean_(data[r][idx.ApplicantID - 1]);
      if (rowId && rowId.toLowerCase() === idLower) matchingRows.push(r + 2);
    }
    var now = new Date();
    var nowIso = now.toISOString();
    var rowIndex = 0;
    var previousRowsInactive = 0;

    if (idx.Status) {
      for (var i = 0; i < matchingRows.length; i++) {
        var currentStatus = clean_(sh.getRange(matchingRows[i], idx.Status).getValue() || "");
        if (currentStatus === "Active") {
          sh.getRange(matchingRows[i], idx.Status).setValue("Inactive");
          previousRowsInactive++;
        }
      }
      var appendRow = buildPortalSecretOutputRow_(idx, lastCol, idNorm, secretPlain, secretHash, nowIso, options);
      rowIndex = sh.getLastRow() + 1;
      sh.getRange(rowIndex, 1, 1, lastCol).setValues([appendRow]);
    } else if (matchingRows.length) {
      rowIndex = matchingRows[0];
      if (plainCol) sh.getRange(rowIndex, plainCol).setValue(secretPlain);
      if (idx.Secret_Hash) sh.getRange(rowIndex, idx.Secret_Hash).setValue(secretHash);
      if (idx.Last_Rotated_At) sh.getRange(rowIndex, idx.Last_Rotated_At).setValue(nowIso);
      if (idx.Issued_At) sh.getRange(rowIndex, idx.Issued_At).setValue(nowIso);
      if (idx.IssuedAt) sh.getRange(rowIndex, idx.IssuedAt).setValue(nowIso);
    } else {
      var newRow = buildPortalSecretOutputRow_(idx, lastCol, idNorm, secretPlain, secretHash, nowIso, options);
      rowIndex = sh.getLastRow() + 1;
      sh.getRange(rowIndex, 1, 1, lastCol).setValues([newRow]);
    }

    var admissionsUpdate = writeAdmissionPortalSecretMetadata_(options.admissionsSheet, options.rowNumber, secretHash, now);
    return {
      applicantId: idNorm,
      secretPlain: secretPlain,
      secretHash: secretHash,
      issuedAt: nowIso,
      status: idx.Status ? "Active" : "",
      found: true,
      reason: "RESET",
      ok: true,
      code: "OK",
      secret: secretPlain,
      rowIndex: rowIndex,
      previousRowsInactive: previousRowsInactive,
      admissionsUpdated: admissionsUpdate.updated === true,
      admissionsFields: admissionsUpdate.fields,
      debugId: debugId
    };
  } catch (e) {
    return emptyPortalSecretLookup_(idNorm, "SECRET_RESET_FAILED", debugId, {
      error: clean_(stringifyGsError_(e) || String(e && e.message ? e.message : e))
    });
  }
}

function setPortalSecretForApplicant_(applicantId, newSecret) {
  var secretNorm = clean_(newSecret || "");
  if (!clean_(applicantId || "") || !secretNorm) return { ok: false, code: "NO_SECRET", debugId: newDebugId_() };
  return resetPortalSecretForApplicant_(applicantId, { secretPlain: secretNorm });
}

function buildStudentPortalUrl_(applicantId, secret) {
  var base = canonicalExecBase_(CONFIG.DEPLOYMENT_ID_STUDENT || CONFIG.WEBAPP_URL_STUDENT || "");
  if (!base) throw new Error("Missing canonical student exec base");
  return base
    + "?view=portal&id="
    + encodeURIComponent(clean_(applicantId || ""))
    + "&s="
    + encodeURIComponent(clean_(secret || ""));
}

function buildRuntimeTruth_(e, surfaceHint) {
  var params = (e && e.parameter && typeof e.parameter === "object") ? e.parameter : {};
  var requestedView = clean_(params.view || "").toLowerCase();
  var rawServiceUrl = "";
  var activeUser = "";
  var effectiveUser = "";
  var runtimeScriptId = "";
  var configScriptId = clean_(CONFIG.SCRIPT_ID || "");
  try { rawServiceUrl = clean_(ScriptApp.getService().getUrl() || ""); } catch (_rawErr) {}
  try { activeUser = clean_(Session.getActiveUser().getEmail() || ""); } catch (_activeErr) {}
  try { effectiveUser = clean_(Session.getEffectiveUser().getEmail() || ""); } catch (_effectiveErr) {}
  try { runtimeScriptId = clean_(ScriptApp.getScriptId() || ""); } catch (_scriptErr) {}

  var deployVersion = Number(CONFIG.DEPLOY_VERSION_NUMBER || 0);
  var adminBase = canonicalExecBase_(CONFIG.DEPLOYMENT_ID_ADMIN || CONFIG.WEBAPP_URL_ADMIN || "");
  var studentBase = canonicalExecBase_(CONFIG.DEPLOYMENT_ID_STUDENT || CONFIG.WEBAPP_URL_STUDENT || "");
  var serviceUrl = canonicalExecBase_(rawServiceUrl || adminBase || studentBase || "");
  var configAdminUrl = canonicalExecBase_(CONFIG.WEBAPP_URL_ADMIN || "");
  var configStudentUrl = canonicalExecBase_(CONFIG.WEBAPP_URL_STUDENT || CONFIG.WEBAPP_URL_STUDENT_EXEC || "");
  var warnings = [];

  if (rawServiceUrl && rawServiceUrl.indexOf('/a/') >= 0) warnings.push('ScriptApp service URL resolved as domain-scoped and was canonicalized for reporting.');

  var requestedSurface = clean_(surfaceHint || '');
  if (!requestedSurface) {
    if (requestedView === 'admin') requestedSurface = 'admin';
    else if (requestedView === 'portal') requestedSurface = 'student';
    else if (serviceUrl && adminBase && serviceUrl === adminBase) requestedSurface = 'admin';
    else if (serviceUrl && studentBase && serviceUrl === studentBase) requestedSurface = 'student';
    else requestedSurface = requestedView || 'unknown';
  }

  var runtime = {
    ok: true,
    endpoint: 'whoami',
    version: clean_(CONFIG.VERSION || ''),
    deployVersion: deployVersion,
    deploymentIdAdmin: clean_(CONFIG.DEPLOYMENT_ID_ADMIN || ''),
    deploymentIdStudent: clean_(CONFIG.DEPLOYMENT_ID_STUDENT || ''),
    serviceUrl: serviceUrl,
    canonicalAdminUrl: adminBase,
    canonicalStudentUrl: studentBase,
    activeUser: activeUser,
    effectiveUser: effectiveUser,
    requestedView: requestedView,
    requestedSurface: requestedSurface,
    scriptId: runtimeScriptId,
    scriptIdRuntime: runtimeScriptId,
    scriptIdConfig: configScriptId,
    timestamp: new Date().toISOString(),
    mismatch: false,
    warning: '',
    warnings: warnings,
    mismatches: []
  };

  if (runtime.deployVersion !== Number(CONFIG.DEPLOY_VERSION_NUMBER || 0)) {
    runtime.mismatch = true;
    runtime.mismatches.push('deployVersion mismatch');
  }
  if (runtime.deploymentIdAdmin !== clean_(CONFIG.DEPLOYMENT_ID_ADMIN || '')) {
    runtime.mismatch = true;
    runtime.mismatches.push('Admin deployment mismatch');
  }
  if (runtime.deploymentIdStudent !== clean_(CONFIG.DEPLOYMENT_ID_STUDENT || '')) {
    runtime.mismatch = true;
    runtime.mismatches.push('Student deployment mismatch');
  }
  if (runtime.canonicalAdminUrl !== configAdminUrl) {
    runtime.mismatch = true;
    runtime.mismatches.push('Admin URL mismatch');
  }
  if (runtime.canonicalStudentUrl !== configStudentUrl) {
    runtime.mismatch = true;
    runtime.mismatches.push('Student URL mismatch');
  }
  if (runtime.scriptIdRuntime !== runtime.scriptIdConfig) {
    runtime.mismatch = true;
    runtime.mismatches.push('Script ID mismatch');
  }
  if (runtime.requestedSurface === 'admin' && runtime.serviceUrl && runtime.canonicalAdminUrl && runtime.serviceUrl !== runtime.canonicalAdminUrl) {
    runtime.mismatch = true;
    runtime.mismatches.push('Admin service URL mismatch');
  }
  if (runtime.requestedSurface === 'student' && runtime.serviceUrl && runtime.canonicalStudentUrl && runtime.serviceUrl !== runtime.canonicalStudentUrl) {
    runtime.mismatch = true;
    runtime.mismatches.push('Student service URL mismatch');
  }
  if (!runtime.deployVersion || !runtime.deploymentIdAdmin || !runtime.deploymentIdStudent) {
    runtime.mismatch = true;
    runtime.mismatches.push('Missing runtime fields');
  }

  runtime.warning = runtime.mismatches.concat(runtime.warnings).join(' | ');
  return runtime;
}
function admin_getRuntimeInfo() {
  return buildRuntimeTruth_({ parameter: { view: 'admin' } }, 'admin');
}

// SV GROK Mar 7 function overwrite
function admin_getStudentPortalLink(payload) {
  var debugId = newDebugId_();
  try {
    var caller = "";
    try { caller = clean_(Session.getEffectiveUser().getEmail() || ""); } catch (_callerErr) {}

    if (!isAdminCaller_()) {
      return {
        ok: false,
        code: "ACCESS_DENIED",
        debugId: debugId,
        error: "Access denied"
      };
    }

    var p = (payload && typeof payload === "object")
      ? payload
      : { applicantId: payload };

    var applicantId = clean_(p.applicantId || p.id || "");
    var rowNumber = Number(p.rowNumber || 0);

    Logger.log("admin_getStudentPortalLink START " + JSON.stringify({
      debugId: debugId,
      applicantId: applicantId,
      rowNumber: rowNumber,
      caller: caller
    }));

    var ss = getWorkingSpreadsheet_();
    var sheet = mustGetDataSheet_(ss);

    if (!rowNumber || rowNumber < 2) {
      if (!applicantId) {
        throw new Error("Portal link error. Debug: missing applicant id");
      }
      rowNumber = findRowByApplicantId_(sheet, applicantId);
    }

    if (!rowNumber || rowNumber < 2) {
      throw new Error("Portal link error. Debug: applicant not found");
    }

    var rowObj = getRowObject_(sheet, rowNumber);
    applicantId = clean_(rowObj.ApplicantID || applicantId || "");
    if (!applicantId) {
      throw new Error("Portal link error. Debug: missing applicant id");
    }

    var secretRes = getPortalSecretForApplicant_(applicantId);
    if (!secretRes || secretRes.ok !== true || !clean_(secretRes.secret || "")) {
      throw new Error("Portal link error. Debug: token missing");
    }

    var portalUrl = buildStudentPortalUrl_(applicantId, clean_(secretRes.secret || ""));

    Logger.log("admin_getStudentPortalLink OK " + JSON.stringify({
      debugId: debugId,
      applicantId: applicantId,
      rowNumber: rowNumber,
      url: portalUrl
    }));

    return {
      ok: true,
      url: portalUrl,
      applicantId: applicantId,
      rowNumber: rowNumber,
      debugId: debugId
    };

  } catch (e) {
    var rawMsg = String(e && e.message ? e.message : e);
    var lowerMsg = String(rawMsg || "").toLowerCase();
    var isPermissionDoc = lowerMsg.indexOf("permission to access the requested document") >= 0;
    var isPortalSecretsHint = lowerMsg.indexOf("portalsecrets") >= 0 || lowerMsg.indexOf(String(CONFIG.PORTAL_SECRETS_SHEET_ID || "").toLowerCase()) >= 0;
    var isSecretsPermission = isPermissionDoc || isPortalSecretsHint;
    var userMsg = isSecretsPermission
      ? "Portal link cannot be generated because this admin account does not have access to the PortalSecrets store. Share the PortalSecrets spreadsheet with this user and retry."
      : rawMsg;

    Logger.log("admin_getStudentPortalLink FAIL " + JSON.stringify({
      debugId: debugId,
      message: rawMsg,
      classifiedCode: isSecretsPermission ? "PORTAL_SECRETS_ACCESS_DENIED" : "PORTAL_LINK_ERROR",
      stack: String((e && e.stack) || "")
    }));

    return {
      ok: false,
      code: isSecretsPermission ? "PORTAL_SECRETS_ACCESS_DENIED" : "PORTAL_LINK_ERROR",
      debugId: debugId,
      error: userMsg
    };
  }
}
function findPortalRowByIdSecret_(sheet, applicantId, secret) {
  var rowNum = findRowByApplicantId_(sheet, applicantId);
  if (!rowNum) return null;
  var secretRes = getPortalSecretForApplicant_(applicantId);
  if (!secretRes || secretRes.ok !== true) return null;
  if (clean_(secretRes.secret || "") !== clean_(secret || "")) return null;
  var record = getRowObject_(sheet, rowNum);
  return { rowNum: rowNum, record: record };
}

function isPortalTokenExpired_(issuedAtValue, maxAgeDays) {
  var maxDays = Number(maxAgeDays || 0);
  if (!maxDays || maxDays <= 0) return false;
  if (!issuedAtValue) return true;
  var issuedAt = new Date(issuedAtValue);
  if (isNaN(issuedAt.getTime())) return true;
  var ageMs = new Date().getTime() - issuedAt.getTime();
  return ageMs > (maxDays * 24 * 60 * 60 * 1000);
}

function getPortalRequestMeta_(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  return {
    ip: clean_(p.ip || p.clientIp || p.client_ip || p.x_forwarded_for || ""),
    ua: clean_(p.ua || p.userAgent || p.user_agent || "")
  };
}

function incrementInvalidPortalAttempt_(applicantId) {
  var cache = CacheService.getScriptCache();
  var key = "portal_invalid_" + clean_(applicantId || "unknown");
  var current = Number(cache.get(key) || 0);
  var next = current + 1;
  cache.put(key, String(next), 3600);
  return next;
}

function findRowByApplicantId_(sheet, applicantId) {
  var headerMap = getHeaderIndexMap_(sheet);
  var idCol = headerMap[SCHEMA.APPLICANT_ID];
  if (!idCol) throw new Error("Missing header: " + SCHEMA.APPLICANT_ID);
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var idNorm = clean_(applicantId);
  var idVals = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
  for (var r = 0; r < idVals.length; r++) {
    if (clean_(idVals[r][0]) === idNorm) return r + 2;
  }
  return null;
}

function findRowByIdEmail_(sheet, applicantId, parentEmailLower) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var idCol = headers.indexOf(CONFIG.APPLICANT_ID_HEADER);
  var emailCol = headers.indexOf("Parent_Email");
  if (idCol === -1 || emailCol === -1) return null;

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  var data = sheet.getRange(2, 1, lastRow - 1, sheet.getLastColumn()).getValues();
  for (var i = 0; i < data.length; i++) {
    var rowId = clean_(data[i][idCol]);
    var rowEmail = clean_(data[i][emailCol]).toLowerCase();
    if (rowId === applicantId && rowEmail === parentEmailLower) {
      var record = {};
      for (var c = 0; c < headers.length; c++) record[headers[c]] = data[i][c];
      return { rowNum: i + 2, record: record };
    }
  }
  return null;
}

/******************** EXAM SITES ********************/
function getExamSites_(ss) {
  var sh = ss.getSheetByName(CONFIG.EXAM_SITES_SHEET);
  if (!sh) return [];
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];
  var headers = values[0].map(function(h){ return String(h || "").trim(); });
  var nameIdx = headers.indexOf("Site_Name");
  var activeIdx = headers.indexOf("Active");
  if (nameIdx === -1) return [];

  var out = [];
  for (var i = 1; i < values.length; i++) {
    var name = String(values[i][nameIdx] || "").trim();
    var active = (activeIdx >= 0) ? String(values[i][activeIdx] || "").trim().toLowerCase() : "true";
    var isActive = (active === "true" || active === "yes" || active === "1");
    if (name && isActive) out.push(name);
  }
  return out;
}

/******************** SUBJECT NORMALIZATION ********************/
function subjectsToCsv_(raw) {
  if (Array.isArray(raw)) {
    return uniqCsv_(raw);
  }

  if (raw && typeof raw === "object") {
    var objectVals = [];
    for (var objectKey in raw) {
      if (Object.prototype.hasOwnProperty.call(raw, objectKey)) objectVals.push(raw[objectKey]);
    }
    return uniqCsv_(objectVals);
  }

  var s = clean_(raw);
  if (!s) return "";

  // JSON map like {"102":"Math","103":"Biology"}
  if (s.charAt(0) === "{" && (s.indexOf('":"') !== -1 || s.indexOf('": "') !== -1)) {
    try {
      var obj = JSON.parse(s);
      var vals = [];
      for (var k in obj) vals.push(clean_(obj[k]));
      return uniqCsv_(vals);
    } catch (e) {}
  }

  // "{102=English, 103=Math}" style
  if (s.indexOf("{") === 0 && s.indexOf("=") !== -1) {
    var inner = s.substring(1, s.length - 1);
    var parts = inner.split(",");
    var vals2 = [];
    for (var i = 0; i < parts.length; i++) {
      var p = parts[i].trim();
      if (p.indexOf("=") !== -1) vals2.push(clean_(p.split("=").slice(1).join("=")));
    }
    return uniqCsv_(vals2);
  }

  // CSV already
  return uniqCsv_(s.split(",").map(function(x){ return x.trim(); }));
}

// parse csv to Set(lowercased)
function parseSubjects_(csv) {
  var set = new Set();
  var s = clean_(csv);
  if (!s) return set;
  var parts = s.split(",");
  for (var i = 0; i < parts.length; i++) {
    var p = clean_(parts[i]).toLowerCase();
    if (p) set.add(p);
  }
  return set;
}

function uniqCsv_(arr) {
  var seen = {};
  var out = [];
  for (var i = 0; i < (arr || []).length; i++) {
    var v = clean_(arr[i]);
    if (!v) continue;
    var key = v.toLowerCase();
    if (!seen[key]) { seen[key] = true; out.push(v); }
  }
  return out.join(", ");
}

/******************** LOCK RULE ********************/
function isDocsVerified_(row) {
  var r = row || {};
  return r["Docs_Verified"] === "Yes";
}

function getPortalLockReason_(record) {
  var row = record || {};
  if (isPaymentVerifiedDerived_(row)) return "payment_verified";
  if (String(row[SCHEMA.PORTAL_ACCESS_STATUS] || "").trim() === "Locked") return "portal_access_locked";
  if (row._PortalHardLocked === true) return "hard_locked";
  return "";
}

function isPortalLocked_(record) {
  return !!getPortalLockReason_(record);
}

function isPaymentVerified_(record) {
  return isPaymentVerifiedDerived_(record) === true;
}

function isPaymentVerifiedDerived_(row) {
  row = row || {};
  var paymentBadge = canonicalPaymentBadge_(row);
  var paymentVerified = paymentBadge === "Verified";
  try {
    logOperationalBlock_("PAYMENT_CANONICAL_RECEIPT_STATUS", {
      applicantId: clean_(row.ApplicantID || ""),
      receiptStatus: clean_(row.Receipt_Status || ""),
      paymentBadge: paymentBadge,
      compatibilityRaw: clean_(row.Payment_Verified || ""),
      derived: paymentVerified
    });
  } catch (_logErr) {}
  return paymentVerified;
}

function isPaymentFreezeActive_(row) {
  return isPaymentVerifiedDerived_(row) === true;
}

function resolveDocStatusKeys_(row) {
  row = row || {};
  function pick_(keys) {
    for (var i = 0; i < keys.length; i++) {
      var k = keys[i];
      if (hasOwn_(row, k)) return k;
    }
    return keys[0];
  }
  return {
    birth: pick_(["Birth_ID_Status", "Birth_Status"]),
    report: pick_(["Report_Status"]),
    photo: pick_(["Photo_Status"]),
    transfer: pick_(["Transfer_Status"]),
    receipt: pick_(["Receipt_Status"])
  };
}

function derivePaymentVerified_(row) {
  row = row || {};
  var paymentVerified = isPaymentVerifiedDerived_(row);
  // Keep legacy compatibility column aligned when present in row object.
  if (hasOwn_(row, "Payment_Verified")) row.Payment_Verified = paymentVerified ? "Yes" : "";
  return paymentVerified;
}

function normalizeOverallDocValue_(v) {
  var s = clean_(v).toLowerCase();
  if (s === "verified" || s === "yes" || s === "true" || s === "1") return "Verified";
  if (s === "rejected" || s === "reject") return "Rejected";
  if (s === "fraudulent" || s === "fraud") return "Rejected";
  return "Pending";
}

function computeDocVerificationStatus_(row) {
  row = row || {};
  var keys = resolveDocStatusKeys_(row);
  var requiredDocs = [keys.birth, keys.report, keys.photo];
  var hasRejected = false;
  var allVerified = true;
  for (var i = 0; i < requiredDocs.length; i++) {
    var st = normalizeOverallDocValue_(row[requiredDocs[i]]);
    if (st === "Rejected") hasRejected = true;
    if (st !== "Verified") allVerified = false;
  }
  if (hasRejected) return "Rejected";
  if (allVerified) return "Verified";
  return "Pending";
}

function derivePaymentBadge_(row) {
  row = row || {};
  var keys = resolveDocStatusKeys_(row);
  var st = normalizeOverallDocValue_(row[keys.receipt]);
  if (st === "Verified") return "Verified";
  if (st === "Rejected") return "Rejected";
  return "Pending";
}

function deriveCanonicalPaymentState_(row) {
  var badge = derivePaymentBadge_(row);
  return {
    badge: badge,
    verified: badge === "Verified",
    rejected: badge === "Rejected",
    pending: badge !== "Verified" && badge !== "Rejected"
  };
}

function canonicalPaymentBadge_(row) {
  return deriveCanonicalPaymentState_(row).badge;
}

function isCanonicalPaymentVerified_(row) {
  return deriveCanonicalPaymentState_(row).verified === true;
}

function isCanonicalPaymentRejected_(row) {
  return deriveCanonicalPaymentState_(row).rejected === true;
}

function computeOverallStatus_(row) {
  row = row || {};
  var docStage = computeDocVerificationStatus_(row);
  var paymentBadge = canonicalPaymentBadge_(row);
  var paymentVerified = isPaymentVerifiedDerived_(row);
  // keep compatibility alignment
  if (hasOwn_(row, "Payment_Verified")) row.Payment_Verified = paymentVerified ? "Yes" : "";
  // Payment verification is the final milestone and must not be downgraded by doc edits.
  if (paymentVerified) return "Verified";
  if (docStage === "Verified" && paymentBadge !== "Verified") return "Docs_Verified";
  return "Pending";
}

function canOverrideOverall_(email) {
  var e = clean_(email).toLowerCase();
  if (!e) return false;
  var superList = (CONFIG.SUPER_ADMIN_EMAILS || []).map(function (x) { return clean_(x).toLowerCase(); });
  var elevatedList = (CONFIG.ELEVATED_OVERRIDE_EMAILS || []).map(function (x) { return clean_(x).toLowerCase(); });
  return superList.indexOf(e) >= 0 || elevatedList.indexOf(e) >= 0;
}

function canBypassPaymentFreeze_(email) {
  var e = clean_(email).toLowerCase();
  if (!e) return false;
  var superList = (CONFIG.SUPER_ADMIN_EMAILS || []).map(function (x) { return clean_(x).toLowerCase(); });
  return superList.indexOf(e) >= 0;
}

function computeFodeFeeQuote_(rowObj) {
  var row = rowObj || {};
  var registrationK = Number(CONFIG.FEE_REGISTRATION_KINA || 600);
  var perSubjectK = Number(CONFIG.FEE_PER_SUBJECT_KINA || 450);
  var csv = clean_(row.Subjects_Selected_Canonical || row[SCHEMA.SUBJECTS_CANONICAL] || "");
  if (!csv) csv = subjectsToCsv_(row.Subjects_Selected || "");
  var parts = csv ? csv.split(",") : [];
  var subjects = [];
  for (var i = 0; i < parts.length; i++) {
    var s = clean_(parts[i]);
    if (s) subjects.push(s);
  }
  var subjectCount = subjects.length;
  var subjectFeeK = perSubjectK * subjectCount;
  return {
    registrationK: registrationK,
    subjectCount: subjectCount,
    subjectFeeK: subjectFeeK,
    totalK: registrationK + subjectFeeK,
    subjectsList: subjects.join(", ")
  };
}

function buildAdminApplicantDeepLink_(applicantId) {
  var base = clean_(CONFIG.WEBAPP_URL_ADMIN || CONFIG.WEBAPP_URL || "");
  var id = clean_(applicantId || "");
  if (!base || !id) return "";
  return base + "?view=admin&open=" + encodeURIComponent(id);
}

function formatKina_(n) {
  var num = Number(n || 0);
  if (!isFinite(num)) num = 0;
  return "K" + String(Math.round(num));
}

function sendEmailBestEffort_(toEmail, subject, body, logLabel, meta) {
  var dbgId = newDebugId_();
  var to = clean_(toEmail || "");
  var lbl = clean_(logLabel || "EMAIL_SEND");
  var payload = meta && typeof meta === "object" ? meta : {};
  function safeEmailLogPayload_(obj) {
    try {
      log_(mustGetSheet_(getWorkingSpreadsheet_(), CONFIG.LOG_SHEET), lbl, JSON.stringify(obj || {}));
    } catch (_logErr) {
      try { Logger.log("%s %s", lbl, JSON.stringify(obj || {})); } catch (_e) {}
    }
  }
  try {
    if (!to) throw new Error("Missing recipient email");
    var unattendedBlock = blockUnattendedEmailSendIfNeeded_(clean_(payload.templateType || lbl || subject || ""), to, {
      action: clean_(payload.action || "send_email_best_effort"),
      sendSource: clean_(payload.sendSource || payload.source || ""),
      unattended: payload.unattended === true,
      applicantId: clean_(payload.applicantId || ""),
      rowObj: payload.rowObj && typeof payload.rowObj === "object" ? payload.rowObj : {},
      debugId: clean_(payload.debugId || dbgId || "")
    });
    if (unattendedBlock.blocked) {
      return { ok: false, debugId: dbgId, to: to, error: unattendedBlock.blockCode, blocked: true };
    }
    MailApp.sendEmail({
      to: to,
      subject: String(subject || ""),
      body: String(body || ""),
      name: clean_(CONFIG.EMAIL_FROM_NAME || "FODE")
    });
    safeEmailLogPayload_({
      ok: true,
      debugId: dbgId,
      to: to,
      subject: String(subject || ""),
      meta: payload
    });
    return { ok: true, debugId: dbgId, to: to };
  } catch (e) {
    safeEmailLogPayload_({
      ok: false,
      debugId: dbgId,
      to: to,
      subject: String(subject || ""),
      error: String(e && e.message ? e.message : e),
      meta: payload
    });
    return { ok: false, debugId: dbgId, to: to, error: String(e && e.message ? e.message : e) };
  }
}

function sendDocsVerifiedPaymentRequiredEmail_(rowObj, rowNumber, actorEmail) {
  var row = rowObj || {};
  var applicantId = clean_(row.ApplicantID || row[SCHEMA.APPLICANT_ID] || "");
  var recipient = clean_(row.Parent_Email_Corrected || row[SCHEMA.PARENT_EMAIL_CORRECTED] || row.Parent_Email || row[SCHEMA.PARENT_EMAIL] || "");
  var quote = computeFodeFeeQuote_(row);
  var sh = mustGetDataSheet_(getWorkingSpreadsheet_());
  var rowNum = Number(rowNumber || 0) || findRowByApplicantId_(sh, applicantId);
  var portalUrl = "";
  if (rowNum >= 2 && applicantId) {
    var emailForSecret = clean_(row.Parent_Email_Corrected || row.Parent_Email || "");
    var fullName = (clean_(row.First_Name || "") + " " + clean_(row.Last_Name || "")).trim();
    var secretInfo = getOrCreateActivePortalSecret_(applicantId, emailForSecret, fullName, sh, rowNum, {});
    portalUrl = buildPortalLinkFromBase_(clean_(getStudentBaseUrl_() || CONFIG.WEBAPP_URL_STUDENT || ""), applicantId, secretInfo.secretPlain);
  }
  var subject = "FODE Documents Verified - Payment Required - " + applicantId;
  var body = [
    "Dear Parent/Guardian,",
    "",
    "Your FODE application documents have been verified. Payment is now required to proceed.",
    "",
    "ApplicantID: " + applicantId,
    "",
    "Fee breakdown:",
    "- Registration Fee: " + formatKina_(quote.registrationK),
    "- Subjects Selected: " + quote.subjectCount + (quote.subjectsList ? (" (" + quote.subjectsList + ")") : ""),
    "- Subject Fee: " + formatKina_(quote.subjectFeeK) + " (" + formatKina_(CONFIG.FEE_PER_SUBJECT_KINA || 450) + " x " + quote.subjectCount + ")",
    "- Total Payable: " + formatKina_(quote.totalK),
    "",
    String(CONFIG.PAYMENT_INSTRUCTIONS_TEXT || "").trim(),
    "",
    portalUrl ? ("Upload payment receipt here: " + portalUrl) : "Portal link unavailable. Please contact admissions.",
    "",
    "ApplicantID: " + applicantId
  ].join("\n");
  var sendRes = sendEmailBestEffort_(recipient, subject, body, "DOCS_VERIFIED_EMAIL_SENT", {
    applicantId: applicantId,
    rowNumber: rowNum,
    by: clean_(actorEmail || ""),
    recipient: recipient,
    feeQuote: quote,
    rowObj: row,
    templateType: "docs_verified_payment_required",
    sendSource: "DOCS_VERIFIED_WORKFLOW",
    unattended: true,
    action: "docs_verified_payment_required_email"
  });
  sendRes.portalUrl = portalUrl;
  sendRes.feeQuote = quote;
  return sendRes;
}

function notifyAdminPaymentReceiptUploaded_(rowObj, rowNumber, opts) {
  var row = rowObj || {};
  opts = opts || {};
  var applicantId = clean_(row.ApplicantID || row[SCHEMA.APPLICANT_ID] || "");
  var fullName = (clean_(row.First_Name || "") + " " + clean_(row.Last_Name || "")).trim();
  var toEmail = clean_(CONFIG.EMAIL_ADMIN_ALERTS_TO || "");
  var subject = "PAYMENT RECEIPT UPLOADED - " + applicantId + " - " + (fullName || "Unknown");
  var adminUrl = buildAdminApplicantDeepLink_(applicantId);
  var body = [
    "Payment receipt uploaded.",
    "",
    "ApplicantID: " + applicantId,
    "Name: " + (fullName || "-"),
    "Timestamp: " + (new Date()).toISOString(),
    "RowNumber: " + String(Number(rowNumber || 0) || ""),
    "",
    "Admin review URL:",
    adminUrl || "(admin URL not configured)"
  ].join("\n");
  try {
    log_(mustGetSheet_(getWorkingSpreadsheet_(), CONFIG.LOG_SHEET), "PAYMENT_RECEIPT_UPLOADED", JSON.stringify({
      applicantId: applicantId,
      rowNumber: Number(rowNumber || 0) || "",
      source: clean_(opts.source || ""),
      oldValue: clean_(opts.oldValue || ""),
      newValue: clean_(opts.newValue || "")
    }));
  } catch (_alertLogErr) {}
  return sendEmailBestEffort_(toEmail, subject, body, "PAYMENT_RECEIPT_ALERT_EMAIL", {
    applicantId: applicantId,
    rowNumber: Number(rowNumber || 0) || "",
    source: clean_(opts.source || ""),
    adminUrl: adminUrl,
    rowObj: row,
    templateType: "payment_receipt_alert",
    sendSource: "PAYMENT_RECEIPT_WORKFLOW",
    unattended: true,
    action: "payment_receipt_alert_email"
  });
}

function maybeNotifyPaymentReceiptUploadTransition_(beforeRow, afterRow, rowNumber, opts) {
  var prevUrl = clean_((beforeRow || {}).Fee_Receipt_File || "");
  var nextUrl = clean_((afterRow || {}).Fee_Receipt_File || "");
  if (!nextUrl) return { notified: false, reason: "empty" };
  if (prevUrl === nextUrl) return { notified: false, reason: "unchanged" };
  var alertRes = notifyAdminPaymentReceiptUploaded_(afterRow || beforeRow || {}, rowNumber, Object.assign({
    oldValue: prevUrl,
    newValue: nextUrl
  }, opts || {}));
  return { notified: true, alert: alertRes };
}

function buildCrmPayloadFromRow_(rowObj) {
  var row = rowObj || {};
  var applicantId = clean_(row.ApplicantID || row[SCHEMA.APPLICANT_ID] || "");
  var firstName = clean_(row.First_Name || "");
  var lastName = clean_(row.Last_Name || "");
  var emailCorrected = clean_(row.Parent_Email_Corrected || row[SCHEMA.PARENT_EMAIL_CORRECTED] || "");
  var emailRaw = clean_(row.Parent_Email || row[SCHEMA.PARENT_EMAIL] || "");
  var effectiveEmail = emailCorrected || emailRaw;
  var intakeYear = clean_(row.Intake_Year || "");
  if (!intakeYear) intakeYear = String((new Date()).getFullYear() + 1);
  return {
    applicantId: applicantId,
    firstName: firstName,
    lastName: lastName,
    fullName: (firstName + " " + lastName).trim(),
    parentEmail: emailRaw,
    parentEmailCorrected: emailCorrected,
    effectiveEmail: effectiveEmail,
    parentPhone: clean_(row.Parent_Phone || ""),
    gradeApplyingFor: clean_(row.Grade_Applying_For || ""),
    intakeYear: intakeYear,
    crmPipeline: clean_(CONFIG.CRM_PIPELINE_FODE || ""),
    crmStage: clean_(CONFIG.CRM_STAGE_PAYMENT_VERIFIED || CONFIG.DEAL_STAGE || ""),
    subjects: clean_(row.Subjects_Selected_Canonical || subjectsToCsv_(row.Subjects_Selected || "")),
    folderUrl: clean_(row.Folder_Url || row[SCHEMA.FOLDER_URL] || ""),
    formId: clean_(row.FormID || row.FD_FormID || "")
  };
}

function deriveFodeCrmStageFromRow_(rowObj) {
  var row = rowObj || {};
  var overallStatus = clean_(row.Overall_Status || row["Overall Status"] || row.Status || row["Application Status"] || "");
  var registrationComplete = clean_(row.Registration_Complete || "") === "Yes";
  var paymentVerified = (typeof isCanonicalPaymentVerified_ === 'function' && isCanonicalPaymentVerified_(row));
  var queueState = typeof classifyAdminQueueState_ === 'function' ? clean_(classifyAdminQueueState_(row) || "") : "";
  var admissionGranted = registrationComplete || queueState === "enrolled_ready" || (/approved|granted|enrolled_ready/i.test(overallStatus) && paymentVerified);

  if (paymentVerified && admissionGranted) return clean_(CONFIG.CRM_STAGE_ADMISSION_GRANTED || "Admission Granted");
  if (paymentVerified) return clean_(CONFIG.CRM_STAGE_PAYMENT_CONFIRMED || "Payment Confirmed");
  return "";
}

function shouldCreateFodeCrmDeal_(rowObj) {
  var row = rowObj || {};
  if (clean_(row.Deal_ID || "")) return false;
  var stage = deriveFodeCrmStageFromRow_(row);
  return stage === clean_(CONFIG.CRM_STAGE_ADMISSION_GRANTED || "Admission Granted");
}

function shouldCreateFodeCrmInvoice_(rowObj) {
  var row = rowObj || {};
  // `CRM_Invoice_Triggered` is retained as a legacy compatibility marker only.
  if (CONFIG.ENABLE_CRM_LEGACY_QUARANTINE === true) return false;
  if (CONFIG.ENABLE_INVOICE_WEBHOOK_HANDOFF !== true) return false;
  logS4aOutboundTrace_("S4A_CRM_SUSPECT_PATH", {
    sourceFunction: "shouldCreateFodeCrmInvoice_",
    configKeyName: "INVOICE_WEBHOOK_URL",
    destinationHost: redactUrlForLog_(clean_(CONFIG.INVOICE_WEBHOOK_URL || "")),
    applicantId: clean_(row.ApplicantID || ""),
    formId: clean_(row.FormID || row.FD_FormID || ""),
    operationType: "crm_invoice_eligibility_check",
    timestamp: new Date().toISOString()
  });
  if (!clean_(row.Deal_ID || "")) return false;
  if (clean_(row.CRM_Invoice_Triggered || "")) return false;
  var stage = deriveFodeCrmStageFromRow_(row);
  return stage === clean_(CONFIG.CRM_STAGE_PAYMENT_CONFIRMED || "Payment Confirmed")
    || stage === clean_(CONFIG.CRM_STAGE_ADMISSION_GRANTED || "Admission Granted");
}

function ensureStableFormId_(rowObj, sh, rowNumber, idx) {
  var row = rowObj || {};
  var stable = clean_(row.FormID || row.FD_FormID || "");
  if (stable) return stable;
  var applicantId = clean_(row.ApplicantID || row[SCHEMA.APPLICANT_ID] || "");
  stable = applicantId ? ("FODE_" + applicantId) : ("FODE_" + Utilities.formatDate(new Date(), "UTC", "yyyyMMddHHmmss"));
  var formCol = idx && idx.FormID ? "FormID" : (idx && idx.FD_FormID ? "FD_FormID" : "");
  if (formCol) {
    sh.getRange(rowNumber, idx[formCol]).setValue(stable);
    row[formCol] = stable;
  }
  return stable;
}

function readRowSnapshot_(applicantId) {
  var id = clean_(applicantId || "");
  if (!id) return null;
  var ss = getWorkingSpreadsheet_();
  var sheet = mustGetDataSheet_(ss);
  var rowNum = findRowByApplicantId_(sheet, id);
  if (!rowNum) return null;
  var rowObj = getRowObject_(sheet, rowNum) || {};
  var out = {
    ApplicantID: clean_(rowObj.ApplicantID || ""),
    Birth_Status: clean_(rowObj.Birth_Status || ""),
    Report_Status: clean_(rowObj.Report_Status || ""),
    Photo_Status: clean_(rowObj.Photo_Status || ""),
    Transfer_Status: clean_(rowObj.Transfer_Status || ""),
    Receipt_Status: clean_(rowObj.Receipt_Status || "")
  };
  if (Object.prototype.hasOwnProperty.call(rowObj, "Doc_Verification_Status")) {
    out.Doc_Verification_Status = clean_(rowObj.Doc_Verification_Status || "");
  }
  if (Object.prototype.hasOwnProperty.call(rowObj, "Overall_Status")) {
    out.Overall_Status = clean_(rowObj.Overall_Status || "");
  }
  if (Object.prototype.hasOwnProperty.call(rowObj, "Payment_Verified")) {
    out.Payment_Verified = clean_(rowObj.Payment_Verified || "");
  }
  return out;
}

/******************** SHEET HELPERS ********************/
function ensureHeaders_(sheet, payload) {
  var meta = [
  CONFIG.APPLICANT_ID_HEADER,
  "Folder_Url",
  "PortalLastUpdateAt",
  "Portal_Submitted",
  SCHEMA.PORTAL_TOKEN_HASH,
  SCHEMA.PORTAL_TOKEN_ISSUED_AT,
  SCHEMA.PORTAL_ACCESS_STATUS,
  "Physical_Exam_Site",
  "Subjects_Selected_Canonical",
  CONFIG.PARENT_EMAIL_CORRECTED_HEADER,
  "File_Log",

  // ??????????????????????????????????? NEW ?????????????????????????????????????? verification tracking
  "Doc_Last_Verified_At",
  "Doc_Last_Verified_By"
];


  for (var i = 0; i < CONFIG.DOC_FIELDS.length; i++) {
    meta.push(CONFIG.DOC_FIELDS[i].status);
    meta.push(CONFIG.DOC_FIELDS[i].comment);
  }

  var headersWanted = Object.keys(payload).concat(meta);

  if (sheet.getLastRow() === 0) { sheet.appendRow(headersWanted); return; }

  var existing = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var changed = false;

  for (var j = 0; j < headersWanted.length; j++) {
    if (existing.indexOf(headersWanted[j]) === -1) { existing.push(headersWanted[j]); changed = true; }
  }

  if (changed) sheet.getRange(1, 1, 1, existing.length).setValues([existing]);
}

function logActivation_(logSheet, label, payload) {
  try {
    log_(logSheet, label, JSON.stringify(payload || {}));
  } catch (logErr) {
    try {
      Logger.log(label + " " + JSON.stringify(payload || {}));
    } catch (_loggerErr) {}
  }
}

function scanApplicantIdState_(sheet) {
  var idCol = findCol_(sheet, CONFIG.APPLICANT_ID_HEADER);
  if (!idCol) throw new Error(CONFIG.APPLICANT_ID_HEADER + " column not found.");
  var lastRow = sheet.getLastRow();
  var rowCount = Math.max(lastRow - 1, 0);
  var values = rowCount > 0 ? sheet.getRange(2, idCol, rowCount, 1).getValues() : [];
  var prefix = CONFIG.APPLICANT_PREFIX;
  var digits = CONFIG.APPLICANT_DIGITS;
  var re = new RegExp("^" + escapeRegExp_(prefix) + "(\\d{" + digits + "})$");
  var maxSuffix = 0;
  var validCount = 0;
  var skippedBlankCount = 0;
  var skippedMalformedCount = 0;
  for (var i = 0; i < values.length; i++) {
    var s = String(values[i][0] || "").trim();
    if (!s) {
      skippedBlankCount++;
      continue;
    }
    var m = s.match(re);
    if (!m) {
      skippedMalformedCount++;
      continue;
    }
    var n = parseInt(m[1], 10);
    if (isNaN(n)) {
      skippedMalformedCount++;
      continue;
    }
    validCount++;
    if (n > maxSuffix) maxSuffix = n;
  }
  return {
    applicantId: prefix + String(maxSuffix + 1).padStart(digits, "0"),
    validCount: validCount,
    maxSuffix: maxSuffix,
    skippedBlankCount: skippedBlankCount,
    skippedMalformedCount: skippedMalformedCount
  };
}

function nextApplicantId_(sheet) {
  return scanApplicantIdState_(sheet).applicantId;
}

function preparePortalActivationState_(sheet, applicantId) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var hasTokenHashHeader = headers.indexOf("PortalTokenHash") >= 0;
  var hasTokenIssuedAtHeader = headers.indexOf("PortalTokenIssuedAt") >= 0;
  var plainSecret = newPortalSecret_();
  var tokenHash = hashPortalSecret_(plainSecret);
  var tokenIssuedAt = new Date();
  return {
    hasTokenHashHeader: hasTokenHashHeader,
    hasTokenIssuedAtHeader: hasTokenIssuedAtHeader,
    tokenHash: hasTokenHashHeader ? tokenHash : "",
    tokenIssuedAt: hasTokenIssuedAtHeader ? tokenIssuedAt : "",
    plainSecret: plainSecret,
    secretHash: tokenHash,
    applicantId: clean_(applicantId || ""),
    portalSecretsRequired: true
  };
}

function ensurePortalActivationStoreHeaders_(sheet) {
  var expected = [
    "ApplicantID",
    "Email",
    "Full_Name",
    "Secret_Plain",
    "Secret_Hash",
    "Created_At",
    "Last_Rotated_At",
    "Status"
  ];
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, expected.length).setValues([expected]);
    return;
  }
  var current = sheet.getRange(1, 1, 1, Math.max(sheet.getLastColumn(), expected.length)).getValues()[0].map(function(v) {
    return clean_(v);
  });
  var changed = false;
  for (var i = 0; i < expected.length; i++) {
    if (current.indexOf(expected[i]) === -1) {
      current.push(expected[i]);
      changed = true;
    }
  }
  if (changed) sheet.getRange(1, 1, 1, current.length).setValues([current]);
}

function commitPortalActivationState_(payload, applicantId, tokenState) {
  if (!tokenState || tokenState.portalSecretsRequired !== true) return { ok: true, skipped: true };
  var ss = SpreadsheetApp.openById(PORTAL_SECRETS_SPREADSHEET_ID);
  var sh = ss.getSheetByName(PORTAL_SECRETS_TAB);
  if (!sh) sh = ss.insertSheet(PORTAL_SECRETS_TAB);
  ensurePortalActivationStoreHeaders_(sh);
  var idx = {};
  var headers = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    var h = clean_(headers[i]);
    if (h) idx[h] = i + 1;
  }
  var lastRow = sh.getLastRow();
  var rowIndex = 0;
  if (idx.ApplicantID && lastRow >= 2) {
    var ids = sh.getRange(2, idx.ApplicantID, lastRow - 1, 1).getValues();
    for (var r = 0; r < ids.length; r++) {
      if (clean_(ids[r][0]) === clean_(applicantId || "")) {
        rowIndex = r + 2;
        break;
      }
    }
  }
  var nowIso = new Date().toISOString();
  var email = clean_(payload.Parent_Email_Corrected || payload.Parent_Email || payload.email || "");
  var fullName = (clean_(payload.First_Name || "") + " " + clean_(payload.Last_Name || "")).trim();
  var patch = {
    ApplicantID: clean_(applicantId || ""),
    Email: email,
    Full_Name: fullName,
    Secret_Plain: clean_(tokenState.plainSecret || ""),
    Secret_Hash: clean_(tokenState.secretHash || ""),
    Last_Rotated_At: nowIso,
    Status: "Active"
  };
  if (rowIndex) {
    var createdAt = idx.Created_At ? sh.getRange(rowIndex, idx.Created_At).getValue() : "";
    if (!clean_(createdAt)) patch.Created_At = nowIso;
    for (var key in patch) {
      if (!Object.prototype.hasOwnProperty.call(patch, key)) continue;
      if (!idx[key]) continue;
      sh.getRange(rowIndex, idx[key]).setValue(patch[key]);
    }
    return { ok: true, rowIndex: rowIndex, created: false };
  }
  sh.appendRow([
    clean_(applicantId || ""),
    email,
    fullName,
    clean_(tokenState.plainSecret || ""),
    clean_(tokenState.secretHash || ""),
    nowIso,
    nowIso,
    "Active"
  ]);
  return { ok: true, rowIndex: sh.getLastRow(), created: true };
}

function fileExtensionFromName_(name) {
  var raw = clean_(name || "");
  var idx = raw.lastIndexOf(".");
  if (idx < 0 || idx === raw.length - 1) return "";
  return raw.slice(idx + 1).replace(/[^a-zA-Z0-9]+/g, "").toLowerCase();
}

function fileExtensionFromUrl_(url) {
  var raw = clean_(url || "");
  var match = raw.match(/\.([a-zA-Z0-9]{1,10})(?:[?#].*)?$/);
  return match ? clean_(match[1] || "").toLowerCase() : "";
}

function fileExtensionFromContentType_(contentType) {
  var type = clean_(contentType || "").toLowerCase();
  if (!type) return "";
  var map = {
    "application/pdf": "pdf",
    "image/jpeg": "jpg",
    "image/jpg": "jpg",
    "image/png": "png",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/heic": "heic",
    "image/heif": "heif",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
    "application/vnd.ms-excel": "xls",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
    "text/plain": "txt"
  };
  return map[type] || "";
}

function describeDocFieldPayloadShape_(payload, field) {
  var hasField = !!field && payload && Object.prototype.hasOwnProperty.call(payload, field);
  if (!hasField) {
    return {
      present: false,
      shape: "missing",
      normalizedUrls: [],
      normalizedUrlCount: 0
    };
  }
  var rawValue = payload[field];
  var normalizedUrls = normalizeToUrlList_(rawValue, field);
  var shape = "non-URL value";
  if (rawValue == null) {
    shape = "empty string";
  } else if (Array.isArray(rawValue)) {
    shape = rawValue.length ? ("array(" + rawValue.length + ")") : "[]";
  } else if (typeof rawValue === "string") {
    var trimmed = rawValue.trim();
    if (!trimmed) shape = "empty string";
    else if (trimmed === "[]") shape = "[]";
    else if (normalizedUrls.length > 0) shape = "URL/string";
    else shape = "non-URL value";
  }
  return {
    present: true,
    shape: shape,
    normalizedUrls: normalizedUrls,
    normalizedUrlCount: normalizedUrls.length
  };
}

function summarizeDocFieldPayloadShapes_(payload, fields) {
  var inspectedFields = Array.isArray(fields) ? fields.slice() : [];
  var normalizedUrlsByField = {};
  var normalizedUrlCounts = {};
  var fieldShapeSummary = {};
  var presentFieldCount = 0;
  var usableUrlCount = 0;
  for (var i = 0; i < inspectedFields.length; i++) {
    var field = clean_(inspectedFields[i] || "");
    if (!field) continue;
    var summary = describeDocFieldPayloadShape_(payload, field);
    if (summary.present) presentFieldCount++;
    normalizedUrlsByField[field] = summary.normalizedUrls || [];
    normalizedUrlCounts[field] = Number(summary.normalizedUrlCount || 0);
    fieldShapeSummary[field] = summary.shape || "missing";
    usableUrlCount += Number(summary.normalizedUrlCount || 0);
  }
  return {
    inspectedFields: inspectedFields,
    inspectedFieldCount: inspectedFields.length,
    presentFieldCount: presentFieldCount,
    allConfiguredFieldsPresent: inspectedFields.length > 0 && presentFieldCount === inspectedFields.length,
    usableUrlCount: usableUrlCount,
    normalizedUrlsByField: normalizedUrlsByField,
    normalizedUrlCounts: normalizedUrlCounts,
    fieldShapeSummary: fieldShapeSummary
  };
}

function shouldLogEmptyDocumentPayloadWarning_(summary, canonicalizedFileCount) {
  var info = (summary && typeof summary === "object") ? summary : {};
  return Number(info.inspectedFieldCount || 0) > 0
    && info.allConfiguredFieldsPresent === true
    && Number(info.usableUrlCount || 0) === 0
    && Number(canonicalizedFileCount || 0) === 0;
}

function canonicalizeFdIntakeFiles_(payload, applicantFolder, logSheet, context) {
  var sourcePayload = payload || {};
  var out = {};
  for (var key in sourcePayload) {
    if (!Object.prototype.hasOwnProperty.call(sourcePayload, key)) continue;
    out[key] = sourcePayload[key];
  }
  if (!applicantFolder) return out;

  var ctx = (context && typeof context === "object") ? context : {};
  var correlationId = clean_(ctx.correlationId || "");
  var applicantId = clean_(ctx.applicantId || "");
  var folderId = clean_(applicantFolder.getId ? applicantFolder.getId() : "");
  var folderUrl = clean_(applicantFolder.getUrl ? applicantFolder.getUrl() : "");
  var fileLog = clean_(out.File_Log || "");
  var fields = (CONFIG.DOC_FIELDS || []).map(function (doc) {
    return clean_(doc && doc.file || "");
  }).filter(function (field) {
    return !!field;
  });
  var docFieldSummary = summarizeDocFieldPayloadShapes_(out, fields);
  var canonicalizedFileCount = 0;

  for (var i = 0; i < fields.length; i++) {
    var field = fields[i];
    var rawUrls = docFieldSummary.normalizedUrlsByField[field] || [];
    if (!rawUrls.length) continue;
    var canonicalUrls = [];
    for (var u = 0; u < rawUrls.length; u++) {
      var rawUrl = clean_(rawUrls[u]);
      if (!rawUrl) continue;
      try {
        logS4aOutboundTrace_("S4A_OUTBOUND_TRACE", {
          sourceFunction: "activationFileCanonicalize",
          configKeyName: "",
          destinationHost: redactUrlForLog_(rawUrl),
          applicantId: applicantId,
          formId: clean_(out.FormID || out.FD_FormID || ""),
          operationType: "remote_file_fetch",
          timestamp: new Date().toISOString()
        });
        var response = UrlFetchApp.fetch(rawUrl, { muteHttpExceptions: true });
        var responseCode = Number(response && response.getResponseCode ? response.getResponseCode() : 0);
        if (responseCode != 200) {
          logActivation_(logSheet, "ACTIVATION_FILE_CANONICALIZE_SKIP", {
            correlation_id: correlationId,
            applicantId: applicantId,
            field: field,
            reason: "fetch_failed",
            rawUrl: rawUrl,
            responseCode: responseCode
          });
          continue;
        }
        var blob = response.getBlob();
        if (!blob) {
          logActivation_(logSheet, "ACTIVATION_FILE_CANONICALIZE_SKIP", {
            correlation_id: correlationId,
            applicantId: applicantId,
            field: field,
            reason: "blob_missing",
            rawUrl: rawUrl
          });
          continue;
        }
        var timestamp = Utilities.formatDate(new Date(), Session.getScriptTimeZone() || "Pacific/Port_Moresby", "yyyyMMdd_HHmmss_SSS");
        var ext = fileExtensionFromContentType_(blob.getContentType()) || fileExtensionFromUrl_(rawUrl) || fileExtensionFromName_(blob.getName()) || "bin";
        var newName = field + "_" + timestamp + (ext ? ("." + ext) : "");
        blob.setName(newName);
        var newFile = applicantFolder.createFile(blob);
        newFile.setName(newName);
        var newUrl = clean_(newFile.getUrl() || "");
        if (!newUrl) {
          logActivation_(logSheet, "ACTIVATION_FILE_CANONICALIZE_SKIP", {
            correlation_id: correlationId,
            applicantId: applicantId,
            field: field,
            reason: "canonical_url_missing",
            rawUrl: rawUrl,
            newFileId: clean_(newFile.getId() || "")
          });
          continue;
        }
        try {
          var docFieldForPreview = null;
          var docFieldsForPreview = Array.isArray(CONFIG.DOC_FIELDS) ? CONFIG.DOC_FIELDS : [];
          for (var dfp = 0; dfp < docFieldsForPreview.length; dfp++) {
            if (clean_(docFieldsForPreview[dfp] && docFieldsForPreview[dfp].file || "") === field) {
              docFieldForPreview = docFieldsForPreview[dfp];
              break;
            }
          }
          var previewResult = adminDocumentGalleryPrepareStoredRendition_({
            ok: true,
            applicantId: applicantId,
            rowNumber: 0,
            sourceField: field,
            itemIndex: u,
            docField: docFieldForPreview || { file: field, label: field },
            file: newFile,
            folderId: folderId
          });
          logActivation_(logSheet, previewResult && previewResult.ok === true ? "ACTIVATION_FILE_PREVIEW_RENDITION_READY" : "ACTIVATION_FILE_PREVIEW_RENDITION_SKIP", {
            correlation_id: correlationId,
            applicantId: applicantId,
            field: field,
            itemIndex: u,
            newFileId: clean_(newFile.getId() || ""),
            folderId: folderId,
            code: clean_(previewResult && previewResult.code || ""),
            renditionKind: clean_(previewResult && previewResult.renditionKind || ""),
            renditionFileName: clean_(previewResult && previewResult.renditionFileName || ""),
            generated: !!(previewResult && previewResult.generated)
          });
        } catch (previewErr) {
          logActivation_(logSheet, "ACTIVATION_FILE_PREVIEW_RENDITION_SKIP", {
            correlation_id: correlationId,
            applicantId: applicantId,
            field: field,
            itemIndex: u,
            newFileId: clean_(newFile.getId() || ""),
            folderId: folderId,
            reason: "preview_generation_failed",
            error: String(previewErr && previewErr.message ? previewErr.message : previewErr)
          });
        }
        canonicalUrls.push(newUrl);
        canonicalizedFileCount++;
        fileLog = appendLog_(fileLog, new Date().toISOString()
          + " | " + field
          + " | fetched_and_copied"
          + " | rawUrl=" + rawUrl
          + " | newFileId=" + clean_(newFile.getId() || "")
          + " | folder=" + folderId);
        logActivation_(logSheet, "ACTIVATION_FILE_CANONICALIZED", {
          correlation_id: correlationId,
          applicantId: applicantId,
          field: field,
          rawUrl: rawUrl,
          newFileId: clean_(newFile.getId() || ""),
          folderId: folderId,
          folderUrl: folderUrl
        });
      } catch (fileErr) {
        logActivation_(logSheet, "ACTIVATION_FILE_CANONICALIZE_SKIP", {
          correlation_id: correlationId,
          applicantId: applicantId,
          field: field,
          reason: "fetch_or_create_failed",
          rawUrl: rawUrl,
          error: String(fileErr && fileErr.message ? fileErr.message : fileErr)
        });
      }
    }
    out[field] = canonicalUrls.join("\n");
  }
  if (shouldLogEmptyDocumentPayloadWarning_(docFieldSummary, canonicalizedFileCount)) {
    logActivation_(logSheet, "ACTIVATION_FILE_PAYLOAD_EMPTY_WARNING", {
      correlation_id: correlationId,
      applicantId: applicantId,
      formId: clean_(out.FormID || out.FD_FormID || ""),
      fieldNamesInspected: docFieldSummary.inspectedFields,
      rawValueShapeSummary: docFieldSummary.fieldShapeSummary,
      normalizedUrlCounts: docFieldSummary.normalizedUrlCounts,
      usableUrlCount: docFieldSummary.usableUrlCount,
      canonicalizedFileCount: canonicalizedFileCount,
      allConfiguredFieldsPresent: docFieldSummary.allConfiguredFieldsPresent === true,
      presentDocFieldCount: docFieldSummary.presentFieldCount,
      applicantFolderId: folderId,
      applicantFolderUrl: folderUrl,
      recommendedOperatorAction: "Documents not received from FormDesigner payload; request applicant to resend/upload documents."
    });
  }
  out.File_Log = fileLog;
  return out;
}

function maybeStampActivationSubmitState_(payload, logSheet, context) {
  var out = payload || {};
  var ctx = (context && typeof context === "object") ? context : {};
  var applicantId = clean_(ctx.applicantId || "");
  var qualifyingFieldsDetected = (CONFIG.DOC_FIELDS || []).filter(function (doc) {
    return clean_(doc && doc.file || "") !== "Fee_Receipt_File";
  }).map(function (doc) {
    return clean_(doc && doc.file || "");
  }).filter(function (field) {
    return !!field && normalizeToUrlList_(out[field], field).length > 0;
  });
  var shouldStampSubmitState = qualifyingFieldsDetected.length > 0;
  logActivation_(logSheet, "ACTIVATION_SUBMIT_STATE_DECISION", {
    applicantId: applicantId,
    shouldStampSubmitState: shouldStampSubmitState,
    qualifyingFieldsDetected: qualifyingFieldsDetected
  });
  if (!shouldStampSubmitState) return out;

  var nowIso = new Date().toISOString();
  if (!clean_(out.PortalLastUpdateAt || "")) out.PortalLastUpdateAt = nowIso;
  if (!clean_(out.Portal_Submitted || "")) out.Portal_Submitted = nowIso;
  logActivation_(logSheet, "ACTIVATION_SUBMIT_STATE_STAMPED", {
    applicantId: applicantId,
    PortalLastUpdateAt: clean_(out.PortalLastUpdateAt || ""),
    Portal_Submitted: clean_(out.Portal_Submitted || "")
  });
  return out;
}

function buildActivatedIntakeRow_(sheet, payload, folderUrl, applicantId, tokenState) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = [];
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i];
    if (h === CONFIG.APPLICANT_ID_HEADER) row.push(clean_(applicantId || ""));
    else if (h === "Folder_Url") row.push(clean_(folderUrl || ""));
    else if (h === "PortalTokenHash" && tokenState && tokenState.hasTokenHashHeader) row.push(clean_(tokenState.tokenHash || ""));
    else if (h === "PortalTokenIssuedAt" && tokenState && tokenState.hasTokenIssuedAtHeader) row.push(tokenState.tokenIssuedAt || "");
    else row.push(normalize_(payload[h]));
  }
  return row;
}

function normalizeDuplicateKey_(value) {
  return clean_(value || "").toLowerCase().replace(/\s+/g, " ").trim();
}

function normalizeDuplicatePhoneKey_(value) {
  return clean_(value || "").replace(/\D/g, "");
}

function normalizeDuplicateDobKey_(value) {
  return toIsoDateInput_(value) || normalizeDuplicateKey_(value);
}

function buildIntakeDuplicateCandidate_(payload) {
  var p = payload || {};
  var first = normalizeDuplicateKey_(p.First_Name || p.Student_First_Name || "");
  var last = normalizeDuplicateKey_(p.Last_Name || p.Student_Last_Name || "");
  var full = normalizeDuplicateKey_(p.StudentName || p.Student_Name || p.Full_Name || ((first + " " + last).trim()));
  var dob = normalizeDuplicateDobKey_(p.Date_Of_Birth || p.DOB || "");
  return {
    applicantId: normalizeDuplicateKey_(p.ApplicantID || p.id || ""),
    parentEmail: normalizeDuplicateKey_(p.Parent_Email_Corrected || p.Parent_Email || p.email || ""),
    parentPhone: normalizeDuplicatePhoneKey_(p.Parent_Phone || p.Parent_Mobile || p.Phone_Number || p.Mobile || p.Phone || ""),
    parentContact: normalizeDuplicateKey_(p.Parent_Email_Corrected || p.Parent_Email || p.email || "") + "::" + normalizeDuplicatePhoneKey_(p.Parent_Phone || p.Parent_Mobile || p.Phone_Number || p.Mobile || p.Phone || ""),
    studentDob: full && dob ? (full + "::" + dob) : "",
    portalToken: normalizeDuplicateKey_(p.PortalTokenHash || p.Portal_Token || p.s || "")
  };
}

function findPotentialIntakeDuplicate_(sheet, payload) {
  var sh = sheet;
  if (!sh) return { duplicate: false, matches: [] };
  var candidate = buildIntakeDuplicateCandidate_(payload);
  var values = sh.getDataRange().getValues();
  if (!values || values.length < 2) return { duplicate: false, matches: [] };
  var headers = values[0].map(function (h) { return clean_(h); });
  var matches = [];
  for (var r = 1; r < values.length; r++) {
    var rowObj = {};
    for (var c = 0; c < headers.length; c++) {
      if (headers[c]) rowObj[headers[c]] = values[r][c];
    }
    var first = normalizeDuplicateKey_(rowObj.First_Name || "");
    var last = normalizeDuplicateKey_(rowObj.Last_Name || "");
    var existing = {
      applicantId: normalizeDuplicateKey_(rowObj.ApplicantID || ""),
      parentEmail: normalizeDuplicateKey_(rowObj.Parent_Email_Corrected || rowObj.Parent_Email || ""),
      parentPhone: normalizeDuplicatePhoneKey_(rowObj.Parent_Phone || rowObj.Parent_Mobile || rowObj.Phone_Number || rowObj.Mobile || rowObj.Phone || ""),
      parentContact: normalizeDuplicateKey_(rowObj.Parent_Email_Corrected || rowObj.Parent_Email || "") + "::" + normalizeDuplicatePhoneKey_(rowObj.Parent_Phone || rowObj.Parent_Mobile || rowObj.Phone_Number || rowObj.Mobile || rowObj.Phone || ""),
      studentDob: normalizeDuplicateKey_(rowObj.StudentName || rowObj.Student_Name || rowObj.Full_Name || ((first + " " + last).trim())),
      dob: normalizeDuplicateDobKey_(rowObj.Date_Of_Birth || rowObj.DOB || ""),
      portalToken: normalizeDuplicateKey_(rowObj.PortalTokenHash || "")
    };
    var reasons = [];
    if (candidate.applicantId && existing.applicantId && candidate.applicantId === existing.applicantId) reasons.push("ApplicantID");
    if (candidate.parentEmail && candidate.parentPhone && existing.parentEmail && existing.parentPhone && candidate.parentContact === existing.parentContact) reasons.push("Parent_Email + Parent_Phone");
    if (candidate.studentDob && existing.studentDob && existing.dob && candidate.studentDob === (existing.studentDob + "::" + existing.dob)) reasons.push("Student name + DOB");
    if (candidate.portalToken && existing.portalToken && candidate.portalToken === existing.portalToken) reasons.push("existing portal token");
    if (reasons.length) {
      matches.push({
        rowNumber: r + 1,
        applicantId: clean_(rowObj.ApplicantID || ""),
        reasons: reasons
      });
      if (matches.length >= 5) break;
    }
  }
  return {
    duplicate: matches.length > 0,
    candidate: candidate,
    matches: matches
  };
}

function insertActivatedRowAt_(sheet, targetRow, rowArray) {
  var rowNum = Number(targetRow || 0);
  if (!rowNum || rowNum < 2) throw new Error("Invalid targetRow for activation commit");
  sheet.getRange(rowNum, 1, 1, rowArray.length).setValues([rowArray]);
  return rowNum;
}

function verifyActivatedState_(sheet, rowNum, applicantId, folderUrl, tokenState) {
  SpreadsheetApp.flush();
  var rowObj = getRowObject_(sheet, rowNum) || {};
  var applicantIdActual = clean_(rowObj.ApplicantID || "");
  var folderUrlActual = clean_(rowObj.Folder_Url || "");
  var portalTokenHashPresent = !!clean_(rowObj.PortalTokenHash || "");
  var portalTokenIssuedAtRaw = rowObj.PortalTokenIssuedAt;
  var portalTokenIssuedAtPresent = false;
  if (portalTokenIssuedAtRaw instanceof Date) {
    portalTokenIssuedAtPresent = !isNaN(portalTokenIssuedAtRaw.getTime());
  } else {
    portalTokenIssuedAtPresent = !!clean_(portalTokenIssuedAtRaw || "");
  }
  var secretRes = getPortalSecretForApplicant_(applicantId);
  var portalSecretsResolvable = !!(secretRes && secretRes.ok === true && clean_(secretRes.secret || ""));
  if (!applicantIdActual || applicantIdActual !== clean_(applicantId || "")) {
    return {
      ok: false,
      code: "FINALIZE_MISSING_APPLICANTID",
      message: "ApplicantID verification failed.",
      applicantIdActual: applicantIdActual,
      folderUrlPresent: !!folderUrlActual,
      portalTokenHashPresent: portalTokenHashPresent,
      portalTokenIssuedAtPresent: portalTokenIssuedAtPresent,
      portalSecretsResolvable: portalSecretsResolvable
    };
  }
  if (!folderUrlActual || folderUrlActual !== clean_(folderUrl || "")) {
    return {
      ok: false,
      code: "FINALIZE_MISSING_FOLDER_URL",
      message: "Folder_Url verification failed.",
      applicantIdActual: applicantIdActual,
      folderUrlPresent: !!folderUrlActual,
      portalTokenHashPresent: portalTokenHashPresent,
      portalTokenIssuedAtPresent: portalTokenIssuedAtPresent,
      portalSecretsResolvable: portalSecretsResolvable
    };
  }
  if (tokenState && tokenState.hasTokenHashHeader && !portalTokenHashPresent) {
    return {
      ok: false,
      code: "FINALIZE_MISSING_PORTAL_TOKEN",
      message: "PortalTokenHash verification failed.",
      applicantIdActual: applicantIdActual,
      folderUrlPresent: !!folderUrlActual,
      portalTokenHashPresent: portalTokenHashPresent,
      portalTokenIssuedAtPresent: portalTokenIssuedAtPresent,
      portalSecretsResolvable: portalSecretsResolvable
    };
  }
  if (tokenState && tokenState.hasTokenIssuedAtHeader && !portalTokenIssuedAtPresent) {
    return {
      ok: false,
      code: "FINALIZE_MISSING_PORTAL_TOKEN",
      message: "PortalTokenIssuedAt verification failed.",
      applicantIdActual: applicantIdActual,
      folderUrlPresent: !!folderUrlActual,
      portalTokenHashPresent: portalTokenHashPresent,
      portalTokenIssuedAtPresent: portalTokenIssuedAtPresent,
      portalSecretsResolvable: portalSecretsResolvable
    };
  }
  if (!portalSecretsResolvable) {
    return {
      ok: false,
      code: "FINALIZE_MISSING_PORTALSECRET",
      message: "PortalSecrets resolvability verification failed.",
      applicantIdActual: applicantIdActual,
      folderUrlPresent: !!folderUrlActual,
      portalTokenHashPresent: portalTokenHashPresent,
      portalTokenIssuedAtPresent: portalTokenIssuedAtPresent,
      portalSecretsResolvable: portalSecretsResolvable
    };
  }
  return {
    ok: true,
    applicantIdActual: applicantIdActual,
    folderUrlPresent: !!folderUrlActual,
    portalTokenHashPresent: portalTokenHashPresent,
    portalTokenIssuedAtPresent: portalTokenIssuedAtPresent,
    portalSecretsResolvable: portalSecretsResolvable
  };
}

function readCommittedActivationSnapshot_(sheet, rowNum) {
  SpreadsheetApp.flush();
  var rowObj = getRowObject_(sheet, rowNum) || {};
  var issuedAtRaw = rowObj.PortalTokenIssuedAt;
  return {
    applicantId: clean_(rowObj.ApplicantID || ""),
    formId: clean_(rowObj.FormID || rowObj.FD_FormID || ""),
    correlation_id: clean_(rowObj.correlation_id || ""),
    adapter_timestamp: clean_(rowObj.adapter_timestamp || ""),
    portalTokenIssuedAt: issuedAtRaw instanceof Date ? String(issuedAtRaw) : clean_(issuedAtRaw || ""),
    portalTokenHash: clean_(rowObj.PortalTokenHash || "")
  };
}

function sha256Hex_(s) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(s || "")
  );
  var hex = [];
  for (var i = 0; i < bytes.length; i++) {
    var v = bytes[i];
    if (v < 0) v += 256;
    var h = v.toString(16);
    if (h.length < 2) h = "0" + h;
    hex.push(h);
  }
  return hex.join("");
}

function sha256Base64_(s) {
  return Utilities.base64Encode(
    Utilities.computeDigest(
      Utilities.DigestAlgorithm.SHA_256,
      String(s || "")
    )
  );
}

function normalizeVariants_(v) {
  var raw = String(v || "");
  var trimmed = raw.trim();
  return {
    raw: raw,
    trimmed: trimmed,
    lower: trimmed.toLowerCase(),
    upper: trimmed.toUpperCase(),
    collapsedSpaces: trimmed.replace(/\s+/g, " "),
    noSpaces: trimmed.replace(/\s+/g, "")
  };
}

function buildTokenProbeInputs_(committedSnapshot) {
  committedSnapshot = committedSnapshot || {};
  var applicantIdVariants = normalizeVariants_(committedSnapshot.applicantId || "");
  var formIdVariants = normalizeVariants_(committedSnapshot.formId || "");
  var correlationVariants = normalizeVariants_(committedSnapshot.correlation_id || "");
  var adapterTimestampVariants = normalizeVariants_(committedSnapshot.adapter_timestamp || "");
  var issuedAtVariants = normalizeVariants_(committedSnapshot.portalTokenIssuedAt || "");
  var orderings = [
    { name: "ApplicantID|FormID|IssuedAt", fields: ["ApplicantID", "FormID", "PortalTokenIssuedAt"] },
    { name: "FormID|ApplicantID|IssuedAt", fields: ["FormID", "ApplicantID", "PortalTokenIssuedAt"] },
    { name: "ApplicantID|IssuedAt|FormID", fields: ["ApplicantID", "PortalTokenIssuedAt", "FormID"] },
    { name: "FormID|IssuedAt|ApplicantID", fields: ["FormID", "PortalTokenIssuedAt", "ApplicantID"] },
    { name: "IssuedAt|ApplicantID|FormID", fields: ["PortalTokenIssuedAt", "ApplicantID", "FormID"] },
    { name: "IssuedAt|FormID|ApplicantID", fields: ["PortalTokenIssuedAt", "FormID", "ApplicantID"] },
    { name: "ApplicantID|FormID|IssuedAt|Correlation", fields: ["ApplicantID", "FormID", "PortalTokenIssuedAt", "correlation_id"] },
    { name: "ApplicantID|FormID|IssuedAt|AdapterTs", fields: ["ApplicantID", "FormID", "PortalTokenIssuedAt", "adapter_timestamp"] },
    { name: "ApplicantID|FormID|Correlation|AdapterTs|IssuedAt", fields: ["ApplicantID", "FormID", "correlation_id", "adapter_timestamp", "PortalTokenIssuedAt"] },
    { name: "ApplicantID|FormID|AdapterTs|Correlation|IssuedAt", fields: ["ApplicantID", "FormID", "adapter_timestamp", "correlation_id", "PortalTokenIssuedAt"] }
  ];
  var delimiters = [
    { name: "pipe", value: "|" },
    { name: "colon", value: ":" },
    { name: "comma", value: "," },
    { name: "semicolon", value: ";" },
    { name: "none", value: "" }
  ];
  var variantsByField = {
    ApplicantID: applicantIdVariants,
    FormID: formIdVariants,
    correlation_id: correlationVariants,
    adapter_timestamp: adapterTimestampVariants,
    PortalTokenIssuedAt: issuedAtVariants
  };
  var normalizationKeys = ["raw", "trimmed", "lower", "upper", "collapsedSpaces", "noSpaces"];
  var probes = [];
  orderings.forEach(function(ordering) {
    delimiters.forEach(function(delimiter) {
      normalizationKeys.forEach(function(normKey) {
        var parts = ordering.fields.map(function(fieldName) {
          return String((variantsByField[fieldName] && variantsByField[fieldName][normKey]) || "");
        });
        probes.push({
          descriptor: ordering.name + "|" + delimiter.name + "|" + normKey,
          ordering: ordering.name,
          delimiter: delimiter.name,
          normalization: normKey,
          input: parts.join(delimiter.value)
        });
      });
    });
  });
  return probes;
}

function runTokenProbeSuite_(committedSnapshot) {
  committedSnapshot = committedSnapshot || {};
  var committedHash = clean_(committedSnapshot.portalTokenHash || "");
  var probes = buildTokenProbeInputs_(committedSnapshot);
  var matchesFound = [];
  var testedDescriptors = [];
  var anyHexMatch = false;
  var anyBase64Match = false;
  probes.forEach(function(probe) {
    var hex = sha256Hex_(probe.input);
    var base64 = sha256Base64_(probe.input);
    var hexMatch = hex === committedHash;
    var base64Match = base64 === committedHash;
    if (testedDescriptors.length < 80) testedDescriptors.push(probe.descriptor);
    if (hexMatch || base64Match) {
      if (hexMatch) anyHexMatch = true;
      if (base64Match) anyBase64Match = true;
      if (matchesFound.length < 20) {
        matchesFound.push({
          descriptor: probe.descriptor,
          ordering: probe.ordering,
          delimiter: probe.delimiter,
          normalization: probe.normalization,
          matchedEncoding: hexMatch ? "sha256_hex" : "sha256_base64"
        });
      }
    }
  });
  return {
    applicantId: clean_(committedSnapshot.applicantId || ""),
    committedHash: committedHash,
    testedCount: probes.length,
    matchCount: matchesFound.length,
    anyHexMatch: anyHexMatch,
    anyBase64Match: anyBase64Match,
    matchesFound: matchesFound,
    testedDescriptors: testedDescriptors,
    conclusion: matchesFound.length > 0
      ? "visible_inputs_recoverable"
      : "visible_inputs_insufficient_hidden_secret_or_non_row_derivation_likely"
  };
}

function buildPostHocTokenProofDownstream_(committedSnapshot) {
  committedSnapshot = committedSnapshot || {};
  var applicantId = clean_(committedSnapshot.applicantId || "");
  var formId = clean_(committedSnapshot.formId || "");
  var issuedAt = clean_(committedSnapshot.portalTokenIssuedAt || "");
  var committedHash = clean_(committedSnapshot.portalTokenHash || "");
  var digestInput = [applicantId, formId, issuedAt].join("|");
  var recomputedHash = sha256Hex_(digestInput);
  return {
    applicantId: applicantId,
    formId: formId,
    issuedAt: issuedAt,
    committedHash: committedHash,
    recomputedHash: recomputedHash,
    digestInput: digestInput,
    postHocHashMatch: recomputedHash === committedHash
  };
}

function appendRow_(sheet, payload, folder) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = [];
  for (var i = 0; i < headers.length; i++) {
    var h = headers[i];
    if (h === CONFIG.APPLICANT_ID_HEADER) row.push("");
    else if (h === "Folder_Url") row.push(folder.getUrl());
    else row.push(normalize_(payload[h]));
  }
  sheet.appendRow(row);
  return sheet.getLastRow();
}

function ensurePortalTokenAtRow_(sheet, rowNum) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var hashCol = headers.indexOf("PortalTokenHash");
  var issuedCol = headers.indexOf("PortalTokenIssuedAt");
  if (hashCol < 0 || issuedCol < 0) return;

  var currentHash = clean_(sheet.getRange(rowNum, hashCol + 1).getValue());
  var currentIssued = sheet.getRange(rowNum, issuedCol + 1).getValue();
  if (currentHash && currentIssued) return;

  var secret = newPortalSecret_();
  sheet.getRange(rowNum, hashCol + 1).setValue(hashPortalSecret_(secret));
  sheet.getRange(rowNum, issuedCol + 1).setValue(new Date());
}

function setPortalTokenHashForRow_(sheet, rowNumber, tokenHash) {
  var targetRow = Number(rowNumber || 0);
  if (!targetRow || targetRow < 2) throw new Error("Invalid rowNumber for hash write");
  var hash = clean_(tokenHash);
  if (!hash) throw new Error("Missing token hash");

  var idx = getHeaderIndexMap_(sheet);
  if (!idx[SCHEMA.PORTAL_TOKEN_HASH]) throw new Error("Missing header: " + SCHEMA.PORTAL_TOKEN_HASH);
  sheet.getRange(targetRow, idx[SCHEMA.PORTAL_TOKEN_HASH]).setValue(hash);
}

function writeBack_(sheet, row, kv) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  for (var k in kv) {
    var idx = headers.indexOf(k);
    if (idx >= 0) sheet.getRange(row, idx + 1).setValue(kv[k]);
  }
}

function hasHeader_(sheet, headerName) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  return headers.indexOf(headerName) >= 0;
}

/******************** DRIVE ********************/
function resolveUploadRootFolderId_(dbg) {
  var primary = clean_(CONFIG.APPLICANT_ROOT_FOLDER_ID_PRIMARY || "");
  var fallback = clean_(CONFIG.APPLICANT_ROOT_FOLDER_ID_FALLBACK || "");
  var propKey = clean_(CONFIG.SCRIPT_PROP_UPLOAD_ROOT_ID || "FODE_UPLOAD_ROOT_ID") || "FODE_UPLOAD_ROOT_ID";
  var propRoot = getScriptProp_(propKey);
  var autoEnabled = CONFIG.AUTO_UPLOAD_ROOT_ENABLED === true;
  var autoName = clean_(CONFIG.AUTO_UPLOAD_ROOT_NAME || "FODE Upload Root (Auto)") || "FODE Upload Root (Auto)";
  var candidateInfo = [
    { source: "PRIMARY", id: primary },
    { source: "FALLBACK", id: fallback },
    { source: "SCRIPT_PROP", id: propRoot }
  ];
  var attemptedSources = [];
  var unusableDetails = [];
  var anyConfiguredCandidate = false;

  for (var i = 0; i < candidateInfo.length; i++) {
    var c = candidateInfo[i];
    var cid = clean_(c.id || "");
    if (!cid) continue;
    anyConfiguredCandidate = true;
    attemptedSources.push(c.source);
    var probe = safeFolderProbe_(cid);
    if (probe && probe.ok) {
      logExecTrace_("ROOT_PROBE_OK", dbg, {
        event: "ROOT_PROBE_OK",
        candidateSource: c.source,
        candidateId: cid
      });
      return {
        primary: primary,
        fallback: fallback,
        propRoot: propRoot,
        chosenRoot: cid,
        source: c.source,
        name: clean_(probe.name || ""),
        rootAttemptSummary: attemptedSources.slice()
      };
    }
    var errName = clean_(probe && probe.errName || "Error") || "Error";
    var errMessage = clean_(probe && probe.errMessage || "probe_failed") || "probe_failed";
    logExecTrace_("ROOT_PROBE_FAIL", dbg, {
      event: "ROOT_PROBE_FAIL",
      candidateSource: c.source,
      candidateId: cid,
      probeErr: {
        errName: errName,
        errMessage: errMessage
      }
    });
    unusableDetails.push(c.source + " msg=" + errName + ": " + errMessage);
  }

  if (autoEnabled) {
    attemptedSources.push("AUTO");
    try {
      var ts = Utilities.formatDate(new Date(), "UTC", "yyyyMMddHHmm");
      var scriptId = "";
      try { scriptId = clean_(ScriptApp.getScriptId() || ""); } catch (_sidErr) {}
      var autoFolderName = autoName + " - " + ts + (scriptId ? " - " + scriptId : "");
      var autoFolder = DriveApp.createFolder(autoFolderName);
      var autoId = clean_(autoFolder.getId() || "");
      var autoActualName = clean_(autoFolder.getName() || autoFolderName);
      if (!autoId) throw new Error("missing_folder_id");
      setScriptProp_(propKey, autoId);
      logExecTrace_("DRIVE_ROOT_PROVISIONED", dbg, {
        event: "DRIVE_ROOT_PROVISIONED",
        folderId: autoId,
        folderName: autoActualName
      });
      return {
        primary: primary,
        fallback: fallback,
        propRoot: propRoot,
        chosenRoot: autoId,
        source: "AUTO",
        name: autoActualName,
        rootAttemptSummary: attemptedSources.slice()
      };
    } catch (autoErr) {
      var autoMsg = clean_(stringifyGsError_(autoErr) || "auto_create_failed");
      unusableDetails.push("AUTO msg=" + autoMsg);
      var eAuto = new Error("folder_root_unusable: " + autoMsg);
      eAuto.errCode = "folder_root_unusable";
      eAuto.rootAttemptSummary = attemptedSources.slice();
      throw eAuto;
    }
  }

  if (!anyConfiguredCandidate) {
    var eUnset = new Error("folder_root_unset");
    eUnset.errCode = "folder_root_unset";
    eUnset.rootAttemptSummary = attemptedSources.slice();
    throw eUnset;
  }

  var eUnusable = new Error("folder_root_unusable: " + (unusableDetails.join(" | ") || "no_usable_root"));
  eUnusable.errCode = "folder_root_unusable";
  eUnusable.rootAttemptSummary = attemptedSources.slice();
  throw eUnusable;
}

function driveApiErrCodeFromStatus_(status) {
  var n = Number(status || 0);
  if (n === 401) return "drive_api_401";
  if (n === 403) return "drive_api_403";
  if (n === 429) return "drive_api_429";
  if (n >= 500 && n < 600) return "drive_api_5xx";
  return "drive_api_error";
}

function throwDriveApiHttpError_(label, resp) {
  var safe = safeHttpErr_(resp && resp.text || "", resp && resp.status || 0);
  var msg = clean_(label || "drive_api") + " failed status=" + String(Number(safe.status || 0));
  if (safe.bodySnippet) msg += " body=" + safe.bodySnippet;
  var err = new Error(msg);
  err.errCode = driveApiErrCodeFromStatus_(safe.status);
  err.status = Number(safe.status || 0);
  err.errorBodySnippet = clean_(safe.bodySnippet || "");
  throw err;
}

function escapeDriveQueryValue_(s) {
  return String(s || "").replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

function driveApiGetRoot_(dbg) {
  var resp = driveApiGet_("/files/root", { fields: clean_(CONFIG.DRIVE_FIELDS_FOLDER || "id,name,webViewLink") });
  if (!resp.ok) throwDriveApiHttpError_("driveApiGetRoot_", resp);
  return resp.json || {};
}

function driveApiGetFile_(fileId, dbg) {
  var id = encodeURIComponent(clean_(fileId || ""));
  var resp = driveApiGet_("/files/" + id, { fields: clean_(CONFIG.DRIVE_FIELDS_FILE || "id,name,webViewLink,parents") });
  if (!resp.ok) throwDriveApiHttpError_("driveApiGetFile_", resp);
  return resp.json || {};
}

function driveApiFindFolderByName_(parentId, name, dbg) {
  var q = [
    "mimeType='application/vnd.google-apps.folder'",
    "name='" + escapeDriveQueryValue_(name) + "'",
    "'" + escapeDriveQueryValue_(parentId) + "' in parents",
    "trashed=false"
  ].join(" and ");
  var resp = driveApiGet_("/files", {
    q: q,
    pageSize: 1,
    fields: "files(" + clean_(CONFIG.DRIVE_FIELDS_FOLDER || "id,name,webViewLink") + ")"
  });
  if (!resp.ok) throwDriveApiHttpError_("driveApiFindFolderByName_", resp);
  var files = (resp.json && resp.json.files && Array.isArray(resp.json.files)) ? resp.json.files : [];
  return files.length ? files[0] : null;
}

function driveApiCreateFolder_(parentId, name, dbg) {
  var body = {
    name: clean_(name || ""),
    mimeType: "application/vnd.google-apps.folder",
    parents: [clean_(parentId || "")]
  };
  var resp = driveApiPost_("/files", body, { fields: clean_(CONFIG.DRIVE_FIELDS_FOLDER || "id,name,webViewLink") });
  if (!resp.ok) throwDriveApiHttpError_("driveApiCreateFolder_", resp);
  return resp.json || {};
}

function driveApiGetOrCreateFolder_(parentId, name, dbg) {
  var found = driveApiFindFolderByName_(parentId, name, dbg);
  if (found && found.id) return found;
  return driveApiCreateFolder_(parentId, name, dbg);
}

function driveApiUploadBlobToFolder_(parentId, name, blob, dbg) {
  var metadata = {
    name: clean_(name || "upload.bin"),
    parents: [clean_(parentId || "")]
  };
  var resp = driveApiMultipartUpload_(metadata, blob);
  if (!resp.ok) throwDriveApiHttpError_("driveApiUploadBlobToFolder_", resp);
  var j = resp.json || {};
  return {
    fileId: clean_(j.id || ""),
    fileUrl: clean_(j.webViewLink || (j.id ? ("https://drive.google.com/file/d/" + j.id + "/view") : "")),
    fileName: clean_(j.name || metadata.name)
  };
}

function driveApiCreateTextFile_(parentId, name, contentString, dbg) {
  var blob = Utilities.newBlob(String(contentString || ""), "text/plain", clean_(name || "probe.txt"));
  return driveApiUploadBlobToFolder_(parentId, clean_(name || "probe.txt"), blob, dbg);
}

function resolveUploadRootIdForRest_() {
  var primary = clean_(CONFIG.APPLICANT_ROOT_FOLDER_ID_PRIMARY || "");
  var fallback = clean_(CONFIG.APPLICANT_ROOT_FOLDER_ID_FALLBACK || "");
  var propKey = clean_(CONFIG.SCRIPT_PROP_UPLOAD_ROOT_ID || "FODE_UPLOAD_ROOT_ID") || "FODE_UPLOAD_ROOT_ID";
  var propRoot = (typeof getScriptProp_ === "function") ? clean_(getScriptProp_(propKey) || "") : "";
  var candidates = [primary, fallback, propRoot];
  for (var i = 0; i < candidates.length; i++) {
    if (clean_(candidates[i])) return clean_(candidates[i]);
  }
  var e = new Error("folder_root_unset");
  e.errCode = "folder_root_unset";
  throw e;
}

function buildApplicantFolderName_(record, applicantIdHint) {
  var row = record || {};
  var applicantId = clean_(applicantIdHint || row.ApplicantID || row[CONFIG.APPLICANT_ID_HEADER] || "");
  if (applicantId) return applicantId;
  var first = slug_(row.First_Name);
  var last = slug_(row.Last_Name);
  var date = new Date().toISOString().slice(0, 10);
  return first + "_" + last + "_" + date;
}

function driveApiBuildFolderHandleById_(folderId, dbg, existingUrl) {
  var file = driveApiGetFile_(folderId, dbg);
  return {
    kind: "rest",
    id: clean_(file.id || folderId),
    url: clean_(file.webViewLink || existingUrl || (folderId ? ("https://drive.google.com/drive/folders/" + folderId) : ""))
  };
}

function createApplicantFolderHandleWithRestFallback_(payloadOrRecord, dbg, applicantIdHint) {
  var record = payloadOrRecord || {};
  var rootId = resolveUploadRootIdForRest_();
  var yearFolderName = clean_(CONFIG.APPLICANT_ROOT_YEAR_FOLDER_NAME || CONFIG.YEAR_FOLDER || "");
  if (!yearFolderName) {
    var eYear = new Error("folder_root_unusable: missing year folder config");
    eYear.errCode = "folder_root_unusable";
    throw eYear;
  }
  var year = driveApiGetOrCreateFolder_(rootId, yearFolderName, dbg);
  var applicantFolderName = buildApplicantFolderName_(record, applicantIdHint);
  var applicant = driveApiGetOrCreateFolder_(clean_(year.id || ""), applicantFolderName, dbg);
  return {
    kind: "rest",
    id: clean_(applicant.id || ""),
    url: clean_(applicant.webViewLink || (applicant.id ? ("https://drive.google.com/drive/folders/" + applicant.id) : ""))
  };
}

function createApplicantFolder_(payloadOrRecord, opts) {
  var record = payloadOrRecord || {};
  var dbg = clean_(opts && opts.dbg || "");
  var first = slug_(record.First_Name);
  var last = slug_(record.Last_Name);
  var date = new Date().toISOString().slice(0, 10);
  var rootInfo = resolveUploadRootFolderId_(dbg);
  var chosenRoot = clean_(rootInfo && rootInfo.chosenRoot || "");

  logExecTrace_("FOLDER_CREATE_ENTER", dbg, {
    primary: clean_(rootInfo && rootInfo.primary || ""),
    fallback: clean_(rootInfo && rootInfo.fallback || ""),
    propRoot: clean_(rootInfo && rootInfo.propRoot || ""),
    chosenRoot: chosenRoot
  });

  try {
    if (!chosenRoot) {
      var eMissing = new Error("folder_root_unset");
      eMissing.errCode = "folder_root_unset";
      eMissing.rootAttemptSummary = rootInfo && rootInfo.rootAttemptSummary ? rootInfo.rootAttemptSummary : [];
      throw eMissing;
    }
    var root = withRetries_(function () {
      return DriveApp.getFolderById(chosenRoot);
    }, { dbg: dbg, label: "createApplicantFolder:getRootById" });
    var yearFolderName = clean_(CONFIG.APPLICANT_ROOT_YEAR_FOLDER_NAME || CONFIG.YEAR_FOLDER || "");
    if (!yearFolderName) {
      var eYear = new Error("folder_root_unusable: missing year folder config");
      eYear.errCode = "folder_root_unusable";
      eYear.rootAttemptSummary = rootInfo && rootInfo.rootAttemptSummary ? rootInfo.rootAttemptSummary : [];
      throw eYear;
    }
    var year = withRetries_(function () {
      return (typeof getOrCreateFolderByName_ === "function")
        ? getOrCreateFolderByName_(root, yearFolderName, dbg)
        : getOrCreateFolder_(root, yearFolderName);
    }, { dbg: dbg, label: "createApplicantFolder:getOrCreateYear" });
    var applicantFolderName = first + "_" + last + "_" + date;
    return withRetries_(function () {
      return getOrCreateFolder_(year, applicantFolderName);
    }, { dbg: dbg, label: "createApplicantFolder:getOrCreateApplicant" });
  } catch (e) {
    var code = classifyUploadErr_(e);
    if (code === "folder_root_unset" || code === "folder_root_unusable") throw e;
    if (typeof isDriveServerError_ === "function" && isDriveServerError_(e)) {
      var eDriveApp = new Error("driveapp_unavailable: " + clean_(stringifyGsError_(e) || "DriveApp server error"));
      eDriveApp.errCode = "driveapp_unavailable";
      eDriveApp.rootAttemptSummary = rootInfo && rootInfo.rootAttemptSummary ? rootInfo.rootAttemptSummary : [];
      throw eDriveApp;
    }
    var msg = clean_(stringifyGsError_(e) || "Drive error").replace(/\s+/g, " ");
    if (msg.length > 180) msg = msg.slice(0, 180);
    var eDrive = new Error("folder_root_unusable: rootId=" + (chosenRoot || "none") + " msg=" + (msg || "drive_error"));
    eDrive.errCode = "folder_root_unusable";
    eDrive.rootAttemptSummary = rootInfo && rootInfo.rootAttemptSummary ? rootInfo.rootAttemptSummary : [];
    throw eDrive;
  }
}

function getOrCreateFolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

function folderIdFromUrl_(url) {
  url = String(url || "");
  var m = url.match(/\/folders\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : "";
}

/******************** ApplicantID ********************/
function assignApplicantIdIfBlank_(sheet, rowNum) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var idCol = findCol_(sheet, CONFIG.APPLICANT_ID_HEADER);
    if (!idCol) throw new Error(CONFIG.APPLICANT_ID_HEADER + " column not found.");

    var idCell = sheet.getRange(rowNum, idCol);
    var existing = String(idCell.getValue() || "").trim();
    if (existing) return existing;

    var lastRow = sheet.getLastRow();
    var values = sheet.getRange(2, idCol, Math.max(lastRow - 1, 1), 1).getValues();
    var flat = values.map(function(r){ return r[0]; });

    var prefix = CONFIG.APPLICANT_PREFIX;
    var digits = CONFIG.APPLICANT_DIGITS;
    var re = new RegExp("^" + escapeRegExp_(prefix) + "(\\d{" + digits + "})$");

    var maxN = 0;
    for (var i = 0; i < flat.length; i++) {
      var s = String(flat[i] || "").trim();
      var mm = s.match(re);
      if (mm) {
        var n = parseInt(mm[1], 10);
        if (!isNaN(n)) maxN = Math.max(maxN, n);
      }
    }

    var nextId = prefix + String(maxN + 1).padStart(digits, "0");
    idCell.setValue(nextId);
    return nextId;
  } finally {
    lock.releaseLock();
  }
}

function findCol_(sheet, headerName) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  for (var i = 0; i < headers.length; i++) {
    if (String(headers[i] || "").trim() === headerName) return i + 1;
  }
  return null;
}

function escapeRegExp_(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/******************** DOC META ********************/
function docMetaByField_(fieldName) {
  for (var i = 0; i < CONFIG.DOC_FIELDS.length; i++) {
    if (CONFIG.DOC_FIELDS[i].file === fieldName) {
      return {
        label: CONFIG.DOC_FIELDS[i].label,
        field: CONFIG.DOC_FIELDS[i].file,
        status: CONFIG.DOC_FIELDS[i].status,
        comment: CONFIG.DOC_FIELDS[i].comment,
        multiple: CONFIG.DOC_FIELDS[i].multiple === true
      };
    }
  }
  return null;
}

function getDocUiFields_() {
  return (CONFIG.DOC_FIELDS || []).map(function(d) {
    return { label: d.label, field: d.file, status: d.status, comment: d.comment, multiple: d.multiple === true };
  });
}

/******************** LOG APPEND ********************/
function appendLog_(existing, line) {
  if (!existing) return line;
  return existing + "\n" + line;
}

/******************** OUTPUT ********************/
function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

/************************************************************
ADMIN QUEUE RPC (restored using existing row helpers)
************************************************************/

function legacy_admin_getReviewQueues() {
  try {
    var ss = getWorkingSpreadsheet_();
    var sheet = mustGetDataSheet_(ss);
    var rows = admin_listQueueRowObjects_(sheet);

    var counts = {
      docs_pending: 0,
      payment_pending: 0,
      payment_first_anomalies: 0,
      enrolled_ready: 0
    };

    rows.forEach(function(row) {
      var q = classifyAdminQueue_(row);
      if (q && Object.prototype.hasOwnProperty.call(counts, q)) counts[q]++;
    });

    return {
      ok: true,
      queues: [
        {
          id: "docs_pending",
          title: "Documents to Review",
          description: "Applicants waiting for document verification",
          count: counts.docs_pending
        },
        {
          id: "payment_pending",
          title: "Payments to Verify",
          description: "Applicants with documents cleared and payment pending",
          count: counts.payment_pending
        },
        {
          id: "payment_first_anomalies",
          title: "Payment-First Anomalies",
          description: "Payment marked before document completion",
          count: counts.payment_first_anomalies
        },
        {
          id: "enrolled_ready",
          title: "Paid & Approved for Enrollment",
          description: "Applicants ready for next downstream action",
          count: counts.enrolled_ready
        }
      ]
    };

  } catch (e) {
    return {
      ok: false,
      error: e && e.message ? e.message : String(e)
    };
  }
}

function legacy_admin_getQueueItems(queueId, limit, offset) {
  try {
    var ss = getWorkingSpreadsheet_();
    var sheet = mustGetDataSheet_(ss);
    var rows = admin_listQueueRowObjects_(sheet);

    var safeLimit = Math.max(1, Math.min(Number(limit || 50), 200));
    var safeOffset = Math.max(0, Number(offset || 0));

    var filtered = rows.filter(function(row) {
      return classifyAdminQueue_(row) === queueId;
    });

    var page = filtered.slice(safeOffset, safeOffset + safeLimit).map(function(row) {
      return mapAdminQueueRow_(row);
    });

    return {
      ok: true,
      queueId: queueId,
      items: page,
      total: filtered.length,
      offset: safeOffset,
      limit: safeLimit,
      hasMore: (safeOffset + safeLimit) < filtered.length
    };

  } catch (e) {
    return {
      ok: false,
      error: e && e.message ? e.message : String(e),
      queueId: queueId
    };
  }
}

function admin_listQueueRowObjects_(sheet) {
  var lastRow = sheet.getLastRow();
  var lastCol = sheet.getLastColumn();
  if (!lastRow || lastRow < 2 || !lastCol) return [];

  var data = sheet.getRange(1, 1, lastRow, lastCol).getValues();
  if (!data || data.length < 2) return [];

  var headers = data[0].map(function(h) {
    return String(h == null ? "" : h).trim();
  });

  var out = [];
  for (var r = 1; r < data.length; r++) {
    var raw = data[r];
    var row = {};
    for (var c = 0; c < headers.length; c++) {
      row[headers[c]] = raw[c];
    }

    var applicantId = String(firstNonEmpty_(
      row.ApplicantID,
      row.Applicant_Id,
      row["Applicant ID"],
      row.ID
    ) || "").trim();

    if (!applicantId) continue;
    row.__rowNum = r + 1;
    out.push(row);
  }

  return out;
}

function classifyAdminQueue_(row) {
  var birthStatus = String(firstNonEmpty_(
    row.Birth_ID_Status,
    row.Birth_Status,
    row["Birth_ID_Status"],
    row["Birth Status"],
    row["Birth ID Status"]
  ) || "").trim();
  var reportStatus = String(firstNonEmpty_(row.Report_Status, row["Report Status"]) || "").trim();
  var photoStatus = String(firstNonEmpty_(row.Photo_Status, row["Photo Status"]) || "").trim();
  var transferStatus = String(firstNonEmpty_(row.Transfer_Status, row["Transfer Status"]) || "").trim();
  var receiptStatus = String(firstNonEmpty_(row.Receipt_Status, row["Receipt Status"]) || "").trim();

  var docVerificationStatus = String(firstNonEmpty_(
    row.Doc_Verification_Status,
    row["Doc Verification Status"],
    row.Overall_Document_Status
  ) || "").trim();

  var overallStatus = String(firstNonEmpty_(
    row.Overall_Status,
    row["Overall Status"],
    row.Status,
    row["Application Status"]
  ) || "").trim();

  var paymentBadge = typeof canonicalPaymentBadge_ === "function" ? canonicalPaymentBadge_(row) : receiptStatus;

  var docsComplete = [birthStatus, reportStatus, photoStatus, transferStatus, receiptStatus]
    .filter(function(v) { return v !== ""; })
    .every(function(v) { return /verified/i.test(v); });

  var docsVerified = /verified/i.test(docVerificationStatus) || docsComplete;
  var paymentVerified = paymentBadge === "Verified";
  var hasAnyPayment = paymentVerified
    || paymentBadge === "Rejected"
    || /pending|review|received|uploaded|reject|invalid|failed/i.test(receiptStatus)
    || (typeof hasUploadEvidence_ === "function" && hasUploadEvidence_(row.Fee_Receipt_File, "Fee_Receipt_File"));

  if (!docsVerified && hasAnyPayment) return "payment_first_anomalies";
  if (docsVerified && paymentVerified) {
    return "enrolled_ready";
  }
  if (docsVerified && !paymentVerified) return "payment_pending";
  if (/approved|verified/i.test(overallStatus) && paymentVerified) return "enrolled_ready";
  return "docs_pending";
}

function mapAdminQueueRow_(row) {
  var applicantId = String(firstNonEmpty_(
    row.ApplicantID,
    row.Applicant_Id,
    row["Applicant ID"],
    row.ID
  ) || "").trim();

  var firstName = String(firstNonEmpty_(row.First_Name, row.FirstName, row["First Name"]) || "").trim();
  var lastName = String(firstNonEmpty_(row.Last_Name, row.LastName, row["Last Name"]) || "").trim();
  var fullName = String((firstName + " " + lastName).trim() || firstNonEmpty_(row.Student_Name, row.Name, row["Student Name"]) || "").trim();

  var docVerificationStatus = String(firstNonEmpty_(
    row.Doc_Verification_Status,
    row["Doc Verification Status"],
    row.Overall_Document_Status
  ) || "").trim();

  var paymentVerifiedRaw = String(firstNonEmpty_(
    row.Payment_Verified,
    row["Payment Verified"],
    row.PaymentStatus,
    row.Payment_Status,
    row.Payment
  ) || "").trim();
  var paymentBadge = typeof canonicalPaymentBadge_ === "function" ? canonicalPaymentBadge_(row) : paymentVerifiedRaw;
  var paymentVerified = paymentBadge === "Verified";

  var overallStatus = String(firstNonEmpty_(
    row.Overall_Status,
    row["Overall Status"],
    row.Status,
    row["Application Status"]
  ) || "").trim();

  var portalStatus = String(firstNonEmpty_(
    row.Portal_Status,
    row.PortalStatus,
    row.Portal,
    row["Portal Status"]
  ) || "").trim();

  var docsFollowUp = String(firstNonEmpty_(
    row.Docs_Follow_Up,
    row.DocsFollowUp,
    row["Docs Follow-Up"],
    row["Docs Follow Up"]
  ) || "").trim();

  return {
    applicantId: applicantId,
    name: fullName,
    docStatus: docVerificationStatus || overallStatus,
    paymentStatus: paymentVerified ? "Payment Verified" : "Pending",
    portalStatus: portalStatus,
    docsFollowUp: docsFollowUp,
    eligibleDocsFollowUp: /verified/i.test(docVerificationStatus || overallStatus) && !paymentVerified
  };
}

function firstNonEmpty_() {
  for (var i = 0; i < arguments.length; i++) {
    var v = arguments[i];
    if (v !== null && v !== undefined && String(v).trim() !== "") return v;
  }
  return "";
}




function campaignLog_(label, payload) {
  var tag = clean_(label || "CAMPAIGN_LOG");
  var data = payload && typeof payload === "object" ? payload : {};
  try {
    log_(mustGetSheet_(getWorkingSpreadsheet_(), CONFIG.LOG_SHEET), tag, JSON.stringify(data));
  } catch (_logErr) {
    try { Logger.log(tag + " " + JSON.stringify(data)); } catch (_e) {}
  }
}

function campaignGetContext_() {
  var ss = getWorkingSpreadsheet_();
  var sh = mustGetDataSheet_(ss);
  ensureCampaignColumns_(sh);
  var values = sh.getDataRange().getValues();
  var headers = values[0] || [];
  var idx = getHeaderIndexMap_(sh);
  return {
    spreadsheet: ss,
    sheet: sh,
    values: values,
    headers: headers,
    idx: idx,
    campaignCols: getCampaignColumnsMap_(headers)
  };
}

function campaignRowObjectFromValues_(headers, row) {
  var out = {};
  var head = Array.isArray(headers) ? headers : [];
  var vals = Array.isArray(row) ? row : [];
  for (var i = 0; i < head.length; i++) {
    var key = clean_(head[i]);
    if (key) out[key] = vals[i];
  }
  return out;
}

function campaignAttemptCount_(row) {
  var raw = Number(row && row.Email_Attempt_Count || 0);
  if (!isFinite(raw) || raw < 0) return 0;
  return Math.floor(raw);
}

function campaignBatchLabel_(baseDate) {
  var dt = baseDate instanceof Date ? baseDate : new Date();
  return "LEGACY-" + Utilities.formatDate(dt, Session.getScriptTimeZone(), "yyyyMMdd-HHmmss");
}

function campaignSubjectForAttempt_(attemptCount, rowNumber) {
  var subjects = Array.isArray(CONFIG.CAMPAIGN_EMAIL_SUBJECTS) ? CONFIG.CAMPAIGN_EMAIL_SUBJECTS : [];
  return subjects[0] || "Your FODE KIA Online Application - Status & Next Step";
}

function buildCampaignEmailBody_(row, portalUrl, applicantId) {
  return [
    "Dear Parent/Guardian,",
    "",
    "We are writing to you regarding your online application submitted to Kundu International Academy under the FODE program.",
    "",
    "Your application is currently on record, and you are now invited to proceed to the next stage through our fully online enrolment and learning system.",
    "",
    "Kundu International Academy has received formal approval from the FODE Head Office to deliver the FODE program through an approved online model. This approval was granted following a detailed review of our academic systems, delivery structure, and compliance measures, ensuring full alignment with national FODE curriculum standards and requirements.",
    "",
    "This means students across Papua New Guinea, including those in remote and rural areas, can now complete their enrolment, submit documents, and progress academically without the need for physical paperwork or travel.",
    "",
    "You may access your student record using the secure link below:",
    "",
    String(portalUrl || ""),
    "",
    "This link is unique to your application and should not be shared.",
    "",
    "Applicant ID: " + String(applicantId || ""),
    "",
    "What you need to do:",
    "",
    "- Review your personal and academic details",
    "- Upload all required documents clearly",
    "- Upload a recent passport-size photo",
    "- Provide accurate contact details",
    "- Submit your application for verification",
    "",
    "Fees and Payment:",
    "",
    "- Registration Fee: K600 (one-time)",
    "- Subject Fee: K450 per subject",
    "- Total cost depends on the number of subjects selected",
    "",
    "All fees are strictly non-refundable, so please ensure all details and documents are accurate before submission.",
    "",
    "Document Requirements:",
    "",
    "- All documents must be clear and readable",
    "- Photos must be recent and passport-style",
    "- Documents must belong to the correct applicant",
    "- Incomplete or incorrect uploads will not be accepted",
    "",
    "Important Information:",
    "",
    "- Submission of false or misleading information may result in cancellation of the application",
    "- Subject selections and placement are final once enrolment is completed",
    "- The application must be fully submitted before further processing can begin",
    "",
    "About the Program:",
    "",
    "Through Kundu FODE, students can:",
    "",
    "- Upgrade Grades 8, 10, or 12",
    "- Study through a structured and flexible system",
    "- Access core subjects including English, Mathematics, Science, ICT, and Business Studies",
    "- Progress towards national examinations and certification",
    "",
    "Kundu International Academy is a registered permitted school under the Papua New Guinea Department of Education (Registration No: PS557/1983) and is formally authorized by FODE Head Office to deliver FODE programs online.",
    "",
    "Your application is already in our system, and this is your opportunity to proceed using the newly approved online platform.",
    "",
    "We strongly recommend completing your submission as soon as possible to secure your place.",
    "",
    "If you require assistance, please contact us:",
    "",
    "FODE Admissions",
    "Kundu International Academy",
    "WhatsApp: +675 7860 4013",
    "Email: fode@kundu.ac"
  ].join("\n");
}

function campaignSendEmailGmail_(toEmail, subject, body, meta) {
  var trace = meta && typeof meta === "object" ? meta : {};
  var alias = clean_(CONFIG.CAMPAIGN_GMAIL_ALIAS || "");
  var replyTo = clean_(CONFIG.CAMPAIGN_REPLY_TO || "fode@kundu.ac");
  var to = clean_(toEmail || "");
  var manualProbe = trace.manualSingleSendProbe === true;
  var traceBase = {
    applicantId: clean_(trace.applicantId || ""),
    recipient: to,
    alias: alias,
    requestId: clean_(trace.requestId || trace.debugId || ""),
    batchId: clean_(trace.batchId || trace.batchLabel || "")
  };
  if (!manualProbe && (isSystemStabilizationModeActive_() || CONFIG.ENABLE_PRODUCTION_EMAIL_SENDS !== true)) {
    var blockedCode = isSystemStabilizationModeActive_() ? "SYSTEM_STABILIZATION_MODE_ACTIVE" : "PRODUCTION_EMAIL_SENDS_DISABLED";
    if (isSystemStabilizationModeActive_()) logOperationalBlock_("SYSTEM_STABILIZATION_MODE_ACTIVE", Object.assign({}, traceBase, { action: "campaign_send_email" }));
    logOperationalBlock_("EMAIL_SEND_BLOCKED", Object.assign({}, traceBase, { action: "campaign_send_email", blockCode: blockedCode, from: alias, replyTo: replyTo }));
    return { ok: false, error: blockedCode, blocked: true, to: to, from: alias, replyTo: replyTo };
  }
  if (manualProbe && isManualSingleSendProbeEnabled_() !== true) {
    logOperationalBlock_("MANUAL_SEND_PROBE_BLOCKED", Object.assign({}, traceBase, { action: "campaign_send_email", blockCode: "MANUAL_SINGLE_SENDS_DISABLED" }));
    return { ok: false, error: "MANUAL_SINGLE_SENDS_DISABLED", blocked: true, to: to, from: alias, replyTo: replyTo };
  }
  if (!to) return { ok: false, error: "Missing recipient email" };
  if (!alias) return { ok: false, error: "Missing campaign Gmail alias" };
  var unattendedBlock = blockUnattendedEmailSendIfNeeded_(clean_(trace.templateType || trace.messageType || subject || ""), to, {
    action: "campaign_send_email",
    sendSource: clean_(trace.sendSource || ""),
    source: clean_(trace.source || ""),
    unattended: trace.unattended === true,
    applicantId: clean_(trace.applicantId || ""),
    messageType: clean_(trace.messageType || trace.templateType || ""),
    limit: trace.limit,
    processorSource: clean_(trace.processorSource || ""),
    processorScope: clean_(trace.processorScope || ""),
    duplicateGuardPassed: trace.duplicateGuardPassed === true,
    rowObj: trace.rowObj && typeof trace.rowObj === "object" ? trace.rowObj : {},
    debugId: clean_(trace.requestId || trace.debugId || "")
  });
  if (unattendedBlock.blocked) {
    return { ok: false, error: unattendedBlock.blockCode, blocked: true, to: to, from: alias, replyTo: replyTo };
  }
  campaignLog_("GMAIL_ALIAS_LOOKUP_BEGIN", traceBase);
  try {
    var aliases = GmailApp.getAliases();
    if (Array.isArray(aliases) && aliases.indexOf(alias) === -1) {
      var aliasMessage = "Campaign alias not visible: " + alias;
      campaignLog_("GMAIL_ALIAS_LOOKUP_END", Object.assign({}, traceBase, { aliasCount: aliases.length, aliasConfigured: false, error: aliasMessage }));
    } else {
      campaignLog_("GMAIL_ALIAS_LOOKUP_END", Object.assign({}, traceBase, { aliasCount: Array.isArray(aliases) ? aliases.length : 0, aliasConfigured: true }));
    }
  } catch (_aliasErr) {}
  campaignLog_("GMAIL_SEND_BEGIN", traceBase);
  try {
    var gmailOptions = {
      from: alias,
      replyTo: replyTo,
      name: clean_(CONFIG.EMAIL_FROM_NAME || "FODE Admissions") || "FODE Admissions"
    };
    if (clean_(trace.cc || "")) gmailOptions.cc = clean_(trace.cc || "");
    if (clean_(trace.bcc || "")) gmailOptions.bcc = clean_(trace.bcc || "");
    GmailApp.sendEmail(to, String(subject || ""), String(body || ""), gmailOptions);
    campaignLog_("GMAIL_SEND_END", Object.assign({}, traceBase, { ok: true, from: alias, replyTo: replyTo }));
    return { ok: true, to: to, from: alias, replyTo: replyTo };
  } catch (e) {
    campaignLog_("GMAIL_SEND_END", Object.assign({}, traceBase, { ok: false, error: String(e && e.message ? e.message : e), from: alias, replyTo: replyTo }));
    return { ok: false, error: String(e && e.message ? e.message : e), to: to, from: alias, replyTo: replyTo };
  }
}

function campaignBuildEmailPreview_(rowObj, rowNumber, attemptCount, batchLabel) {
  var applicantId = clean_(rowObj.ApplicantID || "");
  var secretRes = resolvePortalCommunicationSecret_(applicantId);
  if (!secretRes.ok) {
    return {
      ok: false,
      code: clean_(secretRes.code || "NO_SECRET"),
      applicantId: applicantId,
      rowNumber: rowNumber,
      effectiveEmail: getCampaignEffectiveEmail_(rowObj),
      error: clean_(secretRes.error || secretRes.code || "Missing active secret")
    };
  }
  var portalUrl = buildPortalCommunicationUrl_(applicantId, secretRes.secretPlain);
  var subject = campaignSubjectForAttempt_(attemptCount, rowNumber);
  var body = buildCampaignEmailBody_(rowObj, portalUrl, applicantId);
  return {
    ok: true,
    applicantId: applicantId,
    rowNumber: rowNumber,
    effectiveEmail: getCampaignEffectiveEmail_(rowObj),
    attemptCount: attemptCount,
    batchLabel: batchLabel,
    portalUrl: portalUrl,
    subject: subject,
    body: body
  };
}

function normalizeApplicantMessageType_(messageType) {
  var raw = clean_(messageType || "").toLowerCase();
  var allowed = Array.isArray(CONFIG.COMMUNICATION_ALLOWED_MESSAGE_TYPES) ? CONFIG.COMMUNICATION_ALLOWED_MESSAGE_TYPES : [];
  return allowed.indexOf(raw) >= 0 ? raw : "";
}

function communicationLoadActiveTemplateVariant_(templateId, versionId) {
  var wanted = clean_(templateId || "");
  if (!wanted) return null;
  var index = communicationReadTemplateVariantIndex_();
  var active = index.activeTemplateIds || [];
  if (active.indexOf(wanted) < 0) return null;
  var wantedVersion = clean_(versionId || (index.latestVersionByTemplateId && index.latestVersionByTemplateId[wanted]) || "");
  if (!wantedVersion) return null;
  var raw = PropertiesService.getScriptProperties().getProperty(communicationTemplateVariantKey_(wanted, wantedVersion)) || "";
  if (!raw) throw new Error("COMM_TEMPLATE_VARIANT_MISSING");
  var variant = JSON.parse(raw);
  if (!variant || variant.status !== "ACTIVE" || variant.templateId !== wanted || variant.versionId !== wantedVersion) {
    throw new Error("COMM_TEMPLATE_VARIANT_INDEX_MISMATCH");
  }
  return variant;
}

function communicationResolveTemplateVariantSelector_(messageType, opts) {
  var options = opts && typeof opts === "object" ? opts : {};
  var selector = clean_(options.templateId || options.templateVariantId || messageType || "");
  var versionId = clean_(options.templateVersionId || "");
  if (!selector) return null;
  if (normalizeApplicantMessageType_(selector) && !clean_(options.templateId || options.templateVariantId || "")) return null;
  try {
    var variant = communicationLoadActiveTemplateVariant_(selector, versionId);
    if (!variant) return null;
    var parent = normalizeApplicantMessageType_(variant.parentMessageType || "");
    if (!parent) throw new Error("UNKNOWN_PARENT_TEMPLATE");
    return { variant: variant, parentMessageType: parent };
  } catch (err) {
    if (String(err && err.message || err || "").indexOf("COMM_TEMPLATE_VARIANT") >= 0) throw err;
    return null;
  }
}

function communicationResolvedMessageTypeForRequest_(messageType, opts) {
  var variant = communicationResolveTemplateVariantSelector_(messageType, opts);
  return variant ? variant.parentMessageType : normalizeApplicantMessageType_(messageType);
}

function normalizeApplicantBatchFilterType_(filterType) {
  var raw = clean_(filterType || "").toLowerCase();
  var allowed = Array.isArray(CONFIG.COMMUNICATION_ALLOWED_BATCH_FILTER_TYPES) ? CONFIG.COMMUNICATION_ALLOWED_BATCH_FILTER_TYPES : [];
  return allowed.indexOf(raw) >= 0 ? raw : "";
}

// Portal Communication is the canonical runtime capability. The external
// compatibility token remains `legacy_invite` until a dedicated rename pass.
function portalCommunicationMessageType_() {
  return "legacy_invite";
}

function isPortalCommunicationMessageType_(messageType) {
  return normalizeApplicantMessageType_(messageType || "") === portalCommunicationMessageType_();
}

function resolvePortalCommunicationSecret_(applicantId) {
  return getActivePortalSecretForCampaign_(applicantId);
}

function buildPortalCommunicationUrl_(applicantId, secretPlain) {
  return buildLegacyCampaignPortalUrl_(applicantId, secretPlain);
}

function resolveExistingStudentPortalAuthority_(applicantId, opts) {
  var id = clean_(applicantId || "");
  var options = opts && typeof opts === "object" ? opts : {};
  var secretRes = Object.prototype.hasOwnProperty.call(options, "secretRecord")
    ? options.secretRecord
    : resolvePortalCommunicationSecret_(id);
  function unavailable(code, reason) {
    return {
      available: false,
      applicantId: id,
      portalUrl: "",
      tokenState: normalizePortalSecretStatus_(secretRes && secretRes.status || "") || "MISSING",
      reasonCode: clean_(code || "PORTAL_LINK_UNAVAILABLE"),
      reason: clean_(reason || "Active applicant portal authority is unavailable.")
    };
  }
  if (!id) return unavailable("APPLICANT_ID_REQUIRED", "Applicant ID is required for portal authority.");
  if (!secretRes || secretRes.ok !== true) return unavailable(clean_(secretRes && secretRes.code || "PORTAL_LINK_UNAVAILABLE"), clean_(secretRes && (secretRes.error || secretRes.code) || "Active applicant portal authority is unavailable."));
  if (clean_(secretRes.applicantId || id || "") !== id) return unavailable("PORTAL_RECORD_MISMATCH", "Portal authority record does not belong to the selected applicant.");
  var status = normalizePortalSecretStatus_(secretRes.status || "");
  if (options.statusRequired === true && status !== "ACTIVE") return unavailable("PORTAL_SECRET_INACTIVE", "The applicant portal authority record is not active.");
  var secretPlain = clean_(secretRes.secretPlain || "");
  if (!secretPlain) return unavailable("PORTAL_LINK_UNAVAILABLE", "The active portal authority has no reusable secure token.");
  var portalUrl = "";
  try {
    portalUrl = clean_(buildPortalCommunicationUrl_(id, secretPlain) || "");
  } catch (_portalUrlErr) {
    return unavailable("PORTAL_LINK_UNAVAILABLE", "The secure Student portal URL could not be resolved.");
  }
  if (!portalUrl) return unavailable("PORTAL_LINK_UNAVAILABLE", "The secure Student portal URL could not be resolved.");
  return {
    available: true,
    applicantId: id,
    portalUrl: portalUrl,
    tokenState: "ACTIVE",
    reasonCode: "ACTIVE_PORTAL_AUTHORITY",
    reason: "Existing active Student portal authority returned."
  };
}

function isHistoricalLegacyInviteBatchFilter_(filterType) {
  return normalizeApplicantBatchFilterType_(filterType) === "legacy_invite_eligible";
}

function getCommunicationSemanticRegistry_() {
  return [
    {
      messageType: "legacy_invite",
      templateVersion: "1",
      audienceClass: "APPLICANT_WORKFLOW",
      semanticIntent: "portal_application_workflow_invitation",
      operatorLabel: "Application Portal Invitation",
      conditionPolicyId: "APPLICANT_PORTAL_INVITE",
      allowedSendModes: ["selected", "batch"],
      requiresApplicantRow: true,
      requiresValidEmail: true,
      requiresContactConsent: false,
      requiredRole: "EXISTING_SEND_AUTHORITY",
      editableMode: "limited",
      batchSafe: true,
      fallbackInstruction: "Use the existing manual contact fallback when email is unavailable.",
      operatorWarning: "Applicant workflow only. Do not use as general prospect guidance.",
      auditMeaning: "Application portal invitation sent to an authoritative applicant record.",
      subjectBuilderId: "campaignSubjectForAttempt_",
      bodyBuilderId: "buildCampaignEmailBody_",
      implementationStatus: "active"
    },
    {
      messageType: "reminder",
      templateVersion: "1",
      audienceClass: "APPLICANT_WORKFLOW",
      semanticIntent: "overloaded_legacy_application_reminder",
      operatorLabel: "Legacy Application Reminder",
      conditionPolicyId: "APPLICANT_REMINDER_LEGACY_OVERLOADED",
      allowedSendModes: ["selected", "batch"],
      requiresApplicantRow: true,
      requiresValidEmail: true,
      requiresContactConsent: false,
      requiredRole: "EXISTING_SEND_AUTHORITY",
      editableMode: "limited",
      batchSafe: true,
      fallbackInstruction: "Confirm the applicant condition before using this legacy reminder.",
      operatorWarning: "Overloaded legacy type: currently mapped across response, document, payment, and receipt contexts. Do not add new meanings.",
      auditMeaning: "Legacy reminder sent; the exact applicant condition must be interpreted from authoritative state and audit context.",
      subjectBuilderId: "buildApplicantMessage_",
      bodyBuilderId: "buildReminderEmailBody_",
      implementationStatus: "active",
      semanticRisk: "OVERLOADED"
    },
    {
      messageType: "fd_acknowledgement",
      templateVersion: "1",
      audienceClass: "APPLICANT_WORKFLOW",
      semanticIntent: "application_received",
      operatorLabel: "Application Received",
      conditionPolicyId: "APPLICATION_RECEIVED",
      allowedSendModes: ["selected"],
      requiresApplicantRow: true,
      requiresValidEmail: true,
      requiresContactConsent: false,
      requiredRole: "EXISTING_SEND_AUTHORITY",
      editableMode: "locked",
      batchSafe: false,
      fallbackInstruction: "Use manual contact follow-up when acknowledgement email cannot be delivered.",
      operatorWarning: "Confirms receipt only. It must not imply acceptance or enrolment.",
      auditMeaning: "Application receipt acknowledgement; no acceptance decision is represented.",
      subjectBuilderId: "buildApplicantMessage_",
      bodyBuilderId: "buildFdAcknowledgementEmailBody_",
      implementationStatus: "active",
      semanticAlias: "application_received"
    },
    {
      messageType: "application_feedback",
      templateVersion: "1",
      audienceClass: "APPLICANT_WORKFLOW",
      semanticIntent: "selected_applicant_correction_or_feedback",
      operatorLabel: "Application Feedback",
      conditionPolicyId: "APPLICANT_FEEDBACK_SELECTED",
      allowedSendModes: ["selected"],
      requiresApplicantRow: true,
      requiresValidEmail: true,
      requiresContactConsent: false,
      requiredRole: "EXISTING_SEND_AUTHORITY",
      editableMode: "limited",
      batchSafe: false,
      fallbackInstruction: "Use manual contact fallback if the applicant cannot receive email.",
      operatorWarning: "Selected applicant only. Verify corrections against the applicant record before sending.",
      auditMeaning: "Correction or feedback sent for one authoritative applicant record.",
      subjectBuilderId: "buildApplicantMessage_",
      bodyBuilderId: "buildApplicationFeedbackEmailBody_",
      implementationStatus: "active"
    },
    {
      messageType: "custom_email",
      templateVersion: "1",
      audienceClass: "OPERATOR_MANUAL",
      semanticIntent: "selected_recipient_custom_operator_email",
      operatorLabel: "Custom Email (Selected Applicant)",
      conditionPolicyId: "OPERATOR_SELECTED_CUSTOM",
      allowedSendModes: ["selected"],
      requiresApplicantRow: true,
      requiresValidEmail: true,
      requiresContactConsent: false,
      requiredRole: "EXISTING_SEND_AUTHORITY",
      editableMode: "freeform",
      batchSafe: false,
      fallbackInstruction: "Use manual contact fallback when email is unavailable.",
      operatorWarning: "Freeform and selected-recipient only. Never use as a batch message type.",
      auditMeaning: "Operator-authored email sent to one selected authoritative applicant record.",
      subjectBuilderId: "buildCustomSelectedEmailSubject_",
      bodyBuilderId: "buildCustomSelectedEmailBody_",
      implementationStatus: "active"
    },
    {
      messageType: "docs_missing",
      templateVersion: "1",
      audienceClass: "APPLICANT_WORKFLOW",
      semanticIntent: "documents_missing_or_not_received",
      operatorLabel: "Missing Documents Follow-Up",
      conditionPolicyId: "APPLICANT_DOCUMENTS_MISSING",
      allowedSendModes: ["selected", "batch"],
      requiresApplicantRow: true,
      requiresValidEmail: true,
      requiresContactConsent: false,
      requiredRole: "EXISTING_SEND_AUTHORITY",
      editableMode: "limited",
      batchSafe: true,
      fallbackInstruction: "Request document resubmission through an approved manual contact path when email is unavailable.",
      operatorWarning: "Do not blame the applicant or imply rejection. Batch use requires authoritative document-state filtering.",
      auditMeaning: "Applicant advised that required documents are missing, unresolved, or not received.",
      subjectBuilderId: "buildApplicantMessage_",
      bodyBuilderId: "buildDocsMissingEmailBody_",
      implementationStatus: "active"
    },
    {
      messageType: "payment_followup",
      templateVersion: "1",
      audienceClass: "APPLICANT_WORKFLOW",
      semanticIntent: "payment_reminder_or_follow_up",
      operatorLabel: "Payment Follow-Up",
      conditionPolicyId: "APPLICANT_PAYMENT_OUTSTANDING",
      allowedSendModes: ["selected", "batch"],
      requiresApplicantRow: true,
      requiresValidEmail: true,
      requiresContactConsent: false,
      requiredRole: "EXISTING_SEND_AUTHORITY",
      editableMode: "limited",
      batchSafe: true,
      fallbackInstruction: "Use an approved manual contact path when payment follow-up email is unavailable.",
      operatorWarning: "Must not imply acceptance or enrolment unless separate authority confirms that state.",
      auditMeaning: "Payment reminder or follow-up sent for an applicant with authoritative outstanding-payment state.",
      subjectBuilderId: "buildApplicantMessage_",
      bodyBuilderId: "buildPaymentFollowupEmailBody_",
      implementationStatus: "active"
    },
    {
      messageType: "prospect_general_guidance",
      templateVersion: "manual-selected-1",
      audienceClass: "PROSPECT_GUIDANCE",
      semanticIntent: "general_fode_guidance_for_interested_people",
      operatorLabel: "General FODE Guidance",
      conditionPolicyId: "PROSPECT_MANUAL_SELECTED",
      allowedSendModes: ["selected"],
      requiresApplicantRow: true,
      requiresValidEmail: true,
      requiresContactConsent: true,
      requiredRole: "EXISTING_SEND_AUTHORITY",
      editableMode: "limited",
      batchSafe: false,
      fallbackInstruction: "Use only as an operator-controlled selected-recipient message. Do not use applicant Stage Batch authority.",
      operatorWarning: "Manual selected-applicant gate only. Must not use applicant Stage Batch authority.",
      auditMeaning: "Operator-reviewed general FODE guidance sent from a selected-recipient context.",
      subjectBuilderId: "buildProspectGeneralGuidanceSubject_",
      bodyBuilderId: "buildProspectGeneralGuidanceBody_",
      implementationStatus: "active",
      authorityModel: "SELECTED_RECIPIENT_MANUAL_AUTHORITY"
    },
    {
      messageType: "application_receipt_request",
      templateVersion: "manual-selected-1",
      audienceClass: "APPLICANT_WORKFLOW",
      semanticIntent: "request_payment_receipt_or_proof",
      operatorLabel: "Request Payment Receipt",
      conditionPolicyId: "APPLICANT_RECEIPT_REQUIRED_MANUAL_SELECTED",
      allowedSendModes: ["selected"],
      requiresApplicantRow: true,
      requiresValidEmail: true,
      requiresContactConsent: false,
      requiredRole: "EXISTING_SEND_AUTHORITY",
      editableMode: "limited",
      batchSafe: false,
      fallbackInstruction: "Use selected-applicant manual preview/send only after confirming payment evidence is required.",
      operatorWarning: "Payment and receipt state must be checked before sending.",
      auditMeaning: "Payment receipt or proof requested for one selected applicant.",
      subjectBuilderId: "buildApplicationReceiptRequestSubject_",
      bodyBuilderId: "buildApplicationReceiptRequestBody_",
      implementationStatus: "active"
    },
    {
      messageType: "application_verified_quote",
      templateVersion: "manual-selected-1",
      audienceClass: "APPLICANT_WORKFLOW",
      semanticIntent: "documents_verified_quote_payment_and_subject_guidance",
      operatorLabel: "Verified Documents - Quote and Payment Guidance",
      conditionPolicyId: "VERIFIED_QUOTE_MANUAL_SELECTED",
      allowedSendModes: ["selected"],
      requiresApplicantRow: true,
      requiresValidEmail: true,
      requiresContactConsent: false,
      requiredRole: "EXISTING_SEND_AUTHORITY",
      editableMode: "limited",
      batchSafe: false,
      fallbackInstruction: "Use selected-applicant manual preview/send only after quote/payment guidance has been checked.",
      operatorWarning: "Existing docs_verified_quote_email remains separate. Do not imply final acceptance.",
      auditMeaning: "Quote, payment, and subject guidance sent for one selected applicant after operator review.",
      subjectBuilderId: "buildApplicationVerifiedQuoteSubject_",
      bodyBuilderId: "buildApplicationVerifiedQuoteBody_",
      implementationStatus: "active",
      legacyExternalType: "docs_verified_quote_email"
    },
    {
      messageType: "application_acceptance_confirmation",
      templateVersion: "manual-selected-1",
      audienceClass: "APPLICANT_WORKFLOW",
      semanticIntent: "acceptance_or_enrolment_confirmation",
      operatorLabel: "Acceptance / Enrolment Confirmation",
      conditionPolicyId: "ACCEPTANCE_MANUAL_SELECTED",
      allowedSendModes: ["selected"],
      requiresApplicantRow: true,
      requiresValidEmail: true,
      requiresContactConsent: false,
      requiredRole: "EXISTING_SEND_AUTHORITY",
      editableMode: "limited",
      batchSafe: false,
      fallbackInstruction: "Send only when final acceptance and enrolment authority has been checked by the operator.",
      operatorWarning: "High-authority selected-applicant message. Do not send from payment or actionability alone.",
      auditMeaning: "Acceptance or enrolment confirmation sent for one selected applicant after operator review.",
      subjectBuilderId: "buildApplicationAcceptanceConfirmationSubject_",
      bodyBuilderId: "buildApplicationAcceptanceConfirmationBody_",
      implementationStatus: "active"
    },
    {
      messageType: "application_exam_fee_reminder",
      templateVersion: "manual-selected-1",
      audienceClass: "APPLICANT_WORKFLOW",
      semanticIntent: "national_exam_fee_due_reminder",
      operatorLabel: "National Exam Fee Reminder",
      conditionPolicyId: "EXAM_FEE_DUE_MANUAL_SELECTED",
      allowedSendModes: ["selected"],
      requiresApplicantRow: true,
      requiresValidEmail: true,
      requiresContactConsent: false,
      requiredRole: "EXISTING_SEND_AUTHORITY",
      editableMode: "limited",
      batchSafe: false,
      fallbackInstruction: "Confirm exam-fee-due authority and subject count before sending.",
      operatorWarning: "K150 per subject is the current operator-known fee; confirm the subject count before calculating or communicating an applicant-specific amount.",
      auditMeaning: "National Exam Fee reminder sent for one selected applicant after fee and subject-count review.",
      subjectBuilderId: "buildApplicationExamFeeReminderSubject_",
      bodyBuilderId: "buildApplicationExamFeeReminderBody_",
      implementationStatus: "active",
      requiresExamFeeDueAuthority: true,
      requiresSubjectConfirmation: true,
      currentFeePerSubjectKina: 150
    },
    {
      messageType: "application_final_reminder",
      templateVersion: "manual-selected-1",
      audienceClass: "APPLICANT_WORKFLOW",
      semanticIntent: "final_follow_up_before_dormant_or_manual_handling",
      operatorLabel: "Final Application Reminder",
      conditionPolicyId: "FINAL_REMINDER_MANUAL_SELECTED",
      allowedSendModes: ["selected"],
      requiresApplicantRow: true,
      requiresValidEmail: true,
      requiresContactConsent: false,
      requiredRole: "EXISTING_SEND_AUTHORITY",
      editableMode: "limited",
      batchSafe: false,
      fallbackInstruction: "Use only after operator review of cadence and applicant state.",
      operatorWarning: "Must not be inferred solely from elapsed time or generic actionability.",
      auditMeaning: "Final follow-up sent for one selected applicant after operator review.",
      subjectBuilderId: "buildApplicationFinalReminderSubject_",
      bodyBuilderId: "buildApplicationFinalReminderBody_",
      implementationStatus: "active"
    },
    {
      messageType: "contact_fallback_manual",
      templateVersion: "manual-selected-1",
      audienceClass: "OPERATOR_MANUAL",
      semanticIntent: "invalid_email_or_no_effective_email_manual_contact_path",
      operatorLabel: "Manual Contact Fallback",
      conditionPolicyId: "NO_EFFECTIVE_EMAIL_MANUAL_FALLBACK",
      allowedSendModes: ["selected"],
      requiresApplicantRow: true,
      requiresValidEmail: false,
      requiresContactConsent: true,
      requiredRole: "EXISTING_MANUAL_FALLBACK_AUTHORITY",
      editableMode: "limited",
      batchSafe: false,
      fallbackInstruction: "Use the approved phone or WhatsApp manual-contact process. This selected surface records and previews the operator guidance only.",
      operatorWarning: "Manual fallback only. Do not use as a bulk email message type.",
      auditMeaning: "Manual contact fallback guidance prepared because effective email contact is unavailable.",
      subjectBuilderId: "buildContactFallbackManualSubject_",
      bodyBuilderId: "buildContactFallbackManualBody_",
      implementationStatus: "active"
    }
  ];
}

function getCommunicationSemanticDefinition_(messageType) {
  var requested = clean_(messageType || "").toLowerCase();
  var registry = getCommunicationSemanticRegistry_();
  for (var i = 0; i < registry.length; i++) {
    if (registry[i].messageType === requested) return registry[i];
  }
  return null;
}

function communicationSendAuthorityForDefinition_(definition) {
  var def = definition && typeof definition === "object" ? definition : {};
  var modes = Array.isArray(def.allowedSendModes) ? def.allowedSendModes.slice() : [];
  var selected = modes.indexOf("selected") >= 0;
  var batch = modes.indexOf("batch") >= 0 && def.batchSafe === true;
  return {
    allowedSendModes: modes,
    selectedApplicantSafe: selected,
    batchSafe: batch,
    selectedOnly: selected && !batch
  };
}

function communicationDefinitionSupportsMode_(definition, sendMode) {
  var mode = clean_(sendMode || "");
  if (!mode) return false;
  return communicationSendAuthorityForDefinition_(definition).allowedSendModes.indexOf(mode) >= 0;
}

function communicationTemplateGalleryCopy_() {
  return {
    legacy_invite: {
      selectedOptionLabel: "Application Portal Invitation",
      selectedOptionOrder: 10,
      purpose: "Send or resend secure application portal access for an applicant record.",
      whenToUse: "Use when the applicant needs the portal link to complete or continue the application.",
      stageSuitability: "Invite pending / portal access pending.",
      needsPaymentQuoteData: false
    },
    reminder: {
      selectedOptionLabel: "Legacy Application Reminder (Overloaded)",
      selectedOptionOrder: 20,
      purpose: "General legacy reminder for an applicant who still needs to take action.",
      whenToUse: "Use only after checking the current applicant condition; this type remains overloaded.",
      stageSuitability: "Legacy reminder states only; prefer a more specific selected template when possible.",
      needsPaymentQuoteData: false
    },
    fd_acknowledgement: {
      selectedPickerVisible: false,
      purpose: "Acknowledge that an application was received.",
      whenToUse: "Use for receipt acknowledgement only; it does not confirm acceptance.",
      stageSuitability: "Application received / FD received.",
      needsPaymentQuoteData: false
    },
    application_feedback: {
      selectedOptionLabel: "Application Feedback",
      selectedOptionOrder: 50,
      purpose: "Send selected-applicant correction or feedback guidance.",
      whenToUse: "Use when the operator has reviewed the record and needs a specific correction or explanation.",
      stageSuitability: "Manual selected-applicant review.",
      needsPaymentQuoteData: false
    },
    custom_email: {
      selectedOptionLabel: "Custom Email - Selected Applicant",
      selectedOptionOrder: 60,
      purpose: "General FODE KIA admissions/program information or one-off operator message.",
      whenToUse: "Use for a selected applicant when no specific operational template fits.",
      stageSuitability: "Manual review / unclear state.",
      needsPaymentQuoteData: false
    },
    docs_missing: {
      selectedOptionLabel: "Missing Documents - Selected Applicant",
      selectedOptionOrder: 30,
      purpose: "Ask the parent/applicant to upload or resend missing or incomplete documents.",
      whenToUse: "Use when required document evidence is missing, incomplete, rejected, or not received.",
      stageSuitability: "Missing documents / document correction required.",
      needsPaymentQuoteData: false
    },
    payment_followup: {
      selectedOptionLabel: "Payment / Receipt Follow-Up",
      selectedOptionOrder: 40,
      purpose: "Follow up on payment evidence or receipt verification.",
      whenToUse: "Use when payment evidence is uploaded but not verified, or payment remains outstanding.",
      stageSuitability: "Receipt uploaded / payment evidence awaiting verification.",
      needsPaymentQuoteData: true
    },
    prospect_general_guidance: {
      selectedOptionLabel: "Prospect General Guidance - Selected Applicant",
      selectedOptionOrder: 110,
      purpose: "Provide safe general FODE KIA guidance without applicant-specific commitments.",
      whenToUse: "Use manually for a selected recipient needing general program or admissions information.",
      stageSuitability: "Manual guidance only; not Stage Batch.",
      needsPaymentQuoteData: false
    },
    application_receipt_request: {
      selectedOptionLabel: "Payment Receipt Request - Selected Applicant",
      selectedOptionOrder: 120,
      purpose: "Request payment receipt or payment proof from a selected applicant.",
      whenToUse: "Use when payment was expected but receipt/proof is missing.",
      stageSuitability: "Awaiting receipt / payment proof.",
      needsPaymentQuoteData: true
    },
    application_verified_quote: {
      selectedOptionLabel: "Verified Quote / Fee Guidance - Selected Applicant",
      selectedOptionOrder: 80,
      purpose: "Send document-verified quote, subject, and payment instruction guidance.",
      whenToUse: "Use after documents are verified and before payment evidence is received.",
      stageSuitability: "Documents verified + no receipt/payment evidence.",
      needsPaymentQuoteData: true
    },
    application_acceptance_confirmation: {
      selectedOptionLabel: "Acceptance Confirmation - Selected Applicant",
      selectedOptionOrder: 70,
      purpose: "Confirm acceptance/enrolment outcome after operator authority confirms it.",
      whenToUse: "Use only when acceptance/enrolment status is known and checked.",
      stageSuitability: "Payment verified + acceptance/enrolment authority available.",
      needsPaymentQuoteData: false
    },
    application_exam_fee_reminder: {
      selectedOptionLabel: "National Exam Fee Reminder - Selected Applicant",
      selectedOptionOrder: 100,
      purpose: "Remind about National Exam Fee after subject count and fee authority are checked.",
      whenToUse: "Use only when exam-fee-due status is known.",
      stageSuitability: "Manual exam-fee review.",
      needsPaymentQuoteData: true
    },
    application_final_reminder: {
      selectedOptionLabel: "Final Reminder - Selected Applicant",
      selectedOptionOrder: 90,
      purpose: "Final selected-applicant follow-up before manual/dormant handling.",
      whenToUse: "Use only after operator review of cadence, deadline, and applicant state.",
      stageSuitability: "Final manual follow-up.",
      needsPaymentQuoteData: false
    },
    contact_fallback_manual: {
      selectedOptionLabel: "Manual Contact Fallback - Selected Applicant",
      selectedOptionOrder: 130,
      purpose: "Manual contact fallback guidance when email is unavailable or unreliable.",
      whenToUse: "Use when email cannot be used and WhatsApp/phone/manual handling is required.",
      stageSuitability: "Invalid email / no effective email / bounced contact.",
      needsPaymentQuoteData: false
    }
  };
}

function communicationTemplateGalleryMetadata_() {
  var registry = getCommunicationSemanticRegistry_();
  var copy = communicationTemplateGalleryCopy_();
  var builtIns = registry.filter(function (entry) {
    return entry && entry.implementationStatus === "active" && communicationDefinitionSupportsMode_(entry, "selected");
  }).map(function (entry) {
    var extra = copy[entry.messageType] || {};
    var requiresPlaceholders = communicationRequiresResolvedActionPlaceholders_(entry.messageType);
    var sendAuthority = communicationSendAuthorityForDefinition_(entry);
    var authorityRule = getCommunicationAuthorityRule_(entry.messageType) || {};
    return {
      messageType: entry.messageType,
      label: clean_(entry.operatorLabel || entry.messageType),
      selectedOptionLabel: clean_(extra.selectedOptionLabel || entry.operatorLabel || entry.messageType),
      selectedOptionOrder: Number(extra.selectedOptionOrder || 999),
      selectedPickerVisible: extra.selectedPickerVisible === false ? false : true,
      purpose: clean_(extra.purpose || entry.semanticIntent || ""),
      whenToUse: clean_(extra.whenToUse || entry.fallbackInstruction || ""),
      stageSuitability: clean_(extra.stageSuitability || entry.conditionPolicyId || ""),
      selectedOnly: sendAuthority.selectedOnly === true,
      batchSafe: sendAuthority.batchSafe === true,
      allowedSendModes: sendAuthority.allowedSendModes,
      requiresPaymentQuoteData: extra.needsPaymentQuoteData === true,
      requiresPortalLink: communicationRequiresPortalUrl_(entry.messageType),
      requiresResolvedPlaceholders: requiresPlaceholders,
      placeholderPolicy: requiresPlaceholders ? "Blocks send until ACTION REQUIRED placeholders are resolved." : "No mandatory operational placeholder gate.",
      editableMode: clean_(entry.editableMode || ""),
      semanticRisk: clean_(entry.semanticRisk || ""),
      protectedCommunication: authorityRule.protectedAction === true,
      overridePermitted: authorityRule.overridePermitted === true,
      permittedLifecycleStages: Array.isArray(authorityRule.permittedLifecycleStages) ? authorityRule.permittedLifecycleStages.slice() : [],
      requiredDocumentState: clean_(authorityRule.requiredDocumentState || ""),
      requiredPaymentState: clean_(authorityRule.requiredPaymentState || ""),
      requiredVerificationState: clean_(authorityRule.requiredVerificationState || ""),
      requiredApplicantState: clean_(authorityRule.requiredApplicantState || ""),
      operatorWarning: clean_(entry.operatorWarning || ""),
      auditMeaning: clean_(entry.auditMeaning || "")
    };
  });
  return builtIns.concat(typeof communicationActiveTemplateVariantMetadata_ === "function" ? communicationActiveTemplateVariantMetadata_() : []);
}

function communicationTemplateVariantIndexKey_() {
  return "COMM_TEMPLATE_INDEX_V1";
}

function communicationTemplateVariantKey_(templateId, versionId) {
  return "COMM_TEMPLATE::" + clean_(templateId || "") + "::" + clean_(versionId || "");
}

function communicationReadTemplateVariantIndex_() {
  var raw = "";
  try { raw = PropertiesService.getScriptProperties().getProperty(communicationTemplateVariantIndexKey_()) || ""; } catch (_err) {}
  if (!clean_(raw || "")) return { schemaVersion: "COMM_TEMPLATE_INDEX_V1", activeTemplateIds: [], latestVersionByTemplateId: {} };
  var parsed = JSON.parse(raw);
  if (!parsed || parsed.schemaVersion !== "COMM_TEMPLATE_INDEX_V1" || !Array.isArray(parsed.activeTemplateIds) || !parsed.latestVersionByTemplateId) {
    throw new Error("COMM_TEMPLATE_INDEX_INVALID");
  }
  return parsed;
}

function communicationValidateTemplateVariantPayload_(payload) {
  var p = payload && typeof payload === "object" ? payload : {};
  var parent = normalizeApplicantMessageType_(p.parentMessageType || p.parentSemanticTemplate || "");
  var definition = getCommunicationSemanticDefinition_(parent);
  if (!definition || definition.implementationStatus !== "active") throw new Error("UNKNOWN_PARENT_TEMPLATE");
  var name = clean_(p.name || p.templateName || "");
  var subject = clean_(p.subjectTemplate || p.subject || "");
  var body = String(p.bodyTemplate || p.body || "");
  if (!name || !subject || !clean_(body || "")) throw new Error("COMM_TEMPLATE_VARIANT_REQUIRED_FIELDS");
  var validation = communicationValidateTemplateTokens_(subject, body, ["portal_url", "applicant_name", "applicant_id", "grade", "subjects"]);
  if (validation.ok !== true) throw new Error(validation.code + ": " + validation.unresolvedToken);
  var bytes = Utilities.newBlob(JSON.stringify(p), "application/json").getBytes().length;
  if (bytes > 7000) throw new Error("COMM_TEMPLATE_VARIANT_TOO_LARGE");
  return { parent: parent, definition: definition, name: name, subject: subject, body: body };
}

function communicationActiveTemplateVariantMetadata_() {
  var index;
  try { index = communicationReadTemplateVariantIndex_(); } catch (_err) { return []; }
  return (index.activeTemplateIds || []).map(function (templateId) {
    var versionId = clean_(index.latestVersionByTemplateId && index.latestVersionByTemplateId[templateId] || "");
    if (!versionId) return null;
    var raw = PropertiesService.getScriptProperties().getProperty(communicationTemplateVariantKey_(templateId, versionId)) || "";
    if (!raw) throw new Error("COMM_TEMPLATE_VARIANT_MISSING");
    var variant = JSON.parse(raw);
    if (!variant || variant.status !== "ACTIVE" || variant.templateId !== templateId || variant.versionId !== versionId) throw new Error("COMM_TEMPLATE_VARIANT_INDEX_MISMATCH");
    var parent = getCommunicationSemanticDefinition_(variant.parentMessageType);
    if (!parent) return null;
    var authority = communicationSendAuthorityForDefinition_(parent);
    return {
      messageType: variant.templateId,
      parentMessageType: variant.parentMessageType,
      templateId: variant.templateId,
      templateVersionId: variant.versionId,
      templateSource: "SAVED_VARIANT",
      label: clean_(variant.name || ""),
      selectedOptionLabel: clean_(variant.name || ""),
      selectedOptionOrder: 500,
      purpose: clean_(variant.description || ""),
      whenToUse: clean_(variant.description || ""),
      stageSuitability: clean_(parent.conditionPolicyId || ""),
      selectedOnly: authority.selectedOnly === true,
      batchSafe: authority.batchSafe === true,
      allowedSendModes: authority.allowedSendModes,
      requiresPortalLink: communicationRequiresPortalUrl_(variant.parentMessageType),
      requiresResolvedPlaceholders: true,
      createdAt: clean_(variant.createdAt || ""),
      editableMode: clean_(parent.editableMode || ""),
      operatorWarning: clean_(parent.operatorWarning || ""),
      auditMeaning: clean_(parent.auditMeaning || ""),
      subjectTemplate: clean_(variant.subjectTemplate || ""),
      bodyTemplate: String(variant.bodyTemplate || "")
    };
  }).filter(function (item) { return !!item; });
}

function admin_saveReusableCommunicationTemplate(payload) {
  var adminEmail = getCallerEmail_();
  if (!isAdmin_(adminEmail) || clean_(getAdminRole_(adminEmail) || "").toUpperCase() !== "SUPER") throw new Error("Access denied");
  var validated = communicationValidateTemplateVariantPayload_(payload);
  var props = PropertiesService.getScriptProperties();
  var index = communicationReadTemplateVariantIndex_();
  if ((index.activeTemplateIds || []).length >= 25 && index.activeTemplateIds.indexOf(clean_(payload.templateId || "")) < 0) throw new Error("COMM_TEMPLATE_VARIANT_LIMIT");
  var templateId = clean_(payload.templateId || ("saved_" + Utilities.getUuid().replace(/[^A-Za-z0-9]+/g, "").slice(0, 20)));
  var priorVersion = Number(index.latestVersionByTemplateId[templateId] || 0);
  var versionId = String(priorVersion + 1);
  var variant = {
    templateId: templateId,
    versionId: versionId,
    parentMessageType: validated.parent,
    name: validated.name,
    description: clean_(payload.description || ""),
    subjectTemplate: validated.subject,
    bodyTemplate: validated.body,
    allowedMergeFields: ["portal_url", "applicant_name", "applicant_id", "grade", "subjects"],
    allowedSendModes: communicationSendAuthorityForDefinition_(validated.definition).allowedSendModes,
    batchSafe: communicationSendAuthorityForDefinition_(validated.definition).batchSafe === true,
    createdBy: clean_(adminEmail || ""),
    createdAt: new Date().toISOString(),
    status: "ACTIVE"
  };
  var key = communicationTemplateVariantKey_(templateId, versionId);
  if (props.getProperty(key)) throw new Error("COMM_TEMPLATE_VARIANT_OVERWRITE_BLOCKED");
  props.setProperty(key, JSON.stringify(variant));
  if (index.activeTemplateIds.indexOf(templateId) < 0) index.activeTemplateIds.push(templateId);
  index.latestVersionByTemplateId[templateId] = versionId;
  props.setProperty(communicationTemplateVariantIndexKey_(), JSON.stringify(index));
  try {
    var readBackIndex = communicationReadTemplateVariantIndex_();
    var readBack = communicationLoadActiveTemplateVariant_(templateId, versionId);
    if (!readBack
      || readBack.status !== "ACTIVE"
      || readBack.templateId !== templateId
      || readBack.versionId !== versionId
      || readBack.parentMessageType !== validated.parent
      || readBackIndex.activeTemplateIds.indexOf(templateId) < 0
      || clean_(readBackIndex.latestVersionByTemplateId[templateId] || "") !== versionId) {
      throw new Error("READBACK_MISMATCH");
    }
  } catch (_readBackErr) {
    throw new Error("REUSABLE_TEMPLATE_READBACK_FAILED");
  }
  campaignLog_("COMM_TEMPLATE_VARIANT_CREATE", { templateId: templateId, versionId: versionId, parentMessageType: validated.parent, actorEmail: adminEmail });
  return { ok: true, templateId: templateId, versionId: versionId, parentMessageType: validated.parent, active: true, readBackVerified: true };
}
function getCommunicationSemanticDefinitionsByStatus_(status) {
  var requested = clean_(status || "").toLowerCase();
  return getCommunicationSemanticRegistry_().filter(function (entry) {
    return clean_(entry.implementationStatus || "").toLowerCase() === requested;
  });
}

function isCommunicationTypeBatchSafe_(messageType) {
  var definition = getCommunicationSemanticDefinition_(messageType);
  return !!(definition && definition.implementationStatus === "active" && communicationSendAuthorityForDefinition_(definition).batchSafe === true);
}

function isCommunicationTypePlanned_(messageType) {
  var definition = getCommunicationSemanticDefinition_(messageType);
  return !!(definition && definition.implementationStatus === "planned");
}

function getCommunicationAllowedSendModes_(messageType) {
  var definition = getCommunicationSemanticDefinition_(messageType);
  return definition ? communicationSendAuthorityForDefinition_(definition).allowedSendModes : [];
}

function communicationCooldownMs_() {
  return Math.max(1, Number(CONFIG.COMMUNICATION_COOLDOWN_MINUTES || 60)) * 60 * 1000;
}

function communicationCooldownKey_(applicantId, messageType) {
  return getCommunicationCooldownCacheKey_(applicantId, messageType);
}

function getLastCommunicationSentAt_(applicantId, messageType) {
  var state = getCommunicationCooldownState_(applicantId, messageType);
  return clean_((state && (state.sentAt || state.cachedAt)) || "");
}

function buildCommunicationCooldownPreviewLookup_(messageType) {
  var normalizedType = normalizeApplicantMessageType_(messageType);
  return {
    ok: true,
    source: "CACHE_SERVICE_NON_ENUMERABLE",
    messageType: normalizedType,
    byApplicantId: {}
  };
}

function setLastCommunicationSentAt_(applicantId, messageType, isoValue) {
  setCommunicationCooldownState_(applicantId, messageType, {
    sentAt: clean_(isoValue || new Date().toISOString()),
    source: "email_dispatch"
  }, Math.ceil(communicationCooldownMs_() / 1000));
}

function communicationGetActorInfo_(opts) {
  var o = opts && typeof opts === "object" ? opts : {};
  var email = clean_(o.actorEmail || "");
  if (!email && typeof getCallerEmail_ === "function") email = clean_(getCallerEmail_() || "");
  var role = clean_(o.actorRole || "").toUpperCase();
  if (!role && email) {
    if (typeof getAdminRole_ === "function") role = clean_(getAdminRole_(email) || "").toUpperCase();
    if (!role) {
      var mapped = CONFIG.ADMIN_ROLES || {};
      role = clean_(mapped[String(email || "").toLowerCase()] || "VERIFIER").toUpperCase();
    }
  }
  var isAdmin = false;
  if (typeof isAdmin_ === "function") isAdmin = isAdmin_(email);
  else isAdmin = !!role;
  if (!role && isAdmin) role = "VERIFIER";
  return {
    email: email,
    role: role || "",
    isAdmin: !!isAdmin,
    isSuper: role === "SUPER"
  };
}

function communicationRequiredCapabilityForAction_(messageType, action) {
  var normalizedType = normalizeApplicantMessageType_(messageType || "");
  var normalizedAction = clean_(action || "").toLowerCase();
  if (normalizedAction === "preview") return "CAN_PREVIEW_APPLICANT_COMMUNICATION";
  if (normalizedAction !== "send") return "";
  if (normalizedType === "application_verified_quote") return "CAN_GENERATE_STANDARD_QUOTE";
  return "CAN_SEND_INDIVIDUAL_EMAIL";
}

function communicationActorHasCapability_(actor, capability) {
  var key = clean_(capability || "").toUpperCase();
  if (!key) return true;
  if (typeof adminHasCapability_ === "function") {
    return adminHasCapability_({
      email: clean_(actor && actor.email || ""),
      actorRole: clean_(actor && actor.role || "")
    }, key);
  }
  var info = actor || {};
  if (key === "CAN_PREVIEW_APPLICANT_COMMUNICATION") return info.isAdmin === true;
  if (key === "CAN_GENERATE_STANDARD_QUOTE") return info.isAdmin === true;
  if (key === "CAN_SEND_INDIVIDUAL_EMAIL") return info.isAdmin === true;
  return false;
}

function communicationCapabilityBlock_(actor, messageType, action) {
  var capability = communicationRequiredCapabilityForAction_(messageType, action);
  if (!capability) return null;
  if (communicationActorHasCapability_(actor, capability)) return null;
  var blockCode = typeof adminCapabilityBlockCode_ === "function"
    ? clean_(adminCapabilityBlockCode_(capability) || "")
    : "ROLE_BLOCKED";
  var blockReason = typeof adminCapabilityBlockReason_ === "function"
    ? clean_(adminCapabilityBlockReason_(capability) || "")
    : communicationBlockReason_("ROLE_BLOCKED", messageType);
  return {
    capability: capability,
    blockCode: blockCode || "ROLE_BLOCKED",
    blockReason: blockReason || communicationBlockReason_("ROLE_BLOCKED", messageType)
  };
}

function communicationBlockReason_(code, messageType) {
  var map = {
    NO_EFFECTIVE_EMAIL: "No effective parent email is available.",
    INVALID_EMAIL: "Applicant does not have a valid email address.",
    BOUNCED: "This applicant email is marked as bounced.",
    DO_NOT_CONTACT: "This applicant is marked as do not contact.",
    PORTAL_ALREADY_SUBMITTED: "The portal has already been submitted for this applicant.",
    MISSING_PORTAL_SECRET: "No active portal link is available for this applicant.",
    COOLDOWN_ACTIVE: "A recent message of this type was already sent. Try again later.",
    ROLE_BLOCKED: "Your role is not allowed to perform this action.",
    UNKNOWN_MESSAGE_TYPE: "Unsupported message type.",
    APPLICANT_NOT_FOUND: "Applicant not found.",
    UNKNOWN_FILTER_TYPE: "Unsupported batch planning filter.",
    DOCS_ALREADY_COMPLETE: "Documents are already complete for this applicant.",
    PAYMENT_ALREADY_RESOLVED: "Payment is already resolved for this applicant.",
    DOCS_NOT_VERIFIED_FOR_PAYMENT: "Documents must be verified before payment communication is recommended.",
    PAYMENT_EVIDENCE_ALREADY_PRESENT: "Payment evidence is already present for this applicant.",
    QUOTE_NOT_READY: "Quote details are not ready for this applicant.",
    SUBJECTS_AUTHORITY_REQUIRED: "Authoritative subject selection is required before this communication can be previewed.",
    COMM_AUTHORITY_BLOCKED: "This communication is blocked by the lifecycle authority matrix.",
    COMM_OVERRIDE_DENIED: "Only Super Admin may override this protected communication gate.",
    COMM_OVERRIDE_REASON_REQUIRED: "Super Admin override requires a written justification of at least 20 characters.",
    ACCEPTANCE_NOT_CONFIRMED: "Acceptance or enrolment authority is not confirmed for this applicant.",
    APPLICANT_COMMUNICATION_PREVIEW_CAPABILITY_REQUIRED: "Applicant communication preview capability is required.",
    INDIVIDUAL_EMAIL_CAPABILITY_REQUIRED: "Individual applicant email capability is required before send.",
    INDIVIDUAL_WHATSAPP_CAPABILITY_REQUIRED: "Individual applicant WhatsApp capability is required before send.",
    PORTAL_LINK_CAPABILITY_REQUIRED: "Portal-link insertion capability is required.",
    STANDARD_QUOTE_CAPABILITY_REQUIRED: "Standard quote capability is required.",
    STANDARD_INVOICE_CAPABILITY_REQUIRED: "Standard invoice capability is required.",
    PAYMENT_VERIFICATION_CAPABILITY_REQUIRED: "Payment verification capability is required.",
    BATCH_COMMUNICATION_CAPABILITY_REQUIRED: "Batch communication capability is required.",
    COOLDOWN_OVERRIDE_CAPABILITY_REQUIRED: "Cooldown override capability is required.",
    FINANCIAL_OVERRIDE_CAPABILITY_REQUIRED: "Financial override capability is required."
  };
  return map[clean_(code || "")] || ("Action blocked for message type: " + clean_(messageType || "unknown"));
}

function getCommunicationAuthorityMatrix_() {
  return {
    legacy_invite: {
      permittedLifecycleStages: ["INVITE_PENDING", "INVITED_AWAITING_RESPONSE", "REMINDER_DUE", "DOCS_REQUIRED"],
      requiredDocumentState: "NOT_VERIFIED",
      requiredPaymentState: "ANY",
      requiredVerificationState: "NOT_ACCEPTED",
      requiredApplicantState: "ACTIVE",
      minimumRole: "EXISTING_SEND_AUTHORITY",
      protectedAction: false,
      overridePermitted: false,
      overrideConditions: []
    },
    reminder: {
      permittedLifecycleStages: ["INVITED_AWAITING_RESPONSE", "REMINDER_DUE"],
      requiredDocumentState: "ANY",
      requiredPaymentState: "ANY",
      requiredVerificationState: "NOT_ACCEPTED",
      requiredApplicantState: "ACTIVE",
      minimumRole: "EXISTING_SEND_AUTHORITY",
      protectedAction: false,
      overridePermitted: false,
      overrideConditions: []
    },
    fd_acknowledgement: {
      permittedLifecycleStages: ["INVITE_PENDING", "INVITED_AWAITING_RESPONSE", "REMINDER_DUE", "DOCS_REQUIRED", "PROCESSING"],
      requiredDocumentState: "NOT_VERIFIED",
      requiredPaymentState: "ANY",
      requiredVerificationState: "NOT_ACCEPTED",
      requiredApplicantState: "ACTIVE",
      minimumRole: "EXISTING_SEND_AUTHORITY",
      protectedAction: false,
      overridePermitted: false,
      overrideConditions: []
    },
    docs_missing: {
      permittedLifecycleStages: ["DOCS_REQUIRED", "PROCESSING"],
      requiredDocumentState: "MISSING_OR_UNVERIFIED",
      requiredPaymentState: "ANY",
      requiredVerificationState: "NOT_ACCEPTED",
      requiredApplicantState: "ACTIVE",
      minimumRole: "EXISTING_SEND_AUTHORITY",
      protectedAction: false,
      overridePermitted: false,
      overrideConditions: []
    },
    application_feedback: {
      permittedLifecycleStages: ["DOCS_REQUIRED", "PROCESSING"],
      requiredDocumentState: "MISSING_OR_UNVERIFIED",
      requiredPaymentState: "ANY",
      requiredVerificationState: "NOT_ACCEPTED",
      requiredApplicantState: "ACTIVE",
      minimumRole: "EXISTING_SEND_AUTHORITY",
      protectedAction: false,
      overridePermitted: false,
      overrideConditions: []
    },
    custom_email: {
      permittedLifecycleStages: ["ANY"],
      requiredDocumentState: "ANY",
      requiredPaymentState: "ANY",
      requiredVerificationState: "ANY",
      requiredApplicantState: "ACTIVE",
      minimumRole: "EXISTING_SEND_AUTHORITY",
      protectedAction: false,
      overridePermitted: false,
      overrideConditions: []
    },
    payment_followup: {
      permittedLifecycleStages: ["PAYMENT_REQUIRED", "RECEIPT_AWAITING_VERIFICATION"],
      requiredDocumentState: "VERIFIED",
      requiredPaymentState: "OUTSTANDING",
      requiredVerificationState: "NOT_ACCEPTED",
      requiredApplicantState: "ACTIVE",
      minimumRole: "EXISTING_SEND_AUTHORITY",
      protectedAction: true,
      overridePermitted: true,
      overrideConditions: ["SUPER_ADMIN", "JUSTIFICATION_REQUIRED", "AUDIT_LOG_REQUIRED"]
    },
    application_receipt_request: {
      permittedLifecycleStages: ["PAYMENT_REQUIRED"],
      requiredDocumentState: "VERIFIED",
      requiredPaymentState: "EVIDENCE_MISSING",
      requiredVerificationState: "NOT_ACCEPTED",
      requiredApplicantState: "ACTIVE",
      minimumRole: "EXISTING_SEND_AUTHORITY",
      protectedAction: true,
      overridePermitted: true,
      overrideConditions: ["SUPER_ADMIN", "JUSTIFICATION_REQUIRED", "AUDIT_LOG_REQUIRED"]
    },
    application_verified_quote: {
      permittedLifecycleStages: ["PAYMENT_REQUIRED", "RECEIPT_AWAITING_VERIFICATION"],
      requiredDocumentState: "VERIFIED",
      requiredPaymentState: "QUOTE_ELIGIBLE_NOT_VERIFIED",
      requiredVerificationState: "NOT_ACCEPTED",
      requiredApplicantState: "ACTIVE",
      minimumRole: "EXISTING_SEND_AUTHORITY",
      protectedAction: true,
      overridePermitted: true,
      overrideConditions: ["SUPER_ADMIN", "JUSTIFICATION_REQUIRED", "AUDIT_LOG_REQUIRED"]
    },
    application_acceptance_confirmation: {
      permittedLifecycleStages: ["COMPLETE"],
      requiredDocumentState: "VERIFIED",
      requiredPaymentState: "VERIFIED",
      requiredVerificationState: "ACCEPTANCE_CONFIRMED",
      requiredApplicantState: "ACCEPTED",
      minimumRole: "EXISTING_SEND_AUTHORITY",
      protectedAction: true,
      overridePermitted: true,
      overrideConditions: ["SUPER_ADMIN", "JUSTIFICATION_REQUIRED", "AUDIT_LOG_REQUIRED"]
    },
    application_exam_fee_reminder: {
      permittedLifecycleStages: ["COMPLETE"],
      requiredDocumentState: "VERIFIED",
      requiredPaymentState: "VERIFIED",
      requiredVerificationState: "ACCEPTANCE_CONFIRMED",
      requiredApplicantState: "ACCEPTED",
      minimumRole: "EXISTING_SEND_AUTHORITY",
      protectedAction: true,
      overridePermitted: true,
      overrideConditions: ["SUPER_ADMIN", "JUSTIFICATION_REQUIRED", "AUDIT_LOG_REQUIRED"]
    },
    application_final_reminder: {
      permittedLifecycleStages: ["INVITED_AWAITING_RESPONSE", "REMINDER_DUE", "DOCS_REQUIRED", "PAYMENT_REQUIRED", "RECEIPT_AWAITING_VERIFICATION"],
      requiredDocumentState: "ANY",
      requiredPaymentState: "ANY",
      requiredVerificationState: "NOT_ACCEPTED",
      requiredApplicantState: "ACTIVE",
      minimumRole: "EXISTING_SEND_AUTHORITY",
      protectedAction: false,
      overridePermitted: false,
      overrideConditions: []
    },
    prospect_general_guidance: {
      permittedLifecycleStages: ["ANY"],
      requiredDocumentState: "ANY",
      requiredPaymentState: "ANY",
      requiredVerificationState: "ANY",
      requiredApplicantState: "ACTIVE",
      minimumRole: "EXISTING_SEND_AUTHORITY",
      protectedAction: false,
      overridePermitted: false,
      overrideConditions: []
    },
    contact_fallback_manual: {
      permittedLifecycleStages: ["ANY"],
      requiredDocumentState: "ANY",
      requiredPaymentState: "ANY",
      requiredVerificationState: "ANY",
      requiredApplicantState: "ACTIVE",
      minimumRole: "EXISTING_MANUAL_FALLBACK_AUTHORITY",
      protectedAction: false,
      overridePermitted: false,
      overrideConditions: []
    }
  };
}

function getCommunicationAuthorityRule_(messageType) {
  var normalizedType = normalizeApplicantMessageType_(messageType || "");
  var matrix = getCommunicationAuthorityMatrix_();
  return normalizedType && matrix[normalizedType] ? matrix[normalizedType] : null;
}

function communicationPaymentEvidencePresent_(rowObj) {
  var row = rowObj || {};
  if (typeof adminRowPaymentEvidencePresent_ === "function") return adminRowPaymentEvidencePresent_(row);
  return hasUploadEvidence_(row.Fee_Receipt_File, "Fee_Receipt_File");
}

function communicationAcceptanceConfirmed_(rowObj) {
  var row = rowObj || {};
  var enrolled = clean_(row.Enrolled_Confirmed || row.Enrolment_Confirmed || "").toLowerCase();
  if (enrolled === "yes" || enrolled === "true" || enrolled === "confirmed") return true;
  var status = clean_([
    row.Acceptance_Status,
    row.Enrolment_Status,
    row.Overall_Status,
    row["Application Status"],
    row.Status
  ].filter(function (value) { return !!clean_(value || ""); }).join(" ")).toLowerCase();
  return /\b(accepted|approved|admitted|enrolled|enrolment confirmed|enrollment confirmed)\b/.test(status);
}

function communicationApplicantAuthorityState_(rowObj, baseState) {
  var row = rowObj || {};
  var status = clean_([
    row.Acceptance_Status,
    row.Enrolment_Status,
    row.Overall_Status,
    row["Application Status"],
    row.Status,
    row.Payment_Badge
  ].filter(function (value) { return !!clean_(value || ""); }).join(" ")).toLowerCase();
  if (/\b(rejected|fraudulent|declined)\b/.test(status)) return "REJECTED";
  if (/\b(dormant|inactive)\b/.test(status)) return "DORMANT";
  if (/\b(archived|closed)\b/.test(status)) return "ARCHIVED";
  if (communicationAcceptanceConfirmed_(row) || (baseState && baseState.paymentVerified === true && /\b(approved|accepted|enrolled)\b/.test(status))) return "ACCEPTED";
  return "ACTIVE";
}

function communicationAuthorityPrerequisiteLine_(label, ok, detail) {
  return {
    label: clean_(label || ""),
    ok: ok === true,
    detail: clean_(detail || "")
  };
}

function communicationAuthorityPrerequisiteText_(items) {
  var list = Array.isArray(items) ? items : [];
  return list.map(function (item) {
    return (item.ok ? "✓ " : "✗ ") + clean_(item.label || "") + (item.detail ? " - " + clean_(item.detail || "") : "");
  }).join("; ");
}

// COMPATIBILITY SHIM: shared batch policy used by both Stage Batch and selected/manual batch paths.
function batchPolicyConfiguredPerRunCap_() {
  var configured = Number(CONFIG && (CONFIG.MAX_PER_RUN_BATCH_SIZE || CONFIG.MAX_STAGE_BATCH_SIZE || CONFIG.DEFAULT_STAGE_BATCH_SIZE) || 30);
  return Math.max(1, Math.floor(configured || 30));
}

function batchPolicyConfiguredStageDefault_() {
  var configured = Number(CONFIG && CONFIG.DEFAULT_STAGE_BATCH_SIZE || batchPolicyConfiguredPerRunCap_());
  return Math.max(1, Math.floor(configured || batchPolicyConfiguredPerRunCap_()));
}

function batchPolicyConfiguredStageMax_() {
  var configured = Number(CONFIG && CONFIG.MAX_STAGE_BATCH_SIZE || batchPolicyConfiguredPerRunCap_());
  return Math.max(1, Math.floor(configured || batchPolicyConfiguredPerRunCap_()));
}

function batchPolicyClampStageLimit_(rawLimit) {
  var n = Math.floor(Number(rawLimit || 0));
  var safeDefault = Math.min(batchPolicyConfiguredStageDefault_(), batchPolicyConfiguredStageMax_());
  if (!(n > 0)) return safeDefault;
  return Math.max(1, Math.min(batchPolicyConfiguredStageMax_(), n));
}

function batchPolicyPreviewCacheTtlSeconds_() {
  return 600;
}

function batchPolicyPreviewCacheKey_(prefix, adminEmail) {
  return clean_(prefix || "BATCH_PREVIEW") + "::" + clean_(adminEmail || "unknown").toLowerCase();
}

function batchPolicyReadPreviewCache_(prefix, adminEmail) {
  try {
    var raw = CacheService.getUserCache().get(batchPolicyPreviewCacheKey_(prefix, adminEmail));
    return raw ? JSON.parse(raw) : null;
  } catch (_err) {
    return null;
  }
}

function batchPolicyWritePreviewCache_(prefix, adminEmail, value, ttlSeconds) {
  try {
    CacheService.getUserCache().put(
      batchPolicyPreviewCacheKey_(prefix, adminEmail),
      JSON.stringify(value || {}),
      Math.max(1, Math.floor(Number(ttlSeconds || batchPolicyPreviewCacheTtlSeconds_())))
    );
  } catch (_err) {}
}

function batchPolicyClearPreviewCache_(prefix, adminEmail) {
  try {
    CacheService.getUserCache().remove(batchPolicyPreviewCacheKey_(prefix, adminEmail));
  } catch (_err) {}
}

function batchPolicyNormalizeCandidateIds_(ids, limitOpt) {
  var out = [];
  var seen = {};
  var limit = Math.max(1, Math.floor(Number(limitOpt || batchPolicyConfiguredPerRunCap_())));
  (Array.isArray(ids) ? ids : []).forEach(function (value) {
    var id = clean_(value || "");
    if (!id || seen[id]) return;
    seen[id] = true;
    if (out.length < limit) out.push(id);
  });
  return out;
}

function batchPolicyCandidateHash_(candidateIds) {
  return batchPolicyNormalizeCandidateIds_(candidateIds, Number.MAX_SAFE_INTEGER).join("|");
}

function communicationCanonicalLifecycleContext_(rowObj, opts) {
  var options = opts && typeof opts === "object" ? opts : {};
  var supplied = options.canonicalLifecycle && typeof options.canonicalLifecycle === "object"
    ? options.canonicalLifecycle
    : null;
  var canonical = supplied || (typeof resolveCanonicalApplicantLifecycle_ === "function"
    ? resolveCanonicalApplicantLifecycle_(rowObj || {}, {})
    : null);
  return {
    available: !!(canonical && typeof canonical === "object"),
    baseState: clean_(canonical && (canonical.baseState || canonical.lifecycleStage) || "").toUpperCase(),
    lifecycleStage: clean_(canonical && canonical.lifecycleStage || "").toUpperCase(),
    overlays: Array.isArray(canonical && canonical.overlays)
      ? canonical.overlays.map(function (item) { return clean_(item || "").toUpperCase(); }).filter(function (item) { return !!item; })
      : [],
    recommendedMessageType: clean_(canonical && canonical.recommendedMessageType || "").toLowerCase(),
    reason: clean_(canonical && canonical.reason || "")
  };
}

function communicationCanonicalLifecycleAllows_(messageType, canonical) {
  var type = normalizeApplicantMessageType_(messageType || "");
  var ctx = canonical && typeof canonical === "object" ? canonical : {};
  if (type === "docs_missing") {
    return ctx.available === true
      && (ctx.baseState === "INCOMPLETE_DOCUMENTS" || ctx.baseState === "DOCUMENT_CORRECTION_REQUIRED")
      && ctx.recommendedMessageType === "docs_missing";
  }
  if (type === "payment_followup") {
    return ctx.available === true
      && ctx.baseState === "PAYMENT_PENDING"
      && ctx.recommendedMessageType === "payment_followup";
  }
  return false;
}

function evaluateCommunicationAuthority_(rowObj, messageType, baseState, opts) {
  var row = rowObj || {};
  var normalizedType = normalizeApplicantMessageType_(messageType || "");
  var options = opts && typeof opts === "object" ? opts : {};
  var actor = options.actor && typeof options.actor === "object" ? options.actor : communicationGetActorInfo_(options);
  var rule = getCommunicationAuthorityRule_(normalizedType);
  if (!rule) {
    return { ok: false, blockCode: "UNKNOWN_MESSAGE_TYPE", blockReason: communicationBlockReason_("UNKNOWN_MESSAGE_TYPE", normalizedType), missingPrerequisites: [] };
  }
  var state = baseState && typeof baseState === "object" ? baseState : deriveCommunicationState_(row, normalizedType, options).base;
  var lifecycleStage = normalizeLifecycleStageKey_(deriveApplicantLifecycleStage_(row));
  var canonicalLifecycle = communicationCanonicalLifecycleContext_(row, options);
  var canonicalLifecycleAllowed = communicationCanonicalLifecycleAllows_(normalizedType, canonicalLifecycle);
  var authoritySource = canonicalLifecycleAllowed ? "CANONICAL_LIFECYCLE" : "LEGACY_LIFECYCLE";
  var lifecycleDiagnostics = {
    authoritySource: authoritySource,
    legacyStage: lifecycleStage,
    canonicalBaseState: canonicalLifecycle.baseState,
    canonicalOverlays: canonicalLifecycle.overlays,
    canonicalRecommendedMessageType: canonicalLifecycle.recommendedMessageType,
    canonicalReason: canonicalLifecycle.reason
  };
  var applicantState = communicationApplicantAuthorityState_(row, state);
  var docsVerified = state.docsVerified === true;
  var docsMissing = state.docsMissing === true;
  var paymentVerified = state.paymentVerified === true;
  var paymentOutstanding = state.paymentOutstanding === true;
  var paymentEvidencePresent = communicationPaymentEvidencePresent_(row);
  var paymentEvidenceMissing = communicationPaymentEvidenceMissing_(row);
  var quoteEligible = communicationQuoteEligible_(row) === true;
  var acceptanceConfirmed = communicationAcceptanceConfirmed_(row);
  var checks = [];

  function add(label, ok, detail) {
    checks.push(communicationAuthorityPrerequisiteLine_(label, ok, detail));
  }

  var permittedStages = Array.isArray(rule.permittedLifecycleStages) ? rule.permittedLifecycleStages : [];
  var lifecycleStageAllowed = permittedStages.indexOf("ANY") >= 0 || permittedStages.indexOf(lifecycleStage) >= 0 || canonicalLifecycleAllowed === true;
  if (permittedStages.indexOf("ANY") < 0) {
    add(
      "Lifecycle stage: " + permittedStages.join(" / "),
      lifecycleStageAllowed,
      canonicalLifecycleAllowed
        ? "Current: " + lifecycleStage + "; canonical: " + canonicalLifecycle.baseState
        : "Current: " + lifecycleStage
    );
  }

  if (rule.requiredApplicantState === "ACTIVE") add("Applicant active", applicantState === "ACTIVE", "Current: " + applicantState);
  else if (rule.requiredApplicantState === "ACCEPTED") add("Applicant accepted/enrolled", applicantState === "ACCEPTED", "Current: " + applicantState);

  if (rule.requiredDocumentState === "VERIFIED") add("Documents Verified", docsVerified, docsVerified ? "" : "Current: not verified");
  else if (rule.requiredDocumentState === "NOT_VERIFIED") add("Documents not yet verified", docsVerified !== true, docsVerified ? "Current: verified" : "");
  else if (rule.requiredDocumentState === "MISSING_OR_UNVERIFIED") add("Documents missing or not verified", docsMissing === true || docsVerified !== true, docsVerified ? "Current: verified" : "");

  if (rule.requiredPaymentState === "OUTSTANDING") add("Payment Outstanding", paymentOutstanding === true, paymentOutstanding ? "" : "Current: resolved");
  else if (rule.requiredPaymentState === "EVIDENCE_MISSING") add("Payment Evidence Missing", paymentEvidenceMissing === true, paymentEvidenceMissing ? "" : "Current: evidence present or payment resolved");
  else if (rule.requiredPaymentState === "QUOTE_ELIGIBLE_NOT_VERIFIED") {
    add("Quote eligible", quoteEligible === true, quoteEligible ? "" : "Quote details are not ready");
    add("No verified payment", paymentVerified !== true, paymentVerified ? "Current: payment verified" : "");
  } else if (rule.requiredPaymentState === "VERIFIED") add("Payment Verified", paymentVerified === true, paymentVerified ? "" : "Current: not verified");

  if (rule.requiredVerificationState === "NOT_ACCEPTED") add("No acceptance/enrolment confirmation", acceptanceConfirmed !== true, acceptanceConfirmed ? "Current: accepted/enrolled" : "");
  else if (rule.requiredVerificationState === "ACCEPTANCE_CONFIRMED") add("Acceptance/enrolment confirmed", acceptanceConfirmed === true, acceptanceConfirmed ? "" : "No acceptance/enrolment authority found");

  if (normalizedType === "payment_followup") add("Payment evidence state", paymentOutstanding === true, paymentEvidencePresent ? "Evidence uploaded; awaiting verification" : "Payment evidence not verified");

  var missing = checks.filter(function (item) { return item.ok !== true; });
  if (!missing.length) {
    return {
      ok: true,
      blockCode: "",
      blockReason: "",
      authorityRule: rule,
      protectedCommunication: rule.protectedAction === true,
      overridePermitted: rule.overridePermitted === true,
      missingPrerequisites: [],
      prerequisiteChecks: checks,
      lifecycleStage: lifecycleStage,
      legacyLifecycleStage: lifecycleStage,
      canonicalLifecycleAuthority: lifecycleDiagnostics,
      applicantState: applicantState
    };
  }

  var overrideRequested = options.authorityOverride === true;
  var reason = clean_(options.authorityOverrideReason || "");
  if (overrideRequested) {
    if (rule.protectedAction !== true || rule.overridePermitted !== true || actor.isSuper !== true) {
      return {
        ok: false,
        blockCode: "COMM_OVERRIDE_DENIED",
        blockReason: communicationBlockReason_("COMM_OVERRIDE_DENIED", normalizedType),
        authorityRule: rule,
        protectedCommunication: rule.protectedAction === true,
        overridePermitted: rule.overridePermitted === true,
        missingPrerequisites: missing,
        prerequisiteChecks: checks,
        lifecycleStage: lifecycleStage,
        legacyLifecycleStage: lifecycleStage,
        canonicalLifecycleAuthority: lifecycleDiagnostics,
        applicantState: applicantState
      };
    }
    if (reason.length < 20) {
      return {
        ok: false,
        blockCode: "COMM_OVERRIDE_REASON_REQUIRED",
        blockReason: communicationBlockReason_("COMM_OVERRIDE_REASON_REQUIRED", normalizedType),
        authorityRule: rule,
        protectedCommunication: true,
        overridePermitted: true,
        missingPrerequisites: missing,
        prerequisiteChecks: checks,
        lifecycleStage: lifecycleStage,
        legacyLifecycleStage: lifecycleStage,
        canonicalLifecycleAuthority: lifecycleDiagnostics,
        applicantState: applicantState
      };
    }
    return {
      ok: true,
      blockCode: "",
      blockReason: "",
      authorityRule: rule,
      protectedCommunication: true,
      overridePermitted: true,
      overrideApplied: true,
      overrideReason: reason,
      missingPrerequisites: missing,
      prerequisiteChecks: checks,
      lifecycleStage: lifecycleStage,
      legacyLifecycleStage: lifecycleStage,
      canonicalLifecycleAuthority: lifecycleDiagnostics,
      applicantState: applicantState
    };
  }

  return {
    ok: false,
    blockCode: "COMM_AUTHORITY_BLOCKED",
    blockReason: "Blocked by communication authority matrix. Requires: " + communicationAuthorityPrerequisiteText_(checks),
    authorityRule: rule,
    protectedCommunication: rule.protectedAction === true,
    overridePermitted: rule.overridePermitted === true,
    missingPrerequisites: missing,
    prerequisiteChecks: checks,
    lifecycleStage: lifecycleStage,
    legacyLifecycleStage: lifecycleStage,
    canonicalLifecycleAuthority: lifecycleDiagnostics,
    applicantState: applicantState
  };
}

function logCommunicationAuthorityOverride_(context, evaluation, action) {
  var ctx = context || {};
  var evalResult = evaluation || {};
  campaignLog_("COMM_AUTHORITY_OVERRIDE", {
    timestamp: new Date().toISOString(),
    action: clean_(action || ctx.action || ""),
    operator: clean_(ctx.actorEmail || ""),
    role: clean_(ctx.actorRole || ""),
    applicant: clean_(ctx.applicantId || ""),
    template: clean_(ctx.messageType || ""),
    reason: clean_(evalResult.overrideReason || ""),
    missingPrerequisites: evalResult.missingPrerequisites || [],
    override: true,
    debugId: clean_(ctx.debugId || "")
  });
}

function communicationRequiresPortalUrl_(messageType) {
  return ["legacy_invite", "reminder", "fd_acknowledgement", "application_feedback", "docs_missing", "payment_followup"].indexOf(clean_(messageType || "")) >= 0;
}

function isValidEffectiveEmail_(email) {
  var v = String(email || "").trim();
  if (!v) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}

function communicationDocsMissing_(rowObj) {
  var row = rowObj || {};
  return computeDocVerificationStatus_(row) !== "Verified";
}

function communicationPaymentOutstanding_(rowObj) {
  var row = rowObj || {};
  return !isCanonicalPaymentVerified_(row);
}

function communicationFamilyForMessageType_(messageType) {
  var normalizedType = normalizeApplicantMessageType_(messageType || "");
  if (isPortalCommunicationMessageType_(normalizedType)) return "invite";
  if (normalizedType === "reminder") return "reminder";
  if (normalizedType === "fd_acknowledgement") return "fd_acknowledgement";
  if (normalizedType === "application_feedback") return "application_feedback";
  if (normalizedType === "custom_email") return "custom_email";
  if (normalizedType === "docs_missing") return "docs_followup";
  if (normalizedType === "payment_followup") return "payment_followup";
  return "";
}

function buildApplicantFullName_(rowObj) {
  var row = rowObj || {};
  var first = clean_(row.First_Name || row.FirstName || "");
  var last = clean_(row.Last_Name || row.LastName || "");
  var full = clean_([first, last].filter(function (part) { return !!part; }).join(" "));
  if (full) return full;
  return clean_(row.Student_Name || row.Full_Name || row.Applicant_Name || "");
}

function buildParentOrApplicantName_(rowObj) {
  var row = rowObj || {};
  var direct = clean_(
    row.Parent_or_Applicant_Name
    || row.Parent_Name
    || row.Parent_Full_Name
    || row.Guardian_Name
    || row.Guardian_Full_Name
    || row.Parent_Guardian_Name
    || ""
  );
  if (direct) return direct;
  var parentFirst = clean_(row.Parent_First_Name || row.Guardian_First_Name || "");
  var parentLast = clean_(row.Parent_Last_Name || row.Guardian_Last_Name || "");
  var parentFull = clean_([parentFirst, parentLast].filter(function (part) { return !!part; }).join(" "));
  if (parentFull) return parentFull;
  return buildApplicantFullName_(row) || "Parent/Guardian";
}

function actionRequiredPlaceholder_(label) {
  return "[ACTION REQUIRED: " + clean_(label || "confirm detail") + "]";
}

function firstNonEmptyRowValue_(rowObj, fields) {
  var row = rowObj || {};
  var names = Array.isArray(fields) ? fields : [];
  for (var i = 0; i < names.length; i++) {
    var value = clean_(row[names[i]] || "");
    if (value) return value;
  }
  return "";
}

function applicantGradeValue_(rowObj) {
  return firstNonEmptyRowValue_(rowObj, [
    "Accepted_Grade",
    "Approved_Grade",
    "Grade_Applying_For",
    "Grade",
    "Upgrade_Grade_Stream"
  ]);
}

function firstCsvRowValue_(rowObj, fields) {
  var row = rowObj || {};
  var names = Array.isArray(fields) ? fields : [];
  for (var i = 0; i < names.length; i++) {
    var csv = subjectsToCsv_(row[names[i]]);
    if (csv) return csv;
  }
  return "";
}

function applicantSubjectsValue_(rowObj) {
  return firstCsvRowValue_(rowObj, [
    "Subjects_Summary",
    "Subjects_Selected_Canonical",
    "Subjects_Selected",
    "Selected_Subjects",
    "Subjects"
  ]);
}

function applicantGradeOrPlaceholder_(rowObj) {
  return applicantGradeValue_(rowObj) || actionRequiredPlaceholder_("confirm grade");
}

function applicantSubjectsOrPlaceholder_(rowObj) {
  return applicantSubjectsValue_(rowObj) || actionRequiredPlaceholder_("confirm subjects");
}

function applicantGradeDisplayOrUnconfirmed_(rowObj) {
  return applicantGradeValue_(rowObj) || "not yet confirmed";
}

function applicantSubjectsDisplayOrUnconfirmed_(rowObj) {
  return applicantSubjectsValue_(rowObj) || "not yet confirmed";
}

function communicationRequiresSubjects_(messageType) {
  var type = normalizeApplicantMessageType_(messageType || "");
  return [
    "payment_followup",
    "application_receipt_request",
    "application_verified_quote",
    "application_acceptance_confirmation",
    "application_exam_fee_reminder"
  ].indexOf(type) >= 0;
}

function applicantDocumentStatusSummary_(rowObj) {
  var row = rowObj || {};
  var status = typeof computeDocVerificationStatus_ === "function" ? clean_(computeDocVerificationStatus_(row) || "") : "";
  if (status === "Verified" || clean_(row.Docs_Verified || "") === "Yes") return "Document status: verified by Admissions.";
  if (status === "Rejected") return "Document status: one or more documents need correction or resubmission.";
  return "Document status: review is still in progress or documents are still required.";
}

function applicantPaymentStatusSummary_(rowObj) {
  var row = rowObj || {};
  var preVerificationNote = communicationPreVerificationPaymentNote_(row);
  if (preVerificationNote) return preVerificationNote;
  if (typeof isCanonicalPaymentVerified_ === "function" && isCanonicalPaymentVerified_(row)) return "Payment status: payment evidence has been verified.";
  var receiptStatus = clean_(row.Receipt_Status || "");
  if (receiptStatus) return "Payment status: " + receiptStatus + ".";
  if (typeof hasUploadEvidence_ === "function" && hasUploadEvidence_(row.Fee_Receipt_File, "Fee_Receipt_File")) return "Payment status: receipt/evidence has been received and is awaiting verification.";
  return "Payment status: payment receipt/evidence has not yet been verified.";
}

function applicantComputedFeeQuoteText_(rowObj) {
  var row = rowObj || {};
  if (typeof computeFodeFeeQuote_ !== "function") return "";
  var quote = computeFodeFeeQuote_(row);
  if (!quote || !(Number(quote.subjectCount || 0) > 0)) return "";
  return [
    "Registration fee: " + formatKina_(quote.registrationK),
    "Subjects selected: " + String(quote.subjectCount || 0) + (quote.subjectsList ? " (" + quote.subjectsList + ")" : ""),
    "Subject fee: " + formatKina_(quote.subjectFeeK) + " (" + formatKina_(CONFIG.FEE_PER_SUBJECT_KINA || 450) + " x " + String(quote.subjectCount || 0) + ")",
    "Estimated total payable: " + formatKina_(quote.totalK)
  ].join("\n");
}

function applicantOutstandingActionOrPlaceholder_(rowObj) {
  var row = rowObj || {};
  if (communicationDocsMissing_(row)) return "Please upload or resend the missing required document(s).";
  if (communicationPaymentOutstanding_(row)) {
    if (typeof hasUploadEvidence_ === "function" && hasUploadEvidence_(row.Fee_Receipt_File, "Fee_Receipt_File")) return "Please wait for Admissions to verify the payment receipt, or contact us if the receipt details need correction.";
    return "Please complete the required payment and upload or send the payment receipt/evidence.";
  }
  return actionRequiredPlaceholder_("state outstanding action");
}

function formatKinaCurrency_(n) {
  var num = Number(n || 0);
  if (!isFinite(num)) num = 0;
  return "K" + num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function canonicalFodePaymentInformationBlock_(context) {
  var ctx = context || {};
  var row = ctx.rowObj || ctx.row || {};
  var applicantId = clean_(ctx.applicantId || row.ApplicantID || row[CONFIG.APPLICANT_ID_HEADER] || "");
  var quote = typeof computeFodeFeeQuote_ === "function" ? computeFodeFeeQuote_(row) : null;
  var subjectCount = quote ? Number(quote.subjectCount || 0) : 0;
  if (!applicantId) return actionRequiredPlaceholder_("confirm applicant ID for payment reference");
  if (!quote || !(subjectCount > 0)) return "Payment/quote details require authoritative subject confirmation before rendering.";
  var registration = Number(quote.registrationK || 600);
  var perSubject = Number(CONFIG.FEE_PER_SUBJECT_KINA || 450);
  var subjectFee = Number(quote.subjectFeeK || (subjectCount * perSubject));
  var total = Number(quote.totalK || (registration + subjectFee));
  var subjectsLine = quote.subjectsList ? " (" + quote.subjectsList + ")" : "";
  return [
    "FODE KIA fee breakdown:",
    "Registration Fee: " + formatKinaCurrency_(registration),
    "Subject Fee: " + String(subjectCount) + " x " + formatKinaCurrency_(perSubject) + " = " + formatKinaCurrency_(subjectFee) + subjectsLine,
    "Total Amount Payable: " + formatKinaCurrency_(total),
    "",
    "National FODE examination fees are paid separately to DoE FODE and are not included in this amount.",
    "",
    "Payment options:",
    "Option 1 - TISA Bank Ltd (Preferred)",
    "Bank: TISA Bank Ltd",
    "Branch: Islander Drive (Branch 001), Port Moresby",
    "Business Name: KUNDU INTERNATIONAL ACADEMY LIMITED",
    "CASA Account No.: 0010250069",
    "",
    "Option 2 - BSP Bank",
    "Bank: BSP Bank",
    "Branch: BSP Haus, Konedobu, Port Moresby",
    "Account Name: Kundu International Academy",
    "Account No.: 7027138796",
    "BSB No.: 088950",
    "",
    "Payment reference: Please include Applicant ID " + applicantId + " as the payment reference.",
    "After payment, upload the receipt through the applicant portal or send it to Admissions for verification."
  ].join("\n");
}

function communicationEmailHeadingBlock_() {
  return [
    "Kundu International Academy / FODE Admissions",
    "FODE KIA Application Communication"
  ].join("\n");
}

function communicationApplicantSummaryBlock_(context, opts) {
  var ctx = context || {};
  var row = ctx.rowObj || {};
  var options = opts && typeof opts === "object" ? opts : {};
  var applicantName = buildApplicantFullName_(row) || "the applicant";
  var grade = applicantGradeValue_(row);
  var subjects = applicantSubjectsValue_(row);
  var lines = [
    "Applicant summary:",
    "Applicant ID: " + String(ctx.applicantId || row.ApplicantID || ""),
    "Student: " + applicantName
  ];
  if (grade) lines.push("Grade: " + grade);
  else if (options.includeUnavailableOptionalFields === true) lines.push("Grade: not yet confirmed");
  else if (options.useActionPlaceholders === true && options.requireGrade === true) lines.push("Grade: " + applicantGradeOrPlaceholder_(row));
  if (subjects) lines.push("Subjects: " + subjects);
  else if (options.includeUnavailableOptionalFields === true) lines.push("Subjects: not yet confirmed");
  if (options.includeStatus !== false) {
    lines.push("");
    lines.push(applicantDocumentStatusSummary_(row));
    lines.push(applicantPaymentStatusSummary_(row));
  }
  return lines.join("\n");
}

function communicationPortalInstructionBlock_(context, purposeText) {
  var ctx = context || {};
  var url = clean_(ctx.portalUrl || "");
  var intro = clean_(purposeText || "Use the secure applicant portal to review the application or upload requested evidence.");
  if (!url) {
    return [
      intro,
      "{{portal_url}}"
    ].join("\n");
  }
  return [
    intro,
    url
  ].join("\n");
}

function communicationOfficeContactBlock_() {
  return "If you need assistance, please contact the Admissions Office.";
}

function communicationSignatureBlock_() {
  return [
    "Regards,",
    "",
    "FODE KIA Admissions Team",
    communicationOfficeContactBlock_()
  ].join("\n");
}

function composeSelectedApplicantEmail_(context, sections) {
  var ctx = context || {};
  var row = ctx.rowObj || {};
  var parts = [
    communicationEmailHeadingBlock_(),
    "",
    "Dear " + buildParentOrApplicantName_(row) + ",",
    ""
  ];
  (Array.isArray(sections) ? sections : []).forEach(function (section) {
    var text = clean_(section || "");
    if (!text) return;
    parts.push(text);
    parts.push("");
  });
  parts.push(communicationSignatureBlock_());
  return parts.join("\n");
}

function customEmailOperatorPrompt_() {
  return "[Write your message here before sending.]";
}

function hasUnresolvedCustomEmailPrompt_(body) {
  return String(body || "").indexOf(customEmailOperatorPrompt_()) >= 0;
}
function applicantPaymentQuoteOrPlaceholder_(rowObj) {
  var amount = firstNonEmptyRowValue_(rowObj, [
    "Fee_Total_Kina",
    "Total_Fee_Kina",
    "Total_Fee",
    "Quote_Amount",
    "Payment_Amount"
  ]);
  var invoiceNumber = firstNonEmptyRowValue_(rowObj, [
    "Books_Invoice_Number",
    "Invoice_Number"
  ]);
  if (amount && invoiceNumber) return "Amount/quote: " + amount + " (Invoice " + invoiceNumber + ")";
  if (amount) return "Amount/quote: " + amount;
  var computed = applicantComputedFeeQuoteText_(rowObj);
  if (computed && invoiceNumber) return computed + "\nQuote/invoice reference: " + invoiceNumber;
  if (computed) return computed;
  if (invoiceNumber) return "Quote/invoice reference: " + invoiceNumber + " - " + actionRequiredPlaceholder_("insert payment/quote amount");
  return actionRequiredPlaceholder_("insert payment/quote amount");
}

function paymentInstructionsOrPlaceholder_(rowObj) {
  return firstNonEmptyRowValue_(rowObj, [
    "Payment_Instructions",
    "Payment_Instruction",
    "Quote_Payment_Instructions"
  ]) || clean_(CONFIG.PAYMENT_INSTRUCTIONS_TEXT || "") || actionRequiredPlaceholder_("confirm payment instructions");
}

function hasUnresolvedActionRequiredPlaceholder_(subject, body) {
  return /\[ACTION REQUIRED:\s*[^\]]+\]/i.test(String(subject || "") + "\n" + String(body || ""));
}

function communicationUnresolvedTokens_(subject, body) {
  var text = String(subject || "") + "\n" + String(body || "");
  var out = [];
  var seen = {};
  function add(token) {
    var value = clean_(token || "");
    if (!value || seen[value]) return;
    seen[value] = true;
    out.push(value);
  }
  var actionMatches = text.match(/\[ACTION REQUIRED:[^\]]+\]/gi) || [];
  actionMatches.forEach(add);
  if (text.indexOf(customEmailOperatorPrompt_()) >= 0) add(customEmailOperatorPrompt_());
  var mergeMatches = text.match(/\{\{[^}]+\}\}/g) || [];
  mergeMatches.forEach(add);
  return out;
}

function communicationValidateRenderedContent_(subject, body) {
  var unresolved = communicationUnresolvedTokens_(subject, body);
  if (!unresolved.length) return { ok: true, unresolvedTokens: [] };
  return {
    ok: false,
    code: "COMMUNICATION_TEMPLATE_UNRESOLVED_TOKEN",
    blockCode: "COMMUNICATION_TEMPLATE_UNRESOLVED_TOKEN",
    blockReason: "Resolve unresolved communication token: " + unresolved[0],
    unresolvedToken: unresolved[0],
    unresolvedTokens: unresolved
  };
}

function communicationValidateTemplateTokens_(subject, body, allowedFields) {
  var allowed = {};
  (Array.isArray(allowedFields) ? allowedFields : []).forEach(function (field) {
    var key = clean_(field || "").toLowerCase();
    if (key) allowed[key] = true;
  });
  var text = String(subject || "") + "\n" + String(body || "");
  var mergeMatches = text.match(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g) || [];
  for (var i = 0; i < mergeMatches.length; i++) {
    var token = clean_(mergeMatches[i].replace(/[{}\s]/g, "")).toLowerCase();
    if (allowed[token] !== true) {
      return {
        ok: false,
        code: "COMMUNICATION_TEMPLATE_UNRESOLVED_TOKEN",
        blockCode: "COMMUNICATION_TEMPLATE_UNRESOLVED_TOKEN",
        blockReason: "Unknown merge field in saved template: {{" + token + "}}",
        unresolvedToken: "{{" + token + "}}"
      };
    }
  }
  if (/\[ACTION REQUIRED:/i.test(text) || /\[Write your message here/i.test(text)) {
    return {
      ok: false,
      code: "COMMUNICATION_TEMPLATE_UNRESOLVED_TOKEN",
      blockCode: "COMMUNICATION_TEMPLATE_UNRESOLVED_TOKEN",
      blockReason: "Saved templates cannot contain unresolved operator placeholders.",
      unresolvedToken: /\[Write your message here/i.test(text) ? "[Write your message here" : "[ACTION REQUIRED:"
    };
  }
  return { ok: true };
}

function communicationUnderReviewNoPaymentNotice_() {
  return "Your application is currently under review. No payment is required at this stage. We will contact you when payment becomes applicable.";
}

function communicationDocumentVerificationCaution_() {
  return "Your application cannot be processed further until we receive clear, complete and verifiable copies of the required original documents. Uploaded copies must be legible and accurately reproduce the original documents. We may request the originals for verification.";
}

function communicationRenderTemplateText_(template, context) {
  var ctx = context || {};
  var row = ctx.rowObj || {};
  var values = {
    portal_url: clean_(ctx.portalUrl || ""),
    applicant_name: clean_(row.Name || row.Applicant_Name || row.Full_Name || ctx.applicantName || ""),
    applicant_id: clean_(ctx.applicantId || row.ApplicantID || ""),
    grade: clean_(row.Grade || row.Applied_Grade || row.Grade_Level || ""),
    subjects: clean_(row.Subjects || row.Selected_Subjects || row.Subject_List || "")
  };
  return String(template || "").replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, function (match, token) {
    var key = clean_(token || "").toLowerCase();
    return Object.prototype.hasOwnProperty.call(values, key) ? values[key] : match;
  });
}

function communicationShouldApplyUnderReviewNoPaymentNotice_(context) {
  var ctx = context || {};
  var type = normalizeApplicantMessageType_(ctx.messageType || "");
  if (["payment_followup", "application_receipt_request", "application_verified_quote", "application_acceptance_confirmation"].indexOf(type) >= 0) return false;
  if (ctx.paymentVerified === true) return false;
  var row = ctx.rowObj || {};
  if (communicationDocsVerifiedForPayment_(row, { docsVerified: ctx.docsVerified === true }) === true) return false;
  return true;
}

function communicationShouldApplyDocumentVerificationCaution_(context) {
  var ctx = context || {};
  var type = normalizeApplicantMessageType_(ctx.messageType || "");
  if (type === "application_acceptance_confirmation") return false;
  if (ctx.docsVerified === true) return false;
  return communicationDocsMissing_(ctx.rowObj || {}) === true;
}

function communicationApplyMandatoryPolicyBlocks_(context, body) {
  var text = String(body || "");
  var blocks = [];
  var portalUrl = clean_(context && context.portalUrl || "");
  if (context && context.requiresPortalUrl === true && portalUrl) {
    text = text.replace(/\{\{\s*portal_url\s*\}\}/gi, portalUrl);
    if (text.indexOf(portalUrl) < 0) blocks.push(communicationPortalInstructionBlock_(context));
  }
  if (communicationShouldApplyUnderReviewNoPaymentNotice_(context) && text.indexOf(communicationUnderReviewNoPaymentNotice_()) < 0) {
    blocks.push(communicationUnderReviewNoPaymentNotice_());
  }
  if (communicationShouldApplyDocumentVerificationCaution_(context) && text.indexOf(communicationDocumentVerificationCaution_()) < 0) {
    blocks.push(communicationDocumentVerificationCaution_());
  }
  return blocks.length ? [text, ""].concat(blocks).join("\n\n") : text;
}

function communicationRenderFinalBody_(context, body) {
  var text = communicationApplyMandatoryPolicyBlocks_(context, String(body || ""));
  return communicationRenderTemplateText_(text, context || {});
}

function communicationPreviewDiagnostics_(context, details) {
  var ctx = context && typeof context === "object" ? context : {};
  var info = details && typeof details === "object" ? details : {};
  return {
    blockCode: clean_(info.blockCode || ctx.blockCode || ""),
    blockReason: clean_(info.blockReason || ctx.blockReason || ""),
    templateId: clean_(ctx.templateId || ctx.messageType || ""),
    templateVersionId: clean_(ctx.templateVersionId || "1"),
    portalLinkRequired: ctx.requiresPortalUrl === true,
    portalLinkHydrated: ctx.requiresPortalUrl === true && !!clean_(ctx.portalUrl || ""),
    unresolvedToken: clean_(info.unresolvedToken || ctx.unresolvedToken || "")
  };
}

function communicationParseEmailList_(value) {
  return String(value || "").split(/[;,]/).map(function (item) { return clean_(item || ""); }).filter(function (item) { return !!item; });
}

function communicationInternalEmailAllowed_(email) {
  var address = clean_(email || "").toLowerCase();
  var configured = []
    .concat(CONFIG.SUPER_ADMIN_EMAILS || [])
    .concat(CONFIG.ADMIN_EMAILS || []);
  for (var i = 0; i < configured.length; i++) {
    var item = clean_(configured[i] || "").toLowerCase();
    if (address && item && address === item) return true;
    var domain = item.indexOf("@") >= 0 ? item.split("@").pop() : "";
    if (domain && address.slice(-domain.length - 1) === "@" + domain) return true;
  }
  return false;
}

function communicationValidateCcBcc_(cc, bcc) {
  var ccList = communicationParseEmailList_(cc);
  var bccList = communicationParseEmailList_(bcc);
  if (ccList.length > 10 || bccList.length > 10) return { ok: false, code: "COMMUNICATION_CC_BCC_TOO_MANY", blockReason: "CC/BCC is limited to 10 addresses each." };
  for (var i = 0; i < ccList.length; i++) {
    if (isValidEffectiveEmail_(ccList[i]) !== true) return { ok: false, code: "INVALID_CC_ADDRESS", blockReason: "Invalid CC address: " + ccList[i] };
  }
  for (var j = 0; j < bccList.length; j++) {
    if (isValidEffectiveEmail_(bccList[j]) !== true) return { ok: false, code: "INVALID_BCC_ADDRESS", blockReason: "Invalid BCC address: " + bccList[j] };
    if (communicationInternalEmailAllowed_(bccList[j]) !== true) return { ok: false, code: "BCC_NOT_INTERNAL", blockReason: "BCC is restricted to approved internal addresses or domains." };
  }
  return { ok: true, cc: ccList.join(","), bcc: bccList.join(",") };
}

function communicationRequiresResolvedActionPlaceholders_(messageType) {
  var type = normalizeApplicantMessageType_(messageType || "");
  return [
    "docs_missing",
    "payment_followup",
    "application_feedback",
    "application_receipt_request",
    "application_verified_quote",
    "application_acceptance_confirmation",
    "application_exam_fee_reminder",
    "application_final_reminder"
  ].indexOf(type) >= 0;
}

function feedbackStatusNeedsAttention_(status) {
  var normalized = clean_(status || "").toLowerCase();
  return normalized === "rejected" || normalized === "fraudulent";
}

function isPaymentReceiptDocumentField_(doc) {
  var d = doc || {};
  return clean_(d.file || "") === "Fee_Receipt_File" || clean_(d.status || "") === "Receipt_Status";
}

function communicationDocsVerifiedForPayment_(rowObj, baseState) {
  var row = rowObj || {};
  if (baseState && baseState.docsVerified === true) return true;
  return computeDocVerificationStatus_(row) === "Verified" || clean_(row.Docs_Verified || "") === "Yes";
}

function communicationPaymentEvidenceMissing_(rowObj) {
  var row = rowObj || {};
  return !isCanonicalPaymentVerified_(row) && !communicationPaymentEvidencePresent_(row);
}

function communicationQuoteEligible_(rowObj) {
  var row = rowObj || {};
  if (typeof computeFodeFeeQuote_ !== "function") return false;
  var quote = computeFodeFeeQuote_(row);
  return !!(quote && Number(quote.subjectCount || 0) > 0);
}

function communicationPreVerificationPaymentNote_(rowObj) {
  if (communicationDocsVerifiedForPayment_(rowObj || {}) === true) return "";
  return "Payment note: Payment is not required at this stage. Please do not make payment until your documents have been verified and FODE KIA sends you an official payment or quote email.";
}

function buildDocumentAttentionLines_(rowObj, opts) {
  var row = rowObj || {};
  var options = opts && typeof opts === "object" ? opts : {};
  var docs = Array.isArray(CONFIG.DOC_FIELDS) ? CONFIG.DOC_FIELDS : [];
  var docsVerified = communicationDocsVerifiedForPayment_(row);
  var lines = [];
  docs.forEach(function (doc) {
    if (!doc || !doc.file || !doc.status || !doc.comment) return;
    if (options.excludePaymentReceiptBeforeDocsVerified === true && !docsVerified && isPaymentReceiptDocumentField_(doc)) return;
    var label = clean_(doc.label || doc.file || "");
    if (!label) return;
    var rawFile = row[doc.file];
    var hasFile = hasUploadEvidence_(rawFile, doc.file);
    var status = clean_(row[doc.status] || "");
    var comment = clean_(row[doc.comment] || "");
    var lineText = "";
    if (!hasFile) {
      lineText = clean_(options.missingFileText || "Cannot verify; no file uploaded.");
    } else if (feedbackStatusNeedsAttention_(status)) {
      if (comment && options.includeCommentsForAttention === true) lineText = comment;
      else lineText = clean_(options.attentionStatusText || ("Status marked " + status + "."));
    } else if (comment && options.includeComments === true) {
      lineText = comment;
    }
    if (!lineText) return;
    lines.push("- " + label + ": " + lineText);
  });
  if (!lines.length) {
    var fallback = clean_(options.emptyFallback || "");
    if (fallback) lines.push("- " + fallback);
  }
  return lines;
}

function buildApplicationFeedbackIssues_(rowObj) {
  return buildDocumentAttentionLines_(rowObj, {
    missingFileText: "Cannot verify; no file uploaded.",
    attentionStatusText: "",
    includeComments: true,
    includeCommentsForAttention: true,
    excludePaymentReceiptBeforeDocsVerified: true,
    emptyFallback: "Please review the application details and upload any missing or corrected documents requested by the office."
  }).join("\n");
}

function buildFdAcknowledgementDocumentLines_(rowObj) {
  return buildDocumentAttentionLines_(rowObj, {
    missingFileText: "not yet uploaded in the current application record.",
    attentionStatusText: "uploaded, but a replacement document is still required in the current application record.",
    includeComments: false,
    includeCommentsForAttention: false,
    excludePaymentReceiptBeforeDocsVerified: true,
    emptyFallback: ""
  });
}

function buildApplicationFeedbackEmailBody_(context) {
  var ctx = context || {};
  var row = ctx.rowObj || {};
  var parentOrApplicantName = buildParentOrApplicantName_(row);
  var applicantName = buildApplicantFullName_(row) || "the applicant";
  var feedbackList = buildApplicationFeedbackIssues_(row);
  var paymentNote = communicationPreVerificationPaymentNote_(row);
  return [
    "Dear " + parentOrApplicantName + ",",
    "",
    "Thank you for submitting your FODE KIA Online Application.",
    "",
    "We have reviewed the information and documents submitted for " + applicantName + " (Applicant ID: " + String(ctx.applicantId || "") + "). Some items require correction or resubmission before we can continue processing the application.",
    "",
    "Please review the notes below:",
    "",
    feedbackList,
    "",
    paymentNote,
    "",
    "To correct or upload the required documents, please log in to the student portal using the link below:",
    "",
    String(ctx.portalUrl || ""),
    "",
    "After updating the documents, please submit the portal again or notify our office so we can continue the review.",
    "",
    "If you need assistance, please contact us using the contact details provided in your application communication.",
    "",
    "Regards,",
    "",
    "FODE KIA Admissions Team"
  ].join("\n");
}

function buildFdAcknowledgementEmailBody_(context) {
  var ctx = context || {};
  var row = ctx.rowObj || {};
  var parentOrApplicantName = buildParentOrApplicantName_(row);
  var applicantName = buildApplicantFullName_(row) || "the applicant";
  var portalUrl = clean_(ctx.portalUrl || "");
  var docLines = buildFdAcknowledgementDocumentLines_(row);
  var paymentNote = communicationPreVerificationPaymentNote_(row);
  var docsSection = docLines.length ? [
    "Documents still required:",
    "",
    docLines.join("\n")
  ].join("\n") : [
    "Documents still required:",
    "",
    "All required documents appear to have been submitted. Please visit the Student Portal to review your application status."
  ].join("\n");
  return [
    "Dear " + parentOrApplicantName + ",",
    "",
    "Thank you for submitting your Kundu FODE application for " + applicantName + " (Applicant ID: " + String(ctx.applicantId || "") + "). We confirm that the application has been received.",
    "",
    "Admissions will review the application and the uploaded documents recorded for this applicant.",
    "",
    docsSection,
    "",
    paymentNote,
    "",
    "Please visit the Student Portal using the link below to review your application details and upload any remaining required documents:",
    "",
    "Open Student Portal:",
    portalUrl,
    "",
    "If the link does not open, copy and paste this full URL into Chrome:",
    portalUrl,
    "",
    "If you need assistance, please contact FODE Admissions using the contact details provided in your application communication.",
    "",
    "Regards,",
    "",
    "FODE KIA Admissions Team"
  ].join("\n");
}

function deriveCommunicationState_(rowObj, messageType, opts) {
  var row = rowObj || {};
  var options = opts && typeof opts === "object" ? opts : {};
  var normalizedType = normalizeApplicantMessageType_(messageType || "");
  var applicantId = clean_(row.ApplicantID || options.applicantId || "");
  var effectiveEmail = getCampaignEffectiveEmail_(row);
  var emailStatus = normalizeEmailStatus_(row.Email_Status || "");
  var lastContactType = normalizeApplicantMessageType_(row.Last_Contact_Type || "");
  var lastContactResult = clean_(row.Last_Contact_Result || "").toUpperCase();
  var lastContactBatch = clean_(row.Last_Contact_Batch || "");
  var lastContactedAt = clean_(row.Last_Contacted_At || "");
  var cooldownLookup = options.cooldownLookup && typeof options.cooldownLookup === "object" ? options.cooldownLookup : null;
  var cooldownLastSentAt = "";
  if (normalizedType) {
    if (cooldownLookup && cooldownLookup.byApplicantId) {
      cooldownLastSentAt = clean_(cooldownLookup.byApplicantId[applicantId] || "");
    } else {
      cooldownLastSentAt = getLastCommunicationSentAt_(applicantId, normalizedType);
    }
  }
  var cooldownExpiresAtMs = cooldownLastSentAt ? parseTime_(cooldownLastSentAt) + communicationCooldownMs_() : 0;
  var nowMs = Number(options.nowMs || new Date().getTime());
  var baseState = {
    applicantId: applicantId,
    effectiveEmail: clean_(effectiveEmail || ""),
    hasEffectiveEmail: !!clean_(effectiveEmail || ""),
    hasValidEffectiveEmail: isValidEffectiveEmail_(effectiveEmail),
    emailStatus: emailStatus,
    portalSubmittedActive: isCampaignPortalSubmittedActive_(row),
    bounceFlag: isCampaignBounceFlagTrue_(row.Email_Bounce_Flag),
    bounceReason: clean_(row.Email_Bounce_Reason || ""),
    docsVerified: computeDocVerificationStatus_(row) === "Verified" || clean_(row.Docs_Verified || "") === "Yes",
    paymentVerified: isCanonicalPaymentVerified_(row),
    docsMissing: communicationDocsMissing_(row),
    paymentOutstanding: communicationPaymentOutstanding_(row),
    requiresPortalUrl: communicationRequiresPortalUrl_(normalizedType),
    attemptCount: campaignAttemptCount_(row),
    nextActionAtMs: parseTime_(row.Email_Next_Action_Date || ""),
    emailLastSentAt: clean_(row.Email_Last_Sent_At || ""),
    lastContactType: lastContactType,
    lastContactResult: lastContactResult,
    lastContactBatch: lastContactBatch,
    lastContactedAt: lastContactedAt
  };
  return {
    applicantId: applicantId,
    messageType: normalizedType,
    communicationFamily: communicationFamilyForMessageType_(normalizedType),
    cooldownLastSentAt: cooldownLastSentAt,
    cooldownActive: !!(cooldownExpiresAtMs && cooldownExpiresAtMs > nowMs),
    cooldownExpiresAtMs: cooldownExpiresAtMs,
    lastContactMatchesScopedType: !!(normalizedType && baseState.lastContactType === normalizedType),
    lastContactWasSent: baseState.lastContactResult === "SENT",
    lastContactWasFailed: baseState.lastContactResult === "FAILED",
    durablePriorSuccess: !!(normalizedType && baseState.emailStatus === "SENT" && baseState.lastContactType === normalizedType && (!!baseState.lastContactedAt || baseState.lastContactResult === "SENT")),
    durablePriorFailureSameType: !!(normalizedType && baseState.lastContactType === normalizedType && baseState.lastContactResult === "FAILED"),
    base: baseState
  };
}

function communicationMessageTypeForFilter_(filterType) {
  var normalized = normalizeApplicantBatchFilterType_(filterType);
  if (normalized === "legacy_invite_eligible") return portalCommunicationMessageType_();
  if (normalized === "docs_missing") return "docs_missing";
  if (normalized === "payment_pending") return "payment_followup";
  return "";
}

function communicationMatchesFilterPrecheck_(rowObj, filterType) {
  var row = rowObj || {};
  var state = deriveCommunicationState_(row, communicationMessageTypeForFilter_(filterType), {});
  var applicantId = clean_(state.applicantId || "");
  if (!applicantId) return false;
  var normalized = normalizeApplicantBatchFilterType_(filterType);
  if (isHistoricalLegacyInviteBatchFilter_(normalized)) {
    var status = clean_(state.base && state.base.emailStatus || "");
    return !status || status === "NEW" || status === "READY";
  }
  if (normalized === "docs_missing") return state.base && state.base.docsMissing === true;
  if (normalized === "payment_pending") return state.base && state.base.docsVerified === true && state.base.paymentOutstanding === true;
  return false;
}

function buildReminderEmailBody_(context) {
  var ctx = context || {};
  var row = ctx.rowObj || {};
  var applicantName = buildApplicantFullName_(row) || "the applicant";
  return [
    "Dear Parent/Guardian,",
    "",
    "This is a reminder that the FODE KIA application for " + applicantName + " is still awaiting your next step.",
    "",
    "Applicant ID: " + String(ctx.applicantId || ""),
    "Grade: " + applicantGradeDisplayOrUnconfirmed_(row),
    "Subjects: " + applicantSubjectsDisplayOrUnconfirmed_(row),
    "",
    applicantDocumentStatusSummary_(row),
    applicantPaymentStatusSummary_(row),
    "",
    "Please review and complete the application using the secure portal link below:",
    "",
    String(ctx.portalUrl || ""),
    "",
    "If you need assistance, contact FODE Admissions at fode@kundu.ac or WhatsApp +675 7860 4013.",
    "",
    "FODE KIA Admissions Team"
  ].join("\n");
}

function buildDocsMissingEmailBody_(context) {
  var ctx = context || {};
  var row = ctx.rowObj || {};
  var applicantName = buildApplicantFullName_(row) || "the applicant";
  var missingLines = buildDocumentAttentionLines_(row, {
    missingFileText: "not received or not available in the current application record.",
    attentionStatusText: "requires correction or resubmission.",
    includeComments: true,
    includeCommentsForAttention: true,
    excludePaymentReceiptBeforeDocsVerified: true,
    emptyFallback: "The office has identified at least one required document that still needs review or resubmission."
  }).join("\n");
  return composeSelectedApplicantEmail_(ctx, [
    "We are continuing the review of the FODE KIA application for " + applicantName + ". One or more required documents are not available, incomplete, or need resubmission before review can continue.",
    communicationApplicantSummaryBlock_(ctx, { includeStatus: true }),
    "Documents needing attention:",
    missingLines,
    "Next steps:",
    [
      "1. Open the secure applicant portal.",
      "2. Upload or resend the missing or corrected document(s).",
      "3. Contact FODE Admissions if you are unsure which document is required."
    ].join("\n"),
    communicationPortalInstructionBlock_(ctx, "Secure portal link for document upload or review:"),
    "This is not a final application decision. Admissions needs the required document evidence before the application can be fully reviewed."
  ]);
}

function buildPaymentFollowupEmailBody_(context) {
  var ctx = context || {};
  var row = ctx.rowObj || {};
  var applicantName = buildApplicantFullName_(row) || "the applicant";
  return composeSelectedApplicantEmail_(ctx, [
    "We are contacting you about the FODE KIA application for " + applicantName + ". Admissions still needs payment evidence or payment verification before the payment step can be completed.",
    communicationApplicantSummaryBlock_(ctx, { useActionPlaceholders: true, requireGrade: true, requireSubjects: true }),
    "Payment / quote and payment instructions:",
    canonicalFodePaymentInformationBlock_(ctx),
    "Next steps:",
    [
      "1. Review the grade, subjects, and payment details above.",
      "2. Complete the required payment if it has not already been made.",
      "3. Upload or send a clear payment receipt/evidence to Admissions.",
      "4. Contact Admissions immediately if any grade, subject, or payment detail is incorrect."
    ].join("\n"),
    communicationPortalInstructionBlock_(ctx, "Portal link for payment receipt upload or application review:"),
    "This message does not confirm acceptance or enrolment. Enrolment/payment processing continues only after payment evidence is received and verified."
  ]);
}

function buildCustomSelectedEmailSubject_() {
  return "FODE KIA Application - Information and Assistance";
}

function buildCustomSelectedEmailBody_(context) {
  var ctx = context || {};
  var row = ctx.rowObj || {};
  var recipientName = buildParentOrApplicantName_(row);
  return composeSelectedApplicantEmail_(ctx, [
    "We are contacting you about the FODE KIA application listed below.",
    communicationApplicantSummaryBlock_(ctx, { includeStatus: true }),
    "Message:",
    customEmailOperatorPrompt_(),
    "This message is for general FODE KIA admissions or program assistance. It does not confirm payment, acceptance, enrolment, or classroom placement unless those details are separately confirmed by Admissions."
  ]).replace("Dear " + buildParentOrApplicantName_(row) + ",", "Dear " + recipientName + ",");
}

function buildProspectGeneralGuidanceSubject_() {
  return "FODE KIA Information and How to Apply";
}

function buildProspectGeneralGuidanceBody_(context) {
  var ctx = context || {};
  var informationUrl = clean_(ctx.informationUrl || "");
  var applicationUrl = clean_(ctx.applicationUrl || "");
  var faqUrl = clean_(ctx.faqUrl || "");
  return [
    "Hello,",
    "",
    "Thank you for your interest in FODE through Kundu International Academy.",
    "",
    "Please review the official FODE information and entry guidance" + (informationUrl ? " here: " + informationUrl : " provided by our admissions team") + ".",
    "",
    "When you are ready to apply, complete the online application form carefully" + (applicationUrl ? " here: " + applicationUrl : "") + " and upload the required identification, school records, and other requested documents.",
    "",
    "For common questions about subjects, fees, documents, and national examinations, please use the FAQ guidance" + (faqUrl ? ": " + faqUrl : " supplied by FODE Admissions") + ".",
    "",
    "For further assistance, contact FODE Admissions at fode@kundu.ac or WhatsApp +675 7860 4013.",
    "",
    "If you have already completed these steps, please ignore this message.",
    "",
    "FODE KIA Admissions Team"
  ].join("\n");
}

function buildApplicationReceiptRequestSubject_() {
  return "FODE KIA Application - Payment Receipt Required";
}

function buildApplicationReceiptRequestBody_(context) {
  var ctx = context || {};
  var row = ctx.rowObj || {};
  var applicantName = buildApplicantFullName_(row) || "the applicant";
  return composeSelectedApplicantEmail_(ctx, [
    "We are reviewing the payment information for the FODE KIA application for " + applicantName + ".",
    communicationApplicantSummaryBlock_(ctx, { useActionPlaceholders: true, requireGrade: true, requireSubjects: true }),
    "Payment / quote and payment instructions:",
    canonicalFodePaymentInformationBlock_(ctx),
    "Payment evidence / receipt is still required before the office can continue the payment verification step.",
    "Please upload a clear copy of the payment receipt or payment proof through the approved application portal, or send it to Admissions for verification.",
    communicationPortalInstructionBlock_(ctx, "Secure portal link for payment receipt upload or application review:"),
    "This request is for payment evidence only and does not confirm acceptance or enrolment."
  ]);
}

function buildApplicationVerifiedQuoteSubject_() {
  return "FODE KIA Application - Fee and Subject Guidance";
}

function buildApplicationVerifiedQuoteBody_(context) {
  var ctx = context || {};
  var row = ctx.rowObj || {};
  var applicantName = buildApplicantFullName_(row) || "the applicant";
  return composeSelectedApplicantEmail_(ctx, [
    "Admissions has completed document verification for the FODE KIA application for " + applicantName + ". The next step is to review the fee/subject guidance and provide payment evidence.",
    communicationApplicantSummaryBlock_(ctx, { useActionPlaceholders: true, requireGrade: true, requireSubjects: true }),
    "Payment / quote and payment instructions:",
    canonicalFodePaymentInformationBlock_(ctx),
    "Next steps:",
    [
      "1. Check that the grade and subject details are correct.",
      "2. Complete the required payment using the approved payment instructions.",
      "3. Upload or send the payment receipt/evidence to Admissions.",
      "4. Contact Admissions before paying if any fee, grade, or subject detail looks incorrect."
    ].join("\n"),
    communicationPortalInstructionBlock_(ctx, "Portal link for receipt upload or application review:"),
    "This message confirms document verification only. It does not confirm acceptance or enrolment until payment and enrolment requirements are completed."
  ]);
}

function buildApplicationAcceptanceConfirmationSubject_() {
  return "FODE KIA Application - Acceptance and Enrolment Confirmation";
}

function buildApplicationAcceptanceConfirmationBody_(context) {
  var ctx = context || {};
  var row = ctx.rowObj || {};
  var applicantName = buildApplicantFullName_(row) || "the applicant";
  return composeSelectedApplicantEmail_(ctx, [
    "Admissions is ready to confirm the current acceptance or enrolment outcome for the FODE KIA application below.",
    communicationApplicantSummaryBlock_(ctx, { useActionPlaceholders: true, requireGrade: true, requireSubjects: true }),
    "Acceptance / enrolment status:",
    firstNonEmptyRowValue_(row, ["Acceptance_Status", "Enrolment_Status", "Overall_Status", "Status"]) || actionRequiredPlaceholder_("confirm acceptance/enrolment status"),
    "Next steps:",
    [
      "1. Review the grade, subject, payment, and enrolment details above.",
      "2. Follow any classroom, enrolment, payment, or handover instructions provided by FODE KIA Admissions.",
      "3. Contact Admissions immediately if any detail is incorrect."
    ].join("\n")
  ]);
}

function buildApplicationExamFeeReminderSubject_() {
  return "FODE National Exam Fee - Subject Confirmation Required";
}

function buildApplicationExamFeeReminderBody_(context) {
  var ctx = context || {};
  return [
    "Dear Parent/Guardian,",
    "",
    "This is a planned reminder concerning the Department of Education FODE National Exam Fee.",
    "",
    "The current operator-known fee is K150 per subject. The applicant's confirmed subject count must be checked before any personalised total is communicated.",
    "",
    "Applicant ID: " + String(ctx.applicantId || ""),
    "",
    "This reminder does not confirm acceptance, enrolment, or exam registration.",
    "",
    "FODE KIA Admissions Team"
  ].join("\n");
}

function buildApplicationFinalReminderSubject_() {
  return "FODE KIA Application - Final Follow-Up";
}

function buildApplicationFinalReminderBody_(context) {
  var ctx = context || {};
  var row = ctx.rowObj || {};
  var applicantName = buildApplicantFullName_(row) || "the applicant";
  return composeSelectedApplicantEmail_(ctx, [
    "This is a final follow-up for the FODE KIA application for " + applicantName + ". Admissions still needs the outstanding action below before the application can continue.",
    communicationApplicantSummaryBlock_(ctx, { useActionPlaceholders: true }),
    "Outstanding action:",
    applicantOutstandingActionOrPlaceholder_(row),
    "Deadline / urgency:",
    actionRequiredPlaceholder_("confirm deadline or urgency"),
    "Please contact FODE Admissions if you still wish to continue or need assistance. If we do not hear from you, the application may be referred for manual or dormant-case handling."
  ]);
}

function buildContactFallbackManualSubject_() {
  return "Manual Contact Required";
}

function buildContactFallbackManualBody_(context) {
  var ctx = context || {};
  return [
    "Operator advisory: email contact is unavailable or invalid for this applicant.",
    "Applicant ID: " + String(ctx.applicantId || ""),
    "Use the approved phone or WhatsApp manual-contact process.",
    "Confirm contact authority and avoid sending sensitive applicant details through an unverified number."
  ].join("\n");
}

function previewRpcPayloadSize_(payload) {
  try {
    return Utilities.newBlob(JSON.stringify(payload || {}), "application/json").getBytes().length;
  } catch (_err) {
    return -1;
  }
}

function buildPortalSecretPreviewLookup_() {
  try {
    var opened = openPortalSecretsExistingSheet_(newDebugId_(), { source: "config" });
    if (!opened || opened.ok !== true) throw new Error(clean_(opened && opened.code || "SECRET_LOOKUP_FAILED"));
    var secretsSheet = opened.sheet;
    var idx = getHeaderIndexMap_(secretsSheet);
    if (!idx.ApplicantID) throw new Error("PortalSecrets missing header: ApplicantID");
    var data = withSpreadsheetRetry_(function () {
      return secretsSheet.getDataRange().getValues();
    });
    var byApplicantId = {};
    for (var r = 1; r < data.length; r++) {
      var row = data[r] || [];
      var rec = normalizePortalSecretRow_(idx, row, r + 1);
      var applicantId = clean_(rec.applicantId || "");
      if (!applicantId) continue;
      rec.status = normalizePortalSecretStatus_(rec.status || "");
      if (idx.Status && rec.status !== "ACTIVE") {
        if (!byApplicantId[applicantId]) {
          byApplicantId[applicantId] = {
            applicantId: applicantId,
            rowIndex: Number(rec.rowIndex || 0),
            status: rec.status,
            secretPlain: clean_(rec.secretPlain || ""),
            secretHash: clean_(rec.secretHash || "")
          };
        }
        continue;
      }
      if (byApplicantId[applicantId] && (!idx.Status || byApplicantId[applicantId].status === "ACTIVE")) continue;
      byApplicantId[applicantId] = {
        applicantId: applicantId,
        rowIndex: Number(rec.rowIndex || 0),
        status: rec.status,
        secretPlain: clean_(rec.secretPlain || ""),
        secretHash: clean_(rec.secretHash || "")
      };
    }
    return { ok: true, byApplicantId: byApplicantId, hasStatus: !!idx.Status };
  } catch (e) {
    return {
      ok: false,
      code: "SECRET_LOOKUP_FAILED",
      error: safeStr_(stringifyGsError_(e) || "Secret lookup failed"),
      byApplicantId: {}
    };
  }
}

function previewRpcTerminalSummary_(payload) {
  var data = payload && typeof payload === "object" ? payload : {};
  var phase = data.phaseTimings && typeof data.phaseTimings === "object" ? data.phaseTimings : {};
  var summary = {
    requestId: clean_(data.requestId || data.debugId || ""),
    outcome: clean_(data.result || (data.ok === false ? "ERROR" : "EMPTY") || ""),
    count: Number(data.count || 0),
    candidateCount: Number(data.eligibleUnsentFound || 0),
    payloadBytes: Number(previewRpcPayloadSize_(data) || 0),
    phaseTimings: {
      candidateSelectionMs: Number(phase.candidateSelectionMs || 0),
      eligibilityFilteringMs: Number(phase.eligibilityFilteringMs || 0),
      rowHydrationMs: Number(phase.rowHydrationMs || 0),
      resolutionMs: Number(phase.resolutionMs || 0),
      payloadAssemblyMs: Number(phase.payloadAssemblyMs || 0)
    }
  };
  try {
    Logger.log("STAGE_BATCH_PREVIEW_RPC_RETURN " + JSON.stringify(summary));
  } catch (_logErr) {}
  return data;
}

function resolveApplicantMessageContextFromRow_(rowObj, rowNumber, sheet, messageType, opts) {
  var options = opts && typeof opts === "object" ? opts : {};
  var debugId = clean_(options.debugId || newDebugId_());
  var requestId = clean_(options.requestId || debugId || newDebugId_());
  var variantSelector = typeof communicationResolveTemplateVariantSelector_ === "function"
    ? communicationResolveTemplateVariantSelector_(messageType, options)
    : null;
  var normalizedType = variantSelector ? variantSelector.parentMessageType : normalizeApplicantMessageType_(messageType);
  var actor = communicationGetActorInfo_(options);
  var row = rowObj || {};
  var previewMetrics = options.previewMetrics && typeof options.previewMetrics === "object" ? options.previewMetrics : null;
  var portalSecretLookup = options.portalSecretLookup && typeof options.portalSecretLookup === "object" ? options.portalSecretLookup : null;
  var cooldownLookup = options.cooldownLookup && typeof options.cooldownLookup === "object" ? options.cooldownLookup : null;
  var resolutionStartedAtMs = new Date().getTime();
  var communicationState = deriveCommunicationState_(row, normalizedType, {
    applicantId: clean_(row.ApplicantID || options.applicantId || ""),
    cooldownLookup: cooldownLookup,
    nowMs: resolutionStartedAtMs
  });
  var baseState = communicationState.base || {};
  var context = {
    ok: true,
    eligible: false,
    blockCode: "",
    blockReason: "",
    effectiveEmail: clean_(baseState.effectiveEmail || ""),
    portalUrl: "",
    rowObj: row,
    applicantId: clean_(communicationState.applicantId || ""),
    messageType: normalizedType || clean_(messageType || ""),
    requestedMessageType: clean_(messageType || ""),
    templateId: variantSelector ? clean_(variantSelector.variant.templateId || "") : "",
    templateVersionId: variantSelector ? clean_(variantSelector.variant.versionId || "") : "1",
    templateSource: variantSelector ? "SAVED_VARIANT" : "BUILT_IN",
    selectedTemplateVariant: variantSelector ? variantSelector.variant : null,
    permitted: false,
    sendableNow: false,
    communicationFamily: clean_(communicationState.communicationFamily || ""),
    emailStatus: clean_(baseState.emailStatus || ""),
    portalSubmittedActive: baseState.portalSubmittedActive === true,
    docsVerified: baseState.docsVerified === true,
    paymentVerified: baseState.paymentVerified === true,
    requiresPortalUrl: baseState.requiresPortalUrl === true,
    cooldownLastSentAt: clean_(communicationState.cooldownLastSentAt || ""),
    debugId: debugId,
    requestId: requestId,
    actorEmail: actor.email,
    actorRole: actor.role,
    protectedCommunication: false,
    overridePermitted: false,
    overrideApplied: false,
    overrideReason: "",
    prerequisiteChecks: [],
    missingPrerequisites: [],
    lifecycleStage: "",
    legacyLifecycleStage: "",
    canonicalLifecycleAuthority: null,
    applicantState: "",
    rowNumber: Number(rowNumber || 0),
    sheet: sheet || null,
    batchLabel: clean_(options.batchLabel || "")
  };

  function finalize(outcome) {
    if (previewMetrics) {
      previewMetrics.resolutionMs = Number(previewMetrics.resolutionMs || 0) + (new Date().getTime() - resolutionStartedAtMs);
      previewMetrics.resolutionCount = Number(previewMetrics.resolutionCount || 0) + 1;
      if (outcome === "eligible") previewMetrics.resolutionEligibleCount = Number(previewMetrics.resolutionEligibleCount || 0) + 1;
      else previewMetrics.resolutionBlockedCount = Number(previewMetrics.resolutionBlockedCount || 0) + 1;
    }
    return context;
  }

  function block(code, reason) {
    context.eligible = false;
    context.sendableNow = false;
    context.blockCode = clean_(code || "");
    context.blockReason = clean_(reason || communicationBlockReason_(context.blockCode, context.messageType));
    return finalize("blocked");
  }

  if (!normalizedType) return block("UNKNOWN_MESSAGE_TYPE");
  if (!actor.isAdmin) return block("ROLE_BLOCKED");
  if (clean_(options.action || "") === "planBatch" && !actor.isSuper) return block("ROLE_BLOCKED");
  var capabilityBlock = communicationCapabilityBlock_(actor, normalizedType, clean_(options.action || "") === "send" ? "send" : "preview");
  if (capabilityBlock) return block(capabilityBlock.blockCode, capabilityBlock.blockReason);
  if (!context.applicantId) return block("APPLICANT_NOT_FOUND");

  var canonicalLifecycle = typeof resolveCanonicalApplicantLifecycle_ === "function"
    ? resolveCanonicalApplicantLifecycle_(row, {})
    : null;
  var authority = evaluateCommunicationAuthority_(row, normalizedType, baseState, Object.assign({}, options, {
    actor: actor,
    canonicalLifecycle: canonicalLifecycle,
    authorityOverride: options.authorityOverride === true,
    authorityOverrideReason: clean_(options.authorityOverrideReason || "")
  }));
  context.permitted = authority.ok === true;
  context.protectedCommunication = authority.protectedCommunication === true;
  context.overridePermitted = authority.overridePermitted === true;
  context.overrideApplied = authority.overrideApplied === true;
  context.overrideReason = clean_(authority.overrideReason || "");
  context.prerequisiteChecks = authority.prerequisiteChecks || [];
  context.missingPrerequisites = authority.missingPrerequisites || [];
  context.lifecycleStage = clean_(authority.lifecycleStage || "");
  context.legacyLifecycleStage = clean_(authority.legacyLifecycleStage || authority.lifecycleStage || "");
  context.canonicalLifecycleAuthority = authority.canonicalLifecycleAuthority || null;
  context.applicantState = clean_(authority.applicantState || "");

  var definition = getCommunicationSemanticDefinition_(normalizedType);
  var requiresValidEmail = !(definition && definition.requiresValidEmail === false);
  if (requiresValidEmail && !baseState.hasEffectiveEmail) return block("NO_EFFECTIVE_EMAIL");
  if (requiresValidEmail && baseState.hasValidEffectiveEmail !== true) return block("INVALID_EMAIL", "Applicant does not have a valid email address.");
  if (baseState.bounceFlag) return block("BOUNCED", clean_(baseState.bounceReason || "") || communicationBlockReason_("BOUNCED", normalizedType));
  if (context.emailStatus === "DO_NOT_CONTACT") return block("DO_NOT_CONTACT");
  if (communicationState.cooldownActive) return block("COOLDOWN_ACTIVE");
  if ((isPortalCommunicationMessageType_(normalizedType) || normalizedType === "reminder") && context.portalSubmittedActive) {
    return block("PORTAL_ALREADY_SUBMITTED");
  }
  if (!authority.ok) return block(authority.blockCode, authority.blockReason);
  if (authority.overrideApplied === true) logCommunicationAuthorityOverride_(context, authority, clean_(options.action || ""));
  if (communicationRequiresSubjects_(normalizedType) && !applicantSubjectsValue_(row)) {
    return block("SUBJECTS_AUTHORITY_REQUIRED");
  }

  if (context.requiresPortalUrl) {
    var portalAuthority = null;
    if (portalSecretLookup && portalSecretLookup.byApplicantId) {
      var cachedSecret = portalSecretLookup.byApplicantId[context.applicantId] || null;
      portalAuthority = resolveExistingStudentPortalAuthority_(context.applicantId, {
        secretRecord: cachedSecret ? {
          ok: true,
          applicantId: clean_(cachedSecret.applicantId || context.applicantId || ""),
          status: clean_(cachedSecret.status || ""),
          secretPlain: clean_(cachedSecret.secretPlain || "")
        } : null,
        statusRequired: portalSecretLookup.hasStatus === true
      });
    } else {
      portalAuthority = resolveExistingStudentPortalAuthority_(context.applicantId);
    }
    if (!portalAuthority || portalAuthority.available !== true) return block("PORTAL_LINK_UNAVAILABLE", clean_(portalAuthority && portalAuthority.reason || "Active applicant portal authority is unavailable."));
    if (!options.skipPortalUrlBuild) context.portalUrl = clean_(portalAuthority.portalUrl || "");
    context.portalTokenState = clean_(portalAuthority.tokenState || "");
  }

  if (normalizedType === "docs_missing" && baseState.docsMissing !== true) {
    return block("DOCS_ALREADY_COMPLETE");
  }
  if (normalizedType === "payment_followup") {
    if (communicationDocsVerifiedForPayment_(row, baseState) !== true) return block("DOCS_NOT_VERIFIED_FOR_PAYMENT");
    if (baseState.paymentOutstanding !== true) return block("PAYMENT_ALREADY_RESOLVED");
  }
  if (normalizedType === "application_receipt_request") {
    if (communicationDocsVerifiedForPayment_(row, baseState) !== true) return block("DOCS_NOT_VERIFIED_FOR_PAYMENT");
    if (communicationPaymentEvidenceMissing_(row) !== true) return block("PAYMENT_EVIDENCE_ALREADY_PRESENT");
  }
  if (normalizedType === "application_verified_quote") {
    if (communicationDocsVerifiedForPayment_(row, baseState) !== true) return block("DOCS_NOT_VERIFIED_FOR_PAYMENT");
    if (baseState.paymentVerified === true) return block("PAYMENT_ALREADY_RESOLVED");
    if (communicationQuoteEligible_(row) !== true) return block("QUOTE_NOT_READY");
  }

  context.eligible = true;
  context.sendableNow = true;
  return finalize("eligible");
}

function resolveApplicantMessageContext_(applicantId, messageType, opts) {
  var options = opts && typeof opts === "object" ? opts : {};
  var normalizedType = normalizeApplicantMessageType_(messageType);
  var actor = communicationGetActorInfo_(options);
  var debugId = clean_(options.debugId || newDebugId_());
  var context = {
    ok: true,
    eligible: false,
    blockCode: "",
    blockReason: "",
    effectiveEmail: "",
    portalUrl: "",
    rowObj: null,
    applicantId: clean_(applicantId || ""),
    messageType: normalizedType || clean_(messageType || ""),
    emailStatus: "",
    portalSubmittedActive: false,
    docsVerified: false,
    paymentVerified: false,
    requiresPortalUrl: false,
    debugId: debugId,
    actorEmail: actor.email,
    actorRole: actor.role,
    rowNumber: 0,
    sheet: null,
    batchLabel: clean_(options.batchLabel || "")
  };

  function block(code, reason) {
    context.eligible = false;
    context.blockCode = clean_(code || "");
    context.blockReason = clean_(reason || communicationBlockReason_(context.blockCode, context.messageType));
    return context;
  }

  if (!normalizedType) return block("UNKNOWN_MESSAGE_TYPE");
  if (!actor.isAdmin) return block("ROLE_BLOCKED");
  if (clean_(options.action || "") === "planBatch" && !actor.isSuper) return block("ROLE_BLOCKED");
  var capabilityBlock = communicationCapabilityBlock_(actor, normalizedType, clean_(options.action || "") === "send" ? "send" : "preview");
  if (capabilityBlock) return block(capabilityBlock.blockCode, capabilityBlock.blockReason);

  var sheet = mustGetDataSheet_(getWorkingSpreadsheet_());
  var rowNumber = findRowByApplicantId_(sheet, applicantId);
  if (!rowNumber) return block("APPLICANT_NOT_FOUND");

  var rowObj = getRowObject_(sheet, rowNumber);
  return resolveApplicantMessageContextFromRow_(rowObj, rowNumber, sheet, normalizedType, Object.assign({}, options, {
    debugId: debugId,
    actorEmail: actor.email,
    actorRole: actor.role,
    applicantId: clean_(rowObj.ApplicantID || applicantId || "")
  }));
}

function hasPriorSuccessfulMessageSend_(context) {
  var ctx = context || {};
  var rowObj = ctx.rowObj || {};
  var messageType = normalizeApplicantMessageType_(ctx.messageType || "");
  var communicationState = deriveCommunicationState_(rowObj, messageType, {
    applicantId: clean_(ctx.applicantId || rowObj.ApplicantID || "")
  });
  if (!messageType) return false;
  if (communicationState.cooldownLastSentAt) return true;
  return communicationState.durablePriorSuccess === true;
}

function fdAcknowledgementInternalActor_() {
  var email = clean_((CONFIG.SUPER_ADMIN_EMAILS && CONFIG.SUPER_ADMIN_EMAILS[0]) || (CONFIG.ADMIN_EMAILS && CONFIG.ADMIN_EMAILS[0]) || "").toLowerCase();
  var role = email && typeof getAdminRole_ === "function" ? clean_(getAdminRole_(email) || "") : "";
  if (!role && email && CONFIG.ADMIN_ROLES) role = clean_(CONFIG.ADMIN_ROLES[email] || "");
  role = String(role || (email ? "SUPER" : "")).toUpperCase();
  var isAdmin = false;
  if (email && typeof isAdmin_ === "function") isAdmin = isAdmin_(email);
  return {
    actorEmail: email,
    actorRole: role,
    isAdmin: !!isAdmin,
    isSuper: role === "SUPER"
  };
}

function fdAcknowledgementBatchLabel_(source, debugId) {
  var src = clean_(source || "auto").toLowerCase().replace(/[^a-z0-9_-]+/g, "_").slice(0, 32) || "auto";
  return clean_("fd_ack " + src + " " + clean_(debugId || newDebugId_()));
}

function fdAcknowledgementContactSubject_(prefix, code) {
  var c = clean_(code || "");
  return clean_("fd_acknowledgement " + clean_(prefix || "blocked") + (c ? ": " + c : ""));
}

function recordFdAcknowledgementPostCommitTrace_(sheet, rowNumber, outcome, details) {
  var sh = sheet;
  var rowNum = Number(rowNumber || 0);
  if (!sh || rowNum < 2) return false;
  var info = details && typeof details === "object" ? details : {};
  var actor = fdAcknowledgementInternalActor_();
  var result = clean_(outcome || "");
  var code = clean_(info.code || "");
  var patch = {
    Last_Contact_Type: "fd_acknowledgement",
    Last_Contact_Result: result,
    Last_Contact_Batch: clean_(info.batchLabel || fdAcknowledgementBatchLabel_(info.source || "post_commit", info.debugId || info.correlationId || "")),
    Last_Contact_DebugId: clean_(info.debugId || info.correlationId || ""),
    Last_Contact_By: clean_(actor.actorEmail || ""),
    Last_Contact_Subject: fdAcknowledgementContactSubject_(String(result || "trace").toLowerCase(), code || clean_(info.reason || ""))
  };
  try {
    applyPatch_(sh, rowNum, patch);
    return true;
  } catch (_traceErr) {
    return false;
  }
}

function runFdAcknowledgementForCommittedRow_(sheet, rowNumber, opts) {
  var options = opts && typeof opts === "object" ? opts : {};
  var sh = sheet;
  var rowNum = Number(rowNumber || 0);
  var debugId = clean_(options.debugId || options.correlationId || newDebugId_());
  var dryRun = options.dryRun === true;
  var batchLabel = clean_(options.batchLabel || fdAcknowledgementBatchLabel_(dryRun ? "dry_run" : (options.source || "auto"), debugId));
  var messageType = "fd_acknowledgement";
  if (!sh || rowNum < 2) {
    return {
      ok: true,
      action: "fd_acknowledgement",
      result: "BLOCKED",
      eligible: false,
      blockCode: "INVALID_TARGET_ROW",
      blockReason: "A committed applicant row is required.",
      applicantId: clean_(options.applicantId || ""),
      messageType: messageType,
      debugId: debugId,
      dryRun: dryRun
    };
  }
  var rowObj = getRowObject_(sh, rowNum);
  var rowApplicantId = clean_(rowObj.ApplicantID || "");
  var requestedApplicantId = clean_(options.applicantId || rowApplicantId || "");
  if (!rowApplicantId || (requestedApplicantId && rowApplicantId !== requestedApplicantId)) {
    return {
      ok: true,
      action: "fd_acknowledgement",
      result: "BLOCKED",
      eligible: false,
      blockCode: rowApplicantId ? "APPLICANT_ID_MISMATCH" : "MISSING_APPLICANT_ID",
      blockReason: rowApplicantId ? "Committed row ApplicantID does not match the requested ApplicantID." : "Committed row is missing ApplicantID.",
      applicantId: requestedApplicantId || rowApplicantId,
      messageType: messageType,
      rowNumber: rowNum,
      debugId: debugId,
      dryRun: dryRun
    };
  }
  var actor = fdAcknowledgementInternalActor_();
  var context = resolveApplicantMessageContextFromRow_(rowObj, rowNum, sh, messageType, {
    action: dryRun ? "preview" : "send",
    actorEmail: actor.actorEmail,
    actorRole: actor.actorRole,
    applicantId: rowApplicantId,
    batchLabel: batchLabel,
    debugId: debugId,
    requestId: debugId
  });
  if (!context.eligible) {
    if (!dryRun) {
      recordApplicantContactOutcome_(context, "BLOCKED", {
        actorEmail: actor.actorEmail,
        batchLabel: batchLabel,
        subject: fdAcknowledgementContactSubject_("blocked", context.blockCode),
        debugId: debugId
      });
    }
    return {
      ok: true,
      action: "fd_acknowledgement",
      result: "BLOCKED",
      eligible: false,
      blockCode: clean_(context.blockCode || ""),
      blockReason: clean_(context.blockReason || ""),
      applicantId: rowApplicantId,
      messageType: messageType,
      rowNumber: rowNum,
      batchLabel: batchLabel,
      debugId: debugId,
      dryRun: dryRun
    };
  }
  var built = buildApplicantMessage_(context);
  if (!built.ok) {
    if (!dryRun) {
      recordApplicantContactOutcome_(context, "BLOCKED", {
        actorEmail: actor.actorEmail,
        batchLabel: batchLabel,
        subject: fdAcknowledgementContactSubject_("blocked", built.code),
        debugId: debugId
      });
    }
    return {
      ok: true,
      action: "fd_acknowledgement",
      result: "BLOCKED",
      eligible: false,
      blockCode: clean_(built.code || "MESSAGE_BUILD_FAILED"),
      blockReason: "fd_acknowledgement message could not be built.",
      applicantId: rowApplicantId,
      messageType: messageType,
      rowNumber: rowNum,
      batchLabel: batchLabel,
      debugId: debugId,
      dryRun: dryRun
    };
  }
  if (dryRun) {
    var dryRunIdempotencyKey = computeEmailIdempotencyKey_(context, {
      batchLabel: batchLabel,
      sendSource: "FD_ACK_DRY_RUN"
    });
    var processed = wasEmailAlreadyProcessed_(context, dryRunIdempotencyKey);
    return {
      ok: true,
      action: "fd_acknowledgement",
      result: processed.alreadyProcessed ? "DUPLICATE" : "DRY_RUN",
      eligible: processed.alreadyProcessed ? false : true,
      blockCode: processed.alreadyProcessed ? "ALREADY_PROCESSED" : "",
      blockReason: processed.alreadyProcessed ? "Duplicate fd_acknowledgement would be suppressed." : "",
      applicantId: rowApplicantId,
      messageType: messageType,
      rowNumber: rowNum,
      effectiveEmail: clean_(context.effectiveEmail || ""),
      portalUrl: clean_(context.portalUrl || ""),
      subject: clean_(built.subject || ""),
      bodySnippet: clean_(String(built.body || "").replace(/\s+/g, " ").slice(0, 160)),
      batchLabel: batchLabel,
      debugId: debugId,
      dryRun: true
    };
  }
  var dispatched = dispatchApplicantMessage_(context, built, {
    actorEmail: actor.actorEmail,
    actorRole: actor.actorRole,
    batchLabel: batchLabel,
    debugId: debugId,
    manualSingleSendProbe: options.manualSingleSendProbe === true,
    sendSource: clean_(options.sendSource || "FD_ACK_POST_COMMIT"),
    unattended: options.unattended === false ? false : true,
    limit: 1,
    processorSource: clean_(options.source || ""),
    processorScope: "single_applicant"
  });
  if (clean_(dispatched.result || "").toUpperCase() === "BLOCKED") {
    recordApplicantContactOutcome_(context, "BLOCKED", {
      actorEmail: actor.actorEmail,
      batchLabel: batchLabel,
      subject: fdAcknowledgementContactSubject_("blocked", dispatched.blockCode || dispatched.code),
      debugId: debugId
    });
  }
  return Object.assign({}, dispatched, {
    action: "fd_acknowledgement",
    batchLabel: batchLabel,
    dryRun: false
  });
}

function runFdAcknowledgementForApplicantId_(applicantId, opts) {
  var id = clean_(applicantId || "");
  var options = opts && typeof opts === "object" ? opts : {};
  var debugId = clean_(options.debugId || newDebugId_());
  if (!id) {
    return {
      ok: true,
      action: "fd_acknowledgement",
      result: "BLOCKED",
      eligible: false,
      blockCode: "MISSING_APPLICANT_ID",
      blockReason: "ApplicantID is required.",
      applicantId: "",
      messageType: "fd_acknowledgement",
      debugId: debugId,
      dryRun: options.dryRun === true
    };
  }
  var sh = mustGetDataSheet_(getWorkingSpreadsheet_());
  var rowNumber = findRowByApplicantId_(sh, id);
  if (!rowNumber) {
    return {
      ok: true,
      action: "fd_acknowledgement",
      result: "BLOCKED",
      eligible: false,
      blockCode: "APPLICANT_NOT_FOUND",
      blockReason: "Applicant was not found.",
      applicantId: id,
      messageType: "fd_acknowledgement",
      debugId: debugId,
      dryRun: options.dryRun === true
    };
  }
  return runFdAcknowledgementForCommittedRow_(sh, rowNumber, Object.assign({}, options, {
    applicantId: id,
    debugId: debugId,
    source: clean_(options.source || "admin_single")
  }));
}

function normalizeLifecycleStageKey_(stage) {
  return clean_(stage || "").toUpperCase();
}

function lifecycleStageMessageTypeMap_() {
  return {
    INVITE_PENDING: "legacy_invite",
    INVITED_AWAITING_RESPONSE: "reminder",
    REMINDER_DUE: "reminder",
    DOCS_REQUIRED: "docs_missing",
    PAYMENT_REQUIRED: "payment_followup",
    RECEIPT_AWAITING_VERIFICATION: "payment_followup"
  };
}

function communicationRecommendedMessageTypeForStage_(stage) {
  var normalized = normalizeLifecycleStageKey_(stage);
  var map = lifecycleStageMessageTypeMap_();
  return map[normalized] || "";
}

function isLifecycleAwaitingResponseStage_(stage) {
  var normalized = normalizeLifecycleStageKey_(stage);
  return ["INVITED_AWAITING_RESPONSE", "REMINDER_DUE", "DOCS_REQUIRED", "PAYMENT_REQUIRED", "RECEIPT_AWAITING_VERIFICATION"].indexOf(normalized) >= 0;
}

function communicationOverlayStatusFromCode_(code) {
  var normalized = clean_(code || "").toUpperCase();
  if (normalized === "INVALID_EMAIL") return "INVALID_EMAIL";
  if (normalized === "BOUNCED") return "BOUNCED";
  if (normalized === "DO_NOT_CONTACT") return "DO_NOT_CONTACT";
  if (normalized === "COOLDOWN" || normalized === "COOLDOWN_ACTIVE") return "COOLDOWN";
  if (normalized === "PORTAL_SUBMITTED" || normalized === "PORTAL_ALREADY_SUBMITTED") return "PORTAL_SUBMITTED";
  if (/_CAPABILITY_REQUIRED$/.test(normalized) || normalized === "ROLE_BLOCKED") return "ROLE_BLOCKED";
  if (normalized === "RESPONDED") return "RESPONDED";
  if (normalized === "MISSING_PORTAL_SECRET" || normalized === "NO_PORTAL_SECRET") return "NO_PORTAL_SECRET";
  return "NOT_STAGE_MESSAGE_MATCH";
}

function deriveApplicantLifecycleStage_(rowObj) {
  var row = rowObj || {};
  var emailStatus = normalizeEmailStatus_(row.Email_Status || "");
  var portalSubmittedActive = isCampaignPortalSubmittedActive_(row);
  var bounceFlag = isCampaignBounceFlagTrue_(row.Email_Bounce_Flag);
  var docsVerified = computeDocVerificationStatus_(row) === "Verified" || clean_(row.Docs_Verified || "") === "Yes";
  var paymentBadge = canonicalPaymentBadge_(row);
  var paymentVerified = isCanonicalPaymentVerified_(row);
  var receiptEvidencePresent = hasUploadEvidence_(row.Fee_Receipt_File, "Fee_Receipt_File");
  var attemptCount = campaignAttemptCount_(row);
  var nextActionTs = parseTime_(row.Email_Next_Action_Date || "");
  var now = new Date();
  var todayTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  var keys = typeof resolveDocStatusKeys_ === 'function' ? resolveDocStatusKeys_(row) : {};
  var docSignals = [keys.birth, keys.report, keys.photo, keys.transfer].filter(Boolean).some(function (key) {
    return !!clean_(row[key] || "");
  });
  var docStage = computeDocVerificationStatus_(row);
  var reminderDue = emailStatus === "SENT"
    && !portalSubmittedActive
    && !bounceFlag
    && attemptCount >= 1
    && attemptCount < 3
    && nextActionTs > 0
    && nextActionTs <= todayTs;
  var stage = "INVITE_PENDING";

  if (paymentVerified) stage = "COMPLETE";
  else if (portalSubmittedActive || emailStatus === "RESPONDED") stage = "PROCESSING";
  else if (docsVerified && !paymentVerified && paymentBadge !== "Verified" && receiptEvidencePresent) stage = "RECEIPT_AWAITING_VERIFICATION";
  else if (docsVerified && !paymentVerified) stage = "PAYMENT_REQUIRED";
  else if (!docsVerified && (docSignals || docStage === "Rejected")) stage = "DOCS_REQUIRED";
  else if (reminderDue) stage = "REMINDER_DUE";
  else if (emailStatus === "SENT") stage = "INVITED_AWAITING_RESPONSE";

  return stage;
}

function deriveApplicantActionability_(rowObj, lifecycleStage, opts) {
  var row = rowObj || {};
  var options = opts && typeof opts === 'object' ? opts : {};
  var stage = normalizeLifecycleStageKey_(lifecycleStage || deriveApplicantLifecycleStage_(row));
  var applicantId = clean_(row.ApplicantID || "");
  var getEffectiveEmail = typeof options.getEffectiveEmail === 'function' ? options.getEffectiveEmail : getCampaignEffectiveEmail_;
  var isValidEmail = typeof options.isValidEmail === 'function' ? options.isValidEmail : isValidEffectiveEmail_;
  var getRecommendedMessageType = typeof options.getRecommendedMessageType === 'function' ? options.getRecommendedMessageType : communicationRecommendedMessageTypeForStage_;
  var resolveEligibility = options.resolveEligibility === true;
  var canonicalLifecycle = typeof resolveCanonicalApplicantLifecycle_ === 'function'
    ? resolveCanonicalApplicantLifecycle_(row, {})
    : null;
  var canonicalRecommendedMessageType = clean_(canonicalLifecycle && canonicalLifecycle.recommendedMessageType || "");
  var recommendedMessageType = clean_(canonicalRecommendedMessageType || getRecommendedMessageType(stage) || "");
  var communicationState = resolveEligibility
    ? deriveCommunicationState_(row, recommendedMessageType, { applicantId: applicantId })
    : null;
  var baseState = communicationState && communicationState.base ? communicationState.base : {};
  var effectiveEmail = resolveEligibility ? clean_(baseState.effectiveEmail || "") : clean_(getEffectiveEmail(row));
  var emailStatus = resolveEligibility ? clean_(baseState.emailStatus || "") : normalizeEmailStatus_(row.Email_Status || "");
  var portalSubmittedActive = resolveEligibility ? baseState.portalSubmittedActive === true : isCampaignPortalSubmittedActive_(row);
  var bounceFlag = resolveEligibility ? baseState.bounceFlag === true : isCampaignBounceFlagTrue_(row.Email_Bounce_Flag);
  var bounceReason = resolveEligibility ? clean_(baseState.bounceReason || "") : clean_(row.Email_Bounce_Reason || "");
  var hasValidEffectiveEmail = resolveEligibility ? baseState.hasValidEffectiveEmail === true : isValidEmail(effectiveEmail);
  var awaitingResponse = isLifecycleAwaitingResponseStage_(stage);
  var commStatus = "ACTIONABLE";
  var canSendNow = false;
  var blockCode = "";
  var blockReason = "";

  if (!effectiveEmail) {
    commStatus = "INVALID_EMAIL";
    blockCode = "INVALID_EMAIL";
    blockReason = "Applicant does not have a valid email address.";
  } else if (hasValidEffectiveEmail !== true) {
    commStatus = "INVALID_EMAIL";
    blockCode = "INVALID_EMAIL";
    blockReason = "Applicant does not have a valid email address.";
  } else if (bounceFlag) {
    commStatus = "BOUNCED";
    blockCode = "BOUNCED";
    blockReason = clean_(bounceReason || "") || communicationBlockReason_("BOUNCED", recommendedMessageType || stage);
  } else if (emailStatus === "DO_NOT_CONTACT") {
    commStatus = "DO_NOT_CONTACT";
    blockCode = "DO_NOT_CONTACT";
    blockReason = communicationBlockReason_("DO_NOT_CONTACT", recommendedMessageType || stage);
  } else if (portalSubmittedActive) {
    commStatus = "PORTAL_SUBMITTED";
    blockCode = "PORTAL_SUBMITTED";
    blockReason = communicationBlockReason_("PORTAL_ALREADY_SUBMITTED", recommendedMessageType || stage);
  } else if (emailStatus === "RESPONDED") {
    commStatus = "RESPONDED";
    blockCode = "RESPONDED";
    blockReason = "Applicant is already under active processing.";
  } else if (stage === "INVITED_AWAITING_RESPONSE") {
    commStatus = "COOLDOWN";
    blockCode = "COOLDOWN";
    blockReason = "A follow-up reminder is not due yet.";
  } else if (!recommendedMessageType) {
    commStatus = "NOT_STAGE_MESSAGE_MATCH";
    blockCode = "NOT_STAGE_MESSAGE_MATCH";
    blockReason = "No communication is recommended for the current lifecycle stage.";
  } else if (!resolveEligibility) {
    commStatus = "ACTIONABLE";
    canSendNow = true;
  } else if (!applicantId) {
    commStatus = "NOT_STAGE_MESSAGE_MATCH";
    blockCode = "MISSING_APPLICANT_ID";
    blockReason = "Applicant ID is required.";
  } else {
    var actorEmail = typeof getCallerEmail_ === 'function' ? clean_(getCallerEmail_() || "") : "";
    var actorRole = actorEmail && typeof getAdminRole_ === 'function' ? clean_(getAdminRole_(actorEmail) || "") : "";
    var resolved = resolveApplicantMessageContext_(applicantId, recommendedMessageType, {
      action: "preview",
      actorEmail: actorEmail,
      actorRole: actorRole
    });
    if (resolved && resolved.eligible) {
      commStatus = "ACTIONABLE";
      canSendNow = true;
    } else {
      blockCode = clean_(resolved && resolved.blockCode || "");
      blockReason = clean_(resolved && resolved.blockReason || "");
      commStatus = communicationOverlayStatusFromCode_(blockCode);
    }
  }

  return {
    commStatus: commStatus,
    canSendNow: !!canSendNow,
    blockCode: blockCode,
    blockReason: blockReason,
    recommendedMessageType: recommendedMessageType,
    awaitingResponse: !!awaitingResponse
  };
}

function getApplicantStageAndEligibility_(rowObj) {
  var row = rowObj || {};
  var stage = deriveApplicantLifecycleStage_(row);
  var actionability = deriveApplicantActionability_(row, stage, { resolveEligibility: true });

  return {
    stage: stage,
    commStatus: actionability.commStatus,
    canSendNow: !!actionability.canSendNow,
    blockCode: actionability.blockCode,
    blockReason: actionability.blockReason,
    recommendedMessageType: actionability.recommendedMessageType,
    awaitingResponse: !!actionability.awaitingResponse
  };
}

function buildApplicantCommunicationAuthorityProjection_(rowObj, rowNumber, sheet, requestedMessageType, opts) {
  var row = rowObj || {};
  var options = opts && typeof opts === "object" ? opts : {};
  var actor = communicationGetActorInfo_(options);
  var legacyStage = normalizeLifecycleStageKey_(deriveApplicantLifecycleStage_(row));
  var canonicalLifecycle = typeof resolveCanonicalApplicantLifecycle_ === "function"
    ? resolveCanonicalApplicantLifecycle_(row, {})
    : null;
  var recommendedMessageType = normalizeApplicantMessageType_(
    clean_(canonicalLifecycle && canonicalLifecycle.recommendedMessageType || "")
      || communicationRecommendedMessageTypeForStage_(legacyStage)
  );
  var requestedType = normalizeApplicantMessageType_(requestedMessageType || "");
  var selectedType = recommendedMessageType || requestedType;
  if (!selectedType) {
    return {
      stage: legacyStage,
      canonicalLifecycle: canonicalLifecycle,
      recommendedMessageType: "",
      requestedMessageType: requestedType,
      selectedMessageType: "",
      permitted: false,
      sendableNow: false,
      commStatus: "NOT_STAGE_MESSAGE_MATCH",
      blockCode: "NOT_STAGE_MESSAGE_MATCH",
      blockReason: "No communication is recommended for the current lifecycle stage.",
      awaitingResponse: isLifecycleAwaitingResponseStage_(legacyStage)
    };
  }
  var resolved = resolveApplicantMessageContextFromRow_(row, rowNumber, sheet, selectedType, Object.assign({}, options, {
    action: "preview",
    skipPortalUrlBuild: true
  }));
  var capabilityBlock = communicationCapabilityBlock_(actor, selectedType, "send");
  var blockCode = clean_(capabilityBlock && capabilityBlock.blockCode || resolved && resolved.blockCode || "");
  var blockReason = clean_(capabilityBlock && capabilityBlock.blockReason || resolved && resolved.blockReason || "");
  var permitted = capabilityBlock ? false : !!(resolved && resolved.permitted === true);
  var sendableNow = capabilityBlock ? false : !!(resolved && resolved.sendableNow === true && resolved.eligible === true);
  return {
    stage: legacyStage,
    canonicalLifecycle: canonicalLifecycle,
    recommendedMessageType: recommendedMessageType,
    requestedMessageType: requestedType,
    selectedMessageType: selectedType,
    permitted: permitted,
    sendableNow: sendableNow,
    commStatus: sendableNow
      ? "ACTIONABLE"
      : communicationOverlayStatusFromCode_(blockCode),
    blockCode: blockCode,
    blockReason: blockReason,
    awaitingResponse: isLifecycleAwaitingResponseStage_(legacyStage),
    authoritySource: clean_(resolved && resolved.canonicalLifecycleAuthority && resolved.canonicalLifecycleAuthority.authoritySource || ""),
    authorityResult: resolved || null
  };
}

function recordApplicantContactOutcome_(context, outcome, extra) {
  var ctx = context || {};
  var more = extra && typeof extra === "object" ? extra : {};
  if (!ctx.sheet || !ctx.rowNumber) return false;
  var actorEmail = clean_(more.actorEmail || ctx.actorEmail || "");
  var updates = {
    Last_Contact_Type: clean_(ctx.messageType || ""),
    Last_Contact_By: actorEmail,
    Last_Contact_Result: clean_(outcome || ""),
    Last_Contact_Batch: clean_(more.batchLabel || ctx.batchLabel || ""),
    Last_Contact_DebugId: clean_(ctx.debugId || more.debugId || "")
  };
  var subject = clean_(more.subject || "");
  if (subject) updates.Last_Contact_Subject = subject;
  if (clean_(outcome || "") === "SENT") {
    updates.Last_Contacted_At = clean_(more.sentAt || new Date().toISOString());
  }
  return writeApplicantContactTracking_(ctx.sheet, ctx.rowNumber, updates);
}

function buildApplicantMessage_(context) {
  var ctx = context || {};
  var type = normalizeApplicantMessageType_(ctx.messageType || "");
  if (!type) return { ok: false, code: "UNKNOWN_MESSAGE_TYPE", subject: "", body: "" };
  var variant = ctx.selectedTemplateVariant || null;
  function maybeVariant(fallback) {
    if (!variant) return fallback;
    return {
      ok: true,
      subject: communicationRenderTemplateText_(variant.subjectTemplate || "", ctx),
      body: communicationRenderTemplateText_(variant.bodyTemplate || "", ctx)
    };
  }
  if (type === "legacy_invite") {
    return maybeVariant({
      ok: true,
      subject: campaignSubjectForAttempt_(0, ctx.rowNumber || 0),
      body: buildCampaignEmailBody_(ctx.rowObj || {}, ctx.portalUrl || "", ctx.applicantId || "")
    });
  }
  if (type === "reminder") {
    return maybeVariant({
      ok: true,
      subject: "Reminder: Complete Your FODE KIA Online Application",
      body: buildReminderEmailBody_(ctx)
    });
  }
  if (type === "fd_acknowledgement") {
    return maybeVariant({
      ok: true,
      subject: "FODE KIA Application Received - Next Steps",
      body: buildFdAcknowledgementEmailBody_(ctx)
    });
  }
  if (type === "application_feedback") {
    return maybeVariant({
      ok: true,
      subject: "Application Feedback - Action Required for Your FODE KIA Application",
      body: buildApplicationFeedbackEmailBody_(ctx)
    });
  }
  if (type === "custom_email") {
    return maybeVariant({
      ok: true,
      subject: buildCustomSelectedEmailSubject_(),
      body: buildCustomSelectedEmailBody_(ctx)
    });
  }
  if (type === "docs_missing") {
    return maybeVariant({
      ok: true,
      subject: "FODE KIA Application - Missing Documents",
      body: buildDocsMissingEmailBody_(ctx)
    });
  }
  if (type === "payment_followup") {
    return maybeVariant({
      ok: true,
      subject: "FODE KIA Application - Payment Follow-Up",
      body: buildPaymentFollowupEmailBody_(ctx)
    });
  }
  if (type === "application_acceptance_confirmation") {
    return maybeVariant({
      ok: true,
      subject: buildApplicationAcceptanceConfirmationSubject_(),
      body: buildApplicationAcceptanceConfirmationBody_(ctx)
    });
  }
  if (type === "application_verified_quote") {
    return maybeVariant({
      ok: true,
      subject: buildApplicationVerifiedQuoteSubject_(),
      body: buildApplicationVerifiedQuoteBody_(ctx)
    });
  }
  if (type === "application_final_reminder") {
    return maybeVariant({
      ok: true,
      subject: buildApplicationFinalReminderSubject_(),
      body: buildApplicationFinalReminderBody_(ctx)
    });
  }
  if (type === "application_exam_fee_reminder") {
    return maybeVariant({
      ok: true,
      subject: buildApplicationExamFeeReminderSubject_(),
      body: buildApplicationExamFeeReminderBody_(ctx)
    });
  }
  if (type === "prospect_general_guidance") {
    return maybeVariant({
      ok: true,
      subject: buildProspectGeneralGuidanceSubject_(),
      body: buildProspectGeneralGuidanceBody_(ctx)
    });
  }
  if (type === "application_receipt_request") {
    return maybeVariant({
      ok: true,
      subject: buildApplicationReceiptRequestSubject_(),
      body: buildApplicationReceiptRequestBody_(ctx)
    });
  }
  if (type === "contact_fallback_manual") {
    return maybeVariant({
      ok: true,
      subject: buildContactFallbackManualSubject_(),
      body: buildContactFallbackManualBody_(ctx)
    });
  }
  return { ok: false, code: "UNKNOWN_MESSAGE_TYPE", subject: "", body: "" };
}

function markApplicantEmailPipelineState_(context, state, extra) {
  var ctx = context || {};
  var more = extra && typeof extra === "object" ? extra : {};
  if (!ctx.sheet || !ctx.rowNumber) return false;
  var status = normalizeEmailStatus_(state || "");
  if (!status) return false;
  var nowIso = clean_(more.at || new Date().toISOString());
  var currentAttempt = campaignAttemptCount_(ctx.rowObj);
  var patch = {
    Email_Status: status,
    Email_Attempt_Count: Math.max(0, currentAttempt + (more.incrementAttempt === false ? 0 : 1))
  };
  if (status === "SEND_ATTEMPT" || status === "SENT") patch.Email_Last_Sent_At = nowIso;
  if (status === "FAILED" || status === "FALLBACK_PENDING") patch.Email_Next_Action_Date = nowIso;
  applyPatch_(ctx.sheet, ctx.rowNumber, patch);
  try {
    if (ctx.rowObj && typeof ctx.rowObj === "object") {
      ctx.rowObj.Email_Status = status;
      ctx.rowObj.Email_Attempt_Count = patch.Email_Attempt_Count;
      if (patch.Email_Last_Sent_At) ctx.rowObj.Email_Last_Sent_At = patch.Email_Last_Sent_At;
      if (patch.Email_Next_Action_Date) ctx.rowObj.Email_Next_Action_Date = patch.Email_Next_Action_Date;
    }
  } catch (_rowMirrorErr) {}
  return true;
}

function computeEmailIdempotencyKey_(context, opts) {
  var ctx = context && typeof context === "object" ? context : {};
  var options = opts && typeof opts === "object" ? opts : {};
  return buildSendIdempotencyKey_(ctx.rowObj || {}, clean_(ctx.messageType || options.messageType || ""), clean_(ctx.effectiveEmail || options.recipient || ""), {
    applicantId: clean_(ctx.applicantId || options.applicantId || ""),
    batchId: clean_(options.batchId || options.batchLabel || ctx.batchLabel || ""),
    batchLabel: clean_(options.batchLabel || ctx.batchLabel || ""),
    sendSource: clean_(options.sendSource || ctx.sendSource || ""),
    recipient: clean_(ctx.effectiveEmail || options.recipient || "")
  });
}

function wasEmailAlreadyProcessed_(context, idempotencyKey) {
  var ctx = context && typeof context === "object" ? context : {};
  var messageType = clean_(ctx.messageType || "").toLowerCase();
  var row = ctx.rowObj || {};
  var emailStatus = clean_(row.Email_Status || ctx.emailStatus || "").toUpperCase();
  var lastContactType = clean_(row.Last_Contact_Type || "").toLowerCase();
  var lastContactResult = clean_(row.Last_Contact_Result || "").toUpperCase();
  var lastContactBatch = clean_(row.Last_Contact_Batch || "");
  var batchId = clean_(ctx.batchLabel || "");
  var durableMatch = !!(messageType && lastContactType === messageType && lastContactResult === "SENT");
  if (messageType !== "fd_acknowledgement" && batchId && lastContactBatch && batchId !== lastContactBatch) durableMatch = false;
  var legacyInviteSent = isPortalCommunicationMessageType_(messageType) && emailStatus === "SENT";
  var cacheState = getCommunicationCooldownState_(ctx.applicantId || "", messageType);
  var cacheMatch = !!(cacheState && clean_(cacheState.idempotencyKey || "") === clean_(idempotencyKey || ""));
  return {
    ok: true,
    alreadyProcessed: durableMatch || legacyInviteSent || cacheMatch,
    durableMatch: durableMatch,
    legacyInviteSent: legacyInviteSent,
    cacheMatch: cacheMatch,
    idempotencyKey: clean_(idempotencyKey || "")
  };
}

function recordEmailProcessingResult_(context, idempotencyKey, result) {
  var ctx = context && typeof context === "object" ? context : {};
  var res = result && typeof result === "object" ? result : {};
  var label = clean_(res.label || "EMAIL_PROCESSING_RESULT");
  logOperationalBlock_(label, {
    applicantId: clean_(ctx.applicantId || ""),
    messageType: clean_(ctx.messageType || ""),
    batchLabel: clean_(ctx.batchLabel || ""),
    idempotencyKey: clean_(idempotencyKey || ""),
    result: clean_(res.result || ""),
    blockCode: clean_(res.blockCode || ""),
    dryRun: res.dryRun === true
  });
}

function countEmailRecipients_(email) {
  var raw = String(email || "");
  return raw.split(/[;,]/).map(function (part) { return clean_(part || ""); }).filter(function (part) { return !!part; }).length;
}

function logManualSendProbe_(label, context, idempotencyKey, payload) {
  var ctx = context && typeof context === "object" ? context : {};
  var data = payload && typeof payload === "object" ? payload : {};
  logOperationalBlock_(label, Object.assign({
    runtimeVersion: clean_(CONFIG.VERSION || ""),
    deployVersion: Number(CONFIG.DEPLOY_VERSION_NUMBER || 0),
    applicantId: clean_(ctx.applicantId || data.applicantId || ""),
    idempotencyKey: clean_(idempotencyKey || data.idempotencyKey || ""),
    sendDecision: clean_(data.sendDecision || ""),
    result: clean_(data.result || "")
  }, data));
}

function dispatchApplicantMessage_(context, builtMessage, opts) {
  var ctx = context || {};
  var message = builtMessage || {};
  var options = opts && typeof opts === "object" ? opts : {};
  var actorEmail = clean_(options.actorEmail || ctx.actorEmail || (typeof getCallerEmail_ === "function" ? getCallerEmail_() : "") || "");
  var manualProbe = options.manualSingleSendProbe === true;
  if (!manualProbe && (isSystemStabilizationModeActive_() || CONFIG.ENABLE_PRODUCTION_EMAIL_SENDS !== true)) {
    var dispatchBlockCode = isSystemStabilizationModeActive_() ? "SYSTEM_STABILIZATION_MODE_ACTIVE" : "PRODUCTION_EMAIL_SENDS_DISABLED";
    if (isSystemStabilizationModeActive_()) logOperationalBlock_("SYSTEM_STABILIZATION_MODE_ACTIVE", {
      action: "dispatch_applicant_message",
      applicantId: clean_(ctx.applicantId || ""),
      messageType: clean_(ctx.messageType || ""),
      debugId: clean_(ctx.debugId || options.debugId || "")
    });
    logOperationalBlock_("EMAIL_SEND_BLOCKED", {
      action: "dispatch_applicant_message",
      blockCode: dispatchBlockCode,
      applicantId: clean_(ctx.applicantId || ""),
      messageType: clean_(ctx.messageType || ""),
      actorEmail: actorEmail,
      debugId: clean_(ctx.debugId || options.debugId || "")
    });
    return {
      ok: false,
      result: "BLOCKED",
      code: dispatchBlockCode,
      blockCode: dispatchBlockCode,
      applicantId: clean_(ctx.applicantId || ""),
      messageType: clean_(ctx.messageType || ""),
      effectiveEmail: clean_(ctx.effectiveEmail || ""),
      subject: clean_(message.subject || ""),
      debugId: clean_(ctx.debugId || options.debugId || newDebugId_())
    };
  }
  if (manualProbe && isManualSingleSendProbeEnabled_() !== true) {
    logManualSendProbe_("MANUAL_SEND_PROBE_BLOCKED", ctx, "", {
      sendDecision: "BLOCK",
      result: "BLOCKED",
      blockCode: "MANUAL_SINGLE_SENDS_DISABLED"
    });
    return {
      ok: false,
      result: "BLOCKED",
      blockCode: "MANUAL_SINGLE_SENDS_DISABLED",
      blockReason: "Manual single-send probe is disabled.",
      applicantId: clean_(ctx.applicantId || ""),
      messageType: clean_(ctx.messageType || ""),
      effectiveEmail: clean_(ctx.effectiveEmail || ""),
      debugId: clean_(ctx.debugId || options.debugId || newDebugId_())
    };
  }
  if (!ctx.eligible) {
    return {
      ok: false,
      result: "BLOCKED",
      blockCode: clean_(ctx.blockCode || ""),
      blockReason: clean_(ctx.blockReason || ""),
      applicantId: clean_(ctx.applicantId || ""),
      messageType: clean_(ctx.messageType || ""),
      debugId: clean_(ctx.debugId || options.debugId || newDebugId_())
    };
  }
  if (!clean_(message.subject || "") || !clean_(message.body || "") || !clean_(ctx.effectiveEmail || "") || !ctx.sheet || !ctx.rowNumber) {
    recordApplicantContactOutcome_(ctx, "FAILED", {
      actorEmail: actorEmail,
      batchLabel: clean_(options.batchLabel || ctx.batchLabel || ""),
      subject: clean_(message.subject || "")
    });
    return {
      ok: false,
      result: "FAILED",
      code: "DISPATCH_INVALID",
      applicantId: clean_(ctx.applicantId || ""),
      messageType: clean_(ctx.messageType || ""),
      effectiveEmail: clean_(ctx.effectiveEmail || ""),
      debugId: clean_(ctx.debugId || options.debugId || newDebugId_())
    };
  }
  var idempotencyKey = computeEmailIdempotencyKey_(ctx, options);
  if (manualProbe) {
    var recipientCount = countEmailRecipients_(ctx.effectiveEmail);
    logManualSendProbe_("MANUAL_SEND_PROBE_BEGIN", ctx, idempotencyKey, {
      sendDecision: "EVALUATE",
      result: "BEGIN",
      recipientCount: recipientCount,
      cooldownSource: "CacheService.getScriptCache"
    });
    if (recipientCount !== 1) {
      logManualSendProbe_("MANUAL_SEND_PROBE_BLOCKED", ctx, idempotencyKey, {
        sendDecision: "BLOCK",
        result: "BLOCKED",
        blockCode: "INVALID_RECIPIENT_COUNT",
        recipientCount: recipientCount
      });
      return {
        ok: false,
        result: "BLOCKED",
        blockCode: "INVALID_RECIPIENT_COUNT",
        blockReason: "Manual probe requires exactly one recipient.",
        applicantId: clean_(ctx.applicantId || ""),
        messageType: clean_(ctx.messageType || ""),
        effectiveEmail: clean_(ctx.effectiveEmail || ""),
        debugId: clean_(ctx.debugId || options.debugId || newDebugId_())
      };
    }
  }
  var dispatchMessageType = clean_(ctx.messageType || "").toLowerCase();
  var processed = wasEmailAlreadyProcessed_(ctx, idempotencyKey);
  if (processed.alreadyProcessed) {
    if (manualProbe) {
      logManualSendProbe_("MANUAL_SEND_PROBE_REPLAY_BLOCK", ctx, idempotencyKey, {
        sendDecision: "BLOCK",
        result: "BLOCKED",
        blockCode: "ALREADY_PROCESSED",
        durableMatch: processed.durableMatch === true,
        cacheMatch: processed.cacheMatch === true,
        legacyInviteSent: processed.legacyInviteSent === true
      });
      setManualSendProbeStatus_({
        applicantId: clean_(ctx.applicantId || ""),
        messageType: clean_(ctx.messageType || ""),
        recipient: clean_(ctx.effectiveEmail || ""),
        result: "BLOCKED",
        blockCode: "ALREADY_PROCESSED",
        sentAt: new Date().toISOString(),
        idempotencyKey: idempotencyKey
      });
    }
    recordEmailProcessingResult_(ctx, idempotencyKey, {
      label: "EMAIL_IDEMPOTENCY_SUPPRESSED",
      result: "BLOCKED",
      blockCode: "ALREADY_PROCESSED"
    });
    if (dispatchMessageType === "fd_acknowledgement") {
      recordApplicantContactOutcome_(ctx, "DUPLICATE", {
        actorEmail: actorEmail,
        batchLabel: clean_(options.batchLabel || ctx.batchLabel || ""),
        subject: "Duplicate fd_acknowledgement suppressed"
      });
      return {
        ok: true,
        result: "DUPLICATE",
        blockCode: "ALREADY_PROCESSED",
        blockReason: "Duplicate fd_acknowledgement suppressed.",
        applicantId: clean_(ctx.applicantId || ""),
        messageType: clean_(ctx.messageType || ""),
        effectiveEmail: clean_(ctx.effectiveEmail || ""),
        subject: clean_(message.subject || ""),
        debugId: clean_(ctx.debugId || options.debugId || newDebugId_())
      };
    }
    markApplicantEmailPipelineState_(ctx, "SUPPRESSED", {
      incrementAttempt: false
    });
    recordApplicantContactOutcome_(ctx, "SUPPRESSED", {
      actorEmail: actorEmail,
      batchLabel: clean_(options.batchLabel || ctx.batchLabel || ""),
      subject: clean_(message.subject || "")
    });
    return {
      ok: false,
      result: "BLOCKED",
      blockCode: "ALREADY_PROCESSED",
      blockReason: "This email action has already been processed for the current durable state.",
      applicantId: clean_(ctx.applicantId || ""),
      messageType: clean_(ctx.messageType || ""),
      effectiveEmail: clean_(ctx.effectiveEmail || ""),
      subject: clean_(message.subject || ""),
      debugId: clean_(ctx.debugId || options.debugId || newDebugId_())
    };
  }
  var requestId = clean_(ctx.debugId || options.debugId || newDebugId_());
  var batchId = clean_(options.batchLabel || ctx.batchLabel || "");
  markApplicantEmailPipelineState_(ctx, "SEND_ATTEMPT", {
    incrementAttempt: true
  });
  recordApplicantContactOutcome_(ctx, "SEND_ATTEMPT", {
    actorEmail: actorEmail,
    batchLabel: clean_(options.batchLabel || ctx.batchLabel || ""),
    subject: clean_(message.subject || "")
  });
  var sendRes = campaignSendEmailGmail_(ctx.effectiveEmail, message.subject, message.body, {
    applicantId: clean_(ctx.applicantId || ""),
    requestId: requestId,
    batchId: batchId,
    batchLabel: batchId,
    manualSingleSendProbe: manualProbe,
    templateType: clean_(ctx.messageType || ""),
    sendSource: clean_(options.sendSource || ctx.sendSource || ""),
    unattended: options.unattended === true || ctx.unattended === true,
    limit: Number(options.limit || 0) || 1,
    processorSource: clean_(options.processorSource || ctx.processorSource || ""),
    processorScope: clean_(options.processorScope || ctx.processorScope || ""),
    duplicateGuardPassed: true,
    rowObj: ctx.rowObj && typeof ctx.rowObj === "object" ? ctx.rowObj : {}
    ,
    cc: clean_(options.cc || ""),
    bcc: clean_(options.bcc || "")
  });
  if (!sendRes.ok) {
    if (manualProbe) {
      logManualSendProbe_("MANUAL_SEND_PROBE_RESULT", ctx, idempotencyKey, {
        sendDecision: "SEND",
        result: "FAILED",
        blockCode: clean_(sendRes.error || "SEND_FAILED")
      });
      setManualSendProbeStatus_({
        applicantId: clean_(ctx.applicantId || ""),
        messageType: clean_(ctx.messageType || ""),
        recipient: clean_(ctx.effectiveEmail || ""),
        result: "FAILED",
        blockCode: clean_(sendRes.error || "SEND_FAILED"),
        sentAt: new Date().toISOString(),
        idempotencyKey: idempotencyKey
      });
    }
    recordApplicantContactOutcome_(ctx, "FAILED", {
      actorEmail: actorEmail,
      batchLabel: clean_(options.batchLabel || ctx.batchLabel || ""),
      subject: clean_(message.subject || "")
    });
    markApplicantEmailPipelineState_(ctx, "FALLBACK_PENDING", {
      incrementAttempt: false
    });
    return {
      ok: false,
      result: "FAILED",
      code: "SEND_FAILED",
      error: clean_(sendRes.error || "SEND_FAILED"),
      gmailAttempted: true,
      gmailAccepted: false,
      rowPatchConfirmed: false,
      communicationRecorded: false,
      applicantId: clean_(ctx.applicantId || ""),
      messageType: clean_(ctx.messageType || ""),
      effectiveEmail: clean_(ctx.effectiveEmail || ""),
      subject: clean_(message.subject || ""),
      debugId: requestId
    };
  }
  try {
    var now = new Date();
    var nextAttempt = Math.max(1, campaignAttemptCount_(ctx.rowObj));
    var patch = {
      Email_Status: "SENT",
      Email_Last_Sent_At: now.toISOString(),
      Email_Attempt_Count: nextAttempt,
      Email_Next_Action_Date: computeNextActionDate_(nextAttempt, now)
    };
    if (clean_(options.batchLabel || ctx.batchLabel || "")) patch.Email_Campaign_Batch = clean_(options.batchLabel || ctx.batchLabel || "");
    campaignLog_("GMAIL_PATCH_BEGIN", {
      applicantId: clean_(ctx.applicantId || ""),
      recipient: clean_(ctx.effectiveEmail || ""),
      alias: clean_(sendRes.from || ""),
      requestId: requestId,
      batchId: batchId
    });
    applyPatch_(ctx.sheet, ctx.rowNumber, patch);
    campaignLog_("GMAIL_PATCH_END", {
      applicantId: clean_(ctx.applicantId || ""),
      recipient: clean_(ctx.effectiveEmail || ""),
      alias: clean_(sendRes.from || ""),
      requestId: requestId,
      batchId: batchId
    });
    setCommunicationCooldownState_(ctx.applicantId, ctx.messageType, {
      sentAt: now.toISOString(),
      source: "email_dispatch",
      idempotencyKey: idempotencyKey,
      batchLabel: batchId,
      result: "SENT"
    }, Math.ceil(communicationCooldownMs_() / 1000));
    recordEmailProcessingResult_(ctx, idempotencyKey, {
      label: "EMAIL_PROCESSING_RESULT",
      result: "SENT"
    });
    if (manualProbe) {
      logManualSendProbe_("MANUAL_SEND_PROBE_RESULT", ctx, idempotencyKey, {
        sendDecision: "SEND",
        result: "SENT",
        recipientCount: 1,
        cooldownSource: "CacheService.getScriptCache"
      });
      setManualSendProbeStatus_({
        applicantId: clean_(ctx.applicantId || ""),
        messageType: clean_(ctx.messageType || ""),
        recipient: clean_(ctx.effectiveEmail || ""),
        result: "SENT",
        blockCode: "",
        sentAt: now.toISOString(),
        idempotencyKey: idempotencyKey
      });
    }
    recordApplicantContactOutcome_(ctx, "SENT", {
      actorEmail: actorEmail,
      batchLabel: clean_(options.batchLabel || ctx.batchLabel || ""),
      subject: clean_(message.subject || ""),
      sentAt: now.toISOString()
    });
    return {
      ok: true,
      eligible: true,
      result: "SENT",
      gmailAttempted: true,
      gmailAccepted: true,
      rowPatchConfirmed: true,
      communicationRecorded: true,
      applicantId: clean_(ctx.applicantId || ""),
      messageType: clean_(ctx.messageType || ""),
      effectiveEmail: clean_(ctx.effectiveEmail || ""),
      subject: clean_(message.subject || ""),
      cc: clean_(options.cc || ""),
      bcc: clean_(options.bcc || ""),
      sentAt: now.toISOString(),
      rowNumber: Number(ctx.rowNumber || 0),
      debugId: clean_(ctx.debugId || options.debugId || newDebugId_()),
      blockCode: "",
      blockReason: ""
    };
  } catch (postSendErr) {
    recordEmailProcessingResult_(ctx, idempotencyKey, {
      label: "EMAIL_RECONCILIATION_REQUIRED",
      result: "RECONCILIATION_REQUIRED",
      blockCode: "POST_SEND_PERSISTENCE_INCOMPLETE"
    });
    return {
      ok: false,
      eligible: true,
      result: "RECONCILIATION_REQUIRED",
      code: "POST_SEND_PERSISTENCE_INCOMPLETE",
      error: clean_(postSendErr && postSendErr.message || postSendErr || ""),
      gmailAttempted: true,
      gmailAccepted: true,
      rowPatchConfirmed: false,
      communicationRecorded: false,
      applicantId: clean_(ctx.applicantId || ""),
      messageType: clean_(ctx.messageType || ""),
      effectiveEmail: clean_(ctx.effectiveEmail || ""),
      subject: clean_(message.subject || ""),
      debugId: requestId,
      blockCode: "POST_SEND_PERSISTENCE_INCOMPLETE",
      blockReason: "Gmail accepted the message but durable row or communication evidence was not fully confirmed."
    };
  }
}

function automatedStageRunnerDailyPrefix_() {
  return clean_(CONFIG.SCRIPT_PROP_AUTOSEND_DAILY_PREFIX || "FODE_AUTOSEND_DAILY::");
}

function automatedStageRunnerLastRunKey_() {
  return clean_(CONFIG.SCRIPT_PROP_AUTOSEND_LAST_RUN || "FODE_AUTOSEND_LAST_RUN");
}

function automatedStageRunnerLastResultKey_() {
  return clean_(CONFIG.SCRIPT_PROP_AUTOSEND_LAST_RESULT || "FODE_AUTOSEND_LAST_RESULT");
}

function readAutomatedStageRunnerLastResult_() {
  try {
    var raw = clean_(PropertiesService.getScriptProperties().getProperty(automatedStageRunnerLastResultKey_()) || "");
    return raw ? JSON.parse(raw) : null;
  } catch (_err) {
    return null;
  }
}

function automatedStageRunnerDateKey_(dateValue) {
  var dt = dateValue instanceof Date ? new Date(dateValue.getTime()) : new Date(dateValue || new Date());
  var tz = "GMT";
  try {
    tz = Session.getScriptTimeZone() || "GMT";
  } catch (_err) {}
  return Utilities.formatDate(dt, tz, "yyyy-MM-dd");
}

function automatedStageRunnerCounterKey_(dateValue) {
  return automatedStageRunnerDailyPrefix_() + automatedStageRunnerDateKey_(dateValue);
}

function readAutomatedStageRunnerDailyCount_(dateValue) {
  var key = automatedStageRunnerCounterKey_(dateValue);
  var raw = "";
  try {
    raw = clean_(PropertiesService.getScriptProperties().getProperty(key) || "");
  } catch (_err) {
    raw = "";
  }
  var parsed = Math.max(0, Math.floor(Number(raw || 0)));
  return {
    key: key,
    used: parsed
  };
}

function getRemainingDailySendAllowance_(dateValue) {
  var cap = Math.max(0, Math.floor(Number(CONFIG.AUTOMATED_STAGE_DAILY_CAP || CONFIG.DAILY_SEND_CAP || 0)));
  var current = readAutomatedStageRunnerDailyCount_(dateValue);
  return {
    key: current.key,
    cap: cap,
    used: current.used,
    remaining: Math.max(0, cap - current.used)
  };
}

function incrementDailySendCount_(count, dateValue) {
  var delta = Math.max(0, Math.floor(Number(count || 0)));
  var current = readAutomatedStageRunnerDailyCount_(dateValue);
  var used = current.used + delta;
  PropertiesService.getScriptProperties().setProperty(current.key, String(used));
  var cap = Math.max(0, Math.floor(Number(CONFIG.AUTOMATED_STAGE_DAILY_CAP || CONFIG.DAILY_SEND_CAP || 0)));
  return {
    key: current.key,
    used: used,
    cap: cap,
    remaining: Math.max(0, cap - used)
  };
}

function automatedStageRunnerLog_(eventName, payload) {
  var event = clean_(eventName || "");
  var data = payload && typeof payload === "object" ? payload : {};
  try {
    console.log(event, JSON.stringify(data));
  } catch (_err) {}
  try {
    campaignLog_(event, data);
  } catch (_err2) {}
}

function automatedStageRunnerActor_() {
  var email = clean_((CONFIG.SUPER_ADMIN_EMAILS && CONFIG.SUPER_ADMIN_EMAILS[0]) || (CONFIG.ADMIN_EMAILS && CONFIG.ADMIN_EMAILS[0]) || "").toLowerCase();
  var role = email && typeof getAdminRole_ === "function" ? clean_(getAdminRole_(email) || "") : "";
  if (!role) role = email && CONFIG.ADMIN_ROLES ? clean_(CONFIG.ADMIN_ROLES[email] || "") : "";
  role = String(role || (email ? "SUPER" : "")).toUpperCase();
  var isAdmin = false;
  if (email && typeof isAdmin_ === "function") isAdmin = isAdmin_(email);
  return {
    actorEmail: email,
    actorRole: role,
    isAdmin: !!isAdmin,
    isSuper: role === "SUPER"
  };
}

function shouldRunAutomatedStageBatch_() {
  var enabled = CONFIG.ENABLE_AUTOMATED_STAGE_RUNNER === true;
  var stage = typeof normalizeStageBatchStage_ === "function"
    ? normalizeStageBatchStage_(CONFIG.AUTOMATED_STAGE_RUNNER_STAGE || "")
    : clean_(CONFIG.AUTOMATED_STAGE_RUNNER_STAGE || "").toUpperCase();
  var messageType = typeof getBatchMessageTypeForStage_ === "function" ? clean_(getBatchMessageTypeForStage_(stage) || "") : "";
  var configuredBatchSize = Math.max(1, Math.floor(Number(CONFIG.AUTOMATED_STAGE_BATCH_SIZE || CONFIG.DEFAULT_STAGE_BATCH_SIZE || CONFIG.PER_RUN_BATCH_SIZE || 20)));
  var maxPerRun = Math.max(1, Math.floor(Number(CONFIG.MAX_PER_RUN_BATCH_SIZE || CONFIG.MAX_STAGE_BATCH_SIZE || configuredBatchSize || 30)));
  var stageMax = Math.max(1, Math.floor(Number(CONFIG.MAX_STAGE_BATCH_SIZE || maxPerRun || 25)));
  var safeMax = Math.max(1, Math.min(maxPerRun, stageMax));
  return {
    enabled: enabled,
    ok: enabled && !!stage && !!messageType,
    stage: stage,
    messageType: messageType,
    perRunBatchSize: Math.max(1, Math.min(configuredBatchSize, safeMax)),
    maxPerRunBatchSize: safeMax,
    reason: !enabled ? "AUTOMATION_DISABLED" : (!stage ? "UNSUPPORTED_STAGE" : (!messageType ? "STAGE_NOT_SENDABLE" : ""))
  };
}

function automatedStageRunnerTimeoutLimitMs_() {
  var configured = Math.floor(Number(CONFIG.AUTOMATED_STAGE_TIMEOUT_MS || 0));
  if (configured > 0) return Math.max(1000, Math.min(configured, 295000));
  return 270000;
}

function automatedStageRunnerFinalize_(summary) {
  var out = summary && typeof summary === "object" ? summary : {};
  var nowIso = new Date().toISOString();
  out.writtenAt = clean_(out.writtenAt || nowIso);
  var previous = readAutomatedStageRunnerLastResult_();
  var failed = out.ok === false || clean_(out.result || "").toUpperCase() === "ERROR";
  var previousFailures = Number(previous && previous.consecutiveFailures || 0);
  out.lastSuccessfulRun = failed ? clean_(previous && previous.lastSuccessfulRun || "") : out.writtenAt;
  out.lastFailedRun = failed ? out.writtenAt : clean_(previous && previous.lastFailedRun || "");
  out.consecutiveFailures = failed ? previousFailures + 1 : 0;
  try {
    var props = PropertiesService.getScriptProperties();
    props.setProperty(automatedStageRunnerLastRunKey_(), out.writtenAt);
    props.setProperty(automatedStageRunnerLastResultKey_(), JSON.stringify(out));
  } catch (_err) {}
  try {
    campaignLog_("AUTOMATED_STAGE_RUNNER", out);
  } catch (_err2) {}
  return out;
}

function runAutomatedStageBatchChunk_(opts) {
  var options = opts && typeof opts === "object" ? opts : {};
  var now = new Date();
  var startedAtMs = now.getTime();
  var timeoutLimitMs = automatedStageRunnerTimeoutLimitMs_();
  var requestId = clean_(options.requestId || newDebugId_());
  var gate = shouldRunAutomatedStageBatch_();
  automatedStageRunnerLog_("AUTO_STAGE_RUN_START", {
    requestId: requestId,
    source: clean_(options.source || "MANUAL"),
    enabled: gate.enabled === true,
    stage: clean_(gate.stage || ""),
    messageType: clean_(gate.messageType || ""),
    batchSize: Number(gate.perRunBatchSize || 0),
    dailyCap: Math.max(0, Math.floor(Number(CONFIG.AUTOMATED_STAGE_DAILY_CAP || CONFIG.DAILY_SEND_CAP || 0))),
    timeoutLimitMs: timeoutLimitMs
  });
  if (!gate.enabled && options.force !== true) {
    return automatedStageRunnerFinalize_({
      ok: true,
      action: "automated_stage_batch",
      result: "SKIPPED",
      reason: gate.reason || "AUTOMATION_DISABLED",
      requestId: requestId,
      stage: clean_(gate.stage || ""),
      messageType: clean_(gate.messageType || ""),
      source: clean_(options.source || "MANUAL")
    });
  }
  if (!gate.stage || !gate.messageType) {
    return automatedStageRunnerFinalize_({
      ok: false,
      action: "automated_stage_batch",
      result: "ERROR",
      reason: gate.reason || "UNSUPPORTED_STAGE",
      requestId: requestId,
      stage: clean_(gate.stage || ""),
      messageType: clean_(gate.messageType || ""),
      source: clean_(options.source || "MANUAL")
    });
  }
  var allowance = getRemainingDailySendAllowance_(now);
  if (!(allowance.remaining > 0)) {
    automatedStageRunnerLog_("AUTO_STAGE_CAP_REACHED", {
      requestId: requestId,
      stage: gate.stage,
      dailyCap: allowance.cap,
      sentToday: allowance.used,
      remainingDailyAllowance: allowance.remaining
    });
    return automatedStageRunnerFinalize_({
      ok: true,
      action: "automated_stage_batch",
      result: "SKIPPED",
      reason: "DAILY_CAP_REACHED",
      requestId: requestId,
      stage: gate.stage,
      messageType: gate.messageType,
      source: clean_(options.source || "MANUAL"),
      dailyCap: allowance.cap,
      dailyUsed: allowance.used,
      remainingDailyAllowance: allowance.remaining
    });
  }
  var effectiveRunSize = Math.max(0, Math.min(gate.perRunBatchSize, gate.maxPerRunBatchSize, allowance.remaining));
  if (!(effectiveRunSize > 0)) {
    return automatedStageRunnerFinalize_({
      ok: true,
      action: "automated_stage_batch",
      result: "SKIPPED",
      reason: "NO_RUN_ALLOWANCE",
      requestId: requestId,
      stage: gate.stage,
      messageType: gate.messageType,
      source: clean_(options.source || "MANUAL"),
      dailyCap: allowance.cap,
      dailyUsed: allowance.used,
      remainingDailyAllowance: allowance.remaining
    });
  }
  var actor = automatedStageRunnerActor_();
  if (!actor.isAdmin) {
    return automatedStageRunnerFinalize_({
      ok: false,
      action: "automated_stage_batch",
      result: "ERROR",
      reason: "RUNNER_ACTOR_INVALID",
      requestId: requestId,
      stage: gate.stage,
      messageType: gate.messageType,
      source: clean_(options.source || "MANUAL")
    });
  }
  var bounceSummary = null;
  if (CONFIG.ENABLE_BOUNCE_INGESTION === true || options.forceBounceIngestion === true) {
    bounceSummary = ingestRecentBounces_({
      source: clean_(options.source || "MANUAL"),
      force: options.forceBounceIngestion === true
    });
  }
  var portalSecretLookup = null;
  if (typeof communicationRequiresPortalUrl_ === "function" && communicationRequiresPortalUrl_(gate.messageType) && typeof buildPortalSecretPreviewLookup_ === "function") {
    portalSecretLookup = buildPortalSecretPreviewLookup_();
  }
  var cooldownLookup = null;
  if (typeof buildCommunicationCooldownPreviewLookup_ === "function") {
    cooldownLookup = buildCommunicationCooldownPreviewLookup_(gate.messageType);
  }
  var cohort = collectStageBatchCohort_(gate.stage, effectiveRunSize, 0, {
    messageType: gate.messageType,
    actorEmail: actor.actorEmail,
    actorRole: actor.actorRole,
    debugId: requestId,
    requestId: requestId,
    portalSecretLookup: portalSecretLookup && portalSecretLookup.ok ? portalSecretLookup : null,
    cooldownLookup: cooldownLookup && cooldownLookup.ok ? cooldownLookup : null,
    previewEarlyStop: true,
    previewEligibleBuffer: 0
  });
  var elapsedAfterCollectMs = new Date().getTime() - startedAtMs;
  if (elapsedAfterCollectMs >= timeoutLimitMs) {
    automatedStageRunnerLog_("AUTO_STAGE_RUN_TIMEOUT_NEAR", {
      requestId: requestId,
      stage: gate.stage,
      messageType: gate.messageType,
      attempted: 0,
      sent: 0,
      elapsedMs: elapsedAfterCollectMs,
      timeoutLimitMs: timeoutLimitMs,
      phase: "COLLECT"
    });
    return automatedStageRunnerFinalize_({
      ok: true,
      action: "automated_stage_batch",
      result: "PARTIAL_TIMEOUT",
      reason: "TIMEOUT_NEAR",
      requestId: requestId,
      stage: gate.stage,
      messageType: gate.messageType,
      source: clean_(options.source || "MANUAL"),
      dailyCap: allowance.cap,
      dailyUsedBefore: allowance.used,
      dailyUsedAfter: allowance.used,
      remainingDailyAllowanceBefore: allowance.remaining,
      remainingDailyAllowanceAfter: allowance.remaining,
      effectiveRunSize: effectiveRunSize,
      totalInStage: Number(cohort && cohort.totalInStage || 0),
      eligibleUnsentFound: Number(cohort && cohort.eligibleUnsentTotal || 0),
      attempted: 0,
      sent: 0,
      blocked: 0,
      failed: 0,
      processedCount: 0,
      remainingEligibleEstimate: Number(cohort && cohort.eligibleUnsentTotal || 0),
      bounceSummary: bounceSummary,
      timedOutNearLimit: true,
      timeoutLimitMs: timeoutLimitMs,
      elapsedMs: elapsedAfterCollectMs,
      message: "Automated chunk stopped before Apps Script timeout. Next run can continue from row truth."
    });
  }
  var candidates = Array.isArray(cohort && cohort.candidates) ? cohort.candidates : [];
  if (!candidates.length) {
    automatedStageRunnerLog_("AUTO_STAGE_NO_ELIGIBLE", {
      requestId: requestId,
      stage: gate.stage,
      messageType: gate.messageType,
      reason: clean_(cohort && cohort.emptyReason || "NO_ELIGIBLE_ROWS"),
      dailyCap: allowance.cap,
      sentToday: allowance.used,
      batchSize: effectiveRunSize
    });
    return automatedStageRunnerFinalize_({
      ok: true,
      action: "automated_stage_batch",
      result: "EMPTY",
      reason: clean_(cohort && cohort.emptyReason || "NO_ELIGIBLE_ROWS"),
      requestId: requestId,
      stage: gate.stage,
      messageType: gate.messageType,
      source: clean_(options.source || "MANUAL"),
      dailyCap: allowance.cap,
      dailyUsed: allowance.used,
      remainingDailyAllowance: allowance.remaining,
      effectiveRunSize: effectiveRunSize,
      totalInStage: Number(cohort && cohort.totalInStage || 0),
      eligibleUnsentFound: Number(cohort && cohort.eligibleUnsentTotal || 0),
      bounceSummary: bounceSummary
    });
  }
  var out = {
    ok: true,
    action: "automated_stage_batch",
    result: "COMPLETE",
    reason: "",
    requestId: requestId,
    stage: gate.stage,
    messageType: gate.messageType,
    source: clean_(options.source || "MANUAL"),
    triggerCadenceMinutes: 10,
    dailyCap: allowance.cap,
    dailyUsedBefore: allowance.used,
    remainingDailyAllowanceBefore: allowance.remaining,
    effectiveRunSize: effectiveRunSize,
    totalInStage: Number(cohort && cohort.totalInStage || 0),
    eligibleUnsentFound: Number(cohort && cohort.eligibleUnsentTotal || 0),
    attempted: 0,
    sent: 0,
    blocked: 0,
    failed: 0,
    blockedByReason: {},
    sentApplicantIdsSample: [],
    bounceSummary: bounceSummary,
    timedOutNearLimit: false,
    timeoutLimitMs: timeoutLimitMs,
    elapsedMs: 0
  };
  var batchLabel = "STAGE_SEND::" + gate.stage + "::" + requestId;
  var dailyAfter = allowance;
  function finishAutomatedStageRunnerOut_(result, reason) {
    out.result = clean_(result || out.result || "COMPLETE");
    out.reason = clean_(reason || out.reason || "");
    out.dailyUsedAfter = Number(dailyAfter.used || allowance.used || 0);
    out.remainingDailyAllowanceAfter = Number(dailyAfter.remaining != null ? dailyAfter.remaining : allowance.remaining);
    out.processedCount = Number(out.attempted || 0);
    out.remainingEligibleEstimate = Math.max(0, Number(cohort && cohort.eligibleUnsentTotal || 0) - out.processedCount);
    out.elapsedMs = new Date().getTime() - startedAtMs;
    if (out.result === "PARTIAL_TIMEOUT") {
      out.message = "Automated chunk stopped before Apps Script timeout. Next run can continue from row truth.";
    } else {
      out.message = out.remainingEligibleEstimate > 0
        ? "Automated chunk completed safely. Next trigger run can continue from row truth."
        : "Automated chunk completed safely.";
    }
    automatedStageRunnerLog_("AUTO_STAGE_BATCH_SENT", {
      requestId: requestId,
      stage: gate.stage,
      messageType: gate.messageType,
      attempted: out.attempted,
      sent: out.sent,
      blocked: out.blocked,
      failed: out.failed,
      dailyUsedBefore: out.dailyUsedBefore,
      dailyUsedAfter: out.dailyUsedAfter,
      batchSize: effectiveRunSize,
      dailyCap: allowance.cap,
      result: out.result,
      elapsedMs: out.elapsedMs
    });
    return automatedStageRunnerFinalize_(out);
  }
  for (var i = 0; i < candidates.length; i++) {
    var elapsedBeforeSendMs = new Date().getTime() - startedAtMs;
    if (elapsedBeforeSendMs >= timeoutLimitMs) {
      out.timedOutNearLimit = true;
      automatedStageRunnerLog_("AUTO_STAGE_RUN_TIMEOUT_NEAR", {
        requestId: requestId,
        stage: gate.stage,
        messageType: gate.messageType,
        attempted: out.attempted,
        sent: out.sent,
        elapsedMs: elapsedBeforeSendMs,
        timeoutLimitMs: timeoutLimitMs
      });
      return finishAutomatedStageRunnerOut_("PARTIAL_TIMEOUT", "TIMEOUT_NEAR");
    }
    var candidate = candidates[i] && typeof candidates[i] === "object" ? candidates[i] : {};
    var applicantId = clean_(candidate.applicantId || "");
    if (!applicantId) continue;
    out.attempted++;
    var sendResult = sendApplicantMessage_(applicantId, gate.messageType, {
      actorEmail: actor.actorEmail,
      actorRole: actor.actorRole,
      batchLabel: batchLabel,
      debugId: requestId,
      sendSource: "AUTOMATED_STAGE_RUNNER",
      unattended: true
    });
    var resultType = clean_(sendResult && sendResult.result || "").toUpperCase();
    if (resultType === "SENT") {
      out.sent++;
      pushStageBatchSample_(out.sentApplicantIdsSample, applicantId);
      dailyAfter = incrementDailySendCount_(1, now);
      if (!(Number(dailyAfter.remaining || 0) > 0)) {
        out.reason = "DAILY_CAP_REACHED";
        break;
      }
    } else if (resultType === "BLOCKED") {
      out.blocked++;
      incrementStageBatchReason_(out.blockedByReason, sendResult && (sendResult.blockCode || sendResult.code || "BLOCKED"));
    } else {
      out.failed++;
    }
    var elapsedAfterSendMs = new Date().getTime() - startedAtMs;
    if (elapsedAfterSendMs >= timeoutLimitMs && i < candidates.length - 1) {
      out.timedOutNearLimit = true;
      automatedStageRunnerLog_("AUTO_STAGE_RUN_TIMEOUT_NEAR", {
        requestId: requestId,
        stage: gate.stage,
        messageType: gate.messageType,
        attempted: out.attempted,
        sent: out.sent,
        elapsedMs: elapsedAfterSendMs,
        timeoutLimitMs: timeoutLimitMs,
        phase: "SEND"
      });
      return finishAutomatedStageRunnerOut_("PARTIAL_TIMEOUT", "TIMEOUT_NEAR");
    }
  }
  return finishAutomatedStageRunnerOut_("COMPLETE", out.reason);
}

function runAutomatedStageBatchWithLock_(opts) {
  var options = opts && typeof opts === "object" ? opts : {};
  var requestId = clean_(options.requestId || newDebugId_());
  var source = clean_(options.source || "MANUAL");
  if (isSystemStabilizationModeActive_() || CONFIG.ENABLE_AUTOMATED_STAGE_RUNNER !== true || CONFIG.ENABLE_TRIGGER_EMAIL_SENDS !== true) {
    var reason = isSystemStabilizationModeActive_()
      ? "SYSTEM_STABILIZATION_MODE_ACTIVE"
      : (CONFIG.ENABLE_AUTOMATED_STAGE_RUNNER !== true ? "AUTO_STAGE_DISABLED" : "AUTO_STAGE_SENDS_DISABLED");
    if (isSystemStabilizationModeActive_()) logOperationalBlock_("SYSTEM_STABILIZATION_MODE_ACTIVE", { action: "automated_stage_batch", requestId: requestId, source: source });
    if (CONFIG.ENABLE_AUTOMATED_STAGE_RUNNER !== true) logOperationalBlock_("AUTO_STAGE_DISABLED", { action: "automated_stage_batch", requestId: requestId, source: source });
    if (CONFIG.ENABLE_TRIGGER_EMAIL_SENDS !== true) logOperationalBlock_("AUTO_STAGE_SENDS_DISABLED", { action: "automated_stage_batch", requestId: requestId, source: source });
    if (source === "TRIGGER") logOperationalBlock_("TRIGGER_SEND_BLOCKED", { action: "automated_stage_batch", requestId: requestId, blockCode: reason });
    logOperationalBlock_("AUTO_STAGE_SAFE_NOOP", { action: "automated_stage_batch", requestId: requestId, source: source, blockCode: reason });
    return {
      ok: true,
      action: "automated_stage_batch",
      result: "SKIPPED",
      reason: reason,
      requestId: requestId,
      source: source,
      safeNoop: true,
      sheetMutations: 0,
      propertyMutations: 0,
      emailsSent: 0
    };
  }
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(1000)) {
    return automatedStageRunnerFinalize_({
      ok: true,
      action: "automated_stage_batch",
      result: "SKIPPED",
      reason: "LOCK_UNAVAILABLE",
      requestId: requestId,
      stage: clean_(CONFIG.AUTOMATED_STAGE_RUNNER_STAGE || ""),
      source: clean_(options.source || "MANUAL")
    });
  }
  try {
    return runAutomatedStageBatchChunk_(Object.assign({}, options, { requestId: requestId }));
  } catch (err) {
    automatedStageRunnerLog_("AUTO_STAGE_RUN_ERROR", {
      requestId: requestId,
      source: clean_(options.source || "MANUAL"),
      error: String((err && err.message) || err || "Unknown automation error")
    });
    return automatedStageRunnerFinalize_({
      ok: false,
      action: "automated_stage_batch",
      result: "ERROR",
      reason: "RUNNER_EXCEPTION",
      requestId: requestId,
      source: clean_(options.source || "MANUAL"),
      error: String((err && err.message) || err || "Unknown automation error")
    });
  } finally {
    try { lock.releaseLock(); } catch (_err) {}
  }
}

function automatedStageBatchRunner() {
  if (isSystemStabilizationModeActive_() || CONFIG.ENABLE_AUTOMATED_STAGE_RUNNER !== true || CONFIG.ENABLE_TRIGGER_EMAIL_SENDS !== true) {
    return runAutomatedStageBatchWithLock_({ source: "TRIGGER" });
  }
  return runAutomatedStageBatchWithLock_({ source: "TRIGGER" });
}

function stabilizationTriggerMutationBlocked_(fnName, action) {
  var functionName = clean_(fnName || getAutomatedStageRunnerTriggerFunctionName_() || "automatedStageBatchRunner");
  var actionName = clean_(action || "trigger_mutation");
  logOperationalBlock_("STABILIZATION_TRIGGER_BLOCK", {
    action: actionName,
    functionName: functionName
  });
  return {
    ok: false,
    created: false,
    removed: 0,
    functionName: functionName,
    triggerCount: null,
    removedDuplicates: 0,
    cadenceMinutes: 10,
    error: {
      code: "STABILIZATION_DISABLED",
      message: "Trigger mutation is disabled during stabilization."
    }
  };
}

function runAutomatedStageBatchScheduled() {
  return automatedStageRunnerFinalize_({
    ok: true,
    action: "automated_stage_batch",
    result: "SKIPPED",
    reason: "LEGACY_TRIGGER_FUNCTION_DISABLED",
    requestId: newDebugId_(),
    source: "LEGACY_TRIGGER"
  });
}

function getAutomatedStageRunnerTriggerFunctionName_() {
  return "automatedStageBatchRunner";
}

function inspectAutomatedStageRunnerTriggers_() {
  var fnName = getAutomatedStageRunnerTriggerFunctionName_();
  try {
    var triggers = ScriptApp.getProjectTriggers();
    var count = 0;
    for (var i = 0; i < triggers.length; i++) {
      if (clean_(triggers[i].getHandlerFunction() || "") === fnName) count++;
    }
    return {
      ok: true,
      functionName: fnName,
      triggerCount: count,
      error: null
    };
  } catch (err) {
    return {
      ok: false,
      functionName: fnName,
      triggerCount: null,
      error: {
        code: "TRIGGER_API_UNAVAILABLE",
        message: String((err && err.message) || err || "Trigger APIs are unavailable in this execution context.")
      }
    };
  }
}

function ensureAutomatedStageRunnerTrigger_() {
  var fnName = getAutomatedStageRunnerTriggerFunctionName_();
  return stabilizationTriggerMutationBlocked_(fnName, "ensure_automated_stage_runner_trigger");
}

function removeAutomatedStageRunnerTrigger_() {
  var fnName = getAutomatedStageRunnerTriggerFunctionName_();
  return stabilizationTriggerMutationBlocked_(fnName, "remove_automated_stage_runner_trigger");
}

function getAutomatedStageRunnerStatus_() {
  var fnName = getAutomatedStageRunnerTriggerFunctionName_();
  var today = readAutomatedStageRunnerDailyCount_(new Date());
  var gate = shouldRunAutomatedStageBatch_();
  var triggerInspection = inspectAutomatedStageRunnerTriggers_();
  var lastResult = readAutomatedStageRunnerLastResult_();
  return {
    ok: true,
    functionName: fnName,
    enabled: CONFIG.ENABLE_AUTOMATED_STAGE_RUNNER === true,
    dailyCap: Math.max(0, Math.floor(Number(CONFIG.AUTOMATED_STAGE_DAILY_CAP || CONFIG.DAILY_SEND_CAP || 0))),
    batchSize: Number(gate.perRunBatchSize || 0),
    sentToday: Number(today.used || 0),
    counterKey: today.key,
    triggerCount: triggerInspection.ok ? triggerInspection.triggerCount : null,
    triggerInspection: triggerInspection,
    lastRun: lastResult,
    timeoutLimitMs: automatedStageRunnerTimeoutLimitMs_(),
    version: clean_(CONFIG.VERSION || ""),
    deployVersion: Number(CONFIG.DEPLOY_VERSION_NUMBER || 0)
  };
}

function admin_getAutomatedStageRunnerStatus() {
  var adminEmail = typeof getCallerEmail_ === "function" ? clean_(getCallerEmail_() || "") : "";
  if (typeof isAdmin_ === "function" && !isAdmin_(adminEmail)) throw new Error("Access denied");
  requireSuperAdmin_(adminEmail);
  return getAutomatedStageRunnerStatus_();
}

function admin_installOrUpdateAutomatedStageRunnerTrigger() {
  var adminEmail = typeof getCallerEmail_ === "function" ? clean_(getCallerEmail_() || "") : "";
  if (typeof isAdmin_ === "function" && !isAdmin_(adminEmail)) throw new Error("Access denied");
  requireSuperAdmin_(adminEmail);
  var trigger = ensureAutomatedStageRunnerTrigger_();
  var status = getAutomatedStageRunnerStatus_();
  return Object.assign({}, trigger, { status: status });
}

function admin_getApplicantCommDerived_json(payload) {
  var p = payload && typeof payload === "object" ? payload : {};
  var adminEmail = typeof getCallerEmail_ === 'function' ? clean_(getCallerEmail_() || "") : "";
  if (typeof isAdmin_ === 'function' && !isAdmin_(adminEmail)) throw new Error("Access denied");
  var applicantId = clean_(p.applicantId || "");
  var rowNumber = Number(p.rowNumber || 0);
  var sheet = mustGetDataSheet_(getWorkingSpreadsheet_());
  if (!rowNumber && applicantId) rowNumber = findRowByApplicantId_(sheet, applicantId);
  if (!rowNumber) return { ok: false, error: "Applicant not found.", applicantId: applicantId };
  var rowObj = getRowObject_(sheet, rowNumber);
  var actorRole = adminEmail && typeof getAdminRole_ === "function" ? clean_(getAdminRole_(adminEmail) || "") : "";
  var derived = buildApplicantCommunicationAuthorityProjection_(rowObj, rowNumber, sheet, p.messageType, {
    actorEmail: adminEmail,
    actorRole: actorRole
  });
  return {
    ok: true,
    applicantId: clean_(rowObj.ApplicantID || applicantId || ""),
    Comm_Stage: clean_(derived.stage || ""),
    Comm_Status: clean_(derived.commStatus || ""),
    Comm_Recommended_Message_Type: clean_(derived.recommendedMessageType || ""),
    Comm_Requested_Message_Type: clean_(derived.requestedMessageType || ""),
    Comm_Selected_Message_Type: clean_(derived.selectedMessageType || ""),
    Comm_Permitted: derived.permitted === true,
    Comm_Sendable_Now: derived.sendableNow === true,
    Comm_Can_Send_Now: derived.sendableNow === true,
    Comm_Block_Code: clean_(derived.blockCode || ""),
    Comm_Block_Reason: clean_(derived.blockReason || ""),
    Comm_Awaiting_Response: derived.awaitingResponse === true,
    Comm_Authority_Source: clean_(derived.authoritySource || "")
  };
}

function previewApplicantMessage_(applicantId, messageType, opts) {
  var options = opts && typeof opts === "object" ? opts : {};
  var context = resolveApplicantMessageContext_(applicantId, messageType, Object.assign({}, options, { action: "preview" }));
  if (!context.eligible) {
    var blocked = {
      ok: true,
      action: "preview",
      eligible: false,
      result: "BLOCKED",
      blockCode: clean_(context.blockCode || ""),
      blockReason: clean_(context.blockReason || ""),
      protectedCommunication: context.protectedCommunication === true,
      overridePermitted: context.overridePermitted === true,
      overrideApplied: context.overrideApplied === true,
      missingPrerequisites: context.missingPrerequisites || [],
      prerequisiteChecks: context.prerequisiteChecks || [],
      lifecycleStage: clean_(context.lifecycleStage || ""),
      applicantState: clean_(context.applicantState || ""),
      applicantId: clean_(context.applicantId || applicantId || ""),
      messageType: clean_(context.messageType || messageType || ""),
      templateId: clean_(context.templateId || context.messageType || messageType || ""),
      templateVersionId: clean_(context.templateVersionId || "1"),
      portalLinkRequired: context.requiresPortalUrl === true,
      portalLinkHydrated: context.requiresPortalUrl === true && !!clean_(context.portalUrl || ""),
      unresolvedToken: clean_(context.unresolvedToken || ""),
      effectiveEmail: clean_(context.effectiveEmail || ""),
      debugId: clean_(context.debugId || newDebugId_())
    };
    campaignLog_("COMM_PREVIEW", {
      applicantId: blocked.applicantId,
      messageType: blocked.messageType,
      actorEmail: clean_(context.actorEmail || options.actorEmail || ""),
      actorRole: clean_(context.actorRole || options.actorRole || ""),
      blockCode: blocked.blockCode,
      result: "BLOCKED",
      debugId: blocked.debugId,
      batchLabel: clean_(options.batchLabel || "")
    });
    return blocked;
  }
  var built = buildApplicantMessage_(context);
  var previewRecipient = clean_(options.editedRecipient || context.effectiveEmail || "");
  var hasEditedSubject = typeof options.editedSubject === "string" && !!clean_(options.editedSubject || "");
  var hasEditedBody = typeof options.editedBody === "string" && !!clean_(options.editedBody || "");
  var previewSubject = hasEditedSubject ? String(options.editedSubject) : String(built.subject || "");
  var previewBody = hasEditedBody ? String(options.editedBody) : String(built.body || "");
  previewSubject = communicationRenderTemplateText_(previewSubject, context);
  previewBody = communicationRenderFinalBody_(context, previewBody);
  var ccBcc = communicationValidateCcBcc_(options.cc || "", options.bcc || "");
  if (ccBcc.ok !== true) {
    return {
      ok: true,
      action: "preview",
      eligible: false,
      result: "BLOCKED",
      blockCode: clean_(ccBcc.code || "COMMUNICATION_CC_BCC_INVALID"),
      blockReason: clean_(ccBcc.blockReason || "CC/BCC values are invalid."),
      applicantId: clean_(context.applicantId || ""),
      messageType: clean_(context.messageType || ""),
      effectiveEmail: previewRecipient,
      templateId: clean_(context.templateId || context.messageType || ""),
      templateVersionId: clean_(context.templateVersionId || "1"),
      portalLinkRequired: context.requiresPortalUrl === true,
      portalLinkHydrated: context.requiresPortalUrl === true && !!clean_(context.portalUrl || ""),
      debugId: clean_(context.debugId || newDebugId_())
    };
  }
  if (context.messageType === "custom_email" && (!clean_(previewSubject || "") || !clean_(previewBody || ""))) {
    return {
      ok: true,
      action: "preview",
      eligible: false,
      result: "BLOCKED",
      blockCode: !clean_(previewSubject || "") ? "MISSING_SUBJECT" : "MISSING_BODY",
      blockReason: !clean_(previewSubject || "") ? "Custom email subject is required." : "Custom email body is required.",
      applicantId: clean_(context.applicantId || ""),
      messageType: clean_(context.messageType || ""),
      effectiveEmail: previewRecipient,
      templateId: clean_(context.templateId || context.messageType || ""),
      templateVersionId: clean_(context.templateVersionId || "1"),
      portalLinkRequired: context.requiresPortalUrl === true,
      portalLinkHydrated: context.requiresPortalUrl === true && !!clean_(context.portalUrl || ""),
      debugId: clean_(context.debugId || newDebugId_())
    };
  }
  var renderedValidation = communicationValidateRenderedContent_(previewSubject, previewBody);
  if (renderedValidation.ok !== true) {
    return {
      ok: true,
      action: "preview",
      eligible: false,
      result: "BLOCKED",
      blockCode: renderedValidation.blockCode,
      blockReason: renderedValidation.blockReason,
      unresolvedToken: renderedValidation.unresolvedToken,
      unresolvedTokens: renderedValidation.unresolvedTokens,
      templateId: clean_(context.templateId || context.messageType || ""),
      templateVersionId: clean_(context.templateVersionId || "1"),
      portalLinkRequired: context.requiresPortalUrl === true,
      portalLinkHydrated: context.requiresPortalUrl === true && !!clean_(context.portalUrl || ""),
      applicantId: clean_(context.applicantId || ""),
      messageType: clean_(context.messageType || ""),
      effectiveEmail: previewRecipient,
      debugId: clean_(context.debugId || newDebugId_())
    };
  }
  var preview = {
    ok: true,
    action: "preview",
    eligible: true,
    result: "PREVIEW",
    blockCode: "",
    blockReason: "",
    protectedCommunication: context.protectedCommunication === true,
    overridePermitted: context.overridePermitted === true,
    overrideApplied: context.overrideApplied === true,
    missingPrerequisites: context.missingPrerequisites || [],
    prerequisiteChecks: context.prerequisiteChecks || [],
    lifecycleStage: clean_(context.lifecycleStage || ""),
    applicantState: clean_(context.applicantState || ""),
    applicantId: clean_(context.applicantId || ""),
    messageType: clean_(context.messageType || ""),
    templateId: clean_(context.templateId || context.messageType || ""),
    templateVersionId: clean_(context.templateVersionId || "1"),
    templateSource: clean_(context.templateSource || "BUILT_IN"),
    contentEdited: hasEditedSubject || hasEditedBody,
    effectiveEmail: previewRecipient,
    portalUrl: clean_(context.portalUrl || ""),
    subject: previewSubject,
    body: previewBody,
    cc: ccBcc.cc,
    bcc: ccBcc.bcc,
    portalLinkRequired: context.requiresPortalUrl === true,
    portalLinkHydrated: !!clean_(context.portalUrl || ""),
    debugId: clean_(context.debugId || newDebugId_())
  };
  campaignLog_("COMM_PREVIEW", {
    applicantId: preview.applicantId,
    messageType: preview.messageType,
    recipient: preview.effectiveEmail,
    actorEmail: clean_(context.actorEmail || options.actorEmail || ""),
    actorRole: clean_(context.actorRole || options.actorRole || ""),
    blockCode: "",
    result: "PREVIEW",
    subject: clean_(preview.subject || ""),
    debugId: preview.debugId,
    batchLabel: clean_(options.batchLabel || "")
  });
  return preview;
}

function sendApplicantMessage_(applicantId, messageType, opts) {
  var options = opts && typeof opts === "object" ? opts : {};
  var manualProbe = options.manualSingleSendProbe === true;
  if (manualProbe && isManualSingleSendProbeEnabled_() !== true) {
    var manualDisabledRequestId = clean_(options.debugId || newDebugId_());
    logManualSendProbe_("MANUAL_SEND_PROBE_BLOCKED", { applicantId: applicantId, messageType: messageType }, "", {
      sendDecision: "BLOCK",
      result: "BLOCKED",
      blockCode: "MANUAL_SINGLE_SENDS_DISABLED"
    });
    return {
      ok: true,
      action: "send",
      result: "BLOCKED",
      eligible: false,
      blockCode: "MANUAL_SINGLE_SENDS_DISABLED",
      blockReason: "Manual single-send probe is disabled.",
      applicantId: clean_(applicantId || ""),
      messageType: clean_(messageType || ""),
      effectiveEmail: "",
      debugId: manualDisabledRequestId
    };
  }
  if (!manualProbe && (isSystemStabilizationModeActive_() || CONFIG.ENABLE_PRODUCTION_EMAIL_SENDS !== true)) {
    var requestId = clean_(options.debugId || newDebugId_());
    var blockCode = isSystemStabilizationModeActive_() ? "SYSTEM_STABILIZATION_MODE_ACTIVE" : "PRODUCTION_EMAIL_SENDS_DISABLED";
    if (isSystemStabilizationModeActive_()) logOperationalBlock_("SYSTEM_STABILIZATION_MODE_ACTIVE", {
      action: "send_applicant_message",
      applicantId: clean_(applicantId || ""),
      messageType: clean_(messageType || ""),
      debugId: requestId
    });
    logOperationalBlock_("EMAIL_SEND_BLOCKED", {
      action: "send_applicant_message",
      blockCode: blockCode,
      applicantId: clean_(applicantId || ""),
      messageType: clean_(messageType || ""),
      batchLabel: clean_(options.batchLabel || ""),
      debugId: requestId
    });
    return {
      ok: true,
      action: "send",
      result: "BLOCKED",
      eligible: false,
      blockCode: blockCode,
      blockReason: "Production email sends are disabled during stabilization.",
      applicantId: clean_(applicantId || ""),
      messageType: clean_(messageType || ""),
      effectiveEmail: "",
      debugId: requestId
    };
  }
  var context = resolveApplicantMessageContext_(applicantId, messageType, Object.assign({}, options, { action: "send" }));
  if (!context.eligible) {
    if (!hasPriorSuccessfulMessageSend_(context)) {
      recordApplicantContactOutcome_(context, "BLOCKED", {
        actorEmail: clean_(options.actorEmail || context.actorEmail || (typeof getCallerEmail_ === "function" ? getCallerEmail_() : "") || ""),
        batchLabel: clean_(options.batchLabel || "")
      });
    }
    var blocked = {
      ok: true,
      action: "send",
      result: "BLOCKED",
      eligible: false,
      blockCode: clean_(context.blockCode || ""),
      blockReason: clean_(context.blockReason || ""),
      protectedCommunication: context.protectedCommunication === true,
      overridePermitted: context.overridePermitted === true,
      overrideApplied: context.overrideApplied === true,
      missingPrerequisites: context.missingPrerequisites || [],
      prerequisiteChecks: context.prerequisiteChecks || [],
      lifecycleStage: clean_(context.lifecycleStage || ""),
      applicantState: clean_(context.applicantState || ""),
      applicantId: clean_(context.applicantId || applicantId || ""),
      messageType: clean_(context.messageType || messageType || ""),
      templateId: clean_(context.templateId || context.messageType || messageType || ""),
      templateVersionId: clean_(context.templateVersionId || "1"),
      portalLinkRequired: context.requiresPortalUrl === true,
      portalLinkHydrated: context.requiresPortalUrl === true && !!clean_(context.portalUrl || ""),
      unresolvedToken: clean_(context.unresolvedToken || ""),
      effectiveEmail: clean_(context.effectiveEmail || ""),
      debugId: clean_(context.debugId || newDebugId_())
    };
    campaignLog_("COMM_BLOCKED", {
      applicantId: blocked.applicantId,
      messageType: blocked.messageType,
      actorEmail: clean_(context.actorEmail || options.actorEmail || ""),
      actorRole: clean_(context.actorRole || options.actorRole || ""),
      blockCode: blocked.blockCode,
      result: "BLOCKED",
      debugId: blocked.debugId,
      batchLabel: clean_(options.batchLabel || "")
    });
    return blocked;
  }
  var built = buildApplicantMessage_(context);
  var editedRecipient = clean_(options.editedRecipient || context.effectiveEmail || "");
  var editedSubject = typeof options.editedSubject === "string" ? String(options.editedSubject) : String(built.subject || "");
  var editedBody = typeof options.editedBody === "string" ? String(options.editedBody) : String(built.body || "");
  editedSubject = communicationRenderTemplateText_(editedSubject, context);
  editedBody = communicationRenderFinalBody_(context, editedBody);
  context.effectiveEmail = editedRecipient;
  built.subject = editedSubject;
  built.body = editedBody;
  var validatedCcBcc = communicationValidateCcBcc_(options.cc || "", options.bcc || "");
  if (!context.effectiveEmail) {
    context.eligible = false;
    context.blockCode = "NO_EFFECTIVE_EMAIL";
    context.blockReason = communicationBlockReason_("NO_EFFECTIVE_EMAIL", context.messageType);
  } else if (isValidEffectiveEmail_(context.effectiveEmail) !== true) {
    context.eligible = false;
    context.blockCode = "INVALID_EMAIL";
    context.blockReason = "Applicant does not have a valid email address.";
  } else if (!clean_(built.subject || "")) {
    context.eligible = false;
    context.blockCode = "MISSING_SUBJECT";
    context.blockReason = "Email subject is required.";
  } else if (!clean_(built.body || "")) {
    context.eligible = false;
    context.blockCode = "MISSING_BODY";
    context.blockReason = "Email body is required.";
  } else if (context.messageType === "custom_email" && hasUnresolvedCustomEmailPrompt_(built.body)) {
    context.eligible = false;
    var legacyCustomPromptCode = "CUSTOM_EMAIL_PROMPT_UNRESOLVED";
    context.blockCode = "COMMUNICATION_TEMPLATE_UNRESOLVED_TOKEN";
    context.blockReason = "Replace the custom email prompt with the actual message before sending. Legacy gate: " + legacyCustomPromptCode + ".";
  } else if (validatedCcBcc.ok !== true) {
    context.eligible = false;
    context.blockCode = clean_(validatedCcBcc.code || "COMMUNICATION_CC_BCC_INVALID");
    context.blockReason = clean_(validatedCcBcc.blockReason || "CC/BCC values are invalid.");
  } else {
    var sendRenderedValidation = communicationValidateRenderedContent_(built.subject, built.body);
    if (sendRenderedValidation.ok !== true) {
      context.eligible = false;
      context.blockCode = sendRenderedValidation.blockCode;
      context.blockReason = sendRenderedValidation.blockReason;
      context.unresolvedToken = sendRenderedValidation.unresolvedToken;
    }
  }
  if (
    context.eligible
    && communicationRequiresResolvedActionPlaceholders_(context.messageType)
    && hasUnresolvedActionRequiredPlaceholder_(built.subject, built.body)
  ) {
    context.eligible = false;
    var legacyActionPlaceholderCode = "ACTION_REQUIRED_PLACEHOLDER";
    context.blockCode = "COMMUNICATION_TEMPLATE_UNRESOLVED_TOKEN";
    context.blockReason = "Resolve all [ACTION REQUIRED: ...] placeholders before sending this operational template. Legacy gate: " + legacyActionPlaceholderCode + ".";
  }
  if (!context.eligible) {
    return {
      ok: true,
      action: "send",
      result: "BLOCKED",
      eligible: false,
      blockCode: clean_(context.blockCode || ""),
      blockReason: clean_(context.blockReason || ""),
      protectedCommunication: context.protectedCommunication === true,
      overridePermitted: context.overridePermitted === true,
      overrideApplied: context.overrideApplied === true,
      missingPrerequisites: context.missingPrerequisites || [],
      prerequisiteChecks: context.prerequisiteChecks || [],
      lifecycleStage: clean_(context.lifecycleStage || ""),
      applicantState: clean_(context.applicantState || ""),
      applicantId: clean_(context.applicantId || applicantId || ""),
      messageType: clean_(context.messageType || messageType || ""),
      effectiveEmail: clean_(context.effectiveEmail || ""),
      subject: clean_(built.subject || ""),
      templateId: clean_(context.templateId || context.messageType || ""),
      templateVersionId: clean_(context.templateVersionId || "1"),
      portalLinkRequired: context.requiresPortalUrl === true,
      portalLinkHydrated: context.requiresPortalUrl === true && !!clean_(context.portalUrl || ""),
      unresolvedToken: clean_(context.unresolvedToken || ""),
      debugId: clean_(context.debugId || newDebugId_())
    };
  }
  options.cc = validatedCcBcc.cc;
  options.bcc = validatedCcBcc.bcc;
  var dispatched = dispatchApplicantMessage_(context, built, options);
  campaignLog_(dispatched.result === "SENT" ? "COMM_SENT" : "COMM_FAILED", {
    applicantId: clean_(context.applicantId || applicantId || ""),
    messageType: clean_(context.messageType || messageType || ""),
    templateId: clean_(context.templateId || context.messageType || messageType || ""),
    templateVersionId: clean_(context.templateVersionId || "1"),
    templateSource: clean_(context.templateSource || "BUILT_IN"),
    contentEdited: typeof options.editedSubject === "string" || typeof options.editedBody === "string",
    recipient: clean_(context.effectiveEmail || ""),
    subject: clean_(built.subject || ""),
    bodySnippet: clean_(String(built.body || "").replace(/\s+/g, " ").slice(0, 120)),
    actorEmail: clean_(context.actorEmail || options.actorEmail || ""),
    actorRole: clean_(context.actorRole || options.actorRole || ""),
    blockCode: clean_(dispatched.blockCode || dispatched.code || ""),
    result: clean_(dispatched.result || (dispatched.ok ? "SENT" : "FAILED")),
    debugId: clean_(dispatched.debugId || context.debugId || newDebugId_()),
    batchLabel: clean_(options.batchLabel || "")
  });
  return dispatched;
}

function planApplicantBatch_(filterType, limit, opts) {
  var options = opts && typeof opts === "object" ? opts : {};
  var debugId = clean_(options.debugId || newDebugId_());
  var normalizedFilter = normalizeApplicantBatchFilterType_(filterType);
  var actor = communicationGetActorInfo_(options);
  if (!normalizedFilter) {
    return {
      ok: true,
      eligible: 0,
      blocked: 0,
      selected: 0,
      sampleRecipients: [],
      blockCounts: { UNKNOWN_FILTER_TYPE: 1 },
      limit: Math.max(1, Math.floor(Number(limit || 20))),
      filterType: clean_(filterType || ""),
      debugId: debugId,
      blockCode: "UNKNOWN_FILTER_TYPE",
      blockReason: communicationBlockReason_("UNKNOWN_FILTER_TYPE", "")
    };
  }
  if (!actor.isSuper) {
    return {
      ok: true,
      eligible: 0,
      blocked: 0,
      selected: 0,
      sampleRecipients: [],
      blockCounts: { ROLE_BLOCKED: 1 },
      limit: Math.max(1, Math.floor(Number(limit || 20))),
      filterType: normalizedFilter,
      debugId: debugId,
      blockCode: "ROLE_BLOCKED",
      blockReason: communicationBlockReason_("ROLE_BLOCKED", "")
    };
  }
  var batchLimit = Math.max(1, Math.floor(Number(limit || 20)));
  var ctx = campaignGetContext_();
  var headers = ctx.headers;
  var messageType = communicationMessageTypeForFilter_(normalizedFilter);
  var selected = 0;
  var eligible = 0;
  var blocked = 0;
  var blockCounts = {};
  var sampleRecipients = [];
  var candidates = [];
  for (var r = 1; r < ctx.values.length; r++) {
    if (selected >= batchLimit) break;
    var rowObj = campaignRowObjectFromValues_(headers, ctx.values[r]);
    if (!communicationMatchesFilterPrecheck_(rowObj, normalizedFilter)) continue;
    var applicantId = clean_(rowObj.ApplicantID || "");
    if (!applicantId) continue;
    selected++;
    var resolved = resolveApplicantMessageContext_(applicantId, messageType, Object.assign({}, options, { action: "planBatch", actorEmail: actor.email, actorRole: actor.role, debugId: debugId }));
    if (resolved.eligible) eligible++;
    else {
      blocked++;
      var key = clean_(resolved.blockCode || "UNKNOWN");
      blockCounts[key] = Number(blockCounts[key] || 0) + 1;
    }
    var candidate = {
      applicantId: applicantId,
      eligible: !!resolved.eligible,
      blockCode: clean_(resolved.blockCode || ""),
      blockReason: clean_(resolved.blockReason || ""),
      effectiveEmail: clean_(resolved.effectiveEmail || ""),
      messageType: messageType,
      rowNumber: Number(resolved.rowNumber || 0)
    };
    candidates.push(candidate);
    if (sampleRecipients.length < 10) sampleRecipients.push(candidate);
  }
  var summary = {
    ok: true,
    selected: selected,
    eligible: eligible,
    blocked: blocked,
    sampleRecipients: sampleRecipients,
    blockCounts: blockCounts,
    limit: batchLimit,
    filterType: normalizedFilter,
    debugId: debugId,
    candidates: candidates
  };
  campaignLog_("COMM_BATCH_PLAN", {
    applicantId: "",
    messageType: messageType,
    actorEmail: actor.email,
    actorRole: actor.role,
    blockCode: "",
    result: "planned",
    debugId: debugId,
    batchLabel: clean_(options.batchLabel || ""),
    filterType: normalizedFilter,
    selected: selected,
    eligible: eligible,
    blocked: blocked,
    blockCounts: blockCounts
  });
  return summary;
}

function testCampaignPing() {
  return "OK";
}

function campaign_prepareLegacyRows_() {
  var ctx = campaignGetContext_();
  var sh = ctx.sheet;
  var headers = ctx.headers;
  var prepared = 0;
  var keptReady = 0;
  var skippedMissingSecret = 0;
  var skippedIneligible = 0;
  var scanned = Math.max(0, ctx.values.length - 1);
  for (var r = 1; r < ctx.values.length; r++) {
    var rowNumber = r + 1;
    var rowObj = campaignRowObjectFromValues_(headers, ctx.values[r]);
    var state = deriveCommunicationState_(rowObj, portalCommunicationMessageType_(), {});
    var applicantId = clean_(state.applicantId || "");
    var status = clean_(state.base && state.base.emailStatus || "");
    if (status === "READY") {
      keptReady++;
      continue;
    }
    if (status && status !== "NEW") {
      skippedIneligible++;
      continue;
    }
    if (!applicantId) {
      skippedIneligible++;
      continue;
    }
    var resolved = resolveApplicantMessageContext_(applicantId, portalCommunicationMessageType_(), {
      actorEmail: clean_(getCallerEmail_ && getCallerEmail_()),
      actorRole: "SUPER",
      action: "prepare",
      debugId: newDebugId_()
    });
    if (!resolved.eligible) {
      if (resolved.blockCode === "MISSING_PORTAL_SECRET") skippedMissingSecret++;
      else skippedIneligible++;
      continue;
    }
    applyPatch_(sh, rowNumber, { Email_Status: "READY" });
    prepared++;
  }
  var summary = {
    ok: true,
    scanned: scanned,
    prepared: prepared,
    keptReady: keptReady,
    skippedMissingSecret: skippedMissingSecret,
    skippedIneligible: skippedIneligible
  };
  campaignLog_("CAMPAIGN_PREPARE_SUMMARY", summary);
  return summary;
}

function campaign_sendLegacyBatch_(limit, opts) {
  var options = opts && typeof opts === "object" ? opts : {};
  var dryRun = options.dryRun === true;
  var requestedId = clean_(options.applicantId || "");
  var batchLimit = Math.max(1, Math.floor(Number(limit || CONFIG.CAMPAIGN_BATCH_SIZE_DEFAULT || 50)));
  var batchLabel = clean_(options.batchLabel || "") || campaignBatchLabel_(new Date());
  var mergedOpts = Object.assign({}, options, { batchLabel: batchLabel });

  if (requestedId) {
    var single = dryRun
      ? previewApplicantMessage_(requestedId, portalCommunicationMessageType_(), mergedOpts)
      : sendApplicantMessage_(requestedId, portalCommunicationMessageType_(), mergedOpts);
    return {
      ok: true,
      dryRun: dryRun,
      requestedApplicantId: requestedId,
      requestedLimit: batchLimit,
      batchLabel: batchLabel,
      selected: single.eligible || single.result === "sent" ? 1 : 1,
      sent: single.result === "SENT" ? 1 : 0,
      dryRunCount: dryRun && single.eligible ? 1 : 0,
      skippedIneligible: (!single.eligible && single.blockCode) ? 1 : 0,
      skippedMissingSecret: single.blockCode === "MISSING_PORTAL_SECRET" ? 1 : 0,
      skippedNoStatus: 0,
      sendFailed: single.result === "FAILED" ? 1 : 0,
      preview: single.subject ? [{
        applicantId: clean_(single.applicantId || requestedId),
        effectiveEmail: clean_(single.effectiveEmail || ""),
        subject: clean_(single.subject || ""),
        portalUrl: clean_(single.portalUrl || ""),
        batchLabel: batchLabel,
        dryRun: dryRun
      }] : [],
      skipped: (!single.eligible && single.blockCode) || single.result === "FAILED"
        ? [{ applicantId: clean_(single.applicantId || requestedId), rowNumber: Number(single.rowNumber || 0), reason: clean_(single.blockCode || single.code || single.error || "BLOCKED") }]
        : []
    };
  }

  var plan = planApplicantBatch_("legacy_invite_eligible", batchLimit, mergedOpts);
  var sent = 0;
  var dryRunCount = 0;
  var sendFailed = 0;
  var previews = [];
  var skipped = [];
  var candidates = Array.isArray(plan.candidates) ? plan.candidates : [];
  for (var i = 0; i < candidates.length; i++) {
    var candidate = candidates[i];
    if (!candidate.eligible) {
      skipped.push({ applicantId: candidate.applicantId, rowNumber: candidate.rowNumber, reason: candidate.blockCode || "BLOCKED" });
      continue;
    }
    if (dryRun) {
      var preview = previewApplicantMessage_(candidate.applicantId, portalCommunicationMessageType_(), mergedOpts);
      if (preview.eligible) {
        dryRunCount++;
        previews.push({
          applicantId: preview.applicantId,
          effectiveEmail: preview.effectiveEmail,
          subject: preview.subject,
          portalUrl: preview.portalUrl,
          batchLabel: batchLabel,
          dryRun: true
        });
      } else {
        skipped.push({ applicantId: candidate.applicantId, rowNumber: candidate.rowNumber, reason: preview.blockCode || "BLOCKED" });
      }
      continue;
    }
    var sendResult = sendApplicantMessage_(candidate.applicantId, portalCommunicationMessageType_(), mergedOpts);
    if (sendResult.result === "SENT") sent++;
    else if (sendResult.result === "FAILED") {
      sendFailed++;
      skipped.push({ applicantId: candidate.applicantId, rowNumber: candidate.rowNumber, reason: sendResult.code || sendResult.error || "SEND_FAILED" });
    } else if (sendResult.blockCode) {
      skipped.push({ applicantId: candidate.applicantId, rowNumber: candidate.rowNumber, reason: sendResult.blockCode });
    }
  }
  return {
    ok: true,
    dryRun: dryRun,
    requestedApplicantId: requestedId,
    requestedLimit: batchLimit,
    batchLabel: batchLabel,
    selected: Number(plan.selected || 0),
    sent: sent,
    dryRunCount: dryRunCount,
    skippedIneligible: Number(plan.blocked || 0),
    skippedMissingSecret: Number((plan.blockCounts && plan.blockCounts.MISSING_PORTAL_SECRET) || 0),
    skippedNoStatus: 0,
    sendFailed: sendFailed,
    preview: previews,
    skipped: skipped,
    blockCounts: plan.blockCounts || {}
  };
}

function campaign_syncResponses_() {
  var ctx = campaignGetContext_();
  var sh = ctx.sheet;
  var headers = ctx.headers;
  var scanned = Math.max(0, ctx.values.length - 1);
  var updated = 0;
  for (var r = 1; r < ctx.values.length; r++) {
    var rowNumber = r + 1;
    var rowObj = campaignRowObjectFromValues_(headers, ctx.values[r]);
    if (!isCampaignPortalSubmittedActive_(rowObj)) continue;
    var status = normalizeEmailStatus_(rowObj.Email_Status || "");
    if (status === "RESPONDED") continue;
    if (status === "DO_NOT_CONTACT") continue;
    applyPatch_(sh, rowNumber, { Email_Status: "RESPONDED" });
    updated++;
  }
  var summary = { ok: true, scanned: scanned, updated: updated };
  campaignLog_("CAMPAIGN_SYNC_RESPONSES", summary);
  return summary;
}

function campaignExtractBounceEmails_(text) {
  var lower = String(text || "").toLowerCase();
  var matches = lower.match(/[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/g) || [];
  var seen = {};
  var out = [];
  for (var i = 0; i < matches.length; i++) {
    var email = clean_(matches[i]).toLowerCase();
    if (!email || seen[email]) continue;
    seen[email] = true;
    out.push(email);
  }
  return out;
}

function campaignExtractBounceReason_(body, subject) {
  var lines = String(body || "").split(/\r?\n/).map(function (line) {
    return clean_(line || "");
  }).filter(Boolean);
  var prioritized = [
    /^The response was:\s*(.+)$/i,
    /^The error that the other server returned was:\s*(.+)$/i,
    /^Diagnostic-Code:\s*(?:smtp;)?\s*(.+)$/i,
    /^Status:\s*(5\.[0-9.]+.*)$/i
  ];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i];
    for (var p = 0; p < prioritized.length; p++) {
      var match = line.match(prioritized[p]);
      if (match && clean_(match[1] || "")) return clean_(match[1]);
    }
  }
  for (var j = 0; j < lines.length; j++) {
    var candidate = clean_(lines[j] || "");
    if (!candidate) continue;
    if (/^(from|to|subject|date|message-id):/i.test(candidate)) continue;
    if (/user unknown|mailbox unavailable|address not found|does not exist|recipient address rejected|unable to receive mail|message blocked|blocked|rejected|undeliverable|delivery failed|quota exceeded|account disabled|no such user|invalid recipient|not found|550 |552 |554 /i.test(candidate)) {
      return candidate;
    }
  }
  var cleanedSubject = clean_(subject || "");
  if (cleanedSubject) return cleanedSubject;
  for (var k = 0; k < lines.length; k++) {
    var fallback = clean_(lines[k] || "");
    if (!fallback) continue;
    if (/^(from|to|subject|date|message-id):/i.test(fallback)) continue;
    return fallback.length > 240 ? fallback.slice(0, 240) : fallback;
  }
  return "";
}

function campaignExtractApplicantIds_(text) {
  var matches = String(text || "").match(/FODE-[A-Za-z0-9\-]+/g) || [];
  var seen = {};
  var out = [];
  for (var i = 0; i < matches.length; i++) {
    var id = clean_(matches[i]);
    if (!id || seen[id]) continue;
    seen[id] = true;
    out.push(id);
  }
  return out;
}

function campaignExtractBatchLabel_(text) {
  var match = String(text || "").match(/Campaign Batch:\s*([A-Za-z0-9\-:]+)/i);
  return match ? clean_(match[1]) : "";
}

function campaignIsBounceMessage_(message) {
  var lower = String(message || "").toLowerCase();
  return lower.indexOf("mail delivery subsystem") >= 0
    || lower.indexOf("delivery status notification") >= 0
    || lower.indexOf("undeliverable") >= 0
    || lower.indexOf("failure notice") >= 0
    || lower.indexOf("delivery has failed") >= 0
    || lower.indexOf("address not found") >= 0
    || lower.indexOf("message blocked") >= 0;
}

function bounceScanProcessedIdsKey_() {
  return "FODE_BOUNCE_SCAN_PROCESSED_IDS";
}

function readBounceScanProcessedIds_() {
  try {
    var raw = clean_(PropertiesService.getScriptProperties().getProperty(bounceScanProcessedIdsKey_()) || "");
    if (!raw) return {};
    var parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    if (Array.isArray(parsed)) {
      var out = {};
      parsed.forEach(function (id) {
        var cleanId = clean_(id || "");
        if (cleanId) out[cleanId] = "";
      });
      return out;
    }
    return parsed;
  } catch (_err) {
    return {};
  }
}

function writeBounceScanProcessedIds_(map) {
  var entries = Object.keys(map || {}).map(function (id) {
    return { id: id, ts: clean_(map[id] || "") };
  }).filter(function (entry) {
    return !!clean_(entry.id || "");
  }).sort(function (a, b) {
    return String(b.ts || "").localeCompare(String(a.ts || ""));
  }).slice(0, 1000);
  var out = {};
  entries.forEach(function (entry) {
    out[entry.id] = entry.ts || "";
  });
  PropertiesService.getScriptProperties().setProperty(bounceScanProcessedIdsKey_(), JSON.stringify(out));
}

function buildBounceRowLookup_(ctx) {
  var headers = ctx.headers || [];
  var values = ctx.values || [];
  var corrected = {};
  var raw = {};
  var crm = {};
  var applicantId = {};
  function add(map, email, rowNumber, rowObj) {
    var key = clean_(email || "").toLowerCase();
    if (!key) return;
    map[key] = map[key] || [];
    map[key].push({ rowNumber: rowNumber, row: rowObj });
  }
  function addApplicantId(map, id, rowNumber, rowObj) {
    var key = clean_(id || "").toUpperCase();
    if (!key) return;
    map[key] = map[key] || [];
    map[key].push({ rowNumber: rowNumber, row: rowObj });
  }
  for (var r = 1; r < values.length; r++) {
    var rowNumber = r + 1;
    var rowObj = campaignRowObjectFromValues_(headers, values[r]);
    add(corrected, rowObj.Parent_Email_Corrected, rowNumber, rowObj);
    add(raw, rowObj.Parent_Email, rowNumber, rowObj);
    add(crm, rowObj.CRM_Email, rowNumber, rowObj);
    addApplicantId(applicantId, rowObj.ApplicantID, rowNumber, rowObj);
  }
  return {
    applicantId: applicantId,
    corrected: corrected,
    raw: raw,
    crm: crm
  };
}

function normalizeBounceApplicantId_(value) {
  return clean_(value || "").toUpperCase();
}

function collectBounceLookupMatches_(lookupMaps, values, normalizeKeyFn) {
  var maps = Array.isArray(lookupMaps) ? lookupMaps : [];
  var seenRows = {};
  var ambiguous = [];
  var matchedValues = [];
  var seenValues = {};
  var normalizeKey = typeof normalizeKeyFn === "function" ? normalizeKeyFn : function (v) { return clean_(v || "").toLowerCase(); };
  for (var i = 0; i < (Array.isArray(values) ? values : []).length; i++) {
    var value = normalizeKey(values[i]);
    if (!value || seenValues[value]) continue;
    seenValues[value] = true;
    var matchedThisValue = false;
    for (var m = 0; m < maps.length; m++) {
      var map = maps[m] || {};
      var rows = map[value] || [];
      if (!rows.length) continue;
      matchedThisValue = true;
      if (rows.length !== 1) {
        ambiguous.push({
          value: value,
          matchCount: rows.length
        });
        continue;
      }
      var match = rows[0];
      if (match && Number(match.rowNumber || 0) > 0) {
        seenRows[String(match.rowNumber)] = match;
        matchedValues.push(value);
      }
    }
    if (!matchedThisValue) {
      // no-op; caller decides whether this should be treated as a miss or ambiguity.
    }
  }
  return {
    rows: Object.keys(seenRows).map(function (k) { return seenRows[k]; }),
    matchedValues: matchedValues,
    ambiguous: ambiguous
  };
}

function resolveBounceApplicantMatch_(lookup, emailMatches, applicantIdMatches) {
  var applicantIds = Array.isArray(applicantIdMatches) ? applicantIdMatches : [];
  var emails = Array.isArray(emailMatches) ? emailMatches : [];
  var idOutcome = collectBounceLookupMatches_(
    [lookup && lookup.applicantId ? lookup.applicantId : {}],
    applicantIds,
    normalizeBounceApplicantId_
  );
  if (applicantIds.length) {
    if (idOutcome.ambiguous.length > 0) {
      return {
        status: "MATCH_AMBIGUOUS",
        matchType: "APPLICANT_ID",
        reason: "Multiple rows matched the applicant ID token(s).",
        applicantIds: applicantIds.slice(0),
        matchedValues: idOutcome.matchedValues.slice(0),
        ambiguous: idOutcome.ambiguous.slice(0, 10),
        row: null
      };
    }
    if (idOutcome.rows.length === 1) {
      return {
        status: "MATCHED_UNIQUE",
        matchType: "APPLICANT_ID",
        reason: "",
        applicantIds: applicantIds.slice(0),
        matchedValues: idOutcome.matchedValues.slice(0),
        ambiguous: [],
        row: idOutcome.rows[0],
        rowNumber: Number(idOutcome.rows[0].rowNumber || 0)
      };
    }
    return {
      status: "NO_MATCH",
      matchType: "APPLICANT_ID",
      reason: "Applicant ID token did not resolve to a unique row.",
      applicantIds: applicantIds.slice(0),
      matchedValues: [],
      ambiguous: [],
      row: null
    };
  }
  var emailOutcome = collectBounceLookupMatches_(
    [
      lookup && lookup.corrected ? lookup.corrected : {},
      lookup && lookup.raw ? lookup.raw : {},
      lookup && lookup.crm ? lookup.crm : {}
    ],
    emails,
    function (v) { return clean_(v || "").toLowerCase(); }
  );
  if (emailOutcome.ambiguous.length > 0) {
    return {
      status: "MATCH_AMBIGUOUS",
      matchType: "EMAIL",
      reason: "Multiple recipient email candidates matched.",
      applicantIds: [],
      matchedValues: emailOutcome.matchedValues.slice(0),
      ambiguous: emailOutcome.ambiguous.slice(0, 10),
      row: null
    };
  }
  if (emailOutcome.rows.length === 1) {
    return {
      status: "MATCHED_UNIQUE",
      matchType: "EMAIL",
      reason: "",
      applicantIds: [],
      matchedValues: emailOutcome.matchedValues.slice(0),
      ambiguous: [],
      row: emailOutcome.rows[0],
      rowNumber: Number(emailOutcome.rows[0].rowNumber || 0)
    };
  }
  return {
    status: "NO_MATCH",
    matchType: "EMAIL",
    reason: "No unique email candidate matched.",
    applicantIds: [],
    matchedValues: [],
    ambiguous: [],
    row: null
  };
}

function normalizeBounceClassification_(value) {
  var normalized = clean_(value || "").toUpperCase();
  return ["NONE", "TEMPORARY", "HARD", "INVALID", "BLOCKED"].indexOf(normalized) >= 0 ? normalized : "NONE";
}

function normalizeBounceReason_(classification, reason) {
  var normalizedClass = normalizeBounceClassification_(classification);
  var normalizedReason = clean_(reason || "");
  if (!normalizedReason) return normalizedClass;
  return normalizedClass + ": " + normalizedReason;
}

function classifyBounceResult_(subject, plainBody, extractedReason) {
  var reason = clean_(extractedReason || campaignExtractBounceReason_(plainBody, subject) || "");
  var blob = [clean_(subject || ""), reason, String(plainBody || "")].join("\n").toLowerCase();
  if (!campaignIsBounceMessage_(blob)) return { classification: "NONE", reason: reason };
  if (/user unknown|unknown user|address not found|does not exist|no such user|invalid recipient|bad destination mailbox address|recipient address rejected|mailbox unavailable/i.test(blob)) {
    return { classification: "INVALID", reason: reason };
  }
  if (/message blocked|blocked|suppressed|policy|reputation|spam|access denied|denied|unauthorized/i.test(blob)) {
    return { classification: "BLOCKED", reason: reason };
  }
  if (/quota exceeded|mailbox full|temporar|try again later|deferred|greylist|rate limit|resources temporarily unavailable|status:\s*4\./i.test(blob)) {
    return { classification: "TEMPORARY", reason: reason };
  }
  if (/status:\s*5\.|\b550\b|\b551\b|\b552\b|\b553\b|\b554\b|undeliverable|delivery has failed|delivery failed|permanent/i.test(blob)) {
    return { classification: "HARD", reason: reason };
  }
  return { classification: "HARD", reason: reason };
}

function extractBounceSmtpStatus_(text) {
  var blob = String(text || "");
  var status = blob.match(/\b([245][0-9]{2})(?:[ \t]+([245]\.[0-9.]+))?\b/);
  if (status) return clean_([status[1], status[2] || ""].join(" "));
  var dsn = blob.match(/\bStatus:\s*([245]\.[0-9.]+)/i);
  return dsn ? clean_(dsn[1]) : "";
}

function normalizeDeliveryHealth_(classification) {
  var normalized = normalizeBounceClassification_(classification);
  if (normalized === "TEMPORARY") return "Temporary Failure";
  if (normalized === "HARD" || normalized === "INVALID" || normalized === "BLOCKED") return "Permanent Failure";
  return "Unknown";
}

function normalizeBounceFailureType_(classification, reason) {
  var normalized = normalizeBounceClassification_(classification);
  var blob = clean_(reason || "").toLowerCase();
  if (normalized === "TEMPORARY") return "TEMPORARY_FAILURE";
  if (/domain|dns|host not found|no mx/i.test(blob)) return "DOMAIN_FAILURE";
  if (normalized === "HARD" || normalized === "INVALID" || normalized === "BLOCKED") return "PERMANENT_FAILURE";
  return "UNKNOWN";
}

function buildBounceReconciliationKey_(candidate) {
  var c = candidate || {};
  var provider = clean_(c.provider || "gmail-bouncemail-v1");
  var messageId = clean_(c.messageId || "");
  var recipient = clean_(c.failedRecipient || "").toLowerCase();
  if (messageId && recipient) return provider + "::" + messageId + "::" + recipient;
  return provider + "::" + recipient + "::" + clean_(c.timestamp || "") + "::" + clean_(c.smtpStatus || "");
}

function buildGmailBounceCandidate_(message, subject, plainBody, classification, reason) {
  var body = String(plainBody || "");
  var allText = [clean_(subject || ""), body].join("\n");
  var emails = campaignExtractBounceEmails_(allText);
  var failedRecipient = clean_(emails[0] || "").toLowerCase();
  var timestamp = "";
  if (message && typeof message.getDate === "function" && message.getDate()) {
    timestamp = message.getDate().toISOString();
  }
  var normalizedClass = normalizeBounceClassification_(classification);
  var normalizedReason = clean_(reason || campaignExtractBounceReason_(body, subject) || "");
  var candidate = {
    provider: "gmail-bouncemail-v1",
    messageId: clean_(message && typeof message.getId === "function" ? message.getId() : ""),
    threadId: clean_(message && typeof message.getThread === "function" && message.getThread() && typeof message.getThread().getId === "function" ? message.getThread().getId() : ""),
    failedRecipient: failedRecipient,
    allRecipients: emails.slice(0),
    applicantIds: campaignExtractApplicantIds_(allText),
    failureType: normalizeBounceFailureType_(normalizedClass, normalizedReason),
    classification: normalizedClass,
    smtpStatus: extractBounceSmtpStatus_(allText),
    timestamp: timestamp,
    diagnosticReason: normalizedReason,
    deliveryHealth: normalizeDeliveryHealth_(normalizedClass)
  };
  candidate.reconciliationKey = buildBounceReconciliationKey_(candidate);
  return candidate;
}

function buildBounceStatePatch_(rowObj, classification, reason, candidate) {
  var row = rowObj || {};
  var normalizedClass = normalizeBounceClassification_(classification);
  var normalizedReason = normalizeBounceReason_(normalizedClass, reason);
  var patch = {};
  var currentReason = clean_(row.Email_Bounce_Reason || "");
  var currentStatus = normalizeEmailStatus_(row.Email_Status || "");
  var nextActionDate = clean_(row.Email_Next_Action_Date || "");
  var c = candidate || {};
  var bounceAt = clean_(c.timestamp || "");
  var deliveryHealth = clean_(c.deliveryHealth || normalizeDeliveryHealth_(normalizedClass));
  var reconciliationKey = clean_(c.reconciliationKey || buildBounceReconciliationKey_(c));
  if (reconciliationKey && reconciliationKey === clean_(row.Delivery_Reconciliation_Key || "")) return patch;
  var bounceTs = parseTime_(bounceAt);
  var lastContactTs = parseTime_(row.Email_Last_Sent_At || row.Last_Contacted_At || "");
  var lastResult = clean_(row.Last_Contact_Result || row.Email_Status || "").toUpperCase();
  if (bounceTs > 0 && lastContactTs > bounceTs && /^(SENT|SUCCESS|DELIVERED)$/i.test(lastResult)) return patch;
  if (deliveryHealth && deliveryHealth !== clean_(row.Delivery_Health || "")) patch.Delivery_Health = deliveryHealth;
  if (deliveryHealth && deliveryHealth !== clean_(row.Last_Delivery_Status || "")) patch.Last_Delivery_Status = deliveryHealth;
  if (bounceAt && bounceAt !== clean_(row.Last_Bounce_Date || "")) patch.Last_Bounce_Date = bounceAt;
  if (normalizedReason && normalizedReason !== clean_(row.Bounce_Reason || "")) patch.Bounce_Reason = normalizedReason;
  if (reconciliationKey && reconciliationKey !== clean_(row.Delivery_Reconciliation_Key || "")) patch.Delivery_Reconciliation_Key = reconciliationKey;
  if (clean_(c.provider || "") && clean_(c.provider || "") !== clean_(row.Delivery_Reconciliation_Source || "")) patch.Delivery_Reconciliation_Source = clean_(c.provider || "");
  if (normalizedClass === "TEMPORARY") {
    var retryAt = computeNextActionDate_(1, new Date());
    if (normalizedReason && normalizedReason !== currentReason) patch.Email_Bounce_Reason = normalizedReason;
    if (retryAt !== nextActionDate) patch.Email_Next_Action_Date = retryAt;
    return patch;
  }
  if (normalizedClass === "HARD" || normalizedClass === "INVALID" || normalizedClass === "BLOCKED") {
    if (!isCampaignBounceFlagTrue_(row.Email_Bounce_Flag)) patch.Email_Bounce_Flag = "YES";
    if (normalizedReason && normalizedReason !== currentReason) patch.Email_Bounce_Reason = normalizedReason;
    if (currentStatus !== "BOUNCED") patch.Email_Status = "BOUNCED";
    if (nextActionDate) patch.Email_Next_Action_Date = "";
  }
  return patch;
}

function applyBounceStateToRow_(rowObj, classification, reason) {
  return buildBounceStatePatch_(rowObj, classification, reason, {});
}

function ingestRecentBounces_(opts) {
  var options = opts && typeof opts === "object" ? opts : {};
  if (isSystemStabilizationModeActive_()) {
    logOperationalBlock_("SYSTEM_STABILIZATION_MODE_ACTIVE", { action: "bounce_ingestion", source: clean_(options.source || "MANUAL") });
    logOperationalBlock_("BOUNCE_SCAN_BLOCKED", { action: "bounce_ingestion", blockCode: "SYSTEM_STABILIZATION_MODE_ACTIVE", source: clean_(options.source || "MANUAL") });
    return {
      ok: true,
      action: "bounce_ingestion",
      result: "SKIPPED",
      reason: "SYSTEM_STABILIZATION_MODE_ACTIVE"
    };
  }
  var enabled = CONFIG.ENABLE_BOUNCE_INGESTION === true || options.force === true;
  if (!enabled) {
    logOperationalBlock_("BOUNCE_SCAN_BLOCKED", { action: "bounce_ingestion", blockCode: "BOUNCE_INGESTION_DISABLED", source: clean_(options.source || "MANUAL") });
    return {
      ok: true,
      action: "bounce_ingestion",
      result: "SKIPPED",
      reason: "BOUNCE_INGESTION_DISABLED"
    };
  }
  var ctx = campaignGetContext_();
  var sh = ctx.sheet;
  var lookup = buildBounceRowLookup_(ctx);
  var processedIds = readBounceScanProcessedIds_();
  var cacheDirty = false;
  var lookbackDays = Math.max(1, Math.floor(Number(CONFIG.BOUNCE_INGESTION_LOOKBACK_DAYS || 14)));
  var maxMessages = Math.max(1, Math.floor(Number(CONFIG.BOUNCE_INGESTION_MAX_MESSAGES || 200)));
  var query = '(from:(mailer-daemon@google.com OR mailer-daemon@googlemail.com OR "Mail Delivery Subsystem") OR subject:("Delivery Status Notification" OR "Delivery Status Notification (Failure)" OR "Undeliverable" OR "Failure Notice" OR "Address not found")) newer_than:' + lookbackDays + 'd';
  var threads = GmailApp.search(query, 0, 200);
  var scanned = 0;
  var matched = 0;
  var matchedUnique = 0;
  var ambiguous = 0;
  var unmatched = 0;
  var updated = 0;
  var countsByClassification = {
    NONE: 0,
    TEMPORARY: 0,
    HARD: 0,
    INVALID: 0,
    BLOCKED: 0
  };
  var latestBounceAt = "";
  var latestBounceReason = "";
  var latestBounceClassification = "";
  var latestBounceApplicantId = "";
  var ambiguousSamples = [];
  var unmatchedSamples = [];
  var nowIso = new Date().toISOString();
  outer:
  for (var t = 0; t < threads.length; t++) {
    var messages = threads[t].getMessages();
    for (var m = messages.length - 1; m >= 0; m--) {
      if (scanned >= maxMessages) break outer;
      var msg = messages[m];
      var msgId = clean_(msg.getId() || "");
      if (msgId && processedIds[msgId]) continue;
      var subject = clean_(msg.getSubject() || "");
      var plainBody = String(msg.getPlainBody() || "");
      var blob = [subject, plainBody].join("\n");
      if (!campaignIsBounceMessage_(blob)) {
        if (msgId) {
          processedIds[msgId] = nowIso;
          cacheDirty = true;
        }
        continue;
      }
      scanned++;
      var emailMatches = campaignExtractBounceEmails_(blob);
      var applicantIdMatches = campaignExtractApplicantIds_(blob);
      var bounce = classifyBounceResult_(subject, plainBody, campaignExtractBounceReason_(plainBody, subject));
      var classification = normalizeBounceClassification_(bounce && bounce.classification || "NONE");
      var candidate = buildGmailBounceCandidate_(msg, subject, plainBody, classification, bounce && bounce.reason || "");
      emailMatches = candidate.allRecipients && candidate.allRecipients.length ? candidate.allRecipients : emailMatches;
      applicantIdMatches = candidate.applicantIds && candidate.applicantIds.length ? candidate.applicantIds : applicantIdMatches;
      countsByClassification[classification] = Number(countsByClassification[classification] || 0) + 1;
      latestBounceAt = clean_(candidate.timestamp || (msg.getDate && msg.getDate() ? msg.getDate().toISOString() : nowIso));
      latestBounceReason = clean_(bounce && bounce.reason || "");
      latestBounceClassification = classification;
      if (applicantIdMatches.length === 1) latestBounceApplicantId = normalizeBounceApplicantId_(applicantIdMatches[0] || "");
      var match = resolveBounceApplicantMatch_(lookup, emailMatches, applicantIdMatches);
      if (match && match.status === "MATCHED_UNIQUE" && match.row) {
        matched++;
        matchedUnique++;
        var matchedRow = match.row;
        var patch = buildBounceStatePatch_(matchedRow.row || matchedRow, classification, bounce && bounce.reason || "", candidate);
        if (Object.keys(patch).length) {
          applyPatch_(sh, Number(match.rowNumber || matchedRow.rowNumber || 0), patch);
          updated++;
          matchedRow.row.Email_Bounce_Flag = Object.prototype.hasOwnProperty.call(patch, 'Email_Bounce_Flag') ? patch.Email_Bounce_Flag : matchedRow.row.Email_Bounce_Flag;
          matchedRow.row.Email_Bounce_Reason = Object.prototype.hasOwnProperty.call(patch, 'Email_Bounce_Reason') ? patch.Email_Bounce_Reason : matchedRow.row.Email_Bounce_Reason;
          matchedRow.row.Email_Status = Object.prototype.hasOwnProperty.call(patch, 'Email_Status') ? patch.Email_Status : matchedRow.row.Email_Status;
          matchedRow.row.Email_Next_Action_Date = Object.prototype.hasOwnProperty.call(patch, 'Email_Next_Action_Date') ? patch.Email_Next_Action_Date : matchedRow.row.Email_Next_Action_Date;
          matchedRow.row.Last_Delivery_Status = Object.prototype.hasOwnProperty.call(patch, 'Last_Delivery_Status') ? patch.Last_Delivery_Status : matchedRow.row.Last_Delivery_Status;
          matchedRow.row.Last_Bounce_Date = Object.prototype.hasOwnProperty.call(patch, 'Last_Bounce_Date') ? patch.Last_Bounce_Date : matchedRow.row.Last_Bounce_Date;
          matchedRow.row.Bounce_Reason = Object.prototype.hasOwnProperty.call(patch, 'Bounce_Reason') ? patch.Bounce_Reason : matchedRow.row.Bounce_Reason;
          matchedRow.row.Delivery_Health = Object.prototype.hasOwnProperty.call(patch, 'Delivery_Health') ? patch.Delivery_Health : matchedRow.row.Delivery_Health;
          matchedRow.row.Delivery_Reconciliation_Key = Object.prototype.hasOwnProperty.call(patch, 'Delivery_Reconciliation_Key') ? patch.Delivery_Reconciliation_Key : matchedRow.row.Delivery_Reconciliation_Key;
          matchedRow.row.Delivery_Reconciliation_Source = Object.prototype.hasOwnProperty.call(patch, 'Delivery_Reconciliation_Source') ? patch.Delivery_Reconciliation_Source : matchedRow.row.Delivery_Reconciliation_Source;
        }
      } else if (match && match.status === "MATCH_AMBIGUOUS") {
        ambiguous++;
        if (ambiguousSamples.length < 10) {
          ambiguousSamples.push({
            matchType: clean_(match.matchType || ""),
            applicantIds: Array.isArray(match.applicantIds) ? match.applicantIds.slice(0, 10) : [],
            matchedValues: Array.isArray(match.matchedValues) ? match.matchedValues.slice(0, 10) : [],
            reason: clean_(match.reason || ""),
            classification: classification,
            subject: subject
          });
        }
      } else {
        unmatched++;
        if (unmatchedSamples.length < 10) {
          unmatchedSamples.push({
            matchType: clean_(match && match.matchType || ""),
            applicantIds: Array.isArray(applicantIdMatches) ? applicantIdMatches.slice(0, 10) : [],
            emails: Array.isArray(emailMatches) ? emailMatches.slice(0, 10) : [],
            reason: clean_(match && match.reason || "NO_MATCH"),
            classification: classification,
            subject: subject
          });
        }
      }
      if (msgId) {
        processedIds[msgId] = nowIso;
        cacheDirty = true;
      }
    }
  }
  if (cacheDirty) writeBounceScanProcessedIds_(processedIds);
  var summary = {
    ok: true,
    action: "bounce_ingestion",
    result: "COMPLETE",
    scanned: scanned,
    matched: matched,
    matchedUnique: matchedUnique,
    ambiguous: ambiguous,
    unmatched: unmatched,
    updated: updated,
    countsByClassification: countsByClassification,
    lookbackDays: lookbackDays,
    maxMessages: maxMessages,
    source: clean_(options.source || "MANUAL"),
    latestBounceAt: latestBounceAt,
    latestBounceReason: latestBounceReason,
    latestBounceClassification: latestBounceClassification,
    latestBounceApplicantId: latestBounceApplicantId,
    ambiguousSamples: ambiguousSamples,
    unmatchedSamples: unmatchedSamples
  };
  campaignLog_("CAMPAIGN_BOUNCE_SUMMARY", summary);
  return summary;
}

function admin_scanBounces_(opts) {
  return ingestRecentBounces_(Object.assign({}, opts || {}, { force: true, source: clean_(opts && opts.source || "ADMIN") }));
}

function campaign_processBounces_() {
  return ingestRecentBounces_({ source: "CAMPAIGN" });
}

function campaign_sendLegacyFollowups_(limit) {
  var batchLimit = Math.max(1, Math.floor(Number(limit || CONFIG.CAMPAIGN_BATCH_SIZE_DEFAULT || 50)));
  var ctx = campaignGetContext_();
  var headers = ctx.headers;
  var now = new Date();
  var todayTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  var batchLabel = campaignBatchLabel_(now);
  var selected = 0;
  var sent = 0;
  var skipped = [];
  for (var r = 1; r < ctx.values.length; r++) {
    if (selected >= batchLimit) break;
    var rowNumber = r + 1;
    var rowObj = campaignRowObjectFromValues_(headers, ctx.values[r]);
    var state = deriveCommunicationState_(rowObj, "reminder", {});
    var baseState = state.base || {};
    if (clean_(baseState.emailStatus || "") !== "SENT") continue;
    if (baseState.portalSubmittedActive === true) {
      skipped.push({ applicantId: clean_(state.applicantId || ""), rowNumber: rowNumber, reason: "PORTAL_ALREADY_SUBMITTED" });
      continue;
    }
    if (baseState.bounceFlag === true) continue;
    var nextActionTs = Number(baseState.nextActionAtMs || 0);
    if (!(nextActionTs > 0) || nextActionTs > todayTs) continue;
    var attemptCount = Number(baseState.attemptCount || 0);
    if (attemptCount < 1 || attemptCount >= 3) continue;
    selected++;
    var sendRes = sendApplicantMessage_(clean_(state.applicantId || ""), "reminder", {
      batchLabel: batchLabel,
      sendSource: "CAMPAIGN_FOLLOWUP_WORKFLOW",
      unattended: true
    });
    if (sendRes.result === "SENT") sent++;
    else skipped.push({ applicantId: clean_(state.applicantId || ""), rowNumber: rowNumber, reason: clean_(sendRes.blockCode || sendRes.code || sendRes.error || "SEND_FAILED") });
  }
  var summary = {
    ok: true,
    selected: selected,
    sent: sent,
    batchLabel: batchLabel,
    skipped: skipped
  };
  campaignLog_("CAMPAIGN_FOLLOWUP_SUMMARY", summary);
  return summary;
}

function campaign_getLegacyEmailSummary_() {
  var ctx = campaignGetContext_();
  var headers = ctx.headers;
  var counts = {
    READY: 0,
    SENT: 0,
    BOUNCED: 0,
    RESPONDED: 0,
    DO_NOT_CONTACT: 0,
    NEW: 0,
    BLANK: 0
  };
  var eligibleForInitialSend = 0;
  var eligibleForFollowup = 0;
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var todayTs = today.getTime();
  for (var r = 1; r < ctx.values.length; r++) {
    var rowObj = campaignRowObjectFromValues_(headers, ctx.values[r]);
    var status = normalizeEmailStatus_(rowObj.Email_Status || "");
    if (!status) counts.BLANK++;
    else if (Object.prototype.hasOwnProperty.call(counts, status)) counts[status]++;
    var eligibility = computeCampaignEligibility_(rowObj);
    if (eligibility.eligible && (!status || status === "NEW" || status === "READY")) eligibleForInitialSend++;
    if (status === "SENT" && !isCampaignPortalSubmittedActive_(rowObj) && !isCampaignBounceFlagTrue_(rowObj.Email_Bounce_Flag)) {
      var attempts = campaignAttemptCount_(rowObj);
      var nextActionTs = parseTime_(rowObj.Email_Next_Action_Date || "");
      if (attempts < 3 && nextActionTs > 0 && nextActionTs <= todayTs) eligibleForFollowup++;
    }
  }
  return {
    ok: true,
    counts: counts,
    eligibleForInitialSend: eligibleForInitialSend,
    eligibleForFollowup: eligibleForFollowup
  };
}

function testCampaignGmailAuth() {
  return {
    ok: true,
    aliases: GmailApp.getAliases(),
    requiredAlias: requiredSystemSenderAlias_(),
    requiredReplyTo: requiredSystemReplyTo_()
  };
}









