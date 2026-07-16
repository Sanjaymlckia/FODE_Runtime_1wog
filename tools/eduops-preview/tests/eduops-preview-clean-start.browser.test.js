const assert = require("node:assert/strict");
const childProcess = require("node:child_process");
const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");

const playwrightModule = process.env.FODE_PLAYWRIGHT_MODULE || "F:/Playwright/fode-secure-link-diagnostic/node_modules/playwright";
const { chromium } = require(playwrightModule);

const previewRoot = path.resolve(__dirname, "..");
const repoRoot = path.resolve(previewRoot, "..", "..");
const startCommand = path.join(previewRoot, "START_EDUOPS_PREVIEW.cmd");
const stopCommand = path.join(previewRoot, "STOP_EDUOPS_PREVIEW.cmd");
const previewUrl = "http://localhost:4173/";
const healthUrl = "http://127.0.0.1:4173/health";
const clientFiles = ["EduOps_ClientCore.html", "EduOps_ClientComponents.html", "EduOps_ClientWorkbench.html", "EduOps_ClientBatch.html", "EduOps_Client.html"];
const viewports = [{ width: 1366, height: 768 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }];
const headed = process.env.EDUOPS_CLEAN_START_HEADED === "1";
const runId = `clean-start-${headed ? "headed" : "automated"}-${new Date().toISOString().replace(/[:.]/g, "-")}`;
const evidenceRoot = path.join(previewRoot, "evidence", runId);

fs.mkdirSync(evidenceRoot, { recursive: true });

function sha256(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function command(file, extraEnv = {}) {
  const startedAt = Date.now();
  const result = childProcess.spawnSync(file, [], {
    shell: true,
    stdio: "ignore",
    timeout: 20000,
    env: { ...process.env, ...extraEnv }
  });
  return {
    durationMs: Date.now() - startedAt,
    status: result.status,
    signal: result.signal,
    error: result.error ? result.error.message : ""
  };
}

function getJson(url, timeoutMs = 2000) {
  return new Promise((resolve, reject) => {
    const request = http.get(url, { timeout: timeoutMs, headers: { "Cache-Control": "no-cache" } }, (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => { body += chunk; });
      response.on("end", () => {
        try {
          resolve({ statusCode: response.statusCode, body: JSON.parse(body) });
        } catch (error) {
          reject(error);
        }
      });
    });
    request.on("timeout", () => request.destroy(new Error("Health request timed out")));
    request.on("error", reject);
  });
}

async function waitForHealth(timeoutMs = 5000) {
  const startedAt = Date.now();
  let lastError = "";
  while (Date.now() - startedAt < timeoutMs) {
    try {
      const result = await getJson(healthUrl);
      if (result.statusCode === 200 && result.body.ok) return { durationMs: Date.now() - startedAt, health: result.body };
      lastError = `HTTP ${result.statusCode}`;
    } catch (error) {
      lastError = error.message || String(error);
    }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`Preview health did not resolve: ${lastError}`);
}

async function assertPortClosed() {
  try {
    await getJson(healthUrl, 500);
    assert.fail("Preview port 4173 must be closed");
  } catch (error) {
    if (error.code === "ERR_ASSERTION") throw error;
  }
}

async function waitWorkload(page) {
  await page.waitForFunction(() => {
    const app = document.querySelector("#eduopsApp");
    const rows = document.querySelectorAll("#eduopsWorklistRows tr");
    const range = document.querySelector("#eduopsVisibleRange")?.textContent || "";
    return app?.getAttribute("aria-busy") === "false" && rows.length > 0 && !/Loading|Queued/.test(range);
  }, null, { timeout: 12000 });
}

async function waitReport(page, text) {
  await page.waitForSelector("#eduopsReportPanel:not([hidden])");
  if (text) {
    await page.waitForFunction((value) => (document.querySelector("#eduopsReportTitle")?.textContent || "").toLowerCase().includes(value.toLowerCase()), text);
  }
}

async function closeReport(page) {
  await page.locator("#eduopsCloseReport").click();
  await page.waitForFunction(() => document.querySelector("#eduopsReportPanel")?.hidden === true);
}

