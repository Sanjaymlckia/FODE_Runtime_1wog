const fs = require("node:fs");
const path = require("node:path");
const assert = require("node:assert/strict");

const playwrightModule = process.env.FODE_PLAYWRIGHT_MODULE || "F:/Playwright/fode-secure-link-diagnostic/node_modules/playwright";
const { chromium } = require(playwrightModule);

const states = ["READY", "COOLING_OFF", "AWAITING_APPLICANT", "AWAITING_PAYMENT", "REVIEW_REQUIRED", "BLOCKED", "UNKNOWN", "COMPLETE"];
const counts = { READY: 60, COOLING_OFF: 12, AWAITING_APPLICANT: 0, AWAITING_PAYMENT: 0, REVIEW_REQUIRED: 75, BLOCKED: 0, UNKNOWN: 0, COMPLETE: 1 };

function fixtureHtml() {
  let html = fs.readFileSync("EduOps.html", "utf8");
  const styles = fs.readFileSync("EduOps_Styles.html", "utf8");
  const client = fs.readFileSync("EduOps_Client.html", "utf8");
  const mock = `<script>
    window.EDUOPS_REQUEST_TIMEOUT_MS = 80;
    window.__rpcDelayMs = 10;
    window.__workloadCalls = [];
    window.__makeWorkload = function (payload) {
      var allCounts = ${JSON.stringify(counts)};
      var total = payload.workScope === "ALL_AUTHORISED" ? Number(allCounts[payload.actionabilityState] || 0) : (payload.actionabilityState === "REVIEW_REQUIRED" ? 2 : 0);
      var totalPages = Math.max(1, Math.ceil(total / payload.pageSize));
      var page = Math.min(payload.page, totalPages);
      var rows = total ? [{
        applicantId: "FODE-TEST-" + payload.actionabilityState,
        displayName: "Fixture Applicant",
        email: "fixture@example.test",
        actionabilityState: payload.actionabilityState,
        actionabilityLabel: payload.actionabilityState,
        urgencyLevel: "HIGH",
        worklistKey: "FIXTURE",
        worklistLabel: "Fixture",
        actionOwner: "OFFICER",
        workOwnership: { scope: payload.workScope },
        nextAction: "REVIEW",
        canonicalFinanceState: "NOT_YET_PAYMENT_APPLICABLE",
        documentState: "UNKNOWN",
        portalState: "SUBMITTED",
        contactabilityState: "EMAIL_AVAILABLE",
        sourceReliability: { state: "AUTHORITATIVE" }
      }] : [];
      return {
        ok: true, readOnly: true, snapshotId: "FODE-TEST-SNAPSHOT", snapshotAsOf: "2026-07-15T00:00:00.000Z",
        reliabilityState: "AUTHORITATIVE", reliabilityReasons: ["Fixture authority"], actionabilityCounts: allCounts,
        worklistKeyCounts: { FIXTURE: total }, page: page, pageSize: payload.pageSize, totalMatched: total,
        totalPages: totalPages, rows: rows, timings: { serverRpcMs: 7, canonicalSnapshotResolutionMs: 2,
        workloadCompositionMs: 1, sortingPagingMs: 1, responseBytes: 2048 }
      };
    };
    window.google = { script: {} };
    Object.defineProperty(window.google.script, "run", { get: function () {
      var success = function () {}; var failure = function () {};
      var runner = new Proxy({}, { get: function (_target, prop) {
        if (prop === "withSuccessHandler") return function (fn) { success = fn; return runner; };
        if (prop === "withFailureHandler") return function (fn) { failure = fn; return runner; };
        return function (payload) {
          if (prop === "eduops_getAccessProjection") return setTimeout(function () { success({ ok: true, readOnly: true }); }, 0);
          if (prop === "eduops_queryOperationalWorkload") {
            window.__workloadCalls.push(JSON.parse(JSON.stringify(payload || {})));
            return setTimeout(function () { success(window.__makeWorkload(payload || {})); }, window.__rpcDelayMs);
          }
          return setTimeout(function () { success({ ok: true, readOnly: true, matches: [] }); }, 0);
        };
      }});
      return runner;
    }});
  </script>`;
  html = html.replace('<?!= HtmlService.createHtmlOutputFromFile("EduOps_Styles").getContent(); ?>', styles);
  html = html.replace('<?!= HtmlService.createHtmlOutputFromFile("EduOps_Client").getContent(); ?>', mock + client);
  html = html.replace(/<\?= BUILD_VERSION \?>/g, "rTEST")
    .replace(/<\?= USER_EMAIL \?>/g, "operator@example.test")
    .replace(/<\?= ADMIN_ROLE \?>/g, "ADMIN");
  return html;
}

