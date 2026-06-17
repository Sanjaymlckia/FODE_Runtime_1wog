# r23D.6C Scoped Applicant Search Recovery

## Scope

Track H local/staging candidate for `r23D.6C - Scoped Applicant Search Recovery`.

## What Was Restored

- Added an explicit Applicant Search scope selector:
  - Direct search only
  - Selected workload stage
- Stage-scoped search uses the existing `selectedStageFilter` and passes `stage` to `admin_searchApplicants`.
- Added a read-only scope note showing the active search scope and selected workload stage.

## What Was Intentionally Not Restored

- The old noisy bottom results panel was not restored wholesale.
- Docs-send selection controls were not re-enabled from search results.
- Search results were not made send-authoritative.
- Review Queues, Stage Batch Preview, Stage Batch Send, lifecycle authority, and communication automation were not changed.

## Risk Controls

- Search scope defaults to direct search.
- Stage scope is disabled when no workload stage is selected.
- Results remain review/navigation-only.
- Stage Batch Preview/Send remains the only batch-send surface.
- No sheet writes, send calls, lifecycle changes, queue membership changes, or authority changes were introduced.

## Test Evidence

- Local source gates to be recorded in the release report.
- Manual staging inspection should verify:
  - direct Applicant ID/email/name/phone search still works,
  - selecting a workload stage enables stage-scoped search,
  - results remain read-only/navigation-only,
  - no docs-send/bulk-send controls appear,
  - Review Queues and Stage Batch surfaces remain unchanged.

## Deployment Proof

- Apps Script version created: 266
- Admin staging deployment: `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ @266`
- Student staging deployment remained unchanged: `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv @247`
- No production deployment, send, sheet edit, commit, or tag occurred.
