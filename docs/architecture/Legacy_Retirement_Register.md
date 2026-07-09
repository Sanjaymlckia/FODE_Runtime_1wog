# Legacy Retirement Register

Status: ACP Phase 1 working register

| Function / surface | Current classification | Why still present | Retirement gate |
|---|---|---|---|
| `deriveApplicantLifecycleStage_()` | Compatibility shim | Stage Batch, dashboard metrics, and other consumers still read legacy lifecycle stage keys | retire only after all consumers consume canonical lifecycle or an explicit compatibility adapter |
| `communicationRecommendedMessageTypeForStage_()` | Compatibility shim | legacy stage-driven message recommendation still feeds Stage Batch and legacy fallback paths | retire only after Stage Batch and Communication Authority consume canonical recommendation directly |
| Review Queues legacy wording/structures | Compatibility shim | operator compatibility surface remains live | retire only after Operations Workspace fully replaces the remaining queue workflows |
| UI-local workload fallback helpers | Legacy retirement candidate | kept only as client fallback if server DTO is absent | retire after one full release proves `bucketSummaries` always present |

## Rule

No legacy helper is retired in ACP Phase 1.

Retirement requires:

1. identified consumers
2. test parity
3. release proof
