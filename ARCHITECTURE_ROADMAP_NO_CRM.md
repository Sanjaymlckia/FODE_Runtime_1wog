# Architecture Roadmap: No-CRM Admissions and Operations Stack

Date: 2026-05-07
Repo: `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog`
Mode: architecture and roadmap only. No runtime code, deployment, trigger, Sheet, Drive, Gmail, Apps Script, or Zoho mutation.

## Executive Decision Summary

The strategic direction is to remove Zoho CRM from student and admissions workflows.

The operating stack should standardize on:

`FB Ads -> FormDesigner intake -> Custom Portal -> Google Workspace backend -> Zoho Books -> Gibbon LMS where academic delivery or compliance requires it`

Core decisions:

- The custom Apps Script portal becomes the operational workflow engine for admissions, document verification, payment progression, communications, reminders, bounce handling, dashboards, admissions status, and finance handoff readiness.
- FormDesigner remains the public intake layer for front-end student, parent, and corporate lead capture.
- Zoho Books remains the finance/accounting system of record for customers, invoices, receipts, payment records, and final finance truth.
- Zoho CRM should not be rebuilt, extended, or preserved as a required admissions workflow dependency.
- Gibbon should own academic records and LMS-style academic operations after admission where needed, especially for DHERST-facing academic evidence.
- Google Classroom is already appropriate for FODE online delivery and KIA school delivery. Diploma and corporate delivery should not be forced into a platform decision until admissions and finance workflows are stable.

The guiding principle is simple: do not build a new full CRM, LMS, or accounting system inside Apps Script. Build a controlled admissions and operations workflow layer that hands off cleanly to Books and academic delivery platforms.

## Recommended Target Architecture

### Target System Roles

| Layer | System | Primary role | Authority |
| --- | --- | --- | --- |
| Marketing | Facebook Ads | Lead generation and campaign source | Not authoritative after form submission |
| Intake | FormDesigner | Public program-specific forms, uploads, initial validation | Intake packet only |
| Workflow engine | Custom Apps Script Portal | Admissions operations, document/payment workflow, communications, dashboards, Books handoff readiness | Operational truth |
| Backend | Google Sheets, Drive, Gmail, Apps Script, Classroom | Structured workflow data, files, email, automation, classroom delivery where selected | Operational and delivery support |
| Finance | Zoho Books | Customers, invoices, receipts, payments, accounting reports | Finance truth |
| Academic delivery | Google Classroom or Gibbon | Teaching, learning, class delivery, assessments depending program | Academic delivery truth |
| Academic compliance | Gibbon plus Drive evidence where needed | Student academic record, classes, assessments, DHERST evidence | Academic compliance truth |

### Architecture Rule

The portal should own workflow state. Books should own finance state. Gibbon or Google Classroom should own academic delivery state. No system should duplicate another system's full domain.

## System Ownership Boundaries

### Portal Ownership

The portal should own:

- Application intake normalization after FormDesigner submission.
- Applicant identity and correlation IDs.
- Admissions status and lifecycle stage.
- Document checklist state and verification status.
- Payment progression state before and after Books handoff.
- Operator queues and dashboards.
- Communications and reminder orchestration.
- Bounce handling, suppression, and operator-visible delivery state.
- Parent/student portal access and controlled document upload status.
- Books handoff readiness and integration payload status.
- Audit logs for operational decisions.

The portal should not own:

- Full CRM contact/deal management.
- Ledger/accounting truth.
- Full online course delivery.
- Assessment records where an LMS or academic system is selected.
- Long-term academic transcript/compliance record unless no LMS is selected and the scope is explicitly limited.

### FormDesigner Ownership

FormDesigner should own:

- Front-end student, parent, and corporate intake.
- Program-specific forms.
- File upload capture at initial application time.
- Initial validation of required fields and file presence.
- Source metadata such as campaign, form, program, and submission timestamp.

FormDesigner should not own:

- Admissions lifecycle truth.
- Payment verification.
- Reminder sequencing.
- Document verification decisions.
- Books customer/invoice creation.
- LMS enrollment.

### Zoho Books Ownership

Zoho Books should own:

- Customer records.
- Invoices.
- Receipts.
- Payment records.
- Credit notes, balances, and accounting reports.
- Final finance truth.

Books should receive clean handoff data from the portal only when operational state is ready. The portal may display finance status from Books, but Books remains the finance authority.

