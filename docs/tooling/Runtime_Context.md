# Runtime Context

## Recommendation

Use `runtime-context.json` as the single source of project tooling configuration.

Runtime files such as `Config.js` still own project runtime behavior. REP context owns tooling inputs: repositories, runtime URLs, deployment IDs, expected identities, Playwright locations, evidence paths, acceptance profiles, and read-only diagnostics.

Current FODE baseline recorded by `runtime-context.json`:

- Repository: `D:\Repos\FODE_Runtime_1wog`
- Git baseline: `2ebe8bfd76e71763ef708bd28cbe51eb5c73ef2b`
- Admin staging: `@428 / r392 / 392`
- Student: `@247 / r217 / 217`
- Production: untouched
- Accepted repairs: `R390B1`, `R391A` audit, `R391B`, `R391C`
- Current restriction: Batch send prohibited
- Next implementation pass after R392A tooling acceptance: `R391D/E`

`runtime-context.json` is source-controlled tooling context. It records expected identities and governance state; it does not prove live runtime state by itself. Live `whoami` remains runtime truth before any release acceptance or deployment-dependent claim.

## Required Fields

Each project context should define:

- project display name;
- repository path and GitHub remote;
- Apps Script script ID and source authority;
- live Sheet ID and primary tab;
- deployment targets and whoami URLs;
- expected runtime identity and platform version;
- Playwright project and report paths;
- evidence roots and naming pattern;
- acceptance profiles;
- diagnostic capabilities;
- release management defaults;
- mutation-default feature flags.
- accepted baseline, accepted repairs, current restrictions and next-pass guidance where needed for project governance.

## Validation

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\rep-validate-context.ps1
```

The validator is read-only. It checks context shape, active project selection, repository path, branch, Apps Script source authority, deployment target shape, acceptance profiles, and mutation-default safety.

## Admin Release Pipeline

R392A consolidates normal Admin staging releases into:

1. `tools\Invoke-FodeAdminRelease.ps1`
2. owner evidence review and acceptance
3. `tools\Complete-FodeReleaseCommit.ps1`

The pipeline uses `runtime-context.json` for repository, Apps Script project, Admin deployment, Student deployment, Production no-touch status, evidence roots and expected identities. Runtime context is still not live proof; Admin and Student `whoami` remain runtime truth after any deployment-dependent action.

## Adding a Project

1. Add a project key under `projects`.
2. Populate only configuration.
3. Add a project folder under `projects/`.
4. Reuse the shared tooling and acceptance profiles.
5. Add project-specific suites only when a shared suite cannot express the domain.

Do not copy FODE IDs, URLs, or report paths into the new project.
