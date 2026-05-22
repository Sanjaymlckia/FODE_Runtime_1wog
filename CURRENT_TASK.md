# Current Task

## Active CIS

- `CIS r192: Remove Sticky Selected-Applicant Default Logic`.
- Baseline:
  - git commit `9ca7d4f`
  - tag `staging-as191`
  - live Admin and Student runtime should be `r191 / 191` before this release
- Target runtime identity: `r192 / 192`.
- Scope:
  - remove implicit selected-applicant defaulting from normal OPS queue operation
  - do not allow Safe Mode approved target to choose the operator working applicant
  - clear stale selected applicant when it is not in the current visible queue/search context
  - keep explicit row click / Review / search-driven selection paths intact
- Allowed edit files:
  - `AdminUI.html`
  - `Config.js`
  - `CURRENT_TASK.md`
- Explicitly out of scope:
  - no adapter/CRM routing changes
  - no Books/payment/enrolment/classroom backend changes
  - no send-gate changes
  - no bulk send activation
  - no sheet reset/archive logic

## r192 Implementation Notes

- Root cause audit:
  - no hardcoded `FODE-26-002940` was found in runtime source
  - sticky selection came from OPS queue auto-selecting the first visible row when selection was non-explicit
  - downstream panels then honored that implicit queue selection through `opsSelectedApplicantId` and detail-cache fallback
- `AdminUI.html`
  - removes normal queue auto-select behaviour
  - keeps no selected applicant on fresh load until the operator explicitly chooses a row
  - clears stale selected applicant when it is no longer in the current visible queue/search context
  - leaves explicit row click / Review / search-driven selection intact
  - keeps Safe Mode approved target as diagnostic metadata only, not as the normal working applicant

## r192 Acceptance Checklist

- Admin whoami: must report `r192 / 192`, `mismatch=false`
- Student whoami: must report `r192 / 192`, `mismatch=false`
- Fresh OPS load does not auto-select stale/historical applicant
- No panel shows `FODE-26-002940` unless the operator explicitly selected it
- Row click / Review / search result updates selected applicant across panels
- Refresh does not revert to stale applicant when it is not in current visible queue/search context
- Super Admin send actions follow the selected row only

## r191 Implementation Notes

- `AdminUI.html`
  - Adds `Email Issue / Contact Correction` as the final lifecycle band after `Exceptions / Blocked`
  - Uses existing queue/detail fields to classify bounced/suppressed/correction-needed rows
  - Shows email issue badges:
    - `Email Issue`
    - `Bounce Detected`
    - `Email Suppressed`
    - `Correction Required`
    - `Corrected Email Available`
  - Routes the lifecycle action for that stage to the existing OPS email-correction surface instead of the legacy review modal
  - Communications panel now shows suppression reason and fallback hint where email is blocked
- `Admin.js`
  - Exposes existing row fields into queue/detail payloads only:
    - `Email_Verification_Status`
    - `Last_Email_Error`
    - `Last_Email_To`
    - plus bounce/corrected-email fields for queue rendering
- Existing bounce processing remains unchanged and was not run
- Existing send gates remain unchanged

## Existing Email / Send Audit Summary

- `fd_acknowledgement`: working, backend/admin path present
- `missing documents`: weak, working send path but generic body and no template save flow
- `reminder`: working
- `portal access / legacy invite`: working
- `invoice reminder / payment_followup`: weak
- `custom email`: working
- `WhatsApp fallback`: working as CSV/export + admin email only
- `bulk / legacy campaign`: weak, backend exists but still stabilized/gated

## r191 Acceptance Checklist

- Admin whoami: must report `r191 / 191`, `mismatch=false`
- Student whoami: must report `r191 / 191`, `mismatch=false`
- Email Issue / Contact Correction appears as final lifecycle stage
- Known bounced/suppressed rows appear there when loaded
- Selecting a row there updates selected applicant context
- Lifecycle action from that stage reaches existing email correction UI
- Communications panel shows suppression/bounce reason and fallback hint
- WhatsApp fallback queue remains visible
- No scanner run, no bulk send, no sheet reset, no adapter/CRM changes