Books should not own:

- Admissions workflow state.
- Document verification.
- Student academic progress.
- Communication eligibility.
- Applicant queueing.

### Gibbon Ownership

Gibbon should own where selected:

- Student academic record after admission.
- Courses, classes, terms, and cohorts.
- Learning delivery where Gibbon is chosen as the delivery platform.
- Assessments and academic outcomes.
- LMS access.
- DHERST academic compliance evidence.

Gibbon should not own:

- Pre-admission intake.
- Finance/accounting truth.
- Public application forms.
- Books invoice or receipt lifecycle.
- General admissions communications before enrollment.

### Google Workspace Ownership

Google Workspace should remain the center of lightweight operations:

- Apps Script: workflow engine and integration layer.
- Sheets: structured operational data and controlled queues.
- Drive: applicant files and evidence storage.
- Gmail: operational communications.
- Google Classroom: delivery platform for FODE online delivery and KIA school workflows.
- Docs/Sheets exports: audit, operator reports, and compliance packs.

## Workflow Map: FODE

1. FB Ads or direct links send applicants to FormDesigner.
2. FormDesigner captures application data, program, parent/student details, and initial uploads.
3. Apps Script intake normalizes the submission and creates or updates the portal applicant record.
4. Portal issues controlled access and shows application/document/payment status.
5. Admin dashboard verifies documents and moves the applicant through admissions stages.
6. Portal controls communications, reminders, bounce handling, and suppression.
7. Payment requirement and evidence are managed by portal workflow.
8. Zoho Books receives or maintains customer, invoice, receipt, and payment records.
9. Finance truth is read from Books or verified against Books before final admission state.
10. FODE online delivery uses Google Classroom.
11. Academic/compliance evidence may be exported or mapped to Gibbon where DHERST or program governance requires a formal academic record.

FODE priority:

- Keep the portal as the admissions and operations authority.
- Use Google Classroom for online delivery.
- Use Books for invoicing and payment truth.
- Use Gibbon selectively for academic record and compliance, not as the admissions workflow engine.

## Workflow Map: KIA

1. Parent/student intake comes through FormDesigner or controlled school forms.
2. Portal normalizes the KIA application or school workflow record.
3. Admin dashboard manages document requirements, admissions status, parent/student communication, and payment progression.
4. Google Drive stores documents and evidence.
5. Gmail handles controlled parent/student communications.
6. Zoho Books owns parent/customer records, invoices, receipts, and payment truth.
7. KIA continues to use Google Classroom for learning delivery.
8. Gibbon is optional only if KIA later needs a fuller SIS/LMS record beyond Classroom.

KIA priority:

- Do not force KIA into Gibbon if Google Classroom already satisfies delivery needs.
- Do not rebuild school billing or accounting inside the portal.
- Keep KIA-specific workflow differences in configuration, not duplicated hardcoded code.

## Workflow Map: MLC Diploma

Programs in scope include Diploma in Business Studies and Diploma in IT.

1. FB Ads and direct marketing route applicants to diploma-specific FormDesigner forms.
2. FormDesigner captures applicant details, qualification evidence, uploads, and program preference.
3. Portal creates the admissions workflow record and controls document/payment progression.
4. Admin dashboard handles eligibility, document verification, communication, and admission decision state.
5. Zoho Books owns invoicing, receipts, and payment/accounting truth.
6. The learning platform decision remains open until admissions and finance workflows are stable.
7. Platform options are:
   - Google Classroom for lightweight course delivery and familiar Google Workspace operations.
   - Gibbon for structured academic records, courses, assessments, and compliance evidence.
   - Hybrid model: Classroom for delivery, Gibbon for academic records/compliance.
   - Deferred LMS decision: stabilize admissions and finance first, then select delivery platform based on evidence.

Recommended near-term position:

- Defer the final diploma LMS decision.
- Build admissions and Books handoff in a clone-safe portal model.
- Capture the minimum academic handoff fields needed later: admitted student, program, cohort, start date, contact, payment status, and document verification status.

## Workflow Map: MLC Corporate and Short Courses

