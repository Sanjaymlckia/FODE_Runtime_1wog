# Legacy Retirement Register

Status: ACP / CAP working register

| Function / surface | Current classification | Why still present | Retirement gate |
|---|---|---|---|
| `deriveApplicantLifecycleStage_()` | Compatibility shim | Stage Batch, dashboard metrics, and other consumers still read legacy lifecycle stage keys | retire only after all consumers consume canonical lifecycle or an explicit compatibility adapter |
| `communicationRecommendedMessageTypeForStage_()` | Compatibility shim | legacy stage-driven message recommendation still feeds Stage Batch and legacy fallback paths | retire only after Stage Batch and Communication Authority consume canonical recommendation directly |
| Review Queues legacy wording/structures | Compatibility shim | operator compatibility surface remains live | retire only after Operations Workspace fully replaces the remaining queue workflows |
| UI-local workload fallback helpers | Legacy retirement candidate | kept only as client fallback if server DTO is absent | retire after one full release proves `bucketSummaries` always present |
| contactability-in-management presentation | Retired operator wording | contactability now has a first-class operational bucket | keep internal compatibility only where tests/legacy consumers still require aliases |
| `docsFollowupSentAt` row field | Deferred compatibility field | retained for queue/search legacy-history labeling only | retire after compatibility communication history is normalized |
| `admin_sendDocsFollowupEmails()` | Retired wrapper | endpoint remains only to return `LEGACY_DOCS_FOLLOWUP_RETIRED` and authoritative next-step guidance | retire after no consumer expects the legacy RPC name |
| compatibility queue/search Docs Follow-Up wording | Deferred cleanup candidate | some labels still expose legacy history context to explain prior behavior | retire after operator wording is fully normalized to Communication Authority terms |
| `triggerInvoiceWebhook_()` | Retained compatibility path | legacy downstream invoice/webhook handoff still exists and is explicitly non-authoritative | retire only after dependency proof confirms no external/manual consumer still relies on the handoff |
| `handleInvoiceTrigger_()` | Retained compatibility path | wraps the legacy invoice-trigger gate/writeback path after payment verification | retire only after dependency proof confirms the legacy handoff can be removed safely |
| `CRM_Invoice_Triggered` | Retained compatibility field | replay-avoidance marker for the legacy invoice-trigger path | retire only with `triggerInvoiceWebhook_()` / `handleInvoiceTrigger_()` and explicit dependency proof |
| `Invoice_Sent_At` | Retained compatibility field | timestamp written by the legacy invoice-trigger path | retire only with the legacy invoice-trigger path and explicit dependency proof |

## Rule

No legacy helper is retired without:

1. identified consumers
2. test parity
3. release proof

## Future Retirement Register

These items become removable only after Portal Communication keeps its current
behaviour without depending on historical-campaign semantics or naming.

| Item | Current role | Future retirement gate |
|---|---|---|
| `admin_planLegacyInviteBatch()` | historical planning wrapper | retire after no operator or compatibility caller depends on legacy invite batch planning |
| `adminDryRunFirst50LegacyInvites()` | historical dry-run evidence helper | retire after campaign recovery evidence is archived and no manual runbook depends on it |
| `legacy_invite_eligible` | historical planning filter contract | retire after legacy planning wrappers are removed |
| `buildLegacyCampaignPortalUrl_()` / `getActivePortalSecretForCampaign_()` names | compatibility/helper naming only | retire after a dedicated semantic/helper rename pass proves no external/test coupling |

## ACP Closure Classification

ACP is closed as:

`ARCHITECTURALLY VERIFIED - COMPLETE WITH DEFERRED CLEANUP`

The items above are retained only as non-authoritative residue or compatibility scaffolding. They must not be interpreted as evidence of a live operator send bypass.
