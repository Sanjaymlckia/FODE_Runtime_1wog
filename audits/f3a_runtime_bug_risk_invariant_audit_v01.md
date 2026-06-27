# F3A Runtime Bug-Risk and Behavioural Invariant Audit v01

## Executive result

Result: PASS_WITH_WARNINGS

This audit reviewed r301+ runtime risk before any structural refactor. No runtime files were edited.

Recommendation: F3B should be tests-first. Do not begin broad refactor until the invariant tests listed below are added. The runtime is operationally stable, but several critical behaviours rely on mixed compatibility fields, Apps Script UI/RPC conventions, Drive side effects, cache/properties state, and manual release proof rather than automated invariants.

## Top bug-risk findings

| Priority | Area | Risk | Evidence | Impact | Recommended next action |
| --- | --- | --- | --- | --- | --- |
| P0 | AdminUI hydration / inline JS | Locally valid source can still fail deployed Apps Script inline parse/hydration. | Prior r278/r279/r280 failures; many direct `google.script.run` calls in `AdminUI.html`; no dedicated automated AdminUI inline parse/hydration gate in tests. | Admin dashboard can show build but stay `Runtime: loading...`. | Add AdminUI inline-script parse and RPC-name resolver test before refactor. |
| P0 | UI/RPC contract | Client calls can drift from server function names or response envelope shape. | `AdminUI.html` has many direct `google.script.run` call sites; only some RPCs are covered by targeted tests. | Runtime surfaces silently fail or leave loading states. | Add static test that extracts all `google.script.run` calls and proves server functions exist plus expected envelope handling. |
| P0 | Payment authority | `Receipt_Status`, `Payment_Verified`, queue status, and Zoho actions can diverge. | `Admin.js` still reads/writes both receipt/payment compatibility fields; historical audits note raw-vs-derived risk. | Applicant may appear in wrong payment stage or receive wrong payment communication. | Add payment authority fixture suite covering receipt-only, legacy `Payment_Verified`, both-present conflict, and missing receipt. |
| P0 | Send authority / placeholders | Operational templates now rely on placeholder blocking and selected/batch separation. | H1-H5 tests cover registry semantics, but not full UI preview/send envelope and Stage Batch end-to-end no-send invariants. | Wrong or incomplete email could be sent if a gate drifts. | Add no-send invariant tests for selected applicant, Stage Batch, placeholder validation, `custom_email` selected-only, and planned types. |
| P1 | Role gates | `isAdmin_`, `requireSuperAdmin_`, verifier checks, and operation-specific gates differ by surface. | Multiple admin RPCs use different access checks; existing verifier-role test is document-focused only. | Operator may gain or lose access inconsistently. | Add role matrix tests for document, payment, Zoho, portal reset, Stage Batch, communications, OPS, and property cleanup. |
| P1 | Preview/rendition race and quota paths | Preview generation creates Drive files and may race, duplicate, or hit quotas/timeouts. | Gallery/rendition tests cover authority and DTO safety; Drive runtime uses `createFile`, thumbnail fetch, and applicant-folder lookup. | Duplicate previews, slow review modal, or Drive quota failures. | Add fixture tests for existing preview reuse, concurrent request semantics, stale/missing preview recreation, and non-fatal conversion failure. |
| P1 | FormDesigner empty payload | Empty-document payload warning is backend-only and application creation continues. | D1Y.5 tests prove event condition; operator visibility and follow-up linkage are separate. | Risky rows may still require manual discovery if warning is not surfaced operationally. | Add invariant that warning event is logged with safe payload and appears in an operator review/report path before intake replacement. |
| P1 | Queue/lifecycle compatibility | Queue derivation mixes raw fields, computed document status, payment evidence, and lifecycle/actionability. | Tests cover document rollup and payment-stage routing, but not full lifecycle matrix. | Applicants can fall between queues or appear in misleading queues. | Add full queue fixture matrix across docs/payment/contactability/dropped states. |
| P1 | Portal token lifecycle | Portal reset/access/update paths are mutation-capable and security-sensitive. | Portal security is protected; F2 removed only editor diagnostics, not portal functions. Existing tests focus document routes more than portal lifecycle. | Broken portal links, unintended resets, or access leakage. | Add portal token lifecycle tests for reset, lock/unlock, expiry/hash, parent email correction, and no raw secret exposure. |
| P1 | Zoho dry-run/live boundaries | Zoho Books has dry-run, draft creation, OAuth properties, and test email paths. | Protected live surface; config flags and script properties control write behaviour. | Accidental live write/email or failed invoice workflow. | Add Zoho gate tests with script-property/config matrix and assert live write/test email require explicit enablement. |
| P2 | Cache/idempotency | Stage Batch, WhatsApp fallback, manual send probe, and preview caches depend on Apps Script cache state. | `CacheService` appears in send/preview/manual workflows. | Duplicate sends or stale previews after cache expiry. | Add cache-miss/replay/idempotency fixture tests. |
| P2 | Error leakage | Some RPCs return envelope errors; fatal route HTML and UI failure handlers may surface backend details. | `withEnvelope_`, route fatal rendering, and many failure handlers exist. | Internal implementation details may leak to operator/student UI. | Add sanitized-error invariant tests for portal, file, Admin RPC, and payment/Zoho failures. |

