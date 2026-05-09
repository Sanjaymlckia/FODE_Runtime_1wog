/******************** UTIL ********************/

function mustGetSheet_(ss, name) {
  var sh = ss.getSheetByName(name);
  if (!sh) throw new Error("Missing sheet: " + name);
  return sh;
}

function clean_(v) {
  return (v === null || v === undefined) ? "" : String(v).trim();
}

function getParam_(e, key) {
  var k = clean_(key);
  if (!k) return "";
  return (e && e.parameter && typeof e.parameter === "object" && e.parameter[k] !== undefined) ? e.parameter[k] : "";
}

function getExecUrl_() {
  try {
    return clean_(ScriptApp.getService().getUrl() || "");
  } catch (_e) {
    return "";
  }
}

function redactToken_(s) {
  var t = clean_(s);
  if (!t) return "";
  if (t.length <= 10) return t;
  return t.slice(0, 6) + "..." + t.slice(-4);
}

function makeReqId_() {
  return Utilities.getUuid().slice(0, 8);
}

function newDebugId_() {
  var ts = Utilities.formatDate(new Date(), "UTC", "yyyyMMddHHmmss");
  var rand = Utilities.getUuid().replace(/-/g, "").slice(0, 8);
  return "DBG-" + ts + "-" + rand;
}

function makeDebugId_() {
  return newDebugId_();
}

function makeClientDebugId_() {
  return "CDBG-" + Utilities.formatDate(new Date(), "UTC", "yyyyMMddHHmmss") + "-" + Utilities.getUuid().replace(/-/g, "").slice(0, 8);
}

function stringifyGsError_(err) {
  if (err === null || err === undefined) return "";
  if (typeof err === "string") return err;
  try {
    if (err && typeof err.message === "string" && err.message) return err.message;
  } catch (_e1) {}
  try {
    return JSON.stringify(err);
  } catch (_e2) {}
  try {
    return String(err);
  } catch (_e3) {}
  return "Unknown error";
}

function getExecIdentity_() {
  var activeUserEmail = "";
  var effectiveUserEmail = "";
  try { activeUserEmail = clean_(Session.getActiveUser().getEmail() || ""); } catch (_e1) {}
  try { effectiveUserEmail = clean_(Session.getEffectiveUser().getEmail() || ""); } catch (_e2) {}
  return {
    activeUserEmail: activeUserEmail,
    effectiveUserEmail: effectiveUserEmail,
    isAnonymousActiveUser: !activeUserEmail
  };
}

function isAdminEmail_(email) {
  var e = clean_(email || "").toLowerCase();
  if (!e) return false;
  var allowlist = (CONFIG.ADMIN_EMAILS || []).map(function (x) { return clean_(x).toLowerCase(); });
  return allowlist.indexOf(e) >= 0;
}

function getCallerEmail_() {
  var active = "";
  var effective = "";
  try { active = clean_(Session.getActiveUser().getEmail() || ""); } catch (_a) {}
  try { effective = clean_(Session.getEffectiveUser().getEmail() || ""); } catch (_e) {}
  return clean_(active || effective || "");
}

function isAdminCaller_() {
  return isAdminEmail_(getCallerEmail_());
}

function safeErr_(e) {
  var name = "";
  var message = "";
  var stack = "";
  try { name = clean_(e && e.name || ""); } catch (_e1) {}
  try { message = clean_(e && e.message || stringifyGsError_(e) || ""); } catch (_e2) {}
  try { stack = String(e && e.stack ? e.stack : ""); } catch (_e3) {}
  var lines = stack ? stack.split(/\r?\n/) : [];
  return {
    name: name,
    message: message,
    stackTop: lines.slice(0, 5).join("\n")
  };
}

function requiredSystemSenderAlias_() {
  return "fode_kia@kundu.ac";
}

function requiredSystemReplyTo_() {
  return "fode@kundu.ac";
}

function assertRequiredSystemSenderAlias_() {
  var alias = requiredSystemSenderAlias_();
  var aliases = GmailApp.getAliases();
  if (!Array.isArray(aliases) || aliases.indexOf(alias) === -1) {
    throw new Error("Missing required alias: " + alias);
  }
  return {
    from: alias,
    replyTo: requiredSystemReplyTo_(),
    aliases: aliases
  };
}

function getScriptProp_(key) {
  var k = clean_(key);
  if (!k) return "";
  try {
    return clean_(PropertiesService.getScriptProperties().getProperty(k) || "");
  } catch (_e) {
    return "";
  }
}

function setScriptProp_(key, value) {
  var k = clean_(key);
  if (!k) return;
  var v = clean_(value);
  PropertiesService.getScriptProperties().setProperty(k, v);
}

function safeFolderProbe_(folderId) {
  var id = clean_(folderId);
  if (!id) {
    return { ok: false, errName: "Error", errMessage: "Missing folderId" };
  }
  try {
    var folder = withRetries_(function () {
      return DriveApp.getFolderById(id);
    }, { label: "safeFolderProbe:getFolderById" });
    var name = withRetries_(function () {
      return clean_(folder.getName() || "");
    }, { label: "safeFolderProbe:getName" });
    return { ok: true, name: name };
  } catch (e) {
    var se = safeErr_(e);
    return {
      ok: false,
      errName: clean_(se.name || "Error") || "Error",
      errMessage: clean_(se.message || "Folder probe failed") || "Folder probe failed"
    };
  }
}

function isDriveServerError_(e) {
  var msg = "";
  try { msg = clean_(e && e.message || stringifyGsError_(e) || ""); } catch (_e1) {}
  return /server error occurred/i.test(msg);
}

function withRetries_(fn, opts) {
  var cfg = opts && typeof opts === "object" ? opts : {};
  var attempts = Math.max(1, Number(cfg.attempts || 3));
  var sleepMs = Math.max(0, Number(cfg.sleepMs || 250));
  var backoff = Math.max(1, Number(cfg.backoff || 2));
  var maxTotalMs = Math.max(0, Number(cfg.maxTotalMs || 8000));
  var dbg = clean_(cfg.dbg || "");
  var label = clean_(cfg.label || "retry");
  var lastErr = null;
  var totalSleepMs = 0;
  for (var i = 0; i < attempts; i++) {
    try {
      return fn();
    } catch (e) {
      lastErr = e;
      var retryable = isDriveServerError_(e);
      if (!retryable || i >= attempts - 1) throw e;
      var plannedSleep = Math.round(sleepMs * Math.pow(backoff, i));
      if (maxTotalMs > 0 && totalSleepMs + plannedSleep > maxTotalMs) {
        plannedSleep = Math.max(0, maxTotalMs - totalSleepMs);
      }
      try {
        logExecTrace_("RETRY_WAIT", dbg, {
          label: label,
          attempt: i + 1,
          attempts: attempts,
          sleepMs: plannedSleep,
          err: clean_(stringifyGsError_(e) || "")
        });
      } catch (_logRetry) {}
      if (plannedSleep > 0) {
        Utilities.sleep(plannedSleep);
        totalSleepMs += plannedSleep;
      }
    }
  }
  throw lastErr || new Error("Retry failed");
}

function safeHttpErr_(resText, status) {
  var body = "";
  try { body = String(resText || ""); } catch (_e) {}
  body = body.replace(/\s+/g, " ").trim();
  if (body.length > 500) body = body.slice(0, 500);
  return {
    status: Number(status || 0),
    bodySnippet: body
  };
}

function oauthHeaders_() {
  return {
    Authorization: "Bearer " + ScriptApp.getOAuthToken()
  };
}

function buildUrlWithParams_(baseUrl, params) {
  var url = clean_(baseUrl);
  var q = [];
  var p = params && typeof params === "object" ? params : {};
  Object.keys(p).forEach(function (k) {
    var v = p[k];
    if (v === null || v === undefined || v === "") return;
    q.push(encodeURIComponent(k) + "=" + encodeURIComponent(String(v)));
  });
  if (!q.length) return url;
  return url + (url.indexOf("?") >= 0 ? "&" : "?") + q.join("&");
}

function buildPortalUploadReturnUrl_(baseExecUrl, params) {
  var base = clean_(baseExecUrl);
  var p = params && typeof params === "object" ? params : {};
  return buildUrlWithParams_(base, p);
}

function urlFetchJson_(url, opts) {
  var cfg = opts && typeof opts === "object" ? opts : {};
  var method = String(cfg.method || "get").toLowerCase();
  var headers = cfg.headers && typeof cfg.headers === "object" ? shallowCopy_(cfg.headers) : {};
  var payload = cfg.payload;
  var mute = cfg.muteHttpExceptions !== false;
  var fetchOpts = {
    method: method,
    headers: headers,
    muteHttpExceptions: mute
  };
  if (cfg.contentType) fetchOpts.contentType = cfg.contentType;
  if (payload !== undefined) fetchOpts.payload = payload;
  var resp = UrlFetchApp.fetch(url, fetchOpts);
  var status = Number(resp.getResponseCode() || 0);
  var text = String(resp.getContentText() || "");
  var parsed = null;
  try { parsed = JSON.parse(text || "null"); } catch (_jsonErr) {}
  return {
    ok: status >= 200 && status < 300,
    status: status,
    json: parsed,
    text: text
  };
}

function driveApiGet_(path, params) {
  var base = clean_(CONFIG.DRIVE_API_BASE || "https://www.googleapis.com/drive/v3");
  var url = buildUrlWithParams_(base + path, params);
  return urlFetchJson_(url, {
    method: "get",
    headers: oauthHeaders_(),
    muteHttpExceptions: true
  });
}

function driveApiPost_(path, body, params) {
  var base = clean_(CONFIG.DRIVE_API_BASE || "https://www.googleapis.com/drive/v3");
  var url = buildUrlWithParams_(base + path, params);
  return urlFetchJson_(url, {
    method: "post",
    headers: oauthHeaders_(),
    contentType: "application/json",
    payload: JSON.stringify(body || {}),
    muteHttpExceptions: true
  });
}

function driveApiMultipartUpload_(metadata, blob) {
  var boundary = "fode_" + Utilities.getUuid().replace(/-/g, "");
  var uploadBase = clean_(CONFIG.DRIVE_UPLOAD_BASE || "https://www.googleapis.com/upload/drive/v3");
  var fields = clean_(CONFIG.DRIVE_FIELDS_FILE || "id,name,webViewLink,parents");
  var url = buildUrlWithParams_(uploadBase + "/files", {
    uploadType: "multipart",
    fields: fields
  });
  var metaJson = JSON.stringify(metadata || {});
  var pre = ""
    + "--" + boundary + "\r\n"
    + "Content-Type: application/json; charset=UTF-8\r\n\r\n"
    + metaJson + "\r\n"
    + "--" + boundary + "\r\n"
    + "Content-Type: " + clean_(blob && blob.getContentType && blob.getContentType() || "application/octet-stream") + "\r\n\r\n";
  var post = "\r\n--" + boundary + "--";
  var bytes = []
    .concat(Utilities.newBlob(pre).getBytes())
    .concat(blob.getBytes())
    .concat(Utilities.newBlob(post).getBytes());
  return urlFetchJson_(url, {
    method: "post",
    headers: oauthHeaders_(),
    contentType: "multipart/related; boundary=" + boundary,
    payload: bytes,
    muteHttpExceptions: true
  });
}

function getOrCreateFolderByName_(parentFolder, name, dbg) {
  var parent = parentFolder;
  var folderName = clean_(name);
  var it = parent.getFoldersByName(folderName);
  if (it.hasNext()) return it.next();
  var created = parent.createFolder(folderName);
  try {
    logExecTrace_("YEAR_FOLDER_CREATED", dbg, {
      event: "YEAR_FOLDER_CREATED",
      yearFolderName: folderName,
      yearFolderId: clean_(created && created.getId && created.getId() || "")
    });
  } catch (_e) {}
  return created;
}

function classifyUploadErr_(e) {
  try {
    var explicit = clean_(e && (e.errCode || e.code) || "");
    if (explicit) return explicit;
  } catch (_e0) {}
  var msg = "";
  try { msg = clean_(e && e.message || stringifyGsError_(e) || ""); } catch (_e1) {}
  var lower = msg.toLowerCase();
  if (lower.indexOf("server error occurred") >= 0 && (lower.indexOf("folder_root_") >= 0 || lower.indexOf("drive_probe") >= 0)) {
    return "driveapp_unavailable";
  }
  if (lower.indexOf("driveapp_unavailable") >= 0) return "driveapp_unavailable";
  if (lower.indexOf("folder_root_unusable") >= 0) return "folder_root_unusable";
  if (lower.indexOf("folder_root_unset") >= 0) return "folder_root_unset";
  return "server_exception";
}

