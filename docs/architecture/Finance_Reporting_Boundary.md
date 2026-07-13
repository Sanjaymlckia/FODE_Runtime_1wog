# Finance Reporting Boundary

Status: M2 local foundation.

Implemented reports are read-only and source-labelled:

- Finance population by canonical state
- Payment Pending
- Payment to Verify
- Paid Verified
- Finance exceptions
- Payment Follow-up recommendation
- Reconciliation drift
- Amount completeness

Reports must not show financial totals unless the source field, currency, and completeness status are explicit.

Future reports require owner policy and/or Books synchronization:

- invoiced value
- collected value
- outstanding balance
- overdue ageing
- instalment performance
- refunds
- credits
- discounts and waivers
- Books sync health

Every Finance report must expose:

- authority source
- as-of time
- completeness
- unresolved records
- currency
- exclusions
