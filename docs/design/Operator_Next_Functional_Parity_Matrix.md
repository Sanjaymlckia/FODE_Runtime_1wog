# Operator Next Functional Parity Matrix

Status: Track L UI stabilisation pass only. No runtime release.

| Surface / action | Existing authority | Preserved | Notes |
| --- | --- | --- | --- |
| Lifecycle Map | Canonical Lifecycle via Actionability DTO | Yes | Display-only shell improvements only |
| Operational Dashboard | Existing metrics + Actionability summaries | Yes | Typography and card system normalized |
| Applicant Action | Actionability Resolver | Yes | Readable worklist labels and consistent row structure |
| Admissions Review | Existing Actionability + Review handoff | Yes | Compact route presentation retained |
| Communications route | Communication Authority through shared Review/Batch flows | Yes | No new send path introduced |
| Finance route | Canonical Finance + Review mutation path | Yes | Readable payment labels added; handlers unchanged |
| Portal Operations route | Portal diagnostics and Review portal handlers | Yes | Route remains read-only shell plus Review entry |
| Contactability | Actionability Resolver | Yes | VCF remains blocked; no new export/send path |
| Exceptions / Hidden | Existing hidden/integrity DTOs | Yes | Presentation only |
| Reports & Audit | Existing summaries | Yes | Presentation only |
| System Health | `admin_getRuntimeInfo()` and safety diagnostics | Yes | Presentation only |
| Roles & Capabilities | Capability resolver and grant matrix | Yes | Human-readable status labels added |
| Exact Review open | `review(rowNumber, applicantId, ...)` | Yes | Same handler, new readable workspace navigation |
| Document save | Existing Review handlers | Yes | No mutation contract change |
| Payment verification | Existing Review handler + capability gate | Yes | No mutation contract change |
| Batch Communication | Existing selected-cohort modal path | Yes | No cohort/send contract change |
| Current Admin fallback | Current Admin route and shared Review | Yes | Remains supported |

## Explicit Non-Changes

- No new authority introduced.
- No Finance search repair included.
- No Registry/Classroom expansion included.
- No release controls added to Operator Next.
- No deploy, version, repin, or tag action performed.
