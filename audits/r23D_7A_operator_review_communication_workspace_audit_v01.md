# r23D.7A Operator Review & Communication Workspace Design Audit

Status: design/audit only  
Baseline: r23D.6C, Admin staging @266  
Scope: no runtime changes, no deployment, no sends, no sheet edits

## Executive Summary

The safest next workflow is a selected-applicant workspace, not another queue or batch surface.

The operator should move from:

```text
Review Queues -> Review -> selected applicant workspace
```

to a workspace that shows identity, authority state, required documents, recommended next action, editable communication, preview, and send controls in one place.

The current portal already contains many required pieces, but they are scattered:

- Review Queues open the selected applicant modal through `review()` -> `openModal()`.
- Applicant detail includes `_docs` from `CONFIG.DOC_FIELDS`.
- Document Open/Download/Preview uses secure portal proxy URLs.
- Document decisions are saved through `admin_updateDocStatuses`.
- Communications use `admin_previewApplicantMessage` and `admin_sendApplicantMessage`.
- Actionability Preview provides derived recommendations but is not integrated into the selected-applicant decision surface.

Recommendation: implement the next work in three slices:

1. r23D.7B: Document preview reliability and document workspace layout.
2. r23D.7C: State-driven editable communication workspace.
3. r23D.7D: Advisory AI/pre-check prototype after document access is stable.

## Current Source Findings

| Area | Current source evidence | Finding |
|---|---|---|
| Review entry | `AdminUI.html`: `review()`, `openModal()` | Review opens a selected-applicant modal. This is the correct workflow anchor. |
| Applicant identity | `openModal(d)` sets `mTitle`, `mSub`, workflow strip, comm status | Identity exists but should be made more prominent before decisions. |
| Document data | `Admin.js`: applicant detail maps `CONFIG.DOC_FIELDS` into `detailObj._docs` | Document list already follows configured document authority. |
| Document display | `AdminUI.html`: `renderDocCards_()` | Current cards show label, Open, Download, Preview, status, comment, field map. |
| Preview method | `AdminUI.html`: `openDocPreview_()` iframe modal | Preview is embedded through an iframe. This is convenient but least reliable. |
| Open/Download | `renderDocCards_()` uses `fileProxyOpenUrl` / `fileProxyDownloadUrl` | Open/new-tab and Download are more reliable fallbacks than embedded preview. |
| Secure file links | `enrichDocsWithProxyUrls_()` and portal link lookup | Existing design avoids exposing raw Drive URLs in normal UI. |
| Document writes | `admin_updateDocStatuses` | Existing write authority is per selected applicant and should remain. |
| Communication preview | `admin_previewApplicantMessage` | Preview is server-side and non-sending. This is the correct gate. |
| Communication send | `admin_sendApplicantMessage` | Send is single-applicant, role gated, confirmation gated, and backend validated. |
| Editable email | `custom_email` and `application_feedback` | Editable drafts exist, but not yet state-driven around document decisions. |
| Batch send | Stage Batch Preview/Send | Must remain separate and must not be driven by search results or review rows. |

## Part A: Applicant Document Review Workspace

### Proposed Workspace Layout

Single selected-applicant workspace:

1. Applicant Header
   - Applicant ID
   - full name
   - effective email
   - phone
   - lifecycle/document/payment state
   - actionability recommendation

2. Multi-Document Review Area
   - required documents first
   - 4-5 document cards/tabs visible without deep scrolling
   - each card shows:
     - document label
     - file present/missing
     - file name if available
     - upload date if available
     - file type if available
     - preview status
     - Open
     - Download
     - Preview if available

3. Per-Document Decision Area
   - Accept
   - Needs Correction
   - Unclear
   - Wrong Document
   - correction note

4. Final Review Summary
   - all required accepted
   - corrections required
   - unresolved/unclear
   - recommended communication type

### Preview Reliability Findings

Current preview is iframe-based and therefore fragile.

Likely failure modes:

- Drive preview blocks or refuses iframe embedding.
- Apps Script proxy route may not return a browser-previewable content type.
- PDFs/images/docs behave differently in iframe.
- Large files or permission propagation delays can load slowly.
- Browser security headers may prevent embed even when open/download works.
- Secure token/proxy routing may be valid for Open/Download but still poor for iframe preview UX.

