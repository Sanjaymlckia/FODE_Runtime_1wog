const fs = require("node:fs");
const path = require("node:path");
const crypto = require("node:crypto");
const { CONTRACT_VERSION, PROFILE_VERSION, SNAPSHOT_FORMAT_VERSION, SANITISATION_VERSION } = require("./preview-data");
const {
  createAuthRequiredError,
  detectAuthRequirement,
  launchAdminContext,
  closeAdminContext
} = require("../../auth-fode-admin-playwright");

const previewRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(previewRoot, "..", "..");
const generatedSnapshotRoot = path.join(previewRoot, "evidence", "generated", "snapshots");
const defaultAdminUrl = "https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec?view=eduops";

const RPC_ALLOWLIST = [
  "eduops_getAccessProjection",
  "eduops_getProfile",
  "eduops_queryOperationalWorkload",
  "eduops_searchApplicants",
  "eduops_getApplicantWorkbench",
  "eduops_getDocumentManifest",
  "eduops_getDocumentRendition",
  "eduops_getDocumentFileAction",
  "eduops_getReconciliation",
  "eduops_getParityDiagnostics"
];

const FIXTURES = [
  { applicantId: "FODE-26-002985", name: "Jackson Numa" },
  { applicantId: "FODE-26-002959", name: "Keziah Waffi" },
  { applicantId: "FODE-26-TEST-004", name: "TEST_COMM_D Payment Verified" }
];

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv) {
  const out = { _: [] };
  for (let index = 0; index < argv.length; index += 1) {
    const item = argv[index];
    if (item === "--help" || item === "-h" || item === "/?") out.help = true;
    else if (item === "--dry-run") out.dryRun = true;
    else if (item === "--url") out.url = argv[++index] || "";
    else if (item === "--output-root") out.outputRoot = argv[++index] || "";
    else if (item.startsWith("--")) out[item.slice(2)] = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : "true";
    else out._.push(item);
  }
  return out;
}

function usage() {
  return [
    "Usage: node server/capture-fresh-snapshot.js [--url <admin-staging-url>] [--output-root <generated-dir>] [--dry-run]",
    "",
    "Captures authorised Admin staging read-only EduOps DTOs into evidence/generated/snapshots/.",
    "The command refuses Student, Production, OPS, and non-eduops routes."
  ].join("\n");
}

function captureOptions(argv) {
  const args = parseArgs(argv);
  const captureUrl = process.env.EDUOPS_CAPTURE_URL || args.url || args._[0] || defaultAdminUrl;
  const expectedRuntime = process.env.EDUOPS_EXPECTED_RUNTIME || "r352";
  const expectedDeploy = Number(process.env.EDUOPS_EXPECTED_DEPLOY || 352);
  const outputRoot = path.resolve(args.outputRoot || process.env.EDUOPS_CAPTURE_OUTPUT_DIR || generatedSnapshotRoot);
  const generatedRoot = path.resolve(generatedSnapshotRoot);
  if (outputRoot !== generatedRoot && !outputRoot.startsWith(generatedRoot + path.sep)) {
    fail("Snapshot output must remain under tools/eduops-snapshot-capture/evidence/generated/snapshots.");
  }
  return { args, captureUrl, expectedRuntime, expectedDeploy, outputRoot };
}

function validateCaptureUrl(captureUrl) {
  var captureTarget = new URL(captureUrl);
  var lowerHostPath = (captureTarget.hostname + captureTarget.pathname).toLowerCase();
  var view = String(captureTarget.searchParams.get("view") || "").toLowerCase();
  if (/student|prod|production/.test(lowerHostPath) || view === "ops") {
    fail("Capture URL appears to target a prohibited surface.");
  }
  if (view && view !== "eduops") {
    fail("Capture URL must target the EduOps Admin staging view.");
  }
}

function loadPlaywright() {
  const playwrightModule = process.env.FODE_PLAYWRIGHT_MODULE || "F:/Playwright/fode-secure-link-diagnostic/node_modules/playwright";
  return require(playwrightModule);
}

function stableId(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex").slice(0, 16);
}

async function rpc(page, name, payload) {
  if (!RPC_ALLOWLIST.includes(name)) fail(`RPC is not in capture allowlist: ${name}`);
  return page.evaluate(({ name, payload }) => new Promise((resolve, reject) => {
    if (!window.google || !google.script || !google.script.run) {
      reject(new Error("google.script.run is unavailable"));
      return;
    }
    google.script.run
      .withSuccessHandler(resolve)
      .withFailureHandler((err) => reject(new Error(err && (err.message || err.toString && err.toString()) || String(err))))[name](payload || {});
  }), { name, payload: payload || {} });
}

