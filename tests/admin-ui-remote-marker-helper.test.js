const fs = require("node:fs");
const assert = require("node:assert/strict");

const helper = fs.readFileSync("tools/fode-admin-ui-remote-markers.ps1", "utf8");
const releaseHelper = fs.readFileSync("tools/fode-admin-ui-release.ps1", "utf8");

assert.match(helper, /function Get-RemoteSourceFiles/, "Remote marker helper must enumerate pulled source files");
assert.match(helper, /function Find-MarkerInRemoteSource/, "Remote marker helper must search each pulled source file");
assert.match(helper, /\$sourceFiles = Get-RemoteSourceFiles/, "Marker proof must use the remote source file set");
assert.doesNotMatch(helper, /\$adminUi\.Contains\(\$marker\)/, "Marker proof must not be limited to AdminUI.html");
assert.match(helper, /File = \$match\.File/, "Marker proof must report the matching source file");
assert.match(helper, /-SkipPull/, "Marker helper must support read-only validation against existing proof folders");
assert.match(helper, /IsPathRooted\(\$RemoteCheckRoot\)/, "Relative proof folders must be resolved explicitly");
assert.match(helper, /Join-Path \$repo \$RemoteCheckRoot/, "Relative proof folders must resolve against repo root");
assert.match(releaseHelper, /\$remoteProofRoot = Join-Path/, "Release helper must allocate a concrete proof folder");
assert.match(releaseHelper, /-RemoteCheckRoot \$remoteProofRoot/, "Release helper must pass the proof folder to marker helper");
assert.match(releaseHelper, /remote marker proof dry run/, "DryRun must execute the read-only remote marker proof");
assert.match(releaseHelper, /function Get-RemoteMarkerProofArgs/, "Release helper must build marker proof arguments explicitly");
assert.match(releaseHelper, /foreach \(\$marker in @\(\$PresentMarkers\)\)/, "Release helper must pass multiple present markers as separate arguments");
assert.match(releaseHelper, /foreach \(\$marker in @\(\$MissingMarkers\)\)/, "Release helper must pass multiple absent markers as separate arguments");
assert.match(releaseHelper, /@remoteMarkerProofArgs/, "Release helper must splat the marker proof argument vector");

console.log("PASS admin UI remote marker helper contract");
