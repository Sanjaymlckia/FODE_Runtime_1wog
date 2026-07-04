const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const adminSource = fs.readFileSync("Admin.js", "utf8");

function extractFunction(source, name) {
  const signature = `function ${name}`;
  const start = source.indexOf(signature);
  assert.notEqual(start, -1, `Function ${name} must exist`);
  const braceStart = source.indexOf("{", start);
  let depth = 0;
  for (let i = braceStart; i < source.length; i++) {
    const ch = source[i];
    if (ch === "{") depth++;
    if (ch === "}") depth--;
    if (depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Unable to extract ${name}`);
}

const ledgerFunctionNames = [
  "populationLedgerBucketNames_",
  "populationLedgerEmptyBucketCounts_",
  "populationLedgerRowObjectFromValues_",
  "populationLedgerNextActionFamily_",
  "populationLedgerBucketFromActionability_",
  "populationLedgerClassifyRow_",
  "populationLedgerPublicSummary_",
  "buildPopulationLedgerFromValues_",
  "admin_getPopulationLedger"
];
const ledgerSource = ledgerFunctionNames.map((name) => extractFunction(adminSource, name)).join("\n\n");

assert.doesNotMatch(ledgerSource, /admin_getReviewQueues|isQueueCandidateRow_/, "Population ledger must not use Review Queue membership as population authority");
assert.doesNotMatch(ledgerSource, /slice\(0,\s*limit\)|p\.limit|payload\.limit/, "Population ledger must not apply visible row windowing");
assert.match(ledgerSource, /hiddenByLimit:\s*0/, "Population ledger must report no hidden-by-limit count");

const sheetValues = [
  ["ApplicantID", "First_Name"],
  ["A-001", "Applicant"],
  ["", "Blank"],
  ["A-002", "Officer"],
  ["A-002", "Duplicate"],
  ["A-003", "Broken"]
];

const context = {
  console,
  Date,
  Number,
  Math,
  Object,
  Array,
  String,
  Error,
  clean_(value) {
    return value == null ? "" : String(value).trim();
  },
  getCallerEmail_() {
    return "admin@example.test";
  },
  isAdmin_() {
    return true;
  },
  openDataSheet_() {
    return {
      getName() {
        return "FODE_Data";
      },
      getDataRange() {
        return {
          getValues() {
            return sheetValues;
          }
        };
      }
    };
  },
  buildActionabilityPreviewRow_(row, rowNumber) {
    if (row.ApplicantID === "A-003") throw new Error("fixture resolver failure");
    if (rowNumber === 2) {
      return {
        actionOwner: "APPLICANT",
        nextAction: "UPLOAD_REQUIRED_DOCUMENTS",
        urgencyLevel: "NORMAL",
        suppressor: "",
        authorityState: { lifecycleStage: "DOCS_REQUIRED" }
      };
    }
    if (rowNumber === 4) {
      return {
        actionOwner: "OFFICER",
        nextAction: "REVIEW_DOCUMENTS",
        urgencyLevel: "NORMAL",
        suppressor: "OFFICER_ACTION_PENDING",
        authorityState: { lifecycleStage: "PROCESSING" }
      };
    }
    return {
      actionOwner: "FINANCE",
      nextAction: "VERIFY_PAYMENT",
      urgencyLevel: "NORMAL",
      suppressor: "FINANCE_ACTION_PENDING",
      authorityState: { lifecycleStage: "RECEIPT_AWAITING_VERIFICATION" }
    };
  }
};

vm.createContext(context);
vm.runInContext(ledgerSource, context);

const ledger = context.admin_getPopulationLedger({ limit: 1, sampleLimit: 5 });

assert.equal(ledger.ok, true);
assert.equal(ledger.readOnly, true);
assert.equal(ledger.sourceSheetName, "FODE_Data");
assert.equal(ledger.scannedRows, 5, "Ledger must scan all sheet data rows, including rows without ApplicantID");
assert.equal(ledger.applicantIdRows, 4, "Ledger must count every row with ApplicantID");
assert.equal(ledger.entries.length, 4, "Every ApplicantID row must appear exactly once in ledger entries");
assert.deepEqual(Array.from(ledger.entries, (entry) => entry.rowNumber), [2, 4, 5, 6]);
assert.equal(ledger.hiddenByLimit, 0, "Full-population ledger must not hide rows behind UI windowing");

const bucketTotal = Object.values(ledger.operationalBucketCounts).reduce((sum, count) => sum + count, 0);
assert.equal(bucketTotal, ledger.applicantIdRows, "Bucket counts must sum to ApplicantID rows");
assert.equal(ledger.operationalBucketCounts["Applicant Action"], 1);
assert.equal(ledger.operationalBucketCounts["Admissions Review"], 1);
assert.equal(ledger.operationalBucketCounts["Finance"], 1);
assert.equal(ledger.operationalBucketCounts["Unknown / Unclassified"], 1, "Unknown bucket must be explicit");
assert.equal(ledger.unclassifiedRows, 1);
assert.equal(ledger.unknownUnclassifiedCount, 1);
assert.equal(ledger.sampleUnclassifiedRows.length, 1);
assert.equal(ledger.sampleUnclassifiedRows[0].applicantId, "A-003");
assert.match(ledger.sampleUnclassifiedRows[0].reason, /fixture resolver failure/);
assert.deepEqual(JSON.parse(JSON.stringify(ledger.duplicateApplicantIds)), [{ applicantId: "A-002", rowNumbers: [4, 5] }]);
assert.equal(ledger.integrityStatus, "WARN", "Duplicates or unknown rows should warn without breaking read-only accounting");
assert.ok(ledger.integrityMessages.some((message) => /Unknown \/ Unclassified/.test(message)));

const noLimitLedger = context.admin_getPopulationLedger({});
assert.equal(noLimitLedger.applicantIdRows, ledger.applicantIdRows, "Visible limit payload must not affect ledger totals");
assert.equal(noLimitLedger.entries.length, ledger.entries.length, "Visible limit payload must not affect ledger entries");

const summaryOnly = context.buildPopulationLedgerFromValues_(sheetValues, "FODE_Data", { includeEntries: false });
assert.equal(summaryOnly.applicantIdRows, 4);
assert.equal(summaryOnly.entries.length, 0, "Internal dashboard consumers can request summary-only ledger payloads");
assert.equal(summaryOnly.operationalBucketCounts["Unknown / Unclassified"], 1);
assert.equal(Object.values(summaryOnly.operationalBucketCounts).reduce((sum, count) => sum + count, 0), summaryOnly.applicantIdRows);

const publicSummary = context.populationLedgerPublicSummary_(ledger);
assert.equal(publicSummary.applicantIdRows, ledger.applicantIdRows);
assert.equal(publicSummary.hiddenByLimit, 0);
assert.equal(publicSummary.entries, undefined, "Public dashboard summary must not expose row-level entries");

console.log("PASS population ledger accounts for full applicant population exactly once");
console.log("PASS population ledger keeps Review Queue counts out of population authority");
