# Population Ledger Model

Status: implemented read-only authority
Scope: Admin runtime population accounting

## Purpose

The Population Ledger accounts for every `ApplicantID` row exactly once.

It is the shared read-only reconciliation layer for:

- Global Dashboard population totals
- Operations Workspace workload totals
- Lifecycle Map lifecycle totals
- integrity diagnostics

Review Queues are not Population Ledger authority.

## Contract

Each `ApplicantID` row maps to exactly one:

- `lifecycleState`
- `operationalBucket`
- `nextActionFamily`

If the row cannot be classified cleanly, it maps to `Unknown / Unclassified`.

The server response exposes:

- `scannedRows`
- `applicantIdRows`
- `classifiedRows`
- `unclassifiedRows`
- `duplicateApplicantIds`
- `lifecycleCounts`
- `operationalBucketCounts`
- `nextActionFamilyCounts`
- `unknownUnclassifiedCount`
- `sampleUnclassifiedRows`
- `integrityStatus`
- `integrityMessages`

`hiddenByLimit` is always `0` for the ledger because it is full-population, not a visible worklist window.

## Operational Buckets

The current mutually exclusive buckets are:

- `Applicant Action`
- `Admissions Review`
- `Finance`
- `Academic Admin`
- `Contactability Exceptions`
- `Management Exceptions`
- `Dormant`
- `Completed / No Action`
- `Unknown / Unclassified`

`Management Exceptions` is reserved for governance/manual/policy/escalation work.

`Contactability Exceptions` is a first-class operational bucket for contactability-gated rows such as `NO_EFFECTIVE_EMAIL` and `EMAIL_BLOCKED_OR_BOUNCED`.

## Runtime Boundary

The ledger is read-only.

It does not:

- write Sheet rows
- create Drive files
- send email or WhatsApp
- mutate lifecycle, document, payment, communication, Student, Production, or OPS state
- use Review Queue membership as population authority

## Implementation

Runtime functions:

- `admin_getPopulationLedger()`
- `buildPopulationLedgerFromValues_()`
- `populationLedgerClassifyRow_()`

The classifier reuses the existing actionability row resolver, then normalizes its output into mutually exclusive population buckets.

Dashboard consumers receive `populationLedgerPublicSummary_()` rather than row-level ledger entries.
