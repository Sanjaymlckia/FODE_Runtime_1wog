# Compatibility Shim Register

Status: ACP / CAP working register

| Shim | Classification | Current responsibility | Planned fate |
|---|---|---|---|
| legacy lifecycle stage in Actionability | Compatibility shim | fallback when canonical recommendation is unavailable | keep until canonical lifecycle migration is complete |
| legacy lifecycle stage in Communication Authority | Compatibility shim | fallback when canonical communication context is absent or not yet migrated | keep until canonical communication convergence is proven across all message families |
| Stage Batch legacy stage selection | Compatibility shim | current candidate-selection authority | keep until dedicated Stage Batch migration pass |
| UI fallback for bucket summaries | Compatibility shim | preserves Admin rendering if server `bucketSummaries` is absent | remove after stable release evidence |
| selected/manual batch wrappers | Compatibility shim | preserve entry-point contracts while delegating policy to shared helpers | keep as surface-specific wrappers |
| Management compatibility grouping for legacy consumers | Compatibility shim | preserves older internal grouping while contactability rows are exposed as `Contactability Exceptions` to operators | retire when all consumers use current bucket taxonomy |
| `admin_sendDocsFollowupEmails()` | Retired compatibility wrapper | preserves old endpoint shape while returning `LEGACY_DOCS_FOLLOWUP_RETIRED` and authoritative guidance only | remove after all remaining compatibility callers and operator wording are retired |
| `eligibleDocsFollowUp` / `docsFollowupSentAt` compatibility fields | Compatibility display shim | preserve historical queue/search row shape and legacy status labels only | remove after compatibility queue/search communication history is fully normalized |

## ACP Closure Note

As of Admin staging `@363` / runtime `r338 / 338`, no compatibility shim above may independently send applicant communications or bypass Communication Authority.
