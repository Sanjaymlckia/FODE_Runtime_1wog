const assert = require("node:assert/strict");
const fs = require("node:fs");
const { playwrightModule } = require("../tools/fode-playwright-path");
const { chromium } = require(playwrightModule());

const adminUi = fs.readFileSync("AdminUI.html", "utf8");
const eduOps = fs.readFileSync("EduOps.html", "utf8");

function tagFor(source, label) {
  const endMarker = `>${label}</a>`;
  const end = source.indexOf(endMarker);
  const start = end < 0 ? -1 : source.lastIndexOf("<a", end);
  assert.ok(start >= 0 && end >= start, `${label} link must exist`);
  return source.slice(start, end + endMarker.length);
}

function baseFor(source) {
  const match = source.match(/<base\b[^>]*>/i);
  return match ? match[0] : "";
}

function renderedLink(source, label, route) {
  return tagFor(source, label)
    .replace(/<\?(?:!=|=)?[\s\S]*?\?>/g, "https://r408-navigation.test/admin")
    .replace(/href="[^"]*"/i, `href="https://r408-navigation.test/admin?view=${route}"`);
}

async function assertSandboxEscape(browser, source, label, route, viewport) {
  const page = await browser.newPage({ viewport });
  await page.route("https://r408-navigation.test/**", async requestRoute => {
    await requestRoute.fulfill({ status: 200, contentType: "text/html", body: `<p id="landed">${route}</p>` });
  });
  await page.setContent('<iframe id="apps-script-frame" sandbox="allow-scripts allow-top-navigation-by-user-activation"></iframe>');
  const childHtml = `${baseFor(source)}${renderedLink(source, label, route)}`;
  await page.locator("#apps-script-frame").evaluate((frame, html) => { frame.srcdoc = html; }, childHtml);
  const child = page.frameLocator("#apps-script-frame");
  await child.getByRole("link", { name: label }).click();
  await page.waitForURL(`https://r408-navigation.test/admin?view=${route}`);
  assert.equal(await page.locator("#landed").textContent(), route);
  assert.equal(page.frames().length, 1, `${label} must replace the top-level page, not navigate inside the sandboxed iframe`);
  await page.close();
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  try {
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }]) {
      await assertSandboxEscape(browser, adminUi, "EduOps workspace", "eduops", viewport);
      await assertSandboxEscape(browser, eduOps, "Admin workspace", "admin", viewport);
    }
  } finally {
    await browser.close();
  }
  console.log("PASS R408 sandboxed iframe navigation at desktop and 390x844 in both directions");
})().catch(error => {
  console.error(error);
  process.exit(1);
});
