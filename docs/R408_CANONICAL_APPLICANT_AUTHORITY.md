# R408 canonical applicant authority

Release track: `Track H`.

## Authority map

| Concern | Authority | Runtime rule |
| --- | --- | --- |
| Applicant workbook | `1fHmeGNmpOj9PEPQ5Fp4tUyCP4UdH70lltukraD4SalU` (`FODE_Applications_2026`) | The shared applicant resolver opens this exact ID and rejects any returned workbook with a different ID. |
| Applicant tab | `FODE_Data` | The shared applicant resolver requires this exact tab. |
| Code environment | `CODE_ENVIRONMENT` | May distinguish staging and production code behavior, but cannot select an applicant workbook. |
| Admin and Student deployment identity | Deployment IDs and canonical service URLs | Determines role and code deployment only. It does not determine applicant-data authority. |
| Capability grants | `Capability_Grants` in the canonical workbook | Named non-applicant tab; its configured workbook ID is the canonical applicant workbook ID. |
| Portal secrets | Configured `PortalSecrets` sidecar workbook and tab | Separate security authority. R408 does not migrate it to MariaDB. |
| Portal log | Configured portal-log sidecar | Separate operational log authority. |
| Drive, CRM, Gmail and PHP/MariaDB | Existing service-specific authorities | Preserved; none may resolve an alternate applicant workbook. |

The synthetic workbook `1YFgLtUExz__fzQ4zTNoIyGTu-nrnasS7dIaShNPl7Cs` is abandoned and unapproved. R408 does not read, copy, merge, migrate, preserve or delete its applicant records. It is removed from deployable applicant resolution.

## Authorized R408 synthetic record

The only controlled live-proof record is created by one Form Designer submission into the canonical workbook. Its server-bound contract is:

| Field | Exact value |
| --- | --- |
| `First_Name` | `TEST_COMM_A` |
| `Last_Name` | `R408_CANONICAL_FIXTURE_20260803` |
| `Type` | `Regression Fixture` |
| `Parent_Email` | `sanjay@minervacenters.com` |
| `Reason_For_Transfer` | `REGRESSION_FIXTURE_DO_NOT_PROCESS` |
| `Siblings_Name_Grade` | `REGRESSION_FIXTURE_QUEUE_EXCLUDED` |
| `correlation_id` | `R408-FD-20260803-001` |
| Message type | Built-in `docs_missing` |
| Template version | `1` |

The canonical intake allocates the `ApplicantID`. Admin controls require the operator to enter that generated ID and bind it read-only before reconciliation or communication proof. Displayed identity, submitted identity, recipient and the canonical server row must agree exactly. Missing, conflicting or substituted identity fails closed.

The fixture is non-operational and excluded from normal individual, Batch, Stage Batch, Student and automated communication paths. Only the dedicated R408 proof routes can opt into it. Those routes accept one numeric canonical `FODE-26-NNNNNN` ApplicantID, one recipient, blank CC/BCC, and no subject, body, template or recipient override.

## Controlled proof and mutation boundary

Local fixtures remain synthetic and cannot invoke live services. Live proof is gated by successful Admin `r408/408` identity, canonical authority validity and exactly one unambiguous Form Designer landing.

PortalSecrets reconciliation is bounded to the exact fixture. It creates one active server-generated authority record only when none exists, is a no-op for exactly one usable record, and fails closed on duplicate, inactive or unusable records. It must not expose secret material or mutate `FODE_Data`.

The individual communication proof permits exactly one Gmail invocation to `sanjay@minervacenters.com` after durable first and replayed `PREPARED` evidence. Finalization and replay must prove `SENT`, one history chain and no duplicate delivery. Only the CIS-listed communication-history fields may change on the fixture row.

No Batch or Stage Batch execution, Student mutation or repin, Production deployment or repin, real-applicant communication, property change, schema change, endpoint change, credential change, or PortalSecrets-to-MariaDB migration is part of R408.
