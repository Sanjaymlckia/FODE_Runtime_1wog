# Books Integration Authority

Status: M2 boundary documentation.

Zoho Books is an external accounting system. Runtime issues controlled instructions and stores integration metadata. Books owns accounting execution.

| Object | Runtime Owns | Books Owns | Sync Direction |
| --- | --- | --- | --- |
| Contact/customer | applicant identity and payer intent | Books contact object | Runtime -> Books, then Books ID -> Runtime metadata |
| Quote | policy-dependent, not active authority | future external quote object if adopted | Owner decision required |
| Invoice | invoice request and idempotency reference | invoice number, status, accounting record | Runtime -> Books create; Books -> Runtime metadata |
| Payment | payment evidence and verification decision | accounting payment record | Owner decision required |
| Credit note | policy-dependent request | accounting credit note | Future |
| Refund | policy-dependent request | accounting refund execution | Future |
| Balance | unresolved in runtime until policy and sync exist | accounting balance | Future/read-only |

Books fields must not determine `Receipt_Status`, lifecycle, Actionability, or Communication Authority.
