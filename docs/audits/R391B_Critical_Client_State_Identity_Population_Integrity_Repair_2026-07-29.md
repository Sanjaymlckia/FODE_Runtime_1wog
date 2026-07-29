# R391B Critical Client-State, Identity and Population-Integrity Repair

Date: 2026-07-29

Release track: Track H

Target: Admin `@427 / r391 / 391`

Student: `@247 / r217 / 217` unchanged

Production: untouched

## Phase 0 — R391A closure

`R391A_CLOSURE_PASS`

- Audit commit: `750a58a02436d8613724106f2478bd6c71cf378a`
- Commit message: `docs: record R391A platform audit and remediation map`
- Pushed: `origin/main`
- Post-push equality: `HEAD == origin/main`
- Ahead/behind: `0 / 0`
- Post-push state: clean

## R391B scope lock

Mandatory findings:

```text
R391A-CLIENT-01
R391A-CLIENT-02
R391A-CLIENT-03
R391A-POP-01
R391A-RENDER-01
R391A-CLIENT-04
deterministic R391A-TEST-01 coverage
```

Explicitly excluded: queue semantics, communication cadence policy, contactability/document precedence, Finance wording, visual redesign, bulk-orchestrator consolidation, durable event ledger, lifecycle policy, storage/schema changes, governance refresh and dead-code retirement.

## Pre-implementation request/state architecture map

This map was recorded before production edits.

### Workload request ownership

| Concern | Current owner | Current behavior and defect |
|---|---|---|
| Request identity | Closure variables `requestSequence`, `activeRequest`, `queuedRequest` in `EduOps_ClientCore.html` | Requests have local IDs and fingerprints. An active request can be marked superseded while a newer request queues |
| Latest user intent | Inferred from active/queued state | No independent latest-generation/fingerprint authority. A sequence A(active) → B(queued) → A can dedupe to the already-superseded A promise and still allow B to become accepted |
| Pending state | `renderPendingWorkload()` in `EduOps_ClientComponents.html` | Table rows are replaced by loading markup, but the previous DTO remains in `app.state.workload` |
| Accepted response | `finishRequest()` in `EduOps_ClientCore.html` | Superseded active responses are rejected, but acceptance is not explicitly bound to the latest requested generation and context |
| Row-dependent controls | Component handlers, Batch/Work Session and Operations Workspace handlers | Static selection, Work Session and package controls can read and rerender the previous DTO while a newer request is pending |
| Failure | `renderWorkloadError()` plus `clearSelection()` | Main rows are cleared, but a single render-phase contract does not own all workload-dependent controls and package projections |

Writers to the main workload table and empty state:

```text
renderRows()
renderPendingWorkload()
renderWorkloadError()
renderBootstrapError()
```

`renderWorkload()` calls `renderRows()` for successful responses. There is one principal table writer; the owner-observed row/empty contradiction is caused by CSS overriding `hidden`, not by two successful-response row renderers.

Adjacent file required by the CIS adjacent-file rule:

```text
EduOps_ClientOperationsWorkspace.html
EduOps_Client.html
EduOps_Styles.html
```

Reasons:

- `EduOps_ClientOperationsWorkspace.html`: package/bucket controls read `app.state.workload` directly and the prior cockpit remains actionable during a newer pending workload. It must participate in the same current-generation gate.
- `EduOps_Client.html`: it owns `startBootstrap()` and `applyBootstrap()`, so the required bootstrap generation repair cannot be made solely in the listed Core file.
- `EduOps_Styles.html`: its `.eduops-empty-state { display: grid; }` rule defeats `hidden`; an explicit hidden invariant is directly required for R391A-RENDER-01.

These edits remain within request generation and render truth. They do not change queue semantics, authority precedence or visual design.

### Bootstrap ownership

| Concern | Current owner | Current defect |
|---|---|---|
| Access/profile bootstrap | `startBootstrap()` and `applyBootstrap()` in `EduOps_Client.html` | No bootstrap generation or stale-completion rejection |
| Retry | Both retry controls call `startBootstrap()` | Older access/profile/workload completions can mutate shared bootstrap state after a newer retry |
| Visible failure | `renderBootstrapError()` | Does not participate in one mutually exclusive workload render-phase owner |

