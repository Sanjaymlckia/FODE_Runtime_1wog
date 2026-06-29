const fs = require("node:fs");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const codeSource = fs.readFileSync("Code.js", "utf8");
const adminSource = [
  fs.readFileSync("Admin.js", "utf8"),
  fs.readFileSync("Admin_PaymentAuthority.js", "utf8"),
  fs.readFileSync("Admin_ReviewQueues.js", "utf8"),
  fs.readFileSync("Admin_ReviewStatusAuthority.js", "utf8"),
  fs.readFileSync("Admin_RowFacts.js", "utf8")
].join("\n");

function extractFunction(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Function ${name} must exist`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "\"" || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Function ${name} is not closed`);
}

const context = {
  clean_: (value) => String(value == null ? "" : value).trim(),
  hasOwn_: (obj, key) => Object.prototype.hasOwnProperty.call(obj || {}, key),
  logOperationalBlock_: () => {}
};
vm.createContext(context);
vm.runInContext([
  extractFunction(codeSource, "resolveDocStatusKeys_"),
  extractFunction(codeSource, "normalizeOverallDocValue_"),
  extractFunction(codeSource, "computeDocVerificationStatus_"),
  extractFunction(codeSource, "derivePaymentBadge_"),
  extractFunction(codeSource, "deriveCanonicalPaymentState_"),
  extractFunction(codeSource, "canonicalPaymentBadge_"),
  extractFunction(codeSource, "isCanonicalPaymentVerified_"),
  extractFunction(codeSource, "isCanonicalPaymentRejected_"),
  extractFunction(codeSource, "isPaymentVerifiedDerived_"),
  extractFunction(codeSource, "computeOverallStatus_")
].join("\n\n"), context);

const paymentCases = [
  {
    name: "raw payment verified but canonical receipt blank",
    row: { Receipt_Status: "", Payment_Verified: "Yes" },
    expectedBadge: "Pending",
    expectedDerived: false,
    expectedCompatAfterOverall: ""
  },
  {
    name: "canonical receipt verified but raw payment stale blank",
    row: { Receipt_Status: "Verified", Payment_Verified: "" },
    expectedBadge: "Verified",
    expectedDerived: true,
    expectedCompatAfterOverall: "Yes"
  },
  {
    name: "canonical and raw payment both verified",
    row: { Receipt_Status: "Verified", Payment_Verified: "Yes" },
    expectedBadge: "Verified",
    expectedDerived: true,
    expectedCompatAfterOverall: "Yes"
  },
  {
    name: "conflicting rejected receipt and raw payment verified",
    row: { Receipt_Status: "Rejected", Payment_Verified: "Yes" },
    expectedBadge: "Rejected",
    expectedDerived: false,
    expectedCompatAfterOverall: ""
  },
  {
    name: "pending receipt and raw payment blank",
    row: { Receipt_Status: "Pending", Payment_Verified: "" },
    expectedBadge: "Pending",
    expectedDerived: false,
    expectedCompatAfterOverall: ""
  }
];

for (const item of paymentCases) {
  const row = Object.assign({}, item.row);
  assert.equal(context.canonicalPaymentBadge_(row), item.expectedBadge, item.name);
  assert.equal(context.isPaymentVerifiedDerived_(row), item.expectedDerived, item.name);
  context.computeOverallStatus_(row);
  assert.equal(row.Payment_Verified, item.expectedCompatAfterOverall, `${item.name}: compatibility projection must follow canonical receipt badge`);
}

function classifyWithCanonicalQueueLogic(row) {
  const docsReviewVerified = row.Docs_Verified === "Yes" || row.computedDocStatus === "Verified";
  const paymentVerified = row.Receipt_Status === "Verified";
  const paymentEvidencePresent = Boolean(row.Fee_Receipt_File);
  return {
    awaitingPayment: docsReviewVerified && !paymentVerified && !paymentEvidencePresent,
    payments: docsReviewVerified && !paymentVerified && paymentEvidencePresent,
    anomalies: paymentVerified && !docsReviewVerified,
    paidApproved: paymentVerified
  };
}

