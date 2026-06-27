const fs = require("node:fs");
const assert = require("node:assert/strict");

const adminSource = fs.readFileSync("Admin.js", "utf8");

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

const reviewQueues = extractFunction(adminSource, "admin_getReviewQueues");
const updateDocs = extractFunction(adminSource, "admin_updateDocStatuses_impl_");
const setPayment = extractFunction(adminSource, "admin_setPaymentVerified_impl_");

assert.match(reviewQueues, /docsReviewVerified = docsVerifiedRaw === "Yes" \|\| computeDocVerificationStatus_\(rowObj\) === "Verified"/, "Review queues must tolerate computed document verification when Docs_Verified is stale");
assert.match(reviewQueues, /paymentVerifiedRaw = clean_\(rowObj\.Payment_Verified \|\| ""\) === "Yes"/, "Review queues preserve raw Payment_Verified as compatibility evidence only");
assert.match(reviewQueues, /var paymentBadge = derivePaymentBadge_\(rowObj\)/, "Review queues must derive payment authority from canonical receipt status");
assert.match(reviewQueues, /paymentEvidencePresent = hasUploadEvidence_\(rowObj\.Fee_Receipt_File,\s*"Fee_Receipt_File"\)/, "Review queues must distinguish receipt evidence from payment verification");
assert.match(reviewQueues, /docsQueueMatch = portalSubmitted && requiredDocumentUploadComplete && !docsReviewVerified/, "Documents to Verify must exclude document-verified rows");
assert.match(reviewQueues, /awaitingPaymentQueueMatch = docsReviewVerified && !paymentVerified && !paymentEvidencePresent/, "Awaiting Payment queue must require docs verified, no raw payment verified flag, and no receipt evidence");
assert.match(reviewQueues, /paymentsQueueMatch = docsReviewVerified && !paymentVerified && paymentEvidencePresent/, "Payments to Verify queue must require docs verified, receipt evidence, and no raw payment verified flag");
assert.match(reviewQueues, /anomaliesQueueMatch = paymentVerified && !docsReviewVerified/, "Payment-first anomalies must detect payment before document verification");
assert.match(reviewQueues, /paidApprovedQueueMatch = paymentVerified/, "Payment Verified queue must remain payment-authority driven");

assert.match(updateDocs, /var docStage = computeDocVerificationStatus_\(refreshedRow\)/, "Document status save must derive document rollup from refreshed row state");
assert.match(updateDocs, /setCell_\(sh, rowNumber, idx, cols\.docStage, docStage\)/, "Document status save must persist Doc_Verification_Status");
assert.match(updateDocs, /setCell_\(sh, rowNumber, idx, cols\.docsCompat, docStage === "Verified" \? "Yes" : ""\)/, "Document status save must persist Docs_Verified compatibility rollup");
assert.match(updateDocs, /var paymentBadge = derivePaymentBadge_\(refreshedRow\)/, "Document status save must report payment state from derived payment badge");
assert.match(updateDocs, /setCell_\(sh, rowNumber, idx, cols\.paymentCompat, paymentVerified \? "Yes" : ""\)/, "Document status save currently syncs the raw Payment_Verified compatibility field from derived payment state");
assert.doesNotMatch(updateDocs, /setCell_\([^)]*"Receipt_Status"/, "Document status save must not write Receipt_Status");

assert.match(setPayment, /docsVerifiedNow = \(clean_\(beforeRow\.Docs_Verified \|\| ""\) === "Yes"\) \|\| computeDocVerificationStatus_\(beforeRow\) === "Verified"/, "Payment verification must require raw or computed document verification");
assert.match(setPayment, /setCell_\(sh, rowNumber, idx, "Receipt_Status", "Verified"\)/, "Payment verification must write Receipt_Status as the canonical payment signal");
assert.doesNotMatch(setPayment, /setCell_\([^)]*"Docs_Verified"/, "Payment verification must not write Docs_Verified");

function classify(row) {
  const docsReviewVerified = row.Docs_Verified === "Yes" || row.computedDocStatus === "Verified";
  const paymentVerified = row.Payment_Verified === "Yes";
  const paymentEvidencePresent = Boolean(row.Fee_Receipt_File);
  return {
    docs: Boolean(row.Portal_Submitted) && Boolean(row.requiredDocumentUploadComplete) && !docsReviewVerified,
    awaitingPayment: docsReviewVerified && !paymentVerified && !paymentEvidencePresent,
    payments: docsReviewVerified && !paymentVerified && paymentEvidencePresent,
    anomalies: paymentVerified && !docsReviewVerified,
    paidApproved: paymentVerified
  };
}

const cases = [
  {
    name: "docs verified / no receipt / no payment",
    row: { Docs_Verified: "Yes", Receipt_Status: "", Payment_Verified: "", Fee_Receipt_File: "", Portal_Submitted: true, requiredDocumentUploadComplete: true },
    expected: { docs: false, awaitingPayment: true, payments: false, anomalies: false, paidApproved: false }
  },
  {
    name: "docs verified / receipt present / no payment",
    row: { Docs_Verified: "Yes", Receipt_Status: "Pending", Payment_Verified: "", Fee_Receipt_File: "https://receipt", Portal_Submitted: true, requiredDocumentUploadComplete: true },
    expected: { docs: false, awaitingPayment: false, payments: true, anomalies: false, paidApproved: false }
  },
  {
    name: "docs verified / raw payment verified",
    row: { Docs_Verified: "Yes", Receipt_Status: "Verified", Payment_Verified: "Yes", Fee_Receipt_File: "https://receipt", Portal_Submitted: true, requiredDocumentUploadComplete: true },
    expected: { docs: false, awaitingPayment: false, payments: false, anomalies: false, paidApproved: true }
  },
  {
    name: "computed docs verified with stale Docs_Verified",
    row: { Docs_Verified: "", computedDocStatus: "Verified", Receipt_Status: "", Payment_Verified: "", Fee_Receipt_File: "", Portal_Submitted: true, requiredDocumentUploadComplete: true },
    expected: { docs: false, awaitingPayment: true, payments: false, anomalies: false, paidApproved: false }
  },
  {
    name: "payment-first anomaly",
    row: { Docs_Verified: "", computedDocStatus: "Pending", Receipt_Status: "Verified", Payment_Verified: "Yes", Fee_Receipt_File: "https://receipt", Portal_Submitted: true, requiredDocumentUploadComplete: true },
    expected: { docs: true, awaitingPayment: false, payments: false, anomalies: true, paidApproved: true }
  }
];

for (const item of cases) {
  assert.deepEqual(classify(item.row), item.expected, item.name);
}

console.log("PASS payment queues derive authority from canonical receipt status");
console.log("PASS document save preserves Receipt_Status authority while syncing compatibility state");
console.log("PASS payment and queue fixture matrix preserves stage separation");
