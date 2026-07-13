# Canonical Finance Authority

Status: M2 authority-convergence implementation under local validation. No live release in this CIS.

## Authority Chain

Authoritative applicant/payment records -> Canonical Finance state resolver -> Canonical Lifecycle -> Actionability -> Canonical Population composition -> Finance Workspace / Review Workspace handoff.

The Finance UI is a work surface. It does not verify payment, calculate institutional policy, or create accounting objects.

## Canonical Truth

| Concept | Authority |
| --- | --- |
| Payment verification | `Receipt_Status` and canonical payment helpers |
| Raw compatibility flag | `Payment_Verified` |
| Receipt evidence | `Fee_Receipt_File` plus receipt status fields |
| Books contact/invoice metadata | External integration metadata |
| Runtime workload | Canonical Lifecycle and Actionability |
| Communication | Communication Authority |

`Payment_Verified` remains a compatibility mirror. Books fields do not advance lifecycle, suppress payment follow-up, or verify payment.

## DTO

Schema: `CANONICAL_FINANCE_V1`

Implemented sections:

- `identity`
- `financeAuthority`
- `amounts`
- `objects`
- `paymentPlan`
- `exceptions`
- `operational`
- `audit`

Amounts distinguish `VALUE`, `ZERO`, `BLANK`, `UNAVAILABLE`, `INVALID`, and `UNRESOLVED`. Unknown amounts are represented as `null`, never as invented zero.

## Implemented States

| State | Source |
| --- | --- |
| `PAYMENT_PENDING` | no canonical verified receipt and no receipt evidence |
| `PAYMENT_TO_VERIFY` | receipt evidence exists but canonical payment is not verified |
| `PAID_VERIFIED` | canonical payment helper verifies `Receipt_Status` |

`resolveCanonicalFinanceState_()` is the shared payment-state projection used by Canonical Finance and Actionability. `CANONICAL_POPULATION_V1` delegates its `finance` section to `resolveCanonicalFinance_()` and does not retain a second simplified payment-state resolver.

Payment obligation, evidence, and verification are separate:

- `Fee_Receipt_File` is the explicit payment-proof field allowlist. It establishes evidence only when `hasUploadEvidence_()` resolves an actual file reference; placeholders such as `[]` are empty.
- `Receipt_Status` and canonical payment helpers establish whether payment is verified.
- Portal/application submission, ordinary document uploads, communication history, quotes, invoices, and Books metadata are not payment proof.
- A sent `payment_followup` leaves Finance in `PAYMENT_PENDING`; Actionability may independently project `COOLING_OFF` or `AWAITING_APPLICANT` and make the row non-selectable until its next-action condition expires.
- Missing amount fields remain unresolved/null and do not alter evidence or verification state.
- `PAID_VERIFIED` clears only the Finance gate. Admission/enrolment and Classroom readiness remain separate downstream decisions.

## Read-only Worklist Contract

The Finance worklist is server-paged and server-filtered. The default page size is 50 and the maximum is 100; 50 is not a worklist cap. Responses expose `totalCount`, `filteredCount`, `page`, `pageSize`, `hasNext`, `hasPrevious`, `sortKey`, `appliedFilters`, `searchQuery`, and narrow worklist rows. Exact Applicant ID detail uses `admin_getCanonicalFinanceApplicant()` independently of the current page.

Search spans the full canonical Finance population and includes available Applicant ID, name, email, phone, Finance state, `Receipt_Status`, worklist, and exception/reconciliation tokens. Routine pages omit full amount source maps, payment-plan details, and other applicant-detail fields.

## Policy-Dependent States

The following are not active authority until owner policy and persistence exist:

- `PARTIALLY_PAID`
- `OVERDUE`
- `DISPUTED`
- `CREDIT_BALANCE`
- `REFUND_PENDING`
- `REFUNDED`
- `WAIVED`
- `CANCELLED`
- `WRITTEN_OFF`

## Owner Decisions

- What evidence constitutes payment received.
- Whether maker-checker separation is required.
- Whether partial payment permits lifecycle progression.
- Instalment schedules, grace periods, and overdue definitions.
- Refund, credit, waiver, discount, and write-off authority.
- Books-vs-runtime ownership for quotes, invoices, payments, refunds, and credits.
