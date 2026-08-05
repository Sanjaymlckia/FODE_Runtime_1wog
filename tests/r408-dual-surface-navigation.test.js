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

function tagForAfter(source, marker, label) {
  const markerIndex = source.indexOf(marker);
  assert.ok(markerIndex >= 0, `${marker} must exist`);
  const endMarker = `>${label}</a>`;
  const end = source.indexOf(endMarker, markerIndex);
  const start = end < 0 ? -1 : source.lastIndexOf("<a", end);
  assert.ok(start >= markerIndex && end >= start, `${label} link must exist after ${marker}`);
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

const adminToEduOpsLink = tagForAfter(adminUi, '<div class="diagLinks">', "EduOps workspace");
const adminToOperationsLink = tagForAfter(adminUi, '<div class="diagLinks">', "Operations workspace");
const eduOpsToAdminLink = tagFor(eduOps, "Admin workspace");
const eduOpsToOperationsLink = tagFor(eduOps, "Operations workspace");
const operationsToAdminLink = tagForAfter(adminUi, 'class="opsSurfaceNav"', "Admin workspace");
const operationsToEduOpsLink = tagForAfter(adminUi, 'class="opsSurfaceNav"', "EduOps workspace");

assert.match(adminUi, /WEBAPP_URL_ADMIN[^\n]+\?view=eduops[^\n]+EduOps workspace/, "Admin must expose the canonical EduOps workspace route");
assert.match(eduOps, /class="eduops-admin-workspace-link"[^>]+href="<\?= ADMIN_URL \?>\?view=admin"[^>]+target="_top"[^>]*>Admin workspace<\/a>/, "EduOps must expose the Admin specialist workspace route outside the Apps Script iframe");
assert.match(adminUi, /WEBAPP_URL_ADMIN[^\n]+\?view=ops[^\n]+Operations workspace/, "Admin must expose the authenticated Operations workspace route");
assert.match(eduOps, /href="<\?= ADMIN_URL \?>\?view=ops"[^>]+target="_top"[^>]*>Operations workspace<\/a>/, "EduOps must expose the authenticated Operations workspace route");
assert.match(adminUi, /class="opsSurfaceNav"[\s\S]*?\?view=admin" target="_top">Admin workspace<\/a>[\s\S]*?\?view=eduops" target="_top">EduOps workspace<\/a>/, "Operations must expose explicit navigation back to Admin and EduOps");
assert.match(eduOpsWorkload, /t\.ADMIN_URL = clean_\(CONFIG\.WEBAPP_URL_ADMIN \|\| CONFIG\.WEBAPP_URL \|\| ""\);/, "EduOps Admin navigation must come from canonical server configuration");
assert.match(code, /if \(route === "eduops"\) return renderEduOpsApp_;/, "EduOps route must remain server-routed");
assert.match(code, /if \(route === "admin"\) return renderAdminApp_;/, "Admin route must remain server-routed");
assert.match(code, /if \(route === "ops"\) return renderAdminApp_;/, "Operations route must remain server-routed through the authenticated Admin renderer");
assert.match(adminUi, /@media \(max-width:680px\)[\s\S]*?\.topbar\{ align-items:stretch; flex-direction:column; \}[\s\S]*?\.topbar > \.sub\{ width:100%; min-width:0; overflow-wrap:anywhere; \}/, "Admin navigation header must shed intrinsic URL width at narrow viewports");
assert.match(adminUi, /\.queue-section-body\{ max-width:100%; min-width:0; overflow-x:auto; overflow-y:hidden; box-sizing:border-box; \}/, "Loaded Admin queues must contain intrinsic table width inside the queue body");
assert.match(adminUi, /\.queue-section\{[\s\S]*?max-width:100%; min-width:0; overflow:hidden; box-sizing:border-box;/, "Loaded Admin queue sections must contain overflowing queue bodies");
assert.match(eduOpsStyles, /@media \(max-width: 560px\)[\s\S]*?\.eduops-workspace-links \{ grid-column: 1; grid-row: 2; display:grid; grid-template-columns:repeat\(2,minmax\(0,1fr\)\); \}/, "EduOps working-surface links must stack into a bounded mobile row");
assert.match(eduOpsStyles, /\.eduops-global-search-strip \{[\s\S]*?z-index: 45;/, "EduOps loaded topbar overflow must not cover the working-surface links");
assert.match(adminUi, /@media \(max-width: 680px\)[\s\S]*?\.opsNav\{ flex-direction:row;[\s\S]*?overflow-x:auto;[\s\S]*?\.opsMain\{ height:auto; min-height:100vh; overflow:visible; padding:12px; \}/, "Operations mobile navigation must expose the working surface without a full-height sidebar gate");
assert.match(adminUi, /@media \(max-width: 680px\)[\s\S]*?\.opsSectionGrid\{ grid-template-columns:1fr !important; \}/, "Loaded Operations section grids must collapse below the mobile breakpoint");
assert.match(adminUi, /@media \(max-width: 680px\)[\s\S]*?\.opsWorkspaceSwitch\{ grid-template-columns:minmax\(0,1fr\) !important; \}/, "Loaded Operations workspace cards must collapse below the mobile breakpoint");
assert.match(adminUi, /\.opsWorkspaceCard,\.opsWorkspaceInfo,\.opsSectionPage,\.opsCard\{ min-width:0; max-width:100%; box-sizing:border-box; \}/, "Loaded Operations cards must shed intrinsic width on mobile");
assert.match(adminUi, /@media \(max-width: 680px\)[\s\S]*?\.opsInfoGrid\{ grid-template-columns:repeat\(2,minmax\(0,1fr\)\); min-width:0; max-width:100%; \}/, "Loaded Operations info cards must contain long applicant identity values on mobile");
assert.match(adminUi, /@media \(max-width: 680px\)[\s\S]*?\.opsKpiCard\{ min-width:0; max-width:100%; overflow:hidden; grid-template-columns:40px minmax\(0,1fr\);/, "Loaded Operations KPI cards must shed intrinsic value width on mobile");
assert.match(adminUi, /@media \(max-width: 680px\)[\s\S]*?\.opsHeaderTools\{ width:100%; min-width:0; flex-wrap:wrap;/, "Loaded Operations header tools must wrap within the mobile header");
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

for (const [label, source, tag, href] of [
  ["Admin to Operations", adminUi, adminToOperationsLink, "https://script.google.com/macros/s/admin/exec?view=ops"],
  ["EduOps to Operations", eduOps, eduOpsToOperationsLink, "https://script.google.com/macros/s/admin/exec?view=ops"]
  ,["Operations to Admin", adminUi, operationsToAdminLink, "https://script.google.com/macros/s/admin/exec?view=admin"]
  ,["Operations to EduOps", adminUi, operationsToEduOpsLink, "https://script.google.com/macros/s/admin/exec?view=eduops"]
]) {
  assert.deepEqual(simulateSandboxedAppsScriptClick(source, tag, href), {
    target: "_top",
    topUrl: href,
    iframeUrl: "https://script.googleusercontent.com/userCodeAppPanel"
  }, `${label} must escape the sandboxed Apps Script iframe`);
}

console.log("PASS R408 Admin/EduOps dual working-surface navigation and mobile route contract");
