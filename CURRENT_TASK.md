# Current Task

## Active CIS

- Release target: `r171 / 171`
- Objective: Operations Cockpit full submenu mockup implementation.
- Baseline: `r170 / 170` accepted and finalized at commit `85b6708`, tag `staging-as170`.
- Admin `?view=ops` must remain a read-only cockpit prototype.

## Current Source State

- `Config.js` has been bumped locally to:
  - `VERSION: "r171"`
  - `DEPLOY_VERSION_NUMBER: 171`
- `AdminUI.html` now gives every left sidebar item a distinct mockup section:
  - Dashboard
  - Runtime Truth
  - Admissions Queue
  - Zoho Books
  - Communications
  - Classroom Handover
  - Reports
  - Release Control
  - Rules & Config
- `Admin.js` has not been changed for this CIS.

## Safety Boundary

- No `Code.js` changes.
- No `Utils.js` changes.
- No `appsscript.json` or `.clasp.json` changes.
- No invoice creation, invoice send, payment recording, bulk processing, email sending, enrolment writes, classroom writes, or Zoho Books write enablement from the cockpit.
- Future action buttons in the cockpit must remain disabled/prototype-only.

## Validation Completed Locally

- `node --check Config.js` passed.
- `git diff --check` passed.
- Changed files at this checkpoint:
  - `Config.js`
  - `AdminUI.html`
  - `CURRENT_TASK.md`

## Release Finalization

- Browser acceptance has been accepted from operator evidence.
- Finalization commands authorized:
  - `git add Config.js AdminUI.html CURRENT_TASK.md`
  - `git commit -m "release: r171 operations cockpit submenu prototype"`
  - `git push`
  - `git tag staging-as171`
  - `git push origin staging-as171`

## Deployment Status

- Source pushed with `clasp push`.
- Remote `Config.js` was verified outside the clasp source root:
  - `REMOTE VERSION: r171`
  - `REMOTE DEPLOY_VERSION_NUMBER: 171`
- Apps Script platform version created:
  - `179`
  - `r171: operations cockpit submenu prototype`
- Admin deployment repinned to platform version `179`.
- Student deployment repinned to platform version `179`.
- Admin `?view=whoami` passed:
  - `r171`
  - `deployVersion 171`
  - `mismatch=false`
- Student `?view=whoami` passed:
  - `r171`
  - `deployVersion 171`
  - `mismatch=false`
- Read-only HTTP payload checks passed for:
  - Admin base route
  - Student portal route
  - Admin `?view=ops` payload includes r171 cockpit labels and disabled prototype action labels
- Browser acceptance accepted by operator evidence:
  - Admin `?view=ops` loads distinct Dashboard, Runtime Truth, Admissions Queue, Zoho Books, Communications, Classroom Handover, Reports, Release Control, and Rules & Config sections.
  - Future operational controls are visible but prototype/read-only.
  - No live write actions were added.
  - Admin base route remains intact.
  - Student portal route remains intact.
- Git finalization authorized.

## Browser Acceptance Target

- URL: `https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec?view=ops`
- PASS requires every sidebar item to show a distinct section and all unsafe actions to remain disabled/prototype-only.

## Rollback

- Repin Admin and Student deployments to the accepted `r170 / 170` Apps Script version.
- Verify Admin and Student `?view=whoami`.
- Revert source only if needed after deployment rollback.
