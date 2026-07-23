# EduOps Operations Preview Lab

FODE-specific local preview utility for the EduOps Operations Workspace.

This lab is read-only. It does not change Admin, Student, production data, Sheets, Drive, finance, documents, Portal, Books, WhatsApp or communications.

## Start

```cmd
tools\eduops-operations-preview\START_EDUOPS_OPERATIONS_PREVIEW.cmd
```

Open:

```text
http://127.0.0.1:4183/
```

Use the mode selector to compare:

- Accepted R367 baseline
- Proposed R368 redesign

## Capture A Fresh Snapshot

```cmd
tools\eduops-operations-preview\CAPTURE_FRESH_EDUOPS_OPERATIONS_SNAPSHOT.cmd
```

The capture command uses the dedicated authenticated Admin browser profile and only calls read-only RPC methods. It requires Admin to resolve to the configured expected runtime identity.

If live capture is unavailable, the preview server can bootstrap from the accepted R367 read-only reconciliation evidence and write `snapshots/current/snapshot.json`.

## Owner Review Focus

- Primary actionability buckets remain the accounting partition.
- Granular work packages become the practical operator queues.
- The preview renders inside a reproduction of the accepted dark Admin shell.
- `FODE:READY:DOCUMENT_FOLLOW_UP` is labelled `Missing documents - applicant follow-up due`.
- `FODE:REVIEW_REQUIRED:DOCUMENT_FOLLOW_UP` is labelled `Missing documents - review decision required`.
- Waffi is findable through `Ready for action -> Payment follow-ups due`, global search and ApplicantID search.
- Batch communication is preview-only; send is disabled.

## Evidence

R368 evidence is written under:

```text
tools\eduops-operations-preview\evidence\generated\
```

## Validation

```cmd
node tools\eduops-operations-preview\tests\validate-r368-preview.js
node tools\eduops-operations-preview\tests\capture-r368-screenshots.js
node tools\eduops-operations-preview\tests\validate-r368a-preview.js
node tools\eduops-operations-preview\tests\capture-r368a-screenshots.js
```
