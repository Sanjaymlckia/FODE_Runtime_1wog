# S1 Deployment Baseline

Date: 2026-05-09
Scope: Read-only stabilization baseline for the authoritative repo at `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog`
Source basis: `CURRENT_TASK.md`, `Config.js`, git metadata, and local runtime source only

## Baseline Identity

- `VERSION`: `r148`
- `DEPLOY_VERSION_NUMBER`: `148`
- Runtime identity rule: `VERSION` must equal `r` + `DEPLOY_VERSION_NUMBER`
- Current identity check: PASS (`r148` matches `148`)
- Script ID: `1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90`
- Current branch: `main`
- Current commit: `8a83d63fad841ce0f320b99f35b481845bab0071`

## Canonical URLs

- Canonical Admin URL:
  `https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec`
- Canonical Student URL:
  `https://script.google.com/macros/s/AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv/exec`
- Admin whoami URL:
  `https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec?view=whoami`
- Student whoami URL:
  `https://script.google.com/macros/s/AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv/exec?view=whoami`

## Runtime Match Note

- `CURRENT_TASK.md` records Admin whoami = `r148 / 148`, mismatch `false`
- `CURRENT_TASK.md` records Student whoami = `r148 / 148`, mismatch `false`
- Runtime match conclusion: Admin and Student are aligned at the same runtime version
- Acceptance caveat: browser/operator acceptance for the r148 WhatsApp fallback queue is still pending; this baseline is rollback-safe documentation, not release closure

## Authority Note

- Canonical repo authority for this CIS is `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog`
- Historical non-authoritative local path references were present before the S1 authority cleanup and should remain treated as stale
