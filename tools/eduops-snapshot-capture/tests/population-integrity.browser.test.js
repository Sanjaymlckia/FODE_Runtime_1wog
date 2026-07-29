const assert = require("node:assert/strict");
const { start } = require("../server/server");

const playwrightModule = process.env.FODE_PLAYWRIGHT_MODULE || "F:/Playwright/fode-secure-link-diagnostic/node_modules/playwright";
const { chromium } = require(playwrightModule);

(async () => {
  const service = await start(0);
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  const consoleErrors = [];
  const pageErrors = [];
  const rpcNames = [];

  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(message.text());
  });
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("request", (request) => {
    const marker = "/api/rpc/";
    const url = request.url();
    const index = url.indexOf(marker);
    if (index >= 0) rpcNames.push(decodeURIComponent(url.slice(index + marker.length).split(/[?#]/)[0]));
  });

  try {
    await page.addInitScript(() => {
      window.EDUOPS_REQUEST_TIMEOUT_MS = 3000;
      sessionStorage.setItem("eduopsPreviewDataMode", "deterministic");
      sessionStorage.setItem("eduopsPreviewScenario", "unsafe-duplicate-integrity");
      sessionStorage.setItem("eduopsPreviewLatencyMs", "0");
    });
    await page.goto(service.url, { waitUntil: "domcontentloaded" });
    await page.waitForFunction(() => {
      const app = window.EduOpsApp;
      const workload = app && app.state && app.state.workload;
      return document.querySelector("#eduopsApp")?.getAttribute("aria-busy") === "false"
        && app.bootstrapMachine?.state === "INTERACTIVE"
        && workload?.populationIntegrity?.status === "FAIL";
    }, null, { timeout: 14000 });

    const integrityState = await page.evaluate(() => ({
      topLevel: window.EduOpsApp.state.workload.populationIntegrity,
      nested: window.EduOpsApp.state.workload.reconciliation.populationIntegrity,
      reconciliationState: window.EduOpsApp.state.workload.reconciliation.integrityState,
      featureAvailability: window.EduOpsApp.state.operationAvailability.BATCH_COMMUNICATION,
      batchAuthorityValid: window.EduOpsApp.state.workloadRequest.batchAuthorityValid
    }));
    assert.equal(integrityState.topLevel.status, "FAIL");
    assert.equal(integrityState.topLevel.authoritySafeToBatch, false);
    assert.equal(integrityState.topLevel.blockCode, "DUPLICATE_APPLICANT_ID");
    assert.deepEqual(integrityState.nested, integrityState.topLevel);
    assert.equal(integrityState.reconciliationState, "FAIL");
    assert.equal(integrityState.featureAvailability.available, true, "Fixture feature availability remains permissive; the client population gate must independently fail closed");
    assert.equal(integrityState.batchAuthorityValid, false);
    assert.equal(await page.locator("[data-select-applicant]:not([disabled])").count(), 0, "Unsafe population integrity must disable Batch selection controls");

    const batchButton = page.locator("#eduopsOpenBatch");
    assert.equal(await batchButton.isDisabled(), true, "Unsafe integrity must disable Batch Operations");
    assert.match(await page.locator("#eduopsBatchReason").innerText(), /duplicate|integrity/i);

    await page.evaluate(() => document.querySelector("#eduopsOpenBatch").click());
    await page.evaluate(() => window.EduOpsApp.openBatch(document.querySelector("#eduopsOpenBatch")));
    assert.equal(await page.evaluate(() => window.EduOpsApp.state.batch), null, "The Batch workspace must not open under unsafe integrity");
    assert.equal(await page.locator("#eduopsBatchWorkspace").isHidden(), true);

    const forbiddenRpcs = [
      "eduops_getBatchCommunicationCatalogue",
      "eduops_previewCommand",
      "eduops_executeCommand"
    ];
    assert.deepEqual(rpcNames.filter((name) => forbiddenRpcs.includes(name)), [], "Blocked Batch controls must issue zero catalogue, preview or execution RPCs");
    assert.deepEqual(consoleErrors, [], `Console errors: ${consoleErrors.join("\n")}`);
    assert.deepEqual(pageErrors, [], `Page errors: ${pageErrors.join("\n")}`);
    console.log("PASS EduOps Preview population integrity unsafe=true batchDisabled=true commandRpcs=0 consoleErrors=0 pageErrors=0");
  } finally {
    await page.close();
    await browser.close();
    await new Promise((resolve) => service.server.close(resolve));
  }
})().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
