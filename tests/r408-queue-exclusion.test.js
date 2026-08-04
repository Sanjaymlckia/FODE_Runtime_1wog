const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const adminSource = fs.readFileSync("Admin.js", "utf8");
const populationSource = fs.readFileSync("Admin_CanonicalPopulation.js", "utf8");
const stageBatchSource = fs.readFileSync("Admin_StageBatchCommunications.js", "utf8");
const eduopsSource = fs.readFileSync("EduOps_FODE_Adapter.js", "utf8");
const codeSource = fs.readFileSync("Code.js", "utf8");

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

const clean = value => String(value == null ? "" : value).trim();
const fixture = {
  ApplicantID: "FODE-26-003241",
  First_Name: "SSS",
  Last_Name: "SSS",
  Type: "Regression Fixture",
  Parent_Email: "sanjay@minervacenters.com",
  FormID: "32254778",
  FD_FormID: "238943",
  Contact_ID: "7101767000004904021",
  Deal_ID: "7101767000005964001",
  Reason_For_Transfer: "REGRESSION_FIXTURE_DO_NOT_PROCESS",
  Siblings_Name_Grade: "REGRESSION_FIXTURE_QUEUE_EXCLUDED",
  Last_Contact_Type: "fd_acknowledgement",
  Last_Contact_Result: "SENT"
};
const contract = {
  applicantId: fixture.ApplicantID,
  firstName: fixture.First_Name,
  lastName: fixture.Last_Name,
  type: fixture.Type,
  recipient: fixture.Parent_Email,
  formId: fixture.FormID,
  fdFormId: fixture.FD_FormID,
  contactId: fixture.Contact_ID,
  dealId: fixture.Deal_ID,
  nonOperationalMarker: fixture.Reason_For_Transfer,
  queueExclusionMarker: fixture.Siblings_Name_Grade,
  messageType: "docs_missing",
  templateVersionId: "1"
};

const actionabilityContext = {
  CONFIG: { R408_AUTHORIZED_FIXTURE: contract },
  clean_: clean,
  communicationCompatibilityReadRow_: row => row,
  stageAggregationEffectiveEmail_: row => clean(row.Parent_Email_Corrected || row.Parent_Email),
  stageAggregationIsValidEmail_: value => /@/.test(value),
  getWhatsAppFallbackPhoneRaw_: () => "",
  normalizePngWhatsAppPhone_: () => ({ ok: false }),
  adminOpsHasEmailIssue_: () => false,
  adminOpsRequiredDocumentUploadSummary_: () => ({ requiredDocumentUploadComplete: false, uploadedRequiredCount: 0, requiredCount: 3, missingRequiredDocuments: ["Birth ID"] }),
  adminDocumentReviewVerifiedForAutomation_: () => false,
  adminRowPortalSubmitted_: () => false,
  adminRowPaymentAuthorityFacts_: () => ({ paymentBadge: "NOT_APPLICABLE" }),
  resolveCanonicalFinanceState_: () => ({ financeState: "NOT_APPLICABLE", paymentEvidencePresent: false, paymentEvidenceVerified: false, paymentVerified: false }),
  isYes_: () => false,
  deriveApplicantLifecycleStage_: () => "DOCS_REQUIRED",
  deriveOperationalPipelineStage_: () => "DOCS_REQUIRED",
  resolveCanonicalApplicantLifecycle_: () => ({ baseState: "INCOMPLETE_DOCUMENTS", lifecycleStage: "INCOMPLETE_DOCUMENTS", overlays: [], recommendedNextAction: "UPLOAD_REQUIRED_DOCUMENTS", recommendedMessageType: "docs_missing", actionOwner: "APPLICANT", reason: "Missing documents" }),
  compareLegacyCanonicalLifecycle_: () => ({ hasLifecycleMismatch: false, legacyLifecycle: "DOCS_REQUIRED", canonicalBaseState: "INCOMPLETE_DOCUMENTS", canonicalOverlays: [], mismatchReason: "" }),
  adminOpsDocumentStateFromRow_: () => "MISSING",
  actionabilityPreviewDateInfo_: () => ({ value: "", source: "", ageDays: 1 }),
  actionabilityPreviewLastContactAgeDays_: () => 1,
  communicationCadenceState_: () => ({ cooldownActive: false, manualReviewRequired: false, cooldownCycle: "", successfulSendCount: 0 }),
  parseTime_: () => 0,
  actionabilityPreviewUrgency_: () => ({ level: "NORMAL", reason: "" }),
  resolveActionabilityState_: () => ({ actionabilityState: "READY", selectable: true, selectBlockReason: "", coolingOffUntil: "", recommendedAction: "docs_missing", reasonCode: "READY" }),
  actionabilityAuthorityRecommendedMessageType_: (canonical, fallback) => clean(canonical || fallback),
  actionabilityWorkloadExplanationForRow_: () => "Ready",
  actionabilityWorkloadGroupKey_: () => "APPLICANT",
  actionabilityWorklistProjection_: () => ({ worklistKey: "DOCUMENT_FOLLOW_UP", worklistLabel: "Missing Documents", worklistReason: "Awaiting applicant upload" }),
  Date
};
vm.createContext(actionabilityContext);
vm.runInContext(extractFunction(codeSource, "getR408AuthorizedFixtureContract_"), actionabilityContext);
vm.runInContext(extractFunction(codeSource, "isR408AuthorizedFixtureRow_"), actionabilityContext);
vm.runInContext(extractFunction(adminSource, "buildR408FixtureNonOperationalActionabilityRow_"), actionabilityContext);
vm.runInContext(extractFunction(adminSource, "buildActionabilityPreviewRow_"), actionabilityContext);

