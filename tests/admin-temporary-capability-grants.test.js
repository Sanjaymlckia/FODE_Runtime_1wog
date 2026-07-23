const fs = require("node:fs");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const configSource = fs.readFileSync("Config.js", "utf8");
const accessSource = fs.readFileSync("Admin_AccessControl.js", "utf8");
const grantsSource = fs.readFileSync("Admin_CapabilityGrants.js", "utf8");
const operatorNextSource = fs.readFileSync("AdminUI_OperatorNext.html", "utf8");
const claspIgnore = fs.readFileSync(".claspignore", "utf8");
const readonlyBrowserRpcTool = fs.readFileSync("tools/fode-readonly-browser-rpc.js", "utf8");
const runtimeContext = JSON.parse(fs.readFileSync("runtime-context.json", "utf8"));

class MockRange {
  constructor(sheet, row, column, rows, columns) {
    this.sheet = sheet;
    this.row = row;
    this.column = column;
    this.rows = rows;
    this.columns = columns;
  }
  getValues() {
    return Array.from({ length: this.rows }, (_, r) => Array.from({ length: this.columns }, (_, c) => {
      const source = this.sheet.rows[this.row - 1 + r] || [];
      return source[this.column - 1 + c] == null ? "" : source[this.column - 1 + c];
    }));
  }
  setValues(values) {
    for (let r = 0; r < this.rows; r += 1) {
      while (this.sheet.rows.length < this.row + r) this.sheet.rows.push([]);
      for (let c = 0; c < this.columns; c += 1) this.sheet.rows[this.row - 1 + r][this.column - 1 + c] = values[r][c];
    }
    return this;
  }
}

class MockSheet {
  constructor(name) { this.name = name; this.rows = []; this.frozenRows = 0; }
  getName() { return this.name; }
  getLastRow() { return this.rows.length; }
  getLastColumn() { return this.rows.reduce((max, row) => Math.max(max, row.length), 0); }
  getRange(row, column, rows = 1, columns = 1) { return new MockRange(this, row, column, rows, columns); }
  appendRow(row) { this.rows.push(row.slice()); return this; }
  setFrozenRows(count) { this.frozenRows = count; }
}

class MockSpreadsheet {
  constructor(id = CONFIG && CONFIG.SPREADSHEET_ID_PROD || "MOCK-SPREADSHEET", name = "FODE Authoritative") { this.sheets = {}; this.id = id; this.name = name; }
  getId() { return this.id; }
  getName() { return this.name; }
  getSheets() { return Object.values(this.sheets); }
  getSheetByName(name) { return this.sheets[name] || null; }
  insertSheet(name) {
    assert.equal(this.sheets[name], undefined, "Initializer must not replace an existing tab");
    const sheet = new MockSheet(name);
    this.sheets[name] = sheet;
    return sheet;
  }
}

const configContext = {};
vm.createContext(configContext);
vm.runInContext(configSource, configContext);
const CONFIG = configContext.CONFIG;
const spreadsheet = new MockSpreadsheet();
const applicantSheet = spreadsheet.insertSheet("FODE_Data");
applicantSheet.appendRow(["ApplicantID", "Email"]);
applicantSheet.appendRow(["FODE-26-TEST-001", "test@example.test"]);
const applicantSnapshot = JSON.stringify(applicantSheet.rows);
const audit = [];
const cacheValues = new Map();
const removedCacheKeys = [];
let callerEmail = "sanjay@minervacenters.com";
let uuidCounter = 0;

