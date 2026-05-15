# Current Task

## Current Runtime Truth

- Live runtime: `r165 / 165`
- Admin whoami: `r165 / 165`, mismatch `false`
- Student whoami: `r165 / 165`, mismatch `false`
- Source HEAD: `537f69734f9593869d3de3fb9abb6e2cc305617a`
- HEAD commit: `release: r165 Zoho Books column readiness and OAuth preflight`
- Accepted release tag: `staging-as165`
- Local `staging-as165`: points to `537f69734f9593869d3de3fb9abb6e2cc305617a`
- Remote `origin/staging-as165`: points to `537f69734f9593869d3de3fb9abb6e2cc305617a`
- Git baseline before r166 work: clean

## Accepted Baseline

- `r165` is the accepted current baseline for Zoho Books column readiness and OAuth preflight.
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
- No runtime/source logic change is authorized by this baseline reconciliation.
- No Apps Script deployment, `clasp push`, or Apps Script version creation is authorized by this baseline reconciliation.

## Property Diagnostics Note

- Property pressure is currently unconfirmed, not disproven.
- Live runtime diagnostics observed:
  - Total Properties: `11`
  - Estimated Size: `15882`
  - `COMM_LAST` Count: `0`
  - Health: `HEALTHY | SCRIPT_PROPERTY_COUNT_GREW`
- Operational conclusion: the current active property inventory appears small and healthy relative to Apps Script quotas, but manual Script Properties persistence failure still requires controlled workaround or further diagnosis.

## Next Exact Step

- Start a new CIS for `r166` only after this baseline remains clean.
- Intended `r166` work: temporary Super Admin-only Zoho Books secret setter, OAuth/token verification, read-only Books discovery, and Item.csv reconciliation.
- Keep all Books write flags disabled during `r166` unless a later CIS explicitly authorizes writes.
- Do not touch CRM files or CRM trigger/source logic for the FODE billing path.

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
