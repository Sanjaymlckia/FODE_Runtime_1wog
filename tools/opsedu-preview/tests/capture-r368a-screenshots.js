const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const previewRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(previewRoot, "evidence", "r368a");
fs.mkdirSync(evidenceDir, { recursive: true });

const playwrightModule = process.env.FODE_PLAYWRIGHT_MODULE || "F:/Playwright/fode-secure-link-diagnostic/node_modules/playwright";
const { chromium } = require(playwrightModule);
const port = Number(process.env.OPSEDU_PREVIEW_PORT || 4183);
const baseUrl = `http://127.0.0.1:${port}/`;

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHealth() {
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(`${baseUrl}health`);
      if (res.ok) return await res.json();
    } catch (_err) {}
    await wait(300);
  }
  throw new Error("Preview server did not become healthy");
}

async function shot(page, name, selector) {
  const target = selector ? page.locator(selector).first() : page;
  await target.screenshot({ path: path.join(evidenceDir, name) });
}

async function waitReady(page) {
  await page.getByText("OpsEdu Cockpit").waitFor({ timeout: 10000 });
  await page.getByText("Payment follow-ups due").first().waitFor({ timeout: 10000 });
}

async function clickPrimary(page, name) {
  await page.getByRole("button", { name: new RegExp(name) }).click();
  await page.waitForTimeout(250);
}

