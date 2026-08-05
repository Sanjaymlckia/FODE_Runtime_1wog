const assert = require("node:assert/strict");
const fs = require("node:fs");
const { playwrightModule } = require("../tools/fode-playwright-path");
const { chromium } = require(playwrightModule());

const adminUi = fs.readFileSync("AdminUI.html", "utf8");
const eduOps = fs.readFileSync("EduOps.html", "utf8");
const eduOpsStyles = fs.readFileSync("EduOps_Styles.html", "utf8");
const longAdminUrl = "https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec";

function tagForAfter(source, marker, label) {
  const markerIndex = source.indexOf(marker);
  assert.ok(markerIndex >= 0, `${marker} must exist`);
  const endMarker = `>${label}</a>`;
  const end = source.indexOf(endMarker, markerIndex);
  const start = end < 0 ? -1 : source.lastIndexOf("<a", end);
  assert.ok(start >= markerIndex && end >= start, `${label} link must exist after ${marker}`);
  return source.slice(start, end + endMarker.length);
}

function baseFor(source) {
  const match = source.match(/<base\b[^>]*>/i);
  return match ? match[0] : "";
}

function renderedLink(tag, route) {
  return tag
    .replace(/<\?(?:!=|=)?[\s\S]*?\?>/g, longAdminUrl)
    .replace(/href="[^"]*"/i, `href="https://r408-navigation.test/admin?view=${route}"`);
}

function fragmentBetween(source, startMarker, endMarker) {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);
  assert.ok(start >= 0 && end > start, `fragment ${startMarker} -> ${endMarker} must exist`);
  return source.slice(start, end);
}

function renderTemplates(source) {
  return source.replace(/<\?(?:!=|=)?([\s\S]*?)\?>/g, (_match, expression) => {
    if (/WEBAPP_URL|ADMIN_URL/.test(expression)) return longAdminUrl;
    if (/USER_EMAIL/.test(expression)) return "operator@example.test";
    if (/BUILD_SCRIPT_ID/.test(expression)) return "1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90";
    if (/BUILD_RENDERED_AT/.test(expression)) return "2026-08-04T00:00:00.000Z";
    return "r408";
  });
}

function firstStyle(source) {
  const match = source.match(/<style>([\s\S]*?)<\/style>/i);
  assert.ok(match, "Admin style block must exist");
  return `<style>${match[1]}</style>`;
}

async function assertSandboxEscape(browser, source, marker, label, route, viewport) {
  const page = await browser.newPage({ viewport });
  await page.route("https://r408-navigation.test/**", async requestRoute => {
    await requestRoute.fulfill({ status: 200, contentType: "text/html", body: `<p id="landed">${route}</p>` });
  });
  await page.setContent('<iframe id="apps-script-frame" sandbox="allow-scripts allow-top-navigation-by-user-activation"></iframe>');
  const childHtml = `${baseFor(source)}${renderedLink(tagForAfter(source, marker, label), route)}`;
  await page.locator("#apps-script-frame").evaluate((frame, html) => { frame.srcdoc = html; }, childHtml);
  const child = page.frameLocator("#apps-script-frame");
  const link = child.getByRole("link", { name: label, exact: true });
  await link.waitFor({ state: "visible" });
  assert.equal(await link.count(), 1, `${label} must resolve uniquely in its sandbox fixture`);
  await link.click();
  await page.waitForURL(`https://r408-navigation.test/admin?view=${route}`);
  assert.equal(await page.locator("#landed").textContent(), route);
  assert.equal(page.frames().length, 1, `${label} must replace the top-level page, not navigate inside the sandboxed iframe`);
  await page.close();
}

