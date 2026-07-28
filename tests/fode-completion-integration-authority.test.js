const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("Admin_OperationalIntegrationAuthority.js", "utf8");
const context = {
  fodeAuthorityClean_: (value) => String(value == null ? "" : value).trim(),
  fodeAuthorityUpper_: (value) => String(value == null ? "" : value).trim().toUpperCase(),
  fodeAuthorityUnique_: (values) => Array.from(new Set((values || []).map((value) => String(value).trim()).filter(Boolean))),
  fodeAuthorityJson_: (value, fallback) => {
    if (value && typeof value === "object") return value;
    try { return value ? JSON.parse(value) : fallback; } catch { return fallback; }
  },
  fodeAuthorityFingerprint_: (value) => JSON.stringify(value),
  isCanonicalPaymentVerified_: (row) => String(row.Payment_Verified || "").toUpperCase() === "YES"
};
vm.createContext(context);
vm.runInContext(source, context);

context.buildCanonicalPopulationRow_ = () => ({
  finance: {
    financeAuthority: { state: "REVIEW_REQUIRED" },
    exceptions: { financeExceptionCode: "AMOUNT_MISMATCH" },
    objects: { contactId: "contact-1" },
    amounts: { expected: 100, paid: 80 }
  }
});
const canonicalFinance = context.fodeCanonicalFinanceForContext_({
  applicantId: "FODE-26-FINANCE",
  rowNumber: 10,
  rowObj: { ApplicantID: "FODE-26-FINANCE" },
  sheet: { getName: () => "FODE_Applications" }
});
assert.equal(canonicalFinance.dto.financeAuthority.state, "REVIEW_REQUIRED");
assert.equal(canonicalFinance.dto.exceptions.financeExceptionCode, "AMOUNT_MISMATCH");

const portal = context.fodePortalStatusProjection_({
  ApplicantID: "FODE-26-PORTAL",
  Portal_Access_Status: "Open",
  PortalLastUpdateAt: "2026-07-24T01:00:00.000Z"
}, {
  ok: true,
  applicantId: "FODE-26-PORTAL",
  status: "ACTIVE",
  issuedAt: "2026-07-20T00:00:00.000Z",
  secretPlain: "must-not-leak",
  portalUrl: "https://example.test/?secret=must-not-leak"
});
assert.equal(portal.tokenState, "ACTIVE");
assert.equal(portal.available, true);
assert.equal(Object.prototype.hasOwnProperty.call(portal, "secretPlain"), false);
assert.equal(Object.prototype.hasOwnProperty.call(portal, "portalUrl"), false);
assert.doesNotMatch(JSON.stringify(portal), /must-not-leak/);

const terminationRequired = context.fodeApplyPortalTerminationAuthority_(Object.assign({}, portal), {
  state: "PORTAL_ACCESS_TERMINATION_REQUIRED",
  fraudSourceFingerprint: "fraud-fingerprint"
});
assert.equal(terminationRequired.available, false);
assert.equal(terminationRequired.accessState, "PORTAL_ACCESS_TERMINATION_REQUIRED");
assert.deepEqual(Array.from(terminationRequired.availableActions), ["DEACTIVATE"]);
const missingAuthorityTermination = context.fodeApplyPortalTerminationAuthority_({
  tokenState: "MISSING",
  available: false,
  availableActions: ["CREATE"]
}, {
  state: "PORTAL_ACCESS_TERMINATION_REQUIRED",
  fraudSourceFingerprint: "fraud-fingerprint"
});
assert.deepEqual(Array.from(missingAuthorityTermination.availableActions), ["DEACTIVATE"], "An explicit no-authority deactivation must be able to close the mandatory case");
const terminated = context.fodeApplyPortalTerminationAuthority_(Object.assign({}, portal), {
  state: "PORTAL_ACCESS_TERMINATED",
  fraudSourceFingerprint: "fraud-fingerprint"
});
assert.equal(terminated.available, false);
assert.equal(terminated.accessState, "PORTAL_ACCESS_TERMINATED");
assert.deepEqual(Array.from(terminated.availableActions), []);
assert.notEqual(
  context.fodePortalActionSourceFingerprint_({ applicantId: "FODE-26-PORTAL", status: "ACTIVE", found: true, rowIndex: 2 }, null),
  context.fodePortalActionSourceFingerprint_({ applicantId: "FODE-26-PORTAL", status: "ACTIVE", found: true, rowIndex: 2 }, { state: "PORTAL_ACCESS_TERMINATION_REQUIRED", fraudSourceFingerprint: "fraud-fingerprint" }),
  "Fraud termination authority must invalidate an existing portal preview"
);

