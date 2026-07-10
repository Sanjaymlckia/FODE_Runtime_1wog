# Legacy Retirement Register

Status: ACP / CAP working register

| Function / surface | Current classification | Why still present | Retirement gate |
|---|---|---|---|
| `deriveApplicantLifecycleStage_()` | Compatibility shim | Stage Batch, dashboard metrics, and other consumers still read legacy lifecycle stage keys | retire only after all consumers consume canonical lifecycle or an explicit compatibility adapter |
| `communicationRecommendedMessageTypeForStage_()` | Compatibility shim | legacy stage-driven message recommendation still feeds Stage Batch and legacy fallback paths | retire only after Stage Batch and Communication Authority consume canonical recommendation directly |
| Review Queues legacy wording/structures | Compatibility shim | operator compatibility surface remains live | retire only after Operations Workspace fully replaces the remaining queue workflows |
| UI-local workload fallback helpers | Legacy retirement candidate | kept only as client fallback if server DTO is absent | retire after one full release proves `bucketSummaries` always present |
| contactability-in-management presentation | Retired operator wording | contactability now has a first-class operational bucket | keep internal compatibility only where tests/legacy consumers still require aliases |
| `computeEligibleDocsFollowUp_()` | Deferred cleanup candidate | legacy Docs Follow-Up eligibility computation remains in compatibility/search plumbing only | retire after compatibility queue/search history fields are removed |
| `composeDocsFollowupBody_()` | Dead legacy composer candidate | no longer participates in any reachable operator send route | retire after one cleanup slice confirms no hidden automated consumer remains |
| `eligibleDocsFollowUp` row field | Deferred compatibility field | retained for queue/search display continuity and retirement messaging only | retire after compatibility communication history is normalized |
| `docsFollowupSentAt` row field | Deferred compatibility field | retained for queue/search legacy-history labeling only | retire after compatibility communication history is normalized |
| `admin_sendDocsFollowupEmails()` | Retired wrapper | endpoint remains only to return `LEGACY_DOCS_FOLLOWUP_RETIRED` and authoritative next-step guidance | retire after no consumer expects the legacy RPC name |
| compatibility queue/search Docs Follow-Up wording | Deferred cleanup candidate | some labels still expose legacy history context to explain prior behavior | retire after operator wording is fully normalized to Communication Authority terms |

## Rule

No legacy helper is retired without:

1. identified consumers
2. test parity
3. release proof

## ACP Closure Classification

ACP is closed as:

`ARCHITECTURALLY VERIFIED - COMPLETE WITH DEFERRED CLEANUP`

The items above are retained only as non-authoritative residue or compatibility scaffolding. They must not be interpreted as evidence of a live operator send bypass.
