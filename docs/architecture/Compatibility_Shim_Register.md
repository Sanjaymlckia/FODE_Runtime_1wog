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
