const fs = require("node:fs");
const assert = require("node:assert/strict");

const adminSource = fs.readFileSync("Admin.js", "utf8");
const reviewQueuesSource = fs.readFileSync("Admin_ReviewQueues.js", "utf8");
const adminUi = fs.readFileSync("AdminUI.html", "utf8");

function extractFunction(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Function ${name} must exist`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "\"" || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Function ${name} is not closed`);
}

const compatibilityProjection = extractFunction(adminSource, "compatibilityCommunicationAuthorityProjection_");
const searchFn = extractFunction(adminSource, "admin_searchApplicants");
const legacyEndpoint = extractFunction(adminSource, "admin_sendDocsFollowupEmails");
const queueRouteFn = extractFunction(adminUi, "sendDocsFollowup_");
const openCompatibilityRows = extractFunction(adminUi, "openCompatibilityCommunicationRows_");
const queueEventFn = extractFunction(adminUi, "initQueuePanelEvents_");
const resultsClickFn = extractFunction(adminUi, "onResultsClick_");

assert.match(searchFn, /compatibilityCommunicationAuthorityProjection_\(rowObj, r \+ 1\)/, "Search results must project authoritative communication fields");
assert.match(compatibilityProjection, /buildActionabilityPreviewRow_/, "Compatibility communication projection must reuse shared actionability authority");
assert.match(compatibilityProjection, /recommendedMessageType:/, "Compatibility projection must expose authoritative recommended message type");
assert.match(compatibilityProjection, /selectable:/, "Compatibility projection must expose authoritative selectability");

assert.match(reviewQueuesSource, /compatibilityCommunicationAuthorityProjection_\(rowObj, r \+ 1\)/, "Review queue rows must project authoritative communication fields");
assert.match(reviewQueuesSource, /for \(var authorityKey in authorityProjection\)/, "Review queue rows must merge projected compatibility authority metadata into queue items");

assert.match(legacyEndpoint, /LEGACY_DOCS_FOLLOWUP_RETIRED/, "Legacy endpoint must explicitly report retirement");
assert.match(legacyEndpoint, /Use Review Workspace or Batch Communication/, "Legacy endpoint must redirect operators to authoritative surfaces");
assert.doesNotMatch(legacyEndpoint, /adminSendEmail_\(/, "Legacy endpoint must no longer send directly");
assert.doesNotMatch(legacyEndpoint, /PropertiesService\.getScriptProperties\(\)\.setProperty/, "Legacy endpoint must no longer mutate docs-followup sent markers");

assert.match(queueRouteFn, /openCompatibilityCommunicationRows_/, "Legacy UI route must delegate to authoritative compatibility routing");
assert.doesNotMatch(queueRouteFn, /admin_sendDocsFollowupEmails/, "Legacy UI route must no longer call the retired backend send endpoint");
assert.doesNotMatch(queueRouteFn, /google\.script\.run/, "Legacy UI route must not issue a direct send RPC");

assert.match(openCompatibilityRows, /ids\.length === 1[\s\S]*Opening Review Workspace/, "Single compatibility row must route to Review Workspace");
assert.match(openCompatibilityRows, /batchCommSelectedCohortsFromRows_/, "Compatibility bulk routing must partition authoritative communication cohorts");
assert.match(openCompatibilityRows, /openBatchCommunicationModal_\(/, "Compatibility bulk routing must open the shared Batch Communication modal");
assert.match(openCompatibilityRows, /No authoritative communication cohort is available/, "Compatibility bulk routing must fail clearly when no authoritative cohort exists");

assert.match(queueEventFn, /Legacy Docs Follow-Up send retired\. Opening Review Workspace/, "Queue single action must redirect to Review Workspace");
assert.match(queueEventFn, /openCompatibilityCommunicationRows_\(compatibilitySelectedRowsForSource_\(selectedRows, "queue-bulk"\), "queue-bulk"\)/, "Queue selected action must redirect to shared compatibility batch routing");
assert.match(resultsClickFn, /Legacy Docs Follow-Up send retired\. Opening Review Workspace/, "Search single action must redirect to Review Workspace");

assert.doesNotMatch(adminUi, /Send Quote to Selected|Send Docs Quote to Selected|Send docs quote email now\./, "Legacy docs-follow-up send wording must be removed from compatibility UI");
assert.doesNotMatch(adminUi, /data-action='send-docs-single'/, "Compatibility UI must not render direct single-send controls");
assert.match(adminUi, /Open Batch Communication/, "Compatibility UI must expose the shared batch modal entry instead of direct send");
assert.match(adminUi, /Select All Authoritative/, "Compatibility selection wording must reflect authoritative routing");
assert.match(adminUi, />Communication<\/th>/, "Compatibility queue/search table must stop presenting docs follow-up as its own authority column");

console.log("PASS legacy docs follow-up direct-send authority retired");
