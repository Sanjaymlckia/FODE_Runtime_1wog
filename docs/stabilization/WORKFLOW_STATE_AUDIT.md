# S1 Workflow State Audit

Date: 2026-05-09
Scope: Source-only workflow state model for stabilization planning

## Payment Lifecycle Fields

| Field | Role | Notes |
| --- | --- | --- |
| `Fee_Receipt_File` | Payment evidence | Upload proves receipt artifact exists, not payment truth by itself |
| `Receipt_Status` | Payment verification control | Admin payment verification path writes `Verified` here |
| `Receipt_Comment` | Payment review note | Human review note |
| `Payment_Verified` | Compatibility mirror | Often derived from `Receipt_Status` or payment badge logic |
| `CRM_Invoice_Triggered` | Downstream handoff marker | Prevents duplicate invoice trigger path |

Observed lifecycle:
- Receipt uploaded
- Receipt reviewed
- `Receipt_Status` moves toward `Verified`
- `Payment_Verified` is mirrored/derived as `Yes`
- payment-triggered downstream actions may run

## Portal Lifecycle Fields

| Field | Role | Notes |
| --- | --- | --- |
| `Portal_Submitted` | Submission signal | Portal form submitted flag |
| `PortalLastUpdateAt` | Last portal write | Audit timestamp |
| `PortalTokenHash` | Secret hash | Working-sheet secret state |
| `PortalTokenIssuedAt` | Token age basis | Used for expiry and audit |
| `Portal_Access_Status` | Explicit access flag | Open/locked style field |
| `Folder_Url` | Drive artifact linkage | Portal-generated storage location |
| `File_Log` | File/upload trace | Upload log aggregation |

Observed lifecycle:
- Applicant row exists
- Portal token is issued or backfilled
- Portal remains open until payment/lock conditions close it
- Portal uploads and edits accumulate document state
- Portal submission marks record as submitted

## Document Verification Fields

Per-document status/comment pairs:
- `Birth_ID_Status` / `Birth_ID_Comment`
- `Report_Status` / `Report_Comment`
- `Transfer_Status` / `Transfer_Comment`
- `Photo_Status` / `Photo_Comment`
- `Receipt_Status` / `Receipt_Comment`

Rollup / audit fields:
- `Docs_Verified`
- `Doc_Verification_Status`
- `Doc_Last_Verified_At`
- `Doc_Last_Verified_By`

Observed lifecycle:
- Files uploaded
- Verifier reviews individual document statuses
- `Doc_Verification_Status` is computed / normalized
- `Docs_Verified` remains as a simpler compatibility flag
- audit actor/time fields are updated on admin writes

## Communication State Fields

| Field | Role | Notes |
| --- | --- | --- |
| `Parent_Email` | Original send target | Raw intake value |
| `Parent_Email_Corrected` | Corrected send target | Effective email preferred over raw |
| `Email_Status` | Send state | Core communication status |
| `Email_Last_Sent_At` | Last send timestamp | Campaign/send audit |
| `Email_Attempt_Count` | Retry counter | Campaign/send audit |
| `Email_Bounce_Flag` | Failure classification | Hard/domain/temp/unknown style state |
| `Email_Bounce_Reason` | Failure reason text | Human-readable cause |
| `Email_Next_Action_Date` | Retry gate | Determines eligibility for retries |
| `Email_Campaign_Batch` | Batch marker | Identifies send batch provenance |

## Contradictions Found

- `Docs_Verified` versus `Doc_Verification_Status`:
  - both represent document progression
  - source increasingly treats `Doc_Verification_Status` as the authoritative workflow stage
- `Payment_Verified` versus `Receipt_Status`:
  - both represent payment progression
  - source often derives payment truth from receipt verification and then mirrors to `Payment_Verified`
- `Portal_Access_Status` versus computed lock state:
  - one is stored state
  - one is derived from payment/token/runtime rules
- CRM lifecycle markers remain mixed into operational workflow even though CRM sync is feature-flagged off

## Proposed Canonical Lifecycle Model

Proposal only. No runtime mutation is authorized.

### Documents

`Pending` -> `Partial` -> `Verified` -> `Rejected`

Canonical field:
- `Doc_Verification_Status`

Compatibility mirrors to retain short-term:
- `Docs_Verified`

### Payment

`No Evidence` -> `Evidence Uploaded` -> `Verified` -> `Rejected`

Canonical field:
- `Receipt_Status`

Compatibility mirror to retain short-term:
- `Payment_Verified`

### Portal

`Not Issued` -> `Issued` -> `Open` -> `Submitted` -> `Locked`

Canonical fields:
- `PortalTokenIssuedAt`
- `Portal_Access_Status`
- `Portal_Submitted`

### Communication

`Unknown` -> `Ready` -> `Sent` -> `Bounced` -> `Retry Due` -> `Blocked`

Canonical fields:
- `Email_Status`
- `Email_Bounce_Flag`
- `Email_Next_Action_Date`

## Stabilization Recommendation

- Treat the richer stage fields as canonical during future cleanup:
  - `Doc_Verification_Status`
  - `Receipt_Status`
  - `Portal_Access_Status`
  - `Email_Status`
- Preserve compatibility fields until all read/write paths are audited:
  - `Docs_Verified`
  - `Payment_Verified`
