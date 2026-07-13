# Operator Next Review Workspace

Status: Track L interface stabilisation pass only. No runtime release.

## Presentation Model

- Host: shared `AdminUI.html` Review modal
- Operator Next treatment: dedicated full-height workspace overlay
- Backend contract: unchanged existing Review handlers and DOM bindings

## Workspace Structure

1. Sticky identity header
2. Sticky section navigation
3. One primary vertical scroll region
4. Section groups:
   - `Overview`
   - `Documents`
   - `Finance`
   - `Communications`
   - `Portal`
   - `Audit / Technical details`

## Portal Summary

The workspace now exposes a readable portal section with:

- portal status
- token age
- next portal action guidance
- return-path reminder

This keeps portal readiness visible without forcing the operator to decode lower-level details.

## Scroll Contract

- Modal body remains the single primary scroll surface.
- Header and section nav stay reachable.
- Document action bar remains sticky inside the same main scroll context.
- No new nested page + modal + inner vertical scroll combination was introduced.

## Preservation Rules

- `review(rowNumber, applicantId, ...)` remains the entry point.
- Existing save/send/payment/portal handlers remain unchanged.
- No new Review RPCs were introduced.
