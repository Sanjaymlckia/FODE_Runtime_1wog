const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const financeSource = fs.readFileSync("Admin_CanonicalFinance.js", "utf8");
const components = fs.readFileSync("EduOps_ClientComponents.html", "utf8");
const styles = fs.readFileSync("EduOps_Styles.html", "utf8");
const integrationAuthority = fs.readFileSync("Admin_OperationalIntegrationAuthority.js", "utf8");

const context = { console, Date, Number, Math, Object, Array, String, Error, isFinite };
vm.createContext(context);
vm.runInContext(financeSource, context);

function financeRow(id, name, state, options = {}) {
  const active = state === "PAYMENT_PENDING" || state === "PAYMENT_TO_VERIFY";
  const books = options.books || {};
  return {
    schemaVersion: "CANONICAL_FINANCE_V1",
    identity: {
      applicantId: id,
      applicantName: name,
      rowNumber: options.rowNumber || 2,
      sourceSheetName: "FODE_Data"
    },
    contact: { effectiveEmail: options.email || `${id.toLowerCase()}@example.test`, phone: "" },
    financeAuthority: {
      financeState: state,
      receiptStatus: state === "PAID_VERIFIED" ? "Verified" : "Pending",
      paymentVerified: state === "PAID_VERIFIED",
      compatibilityPaymentVerifiedRaw: options.compatibilityPaymentVerifiedRaw || "",
      activeFinanceWork: active
    },
    amounts: { calculationCompleteness: options.amountCompleteness || "SOURCE_LIMITED" },
    objects: { books },
    exceptions: { financeExceptionCode: options.exceptionCode || "" },
    operational: {
      recommendedFinanceAction: state === "PAYMENT_PENDING"
        ? "SEND_PAYMENT_REMINDER"
        : (state === "PAYMENT_TO_VERIFY" ? "VERIFY_PAYMENT" : "NO_PAYMENT_ACTION"),
      paymentFollowupRecommended: state === "PAYMENT_PENDING",
      worklistKey: active ? "PAYMENT_REVIEW" : "NO_ACTION"
    },
    audit: {
      resolvedAt: options.resolvedAt || "2026-07-21T01:35:59.247Z",
      warnings: options.warnings || [],
      searchIndex: `${id} ${name} ${options.email || ""} ${state}`.toLowerCase()
    }
  };
}

const rows = [
  financeRow("FODE-26-000001", "Not Payable", "NOT_YET_PAYMENT_APPLICABLE"),
  financeRow("FODE-26-000002", "Duplicate Student", "PAYMENT_PENDING", { rowNumber: 3, amountCompleteness: "INCOMPLETE" }),
  financeRow("FODE-26-000002", "Duplicate Student", "PAYMENT_PENDING", { rowNumber: 4, amountCompleteness: "INCOMPLETE" }),
  financeRow("FODE-26-000003", "Payment Review", "PAYMENT_TO_VERIFY", { rowNumber: 5, amountCompleteness: "INCOMPLETE" }),
  financeRow("FODE-26-000004", "Paid Student", "PAID_VERIFIED", { rowNumber: 6, books: { contactId: "contact-4", invoiceId: "invoice-4" } })
];

assert.deepEqual(
  JSON.parse(JSON.stringify(context.canonicalFinanceTestRecordProjection_({ ApplicantID: "FODE-26-TEST-007" }, "FODE-26-TEST-007"))),
  { isTestRecord: true, source: "Governed fixture ApplicantID convention" }
);
context.CONFIG = { ZOHO_BOOKS_TEST_APPLICANT_IDS: ["FODE-26-002929"] };
assert.equal(context.canonicalFinanceTestRecordProjection_({}, "FODE-26-002929").isTestRecord, true);
assert.equal(context.canonicalFinanceTestRecordProjection_({ Test_Record: "Yes" }, "FODE-26-000008").isTestRecord, true);
assert.equal(context.canonicalFinanceTestRecordProjection_({}, "FODE-26-000009").isTestRecord, false);

const allFindings = context.canonicalFinanceReconciliationRows_(rows);
assert.equal(allFindings.length, 4, "Reconciliation must return at most one finding per ApplicantID");
const notPayable = allFindings.find((item) => item.applicantId === "FODE-26-000001");
assert.equal(notPayable.actionable, false, "Genuinely not-yet-payable applicants must not be actionable");
assert.deepEqual(Array.from(notPayable.codes), ["NOT_YET_PAYMENT_APPLICABLE_CONSISTENT"]);
const duplicate = allFindings.find((item) => item.applicantId === "FODE-26-000002");
assert.equal(duplicate.actionable, true);
assert.equal(duplicate.severity, "ERROR");
assert.ok(duplicate.codes.includes("DUPLICATE_APPLICANT_ID"));
assert.deepEqual(Array.from(duplicate.rowNumbers), [3, 4]);

