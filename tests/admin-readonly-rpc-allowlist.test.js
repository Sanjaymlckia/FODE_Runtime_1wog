const assert = require("node:assert/strict");
const path = require("node:path");
const { READ_ONLY_RPC_ALLOWLIST, financeReadOnlyPayload, evidencePath } = require("../tools/fode-readonly-browser-rpc.js");
const source = require("node:fs").readFileSync("tools/fode-readonly-browser-rpc.js", "utf8");

const expected = {
  "finance-summary": "admin_getCanonicalFinanceSummary",
  "finance-worklist": "admin_getCanonicalFinanceWorklist",
  "finance-applicant": "admin_getCanonicalFinanceApplicant",
  "finance-reconciliation": "admin_getCanonicalFinanceReconciliation",
  "finance-exceptions": "admin_getCanonicalFinanceExceptions",
  "finance-object-history": "admin_getCanonicalFinanceObjectHistory",
  "finance-policy-status": "admin_getCanonicalFinancePolicyStatus"
};
assert.deepEqual(READ_ONLY_RPC_ALLOWLIST, expected);
assert.ok(!Object.values(READ_ONLY_RPC_ALLOWLIST).some((name) => /set|send|create|update|delete|verifyPayment/i.test(name)), "Diagnostic bridge must contain no mutation RPC");
assert.equal(Object.prototype.hasOwnProperty.call(READ_ONLY_RPC_ALLOWLIST, "admin_setPaymentVerified"), false);
assert.equal(Object.prototype.hasOwnProperty.call(READ_ONLY_RPC_ALLOWLIST, "arbitrary"), false);

const request = financeReadOnlyPayload("finance-worklist", { page: "2", "page-size": "999", search: "FODE-26-000120", worklist: "PAYMENT_REVIEW" });
assert.equal(request.page, 2);
assert.equal(request.pageSize, 100, "Diagnostic bridge must cap Finance pages at 100");
assert.equal(request.searchQuery, "FODE-26-000120");
assert.equal(request.filters.worklistKey, "PAYMENT_REVIEW");
assert.throws(() => financeReadOnlyPayload("finance-applicant", {}), /applicant-id is required/);

const repoRoot = path.resolve(__dirname, "..");
assert.match(evidencePath(repoRoot, "finance-summary", ""), /\.release-proof/);
assert.throws(() => evidencePath(repoRoot, "finance-summary", path.resolve(repoRoot, "outside.json")), /must remain under \.release-proof/);
assert.match(source, /require\("\.\/auth-fode-admin-playwright"\)/, "Read-only RPC bridge must use the canonical auth module");
assert.match(source, /\?view=eduops/, "Read-only RPC bridge must target the canonical EduOps route");
assert.doesNotMatch(source, /google\.script\.run\[[^\]]*args\.(?:fn|function|rpc)/, "Read-only RPC bridge must not expose generic RPC passthrough");

console.log("PASS fixed authenticated read-only Finance RPC allowlist rejects mutation and arbitrary names");
