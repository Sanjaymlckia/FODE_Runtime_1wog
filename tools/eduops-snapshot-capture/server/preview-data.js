const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");

const CONTRACT_VERSION = "EDUOPS_SHADOW_V1";
const PROFILE_VERSION = "FODE_SHADOW_V1";
const POPULATION_INTEGRITY_SCHEMA_VERSION = "CANONICAL_POPULATION_INTEGRITY_V1";
const UNSAFE_DUPLICATE_INTEGRITY_SCENARIO = "unsafe-duplicate-integrity";
const SNAPSHOT_ID = "FODE-PREVIEW-SNAPSHOT-001";
const CHANGED_SNAPSHOT_ID = "FODE-PREVIEW-SNAPSHOT-002";
const PRODUCT_SNAPSHOT_IDS = { FODE: SNAPSHOT_ID, KIA: "KIA-PREVIEW-SNAPSHOT-001", MLC: "MLC-PREVIEW-SNAPSHOT-001" };
const SNAPSHOT_AS_OF = "2026-07-15T00:00:00.000Z";
const SNAPSHOT_FORMAT_VERSION = "EDUOPS_PREVIEW_SNAPSHOT_V1";
const SANITISATION_VERSION = "EDUOPS_PREVIEW_SANITISER_V1";
const previewStore = { previews: new Map(), receipts: new Map(), history: new Map() };
const PREVIEW_CAPABILITIES = {
  CAN_OPEN_REVIEW_WORKSPACE: true,
  CAN_SAVE_DOCUMENT_STATUSES: true,
  CAN_VERIFY_PAYMENT: true,
  CAN_PREVIEW_APPLICANT_COMMUNICATION: true,
  CAN_SEND_INDIVIDUAL_EMAIL: true,
  CAN_RUN_BATCH_COMMUNICATIONS: true,
  CAN_MANAGE_PORTAL_ACCESS: true,
  CAN_EDIT_CONTACT_DETAILS: true,
  CAN_WRITE_ZOHO_BOOKS: true
};
const PREVIEW_FLAGS = {
  DOCUMENT_REVIEW: true,
  FINANCE_EVIDENCE_DECISION: true,
  SEND_INDIVIDUAL_COMMUNICATION: true,
  CONTACTABILITY_CORRECTION: true,
  PORTAL_ACCESS: true,
  BATCH_COMMUNICATION: true,
  BOOKS_ACTION: false
};

const STATE_LABELS = {
  READY: "Ready Now",
  COOLING_OFF: "Cooling Off",
  AWAITING_APPLICANT: "Awaiting Applicant",
  AWAITING_PAYMENT: "Awaiting Payment",
  REVIEW_REQUIRED: "Review Required",
  UNCONTACTABLE: "Uncontactable",
  DORMANT: "Dormant / Re-engagement",
  BLOCKED: "Blocked",
  UNKNOWN: "Unknown",
  COMPLETE: "Complete"
};

const STATE_COUNTS = {
  READY: 60,
  COOLING_OFF: 12,
  AWAITING_APPLICANT: 22,
  AWAITING_PAYMENT: 18,
  REVIEW_REQUIRED: 75,
  BLOCKED: 8,
  UNKNOWN: 4,
  COMPLETE: 1,
  UNCONTACTABLE: 0,
  DORMANT: 0
};

const SCENARIOS = [
  ["normal-authoritative", "Normal authoritative", "Stable snapshot, representative workload, exact Workbench and document PNG available."],
  ["r410-actionability-gallery", "R410 actionability and gallery", "Deterministic actionability, cadence, contactability and five-position document gallery fixtures."],
  ["long-display-values", "Long display values", "Long applicant and recipient values exercise wrapping without changing authority state."],
  ["slow-6s", "Slow request - 6 seconds", "Workload call is delayed six seconds to inspect pending state and supersession."],
  ["timeout-10s", "Timeout - over 10 seconds", "Workload call exceeds the client timeout and exposes retry."],
  ["stale-snapshot", "Stale snapshot", "A prior expected snapshot is rejected without silent rebasing."],
  ["conflicting-authority", "Conflicting authority", "Rows are visible but no confident READY state is presented."],
  [UNSAFE_DUPLICATE_INTEGRITY_SCENARIO, "Unsafe duplicate ApplicantID integrity", "Deterministic duplicate ApplicantID evidence blocks Batch catalogue, preview and execution authority."],
  ["source-unavailable", "Source unavailable", "Workload is unavailable with no false confidence."],
  ["empty-escalated-scope", "Empty Escalated scope", "Non-zero Actionability total with zero scoped matches is explicit."],
  ["pinned-ownership-scope", "Pinned ownership scope", "Pinned Escalated scope persists across Actionability."],
  ["unpinned-ownership-scope", "Unpinned ownership scope", "Changing Actionability resets to All Authorised."],
  ["rapid-supersession", "Rapid supersession", "Fast navigation keeps only the latest useful workload response."],
  ["document-png-available", "Document PNG available", "Derived PNG rendition and separate original action are available."],
  ["document-preview-unavailable", "Document preview unavailable", "PNG fallback wording and Open Original representation remain available."],
  ["invalid-cross-applicant-document", "Invalid cross-applicant document context", "Another applicant document context is rejected."],
  ["successful-document-review", "Successful document review", "A document decision returns a versioned simulated receipt."],
  ["rejected-document", "Rejected document", "A rejected document remains applicant-specific and receipted."],
  ["correction-request", "Correction request", "A document correction request hands off to an individual reviewed communication."],
  ["dirty-document-state", "Dirty document state", "Unsaved document edits invoke the shared navigation guard."],
  ["contact-correction", "Contact correction", "An exact applicant email correction returns a simulated receipt."],
  ["communication-preview", "Communication preview", "Recipient, template, cooling-off and contactability are previewed."],
  ["communication-send-receipt", "Communication send receipt", "A simulated individual send returns a versioned receipt."],
  ["cooling-off-denial", "Cooling-off denial", "Communication preview fails closed while the applicant is cooling off."],
  ["contactability-failure", "Contactability failure", "No effective email and suppressed communication state are explained."],
  ["duplicate-send-replay", "Duplicate send replay", "Repeated send execution returns the original idempotent receipt."],
  ["finance-verification", "Finance verification", "A supported individual verification returns a simulated receipt."],
  ["finance-rejection", "Finance rejection unavailable", "Rejection remains blocked because no dedicated authority is proven."],
  ["books-approval-blocked", "Books approval blocked", "Books execution remains disabled and independently approval-gated."],
  ["portal-resend", "Portal resend", "Portal resend hands off to the reviewed Communications surface."],
  ["portal-reset-approval-blocked", "Portal reset approval blocked", "Reset cannot execute without independent approval."],
  ["large-workload", "Large workload", "Population-scale deterministic paging without browser-wide data loading."],
  ["expired-command-preview", "Expired command preview", "A command preview expires before confirmation and cannot execute."],
  ["stale-command-preview", "Stale command preview", "The product snapshot changes after preview and execution fails closed."],
  ["capability-denied", "Capability denied", "The simulated operator lacks the operation capability."],
  ["feature-flag-disabled", "Feature flag disabled", "The domain operation is not enabled."],
  ["operation-lock-conflict", "Operation lock conflict", "Another simulated operation holds the guarded lock."],
  ["partial-batch-failure", "Partial batch failure", "One applicant changes authority after preview and is handed off as an exception."],
  ["successful-batch", "Successful batch", "A bounded communication cohort returns applicant-level receipts."],
  ["batch-cap-exceeded", "Batch cap exceeded", "A cohort above the execution cap fails closed before confirmation."],
  ["exception-handoff", "Batch exception handoff", "A blocked applicant opens in the exact Individual Workbench."],
  ["work-session-progress", "Work Session progress", "Exact ApplicantID, position and outcomes remain visible through the session."],
  ["idempotent-replay", "Idempotent replay", "Repeated execution returns the original versioned receipt."],
  ["altered-replay-payload", "Altered replay payload", "A reused idempotency context with altered confirmation is rejected."],
  ["product-isolation", "Product state isolation", "FODE, KIA and MLC retain independent snapshots and workspace state."]
].map(([id, label, description]) => ({ id, label, description }));

function listScenarios() {
  return SCENARIOS.slice();
}

function scenarioById(id) {
  return SCENARIOS.find((item) => item.id === id) || SCENARIOS[0];
}

function nowIso() {
  return new Date().toISOString();
}

function productCode(value) {
  const key = String(value || "FODE").toUpperCase();
  return Object.prototype.hasOwnProperty.call(PRODUCT_SNAPSHOT_IDS, key) ? key : "FODE";
}

function productSnapshotId(product) {
  return PRODUCT_SNAPSHOT_IDS[productCode(product)];
}

function rowsForProduct(product, scenarioId) {
  const key = productCode(product);
  const rows = rowsForScenario(scenarioId);
  if (key === "FODE") return rows;
  return rows.map((source) => {
    const applicantId = String(source.applicantId).replace(/^FODE/, key);
    return {
      ...source,
      product: key,
      applicantId,
      rowKey: String(source.rowKey || "").replace(/^FODE/, key),
      displayName: `${key} ${source.displayName}`,
      snapshotId: productSnapshotId(key),
      returnContext: { ...source.returnContext, product: key, applicantId }
    };
  });
}

function scopeFor(row) {
  if (row.urgencyLevel === "ESCALATED" || row.urgencyLevel === "CRITICAL") return "ESCALATED";
  if (row.actionOwner === "NONE") return "UNASSIGNED";
  if (row.actionOwner === "APPLICANT") return "TEAM";
  return "MY";
}

function exactRows() {
  return [
    row({
      index: 1,
      applicantId: "FODE-26-002985",
      rowNumber: 2985,
      name: "Jackson Numa",
      email: "jackson.numa@example.test",
      phone: "+675 7000 2985",
      actionabilityState: "COMPLETE",
      worklistKey: "COMPLETE",
      worklistLabel: "Completed / No Action",
      nextAction: "No immediate operator action",
      actionOwner: "NONE",
      urgencyLevel: "NORMAL",
      documentState: "VERIFIED",
      financeState: "PAID_VERIFIED",
      contactabilityState: "EMAIL_AVAILABLE",
      recommendedMessageType: "",
      selectable: false,
      selectBlockReason: "Completed record; no operator action is required."
    }),
    row({
      index: 2,
      applicantId: "FODE-26-002959",
      rowNumber: 2959,
      name: "Keziah Waffi",
      email: "keziah.waffi@example.test",
      phone: "+675 7000 2959",
      actionabilityState: "REVIEW_REQUIRED",
      worklistKey: "DOCUMENT_REVIEW",
      worklistLabel: "Document review",
      nextAction: "Inspect document PNG rendition",
      actionOwner: "OFFICER",
      urgencyLevel: "ESCALATED",
      documentState: "REVIEW_REQUIRED",
      financeState: "PAYMENT_NOT_APPLICABLE",
      contactabilityState: "EMAIL_AVAILABLE",
      recommendedMessageType: "DOCUMENT_REVIEW_REQUIRED"
    }),
    row({
      index: 3,
      applicantId: "FODE-26-TEST-004",
      rowNumber: 9004,
      name: "TEST_COMM_D Payment Verified",
      email: "test.comm.d@example.test",
      phone: "+675 7000 9004",
      actionabilityState: "COMPLETE",
      worklistKey: "PAYMENT_VERIFIED",
      worklistLabel: "Payment verified",
      nextAction: "No immediate operator action",
      actionOwner: "FINANCE",
      urgencyLevel: "NORMAL",
      documentState: "VERIFIED",
      financeState: "PAID_VERIFIED",
      contactabilityState: "EMAIL_AVAILABLE",
      recommendedMessageType: "PAYMENT_VERIFIED_RECEIPT"
    })
  ];
}

function row(input) {
  const scope = input.workScope || scopeFor(input);
  const selectable = input.selectable !== false;
  return {
    rowKey: `FODE:${input.applicantId}:${input.rowNumber}`,
    rowNumber: input.rowNumber,
    applicantId: input.applicantId,
    displayName: input.name,
    email: input.email,
    effectiveEmail: input.email || "",
    phone: input.phone,
    actionabilityState: input.actionabilityState,
    actionabilityLabel: STATE_LABELS[input.actionabilityState] || input.actionabilityState,
    worklistKey: input.worklistKey,
    worklistLabel: input.worklistLabel,
    primaryRoute: input.primaryRoute || routeFor(input.nextAction),
    actionOwner: input.actionOwner,
    workOwnership: {
      scope,
      assignedOperator: scope === "MY" ? "Current authorised operator" : "",
      assignedTeam: input.actionOwner,
      assignmentSource: "Preview fixture projection",
      dueAt: "2026-07-15",
      escalationState: scope === "ESCALATED" ? "Escalated projection" : "Not escalated",
      unassignedReason: scope === "UNASSIGNED" ? "No current operator owner in fixture projection" : ""
    },
    nextAction: input.nextAction,
    selectable,
    selectBlockReason: input.selectBlockReason || "",
    authorityDecision: {
      schemaVersion: "EDUOPS_ROW_AUTHORITY_DECISION_V1",
      authoritySource: "Actionability Resolver",
      actionAvailable: selectable === true,
      stale: false,
      reasonCode: input.blockerCode || (selectable ? "PREVIEW_FIXTURE_ACTION_AVAILABLE" : "PREVIEW_FIXTURE_ACTION_BLOCKED"),
      reason: input.blockerReason || input.selectBlockReason || input.nextAction || "Preview fixture authority."
    },
    blockerCode: input.blockerCode || "",
    blockerReason: input.blockerReason || input.selectBlockReason || "",
    urgencyLevel: input.urgencyLevel || "NORMAL",
    urgencyReason: input.urgencyReason || "Preview deterministic ordering",
    coolingOffUntil: input.coolingOffUntil || "",
    recommendedMessageType: input.recommendedMessageType || "",
    reminderCount: Number(input.reminderCount || 0),
    lastAttemptAt: input.lastAttemptAt || "",
    lastAttemptResult: input.lastAttemptResult || "",
    reminderDue: input.reminderDue === true,
    communicationAuthoritySummary: input.communicationAuthoritySummary || "Read-only preview communication authority",
    presentation: fixtureRowPresentation(input),
    canonicalLifecycle: {
      baseState: input.actionabilityState,
      lifecycleStage: input.actionabilityState,
      overlays: [],
      recommendedNextAction: input.nextAction,
      recommendedMessageType: input.recommendedMessageType || "",
      actionOwner: input.actionOwner,
      reason: "Preview fixture authority"
    },
    canonicalFinanceState: input.financeState || "UNKNOWN",
    documentState: input.documentState || "UNKNOWN",
    contactabilityState: input.contactabilityState || "EMAIL_AVAILABLE",
    operationalRow: {
      schemaVersion: "OPSEDU_OPERATIONAL_ROW_V1",
      issueLabel: input.nextAction || "Review authoritative fixture",
      issueEvidence: input.communicationAuthoritySummary || "Preview fixture authority.",
      nextActionLabel: input.nextAction || "Review authoritative fixture",
      nextActionDetail: input.worklistLabel || "Current authoritative work package",
      statusLabel: STATE_LABELS[input.actionabilityState] || input.actionabilityState || "Unknown",
      contactLabel: fixtureHumanize(input.contactabilityState || "UNKNOWN"),
      dueLabel: input.coolingOffUntil ? "Cooling-off active" : "",
      workPackageLabel: input.worklistLabel || fixtureHumanize(input.worklistKey),
      authorityReason: input.blockerReason || input.nextAction || "Preview fixture authority.",
      selectionLabel: selectable ? "Selectable" : "Not selectable",
      nextActionTimestamp: input.nextActionTimestamp || SNAPSHOT_AS_OF,
      missingDocumentNames: input.documentState === "REVIEW_REQUIRED" ? ["Proof of identity"] : []
    },
    portalState: input.portalState || "SUBMITTED",
    sourceReliability: reliability("AUTHORITATIVE", "Preview fixture authority is deterministic."),
    authorityProjectionVersion: CONTRACT_VERSION,
    returnContext: {
      product: "FODE",
      actionabilityState: input.actionabilityState,
      worklistKey: input.worklistKey,
      workScope: scope,
      page: 1,
      pageSize: 25,
      applicantId: input.applicantId
    },
    snapshotId: SNAPSHOT_ID
  };
}

