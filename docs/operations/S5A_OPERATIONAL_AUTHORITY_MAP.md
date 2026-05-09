# S5A Operational Authority Map

Date: 2026-05-09
Scope: authority and ownership model

## Authority Map

| Domain | Canonical Authority | Operator of Record | Notes |
| --- | --- | --- | --- |
| Intake data | Sheet | Admin / intake operator | The sheet is the record of truth for applicant state. |
| Documents | Drive | Intake operator / reviewer | File presence and quality are judged from Drive artifacts. |
| Payment verification | Admin | Admin verifier | Payment verification is explicit operator authority. |
| Finance | Books | Finance owner | Books is the future finance authority; no API implementation in this CIS. |
| CRM | Quarantined compatibility layer | None | CRM must not be treated as live operational authority. |
| Communications | Admin-controlled workflow | Admin / operator | Outbound actions are logged and must remain manually overridable. |

## Authority Rules

- Sheet state may inform downstream workflow, but does not override operator judgment.
- Drive file state may support review, but does not finalize admission.
- Admin payment verification is required before any payment-dependent downstream state.
- Books is the target finance authority for future architecture.
- CRM remains available only for compatibility, rollback evidence, and historical interpretation.

## Compatibility Boundaries

- `FormID` remains the stable intake identity.
- `FD_FormID` remains a legacy alias.
- `Contact_ID`, `Deal_ID`, `CRM_Response`, and `CRM_Invoice_Triggered` remain compatibility-only fields.
- `Payment_Verified` remains a compatibility mirror.
- `Receipt_Status` is the canonical payment authority field.

## Ownership Guidance

- Intake review belongs to intake operators and administrators.
- Document quality review belongs to reviewers, with AI allowed only for flagging or summarizing.
- Payment verification belongs to an authorized Admin operator.
- Finance logic belongs to the Books-native future design, not CRM.
- Communication execution belongs to approved workflow paths with explicit logging.

