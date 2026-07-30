const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

const styles = read("EduOps_Styles.html");
const operationsStyles = read("EduOps_OperationsWorkspaceStyles.html");
const components = read("EduOps_ClientComponents.html");
const operationsClient = read("EduOps_ClientOperationsWorkspace.html");
const workbench = read("EduOps_ClientWorkbench.html");
const clientBundle = [components, operationsClient, workbench].join("\n");

for (const file of ["EduOps_ClientComponents.html", "EduOps_ClientOperationsWorkspace.html", "EduOps_ClientWorkbench.html"]) {
  const script = read(file).replace(/^<script>\s*/, "").replace(/\s*<\/script>\s*$/, "");
  assert.doesNotThrow(() => new vm.Script(script, { filename: file }), `${file} must parse after R391D/E class-hook changes`);
}

assert.match(styles, /R391D\/E client readability layer/, "shared EduOps stylesheet must expose the R391D/E display-only layer");
assert.match(operationsStyles, /R391D\/E scan-density layer/, "Operations Workspace stylesheet must expose the R391D/E display-only layer");
assert.match(styles, /--eduops-r391de-row-min:\s*40px/, "workload row density must be tokenised");
assert.match(styles, /\.eduops-filter-toolbar \.eduops-search input[\s\S]*font-size:\s*15px/, "scoped workload search must retain the accepted 15px readable baseline");
assert.match(styles, /\.eduops-workbench-tabs button[\s\S]*min-height:\s*34px/, "Workbench tabs must have compact but stable hit targets");
assert.match(styles, /\.eduops-document-preview[\s\S]*min-height:\s*clamp\(260px,\s*38vh,\s*430px\)/, "document preview must use a bounded responsive height instead of a fixed tall block");
assert.match(styles, /\.eduops-communication-form[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/, "communication form must have a compact two-column desktop rhythm");
assert.match(styles, /\.eduops-finance-workbench-grid \.eduops-definition-list[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/, "Workbench Finance facts must scan in two columns on desktop");
assert.match(styles, /\.eduops-history-card \.eduops-audit-list[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/, "communication history must use compact receipt columns where width permits");
assert.match(operationsStyles, /\.eduops-operations-package-panel-control button:focus-visible/, "package controls must keep visible keyboard focus");
assert.match(operationsStyles, /\.eduops-operations-workspace[\s\S]*max-height:\s*82px/, "Operations ribbon must consume materially less vertical space");

assert.match(workbench, /eduops-document-command-actions[\s\S]*data-preview-command="DOCUMENT_REVIEW"/, "document action grouping must remain adjacent to governed document preview commands");
assert.match(workbench, /eduops-communications-workbench-grid/, "communication panel must expose the R391D/E readability hook");
assert.match(workbench, /actionDecision\("SEND_INDIVIDUAL_COMMUNICATION"\)/, "communication controls must preserve server action decision use");
assert.match(workbench, /eduops-finance-workbench-grid/, "Finance panel must expose the R391D/E readability hook");
assert.match(workbench, /actionDecision\("FINANCE_EVIDENCE_DECISION"\)/, "Finance controls must preserve backend-authored decision use");
assert.match(workbench, /commandEnabled\("DOCUMENT_REVIEW"[\s\S]*commandEnabled\("CONTACTABILITY_CORRECTION"/, "Workbench controls must continue to consume backend operation authority");
assert.match(workbench, /data-history-generation[\s\S]*data-history-applicant-id[\s\S]*data-history-row-number[\s\S]*data-history-snapshot-id/, "Audit/history loaders must bind to the exact Workbench applicant, generation, row and snapshot identity");
assert.match(workbench, /STALE_WORKBENCH_HISTORY_RESPONSE/, "Stale history terminal responses must clear the loader with a visible stale-state message");
assert.match(workbench, /EDUOPS_HISTORY_TIMEOUT_MS[\s\S]*HISTORY_RPC_TIMEOUT/, "A never-settled history RPC must terminate in a visible timeout state");
assert.match(workbench, /function historyEmptyHtml[\s\S]*No communication receipts returned[\s\S]*No operation receipts returned/, "Empty Audit and Communication history must render explicit empty states");
assert.match(workbench, /function historyErrorHtml[\s\S]*HISTORY_RPC_FAILED/, "History RPC failures must render visible errors instead of leaving loading text");
assert.match(workbench, /data-communication-receipt-outcome[\s\S]*Communication was not sent[\s\S]*Block code[\s\S]*Operation ID[\s\S]*Preview ID[\s\S]*Receipt ID/, "Blocked communication receipts must remain visibly diagnostic after authoritative refresh");
assert.match(components, /Package actions[\s\S]*Current summary[\s\S]*Open workspace packages/, "package panel controls must remain honest actions");
assert.doesNotMatch(clientBundle, />Hidden<\/button>|>Expanded<\/button>|>Compact<\/button>/, "removed fake package modes must not return");
assert.doesNotMatch(clientBundle, /GmailApp|MailApp|sendEmail\s*\(/, "client-side density work must not introduce send bypasses");

console.log("PASS R391D/E density, readability, focus, and display-only authority contracts");
