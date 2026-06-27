# F2A.5 Architecture Reconciliation and Protected Surface Register v01

## Executive summary

Result: PASS_WITH_WARNINGS

This audit reconciles the r301 runtime surface documented in DR5, F1, and F2A against the repository architecture documents, Mermaid diagrams, governance notes, disaster recovery materials, and accepted implementation plans.

The main finding is that the live runtime is more operationally complete than several architecture documents and diagrams. The system has moved from transition-era documentation into a mature Admin runtime with document verification, applicant-folder previews, selected-applicant communications, queue rollups, DR tooling, and staging release discipline. F2B may proceed only if it respects the protected surfaces below and starts with proof-backed archive candidates. It should not prune architecture-critical or partially implemented future-roadmap surfaces.

Warnings:

- Git tag enumeration previously reported broken `desktop.ini` tag refs. This is a repository hygiene warning, not a runtime architecture blocker.
- Several Mermaid diagrams are now aspirational/outdated and should be updated before broad F3 refactor work.
- Some runtime features exceed current documentation, especially Zoho Books, document preview renditions, DR tooling, and maintenance wrappers.
- Some documentation exceeds runtime, especially full owner/action queue modeling, AI precheck, Google Forms replacement, and full LAP automation.

## Baseline identity

| Item | Value |
| --- | --- |
| Baseline tag | `baseline/r301-dr-f1-readiness` |
| Current HEAD at audit start | `8e51b7b docs: add F2A runtime call graph and archive plan` |
| DR5 | PASS_WITH_WARNINGS |
| F1 | PASS_WITH_WARNINGS |
| F2A | PASS_WITH_WARNINGS |
| Admin staging | r301 / 301 |
| Production | Untouched |
| Student staging | Unchanged |
| OPS | Frozen |

## Runtime vs architecture comparison

| Surface | Runtime finding | Architecture finding | Classification | F2 implication |
| --- | --- | --- | --- | --- |
| Runtime identity and release gates | `Config.js`, whoami, release closure, and remote-source gates are active operational authority. | Governance documents define identity gates and live whoami truth. | PROTECTED_LIVE | DO NOT TOUCH |
| Legacy/Admin dashboard | Admin remains the live operator authority surface. | Docs now distinguish current Admin from archived legacy data. | PROTECTED_LIVE | DO NOT TOUCH |
| OPS | OPS code and surfaces remain present with safe-mode/frozen boundaries. | Architecture says OPS is reference/secondary and frozen. | PROTECTED_FROZEN | DO NOT TOUCH |
| Row facts / authority layer | Runtime has many authority helpers but not a single clean shared facts module. | Architecture targets Raw Row Facts -> Shared Row Facts -> Authority Layer. | PARTIAL_IMPLEMENTATION | F3 candidate, not F2 removal |
| Queue engine | Current queues include Application Received / FD Received, Documents to Verify, Awaiting Payment, Payments to Verify, Payment-First Anomalies, Payment Verified. | Queue docs describe owner/action worklists and some aspirational routing. | PROTECTED_LIVE | VERIFY FIRST |
| Document verification | Status persistence, `Docs_Verified` rollup, review modal, gallery, signed routes, PNG previews, and lightbox are live. | Document architecture broadly matches authority principle but predates latest preview/backfill implementation. | PROTECTED_LIVE | DO NOT TOUCH |
| Signed document routes | Signed per-file routes protect file access and preview/open/download actions. | Architecture requires no raw Drive IDs/URLs exposed. | PROTECTED_LIVE | DO NOT TOUCH |
| Preview/gallery | Applicant-folder `FODE_PREVIEW` PNGs, lazy/backfill generation, future-upload hook, and lightbox are implemented. | Earlier docs framed previews as future/derived. | PROTECTED_LIVE | DO NOT TOUCH |
| FormDesigner intake | FD remains current intake source; empty payload warning and canonicalization exist. | Google Forms replacement remains future. | PROTECTED_LIVE | DO NOT TOUCH until GF replacement |
| Google Forms replacement | Not implemented. | Roadmap marks as near-critical future replacement. | IMPLEMENT_LATER | Not F2B archive scope |
| Payment verification | Payment/doc authority split, receipt status, queues, and compatibility fields exist. | Authority docs correctly warn payment is not classroom/enrollment authority. | PROTECTED_LIVE | DO NOT TOUCH |
| Zoho Books | Runtime has preflight, preview, draft invoice, test invoice email, and dry-run/live flags. | Architecture docs under-describe actual implementation. | PROTECTED_LIVE | DO NOT TOUCH |
| Classroom acceptance/handover | OPS classroom handover preview/notify bridge exists; enrollment/classroom authority remains separate from payment. | Roadmap still treats classroom acceptance/handover as incomplete. | PARTIAL_IMPLEMENTATION | VERIFY FIRST |
| Communications registry | H1-H5 registry/templates/exposure are implemented; selected-applicant templates are live. | Older communication docs are superseded by H-series audits. | PROTECTED_LIVE | DO NOT TOUCH |
| Stage Batch | Preview/send remains separate from selected-applicant custom paths. | Architecture requires backend authority and preview/cache parity. | PROTECTED_LIVE | DO NOT TOUCH |
| Contactability | Runtime has partial bounce/contactability support and audit plan, but no full authoritative marking path. | H4 records row-readable evidence gap and Outlook/Gmail discovery future work. | PARTIAL_IMPLEMENTATION | VERIFY FIRST |
| LAP / stage automation | Resolver, actionability helpers, and trigger/runner scaffolds exist. | LAP automation is future/partial. | PARTIAL_IMPLEMENTATION | DO NOT REMOVE |
| Campaign/marketing legacy | Campaign and prospect guidance concepts exist, but applicant workflow is separate. | H-series says prospect guidance is planned/inert and must not use applicant Stage Batch authority. | LEGACY_REFERENCE | SAFE AFTER PROOF |
| DR tooling | F: scaffold, manifest, release recorder, and backup verification reports exist. | DR docs now align with implemented tooling, with known warnings. | PROTECTED_LIVE | DO NOT TOUCH |
| AI document precheck | Not implemented in runtime. | Architecture/audit says advisory-only future, no authority. | IMPLEMENT_LATER | Not F2B archive scope |

