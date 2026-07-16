const fs = require("node:fs");
const assert = require("node:assert/strict");
const playwrightModule = process.env.FODE_PLAYWRIGHT_MODULE || "F:/Playwright/fode-secure-link-diagnostic/node_modules/playwright";
const { chromium } = require(playwrightModule);

const counts = { READY: 60, COOLING_OFF: 12, AWAITING_APPLICANT: 22, AWAITING_PAYMENT: 18, REVIEW_REQUIRED: 75, BLOCKED: 8, UNKNOWN: 4, COMPLETE: 1 };
const states = Object.keys(counts);
const clientFiles = ["EduOps_ClientCore.html", "EduOps_ClientComponents.html", "EduOps_ClientWorkbench.html", "EduOps_ClientBatch.html", "EduOps_Client.html"];

function fixtureHtml() {
  let html = fs.readFileSync("EduOps.html", "utf8");
  html = html.replace('<?!= HtmlService.createHtmlOutputFromFile("EduOps_Styles").getContent(); ?>', fs.readFileSync("EduOps_Styles.html", "utf8"));
  const mock = `<script>
    window.EDUOPS_REQUEST_TIMEOUT_MS = 80;
    window.__rpcDelayMs = 5;
    window.__workloadCalls = [];
    window.__makeWorkload = function (payload) {
      var allCounts = ${JSON.stringify(counts)};
      var total = payload.workScope === "ALL_AUTHORISED" ? Number(allCounts[payload.actionabilityState] || 0) : 0;
      var totalPages = Math.max(1, Math.ceil(total / payload.pageSize));
      var page = Math.min(payload.page, totalPages);
      var count = Math.min(payload.pageSize, Math.max(0, total - ((page - 1) * payload.pageSize)));
      var rows = Array.from({ length: count }, function (_unused, index) { var id = "FODE-TEST-" + payload.actionabilityState + "-" + (index + ((page - 1) * payload.pageSize)); return { product: "FODE", rowKey: id, applicantId: id, displayName: "Fixture Applicant " + index, email: "fixture@example.test", actionabilityState: payload.actionabilityState, urgencyLevel: index === 0 ? "CRITICAL" : "NORMAL", worklistKey: "FIXTURE", worklistLabel: "Fixture", actionOwner: "OFFICER", workOwnership: { scope: "MY" }, nextAction: "Review fixture", canonicalFinanceState: "PAYMENT_PENDING", documentState: "REVIEW_REQUIRED", portalState: "SUBMITTED", contactabilityState: "EMAIL_AVAILABLE", selectable: true, sourceReliability: { state: "AUTHORITATIVE" } }; });
      return { ok: true, product: "FODE", snapshotId: "FODE-TEST-SNAPSHOT", snapshotAsOf: "2026-07-15T00:00:00.000Z", reliabilityState: "AUTHORITATIVE", reliabilityReasons: ["Fixture authority"], actionabilityCounts: allCounts, worklistKeyCounts: { FIXTURE: total }, metricCounts: { eligibleNow: total }, reconciliation: { canonicalPopulation: 200, totalMatched: total, hiddenFromCurrentView: 200 - total, eligibleOutsideCurrentWindow: Math.max(0, total - count) }, page: page, pageSize: payload.pageSize, totalMatched: total, totalPages: totalPages, rows: rows, timings: { serverRpcMs: 7, canonicalSnapshotResolutionMs: 2, workloadCompositionMs: 1, sortingPagingMs: 1, responseBytes: 2048 } };
    };
    window.EDUOPS_TRANSPORT = { call: function (name, payload) { return new Promise(function (resolve) { setTimeout(function () { if (name === "eduops_getAccessProjection") return resolve({ ok: true, runtime: { version: "rTEST", deployVersion: 0 }, user: { email: "operator@example.test", role: "ADMIN", capabilities: {} } }); if (name === "eduops_getProfile") return resolve({ ok: true, featureFlags: {} }); if (name === "eduops_queryOperationalWorkload") { window.__workloadCalls.push(JSON.parse(JSON.stringify(payload || {}))); return resolve(window.__makeWorkload(payload || {})); } resolve({ ok: true, matches: [], receipts: [] }); }, name === "eduops_queryOperationalWorkload" ? window.__rpcDelayMs : 0); }); } };
  </script>`;
  clientFiles.forEach(function (file, index) { var include = '<?!= HtmlService.createHtmlOutputFromFile("' + file.replace(/\.html$/, "") + '").getContent(); ?>'; html = html.replace(include, (index === 0 ? mock : "") + fs.readFileSync(file, "utf8")); });
  return html.replace(/<\?= BUILD_VERSION \?>/g, "rTEST").replace(/<\?= BUILD_RENDERED_AT \?>/g, "2026-07-16T00:00:00.000Z").replace(/<\?= USER_EMAIL \?>/g, "operator@example.test").replace(/<\?= ADMIN_ROLE \?>/g, "ADMIN");
}

