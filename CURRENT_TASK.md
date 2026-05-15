# Current Task

## Current Runtime Truth

- Accepted release: `r170 / 170`
- Local source is r170 Operations Cockpit visual rebuild against the saved mockup and read-only data refinement.
- Browser/product acceptance passed for r170 platform version 178.
- Live runtime now reports r170 / 170 for Admin and Student `?view=whoami` after repin to Apps Script platform version 178.

## Current Scope Boundary

- CIS scope is limited to `r170` Operations Cockpit visual rebuild using `docs/ChatGPT Image May 15, 2026, 09_19_06 PM.png` as the product reference.
- Allowed files only:
  - `AdminUI.html`
  - `CURRENT_TASK.md`
  - `Admin.js` only if absolutely required for read-only data binding
- `Config.js` may be inspected for unchanged identity confirmation only; do not modify it.
- No `appsscript.json`, `.clasp.json`, Sheets structure/manual edits, or Drive edits.
- No Zoho Books write-path changes.
- No invoice creation, email send, payment creation, bulk processing, or paid/enrolled/registration-complete updates.
- Applicant Review behavior must not regress.

## Architecture Decision

- The cockpit remains a read-only shell on the existing Admin template.
- `?view=ops` remains the cockpit entry.
- Runtime truth, queue state, applicant badges, and lifecycle indicators must reuse existing row fields and existing loaders.
- The cockpit exposes `Review` only. No new write actions are allowed in r170.
- Placeholder, `Unknown`, or `Coming next` is preferred over guessed counts.

## Completed Release Steps

- Pushed r170 source with `clasp push`.
- Verified remote `Config.js` outside the clasp source root:
  - `VERSION: "r170"`
  - `DEPLOY_VERSION_NUMBER: 170`
- Created Apps Script platform version 178:
  - `r170: operations cockpit visual rebuild`
- Repinned Admin and Student deployments to platform version 178.
- Verified Admin and Student `?view=whoami` report `r170 / 170`, `mismatch=false`.

## Browser Acceptance

- Passed for r170 platform version 178.
- Admin base URL loads and shows `r170 / 170`.
- Student portal token route loads and shows `r170`.
- Admin `?view=ops` loads the visually rebuilt Operations Cockpit.
- Cockpit remains read-only.
- No invoice, email, payment, bulk, enrolment, or classroom write actions are exposed.
- Menu links are present and usable enough for r170; section inconsistency is accepted as r171 polish.

## Next Exact Step

- Git finalization for r170:
  - Commit `AdminUI.html`, `CURRENT_TASK.md`, `Config.js`, and saved mockup image.
  - Push commit.
  - Tag `staging-as170`.
  - Push tag.

## Validation Status

- Local `node --check Admin.js` passed.
- `git diff --check` passed.
- r170 cockpit visual rebuild updated locally in `AdminUI.html`; browser acceptance passed.
- Saved mockup exists at `docs/ChatGPT Image May 15, 2026, 09_19_06 PM.png` and was inspected before the rebuild.
- Admin and Student deployments repinned to Apps Script platform version 178.
- Admin and Student whoami passed for `r170 / 170`, `mismatch=false`.
- Admin `?view=ops` HTTP payload contains the rebuilt cockpit shell labels; browser visual acceptance passed by user evidence.
- Admin base URL returned Apps Script shell content containing FODE/Admin/Document markers.
- Student `?view=portal` route returned Apps Script shell content; user browser evidence confirms token route loads and shows r170.

## r171 Follow-ups

- Tighten sidebar/menu section behavior.
- Ensure each menu item has a clear target section/state.
- Improve queue/reference applicant consistency.
- Replace safe `Unknown` values with real data where available.

## Governance Notes

- `AGENTS.md` remains authoritative for release identity, remote-source verification, browser acceptance, and rollback discipline.
- Live `whoami` is runtime truth; local source alone is not proof of live runtime.
- Rollback preference remains deployment repin first, then source revert only if needed.