## Protected Surface Register

| Surface | Classification | Protection boundary | Notes |
| --- | --- | --- | --- |
| Zoho Books workflow | PROTECTED_LIVE | DO NOT TOUCH | Includes preflight, payload preview, draft invoice, dry-run/test flags, and send safeguards. |
| Payment verification | PROTECTED_LIVE | DO NOT TOUCH | Includes receipt/document split, payment queues, compatibility fields, and no acceptance implication. |
| Document verification | PROTECTED_LIVE | DO NOT TOUCH | Includes status save persistence, rollup sync, comments, required-doc logic, and review modal authority. |
| Queue engine | PROTECTED_LIVE | VERIFY FIRST | Do not prune queue helpers, stage derivation, or resolver functions without row-level proof. |
| Communications registry | PROTECTED_LIVE | DO NOT TOUCH | H1-H5 semantic registry/template rules protect send-surface meaning. |
| Selected-applicant communication surface | PROTECTED_LIVE | DO NOT TOUCH | Includes docs/payment follow-up exposure and placeholder send-blocking. |
| Stage Batch communications | PROTECTED_LIVE | DO NOT TOUCH | Must remain separate from selected-applicant and custom email authority. |
| Signed document routes | PROTECTED_LIVE | DO NOT TOUCH | Security boundary for open/download/preview/original. |
| Preview/gallery/lightbox | PROTECTED_LIVE | DO NOT TOUCH | Applicant-folder PNG previews are derived evidence, not authority. |
| Preview backfill/future-upload hooks | PARTIAL_IMPLEMENTATION | VERIFY FIRST | Manual/property wrappers are operational maintenance, not dead code until backfill closure is recorded. |
| Runtime identity | PROTECTED_LIVE | DO NOT TOUCH | `VERSION`, `DEPLOY_VERSION_NUMBER`, whoami, and release gates. |
| DR tooling | PROTECTED_LIVE | DO NOT TOUCH | FODE recovery manifest, release recorder, and backup scripts. |
| Baseline governance | PROTECTED_LIVE | DO NOT TOUCH | Release discipline, track gates, closure rules, and rollback rules. |
| FormDesigner intake/canonicalization | PROTECTED_LIVE | DO NOT TOUCH | Current operational intake until Google Forms replacement exists. |
| Google Forms replacement | IMPLEMENT_LATER | DO NOT ARCHIVE | Future required contingency/migration item. |
| Contactability/bounce evidence | PARTIAL_IMPLEMENTATION | VERIFY FIRST | Do not fabricate warnings or mutate rows without data-source proof. |
| LAP/automated stage runner | PARTIAL_IMPLEMENTATION | VERIFY FIRST | Planned automation/scaffold; not safe for blind removal. |
| Classroom handover/OPS notify bridge | PARTIAL_IMPLEMENTATION | VERIFY FIRST | Keep until classroom/enrollment authority is redesigned. |
| OPS surfaces | PROTECTED_FROZEN | DO NOT TOUCH | Frozen reference/secondary surface. |
| Campaign legacy/prospect guidance | LEGACY_REFERENCE | SAFE AFTER PROOF | Do not remove until marketing/GF plan confirms replacement. |
| Editor diagnostics/test helpers/probe routes | SAFE_TO_ARCHIVE_LATER | SAFE FOR F2B after proof | Best initial F2B candidates. |
| Manual maintenance wrappers | SAFE_TO_ARCHIVE_LATER | VERIFY FIRST | Some are still operationally useful for DR/backfill; remove only after closure record. |

