# r226A OPS Dependency and Strategic Decision

## Executive Summary

- OPS is not a standalone operational system. It is a composite UI over shared legacy/backend authorities plus an additional client-side interpretation layer.
- The strongest OPS dependencies are:
  - `admin_getReviewQueues()` for loaded working rows
  - `admin_getOpsLifecycleSummary()` for global lifecycle counts
  - shared lifecycle/actionability functions in `Code.js`
  - shared document/payment helpers in `Admin.js`
  - client-side row facts in `AdminUI_SharedRowFacts.html`
- OPS currently adds value in:
  - Global View vs Working View separation
  - loaded-row drill-down
  - selected-applicant context across multiple tools
  - Awaiting Uploads workflow
- OPS currently adds risk in:
  - duplicated interpretation of authority on the client
  - loaded-snapshot vs full-population confusion
  - communications/send UX complexity
  - dependence on queue payload shape rather than a single backend authority contract

## Strategic Decision

- **Recommended option: Simplify OPS**

Rationale:

- OPS does provide real operational value, so deprecating it now is premature.
- Full alignment is possible, but current OPS scope is too broad and too interpretation-heavy for safe continued expansion.
- Legacy Admin remains the primary operational surface, especially for trusted send workflows.
- The best path is to retain OPS where it is strongest:
  - read-heavy lifecycle visibility
  - loaded working-set drill-down
  - selected-applicant review context
- Reduce or pause the parts of OPS that duplicate or reinterpret send/review authority until the shared backend authority contract is simplified.

## Files and Shared Functions Reviewed

### OPS UI files

- [AdminUI.html](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\AdminUI.html)
- [AdminUI_OpsLifecycle.html](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\AdminUI_OpsLifecycle.html)
- [AdminUI_OpsApplicantQueue.html](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\AdminUI_OpsApplicantQueue.html)
- [AdminUI_OpsCommunications.html](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\AdminUI_OpsCommunications.html)
- [AdminUI_SharedRowFacts.html](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\AdminUI_SharedRowFacts.html)

### Shared/backend functions

- [Admin.js](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Admin.js)
  - `admin_getOperationalDashboardMetrics()`
  - `admin_getStageAggregation()`
  - `admin_getOpsLifecycleSummary()`
  - `admin_getReviewQueues()`
  - `adminOpsDocumentStateFromRow_()`
  - `adminOpsLifecycleStageKeyFromRow_()`
- [Code.js](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\Code.js)
  - `computeDocVerificationStatus_()`
  - `deriveApplicantLifecycleStage_()`
  - `deriveApplicantActionability_()`
  - `deriveCommunicationState_()`

## OPS Dependency Map by Authority Area

### 1. Document Authority

#### OPS dependencies

- `admin_getReviewQueues()` populates loaded review rows with:
  - `docs`
  - `awaitingPayment`
  - `payments`
- queue payload carries:
  - `opsDocumentState`
  - `requiredDocumentUploadComplete`
  - `hasDocumentUploadEvidence`
  - `missingRequiredDocuments`
- `AdminUI_SharedRowFacts.html` also builds client-side document state via `opsBuildRowFacts_()`
- `AdminUI_OpsCommunications.html` uses that client-side interpretation for:
  - `Missing Documents`
  - `Uploaded / Review Required`
- `AdminUI_OpsApplicantQueue.html` uses loaded queue rows for Awaiting Uploads workflow

#### Alignment assessment

- Partial alignment
- Shared backend review queues and OPS document metadata are useful and mostly coherent
- But OPS still reinterprets document authority client-side instead of trusting one server-derived contract end-to-end

#### Risk

- Medium
- Loaded queue payload and client-side row facts can drift semantically

### 2. Payment Authority

#### OPS dependencies

- `admin_getReviewQueues()` classifies:
  - `awaitingPayment`
  - `payments`
- payload exposes `Payment_Received`, `Payment_Verified`, receipt evidence, and invoice metadata
- `adminOpsLifecycleStageKeyFromRow_()` drives OPS Global View payment-related counts
- `opsBuildRowFacts_()` derives payment-facing labels/states for queue rows

#### Alignment assessment

- Partial alignment
- OPS lifecycle and queue surfaces depend on the same broad backend signals
- But again there is a split between:
  - server queue/lifecycle derivation
  - client-side row facts display logic

#### Risk

- Medium
- Operator can see different payment truth depending on surface:
  - global lifecycle
  - working rows
  - communications cohorts
  - legacy admin queue panels

### 3. Lifecycle / Actionability Authority

#### OPS dependencies

- `AdminUI_OpsLifecycle.html`
  - Global View -> `admin_getOpsLifecycleSummary()`
  - Working View -> `opsAllQueueRows_()` from loaded queue state
- `admin_getOpsLifecycleSummary()` uses `adminOpsLifecycleStageKeyFromRow_()`
- stage dashboard in `AdminUI.html` legacy path uses `admin_getStageAggregation()` -> `deriveApplicantLifecycleStage_()` / `deriveApplicantActionability_()`
- `AdminUI_SharedRowFacts.html` creates another client-side workflow/lifecycle projection for OPS row behavior

#### Alignment assessment

- Mixed / divergent
- OPS already had to add explicit Global View vs Working View separation because counts are not the same authority
- Legacy stage aggregation and OPS lifecycle summary do not use the same exact resolver path

#### Risk

- High
- This is the core trust issue:
  - full-population lifecycle summary
  - loaded review-queue working set
  - legacy lifecycle drill-down
  - client row facts
  all answer slightly different questions

### 4. Review Queue Authority

#### OPS dependencies

