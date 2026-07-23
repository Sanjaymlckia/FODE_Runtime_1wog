const fs = require("node:fs");
const path = require("node:path");
const {
  createAuthRequiredError,
  detectAuthRequirement,
  launchAdminContext,
  closeAdminContext
} = require("./auth-fode-admin-playwright");

const READ_ONLY_RPC_ALLOWLIST = Object.freeze({
  "finance-summary": "admin_getCanonicalFinanceSummary",
  "finance-worklist": "admin_getCanonicalFinanceWorklist",
  "finance-applicant": "admin_getCanonicalFinanceApplicant",
  "finance-reconciliation": "admin_getCanonicalFinanceReconciliation",
  "finance-exceptions": "admin_getCanonicalFinanceExceptions",
  "finance-object-history": "admin_getCanonicalFinanceObjectHistory",
  "finance-policy-status": "admin_getCanonicalFinancePolicyStatus"
});

function parseArgs(argv) {
  const out = {};
  for (let index = 0; index < argv.length; index += 1) {
    if (!argv[index].startsWith("--")) continue;
    const key = argv[index].slice(2);
    out[key] = argv[index + 1] && !argv[index + 1].startsWith("--") ? argv[++index] : "true";
  }
  return out;
}

function financeReadOnlyPayload(action, args) {
  if (action === "finance-worklist") {
    const pageSize = Math.max(1, Math.min(100, Number(args["page-size"] || 50)));
    return {
      page: Math.max(1, Number(args.page || 1)),
      pageSize,
      searchQuery: String(args.search || "").trim(),
      filters: {
        financeState: String(args["finance-state"] || "").trim(),
        worklistKey: String(args.worklist || "").trim(),
        recommendedFinanceAction: String(args.action || "").trim()
      }
    };
  }
  if (action === "finance-applicant" || action === "finance-object-history") {
    const applicantId = String(args["applicant-id"] || "").trim();
    if (!applicantId) throw new Error("--applicant-id is required for this read-only action.");
    return { applicantId };
  }
  if (action === "finance-reconciliation" || action === "finance-exceptions") {
    return { limit: Math.max(1, Math.min(200, Number(args.limit || 50))) };
  }
  return {};
}

function evidencePath(repoRoot, action, requested) {
  const proofRoot = path.resolve(repoRoot, ".release-proof");
  const output = path.resolve(requested || path.join(proofRoot, `readonly-${action}.json`));
  if (output !== proofRoot && !output.startsWith(proofRoot + path.sep)) throw new Error("Evidence output must remain under .release-proof.");
  return output;
}

function loadPlaywright() {
  const candidates = [process.env.FODE_PLAYWRIGHT_MODULE, "F:\\Playwright\\fode-secure-link-diagnostic\\node_modules\\playwright"].filter(Boolean);
  for (const candidate of candidates) {
    try { return require(candidate); } catch (_error) {}
  }
  throw new Error("Approved FODE Playwright module was not found.");
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
  const authMessage = await detectAuthRequirement(page);
  if (authMessage) throw createAuthRequiredError(authMessage);
  throw new Error("Authenticated Admin google.script.run bridge was not found.");
}

async function invoke(frame, functionName, payload) {
  return frame.evaluate(({ functionName: name, payload: body }) => new Promise((resolve, reject) => {
    const runner = google.script.run
      .withSuccessHandler(resolve)
      .withFailureHandler((error) => reject(new Error(String(error && error.message || error || "RPC failed"))));
    runner[name](body);
  }), { functionName, payload });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const action = String(args.rpc || "").trim();
  if (!Object.prototype.hasOwnProperty.call(READ_ONLY_RPC_ALLOWLIST, action)) throw new Error("RPC is not in the fixed read-only allowlist.");
  const repoRoot = path.resolve(__dirname, "..");
  const context = JSON.parse(fs.readFileSync(path.join(repoRoot, "runtime-context.json"), "utf8"));
  const adminUrl = String(context.projects.FODE.deployments.adminStaging.url || "").replace(/[?#].*$/, "");
  const output = evidencePath(repoRoot, action, args.output);
  const { chromium } = loadPlaywright();
  const session = await launchAdminContext(chromium, { headless: true });
  try {
    const page = session.context.pages()[0] || await session.context.newPage();
    await page.goto(`${adminUrl}?view=eduops`, { waitUntil: "domcontentloaded", timeout: 90000 });
    const result = await invoke(await findRpcFrame(page), READ_ONLY_RPC_ALLOWLIST[action], financeReadOnlyPayload(action, args));
    fs.mkdirSync(path.dirname(output), { recursive: true });
    fs.writeFileSync(output, JSON.stringify({ action, functionName: READ_ONLY_RPC_ALLOWLIST[action], capturedAt: new Date().toISOString(), result }, null, 2));
    if (!result || result.ok === false || result.readOnly !== true) throw new Error("Read-only RPC returned an invalid response contract.");
    process.stdout.write(`PASS ${action} evidence=${output}\n`);
  } finally {
    await closeAdminContext(session);
  }
}

if (require.main === module) main().catch((error) => {
  if (error && error.code === "AUTH_REQUIRED") {
    process.stderr.write(`AUTH_REQUIRED ${String(error.message || error)} dedicatedProfilePath=${error.meta && error.meta.dedicatedProfilePath || ""} storageStatePath=${error.meta && error.meta.storageStatePath || ""}\n`);
    process.exit(2);
  }
  process.stderr.write(`FAIL ${String(error && error.message || error)}\n`);
  process.exit(1);
});

module.exports = { READ_ONLY_RPC_ALLOWLIST, financeReadOnlyPayload, evidencePath };
