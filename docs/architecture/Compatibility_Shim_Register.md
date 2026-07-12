# Compatibility Shim Register

Status: ACP / CAP working register

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

## ACP Closure Note

As of Admin staging `@363` / runtime `r338 / 338`, no compatibility shim above may independently send applicant communications or bypass Communication Authority.
