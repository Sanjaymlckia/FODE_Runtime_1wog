# Architecture Build V1 Backup and Recovery

Status: V1 closure runbook

## Backup Set

The closure backup must contain:

- a private complete copy of the authoritative Google Sheets workbook;
- a secured Script Properties JSON export with key count and parse proof;
- a sanitized server manifest containing source/copy IDs, tab names, runtime identity, and deployment pins;
- a restorable Git bundle containing the closure source commit and all refs;
- the deployed Apps Script source proof, manifest, runtime context, acceptance reports, and documentation;
- a local integrity manifest containing SHA-256 hashes for non-secret artifacts.

Secret-bearing Script Properties and raw workbook exports must remain private and must never be committed.

## Closure Procedure

1. Verify Admin `whoami` and Student `whoami` from `runtime-context.json`.
2. Verify the repository is clean and synchronized with `origin/main`.
3. Create the private server-side workbook/Script Properties backup through the Super-only confirmed backup RPC.
4. Create a Git bundle under `F:\FODE_DR_Backup\architecture_v1\<timestamp>`.
5. Copy sanitized acceptance, release, runtime, and remote-source evidence into the same closure folder.
6. Generate hashes and a manifest without embedding secret values.
7. Run the restoration-confidence checks below.

## Restoration-Confidence Checks

- `git bundle verify <bundle>` succeeds.
- `git bundle list-heads <bundle>` includes the recorded closure commit.
- The workbook copy enumerates the same expected tabs, including `Capability_Grants` and `Webhook_Log`.
- The private Script Properties export parses and reports the expected key count.
- Apps Script source contains the recorded `VERSION` and `DEPLOY_VERSION_NUMBER`.
- Deployment evidence identifies Admin staging and Student staging pins independently.
- The rollback target and live identities can be recovered from the sanitized manifest.

Do not restore over the live system during verification. Rollback prefers deployment repin first; workbook or Script Properties restoration requires a separate owner-approved mutation CIS.

## V1 Rollback Reference

- Admin staging pin before V1 closure: Apps Script `@373`, runtime `r340 / 340`.
- Student: Apps Script `@247`, runtime `r217 / 217`.
- Production: untouched.
- Source baseline before closure documentation: `50e2a6325d313bd2e07f933dbf7a95e52181922e`.
