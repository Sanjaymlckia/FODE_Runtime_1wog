# OPS Ergonomics Contract

Status: design input for Operator Next; OPS remains frozen/reference only.

## Retain

| OPS characteristic | Operator Next contract |
| --- | --- |
| Persistent dark left rail | Keep stable module navigation and selected-applicant context. |
| Dense white work surface | Keep high information density without nested decorative cards. |
| Blue active navigation | Preserve immediate location awareness. |
| Compact status pills | Use only for bounded state, authority, urgency, and gate outcomes. |
| KPI strip | Show workload truth: population, eligible now, cooling-off, exceptions. |
| Lifecycle cascade | Preserve global-versus-working distinction and stage drill-down. |
| Selected-applicant continuity | Selection survives navigation into Review, Finance, and Communications. |
| Explicit guarded actions | State capability, confirmation, and authority before mutation. |
| Readable disabled controls | Disabled labels remain legible and include a reason. |

## Recover Selectively

- Applicant queue density and quick contextual actions.
- Communication, billing, portal, and contactability handoffs from one selected record.
- Global lifecycle summary beside bounded working cohorts.
- Compact technical diagnostics behind disclosure controls.
- Local WhatsApp contact export with explicit no-send wording.

## Redesign

- Replace OPS client-side lifecycle inference with canonical server DTOs.
- Replace role modes with capability-backed action states.
- Replace broad queue labels with workload group plus immediate `worklistKey`.
- Replace mixed navigation/action cards with task-focused work surfaces.
- Replace old send panels with Review Workspace and Batch Communication authority flows.
- Separate operational health from release/deployment controls.

## Reject

- Any UI-local owner, lifecycle, actionability, payment, or communication eligibility derivation.
- Release, Git, clasp, version, or deployment controls inside the operator application.
- Direct WhatsApp send claims.
- Books metadata as payment authority.
- Review Queue or Stage Batch compatibility labels as canonical work authority.
- Generic Management catch-all for contactability failures.
- Hidden controls whose unavailable state is communicated only by opacity or colour.

## Visual Tokens

- Typeface: system sans-serif; 13-14px working text, 20-26px page/KPI values.
- Rail: deep navy with neutral text and a single blue active item.
- Surface: light neutral canvas and white working bands.
- Borders: cool grey-blue, 1px.
- Corners: 6-8px.
- Status: green ready, amber attention, red blocked, blue informational, grey inactive.
- Buttons: one canonical component; primary, secondary, destructive, disabled, and busy states.
- Density: 44px minimum interactive row height; compact tables; stable column widths.

## Interaction Contract

Every operator action exposes exactly one state:

- READY
- DISABLED
- BUSY
- BLOCKED

Every unavailable action includes an adjacent reason. Capability projection may explain a state, but backend authority remains final.
