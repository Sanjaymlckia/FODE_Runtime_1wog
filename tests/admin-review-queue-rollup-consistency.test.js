const fs = require("node:fs");
const assert = require("node:assert/strict");

const adminSource = [
  fs.readFileSync("Admin.js", "utf8"),
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

const reviewQueues = extractFunction(adminSource, "admin_getReviewQueues");
const resolveStatusCols = extractFunction(adminSource, "resolveStatusCols_");
const docsReviewVerifiedHelper = extractFunction(adminSource, "adminRowDocsReviewVerified_");
const docPaymentGateHelper = extractFunction(adminSource, "adminDocumentReviewVerifiedForPaymentGate_");

assert.match(resolveStatusCols, /docsCompat:\s*getCol_\(idx,\s*\["Docs_Verified"\]\)/, "Status column resolver must include Docs_Verified compatibility field");

assert.match(docPaymentGateHelper, /clean_\(row\.Docs_Verified \|\| ""\) === "Yes" \|\| computeDocVerificationStatus_\(row\) === "Verified"/, "Document review payment-gate helper must derive verified state from raw or computed status");
assert.match(docsReviewVerifiedHelper, /adminDocumentReviewVerifiedForPaymentGate_\(rowObj\)/, "Document review helper must delegate to the shared payment-gate helper");
assert.match(reviewQueues, /buildOperationalRouteSnapshot_\(canonicalPopulationSnapshot_\(\), \{\}\)/, "Review queue compatibility surface must consume the shared operational route projection");
assert.match(reviewQueues, /docs:\s*\(operational\.routeRows && operational\.routeRows\.ADMISSIONS_REVIEW \|\| \[\]\)\.map\(buildReviewQueueRow_\)/, "Documents to Verify compatibility queue must be sourced from the shared Admissions cohort");
assert.match(reviewQueues, /awaitingPayment:[\s\S]*row\.financeState[\s\S]*PAYMENT_PENDING[\s\S]*row\.activeFinanceWork === true/, "Awaiting Payment compatibility queue must come from shared active finance pending rows");
assert.match(reviewQueues, /payments:[\s\S]*row\.financeState[\s\S]*PAYMENT_TO_VERIFY[\s\S]*row\.activeFinanceWork === true/, "Payments to Verify compatibility queue must come from shared active receipt-verification rows");
assert.match(reviewQueues, /paidApproved:[\s\S]*row\.financeState[\s\S]*PAID_VERIFIED/, "Payment Verified compatibility queue must come from shared verified-payment rows");
assert.match(reviewQueues, /anomalies:[\s\S]*row\.financeExceptionCode[\s\S]*MANAGEMENT_EXCEPTIONS[\s\S]*UNKNOWN_UNCLASSIFIED/, "Anomalies compatibility queue must be sourced from explicit shared exception cohorts");

console.log("PASS review queues now consume the shared operational route projection");
console.log("PASS finance compatibility queues are derived from shared finance authority states");
console.log("PASS document verification compatibility helper remains preserved");
