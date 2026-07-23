const cp = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const approvedGeneratedPrefixes = [
  "tools/eduops-snapshot-capture/evidence/generated/",
  "tools/eduops-operations-preview/evidence/generated/",
  "prototypes/"
];
const ignoredDirs = new Set([".git", "node_modules", "playwright-report", "test-results", ".release-proof"]);

function gitLines(args) {
  return cp.execFileSync("git", args, { cwd: repoRoot, encoding: "utf8" })
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function walk(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (ignoredDirs.has(entry.name)) continue;
    const full = path.join(dir, entry.name);
    const rel = path.relative(repoRoot, full).replace(/\\/g, "/");
    if (entry.isDirectory()) {
      walk(full, out);
    } else {
      out.push(rel);
    }
  }
  return out;
}

function isApprovedGeneratedPath(rel) {
  const normalized = rel.replace(/\\/g, "/");
  if (normalized.startsWith("prototypes/") && normalized.includes("/evidence/generated/")) return true;
  if (normalized === "tools/eduops-snapshot-capture/evidence/" || normalized === "tools/eduops-operations-preview/evidence/") return true;
  return approvedGeneratedPrefixes.some((prefix) => normalized.startsWith(prefix));
}

function classifyNameReference(rel, text) {
  const normalized = rel.replace(/\\/g, "/");
  if (/^audits\/|^docs\//.test(normalized) || /^prototypes\//.test(normalized)) return "historical archive/reference";
  if (/^(EduOps|OpsEdu|AdminUI|Admin\.js|Admin_|Code|Routes|tests\/opsedu-|tests\/operator-next-|tests\/eduops-integrated-authority-surface|tests\/apps-script-deployable-file-contract|tests\/eduops-pass1-readonly-contract)/.test(normalized)) {
    return "runtime naming debt deferred to R376J";
  }
  if (/^tools\/eduops-snapshot-capture\/server\/server\.js$/.test(normalized)) return "approved compatibility reference";
  if (/^tools\/eduops-operations-preview\//.test(normalized) && /(opsedu-preview\.(js|css)|schemaVersion|OPSEDU_|data-opsedu|#opsedu|\.opsedu|filename: "opsedu-preview\.js")/.test(text + "\n" + normalized)) {
    return "approved compatibility reference";
  }
  if (/opsedu-preview\.(js|css)$|schemaVersion|OPSEDU_|data-opsedu|#opsedu|\.opsedu/.test(text)) return "approved compatibility reference";
  return "defect requiring removal now";
}

function main() {
  const trackedAndUntracked = new Set(gitLines(["ls-files"]).concat(gitLines(["ls-files", "--others", "--exclude-standard"])));
  const files = Array.from(trackedAndUntracked).filter((rel) => fs.existsSync(path.join(repoRoot, rel)));
  const untracked = gitLines(["ls-files", "--others", "--exclude-standard"]);
  const findings = {
    generatedOutputOutsideApprovedDirectories: [],
    unexpectedPrototypeZips: [],
    authSessionFiles: [],
    browserProfiles: [],
    previewServerLogs: [],
    largeUntrackedEvidenceTrees: [],
    activeNameReferences: []
  };

  for (const rel of untracked) {
    const normalized = rel.replace(/\\/g, "/");
    if (/\.zip$/i.test(normalized) && /^prototypes\//.test(normalized)) findings.unexpectedPrototypeZips.push(normalized);
    if (/(storage-?state|auth-?state|session|cookie|token).*\.(json|txt)$/i.test(normalized)) findings.authSessionFiles.push(normalized);
    if (/(browser-profile|chrome-.*-profile)/i.test(normalized)) findings.browserProfiles.push(normalized);
    if (/preview-server\..*\.log$/i.test(normalized)) findings.previewServerLogs.push(normalized);
    if (/\/evidence\//.test(normalized) && !isApprovedGeneratedPath(normalized)) findings.generatedOutputOutsideApprovedDirectories.push(normalized);
  }

  const untrackedDirs = gitLines(["ls-files", "--others", "--exclude-standard", "--directory"]);
  for (const rel of untrackedDirs) {
    const normalized = rel.replace(/\\/g, "/");
    if (/\/evidence\//.test(normalized) && !isApprovedGeneratedPath(normalized)) findings.largeUntrackedEvidenceTrees.push(normalized);
  }

  for (const rel of files) {
    if (!/\.(js|html|md|cmd|json|css|txt)$/i.test(rel)) continue;
    const full = path.join(repoRoot, rel);
    let text = "";
    try { text = fs.readFileSync(full, "utf8"); } catch (_error) { continue; }
    if (/(OpsEdu|opsedu|eduops-next|operator-next)/.test(rel) || /(OpsEdu|opsedu|eduops-next|operator-next)/.test(text)) {
      findings.activeNameReferences.push({
        path: rel,
        classification: classifyNameReference(rel, text)
      });
    }
  }

  const report = {
    ok: true,
    readOnly: true,
    approvedGeneratedDirectories: [
      "tools/eduops-snapshot-capture/evidence/generated/",
      "tools/eduops-operations-preview/evidence/generated/",
      "prototypes/*/evidence/generated/"
    ],
    findings
  };
  if (process.argv.includes("--json")) process.stdout.write(JSON.stringify(report, null, 2) + "\n");
  else {
    console.log("Repository hygiene report");
    for (const [key, value] of Object.entries(findings)) console.log(`${key}: ${Array.isArray(value) ? value.length : 0}`);
  }
}

if (require.main === module) main();

module.exports = { classifyNameReference, isApprovedGeneratedPath };