function routeFor(nextAction) {
  if (/payment/i.test(nextAction || "")) return "Finance";
  if (/contact/i.test(nextAction || "")) return "Contactability";
  if (/portal/i.test(nextAction || "")) return "Portal";
  return "Admissions Review";
}

function generatedRows(size = 200) {
  const rows = exactRows();
  const stateKeys = ["READY", "COOLING_OFF", "AWAITING_APPLICANT", "AWAITING_PAYMENT", "REVIEW_REQUIRED", "BLOCKED", "UNKNOWN", "COMPLETE"];
  for (let i = 4; i <= size; i += 1) {
    const state = stateKeys[(i - 4) % stateKeys.length];
    const escalated = state === "REVIEW_REQUIRED" && i % 5 !== 0;
    rows.push(row({
      index: i,
      applicantId: `FODE-26-PREVIEW-${String(i).padStart(4, "0")}`,
      rowNumber: 5000 + i,
      name: `Preview Applicant ${String(i).padStart(3, "0")}`,
      email: `preview.${i}@example.test`,
      phone: `+675 7000 ${String(i).padStart(4, "0")}`,
      actionabilityState: state,
      worklistKey: state === "AWAITING_PAYMENT" || state === "COMPLETE" ? "FINANCE_REVIEW" : "DOCUMENT_REVIEW",
      worklistLabel: state === "AWAITING_PAYMENT" || state === "COMPLETE" ? "Finance review" : "Document review",
      nextAction: state === "COMPLETE" ? "No immediate operator action" : "Review authoritative fixture",
      actionOwner: escalated ? "OFFICER" : (i % 7 === 0 ? "APPLICANT" : "OFFICER"),
      urgencyLevel: escalated ? "ESCALATED" : (i % 11 === 0 ? "HIGH" : "NORMAL"),
      documentState: i % 3 === 0 ? "REVIEW_REQUIRED" : "VERIFIED",
      financeState: state === "AWAITING_PAYMENT" ? "PAYMENT_PENDING" : "NOT_YET_PAYMENT_APPLICABLE",
      contactabilityState: i % 13 === 0 ? "EMAIL_SUPPRESSED" : "EMAIL_AVAILABLE",
      recommendedMessageType: "PREVIEW_NOTICE"
    }));
  }
  return rows;
}

function rowsForScenario(scenarioId) {
  const rows = generatedRows(scenarioId === "large-workload" ? 360 : 200);
  if (scenarioId === "r410-actionability-gallery") {
    rows.unshift(...r410ActionabilityRows());
  }
  if (scenarioId === "long-display-values") {
    rows.unshift(row({
      index: 1000,
      applicantId: "FODE-26-LONG-001",
      rowNumber: 9100,
      name: "Alexandria-Mary-Jane Applicant With A Deliberately Long Display Name",
      email: "alexandria.mary.jane.applicant.with.a.deliberately.long.recipient.address@example.test",
      phone: "+675 7000 9100",
      actionabilityState: "READY",
      worklistKey: "DOCUMENT_REVIEW",
      worklistLabel: "Document review",
      nextAction: "Review long-value fixture",
      actionOwner: "OFFICER",
      urgencyLevel: "HIGH",
      documentState: "REVIEW_REQUIRED",
      financeState: "NOT_YET_PAYMENT_APPLICABLE",
      contactabilityState: "EMAIL_AVAILABLE",
      recommendedMessageType: "DOCUMENT_REVIEW_REQUIRED"
    }));
  }
  if (scenarioId === UNSAFE_DUPLICATE_INTEGRITY_SCENARIO) {
    rows.push(row({
      index: 1002,
      applicantId: "FODE-26-002985",
      rowNumber: 92985,
      name: "Duplicate Jackson Integrity Fixture",
      email: "duplicate.jackson@example.test",
      phone: "+675 7000 92985",
      actionabilityState: "READY",
      worklistKey: "DOCUMENT_REVIEW",
      worklistLabel: "Document review",
      nextAction: "Reconcile duplicate ApplicantID evidence",
      actionOwner: "OFFICER",
      urgencyLevel: "CRITICAL",
      documentState: "REVIEW_REQUIRED",
      financeState: "NOT_YET_PAYMENT_APPLICABLE",
      contactabilityState: "EMAIL_AVAILABLE",
      recommendedMessageType: "DOCUMENT_REVIEW_REQUIRED"
    }));
  }
  if (scenarioId === "contactability-failure") {
    rows.unshift(row({
      index: 1001,
      applicantId: "FODE-26-CONTACT-001",
      rowNumber: 9101,
      name: "Contactability Failure Fixture",
      email: "",
      phone: "+675 7000 1111",
      actionabilityState: "READY",
      worklistKey: "CONTACTABILITY",
      worklistLabel: "Contactability",
      nextAction: "Fix contact details",
      actionOwner: "OFFICER",
      urgencyLevel: "HIGH",
      documentState: "REVIEW_REQUIRED",
      financeState: "NOT_YET_PAYMENT_APPLICABLE",
      contactabilityState: "EMAIL_SUPPRESSED",
      communicationAuthoritySummary: "No effective email; communication is suppressed in preview."
    }));
  }
  return rows;
}

function r410ActionabilityRows() {
  const base = {
    worklistKey: "DOCUMENT_FOLLOW_UP",
    worklistLabel: "Missing Documents",
    nextAction: "Await applicant document upload",
    actionOwner: "APPLICANT",
    urgencyLevel: "NORMAL",
    documentState: "MISSING",
    financeState: "NOT_YET_PAYMENT_APPLICABLE",
    contactabilityState: "EMAIL_AVAILABLE",
    recommendedMessageType: "",
    selectable: false
  };
  return [
    row({ ...base, index: 4101, applicantId: "FODE-26-R410-EMPTY", rowNumber: 94101, name: "R410 Zero Documents", email: "zero.docs@example.test", phone: "+675 7000 4101", actionabilityState: "AWAITING_APPLICANT", selectBlockReason: "Waiting for applicant upload; no governed reminder is currently due." }),
    row({ ...base, index: 4102, applicantId: "FODE-26-R410-MISSING", rowNumber: 94102, name: "R410 All Documents Missing", email: "all.missing@example.test", phone: "+675 7000 4102", actionabilityState: "AWAITING_APPLICANT", selectBlockReason: "Waiting for applicant upload; no governed reminder is currently due." }),
    row({ ...base, index: 4103, applicantId: "FODE-26-R410-PARTIAL", rowNumber: 94103, name: "R410 Partial Upload", email: "partial.upload@example.test", phone: "+675 7000 4103", actionabilityState: "AWAITING_APPLICANT", documentState: "INCOMPLETE", selectBlockReason: "Waiting for applicant upload; no governed reminder is currently due." }),
    row({ ...base, index: 4104, applicantId: "FODE-26-R410-REVIEW", rowNumber: 94104, name: "R410 Documents To Review", email: "docs.review@example.test", phone: "+675 7000 4104", actionabilityState: "REVIEW_REQUIRED", worklistKey: "DOCUMENT_REVIEW", worklistLabel: "Document Review", nextAction: "Review document evidence", actionOwner: "OFFICER", urgencyLevel: "HIGH", documentState: "REVIEW_REQUIRED", selectBlockReason: "Admissions review is required before applicant communication." }),
    row({ ...base, index: 4105, applicantId: "FODE-26-R410-VERIFIED", rowNumber: 94105, name: "R410 Documents Verified", email: "docs.verified@example.test", phone: "+675 7000 4105", actionabilityState: "READY", worklistKey: "ENROLMENT_COMPLETION", worklistLabel: "Academic Administration", nextAction: "Complete enrolment", actionOwner: "ADMIN", urgencyLevel: "DUE", documentState: "VERIFIED", selectable: false, selectBlockReason: "Admin completion is required." }),
    row({ ...base, index: 4106, applicantId: "FODE-26-R410-PHONE", rowNumber: 94106, name: "R410 Phone Only", email: "", phone: "+675 7000 4106", actionabilityState: "REVIEW_REQUIRED", worklistKey: "CONTACTABILITY_EXCEPTION", worklistLabel: "Contactability Gate", nextAction: "Fix contact details", actionOwner: "ADMIN", contactabilityState: "PHONE_FALLBACK_AVAILABLE", selectBlockReason: "No email recorded; phone fallback requires contactability review." }),
    row({ ...base, index: 4107, applicantId: "FODE-26-R410-UNCONTACTABLE", rowNumber: 94107, name: "R410 Uncontactable", email: "", phone: "", actionabilityState: "UNCONTACTABLE", worklistKey: "CONTACTABILITY_EXCEPTION", worklistLabel: "Contactability Gate", nextAction: "Fix contact details", actionOwner: "ADMIN", urgencyLevel: "UNCONTACTABLE", contactabilityState: "UNCONTACTABLE", selectable: false, selectBlockReason: "Uncontactable: No email or phone recorded. Contactability Gate must be resolved before communication." }),
    row({ ...base, index: 4108, applicantId: "FODE-26-R410-COOLING", rowNumber: 94108, name: "R410 Cooling Off", email: "cooling.off@example.test", phone: "+675 7000 4108", actionabilityState: "COOLING_OFF", worklistKey: "DOCUMENT_FOLLOW_UP", worklistLabel: "Missing Documents", nextAction: "Await cooling-off expiry", actionOwner: "APPLICANT", urgencyLevel: "NORMAL", coolingOffUntil: "2026-08-15T00:00:00.000Z", selectBlockReason: "Cooling-off active until 2026-08-15T00:00:00.000Z." }),
    row({ ...base, index: 4109, applicantId: "FODE-26-R410-REMINDER-0", rowNumber: 94109, name: "R410 Reminder Count 0", email: "reminder.zero@example.test", phone: "+675 7000 4109", actionabilityState: "AWAITING_APPLICANT", reminderCount: 0, reminderDue: false }),
    row({ ...base, index: 4110, applicantId: "FODE-26-R410-REMINDER-1", rowNumber: 94110, name: "R410 Reminder Count 1", email: "reminder.one@example.test", phone: "+675 7000 4110", actionabilityState: "READY", selectable: true, reminderCount: 1, reminderDue: true, lastAttemptAt: "2026-07-20T00:00:00.000Z", lastAttemptResult: "SENT", recommendedMessageType: "docs_missing" }),
    row({ ...base, index: 4111, applicantId: "FODE-26-R410-REMINDER-2", rowNumber: 94111, name: "R410 Reminder Count 2", email: "reminder.two@example.test", phone: "+675 7000 4111", actionabilityState: "REVIEW_REQUIRED", reminderCount: 2, reminderDue: false, lastAttemptAt: "2026-07-20T00:00:00.000Z", lastAttemptResult: "SENT", worklistKey: "COMMUNICATION_REVIEW", worklistLabel: "Communication Review", nextAction: "Review communication cadence", actionOwner: "ADMIN", selectBlockReason: "Compatibility communication cadence requires manual review before another send." }),
    row({ ...base, index: 4112, applicantId: "FODE-26-R410-REMINDER-3", rowNumber: 94112, name: "R410 Reminder Count 3 Dormant", email: "reminder.three@example.test", phone: "+675 7000 4112", actionabilityState: "DORMANT", reminderCount: 3, reminderDue: false, lastAttemptAt: "2026-07-20T00:00:00.000Z", lastAttemptResult: "SENT", worklistKey: "DORMANT_REENGAGEMENT", worklistLabel: "Dormant / Re-engagement", nextAction: "Explicit re-engagement review", actionOwner: "ADMIN", urgencyLevel: "DORMANT", selectable: false, selectBlockReason: "Third governed reminder exhausted; explicit re-engagement is required." }),
    row({ ...base, index: 4113, applicantId: "FODE-26-R410-LONG", rowNumber: 94113, name: "R410 Applicant With A Deliberately Long Name For Wrapping Checks", email: "r410.long.recipient.address.with.multiple.segments@example.test", phone: "+675 7000 4113", actionabilityState: "AWAITING_APPLICANT", selectBlockReason: "Waiting for applicant upload; no governed reminder is currently due." })
  ];
}

function populationIntegrityForRows(rows) {
  const sourceRows = Array.isArray(rows) ? rows : [];
  const applicantRows = new Map();
  const missingOrInvalidApplicantIds = [];
  let populationCount = 0;
  sourceRows.forEach((rowItem, index) => {
    const applicantId = String(rowItem && rowItem.applicantId || "").trim();
    const rowNumber = Number(rowItem && rowItem.rowNumber) || index + 2;
    if (!applicantId) {
      missingOrInvalidApplicantIds.push({ rowNumber, reasonCode: "MISSING_APPLICANT_ID" });
      return;
    }
    populationCount += 1;
    if (!applicantRows.has(applicantId)) applicantRows.set(applicantId, []);
    applicantRows.get(applicantId).push(rowNumber);
  });
  const duplicateRowReferencesAll = Array.from(applicantRows.entries())
    .filter((entry) => entry[1].length > 1)
    .map((entry) => ({ applicantId: entry[0], rowNumbers: entry[1].slice().sort((left, right) => left - right) }))
    .sort((left, right) => left.applicantId.localeCompare(right.applicantId));
  const evidenceLimit = 25;
  const duplicateRowReferences = duplicateRowReferencesAll.slice(0, evidenceLimit);
  const boundedMissing = missingOrInvalidApplicantIds.slice(0, evidenceLimit);
  const duplicateApplicantIds = duplicateRowReferences.map((item) => item.applicantId);
  const unsafe = duplicateRowReferencesAll.length > 0 || missingOrInvalidApplicantIds.length > 0;
  const blockCode = duplicateRowReferencesAll.length ? "DUPLICATE_APPLICANT_ID" : missingOrInvalidApplicantIds.length ? "MISSING_APPLICANT_ID" : "";
  const duplicateReason = duplicateRowReferences.length
    ? `Duplicate ApplicantID ${duplicateRowReferences[0].applicantId} occurs on rows ${duplicateRowReferences[0].rowNumbers.join(" and ")}.`
    : "";
  const missingReason = boundedMissing.length
    ? `Missing ApplicantID evidence occurs on row ${boundedMissing[0].rowNumber}.`
    : "";
  const blockReason = [duplicateReason, missingReason].filter(Boolean).join(" ") + (unsafe ? " Batch authority is blocked until population identity is reconciled." : "");
  const reconciliationFindings = duplicateRowReferences.map((item) => ({
    code: "DUPLICATE_APPLICANT_ID",
    applicantId: item.applicantId,
    rowNumbers: item.rowNumbers.slice(),
    reason: `Duplicate ApplicantID ${item.applicantId} occurs on rows ${item.rowNumbers.join(" and ")}.`
  })).concat(boundedMissing.map((item) => ({
    code: item.reasonCode,
    rowNumber: item.rowNumber,
    reason: `ApplicantID is missing on row ${item.rowNumber}.`
  })));
  const fingerprintSource = JSON.stringify({
    scannedRowCount: sourceRows.length,
    populationCount,
    distinctApplicantIdCount: applicantRows.size,
    duplicateRowReferences: duplicateRowReferencesAll,
    missingOrInvalidApplicantIds
  });
  return {
    schemaVersion: POPULATION_INTEGRITY_SCHEMA_VERSION,
    status: unsafe ? "FAIL" : "PASS",
    authoritySafeToBatch: !unsafe,
    blockCode,
    blockReason,
    populationCount,
    scannedRowCount: sourceRows.length,
    distinctApplicantIdCount: applicantRows.size,
    duplicateApplicantIdCount: duplicateRowReferencesAll.length,
    missingOrInvalidApplicantIdCount: missingOrInvalidApplicantIds.length,
    duplicateApplicantIds,
    duplicateRowReferences,
    missingOrInvalidApplicantIds: boundedMissing,
    reconciliationFindings,
    evidenceTruncated: duplicateRowReferencesAll.length > evidenceLimit || missingOrInvalidApplicantIds.length > evidenceLimit,
    integrityFingerprint: `sha256:${crypto.createHash("sha256").update(fingerprintSource).digest("hex")}`
  };
}

