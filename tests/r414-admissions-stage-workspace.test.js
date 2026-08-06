const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const admin = fs.readFileSync("Admin.js", "utf8");
const canonical = fs.readFileSync("Admin_CanonicalPopulation.js", "utf8");
const adminUi = fs.readFileSync("AdminUI_OpsLifecycle.html", "utf8");
const adminPrimaryUi = fs.readFileSync("AdminUI.html", "utf8");
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

const reviewDefinitions = [
  { key:"DOCUMENTS_FOLLOW_UP", label:"Review / follow-up", stageKey:"DOCUMENTS" },
  { key:"DOCUMENTS_ASSESSMENT", label:"Received — verification", stageKey:"DOCUMENTS" },
  { key:"PENDING_APPLICANT_RESPONSE", label:"Pending response", stageKey:"WAITING_ON_APPLICANT" },
  { key:"HELD_ABEYANCE_NO_RESPONSE", label:"Held in abeyance — no response", stageKey:"WAITING_ON_APPLICANT" },
  { key:"WORKING_ON_IT", label:"Working on it", stageKey:"INTERNAL_ASSESSMENT" },
  { key:"HELD_ABEYANCE_OTHER", label:"Held in abeyance — other reason", stageKey:"INTERNAL_ASSESSMENT" },
  { key:"READY_FOR_DECISION", label:"Ready for decision", stageKey:"DECISION" },
  { key:"ADMITTED_ONBOARDING_OUTSTANDING", label:"Admitted — onboarding outstanding", stageKey:"ONBOARDING" },
  { key:"CLOSED_OUTCOME", label:"Closed outcomes", stageKey:"CLOSED_OUTCOMES", closed:true },
  { key:"LOST_UNCONTACTABLE", label:"Lost / uncontactable", exception:true },
  { key:"DATA_INTEGRITY_EXCEPTION", label:"Data / integrity exception", exception:true },
  { key:"ALL_ACTIVE", label:"All active work", utility:true },
  { key:"LEGACY_REVIEW_AGGREGATE", label:"Legacy Review aggregate", utility:true, secondary:true }
];
const stageDefinitions = [
  { key:"DOCUMENTS", label:"Documents", worklists:["DOCUMENTS_FOLLOW_UP","DOCUMENTS_ASSESSMENT"] },
  { key:"WAITING_ON_APPLICANT", label:"Waiting on applicant", worklists:["PENDING_APPLICANT_RESPONSE","HELD_ABEYANCE_NO_RESPONSE"] },
  { key:"INTERNAL_ASSESSMENT", label:"Internal assessment", worklists:["WORKING_ON_IT","HELD_ABEYANCE_OTHER"] },
  { key:"DECISION", label:"Decision", worklists:["READY_FOR_DECISION"] },
  { key:"ONBOARDING", label:"Onboarding", worklists:["ADMITTED_ONBOARDING_OUTSTANDING"] },
  { key:"CLOSED_OUTCOMES", label:"Closed outcomes", worklists:["CLOSED_OUTCOME"] }
];
const primaryContext = {
  esc: value => clean(value),
  opsReviewLifecycleDefinitions_: () => reviewDefinitions,
  opsAdmissionsStageDefinitions_: () => stageDefinitions,
  actionabilityActiveReviewBucket: "DOCUMENTS_FOLLOW_UP",
  actionabilityReviewLifecycleState: { byBucket: Object.fromEntries(lifecycleWorklists.map(item => [item.code, item.count])), activeRows: 10, closedRows: 1 },
  actionabilityWorkloadSummaryState: { REVIEW_REQUIRED: 4 }
};
vm.createContext(primaryContext);
vm.runInContext([
  "actionabilityReviewBucketDefinitions_",
  "actionabilityAdmissionsStageDefinitions_",
  "actionabilityReviewLifecycleCount_",
  "renderActionabilityLifecycleBucketDeck_"
].map(name => extract(adminPrimaryUi, name)).join("\n"), primaryContext);
const primaryHtml = primaryContext.renderActionabilityLifecycleBucketDeck_([]);
assert.equal((primaryHtml.match(/data-actionability-admissions-stage=/g) || []).length, 6);
assert.equal((primaryHtml.match(/data-actionability-review-bucket=/g) || []).length, 6, "two Documents worklists and four exception/utility links must render");
assert.match(primaryHtml, /Population Ledger[\s\S]*Documents[\s\S]*Review \/ follow-up[\s\S]*Exceptions and utilities/);
assert.doesNotMatch(primaryHtml, /Canonical lifecycle worklists/);

