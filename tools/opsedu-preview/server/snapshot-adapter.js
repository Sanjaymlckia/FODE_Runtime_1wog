const fs = require("node:fs");
const path = require("node:path");

const SNAPSHOT_SCHEMA = "OPSEDU_PREVIEW_SNAPSHOT_V1";
const PRODUCT = "FODE";
const WAFII_ID = "FODE-26-002959";

const PRIMARY_BUCKETS = [
  { code: "READY", label: "Ready for action" },
  { code: "COOLING_OFF", label: "Recently contacted / waiting period" },
  { code: "AWAITING_APPLICANT", label: "Waiting for applicant" },
  { code: "AWAITING_PAYMENT", label: "Waiting for payment" },
  { code: "REVIEW_REQUIRED", label: "Needs review" },
  { code: "BLOCKED", label: "Blocked / intervention required" },
  { code: "CLASSIFICATION_REQUIRED", label: "Classification required" },
  { code: "COMPLETE", label: "Completed" }
];

const PACKAGE_LABELS = {
  "FODE:READY:PAYMENT_FOLLOW_UP": "Payment follow-ups due",
  "FODE:READY:DOCUMENT_FOLLOW_UP": "Missing documents - applicant follow-up due",
  "FODE:REVIEW_REQUIRED:DOCUMENT_FOLLOW_UP": "Missing documents - review decision required",
  "FODE:REVIEW_REQUIRED:DOCUMENT_REVIEW": "Document review required",
  "FODE:REVIEW_REQUIRED:CONTACTABILITY_EXCEPTION": "Contact issues",
  "FODE:REVIEW_REQUIRED:ENROLMENT_COMPLETION": "Ready for acceptance / classroom handoff",
  "FODE:COOLING_OFF": "Recently contacted / cooling off",
  "FODE:COMPLETE": "Completed / no action",
  "FODE:CLASSIFICATION_REQUIRED": "Classification required"
};

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

function normaliseLabel(value) {
  return titleCase(value).replace(/\bFode\b/g, "FODE");
}

function packageIdFor(row) {
  const actionability = String(row.actionabilityState || "CLASSIFICATION_REQUIRED").toUpperCase();
  const worklistKey = String(row.worklistKey || "").toUpperCase();
  if (actionability === "COOLING_OFF") return `${PRODUCT}:COOLING_OFF`;
  if (actionability === "COMPLETE") return `${PRODUCT}:COMPLETE`;
  if (!worklistKey && (actionability === "READY" || actionability === "REVIEW_REQUIRED" || actionability === "BLOCKED")) {
    return `${PRODUCT}:CLASSIFICATION_REQUIRED`;
  }
  return `${PRODUCT}:${actionability}:${worklistKey || "NO_WORKLIST"}`;
}

function packageLabel(packageId, rows) {
  if (PACKAGE_LABELS[packageId]) return PACKAGE_LABELS[packageId];
  const first = rows[0] || {};
  const worklist = first.worklistLabel || first.worklistKey || first.recommendedAction || packageId;
  return normaliseLabel(worklist);
}

function primaryLabel(code) {
  const found = PRIMARY_BUCKETS.find((bucket) => bucket.code === code);
  return found ? found.label : normaliseLabel(code);
}

function ownerDomain(row) {
  return row.routeLabel || row.workloadGroupKey || row.actionOwner || "Authority";
}

