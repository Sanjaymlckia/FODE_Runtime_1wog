# FODE Authority Model and Invariant Checklist (r105)

Baseline
- Trusted downstream runtime baseline: r105 / 105
- Canonical downstream scriptId: 1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90
- Scope: C:\ClaspFODE and C:\FODE_Runtime_1wog
- Purpose: define authoritative truth, seam rules, invariants, and current boundary conflicts

## 1. Repo Seam Rule

Upstream repo: C:\ClaspFODE
- Allowed role: intake adapter, normalization, enrichment, forwarding, external touchpoint preparation, intake observability
- Should not own: applicant lifecycle authority, portal continuity authority, queue authority, communication authority, document verification authority, payment verification authority

Downstream repo: C:\FODE_Runtime_1wog
- Authoritative role: applicant operational runtime, portal continuity, stage derivation, operator queueing, communication execution/history, Drive-backed document workflow, payment/document verification workflow, CRM handoff timing

Current seam quality
- Directionally correct but not clean
- Upstream currently performs early side effects before downstream acceptance:
  - Drive folder creation
  - Zoho contact/deal upsert
  - local activation/parity planning against the working sheet
- This creates boundary blur but downstream remains the operational authority in practice

## 2. Authority Model by Domain

### Applicant identity
- Authoritative source: downstream working sheet row keyed by ApplicantID
- Secondary surfaces: upstream parity traces, CRM contact/deal identifiers
- Conflicts: upstream simulates/inspects applicant creation before downstream acceptance
- Risk: duplicate or mismatched pre-acceptance identifiers/metadata

### Applicant lifecycle state
- Authoritative source: downstream derived stage logic from row/system state
- Source functions:
  - Admin.js: stageAggregationSnapshot_
  - Code.js: getApplicantStageAndEligibility_
- Secondary surfaces: admin dashboards, stage cards, queue summaries
- Conflicts: lifecycle state is derived, not explicitly stored; can be conflated with queue/actionability
- Risk: business-state changes become fragile when helper logic diverges

### Operator queue state
- Authoritative source: downstream queue assembly in Admin.js
- Secondary surfaces: admin UI lists/counts
- Conflicts: queue state is derived from lifecycle + verification + evidence + actionability, not the same thing as lifecycle state
- Risk: using stages as if they were queues produces wrong operational assumptions

### Portal access/state
- Authoritative source: downstream working sheet + PortalSecrets store
- Secondary surfaces: generated portal links, portal access status, upload routes
- Conflicts: token/hash traces exist upstream during intake prep; portal continuity lives downstream
- Risk: pre-acceptance token/folder work upstream can imply authority it should not have

### Communication history
- Authoritative source: downstream row contact fields for durable business history
  - Last_Contact_Type
  - Last_Contact_Result
  - Last_Contact_Batch
  - Last_Contact_DebugId
  - Last_Contacted_At
  - Email_* campaign fields
- Secondary surfaces: script properties used for cooldown timestamps
- Conflicts: durable history is split between row fields and script properties
- Risk: duplicate-send, replay, and preview/send reasoning bugs when the two disagree

### Communication cooldown / retry gating
- Authoritative source: downstream script properties plus resolver logic
- Secondary surfaces: row send history and attempt counts
- Conflicts: cooldown is not the same as durable send authority
- Risk: cooldown expiry can re-qualify rows unless durable family-scoped history is also honored

### Document storage
- Authoritative source: Google Drive artifacts referenced by downstream row fields
- Secondary surfaces: folder URLs in upstream/downstream, CRM folder URL copies
- Conflicts: upstream creates folders before downstream acceptance; CRM may receive folder references
- Risk: orphaned/pre-authoritative Drive artifacts and confusion over which layer owns document reality

### Document verification state
- Authoritative source: downstream sheet verification fields and admin actions
- Secondary surfaces: admin queues, rollup statuses, portal display
- Conflicts: file existence in Drive is not the same as verified document state
- Risk: assuming file presence equals operational acceptance

### Payment verification state
- Authoritative source: downstream sheet + admin verification workflow
- Secondary surfaces: payment emails, CRM push-on-payment-verified, paid queues
- Conflicts: payment evidence present, payment received, and payment verified are distinct but adjacent concepts
- Risk: operational shortcuts collapse evidence and verification into one state

