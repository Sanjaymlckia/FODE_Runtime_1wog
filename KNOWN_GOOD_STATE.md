# Known Good State

## Baseline

- Script ID: `1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90`
- Known baseline version: `r118 / 118`
- Commit: `5649a3f`
- Tag: `staging-as118`
- Canonical Admin Deployment ID: `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ @118`
- Canonical Student Deployment ID: `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv @118`
- Admin UI smoke: PASS; Stage Dashboard and Review Queues load.

## Runtime Identity Rule

- `CONFIG.VERSION` must equal `"r" + CONFIG.DEPLOY_VERSION_NUMBER`.
- `whoami` is primary runtime truth.
- Admin badge is secondary unless visually verified in browser.
- Local `Config.js` ahead of live runtime is not drift unless release was intended.

## Feature Flags Baseline

- `ENABLE_AUTOMATED_STAGE_RUNNER = false`
- `ENABLE_BOUNCE_INGESTION = false` unless later verified otherwise
- No automated stage trigger installed during last known release flow.

## Gmail Identity

- From: `fode_kia@kundu.ac`
- Reply-To: `fode@kundu.ac`

## Batch Settings

- `MAX_STAGE_BATCH_SIZE = 30`
- `DEFAULT_STAGE_BATCH_SIZE = 20`

## Acceptance PASS Rules

- `VERSION == r118`
- `DEPLOY_VERSION_NUMBER == 118`
- `VERSION == "r" + DEPLOY_VERSION_NUMBER`
- Script ID matches `1wog`.
- No stored or generated canonical link uses workspace-domain Apps Script paths.
- Admin portal loads.
- Student portal loads.
- Admin runtime badge matches `whoami` after Ctrl+F5.

## r147 Stable Operational Baseline

Date locked: 2026-05-07

Runtime identity:

- Runtime version: `r147 / 147`
- Apps Script platform version: `145`
- Git commit: `e69256e` (`r147: harden bounce correlation safety`)
- Expected Script ID: `1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90`
- Admin whoami: `r147 / 147`, mismatch `false`, Script ID matches expected
- Student whoami: `r147 / 147`, mismatch `false`, Script ID matches expected

Canonical URLs:

- Admin: `https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec`
- Student: `https://script.google.com/macros/s/AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv/exec`

Operational notes:

- Bounce scan mode: `SAFE_WITH_AMBIGUOUS_QUEUE`
- Ambiguous DSNs are skipped safely.
- Bounce correlation prefers explicit applicant-id tokens and unique recipient matches.
- Bounce visibility is repaired.
- Trigger visibility is repaired.
- Automation is verified operational.
- Trigger cadence is currently operator-controlled.
- No CRM dependency is required for the admissions workflow.

Rollback anchor:

- Use tag `baseline-r147` after this governance baseline commit is pushed.
- Rollback should prefer deployment repin first, followed by Admin and Student `?view=whoami` verification.