async function settled(page) {
  await page.waitForFunction(() => document.querySelector("#eduopsApp")?.getAttribute("aria-busy") === "false" && !/Loading|Queued/.test(document.querySelector("#eduopsVisibleRange")?.textContent || ""), null, { timeout: 30000 });
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
    page.on("console", (message) => { if (message.type() === "error") console.error("BROWSER_CONSOLE", message.text()); });
    page.on("pageerror", (error) => console.error("BROWSER_PAGEERROR", error.message));
    await page.setContent(fixtureHtml(), { waitUntil: "domcontentloaded" });
    await settled(page);

    for (const state of states) {
      await page.locator('[data-work-scope="ESCALATED"]').click();
      await page.locator(`${state === "COMPLETE" ? "#eduopsHistoryNav" : "#eduopsActionNav"} button[data-state="${state}"]`).click();
      await settled(page);
      assert.equal(await page.locator('[data-work-scope="ALL_AUTHORISED"]').getAttribute("aria-pressed"), "true", `${state} must reset unpinned ownership scope`);
      const payload = await page.evaluate(() => window.__workloadCalls.at(-1));
      assert.equal(payload.actionabilityState, state);
      assert.equal(payload.workScope, "ALL_AUTHORISED");
    }

    await page.evaluate(() => { window.__rpcDelayMs = 50; });
    const beforeDedupe = await page.evaluate(() => window.__workloadCalls.length);
    await page.locator('#eduopsActionNav button[data-state="READY"]').click();
    await page.locator('#eduopsActionNav button[data-state="READY"]').click();
    await page.waitForTimeout(65);
    assert.equal(await page.evaluate(() => window.__workloadCalls.length), beforeDedupe + 1, "Duplicate active request must call the server once");
    assert.ok((await page.evaluate(() => window.__EDUOPS_REQUEST_DIAGNOSTICS__)).some((item) => item.outcome === "DEDUPED_ACTIVE"));

    await page.evaluate(() => { window.__rpcDelayMs = 60; });
    const beforeSupersede = await page.evaluate(() => window.__workloadCalls.length);
    await page.locator('#eduopsActionNav button[data-state="COOLING_OFF"]').click();
    await page.locator('#eduopsHistoryNav button[data-state="COMPLETE"]').click();
    await page.locator('#eduopsActionNav button[data-state="REVIEW_REQUIRED"]').click();
    await page.waitForTimeout(140);
    assert.ok((await page.evaluate(() => window.__workloadCalls.length)) <= beforeSupersede + 3, "Rapid state changes must remain bounded to the requested transitions");
    assert.match(await page.locator("#eduopsSelectedStateLabel").innerText(), /Needs review/);
    assert.ok((await page.evaluate(() => window.__EDUOPS_REQUEST_DIAGNOSTICS__)).some((item) => item.outcome === "DISCARDED_SUPERSEDED"));

    await page.evaluate(() => { window.__rpcDelayMs = 130; });
    await page.locator('#eduopsActionNav button[data-state="READY"]').click();
    await page.waitForSelector("[data-retry-workload]", { timeout: 3000 });
    assert.match(await page.locator("#eduopsWorklistRows").innerText(), /timed out/i);
    await page.evaluate(() => { window.__rpcDelayMs = 5; });
    await page.locator("[data-retry-workload]").click();
    await settled(page);
    await page.close();

    for (const viewport of [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
      const pagination = await browser.newPage({ viewport });
      await pagination.setContent(fixtureHtml(), { waitUntil: "domcontentloaded" });
      await settled(pagination);
      await pagination.selectOption("#eduopsPageSize", "10");
      await settled(pagination);
      await pagination.evaluate(() => { window.__rpcDelayMs = 35; });
      await pagination.locator("#eduopsNextPage").click();
      assert.match(await pagination.locator("#eduopsVisibleRange").innerText(), /Loading page 2|Queued page 2/);
      await pagination.waitForFunction(() => /Showing 11-20/.test(document.querySelector("#eduopsVisibleRange")?.textContent || ""));
      assert.equal(await pagination.locator("#eduopsSnapshotShort").innerText(), "FODE-TEST-SNAPSHOT");
      await pagination.close();
    }
    console.log("PASS EduOps request-state browser contracts actionability=8 viewports=3 dedupe=true supersession=true timeout=true");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
