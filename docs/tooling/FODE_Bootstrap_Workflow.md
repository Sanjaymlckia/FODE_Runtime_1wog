# FODE Bootstrap Workflow

This repo is self-describing through `runtime-context.json`. New Codex sessions should start with the project wrapper scripts instead of rebuilding context from memory.

## Standard Commands

First command in every Codex session:

```powershell
tools\fode-bootstrap.ps1
```

Validation command:

```powershell
tools\fode-preflight.ps1
```

Release planning command:

```powershell
tools\fode-release-plan.ps1
```

Smoke command:

```powershell
tools\fode-smoke.ps1 -Profile operations
```

Other smoke profiles:

```powershell
tools\fode-smoke.ps1 -Profile health
tools\fode-smoke.ps1 -Profile hydration
tools\fode-smoke.ps1 -Profile all
```

## Codex GUI Approval Guidance

In Codex GUI, choose "Yes, and don't ask again" for these project-local wrappers:

- `tools\fode-bootstrap.ps1`
- `tools\fode-preflight.ps1`
- `tools\fode-release-plan.ps1`
- `tools\fode-smoke.ps1`

Do not blanket approve:

- `clasp push`
- `clasp version`
- deployment or repin commands
- `git push`
- Sheet, Drive, email, or WhatsApp mutation scripts

## Safety Boundaries

The wrapper scripts do not:

- push to Git
- run `clasp push`
- create Apps Script versions
- repin deployments
- edit Sheet or Drive data
- send email or WhatsApp
- touch Student, Production, or OPS deployments

`tools\fode-release-plan.ps1` is plan-only. Runtime release work still requires an explicit release CIS and release identity proof.
