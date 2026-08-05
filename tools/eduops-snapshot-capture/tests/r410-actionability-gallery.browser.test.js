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
  await page.waitForFunction(() => document.querySelector("#eduopsApp")?.getAttribute("aria-busy") === "false" && document.querySelectorAll("#eduopsWorklistRows tr[data-applicant-row]").length > 0, null, { timeout: 14000 });
}

async function chooseScenario(page, scenario) {
  await page.evaluate(() => document.querySelector("#eduopsPreviewToggle")?.click());
  await page.evaluate((value) => { const select = document.querySelector("#eduopsPreviewScenario"); if (select) { select.value = value; select.dispatchEvent(new Event("change", { bubbles: true })); } }, scenario);
  await waitWorkload(page);
  const all = page.locator('#eduopsHistoryNav [data-state="ALL"]');
  if (await all.count()) {
    await page.evaluate(() => document.querySelector('#eduopsHistoryNav [data-state="ALL"]')?.click());
    await waitWorkload(page);
  }
  await page.evaluate(() => document.querySelector("#eduopsPreviewToggle")?.click());
}

(async () => {
  const service = await start(0);
  const browser = await chromium.launch({ headless: true });
  let assertions = 0;
  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport });
      const external = [];
      page.on("request", (request) => {
        const url = request.url();
        if (!url.startsWith(service.url) && !url.startsWith("data:") && !url.startsWith("about:")) external.push(url);
      });
      await page.goto(service.url, { waitUntil: "domcontentloaded" });
      await waitWorkload(page);
      await chooseScenario(page, "r410-actionability-gallery");
      assert.equal(external.length, 0, `${viewport.label}: Preview remains offline`); assertions++;
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2), true, `${viewport.label}: no horizontal overflow`); assertions++;
      const workloadText = await page.locator("#eduopsWorklistRows").innerText();
      assert.match(workloadText, /R410 Uncontactable/i, `${viewport.label}: uncontactable fixture is visible`); assertions++;
      assert.match(workloadText, /Dormant \/ Re-engagement/i, `${viewport.label}: dormant fixture is visible`); assertions++;
      assert.match(workloadText, /No email recorded/i, `${viewport.label}: missing email is explicit`); assertions++;
      assert.doesNotMatch(workloadText, /No email recorded\s*\n\s*No email recorded/i, `${viewport.label}: contact display is not duplicated`); assertions++;
      const uncontactable = page.locator('[data-applicant-row="FODE-26-R410-UNCONTACTABLE"]');
      assert.equal(await uncontactable.locator("input[type=checkbox]").isDisabled(), true, `${viewport.label}: uncontactable row cannot be selected`); assertions++;
      await page.evaluate(() => document.querySelector('#eduopsHistoryNav [data-state="COMPLETE"]')?.click());
      await waitWorkload(page);
      const completed = page.locator('[data-applicant-row="FODE-26-002985"]');
      assert.match(await completed.innerText(), /Complete/i, `${viewport.label}: Jackson Numa remains complete`); assertions++;
      await page.evaluate(() => document.querySelector('#eduopsHistoryNav [data-state="ALL"]')?.click());
      await waitWorkload(page);
      await page.locator("#eduopsSearch").fill("FODE-26-R410-VERIFIED");
      await page.waitForFunction(() => document.querySelector('[data-applicant-row="FODE-26-R410-VERIFIED"]'), null, { timeout: 14000 });
      const verified = page.locator('[data-applicant-row="FODE-26-R410-VERIFIED"]');
      await verified.locator("[data-open-applicant]").click();
      await page.waitForSelector("#eduopsWorkbench:not([hidden])");
      assert.match(await page.locator(".eduops-primary-identity").innerText(), /docs\.verified@example\.test/i, `${viewport.label}: real recipient email is visible in the identity block`); assertions++;
      await page.locator('[data-workbench-tab="documents"]').click();
      await page.waitForFunction(() => document.querySelectorAll(".eduops-document-gallery [data-document-index]").length === 5, null, { timeout: 14000 });
      assert.equal(await page.locator(".eduops-document-gallery [data-document-index]").count(), 5, `${viewport.label}: all five document positions are visible together`); assertions++;
      const galleryText = await page.locator(".eduops-document-gallery").innerText();
      for (const label of ["Birth / ID / Passport", "Latest School Report", "Transfer Certificate", "Passport Photo", "Fee Receipt"]) {
        assert.match(galleryText, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"), `${viewport.label}: gallery includes ${label}`); assertions++;
      }
      assert.equal(await page.locator('[data-document-move="1"]').count(), 1, `${viewport.label}: Next remains a secondary navigation control`); assertions++;
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2), true, `${viewport.label}: gallery has no horizontal overflow`); assertions++;
      assert.doesNotMatch(await page.locator("body").innerText(), /Preview Applicant 00[0-9]/, `${viewport.label}: no generated fixture leakage is shown in the selected workbench`); assertions++;
      await page.locator("#eduopsCloseWorkbench").click();
      await page.waitForSelector("#eduopsWorkbench[hidden]", { state: "attached" });
      await page.close();
    }
    console.log(`PASS R410 actionability/document-gallery browser Preview (${assertions} assertions)`);
  } finally {
    await browser.close();
    await new Promise((resolve) => service.server.close(resolve));
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
