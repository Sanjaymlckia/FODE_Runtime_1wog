const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const childProcess = require("node:child_process");

const previewRoot = path.resolve(__dirname, "..");
const evidenceDir = path.join(previewRoot, "evidence", "r368");
fs.mkdirSync(evidenceDir, { recursive: true });

const playwrightModule = process.env.FODE_PLAYWRIGHT_MODULE || "F:/Playwright/fode-secure-link-diagnostic/node_modules/playwright";
const { chromium } = require(playwrightModule);
const port = Number(process.env.EDUOPS_OPERATIONS_PREVIEW_PORT || 4183);
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

async function main() {
  const server = childProcess.spawn(process.execPath, [path.join(previewRoot, "server", "server.js")], {
    cwd: previewRoot,
    env: { ...process.env, EDUOPS_OPERATIONS_PREVIEW_PORT: String(port) },
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
    await shot(page, "baseline-1920x1080.png");

    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByRole("button", { name: "Proposed R368 redesign" }).waitFor({ timeout: 10000 });
    await shot(page, "redesign-1920x1080.png");
    await shot(page, "compact-summary.png", "[data-shot='compact-summary']");

    await page.getByText("Missing documents - applicant follow-up due").first().click();
    await page.locator("#searchBox").fill("FODE-26-002959");
    await page.getByText("Current work package: Payment follow-ups due").waitFor({ timeout: 10000 });
    await shot(page, "search-handoff-waffi.png", "[data-shot='search-handoff']");

    await page.getByText("Payment follow-ups due").first().click();
    await page.getByText("Keziah Waffi").waitFor({ timeout: 10000 });
    await page.locator("[data-expand]").first().evaluate((button) => button.click());
    await shot(page, "expanded-worklist-row.png", "[data-shot='expanded-worklist-row']");

    await page.getByText("Select eligible page").click();
    await page.getByText("Open Batch Operations").click();
    await page.getByRole("heading", { name: "Batch Operations" }).waitFor({ timeout: 10000 });
    await shot(page, "batch-preview.png");

    await page.locator("[data-workbench]").first().evaluate((button) => button.click());
    await page.getByText("Individual applicant workbench").waitFor({ timeout: 10000 });
    await shot(page, "individual-workbench.png");

    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(baseUrl, { waitUntil: "networkidle" });
    await page.getByText("Payment follow-ups due").first().click();
    await page.getByText("Keziah Waffi").waitFor({ timeout: 10000 });
    await shot(page, "redesign-1366x768.png");

    await browser.close();
    fs.writeFileSync(path.join(evidenceDir, "preview-server-startup.txt"), JSON.stringify({ ok: true, health, logs }, null, 2));
    console.log("PASS R368 EduOps Operations preview screenshots");
    console.log(baseUrl);
  } finally {
    server.kill();
  }
}

main().catch((err) => {
  console.error(err && err.stack || err);
  process.exit(1);
});
