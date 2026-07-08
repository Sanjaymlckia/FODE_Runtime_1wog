const fs = require("node:fs");
const assert = require("node:assert/strict");

const helper = fs.readFileSync("tools/fode-admin-ui-remote-markers.ps1", "utf8");

assert.match(helper, /function Get-RemoteSourceFiles/, "Remote marker helper must enumerate pulled source files");
assert.match(helper, /function Find-MarkerInRemoteSource/, "Remote marker helper must search each pulled source file");
assert.match(helper, /\$sourceFiles = Get-RemoteSourceFiles/, "Marker proof must use the remote source file set");
assert.doesNotMatch(helper, /\$adminUi\.Contains\(\$marker\)/, "Marker proof must not be limited to AdminUI.html");
assert.match(helper, /File = \$match\.File/, "Marker proof must report the matching source file");
assert.match(helper, /-SkipPull/, "Marker helper must support read-only validation against existing proof folders");

console.log("PASS admin UI remote marker helper contract");
