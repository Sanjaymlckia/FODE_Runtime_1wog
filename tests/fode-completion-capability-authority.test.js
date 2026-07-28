const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const configSource = fs.readFileSync("Config.js", "utf8");
const accessSource = fs.readFileSync("Admin_AccessControl.js", "utf8");
const grantsSource = fs.readFileSync("Admin_CapabilityGrants.js", "utf8");

const configContext = {};
vm.createContext(configContext);
vm.runInContext(configSource, configContext);

const context = {
  CONFIG: configContext.CONFIG,
  getZohoBooksWriteAdminEmails_: () => [],
  loadActiveTemporaryCapabilityGrantsForAccount_: () => []
};
vm.createContext(context);
vm.runInContext(accessSource, context);

const requiredCapabilities = [
  "CAN_REVIEW_FINANCE_EXCEPTIONS",
  "CAN_MANAGE_FINANCE_HANDOFF",
  "CAN_READ_REGISTRY",
  "CAN_MANAGE_REGISTRY",
  "CAN_REVIEW_EXAM_ELIGIBILITY",
  "CAN_READ_PORTAL_STATUS",
  "CAN_ADMIN_PORTAL_ACCESS",
  "CAN_READ_CLASSROOM",
  "CAN_MANAGE_CLASSROOM_HANDOFF",
  "CAN_READ_MANAGEMENT_REPORTS",
  "CAN_READ_DELIVERY_HISTORY"
];

const catalog = context.adminCapabilityCatalog_();
for (const capability of requiredCapabilities) {
  assert.equal(catalog.includes(capability), true, `${capability} must be in the canonical capability catalogue`);
  assert.notEqual(context.adminCapabilityBlockCode_(capability), "ROLE_BLOCKED", `${capability} needs an exact denial code`);
}

const principal = context.resolveAdminCapabilities_("principal@kundu.ac");
assert.equal(principal.capabilities.CAN_OPEN_REVIEW_WORKSPACE, true);
assert.equal(principal.capabilities.CAN_READ_FINANCE, true);
assert.equal(principal.capabilities.CAN_REVIEW_FINANCE_EXCEPTIONS, true);
assert.equal(principal.capabilities.CAN_MANAGE_FINANCE_HANDOFF, true);
for (const capability of requiredCapabilities.filter((key) => !/FINANCE/.test(key))) {
  assert.equal(principal.capabilities[capability], false, `Principal must not inherit ${capability}`);
}
assert.equal(principal.capabilities.CAN_WRITE_ZOHO_BOOKS, false);

const verifier = context.resolveAdminCapabilities_("enquiries@kundu.ac");
const operations = context.resolveAdminCapabilities_("operations@minervacenters.com");
for (const capability of requiredCapabilities) {
  assert.equal(verifier.capabilities[capability], false, `Verifier must not inherit ${capability}`);
  assert.equal(operations.capabilities[capability], false, `Operations must not inherit ${capability}`);
}

const superAdmin = context.resolveAdminCapabilities_("sanjay@minervacenters.com");
for (const capability of requiredCapabilities) {
  assert.equal(superAdmin.capabilities[capability], true, `Super must retain ${capability}`);
}

const delegableFunction = grantsSource.match(/function temporaryDelegableAdminCapabilities_\(\)\s*\{[\s\S]*?\n\}/)?.[0] || "";
for (const capability of requiredCapabilities) {
  assert.match(delegableFunction, new RegExp(`"${capability}"`), `${capability} must be temporarily delegable by Super`);
}

console.log("PASS completion capabilities are catalogued, fail closed, and are delegable only through existing Super grant authority");
console.log("PASS Principal receives only durable Finance exception and handoff authority from the completion capability set");