async function main() {
  const server = childProcess.spawn(process.execPath, [path.join(previewRoot, "server", "server.js")], {
    cwd: previewRoot,
    env: { ...process.env, OPSEDU_PREVIEW_PORT: String(port) },
    stdio: ["ignore", "pipe", "pipe"]
  });
  const logs = [];
  server.stdout.on("data", (data) => logs.push(data.toString()));
  server.stderr.on("data", (data) => logs.push(data.toString()));
  try {
    const health = await waitForHealth();
    assert.equal(health.ok, true, "preview server health must pass");
    assert.equal(health.snapshotPopulation, 332, "preview server must serve 332-applicant snapshot");

    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage({ viewport: { width: 1920, height: 1080 } });

    await page.goto(`${baseUrl}?mode=baseline`, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Accepted R367 baseline" }).waitFor({ timeout: 10000 });
    for (const group of ["Finance Operations", "Communications", "Portal", "Contactability", "Global Lifecycle", "Hidden / Other Routes", "Management Summary", "Reports", "Audit", "Roles & Capabilities"]) {
      await page.getByRole("heading", { name: group, exact: true }).waitFor({ timeout: 10000 });
    }
    await shot(page, "styling-comparison.png");

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await waitReady(page);
    await shot(page, "full-shell-1920x1080.png");
    await page.locator(".summary-actions").getByText("Expanded").click();
    await shot(page, "expanded-summary.png", "[data-shot='expanded-summary']");
    await page.locator(".summary-actions").getByText("Collapsed").click();
    await shot(page, "collapsed-summary.png", "[data-shot='collapsed-summary']");
    assert.equal(await page.locator("[data-primary]").count(), 8, "all eight primary buckets must remain accessible in collapsed summary");

    await page.locator(".rail-actions").getByText("Expanded").click();
    await shot(page, "expanded-package-rail.png", "[data-shot='expanded-package-rail']");
    await page.locator(".rail-actions").getByText("Collapsed").click();
    await shot(page, "collapsed-package-rail.png", "[data-shot='collapsed-package-rail']");
    await shot(page, "opaque-sticky-toolbar.png", "[data-shot='opaque-sticky-toolbar']");

    await page.locator(".rail-actions").getByText("Compact").click();
    await page.getByText("Payment follow-ups due").first().click();
    await page.getByText("Keziah Waffi").waitFor({ timeout: 10000 });
    await shot(page, "waffi-payment-followup.png", "[data-shot='waffi-payment-followup']");
    await shot(page, "compact-row.png", "[data-applicant='FODE-26-002959']");
    await page.locator("[data-expand='FODE-26-002959']").evaluate((button) => button.click());
    await shot(page, "expanded-row.png", "[data-shot='expanded-row']");

    await page.getByText("Missing documents - applicant follow-up due").first().click();
    await page.locator("#searchBox").fill("FODE-26-002959");
    await page.getByText("No result in Missing documents - applicant follow-up due.").waitFor({ timeout: 10000 });
    await page.getByText("Open correct work package").waitFor({ timeout: 10000 });
    await shot(page, "waffi-search-handoff.png", "[data-shot='waffi-search-handoff']");

    await page.getByText("Open correct work package").click();
    await page.getByText("Keziah Waffi").waitFor({ timeout: 10000 });
    await page.locator("[data-select='FODE-26-002959']").check();
    await page.getByText("Open Batch Operations").click();
    await page.getByRole("heading", { name: "Batch Operations" }).waitFor({ timeout: 10000 });
    await shot(page, "batch-preview.png");
    await page.getByText("Close").last().click();

    await page.locator("[data-workbench='FODE-26-002959']").evaluate((button) => button.click());
    await page.getByText("Loading applicant detail").waitFor({ timeout: 10000 });
    await page.waitForTimeout(250);
    await page.getByRole("heading", { name: "Keziah Waffi" }).waitFor({ timeout: 10000 });
    await page.getByText("Preview placeholder - not runtime content").waitFor({ timeout: 10000 });
    await shot(page, "individual-workbench.png");

    for (const [label, file, selector] of [
      ["Waiting for applicant", "empty-waiting-applicant.png", "[data-shot='empty-waiting-applicant']"],
      ["Waiting for payment", "empty-waiting-payment.png", "[data-shot='empty-waiting-payment']"],
      ["Blocked / intervention required", "empty-blocked.png", "[data-shot='empty-blocked']"],
      ["Classification required", "empty-classification-required.png", "[data-shot='empty-classification-required']"]
    ]) {
      await clickPrimary(page, label);
      await page.locator(selector).waitFor({ timeout: 10000 });
      assert.equal(await page.locator(".row").count(), 0, `${label} must leave zero stale rows`);
      assert.equal(await page.locator(".package-card.active").count(), 0, `${label} must leave zero active package cards`);
      assert.equal(await page.locator("[data-open-batch]:not([disabled])").count(), 0, `${label} must disable batch`);
      await shot(page, file, selector);
    }

    await page.goto(`${baseUrl}?state=loading`, { waitUntil: "domcontentloaded" });
    await page.getByText("Loading primary actionability").waitFor({ timeout: 10000 });
    await shot(page, "loading-state.png", "[data-shot='loading-state']");
    await page.goto(`${baseUrl}?state=error`, { waitUntil: "networkidle" });
    await page.getByText("Loading applicant workload failed").waitFor({ timeout: 10000 });
    await shot(page, "error-state.png", "[data-shot='error-state']");

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await waitReady(page);
    await page.locator(".rail-actions").getByText("Collapsed").click();
    await shot(page, "full-shell-1366x768.png");

    const toolbarStyle = await page.locator(".toolbar").evaluate((el) => {
      const style = getComputedStyle(el);
      return { backgroundColor: style.backgroundColor, position: style.position, zIndex: style.zIndex };
    });
    assert.notEqual(toolbarStyle.backgroundColor, "rgba(0, 0, 0, 0)", "toolbar must be opaque");
    assert.equal(toolbarStyle.position, "sticky", "toolbar must be sticky");
    assert.ok(Number(toolbarStyle.zIndex) >= 10, "toolbar must have stable stacking");

    await browser.close();
    fs.writeFileSync(path.join(evidenceDir, "preview-server-startup.txt"), JSON.stringify({ ok: true, health, logs }, null, 2));
    console.log("PASS R368A OpsEdu preview screenshots");
    console.log(baseUrl);
  } finally {
    server.kill();
  }
}

main().catch((err) => {
  console.error(err && err.stack || err);
  process.exit(1);
});