### Workbench and Work Session ownership

| Concern | Current owner | Current defect |
|---|---|---|
| Workbench request | `app.openWorkbench()` in `EduOps_ClientWorkbench.html` | No generation, expected ApplicantID, expected row or originating workload/session binding |
| Accepted Workbench | Every successful RPC assigns `app.state.workbench` | Completion order is trusted |
| Previous/Next | `navigateApplicant()` | During Work Session, these controls can open a different workload applicant without changing the session index, causing immediate deterministic divergence even without a network race |
| Work Session | `openWorkSession()`, `renderSession()`, `advanceSession()` in `EduOps_ClientBatch.html` | `advanceSession()` changes index and records completion before the requested applicant response is accepted |
| Applicant-scoped async reads | Workbench history, manifest, rendition and refresh callbacks | Responses are not uniformly bound to the accepted Workbench generation/entity |
| Action controls | Workbench and session renderers | Controls can remain available while a newer applicant is unresolved |

### Cache and post-mutation freshness

| Concern | Current owner | Current defect |
|---|---|---|
| Navigation context | `snapshotReturnContext()` | Correctly preserves query, filters, page, focus and scroll |
| Cached mutable projection | `currentWorkloadMatchesReturnContext()` / `restoreReturnContext()` | Equal query and snapshot labels permit direct rerender of the old workload DTO |
| Individual receipt | `refreshWorkbenchAfterReceipt()` | Refreshes the applicant only; workload classification and selection remain cached |
| Batch receipt | `completeWithReceipt()` / `closeBatch()` | Receipt is shown, then close can restore the old workload DTO |
| Operation invalidation | `invalidateOperationAuthority()` | Clears command/Batch preview authority, not workload freshness |

### Render ownership

Current CSS groups `.eduops-empty-state` with loading/error states and forces `display: grid`. No `.eduops-empty-state[hidden]` rule restores `display: none`. Therefore `hidden=true` can coexist with computed visibility. Loading, nonempty success, empty success and failure are not represented by one explicit phase.

### Population-integrity authority chain

```text
buildPopulationLedgerFromValues_()
  → buildCanonicalPopulationFromValues_()
  → canonicalPopulationReconciliation_()
  → canonicalPopulationSnapshot_()
  → eduopsResolveFodeSnapshot_()
  → eduops_queryOperationalWorkload()
  → eduopsReconciliationForRows_()
  → EduOps client / Batch commands
```

Current break:

- canonical reconciliation detects duplicate ApplicantIDs and can return FAIL;
- adapter cache records rows/counts but drops canonical reconciliation;
- workload reconstruction hard-codes `integrityState: "PASS"`;
- Batch catalogue and command preview build ApplicantID maps where canonical rows use last-write-wins while selected-sheet lookup uses first-write-wins;
- individual canonical read reports `DUPLICATE_APPLICANT_ID`, but callers can reduce it to generic not-found and legacy mutation paths do not share one explicit uniqueness gate.

### Reachable Batch entry points requiring integrity gates

```text
eduops_getBatchCommunicationCatalogue()
eduops_previewCommand(BATCH_COMMUNICATION)
eduops_executeCommand(BATCH_COMMUNICATION final revalidation)
admin_previewSelectedApplicantBatch()
admin_sendSelectedApplicantBatch()
admin_previewStageBatch()
admin_sendStageBatch()
```

R391B will not consolidate these orchestrators. It will apply the same canonical fail-closed integrity decision to each.

## Locked target architecture

### Workload invariant

One explicit latest request generation and exact context fingerprint own the workload. A response may commit only when both match. Pending or failure state invalidates the accepted mutable DTO, selection, Work Session and Batch authority. Row/package controls require a current accepted generation.

### Bootstrap invariant

Each bootstrap/retry receives a monotonically increasing generation. Only the latest generation may assign access, profile, defaults, runtime/source state, first workload or visible failure.