## Architecture drift report

### Runtime exceeds documentation

| Item | Evidence class | Risk |
| --- | --- | --- |
| Applicant-folder `FODE_PREVIEW` PNGs and lightbox | Runtime/gallery work after original document architecture | Docs may understate live evidence-viewing capability. |
| Zoho Books workflow | Config flags and Admin/Utils functions | High-risk financial path is under-modeled in diagrams. |
| H1-H5 communication registry/templates | H-series audits and tests | Older communication docs can mislead future implementers. |
| Empty document payload warning | D1Y.5 backend diagnostic | Intake failure detection not fully represented in diagrams. |
| DR toolkit and release recorder | F-DR scripts and DR5 report | Operational recovery path exceeds old roadmap. |
| Automated stage runner scaffolds | Runtime helper/trigger functions | Could be mistaken as dead code, but belongs to LAP future track. |
| OPS classroom handover bridge | Admin/OPS helper names and docs | Frozen but still partly live/reference. |

### Documentation exceeds runtime

| Item | Evidence class | Risk |
| --- | --- | --- |
| Full owner/action queue architecture | Queue and operational model docs | Not fully realized as canonical persisted state. |
| Complete Actionability Resolver | Architecture overview and actionability flow | Runtime has partial derived previews, not complete action authority model. |
| AI-assisted document precheck | 7D/D1 planning docs | Not implemented; must stay advisory-only future. |
| Google Forms replacement | Roadmap and FD diagnostics | Still future; FD remains operational source. |
| Full lifecycle automation/LAP | Roadmap and lifecycle diagrams | Scaffolds exist, but automation is not broadly accepted live authority. |
| Complete classroom acceptance/enrollment flow | Authority model and roadmap | Payment/docs do not yet create full classroom authority. |
| Full Sheet/Drive DR backups | DR5 warning | Tooling foundation exists; full data backup execution remains future. |

### Abandoned, duplicated, renamed, or undocumented concepts

| Type | Item | Recommendation |
| --- | --- | --- |
| Abandoned/legacy | CRM legacy pipeline summary and old campaign-oriented concepts | Keep as reference until F2B proof; do not let it drive new authority. |
| Duplicated | Lifecycle stage, ops lifecycle, queue stage, pipeline summary | F3 should normalize naming after F2 archive pass. |
| Duplicated | `Payment_Verified` compatibility mirror vs receipt/payment authority | Keep protected; document source-of-truth boundary before refactor. |
| Duplicated | `reminder` overloaded vs semantic message types | H-series says keep legacy but avoid broadening. |
| Renamed | Legacy Admin Dashboard -> Admin Dashboard; pipeline summary -> compatibility summary | Mermaid/docs should use current operator wording. |
| Undocumented | Property cleanup, backfill, probe, trigger, and maintenance wrappers | F2B should classify one by one, not remove wholesale. |

