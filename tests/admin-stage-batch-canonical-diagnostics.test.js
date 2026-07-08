const fs = require("node:fs");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const stageBatchSource = fs.readFileSync("Admin_StageBatchCommunications.js", "utf8");
const adminSource = fs.readFileSync("Admin.js", "utf8");
const adminUiSource = fs.readFileSync("AdminUI.html", "utf8");

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

const mapper = extractFunction(stageBatchSource, "getBatchMessageTypeForStage_");
const collect = extractFunction(stageBatchSource, "collectStageBatchCohort_");
const previewResponse = extractFunction(stageBatchSource, "stageBatchPreviewResponse_");
const send = extractFunction(stageBatchSource, "admin_sendStageBatch");
const trace = extractFunction(adminSource, "admin_traceStageBatchEligibility");
const runTraceUi = extractFunction(adminUiSource, "runStageBatchCanonicalTrace_");
const renderTraceUi = extractFunction(adminUiSource, "setStageBatchCanonicalTraceResult_");
const traceCsv = extractFunction(adminUiSource, "stageBatchTraceCsv_");
const diagnosticHelpers = [
  "stageBatchCanonicalLifecycleDiagnostics_",
  "stageBatchCanonicalDiagnosticsSummary_",
  "stageBatchRecordCanonicalDiagnostics_"
].map((name) => extractFunction(stageBatchSource, name)).join("\n\n");

assert.match(mapper, /communicationRecommendedMessageTypeForStage_\(normalized\)/, "Stage Batch message type mapping must remain legacy stage-based");
assert.doesNotMatch(mapper, /resolveCanonicalApplicantLifecycle_/, "Stage Batch mapping must not consume canonical lifecycle yet");
assert.match(collect, /if \(clean_\(snapshot\.stage \|\| ""\)\.toUpperCase\(\) !== normalizedStage\) continue;/, "Candidate inclusion must remain selected legacy stage based");
assert.match(collect, /stageBatchCanonicalLifecycleDiagnostics_/, "Cohort collection may record read-only canonical diagnostics");
assert.match(previewResponse, /canonicalLifecycleDiagnostics/, "Preview response must expose canonical diagnostics");
assert.match(trace, /canonicalLifecycleDiagnostics/, "Trace output must expose canonical diagnostics");
assert.match(trace, /requireSuperAdmin_\(adminEmail\)/, "Live Stage Batch canonical trace must require Super Admin");
assert.match(trace, /readOnly:\s*true/, "Live Stage Batch canonical trace must identify itself as read-only");
assert.doesNotMatch(trace, /admin_sendStageBatch|sendApplicantMessage_|admin_sendSelectedApplicantBatch|admin_sendApplicantMessage/, "Live Stage Batch canonical trace must not invoke any send path");
assert.doesNotMatch(send, /canonicalLifecycleDiagnostics|resolveCanonicalApplicantLifecycle_|compareLegacyCanonicalLifecycle_/, "Stage Batch send must not consume canonical diagnostics");
assert.doesNotMatch(send, /authorityOverride/, "Stage Batch send must not gain override bypasses");
assert.match(adminUiSource, /Canonical Lifecycle Trace Export/, "Admin UI must expose the Super Admin canonical trace export surface");
assert.match(adminUiSource, /id="opsStageBatchCanonicalTraceControls"/, "Canonical trace export must mount in the live Operations Workspace Stage Batch surface");
assert.match(adminUiSource, /id="opsStageBatchCanonicalTraceResult"/, "Canonical trace results must render in the live Operations Workspace Stage Batch surface");
assert.match(adminUiSource, /id="btnOpsStageBatchTraceRun"[\s\S]*runStageBatchCanonicalTrace_/, "Live Operations Workspace trace button must run the read-only trace action");
assert.match(adminUiSource, /id="stageBatchTraceApplicantId"/, "Trace export must require an explicit ApplicantID");
assert.match(adminUiSource, /id="stageBatchTraceStage"/, "Trace export must allow stage selection/input");
assert.match(adminUiSource, /id="btnStageBatchTraceRun"[\s\S]*runStageBatchCanonicalTrace_/, "Trace export run button must call the read-only trace action");
assert.match(adminUiSource, /stageBatchTraceSurfaceEl_/, "Trace functions must resolve the mounted Ops surface before legacy fallback");
assert.match(runTraceUi, /stageBatchTraceSurfaceEl_\("btnOpsStageBatchTraceRun", "btnStageBatchTraceRun"\)/, "Trace action must bind to the visible Ops button when mounted");
assert.match(runTraceUi, /admin_traceStageBatchEligibility\(payload\)/, "Trace UI must call the existing read-only diagnostic RPC");
assert.doesNotMatch(runTraceUi, /admin_previewStageBatch|admin_sendStageBatch|admin_sendSelectedApplicantBatch|admin_sendApplicantMessage|sendApplicantMessage_/, "Trace UI must not call preview or send RPCs");
assert.match(renderTraceUi, /Legacy Stage:[\s\S]*Canonical Base:[\s\S]*Canonical Message:/, "Trace UI must display legacy/canonical lifecycle fields");
assert.match(renderTraceUi, /Mismatch Reason/, "Trace UI must display mismatch reason when present");
assert.match(traceCsv, /canonicalBaseState[\s\S]*canonicalOverlays[\s\S]*canonicalRecommendedMessageType[\s\S]*hasLegacyCanonicalMismatch/, "Trace CSV must include canonical lifecycle diagnostic fields");

