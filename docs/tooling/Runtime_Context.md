# Runtime Context

## Recommendation

Use `runtime-context.json` as the single source of project tooling configuration.

Runtime files such as `Config.js` still own project runtime behavior. REP context owns tooling inputs: repositories, runtime URLs, deployment IDs, expected identities, Playwright locations, evidence paths, acceptance profiles, and read-only diagnostics.

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

## Validation

Run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\rep-validate-context.ps1
```

The validator is read-only. It checks context shape, active project selection, repository path, branch, Apps Script source authority, deployment target shape, acceptance profiles, and mutation-default safety.

## Adding a Project

1. Add a project key under `projects`.
2. Populate only configuration.
3. Add a project folder under `projects/`.
4. Reuse the shared tooling and acceptance profiles.
5. Add project-specific suites only when a shared suite cannot express the domain.

Do not copy FODE IDs, URLs, or report paths into the new project.
