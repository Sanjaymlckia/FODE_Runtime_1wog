# E2 Communication Authority Audit v01

Status: Discovery only  
Baseline: Admin staging `r276 / 276`

## Scope

This audit evaluates communication authority and communication visibility across:

- Communication Performance
- Stage Batch Communications
- Preview Cohort
- Review Queues
- Actionability Preview
- Applicant Review modal
- communication counters
- communication helper text
- communication-related buttons

Inspected sources:

- [AdminUI.html](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html)
- [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js)
- [docs/architecture/Authority_Model.md](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/docs/architecture/Authority_Model.md)
- [docs/architecture/Communication_Model.md](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/docs/architecture/Communication_Model.md)
- [docs/architecture/Queue_Model.md](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/docs/architecture/Queue_Model.md)
- [audits/r226B_ops_freeze_boundary_note_v01.md](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/audits/r226B_ops_freeze_boundary_note_v01.md)

## Surface Classification

| Surface | Classification |
|---|---|
| Review Queues | Operational workload surface |
| Lifecycle drill-down | Operational summary / advisory stage surface |
| Communication Performance | Diagnostic/supporting communication visibility |
| Actionability Preview | Advisory / derived / non-authoritative |
| Applicant Review modal communications | Operational single-applicant preview/send workspace |
| Stage Batch Communications | Operational batch communication tooling |
| Preview Cohort Result | Authoritative preview visibility for batch eligibility |

## Communication Type Table

| Communication Type | Authority Source | Eligibility Source | Visibility Surface | Operator Clarity | Retain / Move / Collapse / Retire |
|---|---|---|---|---|---|
| legacy_invite | backend message resolver | `admin_previewApplicantMessage()` / `resolveApplicantMessageContextFromRow_()` | applicant modal, stage drill-down, Stage Batch | Medium | Retain |
| reminder (docs/payment/response) | backend message resolver | `admin_previewApplicantMessage()` and Stage Batch preview path | applicant modal, Stage Batch, lifecycle/actionability surfaces | Medium | Retain |
| document reminders | backend message resolver + lifecycle/actionability | single-applicant preview/send and Stage Batch for eligible stages | partially visible | Medium | Retain |
| payment reminders | backend message resolver + lifecycle/actionability | single-applicant preview/send and Stage Batch for eligible stages | partially visible | Medium | Retain |
| receipt requests / receipt verification follow-up | backend payment/document truth | queue/workflow + message resolver | weakly visible | Medium-High | Move |
| verified quotes / docs quote follow-up | mixed current workflow tooling | queue/send helper path, not cleanly surfaced as communication authority | scattered | High risk | Needs authority review |
| fd_acknowledgement | dedicated backend path | `admin_runFdAcknowledgementForApplicant()` | not strongly surfaced on opening Admin | Medium-High | Move |
| manual single-applicant communications | backend send authority | preview + explicit confirmation + safe mode gates | applicant modal | Medium | Retain |
| Stage Batch communications | preview cache + backend send authority | `admin_previewStageBatch()` then `admin_sendStageBatch()` | Stage Batch panel + Preview Cohort Result | High | Retain |
| dormant / final follow-up | not cleanly isolated as first-class surface | actionability / lifecycle / communication history interplay | weakly visible | High | Needs authority review |

## Authority Findings

### What is authoritative

1. Communication truth is separate from lifecycle truth.
2. Review queues are workload, not communication authority.
3. Actionability is recommendation, not communication authority.
4. Stage Batch Preview is authoritative for batch mail eligibility.
5. Send Authority validates before actual send.
6. Single-applicant preview/send flows are backend-gated and more trustworthy than UI heuristics.

### Current authority quality

Strong:

- batch preview/send separation
- single-applicant preview before send
- confirmation and role gates
- queue/mail-eligibility distinction is documented in the UI

Weak:

- opening communication visibility is diagnostic-heavy rather than operator-decision-heavy
- communication workload is split across too many surfaces
- some communication types are not clearly named as distinct operational families

## Duplication Findings

1. Communication workload is represented in multiple partial surfaces:
   - Communication Performance
   - lifecycle drill-down
   - Actionability Preview
   - Stage Batch Communications
   - applicant modal communications
2. `Review Queues` and lifecycle/actionability surfaces can both imply urgency, but they do not express the same communication truth.
3. Communication Performance counters show activity/status, but not necessarily current operator communication workload.

## Contradiction Findings

### Not direct contradictions, but risk-prone distinctions

1. `review queue visible` is not mail eligibility.
2. `dashboard actionable` is not guaranteed batch-mail eligible.
3. row-level communication activity is not the same as actual sends today.
4. Communication Performance can imply operational workload even when it is mostly historical/status evidence.

These distinctions are mostly implemented correctly, but still cognitively expensive.

## Hidden Communication Workload

Current opening surface does not immediately answer:

- who needs communication now
- why they need communication
- whether the needed communication is single-applicant or stage-batch
- whether a communication need is blocked by cooldown, missing email, bounce state, or authority

Communication workload is therefore `partially visible`, not `operator-first`.

## Special Relationship Findings

### Review Queues

- operational workload
- not send authority
- sometimes the source of the operator choosing a row to communicate from

### Lifecycle

- state / stage summary
- helps frame possible communication family
- not itself send authority

### Communication Performance

- primarily diagnostic/supporting
- useful for trend/state, not sufficient for operator next action

### Actionability Preview

- advisory
- derived
- useful for “who should act next”
- not send authority

### Stage Batch Communications

- operational batch tooling
- relies on separate authoritative preview
- strongest batch communication visibility surface

### Preview Cohort

- authoritative batch eligibility preview
- should remain distinct from queues and dashboard counts

## Key Findings

1. Communication authority quality is generally sound.
2. Communication visibility quality is only moderate.
3. The system distinguishes authority vs advisory vs operational vs diagnostic reasonably well in code and helper text.
4. The operator still has to synthesize too much across multiple surfaces.
5. Communication Performance is not a strong “what needs communication now” surface.
6. Batch communication authority is much clearer than opening-surface communication visibility.

## Recommended Future Direction

Conceptual only:

1. Preserve current authority boundaries:
   - review queues = workload
   - actionability = advisory
   - preview cohort = batch eligibility
   - send authority = backend validation
2. Improve communication visibility, not by merging authority systems, but by surfacing:
   - communications due
   - blocked communication reasons
   - single-applicant vs batch-ready distinction
3. Avoid adding new communication logic before visibility is reconciled.

## Recommended Next Slice

Recommended next slice from this report:

- `E2.1 communication visibility reconciliation`

Likely goals:

- show communication workload more directly
- reduce duplication between performance/activity counters and actual operator action surfaces
- keep batch preview/send authority separate

Not recommended yet:

- changing send logic
- changing queue logic
- changing lifecycle logic

## Risk Assessment

- Low risk: surfacing clearer communication visibility using existing authorities
- Medium risk: collapsing current communication panels before a replacement visibility model exists
- Medium risk: mixing communication visibility work with send-authority redesign

## Confirmation

- No runtime files edited
- No tests edited
- No deployment
- No version
- No repin
- No commit
- No send
- No Sheet edit
- No Drive edit
