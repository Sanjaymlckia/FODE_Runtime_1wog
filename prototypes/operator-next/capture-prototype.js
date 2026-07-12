const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { chromium } = require('F:/Playwright/fode-secure-link-diagnostic/node_modules/playwright');

const root = path.resolve(__dirname);
const evidence = path.join(root, 'evidence', 'pass1-correction');
const url = pathToFileURL(path.join(root, 'operator-next-prototype.html')).href;

async function route(page, key) {
  await page.locator(`#nav button[data-route="${key}"]`).click();
  await page.locator(`#route-${key}.active`).waitFor();
}

(async () => {
  fs.mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true });

  const wide = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  wide.setDefaultTimeout(6000);
  await wide.goto(url);
  await wide.locator('[data-stage="INCOMPLETE_DOCUMENTS"]').click();
  await wide.screenshot({ path: path.join(evidence, '01-wide-lifecycle-map.png'), fullPage: true });
  await route(wide, 'dashboard');
  await wide.screenshot({ path: path.join(evidence, '02-wide-operational-dashboard.png'), fullPage: true });

  const laptop = await browser.newPage({ viewport: { width: 1180, height: 900 } });
  laptop.setDefaultTimeout(6000);
  await laptop.goto(url);
  await route(laptop, 'applicant-action');
  await laptop.locator('#applicantQueue .reviewBtn').first().click();
  await laptop.screenshot({ path: path.join(evidence, '03-laptop-review-handoff.png') });
  await laptop.locator('[data-close="reviewOverlay"]').first().click();
  await route(laptop, 'communications');
  await laptop.screenshot({ path: path.join(evidence, '04-laptop-communications.png'), fullPage: true });
  await route(laptop, 'system-health');
  await laptop.screenshot({ path: path.join(evidence, '05-laptop-system-health.png'), fullPage: true });
  await route(laptop, 'roles');
  await laptop.screenshot({ path: path.join(evidence, '06-laptop-role-capabilities.png'), fullPage: true });
  await route(laptop, 'contactability');
  await laptop.locator('#contactQueue [data-select-all="contact"]').click();
  await laptop.screenshot({ path: path.join(evidence, '07-laptop-contactability-vcf.png'), fullPage: true });

  const narrow = await browser.newPage({ viewport: { width: 760, height: 1000 } });
  narrow.setDefaultTimeout(6000);
  await narrow.goto(url);
  await route(narrow, 'communications');
  await narrow.locator('#openBatchTop').click();
  await narrow.locator('#batchOverlay.open').waitFor();
  await narrow.screenshot({ path: path.join(evidence, '08-narrow-batch-communication.png') });

  await browser.close();
  console.log(`PASS corrected prototype screenshots: ${evidence}`);
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
