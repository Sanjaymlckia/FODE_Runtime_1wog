# Operator Review Workspace Model v01

Status: draft model  
Scope: architecture/design only  
Runtime impact: none

## Purpose

Define the target selected-applicant workspace for Legacy Admin document review and applicant communication.

The workspace is not a new authority. It is an operator surface over existing authorities.

## Core Flow

```text
Review Queues
-> Review
-> Selected Applicant Workspace
-> Inspect Documents
-> Record Officer Decisions
-> Review Recommended Communication
-> Preview
-> Confirm/Send if authorized
```

## Authority Boundary

| Concern | Authority |
|---|---|
| Mandatory upload completeness | `adminOpsRequiredDocumentUploadSummary_()` |
| Document review | `computeDocVerificationStatus_()` and per-document status/comment fields |
| Payment verification | payment authority fields and payment handlers |
| Communication recommendation | Operator Actionability Resolver, derived/read-only |
| Communication preview | `admin_previewApplicantMessage` |
| Communication send | `admin_sendApplicantMessage` / Send Authority |

The workspace may display and request actions. It must not create new truth.

## Workspace Sections

### Applicant Header

Must show before any action:

- Applicant ID
- full name
- effective email
- phone
- lifecycle/actionability state
- document state
- payment state
- recommended next action

### Document Review Area

Required behavior:

- show required documents first;
- keep 4-5 document cards/tabs visible with minimal scrolling;
- show Open and Download for every uploaded document;
- show Preview only when supported/reliable;
- show file present/missing state clearly;
- keep correction notes near the document they apply to.

Recommended card fields:

- document label
- file status
- upload date if available
- file type if available
- preview availability
- quality/precheck flags when available
- status decision
- correction note

### Decision Controls

Per document:

- Accept
- Needs Correction
- Unclear
- Wrong Document

Final summary:

- all required accepted
- corrections required
- unresolved/unclear
- recommended communication

### Communication Area

Recommended pattern:

```text
state-derived recommendation
-> editable draft
-> preview
-> confirmation
-> backend send
```

The operator should see one recommended message by default, with small alternate message buttons.

Custom email remains an override, not the primary path.

## Preview/Open/Download Hierarchy

1. Inline preview when supported.
2. Open in new tab.
3. Download.
4. Preview unavailable message with reason.

Open and Download must remain available even when inline preview fails.

## Non-Goals

The workspace must not:

- alter queue membership;
- create batch send authority;
- use search results as send authority;
- replace document/payment/lifecycle authorities;
- allow AI/precheck output to decide final state;
- send without preview and confirmation.

## Acceptance Principles

The operator should be able to answer within 5-10 seconds:

- who is this applicant?
- what documents are present?
- what is missing or wrong?
- what should happen next?
- should communication be sent?
- what exactly will be sent?
