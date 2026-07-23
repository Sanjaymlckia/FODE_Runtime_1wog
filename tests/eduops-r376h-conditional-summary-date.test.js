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

const code = read("Code.js");
const core = read("EduOps_ClientCore.html");
const workbench = read("EduOps_ClientWorkbench.html");

const ctx = {
  clean_: value => String(value == null ? "" : value).trim(),
  normalizeApplicantMessageType_: value => String(value == null ? "" : value).trim(),
  buildApplicantFullName_: row => [row.First_Name, row.Last_Name].filter(Boolean).join(" "),
  actionRequiredPlaceholder_: label => `[ACTION REQUIRED: ${label}]`,
  subjectsToCsv_: value => Array.isArray(value) ? value.join(", ") : String(value || "").trim(),
  applicantDocumentStatusSummary_: () => "Document status: review is still in progress or documents are still required.",
  applicantPaymentStatusSummary_: () => "Payment status: payment receipt/evidence has not yet been verified."
};
vm.createContext(ctx);
[
  "firstNonEmptyRowValue_",
  "firstCsvRowValue_",
  "applicantGradeValue_",
  "applicantSubjectsValue_",
  "applicantGradeOrPlaceholder_",
  "applicantSubjectsOrPlaceholder_",
  "applicantGradeDisplayOrUnconfirmed_",
  "applicantSubjectsDisplayOrUnconfirmed_",
  "communicationRequiresSubjects_",
  "communicationApplicantSummaryBlock_"
].forEach(name => vm.runInContext(extractFunction(code, name), ctx));

const missingSubjectsContext = {
  applicantId: "FODE-26-000006",
  messageType: "docs_missing",
  rowObj: { First_Name: "Albert", Last_Name: "Tapu", Grade: "Grade 10" }
};
const missingSummary = ctx.communicationApplicantSummaryBlock_(missingSubjectsContext, { includeStatus: true });
assert.match(missingSummary, /Applicant ID: FODE-26-000006/);
assert.match(missingSummary, /Student: Albert Tapu/);
assert.match(missingSummary, /Grade: Grade 10/);
assert.doesNotMatch(missingSummary, /^Subjects:/m, "docs_missing must omit absent optional subjects");
assert.doesNotMatch(missingSummary, /\[ACTION REQUIRED: confirm subjects\]/);

const confirmedSummary = ctx.communicationApplicantSummaryBlock_({
  applicantId: "FODE-26-SUBJECTS",
  messageType: "docs_missing",
  rowObj: { First_Name: "Subject", Last_Name: "Ready", Subjects_Selected_Canonical: "English, Mathematics" }
}, { includeStatus: true });
assert.match(confirmedSummary, /Subjects: English, Mathematics/);
assert.doesNotMatch(confirmedSummary, /\[ACTION REQUIRED: confirm subjects\]/);

assert.equal(ctx.communicationRequiresSubjects_("docs_missing"), false);
assert.equal(ctx.communicationRequiresSubjects_("application_feedback"), false);
assert.equal(ctx.communicationRequiresSubjects_("payment_followup"), true);
assert.equal(ctx.communicationRequiresSubjects_("application_verified_quote"), true);
assert.match(code, /communicationRequiresSubjects_\(normalizedType\)[\s\S]*block\("SUBJECTS_AUTHORITY_REQUIRED"\)/, "subject-dependent previews must block before rendering without subject authority");
assert.match(code, /SUBJECTS_AUTHORITY_REQUIRED:[\s\S]*Authoritative subject selection is required/, "subject authority block must have an operator-visible reason");
assert.doesNotMatch(code, /confirm subjects before calculating FODE quote/, "subject-cost templates must not emit the old applicant-facing subject placeholder");

assert.match(core, /if \(value == null \|\| value === ""\) return "Not scheduled";/, "blank Workbench dates must use a neutral display value");
assert.match(core, /if \(isNaN\(date\.getTime\(\)\)\) return "Not scheduled";/, "invalid Workbench dates must use a neutral display value");
assert.match(workbench, /Cooldown \/ next action[\s\S]*coolingOffDate \+ " \/ " \+ nextActionDate/, "overview ribbon must show human-readable cooldown and next-action dates");
assert.match(workbench, /Cooling-off until \(ISO\)[\s\S]*Next action date \(ISO\)/, "raw overview dates must stay inside technical details");
assert.match(workbench, /Version saved '\s*\+ app\.esc\(versionDate\)/, "template version timestamps must render through the shared PNG formatter");
assert.match(workbench, /Template version created \(ISO\)/, "raw template version timestamp must remain technical-only");
assert.match(workbench, /Preview expires '\s*\+ app\.esc\(app\.formatPngDate\(preview\.expiresAt\)/, "preview expiry must be human-readable");
assert.match(workbench, /Expiry \(ISO\)/, "raw preview expiry must be labelled as ISO technical detail");
assert.match(workbench, /formatPngDate\(receipt\.at\)/, "receipt history timestamps must use the shared PNG formatter");

console.log("PASS R376H conditional applicant summary and Workbench date display");
