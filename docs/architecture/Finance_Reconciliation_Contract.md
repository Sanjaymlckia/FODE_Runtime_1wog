# Finance Reconciliation Contract

Status: M2 local foundation.

Finance reconciliation is read-only. It compares canonical Finance DTOs with current source fields and reports drift; it never repairs data.

## Initial Codes

| Code | Meaning |
| --- | --- |
| `PAYMENT_PENDING_CONSISTENT` | Payment remains outstanding with no receipt evidence. |
| `PAYMENT_TO_VERIFY_CONSISTENT` | Receipt evidence exists and awaits verification. |
| `PAID_VERIFIED_CONSISTENT` | Canonical receipt status verifies payment. |
| `PAYMENT_VERIFIED_COMPATIBILITY_DRIFT` | Raw `Payment_Verified` says yes while canonical receipt authority does not. |
| `AMOUNT_DATA_INCOMPLETE` | Amount fields are missing, invalid, or unresolved. |
| `LIFECYCLE_FINANCE_MISMATCH` | Canonical lifecycle and finance state disagree. |
| `ACTIONABILITY_FINANCE_MISMATCH` | Workload projection and finance state disagree. |

## Operator Action

Reconciliation returns:

- `status`
- `severity`
- `applicantId`
- `rowNumber`
- `codes`
- `actualValues`
- `recommendedOperatorAction`
- `mutationRoute`
- `ownerPolicyRequired`

Mutation routes are labels only. They do not execute from reconciliation.
