const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("Admin_CanonicalPopulation.js", "utf8");
const financeSource = fs.readFileSync("Admin_CanonicalFinance.js", "utf8");

assert.doesNotMatch(source, /admin_getOpsLifecycleSummary|legacy_admin_getReviewQueues|\?view=ops/, "Canonical population foundation must not depend on OPS DTOs or routes");
assert.doesNotMatch(source, /admin_send|sendApplicantMessage_|GmailApp|MailApp|setValue\(|setValues\(|appendRow\(/, "Canonical population foundation must contain no mutation or send path");
assert.match(source, /FUTURE_REGISTRY_EXTENSION/, "Registry extension must remain explicit and unresolved");
assert.match(source, /FUTURE_CLASSROOM_EXTENSION/, "Classroom extension must remain explicit and unresolved");
assert.match(source, /FUTURE_H2_EXTENSION/, "H2 approval extension must remain explicit and unimplemented");

const values = [
  ["ApplicantID", "First_Name", "Last_Name", "Parent_Email", "Receipt_Status", "Fee_Receipt_File"],
  ["FODE-002", "Pay", "Follow", "pay@example.test", "Pending", ""],
  ["FODE-001", "Docs", "Missing", "docs@example.test", "Pending", ""],
  ["FODE-003", "Receipt", "Review", "review@example.test", "Pending", "receipt-file"]
];

function authorityRow(row, rowNumber) {
  const id = row.ApplicantID;
  if (id === "FODE-001") {
    return {
      rowNumber,
      applicantId: id,
      name: "Docs Missing",
      actionOwner: "APPLICANT",
      workloadGroupKey: "APPLICANT",
      worklistKey: "DOCUMENT_FOLLOW_UP",
      worklistLabel: "Missing Documents",
      worklistReason: "Awaiting applicant upload",
      nextAction: "UPLOAD_REQUIRED_DOCUMENTS",
      actionabilityState: "READY",
      selectable: true,
      selectBlockReason: "",
      recommendedAction: "docs_missing",
      reasonCode: "READY",
      urgencyLevel: "NORMAL",
      suppressor: "",
      recommendedMessageType: "docs_missing",
      canonicalLifecycle: { baseState: "INCOMPLETE_DOCUMENTS", lifecycleStage: "INCOMPLETE_DOCUMENTS", overlays: [], recommendedNextAction: "UPLOAD_REQUIRED_DOCUMENTS", recommendedMessageType: "docs_missing", actionOwner: "APPLICANT", reason: "Required uploads missing." },
      lifecycleMismatch: { hasLifecycleMismatch: true, legacyLifecycle: "REMINDER_DUE", canonicalBaseState: "INCOMPLETE_DOCUMENTS", canonicalOverlays: [], mismatchReason: "Legacy overlay." },
      authorityState: { lifecycleStage: "REMINDER_DUE", documentState: "ALL_REQUIRED_MISSING", requiredDocumentUploadComplete: false, uploadedRequiredDocumentCount: 0, requiredDocumentCount: 4, missingRequiredDocuments: ["Birth ID"], docsVerified: false, paymentEvidencePresent: false, paymentVerified: false, hasValidEmail: true, hasPhoneFallback: false, contactabilityState: "EMAIL_AVAILABLE" },
      sourceAuthorities: ["Canonical Lifecycle", "Actionability"]
    };
  }
  if (id === "FODE-002") {
    return {
      rowNumber,
      applicantId: id,
      name: "Pay Follow",
      actionOwner: "APPLICANT",
      workloadGroupKey: "FINANCE",
      worklistKey: "PAYMENT_FOLLOW_UP",
      worklistLabel: "Payment Follow-up",
      worklistReason: "Awaiting payment evidence",
      nextAction: "SEND_PAYMENT_REMINDER",
      actionabilityState: "READY",
      selectable: true,
      selectBlockReason: "",
      recommendedAction: "payment_followup",
      reasonCode: "READY",
      urgencyLevel: "DUE",
      suppressor: "",
      recommendedMessageType: "payment_followup",
      canonicalLifecycle: { baseState: "PAYMENT_PENDING", lifecycleStage: "PAYMENT_PENDING", overlays: [], recommendedNextAction: "SEND_PAYMENT_REMINDER", recommendedMessageType: "payment_followup", actionOwner: "APPLICANT", reason: "Payment evidence missing." },
      lifecycleMismatch: { hasLifecycleMismatch: false, legacyLifecycle: "PAYMENT_REQUIRED", canonicalBaseState: "PAYMENT_PENDING", canonicalOverlays: [], mismatchReason: "" },
      authorityState: { lifecycleStage: "PAYMENT_REQUIRED", documentState: "VERIFIED", requiredDocumentUploadComplete: true, uploadedRequiredDocumentCount: 4, requiredDocumentCount: 4, missingRequiredDocuments: [], docsVerified: true, paymentEvidencePresent: false, paymentVerified: false, hasValidEmail: true, hasPhoneFallback: false, contactabilityState: "EMAIL_AVAILABLE" },
      sourceAuthorities: ["Canonical Lifecycle", "Actionability"]
    };
  }
  return {
    rowNumber,
    applicantId: id,
    name: "Receipt Review",
    actionOwner: "FINANCE",
    workloadGroupKey: "FINANCE",
    worklistKey: "PAYMENT_REVIEW",
    worklistLabel: "Payment Review",
    worklistReason: "Receipt pending verification",
    nextAction: "VERIFY_PAYMENT",
    actionabilityState: "REVIEW_REQUIRED",
    selectable: false,
    selectBlockReason: "Finance verification is required.",
    recommendedAction: "VERIFY_PAYMENT",
    reasonCode: "FINANCE_ACTION_PENDING",
    urgencyLevel: "NORMAL",
    suppressor: "FINANCE_ACTION_PENDING",
    recommendedMessageType: "",
    canonicalLifecycle: { baseState: "PAYMENT_TO_VERIFY", lifecycleStage: "PAYMENT_TO_VERIFY", overlays: [], recommendedNextAction: "VERIFY_PAYMENT", recommendedMessageType: "", actionOwner: "FINANCE", reason: "Receipt pending verification." },
    lifecycleMismatch: { hasLifecycleMismatch: false, legacyLifecycle: "RECEIPT_AWAITING_VERIFICATION", canonicalBaseState: "PAYMENT_TO_VERIFY", canonicalOverlays: [], mismatchReason: "" },
    authorityState: { lifecycleStage: "RECEIPT_AWAITING_VERIFICATION", documentState: "VERIFIED", requiredDocumentUploadComplete: true, uploadedRequiredDocumentCount: 4, requiredDocumentCount: 4, missingRequiredDocuments: [], docsVerified: true, paymentEvidencePresent: true, paymentVerified: false, hasValidEmail: true, hasPhoneFallback: false, contactabilityState: "EMAIL_AVAILABLE" },
    sourceAuthorities: ["Canonical Lifecycle", "Actionability"]
  };
}

let reusedAuthorityRows = null;
const context = {
  console,
  Date,
  Number,
  Math,
  Object,
  Array,
  String,
  Error,
  clean_: (value) => String(value == null ? "" : value).trim(),
  populationLedgerRowObjectFromValues_(headers, rowValues) {
    return Object.fromEntries(headers.map((header, index) => [header, rowValues[index]]));
  },
  buildActionabilityPreviewRow_: authorityRow,
  compareActionabilityPreviewRows_(a, b) {
    return String(a.applicantId).localeCompare(String(b.applicantId));
  },
  stageAggregationEffectiveEmail_(row) {
    return row.Parent_Email || "";
  },
  adminRowPaymentEvidencePresent_(row) {
    const receiptFile = String(row.Fee_Receipt_File || "").trim();
    return !!receiptFile && receiptFile !== "[]" && receiptFile !== "{}";
  },
  adminRowPaymentAuthorityFacts_(row) {
    const evidence = context.adminRowPaymentEvidencePresent_(row);
    const verified = String(row.Receipt_Status || "").toLowerCase() === "verified";
    return { paymentEvidencePresent: evidence, paymentVerified: verified, paymentBadge: verified ? "Verified" : "Pending" };
  },
  canonicalPaymentBadge_: () => "Pending",
  deriveCommunicationState_(row, messageType) {
    return { base: { applicantId: row.ApplicantID, messageType } };
  },
  evaluateCommunicationAuthority_(row, messageType, base, options) {
    const canonical = options.canonicalLifecycle || {};
    const allowed = (messageType === "docs_missing" && canonical.baseState === "INCOMPLETE_DOCUMENTS")
      || (messageType === "payment_followup" && canonical.baseState === "PAYMENT_PENDING");
    return {
      ok: allowed,
      blockCode: allowed ? "" : "COMM_AUTHORITY_BLOCKED",
      blockReason: allowed ? "" : "Canonical state does not permit the requested message.",
      canonicalLifecycleAuthority: { authoritySource: allowed ? "CANONICAL_LIFECYCLE" : "LEGACY_LIFECYCLE" }
    };
  },
  buildPopulationLedgerFromValues_(data, source, options) {
    reusedAuthorityRows = options.authorityRowsByRowNumber;
    return {
      ok: true,
      generatedAt: "2026-07-13T00:00:00.000Z",
      sourceSheetName: source,
      scannedRows: data.length - 1,
      applicantIdRows: data.length - 1,
      classifiedRows: data.length - 1,
      unclassifiedRows: 0,
      duplicateApplicantIds: [],
      lifecycleCounts: { REMINDER_DUE: 1, PAYMENT_REQUIRED: 1, RECEIPT_AWAITING_VERIFICATION: 1 },
      operationalBucketCounts: { "Applicant Action": 1, Finance: 2 },
      nextActionFamilyCounts: { APPLICANT_ACTION: 2, FINANCE: 1 },
      unknownUnclassifiedCount: 0,
      integrityStatus: "PASS",
      integrityMessages: ["Population ledger reconciles."]
    };
  },
  populationLedgerPublicSummary_(ledger) {
    return { applicantIdRows: ledger.applicantIdRows, lifecycleCounts: ledger.lifecycleCounts, integrityStatus: ledger.integrityStatus };
  }
};

vm.createContext(context);
vm.runInContext(financeSource, context);
vm.runInContext(source, context);

const snapshot = context.buildCanonicalPopulationFromValues_(values, "FODE_Data", { workingViewLimit: 2, nowMs: 1 });
assert.equal(snapshot.ok, true);
assert.equal(snapshot.readOnly, true);
assert.equal(snapshot.schemaVersion, "CANONICAL_POPULATION_V1");
assert.deepEqual(Array.from(snapshot.rows, (row) => row.identity.applicantId), ["FODE-001", "FODE-002", "FODE-003"], "Canonical population ordering must be deterministic by stable Applicant ID");
assert.equal(new Set(snapshot.rows.map((row) => row.identity.applicantId)).size, snapshot.rows.length, "Fixture Applicant IDs must be unique");
assert.equal(Object.keys(reusedAuthorityRows).length, 3, "Population Ledger must reuse the already-resolved authority rows");
assert.equal(snapshot.reconciliation.status, "PASS");
assert.equal(snapshot.reconciliation.checks.workingViewIsSubset, true);
assert.equal(snapshot.reconciliation.workingView.returnedRows, 2);
assert.equal(snapshot.summary.lifecycle.INCOMPLETE_DOCUMENTS, 1);
assert.equal(snapshot.summary.lifecycle.PAYMENT_PENDING, 1);
assert.equal(snapshot.summary.lifecycle.PAYMENT_TO_VERIFY, 1);
assert.equal(snapshot.summary.finance.PAYMENT_PENDING, 2);
assert.equal(snapshot.summary.finance.PAYMENT_TO_VERIFY, 1);
const financeGroupsFromCanonicalDtos = snapshot.rows.reduce((counts, row) => {
  const state = row.finance.financeAuthority.financeState;
  counts[state] = (counts[state] || 0) + 1;
  return counts;
}, {});
assert.deepEqual(financeGroupsFromCanonicalDtos, JSON.parse(JSON.stringify(snapshot.summary.finance)), "Canonical Population Finance groups must equal CANONICAL_FINANCE_V1 row groups");
assert.equal(snapshot.rows[2].finance.schemaVersion, "CANONICAL_FINANCE_V1", "Canonical Population must carry the canonical Finance DTO, not a duplicate simplified projection");
assert.equal(snapshot.rows[2].finance.operational.recommendedFinanceAction, "VERIFY_PAYMENT");
assert.equal(snapshot.rows[2].finance.operational.paymentFollowupRecommended, false);
assert.equal(snapshot.rows[0].extensions.registry.status, "NOT_RESOLVED");
assert.equal(snapshot.rows[0].extensions.classroom.status, "NOT_RESOLVED");
assert.equal(snapshot.rows[0].extensions.approval.status, "NOT_IMPLEMENTED");

const selected = context.buildCanonicalCohort_(snapshot, {
  scope: "SELECTED",
  applicantIds: ["FODE-002", "FODE-001", "FODE-001", "FODE-404"],
  filters: { selectable: true },
  requireSelectable: true
}, {});
assert.deepEqual(Array.from(selected.requestedApplicantIds), ["FODE-002", "FODE-001", "FODE-404"], "Selected scope must de-duplicate without changing request order");
assert.deepEqual(Array.from(selected.included, (item) => item.row.identity.applicantId), ["FODE-001", "FODE-002"], "Selected cohort must contain only requested matching applicants in deterministic order");
assert.deepEqual(Array.from(selected.missingSelectedApplicantIds), ["FODE-404"]);
assert.deepEqual(Array.from(selected.scopeViolationIds), [], "Exact selected scope must never admit an unrequested applicant");

const docsCommunication = context.buildCanonicalCohort_(snapshot, {
  scope: "SELECTED",
  applicantIds: ["FODE-001", "FODE-002"],
  messageType: "docs_missing"
}, {});
assert.equal(docsCommunication.counts.included, 1);
assert.equal(docsCommunication.counts.blocked, 1);
assert.equal(docsCommunication.counts.excluded, 0);
assert.equal(docsCommunication.included[0].row.identity.applicantId, "FODE-001");
assert.equal(docsCommunication.included[0].communication.permitted, true, "Included communication cohort must agree with Communication Authority");
assert.equal(docsCommunication.blocked[0].row.identity.applicantId, "FODE-002");
assert.equal(docsCommunication.blocked[0].reasonCode, "COMM_AUTHORITY_BLOCKED");
assert.equal(docsCommunication.counts.included + docsCommunication.counts.excluded + docsCommunication.counts.blocked, 2, "Cohort partitions must be exhaustive and disjoint");
assert.equal(docsCommunication.approvalExtension.status, "NOT_IMPLEMENTED");

let exactApplicantResolverCalls = 0;
context.getCallerEmail_ = () => "admin@example.test";
context.isAdmin_ = () => true;
context.openDataSheet_ = () => ({
  getName: () => "FODE_Data",
  getDataRange: () => ({ getValues: () => values })
});
context.buildActionabilityPreviewRow_ = (row, rowNumber) => {
  exactApplicantResolverCalls += 1;
  return authorityRow(row, rowNumber);
};
const exactApplicant = context.admin_getCanonicalApplicant({ applicantId: "FODE-002" });
assert.equal(exactApplicant.ok, true);
assert.equal(exactApplicant.applicant.identity.applicantId, "FODE-002");
assert.equal(exactApplicantResolverCalls, 1, "Exact applicant drill-down must resolve only matching rows, not the full population");

console.log("PASS canonical population DTO is stable, deterministic, and authority-backed");
console.log("PASS canonical cohorts enforce exact scope and partition integrity");
console.log("PASS M1 contains no OPS, mutation, send, or fabricated Registry/Classroom authority");
