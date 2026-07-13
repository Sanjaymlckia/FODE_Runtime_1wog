var TEMP_CAPABILITY_GRANT_SHEET_NAME = "Capability_Grants";
var TEMP_CAPABILITY_GRANT_CACHE_PREFIX = "TEMP_CAP_GRANTS_V1";
var TEMP_CAPABILITY_GRANT_MAX_DURATION_MS = 24 * 60 * 60 * 1000;
var TEMP_CAPABILITY_GRANT_CACHE_TTL_SECONDS = 60;
var TEMP_CAPABILITY_GRANT_LOCK_TIMEOUT_MS = 30000;

function capabilityGrantSchemaHeaders_() {
  return [
    "Grant_ID",
    "Account_Email",
    "Capability_Key",
    "Grant_Type",
    "Status",
    "Granted_By_Email",
    "Granted_By_Role",
    "Granted_At",
    "Starts_At",
    "Expires_At",
    "Reason",
    "Scope_Type",
    "Scope_Payload_JSON",
    "Usage_Limit",
    "Used_Count",
    "Used_At",
    "Revoked_By_Email",
    "Revoked_At",
    "Revocation_Reason",
    "Created_Runtime_Identity",
    "Updated_At",
    "Record_Version"
  ];
}

function temporaryDelegableAdminCapabilities_() {
  return [
    "CAN_RUN_BATCH_COMMUNICATIONS",
    "CAN_SEND_INDIVIDUAL_EMAIL",
    "CAN_PREVIEW_APPLICANT_COMMUNICATION",
    "CAN_INSERT_PORTAL_LINK",
    "CAN_GENERATE_STANDARD_QUOTE",
    "CAN_GENERATE_STANDARD_INVOICE",
    "CAN_REVIEW_DOCUMENTS",
    "CAN_SAVE_DOCUMENT_STATUSES"
  ];
}

function temporaryNonDelegableAdminCapabilities_() {
  return [
    "CAN_VERIFY_PAYMENT",
    "CAN_OVERRIDE_COOLDOWN",
    "CAN_APPROVE_FINANCIAL_OVERRIDE",
    "CAN_MANAGE_PORTAL_ACCESS",
    "CAN_MANAGE_ROLES",
    "CAN_ADMINISTER_RUNTIME",
    "CAN_DEPLOY_RUNTIME",
    "CAN_WRITE_ZOHO_BOOKS"
  ];
}

function capabilityGrantRuntimeIdentity_() {
  return String(CONFIG && CONFIG.VERSION || "") + " / " + String(CONFIG && CONFIG.DEPLOY_VERSION_NUMBER || "");
}

function capabilityGrantIso_(value) {
  if (!value) return "";
  var date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? "" : date.toISOString();
}

function capabilityGrantNow_(options) {
  var supplied = options && options.now;
  var date = supplied instanceof Date ? supplied : (supplied ? new Date(supplied) : new Date());
  if (isNaN(date.getTime())) throw new Error("Invalid server time.");
  return date;
}

function capabilityGrantHeaderIndex_() {
  var out = {};
  capabilityGrantSchemaHeaders_().forEach(function (header, index) { out[header] = index; });
  return out;
}

function validateCapabilityGrantSheetSchema_(sheet) {
  var expected = capabilityGrantSchemaHeaders_();
  if (!sheet) {
    return { ok: false, code: "CAPABILITY_GRANTS_SHEET_MISSING", sheetName: TEMP_CAPABILITY_GRANT_SHEET_NAME, expectedHeaders: expected };
  }
  var lastColumn = Number(sheet.getLastColumn ? sheet.getLastColumn() : 0);
  if (lastColumn !== expected.length) {
    return { ok: false, code: "CAPABILITY_GRANTS_SCHEMA_MISMATCH", sheetName: TEMP_CAPABILITY_GRANT_SHEET_NAME, expectedHeaders: expected, actualHeaders: [] };
  }
  var actual = sheet.getRange(1, 1, 1, expected.length).getValues()[0].map(function (value) { return String(value || "").trim(); });
  var mismatches = [];
  expected.forEach(function (header, index) {
    if (actual[index] !== header) mismatches.push({ column: index + 1, expected: header, actual: actual[index] });
  });
  return {
    ok: mismatches.length === 0,
    code: mismatches.length ? "CAPABILITY_GRANTS_SCHEMA_MISMATCH" : "CAPABILITY_GRANTS_SCHEMA_OK",
    sheetName: TEMP_CAPABILITY_GRANT_SHEET_NAME,
    expectedHeaders: expected,
    actualHeaders: actual,
    mismatches: mismatches
  };
}

function getCapabilityGrantsSpreadsheetId_() {
  var configKey = String(CONFIG && CONFIG.CAPABILITY_GRANTS_SPREADSHEET_CONFIG_KEY || "").trim();
  if (!configKey) throw new Error("CAPABILITY_GRANTS_SPREADSHEET_CONFIG_MISSING");
  if (!/^SPREADSHEET_ID_[A-Z0-9_]+$/.test(configKey)) throw new Error("CAPABILITY_GRANTS_SPREADSHEET_CONFIG_KEY_INVALID");
  var spreadsheetId = String(CONFIG && CONFIG[configKey] || "").trim();
  if (!spreadsheetId) throw new Error("CAPABILITY_GRANTS_SPREADSHEET_ID_MISSING");
  return spreadsheetId;
}

