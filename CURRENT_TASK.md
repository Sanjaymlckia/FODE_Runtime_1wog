# Current Task

## Accepted Baseline

- Latest deployed runtime before this task: `r184`.
- `fd_acknowledgement` message type exists from r184.
- r184 added the receipt acknowledgement body, Student Portal link, Documents still required section, and backend preview/send path.
- r185 implementation status in this working tree: accepted for manual fd_ack acknowledgement path; automatic post-commit remains gated.

## Active CIS

- `CIS r185: post-commit single-ApplicantID fd_acknowledgement automation`.
- Classification: approved to implement based on design pass, with duplicate durable-state correction.
- Allowed edit files:
  - `Code.js`
  - `Admin.js`
  - `CURRENT_TASK.md`
  - `Config.js` only for r185 / 185 release bump when release execution begins

## Required Business Outcome

New FD submission:

1. OPS row is created.
2. Intake lock is released after row/token/folder/verification commit.
3. Only the newly created `ApplicantID` is evaluated.
4. `fd_acknowledgement` sends once if gates allow.
5. If gates block, durable block evidence is recorded.
6. Duplicate rerun does not send again.
7. Intake success response remains independent of acknowledgement email success.

## Mandatory Constraints

- Normal automatic path evaluates only the newly created `ApplicantID`.
- No full-sheet scan by default.
- No email send inside the locked intake mutation section.
- Intake success response must not depend on email send success.
- Use internal server-side actor only; no client-callable system actor bypass.
- Admin wrapper remains admin-checked.
- Historical/backfill mode remains disabled unless explicitly invoked with dry-run and Super Admin confirmation.
- No schema change.
- No trigger or broad autonomous runner activation.
- No broad UI rewrite.
- Safe Mode and production gates remain active.

## Duplicate / Blocked Durable Mapping

- For duplicate `fd_acknowledgement`, do not set `Email_Status = SUPPRESSED`.
- Preferred duplicate durable state:
  - `Last_Contact_Type = fd_acknowledgement`
  - `Last_Contact_Result = DUPLICATE`
  - `Last_Contact_Batch = r185 fd_ack run/debug label`
  - `Last_Contact_DebugId = correlation/debug id`
  - `Last_Contact_Subject = Duplicate fd_acknowledgement suppressed`
- Leave `Email_Status` unchanged for `DUPLICATE`, `BLOCKED`, and `SKIPPED` unless a safe message-type-specific convention is proven.

## r185 Accepted Status

- Runtime r185 / 185 deployed and whoami passed.
- Admin staging deployment: pinned to `@198`.
- Student staging deployment: pinned to `@198`.
- Admin whoami: PASS, `r185 / 185`, `mismatch=false`.
- Student whoami: PASS, `r185 / 185`, `mismatch=false`.
- Manual fd_ack live send for `FODE-26-002935`: PASS.
- Email receipt confirmed at `sanjay@kundu.ac`.
- Duplicate rerun: PASS, blocked with `COOLDOWN_ACTIVE`.
- Manual fd_ack classification: `MANUAL_PREVIEW_SEND_WORKS`.
- Automatic post-commit fd_ack classification: `BACKEND_EXISTS_BUT_GATED`, blocked by unattended-send policy.
- Do not classify r185 as `AUTOMATED_WORKFLOW_ACTIVE`.

## Current Stop State

- Local `Config.js` identity is bumped to `r185 / 185`.
- `clasp push`: PASS.
- Remote source proof outside repo root: PASS from `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog_remote_verify_r185_20260521_1052`.
- Apps Script platform version created: `196`.
- r185 confirmation wrapper patch-forward platform version created: `197`.
- r185 manual fd_ack routing patch-forward platform version created: `198`.
- Admin staging deployment: pinned to `@198`.
- Student staging deployment: pinned to `@198`.
- Admin whoami: PASS, `r185 / 185`, `mismatch=false`.
- Student whoami: PASS, `r185 / 185`, `mismatch=false`.
- Live fd_ack wrapper now accepts `confirmManualSingleSend: true` with `confirmApplicantId` matching the single `ApplicantID`.
- Manual fd_ack acceptance route now classifies confirmed Admin/Ops single-row sends as `manualSingleSendProbe: true`, `unattended: false`, `sendSource: FD_ACK_MANUAL_SINGLE`.
- Automatic post-commit fd_ack remains `BACKEND_EXISTS_BUT_GATED`; it still uses unattended-send policy and requires a separate approved narrow send-gate CIS before `AUTOMATED_WORKFLOW_ACTIVE`.
- r185 finalization allowed after recording this status and staging only `Config.js`, `Code.js`, `Admin.js`, and `CURRENT_TASK.md`.

## Next Release Notes

### r186 Candidate: narrow automated fd_ack send gate

- Goal: when a new FD submission updates OPS with a new `ApplicantID`, fd_ack acknowledgement is automatically evaluated and sent or blocked with durable reason.
- Must not enable global unattended sends.
- Must allow only `fd_acknowledgement` post-commit, single `ApplicantID`.
- User will test this with a new FD submission.

### Mobile-safe Student Portal link improvement

- Email portal link did not work cleanly in user's phone environment.
- Investigate canonical `/macros/s/` Student URL generation.
- Avoid `/a/macros/` account-scoped links.
- Add clean `Open Student Portal` link plus plain copy-paste fallback URL.
- Ensure link works for PNG mobile users without admin Google accounts.

### Out of scope for r185 finalization

- Keep other backend-missing items out of r185 finalization.