function populationRowsForContext(context, product) {
  if (context && context.mode === "snapshot") {
    const rows = snapshotRows(context.snapshot);
    return Array.isArray(rows) ? rows : [];
  }
  return rowsForProduct(product, context && context.scenarioId || "normal-authoritative");
}

function populationIntegrityBlockResponse(integrity, details) {
  const reason = integrity && integrity.blockReason || "Canonical population integrity is unsafe for Batch operations.";
  return {
    ok: false,
    readOnly: true,
    state: "BLOCKED",
    statusLabel: "Blocked",
    executable: false,
    code: integrity && integrity.blockCode || "POPULATION_INTEGRITY_UNSAFE",
    blockCode: integrity && integrity.blockCode || "POPULATION_INTEGRITY_UNSAFE",
    blockReason: reason,
    message: reason,
    authoritySource: "Canonical Population Integrity",
    populationIntegrity: integrity,
    ...(details || {})
  };
}

function getDelayMs(scenarioId, overrideMs) {
  if (Number.isFinite(Number(overrideMs)) && Number(overrideMs) >= 0) return Number(overrideMs);
  if (scenarioId === "slow-6s") return 6000;
  if (scenarioId === "timeout-10s") return 11200;
  if (scenarioId === "rapid-supersession") return 750;
  return 250;
}

function snapshotIncompatible(message, snapshot) {
  return {
    ok: false,
    readOnly: true,
    code: "SNAPSHOT_INCOMPATIBLE",
    message: message || "Snapshot incompatible with this EduOps build. Capture a new FODE snapshot or select a compatible deterministic scenario.",
    snapshotMetadata: snapshot && snapshot.metadata || null
  };
}

function snapshotMissing() {
  return {
    ok: false,
    readOnly: true,
    code: "SNAPSHOT_REQUIRED",
    message: "Select a compatible Fresh FODE snapshot or use deterministic scenario mode."
  };
}

function validateSnapshot(snapshot) {
  if (!snapshot || typeof snapshot !== "object") return snapshotMissing();
  var metadata = snapshot.metadata || {};
  if (metadata.snapshotFormatVersion !== SNAPSHOT_FORMAT_VERSION) return snapshotIncompatible("Snapshot incompatible with this EduOps build. Capture a new FODE snapshot or select a compatible deterministic scenario.", snapshot);
  if (metadata.contractVersion !== CONTRACT_VERSION) return snapshotIncompatible("Snapshot incompatible with this EduOps build. Capture a new FODE snapshot or select a compatible deterministic scenario.", snapshot);
  if (!snapshot.workloads || !snapshot.workloads.default || !Array.isArray(snapshot.workloads.default.rows)) return snapshotIncompatible("Incomplete snapshot: default workload rows are missing.", snapshot);
  if (!snapshot.exactApplicants || typeof snapshot.exactApplicants !== "object") return snapshotIncompatible("Incomplete snapshot: exact applicant Workbench fixtures are missing.", snapshot);
  return { ok: true };
}

function snapshotRows(snapshot) {
  var valid = validateSnapshot(snapshot);
  if (valid.ok !== true) return valid;
  return (snapshot.workloads.default.rows || []).map(function (item) {
    var copy = { ...item };
    copy.sourceReliability = copy.sourceReliability || reliability(snapshot.metadata.sourceReliability || "AUTHORITATIVE", "Captured snapshot fixture.");
    return copy;
  });
}

function snapshotActionabilityCounts(snapshot) {
  return snapshot.counts && snapshot.counts.actionabilityCounts || snapshot.workloads && snapshot.workloads.default && snapshot.workloads.default.actionabilityCounts || {};
}

function snapshotWorklistCounts(snapshot, state) {
  var rows = snapshotRows(snapshot);
  if (!Array.isArray(rows)) return {};
  return worklistCounts(rows, state);
}

function fixtureClean(value) {
  return String(value == null ? "" : value).trim();
}

function fixtureHumanize(value) {
  return fixtureClean(value).replace(/[_-]+/g, " ").replace(/\b\w/g, function (letter) { return letter.toUpperCase(); });
}

function fixtureAuthorityUnavailable(domain, authoritySource) {
  return {
    schemaVersion: "EDUOPS_AUTHORITY_DECISION_V1",
    authoritySource: fixtureClean(authoritySource),
    available: false,
    stale: false,
    reasonCode: "BACKEND_CONTRACT_MISSING",
    reason: "Authoritative " + fixtureClean(domain || "authority") + " decision was not returned. Refresh or retry before continuing."
  };
}

function fixtureCodePresentation(code, label, reason, authoritySource) {
  var value = fixtureClean(code);
  var publicLabel = fixtureClean(label);
  if (!value || !publicLabel) return fixtureAuthorityUnavailable("state presentation", authoritySource);
  return {
    schemaVersion: "EDUOPS_CODE_PRESENTATION_V1",
    authoritySource: fixtureClean(authoritySource || "Authoritative backend service"),
    code: value,
    label: publicLabel,
    reason: fixtureClean(reason),
    available: true,
    stale: false
  };
}

function fixtureStatePresentation(state) {
  var key = fixtureClean(state || "UNKNOWN").toUpperCase();
  var catalogue = {
    READY: ["Ready for action", "Authorised work can proceed now.", "ready"],
    COOLING_OFF: ["Recently contacted - waiting period", "A known action is time-gated.", "warn"],
    AWAITING_APPLICANT: ["Waiting for applicant", "Applicant input or evidence is required.", "warn"],
    AWAITING_PAYMENT: ["Waiting for payment", "Payment or evidence is outstanding.", "warn"],
    REVIEW_REQUIRED: ["Needs review", "An internal decision is required.", "warn"],
    UNCONTACTABLE: ["Uncontactable", "No valid email or phone is recorded; Contactability Gate is required.", "blocked"],
    DORMANT: ["Dormant / re-engagement", "The third governed reminder is exhausted; explicit re-engagement is required.", "warn"],
    BLOCKED: ["Blocked - intervention required", "A known blocker prevents progress.", "blocked"],
    UNKNOWN: ["Classification required", "Authority cannot classify this record safely.", "blocked"],
    COMPLETE: ["Completed records", "No current operator action is required.", "ready"],
    AUTHORITATIVE: ["Authoritative", "The authority projection is current.", "ready"],
    DERIVED: ["Derived projection", "This display is derived by an authoritative backend service.", "muted"],
    STALE: ["Source changed", "Refresh or revalidate before acting.", "warn"],
    CONFLICTING: ["Authority conflict", "Conflicting facts prevent safe action.", "blocked"],
    UNAVAILABLE: ["Source unavailable", "The authority projection could not be returned.", "blocked"]
  };
  var item = catalogue[key];
  if (!item) return fixtureAuthorityUnavailable("state presentation", "EduOps backend presentation service");
  return {
    schemaVersion: "EDUOPS_STATE_PRESENTATION_V1",
    authoritySource: "EduOps backend presentation service",
    code: key,
    label: item[0],
    reason: item[1],
    tone: item[2],
    available: true,
    stale: false
  };
}

function fixtureUniqueFilterOptions(rows, field, authoritySource) {
  var seen = {};
  (Array.isArray(rows) ? rows : []).forEach(function (rowItem) {
    var code = fixtureClean(rowItem && rowItem[field]);
    if (!code || seen[code]) return;
    seen[code] = fixtureCodePresentation(code, fixtureHumanize(code), "", authoritySource);
  });
  return Object.keys(seen).sort().map(function (code) { return seen[code]; });
}

function fixtureDistribution(rows, getter, authoritySource) {
  var counts = {};
  (Array.isArray(rows) ? rows : []).forEach(function (rowItem) {
    var code = fixtureClean(getter(rowItem));
    if (code) counts[code] = Number(counts[code] || 0) + 1;
  });
  return Object.keys(counts).sort().map(function (code) {
    var item = fixtureCodePresentation(code, fixtureHumanize(code), "", authoritySource);
    item.count = counts[code];
    return item;
  });
}

function fixtureActionabilityPresentation(counts) {
  return ["READY", "COOLING_OFF", "AWAITING_APPLICANT", "AWAITING_PAYMENT", "REVIEW_REQUIRED", "UNCONTACTABLE", "DORMANT", "BLOCKED", "UNKNOWN", "COMPLETE"].map(function (code) {
    var item = fixtureStatePresentation(code);
    item.count = Number(counts && counts[code] || 0);
    return item;
  });
}

function fixtureWorklistPresentation(counts, rows) {
  var labels = {};
  (Array.isArray(rows) ? rows : []).forEach(function (rowItem) {
    var key = fixtureClean(rowItem && rowItem.worklistKey);
    if (key && !labels[key]) labels[key] = fixtureClean(rowItem.worklistLabel) || fixtureHumanize(key);
  });
  var total = Object.keys(counts || {}).reduce(function (sum, key) { return sum + Number(counts[key] || 0); }, 0);
  var out = [{
    schemaVersion: "EDUOPS_CODE_PRESENTATION_V1",
    authoritySource: "Actionability Resolver",
    code: "",
    label: "All work types",
    reason: "All worklist types in the selected Actionability state.",
    available: true,
    stale: false,
    count: total
  }];
  Object.keys(counts || {}).sort().forEach(function (key) {
    var item = fixtureCodePresentation(key, labels[key] || fixtureHumanize(key), "", "Actionability Resolver");
    item.count = Number(counts[key] || 0);
    out.push(item);
  });
  return out;
}

function fixtureWorkScopePresentation() {
  return [
    ["MY", "My Work"], ["TEAM", "Team Work"], ["UNASSIGNED", "Unassigned"],
    ["ESCALATED", "Escalated"], ["ALL_AUTHORISED", "All Authorised Work"]
  ].map(function (item) {
    return fixtureCodePresentation(item[0], item[1], "Operator query scope projected by the backend.", "EduOps workload query service");
  });
}

function fixtureRowPresentation(input) {
  var actionability = input.actionabilityState || "UNKNOWN";
  return {
    lifecycle: fixtureCodePresentation(input.actionabilityState, STATE_LABELS[input.actionabilityState] || fixtureHumanize(input.actionabilityState), "Preview fixture lifecycle authority.", "Canonical Lifecycle Resolver"),
    actionability: fixtureStatePresentation(actionability),
    worklist: fixtureCodePresentation(input.worklistKey || "", input.worklistLabel || fixtureHumanize(input.worklistKey), "Preview fixture worklist authority.", "Actionability Resolver"),
    owner: fixtureCodePresentation(input.actionOwner || "", fixtureHumanize(input.actionOwner), "Preview fixture owner authority.", "Actionability Resolver"),
    route: fixtureCodePresentation(input.primaryRoute || routeFor(input.nextAction), input.primaryRoute || routeFor(input.nextAction), "Preview fixture route authority.", "Actionability Resolver"),
    nextAction: fixtureCodePresentation(input.nextAction || "", input.nextAction || "Review authoritative fixture", "Preview fixture next-action authority.", "Actionability Resolver"),
    finance: fixtureCodePresentation(input.financeState || "UNKNOWN", fixtureHumanize(input.financeState || "UNKNOWN"), "Preview fixture Finance authority.", "Finance authority"),
    documents: fixtureCodePresentation(input.documentState || "UNKNOWN", fixtureHumanize(input.documentState || "UNKNOWN"), "Preview fixture Document authority.", "Document authority"),
    contactability: fixtureCodePresentation(input.contactabilityState || "UNKNOWN", fixtureHumanize(input.contactabilityState || "UNKNOWN"), "Preview fixture Contactability authority.", "Contactability authority"),
    reliability: fixtureStatePresentation("AUTHORITATIVE")
  };
}

function fixtureSearchHandoff(rowItem, snapshotId) {
  return {
    schemaVersion: "OPSEDU_SEARCH_HANDOFF_V1",
    authoritySource: "Preview fixture search handoff",
    applicantId: rowItem.applicantId,
    product: rowItem.product || productCode(rowItem.applicantId && String(rowItem.applicantId).split("-")[0]) || "FODE",
    snapshotId: snapshotId || rowItem.snapshotId || SNAPSHOT_ID,
    queueBinding: {
      product: rowItem.product || "FODE",
      actionabilityState: rowItem.actionabilityState,
      worklistKey: rowItem.worklistKey || "",
      workScope: rowItem.returnContext && rowItem.returnContext.workScope || "ALL_AUTHORISED",
      filters: { search: rowItem.applicantId },
      sort: { key: "urgency", direction: "asc" },
      page: 1,
      pageSize: 25,
      expectedSnapshotId: snapshotId || rowItem.snapshotId || SNAPSHOT_ID
    },
    actionPackageLabel: rowItem.worklistLabel || fixtureHumanize(rowItem.worklistKey),
    openQueueLabel: "Open correct work package",
    nextAction: rowItem.nextAction || "Review authoritative fixture",
    targetTab: "overview"
  };
}

function fixtureWorkbenchAction(operation, label, available, reason, options) {
  return {
    schemaVersion: "EDUOPS_WORKBENCH_ACTION_V1",
    authoritySource: "Preview fixture operation authority",
    operation: operation,
    label: label,
    available: available === true,
    reason: reason || "Preview Lab is read-only.",
    options: Array.isArray(options) ? options : []
  };
}

function fixtureOperationAvailability(_populationIntegrity) {
  return {
    BATCH_COMMUNICATION: {
      operation: "BATCH_COMMUNICATION",
      available: true,
      reason: "Preview fixture exposes the feature-only operation flag so the production client population-integrity gate is exercised independently.",
      blockCode: "",
      authoritySource: "Preview fixture feature availability"
    }
  };
}

