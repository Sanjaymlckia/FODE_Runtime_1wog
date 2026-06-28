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
const resolveStatusCols = extractFunction(adminSource, "resolveStatusCols_");
const docsReviewVerifiedHelper = extractFunction(adminSource, "adminRowDocsReviewVerified_");

assert.match(resolveStatusCols, /docsCompat:\s*getCol_\(idx,\s*\["Docs_Verified"\]\)/, "Status column resolver must include Docs_Verified compatibility field");

assert.match(docsReviewVerifiedHelper, /clean_\(row\.Docs_Verified \|\| ""\) === "Yes" \|\| computeDocVerificationStatus_\(row\) === "Verified"/, "Document review helper must derive verified state from raw or computed status");
assert.match(reviewQueues, /docsReviewVerified = adminRowDocsReviewVerified_\(rowObj\)/, "Queue classifier must use the shared document-review authority helper");
assert.match(reviewQueues, /var docsQueueMatch = portalSubmitted && requiredDocumentUploadComplete && !docsReviewVerified;/, "Documents to Verify must continue excluding computed-verified rows");
assert.match(reviewQueues, /var awaitingPaymentQueueMatch = docsReviewVerified && !paymentVerified && !paymentEvidencePresent;/, "Awaiting Payment must include computed-verified docs even if Docs_Verified was stale");
assert.match(reviewQueues, /var paymentsQueueMatch = docsReviewVerified && !paymentVerified && paymentEvidencePresent;/, "Payments to Verify must include computed-verified docs with receipt evidence");
assert.match(reviewQueues, /var paidApprovedQueueMatch = paymentVerified;/, "Payment Verified queue must still depend on payment verification only");
assert.match(reviewQueues, /var anomaliesQueueMatch = paymentVerified && !docsReviewVerified;/, "Payment-first anomalies must still depend on payment verified before docs");

console.log("PASS review queues tolerate computed document verification for payment-stage routing");
console.log("PASS document queue still excludes computed-verified applicants");
console.log("PASS payment verified queue remains payment-authority driven");