function mapApplicant(row, packageId, label) {
  const lifecycle = row.lifecycleBaseState || row.lifecycleStage || "";
  const actionability = row.actionabilityState || "CLASSIFICATION_REQUIRED";
  const due = row.lastRelevantDate || row.coolingOffUntil || row.nextActionDate || "";
  return {
    applicantId: row.applicantId || "",
    rowNumber: row.rowNumber || "",
    name: row.name || row.displayName || "",
    phone: row.phone || "",
    email: row.effectiveEmail || row.email || "",
    lifecycle,
    lifecycleLabel: normaliseLabel(lifecycle),
    actionability,
    actionabilityLabel: primaryLabel(actionability),
    workPackageId: packageId,
    workPackageLabel: label,
    reasonCode: row.financeReasonCode || row.reasonCode || row.actionabilityState || "",
    primaryReason: row.worklistReason || row.lifecycleReason || row.financeReason || row.urgencyReason || "",
    recommendedAction: row.nextAction || row.recommendedAction || "",
    recommendedActionLabel: normaliseLabel(row.nextAction || row.recommendedAction || ""),
    recommendedMessageType: row.recommendedMessageType || "",
    actionOwner: row.actionOwner || "",
    operatorOwner: ownerDomain(row),
    contactabilityState: row.contactabilityState || "",
    documentState: row.documentState || "",
    financeState: row.financeState || row.canonicalFinanceState || "",
    nextActionDate: due,
    urgencyLevel: row.urgencyLevel || "",
    selectionEligible: row.selectable !== false,
    selectionBlockReason: row.selectBlockReason || "",
    searchIndex: row.searchIndex || "",
    trace: {
      routeKey: row.routeKey || "",
      routeLabel: row.routeLabel || "",
      worklistKey: row.worklistKey || "",
      workloadGroupKey: row.workloadGroupKey || "",
      actionabilityState: row.actionabilityState || "",
      lifecycleStage: row.lifecycleStage || "",
      lifecycleBaseState: row.lifecycleBaseState || "",
      diagnostics: row.diagnostics || {}
    }
  };
}

function buildPackages(rows) {
  const byId = new Map();
  for (const row of rows) {
    const packageId = packageIdFor(row);
    if (!byId.has(packageId)) byId.set(packageId, []);
    byId.get(packageId).push(row);
  }
  return Array.from(byId.entries()).map(([packageId, packageRows]) => {
    const first = packageRows[0] || {};
    const label = packageLabel(packageId, packageRows);
    const applicants = packageRows.map((row) => mapApplicant(row, packageId, label));
    return {
      packageId,
      primaryActionability: first.actionabilityState || "CLASSIFICATION_REQUIRED",
      primaryLabel: primaryLabel(first.actionabilityState || "CLASSIFICATION_REQUIRED"),
      displayLabel: label,
      count: applicants.length,
      recommendedAction: first.nextAction || first.recommendedAction || "",
      recommendedActionLabel: normaliseLabel(first.nextAction || first.recommendedAction || ""),
      recommendedMessageType: first.recommendedMessageType || "",
      authority: ownerDomain(first),
      worklistKey: first.worklistKey || "",
      worklistLabel: first.worklistLabel || "",
      routeReason: first.worklistReason || first.lifecycleReason || first.financeReason || "",
      applicants
    };
  }).sort((a, b) => {
    if (a.primaryActionability !== b.primaryActionability) return a.primaryActionability.localeCompare(b.primaryActionability);
    return b.count - a.count || a.displayLabel.localeCompare(b.displayLabel);
  });
}

function buildPrimaryBuckets(rows, packages, actionabilityCounts) {
  const countByCode = Object.assign({}, actionabilityCounts || {});
  for (const row of rows) {
    const code = row.actionabilityState || "CLASSIFICATION_REQUIRED";
    if (countByCode[code] == null) countByCode[code] = 0;
  }
  return PRIMARY_BUCKETS.map((bucket) => {
    const packageList = packages.filter((pkg) => pkg.primaryActionability === bucket.code);
    return {
      code: bucket.code,
      label: bucket.label,
      count: Number(countByCode[bucket.code] || 0),
      packages: packageList.map((pkg) => ({
        packageId: pkg.packageId,
        label: pkg.displayLabel,
        count: pkg.count,
        authority: pkg.authority,
        recommendedAction: pkg.recommendedAction,
        recommendedMessageType: pkg.recommendedMessageType
      }))
    };
  });
}

