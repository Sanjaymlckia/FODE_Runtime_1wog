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
