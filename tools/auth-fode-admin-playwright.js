const path = require("node:path");
const fs = require("node:fs");

const localAppData = process.env.LOCALAPPDATA || path.join(process.env.USERPROFILE || "C:\\Users\\Public", "AppData", "Local");
const DEFAULT_PROFILE_DIR = path.join(localAppData, "FODE_Playwright", "admin-staging-profile");

class AuthRequiredError extends Error {
  constructor(message, meta) {
    super(message);
    this.name = "AuthRequiredError";
    this.code = "AUTH_REQUIRED";
    this.meta = meta || {};
  }
}

function authMeta(extra) {
  return Object.assign({
    dedicatedProfilePath: process.env.FODE_PLAYWRIGHT_AUTH_PROFILE_DIR || DEFAULT_PROFILE_DIR,
    storageStatePath: process.env.FODE_ADMIN_AUTH_STATE || process.env.FODE_ADMIN_STORAGE_STATE || ""
  }, extra || {});
}

function createAuthRequiredError(message, extra) {
  return new AuthRequiredError(message, authMeta(extra));
}

function resolveAuthTarget() {
  const profileDir = process.env.FODE_PLAYWRIGHT_AUTH_PROFILE_DIR || DEFAULT_PROFILE_DIR;
  const storageStatePath = process.env.FODE_ADMIN_AUTH_STATE || process.env.FODE_ADMIN_STORAGE_STATE || "";
  if (fs.existsSync(profileDir)) return { mode: "profile", profileDir };
  if (storageStatePath && fs.existsSync(storageStatePath)) return { mode: "storageState", storageStatePath };
  return { mode: "missing", profileDir, storageStatePath };
}

function ensureProfileDir(profileDir) {
  fs.mkdirSync(profileDir, { recursive: true });
  return profileDir;
}

async function detectAuthRequirement(page) {
  const frameUrls = page.frames().map((frame) => frame.url()).join("\n");
  if (/accounts\.google\.com|ServiceLogin/i.test(frameUrls)) {
    return "Google sign-in is required for the dedicated Admin staging Playwright profile.";
  }
  const texts = [];
  for (const frame of page.frames()) {
    try {
      const text = await frame.locator("body").innerText({ timeout: 1000 });
      if (text) texts.push(text);
    } catch (_error) {}
  }
  const combined = texts.join("\n");
  if (/sign in|choose an account|to continue to|request access|access denied|not authorized|you need permission/i.test(combined)) {
    return "The dedicated Admin staging Playwright session is missing or no longer authorised.";
  }
  return "";
}

async function launchAdminContext(chromium, options) {
  const authTarget = resolveAuthTarget();
  const launchOptions = Object.assign({ channel: "chrome" }, options || {});
  if (authTarget.mode === "profile") {
    return {
      target: authTarget,
      browser: null,
      context: await chromium.launchPersistentContext(authTarget.profileDir, launchOptions)
    };
  }
  if (authTarget.mode === "storageState") {
    const browser = await chromium.launch({ headless: launchOptions.headless !== false });
    const context = await browser.newContext({ storageState: authTarget.storageStatePath });
    return { target: authTarget, browser, context };
  }
  throw createAuthRequiredError(
    "No dedicated Playwright Admin staging authentication profile or approved storageState is available.",
    { profileDir: authTarget.profileDir, storageStatePath: authTarget.storageStatePath }
  );
}

async function closeAdminContext(session) {
  if (!session) return;
  if (session.context) await session.context.close();
  if (session.browser) await session.browser.close();
}

function loadPlaywright() {
  const candidate = process.env.FODE_PLAYWRIGHT_MODULE || "F:\\Playwright\\fode-secure-link-diagnostic\\node_modules\\playwright";
  return require(candidate);
}

async function findRpcFrame(page) {
  const deadline = Date.now() + 300000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const available = await frame.evaluate(() => typeof google !== "undefined" && !!google.script && !!google.script.run).catch(() => false);
      if (available) return frame;
    }
    await page.waitForTimeout(500);
  }
  return null;
}

async function main() {
  const { chromium } = loadPlaywright();
  const authTarget = resolveAuthTarget();
  const profileDir = ensureProfileDir(authTarget.mode === "profile" ? authTarget.profileDir : process.env.FODE_PLAYWRIGHT_AUTH_PROFILE_DIR || DEFAULT_PROFILE_DIR);
  const repoRoot = path.resolve(__dirname, "..");
  const runtimeContext = require(path.join(repoRoot, "runtime-context.json"));
  const adminUrl = String(runtimeContext.projects.FODE.deployments.adminStaging.url || "").replace(/[?#].*$/, "");

  const context = await chromium.launchPersistentContext(profileDir, {
    channel: "chrome",
    headless: false,
    viewport: { width: 1440, height: 900 }
  });
  try {
    const page = context.pages()[0] || await context.newPage();
    await page.goto(`${adminUrl}?view=eduops`, { waitUntil: "domcontentloaded", timeout: 90000 });
    console.log(`AUTH_REQUIRED Manual Google sign-in may be required. dedicatedProfilePath=${profileDir}`);
    const rpcFrame = await findRpcFrame(page);
    if (!rpcFrame) {
      const authMessage = await detectAuthRequirement(page);
      throw new Error(authMessage || "The dedicated profile did not reach the Admin staging EduOps RPC bridge before timeout.");
    }
    console.log(`PASS Dedicated Playwright Admin staging profile authenticated. dedicatedProfilePath=${profileDir}`);
  } finally {
    await context.close();
  }
}

if (require.main === module) main().catch((error) => {
  console.error(`AUTH_REQUIRED ${String(error && error.message || error)} dedicatedProfilePath=${process.env.FODE_PLAYWRIGHT_AUTH_PROFILE_DIR || DEFAULT_PROFILE_DIR}`);
  process.exit(2);
});

module.exports = {
  DEFAULT_PROFILE_DIR,
  AuthRequiredError,
  createAuthRequiredError,
  resolveAuthTarget,
  ensureProfileDir,
  detectAuthRequirement,
  launchAdminContext,
  closeAdminContext
};
