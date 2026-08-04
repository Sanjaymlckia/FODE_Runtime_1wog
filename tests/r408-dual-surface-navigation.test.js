const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const adminUi = read("AdminUI.html");
const eduOps = read("EduOps.html");
const eduOpsStyles = read("EduOps_Styles.html");
const eduOpsWorkload = read("EduOps_Workload.js");
const code = read("Code.js");

function tagFor(source, label) {
  const endMarker = `>${label}</a>`;
  const end = source.indexOf(endMarker);
  const start = end < 0 ? -1 : source.lastIndexOf("<a", end);
  assert.ok(start >= 0 && end >= start, `${label} link must exist`);
  return source.slice(start, end + endMarker.length);
}

function attribute(tag, name) {
  const match = tag.match(new RegExp(`\\b${name}="([^"]*)"`, "i"));
  return match ? match[1] : "";
}

function effectiveNavigationTarget(source, tag) {
  const explicitTarget = attribute(tag, "target");
  if (explicitTarget) return explicitTarget.toLowerCase();
  const base = source.match(/<base\b[^>]*\btarget="([^"]+)"[^>]*>/i);
  return base ? base[1].toLowerCase() : "_self";
}

function simulateSandboxedAppsScriptClick(source, tag, renderedHref) {
  const target = effectiveNavigationTarget(source, tag);
  const initialTopUrl = "https://script.google.com/macros/s/admin/exec";
  const initialIframeUrl = "https://script.googleusercontent.com/userCodeAppPanel";
  return target === "_top"
    ? { target, topUrl: renderedHref, iframeUrl: initialIframeUrl }
    : { target, topUrl: initialTopUrl, iframeUrl: renderedHref };
}

const adminToEduOpsLink = tagFor(adminUi, "EduOps workspace");
const eduOpsToAdminLink = tagFor(eduOps, "Admin workspace");

assert.match(adminUi, /WEBAPP_URL_ADMIN[^\n]+\?view=eduops[^\n]+EduOps workspace/, "Admin must expose the canonical EduOps workspace route");
assert.match(eduOps, /class="eduops-admin-workspace-link"[^>]+href="<\?= ADMIN_URL \?>\?view=admin"[^>]+target="_top"[^>]*>Admin workspace<\/a>/, "EduOps must expose the Admin specialist workspace route outside the Apps Script iframe");
assert.match(eduOpsWorkload, /t\.ADMIN_URL = clean_\(CONFIG\.WEBAPP_URL_ADMIN \|\| CONFIG\.WEBAPP_URL \|\| ""\);/, "EduOps Admin navigation must come from canonical server configuration");
assert.match(code, /if \(route === "eduops"\) return renderEduOpsApp_;/, "EduOps route must remain server-routed");
assert.match(code, /if \(route === "admin"\) return renderAdminApp_;/, "Admin route must remain server-routed");
assert.match(eduOpsStyles, /@media \(max-width: 900px\)[\s\S]*?\.eduops-global-search-strip \.eduops-global-search \{ grid-template-columns: minmax\(0, 1fr\) auto; \}/, "The dual-surface link must retain a bounded 390px layout");
assert.doesNotMatch(adminUi + eduOps, /FODE-26-003241[^\n]+href=|href=[^\n]+FODE-26-003241/, "Cross-surface navigation must not transport or substitute an applicant identity");
assert.doesNotMatch(adminUi + eduOps, /google\.script\.run[^\n]+(?:send|prepare|reconcile)/i, "Navigation links must not invoke communication or mutation RPCs");

const adminToEduOps = simulateSandboxedAppsScriptClick(adminUi, adminToEduOpsLink, "https://script.google.com/macros/s/admin/exec?view=eduops");
assert.deepEqual(adminToEduOps, {
  target: "_top",
  topUrl: "https://script.google.com/macros/s/admin/exec?view=eduops",
  iframeUrl: "https://script.googleusercontent.com/userCodeAppPanel"
}, "Admin to EduOps must escape the sandboxed Apps Script iframe through the document base target");

const eduOpsToAdmin = simulateSandboxedAppsScriptClick(eduOps, eduOpsToAdminLink, "https://script.google.com/macros/s/admin/exec?view=admin");
assert.deepEqual(eduOpsToAdmin, {
  target: "_top",
  topUrl: "https://script.google.com/macros/s/admin/exec?view=admin",
  iframeUrl: "https://script.googleusercontent.com/userCodeAppPanel"
}, "EduOps to Admin must escape the sandboxed Apps Script iframe through its explicit target");

console.log("PASS R408 Admin/EduOps dual working-surface navigation and mobile route contract");
