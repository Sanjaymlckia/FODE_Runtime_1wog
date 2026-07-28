const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("Admin_AcademicAuthority.js", "utf8");
const reviewStatusSource = fs.readFileSync("Admin_ReviewStatusAuthority.js", "utf8");
const adminSource = fs.readFileSync("Admin.js", "utf8");
const context = {
  CONFIG: {
    PORTAL_SUBJECTS: ["English", "Mathematics", "Science"],
    DOC_FIELDS: [
      { file: "Birth_ID_Passport_File", status: "Birth_ID_Status", required: true },
      { file: "Latest_School_Report_File", status: "Report_Status", required: true },
      { file: "Passport_Photo_File", status: "Photo_Status", required: true },
      { file: "Transfer_Certificate_File", status: "Transfer_Status", required: false }
    ]
  },
  Utilities: {
    DigestAlgorithm: { SHA_256: "SHA_256" },
    Charset: { UTF_8: "UTF_8" },
    computeDigest: (_algorithm, value) => Array.from(Buffer.from(String(value), "utf8").subarray(0, 32)),
    base64EncodeWebSafe: (bytes) => Buffer.from(bytes).toString("base64url")
  }
};
vm.createContext(context);
vm.runInContext(source, context);

const verifiedRow = {
  ApplicantID: "FODE-26-TEST",
  Grade_Applying_For: "Grade 10",
  Subjects_Selected_Canonical: "English, Mathematics",
  Birth_ID_Status: "Verified",
  Report_Status: "Verified",
  Photo_Status: "Verified"
};
const unconfirmed = context.resolveFodeRegistryAuthority_(verifiedRow, null);
assert.equal(unconfirmed.state, "UNCONFIRMED");
assert.deepEqual(Array.from(unconfirmed.confirmedSubjects), ["English", "Mathematics"]);
const confirmed = context.resolveFodeRegistryAuthority_(verifiedRow, {
  state: "CONFIRMED",
  sourceFingerprint: unconfirmed.sourceFingerprint,
  confirmedBy: "registrar@example.test",
  confirmedAt: "2026-07-24T00:00:00.000Z",
  evidenceSource: "Verified application documents"
});
assert.equal(confirmed.state, "CONFIRMED");
assert.equal(confirmed.subjectEvidence.confirmedBy, "registrar@example.test");

const unverifiedRegistry = Object.assign({}, confirmed, {
  documentVerification: { verified: false, state: "INCOMPLETE" }
});

const uncheckedOptional = context.fodeRegistryDocumentAuthority_(Object.assign({}, verifiedRow, {
  Transfer_Certificate_File: "https://drive.example.test/transfer",
  Transfer_Status: "Pending Review"
}));
assert.equal(uncheckedOptional.verified, false, "Every submitted document must be checked, including an optional document that was supplied");
assert.deepEqual(Array.from(uncheckedOptional.uncheckedSubmittedDocuments), ["Transfer_Certificate_File"]);

const completeScores = {
  available: true,
  sourceField: "FODE_Assessment_Evidence_JSON",
  value: {
    subjects: {
      English: [70, 71, 72, 73, 74, 75],
      Mathematics: [80, 81, 82, 83, 84, 85]
    }
  }
};
const normalizedAssessments = context.fodeNormalizeAssessmentIngestion_(completeScores.value, confirmed.confirmedSubjects);
assert.deepEqual(Object.keys(normalizedAssessments.subjects), ["English", "Mathematics"]);
assert.throws(
  () => context.fodeNormalizeAssessmentIngestion_({ subjects: { English: [70, 70, 70, 70, 70, 70], Science: [70, 70, 70, 70, 70, 70] } }, confirmed.confirmedSubjects),
  /ASSESSMENT_SUBJECT_NOT_REGISTERED/
);
assert.deepEqual(Array.from(context.fodeNormalizeAttemptIngestion_([])), [], "A verified empty attempt history is valid evidence");
assert.throws(() => context.fodeNormalizeAttemptIngestion_(["not-a-date"]), /EXAM_ATTEMPT_DATE_INVALID/);
assert.deepEqual(
  Object.assign({}, context.fodeNormalizeTimelineIngestion_({ configured: true, satisfied: false, missedDeadline: true, nextExamWindow: "2027-W1", windowReference: "Calendar 2027" })),
  { configured: true, satisfied: false, missedDeadline: true, nextExamWindow: "2027-W1", windowReference: "Calendar 2027" }
);
assert.throws(() => context.fodeNormalizeTimelineIngestion_({ configured: false }), /EXAM_WINDOW_CONFIGURATION_REQUIRED/);

