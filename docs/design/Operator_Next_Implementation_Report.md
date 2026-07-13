# Operator Next Implementation Report

Status: Track L interface stabilisation pass only. No runtime release.

## Scope

- Shared Operator Next typography, spacing, cards, tables, badges, buttons, and search/control rhythm were consolidated in `AdminUI_OperatorNext.html`.
- Human-readable labels were centralized through one client formatter/mapping contract instead of route-local string substitutions.
- Review was upgraded in `AdminUI.html` from a dense modal flow into a dedicated full-height workspace overlay with sticky section navigation and a single primary scroll container.
- Existing backend handlers, capability gates, Review mutations, Batch Communication flow, and current Admin fallback were preserved.

## Files Changed

- `AdminUI_OperatorNext.html`
- `AdminUI.html`
- `tests/operator-next-runtime-surface.test.js`
- `tests/admin-review-workspace-ux-surface.test.js`
- `docs/design/Operator_Next_Visual_System.md`
- `docs/design/Operator_Next_Review_Workspace.md`
- `docs/design/Operator_Next_Visual_Acceptance_Checklist.md`
- `docs/design/Operator_Next_Functional_Parity_Matrix.md`
- `docs/architecture/Compatibility_Shim_Register.md`

## CSS Conflict / Root Cause Summary

- The prior Operator Next shell mixed compact OPS-style proportions with a dense one-off token set. Body, badge, button, table, and helper text sizes were materially below the required operational baseline.
- Route surfaces reused the same class names but not the same visual density. Panels, status rows, worklists, and action bars all drifted in spacing and type scale.
- Review already had the required data and handlers, but presentation still behaved like a stacked modal rather than a dedicated workspace. The result was weak section hierarchy and difficult scanning.

## Shared Contracts Implemented

### Typography

- Base shell text: `15px`
- Page titles: `30px`
- Section titles: `19px`
- Buttons: `14px` minimum with `42px` minimum height
- Badges: `13px`
- Table body: `14px`
- Secondary detail text: `13px`

### Human-readable labels

- `PAYMENT_PENDING` -> `Payment pending`
- `PAYMENT_TO_VERIFY` -> `Payment to verify`
- `TEMPORARILY_ALLOWED` -> `Temporarily allowed`
- `docs_missing` -> `Missing documents request`
- Raw enums remain available secondarily through diagnostics/authority details, not as the primary operator label.

### Review workspace

- Sticky identity header remains at the top.
- Sticky section navigation now exposes `Overview`, `Documents`, `Finance`, `Communications`, `Portal`, and `Audit / Technical details`.
- Review content is grouped into dedicated sections with one main vertical scroll contract.
- Portal state is summarized in a dedicated readable panel instead of being discoverable only through technical modal details.

## Functional Preservation

- Review still opens through the existing `review(rowNumber, applicantId, ...)` path.
- Operator Next still consumes Actionability DTOs and existing Review/Batch handlers.
- No new Review RPCs were introduced.
- No business-rule, authority, payment, communication, portal, or release behavior was changed.

## Validation

- Scoped contract tests were updated for readable labels and Review workspace navigation.
- Browser screenshot capture was not completed in this pass.
- No Playwright/browser acceptance evidence is recorded yet.

## Release Status

- No deploy performed.
- No Apps Script version created.
- No runtime identity bump performed.
- No commit made.