1. FB Ads, direct sales, or employer links route prospects to corporate/short-course FormDesigner forms.
2. FormDesigner captures company, contact person, participant list or expected participant count, program interest, and billing details.
3. Portal records the operational workflow: enquiry, proposal, enrolment intent, required documents, participant data, communication status, and Books handoff readiness.
4. Zoho Books owns customer, quote/invoice where used, receipt, and payment truth.
5. Learning delivery platform remains open:
   - Google Classroom for simple cohorts and repeatable course content.
   - Gibbon for structured participant academic records or assessment evidence.
   - Hybrid model for Classroom delivery plus Gibbon recordkeeping.
   - Defer LMS decision until course packaging, finance, and participant workflows are stable.

Recommended near-term position:

- Do not build corporate CRM pipelines in Apps Script.
- Treat corporate workflow as intake, operations, finance handoff, and delivery handoff.
- Keep employer/customer finance records in Books.
- Keep participant academic or attendance records in the selected delivery system, not in Books.

## DHERST and Gibbon Positioning

DHERST-facing work needs evidence discipline. Gibbon is best positioned as the academic record and compliance system where formal student records, classes, courses, assessments, and academic evidence are required.

Recommended positioning:

- Use the portal for admissions and operational readiness.
- Use Books for finance.
- Use Google Drive for controlled evidence artifacts and supporting files.
- Use Gibbon for academic record and DHERST compliance evidence after admission where the program requires formal academic tracking.
- Do not use Gibbon as the public admissions intake layer.
- Do not use Books or CRM as the academic compliance ledger.

Gibbon should receive clean admitted-student handoff data only after the portal and finance state are sufficiently stable.

## Online Learning Platform Positioning

### Google Classroom

Best fit:

- FODE online delivery.
- KIA school workflows.
- Lightweight course delivery.
- Google Workspace-centered operations.
- Fast rollout and familiar teacher/student workflows.

Risks:

- Weaker formal student information system structure.
- Limited academic compliance model compared with a dedicated SIS/LMS.
- May need Drive/Sheets evidence packs for compliance reporting.

### Gibbon LMS

Best fit:

- Academic record after admission.
- Course/class structure.
- Assessment records.
- DHERST-facing compliance evidence.
- Longer-term student record management.

Risks:

- Heavier implementation.
- Can become an unnecessary second workflow engine if introduced too early.
- Requires clear boundary so it does not duplicate the portal.

### Hybrid Model

Best fit:

- Classroom for teaching delivery.
- Gibbon for academic record and compliance.
- Portal for admissions and operations.

Risks:

- More integration surfaces.
- Requires strong ID mapping and handoff controls.
- Higher operator training burden.

### Deferred Decision

Best fit:

- Diploma and corporate/short-course workflows where delivery platform requirements are not yet proven.

Recommendation:

- Defer final LMS selection for Diploma in Business Studies, Diploma in IT, and MLC Corporate Training until admissions and finance workflows are stable.
- Preserve platform-neutral handoff data so later Classroom, Gibbon, or hybrid delivery can be adopted without reworking intake and finance.

## Zoho CRM Removal Rationale

Zoho CRM should be removed from student/admissions workflows because:

- The portal already owns the live operational workflow.
- CRM duplicates lifecycle, queue, communication, and payment-stage concepts.
- CRM side effects create unclear timing: intake-time records versus payment/admission milestone records.
- CRM creates another state surface that operators must reconcile.
- Student admissions workflows do not require deal-pipeline semantics when the portal already has program, status, document, payment, communication, and dashboard logic.
- Keeping CRM invites the team to build adapters and reconciliations instead of simplifying operations.

The correct replacement is not a custom full CRM. The replacement is a disciplined portal workflow engine with explicit handoffs to Books and academic systems.

## Zoho Books Integration Model

Books remains the finance authority.

Recommended model:

- Portal prepares a finance handoff packet when the applicant or customer reaches a defined finance milestone.
- Handoff packet includes identity, payer/customer details, program, amount or fee plan reference, invoice requirement, and correlation ID.
- Books creates or updates the customer and invoice.
- Books owns invoice number, receipt, payment status, balance, and accounting record.
- Portal stores only mirror references needed for operations: Books customer ID, invoice ID/number, receipt/payment status summary, last sync timestamp, and sync result.
- Portal never becomes the ledger.
- Portal never treats CRM IDs as required admissions state.

Operational rule:

- If Books and portal disagree on finance truth, Books wins for finance. The portal may block or flag workflow progression until the discrepancy is reconciled by an operator.

## Google Workspace Leverage Model

Google Workspace should be used intentionally because the target operating model is already Google-centered.

Use:

