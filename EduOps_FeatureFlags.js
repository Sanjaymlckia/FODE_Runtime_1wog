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
