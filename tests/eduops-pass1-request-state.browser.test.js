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
      function p(code, label, tone) { return { schemaVersion: "EDUOPS_CODE_PRESENTATION_V1", authoritySource: "Fixture authority", code: code, label: label, reason: label, tone: tone || "ready", available: true, stale: false }; }
      var allRows = Array.from({ length: total }, function (_unused, index) { var id = "FODE-TEST-" + payload.actionabilityState + "-" + index; var row = { product: "FODE", rowKey: id, applicantId: id, displayName: "Fixture Applicant " + index, email: "fixture@example.test", actionabilityState: payload.actionabilityState, urgencyLevel: index === 0 ? "CRITICAL" : "NORMAL", worklistKey: "FIXTURE", worklistLabel: "Fixture", actionOwner: "OFFICER", workOwnership: { scope: "MY" }, nextAction: "Review fixture", nextActionDate: "2026-07-20T00:00:00.000Z", canonicalFinanceState: "PAYMENT_PENDING", documentState: "REVIEW_REQUIRED", portalState: "SUBMITTED", contactabilityState: "EMAIL_AVAILABLE", selectable: true, sourceReliability: { state: "AUTHORITATIVE" } }; row.presentation = { actionability: p(row.actionabilityState, row.actionabilityState.replace(/_/g, " ")), worklist: p("FIXTURE", "Fixture"), nextAction: p("REVIEW_FIXTURE", "Review fixture"), coolingOff: p("NOT_COOLING_OFF", "No waiting period"), lifecycle: p("REVIEW_REQUIRED", "Review required"), finance: p("PAYMENT_PENDING", "Payment pending"), documents: p("REVIEW_REQUIRED", "Review required"), owner: p("OFFICER", "Officer"), workScope: p("MY", "My work"), route: p("REVIEW", "Review"), urgency: p(row.urgencyLevel, row.urgencyLevel), contactability: p("EMAIL_AVAILABLE", "Email available"), reliability: p("AUTHORITATIVE", "Authoritative") }; row.authorityDecision = { schemaVersion: "EDUOPS_ROW_AUTHORITY_DECISION_V1", authoritySource: "Actionability Resolver", evaluatedApplicantId: id, snapshotId: "FODE-TEST-SNAPSHOT", state: row.actionabilityState, reasonCode: "AVAILABLE", reason: "Available", actionAvailable: true, stale: false }; return row; });
      var search = String(payload.filters && payload.filters.search || "").trim().toLowerCase();
      var matchedRows = search ? allRows.filter(function (row) { return row.applicantId.toLowerCase().indexOf(search) >= 0 || row.displayName.toLowerCase().indexOf(search) >= 0; }) : allRows;
      var matched = matchedRows.length;
      var totalPages = Math.max(1, Math.ceil(matched / payload.pageSize));
      var page = Math.min(payload.page, totalPages);
      var offset = (page - 1) * payload.pageSize;
      var rows = matchedRows.slice(offset, offset + payload.pageSize);
      var buckets = Object.keys(allCounts).map(function (code) { return { code: code, label: code === "COOLING_OFF" ? "Recently contacted - waiting period" : code === "REVIEW_REQUIRED" ? "Needs review" : code.replace(/_/g, " "), reason: "Fixture authority", tone: code === "BLOCKED" ? "blocked" : "ready", available: true, count: allCounts[code] }; });
      var presentation = { schemaVersion: "EDUOPS_WORKLOAD_PRESENTATION_V1", authoritySource: "Fixture authority", actionabilityBuckets: buckets, allActionability: { label: "All authoritative states", count: 200 }, worklists: [{ code: "", label: "All work types", count: matched }, { code: "FIXTURE", label: "Fixture", count: matched }], workScopes: [p("ALL_AUTHORISED", "All authorised work"), p("MY", "My work"), p("TEAM", "Team work"), p("UNASSIGNED", "Unassigned"), p("ESCALATED", "Escalated")], reliability: p("AUTHORITATIVE", "Authoritative"), metrics: [{ label: "Eligible now", value: matched }], filterOptions: { owner: [], urgency: [], primaryRoute: [], documentState: [], financeState: [], contactabilityState: [], communicationState: [], cooling: [], blockKind: [] }, selection: { totalMatched: matched, visibleSelectable: rows.length, visibleBlocked: 0 }, modules: {} };
      return { ok: true, schemaVersion: "EDUOPS_OPERATIONAL_WORKLOAD_V2", authoritySource: "Fixture authority", product: "FODE", runtime: { operationalClassification: "Fixture operations", runtimeIdentity: "rTEST / 0" }, snapshotId: "FODE-TEST-SNAPSHOT", snapshotAsOf: "2026-07-15T00:00:00.000Z", reliabilityState: "AUTHORITATIVE", reliabilityReasons: ["Fixture authority"], actionabilityCounts: allCounts, worklistKeyCounts: { FIXTURE: matched }, metricCounts: { eligibleNow: matched }, reconciliation: { canonicalPopulation: 200, totalMatched: matched, hiddenFromCurrentView: 200 - matched, eligibleOutsideCurrentWindow: Math.max(0, matched - rows.length), totalAuthoritySelectable: matched, totalAuthorityBlocked: 0 }, presentation: presentation, page: page, pageSize: payload.pageSize, totalMatched: matched, totalPages: totalPages, rows: rows, timings: { serverRpcMs: 7, canonicalSnapshotResolutionMs: 2, workloadCompositionMs: 1, sortingPagingMs: 1, responseBytes: 2048 } };
    };
    window.EDUOPS_TRANSPORT = { call: function (name, payload) { return new Promise(function (resolve) { setTimeout(function () { if (name === "eduops_getAccessProjection") return resolve({ ok: true, schemaVersion: "EDUOPS_ACCESS_PROJECTION_V1", authoritySource: "Admin access and capability authority", runtime: { operationalClassification: "Fixture operations", runtimeIdentity: "rTEST / 0" }, user: { email: "operator@example.test", role: "ADMIN", capabilities: {} } }); if (name === "eduops_getProfile") return resolve({ ok: true, schemaVersion: "EDUOPS_PROFILE_V2", authoritySource: "EduOps backend profile service", defaultQuery: { product: "FODE", actionabilityState: "READY", worklistKey: "", workScope: "ALL_AUTHORISED", filters: { search: "" }, sort: { key: "urgency", direction: "asc" }, page: 1, pageSize: 25 }, featureFlags: {}, operationAvailability: {} }); if (name === "eduops_queryOperationalWorkload") { window.__workloadCalls.push(JSON.parse(JSON.stringify(payload || {}))); return resolve(window.__makeWorkload(payload || {})); } resolve({ ok: true, matches: [], receipts: [] }); }, name === "eduops_queryOperationalWorkload" ? window.__rpcDelayMs : 0); }); } };
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
    await page.evaluate(() => { const control = document.querySelector('#eduopsActionNav button[data-state="READY"]'); control.click(); control.click(); });
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

    await page.locator("#eduopsWorklistRows [data-select-applicant]").first().check();
    assert.match(await page.locator("#eduopsSelectionSummary").innerText(), /Operator selection intent 1/);
    await page.locator("#eduopsSearch").fill("no-match");
    await page.waitForFunction(() => !/Operator selection intent 1/.test(document.querySelector("#eduopsSelectionSummary")?.textContent || ""), null, { timeout: 3000 });
    assert.doesNotMatch(await page.locator("#eduopsSelectionSummary").innerText(), /Operator selection intent 1/);
    assert.equal(await page.locator("#eduopsOpenBatch").isDisabled(), true);
    await settled(page);
    assert.match(await page.locator("#eduopsVisibleRange").innerText(), /Showing 0-0 of 0/);
    assert.match(await page.locator("#eduopsSelectionSummary").innerText(), /Operator selection intent 0/);

    await page.locator("#eduopsSearch").fill("");
    await page.waitForFunction(() => document.querySelectorAll("#eduopsWorklistRows [data-select-applicant]").length > 0 && !/Loading|Queued/.test(document.querySelector("#eduopsVisibleRange")?.textContent || ""), null, { timeout: 3000 });
    await page.locator("#eduopsPageSize").selectOption("10");
    await settled(page);
    await page.locator("#eduopsWorklistRows [data-select-applicant]").first().check();
    await page.evaluate(() => { window.__rpcDelayMs = 35; });
    await page.locator("#eduopsNextPage").click();
    await page.waitForFunction(() => /Loading page 2|Queued page 2|Showing 11-20/.test(document.querySelector("#eduopsVisibleRange")?.textContent || ""), null, { timeout: 3000 });
    await page.waitForFunction(() => /Showing 11-20/.test(document.querySelector("#eduopsVisibleRange")?.textContent || ""));
    assert.match(await page.locator("#eduopsSelectionSummary").innerText(), /Operator selection intent 1/, "pagination preserves explicit operator intent without changing backend authority");
    await page.close();

    for (const viewport of [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 1366, height: 768 }]) {
      const pagination = await browser.newPage({ viewport });
      await pagination.setContent(fixtureHtml(), { waitUntil: "domcontentloaded" });
      await settled(pagination);
      await pagination.selectOption("#eduopsPageSize", "10");
      await settled(pagination);
      await pagination.evaluate(() => { window.__rpcDelayMs = 35; });
      await pagination.locator("#eduopsNextPage").click();
      assert.match(await pagination.locator("#eduopsVisibleRange").innerText(), /Loading page 2|Queued page 2|Showing 11-20/);
      await pagination.waitForFunction(() => /Showing 11-20/.test(document.querySelector("#eduopsVisibleRange")?.textContent || ""));
      assert.equal(await pagination.locator("#eduopsSnapshotShort").innerText(), "FODE-TEST-SNAPSHOT");
      await pagination.close();
    }
    console.log("PASS EduOps request-state browser contracts actionability=8 viewports=3 dedupe=true supersession=true timeout=true");
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