async function runVisibleSmoke(page, includeBootstrapFailureRecovery) {
  const controls = [];
  async function click(locator, name, expected) {
    const target = locator.first();
    await target.waitFor({ state: "visible" });
    assert.equal(await target.isEnabled(), true, `${name} must be enabled`);
    await target.click();
    if (expected) await expected();
    controls.push(name);
  }
  async function select(locator, value, name, expected) {
    const target = locator.first();
    await target.waitFor({ state: "visible" });
    assert.equal(await target.isEnabled(), true, `${name} must be enabled`);
    await target.selectOption(value);
    if (expected) await expected();
    controls.push(name);
  }
  async function fill(locator, value, name, expected) {
    const target = locator.first();
    await target.waitFor({ state: "visible" });
    assert.equal(await target.isEnabled(), true, `${name} must be enabled`);
    await target.fill(value);
    if (expected) await expected();
    controls.push(name);
  }

  await click(page.locator("#eduopsSafetyDetails"), "View authority controls", () => waitReport(page, "System Health"));
  await closeReport(page);
  await click(page.locator("#eduopsRefreshAuthority"), "Refresh source", () => waitWorkload(page));
  await select(page.locator("#eduopsProductSwitcher"), "KIA", "Product KIA", () => waitWorkload(page));
  await select(page.locator("#eduopsProductSwitcher"), "FODE", "Product FODE", () => waitWorkload(page));
  await click(page.locator("#eduopsRailCollapse"), "Collapse rail", async () => assert.equal(await page.locator("#eduopsApp").getAttribute("data-rail-collapsed"), "true"));
  await click(page.locator("#eduopsRailCollapse"), "Expand rail", async () => assert.notEqual(await page.locator("#eduopsApp").getAttribute("data-rail-collapsed"), "true"));
  await click(page.locator('#eduopsActionNav [data-state="COOLING_OFF"]'), "Actionability Cooling Off", () => waitWorkload(page));
  await click(page.locator('#eduopsActionNav [data-state="READY"]'), "Actionability Ready", () => waitWorkload(page));

  const worklistValue = await page.locator("#eduopsWorklistKeys [data-worklist]").evaluateAll((nodes) => nodes.map((node) => node.getAttribute("data-worklist")).find(Boolean) || "");
  if (worklistValue) {
    await click(page.locator(`#eduopsWorklistKeys [data-worklist="${worklistValue}"]`), "Worklist key", () => waitWorkload(page));
    await click(page.locator('#eduopsWorklistKeys [data-worklist=""]'), "Worklist reset", () => waitWorkload(page));
  }
  await click(page.locator('[data-work-scope="ESCALATED"]'), "Escalated scope", () => waitWorkload(page));
  await click(page.locator('[data-work-scope="ALL_AUTHORISED"]'), "All Authorised scope", () => waitWorkload(page));
  await click(page.locator("#eduopsRefreshSnapshot"), "Refresh workload", () => waitWorkload(page));

  await fill(page.locator("#eduopsGlobalSearch"), "Waffi", "Global applicant search", () => page.waitForFunction(() => document.querySelector("#eduopsGlobalSearchResults")?.textContent.includes("Keziah Waffi")));
  await fill(page.locator("#eduopsGlobalSearch"), "", "Clear global applicant search", () => page.waitForFunction(() => document.querySelector("#eduopsGlobalSearchResults")?.textContent.includes("Search the active product")));
  await fill(page.locator("#eduopsSearch"), "Jackson", "Workload search", () => page.waitForFunction(() => document.querySelector("#eduopsWorklistRows")?.textContent.includes("Jackson Numa")));
  await click(page.locator("#eduopsToggleFilters"), "More filters", async () => assert.equal(await page.locator("#eduopsAdvancedFilters").isVisible(), true));
  await click(page.locator("#eduopsClearFilters"), "Clear filters after search", () => waitWorkload(page));

  const ownerValue = await page.locator("#eduopsOwnerFilter option").evaluateAll((nodes) => nodes.map((node) => node.value).find(Boolean) || "");
  if (ownerValue) {
    await select(page.locator("#eduopsOwnerFilter"), ownerValue, "Owner filter", () => waitWorkload(page));
    await click(page.locator("#eduopsClearFilters"), "Clear owner filter", () => waitWorkload(page));
  }
  const urgencyValue = await page.locator("#eduopsUrgencyFilter option").evaluateAll((nodes) => nodes.map((node) => node.value).find(Boolean) || "");
  if (urgencyValue) {
    await select(page.locator("#eduopsUrgencyFilter"), urgencyValue, "Urgency filter", () => waitWorkload(page));
    await click(page.locator("#eduopsClearFilters"), "Clear urgency filter", () => waitWorkload(page));
  }
  await select(page.locator("#eduopsSort"), "name:asc", "Sort by applicant name", () => waitWorkload(page));
  await click(page.locator("#eduopsToggleFilters"), "Close filters", async () => assert.equal(await page.locator("#eduopsAdvancedFilters").isVisible(), false));

  await click(page.locator("#eduopsSelectVisible"), "Select visible", async () => assert.match(await page.locator("#eduopsSelectionSummary").innerText(), /selected/i));
  await click(page.locator("#eduopsClearSelection"), "Clear selection", async () => assert.match(await page.locator("#eduopsSelectionSummary").innerText(), /0 selected/i));
  await click(page.locator("#eduopsWorklistRows [data-open-applicant]"), "Open applicant", async () => {
    await page.waitForSelector("#eduopsWorkbench:not([hidden])");
    await page.waitForFunction(() => location.hash.startsWith("#workbench="));
  });
  await page.goBack();
  await page.waitForFunction(() => document.querySelector("#eduopsWorkbench")?.hidden === true);
  controls.push("Browser Back from clean Workbench");
  await click(page.locator("#eduopsWorklistRows [data-open-applicant]"), "Reopen applicant", async () => {
    await page.waitForSelector("#eduopsWorkbench:not([hidden])");
    await page.waitForFunction(() => location.hash.startsWith("#workbench="));
  });
  await click(page.locator("#eduopsCloseWorkbench"), "Close Workbench", () => page.waitForFunction(() => document.querySelector("#eduopsWorkbench")?.hidden === true));

  await click(page.locator("#eduopsStartSession"), "Start Work Session", () => page.waitForSelector("#eduopsSessionBar:not([hidden])"));
  await click(page.locator("[data-session-exit]"), "Exit Work Session", () => page.waitForFunction(() => document.querySelector("#eduopsWorkbench")?.hidden === true));
  await click(page.locator("#eduopsOpenReconciliation"), "Open reconciliation", () => waitReport(page, "reconciliation"));
  await closeReport(page);

  const reports = [
    ["finance", "Finance Operations"],
    ["communications", "Communications"],
    ["portal", "Portal"],
    ["contactability", "Contactability"],
    ["lifecycle", "Global Lifecycle"],
    ["hidden", "Hidden"],
    ["summary", "Management Summary"],
    ["reports", "Reports"],
    ["audit-system", "Audit"],
    ["roles", "Roles"],
    ["approvals", "Assignments"],
    ["data-quality", "Data Quality"],
    ["health", "System Health"]
  ];
  for (const [kind, title] of reports) {
    await click(page.locator(`[data-report="${kind}"]`), `Menu ${title}`, () => waitReport(page, title));
    await closeReport(page);
  }

  if (includeBootstrapFailureRecovery) {
    await click(page.locator("#eduopsPreviewToggle"), "Open technical controls for failure proof", async () => assert.equal(await page.locator("#eduopsPreviewTechnicalBody").isVisible(), true));
    await select(page.locator("#eduopsPreviewScenario"), "source-unavailable", "Select source unavailable", () => page.waitForFunction(() => /source authority is unavailable/i.test(document.querySelector("#eduopsWorklistRows")?.textContent || "")));
    await page.reload({ waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => /_ERROR$|TIMEOUT/.test(document.querySelector("#eduopsApp")?.getAttribute("data-bootstrap-state") || ""), null, { timeout: 12000 });
    assert.match(await page.locator("#eduopsReliabilityBanner").innerText(), /Authority source unavailable/i);
    assert.notEqual(await page.locator("#eduopsSnapshotShort").innerText(), "Snapshot loading");
    assert.equal(await page.locator("#eduopsRefreshSnapshot").isDisabled(), true);
    assert.equal(await page.locator("#eduopsRefreshAuthority").isEnabled(), true);
    const eventCount = await page.evaluate(() => window.__EDUOPS_BOOTSTRAP_DIAGNOSTICS__.events.length);
    await click(page.locator("[data-retry-bootstrap]"), "Retry unavailable source", () => page.waitForFunction((count) => window.__EDUOPS_BOOTSTRAP_DIAGNOSTICS__.events.length > count && /_ERROR$|TIMEOUT/.test(window.__EDUOPS_BOOTSTRAP_DIAGNOSTICS__.state), eventCount));
    await click(page.locator("#eduopsPreviewToggle"), "Open technical controls for recovery", async () => assert.equal(await page.locator("#eduopsPreviewTechnicalBody").isVisible(), true));
    await select(page.locator("#eduopsPreviewScenario"), "normal-authoritative", "Restore authoritative scenario", async () => {
      await page.waitForFunction(() => document.querySelector("#eduopsApp")?.getAttribute("data-bootstrap-state") === "INTERACTIVE", null, { timeout: 12000 });
      await waitWorkload(page);
    });
    await click(page.locator("#eduopsPreviewToggle"), "Close technical controls after recovery", async () => assert.equal(await page.locator("#eduopsPreviewTechnicalBody").isVisible(), false));
  }

  assert.equal(await page.locator("#eduopsApp").getAttribute("data-bootstrap-state"), "INTERACTIVE");
  assert.ok(await page.locator("#eduopsWorklistRows tr").count() > 0);
  return controls;
}

async function runCleanStart(index, viewport) {
  const runRoot = path.join(evidenceRoot, `run-${index + 1}-${viewport.width}x${viewport.height}`);
  const videoRoot = path.join(runRoot, "video");
  fs.mkdirSync(videoRoot, { recursive: true });

  const stopBefore = command(stopCommand);
  assert.equal(stopBefore.status, 0, `Run ${index + 1} pre-stop must pass`);
  await assertPortClosed();

  const browser = await chromium.launch({ headless: !headed });
  const context = await browser.newContext({ viewport, recordVideo: { dir: videoRoot, size: viewport } });
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  const page = await context.newPage();
  const cdp = await context.newCDPSession(page);
  await cdp.send("Network.enable");
  await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
  const consoleErrors = [];
  const pageErrors = [];
  const failedRequests = [];
  page.on("console", (message) => { if (message.type() === "error") consoleErrors.push(message.text()); });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push({ url: request.url(), error: request.failure()?.errorText || "unknown" }));

  let result;
  try {
    await page.goto(`data:text/html,${encodeURIComponent(`<title>EduOps clean start ${index + 1}</title><h1>Preview Lab stopped</h1><p>Owner command has not started.</p>`)}`);
    await page.screenshot({ path: path.join(runRoot, "00-before-owner-start.png") });

    const startResult = command(startCommand, { EDUOPS_PREVIEW_NO_BROWSER: "1" });
    assert.equal(startResult.status, 0, `Run ${index + 1} owner start command must pass: ${startResult.error}`);
    const ready = await waitForHealth();
    const health = ready.health;
    assert.equal(health.serverReady, true);
    assert.equal(health.applicationAssetsReady, true);
    assert.equal(health.sharedClientReady, true);
    assert.equal(health.previewTransportReady, true);
    const runtimeClientSource = clientFiles.map((file) => fs.readFileSync(path.join(repoRoot, file), "utf8")).join("\n");
    assert.equal(health.runtimeClientInputHash, sha256(runtimeClientSource), "Health must identify the exact runtime client inputs");

    const navigationStartedAt = Date.now();
    await page.goto(previewUrl, { waitUntil: "domcontentloaded" });
    await page.screenshot({ path: path.join(runRoot, "01-initial-shell.png") });
    const initial = await page.evaluate(() => ({
      url: location.href,
      localStorage: Object.fromEntries(Object.entries(localStorage)),
      sessionStorage: Object.fromEntries(Object.entries(sessionStorage)),
      activeScenario: document.querySelector("#eduopsPreviewScenario")?.value || "",
      selectedTransport: typeof window.EDUOPS_TRANSPORT?.call === "function" ? "PREVIEW_TRANSPORT" : "MISSING",
      bootstrapState: window.__EDUOPS_BOOTSTRAP_DIAGNOSTICS__?.state || "",
      requestState: window.EduOpsApp?.bootstrapRequestState?.() || null,
      snapshotText: document.querySelector("#eduopsSnapshotShort")?.textContent || "",
      sourceText: document.querySelector("#eduopsReliabilityBanner")?.textContent || ""
    }));
    assert.deepEqual(initial.localStorage, {}, "Clean start localStorage must be empty");
    assert.deepEqual(initial.sessionStorage, {}, "Clean start sessionStorage must be empty");
    assert.equal(initial.activeScenario, "normal-authoritative");
    assert.equal(initial.selectedTransport, "PREVIEW_TRANSPORT");

    await page.waitForFunction(() => document.querySelector("#eduopsApp")?.getAttribute("data-bootstrap-state") === "INTERACTIVE", null, { timeout: 12000 });
    await waitWorkload(page);
    const interactiveMs = Date.now() - navigationStartedAt;
    const diagnostics = await page.evaluate(async () => ({
      bootstrap: window.__EDUOPS_BOOTSTRAP_DIAGNOSTICS__,
      requestState: window.EduOpsApp.bootstrapRequestState(),
      requestDiagnostics: window.EduOpsApp.state.requestDiagnostics,
      snapshotText: document.querySelector("#eduopsSnapshotShort")?.textContent || "",
      sourceText: document.querySelector("#eduopsReliabilityBanner")?.textContent || "",
      rowCount: document.querySelectorAll("#eduopsWorklistRows tr").length,
      ariaBusy: document.querySelector("#eduopsApp")?.getAttribute("aria-busy"),
      serviceWorkers: "serviceWorker" in navigator ? (await navigator.serviceWorker.getRegistrations()).length : 0,
      horizontalOverflow: document.documentElement.scrollWidth > document.documentElement.clientWidth + 2
    }));
    assert.notEqual(diagnostics.snapshotText, "Snapshot loading");
    assert.doesNotMatch(diagnostics.sourceText, /Authority source loading/);
    assert.equal(diagnostics.ariaBusy, "false");
    assert.ok(diagnostics.rowCount > 0);
    assert.equal(diagnostics.requestState.activeRequestId, null);
    assert.equal(diagnostics.requestState.queuedRequestId, null);
    assert.equal(diagnostics.requestState.unresolvedRequests, 0);
    assert.equal(diagnostics.serviceWorkers, 0);
    assert.equal(diagnostics.horizontalOverflow, false);

    await page.screenshot({ path: path.join(runRoot, "02-interactive.png") });
    const controls = await runVisibleSmoke(page, index === 0);
    await page.screenshot({ path: path.join(runRoot, "03-smoke-complete.png") });
    assert.deepEqual(consoleErrors, []);
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(failedRequests, []);

    result = {
      run: index + 1,
      viewport: `${viewport.width}x${viewport.height}`,
      headed,
      startCommandDurationMs: startResult.durationMs,
      healthAfterCommandMs: ready.durationMs,
      interactiveMs,
      health,
      initial,
      bootstrapEvents: diagnostics.bootstrap.events,
      requestDiagnostics: diagnostics.requestDiagnostics,
      unresolvedRequests: diagnostics.requestState.unresolvedRequests,
      rowCount: diagnostics.rowCount,
      controls,
      controlsExercised: controls.length,
      consoleErrors,
      pageErrors,
      failedRequests,
      horizontalOverflow: diagnostics.horizontalOverflow
    };
    fs.writeFileSync(path.join(runRoot, "RUN_RESULT.json"), JSON.stringify(result, null, 2));
    await context.tracing.stop({ path: path.join(runRoot, "trace.zip") });
  } catch (error) {
    try { await page.screenshot({ path: path.join(runRoot, "failure.png") }); } catch (_) {}
    try { await context.tracing.stop({ path: path.join(runRoot, "trace-failed.zip") }); } catch (_) {}
    fs.writeFileSync(path.join(runRoot, "failure.txt"), error.stack || String(error));
    throw error;
  } finally {
    await page.close().catch(() => {});
    await context.close().catch(() => {});
    await browser.close().catch(() => {});
    const stopAfter = command(stopCommand);
    assert.equal(stopAfter.status, 0, `Run ${index + 1} post-stop must pass`);
    await assertPortClosed();
  }
  return result;
}

