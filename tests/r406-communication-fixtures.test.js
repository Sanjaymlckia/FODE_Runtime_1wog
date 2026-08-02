const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const adminUi = fs.readFileSync("AdminUI.html", "utf8");
const opsCommunicationsUi = fs.readFileSync("AdminUI_OpsCommunications.html", "utf8");
const codeSource = fs.readFileSync("Code.js", "utf8");
const utilsSource = fs.readFileSync("Utils.js", "utf8");
const configSource = fs.readFileSync("Config.js", "utf8");

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

const source = fs.readFileSync("Admin_SelectedApplicantCommunications.js", "utf8");
const FIXTURES = [
  { fixtureId: "TEST_COMM_A", applicantId: "LOCAL-TEST-COMM-A", recipient: "sanjay@minervacenters.com", mode: "success", maySend: true },
  { fixtureId: "TEST_COMM_B", applicantId: "LOCAL-TEST-COMM-B", recipient: "sanjay@minervacenters.com", mode: "replay", maySend: false },
  { fixtureId: "TEST_COMM_C", applicantId: "LOCAL-TEST-COMM-C", recipient: "sanjay@minervacenters.com", mode: "stale_preview", maySend: false },
  { fixtureId: "TEST_COMM_D", applicantId: "LOCAL-TEST-COMM-D", recipient: "sanjay@minervacenters.com", mode: "ledger_disabled", maySend: false },
  { fixtureId: "TEST_COMM_E", applicantId: "LOCAL-TEST-COMM-E", recipient: "", mode: "missing_recipient", maySend: false },
  { fixtureId: "TEST_COMM_F", applicantId: "LOCAL-TEST-COMM-F", recipient: "sanjay@minervacenters.com", mode: "policy_blocked", maySend: false }
].map(fixture => Object.assign({
  operational: false,
  excludedFromQueues: true,
  batchEligible: false,
  stageBatchEligible: false,
  studentProductionEligible: false,
  liveSendAuthorization: "STAGE_4_ONLY"
}, fixture));

assert.deepEqual(FIXTURES.map(fixture => fixture.fixtureId), [
  "TEST_COMM_A", "TEST_COMM_B", "TEST_COMM_C", "TEST_COMM_D", "TEST_COMM_E", "TEST_COMM_F"
]);
assert.ok(FIXTURES.every(fixture => fixture.operational === false && fixture.excludedFromQueues === true));
assert.ok(FIXTURES.every(fixture => fixture.batchEligible === false && fixture.stageBatchEligible === false));
assert.ok(FIXTURES.every(fixture => fixture.studentProductionEligible === false));
assert.equal(FIXTURES.filter(fixture => fixture.maySend).length, 1);
assert.equal(FIXTURES.find(fixture => fixture.maySend).recipient, "sanjay@minervacenters.com");

for (const ui of [adminUi]) {
  assert.match(ui, /communicationResultAuditHtml_/);
  assert.match(ui, /Resolved To/);
  assert.match(ui, /Recipient source/);
  assert.match(ui, /Recipient role/);
  assert.match(ui, /Sendability/);
  assert.match(ui, /Final result/);
  assert.match(ui, /Command ID/);
  assert.match(ui, /Operation ID/);
  assert.match(ui, /Preview ID/);
  assert.match(ui, /Receipt ID/);
  assert.match(ui, /Idempotency key/);
  assert.match(ui, /Communication ID/);
  assert.match(ui, /Event ID/);
  assert.doesNotMatch(ui, /LEDGER_API_SIGNING_SECRET|fixture-secret|portal-secret/i);
}
assert.match(opsCommunicationsUi, /communicationResultAuditHtml_\(auditResult\)/);
assert.match(opsCommunicationsUi, /admin_previewFixtureCommunication/);
assert.match(opsCommunicationsUi, /admin_prepareFixtureCommunication/);
assert.match(opsCommunicationsUi, /admin_reconcileFixturePortalSecret/);
assert.match(opsCommunicationsUi, /admin_sendFixtureCommunication/);
assert.match(adminUi, /data-r407-fixture-proof="TEST_COMM_A"/);
assert.match(adminUi, /data-r407-fixture-proof-admin="TEST_COMM_A"/);
assert.match(adminUi, /adminTestCommAFixtureResult/);
assert.match(opsCommunicationsUi, /opsTestCommAFixtureResultId_/);
assert.match(adminUi, /Reconcile fixture authority/);
assert.match(adminUi, /Send exactly once/);
assert.match(adminUi, /Verify no-send replay/);
assert.doesNotMatch(opsCommunicationsUi, /LEDGER_API_SIGNING_SECRET|fixture-secret|portal-secret/i);

