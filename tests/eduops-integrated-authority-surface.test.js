const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function read(file) { return fs.readFileSync(file, "utf8"); }
function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const files = {
  html: read("EduOps.html"),
  flags: read("EduOps_FeatureFlags.js"),
  client: read("EduOps_Client.html"),
  core: read("EduOps_ClientCore.html"),
  components: read("EduOps_ClientComponents.html"),
  batch: read("EduOps_ClientBatch.html"),
  workbench: read("EduOps_ClientWorkbench.html"),
  workload: read("EduOps_Workload.js"),
  commands: read("EduOps_Commands.js"),
  contracts: read("EduOps_Contracts.js"),
  receipts: read("EduOps_Receipts.js")
};
const client = [files.html, files.client, files.core, files.components, files.batch, files.workbench].join("\n");

for (const file of ["EduOps_ClientCore.html", "EduOps_ClientComponents.html", "EduOps_ClientBatch.html", "EduOps_ClientWorkbench.html"]) {
  const script = read(file).replace(/^<script>\s*/, "").replace(/\s*<\/script>\s*$/, "");
  assert.doesNotThrow(() => new vm.Script(script, { filename: file }), `${file} must parse`);
}
assert.doesNotThrow(() => new vm.Script(files.workload, { filename: "EduOps_Workload.js" }));
assert.doesNotThrow(() => new vm.Script(files.commands, { filename: "EduOps_Commands.js" }));