function getCapabilityGrantsSpreadsheet_() {
  var spreadsheetId = getCapabilityGrantsSpreadsheetId_();
  var spreadsheet;
  try {
    spreadsheet = SpreadsheetApp.openById(spreadsheetId);
  } catch (error) {
    throw new Error("CAPABILITY_GRANTS_SPREADSHEET_INACCESSIBLE: " + String(error && error.message || error));
  }
  if (!spreadsheet) throw new Error("CAPABILITY_GRANTS_SPREADSHEET_INACCESSIBLE");
  if (typeof spreadsheet.getId === "function" && String(spreadsheet.getId() || "") !== spreadsheetId) {
    throw new Error("CAPABILITY_GRANTS_SPREADSHEET_ID_MISMATCH");
  }
  return spreadsheet;
}

function capabilityGrantSpreadsheet_(options) {
  return options && options.spreadsheet ? options.spreadsheet : getCapabilityGrantsSpreadsheet_();
}

function capabilityGrantSheet_(options) {
  if (options && options.sheet) return options.sheet;
  return capabilityGrantSpreadsheet_(options).getSheetByName(TEMP_CAPABILITY_GRANT_SHEET_NAME);
}

function initializeCapabilityGrantSheet_(options) {
  var opts = options || {};
  var spreadsheet = capabilityGrantSpreadsheet_(opts);
  var sheet = spreadsheet.getSheetByName(TEMP_CAPABILITY_GRANT_SHEET_NAME);
  var workbookId = typeof spreadsheet.getId === "function" ? String(spreadsheet.getId() || "") : getCapabilityGrantsSpreadsheetId_();
  var workbookName = typeof spreadsheet.getName === "function" ? String(spreadsheet.getName() || "") : "";
  if (sheet) {
    var validation = validateCapabilityGrantSheetSchema_(sheet);
    return {
      ok: validation.ok,
      mode: opts.apply === true ? "APPLY" : "DRY_RUN",
      action: validation.ok ? "NO_CHANGE" : "REFUSED_DESTRUCTIVE_REPAIR",
      created: false,
      workbookId: workbookId,
      workbookName: workbookName,
      validation: validation
    };
  }
  if (opts.apply !== true) {
    return {
      ok: true,
      mode: "DRY_RUN",
      action: "CREATE_REQUIRED",
      created: false,
      workbookId: workbookId,
      workbookName: workbookName,
      sheetName: TEMP_CAPABILITY_GRANT_SHEET_NAME,
      headers: capabilityGrantSchemaHeaders_()
    };
  }
  if (String(opts.confirmation || "") !== "CREATE_CAPABILITY_GRANTS") {
    return { ok: false, mode: "APPLY", action: "CONFIRMATION_REQUIRED", created: false, workbookId: workbookId, workbookName: workbookName, sheetName: TEMP_CAPABILITY_GRANT_SHEET_NAME };
  }
  sheet = spreadsheet.insertSheet(TEMP_CAPABILITY_GRANT_SHEET_NAME);
  sheet.getRange(1, 1, 1, capabilityGrantSchemaHeaders_().length).setValues([capabilityGrantSchemaHeaders_()]);
  if (sheet.setFrozenRows) sheet.setFrozenRows(1);
  return {
    ok: true,
    mode: "APPLY",
    action: "CREATED",
    created: true,
    workbookId: workbookId,
    workbookName: workbookName,
    sheetName: TEMP_CAPABILITY_GRANT_SHEET_NAME,
    validation: validateCapabilityGrantSheetSchema_(sheet)
  };
}

function capabilityGrantRowToDto_(values, rowNumber, now) {
  var row = Array.isArray(values) ? values : [];
  var idx = capabilityGrantHeaderIndex_();
  var expiresAt = capabilityGrantIso_(row[idx.Expires_At]);
  var startsAt = capabilityGrantIso_(row[idx.Starts_At]);
  var status = String(row[idx.Status] || "").trim().toUpperCase();
  var nowMs = (now instanceof Date ? now : new Date(now || new Date())).getTime();
  var startsMs = startsAt ? new Date(startsAt).getTime() : 0;
  var expiresMs = expiresAt ? new Date(expiresAt).getTime() : 0;
  var isExpired = !!expiresMs && expiresMs <= nowMs;
  var isStarted = !startsMs || startsMs <= nowMs;
  var effectiveStatus = status === "ACTIVE" && isExpired ? "EXPIRED" : status;
  return {
    grantId: String(row[idx.Grant_ID] || "").trim(),
    accountEmail: normalizeAdminEmail_(row[idx.Account_Email]),
    capabilityKey: String(row[idx.Capability_Key] || "").trim().toUpperCase(),
    grantType: String(row[idx.Grant_Type] || "").trim().toUpperCase(),
    status: effectiveStatus,
    storedStatus: status,
    grantedByEmail: normalizeAdminEmail_(row[idx.Granted_By_Email]),
    grantedByRole: String(row[idx.Granted_By_Role] || "").trim().toUpperCase(),
    grantedAt: capabilityGrantIso_(row[idx.Granted_At]),
    startsAt: startsAt,
    expiresAt: expiresAt,
    reason: String(row[idx.Reason] || "").trim(),
    scopeType: String(row[idx.Scope_Type] || "").trim().toUpperCase(),
    isActive: effectiveStatus === "ACTIVE" && isStarted && !isExpired,
    isExpired: isExpired,
    revokedByEmail: normalizeAdminEmail_(row[idx.Revoked_By_Email]),
    revokedAt: capabilityGrantIso_(row[idx.Revoked_At]),
    revocationReason: String(row[idx.Revocation_Reason] || "").trim(),
    createdRuntimeIdentity: String(row[idx.Created_Runtime_Identity] || "").trim(),
    updatedAt: capabilityGrantIso_(row[idx.Updated_At]),
    recordVersion: Number(row[idx.Record_Version] || 0),
    _rowNumber: Number(rowNumber || 0)
  };
}

