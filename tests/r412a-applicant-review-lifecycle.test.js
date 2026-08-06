const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("Admin.js", "utf8");
const canonicalSource = fs.readFileSync("Admin_CanonicalPopulation.js", "utf8");
const uiSource = fs.readFileSync("AdminUI.html", "utf8");
function extract(name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name} is not closed`);
}

const context = { clean_: value => String(value == null ? "" : value).trim() };
vm.createContext(context);
vm.runInContext(`${extract("applicantReviewFollowupEvidence_")}\n${extract("applicantAdmissionsStageProjection_")}\n${extract("applicantReviewLifecycleProjection_")}\n${extract("compareActionabilityPreviewRows_")}\n${extract("applicantReviewLifecycleReconciliationEmpty_")}\n${extract("applicantReviewLifecycleReconcile_")}`, context);

const identity = { applicantId: "FODE-R412A-1", lifecycleStage: "INCOMPLETE_DOCUMENTS", requirement: "Passport copy", documentsIncomplete: true };
const event = operationId => ({ applicantId: identity.applicantId, lifecycleStage: identity.lifecycleStage, requirement: identity.requirement, result: "SENT", correctlyBound: true, operationId });

assert.equal(context.applicantReviewLifecycleProjection_(identity).bucketKey, "DOCUMENTS_FOLLOW_UP");
assert.equal(context.applicantReviewLifecycleProjection_({ ...identity, communicationEvents: [event("a")] }).bucketKey, "PENDING_APPLICANT_RESPONSE");
assert.equal(context.applicantReviewLifecycleProjection_({ ...identity, communicationEvents: [event("a"), event("b"), event("c")] }).bucketKey, "HELD_ABEYANCE_NO_RESPONSE");
assert.equal(context.applicantReviewLifecycleProjection_({ ...identity, communicationEvents: [event("a"), event("a"), { ...event("x"), result: "DRAFT" }, { ...event("y"), correctlyBound: false }] }).qualifyingFollowupCount, 1, "duplicate retries, drafts, and unbound events must not count");
assert.equal(context.applicantReviewLifecycleProjection_({ ...identity, requirement: "School report", communicationEvents: [event("a"), event("b"), event("c")] }).bucketKey, "DOCUMENTS_FOLLOW_UP", "a newly discovered requirement has its own cycle");
assert.equal(context.applicantReviewLifecycleProjection_({ ...identity, communicationEvents: [event("a"), event("b"), event("c")], documentsIncomplete: true }).bucketKey, "HELD_ABEYANCE_NO_RESPONSE", "a partial response does not reset an exhausted same requirement");
assert.equal(context.applicantReviewLifecycleProjection_({ ...identity, documentsIncomplete: false, documentsReceived: true, documentsVerified: false }).bucketKey, "DOCUMENTS_ASSESSMENT", "a valid upload returns to substantive document assessment");
assert.equal(context.applicantReviewLifecycleProjection_({ ...identity, uncontactable: true, communicationEvents: [event("a")] }).bucketKey, "LOST_UNCONTACTABLE", "uncontactable cases cannot enter a pending-contact bucket");
assert.equal(context.applicantReviewLifecycleProjection_({ ...identity, integrityException: true }).bucketKey, "DATA_INTEGRITY_EXCEPTION");
assert.equal(context.applicantReviewLifecycleProjection_({ ...identity, closed: true }).bucketKey, "CLOSED_OUTCOME");

const buckets = [
  context.applicantReviewLifecycleProjection_(identity),
  context.applicantReviewLifecycleProjection_({ ...identity, communicationEvents: [event("a")] }),
  context.applicantReviewLifecycleProjection_({ ...identity, closed: true })
];
assert.equal(buckets.filter(row => row.bucketKey).length, buckets.length, "every record must reconcile to one primary bucket or closed outcome");
let reconciliation = context.applicantReviewLifecycleReconciliationEmpty_();
buckets.forEach(row => { reconciliation = context.applicantReviewLifecycleReconcile_(reconciliation, { reviewBucketKey: row.bucketKey, applicantId: "fixture" }); });
assert.equal(reconciliation.totalRows, reconciliation.activeRows + reconciliation.closedRows, "active and closed counts must reconcile to the mapped population");
assert.equal(reconciliation.unmappedRows, 0);
assert.ok(context.compareActionabilityPreviewRows_({ urgencyLevel: "NORMAL", reviewBucketKey: "READY_FOR_DECISION", ageDays: 1 }, { urgencyLevel: "OVERDUE", reviewBucketKey: "DOCUMENTS_FOLLOW_UP", ageDays: 10 }) > 0, "overdue work must sort before ready decisions");
assert.match(canonicalSource, /reviewBucketKey:[\s\S]*reviewBucketLabel:[\s\S]*reviewRequirement:[\s\S]*reviewWaitingOn:/, "canonical population projection must preserve the review lifecycle fields");
assert.match(uiSource, /reviewBucketLabel \|\| row\.worklistLabel/, "worklist UI must prefer the review lifecycle bucket");
assert.match(uiSource, /Why this is in this queue:[\s\S]*Source evidence:/, "worklist UI must show queue reason and governing evidence");
console.log("PASS R412A applicant review lifecycle and follow-up controls");
