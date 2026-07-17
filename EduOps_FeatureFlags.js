var EDUOPS_PASS2_FEATURE_DEFAULTS = {
  DOCUMENT_REVIEW: false,
  FINANCE_EVIDENCE_DECISION: false,
  SEND_INDIVIDUAL_COMMUNICATION: false,
  CONTACTABILITY_CORRECTION: false,
  PORTAL_ACCESS: false,
  BATCH_COMMUNICATION: false,
  BOOKS_ACTION: false
};

function eduopsFeatureFlags_() {
  var out = {};
  var properties = {};
  try { properties = PropertiesService.getScriptProperties().getProperties() || {}; } catch (_err) {}
  Object.keys(EDUOPS_PASS2_FEATURE_DEFAULTS).forEach(function (key) {
    out[key] = String(properties["EDUOPS_FLAG_" + key] || "").toLowerCase() === "true";
  });
  return out;
}

function eduopsRequireFeature_(operation) {
  var key = eduopsUpper_(operation, "");
  if (eduopsFeatureFlags_()[key] !== true) {
    throw new Error("DISABLED_BY_FLAG: " + key + " is not enabled for live EduOps execution");
  }
}

function eduops_setFeatureFlagsForAdminStaging(payload) {
  var actorEmail = getCallerEmail_();
  if (!isAdmin_(actorEmail) || getAdminRole_(actorEmail) !== "SUPER") throw new Error("ACCESS_DENIED: SUPER admin required");
  var p = payload && typeof payload === "object" ? payload : {};
  if (eduopsClean_(p.confirmation || "") !== "SET_EDUOPS_FEATURE_FLAGS_FOR_ADMIN_STAGING") throw new Error("CONFIRMATION_REQUIRED");
  if (!eduopsClean_(p.reason || "")) throw new Error("REASON_REQUIRED");
  var requested = p.flags && typeof p.flags === "object" ? p.flags : {};
  var allowed = {};
  Object.keys(EDUOPS_PASS2_FEATURE_DEFAULTS).forEach(function (key) { allowed[key] = true; });
  Object.keys(requested).forEach(function (key) {
    if (!allowed[key]) throw new Error("UNKNOWN_EDUOPS_FEATURE_FLAG: " + key);
  });
  if (requested.BOOKS_ACTION === true) throw new Error("BOOKS_ACTION_REQUIRES_SEPARATE_AUTHORITY_CIS");
  var before = eduopsFeatureFlags_();
  var updates = {};
  Object.keys(EDUOPS_PASS2_FEATURE_DEFAULTS).forEach(function (key) {
    var value = Object.prototype.hasOwnProperty.call(requested, key) ? requested[key] === true : before[key] === true;
    if (key === "BOOKS_ACTION") value = false;
    updates["EDUOPS_FLAG_" + key] = value ? "true" : "false";
  });
  PropertiesService.getScriptProperties().setProperties(updates);
  var after = eduopsFeatureFlags_();
  var changed = [];
  Object.keys(after).forEach(function (key) {
    if (before[key] !== after[key]) changed.push(key);
  });
  if (typeof logAdminEvent_ === "function") {
    logAdminEvent_("EDUOPS_FEATURE_FLAGS_SET", {
      actorEmail: actorEmail,
      reason: eduopsClean_(p.reason || ""),
      before: before,
      after: after,
      changed: changed,
      runtime: String(CONFIG && CONFIG.VERSION || "") + " / " + String(CONFIG && CONFIG.DEPLOY_VERSION_NUMBER || "")
    });
  }
  return { ok: true, actorEmail: actorEmail, before: before, after: after, changed: changed };
}