async function findEduOpsFrame(page) {
  var deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      try {
        const ok = await frame.evaluate(() => !!(document.querySelector("#eduopsApp") && window.google && google.script && google.script.run));
        if (ok) return frame;
      } catch (_err) {}
    }
    await page.waitForTimeout(500);
  }
  const authMessage = await detectAuthRequirement(page);
  if (authMessage) throw createAuthRequiredError(authMessage);
  fail("EduOps Apps Script frame with google.script.run was not found.");
}

function clone(value) {
  return JSON.parse(JSON.stringify(value == null ? null : value));
}

function redactUrls(value, report) {
  if (Array.isArray(value)) return value.map((item) => redactUrls(item, report));
  if (!value || typeof value !== "object") return value;
  const out = {};
  for (const [key, raw] of Object.entries(value)) {
    const lower = key.toLowerCase();
    if (/(url|token|secret|signature|downloadurl|openurl|previewurl)/.test(lower)) {
      if (raw) report.redactedFieldCount += 1;
      out[key] = "";
      continue;
    }
    if (lower === "fileid" || lower === "folderid" || lower === "parentfolderid") {
      if (raw) report.redactedFieldCount += 1;
      out[key] = raw ? `redacted-${stableId(raw)}` : "";
      continue;
    }
    out[key] = redactUrls(raw, report);
  }
  return out;
}

function representativeRendition(applicantId, documentKey) {
  const pngPath = path.join(previewRoot, "fixtures", "document-rendition.png");
  const data = fs.existsSync(pngPath) ? fs.readFileSync(pngPath).toString("base64") : "";
  return {
    ok: true,
    readOnly: true,
    representative: true,
    applicantId,
    documentKey,
    label: "Representative local PNG rendition",
    fileName: "representative-preview-rendition.png",
    sourceMimeType: "image/png",
    renditionMimeType: "image/png",
    renditionKind: "representative-local-png",
    canonicalOriginal: false,
    renditionOnly: true,
    dataUrl: data ? `data:image/png;base64,${data}` : "",
    note: "Representative rendition is not the applicant's real document."
  };
}

function validateSnapshot(snapshot) {
  const errors = [];
  const rows = snapshot.workloads.default.rows || [];
  const ids = new Set();
  for (const row of rows) {
    if (!row.applicantId) errors.push("Workload row missing ApplicantID");
    if (ids.has(row.applicantId)) errors.push(`Duplicate ApplicantID: ${row.applicantId}`);
    ids.add(row.applicantId);
  }
  for (const fixture of FIXTURES) {
    const exact = snapshot.exactApplicants[fixture.applicantId];
    if (!exact) errors.push(`Missing exact fixture: ${fixture.applicantId}`);
    if (exact && exact.workbench && exact.workbench.identity && exact.workbench.identity.applicantId !== fixture.applicantId) {
      errors.push(`Workbench identity mismatch: ${fixture.applicantId}`);
    }
  }
  const counts = {};
  for (const row of rows) counts[row.actionabilityState || "UNKNOWN"] = Number(counts[row.actionabilityState || "UNKNOWN"] || 0) + 1;
  for (const [key, value] of Object.entries(snapshot.counts.actionabilityCounts || {})) {
    if (Number(value || 0) !== Number(counts[key] || 0)) errors.push(`Actionability count mismatch for ${key}: expected ${value}, captured ${counts[key] || 0}`);
  }
  if (snapshot.metadata.sourceReliability !== "AUTHORITATIVE") errors.push(`Unsafe source reliability: ${snapshot.metadata.sourceReliability}`);
  if (errors.length) fail(`Snapshot validation failed:\n${errors.join("\n")}`);
  return { counts, duplicateApplicantIds: 0 };
}