const storedAcademicEvidence = {
  assessments: { value: completeScores.value, evidenceSource: "Assessment register", confirmedBy: "registrar@example.test", confirmedAt: "2026-07-24T00:00:00.000Z" },
  attempts: { value: [], evidenceSource: "Exam attempt register", confirmedBy: "registrar@example.test", confirmedAt: "2026-07-24T00:00:00.000Z" },
  timeline: { value: { configured: true, satisfied: true, missedDeadline: false, nextExamWindow: "2026-W2", windowReference: "Calendar 2026" }, evidenceSource: "Exam calendar", confirmedBy: "registrar@example.test", confirmedAt: "2026-07-24T00:00:00.000Z" }
};
const assessmentAuthority = context.fodeAssessmentEvidenceFromRow_({}, storedAcademicEvidence);
const attemptAuthority = context.fodeAttemptEvidenceFromRow_({}, storedAcademicEvidence);
const timelineAuthority = context.fodeTimelineEvidenceFromRow_({}, storedAcademicEvidence);
assert.equal(assessmentAuthority.sourceField, "FODE_ACADEMIC_EVIDENCE_V1");
assert.equal(attemptAuthority.available, true);
assert.equal(timelineAuthority.configured, true);
const now = new Date("2026-07-24T00:00:00.000Z");

const eligibleAttempts = Object.assign({}, attemptAuthority, {
  value: ["2025-08-01T00:00:00.000Z", "2026-01-01T00:00:00.000Z", "2026-04-01T00:00:00.000Z"]
});
const eligible = context.resolveFodeExamEligibility_(confirmed, assessmentAuthority, timelineAuthority, eligibleAttempts, now);
assert.equal(eligible.state, "ELIGIBLE");
assert.equal(eligible.policy.assessmentsPerSubject, 6);
assert.equal(eligible.policy.minimumScoreEach, 70);
assert.equal(eligible.policy.averagingAllowed, false);
assert.equal(eligible.policy.maximumAttempts, 4);
assert.equal(eligible.policy.attemptWindowYears, 2);

const unverifiedDocuments = context.resolveFodeExamEligibility_(unverifiedRegistry, assessmentAuthority, timelineAuthority, attemptAuthority, now);
assert.equal(unverifiedDocuments.state, "REVIEW_REQUIRED");
assert.equal(unverifiedDocuments.reasons.includes("DOCUMENT_VERIFICATION_INCOMPLETE"), true);

const missingAttemptHistory = context.resolveFodeExamEligibility_(confirmed, assessmentAuthority, timelineAuthority, {
  available: false,
  sourceField: "",
  value: null,
  reasonCode: "ATTEMPT_EVIDENCE_MISSING"
}, now);
assert.equal(missingAttemptHistory.state, "REVIEW_REQUIRED");
assert.equal(missingAttemptHistory.reasons.includes("ATTEMPT_EVIDENCE_MISSING"), true);

const invalidAttemptHistory = context.resolveFodeExamEligibility_(confirmed, assessmentAuthority, timelineAuthority, {
  available: true,
  sourceField: "FODE_ACADEMIC_EVIDENCE_V1",
  evidenceSource: "Exam attempt register",
  confirmedBy: "registrar@example.test",
  confirmedAt: "2026-07-24T00:00:00.000Z",
  value: ["not-a-date"]
}, now);
assert.equal(invalidAttemptHistory.state, "REVIEW_REQUIRED");
assert.equal(invalidAttemptHistory.reasons.includes("ATTEMPT_EVIDENCE_INVALID"), true);

assert.equal(context.fodeAttemptEvidenceFromRow_({}).available, false);
assert.equal(context.fodeAttemptEvidenceFromRow_({ FODE_Exam_Attempts_JSON: "not-json" }).reasonCode, "ATTEMPT_EVIDENCE_MALFORMED");
assert.equal(context.fodeAttemptEvidenceFromRow_({ FODE_Exam_Attempts_JSON: "[]" }).available, false, "Legacy attempt JSON cannot become authoritative without ingestion");
assert.equal(context.fodeAttemptEvidenceFromRow_({ FODE_Exam_Attempts_JSON: "[]" }).reasonCode, "ATTEMPT_EVIDENCE_INGESTION_REQUIRED");
assert.equal(context.fodeTimelineEvidenceFromRow_({ FODE_Exam_Timeline_JSON: JSON.stringify({ configured: true }) }).reasonCode, "EXAM_TIMELINE_INGESTION_REQUIRED");
assert.equal(context.fodeAssessmentEvidenceFromRow_({ FODE_Assessment_Evidence_JSON: JSON.stringify(completeScores.value) }).reasonCode, "ASSESSMENT_EVIDENCE_INGESTION_REQUIRED");

