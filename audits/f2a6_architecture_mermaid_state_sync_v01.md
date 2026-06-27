# F2A.6 Architecture, Mermaid, and State Synchronisation v01

## Executive result

Result: PASS_WITH_WARNINGS

This documentation-only pass synchronised architecture docs and Mermaid/state diagrams with the r301+ runtime truth captured in DR5, F1, F2A, and F2A.5. No runtime source, deployment, Apps Script source, Sheet, Drive, production, Student, or OPS changes were made.

Warnings:

- The architecture remains partially aspirational around owner/action queues, LAP automation, classroom authority, Google Forms replacement, contactability, and AI-assisted review.
- Mermaid syntax was updated as plain source. Dedicated Mermaid CLI validation was not available in the repo at the time of this pass.
- F2B may proceed only for narrow proof-backed archive candidates. Broader pruning still requires protected-surface checks.

## Files synchronised

| File | Update |
| --- | --- |
| `docs/architecture/README.md` | Added r301+ runtime truth and documentation-impact rule. |
| `docs/architecture/Architecture_Overview.md` | Added current intake, protected live action backends, Admin/OPS boundary, and future/partial surfaces. |
| `docs/architecture/Authority_Model.md` | Added signed routes, preview/gallery, Zoho, communication semantics, contactability, LAP, and protected authority surfaces. |
| `docs/architecture/Roadmap.md` | Reconciled implemented, partial, deferred, frozen, and original architecture phases. |
| `docs/architecture/Mermaid/Architecture_Flow.mmd` | Updated current runtime architecture flow. |
| `docs/architecture/Mermaid/Authority_Model.mmd` | Updated authority boundaries and protected live surfaces. |
| `docs/architecture/Mermaid/Queue_Model.mmd` | Updated current Admin queues and separated future owner/action model. |
| `docs/architecture/Mermaid/Communication_Model.mmd` | Updated H-series communication registry and Stage Batch separation. |
| `docs/architecture/Mermaid/Operator_Actionability_Flow.mmd` | Marked current versus future actionability fields. |
| `docs/architecture/Mermaid/Lifecycle_State_Machine.mmd` | Replaced outdated state model with current queue/stage-oriented flow and future LAP marker. |

## Runtime truth reflected

- Admin Dashboard / Legacy Admin is the live operator authority surface.
- OPS is frozen as reference/secondary.
- FormDesigner is the current intake source.
- Google Forms replacement is future work.
- Document verification, signed routes, preview/gallery/lightbox, and applicant-folder `FODE_PREVIEW` are protected live surfaces.
- Payment verification and Zoho Books are protected live surfaces.
- Communication semantic registry, selected-applicant templates, and Stage Batch separation are protected live surfaces.
- Classroom handover is partial/future authority and must not be inferred from payment alone.
- LAP automation is partial scaffold/future authority.
- Contactability/bounce visibility is partial/future.
- AI precheck is future advisory-only.
- DR tooling and governance baselines are protected live operational surfaces.

## Lifecycle/state synchronisation

The lifecycle diagram now reflects the current operator queue progression:

1. Application received / FD received.
2. Docs required or Documents to Verify.
3. Docs verified moves to Awaiting Payment or Payments to Verify.
4. Payment verified moves toward classroom handover context.
5. Fraud/exception and contactability review are explicit side paths.
6. LAP automation is marked future/partial, not current broad authority.

## Documentation-impact rule added

Future CIS work must state whether it updates or intentionally does not update:

- Mermaid diagrams
- Roadmap
- Architecture authority documents
- Lifecycle/state diagram
- Protected Surface Register

## F2B readiness

Narrow F2B Batch A may proceed after this sync. Approved starting scope remains limited to proof-backed archive candidates such as editor diagnostics, obsolete `test_*` helpers, unreachable probe routes, and closed manual wrappers.

F2B must not prune protected live, protected frozen, or partial/future authority surfaces without a dedicated CIS and proof.

## Safety confirmation

- Runtime files edited: No.
- Runtime deletion/archive/refactor: No.
- Apps Script push/version/repin/deployment: No.
- Sheet edits: No.
- Drive edits: No.
- Production touched: No.
- Student staging touched: No.
- OPS touched: No.