## Behavioural invariants that must never break

### Document verification

- Selecting a document status stores the UI-readable status value and not an internal route key.
- `Docs_Verified` becomes `Yes` only when all required document statuses are verified.
- Payment verification must not be changed by document status save.
- Missing required uploads cannot be marked verified.
- Optional receipt status must not block document verification unless explicitly made required.
- Multi-file document actions must use `sourceField` and `itemIndex`, not raw Drive IDs.
- Signed file routes must validate applicant, field, index, folder membership, expiry, and signature.
- Preview PNG generation must be derived/non-authoritative and must never replace the original file.

### Payment and Zoho

- `Receipt_Status` is the canonical receipt review signal where available.
- `Payment_Verified` remains compatibility/mirror only and must not imply classroom acceptance.
- Payment verification requires document authority unless a separately approved exception exists.
- Zoho draft/live/test-email paths must require explicit config and role gates.
- Missing fee receipt must keep the applicant out of payment-verified state.
- Payment actions must not send acceptance/enrolment language.

### Queues and lifecycle

- Documents to Verify is officer review workload, not send eligibility.
- Awaiting Payment requires docs verified, no payment verified, and no receipt evidence.
- Payments to Verify requires docs verified, receipt evidence, and no payment verified.
- Payment-First Anomalies must remain exception/blocker context.
- Stage aggregation/actionability must not override queue authority.
- Dropped/ineligible/fraud states must not be silently reintroduced into active send queues.

### Communications

- `custom_email` remains selected-applicant only and never batch-safe.
- Planned/manual types remain non-sendable until explicitly activated.
- Stage Batch mappings remain separate from selected-applicant templates.
- Unresolved `[ACTION REQUIRED: ...]` placeholders block send.
- Preview identity/hash/cache parity must be required before Stage Batch send.
- Send gates must enforce role, caps, cooldown, idempotency, confirmation, and audit logging.
- Contact fallback remains manual unless a future CIS approves automation.

### Intake and portal

- FormDesigner canonicalization must preserve originals and copy only into applicant folders.
- Empty payload warning must not block application creation or mutate Drive beyond normal canonicalization.
- Portal tokens must not expose raw secrets after issuance.
- Portal reset must require the documented role gate.
- Parent email correction must not silently alter unrelated contact fields.

### Security and permissions

- Raw Drive IDs, folder IDs, raw Drive URLs, and backend secrets must not be rendered in operator/student DTOs.
- Admin, document verifier, Super Admin, and OPS gates must remain distinct.
- Signed route access must not depend on client-supplied authority alone.
- Internal stack traces and backend exception details must not leak to student-facing UI.

### Apps Script operations

- Hot paths must avoid repeated full-sheet scans and repeated Drive calls.
- Drive conversion/backfill failures must be non-fatal unless the operation itself is explicitly a conversion job.
- Cache misses must fail safe.
- Trigger install/remove functions must remain gated and not run during normal operator use.
- Script Properties cleanup must never remove active send, preview, or release proof state without dry-run/confirmation.

## Missing tests

