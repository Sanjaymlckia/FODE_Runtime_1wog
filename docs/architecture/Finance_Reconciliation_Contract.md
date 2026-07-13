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

## Convergence Invariant

For payment work, Canonical Lifecycle and Actionability consume the same `resolveCanonicalFinanceState_()` result:

| Canonical Finance | Lifecycle / Actionability | Communication recommendation |
| --- | --- | --- |
| `PAYMENT_PENDING` | `SEND_PAYMENT_REMINDER` / Payment Follow-up | `payment_followup` where other gates permit |
| `PAYMENT_TO_VERIFY` | `VERIFY_PAYMENT` / Payment Review | none |
| `PAID_VERIFIED` | no payment follow-up or verification work | none |

Amount incompleteness remains a separate reconciliation finding and cannot fabricate payment evidence, verification, or zero values.

The evidence contract accepts only a real upload reference in the approved `Fee_Receipt_File` field. Empty upload payloads such as `[]`, unrelated applicant documents, portal/application submission, communication history, quote/invoice state, and Books metadata do not move an applicant to `PAYMENT_TO_VERIFY`.

`PAYMENT_PENDING` describes Finance truth. A prior payment follow-up and future `Email_Next_Action_Date` describe operational waiting: the semantic recommendation remains `payment_followup`, while Actionability may return `COOLING_OFF` or `AWAITING_APPLICANT` with `selectable=false`.

Payment verification clears only the Finance gate. Canonical Lifecycle must still evaluate all admission/enrolment prerequisites, and Classroom readiness remains a separate downstream authority.
