# Architecture Roadmap

Status: r301+ architecture sync
Scope: documentation only

## Implemented at r301+

- Admin Dashboard / Legacy Admin remains the live operator authority surface.
- Document verification, status persistence, `Docs_Verified` rollup, signed file routes, preview/gallery/lightbox, and applicant-folder `FODE_PREVIEW` renditions are live.
- Payment verification and Zoho Books are protected live surfaces.
- H1-H5 communication semantic registry, template text, selected-applicant exposure, and Stage Batch separation are live.
- D1Y.5 empty document payload diagnostic is live.
- DR tooling, release recording, and DR5 verification are established.
- F1, F2A, and F2A.5 audit baselines are complete.

## Partial / In Progress

- 7C-D preview backfill and future-upload preview closure.
- Contactability and bounce evidence visibility.
- Classroom acceptance/handover authority.
- LAP scheduled automation and single state-machine authority.
- Operator actionability owner/next-action queue model.
- Full Sheet/Drive DR backup execution schedule.

## Deferred / Future

- Google Forms replacement for FormDesigner.
- AI-assisted document review, advisory only.
- Visual redesign.
- Broad F3 refactor after F2 proof-backed archive passes.

## Frozen

- OPS remains frozen as a reference/secondary surface.

## Original Architecture Phases

### Phase 1: Documentation Consolidation

- Create `docs/architecture/` entrypoint.
- Consolidate architecture, authority, operational, communication, queue, and roadmap docs.
- Consolidate Mermaid sources.
- Preserve source documents.

### Phase 2: Operator Actionability Contract

- Finalize the read-only resolver contract.
- Define input authority dependencies.
- Define output fields.
- Define non-goals and send guardrails.

### Phase 3: Read-Only Runtime Discovery

Future CIS only:

- add read-only backend diagnostic/helper
- return actionability for one applicant row
- no row mutation
- no send
- no cache authority
- no OPS activation

### Phase 4: Legacy Admin Display

Future CIS only:

- display action owner, next action, and urgency in Legacy Admin
- keep details drill-down for authority truth
- keep send/preview authority separate

### Phase 5: Queue Refinement

Future CIS only:

- separate applicant-action, officer-review, finance-action, escalated, and dormant queues
- avoid using visible queue rows as send authority

### Phase 6: Communication Alignment

Future CIS only:

- use actionability as recommendation input
- keep Preview Authority and Send Authority authoritative
- no OPS bulk send unless separately approved

### Phase 7: OPS Reassessment

OPS remains frozen until:

- Legacy Admin authority model is stable
- Operator Actionability Resolver is proven
- marketing/intake priorities are stabilized

## Documentation Impact Rule

Future CIS work must state whether it updates or intentionally does not update:

- Mermaid diagrams
- Roadmap
- Architecture authority documents
- Lifecycle/state diagram
- Protected Surface Register