function capabilityGrantPublicDto_(grant) {
  var source = grant || {};
  return {
    grantId: String(source.grantId || ""),
    accountEmail: String(source.accountEmail || ""),
    capabilityKey: String(source.capabilityKey || ""),
    grantType: String(source.grantType || ""),
    status: String(source.status || ""),
    grantedByEmail: String(source.grantedByEmail || ""),
    grantedByRole: String(source.grantedByRole || ""),
    grantedAt: String(source.grantedAt || ""),
    startsAt: String(source.startsAt || ""),
    expiresAt: String(source.expiresAt || ""),
    reason: String(source.reason || ""),
    scopeType: String(source.scopeType || ""),
    isActive: source.isActive === true,
    isExpired: source.isExpired === true,
    revokedByEmail: String(source.revokedByEmail || ""),
    revokedAt: String(source.revokedAt || ""),
    revocationReason: String(source.revocationReason || ""),
    createdRuntimeIdentity: String(source.createdRuntimeIdentity || ""),
    updatedAt: String(source.updatedAt || ""),
    recordVersion: Number(source.recordVersion || 0)
  };
}

function capabilityGrantReadRows_(options) {
  var opts = options || {};
  var sheet = capabilityGrantSheet_(opts);
  if (!sheet) return [];
  var validation = validateCapabilityGrantSheetSchema_(sheet);
  if (!validation.ok) throw new Error(validation.code);
  var lastRow = Number(sheet.getLastRow ? sheet.getLastRow() : 0);
  if (lastRow < 2) return [];
  var width = capabilityGrantSchemaHeaders_().length;
  var values = sheet.getRange(2, 1, lastRow - 1, width).getValues();
  var now = capabilityGrantNow_(opts);
  return values.map(function (row, index) { return capabilityGrantRowToDto_(row, index + 2, now); }).filter(function (grant) { return !!grant.grantId; });
}

function capabilityGrantCacheKey_(accountEmail) {
  return TEMP_CAPABILITY_GRANT_CACHE_PREFIX + ":" + normalizeAdminEmail_(accountEmail).replace(/[^a-z0-9@._-]/g, "_");
}

function capabilityGrantCache_() {
  try { return CacheService.getScriptCache(); } catch (_err) { return null; }
}

function invalidateTemporaryCapabilityGrantCache_(accountEmail) {
  var cache = capabilityGrantCache_();
  if (cache && accountEmail) cache.remove(capabilityGrantCacheKey_(accountEmail));
}

function capabilityGrantAudit_(eventName, payload) {
  logAudit_(eventName, payload || {});
}

function capabilityGrantWithScriptLock_(callback) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(TEMP_CAPABILITY_GRANT_LOCK_TIMEOUT_MS)) throw new Error("CAPABILITY_GRANT_LOCK_TIMEOUT");
  try { return callback(); } finally { lock.releaseLock(); }
}

function capabilityGrantUpdateRow_(sheet, grant, patch, now) {
  var headers = capabilityGrantSchemaHeaders_();
  var idx = capabilityGrantHeaderIndex_();
  var values = sheet.getRange(grant._rowNumber, 1, 1, headers.length).getValues()[0];
  Object.keys(patch || {}).forEach(function (header) {
    if (Object.prototype.hasOwnProperty.call(idx, header)) values[idx[header]] = patch[header];
  });
  values[idx.Updated_At] = capabilityGrantIso_(now);
  values[idx.Record_Version] = Number(grant.recordVersion || 0) + 1;
  sheet.getRange(grant._rowNumber, 1, 1, headers.length).setValues([values]);
  return capabilityGrantRowToDto_(values, grant._rowNumber, now);
}

function expireTemporaryCapabilityGrants_(options) {
  var opts = options || {};
  var now = capabilityGrantNow_(opts);
  var sheet = capabilityGrantSheet_(opts);
  if (!sheet) return [];
  return capabilityGrantWithScriptLock_(function () {
    var expired = [];
    capabilityGrantReadRows_({ sheet: sheet, now: now }).forEach(function (grant) {
      if (grant.storedStatus !== "ACTIVE" || !grant.isExpired) return;
      var updated = capabilityGrantUpdateRow_(sheet, grant, { Status: "EXPIRED" }, now);
      invalidateTemporaryCapabilityGrantCache_(grant.accountEmail);
      capabilityGrantAudit_("TEMP_CAPABILITY_GRANT_EXPIRED", {
        actor: "SYSTEM",
        targetAccount: grant.accountEmail,
        capability: grant.capabilityKey,
        grantId: grant.grantId,
        reason: "Server expiry reached.",
        startsAt: grant.startsAt,
        expiresAt: grant.expiresAt,
        previousStatus: "ACTIVE",
        newStatus: "EXPIRED",
        runtimeIdentity: capabilityGrantRuntimeIdentity_(),
        result: "EXPIRED"
      });
      expired.push(capabilityGrantPublicDto_(updated));
    });
    return expired;
  });
}

