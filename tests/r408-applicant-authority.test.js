const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const CANONICAL_ID = "1fHmeGNmpOj9PEPQ5Fp4tUyCP4UdH70lltukraD4SalU";
const CANONICAL_TAB = "FODE_Data";
const ABANDONED_ID = "1YFgLtUExz__fzQ4zTNoIyGTu-nrnasS7dIaShNPl7Cs";
const ABANDONED_FIXTURE = "FODE-26-TEST-011";

function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.ok(start >= 0, `Missing function ${name}`);
  const open = source.indexOf("{", start);
  let depth = 0;
  for (let i = open; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Unbalanced function ${name}`);
}

function enclosingFunctionName(source, offset) {
  const prefix = source.slice(0, offset);
  const matches = [...prefix.matchAll(/^function\s+([A-Za-z0-9_$]+)\s*\(/gm)];
  assert.ok(matches.length, `Direct spreadsheet open at offset ${offset} is not in a named function`);
  return matches[matches.length - 1][1];
}

const deployableFiles = fs.readdirSync(".")
  .filter(file => /\.(?:js|html)$/.test(file))
  .sort();
const deployable = Object.fromEntries(
  deployableFiles.map(file => [file, fs.readFileSync(file, "utf8")])
);
const configSource = deployable["Config.js"];
const utilsSource = deployable["Utils.js"];
const codeSource = deployable["Code.js"];
const adminSource = deployable["Admin.js"];
const communicationsSource = deployable["Admin_SelectedApplicantCommunications.js"];
const adminUi = deployable["AdminUI.html"];
const operationsUi = deployable["AdminUI_OpsCommunications.html"];
const allDeployableSource = Object.entries(deployable)
  .map(([file, source]) => `\n/* ${file} */\n${source}`)
  .join("\n");

// One literal authority and one canonical tab are configured independently of code environment.
assert.match(configSource, new RegExp(`SPREADSHEET_ID_CANONICAL_APPLICANT:\\s*"${CANONICAL_ID}"`));
assert.match(configSource, /CANONICAL_APPLICANT_TAB:\s*"FODE_Data"/);
assert.match(configSource, /CODE_ENVIRONMENT:\s*"STAGING"/);
assert.match(configSource, /CAPABILITY_GRANTS_SPREADSHEET_CONFIG_KEY:\s*"SPREADSHEET_ID_CANONICAL_APPLICANT"/);
assert.doesNotMatch(configSource, /SPREADSHEET_ID_(?:STAGING|PROD(?:UCTION)?)|SHEET_ID_(?:STAGING|PROD(?:UCTION)?)/i);

// The abandoned workbook, fixture and legacy selectors cannot re-enter deployable source.
for (const [file, source] of Object.entries(deployable)) {
  assert.equal(source.includes(ABANDONED_ID), false, `${file} contains the abandoned applicant workbook`);
  assert.equal(source.includes(ABANDONED_FIXTURE), false, `${file} contains the abandoned fixture`);
  assert.doesNotMatch(source, /\bDATA_MODE\b/, `${file} contains legacy applicant DATA_MODE selection`);
  assert.doesNotMatch(source, /\b(?:STAGING|PRODUCTION)_SPREADSHEET_ID\b/i, `${file} contains a legacy spreadsheet selector`);
}

// Applicant resolution ignores deployment classification and injected legacy selector properties.
const clean = value => String(value == null ? "" : value).trim();
const goodSheet = {
  getId: () => CANONICAL_ID,
  getName: () => "FODE_Applications_2026",
  getSheetByName: name => name === CANONICAL_TAB ? { getName: () => CANONICAL_TAB } : null
};
const openedIds = [];
const authorityContext = {
  CONFIG: {
    CODE_ENVIRONMENT: "STAGING",
    SPREADSHEET_ID_CANONICAL_APPLICANT: CANONICAL_ID,
    CANONICAL_APPLICANT_TAB: CANONICAL_TAB,
    DATA_SHEET: CANONICAL_TAB,
    DATA_MODE: "STAGING",
    SPREADSHEET_ID_STAGING: ABANDONED_ID,
    PRODUCTION_SPREADSHEET_ID: "UNAPPROVED-PRODUCTION-ID"
  },
  clean_: clean,
  newDebugId_: () => "DBG-R408-AUTHORITY",
  Logger: { log: () => {} },
  Utilities: { getUuid: () => "00000000-0000-0000-0000-000000000000" },
  SpreadsheetApp: { openById: id => { openedIds.push(id); return goodSheet; } }
};
vm.createContext(authorityContext);
[
  "getCodeEnvironment_",
  "getCanonicalApplicantAuthority_",
  "assertCanonicalApplicantSpreadsheet_",
  "getWorkingSpreadsheetId_",
  "getWorkingSpreadsheet_",
  "getWorkingSheet_"
].forEach(name => vm.runInContext(extractFunction(utilsSource, name), authorityContext));

assert.equal(authorityContext.getWorkingSpreadsheetId_(), CANONICAL_ID);
assert.equal(authorityContext.getWorkingSpreadsheet_(), goodSheet);
assert.deepEqual(openedIds, [CANONICAL_ID]);
authorityContext.CONFIG.DATA_MODE = "PROD";
authorityContext.CONFIG.SPREADSHEET_ID_STAGING = "ANOTHER-UNAPPROVED-ID";
authorityContext.CONFIG.PRODUCTION_SPREADSHEET_ID = "YET-ANOTHER-UNAPPROVED-ID";
assert.equal(authorityContext.getWorkingSpreadsheetId_(), CANONICAL_ID);

authorityContext.SpreadsheetApp.openById = () => ({
  getId: () => ABANDONED_ID,
  getName: () => "Synthetic",
  getSheetByName: () => ({ getName: () => CANONICAL_TAB })
});
assert.throws(() => authorityContext.getWorkingSpreadsheet_(), /APPLICANT_SPREADSHEET_AUTHORITY_MISMATCH/);
authorityContext.SpreadsheetApp.openById = () => ({
  getId: () => CANONICAL_ID,
  getName: () => "FODE_Applications_2026",
  getSheetByName: () => null
});
assert.throws(() => authorityContext.getWorkingSpreadsheet_(), /CANONICAL_APPLICANT_TAB_MISSING/);
authorityContext.CONFIG.SPREADSHEET_ID_CANONICAL_APPLICANT = ABANDONED_ID;
assert.throws(() => authorityContext.getWorkingSpreadsheetId_(), /CANONICAL_APPLICANT_AUTHORITY_INVALID/);

// Form Designer intake and the shared applicant sheet helper both require the canonical resolver.
const doPostSource = extractFunction(codeSource, "doPost");
const mustGetDataSheetSource = extractFunction(codeSource, "mustGetDataSheet_");
assert.match(doPostSource, /var ss = getWorkingSpreadsheet_\(\)/);
assert.match(doPostSource, /var dataSheet = mustGetDataSheet_\(ss\)/);
assert.match(doPostSource, /POST HIT/);
assert.match(mustGetDataSheetSource, /assertCanonicalApplicantSpreadsheet_\(ss\)/);
assert.match(mustGetDataSheetSource, /getCanonicalApplicantAuthority_\(\)\.tabName/);

// Admin population and communication paths use the same resolver; Admin identity cannot redirect data.
assert.match(adminSource, /getWorkingSpreadsheet_\(\)/);
assert.match(adminSource, /getCanonicalApplicantAuthority_\(\)\.tabName/);
assert.doesNotMatch(adminSource, /SpreadsheetApp\.openBy(?:Id|Url)\s*\(/);
assert.match(communicationsSource, /getCanonicalApplicantAuthority_\(\)/);
assert.match(communicationsSource, /resolveApplicantMessageContext_\(/);
assert.match(codeSource, /REGRESSION_FIXTURE_EXCLUDED/);
assert.match(codeSource, /normal individual, Batch, Stage Batch, Student, and automated communication paths/);

// Only dedicated server routes may opt into the exact synthetic fixture bypass.
const bypassLocations = [];
for (const [file, source] of Object.entries(deployable)) {
  let match;
  const regex = /authorizedR408Fixture\s*:\s*true/g;
  while ((match = regex.exec(source))) bypassLocations.push(file);
}
assert.deepEqual(bypassLocations, [
  "Admin_SelectedApplicantCommunications.js"
]);
assert.match(communicationsSource, /serverTrustToken === adminR408FixtureServerTrust_/);
assert.doesNotMatch(adminUi + operationsUi, /authorizedR408Fixture/);
assert.doesNotMatch(adminUi + operationsUi, /FODE-26-TEST-011|data-r407|R407_FIXTURE/);
assert.match(operationsUi, /admin_bindR408Fixture/);
assert.match(operationsUi, /inputsMatch/);
assert.match(operationsUi, /displaysMatch/);
assert.match(operationsUi, /recipientsMatch/);
assert.match(operationsUi, /out\.applicantId\s*\|\|\s*""\)\.trim\(\)\s*===\s*applicantId/);
assert.match(communicationsSource, /\^FODE-26-\[0-9\]\{6\}\$/);
assert.match(communicationsSource, /FIXTURE_BINDING_MISMATCH/);
assert.match(communicationsSource, /FIXTURE_BULK_NOT_ALLOWED/);

// Every direct spreadsheet open is either the canonical resolver or a named sidecar boundary.
const allowedDirectOpenFunctions = new Set([
  "getCapabilityGrantsSpreadsheet_",
  "openPortalSecrets_",
  "test_Smoke",
  "getWorkingSpreadsheet_",
  "openPortalSecretsExistingSheet_",
  "commitPortalActivationState_"
]);
const observedDirectOpenFunctions = new Set();
for (const [file, source] of Object.entries(deployable)) {
  const regex = /SpreadsheetApp\.openBy(?:Id|Url)\s*\(/g;
  let match;
  while ((match = regex.exec(source))) {
    const functionName = enclosingFunctionName(source, match.index);
    observedDirectOpenFunctions.add(functionName);
    assert.ok(allowedDirectOpenFunctions.has(functionName), `${file}:${functionName} bypasses the canonical applicant resolver or named sidecar boundary`);
  }
}
assert.deepEqual([...observedDirectOpenFunctions].sort(), [...allowedDirectOpenFunctions].sort());
assert.match(extractFunction(utilsSource, "openPortalSecrets_"), /CONFIG\.PORTAL_SECRETS_SHEET_ID/);
assert.match(extractFunction(utilsSource, "test_Smoke"), /CONFIG\.LOG_SHEET_ID/);
assert.match(extractFunction(codeSource, "openPortalSecretsExistingSheet_"), /getPortalSecretsStoreConfig_/);
assert.match(extractFunction(codeSource, "commitPortalActivationState_"), /PORTAL_SECRETS_SPREADSHEET_ID/);
assert.match(extractFunction(deployable["Admin_CapabilityGrants.js"], "getCapabilityGrantsSpreadsheetId_"), /CAPABILITY_GRANTS_SPREADSHEET_CONFIG_KEY/);
assert.match(extractFunction(deployable["Admin_CapabilityGrants.js"], "getCapabilityGrantsSpreadsheet_"), /CAPABILITY_GRANTS_SPREADSHEET_ID_MISMATCH/);

// The fixture-only controls do not introduce bulk, Student or deployment mutation actions.
for (const functionName of [
  "admin_bindR408Fixture",
  "admin_previewFixtureCommunication",
  "admin_reconcileFixturePortalSecret",
  "admin_prepareFixtureCommunication",
  "admin_sendFixtureCommunication"
]) {
  const route = extractFunction(communicationsSource, functionName);
  assert.doesNotMatch(route, /clasp|deployment|repin|Student|Production|runApplicantBatch|runStageBatch|GmailApp\.sendEmail/);
}

console.log(`r408 applicant authority tests passed (${deployableFiles.length} deployable files scanned)`);
