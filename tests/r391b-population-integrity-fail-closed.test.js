const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

function plain(value) {
  return JSON.parse(JSON.stringify(value));
}

function extractFunction(source, name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Function ${name} must exist`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let index = brace; index < source.length; index += 1) {
    const ch = source[index];
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
    else if (ch === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`Function ${name} is not closed`);
}

const tests = [];
function test(name, body) {
  tests.push({ name, body });
}

const duplicateValues = [
  ["ApplicantID", "First_Name", "Last_Name", "Parent_Email", "Lifecycle_Stage"],
  ["FODE-26-DUP", "First", "Identity", "first-row@example.test", "REMINDER_DUE"],
  ["FODE-26-DUP", "Conflicting", "Identity", "second-row@example.test", "PAYMENT_REQUIRED"],
  ["", "Missing", "Identifier", "missing-id@example.test", "REMINDER_DUE"],
  ["FODE-26-UNIQUE", "Unique", "Identity", "unique@example.test", "REMINDER_DUE"]
];

function rowObject(headers, values) {
  return Object.fromEntries(headers.map((header, index) => [header, values[index]]));
}

function createCanonicalContext(options) {
  const opts = options && typeof options === "object" ? options : {};
  const sourceValues = Array.isArray(opts.values) ? opts.values : duplicateValues;
  const context = {
    console,
    Date,
    Number,
    Math,
    Object,
    Array,
    String,
    Error,
    clean_: (value) => String(value == null ? "" : value).trim(),
    populationLedgerRowObjectFromValues_: rowObject,
    buildActionabilityPreviewRow_(row, rowNumber) {
      const applicantId = String(row.ApplicantID || "").trim();
      return {
        rowNumber,
        applicantId,
        name: `${row.First_Name || ""} ${row.Last_Name || ""}`.trim(),
        actionOwner: "OFFICER",
        workloadGroupKey: "APPLICANT",
        worklistKey: "TEST_WORKLIST",
        worklistLabel: "Test worklist",
        worklistReason: "Deterministic integrity fixture",
        nextAction: "REVIEW",
        actionabilityState: "READY",
        selectable: true,
        selectBlockReason: "",
        recommendedAction: "REVIEW",
        reasonCode: "READY",
        urgencyLevel: "NORMAL",
        suppressor: "",
        recommendedMessageType: "",
        canonicalLifecycle: {
          baseState: "INCOMPLETE_DOCUMENTS",
          lifecycleStage: "INCOMPLETE_DOCUMENTS",
          overlays: [],
          recommendedNextAction: "REVIEW",
          recommendedMessageType: "",
          actionOwner: "OFFICER",
          reason: "Deterministic integrity fixture."
        },
        lifecycleMismatch: {},
        authorityState: {
          lifecycleStage: row.Lifecycle_Stage || "",
          documentState: "UNKNOWN",
          requiredDocumentUploadComplete: false,
          uploadedRequiredDocumentCount: 0,
          requiredDocumentCount: 0,
          missingRequiredDocuments: [],
          docsVerified: false,
          paymentEvidencePresent: false,
          paymentVerified: false,
          hasValidEmail: true,
          hasPhoneFallback: false,
          contactabilityState: "EMAIL_AVAILABLE"
        },
        sourceAuthorities: ["Canonical Lifecycle", "Actionability"]
      };
    },
    compareActionabilityPreviewRows_(left, right) {
      return String(left.applicantId).localeCompare(String(right.applicantId))
        || Number(left.rowNumber) - Number(right.rowNumber);
    },
    stageAggregationEffectiveEmail_: (row) => row.Parent_Email || "",
    resolveCanonicalFinance_() {
      return {
        schemaVersion: "CANONICAL_FINANCE_V1",
        financeAuthority: { financeState: "NOT_YET_PAYMENT_APPLICABLE" },
        operational: {}
      };
    },
    buildPopulationLedgerFromValues_(data, sourceSheetName) {
      const headers = data[0];
      const byId = {};
      const missing = [];
      let applicantIdRows = 0;
      for (let index = 1; index < data.length; index += 1) {
        const row = rowObject(headers, data[index]);
        const applicantId = String(row.ApplicantID || "").trim();
        const hasData = data[index].some((value) => String(value == null ? "" : value).trim());
        if (!applicantId) {
          if (hasData) missing.push({ rowNumber: index + 1, reasonCode: "MISSING_APPLICANT_ID" });
          continue;
        }
        applicantIdRows += 1;
        if (!byId[applicantId]) byId[applicantId] = [];
        byId[applicantId].push(index + 1);
      }
      const duplicates = Object.keys(byId)
        .filter((applicantId) => byId[applicantId].length > 1)
        .map((applicantId) => ({ applicantId, rowNumbers: byId[applicantId] }));
      const identityWarning = duplicates.length || missing.length;
      return {
        ok: true,
        generatedAt: "2026-07-29T00:00:00.000Z",
        sourceSheetName,
        scannedRows: data.length - 1,
        applicantIdRows,
        classifiedRows: applicantIdRows,
        unclassifiedRows: 0,
        duplicateApplicantIds: duplicates,
        missingOrInvalidApplicantIds: missing,
        lifecycleCounts: { INCOMPLETE_DOCUMENTS: applicantIdRows },
        operationalBucketCounts: { Applicant: applicantIdRows },
        nextActionFamilyCounts: { OFFICER: applicantIdRows },
        unknownUnclassifiedCount: 0,
        integrityStatus: opts.ledgerIntegrityStatus || (identityWarning ? "WARN" : "PASS"),
        integrityMessages: Array.isArray(opts.ledgerIntegrityMessages)
          ? opts.ledgerIntegrityMessages.slice()
          : identityWarning
            ? ["Applicant identity integrity requires reconciliation."]
            : ["Population ledger reconciles."]
      };
    },
    populationLedgerPublicSummary_(ledger) {
      return plain(ledger);
    },
    getCallerEmail_: () => "admin@example.test",
    isAdmin_: () => true,
    openDataSheet_: () => ({
      getName: () => "FODE_Data",
      getDataRange: () => ({ getValues: () => sourceValues })
    })
  };
  vm.createContext(context);
  vm.runInContext(read("Admin_CanonicalPopulation.js"), context, {
    filename: "Admin_CanonicalPopulation.js"
  });
  return context;
}

function assertDuplicateIntegrity(integrity) {
  assert.ok(integrity, "Canonical snapshot must expose populationIntegrity");
  assert.equal(integrity.schemaVersion, "CANONICAL_POPULATION_INTEGRITY_V1");
  assert.equal(integrity.status, "FAIL", "duplicate or missing identity evidence cannot report PASS");
  assert.equal(integrity.authoritySafeToBatch, false);
  assert.equal(integrity.blockCode, "DUPLICATE_APPLICANT_ID");
  assert.match(integrity.blockReason, /duplicate/i);
  assert.equal(integrity.populationCount, 3);
  assert.equal(integrity.scannedRowCount, 4);
  assert.equal(integrity.distinctApplicantIdCount, 2);
  assert.deepEqual(plain(integrity.duplicateApplicantIds), ["FODE-26-DUP"]);
  assert.deepEqual(plain(integrity.duplicateRowReferences), [{
    applicantId: "FODE-26-DUP",
    rowNumbers: [2, 3]
  }]);
  assert.deepEqual(plain(integrity.missingOrInvalidApplicantIds), [{
    rowNumber: 4,
    reasonCode: "MISSING_APPLICANT_ID"
  }]);
  assert.ok(
    Array.isArray(integrity.reconciliationFindings)
      && integrity.reconciliationFindings.some((finding) => finding.code === "DUPLICATE_APPLICANT_ID"),
    "Reconciliation findings must identify the duplicate"
  );
  assert.equal(typeof integrity.evidenceTruncated, "boolean");
  assert.match(String(integrity.integrityFingerprint || ""), /\S/);
}

test("canonical population exposes bounded duplicate and missing-ID evidence", () => {
  const context = createCanonicalContext();
  const snapshot = context.buildCanonicalPopulationFromValues_(
    duplicateValues,
    "FODE_Data",
    { workingViewLimit: 25, nowMs: 1 }
  );
  assertDuplicateIntegrity(snapshot.populationIntegrity);
  assert.notEqual(snapshot.reconciliation.status, "PASS");
});

test("Actionability or Population Ledger WARN alone does not fail identity integrity", () => {
  const values = [
    ["ApplicantID", "First_Name", "Last_Name", "Parent_Email", "Lifecycle_Stage"],
    ["FODE-26-ONE", "First", "Applicant", "one@example.test", "REMINDER_DUE"],
    ["FODE-26-TWO", "Second", "Applicant", "two@example.test", "PAYMENT_REQUIRED"]
  ];
  const context = createCanonicalContext({
    values,
    ledgerIntegrityStatus: "WARN",
    ledgerIntegrityMessages: ["Actionability compatibility projection requires review."]
  });
  const snapshot = context.buildCanonicalPopulationFromValues_(
    values,
    "FODE_Data",
    { workingViewLimit: 25, nowMs: 1 }
  );
  assert.equal(snapshot.populationLedger.integrityStatus, "WARN");
  assert.equal(snapshot.reconciliation.status, "PASS");
  assert.equal(snapshot.populationIntegrity.status, "PASS");
  assert.equal(snapshot.populationIntegrity.authoritySafeToBatch, true);
  assert.equal(snapshot.populationIntegrity.blockCode, "");
});

test("canonical gate rejects malformed or internally inconsistent PASS evidence", () => {
  const context = createCanonicalContext({
    values: [
      ["ApplicantID", "First_Name", "Last_Name", "Parent_Email", "Lifecycle_Stage"],
      ["FODE-26-ONE", "First", "Applicant", "one@example.test", "REMINDER_DUE"]
    ]
  });
  const safe = plain(context.buildCanonicalPopulationFromValues_(
    [
      ["ApplicantID", "First_Name", "Last_Name", "Parent_Email", "Lifecycle_Stage"],
      ["FODE-26-ONE", "First", "Applicant", "one@example.test", "REMINDER_DUE"]
    ],
    "FODE_Data",
    { workingViewLimit: 25, nowMs: 1 }
  ).populationIntegrity);
  assert.equal(context.canonicalPopulationIntegrityGate_(safe).ok, true);

  const incomplete = plain(safe);
  delete incomplete.duplicateApplicantIdCount;
  const incompleteGate = context.canonicalPopulationIntegrityGate_(incomplete);
  assert.equal(incompleteGate.ok, false);
  assert.equal(incompleteGate.blockCode, "POPULATION_INTEGRITY_UNPROVEN");
  assert.ok(plain(incompleteGate.contractIssues).includes("MISSING_DUPLICATEAPPLICANTIDCOUNT"));

  const inconsistent = Object.assign({}, plain(safe), {
    duplicateApplicantIdCount: 1,
    duplicateApplicantIds: ["FODE-26-ONE"],
    duplicateRowReferences: [{ applicantId: "FODE-26-ONE", rowNumbers: [2, 3] }]
  });
  const inconsistentGate = context.canonicalPopulationIntegrityGate_(inconsistent);
  assert.equal(inconsistentGate.ok, false);
  assert.equal(inconsistentGate.blockCode, "POPULATION_INTEGRITY_UNPROVEN");
  assert.ok(plain(inconsistentGate.contractIssues).includes("PASS_DUPLICATE_COUNT_NONZERO"));
});

test("ambiguous exact applicant lookup returns no applicant target", () => {
  const context = createCanonicalContext();
  const result = context.admin_getCanonicalApplicant({ applicantId: "FODE-26-DUP" });
  assert.equal(result.ok, false);
  assert.equal(result.code, "DUPLICATE_APPLICANT_ID");
  assert.equal(result.applicant, null, "ambiguous identity must never expose an arbitrary first/last row");
});

test("individual communication preview and send reject duplicate identity before row read or effects", () => {
  const spies = { rowRead: 0, send: 0, patch: 0, log: 0 };
  const sheet = {
    getLastRow: () => 3,
    getRange(row) {
      assert.equal(row, 2);
      return {
        getValues: () => [["FODE-26-DUP"], ["FODE-26-DUP"]]
      };
    }
  };
  const context = Object.assign(baseVmContext(), {
    SCHEMA: { APPLICANT_ID: "ApplicantID" },
    CONFIG: { ENABLE_PRODUCTION_EMAIL_SENDS: true },
    CANONICAL_POPULATION_INTEGRITY_EVIDENCE_LIMIT: 25,
    getHeaderIndexMap_: () => ({ ApplicantID: 1 }),
    normalizeApplicantMessageType_: (value) => String(value || "").trim(),
    communicationGetActorInfo_: () => ({
      email: "admin@example.test",
      role: "SUPER",
      isAdmin: true,
      isSuper: true
    }),
    newDebugId_: () => "DUPLICATE-IDENTITY-TEST",
    communicationCapabilityBlock_: () => null,
    communicationBlockReason_: (code) => String(code || ""),
    getWorkingSpreadsheet_: () => ({}),
    mustGetDataSheet_: () => sheet,
    getRowObject_: () => {
      spies.rowRead += 1;
      return {};
    },
    resolveApplicantMessageContextFromRow_: () => {
      spies.rowRead += 1;
      return { eligible: true };
    },
    isManualSingleSendProbeEnabled_: () => false,
    isSystemStabilizationModeActive_: () => false,
    hasPriorSuccessfulMessageSend_: () => false,
    getCallerEmail_: () => "admin@example.test",
    writeApplicantContactTracking_: () => {
      spies.patch += 1;
      return true;
    },
    campaignLog_: () => {
      spies.log += 1;
    },
    dispatchApplicantMessage_: () => {
      spies.send += 1;
      return { result: "SENT" };
    },
    logOperationalBlock_: () => {}
  });
  loadFunctions(context, "Code.js", [
    "findApplicantRowNumbersByApplicantId_",
    "resolveApplicantMessageContext_",
    "recordApplicantContactOutcome_",
    "previewApplicantMessage_",
    "sendApplicantMessage_"
  ]);

  const preview = context.previewApplicantMessage_("FODE-26-DUP", "docs_missing", {
    actorEmail: "admin@example.test",
    actorRole: "SUPER"
  });
  const send = context.sendApplicantMessage_("FODE-26-DUP", "docs_missing", {
    actorEmail: "admin@example.test",
    actorRole: "SUPER"
  });
  assert.equal(preview.result, "BLOCKED");
  assert.equal(preview.blockCode, "DUPLICATE_APPLICANT_ID");
  assert.equal(send.result, "BLOCKED");
  assert.equal(send.blockCode, "DUPLICATE_APPLICANT_ID");
  assert.equal(spies.rowRead, 0, "ambiguous identity must not hydrate an arbitrary row");
  assert.equal(spies.send, 0);
  assert.equal(spies.patch, 0);
});

function createCache() {
  const values = new Map();
  return {
    get(key) {
      return values.has(key) ? values.get(key) : null;
    },
    put(key, value) {
      values.set(key, value);
    },
    getAll(keys) {
      return Object.fromEntries(
        keys.filter((key) => values.has(key)).map((key) => [key, values.get(key)])
      );
    },
    putAll(entries) {
      Object.entries(entries).forEach(([key, value]) => values.set(key, value));
    }
  };
}

test("adapter cache MISS and HIT preserve identical integrity authority", () => {
  const cache = createCache();
  const integrity = {
    schemaVersion: "CANONICAL_POPULATION_INTEGRITY_V1",
    status: "FAIL",
    authoritySafeToBatch: false,
    blockCode: "DUPLICATE_APPLICANT_ID",
    blockReason: "Duplicate ApplicantID FODE-26-DUP occurs on rows 2 and 3.",
    populationCount: 3,
    scannedRowCount: 4,
    distinctApplicantIdCount: 2,
    duplicateApplicantIds: ["FODE-26-DUP"],
    duplicateRowReferences: [{ applicantId: "FODE-26-DUP", rowNumbers: [2, 3] }],
    missingOrInvalidApplicantIds: [{ rowNumber: 4, reasonCode: "MISSING_APPLICANT_ID" }],
    reconciliationFindings: [{ code: "DUPLICATE_APPLICANT_ID", rowNumbers: [2, 3] }],
    evidenceTruncated: false,
    integrityFingerprint: "INTEGRITY-DUPLICATE-2-3"
  };
  const context = {
    console,
    Date,
    Number,
    Math,
    Object,
    Array,
    String,
    Error,
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
    clean_: (value) => String(value == null ? "" : value).trim()
  };
  vm.createContext(context);
  vm.runInContext(read("EduOps_Contracts.js"), context, { filename: "EduOps_Contracts.js" });
  vm.runInContext(read("EduOps_FODE_Adapter.js"), context, { filename: "EduOps_FODE_Adapter.js" });
  context.eduopsFodeSourceVersion_ = () => ({
    key: "FODE|sheet|FODE_Data|5|5|1",
    product: "FODE",
    spreadsheetId: "sheet",
    sheetName: "FODE_Data",
    lastRow: 5,
    lastColumn: 5,
    updatedMs: 1,
    cacheable: true,
    durationMs: 0
  });
  context.eduopsFodeCanonicalSnapshot_ = () => ({
    schemaVersion: "CANONICAL_POPULATION_V1",
    generatedAt: "2026-07-29T00:00:00.000Z",
    sourceSheetName: "FODE_Data",
    totalRows: 3,
    rows: [{
      identity: { applicantId: "FODE-26-DUP", rowNumber: 2 },
      applicant: { name: "First Identity", effectiveEmail: "first-row@example.test" },
      lifecycle: { baseState: "INCOMPLETE_DOCUMENTS", overlays: [] },
      actionability: { state: "READY", selectable: true },
      finance: { financeAuthority: { financeState: "NOT_YET_PAYMENT_APPLICABLE" } },
      documents: { state: "UNKNOWN" },
      contactability: { state: "EMAIL_AVAILABLE" }
    }],
    populationIntegrity: integrity
  });
  context.eduopsFodeCacheableRows_ = () => [{
    rowNumber: 2,
    applicantId: "FODE-26-DUP",
    name: "First Identity",
    actionabilityState: "READY",
    selectable: true
  }];

  const miss = context.eduopsResolveFodeSnapshot_({ email: "admin@example.test", role: "ADMIN" });
  const hit = context.eduopsResolveFodeSnapshot_({ email: "admin@example.test", role: "ADMIN" });
  assert.equal(miss.cacheState, "MISS_REHYDRATED");
  assert.equal(hit.cacheState, "HIT");
  assert.deepEqual(plain(miss.populationIntegrity), integrity);
  assert.deepEqual(plain(hit.populationIntegrity), integrity);
  assert.deepEqual(
    plain(hit.populationIntegrity),
    plain(miss.populationIntegrity),
    "cache rehydration must not manufacture or discard integrity evidence"
  );
});

test("workload reconciliation propagates integrity instead of reconstructing PASS", () => {
  const context = {
    console,
    Date,
    Number,
    Math,
    Object,
    Array,
    String,
    Error,
    eduopsClone_: (value) => plain(value)
  };
  vm.createContext(context);
  vm.runInContext(read("EduOps_Workload.js"), context, { filename: "EduOps_Workload.js" });
  context.eduopsHiddenReasonCode_ = () => "OUTSIDE_QUERY";
  context.eduopsHiddenReasonText_ = () => "Outside query.";
  context.eduopsMetricCounts_ = () => ({});
  context.eduopsOldestAge_ = () => "";
  context.eduopsClean_ = (value) => String(value == null ? "" : value).trim();
  context.eduopsWorkloadQueryFingerprint_ = () => "QUERY";
  context.eduopsWorkloadQueryBinding_ = () => ({ schemaVersion: "EDUOPS_QUERY_BINDING_V1" });
  context.eduopsHiddenReasonGroups_ = () => [];
  context.eduopsHiddenReasonPage_ = () => ({ rows: [] });
  const populationIntegrity = {
    schemaVersion: "CANONICAL_POPULATION_INTEGRITY_V1",
    status: "FAIL",
    authoritySafeToBatch: false,
    blockCode: "DUPLICATE_APPLICANT_ID",
    populationCount: 3,
    distinctApplicantIdCount: 2,
    duplicateApplicantIds: ["FODE-26-DUP"],
    duplicateRowReferences: [{ applicantId: "FODE-26-DUP", rowNumbers: [2, 3] }]
  };
  const result = context.eduopsReconciliationForRows_(
    [],
    [],
    [],
    { page: 1, pageSize: 25 },
    "SNAP-DUPLICATE",
    {
      totalRows: 3,
      generatedAt: "2026-07-29T00:00:00.000Z",
      populationIntegrity
    }
  );
  assert.equal(result.integrityState, "FAIL");
  assert.deepEqual(plain(result.populationIntegrity), populationIntegrity);
});

test("operational workload availability fails Batch closed from canonical integrity", () => {
  const context = {
    clean_: (value) => String(value == null ? "" : value).trim(),
    eduopsClean_: (value) => String(value == null ? "" : value).trim(),
    eduopsUpper_: (value) => String(value == null ? "" : value).trim().toUpperCase(),
    eduopsOperationAvailability_: () => ({
      BATCH_COMMUNICATION: {
        available: true,
        reasonCode: "AVAILABLE",
        reason: "Feature is released.",
        authoritySource: "eduopsFeatureFlags_"
      }
    })
  };
  installCanonicalGate(context);
  loadFunctions(context, "EduOps_Workload.js", ["eduopsWorkloadOperationAvailability_"]);

  const safe = context.eduopsWorkloadOperationAvailability_(integrityFixture("PASS", "CPI-SAFE"));
  assert.equal(safe.BATCH_COMMUNICATION.available, true);

  const duplicate = context.eduopsWorkloadOperationAvailability_(integrityFixture("DUPLICATE", "CPI-DUPLICATE"));
  assert.equal(duplicate.BATCH_COMMUNICATION.available, false);
  assert.equal(duplicate.BATCH_COMMUNICATION.reasonCode, "DUPLICATE_APPLICANT_ID");
  assert.match(duplicate.BATCH_COMMUNICATION.reason, /duplicate/i);
  assert.equal(duplicate.BATCH_COMMUNICATION.authoritySource, "Canonical Population Integrity");

  const unproven = context.eduopsWorkloadOperationAvailability_({});
  assert.equal(unproven.BATCH_COMMUNICATION.available, false);
  assert.equal(unproven.BATCH_COMMUNICATION.reasonCode, "POPULATION_INTEGRITY_UNPROVEN");

  const inconsistentPass = integrityFixture("PASS", "CPI-INCONSISTENT");
  inconsistentPass.duplicateApplicantIdCount = 1;
  inconsistentPass.duplicateApplicantIds = ["FODE-26-ONE"];
  inconsistentPass.duplicateRowReferences = [{ applicantId: "FODE-26-ONE", rowNumbers: [2, 3] }];
  const inconsistent = context.eduopsWorkloadOperationAvailability_(inconsistentPass);
  assert.equal(inconsistent.BATCH_COMMUNICATION.available, false);
  assert.equal(inconsistent.BATCH_COMMUNICATION.reasonCode, "POPULATION_INTEGRITY_UNPROVEN");
});

const integritySchema = "CANONICAL_POPULATION_INTEGRITY_V1";

function loadFunctions(context, file, names) {
  if (!vm.isContext(context)) vm.createContext(context);
  vm.runInContext(
    names.map((name) => extractFunction(read(file), name)).join("\n\n"),
    context,
    { filename: file }
  );
  return context;
}

function baseVmContext() {
  return {
    console,
    Date,
    Number,
    Math,
    Object,
    Array,
    String,
    Error,
    JSON,
    isFinite,
    clean_: (value) => String(value == null ? "" : value).trim()
  };
}

function integrityFixture(kind, fingerprint) {
  const normalized = String(kind || "PASS").toUpperCase();
  const safe = normalized === "PASS";
  const duplicate = normalized === "DUPLICATE";
  return {
    schemaVersion: integritySchema,
    status: safe ? "PASS" : duplicate ? "FAIL" : "UNPROVEN",
    authoritySafeToBatch: safe,
    blockCode: safe ? "" : duplicate ? "DUPLICATE_APPLICANT_ID" : "POPULATION_INTEGRITY_UNPROVEN",
    blockReason: safe
      ? ""
      : duplicate
        ? "Duplicate ApplicantID FODE-26-DUP occurs on rows 2 and 3."
        : "Canonical population integrity is unproven.",
    populationCount: duplicate ? 2 : safe ? 1 : 0,
    scannedRowCount: duplicate ? 2 : safe ? 1 : 0,
    distinctApplicantIdCount: duplicate ? 1 : safe ? 1 : 0,
    duplicateApplicantIdCount: duplicate ? 1 : 0,
    duplicateApplicantIds: duplicate ? ["FODE-26-DUP"] : [],
    duplicateRowReferences: duplicate
      ? [{ applicantId: "FODE-26-DUP", rowNumbers: [2, 3] }]
      : [],
    missingOrInvalidApplicantIdCount: 0,
    missingOrInvalidApplicantIds: [],
    reconciliationFindings: duplicate
      ? [{ code: "DUPLICATE_APPLICANT_ID", rowNumbers: [2, 3] }]
      : [],
    evidenceTruncated: false,
    integrityFingerprint: fingerprint || (safe ? "CPI-SAFE" : duplicate ? "CPI-DUPLICATE" : "")
  };
}

function unsafeIntegrityCases() {
  return [
    {
      label: "duplicate",
      snapshot: { populationIntegrity: integrityFixture("DUPLICATE") },
      blockCode: "DUPLICATE_APPLICANT_ID"
    },
    {
      label: "unproven",
      snapshot: {},
      blockCode: "POPULATION_INTEGRITY_UNPROVEN"
    }
  ];
}

function boundarySpies() {
  return {
    recipient: 0,
    send: 0,
    patch: 0,
    cohort: 0,
    scan: 0,
    cacheRead: 0,
    cacheWrite: 0,
    cacheClear: 0,
    lock: 0,
    unlock: 0,
    snapshot: 0
  };
}

function assertNoRecipientSendOrPatch(spies, label) {
  assert.equal(spies.recipient, 0, `${label}: recipient authority must not run`);
  assert.equal(spies.send, 0, `${label}: send boundary must not run`);
  assert.equal(spies.patch, 0, `${label}: applyPatch boundary must not run`);
}

function adminBlockedResult(action, blockCode, requestId, extra) {
  return Object.assign({
    ok: false,
    action,
    result: "BLOCKED",
    blockCode,
    reason: blockCode,
    requestId
  }, extra || {});
}

function installCanonicalGate(context) {
  context.CANONICAL_POPULATION_INTEGRITY_SCHEMA_VERSION = integritySchema;
  loadFunctions(context, "Admin_CanonicalPopulation.js", [
    "canonicalPopulationClone_",
    "canonicalPopulationIntegrityUnproven_",
    "canonicalPopulationIntegrityContractIssues_",
    "canonicalPopulationIntegrityGate_"
  ]);
  return context;
}

function createEduOpsPreviewContext(snapshot) {
  const spies = boundarySpies();
  const context = Object.assign(baseVmContext(), {
    eduopsClean_: (value) => String(value == null ? "" : value).trim(),
    eduopsUpper_: (value) => String(value == null ? "" : value).trim().toUpperCase(),
    eduopsClone_: (value) => plain(value),
    eduopsRequireAccess_: () => ({ email: "admin@example.test", role: "ADMIN" }),
    eduopsCommandDefinition_: () => ({
      operation: "BATCH_COMMUNICATION",
      batchSafe: true,
      publicLabel: "Batch communication"
    }),
    eduopsRequireFeature_: () => {},
    eduopsRequireCommandCapability_: () => {},
    eduopsResolveFodeSnapshot_: () => Object.assign({
      snapshotId: "SNAPSHOT-1",
      rows: []
    }, snapshot),
    eduopsResolveBatchSelection_: () => {
      spies.recipient += 1;
      return { executionApplicantIds: ["FODE-26-ONE"] };
    },
    eduopsAuthorityPreview_: () => {
      spies.recipient += 1;
      return { ok: true, result: "PREVIEW", eligible: 1, recipients: [] };
    },
    openDataSheet_: () => {
      spies.scan += 1;
      return {};
    },
    buildSelectedApplicantRowLookup_: () => {
      spies.recipient += 1;
      return {};
    },
    resolveApplicantMessageContextFromRow_: () => {
      spies.recipient += 1;
      return {};
    },
    sendApplicantMessage_: () => {
      spies.send += 1;
      return { result: "SENT" };
    },
    applyPatch_: () => {
      spies.patch += 1;
    },
    CacheService: {
      getUserCache: () => ({
        put: () => {
          spies.cacheWrite += 1;
        }
      })
    }
  });
  installCanonicalGate(context);
  loadFunctions(context, "EduOps_Commands.js", [
    "eduopsPopulationIntegrityGate_",
    "eduopsPopulationIntegrityBlockedPreview_",
    "eduops_getBatchCommunicationCatalogue",
    "eduops_previewCommand"
  ]);
  return { context, spies };
}

test("EduOps catalogue and preview behaviorally fail closed for duplicate and unproven integrity", () => {
  unsafeIntegrityCases().forEach((entry) => {
    const catalogueHarness = createEduOpsPreviewContext(entry.snapshot);
    const catalogue = catalogueHarness.context.eduops_getBatchCommunicationCatalogue({});
    assert.equal(catalogue.ok, false, `${entry.label}: catalogue must fail closed`);
    assert.equal(catalogue.blockCode, entry.blockCode);
    assert.equal(catalogueHarness.spies.scan, 0, `${entry.label}: catalogue must not open the recipient sheet`);
    assertNoRecipientSendOrPatch(catalogueHarness.spies, `EduOps catalogue ${entry.label}`);

    const previewHarness = createEduOpsPreviewContext(entry.snapshot);
    const preview = previewHarness.context.eduops_previewCommand({
      operation: "BATCH_COMMUNICATION",
      snapshotId: "SNAPSHOT-1",
      selection: {
        product: "FODE",
        snapshotId: "SNAPSHOT-1",
        selectedApplicantIds: ["FODE-26-ONE"]
      }
    });
    assert.equal(preview.state, "BLOCKED", `${entry.label}: preview must be blocked`);
    assert.equal(preview.executable, false);
    assert.equal(preview.blockCode, entry.blockCode);
    assert.equal(previewHarness.spies.cacheWrite, 0, `${entry.label}: blocked preview must not be cached`);
    assertNoRecipientSendOrPatch(previewHarness.spies, `EduOps preview ${entry.label}`);
  });
});

test("EduOps execute rejects an integrity change discovered inside the operation lock", () => {
  const spies = boundarySpies();
  const oldIntegrity = integrityFixture("PASS", "CPI-OLD");
  const newIntegrity = integrityFixture("PASS", "CPI-NEW");
  const preview = {
    ok: true,
    state: "READY",
    executable: true,
    expiresAt: "2099-01-01T00:00:00.000Z",
    previewId: "PREVIEW-1",
    operation: "BATCH_COMMUNICATION",
    commandType: "BATCH_COMMUNICATION",
    snapshotId: "SNAPSHOT-1",
    integrityFingerprint: oldIntegrity.integrityFingerprint,
    populationIntegrity: oldIntegrity,
    idempotencyKey: "IDEMPOTENCY-1",
    selectedApplicantIds: ["FODE-26-ONE"],
    applicantId: "",
    request: {
      operation: "BATCH_COMMUNICATION",
      snapshotId: "SNAPSHOT-1",
      selection: { selectedApplicantIds: ["FODE-26-ONE"] }
    }
  };
  let resolveCount = 0;
  let inLock = false;
  const context = Object.assign(baseVmContext(), {
    eduopsClean_: (value) => String(value == null ? "" : value).trim(),
    eduopsUpper_: (value) => String(value == null ? "" : value).trim().toUpperCase(),
    eduopsClone_: (value) => plain(value),
    eduopsRequireAccess_: () => ({ email: "admin@example.test", role: "ADMIN" }),
    eduopsCommandDefinition_: () => ({ operation: "BATCH_COMMUNICATION", batchSafe: true }),
    eduopsRequireFeature_: () => {},
    eduopsRequireCommandCapability_: () => {},
    eduopsResolveFodeSnapshot_: () => {
      resolveCount += 1;
      return {
        snapshotId: "SNAPSHOT-1",
        rows: [],
        populationIntegrity: resolveCount === 1 ? oldIntegrity : newIntegrity
      };
    },
    eduopsResolveBatchSelection_: () => {
      spies.recipient += 1;
      return { executionApplicantIds: ["FODE-26-ONE"] };
    },
    eduopsAuthorityPreview_: () => {
      spies.recipient += 1;
      return { ok: true, result: "PREVIEW", recipients: [] };
    },
    eduopsValidateEchoedCommandIdentity_: () => {},
    eduopsPreviewCacheKey_: () => "PREVIEW_CACHE",
    eduopsIdempotencyContext_: () => "IDEMPOTENCY_CONTEXT",
    eduopsReadIdempotentReceipt_: () => null,
    eduopsWithOperationLock_: (_operation, _applicantId, body) => {
      spies.lock += 1;
      inLock = true;
      try {
        return body();
      } finally {
        inLock = false;
        spies.unlock += 1;
      }
    },
    eduopsDispatchCommand_: () => {
      assert.equal(inLock, true, "dispatch would have occurred inside the operation lock");
      spies.send += 1;
      return { result: "SENT" };
    },
    eduopsCommandIdentityPayload_: () => ({}),
    eduopsBuildReceipt_: (_acceptedPreview, authorityResult) => ({
      ok: authorityResult.ok === true,
      result: authorityResult.result,
      blockCode: authorityResult.blockCode,
      blockReason: authorityResult.blockReason,
      deliveryEvidence: authorityResult.deliveryEvidence
    }),
    eduopsStoreIdempotentReceipt_: (_key, receipt) => receipt,
    CacheService: {
      getUserCache: () => ({
        get: () => JSON.stringify(preview)
      })
    },
    applyPatch_: () => {
      spies.patch += 1;
    },
    sendApplicantMessage_: () => {
      spies.send += 1;
      return { result: "SENT" };
    }
  });
  installCanonicalGate(context);
  loadFunctions(context, "EduOps_Commands.js", [
    "eduopsPopulationIntegrityGate_",
    "eduopsBlockPreviewForPopulationIntegrity_",
    "eduopsRevalidateCommandForExecution_",
    "eduops_executeCommand"
  ]);
  const receipt = context.eduops_executeCommand({
    confirmation: true,
    previewId: "PREVIEW-1",
    idempotencyKey: "IDEMPOTENCY-1"
  });
  assert.equal(resolveCount, 2, "integrity must be re-read inside the lock");
  assert.equal(spies.lock, 1);
  assert.equal(spies.unlock, 1);
  assert.equal(receipt.result, "BLOCKED");
  assert.equal(receipt.blockCode, "POPULATION_RECONCILIATION_FAILED");
  assert.equal(receipt.deliveryEvidence.gmailAttempted, false);
  assertNoRecipientSendOrPatch(spies, "EduOps locked execute fingerprint change");
});

function createSelectedPreviewContext(snapshot) {
  const spies = boundarySpies();
  const context = Object.assign(baseVmContext(), {
    withEnvelope_: (_name, body) => body("SELECTED-PREVIEW-DBG"),
    getCallerEmail_: () => "admin@example.test",
    isAdmin_: () => true,
    requireOperationsAdmin_: () => {},
    communicationResolvedMessageTypeForRequest_: (value) => value,
    normalizeApplicantMessageType_: (value) => value,
    normalizeSelectedApplicantBatchIds_: (ids, limit) => (Array.isArray(ids) ? ids : [])
      .map((id) => String(id || "").trim())
      .filter(Boolean)
      .slice(0, Number(limit || 100)),
    selectedApplicantBatchInputLimit_: () => 100,
    selectedApplicantBatchLimit_: () => 20,
    resolveAdminCommActor_: () => ({ actorEmail: "admin@example.test", actorRole: "SUPER" }),
    newDebugId_: () => "SELECTED-PREVIEW-DBG",
    canonicalPopulationIntegritySnapshot_: () => {
      spies.snapshot += 1;
      return snapshot;
    },
    clearSelectedApplicantBatchPreviewCache_: () => {
      spies.cacheClear += 1;
    },
    buildSelectedApplicantRowLookup_: () => {
      spies.recipient += 1;
      return {};
    },
    resolveApplicantMessageContextFromRow_: () => {
      spies.recipient += 1;
      return {};
    },
    sendApplicantMessage_: () => {
      spies.send += 1;
      return { result: "SENT" };
    },
    applyPatch_: () => {
      spies.patch += 1;
    }
  });
  installCanonicalGate(context);
  loadFunctions(context, "Admin_SelectedApplicantCommunications.js", [
    "selectedApplicantPopulationIntegrityGate_",
    "selectedApplicantBatchResponse_",
    "admin_previewSelectedApplicantBatch"
  ]);
  return { context, spies };
}

test("Selected Batch preview behaviorally fails closed before recipient authority", () => {
  unsafeIntegrityCases().forEach((entry) => {
    const harness = createSelectedPreviewContext(entry.snapshot);
    const result = harness.context.admin_previewSelectedApplicantBatch({
      messageType: "docs_missing",
      applicantIds: ["FODE-26-ONE"]
    });
    assert.equal(result.ok, false, `${entry.label}: selected preview must fail closed`);
    assert.equal(result.blockCode, entry.blockCode);
    assert.equal(harness.spies.snapshot, 1);
    assert.equal(harness.spies.cacheClear, 1);
    assertNoRecipientSendOrPatch(harness.spies, `Selected preview ${entry.label}`);
  });
});

function createSelectedSendContext(snapshot, cachedPreview) {
  const spies = boundarySpies();
  const context = Object.assign(baseVmContext(), {
    withEnvelope_: (_name, body) => body("SELECTED-SEND-DBG"),
    getCallerEmail_: () => "admin@example.test",
    isAdmin_: () => true,
    requireOperationsAdmin_: () => {},
    isBatchSendEnabled_: () => true,
    communicationResolvedMessageTypeForRequest_: (value) => value,
    normalizeApplicantMessageType_: (value) => value,
    isCommunicationTypeBatchSafe_: () => true,
    resolveAdminCommActor_: () => ({ actorEmail: "admin@example.test", actorRole: "SUPER" }),
    withSelectedApplicantBatchSendLock_: (_email, _dbgId, body) => {
      spies.lock += 1;
      try {
        return body();
      } finally {
        spies.unlock += 1;
      }
    },
    canonicalPopulationIntegritySnapshot_: () => {
      spies.snapshot += 1;
      return snapshot;
    },
    clearSelectedApplicantBatchPreviewCache_: () => {
      spies.cacheClear += 1;
    },
    readSelectedApplicantBatchPreviewCache_: () => {
      spies.cacheRead += 1;
      return cachedPreview;
    },
    normalizeSelectedApplicantBatchIds_: (ids) => (Array.isArray(ids) ? ids : []).slice(),
    adminCommBlockedResult_: adminBlockedResult,
    sendApplicantMessage_: () => {
      spies.send += 1;
      return { result: "SENT" };
    },
    resolveApplicantMessageContext_: () => {
      spies.recipient += 1;
      return {};
    },
    applyPatch_: () => {
      spies.patch += 1;
    }
  });
  installCanonicalGate(context);
  loadFunctions(context, "Admin_SelectedApplicantCommunications.js", [
    "selectedApplicantPopulationIntegrityGate_",
    "selectedApplicantPopulationIntegrityBlockedResult_",
    "admin_sendSelectedApplicantBatch"
  ]);
  return { context, spies };
}

test("Selected Batch send blocks unsafe integrity and cached fingerprint changes inside its lock", () => {
  const payload = {
    confirmSend: true,
    messageType: "docs_missing",
    templateId: "docs_missing",
    previewRequestId: "SELECTED-PREVIEW-1",
    candidateHash: "SELECTED-HASH-1"
  };
  unsafeIntegrityCases().forEach((entry) => {
    const harness = createSelectedSendContext(entry.snapshot, null);
    const result = harness.context.admin_sendSelectedApplicantBatch(payload);
    assert.equal(result.blockCode, entry.blockCode);
    assert.equal(harness.spies.lock, 1, `${entry.label}: integrity check must be inside the send lock`);
    assert.equal(harness.spies.unlock, 1);
    assert.equal(harness.spies.cacheRead, 0, `${entry.label}: unsafe integrity must block before preview cache use`);
    assert.equal(harness.spies.cacheClear, 1);
    assertNoRecipientSendOrPatch(harness.spies, `Selected send ${entry.label}`);
  });

  const safeCurrent = { populationIntegrity: integrityFixture("PASS", "CPI-SELECTED-NEW") };
  const cachedPreview = {
    requestId: "SELECTED-PREVIEW-1",
    candidateHash: "SELECTED-HASH-1",
    messageType: "docs_missing",
    templateId: "docs_missing",
    candidateIds: ["FODE-26-ONE"],
    integrityFingerprint: "CPI-SELECTED-OLD"
  };
  const mismatchHarness = createSelectedSendContext(safeCurrent, cachedPreview);
  const mismatch = mismatchHarness.context.admin_sendSelectedApplicantBatch(payload);
  assert.equal(mismatch.blockCode, "POPULATION_RECONCILIATION_FAILED");
  assert.match(mismatch.blockReason, /changed after preview/i);
  assert.equal(mismatchHarness.spies.lock, 1);
  assert.equal(mismatchHarness.spies.unlock, 1);
  assert.equal(mismatchHarness.spies.cacheRead, 1);
  assert.equal(mismatchHarness.spies.cacheClear, 1);
  assertNoRecipientSendOrPatch(mismatchHarness.spies, "Selected send cached fingerprint change");
});

function createStagePreviewContext(snapshot) {
  const spies = boundarySpies();
  const context = Object.assign(baseVmContext(), {
    withEnvelope_: (_name, body) => body("STAGE-PREVIEW-DBG"),
    newDebugId_: () => "STAGE-PREVIEW-DBG",
    getCallerEmail_: () => "admin@example.test",
    isAdmin_: () => true,
    requireOperationsAdmin_: () => {},
    buildScriptPropertyRegressionGuard_: () => ({ ok: true }),
    isBatchPreviewModeEnabled_: () => true,
    resolveAdminCommActor_: () => ({ actorEmail: "admin@example.test", actorRole: "SUPER" }),
    canonicalPopulationIntegritySnapshot_: () => {
      spies.snapshot += 1;
      return snapshot;
    },
    clearStageBatchPreviewCache_: () => {
      spies.cacheClear += 1;
    },
    stageBatchPreviewResponse_: (value) => value,
    stageBatchPreviewFinalizeForRpc_: (value) => value,
    stageBatchPreviewLog_: () => {},
    collectStageBatchCohort_: () => {
      spies.cohort += 1;
      spies.recipient += 1;
      return {};
    },
    resolveApplicantMessageContextFromRow_: () => {
      spies.recipient += 1;
      return {};
    },
    sendApplicantMessage_: () => {
      spies.send += 1;
      return { result: "SENT" };
    },
    applyPatch_: () => {
      spies.patch += 1;
    }
  });
  installCanonicalGate(context);
  loadFunctions(context, "Admin_StageBatchCommunications.js", [
    "stageBatchPopulationIntegrityGate_",
    "admin_previewStageBatch"
  ]);
  return { context, spies };
}

test("Stage Batch preview behaviorally fails closed before cohort or recipient resolution", () => {
  unsafeIntegrityCases().forEach((entry) => {
    const harness = createStagePreviewContext(entry.snapshot);
    const result = harness.context.admin_previewStageBatch({
      stage: "REMINDER_DUE",
      messageType: "reminder",
      limit: 10
    });
    assert.equal(result.ok, false, `${entry.label}: Stage preview must fail closed`);
    assert.equal(result.blockCode, entry.blockCode);
    assert.equal(harness.spies.snapshot, 1);
    assert.equal(harness.spies.cacheClear, 1);
    assert.equal(harness.spies.cohort, 0, `${entry.label}: Stage cohort must not be collected`);
    assertNoRecipientSendOrPatch(harness.spies, `Stage preview ${entry.label}`);
  });
});

function createStageSendContext(snapshot, cachedPreview) {
  const spies = boundarySpies();
  const lock = {
    tryLock() {
      spies.lock += 1;
      return true;
    },
    releaseLock() {
      spies.unlock += 1;
    }
  };
  const context = Object.assign(baseVmContext(), {
    withEnvelope_: (_name, body) => body("STAGE-SEND-DBG"),
    newDebugId_: () => "STAGE-SEND-DBG",
    getCallerEmail_: () => "admin@example.test",
    isAdmin_: () => true,
    requireOperationsAdmin_: () => {},
    LockService: { getUserLock: () => lock },
    isBatchSendEnabled_: () => true,
    isSystemStabilizationModeActive_: () => false,
    logOperationalBlock_: () => {},
    resolveAdminCommActor_: () => ({ actorEmail: "admin@example.test", actorRole: "SUPER" }),
    normalizeStageBatchStage_: (value) => String(value || "").trim().toUpperCase(),
    stageBatchLimitMeta_: (value) => ({ effective: Number(value || 10), warning: "" }),
    clampStageBatchOffset_: (value) => Math.max(0, Number(value || 0)),
    normalizeApplicantMessageType_: (value) => String(value || "").trim(),
    getBatchMessageTypeForStage_: () => "reminder",
    canonicalPopulationIntegritySnapshot_: () => {
      spies.snapshot += 1;
      return snapshot;
    },
    clearStageBatchPreviewCache_: () => {
      spies.cacheClear += 1;
    },
    readStageBatchPreviewCache_: () => {
      spies.cacheRead += 1;
      return cachedPreview;
    },
    stageBatchPreviewAgeSeconds_: () => 0,
    stageBatchPreviewCacheTtlSeconds_: () => 600,
    stageBatchCandidateHash_: () => "STAGE-HASH-1",
    stageBatchLogSummary_: () => {},
    adminCommBlockedResult_: adminBlockedResult,
    sendApplicantMessage_: () => {
      spies.send += 1;
      return { result: "SENT" };
    },
    resolveApplicantMessageContext_: () => {
      spies.recipient += 1;
      return {};
    },
    applyPatch_: () => {
      spies.patch += 1;
    }
  });
  installCanonicalGate(context);
  loadFunctions(context, "Admin_StageBatchCommunications.js", [
    "stageBatchPopulationIntegrityGate_",
    "stageBatchPopulationIntegrityBlockedResult_",
    "admin_sendStageBatch"
  ]);
  return { context, spies };
}

test("Stage Batch send blocks unsafe integrity and cached fingerprint changes inside its lock", () => {
  const payload = {
    confirmSend: true,
    stage: "REMINDER_DUE",
    messageType: "reminder",
    limit: 10,
    offset: 0,
    previewRequestId: "STAGE-PREVIEW-1",
    candidateHash: "STAGE-HASH-1"
  };
  unsafeIntegrityCases().forEach((entry) => {
    const harness = createStageSendContext(entry.snapshot, null);
    const result = harness.context.admin_sendStageBatch(payload);
    assert.equal(result.blockCode, entry.blockCode);
    assert.equal(harness.spies.lock, 1, `${entry.label}: Stage integrity check must be inside the lock`);
    assert.equal(harness.spies.unlock, 1);
    assert.equal(harness.spies.cacheRead, 0);
    assert.equal(harness.spies.cacheClear, 1);
    assertNoRecipientSendOrPatch(harness.spies, `Stage send ${entry.label}`);
  });

  const safeCurrent = { populationIntegrity: integrityFixture("PASS", "CPI-STAGE-NEW") };
  const cachedPreview = {
    stage: "REMINDER_DUE",
    messageType: "reminder",
    requestId: "STAGE-PREVIEW-1",
    offset: 0,
    limit: 10,
    candidateCount: 1,
    eligibleUnsentFound: 1,
    eligible: 1,
    candidateIds: ["FODE-26-ONE"],
    candidateHash: "STAGE-HASH-1",
    integrityFingerprint: "CPI-STAGE-OLD",
    writtenAt: "2026-07-29T00:00:00.000Z"
  };
  const mismatchHarness = createStageSendContext(safeCurrent, cachedPreview);
  const mismatch = mismatchHarness.context.admin_sendStageBatch(payload);
  assert.equal(mismatch.blockCode, "POPULATION_RECONCILIATION_FAILED");
  assert.match(mismatch.blockReason, /changed after preview/i);
  assert.equal(mismatchHarness.spies.lock, 1);
  assert.equal(mismatchHarness.spies.unlock, 1);
  assert.equal(mismatchHarness.spies.cacheRead, 1);
  assert.equal(mismatchHarness.spies.cacheClear, 1);
  assertNoRecipientSendOrPatch(mismatchHarness.spies, "Stage send cached fingerprint change");
});

function createCodeBatchContext(snapshot) {
  const spies = boundarySpies();
  const context = Object.assign(baseVmContext(), {
    CONFIG: {
      AUTOMATED_STAGE_DAILY_CAP: 100,
      DAILY_SEND_CAP: 100,
      CAMPAIGN_BATCH_SIZE_DEFAULT: 50
    },
    newDebugId_: () => "CODE-BATCH-DBG",
    canonicalPopulationIntegritySnapshot_: () => {
      spies.snapshot += 1;
      return snapshot;
    },
    automatedStageRunnerTimeoutLimitMs_: () => 300000,
    shouldRunAutomatedStageBatch_: () => ({
      enabled: true,
      stage: "REMINDER_DUE",
      messageType: "reminder",
      perRunBatchSize: 10
    }),
    automatedStageRunnerLog_: () => {},
    automatedStageRunnerFinalize_: (value) => value,
    getRemainingDailySendAllowance_: () => {
      spies.scan += 1;
      return { remaining: 100 };
    },
    ingestRecentBounces_: () => {
      spies.recipient += 1;
      return {};
    },
    collectStageBatchCohort_: () => {
      spies.cohort += 1;
      spies.recipient += 1;
      return {};
    },
    normalizeApplicantBatchFilterType_: (value) => String(value || "").trim(),
    communicationGetActorInfo_: () => ({ isSuper: true, email: "admin@example.test", role: "SUPER" }),
    communicationBlockReason_: (code) => code,
    campaignGetContext_: () => {
      spies.scan += 1;
      return { sheet: {}, headers: ["ApplicantID"], values: [["ApplicantID"]] };
    },
    communicationMessageTypeForFilter_: () => "legacy_invite",
    communicationMatchesFilterPrecheck_: () => true,
    campaignRowObjectFromValues_: () => ({ ApplicantID: "FODE-26-ONE" }),
    resolveApplicantMessageContext_: () => {
      spies.recipient += 1;
      return { eligible: true, applicantId: "FODE-26-ONE", rowNumber: 2 };
    },
    campaignLog_: () => {},
    campaignBatchLabel_: () => "LEGACY-BATCH-1",
    portalCommunicationMessageType_: () => "legacy_invite",
    previewApplicantMessage_: () => {
      spies.recipient += 1;
      return { eligible: true, applicantId: "FODE-26-ONE" };
    },
    sendApplicantMessage_: () => {
      spies.send += 1;
      return { result: "SENT" };
    },
    deriveCommunicationState_: () => ({ applicantId: "FODE-26-ONE", base: { emailStatus: "NEW" } }),
    getCallerEmail_: () => "admin@example.test",
    applyPatch_: () => {
      spies.patch += 1;
    }
  });
  installCanonicalGate(context);
  loadFunctions(context, "Code.js", [
    "communicationPopulationIntegrityGateForBatch_",
    "communicationPopulationIntegrityBlockedBatchResult_"
  ]);
  return { context, spies };
}

test("automated, planner and every legacy Batch path behaviorally fail closed before effects", () => {
  const paths = [
    {
      label: "automated Stage Batch",
      functions: ["runAutomatedStageBatchChunk_"],
      invoke: (context) => context.runAutomatedStageBatchChunk_({ force: true })
    },
    {
      label: "Batch planner",
      functions: ["planApplicantBatch_"],
      invoke: (context) => context.planApplicantBatch_("legacy_invite_eligible", 10, {})
    },
    {
      label: "legacy row preparation",
      functions: ["campaign_prepareLegacyRows_"],
      invoke: (context) => context.campaign_prepareLegacyRows_()
    },
    {
      label: "legacy initial Batch",
      functions: ["campaign_sendLegacyBatch_"],
      invoke: (context) => context.campaign_sendLegacyBatch_(10, { dryRun: false })
    },
    {
      label: "legacy follow-up Batch",
      functions: ["campaign_sendLegacyFollowups_"],
      invoke: (context) => context.campaign_sendLegacyFollowups_(10)
    }
  ];
  unsafeIntegrityCases().forEach((entry) => {
    paths.forEach((path) => {
      const harness = createCodeBatchContext(entry.snapshot);
      loadFunctions(harness.context, "Code.js", path.functions);
      const result = path.invoke(harness.context);
      assert.equal(result.ok, false, `${path.label} ${entry.label}: must fail closed`);
      assert.equal(result.result, "BLOCKED");
      assert.equal(result.blockCode, entry.blockCode);
      assert.equal(harness.spies.snapshot, 1);
      assert.equal(harness.spies.scan, 0, `${path.label} ${entry.label}: must not scan recipient rows`);
      assert.equal(harness.spies.cohort, 0, `${path.label} ${entry.label}: must not collect a cohort`);
      assertNoRecipientSendOrPatch(harness.spies, `${path.label} ${entry.label}`);
    });
  });
});

test("legacy Batch planner reuses the exact trusted population snapshot", () => {
  const safeSnapshot = {
    marker: "ONE-CANONICAL-SNAPSHOT",
    populationIntegrity: integrityFixture("PASS", "CPI-LEGACY-SAFE")
  };
  const harness = createCodeBatchContext(safeSnapshot);
  loadFunctions(harness.context, "Code.js", [
    "planApplicantBatch_",
    "campaign_sendLegacyBatch_"
  ]);
  const gateSources = [];
  const canonicalGate = harness.context.canonicalPopulationIntegrityGate_;
  harness.context.canonicalPopulationIntegrityGate_ = (source) => {
    gateSources.push(source);
    return canonicalGate(source);
  };
  const result = harness.context.campaign_sendLegacyBatch_(10, { dryRun: true });
  assert.equal(result.ok, true);
  assert.equal(result.selected, 0);
  assert.equal(harness.spies.snapshot, 1, "outer legacy Batch and planner must use one source scan");
  assert.equal(gateSources.length, 2, "outer send and planner must each validate integrity");
  assert.equal(gateSources[0], safeSnapshot);
  assert.equal(gateSources[1], safeSnapshot, "planner must validate the exact outer trusted snapshot");
  assert.equal(harness.spies.scan, 1, "only the candidate scan may run after integrity is proven");
  assertNoRecipientSendOrPatch(harness.spies, "legacy trusted-snapshot reuse");
});

let failures = 0;
for (const entry of tests) {
  try {
    entry.body();
    console.log(`PASS ${entry.name}`);
  } catch (error) {
    failures += 1;
    console.error(`FAIL ${entry.name}`);
    console.error(`  ${error && error.message || error}`);
  }
}

if (failures) {
  console.error(`R391B population-integrity scaffold: ${failures}/${tests.length} failing contracts`);
  process.exitCode = 1;
} else {
  console.log(`PASS R391B population-integrity fail-closed contracts (${tests.length}/${tests.length})`);
}