const fixtureProjection = actionabilityContext.buildActionabilityPreviewRow_(fixture, 338);
assert.equal(fixtureProjection.operational, false);
assert.equal(fixtureProjection.lockedRegressionFixture, true);
assert.equal(fixtureProjection.actionabilityState, "NON_OPERATIONAL");
assert.equal(fixtureProjection.selectable, false);
assert.equal(fixtureProjection.nextAction, "NO_ACTION");
assert.equal(fixtureProjection.worklistKey, "");
assert.equal(fixtureProjection.recommendedMessageType, "");
assert.equal(fixtureProjection.reasonCode, "REGRESSION_FIXTURE_QUEUE_EXCLUDED");

const ordinary = { ...fixture, ApplicantID: "FODE-26-009999", Type: "Applicant", Reason_For_Transfer: "", Siblings_Name_Grade: "" };
const ordinaryProjection = actionabilityContext.buildActionabilityPreviewRow_(ordinary, 339);
assert.equal(ordinaryProjection.actionabilityState, "READY");
assert.equal(ordinaryProjection.selectable, true);
assert.equal(ordinaryProjection.worklistKey, "DOCUMENT_FOLLOW_UP");

const populationContext = {
  clean_: clean,
  canonicalPopulationCommunicationProjection_: () => ({ recommendedMessageType: "" }),
  canonicalPopulationFinanceProjection_: () => ({ state: "NON_OPERATIONAL", financeAuthority: { financeState: "NON_OPERATIONAL" } }),
  canonicalPopulationDisplayPhone_: () => "",
  canonicalPopulationClone_: value => JSON.parse(JSON.stringify(value || {})),
  stageAggregationEffectiveEmail_: row => row.Parent_Email,
  CANONICAL_POPULATION_SCHEMA_VERSION: "CANONICAL_POPULATION_V1"
};
vm.createContext(populationContext);
vm.runInContext(extractFunction(populationSource, "buildCanonicalPopulationRow_"), populationContext);
vm.runInContext(extractFunction(populationSource, "canonicalPopulationArrayFilter_"), populationContext);
vm.runInContext(extractFunction(populationSource, "canonicalPopulationRowMatchesFilters_"), populationContext);
const canonicalFixture = populationContext.buildCanonicalPopulationRow_(fixture, 338, { authorityRow: fixtureProjection, sourceSheetName: "FODE_Data" });
assert.equal(canonicalFixture.actionability.operational, false);
assert.equal(canonicalFixture.actionability.selectable, false);
assert.equal(canonicalFixture.visibility.hidden, true);
assert.equal(populationContext.canonicalPopulationRowMatchesFilters_(canonicalFixture, {}), false);

