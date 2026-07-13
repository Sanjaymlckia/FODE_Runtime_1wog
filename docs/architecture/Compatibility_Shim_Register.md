# Compatibility Shim Register

Status: Architecture Build V1 frozen register at Admin `@373`, runtime `r340 / 340`

| Shim | Classification | Current responsibility | Planned fate |
|---|---|---|---|
| legacy lifecycle stage in Actionability | Compatibility shim | fallback when canonical recommendation is unavailable | keep until canonical lifecycle migration is complete |
| legacy lifecycle stage in Communication Authority | Compatibility shim | fallback when canonical communication context is absent or not yet migrated; canonical convergence is active for `docs_missing` and `payment_followup` | keep until canonical communication convergence is proven across all message families |
| Stage Batch legacy stage selection | Compatibility shim | current candidate-selection authority | keep until dedicated Stage Batch migration pass |
| UI fallback for bucket summaries | Compatibility shim | preserves Admin rendering if server `bucketSummaries` is absent | remove after stable release evidence |
| selected/manual batch wrappers | Compatibility shim | preserve entry-point contracts while delegating policy to shared helpers | keep as surface-specific wrappers |
| Management compatibility grouping for legacy consumers | Compatibility shim | preserves older internal grouping while contactability rows are exposed as `Contactability Exceptions` to operators | retire when all consumers use current bucket taxonomy |
| legacy invoice-trigger workflow (`triggerInvoiceWebhook_()`, `handleInvoiceTrigger_()`) | Compatibility shim | preserves historical downstream invoice/email handoff after payment verification | retain until external/manual dependency risk is explicitly cleared |
| `CRM_Invoice_Triggered` / `Invoice_Sent_At` | Compatibility contract | preserves replay-avoidance and legacy downstream invoice/email state | retain until the legacy invoice-trigger path is retired with dependency proof |
| `Payment_Verified` | Compatibility mirror | preserves yes/no payment compatibility projection beside canonical `Receipt_Status` | keep as mirror only; never treat as payment authority |
| `FODE_Billing_Reference` | Compatibility contract | preserves stable join key between runtime rows and Zoho Books invoice lookup/writeback | retain while Zoho Books integration depends on external reference matching |
| `admin_sendDocsFollowupEmails()` | Retired compatibility wrapper | preserves old endpoint shape while returning `LEGACY_DOCS_FOLLOWUP_RETIRED` and authoritative guidance only | remove after all remaining compatibility callers and operator wording are retired |
| `docsFollowupSentAt` compatibility field | Compatibility display shim | preserves historical queue/search legacy-send history labeling only | remove after compatibility queue/search communication history is fully normalized |
| `legacy_invite` message key | Compatibility alias | preserves the external/runtime semantic token for canonical Portal Communication while internal architecture separates it from the historical recovery campaign | keep until a dedicated semantic-rename pass proves API/test/operator compatibility |
| `legacy_invite_eligible` batch filter | Compatibility shim | preserves the historical Legacy Invite planning contract while canonical Portal Communication continues to use the same preview/send authority | retire after campaign-only planning helpers are removed |
| `buildLegacyCampaignPortalUrl_()` / `getActivePortalSecretForCampaign_()` helper naming | Compatibility shim | legacy helper names still back canonical Portal Communication URL/secret resolution | rename only after the compatibility alias is retired or explicitly decoupled |

## V1 Classification

| Classification | Item | Reason retained / authority status | Active caller | Removal precondition | Target phase |
|---|---|---|---|---|---|
| Active authority | Population Ledger, Canonical Lifecycle, Actionability, Communication Authority, Review Workspace, Capability Resolver, `Capability_Grants` | Current V1 authority model | Runtime and operator surfaces | Not a retirement target | V1 protected |
| Primary surface | Operator Next | Work projection only; no independent authority | Configured Admin accounts | Replaced only by an approved successor | V1 protected |
| Supported fallback | Current Admin | Mature Review/Batch host and operational rollback surface | Operator Next handoff and direct Admin route | Operator Next proves full replacement plus owner-approved retirement | Post-V1 |
| Compatibility only | Review Queues | Navigation/reconciliation, not accounting or send authority | Current Admin | Remaining workflows move to authority-backed surfaces | Post-V1 cleanup |
| Compatibility only | Stage Batch legacy stage selection | Cohort projection only; final Communication Authority remains mandatory | Stage Batch route | Canonical cohort migration with preview/send parity proof | Dedicated Track H |
| Compatibility only | Contained Global View | No canonical full-population DTO exists | Disabled Operator Next control | Canonical global population summary exists | Post-V1 |
| Compatibility only | Legacy route and semantic adapters | Preserve current RPC/message contracts without owning authority | Current Admin and historical integrations | Caller dependency proof | Incremental retirement |
| Retired | OPS operational authority | Reference-only; no core route depends on OPS | Historical evidence only | Archive after recovery/evidence review | Post-V1 archive |
| Retired | Legacy Docs Follow-Up send authority | Wrapper cannot send and returns retirement guidance | Compatibility endpoint only | Caller removal proof | Post-V1 cleanup |
| Deferred | H2 exact-action/exact-batch approval | Not implemented; must not be inferred from H1 | None | Separate owner-approved Track H design | H2 |
| Deferred | VCF/manual WhatsApp export | Exact selected-cohort adapter and audit contract absent | None | Dedicated capability and bounded adapter | Post-V1 |
| Deferred | Registry, Classroom, REP, broader UI polish | Accepted future architecture, not V1 runtime | None | Separate programmes | Post-V1 |

## ACP Closure Note

As of Admin staging `@373` / runtime `r340 / 340`, no compatibility shim above may independently send applicant communications or bypass Communication Authority.
