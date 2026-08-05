const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const repo = path.resolve(__dirname, '..', '..');
const script = path.join(repo, 'tools', 'governance', 'Fode-GovernedSession.ps1');
assert.match(fs.readFileSync(script, 'utf8'), /System\.Security\.Cryptography\.SHA256/, 'governance policy hashing must retain a Windows PowerShell fallback');
assert.match(fs.readFileSync(script, 'utf8'), /Add-Type -AssemblyName System\.Security/, 'governance lease storage must load the Windows DPAPI assembly explicitly');
const stateBase = path.join(repo, '.codex', 'state');
fs.mkdirSync(stateBase, { recursive: true });
const roots = [];
const baseline = 'eb92c73a20cd026f2169799d19be0d1af55b6869';
const clean = { branch: 'main', head: baseline, originMain: baseline, clean: true, statusLines: [] };
const approvedDirty = {
  ...clean,
  clean: false,
  statusLines: [
    ' M tools/governance/Fode-GovernedSession.ps1',
    ' M tools/fode.ps1',
    '?? tools/governance/Fode-GovernedSession.Core.ps1',
    ' M tests/governance/fode-governed-session.test.js',
    ' M tests/governance/fode-convenience-governance.test.js',
    ' M docs/governance/RELEASE_CLOSURE_DISCIPLINE.md'
  ]
};
const approvedPaths = [
  'tools/governance/Fode-GovernedSession.ps1',
  'tools/fode.ps1',
  'tools/governance/Fode-GovernedSession.Core.ps1',
  'tests/governance/fode-governed-session.test.js',
  'tests/governance/fode-convenience-governance.test.js',
  'docs/governance/RELEASE_CLOSURE_DISCIPLINE.md'
].join(';');
const testLease = 'governance-test-local-lease';
const testLeaseRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'fode-governance-lease-test-'));
const normalizeSerializedTimes = (value) => JSON.parse(JSON.stringify(value, (_key, item) => typeof item === 'string' ? item.replace(/(\.\d+?)0+Z$/, '$1Z') : item));

function newRoot(label) {
  const root = fs.mkdtempSync(path.join(stateBase, `fode-governance-test-${label}-`));
  roots.push(root);
  return root;
}

function run(root, action, snapshot, extra = {}) {
  const args = ['-NoProfile', '-File', script, '-Action', action, '-StateRoot', root];
  for (const [key, value] of Object.entries(extra)) if (value !== undefined) args.push(`-${key}`, String(value));
  const env = { ...process.env, FODE_GOVERNANCE_TEST_SNAPSHOT: JSON.stringify(snapshot), FODE_GOVERNANCE_TEST_LEASE: testLease, FODE_GOVERNANCE_TEST_LEASE_ROOT: testLeaseRoot };
  const result = spawnSync('pwsh.exe', args, { cwd: repo, encoding: 'utf8', env });
  assert.ok(result.stdout.trim(), `No JSON output for ${action}: ${result.stderr}`);
  return { ...result, json: JSON.parse(result.stdout.trim()) };
}

function runWithEnv(root, action, snapshot, extra, injectedEnv) {
  const args = ['-NoProfile', '-File', script, '-Action', action, '-StateRoot', root];
  for (const [key, value] of Object.entries(extra)) if (value !== undefined) args.push(`-${key}`, String(value));
  const env = { ...process.env, FODE_GOVERNANCE_TEST_SNAPSHOT: JSON.stringify(snapshot), FODE_GOVERNANCE_TEST_LEASE: testLease, FODE_GOVERNANCE_TEST_LEASE_ROOT: testLeaseRoot, ...injectedEnv };
  const result = spawnSync('pwsh.exe', args, { cwd: repo, encoding: 'utf8', env });
  assert.ok(result.stdout.trim(), `No JSON output for ${action}: ${result.stderr}`);
  return { ...result, json: JSON.parse(result.stdout.trim()) };
}

