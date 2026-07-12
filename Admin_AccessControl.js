function normalizeAdminEmail_(email) {
  return String(email || "").toLowerCase().trim();
}

function adminCapabilityCatalog_() {
  return [
    "CAN_OPEN_REVIEW_WORKSPACE",
    "CAN_REVIEW_DOCUMENTS",
    "CAN_SAVE_DOCUMENT_STATUSES",
    "CAN_EDIT_APPLICANT_COMMUNICATION",
    "CAN_PREVIEW_APPLICANT_COMMUNICATION",
    "CAN_SEND_INDIVIDUAL_EMAIL",
    "CAN_SEND_INDIVIDUAL_WHATSAPP",
    "CAN_INSERT_PORTAL_LINK",
    "CAN_GENERATE_STANDARD_QUOTE",
    "CAN_GENERATE_STANDARD_INVOICE",
    "CAN_VERIFY_PAYMENT",
    "CAN_RUN_BATCH_COMMUNICATIONS",
    "CAN_OVERRIDE_COOLDOWN",
    "CAN_APPROVE_FINANCIAL_OVERRIDE",
    "CAN_MANAGE_PORTAL_ACCESS",
    "CAN_MANAGE_ROLES",
    "CAN_ADMINISTER_RUNTIME",
    "CAN_DEPLOY_RUNTIME",
    "CAN_WRITE_ZOHO_BOOKS"
  ];
}

function adminCapabilityRoleDefaults_(role) {
  var normalizedRole = String(role || "").toUpperCase();
  var defaults = {};
  adminCapabilityCatalog_().forEach(function (key) { defaults[key] = false; });
  if (normalizedRole === "SUPER" || normalizedRole === "OPERATIONS" || normalizedRole === "VERIFIER") {
    defaults.CAN_OPEN_REVIEW_WORKSPACE = true;
    defaults.CAN_REVIEW_DOCUMENTS = true;
    defaults.CAN_SAVE_DOCUMENT_STATUSES = true;
    defaults.CAN_EDIT_APPLICANT_COMMUNICATION = true;
    defaults.CAN_PREVIEW_APPLICANT_COMMUNICATION = true;
    defaults.CAN_SEND_INDIVIDUAL_EMAIL = true;
    defaults.CAN_INSERT_PORTAL_LINK = true;
    defaults.CAN_GENERATE_STANDARD_QUOTE = true;
  }
  if (normalizedRole === "SUPER" || normalizedRole === "OPERATIONS") {
    defaults.CAN_RUN_BATCH_COMMUNICATIONS = true;
    defaults.CAN_GENERATE_STANDARD_INVOICE = true;
  }
  if (normalizedRole === "SUPER") {
    defaults.CAN_VERIFY_PAYMENT = true;
    defaults.CAN_OVERRIDE_COOLDOWN = true;
    defaults.CAN_APPROVE_FINANCIAL_OVERRIDE = true;
    defaults.CAN_MANAGE_PORTAL_ACCESS = true;
    defaults.CAN_MANAGE_ROLES = true;
    defaults.CAN_ADMINISTER_RUNTIME = true;
    defaults.CAN_DEPLOY_RUNTIME = true;
    defaults.CAN_WRITE_ZOHO_BOOKS = true;
  }
  return defaults;
}

function getConfiguredAdminAccounts_() {
  if (getConfiguredAdminAccounts_._cache) return getConfiguredAdminAccounts_._cache.slice();
  var allowlist = (CONFIG.ADMIN_EMAILS || []).map(function (entry) {
    return normalizeAdminEmail_(entry);
  }).filter(function (entry) {
    return !!entry;
  });
  var roles = CONFIG.ADMIN_ROLES || {};
  var superAdmins = (CONFIG.SUPER_ADMIN_EMAILS || []).map(function (entry) {
    return normalizeAdminEmail_(entry);
  }).filter(function (entry) {
    return !!entry;
  });
  var accounts = {};
  allowlist.forEach(function (email) {
    accounts[email] = {
      email: email,
      allowlisted: true,
      configuredRole: ""
    };
  });
  Object.keys(roles).forEach(function (key) {
    var email = normalizeAdminEmail_(key);
    if (!email) return;
    if (!accounts[email]) {
      accounts[email] = {
        email: email,
        allowlisted: allowlist.indexOf(email) >= 0,
        configuredRole: ""
      };
    }
    accounts[email].configuredRole = String(roles[key] || "").toUpperCase();
  });
  superAdmins.forEach(function (email) {
    if (!accounts[email]) {
      accounts[email] = {
        email: email,
        allowlisted: allowlist.indexOf(email) >= 0,
        configuredRole: ""
      };
    }
    accounts[email].isSuperAdmin = true;
  });
  var result = Object.keys(accounts).sort().map(function (email) {
    var account = accounts[email];
    var configuredRole = String(account.configuredRole || "").toUpperCase();
    if (configuredRole !== "SUPER" && configuredRole !== "OPERATIONS") configuredRole = "VERIFIER";
    return {
      email: email,
      allowlisted: account.allowlisted === true,
      configuredRole: configuredRole,
      isSuperAdmin: account.isSuperAdmin === true
    };
  });
  getConfiguredAdminAccounts_._cache = result.slice();
  return result;
}

