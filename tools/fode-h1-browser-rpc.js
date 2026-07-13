const fs = require("node:fs");
const path = require("node:path");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    out[key.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
  }
  return out;
}

function loadPlaywright() {
  const candidates = [
    process.env.FODE_PLAYWRIGHT_MODULE,
    "F:\\Playwright\\fode-secure-link-diagnostic\\node_modules\\playwright"
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { return require(candidate); } catch (_error) {}
  }
  throw new Error("Approved FODE Playwright module was not found.");
}

function adminUrl(repoRoot) {
  const context = JSON.parse(fs.readFileSync(path.join(repoRoot, "runtime-context.json"), "utf8"));
  return String(context.projects.FODE.deployments.adminStaging.url || "").replace(/[?#].*$/, "");
}

async function findRpcFrame(page) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const available = await frame.evaluate(() => typeof google !== "undefined" && !!google.script && !!google.script.run).catch(() => false);
      if (available) return frame;
    }
    await page.waitForTimeout(500);
  }
  throw new Error("Admin google.script.run bridge was not found.");
}

async function invoke(frame, functionName, payload) {
  return frame.evaluate(({ functionName: fn, payload: body }) => new Promise((resolve, reject) => {
    const runner = google.script.run
      .withSuccessHandler(resolve)
      .withFailureHandler((error) => reject(new Error(String(error && error.message || error || "RPC failed"))));
    runner[fn](body || {});
  }), { functionName, payload });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const action = String(args.action || "");
  const allowed = {
    probe: { fn: "admin_getRuntimeInfo", payload: {} },
    plan: { fn: "admin_planCapabilityGrantsMigration", payload: { apply: false } },
    migrate: { fn: "admin_planCapabilityGrantsMigration", payload: { apply: true, confirmation: args.confirm || "" } },
    matrix: { fn: "admin_getCapabilityGrantMatrix", payload: {} },
    backup: {
      fn: "admin_createCapabilityGrantPreMigrationBackup",
      payload: {
        confirmation: args.confirm || "",
        commitHash: args.commit || "",
        adminDeploymentPin: args["admin-pin"] || "",
        studentDeploymentPin: args["student-pin"] || ""
      }
    }
  };
  if (!Object.prototype.hasOwnProperty.call(allowed, action)) throw new Error("Unsupported H1 action. Use probe, plan, migrate, matrix, or backup.");
  if (action === "migrate" && args.confirm !== "CREATE_CAPABILITY_GRANTS") throw new Error("Migration confirmation is required.");
  if (action === "backup" && args.confirm !== "CREATE_H1_PRE_MIGRATION_BACKUP") throw new Error("Backup confirmation is required.");
  const repoRoot = path.resolve(__dirname, "..");
  const outputPath = path.resolve(args.output || path.join(repoRoot, ".release-proof", `h1-${action}.json`));
  const authState = process.env.FODE_ADMIN_AUTH_STATE || "F:\\Playwright\\fode-secure-link-diagnostic\\auth\\admin-storage-state.json";
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  try {
    const contextOptions = fs.existsSync(authState) ? { storageState: authState } : {};
    const browserContext = await browser.newContext(contextOptions);
    const page = await browserContext.newPage();
    await page.goto(`${adminUrl(repoRoot)}?view=operator-next`, { waitUntil: "domcontentloaded", timeout: 90000 });
    const frame = await findRpcFrame(page);
    const result = await invoke(frame, allowed[action].fn, allowed[action].payload);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify({ action, capturedAt: new Date().toISOString(), result }, null, 2));
    const ok = result && result.ok !== false;
    if (!ok) throw new Error(String(result && (result.message || result.error || result.code) || "RPC returned failure"));
    process.stdout.write(`PASS ${action} evidence=${outputPath}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`FAIL ${String(error && error.message || error)}\n`);
  process.exit(1);
});