const eduopsContext = {
  eduopsClean_: clean,
  eduopsClone_: value => JSON.parse(JSON.stringify(value || {}))
};
vm.createContext(eduopsContext);
vm.runInContext(extractFunction(eduopsSource, "eduopsFodeActionabilityRowFromCanonical_"), eduopsContext);
vm.runInContext(extractFunction(eduopsSource, "eduopsFodeRowsForSnapshot_"), eduopsContext);
const ordinaryCanonical = JSON.parse(JSON.stringify(canonicalFixture));
ordinaryCanonical.identity.applicantId = ordinary.ApplicantID;
ordinaryCanonical.actionability.operational = true;
ordinaryCanonical.actionability.lockedRegressionFixture = false;
ordinaryCanonical.actionability.state = "READY";
const eduopsRows = eduopsContext.eduopsFodeRowsForSnapshot_({ rows: [canonicalFixture, ordinaryCanonical] });
assert.equal(eduopsRows.length, 1);
assert.equal(eduopsRows[0].applicantId, ordinary.ApplicantID);

function sourceVersionFor(version, deployVersion, projectionContract) {
  const sheet = { getParent: () => ({ getId: () => "SalU" }), getName: () => "FODE_Data", getLastRow: () => 421, getLastColumn: () => 292 };
  const context = {
    CONFIG: { VERSION: version, DEPLOY_VERSION_NUMBER: deployVersion },
    EDUOPS_FODE_PROJECTION_CONTRACT: projectionContract,
    eduopsClean_: clean,
    openDataSheet_: () => sheet,
    DriveApp: { getFileById: () => ({ getLastUpdated: () => new Date("2026-08-04T00:00:00.000Z") }) },
    Date
  };
  vm.createContext(context);
  vm.runInContext(extractFunction(eduopsSource, "eduopsFodeSourceVersion_"), context);
  return context.eduopsFodeSourceVersion_();
}
const currentCacheIdentity = sourceVersionFor("r408", 408, "R408_QUEUE_EXCLUSION_V1");
assert.notEqual(currentCacheIdentity.key, sourceVersionFor("r407", 407, "R408_QUEUE_EXCLUSION_V1").key);
assert.notEqual(currentCacheIdentity.key, sourceVersionFor("r408", 408, "PRE_REPAIR_PROJECTION").key);

const stageContext = { isR408AuthorizedFixtureRow_: row => clean(row.ApplicantID) === fixture.ApplicantID };
vm.createContext(stageContext);
vm.runInContext(extractFunction(stageBatchSource, "stageBatchShouldExcludeNonOperationalFixture_"), stageContext);
assert.equal(stageContext.stageBatchShouldExcludeNonOperationalFixture_(fixture), true);
assert.equal(stageContext.stageBatchShouldExcludeNonOperationalFixture_(ordinary), false);
const collectSource = extractFunction(stageBatchSource, "collectStageBatchCohort_");
assert.ok(collectSource.indexOf("stageBatchShouldExcludeNonOperationalFixture_(rowObj)") < collectSource.indexOf("stageAggregationSnapshot_(rowObj)"));
assert.ok(collectSource.indexOf("stageBatchShouldExcludeNonOperationalFixture_(rowObj)") < collectSource.indexOf("totalInStage++"));

const adminSearch = extractFunction(adminSource, "admin_searchApplicants");
const adminPreview = extractFunction(adminSource, "admin_getActionabilityPreview");
const ledgerBucket = extractFunction(adminSource, "populationLedgerBucketFromActionability_");
assert.match(adminSearch, /actionability\.operational === false\) return false/);
assert.match(adminPreview, /actionability\.operational === false\) return/);
const ledgerContext = { clean_: clean, actionabilityWorkloadGroupKey_: () => "UNKNOWN", actionabilityPopulationBucketForGroupKey_: () => "Unknown / Unclassified" };
vm.createContext(ledgerContext);
vm.runInContext(ledgerBucket, ledgerContext);
assert.equal(ledgerContext.populationLedgerBucketFromActionability_(fixtureProjection).bucket, "Non-operational Fixtures");
assert.match(codeSource, /REGRESSION_FIXTURE_EXCLUDED/);
assert.match(codeSource, /authorizedR408Fixture !== true/);

assert.equal(fixture.Last_Contact_Type, "fd_acknowledgement");
assert.equal(fixture.Last_Contact_Result, "SENT");
console.log("PASS R408 operational queue exclusion and cache identity");