function decodeBase64DataUrl_(dataUrl) {
  var raw = String(dataUrl || "");
  var mimeType = "";
  var payload = raw;
  var m = raw.match(/^data:([^;]+);base64,(.+)$/i);
  if (m) {
    mimeType = clean_(m[1] || "");
    payload = String(m[2] || "");
  }
  if (!payload) throw new Error("Missing base64 payload");
  return {
    mimeType: mimeType,
    bytes: Utilities.base64Decode(payload)
  };
}

function base64FromText_(text) {
  return Utilities.base64Encode(String(text || ""), Utilities.Charset.UTF_8);
}

function safeFileName_(name) {
  var s = clean_(name || "") || ("upload_" + Date.now());
  s = s.replace(/[\\\/:\*\?\"<>\|]+/g, "_");
  s = s.replace(/\s+/g, " ").trim();
  if (s.length > 180) {
    var dot = s.lastIndexOf(".");
    if (dot > 0 && dot < s.length - 1) {
      var ext = s.slice(dot);
      var base = s.slice(0, dot);
      s = base.slice(0, Math.max(1, 180 - ext.length)) + ext;
    } else {
      s = s.slice(0, 180);
    }
  }
  return s || ("upload_" + Date.now());
}

function logPortalUploadError_(dbgId, applicantId, fieldName, msg, extraObj) {
  try {
    var payload = {
      applicantId: clean_(applicantId || ""),
      field: clean_(fieldName || ""),
      dbgId: clean_(dbgId || ""),
      message: clean_(msg || "")
    };
    var extra = extraObj && typeof extraObj === "object" ? extraObj : {};
    var compact = {};
    Object.keys(extra).forEach(function (k) {
      var v = extra[k];
      if (v === null || v === undefined) return;
      var s = (typeof v === "string") ? v : JSON.stringify(v);
      if (!s) return;
      compact[k] = s.length > 400 ? s.slice(0, 400) : s;
    });
    if (Object.keys(compact).length) payload.extra = compact;
    var ss = getWorkingSpreadsheet_();
    var sh = mustGetSheet_(ss, CONFIG.LOG_SHEET);
    log_(sh, "PORTAL_UPLOAD_FAIL", JSON.stringify(payload));
  } catch (e) {
    // Best-effort only; never break upload flow.
  }
}

function getZohoToken_() {
  var props = PropertiesService.getScriptProperties();
  var cached = clean_(props.getProperty("ZOHO_ACCESS_TOKEN") || "");
  var expMs = Number(props.getProperty("ZOHO_ACCESS_TOKEN_EXP_MS") || 0);
  if (cached && expMs > (Date.now() + 60 * 1000)) return cached;

  var refreshToken = clean_(props.getProperty("ZOHO_REFRESH_TOKEN") || "");
  var clientId = clean_(props.getProperty("ZOHO_CLIENT_ID") || "");
  var clientSecret = clean_(props.getProperty("ZOHO_CLIENT_SECRET") || "");
  if (!refreshToken || !clientId || !clientSecret) {
    throw new Error("Missing Zoho OAuth script properties.");
  }

  var endpoint = clean_(CONFIG.ZOHO_OAUTH_BASE || "https://accounts.zoho.com/oauth/v2") + "/token";
  var resp = UrlFetchApp.fetch(endpoint, {
    method: "post",
    muteHttpExceptions: true,
    payload: {
      refresh_token: refreshToken,
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token"
    }
  });
  var code = Number(resp.getResponseCode() || 0);
  var body = String(resp.getContentText() || "");
  var parsed;
  try { parsed = JSON.parse(body || "{}"); } catch (e) { parsed = {}; }
  if (code < 200 || code >= 300 || !clean_(parsed.access_token || "")) {
    throw new Error("Zoho token refresh failed (" + code + ")");
  }
  var accessToken = clean_(parsed.access_token);
  var expiresIn = Number(parsed.expires_in || parsed.expires_in_sec || 3600);
  props.setProperty("ZOHO_ACCESS_TOKEN", accessToken);
  props.setProperty("ZOHO_ACCESS_TOKEN_EXP_MS", String(Date.now() + Math.max(120, expiresIn - 60) * 1000));
  return accessToken;
}

function upsertZohoContact_(token, payloadRowObj) {
  var p = payloadRowObj || {};
  var data = {
    First_Name: clean_(p.firstName || ""),
    Last_Name: clean_(p.lastName || p.fullName || "Unknown"),
    Email: clean_(p.effectiveEmail || ""),
    Phone: clean_(p.parentPhone || "")
  };
  var body = {
    data: [data],
    duplicate_check_fields: ["Email", "Phone"]
  };
  var endpoint = clean_(CONFIG.ZOHO_API_BASE || "https://www.zohoapis.com/crm/v2") + "/Contacts/upsert";
  var res = UrlFetchApp.fetch(endpoint, {
    method: "post",
    muteHttpExceptions: true,
    contentType: "application/json",
    headers: { Authorization: "Zoho-oauthtoken " + clean_(token) },
    payload: JSON.stringify(body)
  });
  var code = Number(res.getResponseCode() || 0);
  var text = String(res.getContentText() || "");
  var parsed;
  try { parsed = JSON.parse(text || "{}"); } catch (e) { parsed = {}; }
  if (code < 200 || code >= 300) throw new Error("Zoho contact upsert failed (" + code + ")");
  var item = (parsed.data && parsed.data[0]) ? parsed.data[0] : {};
  var id = clean_((item.details && item.details.id) || item.id || "");
  if (!id) throw new Error("Zoho contact upsert returned no id");
  return { id: id, response: parsed };
}

function upsertZohoDeal_(token, payloadRowObj, folderUrl, contactId) {
  var p = payloadRowObj || {};
  var duplicateField = clean_(CONFIG.DEAL_DUPLICATE_FIELD || "FormID");
  var stableFormId = clean_(p.formId || "");
  var applicantId = clean_(p.applicantId || "");
  var dedupeValue = stableFormId || applicantId;
  var dealName = clean_(p.fullName || "") || applicantId || "FODE Applicant";
  dealName += applicantId ? (" - " + applicantId) : "";

  var dealData = {
    Deal_Name: dealName,
    Stage: clean_(p.crmStage || CONFIG.CRM_STAGE_PAYMENT_VERIFIED || CONFIG.DEAL_STAGE || "Qualification")
  };
  if (clean_(p.crmPipeline || CONFIG.CRM_PIPELINE_FODE || "")) {
    // Best-effort; ignored by Zoho if this field name is not present in the module layout.
    dealData.Pipeline = clean_(p.crmPipeline || CONFIG.CRM_PIPELINE_FODE || "");
  }
  if (clean_(contactId)) dealData.Contact_Name = { id: clean_(contactId) };
  if (duplicateField && dedupeValue) dealData[duplicateField] = dedupeValue;
  var ownerId = clean_(PropertiesService.getScriptProperties().getProperty("FODE_DEFAULT_OWNER_ID") || "");
  if (ownerId) dealData.Owner = { id: ownerId };
  if (clean_(folderUrl || "")) dealData.Description = "Folder: " + clean_(folderUrl);

  var body = {
    data: [dealData],
    duplicate_check_fields: duplicateField && dedupeValue ? [duplicateField] : ["Deal_Name"]
  };
  var endpoint = clean_(CONFIG.ZOHO_API_BASE || "https://www.zohoapis.com/crm/v2") + "/Deals/upsert";
  var res = UrlFetchApp.fetch(endpoint, {
    method: "post",
    muteHttpExceptions: true,
    contentType: "application/json",
    headers: { Authorization: "Zoho-oauthtoken " + clean_(token) },
    payload: JSON.stringify(body)
  });
  var code = Number(res.getResponseCode() || 0);
  var text = String(res.getContentText() || "");
  var parsed;
  try { parsed = JSON.parse(text || "{}"); } catch (e) { parsed = {}; }
  if (code < 200 || code >= 300) throw new Error("Zoho deal upsert failed (" + code + ")");
  var item = (parsed.data && parsed.data[0]) ? parsed.data[0] : {};
  var id = clean_((item.details && item.details.id) || item.id || "");
  if (!id) throw new Error("Zoho deal upsert returned no id");
  return { id: id, response: parsed };
}

function getCurrentWebAppUrl_() {
  try {
    var svc = ScriptApp.getService();
    if (!svc || typeof svc.getUrl !== "function") return "";
    return clean_(svc.getUrl() || "");
  } catch (e) {
    return "";
  }
}

function canonicalizeWebAppUrl_(url) {
  var raw = clean_(url || "");
  if (!raw) return "";
  var m = raw.match(/^https:\/\/script\.google\.com(?:\/a\/[^/]+)?\/macros\/s\/([a-zA-Z0-9_-]+)\/exec(?:[?#].*)?$/i);
  if (m && m[1]) return "https://script.google.com/macros/s/" + m[1] + "/exec";
  if (/^https:\/\/script\.google\.com\/a\//i.test(raw)) {
    raw = raw.replace(/^https:\/\/script\.google\.com\/a\/[^/]+\//i, "https://script.google.com/");
  }
  return raw.replace(/[?#].*$/, "").replace(/\/+$/, "");
}

function getStudentBaseUrl_() {
  var configured = clean_(CONFIG.WEBAPP_URL_STUDENT || CONFIG.WEBAPP_URL_STUDENT_EXEC || "");
  if (configured) return canonicalizeWebAppUrl_(configured);
  return canonicalizeWebAppUrl_(getCurrentWebAppUrl_());
}

function buildExecUrlFromDeploymentId_(deploymentId) {
  var id = clean_(deploymentId || "");
  if (!id) return "";
  return "https://script.google.com/macros/s/" + id + "/exec";
}

function canonicalExecBase_(urlOrId) {
  var raw = clean_(urlOrId || "");
  if (!raw) return "";
  var deploymentId = "";
  if (/^AKfy[a-zA-Z0-9_-]+$/.test(raw)) {
    deploymentId = raw;
  } else {
    deploymentId = extractDeploymentIdFromExecUrl_(raw);
  }
  if (!deploymentId) return "";
  return buildExecUrlFromDeploymentId_(deploymentId);
}

function isDomainScopedMacrosUrl_(url) {
  return /https:\/\/script\.google\.com\/a\/(?:[^/]+\/)?macros\//i.test(clean_(url || ""));
}

function canonicalizeToMacros_(deploymentId) {
  var raw = clean_(deploymentId || "");
  var id = raw;
  var m = raw.match(/\/macros\/s\/([^/]+)\/exec/i);
  if (m && m[1]) id = clean_(m[1]);
  if (!id) return "";
  return "https://script.google.com/macros/s/" + id + "/exec";
}

function extractDeploymentIdFromExecUrl_(url) {
  var raw = clean_(url || "");
  if (!raw) return "";
  var m1 = raw.match(/\/macros\/s\/([^/]+)\/exec/i);
  if (m1 && m1[1]) return clean_(m1[1]);
  var m2 = raw.match(/\/s\/([^/]+)\/exec/i);
  if (m2 && m2[1]) return clean_(m2[1]);
  return "";
}

function pickCanonicalExecBase_(e) {
  var qsView = (e && e.parameter && e.parameter.view) ? e.parameter.view : "";

  if (qsView === "admin") return CONFIG.WEBAPP_URL_ADMIN;
  if (qsView === "portal" || qsView === "student") return CONFIG.WEBAPP_URL_STUDENT;

  // fallback to admin if unknown
  return CONFIG.WEBAPP_URL_ADMIN;
}

function toIsoDateInput_(value) {
  if (value instanceof Date) {
    if (isNaN(value.getTime())) return "";
    var tz = Session.getScriptTimeZone() || "Pacific/Port_Moresby";
    return Utilities.formatDate(value, tz, "yyyy-MM-dd");
  }

  var raw = clean_(value);
  if (!raw) return "";

  var ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    var y1 = Number(ymd[1]);
    var m1 = Number(ymd[2]);
    var d1 = Number(ymd[3]);
    return isValidYmd_(y1, m1, d1) ? raw : "";
  }

  var dmy = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (dmy) {
    var d2 = Number(dmy[1]);
    var m2 = Number(dmy[2]);
    var y2 = Number(dmy[3]);
    if (!isValidYmd_(y2, m2, d2)) return "";
    return String(y2) + "-" + String(m2).padStart(2, "0") + "-" + String(d2).padStart(2, "0");
  }

  return "";
}

function isValidYmd_(y, m, d) {
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return false;
  var dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && (dt.getUTCMonth() + 1) === m && dt.getUTCDate() === d;
}

function normalize_(v) {
  if (v === null || v === undefined) return "";
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function slug_(s) {
  return clean_(s).toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function log_(sheet, label, msg) {
  sheet.appendRow([new Date(), label, msg || ""]);
}

function payloadSummary_(p) {
  return JSON.stringify({
    First_Name: p.First_Name,
    Last_Name: p.Last_Name,
    Grade: p.Grade_Applying_For,
    Intake: p.Intake_Year || p["Intake Year"] || ""
  });
}

function hasOwn_(obj, key) {
  return !!obj && Object.prototype.hasOwnProperty.call(obj, key);
}

function clampInt_(value, min, max) {
  var n = Number(value);
  if (!isFinite(n)) n = Number(min || 0);
  n = Math.floor(n);
  if (isFinite(min)) n = Math.max(Number(min), n);
  if (isFinite(max)) n = Math.min(Number(max), n);
  return n;
}

function nowMs_() {
  return Date.now();
}

function elapsedMs_(t0) {
  return Date.now() - Number(t0 || 0);
}

function logExecTrace_(tag, dbg, obj) {
  try {
    var payload = obj && typeof obj === "object" ? shallowCopy_(obj) : {};
    payload.dbg = clean_(dbg || payload.dbg || "");
    payload.tag = clean_(tag || "");
    payload.ts = new Date().toISOString();
    var msg = JSON.stringify(payload, function (key, value) {
      var k = String(key || "").toLowerCase();
      if (k === "base64" || k.indexOf("base64") >= 0 || k === "dataurl") return "[omitted]";
      return value;
    });
    Logger.log((payload.tag || "TRACE") + " " + msg);
  } catch (_e) {
    try { Logger.log(String(tag || "TRACE")); } catch (_e2) {}
  }
}

function normalizeRowNumbers_(arr, lastRow, maxCount) {
  var list = Array.isArray(arr) ? arr : [];
  var out = [];
  var seen = {};
  var upper = Number(lastRow || 0);
  var limit = Number(maxCount || 0);
  for (var i = 0; i < list.length; i++) {
    var n = clampInt_(list[i], 0, upper || 0);
    if (!n || n < 2) continue;
    if (upper && n > upper) continue;
    if (seen[n]) continue;
    seen[n] = true;
    out.push(n);
    if (limit > 0 && out.length >= limit) break;
  }
  return out;
}

function normalizePayloadValue_(value) {
  if (typeof value === "string") return value.trim();
  if (Array.isArray(value)) {
    return value.map(function (item) {
      return (typeof item === "string") ? item.trim() : item;
    });
  }
  return value;
}

function parseRequestPayload_(e) {
  var out = {};
  var postData = (e && e.postData) ? e.postData : null;
  var raw = postData && postData.contents ? String(postData.contents) : "";
  var contentType = String((postData && (postData.type || postData.contentType)) || "").toLowerCase();
  var looksJson = contentType.indexOf("json") >= 0 || /^\s*\{/.test(raw);

  if (looksJson && raw) {
    try {
      var parsed = JSON.parse(raw);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        Object.keys(parsed).forEach(function (key) {
          out[key] = normalizePayloadValue_(parsed[key]);
        });
      }
    } catch (err) {
      // Best-effort JSON parse only; fall through to e.parameter payload.
    }
  }

  var params = (e && e.parameter && typeof e.parameter === "object") ? e.parameter : {};
  Object.keys(params).forEach(function (key) {
    out[key] = normalizePayloadValue_(params[key]);
  });

  return out;
}

function jsonOut_(obj) {
  var out = jsonOutput_(obj);
  if (out && typeof out.setHeader === "function") {
    out
      .setHeader("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0")
      .setHeader("Pragma", "no-cache");
  }
  return out;
}

function safeJsonForHtml_(obj) {
  var json = "";
  try {
    json = JSON.stringify(obj && typeof obj === "object" ? obj : {});
  } catch (_e) {
    json = JSON.stringify({ ok: false, code: "SERIALIZE_FAIL", message: "Failed to serialize payload." });
  }
  return String(json || "{}")
    .replace(/<\//g, "<\\/")
    .replace(/</g, "\\u003c")
    .replace(/\u2028/g, "\\u2028")
    .replace(/\u2029/g, "\\u2029");
}

function htmlIframeResult_(payload) {
  var msg = safeJsonForHtml_(payload || {});
  var html = ""
    + "<!doctype html><html><head><meta charset=\"utf-8\" />"
    + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />"
    + "<title>Upload Result</title></head><body>"
    + "<script>"
    + "(function(){"
    + "var payload=" + msg + ";"
    + "try{ if(window.parent&&window.parent.postMessage){ window.parent.postMessage(payload,'*'); } }catch(e){}"
    + "document.body.textContent='PORTAL_UPLOAD_RESULT '+(payload&&payload.ok?'ok':'fail');"
    + "})();"
    + "</script>"
    + "<noscript>PORTAL_UPLOAD_RESULT</noscript>"
    + "</body></html>";
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function htmlMetaRedirect_(url, title, message) {
  var u = clean_(url || "");
  var pageTitle = clean_(title || "Redirecting");
  var msg = clean_(message || "Redirecting...");
  var hasUrl = !!u;
  var refreshContent = hasUrl ? ("0;url=" + u) : "";
  var html = ""
    + "<!doctype html><html><head><meta charset=\"utf-8\" />"
    + "<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\" />"
    + (hasUrl ? ("<meta http-equiv=\"refresh\" content=\"" + esc_(refreshContent) + "\" />") : "")
    + "<title>" + esc_(pageTitle) + "</title>"
    + "</head><body style=\"font-family:Arial,Helvetica,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;color:#111;\">"
    + "<h3 style=\"margin:0 0 8px 0;\">" + esc_(pageTitle) + "</h3>"
    + "<p style=\"margin:0 0 12px 0;\">" + esc_(msg) + "</p>";
  if (hasUrl) {
    html += ""
      + "<p style=\"margin:0 0 12px 0;\"><a href=\"" + esc_(u) + "\" target=\"_top\" style=\"display:inline-block;padding:8px 12px;border-radius:8px;border:1px solid #0b57d0;background:#1a73e8;color:#fff;text-decoration:none;font-weight:600;\">Continue</a></p>"
      + "<p style=\"margin:0 0 6px 0;font-size:12px;color:#444;\">If the redirect does not start automatically, use the Continue button above.</p>"
      + "<p style=\"margin:0;font-size:12px;color:#444;\"><b>URL:</b> <span style=\"word-break:break-all;\">" + esc_(u) + "</span></p>";
  } else {
    html += "<p style=\"margin:0;font-size:12px;color:#b00020;\">Return URL unavailable. Please reopen your portal link.</p>";
  }
  html += "</body></html>";
  return HtmlService.createHtmlOutput(html)
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function esc_(s) {
  return String(s === null || s === undefined ? "" : s)
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}

function shallowCopy_(obj) {
  var out = {};
  for (var k in obj) out[k] = obj[k];
  return out;
}

function truncate_(s, n) {
  var str = String(s === null || s === undefined ? "" : s);
  var max = Math.max(0, Number(n || 0));
  if (!max) return "";
  return str.length > max ? str.slice(0, max) : str;
}

function firstLine_(s, maxChars) {
  var str = String(s === null || s === undefined ? "" : s);
  var idx = str.indexOf("\r\n");
  if (idx < 0) idx = str.indexOf("\n");
  if (idx < 0) idx = str.length;
  return truncate_(str.slice(0, idx), Math.max(0, Number(maxChars || 80)));
}

function safeKeys_(obj) {
  try {
    if (!obj || typeof obj !== "object") return [];
    return Object.keys(obj);
  } catch (_e) {
    return [];
  }
}

function isValidEmail_(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean_(email));
}

// IMPORTANT: regex literal must be /^https?:\/\//i (no extra escaping)
function isHttpUrl_(s) {
  return /^https?:\/\//i.test(String(s || "").trim());
}

function getPortalEditableFields_() {
  if (CONFIG.PORTAL_EDIT_MODE === "ALL_VISIBLE_EXCEPT_NON_EDIT") {
    var nonEdit = new Set(CONFIG.PORTAL_NON_EDIT_FIELDS || []);
    var exclude = new Set(CONFIG.PORTAL_EDIT_EXCLUDE_FIELDS || []);
    return (CONFIG.PORTAL_VISIBLE_FIELDS || []).filter(function (f) {
      return !nonEdit.has(f) && !exclude.has(f);
    });
  }
  return CONFIG.PORTAL_EDIT_FIELDS || [];
}

function newPortalSecret_() {
  // 64 hex chars from two UUIDs; take first 32 for compact URL-safe token.
  var bytes = Utilities.getUuid().replace(/-/g, "") + Utilities.getUuid().replace(/-/g, "");
  return bytes.slice(0, 32);
}

function hashPortalSecret_(secret) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    String(secret || ""),
    Utilities.Charset.UTF_8
  );
  var out = [];
  for (var i = 0; i < bytes.length; i++) {
    var b = (bytes[i] + 256) % 256;
    var h = b.toString(16);
    out.push(h.length === 1 ? "0" + h : h);
  }
  return out.join("");
}

function secretHashPrefix_(secret) {
  var s = clean_(secret || "");
  if (!s) return "";
  try {
    return clean_(hashPortalSecret_(s)).slice(0, 8);
  } catch (_e) {
    return "";
  }
}

function openPortalSecrets_() {
  assertDriveId_(CONFIG.PORTAL_SECRETS_SHEET_ID, "CONFIG.PORTAL_SECRETS_SHEET_ID");
  var ss = SpreadsheetApp.openById(CONFIG.PORTAL_SECRETS_SHEET_ID);
  var tabName = clean_(CONFIG.PORTAL_SECRETS_TAB || "PortalSecrets");
  var sh = ss.getSheetByName(tabName);
  if (!sh) sh = ss.insertSheet(tabName);
  ensurePortalSecretsHeaders_(sh);
  return sh;
}

function ensurePortalSecretsHeaders_(sheet) {
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
  var lastCol = Math.max(sheet.getLastColumn(), expected.length);
  var current = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (v) {
    return clean_(v);
  });
  var changed = false;
  for (var i = 0; i < expected.length; i++) {
    if (current.indexOf(expected[i]) === -1) {
      current.push(expected[i]);
      changed = true;
    }
  }
  if (changed) {
    sheet.getRange(1, 1, 1, current.length).setValues([current]);
  }
}

function findPortalSecretsRowByApplicantId_(sheet, applicantId) {
  var id = clean_(applicantId);
  if (!id) return null;
  var idx = getHeaderIndexMap_(sheet);
  if (!idx.ApplicantID) throw new Error("PortalSecrets missing header: ApplicantID");
  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;
  var vals = sheet.getRange(2, idx.ApplicantID, lastRow - 1, 1).getValues();
  for (var i = 0; i < vals.length; i++) {
    if (clean_(vals[i][0]) === id) return i + 2;
  }
  return null;
}

function readPortalSecretsRecord_(sheet, rowIndex) {
  var headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  var row = sheet.getRange(rowIndex, 1, 1, sheet.getLastColumn()).getValues()[0];
  var out = {};
  for (var i = 0; i < headers.length; i++) {
    var h = clean_(headers[i]);
    if (h) out[h] = row[i];
  }
  return out;
}

function makePortalSecretPlain_() {
  var p1 = Utilities.getUuid().replace(/-/g, "");
  var p2 = Utilities.getUuid().replace(/-/g, "");
  return (p1 + p2).slice(0, 32);
}

function getOrCreateActivePortalSecret_(applicantId, email, fullName, admissionsSheet, rowNumber, opts) {
  opts = opts || {};
  var dryRun = opts.dryRun === true;
  var id = clean_(applicantId);
  if (!id) throw new Error("Missing ApplicantID for PortalSecrets");

  var secretsSheet = opts.secretsSheet || openPortalSecrets_();
  var idx = getHeaderIndexMap_(secretsSheet);
  var rowIndex = findPortalSecretsRowByApplicantId_(secretsSheet, id);

  if (rowIndex) {
    var rec = readPortalSecretsRecord_(secretsSheet, rowIndex);
    var status = clean_(rec.Status);
    var existingPlain = clean_(rec.Secret_Plain);
    var existingHash = clean_(rec.Secret_Hash);
    var createdAt = rec.Created_At || "";
    if (status === "Active" && existingPlain && existingHash) {
      if (!dryRun && admissionsSheet && rowNumber && !clean_(opts.skipAdmissionsHashWrite || "")) {
        var rowObj = getRowObject_(admissionsSheet, Number(rowNumber));
        var currentHash = clean_(rowObj[SCHEMA.PORTAL_TOKEN_HASH] || "");
        if (!currentHash || opts.forceHashWrite === true) {
          setPortalTokenHashForRow_(admissionsSheet, Number(rowNumber), existingHash);
        }
      }
      return {
        secretPlain: existingPlain,
        secretHash: existingHash,
        createdAt: createdAt,
        existed: true,
        created: false,
        rowIndex: rowIndex
      };
    }
  }

  var generatedPlain = makePortalSecretPlain_();
  var generatedHash = hashPortalSecret_(generatedPlain);
  var now = new Date();
  if (!dryRun) {
    secretsSheet.appendRow([
      id,
      clean_(email),
      clean_(fullName),
      generatedPlain,
      generatedHash,
      now.toISOString(),
      "",
      "Active"
    ]);
    if (admissionsSheet && rowNumber && !clean_(opts.skipAdmissionsHashWrite || "")) {
      setPortalTokenHashForRow_(admissionsSheet, Number(rowNumber), generatedHash);
    }
  }
  return {
    secretPlain: generatedPlain,
    secretHash: generatedHash,
    createdAt: now.toISOString(),
    existed: false,
    created: true,
    rowIndex: null,
    dryRun: dryRun
  };
}

function withSpreadsheetRetry_(fn) {
  var delays = [200, 600, 1400];
  var lastErr = null;
  for (var i = 0; i < delays.length + 1; i++) {
    try {
      return fn();
    } catch (e) {
      lastErr = e;
      var msg = e && e.message ? String(e.message) : String(e);
      var retriable = msg.indexOf("Service Spreadsheets failed") >= 0;
      if (!retriable || i >= delays.length) throw e;
      Utilities.sleep(delays[i]);
    }
  }
  if (lastErr) throw lastErr;
  throw new Error("Spreadsheet retry failed");
}

function buildPortalSecretsIndex_(secretsSheet) {
  var idx = getHeaderIndexMap_(secretsSheet);
  if (!idx.ApplicantID) throw new Error("PortalSecrets missing header: ApplicantID");
  var data = withSpreadsheetRetry_(function () {
    return secretsSheet.getDataRange().getValues();
  });
  var byApplicantId = {};
  for (var r = 1; r < data.length; r++) {
    var row = data[r];
    var applicantId = clean_(row[idx.ApplicantID - 1]);
    if (!applicantId) continue;
    byApplicantId[applicantId] = {
      rowIndex: r + 1,
      status: clean_(idx.Status ? row[idx.Status - 1] : ""),
      secretHash: clean_(idx.Secret_Hash ? row[idx.Secret_Hash - 1] : "")
    };
  }
  return {
    byApplicantId: byApplicantId,
    lastRow: withSpreadsheetRetry_(function () { return secretsSheet.getLastRow(); })
  };
}

/******************** PHASE 0 — SAFETY RAILS ********************/

function assertDriveId_(id, label) {
  if (!id || typeof id !== "string" || !/^[a-zA-Z0-9_-]{20,}$/.test(id)) {
    throw new Error(label + " missing/invalid: [" + id + "]");
  }
}

/**
 * Phase 0 — dependency smoke test (read-only).
 * Run this after every change before doing any other testing.
 */
function test_Smoke() {
  Logger.log("===== SMOKE TEST START =====");
  Logger.log("CONFIG.VERSION = " + (CONFIG.VERSION || "MISSING"));

  // Validate IDs
  assertDriveId_(getWorkingSpreadsheetId_(), "WORKING_SHEET_ID");
  assertDriveId_(CONFIG.LOG_SHEET_ID, "CONFIG.LOG_SHEET_ID");
  assertDriveId_(CONFIG.ROOT_FOLDER_ID, "CONFIG.ROOT_FOLDER_ID");

  // Open main spreadsheet + data sheet
  var ss = getWorkingSpreadsheet_();
  var dataSh = ss.getSheetByName(CONFIG.DATA_SHEET);
  if (!dataSh) throw new Error("Missing DATA_SHEET tab: " + CONFIG.DATA_SHEET);
  Logger.log("DATA_SHEET OK: " + CONFIG.DATA_SHEET);

  // Open portal log spreadsheet + sheet
  var logSS = SpreadsheetApp.openById(CONFIG.LOG_SHEET_ID);
  var portalLogSh = logSS.getSheetByName(CONFIG.LOG_SHEET_NAME);
  if (!portalLogSh) throw new Error("Missing LOG_SHEET_NAME tab: " + CONFIG.LOG_SHEET_NAME);
  Logger.log("LOG_SHEET_NAME OK: " + CONFIG.LOG_SHEET_NAME);

  // Open root Drive folder
  var root = DriveApp.getFolderById(CONFIG.ROOT_FOLDER_ID);
  Logger.log("ROOT_FOLDER OK: " + root.getName());

  // Optional: Exam sites tab check (non-fatal warning)
  var exam = ss.getSheetByName(CONFIG.EXAM_SITES_SHEET);
  if (!exam) Logger.log("WARN: Missing EXAM_SITES_SHEET tab: " + CONFIG.EXAM_SITES_SHEET);
  else Logger.log("EXAM_SITES_SHEET OK: " + CONFIG.EXAM_SITES_SHEET);

  Logger.log("===== SMOKE TEST PASSED =====");
}

/******************** PHASE 1 — CENTRALIZED SHEET IO ********************/

/**
 * Builds a 1-based column index map from the header row.
 */
function getHeaderIndexMap_(sheet) {
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) {
    return String(h).trim();
  });
  var map = {};
  headers.forEach(function (h, i) {
    if (!h) return;
    map[h] = i + 1;
    var normalized = h.replace(/\s+/g, "_");
    if (normalized && !map[normalized]) map[normalized] = i + 1;
  });
  return map;
}

function getWorkingSpreadsheetId_() {
  var mode = clean_(CONFIG.DATA_MODE || "STAGING").toUpperCase();
  if (mode === "PROD") return clean_(CONFIG.SHEET_ID_PROD || CONFIG.SPREADSHEET_ID_PROD || CONFIG.SHEET_ID || "");
  return clean_(CONFIG.SPREADSHEET_ID_STAGING || CONFIG.SHEET_ID_STAGING || CONFIG.SHEET_ID || "");
}

function getWorkingSpreadsheet_() {
  var dbgId = (typeof newDebugId_ === "function") ? newDebugId_() : ("DBG-" + Utilities.getUuid().slice(0, 8));
  var rawMode = (CONFIG && CONFIG.DATA_MODE !== undefined) ? String(CONFIG.DATA_MODE) : "STAGING";
  var mode = clean_(rawMode).toUpperCase();
  if (mode !== "PROD" && mode !== "STAGING") {
    Logger.log("GET_WORKING_SS_BAD_MODE " + dbgId + " rawMode=" + rawMode + " -> default STAGING");
    mode = "STAGING";
  }

  var spreadsheetId = (mode === "PROD")
    ? clean_(CONFIG.SPREADSHEET_ID_PROD || "")
    : clean_(CONFIG.SPREADSHEET_ID_STAGING || "");
  Logger.log("GET_WORKING_SS_START " + dbgId + " mode=" + mode + " spreadsheetId=" + spreadsheetId);

  if (!spreadsheetId) {
    Logger.log("GET_WORKING_SS_FAIL " + dbgId + " mode=" + mode + " spreadsheetId= err=missing spreadsheetId");
    throw new Error("Missing spreadsheetId for mode=" + mode + ". DebugId=" + dbgId);
  }

  var ss;
  try {
    ss = SpreadsheetApp.openById(spreadsheetId);
  } catch (e) {
    Logger.log("GET_WORKING_SS_FAIL " + dbgId + " mode=" + mode + " spreadsheetId=" + spreadsheetId + " err=" + (e && e.message ? e.message : e));
    throw new Error("Cannot open working spreadsheet for mode=" + mode + ". DebugId=" + dbgId);
  }

  if (!ss) {
    Logger.log("GET_WORKING_SS_FAIL " + dbgId + " mode=" + mode + " spreadsheetId=" + spreadsheetId + " err=SpreadsheetApp.openById returned null");
    throw new Error("Cannot open working spreadsheet for mode=" + mode + ". DebugId=" + dbgId);
  }

  var ssName = "";
  var ssId = "";
  try { ssName = clean_(ss.getName()); } catch (_nameErr) {}
  try { ssId = clean_(ss.getId()); } catch (_idErr) {}
  Logger.log("GET_WORKING_SS_OK " + dbgId + " ssName=" + ssName + " ssId=" + ssId);

  var requiredTab = clean_(CONFIG.SHEET_TAB_WORKING || CONFIG.SHEET_NAME_WORKING || "FODE_Data");
  var sheet = ss.getSheetByName(requiredTab);
  if (!sheet) {
    Logger.log("GET_WORKING_SS_MISSING_TAB " + dbgId + " requiredTab=" + requiredTab + " ssName=" + ssName);
    throw new Error("Working spreadsheet missing tab '" + requiredTab + "'. DebugId=" + dbgId);
  }

  return ss;
}

function getWorkingSheet_() {
  var ss = getWorkingSpreadsheet_();
  var tabName = clean_(CONFIG.SHEET_NAME_WORKING || CONFIG.SHEET_TAB_WORKING || CONFIG.DATA_SHEET || "FODE_Data");
  var sh = ss.getSheetByName(tabName);
  if (!sh) throw new Error("Missing working sheet tab: " + tabName);
  return sh;
}

/**
 * Returns an object mapping header -> value for the given row.
 */
function getRowObject_(sheet, rowIndex) {
  var lastCol = sheet.getLastColumn();
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0];
  var values = sheet.getRange(rowIndex, 1, 1, lastCol).getValues()[0];
  var obj = {};
  for (var i = 0; i < headers.length; i++) {
    var key = String(headers[i]).trim();
    if (key) obj[key] = values[i];
  }
  return obj;
}

/**
 * Finds applicant row by ApplicantID first, then Parent_Email.
 * Returns the 1-based row number, or null if not found.
 */
function findApplicantRow_(sheet, id, email) {
  var headerMap = getHeaderIndexMap_(sheet);

  var idHeader = SCHEMA.APPLICANT_ID;
  var emailHeader = SCHEMA.PARENT_EMAIL;

  if (!headerMap[idHeader]) throw new Error("Missing header: " + idHeader);
  if (!headerMap[emailHeader]) throw new Error("Missing header: " + emailHeader);

  var idCol = headerMap[idHeader];
  var emailCol = headerMap[emailHeader];

  var lastRow = sheet.getLastRow();
  if (lastRow < 2) return null;

  var idNorm = String(id || "").trim();
  var emailNorm = String(email || "").toLowerCase().trim();

  if (idNorm) {
    var idVals = sheet.getRange(2, idCol, lastRow - 1, 1).getValues();
    for (var r1 = 0; r1 < idVals.length; r1++) {
      if (String(idVals[r1][0]).trim() === idNorm) return r1 + 2;
    }
  }

  if (emailNorm) {
    var emailVals = sheet.getRange(2, emailCol, lastRow - 1, 1).getValues();
    for (var r2 = 0; r2 < emailVals.length; r2++) {
      if (String(emailVals[r2][0] || "").toLowerCase().trim() === emailNorm) return r2 + 2;
    }
  }

  return null;
}

/**
 * Applies a header->value patch to the given row (writes values).
 */
function applyPatch_(sheet, rowIndex, patchObj) {
  var headerMap = getHeaderIndexMap_(sheet);

  Object.keys(patchObj).forEach(function (header) {
    if (!headerMap[header]) throw new Error("Missing header (patch): " + header);
  });

  Object.keys(patchObj).forEach(function (header) {
    sheet.getRange(rowIndex, headerMap[header]).setValue(patchObj[header]);
  });
}

/******************** PHASE 2 — PORTAL LOGGING (NON-FATAL) ********************/

function safeStr_(v) {
  return String(v === null || v === undefined ? "" : v).trim();
}

function isSystemStabilizationModeActive_() {
  return CONFIG && CONFIG.SYSTEM_STABILIZATION_MODE === true;
}

function isManualSingleSendProbeEnabled_() {
  return CONFIG
    && CONFIG.ENABLE_CONTROLLED_MANUAL_SEND_PROBE === true
    && CONFIG.ENABLE_MANUAL_SINGLE_SENDS === true;
}

function isBatchSendEnabled_() {
  return CONFIG
    && CONFIG.SYSTEM_STABILIZATION_MODE !== true
    && CONFIG.ENABLE_BATCH_SENDS === true
    && CONFIG.ENABLE_PRODUCTION_EMAIL_SENDS === true;
}

function isBatchPreviewModeEnabled_() {
  return CONFIG && CONFIG.ENABLE_BATCH_PREVIEW_MODE === true;
}

function isTriggerSendEnabled_() {
  return CONFIG
    && CONFIG.SYSTEM_STABILIZATION_MODE !== true
    && CONFIG.ENABLE_TRIGGER_SENDS === true
    && CONFIG.ENABLE_TRIGGER_EMAIL_SENDS === true
    && CONFIG.ENABLE_PRODUCTION_EMAIL_SENDS === true;
}

function normalizeSendRecipient_(recipient) {
  return String(recipient == null ? "" : recipient)
    .split(/[;,]/)
    .map(function(part) { return safeStr_(part || "").toLowerCase(); })
    .filter(function(part) { return !!part; })
    .sort()
    .join(",");
}

function buildSendIdempotencyKey_(row, templateType, recipient, context) {
  var rowObj = row && typeof row === "object" ? row : {};
  var ctx = context && typeof context === "object" ? context : {};
  var applicantId = safeStr_(ctx.applicantId || rowObj.ApplicantID || (typeof SCHEMA !== "undefined" ? rowObj[SCHEMA.APPLICANT_ID] : "") || "");
  var formId = safeStr_(ctx.formId || rowObj.FormID || rowObj.FD_FormID || "");
  var stableIdentity = applicantId || formId || safeStr_(ctx.identity || "UNKNOWN");
  var normalizedTemplate = safeStr_(templateType || ctx.templateType || ctx.messageType || ctx.logLabel || ctx.action || "UNKNOWN").toLowerCase();
  var normalizedRecipient = normalizeSendRecipient_(recipient || ctx.recipient || ctx.effectiveEmail || rowObj.Parent_Email_Corrected || rowObj.Parent_Email || "");
  var normalizedContext = safeStr_(ctx.batchId || ctx.batchLabel || ctx.sendSource || ctx.source || ctx.scope || "DEFAULT").toLowerCase();
  return ["EMAIL", stableIdentity || "UNKNOWN", normalizedTemplate || "unknown", normalizedRecipient || "no_recipient", normalizedContext || "default"].join("::");
}

function isUnattendedEmailSource_(source) {
  var normalized = safeStr_(source || "").toUpperCase();
  return /TRIGGER|AUTOMATED|AUTO_|RUNNER|SCHEDULE|SCHEDULER|WORKFLOW|FOLLOWUP/.test(normalized);
}

function blockUnattendedEmailSendIfNeeded_(templateType, recipient, context) {
  var ctx = context && typeof context === "object" ? context : {};
  var source = safeStr_(ctx.sendSource || ctx.source || ctx.action || "");
  var unattended = ctx.unattended === true || isUnattendedEmailSource_(source);
  if (!unattended) return { blocked: false };
  if (CONFIG && CONFIG.ENABLE_UNATTENDED_EMAIL_SENDS === true) {
    return { blocked: false, reauthorized: true };
  }
  var rowObj = ctx.rowObj && typeof ctx.rowObj === "object" ? ctx.rowObj : {};
  var idempotencyKey = buildSendIdempotencyKey_(rowObj, templateType, recipient, ctx);
  logOperationalBlock_("STABILIZATION_UNATTENDED_SEND_BLOCK", {
    action: safeStr_(ctx.action || "email_send"),
    source: source || "UNATTENDED",
    applicantId: safeStr_(ctx.applicantId || rowObj.ApplicantID || ""),
    recipient: normalizeSendRecipient_(recipient || ""),
    templateType: safeStr_(templateType || ctx.templateType || ctx.messageType || ctx.logLabel || ""),
    debugId: safeStr_(ctx.debugId || ctx.requestId || ""),
    idempotencyKey: idempotencyKey
  });
  return {
    blocked: true,
    blockCode: "STABILIZATION_UNATTENDED_SEND_BLOCK",
    blockReason: "Unattended email sends are disabled during stabilization.",
    idempotencyKey: idempotencyKey
  };
}

function logOperationalBlock_(label, payload) {
  var tag = safeStr_(label || "OPERATION_BLOCKED");
  var data = payload && typeof payload === "object" ? payload : {};
  var line = tag + " " + JSON.stringify(data);
  try { console.log(line); } catch (_consoleErr) {}
  try { Logger.log(line); } catch (_loggerErr) {}
}

function systemStabilizationBlockResult_(action, code, requestId, extra) {
  var more = extra && typeof extra === "object" ? extra : {};
  var blockCode = safeStr_(code || "SYSTEM_STABILIZATION_MODE_ACTIVE");
  return {
    ok: false,
    action: safeStr_(action || ""),
    result: "BLOCKED",
    eligible: false,
    blockCode: blockCode,
    blockReason: safeStr_(more.blockReason || "System stabilization mode is active."),
    applicantId: safeStr_(more.applicantId || ""),
    messageType: safeStr_(more.messageType || ""),
    effectiveEmail: safeStr_(more.effectiveEmail || ""),
    debugId: safeStr_(requestId || more.debugId || "")
  };
}

function communicationCooldownCacheTtlSeconds_(ttlSeconds) {
  var configured = Math.floor(Number(ttlSeconds || CONFIG.COMMUNICATION_COOLDOWN_CACHE_TTL_SECONDS || 3600));
  var maxTtl = Math.max(1, Math.floor(Number(CONFIG.COMMUNICATION_COOLDOWN_CACHE_MAX_TTL_SECONDS || 21600)));
  if (!(configured > 0)) configured = 3600;
  return Math.max(1, Math.min(configured, maxTtl));
}

function getCommunicationCooldownCacheKey_(applicantId, messageType) {
  var type = safeStr_(messageType || "").toLowerCase();
  var id = safeStr_(applicantId || "");
  var key = "COMM_COOLDOWN::" + type + "::" + id;
  return key.length <= 240 ? key : key.slice(0, 240);
}

function getCommunicationCooldownState_(applicantId, messageType) {
  var key = getCommunicationCooldownCacheKey_(applicantId, messageType);
  if (!safeStr_(applicantId || "") || !safeStr_(messageType || "")) return null;
  try {
    var raw = CacheService.getScriptCache().get(key);
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (err) {
    logOperationalBlock_("COMMUNICATION_COOLDOWN_CACHE_READ_FAILED", {
      key: key,
      error: safeStr_(err && err.message ? err.message : err)
    });
    return null;
  }
}

function setCommunicationCooldownState_(applicantId, messageType, state, ttlSeconds) {
  var id = safeStr_(applicantId || "");
  var type = safeStr_(messageType || "").toLowerCase();
  if (!id || !type) return { ok: false, key: "", stored: false, error: "MISSING_SCOPE" };
  var key = getCommunicationCooldownCacheKey_(id, type);
  var ttl = communicationCooldownCacheTtlSeconds_(ttlSeconds);
  var payload = state && typeof state === "object" ? Object.assign({}, state) : {};
  payload.applicantId = id;
  payload.messageType = type;
  payload.cachedAt = payload.cachedAt || new Date().toISOString();
  payload.ttlSeconds = ttl;
  try {
    CacheService.getScriptCache().put(key, JSON.stringify(payload), ttl);
    return { ok: true, key: key, stored: true, ttlSeconds: ttl };
  } catch (err) {
    logOperationalBlock_("COMMUNICATION_COOLDOWN_CACHE_WRITE_FAILED", {
      key: key,
      ttlSeconds: ttl,
      error: safeStr_(err && err.message ? err.message : err)
    });
    return { ok: false, key: key, stored: false, ttlSeconds: ttl, error: safeStr_(err && err.message ? err.message : err) };
  }
}

function clearCommunicationCooldownState_(applicantId, messageType) {
  var id = safeStr_(applicantId || "");
  var type = safeStr_(messageType || "").toLowerCase();
  if (!id || !type) return { ok: false, key: "", cleared: false, error: "MISSING_SCOPE" };
  var key = getCommunicationCooldownCacheKey_(id, type);
  try {
    CacheService.getScriptCache().remove(key);
    return { ok: true, key: key, cleared: true };
  } catch (err) {
    logOperationalBlock_("COMMUNICATION_COOLDOWN_CACHE_CLEAR_FAILED", {
      key: key,
      error: safeStr_(err && err.message ? err.message : err)
    });
    return { ok: false, key: key, cleared: false, error: safeStr_(err && err.message ? err.message : err) };
  }
}

function manualSendProbeStatusCacheKey_() {
  return "MANUAL_SEND_PROBE_LAST";
}

function maskEmailForOps_(email) {
  var value = safeStr_(email || "");
  var at = value.indexOf("@");
  if (at <= 1) return value ? "***" : "";
  var local = value.slice(0, at);
  var domain = value.slice(at + 1);
  return local.charAt(0) + "***@" + domain;
}

function getManualSendProbeStatus_() {
  try {
    var raw = CacheService.getScriptCache().get(manualSendProbeStatusCacheKey_());
    return raw ? JSON.parse(raw) : null;
  } catch (_err) {
    return null;
  }
}

function setManualSendProbeStatus_(status) {
  var payload = status && typeof status === "object" ? Object.assign({}, status) : {};
  payload.recordedAt = payload.recordedAt || new Date().toISOString();
  if (payload.recipient) payload.maskedRecipient = maskEmailForOps_(payload.recipient);
  delete payload.recipient;
  try {
    CacheService.getScriptCache().put(manualSendProbeStatusCacheKey_(), JSON.stringify(payload), 86400);
  } catch (_err) {}
  return payload;
}

function buildScriptPropertyRegressionGuard_() {
  var summary = typeof getPropertyInventorySummary_ === "function" ? getPropertyInventorySummary_() : null;
  var total = Number(summary && summary.totalPropertyCount || 0);
  var commLast = Number(summary && summary.commLastCount || 0);
  var expected = Math.max(0, Number(CONFIG.EXPECTED_SCRIPT_PROPERTY_COUNT_AFTER_CLEANUP || 0));
  var warning = "";
  if (commLast > 0) warning = "COMM_LAST_PROPERTY_REGRESSION";
  else if (expected && total > expected) warning = "SCRIPT_PROPERTY_COUNT_GREW";
  return {
    ok: !warning,
    warning: warning,
    totalPropertyCount: total,
    commLastCount: commLast,
    expectedPropertyCount: expected
  };
}

function isEphemeralCommunicationProperty_(key) {
  var k = safeStr_(key || "");
  return k.indexOf("COMM_LAST::") === 0;
}

function isProtectedRuntimeProperty_(key) {
  var k = safeStr_(key || "");
  if (!k) return false;
  if (k.indexOf("STAGE_CURSOR::") === 0) return true;
  if (k.indexOf("FODE_AUTOSEND_") === 0) return true;
  if (k.indexOf("FODE_BOUNCE_") === 0) return true;
  if (k.indexOf("FODE_UPLOAD_ROOT_") === 0) return true;
  if (k.indexOf("LOCK") >= 0 || k.indexOf("LOCK_") === 0) return true;
  if (k.indexOf("DEPLOY") >= 0 || k.indexOf("RUNTIME") >= 0 || k.indexOf("CONFIG") >= 0) return true;
  return false;
}

function propertyPrefixForInventory_(key) {
  var k = safeStr_(key || "");
  if (!k) return "";
  var doubleColon = k.indexOf("::");
  if (doubleColon >= 0) return k.slice(0, doubleColon + 2);
  var underscore = k.indexOf("_");
  if (underscore > 0) return k.slice(0, underscore + 1);
  return k;
}

function parsePropertyTimestamp_(value) {
  var s = safeStr_(value || "");
  if (!s) return null;
  var parsed = Date.parse(s);
  if (!isNaN(parsed)) return new Date(parsed).toISOString();
  try {
    var obj = JSON.parse(s);
    var candidates = [obj.writtenAt, obj.timestamp, obj.ts, obj.sentAt, obj.updatedAt, obj.createdAt];
    for (var i = 0; i < candidates.length; i++) {
      var candidate = safeStr_(candidates[i] || "");
      if (!candidate) continue;
      var nested = Date.parse(candidate);
      if (!isNaN(nested)) return new Date(nested).toISOString();
    }
  } catch (_jsonErr) {}
  return null;
}

function buildPropertyInventory_() {
  var props = PropertiesService.getScriptProperties().getProperties() || {};
  var keys = Object.keys(props);
  var totalSize = 0;
  var prefixMap = {};
  var commLastCount = 0;
  var ephemeralCount = 0;
  var protectedCount = 0;
  var oldest = "";
  var newest = "";
  keys.forEach(function (key) {
    var value = String(props[key] || "");
    totalSize += key.length + value.length;
    var prefix = propertyPrefixForInventory_(key) || "(none)";
    if (!prefixMap[prefix]) {
      prefixMap[prefix] = {
        prefix: prefix,
        count: 0,
        serializedSizeEstimate: 0,
        ephemeralCount: 0,
        protectedCount: 0
      };
    }
    prefixMap[prefix].count++;
    prefixMap[prefix].serializedSizeEstimate += key.length + value.length;
    if (isEphemeralCommunicationProperty_(key)) {
      commLastCount++;
      ephemeralCount++;
      prefixMap[prefix].ephemeralCount++;
    }
    if (isProtectedRuntimeProperty_(key)) {
      protectedCount++;
      prefixMap[prefix].protectedCount++;
    }
    var ts = parsePropertyTimestamp_(value);
    if (ts) {
      if (!oldest || ts < oldest) oldest = ts;
      if (!newest || ts > newest) newest = ts;
    }
  });
  var prefixes = Object.keys(prefixMap).map(function (prefix) { return prefixMap[prefix]; })
    .sort(function (a, b) {
      if (b.count !== a.count) return b.count - a.count;
      return b.serializedSizeEstimate - a.serializedSizeEstimate;
    });
  return {
    ok: true,
    totalPropertyCount: keys.length,
    totalSerializedSizeEstimate: totalSize,
    commLastCount: commLastCount,
    ephemeralCount: ephemeralCount,
    protectedCount: protectedCount,
    eligibleCommLastDeletionCount: commLastCount,
    oldestParseableTimestamp: oldest,
    newestParseableTimestamp: newest,
    topPrefixes: prefixes.slice(0, 20),
    prefixes: prefixes
  };
}

function getPropertyInventorySummary_() {
  var inventory = buildPropertyInventory_();
  return {
    ok: true,
    totalPropertyCount: inventory.totalPropertyCount,
    totalSerializedSizeEstimate: inventory.totalSerializedSizeEstimate,
    commLastCount: inventory.commLastCount,
    ephemeralCount: inventory.ephemeralCount,
    protectedCount: inventory.protectedCount,
    eligibleCommLastDeletionCount: inventory.eligibleCommLastDeletionCount,
    oldestParseableTimestamp: inventory.oldestParseableTimestamp,
    newestParseableTimestamp: inventory.newestParseableTimestamp,
    topPrefixes: inventory.topPrefixes
  };
}

function getPropertyPrefixBreakdown_() {
  var inventory = buildPropertyInventory_();
  return {
    ok: true,
    totalPropertyCount: inventory.totalPropertyCount,
    totalSerializedSizeEstimate: inventory.totalSerializedSizeEstimate,
    commLastCount: inventory.commLastCount,
    ephemeralCount: inventory.ephemeralCount,
    protectedCount: inventory.protectedCount,
    eligibleCommLastDeletionCount: inventory.eligibleCommLastDeletionCount,
    prefixes: inventory.prefixes
  };
}

function cleanupEphemeralCommunicationProperties_(opts) {
  var options = opts && typeof opts === "object" ? opts : {};
  var prefix = safeStr_(options.prefix || "");
  var confirm = options.confirm === true;
  var forceLargeDelete = options.forceLargeDelete === true;
  var limit = Math.max(1, Math.floor(Number(options.limit || 0)));
  var olderThanIso = safeStr_(options.olderThanIso || "");
  var olderThanMs = olderThanIso ? Date.parse(olderThanIso) : 0;
  if (olderThanIso && isNaN(olderThanMs)) {
    olderThanMs = 0;
  }
  var maxDelete = Math.max(1, Math.floor(Number(CONFIG.MAX_PROPERTY_DELETE_BATCH || 500)));
  var propsService = PropertiesService.getScriptProperties();
  var props = propsService.getProperties() || {};
  var keys = Object.keys(props);
  var before = buildPropertyInventory_();
  var blocked = "";
  var eligible = [];
  var protectedSkipped = 0;
  var nonMatchingSkipped = 0;
  keys.forEach(function (key) {
    if (key.indexOf(prefix) !== 0) {
      nonMatchingSkipped++;
      return;
    }
    if (isProtectedRuntimeProperty_(key)) {
      protectedSkipped++;
      return;
    }
    if (!isEphemeralCommunicationProperty_(key)) {
      nonMatchingSkipped++;
      return;
    }
    if (olderThanMs > 0) {
      var ts = parsePropertyTimestamp_(props[key]);
      var tsMs = ts ? Date.parse(ts) : 0;
      if (!tsMs || tsMs >= olderThanMs) return;
    }
    eligible.push(key);
  });
  if (limit > 0 && eligible.length > limit) eligible = eligible.slice(0, limit);

  function result_(label, deleted, afterInventory) {
    var after = afterInventory || before;
    var out = {
      ok: !blocked,
      action: "property_cleanup",
      prefix: prefix,
      confirm: confirm,
      dryRun: !confirm,
      forceLargeDelete: forceLargeDelete,
      maxDeleteBatch: maxDelete,
      limit: limit,
      olderThanIso: olderThanIso,
      blocked: blocked,
      totalBefore: before.totalPropertyCount,
      totalAfter: after.totalPropertyCount,
      commLastBefore: before.commLastCount,
      commLastAfter: after.commLastCount,
      eligible: eligible.length,
      deleted: deleted,
      protectedSkipped: protectedSkipped,
      nonMatchingSkipped: nonMatchingSkipped,
      estimatedSizeBefore: before.totalSerializedSizeEstimate,
      estimatedSizeAfter: after.totalSerializedSizeEstimate,
      estimatedSizeReduction: Math.max(0, before.totalSerializedSizeEstimate - after.totalSerializedSizeEstimate)
    };
    logOperationalBlock_(label, out);
    return out;
  }

  if (CONFIG.ENABLE_PROPERTY_CLEANUP_TOOLS !== true) {
    blocked = "PROPERTY_CLEANUP_TOOLS_DISABLED";
    return result_("PROPERTY_CLEANUP_BLOCKED", 0, before);
  }
  if (prefix !== "COMM_LAST::") {
    blocked = "INVALID_PREFIX";
    return result_("PROPERTY_CLEANUP_BLOCKED", 0, before);
  }
  if (!confirm) {
    return result_("PROPERTY_CLEANUP_DRY_RUN", 0, before);
  }
  if (eligible.length > maxDelete && !forceLargeDelete) {
    blocked = "MAX_PROPERTY_DELETE_BATCH_EXCEEDED";
    return result_("PROPERTY_CLEANUP_LIMIT_BLOCKED", 0, before);
  }

  logOperationalBlock_("PROPERTY_CLEANUP_DELETE_BEGIN", {
    action: "property_cleanup",
    prefix: prefix,
    eligible: eligible.length,
    maxDeleteBatch: maxDelete,
    forceLargeDelete: forceLargeDelete
  });
  var deleted = 0;
  eligible.forEach(function (key) {
    propsService.deleteProperty(key);
    deleted++;
  });
  return result_("PROPERTY_CLEANUP_DELETE_END", deleted, buildPropertyInventory_());
}

function hasValue_(v) {
  return !!safeStr_(v);
}

function isYes_(v) {
  return safeStr_(v) === "Yes";
}

function nowIso_() {
  return new Date().toISOString();
}

function getRowEmailForStudent_(row) {
  var email = safeStr_(pickParentEmail_(row || "")).toLowerCase();
  return isValidEmail_(email) ? email : "";
}

function parseCsvEmails_(s) {
  var raw = String(s === null || s === undefined ? "" : s);
  return raw.split(",")
    .map(function(v){ return safeStr_(v).toLowerCase(); })
    .filter(function(v){ return isValidEmail_(v); })
    .join(",");
}

function buildDocsFollowupKey_(dataMode, applicantId) {
  var mode = "";
  var id = "";
  if (arguments.length >= 2) {
    mode = safeStr_(dataMode || "");
    id = safeStr_(applicantId || "");
  } else if (dataMode && typeof dataMode === "object") {
    mode = safeStr_((CONFIG && CONFIG.DATA_MODE) || "STAGING");
    id = safeStr_(dataMode.ApplicantID || dataMode.applicantId || "");
  } else {
    mode = safeStr_((CONFIG && CONFIG.DATA_MODE) || "STAGING");
    id = safeStr_(dataMode || "");
  }
  mode = mode.toUpperCase() || "STAGING";
  return "DOCS_FOLLOWUP_SENT::" + mode + "::" + (id || "UNKNOWN");
}

function deleteDocsFollowupKey_(dataMode, applicantId) {
  var key = buildDocsFollowupKey_(dataMode, applicantId);
  try {
    PropertiesService.getScriptProperties().deleteProperty(key);
    return key;
  } catch (_e) {
    return key;
  }
}

function buildPayverWorkflowKey_(dataMode, applicantId) {
  var mode = safeStr_(dataMode || "").toUpperCase() || "STAGING";
  var id = safeStr_(applicantId || "");
  return "PAYVER_WORKFLOW_SENT::" + mode + "::" + (id || "UNKNOWN");
}

function handlePaymentVerifiedTrigger_(rowObj, debugId) {
  var row = rowObj || {};
  var applicantId = clean_(row["ApplicantID"] || "");
  var dataMode = clean_(CONFIG.DATA_MODE || "STAGING") || "STAGING";
  var props = PropertiesService.getScriptProperties();
  var key = buildPayverWorkflowKey_(dataMode, applicantId);

  if (!applicantId) {
    logAdminEvent_("PAYVER_WORKFLOW_SKIPPED", { debugId: debugId, reason: "missing ApplicantID" });
    return { success: false, warnings: ["Missing ApplicantID"], code: "MISSING_APPLICANTID" };
  }

  if (clean_(props.getProperty(key) || "")) {
    logAdminEvent_("PAYVER_WORKFLOW_SKIPPED", { applicantId: applicantId, debugId: debugId, reason: "already sent" });
    return { success: true, warnings: ["Workflow already processed"], code: "ALREADY_SENT" };
  }

  var warnings = [];
  var parentEmail = "";

  try {
    parentEmail = getRowEmailForStudent_(row);
    if (parentEmail) {
      var body = "Payment has been verified for "
        + clean_(row["First_Name"] || "") + " " + clean_(row["Last_Name"] || "")
        + " (ApplicantID: " + applicantId + ").\n\n"
        + "Next steps: Please stand by for enrolment/access instructions.";
      var studentSend = adminSendEmail_(parentEmail, clean_(CONFIG.PAYVER_STUDENT_SUBJECT || "Payment Verified - FODE"), body, {
        replyTo: clean_(CONFIG.EMAIL_REPLY_TO || ""),
        name: clean_(CONFIG.EMAIL_FROM_NAME || "FODE Admissions"),
        templateType: "payment_verified_student",
        sendSource: "PAYMENT_VERIFIED_WORKFLOW",
        unattended: true,
        applicantId: applicantId,
        rowObj: row,
        debugId: debugId,
        action: "payment_verified_student_email"
      });
      if (!studentSend.ok) throw new Error(clean_(studentSend.error || "Payment verified student email failed"));
    } else {
      warnings.push("No parent email");
      logAdminEvent_("PAYVER_EMAIL_SKIPPED_NO_EMAIL", { applicantId: applicantId, debugId: debugId });
    }

    var adminBody = ""
      + "Payment verified.\n"
      + "Applicant: " + clean_(row["First_Name"] || "") + " " + clean_(row["Last_Name"] || "") + "\n"
      + "ApplicantID: " + applicantId + "\n"
      + "Phone: " + clean_(row["Parent_Phone"] || "") + "\n"
      + "Email: " + (parentEmail || clean_(row["Parent_Email_Corrected"] || "") || clean_(row["Parent_Email"] || "") || "") + "\n\n"
      + "Action: Release access / proceed to next steps.";
    var adminSend = adminSendEmail_(clean_(CONFIG.EMAIL_RELEASE_ADMIN_TO || ""), clean_(CONFIG.PAYVER_ADMIN_SUBJECT || "Payment Verified - Release Access"), adminBody, {
      replyTo: clean_(CONFIG.EMAIL_REPLY_TO || ""),
      name: clean_(CONFIG.EMAIL_FROM_NAME || "FODE Admissions"),
      templateType: "payment_verified_admin_release",
      sendSource: "PAYMENT_VERIFIED_WORKFLOW",
      unattended: true,
      applicantId: applicantId,
      rowObj: row,
      debugId: debugId,
      action: "payment_verified_admin_release_email"
    });
    if (!adminSend.ok) throw new Error(clean_(adminSend.error || "Payment verified admin release email failed"));

    if (CONFIG.CRM_PUSH_DRY_RUN === true) {
      var crmPayload = {
        applicantId: applicantId,
        name: (clean_(row["First_Name"] || "") + " " + clean_(row["Last_Name"] || "")).trim(),
        email: parentEmail,
        stage: "Payment Verified"
      };
      logAdminEvent_("CRM_PUSH_DRY_RUN", { applicantId: applicantId, payload: crmPayload, debugId: debugId });
    }

    props.setProperty(key, new Date().toISOString());
    logAdminEvent_("PAYVER_WORKFLOW_SENT", { applicantId: applicantId, debugId: debugId });
    return { success: true, warnings: warnings, code: "SENT" };
  } catch (e) {
    var errMsg = String(e && e.message ? e.message : e);
    logAdminEvent_("PAYVER_WORKFLOW_FAILED", { applicantId: applicantId, debugId: debugId, error: errMsg });
    warnings.push("Workflow failed: " + errMsg);
    return { success: false, warnings: warnings, code: "FAILED" };
  }
}

function pickParentEmail_(row) {
  var r = row || {};
  return safeStr_(r.Parent_Email_Corrected || r.Parent_Email || "");
}

function logAdminEvent_(eventName, payload) {
  try {
    log_(mustGetSheet_(getWorkingSpreadsheet_(), CONFIG.LOG_SHEET), safeStr_(eventName || "ADMIN_EVENT"), JSON.stringify(payload || {}));
  } catch (e) {
    try { Logger.log(String(eventName || "ADMIN_EVENT") + " " + JSON.stringify(payload || {})); } catch (_e) {}
  }
}

function adminSendEmail_(to, subject, body, opts) {
  var toEmail = safeStr_(to);
  var subj = String(subject || "");
  var textBody = String(body || "");
  var o = (opts && typeof opts === "object") ? opts : {};
  var provider = safeStr_(CONFIG.EMAIL_PROVIDER || "GMAILAPP").toUpperCase();
  var fromAddr = safeStr_(CONFIG.EMAIL_FROM_ADDRESS || "");
  var replyTo = safeStr_(o.replyTo || CONFIG.EMAIL_REPLY_TO || "");
  var cc = safeStr_(o.cc || "");
  var bcc = safeStr_(o.bcc || "");
  var htmlBody = safeStr_(o.htmlBody || "");
  var fromName = safeStr_(o.name || CONFIG.EMAIL_FROM_NAME || "");

  if (isSystemStabilizationModeActive_() || CONFIG.ENABLE_PRODUCTION_EMAIL_SENDS !== true) {
    var blockCode = isSystemStabilizationModeActive_() ? "SYSTEM_STABILIZATION_MODE_ACTIVE" : "PRODUCTION_EMAIL_SENDS_DISABLED";
    if (isSystemStabilizationModeActive_()) logOperationalBlock_("SYSTEM_STABILIZATION_MODE_ACTIVE", {
      action: "admin_send_email",
      recipient: toEmail
    });
    logOperationalBlock_("EMAIL_SEND_BLOCKED", {
      action: "admin_send_email",
      blockCode: blockCode,
      recipient: toEmail,
      from: fromAddr,
      replyTo: replyTo
    });
    return { ok: false, error: blockCode, blocked: true, from: fromAddr, replyTo: replyTo, cc: cc };
  }

  if (!toEmail) {
    return { ok: false, error: "Missing recipient email", from: fromAddr, replyTo: replyTo, cc: cc };
  }

  var unattendedBlock = blockUnattendedEmailSendIfNeeded_(safeStr_(o.templateType || subj || ""), toEmail, {
    action: safeStr_(o.action || "admin_send_email"),
    sendSource: safeStr_(o.sendSource || ""),
    unattended: o.unattended === true,
    applicantId: safeStr_(o.applicantId || ""),
    rowObj: o.rowObj && typeof o.rowObj === "object" ? o.rowObj : {},
    debugId: safeStr_(o.debugId || "")
  });
  if (unattendedBlock.blocked) {
    return {
      ok: false,
      error: unattendedBlock.blockCode,
      blocked: true,
      from: fromAddr,
      replyTo: replyTo,
      cc: cc
    };
  }

  try {
    if (provider === "MAILAPP") {
      var mailOpts = {};
      if (fromName) mailOpts.name = fromName;
      if (replyTo) mailOpts.replyTo = replyTo;
      if (cc) mailOpts.cc = cc;
      if (bcc) mailOpts.bcc = bcc;
      if (htmlBody) mailOpts.htmlBody = htmlBody;
      MailApp.sendEmail(toEmail, subj, textBody, mailOpts);
    } else {
      var gmailOpts = {};
      if (fromName) gmailOpts.name = fromName;
      if (replyTo) gmailOpts.replyTo = replyTo;
      if (cc) gmailOpts.cc = cc;
      if (bcc) gmailOpts.bcc = bcc;
      if (htmlBody) gmailOpts.htmlBody = htmlBody;
      var senderMode = safeStr_(o.senderMode || CONFIG.EMAIL_SENDER_MODE || "DEFAULT").toUpperCase();
      if (senderMode === "ALIAS" && fromAddr) gmailOpts.from = fromAddr;
      GmailApp.sendEmail(toEmail, subj, textBody, gmailOpts);
    }
    return { ok: true, from: fromAddr, replyTo: replyTo, cc: cc };
  } catch (e) {
    return {
      ok: false,
      error: String(e && e.message ? e.message : e),
      from: fromAddr,
      replyTo: replyTo,
      cc: cc
    };
  }
}

function appendPortalLog_(eventObj) {
  // Log into the main staging spreadsheet tab for visibility during testing.
  // (The older LOG_SHEET_ID / LOG_SHEET_NAME config is kept for reference but not used here.)
  assertDriveId_(getWorkingSpreadsheetId_(), "WORKING_SHEET_ID");
  var ss = getWorkingSpreadsheet_();
  var sh = ss.getSheetByName(CONFIG.LOG_SHEET);
  if (!sh) throw new Error("Missing log sheet tab in main sheet: " + CONFIG.LOG_SHEET);

  var row = [
    new Date(),
    CONFIG.VERSION || "",
    eventObj.route || "",
    eventObj.applicantId || "",
    eventObj.email || "",
    eventObj.status || "",
    eventObj.message || ""
  ];
  sh.appendRow(row);
}

function safePortalLog_(eventObj, throwOnFail) {
  try {
    appendPortalLog_(eventObj);
  } catch (err) {
    Logger.log("PORTAL LOG FAILURE (non-fatal): " + err.message);
    if (throwOnFail) throw err;
  }
}

function portalDebugLog_(tag, obj) {
  try {
    if (!CONFIG || CONFIG.PORTAL_DEBUG_TO_LOG_SHEET !== true) return;
    var src = obj || {};
    var payload = {
      tag: clean_(tag),
      ts: new Date().toISOString()
    };
    if (src.applicantId !== undefined) payload.applicantId = clean_(src.applicantId);
    if (src.rowNumber !== undefined) payload.rowNumber = Number(src.rowNumber) || 0;
    if (src.keys !== undefined) payload.keys = src.keys;
    if (src.error !== undefined) payload.error = clean_(src.error);
    if (src.email !== undefined) payload.email = clean_(src.email);
    if (src.sheet !== undefined) payload.sheet = clean_(src.sheet);
    if (src.fileField !== undefined) payload.fileField = clean_(src.fileField);
    if (src.url !== undefined) payload.url = clean_(src.url);
    if (src.removed !== undefined) payload.removed = !!src.removed;
    if (src.trashed !== undefined) payload.trashed = !!src.trashed;
    if (src.warning !== undefined) payload.warning = clean_(src.warning);
    if (src.ok !== undefined) payload.ok = !!src.ok;
    if (src.mismatches !== undefined) payload.mismatches = src.mismatches;
    if (src.patchSample !== undefined) payload.patchSample = src.patchSample;

    var msg = JSON.stringify(payload, function (key, value) {
      if (String(key || "").toLowerCase() === "base64") return "[omitted]";
      return value;
    });
    var maxBytes = Number(CONFIG.PORTAL_DEBUG_MAX_BYTES || 2500);
    if (!(maxBytes > 0)) maxBytes = 2500;
    if (msg.length > maxBytes) msg = msg.slice(0, maxBytes);

    var sh = mustGetSheet_(getWorkingSpreadsheet_(), CONFIG.LOG_SHEET);
    log_(sh, "PORTAL_DEBUG", msg);
  } catch (e) {
    // Best-effort only; never break portal flow.
  }
}

function test_PortalLogWrite() {
  safePortalLog_({
    route: "test_PortalLogWrite",
    applicantId: "TEST",
    email: "test@example.com",
    status: "OK",
    message: "Portal log smoke write"
  }, true);
  Logger.log("Done");
}

function isStagingDriveUrlResolverEnabled_() {
  var mode = clean_((CONFIG && CONFIG.DATA_MODE) || "STAGING").toUpperCase();
  return mode !== "PROD";
}

function getDriveUploadFields_() {
  if (CONFIG && Array.isArray(CONFIG.PORTAL_UPLOAD_KEYS) && CONFIG.PORTAL_UPLOAD_KEYS.length) {
    return CONFIG.PORTAL_UPLOAD_KEYS.slice();
  }
  return [
    "Birth_ID_Passport_File",
    "Latest_School_Report_File",
    "Transfer_Certificate_File",
    "Passport_Photo_File",
    "Fee_Receipt_File"
  ];
}

function isDriveUploadField_(fieldName) {
  var f = clean_(fieldName || "");
  if (!f) return false;
  var list = getDriveUploadFields_();
  for (var i = 0; i < list.length; i++) {
    if (clean_(list[i]) === f) return true;
  }
  return false;
}

function normalizeUrlToken_(value) {
  var s = clean_(value || "");
  if (!s) return "";
  s = s.replace(/^['"]+|['"]+$/g, "");
  s = s.replace(/[)\],.;]+$/g, "");
  return clean_(s);
}

function canonicalDriveFileUrlFromId_(id) {
  var fileId = clean_(id || "");
  if (!fileId) return "";
  return "https://drive.google.com/file/d/" + fileId + "/view";
}

function extractDriveFileIdFromUrlToken_(s) {
  var raw = clean_(s || "");
  if (!raw) return "";
  if (/^[a-zA-Z0-9_-]{20,}$/.test(raw)) return raw;
  var m1 = raw.match(/\/file\/d\/([a-zA-Z0-9_-]+)/i);
  if (m1 && m1[1]) return m1[1];
  var m2 = raw.match(/[?&]id=([a-zA-Z0-9_-]+)/i);
  if (m2 && m2[1]) return m2[1];
  var m3 = raw.match(/\/uc\?(?:[^#]*&)?id=([a-zA-Z0-9_-]+)/i);
  if (m3 && m3[1]) return m3[1];
  var m4 = raw.match(/\/d\/([a-zA-Z0-9_-]{20,})/i);
  if (m4 && m4[1]) return m4[1];
  return "";
}

function addUrlCandidate_(out, seen, candidate) {
  var c = normalizeUrlToken_(candidate);
  if (!c) return;
  if (/^https?:\/\//i.test(c)) {
    if (seen[c]) return;
    seen[c] = true;
    out.push(c);
    return;
  }
  var id = extractDriveFileIdFromUrlToken_(c);
  if (!id) return;
  var canonical = canonicalDriveFileUrlFromId_(id);
  if (!canonical || seen[canonical]) return;
  seen[canonical] = true;
  out.push(canonical);
}

function collectDriveUrlCandidates_(value, out, seen) {
  if (value === null || value === undefined) return;
  if (Array.isArray(value)) {
    for (var i = 0; i < value.length; i++) collectDriveUrlCandidates_(value[i], out, seen);
    return;
  }
  if (typeof value === "object") {
    var keys = Object.keys(value);
    var preferred = ["url", "fileUrl", "webViewLink", "webContentLink", "link", "driveUrl"];
    for (var p = 0; p < preferred.length; p++) {
      var k0 = preferred[p];
      if (Object.prototype.hasOwnProperty.call(value, k0)) addUrlCandidate_(out, seen, value[k0]);
    }
    if (Object.prototype.hasOwnProperty.call(value, "id")) addUrlCandidate_(out, seen, canonicalDriveFileUrlFromId_(value.id));
    if (Object.prototype.hasOwnProperty.call(value, "fileId")) addUrlCandidate_(out, seen, canonicalDriveFileUrlFromId_(value.fileId));
    for (var j = 0; j < keys.length; j++) {
      var k = keys[j];
      collectDriveUrlCandidates_(value[k], out, seen);
    }
    return;
  }

  var s = clean_(value || "");
  if (!s) return;

  if (/^\s*=HYPERLINK\(/i.test(s)) {
    var hm = s.match(/=HYPERLINK\(\s*"([^"]+)"/i);
    if (hm && hm[1]) addUrlCandidate_(out, seen, hm[1]);
  }

  if ((s.charAt(0) === "{" && s.charAt(s.length - 1) === "}") || (s.charAt(0) === "[" && s.charAt(s.length - 1) === "]")) {
    try {
      var parsed = JSON.parse(s);
      collectDriveUrlCandidates_(parsed, out, seen);
    } catch (_jsonErr) {}
  }

  var parts = s.split(/\r?\n|,/);
  for (var n = 0; n < parts.length; n++) addUrlCandidate_(out, seen, parts[n]);

  var regex = /https?:\/\/[^\s"'<>]+/ig;
  var m;
  while ((m = regex.exec(s)) !== null) {
    addUrlCandidate_(out, seen, m[0]);
  }

  addUrlCandidate_(out, seen, s);
}

function normalizeToUrlList_(cellValue, fieldName) {
  var raw = clean_(cellValue);
  if (!raw) return [];

  if (!isStagingDriveUrlResolverEnabled_()) {
    var legacyParts = raw.split(/\r?\n|,/).map(function (s) {
      return clean_(s);
    }).filter(function (s) {
      return !!s;
    });
    var legacyOut = [];
    var legacySeen = {};
    for (var i = 0; i < legacyParts.length; i++) {
      var p = legacyParts[i];
      if (!/^https?:\/\//i.test(p)) continue;
      if (legacySeen[p]) continue;
      legacySeen[p] = true;
      legacyOut.push(p);
    }
    return legacyOut;
  }

  if (fieldName && !isDriveUploadField_(fieldName)) {
    return [];
  }

  var out = [];
  var seen = {};
  collectDriveUrlCandidates_(cellValue, out, seen);
  return out;
}

function appendUrlToCell_(existingValue, newUrl) {
  var url = clean_(newUrl);
  if (!url) return clean_(existingValue);
  var urls = normalizeToUrlList_(existingValue);
  if (urls.indexOf(url) === -1) urls.push(url);
  return urls.join("\n");
}

function removeUrlFromCell_(existingValue, urlToRemove) {
  var target = clean_(urlToRemove);
  if (!target) return clean_(existingValue);
  var urls = normalizeToUrlList_(existingValue).filter(function (u) {
    return u !== target;
  });
  return urls.join("\n");
}

function extractDriveFileId_(urlOrId) {
  var s = clean_(urlOrId);
  if (!s) return "";
  var direct = extractDriveFileIdFromUrlToken_(s);
  if (direct) return direct;
  if (isStagingDriveUrlResolverEnabled_()) {
    var urls = normalizeToUrlList_(s);
    for (var i = 0; i < urls.length; i++) {
      var id = extractDriveFileIdFromUrlToken_(urls[i]);
      if (id) return id;
    }
  }
  return "";
}

function getFileBlobByUrlOrId_(urlOrId, dbg, label) {
  var dbgId = clean_(dbg || "");
  var tag = clean_(label || "");
  var fileId = extractDriveFileId_(urlOrId);
  if (!fileId) {
    Logger.log("FILE_BLOB_FAIL dbg=%s label=%s fileId=%s err=%s", dbgId, tag, "", "Invalid file id/url");
    return { ok: false, err: "Invalid file id/url", fileId: "" };
  }
  try {
    var file = DriveApp.getFileById(fileId);
    var fileName = clean_(file.getName() || "") || ("file_" + fileId);
    var blob = file.getBlob().setName(fileName);
    var mimeType = clean_(blob.getContentType() || file.getMimeType() || "application/octet-stream");
    return {
      ok: true,
      fileId: fileId,
      fileName: fileName,
      mimeType: mimeType,
      blob: blob
    };
  } catch (e) {
    var errMsg = clean_(stringifyGsError_(e) || "File access failed");
    Logger.log("FILE_BLOB_FAIL dbg=%s label=%s fileId=%s err=%s", dbgId, tag, fileId, errMsg);
    return { ok: false, err: errMsg, fileId: fileId };
  }
}

function buildTokenGatedFileUrl_(baseUrl, applicantId, secret, fieldKey, mode) {
  var base = clean_(baseUrl || "");
  if (!base) return "";
  return base
    + "?view=file"
    + "&mode=" + encodeURIComponent(clean_(mode || "open") || "open")
    + "&id=" + encodeURIComponent(clean_(applicantId || ""))
    + "&s=" + encodeURIComponent(clean_(secret || ""))
    + "&field=" + encodeURIComponent(clean_(fieldKey || ""));
}

function isFileInFolderChain_(file, folderId) {
  var target = clean_(folderId);
  if (!file || !target) return false;
  try {
    var parents = file.getParents();
    while (parents.hasNext()) {
      var p = parents.next();
      if (clean_(p.getId()) === target) return true;
    }
  } catch (e) {
    return false;
  }
  return false;
}


function getCampaignEffectiveEmail_(row) {
  var r = row || {};
  return clean_(r.Parent_Email_Corrected || r.Parent_Email || "");
}

function isCampaignPortalSubmittedActive_(row) {
  var r = row || {};
  var submitted = clean_(r.Portal_Submitted || "");
  return !!(submitted && submitted !== "No");
}

function isCampaignBounceFlagTrue_(value) {
  var s = clean_(value || "").toLowerCase();
  return s === "true" || s === "yes" || s === "1";
}

function isValidCampaignEmail_(email) {
  var normalized = clean_(email || "").toLowerCase();
  if (!normalized) return false;
  if (/[\s,;]/.test(normalized)) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function getCampaignColumnsMap_(headers) {
  var row = Array.isArray(headers) ? headers : [];
  var approved = Array.isArray(CONFIG.CAMPAIGN_COLUMNS) ? CONFIG.CAMPAIGN_COLUMNS : [];
  var map = {};
  for (var i = 0; i < approved.length; i++) {
    map[approved[i]] = 0;
  }
  for (var c = 0; c < row.length; c++) {
    var h = clean_(row[c]);
    if (h && Object.prototype.hasOwnProperty.call(map, h)) map[h] = c + 1;
  }
  return map;
}

function ensureCampaignColumns_(sheet) {
  var sh = sheet;
  if (!sh) throw new Error("Missing sheet for campaign columns");
  var approved = Array.isArray(CONFIG.CAMPAIGN_COLUMNS) ? CONFIG.CAMPAIGN_COLUMNS.slice() : [];
  if (!approved.length) return {};
  var lastCol = Math.max(1, sh.getLastColumn());
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return clean_(h); });
  var missing = [];
  for (var i = 0; i < approved.length; i++) {
    if (headers.indexOf(approved[i]) === -1) missing.push(approved[i]);
  }
  if (missing.length) {
    sh.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
    headers = headers.concat(missing);
  }
  return getCampaignColumnsMap_(headers);
}

function normalizeEmailStatus_(value) {
  var allowed = {
    NEW: true,
    READY: true,
    SENT: true,
    BOUNCED: true,
    RESPONDED: true,
    DO_NOT_CONTACT: true
  };
  var normalized = clean_(value || "").toUpperCase();
  return allowed[normalized] ? normalized : "";
}

function computeCampaignEligibility_(row) {
  var r = row || {};
  var applicantId = clean_(r.ApplicantID || "");
  var effectiveEmail = getCampaignEffectiveEmail_(r);
  var status = normalizeEmailStatus_(r.Email_Status || "");
  var portalSubmittedActive = isCampaignPortalSubmittedActive_(r);
  var bounceFlag = isCampaignBounceFlagTrue_(r.Email_Bounce_Flag);
  var result = {
    eligible: false,
    reason: "",
    applicantId: applicantId,
    effectiveEmail: effectiveEmail,
    status: status,
    portalSubmittedActive: portalSubmittedActive,
    bounceFlag: bounceFlag
  };
  if (!applicantId) {
    result.reason = "MISSING_APPLICANT_ID";
    return result;
  }
  if (!isValidCampaignEmail_(effectiveEmail)) {
    result.reason = "INVALID_EFFECTIVE_EMAIL";
    return result;
  }
  if (bounceFlag) {
    result.reason = "BOUNCED";
    return result;
  }
  if (status === "DO_NOT_CONTACT") {
    result.reason = "DO_NOT_CONTACT";
    return result;
  }
  if (status === "RESPONDED") {
    result.reason = "RESPONDED";
    return result;
  }
  if (portalSubmittedActive) {
    result.reason = "PORTAL_SUBMITTED";
    return result;
  }
  result.eligible = true;
  result.reason = "READY";
  return result;
}

function getActivePortalSecretForCampaign_(applicantId) {
  var id = clean_(applicantId || "");
  if (!id) return { ok: false, code: "MISSING_APPLICANT_ID" };
  try {
    var rec = lookupPortalSecretForApplicant_(id, { source: "config" });
    if (!rec || rec.found !== true) {
      return {
        ok: false,
        code: clean_(rec && rec.reason || rec && rec.code || "NO_SECRET"),
        status: clean_(rec && rec.status || "")
      };
    }
    if (!clean_(rec.secretPlain || "") || !clean_(rec.secretHash || "")) return { ok: false, code: "UNUSABLE_SECRET", status: clean_(rec.status || "") };
    return {
      ok: true,
      applicantId: id,
      rowIndex: Number(rec.rowIndex || 0),
      status: clean_(rec.status || ""),
      secretPlain: clean_(rec.secretPlain || ""),
      secretHash: clean_(rec.secretHash || ""),
      createdAt: safeStr_(rec.issuedAt || "")
    };
  } catch (e) {
    return {
      ok: false,
      code: "SECRET_LOOKUP_FAILED",
      error: safeStr_(stringifyGsError_(e) || "Secret lookup failed")
    };
  }
}

function buildLegacyCampaignPortalUrl_(applicantId, secret) {
  if (typeof buildStudentPortalUrl_ !== "function") throw new Error("Missing buildStudentPortalUrl_");
  var url = buildStudentPortalUrl_(applicantId, secret);
  return clean_(url).replace("/a/macros/", "/macros/");
}

function computeNextActionDate_(attemptCount, baseDate) {
  var count = Math.max(1, Math.floor(Number(attemptCount || 1)));
  var delayDays = Math.max(1, Math.floor(Number(CONFIG.CAMPAIGN_FOLLOWUP_DELAY_DAYS || 2)));
  var dt = (baseDate instanceof Date) ? new Date(baseDate.getTime()) : new Date(baseDate || new Date());
  dt.setHours(0, 0, 0, 0);
  dt.setDate(dt.getDate() + (delayDays * count));
  return dt.toISOString();
}


function ensureCommunicationTrackingColumns_(sheet) {
  var sh = sheet;
  if (!sh) throw new Error("Missing sheet for communication tracking columns");
  var required = [
    "Last_Contacted_At",
    "Last_Contact_Type",
    "Last_Contact_By",
    "Last_Contact_Subject",
    "Last_Contact_Result",
    "Last_Contact_Batch",
    "Last_Contact_DebugId"
  ];
  var lastCol = Math.max(1, sh.getLastColumn());
  var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0].map(function (h) { return clean_(h); });
  var missing = [];
  for (var i = 0; i < required.length; i++) {
    if (headers.indexOf(required[i]) === -1) missing.push(required[i]);
  }
  if (missing.length) {
    sh.getRange(1, headers.length + 1, 1, missing.length).setValues([missing]);
  }
  return getHeaderIndexMap_(sh);
}

function writeApplicantContactTracking_(sheet, rowIndex, updates) {
  var sh = sheet;
  var rowNum = Number(rowIndex || 0);
  if (!sh || rowNum < 2) return false;
  var patch = {};
  var src = updates && typeof updates === "object" ? updates : {};
  var idx = ensureCommunicationTrackingColumns_(sh);
  Object.keys(src).forEach(function (key) {
    if (!Object.prototype.hasOwnProperty.call(idx, key)) return;
    if (src[key] === undefined) return;
    patch[key] = src[key];
  });
  if (!Object.keys(patch).length) return false;
  applyPatch_(sh, rowNum, patch);
  return true;
}




