CIS only. No discussion edits.
Modify only files explicitly allowed in current CIS.
Prefer upstream normalization over repeated null checks.
Do not add defensive branching unless a concrete failure mode exists.
Live `whoami` is runtime truth.
Local source is not proof of live runtime.
Hot paths must avoid repeated sheet scans, repeated resolver calls, redundant guards.
Every release requires exact acceptance URLs and PASS/FAIL checks.
Release incomplete until Admin whoami, Student whoami, and browser checks pass.
When unsure, stop and surface uncertainty instead of guessing.
Rollback prefers deployment repin first.
Release closure follows `docs/governance/RELEASE_CLOSURE_DISCIPLINE.md`: close only against approved scope, classify new findings as BLOCKER or FOLLOW-UP, and record follow-ups without expanding the current release unless they are true blockers.

## Release Track Classification

Every future CIS must explicitly declare exactly one release track before implementation or release work begins:

- `Track L` - light UI/documentation work, including documentation-only process hardening. Use only when the CIS does not change backend behavior, data mutation authority, send logic, portal security, payment/Books/classroom logic, schema, Script Properties, or deployment architecture.
  - Requires the CIS-defined allowed files, scoped diff checks, required runtime identity/deployment proof if a runtime release is performed, and acceptance evidence tied to the changed surface.
  - Codex browser visual capture is not mandatory. Rendered HTML, screenshots, operator-supplied browser evidence, or other CIS-approved visual/source evidence may satisfy acceptance when recorded as PASS/FAIL.
  - Track L does not waive Admin/Student `whoami` checks for a runtime deployment and does not authorize dangerous actions during acceptance.
- `Track H` - high-risk or behavior-changing release. Required for backend changes; send/write execution logic; authorization or supervisory gates; portal/security/token logic; Books/payment/classroom mutations; schema or Script Properties; or any change with material live-data risk.
  - Requires full release identity, remote-source, deployment repin, Admin/Student `whoami`, browser acceptance, safety, rollback, and closure discipline specified by the CIS and this repository.
  - Acceptance must exercise only approved read-only or explicitly authorized actions; dangerous actions remain prohibited unless the CIS separately approves the exact action.

Documentation-only process hardening is `Track L` and must additionally state `No runtime release`. It must not use an `rNNN` runtime identity, `clasp push`, Apps Script version, deployment repin, or staging tag unless separately authorized later.

Release Identity Gate:
- Before any `clasp version` command, `Config.js` `VERSION` must already equal the intended release label, for example `r155`.
- Before any `clasp version` command, `Config.js` `DEPLOY_VERSION_NUMBER` must already equal the intended release number, for example `155`.
- `VERSION` must exactly equal `"r" + DEPLOY_VERSION_NUMBER`.
- Run `Select-String -Path Config.js -Pattern "VERSION|DEPLOY_VERSION_NUMBER"` and paste the result into the release summary before running `clasp version`.
- If `Config.js` identity is not bumped, STOP. Do not run `clasp version`.
- After repin, live `whoami` must match the intended `Config.js` identity.
- Apps Script platform version may differ from `DEPLOY_VERSION_NUMBER` only if live `whoami` reports the intended `rNNN / NNN` identity; record the platform version separately.
- If `whoami` after repin shows the previous release label, treat release as failed identity gate. Do not browser-accept, commit, or tag. Correct `Config.js` identity, create a new Apps Script version, and repin again.

## Apps Script Release Identity Invariant

Absolute rule:
No Apps Script version may be created until the remote Apps Script source is independently verified to contain the intended `Config.js` `VERSION` and `DEPLOY_VERSION_NUMBER`.

Required order:
1. Update local `Config.js`.
2. Confirm local `VERSION` and `DEPLOY_VERSION_NUMBER`.
3. Run `git diff -- Config.js`.
4. Run `clasp push`.
5. If `clasp push` says `Skipping push` while `Config.js` changed, STOP.
6. Never run `clasp pull` into this repo or any child folder of this repo.
7. Remote verification pull must be outside the clasp source root.
8. Verify pulled remote `Config.js` equals intended local `VERSION` and `DEPLOY_VERSION_NUMBER`.
9. Only then run `clasp version`.
10. After version and deployment repin, verify Admin and Student `whoami`.
11. If `whoami` does not match intended runtime, release fails.

Contaminated version rule:
If an Apps Script version is created from stale remote `Config.js`, that version is contaminated and must not be accepted or tagged. Patch forward with a new version only after the remote-source gate passes.

Forbidden release shortcuts:
- Do not trust local `Config.js` alone.
- Do not trust `clasp push` if it says `Skipping push` while `Config.js` changed.
- Do not trust deployment repin without `whoami`.
- Do not run browser acceptance before `whoami` passes.

## Browser Acceptance Discipline

Codex may use the Chrome extension only for narrow authenticated browser acceptance checks when explicitly instructed.

Rules:
- Browser acceptance must be read-only unless a separate CIS authorizes action.
- Codex must not edit code while browser-testing.
- Codex must not deploy while browser-testing.
- Codex must not send live emails unless the user explicitly approves the exact recipient and message type.
- Browser checks must report PASS/FAIL and visible evidence only.
- If Codex cannot operate the authenticated browser reliably, it must stop and request manual user evidence instead of retrying repeatedly.
- Manual user screenshots or console output are valid acceptance evidence.

## Validation Levels and Playwright Usage

Playwright is not part of the default validation pipeline for refactor-only F4/F5 slices.

Level 1 - Refactor/default:
- `node --check` for relevant runtime files.
- targeted Node regression tests.
- `git diff --check`.
- audit/report artifact where required.
- commit/push when the CIS authorizes closure.
- no Playwright.
- no Apps Script push, deployment, version, or repin.

Level 2 - Feature/UI:
- all Level 1 checks.
- manual browser inspection when visible UI intentionally changed.
- Playwright only when browser proof is specifically needed or requested.

Level 3 - Release:
- release preflight.
- `clasp push`, Apps Script version, and Admin staging repin only when authorized by the release CIS.
- Admin/Student `whoami` proof as required by release discipline.
- manual/operator acceptance.
- Playwright only when explicitly requested by the release CIS or when a suspected browser-only regression cannot be proven by Node tests.

Rules:
- Do not run Playwright by default.
- Do not spend time recovering failed Playwright unless browser proof is mandatory.
- If Playwright is not required, record: `Playwright not required for this refactor.`
- Preserve prior Playwright reports as historical evidence.

## Non-Repo Clone / Sandbox Boundary Rule

The authoritative FODE Runtime repo is:

D:\Repos\FODE_Runtime_1wog

The old Google Drive synced copy at `E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog` is archive/reference only. Do not treat it as active source authority.

GitHub remains the review authority for committed work.

No Apps Script push, version creation, deployment repin, or release action may be performed from the D: clone until `.clasp.json`, `Config.js`, and the intended Apps Script project authority are verified from the D: clone in the active CIS.

Do not create temp repos, remote verification clones, or non-repo source copies outside this path unless explicitly authorized by the operator.

Forbidden unless explicitly approved:
- clasp clone into C:\Users\sanja\.codex\memories
- git clone into temp folders
- Copy-Item source trees outside the repo
- creating verification folders outside the authoritative repo
- using non-repo source copies as release truth

Remote source proof must prefer controlled/manual verification or a non-cloning method.

If a command proposes work outside the authoritative repo, stop and ask the operator with a clear explanation of:
1. exact target path
2. why it is needed
3. whether it creates a second source copy
4. safer alternative