### Workbench/Work Session invariant

```text
displayed Workbench applicant
= accepted Workbench response applicant and row
= expected request applicant and row
= active Work Session applicant when a session exists
= applicant on which controls may act
```

Session completion/index changes commit only after the matching Workbench response is accepted. Direct opens use the same generation/entity binding. Applicant-scoped async callbacks must still match the accepted generation.

### Render invariant

Exactly one phase is active:

```text
LOADING
NON_EMPTY_SUCCESS
EMPTY_SUCCESS
FAILURE
```

Rows, empty text, loading and failure cannot coexist. CSS must honor `hidden`.

### Freshness invariant

Return context is navigational only. Any accepted mutation or receipt marks the affected workload/applicant projection stale, clears selection and Batch authority, and requires a new accepted workload generation before further action.

### Population-integrity invariant

Canonical reconciliation is propagated without reconstruction. It exposes population rows, distinct ApplicantIDs, duplicate IDs with row references, missing/invalid ID evidence, findings and an explicit `authoritySafeToBatch`. Duplicate or unproven integrity blocks catalogue, Batch preview and Batch send. Ambiguous individual identity blocks mutation without choosing a first or last row.

## Deterministic regression plan

| Scenario | Forced order / assertion |
|---|---|
| A | Open A; request B then C; resolve C before B; only C may become displayed/actionable |
| B | Force reordered Next/Previous/Skip; session index and displayed applicant commit atomically |
| C | READY accepted; REVIEW pending; old rows/selection/session/Batch/package controls cannot reappear |
| D | Resolve workload N+1 before N; N cannot change any render or authority state; also cover A→B→A dedupe edge |
| E | Nonempty → empty → loading → failure → retry → nonempty; exactly one render phase at every point |
| F | Individual receipt changing actionability marks workload stale and forces fresh authoritative return |
| G | Batch receipt invalidates workload and selection before return |
| H | Older bootstrap completion arrives after retry; only retry generation may establish state |
| I | Conflicting duplicate ApplicantID rows produce FAIL diagnostics and block catalogue, Batch preview/send and ambiguous individual mutation |

Production repair and final validation evidence will be appended below.

## Phase 2 — deterministic pre-repair failures

Production files had not been edited when these tests were created and run.

### Client-state race scaffold

File:

```text
tests/r391b-client-state-race.browser.test.js
```

`node --check`: PASS

Controlled baseline result: expected FAIL, `11/11` defects reproduced:

1. B/C reverse Workbench completion left B displayed after C had been accepted as latest intent.
2. Workbench top navigation displayed B while Work Session remained A.
3. rapid Next/Skip advanced the session index to 2 before any matching response was accepted.
4. a pending workload retained the previous DTO as current.
5. workload generation N+1 was not independently issued while N remained active.
6. A→B→A accepted REVIEW rather than the latest READY intent.
7. the empty state was computed visible with three applicant rows.
8. individual receipt return made no fresh workload request.
9. Batch receipt return made no fresh workload request.
10. older bootstrap GEN1 overwrote accepted GEN2 access/profile/defaults.
11. applicant A's late manifest attached after applicant B became current.

The scaffold uses controlled deferred promises and event/frame flushing, not timing sleeps.

### Population-integrity scaffold

File:

```text
tests/r391b-population-integrity-fail-closed.test.js
```

Controlled baseline result: expected FAIL, `7/7` contracts:

1. canonical snapshot had no `populationIntegrity`;
2. duplicate exact lookup returned an arbitrary first applicant instead of `applicant: null`;
3. adapter cache MISS/HIT omitted integrity metadata;
4. workload reconstruction reported unconditional PASS;
5. EduOps catalogue/preview/revalidation/execute had no population-integrity gate;
6. Selected Batch preview/send had no population-integrity gate;
7. Stage Batch preview/send had no population-integrity gate.

The canonical, cache, workload and exact-identity cases use deterministic VM fixtures. Batch cases prove gate reachability and required ordering before recipient/send boundaries.

