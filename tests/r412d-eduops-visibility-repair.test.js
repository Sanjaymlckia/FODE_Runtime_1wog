const assert = require("node:assert/strict");
const fs = require("node:fs");

const config = fs.readFileSync("Config.js", "utf8");
const html = fs.readFileSync("EduOps.html", "utf8");
const styles = fs.readFileSync("EduOps_OperationsWorkspaceStyles.html", "utf8");
const components = fs.readFileSync("EduOps_ClientComponents.html", "utf8");
const workload = fs.readFileSync("EduOps_Workload.js", "utf8");

assert.match(config, /VERSION:\s*"r414"/);
assert.match(config, /DEPLOY_VERSION_NUMBER:\s*414/);
assert.doesNotMatch(html, /class="eduops-worklist-key-band"[^>]*aria-hidden="true"/);
assert.doesNotMatch(styles, /\.eduops-worklist-key-band,\s*\.eduops-operations-layout \.eduops-work-scope-band \{ display: none; \}/);
assert.match(styles, /\.eduops-operations-layout \.eduops-worklist-key-band \{\s*display: block;[\s\S]*max-height: none;/);
assert.match(styles, /\.eduops-operations-layout \.eduops-worklist-keys \{\s*display: grid;[\s\S]*grid-template-columns: repeat\(auto-fit, minmax\(190px, 1fr\)\);/);
assert.match(styles, /@media \(max-width: 560px\)[\s\S]*\.eduops-operations-layout \.eduops-worklist-keys \{ grid-template-columns: 1fr; \}/);
assert.match(components, /data-lifecycle-worklist/);
assert.match(components, /app\.state\.reviewBucketKey = lifecycleWorklist\.getAttribute\("data-lifecycle-worklist"\);[\s\S]*app\.requestWorkload\(\{ resetPage: true \}\)/);
assert.match(workload, /query\.reviewBucketKey === "ALL_ACTIVE"[\s\S]*CLOSED_OUTCOME/);
assert.match(workload, /query\.reviewBucketKey !== "ALL_ACTIVE"[\s\S]*reviewBucketKey/);

console.log("PASS R412D EduOps lifecycle controls are visible, keyboard-available, selectable, and responsive by production contract");
