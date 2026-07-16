const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { start } = require("../server/server");

const playwrightModule = process.env.FODE_PLAYWRIGHT_MODULE || "F:/Playwright/fode-secure-link-diagnostic/node_modules/playwright";
const { chromium } = require(playwrightModule);
const repoRoot = path.resolve(__dirname, "..", "..", "..");
const runId = `owner-review-recovery-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const evidenceRoot = path.join(repoRoot, "tools", "eduops-preview", "evidence", runId);
const screenshotRoot = path.join(evidenceRoot, "screenshots");
const videoRoot = path.join(evidenceRoot, "video");
fs.mkdirSync(screenshotRoot, { recursive: true });
fs.mkdirSync(videoRoot, { recursive: true });

function safeName(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 80);
}

async function waitWorkload(page) {
  await page.waitForFunction(() => document.querySelector("#eduopsApp")?.getAttribute("aria-busy") === "false" && document.querySelectorAll("#eduopsWorklistRows tr").length > 0, null, { timeout: 14000 });
}

async function waitReport(page, title) {
  await page.waitForSelector("#eduopsReportPanel:not([hidden])");
  if (title) await page.waitForFunction((value) => document.querySelector("#eduopsReportTitle")?.textContent.toLowerCase().includes(value.toLowerCase()), title);
}

async function main() {
  const service = await start(0);
  const browser = await chromium.launch({ headless: false });
  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, recordVideo: { dir: videoRoot, size: { width: 1440, height: 900 } } });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  const consoleLog = [];
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  const journeys = [];
  const controls = new Map();
  let sequence = 0;

  page.on("console", (message) => {
    const item = { type: message.type(), text: message.text() };
    consoleLog.push(item);
    if (message.type() === "error") consoleErrors.push(item.text);
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText || "unknown" }));

  async function shot(label) {
    const file = path.join(screenshotRoot, `${String(++sequence).padStart(3, "0")}-${safeName(label)}.png`);
    await page.screenshot({ path: file, fullPage: false });
    return path.relative(evidenceRoot, file).replace(/\\/g, "/");
  }

  async function inventory(stage) {
    const found = await page.locator("button,a[href],input,select,textarea,summary").evaluateAll((elements, stageName) => elements.filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return style.visibility !== "hidden" && style.display !== "none" && rect.width > 0 && rect.height > 0 && rect.bottom > 0 && rect.right > 0 && rect.top < innerHeight && rect.left < innerWidth;
    }).map((element) => ({
      id: element.getAttribute("data-control-id") || element.id || element.getAttribute("aria-label") || element.textContent.trim(),
      label: element.getAttribute("aria-label") || element.labels?.[0]?.textContent.trim() || element.textContent.trim() || element.getAttribute("placeholder") || element.value,
      classification: element.getAttribute("data-control-classification") || "UNCLASSIFIED",
      disabled: Boolean(element.disabled || element.getAttribute("aria-disabled") === "true"),
      stage: stageName
    })), stage);
    found.forEach((item) => {
      const key = item.id;
      if (!controls.has(key)) controls.set(key, { ...item, stages: [stage], exercised: false, result: item.disabled ? "TRUTHFULLY_DISABLED" : "NOT_EXERCISED" });
      else if (!controls.get(key).stages.includes(stage)) controls.get(key).stages.push(stage);
    });
  }

  async function recordControl(locator, label, expected, action) {
    const element = locator.first();
    await element.waitFor({ state: "visible" });
    const meta = await element.evaluate((node) => ({
      id: node.getAttribute("data-control-id") || node.id || node.getAttribute("aria-label") || node.textContent.trim(),
      label: node.getAttribute("aria-label") || node.labels?.[0]?.textContent.trim() || node.textContent.trim() || node.getAttribute("placeholder") || node.value,
      classification: node.getAttribute("data-control-classification") || "UNCLASSIFIED",
      disabled: Boolean(node.disabled || node.getAttribute("aria-disabled") === "true")
    }));
    assert.notEqual(meta.classification, "UNCLASSIFIED", `${label} must have one control classification`);
    const before = await shot(`${label}-before`);
    const started = Date.now();
    await action(element);
    await page.waitForTimeout(75);
    if (expected) await expected();
    const after = await shot(`${label}-after`);
    const visibleState = await page.locator("#eduopsInteractionStatus").innerText().catch(() => "");
    const record = { ...meta, exercised: true, result: "PASS", durationMs: Date.now() - started, visibleState, before, after };
    const key = meta.id;
    controls.set(key, { ...(controls.get(key) || {}), ...record, stages: controls.get(key)?.stages || [] });
    return record;
  }

  async function click(locator, label, expected) {
    return recordControl(locator, label, expected, (element) => element.click());
  }

  async function fill(locator, value, label, expected) {
    return recordControl(locator, label, expected, (element) => element.fill(value));
  }

  async function select(locator, value, label, expected) {
    return recordControl(locator, label, expected, (element) => element.selectOption(value));
  }

  function journey(name, result = "PASS") { journeys.push({ name, result }); }

  function componentFamily(id) {
    return String(id)
      .replace(/:(?:FODE|KIA|MLC)-[A-Z0-9-]+$/, ":<applicant>")
      .replace(/:page:\d+$/, ":page:<number>")
      .replace(/:state:[A-Z_]+$/, ":state:<value>")
      .replace(/:worklist:[A-Z_]+$/, ":worklist:<value>")
      .replace(/:document-index:\d+$/, ":document-index:<number>");
  }

  try {
    await page.goto(service.url, { waitUntil: "domcontentloaded" });
    await waitWorkload(page);
    await inventory("initial-orientation");
    assert.match(await page.locator("#eduopsPageTitle").innerText(), /What can be acted on now/);
    assert.match(await page.locator("#eduopsWorklistTitle").innerText(), /Ready for action/);
    assert.equal(await page.locator("#eduopsPreviewToggle").getAttribute("aria-expanded"), "false");
    journey("Initial orientation");

    await select(page.locator("#eduopsProductSwitcher"), "KIA", "product-kia", async () => waitWorkload(page));
    await select(page.locator("#eduopsProductSwitcher"), "MLC", "product-mlc", async () => waitWorkload(page));
    await select(page.locator("#eduopsProductSwitcher"), "FODE", "product-fode", async () => waitWorkload(page));

    await click(page.locator("#eduopsRailCollapse"), "collapse-navigation", async () => assert.equal(await page.locator("#eduopsApp").getAttribute("data-rail-collapsed"), "true"));
    await click(page.locator("#eduopsRailCollapse"), "expand-navigation", async () => assert.notEqual(await page.locator("#eduopsApp").getAttribute("data-rail-collapsed"), "true"));
    await click(page.locator("#eduopsSafetyDetails"), "authority-details", async () => waitReport(page, "System Health"));
    await click(page.locator("#eduopsCloseReport"), "close-authority-details", async () => page.waitForFunction(() => document.querySelector("#eduopsReportPanel")?.hidden === true));
    await click(page.locator("#eduopsRefreshAuthority"), "refresh-source", async () => waitWorkload(page));
    await click(page.locator("#eduopsRefreshSnapshot"), "refresh-workload", async () => waitWorkload(page));

    for (const state of ["COOLING_OFF", "AWAITING_APPLICANT", "AWAITING_PAYMENT", "REVIEW_REQUIRED", "BLOCKED", "UNKNOWN", "COMPLETE", "ALL", "READY"]) {
      await click(page.locator(`#eduopsActionNav [data-state="${state}"], #eduopsHistoryNav [data-state="${state}"]`), `actionability-${state}`, async () => waitWorkload(page));
    }
    journey("Select Actionability state");

    const worklistKey = await page.locator("#eduopsWorklistKeys [data-worklist]").evaluateAll((items) => items.map((item) => item.getAttribute("data-worklist") || "").find(Boolean));
    assert.ok(worklistKey, "At least one actionable worklist must be visible");
    await click(page.locator(`#eduopsWorklistKeys [data-worklist="${worklistKey}"]`), `worklist-${worklistKey}`, async () => {
      await page.waitForFunction((value) => document.querySelector(`#eduopsWorklistKeys [data-worklist="${value}"]`)?.getAttribute("aria-selected") === "true", worklistKey);
      await waitWorkload(page);
    });
    await click(page.locator('#eduopsWorklistKeys [data-worklist=""]'), `worklist-reset-after-${worklistKey}`, async () => {
      await page.waitForFunction(() => document.querySelector('#eduopsWorklistKeys [data-worklist=""]')?.getAttribute("aria-selected") === "true");
      await waitWorkload(page);
    });
    journey("Select worklist");

    for (const scope of ["MY", "TEAM", "UNASSIGNED", "ESCALATED", "ALL_AUTHORISED"]) {
      await click(page.locator(`[data-work-scope="${scope}"]`), `work-scope-${scope}`, async () => waitWorkload(page));
    }

    await select(page.locator("#eduopsPageSize"), "10", "page-size-10", async () => waitWorkload(page));
    await click(page.locator("#eduopsNextPage"), "next-page", async () => page.waitForFunction(() => /Showing 11-20/.test(document.querySelector("#eduopsVisibleRange")?.textContent || "")));
    await click(page.locator("#eduopsPreviousPage"), "previous-page", async () => page.waitForFunction(() => /Showing 1-10/.test(document.querySelector("#eduopsVisibleRange")?.textContent || "")));
    await click(page.locator("#eduopsPageNumbers [data-page='2']"), "page-number-2", async () => page.waitForFunction(() => /Showing 11-20/.test(document.querySelector("#eduopsVisibleRange")?.textContent || "")));
    await click(page.locator("#eduopsPageNumbers [data-page='1']"), "page-number-1", async () => page.waitForFunction(() => /Showing 1-10/.test(document.querySelector("#eduopsVisibleRange")?.textContent || "")));
    await select(page.locator("#eduopsSort"), "name:asc", "sort-name", async () => waitWorkload(page));
    await click(page.locator("#eduopsToggleFilters"), "open-more-filters", async () => assert.equal(await page.locator("#eduopsAdvancedFilters").isVisible(), true));

    for (const id of ["eduopsOwnerFilter", "eduopsUrgencyFilter", "eduopsRouteFilter", "eduopsDocumentFilter", "eduopsFinanceFilter", "eduopsContactFilter", "eduopsCommunicationFilter", "eduopsBlockKindFilter"]) {
      const option = await page.locator(`#${id} option`).evaluateAll((items) => items.map((item) => item.value).find(Boolean) || "");
      if (option) {
        await select(page.locator(`#${id}`), option, `filter-${id}`, async () => waitWorkload(page));
        await click(page.locator("#eduopsClearFilters"), `clear-after-${id}`, async () => waitWorkload(page));
      }
    }
    await select(page.locator("#eduopsCoolingFilter"), "ACTIVE", "filter-cooling", async () => waitWorkload(page));
    await click(page.locator("#eduopsClearFilters"), "clear-all-filters", async () => waitWorkload(page));
    await click(page.locator("#eduopsToggleFilters"), "close-more-filters", async () => assert.equal(await page.locator("#eduopsAdvancedFilters").isVisible(), false));
    await fill(page.locator("#eduopsSearch"), "Jackson", "local-workload-search", async () => {
      await page.waitForFunction(() => document.querySelector("#eduopsWorklistRows")?.textContent.includes("Jackson Numa"), null, { timeout: 14000 });
    });
    await click(page.locator("#eduopsToggleFilters"), "open-filters-to-clear-search", async () => assert.equal(await page.locator("#eduopsAdvancedFilters").isVisible(), true));
    await click(page.locator("#eduopsClearFilters"), "clear-local-workload-search", async () => {
      await page.waitForFunction(() => document.querySelectorAll("#eduopsWorklistRows tr").length > 1 && !/Loading|Queued/.test(document.querySelector("#eduopsVisibleRange")?.textContent || ""), null, { timeout: 14000 });
    });
    await click(page.locator("#eduopsToggleFilters"), "close-filters-after-search", async () => assert.equal(await page.locator("#eduopsAdvancedFilters").isVisible(), false));

    await click(page.locator("#eduopsWorklistRows [data-quick-applicant]").first(), "open-quick-view", async () => page.waitForSelector("#eduopsQuickDrawer[aria-hidden='false']"));
    await click(page.locator("#eduopsCloseDrawer"), "close-quick-view", async () => page.waitForFunction(() => document.querySelector("#eduopsQuickDrawer")?.getAttribute("aria-hidden") === "true"));
    await recordControl(page.locator("#eduopsWorklistRows [data-select-applicant]").first(), "select-row-checkbox", null, (element) => element.check());
    await click(page.locator("#eduopsClearSelection"), "clear-row-checkbox", async () => assert.equal(await page.locator("#eduopsOpenBatch").isDisabled(), true));
    await click(page.locator("#eduopsWorklistRows [data-open-applicant]").first(), "open-row-workbench", async () => page.waitForSelector("#eduopsWorkbench:not([hidden])"));
    await click(page.locator("#eduopsCloseWorkbench"), "close-row-workbench", async () => page.waitForFunction(() => document.querySelector("#eduopsWorkbench")?.hidden === true));
    await click(page.locator("#eduopsSelectVisible"), "select-visible", async () => assert.equal(await page.locator("#eduopsOpenBatch").isEnabled(), true));
    await click(page.locator("#eduopsClearSelection"), "clear-selection", async () => assert.equal(await page.locator("#eduopsOpenBatch").isDisabled(), true));
    await click(page.locator("#eduopsSelectAllReturned"), "select-eligible-page", async () => assert.equal(await page.locator("#eduopsOpenBatch").isEnabled(), true));
    await click(page.locator("#eduopsClearSelection"), "clear-page-selection", async () => assert.equal(await page.locator("#eduopsOpenBatch").isDisabled(), true));

    await fill(page.locator("#eduopsGlobalSearch"), "Waffi", "search-waffi", async () => page.waitForFunction(() => document.querySelector("#eduopsGlobalSearchResults")?.textContent.includes("Keziah Waffi")));
    await click(page.locator('[data-search-worklist="FODE-26-002959"]'), "search-open-worklist", async () => waitWorkload(page));
    await fill(page.locator("#eduopsGlobalSearch"), "Waffi", "search-waffi-again", async () => page.waitForFunction(() => document.querySelector("#eduopsGlobalSearchResults")?.textContent.includes("Keziah Waffi")));
    await click(page.locator('[data-search-open="FODE-26-002959"]'), "open-waffi-workbench", async () => page.waitForFunction(() => document.querySelector("#eduopsWorkbenchTitle")?.textContent.includes("Keziah Waffi")));
    journey("Open exact applicant");
    await inventory("waffi-workbench");

    await click(page.locator("#eduopsWorkbenchMore"), "audit-context", async () => assert.equal(await page.locator('[data-workbench-tab="audit"]').getAttribute("aria-selected"), "true"));
    await click(page.locator('[data-workbench-tab="overview"]'), "return-overview", async () => assert.equal(await page.locator('[data-workbench-tab="overview"]').getAttribute("aria-selected"), "true"));
    await click(page.locator('[data-workbench-tab-jump="documents"]'), "overview-open-documents", async () => page.waitForSelector(".eduops-document-preview img"));

    for (const tab of ["overview", "documents", "finance", "communications", "portal", "contactability", "audit"]) {
      await click(page.locator(`[data-workbench-tab="${tab}"]`), `workbench-tab-${tab}`, async () => assert.equal(await page.locator(`[data-workbench-tab="${tab}"]`).getAttribute("aria-selected"), "true"));
      if (tab === "documents") await page.waitForSelector(".eduops-document-preview img");
    }
    journey("Navigate all Workbench tabs");

    await click(page.locator('[data-workbench-tab="documents"]'), "return-to-documents", async () => page.waitForSelector(".eduops-document-preview img"));
    await inventory("document-gallery");
    const tiles = page.locator("[data-document-index]");
    const tileCount = await tiles.count();
    for (let index = 0; index < tileCount; index++) {
      await click(page.locator(`[data-document-index="${index}"]`), `document-tile-${index}`, async () => assert.equal(await page.locator(`[data-document-index="${index}"]`).getAttribute("aria-current"), "true"));
    }
    if (tileCount > 1) {
      await click(page.locator('[data-document-move="-1"]'), "document-previous", async () => assert.equal(await page.locator('[data-document-index="0"]').getAttribute("aria-current"), "true"));
      await click(page.locator('[data-document-move="1"]'), "document-next", async () => assert.equal(await page.locator('[data-document-index="1"]').getAttribute("aria-current"), "true"));
    }
    const documentStatus = await page.locator("[data-document-status] option").evaluateAll((items) => items.map((item) => item.value).find((value) => value && value !== "REVIEW_REQUIRED") || items[0]?.value || "");
    await select(page.locator("[data-document-status]"), documentStatus, "document-status", null);
    await fill(page.locator("[data-document-note]"), "Owner-proxy document review note", "document-note", null);
    await click(page.locator('[data-preview-command="DOCUMENT_REVIEW"][data-command-scope="all"]'), "document-overall-preview", async () => page.waitForSelector("#eduopsConfirmLayer:not([hidden])"));
    await click(page.locator("#eduopsConfirmCancel"), "cancel-document-overall-preview", async () => page.waitForFunction(() => document.querySelector("#eduopsConfirmLayer")?.hidden === true));
    await click(page.locator('[data-preview-command="DOCUMENT_REVIEW"]:not([data-command-scope])'), "document-selected-preview", async () => page.waitForSelector("#eduopsConfirmLayer:not([hidden])"));
    await click(page.locator("#eduopsConfirmCancel"), "cancel-document-selected-preview", async () => page.waitForFunction(() => document.querySelector("#eduopsConfirmLayer")?.hidden === true));
    await click(page.locator("[data-request-correction]"), "prepare-document-correction", async () => assert.equal(await page.locator('[data-workbench-tab="communications"]').getAttribute("aria-selected"), "true"));
    await click(page.locator('[data-workbench-tab="documents"]'), "documents-after-correction", async () => page.waitForSelector(".eduops-document-preview img"));
    await click(page.locator("[data-open-original]"), "open-original", async () => page.waitForFunction(() => /Canonical original action/.test(document.querySelector("#eduopsInteractionStatus")?.textContent || "")));
    journey("Review documents");

    await page.goBack();
    await page.waitForSelector("#eduopsConfirmLayer:not([hidden])");
    assert.equal(await page.locator("#eduopsWorkbench").isVisible(), true);
    await click(page.locator("#eduopsConfirmCancel"), "dirty-back-stay", async () => page.waitForFunction(() => document.querySelector("#eduopsConfirmLayer")?.hidden === true));
    assert.equal(await page.locator("[data-document-note]").inputValue(), "Owner-proxy document review note");
    journey("Test dirty Browser Back");

    await click(page.locator('[data-workbench-tab="communications"]'), "open-communications", null);
    await click(page.locator("[data-communication-template='recommended']"), "communication-template", null);
    await click(page.locator('[data-preview-command="SEND_INDIVIDUAL_COMMUNICATION"]'), "communication-preview", async () => page.waitForSelector("#eduopsConfirmLayer:not([hidden])"));
    await click(page.locator("#eduopsConfirmCancel"), "cancel-communication-preview", async () => page.waitForFunction(() => document.querySelector("#eduopsConfirmLayer")?.hidden === true));
    journey("Preview communication");

    await click(page.locator('[data-workbench-tab="finance"]'), "open-finance", null);
    if (await page.locator('[data-preview-command="FINANCE_EVIDENCE_DECISION"]').isEnabled()) {
      await select(page.locator("#eduopsFinanceDecision"), "VERIFIED", "finance-decision", null);
      await fill(page.locator("#eduopsFinanceNote"), "Evidence reviewed in Preview Lab", "finance-note", null);
      await click(page.locator('[data-preview-command="FINANCE_EVIDENCE_DECISION"]'), "finance-preview", async () => page.waitForSelector("#eduopsConfirmLayer:not([hidden])"));
      await click(page.locator("#eduopsConfirmCancel"), "cancel-finance-preview", async () => page.waitForFunction(() => document.querySelector("#eduopsConfirmLayer")?.hidden === true));
    }
    journey("Inspect guarded Finance operation");

    await click(page.locator('[data-workbench-tab="portal"]'), "open-portal", null);
    await select(page.locator("#eduopsPortalAction"), "RESET", "portal-action", null);
    await click(page.locator('[data-preview-command="PORTAL_ACCESS"]'), "portal-preview", async () => page.waitForSelector("#eduopsConfirmLayer:not([hidden])"));
    await click(page.locator("#eduopsConfirmCancel"), "cancel-portal-preview", async () => page.waitForFunction(() => document.querySelector("#eduopsConfirmLayer")?.hidden === true));
    journey("Inspect guarded Portal operation");

    await click(page.locator('[data-workbench-tab="contactability"]'), "open-contactability", null);
    await fill(page.locator("#eduopsCorrectedEmail"), "keziah.waffi.corrected@example.test", "corrected-email", null);
    await fill(page.locator("#eduopsContactReason"), "Owner-proxy correction review", "contact-reason", null);
    await click(page.locator('[data-preview-command="CONTACTABILITY_CORRECTION"]'), "contact-preview", async () => page.waitForSelector("#eduopsConfirmLayer:not([hidden])"));
    await click(page.locator("#eduopsConfirmCancel"), "cancel-contact-preview", async () => page.waitForFunction(() => document.querySelector("#eduopsConfirmLayer")?.hidden === true));
    journey("Correct email in simulated mode");

    await click(page.locator("#eduopsCloseWorkbench"), "close-dirty-workbench", async () => page.waitForSelector("#eduopsConfirmLayer:not([hidden])"));
    await click(page.locator("#eduopsConfirmProceed"), "discard-workbench-draft", async () => page.waitForFunction(() => document.querySelector("#eduopsWorkbench")?.hidden === true));

    await click(page.locator("#eduopsToggleFilters"), "open-filters-before-session", async () => assert.equal(await page.locator("#eduopsAdvancedFilters").isVisible(), true));
    await click(page.locator("#eduopsClearFilters"), "clear-search-before-session", async () => {
      await page.waitForFunction(() => document.querySelectorAll("#eduopsWorklistRows tr").length > 1 && !/Loading|Queued/.test(document.querySelector("#eduopsVisibleRange")?.textContent || ""), null, { timeout: 14000 });
    });
    await click(page.locator("#eduopsToggleFilters"), "close-filters-before-session", async () => assert.equal(await page.locator("#eduopsAdvancedFilters").isVisible(), false));

    await click(page.locator("#eduopsStartSession"), "start-work-session", async () => page.waitForSelector("#eduopsSessionBar:not([hidden])"));
    await click(page.locator("[data-session-skip]"), "session-skip", async () => page.waitForSelector("#eduopsSessionBar:not([hidden])"));
    await click(page.locator("[data-session-next]"), "session-complete-next", async () => page.waitForSelector("#eduopsSessionBar:not([hidden])"));
    await click(page.locator("[data-session-exit]"), "session-exit", async () => page.waitForFunction(() => document.querySelector("#eduopsWorkbench")?.hidden === true));
    journey("Complete Work Session progression");

    async function runBatch(scenario, expectedOutcome, openException) {
      await click(page.locator("#eduopsPreviewToggle"), `open-preview-controls-${scenario}`, async () => assert.equal(await page.locator("#eduopsPreviewTechnicalBody").isVisible(), true));
      await select(page.locator("#eduopsPreviewScenario"), scenario, `scenario-${scenario}`, async () => waitWorkload(page));
      await click(page.locator("#eduopsPreviewToggle"), `close-preview-controls-${scenario}`, async () => assert.equal(await page.locator("#eduopsPreviewTechnicalBody").isVisible(), false));
      await click(page.locator("#eduopsSelectVisible"), `select-batch-${scenario}`, async () => assert.equal(await page.locator("#eduopsOpenBatch").isEnabled(), true));
      await click(page.locator("#eduopsOpenBatch"), `open-batch-${scenario}`, async () => page.waitForSelector("#eduopsBatchWorkspace:not([hidden])"));
      await recordControl(page.locator('input[name="eduopsBatchOperation"]'), `batch-operation-${scenario}`, null, (element) => element.check());
      await click(page.locator("[data-batch-preview]"), `batch-preview-${scenario}`, async () => page.waitForSelector(".eduops-partition-card"));
      await click(page.locator("[data-batch-continue]"), `batch-review-${scenario}`, async () => page.waitForFunction(() => document.querySelector("#eduopsBatchSteps [data-batch-step='preview']")?.getAttribute("data-status") === "current"));
      await click(page.locator("[data-batch-step='partitions']"), `batch-step-back-${scenario}`, async () => page.waitForFunction(() => document.querySelector("#eduopsBatchSteps [data-batch-step='partitions']")?.getAttribute("data-status") === "current"));
      await click(page.locator("[data-batch-continue]"), `batch-step-forward-${scenario}`, async () => page.waitForFunction(() => document.querySelector("#eduopsBatchSteps [data-batch-step='preview']")?.getAttribute("data-status") === "current"));
      await click(page.locator("[data-batch-confirm]"), `batch-confirm-step-${scenario}`, async () => page.waitForFunction(() => document.querySelector("#eduopsBatchSteps [data-batch-step='confirm']")?.getAttribute("data-status") === "current"));
      await click(page.locator("[data-batch-execute]"), `batch-execute-${scenario}`, async () => page.waitForSelector("#eduopsConfirmLayer:not([hidden])"));
      await click(page.locator("#eduopsConfirmProceed"), `batch-confirm-execute-${scenario}`, async () => page.waitForFunction(() => document.querySelector("#eduopsBatchPanel")?.textContent.includes("RECEIPT-")));
      assert.match(await page.locator("#eduopsBatchPanel").innerText(), expectedOutcome);
      if (openException) {
        const exception = page.locator("#eduopsBatchPanel tr", { hasText: "BLOCKED" }).locator("[data-batch-open]");
        await click(exception, `batch-exception-open-${scenario}`, async () => page.waitForSelector("#eduopsWorkbench:not([hidden])"));
        await click(page.locator("#eduopsCloseWorkbench"), `close-batch-exception-${scenario}`, async () => page.waitForFunction(() => document.querySelector("#eduopsWorkbench")?.hidden === true));
      } else {
        await click(page.locator("[data-batch-close]"), `batch-close-${scenario}`, async () => waitWorkload(page));
      }
    }

    await runBatch("normal-authoritative", /COMPLETE/, false);
    journey("Run Batch success");
    await runBatch("partial-batch-failure", /PARTIAL/, true);
    journey("Run Batch partial failure");
    journey("Open exception in Workbench");

    await click(page.locator('[data-report="finance"]'), "module-finance-applicant-list", async () => waitReport(page, "Finance Operations"));
    if (await page.locator("[data-report-open-applicant]").count()) {
      await click(page.locator("[data-report-open-applicant]").first(), "module-open-applicant", async () => page.waitForSelector("#eduopsWorkbench:not([hidden])"));
      await click(page.locator("#eduopsCloseWorkbench"), "close-module-applicant", async () => page.waitForFunction(() => document.querySelector("#eduopsWorkbench")?.hidden === true));
    } else {
      await click(page.locator("#eduopsCloseReport"), "close-empty-finance-list", async () => page.waitForFunction(() => document.querySelector("#eduopsReportPanel")?.hidden === true));
    }

    const reports = [
      ["finance", "Finance Operations"], ["communications", "Communications"], ["portal", "Portal"], ["contactability", "Contactability"],
      ["lifecycle", "Global Lifecycle"], ["hidden", "Hidden"], ["summary", "Management Summary"], ["reports", "Reports"],
      ["audit-system", "Audit"], ["health", "System Health"], ["roles", "Roles"], ["approvals", "Assignments"], ["data-quality", "Data Quality"]
    ];
    for (const [kind, title] of reports) {
      await click(page.locator(`[data-report="${kind}"]`), `module-${kind}`, async () => waitReport(page, title));
      await inventory(`module-${kind}`);
      if (kind === "hidden") {
        await page.waitForFunction(() => !/Loading/.test(document.querySelector("#eduopsReportContent")?.textContent || ""));
        if (await page.locator("#eduopsReportContent summary").count()) await click(page.locator("#eduopsReportContent summary"), "hidden-exact-reasons", null);
      }
      if (["roles", "approvals", "data-quality"].includes(kind)) assert.match(await page.locator("#eduopsReportContent").innerText(), /Structural Preview/);
      else assert.doesNotMatch(await page.locator("#eduopsReportContent").innerText(), /This module is read-only or structural/);
      await click(page.locator("#eduopsCloseReport"), `close-module-${kind}`, async () => page.waitForFunction(() => document.querySelector("#eduopsReportPanel")?.hidden === true));
    }
    journey("Inspect Lifecycle"); journey("Inspect Management Summary"); journey("Inspect Reports"); journey("Inspect Audit"); journey("Inspect System Health"); journey("Confirm structural modules are visibly truthful");

    await click(page.locator("#eduopsPreviewToggle"), "open-preview-controls-source-failure", async () => assert.equal(await page.locator("#eduopsPreviewTechnicalBody").isVisible(), true));
    await select(page.locator("#eduopsPreviewScenario"), "source-unavailable", "scenario-source-unavailable", async () => {
      await page.waitForFunction(() => /source authority is unavailable/i.test(document.querySelector("#eduopsWorklistRows")?.textContent || ""), null, { timeout: 14000 });
    });
    await click(page.locator("#eduopsPreviewToggle"), "close-preview-controls-source-failure", async () => assert.equal(await page.locator("#eduopsPreviewTechnicalBody").isVisible(), false));
    await click(page.locator('[data-report="hidden"]'), "hidden-source-failure", async () => waitReport(page, "Hidden"));
    await page.waitForFunction(() => /source authority is unavailable/i.test(document.querySelector("#eduopsReportContent")?.textContent || ""), null, { timeout: 14000 });
    assert.doesNotMatch(await page.locator("#eduopsReportContent").innerText(), /Preview RPC failed/i);
    await click(page.locator("[data-retry-report='hidden']"), "retry-hidden-source-failure", async () => page.waitForFunction(() => /source authority is unavailable/i.test(document.querySelector("#eduopsReportContent")?.textContent || ""), null, { timeout: 14000 }));
    await click(page.locator("#eduopsCloseReport"), "close-hidden-source-failure", async () => page.waitForFunction(() => document.querySelector("#eduopsReportPanel")?.hidden === true));
    await click(page.locator("#eduopsPreviewToggle"), "open-preview-controls-reset-source", async () => assert.equal(await page.locator("#eduopsPreviewTechnicalBody").isVisible(), true));
    await select(page.locator("#eduopsPreviewScenario"), "normal-authoritative", "scenario-reset-source", async () => waitWorkload(page));
    await click(page.locator("#eduopsPreviewToggle"), "close-preview-controls-reset-source", async () => assert.equal(await page.locator("#eduopsPreviewTechnicalBody").isVisible(), false));
    journey("Hidden source failure is explicit and retryable");

    await click(page.locator("#eduopsPreviewToggle"), "open-preview-controls-fresh", async () => assert.equal(await page.locator("#eduopsPreviewTechnicalBody").isVisible(), true));
    const snapshotValue = await page.locator("#eduopsPreviewSnapshot option").evaluateAll((items) => items.map((item) => item.value).find(Boolean) || "");
    assert.ok(snapshotValue, "A compatible local Fresh FODE snapshot must be selectable");
    await select(page.locator("#eduopsPreviewSnapshot"), snapshotValue, "select-fresh-snapshot", null);
    await select(page.locator("#eduopsPreviewDataMode"), "snapshot", "fresh-snapshot-mode", async () => waitWorkload(page));
    assert.match(await page.locator("#eduopsPreviewModeBanner").innerText(), /CURRENT AS OF CAPTURE TIME/);
    journey("Select Fresh FODE Snapshot Mode");
    await select(page.locator("#eduopsPreviewDataMode"), "deterministic", "deterministic-mode", async () => waitWorkload(page));
    assert.match(await page.locator("#eduopsPreviewModeBanner").innerText(), /DETERMINISTIC SCENARIO DATA/);
    await click(page.locator("#eduopsPreviewToggle"), "close-preview-controls-final", async () => assert.equal(await page.locator("#eduopsPreviewTechnicalBody").isVisible(), false));
    journey("Return to deterministic mode");

    await click(page.locator("#eduopsOpenReconciliation"), "open-reconciliation", async () => waitReport(page, "reconciliation"));
    await page.waitForFunction(() => !/Loading/.test(document.querySelector("#eduopsReportContent")?.textContent || ""));
    await click(page.locator("#eduopsCloseReport"), "close-reconciliation", async () => page.waitForFunction(() => document.querySelector("#eduopsReportPanel")?.hidden === true));

    await inventory("final");
    const exercisedFamilies = new Map();
    Array.from(controls.values()).filter((item) => item.exercised).forEach((item) => exercisedFamilies.set(componentFamily(item.id), item.id));
    controls.forEach((item) => {
      const representative = exercisedFamilies.get(componentFamily(item.id));
      if (!item.exercised && !item.disabled && representative) {
        item.result = "PASS_SHARED_COMPONENT_CONTRACT";
        item.representativeControlId = representative;
      }
    });
    const unclassified = Array.from(controls.values()).filter((item) => item.classification === "UNCLASSIFIED");
    const uncovered = Array.from(controls.values()).filter((item) => item.result === "NOT_EXERCISED");
    assert.deepEqual(unclassified, [], "Every inventoried control must have exactly one classification");
    assert.deepEqual(uncovered, [], `Every control must be directly exercised, truthfully disabled or covered by an exercised shared component contract: ${uncovered.map((item) => item.id).join(", ")}`);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > document.documentElement.clientWidth + 2);
    assert.equal(overflow, false, "Owner-proxy viewport must not overflow horizontally");
    assert.deepEqual(consoleErrors, [], `Console errors: ${consoleErrors.join("\n")}`);
    assert.deepEqual(pageErrors, [], `Page errors: ${pageErrors.join("\n")}`);
    assert.deepEqual(failedRequests, [], `Failed requests: ${JSON.stringify(failedRequests)}`);
    const screenshotFiles = fs.readdirSync(screenshotRoot).filter((name) => name.endsWith(".png"));
    const invalidScreenshots = screenshotFiles.filter((name) => fs.readFileSync(path.join(screenshotRoot, name)).subarray(0, 8).toString("hex") !== "89504e470d0a1a0a");
    assert.deepEqual(invalidScreenshots, [], `Invalid PNG evidence: ${invalidScreenshots.join(", ")}`);

    const report = {
      runId,
      url: service.url,
      viewport: "1440x900",
      visibleUiOnly: true,
      journeys,
      controls: Array.from(controls.values()),
      counts: {
        journeysPassed: journeys.filter((item) => item.result === "PASS").length,
        controlContractsInventoried: controls.size,
        controlContractsExercised: Array.from(controls.values()).filter((item) => item.exercised).length,
        sharedComponentInstancesCovered: Array.from(controls.values()).filter((item) => item.result === "PASS_SHARED_COMPONENT_CONTRACT").length,
        truthfullyDisabled: Array.from(controls.values()).filter((item) => item.result === "TRUTHFULLY_DISABLED").length,
        failedOrUncovered: uncovered.length,
        unclassified: unclassified.length,
        screenshotFiles: screenshotFiles.length,
        pngIntegrityPassed: screenshotFiles.length - invalidScreenshots.length
      },
      consoleErrors,
      pageErrors,
      failedRequests,
      horizontalOverflow: overflow
    };
    fs.writeFileSync(path.join(evidenceRoot, "control-coverage.json"), JSON.stringify(report, null, 2));
    fs.writeFileSync(path.join(evidenceRoot, "console-log.json"), JSON.stringify(consoleLog, null, 2));
    await context.tracing.stop({ path: path.join(evidenceRoot, "trace.zip") });
    await page.close();
    await context.close();
    await browser.close();
    await new Promise((resolve) => service.server.close(resolve));
    const videoFiles = fs.readdirSync(videoRoot).filter((name) => name.endsWith(".webm"));
    assert.ok(videoFiles.length > 0, "Owner-proxy run must retain video evidence");
    console.log(`PASS ownerProxyJourneys=${journeys.length} controlContracts=${controls.size} exercised=${report.counts.controlContractsExercised} disabled=${report.counts.truthfullyDisabled} consoleErrors=0 pageErrors=0 failedRequests=0 evidence=${evidenceRoot}`);
  } catch (error) {
    try { await context.tracing.stop({ path: path.join(evidenceRoot, "trace-failed.zip") }); } catch (_) {}
    try { await shot("failure"); } catch (_) {}
    fs.writeFileSync(path.join(evidenceRoot, "failure.txt"), error.stack || String(error));
    try { await context.close(); } catch (_) {}
    try { await browser.close(); } catch (_) {}
    await new Promise((resolve) => service.server.close(resolve));
    throw error;
  }
}

main().catch((error) => { console.error(error.stack || error); process.exit(1); });
