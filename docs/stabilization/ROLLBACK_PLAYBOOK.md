# S1 Rollback Playbook

Date: 2026-05-09
Scope: Deployment rollback and runtime verification only

## Principles

- Rollback prefers deployment repin first
- Live `whoami` is runtime truth
- No source file proves live runtime state by itself
- Trigger is currently deleted by operator; do not recreate it during rollback unless a future CIS explicitly authorizes that

## Rollback Confidence Assessment

- Confidence level: moderate
- Strengths:
  - runtime identity model is explicit: `VERSION`, `DEPLOY_VERSION_NUMBER`, and canonical Admin/Student `whoami`
  - canonical deployment URLs are documented in both source and task state
  - triggerless/dormant operational posture reduces accidental unattended sends during rollback
- Confidence constraints:
  - this repo cannot prove live deployment pin state without fresh `whoami` checks
  - rollback remains partially operator-driven because deployment repin is outside local git state
  - browser/operator acceptance for r148 is still pending, so rollback readiness is better documented than acceptance completeness

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

## Known Rollback Limitations

- Local source can confirm intended canonical URLs and version constants, but cannot confirm live deployment state by itself
- Rollback does not automatically restore browser/operator acceptance evidence for the target version
- Any row-level or file-level data side effects created before rollback remain operational facts unless separately remediated
- Trigger state is intentionally not recreated as part of standard rollback in the current stabilization posture

## Schema Rollback Risks

- Workflow semantics currently span both canonical and compatibility fields, especially:
  - `Receipt_Status` and `Payment_Verified`
  - `Doc_Verification_Status` and `Docs_Verified`
  - `Portal_Access_Status` plus computed portal lock logic
- Repinning runtime without understanding these semantic overlaps can restore code that interprets the same row state differently
- CRM-era compatibility fields remain present, so older runtime versions may still read or write them even if the current strategy is to quarantine them later
- Portal upload state mixes sheet fields and Drive artifacts; repinning code does not revert Drive folder/file state

## Triggerless Operational State

- Current operational expectation is triggerless/dormant
- Trigger helper functions remain in source for inspection and future controlled reactivation
- Standard rollback should preserve the deleted/disarmed trigger state
- If a rollback target historically expected automation, treat that as a separate approval gate rather than part of baseline rollback

## Emergency Stop Process

1. Stop planned forward changes.
2. Do not deploy additional source changes until runtime truth is understood.
3. Repin both deployments to the last accepted safe version.
4. Re-run Admin and Student whoami checks.
5. Record rollback result in `CURRENT_TASK.md`.
6. Keep trigger state dormant unless explicitly reauthorized.

## Manual Operator Recovery Procedure

1. Freeze further source or deployment actions.
2. Open canonical Admin and Student `?view=whoami` URLs and capture the reported versions.
3. Identify the intended safe target version and its Apps Script deployment version.
4. Repin Admin and Student to that same target version.
5. Re-run both `whoami` URLs and confirm exact version parity.
6. Open the affected Admin or Student browser surface and verify the incident path is stable.
7. Confirm trigger state remains deleted/disarmed.
8. Record outcome, residual risks, and any blocked acceptance evidence in `CURRENT_TASK.md`.

## Freeze Changes Protocol

Use this protocol whenever runtime identity is uncertain, rollback parity fails, or live behavior diverges from documentation.

1. Freeze changes immediately.
2. No deploy, no tag, no trigger recreation, no schema mutation.
3. Treat canonical Admin and Student `whoami` as the only release truth.
4. Resolve version parity before any semantic cleanup or workflow refactor proceeds.
5. Resume work only under an explicit CIS that states the next safe step.

## Trigger Note

- Trigger currently deleted by operator
- Trigger helper functions still exist in source
- Rollback should preserve deleted/dormant trigger state unless the rollback target explicitly requires a trigger and a future CIS authorizes installation