async function measureLayout(page, selector, viewport, surface) {
  const metrics = await page.locator(selector).evaluate((container, args) => {
    const d = document.documentElement;
    const containerRect = container.getBoundingClientRect();
    const links = Array.from(container.querySelectorAll("a")).map(link => {
      const rect = link.getBoundingClientRect();
      return { label: link.textContent.trim(), left: rect.left, right: rect.right, top: rect.top, bottom: rect.bottom, width: rect.width, height: rect.height };
    });
    const main = document.querySelector(".opsMain");
    return {
      surface: args.surface,
      viewport: args.viewport,
      clientWidth: d.clientWidth,
      scrollWidth: d.scrollWidth,
      container: { left: containerRect.left, right: containerRect.right, width: containerRect.width, clientWidth: container.clientWidth, scrollWidth: container.scrollWidth },
      links,
      opsMainTop: main ? main.getBoundingClientRect().top : null
    };
  }, { surface, viewport });
  assert.ok(metrics.scrollWidth <= metrics.clientWidth, `${surface} ${viewport.width}px document must not overflow horizontally: ${JSON.stringify(metrics)}`);
  assert.ok(metrics.container.scrollWidth <= metrics.container.clientWidth, `${surface} navigation container must not overflow: ${JSON.stringify(metrics)}`);
  for (const link of metrics.links) {
    assert.ok(link.width > 0 && link.height > 0, `${surface} ${link.label} must be visible`);
    assert.ok(link.left >= metrics.container.left - 0.5 && link.right <= metrics.container.right + 0.5, `${surface} ${link.label} must stay inside its visible container: ${JSON.stringify(metrics)}`);
  }
  if (surface === "Operations" && viewport.width <= 390) {
    assert.ok(metrics.opsMainTop < viewport.height * 0.65, `Operations working surface must begin inside the first mobile viewport: ${JSON.stringify(metrics)}`);
  }
  return metrics;
}