function loadActiveTemporaryCapabilityGrantsForAccount_(accountEmail, options) {
  var email = normalizeAdminEmail_(accountEmail);
  if (!email || !isAdmin_(email)) return [];
  var opts = options || {};
  var now = capabilityGrantNow_(opts);
  var cache = opts.disableCache === true ? null : capabilityGrantCache_();
  var key = capabilityGrantCacheKey_(email);
  if (cache) {
    var raw = cache.get(key);
    if (raw) {
      try {
        return JSON.parse(raw).map(function (grant) {
          var copy = grant || {};
          var expiresMs = copy.expiresAt ? new Date(copy.expiresAt).getTime() : 0;
          copy.isExpired = !!expiresMs && expiresMs <= now.getTime();
          copy.isActive = copy.status === "ACTIVE" && !copy.isExpired && (!copy.startsAt || new Date(copy.startsAt).getTime() <= now.getTime());
          return copy;
        }).filter(function (grant) { return grant.isActive === true; });
      } catch (_cacheErr) { cache.remove(key); }
    }
  }
  var sheet = capabilityGrantSheet_(opts);
  if (!sheet) {
    if (cache) cache.put(key, "[]", TEMP_CAPABILITY_GRANT_CACHE_TTL_SECONDS);
    return [];
  }
  var validation = validateCapabilityGrantSheetSchema_(sheet);
  if (!validation.ok) {
    if (cache) cache.put(key, "[]", TEMP_CAPABILITY_GRANT_CACHE_TTL_SECONDS);
    return [];
  }
  var all = capabilityGrantReadRows_({ sheet: sheet, now: now });
  if (all.some(function (grant) { return grant.storedStatus === "ACTIVE" && grant.isExpired; })) {
    try {
      expireTemporaryCapabilityGrants_({ sheet: sheet, now: now });
      all = capabilityGrantReadRows_({ sheet: sheet, now: now });
    } catch (_expiryTransitionError) {
      invalidateTemporaryCapabilityGrantCache_(email);
    }
  }
  var active = all.filter(function (grant) {
    return grant.accountEmail === email && grant.isActive === true && temporaryDelegableAdminCapabilities_().indexOf(grant.capabilityKey) >= 0;
  }).map(capabilityGrantPublicDto_);
  if (cache) {
    var ttl = TEMP_CAPABILITY_GRANT_CACHE_TTL_SECONDS;
    active.forEach(function (grant) {
      var seconds = Math.floor((new Date(grant.expiresAt).getTime() - now.getTime()) / 1000);
      if (seconds > 0) ttl = Math.min(ttl, seconds);
    });
    cache.put(key, JSON.stringify(active), Math.max(1, ttl));
  }
  return active;
}

function requireTemporaryCapabilityGrantManager_(actorEmail) {
  var email = normalizeAdminEmail_(actorEmail);
  if (!isAdmin_(email) || getAdminRole_(email) !== "SUPER") throw new Error("Access denied: SUPER capability-grant authority required");
  return email;
}

function capabilityGrantConfiguredAccount_(email) {
  var normalized = normalizeAdminEmail_(email);
  return getConfiguredAdminAccounts_().filter(function (entry) { return entry.allowlisted === true && entry.email === normalized; })[0] || null;
}

function capabilityGrantValidateCreateRequest_(request, actorEmail, now) {
  var p = request && typeof request === "object" ? request : {};
  var target = capabilityGrantConfiguredAccount_(p.accountEmail);
  var capability = String(p.capabilityKey || "").trim().toUpperCase();
  var reason = String(p.reason || "").trim();
  var startsAt = capabilityGrantIso_(p.startsAt || now);
  var expiresAt = capabilityGrantIso_(p.expiresAt);
  if (!target) throw new Error("UNKNOWN_CONFIGURED_ACCOUNT");
  if (target.configuredRole === "SUPER") throw new Error("SUPER_TARGET_NOT_ALLOWED");
  if (adminCapabilityCatalog_().indexOf(capability) < 0) throw new Error("UNKNOWN_CAPABILITY");
  if (temporaryDelegableAdminCapabilities_().indexOf(capability) < 0) throw new Error("CAPABILITY_NOT_DELEGABLE");
  if (reason.length < 8) throw new Error("GRANT_REASON_REQUIRED");
  if (!startsAt || !expiresAt) throw new Error("VALID_EXPIRY_REQUIRED");
  var startMs = new Date(startsAt).getTime();
  var expiryMs = new Date(expiresAt).getTime();
  if (expiryMs <= now.getTime() || expiryMs <= startMs) throw new Error("EXPIRY_MUST_BE_FUTURE");
  if (expiryMs - now.getTime() > TEMP_CAPABILITY_GRANT_MAX_DURATION_MS) throw new Error("MAXIMUM_GRANT_DURATION_EXCEEDED");
  var base = adminCapabilityRoleDefaults_(target.configuredRole);
  if (base[capability] === true) throw new Error("CAPABILITY_ALREADY_INHERITED");
  return { actorEmail: actorEmail, target: target, capabilityKey: capability, reason: reason, startsAt: startsAt, expiresAt: expiresAt };
}

