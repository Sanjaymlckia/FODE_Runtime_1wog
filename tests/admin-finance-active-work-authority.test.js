const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const financeSource = fs.readFileSync("Admin_CanonicalFinance.js", "utf8");
const context = {
  console,
  Date,
  Number,
  Math,
  Object,
  Array,
  String,
  Error,
  isFinite,
  clean_(value) { return String(value == null ? "" : value).trim(); },
  parseZohoBooksRate_(value) {
    const parsed = Number(String(value == null ? "" : value).replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : NaN;
  },
  stageAggregationEffectiveEmail_(row) { return row.Parent_Email || ""; },
  getWhatsAppFallbackPhoneRaw_() { return ""; },
  adminRowPaymentEvidencePresent_(row) {
    const raw = String(row && row.Fee_Receipt_File || "").trim();
    if (!raw || /^(?:\[\]|\{\}|null|undefined|none|n\/a|notuploaded|nofile)$/i.test(raw.replace(/\s+/g, ""))) return false;
    return /^https?:\/\//i.test(raw) || /^[\w-]{20,}$/.test(raw);
  },
  isCanonicalPaymentVerified_(row) {
    return String(row && row.Receipt_Status || "").trim().toLowerCase() === "verified";
  }
};
vm.createContext(context);
vm.runInContext(financeSource, context);

function finance(row, canonical) {
  return context.resolveCanonicalFinance_(row, Object.assign({
    identity: { applicantId: row.ApplicantID || "FODE-X", rowNumber: 1, sourceSheetName: "FODE_Data" },
    applicant: { name: row.Student_Name || "Fixture" },
    documents: { verified: true, requiredComplete: true, state: "VERIFIED" },
    finance: {},
    lifecycle: { baseState: "PAYMENT_PENDING" },
    actionability: { workloadGroupKey: "FINANCE", state: "READY" },
    communication: {}
  }, canonical || {}));
}

const pendingReady = finance(
  { ApplicantID: "FODE-PENDING-READY", Receipt_Status: "", Fee_Receipt_File: "" },
  { lifecycle: { baseState: "PAYMENT_PENDING" }, actionability: { workloadGroupKey: "FINANCE", state: "READY" } }
);
assert.equal(pendingReady.financeAuthority.financeState, "PAYMENT_PENDING");
assert.equal(pendingReady.financeAuthority.activeFinanceWork, true, "Finance-owned ready payment follow-up must remain active work");

const pendingCoolingOff = finance(
  { ApplicantID: "FODE-PENDING-COOLING", Receipt_Status: "", Fee_Receipt_File: "" },
  { lifecycle: { baseState: "PAYMENT_PENDING" }, actionability: { workloadGroupKey: "FINANCE", state: "COOLING_OFF" } }
);
assert.equal(pendingCoolingOff.financeAuthority.activeFinanceWork, false, "Cooling-off payment follow-up must not count as active Finance work");

const verifyFinanceOwned = finance(
  { ApplicantID: "FODE-VERIFY-FINANCE", Receipt_Status: "Pending", Fee_Receipt_File: "https://receipt" },
  { lifecycle: { baseState: "PAYMENT_TO_VERIFY" }, actionability: { workloadGroupKey: "FINANCE", state: "REVIEW_REQUIRED" } }
);
assert.equal(verifyFinanceOwned.financeAuthority.financeState, "PAYMENT_TO_VERIFY");
assert.equal(verifyFinanceOwned.financeAuthority.activeFinanceWork, true, "Finance-owned verification work must remain active");

const verifyAdmissionsOwned = finance(
  { ApplicantID: "FODE-VERIFY-ADMISSIONS", Receipt_Status: "Pending", Fee_Receipt_File: "https://receipt" },
  { lifecycle: { baseState: "PAYMENT_TO_VERIFY" }, actionability: { workloadGroupKey: "ADMISSIONS_REVIEW", state: "REVIEW_REQUIRED" } }
);
assert.equal(verifyAdmissionsOwned.financeAuthority.activeFinanceWork, false, "Other-authority verification rows must not count as active Finance work");

const paidVerified = finance(
  { ApplicantID: "FODE-PAID", Receipt_Status: "Verified", Fee_Receipt_File: "https://receipt" },
  { lifecycle: { baseState: "COMPLETE" }, actionability: { workloadGroupKey: "COMPLETE", state: "COMPLETE" } }
);
assert.equal(paidVerified.financeAuthority.financeState, "PAID_VERIFIED");
assert.equal(paidVerified.financeAuthority.activeFinanceWork, false, "Verified payment history must not count as active Finance work");

const notApplicable = context.resolveCanonicalFinance_(
  { ApplicantID: "FODE-NOT-APPLICABLE", Receipt_Status: "", Fee_Receipt_File: "" },
  {
    identity: { applicantId: "FODE-NOT-APPLICABLE", rowNumber: 9, sourceSheetName: "FODE_Data" },
    applicant: { name: "Not Applicable" },
    documents: { verified: false, requiredComplete: false, state: "PENDING" },
    finance: {},
    lifecycle: { baseState: "INCOMPLETE_DOCUMENTS" },
    actionability: { workloadGroupKey: "APPLICANT", state: "READY" },
    communication: {}
  }
);
assert.equal(notApplicable.financeAuthority.financeState, "NOT_YET_PAYMENT_APPLICABLE");
assert.equal(notApplicable.financeAuthority.activeFinanceWork, false, "Pre-payment population must never count as active Finance work");

console.log("PASS active Finance work requires a current Finance-owned action");
console.log("PASS secondary Finance facts do not inflate active Finance workload");
