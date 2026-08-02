const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const adminUi = fs.readFileSync("AdminUI.html", "utf8");
const opsCommunicationsUi = fs.readFileSync("AdminUI_OpsCommunications.html", "utf8");

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
assert.match(adminUi, /data-r407-fixture-proof="TEST_COMM_A"/);
assert.match(adminUi, /Prepare ledger proof only/);
assert.doesNotMatch(opsCommunicationsUi, /LEDGER_API_SIGNING_SECRET|fixture-secret|portal-secret/i);

function createContext(fixture) {
  const cache = new Map();
  let sendCalls = 0;
  let prepareCalls = 0;
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
        recipientSource: fixture.recipient ? "FIXTURE_LOCKED" : "MISSING"
      };
    },
    sendApplicantMessage_: () => {
      sendCalls += 1;
      return { ok: true, result: "SENT", gmailAccepted: true };
    },
    fodeLedgerPrepareIndividual_: identity => {
      prepareCalls += 1;
      if (fixture.mode === "ledger_disabled") return { ok: false, status: "REJECTED", code: "LEDGER_DISABLED" };
      if (fixture.mode === "replay" && prepareCalls > 1) return { ok: true, finalized: true, status: "SENT", communicationId: `COMM-${fixture.fixtureId}` };
      return { ok: true, prepared: true, status: "PREPARED", communicationId: `COMM-${fixture.fixtureId}`, commandId: `CMD-${fixture.fixtureId}`, eventId: `EVT-${fixture.fixtureId}`, operationId: identity.operationId, previewId: identity.previewId, receiptId: identity.receiptId, ledgerEnvironment: "staging" };
    },
    fodeLedgerFinalizeIndividual_: (_identity, _applicantId, payload) => ({ ok: true, status: "SENT", communicationId: payload.communicationId })
  };
  vm.createContext(context);
  [
    "adminCommunicationOperationIdentity_",
    "adminIndividualCommunicationPreviewCacheKey_",
    "adminCanonicalIndividualCommunicationPayload_",
    "adminCanonicalIndividualCommunicationPayloadFallback_",
    "adminWriteIndividualCommunicationPreview_",
    "adminReadIndividualCommunicationPreview_",
    "adminIndividualCommunicationPreviewMatches_",
    "adminBindIndividualCommunicationPreview_",
    "adminCommunicationWithIdentity_",
    "withAdminIndividualCommunicationLock_",
    "adminFixtureCommunicationGuard_",
    "adminFixtureProofResult_",
    "admin_previewApplicantMessage",
    "admin_sendApplicantMessage",
    "admin_previewFixtureCommunication",
    "admin_prepareFixtureCommunication"
  ].forEach(name => vm.runInContext(extractFunction(source, name), context));
  return { context, cache, get sendCalls() { return sendCalls; }, get prepareCalls() { return prepareCalls; } };
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
assert.ok(fixturePrepared.commandId && fixturePrepared.operationId && fixturePrepared.previewId && fixturePrepared.receiptId && fixturePrepared.communicationId && fixturePrepared.eventId);
assert.equal(fixturePrepared.gmailInvoked, false);
assert.equal(fixturePrepared.finalizeInvoked, false);

const nonFixture = createContext(FIXTURES[0]);
const nonFixtureBlocked = nonFixture.context.admin_previewFixtureCommunication({ applicantId: "FODE-26-TEST-001", messageType: "docs_missing" });
assert.equal(nonFixtureBlocked.blockCode, "FIXTURE_ONLY_ROUTE");
const recipientOverride = createContext(FIXTURES[0]);
const recipientBlocked = recipientOverride.context.admin_previewFixtureCommunication({ applicantId: "FODE-26-TEST-011", messageType: "docs_missing", recipient: "other@example.test" });
assert.equal(recipientBlocked.blockCode, "FIXTURE_RECIPIENT_OVERRIDE");

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
