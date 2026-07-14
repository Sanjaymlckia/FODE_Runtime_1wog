const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("Admin_CanonicalFinance.js", "utf8");
const context = { console, Date, Number, Math, Object, Array, String, Error, isFinite };
vm.createContext(context);
vm.runInContext(source, context);

function row(index) {
  const id = `FODE-26-${String(index).padStart(6, "0")}`;
  const state = index % 3 === 0 ? "PAID_VERIFIED" : (index % 2 === 0 ? "PAYMENT_TO_VERIFY" : "PAYMENT_PENDING");
  const worklistKey = state === "PAYMENT_PENDING" ? "PAYMENT_FOLLOW_UP" : (state === "PAYMENT_TO_VERIFY" ? "PAYMENT_REVIEW" : "NO_ACTION");
  return {
    schemaVersion: "CANONICAL_FINANCE_V1",
    identity: { applicantId: id, applicantName: `Applicant ${index}`, rowNumber: index + 1, sourceSheetName: "FODE_Data" },
    contact: { effectiveEmail: `applicant${index}@example.test`, phone: `675700${String(index).padStart(4, "0")}` },
    financeAuthority: { financeState: state, receiptStatus: state === "PAID_VERIFIED" ? "Verified" : "Pending", financeReasonCode: state, financeReason: state, activeFinanceWork: state !== "PAID_VERIFIED" },
    amounts: { currency: "PGK", calculationCompleteness: "INCOMPLETE" },
    objects: { books: {} },
    exceptions: { financeExceptionCode: index === 219 ? "FINANCE_WARNING" : "" },
    operational: { worklistKey, worklistLabel: worklistKey, recommendedFinanceAction: state === "PAYMENT_PENDING" ? "SEND_PAYMENT_REMINDER" : (state === "PAYMENT_TO_VERIFY" ? "VERIFY_PAYMENT" : "NO_PAYMENT_ACTION"), paymentFollowupRecommended: state === "PAYMENT_PENDING", paymentVerificationRequired: state === "PAYMENT_TO_VERIFY" },
    audit: { resolvedAt: "2026-07-13T00:00:00.000Z", warnings: [], searchIndex: `${id} applicant ${index} applicant${index}@example.test 675700${String(index).padStart(4, "0")} ${state} ${worklistKey} ${state}_consistent ${index === 219 ? "finance_warning" : ""}`.toLowerCase() }
  };
}

const rows = Array.from({ length: 329 }, (_, index) => row(index + 1));
const seen = new Set();
let pageNumber = 1;
let lastPage;
do {
  lastPage = context.canonicalFinancePaged_(rows, { page: pageNumber, pageSize: 50, filters: { financeScope: "ALL_APPLICANTS" } });
  assert.equal(lastPage.totalCount, 329);
  assert.equal(lastPage.sortKey, "APPLICANT_ID_ASC");
  for (const item of lastPage.rows) assert.equal(seen.has(item.identity.applicantId), false, "Pages must not duplicate Applicant IDs");
  lastPage.rows.forEach((item) => seen.add(item.identity.applicantId));
  pageNumber += 1;
} while (lastPage.hasNext);
assert.equal(seen.size, 329, "A complete traversal must reach all 329 unique Applicant IDs");
assert.equal(lastPage.hasPrevious, true);

const afterFifty = context.canonicalFinancePaged_(rows, { page: 1, pageSize: 50, searchQuery: "FODE-26-000075", filters: { financeScope: "ALL_APPLICANTS" } });
assert.equal(afterFifty.filteredCount, 1);
assert.equal(afterFifty.rows[0].identity.applicantId, "FODE-26-000075", "Server search must reach an Applicant ID outside page 1");