function capabilityGrantNewId_() {
  var id = "";
  try { id = Utilities.getUuid(); } catch (_err) { id = typeof newDebugId_ === "function" ? newDebugId_() : String(new Date().getTime()); }
  return "TCG-" + String(id).replace(/[^a-zA-Z0-9]/g, "").slice(0, 24).toUpperCase();
}

function capabilityGrantCreate_(request, options) {
  var opts = options || {};
  var actorEmail = requireTemporaryCapabilityGrantManager_(opts.actorEmail || getCallerEmail_());
  var actorRole = getAdminRole_(actorEmail);
  var now = capabilityGrantNow_(opts);
  var validated = capabilityGrantValidateCreateRequest_(request, actorEmail, now);
  return capabilityGrantWithScriptLock_(function () {
    var sheet = capabilityGrantSheet_(opts);
    var schema = validateCapabilityGrantSheetSchema_(sheet);
    if (!schema.ok) throw new Error(schema.code);
    var current = capabilityGrantReadRows_({ sheet: sheet, now: now });
    if (current.some(function (grant) {
      if (grant.accountEmail !== validated.target.email || grant.capabilityKey !== validated.capabilityKey || grant.storedStatus !== "ACTIVE") return false;
      var existingStart = grant.startsAt ? new Date(grant.startsAt).getTime() : now.getTime();
      var existingEnd = grant.expiresAt ? new Date(grant.expiresAt).getTime() : 0;
      var requestedStart = new Date(validated.startsAt).getTime();
      var requestedEnd = new Date(validated.expiresAt).getTime();
      return existingEnd > requestedStart && requestedEnd > existingStart;
    })) throw new Error("OVERLAPPING_ACTIVE_GRANT");
    var grantId = capabilityGrantNewId_();
    var headers = capabilityGrantSchemaHeaders_();
    var idx = capabilityGrantHeaderIndex_();
    var row = headers.map(function () { return ""; });
    row[idx.Grant_ID] = grantId;
    row[idx.Account_Email] = validated.target.email;
    row[idx.Capability_Key] = validated.capabilityKey;
    row[idx.Grant_Type] = "TEMPORARY_CAPABILITY";
    row[idx.Status] = "ACTIVE";
    row[idx.Granted_By_Email] = actorEmail;
    row[idx.Granted_By_Role] = actorRole;
    row[idx.Granted_At] = capabilityGrantIso_(now);
    row[idx.Starts_At] = validated.startsAt;
    row[idx.Expires_At] = validated.expiresAt;
    row[idx.Reason] = validated.reason;
    row[idx.Scope_Type] = "ACCOUNT_CAPABILITY";
    row[idx.Scope_Payload_JSON] = JSON.stringify({ accountEmail: validated.target.email, capabilityKey: validated.capabilityKey });
    row[idx.Used_Count] = 0;
    row[idx.Created_Runtime_Identity] = capabilityGrantRuntimeIdentity_();
    row[idx.Updated_At] = capabilityGrantIso_(now);
    row[idx.Record_Version] = 1;
    sheet.appendRow(row);
    invalidateTemporaryCapabilityGrantCache_(validated.target.email);
    try {
      capabilityGrantAudit_("TEMP_CAPABILITY_GRANT_CREATED", {
        actor: actorEmail,
        targetAccount: validated.target.email,
        capability: validated.capabilityKey,
        grantId: grantId,
        reason: validated.reason,
        startsAt: validated.startsAt,
        expiresAt: validated.expiresAt,
        previousStatus: "",
        newStatus: "ACTIVE",
        runtimeIdentity: capabilityGrantRuntimeIdentity_(),
        result: "CREATED"
      });
    } catch (auditError) {
      var appended = capabilityGrantRowToDto_(row, sheet.getLastRow(), now);
      capabilityGrantUpdateRow_(sheet, appended, { Status: "INVALIDATED" }, now);
      invalidateTemporaryCapabilityGrantCache_(validated.target.email);
      throw new Error("CAPABILITY_GRANT_AUDIT_FAILED: " + String(auditError && auditError.message || auditError));
    }
    return capabilityGrantPublicDto_(capabilityGrantRowToDto_(row, sheet.getLastRow(), now));
  });
}

