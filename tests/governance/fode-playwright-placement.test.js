const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const repoRoot = path.resolve(__dirname, '..', '..');
const context = JSON.parse(fs.readFileSync(path.join(repoRoot, 'runtime-context.json'), 'utf8'));
const playwright = context.projects.FODE.playwright;
const expectedTooling = path.resolve('D:/FODE_Tooling/Playwright');
const expectedEvidence = path.resolve('D:/FODE_Test_Evidence');
const expectedR401Evidence = path.resolve('D:/FODE_Test_Evidence/R401');

function normalized(value) {
  return path.resolve(value).replace(/\\/g, '/').toLowerCase();
}

assert.equal(normalized(playwright.projectPath), normalized(expectedTooling));
assert.equal(normalized(playwright.toolingRoot), normalized(expectedTooling));
assert.equal(normalized(playwright.browsersPath), normalized(path.join(expectedTooling, 'browsers')));
assert.equal(normalized(playwright.evidenceRoot), normalized(expectedEvidence));
assert.equal(normalized(playwright.reportsPath), normalized(expectedR401Evidence));
assert.ok(fs.existsSync(expectedTooling), 'D: Playwright tooling root is missing');
assert.ok(fs.existsSync(path.join(expectedTooling, 'node_modules', 'playwright')), 'D: Playwright module is missing');
assert.ok(fs.existsSync(path.join(expectedTooling, 'browsers')), 'D: Playwright browser cache is missing');
assert.ok(fs.existsSync(expectedR401Evidence), 'D: R401 evidence root is missing');

const pathResolver = fs.readFileSync(path.join(repoRoot, 'tools', 'fode-playwright-path.js'), 'utf8');
assert.match(pathResolver, /D:\/FODE_Tooling\/Playwright/);
assert.match(pathResolver, /D:\/FODE_Test_Evidence/);
assert.doesNotMatch(pathResolver, /F:[\\/]/i);

const activeBrowserFiles = [
  'tests/eduops-integrated-authority-surface.browser.test.js',
  'tests/eduops-pass1-request-state.browser.test.js',
  'tests/r391b-client-state-race.browser.test.js',
  'tools/auth-fode-admin-playwright.js',
  'tools/fode-readonly-browser-rpc.js',
  'tools/fode-staging-health-proof.ps1',
  'tools/fode-smoke.ps1',
  'tools/eduops-snapshot-capture/capture-evidence.js',
  'tools/eduops-snapshot-capture/server/capture-fresh-snapshot.js',
  'tools/eduops-operations-preview/server/capture-fresh-eduops-operations-snapshot.js',
  'tools/eduops-operations-preview/tests/capture-r368-screenshots.js',
  'tools/eduops-operations-preview/tests/capture-r368a-screenshots.js',
  'tools/README.md',
  'docs/Regression_Fixture_Bootstrap_Preview.md',
  'docs/Playwright_Communication_Fixtures.md',
  'docs/architecture/Governance.md'
];

for (const relative of activeBrowserFiles) {
  const text = fs.readFileSync(path.join(repoRoot, relative), 'utf8');
  assert.doesNotMatch(text, /F:[\\/]/i, `${relative} retains an active F: browser path`);
  assert.doesNotMatch(text, /D:[\\/]Repos[\\/]FODE_Runtime_1wog/i, `${relative} creates a D: source clone`);
}

for (const relative of activeBrowserFiles.slice(0, 3)) {
  assert.match(fs.readFileSync(path.join(repoRoot, relative), 'utf8'), /fode-playwright-path/);
}

console.log('fode-playwright-placement PASS');