assert.deepEqual(
  classifyWithCanonicalQueueLogic({ Docs_Verified: "Yes", Receipt_Status: "Pending", Payment_Verified: "", Fee_Receipt_File: "https://receipt" }),
  { awaitingPayment: false, payments: true, anomalies: false, paidApproved: false },
  "docs verified + receipt present + payment not verified must route to Payments to Verify"
);
assert.deepEqual(
  classifyWithCanonicalQueueLogic({ Docs_Verified: "Yes", Receipt_Status: "Verified", Payment_Verified: "", Fee_Receipt_File: "" }),
  { awaitingPayment: false, payments: false, anomalies: false, paidApproved: true },
  "docs verified + canonical payment verified + missing receipt routes as paid-approved payment authority state"
);
assert.deepEqual(
  classifyWithCanonicalQueueLogic({ Docs_Verified: "Yes", Receipt_Status: "", Payment_Verified: "Yes", Fee_Receipt_File: "" }),
  { awaitingPayment: true, payments: false, anomalies: false, paidApproved: false },
  "raw Payment_Verified yes with blank Receipt_Status must not classify as payment verified"
);
assert.deepEqual(
  classifyWithCanonicalQueueLogic({ Docs_Verified: "Yes", Receipt_Status: "Rejected", Payment_Verified: "Yes", Fee_Receipt_File: "https://receipt" }),
  { awaitingPayment: false, payments: true, anomalies: false, paidApproved: false },
  "raw Payment_Verified yes with rejected Receipt_Status must not classify as payment verified"
);
assert.deepEqual(
  classifyWithCanonicalQueueLogic({ Docs_Verified: "", computedDocStatus: "Pending", Receipt_Status: "Verified", Payment_Verified: "Yes", Fee_Receipt_File: "https://receipt" }),
  { awaitingPayment: false, payments: false, anomalies: true, paidApproved: true },
  "payment-first anomaly remains visible when canonical payment is verified before document verification"
);

const reviewQueues = extractFunction(adminSource, "admin_getReviewQueues");
const updateDocs = extractFunction(adminSource, "admin_updateDocStatuses_impl_");
const setPayment = extractFunction(adminSource, "admin_setPaymentVerified_impl_");
const paymentFactsHelper = extractFunction(adminSource, "adminRowPaymentAuthorityFacts_");

assert.match(paymentFactsHelper, /paymentVerifiedRaw: adminRowPaymentCompatibilityRawVerified_\(row\)/, "Queues may retain raw Payment_Verified as compatibility evidence");
assert.match(paymentFactsHelper, /paymentBadge: canonicalPaymentBadge_\(row\)/, "Queues must derive payment badge from canonical receipt status");
assert.match(paymentFactsHelper, /paymentVerified: isCanonicalPaymentVerified_\(row\)/, "Queues must classify payment stage from canonical payment helper");
assert.match(reviewQueues, /paymentFacts = adminRowPaymentAuthorityFacts_\(rowObj\)/, "Queues must consume centralized payment authority facts");
assert.doesNotMatch(reviewQueues, /paymentVerified = paymentVerifiedRaw/, "Queues must not classify payment stage from raw compatibility state");
assert.match(updateDocs, /var paymentBadge = canonicalPaymentBadge_\(refreshedRow\)/, "Document save must derive payment display from canonical receipt status");
assert.match(updateDocs, /setCell_\(sh, rowNumber, idx, cols\.paymentCompat, paymentVerified \? "Yes" : ""\)/, "Document save may only project Payment_Verified compatibility from derived payment state");
assert.doesNotMatch(updateDocs, /setCell_\([^)]*"Receipt_Status"/, "Document save must not write canonical Receipt_Status");
assert.match(setPayment, /setCell_\(sh, rowNumber, idx, "Receipt_Status", "Verified"\)/, "Payment verification must write canonical Receipt_Status");
assert.doesNotMatch(setPayment, /setCell_\([^)]*"Docs_Verified"/, "Payment verification must not write Docs_Verified");

console.log("PASS canonical payment helper ignores raw Payment_Verified drift");
console.log("PASS payment queues ignore raw Payment_Verified drift for classification");
console.log("PASS document and payment save authority boundaries remain separated");