try {
  const cleanRoot = newRoot('clean');
  const opened = run(cleanRoot, 'Orient', clean, { TaskId: 'clean', ApprovedPaths: approvedPaths });
  assert.equal(opened.status, 0, JSON.stringify(opened.json));
  assert.equal(Object.hasOwn(opened.json, 'ownerLease'), false, 'lease values must never be returned in JSON');
  assert.equal(opened.json.session.phase, 'OPEN');
  const cleanClose = run(cleanRoot, 'Close', clean, { OwnerLease: opened.json.ownerLease, ClearPendingAcceptance: true });
  assert.equal(cleanClose.json.session.status, 'closed');
  assert.equal(cleanClose.json.session.phase, 'CLOSED');

  const workingRoot = newRoot('working');
  const initial = run(workingRoot, 'Orient', clean, { TaskId: 'approved', ApprovedPaths: approvedPaths, ReleaseAuthorized: true });
  const firstEdit = run(workingRoot, 'Checkpoint', approvedDirty, {
    OwnerLease: initial.json.ownerLease,
    SourceWork: 'approved governance edit'
  });
  assert.equal(firstEdit.status, 0, JSON.stringify(firstEdit.json));
  assert.equal(firstEdit.json.session.phase, 'WORKING', 'first approved edit must not deadlock read-only');
  assert.equal(firstEdit.json.governedState, 'WORKING');
  assert.equal(firstEdit.json.session.communicationAuthorized, false, 'deployment authorization must not authorize communications');

  const paused = run(workingRoot, 'Pause', approvedDirty, { OwnerLease: initial.json.ownerLease });
  assert.equal(paused.json.session.phase, 'PAUSED');
  const resumed = run(workingRoot, 'Resume', approvedDirty, { OwnerLease: initial.json.ownerLease });
  assert.equal(resumed.json.session.phase, 'WORKING');
  assert.deepEqual(resumed.json.session.approvedPaths, initial.json.session.approvedPaths);

  const validated = run(workingRoot, 'Transition', approvedDirty, {
    OwnerLease: initial.json.ownerLease,
    TargetPhase: 'VALIDATED',
    TestsPassed: true,
    NoProhibitedExternalAction: true,
    Tests: 'governance suite passed'
  });
  assert.equal(validated.json.session.phase, 'VALIDATED');
  const releaseReady = run(workingRoot, 'Transition', approvedDirty, {
    OwnerLease: initial.json.ownerLease,
    TargetPhase: 'RELEASE_READY',
    TestsPassed: true,
    GitPreflightPassed: true,
    DeploymentPreflightPassed: true,
    NoProhibitedExternalAction: true,
    ReleaseAuthorized: true
  });
  assert.equal(releaseReady.json.session.phase, 'RELEASE_READY');
  assert.equal(releaseReady.json.session.baselineHead, baseline, 'RELEASE_READY must preserve the last-released rollback baseline');
  assert.match(releaseReady.json.session.approvedScopeHash, /^[0-9a-f]{64}$/, 'RELEASE_READY must record an approved scope hash');

  const postCommitRoot = newRoot('post-commit-ready');
  const postCommitInitial = run(postCommitRoot, 'Orient', clean, { TaskId: 'post-commit', ApprovedPaths: approvedPaths, ReleaseAuthorized: true });
  const postCommitWorking = run(postCommitRoot, 'Checkpoint', approvedDirty, { OwnerLease: postCommitInitial.json.ownerLease });
  assert.equal(postCommitWorking.status, 0, JSON.stringify(postCommitWorking.json));
  assert.equal(postCommitWorking.json.session.phase, 'WORKING');
  const postCommitValidated = run(postCommitRoot, 'Transition', approvedDirty, {
    OwnerLease: postCommitInitial.json.ownerLease,
    TargetPhase: 'VALIDATED',
    TestsPassed: true,
    NoProhibitedExternalAction: true
  });
  assert.equal(postCommitValidated.json.session.phase, 'VALIDATED');
  const postCommitSnapshot = { ...clean, head: 'post-commit-head', originMain: 'post-commit-head' };
  const postCommitReady = run(postCommitRoot, 'Transition', postCommitSnapshot, {
    OwnerLease: postCommitInitial.json.ownerLease,
    TargetPhase: 'RELEASE_READY',
    TestsPassed: true,
    GitPreflightPassed: true,
    DeploymentPreflightPassed: true,
    NoProhibitedExternalAction: true,
    ReleaseAuthorized: true
  });
  assert.equal(postCommitReady.json.session.phase, 'RELEASE_READY', 'post-commit approved scope must reach RELEASE_READY');
  assert.equal(postCommitReady.json.session.baselineHead, baseline, 'post-commit RELEASE_READY must not advance rollback baseline');
  assert.match(postCommitReady.json.session.approvedScopeHash, /^[0-9a-f]{64}$/);

  const communicationBlocked = run(workingRoot, 'Transition', approvedDirty, {
    OwnerLease: initial.json.ownerLease,
    TargetPhase: 'RELEASED',
    ReleaseAuthorized: true,
    CommunicationAuthorized: true,
    NoProhibitedExternalAction: true
  });
  assert.equal(communicationBlocked.status, 2);
  assert.equal(communicationBlocked.json.governedState, 'OWNER_DECISION_REQUIRED');

  const unrelatedRoot = newRoot('unrelated');
  const unrelated = { ...approvedDirty, statusLines: [...approvedDirty.statusLines, ' M Config.js'] };
  const readOnly = run(unrelatedRoot, 'Orient', unrelated, { ApprovedPaths: approvedPaths, ReleaseAuthorized: true });
  assert.equal(readOnly.json.session.phase, 'READ_ONLY_RECONCILIATION');
  const blocked = run(unrelatedRoot, 'Transition', unrelated, {
    OwnerLease: readOnly.json.ownerLease,
    TargetPhase: 'WORKING',
    ApprovedPaths: approvedPaths
  });
  assert.equal(blocked.status, 2);
  assert.equal(blocked.json.governedState, 'READ_ONLY_RECONCILIATION');

  const supersedeRoot = newRoot('supersede');
  const superseded = run(supersedeRoot, 'Orient', clean, { ApprovedPaths: approvedPaths });
  const supersedeWithoutDecisionViaLocalLease = run(supersedeRoot, 'Orient', clean, { Supersede: true, SessionId: superseded.json.session.sessionId });
  assert.equal(supersedeWithoutDecisionViaLocalLease.status, 2);
  assert.equal(supersedeWithoutDecisionViaLocalLease.json.governedState, 'OWNER_DECISION_REQUIRED');
  const supersedeWithoutDecision = run(supersedeRoot, 'Orient', clean, { Supersede: true, OwnerLease: superseded.json.ownerLease, SessionId: superseded.json.session.sessionId });
  assert.equal(supersedeWithoutDecision.status, 2);
  assert.equal(supersedeWithoutDecision.json.governedState, 'OWNER_DECISION_REQUIRED');
  const recovered = run(supersedeRoot, 'Orient', clean, {
    Supersede: true,
    OwnerLease: superseded.json.ownerLease,
    SessionId: superseded.json.session.sessionId,
    OwnerDecision: 'SUPERSEDE_GOVERNED_SESSION',
    ApprovedPaths: approvedPaths
  });
  assert.equal(recovered.status, 0, JSON.stringify(recovered.json));
  assert.notEqual(recovered.json.session.sessionId, superseded.json.session.sessionId);

  const leaseRoot = newRoot('lease');
  const leaseOpened = run(leaseRoot, 'Orient', clean, { ApprovedPaths: approvedPaths });
  const staleLease = run(leaseRoot, 'Checkpoint', clean, { OwnerLease: 'not-the-active-lease' });
  assert.equal(staleLease.status, 2);
  assert.equal(staleLease.json.governedState, 'CONCURRENT_SESSION_DETECTED');
  const leaseStatePath = path.join(leaseRoot, 'current.json');
  const missingLeaseState = JSON.parse(fs.readFileSync(leaseStatePath, 'utf8'));
  delete missingLeaseState.ownershipLeaseHash;
  fs.writeFileSync(leaseStatePath, JSON.stringify(missingLeaseState), 'utf8');
  const missingLease = run(leaseRoot, 'Checkpoint', clean, { OwnerLease: leaseOpened.json.ownerLease });
  assert.equal(missingLease.status, 2);
  assert.equal(missingLease.json.governedState, 'CONCURRENT_SESSION_DETECTED');

  const lostLeaseRoot = newRoot('lost-lease');
  const lostLeaseOpened = run(lostLeaseRoot, 'Orient', clean, { ApprovedPaths: approvedPaths });
  assert.equal(lostLeaseOpened.status, 0, JSON.stringify(lostLeaseOpened.json));
  const recoverySnapshot = { ...clean, head: 'recovery-commit', originMain: 'recovery-commit' };
  const recoveredLease = runWithEnv(lostLeaseRoot, 'RecoverLostLease', recoverySnapshot, {
    SessionId: lostLeaseOpened.json.session.sessionId,
    OwnerDecision: 'RECOVER_LOST_OWNER_LEASE'
  }, { FODE_GOVERNANCE_TEST_CONFIRM_LOST_LEASE: 'RECOVER LOST OWNER LEASE', FODE_GOVERNANCE_TEST_RECOVERY_SCOPE: 'tools/governance/Fode-GovernedSession.ps1;tests/governance/fode-governed-session.test.js', FODE_GOVERNANCE_TEST_LEASE: 'governance-test-replacement-lease' });
  assert.equal(recoveredLease.status, 0, JSON.stringify(recoveredLease.json));
  assert.equal(recoveredLease.json.session.sessionId, lostLeaseOpened.json.session.sessionId);
  assert.equal(recoveredLease.json.session.ownershipGeneration, 2);
  assert.equal(recoveredLease.json.session.baselineHead, 'recovery-commit');
  assert.equal([].concat(recoveredLease.json.session.lostLeaseRecoveries).at(-1).decision, 'RECOVER_LOST_OWNER_LEASE');
  assert.equal(JSON.stringify(recoveredLease.json).includes('governance-test-replacement-lease'), false, 'recovery output must redact lease material');
  const oldLeaseRejected = run(lostLeaseRoot, 'Checkpoint', recoverySnapshot, { OwnerLease: testLease });
  assert.equal(oldLeaseRejected.status, 2);
  assert.equal(oldLeaseRejected.json.governedState, 'CONCURRENT_SESSION_DETECTED');
  const localLeaseReuse = run(lostLeaseRoot, 'Orient', recoverySnapshot);
  assert.equal(localLeaseReuse.status, 0, JSON.stringify(localLeaseReuse.json));
  const confirmationRoot = newRoot('lost-lease-no-confirm');
  const confirmationOpened = run(confirmationRoot, 'Orient', clean, { ApprovedPaths: approvedPaths });
  const rejectedConfirmation = runWithEnv(confirmationRoot, 'RecoverLostLease', recoverySnapshot, { SessionId: confirmationOpened.json.session.sessionId, OwnerDecision: 'RECOVER_LOST_OWNER_LEASE' }, { FODE_GOVERNANCE_TEST_RECOVERY_SCOPE: 'tools/governance/Fode-GovernedSession.ps1;tests/governance/fode-governed-session.test.js' });
  assert.equal(rejectedConfirmation.status, 2);
  assert.equal(rejectedConfirmation.json.governedState, 'OWNER_DECISION_REQUIRED');
  const dpapiFailureRoot = newRoot('lost-lease-dpapi-failure');
  const dpapiOpened = run(dpapiFailureRoot, 'Orient', clean, { ApprovedPaths: approvedPaths });
  const dpapiFailure = runWithEnv(dpapiFailureRoot, 'RecoverLostLease', recoverySnapshot, { SessionId: dpapiOpened.json.session.sessionId, OwnerDecision: 'RECOVER_LOST_OWNER_LEASE' }, { FODE_GOVERNANCE_TEST_CONFIRM_LOST_LEASE: 'RECOVER LOST OWNER LEASE', FODE_GOVERNANCE_TEST_RECOVERY_SCOPE: 'tools/governance/Fode-GovernedSession.ps1;tests/governance/fode-governed-session.test.js', FODE_GOVERNANCE_TEST_DPAPI_FAIL: '1' });
  assert.equal(dpapiFailure.status, 2);
  assert.equal(dpapiFailure.json.governedState, 'RECOVERY_REQUIRED');

  const missingStateRoot = newRoot('missing-state');
  run(missingStateRoot, 'Orient', clean, { ApprovedPaths: approvedPaths });
  fs.rmSync(path.join(missingStateRoot, 'current.json'));
  const missingState = run(missingStateRoot, 'Status', clean);
  assert.equal(missingState.status, 2);
  assert.equal(missingState.json.governedState, 'RECOVERY_REQUIRED');

  const missingEventsRoot = newRoot('missing-events');
  run(missingEventsRoot, 'Orient', clean, { ApprovedPaths: approvedPaths });
  fs.rmSync(path.join(missingEventsRoot, 'events.json'));
  const missingEvents = run(missingEventsRoot, 'Status', clean);
  assert.equal(missingEvents.status, 2);
  assert.equal(missingEvents.json.governedState, 'RECOVERY_REQUIRED');

  const malformedRoot = newRoot('malformed');
  run(malformedRoot, 'Orient', clean, { ApprovedPaths: approvedPaths });
  fs.writeFileSync(path.join(malformedRoot, 'current.json'), '{not-json', 'utf8');
  const malformed = run(malformedRoot, 'Status', clean);
  assert.equal(malformed.status, 2);
  assert.equal(malformed.json.governedState, 'RECOVERY_REQUIRED');

  const failureRoot = newRoot('write-failure');
  const failureOpened = run(failureRoot, 'Orient', clean, { ApprovedPaths: approvedPaths });
  const beforeFailureState = JSON.parse(fs.readFileSync(path.join(failureRoot, 'current.json'), 'utf8'));
  const beforeFailureEvents = JSON.parse(fs.readFileSync(path.join(failureRoot, 'events.json'), 'utf8'));
  const injectedFailure = runWithEnv(failureRoot, 'Checkpoint', approvedDirty, {
    OwnerLease: failureOpened.json.ownerLease,
    SourceWork: 'failure injection'
  }, { FODE_GOVERNANCE_TEST_FAILURE_POINT: 'after-events' });
  assert.equal(injectedFailure.status, 2);
  assert.equal(injectedFailure.json.governedState, 'GOVERNED_SESSION_STOP');
  const restoredState = JSON.parse(fs.readFileSync(path.join(failureRoot, 'current.json'), 'utf8'));
  const restoredEvents = JSON.parse(fs.readFileSync(path.join(failureRoot, 'events.json'), 'utf8'));
  assert.equal(restoredState.lastEventId, beforeFailureState.lastEventId, 'failed checkpoint must restore the prior state');
  assert.deepEqual(normalizeSerializedTimes(restoredEvents), normalizeSerializedTimes(beforeFailureEvents), 'failed checkpoint must preserve the append-only event history');
  assert.equal(fs.existsSync(path.join(failureRoot, 'transaction.json')), false, 'successful rollback must clear its recovery journal');

  const stateFailureRoot = newRoot('state-write-failure');
  const stateFailureOpened = run(stateFailureRoot, 'Orient', clean, { ApprovedPaths: approvedPaths });
  const beforeStateFailure = JSON.parse(fs.readFileSync(path.join(stateFailureRoot, 'current.json'), 'utf8'));
  const beforeStateFailureEvents = JSON.parse(fs.readFileSync(path.join(stateFailureRoot, 'events.json'), 'utf8'));
  const injectedStateFailure = runWithEnv(stateFailureRoot, 'Checkpoint', approvedDirty, {
    OwnerLease: stateFailureOpened.json.ownerLease,
    SourceWork: 'state write failure injection'
  }, { FODE_GOVERNANCE_TEST_FAILURE_POINT: 'after-state' });
  assert.equal(injectedStateFailure.status, 2);
  assert.equal(injectedStateFailure.json.governedState, 'GOVERNED_SESSION_STOP');
  const restoredStateWrite = JSON.parse(fs.readFileSync(path.join(stateFailureRoot, 'current.json'), 'utf8'));
  const restoredStateWriteEvents = JSON.parse(fs.readFileSync(path.join(stateFailureRoot, 'events.json'), 'utf8'));
  assert.equal(restoredStateWrite.lastEventId, beforeStateFailure.lastEventId, 'post-state failure must restore the prior state');
  assert.deepEqual(normalizeSerializedTimes(restoredStateWriteEvents), normalizeSerializedTimes(beforeStateFailureEvents), 'post-state failure must preserve event history');

  const historyRoot = newRoot('history');
  const historyOpened = run(historyRoot, 'Orient', clean, { ApprovedPaths: approvedPaths });
  const historyCheckpoint = run(historyRoot, 'Checkpoint', approvedDirty, { OwnerLease: historyOpened.json.ownerLease, SourceWork: 'history proof' });
  const history = JSON.parse(fs.readFileSync(path.join(historyRoot, 'events.json'), 'utf8'));
  const historyState = JSON.parse(fs.readFileSync(path.join(historyRoot, 'current.json'), 'utf8'));
  assert.equal(history.length, 2);
  assert.match(history[0].eventId, /^[a-f0-9]{32}$/, 'event history must preserve the opening event');
  assert.equal(history[1].previousEventHash, history[0].eventHash, 'event history must link to its preserved predecessor');
  for (const field of ['eventId', 'sequence', 'sessionId', 'ownershipGeneration', 'previousBaseline', 'newBaseline', 'approvedPaths', 'approvedScopeHash', 'commitIdentity', 'priorState', 'resultingState', 'eventHash']) {
    assert.ok(Object.hasOwn(history[1], field), `event history must record ${field}`);
  }
  assert.equal(historyState.lastEventId, history[1].eventId);

  const stoppedDirtyRoot = newRoot('stopped-dirty');
  const stoppedDirty = run(stoppedDirtyRoot, 'Orient', clean, { ApprovedPaths: approvedPaths, ReleaseAuthorized: true });
  const dirtyWorking = run(stoppedDirtyRoot, 'Checkpoint', approvedDirty, { OwnerLease: stoppedDirty.json.ownerLease });
  assert.equal(dirtyWorking.json.session.phase, 'WORKING');
  const dirtyClose = run(stoppedDirtyRoot, 'Close', approvedDirty, {
    OwnerLease: stoppedDirty.json.ownerLease,
    Decision: 'STOPPED_WITH_APPROVED_WORK'
  });
  assert.equal(dirtyClose.status, 2);
  assert.equal(dirtyClose.json.session.status, 'closed');
  const dirtyResume = run(stoppedDirtyRoot, 'Orient', approvedDirty, { ApprovedPaths: approvedPaths, ReleaseAuthorized: true });
  const resumedWorking = run(stoppedDirtyRoot, 'Transition', approvedDirty, {
    OwnerLease: dirtyResume.json.ownerLease,
    TargetPhase: 'WORKING',
    ApprovedPaths: approvedPaths
  });
  assert.equal(resumedWorking.json.session.phase, 'WORKING', 'stopped approved work must resume without discard or recreation');

  const core = path.join(repo, 'tools', 'governance', 'Fode-GovernedSession.Core.ps1').replace(/'/g, "''");
  const policyProbe = spawnSync('pwsh.exe', ['-NoProfile', '-Command', [
    `. '${core}'`,
    `[pscustomobject]@{ mobile = (Get-FodeRollbackDisposition 'MOBILE_LAYOUT'); security = (Get-FodeRollbackDisposition 'SECURITY'); governance = (Get-FodeRollbackDisposition 'GOVERNANCE_TOOL') } | ConvertTo-Json -Compress`
  ].join('; ')], { cwd: repo, encoding: 'utf8' });
  const dispositions = JSON.parse(policyProbe.stdout.trim());
  assert.equal(dispositions.mobile, 'STOP_FORWARD_FIX_NO_ROLLBACK');
  assert.equal(dispositions.security, 'STOP_AND_ROLLBACK_DECISION_REQUIRED');
  assert.equal(dispositions.governance, 'PRESERVE_RUNTIME_NO_ROLLBACK');

  const finalState = releaseReady.json.session;
  assert.equal(finalState.actionReports[0].sourceWork, 'approved governance edit');
  assert.equal(finalState.actionReports[1].tests, 'governance suite passed');
  for (const field of ['sourceWork','tests','gitOperations','appsScriptPush','versionCreation','deploymentRepin','browserAcceptance','externalMutations']) {
    assert.ok(Object.hasOwn(finalState.actionReports[0], field), `closure action reporting must distinguish ${field}`);
  }
} finally {
  for (const root of roots) fs.rmSync(root, { recursive: true, force: true });
  fs.rmSync(testLeaseRoot, { recursive: true, force: true });
}

console.log('fode-governed-session PASS: lifecycle, approved scope, pause/resume, recovery, authorization separation, rollback policy and action reporting');