### CRM sync state
- Authoritative source: downstream is the intended operational authority, but CRM sync currently occurs in both repos
- Secondary surfaces: CRM_Response, Contact_ID, Deal_ID, dry-run logs
- Conflicts:
  - upstream performs intake-time Zoho upsert
  - downstream performs payment-verified Zoho upsert
- Risk: CRM timing becomes semantically inconsistent and invites dependence on CRM too early

### Final completion / processing state
- Authoritative source: downstream derived lifecycle and verification/payment outcomes
- Secondary surfaces: admin queues, CRM stage/pipeline, email notifications
- Conflicts: PROCESSING and COMPLETE are lifecycle states, not CRM ownership states
- Risk: completion semantics drift if CRM is treated as the primary completion ledger

## 3. Explicit Model Distinctions

### Lifecycle state
- Meaning: where the applicant is in the admissions lifecycle
- Current source examples:
  - INVITE_PENDING
  - INVITED_AWAITING_RESPONSE
  - REMINDER_DUE
  - DOCS_REQUIRED
  - PAYMENT_REQUIRED
  - RECEIPT_AWAITING_VERIFICATION
  - PROCESSING
  - COMPLETE

### Operator queue state
- Meaning: what admins need to act on now
- Current source examples:
  - docs
  - awaitingPayment
  - payments
  - anomalies
  - paidApproved
  - postPaymentIssues

### Communication-family state
- Meaning: which business communication family a send belongs to
- Current source/business intent:
  - invite
  - pre-response reminder
  - docs follow-up
  - payment follow-up
  - receipt verification follow-up
- Current code gap: stage-batch mapping still collapses several later-stage families into generic reminder semantics in some paths

Rule
- Lifecycle state, queue state, and communication-family state are separate concepts and must not be treated as interchangeable without an explicit mapping layer.

## 4. Invariant Checklist

Future CIS work must preserve these invariants:
- Stage derivation is deterministic from row/system state.
- Lifecycle state and operator queue state are separate concepts.
- Communication-family state is separate from lifecycle state.
- No duplicate same-family send without an explicit retry path.
- Prior successful send history must be honored correctly within each communication family.
- Preview/send parity must hold where stage batching is used.
- CRM is not required for portal continuity.
- Drive-backed document workflow is authoritative before CRM completion.
- Upstream must not create operational truth that conflicts with downstream acceptance.
- Release/runtime truth is live whoami first, local source second.
- File presence in Drive is not the same as document verification.
- Payment evidence present is not the same as payment verified.
- CRM state is not applicant lifecycle authority.
- PortalSecrets + downstream row state govern portal access, not CRM.

## 5. Boundary Violations / Ambiguities

Source-proven ambiguity list:
- Upstream CRM timing is early and semantically ahead of downstream lifecycle authority.
- Upstream folder creation occurs before downstream acceptance, creating pre-authoritative Drive side effects.
- Communication truth is split between downstream row fields and script properties.
- Stage, queue, and communication-family concepts overlap in code and are not fully isolated.
- Downstream contains distinct single-send communication families, but some stage-batch paths still flatten later-stage communications into reminder semantics.
- CRM sync exists in both repos, which weakens the intended downstream-authority boundary.

## 6. Current Operating Interpretation

At the current trusted baseline, treat the system as follows:
- Upstream is an intake adapter with side effects that should be minimized over time.
- Downstream is the operational workflow brain.
- Sheets + PortalSecrets + Drive + downstream derivation logic define the live operational truth.
- CRM is a downstream integration/commercial record support layer, not the workflow authority.

## 7. Proposed Next CIS Sequence

1. CRM boundary hardening
- Clarify and narrow what upstream may do before downstream acceptance.
- Decide whether intake-time CRM upsert remains allowed or becomes downstream-owned only.

2. Communication truth unification
- Document or consolidate durable row history vs script-property cooldown authority.

3. Stage vs queue separation hardening
- Make the mapping layer explicit in code and naming so lifecycle state is not mistaken for queue state.

4. Communication-family normalization
- Finish aligning stage-batch behavior with distinct business communication families.

5. Drive/document authority tightening
- Reduce ambiguity between folder existence, file evidence, and verified document state.
