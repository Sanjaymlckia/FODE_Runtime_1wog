# S3B Send Ledger Design

## Status

- Phase: `S3B Email & Queue Safety Hardening`
- Schema change: deferred
- Deployment change: none
- Runtime mutation: none

## Why Deferred

- Current stabilization scope permits guardrails and shared idempotency normalization, but not sheet schema mutation.
- Existing send paths are heterogeneous: applicant manual send, stage-batch manual send, payment/document workflow notices, and historical campaign flows.
- A send ledger should be introduced only after CRM quarantine and intake integrity diagnostics are stable enough to avoid freezing contradictory semantics into durable storage.

## Proposed Durable Model

- Preferred option: dedicated `Send_Ledger` sheet tab
- Compatibility option: additive columns on the application sheet if a separate ledger is rejected for operator reasons
- Recommendation: use the dedicated ledger to avoid widening the hot application row and to keep replay evidence append-only

## Proposed Ledger Columns

- `Event_Ts`
- `ApplicantID`
- `FormID`
- `Recipient_Normalized`
- `Template_Type`
- `Send_Source`
- `Execution_Mode`
- `Idempotency_Key`
- `Preview_Request_Id`
- `Batch_Label`
- `Result`
- `Block_Code`
- `Error_Code`
- `Actor_Email`
- `Debug_Id`

## Event Types

- `APPLICANT_PREVIEW`
- `APPLICANT_SEND`
- `STAGE_BATCH_PREVIEW`
- `STAGE_BATCH_SEND`
- `PAYMENT_VERIFIED_NOTICE`
- `DOCS_VERIFIED_PAYMENT_REQUIRED`
- `PAYMENT_RECEIPT_ALERT`
- `UNATTENDED_SEND_BLOCK`

## Idempotency Model

- Shared key shape:
  `EMAIL::<stable_applicant_identity>::<template_type>::<normalized_recipient>::<stable_context>`
- Stable applicant identity priority:
  `ApplicantID` then `FormID` then explicit compatibility identity
- Recipient normalization:
  trim, lowercase, split on `,`/`;`, sort, join
- Stable context:
  use batch label, batch id, or explicit workflow source
- Explicitly excluded:
  timestamps, row scan order, and other volatile values

## Replay Policy

- Preview events do not mark durable send completion.
- Manual applicant send and manual stage-batch send must reject exact idempotency replays unless operator state changes first.
- Workflow notices should be blocked if the same idempotency key is already marked `SENT` or `BLOCKED_BY_POLICY`.
- Manual override must require explicit operator action plus a reason, not silent replay.

## Failure States

- `BLOCKED_BY_POLICY`
- `BLOCKED_ALREADY_PROCESSED`
- `FAILED_PROVIDER`
- `FAILED_VALIDATION`
- `FAILED_PARITY`
- `SENT`

## Manual Override Model

- Operator selects the applicant and send type again from Admin UI.
- Operator enters an override reason.
- Runtime records the override reason beside the replayed send event.
- Override does not clear historical ledger rows; it appends a new event.

## Current Gaps

- Payment/release workflow notices still rely on pre-existing workflow/property suppression rather than a unified durable ledger.
- Historical legacy campaign sends do not yet share one operator-visible replay ledger.
- Intake integrity contradictions can still affect eligibility decisions before a future diagnostics phase is completed.
