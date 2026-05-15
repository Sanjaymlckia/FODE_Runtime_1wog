# Current Task

## Current Runtime Truth

- Live runtime before this continuation: `r168 / 168`
- Admin and Student are currently pinned to an earlier r168 platform version created before the latest fallback/test-email changes.
- Current local source is uncommitted r168 work for Zoho Books item catalog refresh, fallback line logic, and controlled test invoice/email.

## Current Scope Boundary

- CIS scope is limited to `r168` Zoho Books UI finalization after draft invoice raise.
- Allowed files only:
  - `Config.js`
  - `Utils.js`
  - `Admin.js`
  - `AdminUI.html`
  - `CURRENT_TASK.md`
- No `appsscript.json`, `.clasp.json`, Sheets structure/manual edits, or Drive edits.
- `docs/Zoho_Books` files may be read as reference only.
- No payment creation, no bulk Books processing, no auto paid/enrolled updates, and no CRM changes.
- Invoice sending remains disabled except the controlled forced-recipient test email path.
- No new invoice may be created for `FODE-26-002929`; UI must present invoice-raised state and duplicate block clearly.

## Architecture Decision

- FODE invoices are multi-line invoices.
- Include `Registration FODE (No Tablet)` once by default.
- Exclude tablet/full registration unless a separate explicit rule is approved later.
- Each selected FDxx subject must become one Zoho Books invoice line item.
- Use the refreshed catalog in `docs/Zoho_Books` as the current reference for deterministic grade-specific mapping.
- Source/payment amount is comparison-only unless explicitly configured authoritative.
- If an exact subject item is missing and a configured generic fallback subject-fee item exists, preview may return `READY_WITH_FALLBACK`.
- If no exact item and no configured fallback item exist, preview must return `BLOCKED_ITEM_MAPPING`.

## Next Exact Step

- r168 browser acceptance passed on Apps Script platform version `174`.
- Finalize git commit, push, and tag for `staging-as168`.
- r169 follow-up:
  - suppress/disable Legacy Invite and Send controls when `Can Send Now = NO`
  - suppress/de-emphasize applicant-chasing send controls when applicant is already portal-submitted, enrolled, or complete

## Validation Status

- r168 lifecycle/status hydration browser acceptance passed.
- Persistent invoice-email sent tracking is still not backed by a dedicated stored field; UI currently shows `UNKNOWN` unless a sent status is known in-session.

## Governance Notes

- `AGENTS.md` remains authoritative for release identity, remote-source verification, browser acceptance, and rollback discipline.
- Live `whoami` is runtime truth; local source alone is not proof of live runtime.
- Rollback preference remains deployment repin first, then source revert only if needed.
