const assert = require("node:assert/strict");
const fs = require("node:fs");

const adminSource = fs.readFileSync("Admin.js", "utf8");
const adminUi = fs.readFileSync("AdminUI.html", "utf8");

function extractFunction(source, name) {
  const signature = `function ${name}`;
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `Function ${name} must exist`);
  const braceStart = source.indexOf("{", start);
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}

const shell = extractFunction(adminSource, "buildCommunicationsActivityShell_");
const dashboard = extractFunction(adminSource, "buildOperationalDashboardMetrics_");
const renderTraffic = extractFunction(adminUi, "renderActionabilityResponseTraffic_");

assert.match(shell, /sourceType:\s*"communications_ledger_latest_row_state"/, "Communications metrics must expose one ledger authority source");
assert.match(shell, /authorityName:\s*"Communications Ledger"/, "Communications Activity must name the ledger authority");
assert.match(shell, /lifetimePolicy:\s*"Latest-row proxy;/, "Lifetime metric limitation must be explicit");
assert.match(shell, /metricAuthority:\s*\{[\s\S]*today:[\s\S]*monthToDate:[\s\S]*cumulative:/, "Each displayed communications metric must map to one authority");
assert.match(dashboard, /communicationsActivity:\s*buildCommunicationsActivityShell_\(\)/, "Dashboard metrics must initialize communications metrics from the shared ledger shell");
assert.match(dashboard, /out\.emailResponseTraffic = out\.communicationsActivity/, "Legacy response traffic alias must point to the same communications ledger DTO");
assert.doesNotMatch(dashboard, /GmailApp\.search|MailApp\.|Gmail\.Users/, "Communications Activity must not derive metrics directly from Gmail");
assert.match(renderTraffic, /authorityDetail/, "Communications Activity UI must expose authority detail");
assert.match(renderTraffic, /lifetimePolicy/, "Communications Activity UI must expose lifetime counter limitations");
assert.match(renderTraffic, /Latest SENT Applicants/, "Latest-row SENT snapshot must be named without historical-send semantics");
assert.doesNotMatch(renderTraffic, /Cumulative Emails Sent|Lifetime|Emails Ever Sent/, "Snapshot metrics must not imply historical accounting");

console.log("PASS Communications Activity metrics use one explicit ledger authority");