(async () => {
  const results = [];
  for (let index = 0; index < viewports.length; index++) {
    results.push(await runCleanStart(index, viewports[index]));
  }

  const occupiedStart = command(startCommand, { EDUOPS_PREVIEW_NO_BROWSER: "1" });
  assert.equal(occupiedStart.status, 0, "Control start for occupied-port proof must pass");
  const duplicateStart = command(startCommand, { EDUOPS_PREVIEW_NO_BROWSER: "1" });
  assert.notEqual(duplicateStart.status, 0, "A second owner start must fail closed while port 4173 is occupied");
  assert.equal(command(stopCommand).status, 0);
  await assertPortClosed();

  const summary = {
    runId,
    headed,
    ownerCommandsOnly: true,
    visibleUiOnly: true,
    reusedServer: false,
    reusedBrowserContext: false,
    results,
    occupiedPortFailClosed: true,
    totalControlsExercised: results.reduce((sum, item) => sum + item.controlsExercised, 0),
    consoleErrors: results.flatMap((item) => item.consoleErrors),
    pageErrors: results.flatMap((item) => item.pageErrors),
    failedRequests: results.flatMap((item) => item.failedRequests),
    unresolvedRequests: results.reduce((sum, item) => sum + item.unresolvedRequests, 0)
  };
  fs.writeFileSync(path.join(evidenceRoot, "RUN_SUMMARY.json"), JSON.stringify(summary, null, 2));
  console.log(`PASS cleanStarts=3 headed=${headed} controls=${summary.totalControlsExercised} consoleErrors=0 pageErrors=0 failedRequests=0 unresolvedRequests=0 evidence=${evidenceRoot}`);
})().catch((error) => {
  command(stopCommand);
  console.error(error.stack || error);
  process.exit(1);
});
