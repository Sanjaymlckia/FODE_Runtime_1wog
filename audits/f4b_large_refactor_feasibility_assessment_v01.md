# F4B Large Refactor Feasibility Assessment

## Executive Decision

PASS_WITH_WARNINGS.

Decision:

**YES, BUT ONLY WITH BOUNDED SCOPE.**

The repository is not ready for an unconstrained large single-pass refactor across `Admin.js`, `Code.js`, `AdminUI.html`, and shared includes. It can support a larger-than-F4A pass only if the scope is bounded to one authority seam, does not cross protected surfaces, and uses the existing invariant test suite as a hard gate.

Recommended next CIS:

**F4C Bounded Authority Resolver Refactor — Queue/Lifecycle/Actionability Read Model Only**

Do not start a broad UI/backend rewrite.

## Large-Pass Suitability

### Current strengths

- F2 cleanup removed/proved some diagnostics and established protected-surface discipline.
- DR5 produced a usable recovery baseline.
- F3B/F3C added meaningful invariant tests for role boundaries, payment authority, document persistence, queue rollup, and communication gates.
- F3D/F3F resolved the main raw `Payment_Verified` authority drift.
- F4A consolidated canonical payment helper usage without behavior change.
- `tests/admin-ui-rpc-contract.test.js` now protects AdminUI inline parse/RPC contracts after prior hydration failures.
- Architecture docs and protected-surface registers are current enough to guide bounded refactor work.

### Current constraints

- `Admin.js`, `Code.js`, and `AdminUI.html` remain large, multi-domain files.
- A meaningful subset of tests are static/regex contract tests rather than fully executable behavioral tests.
- Apps Script runtime behavior cannot be fully reproduced locally with Node.
- Prior AdminUI hydration failures prove that local syntax checks are necessary but not sufficient for live Apps Script client safety.
- Windows process/session instability still affects long Codex runs and makes broad validation passes slower and less deterministic.

## Recommended Scope If Any

Proceed only with a bounded single-pass refactor focused on one seam:

### Recommended F4C seam

**Queue / lifecycle / actionability read-model consolidation.**

Candidate targets:

- `deriveApplicantLifecycleStage_`
- `deriveOperationalPipelineStage_`
- `buildActionabilityPreviewRow_`
- `isQueueCandidateRow_`
- queue DTO read-only authority fields
- shared row-facts helpers that compute document/payment/portal state for display only

Allowed objective:

- centralize read-only applicant state interpretation
- reduce duplicated document/payment/portal predicates
- preserve existing queue membership and actionability outputs
- add narrow tests around fixture rows before changing helper internals

This is the safest next larger pass because:

- payment authority is now better protected
- queue/document/payment invariants already exist
- it can be kept read-only
- it avoids write paths, send paths, Zoho, portal token mutation, and preview generation

## Explicit Non-Scope

Do not include any of the following in a large pass:

- `admin_setPaymentVerified` write behavior
- `admin_updateDocStatuses` write behavior
- Zoho draft/live/test email behavior
- selected-applicant send or Stage Batch send behavior
- communication template text
- portal token reset/access mutation logic
- FormDesigner intake/canonicalization
- Drive preview/gallery/lightbox generation
- applicant-folder backfill execution
- OPS classroom notify/send behavior
- visual redesign or AdminUI layout rewrite
- Apps Script deployment/version/repin

## Risk Matrix

| Area | Risk | Current Suitability | Recommendation |
|---|---:|---|---|
| Payment authority | Medium | Improved by F3D/F3F/F4A | Safe only for helper-level consolidation already covered by tests. |
| Queue/lifecycle/actionability | Medium | Reasonable tests exist, but logic is coupled | Best bounded F4C candidate with fixture-first tests. |
| Document verification writes | High | Tests exist but mutation authority is sensitive | Do not include in large refactor. |
| Zoho/payment write paths | High | Role tests exist, but live finance risk is high | Do not include. |
| Communications send paths | High | Good semantic/send gate tests, but live-send risk is high | Do not include. |
| AdminUI structure | High | Inline parse test exists, but prior hydration failures are serious | Avoid layout/template restructuring. |
| Preview/gallery/lightbox | Medium-high | Good tests, but Drive/rendering behavior is runtime-sensitive | Do not include in F4C. |
| Portal security | High | Token/access mutation is security-sensitive | Do not include. |
| OPS | High | Frozen surface | Do not touch except read-only classification if necessary. |
| FormDesigner intake | Medium-high | Canonicalization and empty-payload warnings are sensitive | Do not include. |
| Windows runner reliability | Medium | Recoverable but noisy | Use sequential validation and avoid long parallel command batches. |

## Required Safeguards

Any F4C bounded refactor must:

1. Declare one authority seam only.
2. Start from clean `origin/main`.
3. Add or update tests before/with helper movement.
4. Keep behavior-preserving tests green before commit.
5. Avoid Apps Script push, version, repin, Sheet, Drive, production, Student, and OPS actions.
6. Avoid broad AdminUI template restructuring.
7. Keep rollback to one commit.
8. Record before/after helper inventory in an audit note.
9. Run validation sequentially to reduce Windows runner failures.
10. Treat any live-runtime implication as a later release CIS, not part of refactor.

## Recommended Validation Suite

Minimum for F4C queue/lifecycle/actionability read-model consolidation:

- `node --check Code.js`
- `node --check Admin.js`
- `node --check Routes.js`
- `node --check Utils.js`
- `node tests/payment-authority-matrix.test.js`
- `node tests/payment-authority-drift.test.js`
- `node tests/payment-authority-nonqueue-consumers.test.js`
- `node tests/admin-review-queue-rollup-consistency.test.js`
- `node tests/admin-document-status-save-persistence.test.js`
- `node tests/admin-role-boundary-matrix.test.js`
- `node tests/admin-ui-rpc-contract.test.js`
- `node tests/communication-send-gate-matrix.test.js`
- `node tests/communication-semantic-registry.test.js`
- `git diff --check`

Recommended additional F4C test:

- `tests/applicant-state-read-model.test.js`

That test should use stable row fixtures to prove queue/lifecycle/actionability outputs are unchanged before and after helper consolidation.

## Rollback Strategy

For assessment-only F4B:

- revert this docs commit only if needed.

For future F4C bounded refactor:

- keep all refactor changes in one commit
- no deployment/source push in the refactor CIS
- rollback by reverting the F4C commit
- runtime rollback is unnecessary unless a later release CIS deploys the refactor

## Large-Pass Decision Detail

### Can this repo safely support a larger single-pass refactor now?

Yes, but not a broad one.

The repo can support a larger pass than F4A only when:

- the pass is limited to one read-only authority seam
- protected write/send/security surfaces are excluded
- tests are strengthened around fixture outputs
- validation remains sequential and deterministic

### Best candidate refactor seam

Queue/lifecycle/actionability read model.

Reason:

- it is central to operator behavior
- it already has payment/document/queue tests
- it can be refactored read-only
- it benefits from consolidation without touching live mutation paths

### Worst candidate refactor seam

AdminUI modal/gallery/communication/send surface combined refactor.

Reason:

- prior hydration failures
- inline Apps Script template risk
- send authority risk
- Drive/gallery runtime sensitivity
- high chance of mixing protected surfaces

## Final Recommendation

Proceed to F4C only as a bounded queue/lifecycle/actionability read-model consolidation.

Do not attempt a full single-pass runtime refactor across Admin, Code, UI, communications, documents, payment, and portal surfaces.

If F4C cannot be expressed as a single authority seam with explicit tests, continue small-slice refactors instead.