function fixturePrimaryActionTarget(rowItem) {
  return {
    schemaVersion: "OPSEDU_PRIMARY_ACTION_TARGET_V1",
    authoritySource: "Actionability Resolver",
    available: true,
    targetTab: rowItem.documentState === "REVIEW_REQUIRED" ? "documents" : rowItem.canonicalFinanceState === "PAID_VERIFIED" ? "finance" : "overview",
    targetActionLabel: rowItem.nextAction || "Review applicant",
    reason: "Preview fixture routes the exact applicant to its current authoritative work package."
  };
}

function fixtureApplicantContextRibbon(rowItem) {
  return {
    schemaVersion: "OPSEDU_APPLICANT_CONTEXT_RIBBON_V1",
    authoritySource: "Preview fixture applicant context",
    items: [
      { key: "route", label: "Route", displayValue: rowItem.primaryRoute || "Admissions Review", reason: "Preview route projection." },
      { key: "owner", label: "Owner", displayValue: rowItem.actionOwner || "OFFICER", reason: "Preview owner projection." },
      { key: "urgency", label: "Urgency", displayValue: rowItem.urgencyLevel || "NORMAL", reason: "Preview urgency projection." }
    ]
  };
}

function fixtureCommunicationSummary(rowItem) {
  var messageType = rowItem.recommendedMessageType || "DOCUMENT_REVIEW_REQUIRED";
  return {
    schemaVersion: "EDUOPS_COMMUNICATION_SUMMARY_V1",
    authoritySource: "Communication Authority",
    recommendedMessageType: messageType,
    operatorRecommendation: fixtureHumanize(messageType),
    eligibility: "Preview communication available for read-only browser validation.",
    coolingOffUntil: rowItem.coolingOffUntil || "",
    latestCommunication: "2026-07-10T08:00:00.000Z",
    deliveryState: "No active bounce",
    suppressionState: "None",
    effectiveEmail: rowItem.email,
    draft: { recipient: rowItem.email },
    communicationTemplatePanel: {
      schemaVersion: "OPSEDU_COMMUNICATION_TEMPLATE_PANEL_V1",
      authoritySource: "Communication Authority",
      templates: [{
        templateId: messageType,
        messageType: messageType,
        label: fixtureHumanize(messageType),
        recommended: true,
        selectable: true,
        editable: true,
        availability: "AVAILABLE",
        availabilityLabel: "Available",
        description: "Preview fixture communication template.",
        subject: "Preview follow-up for " + rowItem.displayName,
        body: "Preview-only communication body for browser validation.",
        createdAt: SNAPSHOT_AS_OF,
        authorityProjection: { Comm_Status: "ACTIONABLE" }
      }]
    }
  };
}

function fixtureWorkloadPresentation(allRows, matchedRows, pageRows, reliabilityProjection, reconciliationProjection, actionabilityCounts, worklistKeyCounts) {
  var reconciliationValue = reconciliationProjection || {};
  var matched = Array.isArray(matchedRows) ? matchedRows : [];
  var visible = Array.isArray(pageRows) ? pageRows : [];
  var actionability = actionabilityCounts || {};
  var lifecycleRows = Array.isArray(allRows) ? allRows : [];
  var routeRows = lifecycleRows.map(function (rowItem) { return { primaryRoute: rowItem.primaryRoute }; });
  return {
    schemaVersion: "EDUOPS_WORKLOAD_PRESENTATION_V1",
    authoritySource: "EduOps backend projection services",
    actionabilityBuckets: fixtureActionabilityPresentation(actionability),
    allActionability: {
      code: "ALL",
      label: "All authoritative records",
      count: Object.keys(actionability).reduce(function (sum, key) { return sum + Number(actionability[key] || 0); }, 0),
      authoritySource: "Actionability Resolver"
    },
    worklists: fixtureWorklistPresentation(worklistKeyCounts, lifecycleRows),
    workScopes: fixtureWorkScopePresentation(),
    reliability: fixtureStatePresentation(reliabilityProjection && reliabilityProjection.state || "UNAVAILABLE"),
    metrics: [
      { code: "CANONICAL_POPULATION", label: "Canonical population", value: Number(reconciliationValue.canonicalPopulation || 0), authoritySource: "Population Ledger" },
      { code: "ELIGIBLE_NOW", label: "Eligible now", value: Number(reconciliationValue.metricCounts && reconciliationValue.metricCounts.eligibleNow || 0), authoritySource: "Actionability Resolver" },
      { code: "MATCHING_LATER_PAGES", label: "Matching on later pages", value: Number(reconciliationValue.matchingOnLaterPages || Math.max(0, matched.length - visible.length)), authoritySource: "EduOps workload query service" },
      { code: "OUTSIDE_CURRENT_VIEW", label: "Outside current view", value: Number(reconciliationValue.hiddenFromCurrentView || 0), authoritySource: "Population Ledger" },
      { code: "OLDEST_MATCHED", label: "Oldest matched", value: reconciliationValue.oldestMatchedAgeDays === "" ? "-" : String(reconciliationValue.oldestMatchedAgeDays == null ? "-" : reconciliationValue.oldestMatchedAgeDays) + (reconciliationValue.oldestMatchedAgeDays == null ? "" : " days"), authoritySource: "Actionability Resolver" }
    ],
    filterOptions: {
      owner: fixtureUniqueFilterOptions(lifecycleRows, "actionOwner", "Actionability Resolver"),
      urgency: fixtureUniqueFilterOptions(lifecycleRows, "urgencyLevel", "Actionability Resolver"),
      primaryRoute: fixtureUniqueFilterOptions(routeRows, "primaryRoute", "Actionability Resolver"),
      documentState: fixtureUniqueFilterOptions(lifecycleRows, "documentState", "Document authority"),
      financeState: fixtureUniqueFilterOptions(lifecycleRows, "canonicalFinanceState", "Finance authority"),
      contactabilityState: fixtureUniqueFilterOptions(lifecycleRows, "contactabilityState", "Contactability authority"),
      communicationState: fixtureUniqueFilterOptions(lifecycleRows, "recommendedMessageType", "Communication Authority"),
      cooling: [
        fixtureCodePresentation("ACTIVE", "Cooling-off active", "", "Actionability Resolver"),
        fixtureCodePresentation("NONE", "No cooling-off", "", "Actionability Resolver")
      ],
      blockKind: fixtureUniqueFilterOptions(lifecycleRows, "blockerCode", "Actionability Resolver")
    },
    modules: {
      overview: { schemaVersion: "EDUOPS_MODULE_PROJECTION_V1", authoritySource: "Population Ledger + Actionability Resolver", available: true, metrics: [] },
      lifecycle: { schemaVersion: "EDUOPS_MODULE_PROJECTION_V1", authoritySource: "Canonical Lifecycle Resolver", available: true, distribution: fixtureDistribution(lifecycleRows, function (rowItem) { return rowItem.canonicalLifecycle && (rowItem.canonicalLifecycle.lifecycleStage || rowItem.canonicalLifecycle.baseState); }, "Canonical Lifecycle Resolver") },
      finance: { schemaVersion: "EDUOPS_MODULE_PROJECTION_V1", authoritySource: "Finance authority", available: true, distribution: fixtureDistribution(lifecycleRows, function (rowItem) { return rowItem.canonicalFinanceState; }, "Finance authority") },
      documents: { schemaVersion: "EDUOPS_MODULE_PROJECTION_V1", authoritySource: "Document authority", available: true, distribution: fixtureDistribution(lifecycleRows, function (rowItem) { return rowItem.documentState; }, "Document authority") },
      communications: { schemaVersion: "EDUOPS_MODULE_PROJECTION_V1", authoritySource: "Communication Authority", available: true, distribution: fixtureDistribution(lifecycleRows, function (rowItem) { return rowItem.recommendedMessageType; }, "Communication Authority") },
      contactability: { schemaVersion: "EDUOPS_MODULE_PROJECTION_V1", authoritySource: "Contactability authority", available: true, distribution: fixtureDistribution(lifecycleRows, function (rowItem) { return rowItem.contactabilityState; }, "Contactability authority") },
      portal: fixtureAuthorityUnavailable("portal-access", "Portal Access Domain"),
      population: { schemaVersion: "EDUOPS_MODULE_PROJECTION_V1", authoritySource: "Population Ledger", available: true, reconciliation: reconciliationValue },
      health: { schemaVersion: "EDUOPS_MODULE_PROJECTION_V1", authoritySource: "EduOps runtime projection", available: true, reliability: fixtureStatePresentation(reliabilityProjection && reliabilityProjection.state || "UNAVAILABLE") }
    },
    evaluatedCohort: {
      totalMatched: matched.length,
      visiblePageCount: visible.length,
      snapshotId: fixtureClean(reconciliationValue.snapshotId),
      snapshotAsOf: fixtureClean(reconciliationValue.asOf)
    },
    selection: {
      totalMatched: matched.length,
      visibleSelectable: visible.filter(function (rowItem) { return rowItem.selectable === true; }).length,
      visibleBlocked: visible.filter(function (rowItem) { return rowItem.selectable !== true; }).length,
      totalAuthoritySelectable: Number(reconciliationValue.totalAuthoritySelectable == null ? matched.filter(function (rowItem) { return rowItem.selectable === true; }).length : reconciliationValue.totalAuthoritySelectable),
      authoritySource: "Actionability Resolver"
    }
  };
}

function snapshotWorkload(context, payload) {
  var snapshot = context.snapshot;
  var valid = validateSnapshot(snapshot);
  if (valid.ok !== true) return valid;
  var query = normalizePayload(payload);
  var metadata = snapshot.metadata || {};
  if (query.expectedSnapshotId && query.expectedSnapshotId !== metadata.snapshotId) {
    return staleResponse(query, metadata.snapshotId);
  }
  var rows = snapshotRows(snapshot);
  var filtered = filterRows(rows, query);
  var sorted = sortRows(filtered, query.sort);
  var totalMatched = sorted.length;
  var totalPages = Math.max(1, Math.ceil(totalMatched / query.pageSize));
  var page = Math.min(query.page, totalPages);
  var pageRows = sorted.slice((page - 1) * query.pageSize, page * query.pageSize);
  var rel = reliability(metadata.sourceReliability || "AUTHORITATIVE", "Fresh FODE snapshot fixture captured from read-only EduOps DTOs.");
  var actionabilityCounts = snapshotActionabilityCounts(snapshot);
  var worklistKeyCounts = snapshotWorklistCounts(snapshot, query.actionabilityState);
  var populationIntegrity = populationIntegrityForRows(rows);
  var queryBinding = fixtureQueryBinding(query, metadata.snapshotId, populationIntegrity);
  var reconciliationProjection = Object.assign(
    {},
    snapshot.reconciliation || reconciliation(rows, filtered, pageRows, query, metadata.snapshotId, populationIntegrity),
    {
      integrityState: populationIntegrity.status,
      populationIntegrity: populationIntegrity,
      queryBinding: queryBinding,
      queryFingerprint: queryBinding.queryFingerprint
    }
  );
  var response = {
    ok: true,
    readOnly: true,
    contractVersion: metadata.contractVersion,
    product: "FODE",
    profileVersion: metadata.profileVersion || PROFILE_VERSION,
    runtime: snapshot.accessProjection && snapshot.accessProjection.runtime || {
      schemaVersion: "EDUOPS_RUNTIME_IDENTITY_V1",
      runtimeIdentity: metadata.runtimeIdentity || "Captured runtime identity unavailable.",
      snapshotId: metadata.snapshotId,
      snapshotAsOf: metadata.sourceAsOf || metadata.capturedAt
    },
    snapshotId: metadata.snapshotId,
    snapshotAsOf: metadata.sourceAsOf || metadata.capturedAt,
    snapshotCacheState: "LOCAL_CAPTURE",
    authorityStatus: rel.authorityStatus,
    sourceStatus: rel.sourceStatus,
    reliabilityState: rel.state,
    reliabilityReasons: rel.reasons,
    actionabilityState: query.actionabilityState,
    worklistKey: query.worklistKey,
    workScope: query.workScope,
    filters: query.filters,
    sort: query.sort,
    page: page,
    pageSize: query.pageSize,
    totalMatched: totalMatched,
    totalPages: totalPages,
    actionabilityCounts: actionabilityCounts,
    worklistKeyCounts: worklistKeyCounts,
    metricCounts: metricCounts(filtered),
    populationIntegrity: populationIntegrity,
    queryBinding: queryBinding,
    reconciliation: reconciliationProjection,
    presentation: fixtureWorkloadPresentation(rows, filtered, pageRows, rel, reconciliationProjection, actionabilityCounts, worklistKeyCounts),
    operationAvailability: fixtureOperationAvailability(populationIntegrity),
    rows: pageRows.map(function (rowItem) { return { ...rowItem, snapshotId: metadata.snapshotId, sourceReliability: rel }; })
  };
  response.timings = timings(response, context.serverDurationMs || 0);
  return response;
}

function normalizePayload(payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  return {
    product: productCode(p.product),
    actionabilityState: String(p.actionabilityState || "READY").toUpperCase(),
    worklistKey: String(p.worklistKey || ""),
    workScope: String(p.workScope || "ALL_AUTHORISED").toUpperCase(),
    filters: p.filters && typeof p.filters === "object" ? p.filters : {},
    sort: p.sort && typeof p.sort === "object" ? p.sort : { key: "urgency", direction: "asc" },
    page: Math.max(1, Number(p.page || 1) || 1),
    pageSize: [10, 25, 50].includes(Number(p.pageSize)) ? Number(p.pageSize) : 25,
    expectedSnapshotId: String(p.expectedSnapshotId || "")
  };
}

