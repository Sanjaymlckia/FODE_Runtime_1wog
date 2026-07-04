# Authority Model

Status: r301+ architecture sync
Scope: documentation only

## Principle

Authority means the canonical source of truth for a domain decision.

Do not collapse separate authorities into one state. Do not let UI labels become authority.

## Current Authority Map

| Domain | Canonical Authority | Notes |
|---|---|---|
| Intake row facts | Sheet row fields | Raw row facts remain input, not final interpretation. |
| Intake source | FormDesigner currently, Google Forms future | FormDesigner remains protected live until replacement is proven. |
| Document completeness | `adminOpsRequiredDocumentUploadSummary_()` | Determines whether mandatory upload evidence exists. |
| Document review | `computeDocVerificationStatus_()` | Determines officer review status of supplied documents. |
| Document file access | Signed per-file routes | Raw Drive IDs/URLs must not be exposed as UI authority. |
| Preview/gallery | Applicant-folder `FODE_PREVIEW` renditions | Derived evidence only; originals remain source of truth. |
| Payment verification | Admin/payment authority fields, with `Receipt_Status` as canonical payment signal where available | `Payment_Verified` remains compatibility/mirror in current model. |
| Zoho Books | Backend Zoho preview/draft/test gates | Protected payment-adjacent workflow; not lifecycle or classroom authority. |
| Communication state | Last contact fields, email status fields, cooldown/idempotency logic | Communication truth is separate from lifecycle. |
| Communication semantics | H1-H5 semantic registry and template definitions | Message type is separate from delivery mode; planned types remain inert until approved. |
| Stage Batch preview | Preview authority/cache and candidate hash/parity | Visible preview is required before send. |
| Send authority | Backend send validation | Validates role, preview, caps, cooldown, idempotency, confirmation, and logging. |
| Enrollment/classroom | Enrollment and classroom handover fields | Partial/future authority; must not be inferred from payment alone. |
| Contactability | Row-readable communication/failure evidence only | Bounce evidence is partial/future until ingestion/manual marking is approved. |
| LAP automation | Stage resolver and automation scaffolds | Partial/future; scheduled action authority is not broadly active. |
| Population Ledger | `buildPopulationLedgerFromValues_()` / `admin_getPopulationLedger()` | Read-only exactly-once applicant population accounting. |
| Operator actionability | Operator Actionability Resolver | Derived/read-only/non-authoritative. |

## Important Distinctions

| Distinction | Rule |
|---|---|
| Completeness vs review | Complete means required files supplied. Review means officer checked acceptability. |
| Lifecycle vs urgency | Lifecycle says state. Urgency says how strongly action is needed. |
| Population vs visible worklist | Population Ledger counts every ApplicantID row. Operations Workspace visible rows are a limited worklist window. |
| Review Queues vs population authority | Review Queues are compatibility/workflow queues. They do not account for the applicant population. |
| Queue visibility vs send eligibility | Review queue rows are compatibility workflow visibility. Stage Batch Preview determines mail eligibility. |
| Recommendation vs send authority | Actionability recommends. Preview selects. Send validates. |
| OPS vs authority | OPS must not create a separate authority system. |
| Preview vs original document | Preview is derived evidence. Original canonical file remains the document source of truth. |
| Zoho vs payment authority | Zoho draft/preview activity does not itself verify payment. |
| Contactability vs sent status | Sent status alone is not proof of contactability where failure evidence exists. |

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

## Protected Authority Surfaces

The following are protected live surfaces for F2/F3 planning:

- document verification and `Docs_Verified` rollup
- payment verification and Zoho Books
- signed document routes
- preview/gallery/lightbox
- communication registry, selected-applicant templates, and Stage Batch separation
- runtime identity and release governance
- DR tooling
- FormDesigner intake and canonicalization

OPS remains protected frozen. Google Forms replacement, LAP automation, classroom handover, contactability ingestion, and AI precheck remain future or partial surfaces, not archive candidates.