assert.equal(context.fodeFinancePolicyKind_("refund"), "REFUND");
assert.equal(context.fodeFinancePolicyKind_("credit"), "CREDIT");
assert.equal(context.fodeFinancePolicyKind_("adjustment"), "ADJUSTMENT");
assert.equal(context.fodeFinanceTransitionAllowed_("REQUESTED", "UNDER_REVIEW"), true);
assert.equal(context.fodeFinanceTransitionAllowed_("UNDER_REVIEW", "APPROVED"), true);
assert.equal(context.fodeFinanceTransitionAllowed_("APPROVED", "HANDED_TO_ZOHO"), true);
assert.equal(context.fodeFinanceTransitionAllowed_("HANDED_TO_ZOHO", "COMPLETED_EXTERNALLY"), true);
assert.equal(context.fodeFinanceTransitionAllowed_("POLICY_REQUIRED", "APPROVED"), false);
context.canonicalFinanceApplicantName_ = (row) => `${row.First_Name || ""} ${row.Last_Name || ""}`.trim();
context.canonicalFinanceTestRecordProjection_ = (_row, applicantId) => ({
  isTestRecord: applicantId === "FODE-26-TEST-001",
  source: "Governed fixture ApplicantID convention"
});
const handoffIdentity = context.fodeFinanceHandoffProjection_({
  applicantId: "FODE-26-TEST-001",
  rowNumber: 10,
  rowObj: { ApplicantID: "FODE-26-TEST-001", First_Name: "Test", Last_Name: "Student" },
  sheet: { getName: () => "FODE_Applications" }
}, {
  state: "UNDER_REVIEW",
  caseKind: "FINANCE_EXCEPTION",
  evidenceReference: "case-evidence"
});
assert.equal(handoffIdentity.applicantName, "Test Student");
assert.equal(handoffIdentity.applicantId, "FODE-26-TEST-001");
assert.equal(handoffIdentity.testRecord, true);
assert.equal(handoffIdentity.evidenceReference, "case-evidence");

const registry = {
  state: "CONFIRMED",
  fraudStatus: "NOT_CONFIRMED",
  confirmedGrade: "Grade 10",
  confirmedSubjects: ["English", "Mathematics"],
  documentVerification: { verified: true, state: "VERIFIED" }
};
const normalizedMappings = context.fodeNormalizeClassroomMappings_({
  english: "course-english",
  mathematics: "course-maths"
}, registry.confirmedSubjects);
assert.deepEqual(Object.assign({}, normalizedMappings), { English: "course-english", Mathematics: "course-maths" });
assert.throws(
  () => context.fodeNormalizeClassroomMappings_({ English: "course-english", Science: "course-science" }, registry.confirmedSubjects),
  /CLASSROOM_MAPPING_SUBJECT_NOT_REGISTERED/
);
const storedMapping = context.fodeClassroomMappingAuthority_({}, {
  state: "CONFIRMED",
  mappings: { English: "course-english", Mathematics: "course-maths" },
  evidenceSource: "Classroom register",
  confirmedBy: "principal@example.test",
  confirmedAt: "2026-07-24T00:00:00.000Z"
});
assert.equal(storedMapping.available, true);
assert.equal(storedMapping.sourceField, "FODE_CLASSROOM_MAPPING_V1");
const ready = context.fodeClassroomReadinessProjection_({
  applicantId: "FODE-26-CLASSROOM",
  rowObj: {
    Registration_Complete: "Yes",
    Payment_Verified: "Yes"
  }
}, registry, null, {
  state: "CONFIRMED",
  mappings: { English: "course-english", Mathematics: "course-maths" },
  evidenceSource: "Classroom register",
  confirmedBy: "principal@example.test",
  confirmedAt: "2026-07-24T00:00:00.000Z"
});
assert.equal(ready.state, "READY");
assert.equal(ready.externalWritePerformed, false);

