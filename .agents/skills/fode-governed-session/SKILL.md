---
name: fode-governed-session
description: Govern FODE session opening, continuation, recovery, orientation, checkpointing and closure. Use for Continue FODE, Resume FODE, Open FODE work, Start FODE, What is next on FODE, Recover FODE session, Orient FODE, and Close FODE session.
---

# FODE governed session

For any FODE continuation or closure request, invoke the deterministic repository tool before editing:

```powershell
.\tools\governance\Fode-GovernedSession.ps1 -Action Orient
```

The tool is the project-controlled entry path. It resolves the repository, reads the instruction and owner-policy chain, captures Git evidence, reconciles the last checkpoint, preserves restrictions, and emits JSON plus a human-readable result.

Use `Status` for read-only inspection, `Checkpoint` after every material controlled event, `RecordDecision` when an owner decision is supplied, and `Close` for a closure receipt. Treat recorded summaries as subordinate to observed evidence.

Do not edit when the result is `GOVERNED_SESSION_STOP`, `OWNER_DECISION_REQUIRED`, `EXTERNAL_STATE_UNVERIFIED`, `CONCURRENT_SESSION_DETECTED`, or `BASELINE_DRIFT`. `READ_ONLY_RECONCILIATION` permits inspection and checkpointing only. A stale open session is interrupted, never successful. Never infer owner acceptance or external completion.
