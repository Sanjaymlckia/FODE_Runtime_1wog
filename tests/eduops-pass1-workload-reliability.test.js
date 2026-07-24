const fs = require("node:fs");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const crypto = require("node:crypto");

const cacheValues = new Map();
const cache = {
  get(key) { return cacheValues.has(key) ? cacheValues.get(key) : null; },
  put(key, value) { cacheValues.set(key, value); },
  getAll(keys) {
    return Object.fromEntries(keys.filter((key) => cacheValues.has(key)).map((key) => [key, cacheValues.get(key)]));
  },
  putAll(values) { Object.entries(values).forEach(([key, value]) => cacheValues.set(key, value)); }
};

const context = {
  console,
  CONFIG: {},
  CacheService: { getScriptCache: () => cache },
  Utilities: {
    DigestAlgorithm: { SHA_256: "sha256" },
    Charset: { UTF_8: "utf8" },
    computeDigest(_algorithm, source) {
      return Array.from(crypto.createHash("sha256").update(String(source)).digest());
    },
    base64EncodeWebSafe(bytes) {
      return Buffer.from(bytes).toString("base64url");
    },
    newBlob(value) {
      return { getBytes: () => Array.from(Buffer.from(String(value), "utf8")) };
    }
  },
  clean_(value) { return String(value == null ? "" : value).trim(); }
};
vm.createContext(context);
for (const file of ["EduOps_Contracts.js", "EduOps_FeatureFlags.js", "EduOps_FODE_Adapter.js", "EduOps_Workload.js"]) {
  vm.runInContext(fs.readFileSync(file, "utf8"), context, { filename: file });
}

let sourceVersion = 1000;
let authorityRevision = "A";
let canonicalBuilds = 0;
context.eduopsFodeSourceVersion_ = () => ({
  key: `FODE|sheet|FODE_Data|3|12|${sourceVersion}`,
  product: "FODE",
  spreadsheetId: "sheet",
  sheetName: "FODE_Data",
  lastRow: 3,
  lastColumn: 12,
  updatedMs: sourceVersion,
  cacheable: true,
  durationMs: 0
});
context.eduopsFodeCanonicalSnapshot_ = () => {
  canonicalBuilds += 1;
  return {
    schemaVersion: "CANONICAL_POPULATION_V1",
    generatedAt: `2026-07-15T00:00:0${canonicalBuilds}.000Z`,
    sourceSheetName: "FODE_Data",
    totalRows: 2,
    rows: [
      canonicalRow("FODE-26-001", 2, "READY", authorityRevision),
      canonicalRow("FODE-26-002", 3, "REVIEW_REQUIRED", "FIX_CONTACT_DETAILS")
    ]
  };
};
context.eduopsFodeCacheableRows_ = (snapshot) => snapshot.rows.map((row) => ({
  rowNumber: row.identity.rowNumber,
  applicantId: row.identity.applicantId,
  name: row.applicant.name,
  email: row.applicant.effectiveEmail,
  phone: row.applicant.phone,
  actionabilityState: row.actionability.state,
  worklistKey: row.actionability.worklistKey,
  worklistLabel: row.actionability.worklistKey,
  nextAction: row.actionability.nextAction,
  actionOwner: "OFFICER",
  selectable: row.actionability.selectable,
  urgencyLevel: "HIGH",
  authorityState: {}
}));

function canonicalRow(applicantId, rowNumber, state, nextAction) {
  return {
    identity: { applicantId, rowNumber },
    applicant: { name: applicantId, effectiveEmail: `${applicantId}@example.test`, phone: "" },
    lifecycle: { baseState: state, overlays: [] },
    actionability: { state, worklistKey: "TEST", nextAction, selectable: state === "READY" },
    finance: { financeAuthority: { financeState: "NOT_YET_PAYMENT_APPLICABLE" } },
    documents: { state: "UNKNOWN" },
    contactability: { state: "EMAIL_AVAILABLE" }
  };
}

const access = { email: "operator@example.test", role: "ADMIN" };
const first = context.eduopsResolveFodeSnapshot_(access);
const second = context.eduopsResolveFodeSnapshot_(access);
assert.equal(first.cacheState, "MISS_REHYDRATED");
assert.equal(second.cacheState, "HIT");
assert.equal(second.snapshotId, first.snapshotId, "warm page/state/scope reads must retain snapshot identity");
assert.equal(canonicalBuilds, 1, "warm reads must not rebuild the canonical snapshot");

cacheValues.clear();
const rehydrated = context.eduopsResolveFodeSnapshot_(access);
assert.equal(rehydrated.snapshotId, first.snapshotId, "cache loss must deterministically reproduce the same identity");
assert.equal(canonicalBuilds, 2);

sourceVersion = 2000;
authorityRevision = "COMPLETE_ENROLMENT";
const changed = context.eduopsResolveFodeSnapshot_(access);
assert.notEqual(changed.snapshotId, first.snapshotId, "a genuine source authority change must produce a new snapshot identity");
assert.equal(changed.cacheState, "MISS_REHYDRATED");

context.eduopsRequireAccess_ = () => access;
context.eduopsFodeRowDto_ = (row, _query, snapshotId, reliability) => ({ applicantId: row.applicantId, snapshotId, sourceReliability: reliability });
const stale = context.eduops_queryOperationalWorkload({
  actionabilityState: "READY",
  workScope: "ALL_AUTHORISED",
  page: 1,
  pageSize: 25,
  expectedSnapshotId: first.snapshotId
});
assert.equal(stale.reliabilityState, "STALE", "an actual source-version change must surface STALE");
assert.equal(stale.snapshotId, changed.snapshotId, "stale requests must not silently rebase to the old identity");
for (const key of [
  "serverRpcMs",
  "canonicalSnapshotResolutionMs",
  "workloadCompositionMs",
  "sortingPagingMs",
  "responseBytes"
]) {
  assert.equal(typeof stale.timings[key], "number", `${key} must be reported`);
}

console.log("PASS EduOps Pass 1 workload snapshot cache, stale-source and timing contracts");
