const assert = require("assert");
const fs = require("fs");
const vm = require("vm");

const financeSource = fs.readFileSync("Admin_CanonicalFinance.js", "utf8");
const adminSource = fs.readFileSync("Admin.js", "utf8");
const rowFactsSource = fs.readFileSync("Admin_RowFacts.js", "utf8");
const populationSource = fs.readFileSync("Admin_CanonicalPopulation.js", "utf8");
const operatorNextSource = fs.readFileSync("AdminUI_OperatorNext.html", "utf8");
const utilsSource = fs.readFileSync("Utils.js", "utf8");
const claspIgnore = fs.readFileSync(".claspignore", "utf8");

assert.match(financeSource, /CANONICAL_FINANCE_V1/, "Canonical Finance schema marker must exist");
assert.match(claspIgnore, /!Admin_CanonicalFinance\.js/, "Canonical Finance module must be deployable later");
assert.match(financeSource, /function resolveCanonicalFinance_/, "Canonical Finance resolver must exist");
assert.match(financeSource, /Receipt_Status \/ canonical payment helpers/, "Receipt_Status must remain Finance authority");
assert.match(rowFactsSource, /return \["Fee_Receipt_File"\]/, "Payment proof must use an explicit payment-field allowlist");
assert.doesNotMatch(financeSource, /canonicalFinanceClean_\(row\.Fee_Receipt_File[^\n]+!==/, "Canonical Finance must not treat raw non-empty upload placeholders as payment proof");
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
  "admin_getCanonicalFinancePolicy",
  "admin_getCanonicalFinancePolicyStatus",
  "admin_getZohoBooksCachedReadOnlyHealth",
  "admin_getZohoBooksCachedApplicantMatch"
];
for (const name of expectedRpcs) {
  assert.match(financeSource, new RegExp(`function\\s+${name}\\s*\\(`), `${name} RPC must exist`);
}
assert.equal((financeSource.match(/requireCanonicalFinanceReadAccess_\(\);/g) || []).length, expectedRpcs.length, "Every detailed Finance RPC must enforce CAN_READ_FINANCE before producing a DTO");
assert.match(financeSource, /FINANCE_READ_CAPABILITY_REQUIRED/, "Unauthorized Finance reads must return a clear denial code");
assert.match(adminSource, /function admin_preflightZohoBooks[\s\S]*requireCanonicalFinanceReadAccess_\(\)/, "Legacy Zoho preflight must deny unauthorized Finance readers before returning details");
assert.match(adminSource, /function admin_previewZohoBooksFodePayload[\s\S]*requireCanonicalFinanceReadAccess_\(\)/, "Legacy Zoho payload preview must deny unauthorized Finance readers before returning applicant financial data");
assert.match(financeSource, /admin_getZohoBooksCachedApplicantMatch[\s\S]*findRowByApplicantId_[\s\S]*buildZohoBooksRowObject_/, "Applicant matching must use exact local applicant and Books metadata");
assert.doesNotMatch(financeSource, /admin_preflightZohoBooks|ensureZohoBooksAccessToken_|zohoBooksApiRequest_|\/token/, "Finance matching must not acquire tokens or call Zoho");
assert.match(utilsSource, /function getZohoBooksCachedReadOnlyHealth_/, "Cached no-write Zoho health provider must exist");
assert.match(utilsSource, /Connection unavailable — reauthorization required/, "Unavailable cached health must fail closed with the approved message");
const cachedHealth = utilsSource.match(/function getZohoBooksCachedReadOnlyHealth_[\s\S]*?\n\}/)?.[0] || "";
assert.doesNotMatch(cachedHealth, /setProperty|setProperties|deleteProperty|UrlFetchApp|ensureZohoBooksAccessToken_|getZohoBooksTokenReadiness_|\/token/, "Cached health must not write properties, acquire tokens, or call remote APIs");

