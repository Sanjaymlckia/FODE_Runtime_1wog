const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { start } = require("../server/server");
const previewData = require("../server/preview-data");

const playwrightModule = process.env.FODE_PLAYWRIGHT_MODULE || "F:/Playwright/fode-secure-link-diagnostic/node_modules/playwright";
const { chromium } = require(playwrightModule);

const viewports = [
  { width: 1920, height: 1080 },
  { width: 1440, height: 900 },
  { width: 1366, height: 768 }
];

async function waitComplete(page) {
  await page.waitForFunction(() => document.querySelector("#eduopsRequestStatus")?.getAttribute("data-state") === "COMPLETE", null, { timeout: 14000 });
}

async function setScenario(page, scenario, latency = "0") {
  await page.selectOption("#eduopsPreviewLatency", latency);
  await page.selectOption("#eduopsPreviewScenario", scenario);
  await waitComplete(page);
}

async function activeScope(page) {
  return page.locator("[data-scope].active").first().getAttribute("data-scope");
}

async function assertNoOverflow(page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
  assert.equal(overflow, false, "page-level horizontal overflow must not occur");
}

function createTestSnapshot() {
  const dir = path.join(__dirname, "..", "local-snapshots", "browser-test-snapshot");
  fs.mkdirSync(dir, { recursive: true });
  const ready = previewData.handleRpc("eduops_queryOperationalWorkload", { scenarioId: "normal-authoritative", serverDurationMs: 0 }, { actionabilityState: "READY", page: 1, pageSize: 50 }, path.resolve(__dirname, "..", "..", ".."));
  const review = previewData.handleRpc("eduops_queryOperationalWorkload", { scenarioId: "normal-authoritative", serverDurationMs: 0 }, { actionabilityState: "REVIEW_REQUIRED", page: 1, pageSize: 50 }, path.resolve(__dirname, "..", "..", ".."));
  const complete = previewData.handleRpc("eduops_queryOperationalWorkload", { scenarioId: "normal-authoritative", serverDurationMs: 0 }, { actionabilityState: "COMPLETE", page: 1, pageSize: 50 }, path.resolve(__dirname, "..", "..", ".."));
  const rows = [
    ready.rows.find((row) => row.applicantId === "FODE-26-002985"),
    review.rows.find((row) => row.applicantId === "FODE-26-002959"),
    complete.rows.find((row) => row.applicantId === "FODE-26-TEST-004")
  ].filter(Boolean);
  const exactApplicants = {};
  for (const row of rows) {
    const wb = previewData.handleRpc("eduops_getApplicantWorkbench", { scenarioId: "normal-authoritative", serverDurationMs: 0 }, { applicantId: row.applicantId, expectedSnapshotId: previewData.SNAPSHOT_ID }, path.resolve(__dirname, "..", "..", ".."));
    const manifest = previewData.handleRpc("eduops_getDocumentManifest", { scenarioId: "normal-authoritative", serverDurationMs: 0 }, { applicantId: row.applicantId, rowNumber: wb.identity.rowNumber }, path.resolve(__dirname, "..", "..", ".."));
    exactApplicants[row.applicantId] = { workbench: wb, documentManifest: manifest, documentRenditions: {} };
  }
  const counts = rows.reduce((out, row) => {
    out[row.actionabilityState] = Number(out[row.actionabilityState] || 0) + 1;
    return out;
  }, {});
  const snapshot = {
    metadata: {
      snapshotFormatVersion: previewData.SNAPSHOT_FORMAT_VERSION,
      contractVersion: previewData.CONTRACT_VERSION,
      profileVersion: previewData.PROFILE_VERSION,
      runtimeIdentity: "r352 / 352",
      sourceCommit: "browser-test",
      sourceDeploymentVersion: "preview",
      capturedAt: "2026-07-13T08:00:00.000Z",
      sourceAsOf: "2026-07-13T08:00:00.000Z",
      sourceReliability: "AUTHORITATIVE",
      sanitisationVersion: previewData.SANITISATION_VERSION,
      snapshotId: "FODE-BROWSER-TEST-SNAPSHOT",
      populationCount: rows.length
    },
    counts: { actionabilityCounts: counts, worklistKeyCounts: { DOCUMENT_REVIEW: 2, PAYMENT_VERIFIED: 1 } },
    workloads: { default: { rows, actionabilityCounts: counts } },
    exactApplicants,
    reconciliation: { integrityState: "PASS", canonicalPopulation: rows.length, hiddenReasons: [], snapshotId: "FODE-BROWSER-TEST-SNAPSHOT" },
    paritySummary: { ok: true, readOnly: true, product: "FODE", snapshotId: "FODE-BROWSER-TEST-SNAPSHOT", reliabilityState: "AUTHORITATIVE" }
  };
  fs.writeFileSync(path.join(dir, "snapshot.json"), JSON.stringify(snapshot, null, 2));
}

