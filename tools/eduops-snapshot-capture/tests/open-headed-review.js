const playwrightModule = process.env.FODE_PLAYWRIGHT_MODULE || "F:/Playwright/fode-secure-link-diagnostic/node_modules/playwright";
const { chromium } = require(playwrightModule);

(async () => {
  const browser = await chromium.launch({ headless: false });
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.goto(process.env.EDUOPS_PREVIEW_URL || "http://localhost:4173/", { waitUntil: "domcontentloaded" });
  console.log("Headed EduOps Preview Lab opened. Close the browser window to end this review session.");
})();
