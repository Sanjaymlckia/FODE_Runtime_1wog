const fs = require("node:fs");
const assert = require("node:assert/strict");

const stageBatchSource = fs.readFileSync("Admin_StageBatchCommunications.js", "utf8");
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

const collect = extractFunction(stageBatchSource, "collectStageBatchCohort_");
const preview = extractFunction(stageBatchSource, "admin_previewStageBatch");
const send = extractFunction(stageBatchSource, "admin_sendStageBatch");
const previewResponse = extractFunction(stageBatchSource, "stageBatchPreviewResponse_");
const authorityType = extractFunction(stageBatchSource, "stageBatchAuthoritativeMessageTypeForRow_");
const cohortList = extractFunction(stageBatchSource, "stageBatchCommunicationCohortsList_");

assert.match(authorityType, /canonicalRecommendedMessageType/, "Stage Batch authority type helper must inspect canonical recommended message type");
assert.match(authorityType, /isCommunicationTypeBatchSafe_\(canonicalType\)/, "Stage Batch authority type helper must only promote batch-safe canonical message types");
assert.match(authorityType, /getBatchMessageTypeForStage_\(legacyStage\)/, "Stage Batch authority type helper must retain explicit legacy fallback when canonical output is absent");

assert.match(collect, /var requestedMessageType = normalizeApplicantMessageType_\(options\.messageType \|\| ""\);/, "Stage Batch cohort collection must accept an explicit requested message type");
assert.match(collect, /var discoverOnly = options\.discoverOnly === true;/, "Stage Batch cohort collection must support read-only cohort discovery");
assert.match(collect, /var authoritative = stageBatchAuthoritativeMessageTypeForRow_\(rowObj, normalizedStage, snapshot\.stage, rowDiagnostics\);/, "Stage Batch collection must resolve per-row authoritative communication type");
assert.match(collect, /stageBatchRecordCommunicationCohort_\(communicationCohortMap, authoritative\);/, "Stage Batch collection must build communication cohorts before preview/send");
assert.match(collect, /if \(!authoritative\.messageType \|\| authoritative\.messageType !== messageType\) \{/, "Stage Batch preview/send cohorts must remain homogeneous by authoritative message type");
assert.match(collect, /communicationCohorts:\s*stageBatchCommunicationCohortsList_\(communicationCohortMap\)/, "Stage Batch collection must expose discovered communication cohorts");

assert.match(preview, /var discoverOnly = p\.discoverOnly === true;/, "Stage Batch preview must support read-only cohort discovery");
assert.match(preview, /messageType = normalizeApplicantMessageType_\(p\.messageType \|\| ""\) \|\| \(discoverOnly \? "" : getBatchMessageTypeForStage_\(stage\)\);/, "Stage Batch preview must prefer explicit cohort message type over stage mapping");
assert.match(preview, /communicationCohorts:\s*cohort\.communicationCohorts \|\| \[\]/, "Stage Batch preview must return communication cohort metadata to the modal");
assert.match(preview, /else if \(!discoverOnly\) \{\s*writeStageBatchPreviewCache_/s, "Stage Batch preview must skip cache writes during read-only cohort discovery");

assert.match(send, /messageType = normalizeApplicantMessageType_\(p\.messageType \|\| ""\) \|\| getBatchMessageTypeForStage_\(stage\);/, "Stage Batch send must honor the explicit authoritative cohort message type");
assert.match(send, /cachedMessageType !== messageType/, "Stage Batch send parity must reject mismatched message-type sends");

assert.match(previewResponse, /communicationCohorts:/, "Stage Batch preview response must expose communication cohorts");
assert.match(cohortList, /label:\s*clean_\(item\.label \|\| stageBatchCommunicationCohortLabel_\(key\) \|\| key\)/, "Stage Batch communication cohorts must expose operator-readable labels");

const openStage = extractFunction(adminUiSource, "openBatchCommunicationFromStage_");
const loadCohorts = extractFunction(adminUiSource, "loadStageBatchCommunicationCohorts_");
const sourceSummary = extractFunction(adminUiSource, "batchCommSourceSummary_");
const cohortSummary = extractFunction(adminUiSource, "batchCommCohortSummaryHtml_");
const sourceTemplates = extractFunction(adminUiSource, "batchCommSourceTemplateItems_");

assert.match(openStage, /openBatchCommunicationModal_\(\{[\s\S]*sourceType:\s*"stage"/, "Stage Batch UI must open the batch modal as a stage source");
assert.doesNotMatch(openStage, /recommendedMessageType:/, "Stage Batch UI must not infer a broad stage template before authoritative cohort discovery");
assert.match(loadCohorts, /admin_previewStageBatch\(\{[\s\S]*discoverOnly:\s*true/, "Stage Batch UI must discover stage communication cohorts through the backend");
assert.match(loadCohorts, /if \(batchCommState\.cohortGroups\.length === 1\) setBatchCommSelectedCohort_/, "Stage Batch UI may auto-select only a homogeneous single cohort");
assert.match(sourceSummary, /Choose a communication cohort/, "Stage Batch source summary must prompt for cohort choice when the stage is mixed");
assert.match(cohortSummary, /Stage membership is operational navigation only\. Preview and send require one authoritative communication cohort\./, "Stage Batch cohort chooser must explain the stage-vs-cohort distinction");
assert.match(sourceTemplates, /batchCommState\.sourceType !== "selected" && batchCommState\.sourceType !== "stage"/, "Stage template gallery must be cohort-bound for stage sources too");

console.log("PASS Stage Batch authority cohesion contract");
