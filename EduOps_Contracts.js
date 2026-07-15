var EDUOPS_CONTRACT_VERSION = "EDUOPS_SHADOW_V1";
var EDUOPS_PROFILE_VERSION = "FODE_SHADOW_V1";

function eduopsConfig_() {
  return {
    enabled: true,
    readOnly: true,
    product: "FODE",
    requiredCapability: "CAN_OPEN_REVIEW_WORKSPACE",
    contractVersion: EDUOPS_CONTRACT_VERSION,
    profileVersion: EDUOPS_PROFILE_VERSION
  };
}

function eduopsReadOnlyRpcAllowlist_() {
  return [
    "eduops_getAccessProjection",
    "eduops_getProfile",
    "eduops_queryOperationalWorkload",
    "eduops_searchApplicants",
    "eduops_getApplicantWorkbench",
    "eduops_getDocumentManifest",
    "eduops_getDocumentRendition",
    "eduops_getDocumentFileAction",
    "eduops_getReconciliation",
    "eduops_getParityDiagnostics"
  ];
}

function eduopsClean_(value) {
  return clean_(value || "");
}

function eduopsUpper_(value, fallback) {
  return (eduopsClean_(value || fallback || "UNKNOWN").toUpperCase() || eduopsClean_(fallback || "UNKNOWN").toUpperCase());
}

function eduopsClone_(value) {
  if (value === null || value === undefined) return value;
  try {
    return JSON.parse(JSON.stringify(value));
  } catch (_err) {
    return value;
  }
}

function eduopsRequireAccess_() {
  var email = getCallerEmail_();
  if (!isAdmin_(email)) {
    throw new Error("Access denied");
  }
  var cfg = eduopsConfig_();
  if (cfg.requiredCapability && typeof adminHasCapability_ === "function" && !adminHasCapability_(email, cfg.requiredCapability)) {
    throw new Error("Access denied: " + cfg.requiredCapability + " required");
  }
  return {
    email: email,
    role: typeof getAdminRole_ === "function" ? getAdminRole_(email) : "",
    capabilities: typeof resolveAdminCapabilities_ === "function" ? resolveAdminCapabilities_(email) : {}
  };
}

function eduopsSourceReliability_(state, reason, domain) {
  var s = eduopsUpper_(state, "AUTHORITATIVE");
  return {
    state: s,
    sourceStatus: s,
    authorityStatus: s === "AUTHORITATIVE" || s === "DERIVED" ? "AUTHORITATIVE" : s,
    reasons: [eduopsClean_(reason || "FODE canonical authorities returned a bounded read-only projection.")],
    domain: eduopsClean_(domain || "FODE canonical runtime"),
    asOf: new Date().toISOString()
  };
}

function eduopsRuntimeSnapshotId_(snapshot) {
  var source = [
    EDUOPS_CONTRACT_VERSION,
    eduopsClean_(snapshot && snapshot.schemaVersion || ""),
    eduopsClean_(snapshot && snapshot.generatedAt || ""),
    Number(snapshot && snapshot.totalRows || 0)
  ].join("|");
  try {
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, source, Utilities.Charset.UTF_8);
    return "FODE-" + Utilities.base64EncodeWebSafe(digest).slice(0, 16);
  } catch (_err) {
    return "FODE-" + source.replace(/[^A-Za-z0-9]+/g, "-").slice(0, 48);
  }
}

function eduopsNormalizePageSize_(value) {
  var size = Number(value || 25);
  if (size === 10 || size === 25 || size === 50) return size;
  return 25;
}

function eduopsNormalizePage_(value) {
  return Math.max(1, Number(value || 1) || 1);
}

function eduopsHumanize_(value) {
  var text = eduopsClean_(value || "");
  if (!text) return "";
  return text.toLowerCase().replace(/_/g, " ").replace(/\b\w/g, function (ch) { return ch.toUpperCase(); });
}

function eduopsStateLabel_(state) {
  var key = eduopsUpper_(state, "UNKNOWN");
  var labels = {
    READY: "Ready Now",
    COOLING_OFF: "Cooling Off",
    AWAITING_APPLICANT: "Awaiting Applicant",
    AWAITING_PAYMENT: "Awaiting Payment",
    REVIEW_REQUIRED: "Review Required",
    BLOCKED: "Blocked",
    UNKNOWN: "Unknown",
    COMPLETE: "Complete"
  };
  return labels[key] || eduopsHumanize_(key);
}

function eduopsWorkScope_(row) {
  var owner = eduopsUpper_(row && row.actionOwner || "NONE");
  var urgency = eduopsUpper_(row && row.urgencyLevel || "");
  if (urgency === "ESCALATED" || urgency === "DORMANT" || urgency === "UNCONTACTABLE") return "ESCALATED";
  if (owner === "NONE") return "UNASSIGNED";
  if (owner === "ADMIN" || owner === "OFFICER" || owner === "FINANCE") return "MY";
  if (owner === "APPLICANT") return "TEAM";
  return "ALL_AUTHORISED";
}

function eduopsWorkOwnership_(row) {
  var scope = eduopsWorkScope_(row);
  return {
    scope: scope,
    assignedOperator: scope === "MY" ? "Current authorised operator" : "",
    assignedTeam: eduopsClean_(row && row.actionOwner || "Unassigned"),
    assignmentSource: "FODE Actionability Resolver projection",
    dueAt: eduopsClean_(row && row.lastRelevantDate || ""),
    escalationState: scope === "ESCALATED" ? "Escalated projection" : "Not escalated",
    unassignedReason: scope === "UNASSIGNED" ? "No current operator owner in canonical projection" : ""
  };
}

function eduopsReturnContext_(query, row) {
  return {
    product: "FODE",
    actionabilityState: eduopsUpper_(query && query.actionabilityState || row && row.actionabilityState || "READY"),
    worklistKey: eduopsClean_(query && query.worklistKey || row && row.worklistKey || ""),
    workScope: eduopsUpper_(query && query.workScope || "ALL_AUTHORISED"),
    page: eduopsNormalizePage_(query && query.page),
    pageSize: eduopsNormalizePageSize_(query && query.pageSize),
    applicantId: eduopsClean_(row && row.applicantId || "")
  };
}

function eduopsReadOnlyAction_(label, capability) {
  return {
    label: label,
    enabled: false,
    readOnly: true,
    requiredCapability: capability || "",
    reason: "Available in EduOps Pass 2. Current Admin remains the operational path."
  };
}
