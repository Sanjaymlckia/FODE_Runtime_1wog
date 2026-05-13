# Current Task

## Current Runtime Truth

- Live runtime: `r153 / 153`
- Admin whoami: `r153 / 153`, mismatch `false`
- Student whoami: `r153 / 153`, mismatch `false`
- VERSION: `r153`
- DEPLOY_VERSION_NUMBER: `153`
- Current accepted tag: `staging-as153`
- Git status: clean
- No pending deployment
- Current live feature set:
  - queue aging
  - Received/Age/SLA indicators in the admin queue UI
  - safe write-once `Handled_By` and `Handled_At`
- Deferred fields stay deferred:
  - `Enrolled_By`
  - `Enrolled_At`

## Accepted Release State

- `r150`: deployed and accepted baseline for the S5C workstream; later superseded.
- `r151`: deployed but rejected at browser acceptance because the S5C email UI reported `Email sent to 0 admin recipient(s): `.
- `r152`: deployed and accepted after fixing the email recipient payload handling.
- `r152` confirmation: admin email delivery was found in Gmail All Mail; inbox absence was a routing/classification outcome, not a runtime failure.
- `r153`: deployed and accepted current release; queue aging and safe handled ownership are live.

## Active Deferred Work

- VCF production test remains parked until business WhatsApp phone access is available.
- Admin identity rationalisation remains deferred as a separate task.
- Future enrolment transition hook for `Enrolled_By` / `Enrolled_At` remains deferred.
- Books-native architecture work remains later-phase work and is not part of the current release.

## Known Governance Notes

- `r152` S5C email observability is retained: the admin CSV email path now reports recipient count, recipient list, recipient source, and send result.
- `r153` queue aging is deployed and current.
- The write-once handled attribution path is intentional; do not convert it into a repeated-write path.
- Historical handoff blocks referencing `r148`, `r149`, or `r150` as current runtime are stale and no longer authoritative.
- `staging-as153` is the current accepted tag for the live runtime state.

## Resume Instructions

- Resume from `r153 / 153` and trust this file as the current authority.
- Start with the VCF production test if phone access is available.
- Otherwise continue with admin identity rationalisation, then the future enrolment transition hook.
- Keep `Enrolled_By` / `Enrolled_At` deferred until a future CIS explicitly authorizes the transition hook.
- Do not reopen the resolved S5C email UI issue unless a regression appears.
- Do not rely on stale historical handoff blocks for current runtime truth.

## PASS 1 Operational Hardening In Progress

- Target release candidate: `r154 / 154`.
- Scope: operational dashboard, email observability, WhatsApp fallback visibility, duplicate intake protection, trigger/runtime telemetry, and pipeline counts.
- Files in scope: `AdminUI.html`, `Admin.js`, `Code.js`, `Utils.js`, `Config.js`, `CURRENT_TASK.md`.
- Current accepted runtime remains `r153 / 153` until release acceptance completes.
- Local validation: `node --check` passed for `Admin.js`, `Code.js`, `Utils.js`, and `Config.js`; `git diff --check` passed via preflight.
- Release blocked before Apps Script version creation: `clasp push` and `clasp push -f` both failed with `ENOENT: no such file or directory, scandir ''`.
- Do not proceed to `clasp version`, deployment repin, browser acceptance, git commit, tag, or push until the clasp rootDir blocker is explicitly resolved.
