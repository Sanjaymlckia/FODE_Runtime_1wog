# S1 CRM Dependency Map

Date: 2026-05-09
Scope: Source-only inventory of CRM and adjacent invoice-trigger logic

## Global Status

- `ENABLE_FODE_CRM_PIPELINE = false`
- `CRM_PUSH_DRY_RUN = true`
- CRM code remains present in source, but the feature flag keeps the primary CRM sync path inactive
- Invoice-trigger workflow is adjacent but distinct from the Zoho CRM sync path

## CRM Fields

| Field | Classification | Evidence |
| --- | --- | --- |
| `Contact_ID` | LEGACY_SAFE_TO_QUARANTINE | Written only by `crm_syncOnPaymentVerified_()` |
| `Deal_ID` | LEGACY_SAFE_TO_QUARANTINE | Written only by `crm_syncOnPaymentVerified_()` |
| `CRM_Response` | LEGACY_SAFE_TO_QUARANTINE | Written by CRM sync success/failure handlers |
| `CRM_Invoice_Triggered` | UNKNOWN | Used by invoice-trigger workflow, not direct CRM sync |
| `CRM_Email` | PASSIVE_FIELD | Referenced in duplicate/index helper logic only |
| `FormID` | ACTIVE_DEPENDENCY | Used as CRM dedupe field and broader integration identity |
| `FD_FormID` | LEGACY_SAFE_TO_QUARANTINE | Alternate/legacy form identifier alias |

## CRM Functions

| Function | Classification | Notes |
| --- | --- | --- |
| `getZohoToken_` | LEGACY_SAFE_TO_QUARANTINE | Refreshes Zoho OAuth token |
| `upsertZohoContact_` | LEGACY_SAFE_TO_QUARANTINE | Upserts Zoho contact |
| `upsertZohoDeal_` | LEGACY_SAFE_TO_QUARANTINE | Upserts Zoho deal |
| `buildCrmPayloadFromRow_` | UNKNOWN | Shared payload builder; integration utility still referenced |
| `deriveFodeCrmStageFromRow_` | UNKNOWN | Stage derivation helper |
| `shouldCreateFodeCrmDeal_` | UNKNOWN | Gated decision helper |
| `shouldCreateFodeCrmInvoice_` | UNKNOWN | Adjacent handoff decision helper |
| `triggerCrmDealForFode_` | LEGACY_SAFE_TO_QUARANTINE | Hard-gated by feature flag |
| `syncFodeCrmStage_` | LEGACY_SAFE_TO_QUARANTINE | Hard-gated by feature flag |
| `crm_syncOnPaymentVerified_` | LEGACY_SAFE_TO_QUARANTINE | Full CRM write path; currently disabled by feature flag |

## CRM Reads / Writes

### Reads

- Reads row state to derive CRM payload and stage
- Reads script properties for Zoho OAuth tokens and owner id
- Reads config for CRM pipeline/stage names

### Writes

- `crm_syncOnPaymentVerified_()` writes:
  - `Contact_ID`
  - `Deal_ID`
  - `CRM_Response`
- It also writes operational log events `ZOHO_OK` / `ZOHO_ERROR`
- No live CRM writes should occur while `ENABLE_FODE_CRM_PIPELINE` remains false

## CRM UI References

- No strong direct CRM control surface was found in `AdminUI.html`
- Admin UI does expose workflow outcomes that can include invoice-trigger results
- CRM remains predominantly a backend dependency, not an operator-facing live workflow

## Adjoining Non-CRM Integration Path

- `triggerInvoiceWebhook_()` is a separate handoff path from CRM sync
- `runVerificationAutomations_()` can set `actions.invoice`
- `CRM_Invoice_Triggered` is used by invoice gating and replay avoidance
- This makes `CRM_Invoice_Triggered` the least safe field to quarantine without a separate invoice/Books design review

## Classification Summary

- `ACTIVE_DEPENDENCY`
  - `FormID`
- `PASSIVE_FIELD`
  - `CRM_Email`
- `LEGACY_SAFE_TO_QUARANTINE`
  - `Contact_ID`
  - `Deal_ID`
  - `CRM_Response`
  - `getZohoToken_`
  - `upsertZohoContact_`
  - `upsertZohoDeal_`
  - `triggerCrmDealForFode_`
  - `syncFodeCrmStage_`
  - `crm_syncOnPaymentVerified_`
- `UNKNOWN`
  - `CRM_Invoice_Triggered`
  - `buildCrmPayloadFromRow_`
  - `deriveFodeCrmStageFromRow_`
  - `shouldCreateFodeCrmDeal_`
  - `shouldCreateFodeCrmInvoice_`

## Audit Conclusion

- The live student/admissions workflow is not currently dependent on active Zoho CRM writes
- The source still contains a recoverable CRM integration boundary, which is useful for rollback and historical interpretation
- Quarantine/removal planning should separate:
  - dormant Zoho CRM sync code
  - invoice/Books-adjacent workflow markers
  - shared identity fields such as `FormID`

## CRM Quarantine Plan

### Safe to ignore immediately

- `Contact_ID`
- `Deal_ID`
- `CRM_Response`
- `getZohoToken_()`
- `upsertZohoContact_()`
- `upsertZohoDeal_()`
- `triggerCrmDealForFode_()`
- `syncFodeCrmStage_()`
- `crm_syncOnPaymentVerified_()`

Rationale:
- these fields and functions are either direct CRM write artifacts or hard-gated by `ENABLE_FODE_CRM_PIPELINE = false`

### Requiring temporary compatibility

- `FormID`
- `FD_FormID`
- `CRM_Invoice_Triggered`
- any shared payload builder or stage-derivation helper still feeding non-CRM logic

Rationale:
- these still participate in identity, invoice gating, or transitional logic beyond pure CRM writes

### CRM write paths to disable later

- `crm_syncOnPaymentVerified_()`
- any caller that could re-enable or invoke Zoho token refresh and upsert paths
- residual admin save workflows that retain CRM sync result handling for compatibility

### CRM reads that currently influence runtime logic

- `FormID` as stable dedupe/handoff identity
- stage derivation helpers feeding invoice or downstream gating decisions
- `CRM_Invoice_Triggered` replay-avoidance logic

### Quarantine sequencing recommendation

1. Preserve compatibility fields and shared identity semantics.
2. Explicitly isolate CRM write functions behind a quarantine boundary in documentation first.
3. Audit invoice-trigger and Books-adjacent paths separately from CRM removal.
4. Remove dormant CRM writes only after non-CRM dependencies are proven absent under a future CIS.

## S4C Quarantine Update

- Intake path is clean: the controlled S4A applicant reached the sheet and Drive without populating `CRM_Response`, `Contact_ID`, `Deal_ID`, or `CRM_Invoice_Triggered`.
- Payment/invoice boundary is now treated as a legacy finance-handoff seam, not as a live CRM authority.
- CRM write helpers are now quarantined under `ENABLE_CRM_LEGACY_QUARANTINE = true`.
- Invoice webhook handoff is explicitly disabled under `ENABLE_INVOICE_WEBHOOK_HANDOFF = false`.
- `CRM_Invoice_Triggered` remains preserved as a compatibility marker only until a Books-native finance status replaces it.
- Next design step is Books-native finance architecture, not CRM reactivation.
