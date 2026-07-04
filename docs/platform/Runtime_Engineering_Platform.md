# Runtime Engineering Platform v1

## Recommendation

REP v1 separates project runtime code from reusable engineering tooling.

- Project Runtime: business logic, applicant/student/marketing/institution logic, and project-owned Apps Script source.
- Runtime Platform: developer tooling, deployment, acceptance, diagnostics, evidence, configuration, testing, identity, and release management.
- Shared Engineering Components: reusable scripts, profiles, reports, and workflow contracts driven by project context.

FODE is the first consumer. KIA, MLC, Marketing, and later runtimes should add context before adding tooling.

## Authority

`runtime-context.json` is the authoritative platform configuration. Docs and scripts must resolve IDs, URLs, expected identities, Playwright targets, and evidence roots from context instead of repeating constants.

Live runtime truth still comes from whoami. Local source and context are planning inputs, not proof of live deployment.

## Platform Boundaries

REP tooling may:

- validate context;
- generate acceptance plans;
- generate evidence records;
- run read-only diagnostics;
- verify runtime and deployment identity;
- prepare release summaries.

REP tooling must not mutate Sheets, Drive, email, WhatsApp, Student, Production, or OPS unless a separate CIS explicitly authorizes the exact action.

## Reusable Surfaces

Reusable acceptance suites:

- health
- identity
- operations
- review
- communications
- gallery
- payments
- documents
- lifecycle
- system-health

Temporary Playwright specs should be exceptions. Normal workflows should call named suites from project context.

## Deployment Platform

A deployment workflow is a sequence, not a single implicit command:

1. Load project context.
2. Confirm release track and authorized target.
3. Run local preflight and validation.
4. Verify local and remote source identity.
5. Push Apps Script source only when authorized.
6. Create an Apps Script version only after remote-source proof.
7. Repin only the authorized deployment.
8. Verify whoami.
9. Run the requested acceptance profile.
10. Record evidence and rollback guidance.

No runtime release is authorized by REP documentation alone.

## Evidence Platform

Evidence records should include:

- timestamp;
- project;
- profile;
- runtime identity;
- deployment identity;
- commit;
- Playwright report path when applicable;
- PASS/FAIL status;
- notes and follow-ups.

The naming pattern is project-context driven.

## Release Management

Supported release types:

- major;
- minor;
- hotfix;
- identity bump;
- benchmark.

Rollback guidance defaults to deployment repin first. Source revert is secondary and must follow the active CIS.
