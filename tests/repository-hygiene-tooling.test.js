const assert = require("node:assert/strict");
const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const { classifyNameReference, isApprovedGeneratedPath } = require("../tools/check-repository-hygiene.js");

function read(file) {
  return fs.readFileSync(path.join(__dirname, "..", file), "utf8");
}

assert.equal(fs.existsSync(path.join(__dirname, "..", "tools", "eduops-preview")), false, "old EduOps preview directory must not remain");
assert.equal(fs.existsSync(path.join(__dirname, "..", "tools", "eduops-snapshot-capture")), true, "snapshot capture directory must use canonical name");
assert.equal(fs.existsSync(path.join(__dirname, "..", "tools", "eduops-operations-preview")), true, "operations preview directory must use canonical name");
assert.equal(fs.existsSync(path.join(__dirname, "..", "tools", "fode-h1-browser-rpc.js")), false, "legacy H1 RPC bridge must be retired");
assert.equal(fs.existsSync(path.join(__dirname, "..", "tools", "fode-playwright-auth.js")), false, "duplicate auth helper must be removed");

const auth = read("tools/auth-fode-admin-playwright.js");
assert.match(auth, /module\.exports[\s\S]*launchAdminContext[\s\S]*closeAdminContext/, "canonical auth script must export shared helpers");
assert.match(auth, /require\.main === module/, "auth script must be importable without launching a browser");
assert.doesNotMatch(auth, /client_secret|refresh_token|access_token|private key/i, "auth tooling must not embed credentials");

const snapshotCapture = read("tools/eduops-snapshot-capture/server/capture-fresh-snapshot.js");
assert.match(snapshotCapture, /--dry-run/);
assert.match(snapshotCapture, /evidence[\s\S]*generated[\s\S]*snapshots/);
assert.doesNotMatch(snapshotCapture.slice(0, 900), /require\(playwrightModule\)/, "snapshot capture must not require Playwright before help/dry-run");
const dryRun = cp.execFileSync("node", ["tools/eduops-snapshot-capture/server/capture-fresh-snapshot.js", "--dry-run"], { cwd: path.join(__dirname, ".."), encoding: "utf8" });
const dryRunJson = JSON.parse(dryRun);
assert.equal(dryRunJson.ok, true);
assert.equal(dryRunJson.readOnly, true);
assert.ok(dryRunJson.outputRoot.replace(/\\/g, "/").endsWith("tools/eduops-snapshot-capture/evidence/generated/snapshots"));

const operationsReadme = read("tools/eduops-operations-preview/README.md");
const operationsServer = read("tools/eduops-operations-preview/server/server.js");
assert.match(operationsReadme, /EduOps Operations Preview Lab/);
assert.doesNotMatch(operationsReadme, /tools[\\/]opsedu-preview|OpsEdu Cockpit/);
assert.match(operationsServer, /EduOps Operations Preview Lab/);
assert.match(operationsServer, /EDUOPS_OPERATIONS_PREVIEW_PORT/);

const ignore = read(".gitignore");
for (const rule of [
  "tools/eduops-snapshot-capture/evidence/generated/",
  "tools/eduops-operations-preview/evidence/generated/",
  "prototypes/*/evidence/generated/",
  "prototypes/*.zip",
  "**/*storageState*.json",
  "**/*auth-state*.json",
  "**/browser-profile*/"
]) {
  assert.match(ignore, new RegExp(rule.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\*/g, ".*")), `missing .gitignore rule ${rule}`);
}

assert.equal(isApprovedGeneratedPath("tools/eduops-snapshot-capture/evidence/generated/run/a.json"), true);
assert.equal(isApprovedGeneratedPath("tools/eduops-snapshot-capture/evidence/old-run/a.json"), false);
assert.equal(classifyNameReference("OpsEdu_ClientCockpit.html", "OpsEdu"), "runtime naming debt deferred to R376J");
assert.equal(classifyNameReference("tools/eduops-operations-preview/public/opsedu-preview.js", "schemaVersion: OPSEDU_TRACE_AUDIT_V1"), "approved compatibility reference");
assert.equal(classifyNameReference("docs/architecture/example.md", "operator-next"), "historical archive/reference");

const report = JSON.parse(cp.execFileSync("node", ["tools/check-repository-hygiene.js", "--json"], { cwd: path.join(__dirname, ".."), encoding: "utf8" }));
assert.equal(report.ok, true);
assert.equal(report.readOnly, true);
assert.ok(Array.isArray(report.findings.activeNameReferences));

console.log("PASS repository hygiene tooling contracts");