function capabilityGrantRevoke_(request, options) {
  var opts = options || {};
  var actorEmail = requireTemporaryCapabilityGrantManager_(opts.actorEmail || getCallerEmail_());
  var now = capabilityGrantNow_(opts);
  var grantId = String(request && request.grantId || "").trim();
  var reason = String(request && request.reason || "").trim();
  var expectedVersion = Number(request && request.recordVersion || 0);
  if (!grantId) throw new Error("GRANT_ID_REQUIRED");
  if (reason.length < 8) throw new Error("REVOCATION_REASON_REQUIRED");
  if (!expectedVersion) throw new Error("RECORD_VERSION_REQUIRED");
  return capabilityGrantWithScriptLock_(function () {
    var sheet = capabilityGrantSheet_(opts);
    var schema = validateCapabilityGrantSheetSchema_(sheet);
    if (!schema.ok) throw new Error(schema.code);
    var grant = capabilityGrantReadRows_({ sheet: sheet, now: now }).filter(function (entry) { return entry.grantId === grantId; })[0];
    if (!grant) throw new Error("GRANT_NOT_FOUND");
    if (grant.recordVersion !== expectedVersion) throw new Error("STALE_GRANT_RECORD_VERSION");
    if (grant.status !== "ACTIVE") throw new Error("GRANT_NOT_ACTIVE");
    if (grant.isExpired) throw new Error("GRANT_ALREADY_EXPIRED");
    var updated = capabilityGrantUpdateRow_(sheet, grant, {
      Status: "REVOKED",
      Revoked_By_Email: actorEmail,
      Revoked_At: capabilityGrantIso_(now),
      Revocation_Reason: reason
    }, now);
    invalidateTemporaryCapabilityGrantCache_(grant.accountEmail);
    capabilityGrantAudit_("TEMP_CAPABILITY_GRANT_REVOKED", {
      actor: actorEmail,
      targetAccount: grant.accountEmail,
      capability: grant.capabilityKey,
      grantId: grant.grantId,
      reason: reason,
      startsAt: grant.startsAt,
      expiresAt: grant.expiresAt,
      previousStatus: "ACTIVE",
      newStatus: "REVOKED",
      runtimeIdentity: capabilityGrantRuntimeIdentity_(),
      result: "REVOKED"
    });
    return capabilityGrantPublicDto_(updated);
  });
}

function capabilityGrantMatrix_(actorEmail, options) {
  var email = normalizeAdminEmail_(actorEmail);
  if (!isAdmin_(email)) throw new Error("Access denied");
  var isSuper = getAdminRole_(email) === "SUPER";
  var opts = options || {};
  var now = capabilityGrantNow_(opts);
  var sheet = capabilityGrantSheet_(opts);
  var schema = validateCapabilityGrantSheetSchema_(sheet);
  var grants = schema.ok ? capabilityGrantReadRows_({ sheet: sheet, now: now }) : [];
  var accounts = getConfiguredAdminAccounts_().filter(function (account) { return isSuper || account.email === email; }).map(function (account) {
    var effective = resolveAdminCapabilities_({ email: account.email, temporaryGrantOptions: { sheet: sheet, now: now, disableCache: true } });
    return {
      email: account.email,
      durableRole: account.configuredRole,
      capabilities: temporaryDelegableAdminCapabilities_().map(function (capability) {
        var active = grants.filter(function (grant) { return grant.accountEmail === account.email && grant.capabilityKey === capability && grant.isActive; })[0] || null;
        var inherited = adminCapabilityRoleDefaults_(account.configuredRole)[capability] === true;
        return {
          capabilityKey: capability,
          inheritedAllowed: inherited,
          effectiveAllowed: effective.capabilities[capability] === true,
          state: active ? "TEMPORARILY_ALLOWED" : (inherited ? "INHERITED_ALLOWED" : "INHERITED_DENIED"),
          temporaryGrant: active ? capabilityGrantPublicDto_(active) : null
        };
      })
    };
  });
  return {
    actorEmail: email,
    actorRole: getAdminRole_(email),
    isSuper: isSuper,
    schema: schema,
    delegableCapabilities: temporaryDelegableAdminCapabilities_(),
    nonDelegableCapabilities: temporaryNonDelegableAdminCapabilities_(),
    maximumDurationHours: TEMP_CAPABILITY_GRANT_MAX_DURATION_MS / 3600000,
    myEffectiveCapabilities: resolveAdminCapabilities_({ email: email, temporaryGrantOptions: { sheet: sheet, now: now, disableCache: true } }),
    accounts: accounts,
    grants: grants.filter(function (grant) { return isSuper || grant.accountEmail === email; }).map(capabilityGrantPublicDto_)
  };
}

function capabilityGrantBackupTimestamp_(now) {
  return capabilityGrantIso_(now).replace(/[-:.TZ]/g, "").slice(0, 14);
}