- Sheets for operational workflow tables and queue state.
- Drive for applicant evidence and controlled file storage.
- Gmail for auditable communications.
- Apps Script for workflow orchestration and lightweight integrations.
- Google Classroom for FODE online delivery and KIA delivery.
- Shared Drive structures for institution/program evidence separation.

Guardrails:

- Document schemas explicitly.
- Avoid hidden operational state in unbounded Script Properties.
- Use bounded cache only for ephemeral state.
- Keep IDs stable across portal, Drive, Books, and LMS handoffs.
- Avoid per-institution copy-paste workflows.
- Build exports and reconciliation views before live automation.

## Risks and Guardrails

### Main Risks

- The Apps Script runtime is already large and could become unmaintainable if every institution is cloned by copy-paste.
- Admin, portal, email, bounce, Drive, Books, and future LMS logic could blur into one large codebase.
- Multiple institutions may drift if each clone edits business logic directly.
- Finance and academic systems may be duplicated inside the portal if boundaries are not enforced.
- A rushed refactor could destabilize a working r147 runtime.

### Engineering Guardrails

- CIS-only changes for controlled systems.
- No runtime mutation without explicit authorization.
- Source/runtime identity discipline: live `whoami` is runtime truth, local source is not deployment proof.
- Deployment checklist for every release: Admin whoami, Student whoami, browser checks, exact acceptance URLs, PASS/FAIL evidence, rollback plan.
- Rollback discipline: prefer deployment repin first where applicable.
- Schema documentation before clone work.
- Configuration-first institution cloning.
- No duplicated hardcoded workflows.
- No new hidden unbounded state.
- No background automation or trigger changes without explicit acceptance.
- Test and verification discipline before each functional release.
- Observable dashboards for gates, property health, last automation run, last batch ID, bounce state, and blocked reasons.

## Refactoring Assessment Before Cloning

### Current Codebase Size and Complexity Risks

Current local size signals:

- `Code.js`: about 8,982 lines.
- `Admin.js`: about 4,790 lines.
- `AdminUI.html`: about 3,906 lines.
- `Utils.js`: about 2,451 lines.

These files are becoming too large for safe multi-institution cloning without a deliberate architecture plan.

Risk interpretation:

- `Code.js` is too broad for long-term portal, intake, route, communication, and helper ownership.
- `Admin.js` is too broad for admin RPCs, stage batching, bounce handling, payment actions, trigger controls, and legacy wrappers.
- `AdminUI.html` is too broad if every institution adds UI conditions directly.
- `Utils.js` is still manageable but could become a dumping ground if shared helpers are not classified.

The current codebase should be refactored before broad cloning, but not with a large rewrite. The right approach is a phased, behavior-preserving modularization with strong release gates.

### Recommended Module Boundaries

Target modules should separate stable core behavior from institution-specific configuration:

- `Routes`: `doGet`, `doPost`, view routing, canonical URL handling.
- `RuntimeIdentity`: version, deploy version, script ID, `whoami`, canonical URL reporting.
- `PortalAccess`: portal secrets, access validation, link generation, reset flows.
- `ApplicantRepository`: row lookup, stable IDs, schema access, row patching.
- `DocumentWorkflow`: document checklist, upload metadata, verification state.
- `PaymentWorkflow`: payment evidence, payment verification, Books handoff readiness.
- `BooksIntegration`: customer/invoice/receipt adapter and sync mirror fields.
- `CommunicationCore`: message families, send eligibility, cooldown, idempotency, bounce suppression.
- `BounceHandling`: bounce ingestion, classification, correlation, operator-visible results.
- `AdminRpc`: RPC registry, read-only versus mutation classifications, response envelopes.
- `DashboardReadModels`: aggregation, queues, operational safety panels.
- `InstitutionConfig`: institution, program, form, fee, Books, Classroom, Gibbon, Drive folder, sender, and template configuration.
- `LmsHandoff`: Classroom or Gibbon handoff packet generation.

### What Can Be Extracted Safely

Safe extraction candidates, when done under separate CIS phases:

- Constants and institution/program configuration into config objects.
- Read-only dashboard aggregation helpers.
- Books handoff payload builder with dry-run output first.
- Runtime identity and canonical URL reporting helpers.
- Message template selection tables.
- Schema maps and column-name constants.
- LMS handoff packet builders that do not perform live LMS writes.
- Documentation-only RPC registry and dangerous-action inventory.

