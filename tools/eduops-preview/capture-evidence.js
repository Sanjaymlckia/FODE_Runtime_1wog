const fs = require("node:fs");
const path = require("node:path");
const { start } = require("./server/server");

const playwrightModule = process.env.FODE_PLAYWRIGHT_MODULE || "F:/Playwright/fode-secure-link-diagnostic/node_modules/playwright";
const { chromium } = require(playwrightModule);

const viewports = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 }
];

const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const evidenceRoot = path.join(__dirname, "evidence", runId);
const summary = {
  runId,
  createdAt: new Date().toISOString(),
  viewports,
  screenshots: [],
  consoleErrors: [],
  pageErrors: [],
  overflow: [],
  timings: [],
  pngIntegrity: []
};

function createEvidenceSnapshot() {
  const previewData = require("./server/preview-data");
  const dir = path.join(__dirname, "local-snapshots", "evidence-snapshot");
  fs.mkdirSync(dir, { recursive: true });
  const repoRoot = path.resolve(__dirname, "..", "..");
  const ready = previewData.handleRpc("eduops_queryOperationalWorkload", { scenarioId: "normal-authoritative", serverDurationMs: 0 }, { actionabilityState: "READY", page: 1, pageSize: 50 }, repoRoot);
  const review = previewData.handleRpc("eduops_queryOperationalWorkload", { scenarioId: "normal-authoritative", serverDurationMs: 0 }, { actionabilityState: "REVIEW_REQUIRED", page: 1, pageSize: 50 }, repoRoot);
  const complete = previewData.handleRpc("eduops_queryOperationalWorkload", { scenarioId: "normal-authoritative", serverDurationMs: 0 }, { actionabilityState: "COMPLETE", page: 1, pageSize: 50 }, repoRoot);
  const rows = [
    ready.rows.find((row) => row.applicantId === "FODE-26-002985"),
    review.rows.find((row) => row.applicantId === "FODE-26-002959"),
    complete.rows.find((row) => row.applicantId === "FODE-26-TEST-004")
  ].filter(Boolean);
  const exactApplicants = {};
  for (const row of rows) {
    const wb = previewData.handleRpc("eduops_getApplicantWorkbench", { scenarioId: "normal-authoritative", serverDurationMs: 0 }, { applicantId: row.applicantId, expectedSnapshotId: previewData.SNAPSHOT_ID }, repoRoot);
    const manifest = previewData.handleRpc("eduops_getDocumentManifest", { scenarioId: "normal-authoritative", serverDurationMs: 0 }, { applicantId: row.applicantId, rowNumber: wb.identity.rowNumber }, repoRoot);
    exactApplicants[row.applicantId] = { workbench: wb, documentManifest: manifest, documentRenditions: {} };
  }
  const counts = rows.reduce((out, row) => {
    out[row.actionabilityState] = Number(out[row.actionabilityState] || 0) + 1;
    return out;
  }, {});
  fs.writeFileSync(path.join(dir, "snapshot.json"), JSON.stringify({
    metadata: {
      snapshotFormatVersion: previewData.SNAPSHOT_FORMAT_VERSION,
      contractVersion: previewData.CONTRACT_VERSION,
      profileVersion: previewData.PROFILE_VERSION,
      runtimeIdentity: "r352 / 352",
      sourceCommit: "evidence",
      sourceDeploymentVersion: "preview",
      capturedAt: "2026-07-13T08:00:00.000Z",
      sourceAsOf: "2026-07-13T08:00:00.000Z",
      sourceReliability: "AUTHORITATIVE",
      sanitisationVersion: previewData.SANITISATION_VERSION,
      snapshotId: "FODE-EVIDENCE-SNAPSHOT",
      populationCount: rows.length
    },
    counts: { actionabilityCounts: counts, worklistKeyCounts: { DOCUMENT_REVIEW: 2, PAYMENT_VERIFIED: 1 } },
    workloads: { default: { rows, actionabilityCounts: counts } },
    exactApplicants,
    reconciliation: { integrityState: "PASS", canonicalPopulation: rows.length, hiddenReasons: [], snapshotId: "FODE-EVIDENCE-SNAPSHOT" },
    paritySummary: { ok: true, readOnly: true, product: "FODE", snapshotId: "FODE-EVIDENCE-SNAPSHOT", reliabilityState: "AUTHORITATIVE" }
  }, null, 2));
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

async function waitComplete(page) {
  await page.waitForFunction(() => document.querySelector("#eduopsRequestStatus")?.getAttribute("data-state") === "COMPLETE", null, { timeout: 9000 });
}

async function setScenario(page, scenario, latency = "0") {
  await page.selectOption("#eduopsPreviewLatency", latency);
  await page.selectOption("#eduopsPreviewScenario", scenario);
  await waitComplete(page);
}

async function screenshot(page, viewportDir, name) {
  const file = path.join(viewportDir, `${String(summary.screenshots.length + 1).padStart(2, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: true });
  summary.screenshots.push(file);
  return file;
}

async function openWaffiWorkbench(page) {
  await page.fill("#eduopsGlobalSearch", "Waffi");
  await page.waitForFunction(() => document.querySelector("#eduopsGlobalResults")?.textContent.includes("Keziah Waffi"));
  await page.locator('[data-open-applicant="FODE-26-002959"]').first().click();
  await page.waitForSelector("#eduopsWorkbench:not([hidden])");
}

async function captureViewport(browser, serviceUrl, viewport) {
  const viewportDir = path.join(evidenceRoot, `${viewport.width}x${viewport.height}`);
  ensureDir(viewportDir);
  const page = await browser.newPage({ viewport });
  await page.addInitScript(() => { window.EDUOPS_REQUEST_TIMEOUT_MS = 7000; });
  page.on("console", (msg) => {
    if (msg.type() === "error") summary.consoleErrors.push({ viewport, text: msg.text() });
  });
  page.on("pageerror", (err) => summary.pageErrors.push({ viewport, text: err.message }));
  await page.goto(serviceUrl, { waitUntil: "domcontentloaded" });
  await waitComplete(page);
  await screenshot(page, viewportDir, "normal-ready-workload");
  await screenshot(page, viewportDir, "deterministic-mode-labelling");

  await page.locator('[data-scope="ESCALATED"]').click();
  await waitComplete(page);
  await page.locator('[data-state="COOLING_OFF"]').click();
  await waitComplete(page);
  await screenshot(page, viewportDir, "ownership-reset-unpinned");

  await page.locator("#eduopsPinScope").check();
  await page.locator('[data-scope="ESCALATED"]').click();
  await waitComplete(page);
  await page.locator('[data-state="COOLING_OFF"]').click();
  await waitComplete(page);
  await screenshot(page, viewportDir, "pinned-empty-escalated-scope");

  await page.locator("#eduopsPinScope").uncheck();
  await page.selectOption("#eduopsPageSize", "10");
  await waitComplete(page);
  await page.locator('[data-state="READY"]').click();
  await waitComplete(page);
  await page.selectOption("#eduopsPreviewLatency", "-1");
  await page.selectOption("#eduopsPreviewScenario", "slow-6s");
  await waitComplete(page);
  await page.locator("#eduopsNextPage").click();
  await page.waitForTimeout(150);
  await screenshot(page, viewportDir, "six-second-loading-state");

  await page.selectOption("#eduopsPreviewLatency", "0");
  await page.selectOption("#eduopsPreviewScenario", "normal-authoritative");
  await waitComplete(page);
  await page.selectOption("#eduopsPreviewLatency", "-1");
  await page.selectOption("#eduopsPreviewScenario", "timeout-10s");
  await page.locator('[data-state="READY"]').click();
  await page.waitForFunction(() => document.querySelector("#eduopsRequestStatus")?.getAttribute("data-state") === "ERROR", null, { timeout: 9000 });
  await screenshot(page, viewportDir, "timeout-retry-state");
  await page.selectOption("#eduopsPreviewLatency", "0");
  await page.locator("[data-retry-workload]").click();
  await waitComplete(page);

  await setScenario(page, "rapid-supersession", "-1");
  await page.locator('[data-state="READY"]').click();
  await page.locator('[data-state="COMPLETE"]').click();
  await page.locator('[data-state="REVIEW_REQUIRED"]').click();
  await waitComplete(page);
  await screenshot(page, viewportDir, "superseded-request-latest-rendered");

  await setScenario(page, "normal-authoritative", "0");
  await page.fill("#eduopsGlobalSearch", "Jackson");
  await page.waitForFunction(() => document.querySelector("#eduopsGlobalResults")?.textContent.includes("Jackson Numa"));
  await screenshot(page, viewportDir, "search-jackson");

  await openWaffiWorkbench(page);
  await screenshot(page, viewportDir, "exact-waffi-workbench");
  await page.goBack();
  await page.waitForFunction(() => document.querySelector("#eduopsWorkbench")?.hidden === true);
  await screenshot(page, viewportDir, "browser-back-workload-return");

  await openWaffiWorkbench(page);
  await page.locator('[data-tab="documents"]').click();
  await page.locator("[data-load-document-manifest]").click();
  await page.waitForSelector("[data-document-rendition]");
  await page.locator("[data-document-rendition]").click();
  await page.waitForSelector(".eduops-png-preview img");
  await screenshot(page, viewportDir, "document-png-rendition");
  await page.locator("#eduopsCloseWorkbench").click();

  await setScenario(page, "document-preview-unavailable", "0");
  await openWaffiWorkbench(page);
  await page.locator('[data-tab="documents"]').click();
  await page.locator("[data-load-document-manifest]").click();
  await page.waitForSelector("[data-document-rendition]");
  await page.locator("[data-document-rendition]").click();
  await page.waitForFunction(() => document.querySelector("[data-document-preview]")?.textContent.includes("PNG preview unavailable"));
  await screenshot(page, viewportDir, "document-preview-unavailable");
  await page.locator("#eduopsCloseWorkbench").click();

  await setScenario(page, "conflicting-authority", "0");
  await screenshot(page, viewportDir, "conflicting-authority");

  await setScenario(page, "normal-authoritative", "0");
  for (const lens of ["finance", "communications", "portal", "contactability"]) {
    await page.locator(`[data-lens="${lens}"]`).click();
    await page.waitForSelector("#eduopsLensPanel:not([hidden])");
    await screenshot(page, viewportDir, `${lens}-lens`);
  }

  await page.locator("summary").filter({ hasText: "Technical authority diagnostics" }).click();
  await page.locator("#eduopsOpenParity").click();
  await page.waitForSelector("#eduopsDrawer:not([hidden])");
  await screenshot(page, viewportDir, "relocated-parity-diagnostics");
  await page.keyboard.press("Escape");
  await page.waitForFunction(() => document.querySelector("#eduopsDrawer")?.hidden === true);

  await page.selectOption("#eduopsPreviewSnapshot", "evidence-snapshot");
  await page.selectOption("#eduopsPreviewDataMode", "snapshot");
  await waitComplete(page);
  await screenshot(page, viewportDir, "fresh-snapshot-mode-metadata");
  await page.selectOption("#eduopsPreviewDataMode", "deterministic");
  await waitComplete(page);

  await screenshot(page, viewportDir, "corrected-actionability-navigation");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  summary.overflow.push({ viewport, overflow });
  summary.timings.push(await page.evaluate(() => ({
    clientDiagnostics: window.__EDUOPS_REQUEST_DIAGNOSTICS__ || [],
    previewText: document.querySelector("#eduopsPreviewDiagnostics")?.textContent || ""
  })));
  await page.close();
}

function validatePng(file) {
  const signature = fs.readFileSync(file).subarray(0, 8).toString("hex");
  return signature === "89504e470d0a1a0a";
}

(async () => {
  createEvidenceSnapshot();
  ensureDir(evidenceRoot);
  const service = await start(0);
  const browser = await chromium.launch({ headless: true });
  for (const viewport of viewports) {
    await captureViewport(browser, service.url, viewport);
  }
  await browser.close();
  service.server.close();
  summary.pngIntegrity = summary.screenshots.map((file) => ({ file, ok: validatePng(file) }));
  fs.writeFileSync(path.join(evidenceRoot, "RUN_SUMMARY.json"), JSON.stringify(summary, null, 2));
  const failedPng = summary.pngIntegrity.filter((item) => !item.ok);
  if (failedPng.length) throw new Error(`PNG integrity failed for ${failedPng.length} screenshot(s)`);
  if (summary.consoleErrors.length || summary.pageErrors.length) throw new Error("Console or page errors captured");
  if (summary.overflow.some((item) => item.overflow)) throw new Error("Horizontal overflow captured");
  console.log(`PASS EduOps Preview Lab evidence screenshots=${summary.screenshots.length} path=${evidenceRoot}`);
})().catch((err) => {
  console.error(err.stack || err);
  process.exit(1);
});
