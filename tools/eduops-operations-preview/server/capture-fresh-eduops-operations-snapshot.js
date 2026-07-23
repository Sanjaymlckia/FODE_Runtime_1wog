const fs = require("node:fs");
const path = require("node:path");
const {
  createAuthRequiredError,
  detectAuthRequirement,
  launchAdminContext,
  closeAdminContext
} = require("../../auth-fode-admin-playwright");
const { buildSnapshot, writeSnapshotFiles } = require("./snapshot-adapter");

const playwrightModule = process.env.FODE_PLAYWRIGHT_MODULE || "F:/Playwright/fode-secure-link-diagnostic/node_modules/playwright";
const { chromium } = require(playwrightModule);

const previewRoot = path.resolve(__dirname, "..");
const defaultAdminUrl = "https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec?view=eduops";
const captureUrl = process.env.EDUOPS_OPERATIONS_CAPTURE_URL || process.argv[2] || defaultAdminUrl;
const expectedRuntime = process.env.EDUOPS_OPERATIONS_EXPECTED_RUNTIME || "r365";
const expectedDeploy = Number(process.env.EDUOPS_OPERATIONS_EXPECTED_DEPLOY || 365);

const RPC_ALLOWLIST = new Set([
  "eduops_getAccessProjection",
  "eduops_getProfile",
  "eduops_queryOperationalWorkload",
  "eduops_getApplicantWorkbench",
  "admin_getCanonicalPopulationSummary",
  "admin_getOperationalRouteSnapshot"
]);

function fail(message) {
  throw new Error(message);
}

async function rpc(frame, name, payload) {
  if (!RPC_ALLOWLIST.has(name)) fail(`RPC is not in read-only capture allowlist: ${name}`);
  return frame.evaluate(({ name, payload }) => new Promise((resolve, reject) => {
    if (!window.google || !google.script || !google.script.run) {
      reject(new Error("google.script.run is unavailable"));
      return;
    }
    google.script.run
      .withSuccessHandler(resolve)
      .withFailureHandler((err) => reject(new Error(err && (err.message || err.toString && err.toString()) || String(err))))[name](payload || {});
  }), { name, payload: payload || {} });
}

async function findEduOpsFrame(page) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      try {
        const ok = await frame.evaluate(() => !!(document.querySelector("#eduopsApp") && window.google && google.script && google.script.run));
        if (ok) return frame;
      } catch (_err) {}
    }
    await page.waitForTimeout(500);
  }
  const authMessage = await detectAuthRequirement(page);
  if (authMessage) throw createAuthRequiredError(authMessage);
  fail("Authenticated EduOps frame with google.script.run was not found.");
}

async function capture() {
  const url = new URL(captureUrl);
  if (String(url.searchParams.get("view") || "").toLowerCase() !== "eduops") {
    fail("EduOps Operations preview capture must target the accepted Admin ?view=eduops surface.");
  }
  const session = await launchAdminContext(chromium, { headless: true });
  try {
    const page = session.context.pages()[0] || await session.context.newPage();
    await page.goto(captureUrl, { waitUntil: "domcontentloaded", timeout: 60000 });
    const frame = await findEduOpsFrame(page);
    const access = await rpc(frame, "eduops_getAccessProjection", {});
    const runtime = access && access.runtime || {};
    const gotRuntime = runtime.version || runtime.runtime || "";
    const gotDeploy = Number(runtime.deployVersion || runtime.build || 0);
    if (gotRuntime !== expectedRuntime || gotDeploy !== expectedDeploy) {
      fail(`Unexpected Admin runtime. Expected ${expectedRuntime} / ${expectedDeploy}; got ${gotRuntime} / ${gotDeploy}`);
    }
    const profile = await rpc(frame, "eduops_getProfile", {});
    const routeSnapshot = await rpc(frame, "admin_getOperationalRouteSnapshot", {});
    const population = await rpc(frame, "admin_getCanonicalPopulationSummary", { includeRows: true });
    const workload = await rpc(frame, "eduops_queryOperationalWorkload", {
      product: "FODE",
      actionabilityState: "ALL",
      workScope: "ALL_AUTHORISED",
      page: 1,
      pageSize: 500
    });
    const waffiProbe = {
      wb: await rpc(frame, "eduops_getApplicantWorkbench", {
        applicantId: "FODE-26-002959",
        expectedSnapshotId: workload && workload.snapshotId || "",
        returnContext: { actionabilityState: "READY", workScope: "ALL_AUTHORISED", page: 1, pageSize: 25 }
      })
    };
    if (!routeSnapshot || routeSnapshot.ok !== true || !Array.isArray(routeSnapshot.rows)) fail("Route snapshot did not return rows.");
    if (!population || Number(population.populatedRows || population.populationCount || routeSnapshot.rows.length) !== routeSnapshot.rows.length) {
      fail("Population summary does not reconcile with route snapshot rows.");
    }
    const snapshot = buildSnapshot({ routeSnapshot, workload, profile, finalVerdict: {}, waffiProbe });
    const snapshotPath = writeSnapshotFiles(snapshot, previewRoot);
    const evidenceDir = path.join(previewRoot, "evidence", "generated", "r368");
    fs.mkdirSync(evidenceDir, { recursive: true });
    fs.writeFileSync(path.join(evidenceDir, "raw-route-snapshot.json"), JSON.stringify(routeSnapshot, null, 2));
    fs.writeFileSync(path.join(evidenceDir, "raw-workload-all.json"), JSON.stringify(workload, null, 2));
    fs.writeFileSync(path.join(evidenceDir, "raw-population-summary.json"), JSON.stringify(population, null, 2));
    console.log(JSON.stringify({ ok: true, readOnly: true, snapshotPath, population: snapshot.population.authoritativeApplicants }, null, 2));
  } finally {
    await closeAdminContext(session);
  }
}

capture().catch((err) => {
  console.error(err && err.stack || err);
  process.exit(1);
});
