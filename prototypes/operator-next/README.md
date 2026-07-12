# Operator Next Prototype

Status: standalone design prototype only

Open `operator-next-prototype.html` directly in a browser. It has no network calls, Apps Script bindings, or live data dependencies.

## Purpose

Operator Next tests a consolidated work surface before any runtime integration. It combines the strongest ergonomic features of the frozen OPS cockpit with the current Admin authority model.

The prototype demonstrates:

- broad workload groups and immediate worklists;
- full-population versus returned-cohort counts;
- server-authority labels and operator reasons;
- scoped selection and batch communication entry;
- Review Workspace as the mutation surface;
- Communication Authority preview/send states;
- lifecycle, communication, finance, contactability, and exception views;
- capability-aware controls;
- local-only WhatsApp contact export.

## Safety

- Synthetic records only.
- No `google.script.run`.
- No network requests.
- No external system writes.
- Send and mutation controls simulate state locally.
- This directory is not part of the Apps Script deployable contract.

## Prototype Controls

- Use the left navigation to change work surfaces.
- Start from Lifecycle Map, select a stage, then open its exact queue.
- Use Finance to inspect Payment Follow-up, Payment Review, quotes, invoices, receipts, and Books state.
- Select returned Applicant Action rows, then open Batch Communication.
- Open Review to inspect the authority chain and communication state.
- Change the role selector to preview capability-driven UI states.
- Open System Health for runtime, parity, integration, compatibility, release, and audit evidence.
- Resize the browser to test responsive behavior.

## Visual Evidence

- `evidence/pass1-correction/01-wide-lifecycle-map.png` - primary operating menu.
- `evidence/pass1-correction/02-wide-operational-dashboard.png` - attention and readiness dashboard.
- `evidence/pass1-correction/03-laptop-review-handoff.png` - exact applicant Review handoff.
- `evidence/pass1-correction/04-laptop-communications.png` - communication readiness and MTD activity.
- `evidence/pass1-correction/05-laptop-system-health.png` - runtime, parity, integration, and compatibility health.
- `evidence/pass1-correction/06-laptop-role-capabilities.png` - capability availability and explicit blocks.
- `evidence/pass1-correction/07-laptop-contactability-vcf.png` - selected manual-contact export.
- `evidence/pass1-correction/08-narrow-batch-communication.png` - narrow Batch Communication flow.

Regenerate locally with `node prototypes/operator-next/capture-prototype.js`. The capture opens the local HTML file only.

## Related Design Artifacts

- `docs/design/Operator_Next_Functional_Parity_Matrix.md`
- `docs/design/OPS_Ergonomics_Contract.md`
- `docs/design/Operator_Next_Architecture_Blueprint.md`
- `docs/design/Operator_Next_WhatsApp_Contact_Export.md`

No runtime files were modified for this prototype.
