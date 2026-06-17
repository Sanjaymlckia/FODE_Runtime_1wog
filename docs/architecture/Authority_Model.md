# Authority Model

Status: r23B consolidation draft
Scope: documentation only

## Principle

Authority means the canonical source of truth for a domain decision.

Do not collapse separate authorities into one state. Do not let UI labels become authority.

## Current Authority Map

| Domain | Canonical Authority | Notes |
|---|---|---|
| Intake row facts | Sheet row fields | Raw row facts remain input, not final interpretation. |
| Document completeness | `adminOpsRequiredDocumentUploadSummary_()` | Determines whether mandatory upload evidence exists. |
| Document review | `computeDocVerificationStatus_()` | Determines officer review status of supplied documents. |
| Payment verification | Admin/payment authority fields, with `Receipt_Status` as canonical payment signal where available | `Payment_Verified` remains compatibility/mirror in current model. |
| Communication state | Last contact fields, email status fields, cooldown/idempotency logic | Communication truth is separate from lifecycle. |
| Stage Batch preview | Preview authority/cache and candidate hash/parity | Visible preview is required before send. |
| Send authority | Backend send validation | Validates role, preview, caps, cooldown, idempotency, confirmation, and logging. |
| Enrollment/classroom | Enrollment and classroom handover fields | Must not be inferred from payment alone. |
| Operator actionability | Operator Actionability Resolver | Derived/read-only/non-authoritative. |

## Important Distinctions

| Distinction | Rule |
|---|---|
| Completeness vs review | Complete means required files supplied. Review means officer checked acceptability. |
| Lifecycle vs urgency | Lifecycle says state. Urgency says how strongly action is needed. |
| Queue visibility vs send eligibility | Review queue rows are workload. Stage Batch Preview determines mail eligibility. |
| Recommendation vs send authority | Actionability recommends. Preview selects. Send validates. |
| OPS vs authority | OPS must not create a separate authority system. |

## Completeness Authority

Mandatory upload completeness is based on the current mandatory upload set:

- `Birth_ID_Passport_File`
- `Latest_School_Report_File`
- `Passport_Photo_File`

Future optional uploads must not block completeness unless they are explicitly added to the mandatory authority list.

## Review Authority

Document review remains separate from upload completeness.

Canonical review authority remains `computeDocVerificationStatus_()` until a separate CIS changes it.

## Compatibility Fields

Compatibility fields may remain for runtime stability, but should not be treated as new canonical authority without documentation.

Examples:

- `Docs_Verified`
- `Payment_Verified`
- legacy pipeline/status fields

