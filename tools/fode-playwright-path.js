const fs = require("node:fs");
const path = require("node:path");

const REPO_ROOT = path.resolve(__dirname, "..");
const DEFAULT_TOOLING_ROOT = "D:/FODE_Tooling/Playwright";
const DEFAULT_EVIDENCE_ROOT = "D:/FODE_Test_Evidence";

function resolved(value, fallback) {
  return path.resolve(String(value || fallback));
}

function assertExternalD(target, label) {
  const value = resolved(target, target);
  const repoPrefix = `${REPO_ROOT}${path.sep}`.toLowerCase();
  if (!/^D:[\\/]/i.test(value) || value.toLowerCase().startsWith(repoPrefix)) {
    throw new Error(`${label} must resolve outside the C: repository on D:; got ${value}`);
  }
  if (/^F:[\\/]/i.test(value)) throw new Error(`${label} must not resolve under obsolete F:`);
  return value;
}

function toolingRoot() {
  return assertExternalD(process.env.FODE_PLAYWRIGHT_ROOT || DEFAULT_TOOLING_ROOT, "FODE_PLAYWRIGHT_ROOT");
}

function browsersPath() {
  return assertExternalD(process.env.PLAYWRIGHT_BROWSERS_PATH || path.join(toolingRoot(), "browsers"), "PLAYWRIGHT_BROWSERS_PATH");
}

function evidenceRoot() {
  return assertExternalD(process.env.FODE_BROWSER_EVIDENCE_ROOT || DEFAULT_EVIDENCE_ROOT, "FODE_BROWSER_EVIDENCE_ROOT");
}

function evidencePath(...parts) {
  const output = assertExternalD(path.join(evidenceRoot(), ...parts), "browser evidence path");
  if (output.toLowerCase().startsWith(`${REPO_ROOT.toLowerCase()}${path.sep}`)) {
    throw new Error("Browser evidence cannot be written inside the source repository");
  }
  return output;
}

function playwrightModule() {
  const candidate = process.env.FODE_PLAYWRIGHT_MODULE || path.join(toolingRoot(), "node_modules", "playwright");
  const resolvedCandidate = assertExternalD(candidate, "FODE_PLAYWRIGHT_MODULE");
  if (!fs.existsSync(resolvedCandidate)) {
    throw new Error(`Approved FODE Playwright module was not found at ${resolvedCandidate}`);
  }
  return resolvedCandidate;
}

module.exports = { REPO_ROOT, DEFAULT_TOOLING_ROOT, DEFAULT_EVIDENCE_ROOT, toolingRoot, browsersPath, evidenceRoot, evidencePath, playwrightModule };
