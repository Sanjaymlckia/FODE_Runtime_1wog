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
