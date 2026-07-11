const fs = require("node:fs");
const assert = require("node:assert/strict");

const adminSource = [
  fs.readFileSync("Admin.js", "utf8"),
  fs.readFileSync("Admin_StageBatchCommunications.js", "utf8"),
  fs.readFileSync("Admin_SelectedApplicantCommunications.js", "utf8"),
  fs.readFileSync("Admin_AccessControl.js", "utf8"),
  fs.readFileSync("Admin_PaymentAuthority.js", "utf8"),
  fs.readFileSync("Admin_ReviewStatusAuthority.js", "utf8")
].join("\n");
const codeSource = fs.readFileSync("Code.js", "utf8");
const adminUiSource = fs.readFileSync("AdminUI.html", "utf8");

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

const surfaces = [
  {
    name: "document status save",
    source: adminSource,
    functionName: "admin_updateDocStatuses_impl_",
    mutationType: "document status / document rollup",
    protectedSurface: "Document verification",
    allow: [/requireDocumentVerifier_\(adminEmail\)/],
    deny: [/return err_\("ACCESS_DENIED", "Access denied: document verifier required"/],
    blockedWrites: [/PAYMENT_STATUS_ROLE_BLOCK/, /PAYMENT_AUTHORITY_REQUIRED/]
  },
  {
    name: "payment verification",
    source: adminSource,
    functionName: "admin_setPaymentVerified_impl_",
    mutationType: "canonical payment verification",
    protectedSurface: "Payment authority",
    allow: [/isAdmin_\(adminEmail\)/, /requireSuperAdmin_\(adminEmail\)/],
    deny: [/ACCESS_DENIED/, /SUPER admin required/],
    blockedWrites: [/setCell_\(sh, rowNumber, idx, "Receipt_Status", "Verified"\)/, /PAYMENT_BEFORE_DOCS_REQUIRES_OVERRIDE/]
  },
  {
    name: "Zoho draft invoice",
    source: adminSource,
    functionName: "admin_createZohoBooksFodeDraftInvoice",
    mutationType: "Zoho Books draft + writeback patch",
    protectedSurface: "Zoho Books",
    allow: [/isAdmin_\(adminEmail\)/, /canWriteZohoBooksForAdmin_\(adminEmail\)/, /assertZohoBooksEnabledForWrite_\(\)/],
    deny: [/ACCESS_DENIED/, /WRITE_DISABLED/],
    blockedWrites: [/applyZohoBooksWritebackPatch_/]
  },
  {
    name: "selected applicant send",
    source: adminSource,
    functionName: "admin_sendApplicantMessage",
    mutationType: "single applicant email send",
    protectedSurface: "Communications",
    allow: [/isAdmin_\(adminEmail\)/, /requireOperationsAdmin_\(adminEmail\)/],
    deny: [/BULK_NOT_ALLOWED/, /normalizeApplicantMessageType_/],
    blockedWrites: [/sendApplicantMessage_/]
  },
  {
    name: "Stage Batch send",
    source: adminSource,
    functionName: "admin_sendStageBatch",
    mutationType: "batch email send",
    protectedSurface: "Stage Batch communications",
    allow: [/isAdmin_\(adminEmail\)/, /requireOperationsAdmin_\(adminEmail\)/],
    deny: [/isBatchSendEnabled_\(\) !== true/, /BATCH_SENDS_DISABLED_PREVIEW_ONLY_MODE/],
    blockedWrites: [/sendApplicantMessage_/]
  },
  {
    name: "selected cohort batch send",
    source: adminSource,
    functionName: "admin_sendSelectedApplicantBatch",
    mutationType: "selected cohort batch email send",
    protectedSurface: "Selected cohort communications",
    allow: [/isAdmin_\(adminEmail\)/, /requireOperationsAdmin_\(adminEmail\)/],
    deny: [/isBatchSendEnabled_\(\) !== true/, /BATCH_SENDS_DISABLED_PREVIEW_ONLY_MODE/, /readSelectedApplicantBatchPreviewCache_\(adminEmail\)/],
    blockedWrites: [/sendApplicantMessage_/]
  },
  {
    name: "portal reset",
    source: adminSource,
    functionName: "admin_resetPortalLink",
    mutationType: "portal secret reset",
    protectedSurface: "Portal security",
    allow: [/isAdmin_\(adminEmail\)/, /requireSuperAdmin_\(adminEmail\)/],
    deny: [/ACCESS_DENIED/, /SUPER admin required/],
    blockedWrites: [/setPortalSecretForApplicant_/]
  },
  {
    name: "portal access lock",
    source: adminSource,
    functionName: "admin_setPortalAccess",
    mutationType: "portal access status",
    protectedSurface: "Portal security",
    allow: [/isAdmin_\(adminEmail\)/, /requireSuperAdmin_\(adminEmail\)/],
    deny: [/Cannot unlock after payment verification/],
    blockedWrites: [/setCell_\(sh, rowNumber, idx, "Portal_Access_Status", status\)/]
  },
  {
    name: "classroom notify",
    source: adminSource,
    functionName: "admin_notifyOpsClassroomAdmin",
    mutationType: "internal classroom notification",
    protectedSurface: "Classroom handover",
    allow: [/isAdmin_\(adminEmail\)/, /requireSuperAdmin_\(adminEmail\)/],
    deny: [/CONFIRM_REQUIRED/, /runOpsSafeModeGate_/],
    blockedWrites: [/adminSendEmail_\(ctx\.recipients\.join\(","\), ctx\.subject, ctx\.body/]
  },
  {
    name: "ephemeral communication property cleanup",
    source: adminSource,
    functionName: "admin_cleanupEphemeralCommunicationProperties",
    mutationType: "Script Properties cleanup",
    protectedSurface: "Runtime properties",
    allow: [/isAdmin_\(adminEmail\)/, /requireSuperAdmin_\(adminEmail\)/],
    deny: [/Access denied/],
    blockedWrites: [/cleanupEphemeralCommunicationProperties_/]
  }
];

for (const surface of surfaces) {
  const body = extractFunction(surface.source, surface.functionName);
  for (const pattern of surface.allow) {
    assert.match(body, pattern, `${surface.name}: missing allowed-role gate ${pattern}`);
  }
  for (const pattern of surface.deny) {
    assert.match(body, pattern, `${surface.name}: missing denied-role/block gate ${pattern}`);
  }
  for (const pattern of surface.blockedWrites) {
    assert.match(body, pattern, `${surface.name}: missing protected mutation path ${pattern}`);
  }
}

const selectedSendCore = extractFunction(codeSource, "sendApplicantMessage_");
const dispatchApplicant = extractFunction(codeSource, "dispatchApplicantMessage_");
const buildActionabilityPreviewRow = extractFunction(adminSource, "buildActionabilityPreviewRow_");
const workloadGroupKey = extractFunction(adminSource, "actionabilityWorkloadGroupKey_");
const worklistProjection = extractFunction(adminSource, "actionabilityWorklistProjection_");
const actionabilityIsSelectable = extractFunction(adminUiSource, "actionabilityIsSelectable_");
const actionabilityIsEmailActionable = extractFunction(adminUiSource, "actionabilityIsEmailActionable_");
const getAdminRole = extractFunction(adminSource, "getAdminRole_");
const isAdmin = extractFunction(adminSource, "isAdmin_");
const requireSuperAdmin = extractFunction(adminSource, "requireSuperAdmin_");
const requireOperationsAdmin = extractFunction(adminSource, "requireOperationsAdmin_");
assert.match(selectedSendCore, /CONFIG\.ENABLE_PRODUCTION_EMAIL_SENDS !== true/, "Selected send core must retain production-send disable gate");
assert.match(selectedSendCore, /communicationRequiresResolvedActionPlaceholders_/, "Selected send core must retain placeholder policy");
assert.match(dispatchApplicant, /computeEmailIdempotencyKey_/, "Selected send dispatch must retain idempotency key");
assert.match(dispatchApplicant, /wasEmailAlreadyProcessed_/, "Selected send dispatch must block replay");

assert.doesNotMatch(getAdminRole + "\n" + isAdmin + "\n" + requireSuperAdmin + "\n" + requireOperationsAdmin, /FINANCE|PAYMENT_FOLLOW_UP|PAYMENT_REVIEW/, "Access-control helpers must not treat Finance workload labels as permission roles or gates");
assert.match(buildActionabilityPreviewRow, /actionOwner:\s*owner[\s\S]*workloadGroupKey:[\s\S]*worklistKey:[\s\S]*worklistLabel:[\s\S]*worklistReason:/, "Workload group/worklist projections must remain additive to the unchanged actionOwner");
assert.doesNotMatch(workloadGroupKey, /isAdmin_|requireOperationsAdmin_|requireSuperAdmin_|getAdminRole_/, "Broad workload grouping must not inspect admin role or permissions");
assert.doesNotMatch(worklistProjection, /isAdmin_|requireOperationsAdmin_|requireSuperAdmin_|getAdminRole_/, "Immediate worklist projection must not inspect admin role or permissions");
assert.doesNotMatch(actionabilityIsSelectable, /FINANCE|PAYMENT_FOLLOW_UP|PAYMENT_REVIEW/, "Selectable-state authority must not depend on finance workload classification");
assert.doesNotMatch(actionabilityIsEmailActionable, /FINANCE|PAYMENT_FOLLOW_UP|PAYMENT_REVIEW/, "Email/batch eligibility must remain driven by shared selectable/message-type authority, not finance workload labels");
assert.match(adminUiSource, /Review Workspace remains the editing authority\./, "Operations Workspace must continue to declare Review Workspace as the mutation surface");
assert.match(adminUiSource, /Review opens authoritative editing\./, "Current Worklist must continue to route editing through Review Workspace");
assert.match(adminUiSource, /if \(!actionabilityIsSelectable_\(row\)\) return;/, "Authorised operators must continue to be blocked only by server-derived selectable state, not workload grouping");

console.log("PASS mutation-capable Admin RPC role gates remain explicit");
console.log("PASS send authority retains production, placeholder, and idempotency gates");
console.log("PASS Finance workload grouping remains classification-only and does not create departmental authority");
