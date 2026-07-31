const assert = require("node:assert/strict");
const fs = require("node:fs");

const core = fs.readFileSync("tools/FodeReleasePipeline.Core.ps1", "utf8");
const invoke = fs.readFileSync("tools/Invoke-FodeAdminRelease.ps1", "utf8");
const complete = fs.readFileSync("tools/Complete-FodeReleaseCommit.ps1", "utf8");
const toolsReadme = fs.existsSync("tools/README.md") ? fs.readFileSync("tools/README.md", "utf8") : "";

function riskFor(path) {
  const p = path.replace(/\\/g, "/");
  if (/^(docs\/|audits\/|runtime-context\.json$|tools\/README\.md$|docs\/tooling\/|docs\/architecture\/)/.test(p)) return "DocsOnly";
  if (/^tests\//.test(p) || /^tools\//.test(p)) return "DocsOnly";
  if (/(^|\/)(AdminUI.*\.html|EduOps.*\.html)$/.test(p) || /\.(css|html)$/.test(p)) return "ClientOnly";
  if (/StageBatch|Batch|Communication|SelectedApplicant|CanonicalPopulation|Population|Idempotency|Receipts|Deployment|appsscript\.json$/.test(p)) return "HighRiskAuthority";
  if (/^(Admin|Code|Config|Routes|Utils|EduOps_).*\.js$/.test(p)) return "BackendSemantic";
  return "HighRiskAuthority";
}

const rank = { DocsOnly: 1, ClientOnly: 2, BackendSemantic: 3, HighRiskAuthority: 4 };
function minClass(files) {
  return files.map(riskFor).sort((a, b) => rank[b] - rank[a])[0] || "DocsOnly";
}

assert.equal(minClass(["docs/tooling/Admin_Release_Pipeline.md"]), "DocsOnly", "DocsOnly classification");
assert.equal(minClass(["AdminUI.html", "EduOps_ClientComponents.html"]), "ClientOnly", "ClientOnly classification");
assert.equal(minClass(["EduOps_Workload.js", "Admin_AccessControl.js"]), "BackendSemantic", "BackendSemantic classification");
assert.equal(minClass(["Admin_StageBatchCommunications.js"]), "HighRiskAuthority", "HighRiskAuthority classification");
assert.equal(minClass(["unknown-runtime.foo"]), "HighRiskAuthority", "unknown file conservative classification");
assert.ok(rank.ClientOnly < rank.HighRiskAuthority, "risk downgrade fixture");

assert.match(core, /Risk downgrade rejected/, "Core rejects risk downgrades");
assert.match(core, /Pre-existing staged files are not supported/, "Preflight rejects unsupported staged files");
assert.match(core, /Unexpected changed files/, "Preflight rejects unexpected files");
assert.match(core, /Student deployment target rejected/, "Student target rejected");
assert.match(core, /Production deployment target rejected/, "Production target rejected");
assert.match(core, /Unknown deployment target rejected/, "Unknown deployment target rejected");
assert.match(core, /Get-FodeNextRuntimeIdentity/, "Runtime identity calculation centralized");
assert.match(core, /Runtime identity mismatch/, "Runtime identity validation exists");
assert.match(core, /ReleaseClass -eq "DocsOnly"|ReleaseClass\)\s*\{\s*\$common \+ "documentation-checks"/, "DocsOnly test group exists");
assert.match(core, /FodeCriticalInvariantTests[\s\S]*verify-runtime\.ps1[\s\S]*admin-role-capability-convergence\.test\.js[\s\S]*admin-canonical-finance-foundation\.test\.js[\s\S]*communication-send-gate-matrix\.test\.js[\s\S]*r391b-population-integrity-fail-closed\.test\.js[\s\S]*r391b-client-state-race\.browser\.test\.js[\s\S]*apps-script-deployable-file-contract\.test\.js/, "Permanent critical-invariant suite is explicit");
assert.match(core, /FodeDomainTestMap[\s\S]*client-state-workbench[\s\S]*classification-routing[\s\S]*capabilities-roles[\s\S]*finance[\s\S]*communication-safety[\s\S]*stage-batch-bulk[\s\S]*population-integrity[\s\S]*deployment-runtime-identity/, "Domain-to-test mapping covers required domains");
assert.match(core, /Get-FodeTestSelection/, "Test selection dispatcher exists");
assert.match(core, /Invoke-FodeTestGate[\s\S]*TEST GATE:[\s\S]*Full Gate failed[\s\S]*Fast Gate failed/, "Main test gate dispatcher executes selected Fast or Full Gate tests");
assert.match(core, /RequestedGate = "Auto"/, "Automatic gate selection exists");
assert.match(core, /ReleaseClass -eq "HighRiskAuthority"[\s\S]*HighRiskAuthority release/, "HighRiskAuthority escalates to Full Gate");
assert.match(core, /Production release/, "Production escalates to Full Gate");
assert.match(core, /release infrastructure or test-selection logic changed/, "Shared release infrastructure changes escalate to Full Gate");
assert.match(core, /dependency mapping incomplete or uncertain/, "Incomplete dependency mapping escalates to Full Gate");
assert.match(core, /explicit operator Full Gate request/, "Explicit Full Gate request is honored");
assert.match(core, /Mandatory Full Gate cannot be downgraded to Fast Gate/, "Mandatory Full Gate cannot be downgraded");
assert.match(core, /full repository suite/, "Fast Gate records full suite as intentionally not run");
assert.match(core, /residualRiskFromBoundedSelection/, "Evidence records residual risk from bounded selection");
assert.match(core, /sourcePushed[\s\S]*appsScriptVersionCreated[\s\S]*adminRepinned[\s\S]*acceptanceCompleted/, "Partial-state manifest fields exist");
assert.match(core, /Assert-FodeResumeState[\s\S]*Changed-source resume rejected/, "Changed-source resume rejection exists");
assert.match(core, /Assert-FodeVersionCreationAllowed[\s\S]*Duplicate Apps Script version creation rejected/, "Duplicate-version prevention exists");
assert.match(core, /Assert-FodeRemoteConfigReadbacks[\s\S]*remote Config mismatch stop[\s\S]*inconsistent repeated readback stop/, "Remote-config mismatch and inconsistent readback stops exist");
assert.match(core, /Assert-FodeRepinVerification[\s\S]*failed repin verification/, "Failed repin verification stop exists");
assert.match(core, /Assert-FodeNoSecrets/, "Secret redaction guard exists");
assert.match(core, /refresh_token\|client_secret\|access_token\|Authorization/, "Secret patterns are blocked");

assert.match(invoke, /ValidateSet\("DocsOnly", "ClientOnly", "BackendSemantic", "HighRiskAuthority"\)/, "Release classes are explicit");
assert.match(invoke, /Detected minimum release class/, "Detected class is printed");
assert.match(invoke, /Assert-FodeReleaseClassAllowed/, "Risk downgrade rejection is enforced");
assert.match(invoke, /\[switch\]\$DryRun/, "Dry-run mode exists");
assert.match(invoke, /\[switch\]\$CommittedSourceRelease/, "Committed-source mode is explicit");
assert.match(invoke, /\[string\]\$AcceptedBaselineCommit/, "Committed-source mode requires an accepted baseline");
assert.match(invoke, /Get-FodeCommittedSourceInventory/, "Committed-source inventory derivation is centralized");
assert.match(invoke, /merge-base --is-ancestor/, "Committed-source baseline ancestry is verified");
assert.match(invoke, /Committed-source release requires a clean working tree and index/, "Committed-source dirty state is rejected");
assert.match(invoke, /empty eligible release inventory/, "Committed-source empty inventory is rejected");
assert.match(invoke, /services\/communication-ledger\/migrations\//, "Ledger migrations remain eligible deployment source");
assert.match(invoke, /origin\/main.*ExpectedHead|HEAD is not equal to origin\/main/, "Committed-source remote alignment is enforced");
assert.match(invoke, /changed = @\(\$changed \+ "Config\.js"/, "Committed-source mode adds exactly one runtime identity change");
assert.match(invoke, /Student protected:/, "Student deployment remains protected");
assert.match(invoke, /Production:/, "Production deployment remains protected");
assert.match(invoke, /\[string\]\$Gate = "Auto"/, "Operator can request Auto/Fast/Full gate");
assert.match(invoke, /No Config\.js edit, clasp push, Apps Script version, deployment repin, git stage, commit, push/, "Dry-run no-mutation guarantee is printed");
const dryRunBlock = invoke.match(/if \(\$DryRun\) \{[\s\S]*?exit 0[\s\S]*?\}/);
assert.ok(dryRunBlock, "Dry-run block exists");
assert.doesNotMatch(dryRunBlock[0], /Update-FodeConfigIdentity|clasp\.cmd|git add|git commit|git push|deploy --deploymentId/, "Dry-run block performs no local or remote mutation");
assert.match(invoke, /remote Config readback 1[\s\S]*remote Config readback 2/, "Repeated remote Config readback preserved");
assert.match(invoke, /Assert-FodeVersionCreationAllowed[\s\S]*clasp\.cmd version/, "Duplicate-version guard runs before version creation");
assert.match(invoke, /clasp\.cmd push[\s\S]*verify-remote-config-before-version\.ps1[\s\S]*clasp\.cmd version[\s\S]*deploy --deploymentId/, "Remote sequence order is preserved");
assert.match(invoke, /verify-runtime\.ps1/, "Runtime whoami verification retained");
assert.match(invoke, /MockRemote/, "Remote operations can be mocked for tests");
assert.match(invoke, /Not committed or pushed - awaiting final owner acceptance/, "Owner acceptance boundary retained");
assert.match(invoke, /Selected gate:[\s\S]*Selected tests:[\s\S]*Tests intentionally not run:[\s\S]*Escalation reasons:/, "DryRun/evidence console reports exact selected gate and tests");
assert.match(invoke, /Invoke-FodeTestGate -TestSelection \$testSelection/, "Primary release command uses the governed test dispatcher");

assert.match(complete, /ManifestPath/, "Closure command loads a manifest");
assert.match(complete, /Manifest diff hash mismatch/, "Closure rejects changed source");
assert.match(complete, /Post-acceptance drift rejected/, "Closure rejects post-acceptance drift");
assert.match(complete, /git add -- \$approved/, "Closure stages only manifest-approved files");
assert.match(complete, /git diff --cached --check/, "Closure runs cached diff check");
assert.match(complete, /git commit -m \$CommitMessage/, "Closure commits once");
assert.match(complete, /git push origin main/, "Closure pushes current branch");
assert.match(complete, /HEAD != origin\/main/, "Closure verifies remote alignment");
assert.match(complete, /working tree not clean after closure/, "Closure verifies clean working tree");

assert.match(invoke, /apps-script-deployable-file-contract\.test\.js/, "Deployability contract test is orchestrated");
assert.doesNotMatch(core, /ClientOnly"\)[\s\S]{0,180}full-suite/, "ClientOnly no longer defaults to full suite");
assert.doesNotMatch(core, /BackendSemantic"\)[\s\S]{0,220}full-suite/, "BackendSemantic no longer defaults to full suite");
assert.match(core, /FULL_REPOSITORY_SUITE/, "Full Gate can select the full repository suite");
assert.match(core, /productionNoTouchStatus/, "Production no-touch status is recorded");
assert.match(core, /protectedStudentIdentity/, "Student protection is recorded");
assert.match(core, /docs\\audits\\releases/, "Evidence location defaults under docs/audits/releases");

assert.match(toolsReadme, /Invoke-FodeAdminRelease|Complete-FodeReleaseCommit|Admin Release Pipeline/s, "Tooling README documents the consolidated commands");

assert.match(core, /Gate = \$gate/, "Manifest records selected Fast or Full Gate");
assert.match(core, /TestsIntentionallyNotRun/, "Manifest records tests intentionally not run");
assert.match(core, /EscalationReasons/, "Manifest records escalation reasons");

console.log("PASS Admin release pipeline consolidation contracts");