### What Should Not Be Refactored Yet

Do not refactor yet:

- Live send path.
- Bounce writeback path.
- Stage-batch preview/send parity path.
- Trigger install/remove/cadence logic.
- Portal secret reset and active access logic.
- Payment verification mutation path.
- Upload write paths.
- Any code coupled to current r147 acceptance until a rollback-safe CIS exists.

These areas are hot paths or high-impact mutation paths. They should be stabilized by tests and instrumentation before extraction.

### Shared Core Plus Institution Configs

The long-term model should be shared core plus institution configs.

Shared core should contain:

- Runtime identity discipline.
- Routing model.
- Portal access and applicant lookup patterns.
- Document and payment state machine primitives.
- Communication and bounce primitives.
- Books adapter interface.
- Dashboard read models.
- Verification and deployment checklists.

Institution configs should contain:

- Institution key: FODE, KIA, MLC_DIPLOMA, MLC_CORPORATE.
- Programs and intake form IDs.
- Required document sets.
- Fee plans or Books item references.
- Sender/reply-to policy.
- Drive folder roots.
- Classroom/Gibbon handoff mode.
- Admin roles and operator views.
- Templates and wording.
- Stage rules enabled for that institution.

Rule:

- If behavior differs only by institution, prefer configuration.
- If behavior differs by business domain, isolate it behind a module boundary.
- Do not create four independent hardcoded forks.

### Drift Prevention Across Clones

To prevent drift:

- Keep one shared core repository or one canonical core folder.
- Maintain per-institution config files.
- Require schema versioning.
- Require release notes per institution deployment.
- Maintain a clone compatibility checklist.
- Run the same verification suite for every institution clone.
- Keep deployment IDs, Script IDs, and canonical URLs institution-specific but generated reports canonical.
- Do not copy-paste `Code.js`, `Admin.js`, and `AdminUI.html` into new institutions and edit directly without a shared-core plan.

### Refactor Risk Versus Leaving Code As-Is

Risk of refactor:

- High if attempted as a broad rewrite.
- Medium if done through small behavior-preserving extractions.
- Highest around send, trigger, portal secret, upload, payment, and bounce mutation paths.

Risk of leaving as-is:

- Medium for one institution.
- High for multiple institutions.
- Very high if FODE, KIA, MLC Diploma, and MLC Corporate each fork the runtime independently.

Recommendation:

- Do not refactor before the next strategy document is accepted.
- Do refactor before broad cloning.
- Start with non-runtime or read-only extractions and configuration documentation.
- Delay hot-path extraction until tests, fixtures, and rollback plans are in place.

## Clone-Safe Architecture Requirements

Before cloning to KIA or MLC, define:

- Institution config schema.
- Program config schema.
- FormDesigner form-to-field mapping.
- Applicant row schema.
- Required document schema per program.
- Books handoff schema.
- LMS handoff schema.
- Message family schema.
- Dashboard/queue schema.
- Canonical deployment identity checklist.
- Per-institution Drive folder policy.
- Per-institution sender/reply-to policy.
- Per-institution Google Classroom or Gibbon mode.

Minimum clone acceptance:

- Clone can run with config changes only for institution name, form IDs, folder IDs, sender policy, program list, document list, Books item references, and delivery platform mode.
- No clone should require hardcoded edits inside hot-path logic.
- Every clone must expose a `whoami` endpoint and canonical URL report.
- Every clone must have a rollback checklist and deployment repin plan.

## Refactoring Roadmap

### Phase 0: Documentation Lock

- Create this architecture roadmap.
- Confirm no-CRM decision for student/admissions workflows.
- Confirm Books-only finance authority.
- Confirm Google Classroom for FODE and KIA delivery.
- Keep Diploma/Corporate LMS decision deferred.

### Phase 1: Schema and Config Inventory

- Document current FODE row schema.
- Document current message families.
- Document document checklist fields.
- Document payment and Books handoff fields.
- Document FormDesigner field mappings.
- Draft `InstitutionConfig` shape without code changes.

### Phase 2: Read-Only Modularization

- Extract or document read-only registry and dashboard model boundaries.
- Standardize response envelopes where safe.
- Create read-only config previews.
- Add no-write validation helpers before any mutation refactor.

### Phase 3: Integration Boundary Hardening