const belowThreshold = JSON.parse(JSON.stringify(assessmentAuthority));
belowThreshold.value.subjects.English[0] = 69;
const failed = context.resolveFodeExamEligibility_(confirmed, belowThreshold, timelineAuthority, attemptAuthority, now);
assert.equal(failed.state, "NOT_ELIGIBLE");
assert.equal(failed.reasons.includes("ASSESSMENT_BELOW_70"), true);
assert.equal(failed.failedAssessments.length, 1, "One failed assessment cannot be compensated by higher scores");

const incomplete = JSON.parse(JSON.stringify(assessmentAuthority));
incomplete.value.subjects.Mathematics = [90, 90, 90, 90, 90];
const review = context.resolveFodeExamEligibility_(confirmed, incomplete, timelineAuthority, attemptAuthority, now);
assert.equal(review.state, "REVIEW_REQUIRED");
assert.equal(review.reasons.includes("ASSESSMENT_EVIDENCE_INCOMPLETE"), true);

const fraudRegistry = Object.assign({}, confirmed, { fraudStatus: "CONFIRMED" });
const fraud = context.resolveFodeExamEligibility_(fraudRegistry, assessmentAuthority, timelineAuthority, attemptAuthority, now);
assert.equal(fraud.state, "NOT_ELIGIBLE");
assert.equal(fraud.reasons.includes("CONFIRMED_DOCUMENT_FRAUD"), true);

const policyRequired = context.resolveFodeExamEligibility_(confirmed, assessmentAuthority, { configured: false }, attemptAuthority, now);
assert.equal(policyRequired.state, "POLICY_REQUIRED");

const deferredTimeline = Object.assign({}, timelineAuthority, {
  satisfied: false,
  missedDeadline: true,
  nextExamWindow: "2027-W1"
});
const deferred = context.resolveFodeExamEligibility_(confirmed, assessmentAuthority, deferredTimeline, attemptAuthority, now);
assert.equal(deferred.state, "REVIEW_REQUIRED");
assert.equal(deferred.reasons.includes("DEFERRED_TO_NEXT_EXAM_WINDOW"), true);

const attemptLimitAuthority = Object.assign({}, attemptAuthority, {
  value: [
    "2025-01-01T00:00:00.000Z",
    "2025-06-01T00:00:00.000Z",
    "2026-01-01T00:00:00.000Z",
    "2026-06-01T00:00:00.000Z"
  ]
});
const attemptLimit = context.resolveFodeExamEligibility_(confirmed, assessmentAuthority, timelineAuthority, attemptLimitAuthority, now);
assert.equal(attemptLimit.state, "NOT_ELIGIBLE");
assert.equal(attemptLimit.reasons.includes("MAXIMUM_ATTEMPTS_WITHIN_TWO_YEARS_REACHED"), true);

