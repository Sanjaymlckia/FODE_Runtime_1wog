# r23D.7B Document Preview Reliability Fix

## Scope

Selected-applicant document review surface only.

## What Changed

- Document cards now use a compact responsive grid to reduce scrolling.
- Each uploaded document shows:
  - document label,
  - file evidence status,
  - field identifier,
  - preview availability/status,
  - Preview,
  - Open in New Tab,
  - Download.
- Preview remains best-effort.
- The preview modal now always shows Open in New Tab and Download fallback links.
- The preview modal displays a status message if the iframe is slow or blocked.
- r23D.7B.1 correction: PDF/unknown documents no longer advertise iframe preview by default.
- r23D.7B.1 correction: image-like documents may show inline preview; PDFs/unknowns make Open in New Tab primary.
- r23D.7B.2 correction: manual retest confirmed both Open in New Tab and Download work.
- r23D.7B.2 correction: the inert Open recommendation pill was narrowed to a clearly non-actionable text recommendation.
- r23D.7B.3 correction: CodexHub harness proved Download emits browser download events while Open reaches a browser-dependent Apps Script wrapper.
- r23D.7B.3 correction: Download is primary/recommended; Open in New Tab remains secondary and explicitly browser-dependent.

## What Did Not Change

- No document authority changes.
- No lifecycle changes.
- No queue membership changes.
- No communication send changes.
- No Stage Batch changes.
- No AI/pre-check implementation.
- No sheet schema changes.

## Preview/Open/Download Hierarchy

```text
Image preview if safely detected
-> Download as the reliable primary action
-> Open in New Tab as a browser-dependent secondary action
```

PDF note: embedded PDF preview inside the Apps Script/Chrome iframe context remains unreliable. The document-button harness confirmed Download events and classified Open wrappers as browser-dependent rather than proven reliable content rendering.

## Files Changed

- `AdminUI.html`
- `Config.js`
- `audits/r23D_7B_document_preview_reliability_fix_v01.md`

## r23D.7B.2 Root Cause

`Open recommended` was a non-clickable status pill, not an action. Its styling made it appear actionable. Manual retest confirmed the actual Open in New Tab and Download links work, so r23D.7B.2 is limited to recommendation-label clarity.

The r23D.7B.3 harness established the final card hierarchy: Download is the proven reliable path. Open remains available when a secure URL exists, but the UI must not recommend or imply that it is reliable across browsers.

## Test Evidence

- CodexHub Playwright confirms secure document links resolve and document actions render.
- Manual operator verification is authoritative for whether Chrome permits the resulting file action.
- r23D.7B.2 staging/manual verification remains pending.

## Deployment Proof

Pending.

## Safety Confirmation

No production deployment, Student staging repin, send, sheet edit, lifecycle write, queue membership change, communication automation, or AI authority change is intended under this release.
