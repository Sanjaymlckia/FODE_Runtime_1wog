# Role Capability Matrix

## Authority

This document is the authoritative role-capability reference for Admin runtime operator accounts.

Principles:

- Role identity and capability assignment are separate.
- Backend RPC authorization is the final security boundary.
- UI may project capability state but must not invent a stricter or looser policy.
- Communication Authority, Canonical Lifecycle, and Actionability remain unchanged by this matrix.

## Configured Roles

Runtime config currently defines three role identities:

- `SUPER`
- `OPERATIONS`
- `VERIFIER`

Configured admin accounts:

| Email | Role | Notes |
| --- | --- | --- |
| `sanjay@minervacenters.com` | `SUPER` | Super Admin, runtime governance |
| `principal@kundu.ac` | `OPERATIONS` | Operational batch/admin surface |
| `operations@minervacenters.com` | `OPERATIONS` | Unified operational team account with batch/admin surface |
| `enquiries@kundu.ac` | `VERIFIER` | Review/document and individual communication workflow |
| `fode_kia@kundu.ac` | `VERIFIER` | Review/document workflow |
| `mlc@minervacenters.com` | `VERIFIER` | Review/document workflow |
| `mlccorporate@minervacenters.com` | `VERIFIER` | Review/document workflow |

Accounts referenced elsewhere in config or docs but not treated as configured operator roles:

- `fode@kundu.ac` - sender/admin recipient reference, not a configured runtime operator.
- `sanjay+fode-s4a-20260509182546@example.com` and `*.example.test` - test/reference only.

## Capability Definitions

| Capability | Meaning |
| --- | --- |
| `CAN_OPEN_REVIEW_WORKSPACE` | Open Review Workspace and inspect applicant detail |
| `CAN_REVIEW_DOCUMENTS` | Review document evidence and document-state facts |
| `CAN_SAVE_DOCUMENT_STATUSES` | Save document verification statuses |
| `CAN_EDIT_APPLICANT_COMMUNICATION` | Edit selected-applicant communication draft content |
| `CAN_PREVIEW_APPLICANT_COMMUNICATION` | Generate server-backed communication preview |
| `CAN_SEND_INDIVIDUAL_EMAIL` | Send one reviewed applicant email subject to Communication Authority |
| `CAN_SEND_INDIVIDUAL_WHATSAPP` | Direct single-applicant WhatsApp send capability |
| `CAN_INSERT_PORTAL_LINK` | Insert authoritative portal link into editable draft |
| `CAN_GENERATE_STANDARD_QUOTE` | Use deterministic approved quote communication path |
| `CAN_GENERATE_STANDARD_INVOICE` | Use deterministic approved invoice-generation path where implemented |
| `CAN_VERIFY_PAYMENT` | Verify canonical payment state |
| `CAN_RUN_BATCH_COMMUNICATIONS` | Preview/send bounded batch communication cohorts |
| `CAN_OVERRIDE_COOLDOWN` | Override protected cooldown gates where separately allowed |
| `CAN_APPROVE_FINANCIAL_OVERRIDE` | Approve discounts, credits, refunds, or exceptions |
| `CAN_MANAGE_PORTAL_ACCESS` | Mutate portal security/access state |
| `CAN_MANAGE_ROLES` | Manage runtime role assignments |
| `CAN_ADMINISTER_RUNTIME` | Runtime governance/administration capability |
| `CAN_DEPLOY_RUNTIME` | Runtime release/deployment capability |
| `CAN_WRITE_ZOHO_BOOKS` | Create/send controlled Zoho Books write actions |

Notes:

- No direct runtime WhatsApp send function is currently implemented. `CAN_SEND_INDIVIDUAL_WHATSAPP` remains unassigned.
- `CAN_GENERATE_STANDARD_QUOTE` is distinct from `CAN_APPROVE_FINANCIAL_OVERRIDE`.
- `CAN_WRITE_ZOHO_BOOKS` is a higher-risk integration capability separate from role identity.

## Role to Capability Matrix