function queryOperationalWorkload(context, payload) {
  if (context.mode === "snapshot") return snapshotWorkload(context, payload);
  const scenarioId = context.scenarioId || "normal-authoritative";
  const query = normalizePayload(payload);
  if (scenarioId === "source-unavailable") {
    return unavailableResponse(query, "SOURCE_UNAVAILABLE", "Preview source authority is unavailable.");
  }
  const currentSnapshotId = scenarioId === "stale-snapshot" && query.expectedSnapshotId ? (query.product === "FODE" ? CHANGED_SNAPSHOT_ID : query.product + "-PREVIEW-SNAPSHOT-002") : productSnapshotId(query.product);
  if (query.expectedSnapshotId && query.expectedSnapshotId !== currentSnapshotId) {
    return staleResponse(query, currentSnapshotId);
  }
  let rows = rowsForProduct(query.product, scenarioId);
  const populationIntegrity = populationIntegrityForRows(rows);
  const rel = scenarioId === "conflicting-authority"
    ? reliability("CONFLICTING", "Preview scenario reports conflicting source authorities.")
    : populationIntegrity.authoritySafeToBatch !== true
      ? reliability("CONFLICTING", populationIntegrity.blockReason)
    : reliability("AUTHORITATIVE", "Preview fixture authority is deterministic.");
  if (scenarioId === "conflicting-authority") {
    rows = rows.map((item) => ({ ...item, actionabilityState: item.actionabilityState === "READY" ? "UNKNOWN" : item.actionabilityState, actionabilityLabel: item.actionabilityState === "READY" ? "Unknown" : item.actionabilityLabel, selectable: false, selectBlockReason: "Source conflict prevents confident readiness.", sourceReliability: rel }));
  }
  const actionabilityCounts = { ...STATE_COUNTS };
  if (scenarioId === "large-workload") actionabilityCounts.READY = 134;
  if (scenarioId === UNSAFE_DUPLICATE_INTEGRITY_SCENARIO) actionabilityCounts.READY += 1;
  const filtered = filterRows(rows, query);
  const sorted = sortRows(filtered, query.sort);
  const totalMatched = sorted.length;
  const totalPages = Math.max(1, Math.ceil(totalMatched / query.pageSize));
  const page = Math.min(query.page, totalPages);
  const pageRows = sorted.slice((page - 1) * query.pageSize, page * query.pageSize).map((item) => ({ ...item, sourceReliability: rel, snapshotId: currentSnapshotId }));
  const worklistKeyCounts = worklistCounts(rows, query.actionabilityState);
  const queryBinding = fixtureQueryBinding(query, currentSnapshotId, populationIntegrity);
  const reconciliationProjection = Object.assign(
    reconciliation(rows, filtered, pageRows, query, currentSnapshotId, populationIntegrity),
    {
      queryBinding,
      queryFingerprint: queryBinding.queryFingerprint
    }
  );
  const response = {
    ok: true,
    readOnly: true,
    contractVersion: CONTRACT_VERSION,
    product: query.product,
    profileVersion: PROFILE_VERSION,
    runtime: getAccessProjection().runtime,
    snapshotId: currentSnapshotId,
    snapshotAsOf: SNAPSHOT_AS_OF,
    snapshotCacheState: "PREVIEW",
    authorityStatus: rel.authorityStatus,
    sourceStatus: rel.sourceStatus,
    reliabilityState: rel.state,
    reliabilityReasons: rel.reasons,
    actionabilityState: query.actionabilityState,
    worklistKey: query.worklistKey,
    workScope: query.workScope,
    filters: query.filters,
    sort: query.sort,
    page,
    pageSize: query.pageSize,
    totalMatched,
    totalPages,
    actionabilityCounts,
    worklistKeyCounts,
    metricCounts: metricCounts(filtered),
    populationIntegrity,
    queryBinding,
    reconciliation: reconciliationProjection,
    presentation: fixtureWorkloadPresentation(rows, filtered, pageRows, rel, reconciliationProjection, actionabilityCounts, worklistKeyCounts),
    operationAvailability: fixtureOperationAvailability(populationIntegrity),
    rows: pageRows
  };
  response.timings = timings(response, context.serverDurationMs || 0);
  return response;
}

function filterRows(rows, query) {
  const filters = query.filters || {};
  const search = String(filters.search || "").toLowerCase();
  return rows.filter((rowItem) => {
    if (query.actionabilityState !== "ALL" && rowItem.actionabilityState !== query.actionabilityState) return false;
    if (query.worklistKey && rowItem.worklistKey !== query.worklistKey) return false;
    if (query.workScope !== "ALL_AUTHORISED" && rowItem.workOwnership.scope !== query.workScope) return false;
    if (filters.owner && rowItem.actionOwner !== filters.owner) return false;
    if (filters.urgency && rowItem.urgencyLevel !== filters.urgency) return false;
    if (filters.primaryRoute && rowItem.primaryRoute !== filters.primaryRoute) return false;
    if (filters.documentState && rowItem.documentState !== filters.documentState) return false;
    if (filters.financeState && rowItem.canonicalFinanceState !== filters.financeState) return false;
    if (filters.contactabilityState && rowItem.contactabilityState !== filters.contactabilityState) return false;
    if (filters.communicationState && rowItem.recommendedMessageType !== filters.communicationState) return false;
    if (filters.blockKind && rowItem.blockerCode !== filters.blockKind) return false;
    if (filters.cooling === "ACTIVE" && !rowItem.coolingOffUntil) return false;
    if (filters.cooling === "NONE" && rowItem.coolingOffUntil) return false;
    if (search) {
      const hay = [rowItem.applicantId, rowItem.displayName, rowItem.email, rowItem.phone, rowItem.worklistLabel].join(" ").toLowerCase();
      if (!hay.includes(search)) return false;
    }
    return true;
  });
}

function sortRows(rows, sort) {
  const direction = String(sort && sort.direction || "asc").toLowerCase() === "desc" ? -1 : 1;
  return rows.slice().sort((a, b) => {
    const cmp = urgencyRank(a.urgencyLevel) - urgencyRank(b.urgencyLevel)
      || String(a.applicantId).localeCompare(String(b.applicantId))
      || Number(a.rowNumber || 0) - Number(b.rowNumber || 0);
    return cmp * direction;
  });
}

function urgencyRank(value) {
  const map = { CRITICAL: 0, UNCONTACTABLE: 1, ESCALATED: 2, DORMANT: 3, OVERDUE: 4, HIGH: 5, DUE: 6, NORMAL: 7, LOW: 8 };
  return Object.prototype.hasOwnProperty.call(map, String(value || "").toUpperCase()) ? map[String(value || "").toUpperCase()] : 99;
}

function worklistCounts(rows, state) {
  return rows.reduce((out, rowItem) => {
    if (state === "ALL" || rowItem.actionabilityState === state) out[rowItem.worklistKey] = Number(out[rowItem.worklistKey] || 0) + 1;
    return out;
  }, {});
}

function metricCounts(rows) {
  return rows.reduce((out, rowItem) => {
    if (rowItem.selectable) out.eligibleNow += 1;
    const key = rowItem.actionabilityState.toLowerCase().replace(/_([a-z])/g, (_m, c) => c.toUpperCase());
    if (Object.prototype.hasOwnProperty.call(out, key)) out[key] += 1;
    return out;
  }, { eligibleNow: 0, coolingOff: 0, awaitingApplicant: 0, awaitingPayment: 0, reviewRequired: 0, blocked: 0, unknown: 0, complete: 0 });
}

function fixtureQueryBinding(query, snapshotId, populationIntegrity) {
  const canonicalQuery = JSON.parse(JSON.stringify(query || {}));
  return {
    schemaVersion: "EDUOPS_QUERY_BINDING_V1",
    authority: "SERVER_AUTHORED",
    product: canonicalQuery.product || "FODE",
    snapshotId: snapshotId || "",
    snapshotAsOf: SNAPSHOT_AS_OF,
    integrityFingerprint: populationIntegrity && populationIntegrity.integrityFingerprint || "",
    query: canonicalQuery,
    queryFingerprint: JSON.stringify(canonicalQuery)
  };
}

function reconciliation(allRows, matchedRows, pageRows, query, snapshotId, populationIntegrity) {
  const matched = new Set(matchedRows.map((rowItem) => rowItem.applicantId));
  const page = new Set(pageRows.map((rowItem) => rowItem.applicantId));
  const hiddenReasons = allRows.filter((rowItem) => !matched.has(rowItem.applicantId)).slice(0, 50).map((rowItem) => ({
    applicantId: rowItem.applicantId,
    displayName: rowItem.displayName,
    reasonCode: query.actionabilityState !== "ALL" && rowItem.actionabilityState !== query.actionabilityState ? rowItem.actionabilityState : "FILTERED_FROM_VIEW",
    reason: query.actionabilityState !== "ALL" && rowItem.actionabilityState !== query.actionabilityState ? `${STATE_LABELS[rowItem.actionabilityState]} is outside this Actionability state.` : "Applicant is outside the selected work scope or filter.",
    actionabilityState: rowItem.actionabilityState,
    worklistKey: rowItem.worklistKey,
    selectable: rowItem.selectable
  }));
  const integrity = populationIntegrity || populationIntegrityForRows(allRows);
  return {
    schemaVersion: "EDUOPS_RECONCILIATION_V1",
    authoritySource: "Preview fixture Population Ledger + Actionability Resolver",
    canonicalPopulation: allRows.length,
    totalMatched: matchedRows.length,
    visiblePageCount: pageRows.length,
    visiblePageRange: pageRows.length ? `${((query.page - 1) * query.pageSize) + 1}-${((query.page - 1) * query.pageSize) + pageRows.length}` : "0",
    returnedWindow: pageRows.length,
    matchingOnLaterPages: Math.max(0, matchedRows.length - pageRows.length),
    eligibleOutsideCurrentWindow: matchedRows.filter((rowItem) => rowItem.selectable && !page.has(rowItem.applicantId)).length,
    hiddenFromCurrentView: hiddenReasons.length,
    excludedFromOperation: matchedRows.filter((rowItem) => !rowItem.selectable).length,
    totalAuthoritySelectable: matchedRows.filter((rowItem) => rowItem.selectable).length,
    totalAuthorityBlocked: matchedRows.filter((rowItem) => !rowItem.selectable).length,
    metricCounts: metricCounts(matchedRows),
    oldestVisibleAgeDays: 14,
    oldestMatchedAgeDays: 29,
    nextOperatorAction: pageRows[0] ? pageRows[0].nextAction : "",
    snapshotId,
    asOf: SNAPSHOT_AS_OF,
    integrityState: integrity.status,
    populationIntegrity: integrity,
    queryFingerprint: JSON.stringify(query),
    arithmetic: "canonicalPopulation = totalMatched + hiddenFromCurrentView",
    hiddenReasonRows: hiddenReasons,
    hiddenReasons
  };
}

function reliability(state, reason) {
  return {
    state,
    sourceStatus: state,
    authorityStatus: state === "AUTHORITATIVE" ? "AUTHORITATIVE" : state,
    reasons: [reason],
    domain: "EduOps Preview Lab",
    asOf: nowIso()
  };
}

function timings(response, serverDurationMs) {
  const approx = Number(serverDurationMs || 0);
  return {
    accessMs: 1,
    serverRpcMs: approx,
    canonicalSnapshotResolutionMs: Math.min(120, Math.max(2, Math.round(approx * 0.1))),
    sourceVersionMs: 1,
    cacheReadMs: 1,
    canonicalBuildMs: 0,
    projectionMs: 2,
    cacheWriteMs: 0,
    workloadCompositionMs: Math.min(180, Math.max(3, Math.round(approx * 0.2))),
    sortingPagingMs: Math.min(80, Math.max(1, Math.round(approx * 0.05))),
    responseBytes: Buffer.byteLength(JSON.stringify(response), "utf8")
  };
}

function staleResponse(query, snapshotId) {
  var staleReliability = reliability("STALE", "The requested preview workload snapshot no longer matches the current fixture authority snapshot.");
  var staleReconciliation = { integrityState: "STALE", hiddenReasons: [], snapshotId: snapshotId, asOf: SNAPSHOT_AS_OF, canonicalPopulation: 0, metricCounts: metricCounts([]) };
  return {
    ok: true,
    readOnly: true,
    contractVersion: CONTRACT_VERSION,
    product: "FODE",
    profileVersion: PROFILE_VERSION,
    snapshotId,
    snapshotAsOf: SNAPSHOT_AS_OF,
    reliabilityState: "STALE",
    reliabilityReasons: ["The requested preview workload snapshot no longer matches the current fixture authority snapshot."],
    actionabilityState: query.actionabilityState,
    worklistKey: query.worklistKey,
    workScope: query.workScope,
    filters: query.filters,
    sort: query.sort,
    page: query.page,
    pageSize: query.pageSize,
    totalMatched: 0,
    totalPages: 1,
    actionabilityCounts: { ...STATE_COUNTS },
    worklistKeyCounts: {},
    metricCounts: metricCounts([]),
    reconciliation: staleReconciliation,
    presentation: fixtureWorkloadPresentation([], [], [], staleReliability, staleReconciliation, { ...STATE_COUNTS }, {}),
    rows: [],
    timings: { serverRpcMs: 0, canonicalSnapshotResolutionMs: 1, workloadCompositionMs: 1, sortingPagingMs: 1, responseBytes: 0 }
  };
}

function unavailableResponse(query, code, message) {
  return {
    ok: false,
    readOnly: true,
    code,
    message,
    reliabilityState: "UNKNOWN",
    reliabilityReasons: [message],
    actionabilityState: query.actionabilityState,
    page: query.page,
    pageSize: query.pageSize
  };
}

function searchApplicants(context, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const product = productCode(p.product);
  if (context.mode === "snapshot") {
    var valid = validateSnapshot(context.snapshot);
    if (valid.ok !== true) return valid;
    var metadata = context.snapshot.metadata || {};
    if (p.expectedSnapshotId && p.expectedSnapshotId !== metadata.snapshotId) return { ok: false, readOnly: true, code: "STALE_SNAPSHOT", snapshotId: metadata.snapshotId, expectedSnapshotId: String(p.expectedSnapshotId || "") };
    var snapshotNeedle = String(p.query || "").toLowerCase();
    var snapshotMatches = snapshotRows(context.snapshot).filter(function (rowItem) {
      return [rowItem.applicantId, rowItem.displayName, rowItem.email, rowItem.phone].join(" ").toLowerCase().indexOf(snapshotNeedle) >= 0;
    });
    return { ok: true, readOnly: true, product: "FODE", query: p.query || "", snapshotId: metadata.snapshotId, totalMatches: snapshotMatches.length, matches: snapshotMatches.slice(0, Number(p.limit || 12)).map(function (rowItem) { return Object.assign({}, rowItem, { searchHandoff: fixtureSearchHandoff(rowItem, metadata.snapshotId) }); }), timings: { searchMs: 4 } };
  }
  const snapshotId = productSnapshotId(product);
  if (p.expectedSnapshotId && p.expectedSnapshotId !== snapshotId) {
    return { ok: false, readOnly: true, code: "STALE_SNAPSHOT", snapshotId, expectedSnapshotId: String(p.expectedSnapshotId || "") };
  }
  const query = String(p.query || "").toLowerCase();
  const rows = rowsForProduct(product, context.scenarioId).filter((rowItem) => [rowItem.applicantId, rowItem.displayName, rowItem.email, rowItem.phone].join(" ").toLowerCase().includes(query));
  return { ok: true, readOnly: true, product, query: p.query || "", snapshotId, totalMatches: rows.length, matches: rows.slice(0, Number(p.limit || 12)).map((rowItem) => Object.assign({}, rowItem, { searchHandoff: fixtureSearchHandoff(rowItem, snapshotId) })), timings: { searchMs: 4 } };
}

