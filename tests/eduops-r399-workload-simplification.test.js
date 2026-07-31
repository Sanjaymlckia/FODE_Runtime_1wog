const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const html = read("EduOps.html");
const components = read("EduOps_ClientComponents.html");
const workload = read("EduOps_Workload.js");
const styles = read("EduOps_OperationsWorkspaceStyles.html");

assert.match(html, /data-eduops-layout-region="status"/, "status must remain a named layout region");
assert.match(html, /data-eduops-layout-region="queue-controls"/, "queue controls must remain a named layout region");
assert.match(html, /data-eduops-layout-region="session-controls"/, "Work Session control must remain independently movable");
assert.match(html, /data-eduops-layout-region="filters"/, "filters must remain a named layout region");
assert.match(html, /data-eduops-layout-region="worklist"/, "worklist must remain a named layout region");
assert.match(html, /id="eduopsSelectionControls"[\s\S]*Selection and Batch controls/, "secondary selection controls must remain available on demand");
assert.match(styles, /--eduops-r399-control-height/, "active R399 layout tokens must be centralized");
assert.match(styles, /data-eduops-layout-region=\"queue-controls\"/, "queue placement must be declarative");
assert.match(styles, /\.eduops-operations-layout \.eduops-workspace-header,[\s\S]*\.eduops-work-scope-band \{ display: none; \}/, "duplicated workload bands must not consume the primary surface");
assert.doesNotMatch(components, /Request completed in .*server/, "request timing must remain diagnostic, not primary operator content");
assert.match(workload, /workScope: "ALL_AUTHORISED"/, "All Authorised Work remains the backend default");
assert.match(workload, /if \(query\.workScope && query\.workScope !== "ALL_AUTHORISED"/, "backend work-scope safeguards remain enforced");
assert.match(workload, /urgencyLevel/, "Escalation remains represented through urgency/status authority");

console.log("eduops-r399-workload-simplification: PASS");