assert.doesNotMatch(source, /average|compensationAllowed\s*:\s*true/i);
assert.doesNotMatch(source, /three\s*\(\s*3\s*\)\s*attempt|maximumAttempts\s*:\s*3/i);
assert.doesNotMatch(source, /tablet|K1000|full package/i);
assert.match(source, /FODE_AUTHORITY_STATE_MAX_RECORDS\s*=\s*600/, "Durable authority overlay must be record-bounded");
assert.match(source, /fodeWriteAuthorityReceipt_[\s\S]*CacheService\.getUserCache\(\)\.put/, "Idempotency receipts must use the bounded six-hour cache");
assert.match(source, /function admin_confirmFodeRegistry[\s\S]*fodeWithAuthorityLock_[\s\S]*fodeReadAuthorityReceipt_/, "Registry mutation must be locked and idempotent");
assert.match(source, /function admin_confirmFodeRegistry[\s\S]*fodeWithAuthorityLock_[\s\S]*fodeRevalidateMutationActor_\(actor,\s*"CAN_MANAGE_REGISTRY"\)/, "Registry capability must be revalidated inside the mutation lock");
assert.match(source, /function admin_previewFodeAcademicEvidenceIngestion[\s\S]*ASSESSMENT_RESULTS[\s\S]*EXAM_ATTEMPTS[\s\S]*EXAM_TIMELINE/, "Academic ingestion must cover all three authoritative evidence types");
assert.match(source, /function admin_confirmFodeAcademicEvidenceIngestion[\s\S]*fodeWithAuthorityLock_[\s\S]*fodeRevalidateMutationActor_[\s\S]*FODE_ACADEMIC_EVIDENCE_CONFIRMED/, "Academic ingestion confirmation must be capability-revalidated, locked, durable, and audited");
assert.match(reviewStatusSource, /fodeEnsureFraudTerminationCase_\(prospectiveRow,[\s\S]*"PENDING_FRAUD_CONFIRMATION"[\s\S]*fodeEnsureFraudTerminationCase_\(finalRowObj,[\s\S]*"PORTAL_ACCESS_TERMINATION_REQUIRED"/, "Document review must establish and finalize the durable fraud termination case");
assert.match(adminSource, /finalStatus === "Fraudulent"[\s\S]*fodeEnsureFraudTerminationCase_\(prospectiveFraudRow,[\s\S]*"PENDING_FRAUD_CONFIRMATION"[\s\S]*fodeEnsureFraudTerminationCase_\(getRowObject_\(sh, rowNumber\)[\s\S]*"PORTAL_ACCESS_TERMINATION_REQUIRED"/, "Overall fraud confirmation must establish and finalize the durable termination case");

const authorityStates = {};
let authorityWrites = 0;
context.fodeReadAuthorityState_ = (domain, applicantId) => authorityStates[`${domain}:${applicantId}`] || null;
context.fodeWriteAuthorityState_ = (domain, applicantId, state) => {
  authorityWrites++;
  authorityStates[`${domain}:${applicantId}`] = Object.assign({ applicantId }, state);
  return authorityStates[`${domain}:${applicantId}`];
};
const fraudRow = Object.assign({}, verifiedRow, { Birth_ID_Status: "Fraudulent" });
const fraudCase = context.fodeEnsureFraudTerminationCaseLocked_(fraudRow, {
  email: "super@example.test",
  role: "SUPER"
}, "PORTAL_ACCESS_TERMINATION_REQUIRED", false);
assert.equal(fraudCase.state, "PORTAL_ACCESS_TERMINATION_REQUIRED");
assert.equal(fraudCase.portalAccessMutationPerformed, false);
assert.equal(authorityStates["PORTAL_TERMINATION:FODE-26-TEST"].fraudStatus, "CONFIRMED");
context.fodeEnsureFraudTerminationCaseLocked_(fraudRow, {
  email: "super@example.test",
  role: "SUPER"
}, "PORTAL_ACCESS_TERMINATION_REQUIRED", false);
assert.equal(authorityWrites, 1, "Durable fraud termination case creation must be idempotent");

const durableProperties = {};
context.fodeAuthorityStateStore_ = () => ({
  getProperty: (key) => Object.prototype.hasOwnProperty.call(durableProperties, key) ? durableProperties[key] : null,
  setProperty: (key, value) => { durableProperties[key] = value; },
  deleteProperty: (key) => { delete durableProperties[key]; },
  getProperties: () => Object.assign({}, durableProperties)
});
context.logAudit_ = () => {};
const durable = context.fodeWriteDurableReceipt_(
  "PORTAL_ACTION",
  "portal-idempotency-1",
  "context-fingerprint",
  "COMPLETED",
  { applicantId: "FODE-26-TEST", action: "DEACTIVATE", accessState: "INACTIVE" },
  { email: "super@example.test", role: "SUPER" },
  "FODE_PORTAL_ACTION_RECEIPT_COMPLETED"
);
assert.equal(durable.status, "COMPLETED");
assert.equal(context.fodeReadDurableReceipt_("PORTAL_ACTION", "portal-idempotency-1", "context-fingerprint").result.action, "DEACTIVATE");
assert.throws(() => context.fodeReadDurableReceipt_("PORTAL_ACTION", "portal-idempotency-1", "different-context"), /IDEMPOTENCY_CONTEXT_MISMATCH/);

console.log("PASS Registry confirmation requires grade, subjects, evidence source, actor, time, and source fingerprint");
console.log("PASS exam policy fails closed on documents and attempt evidence while enforcing six assessments, 70 percent each, no averaging, four attempts within two years, and deadline deferral");
console.log("PASS confirmed fraud creates one durable portal termination case without mutating portal access");
console.log("PASS academic evidence ingestion is authoritative, versioned, and fail closed");
console.log("PASS portal action receipts use a durable audited ledger");