async function capture(options) {
  const { captureUrl, expectedRuntime, expectedDeploy, outputRoot } = options;
  validateCaptureUrl(captureUrl);
  const { chromium } = loadPlaywright();
  const session = await launchAdminContext(chromium, { headless: true });
  try {
    const page = session.context.pages()[0] || await session.context.newPage();
    await page.goto(captureUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    const eduopsFrame = await findEduOpsFrame(page);

    const access = await rpc(eduopsFrame, "eduops_getAccessProjection", {});
    if (!access || access.ok !== true) fail("Access projection failed.");
    if (!access.runtime || access.runtime.version !== expectedRuntime || Number(access.runtime.deployVersion) !== expectedDeploy) {
      fail(`Unexpected runtime identity. Expected ${expectedRuntime} / ${expectedDeploy}; got ${access.runtime && access.runtime.version} / ${access.runtime && access.runtime.deployVersion}`);
    }
    const profile = await rpc(eduopsFrame, "eduops_getProfile", {});
    if (!profile || profile.contractVersion !== CONTRACT_VERSION) fail(`Incompatible contract version: ${profile && profile.contractVersion}`);

    const first = await rpc(eduopsFrame, "eduops_queryOperationalWorkload", { actionabilityState: "READY", workScope: "ALL_AUTHORISED", page: 1, pageSize: 50 });
    if (!first || first.ok !== true) fail("Initial workload capture failed.");
    if (first.reliabilityState !== "AUTHORITATIVE") fail(`Unsafe source reliability: ${first.reliabilityState}`);
    const states = Object.keys(first.actionabilityCounts || {});
    const rowsById = {};
    for (const state of states) {
      const p1 = await rpc(eduopsFrame, "eduops_queryOperationalWorkload", { actionabilityState: state, workScope: "ALL_AUTHORISED", page: 1, pageSize: 50, expectedSnapshotId: first.snapshotId });
      if (!p1 || p1.ok !== true) fail(`Workload capture failed for ${state}`);
      const totalPages = Number(p1.totalPages || 1);
      for (const row of p1.rows || []) rowsById[row.applicantId] = row;
      for (let pageNumber = 2; pageNumber <= totalPages; pageNumber += 1) {
        const pageRes = await rpc(eduopsFrame, "eduops_queryOperationalWorkload", { actionabilityState: state, workScope: "ALL_AUTHORISED", page: pageNumber, pageSize: 50, expectedSnapshotId: first.snapshotId });
        if (!pageRes || pageRes.ok !== true) fail(`Workload capture failed for ${state} page ${pageNumber}`);
        for (const row of pageRes.rows || []) rowsById[row.applicantId] = row;
      }
    }

    const report = {
      sanitisationVersion: SANITISATION_VERSION,
      redactedFieldCount: 0,
      omittedFieldCount: 0,
      capturedDocumentRenditionCount: 0,
      representativeDocumentRenditionCount: 0,
      warnings: []
    };
    const exactApplicants = {};
    for (const fixture of FIXTURES) {
      const search = await rpc(eduopsFrame, "eduops_searchApplicants", { query: fixture.applicantId, limit: 5, expectedSnapshotId: first.snapshotId });
      if (!search || search.ok !== true || !String(JSON.stringify(search)).includes(fixture.applicantId)) fail(`Exact fixture search failed: ${fixture.applicantId}`);
      const workbench = await rpc(eduopsFrame, "eduops_getApplicantWorkbench", { applicantId: fixture.applicantId, expectedSnapshotId: first.snapshotId, returnContext: { actionabilityState: "READY", workScope: "ALL_AUTHORISED", page: 1, pageSize: 50 } });
      if (!workbench || workbench.ok !== true || workbench.identity.applicantId !== fixture.applicantId) fail(`Exact Workbench failed: ${fixture.applicantId}`);
      const manifest = await rpc(eduopsFrame, "eduops_getDocumentManifest", { applicantId: fixture.applicantId, rowNumber: workbench.identity.rowNumber, expectedSnapshotId: first.snapshotId });
      const sanitisedManifest = redactUrls(clone(manifest), report);
      const renditions = {};
      const files = manifest && manifest.files || [];
      for (const file of files.slice(0, 1)) {
        if (!file || !file.documentKey) continue;
        if (process.env.EDUOPS_CAPTURE_DOCUMENT_PNG === "true" && file.renditionEligible) {
          const rendition = await rpc(eduopsFrame, "eduops_getDocumentRendition", { applicantId: fixture.applicantId, rowNumber: workbench.identity.rowNumber, sourceField: file.sourceField, itemIndex: file.itemIndex, documentKey: file.documentKey, expectedSnapshotId: first.snapshotId });
          renditions[file.documentKey] = redactUrls(clone(rendition), report);
          report.capturedDocumentRenditionCount += 1;
        } else {
          renditions[file.documentKey] = representativeRendition(fixture.applicantId, file.documentKey);
          report.representativeDocumentRenditionCount += 1;
        }
      }
      exactApplicants[fixture.applicantId] = {
        search,
        workbench: redactUrls(clone(workbench), report),
        documentManifest: sanitisedManifest,
        documentRenditions: renditions
      };
    }

    const reconciliation = await rpc(eduopsFrame, "eduops_getReconciliation", { actionabilityState: "READY", workScope: "ALL_AUTHORISED", page: 1, pageSize: 50, expectedSnapshotId: first.snapshotId });
    const paritySummary = await rpc(eduopsFrame, "eduops_getParityDiagnostics", { limit: 50, expectedSnapshotId: first.snapshotId });
    if (!paritySummary || paritySummary.ok !== true) fail("Parity diagnostics did not pass.");

    const sourceCommit = require("node:child_process").execSync("git rev-parse HEAD", { cwd: repoRoot, encoding: "utf8" }).trim();
    const capturedAt = new Date().toISOString();
    const rows = Object.values(rowsById).sort((a, b) => String(a.applicantId).localeCompare(String(b.applicantId)));
    const snapshot = {
      metadata: {
        snapshotFormatVersion: SNAPSHOT_FORMAT_VERSION,
        contractVersion: CONTRACT_VERSION,
        profileVersion: PROFILE_VERSION,
        runtimeIdentity: `${access.runtime.version} / ${access.runtime.deployVersion}`,
        sourceCommit,
        sourceDeploymentVersion: process.env.EDUOPS_CAPTURE_APPS_SCRIPT_VERSION || "",
        capturedAt,
        sourceAsOf: first.snapshotAsOf || capturedAt,
        sourceReliability: first.reliabilityState,
        sanitisationVersion: SANITISATION_VERSION,
        snapshotId: first.snapshotId,
        populationCount: rows.length
      },
      accessProjection: redactUrls(clone(access), report),
      profile,
      counts: {
        actionabilityCounts: first.actionabilityCounts || {},
        worklistKeyCounts: first.worklistKeyCounts || {}
      },
      workloads: {
        default: {
          snapshotId: first.snapshotId,
          actionabilityCounts: first.actionabilityCounts || {},
          rows
        }
      },
      reconciliation: redactUrls(clone(reconciliation && reconciliation.reconciliation || first.reconciliation || {}), report),
      exactApplicants,
      paritySummary: redactUrls(clone(paritySummary), report),
      captureSummary: {
        totalApplicantsRepresented: rows.length,
        countsByActionability: first.actionabilityCounts || {},
        reconciliationResult: "PASS",
        duplicateApplicantIds: 0,
        exactFixtureResults: FIXTURES.map((fixture) => ({ applicantId: fixture.applicantId, captured: !!exactApplicants[fixture.applicantId] })),
        omittedRedactedFieldCount: report.redactedFieldCount + report.omittedFieldCount,
        capturedDocumentRenditionCount: report.capturedDocumentRenditionCount,
        representativeDocumentRenditionCount: report.representativeDocumentRenditionCount,
        warnings: report.warnings
      }
    };
    const validation = validateSnapshot(snapshot);
    snapshot.captureSummary.duplicateApplicantIds = validation.duplicateApplicantIds;

    const id = `${capturedAt.replace(/[:.]/g, "-")}-${access.runtime.version}`;
    const outDir = path.join(outputRoot, id);
    fs.mkdirSync(outDir, { recursive: true });
    fs.writeFileSync(path.join(outDir, "snapshot.json"), JSON.stringify(snapshot, null, 2));
    fs.writeFileSync(path.join(outDir, "SANITISATION_REPORT.json"), JSON.stringify(report, null, 2));
    console.log(`PASS Fresh FODE snapshot captured: ${outDir}`);
    console.log(`Runtime: ${snapshot.metadata.runtimeIdentity}`);
    console.log(`Contract: ${snapshot.metadata.contractVersion}`);
    console.log(`Snapshot: ${snapshot.metadata.snapshotId}`);
    console.log(`Represented applicants: ${rows.length}`);
    console.log(`Redacted fields: ${report.redactedFieldCount}`);
  } finally {
    await closeAdminContext(session);
  }
}

async function main() {
  const options = captureOptions(process.argv.slice(2));
  if (options.args.help) {
    console.log(usage());
    return;
  }
  validateCaptureUrl(options.captureUrl);
  if (options.args.dryRun) {
    console.log(JSON.stringify({
      ok: true,
      readOnly: true,
      captureUrl: options.captureUrl,
      expectedRuntime: options.expectedRuntime,
      expectedDeploy: options.expectedDeploy,
      outputRoot: options.outputRoot,
      rpcAllowlist: RPC_ALLOWLIST
    }, null, 2));
    return;
  }
  await capture(options);
}

if (require.main === module) main().catch((err) => {
  if (err && err.code === "AUTH_REQUIRED") {
    console.error(`AUTH_REQUIRED ${err.message || err} dedicatedProfilePath=${err.meta && err.meta.dedicatedProfilePath || ""} storageStatePath=${err.meta && err.meta.storageStatePath || ""}`);
    process.exit(2);
  }
  console.error(`FAIL Fresh FODE snapshot capture: ${err.message || err}`);
  process.exit(1);
});

module.exports = { RPC_ALLOWLIST, captureOptions, validateCaptureUrl, generatedSnapshotRoot };
