const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("Admin_CanonicalPopulation.js", "utf8");
const adminSource = fs.readFileSync("Admin.js", "utf8");

function extractFunction(code, name) {
  const marker = `function ${name}`;
  const start = code.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist`);
  const brace = code.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = brace; i < code.length; i += 1) {
    const ch = code[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth += 1;
    else if (ch === "}" && --depth === 0) return code.slice(start, i + 1);
  }
  throw new Error(`${name} is not closed`);
}

assert.match(adminSource, /canonicalPopulationSnapshot_\(\)/, "Admin search must consume canonical population, not its own sheet scan");
assert.doesNotMatch(extractFunction(adminSource, "admin_searchApplicants"), /getDataRange\(\)\.getValues\(\)/, "Admin search must not perform a second full-sheet scan");

const functions = [
  "canonicalPopulationClone_",
  "operationalRouteKeyFromCanonicalRow_",
  "operationalRouteLabel_",
  "operationalRouteSearchIndex_",
  "operationalRouteRowFromCanonical_",
  "operationalRouteSummarySkeleton_",
  "buildOperationalRouteSnapshot_"
].map((name) => extractFunction(source, name)).join("\n\n");

const context = {
  console,
  Date,
  Number,
  Math,
  Object,
  Array,
  String,
  CANONICAL_POPULATION_SCHEMA_VERSION: "CANONICAL_POPULATION_V1",
  clean_: (value) => String(value == null ? "" : value).trim()
};
vm.createContext(context);
vm.runInContext(functions, context);

const snapshot = {
  generatedAt: "2026-07-14T00:00:00.000Z",
  totalRows: 4,
  reconciliation: { status: "PASS" },
  rows: [
    {
      identity: { applicantId: "FODE-APPLICANT", rowNumber: 2 },
      applicant: { name: "Applicant Route", effectiveEmail: "applicant@example.test", phone: "6757000001" },
      lifecycle: { baseState: "INCOMPLETE_DOCUMENTS", lifecycleStage: "INCOMPLETE_DOCUMENTS", reason: "Missing uploads." },
      actionability: { workloadGroupKey: "APPLICANT", actionOwner: "APPLICANT", state: "READY", selectable: true, worklistKey: "DOCUMENT_FOLLOW_UP", worklistLabel: "Missing Documents", worklistReason: "Awaiting upload", nextAction: "UPLOAD_REQUIRED_DOCUMENTS", recommendedAction: "docs_missing", recommendedMessageType: "docs_missing", ageDays: 2, lastContactAgeDays: 4 },
      finance: { financeAuthority: { financeState: "NOT_YET_PAYMENT_APPLICABLE", paymentApplicable: false, activeFinanceWork: false, financeReasonCode: "PAYMENT_NOT_YET_APPLICABLE", financeReason: "Docs not verified." }, exceptions: {} },
      contactability: { state: "EMAIL_AVAILABLE" },
      diagnostics: { lifecycleMismatch: { hasLifecycleMismatch: false } }
    },
    {
      identity: { applicantId: "FODE-FINANCE-PENDING", rowNumber: 3 },
      applicant: { name: "Finance Pending", effectiveEmail: "pending@example.test", phone: "6757000002" },
      lifecycle: { baseState: "PAYMENT_PENDING", lifecycleStage: "PAYMENT_PENDING", reason: "Payment due." },
      actionability: { workloadGroupKey: "FINANCE", actionOwner: "APPLICANT", state: "READY", selectable: true, worklistKey: "PAYMENT_FOLLOW_UP", worklistLabel: "Payment Follow-up", worklistReason: "Awaiting evidence", nextAction: "SEND_PAYMENT_REMINDER", recommendedAction: "payment_followup", recommendedMessageType: "payment_followup", ageDays: 6, lastContactAgeDays: 8 },
      finance: { financeAuthority: { financeState: "PAYMENT_PENDING", paymentApplicable: true, activeFinanceWork: true, financeReasonCode: "PAYMENT_EVIDENCE_MISSING", financeReason: "Payment due.", paymentEvidencePresent: false, paymentVerified: false }, exceptions: {} },
      contactability: { state: "EMAIL_AVAILABLE" },
      diagnostics: { lifecycleMismatch: { hasLifecycleMismatch: false } }
    },
    {
      identity: { applicantId: "FODE-FINANCE-VERIFY", rowNumber: 4 },
      applicant: { name: "Finance Verify", effectiveEmail: "verify@example.test", phone: "6757000003" },
      lifecycle: { baseState: "PAYMENT_TO_VERIFY", lifecycleStage: "PAYMENT_TO_VERIFY", reason: "Receipt present." },
      actionability: { workloadGroupKey: "FINANCE", actionOwner: "FINANCE", state: "REVIEW_REQUIRED", selectable: false, selectBlockReason: "Finance verification required.", worklistKey: "PAYMENT_REVIEW", worklistLabel: "Payment Review", worklistReason: "Receipt pending verification", nextAction: "VERIFY_PAYMENT", recommendedAction: "VERIFY_PAYMENT", recommendedMessageType: "", ageDays: 1, lastContactAgeDays: 1 },
      finance: { financeAuthority: { financeState: "PAYMENT_TO_VERIFY", paymentApplicable: true, activeFinanceWork: true, financeReasonCode: "RECEIPT_EVIDENCE_PENDING_VERIFICATION", financeReason: "Verify receipt.", paymentEvidencePresent: true, paymentVerified: false }, exceptions: {} },
      contactability: { state: "EMAIL_AVAILABLE" },
      diagnostics: { lifecycleMismatch: { hasLifecycleMismatch: false } }
    },
    {
      identity: { applicantId: "FODE-COMPLETE", rowNumber: 5 },
      applicant: { name: "Complete", effectiveEmail: "complete@example.test", phone: "6757000004" },
      lifecycle: { baseState: "COMPLETE", lifecycleStage: "COMPLETE", reason: "Done." },
      actionability: { workloadGroupKey: "COMPLETE", actionOwner: "NONE", state: "COMPLETE", selectable: false, worklistKey: "NO_ACTION", worklistLabel: "No action", worklistReason: "Complete", nextAction: "NO_ACTION", recommendedAction: "NO_ACTION", recommendedMessageType: "", ageDays: "", lastContactAgeDays: "" },
      finance: { financeAuthority: { financeState: "PAID_VERIFIED", paymentApplicable: true, activeFinanceWork: false, financeReasonCode: "RECEIPT_STATUS_VERIFIED", financeReason: "Verified.", paymentEvidencePresent: true, paymentVerified: true }, exceptions: { financeExceptionCode: "" } },
      contactability: { state: "EMAIL_AVAILABLE" },
      diagnostics: { lifecycleMismatch: { hasLifecycleMismatch: false } }
    }
  ]
};

const operational = context.buildOperationalRouteSnapshot_(snapshot, {});
assert.equal(operational.ok, true);
assert.equal(operational.canonicalPopulationCount, 4);
assert.equal(operational.routeSummaries.APPLICANT_ACTION.populationTotal, 1);
assert.equal(operational.routeSummaries.FINANCE.populationTotal, 2);
assert.equal(operational.routeSummaries.FINANCE.financePending, 1);
assert.equal(operational.routeSummaries.FINANCE.financeToVerify, 1);
assert.equal(operational.routeSummaries.COMPLETED_NO_ACTION.populationTotal, 1);
assert.deepEqual(Array.from(operational.routeRows.FINANCE, (row) => row.applicantId), ["FODE-FINANCE-PENDING", "FODE-FINANCE-VERIFY"]);
assert.equal(operational.routeRows.FINANCE[0].reviewTarget.originRoute, "FINANCE");
assert.equal(operational.routeRows.FINANCE[1].financeState, "PAYMENT_TO_VERIFY");
assert.equal(operational.routeRows.APPLICANT_ACTION[0].financeApplicable, false);

console.log("PASS shared operational route projection is canonical-population backed");
console.log("PASS finance route membership is derived from shared finance facts");