async function settled(page) {
  await page.waitForFunction(() => document.querySelector("#eduopsRequestStatus")?.getAttribute("data-state") === "COMPLETE");
}

async function activeScope(page) {
  return page.locator("[data-scope].active").first().getAttribute("data-scope");
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.setContent(fixtureHtml(), { waitUntil: "domcontentloaded" });
  await settled(page);

  for (const state of states) {
    await page.locator('[data-scope="ESCALATED"]').click();
    await settled(page);
    await page.locator(`[data-state="${state}"]`).first().click();
    await settled(page);
    assert.equal(await activeScope(page), "ALL_AUTHORISED", `${state} must reset an unpinned ownership scope`);
    const lastPayload = await page.evaluate(() => window.__workloadCalls.at(-1));
    assert.equal(lastPayload.actionabilityState, state);
    assert.equal(lastPayload.workScope, "ALL_AUTHORISED");
  }

  await page.locator("#eduopsPinScope").check();
  await page.locator('[data-scope="ESCALATED"]').click();
  await settled(page);
  await page.locator('[data-state="COOLING_OFF"]').first().click();
  await settled(page);
  assert.equal(await activeScope(page), "ESCALATED", "an explicitly pinned scope must persist");
  assert.match(await page.locator("#eduopsWorkloadMeta").innerText(), /Cooling Off: 12 total \/ Escalated: 0 matched/);
  assert.match(await page.locator("#eduopsRows").innerText(), /12 total across All Authorised; 0 matched Escalated/);

  await page.locator("#eduopsPinScope").uncheck();
  await page.evaluate(() => { window.__rpcDelayMs = 120; });
  const callsBeforeDedupe = await page.evaluate(() => window.__workloadCalls.length);
  await page.locator('[data-state="READY"]').first().click();
  await page.locator('[data-state="READY"]').first().click();
  await page.waitForTimeout(150);
  assert.equal(await page.evaluate(() => window.__workloadCalls.length), callsBeforeDedupe + 1, "duplicate request must not invoke the server twice");
  assert.ok((await page.evaluate(() => window.__EDUOPS_REQUEST_DIAGNOSTICS__)).some((item) => item.outcome === "DEDUPED_ACTIVE"));

  await page.evaluate(() => { window.__rpcDelayMs = 250; });
  const callsBeforeSupersede = await page.evaluate(() => window.__workloadCalls.length);
  await page.locator('[data-state="COOLING_OFF"]').first().click();
  await page.locator('[data-state="COMPLETE"]').first().click();
  await page.locator('[data-state="REVIEW_REQUIRED"]').first().click();
  await page.waitForTimeout(230);
  assert.equal(await page.evaluate(() => window.__workloadCalls.length), callsBeforeSupersede + 2, "only the in-flight and latest queued requests may run");
  assert.match(await page.locator("#eduopsWorkloadTitle").innerText(), /Review Required/);
  assert.ok((await page.evaluate(() => window.__EDUOPS_REQUEST_DIAGNOSTICS__)).some((item) => item.outcome === "DISCARDED_SUPERSEDED"));

  await page.evaluate(() => { window.__rpcDelayMs = 200; });
  await page.locator('[data-state="READY"]').first().click();
  await page.waitForFunction(() => document.querySelector("#eduopsRequestStatus")?.getAttribute("data-state") === "ERROR");
  assert.match(await page.locator("#eduopsRows").innerText(), /timed out/i);
  assert.equal(await page.locator("[data-retry-workload]").count(), 1, "timeout must expose one retry control");
  await page.evaluate(() => { window.__rpcDelayMs = 10; });
  await page.locator("[data-retry-workload]").click();
  await settled(page);

  await browser.close();

  for (const viewport of [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
    const paginationPage = await browserTypePage(viewport);
    await paginationPage.locator("#eduopsNextPage").click();
    assert.equal(await paginationPage.locator("#eduopsPageMeta").innerText(), "Loading page 2", "pending pagination must identify page 2");
    await settled(paginationPage);
    assert.equal(await paginationPage.locator("#eduopsPageMeta").innerText(), "Page 2 / 3");
    await paginationPage.locator("#eduopsPrevPage").click();
    assert.equal(await paginationPage.locator("#eduopsPageMeta").innerText(), "Loading page 1", "pending pagination must identify page 1");
    await settled(paginationPage);
    await paginationPage.context().browser().close();
  }

  console.log("PASS EduOps Pass 1 request-state browser contracts actionability=8 viewports=3");
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});

async function browserTypePage(viewport) {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport });
  await page.setContent(fixtureHtml(), { waitUntil: "domcontentloaded" });
  await settled(page);
  return page;
}