const context = {
  CONFIG,
  console,
  Date,
  JSON,
  Math,
  isFinite,
  getWorkingSpreadsheet_: () => spreadsheet,
  getCallerEmail_: () => callerEmail,
  getZohoBooksWriteAdminEmails_: () => [],
  newDebugId_: () => `DBG-${++uuidCounter}`,
  Utilities: { getUuid: () => `00000000-0000-4000-8000-${String(++uuidCounter).padStart(12, "0")}` },
  LockService: {
    getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} })
  },
  CacheService: {
    getScriptCache: () => ({
      get: (key) => cacheValues.get(key) || null,
      put: (key, value) => cacheValues.set(key, value),
      remove: (key) => { removedCacheKeys.push(key); cacheValues.delete(key); }
    })
  },
  logAudit_: (event, payload) => audit.push({ event, payload }),
  withEnvelope_: (_name, fn) => {
    try {
      const result = fn("DBG-TEST");
      return result && typeof result.ok === "boolean" ? result : Object.assign({ ok: true }, result || {});
    } catch (error) {
      return { ok: false, message: String(error.message || error) };
    }
  }
};
vm.createContext(context);
vm.runInContext(accessSource, context);
vm.runInContext(grantsSource, context);

const headers = context.capabilityGrantSchemaHeaders_();
assert.deepEqual(Array.from(headers), [
  "Grant_ID", "Account_Email", "Capability_Key", "Grant_Type", "Status", "Granted_By_Email", "Granted_By_Role",
  "Granted_At", "Starts_At", "Expires_At", "Reason", "Scope_Type", "Scope_Payload_JSON", "Usage_Limit",
  "Used_Count", "Used_At", "Revoked_By_Email", "Revoked_At", "Revocation_Reason", "Created_Runtime_Identity",
  "Updated_At", "Record_Version"
]);

const dryRun = context.initializeCapabilityGrantSheet_({ spreadsheet });
assert.equal(dryRun.ok, true);
assert.equal(dryRun.action, "CREATE_REQUIRED");
assert.equal(spreadsheet.getSheetByName("Capability_Grants"), null, "Dry-run must not create the live schema");
assert.equal(dryRun.workbookId, CONFIG.SPREADSHEET_ID_PROD);

const missingConfirmation = context.initializeCapabilityGrantSheet_({ spreadsheet, apply: true });
assert.equal(missingConfirmation.ok, false);
assert.equal(missingConfirmation.action, "CONFIRMATION_REQUIRED");

const initialized = context.initializeCapabilityGrantSheet_({ spreadsheet, apply: true, confirmation: "CREATE_CAPABILITY_GRANTS" });
assert.equal(initialized.ok, true);
assert.equal(initialized.created, true);
assert.equal(JSON.stringify(applicantSheet.rows), applicantSnapshot, "Migration must not alter existing applicant tabs");
const sheet = spreadsheet.getSheetByName("Capability_Grants");
assert.deepEqual(sheet.rows[0], Array.from(headers));
assert.equal(context.validateCapabilityGrantSheetSchema_(sheet).ok, true);
assert.equal(context.initializeCapabilityGrantSheet_({ spreadsheet, apply: true, confirmation: "CREATE_CAPABILITY_GRANTS" }).action, "NO_CHANGE");
sheet.rows[0].push("Unexpected_Column");
assert.equal(context.validateCapabilityGrantSheetSchema_(sheet).ok, false, "Schema validator must reject unapproved extra columns");
sheet.rows[0].pop();

const brokenSpreadsheet = new MockSpreadsheet();
const broken = brokenSpreadsheet.insertSheet("Capability_Grants");
broken.appendRow(["Wrong_Header"]);
const refused = context.initializeCapabilityGrantSheet_({ spreadsheet: brokenSpreadsheet, apply: true, confirmation: "CREATE_CAPABILITY_GRANTS" });
assert.equal(refused.ok, false);
assert.equal(refused.action, "REFUSED_DESTRUCTIVE_REPAIR");
assert.equal(broken.rows[0][0], "Wrong_Header");