function capabilityGrantCreatePreMigrationBackup_(request, options) {
  var opts = options || {};
  var actorEmail = requireTemporaryCapabilityGrantManager_(opts.actorEmail || getCallerEmail_());
  var p = request && typeof request === "object" ? request : {};
  if (String(p.confirmation || "") !== "CREATE_H1_PRE_MIGRATION_BACKUP") throw new Error("BACKUP_CONFIRMATION_REQUIRED");
  var commitHash = String(p.commitHash || "").trim();
  var adminDeploymentPin = String(p.adminDeploymentPin || "").trim();
  var studentDeploymentPin = String(p.studentDeploymentPin || "").trim();
  if (!commitHash || !adminDeploymentPin || !studentDeploymentPin) throw new Error("BACKUP_RELEASE_METADATA_REQUIRED");
  var now = capabilityGrantNow_(opts);
  var timestamp = capabilityGrantBackupTimestamp_(now);
  var workbook = opts.spreadsheet || getCapabilityGrantsSpreadsheet_();
  var workbookId = typeof workbook.getId === "function" ? String(workbook.getId() || "") : getCapabilityGrantsSpreadsheetId_();
  if (workbookId !== getCapabilityGrantsSpreadsheetId_()) throw new Error("CAPABILITY_GRANTS_SPREADSHEET_ID_MISMATCH");
  var workbookName = typeof workbook.getName === "function" ? String(workbook.getName() || "") : "FODE authoritative workbook";
  var sourceTabNames = workbook.getSheets().map(function (sheet) { return String(sheet.getName() || ""); });
  var drive = opts.driveApp || DriveApp;
  var spreadsheetApi = opts.spreadsheetApp || SpreadsheetApp;
  var propertiesApi = opts.propertiesService || PropertiesService;
  var backupFolder = drive.createFolder("FODE_Runtime_H1_Backup_" + timestamp);
  if (backupFolder.setDescription) backupFolder.setDescription("Track H1 pre-migration backup for " + workbookId + " at " + capabilityGrantIso_(now));
  if (backupFolder.setSharing && drive.Access && drive.Permission) backupFolder.setSharing(drive.Access.PRIVATE, drive.Permission.NONE);
  if (backupFolder.getSharingAccess && drive.Access && backupFolder.getSharingAccess() !== drive.Access.PRIVATE) throw new Error("BACKUP_FOLDER_NOT_PRIVATE");
  var sourceFile = drive.getFileById(workbookId);
  var workbookCopy = sourceFile.makeCopy(workbookName + " - H1 pre-migration backup " + timestamp, backupFolder);
  var copiedWorkbook = spreadsheetApi.openById(workbookCopy.getId());
  var copiedTabNames = copiedWorkbook.getSheets().map(function (sheet) { return String(sheet.getName() || ""); });
  if (sourceTabNames.length !== copiedTabNames.length || sourceTabNames.join("\n") !== copiedTabNames.join("\n")) {
    throw new Error("BACKUP_WORKBOOK_TAB_VERIFICATION_FAILED");
  }
  var scriptProperties = propertiesApi.getScriptProperties().getProperties();
  var propertyKeys = Object.keys(scriptProperties || {}).sort();
  var propertyPayload = JSON.stringify({
    schemaVersion: 1,
    generatedAt: capabilityGrantIso_(now),
    scriptId: typeof ScriptApp !== "undefined" && ScriptApp.getScriptId ? ScriptApp.getScriptId() : String(opts.scriptId || ""),
    runtimeIdentity: capabilityGrantRuntimeIdentity_(),
    properties: scriptProperties || {}
  }, null, 2);
  var propertyFile = backupFolder.createFile("script-properties-" + timestamp + ".json", propertyPayload, typeof MimeType !== "undefined" ? MimeType.PLAIN_TEXT : "text/plain");
  if (propertyFile.setDescription) propertyFile.setDescription("Protected restorable Script Properties backup. Contains secrets; do not share or commit.");
  if (propertyFile.getSize && Number(propertyFile.getSize() || 0) <= 0) throw new Error("SCRIPT_PROPERTIES_BACKUP_EMPTY");
  var manifest = {
    schemaVersion: 1,
    generatedAt: capabilityGrantIso_(now),
    actorEmail: actorEmail,
    runtimeIdentity: capabilityGrantRuntimeIdentity_(),
    scriptId: typeof ScriptApp !== "undefined" && ScriptApp.getScriptId ? ScriptApp.getScriptId() : String(opts.scriptId || ""),
    commitHash: commitHash,
    adminDeploymentPin: adminDeploymentPin,
    studentDeploymentPin: studentDeploymentPin,
    sourceWorkbookId: workbookId,
    sourceWorkbookName: workbookName,
    sourceTabCount: sourceTabNames.length,
    sourceTabNames: sourceTabNames,
    workbookCopyId: workbookCopy.getId(),
    workbookCopyName: workbookCopy.getName ? workbookCopy.getName() : "",
    copiedTabCount: copiedTabNames.length,
    copiedTabNames: copiedTabNames,
    scriptPropertiesFileId: propertyFile.getId(),
    scriptPropertyCount: propertyKeys.length,
    scriptPropertyKeys: propertyKeys,
    capabilityGrantTabPresentBeforeMigration: sourceTabNames.indexOf(TEMP_CAPABILITY_GRANT_SHEET_NAME) >= 0,
    verified: true
  };
  var manifestFile = backupFolder.createFile("h1-backup-manifest-" + timestamp + ".json", JSON.stringify(manifest, null, 2), typeof MimeType !== "undefined" ? MimeType.PLAIN_TEXT : "text/plain");
  if (manifestFile.getSize && Number(manifestFile.getSize() || 0) <= 0) throw new Error("BACKUP_MANIFEST_EMPTY");
  return {
    result: "BACKUP_VERIFIED",
    generatedAt: manifest.generatedAt,
    backupFolderId: backupFolder.getId(),
    backupFolderName: backupFolder.getName ? backupFolder.getName() : "",
    sourceWorkbookId: workbookId,
    sourceWorkbookName: workbookName,
    workbookCopyId: manifest.workbookCopyId,
    workbookCopyName: manifest.workbookCopyName,
    tabCount: copiedTabNames.length,
    tabNames: copiedTabNames,
    scriptPropertiesFileId: propertyFile.getId(),
    scriptPropertyCount: propertyKeys.length,
    scriptPropertyKeys: propertyKeys,
    manifestFileId: manifestFile.getId(),
    commitHash: commitHash,
    adminDeploymentPin: adminDeploymentPin,
    studentDeploymentPin: studentDeploymentPin,
    runtimeIdentity: manifest.runtimeIdentity,
    capabilityGrantTabPresentBeforeMigration: manifest.capabilityGrantTabPresentBeforeMigration,
    verified: true
  };
}