Open Document works more reliably because it lets Drive or the browser handle the file in its native viewer.

Download is most reliable because it bypasses embedded rendering and gives the operator the actual file.

### Recommended Fallback Hierarchy

Use this order:

1. Inline preview when known reliable for the file type.
2. Open in new tab through the secure proxy URL.
3. Download through the secure proxy URL.
4. Show "preview unavailable" with reason and keep decision controls blocked from final accept if file cannot be inspected.

Do not rely on iframe preview as the only review path.

### Embedded vs New Tab vs Dedicated Viewer

Recommended pattern:

- Use a document workspace with cards/tabs for orientation.
- Use embedded preview only for supported image/PDF cases.
- Use Open in new tab as the primary reliable inspection action.
- Use Download as the final fallback.
- Consider a dedicated viewer later only if proxy/content-type handling is stable.

### Data Writeback

Current fields can support the first pass:

- per-document status fields from `CONFIG.DOC_FIELDS`
- per-document comment fields from `CONFIG.DOC_FIELDS`
- `Docs_Verified`
- `Doc_Verification_Status`
- `Doc_Last_Verified_At`
- `Doc_Last_Verified_By`

Potential future fields, not required for r23D.7B:

- upload timestamp per document
- detected file type per document
- document precheck status per document
- precheck confidence/reason per document
- consolidated correction reason

Do not add fields until document preview reliability is solved.

## Part B: Communication Workspace

### Design

The communication workspace should be state-driven:

```text
selected applicant state
-> recommended message type
-> editable draft
-> preview
-> explicit confirmation
-> backend send
-> row-log result
```

The operator should not choose from a long template list by default. The default should be the recommended message for the current applicant state, with small alternate buttons.

Search results must remain read-only/navigation-only.

Stage Batch remains the only batch-send surface.

### Existing Custom Email Fit

Current `custom_email` is useful as an escape hatch, but it should not be the primary workflow.

Recommended placement:

- keep custom email available;
- label it as manual override;
- require preview before send;
- log exact `messageType`;
- prefer state-derived templates first.

### Required Message Types

| Message type | Trigger condition | Subject | Body intent | Required merge fields | Safety checks |
|---|---|---|---|---|---|
| `documents_received_under_review` | required uploads complete, officer review pending | FODE Documents Received - Under Review | Acknowledge receipt and set review expectation. | ApplicantID, name, portal link optional | Do not send if no effective email or DNC/bounce. |
| `documents_verified_payment_required` | documents accepted, payment evidence missing | FODE Documents Verified - Payment Required | Tell applicant documents are accepted and payment is next. | ApplicantID, name, fee/quote if available, portal/payment instructions | Require docs verified authority; no send if payment already verified. |
| `documents_need_correction` | one or more documents rejected/wrong/unclear | FODE Documents Need Correction | List correction notes and request re-upload. | ApplicantID, name, correction notes, portal link | Require correction note; preview must show exact requested corrections. |
| `payment_receipt_received` | payment receipt uploaded, finance review pending | FODE Payment Receipt Received - Verification Pending | Acknowledge receipt and explain finance review. | ApplicantID, name, receipt state | Do not send if payment already verified unless alternate message selected. |
| `payment_verified_next_step` | payment verified, enrolment/classroom next | FODE Payment Verified - Next Step | Tell applicant payment is verified and next operational step. | ApplicantID, name, next step | Require payment verified authority. |
| `application_accepted` | documents and payment authority satisfied, accepted/enrolment ready | FODE Application Accepted | Confirm acceptance and next steps. | ApplicantID, name, program/grade if available | Require final acceptance/enrolment authority, not actionability alone. |
| `delayed_review_update` | review overdue but not ready for correction/payment message | FODE Application Review Update | Apologize/update, no status change implied. | ApplicantID, name, current state | Must not imply approval. |
| `contact_details_problem` | email invalid/bounced/suppressed or phone needed | FODE Contact Details Need Correction | Request updated contact channel, if reachable by alternate path. | ApplicantID, name, known contact issue | Suppress email if effective email is invalid/bounced; route to phone/manual fallback. |

