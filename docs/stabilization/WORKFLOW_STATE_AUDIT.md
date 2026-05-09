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

## Semantic Authority Classification

### Authoritative workflow fields

- `Receipt_Status`
- `Doc_Verification_Status`
- `Portal_Access_Status`
- `Portal_Submitted`
- `PortalTokenIssuedAt`
- `Email_Status`
- `Email_Bounce_Flag`
- `Email_Next_Action_Date`

### Derived workflow fields

- `Payment_Verified`
- `Docs_Verified`
- `Payment_Badge`
- `PortalTokenAgeDays`
- `PortalTokenExpired`
- `Effective_Email`
- `Payment_Received`
- `Enrolled_Confirmed`

### Contradictory workflow fields

- `Receipt_Status` versus `Payment_Verified`
- `Doc_Verification_Status` versus `Docs_Verified`
- `Portal_Access_Status` versus computed portal lock state
- `Parent_Email` versus `Parent_Email_Corrected` when send eligibility is evaluated

### Deprecated CRM-era semantics

- `Contact_ID`
- `Deal_ID`
- `CRM_Response`
- CRM stage derivation paths that remain in source while `ENABLE_FODE_CRM_PIPELINE = false`

### Payment-state conflicts

- receipt verification is the richer operational signal, but compatibility code still mirrors `Payment_Verified`
- invoice-trigger eligibility can depend on payment-derived stage logic, so payment truth is spread across more than one field family

### Communication-state conflicts

- communication readiness depends on both email-state fields and corrected/raw email precedence
- bounce exclusion and retry eligibility are split across `Email_Status`, `Email_Bounce_Flag`, `Email_Bounce_Reason`, and `Email_Next_Action_Date`

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

## Proposed Payment Lifecycle Mapping

Proposal only. No schema mutation is authorized.

| Proposed lifecycle | Existing field signals | Notes |
| --- | --- | --- |
| `NOT_STARTED` | no `Fee_Receipt_File`, blank `Receipt_Status`, blank/false `Payment_Verified` | No payment evidence yet |
| `RECEIPT_UPLOADED` | `Fee_Receipt_File` present, `Receipt_Status` blank or pending | Evidence exists but not yet reviewed |
| `UNDER_REVIEW` | `Receipt_Status` indicates pending/review state, `Payment_Verified` not yes | Human review in progress |
| `VERIFIED` | `Receipt_Status = Verified` or derived payment badge = `Verified`; `Payment_Verified` usually mirrored to `Yes` | Canonical paid state |
| `REJECTED` | `Receipt_Status = Rejected` or equivalent negative review state | Payment evidence reviewed and rejected |
| `WAIVED` | no current canonical field | Future semantic state only; would require explicit authorization later |

## Triggerless Workflow Review

### Code assumptions expecting triggers

- trigger status/inspection is still surfaced in `admin_getOperationalSafetyStatus()`
- `getAutomatedStageRunnerStatus_()` assumes trigger inspection remains observable even when no trigger is installed
- source still contains install/remove code paths and `everyMinutes(10)` cadence assumptions

### Queue paths depending on automation

- stage batch preview and send flows still model cohorts as part of an automation family
- preview/send parity logic assumes a cached preview snapshot before send
- queue panels and runtime safety panels continue to expose trigger and automation state even in manual-only operation

### Admin actions safe for manual operation

- WhatsApp fallback CSV export queue
- review queues and record review actions
- preview-only batch review flows
- manual single-send probe controls where separately authorized
- document verification and portal access review actions

### Hidden scheduled behavior assumptions

- trigger cadence remains encoded as 10 minutes in helper functions
- last-run status and daily counters remain part of operational safety output
- preview/send messaging still references automation lineage even when the trigger is deleted

## Intake Integrity Findings

### Attachment persistence risks

- upload flow writes file URLs into `*_File` fields and appends `File_Log`, but Drive/file success and sheet write success are still separate steps
- rollback of code does not roll back Drive artifacts already created

### Folder-without-file scenarios

- source explicitly allows applicant folder creation before a successful final file write
- `Folder_Url` can therefore exist even when a particular required file is missing
- delete flow can remove a URL from the sheet without always trashing the Drive file if folder lineage cannot be proven

### FD upload assumptions

- activation/intake paths assume folder creation, canonical file normalization, and row verification happen in sequence
- some helper flows still depend on payload/header combinations such as `FormID`/`FD_FormID`
- multipart portal upload handling assumes browser-submitted form payload integrity and can fail with empty postdata or missing identifiers

### Required future integrity checks

- periodic audit for `Folder_Url` present but required `*_File` fields missing
- periodic audit for `*_File` URLs that no longer resolve to Drive files in the applicant folder chain
- intake/activation audit for rows missing `PortalTokenHash` or `PortalTokenIssuedAt`
- cross-check for payment receipt file presence versus `Receipt_Status` and `Payment_Verified` divergence

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
