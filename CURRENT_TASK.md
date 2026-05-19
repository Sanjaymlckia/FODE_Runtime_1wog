# Current Task

## Accepted Baseline

- Release finalized: `r180 Ops Mode Workspace Acceptance Fix`
- Commit: `344c446`
- Tag: `staging-as180`
- Apps Script version: `190`
- Runtime identity: `r180 / 180`
- Admin staging deployment: `@190`
- Student staging deployment: `@190`
- Admin whoami: `r180 / 180`, `mismatch=false`
- Student whoami: `r180 / 180`, `mismatch=false`
- Script ID: `1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90`
- Effective user during release verification: `sanjay@minervacenters.com`
- Rollback target after finalization: accepted `r180 @190`

## Active CIS

- `CIS: Finalize r181 OPS Invoice Workflow Acceptance Fixes`
- Mode: release finalization with remote source verification gate
- Release candidate: `r181 / 181`
- Current accepted baseline before finalization: `r180 / 180`
- OPS invoice workflow acceptance: PASS in HEAD/dev browser testing.
- Release gate pending: remote Apps Script source verification before `clasp version`.

## Files Inspected

- `CURRENT_TASK.md`
- `AGENTS.md`
- `PROJECT_NOTES.md`
- `Config.js`
- `Admin.js`
- `Code.js`
- `AdminUI.html`
- `Utils.js`

## Files Changed

- `Config.js`
- `AdminUI.html`
- `Admin.js`
- `CURRENT_TASK.md`

## OPS Acceptance Fix Pass State

- Billing / Books:
  - `Refresh Invoice Status`: PASS.
  - `Open Invoice`: PASS.
  - Invoice URL lookup: PASS.
  - Zoho customer portal invoice opened successfully.
  - `Refresh Invoice Status` distinguishes refresh success from invoice URL availability.
  - When an existing Books invoice ID is present locally or returned by read-only reference lookup, backend preview attempts a read-only invoice ID lookup for an invoice URL.
  - `Open Invoice` checks loaded applicant detail and the latest Books preview for an existing safe invoice URL; if none is available it blocks clearly with `Invoice URL unavailable`.
  - No invoice creation, invoice send, payment creation, schema change, or Books write path was added.
- Communications:
  - Recipient display alignment: PASS.
  - Recipient display prefers the preview-resolved `effectiveEmail` once a matching preview exists.
  - Email workflow semantics remain unchanged; send still requires preview, Safe Mode target, recipient, and confirmation/server gates.

## r181 Release Gate State

- `Config.js` identity bumped locally to `r181 / 181`.
- Remote source verification passed from isolated temp pull outside the repo root.
- Apps Script platform version created: `191`.
- Admin staging deployment pinned to `@191`.
- Student staging deployment pinned to `@191`.
- Admin whoami passed: `r181 / 181`, `mismatch=false`.
- Student whoami passed: `r181 / 181`, `mismatch=false`.
- Browser OPS verification is still pending manual or connected-browser evidence; no commit/tag until it passes.
- No unintended live writes were observed during HEAD/dev acceptance.

## OPS Activation State

- OPS is no longer treated as a passive shell.
- Mode navigation, lifecycle map, applicant queue/filter/sort, applicant drawer, portal diagnostics, runtime truth, billing preview/status, classroom preview, system health, reports, action registry, parity, and drift views are active surfaces.
- Single-record applicant actions bridge to existing Admin/backend functions where available.
- Communications preview/send remains selected-applicant only with preview, stale-preview, recipient, confirmation, Safe Mode, and server gates.
- WhatsApp fallback export/email remains Super Admin controlled with confirmation and no direct WhatsApp send.
- Zoho Books OPS surface now exposes existing selected-applicant preflight, preview, draft invoice, and controlled test-email functions with preview/idempotency/server gates.
- Stage batch preview remains fully functional.
- Stage batch send remains visible and wired to the existing backend for a controlled live test in a future CIS; it still requires Super Admin, valid preview cache/cohort, exact count/stage/message confirmation, Config send gates, and idempotency.
- Classroom handover preview/notify remains available through existing preview and Safe Mode gates.
- Runtime/release controls remain guidance only; OPS does not run git, clasp, version, repin, rollback, commit, or tag actions.
- Prior passive-shell labels have been removed from backend-backed OPS actions.
- Queue browser CSV export is active.
- Stage preview and stage send remain visible and wired; send is ready for controlled live test in the next CIS and still requires Super Admin, valid preview cache/cohort, exact count/stage/message confirmation, Config send gates, caps, and idempotency.
- Books preflight, selected-applicant preview, invoice status refresh, draft invoice creation, invoice opening, and test invoice email controls are visible and wired to existing backend functions with selected-applicant, preview, duplicate, Config, and confirmation gates.
- Portal link load/open/copy/reset and portal lock/unlock controls are visible and wired where backend exists; mutation controls require selected applicant, Super Admin, and confirmation.
- Communications preview and send controls are visible and wired for approved Safe Mode target testing; preview, stale-preview, recipient, confirmation, Safe Mode, and server gates remain.
- Payment verification is exposed as a selected-applicant Super Admin action using the existing backend payment/docs/freeze/audit gates.
- Classroom handover preview and classroom-admin notify are exposed through existing backend gates.
- Classroom package creation, enrolment field updates, payment creation, autonomous workflow execution, and direct WhatsApp send are labeled as backend-missing or external where no OPS-safe backend exists.

## Still Blocked / External

- No FD acknowledgement work is active in this CIS.
- No trigger install/remove.
- No unattended automation.
- No CRM write.
- No bulk Books push.
- No payment creation.
- No uncontrolled enrolment/classroom state mutation.
- No live broad stage send during this CIS; controlled live test belongs to the next approved CIS.
- No deployment or release mutation from OPS.

## FD Acknowledgement Parked State

- FD acknowledgement implementation remains parked.
- No broad pending/batch acknowledgement processor remains.
- No admin-callable acknowledgement wrapper remains.
- No AdminUI path exists.
- No Routes path exists.
- No diagnostic wrapper, panel, route, trace return, or hardcoded applicant ID remains.

## Next Exact Step

- Provide connected browser/manual evidence for Admin OPS after repin:
  - runtime badge shows `r181 / 181`
  - OPS loads
  - Super Admin detected
  - selected applicant flow still works
  - Refresh Invoice Status still works
  - Open Invoice still works, or clearly blocks only if invoice URL unavailable
- If browser verification passes, stage only approved files, commit, push, tag `staging-as181`, and push the tag.

## Continuity Note

Project notes initialized for:

- operator observations
- UX findings
- future enhancements
- non-blocking issues
