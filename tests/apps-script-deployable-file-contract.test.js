const assert = require("node:assert/strict");
const fs = require("node:fs");
const crypto = require("node:crypto");

const expected = [
  "Admin.js", "Admin_AccessControl.js", "Admin_CapabilityGrants.js", "Admin_CanonicalFinance.js", "Admin_CanonicalPopulation.js",
  "Admin_DocumentGallery.js", "Admin_DocumentServices.js", "Admin_LifecycleAuthority.js", "Admin_PaymentAuthority.js", "Admin_ReviewQueues.js",
  "Admin_ReviewStatusAuthority.js", "Admin_RowFacts.js", "Admin_SelectedApplicantCommunications.js", "Admin_StageBatchCommunications.js",
  "Admin_WhatsAppFallback.js", "AdminUI.html", "AdminUI_OperatorNext.html", "AdminUI_OpsApplicantQueue.html", "AdminUI_OpsCommunications.html",
  "AdminUI_OpsLifecycle.html", "AdminUI_SharedRowFacts.html", "Code.js", "Config.js", "Routes.js", "Utils.js", "appsscript.json", "whoami_admin.html"
].sort();
const actual = fs.readFileSync(".claspignore", "utf8").split(/\r?\n/).map((line) => line.trim()).filter((line) => /^![^*]/.test(line)).map((line) => line.slice(1).replace(/\\/g, "/")).sort();
assert.deepEqual(actual, expected, "Deployable Apps Script filename set must match the explicit 27-file contract");
assert.equal(actual.length, 27);
for (const file of actual) assert.equal(fs.existsSync(file), true, `Deployable runtime file is missing: ${file}`);
assert.ok(!actual.some((file) => /^(tests|docs|\.release-proof)\//.test(file)), "Tests, docs, and release evidence must remain excluded");
assert.ok(!actual.some((file) => /OPS\.js|OldWorkbench|OperatorDashboard/i.test(file)), "Retired standalone OPS source must not be reintroduced");
const setHash = crypto.createHash("sha256").update(actual.join("\n")).digest("hex");
assert.equal(setHash.length, 64);
const verifier = fs.readFileSync("tools/verify-remote-config-before-version.ps1", "utf8");
assert.match(verifier, /missingRemote[\s\S]*extraRemote/, "Remote verifier must compare exact missing and unexpected filename sets");
assert.match(verifier, /EXPECTED SET SHA256[\s\S]*REMOTE SET SHA256/, "Remote verifier must print normalized filename set hashes");
console.log(`PASS deployable Apps Script contract files=${actual.length} setHash=${setHash}`);
