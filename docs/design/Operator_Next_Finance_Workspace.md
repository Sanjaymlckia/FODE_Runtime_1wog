# Operator Next Finance Workspace

Status: M2 local foundation.

The Finance route now consumes `admin_getCanonicalFinanceWorklist({ page: 1, pageSize: 50 })`.

It displays:

- Payment Pending
- Payment to Verify
- Paid Verified
- Payment Follow-up
- Finance Exceptions
- policy-dependent future buckets

The route remains read-only. Finance rows hand off to the existing Review Workspace for applicant-level inspection and any approved mutation. It does not verify payment, create invoices, write Books objects, or send communications.

The route labels incomplete states:

- `POLICY REQUIRED`
- `WORKFLOW PENDING`
- `Receipt_Status` as payment authority
- Books as external integration metadata