const legacyMapping = context.fodeClassroomReadinessProjection_({
  applicantId: "FODE-26-CLASSROOM",
  rowObj: {
    Registration_Complete: "Yes",
    Payment_Verified: "Yes",
    FODE_Classroom_Subject_Mapping_JSON: JSON.stringify({ English: "course-english", Mathematics: "course-maths" })
  }
}, registry, null);
assert.equal(legacyMapping.state, "REVIEW_REQUIRED");
assert.equal(legacyMapping.mappingAuthority.available, false);
assert.equal(legacyMapping.missingRequirements.includes("CLASSROOM_MAPPING_INGESTION_REQUIRED"), true);

const mappingMissing = context.fodeClassroomReadinessProjection_({
  applicantId: "FODE-26-CLASSROOM",
  rowObj: { Registration_Complete: "Yes", Payment_Verified: "Yes" }
}, registry, null);
assert.equal(mappingMissing.state, "NOT_READY");
assert.equal(mappingMissing.missingRequirements.includes("SUBJECT_MAPPING_MISSING"), true);

const documentReview = context.fodeClassroomReadinessProjection_({
  applicantId: "FODE-26-CLASSROOM",
  rowObj: {
    Registration_Complete: "Yes",
    Payment_Verified: "Yes"
  }
}, Object.assign({}, registry, { documentVerification: { verified: false, state: "INCOMPLETE" } }), null, {
  state: "CONFIRMED",
  mappings: { English: "course-english", Mathematics: "course-maths" },
  evidenceSource: "Classroom register",
  confirmedBy: "principal@example.test",
  confirmedAt: "2026-07-24T00:00:00.000Z"
});
assert.equal(documentReview.state, "REVIEW_REQUIRED");

const registryReview = context.fodeClassroomReadinessProjection_({
  applicantId: "FODE-26-CLASSROOM",
  rowObj: {
    Registration_Complete: "Yes",
    Payment_Verified: "Yes"
  }
}, Object.assign({}, registry, {
  state: "UNCONFIRMED",
  documentVerification: { verified: true, state: "VERIFIED" }
}), null, {
  state: "CONFIRMED",
  mappings: { English: "course-english", Mathematics: "course-maths" },
  evidenceSource: "Classroom register",
  confirmedBy: "principal@example.test",
  confirmedAt: "2026-07-24T00:00:00.000Z"
});
assert.equal(registryReview.state, "REVIEW_REQUIRED");
assert.equal(registryReview.missingRequirements.includes("REGISTRY_SUBJECT_EVIDENCE_UNCONFIRMED"), true);

const gmailAccepted = context.resolveFodeDeliveryState_({
  ApplicantID: "FODE-26-MAIL",
  Last_Delivery_Status: "GMAIL_ACCEPTED"
});
assert.equal(gmailAccepted.state, "GMAIL_ACCEPTED");
assert.match(gmailAccepted.claim, /delivery is not proven/i);
const bounced = context.resolveFodeDeliveryState_({
  ApplicantID: "FODE-26-MAIL",
  Email_Bounce_Flag: "Yes",
  Bounce_Reason: "550 mailbox unavailable"
});
assert.equal(bounced.state, "BOUNCED");
const uncertain = context.resolveFodeDeliveryState_({
  ApplicantID: "FODE-26-MAIL",
  Last_Delivery_Status: "RECONCILIATION_REQUIRED"
});
assert.equal(uncertain.state, "RECONCILIATION_REQUIRED");

