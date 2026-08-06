const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const admin = fs.readFileSync("Admin.js", "utf8");
const canonical = fs.readFileSync("Admin_CanonicalPopulation.js", "utf8");
const adminUi = fs.readFileSync("AdminUI_OpsLifecycle.html", "utf8");
const adapter = fs.readFileSync("EduOps_FODE_Adapter.js", "utf8");
const workload = fs.readFileSync("EduOps_Workload.js", "utf8");
const eduopsHtml = fs.readFileSync("EduOps.html", "utf8");
const eduopsUi = fs.readFileSync("EduOps_ClientComponents.html", "utf8");
const eduopsStyles = fs.readFileSync("EduOps_Styles.html", "utf8");

function extract(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const character = source[index];
    if (escaped) { escaped = false; continue; }
    if (quote && character === "\\") { escaped = true; continue; }
    if (quote) { if (character === quote) quote = ""; continue; }
    if (["\"", "'", "`"].includes(character)) { quote = character; continue; }
    if (character === "{") depth += 1;
    if (character === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} is not closed`);
}

const clean = value => String(value == null ? "" : value).trim();
const adminContext = { clean_: clean };
vm.createContext(adminContext);
vm.runInContext([
  "applicantReviewFollowupEvidence_",
  "applicantAdmissionsStageProjection_",
  "applicantReviewLifecycleProjection_"
].map(name => extract(admin, name)).join("\n"), adminContext);

const moreah = adminContext.applicantReviewLifecycleProjection_({
  applicantId: "FODE-MOREAH-FIXTURE",
  lifecycleStage: "APPLICATION_RECEIVED",
  requirement: "Birth_ID_Passport_File, Latest_School_Report_File, Passport_Photo_File",
  documentsIncomplete: true,
  owner: "APPLICANT",
  sourceEvidence: "Canonical required-document projection"
});
assert.deepEqual(
  [moreah.admissionsStageKey, moreah.admissionsStageLabel, moreah.bucketKey, moreah.bucketLabel],
  ["DOCUMENTS", "Documents", "DOCUMENTS_FOLLOW_UP", "Documents — review / follow-up"]
);

const fixtureDefinitions = [
  ["DOCUMENTS_FOLLOW_UP", "DOCUMENTS", "Documents"],
  ["DOCUMENTS_ASSESSMENT", "DOCUMENTS", "Documents"],
  ["PENDING_APPLICANT_RESPONSE", "WAITING_ON_APPLICANT", "Waiting on applicant"],
  ["HELD_ABEYANCE_NO_RESPONSE", "WAITING_ON_APPLICANT", "Waiting on applicant"],
  ["WORKING_ON_IT", "INTERNAL_ASSESSMENT", "Internal assessment"],
  ["HELD_ABEYANCE_OTHER", "INTERNAL_ASSESSMENT", "Internal assessment"],
  ["READY_FOR_DECISION", "DECISION", "Decision"],
  ["ADMITTED_ONBOARDING_OUTSTANDING", "ONBOARDING", "Onboarding"],
  ["CLOSED_OUTCOME", "CLOSED_OUTCOMES", "Closed outcomes"],
  ["LOST_UNCONTACTABLE", "WAITING_ON_APPLICANT", "Waiting on applicant"],
  ["DATA_INTEGRITY_EXCEPTION", "DOCUMENTS", "Documents"]
];
fixtureDefinitions.forEach(([bucket, stageKey, stageLabel]) => {
  const resolved = adminContext.applicantAdmissionsStageProjection_(bucket, "APPLICATION_RECEIVED");
  assert.deepEqual([resolved.key, resolved.label], [stageKey, stageLabel], `${bucket} must resolve once to its canonical admissions stage`);
});

const eduopsContext = {
  eduopsUpper_: value => clean(value).toUpperCase(),
  eduopsClone_: value => JSON.parse(JSON.stringify(value)),
  eduopsHumanize_: value => clean(value).toLowerCase().replace(/_/g, " ").replace(/(^|\s)\S/g, letter => letter.toUpperCase())
};
vm.createContext(eduopsContext);
vm.runInContext([
  "eduopsReviewLifecycleDefinitions_",
  "eduopsAdmissionsStageDefinitions_",
  "eduopsAdmissionsStagePresentation_",
  "eduopsLifecycleExceptionPresentation_",
  "eduopsReviewLifecyclePresentation_"
].map(name => extract(workload, name)).join("\n"), eduopsContext);

const rows = fixtureDefinitions.map(([bucket, stageKey, stageLabel], index) => ({
  applicantId: `FODE-R414-${index + 1}`,
  reviewBucketKey: bucket,
  admissionsStageKey: stageKey,
  admissionsStageLabel: stageLabel,
  canonicalLifecycle: { lifecycleStage: bucket === "CLOSED_OUTCOME" ? "CLOSED" : "APPLICATION_RECEIVED" }
}));
const lifecycleWorklists = Array.from(eduopsContext.eduopsReviewLifecyclePresentation_(rows));
const stages = Array.from(eduopsContext.eduopsAdmissionsStagePresentation_(lifecycleWorklists));
assert.deepEqual(stages.map(stage => stage.label), ["Documents", "Waiting on applicant", "Internal assessment", "Decision", "Onboarding", "Closed outcomes"]);
assert.equal(stages.find(stage => stage.code === "DOCUMENTS").count, 2);
assert.deepEqual(Array.from(stages.find(stage => stage.code === "DOCUMENTS").worklistCodes), ["DOCUMENTS_FOLLOW_UP", "DOCUMENTS_ASSESSMENT"]);
const exceptions = Array.from(eduopsContext.eduopsLifecycleExceptionPresentation_(lifecycleWorklists, { REVIEW_REQUIRED: 4 }));
assert.deepEqual(exceptions.map(item => item.label), ["Lost / uncontactable", "Data / integrity exception", "All active work", "Legacy Review aggregate"]);
assert.equal(exceptions.find(item => item.code === "LEGACY_REVIEW_AGGREGATE").count, 4);

const canonicalFixture = {
  identity: { applicantId: "FODE-MOREAH-FIXTURE", rowNumber: 44 },
  applicant: { name: "Moreah Fixture" },
  actionability: {
    reviewBucketKey: "DOCUMENTS_FOLLOW_UP",
    reviewBucketLabel: "Documents — review / follow-up",
    admissionsStageKey: "DOCUMENTS",
    admissionsStageLabel: "Documents",
    reviewRequirement: "Birth_ID_Passport_File, Latest_School_Report_File, Passport_Photo_File",
    reviewReason: "Required documents remain unresolved.",
    nextAction: "UPLOAD_REQUIRED_DOCUMENTS"
  },
  lifecycle: { lifecycleStage: "APPLICATION_RECEIVED" },
  finance: { financeAuthority: {} }, documents: {}, contactability: {}, diagnostics: {}
};
const adapterContext = { eduopsClean_: clean };
vm.createContext(adapterContext);
vm.runInContext(extract(adapter, "eduopsFodeActionabilityRowFromCanonical_"), adapterContext);
const adapted = adapterContext.eduopsFodeActionabilityRowFromCanonical_(canonicalFixture);
assert.deepEqual(
  [adapted.admissionsStageKey, adapted.reviewBucketKey, adapted.reviewRequirement, adapted.reviewReason, adapted.nextAction],
  ["DOCUMENTS", "DOCUMENTS_FOLLOW_UP", canonicalFixture.actionability.reviewRequirement, canonicalFixture.actionability.reviewReason, "UPLOAD_REQUIRED_DOCUMENTS"],
  "EduOps must consume the canonical Admin admissions-stage position without recalculation"
);

assert.match(canonical, /admissionsStageKey:[\s\S]*admissionsStageLabel:/);
assert.match(adminUi, /Whole population → admissions stage → precise worklist → applicant action/);
assert.match(adminUi, /id="opsAdmissionsPopulationSummary"[\s\S]*id="opsAdmissionsStageStrip"[\s\S]*id="opsReviewLifecycleBucketCards"[\s\S]*id="opsAdmissionsExceptionCards"/);
assert.match(eduopsHtml, /id="eduopsAdmissionsPopulationSummary"[\s\S]*id="eduopsAdmissionsStages"[\s\S]*id="eduopsWorklistKeys"[\s\S]*id="eduopsLifecycleExceptions"/);
assert.match(eduopsUi, /data-admissions-stage[\s\S]*data-first-worklist[\s\S]*data-lifecycle-worklist/);
assert.match(eduopsUi, /app\.state\.reviewBucketKey = admissionsStage\.getAttribute\("data-first-worklist"\)[\s\S]*app\.requestWorkload/);
assert.match(eduopsStyles, /@media \(max-width: 560px\)[\s\S]*\.eduops-admissions-stage-strip \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); overflow: visible; \}/);
assert.doesNotMatch([adminUi, eduopsHtml, eduopsUi].join("\n"), />[^<]*journey[^<]*</i, "journey must not be a staff-facing label");
assert.doesNotMatch(adminUi, /Secondary compatibility stage map/);
assert.match(adminUi, /Legacy Review aggregate/);
assert.match(eduopsUi, /app\.formatCode\(review\.nextAction\)/, "Moreah's next action must render as Upload Required Documents");
assert.match(adminUi, /type='button'[\s\S]*data-admissions-stage[\s\S]*aria-selected/);
assert.match(eduopsUi, /type="button" data-admissions-stage[\s\S]*aria-selected/);
assert.doesNotMatch([adminUi, eduopsHtml].join("\n"), /aria-hidden="true"[^>]*(Admissions|worklist)|(?:Admissions|worklist)[^>]*aria-hidden="true"/i);

console.log("PASS R414 canonical admissions-stage workspace, Moreah parity, hierarchy, exceptions, accessibility, and responsive contracts");