function isAdmin_(email) {
  email = normalizeAdminEmail_(email);
  return getConfiguredAdminAccounts_().some(function (entry) {
    return entry.allowlisted === true && entry.email === email;
  });
}

function getAdminRole_(email) {
  var e = normalizeAdminEmail_(email);
  var match = getConfiguredAdminAccounts_().filter(function (entry) {
    return entry.email === e;
  })[0];
  if (!match || match.allowlisted !== true) return "VERIFIER";
  if (match.configuredRole === "SUPER") return "SUPER";
  if (match.configuredRole === "OPERATIONS") return "OPERATIONS";
  return "VERIFIER";
}

function adminCapabilityBlockCode_(capability) {
  var map = {
    CAN_PREVIEW_APPLICANT_COMMUNICATION: "APPLICANT_COMMUNICATION_PREVIEW_CAPABILITY_REQUIRED",
    CAN_SEND_INDIVIDUAL_EMAIL: "INDIVIDUAL_EMAIL_CAPABILITY_REQUIRED",
    CAN_SEND_INDIVIDUAL_WHATSAPP: "INDIVIDUAL_WHATSAPP_CAPABILITY_REQUIRED",
    CAN_INSERT_PORTAL_LINK: "PORTAL_LINK_CAPABILITY_REQUIRED",
    CAN_GENERATE_STANDARD_QUOTE: "STANDARD_QUOTE_CAPABILITY_REQUIRED",
    CAN_GENERATE_STANDARD_INVOICE: "STANDARD_INVOICE_CAPABILITY_REQUIRED",
    CAN_VERIFY_PAYMENT: "PAYMENT_VERIFICATION_CAPABILITY_REQUIRED",
    CAN_RUN_BATCH_COMMUNICATIONS: "BATCH_COMMUNICATION_CAPABILITY_REQUIRED",
    CAN_OVERRIDE_COOLDOWN: "COOLDOWN_OVERRIDE_CAPABILITY_REQUIRED",
    CAN_APPROVE_FINANCIAL_OVERRIDE: "FINANCIAL_OVERRIDE_CAPABILITY_REQUIRED",
    CAN_MANAGE_PORTAL_ACCESS: "PORTAL_ACCESS_CAPABILITY_REQUIRED",
    CAN_MANAGE_ROLES: "ROLE_MANAGEMENT_CAPABILITY_REQUIRED",
    CAN_ADMINISTER_RUNTIME: "RUNTIME_ADMIN_CAPABILITY_REQUIRED",
    CAN_DEPLOY_RUNTIME: "RUNTIME_DEPLOY_CAPABILITY_REQUIRED",
    CAN_WRITE_ZOHO_BOOKS: "ZOHO_BOOKS_WRITE_CAPABILITY_REQUIRED"
  };
  return map[String(capability || "").trim()] || "ROLE_BLOCKED";
}

