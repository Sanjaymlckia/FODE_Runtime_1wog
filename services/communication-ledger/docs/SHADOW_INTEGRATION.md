# R390D controlled shadow integration

R390D records the result of the existing individual-send workflow in the durable communication ledger. The legacy FODE send remains the sole external-delivery authority. The shadow path never calls Gmail and never retries the legacy send.

## Frozen contract

All shadow requests use contract version `1.0`, `SHADOW_COMMUNICATION_RESULT`, and a stable `operationId`, `previewId`, `receiptId`, and idempotency key bound to the immutable individual preview. The request contains only fingerprints and operational metadata; recipient, subject, body, portal URLs, signing secrets, and database credentials are not sent to diagnostics or logs.

The ordering is: bind immutable preview → perform the existing legacy send once → capture the legacy result → submit one ledger shadow command → reconcile the ledger response. A timeout or uncertain response is never treated as proof that a second send is safe.

## Shadow lifecycle

`shadow_pending` means disabled or not yet submitted. A successful first ledger command is `shadow_recorded`; an idempotent replay is `shadow_replayed`; a conflicting reuse is `shadow_conflict`; rejected or unavailable configuration is `shadow_failed`; transport uncertainty is `shadow_delivery_unknown`; field mismatch is `shadow_reconciliation_required`; matching fields are `shadow_reconciled`.

Reconciliation compares operation, applicant, preview, receipt, channel, legacy outcome, and technical timestamp. Durable replay must not create another command, receipt, or event. The shadow event source is `shadow`; the legacy send remains authoritative for delivery outcome.

## Acceptance boundary

Local fixtures cover suppressed/no-send, rejected, successful individual, replay, conflict, timeout/unknown, unavailable, malformed response, stable identity, redaction, and no-second-send invariants. Staging acceptance remains limited to read-only or explicitly owner-authorised individual cases. Batch, Student, Production, Apps Script deployment, and live Gmail actions are outside this source pass.
