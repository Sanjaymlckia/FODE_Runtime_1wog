const fs = require("node:fs");
const assert = require("node:assert/strict");
const vm = require("node:vm");

const adminJs = fs.readFileSync("Admin.js", "utf8");
const adminUi = fs.readFileSync("AdminUI.html", "utf8");

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

const resolver = extractFunction(adminJs, "resolveActionabilityState_");
const batchMessageTypeMapping = extractFunction(adminJs, "actionabilityBatchMessageTypeForRecommendation_");
const builder = extractFunction(adminJs, "buildActionabilityPreviewRow_");
const preview = extractFunction(adminJs, "admin_getActionabilityPreview");
const driftHelpers = [
  "lifecycleDriftEmptySummary_",
  "lifecycleDriftIncrement_",
  "lifecycleDriftRecordReason_",
  "lifecycleDriftRecord_"
].map((name) => extractFunction(adminJs, name)).join("\n\n");
const selectVisible = extractFunction(adminUi, "selectVisibleActionabilityRows_");
const selectAll = extractFunction(adminUi, "selectAllActionabilityRows_");
const toggle = extractFunction(adminUi, "toggleActionabilitySelection_");

assert.match(resolver, /actionabilityState: "UNKNOWN"[\s\S]*selectable: false[\s\S]*selectBlockReason:[\s\S]*coolingOffUntil:[\s\S]*recommendedAction:[\s\S]*reasonCode:/, "Resolver must return the full A1 DTO contract");
assert.match(resolver, /actionabilityState = "READY"[\s\S]*selectable = true[\s\S]*reasonCode = "READY"/, "READY rows must be selectable");
assert.match(resolver, /actionabilityState = "COOLING_OFF"[\s\S]*reasonCode = "COOLDOWN_ACTIVE"/, "Cooling-off rows must be explicit and non-selectable");
assert.match(resolver, /"AWAITING_APPLICANT"/, "Awaiting-applicant rows must be explicit");
assert.match(resolver, /"AWAITING_PAYMENT"/, "Awaiting-payment rows must be explicit");
assert.match(resolver, /actionabilityState = "REVIEW_REQUIRED"/, "Review-required rows must be explicit");
assert.match(resolver, /actionabilityState = "COMPLETE"/, "Complete rows must be explicit");
assert.match(resolver, /TEMPLATE_STAGE_MISMATCH/, "Lifecycle/template mismatch must be visible before batch preview");
assert.match(resolver, /communicationRecommendedMessageTypeForStage_/, "Resolver must consume shared lifecycle-stage message mapping instead of duplicating matrix policy");
assert.match(resolver, /canonicalRecommendedMessageType/, "Resolver must prefer canonical lifecycle recommendations when available");
assert.doesNotMatch(resolver, /Current lifecycle stage recommends/, "Operator-facing mismatch text must not expose legacy lifecycle-stage wording");
assert.doesNotMatch(resolver, /evaluateCommunicationAuthority_/, "Resolver must not duplicate or replace Communication Authority");
assert.match(builder, /resolveActionabilityState_/, "Preview row builder must consume the resolver");
assert.match(builder, /canonicalRecommendedMessageType:[\s\S]*canonicalLifecycle && canonicalLifecycle\.recommendedMessageType/, "Preview row builder must pass canonical lifecycle recommendations into actionability");
assert.match(builder, /resolveCanonicalApplicantLifecycle_/, "Preview row builder must expose canonical lifecycle diagnostics without changing behaviour");
assert.match(builder, /canonicalLifecycle:[\s\S]*baseState:[\s\S]*lifecycleStage:[\s\S]*overlays:[\s\S]*recommendedNextAction:[\s\S]*recommendedMessageType:[\s\S]*actionOwner:[\s\S]*reason:/, "Every preview row must expose the passive canonicalLifecycle DTO");
assert.match(builder, /compareLegacyCanonicalLifecycle_\(lifecycleStage, canonicalLifecycle\)/, "Preview row builder must compare legacy and canonical lifecycle passively");
assert.match(builder, /lifecycleMismatch:[\s\S]*hasLifecycleMismatch:[\s\S]*legacyLifecycle:[\s\S]*canonicalBaseState:[\s\S]*canonicalOverlays:[\s\S]*mismatchReason:/, "Every preview row must expose the passive lifecycle mismatch DTO");
assert.match(builder, /actionabilityState:[\s\S]*selectable:[\s\S]*selectBlockReason:[\s\S]*coolingOffUntil:[\s\S]*recommendedAction:[\s\S]*reasonCode:/, "Every preview row must expose A1 fields");
assert.match(preview, /workloadSummary/, "Actionability preview must return workload summary separate from ledger");
assert.match(preview, /lifecycleDriftSummary: lifecycleDriftEmptySummary_\(\)/, "Actionability preview must return passive lifecycle drift summary");
assert.match(preview, /out\.lifecycleDriftSummary = lifecycleDriftRecord_\(out\.lifecycleDriftSummary, item\.lifecycleMismatch\)/, "Lifecycle drift summary must count existing preview rows passively");
assert.match(preview, /populationLedger: populationLedgerPublicSummary_\(ledger\)/, "Population Ledger summary must remain separate from drift diagnostics");
assert.match(selectVisible, /if \(!actionabilityIsSelectable_\(row\)\) return;/, "Select Visible must select READY rows only");
assert.match(selectAll, /if \(!actionabilityIsSelectable_\(row\)\) return;/, "Select All must select READY rows only");
assert.match(toggle, /checked && !actionabilityIsSelectable_\(row\)/, "Manual checkbox selection must reject non-READY rows");

