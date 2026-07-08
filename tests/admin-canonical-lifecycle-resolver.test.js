const fs = require("node:fs");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const lifecycleSource = fs.readFileSync("Admin_LifecycleAuthority.js", "utf8");

function extractFunction(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Function ${name} must exist`);
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
    if (ch === "\"" || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Function ${name} is not closed`);
}

const requiredDocs = [
  "Birth_ID_Passport_File",
  "Latest_School_Report_File",
  "Passport_Photo_File"
];

function clean(value) {
  return String(value == null ? "" : value).trim();
}

function docStatus(row) {
  const statuses = ["Birth_ID_Status", "Report_Status", "Photo_Status"].map((field) => clean(row[field]));
  if (statuses.some((value) => /^rejected$/i.test(value))) return "Rejected";
  if (statuses.every((value) => /^verified$/i.test(value))) return "Verified";
  return "Pending";
}

const context = {
  Date,
  clean_: clean,
  isYes_: (value) => /^(yes|true|1)$/i.test(clean(value)),
  parseTime_: (value) => {
    const text = clean(value);
    if (!text) return 0;
    const time = Date.parse(text);
    return Number.isFinite(time) ? time : 0;
  },
  campaignAttemptCount_: (row) => Math.max(0, Math.floor(Number(row.Email_Attempt_Count || 0) || 0)),
  adminOpsRequiredDocumentUploadSummary_: (row) => {
    const uploaded = requiredDocs.filter((field) => !!clean(row[field]));
    const missing = requiredDocs.filter((field) => !clean(row[field]));
    return {
      requiredCount: requiredDocs.length,
      uploadedRequiredCount: uploaded.length,
      missingRequiredDocuments: missing,
      uploadedRequiredDocuments: uploaded,
      requiredDocumentUploadComplete: uploaded.length === requiredDocs.length
    };
  },
  adminRowPaymentAuthorityFacts_: (row) => ({
    paymentEvidencePresent: !!clean(row.Fee_Receipt_File),
    paymentVerified: /^verified$/i.test(clean(row.Receipt_Status))
  }),
  adminRowPortalSubmitted_: (row) => /^yes$/i.test(clean(row.Portal_Submitted)),
  computeDocVerificationStatus_: docStatus,
  adminDocumentReviewVerifiedForAutomation_: (row) => /^yes$/i.test(clean(row.Docs_Verified)) || docStatus(row) === "Verified"
};

vm.createContext(context);
vm.runInContext([
  extractFunction(lifecycleSource, "resolveCanonicalApplicantLifecycle_"),
  extractFunction(lifecycleSource, "compareLegacyCanonicalLifecycle_")
].join("\n\n"), context);

const nowTs = Date.parse("2026-07-08T10:00:00Z");
const yesterday = "2026-07-07T00:00:00Z";
const base = {
  ApplicantID: "FODE-TEST-001",
  Parent_Email: "parent@example.com",
  Email_Status: "SENT",
  Email_Attempt_Count: 1,
  Email_Next_Action_Date: yesterday
};

function resolve(row) {
  return context.resolveCanonicalApplicantLifecycle_({ ...base, ...row }, { nowTs });
}

function resolveFresh(row) {
  return context.resolveCanonicalApplicantLifecycle_({ ApplicantID: "FODE-TEST-FRESH", Parent_Email: "parent@example.com", ...row }, { nowTs });
}

let result = resolveFresh({});
assert.equal(result.baseState, "APPLICATION_RECEIVED", "fresh row before portal/contact must resolve to APPLICATION_RECEIVED");
assert.equal(result.recommendedMessageType, "legacy_invite", "fresh row should recommend invite/portal setup");

result = resolveFresh({ Portal_Link: "https://portal.example.test/app" });
assert.equal(result.baseState, "AWAITING_PORTAL_OR_INTAKE", "portal issued before contact start must resolve to AWAITING_PORTAL_OR_INTAKE");

result = resolve({});
assert.equal(result.baseState, "INCOMPLETE_DOCUMENTS", "missing uploads must resolve to INCOMPLETE_DOCUMENTS");
assert.equal(result.recommendedMessageType, "docs_missing", "missing uploads should recommend document follow-up");
assert.ok(result.overlays.includes("REMINDER_DUE"), "reminder due must be an overlay");
assert.notEqual(result.baseState, "REMINDER_DUE", "REMINDER_DUE must not be a base lifecycle state");
let mismatch = context.compareLegacyCanonicalLifecycle_("REMINDER_DUE", result);
assert.equal(mismatch.hasLifecycleMismatch, true, "legacy REMINDER_DUE must mismatch canonical missing-document base state");
assert.equal(mismatch.legacyLifecycle, "REMINDER_DUE");
assert.equal(mismatch.canonicalBaseState, "INCOMPLETE_DOCUMENTS");
assert.deepEqual(Array.from(mismatch.canonicalOverlays), ["REMINDER_DUE", "AWAITING_APPLICANT"]);
assert.match(mismatch.mismatchReason, /overlay/, "REMINDER_DUE mismatch reason must explain overlay semantics");

