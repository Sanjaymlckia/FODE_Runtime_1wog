const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const adminSource = fs.readFileSync("Admin.js", "utf8");
const uiSource = fs.readFileSync("AdminUI.html", "utf8");
const canonicalSource = fs.readFileSync("Admin_CanonicalPopulation.js", "utf8");
const previewData = require("../tools/eduops-snapshot-capture/server/preview-data");

function extractFunction(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `${name} must exist`);
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
    if (ch === "\"" || ch === "'" || ch === "`") quote = ch;
    else if (ch === "{") depth += 1;
    else if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name} is not closed`);
}

assert.match(adminSource, /actionabilityState = "UNCONTACTABLE"/, "Server resolver must expose an explicit Uncontactable state");
assert.match(adminSource, /actionabilityState = "DORMANT"/, "Server resolver must expose an explicit Dormant state");
assert.match(adminSource, /Third governed reminder exhausted/, "Third reminder exhaustion must be an explicit follow-up reason");
assert.match(adminSource, /communicationReminderCount/, "Actionability DTO must expose reminder count");
assert.match(adminSource, /communicationLastAttemptAt/, "Actionability DTO must expose last attempt timestamp");
assert.match(adminSource, /communicationNextActionAt/, "Actionability DTO must expose cooling/next-action timestamp");
assert.match(canonicalSource, /communicationReminderCount/, "Canonical population projection must preserve cadence facts");
assert.match(uiSource, /actionabilityRecipientEmail_/, "Worklist must render an authoritative recipient address");
assert.match(uiSource, /No email recorded/, "Missing email must be explicit in the UI");
assert.match(uiSource, /No phone recorded/, "Missing phone must be explicit in the UI");
assert.match(uiSource, /Uncontactable/, "Uncontactable must be humanized in the UI");
assert.match(uiSource, /Dormant \/ re-engagement/, "Dormant must be humanized in the UI");

const rows = previewData.rowsForScenario("r410-actionability-gallery");
const byId = new Map(rows.map((row) => [row.applicantId, row]));
assert.equal(byId.get("FODE-26-002985").actionabilityState, "COMPLETE", "Jackson Numa must remain Complete in the R410 fixture");
assert.equal(byId.get("FODE-26-R410-UNCONTACTABLE").actionabilityState, "UNCONTACTABLE");
assert.equal(byId.get("FODE-26-R410-UNCONTACTABLE").selectable, false);
assert.equal(byId.get("FODE-26-R410-REMINDER-3").actionabilityState, "DORMANT");
assert.equal(byId.get("FODE-26-R410-REMINDER-3").selectable, false);
assert.equal(byId.get("FODE-26-R410-REMINDER-1").reminderCount, 1);
assert.equal(byId.get("FODE-26-R410-REMINDER-2").reminderCount, 2);
assert.equal(byId.get("FODE-26-R410-REMINDER-3").reminderCount, 3);
assert.equal(byId.get("FODE-26-R410-LONG").email.includes("multiple.segments"), true);

const gallery = previewData.handleRpc(
  "eduops_getDocumentManifest",
  { scenarioId: "r410-actionability-gallery", serverDurationMs: 0 },
  { applicantId: "FODE-26-R410-VERIFIED", product: "FODE" },
  process.cwd()
);
assert.equal(gallery.ok, true, "R410 gallery manifest must be available in Preview");
assert.equal(gallery.files.length + gallery.missingExpected.length, 5, "All five required document positions must be returned together");
assert.deepEqual(
  gallery.documentGallery.documents.map((item) => item.label),
  ["Birth / ID / Passport", "Latest School Report", "Transfer Certificate", "Passport Photo", "Fee Receipt"]
);
assert.equal(gallery.missingExpected.length, 2, "Missing positions must remain visible instead of serial Next navigation");

const resolver = extractFunction(adminSource, "resolveActionabilityState_");
const batchType = extractFunction(adminSource, "actionabilityBatchMessageTypeForRecommendation_");
const context = {
  clean_: (value) => String(value == null ? "" : value).trim(),
  communicationRecommendedMessageTypeForStage_: () => "docs_missing"
};
vm.createContext(context);
vm.runInContext(`${batchType}\n${resolver}`, context);
assert.equal(context.resolveActionabilityState_({ owner: "APPLICANT", nextAction: "UPLOAD_REQUIRED_DOCUMENTS", recommendedMessageType: "document_completion_reminder", requiredDocumentUploadComplete: false, requiredDocumentCount: 3, uploadedRequiredDocumentCount: 0, reminderDue: false }).actionabilityState, "AWAITING_APPLICANT");
assert.equal(context.resolveActionabilityState_({ owner: "APPLICANT", nextAction: "UPLOAD_REQUIRED_DOCUMENTS", recommendedMessageType: "document_completion_reminder", requiredDocumentUploadComplete: false, requiredDocumentCount: 3, uploadedRequiredDocumentCount: 0, reminderDue: true }).actionabilityState, "READY");
assert.equal(context.resolveActionabilityState_({ owner: "ADMIN", nextAction: "FIX_CONTACT_DETAILS", suppressor: "UNCONTACTABLE", contactabilityState: "UNCONTACTABLE" }).actionabilityState, "UNCONTACTABLE");
assert.equal(context.resolveActionabilityState_({ owner: "APPLICANT", nextAction: "UPLOAD_REQUIRED_DOCUMENTS", suppressor: "REMINDER_EXHAUSTED", reminderCount: 3 }).actionabilityState, "DORMANT");

console.log("PASS R410 actionability/document-gallery contract");
