const fs = require("node:fs");
const path = require("node:path");
const { start } = require("./server/server");

const playwrightModule = process.env.FODE_PLAYWRIGHT_MODULE || "F:/Playwright/fode-secure-link-diagnostic/node_modules/playwright";
const { chromium } = require(playwrightModule);
const viewports = [{ width: 1920, height: 1080 }, { width: 1440, height: 900 }, { width: 1366, height: 768 }];
const runId = `run-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const evidenceRoot = path.join(__dirname, "evidence", runId);
const summary = { runId, createdAt: new Date().toISOString(), viewports, behaviouralStates: [], screenshots: [], consoleErrors: [], pageErrors: [], overflow: [], timings: [], pngIntegrity: [] };

function ensureDir(dir) { fs.mkdirSync(dir, { recursive: true }); }
function validatePng(file) { return fs.readFileSync(file).subarray(0, 8).toString("hex") === "89504e470d0a1a0a"; }
async function waitWorkload(page) { await page.waitForFunction(() => document.querySelector("#eduopsApp")?.getAttribute("aria-busy") === "false" && !/Loading|Queued/.test(document.querySelector("#eduopsVisibleRange")?.textContent || ""), null, { timeout: 14000 }); }
async function shot(page, directory, name) {
  await page.waitForTimeout(600);
  const file = path.join(directory, `${String(summary.screenshots.length + 1).padStart(3, "0")}-${name}.png`);
  await page.screenshot({ path: file, fullPage: false });
  summary.screenshots.push(file);
  if (!summary.behaviouralStates.includes(name)) summary.behaviouralStates.push(name);
}
async function scenario(page, value) {
  if (!await page.locator("#eduopsPreviewTechnicalBody").isVisible()) await page.locator("#eduopsPreviewToggle").click();
  await page.selectOption("#eduopsPreviewLatency", "0");
  await page.selectOption("#eduopsPreviewScenario", value);
  await waitWorkload(page);
  await page.locator("#eduopsPreviewToggle").click();
}
async function openWaffi(page) {
  await page.fill("#eduopsGlobalSearch", "Waffi");
  await page.waitForFunction(() => document.querySelector("#eduopsGlobalSearchResults")?.textContent.includes("Keziah Waffi"));
  await page.locator('[data-search-open="FODE-26-002959"]').click();
  await page.waitForFunction(() => document.querySelector("#eduopsWorkbenchTitle")?.textContent.includes("Keziah Waffi"));
}
async function discardWorkbench(page) {
  await page.locator("#eduopsCloseWorkbench").click();
  if (await page.locator("#eduopsConfirmLayer:not([hidden])").count()) await page.locator("#eduopsConfirmProceed").click();
  await page.waitForFunction(() => document.querySelector("#eduopsWorkbench")?.hidden === true);
}
async function captureViewport(browser, url, viewport) {
  const directory = path.join(evidenceRoot, `${viewport.width}x${viewport.height}`);
  ensureDir(directory);
  const page = await browser.newPage({ viewport });
  page.on("console", (message) => { if (message.type() === "error") summary.consoleErrors.push({ viewport, text: message.text() }); });
  page.on("pageerror", (error) => summary.pageErrors.push({ viewport, text: error.message }));
  await page.goto(url, { waitUntil: "domcontentloaded" });
  await waitWorkload(page);
  await shot(page, directory, "01-actionability-ready-workload");

  await page.selectOption("#eduopsPageSize", "10");
  await waitWorkload(page);
  await page.locator("#eduopsNextPage").click();
  await page.waitForFunction(() => /Showing 11-20/.test(document.querySelector("#eduopsVisibleRange")?.textContent || ""));
  await shot(page, directory, "02-stable-snapshot-page-two");

  await page.locator('[data-work-scope="ESCALATED"]').click();
  await page.locator('#eduopsActionNav button[data-state="COOLING_OFF"]').click();
  await waitWorkload(page);
  await shot(page, directory, "03-actionability-resets-ownership-scope");

  await page.fill("#eduopsGlobalSearch", "Waffi");
  await page.waitForFunction(() => document.querySelector("#eduopsGlobalSearchResults")?.textContent.includes("Keziah Waffi"));
  await shot(page, directory, "04-global-search-exact-waffi");
  await page.locator('[data-search-open="FODE-26-002959"]').click();
  await page.waitForFunction(() => document.querySelector("#eduopsWorkbenchTitle")?.textContent.includes("Keziah Waffi"));
  await shot(page, directory, "05-exact-waffi-workbench");

  await page.locator('[data-workbench-tab="finance"]').click();
  await shot(page, directory, "06-finance-authority-and-decision");
  await page.locator('[data-workbench-tab="communications"]').click();
  await shot(page, directory, "07-communications-template-and-preview");
  await page.locator('[data-workbench-tab="portal"]').click();
  await shot(page, directory, "08-portal-guarded-controls");
  await page.locator('[data-workbench-tab="contactability"]').click();
  await shot(page, directory, "09-contactability-correction");

  await page.locator('[data-workbench-tab="documents"]').click();
  await page.waitForSelector(".eduops-document-preview img");
  await shot(page, directory, "10-document-gallery-derived-png");
  await page.fill("[data-document-note]", "Preview-only unsaved evidence note");
  await page.goBack();
  await page.waitForSelector("#eduopsConfirmLayer:not([hidden])");
  await shot(page, directory, "11-browser-back-dirty-guard");
  await page.keyboard.press("Escape");
  await page.locator("#eduopsCloseWorkbench").click();
  await page.locator("#eduopsConfirmProceed").click();
  await waitWorkload(page);

  await page.locator('#eduopsActionNav button[data-state="READY"]').click();
  await waitWorkload(page);
  await page.locator("#eduopsStartSession").click();
  await page.waitForSelector("#eduopsWorkbench:not([hidden])");
  await page.waitForSelector("#eduopsSessionBar:not([hidden])");
  await shot(page, directory, "12-work-session-progress");
  await page.locator("[data-session-exit]").click();
  await page.waitForFunction(() => document.querySelector("#eduopsWorkbench")?.hidden === true);
  await page.locator("#eduopsSelectVisible").click();
  await page.locator("#eduopsOpenBatch").click();
  await page.locator('input[name="eduopsBatchOperation"][value="BATCH_COMMUNICATION"]').check();
  await shot(page, directory, "13-batch-snapshot-bound-cohort");
  await page.locator("[data-batch-preview]").click();
  await page.waitForSelector(".eduops-partition-card");
  await page.locator("[data-batch-continue]").click();
  await shot(page, directory, "14-batch-authoritative-preview");
  await page.locator("[data-batch-confirm]").click();
  await page.locator("[data-batch-execute]").click();
  await page.locator("#eduopsConfirmProceed").click();
  await page.waitForFunction(() => document.querySelector("#eduopsBatchPanel")?.textContent.includes("RECEIPT-"));
  await shot(page, directory, "15-batch-versioned-receipt");
  await page.locator("[data-batch-close]").click();
  await waitWorkload(page);

  await page.selectOption("#eduopsProductSwitcher", "KIA");
  await waitWorkload(page);
  await shot(page, directory, "16-kia-preview-product-isolation");
  await page.selectOption("#eduopsProductSwitcher", "MLC");
  await waitWorkload(page);
  await shot(page, directory, "17-mlc-preview-product-isolation");
  await page.selectOption("#eduopsProductSwitcher", "FODE");
  await waitWorkload(page);

  await scenario(page, "conflicting-authority");
  await shot(page, directory, "18-conflicting-authority-fails-closed");
  await scenario(page, "normal-authoritative");
  await page.locator("#eduopsOpenReconciliation").click();
  await page.waitForSelector("#eduopsReportPanel:not([hidden])");
  await shot(page, directory, "19-reconciliation-hidden-reasons");
  await page.keyboard.press("Escape");

  summary.overflow.push({ viewport, overflow: await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2) });
  summary.timings.push({ viewport, requests: await page.evaluate(() => window.__EDUOPS_REQUEST_DIAGNOSTICS__ || []) });
  await page.close();
}

(async () => {
  ensureDir(evidenceRoot);
  const service = await start(0);
  const browser = await chromium.launch({ headless: true });
  try {
    for (const viewport of viewports) await captureViewport(browser, service.url, viewport);
  } finally {
    await browser.close();
    await new Promise((resolve) => service.server.close(resolve));
  }
  summary.pngIntegrity = summary.screenshots.map((file) => ({ file, ok: validatePng(file) }));
  fs.writeFileSync(path.join(evidenceRoot, "RUN_SUMMARY.json"), JSON.stringify(summary, null, 2));
  if (summary.pngIntegrity.some((item) => !item.ok)) throw new Error("PNG integrity failure");
  if (summary.consoleErrors.length || summary.pageErrors.length) throw new Error("Console or page errors captured");
  if (summary.overflow.some((item) => item.overflow)) throw new Error("Horizontal page overflow captured");
  console.log(`PASS EduOps Pass 2 evidence behaviouralStates=${summary.behaviouralStates.length} viewportExecutions=${viewports.length} screenshots=${summary.screenshots.length} path=${evidenceRoot}`);
})().catch((error) => { console.error(error.stack || error); process.exit(1); });