## Previous CIS

- `CIS r188: OPS Workflow UX Stabilization`.
- Target runtime identity: `r188 / 188`.
- Scope classification: UX/workflow stabilization only; no backend business logic expansion.
- Allowed edit files:
  - `AdminUI.html`
  - `Admin.js` only for minor read-only queue row/status field support
  - `Code.js` only for existing read-only exposure if needed
  - `CURRENT_TASK.md`
  - `Config.js` for release identity
- Forbidden:
  - Do not touch `FODE_Data` adapter.
  - Do not touch CRM routing, Zoho logic, fd_ack send gates, Books/payment/enrolment/classroom backend writes.
  - Do not process historical rows, change schema, create new deployments, or change canonical URLs.

## r188 Implementation Notes

- Applicant Queue is being stabilized as one lifecycle workflow surface.
- Lifecycle sections are ordered as: Application Received / FD Received; Portal Access / Portal Submitted; Documents Pending / Review; Payment Pending; Invoice / Books; Enrolment Pending; Classroom Handover; Exceptions / Blocked.
- Queue search now targets loaded lifecycle rows by `ApplicantID`, applicant/student name, email, and phone.
- Standalone sort buttons are removed from the workflow surface and replaced by clickable sortable headers.
- Selected applicant context remains the authority for Communications, Billing, Portal Diagnostics, Classroom, and selected action panels.
- Backend-missing controls are grouped under `Not Yet Available / Backend Missing` so daily operator workflow is separated from unaccepted modules.

## r188 Acceptance Checklist

- Admin whoami: pending, must report `r188 / 188`, `mismatch=false`.
- Student whoami: pending, must report `r188 / 188`, `mismatch=false`.
- Browser/manual OPS acceptance: pending.
- Queue load: pending.
- Lifecycle workflow order and newest FD intake visibility: pending.
- Search by ApplicantID/name/email/phone: pending.
- Selected context and review drawer alignment: pending.
- Sortable header behavior: pending.
- Date Applied, Aging, Last Action visibility: pending.
- Not Yet Available / Backend Missing register visible: pending.

## Accepted Baseline

- Latest deployed runtime before this task: `r184`.
- `fd_acknowledgement` message type exists from r184.
- r184 added the receipt acknowledgement body, Student Portal link, Documents still required section, and backend preview/send path.
- r185 implementation status in this working tree: accepted for manual fd_ack acknowledgement path; automatic post-commit remains gated.

## Active CIS

- `CIS r186: Narrow Automated FD Acknowledgement Send Gate`.
- Classification: approved to implement the narrow fd_ack unattended-send exception only.
- Allowed edit files:
  - `Code.js`
  - `Utils.js` only if needed for narrow gate logic
  - `Config.js` for narrow config flag and release identity
  - `CURRENT_TASK.md`
  - `Admin.js` only if diagnostic/admin wrapper adjustment is needed

## Required Business Outcome

New FD submission:

1. OPS row is created.
2. Intake lock is released after row/token/folder/verification commit.
3. Only the newly created `ApplicantID` is evaluated.
4. `fd_acknowledgement` sends automatically once if gates allow.
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
- `CONFIG.ENABLE_UNATTENDED_EMAIL_SENDS` must remain `false`.
- Narrow r186 automation may authorize only `fd_acknowledgement`, `FD_ACK_POST_COMMIT`, one `ApplicantID`, single-row post-commit scope, with duplicate guard passed.

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

- r187 / adapter-r002 implementation in progress.
- Adapter project `FODE_Data` was updated in isolated folder `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Data_adapter_audit`.
- Adapter source identity: `adapter-r002`.
- Adapter default mode: `CRM_BACKUP_LIVE`.
- Adapter canonical forwarding target remains Admin deployment `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ`.
- Adapter Apps Script platform version created: `27`.
- Existing pinned adapter deployments repinned to `@27`:
  - `AKfycbw2foU2aG1XL94EcDvNF-_BrQMmpWwdIdApMZLyYTKG6HIkWlrbLlAIVu5bnmxE4OE6`
  - `AKfycbzEplxMwBCLxZOCYJ1QyAz1eJwvghWMmd92ZwoMLeJYiaaZFA64RQhxCgoW1O3DsDoG`
