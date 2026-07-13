# Canonical Finance Authority

Status: M2 local foundation. No live release in this CIS.

## Authority Chain

Authoritative applicant/payment records -> Canonical Finance Resolver -> Canonical Lifecycle -> Actionability -> Finance Workspace / Review Workspace handoff.

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