const currentExceptionTarget = { innerHTML:"" };
const staleExceptionTarget = { innerHTML:"", isConnected:false };
const eduopsRequests = [];
const eduopsRenderContext = {
  app: {
    state: { reviewBucketKey:"DOCUMENTS_FOLLOW_UP", actionabilityState:"ALL", worklistKey:"" },
    esc: value => clean(value),
    clearSelection: () => {},
    requestWorkload: options => eduopsRequests.push({ options, reviewBucketKey:eduopsRenderContext.app.state.reviewBucketKey, actionabilityState:eduopsRenderContext.app.state.actionabilityState })
  },
  document: { getElementById: id => id === "eduopsLifecycleExceptions" ? currentExceptionTarget : null },
  dom: {
    eduopsAdmissionsPopulationSummary: { innerHTML:"" },
    eduopsAdmissionsStages: { innerHTML:"" },
    eduopsWorklistKeys: { innerHTML:"" },
    eduopsLifecycleExceptions: staleExceptionTarget
  }
};
vm.createContext(eduopsRenderContext);
vm.runInContext([extract(eduopsUi, "renderWorklists"), extract(eduopsUi, "activateAdmissionsLifecycleControl")].join("\n"), eduopsRenderContext);
eduopsRenderContext.renderWorklists({
  lifecycleWorklists: JSON.parse(JSON.stringify(lifecycleWorklists)),
  admissionsStages: JSON.parse(JSON.stringify(stages)),
  populationSummary: { total:11, active:10, closed:1 },
  actionabilityBuckets: [{ code:"REVIEW_REQUIRED", count:4 }]
});
assert.equal((eduopsRenderContext.dom.eduopsWorklistKeys.innerHTML.match(/data-lifecycle-worklist=/g) || []).length, 2);
assert.equal(staleExceptionTarget.innerHTML, "", "a detached cached target must never intercept live exception rendering");
assert.equal(eduopsRenderContext.dom.eduopsLifecycleExceptions, currentExceptionTarget, "the DOM cache must refresh to the current live mount");
assert.equal((currentExceptionTarget.innerHTML.match(/<button/g) || []).length, 4, "EduOps must render canonical exceptions into the current DOM when a stale cached target and an older DTO omit the convenience fields");
assert.match(currentExceptionTarget.innerHTML, /Lost \/ uncontactable[\s\S]*Data \/ integrity exception[\s\S]*All active work[\s\S]*Legacy Review aggregate/);
function activateEduOpsControl(selector, attributes) {
  const control = { getAttribute: name => attributes[name] || "" };
  return eduopsRenderContext.activateAdmissionsLifecycleControl({ target:{ closest: requested => requested === selector ? control : null } });
}
assert.equal(activateEduOpsControl("[data-lifecycle-worklist]", { "data-lifecycle-worklist":"LOST_UNCONTACTABLE" }), true);
assert.equal(activateEduOpsControl("[data-lifecycle-worklist]", { "data-lifecycle-worklist":"DATA_INTEGRITY_EXCEPTION" }), true);
assert.equal(activateEduOpsControl("[data-lifecycle-worklist]", { "data-lifecycle-worklist":"ALL_ACTIVE" }), true);
assert.equal(activateEduOpsControl("[data-legacy-review]", { "data-legacy-review":"true" }), true);
assert.deepEqual(eduopsRequests.map(item => [item.reviewBucketKey, item.actionabilityState]), [
  ["LOST_UNCONTACTABLE", "ALL"],
  ["DATA_INTEGRITY_EXCEPTION", "ALL"],
  ["ALL_ACTIVE", "ALL"],
  ["ALL_ACTIVE", "REVIEW_REQUIRED"]
], "every EduOps exception/utility control must select a canonical query and request the central list");
assert.match(currentExceptionTarget.innerHTML, /<button type="button"[^>]*data-lifecycle-worklist="LOST_UNCONTACTABLE"/);
assert.match(currentExceptionTarget.innerHTML, /<button type="button"[^>]*data-legacy-review="true"/);

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
assert.match(adminPrimaryUi, /data-r414-primary-hierarchy="true"/);
assert.match(adminPrimaryUi, /class="opsAdmissionsPopulationSummary"/);
assert.match(adminPrimaryUi, /data-actionability-admissions-stage/);
assert.match(adminPrimaryUi, /class="opsAdmissionsWorklistPanel"/);
assert.match(adminPrimaryUi, /class="opsAdmissionsExceptionPanel"/);
assert.match(adminPrimaryUi, /let actionabilityActiveReviewBucket = "DOCUMENTS_FOLLOW_UP"/);
assert.match(adminPrimaryUi, /function selectActionabilityAdmissionsStage_[\s\S]*selectActionabilityReviewBucket_\(stage\.worklists\[0\]\)/);
assert.match(eduopsHtml, /id="eduopsAdmissionsPopulationSummary"[\s\S]*id="eduopsAdmissionsStages"[\s\S]*id="eduopsWorklistKeys"[\s\S]*id="eduopsLifecycleExceptions"/);
assert.match(eduopsUi, /data-admissions-stage[\s\S]*data-first-worklist[\s\S]*data-lifecycle-worklist/);
assert.match(eduopsUi, /app\.state\.reviewBucketKey = admissionsStage\.getAttribute\("data-first-worklist"\)[\s\S]*app\.requestWorkload/);
assert.match(eduopsUi, /if \(!lifecycleExceptions\.length\)[\s\S]*LOST_UNCONTACTABLE[\s\S]*DATA_INTEGRITY_EXCEPTION[\s\S]*LEGACY_REVIEW_AGGREGATE/);
assert.match(eduopsStyles, /@media \(max-width: 560px\)[\s\S]*\.eduops-admissions-stage-strip \{ grid-template-columns: repeat\(2, minmax\(0, 1fr\)\); overflow: visible; \}/);
assert.doesNotMatch([adminUi, eduopsHtml, eduopsUi].join("\n"), />[^<]*journey[^<]*</i, "journey must not be a staff-facing label");
assert.doesNotMatch(adminUi, /Secondary compatibility stage map/);
assert.match(adminUi, /Legacy Review aggregate/);
assert.match(eduopsUi, /app\.formatCode\(review\.nextAction\)/, "Moreah's next action must render as Upload Required Documents");
assert.match(adminUi, /type='button'[\s\S]*data-admissions-stage[\s\S]*aria-selected/);
assert.match(eduopsUi, /type="button" data-admissions-stage[\s\S]*aria-selected/);
assert.doesNotMatch([adminUi, eduopsHtml].join("\n"), /aria-hidden="true"[^>]*(Admissions|worklist)|(?:Admissions|worklist)[^>]*aria-hidden="true"/i);

console.log("PASS R414 canonical admissions-stage workspace, Moreah parity, hierarchy, exceptions, accessibility, and responsive contracts");