## Mermaid reconciliation

Recommended diagram updates only. No diagram edits were made in this audit.

| Diagram | Drift | Recommended update |
| --- | --- | --- |
| `Architecture_Flow.mmd` | Missing FD/Portal intake, applicant Drive folders, signed document routes, previews, DR tooling, and Zoho Books. | Add intake, document authority, preview derivative, payment/Zoho, communications registry, and DR/governance nodes. |
| `Authority_Model.mmd` | Does not reflect preview derivative authority, receipt/payment split, Stage Batch preview/send parity, or contactability gap. | Add explicit authority boundaries for document files, payment evidence, Zoho, and communication send gates. |
| `Queue_Model.mmd` | Uses aspirational owner/action queue model rather than current r301 queue names. | Add current queues and mark owner/action queue model as future/refactor. |
| `Communication_Model.mmd` | Predates H1-H5 semantic registry and selected-applicant template exposure. | Add active vs planned message types, selected-only custom email, Stage Batch separation, and contactability future work. |
| `Lifecycle_State_Machine.mmd` | Uses old/general state names that do not exactly match runtime resolver labels. | Reconcile with runtime stage labels and payment/document queue transitions. |
| `Operator_Actionability_Flow.mmd` | More complete than runtime. | Mark proposed fields as future and align with current read-only actionability preview. |

## Lost feature register

| Feature | Current status | Required future action |
| --- | --- | --- |
| Classroom acceptance/enrollment authority | PARTIAL_IMPLEMENTATION | Define classroom handover authority separate from payment/docs before automation. |
| Google Forms replacement | IMPLEMENT_LATER | Design owned intake path; preserve FD until replacement is proven. |
| Full contactability evidence ingestion | PARTIAL_IMPLEMENTATION | Discover Gmail/Outlook bounce sources, dry-run matching, then controlled marking if approved. |
| Full Actionability/owner worklist model | PARTIAL_IMPLEMENTATION | Normalize owner/next-action/urgency only after queue authority is stable. |
| LAP scheduled automation | PARTIAL_IMPLEMENTATION | Implement after single lifecycle state machine design and trigger safety gate. |
| AI document precheck | IMPLEMENT_LATER | Advisory-only deterministic prechecks first; no approval/rejection authority. |
| Full Sheet/Drive DR backups | PARTIAL_IMPLEMENTATION | Execute scheduled backups and restore drills after current DR tooling review. |
| Mermaid architecture refresh | IMPLEMENT_LATER | Update diagrams before F3 broad refactor. |

## Deferred feature register

| Feature | Reason deferred | Protection |
| --- | --- | --- |
| Visual redesign/recoloring | Intentionally deferred until operational hardening complete. | Not F2B scope. |
| PDF/OCR/AI intelligence | High accuracy/security risk. | Advisory-only future track. |
| Google Forms replacement | Requires intake migration and operator/process approval. | Preserve FormDesigner until replacement accepted. |
| LAP automation | Must not patch scattered gates. | Requires single state-machine authority. |
| OPS retirement | OPS frozen, not deleted. | Plan only until authority replacement confirmed. |
| Historical preview cleanup/deletion | Current rule is create/reuse only. | No deletes until separate cleanup CIS. |

## Updated roadmap reconciliation

### Implemented

- Admin staging release discipline, identity gates, live whoami truth.
- Document manifest, signed actions, inline preview, lightbox, applicant-folder `FODE_PREVIEW` generation.
- Document status persistence and `Docs_Verified` queue rollup.
- Selected-applicant communication template completeness.
- H1-H5 communication semantic registry/usability work.
- D1Y.5 empty document payload diagnostic.
- DR toolkit foundation and DR5 verification.
- F1 and F2A audit artifacts.

