# Current Task

## Current Runtime Truth

- Intended release in progress: `r169 / 169`
- Local source is uncommitted r169 work for a read-only Operations Cockpit shell.
- Live runtime must not be treated as r169 until Admin and Student `?view=whoami` both pass after repin.

## Current Scope Boundary

- CIS scope is limited to `r169` read-only Operations Cockpit shell.
- Allowed files only:
  - `Config.js`
  - `Admin.js`
  - `AdminUI.html`
  - `Utils.js` only if needed for shared status helpers
  - `CURRENT_TASK.md`
- No `appsscript.json`, `.clasp.json`, Sheets structure/manual edits, or Drive edits.
- No Zoho Books write-path changes.
- No invoice creation, email send, payment creation, bulk processing, or paid/enrolled/registration-complete updates.
- Applicant Review behavior must not regress.

## Architecture Decision

- The new cockpit is a read-only shell on the existing Admin template.
- `?view=ops` is the intended cockpit entry.
- Runtime truth, queue state, applicant badges, and lifecycle indicators must reuse existing row fields and existing loaders.
- The cockpit exposes `Review` only. No new write actions are allowed in r169.
- Placeholder or `Unknown` is preferred over guessed counts.

## Next Exact Step

- Push r169 source and verify remote `Config.js` is `r169 / 169` before `clasp version`.
- Create Apps Script version:
  - `r169: read-only operations cockpit shell`
- Repin Admin and Student.
- Verify Admin and Student `?view=whoami` report `r169 / 169`, `mismatch=false`.
- Browser acceptance:
  - Admin normal view still loads
  - `?view=ops` loads
  - cockpit remains read-only
  - `FODE-26-002929` shows invoice raised state if row fields exist
  - queue rows show invoice/payment/enrolled/classroom badges
- Do not commit, tag, or push git metadata until browser acceptance passes.

## Validation Status

- Local `node --check Admin.js` passed.
- Local `node --check Utils.js` passed.
- `git diff --check` passed.

## Governance Notes

- `AGENTS.md` remains authoritative for release identity, remote-source verification, browser acceptance, and rollback discipline.
- Live `whoami` is runtime truth; local source alone is not proof of live runtime.
- Rollback preference remains deployment repin first, then source revert only if needed.