- `queueDataState` in [AdminUI.html](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\AdminUI.html) is the loaded OPS working set
- `opsAllQueueRows_()` in [AdminUI_OpsApplicantQueue.html](E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog\AdminUI_OpsApplicantQueue.html) concatenates:
  - `fdReceived`
  - `docs`
  - `awaitingPayment`
  - `payments`
  - `anomalies`
  - `paidApproved`
- most OPS applicant/drill-down workflows operate on those loaded rows only

#### Alignment assessment

- Strong alignment with backend queue authority for the working set
- Weak alignment with full-population truth

#### Risk

- Low for working-set drill-down
- High when operators mistake it for complete population truth

### 5. Communication Authority

#### OPS dependencies

- `AdminUI_OpsCommunications.html` defines queue cohorts using `opsBuildCommunicationRowFacts_()`
- `opsBuildCommunicationRowFacts_()` is client-side and wraps `opsBuildRowFacts_()`
- send/preview labels in OPS are wired around:
  - selected applicant context
  - queue cohort context
  - existing backend preview/send contracts
- shared backend communication state lives in `deriveCommunicationState_()` in `Code.js`
- communication activity counters in legacy admin dashboard come from `admin_getOperationalDashboardMetrics()`

#### Alignment assessment

- Weak to partial
- Shared backend send/eligibility authority exists
- OPS communications adds another UI semantics layer:
  - missing documents
  - cooldown
  - ready to contact
  - uploaded review required
- This makes OPS the most fragile authority consumer

#### Risk

- High
- This is where operator confusion and send-surface ambiguity have repeatedly appeared

## OPS vs Legacy Authority Alignment Assessment

### Shared authority use

OPS does share important backend sources with legacy admin:

- `admin_getReviewQueues()`
- `admin_getOpsLifecycleSummary()`
- `deriveApplicantLifecycleStage_()`
- `deriveApplicantActionability_()`
- `deriveCommunicationState_()`

### Divergence pattern

OPS diverges mainly by adding client-side interpretation and presentation contracts on top:

- `AdminUI_SharedRowFacts.html`
- queueDataState-loaded snapshot logic
- communication cohort mapping
- selected-applicant action bridge

### Net effect

- Legacy Admin is more operationally trustworthy because it is closer to the original backend authority and established workflow.
- OPS is better as an orchestration and visibility surface than as a primary send/review authority surface.

## Key Gaps and Risks

### 1. Multiple competing truths

- Global lifecycle truth
- loaded review queue truth
- legacy drill-down truth
- OPS row-facts truth

These are not yet one coherent authority system.

### 2. Client-side authority duplication

- `AdminUI_SharedRowFacts.html` is useful for UI state, but it also acts as a second authority interpreter
- that increases drift risk after every backend clarification

### 3. Queue payload dependency

- OPS heavily depends on what `admin_getReviewQueues()` includes in the loaded payload
- when payload semantics are incomplete, OPS compensates on the client
- that is a structural fragility

### 4. Communications surface is overloaded

- cohort visibility
- selected applicant context
- preview/send gating
- queue interpretation

This is too much responsibility for a surface already downstream of mixed authority sources

### 5. Legacy Admin is still primary for trusted operator execution

- especially batch preview/send workflows
- OPS is not yet the authoritative execution surface

## Strategic Decision Rationale

### Why not Align OPS fully now?

- Alignment would require more than UI cleanup
- it would require a stronger single backend authority contract for:
  - document state
  - payment state
  - lifecycle stage
  - communication eligibility
- that is a bigger program than a narrow follow-up CIS

### Why not Pause OPS entirely?

- OPS already provides useful operator value:
  - Global vs Working separation
  - loaded queue drill-down
  - cross-surface selected-applicant visibility
  - Awaiting Uploads workflow

### Why not Deprecate OPS?

- There is enough retained value that deprecation would throw away useful progress
- The issue is not “OPS has no value”
- The issue is “OPS currently tries to do too much with mixed authorities”

### Why Simplify OPS is best

- Keep what OPS is good at:
  - read-heavy orchestration
  - loaded snapshot workflow
  - cross-surface operator context
- reduce or freeze what is fragile:
  - send-adjacent communications orchestration
  - duplicated authority interpretation
  - ambiguous queue/send semantics

## Recommended Next Step

- `r226B` is justified

### Recommended form of r226B

- **Track H or boundary-setting audit-to-design step first, not direct feature work**

Preferred scope:

1. Define OPS retained scope
   - Global View
   - Working View
   - loaded applicant drill-down
   - selected-applicant context
   - Awaiting Uploads workflow

2. Define OPS reduced scope
   - no new send-authority work
   - no new cohort-send workflows
   - no extra client-side classification layers

3. Define shared backend contract candidates
   - authoritative document state
   - authoritative payment state
   - authoritative lifecycle key
   - authoritative communication eligibility summary

4. Decide whether OPS communications should become:
   - read-only / handoff-first, or
   - later rebuilt on a thinner backend contract

### Direct recommendation

- **Do not expand OPS execution/sending features next**
- **Do not deprecate OPS**
- **Simplify OPS and narrow its mission**

## Practical Strategic Position

### Keep in OPS

- Global lifecycle view
- Working snapshot view
- applicant queue drill-down
- selected applicant context
- Awaiting Uploads operational workflow
- read-only or preview-first diagnostics

### Freeze or demote in OPS

- new bulk communication execution
- send-authority expansion
- additional queue classifications derived only on the client
- attempts to make OPS the sole truth before backend authority is simplified

## Final Recommendation

- **Strategic decision: Simplify OPS**

Reason:

- OPS has enough distinct visibility value to keep
- but not enough authority coherence yet to justify broad operational expansion

## Boundary Confirmation

- No runtime files were modified for this review
- No sheets were modified
- No deployment, versioning, repin, commit, tag, or send occurred
