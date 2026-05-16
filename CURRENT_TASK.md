# Current Task

## Active CIS

- Release target: `r172 / 172`
- Objective: Operations Cockpit controlled live actions and operational workflow maturity.
- Accepted baseline: `r171 / 171`
- Baseline commit: `bd2e99442db5a7a88249072f5e765888dc294ab9`
- Baseline tag: `staging-as171`

## Required State Classification

1. Live runtime truth:
   - Admin `?view=whoami`: `r172 / 172`, `mismatch=false`
   - Student `?view=whoami`: `r172 / 172`, `mismatch=false`
2. Apps Script deployment truth:
   - Admin deployment pinned to platform version `180`
   - Student deployment pinned to platform version `180`
3. Local `Config.js` truth:
   - Finalized local target: `r172 / 172`
4. Remote `Config.js` truth:
   - `REMOTE VERSION: r172`
   - `REMOTE DEPLOY_VERSION_NUMBER: 172`
5. Git truth before finalization:
   - HEAD currently at accepted `r171` baseline plus r172 release edits
   - Latest accepted tag before finalization: `staging-as171`
6. Dirty-state classification before finalization:
   - `unfinalized deployed release`
   - Not a failed release.
   - Not unrelated drift.

## Current Source State

- `Config.js` target identity:
  - `VERSION: "r172"`
  - `DEPLOY_VERSION_NUMBER: 172`
- `AdminUI.html` now matures the r171 cockpit without redesigning it:
  - FODE Operations branding replaces CodexHub-dominant product branding.
  - Refresh Snapshot is live and read-only.
  - Admissions queue filtering is local/read-only.
  - Communications section has single-applicant preview/send controls with preview and confirmation gates.
  - Zoho Books has read-only invoice open/status controls only.
  - Classroom Handover has internal-only handover preview and classroom admin notification.
  - Reports open read-only in-page report panels; export/schedule remain disabled.
  - Release Control shows guidance only and does not invoke git, clasp, deployment, or rollback commands.
- `Admin.js` adds internal-only classroom handover preview/notification helpers.

## Safety Boundary

- No `Code.js` changes.
- No `Utils.js` changes.
- No `appsscript.json` or `.clasp.json` changes.
- No sheet schema changes.
- No Drive structure changes.
- No hidden automation changes.
- Bulk operations remain disabled.
- Payment recording remains disabled.
- Mark paid/enrolled/registration-complete remains disabled.
- Classroom completion/write-back remains disabled.
- Invoice creation, invoice send, and payment recording from cockpit remain disabled.

## Validation Completed Locally

- `node --check Config.js` passed.
- `node --check Admin.js` passed.
- `git diff --check` passed.
- Changed files at this checkpoint:
  - `Config.js`
  - `AdminUI.html`
  - `Admin.js`
  - `CURRENT_TASK.md`

## Browser Acceptance Result

- Manual browser acceptance passed using the dedicated FODE acceptance Chrome profile.
- Accepted evidence:
  - Admin base route loads correctly.
  - Admin `?view=ops` loads correctly.
  - Runtime shows `r172 / 172`.
  - Admissions Queue Review functionality is reachable.
  - Student portal functionality is reachable.
  - Communications workflows are reachable where mapped.
  - WhatsApp functionality is visible/reachable where mapped.
  - Zoho Books status/actions are reachable where mapped.
  - No bulk actions are enabled.
  - No payment recording is enabled.
  - No mark-paid/enrolled/completed actions are enabled.
  - Student portal still works normally.

## Deployment Status

- Source pushed with `clasp push`.
- Remote `Config.js` was verified outside the clasp source root:
  - `REMOTE VERSION: r172`
  - `REMOTE DEPLOY_VERSION_NUMBER: 172`
- Apps Script platform version created:
  - `180`
  - `r172: operations cockpit controlled live actions`
- Admin deployment repinned to platform version `180`.
- Student deployment repinned to platform version `180`.
- Admin `?view=whoami` passed:
  - `r172`
  - `deployVersion 172`
  - `mismatch=false`
- Student `?view=whoami` passed:
  - `r172`
  - `deployVersion 172`
  - `mismatch=false`
- Read-only HTTP payload checks passed for:
  - Admin base route
  - Student portal route
  - Admin `?view=ops` payload includes r172 controlled-action labels
- Browser acceptance passed.
- `r172` is accepted as the controlled live-actions baseline.

## Accepted Gaps

- Some Ops sections still require deeper operational parity mapping from legacy Admin.
- Some buttons/routes remain partially populated and will continue maturing in future releases.

## Future Enhancements

- Continue expanding Ops parity against the legacy Admin surface in later controlled releases.
- Mature partially populated buttons/routes only under future CIS-controlled work.

## Deferred Work

- Post-acceptance git finalization:
  - `git add Config.js AdminUI.html Admin.js CURRENT_TASK.md`
  - `git commit -m "release: r172 operations cockpit controlled live actions"`
  - `git push`
  - `git tag staging-as172`
  - `git push origin staging-as172`
  - `git status -sb`

## Rollback

- Repin Admin and Student deployments to the accepted `r171 / 171` runtime first.
- Verify Admin and Student `?view=whoami`.
- Revert source only if needed after deployment rollback.