## Phases 3–6 — implemented repair

### Client request and render ownership

The client now keeps independent latest/accepted generations for workload, bootstrap and Workbench requests. A request is accepted only when its generation and exact context still match current operator intent. Beginning a newer workload request clears the previous mutable DTO, selection, Work Session authority and Batch authority; stale successes and stale failures are discarded without rendering.

The workload render phase has one owner and one of four values: loading, non-empty success, empty success or failure. Row content and empty-state content are cleared atomically, and the CSS `[hidden]` contract prevents a hidden empty state from becoming visible through component display rules.

Bootstrap retry creates a new bootstrap generation. Only the latest generation may establish access, profile, runtime, snapshot, workload, compact queue context or expanded Operations Workspace context.

### Workbench and Work Session identity

Every Workbench request binds:

- Workbench request generation;
- expected ApplicantID;
- expected row number when known;
- expected snapshot;
- originating accepted workload generation and fingerprint;
- Work Session transition identity when applicable.

A response is accepted only when every available identity dimension matches current intent. Work Session index and active applicant commit only after the matching response is accepted. Direct row and search opens use the same exact binding. Document manifest, original-file and reusable-template callbacks are applicant-generation bound and cannot attach applicant A results to applicant B.

Mutation and communication controls fail closed while identity is pending, stale or mismatched. Dirty draft state belonging to a newer accepted applicant is not overwritten by an older callback.

### Freshness after mutation and receipt

An accepted mutation or receipt invalidates the applicant projection, workload DTO, selection and Batch authority. Navigation query/filter context is retained, but the old workload result is never restored as truth. A fresh workload generation is accepted first; an exact Workbench is reopened only if the applicant remains in the refreshed result.

Late individual or Batch receipts still invalidate and refresh global authority. Applicant-specific UI effects are applied only when the originating identity token remains current. Closing a Workbench after its receipt-triggered refresh does not issue a redundant second full workload request.

### Population-integrity propagation and gates

The authority path is:

```text
Admin_CanonicalPopulation.js
→ EduOps_FODE_Adapter.js
→ EduOps_Workload.js
→ EduOps_Commands.js
→ workload/query/selection DTOs
→ client Batch authority
→ Selected, Stage, EduOps, automated, planner and legacy Batch preview/send gates
```

`canonicalPopulationIntegrityGate_` validates the complete contract: schema, status, Boolean safety, codes/reasons, non-negative counts, evidence arrays, truncation flag and fingerprint. A claimed `PASS` is accepted only when population/distinct/scanned arithmetic is consistent, duplicate and missing counts/evidence are zero, findings are empty, evidence is not truncated and authority safety is true. Malformed or internally inconsistent `PASS` becomes `UNPROVEN`; no downstream layer reconstructs it as safe.

Duplicate exact ApplicantID lookup returns no applicant target. Individual preview/send tests prove the ambiguous identity is rejected before row hydration, Gmail/send boundaries or row patching. Batch catalogue, preview, locked execution, Selected, Stage, automated, planner and legacy entry points all fail closed before cohort/send effects when integrity is duplicate, unproven or changes after preview.

Batch selection binding includes the canonical population-integrity fingerprint. Catalogue and preview responses must echo the exact binding, so a response proved against another population cannot become executable.

### Conservative legacy boundary

The existing legacy function has a single-applicant compatibility branch behind its outer Batch entry point. R391B deliberately applies the population gate at the outer entry point, so an unsafe canonical population blocks that call even if one requested ID might otherwise be unique. This is conservative fail-closed behavior and does not choose a duplicate row or change business policy.

`campaign_prepareLegacyRows_` still performs its established candidate scan after the integrity gate. R391B proves the outer legacy send and planner reuse one canonical integrity snapshot; broader bulk-orchestrator consolidation or storage-level snapshot transactions remain outside this pass.

## Authorized scope review