assert.match(financeSource, /amount:\s*null/, "Unknown/unavailable amounts must be null, not invented zero");
assert.match(financeSource, /state:\s*"UNAVAILABLE"/, "Unavailable amount state must be explicit");
assert.match(financeSource, /state:\s*"UNRESOLVED"/, "Unresolved derived balances must be explicit");
assert.match(financeSource, /PAYMENT_PENDING/, "Payment pending state must be implemented");
assert.match(financeSource, /PAYMENT_TO_VERIFY/, "Payment to verify state must be implemented");
assert.match(financeSource, /PAID_VERIFIED/, "Paid verified state must be implemented");
assert.match(financeSource, /NOT_YET_PAYMENT_APPLICABLE/, "Finance must expose applicants who are not yet payment applicable");
assert.match(financeSource, /POLICY_REQUIRED/, "Policy-dependent states must remain explicit");
assert.match(financeSource, /WORKFLOW_PENDING/, "Future finance workflows must remain explicit");

assert.match(financeSource, /canonicalPopulationSnapshot_\(\)/, "Finance must compose the M1 canonical population snapshot");
assert.doesNotMatch(financeSource, /getDataRange\(\)\.getValues\(\)/, "Finance module must not add a second independent full-sheet scanner");
assert.match(populationSource, /canonicalPopulationFinanceProjection_/, "M1 finance projection remains available");
assert.match(populationSource, /resolveCanonicalFinance_\(/, "Canonical Population must delegate Finance resolution to CANONICAL_FINANCE_V1");
assert.doesNotMatch(populationSource, /var state = verified \? "PAID_VERIFIED"/, "Canonical Population must not retain an independent simplified Finance state resolver");

assert.match(operatorNextSource, /admin_getCanonicalFinanceWorklist\(operatorNextState_\.financeRequest\)/, "Operator Next Finance route must pass the server-side paging/search request");
assert.match(operatorNextSource, /50 is the page size, not a worklist cap/, "Operator Next must distinguish the normal page size from total Finance visibility");
assert.match(operatorNextSource, /onxFinancePrevious[\s\S]*onxFinanceNext/, "Operator Next Finance must expose Previous and Next navigation");
assert.match(operatorNextSource, /searchQuery[\s\S]*filters:\{[\s\S]*financeScope:[\s\S]*worklistKey:/, "Operator Next Finance must hold an explicit server request contract");
assert.match(operatorNextSource, /onxFinancePageRows[\s\S]*operatorNextFinanceStatusRows_\(rows\)/, "Every returned Finance state must remain visible and reviewable, including paid/verified rows");
assert.match(operatorNextSource, /operatorNextLoadFinance_/, "Finance route must lazy-load canonical Finance data");
assert.match(operatorNextSource, /CAN_READ_FINANCE/, "Operator Next must enforce the Finance read capability before loading data");
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
  },
  adminRowPaymentEvidencePresent_(row) {
    const raw = String(row && row.Fee_Receipt_File || "").trim();
    if (!raw || /^(?:\[\]|\{\}|null|undefined|none|n\/a|notuploaded|nofile)$/i.test(raw.replace(/\s+/g, ""))) return false;
    return /^https?:\/\//i.test(raw) || /^[\w-]{20,}$/.test(raw);
  }
};
vm.createContext(context);
vm.runInContext(financeSource, context);
context.getCallerEmail_ = () => "admin@example.test";
context.isAdmin_ = () => true;
context.adminHasCapability_ = () => false;
assert.throws(() => context.requireCanonicalFinanceReadAccess_(), /FINANCE_READ_CAPABILITY_REQUIRED/, "Unauthorized Admins must be denied before any Finance DTO is built");
context.adminHasCapability_ = (_email, capability) => capability === "CAN_READ_FINANCE";
assert.equal(context.requireCanonicalFinanceReadAccess_(), "admin@example.test");

function finance(row, canonical) {
  return context.resolveCanonicalFinance_(row, Object.assign({
    identity: { applicantId: row.ApplicantID || "FODE-X", rowNumber: 2, sourceSheetName: "FODE_Data" },
    applicant: { name: row.Student_Name || "Fixture" },
    documents: { verified: false, requiredComplete: false, state: "PENDING" },
    finance: {},
    lifecycle: {},
    actionability: {},
    communication: {}
  }, canonical || {}));
}