function admin_planCapabilityGrantsMigration(request) {
  return withEnvelope_("admin_planCapabilityGrantsMigration", function () {
    var actorEmail = requireTemporaryCapabilityGrantManager_(getCallerEmail_());
    var p = request && typeof request === "object" ? request : {};
    var report = initializeCapabilityGrantSheet_({ apply: p.apply === true, confirmation: p.confirmation || "" });
    if (report.created) {
      getConfiguredAdminAccounts_().forEach(function (account) { invalidateTemporaryCapabilityGrantCache_(account.email); });
      capabilityGrantAudit_("TEMP_CAPABILITY_GRANT_SCHEMA_CREATED", {
        actor: actorEmail,
        targetAccount: "",
        capability: "",
        grantId: "",
        reason: "Owner-approved Capability_Grants schema initialization.",
        startsAt: "",
        expiresAt: "",
        previousStatus: "MISSING",
        newStatus: "CREATED",
        runtimeIdentity: capabilityGrantRuntimeIdentity_(),
        result: "CREATED"
      });
    }
    return report;
  });
}

function admin_createCapabilityGrantPreMigrationBackup(request) {
  return withEnvelope_("admin_createCapabilityGrantPreMigrationBackup", function () {
    return capabilityGrantCreatePreMigrationBackup_(request || {});
  });
}

function admin_getCapabilityGrantMatrix() {
  return withEnvelope_("admin_getCapabilityGrantMatrix", function () {
    return capabilityGrantMatrix_(getCallerEmail_());
  });
}

function admin_getTemporaryCapabilityGrants(filters) {
  return withEnvelope_("admin_getTemporaryCapabilityGrants", function () {
    var actorEmail = requireTemporaryCapabilityGrantManager_(getCallerEmail_());
    var p = filters && typeof filters === "object" ? filters : {};
    var accountEmail = normalizeAdminEmail_(p.accountEmail || "");
    var capability = String(p.capabilityKey || "").trim().toUpperCase();
    var status = String(p.status || "").trim().toUpperCase();
    var sheet = capabilityGrantSheet_();
    var schema = validateCapabilityGrantSheetSchema_(sheet);
    var grants = schema.ok ? capabilityGrantReadRows_({ sheet: sheet }) : [];
    return {
      actorEmail: actorEmail,
      schema: schema,
      grants: grants.filter(function (grant) {
        return (!accountEmail || grant.accountEmail === accountEmail) && (!capability || grant.capabilityKey === capability) && (!status || grant.status === status);
      }).map(capabilityGrantPublicDto_)
    };
  });
}

function admin_createTemporaryCapabilityGrant(request) {
  return withEnvelope_("admin_createTemporaryCapabilityGrant", function () {
    try {
      var grant = capabilityGrantCreate_(request || {});
      return { result: "CREATED", grant: grant, matrix: capabilityGrantMatrix_(getCallerEmail_()) };
    } catch (error) {
      capabilityGrantAudit_("TEMP_CAPABILITY_GRANT_REJECTED", {
        actor: normalizeAdminEmail_(getCallerEmail_()),
        targetAccount: normalizeAdminEmail_(request && request.accountEmail),
        capability: String(request && request.capabilityKey || "").trim().toUpperCase(),
        grantId: "",
        reason: String(request && request.reason || ""),
        startsAt: capabilityGrantIso_(request && request.startsAt),
        expiresAt: capabilityGrantIso_(request && request.expiresAt),
        previousStatus: "",
        newStatus: "",
        runtimeIdentity: capabilityGrantRuntimeIdentity_(),
        result: String(error && error.message || error)
      });
      throw error;
    }
  });
}

function admin_revokeTemporaryCapabilityGrant(request) {
  return withEnvelope_("admin_revokeTemporaryCapabilityGrant", function () {
    try {
      var grant = capabilityGrantRevoke_(request || {});
      return { result: "REVOKED", grant: grant, matrix: capabilityGrantMatrix_(getCallerEmail_()) };
    } catch (error) {
      capabilityGrantAudit_("TEMP_CAPABILITY_GRANT_REJECTED", {
        actor: normalizeAdminEmail_(getCallerEmail_()),
        targetAccount: "",
        capability: "",
        grantId: String(request && request.grantId || ""),
        reason: String(request && request.reason || ""),
        startsAt: "",
        expiresAt: "",
        previousStatus: "",
        newStatus: "",
        runtimeIdentity: capabilityGrantRuntimeIdentity_(),
        result: String(error && error.message || error)
      });
      throw error;
    }
  });
}
