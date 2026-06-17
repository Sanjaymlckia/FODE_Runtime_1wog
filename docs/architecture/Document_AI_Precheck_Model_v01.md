# Document AI Precheck Model v01

Status: draft model  
Scope: advisory design only  
Runtime impact: none

## Purpose

Define a future advisory document precheck layer that helps an officer inspect uploaded documents faster without replacing document authority.

## Authority Rule

AI/precheck is advisory only.

Officer/Admin remains the final document decision maker.

AI must never:

- accept a document;
- reject a document;
- verify documents;
- verify payment;
- enrol an applicant;
- move lifecycle state;
- send communication;
- suppress communication by itself;
- write authority fields without explicit officer action.

## Inputs

Potential inputs:

- uploaded file bytes or secure file access result;
- document field key;
- applicant ID;
- expected document type;
- current document status/comment;
- optional authority context for display only.

Do not expose raw sensitive links unnecessarily.

## Outputs

### Quality Flags

- blurred
- cropped/edge cut-off
- low resolution
- blank/near-blank
- unsupported file
- duplicate file
- unreadable

### Type Classification

- likely birth certificate/ID
- passport
- school document
- payment receipt
- unknown

### Extracted Fields

Advisory only:

- applicant name
- date of birth
- parent/guardian name
- issue date
- receipt amount/reference

### Assessment

- confidence score
- reason
- recommendation:
  - likely OK
  - needs human attention

## Display Rules

Show precheck output beside the document card:

- concise flag summary;
- confidence;
- reason;
- "Advisory only" label;
- officer decision controls remain separate.

## Governance

Precheck data must be treated as supporting evidence, not truth.

Before runtime implementation, decide:

- whether outputs are transient or stored;
- where any stored outputs live;
- retention policy;
- privacy and file-access logging;
- cost controls;
- failure behavior.

## Recommended Implementation Boundary

Prototype only after r23D.7B document access is stable.

First prototype should be:

- single applicant;
- single document at a time;
- read-only;
- no writes;
- no lifecycle changes;
- no communication changes.