const pending = finance(
  { ApplicantID: "FODE-PENDING", Receipt_Status: "", Payment_Verified: "", Fee_Receipt_File: "" },
  { documents: { verified: true, requiredComplete: true, state: "VERIFIED" }, lifecycle: { baseState: "PAYMENT_PENDING" }, actionability: { state: "READY", worklistLabel: "Payment Follow-up" } }
);
assert.equal(pending.financeAuthority.financeState, "PAYMENT_PENDING");
assert.equal(pending.financeAuthority.financeReasonCode, "PAYMENT_EVIDENCE_MISSING");
assert.equal(pending.financeAuthority.paymentApplicable, true);

const emptyUploadPlaceholder = finance({ ApplicantID: "FODE-PLACEHOLDER", Receipt_Status: "Pending", Fee_Receipt_File: "[]" });
assert.equal(emptyUploadPlaceholder.financeAuthority.financeState, "NOT_YET_PAYMENT_APPLICABLE");
assert.equal(emptyUploadPlaceholder.financeAuthority.paymentEvidencePresent, false);

const whitespaceUploadPlaceholder = finance({ ApplicantID: "FODE-WHITESPACE", Receipt_Status: "Pending", Fee_Receipt_File: "   " });
assert.equal(whitespaceUploadPlaceholder.financeAuthority.financeState, "NOT_YET_PAYMENT_APPLICABLE");
assert.equal(whitespaceUploadPlaceholder.financeAuthority.paymentEvidencePresent, false);

const unrelatedEvidence = finance({ ApplicantID: "FODE-UNRELATED", Portal_Submitted: "Yes", Birth_ID_Passport_File: "https://drive.google.com/file/d/document/view", Books_Invoice_ID: "invoice-1", Receipt_Status: "", Fee_Receipt_File: "[]" });
assert.equal(unrelatedEvidence.financeAuthority.financeState, "NOT_YET_PAYMENT_APPLICABLE", "Portal, ordinary document, and Books metadata must not become payment proof");

const toVerify = finance({ ApplicantID: "FODE-VERIFY", Receipt_Status: "Pending", Payment_Verified: "", Fee_Receipt_File: "https://receipt" });
assert.equal(toVerify.financeAuthority.financeState, "PAYMENT_TO_VERIFY");
assert.equal(toVerify.operational.recommendedFinanceAction, "VERIFY_PAYMENT");
assert.equal(toVerify.operational.mutationCapabilityRequired, "CAN_VERIFY_PAYMENT");
assert.equal(toVerify.operational.paymentFollowupRecommended, false);

const verified = finance({ ApplicantID: "FODE-PAID", Receipt_Status: "Verified", Payment_Verified: "", Fee_Receipt_File: "https://receipt" });
assert.equal(verified.financeAuthority.financeState, "PAID_VERIFIED");
assert.equal(verified.financeAuthority.paymentVerified, true);

const drift = finance({ ApplicantID: "FODE-DRIFT", Receipt_Status: "", Payment_Verified: "Yes", Fee_Receipt_File: "" });
assert.equal(drift.financeAuthority.financeState, "NOT_YET_PAYMENT_APPLICABLE");
assert.ok(drift.audit.warnings.some((item) => /compatibility-only/.test(item)));

const amounts = finance({ ApplicantID: "FODE-AMOUNT", Receipt_Status: "", Fee_Total_Kina: "", Amount_Paid: "" });
assert.equal(amounts.amounts.totalFee.amount, null);
assert.equal(amounts.amounts.totalFee.state, "UNAVAILABLE");
assert.equal(amounts.amounts.outstandingBalance.amount, null);
assert.equal(amounts.amounts.outstandingBalance.state, "UNRESOLVED");

console.log("PASS canonical Finance DTO, APIs, and Operator Next route contract");
console.log("PASS Finance remains read-only and Receipt_Status-backed");
console.log("PASS policy-dependent finance states remain unresolved");
