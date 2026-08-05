const assert = require("node:assert/strict");
const { start } = require("../server/server");
const { playwrightModule } = require("../../fode-playwright-path");
const { chromium } = require(playwrightModule());

const viewports = [
  { width: 1440, height: 900, label: "desktop" },
  { width: 390, height: 844, label: "390x844" },
  { width: 360, height: 740, label: "360x740" }
];

async function waitWorkload(page) {
  await page.waitForFunction(() => document.querySelector("#eduopsApp")?.getAttribute("aria-busy") === "false" && document.querySelectorAll("#eduopsWorklistRows tr").length > 0, null, { timeout: 14000 });
}
async function noOverflow(page) {
  return page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2);
}
async function chooseScenario(page, scenario, wait = true) {
  await page.evaluate(() => document.querySelector("#eduopsPreviewToggle")?.click());
  await page.evaluate((value) => { const select = document.querySelector("#eduopsPreviewScenario"); if (select) { select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); } }, scenario);
  if (wait) {
    await waitWorkload(page);
    await page.evaluate(() => document.querySelector("#eduopsPreviewToggle")?.click());
  }
}

(async () => {
  const service = await start(0);
  const browser = await chromium.launch({ headless: true });
  let assertions = 0;
  try {
    for (const viewport of viewports) {
      console.log(`R409 browser start ${viewport.label}`);
      const page = await browser.newPage({ viewport });
      const external = [];
      page.on("request", (request) => {
        const url = request.url();
        if (!url.startsWith(service.url) && !url.startsWith("data:") && !url.startsWith("about:")) external.push(url);
      });
      await page.goto(service.url, { waitUntil: "domcontentloaded" });
      await waitWorkload(page);
      assert.equal(external.length, 0, `${viewport.label}: Preview Lab must remain offline`); assertions++;
      assert.equal(await noOverflow(page), true, `${viewport.label}: no horizontal overflow`); assertions++;

      const firstRow = page.locator("#eduopsWorklistRows tr[data-applicant-row]").first();
      assert.match(await firstRow.innerText(), /jackson\.numa@example\.test/i, `${viewport.label}: valid recipient email is visible in the worklist`); assertions++;
      assert.doesNotMatch(await firstRow.innerText(), /^Email available$/im, `${viewport.label}: status must not be only Email available`); assertions++;
      await firstRow.locator("[data-open-applicant]").click();
      await page.waitForSelector("#eduopsWorkbench:not([hidden])");
      assert.match(await page.locator(".eduops-primary-identity").innerText(), /jackson\.numa@example\.test/i, `${viewport.label}: Workbench identity block shows the authoritative recipient`); assertions++;
      await page.evaluate(() => document.querySelector('[data-workbench-tab="communications"]')?.click());
      await page.waitForFunction(() => document.querySelector('[data-workbench-tab="communications"]')?.getAttribute("aria-selected") === "true");
      assert.equal(await page.locator("#eduopsCommRecipient").inputValue(), "jackson.numa@example.test", `${viewport.label}: communication recipient matches the selected applicant`); assertions++;
      await page.locator("#eduopsCloseWorkbench").click();
      await page.waitForFunction(() => document.querySelector("#eduopsWorkbench")?.hidden === true);

      await chooseScenario(page, "contactability-failure");
      console.log(`R409 browser scenario contactability-failure ${viewport.label}`);
      const noEmailRow = page.locator('#eduopsWorklistRows tr[data-applicant-row="FODE-26-CONTACT-001"]');
      assert.match(await noEmailRow.innerText(), /No email recorded/i, `${viewport.label}: missing email is explicit`); assertions++;
      await noEmailRow.locator("[data-open-applicant]").click();
      await page.waitForSelector("#eduopsWorkbench:not([hidden])");
      await page.waitForFunction(() => document.querySelector("#eduopsWorkbenchTitle")?.textContent.includes("Contactability Failure Fixture"), null, { timeout: 14000 });
      assert.match(await page.locator(".eduops-primary-identity").innerText(), /No email recorded/i, `${viewport.label}: missing recipient is explicit in the Workbench identity block`); assertions++;
      assert.equal(await page.evaluate(() => window.EduOpsApp.state.workbench.contactability.hasValidEmail), false, `${viewport.label}: contactability authority marks the recipient unavailable`); assertions++;
      await page.locator("#eduopsCloseWorkbench").click();
      await page.waitForFunction(() => document.querySelector("#eduopsWorkbench")?.hidden === true);

      await chooseScenario(page, "long-display-values");
      console.log(`R409 browser scenario long-display-values ${viewport.label}`);
      const longRow = page.locator('#eduopsWorklistRows tr[data-applicant-row="FODE-26-LONG-001"]');
      assert.match(await longRow.innerText(), /alexandria-mary-jane applicant/i, `${viewport.label}: long applicant value is rendered`); assertions++;
      assert.match(await longRow.innerText(), /deliberately\.long\.recipient/i, `${viewport.label}: long recipient value remains visible`); assertions++;
      assert.equal(await noOverflow(page), true, `${viewport.label}: long values do not create horizontal overflow`); assertions++;

      await chooseScenario(page, "slow-6s", false);
      console.log(`R409 browser scenario slow-6s ${viewport.label}`);
      await page.waitForFunction(() => /LOADING|Loading applicant workload|Loading requested workload/i.test(document.querySelector("#eduopsWorklistRows")?.textContent || ""), null, { timeout: 3000 });
      await page.evaluate(() => document.querySelector("#eduopsPreviewToggle")?.click());
      assert.match(await page.locator("#eduopsWorklistRows").innerText(), /Loading applicant workload|Loading requested workload/i, `${viewport.label}: loading state clears stale rows`); assertions++;
      await waitWorkload(page);
    }
    console.log(`PASS R409 EduOps UI clarity browser preview (${assertions} assertions)`);
  } finally {
    await browser.close();
    await new Promise((resolve) => service.server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
