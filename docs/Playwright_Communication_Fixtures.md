# Playwright Communication Authority Fixtures

## Purpose

This fixture set is the canonical read-only regression dataset for Admin communication authority checks. It exists to prove that template recommendation, preview availability, blocked reasons, and lifecycle gates remain aligned after communication or lifecycle changes.

The Playwright smoke must not send email, send WhatsApp, verify payments, change document status, or mutate Sheets/Drive.

## Fixture Environment Variables

| Fixture | Environment variable | Required lifecycle state | Expected authority |
| --- | --- | --- | --- |
| COMM-A | `FODE_COMM_AUTHORITY_APPLICANT_A` | Application received; documents pending | `docs_missing` available. Payment and acceptance templates blocked. |
| COMM-B | `FODE_COMM_AUTHORITY_APPLICANT_B` | Documents verified; payment outstanding | Verified quote/payment guidance and payment follow-up available. Acceptance blocked until payment authority is satisfied. |
| COMM-C | `FODE_COMM_AUTHORITY_APPLICANT_C` | Payment evidence uploaded; awaiting verification | Receipt request and acceptance remain blocked until payment verification is complete. |
| COMM-D | `FODE_COMM_AUTHORITY_APPLICANT_D` | Payment verified | Acceptance confirmation available. Payment follow-up blocked. |
| COMM-E | `FODE_COMM_AUTHORITY_APPLICANT_E` | Accepted | Acceptance already completed. Payment follow-up blocked. |
| COMM-F | `FODE_COMM_AUTHORITY_APPLICANT_F` | Dormant, rejected, archived, withdrawn, or closed | Operational templates suppressed; only appropriate manual communication should remain available. |

## Selection Rules

Use stable applicant records that release engineers can identify and maintain. Do not hardcode applicant IDs in Playwright specs. Configure IDs through the environment variables above, usually in the Playwright sandbox `.env`.

Each fixture should have:

- A stable applicant ID.
- A clear lifecycle state matching the fixture row.
- An effective email address when an "available" preview is expected.
- No need for live mutation to satisfy the expected state.

## Fixture Verifier

`npm run test:comm-authority-fixtures` opens each configured fixture and verifies:

- The applicant can be found.
- The observed lifecycle text matches the expected fixture state.
- The recommendation surface shows either `Recommended next action` or `No recommended send action`.
- Expected available templates produce preview evidence.
- Expected blocked templates are disabled or return blocked authority evidence.

If a fixture is not configured, it is reported as missing. If a configured applicant no longer matches the expected lifecycle state, the verifier records `SKIP` with the observed state and does not silently pass that fixture.

## Updating Fixtures

When replacing a fixture:

1. Choose an applicant already in the required lifecycle state.
2. Confirm the applicant can be found in Admin staging without data mutation.
3. Update the matching `FODE_COMM_AUTHORITY_APPLICANT_*` environment variable.
4. Run `npm run test:comm-authority-fixtures`.
5. Keep the generated report path with the release evidence.

## Release Engineer Use

Before release acceptance, run from `F:\Playwright\fode-secure-link-diagnostic`:

```powershell
npm run test:comm-authority-fixtures
```

Expected report output is written under `reports/*-admin-communication-authority-fixtures`.

## No-Go Areas

This fixture smoke must not:

- Click Send.
- Trigger email or WhatsApp delivery.
- Change payment status.
- Change document status.
- Modify Sheets or Drive.
- Touch Student, Production, or OPS deployments.
