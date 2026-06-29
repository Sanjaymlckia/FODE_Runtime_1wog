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