function getApplicantWorkbench(context, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const product = productCode(p.product || String(p.applicantId || "").split("-")[0]);
  if (context.mode === "snapshot") {
    var valid = validateSnapshot(context.snapshot);
    if (valid.ok !== true) return valid;
    var metadata = context.snapshot.metadata || {};
    if (p.expectedSnapshotId && p.expectedSnapshotId !== metadata.snapshotId) return { ok: false, readOnly: true, code: "STALE_SNAPSHOT", reliabilityState: "STALE", snapshotId: metadata.snapshotId, expectedSnapshotId: String(p.expectedSnapshotId || ""), message: "The applicant was requested from a stale captured snapshot." };
    var captured = context.snapshot.exactApplicants[String(p.applicantId || "")];
    if (!captured) return { ok: false, readOnly: true, code: "APPLICANT_NOT_FOUND", applicantId: p.applicantId };
    return captured.workbench || captured;
  }
  const snapshotId = productSnapshotId(product);
  if (p.expectedSnapshotId && p.expectedSnapshotId !== snapshotId) {
    return { ok: false, readOnly: true, code: "STALE_SNAPSHOT", reliabilityState: "STALE", snapshotId, expectedSnapshotId: String(p.expectedSnapshotId || ""), message: "The applicant was requested from a stale workload snapshot." };
  }
  const allRows = rowsForProduct(product, context.scenarioId);
  const found = allRows.find((rowItem) => rowItem.applicantId === p.applicantId);
  if (!found) return { ok: false, readOnly: true, code: "APPLICANT_NOT_FOUND", applicantId: p.applicantId };
  return {
    schemaVersion: "EDUOPS_APPLICANT_WORKBENCH_V2",
    authoritySource: "Preview fixture applicant workbench",
    ok: true,
    readOnly: true,
    product,
    snapshotId,
    rowKey: found.rowKey,
    applicantId: found.applicantId,
    identity: {
      applicantId: found.applicantId,
      rowNumber: found.rowNumber,
      displayName: found.displayName,
      email: found.email,
      phone: found.phone
    },
    exactAuthorityProjection: Object.assign({}, found, {
      authorityDecision: {
        schemaVersion: "EDUOPS_ROW_AUTHORITY_DECISION_V1",
        authoritySource: "Actionability Resolver",
        actionAvailable: found.selectable === true,
        stale: false,
        reasonCode: found.blockerCode || "PREVIEW_FIXTURE_AUTHORITY",
        reason: found.blockerReason || found.nextAction || "Preview fixture authority."
      }
    }),
    applicantDetail: { ok: true, applicantId: found.applicantId, displayName: found.displayName, rowNumber: found.rowNumber, readOnly: true },
    documents: { schemaVersion: "EDUOPS_DOCUMENT_AUTHORITY_V1", available: true, state: found.documentState, verified: found.documentState === "VERIFIED", requiredComplete: found.documentState === "VERIFIED", uploadedRequiredCount: 2, requiredCount: 3, missingRequiredDocuments: found.documentState === "VERIFIED" ? [] : ["Proof of identity"], presentation: fixtureCodePresentation(found.documentState, fixtureHumanize(found.documentState), "Preview fixture Document authority.", "Document authority"), actions: [readOnlyAction("Save document statuses", "CAN_SAVE_DOCUMENT_STATUSES")] },
    finance: { schemaVersion: "EDUOPS_FINANCE_AUTHORITY_V1", available: true, state: found.canonicalFinanceState, paymentApplicable: found.canonicalFinanceState !== "NOT_YET_PAYMENT_APPLICABLE", paymentEvidencePresent: found.canonicalFinanceState === "PAID_VERIFIED" || found.applicantId === "FODE-26-002959", paymentVerified: found.canonicalFinanceState === "PAID_VERIFIED", owner: found.actionOwner, blocker: "", reason: "Preview fixture Finance authority.", nextAction: found.nextAction, nextActionDate: "2026-07-15T00:00:00.000Z", invoiceReadiness: "Preview only", booksMatch: "Informational fixture", presentation: fixtureCodePresentation(found.canonicalFinanceState, fixtureHumanize(found.canonicalFinanceState), "Preview fixture Finance authority.", "Finance authority"), actions: [readOnlyAction("Verify payment", "CAN_VERIFY_PAYMENT")] },
    communications: fixtureCommunicationSummary(found),
    portal: { schemaVersion: "EDUOPS_PORTAL_AUTHORITY_V1", available: true, state: found.portalState, submitted: found.portalState === "SUBMITTED", accessState: "Open", locked: false, tokenState: "Authoritative token retained server-side", expiresAt: "2026-08-15T00:00:00.000Z", reason: "Portal access authority is read-only in Preview Lab.", presentation: fixtureCodePresentation(found.portalState, fixtureHumanize(found.portalState), "Preview fixture Portal authority.", "Portal Access Domain"), actions: [readOnlyAction("Manage portal access", "CAN_MANAGE_PORTAL_ACCESS")] },
    contactability: { schemaVersion: "EDUOPS_CONTACTABILITY_AUTHORITY_V1", available: true, state: found.contactabilityState, effectiveEmail: found.email, emailSource: "Deterministic applicant fixture", phone: found.phone, hasValidEmail: !!found.email && found.contactabilityState !== "EMAIL_SUPPRESSED", hasPhoneFallback: !!found.phone, suppressionState: found.contactabilityState === "EMAIL_SUPPRESSED" ? "Suppressed" : "None", reason: "Preview fixture Contactability authority.", presentation: fixtureCodePresentation(found.contactabilityState, fixtureHumanize(found.contactabilityState), "Preview fixture Contactability authority.", "Contactability authority"), actions: [readOnlyAction("Correct contact details", "CAN_EDIT_CONTACT_DETAILS")] },
    auditSummary: { preview: true, source: "Deterministic Preview Lab fixture", applicantId: found.applicantId },
    sourceReliability: found.sourceReliability,
    capabilities: { readOnly: false, role: "PREVIEW_ADMIN", capabilities: PREVIEW_CAPABILITIES, enforcement: "Preview transport simulates guarded contracts without live dependencies.", pass2Actions: [readOnlyAction("Run batch communications", "CAN_RUN_BATCH_COMMUNICATIONS")] },
    featureFlags: PREVIEW_FLAGS,
    operationAvailability: fixtureOperationAvailability(),
    actions: {
      DOCUMENT_REVIEW: fixtureWorkbenchAction("DOCUMENT_REVIEW", "Document review", true, "Preview fixture permits read-only document decision preview.", [
        fixtureCodePresentation("VERIFIED", "Verified", "Document evidence is acceptable.", "Document authority"),
        fixtureCodePresentation("REJECTED", "Rejected", "Document evidence needs correction.", "Document authority")
      ]),
      FINANCE_EVIDENCE_DECISION: fixtureWorkbenchAction("FINANCE_EVIDENCE_DECISION", "Finance evidence decision", true, "Preview fixture permits Finance decision preview.", [
        fixtureCodePresentation("VERIFIED", "Verified", "Payment evidence is acceptable.", "Finance authority"),
        fixtureCodePresentation("REJECTED", "Rejected", "Payment evidence needs correction.", "Finance authority")
      ]),
      SEND_INDIVIDUAL_COMMUNICATION: fixtureWorkbenchAction("SEND_INDIVIDUAL_COMMUNICATION", "Send individual communication", true, "Preview fixture permits communication preview only."),
      CONTACTABILITY_CORRECTION: fixtureWorkbenchAction("CONTACTABILITY_CORRECTION", "Contactability correction", true, "Preview fixture permits contactability correction preview.")
    },
    primaryActionTarget: fixturePrimaryActionTarget(found),
    applicantContextRibbon: fixtureApplicantContextRibbon(found),
    returnContext: found.returnContext,
    timings: { applicantMs: 5 }
  };
}

function readOnlyAction(label, capability) {
  return { label, enabled: false, readOnly: true, requiredCapability: capability, reason: "Available in EduOps Pass 2. Current Admin remains the operational path." };
}

function r410DocumentGalleryManifest_(applicantId, wb) {
  const definitions = [
    ["Birth_ID_Passport_File", "Birth / ID / Passport", "verified", "image/png", true],
    ["Latest_School_Report_File", "Latest School Report", "review", "application/pdf", true],
    ["Transfer_Certificate_File", "Transfer Certificate", "rejected", "application/pdf", true],
    ["Passport_Photo_File", "Passport Photo", "missing", "", false],
    ["Fee_Receipt_File", "Fee Receipt", "missing", "", false]
  ];
  const files = [];
  const missingExpected = [];
  definitions.forEach(([sourceField, label, state, mimeType, hasFile], index) => {
    const item = { sourceField, label, itemIndex: 0 };
    if (!hasFile) {
      missingExpected.push(item);
      return;
    }
    const file = {
      fileId: `r410-file-${applicantId}-${index}`,
      fileName: `${label.replace(/[^A-Za-z0-9]+/g, "-").toLowerCase()}.${mimeType === "image/png" ? "png" : "pdf"}`,
      label,
      mimeType,
      sizeBytes: 12048 + index,
      createdTime: SNAPSHOT_AS_OF,
      modifiedTime: SNAPSHOT_AS_OF,
      parentFolderId: "r410-preview-folder",
      sourceField,
      itemIndex: 0,
      mappingMethod: "r410-fixture",
      suspectedDocumentType: label.toLowerCase(),
      previewEligible: mimeType === "image/png",
      renditionEligible: mimeType === "image/png",
      renditionKind: mimeType === "image/png" ? "image-png" : "",
      thumbnailAvailable: mimeType === "image/png",
      previewUrl: "",
      openUrl: "preview://r410-open-original",
      downloadUrl: "preview://r410-download-original",
      warnings: []
    };
    file.documentKey = [applicantId, String(wb.identity.rowNumber), sourceField, "0"].join("|");
    file.documentType = label;
    file.status = state === "verified" ? "VERIFIED" : state === "rejected" ? "REJECTED" : "REVIEW_REQUIRED";
    file.statusPresentation = fixtureCodePresentation(file.status, fixtureHumanize(file.status), "R410 fixture document status.", "Document authority");
    file.availableDecisions = [
      fixtureCodePresentation("VERIFIED", "Verified", "Document evidence is acceptable.", "Document authority"),
      fixtureCodePresentation("REJECTED", "Rejected", "Document evidence needs correction.", "Document authority")
    ];
    file.evidenceCount = 1;
    file.evidenceFiles = [Object.assign({}, file, { activeEvidenceIndex: 0 })];
    files.push(file);
  });
  const galleryDocuments = files.concat(missingExpected.map((item) => ({ ...item, status: "MISSING", hasFile: false })));
  return {
    schemaVersion: "EDUOPS_DOCUMENT_MANIFEST_V2",
    authoritySource: "R410 Preview fixture document authority",
    ok: true,
    readOnly: true,
    applicantId,
    applicantName: wb.identity.displayName,
    rowNumber: wb.identity.rowNumber,
    folderId: "r410-preview-folder",
    folderName: "R410 Preview simulated folder",
    folderUrl: "",
    source: "r410-preview-fixture",
    files,
    documentGallery: { schemaVersion: "OPSEDU_DOCUMENT_GALLERY_V1", authoritySource: "R410 Preview fixture document authority", documents: galleryDocuments },
    actionAuthority: { schemaVersion: "EDUOPS_WORKBENCH_ACTION_V1", authoritySource: "R410 Preview fixture document authority", operation: "DOCUMENT_REVIEW", available: true, reason: "Preview fixture permits document decision preview only.", options: files[0] && files[0].availableDecisions || [] },
    missingExpected,
    warnings: [],
    renditionRule: "canonical original -> server-derived PNG rendition -> separate signed Open Original action",
    timings: { documentManifestMs: 3 }
  };
}

function documentManifest(context, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  if (context.mode === "snapshot") {
    var valid = validateSnapshot(context.snapshot);
    if (valid.ok !== true) return valid;
    var applicant = context.snapshot.exactApplicants[String(p.applicantId || "")];
    if (!applicant || !applicant.documentManifest) return { ok: false, readOnly: true, code: "DOCUMENT_MANIFEST_UNAVAILABLE", error: "Captured snapshot does not include this document manifest." };
    return applicant.documentManifest;
  }
  const applicantId = String(p.applicantId || "");
  const product = productCode(p.product || applicantId.split("-")[0]);
  const wb = getApplicantWorkbench(context, { product, applicantId, expectedSnapshotId: productSnapshotId(product) });
  if (wb.ok !== true) return wb;
  if (context.scenarioId === "r410-actionability-gallery") return r410DocumentGalleryManifest_(applicantId, wb);
  const unavailable = context.scenarioId === "document-preview-unavailable";
  const file = {
    fileId: `preview-file-${applicantId}`,
    fileName: unavailable ? "Preview-document-original.pdf" : "Preview-derived-document.png",
    label: "Proof of identity",
    mimeType: unavailable ? "application/pdf" : "image/png",
    sizeBytes: 12048,
    createdTime: SNAPSHOT_AS_OF,
    modifiedTime: SNAPSHOT_AS_OF,
    parentFolderId: "preview-folder",
    sourceField: "Proof_Of_Identity",
    itemIndex: 0,
    mappingMethod: "row_file_id",
    suspectedDocumentType: "identity",
    previewEligible: !unavailable,
    renditionEligible: !unavailable,
    renditionKind: unavailable ? "" : "image-png",
    thumbnailAvailable: !unavailable,
    previewUrl: "",
    openUrl: "preview://open-original",
    downloadUrl: "preview://download-original",
    warnings: unavailable ? [{ code: "RENDITION_UNAVAILABLE", message: "PNG rendition is unavailable in this scenario." }] : []
  };
  file.documentKey = [applicantId, String(wb.identity.rowNumber), file.sourceField, String(file.itemIndex)].join("|");
  file.documentType = "Identity evidence";
  file.status = "REVIEW_REQUIRED";
  file.statusPresentation = fixtureCodePresentation("REVIEW_REQUIRED", "Review required", "Preview fixture document status.", "Document authority");
  file.availableDecisions = [
    fixtureCodePresentation("VERIFIED", "Verified", "Document evidence is acceptable.", "Document authority"),
    fixtureCodePresentation("REJECTED", "Rejected", "Document evidence needs correction.", "Document authority")
  ];
  file.evidenceCount = 1;
  file.evidenceFiles = [Object.assign({}, file, { itemIndex: 0, activeEvidenceIndex: 0 })];
  return {
    schemaVersion: "EDUOPS_DOCUMENT_MANIFEST_V2",
    authoritySource: "Preview fixture document authority",
    ok: true,
    readOnly: true,
    applicantId,
    applicantName: wb.identity.displayName,
    rowNumber: wb.identity.rowNumber,
    folderId: "preview-folder",
    folderName: "Preview simulated folder",
    folderUrl: "",
    source: "preview-fixture",
    files: [file],
    documentGallery: {
      schemaVersion: "OPSEDU_DOCUMENT_GALLERY_V1",
      authoritySource: "Preview fixture document authority",
      documents: [file]
    },
    actionAuthority: {
      schemaVersion: "EDUOPS_WORKBENCH_ACTION_V1",
      authoritySource: "Preview fixture document authority",
      operation: "DOCUMENT_REVIEW",
      available: true,
      reason: "Preview fixture permits document decision preview only.",
      options: file.availableDecisions
    },
    missingExpected: [],
    warnings: file.warnings,
    renditionRule: "canonical original -> server-derived PNG rendition -> separate signed Open Original action",
    timings: { documentManifestMs: 3 }
  };
}

function validateDocumentContext(context, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const manifest = documentManifest(context, p);
  if (manifest.ok !== true) return manifest;
  const candidates = Array.isArray(manifest.files) ? manifest.files : [];
  const expected = candidates.find((file) => {
    if (p.documentKey && p.documentKey === file.documentKey) return true;
    return String(p.sourceField || "") === String(file.sourceField || "") && Number(p.itemIndex) === Number(file.itemIndex);
  }) || candidates[0];
  if (!expected) return { ok: false, readOnly: true, code: "DOCUMENT_CONTEXT_MISMATCH", error: "Document context does not match the applicant manifest" };
  if (context.scenarioId === "invalid-cross-applicant-document") {
    return { ok: false, readOnly: true, code: "DOCUMENT_CONTEXT_MISMATCH", error: "Document context does not match the applicant manifest" };
  }
  if (p.documentKey && p.documentKey !== expected.documentKey) {
    return { ok: false, readOnly: true, code: "DOCUMENT_CONTEXT_MISMATCH", error: "Document context does not match the applicant manifest" };
  }
  if (String(p.sourceField || "") !== expected.sourceField || Number(p.itemIndex) !== expected.itemIndex) {
    return { ok: false, readOnly: true, code: "DOCUMENT_CONTEXT_MISMATCH", error: "Document context does not match the applicant manifest" };
  }
  return { ok: true, manifest, file: expected };
}

