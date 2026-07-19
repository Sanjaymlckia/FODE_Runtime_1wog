const assert = require("node:assert/strict");
const fs = require("node:fs");

const html = fs.readFileSync("EduOps.html", "utf8");
const components = fs.readFileSync("EduOps_ClientComponents.html", "utf8");
const workload = fs.readFileSync("EduOps_Workload.js", "utf8");

assert.match(html, /id="eduopsOperationalClassification"/, "top identity renders the operational classification field");
assert.match(html, /id="eduopsRuntimeIdentity"/, "top identity renders the runtime identity field");
assert.match(html, /id="eduopsAppsScriptIdentity"/, "top identity renders Apps Script metadata or reason");
assert.match(html, /id="eduopsReleaseSnapshotIdentity"/, "top identity renders the snapshot identity field");
assert.match(html, /id="eduopsReleaseSnapshotTime"/, "top identity renders the snapshot timestamp field");
assert.doesNotMatch(html, /Admin staging|unknown Apps Script version from deployment metadata/i, "top identity HTML has no staging or unknown-version fallback");
assert.doesNotMatch(html, /@[0-9]{3}|r36[0-9]/, "top identity HTML does not hard-code live release versions");

assert.match(workload, /schemaVersion:\s*"EDUOPS_RUNTIME_IDENTITY_V1"[\s\S]*operationalClassification:[\s\S]*deploymentRole:[\s\S]*runtimeIdentity:[\s\S]*appsScriptVersion:[\s\S]*appsScriptVersionReason:[\s\S]*snapshotId:[\s\S]*snapshotAsOf:[\s\S]*dataAuthority:/, "server runtime DTO includes complete identity and snapshot projection");
assert.match(components, /runtime\.snapshotId\s*\|\|\s*response\.snapshotId/, "renderer preserves server runtime snapshot ID with response fallback");
assert.match(components, /runtime\.snapshotAsOf\s*\|\|\s*response\.snapshotAsOf/, "renderer preserves server runtime snapshot timestamp with response fallback");
assert.match(components, /eduopsReleaseSnapshotIdentity[\s\S]*"Snapshot "\s*\+\s*snapshotId/, "top identity binds visible snapshot ID");
assert.match(components, /eduopsReleaseSnapshotTime[\s\S]*"As of "\s*\+\s*snapshotAsOf/, "top identity binds visible snapshot timestamp");
assert.match(components, /appsScriptVersionReason/, "Apps Script unavailable state renders the precise server-projected reason");
assert.doesNotMatch(components, /Admin staging|unknown Apps Script version from deployment metadata/i, "renderer has no staging or unknown-version fallback");
assert.doesNotMatch(components, /@[0-9]{3}|r36[0-9]/, "renderer does not hard-code live release versions");

console.log("PASS EduOps identity surface rendering contract: runtime, Apps Script metadata, snapshot ID and timestamp are server-bound");