async function assertResponsiveLayouts(browser, viewport) {
  const page = await browser.newPage({ viewport });
  const adminHeader = renderTemplates(fragmentBetween(adminUi, '<div class="topbar">', '<div id="studentUrlWarn"'));
  const loadedQueue = `<div class="queue-section"><div class="queue-section-body"><table class="queue-table"><tr><th>Applicant</th><th>Name</th><th>Workflow</th><th>Status</th><th>Received</th><th>Age</th><th>Communication</th><th>Action</th></tr><tr><td>FODE-26-002856</td><td>Antoinette Aisakina</td><td>Portal Access Pending</td><td>Portal submitted</td><td>2026-08-05</td><td>1 day</td><td>Applicant email pending</td><td>Review</td></tr></table></div></div>`;
  await page.setContent(`${firstStyle(adminUi)}<div class="wrap">${adminHeader}${loadedQueue}</div>`);
  const admin = await measureLayout(page, ".diagLinks", viewport, "Admin");

  const eduHeader = renderTemplates(fragmentBetween(eduOps, '<header class="eduops-topbar">', '<div class="eduops-shell">'));
  await page.setContent(`${eduOpsStyles}${eduHeader}`);
  await page.locator("#eduopsRuntimeIdentity").evaluate(el => { el.textContent = "r408 / 408"; });
  await page.locator("#eduopsAppsScriptIdentity").evaluate(el => { el.textContent = "The Apps Script runtime does not expose its immutable platform version"; });
  await page.locator("#eduopsReleaseSnapshotIdentity").evaluate(el => { el.textContent = "Snapshot FODE-Psjbl2HabEgBpxsf"; });
  await page.locator("#eduopsReleaseSnapshotTime").evaluate(el => { el.textContent = "As of 2026-08-05T03:09:46.533Z"; });
  const edu = await measureLayout(page, ".eduops-workspace-links", viewport, "EduOps");
  if (viewport.width >= 900) {
    const eduAdminLink = page.locator('.eduops-workspace-links a[href*="view=admin"]');
    assert.equal(await eduAdminLink.count(), 1, "Loaded EduOps Admin link must be unique");
    const eduHit = await eduAdminLink.evaluate(link => {
      const rect = link.getBoundingClientRect();
      const hit = document.elementFromPoint((rect.left + rect.right) / 2, (rect.top + rect.bottom) / 2);
      return hit === link || Boolean(hit && hit.closest("a") === link);
    });
    assert.equal(eduHit, true, "Loaded EduOps Admin link must remain clickable above runtime text");
  }

  const operationsHeader = renderTemplates(fragmentBetween(adminUi, '<div class="opsBrand">', '<div class="opsModeStack">'));
  const operationsNav = fragmentBetween(adminUi, '<nav class="opsNav">', '<div class="opsSideBottom">');
  const loadedWorkspaceSwitch = `<div class="opsWorkspaceSwitch"><div class="opsWorkspaceCard"><h3>Admin Workspace</h3><p>Authenticated Admin staging workspace</p></div><div class="opsWorkspaceCard"><h3>Operator Workspace</h3><p>Loaded operator supervision workspace</p></div></div>`;
  const loadedOperations = `<section id="opsCommunications" class="opsSectionPage">${loadedWorkspaceSwitch}<div class="opsKpiGrid"><div class="opsKpiCard"><div class="opsKpiIcon blue">&lt;/&gt;</div><div><div class="kpiLabel">Runtime</div><div class="kpiValue">r408 / 408</div><div class="kpiMeta">Admin and Student whoami align.</div></div></div><div class="opsKpiCard"><div class="opsKpiIcon green">B</div><div><div class="kpiLabel">Billing Status</div><div class="kpiValue">Books Connected</div><div class="kpiMeta">Invoice snapshot loading. Draft/test actions require selected applicant, preview, and server gates.</div></div></div></div><div class="opsSectionGrid" style="grid-template-columns:minmax(260px,.85fr) minmax(360px,1.1fr) minmax(340px,1fr);"><div class="opsCard">Loaded communications cohort</div><div class="opsCard"><div class="opsSectionHeader"><div><h3>Records / Selected Applicant Context</h3><p>Selection follows Applicant Queue and communication work queues.</p></div><span class="opsStatusPill info">Selected applicant</span></div><div class="opsInfoGrid"><div class="opsInfoItem"><div class="k">Applicant</div><div class="v">FODE-26-003241 · SSS SSS</div></div><div class="opsInfoItem"><div class="k">Exclusions</div><div class="v">REGRESSION_FIXTURE_DO_NOT_PROCESS / REGRESSION_FIXTURE_QUEUE_EXCLUDED</div></div></div></div><div class="opsCard">Loaded audit context</div></div></section>`;
  const operationsShell = `<div id="opsCockpitShell" class="opsShell active"><aside class="opsSidebar">${operationsHeader}<div class="opsModeStack"><div class="opsModeBar"><button class="opsModeBtn active">Admin Mode</button></div><div class="opsRoleStrip"><strong>operator@example.test</strong><div class="opsRoleMeta">Authenticated Admin</div></div></div>${operationsNav}</aside><main class="opsMain"><section class="opsSectionPage"><div class="opsHeader"><h1>Operational Supervision</h1></div></section>${loadedOperations}</main></div>`;
  await page.setContent(`${firstStyle(adminUi)}${operationsShell}`);
  const operations = await measureLayout(page, ".opsSurfaceNav", viewport, "Operations");
  await page.close();
  return { admin, edu, operations };
}

(async () => {
  const browser = await chromium.launch({ headless: true, channel: "chrome" });
  const evidence = [];
  try {
    const scenarios = [
      [adminUi, '<div class="diagLinks">', "EduOps workspace", "eduops"],
      [adminUi, '<div class="diagLinks">', "Operations workspace", "ops"],
      [eduOps, 'class="eduops-workspace-links"', "Admin workspace", "admin"],
      [eduOps, 'class="eduops-workspace-links"', "Operations workspace", "ops"],
      [adminUi, 'class="opsSurfaceNav"', "Admin workspace", "admin"],
      [adminUi, 'class="opsSurfaceNav"', "EduOps workspace", "eduops"]
    ];
    for (const viewport of [{ width: 1440, height: 900 }, { width: 390, height: 844 }, { width: 360, height: 740 }]) {
      evidence.push(await assertResponsiveLayouts(browser, viewport));
      for (const [source, marker, label, route] of scenarios) {
        await assertSandboxEscape(browser, source, marker, label, route, viewport);
      }
    }
  } finally {
    await browser.close();
  }
  console.log(`PASS R408 Admin/EduOps/Operations sandbox navigation and bounded responsive layouts ${JSON.stringify(evidence)}`);
})().catch(error => {
  console.error(error);
  process.exit(1);
});
