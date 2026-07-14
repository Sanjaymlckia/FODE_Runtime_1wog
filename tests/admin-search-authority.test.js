const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("Admin.js", "utf8");

function extractFunction(code, name) {
  const marker = `function ${name}`;
  const start = code.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist`);
  const brace = code.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = brace; i < code.length; i += 1) {
    const ch = code[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth += 1;
    else if (ch === "}" && --depth === 0) return code.slice(start, i + 1);
  }
  throw new Error(`${name} is not closed`);
}

const fn = extractFunction(source, "admin_searchApplicants");
assert.match(fn, /canonicalPopulationSnapshot_\(\)/, "Search must use canonical population authority");
assert.doesNotMatch(fn, /getDataRange\(\)\.getValues\(\)/, "Search must not scan the sheet independently");

const fixtures = [
  {
    identity: { applicantId: "FODE-26-002959", rowNumber: 2959 },
    applicant: { name: "Keziah Waffi", effectiveEmail: "waffi@example.test", phone: "6757123456" },
    lifecycle: { baseState: "PAYMENT_PENDING", lifecycleStage: "PAYMENT_PENDING", overlays: [], recommendedNextAction: "SEND_PAYMENT_REMINDER", recommendedMessageType: "payment_followup", actionOwner: "APPLICANT", reason: "Awaiting payment evidence." },
    actionability: { state: "READY", selectable: true, selectBlockReason: "", recommendedAction: "payment_followup", recommendedMessageType: "payment_followup", actionOwner: "APPLICANT", urgencyLevel: "DUE" },
    finance: { financeAuthority: { financeState: "PAYMENT_PENDING" } },
    contactability: { hasValidEmail: true }
  },
  {
    identity: { applicantId: "FODE-26-003230", rowNumber: 3230 },
    applicant: { name: "Stephanie Duba", effectiveEmail: "steph@example.test", phone: "6757000002" },
    lifecycle: { baseState: "INCOMPLETE_DOCUMENTS", lifecycleStage: "INCOMPLETE_DOCUMENTS", overlays: [], recommendedNextAction: "UPLOAD_REQUIRED_DOCUMENTS", recommendedMessageType: "docs_missing", actionOwner: "APPLICANT", reason: "Docs missing." },
    actionability: { state: "COOLING_OFF", selectable: false, selectBlockReason: "Cooling-off active", recommendedAction: "WAIT", recommendedMessageType: "docs_missing", actionOwner: "APPLICANT", urgencyLevel: "NORMAL" },
    finance: { financeAuthority: { financeState: "NOT_YET_PAYMENT_APPLICABLE" } },
    contactability: { hasValidEmail: true }
  }
];

const context = {
  console,
  clean_: (value) => String(value == null ? "" : value).trim(),
  getCallerEmail_: () => "admin@example.test",
  isAdmin_: () => true,
  canonicalPopulationSnapshot_: () => ({ rows: fixtures })
};
vm.createContext(context);
vm.runInContext(fn, context);

const byName = context.admin_searchApplicants({ name: "waffi" });
assert.equal(byName.ok, true);
assert.equal(byName.rows.length, 1);
assert.equal(byName.rows[0].applicantId, "FODE-26-002959");
assert.equal(byName.rows[0].paymentVerified, "Payment Pending");

const byId = context.admin_searchApplicants({ applicantId: "FODE-26-002959" });
assert.equal(byId.rows.length, 1);
assert.equal(byId.rows[0].name, "Keziah Waffi");

const byPhone = context.admin_searchApplicants({ phone: "123456" });
assert.equal(byPhone.rows.length, 1);
assert.equal(byPhone.rows[0].applicantId, "FODE-26-002959");

const stageFiltered = context.admin_searchApplicants({ name: "steph", stage: "INCOMPLETE_DOCUMENTS" });
assert.equal(stageFiltered.rows.length, 1);
assert.equal(stageFiltered.rows[0].applicantId, "FODE-26-003230");

const stageBlocked = context.admin_searchApplicants({ name: "steph", stage: "PAYMENT_PENDING" });
assert.equal(stageBlocked.rows.length, 0);

console.log("PASS admin search uses shared canonical population authority");
console.log("PASS applicant ID, name, phone, and stage filters resolve exact review identities");
