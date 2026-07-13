# Finance State Model

Status: M2 local foundation.

## Active States

| State | Active authority | Notes |
| --- | --- | --- |
| `PAYMENT_PENDING` | `Receipt_Status` plus receipt evidence check | Applicant has no verified payment and no receipt evidence. |
| `PAYMENT_TO_VERIFY` | receipt evidence present, canonical payment not verified | Review Workspace payment verification is the mutation route. |
| `PAID_VERIFIED` | canonical payment helper verifies `Receipt_Status` | Payment is verified for lifecycle/workload purposes. |
| `UNKNOWN` | resolver cannot classify from current facts | Exception/reconciliation state. |
| `INCONSISTENT` | contradictory source facts | Exception/reconciliation state. |

## Deferred States

These states are accepted architecture but are not active authority until policy and persistence are approved:

- `NOT_QUOTED`
- `QUOTED`
- `INVOICED`
- `PARTIALLY_PAID`
- `OVERDUE`
- `DISPUTED`
- `CREDIT_BALANCE`
- `REFUND_PENDING`
- `REFUNDED`
- `WAIVED`
- `CANCELLED`
- `WRITTEN_OFF`

## Policy Dependencies

- payment received definition
- receipt evidence sufficiency
- partial payment rules
- instalment schedules
- overdue and grace-period policy
- dispute suppression rules
- refund, credit, waiver, and write-off approval authority
- Books-vs-runtime ownership for accounting objects
