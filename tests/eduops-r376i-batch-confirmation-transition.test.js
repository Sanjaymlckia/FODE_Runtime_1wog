const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function read(file) { return fs.readFileSync(file, "utf8"); }
function scriptBody(source) {
  return source.replace(/^<script>\s*/, "").replace(/\s*<\/script>\s*$/, "");
}
function tick() {
  return new Promise((resolve) => setImmediate(resolve));
}

const batchSource = read("EduOps_ClientBatch.html");
assert.doesNotMatch(batchSource, /\bdefinition\(/, "batch confirmation must not depend on the missing global definition helper");
assert.match(batchSource, /function definitionList\(/, "batch confirmation uses a local bounded definition renderer");
assert.match(batchSource, /BATCH_CONFIRMATION_PREVIEW_EXPIRED/, "expired previews must fail with an exact diagnostic");
assert.match(batchSource, /BATCH_CONFIRMATION_IDENTITY_MISSING/, "missing preview identity must fail with an exact diagnostic");
assert.match(batchSource, /BATCH_CONFIRMATION_MODAL_FAILED/, "modal construction failures must fail with an exact diagnostic");
assert.match(batchSource, /BATCH_CONFIRMATION_COMMAND_REJECTED/, "command rejection must fail with an exact diagnostic");
assert.doesNotMatch(batchSource, /GmailApp|MailApp|sendEmail|sendApplicantMessage_/, "client transition repair must not add live send primitives");

function basePreview(overrides) {
  return Object.assign({
    executable: true,
    previewId: "PREVIEW-R376I",
    idempotencyKey: "IDEMPOTENCY-R376I",
    summary: "Send Missing Documents to 5 recipients",
    selectedTemplate: { templateId: "docs_missing", messageType: "documents_follow_up", label: "Missing Documents" },
    executionCohortSize: 5,
    masterCohortSize: 252,
    remainingAfterExecution: 247,
    subject: "Missing documents",
    body: "Please upload missing documents.",
    expiresAt: "2099-04-05T00:00:00.000Z",
    queryFingerprint: "QUERY-FINGERPRINT-R376I",
    snapshotId: "SNAP-R376I",
    requiredCapability: "CAN_RUN_BATCH_COMMUNICATIONS",
    statusLabel: "Ready for confirmation",
    statusReason: "Preview executable.",
    partitions: [{ label: "Execution cohort", memberCount: 5 }],
    recipients: [1, 2, 3, 4, 5].map((n) => ({
      applicantId: `FODE-26-00000${n}`,
      name: `Applicant ${n}`,
      email: `applicant${n}@example.test`,
      included: true,
      authorityDecisionLabel: "Included",
      reason: "Communication Authority permits this recipient.",
      templateLabel: "Missing Documents",
      presentation: {}
    }))
  }, overrides || {});
}

function makeHarness(options = {}) {
  const elements = {};
  const executeButton = { disabled: false, focused: false, focus() { this.focused = true; } };
  function element(id) {
    if (!elements[id]) {
      elements[id] = {
        id,
        hidden: false,
        disabled: false,
        innerHTML: "",
        textContent: "",
        attributes: {},
        listeners: {},
        focused: false,
        setAttribute(name, value) { this.attributes[name] = String(value); },
        addEventListener(type, handler) { this.listeners[type] = handler; },
        querySelector(selector) { return id === "eduopsBatchFooter" && selector === "[data-batch-execute]" ? executeButton : null; },
        matches() { return false; },
        closest() { return null; },
        focus() { this.focused = true; }
      };
    }
    return elements[id];
  }
  const app = {
    batchExecutionTimeoutMs: 60000,
    state: {
      confirm: null,
      selectionExcluded: {},
      batch: {
        step: "confirm",
        binding: { excludedApplicantIds: [], snapshotId: "SNAP-R376I" },
        operation: "BATCH_COMMUNICATION",
        catalogue: null,
        authorityError: "",
        preview: options.preview || basePreview(),
        receipt: null,
        idempotencyKey: "IDEMPOTENCY-R376I"
      }
    },
    esc(value) {
      return String(value == null ? "" : value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
    },
    formatCode(value) { return String(value || ""); },
    formatPngDate(value) { return value ? "5 April 2099, 12:00 am" : ""; },
    authorityUnavailable(domain) { return `Authoritative ${domain} decision was not returned.`; },
    authorityLabel(value, domain) { return value && value.label ? value.label : `Authoritative ${domain} decision was not returned.`; },
    setInteractionState(state, message) { this.lastInteractionState = { state, message }; },
    beginControlAction() { this.beginCalls = (this.beginCalls || 0) + 1; return { id: "TOKEN-R376I" }; },
    finishControlAction(token, state, message) { this.lastControlResult = { token, state, message }; },
    closeConfirm() { this.state.confirm = null; },
    openConfirm(confirmOptions) {
      if (options.throwOnOpenConfirm) throw new Error("modal render failed");
      this.openConfirmCalls = (this.openConfirmCalls || 0) + 1;
      this.state.confirm = confirmOptions;
      element("eduopsConfirmText").innerHTML = confirmOptions.html;
    },
    call(name, payload) {
      if (name === "eduops_executeCommand") {
        this.executeCalls = (this.executeCalls || 0) + 1;
        this.lastExecutePayload = payload;
        if (options.rejectExecute) return Promise.reject(new Error("SERVER_BLOCKED"));
        if (options.missingReceipt) return Promise.resolve({});
        if (options.deferExecute) return new Promise((resolve) => { this.resolveExecute = resolve; });
        return Promise.resolve({ receiptId: "RECEIPT-R376I", outcome: "PARTIAL", applicantOutcomes: [] });
      }
      if (name === "eduops_recoverCommandReceipt") return Promise.resolve({ receipt: null });
      throw new Error(`Unexpected RPC ${name}`);
    }
  };
  const document = {
    getElementById: element,
    addEventListener(type, handler) { this.listeners = this.listeners || {}; this.listeners[type] = handler; }
  };
  const context = { window: { EduOpsApp: app }, document, setTimeout, clearTimeout, console };
  vm.createContext(context);
  vm.runInContext(scriptBody(batchSource), context, { filename: "EduOps_ClientBatch.html" });
  app.bindBatch();
  function clickExecute() {
    const target = { closest: (selector) => selector === "[data-batch-execute]" ? executeButton : null };
    element("eduopsBatchWorkspace").listeners.click({ target });
  }
  return { app, elements, clickExecute, executeButton };
}

(async function run() {
  const modalHarness = makeHarness({ deferExecute: true });
  modalHarness.clickExecute();
  assert.equal(modalHarness.app.openConfirmCalls, 1, "one click opens exactly one explicit confirmation modal");
  assert.equal(modalHarness.app.executeCalls || 0, 0, "opening the modal must not execute or send");
  assert.match(modalHarness.app.state.confirm.html, /This final confirmation sends email/, "modal includes a clear email-send warning");
  assert.match(modalHarness.app.state.confirm.html, /Template \/ message type/, "modal includes template/message type");
  assert.match(modalHarness.app.state.confirm.html, /Recipient count/, "modal includes recipient count");
  assert.match(modalHarness.app.state.confirm.html, /Partition \/ cohort identity/, "modal includes partition/cohort identity");
  assert.match(modalHarness.app.state.confirm.html, /Preview ID/, "modal includes preview ID");
  assert.match(modalHarness.app.state.confirm.html, /Expires/, "modal includes preview expiry");
  assert.equal(modalHarness.app.state.confirm.batchPreviewId, "PREVIEW-R376I", "modal is bound to the authoritative preview");
  modalHarness.clickExecute();
  assert.equal(modalHarness.app.openConfirmCalls, 1, "duplicate final-action clicks do not create duplicate modals");
  assert.equal(modalHarness.app.executeCalls || 0, 0, "duplicate modal clicks still do not execute");
  modalHarness.app.closeConfirm(true);
  assert.equal(modalHarness.app.executeCalls || 0, 0, "cancel/close leaves execution untouched");
  assert.equal(modalHarness.app.state.batch.step, "confirm", "cancel keeps the operator at confirmation");

  modalHarness.clickExecute();
  const proceed = modalHarness.app.state.confirm.onProceed;
  proceed();
  proceed();
  assert.equal(modalHarness.app.executeCalls, 1, "duplicate confirmation callbacks issue at most one execute command");
  assert.deepEqual(JSON.parse(JSON.stringify(modalHarness.app.lastExecutePayload)), { previewId: "PREVIEW-R376I", idempotencyKey: "IDEMPOTENCY-R376I", confirmation: true }, "execution uses the preview idempotency identity");
  modalHarness.app.resolveExecute({ receiptId: "RECEIPT-R376I", outcome: "PARTIAL", applicantOutcomes: [] });
  await tick();
  assert.equal(modalHarness.app.state.batch.step, "receipt", "receipt is required before the UI advances to receipt state");
  assert.equal(modalHarness.elements.eduopsBatchExecutionStatus.textContent, "Execution completed", "execution header changes only after receipt");

  const missingIdentity = makeHarness({ preview: basePreview({ previewId: "" }) });
  missingIdentity.clickExecute();
  assert.equal(missingIdentity.app.openConfirmCalls || 0, 0, "missing identity blocks before modal creation");
  assert.equal(missingIdentity.app.state.batch.confirmationDiagnostic.blockCode, "BATCH_CONFIRMATION_IDENTITY_MISSING");
  assert.equal(missingIdentity.app.state.batch.confirmationDiagnostic.previewIdPresent, false);
  assert.match(missingIdentity.elements.eduopsBatchPanel.innerHTML, /BATCH_CONFIRMATION_IDENTITY_MISSING/, "identity diagnostic is visible to the operator");
  assert.equal(missingIdentity.elements.eduopsBatchExecutionStatus.textContent, "Execution: No execution performed");

  const expired = makeHarness({ preview: basePreview({ expiresAt: "2000-01-01T00:00:00.000Z" }) });
  expired.clickExecute();
  assert.equal(expired.app.state.batch.confirmationDiagnostic.blockCode, "BATCH_CONFIRMATION_PREVIEW_EXPIRED");
  assert.equal(expired.app.state.batch.confirmationDiagnostic.previewExpired, true);
  assert.equal(expired.app.executeCalls || 0, 0, "expired preview cannot execute");

  const modalFailed = makeHarness({ throwOnOpenConfirm: true });
  modalFailed.clickExecute();
  assert.equal(modalFailed.app.state.batch.confirmationDiagnostic.blockCode, "BATCH_CONFIRMATION_MODAL_FAILED");
  assert.equal(modalFailed.app.executeCalls || 0, 0, "modal failure cannot execute");

  const rejected = makeHarness({ rejectExecute: true });
  rejected.clickExecute();
  rejected.app.state.confirm.onProceed();
  await tick();
  assert.equal(rejected.app.state.batch.confirmationDiagnostic.blockCode, "BATCH_CONFIRMATION_COMMAND_REJECTED");
  assert.equal(rejected.app.state.batch.confirmationDiagnostic.commandStarted, true);
  assert.equal(rejected.app.state.batch.receipt, null, "rejected command does not fabricate a receipt");
  assert.equal(rejected.elements.eduopsBatchExecutionStatus.textContent, "Execution: No execution performed");

  const noReceipt = makeHarness({ missingReceipt: true });
  noReceipt.clickExecute();
  noReceipt.app.state.confirm.onProceed();
  await tick();
  assert.equal(noReceipt.app.state.batch.confirmationDiagnostic.blockCode, "BATCH_CONFIRMATION_COMMAND_REJECTED");
  assert.equal(noReceipt.app.state.batch.confirmationDiagnostic.receiptReturned, false);
  assert.equal(noReceipt.app.state.batch.step, "confirm", "missing receipt keeps the UI out of receipt state");

  console.log("PASS R376I batch confirmation transition repair: modal, diagnostics, idempotency, cancel safety, duplicate guard, receipt gate");
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
