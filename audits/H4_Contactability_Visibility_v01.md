# H4 Contactability Visibility

## Classification

- Release track: Track H
- Result: Phase 1 only
- Runtime implementation: stopped by the Phase 1 authority gate
- Deployment: none

## Finding

The runtime can represent and enforce contactability failure only when evidence is already present in runtime-readable row fields. It cannot currently infer the known Gmail failure for `FODE-26-003157` from the row data available to Admin.

The known Gmail evidence is:

- Applicant: `FODE-26-003157`
- Email: `josiewabby27@gmail.com`
- Gmail failure: `550 5.1.1 NoSuchUser`

The live selected-applicant evidence observed on Admin staging showed:

- `Email_Status`: `SENT`
- `Email_Bounce_Flag`: empty/unknown
- `Email_Bounce_Reason`: empty/unknown
- `Last_Contact_Result`: `SENT`
- no contactability warning

Therefore the known Gmail bounce is not currently linked to this applicant through runtime-readable row state.

## Runtime-Readable Sources

The selected-applicant detail payload reads:

- `Parent_Email`
- `Parent_Email_Corrected`
- `Email_Status`
- `Email_Verification_Status`
- `Email_Bounce_Flag`
- `Email_Bounce_Reason`
- `Email_Next_Action_Date`
- `Last_Email_Error`
- `Last_Email_To`
- `Last_Contacted_At`
- `Last_Contact_Type`
- `Last_Contact_Result`

Existing send and preview authority already blocks or warns when these fields contain evidence such as:

- missing effective email
- `DO_NOT_CONTACT`
- bounce flag
- `BOUNCED` or `SUPPRESSED` verification status
- `BOUNCED` or `SUPPRESSED` last-contact result

The backend communication resolver also blocks when:

- there is no effective email;
- the effective email format is invalid;
- `Email_Bounce_Flag` is true;
- `Email_Status` or other durable row evidence represents a blocked state.

## Bounce Ingestion Status

The code contains Gmail bounce-ingestion support that can:

1. search Gmail delivery-failure messages;
2. classify temporary, hard, invalid, and blocked failures;
3. match by applicant ID or email;
4. update `Email_Bounce_Flag`, `Email_Bounce_Reason`, `Email_Status`, and retry state.

However:

- `CONFIG.ENABLE_BOUNCE_INGESTION` is currently `false`;
- Gmail evidence is not automatically available to ordinary selected-applicant reads;
- ingestion would write row state and Script Properties;
- H4 explicitly does not authorize Gmail ingestion or row mutation.

## Dashboard and Queue Derivations

### Email Failures

Counted when:

- `Email_Status` is `FAILED` or `BOUNCED`; or
- `Last_Contact_Result` is `FAILED`.

### FAILED

The displayed counter can include both:

- rows whose `Email_Status` is `FAILED`; and
- an additional increment where `Last_Contact_Result` is `FAILED`.

This explains the qualified label `FAILED (Status + Last Result)`.

### BOUNCED

Derived from row `Email_Status` and bounce fields. The bounce visibility summary counts rows with:

- `Email_Status = BOUNCED`;
- a recognized bounce flag; or
- a non-empty bounce reason.

### FALLBACK_PENDING

Derived directly from `Email_Status = FALLBACK_PENDING`.

### WhatsApp Fallback Queue

Rows qualify from runtime-readable evidence:

- bounced status or bounce flag;
- failed/fallback status;
- failed or blocked last-contact result;
- missing effective email; or
- syntactically invalid effective email.

The queue is advisory/manual. It does not send WhatsApp messages.

## Phase 1 Decision

Decision: **B - runtime-readable evidence does not exist for the reported applicant.**

The runtime has a valid evidence model, but the specific Gmail failure has not been ingested or manually recorded. Adding a new advisory helper or UI line would not make `FODE-26-003157` detectable and could create false confidence.

Phase 2 was not implemented.

## Recommended Next Implementation

Choose and separately authorize one evidence-authority path:

1. controlled manual contactability marking with actor, timestamp, reason, and audit evidence; or
2. controlled Gmail bounce ingestion with dry-run matching proof before row mutation.

After authoritative evidence is available, a small read-only advisory can classify:

- `CONTACTABLE`
- `UNKNOWN`
- `KNOWN_FAILED`
- `NO_EFFECTIVE_EMAIL`
- `MANUAL_FALLBACK_RECOMMENDED`

The advisory should remain non-authoritative and should not automatically send, mutate, or block until separately approved.

## Boundaries Preserved

- No Gmail ingestion
- No Gmail edits
- No row or Sheet mutation
- No Drive mutation
- No send
- No send blocking change
- No Stage Batch change
- No AdminUI change
- No planned type activation
- No production, Student, or OPS change
