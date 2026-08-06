const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const adminUi = fs.readFileSync("AdminUI.html", "utf8");
const adminLifecycleUi = fs.readFileSync("AdminUI_OpsLifecycle.html", "utf8");
const adminQueues = fs.readFileSync("Admin_ReviewQueues.js", "utf8");
const eduopsWorkload = fs.readFileSync("EduOps_Workload.js", "utf8");
const eduopsAdapter = fs.readFileSync("EduOps_FODE_Adapter.js", "utf8");
const eduopsComponents = fs.readFileSync("EduOps_ClientComponents.html", "utf8");
const eduopsStyles = fs.readFileSync("EduOps_Styles.html", "utf8");
const renderedEvidence = fs.readFileSync("tests/r412c-visible-lifecycle-worklists.render.html", "utf8");

function extract(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (escaped) { escaped = false; continue; }
    if (quote && ch === "\\") { escaped = true; continue; }
    if (quote) { if (ch === quote) quote = ""; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth += 1;
    if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name} is not closed`);
}

const lifecycleKeys = [
  "DOCUMENTS_FOLLOW_UP", "DOCUMENTS_ASSESSMENT", "PENDING_APPLICANT_RESPONSE",
  "HELD_ABEYANCE_NO_RESPONSE", "HELD_ABEYANCE_OTHER", "WORKING_ON_IT",
  "READY_FOR_DECISION", "ADMITTED_ONBOARDING_OUTSTANDING", "LOST_UNCONTACTABLE",
  "DATA_INTEGRITY_EXCEPTION", "CLOSED_OUTCOME"
];

const fixtures = lifecycleKeys.map((key, index) => ({
  applicantId: `FODE-R412C-${index + 1}`,
  name: `Lifecycle Fixture ${index + 1}`,
  reviewBucketKey: key,
  reviewBucketLabel: key.replace(/_/g, " "),
  reviewRequirement: key === "DOCUMENTS_FOLLOW_UP" ? "Passport copy" : "Canonical requirement",
  reviewReason: `Canonical reason for ${key}`,
  reviewWaitingOn: key === "PENDING_APPLICANT_RESPONSE" ? "Applicant response" : "Admissions reviewer",
  reviewNextAction: key === "LOST_UNCONTACTABLE" ? "FIX_CONTACT_DETAILS" : "REVIEW_CANONICAL_EVIDENCE",
  reviewOwner: "OFFICER",
  reviewDate: "2026-08-12",
  reviewReactivationCondition: "Matched evidence return",
  reviewLastMeaningfulActivity: "2026-08-05T09:30:00.000Z",
  reviewFollowupCount: key === "HELD_ABEYANCE_NO_RESPONSE" ? 3 : 0,
  reviewCommunicationEvidenceAvailable: true,
  reviewSourceEvidence: "Canonical population fixture",
  contactabilityState: key === "LOST_UNCONTACTABLE" ? "UNCONTACTABLE" : "CONTACTABLE",
  selectable: key !== "LOST_UNCONTACTABLE",
  canonicalLifecycle: { lifecycleStage: key === "CLOSED_OUTCOME" ? "CLOSED" : "INCOMPLETE_DOCUMENTS" }
}));

const adminContext = {
  queueDataState: {
    reviewLifecycleCounts: Object.fromEntries(lifecycleKeys.map(key => [key, 1])),
    reviewLifecycleStageSubtotals: Object.fromEntries(lifecycleKeys.map(key => [key, { INCOMPLETE_DOCUMENTS: 1 }]))
  },
  opsAllQueueRows_: () => fixtures,
  esc: value => String(value == null ? "" : value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;")
};
vm.createContext(adminContext);
vm.runInContext([
  "opsReviewLifecycleDefinitions_", "opsReviewLifecycleBucketKey_", "opsRowsForReviewLifecycleBucket_",
  "opsReviewLifecycleCount_", "opsReviewLifecycleStageText_", "opsReviewLifecycleValue_",
  "opsReviewLifecycleRowsHtml_"
].map(name => extract(adminLifecycleUi, name)).join("\n"), adminContext);

const adminDefinitions = Array.from(adminContext.opsReviewLifecycleDefinitions_());
lifecycleKeys.forEach(key => assert.ok(adminDefinitions.some(item => item.key === key), `${key} must remain visible even at zero`));
assert.equal(adminContext.opsRowsForReviewLifecycleBucket_("PENDING_APPLICANT_RESPONSE").length, 1);
assert.equal(adminContext.opsRowsForReviewLifecycleBucket_("ALL_ACTIVE").length, fixtures.length - 1, "closed outcomes must be separated from active work");
const adminRendered = adminContext.opsReviewLifecycleRowsHtml_(fixtures);
["Lifecycle bucket / stage", "Outstanding requirement", "Waiting on / next action", "Contactability", "Owner", "Last meaningful activity", "Review / reactivation", "Qualifying successful communications", "Why this is in this queue", "Source evidence"].forEach(label => assert.match(adminRendered, new RegExp(label)));
assert.match(adminRendered, /UNCONTACTABLE · Not sendable/, "uncontactable must never look sendable");

const eduopsContext = {
  eduopsUpper_: value => String(value == null ? "" : value).trim().toUpperCase(),
  eduopsClean_: value => String(value == null ? "" : value).trim(),
  eduopsClone_: value => JSON.parse(JSON.stringify(value)),
  eduopsWorkScope_: () => "ALL_AUTHORISED",
  eduopsPrimaryRouteForRow_: () => "Admissions",
  eduopsRowAuthorityField_: (row, field) => row[field]
};
vm.createContext(eduopsContext);
vm.runInContext([
  "eduopsReviewLifecycleDefinitions_", "eduopsReviewLifecyclePresentation_", "eduopsFilterRows_"
].map(name => extract(eduopsWorkload, name)).join("\n"), eduopsContext);
const lifecyclePresentation = Array.from(eduopsContext.eduopsReviewLifecyclePresentation_(fixtures));
lifecycleKeys.forEach(key => assert.ok(lifecyclePresentation.some(item => item.code === key), `EduOps ${key} control must be conceptually available`));
const pendingRows = Array.from(eduopsContext.eduopsFilterRows_(fixtures, { actionabilityState: "ALL", worklistKey: "", reviewBucketKey: "PENDING_APPLICANT_RESPONSE", workScope: "ALL_AUTHORISED", filters: {} }));
assert.equal(pendingRows.length, 1, "EduOps lifecycle selection must filter the authoritative worklist");
const activeRows = Array.from(eduopsContext.eduopsFilterRows_(fixtures, { actionabilityState: "ALL", worklistKey: "", reviewBucketKey: "ALL_ACTIVE", workScope: "ALL_AUTHORISED", filters: {} }));
assert.equal(activeRows.length, fixtures.length - 1, "EduOps active lifecycle work must exclude closed outcomes");

const renderContext = {
  dom: { eduopsWorklistKeys: { innerHTML: "" } },
  app: {
    state: { reviewBucketKey: "PENDING_APPLICANT_RESPONSE" },
    esc: value => String(value == null ? "" : value),
    formatCode: value => String(value || "").replace(/_/g, " ")
  }
};
vm.createContext(renderContext);
vm.runInContext(extract(eduopsComponents, "renderWorklists"), renderContext);
renderContext.renderWorklists({ lifecycleWorklists: lifecyclePresentation });
assert.match(renderContext.dom.eduopsWorklistKeys.innerHTML, /data-lifecycle-worklist="PENDING_APPLICANT_RESPONSE"[^>]*aria-selected="true"/);
assert.match(renderContext.dom.eduopsWorklistKeys.innerHTML, /Closed outcomes/);

const canonicalFixture = {
  identity: { applicantId: "FODE-PARITY-1", rowNumber: 7 },
  applicant: { name: "Parity Fixture", effectiveEmail: "parity@example.test", phone: "+67570000000" },
  actionability: {
    reviewBucketKey: "DOCUMENTS_FOLLOW_UP",
    reviewBucketLabel: "Documents — review / follow-up",
    reviewReason: "Passport copy is unresolved.",
    reviewRequirement: "Passport copy",
    reviewWaitingOn: "Admissions reviewer",
    reviewSourceEvidence: "Canonical document evidence",
    reviewFollowupCount: 0,
    reviewCommunicationEvidenceAvailable: true,
    actionOwner: "OFFICER",
    state: "REVIEW_REQUIRED",
    selectable: false
  },
  lifecycle: { lifecycleStage: "INCOMPLETE_DOCUMENTS", baseState: "INCOMPLETE_DOCUMENTS" },
  finance: { financeAuthority: {} }, documents: {}, contactability: { state: "CONTACTABLE" }, diagnostics: {}
};
const adapterContext = { eduopsClean_: eduopsContext.eduopsClean_ };
vm.createContext(adapterContext);
vm.runInContext(extract(eduopsAdapter, "eduopsFodeActionabilityRowFromCanonical_"), adapterContext);
const adapted = adapterContext.eduopsFodeActionabilityRowFromCanonical_(canonicalFixture);
assert.deepEqual(
  [adapted.reviewBucketKey, adapted.reviewReason, adapted.reviewRequirement],
  [canonicalFixture.actionability.reviewBucketKey, canonicalFixture.actionability.reviewReason, canonicalFixture.actionability.reviewRequirement],
  "Admin canonical and EduOps adapter must render identical lifecycle identity"
);

assert.doesNotMatch([adminUi, adminLifecycleUi, eduopsComponents, eduopsWorkload].join("\n"), /Needs review/i, "legacy generic Needs review must not remain the primary rendered label");
assert.match(adminLifecycleUi, /Secondary compatibility stage map/);
assert.match(eduopsComponents, /Actionability remains secondary execution context/);
assert.match(adminLifecycleUi, /@media \(max-width:720px\)[\s\S]*grid-template-columns:1fr/);
assert.match(eduopsStyles, /@media \(max-width: 560px\)[\s\S]*\.eduops-worklist-keys \{ grid-template-columns: 1fr; overflow: visible; \}/);
assert.doesNotMatch(eduopsStyles, /\.eduops-worklist-key-band \{ display: none; \}/, "lifecycle controls must remain accessible in compact layouts");
assert.match(adminQueues, /reviewLifecycleCounts:[\s\S]*reviewLifecycleStageSubtotals:/, "Admin review queue response must carry global lifecycle counts and stage subtotals");
assert.match(renderedEvidence, /Non-live fixture only/);
assert.match(renderedEvidence, /Documents — review \/ follow-up/);
assert.match(renderedEvidence, /Why this is in this queue/);
assert.match(renderedEvidence, /@media \(max-width: 560px\)/);

console.log("PASS R412C visible lifecycle worklists rendered surface, parity, safety, and responsive contracts");