## Part C: Advisory AI/Pre-check Layer

AI/pre-check should be advisory only.

Allowed outputs:

- quality flags:
  - blurred
  - cropped/edge cut-off
  - low resolution
  - blank/near-blank
  - unsupported file
  - duplicate file
  - unreadable
- document type classification:
  - likely birth certificate/ID
  - passport
  - school document
  - payment receipt
  - unknown
- extracted fields:
  - applicant name
  - date of birth
  - parent/guardian name
  - issue date
  - receipt amount/reference
- confidence score
- reason
- recommendation:
  - likely OK
  - needs human attention

AI must never:

- accept a document
- reject a document
- verify payment
- enrol an applicant
- move lifecycle state
- send communication
- suppress communication by itself
- write authority fields without officer confirmation

## Part D: Implementation Sequence

### r23D.7B - Document Preview Reliability Fix

Objective: make document inspection reliable before improving communication.

Likely files:

- `AdminUI.html`
- `Admin.js` only if secure preview metadata or file-type metadata is required
- no schema changes in first slice

Risk: medium.

Acceptance tests:

- selected applicant opens reliably from Review Queue;
- all required document cards render;
- Open works for each uploaded document;
- Download works for each uploaded document;
- Preview either renders or clearly says unavailable;
- no raw Drive URLs exposed in normal UI;
- document decisions still save through existing authority only.

Rollback: repin Admin staging to previous accepted version.

### r23D.7C - State-Driven Communication Workspace

Objective: replace template hunting with recommended editable message flow.

Likely files:

- `AdminUI.html`
- `Admin.js` only if additional preview-only message types are added

Risk: medium-high because it touches communication UX, but send authority must remain unchanged.

Acceptance tests:

- recommended message type appears for selected applicant;
- editable body loads by default;
- alternate template buttons remain small and explicit;
- preview is required before send;
- send button remains disabled until preview is valid;
- exact message type is logged;
- no batch send is introduced.

Rollback: repin Admin staging to previous accepted version.

### r23D.7D - Advisory AI/Pre-check Prototype

Objective: add advisory precheck after document access is stable.

Likely files:

- new backend helper or service wrapper
- `AdminUI.html` display only
- no authority writes in prototype

Risk: medium-high due to cost, privacy, and false positives.

Acceptance tests:

- precheck is opt-in/read-only;
- output is labelled advisory;
- officer decision remains final;
- no lifecycle/document/payment field is changed by AI;
- raw file access path is auditable.

Rollback: disable/hide precheck panel and repin if needed.

## Direct Answers to Acceptance Questions

### Safest lowest-effort workflow

Review Queue -> Review -> selected-applicant workspace -> inspect documents -> record per-document decisions -> review recommended communication -> preview -> confirm/send only if appropriate.

### How to present 4-5 documents

Use compact tabs/cards in the selected-applicant workspace. Required documents first. Each card should expose status, note, preview/open/download, and precheck flags when available.

### Why current previews are unreliable

They depend on iframe rendering of secure file URLs. Browser, Drive, file type, proxy response, and permission behavior can all break iframe preview while Open/Download still work.

### Recommended fallback hierarchy

Preview if supported -> Open in new tab -> Download -> mark preview unavailable with reason.

### How to present recommended templates

Show one recommended editable draft by default. Provide small alternate message buttons. Do not make the operator choose from a long list first.

### How custom email fits

Keep as manual override, not default path. It must remain preview-first and logged as `custom_email`.

### What remains preview-first/operator-controlled

All communication sending, document decisions, payment decisions, enrolment, and any future AI advice.

### What AI should check

Quality, likely type, advisory extracted fields, confidence, reason, and recommendation. AI must not decide authority state.

### First implementation slice

r23D.7B document preview reliability should happen first because communication quality depends on reliable document inspection and correction notes.

### Main risks

- adding visual noise to the modal;
- weakening authority boundaries by letting recommendations feel authoritative;
- trusting iframe preview too much;
- creating message types before document decisions are reliable;
- accidentally coupling selected-applicant workflow to batch send or search results.

## No-Change Confirmation

No runtime files were edited for this audit. No deployment, version, repin, sheet edit, or send was performed.