const now = new Date("2026-07-13T00:00:00.000Z");
const created = context.capabilityGrantCreate_({
  accountEmail: "enquiries@kundu.ac",
  capabilityKey: "CAN_RUN_BATCH_COMMUNICATIONS",
  expiresAt: "2026-07-13T01:00:00.000Z",
  reason: "Cover the reviewed afternoon cohort."
}, { actorEmail: "sanjay@minervacenters.com", sheet, now });
assert.equal(created.status, "ACTIVE");
assert.equal(created.accountEmail, "enquiries@kundu.ac");
assert.equal(created.recordVersion, 1);
assert.ok(audit.some((entry) => entry.event === "TEMP_CAPABILITY_GRANT_CREATED"));
assert.ok(removedCacheKeys.some((key) => key.includes("enquiries@kundu.ac")), "Create must invalidate target capability cache");

const effective = context.resolveAdminCapabilities_({
  email: "enquiries@kundu.ac",
  temporaryGrantOptions: { sheet, now: new Date("2026-07-13T00:15:00.000Z"), disableCache: true }
});
assert.equal(effective.normalizedRole, "VERIFIER", "Temporary capability must not alter durable role");
assert.equal(effective.capabilities.CAN_RUN_BATCH_COMMUNICATIONS, true);
assert.equal(effective.capabilityDetails.CAN_RUN_BATCH_COMMUNICATIONS.source, "TEMPORARY_GRANT");
assert.equal(effective.capabilities.CAN_VERIFY_PAYMENT, false, "Unrelated non-delegable capability must remain denied");
assert.equal(effective.capabilities.CAN_OVERRIDE_COOLDOWN, false);

assert.throws(() => context.capabilityGrantCreate_({
  accountEmail: "enquiries@kundu.ac",
  capabilityKey: "CAN_RUN_BATCH_COMMUNICATIONS",
  expiresAt: "2026-07-13T00:45:00.000Z",
  reason: "Duplicate overlapping temporary grant."
}, { actorEmail: "sanjay@minervacenters.com", sheet, now }), /OVERLAPPING_ACTIVE_GRANT/);

assert.throws(() => context.capabilityGrantCreate_({
  accountEmail: "enquiries@kundu.ac",
  capabilityKey: "CAN_VERIFY_PAYMENT",
  expiresAt: "2026-07-13T01:00:00.000Z",
  reason: "Attempt a prohibited financial capability."
}, { actorEmail: "sanjay@minervacenters.com", sheet, now }), /CAPABILITY_NOT_DELEGABLE/);
assert.throws(() => context.capabilityGrantCreate_({
  accountEmail: "unknown@example.test",
  capabilityKey: "CAN_RUN_BATCH_COMMUNICATIONS",
  expiresAt: "2026-07-13T01:00:00.000Z",
  reason: "Attempt an external account grant."
}, { actorEmail: "sanjay@minervacenters.com", sheet, now }), /UNKNOWN_CONFIGURED_ACCOUNT/);
assert.throws(() => context.capabilityGrantCreate_({
  accountEmail: "fode_kia@kundu.ac",
  capabilityKey: "UNKNOWN_CAPABILITY",
  expiresAt: "2026-07-13T01:00:00.000Z",
  reason: "Attempt an unknown capability grant."
}, { actorEmail: "sanjay@minervacenters.com", sheet, now }), /UNKNOWN_CAPABILITY/);
assert.throws(() => context.capabilityGrantCreate_({
  accountEmail: "fode_kia@kundu.ac",
  capabilityKey: "CAN_RUN_BATCH_COMMUNICATIONS",
  expiresAt: "2026-07-14T00:00:01.000Z",
  reason: "Attempt a grant beyond policy maximum."
}, { actorEmail: "sanjay@minervacenters.com", sheet, now }), /MAXIMUM_GRANT_DURATION_EXCEEDED/);
assert.throws(() => context.capabilityGrantCreate_({
  accountEmail: "fode_kia@kundu.ac",
  capabilityKey: "CAN_RUN_BATCH_COMMUNICATIONS",
  expiresAt: "2026-07-13T01:00:00.000Z",
  reason: "Operations actor must not grant capability."
}, { actorEmail: "operations@minervacenters.com", sheet, now }), /SUPER capability-grant authority required/);
assert.throws(() => context.capabilityGrantCreate_({
  accountEmail: "fode_kia@kundu.ac",
  capabilityKey: "CAN_RUN_BATCH_COMMUNICATIONS",
  expiresAt: "2026-07-13T01:00:00.000Z",
  reason: "Verifier actor must not grant capability."
}, { actorEmail: "enquiries@kundu.ac", sheet, now }), /SUPER capability-grant authority required/);

