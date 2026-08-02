const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const repo = path.resolve(__dirname, "../..");
const context = JSON.parse(fs.readFileSync(path.join(repo, "runtime-context.json"), "utf8"));
const project = context.projects.FODE;
const fode = fs.readFileSync(path.join(repo, "tools", "fode.ps1"), "utf8");
const sessionTool = fs.readFileSync(path.join(repo, "tools", "governance", "Fode-GovernedSession.ps1"), "utf8");
const remoteVerifier = fs.readFileSync(path.join(repo, "tools", "verify-remote-config-before-version.ps1"), "utf8");

assert.equal(path.normalize(project.repository.path), path.normalize(repo), "runtime context must retain the C: repository authority");
assert.equal(project.featureFlags.runtimeMutationAllowedByDefault, false);
assert.equal(project.featureFlags.sheetMutationAllowedByDefault, false);
assert.equal(project.featureFlags.driveMutationAllowedByDefault, false);
assert.equal(project.featureFlags.productionMutationAllowedByDefault, false);

assert.match(fode, /ValidateSet\('continue', 'doctor', 'close'\)/, "canonical entrypoint must expose continue, doctor and close");
assert.match(fode, /Assert-ApprovedStorage/, "canonical entrypoint must validate storage placement");
assert.match(fode, /capabilityProfiles/, "canonical entrypoint must use context capability profiles");
assert.match(fode, /ClearPendingAcceptance/, "close must clear completed acceptance explicitly");
assert.match(fode, /OwnerLease/, "close must preserve governed ownership");
assert.match(fode, /checkpointBoundary/, "risk profiles must expose one authority boundary");
assert.match(fode, /live-whoami/, "staging-release doctor must prove live whoami read-only");
assert.match(sessionTool, /AcceptBaselineAdvance/, "authorized release closure must record baseline advancement explicitly");
assert.match(remoteVerifier, /File\]::ReadAllText/, "remote source verification must read UTF-8 bytes correctly on Windows PowerShell");

assert.equal(project.capabilityProfiles["code-only"].drRequired, false, "code-only work must not inherit the full DR gate");
assert.equal(project.capabilityProfiles.production.drRequired, true, "production work must require DR capability");
assert.equal(project.capabilityProfiles["database-migration"].drRequired, true, "database migration must require DR capability");
assert.match(project.governance.proportionateDrRule, /Code-only staging releases do not require/);
assert.equal(project.governance.toolchainRoot, "D:\\FODE_Tooling");
assert.equal(project.governance.toolchain.loopbackOnly, true);
assert.equal(project.governance.toolchain.mariadb.status, "installed-local-loopback-fixture-verified");
assert.equal(project.governance.toolchain.mariadb.automaticStartup, false);
assert.equal(project.governance.toolchain.mariadb.windowsService, false);

const activePathFiles = [
  "tools/fode.ps1",
  "tools/README.md",
  "prototypes/operator-next/capture-prototype.js",
  "prototypes/operator-next/capture-runtime-surface.js"
];
for (const relative of activePathFiles) {
  const text = fs.readFileSync(path.join(repo, relative), "utf8");
  assert.ok(!text.includes("F:/Playwright") && !text.includes("F:\\Playwright"), `${relative} must not use obsolete F: Playwright authority`);
}

const readiness = fs.readFileSync(path.join(repo, "docs/governance/FODE_LOCAL_TOOLCHAIN_AND_DR_READINESS.md"), "utf8");
assert.match(readiness, /not an R401 release blocker/);
assert.match(readiness, /mandatory release gate only for database\/schema migrations/);

console.log("PASS FODE convenience-first governance contracts: central entrypoint, proportionate gates, storage authority, baseline audit and UTF-8 remote proof");