| Capability | VERIFIER | OPERATIONS | SUPER |
| --- | --- | --- | --- |
| `CAN_OPEN_REVIEW_WORKSPACE` | Yes | Yes | Yes |
| `CAN_REVIEW_DOCUMENTS` | Yes | Yes | Yes |
| `CAN_SAVE_DOCUMENT_STATUSES` | Yes | Yes | Yes |
| `CAN_EDIT_APPLICANT_COMMUNICATION` | Yes | Yes | Yes |
| `CAN_PREVIEW_APPLICANT_COMMUNICATION` | Yes | Yes | Yes |
| `CAN_SEND_INDIVIDUAL_EMAIL` | Yes | Yes | Yes |
| `CAN_SEND_INDIVIDUAL_WHATSAPP` | No | No | No |
| `CAN_INSERT_PORTAL_LINK` | Yes | Yes | Yes |
| `CAN_GENERATE_STANDARD_QUOTE` | Yes | Yes | Yes |
| `CAN_GENERATE_STANDARD_INVOICE` | No | Yes | Yes |
| `CAN_VERIFY_PAYMENT` | No | No | Yes |
| `CAN_RUN_BATCH_COMMUNICATIONS` | No | Yes | Yes |
| `CAN_OVERRIDE_COOLDOWN` | No | No | Yes |
| `CAN_APPROVE_FINANCIAL_OVERRIDE` | No | No | Yes |
| `CAN_MANAGE_PORTAL_ACCESS` | No | No | Yes |
| `CAN_MANAGE_ROLES` | No | No | Yes |
| `CAN_ADMINISTER_RUNTIME` | No | No | Yes |
| `CAN_DEPLOY_RUNTIME` | No | No | Yes |
| `CAN_WRITE_ZOHO_BOOKS` | No* | No* | Yes |

`*` `CAN_WRITE_ZOHO_BOOKS` may be granted by explicit account override via script property `ZOHO_BOOKS_WRITE_ADMINS`.

## Account-Specific Overrides

Current explicit override channels:

- `SUPER_ADMIN_EMAILS` - identifies Super Admin accounts.
- `ZOHO_BOOKS_WRITE_ADMINS` script property - grants `CAN_WRITE_ZOHO_BOOKS` without changing base role.

No other account-specific capability overrides are currently active in repo config.

## Individual vs Batch

These remain separate:

- `CAN_SEND_INDIVIDUAL_EMAIL`
- `CAN_SEND_INDIVIDUAL_WHATSAPP`
- `CAN_RUN_BATCH_COMMUNICATIONS`

Granting individual reviewed-email authority does not grant batch authority.

## UI and Backend Rule

- UI Review communication controls must use shared capability output for preview, insert portal link, and send.
- Backend RPCs must enforce the same capability or a stricter one.
- Disabled buttons are presentation only. Backend RPC gates remain authoritative.

Current converged examples:

- Review preview: `CAN_PREVIEW_APPLICANT_COMMUNICATION`
- Review send: `CAN_SEND_INDIVIDUAL_EMAIL`
- Payment verification: `CAN_VERIFY_PAYMENT`
- Zoho Books live write/test email: `CAN_WRITE_ZOHO_BOOKS`
- Stage/selected batch preview/send: `CAN_RUN_BATCH_COMMUNICATIONS`
- Document status save: `CAN_SAVE_DOCUMENT_STATUSES`

## Retained Broad Gates

`CAN_RUN_OPERATIONS_ACTIONS` still exists in the UI as a broad operational shell/control concept. It remains temporarily retained for:

- operations-mode shell gating
- WhatsApp CSV export surface
- parent email override surface

These retained uses do not define Review Workspace individual-email authority.

## Audit Requirements

Capability-sensitive actions must preserve:

- actor email
- actor role
- applicant ID or cohort
- message type or mutation type
- outcome
- timestamp
- explicit block code/reason where denied

## Future Role Addition Procedure

When adding a new operational role or account:

1. Add the account to `CONFIG.ADMIN_EMAILS`.
2. Add the configured role to `CONFIG.ADMIN_ROLES`.
3. Extend `resolveAdminCapabilities_()` only if the new role genuinely needs a distinct capability profile.
4. Add account-level regression coverage.
5. Update this document.
6. Do not grant higher-risk capabilities by UI-only changes.