const afterHundred = context.canonicalFinancePaged_(rows, { page: 3, pageSize: 50, filters: { financeScope: "ALL_APPLICANTS" } });
assert.equal(afterHundred.rows[0].identity.applicantId, "FODE-26-000101", "Page 3 must reach records after row 100 deterministically");
assert.deepEqual(JSON.parse(JSON.stringify(afterHundred)), JSON.parse(JSON.stringify(context.canonicalFinancePaged_(rows, { page: 3, pageSize: 50, filters: { financeScope: "ALL_APPLICANTS" } }))), "Identical page requests must be stable");

const reconciliationSearch = context.canonicalFinancePaged_(rows, { searchQuery: "PAYMENT_TO_VERIFY_CONSISTENT", pageSize: 100, filters: { financeScope: "ALL_APPLICANTS" } });
assert.equal(reconciliationSearch.filteredCount, 110, "Server search must include reconciliation codes across the full population");

const reviewOnly = context.canonicalFinancePaged_(rows, { page: 1, pageSize: 100, filters: { financeScope: "ALL_APPLICANTS", worklistKey: "PAYMENT_REVIEW" } });
assert.ok(reviewOnly.filteredCount > 0);
assert.ok(reviewOnly.rows.every((item) => item.operational.worklistKey === "PAYMENT_REVIEW"), "No row outside the requested server filter may appear");
assert.equal(reviewOnly.appliedFilters.worklistKey, "PAYMENT_REVIEW");

const empty = context.canonicalFinancePaged_(rows, { page: 99, searchQuery: "NO-SUCH-APPLICANT", filters: { financeScope: "ALL_APPLICANTS" } });
assert.equal(empty.filteredCount, 0);
assert.deepEqual(Array.from(empty.rows), []);
assert.equal(empty.page, 1, "Filter changes and empty results must clamp pagination safely");

const defaultActive = context.canonicalFinancePaged_(rows, { page: 1, pageSize: 100 });
assert.equal(defaultActive.filteredCount, 220, "Default Finance paging must exclude paid/verified history from active work");
assert.ok(defaultActive.rows.every((item) => item.financeAuthority.activeFinanceWork === true), "Default Finance page must contain active work only");

const mergedSearch = context.canonicalFinancePaged_(rows, { searchQuery: "FODE-26-000075", filters: { financeScope: "ALL_APPLICANTS", worklistKey: "" } });
assert.equal(mergedSearch.filteredCount, 1, "Top-level searchQuery must remain active when a filters object is present");

const page50 = context.canonicalFinancePaged_(rows, { page: 1, pageSize: 50, filters: { financeScope: "ALL_APPLICANTS" } });
const page100 = context.canonicalFinancePaged_(rows, { page: 1, pageSize: 100, filters: { financeScope: "ALL_APPLICANTS" } });
const summary = context.canonicalFinanceSummaryFromRows_(rows);
const summaryBytes = Buffer.byteLength(JSON.stringify(summary));
const bytes50 = Buffer.byteLength(JSON.stringify(page50));
const bytes100 = Buffer.byteLength(JSON.stringify(page100));
assert.ok(summaryBytes < bytes50, "Finance summary payload must remain smaller than a routine worklist page");
assert.ok(bytes50 < bytes100, "A 50-row worklist payload must be materially smaller than a 100-row payload");
assert.ok(!Object.prototype.hasOwnProperty.call(page50.rows[0].amounts, "amountSourceMap"), "Worklist rows must exclude full amount source maps");
assert.ok(!Object.prototype.hasOwnProperty.call(page50.rows[0], "paymentPlan"), "Worklist rows must exclude applicant-detail payment plans");
assert.equal(summary.paymentPending, 110);
assert.equal(summary.paymentToVerify, 110);
assert.equal(summary.paidVerified, 109);
assert.equal(summary.activeFinanceWork, 220);

console.log(`PASS canonical Finance pagination traverses ${seen.size} unique rows`);
console.log(`PASS fixture distribution pending=${summary.paymentPending} toVerify=${summary.paymentToVerify} paid=${summary.paidVerified}`);
console.log(`PASS payload bytes summary=${summaryBytes} page50=${bytes50} page100=${bytes100}`);
