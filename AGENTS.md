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