- Adapter Script Property setting still requires manual confirmation if existing property remains `CRM_SHADOW`: set `ADAPTER_MODE = CRM_BACKUP_LIVE`.
- Main runtime local identity is bumped to `r187 / 187`.
- r187 `clasp push`: PASS, pushed 8 files at 7:59:58 pm.
- r187 remote source proof outside repo root: PASS from `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog_remote_verify_r187_20260521_2000`.
- r187 Apps Script platform version created: `202`.
- Admin staging deployment: repinned to `@202`.
- Student staging deployment: repinned to `@202`.
- Admin whoami after r187 repin: PASS, `r187 / 187`, `mismatch=false`.
- Student whoami after r187 repin: PASS, `r187 / 187`, `mismatch=false`.
- r187 runtime scope:
  - Add `fdReceived` / `Application Received` queue bucket for new external FD intake rows.
  - Carry adapter/CRM/fd_ack status fields into queue rows.
  - Display ack, CRM backup, portal, docs, and payment badges where loaded row data exists.
  - Fix selected applicant context so review/open paths update OPS selected panels.
- Pending r187 validation: operator FD/PS acceptance test proving adapter `CRM_BACKUP_LIVE`, CRM backup write/log result, fd_ack result, OPS `Application Received / FD Received` visibility, and selected-applicant context alignment.

- r186 implementation in progress.
- Local `Config.js` identity is bumped to `r186 / 186`.
- `ENABLE_UNATTENDED_EMAIL_SENDS` remains `false`.
- `ENABLE_AUTOMATED_FD_ACK_SENDS` is the narrow r186 authorization flag.
- `clasp push`: PASS, pushed 8 files at 12:32:08 pm.
- Remote source proof outside repo root: PASS from `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog_remote_verify_r186_20260521_1232`.
- Apps Script platform version created: `199`.
- Admin staging deployment: pinned to `@199`.
- Student staging deployment: pinned to `@199`.
- Admin whoami: PASS, `r186 / 186`, `mismatch=false`.
- Student whoami: PASS, `r186 / 186`, `mismatch=false`.
- r186 gate-metadata forwarding patch: PASS.
- Patch-forward `clasp push`: PASS, pushed 8 files at 12:58:46 pm.
- Patch-forward remote source proof outside repo root: PASS from `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog_remote_verify_r186_forwarding_20260521_1259`.
- Patch-forward Apps Script platform version created: `200`.
- Admin staging deployment: repinned to `@200`.
- Student staging deployment: repinned to `@200`.
- Admin whoami after patch-forward: PASS, `r186 / 186`, `mismatch=false`.
- Student whoami after patch-forward: PASS, `r186 / 186`, `mismatch=false`.
- External FD feed classification patch-forward `clasp push`: PASS, pushed 8 files at 1:48:09 pm.
- External FD feed classification remote source proof outside repo root: PASS from `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog_remote_verify_r186_classification_20260521_1348`.
- External FD feed classification Apps Script platform version created: `201`.
- Admin staging deployment: repinned to `@201`.
- Student staging deployment: repinned to `@201`.
- Admin whoami after external FD feed classification patch-forward: PASS, `r186 / 186`, `mismatch=false`.
- Student whoami after external FD feed classification patch-forward: PASS, `r186 / 186`, `mismatch=false`.
- Automatic post-commit fd_ack must not be classified as `AUTOMATED_WORKFLOW_ACTIVE` until all r186 acceptance tests pass.
- Pending acceptance: Admin badge check, manual regression, automatic new FD submission, duplicate rerun, and safety regression.

## r186 Patch-Forward: External FD Feed Classification + Portal Link

