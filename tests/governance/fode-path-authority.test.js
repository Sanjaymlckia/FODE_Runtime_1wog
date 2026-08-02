const assert = require('assert');
const fs = require('fs');
const path = require('path');

const repoRoot = path.resolve(__dirname, '..', '..');
const expectedRepo = path.resolve('C:/Repos/FODE_Runtime_1wog');
const expectedBackup = path.resolve('D:/FODE_DR_Backup/R401_745b698_20260801');

assert.strictEqual(fs.realpathSync(repoRoot), expectedRepo, 'active repository must resolve to C:');
assert.ok(!path.relative(repoRoot, expectedBackup).startsWith('..' + path.sep), 'backup target must be outside the repository');

const context = JSON.parse(fs.readFileSync(path.join(repoRoot, 'runtime-context.json'), 'utf8'));
const project = context.projects.FODE;
assert.strictEqual(path.resolve(project.repository.path), expectedRepo, 'runtime context repository authority drifted');
assert.strictEqual(path.resolve(project.evidence.rootPath), expectedBackup, 'runtime context backup root drifted');

const activeAuthorityFiles = [
  'runtime-context.json',
  'docs/architecture/Backup_and_Recovery_V1.md',
  'docs/architecture/Governance.md',
  'docs/architecture/Google_Drive_Package.md',
  'docs/architecture/README.md',
  'docs/tooling/Runtime_Context.md',
  'tools/README.md',
  'tools/fode-dr-manifest.ps1',
  'tools/fode-dr-backup.ps1',
  'tools/fode-release-record.ps1'
];

for (const relative of activeAuthorityFiles) {
  const text = fs.readFileSync(path.join(repoRoot, relative), 'utf8');
  assert.ok(!text.includes('D:\\Repos\\FODE_Runtime_1wog'), `${relative} still directs to D: repository`);
  assert.ok(!text.includes('F:\\FODE_DR_Backup'), `${relative} still directs to obsolete F: backup`);
}

for (const relative of ['tools/fode-dr-manifest.ps1', 'tools/fode-dr-backup.ps1', 'tools/fode-release-record.ps1']) {
  const text = fs.readFileSync(path.join(repoRoot, relative), 'utf8');
  assert.ok(text.includes('D:\\FODE_DR_Backup\\R401_745b698_20260801'), `${relative} lacks approved D: default`);
  assert.ok(text.includes('obsolete F: backup target is rejected'), `${relative} lacks F: rejection`);
  assert.ok(text.includes('must not be inside the authoritative repository'), `${relative} lacks repository-boundary rejection`);
  assert.ok(text.includes('Approved D: backup volume is unavailable'), `${relative} lacks unavailable-volume rejection`);
}

const backupTool = fs.readFileSync(path.join(repoRoot, 'tools/fode-dr-backup.ps1'), 'utf8');
assert.ok(backupTool.indexOf('if ($Mode -match "Plan$")') < backupTool.indexOf('Ensure-Dir $backupResolved'), 'DR plan mode must not create backup artifacts');

const historicalDr5 = fs.readFileSync(path.join(repoRoot, 'audits/fode_runtime_dr5_full_backup_verification_v01.md'), 'utf8');
const historicalMigration = fs.readFileSync(path.join(repoRoot, 'audits/f4d2_repository_authority_toolchain_migration_v01.md'), 'utf8');
assert.ok(historicalDr5.includes('F:\\FODE_DR_Backup'), 'historical F: DR evidence was rewritten');
assert.ok(historicalMigration.includes('D:\\Repos\\FODE_Runtime_1wog'), 'historical D: authority evidence was rewritten');

assert.ok(fs.existsSync(path.join(repoRoot, 'Code.js')), 'Code.js was removed');
assert.ok(fs.existsSync(path.join(repoRoot, 'tests/governance/fode-governed-session.test.js')), 'governance test was removed');
assert.ok(fs.existsSync(path.join(repoRoot, 'tools/governance/Fode-GovernedSession.ps1')), 'governance tool was removed');
const code = fs.readFileSync(path.join(repoRoot, 'Code.js'), 'utf8');
assert.ok(code.includes('width:100%;max-width:260px'), 'existing Code.js responsive repair is missing');

console.log('fode-path-authority PASS');