assert.match(utilsSource, /function getWorkingDataMode_\(\)/);
assert.match(utilsSource, /isAdminDeploymentRequest_\(\) === true/);
assert.match(configSource, /DATA_MODE: "PROD"/);
const modeContext = {
  CONFIG: { DATA_MODE: "PROD", SPREADSHEET_ID_STAGING: "STAGING-ID", SPREADSHEET_ID_PROD: "PROD-ID" },
  clean_: value => String(value == null ? "" : value).trim(),
  isAdminDeploymentRequest_: () => true
};
vm.createContext(modeContext);
vm.runInContext(extractFunction(utilsSource, "getWorkingDataMode_"), modeContext);
vm.runInContext(extractFunction(utilsSource, "getWorkingSpreadsheetId_"), modeContext);
assert.equal(modeContext.getWorkingDataMode_(), "STAGING");
assert.equal(modeContext.getWorkingSpreadsheetId_(), "STAGING-ID");
modeContext.isAdminDeploymentRequest_ = () => false;
assert.equal(modeContext.getWorkingDataMode_(), "PROD");
assert.equal(modeContext.getWorkingSpreadsheetId_(), "PROD-ID");

const adminDeploymentId = "AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ";
const adminIdentityContext = {
  CONFIG: {
    DATA_MODE: "PROD",
    DEPLOYMENT_ID_ADMIN: adminDeploymentId,
    WEBAPP_URL_ADMIN: `https://script.google.com/macros/s/${adminDeploymentId}/exec`,
    SPREADSHEET_ID_STAGING: "STAGING-ID",
    SPREADSHEET_ID_PROD: "PROD-ID"
  },
  clean_: value => String(value == null ? "" : value).trim(),
  Logger: { log: () => {} },
  ScriptApp: { getService: () => ({ getUrl: () => `https://script.google.com/a/macros/minervacenters.com/s/${adminDeploymentId}/exec` }) }
};
vm.createContext(adminIdentityContext);
[
  extractFunction(utilsSource, "buildExecUrlFromDeploymentId_"),
  extractFunction(utilsSource, "extractDeploymentIdFromExecUrl_"),
  extractFunction(utilsSource, "canonicalExecBase_"),
  extractFunction(codeSource, "isAdminDeploymentRequest_"),
  extractFunction(utilsSource, "getWorkingDataMode_"),
  extractFunction(utilsSource, "getWorkingSpreadsheetId_")
].forEach(fn => vm.runInContext(fn, adminIdentityContext));
assert.equal(adminIdentityContext.isAdminDeploymentRequest_(), true, "Domain-scoped Admin service URL must classify as Admin");
assert.equal(adminIdentityContext.getWorkingDataMode_(), "STAGING");
assert.equal(adminIdentityContext.getWorkingSpreadsheetId_(), "STAGING-ID");
adminIdentityContext.ScriptApp = { getService: () => ({ getUrl: () => "https://script.google.com/macros/s/AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv/exec" }) };
assert.equal(adminIdentityContext.isAdminDeploymentRequest_(), false, "Non-Admin deployment URL must not classify as Admin");
assert.equal(adminIdentityContext.getWorkingDataMode_(), "PROD");
assert.equal(adminIdentityContext.getWorkingSpreadsheetId_(), "PROD-ID");