mismatch = context.compareLegacyCanonicalLifecycle_("DOCS_REQUIRED", result);
assert.equal(mismatch.hasLifecycleMismatch, false, "legacy DOCS_REQUIRED should be equivalent to canonical INCOMPLETE_DOCUMENTS");

result = resolve({ Portal_Submitted: "Yes", Birth_ID_Passport_File: "birth.pdf" });
assert.equal(result.baseState, "INCOMPLETE_DOCUMENTS", "portal submitted with incomplete uploads must remain INCOMPLETE_DOCUMENTS");

result = resolve({
  Portal_Submitted: "Yes",
  Birth_ID_Passport_File: "birth.pdf",
  Latest_School_Report_File: "report.pdf",
  Passport_Photo_File: "photo.pdf"
});
assert.equal(result.baseState, "DOCUMENTS_TO_VERIFY", "complete uploads pending verification must route to DOCUMENTS_TO_VERIFY");
assert.equal(result.actionOwner, "OFFICER", "document verification state must be officer-owned");

result = resolve({
  Portal_Submitted: "Yes",
  Birth_ID_Passport_File: "birth.pdf",
  Latest_School_Report_File: "report.pdf",
  Passport_Photo_File: "photo.pdf",
  Birth_ID_Status: "Rejected"
});
assert.equal(result.baseState, "DOCUMENT_CORRECTION_REQUIRED", "rejected document status must require correction");
assert.equal(result.recommendedMessageType, "docs_missing", "document correction can still recommend document follow-up");

result = resolve({
  Portal_Submitted: "Yes",
  Birth_ID_Passport_File: "birth.pdf",
  Latest_School_Report_File: "report.pdf",
  Passport_Photo_File: "photo.pdf",
  Birth_ID_Status: "Verified",
  Report_Status: "Verified",
  Photo_Status: "Verified"
});
assert.equal(result.baseState, "PAYMENT_PENDING", "verified documents without payment evidence must route to PAYMENT_PENDING");
assert.equal(result.recommendedMessageType, "payment_followup", "payment pending should recommend payment follow-up");

result = resolve({
  Portal_Submitted: "Yes",
  Birth_ID_Passport_File: "birth.pdf",
  Latest_School_Report_File: "report.pdf",
  Passport_Photo_File: "photo.pdf",
  Birth_ID_Status: "Verified",
  Report_Status: "Verified",
  Photo_Status: "Verified",
  Fee_Receipt_File: "receipt.pdf"
});
assert.equal(result.baseState, "PAYMENT_TO_VERIFY", "uploaded receipt without verification must route to PAYMENT_TO_VERIFY");

result = resolve({
  Portal_Submitted: "Yes",
  Birth_ID_Passport_File: "birth.pdf",
  Latest_School_Report_File: "report.pdf",
  Passport_Photo_File: "photo.pdf",
  Birth_ID_Status: "Verified",
  Report_Status: "Verified",
  Photo_Status: "Verified",
  Fee_Receipt_File: "receipt.pdf",
  Receipt_Status: "Verified"
});
assert.equal(result.baseState, "ENROLMENT_READY", "payment verified without enrolment must route to ENROLMENT_READY");
assert.notEqual(result.baseState, "COMPLETE", "payment verification alone must not mark lifecycle COMPLETE");

result = resolve({
  Portal_Submitted: "Yes",
  Birth_ID_Passport_File: "birth.pdf",
  Latest_School_Report_File: "report.pdf",
  Passport_Photo_File: "photo.pdf",
  Birth_ID_Status: "Verified",
  Report_Status: "Verified",
  Photo_Status: "Verified",
  Fee_Receipt_File: "receipt.pdf",
  Receipt_Status: "Verified",
  Enrolled_Confirmed: "Yes"
});
assert.equal(result.baseState, "COMPLETE", "enrolment confirmation must mark lifecycle COMPLETE");

console.log("PASS canonical lifecycle resolver invariants");
