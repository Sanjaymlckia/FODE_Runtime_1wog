const fs = require("node:fs");
const assert = require("node:assert/strict");
const vm = require("node:vm");
const crypto = require("node:crypto");

const context = {
  console,
  CONFIG: {},
  clean_(value) {
    return String(value == null ? "" : value).trim();
  },
  Utilities: {
    DigestAlgorithm: { SHA_256: "sha256" },
    Charset: { UTF_8: "utf8" },
    computeDigest(_algorithm, source) {
      return Array.from(crypto.createHash("sha256").update(String(source)).digest());
    },
    base64EncodeWebSafe(bytes) {
      return Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
    }
  }
};
vm.createContext(context);
vm.runInContext(fs.readFileSync("EduOps_Contracts.js", "utf8"), context, { filename: "EduOps_Contracts.js" });
vm.runInContext(fs.readFileSync("EduOps_Workload.js", "utf8"), context, { filename: "EduOps_Workload.js" });

function snapshot(overrides = {}) {
  return {
    schemaVersion: "CANONICAL_POPULATION_V1",
    generatedAt: overrides.generatedAt || "2026-07-15T00:00:00.000Z",
    sourceSheetName: "FODE_Data",
    totalRows: 3,
    rows: [
      row("FODE-26-002985", 2985, "REVIEW_REQUIRED", "DOCUMENT_REVIEW", "PAYMENT_TO_VERIFY"),
      row("FODE-26-002959", 2959, "COOLING_OFF", "PAYMENT_FOLLOW_UP", "PAYMENT_PENDING"),
      row("FODE-26-TEST-004", 9004, "REVIEW_REQUIRED", "ENROLMENT_COMPLETION", "PAID_VERIFIED", overrides.testNextAction || "ENROLL")
    ]
  };
}

function row(applicantId, rowNumber, state, worklistKey, financeState, nextAction = "REVIEW_DOCUMENTS") {
  return {
    identity: { applicantId, rowNumber },
    applicant: { name: applicantId, effectiveEmail: `${applicantId}@example.test`, phone: "+675 7000 0000" },
    lifecycle: { baseState: state, overlays: [], recommendedMessageType: "" },
    actionability: {
      state,
      workloadGroupKey: state,
      worklistKey,
      nextAction,
      selectable: state === "READY",
      reasonCode: "",
      coolingOffUntil: state === "COOLING_OFF" ? "2026-07-16T00:00:00.000Z" : ""
    },
    finance: { state: financeState, financeAuthority: { financeState, paymentEvidencePresent: financeState !== "PAYMENT_PENDING", paymentVerified: financeState === "PAID_VERIFIED" } },
    documents: { state: "Verified", verified: true, requiredComplete: true },
    contactability: { state: "EMAIL_AVAILABLE" }
  };
}

const first = context.eduopsRuntimeSnapshotId_(snapshot({ generatedAt: "2026-07-15T00:00:00.000Z" }));
const second = context.eduopsRuntimeSnapshotId_(snapshot({ generatedAt: "2026-07-15T00:01:00.000Z" }));
assert.equal(first, second, "snapshot ID must not change when only generatedAt changes");

const reordered = snapshot();
reordered.rows.reverse();
assert.equal(first, context.eduopsRuntimeSnapshotId_(reordered), "snapshot ID must be independent of row array ordering");

const changed = context.eduopsRuntimeSnapshotId_(snapshot({ testNextAction: "COMPLETE_ENROLMENT" }));
assert.notEqual(first, changed, "genuine source authority changes must alter snapshot identity");

context.admin_getCanonicalApplicant = ({ applicantId }) => {
  if (applicantId === "FODE-26-002959") {
    return { ok: true, applicant: { identity: { applicantId, rowNumber: 2959 } } };
  }
  if (applicantId === "FODE-26-002985") {
    return { ok: true, applicant: { identity: { applicantId, rowNumber: 2985 } } };
  }
  return { ok: false, code: "APPLICANT_NOT_FOUND" };
};

const manifestContext = context.eduopsHydrateDocumentPayload_({ applicantId: "FODE-26-002959" }, false);
assert.equal(manifestContext.payload.applicantId, "FODE-26-002959", "manifest context must preserve exact applicantId");
assert.equal(manifestContext.payload.rowNumber, 2959, "manifest context must resolve exact applicant rowNumber");

const renditionContext = context.eduopsHydrateDocumentPayload_({
  applicantId: "FODE-26-002959",
  sourceField: "Fee_Receipt_File",
  itemIndex: 0,
  documentKey: "FODE-26-002959|2959|Fee_Receipt_File|0"
}, true);
assert.equal(renditionContext.payload.applicantId, "FODE-26-002959", "rendition context must bind exact applicant");
assert.equal(renditionContext.payload.rowNumber, 2959, "rendition context must bind exact rowNumber");
assert.equal(renditionContext.payload.sourceField, "Fee_Receipt_File", "rendition context must bind exact sourceField");
assert.equal(renditionContext.payload.itemIndex, 0, "rendition context must bind exact itemIndex");

const tampered = context.eduopsHydrateDocumentPayload_({
  applicantId: "FODE-26-002959",
  sourceField: "Fee_Receipt_File",
  itemIndex: 0,
  documentKey: "FODE-26-002985|2985|Fee_Receipt_File|0"
}, true);
assert.equal(tampered.ok, false, "another applicant document context must be rejected");
assert.equal(tampered.code, "DOCUMENT_CONTEXT_MISMATCH");

const unknown = context.eduopsHydrateDocumentPayload_({ applicantId: "FODE-26-MISSING" }, false);
assert.equal(unknown.ok, false, "unknown applicant document context must be rejected");

console.log("PASS EduOps Pass 1 stable snapshot and exact document context repair contracts");