- Phase 1 diagnosis: PASS.
- Proven cause: `AdminUI.html` used stale `opsDummyMarker_(applicantId)` logic that marked only `FODE-26-002013` as live and all other ApplicantIDs as `Dummy / test`.
- Evidence row: `FODE-26-002938` showed external FD feed fields (`FD_FormID`, `FormID`, `adapter_forwarded = 1`, `adapter_source = sheet_bound_adapter`, `correlation_id`, `__reqId`) but no durable fd_ack result.
- Phase 2 approved files: `AdminUI.html`, `Code.js`, `CURRENT_TASK.md`, and `Config.js` only if identity/source proof requires it.
- Patch-forward implementation:
  - Admin UI marker is now row-aware: explicit test/dummy patterns remain `Dummy / test`; external FD feed rows display as `Live / external FD feed`; other rows display as `Unclassified`.
  - fd_ack email body now presents `Open Student Portal` plus a plain copy-paste fallback URL for Chrome using the existing canonical portal URL.
  - Post-commit fd_ack exception/lock-skip branches now write minimal durable `Last_Contact_*` trace as `FAILED` or `SKIPPED` using existing fields.
- Send gate status: unchanged. No global Safe Mode weakening, no `ENABLE_UNATTENDED_EMAIL_SENDS` change, no further r186 gate patch without runtime/log evidence.

## r186 Acceptance Checklist

- Runtime:
  - Admin whoami `r186 / 186`, `mismatch=false`.
  - Student whoami `r186 / 186`, `mismatch=false`.
  - Admin badge `r186 / 186`.
- Manual regression:
  - fd_ack manual send/dry-run path still works or duplicate guard blocks appropriately.
- Automatic new FD submission:
  - New `ApplicantID` appears in OPS.
  - Only that `ApplicantID` is evaluated.
  - fd_ack email sends automatically if gates allow.
  - Email is received by intended/test recipient.
  - Email includes Student Portal link.
  - Email includes Documents still required section or valid fallback.
  - Durable state records `SENT`.
  - No historical rows touched.
- Duplicate protection:
  - Same `ApplicantID` rerun sends no second email.
  - Duplicate/cooldown/prior fd_ack reason is durable.
- Safety regression:
  - `ENABLE_UNATTENDED_EMAIL_SENDS` remains `false`.
  - Other unattended message types remain blocked.
  - Stage runner/global automated sends are not enabled.
  - No broad scan occurred.

## r186 Release Discipline

- Remote source proof required before Apps Script versioning.
- Repin existing Admin and Student deployments only; do not create new deployment IDs.
- No commit or tag until all acceptance tests pass.
- If r186 fails, repin Admin and Student back to r185 platform version `198` and verify whoami `r185 / 185`.

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

## Release Closure Discipline + Follow-Up Register (Binding)

### Purpose

Protect runtime stability and prevent release drift.

### Rule

A release closes only against its approved scope and acceptance criteria.

New findings discovered during implementation, browser testing, operator testing, live acceptance, or runtime observation must be classified before affecting closure.

### Classification

`BLOCKER`

- Definition: directly prevents the approved release objective from functioning correctly.
- Examples: whoami mismatch, deployment mismatch, broken workflow, duplicate protection failure, unintended send/write, security regression, data corruption risk.
- Action: may block release closure.

`FOLLOW-UP`

- Definition: important but does not prevent the approved release objective from functioning.
- Examples: mobile-safe portal links, PNG device usability improvements, future automation, UI enhancements, reporting improvements, workflow optimization, convenience features.
- Action: must not block release closure.

### Closure Rule

- Do not silently absorb follow-up items into the current release.
- Do not expand acceptance criteria after implementation begins unless the issue is a true `BLOCKER`.
- Closure occurs against approved scope only.

## Follow-Up Register

| ID | Description | Source release | Suggested target release | Priority | Dependency | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FU-001 | Narrow automated fd_acknowledgement send gate for post-commit single ApplicantID workflow | r185 | r186 | High | narrow unattended-send exception design | In progress |
| FU-002 | Mobile-safe Student Portal links for PNG users; canonical /macros/s URL plus copy-paste fallback | r185 | r186 | High | portal link generation review | Pending |