- Remove CRM dependency from admissions workflows.
- Design Books handoff adapter with dry-run first.
- Define LMS handoff packet for Classroom/Gibbon/deferred modes.
- Keep all live external writes gated and operator-controlled.

### Phase 4: Controlled Hot-Path Extraction

- Extract communication core only after tests cover send eligibility and replay protection.
- Extract bounce handling only after matched/ambiguous/unmatched cases are fixture-tested.
- Extract payment verification only after Books handoff model is stable.
- Extract portal access only with token reset regression tests.

### Phase 5: Clone Pilot

- Pilot KIA or MLC with shared core plus config.
- No broad automation initially.
- Use read-only previews and manual operator acceptance.
- Compare source/runtime identity and dashboard evidence before any live rollout.

## 30/60/90 Day Implementation Roadmap

### First 30 Days

- Accept no-CRM architecture decision.
- Freeze new CRM workflow work.
- Document schemas and handoff boundaries.
- Confirm Google Classroom as delivery platform for FODE and KIA.
- Defer Diploma/Corporate LMS decision.
- Build Books handoff requirements and reconciliation report design.
- Draft institution config schema.
- Identify current hardcoded institution assumptions.

### 60 Days

- Implement config-first pilot plan without broad code rewrite.
- Build Books handoff dry-run and reconciliation views under CIS.
- Create LMS handoff packet design for Classroom, Gibbon, and deferred modes.
- Add dashboard views for Books handoff readiness.
- Create clone checklist and deployment checklist.
- Start behavior-preserving read-only modularization.

### 90 Days

- Pilot one clone using shared core plus institution config.
- Decide Diploma/Corporate LMS mode based on admissions and finance evidence.
- Start controlled Books integration pilot.
- Add Gibbon handoff pilot only where academic/compliance requirements justify it.
- Retire remaining CRM references from student workflow documentation and later from code under separate CIS.
- Prepare long-term shared-core release process.

## What To Defer

Defer:

- Final LMS choice for Diploma in Business Studies.
- Final LMS choice for Diploma in IT.
- Final LMS choice for MLC Corporate Training.
- Live Books writes until dry-run and reconciliation are accepted.
- Gibbon implementation until admitted-student handoff fields are stable.
- Hot-path code refactors.
- Trigger cadence changes.
- Broad automation restarts.
- Any CRM removal from runtime code until explicit CIS and dependency check.

## What Not To Build

Do not build:

- A replacement full CRM.
- A custom full LMS.
- A custom accounting ledger.
- Duplicate Books invoice/payment state.
- Duplicate Gibbon academic record state.
- Per-institution hardcoded forks.
- Hidden Script Properties operational state.
- Unbounded background automation.
- Complex defensive branching where upstream normalization can solve the issue.
- Custom sales pipelines for student admissions.
- A corporate CRM inside Apps Script.

## Decision Log

| Date | Decision | Status |
| --- | --- | --- |
| 2026-05-07 | Remove Zoho CRM from student/admissions workflows. | Proposed strategic decision captured |
| 2026-05-07 | Use Zoho Books only for invoicing, payment, accounting, and finance truth. | Proposed strategic decision captured |
| 2026-05-07 | Use custom Apps Script portal as operational workflow engine. | Proposed strategic decision captured |
| 2026-05-07 | Use Google Classroom for FODE online delivery. | Captured |
| 2026-05-07 | KIA already uses Google Classroom; continue Google Workspace-centered model. | Captured |
| 2026-05-07 | Defer final LMS decision for Diploma in Business Studies, Diploma in IT, and MLC Corporate Training. | Recommended |
| 2026-05-07 | Position Gibbon as academic record/compliance system where needed, not admissions workflow engine. | Recommended |
| 2026-05-07 | Refactor before broad cloning, but only through phased behavior-preserving CIS work. | Recommended |

## Final Recommendation

Proceed with a Google Workspace-centered admissions and operations architecture:

- Portal as workflow engine.
- FormDesigner as intake.
- Books as finance truth.
- Google Classroom as confirmed delivery for FODE and KIA.
- Gibbon as academic/compliance system where justified.
- LMS decision deferred for Diploma and Corporate until admissions and finance workflows are stable.

Do not clone the current runtime as independent hardcoded forks. First define institution configuration, schema documentation, shared core boundaries, deployment discipline, and verification fixtures. Then refactor in phases, starting with documentation, schemas, and read-only boundaries before touching hot paths.
