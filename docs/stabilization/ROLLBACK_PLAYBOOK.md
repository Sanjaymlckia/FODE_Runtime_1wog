# S1 Rollback Playbook

Date: 2026-05-09
Scope: Deployment rollback and runtime verification only

## Principles

- Rollback prefers deployment repin first
- Live `whoami` is runtime truth
- No source file proves live runtime state by itself
- Trigger is currently deleted by operator; do not recreate it during rollback unless a future CIS explicitly authorizes that

## Baseline Runtime

- Target stable runtime currently documented in `CURRENT_TASK.md`: `r148 / 148`
- Canonical Admin URL:
  `https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec`
- Canonical Student URL:
  `https://script.google.com/macros/s/AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv/exec`

## Rollback Process

1. Identify the intended rollback target version and deployment version number.
2. Repin Admin deployment to the approved Apps Script version.
3. Repin Student deployment to the same approved Apps Script version.
4. Verify Admin whoami on the canonical Admin URL.
5. Verify Student whoami on the canonical Student URL.
6. Confirm both surfaces report the same runtime version and `mismatch = false`.
7. Confirm required browser surface still loads for the affected view.

## Whoami Verification

Admin:
- `https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec?view=whoami`

Student:
- `https://script.google.com/macros/s/AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv/exec?view=whoami`

PASS conditions:
- Admin `VERSION` equals expected target version
- Student `VERSION` equals expected target version
- Admin and Student match each other
- `DEPLOY_VERSION_NUMBER` matches the numeric suffix of `VERSION`
- `mismatch` is `false` on both

FAIL conditions:
- Admin and Student report different versions
- Either surface reports `mismatch = true`
- Either surface resolves to a workspace-domain URL instead of canonical `script.google.com/macros/s/<DEPLOYMENT_ID>/exec`
- Admin or Student browser surface fails after repin

## Rollback Validation

- Check Admin `?view=whoami`
- Check Student `?view=whoami`
- Check Admin browser surface needed for the incident
- Check Student browser surface if the incident affects portal/runtime access
- Confirm no unauthorized trigger recreation occurred

## Emergency Stop Process

1. Stop planned forward changes.
2. Do not deploy additional source changes until runtime truth is understood.
3. Repin both deployments to the last accepted safe version.
4. Re-run Admin and Student whoami checks.
5. Record rollback result in `CURRENT_TASK.md`.
6. Keep trigger state dormant unless explicitly reauthorized.

## Trigger Note

- Trigger currently deleted by operator
- Trigger helper functions still exist in source
- Rollback should preserve deleted/dormant trigger state unless the rollback target explicitly requires a trigger and a future CIS authorizes installation
