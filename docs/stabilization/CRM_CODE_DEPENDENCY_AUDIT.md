# S2C CRM Code Dependency Audit

Date: 2026-05-09
Scope: Read-only code audit of CRM, Zoho, invoice, and Books-adjacent code paths
Method: Source search and local code inspection only

## Summary

- Active Zoho CRM writes remain feature-flagged off through `ENABLE_FODE_CRM_PIPELINE = false`
- CRM semantics still influence runtime through stage derivation, `FormID`, `Deal_ID`, and `CRM_Invoice_Triggered`
- Invoice-trigger logic is operationally closer to downstream handoff than to direct Zoho sync, but it still reuses CRM-era fields

## Dependency Table

| File | Function | Approx line | Read / write behavior | Runtime critical | Quarantine recommendation |
| --- | --- | ---: | --- | --- | --- |
| `Utils.js` | `getZohoToken_` | 428 | Reads script properties, fetches Zoho OAuth token, writes refreshed token cache back to script properties | No while CRM disabled | `SAFE_TO_DORMANT` |
| `Utils.js` | `upsertZohoContact_` | 466 | Builds Zoho contact payload and performs Zoho upsert write | No while CRM disabled | `SAFE_TO_DORMANT` |
| `Utils.js` | `upsertZohoDeal_` | 497 | Builds Zoho deal payload, reads `FormID` and folder URL, performs Zoho upsert write | No while CRM disabled | `SAFE_TO_DORMANT` |
| `Utils.js` | CRM dry-run log branch | 1830 | Reads `CONFIG.CRM_PUSH_DRY_RUN`, logs CRM payload preview | Low | `COMPATIBILITY_READ_ONLY` |
| `Admin.js` | `triggerCrmDealForFode_` | 1009 | Reads feature flag and `shouldCreateFodeCrmDeal_`; no writes when disabled | Low | `SAFE_TO_DORMANT` |
| `Admin.js` | `syncFodeCrmStage_` | 1023 | Reads feature flag, derives CRM stage, reads invoice eligibility helper | Low | `COMPATIBILITY_READ_ONLY` |
| `Admin.js` | `crm_syncOnPaymentVerified_` | 1038 | Reads row and `FormID`, writes `Contact_ID`, `Deal_ID`, `CRM_Response`, logs `ZOHO_OK` / `ZOHO_ERROR` | Not currently active, but direct write path if re-enabled | `ACTIVE_BLOCKER` |
| `Admin.js` | payment verification result object | 978 | Exposes `crm` metadata in payment verification result | Low | `COMPATIBILITY_READ_ONLY` |
| `Admin.js` | `triggerInvoiceWebhook_` | 1232 | Reads invoice mode and webhook config, performs external webhook call | Medium in payment workflow | `UNKNOWN` |
| `Admin.js` | `handleInvoiceTrigger_` | 1682 | Reads `CRM_Invoice_Triggered`, may write `CRM_Invoice_Triggered` and `Invoice_Sent_At`, then sends payment email | Yes for downstream handoff after payment verification | `ACTIVE_BLOCKER` |
| `Admin.js` | `runVerificationAutomations_` | 1716 | Reads `Payment_Verified` transition, invokes invoice trigger path | Yes | `ACTIVE_BLOCKER` |
| `AdminUI.html` | save-result invoice display | 3396 | Reads `res.actions.invoice`, `invoiceCode`, `invoiceMessage` for operator display | Low | `COMPATIBILITY_READ_ONLY` |
| `Code.js` | `buildCrmPayloadFromRow_` | 4400 | Reads applicant, contact, folder, `FormID`, pipeline, stage; constructs CRM payload object | Shared dependency for dormant CRM write path | `COMPATIBILITY_READ_ONLY` |
| `Code.js` | `deriveFodeCrmStageFromRow_` | 4414 | Reads `Registration_Complete`, `Payment_Verified`, queue state, overall status to derive CRM stage | Yes, stage logic overlaps payment/handoff semantics | `ACTIVE_BLOCKER` |
| `Code.js` | `shouldCreateFodeCrmDeal_` | 4429 | Reads `Deal_ID` and derived CRM stage | Medium; used by dormant trigger helpers | `COMPATIBILITY_READ_ONLY` |
| `Code.js` | `shouldCreateFodeCrmInvoice_` | 4436 | Reads `Deal_ID`, `CRM_Invoice_Triggered`, and derived CRM stage | Yes, directly influences invoice trigger eligibility | `ACTIVE_BLOCKER` |
| `Code.js` | portal allowlist note | 5 | Explicitly documents that student portal excludes CRM fields and IDs | Low | `DELETE_LATER` |
| `Code.js` | duplicate/index helper `CRM_Email` | 8533 | Reads `CRM_Email` into index collection only | No | `DELETE_LATER` |

## Field-Level Findings

### `Contact_ID`

- Written in `Admin.js:1055`
- Read indirectly via `Code.js:4431` because `Deal_ID` gating is used for CRM invoice decisions, not `Contact_ID`
- Runtime-critical today: no
- Recommendation: `SAFE_TO_DORMANT`

### `Deal_ID`

- Written in `Admin.js:1056`
- Read in `Code.js:4431` and `Code.js:4438`
- Runtime-critical today: yes, because invoice-eligibility logic checks it
- Recommendation: `ACTIVE_BLOCKER`

### `CRM_Response`

- Written in `Admin.js:1064` and `Admin.js:1079`
- No strong runtime read path found in current audited files
- Runtime-critical today: no
- Recommendation: `DELETE_LATER`

### `CRM_Email`

- Read in `Code.js:8533` only
- No write path found in current audited files
- Runtime-critical today: no
- Recommendation: `DELETE_LATER`

### `CRM_Invoice_Triggered`

- Read in `Admin.js:1685` and `Code.js:4439`
- Written in `Admin.js:1702` / `1705`
- Runtime-critical today: yes, prevents duplicate downstream invoice trigger behavior
- Recommendation: `ACTIVE_BLOCKER`

## Books References

- No direct operational Zoho Books integration code path was found in the allowed audited files
- “Books” currently appears as planning/documentation context, not a live runtime dependency in these code paths
- Pre-Books cleanup should therefore treat payment/invoice behavior as portal-owned workflow plus external webhook assumptions, not as completed Books integration

## Quarantine Notes

- `ACTIVE_BLOCKER`
  - `crm_syncOnPaymentVerified_`
  - `handleInvoiceTrigger_`
  - `runVerificationAutomations_`
  - `deriveFodeCrmStageFromRow_`
  - `shouldCreateFodeCrmInvoice_`
  - `Deal_ID`
  - `CRM_Invoice_Triggered`
- `SAFE_TO_DORMANT`
  - direct Zoho OAuth and upsert helpers while the feature flag stays off
  - `triggerCrmDealForFode_`
- `COMPATIBILITY_READ_ONLY`
  - stage derivation payload helpers and UI surface references that still describe or gate current workflow
- `DELETE_LATER`
  - `CRM_Response`
  - `CRM_Email`
  - explanatory portal comments once cleanup is complete

## Cleanup Risk

- The main risk is assuming “CRM disabled” means “CRM irrelevant.” That is false here because invoice gating and payment-stage semantics still depend on CRM-era fields and helpers.