| Priority | Missing test | Purpose |
| --- | --- | --- |
| P0 | AdminUI inline-script parse/hydration gate | Prevent deployed `Invalid or unexpected token` regressions. |
| P0 | `google.script.run` RPC existence map | Prove every UI RPC has a server function. |
| P0 | RPC envelope compatibility test | Prove UI success/failure handling matches server envelope shapes. |
| P0 | Payment authority matrix | Cover `Receipt_Status`, `Payment_Verified`, receipt file, docs verified, and conflicts. |
| P0 | Selected-applicant send placeholder blocking | Prove `[ACTION REQUIRED]` blocks actual send paths. |
| P0 | Stage Batch no-send/send-gate matrix | Prove preview/cache/hash/role/caps/cooldown/idempotency gates. |
| P1 | Role matrix | Cover Admin, Super Admin, verifier, OPS, and unauthorized user for mutation-capable RPCs. |
| P1 | Portal token lifecycle | Cover reset, hash/secret exposure, expiry, lock/unlock, parent email correction. |
| P1 | Preview rendition race/reuse | Cover existing preview reuse, concurrent requests, stale preview, unsupported file, conversion failure. |
| P1 | Queue/lifecycle fixture matrix | Cover all review queues plus dropped/ineligible/contactability states. |
| P1 | Zoho gate matrix | Cover dry-run/live/draft/test-email/script-property combinations. |
| P1 | Sanitized error outputs | Cover Admin RPC, route fatal HTML, signed file route, portal, Zoho/payment errors. |
| P2 | Cache/idempotency expiry tests | Cover Stage Batch, manual send probe, WhatsApp fallback, and preview caches. |
| P2 | FormDesigner warning operator visibility | Prove empty payload warnings become actionable without automatic rejection/send. |

## Suspected bugs needing proof

| Area | Suspected issue | Why not fixed now |
| --- | --- | --- |
| AdminUI hydration | Inline Apps Script HTML escaping can break on strings that local Node cannot parse. | Needs tests-first gate, not ad hoc UI edits. |
| Queue/lifecycle | Compatibility fields may still disagree with computed stage/actionability in edge rows. | Needs fixture matrix before changing queue logic. |
| Payment/Zoho | Zoho draft/test email gates may not be fully covered by role/config tests. | Protected financial surface; prove before change. |
| Contactability | Known bounced/invalid contacts can display sent/no warning if bounce evidence is not row-readable. | H4 says data-source proof is required first. |
| Preview generation | Lazy/backfill/future-upload preview creation could duplicate under concurrent calls. | Needs controlled test harness; do not change Drive logic now. |
| Portal reset | Reset/link correction paths are mutation-capable and likely under-tested by role matrix. | Requires portal-specific invariant tests. |
| Error reporting | Some failure handlers may show internal backend messages. | Needs sanitized error test before changing text. |

## Low-risk quick-fix candidates

These are test or documentation fixes first, not runtime behaviour changes:

1. Add AdminUI inline-script parser and `https://`/template literal guard.
2. Add UI RPC extraction test.
3. Add payment authority fixture test table.
4. Add communication placeholder/send-blocking fixture tests.
5. Add route/DTO sanitized error tests.
6. Add role matrix tests for mutation-capable RPCs.
7. Add preview reuse/race fixture tests with mocked Drive.

## High-risk protected-surface items

Do not change without dedicated CIS, tests, and release proof:

- Zoho Books and payment verification.
- Document status save, `Docs_Verified`, queue rollup.
- Signed document routes and preview/gallery/lightbox.
- Communication registry, selected-applicant send, Stage Batch send.
- Portal token lifecycle and portal security.
- FormDesigner intake/canonicalization.
- LAP trigger/scaffold functions.
- OPS.
- Script Properties cleanup and trigger install/remove functions.

## Recommended F3B sequence

F3B should be tests-first:

1. Add static AdminUI inline parse and UI-to-server RPC map tests.
2. Add payment/queue/lifecycle fixture matrix.
3. Add communication send-gate and placeholder-blocking tests.
4. Add role matrix for mutation-capable RPCs.
5. Add portal token lifecycle/security tests.
6. Add preview rendition reuse/race/quota failure tests.
7. Only then choose small fixes for proven bugs.
8. Start structural refactor only after tests protect these invariants.

Refactor-first is blocked. Fixes-first is only appropriate for a reproduced P0 blocker with narrow evidence. The normal next slice should be tests-first.

## F3B decision

F3B should be `tests-first`.

Structural refactor is blocked until at least these invariants exist:

- AdminUI parse/RPC map.
- Payment authority matrix.
- Communication send-gate matrix.
- Role matrix.
- Portal token lifecycle.
- Queue/lifecycle fixture matrix.

## Safety confirmation

- Runtime files edited: No.
- Runtime deletion/archive/refactor: No.
- Apps Script push/version/repin/deployment: No.
- Sheet edits: No.
- Drive edits: No.
- Production touched: No.
- Student staging touched: No.
- OPS touched: No.