for (const fn of [
  "admin_getFodePortalStatus",
  "admin_getFodePortalStatusWorklist",
  "admin_getFodeFraudReconciliationQueue",
  "admin_getFodePortalActionReconciliationQueue",
  "admin_previewFodePortalAccessAction",
  "admin_executeFodePortalAccessAction",
  "admin_getFodeFinanceExceptionApplicant",
  "admin_previewFodeFinanceHandoff",
  "admin_executeFodeFinanceHandoff",
  "admin_getFodeClassroomReadiness",
  "admin_getFodeClassroomReadinessWorklist",
  "admin_previewFodeClassroomSubjectMapping",
  "admin_confirmFodeClassroomSubjectMapping",
  "admin_previewFodeClassroomHandoff",
  "admin_executeFodeClassroomHandoff",
  "admin_getFodeDeliveryHistory",
  "admin_getFodeManagementSummary",
  "admin_getFodeAssignmentsAndApprovals",
  "admin_getFodeDataQuality",
  "admin_getFodeSystemHealth",
  "admin_getFodeAuditProjection"
]) {
  const index = source.indexOf(`function ${fn}`);
  assert.notEqual(index, -1, `${fn} must exist`);
  const body = source.slice(index, source.indexOf("\n}", index) + 2);
  assert.match(body, /fodeAuthorityActor(?:All)?_\(/, `${fn} must check server capability authority before returning protected data`);
}

assert.doesNotMatch(source, /UrlFetchApp|GmailApp|MailApp|admin_createZohoBooksFodeDraftInvoice|admin_notifyOpsClassroomAdmin|Classroom\./, "Completion authority module must contain no Zoho, Gmail, or Classroom external mutation path");
assert.doesNotMatch(source, /K1000|tablet|full package/i, "Retired package and tablet rules must not enter active authority");
assert.match(source, /refunds:\s*"POLICY_REQUIRED"[\s\S]*credits:\s*"POLICY_REQUIRED"[\s\S]*adjustments:\s*"POLICY_REQUIRED"/);
assert.match(source, /admin_getFodeDataQuality[\s\S]*canonicalFinanceReconciliationForRow_/, "Data Quality must include canonical Finance reconciliation findings");
assert.match(source, /admin_getFodeAuditProjection[\s\S]*TEMP_CAPABILITY_GRANT_CREATED[\s\S]*FODE_REGISTRY_CONFIRMED[\s\S]*FODE_FINANCE_HANDOFF_STATE_CHANGED[\s\S]*FODE_CLASSROOM_HANDOFF_STATE_CHANGED/, "Management audit must project grants, Registry, Finance, and Classroom events");
for (const fn of [
  "admin_previewFodePortalAccessAction",
  "admin_previewFodeFinanceHandoff",
  "admin_previewFodeClassroomHandoff"
]) {
  const index = source.indexOf(`function ${fn}`);
  const body = source.slice(index, source.indexOf("\n}", index) + 2);
  assert.match(body, /IDEMPOTENCY_KEY_REQUIRED/, `${fn} must require an idempotency key`);
}
for (const fn of [
  "admin_executeFodePortalAccessAction",
  "admin_executeFodeFinanceHandoff",
  "admin_executeFodeClassroomHandoff"
]) {
  const index = source.indexOf(`function ${fn}`);
  const body = source.slice(index, source.indexOf("\n}", index) + 2);
  assert.match(body, /fodeWithAuthorityLock_/, `${fn} must execute under the shared authority lock`);
  if (fn === "admin_executeFodePortalAccessAction") {
    assert.match(body, /fodeReadDurableReceipt_/, `${fn} must recover its durable idempotent receipt`);
  } else {
    assert.match(body, /fodeReadAuthorityReceipt_/, `${fn} must recover an existing idempotent receipt`);
  }
  assert.match(body, /fodeRevalidateMutationActor_/, `${fn} must revalidate capability authority inside the mutation lock`);
}
assert.match(source, /function admin_executeFodePortalAccessAction[\s\S]*AUTHORIZED_PENDING_EXECUTION[\s\S]*PORTAL_ACTION_RECONCILIATION_REQUIRED/, "Portal actions must persist an authorized-pending reconciliation boundary before mutation");
assert.match(source, /function admin_executeFodePortalAccessAction[\s\S]*fodeReadDurableReceipt_\("PORTAL_ACTION"[\s\S]*fodeWriteDurableReceipt_[\s\S]*"PENDING"[\s\S]*fodeWriteDurableReceipt_[\s\S]*"COMPLETED"/, "Portal mutations must use the durable receipt ledger before and after execution");
assert.match(source, /function admin_executeFodePortalAccessAction[\s\S]*fodeWriteAuthorityState_\("PORTAL_ACTION"[\s\S]*portalAccessMutationPerformed:\s*false[\s\S]*fodeWriteAuthorityState_\("PORTAL_ACTION"[\s\S]*portalAccessMutationPerformed:\s*true/, "Portal action completion must be recorded durably without storing a secret");
assert.match(source, /function admin_getFodeAssignmentsAndApprovals[\s\S]*fodeAuthorityStateIndex_\("PORTAL_TERMINATION"\)[\s\S]*PORTAL_TERMINATION_CASE_MISSING/, "Management assignments must consume durable fraud termination cases and expose reconciliation gaps");
assert.match(source, /function admin_previewFodePortalAccessAction[\s\S]*PORTAL_TERMINATION_DEACTIVATION_REQUIRED[\s\S]*PORTAL_ACCESS_TERMINATED/, "Confirmed fraud must prohibit portal creation, activation, and rotation");
assert.match(source, /function admin_executeFodePortalAccessAction[\s\S]*PORTAL_ACCESS_TERMINATION_REQUIRED[\s\S]*state:\s*"PORTAL_ACCESS_TERMINATED"[\s\S]*FODE_PORTAL_ACCESS_TERMINATED/, "Explicit deactivation must durably complete the fraud termination case");
assert.match(source, /action === "DEACTIVATE" && terminationState === "PORTAL_ACCESS_TERMINATION_REQUIRED"[\s\S]*currentSecret\.found !== true[\s\S]*Portal_Access_Status:\s*preview\.action === "ACTIVATE" \? "Open" : "Locked"/, "Confirmed fraud with no secret record must still close through an explicit audited deactivation without creating a token");
assert.match(source, /function admin_getFodeManagementSummary[\s\S]*examEligibility:\s*fodeCompletionAggregate_[\s\S]*portal:\s*fodeCompletionAggregate_/, "Management Summary must include exam eligibility and portal status aggregates");
assert.match(source, /function admin_getFodePortalStatusWorklist[\s\S]*fodePortalStatusIndex_\(\)[\s\S]*FODE_PORTAL_STATUS_WORKLIST_V1/, "Portal population status must use one read-only authority index");
assert.match(source, /function admin_getFodeClassroomReadinessWorklist[\s\S]*FODE_CLASSROOM_READINESS_WORKLIST_V1/, "Classroom readiness must expose an authorized population worklist");
assert.match(source, /function admin_previewFodeClassroomSubjectMapping[\s\S]*fodeNormalizeClassroomMappings_[\s\S]*CLASSROOM_MAPPING_EVIDENCE_SOURCE_REQUIRED/, "Classroom mapping ingestion must bind only confirmed subjects to explicit evidence");
assert.match(source, /function admin_confirmFodeClassroomSubjectMapping[\s\S]*fodeWithAuthorityLock_[\s\S]*FODE_CLASSROOM_MAPPING_CONFIRMED/, "Classroom mapping confirmation must be locked, durable, and audited");
assert.match(source, /function admin_getFodeFraudReconciliationQueue[\s\S]*PENDING_FRAUD_CONFIRMATION[\s\S]*portalAdministrationBlocked:\s*true/, "Pending fraud confirmation must expose an explicit blocked reconciliation queue");
assert.match(source, /function admin_executeFodeFraudReconciliationResolution[\s\S]*fodeRevalidateMutationActorAll_[\s\S]*PORTAL_ACCESS_TERMINATION_REQUIRED[\s\S]*FRAUD_CONFIRMATION_RECONCILED_NO_FRAUD/, "Fraud reconciliation must require both authorities and resolve to an exact durable state");

console.log("PASS portal status exposes no secret or secure URL");
console.log("PASS Finance and Classroom contracts record FODE handoff state without external writes");
console.log("PASS delivery history distinguishes send, Gmail acceptance, bounce, unknown, and reconciliation states");
console.log("PASS mutation capabilities are revalidated inside locks and portal actions preserve reconciliation truth");