const context = {
  clean_: (value) => String(value == null ? "" : value).trim()
};
vm.createContext(context);
vm.runInContext(driftHelpers, context);

let summary = context.lifecycleDriftEmptySummary_();
summary = context.lifecycleDriftRecord_(summary, {
  hasLifecycleMismatch: true,
  legacyLifecycle: "REMINDER_DUE",
  canonicalBaseState: "INCOMPLETE_DOCUMENTS",
  mismatchReason: "Legacy lifecycle represents a timing/contact overlay while canonical lifecycle preserves applicant base state."
});
summary = context.lifecycleDriftRecord_(summary, {
  hasLifecycleMismatch: false,
  legacyLifecycle: "DOCS_REQUIRED",
  canonicalBaseState: "INCOMPLETE_DOCUMENTS",
  mismatchReason: ""
});
assert.equal(summary.totalRows, 2, "Drift summary must count all preview rows inspected");
assert.equal(summary.mismatchCount, 1, "Drift summary must count only mismatched rows");
assert.equal(summary.mismatchByLegacyStage.REMINDER_DUE, 1, "REMINDER_DUE mismatch must be counted by legacy stage");
assert.equal(summary.mismatchByCanonicalBaseState.INCOMPLETE_DOCUMENTS, 1, "INCOMPLETE_DOCUMENTS mismatch must be counted by canonical base state");
assert.equal(summary.mismatchByLegacyStage.DOCS_REQUIRED, undefined, "Equivalent DOCS_REQUIRED mapping must not be counted as mismatch");
assert.equal(Array.from(summary.topMismatchReasons)[0].count, 1, "Top mismatch reasons must retain counts");

const resolverContext = {
  clean_: (value) => String(value == null ? "" : value).trim(),
  communicationRecommendedMessageTypeForStage_: (stage) => {
    const normalized = String(stage || "").trim().toUpperCase();
    if (normalized === "REMINDER_DUE") return "reminder";
    if (normalized === "DOCS_REQUIRED") return "docs_missing";
    return "";
  }
};
vm.createContext(resolverContext);
vm.runInContext(`${batchMessageTypeMapping}\n${resolver}`, resolverContext);

const canonicalDocsMissing = resolverContext.resolveActionabilityState_({
  owner: "APPLICANT",
  nextAction: "UPLOAD_REQUIRED_DOCUMENTS",
  suppressor: "",
  lifecycleStage: "REMINDER_DUE",
  recommendedMessageType: "document_completion_reminder",
  canonicalRecommendedMessageType: "docs_missing"
});
assert.equal(canonicalDocsMissing.actionabilityState, "READY", "Canonical INCOMPLETE_DOCUMENTS/docs_missing recommendation must override legacy REMINDER_DUE overlay mismatch");
assert.equal(canonicalDocsMissing.selectable, true, "Canonical docs-missing rows must be selectable when no suppressor is active");
assert.equal(canonicalDocsMissing.recommendedAction, "docs_missing", "Canonical docs-missing rows must recommend docs_missing");

const coolingOffDocsMissing = resolverContext.resolveActionabilityState_({
  owner: "APPLICANT",
  nextAction: "UPLOAD_REQUIRED_DOCUMENTS",
  suppressor: "COOLDOWN_ACTIVE",
  lifecycleStage: "REMINDER_DUE",
  recommendedMessageType: "document_completion_reminder",
  canonicalRecommendedMessageType: "docs_missing",
  coolingOffUntil: "2026-07-15T00:00:00.000Z"
});
assert.equal(coolingOffDocsMissing.actionabilityState, "COOLING_OFF", "Cooling-off remains authoritative over canonical readiness");
assert.equal(coolingOffDocsMissing.selectable, false, "Cooling-off rows must never be auto-selected");

const contactBlockedDocsMissing = resolverContext.resolveActionabilityState_({
  owner: "APPLICANT",
  nextAction: "UPLOAD_REQUIRED_DOCUMENTS",
  suppressor: "NO_EFFECTIVE_EMAIL",
  lifecycleStage: "REMINDER_DUE",
  recommendedMessageType: "document_completion_reminder",
  canonicalRecommendedMessageType: "docs_missing"
});
assert.equal(contactBlockedDocsMissing.actionabilityState, "REVIEW_REQUIRED", "Contactability Gate remains authoritative over canonical readiness");
assert.equal(contactBlockedDocsMissing.selectable, false, "Contact-blocked rows must never be auto-selected");

const legacyMismatch = resolverContext.resolveActionabilityState_({
  owner: "APPLICANT",
  nextAction: "UPLOAD_REQUIRED_DOCUMENTS",
  suppressor: "",
  lifecycleStage: "REMINDER_DUE",
  recommendedMessageType: "document_completion_reminder"
});
assert.equal(legacyMismatch.reasonCode, "TEMPLATE_STAGE_MISMATCH", "Legacy stage mismatch fallback remains visible when canonical recommendation is absent");
assert.equal(legacyMismatch.selectable, false, "Legacy mismatch fallback remains non-selectable");
assert.match(legacyMismatch.selectBlockReason, /Current applicant state is not ready/, "Mismatch fallback must use operator-readable state wording");

console.log("PASS Actionability A1 resolver contract");