assert.match(files.contracts, /eduops_getBatchCommunicationCatalogue/, "cohort catalogue must be a server read RPC");
assert.match(files.workload + files.commands, /communicationTemplateGalleryMetadata_[\s\S]*resolveApplicantMessageContextFromRow_/, "catalogue must combine canonical metadata with per-recipient authority");
assert.match(files.commands, /AVAILABLE_FOR_ALL[\s\S]*AVAILABLE_FOR_SERVER_PARTITION[\s\S]*UNAVAILABLE/, "server must author availability states");
assert.match(files.commands, /masterRecipients[\s\S]*recipients:\s*recipients/, "server must return exact master and template recipient DTOs");
assert.match(files.commands, /admin_previewSelectedApplicantBatch[\s\S]*admin_sendSelectedApplicantBatch/, "preview and execution must remain on Communication Authority");
assert.match(files.receipts, /preview\.selectedTemplate[\s\S]*templateId[\s\S]*templateLabel[\s\S]*subject/, "receipt must retain the public canonical communication identity");
assert.match(files.workbench, /receipt\.communication[\s\S]*templateLabel/, "history must display the canonical communication label");
assert.doesNotMatch([files.workload, files.commands, client].join("\n"), /GmailApp|MailApp|sendEmail\s*\(/, "affected EduOps path must not directly send");

assert.doesNotMatch(files.batch, /firstTemplate|batchTemplateOptions[^:]/, "client must not own or default the active template catalogue");
assert.match(files.batch, /Choose communication/, "batch requires explicit communication selection");
assert.doesNotMatch(files.batch, /item\.retired|retired !== true/, "client must not filter the authoritative template catalogue");
assert.match(files.workload, /retired: false/, "backend catalogue must omit retired templates from the client contract");
assert.match(files.batch, /data-availability[\s\S]*disabled/, "unavailable templates remain visible and disabled");
assert.match(files.batch, /item\.reason/, "backend reason text must be displayed");
assert.match(files.batch, /Recommended:/, "server recommendation is highlighted");
assert.match(files.batch, /recipientTable\([\s\S]*Server-authorised recipients/, "exact server-authorised recipients must be reviewable");
assert.match(files.batch, /Subject[\s\S]*Full message body/, "preview must show subject and full body");
assert.match(files.batch, /Execution: No execution performed/, "pre-execution status must be truthful");
assert.match(files.batch, /Execution completed/, "completed status must be reserved for a receipt");
assert.doesNotMatch(files.batch, /Pending preview|Confirmed execution/, "contradictory premature statuses must be absent");
assert.match(files.core, /invalidateOperationAuthority[\s\S]*commandPreview = null[\s\S]*commandIdempotencyKey = ""[\s\S]*commandExecutable = false[\s\S]*batch\.preview = null[\s\S]*batch\.idempotencyKey = ""/, "intent changes must invalidate preview, confirmation, idempotency and executable state");
assert.match(files.workbench, /#eduopsCommSubject,#eduopsCommBody[\s\S]*invalidateOperationAuthority/, "subject and body edits must invalidate operation authority");
assert.match(files.batch, /executionLimit:\s*Number\(app\.state\.selectionExecutionLimit \|\| 0\)/, "the displayed explicit limit must be transported without a 30 fallback");

assert.match(files.components, /ALL_ELIGIBLE_MATCHING_QUERY[\s\S]*restoreSelectionExclusion[\s\S]*excludeFromSelection/, "query-wide row toggles must retain exclusion semantics");
assert.match(files.core, /clearSelectionExclusions/, "clear exclusions must be separate from clear selection");
assert.match(files.html, /eduopsClearSelection[\s\S]*eduopsClearExclusions/, "both clear controls must be visible");
assert.match(files.core, /app\.selectionContext = function[\s\S]*filters:[\s\S]*snapshotId:/, "local selection context retains query and snapshot identity");
const selectionContextBlock = files.core.match(/app\.selectionContext = function[\s\S]*?\n  };/);
assert.ok(selectionContextBlock, "local selection context adapter must exist");
assert.doesNotMatch(selectionContextBlock[0], /sort:|page:/, "sorting and pagination must not erase operator selection");

assert.match(files.workbench, /editable = selectedTemplate\.editable === true/, "editing must follow backend permission");
assert.match(files.workbench, /CUSTOM_EMAIL_MESSAGE_TYPE = "custom_email"/, "Custom Email remains mapped to its canonical public ID");
assert.match(files.workbench, /Choose a communication before previewing|Choose a communication\./, "individual communication also requires explicit selection");
assert.doesNotMatch(files.workbench, /communicationTemplateById\("docs_missing"|communicationTemplateById\("legacy_invite"/, "client shortcuts must not choose authority message types");
assert.doesNotMatch(client, /Legacy Invite|legacy template|legacy communication/i, "legacy naming must not be operator-facing");
assert.doesNotMatch(client, /legacy_invite/, "internal compatibility ID must not reach client source");

assert.match(files.components, /function rowDetailHtml[\s\S]*Lifecycle[\s\S]*Documents[\s\S]*Finance[\s\S]*Next-action timestamp[\s\S]*contextRibbonHtml/i, "compact workload rows must preserve backend lifecycle, finance, document and cooling-off context in expanded detail");
assert.match(files.components, /OPSEDU_OPERATIONAL_ROW_V1[\s\S]*issueLabel[\s\S]*nextActionLabel[\s\S]*statusLabel[\s\S]*contactLabel/, "collapsed workload rows must render the backend-authored operational row DTO");
assert.match(files.workbench, /Lifecycle[\s\S]*Finance[\s\S]*Documents[\s\S]*Actionability[\s\S]*Cooling-off/, "Workbench must expose the same state context");
assert.match(files.workload, /operationalClassification:\s*"FODE live production operations"/, "identity classification must be server-projected");
assert.match(files.workload, /appsScriptVersionReason/, "unavailable platform version must have a precise reason");
assert.doesNotMatch(client, /Admin staging/, "live identity surface must not be labelled staging");
assert.doesNotMatch(client, /FODE live production operations/, "client must not guess a runtime classification");
assert.match(client, /Runtime identity unavailable\./, "missing server identity must render the explicit unavailable state");

const flagContext = { PropertiesService: { getScriptProperties: () => ({ getProperties: () => ({}) }) } };
vm.createContext(flagContext);
vm.runInContext(files.flags, flagContext);
const availability = flagContext.eduopsOperationAvailability_();
assert.equal(availability.DOCUMENT_REVIEW.available, true, "backend may interpret a missing property as not suspended for a released operation");
assert.equal(availability.PORTAL_ACCESS.available, false, "backend must explicitly project unreleased operations as unavailable");
assert.equal(availability.BOOKS_ACTION.available, false, "backend must explicitly project Books as unavailable");
assert.match(files.core, /operationAvailabilityFor[\s\S]*:\s*null[\s\S]*projected\.available === true/, "client operation availability must fail closed when the backend DTO is absent");

const commandContext = {
  eduopsBatchExecutionCap_: () => 30,
  eduopsUpper_: (value) => String(value || "").toUpperCase(),
  eduopsClean_: (value) => String(value || "").trim(),
  eduopsClone_: (value) => JSON.parse(JSON.stringify(value)),
  normalizeSelectedApplicantBatchIds_: (ids) => [...new Set(ids || [])],
  selectedApplicantBatchInputLimit_: () => 500,
  eduopsQueryFingerprintForSelection_: (query) => JSON.stringify(query),
  eduopsFilterRows_: (rows) => rows,
  eduopsNormalizeWorkloadQuery_: (query) => query,
  eduopsCompareRows_: () => 0
};
vm.createContext(commandContext);
vm.runInContext([
  extractFunction(files.commands, "eduopsNormalizeExecutionLimit_"),
  extractFunction(files.commands, "eduopsServerSelectionQueryBinding_"),
  extractFunction(files.commands, "eduopsResolveBatchSelection_")
].join("\n"), commandContext);

function rows(count) { return Array.from({ length: count }, (_, i) => ({ applicantId: `A${i + 1}`, selectable: true })); }
function explicit(selectedCount, limit) {
  const resolved = { snapshotId: "SNAP", rows: rows(selectedCount) };
  return commandContext.eduopsResolveBatchSelection_({ product: "FODE", snapshotId: "SNAP", selectionMode: "EXPLICIT_SELECTION", selectedApplicantIds: resolved.rows.map((row) => row.applicantId), excludedApplicantIds: [], executionLimit: limit }, resolved, { executionLimit: limit });
}
assert.equal(explicit(10, 30).executionCohortSize, 10, "10 selected with limit 30 produces 10");
assert.equal(explicit(30, 10).executionCohortSize, 10, "30 selected with limit 10 produces 10");

function queryWide(limit) {
  const query = { actionabilityState: "READY" };
  const fingerprint = JSON.stringify(query);
  const resolved = { snapshotId: "SNAP", rows: rows(253) };
  const queryBinding = { schemaVersion: "EDUOPS_QUERY_BINDING_V1", authority: "SERVER_AUTHORED", product: "FODE", snapshotId: "SNAP", query, queryFingerprint: fingerprint };
  return commandContext.eduopsResolveBatchSelection_({ product: "FODE", snapshotId: "SNAP", selectionMode: "ALL_ELIGIBLE_MATCHING_QUERY", queryBinding, excludedApplicantIds: [], executionLimit: limit }, resolved, { executionLimit: limit });
}
assert.equal(queryWide(30).executionCohortSize, 30, "query-wide 253 with limit 30 produces 30");
assert.equal(queryWide(10).executionCohortSize, 10, "query-wide 253 with limit 10 produces 10");
assert.throws(() => explicit(10, 0), /EXECUTION_LIMIT_REQUIRED/, "missing operator execution intent must fail closed");

console.log("PASS integrated authority surface source contracts catalogue=server recipients=exact limits=explicit noSend=true");