function buildSnapshot(input) {
  const routeSnapshot = input.routeSnapshot || {};
  const workload = input.workload || {};
  const profile = input.profile || {};
  const finalVerdict = input.finalVerdict || {};
  const waffiProbe = input.waffiProbe || {};
  const rows = Array.isArray(routeSnapshot.rows) ? routeSnapshot.rows : [];
  const packages = buildPackages(rows);
  const primaryBuckets = buildPrimaryBuckets(rows, packages, workload.actionabilityCounts || finalVerdict.primaryCounts);
  const applicantCount = rows.length;
  const applicantIds = rows.map((row) => row.applicantId).filter(Boolean);
  const duplicateIds = applicantIds.filter((id, index) => applicantIds.indexOf(id) !== index);
  const unassignedActionable = packages.find((pkg) => pkg.packageId === "FODE:CLASSIFICATION_REQUIRED");
  const waffiPackage = packages.find((pkg) => pkg.applicants.some((row) => row.applicantId === WAFII_ID));
  const snapshot = {
    schemaVersion: SNAPSHOT_SCHEMA,
    product: PRODUCT,
    generatedAt: new Date().toISOString(),
    source: {
      baseline: "R367_ACCEPTED_OWNER_WITH_FINDINGS",
      liveRuntime: workload.runtime ? `${workload.runtime.version || ""} / ${workload.runtime.deployVersion || ""}`.trim() : finalVerdict.adminRuntime || "r365 / 365",
      snapshotId: workload.snapshotId || routeSnapshot.snapshotId || finalVerdict.snapshotId || "",
      snapshotAsOf: workload.snapshotAsOf || routeSnapshot.generatedAt || finalVerdict.snapshotAsOf || "",
      authoritySource: "Read-only EduOps/OpsEdu backend authority projections"
    },
    profile,
    population: {
      authoritativeApplicants: applicantCount,
      distinctApplicantIds: new Set(applicantIds).size,
      duplicates: Array.from(new Set(duplicateIds)),
      blankApplicantIdsIncluded: rows.filter((row) => !row.applicantId).length
    },
    primaryBuckets,
    workPackages: packages,
    packageInventory: packages.map((pkg) => ({
      primaryActionability: pkg.primaryActionability,
      workPackageId: pkg.packageId,
      displayLabel: pkg.displayLabel,
      applicantCount: pkg.count,
      recommendedAction: pkg.recommendedAction,
      recommendedMessageType: pkg.recommendedMessageType,
      authority: pkg.authority
    })),
    duplicateLabelResolution: {
      previousLabel: "Missing documents follow-ups due",
      replacements: {
        "FODE:READY:DOCUMENT_FOLLOW_UP": PACKAGE_LABELS["FODE:READY:DOCUMENT_FOLLOW_UP"],
        "FODE:REVIEW_REQUIRED:DOCUMENT_FOLLOW_UP": PACKAGE_LABELS["FODE:REVIEW_REQUIRED:DOCUMENT_FOLLOW_UP"]
      }
    },
    waffi: {
      applicantId: WAFII_ID,
      packageId: waffiPackage ? waffiPackage.packageId : "",
      packageLabel: waffiPackage ? waffiPackage.displayLabel : "",
      applicant: waffiPackage ? waffiPackage.applicants.find((row) => row.applicantId === WAFII_ID) : null,
      workbench: waffiProbe.wb || null
    },
    validation: {
      noUnassignedActionableApplicant: !unassignedActionable || unassignedActionable.count === 0,
      routeRowCount: rows.length,
      packageTotal: packages.reduce((sum, pkg) => sum + pkg.count, 0)
    }
  };
  return snapshot;
}

function buildSnapshotFromEvidence(repoRoot) {
  const evidenceRoot = path.join(repoRoot, ".release-proof", "r367-readonly-bucket-reconciliation");
  return buildSnapshot({
    routeSnapshot: readJson(path.join(evidenceRoot, "operational-route-snapshot-live.json")),
    workload: readJson(path.join(evidenceRoot, "eduops-workload-all-live.json")),
    profile: fs.existsSync(path.join(evidenceRoot, "eduops-profile-live.json")) ? readJson(path.join(evidenceRoot, "eduops-profile-live.json")) : {},
    finalVerdict: readJson(path.join(evidenceRoot, "final-verdict.json")),
    waffiProbe: fs.existsSync(path.join(evidenceRoot, "waffi-detail-probe.json")) ? readJson(path.join(evidenceRoot, "waffi-detail-probe.json")) : {}
  });
}

function writeSnapshotFiles(snapshot, previewRoot) {
  const currentDir = path.join(previewRoot, "snapshots", "current");
  fs.mkdirSync(currentDir, { recursive: true });
  fs.writeFileSync(path.join(currentDir, "snapshot.json"), JSON.stringify(snapshot, null, 2));
  return path.join(currentDir, "snapshot.json");
}

module.exports = {
  SNAPSHOT_SCHEMA,
  WAFII_ID,
  buildSnapshot,
  buildSnapshotFromEvidence,
  writeSnapshotFiles
};