function documentRendition(context, payload, rootDir) {
  if (context.mode === "snapshot") {
    var validSnapshot = validateSnapshot(context.snapshot);
    if (validSnapshot.ok !== true) return validSnapshot;
    var applicant = context.snapshot.exactApplicants[String(payload && payload.applicantId || "")];
    if (!applicant || !applicant.documentRenditions) return { ok: false, readOnly: true, code: "RENDITION_UNAVAILABLE", error: "Captured snapshot does not include a PNG rendition for this document." };
    var key = String(payload && payload.documentKey || "");
    return applicant.documentRenditions[key] || { ok: false, readOnly: true, code: "RENDITION_UNAVAILABLE", error: "Captured snapshot does not include this PNG rendition." };
  }
  const valid = validateDocumentContext(context, payload);
  if (valid.ok !== true) return valid;
  if (context.scenarioId === "document-preview-unavailable") {
    return { ok: false, readOnly: true, code: "RENDITION_UNAVAILABLE", error: "PNG preview is unavailable for this document." };
  }
  const pngPath = path.join(rootDir, "tools", "eduops-preview", "fixtures", "document-rendition.png");
  const data = fs.existsSync(pngPath)
    ? fs.readFileSync(pngPath).toString("base64")
    : "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADElEQVR4nGNgYGD4DwABBAEAgh6FOQAAAABJRU5ErkJggg==";
  return {
    ok: true,
    readOnly: true,
    sourceField: valid.file.sourceField,
    itemIndex: valid.file.itemIndex,
    label: valid.file.label,
    fileName: valid.file.fileName,
    sourceMimeType: valid.file.mimeType,
    renditionMimeType: "image/png",
    renditionKind: "image-png",
    renditionStorage: "preview-fixture",
    renditionFolderName: "Preview simulated folder",
    renditionKey: `preview-rendition-${valid.manifest.applicantId}`,
    generated: false,
    stalePolicy: "Preview fixture is immutable for the scenario.",
    canonicalOriginal: false,
    renditionOnly: true,
    dataUrl: `data:image/png;base64,${data}`,
    timings: { documentRenditionMs: 4 }
  };
}

function documentFileAction(context, payload) {
  if (context.mode === "snapshot") {
    var validSnapshot = validateSnapshot(context.snapshot);
    if (validSnapshot.ok !== true) return validSnapshot;
    var applicant = context.snapshot.exactApplicants[String(payload && payload.applicantId || "")];
    if (!applicant || !applicant.documentManifest) return { ok: false, readOnly: true, code: "DOCUMENT_ACTION_UNAVAILABLE", error: "Captured snapshot does not include this document action." };
    return {
      ok: true,
      readOnly: true,
      canonicalOriginal: true,
      openUrl: "preview://captured-open-original-representation",
      downloadUrl: "preview://captured-download-original-representation",
      expiresAt: "",
      label: "Captured Open Original representation",
      previewEligible: false
    };
  }
  const valid = validateDocumentContext(context, payload);
  if (valid.ok !== true) return valid;
  return {
    ok: true,
    readOnly: true,
    sourceField: valid.file.sourceField,
    itemIndex: valid.file.itemIndex,
    label: valid.file.label,
    mimeType: valid.file.mimeType,
    previewEligible: valid.file.previewEligible,
    canonicalOriginal: true,
    openUrl: `http://localhost:4173/preview-open-original/${encodeURIComponent(valid.manifest.applicantId)}`,
    downloadUrl: `http://localhost:4173/preview-download-original/${encodeURIComponent(valid.manifest.applicantId)}`,
    expiresAt: new Date(Date.now() + 5 * 60 * 1000).toISOString()
  };
}

function reconciliationRpc(context, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const workload = queryOperationalWorkload(context, p);
  if (workload.ok === false) return { ...workload, readOnly: true, product: workload.product || "FODE", hiddenReasons: [] };
  const hiddenReasons = workload.reconciliation && workload.reconciliation.hiddenReasonRows || [];
  const page = Math.max(1, Math.floor(Number(p.hiddenPage || 1)));
  const pageSize = Math.max(1, Math.min(100, Math.floor(Number(p.hiddenPageSize || 50))));
  const totalPages = Math.max(1, Math.ceil(hiddenReasons.length / pageSize));
  const boundedPage = Math.min(page, totalPages);
  const hiddenReasonPage = {
    schemaVersion: "EDUOPS_HIDDEN_REASON_PAGE_V1",
    authoritySource: "Preview fixture Population Ledger + Actionability Resolver",
    snapshotId: workload.snapshotId,
    queryFingerprint: workload.reconciliation.queryFingerprint,
    page: boundedPage,
    pageSize,
    totalHidden: hiddenReasons.length,
    totalPages,
    rows: hiddenReasons.slice((boundedPage - 1) * pageSize, boundedPage * pageSize)
  };
  return {
    ok: true,
    readOnly: true,
    schemaVersion: "EDUOPS_RECONCILIATION_RESPONSE_V1",
    authoritySource: "Preview fixture Population Ledger + Actionability Resolver",
    product: workload.product || "FODE",
    snapshotId: workload.snapshotId,
    reconciliation: workload.reconciliation,
    hiddenReasons: hiddenReasonPage.rows,
    hiddenReasonPage
  };
}

function parityDiagnostics(context, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  if (context.mode === "snapshot") {
    var valid = validateSnapshot(context.snapshot);
    if (valid.ok !== true) return valid;
    var metadata = context.snapshot.metadata || {};
    if (p.expectedSnapshotId && p.expectedSnapshotId !== metadata.snapshotId) return { ok: false, readOnly: true, code: "STALE_SNAPSHOT", snapshotId: metadata.snapshotId, expectedSnapshotId: p.expectedSnapshotId };
    return context.snapshot.paritySummary || { ok: true, readOnly: true, product: "FODE", snapshotId: metadata.snapshotId, reliabilityState: metadata.sourceReliability || "AUTHORITATIVE", note: "Captured parity summary was not available." };
  }
  if (p.expectedSnapshotId && p.expectedSnapshotId !== SNAPSHOT_ID) return { ok: false, readOnly: true, code: "STALE_SNAPSHOT", snapshotId: SNAPSHOT_ID, expectedSnapshotId: p.expectedSnapshotId };
  const conflict = context.scenarioId === "conflicting-authority";
  return {
    ok: !conflict,
    readOnly: true,
    product: "FODE",
    snapshotId: SNAPSHOT_ID,
    snapshotAsOf: SNAPSHOT_AS_OF,
    compared: 100,
    canonicalPopulationTotal: rowsForScenario(context.scenarioId).length,
    currentAdminBoundedRows: 100,
    exactMatches: conflict ? 92 : 100,
    mismatchesByField: conflict ? { actionabilityState: 3, selectable: 5 } : {},
    mismatches: conflict ? [{ applicantId: "FODE-26-PREVIEW-0042", field: "actionabilityState", eduops: "UNKNOWN", currentAdmin: "READY" }] : [],
    missingIdentities: [],
    extraIdentities: [],
    unsafeMismatches: conflict ? [{ applicantId: "FODE-26-PREVIEW-0042", field: "selectable" }] : [],
    reliabilityState: conflict ? "CONFLICTING" : "AUTHORITATIVE",
    note: "Preview parity diagnostics are deterministic and use simulated contracts.",
    timings: { parityMs: 5 }
  };
}

function operationHistory(payload) {
  const applicantId = String(payload && payload.applicantId || "");
  return { ok: true, readOnly: true, applicantId, receipts: (previewStore.history.get(applicantId) || []).slice() };
}

function commandDefinition(operation) {
  const definitions = {
    DOCUMENT_REVIEW: ["CAN_SAVE_DOCUMENT_STATUSES", false, "STANDARD"],
    FINANCE_EVIDENCE_DECISION: ["CAN_VERIFY_PAYMENT", false, "HIGH"],
    SEND_INDIVIDUAL_COMMUNICATION: ["CAN_SEND_INDIVIDUAL_EMAIL", false, "HIGH"],
    CONTACTABILITY_CORRECTION: ["CAN_OPEN_REVIEW_WORKSPACE", false, "STANDARD"],
    PORTAL_ACCESS: ["CAN_MANAGE_PORTAL_ACCESS", false, "HIGH"],
    BATCH_COMMUNICATION: ["CAN_RUN_BATCH_COMMUNICATIONS", true, "HIGH"],
    BOOKS_ACTION: ["CAN_WRITE_ZOHO_BOOKS", false, "CRITICAL"]
  };
  return definitions[String(operation || "").toUpperCase()] || null;
}

function batchCommunicationCatalogue(context, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  if (String(p.operation || "").toUpperCase() !== "BATCH_COMMUNICATION") {
    return { ok: false, readOnly: true, code: "UNSUPPORTED_OPERATION", message: "The Batch catalogue supports BATCH_COMMUNICATION only." };
  }
  const product = productCode(p.product);
  const snapshotId = productSnapshotId(product);
  if (!p.snapshotId || p.snapshotId !== snapshotId) {
    return { ok: false, readOnly: true, code: "STALE_SNAPSHOT", message: "The Batch catalogue is not bound to the current product snapshot." };
  }
  const supplied = p.selection && typeof p.selection === "object" ? p.selection : {};
  const allRows = rowsForProduct(product, context.scenarioId || "normal-authoritative");
  const populationIntegrity = populationIntegrityForRows(allRows);
  if (populationIntegrity.authoritySafeToBatch !== true) {
    return populationIntegrityBlockResponse(populationIntegrity, {
      operation: "BATCH_COMMUNICATION",
      product,
      snapshotId
    });
  }
  const rowLookup = new Map(allRows.map((rowItem) => [rowItem.applicantId, rowItem]));
  const excluded = new Set(Array.isArray(supplied.excludedApplicantIds) ? supplied.excludedApplicantIds : []);
  let selectedApplicantIds = Array.isArray(supplied.selectedApplicantIds) ? supplied.selectedApplicantIds.slice() : [];
  if (!selectedApplicantIds.length && supplied.selectionMode === "ALL_ELIGIBLE_MATCHING_QUERY") {
    selectedApplicantIds = allRows.filter((rowItem) => rowItem.selectable === true).map((rowItem) => rowItem.applicantId);
  }
  selectedApplicantIds = selectedApplicantIds.filter((applicantId) => rowLookup.has(applicantId) && !excluded.has(applicantId));
  const executionLimit = Math.max(1, Math.min(50, Number(p.executionLimit || supplied.executionLimit || 0)));
  const executionApplicantIds = selectedApplicantIds.slice(0, executionLimit);
  const templateId = executionApplicantIds.map((applicantId) => rowLookup.get(applicantId).recommendedMessageType).find(Boolean) || "DOCUMENT_REVIEW_REQUIRED";
  const templateLabel = fixtureHumanize(templateId);
  function recipient(applicantId, included) {
    const rowItem = rowLookup.get(applicantId);
    return {
      applicantId,
      name: rowItem.displayName,
      email: rowItem.email,
      actionability: rowItem.actionabilityState,
      lifecycle: rowItem.canonicalLifecycle.lifecycleStage,
      finance: rowItem.canonicalFinanceState,
      documentState: rowItem.documentState,
      coolingOffUntil: rowItem.coolingOffUntil,
      authorityDecision: included ? "INCLUDED" : "NOT_EVALUATED",
      authorityDecisionLabel: included ? "Included by Communication Authority" : "Outside evaluated execution cohort",
      included,
      reasonCode: included ? "" : "OUTSIDE_EXECUTION_LIMIT",
      reason: included ? "Preview fixture Communication Authority permits this recipient." : "Recipient remains outside the selected execution limit.",
      authoritySource: "Communication Authority",
      templateId,
      templateLabel,
      presentation: rowItem.presentation
    };
  }
  const evaluatedRecipients = executionApplicantIds.map((applicantId) => recipient(applicantId, true));
  const selectionBinding = {
    ...supplied,
    product,
    snapshotId,
    queryFingerprint: String(p.queryFingerprint || supplied.queryFingerprint || ""),
    selectedApplicantIds,
    excludedApplicantIds: Array.from(excluded),
    executionApplicantIds,
    executionLimit,
    masterCohortSize: selectedApplicantIds.length,
    executionCohortSize: executionApplicantIds.length,
    remainingAfterExecution: Math.max(0, selectedApplicantIds.length - executionApplicantIds.length),
    excludedCount: excluded.size,
    blockedCount: 0
  };
  return {
    ok: true,
    readOnly: true,
    schemaVersion: "EDUOPS_BATCH_COMMUNICATION_CATALOGUE_V1",
    state: "READY",
    statusLabel: "Cohort revalidated",
    executable: evaluatedRecipients.length > 0,
    authoritySource: "Communication Authority",
    snapshotId,
    selectionBinding,
    masterCohortSize: selectedApplicantIds.length,
    evaluatedCohortSize: executionApplicantIds.length,
    executionLimit,
    remainingAfterEvaluation: Math.max(0, selectedApplicantIds.length - executionApplicantIds.length),
    excludedCount: excluded.size,
    blockedCount: 0,
    masterRecipients: selectedApplicantIds.map((applicantId) => recipient(applicantId, executionApplicantIds.includes(applicantId))),
    templates: [{
      templateId,
      label: templateLabel,
      description: "Deterministic Preview Lab communication.",
      availabilityState: "AVAILABLE_FOR_ALL",
      selectable: evaluatedRecipients.length > 0,
      availabilityLabel: "Available for " + evaluatedRecipients.length + " of " + evaluatedRecipients.length,
      recommended: true,
      availableRecipientCount: evaluatedRecipients.length,
      unavailableRecipientCount: 0,
      reasonCode: "",
      reason: "Available for every applicant in the evaluated execution cohort.",
      editable: false,
      editingReason: "Batch Communication Authority uses canonical server-rendered copy; editing is not permitted.",
      customisable: false,
      retired: false,
      authoritySource: "Communication Authority",
      evaluatedSnapshot: snapshotId,
      evaluatedCohortBinding: selectionBinding.queryFingerprint || snapshotId,
      recipients: evaluatedRecipients
    }]
  };
}

