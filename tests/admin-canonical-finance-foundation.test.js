const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const financeSource = fs.readFileSync("Admin_CanonicalFinance.js", "utf8");
const populationSource = fs.readFileSync("Admin_CanonicalPopulation.js", "utf8");
const operatorNextSource = fs.readFileSync("AdminUI_OperatorNext.html", "utf8");
const claspIgnore = fs.readFileSync(".claspignore", "utf8");

assert.match(financeSource, /CANONICAL_FINANCE_V1/, "Canonical Finance schema marker must exist");
assert.match(claspIgnore, /!Admin_CanonicalFinance\.js/, "Canonical Finance module must be deployable later");
assert.match(financeSource, /function resolveCanonicalFinance_/, "Canonical Finance resolver must exist");
assert.match(financeSource, /Receipt_Status \/ canonical payment helpers/, "Receipt_Status must remain Finance authority");
assert.match(financeSource, /compatibilityPaymentVerifiedRaw/, "Payment_Verified must be exposed only as compatibility evidence");
assert.match(financeSource, /Books_Invoice_ID/, "Books metadata must be projected");
assert.match(financeSource, /EXTERNAL_INTEGRATION_METADATA|Zoho Books external integration metadata/, "Books fields must remain integration metadata");
assert.doesNotMatch(financeSource, /setCell_\(|openLogSheet_\(|GmailApp|MailApp|zohoBooksApiRequest_\("post"|admin_setPaymentVerified_impl_/, "Canonical Finance APIs must not mutate Sheets, send mail, write Books, or call payment verification");

const expectedRpcs = [
  "admin_getCanonicalFinanceSummary",
  "admin_getCanonicalFinanceWorklist",
  "admin_getCanonicalFinanceApplicant",
  "admin_getCanonicalFinanceReconciliation",
  "admin_getCanonicalFinanceExceptions",
  "admin_getCanonicalFinanceObjectHistory",
  "admin_getCanonicalFinancePolicyStatus"
];
for (const name of expectedRpcs) {
  assert.match(financeSource, new RegExp(`function\\s+${name}\\s*\\(`), `${name} RPC must exist`);
}

assert.match(financeSource, /amount:\s*null/, "Unknown/unavailable amounts must be null, not invented zero");
assert.match(financeSource, /state:\s*"UNAVAILABLE"/, "Unavailable amount state must be explicit");
assert.match(financeSource, /state:\s*"UNRESOLVED"/, "Unresolved derived balances must be explicit");
assert.match(financeSource, /PAYMENT_PENDING/, "Payment pending state must be implemented");
assert.match(financeSource, /PAYMENT_TO_VERIFY/, "Payment to verify state must be implemented");
assert.match(financeSource, /PAID_VERIFIED/, "Paid verified state must be implemented");
assert.match(financeSource, /POLICY_REQUIRED/, "Policy-dependent states must remain explicit");
assert.match(financeSource, /WORKFLOW_PENDING/, "Future finance workflows must remain explicit");

assert.match(financeSource, /canonicalPopulationSnapshot_\(\)/, "Finance must compose the M1 canonical population snapshot");
assert.doesNotMatch(financeSource, /getDataRange\(\)\.getValues\(\)/, "Finance module must not add a second independent full-sheet scanner");
assert.match(populationSource, /canonicalPopulationFinanceProjection_/, "M1 finance projection remains available");

assert.match(operatorNextSource, /admin_getCanonicalFinanceWorklist\(\{page:1,pageSize:50\}\)/, "Operator Next Finance route must call the read-only Finance worklist API");
assert.match(operatorNextSource, /operatorNextLoadFinance_/, "Finance route must lazy-load canonical Finance data");
assert.match(operatorNextSource, /POLICY REQUIRED/, "Operator Next Finance route must label policy-dependent buckets");
assert.match(operatorNextSource, /Receipt_Status/, "Operator Next Finance route must name Receipt_Status as canonical payment authority");
assert.doesNotMatch(operatorNextSource, /CAN_VERIFY_PAYMENT[\s\S]{0,200}admin_setPaymentVerified/, "Operator Next Finance route must not introduce direct payment mutation");

const context = {
  console,
  clean_(value) { return String(value == null ? "" : value).trim(); },
  parseZohoBooksRate_(value) {
    const parsed = Number(String(value == null ? "" : value).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : NaN;
  },
  isCanonicalPaymentVerified_(row) {
    return String(row && row.Receipt_Status || "").trim().toLowerCase() === "verified";
  }
};
vm.createContext(context);
vm.runInContext(financeSource, context);

function finance(row, canonical) {
  return context.resolveCanonicalFinance_(row, Object.assign({
    identity: { applicantId: row.ApplicantID || "FODE-X", rowNumber: 2, sourceSheetName: "FODE_Data" },
    applicant: { name: row.Student_Name || "Fixture" },
    finance: {},
    lifecycle: {},
    actionability: {},
    communication: {}
  }, canonical || {}));
}

const pending = finance({ ApplicantID: "FODE-PENDING", Receipt_Status: "", Payment_Verified: "", Fee_Receipt_File: "" });
assert.equal(pending.financeAuthority.financeState, "PAYMENT_PENDING");
assert.equal(pending.financeAuthority.financeReasonCode, "PAYMENT_EVIDENCE_MISSING");

const toVerify = finance({ ApplicantID: "FODE-VERIFY", Receipt_Status: "Pending", Payment_Verified: "", Fee_Receipt_File: "https://receipt" });
assert.equal(toVerify.financeAuthority.financeState, "PAYMENT_TO_VERIFY");
assert.equal(toVerify.operational.recommendedFinanceAction, "VERIFY_PAYMENT");
assert.equal(toVerify.operational.mutationCapabilityRequired, "CAN_VERIFY_PAYMENT");

const verified = finance({ ApplicantID: "FODE-PAID", Receipt_Status: "Verified", Payment_Verified: "", Fee_Receipt_File: "https://receipt" });
assert.equal(verified.financeAuthority.financeState, "PAID_VERIFIED");
assert.equal(verified.financeAuthority.paymentVerified, true);

const drift = finance({ ApplicantID: "FODE-DRIFT", Receipt_Status: "", Payment_Verified: "Yes", Fee_Receipt_File: "" });
assert.equal(drift.financeAuthority.financeState, "PAYMENT_PENDING");
assert.ok(drift.audit.warnings.some((item) => /compatibility-only/.test(item)));

const amounts = finance({ ApplicantID: "FODE-AMOUNT", Receipt_Status: "", Fee_Total_Kina: "", Amount_Paid: "" });
assert.equal(amounts.amounts.totalFee.amount, null);
assert.equal(amounts.amounts.totalFee.state, "UNAVAILABLE");
assert.equal(amounts.amounts.outstandingBalance.amount, null);
assert.equal(amounts.amounts.outstandingBalance.state, "UNRESOLVED");

console.log("PASS canonical Finance DTO, APIs, and Operator Next route contract");
console.log("PASS Finance remains read-only and Receipt_Status-backed");
console.log("PASS policy-dependent finance states remain unresolved");
