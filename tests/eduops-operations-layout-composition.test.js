const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("EduOps.html");
const styles = read("EduOps_OperationsWorkspaceStyles.html");
const client = read("EduOps_Client.html") + read("EduOps_ClientCore.html") + read("EduOps_ClientComponents.html");

function testNamedRegionsAndTokens() {
  ["status", "navigation", "queue-controls", "work-session", "filters", "worklist"].forEach((region) => {
    assert.match(html, new RegExp(`data-eduops-layout-region="${region}"`), `${region} must have an explicit active layout region`);
  });
  assert.match(styles, /grid-template-areas:\s*"work-session queue"/, "the active workspace must use named grid areas");
  assert.match(styles, /grid-template-areas:\s*\n\s*"queue-controls"\s*\n\s*"worklist"/, "queue controls and worklist must have independently movable named areas");
  ["--eduops-ops-region-gap", "--eduops-ops-work-session-width", "--eduops-ops-queue-toolbar-height", "--eduops-ops-control-height", "--eduops-ops-row-min-height", "--eduops-ops-font-body", "--eduops-ops-font-meta"].forEach((token) => {
    assert.match(styles, new RegExp(`${token}:`), `${token} must be centralised in the Operations Workspace composition layer`);
  });
}

function testRepositioningPreservesControlsAndBindings() {
  ["eduopsOperationsToolbarState", "eduopsOperationsToolbarPackage", "eduopsStartSession", "eduopsSearch", "eduopsWorklistRows"].forEach((id) => {
    assert.match(html, new RegExp(`id="${id}"`), `${id} must remain stable when regions are rearranged`);
  });
  assert.match(client, /eduopsStartSession/, "work-session event binding must remain independent of region placement");
  assert.match(client, /eduopsSearch/, "filter event binding must remain independent of region placement");
  assert.match(client, /eduopsWorklistRows/, "authoritative worklist binding must remain independent of region placement");
  assert.doesNotMatch(styles, /addEventListener|google\.script\.run|admin_/, "composition CSS must not acquire authority or RPC behaviour");
}

[testNamedRegionsAndTokens, testRepositioningPreservesControlsAndBindings].forEach((test) => test());
console.log("eduops-operations-layout-composition: PASS");
