const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '..', '..');
const script = path.join(repo, 'tools', 'governance', 'Fode-GovernedSession.ps1');
fs.mkdirSync(path.join(repo, '.codex', 'state'), { recursive: true });
const stateRoot = fs.mkdtempSync(path.join(repo, '.codex', 'state', 'fode-governance-test-'));
const supersedeRoot = fs.mkdtempSync(path.join(repo, '.codex', 'state', 'fode-governed-supersede-test-'));

function runAt(root, action, extra = {}) {
  const args = ['-NoProfile', '-File', script, '-Action', action, '-StateRoot', root];
  for (const [key, value] of Object.entries(extra)) args.push(`-${key}`, String(value));
  const result = spawnSync('pwsh.exe', args, { cwd: repo, encoding: 'utf8' });
  const json = JSON.parse(result.stdout.trim());
  return { ...result, json };
}

function run(action, extra = {}) {
  return runAt(stateRoot, action, extra);
}

try {
  const skill = fs.readFileSync(path.join(repo, '.agents', 'skills', 'fode-governed-session', 'SKILL.md'), 'utf8');
  for (const phrase of ['Continue FODE', 'Close FODE session', 'Recover FODE session']) assert.match(skill, new RegExp(phrase.replace(/[.]/g, '\\.') ));
  assert.match(skill, /GOVERNED_SESSION_STOP/);

  const oriented = run('Orient');
  assert.equal(oriented.json.repository, repo);
  assert.ok(oriented.json.governedState);
  assert.ok(fs.existsSync(path.join(stateRoot, 'current.json')));
  assert.doesNotMatch(fs.readFileSync(path.join(stateRoot, 'current.json'), 'utf8'), /FODE-\d{2}-\d{6}/);

  const concurrent = run('Orient');
  assert.equal(concurrent.status, 2);
  assert.equal(concurrent.json.governedState, 'CONCURRENT_SESSION_DETECTED');

  const interruptedState = JSON.parse(fs.readFileSync(path.join(stateRoot, 'current.json'), 'utf8'));
  delete interruptedState.ownershipGeneration;
  delete interruptedState.ownershipBinding;
  delete interruptedState.ownershipLeaseHash;
  delete interruptedState.ownershipTransfers;
  interruptedState.lastCheckpointAt = '2020-01-01T00:00:00.000Z';
  fs.writeFileSync(path.join(stateRoot, 'current.json'), JSON.stringify(interruptedState), 'utf8');
  fs.utimesSync(path.join(stateRoot, 'current.json'), new Date('2020-01-01T00:00:00Z'), new Date('2020-01-01T00:00:00Z'));
  const recovered = run('Orient');
  assert.equal(recovered.json.governedState, 'READ_ONLY_RECONCILIATION');
  assert.ok(recovered.json.ownerLease);
  const recoveredEvents = JSON.parse(fs.readFileSync(path.join(stateRoot, 'events.json'), 'utf8'));
  assert.ok(recoveredEvents.some((event) => event.kind === 'interrupted'));

  const checkpoint = run('Checkpoint', { TaskId: 'governance-test', TaskLabel: 'contract test', OwnerLease: recovered.json.ownerLease });
  assert.ok(['GOVERNED_SESSION_READY', 'READ_ONLY_RECONCILIATION'].includes(checkpoint.json.governedState));

  const decision = run('RecordDecision', { Decision: 'retain read-only mode', Scope: 'governance test', RelatedTask: 'governance-test', EvidenceSource: 'owner declaration', OwnerLease: recovered.json.ownerLease });
  assert.equal(decision.json.session.lastDecision.relatedTask, 'governance-test');

  const beforeTransfer = JSON.parse(fs.readFileSync(path.join(stateRoot, 'current.json'), 'utf8'));
  const transfer = run('TransferOwnership', { SessionId: beforeTransfer.sessionId, OwnerDecision: 'TRANSFER_SESSION_OWNERSHIP' });
  assert.equal(transfer.json.session.sessionId, beforeTransfer.sessionId);
  assert.equal(transfer.json.session.baselineHead, beforeTransfer.baselineHead);
  assert.equal(transfer.json.session.pendingDecision, beforeTransfer.pendingDecision);
  assert.equal(transfer.json.session.lastDecision.decision, 'TRANSFER_SESSION_OWNERSHIP');
  assert.notEqual(transfer.json.session.ownershipGeneration, beforeTransfer.ownershipGeneration);
  assert.notEqual(transfer.json.session.ownershipLeaseHash, beforeTransfer.ownershipLeaseHash);
  assert.ok(transfer.json.ownerLease);
  const transferEvents = JSON.parse(fs.readFileSync(path.join(stateRoot, 'events.json'), 'utf8'));
  assert.ok(transferEvents.some((event) => event.kind === 'ownership-transferred' && event.sessionId === beforeTransfer.sessionId));

  const staleLease = run('Checkpoint', { OwnerLease: recovered.json.ownerLease });
  assert.equal(staleLease.status, 2);
  assert.equal(staleLease.json.governedState, 'CONCURRENT_SESSION_DETECTED');
  const unapprovedExecutor = run('Orient', { OwnerLease: 'not-the-active-lease' });
  assert.equal(unapprovedExecutor.status, 2);
  assert.equal(unapprovedExecutor.json.governedState, 'CONCURRENT_SESSION_DETECTED');

  const newOwnerOrient = run('Orient', { OwnerLease: transfer.json.ownerLease });
  assert.equal(newOwnerOrient.json.session.sessionId, beforeTransfer.sessionId);
  assert.equal(newOwnerOrient.json.session.ownershipGeneration, transfer.json.session.ownershipGeneration);
  assert.notEqual(newOwnerOrient.json.governedState, 'CONCURRENT_SESSION_DETECTED');

  const repeatedTransfer = run('TransferOwnership', { SessionId: beforeTransfer.sessionId, OwnerDecision: 'TRANSFER_SESSION_OWNERSHIP' });
  assert.equal(repeatedTransfer.json.session.sessionId, beforeTransfer.sessionId);
  assert.equal(repeatedTransfer.json.session.ownershipGeneration, transfer.json.session.ownershipGeneration + 1);
  assert.notEqual(repeatedTransfer.json.session.ownershipLeaseHash, transfer.json.session.ownershipLeaseHash);

  const close = run('Close', { OwnerLease: repeatedTransfer.json.ownerLease });
  assert.notEqual(close.json.session.status, 'accepted');
  assert.equal(close.json.session.pendingAcceptance, '');

  const supersedeInitial = runAt(supersedeRoot, 'Orient');
  const supersedeReplacement = runAt(supersedeRoot, 'Orient', { Supersede: true });
  assert.notEqual(supersedeReplacement.json.session.sessionId, supersedeInitial.json.session.sessionId);
  assert.ok(['GOVERNED_SESSION_READY', 'READ_ONLY_RECONCILIATION'].includes(supersedeReplacement.json.governedState));

  fs.writeFileSync(path.join(stateRoot, 'current.json'), '{ malformed', 'utf8');
  const malformed = run('Status');
  assert.equal(malformed.status, 2);
  assert.equal(malformed.json.governedState, 'GOVERNED_SESSION_STOP');
} finally {
  fs.rmSync(stateRoot, { recursive: true, force: true });
  fs.rmSync(supersedeRoot, { recursive: true, force: true });
}

console.log('fode-governed-session PASS');