function previewCommand(context, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  const operation = String(p.operation || "").toUpperCase();
  const definition = commandDefinition(operation);
  if (!definition) return { ok: false, code: "UNSUPPORTED_OPERATION", message: `Unsupported Preview operation ${operation}` };
  if (context.scenarioId === "feature-flag-disabled") return { ok: false, code: "DISABLED_BY_FLAG", message: `${operation} is disabled by the simulated feature flag.` };
  if (operation === "BOOKS_ACTION") return { ok: false, code: "DISABLED_BY_FLAG", message: "Books execution is disabled in this pass." };
  if (context.scenarioId === "capability-denied") return { ok: false, code: "CAPABILITY_DENIED", message: `${definition[0]} is required.` };
  const currentSnapshot = context.mode === "snapshot" ? context.snapshot && context.snapshot.metadata && context.snapshot.metadata.snapshotId : productSnapshotId(p.product);
  if (!p.snapshotId || p.snapshotId !== currentSnapshot) return { ok: false, code: "STALE_SNAPSHOT", message: "The command is not bound to the current product snapshot." };
  if (operation === "BATCH_COMMUNICATION") {
    const populationIntegrity = populationIntegrityForRows(populationRowsForContext(context, p.product));
    if (populationIntegrity.authoritySafeToBatch !== true) {
      return populationIntegrityBlockResponse(populationIntegrity, {
        operation,
        product: productCode(p.product),
        snapshotId: currentSnapshot
      });
    }
  }
  const selection = p.selection && typeof p.selection === "object" ? p.selection : null;
  if (selection && definition[1] !== true) return { ok: false, code: "BATCH_NOT_ALLOWED", message: "This operation is individual-only." };
  if (selection && selection.queryFingerprint !== p.queryFingerprint) return { ok: false, code: "QUERY_BINDING_MISMATCH", message: "The selection query changed after selection." };
  const selected = selection && Array.isArray(selection.selectedApplicantIds) ? selection.selectedApplicantIds.slice() : [];
  if (selection && !selected.length) return { ok: false, code: "EMPTY_SELECTION", message: "No selected applicants remain eligible." };
  if (selection && selected.length > 50) return { ok: false, code: "BATCH_CAP_EXCEEDED", message: "The selected cohort exceeds the bounded execution cap." };
  if (!selection && !p.applicantId) return { ok: false, code: "APPLICANT_ID_REQUIRED", message: "ApplicantID is required." };
  if (operation === "FINANCE_EVIDENCE_DECISION" && String(p.draft && p.draft.decision || "").toUpperCase() !== "VERIFIED") return { ok: false, code: "UNSUPPORTED_FINANCE_DECISION", message: "No dedicated Finance rejection authority is proven." };
  if (operation === "SEND_INDIVIDUAL_COMMUNICATION" && (context.scenarioId === "cooling-off-denial" || context.scenarioId === "contactability-failure")) return { ok: false, code: context.scenarioId === "cooling-off-denial" ? "COOLDOWN_ACTIVE" : "NO_EFFECTIVE_EMAIL", message: "Communication Authority blocked this preview." };
  const id = `PREVIEW-${operation}-${String(previewStore.previews.size + 1).padStart(4, "0")}`;
  const createdAt = new Date();
  const preview = {
    ok: true,
    state: context.scenarioId === "expired-command-preview" ? "EXPIRED" : "READY",
    schemaVersion: "EDUOPS_COMMAND_PREVIEW_V1",
    previewId: id,
    operation,
    product: p.product || "FODE",
    snapshotId: currentSnapshot,
    queryFingerprint: p.queryFingerprint || "",
    applicantId: p.applicantId || "",
    selectedApplicantIds: selected,
    requiredCapability: definition[0],
    risk: definition[2],
    dualApprovalRequired: operation === "PORTAL_ACCESS" || (operation === "BATCH_COMMUNICATION" && selected.length >= 25),
    idempotencyKey: p.idempotencyKey,
    summary: `${operation.replace(/_/g, " ")} / ${selection ? selected.length + " applicants" : p.applicantId}`,
    createdAt: createdAt.toISOString(),
    expiresAt: new Date(createdAt.getTime() + (context.scenarioId === "expired-command-preview" ? -1000 : 600000)).toISOString(),
    eligibleCount: selection ? selected.length : 1,
    blockedCount: 0,
    excludedCount: 0,
    partitions: selection ? [{ partitionKey: operation, label: operation.replace(/_/g, " "), memberCount: selected.length, executionCap: 50, requiredCapability: definition[0] }] : [],
    request: JSON.parse(JSON.stringify(p)),
    contextFingerprint: JSON.stringify({ operation, product: p.product || "FODE", snapshotId: currentSnapshot, queryFingerprint: p.queryFingerprint || "", applicantId: p.applicantId || "", selectedApplicantIds: selected, document: p.document || null, draft: p.draft || null, approvalId: p.approvalId || "" })
  };
  if (operation === "BATCH_COMMUNICATION") {
    const templateId = String(p.draft && p.draft.messageType || "DOCUMENT_REVIEW_REQUIRED");
    const templateLabel = fixtureHumanize(templateId);
    const rowLookup = new Map(rowsForProduct(p.product, context.scenarioId || "normal-authoritative").map((rowItem) => [rowItem.applicantId, rowItem]));
    preview.executable = selected.length > 0;
    preview.statusLabel = preview.executable ? "Ready" : "Blocked";
    preview.statusReason = preview.executable ? "Communication Authority authorised the deterministic preview cohort." : "No recipient is authorised.";
    preview.operationLabel = "Batch communication";
    preview.masterCohortSize = selected.length;
    preview.executionCohortSize = selected.length;
    preview.remainingAfterExecution = 0;
    preview.selectionBinding = selection;
    preview.selectedTemplate = {
      templateId,
      label: templateLabel,
      editable: false,
      editingReason: "Batch Communication Authority uses canonical server-rendered copy; editing is not permitted."
    };
    preview.subject = "Preview-only " + templateLabel;
    preview.body = "Deterministic Preview Lab communication body. No live message is sent.";
    preview.recipients = selected.map((applicantId) => {
      const rowItem = rowLookup.get(applicantId) || {};
      return {
        applicantId,
        name: rowItem.displayName || "",
        email: rowItem.email || "",
        included: true,
        authorityDecision: "INCLUDED",
        authorityDecisionLabel: "Included by Communication Authority",
        reason: "Preview fixture Communication Authority permits this recipient.",
        templateId,
        templateLabel,
        presentation: rowItem.presentation || {}
      };
    });
  }
  previewStore.previews.set(id, preview);
  return preview;
}

function executeCommand(context, payload) {
  const p = payload && typeof payload === "object" ? payload : {};
  if (p.confirmation !== true) return { ok: false, code: "EXPLICIT_CONFIRMATION_REQUIRED", message: "Explicit confirmation is required." };
  const preview = previewStore.previews.get(String(p.previewId || ""));
  if (!preview) return { ok: false, code: "PREVIEW_EXPIRED_OR_UNKNOWN", message: "The preview is unavailable." };
  if (Date.parse(preview.expiresAt) <= Date.now()) return { ok: false, code: "PREVIEW_EXPIRED", message: "The preview expired before execution." };
  if (preview.operation === "BATCH_COMMUNICATION") {
    const populationIntegrity = populationIntegrityForRows(populationRowsForContext(context, preview.product));
    if (populationIntegrity.authoritySafeToBatch !== true) {
      return populationIntegrityBlockResponse(populationIntegrity, {
        operation: preview.operation,
        product: preview.product,
        snapshotId: preview.snapshotId,
        previewId: preview.previewId
      });
    }
  }
  if (preview.dualApprovalRequired === true && !preview.request.approvalId) return { ok: false, code: "DUAL_APPROVAL_REQUIRED", message: "Independent approval is required for this operation." };
  if (preview.idempotencyKey !== p.idempotencyKey) return { ok: false, code: "IDEMPOTENCY_CONTEXT_MISMATCH", message: "The confirmation does not match the preview." };
  if (context.scenarioId === "stale-command-preview") return { ok: false, code: "STALE_SNAPSHOT", message: "The source snapshot changed after preview." };
  if (context.scenarioId === "operation-lock-conflict") return { ok: false, code: "OPERATION_LOCKED", message: "Another simulated operation holds the guarded lock." };
  if (previewStore.receipts.has(p.idempotencyKey)) {
    const stored = previewStore.receipts.get(p.idempotencyKey);
    if (stored.contextFingerprint !== preview.contextFingerprint) return { ok: false, code: "IDEMPOTENCY_CONTEXT_CONFLICT", message: "The idempotency key was already used for another command context." };
    return stored.receipt;
  }
  const ids = preview.selectedApplicantIds.length ? preview.selectedApplicantIds : [preview.applicantId];
  const applicantOutcomes = ids.map((applicantId, index) => ({ applicantId, outcome: context.scenarioId === "partial-batch-failure" && index === ids.length - 1 ? "BLOCKED" : "COMPLETE", reason: context.scenarioId === "partial-batch-failure" && index === ids.length - 1 ? "Simulated authority change" : "Simulated authoritative receipt" }));
  const completeCount = applicantOutcomes.filter((item) => item.outcome === "COMPLETE").length;
  const receipt = {
    ok: true,
    simulated: true,
    schemaVersion: "EDUOPS_RECEIPT_V1",
    receiptId: `RECEIPT-${String(previewStore.receipts.size + 1).padStart(4, "0")}`,
    previewId: preview.previewId,
    operation: preview.operation,
    product: preview.product,
    snapshotId: preview.snapshotId,
    queryFingerprint: preview.queryFingerprint,
    applicantId: preview.applicantId,
    selectedApplicantIds: preview.selectedApplicantIds,
    at: nowIso(),
    outcome: completeCount === applicantOutcomes.length ? "COMPLETE" : completeCount ? "PARTIAL" : "BLOCKED",
    publicLabel: "Versioned authoritative receipt",
    communication: null,
    sentCount: completeCount,
    completeCount,
    blockedCount: applicantOutcomes.length - completeCount,
    failedCount: 0,
    reconciliationRequiredCount: 0,
    unresolvedCount: 0,
    applicantOutcomes
  };
  previewStore.receipts.set(p.idempotencyKey, { contextFingerprint: preview.contextFingerprint, receipt });
  ids.forEach((applicantId) => previewStore.history.set(applicantId, [receipt].concat(previewStore.history.get(applicantId) || []).slice(0, 25)));
  return receipt;
}

function getAccessProjection() {
  return {
    schemaVersion: "EDUOPS_ACCESS_PROJECTION_V1",
    authoritySource: "Admin access and capability authority",
    ok: true,
    readOnly: true,
    product: "FODE",
    contractVersion: CONTRACT_VERSION,
    profileVersion: PROFILE_VERSION,
    runtime: {
      schemaVersion: "EDUOPS_RUNTIME_IDENTITY_V1",
      authoritySource: "FODE runtime configuration",
      operationalClassification: "FODE Admin staging operations",
      deploymentRole: "ADMIN_STAGING",
      environment: "Admin staging",
      version: "r352-preview",
      deployVersion: 352,
      runtimeIdentity: "r352-preview / 352",
      deploymentIdSafe: "preview",
      deploymentIdentity: "preview",
      sourceIdentity: "local-preview-fixture",
      appsScriptVersion: "",
      appsScriptVersionAvailable: false,
      appsScriptVersionReason: "Local deterministic Preview Lab fixture.",
      snapshotId: SNAPSHOT_ID,
      snapshotAsOf: SNAPSHOT_AS_OF,
      dataAuthority: "FODE deterministic Preview Lab fixture"
    },
    user: { email: "preview.owner@example.test", role: "PREVIEW_ADMIN", capabilities: PREVIEW_CAPABILITIES },
    environment: "Admin staging",
    deployment: { adminDeploymentIdSafe: "preview", studentDeploymentIdSafe: "preview-student" },
    featureFlags: PREVIEW_FLAGS,
    operationAvailability: fixtureOperationAvailability(),
    rpcAllowlist: { read: [
      "eduops_getAccessProjection",
      "eduops_getProfile",
      "eduops_queryOperationalWorkload",
      "eduops_searchApplicants",
      "eduops_getApplicantWorkbench",
      "eduops_getDocumentManifest",
      "eduops_getDocumentRendition",
      "eduops_getDocumentFileAction",
      "eduops_getReconciliation",
      "eduops_getParityDiagnostics",
      "eduops_getOperationHistory",
      "eduops_getBatchCommunicationCatalogue",
      "eduops_previewCommand"
    ], write: ["eduops_executeCommand"] }
  };
}

function getProfile() {
  return {
    schemaVersion: "EDUOPS_PROFILE_V2",
    authoritySource: "EduOps backend profile service",
    ok: true,
    readOnly: true,
    product: "FODE",
    label: "FODE",
    description: "Preview Lab over deterministic EduOps Pass 1 contracts.",
    products: [
      { code: "FODE", label: "FODE", name: "FODE Operations", mode: "LIVE_OPERATIONS", default: true },
      { code: "KIA", label: "KIA", name: "KIA Admissions", mode: "DEMONSTRATION_READ_ONLY", readOnlyReason: "KIA demonstration profile - no live operational actions." },
      { code: "MLC", label: "MLC", name: "MLC Admissions and Training", mode: "DEMONSTRATION_READ_ONLY", readOnlyReason: "MLC demonstration profile - no live operational actions." }
    ],
    contractVersion: CONTRACT_VERSION,
    profileVersion: PROFILE_VERSION,
    defaultQuery: { product: "FODE", actionabilityState: "READY", worklistKey: "", workScope: "ALL_AUTHORISED", filters: { search: "" }, sort: { key: "urgency", direction: "asc" }, page: 1, pageSize: 25 },
    actionabilityStates: fixtureActionabilityPresentation({}),
    workScopes: fixtureWorkScopePresentation(),
    featureFlags: PREVIEW_FLAGS,
    operationAvailability: fixtureOperationAvailability(),
    batchPolicy: { schemaVersion: "EDUOPS_BATCH_POLICY_V1", authoritySource: "Communication Authority", allowedExecutionLimits: [10, 25, 50], executionCap: 50 },
    commandContractVersion: "EDUOPS_COMMAND_PREVIEW_V1",
    receiptContractVersion: "EDUOPS_RECEIPT_V1"
  };
}

function handleRpc(name, context, payload, rootDir) {
  if (name === "eduops_getAccessProjection") return getAccessProjection();
  if (name === "eduops_getProfile") return getProfile();
  if (name === "eduops_queryOperationalWorkload") return queryOperationalWorkload(context, payload);
  if (name === "eduops_searchApplicants") return searchApplicants(context, payload);
  if (name === "eduops_getApplicantWorkbench") return getApplicantWorkbench(context, payload);
  if (name === "eduops_getDocumentManifest") return documentManifest(context, payload);
  if (name === "eduops_getDocumentRendition") return documentRendition(context, payload, rootDir);
  if (name === "eduops_getDocumentFileAction") return documentFileAction(context, payload);
  if (name === "eduops_getReconciliation") return reconciliationRpc(context, payload);
  if (name === "eduops_getParityDiagnostics") return parityDiagnostics(context, payload);
  if (name === "eduops_getOperationHistory") return operationHistory(payload);
  if (name === "eduops_getBatchCommunicationCatalogue") return batchCommunicationCatalogue(context, payload);
  if (name === "eduops_previewCommand") return previewCommand(context, payload);
  if (name === "eduops_executeCommand") return executeCommand(context, payload);
  return { ok: false, readOnly: true, code: "UNKNOWN_RPC", message: `Preview transport does not implement ${name}` };
}

module.exports = {
  CONTRACT_VERSION,
  PROFILE_VERSION,
  SNAPSHOT_FORMAT_VERSION,
  SANITISATION_VERSION,
  SNAPSHOT_ID,
  listScenarios,
  scenarioById,
  rowsForScenario,
  validateSnapshot,
  getDelayMs,
  handleRpc
};
