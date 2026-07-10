const fs = require("node:fs");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const codeSource = fs.readFileSync("Code.js", "utf8");

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

const deriveActionability = extractFunction(codeSource, "deriveApplicantActionability_");
const getStageAndEligibility = extractFunction(codeSource, "getApplicantStageAndEligibility_");

assert.match(deriveActionability, /resolveCanonicalApplicantLifecycle_/, "Applicant actionability derivation must inspect canonical lifecycle when present");
assert.match(deriveActionability, /canonicalRecommendedMessageType[\s\S]*getRecommendedMessageType\(stage\)/, "Canonical recommended message type must override legacy stage mapping when available");

const context = {
  clean_: (value) => String(value == null ? "" : value).trim(),
  normalizeLifecycleStageKey_: (value) => String(value || "").trim().toUpperCase(),
  deriveApplicantLifecycleStage_: () => "REMINDER_DUE",
  isLifecycleAwaitingResponseStage_: (stage) => String(stage || "").trim().toUpperCase() === "REMINDER_DUE",
  communicationRecommendedMessageTypeForStage_: (stage) => String(stage || "").trim().toUpperCase() === "REMINDER_DUE" ? "reminder" : "",
  getCampaignEffectiveEmail_: () => "parent@example.test",
  isValidEffectiveEmail_: () => true,
  deriveCommunicationState_: () => ({
    base: {
      effectiveEmail: "parent@example.test",
      emailStatus: "READY",
      portalSubmittedActive: false,
      bounceFlag: false,
      bounceReason: "",
      hasValidEffectiveEmail: true
    }
  }),
  resolveCanonicalApplicantLifecycle_: () => ({
    baseState: "INCOMPLETE_DOCUMENTS",
    lifecycleStage: "INCOMPLETE_DOCUMENTS",
    overlays: ["REMINDER_DUE"],
    recommendedMessageType: "docs_missing"
  }),
  getCallerEmail_: () => "operator@example.test",
  getAdminRole_: () => "ADMIN",
  resolveApplicantMessageContext_: (applicantId, messageType) => ({
    eligible: applicantId === "FODE-26-002844" && messageType === "docs_missing"
  })
};

vm.createContext(context);
vm.runInContext([
  deriveActionability,
  getStageAndEligibility
].join("\n\n"), context);

const row = { ApplicantID: "FODE-26-002844" };
const actionability = context.deriveApplicantActionability_(row, "REMINDER_DUE", { resolveEligibility: true });
assert.equal(actionability.recommendedMessageType, "docs_missing", "Canonical recommended message type must override legacy reminder mapping in applicant actionability derivation");
assert.equal(actionability.canSendNow, true, "Applicant actionability must remain preview-eligible when the shared message resolver allows the canonical type");

const derived = context.getApplicantStageAndEligibility_(row);
assert.equal(derived.stage, "REMINDER_DUE", "Legacy stage label may remain for compatibility display");
assert.equal(derived.recommendedMessageType, "docs_missing", "Review Workspace communication-derived data must expose the canonical recommended message type");
assert.equal(derived.canSendNow, true, "Review Workspace communication-derived data must preserve final resolver eligibility");

console.log("PASS review communication recommendation is canonical-first");