callerEmail = "operations@minervacenters.com";
const rejectedByApi = context.admin_createTemporaryCapabilityGrant({
  accountEmail: "mlc@minervacenters.com",
  capabilityKey: "CAN_RUN_BATCH_COMMUNICATIONS",
  expiresAt: "2026-07-13T01:00:00.000Z",
  reason: "Operations must not issue temporary grants."
});
assert.equal(rejectedByApi.ok, false);
assert.ok(audit.some((entry) => entry.event === "TEMP_CAPABILITY_GRANT_REJECTED" && entry.payload.actor === "operations@minervacenters.com"));
callerEmail = "sanjay@minervacenters.com";

assert.throws(() => context.capabilityGrantRevoke_({ grantId: created.grantId, recordVersion: 99, reason: "Revoke stale operator request." }, {
  actorEmail: "sanjay@minervacenters.com", sheet, now: new Date("2026-07-13T00:20:00.000Z")
}), /STALE_GRANT_RECORD_VERSION/);
const revoked = context.capabilityGrantRevoke_({ grantId: created.grantId, recordVersion: 1, reason: "Operational coverage is no longer required." }, {
  actorEmail: "sanjay@minervacenters.com", sheet, now: new Date("2026-07-13T00:20:00.000Z")
});
assert.equal(revoked.status, "REVOKED");
assert.equal(revoked.recordVersion, 2);
assert.ok(audit.some((entry) => entry.event === "TEMP_CAPABILITY_GRANT_REVOKED"));
const afterRevoke = context.resolveAdminCapabilities_({
  email: "enquiries@kundu.ac",
  temporaryGrantOptions: { sheet, now: new Date("2026-07-13T00:21:00.000Z"), disableCache: true }
});
assert.equal(afterRevoke.normalizedRole, "VERIFIER");
assert.equal(afterRevoke.capabilities.CAN_RUN_BATCH_COMMUNICATIONS, false);

const expiring = context.capabilityGrantCreate_({
  accountEmail: "fode_kia@kundu.ac",
  capabilityKey: "CAN_RUN_BATCH_COMMUNICATIONS",
  expiresAt: "2026-07-13T00:30:00.000Z",
  reason: "Cover one bounded morning communication window."
}, { actorEmail: "sanjay@minervacenters.com", sheet, now });
assert.equal(expiring.status, "ACTIVE");
const afterExpiry = context.resolveAdminCapabilities_({
  email: "fode_kia@kundu.ac",
  temporaryGrantOptions: { sheet, now: new Date("2026-07-13T00:31:00.000Z"), disableCache: true }
});
assert.equal(afterExpiry.normalizedRole, "VERIFIER");
assert.equal(afterExpiry.capabilities.CAN_RUN_BATCH_COMMUNICATIONS, false, "Server expiry must remove capability without cleanup dependency");
assert.ok(audit.some((entry) => entry.event === "TEMP_CAPABILITY_GRANT_EXPIRED"));