const actionable = context.canonicalFinanceFindingPage_(rows, { page: 1, pageSize: 1 });
assert.equal(actionable.actionableCount, 2, "Default reconciliation must include only genuine defects");
assert.equal(actionable.filteredCount, 2);
assert.equal(actionable.rows.length, 1);
assert.equal(actionable.totalPages, 2);
assert.equal(actionable.hasNext, true);
assert.ok(actionable.groups.byReason.DUPLICATE_APPLICANT_ID >= 1);

const secondPage = context.canonicalFinanceFindingPage_(rows, { page: 2, pageSize: 1 });
assert.equal(secondPage.rows.length, 1);
assert.notEqual(secondPage.rows[0].applicantId, actionable.rows[0].applicantId);

const duplicateOnly = context.canonicalFinanceFindingPage_(rows, {
  page: 1,
  pageSize: 25,
  filters: { reasonCode: "DUPLICATE_APPLICANT_ID", actionableOnly: true }
});
assert.equal(duplicateOnly.filteredCount, 1);
assert.equal(duplicateOnly.rows[0].applicantName, "Duplicate Student");
assert.equal(context.canonicalFinanceSummaryFromRows_(rows).activeFinanceWork, 2, "Active Finance overview must count unique applicants");

const named = context.canonicalFinancePaged_(rows, {
  page: 1,
  pageSize: 12,
  searchQuery: "Paid Student",
  filters: { financeScope: "ALL_APPLICANTS" }
});
assert.equal(named.filteredCount, 1, "Student-name search must resolve across the full Finance population");
assert.equal(named.rows[0].identity.applicantId, "FODE-26-000004");

const byId = context.canonicalFinancePaged_(rows, {
  page: 1,
  pageSize: 12,
  searchQuery: "FODE-26-000003",
  filters: { financeScope: "ALL_APPLICANTS" }
});
assert.equal(byId.filteredCount, 1, "Direct ApplicantID search must remain available");

const matched = context.canonicalFinancePaged_(rows, {
  page: 1,
  pageSize: 25,
  filters: { financeScope: "ALL_APPLICANTS", matchingState: "LOCAL_INVOICE_LINKED" }
});
assert.equal(matched.filteredCount, 1, "Applicant-account matching filters must run server-side");
assert.equal(matched.rows[0].identity.applicantId, "FODE-26-000004");

