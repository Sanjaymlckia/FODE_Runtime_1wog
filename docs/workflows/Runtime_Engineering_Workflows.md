# Runtime Engineering Workflows

## Track L: Platform Or Documentation

Use for docs, local tooling, context files, and read-only reports.

Required checks:

- `git status -sb`;
- context validation when context or platform tooling changes;
- parser checks for changed scripts;
- `git diff --check`;
- `git diff --cached --check` before commit.

No runtime release. No Apps Script push, version, deployment repin, Sheet edit, Drive edit, send, Student action, Production action, or OPS action.

## Acceptance Planning

Generate a profile plan:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\rep-acceptance-plan.ps1 -Profile operations
```

The planner resolves project context and prints checks, target URLs, expected identities, Playwright path, and evidence naming. It does not run Playwright or mutate anything.

## Read-Only Diagnostics

Diagnostics must prove target authority before reading:

- context target exists;
- target environment is explicit;
- sheet/tab or deployment ID is known;
- requested operation is read-only.

If any target cannot be proven, report `READ ONLY BLOCKED`.

## Deployment Workflow

Deployment is available only under a separate release CIS.

Required sequence:

1. Confirm project context and release target.
2. Confirm local runtime identity.
3. Run scoped validation.
4. Push source only when authorized.
5. Verify remote source before version creation.
6. Create version only after identity gate passes.
7. Repin only the authorized deployment.
8. Verify Admin and Student whoami when required.
9. Run acceptance profile.
10. Generate evidence record.

## Evidence Record

Plan an evidence record:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\rep-evidence-record.ps1 -Profile operations -Status PASS -Plan
```

Writing evidence requires `-Execute` and should normally target the context evidence path.