const batchGrant = context.capabilityGrantCreate_({
  accountEmail: "mlc@minervacenters.com",
  capabilityKey: "CAN_RUN_BATCH_COMMUNICATIONS",
  expiresAt: "2026-07-13T02:00:00.000Z",
  reason: "Run the reviewed unified-team communication cohort."
}, { actorEmail: "sanjay@minervacenters.com", sheet, now });
assert.equal(batchGrant.isActive, true);
context.getWorkingSpreadsheet_ = () => spreadsheet;
const backendResolved = context.resolveAdminCapabilities_({
  email: "mlc@minervacenters.com",
  temporaryGrantOptions: { sheet, now: new Date("2026-07-13T01:00:00.000Z"), disableCache: true }
});
assert.equal(backendResolved.capabilities.CAN_RUN_BATCH_COMMUNICATIONS, true, "Backend capability resolver must admit active temporary grant");
assert.equal(context.adminHasCapability_({
  email: "mlc@minervacenters.com",
  temporaryGrantOptions: { sheet, now: new Date("2026-07-13T01:00:00.000Z"), disableCache: true }
}, "CAN_RUN_BATCH_COMMUNICATIONS"), true, "Backend action gates must consume the same effective temporary capability");
const matrix = context.capabilityGrantMatrix_("sanjay@minervacenters.com", { sheet, now: new Date("2026-07-13T01:00:00.000Z") });
assert.equal(matrix.accounts.find((entry) => entry.email === "mlc@minervacenters.com").durableRole, "VERIFIER");
assert.equal(matrix.accounts.find((entry) => entry.email === "mlc@minervacenters.com").capabilities.find((entry) => entry.capabilityKey === "CAN_RUN_BATCH_COMMUNICATIONS").state, "TEMPORARILY_ALLOWED");

const originalConfigKey = CONFIG.CAPABILITY_GRANTS_SPREADSHEET_CONFIG_KEY;
delete CONFIG.CAPABILITY_GRANTS_SPREADSHEET_CONFIG_KEY;
assert.throws(() => context.getCapabilityGrantsSpreadsheetId_(), /CAPABILITY_GRANTS_SPREADSHEET_CONFIG_MISSING/);
CONFIG.CAPABILITY_GRANTS_SPREADSHEET_CONFIG_KEY = originalConfigKey;
assert.equal(context.getCapabilityGrantsSpreadsheetId_(), CONFIG.SPREADSHEET_ID_PROD);
assert.doesNotMatch(grantsSource, /getWorkingSpreadsheet_/, "Grant persistence must not inherit DATA_MODE workbook selection");
assert.doesNotMatch(grantsSource, /DATA_MODE/, "Grant persistence must not branch on global DATA_MODE");

let fileCounter = 0;
class MockBackupFile {
  constructor(name, content = "") { this.id = `FILE-${++fileCounter}`; this.name = name; this.content = content; }
  getId() { return this.id; }
  getName() { return this.name; }
  getSize() { return Math.max(1, this.content.length); }
  setDescription() { return this; }
  makeCopy(name, folder) { const copy = new MockBackupFile(name, "workbook-copy"); folder.files.push(copy); return copy; }
}
class MockBackupFolder {
  constructor(name, drive) { this.id = `FOLDER-${++fileCounter}`; this.name = name; this.drive = drive; this.files = []; this.sharing = drive.Access.PRIVATE; }
  getId() { return this.id; }
  getName() { return this.name; }
  setDescription() { return this; }
  setSharing(access) { this.sharing = access; return this; }
  getSharingAccess() { return this.sharing; }
  createFile(name, content) { const file = new MockBackupFile(name, content); this.files.push(file); return file; }
}
const mockDrive = {
  Access: { PRIVATE: "PRIVATE" },
  Permission: { NONE: "NONE" },
  sourceFile: new MockBackupFile("FODE Authoritative"),
  folders: [],
  createFolder(name) { const folder = new MockBackupFolder(name, this); this.folders.push(folder); return folder; },
  getFileById(id) { assert.equal(id, CONFIG.SPREADSHEET_ID_PROD); return this.sourceFile; }
};
const backup = context.capabilityGrantCreatePreMigrationBackup_({
  confirmation: "CREATE_H1_PRE_MIGRATION_BACKUP",
  commitHash: "abcdef1",
  adminDeploymentPin: "372",
  studentDeploymentPin: "247"
}, {
  actorEmail: "sanjay@minervacenters.com",
  spreadsheet,
  driveApp: mockDrive,
  spreadsheetApp: { openById: () => spreadsheet },
  propertiesService: { getScriptProperties: () => ({ getProperties: () => ({ SECRET_ONE: "value-one", CONFIG_TWO: "value-two" }) }) },
  scriptId: "SCRIPT-ID",
  now
});
assert.equal(backup.result, "BACKUP_VERIFIED");
assert.equal(backup.sourceWorkbookId, CONFIG.SPREADSHEET_ID_PROD);
assert.equal(backup.tabCount, spreadsheet.getSheets().length);
assert.equal(backup.scriptPropertyCount, 2);
assert.deepEqual(Array.from(backup.scriptPropertyKeys), ["CONFIG_TWO", "SECRET_ONE"]);
assert.equal(JSON.stringify(backup).includes("value-one"), false, "Backup RPC must never return Script Property values");
assert.equal(mockDrive.folders.length, 1, "Backup implementation must create a retrievable Drive artifact folder");
assert.equal(mockDrive.folders[0].files.length, 3, "Backup folder must contain workbook copy, protected properties, and manifest artifacts");

