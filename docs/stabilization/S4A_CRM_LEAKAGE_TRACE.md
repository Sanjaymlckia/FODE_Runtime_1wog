# S4A Live CRM Leakage Trace

Date: 2026-05-09
Scope: outbound-path trace and forensic instrumentation only
Method: local source inspection plus redacted trace logging

## Summary

- The direct Zoho CRM write functions are still present in source but remain dormant behind the stabilization no-op boundary.
- The only live external handoff path in the current audited runtime is the invoice webhook path in `Admin.js`.
- A second unknown webhook or external automation source is still plausible because invoice-trigger state and CRM-era fields remain coupled to payment verification semantics.
- New trace logging now records only function name, config key name, redacted host, applicant/form identity, operation type, and timestamp.

## Outbound Path Inventory

| File | Function | Approx line | Destination source / config key | Purpose | Can touch CRM | Risk |
| --- | --- | ---: | --- | --- | --- | --- |
| `Utils.js` | `urlFetchJson_` | 255 | caller-provided URL, often `DRIVE_API_BASE` | shared JSON fetch helper used by Drive API helpers | No direct CRM | `SAFE` |
| `Utils.js` | `driveApiGet_` | 286 | `DRIVE_API_BASE` | Drive metadata reads | No | `SAFE` |
| `Utils.js` | `driveApiPost_` | 296 | `DRIVE_API_BASE` | Drive metadata writes/uploads | No | `SAFE` |
| `Utils.js` | `getZohoToken_` | 443 | `ZOHO_OAUTH_BASE` | Zoho OAuth token refresh | Yes, prerequisite for CRM writes | `DORMANT` |
| `Utils.js` | `upsertZohoContact_` | 499 | `ZOHO_API_BASE` | Zoho contact upsert | Yes | `DORMANT` |
| `Utils.js` | `upsertZohoDeal_` | 548 | `ZOHO_API_BASE` | Zoho deal upsert | Yes | `DORMANT` |
| `Admin.js` | `triggerInvoiceWebhook_` | 1241 | `INVOICE_WEBHOOK_URL` | external invoice / downstream handoff | Possibly, depending on external receiver | `ACTIVE` |
| `Admin.js` | `handleInvoiceTrigger_` | 1703 | `INVOICE_WEBHOOK_URL` via `triggerInvoiceWebhook_` | invoice gate and replay marker writeback | Possibly, indirectly | `ACTIVE` |
| `Admin.js` | `runVerificationAutomations_` | 1746 | `INVOICE_WEBHOOK_URL` via invoice trigger path | payment-verified transition handoff | Possibly, indirectly | `ACTIVE` |
| `Code.js` | `shouldCreateFodeCrmInvoice_` | 4467 | `INVOICE_WEBHOOK_URL` adjacency only | eligibility decision for invoice handoff | Indirectly influences path | `UNKNOWN` |
| `Code.js` | activation file canonicalization fetch | 4791 | row-provided remote file URL | fetch remote file before canonicalization into Drive | No direct CRM | `UNKNOWN` |

## CRM Dormant Path Status

- `triggerCrmDealForFode_` returns no-op and logs `STABILIZATION_CRM_WRITE_BLOCK`
- `syncFodeCrmStage_` returns no-op and logs `STABILIZATION_CRM_WRITE_BLOCK`
- `crm_syncOnPaymentVerified_` returns no-op and logs `STABILIZATION_CRM_WRITE_BLOCK`
- No `UrlFetchApp.fetch` occurs after these stabilization blocks because the functions return before any Zoho token or upsert helper can run

## Forensic Logging Added

### Event names

- `S4A_OUTBOUND_TRACE`
- `S4A_CRM_SUSPECT_PATH`
- `S4A_INVOICE_WEBHOOK_TRACE`

### Redaction rule

- `redactUrlForLog_(url)` returns protocol plus hostname only
- path, query string, and tokens are suppressed

### Instrumented functions

- `urlFetchJson_`
- `getZohoToken_`
- `upsertZohoContact_`
- `upsertZohoDeal_`
- `triggerInvoiceWebhook_`
- `handleInvoiceTrigger_`
- `runVerificationAutomations_`
- `shouldCreateFodeCrmInvoice_`
- activation file canonicalization fetch in `Code.js`

## Trace Interpretation

- If `S4A_INVOICE_WEBHOOK_TRACE` appears near a CRM-side update, the invoice webhook path remains the primary suspect.
- If CRM-side updates occur without a matching `S4A_INVOICE_WEBHOOK_TRACE`, the leakage is more likely coming from:
  - a second external webhook
  - Zoho-side workflow automation
  - another Apps Script deployment or project
  - Zoho Flow / Books automation

## Manual Operator Checks Required

- Apps Script project deployments and web apps: confirm no older deployment or alternate web app is still active
- Apps Script project triggers: confirm deleted/disarmed state remains true
- Zoho CRM webhooks: inspect contact/deal workflow webhooks for FODE objects
- Zoho CRM workflow rules: inspect payment, admission, and invoice-related automations
- Zoho Flow: inspect flows connected to CRM, Forms, or Books
- Zoho Books automation: inspect invoice creation / payment workflows
- FormDesigner webhook list: inspect every active webhook endpoint and disabled/history entries if visible

## Current Working Hypothesis

- The strongest live-code suspect is still `triggerInvoiceWebhook_()` because it is the only active external post path in the payment verification handoff.
- The second strongest hypothesis is a non-repo external automation source reacting to sheet/CRM-era state, because direct CRM write functions are already blocked in local source.
