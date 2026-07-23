const assert = require("node:assert/strict");
const { start } = require("../server/server");

const playwrightModule = process.env.FODE_PLAYWRIGHT_MODULE || "F:/Playwright/fode-secure-link-diagnostic/node_modules/playwright";
const { chromium } = require(playwrightModule);
const viewports = [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 1366, height: 768 }];

async function waitWorkload(page) {
  await page.waitForFunction(() => document.querySelector("#eduopsApp")?.getAttribute("aria-busy") === "false" && document.querySelectorAll("#eduopsWorklistRows tr").length > 0, null, { timeout: 14000 });
}
async function waitContext(page, text) {
  await page.waitForFunction((value) => document.querySelector("#eduopsSelectedStateLabel")?.textContent.includes(value) && !/Loading|Queued/.test(document.querySelector("#eduopsVisibleRange")?.textContent || ""), text, { timeout: 14000 });
}
async function noPageOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2);
}

(async () => {
  const service = await start(0);
  const browser = await chromium.launch({ headless: true });
  const consoleErrors = [];
  const pageErrors = [];
  let assertions = 0;

  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      await page.addInitScript(() => { window.EDUOPS_REQUEST_TIMEOUT_MS = 7000; });
      page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(`${viewport.width}x${viewport.height}: ${message.text()}`); });
      page.on("pageerror", (error) => pageErrors.push(`${viewport.width}x${viewport.height}: ${error.message}`));
      const external = [];
      page.on("request", (request) => { const url = request.url(); if (!url.startsWith(service.url) && !url.startsWith("data:") && !url.startsWith("about:")) external.push(url); });

      await page.goto(service.url, { waitUntil: "domcontentloaded" });
      await waitWorkload(page);
      assert.equal(external.length, 0, "Preview startup must remain offline"); assertions++;
      assert.equal(await noPageOverflow(page), true, "Page-level overflow is not permitted"); assertions++;
      assert.match(await page.locator("#eduopsPreviewModeBanner").innerText(), /DETERMINISTIC SCENARIO DATA.*NOT CURRENT FODE DATA/); assertions++;
      assert.equal(await page.locator("#eduopsActionNav button[data-state]").count(), 7, "Actionability rail is the single primary state navigation"); assertions++;
      assert.equal(await page.locator("#eduopsKpis button").count(), 0, "KPI summary must not duplicate Actionability controls"); assertions++;
      const enteredColor = await page.locator("#eduopsGlobalSearch").evaluate((element) => getComputedStyle(element).color);
      assert.notEqual(enteredColor, "rgba(0, 0, 0, 0)"); assertions++;
      assert.ok(Number(await page.locator("#eduopsGlobalSearch").evaluate((element) => parseFloat(getComputedStyle(element).fontSize))) >= 15); assertions++;

      await page.selectOption("#eduopsPageSize", "10");
      await waitWorkload(page);
      const firstSnapshot = await page.locator("#eduopsSnapshotShort").innerText();
      await page.locator("#eduopsNextPage").click();
      await page.waitForFunction(() => /Showing 11-20/.test(document.querySelector("#eduopsVisibleRange")?.textContent || ""));
      assert.equal(await page.locator("#eduopsSnapshotShort").innerText(), firstSnapshot, "Pagination must retain the source snapshot"); assertions++;
      await page.locator("#eduopsPreviousPage").click();
      await page.waitForFunction(() => /Showing 1-10/.test(document.querySelector("#eduopsVisibleRange")?.textContent || ""));

      await page.locator('[data-work-scope="ESCALATED"]').click();
      await page.waitForFunction(() => document.querySelector('[data-work-scope="ESCALATED"]')?.getAttribute("aria-pressed") === "true");
      await page.locator('#eduopsActionNav button[data-state="COOLING_OFF"]').click();
      await waitContext(page, "Recently contacted");
      assert.equal(await page.locator('[data-work-scope="ALL_AUTHORISED"]').getAttribute("aria-pressed"), "true", "Actionability change must reset unpinned scope"); assertions++;
      assert.match(await page.locator("#eduopsWorklistReason").innerText(), /matched/); assertions++;

      await page.fill("#eduopsGlobalSearch", "Waffi");
      await page.waitForFunction(() => document.querySelector("#eduopsGlobalSearchResults")?.textContent.includes("Keziah Waffi"));
      await page.locator('[data-search-open="FODE-26-002959"]').click();
      await page.waitForSelector("#eduopsWorkbench:not([hidden])");
      await page.waitForFunction(() => document.querySelector("#eduopsWorkbenchTitle")?.textContent.includes("Keziah Waffi"));
      assert.match(await page.locator("#eduopsWorkbenchTitle").innerText(), /Keziah Waffi/); assertions++;
      assert.match(await page.locator("#eduopsWorkbenchSubtitle").innerText(), /FODE-26-002959/); assertions++;
      await page.locator('[data-workbench-tab="finance"]').click();
      assert.match(await page.locator("#eduopsWorkbenchPanel").innerText(), /Finance authority/); assertions++;
      await page.locator('[data-workbench-tab="communications"]').click();
      assert.match(await page.locator("#eduopsWorkbenchPanel").innerText(), /Template gallery/); assertions++;
      await page.locator('[data-workbench-tab="portal"]').click();
      assert.match(await page.locator("#eduopsWorkbenchPanel").innerText(), /Portal access authority/); assertions++;
      await page.locator('[data-workbench-tab="contactability"]').click();
      assert.match(await page.locator("#eduopsWorkbenchPanel").innerText(), /Canonical contactability/); assertions++;
      await page.locator('[data-workbench-tab="audit"]').click();
      assert.match(await page.locator("#eduopsWorkbenchPanel").innerText(), /Applicant operation history/); assertions++;
      await page.locator('[data-workbench-tab="documents"]').click();
      await page.waitForSelector(".eduops-document-gallery [data-document-index]");
      await page.waitForSelector(".eduops-document-preview img");
      assert.match(await page.locator(".eduops-document-preview img").getAttribute("src"), /^data:image\/png;base64,/); assertions++;
      assert.match(await page.locator(".eduops-document-stage").innerText(), /canonical original is unchanged/i); assertions++;

      await page.fill("[data-document-note]", "Preview-only owner review note");
      assert.equal(await page.evaluate(() => window.EduOpsApp.state.dirty), true, "Document edit must mark the exact Workbench dirty"); assertions++;
      await page.goBack();
      await page.waitForSelector("#eduopsConfirmLayer:not([hidden])");
      assert.equal(await page.locator("#eduopsWorkbench").isVisible(), true, "Dirty Back must retain Workbench"); assertions++;
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelector("#eduopsConfirmLayer")?.hidden === true);
      assert.equal(await page.locator("[data-document-note]").inputValue(), "Preview-only owner review note", "Escape must preserve dirty draft"); assertions++;
      await page.locator("#eduopsCloseWorkbench").click();
      await page.waitForSelector("#eduopsConfirmLayer:not([hidden])");
      await page.locator("#eduopsConfirmProceed").click();
      await page.waitForFunction(() => document.querySelector("#eduopsWorkbench")?.hidden === true);
      assert.equal(await page.locator("#eduopsWorkbench").isVisible(), false); assertions++;

      await page.locator('#eduopsActionNav button[data-state="READY"]').click();
      await waitWorkload(page);
      await page.locator("#eduopsStartSession").click();
      await page.waitForSelector("#eduopsWorkbench:not([hidden])");
      await page.waitForSelector("#eduopsSessionBar:not([hidden])");
      assert.doesNotMatch(await page.locator("#eduopsWorkbenchPanel").innerText(), /\[Object Object\]/, "Workbench values must render as operator-readable text"); assertions++;
      const sessionFirst = await page.locator("#eduopsWorkbenchSubtitle").innerText();
      await page.locator("[data-session-next]").click();
      await page.waitForFunction((before) => document.querySelector("#eduopsWorkbenchSubtitle")?.textContent !== before, sessionFirst);
      assert.notEqual(await page.locator("#eduopsWorkbenchSubtitle").innerText(), sessionFirst, "Work Session must advance exact ApplicantID"); assertions++;
      assert.doesNotMatch(await page.locator("#eduopsWorkbenchPanel").innerText(), /\[Object Object\]/, "Advanced Work Session values must remain operator-readable"); assertions++;
      await page.locator("[data-session-exit]").click();
      await page.waitForFunction(() => document.querySelector("#eduopsWorkbench")?.hidden === true);
      await page.locator("#eduopsSelectVisible").click();
      assert.equal(await page.locator("#eduopsOpenBatch").isEnabled(), true); assertions++;
      await page.locator("#eduopsOpenBatch").click();
      await page.waitForSelector("#eduopsBatchWorkspace:not([hidden])");
      await page.locator('input[name="eduopsBatchOperation"][value="BATCH_COMMUNICATION"]').check();
      await page.locator("[data-batch-preview]").click();
      await page.waitForSelector(".eduops-partition-card");
      assert.match(await page.locator("#eduopsBatchOperationStatus").innerText(), /Ready/); assertions++;
      await page.locator("[data-batch-continue]").click();
      await page.locator("[data-batch-confirm]").click();
      await page.locator("[data-batch-execute]").click();
      await page.waitForSelector("#eduopsConfirmLayer:not([hidden])");
      await page.locator("#eduopsConfirmProceed").click();
      await page.waitForFunction(() => document.querySelector("#eduopsBatchPanel")?.textContent.includes("RECEIPT-"));
      assert.match(await page.locator("#eduopsBatchPanel").innerText(), /Versioned authoritative receipt/i); assertions++;
      await page.locator("[data-batch-close]").click();
      await waitWorkload(page);

      await page.locator("#eduopsOpenReconciliation").click();
      await page.waitForSelector("#eduopsReportPanel:not([hidden])");
      assert.match(await page.locator("#eduopsReportTitle").innerText(), /reconciliation/i); assertions++;
      await page.keyboard.press("Escape");
      await page.waitForFunction(() => document.querySelector("#eduopsReportPanel")?.hidden === true);
      assert.equal(await noPageOverflow(page), true); assertions++;
      await page.close();
    }

    assert.deepEqual(consoleErrors, [], `Console errors: ${consoleErrors.join("\n")}`);
    assert.deepEqual(pageErrors, [], `Page errors: ${pageErrors.join("\n")}`);
    console.log(`PASS EduOps Preview browser behaviours=${assertions / viewports.length} viewportExecutions=${viewports.length} assertions=${assertions} consoleErrors=0 pageErrors=0 overflow=0`);
  } finally {
    await browser.close();
    await new Promise((resolve) => service.server.close(resolve));
  }
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