function createContext(fixture) {
  const cache = new Map();
  let sendCalls = 0;
  let prepareCalls = 0;
  let finalizeCalls = 0;
  let communicationCount = 0;
  let receiptCount = 0;
  let eventCount = 0;
  let prepareFingerprint = "";
  let ledgerFinalized = fixture.mode === "replay";
  const clean = value => String(value == null ? "" : value).trim();
  const context = {
    FODE_R407_TEST_COMM_A_FIXTURE: {
      applicantId: "FODE-26-TEST-011",
      marker: "TEST_COMM_A",
      messageType: "docs_missing",
      recipient: "sanjay@minervacenters.com",
      nonOperationalMarker: "REGRESSION_FIXTURE_DO_NOT_PROCESS",
      type: "Regression Fixture"
    },
    CONFIG: { OPS_SAFE_MODE_TEST_RECIPIENT_OVERRIDE: "" },
    clean_: clean,
    safeStr_: clean,
    fodeLedgerCanonicalJson_: value => JSON.stringify(value),
    fodeLedgerSha256Hex_: value => `HASH-${Buffer.from(String(value)).toString("hex")}`,
    CacheService: { getUserCache: () => ({
      get: key => cache.get(key) || null,
      put: (key, value) => cache.set(key, value)
    }) },
    getCallerEmail_: () => "operator@example.test",
    isAdmin_: () => true,
    adminHasCapability_: (_email, capability) => capability !== "CAN_RUN_BATCH_COMMUNICATIONS",
    adminCapabilityBlockCode_: capability => `${capability}_REQUIRED`,
    adminCapabilityBlockReason_: capability => `${capability} is required.`,
    adminCommBlockedResult_: (_action, code, _debugId, more) => ({ ok: false, result: "BLOCKED", blockCode: code, ...(more || {}) }),
    newDebugId_: () => `LOCAL-${fixture.fixtureId}`,
    normalizeApplicantMessageType_: value => clean(value),
    resolveAdminCommActor_: () => ({ actorEmail: "operator@example.test", actorRole: "ADMIN" }),
    resolveApplicantMessageContext_: () => ({
      ok: true,
      eligible: true,
      effectiveEmail: "sanjay@minervacenters.com",
      rowObj: {
        ApplicantID: "FODE-26-TEST-011",
        First_Name: "TEST_COMM_A",
        Type: "Regression Fixture",
        Home_Address: "REGRESSION_FIXTURE_DO_NOT_PROCESS",
        Parent_Email: "sanjay@minervacenters.com",
        Parent_Email_Corrected: "sanjay@minervacenters.com",
        Student_Email_Internal: "",
        CRM_Email: ""
      }
    }),
    runOpsSafeModeGate_: () => ({ ok: true, safeMode: false }),
    logOpsSafeModeEvent_: () => {},
    withEnvelope_: (_name, callback) => callback(`DBG-${fixture.fixtureId}`),
    LockService: { getUserLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    previewApplicantMessage_: (_applicantId, _messageType, options) => {
      if (fixture.mode === "policy_blocked") return { ok: false, result: "BLOCKED", blockCode: "POLICY_BLOCKED", blockReason: "Fixture policy state blocks communication." };
      return {
        ok: true,
        result: "PREVIEW",
        effectiveEmail: fixture.recipient,
        subject: `Preview ${fixture.fixtureId}`,
        body: `Synthetic non-operational body for ${fixture.fixtureId}`,
        cc: "",
        bcc: "",
        templateId: "docs_missing",
        templateVersionId: "1",
        templateSource: "BUILT_IN",
        recipientSource: fixture.recipient ? "FIXTURE_LOCKED" : "MISSING"
      };
    },
    sendApplicantMessage_: () => {
      sendCalls += 1;
      return { ok: true, result: "SENT", gmailAccepted: true };
    },
    fodeLedgerPrepareIndividual_: (identity, _applicantId, payload, authorityContext) => {
      prepareCalls += 1;
      if (fixture.mode === "ledger_disabled") return { ok: false, status: "REJECTED", code: "LEDGER_DISABLED" };
      const currentFingerprint = JSON.stringify({ payload, authorityContext });
      if (!prepareFingerprint) {
        prepareFingerprint = currentFingerprint;
        communicationCount = 1;
        receiptCount = 1;
        eventCount = 1;
        return { ok: true, prepared: true, status: "PREPARED", replay: false, idempotent: false, communicationId: `COMM-${fixture.fixtureId}`, commandId: `CMD-${fixture.fixtureId}`, eventId: `EVT-${fixture.fixtureId}`, operationId: identity.operationId, previewId: identity.previewId, receiptId: identity.receiptId, ledgerEnvironment: "staging" };
      }
      if (currentFingerprint !== prepareFingerprint) return { ok: false, status: "REJECTED", code: "IDEMPOTENCY_CONFLICT" };
      if (ledgerFinalized) return { ok: true, replay: true, idempotent: true, finalized: true, status: "SENT", communicationId: `COMM-${fixture.fixtureId}`, commandId: `CMD-${fixture.fixtureId}`, eventId: `EVT-FINAL-${fixture.fixtureId}`, operationId: identity.operationId, previewId: identity.previewId, receiptId: identity.receiptId, ledgerEnvironment: "staging" };
      return { ok: true, prepared: true, status: "PREPARED", replay: true, idempotent: true, communicationId: `COMM-${fixture.fixtureId}`, commandId: `CMD-${fixture.fixtureId}`, eventId: `EVT-${fixture.fixtureId}`, operationId: identity.operationId, previewId: identity.previewId, receiptId: identity.receiptId, ledgerEnvironment: "staging" };
    },
    fodeLedgerFinalizeIndividual_: (_identity, _applicantId, payload) => {
      finalizeCalls += 1;
      ledgerFinalized = true;
      eventCount += 1;
      return { ok: true, status: "SENT", communicationId: payload.communicationId, eventId: `EVT-FINAL-${fixture.fixtureId}` };
    }
  };
  vm.createContext(context);
  [
    "adminCommunicationOperationIdentity_",
    "adminIndividualCommunicationPreviewCacheKey_",
    "adminCanonicalIndividualCommunicationPayload_",
    "adminCanonicalIndividualCommunicationPayloadFallback_",
    "adminPersistIndividualCommunicationPreview_",
    "adminWriteIndividualCommunicationPreview_",
    "adminReadIndividualCommunicationPreview_",
    "adminIndividualCommunicationPreviewMatches_",
    "adminBindIndividualCommunicationPreview_",
    "adminCanonicalIndividualLedgerPrepareContract_",
    "adminCommunicationWithIdentity_",
    "withAdminIndividualCommunicationLock_",
    "adminFixtureCommunicationGuard_",
    "adminFixtureProofResult_",
    "admin_previewApplicantMessage",
    "admin_sendApplicantMessage",
    "admin_previewFixtureCommunication",
    "admin_prepareFixtureCommunication",
    "admin_sendFixtureCommunication"
  ].forEach(name => vm.runInContext(extractFunction(source, name), context));
  return {
    context,
    cache,
    get sendCalls() { return sendCalls; },
    get prepareCalls() { return prepareCalls; },
    get finalizeCalls() { return finalizeCalls; },
    get communicationCount() { return communicationCount; },
    get receiptCount() { return receiptCount; },
    get eventCount() { return eventCount; }
  };
}

const a = createContext(FIXTURES[0]);
const aPreview = a.context.admin_previewApplicantMessage({ applicantId: FIXTURES[0].applicantId, messageType: "docs_missing" });
const aSend = a.context.admin_sendApplicantMessage({ applicantId: FIXTURES[0].applicantId, messageType: "docs_missing", confirmManualSingleSend: true });
assert.equal(aPreview.result, "PREVIEW");
assert.equal(aPreview.effectiveEmail, "sanjay@minervacenters.com");
assert.equal(aPreview.recipientSource, "FIXTURE_LOCKED");
assert.equal(aSend.result, "SENT");
assert.equal(a.sendCalls, 1);
assert.equal(a.prepareCalls, 1);

const fixtureRoute = createContext(FIXTURES[0]);
const fixturePreview = fixtureRoute.context.admin_previewFixtureCommunication({ applicantId: "FODE-26-TEST-011", messageType: "docs_missing" });
assert.equal(fixturePreview.result, "PREVIEW");
assert.equal(fixturePreview.fixtureProof.fixtureMarker, "TEST_COMM_A");
assert.equal(fixturePreview.fixtureProof.nonOperational, true);
assert.equal(fixturePreview.fixtureProof.excludedFromNormalQueues, true);
assert.equal(fixturePreview.fixtureProof.recipient, "sanjay@minervacenters.com");
assert.equal(fixturePreview.fixtureProof.alternateRecipientFields.Student_Email_Internal, "");
assert.equal(fixturePreview.gmailInvoked, false);
assert.equal(fixtureRoute.prepareCalls, 0);
const fixturePrepared = fixtureRoute.context.admin_prepareFixtureCommunication({ applicantId: "FODE-26-TEST-011", messageType: "docs_missing" });
assert.equal(fixturePrepared.result, "PRE_SEND_PREPARED");
assert.equal(fixturePrepared.ledgerState, "PRE_SEND_PREPARED");
assert.equal(fixturePrepared.ledgerEnvironment, "staging");
assert.equal(fixturePrepared.idempotent, false);
assert.equal(fixturePrepared.prepareReplayProven, false);
assert.ok(fixturePrepared.commandId && fixturePrepared.operationId && fixturePrepared.previewId && fixturePrepared.receiptId && fixturePrepared.communicationId && fixturePrepared.eventId);
assert.equal(fixturePrepared.gmailInvoked, false);
assert.equal(fixturePrepared.finalizeInvoked, false);
const fixturePreparedReplay = fixtureRoute.context.admin_prepareFixtureCommunication({ applicantId: "FODE-26-TEST-011", messageType: "docs_missing" });
assert.equal(fixturePreparedReplay.result, "PRE_SEND_PREPARED");
assert.equal(fixturePreparedReplay.idempotent, true);
assert.equal(fixturePreparedReplay.replay, true);
assert.equal(fixturePreparedReplay.prepareReplayProven, true);
assert.equal(fixturePreparedReplay.communicationId, fixturePrepared.communicationId);
assert.equal(fixtureRoute.communicationCount, 1);
assert.equal(fixtureRoute.receiptCount, 1);
assert.equal(fixtureRoute.eventCount, 1);
const fixtureSent = fixtureRoute.context.admin_sendFixtureCommunication({ applicantId: "FODE-26-TEST-011", messageType: "docs_missing" });
assert.equal(fixtureSent.result, "SENT");
assert.equal(fixtureRoute.sendCalls, 1);
assert.equal(fixtureRoute.finalizeCalls, 1);
assert.equal(fixtureRoute.communicationCount, 1);
assert.equal(fixtureRoute.receiptCount, 1);
assert.equal(fixtureRoute.eventCount, 2);
const fixtureReplay = fixtureRoute.context.admin_sendFixtureCommunication({ applicantId: "FODE-26-TEST-011", messageType: "docs_missing" });
assert.equal(fixtureReplay.result, "IDEMPOTENT_REPLAY");
assert.equal(fixtureReplay.gmailAttempted, false);
assert.equal(fixtureRoute.sendCalls, 1);
assert.equal(fixtureRoute.finalizeCalls, 1);
assert.equal(fixtureRoute.communicationCount, 1);
assert.equal(fixtureRoute.receiptCount, 1);
assert.equal(fixtureRoute.eventCount, 2);

const nonFixture = createContext(FIXTURES[0]);
const nonFixtureBlocked = nonFixture.context.admin_previewFixtureCommunication({ applicantId: "FODE-26-TEST-001", messageType: "docs_missing" });
assert.equal(nonFixtureBlocked.blockCode, "FIXTURE_ONLY_ROUTE");
const recipientOverride = createContext(FIXTURES[0]);
const recipientBlocked = recipientOverride.context.admin_previewFixtureCommunication({ applicantId: "FODE-26-TEST-011", messageType: "docs_missing", recipient: "other@example.test" });
assert.equal(recipientBlocked.blockCode, "FIXTURE_RECIPIENT_OVERRIDE");

function createPortalSecretReconciliationContext(initialRows, mode = "STAGING") {
  const headers = ["ApplicantID", "Email", "Full_Name", "Secret_Plain", "Secret_Hash", "Created_At", "Last_Rotated_At", "Status"];
  const rows = (initialRows || []).map(row => row.slice());
  let effectiveMode = mode;
  const sheet = {
    getLastColumn: () => headers.length,
    getLastRow: () => rows.length + 1,
    getRange(row, column, numRows, numColumns) {
      return {
        getValues() {
          if (row === 1) return [headers.slice(column - 1, column - 1 + numColumns)];
          return rows.slice(row - 2, row - 2 + numRows).map(item => item.slice(column - 1, column - 1 + numColumns));
        },
        setValues(values) {
          values.forEach((value, offset) => { rows[row - 2 + offset] = value.slice(); });
        }
      };
    }
  };
  const context = {
    clean_: value => String(value == null ? "" : value).trim(),
    getWorkingDataMode_: () => effectiveMode,
    isAdminDeploymentRequest_: () => true,
    LockService: { getScriptLock: () => ({ tryLock: () => true, releaseLock: () => {} }) },
    newDebugId_: () => "DBG-PORTAL-SECRET",
    openPortalSecretsExistingSheet_: () => ({ ok: true, sheet }),
    buildPortalSecretHeaderIndex_: () => ({ ApplicantID: 1, Email: 2, Full_Name: 3, Secret_Plain: 4, Secret_Hash: 5, Created_At: 6, Last_Rotated_At: 7, Status: 8 }),
    resolvePortalSecretColumnIndex_: idx => idx.Secret_Plain || idx.Secret_Hash,
    normalizePortalSecretStatus_: value => String(value || "").trim().toUpperCase(),
    normalizePortalSecretRow_: (_idx, row, rowIndex) => ({ applicantId: String(row[0] || "").trim(), secretPlain: String(row[3] || "").trim(), secretHash: String(row[4] || "").trim(), status: String(row[7] || "").trim(), rowIndex }),
    makePortalSecretForReset_: () => "SECRET-VALUE-MUST-NOT-ESCAPE",
    hashPortalSecret_: () => "HASH-VALUE-MUST-NOT-ESCAPE",
    buildPortalSecretOutputRow_: (_idx, _lastCol, applicantId, secretPlain, secretHash, nowIso, options) => [applicantId, options.email, options.fullName, secretPlain, secretHash, nowIso, nowIso, "Active"]
  };
  vm.createContext(context);
  vm.runInContext(extractFunction(codeSource, "reconcileTestCommAPortalSecretAuthority_"), context);
  return { context, rows, setMode: value => { effectiveMode = value; } };
}

const portalGuard = {
  applicantId: "FODE-26-TEST-011",
  fixtureMarker: "TEST_COMM_A",
  type: "Regression Fixture",
  recipient: "sanjay@minervacenters.com",
  nonOperational: true,
  excludedFromNormalQueues: true
};
const portalCreate = createPortalSecretReconciliationContext([]);
const portalCreated = portalCreate.context.reconcileTestCommAPortalSecretAuthority_(portalGuard);
assert.equal(portalCreated.result, "RECONCILIATION_CREATED");
assert.equal(portalCreated.matchingRecordCount, 1);
assert.equal(portalCreated.activeUsableRecordCount, 1);
assert.equal(portalCreated.fodeDataWritten, false);
assert.doesNotMatch(JSON.stringify(portalCreated), /SECRET-VALUE-MUST-NOT-ESCAPE|HASH-VALUE-MUST-NOT-ESCAPE/);
const portalNoop = portalCreate.context.reconcileTestCommAPortalSecretAuthority_(portalGuard);
assert.equal(portalNoop.result, "RECONCILIATION_NOOP");
assert.equal(portalCreate.rows.length, 1);

const activePortalRow = ["FODE-26-TEST-011", "sanjay@minervacenters.com", "TEST_COMM_A", "secret", "hash", "2026-08-02T00:00:00Z", "", "Active"];
const duplicatePortal = createPortalSecretReconciliationContext([activePortalRow, activePortalRow]);
assert.equal(duplicatePortal.context.reconcileTestCommAPortalSecretAuthority_(portalGuard).code, "FIXTURE_PORTAL_SECRET_CONFLICT");
const inactivePortal = createPortalSecretReconciliationContext([["FODE-26-TEST-011", "sanjay@minervacenters.com", "TEST_COMM_A", "secret", "hash", "", "", "Inactive"]]);
assert.equal(inactivePortal.context.reconcileTestCommAPortalSecretAuthority_(portalGuard).code, "FIXTURE_PORTAL_SECRET_CONFLICT");
const unusablePortal = createPortalSecretReconciliationContext([["FODE-26-TEST-011", "sanjay@minervacenters.com", "TEST_COMM_A", "", "", "", "", "Active"]]);
assert.equal(unusablePortal.context.reconcileTestCommAPortalSecretAuthority_(portalGuard).code, "FIXTURE_PORTAL_SECRET_CONFLICT");
const wrongPortalApplicant = createPortalSecretReconciliationContext([]);
assert.equal(wrongPortalApplicant.context.reconcileTestCommAPortalSecretAuthority_({ ...portalGuard, applicantId: "FODE-26-REAL-001" }).code, "FIXTURE_RECONCILIATION_IDENTITY_NOT_PROVEN");
const missingPortalMarker = createPortalSecretReconciliationContext([]);
assert.equal(missingPortalMarker.context.reconcileTestCommAPortalSecretAuthority_({ ...portalGuard, fixtureMarker: "" }).code, "FIXTURE_RECONCILIATION_IDENTITY_NOT_PROVEN");
const prodPortal = createPortalSecretReconciliationContext([], "PROD");
assert.equal(prodPortal.context.reconcileTestCommAPortalSecretAuthority_(portalGuard).code, "FIXTURE_RECONCILIATION_STAGING_ONLY");

const b = createContext(FIXTURES[1]);
const bPayload = { applicantId: FIXTURES[1].applicantId, messageType: "docs_missing" };
b.context.admin_previewApplicantMessage(bPayload);
const bFirst = b.context.admin_sendApplicantMessage(Object.assign({}, bPayload, { confirmManualSingleSend: true }));
const bReplay = b.context.admin_sendApplicantMessage(Object.assign({}, bPayload, { confirmManualSingleSend: true }));
assert.equal(bFirst.result, "SENT");
assert.equal(bReplay.result, "IDEMPOTENT_REPLAY");
assert.equal(b.sendCalls, 1);

const c = createContext(FIXTURES[2]);
const cPayload = { applicantId: FIXTURES[2].applicantId, messageType: "docs_missing" };
c.context.admin_previewApplicantMessage(cPayload);
const cStale = c.context.admin_sendApplicantMessage(Object.assign({}, cPayload, { recipient: "altered@example.test", confirmManualSingleSend: true }));
assert.equal(cStale.blockCode, "PREVIEW_STALE");
assert.equal(c.sendCalls, 0);

const d = createContext(FIXTURES[3]);
const dPayload = { applicantId: FIXTURES[3].applicantId, messageType: "docs_missing" };
d.context.admin_previewApplicantMessage(dPayload);
const dBlocked = d.context.admin_sendApplicantMessage(Object.assign({}, dPayload, { confirmManualSingleSend: true }));
assert.equal(dBlocked.blockCode, "LEDGER_DISABLED");
assert.equal(d.sendCalls, 0);

const e = createContext(FIXTURES[4]);
const ePayload = { applicantId: FIXTURES[4].applicantId, messageType: "docs_missing" };
e.context.admin_previewApplicantMessage(ePayload);
const eBlocked = e.context.admin_sendApplicantMessage(Object.assign({}, ePayload, { confirmManualSingleSend: true }));
assert.equal(eBlocked.blockCode, "MISSING_RECIPIENT");
assert.equal(e.sendCalls, 0);

const f = createContext(FIXTURES[5]);
const fPayload = { applicantId: FIXTURES[5].applicantId, messageType: "docs_missing" };
const fBlockedPreview = f.context.admin_previewApplicantMessage(fPayload);
assert.equal(fBlockedPreview.blockCode, "POLICY_BLOCKED");
const fBlockedSend = f.context.admin_sendApplicantMessage(Object.assign({}, fPayload, { confirmManualSingleSend: true }));
assert.equal(fBlockedSend.blockCode, "PREVIEW_REQUIRED");
assert.equal(f.sendCalls, 0);

console.log("PASS R406 TEST_COMM_A-F synthetic fixtures: pre-send gate, one-send replay, stale preview, ledger-disabled, missing-recipient, policy-blocked, exclusion flags, and no live fallback");