assert.match(components, /Operations[\s\S]*Integration[\s\S]*Policy & Handoffs/, "Finance tabs must be grouped for scanning");
assert.match(components, /Student name[\s\S]*data-finance-name-search[\s\S]*ApplicantID/, "Student name must be the primary search and ApplicantID the secondary lookup");
assert.match(components, /financeIdentityHtml\(identity\.applicantName, identity\.applicantId, identity\.testRecord\)[\s\S]*effectiveEmail/, "Typeahead must show Name, ApplicantID, test status, and email");
assert.match(components, /function financeOpenApplicantDetail[\s\S]*financeLoadView\("applicant"[\s\S]*applicantId/, "Direct navigation must open the exact applicant without retyping an ID");
assert.doesNotMatch(components, /applicantButton\.click\(\)/, "Direct applicant navigation must not depend on an asynchronous synthetic tab click");
assert.match(components, /data-finance-list-search[\s\S]*data-finance-list-state[\s\S]*data-finance-list-match[\s\S]*data-finance-list-actionable/, "Account filters must include search, state, matching, and actionable-only controls");
assert.match(components, /data-finance-page-view[\s\S]*Previous[\s\S]*Next/, "Finance lists must expose paging controls");
for (const timestampExpression of [
  "financePngDate(books.lastPushAt",
  "financePngDate(books.lastAttemptAt",
  "financePngDate(books.lastErrorAt",
  "financePngDate(response.cachedTokenExpiresAt"
]) {
  assert.ok(components.includes(timestampExpression), `${timestampExpression} must render in PNG local time`);
}
assert.match(components, /financePngDate\(response\.generatedAt[\s\S]*financeTechnicalDetails/, "Reconciliation timestamps must be PNG-local with raw diagnostics confined to Technical details");
assert.match(components, /financePngDate\(row\.updatedAt \|\| row\.reviewedAt[\s\S]*financeTechnicalDetails\(row\)/, "Handoff timestamps must be PNG-local with raw ISO in Technical details");
assert.match(components, /Never pushed[\s\S]*No attempt recorded[\s\S]*No error/, "Push diagnostics must use readable empty states");
assert.match(components, /Normally non-refundable[\s\S]*Principal review required[\s\S]*No automatic refund/, "Refund policy wording must match the approved authority");
assert.match(components, /function financeTestBadgeHtml[\s\S]*eduops-finance-test-badge[\s\S]*TEST/, "Finance must expose a clear TEST badge");
for (const identitySurface of [
  "financeIdentityHtml(identity.applicantName, identity.applicantId, identity.testRecord)",
  "financeIdentityHtml(item.applicantName, item.applicantId, item.testRecord)",
  "financeIdentityHtml(row.applicantName, row.applicantId, row.testRecord)",
  "financeIdentityHtml(preview.applicantName, preview.applicantId, preview.testRecord)",
  "financeIdentityHtml(result.applicantName, result.applicantId, result.testRecord)"
]) {
  assert.ok(components.includes(identitySurface), `${identitySurface} must retain the bound test-record identity`);
}
assert.match(components, /Applicant name<input id="eduopsFinanceHandoffApplicantName"[\s\S]*ApplicantID<input id="eduopsFinanceHandoffApplicant"/, "Handoff form must display Applicant Name and ApplicantID");
assert.match(components, /function financeLoadHandoffIdentity[\s\S]*FINANCE_HANDOFF_APPLICANT_BINDING_MISMATCH/, "Handoff identity lookup must fail closed on an applicant mismatch");
assert.match(components, /function financeSeverityLabel[\s\S]*WARN[\s\S]*Warning/, "WARN must render as Warning");
assert.match(components, /Unique active applicants/, "The deduplicated overview count must use accurate terminology");
assert.match(components, /function financePaginationHtml[\s\S]*totalPages <= 1\) return ""/, "Single-page Finance results must hide pagination");
assert.match(components, /eduops-finance-next-step/, "Exception instructions must use the full-width wrapping presentation");
assert.match(components, /CAN_REVIEW_FINANCE_EXCEPTIONS[\s\S]*CAN_MANAGE_FINANCE_HANDOFF/, "Handoff visibility must be separate from Finance read access");
assert.match(components, /financeHandoffCapabilityAllowed\(\)[\s\S]*data-finance-preview-handoff/, "Only handoff managers may see preview controls");
assert.match(components, /financeOpenHandoff[\s\S]*selectedHandoffApplicantId[\s\S]*eduopsFinanceHandoffApplicant/, "Selected exceptions must prefill the handoff applicant");
assert.match(integrationAuthority, /function admin_previewFodeFinanceHandoff[\s\S]*CAN_MANAGE_FINANCE_HANDOFF/, "Handoff preview must enforce management authority server-side");
assert.match(integrationAuthority, /function admin_executeFodeFinanceHandoff[\s\S]*fodeRevalidateMutationActor_\(actor, "CAN_MANAGE_FINANCE_HANDOFF"\)/, "Handoff execution must revalidate authority");
assert.match(integrationAuthority, /evidenceReference = fodeAuthorityClean_\(p\.evidenceReference \|\| current\.evidenceReference\)/, "Handoff evidence must survive later state transitions");
assert.match(integrationAuthority, /\["APPROVED", "REJECTED", "POLICY_REQUIRED", "HANDED_TO_ZOHO", "COMPLETED_EXTERNALLY"\][\s\S]*EVIDENCE_REFERENCE_REQUIRED/, "HANDED_TO_ZOHO must fail closed without evidence");
assert.match(integrationAuthority, /\["HANDED_TO_ZOHO", "COMPLETED_EXTERNALLY"\][\s\S]*ZOHO_REFERENCE_REQUIRED/, "HANDED_TO_ZOHO must fail closed without a Zoho reference");
assert.doesNotMatch(components, /admin_preflightZohoBooks|admin_createZohoBooksFodeDraftInvoice|admin_sendZohoBooksTestInvoiceEmail|admin_setPaymentVerified|admin_executeRefund/, "Finance UI must expose no OAuth, Zoho, payment, or refund mutation");
assert.match(styles, /eduops-finance-test-badge[\s\S]*eduops-finance-next-step[\s\S]*white-space:\s*normal/, "TEST badges and full exception instructions must have bounded readable styling");
assert.match(styles, /eduops-finance-overview-grid[\s\S]*eduops-finance-controls[\s\S]*eduops-finance-suggestions/, "Finance overview, filters, and typeahead must have bounded responsive layout");

console.log("PASS Finance reconciliation deduplication, actionable defaults, grouping, filtering, and pagination");
console.log("PASS Finance applicant search, direct navigation, PNG dates, readable diagnostics, and policy wording");
console.log("PASS Finance viewer and governed handoff authority remain separated");
