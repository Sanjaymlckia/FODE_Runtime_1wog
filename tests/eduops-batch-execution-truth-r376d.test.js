const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

function read(file) { return fs.readFileSync(file, "utf8"); }
function extractFunction(source, name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  for (let i = brace; i < source.length; i += 1) {
    if (source[i] === "{") depth += 1;
    if (source[i] === "}") depth -= 1;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Could not extract ${name}`);
}

const selected = read("Admin_SelectedApplicantCommunications.js");
const receipts = read("EduOps_Receipts.js");
const code = read("Code.js");
const batch = read("EduOps_ClientBatch.html");
const core = read("EduOps_ClientCore.html");
const styles = read("EduOps_Styles.html");

const selectedContext = {
  clean_: (value) => String(value || "").trim()
};
vm.createContext(selectedContext);
vm.runInContext(extractFunction(selected, "selectedBatchApplicantOutcome_"), selectedContext);
vm.runInContext(extractFunction(selected, "selectedBatchOutcomeTotals_"), selectedContext);

const partial = { applicantOutcomes: [] };
partial.applicantOutcomes.push(selectedContext.selectedBatchApplicantOutcome_("FODE-1", { result: "SENT", gmailAccepted: true, rowPatchConfirmed: true, communicationRecorded: true }, null));
partial.applicantOutcomes.push(selectedContext.selectedBatchApplicantOutcome_("FODE-2", { result: "SENT", gmailAccepted: true, rowPatchConfirmed: true, communicationRecorded: true }, null));
partial.applicantOutcomes.push(selectedContext.selectedBatchApplicantOutcome_("FODE-3", { result: "SENT", gmailAccepted: true, rowPatchConfirmed: true, communicationRecorded: true }, null));
partial.applicantOutcomes.push(selectedContext.selectedBatchApplicantOutcome_("FODE-4", { result: "BLOCKED", blockCode: "COOLDOWN_ACTIVE", blockReason: "Cooldown active." }, null));
partial.applicantOutcomes.push(selectedContext.selectedBatchApplicantOutcome_("FODE-5", { result: "BLOCKED", blockCode: "NO_EFFECTIVE_EMAIL", blockReason: "No email." }, null));
selectedContext.selectedBatchOutcomeTotals_(partial);
assert.equal(partial.sent, 3);
assert.equal(partial.blocked, 2);
assert.equal(partial.failed, 0);
assert.equal(partial.reconciliationRequired, 0);
assert.equal(partial.result, "PARTIAL");
assert.deepEqual(partial.applicantOutcomes.map((item) => item.outcome), ["SENT", "SENT", "SENT", "BLOCKED", "BLOCKED"]);
assert(!partial.applicantOutcomes.some((item) => item.outcome === "UNCONFIRMED"));

const isolated = { applicantOutcomes: [
  selectedContext.selectedBatchApplicantOutcome_("FODE-1", { result: "SENT", gmailAccepted: true, rowPatchConfirmed: true, communicationRecorded: true }, null),
  selectedContext.selectedBatchApplicantOutcome_("FODE-2", null, new Error("unexpected row read failure")),
  selectedContext.selectedBatchApplicantOutcome_("FODE-3", { result: "SENT", gmailAccepted: true, rowPatchConfirmed: true, communicationRecorded: true }, null)
] };
selectedContext.selectedBatchOutcomeTotals_(isolated);
assert.deepEqual(isolated.applicantOutcomes.map((item) => item.outcome), ["SENT", "FAILED", "SENT"]);
assert.equal(isolated.result, "PARTIAL");

const reconcile = selectedContext.selectedBatchApplicantOutcome_("FODE-9", {
  result: "RECONCILIATION_REQUIRED",
  gmailAttempted: true,
  gmailAccepted: true,
  rowPatchConfirmed: false,
  communicationRecorded: false,
  blockCode: "POST_SEND_PERSISTENCE_INCOMPLETE"
}, null);
assert.equal(reconcile.outcome, "RECONCILIATION_REQUIRED");
assert.equal(reconcile.gmailAccepted, true);
assert.equal(reconcile.rowPatchConfirmed, false);

const drift = selectedContext.selectedBatchApplicantOutcome_("FODE-10", {
  result: "BLOCKED",
  blockCode: "RECIPIENT_AUTHORITY_CHANGED",
  blockReason: "Execution-time authority changed.",
  gmailAttempted: false
}, null);
assert.equal(drift.outcome, "BLOCKED");
assert.equal(drift.blockCode, "RECIPIENT_AUTHORITY_CHANGED");
assert.equal(drift.gmailAttempted, false);

const receiptContext = {
  eduopsClean_: (value) => String(value || "").trim(),
  eduopsUpper_: (value, fallback) => (String(value || fallback || "UNKNOWN").trim().toUpperCase() || String(fallback || "UNKNOWN").toUpperCase()),
  eduopsReceiptId_: () => "EDUOPS-RECEIPT-TEST",
  eduopsRecordReceiptHistory_: () => {},
  logAdminEvent_: () => {}
};
vm.createContext(receiptContext);
vm.runInContext(extractFunction(receipts, "eduopsApplicantOutcomes_"), receiptContext);
vm.runInContext(extractFunction(receipts, "eduopsBuildReceipt_"), receiptContext);
const receipt = receiptContext.eduopsBuildReceipt_({
  previewId: "PREVIEW-1",
  operation: "BATCH_COMMUNICATION",
  selectedApplicantIds: ["FODE-1", "FODE-2", "FODE-3", "FODE-4", "FODE-5"],
  selectedTemplate: { templateId: "docs_missing", label: "Missing documents" },
  subject: "Subject"
}, partial);
assert.equal(receipt.sentCount, 3);
assert.equal(receipt.blockedCount, 2);
assert.equal(receipt.failedCount, 0);
assert.equal(receipt.reconciliationRequiredCount, 0);
assert.equal(receipt.unresolvedCount, 0);
assert.equal(receipt.outcome, "PARTIAL");
assert.equal(receipt.applicantOutcomes.length, 5);

assert.match(selected, /try\s*\{[\s\S]*sendApplicantMessage_\(applicantId, messageType[\s\S]*catch \(recipientErr\)/, "recipient exceptions must be isolated inside the selected-batch loop");
assert.match(selected, /applicantOutcomes:[\s\S]*selectedBatchOutcomeTotals_\(out\)[\s\S]*clearSelectedApplicantBatchPreviewCache_\(adminEmail\)/, "preview must be cleared after exact outcomes are accumulated");
assert.match(code, /result:\s*"RECONCILIATION_REQUIRED"[\s\S]*gmailAccepted:\s*true[\s\S]*rowPatchConfirmed:\s*false/, "Gmail success with persistence failure must require reconciliation");
assert.match(receipts, /function eduops_recoverCommandReceipt[\s\S]*readOnly:\s*true[\s\S]*eduopsReadIdempotentReceipt_/, "recovery must read the existing idempotent receipt without executing sends");
assert.match(batch, /Execution outcome not yet confirmed/, "client timeout must show unknown-outcome state");
assert.match(batch, /Reconcile this batch before retrying/, "client timeout must warn against normal retry");
assert.match(batch, /eduops_recoverCommandReceipt/, "client timeout must use read-only recovery");
assert.match(batch, /var steps = \["cohort", "partitions", "preview", "confirm", "receipt"\]/, "communication flow sequence must remain frozen");
assert.match(batch, /recipientTable\(recipients, false\)[\s\S]*proceedLabel: batch\.preview\.summary[\s\S]*cancelLabel: "Return to preview"/, "confirmation modal workflow and labels must remain unchanged");
assert.match(styles, /grid-template-rows:[^;]*minmax\(0, 1fr\)/, "confirmation modal must use a bounded header/body/footer grid");
assert.match(styles, /max-height:\s*calc\(100vh - 48px\)/, "confirmation modal must fit inside the viewport");
assert.match(styles, /#eduopsConfirmText[\s\S]*overflow-y:\s*auto/, "confirmation modal body must scroll internally");
assert.match(styles, /body\.eduops-confirm-open\s*\{\s*overflow:\s*hidden/, "background page must not scroll while the modal is open");
assert.match(core, /event\.key === "Escape"[\s\S]*cancel\.disabled[\s\S]*return/, "Escape must not dismiss an executing or unknown-outcome confirmation");
assert.doesNotMatch(batch, /application_receipt_request|Dear applicant|Missing Documents Follow-Up/, "R376D client changes must not introduce template copy");

console.log("PASS R376D exact batch outcomes, reconciliation recovery, modal containment, and flow freeze");