function adminCapabilityBlockReason_(capability) {
  var map = {
    CAN_PREVIEW_APPLICANT_COMMUNICATION: "Applicant communication preview capability is required.",
    CAN_SEND_INDIVIDUAL_EMAIL: "Individual applicant email capability is required before send.",
    CAN_SEND_INDIVIDUAL_WHATSAPP: "Individual applicant WhatsApp capability is required before send.",
    CAN_INSERT_PORTAL_LINK: "Portal-link insertion capability is required.",
    CAN_GENERATE_STANDARD_QUOTE: "Standard quote capability is required.",
    CAN_GENERATE_STANDARD_INVOICE: "Standard invoice capability is required.",
    CAN_VERIFY_PAYMENT: "Payment verification capability is required.",
    CAN_RUN_BATCH_COMMUNICATIONS: "Batch communication capability is required.",
    CAN_OVERRIDE_COOLDOWN: "Cooldown override capability is required.",
    CAN_APPROVE_FINANCIAL_OVERRIDE: "Financial override capability is required.",
    CAN_MANAGE_PORTAL_ACCESS: "Portal access management capability is required.",
    CAN_MANAGE_ROLES: "Role management capability is required.",
    CAN_ADMINISTER_RUNTIME: "Runtime administration capability is required.",
    CAN_DEPLOY_RUNTIME: "Runtime deployment capability is required.",
    CAN_WRITE_ZOHO_BOOKS: "Zoho Books write capability is required."
  };
  return map[String(capability || "").trim()] || "Your role is not allowed to perform this action.";
}

function resolveAdminCapabilities_(actor) {
  var input = actor && typeof actor === "object" ? actor : { email: actor };
  var email = normalizeAdminEmail_(input.email || input.actorEmail || "");
  var allowlisted = isAdmin_(email);
  var configuredRole = String(input.role || input.actorRole || (email ? getAdminRole_(email) : "") || "").toUpperCase();
  if (configuredRole !== "SUPER" && configuredRole !== "OPERATIONS" && configuredRole !== "VERIFIER") {
    configuredRole = allowlisted ? getAdminRole_(email) : "";
  }
  var normalizedRole = allowlisted ? (configuredRole || "VERIFIER") : "";
  var capabilities = adminCapabilityRoleDefaults_(normalizedRole);
  var evidence = {};
  adminCapabilityCatalog_().forEach(function (key) {
    evidence[key] = capabilities[key] === true ? ("role:" + normalizedRole) : "not_assigned";
  });
  if (capabilities.CAN_WRITE_ZOHO_BOOKS !== true && email && typeof getZohoBooksWriteAdminEmails_ === "function") {
    if (getZohoBooksWriteAdminEmails_().indexOf(email) >= 0) {
      capabilities.CAN_WRITE_ZOHO_BOOKS = true;
      evidence.CAN_WRITE_ZOHO_BOOKS = "script_property:ZOHO_BOOKS_WRITE_ADMINS";
    }
  }
  if (!allowlisted) {
    adminCapabilityCatalog_().forEach(function (key) {
      capabilities[key] = false;
      evidence[key] = "not_allowlisted";
    });
  }
  return {
    email: email,
    allowlisted: allowlisted === true,
    normalizedRole: normalizedRole || "",
    configuredRole: normalizedRole || "",
    isSuperAdmin: normalizedRole === "SUPER",
    capabilitySource: "CONFIG.ADMIN_ROLES",
    capabilities: capabilities,
    capabilityEvidence: evidence
  };
}

function adminHasCapability_(actor, capability) {
  var resolved = resolveAdminCapabilities_(actor);
  return !!(resolved && resolved.capabilities && resolved.capabilities[String(capability || "").trim()] === true);
}

function requireAdminCapability_(actor, capability, reason) {
  if (adminHasCapability_(actor, capability)) return;
  throw new Error(String(reason || ("Access denied: " + adminCapabilityBlockReason_(capability))));
}

function requireSuperAdmin_(email) {
  if (getAdminRole_(email) !== "SUPER") {
    throw new Error("Access denied: SUPER admin required");
  }
}

function isOperationsAdmin_(email) {
  return adminHasCapability_(email, "CAN_RUN_BATCH_COMMUNICATIONS");
}

function requireOperationsAdmin_(email) {
  if (!isOperationsAdmin_(email)) {
    throw new Error("Access denied: Operations Admin required");
  }
}

function isDocumentVerifier_(email) {
  return adminHasCapability_(email, "CAN_SAVE_DOCUMENT_STATUSES");
}

function requireDocumentVerifier_(email) {
  if (!isDocumentVerifier_(email)) {
    throw new Error("Access denied: document verifier required");
  }
}