| File group | R391B reason |
|---|---|
| `Admin_CanonicalPopulation.js` | Canonical integrity evidence, strict contract validation and ambiguous exact-ID rejection |
| `EduOps_FODE_Adapter.js`, `EduOps_Workload.js`, `EduOps_Commands.js` | Preserve integrity through cache/workload/query binding and enforce fail-closed command gates |
| `Admin_SelectedApplicantCommunications.js`, `Admin_StageBatchCommunications.js`, `Code.js` | Enforce integrity and fingerprint checks at every reachable individual/Batch effect boundary |
| `EduOps_ClientCore.html`, `EduOps_ClientWorkbench.html`, `EduOps_ClientBatch.html`, `EduOps_ClientComponents.html` | Request generations, exact identity, receipt freshness, render ownership and Batch binding |
| `EduOps_Client.html` | Adjacent bootstrap/retry generation ownership required by CLIENT-04 |
| `EduOps_ClientOperationsWorkspace.html` | Adjacent compact/expanded pending, failure and bootstrap context neutralization required by CLIENT-02/RENDER-01 |
| `EduOps_Styles.html` | Adjacent `[hidden]` rendering invariant required by RENDER-01 |
| `tests/` and Preview Lab files | Deterministic adverse-order, duplicate-integrity and historical contract reconciliation |

No lifecycle, Actionability, contactability, Finance or communication cadence policy changed. No durable ledger, PHP/SQLite, Sheet schema, Script Property schema, bulk-orchestrator consolidation, governance refresh, visual redesign or dead-code retirement was introduced.

## Independent correctness review

Two independent reviews re-traced the client and server paths after implementation. Initial review found two mandatory gaps: incomplete integrity DTOs could claim `PASS`, and Scenario I lacked behavioral individual preview/send proof. Both were repaired. Current-tree review result:

```text
R391B SOURCE CORRECTNESS: PASS
mandatory correctness blockers remaining: 0
population fail-closed contracts: 16/16 PASS
deterministic client-state scenarios: 35/35 PASS
```

Historical tests that simulated safe Batch authority were updated to load the canonical gate and provide the complete safe integrity DTO and exact response binding. Production fail-closed behavior was not weakened.

## Phase 7 — deterministic repeated race evidence

The 35-scenario adverse-order browser suite was run five times. Each run explicitly resolves deferred workload, bootstrap, Workbench, file, template, preview and receipt callbacks in hostile order.

```text
runs: 5/5 PASS
scenarios per run: 35/35 PASS
stale applicant renders: 0
stale workload restores: 0
row/empty contradictions: 0
stale bootstrap acceptance: 0
identity-mismatched action authority: 0
```

Final validation, remote-source and release identity evidence follows after the Phase 8 gates.

### Clean-start recovery finding closed in R391B

The mandatory clean-start suite proved one additional CLIENT-04 path before release: after a `source-unavailable` bootstrap failure, changing the Preview Lab scenario dispatched `eduops:preview-reload`, but the handler requested only a workload and left bootstrap state in `*_ERROR`.

The adjacent `EduOps_Client.html` handler now starts a new bootstrap generation whenever bootstrap is not `INTERACTIVE`; an already-interactive scenario change continues to request a fresh workload only. This is a request-generation repair, not a production test escape. The deterministic source-unavailable → retry → normal-authoritative recovery now reaches `INTERACTIVE`.

## Phase 8 — local validation evidence

```text
changed JavaScript node --check: 24/24 PASS
changed HTML script parse: 7/7 PASS
focused R391B/R390/affected matrix: 25/25 test files PASS
population fail-closed contracts: 16/16 PASS
adverse-order client races: 35/35 scenarios PASS × 5 runs
full repository: 77/77 test files PASS, 6,821 executed assertions
Apps Script deployable-file contract: PASS
git diff --check: PASS
```

Preview Lab:

```text
contract: PASS, methods=13, simulated receipts=true, capture read-only=true, assertions=156
primary browser: PASS, behaviours=48, viewport executions=3, assertions=146
clean-start: PASS, clean starts=3, controls=144, assertions=269
duplicate population browser: PASS, Batch disabled=true, command RPCs=0, assertions=15
Preview Lab total: 4/4 test files PASS, 586 executed assertions
console errors=0
page errors=0
failed/unresolved requests=0
material overflow findings=0
rows/empty contradictions=0
```

