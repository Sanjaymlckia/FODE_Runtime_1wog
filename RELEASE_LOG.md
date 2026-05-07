# Release Log

## r147 Stable Baseline Lock

Date: 2026-05-07
Type: governance, documentation, and rollback anchor

### Purpose

Lock r147 as the current stable operational baseline for future rollback, comparison, and controlled refactor planning.

### Key Changes

- Hardened bounce correlation safety.
- Preferred explicit applicant-id tokens where present.
- Allowed unique recipient matches only when unambiguous.
- Skipped ambiguous DSNs safely.
- Repaired bounce visibility in the Admin surface.
- Repaired trigger visibility in the Admin surface.
- Preserved send-path, batch-send, trigger cadence, automation, and eligibility behavior.

### Deployment Verification

- Admin canonical whoami: `r147 / 147`, mismatch `false`, Script ID matches expected.
- Student canonical whoami: `r147 / 147`, mismatch `false`, Script ID matches expected.
- Apps Script platform version: `145`.
- Canonical Admin URL: `https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec`
- Canonical Student URL: `https://script.google.com/macros/s/AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv/exec`

### Operational Outcome

- r147 is the current stable operational baseline.
- Bounce scan behavior is `SAFE_WITH_AMBIGUOUS_QUEUE`.
- Ambiguous DSNs are skipped safely.
- Automation is verified operational.
- Trigger cadence is currently operator-controlled.
- No CRM dependency is required for admissions workflow continuity.

### Rollback Anchor Notes

- Stable runtime commit: `e69256e` (`r147: harden bounce correlation safety`)
- Baseline tag: `baseline-r147`
- Rollback preference: deployment repin first, then verify Admin and Student `?view=whoami`.
- No runtime, deployment, trigger, send, Sheet, Drive, Gmail, Apps Script, or Zoho mutation is part of this governance baseline lock.
