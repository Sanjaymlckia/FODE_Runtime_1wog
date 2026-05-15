# Current Task

## Current Runtime Truth

- Live runtime: `r166 / 166`
- Admin whoami: `r166 / 166`, mismatch `false`
- Student whoami: `r166 / 166`, mismatch `false`
- Source baseline before uncommitted r166 work: `a803e04b76a2b501d39d2cdf09c60367487e2c35`
- Accepted release tag remains: `staging-as165`
- Local `staging-as165`: points to `537f69734f9593869d3de3fb9abb6e2cc305617a`
- Remote `origin/staging-as165`: points to `537f69734f9593869d3de3fb9abb6e2cc305617a`
- r166 Apps Script platform version: `166`
- Canonical Admin deployment: repinned to `@166`
- Canonical Student deployment: repinned to `@166`
- Git state: r166 source changes are uncommitted until browser acceptance passes.

## Accepted Baseline

- `r165` remains the last committed/tagged accepted baseline for Zoho Books column readiness and OAuth preflight.
- Browser acceptance for `r165` passed for column readiness and safe OAuth preflight.
- Runtime badge showed `r165 / 165`.
- Zoho Books dry-run panel was visible.
- Preflight reported `Columns: COLUMN_READY`.
- Preflight reported `Token: PREAUTH_REQUIRED`.
- Item catalog/live discovery remained blocked by `PREAUTH_REQUIRED`.
- `Create Draft Invoice` remained blocked by config flags.
- No Books contact, invoice, payment, or invoice email was created.

## Current Scope Boundary

- Books mode remains preflight/read-only only.
- Books write flags remain disabled.
- No auto-send, no payment recording, no bulk posting, and no live Books writes are authorized.
- CRM remains excluded from the FODE billing trigger path.
- r166 CIS scope is limited to Zoho Books OAuth verification, read-only Books discovery, Item.csv reconciliation, and post-acceptance hardening of the temporary setup path.
- `ENABLE_ZOHO_BOOKS_SECRET_SETUP` is now `false` after successful secret capture and preflight verification.

## Property Diagnostics Note

- Property pressure is currently unconfirmed, not disproven.
- Live runtime diagnostics observed:
  - Total Properties: `11`
  - Estimated Size: `15882`
  - `COMM_LAST` Count: `0`
  - Health: `HEALTHY | SCRIPT_PROPERTY_COUNT_GREW`
- Operational conclusion: the current active property inventory appears small and healthy relative to Apps Script quotas, but manual Script Properties persistence failure still requires controlled workaround or further diagnosis.

## Next Exact Step

- Browser acceptance is pending because Codex could not operate the authenticated browser in this session and secrets must not be pasted into chat.
- Zoho Books Script Properties are now saved and must be retained as permanent runtime secrets for read-only preflight/preview.
- Temporary Zoho Books secret setup UI/setter must remain disabled.
- Run Zoho Books Preflight and require `Columns: COLUMN_READY` and `Token: TOKEN_READY`.
- If `TOKEN_READY`, run read-only discovery for contact custom fields, invoice custom fields, items, and accounts.
- Compare live Books items against `docs/Zoho_Books/Item.csv` and record `ITEM_CATALOG_MATCH` or mismatch details.
- Run Preview Books Payload for `FODE-26-002920` and record payer, student, line items, calculated amount, source amount, amount mismatch, FODE reference, idempotency status, and readiness/block reason.
- Confirm `Create Draft Invoice` remains disabled / `WRITE_DISABLED`.
- Keep all Books write flags disabled during `r166` unless a later CIS explicitly authorizes writes.
- Do not touch CRM files or CRM trigger/source logic for the FODE billing path.
- Do not commit, tag, or push the r166 source until browser acceptance passes.
- If browser acceptance cannot be completed, rollback preference is repin Admin and Student deployments to `@165`, then verify `whoami r165 / 165`.

## r166 Implementation State

- `Config.js` identity is `r166 / 166`.
- `ENABLE_ZOHO_BOOKS_INTEGRATION = false`.
- `ENABLE_ZOHO_BOOKS_DRY_RUN = true`.
- `ENABLE_ZOHO_BOOKS_DRAFT_INVOICE_CREATE = false`.
- `ENABLE_ZOHO_BOOKS_SECRET_SETUP = false`.
- Added temporary backend entrypoint: `admin_setZohoBooksOAuthProperties(payload)`.
- Setter accepts only:
  - `ZOHO_BOOKS_CLIENT_ID`
  - `ZOHO_BOOKS_CLIENT_SECRET`
  - `ZOHO_BOOKS_REFRESH_TOKEN`
  - `ZOHO_BOOKS_ACCOUNTS_URL`
  - `ZOHO_BOOKS_API_DOMAIN`
  - `ZOHO_BOOKS_ORGANIZATION_ID`
- Setter rejects all other keys and ignored wrapper fields.
- Setter is guarded by existing Admin authentication, Super Admin role, and `ENABLE_ZOHO_BOOKS_SECRET_SETUP`.
- Setter returns only saved key names, value lengths, and safe token readiness status.
- Admin UI setup panel is server-rendered only when `IS_SUPER` and `ENABLE_ZOHO_BOOKS_SECRET_SETUP` are true; with the flag now false it is hidden.
- Stored `ZOHO_BOOKS_*` Script Properties remain in place and must not be deleted by this CIS.
- Browser plugin control was unavailable; `clasp run admin_preflightZohoBooks` remains permission-blocked.

## Deferred Work

- VCF production test remains parked until business WhatsApp phone access is available.
- Admin identity rationalisation remains deferred as a separate task.
- Future enrolment transition hook for `Enrolled_By` / `Enrolled_At` remains deferred.
- Batch feedback/custom email remains deferred. Any later CIS must include preview count, explicit confirmation, per-applicant result logging, daily cap handling, and no automatic sending.
- AI-assisted document quality scan remains deferred. If added later, it must be advisory only and must not auto-reject, auto-send, or override Admin review.

## Known Governance Notes

- `AGENTS.md` governs release identity, remote-source verification, browser acceptance, and rollback discipline.
- Live `whoami` is runtime truth; local source alone is not proof of live runtime.
- Every release requires Admin whoami, Student whoami, and browser checks before acceptance.
- Browser acceptance via Chrome extension is allowed only as narrow read-only acceptance evidence unless a separate CIS authorizes action.
- Rollback preference remains deployment repin first, then source revert only if needed.
- For `Application Feedback` and `Custom Email`, the old top `Preview` / `Send` buttons remain confusing; a future CIS should hide or disable them or clearly direct staff to the editable panel buttons.