The clean-start evidence directory is test output only and is excluded from release scope; it is removed after evidence values are recorded.

## Release evidence

### Identity and preflight

```text
Config VERSION: r391
Config DEPLOY_VERSION_NUMBER: 391
identity invariant: PASS
release preflight: PASS
clasp status: PASS, 46 deployable files
deployable-file contract: PASS, 46 files
```

The first preflight invocation supplied the full SHA to a repository script that reads seven-character HEAD and therefore reported an input-format mismatch. Re-running with the script's expected `750a58a` form passed every gate; source, scope and deployment metadata were unchanged.

### Remote-source and immutable version proof

Exactly one `clasp push` was run. It pushed all 46 deployable files and did not report `Skipping push`.

Three consecutive Apps Script API `projects.getContent` readbacks passed:

```text
remote Config: r391 / 391
remote deployable files: 46
local set SHA-256:  bccc774475e66d1a1d1e20a9653013429ade48f3be525d2d58a02c1ed1c53119
remote set SHA-256: bccc774475e66d1a1d1e20a9653013429ade48f3be525d2d58a02c1ed1c53119
readbacks: 3/3 PASS
```

Apps Script version `427` was then created with description `R391B critical correctness repair`.

### Deployment and runtime identity

Only Admin staging was repinned:

```text
Admin deployment:
AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ @427
live whoami: r391 / 391 PASS

Student deployment:
AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv @247
live whoami: r217 / 217 PASS

Production: untouched
```

The pre/post deployment inventories contain the same seven deployment IDs. Only the active Admin staging pin changed from `@426` to `@427`.

### Read-only post-release browser acceptance

Acceptance URL:

```text
https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec?view=eduops
```

The initial observer used impossible local predicate names (`SUCCESS|EMPTY` and `decision.safe`) and timed out. Source tracing established the exact production contract (`SUCCESS_NONEMPTY|SUCCESS_EMPTY` and `decision.valid`). A corrected narrower observation did not repeat state switching or attempt to reproduce the intermittent owner finding.

Corrected read-only result:

```text
bootstrap: INTERACTIVE
bootstrap generation: 1 accepted 1
runtime: r391 / 391
snapshot: FODE-NSF4hfmc7oulb9lV
workload phase: SUCCESS_NONEMPTY
workload generation: 1 accepted 1
visible rows: 5
empty state visible: false
rows/empty contradiction: false
population integrity: PASS
population fingerprint: CPI-nOEccwZ3t_cLXg0TuHmWxMQWUVKxU_UFsXmeBPp_VPY
Batch authority valid: true
```

One exact direct Workbench open passed:

```text
expected: FODE-26-003233 / row 330
accepted: FODE-26-003233 / row 330
request binding: FODE-26-003233 / row 330
displayed: FODE-26-003233 / exact row 330
request phase: SUCCESS
controls bound to accepted identity: true
```

Console errors: `0`. Page errors: `0`. Gmail sends: `0`. Live operational mutations: `0`.

## Remaining findings

| Release | Remaining findings |
|---|---|
| R391C | `R391A-CLASS-01`, `R391A-CLASS-02`, `R391A-FIN-01`, `R391A-DTO-01`, `R391A-DTO-02`, `R391A-UI-01`, `R391A-CAP-01` |
| R391D/E | `R391A-CSS-01` visual/dead-style work |
| R391G | Residual `R391A-TEST-01` platform coverage beyond the mandatory R391B races |
| R391H | `R391A-ARCH-01`, residual `R391A-OBS-01`, `R391A-PERF-01`, and the `R391A-COMM-01` orchestration/ownership decision |
| R391J | `R391A-GOV-01` governance refresh |
| R390B2 after prerequisites | `R391A-COMM-02` durable ledger and any approved follow-on from `R391A-COMM-01` |

R391B runtime changes remain uncommitted pending owner manual acceptance.
