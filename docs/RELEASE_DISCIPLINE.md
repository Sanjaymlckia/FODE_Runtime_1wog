# Release Track Discipline

This document complements `AGENTS.md` and `docs/governance/RELEASE_CLOSURE_DISCIPLINE.md`. It classifies release work before implementation; it does not itself authorize a release.

## Mandatory Classification

Every CIS must state its work class, release track, allowed files, forbidden actions, acceptance evidence, and whether a runtime release is authorized.

- Use `Track L` for low-risk UI or documentation work, including documentation-only process hardening, whose approved scope does not alter live write authority, backend behavior, security, data contracts, or operational mutation logic.
- Use `Track H` when scope includes backend or gate behavior, live-data mutation logic, security/portal identity, sends, Books/payment/classroom operations, schema, Script Properties, or comparable operational risk.
- Documentation-only or audit-only work still declares `Track L` or `Track H` by risk and separately states `No runtime release` when no runtime artifact is to be deployed.

## Track L Checklist

1. Declare `Track L` in the CIS and record why the surface qualifies.
2. Confirm the allowed-file list and establish the baseline with `git status -sb` and `git diff --check`.
3. Make only the approved low-risk UI/documentation changes.
4. Prove restricted behavior and preserved safety markers appropriate to the surface.
5. For any runtime release, follow the full Config identity, external remote-source verification, version, deployment repin, Admin `whoami`, and Student `whoami` gates.
6. Accept with CIS-approved evidence. Codex browser visual capture is not required when recorded rendered HTML, source/remote HTML proof, screenshot evidence, or operator-supplied browser evidence demonstrates the acceptance criteria.
7. Do not trigger dangerous write/send/create/reset/lock/export-sensitive actions during acceptance unless the CIS explicitly approves the exact action.
8. Finalize Git only after required acceptance is PASS and closure findings are classified.

## Track H Checklist

1. Declare `Track H` in the CIS and identify the high-risk behavior or authority boundary affected.
2. Define explicit acceptance, rollback, and stop conditions before editing.
3. Limit changes to approved files and verify scope continuously.
4. Complete all release identity and external remote-source gates before creating an Apps Script version.
5. Repin only approved canonical deployments and verify Admin and Student `whoami`.
6. Complete the required browser/manual acceptance checks with visible PASS/FAIL evidence.
7. Keep acceptance read-only unless the CIS explicitly authorizes an exact live action.
8. Apply `docs/governance/RELEASE_CLOSURE_DISCIPLINE.md`: treat newly discovered issues as `BLOCKER` or `FOLLOW-UP`, without expanding scope unless the issue blocks release.
9. Commit, tag, and push only after all required gates pass.

## Documentation-Only Work

Documentation-only process hardening is not a runtime release:

- Do not create a new `rNNN` runtime identity.
- Do not edit app/runtime files.
- Do not run `clasp push`, create an Apps Script version, repin deployments, or create a staging tag unless a later CIS explicitly authorizes it.
- Verify completion through Git scope and document-content checks.