### Partially implemented

- 7C-D historical preview backfill and future-upload generation closure.
- Payment/Zoho workflow and operational acceptance proof.
- Classroom handover/acceptance boundary.
- Contactability/bounce visibility.
- LAP/stage automation.
- Actionability/owner worklist model.
- Full disaster recovery execution schedule.

### Deferred

- Google Forms replacement.
- AI-assisted document review.
- Visual redesign.
- Broad refactor/F3.
- Production release hardening beyond staging proofs.

### Frozen

- OPS, except critical safety fixes and reference-only use.

### Retired or legacy-reference only

- Legacy migration-era labels and pipeline summaries.
- Old campaign/general marketing send paths until marketing/GF separation is finalized.
- Probe/test/manual wrappers after proof-backed F2B removal.

## F2 protection boundaries

### DO NOT TOUCH

- `Config.js` runtime identity and release gates.
- Zoho Books/payment functions and config.
- Document verification status save, rollup, and queue derivation.
- Signed document file routes.
- Applicant-folder preview/gallery/lightbox architecture.
- Communication registry/templates/send gates/Stage Batch mappings.
- FormDesigner intake/canonicalization and payload warning.
- OPS surfaces.
- DR tooling and governance docs.
- Portal token/security paths.
- Classroom handover bridge.
- LAP/trigger scaffolds unless a separate LAP CIS authorizes work.
- Production, Student staging, Sheets, Drive data, live sends.

### VERIFY FIRST

- Manual preview backfill wrappers.
- Property cleanup utilities.
- Portal token backfill tools.
- Bounce/contactability scan helpers.
- Automated stage batch runner functions.
- Legacy queue helpers.
- Campaign/prospect guidance paths.
- Editor/run dropdown wrappers.

### SAFE AFTER PROOF

- Editor diagnostics with no route/UI/test caller.
- `test_*` Apps Script helpers not referenced by tests or operator workflows.
- Probe routes with no accepted release or tooling dependency.
- Duplicate local-only diagnostics already superseded by F: Playwright tooling.
- Manual wrappers whose job is closed and recorded in an audit.

### SAFE FOR F2B

Recommended F2B starts with a small proof batch:

1. Editor diagnostics and obsolete `test_*` helpers.
2. Probe routes proven unreachable from `doGet`, `doPost`, AdminUI, tooling, and tests.
3. Closed manual wrappers with a DR/restore path.

F2B should not proceed unchanged for broader pruning. It may proceed for the narrow proof-backed Batch A only. Before Batch B or later, update the protected surface register if new evidence changes any classification.

### SAFE FOR F3

F3 should begin only after:

- F2B Batch A is closed and accepted.
- Mermaid diagrams are updated to current r301+ runtime truth.
- Protected surfaces have smoke/regression coverage.
- No unresolved hydration or identity-gate warnings are active.
- DR5 warnings are either accepted or reduced.
- Refactor goals are limited to structure/normalization, not behavior changes.

## F3 prerequisites

- Persist an updated architecture diagram set.
- Establish a shared row-facts/authority module plan before moving logic.
- Preserve all send, payment, document, route, and runtime identity tests.
- Add targeted tests for any protected-surface refactor.
- Keep FormDesigner, Zoho, payment, signed file routes, and communication send gates unchanged until dedicated CIS approval.

## Final F2A.5 recommendation

F2B may begin only as a narrow, proof-backed archive pass against diagnostics, probes, and closed manual wrappers. It should not treat all orphan-looking functions as dead code because several planned or protected surfaces are intentionally partial: LAP automation, contactability, classroom handover, preview backfill, DR, and Google Forms replacement.

Roadmap updates are required before F3 and before any broad archive/prune campaign touching payment, document verification, communication, intake, LAP, OPS, or preview architecture.

## Safety confirmation

- Runtime files edited: No.
- Runtime deletion/archive/refactor: No.
- Apps Script push/version/repin/deployment: No.
- Sheet edits: No.
- Drive edits: No.
- Production touched: No.
- Student staging touched: No.
- OPS touched: No.
