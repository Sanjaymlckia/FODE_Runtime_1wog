# CRM Quarantine

Date: 2026-05-09
Scope: S4C CRM quarantine and legacy isolation

## Why CRM Is Quarantined

- The live FODE workflow no longer treats Zoho CRM as an operational authority.
- S4A established that base FD intake did not create CRM artifacts.
- Current S4C evidence treats the payment/invoice boundary as the last historical CRM-era seam, while preserving triggerless/manual-first stabilization.
- CRM-era logic is therefore quarantined to prevent accidental network writes, legacy stage influence, or mistaken operator assumptions.

## What Remains Preserved

- Source code remains present for rollback evidence and historical traceability.
- Compatibility fields remain in sheet schema:
  - `FormID`
  - `FD_FormID`
  - `CRM_Invoice_Triggered`
  - `Contact_ID`
  - `Deal_ID`
  - `CRM_Response`
  - `CRM_Email`
- Existing runtime logs and stabilization docs remain the evidence trail for earlier CRM-era behavior.

## What Is Blocked

- Zoho OAuth token refresh
- Zoho contact upsert
- Zoho deal upsert
- payment-verified CRM sync
- CRM deal/stage trigger helpers
- invoice webhook handoff when `ENABLE_INVOICE_WEBHOOK_HANDOFF = false`

## Compatibility-Only Fields

- `Payment_Verified` remains compatibility-only beside canonical `Receipt_Status`.
- `CRM_Invoice_Triggered` remains a legacy compatibility marker only and must not be treated as a live finance authority.
- `Contact_ID`, `Deal_ID`, and `CRM_Response` remain historical compatibility artifacts only.

## Reactivation Conditions

CRM must remain quarantined unless a future CIS explicitly authorizes all of the following:

- a Books-native finance architecture decision
- a reviewed replacement for CRM-era invoice semantics
- explicit deployment authorization
- fresh rollback and acceptance criteria
- explicit approval to re-enable any external finance or CRM handoff

## Operational Warning

- CRM must not be treated as operational authority for live FODE workflow.
- Canonical runtime truth remains Admin/Student `?view=whoami` plus current stabilization docs.
- Any future finance integration must be introduced as a new, explicit authority model rather than by reviving CRM-era assumptions.