(async () => {
  createTestSnapshot();
  const service = await start(0);
  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];
  const pageErrors = [];

  for (const viewport of viewports) {
    const page = await browser.newPage({ viewport });
    await page.addInitScript(() => { window.EDUOPS_REQUEST_TIMEOUT_MS = 7000; });
    page.on("console", (msg) => {
      if (msg.type() === "error") consoleErrors.push(msg.text());
    });
    page.on("pageerror", (err) => pageErrors.push(err.message));
    const externalRequests = [];
    page.on("request", (req) => {
      const url = req.url();
      if (!url.startsWith(service.url) && !url.startsWith("data:") && !url.startsWith("about:")) externalRequests.push(url);
    });
    await page.goto(service.url, { waitUntil: "domcontentloaded" });
    await waitComplete(page);
    await assertNoOverflow(page);
    assert.match(await page.locator("#eduopsPreviewLab").innerText(), /SIMULATED DATA - NO LIVE OPERATIONS/);
    assert.match(await page.locator("#eduopsPreviewModeBanner").innerText(), /DETERMINISTIC SCENARIO DATA/);
    assert.match(await page.locator("#eduopsPreviewModeBanner").innerText(), /NOT CURRENT FODE DATA/);
    assert.equal(externalRequests.length, 0, "normal preview startup must not contact external/live services");
    assert.equal(await page.locator("#eduopsStateNav [data-state]").count(), 8, "left rail must be the primary Actionability navigation");
    assert.equal(await page.locator("#eduopsKpis [data-state]").count(), 0, "KPI row must not duplicate Actionability controls");
    assert.equal(await page.locator("#eduopsOpenParity").count(), 1, "parity diagnostics must remain available");
    assert.equal(await page.locator(".eduops-rail #eduopsOpenParity").count(), 0, "parity diagnostics must not be in the normal rail");

    await page.locator('[data-scope="ESCALATED"]').click();
    await waitComplete(page);
    await page.locator('[data-state="COOLING_OFF"]').click();
    await waitComplete(page);
    assert.equal(await activeScope(page), "ALL_AUTHORISED", "unpinned Actionability change must reset ownership scope");

    await page.locator("#eduopsPinScope").check();
    await page.locator('[data-scope="ESCALATED"]').click();
    await waitComplete(page);
    await page.locator('[data-state="COOLING_OFF"]').click();
    await waitComplete(page);
    assert.equal(await activeScope(page), "ESCALATED", "pinned ownership scope must persist");
    assert.match(await page.locator("#eduopsWorkloadMeta").innerText(), /Cooling Off: 12 total \/ Escalated: 0 matched/);

    await page.locator("#eduopsPinScope").uncheck();
    await page.selectOption("#eduopsPageSize", "10");
    await waitComplete(page);
    await page.locator('[data-state="READY"]').click();
    await waitComplete(page);
    await page.selectOption("#eduopsPreviewScenario", "slow-6s");
    await waitComplete(page);
    await page.locator("#eduopsNextPage").click();
    await page.waitForTimeout(100);
    assert.match(await page.locator("#eduopsPageMeta").innerText(), /Loading page|Queued page/);
    assert.match(await page.locator("#eduopsRequestStatus").innerText(), /Ready Now|Cooling Off|page/);
    await page.selectOption("#eduopsPreviewLatency", "0");
    await page.selectOption("#eduopsPreviewScenario", "normal-authoritative");
    await waitComplete(page);

    await page.selectOption("#eduopsPreviewLatency", "-1");
    await page.selectOption("#eduopsPreviewScenario", "rapid-supersession");
    await page.locator('[data-state="READY"]').click();
    await page.locator('[data-state="COMPLETE"]').click();
    await page.locator('[data-state="REVIEW_REQUIRED"]').click();
    await waitComplete(page);
    assert.match(await page.locator("#eduopsWorkloadTitle").innerText(), /Review Required/);
    const diagnostics = await page.evaluate(() => window.__EDUOPS_REQUEST_DIAGNOSTICS__);
    assert.ok(diagnostics.some((item) => item.outcome === "DISCARDED_SUPERSEDED"), "superseded response must be recorded");

    await page.selectOption("#eduopsPreviewLatency", "-1");
    await waitComplete(page);
    await page.selectOption("#eduopsPreviewScenario", "timeout-10s");
    await page.waitForFunction(() => document.querySelector("#eduopsRequestStatus")?.getAttribute("data-state") === "ERROR", null, { timeout: 9000 });
    assert.match(await page.locator("#eduopsRows").innerText(), /timed out/i);
    await page.selectOption("#eduopsPreviewLatency", "0");
    await page.locator("[data-retry-workload]").click();
    await waitComplete(page);

    await page.fill("#eduopsGlobalSearch", "Waffi");
    await page.waitForFunction(() => document.querySelector("#eduopsGlobalResults")?.textContent.includes("Keziah Waffi"));
    await page.locator('[data-open-applicant="FODE-26-002959"]').first().click();
    await page.waitForSelector("#eduopsWorkbench:not([hidden])");
    assert.match(await page.locator("#eduopsWorkbenchTitle").innerText(), /Keziah Waffi/);
    await page.locator('[data-tab="documents"]').click();
    await page.locator("[data-load-document-manifest]").click();
    await page.waitForSelector("[data-document-rendition]");
    await page.locator("[data-document-rendition]").click();
    await page.waitForSelector(".eduops-png-preview img");
    const src = await page.locator(".eduops-png-preview img").getAttribute("src");
    assert.match(src || "", /^data:image\/png;base64,/);
    await page.locator("[data-document-open]").click();
    await page.waitForFunction(() => document.querySelector("[data-document-preview]")?.textContent.includes("Open Original action prepared"));
    await page.goBack();
    await page.waitForFunction(() => document.querySelector("#eduopsWorkbench")?.hidden === true);

    await page.locator("#eduopsOpenReconciliation").click();
    await page.waitForSelector("#eduopsDrawer:not([hidden])");
    assert.match(await page.locator("#eduopsDrawerTitle").innerText(), /reconciliation/i);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector("#eduopsDrawer")?.hidden === true);
    await page.locator("summary").filter({ hasText: "Technical authority diagnostics" }).click();
    await page.locator("#eduopsOpenParity").click();
    await page.waitForSelector("#eduopsDrawer:not([hidden])");
    assert.match(await page.locator("#eduopsDrawerTitle").innerText(), /parity/i);
    await page.keyboard.press("Escape");
    await page.waitForFunction(() => document.querySelector("#eduopsDrawer")?.hidden === true);

    await page.selectOption("#eduopsPreviewSnapshot", "browser-test-snapshot");
    await page.selectOption("#eduopsPreviewDataMode", "snapshot");
    await waitComplete(page);
    const bannerText = await page.locator("#eduopsPreviewModeBanner").innerText();
    assert.match(bannerText, /FODE SNAPSHOT MODE/);
    assert.match(bannerText, /CURRENT AS OF CAPTURE TIME/);
    assert.match(bannerText, /Runtime: r352 \/ 352/);
    assert.match(bannerText, /Contract: EDUOPS_SHADOW_V1/);
    assert.match(bannerText, /SNAPSHOT MAY BE OUT OF DATE/);
    assert.doesNotMatch(bannerText, /LIVE DATA/);
    await page.fill("#eduopsGlobalSearch", "Waffi");
    await page.waitForFunction(() => document.querySelector("#eduopsGlobalResults")?.textContent.includes("Keziah Waffi"));
    await page.locator('[data-open-applicant="FODE-26-002959"]').first().click();
    await page.waitForSelector("#eduopsWorkbench:not([hidden])");
    assert.match(await page.locator("#eduopsWorkbenchTitle").innerText(), /Keziah Waffi/);
    await page.locator("#eduopsCloseWorkbench").click();
    await page.selectOption("#eduopsPreviewDataMode", "deterministic");
    await waitComplete(page);
    assert.match(await page.locator("#eduopsPreviewModeBanner").innerText(), /DETERMINISTIC SCENARIO DATA/);

    for (const lens of ["finance", "communications", "portal", "contactability"]) {
      await page.locator(`[data-lens="${lens}"]`).click();
      await page.waitForSelector("#eduopsLensPanel:not([hidden])");
      assert.match(await page.locator("#eduopsLensPanel").innerText(), new RegExp(lens, "i"));
    }

    await assertNoOverflow(page);
    await page.close();
  }

  assert.deepEqual(consoleErrors, [], "console errors must be zero");
  assert.deepEqual(pageErrors, [], "page errors must be zero");
  await browser.close();
  service.server.close();
  console.log(`PASS EduOps Preview Lab browser tests behaviours=24 viewports=${viewports.length} url=${service.url}`);
})().catch((err) => {
  console.error(err.stack || err);
  process.exit(1);
});
