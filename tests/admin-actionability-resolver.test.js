const fs = require("node:fs");
const assert = require("node:assert/strict");

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
const builder = extractFunction(adminJs, "buildActionabilityPreviewRow_");
const preview = extractFunction(adminJs, "admin_getActionabilityPreview");
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
assert.doesNotMatch(resolver, /evaluateCommunicationAuthority_/, "Resolver must not duplicate or replace Communication Authority");
assert.match(builder, /resolveActionabilityState_/, "Preview row builder must consume the resolver");
assert.match(builder, /actionabilityState:[\s\S]*selectable:[\s\S]*selectBlockReason:[\s\S]*coolingOffUntil:[\s\S]*recommendedAction:[\s\S]*reasonCode:/, "Every preview row must expose A1 fields");
assert.match(preview, /workloadSummary/, "Actionability preview must return workload summary separate from ledger");
assert.match(selectVisible, /if \(!actionabilityIsSelectable_\(row\)\) return;/, "Select Visible must select READY rows only");
assert.match(selectAll, /if \(!actionabilityIsSelectable_\(row\)\) return;/, "Select All must select READY rows only");
assert.match(toggle, /checked && !actionabilityIsSelectable_\(row\)/, "Manual checkbox selection must reject non-READY rows");

console.log("PASS Actionability A1 resolver contract");
