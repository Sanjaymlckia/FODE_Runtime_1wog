const fs = require("node:fs");
const assert = require("node:assert/strict");

const code = fs.readFileSync("Code.js", "utf8");
const admin = fs.readFileSync("Admin.js", "utf8");
const ui = fs.readFileSync("AdminUI.html", "utf8");

function sliceBetween(source, startNeedle, endNeedle) {
  const start = source.indexOf(startNeedle);
  assert.notEqual(start, -1, `Missing ${startNeedle}`);
  const end = source.indexOf(endNeedle, start + startNeedle.length);
  assert.notEqual(end, -1, `Missing ${endNeedle}`);
  return source.slice(start, end);
}

const route = sliceBetween(code, "function resolveDoGetHandler_", "function renderPortalAppFromDoGet_");
const renderer = sliceBetween(admin, "function renderAdminApp_", "// Access control helpers");
const detail = sliceBetween(admin, "function admin_getApplicantDetail", "function safeJson_");
const v2 = sliceBetween(ui, "var reviewWorkspaceV2State", "function openModalLoading_");

assert.match(route, /route === "admin"\) return renderAdminApp_;/, "Admin entry must resolve to the Admin renderer");
assert.match(renderer, /createTemplateFromFile\("AdminUI"\)/, "Admin renderer must serve AdminUI");
assert.match(ui, /admin_getApplicantDetail_json\(detailPayload\)/, "Admin review must use the established detail RPC");
assert.match(detail, /actionabilityDecision\s*=\s*\{/, "Detail response must carry an explicit actionability decision");
assert.match(detail, /routeBinding\s*=\s*\{[\s\S]*ADMIN_APPLICANT_REVIEW_ROUTE_R411/, "Detail response must identify the R411 Admin route contract");
assert.match(v2, /detail\.actionabilityDecision/, "Review V2 must consume the explicit decision");
assert.doesNotMatch(v2, /_authorityProjection/, "Review V2 must reject the old compatibility projection");
assert.match(v2, /Authoritative actionability decision was not returned/, "Missing actionability must fail closed");
assert.match(v2, /admin_getApplicantDocumentManifest/, "Review V2 documents must call the established manifest handler");
assert.match(v2, /All required document positions are shown together/, "Review V2 must show the complete gallery together");
assert.doesNotMatch(v2, /Open legacy document controls|legacy gallery\/fallback/, "Review V2 must not send documents through the legacy fallback");

console.log("PASS R411 Admin route binding contract");
