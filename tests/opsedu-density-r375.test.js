const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

function testRuntimeIdentityBump() {
  const config = read("Config.js");
  assert.match(config, /VERSION:\s*"r371"/, "Config.js must declare r371");
  assert.match(config, /DEPLOY_VERSION_NUMBER:\s*371/, "Config.js must declare build 371");
}

function testProductSurfacePreserved() {
  const html = read("EduOps.html");
  assert.match(html, /value="FODE"/, "FODE product option must remain available");
  assert.match(html, /value="KIA"/, "KIA product option must remain available");
  assert.match(html, /value="MLC"/, "MLC product option must remain available");
  assert.match(html, /opsedu-density-hidden-title/, "redundant cockpit title row must be hidden through an explicit density class");
  assert.match(html, /eduopsQueueCompactStats/, "compact queue stats must be rendered near the workload title");
}

function testDensityCssLayer() {
  const styles = read("EduOps_Styles.html") + "\n" + read("OpsEdu_CockpitStyles.html");
  assert.match(styles, /R375 100% zoom density layer/, "runtime density override must be named");
  assert.match(styles, /--eduops-density-row-min:\s*46px/, "compact applicant row minimum must be explicitly tokenised");
  assert.match(styles, /\.opsedu-density-hidden-title\s*\{\s*display:\s*none\s*!important;/, "redundant cockpit title must be display-only hidden");
  assert.match(styles, /\.eduops-template-reason/, "unavailable template reasons must have compact expandable styling");
  assert.match(styles, /\.opsedu-package-panel-control/, "package panel control must use standard density controls");
}

function testComponentCompaction() {
  const components = read("EduOps_ClientComponents.html");
  assert.match(components, /eduopsQueueCompactStats\.textContent/, "queue compact stats must update after authoritative workload selection");
  assert.match(components, /matched · /, "queue compact stats must be terse");
  assert.match(components, /<summary>▾ Details<\/summary>/, "row expansion affordance must be compact");
  assert.match(components, /title="' \+ app\.esc\(item\.packageId\)/, "technical package IDs may remain in diagnostic title only");
  assert.doesNotMatch(components, /<span>' \+ app\.esc\(item\.packageId\)/, "package card visible label must not be the routine technical package ID");
}

function testReadableDueLabels() {
  const adapter = read("EduOps_FODE_Adapter.js");
  assert.match(adapter, /Cooling off until " \+ eduopsShortDateLabel_\(row\.coolingOffUntil\)/, "cooling-off rows must render a readable expiry date");
  assert.match(adapter, /Due " \+ eduopsShortDateLabel_\(row\.nextActionDate\)/, "next-action rows must render a readable due date");
  assert(adapter.indexOf("row.nextActionDate") < adapter.indexOf('eduopsUpper_(row.urgencyLevel || "") === "DUE"'), "next-action date must take precedence over generic urgency labels");
}

function testCommunicationReasonCompaction() {
  const batch = read("EduOps_ClientBatch.html");
  const workbench = read("EduOps_ClientWorkbench.html");
  assert.match(batch, /Unavailable\. Expand authority reason\./, "batch unavailable template cards must be compact");
  assert.match(batch, /<details class="eduops-template-reason"><summary>Authority reason<\/summary>/, "batch unavailable reason must be expandable");
  assert.match(workbench, /Unavailable\. Expand authority reason\./, "individual unavailable template cards must be compact");
  assert.match(workbench, /<details class="eduops-template-reason"><summary>Authority reason<\/summary>/, "individual unavailable reason must be expandable");
  assert.doesNotMatch(batch + workbench, /GmailApp|MailApp|sendEmail\(/, "density release must not introduce direct send bypasses");
}

[
  testRuntimeIdentityBump,
  testProductSurfacePreserved,
  testDensityCssLayer,
  testComponentCompaction,
  testReadableDueLabels,
  testCommunicationReasonCompaction
].forEach((test) => test());

console.log("opsedu-density-r375: PASS");