assert.match(operatorNextSource, /admin_getCapabilityGrantMatrix/);
assert.match(operatorNextSource, /admin_createTemporaryCapabilityGrant/);
assert.match(operatorNextSource, /admin_revokeTemporaryCapabilityGrant/);
assert.match(operatorNextSource, /TEMPORARILY_ALLOWED:"Temporarily allowed"/);
assert.match(operatorNextSource, /Durable role remains unchanged/);
assert.match(operatorNextSource, /onxGrantAccountFilter/);
assert.match(operatorNextSource, /onxGrantCapabilityFilter/);
assert.match(operatorNextSource, /onxGrantStatusFilter/);
assert.doesNotMatch(operatorNextSource, /ADMIN_ROLES\s*=/, "Operator Next must not mutate durable role mappings");
assert.match(claspIgnore, /!Admin_CapabilityGrants\.js/, "Capability-grant module must be part of the deployable Admin contract");
assert.match(configSource, /CAPABILITY_GRANTS_SPREADSHEET_CONFIG_KEY:\s*"SPREADSHEET_ID_PROD"/);
assert.equal(runtimeContext.projects.FODE.capabilityGrants.runtimeIdentity, "r340 / 340");
assert.equal(runtimeContext.projects.FODE.capabilityGrants.appsScriptVersion, 373);
assert.equal(runtimeContext.projects.FODE.deployments.studentStaging.expectedRuntime, "r217");
assert.equal(runtimeContext.projects.FODE.deployments.studentStaging.expectedDeploy, 217);
assert.match(readonlyBrowserRpcTool, /READ_ONLY_RPC_ALLOWLIST/);
assert.match(readonlyBrowserRpcTool, /admin_getCanonicalFinanceSummary/);
assert.doesNotMatch(readonlyBrowserRpcTool, /admin_createCapabilityGrantPreMigrationBackup/);
assert.doesNotMatch(readonlyBrowserRpcTool, /admin_planCapabilityGrantsMigration/);
assert.match(readonlyBrowserRpcTool, /READ_ONLY_RPC_ALLOWLIST\[action\]/, "Browser runner must map operator input through the fixed allowlist");
assert.doesNotMatch(readonlyBrowserRpcTool, /args\.(?:fn|function)/, "Browser runner must not accept arbitrary RPC function names");

console.log("PASS Capability_Grants schema is stable, dry-run first, idempotent, and refuses destructive repair");
console.log("PASS Super-only bounded grants converge through the shared capability resolver without role mutation");
console.log("PASS expiry, revocation, cache invalidation, audit events, and stale-version protection remain server-authoritative");
console.log("PASS Operator Next exposes explicit inherited and temporary states through backend RPCs");