const cacheWriteMatch = stageBatchSource.match(/writeStageBatchPreviewCache_\(adminEmail,\s*\{([\s\S]*?)\n\s*\}\);/);
assert.ok(cacheWriteMatch, "Stage Batch preview cache write must be present");
assert.doesNotMatch(cacheWriteMatch[1], /canonicalLifecycleDiagnostics|canonicalBaseState|canonicalRecommendedMessageType/, "Preview cache parity payload must not include canonical diagnostics");

const context = {
  clean_: (value) => String(value == null ? "" : value).trim(),
  deriveApplicantLifecycleStage_: () => "REMINDER_DUE",
  resolveCanonicalApplicantLifecycle_: () => ({
    baseState: "INCOMPLETE_DOCUMENTS",
    lifecycleStage: "INCOMPLETE_DOCUMENTS",
    overlays: ["REMINDER_DUE"],
    recommendedMessageType: "docs_missing"
  }),
  compareLegacyCanonicalLifecycle_: () => ({
    hasLifecycleMismatch: true,
    mismatchReason: "Legacy lifecycle represents a timing/contact overlay while canonical lifecycle preserves applicant base state."
  })
};
vm.createContext(context);
vm.runInContext(diagnosticHelpers, context);

const diagnostic = context.stageBatchCanonicalLifecycleDiagnostics_({}, "REMINDER_DUE", "REMINDER_DUE");
assert.equal(diagnostic.selectedLegacyStage, "REMINDER_DUE");
assert.equal(diagnostic.rowLegacyStage, "REMINDER_DUE");
assert.equal(diagnostic.canonicalBaseState, "INCOMPLETE_DOCUMENTS");
assert.deepEqual(diagnostic.canonicalOverlays, ["REMINDER_DUE"]);
assert.equal(diagnostic.canonicalRecommendedMessageType, "docs_missing");
assert.equal(diagnostic.hasLegacyCanonicalMismatch, true);

let summary = context.stageBatchCanonicalDiagnosticsSummary_();
summary = context.stageBatchRecordCanonicalDiagnostics_(summary, diagnostic);
assert.equal(summary.readOnly, true);
assert.equal(summary.selectionUnaffected, true);
assert.equal(summary.messageMappingUnaffected, true);
assert.equal(summary.rowsInspected, 1);
assert.equal(summary.mismatchCount, 1);
assert.equal(summary.samples[0].canonicalBaseState, "INCOMPLETE_DOCUMENTS");

console.log("PASS Stage Batch canonical diagnostics remain read-only");
