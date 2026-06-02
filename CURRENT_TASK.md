# Current Task

## Active CIS

- `CIS r212: Extract Applicant Queue UI`.
- Implementation date: `2026-06-01`.
- Work class: `Runtime release - AdminUI Applicant Queue include extraction`.
- Release track: `Track L`.
- Reason for classification: Level 1 AdminUI-only Applicant Queue extraction with revised boundary: markup, CSS, overlay markup, and queue-owned helper JS moved into a dedicated include while shared selected-applicant controller JS remains temporarily in `AdminUI.html`; no backend, role gate, row-facts semantic, Communications behavior, Lifecycle Map behavior, schema, or mutation-path change.
- Intended runtime identity: `r212 / 212`.
- Implementation authorized: `YES`.
- Runtime release authorized: `NO - local implementation and validation only until post-check release authorization`.

### r212 Baseline

- Started from finalized r211 baseline at commit `865fbd5`; `staging-as211` exists.
- `Config.js` was `r211 / 211` before edits and is bumped only to `r212 / 212` after revised-scope local extraction checks passed.
- Pre-existing dirty state remains limited to `.codexhub/SESSION_CONTEXT.md` and `.codexhub/resume_state/latest.json`.
- Known r211+ follow-ups remain out of scope:
  - WhatsApp records are not visible in expected workflow.
  - Bulk email is not properly selecting/selectable by stages.
  - Admin-level information blocks interrupt operator workflow.

### r212 Allowed Edit Files

- `AdminUI.html`
- `AdminUI_OpsApplicantQueue.html`
- `Config.js`
- `CURRENT_TASK.md`

### r212 Implementation Notes

- Created `AdminUI_OpsApplicantQueue.html`.
- Moved the OPS Applicant Queue section markup out of `AdminUI.html` and replaced it with the standard Apps Script include call in the same location.
- Moved Applicant Queue-specific CSS into the new include.
- Moved Applicant Queue overlay markup into the new include:
  - `opsApplicantContextMenu`
  - `opsApplicantReviewDrawer`
- Moved queue-owned helper JS into the new include:
  - queue export helpers
  - selected-applicant identity/context helpers
  - queue row lookup helpers
  - queue search/sort helpers
  - queue marker / email-issue / dropped-ineligible helper functions
  - selected applicant mini-summary renderer
- Revised r212 boundary accepted: shared selected-applicant controller JS remains temporarily in `AdminUI.html` because it is cross-surface logic used by Applicant Queue, Communications, Billing, Classroom, and Portal Diagnostics.
- Accepted remaining shared controller functions in `AdminUI.html`:
  - `opsHideContextMenu_`
  - `opsShowApplicantContextMenu_`
  - `opsHandleApplicantMenuAction_`
  - `opsAttachApplicantRowMenu_`
  - `renderOpsQueue_`
  - `renderOpsApplicantSummary_`
  - `fetchOpsApplicantSummary_`
  - `opsSetQueueFilter_`
  - `opsAdminDeepLink_`
  - `opsOpenLegacyAdminReview_`
  - `opsCloseApplicantReviewDrawer_`
  - `opsReviewField_`
  - `opsRenderApplicantReviewDrawer_`
  - `opsOpenApplicantReviewDrawer_`
  - `opsOpenApplicantReview_`
  - `opsOpenPortalStatus_`
- Recommended future owner for the remaining shared controller layer: a dedicated shared selected-applicant controller include/module, not the Applicant Queue include.
- Preserved function names, element IDs, CSS classes, event handlers, global references, selected applicant behavior, lifecycle-stage filtering behavior, and cross-surface selected-applicant interactions.
- Did not modify Communications include ownership, Lifecycle Map include ownership, backend RPCs, payloads, row-facts semantics, or Dropped/Ineligible rules.
- No send/export/mutation action was triggered.

### r212 Release Evidence

- Local validation: PASS; revised-scope local checks passed, `Config.js` was confirmed at `r212 / 212`, `AdminUI.html` includes `AdminUI_OpsApplicantQueue.html`, `AdminUI_OpsApplicantQueue.html` contains the extracted Applicant Queue markup/CSS/overlay plus queue-owned helper JS, accepted shared selected-applicant controller functions remain in `AdminUI.html`, only allowed files changed, and no send/export/mutation action was run.
- Git hygiene addendum: use `git status -sb` and `git ls-files --others --exclude-standard` before any release step because `AdminUI_OpsApplicantQueue.html` is a new file.
- Remote-source proof: PASS by operator-supplied Apps Script editor evidence confirming `Config.js` = `r212 / 212`, remote `AdminUI_OpsApplicantQueue.html` exists, and remote `AdminUI.html` contains the `AdminUI_OpsApplicantQueue` include.
- Apps Script platform version: `232`.
- Admin deployment pin: `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ @232`.
- Student deployment pin: `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv @232`.
- Admin whoami: PASS, `r212 / 212`, `mismatch=false`.
- Student whoami: PASS, `r212 / 212`, `mismatch=false`.
- Browser/operator acceptance: PASS by operator evidence; OPS Cockpit loads, runtime shows `r212 / 212`, Runtime Verified, Admin/Student whoami match, no drift mismatch warning, Lifecycle Cascade renders, Applicant Queue renders after extraction, Dropped / Ineligible remains visible as display-only with count `0` in the loaded queue, Communications/Billing/Portal Diagnostics/Classroom/Reports all render, no red blocking UI error observed, and no send/export/mutation action was executed.

## Previous CIS

- `CIS r211: Extract Lifecycle Map UI`.
- Implementation date: `2026-06-01`.
- Work class: `Runtime release - AdminUI Lifecycle Map include extraction`.
- Release track: `Track L`.
- Reason for classification: Level 1 AdminUI-only include extraction for the OPS Lifecycle Map; no backend, role gate, row-facts semantic, Communications, Applicant Queue, schema, or mutation-path change.
- Intended runtime identity: `r211 / 211`.
- Implementation authorized: `YES`.
- Runtime release authorized: `YES, pending release gates`.

### r211 Baseline

- Started from finalized r210 baseline at commit `75826dc`; `staging-as210` exists.
- `Config.js` was `r210 / 210` before edits and is bumped only to `r211 / 211` for this release.
- Pre-existing dirty state remains limited to `.codexhub/SESSION_CONTEXT.md` and `.codexhub/resume_state/latest.json`.
- Known r211+ follow-ups from r210 remain out of scope:
  - WhatsApp records are not visible in expected workflow.
  - Bulk email is not properly selecting/selectable by stages.
  - Admin-level information blocks interrupt operator workflow.

### r211 Allowed Edit Files

- `AdminUI.html`
- `AdminUI_OpsLifecycle.html`
- `Config.js`
- `CURRENT_TASK.md`

### r211 Implementation Notes

- Created `AdminUI_OpsLifecycle.html`.
- Moved the OPS Lifecycle Map section markup out of `AdminUI.html` and replaced it with the standard Apps Script include call in the same location.
- Moved the lifecycle-specific CSS block for `opsStageCascade` / `opsStageCard` into the new include.
- Moved the lifecycle-specific function block into the new include:
  - `opsLifecycleDefinitions_`
  - `opsWorkflowStageKey_`
  - `opsLifecycleStageKeyFromFacts_`
  - `opsDeriveLifecycleStateFromRawRow_`
  - `opsWorkflowStageLabel_`
  - `opsRowsForLifecycleStage_`
  - `renderOpsLifecycleCascade_`
- Preserved function names, element IDs, CSS classes, event handlers, and lifecycle behavior exactly.
- Did not modify Communications, Applicant Queue extraction boundaries, Billing, Portal Diagnostics, Classroom, Reports, backend RPCs, payloads, row-facts semantics, or Dropped/Ineligible rules.
- No send/export/mutation action was triggered.

### r211 Release Evidence

- Local validation: PASS; `git diff --check` passed aside from CRLF warnings, `git diff --name-only` remained limited to allowed files plus `.codexhub`, `AdminUI_OpsLifecycle.html` exists, `AdminUI.html` includes `AdminUI_OpsLifecycle`, moved Lifecycle Map source is no longer duplicated in `AdminUI.html`, backend files remained unchanged, `Config.js` changed only to `r211 / 211`, `AdminUI_SharedRowFacts.html` and `AdminUI_OpsCommunications.html` remained unchanged, and no send/export/mutation action was run.
- Remote-source proof: PASS by operator-supplied Apps Script editor evidence confirming `Config.js` = `r211 / 211`, remote `AdminUI_OpsLifecycle.html` exists and contains the extracted Lifecycle Map code, and remote `AdminUI.html` contains `<?!= HtmlService.createHtmlOutputFromFile('AdminUI_OpsLifecycle').getContent(); ?>`.
- Apps Script platform version: `231`.
- Admin deployment pin: `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ @231`.
- Student deployment pin: `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv @231`.
- Admin whoami: PASS, `r211 / 211`, `mismatch=false`.
- Student whoami: PASS, `r211 / 211`, `mismatch=false`.
- Browser/operator acceptance: PASS by operator evidence; OPS Cockpit loads, runtime shows `r211 / 211`, Runtime Verified, Admin/Student whoami match, no drift mismatch warning, Lifecycle Cascade renders from extracted include, Dropped / Ineligible remains display-only, Applicant Queue/Communications/Billing/Portal Diagnostics/Classroom/Reports all render, no red blocking UI error observed, and no send/export/mutation action was executed.

- `CIS r210A: Dropped / Ineligible Terminal Hardening - Communications, Lifecycle, Applicant Queue Only`.
- Implementation date: `2026-06-01`.
- Work class: `Runtime release - AdminUI-only UI semantic hardening`.
- Release track: `Track L`.
- Reason for classification: UI-side terminal lifecycle hardening in shared row facts, Lifecycle/Applicant Queue display, and Communications queue predicates; no backend, role gate, send/export, schema, deployment architecture, or mutation-path change.
- Intended runtime identity: `r210 / 210`.
- Implementation authorized: `YES`.
- Runtime release authorized: `YES, pending release gates`.

### r210 Baseline

- Started from finalized r209 baseline; `staging-as209` exists.
- `Config.js` was `r209 / 209` before edits and is bumped to `r210 / 210` for this release.
- Pre-existing dirty state remains limited to `.codexhub/SESSION_CONTEXT.md` and `.codexhub/resume_state/latest.json`.
- Architecture benchmark remains `docs/FODE_ARCHITECTURE_MAP_r205.md`.

### r210 Allowed Edit Files

- `AdminUI.html`
- `AdminUI_SharedRowFacts.html`
- `AdminUI_OpsCommunications.html`
- `Config.js`
- `CURRENT_TASK.md`

### r210 Implementation Notes

- Added explicit row-facts terminal aliases: `isDroppedIneligible`, `isTerminalLifecycle`, `terminalReason`, and `activeProgressionAllowed`.
- Routed Communications queue predicates through shared row facts so terminal rows are excluded from sendable/action-oriented queues, including Email Issue handoff and WhatsApp fallback.
- Kept `Dropped / Ineligible` visible as a display-only Lifecycle/Applicant Queue state and changed the row action button for terminal records to disabled `No active progression`.
- Did not modify Billing, Classroom, Reports/export, backend RPCs, payloads, send/export/mutation logic, role gates, schema, or Apps Script app configuration.
- No send/export/mutation action was triggered.

### r210 Release Evidence

- Local validation: `git diff --check` PASS; `AdminUI.html`, `AdminUI_SharedRowFacts.html`, and `AdminUI_OpsCommunications.html` script parse checks PASS.
- Scoped runtime diff: `AdminUI.html`, `AdminUI_SharedRowFacts.html`, `AdminUI_OpsCommunications.html`, `CURRENT_TASK.md`, `Config.js`; `Admin.js`, `Code.js`, `Utils.js`, `Routes.js`, `appsscript.json`, and `whoami_admin.html` have no diff.
- Local identity before version: `VERSION: "r210"`, `DEPLOY_VERSION_NUMBER: 210`.
- `clasp push`: PASS; output reported `Pushed 10 files at 11:21:17 am.` and did not report `Skipping push`.
- Remote-source proof: PASS via Apps Script REST API content endpoint; no `clasp pull`, `clasp clone`, temp repo, verification folder, or source copy was created.
  - Remote `Config.js`: `VERSION: "r210"`, `DEPLOY_VERSION_NUMBER: 210`.
  - Remote `AdminUI_SharedRowFacts.html`: `opsBuildRowFacts_`, `isTerminalLifecycle`, `activeProgressionAllowed`, and `terminalReason` markers present.
  - Remote `AdminUI_OpsCommunications.html`: terminal-excluding Email Issue and WhatsApp fallback row-facts queue markers present.
  - Remote `AdminUI.html`: `No active progression` terminal display marker present.
  - Safety markers present: `data-ops-operational-write`, `data-ops-supervisory-write`, and `opsOperationalExecutionAllowed_`.
- Apps Script platform version: `230`.
- Admin deployment pin: `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ @230`.
- Student deployment pin: `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv @230`.
- Admin whoami: PASS, `r210 / 210`, `mismatch=false`.
- Student whoami: PASS, `r210 / 210`, `mismatch=false`.
- Admin OPS source acceptance URL: `https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec?view=ops`.
- Source acceptance: PASS for OPS shell, Lifecycle Map, Applicant Queue, Communications, Billing, Portal Diagnostics, Classroom, Reports, r210 marker, terminal row-facts markers, Communications terminal exclusion markers, `No active progression`, and safety markers.
- Browser/operator acceptance: PASS.
  - OPS Cockpit loads.
  - Runtime is `r210 / 210`.
  - Admin whoami and Student whoami passed.
  - Main OPS surfaces render.
  - Dropped/Ineligible terminal hardening is accepted.
  - No send/export/mutation action was executed.
- Non-blocking r211+ follow-ups:
  - WhatsApp records are not visible in the expected workflow.
  - Bulk email is not properly selecting / selectable by stages.
  - Admin-level information blocks are interrupting operator workflow.

- `CIS r209: Extract OPS Communications Module`.
- Implementation date: `2026-06-01`.
- Work class: `Runtime release - AdminUI OPS Communications include extraction`.
- Release track: `Track L`.
- Reason for classification: AdminUI-only template/module extraction and release identity update; no backend, role gate, send/export, schema, deployment architecture, or mutation-path change.
- Intended runtime identity: `r209 / 209`.
- Implementation authorized: `YES`.
- Runtime release authorized: `YES, pending release gates`.

### r209 Baseline

- Started from finalized r208 baseline; `staging-as208` exists.
- `Config.js` was `r208 / 208` before edits and is bumped to `r209 / 209` for this release.
- Pre-existing dirty state remains limited to `.codexhub/SESSION_CONTEXT.md` and `.codexhub/resume_state/latest.json`.
- Parked r204 patch remains audit/reference only and was not reapplied.

### r209 Allowed Edit Files

- `AdminUI.html`
- `AdminUI_OpsCommunications.html`
- `Config.js`
- `CURRENT_TASK.md`

### r209 Implementation Notes

- Created `AdminUI_OpsCommunications.html`.
- Moved OPS Communications queue/workflow/template/handoff render/event functions into the new include file.
- Moved selected-applicant OPS email preview/send/timeline handlers into the new include file.
- Implemented the Communications include as a standalone `<script>` include because `HtmlService.createHtmlOutputFromFile()` parses included files as HTML, and raw Communications JavaScript contains HTML string fragments.
- Left shared row facts in `AdminUI_SharedRowFacts.html`.
- Left global shell routing, lifecycle, applicant queue, billing, portal diagnostics, classroom, reports, shared safety gates, and stage-batch internals in `AdminUI.html`.
- Preserved function names exactly and left call sites unchanged.
- No UI layout, labels, buttons, gates, backend behavior, send/export/preview behavior, schema, or Apps Script app configuration were changed.

### r209 Release Evidence

- Local validation: `git diff --check` PASS; expanded AdminUI syntax check PASS with `AdminUI_SharedRowFacts.html` and `AdminUI_OpsCommunications.html` substituted into `AdminUI.html`.
- Scoped runtime diff: `AdminUI.html`, `AdminUI_OpsCommunications.html`, `CURRENT_TASK.md`, `Config.js`; `Admin.js`, `Code.js`, `Utils.js`, and `appsscript.json` have no diff.
- Apps Script version count before release: `167`, below stop threshold.
- Local identity before version: `VERSION: "r209"`, `DEPLOY_VERSION_NUMBER: 209`.
- Remote-source proof: Apps Script REST API confirmed remote `Config.js` is `r209 / 209`; remote `AdminUI.html` contains the `AdminUI_OpsCommunications` include; remote `AdminUI_OpsCommunications.html` exists and contains Communications queue/workspace/preview/send functions; remote `AdminUI_SharedRowFacts.html` still exists and contains `opsBuildRowFacts_`; safety markers remain in `AdminUI.html`.
- Apps Script platform version `227` was created and repinned first, but browser/source acceptance failed with `ROUTE FAILURE` because the raw Communications include was parsed as malformed HTML. It was not accepted.
- Corrected Apps Script platform version `228` passed acceptance, then final EOF whitespace cleanup was pushed forward for local/remote source parity.
- Final Apps Script platform version: `229`.
- Admin deployment pin: `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ @229`.
- Student deployment pin: `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv @229`.
- Admin whoami: PASS, `r209 / 209`.
- Student whoami: PASS, `r209 / 209`.
- Browser/source acceptance URL: `https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec?view=ops`.
- Browser/source acceptance: PASS for no route failure, OPS shell, Communications, Lifecycle Map, Applicant Queue, Billing, Portal Diagnostics, Classroom, included Communications functions, included row facts, and safety markers.
- No send/export/mutation action was triggered.

## Previous CIS

- `CIS r208: AdminUI Include Pattern Proof`.
- Implementation date: `2026-06-01`.
- Work class: `Runtime release - AdminUI include/module split proof`.
- Release track: `Track L`.
- Reason for classification: UI template/module refactor and release identity update only; no backend, role gate, send/export, schema, deployment architecture, or mutation-path change.
- Intended runtime identity: `r208 / 208`.
- Implementation authorized: `YES`.
- Runtime release authorized: `YES, pending release gates`.

### r208 Baseline

- Started from finalized r207 baseline; `staging-as207` exists.
- `Config.js` was `r207 / 207` before edits and is bumped to `r208 / 208` for this release.
- Pre-existing dirty state remains limited to `.codexhub/SESSION_CONTEXT.md` and `.codexhub/resume_state/latest.json`.
- Parked r204 patch remains audit/reference only and was not reapplied.

### r208 Allowed Edit Files

- `AdminUI.html`
- `AdminUI_SharedRowFacts.html`
- `Config.js`
- `CURRENT_TASK.md`

### r208 Implementation Notes

- Existing backend include helper was not present, and no backend file was edited.
- Used Apps Script template include syntax directly in `AdminUI.html`: `HtmlService.createHtmlOutputFromFile('AdminUI_SharedRowFacts').getContent()`.
- Created `AdminUI_SharedRowFacts.html` and moved only `opsBuildRowFacts_(row)` plus row-facts wrapper entry points into it.
- Preserved function names exactly and left call sites unchanged.
- No UI controls, backend behavior, role gates, send/export/mutation logic, schema, or Apps Script app configuration were changed.

### r208 Release Evidence

- Local validation: `git diff --check` PASS; expanded AdminUI include script syntax check PASS with `AdminUI_SharedRowFacts.html` substituted into `AdminUI.html`.
- Scoped runtime diff: `AdminUI.html`, `AdminUI_SharedRowFacts.html`, `CURRENT_TASK.md`, `Config.js`; `Admin.js`, `Code.js`, and `Utils.js` have no diff.
- Apps Script version count before release: `166`, below stop threshold.
- Local identity before version: `VERSION: "r208"`, `DEPLOY_VERSION_NUMBER: 208`.
- Remote-source proof: Apps Script REST API confirmed remote `Config.js` is `r208 / 208`; remote `AdminUI.html` contains the `AdminUI_SharedRowFacts` include; remote `AdminUI_SharedRowFacts.html` exists and contains `opsBuildRowFacts_`; safety markers remain in `AdminUI.html`.
- Apps Script platform version: `226`.
- Admin deployment pin: `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ @226`.
- Student deployment pin: `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv @226`.
- Admin whoami: PASS, `r208 / 208`.
- Student whoami: PASS, `r208 / 208`.
- Browser/source acceptance URL: `https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec?view=ops`.
- Browser/source acceptance: PASS for OPS shell, Lifecycle Map, Applicant Queue, Communications, Billing, Portal Diagnostics, Classroom, rendered included `opsBuildRowFacts_`, and safety markers.
- No send/export/mutation action was triggered.

## Previous CIS

- `CIS r207: Row Facts Phase 3 Remaining OPS Surfaces`.
- Implementation date: `2026-05-31`.
- Work class: `Runtime release - AdminUI-only row facts adoption across remaining OPS labels`.
- Release track: `Track L`.
- Reason for classification: AdminUI-only UI label/refactor work plus release identity update; no backend, role gate, send/export, schema, deployment architecture, or mutation-path change.
- Intended runtime identity: `r207 / 207`.
- Implementation authorized: `YES`.
- Runtime release authorized: `YES, pending release gates`.

### r207 Baseline

- Started from finalized r206 baseline; `staging-as206` exists and `staging-as204` remains absent by design.
- `Config.js` was `r206 / 206` before edits and is bumped to `r207 / 207` for this release.
- Pre-existing dirty state remains limited to `.codexhub/SESSION_CONTEXT.md`, `.codexhub/resume_state/latest.json`, and explained `CURRENT_TASK.md` state.
- Parked r204 patch remains audit/reference only and was not reapplied.

### r207 Allowed Edit Files

- `AdminUI.html`
- `Config.js`
- `CURRENT_TASK.md`

### r207 Implementation Notes

- Kept `opsBuildRowFacts_(row)` as the central UI-side facts helper.
- Added explicit row-facts wrappers/markers for remaining OPS display surfaces: `opsBillingRowFacts_`, `opsPortalDiagnosticsFacts_`, `opsClassroomHandoverFacts_`, and `opsReportRowFacts_`.
- Routed Billing, Portal Diagnostics, Classroom/Handover, Reports/export display labels, and remaining legacy workflow summaries through shared row facts where safe.
- Preserved r206 Lifecycle Map, Applicant Queue, and Communications classifier behavior; Ready to Contact remains exclusive and cooldown/recent contact remains waiting/blocked.
- No `Admin.js`, `Code.js`, `Utils.js`, backend send/export/mutation logic, role gates, sender/cooldown backend logic, Books/portal/payment/classroom backend logic, or schema was changed.

### r207 Release Evidence

- Local validation: `git diff --check` PASS; extracted AdminUI script syntax check PASS after Apps Script template blocks were replaced by local check literals.
- Scoped runtime diff: `AdminUI.html`, `CURRENT_TASK.md`, `Config.js`; `Admin.js`, `Code.js`, and `Utils.js` have no diff.
- Apps Script version count before release: `165`, below stop threshold.
- Local identity before version: `VERSION: "r207"`, `DEPLOY_VERSION_NUMBER: 207`.
- Remote-source proof: Apps Script REST API confirmed remote `Config.js` is `r207 / 207`; remote `AdminUI.html` contains `opsBuildRowFacts_`, `opsBillingRowFacts_`, `opsPortalDiagnosticsFacts_`, `opsClassroomHandoverFacts_`, `opsReportRowFacts_`, `data-ops-operational-write`, `data-ops-supervisory-write`, and `opsOperationalExecutionAllowed_`.
- Apps Script platform version: `225`.
- Admin deployment pin: `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ @225`.
- Student deployment pin: `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv @225`.
- Admin whoami: PASS, `r207 / 207`.
- Student whoami: PASS, `r207 / 207`.
- Browser/source acceptance URL: `https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec?view=ops`.
- Browser/source acceptance: PASS for OPS shell, Lifecycle Map, Applicant Queue, Communications, Billing, Portal Diagnostics, Classroom, row-facts adoption markers, and distinct awaiting-upload/uploaded-review/payment-evidence/payment-verified labels. Apps Script served slash-containing labels with escaped `/`, accepted as source-equivalent.
- No send/export/mutation action was triggered.

## Previous CIS

- `CIS r206: Row Facts Adoption Phase 2`.
- Implementation date: `2026-05-31`.
- Work class: `Runtime release - AdminUI-only shared row facts adoption`.
- Release track: `Track L`.
- Reason for classification: AdminUI-only lifecycle/applicant queue row-facts refactor plus release identity update; no backend, role gate, send/export, schema, or mutation-path change.
- Intended runtime identity: `r206 / 206`.
- Implementation authorized: `YES`.
- Runtime release authorized: `YES, pending release gates`.

### r206 Baseline

- Started from finalized r205 baseline; `staging-as205` exists and `staging-as204` remains absent by design.
- `Config.js` was `r205 / 205` before edits and is bumped to `r206 / 206` for this release.
- Pre-existing dirty state: `.codexhub/SESSION_CONTEXT.md`, `.codexhub/resume_state/latest.json`, and `CURRENT_TASK.md` `CODEXHUB_STATE_BACKUP` only; operator cleared this soft blocker and authorized continuing without reverting it.
- Parked r204 patch remains reference only and was not reapplied.

### r206 Allowed Edit Files

- `AdminUI.html`
- `Config.js`
- `CURRENT_TASK.md`

### r206 Implementation Notes

- Kept `opsBuildRowFacts_(row)` as the central UI-side facts helper.
- Added row-facts adoption wrappers/markers for Lifecycle Map and Applicant Queue: `opsLifecycleStageKeyFromFacts_` and `opsApplicantQueueFacts_`.
- Routed Lifecycle Map stage matching/counts and Applicant Queue display/context labels through row facts.
- Added UI-side document/payment state labels so awaiting uploads, uploaded review, document correction, payment evidence, and payment verified remain distinct.
- Preserved r205 Communications row-facts behavior; no send/export/mutation path was changed or triggered.
- No `Admin.js`, `Code.js`, `Utils.js`, backend send/export/mutation logic, role gates, sender/cooldown backend logic, Books/portal/payment/classroom backend logic, or schema was changed.

### r206 Release Evidence

- Local validation: `git diff --check` PASS; extracted AdminUI script syntax check PASS after Apps Script template literals were replaced by local check literals.
- Scoped runtime diff: `AdminUI.html`, `CURRENT_TASK.md`, `Config.js`; `Admin.js`, `Code.js`, and `Utils.js` have no diff.
- Local identity before version: `VERSION: "r206"`, `DEPLOY_VERSION_NUMBER: 206`.
- Remote-source proof: Apps Script REST API confirmed remote `Config.js` is `r206 / 206`; remote `AdminUI.html` contains `opsBuildRowFacts_`, `opsLifecycleStageKeyFromFacts_`, `opsApplicantQueueFacts_`, `data-ops-operational-write`, `data-ops-supervisory-write`, and `opsOperationalExecutionAllowed_`.
- Apps Script platform version: `224`.
- Admin deployment pin: `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ @224`.
- Student deployment pin: `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv @224`.
- Admin whoami: PASS, `r206 / 206`.
- Student whoami: PASS, `r206 / 206`.
- Browser/source acceptance: PASS from canonical Admin OPS GET/source markers for `opsLifecycleMap`, `opsAdmissionsQueue`, `opsCommunications`, `Awaiting Uploads / Document Evidence Pending`, `Uploaded / Review Required`, `Document Correction Required`, `Payment Evidence`, `Payment Verified`, and `Dropped / Ineligible`.
- No send/export/mutation action was triggered.

## Previous CIS

- `CIS r205: Shared Row Facts / Classifier Refactor Phase 1`.
- Implementation date: `2026-05-31`.
- Work class: `Runtime release - AdminUI-only refactor-readiness correction`.
- Release track: `Track L`.
- Reason for classification: AdminUI-only shared row facts/classifier refactor and release identity update; no backend, role gate, send/export, schema, or mutation-path change.
- Intended runtime identity: `r205 / 205`.
- Implementation authorized: `YES`.
- Runtime release authorized: `NO - implementation only; no clasp push, version, deployment repin, browser acceptance, commit, tag, or push in this turn`.

### Baseline

- Started from clean r203 runtime source at HEAD `bb2b190 / staging-as203`.
- Parked r204 patch was preserved under `audits/` and treated as reference only; it was not reapplied.
- Dirty non-source state before edits: `.codexhub/SESSION_CONTEXT.md`, `.codexhub/resume_state/latest.json`, and untracked r204 audit files.
- `Config.js` was bumped from `r203 / 203` to `r205 / 205` only after implementation began.

### Allowed Edit Files

- `AdminUI.html`
- `Config.js`
- `CURRENT_TASK.md`

### Implementation Notes

- Added `opsBuildRowFacts_(row)` in `AdminUI.html` as a shared row-facts helper for OPS Communications.
- Routed OPS Communications queue classification through row facts for effective email, phone/WhatsApp, email issue, lifecycle stage, document state, recent contact, and cooldown facts.
- Made actionable communication queues exclude recent-contact/cooldown facts in the client classifier.
- Made Email Issue rows block direct email queues and route to Email Issue / WhatsApp fallback classification only.
- Separated `Awaiting Uploads / Document Evidence Pending` from `Uploaded / Review Required` in the row-facts document state used by Communications classification.
- Routed selected communication record display and template recipient binding through row facts.
- Added `opsSelectCommunicationRow_(applicantId)` so Communication queue row selection binds ApplicantID/name/email/phone/stage from loaded row facts.
- Added minimal Communications multi-select state and recipient counts using row facts without adding a new bulk send/export path.
- Used `docs/FODE_ARCHITECTURE_MAP_r205.md` as the r205 Phase 1 benchmark; parked r204 patch remains reference only and was not reapplied wholesale.
- No `Admin.js`, `Code.js`, `Utils.js`, backend send/export/mutation logic, role gates, sender/cooldown backend logic, or schema was changed.
- No live send/export/mutation action was run.

### Acceptance Status

- Benchmark source acceptance against `docs/FODE_ARCHITECTURE_MAP_r205.md`: PASS.
  - `opsBuildRowFacts_(row)` exists.
  - Ready to Contact excludes recent/cooldown rows and review-only/terminal states.
  - Cooldown / Recently Contacted is classified as waiting/blocked, not actionable.
  - Email Issue rows are excluded from direct email queues.
  - Awaiting uploads and Uploaded / Review Required use separate row-facts document states.
  - One selected Communications row derives ApplicantID, email, phone, and lifecycle stage from row facts.
  - Multi-select recipient loaded/missing counts use row facts.
  - No Admin.js / Code.js / Utils.js diff.
- Local source checks: PASS.
  - `git diff --check`: PASS; CRLF conversion warnings only for existing files.
  - `Select-String -Path Config.js -Pattern "VERSION|DEPLOY_VERSION_NUMBER"`: `VERSION: "r205"`, `DEPLOY_VERSION_NUMBER: 205`.
- `clasp push`: PASS.
  - Output: `Pushed 8 files at 8:15:29 pm.`
- Remote source proof: PASS via Apps Script API content endpoint; no verification folder or source copy was created.
  - Remote `Config.js`: `VERSION: "r205"`, `DEPLOY_VERSION_NUMBER: 205`.
  - Remote `AdminUI.html`: `opsBuildRowFacts_`, Ready/recent-cooldown exclusion, cooldown wait/blocked, Email Issue classifier, Uploaded / Review Required split, `Bulk cohort selected`, and `Email recipients` markers present.
- Apps Script platform version: `223`.
- Admin staging deployment: `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ @223`.
- Student staging deployment: `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv @223`.
- Admin whoami: PASS, `r205 / 205`, `mismatch=false`.
- Student whoami: PASS, `r205 / 205`, `mismatch=false`.
- Browser/source acceptance: PASS by read-only deployed OPS source marker checks.
  - Markers: `r205`, `opsBuildRowFacts_`, `Ready to Contact`, `cooldown_recent` / `Recently Contacted`, `uploaded_review_required` / `Review Required`, `Bulk cohort selected`, `Email recipients`.
- No send/export/mutation action was run.
- Git finalization: PASS.
  - Commit message: `release: r205 shared row facts classifier`.
  - Tag: `staging-as205`.
  - Push: PASS.

## Previous Active CIS

- `CIS r203: OPS Communications Work-Queue Surface`.
- Implementation date: `2026-05-28`.
- Work class: `Runtime release - AdminUI-only communications surface redesign`.
- Release track: `Track L`.
- Reason for classification: AdminUI-only UI restructuring plus release identity update; no backend, role gate, send logic, schema, or mutation-path change.
- Intended runtime identity: `r203 / 203`.
- Implementation authorized: `YES`.
- Runtime release authorized: `YES, pending release gates`.

### Baseline

- Expected baseline verified before edits:
  - `git status -sb`: only `.codexhub/SESSION_CONTEXT.md` and `.codexhub/resume_state/latest.json` dirty.
  - `git diff --check`: PASS.
  - `git log --oneline -5`: HEAD `f98894c release: r202 campaign traffic report`.
  - `staging-as202` tag present.
- Stop gate passed before edits: no source file outside `.codexhub` was dirty.

### Allowed Edit Files

- `AdminUI.html`
- `Config.js`
- `CURRENT_TASK.md`

### Implementation Notes

- `AdminUI.html` changes OPS Communications from template-first to work-queue-first.
- The new Communications layout is:
  - left: `Communication Work Queues`
  - middle: `Records / Selected Applicant Context`
  - right: `Preview / Edit / Send Gate / Audit`
  - bottom: bulk communication path and timeline/cooldown/blocker/role status.
- Work queue entries added:
  - `Ready to Contact`
  - `Missing Documents`
  - `Docs Quote Ready`
  - `Invoice / Payment Follow-Up`
  - `Portal Access / Reminder`
  - `Email Issue / Contact Correction`
  - `WhatsApp Fallback`
  - `Cooldown / Recently Contacted`
  - read-only legacy campaign summary workflow marker.
- Queue counts are calculated only from already-loaded OPS queue rows when available; otherwise the UI displays `Count unavailable in current loaded data`.
- Template Quick Look remains available but is secondary under selected queue/action context.
- `Quote / Fee Estimate` is visible as a workflow/template item and explicitly marked `backend exists, OPS wiring pending`; no quote sender is called.
- Bulk communication controls are visible from Communications and reuse existing stage batch preview/send functions, buttons, role gates, caps, confirmation, and backend gates.
- No `Admin.js`, `Code.js`, `Utils.js`, `Routes.js`, `AGENTS.md`, docs, schema/header, role/permission, sender/template backend, email send behavior, cooldown, Books, portal, payment, or classroom logic was changed.
- No real send/export/mutation was run during implementation.

### Acceptance Status

- Local source checks: PASS.
  - `git diff --name-only -- AdminUI.html Config.js CURRENT_TASK.md`: `AdminUI.html`, `CURRENT_TASK.md`, `Config.js`.
  - `git diff --check -- AdminUI.html Config.js CURRENT_TASK.md`: PASS.
  - `Select-String -Path Config.js -Pattern "VERSION|DEPLOY_VERSION_NUMBER"`: `VERSION: "r203"`, `DEPLOY_VERSION_NUMBER: 203`.
  - Full dirty scope: only `.codexhub/SESSION_CONTEXT.md`, `.codexhub/resume_state/latest.json`, `AdminUI.html`, `CURRENT_TASK.md`, and `Config.js`.
- Remote source proof: PASS by operator-confirmed Apps Script editor verification after `clasp push`.
  - `Config.js` contains `VERSION: "r203"`.
  - `Config.js` contains `DEPLOY_VERSION_NUMBER: 203`.
  - `AdminUI.html` contains `Ready to Contact`.
  - `AdminUI.html` contains `Docs Quote Ready`.
  - `AdminUI.html` contains `Invoice / Payment Follow-Up`.
  - `AdminUI.html` contains `Email Issue / Contact Correction`.
  - `AdminUI.html` contains `Quote / Fee Estimate`.
  - Safety markers present: `data-ops-operational-write`, `data-ops-supervisory-write`, `opsOperationalExecutionAllowed_`.
- Apps Script platform version: `221`.
- Admin staging deployment: `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ @221`.
- Student staging deployment: `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv @221`.
- Admin whoami URL: `https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec?view=whoami`.
  - PASS: embedded authoritative runtime payload reports `version="r203"`, `deployVersion=203`, `mismatch=false`.
- Student whoami URL: `https://script.google.com/macros/s/AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv/exec?view=whoami`.
  - PASS: embedded authoritative runtime payload reports `version="r203"`, `deployVersion=203`, `mismatch=false`.
- Browser/source acceptance: PASS by operator-supplied deployed-page HTML evidence.
  - Communications opened as work-queue-first.
  - `Communication Work Queues`, `Records / Selected Applicant Context`, and `Preview / Edit / Send Gate / Audit` sections are present.
  - `Template Quick Look` is demoted to secondary reference.
  - `Bulk Communication Path` is visible from Communications.
  - Safety wording is present for Operator, Operations Admin, and Super Admin.
  - Existing gate markers remain present, including `data-ops-operational-write`.
  - No send, export, or mutation action was triggered.
- No real send, export, or mutation action was run during implementation or deployment.

## Previous Active CIS

- `CIS r202: Meta Landing Traffic Bridge + Portal Submission Reporting`.
- Implementation date: `2026-05-28`.
- Work class: `Runtime release - read-only Admin/Ops campaign traffic versus application reporting`.
- Release track: `Track H`.
- Reason for classification: new read-only Admin RPC plus Admin/Ops portal reporting UI surface.
- Intended runtime identity: `r202 / 202`.
- Implementation authorized: `YES`.
- Runtime release authorized: `YES, pending release gates`.

### Allowed Edit Files

- `AdminUI.html`
- `Admin.js`
- `Config.js`
- `CURRENT_TASK.md`

### Scope

- Add the Admin/Ops Reports card `FODE Campaign Traffic vs Applications`.
- Add read-only RPC `admin_getCampaignApplicationReport`.
- Return aggregate counts only from existing application rows.
- Keep Meta fields operator-entered/manual only.
- Add safe calculations for landing conversion, cost per application, cost per valid application, and drop-off.
- Update local release identity to `r202 / 202`.

### Implementation Notes

- `Admin.js` adds an Admin-gated read-only aggregate RPC and helper functions.
- The RPC reads existing sheet data only, scans once for the selected/default date range, and returns counts only.
- The RPC returns no applicant names, email, phone, row-level records, or other applicant PII.
- `AdminUI.html` adds the report card in `opsReports`, not in Super Admin release/governance controls.
- Manual Meta fields are labelled `Manual / Meta`.
- Zero or blank denominators render as `Not available`; cost calculations do not emit misleading zero-cost values.
- No sheet schema/header changes, FormDesigner changes, WordPress changes, Books/payment/classroom writes, email/WhatsApp sends, trigger changes, lifecycle/status writes, or appsscript/clasp config changes were made.

### Source / Scope Status

- `git diff --check`: PASS.
- Scoped implementation diff: `Admin.js`, `AdminUI.html`, `Config.js`, `CURRENT_TASK.md`.
- BLOCKER before release finalization: `git diff --name-only` also lists pre-existing tracked `.codexhub/SESSION_CONTEXT.md` and `.codexhub/resume_state/latest.json` modifications outside the CIS allowed files.
- Codex did not edit `.codexhub` and must not include those files in a release commit without explicit direction.
- Release-scope exception approved by operator on `2026-05-28`: pre-existing tracked `.codexhub/SESSION_CONTEXT.md` and `.codexhub/resume_state/latest.json` changes are treated as local state outside this CIS.
- Under this exception, do not edit, stage, commit, revert, delete, or normalize those `.codexhub` files.
- Use targeted release checks and targeted staging only for `Admin.js`, `AdminUI.html`, `Config.js`, and `CURRENT_TASK.md`; do not use `git add -A`.

### Acceptance Status

- Source inspection: PASS for existing Admin/Ops Reports placement and existing Admin read-only RPC patterns.
- Local implementation: PASS pending deploy/runtime verification.
- Remote source proof: PASS by operator-confirmed manual Apps Script editor verification for project `1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90`.
  - `Config.js` contains `VERSION: "r202"`.
  - `Config.js` contains `DEPLOY_VERSION_NUMBER: 202`.
  - `Admin.js` contains `admin_getCampaignApplicationReport`.
  - `AdminUI.html` contains `FODE Campaign Traffic vs Applications`.
  - `AdminUI.html` contains `Manual / Meta`.
- Apps Script platform version: `220`.
- Admin staging deployment: `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ @220`.
- Student staging deployment: `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv @220`.
- Admin whoami URL: `https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec?view=whoami`.
  - PASS: embedded authoritative runtime payload reports `version="r202"`, `deployVersion=202`, `mismatch=false`.
- Student whoami URL: `https://script.google.com/macros/s/AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv/exec?view=whoami`.
  - PASS: embedded authoritative runtime payload reports `version="r202"`, `deployVersion=202`, `mismatch=false`.
- Browser acceptance: PASS by operator-supplied saved OPS HTML evidence.
  - PASS: OPS page rendered.
  - PASS: `FODE Campaign Traffic vs Applications` card is present.
  - PASS: card is labelled `Read-only aggregate`.
  - PASS: Meta input is manual and FODE portal / FD records remain the application source of truth.
  - PASS: report states aggregate counts only, no applicant PII exposure, and no send, write, export, file creation, or lifecycle change.
  - PASS: no live send/export/mutation action was triggered during acceptance.
- External operator acceptance for WordPress/Meta bridge: OUTSIDE CODEX, PENDING.

### Next Step

- Release hold: cleared.
- Finalize Git/tag state for `r202` only; do not include `.codexhub` local state.

## Active CIS

- `CIS r201 Revised: OPS Lifecycle Dropped / Ineligible Stage with Minimal Queue Payload Exposure`.
- Implementation date: `2026-05-28`.
- Work class: `Runtime release - OPS lifecycle/UI classification with minimal read-only queue payload exposure`.
- Release track: `Track H`.
- Reason for classification: the approved scope includes a backend `Admin.js` queue payload change, even though the change is read-only and does not authorize mutation, send/write execution, portal security, Books/payment/classroom logic, schema, Script Properties, or deployment architecture changes.
- Intended runtime identity: `r201 / 201`.
- Implementation authorized: `YES`.
- Runtime release authorized: `NO - implementation only; no clasp push, version, deployment repin, or browser acceptance in this turn`.

### Reason for Revision

- Original `CIS r201: Dropped / Ineligible OPS Lifecycle Stage` was blocked because `AdminUI.html` could not safely derive `Dropped / Ineligible` from the row fields currently loaded into the UI.
- Existing source-backed terminal stage fields are available server-side in `Admin.js`, but they are not exposed in the stripped OPS queue payload.

### Allowed Edit Files

- `Admin.js`
- `AdminUI.html`
- `Config.js`
- `CURRENT_TASK.md`

### Purpose

- Expose only the minimum existing source-backed lifecycle/status fields needed for client-side OPS lifecycle classification.
- Add `Dropped / Ineligible` as a display-only lifecycle stage.
- Preserve active applicant routing and all existing operational gates.

### Hard Limits

- No schema/header changes.
- No new mutation/write endpoints.
- No change to send eligibility gates.
- No change to Super/Admin/Operations permissions.
- No Books/payment/classroom/portal/email-template changes.
- No AI/document processing changes.
- No broad lifecycle refactor.

### Required Implementation Approach

1. In `Admin.js`, add existing row values only to the stripped queue payload:
   - `Pipeline_Stage`
   - `Operational_Stage`
   - `CRM_Stage`
   - `Stage`
   - `Overall_Status` only if already present and source-backed
2. Do not compute new server-side lifecycle decisions unless already existing helper logic can be reused safely.
3. In `AdminUI.html`, derive `Dropped / Ineligible` only from source-backed terminal/ineligible values.
4. Preserve existing active lifecycle routing for all non-terminal records.
5. Treat ambiguous records as active/current existing stage, not `Dropped / Ineligible`.
6. Add UI label/count/filter only if supported by existing lifecycle controls.

### Stop Conditions

- Needed field is not source-backed.
- Implementation requires new headers.
- Implementation requires backend mutation logic.
- Implementation changes communication eligibility.
- Implementation changes role/permission gates.
- More than minimal queue payload exposure is needed.

### Acceptance Targets

- Git diff limited to `Admin.js`, `AdminUI.html`, `Config.js`, and `CURRENT_TASK.md`.
- OPS shows `Dropped / Ineligible` stage.
- Known active applicants remain in current active stages.
- Known terminal/ineligible records route to `Dropped / Ineligible` if their source fields support it.
- No write action exists for marking dropped/ineligible.
- No send/export/Books/payment/portal/classroom behavior changes.
- Admin whoami reports `r201 / 201`, `mismatch=false`, after release.
- Student whoami reports `r201 / 201`, `mismatch=false`, after release.

### Release Closure Discipline

- Close only against this approved scope and acceptance criteria.
- Classify new findings as `BLOCKER` or `FOLLOW-UP`; do not expand r201 unless the finding directly prevents the approved lifecycle display objective.

### Implementation Notes

- `Admin.js` exposes only existing source-backed queue payload fields required for UI lifecycle classification:
  - `Pipeline_Stage`
  - `Operational_Stage`
  - `CRM_Stage`
  - `Stage`
  - `Overall_Status` only when already present on the row object
- `AdminUI.html` adds a display-only `Dropped / Ineligible` lifecycle stage using conservative source-field matching for dropped, ineligible, closed-lost, withdrawn, and disqualified outcomes.
- Ambiguous records remain in their existing active lifecycle routing.
- No schema/header changes, mutation endpoints, role/permission gates, send eligibility, email template/recipient logic, Books/payment/classroom/portal/security/token logic, deployment settings, AI processing, or document processing were changed.
- `Config.js` local identity is bumped to `r201 / 201` for the later release identity gate.
- No `clasp push`, Apps Script version, deployment repin, or browser acceptance was run during implementation.

## Previous Active CIS

- `CIS r200: Elevated Admin Role`.

## r200 Release Identity Gate

- Intended runtime identity: `r200 / 200`.
- Local identity proof before `clasp version`:
  - `Config.js:10:  VERSION: "r200",`
  - `Config.js:12:  DEPLOY_VERSION_NUMBER: 200,`
- Invariant check: `VERSION == "r" + DEPLOY_VERSION_NUMBER` is PASS for `r200 / 200`.
- `git diff -- Config.js`: confirms the identity bump `r199 / 199` to `r200 / 200`, plus only the authorized Operations role allowlist/mapping additions.
- `clasp push`: PASS; output reported `Pushed 8 files at 3:50:53 pm.` and did not report `Skipping push`.
- Remote independent proof outside source root:
  - cloned into `C:\GoogleDRIVE\Codex_Sync\FODE_Runtime_1wog_remote_verify_r200_20260527_01`.
  - remote `Config.js` contains `VERSION: "r200"` and `DEPLOY_VERSION_NUMBER: 200`.
  - remote `Config.js` contains `"principal@kundu.ac": "OPERATIONS"`.
  - remote `SUPER_ADMIN_EMAILS` contains only `"sanjay@minervacenters.com"`; remote `ELEVATED_OVERRIDE_EMAILS` remains empty.
  - remote sender marker remains `CAMPAIGN_GMAIL_ALIAS: "fode_kia@kundu.ac"`.
  - remote `Admin.js` contains `requireOperationsAdmin_` on the approved operational endpoints and `requireSuperAdmin_` on document/status, overall override, legacy campaign mutation/send, bounce scan, document follow-up send, FD live acknowledgement, and classroom notify paths.
  - remote `AdminUI.html` contains `Operations Admin`, `CAN_RUN_OPERATIONS_ACTIONS`, `opsOperationalExecutionAllowed_`, and `data-ops-operational-write` markers while Super-only portal/payment/CSV-email markers remain.
  - SHA-256 parity PASS for local versus remote `Config.js`, `Admin.js`, and `AdminUI.html`.
- Remote-source gate: PASS; Apps Script platform version creation is authorized for `r200 / 200`.

## r200 Runtime Acceptance Status

- Apps Script platform version: `218`.
- Admin staging deployment: `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ @218`.
- Student staging deployment: `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv @218`.
- Admin whoami URL: `https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec?view=whoami`.
  - PASS: `version="r200"`, `deployVersion=200`, `mismatch=false`.
- Student whoami URL: `https://script.google.com/macros/s/AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv/exec?view=whoami`.
  - PASS: `version="r200"`, `deployVersion=200`, `mismatch=false`.
- Source and safety proof:
  - PASS: remote source maps `principal@kundu.ac` to `OPERATIONS`, not `SUPER`, and leaves `ELEVATED_OVERRIDE_EMAILS` empty.
  - PASS: permitted operational actions use explicit backend and UI Operations gates; discovered unapproved mutation/send paths are server-restricted to Super Admin.
  - PASS: sender marker remains `CAMPAIGN_GMAIL_ALIAS: "fode_kia@kundu.ac"`.
  - PASS: no real bulk send, real applicant send, or mutation acceptance action was executed.
- Controlled authenticated acceptance:
  - PASS by operator-supplied rendered HTML evidence while signed in as `principal@kundu.ac`.
  - PASS: rendered identity reports `VERSION / BUILD_VERSION r200`.
  - PASS: role markers report `IS_SUPER false`, `IS_OPERATIONS_ADMIN true`, and `CAN_RUN_OPERATIONS_ACTIONS true`.
  - PASS: rendered `SUPER_ADMIN_EMAILS` includes only `sanjay@minervacenters.com`.
  - PASS: rendered override marker reports `CAN_OVERRIDE false`.
  - PASS: Super Admin/Governance actions remain separately gated.
  - PASS: no live send, export, or mutation action was run for acceptance.
- Closure classification: no unresolved `BLOCKER` or `FOLLOW-UP` identified within approved r200 scope.
- Release finalization status: PASS; commit, tag, and push authorized.

## Previous Active CIS

- `CIS r199: Communication Cooldown, Workflow Clarity, and Follow-up CSV Fields`.
- Implementation date: `2026-05-27`.
- Work class: `Runtime release - light UI wording and local CSV visibility`.
- Release track: `Track L`.
- Reason for classification: frontend-only wording, status display, and local browser CSV column changes; no backend, schema, send logic, or mutation authority changes.
- Intended runtime identity: `r199 / 199`.
- Runtime release authorized: `YES`.
- Allowed edit files:
  - `AdminUI.html`
  - `CURRENT_TASK.md`
  - `Config.js`
- Explicitly forbidden:
  - `Admin.js`, backend send logic, schema, AI/document processing, file writeback, email/Books/portal/payment/classroom logic changes, closed/lost/transferred workflow implementation, broad refactor.
- Inspection finding:
  - frontend detail already loads `Last_Contacted_At`, `Last_Contact_Type`, `Last_Contact_By`, `Last_Contact_Subject`, and `Email_Next_Action_Date` for cooldown display.
  - queue row rendering already provides email/phone fields, lifecycle-stage derivation, next-action definitions, document/payment status helpers, invoice/enrolment/classroom fields, and explicit blockers when present.
  - `opsExportQueueCsv_()` is a local browser-only export from loaded queue rows; it can expose available follow-up fields with blank or `Unknown` fallbacks without backend/schema work.
- Acceptance targets:
  - active cooldown display identifies source-backed last communication evidence, next eligible send, and cooldown block reason without inventing message type.
  - Applicant Review and OPS workflow text explains portal/document/payment/enrolment fields in operator language.
  - vague payment-pending lifecycle wording is replaced where displayed in the affected workflow surfaces.
  - local queue CSV includes manual follow-up contact, stage, action, communication, evidence, verification, invoice/enrolment/classroom, and ready/block reason columns.
  - local export retains the authorised-staff privacy warning.
  - no AI inspection, closed/lost/transferred implementation, backend/schema change, or dangerous-action change is introduced.
  - only `AdminUI.html`, `CURRENT_TASK.md`, and `Config.js` change.
- Release closure discipline:
  - close only against this approved scope and acceptance criteria.
  - classify new findings as `BLOCKER` or `FOLLOW-UP`; do not expand this release for non-blockers.
- Follow-up register: none identified at implementation start.

## r199 Release Identity Gate

- Intended runtime identity: `r199 / 199`.
- Local identity proof before `clasp version`:
  - `Config.js:10:  VERSION: "r199",`
  - `Config.js:12:  DEPLOY_VERSION_NUMBER: 199,`
- Invariant check: `VERSION == "r" + DEPLOY_VERSION_NUMBER` is PASS for `r199 / 199`.
- `git diff -- Config.js`: confirms the only identity change is `r198 / 198` to `r199 / 199`.
- `clasp push`: PASS; output reported `Pushed 8 files.` and did not report `Skipping push`.
- Remote independent proof outside source root:
  - pulled into `C:\GoogleDRIVE\Codex_Sync\FODE_Runtime_1wog_remote_verify_r199_20260527_01`
  - remote `Config.js` contains `VERSION: "r199"` and `DEPLOY_VERSION_NUMBER: 199`
  - remote `AdminUI.html` contains `Last communication:`, `Next eligible send:`, `Block reason: Cooldown active`, `Payment Evidence Not Verified`, `Required documents/payment evidence missing or unverified`, and operator workflow wording markers
  - remote `AdminUI.html` contains the local CSV markers `Applicant / Student Name`, `Phone / WhatsApp`, `Lifecycle Stage`, `Stage Meaning`, `Next Action`, `Communication Status`, `Document Evidence Status`, `Payment Evidence Status`, `Ready / Blocked`, and `Block Reason`
  - remote `AdminUI.html` retains `Local export contains applicant data. Do not share outside authorised staff.`, `data-ops-supervisory-write`, and `opsSupervisoryExecutionAllowed_` safety markers
- Remote-source gate: PASS; Apps Script platform version creation was authorized for `r199 / 199`.

## r199 Runtime Acceptance Evidence

- Apps Script platform version: `217`.
- Admin staging deployment: `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ @217`.
- Student staging deployment: `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv @217`.
- Admin whoami URL: `https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec?view=whoami`.
  - PASS: `version="r199"`, `deployVersion=199`, `mismatch=false`.
- Student whoami URL: `https://script.google.com/macros/s/AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv/exec?view=whoami`.
  - PASS: `version="r199"`, `deployVersion=199`, `mismatch=false`.
- Track L acceptance: PASS by CIS-permitted local/remote HTML evidence.
  - active cooldown rendering shows source-backed last communication details when loaded, otherwise `recorded, details unavailable`, plus next eligible send and `Cooldown active` block reason.
  - Applicant Review and OPS workflow displays explain portal submission, document verification, payment evidence/payment verification, and enrolled confirmation in operator language.
  - unverified payment displays use `Payment Evidence Not Verified` / `Payment evidence not verified`, and enrolled confirmation no longer derives `Yes` from payment verification alone.
  - local queue CSV includes the required manual follow-up columns with blank or `Unknown` fallbacks and retains the authorised-staff privacy warning.
  - no AI/document processing, closed/lost/transferred implementation, backend/schema change, send logic change, or dangerous-action enablement was introduced.
  - existing supervisory safety markers remain present and no dangerous action was triggered during acceptance.
- Closure classification: no `BLOCKER` or `FOLLOW-UP` was identified within the approved r199 scope.
- Release finalization status: PASS; commit, tag, and push authorized.

## Previous Active CIS

- `CIS r198: Payment Receipt Evidence Wording Alignment`.
- Implementation date: `2026-05-27`.
- Work class: `Runtime release - light UI wording alignment`.
- Release track: `Track L`.
- Reason for classification: frontend-only Lifecycle checklist wording; no backend, schema, file processing, or mutation authority changes.
- Intended runtime identity: `r198 / 198`.
- Runtime release authorized: `YES`.
- Allowed edit files:
  - `AdminUI.html`
  - `CURRENT_TASK.md`
  - `Config.js`
- Explicitly forbidden:
  - `Admin.js`, backend/schema changes, document processing, AI inspection, file writeback, email/Books/portal/payment/classroom logic changes, broad refactor.
- Inspection finding:
  - Lifecycle checklist rendering used `Fee_Receipt_File` to display `Uploaded` and `Payment Receipt`.
  - selected-applicant detail/modal uses stronger `_docs[].hasFile` file evidence and remains unchanged.
  - workflow summaries also displayed payment-field state as `Payment Evidence Uploaded`; wording is aligned without changing underlying logic.
  - `Fee_Receipt_File` is payment field evidence only; it must not be presented as document upload proof.
- Acceptance targets:
  - Lifecycle checklist no longer labels `Fee_Receipt_File` as an uploaded Payment Receipt.
  - the checklist separates `Payment Evidence` from `Document Uploads` and requires detail verification for receipt upload status.
  - queue/detail workflow summaries label payment-field state as `Payment Field Evidence Present`, not as document upload proof.
  - Applicant Review modal logic remains unchanged, with `_docs[].hasFile` retained as stronger detail evidence.
  - Portal Submitted remains separate from document upload evidence.
  - r193-r197 safety markers and gates remain unchanged; no dangerous action becomes executable.
  - only `AdminUI.html`, `CURRENT_TASK.md`, and `Config.js` change.
- Release closure discipline:
  - close only against this approved scope and acceptance criteria.
  - classify new findings as `BLOCKER` or `FOLLOW-UP`; do not expand this release for non-blockers.
- Follow-up register: none identified at implementation start.

## r198 Release Status

- Intended runtime identity: `r198 / 198`.
- Local identity proof before `clasp version`:
  - `Config.js:10:  VERSION: "r198",`
  - `Config.js:12:  DEPLOY_VERSION_NUMBER: 198,`
- Invariant check: `VERSION == "r" + DEPLOY_VERSION_NUMBER` is PASS for `r198 / 198`.
- `git diff -- Config.js`: confirms the only identity change is `r197 / 197` to `r198 / 198`.
- `clasp push`: PASS; output reported `Pushed 8 files.` and did not report `Skipping push`.
- Remote independent proof outside source root:
  - cloned into `C:\GoogleDRIVE\Codex_Sync\FODE_Runtime_1wog_remote_verify_r198_20260527_01`
  - remote `Config.js` contains `VERSION: "r198"` and `DEPLOY_VERSION_NUMBER: 198`
  - remote `AdminUI.html` contains `Payment Evidence`, `Payment field evidence present`, `Document Uploads`, `Payment receipt upload: verify in detail`, and `Payment Field Evidence Present`
  - remote `AdminUI.html` retains `_docs[].hasFile`, `data-ops-supervisory-write`, and `opsSupervisoryExecutionAllowed_` markers
- Remote-source gate: PASS; Apps Script platform version creation is authorized for `r198 / 198`.

## r198 Runtime Acceptance Evidence

- Apps Script platform version: `216`.
- Admin staging deployment: `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ @216`.
- Student staging deployment: `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv @216`.
- Admin whoami URL: `https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec?view=whoami`.
  - PASS: `version="r198"`, `deployVersion=198`, `mismatch=false`.
- Student whoami URL: `https://script.google.com/macros/s/AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv/exec?view=whoami`.
  - PASS: `version="r198"`, `deployVersion=198`, `mismatch=false`.
- Track L acceptance: PASS by CIS-permitted local/remote HTML evidence.
  - Lifecycle checklist displays `Payment Evidence` separately from `Document Uploads`.
  - `Fee_Receipt_File` produces `Payment field evidence present`, while `Payment receipt upload: verify in detail` remains explicit.
  - no-evidence rows display `No payment file evidence in queue view`, while still requiring detail verification for receipt upload.
  - queue/detail workflow summaries use `Payment Field Evidence Present` instead of claiming payment evidence was uploaded.
  - Applicant Review document evidence remains driven by existing `_docs[].hasFile`; Portal Submitted remains separate from document evidence.
  - existing supervisory safety markers remain present and no dangerous action was triggered during acceptance.
- Closure classification: no `BLOCKER` or `FOLLOW-UP` was identified within the approved r198 scope.
- Release finalization status: PASS; commit, tag, and push authorized.

## Previous Active CIS

- `CIS r197: Document Checklist Visibility`.
- Implementation date: `2026-05-27`.
- Work class: `Runtime release - light UI checklist visibility`.
- Release track: `Track L`.
- Reason for classification: frontend-only document checklist display in existing lifecycle rows; no backend, schema, file processing, or mutation changes.
- Intended runtime identity: `r197 / 197`.
- Runtime release authorized: `YES`.
- Allowed edit files:
  - `AdminUI.html`
  - `CURRENT_TASK.md`
  - `Config.js`
- Explicitly forbidden:
  - `Admin.js`, backend/schema changes, AI/document processing, image resizing, file writeback, email/Books/portal/payment/classroom logic changes, broad refactor.
- Inspection finding:
  - full `_docs[].label` and `_docs[].hasFile` are available only in selected-applicant detail rendering.
  - lifecycle queue rows expose a proven partial upload indicator in `Fee_Receipt_File`; no frontend evidence shows full required-document labels in the loaded row.
  - implementation therefore shows `Payment Receipt` uploaded/missing when that row field is present, marks other required documents unknown from loaded data, and shows checklist unavailable if the row does not carry the indicator.
- Acceptance targets:
  - `Documents / Eligibility Check` rows display compact uploaded/missing/unknown checklist content in the right-side area.
  - the primary action remains `Check portal uploads / contact applicant`.
  - Portal Submitted remains separate from Documents Uploaded and existing r196 evidence wording remains visible.
  - no AI inspection, image processing, or file mutation is added.
  - r193-r196 safety markers and gates remain unchanged; no dangerous action becomes executable.
  - only `AdminUI.html`, `CURRENT_TASK.md`, and `Config.js` change.
- Release closure discipline:
  - close only against this approved scope and acceptance criteria.
  - classify new findings as `BLOCKER` or `FOLLOW-UP`; do not expand this release for non-blockers.
- Follow-up register: none identified at implementation start.

## r197 Release Identity Gate

- Intended runtime identity: `r197 / 197`.
- Local identity proof before `clasp version`:
  - `Config.js:10:  VERSION: "r197",`
  - `Config.js:12:  DEPLOY_VERSION_NUMBER: 197,`
- Invariant check: `VERSION == "r" + DEPLOY_VERSION_NUMBER` is PASS for `r197 / 197`.
- `git diff -- Config.js`: confirms the only identity change is `r196 / 196` to `r197 / 197`.
- `clasp push`: PASS; output reported `Pushed 8 files.` and did not report `Skipping push`.
- Remote independent proof outside source root:
  - pulled into `C:\GoogleDRIVE\Codex_Sync\FODE_Runtime_1wog_remote_verify_r197_20260527_01`
  - remote `Config.js` contains `VERSION: "r197"` and `DEPLOY_VERSION_NUMBER: 197`
  - remote `AdminUI.html` contains `opsQueueDocumentChecklistHtml_`, `Document checklist unavailable in queue view`, `Payment Receipt`, `Other required documents: unknown from loaded data`, and `Check portal uploads / contact applicant`
  - remote `AdminUI.html` retains `data-ops-supervisory-write` and `opsSupervisoryExecutionAllowed_` safety markers
- Remote-source gate: PASS; Apps Script platform version creation was authorized for `r197 / 197`.

## r197 Runtime Acceptance Evidence

- Apps Script platform version: `215`.
- Admin staging deployment: `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ @215`.
- Student staging deployment: `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv @215`.
- Admin whoami URL: `https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec?view=whoami`.
  - PASS: `version="r197"`, `deployVersion=197`, `mismatch=false`.
- Student whoami URL: `https://script.google.com/macros/s/AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv/exec?view=whoami`.
  - PASS: `version="r197"`, `deployVersion=197`, `mismatch=false`.
- Track L acceptance: PASS by CIS-permitted local/remote HTML evidence.
  - `Documents / Eligibility Check` rows retain the primary action `Check portal uploads / contact applicant`.
  - when loaded queue data contains `Fee_Receipt_File`, the checklist shows `Payment Receipt` as uploaded or missing and explicitly marks other required documents unknown from loaded data.
  - when the loaded queue row has no reliable checklist indicator, the row explicitly shows `Document checklist unavailable in queue view`.
  - the r196 portal/document evidence distinction remains intact; no AI inspection, image processing, file writeback, or backend/schema change was introduced.
  - existing supervisory safety markers remain present and no dangerous action was triggered during acceptance.
- Closure classification: no `BLOCKER` or `FOLLOW-UP` was identified within the approved r197 scope.
- Release finalization status: PASS; commit, tag, and push authorized.

## Previous Active CIS

- `CIS r196: Document Evidence Wording Cleanup`.
- Implementation date: `2026-05-27`.
- Work class: `Runtime release - light UI wording and evidence clarity`.
- Release track: `Track L`.
- Reason for classification: frontend-only lifecycle/document-stage wording and visible evidence labels; no backend behavior or mutation authority changes.
- Intended runtime identity: `r196 / 196`.
- Runtime release authorized: `YES`.
- Allowed edit files:
  - `AdminUI.html`
  - `CURRENT_TASK.md`
  - `Config.js`
- Explicitly forbidden:
  - `Admin.js`, backend classification, schema, email send logic, Books logic, portal write/reset/lock logic, Script Properties, broad refactor.
- Inspection finding:
  - selected-applicant detail already provides `_docs[].hasFile` and blocks document verification without a file.
  - lifecycle queue rows expose document status and portal submission, but not a direct file-link flag; queue wording must therefore use explicit status only and never infer upload from `Portal_Submitted`.
- Acceptance targets:
  - `Documents Pending / Review` is replaced with `Documents / Eligibility Check`.
  - lifecycle rows show explicit document evidence wording without assuming files exist.
  - Portal Submitted remains separate from document upload evidence.
  - actions use upload checks/contact/eligibility wording rather than implying document review where no file evidence is visible.
  - r193/r194/r195 safety markers and gates remain unchanged; no dangerous action becomes executable.
  - only `AdminUI.html`, `CURRENT_TASK.md`, and `Config.js` change.
- Release closure discipline:
  - close only against this approved scope and acceptance criteria.
  - classify new findings as `BLOCKER` or `FOLLOW-UP`; do not expand this release for non-blockers.
- Follow-up register: none identified at implementation start.

## r196 Release Identity Gate

- Intended runtime identity: `r196 / 196`.
- Local identity proof before `clasp version`:
  - `Config.js:10:  VERSION: "r196",`
  - `Config.js:12:  DEPLOY_VERSION_NUMBER: 196,`
- Invariant check: `VERSION == "r" + DEPLOY_VERSION_NUMBER` is PASS for `r196 / 196`.
- `git diff -- Config.js`: confirms the only identity change is `r195 / 195` to `r196 / 196`.
- `clasp push`: PASS; output reported `Pushed 8 files.` and did not report `Skipping push`.
- Remote independent proof outside source root:
  - pulled into `C:\GoogleDRIVE\Codex_Sync\FODE_Runtime_1wog_remote_verify_r196_20260527_01`
  - remote `Config.js` contains `VERSION: "r196"` and `DEPLOY_VERSION_NUMBER: 196`
  - remote `AdminUI.html` contains `Documents / Eligibility Check`, document evidence status markers, and `Check portal uploads / contact applicant`
  - remote `AdminUI.html` retains `data-ops-supervisory-write` and `opsSupervisoryExecutionAllowed_` safety markers
- Remote-source gate: PASS; Apps Script platform version creation was authorized for `r196 / 196`.

## r196 Runtime Acceptance Evidence

- Apps Script platform version: `214`.
- Admin staging deployment: `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ @214`.
- Student staging deployment: `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv @214`.
- Admin whoami URL: `https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec?view=whoami`.
  - PASS: `version="r196"`, `deployVersion=196`, `mismatch=false`.
- Student whoami URL: `https://script.google.com/macros/s/AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv/exec?view=whoami`.
  - PASS: `version="r196"`, `deployVersion=196`, `mismatch=false`.
- Track L acceptance: PASS by CIS-permitted local/remote HTML evidence.
  - `Documents Pending / Review` is removed from the lifecycle definition and replaced with `Documents / Eligibility Check`.
  - lifecycle rows show one of `Files uploaded - review required`, `No files uploaded`, `Documents verified`, `Unknown evidence state`, or `Pending eligibility check`.
  - queue rows never infer document upload from `Portal_Submitted`; portal/document actions use upload-check/contact/eligibility wording.
  - selected-applicant detail uses existing `_docs[].hasFile` to distinguish files uploaded from no files uploaded.
  - existing supervisory safety markers remain present and no dangerous action was triggered during acceptance.
- Closure classification: no `BLOCKER` or `FOLLOW-UP` was identified within the approved r196 scope.
- Release finalization status: PASS; commit, tag, and push authorized.

<!-- CODEXHUB_STATE_BACKUP_START -->
## CodexHub State Backup

- Last state backup timestamp: 2026-06-02 20:20:18
- Project path: `E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog`
- Repository state: CLEAN
- Current branch: `main`
- Latest commit: `dffffc6 release: r213 stage batch preview clarity`
- Latest matching staging tag: `staging-as213`
- Config version / deploy number: VERSION: r213; DEPLOY_VERSION_NUMBER: 213
- Current release track: Not detected.
- Current blocker: None detected.
- Next exact action: Not detected.
- Operator note: [add operator note]

### Git Status
```text
## main...origin/main
```

### Changed Files
- None.
<!-- CODEXHUB_STATE_BACKUP_END -->

## Previous Active CIS

- `CIS: Release Track Discipline - documentation-only process hardening`.
- Implementation date: `2026-05-27`.
- Release classification:
  - Work class: `Governance / documentation-only`
  - Release track: `Track L`
  - Runtime release authorized: `NO - no runtime release`
  - Runtime identity: unchanged at accepted `r195 / 195`
  - Deployment/tag actions: forbidden for this CIS
- Proven local starting state before edits:
  - git commit `1d37194`
  - tag at HEAD `staging-as195`
  - `.codexhub/` already untracked before this CIS
- Scope:
  - persist Track L / Track H release classification for future CIS work
  - persist a current-release classification template
  - provide a durable release-track checklist without modifying app/runtime behavior
- Allowed edit files:
  - `AGENTS.md`
  - `CURRENT_TASK.md`
  - `docs/RELEASE_DISCIPLINE.md`
- Explicitly forbidden:
  - `Config.js`, `AdminUI.html`, `Admin.js`, any app code
  - `clasp push`, Apps Script version, deployment repin, and staging tag
- Acceptance targets:
  - future runtime CIS must declare `Track L` or `Track H`
  - `Track L` explicitly permits recorded operator/source/rendered-HTML evidence without requiring Codex browser visual capture
  - `Track H` retains full safety and runtime verification discipline
  - no app/runtime files changed and no runtime release performed

## Current-Release Classification Template

Use this block at the start of every future CIS before implementation:

```md
## Release Classification

- CIS: `<title>`
- Work class: `<runtime release | documentation-only | audit-only>`
- Release track: `<Track L | Track H>`
- Reason for classification: `<specific changed surface and risk>`
- Intended runtime identity: `<rNNN / NNN | unchanged>`
- Allowed files: `<exact list>`
- Forbidden actions/files: `<exact list>`
- Required acceptance evidence: `<source/HTML/operator/browser/runtime checks>`
- Runtime release authorized: `<YES | NO - no runtime release>`
- If YES: require Config identity proof, external remote-source proof, platform version, Admin repin, Student repin, Admin whoami, Student whoami, acceptance PASS, commit/tag/push authorization.
```

## Previous Active CIS

- `CIS r195: Email Correction Handoff + Communications UX Cleanup`.
- Implementation date: `2026-05-27`.
- Proven local starting state before edits:
  - git commit `86b4c95`
  - tag at HEAD `staging-as194`
  - `.codexhub/` already untracked before this CIS
- Scope:
  - keep Email Issue rows focused on applicant contact and correction handoff
  - route `Correct Email` into the existing Applicant Review / Admin Review bridge with the selected ApplicantID
  - keep Communications focused on preview/send workflow and remove its exposed correction form
  - preserve r193/r194 Operator/Admin/Super Admin safety policy
- Allowed edit files:
  - `AdminUI.html`
  - `CURRENT_TASK.md`
  - `Config.js` only if release is executed
- Explicitly out of scope:
  - `Admin.js`, backend gates, email send logic, Books logic, portal logic, schema, Script Properties, and any new correction backend
- Release status:
  - release authorized by this CIS after acceptance and runtime gates pass
  - `Config.js` bumped to intended release identity `r195 / 195`
  - `clasp push`: PASS, pushed 8 clasp-managed files
  - remote-source proof: PASS from `C:\GoogleDRIVE\Codex_Sync\FODE_Runtime_1wog_remote_verify_r195_20260527_01`
  - Apps Script platform version: `213`
  - Admin staging deployment: repinned to `@213`
  - Student staging deployment: repinned to `@213`
  - Admin whoami: PASS, `r195 / 195`, `mismatch=false`
  - Student whoami: PASS, `r195 / 195`, `mismatch=false`
  - acceptance: PASS by permitted source/remote HTML evidence; no dangerous action triggered
  - commit, tag, and push: authorized after acceptance passed

## r195 Local Acceptance Targets

- Email Issue rows show ApplicantID, applicant name, current/bad email, phone/WhatsApp, blocker, last action/contacted detail, and `Correct Email`.
- `Correct Email` preserves the selected ApplicantID and opens the existing Applicant Review / Admin Review path, not generic Communications.
- Communications exposes preview/send workflow and guidance to use Lifecycle Map / Applicant Queue for bad or missing email correction.
- Existing supervisory write gates remain unchanged; no dangerous action is newly executable.
- No files outside `AdminUI.html`, `CURRENT_TASK.md`, and release-only `Config.js` are changed.

## r195 Release Identity Gate

- Intended runtime identity: `r195 / 195`.
- Local identity proof before `clasp version`:
  - `Config.js:10:  VERSION: "r195",`
  - `Config.js:12:  DEPLOY_VERSION_NUMBER: 195,`
- Invariant check: `VERSION == "r" + DEPLOY_VERSION_NUMBER` is PASS for `r195 / 195`.
- `git diff -- Config.js`: confirms the only identity change is `r194 / 194` to `r195 / 195`.
- `clasp push`: PASS; output reported `Pushed 8 files.`
- Remote independent proof outside source root:
  - pulled into `C:\GoogleDRIVE\Codex_Sync\FODE_Runtime_1wog_remote_verify_r195_20260527_01`
  - remote `Config.js` contains `VERSION: "r195"` and `DEPLOY_VERSION_NUMBER: 195`
  - remote `AdminUI.html` contains `Correct Email` handoff guidance, `Email correction is handled in Admin Review.`, and `review(null, applicantId, btn);`
  - remote `AdminUI.html` retains `data-ops-supervisory-write` and `opsSupervisoryExecutionAllowed_` safety markers
  - remote Communications no longer exposes the OPS `Apply Email Correction` control
- Remote-source gate: PASS; safe to create an Apps Script platform version for `r195 / 195`.

## r195 Runtime Acceptance Evidence

- Apps Script platform version: `213`.
- Admin staging deployment: `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ @213`.
- Student staging deployment: `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv @213`.
- Admin whoami URL: `https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec?view=whoami`.
  - PASS: `version="r195"`, `deployVersion=195`, `mismatch=false`.
- Student whoami URL: `https://script.google.com/macros/s/AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv/exec?view=whoami`.
  - PASS: `version="r195"`, `deployVersion=195`, `mismatch=false`.
- Acceptance: PASS by CIS-permitted source/remote HTML evidence.
  - Email Issue row retains prominent phone/WhatsApp contact support and tells the operator to call/message for a corrected email.
  - `Correct Email` preserves selected ApplicantID context by routing through existing `review(null, applicantId, btn);` Applicant Review handling.
  - Helper text states `Email correction is handled in Admin Review.`
  - Communications displays the Admin Review handoff note and no longer exposes its OPS `Apply Email Correction` form/button.
  - Existing supervisory markers `data-ops-supervisory-write` and `opsSupervisoryExecutionAllowed_` remain present.
  - No dangerous action was triggered during acceptance.
- Release finalization status: HOLD cleared; git commit/tag/push authorized.

## Previous Active CIS

- `CIS r194: Lifecycle Map Usability Cleanup`.
- Implementation date: `2026-05-27`.
- Proven local starting state before edits:
  - git commit `5d1ef42`
  - tag at HEAD `staging-as193`
  - `.codexhub/` already untracked before this CIS
- Scope:
  - make Lifecycle Map read as a stage workflow with explicit stage meaning and next action
  - reduce row badge clutter into grouped operational summaries
  - make Email Issue / Contact Correction rows expose email, phone/WhatsApp, contact follow-up context, block reason, and correction action
  - preserve the r193 Operator/Admin supervisory gate policy
- Allowed edit files:
  - `AdminUI.html`
  - `CURRENT_TASK.md`
  - `Config.js` only if release is executed
- Explicitly out of scope:
  - `Admin.js`, backend gates, email send logic, Books logic, portal logic, schema, and Script Properties
- Release status:
  - LIGHT UI release path authorized by CIS
  - `Config.js` bumped to intended release identity `r194 / 194`
  - `clasp push`: PASS, pushed 8 clasp-managed files
  - remote-source proof: PASS from `C:\GoogleDRIVE\Codex_Sync\FODE_Runtime_1wog_remote_verify_r194_20260527_01`
  - Apps Script platform version: `212`
  - Admin staging deployment: repinned to `@212`
  - Student staging deployment: repinned to `@212`
  - Admin whoami: PASS, `r194 / 194`, `mismatch=false`
  - Student whoami: PASS, `r194 / 194`, `mismatch=false`
  - browser/manual acceptance: PASS by operator-supplied rendered OPS HTML evidence
  - commit, tag, and push: authorized after visual acceptance passed

## r194 Local Acceptance Targets

- Lifecycle Map stage header exposes stage name, count, stage meaning, and next action.
- Applicant rows expose essential fields only: ApplicantID, student/applicant name, email, phone/WhatsApp, age/aging, grouped key status, and one primary action.
- Badge summaries are grouped as:
  - `Ack / CRM / Portal`
  - `Docs / Payment / Invoice`
  - `Enrolment / Classroom`
  - `Email issue`
- Email Issue / Contact Correction rows foreground current email and phone/WhatsApp, show `No phone on record` if unavailable, show block reason and last-action context, and route the primary `Correct Email` action to the existing correction workspace.
- Primary action labels are constrained to existing read/review paths: `Check Portal Access`, `Check Documents`, `Correct Email`, `Review Payment`, or `Review Application`.
- r193 supervisory write gating remains unchanged; no dangerous action is newly executable.

## r194 Release Identity Gate

- Intended runtime identity: `r194 / 194`.
- Local identity proof before `clasp version`:
  - `Config.js:10:  VERSION: "r194",`
  - `Config.js:12:  DEPLOY_VERSION_NUMBER: 194,`
- Invariant check: `VERSION == "r" + DEPLOY_VERSION_NUMBER` is PASS for `r194 / 194`.
- `git diff -- Config.js`: confirms the only identity change is `r193 / 193` to `r194 / 194`.
- `clasp push`: PASS; output reported `Pushed 8 files.`
- Remote independent proof outside source root:
  - pulled into `C:\GoogleDRIVE\Codex_Sync\FODE_Runtime_1wog_remote_verify_r194_20260527_01`
  - remote `Config.js` contains `VERSION: "r194"` and `DEPLOY_VERSION_NUMBER: 194`
  - remote `AdminUI.html` contains `opsLifecycleStageTop`, `Ack / CRM / Portal`, `No phone on record`, and `Correct Email`
  - remote `AdminUI.html` retains `data-ops-supervisory-write` and `opsSupervisoryExecutionAllowed_` safety markers
- Remote-source gate: PASS; safe to create Apps Script platform version for `r194 / 194`.

## r194 Runtime Acceptance Evidence

- Apps Script platform version: `212`.
- Admin staging deployment: `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ @212`.
- Student staging deployment: `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv @212`.
- Admin whoami URL: `https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec?view=whoami`.
  - PASS: `version="r194"`, `deployVersion=194`, `mismatch=false`.
- Student whoami URL: `https://script.google.com/macros/s/AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv/exec?view=whoami`.
  - PASS: `version="r194"`, `deployVersion=194`, `mismatch=false`.
- Browser/manual acceptance: PASS by operator-supplied rendered OPS HTML evidence.
  - Lifecycle stage headers show workflow structure.
  - Lifecycle row structure includes contact/phone support.
  - Email Issue workflow has highlighted contact/correction path.
  - Grouped status summaries are present.
  - r193 Operator/Admin safety markers remain present.
  - No dangerous action was triggered.
- Release finalization status: HOLD cleared; git commit/tag/push authorized.

## Previous Active CIS

- `CIS: Operator/Admin Surface Safety Policy Implementation`.
- Implementation date: `2026-05-26`.
- Proven local starting state before edits:
  - git commit `251b7e0`
  - tag at HEAD `staging-as192`
  - `.codexhub/` already untracked before this CIS
- Baseline discrepancy:
  - supplied CIS described `r183` / commit `6a89a4d` / tag `staging-as183`
  - this local repo already proves a later `staging-as192` source state
  - no runtime identity or live deployment state is inferred from local files
- Scope:
  - restrict normal Operator/Admin Ops surfaces to read/select/preview workflow
  - require explicit Super Admin mode before write/export-sensitive Ops UI actions can execute
  - expose consequence and supervision warnings for communications, Books, portal, classroom, bulk, export, and legacy bridge surfaces
- Target runtime identity: `r193 / 193`.
- Allowed edit files used:
  - `AdminUI.html`
  - `CURRENT_TASK.md`
- Explicitly not changed:
  - `Admin.js`
  - backend permissions, role mapping, Books/email/portal/payment/classroom logic, schemas, and Apps Script configuration
- Release status:
  - release authorized by owner after UI implementation review
  - `Config.js` bumped to `r193 / 193` for release identity gate
  - `clasp push`: PASS, pushed 8 clasp-managed files
  - remote-source proof: PASS from `C:\GoogleDRIVE\Codex_Sync\FODE_Runtime_1wog_remote_verify_r193_20260526_01`
  - Apps Script platform version: `211`
  - Admin staging deployment: repinned to `@211`
  - Student staging deployment: repinned to `@211`
  - Admin whoami: PASS, `r193 / 193`, `mismatch=false`
  - Student whoami: PASS, `r193 / 193`, `mismatch=false`
  - browser acceptance: PASS by operator-supplied HTML evidence
  - commit, tag, and push: authorized after browser acceptance passed

## r193 Release Identity Gate Evidence

- Required local identity proof before `clasp version`:
  - `Config.js:10:  VERSION: "r193",`
  - `Config.js:12:  DEPLOY_VERSION_NUMBER: 193,`
- Invariant check: `VERSION == "r" + DEPLOY_VERSION_NUMBER` is PASS for `r193 / 193`.
- `git diff -- Config.js`: confirms the only identity change is `r192 / 192` to `r193 / 193`.
- `clasp push`: PASS; output reported `Pushed 8 files.`
- Remote independent proof outside source root:
  - pulled into `C:\GoogleDRIVE\Codex_Sync\FODE_Runtime_1wog_remote_verify_r193_20260526_01`
  - remote `Config.js` contains `VERSION: "r193"` and `DEPLOY_VERSION_NUMBER: 193`
  - remote `AdminUI.html` contains `data-ops-supervisory-write` controls and the bulk supervisory-policy marker
- Safe to create Apps Script version for `r193 / 193`.

## Operator/Admin Safety Implementation Notes

- `AdminUI.html`
  - makes Communications preview, Billing read/preview, Classroom checklist/preview, and Portal diagnostics visible as read surfaces in Operator/Admin workflow
  - adds local-export applicant-data warning text
  - separates and warning-labels applicant communication sends and financial record actions
  - disables write/export-sensitive Ops buttons unless the active UI mode is explicitly `Super Admin Mode`
  - adds direct handler blocks for applicant sends, Books draft/test-email actions, portal reset/lock/unlock, email correction, classroom notify, payment verification, bulk actions, WhatsApp export/email, and legacy mutation bridge access
  - hides the legacy edit/mutation bridge controls from normal Operator/Admin drawer workflow and replaces them with a supervisory warning
- Existing backend gate inspection only:
  - `Admin.js` was read to confirm existing Super Admin/Safe Mode enforcement paths; it was not edited
  - confirmed existing backend enforcement for portal reset/lock/unlock, payment verification, email correction, Ops Safe Mode send/notify paths, and bulk send
  - owner accepted existing trusted-Admin backend access for `admin_updateDocStatuses`, `admin_setOverallStatus`, and `admin_sendDocsFollowupEmails`
  - backend hardening against malicious Admin invocation is deferred and is not a release blocker for this CIS

## Operator/Admin Safety Static Acceptance

- Operator block text: `Operator mode is read/select/preview only. Escalate to Admin/Super Admin for this action.`
- Admin supervisory label: `Supervisory action — requires approval, preview, confirmation, and audit.`
- Sensitive export warning: `Local export contains applicant data. Do not share outside authorised staff.`
- Bulk wording: `Bulk communication is not a normal Operator/Admin action. Use preview/metrics for planning; execution requires supervisory approval.`
- Release acceptance: PASS; remote-source proof, Apps Script version/deployment repin, live `whoami`, and operator-supplied browser HTML evidence are recorded.
- Owner decision: trusted Admin backend access is accepted as supervised workflow; deferred backend hardening is `FOLLOW-UP`, not a release blocker.

## r193 Acceptance Closure

- Deployment pin confirmation: PASS; active Admin and Student staging deployments both list platform `@211`.
- Runtime identity: PASS from canonical Admin and Student `whoami` checks already completed in this release flow.
- Browser acceptance: PASS by operator-supplied HTML evidence.
  - `r193` build visible
  - Operator/Admin preview surfaces visible
  - local export applicant-data warning present
  - preview-only and send/write gated areas separated
  - supervisory-write buttons marked and governed
  - no dangerous action triggered
- Release finalization status: HOLD cleared; git commit/tag/push authorized.

## Previous Active CIS

- `CIS r192: Remove Sticky Selected-Applicant Default Logic`.
- Baseline:
  - git commit `9ca7d4f`
  - tag `staging-as191`
  - live Admin and Student runtime should be `r191 / 191` before this release
- Target runtime identity: `r192 / 192`.
- Scope:
  - remove implicit selected-applicant defaulting from normal OPS queue operation
  - do not allow Safe Mode approved target to choose the operator working applicant
  - clear stale selected applicant when it is not in the current visible queue/search context
  - keep explicit row click / Review / search-driven selection paths intact
- Allowed edit files:
  - `AdminUI.html`
  - `Config.js`
  - `CURRENT_TASK.md`
- Explicitly out of scope:
  - no adapter/CRM routing changes
  - no Books/payment/enrolment/classroom backend changes
  - no send-gate changes
  - no bulk send activation
  - no sheet reset/archive logic

## r192 Implementation Notes

- Root cause audit:
  - no hardcoded `FODE-26-002940` was found in runtime source
  - sticky selection came from OPS queue auto-selecting the first visible row when selection was non-explicit
  - downstream panels then honored that implicit queue selection through `opsSelectedApplicantId` and detail-cache fallback
- `AdminUI.html`
  - removes normal queue auto-select behaviour
  - keeps no selected applicant on fresh load until the operator explicitly chooses a row
  - clears stale selected applicant when it is no longer in the current visible queue/search context
  - leaves explicit row click / Review / search-driven selection intact
  - keeps Safe Mode approved target as diagnostic metadata only, not as the normal working applicant

## r192 Acceptance Checklist

- Admin whoami: must report `r192 / 192`, `mismatch=false`
- Student whoami: must report `r192 / 192`, `mismatch=false`
- Fresh OPS load does not auto-select stale/historical applicant
- No panel shows `FODE-26-002940` unless the operator explicitly selected it
- Row click / Review / search result updates selected applicant across panels
- Refresh does not revert to stale applicant when it is not in current visible queue/search context
- Super Admin send actions follow the selected row only

## r191 Implementation Notes

- `AdminUI.html`
  - Adds `Email Issue / Contact Correction` as the final lifecycle band after `Exceptions / Blocked`
  - Uses existing queue/detail fields to classify bounced/suppressed/correction-needed rows
  - Shows email issue badges:
    - `Email Issue`
    - `Bounce Detected`
    - `Email Suppressed`
    - `Correction Required`
    - `Corrected Email Available`
  - Routes the lifecycle action for that stage to the existing OPS email-correction surface instead of the legacy review modal
  - Communications panel now shows suppression reason and fallback hint where email is blocked
- `Admin.js`
  - Exposes existing row fields into queue/detail payloads only:
    - `Email_Verification_Status`
    - `Last_Email_Error`
    - `Last_Email_To`
    - plus bounce/corrected-email fields for queue rendering
- Existing bounce processing remains unchanged and was not run
- Existing send gates remain unchanged

## Existing Email / Send Audit Summary

- `fd_acknowledgement`: working, backend/admin path present
- `missing documents`: weak, working send path but generic body and no template save flow
- `reminder`: working
- `portal access / legacy invite`: working
- `invoice reminder / payment_followup`: weak
- `custom email`: working
- `WhatsApp fallback`: working as CSV/export + admin email only
- `bulk / legacy campaign`: weak, backend exists but still stabilized/gated

## r191 Acceptance Checklist

- Admin whoami: must report `r191 / 191`, `mismatch=false`
- Student whoami: must report `r191 / 191`, `mismatch=false`
- Email Issue / Contact Correction appears as final lifecycle stage
- Known bounced/suppressed rows appear there when loaded
- Selecting a row there updates selected applicant context
- Lifecycle action from that stage reaches existing email correction UI
- Communications panel shows suppression/bounce reason and fallback hint
- WhatsApp fallback queue remains visible
- No scanner run, no bulk send, no sheet reset, no adapter/CRM changes

## Previous CIS

- `CIS r188: OPS Workflow UX Stabilization`.
- Target runtime identity: `r188 / 188`.
- Scope classification: UX/workflow stabilization only; no backend business logic expansion.
- Allowed edit files:
  - `AdminUI.html`
  - `Admin.js` only for minor read-only queue row/status field support
  - `Code.js` only for existing read-only exposure if needed
  - `CURRENT_TASK.md`
  - `Config.js` for release identity
- Forbidden:
  - Do not touch `FODE_Data` adapter.
  - Do not touch CRM routing, Zoho logic, fd_ack send gates, Books/payment/enrolment/classroom backend writes.
  - Do not process historical rows, change schema, create new deployments, or change canonical URLs.

## r188 Implementation Notes

- Applicant Queue is being stabilized as one lifecycle workflow surface.
- Lifecycle sections are ordered as: Application Received / FD Received; Portal Access / Portal Submitted; Documents Pending / Review; Payment Pending; Invoice / Books; Enrolment Pending; Classroom Handover; Exceptions / Blocked.
- Queue search now targets loaded lifecycle rows by `ApplicantID`, applicant/student name, email, and phone.
- Standalone sort buttons are removed from the workflow surface and replaced by clickable sortable headers.
- Selected applicant context remains the authority for Communications, Billing, Portal Diagnostics, Classroom, and selected action panels.
- Backend-missing controls are grouped under `Not Yet Available / Backend Missing` so daily operator workflow is separated from unaccepted modules.

## r188 Acceptance Checklist

- Admin whoami: pending, must report `r188 / 188`, `mismatch=false`.
- Student whoami: pending, must report `r188 / 188`, `mismatch=false`.
- Browser/manual OPS acceptance: pending.
- Queue load: pending.
- Lifecycle workflow order and newest FD intake visibility: pending.
- Search by ApplicantID/name/email/phone: pending.
- Selected context and review drawer alignment: pending.
- Sortable header behavior: pending.
- Date Applied, Aging, Last Action visibility: pending.
- Not Yet Available / Backend Missing register visible: pending.

## Accepted Baseline

- Latest deployed runtime before this task: `r184`.
- `fd_acknowledgement` message type exists from r184.
- r184 added the receipt acknowledgement body, Student Portal link, Documents still required section, and backend preview/send path.
- r185 implementation status in this working tree: accepted for manual fd_ack acknowledgement path; automatic post-commit remains gated.

## Active CIS

- `CIS r186: Narrow Automated FD Acknowledgement Send Gate`.
- Classification: approved to implement the narrow fd_ack unattended-send exception only.
- Allowed edit files:
  - `Code.js`
  - `Utils.js` only if needed for narrow gate logic
  - `Config.js` for narrow config flag and release identity
  - `CURRENT_TASK.md`
  - `Admin.js` only if diagnostic/admin wrapper adjustment is needed

## Required Business Outcome

New FD submission:

1. OPS row is created.
2. Intake lock is released after row/token/folder/verification commit.
3. Only the newly created `ApplicantID` is evaluated.
4. `fd_acknowledgement` sends automatically once if gates allow.
5. If gates block, durable block evidence is recorded.
6. Duplicate rerun does not send again.
7. Intake success response remains independent of acknowledgement email success.

## Mandatory Constraints

- Normal automatic path evaluates only the newly created `ApplicantID`.
- No full-sheet scan by default.
- No email send inside the locked intake mutation section.
- Intake success response must not depend on email send success.
- Use internal server-side actor only; no client-callable system actor bypass.
- Admin wrapper remains admin-checked.
- Historical/backfill mode remains disabled unless explicitly invoked with dry-run and Super Admin confirmation.
- No schema change.
- No trigger or broad autonomous runner activation.
- No broad UI rewrite.
- Safe Mode and production gates remain active.
- `CONFIG.ENABLE_UNATTENDED_EMAIL_SENDS` must remain `false`.
- Narrow r186 automation may authorize only `fd_acknowledgement`, `FD_ACK_POST_COMMIT`, one `ApplicantID`, single-row post-commit scope, with duplicate guard passed.

## Duplicate / Blocked Durable Mapping

- For duplicate `fd_acknowledgement`, do not set `Email_Status = SUPPRESSED`.
- Preferred duplicate durable state:
  - `Last_Contact_Type = fd_acknowledgement`
  - `Last_Contact_Result = DUPLICATE`
  - `Last_Contact_Batch = r185 fd_ack run/debug label`
  - `Last_Contact_DebugId = correlation/debug id`
  - `Last_Contact_Subject = Duplicate fd_acknowledgement suppressed`
- Leave `Email_Status` unchanged for `DUPLICATE`, `BLOCKED`, and `SKIPPED` unless a safe message-type-specific convention is proven.

## r185 Accepted Status

- Runtime r185 / 185 deployed and whoami passed.
- Admin staging deployment: pinned to `@198`.
- Student staging deployment: pinned to `@198`.
- Admin whoami: PASS, `r185 / 185`, `mismatch=false`.
- Student whoami: PASS, `r185 / 185`, `mismatch=false`.
- Manual fd_ack live send for `FODE-26-002935`: PASS.
- Email receipt confirmed at `sanjay@kundu.ac`.
- Duplicate rerun: PASS, blocked with `COOLDOWN_ACTIVE`.
- Manual fd_ack classification: `MANUAL_PREVIEW_SEND_WORKS`.
- Automatic post-commit fd_ack classification: `BACKEND_EXISTS_BUT_GATED`, blocked by unattended-send policy.
- Do not classify r185 as `AUTOMATED_WORKFLOW_ACTIVE`.

## Current Stop State

- r187 / adapter-r002 implementation in progress.
- Adapter project `FODE_Data` was updated in isolated folder `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Data_adapter_audit`.
- Adapter source identity: `adapter-r002`.
- Adapter default mode: `CRM_BACKUP_LIVE`.
- Adapter canonical forwarding target remains Admin deployment `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ`.
- Adapter Apps Script platform version created: `27`.
- Existing pinned adapter deployments repinned to `@27`:
  - `AKfycbw2foU2aG1XL94EcDvNF-_BrQMmpWwdIdApMZLyYTKG6HIkWlrbLlAIVu5bnmxE4OE6`
  - `AKfycbzEplxMwBCLxZOCYJ1QyAz1eJwvghWMmd92ZwoMLeJYiaaZFA64RQhxCgoW1O3DsDoG`
- Adapter Script Property setting still requires manual confirmation if existing property remains `CRM_SHADOW`: set `ADAPTER_MODE = CRM_BACKUP_LIVE`.
- Main runtime local identity is bumped to `r187 / 187`.
- r187 `clasp push`: PASS, pushed 8 files at 7:59:58 pm.
- r187 remote source proof outside repo root: PASS from `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog_remote_verify_r187_20260521_2000`.
- r187 Apps Script platform version created: `202`.
- Admin staging deployment: repinned to `@202`.
- Student staging deployment: repinned to `@202`.
- Admin whoami after r187 repin: PASS, `r187 / 187`, `mismatch=false`.
- Student whoami after r187 repin: PASS, `r187 / 187`, `mismatch=false`.
- r187 runtime scope:
  - Add `fdReceived` / `Application Received` queue bucket for new external FD intake rows.
  - Carry adapter/CRM/fd_ack status fields into queue rows.
  - Display ack, CRM backup, portal, docs, and payment badges where loaded row data exists.
  - Fix selected applicant context so review/open paths update OPS selected panels.
- Pending r187 validation: operator FD/PS acceptance test proving adapter `CRM_BACKUP_LIVE`, CRM backup write/log result, fd_ack result, OPS `Application Received / FD Received` visibility, and selected-applicant context alignment.

- r186 implementation in progress.
- Local `Config.js` identity is bumped to `r186 / 186`.
- `ENABLE_UNATTENDED_EMAIL_SENDS` remains `false`.
- `ENABLE_AUTOMATED_FD_ACK_SENDS` is the narrow r186 authorization flag.
- `clasp push`: PASS, pushed 8 files at 12:32:08 pm.
- Remote source proof outside repo root: PASS from `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog_remote_verify_r186_20260521_1232`.
- Apps Script platform version created: `199`.
- Admin staging deployment: pinned to `@199`.
- Student staging deployment: pinned to `@199`.
- Admin whoami: PASS, `r186 / 186`, `mismatch=false`.
- Student whoami: PASS, `r186 / 186`, `mismatch=false`.
- r186 gate-metadata forwarding patch: PASS.
- Patch-forward `clasp push`: PASS, pushed 8 files at 12:58:46 pm.
- Patch-forward remote source proof outside repo root: PASS from `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog_remote_verify_r186_forwarding_20260521_1259`.
- Patch-forward Apps Script platform version created: `200`.
- Admin staging deployment: repinned to `@200`.
- Student staging deployment: repinned to `@200`.
- Admin whoami after patch-forward: PASS, `r186 / 186`, `mismatch=false`.
- Student whoami after patch-forward: PASS, `r186 / 186`, `mismatch=false`.
- External FD feed classification patch-forward `clasp push`: PASS, pushed 8 files at 1:48:09 pm.
- External FD feed classification remote source proof outside repo root: PASS from `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog_remote_verify_r186_classification_20260521_1348`.
- External FD feed classification Apps Script platform version created: `201`.
- Admin staging deployment: repinned to `@201`.
- Student staging deployment: repinned to `@201`.
- Admin whoami after external FD feed classification patch-forward: PASS, `r186 / 186`, `mismatch=false`.
- Student whoami after external FD feed classification patch-forward: PASS, `r186 / 186`, `mismatch=false`.
- Automatic post-commit fd_ack must not be classified as `AUTOMATED_WORKFLOW_ACTIVE` until all r186 acceptance tests pass.
- Pending acceptance: Admin badge check, manual regression, automatic new FD submission, duplicate rerun, and safety regression.

## r186 Patch-Forward: External FD Feed Classification + Portal Link

- Phase 1 diagnosis: PASS.
- Proven cause: `AdminUI.html` used stale `opsDummyMarker_(applicantId)` logic that marked only `FODE-26-002013` as live and all other ApplicantIDs as `Dummy / test`.
- Evidence row: `FODE-26-002938` showed external FD feed fields (`FD_FormID`, `FormID`, `adapter_forwarded = 1`, `adapter_source = sheet_bound_adapter`, `correlation_id`, `__reqId`) but no durable fd_ack result.
- Phase 2 approved files: `AdminUI.html`, `Code.js`, `CURRENT_TASK.md`, and `Config.js` only if identity/source proof requires it.
- Patch-forward implementation:
  - Admin UI marker is now row-aware: explicit test/dummy patterns remain `Dummy / test`; external FD feed rows display as `Live / external FD feed`; other rows display as `Unclassified`.
  - fd_ack email body now presents `Open Student Portal` plus a plain copy-paste fallback URL for Chrome using the existing canonical portal URL.
  - Post-commit fd_ack exception/lock-skip branches now write minimal durable `Last_Contact_*` trace as `FAILED` or `SKIPPED` using existing fields.
- Send gate status: unchanged. No global Safe Mode weakening, no `ENABLE_UNATTENDED_EMAIL_SENDS` change, no further r186 gate patch without runtime/log evidence.

## r186 Acceptance Checklist

- Runtime:
  - Admin whoami `r186 / 186`, `mismatch=false`.
  - Student whoami `r186 / 186`, `mismatch=false`.
  - Admin badge `r186 / 186`.
- Manual regression:
  - fd_ack manual send/dry-run path still works or duplicate guard blocks appropriately.
- Automatic new FD submission:
  - New `ApplicantID` appears in OPS.
  - Only that `ApplicantID` is evaluated.
  - fd_ack email sends automatically if gates allow.
  - Email is received by intended/test recipient.
  - Email includes Student Portal link.
  - Email includes Documents still required section or valid fallback.
  - Durable state records `SENT`.
  - No historical rows touched.
- Duplicate protection:
  - Same `ApplicantID` rerun sends no second email.
  - Duplicate/cooldown/prior fd_ack reason is durable.
- Safety regression:
  - `ENABLE_UNATTENDED_EMAIL_SENDS` remains `false`.
  - Other unattended message types remain blocked.
  - Stage runner/global automated sends are not enabled.
  - No broad scan occurred.

## r186 Release Discipline

- Remote source proof required before Apps Script versioning.
- Repin existing Admin and Student deployments only; do not create new deployment IDs.
- No commit or tag until all acceptance tests pass.
- If r186 fails, repin Admin and Student back to r185 platform version `198` and verify whoami `r185 / 185`.

## Next Release Notes

### r186 Candidate: narrow automated fd_ack send gate

- Goal: when a new FD submission updates OPS with a new `ApplicantID`, fd_ack acknowledgement is automatically evaluated and sent or blocked with durable reason.
- Must not enable global unattended sends.
- Must allow only `fd_acknowledgement` post-commit, single `ApplicantID`.
- User will test this with a new FD submission.

### Mobile-safe Student Portal link improvement

- Email portal link did not work cleanly in user's phone environment.
- Investigate canonical `/macros/s/` Student URL generation.
- Avoid `/a/macros/` account-scoped links.
- Add clean `Open Student Portal` link plus plain copy-paste fallback URL.
- Ensure link works for PNG mobile users without admin Google accounts.

### Out of scope for r185 finalization

- Keep other backend-missing items out of r185 finalization.

## Release Closure Discipline + Follow-Up Register (Binding)

### Purpose

Protect runtime stability and prevent release drift.

### Rule

A release closes only against its approved scope and acceptance criteria.

New findings discovered during implementation, browser testing, operator testing, live acceptance, or runtime observation must be classified before affecting closure.

### Classification

`BLOCKER`

- Definition: directly prevents the approved release objective from functioning correctly.
- Examples: whoami mismatch, deployment mismatch, broken workflow, duplicate protection failure, unintended send/write, security regression, data corruption risk.
- Action: may block release closure.

`FOLLOW-UP`

- Definition: important but does not prevent the approved release objective from functioning.
- Examples: mobile-safe portal links, PNG device usability improvements, future automation, UI enhancements, reporting improvements, workflow optimization, convenience features.
- Action: must not block release closure.

### Closure Rule

- Do not silently absorb follow-up items into the current release.
- Do not expand acceptance criteria after implementation begins unless the issue is a true `BLOCKER`.
- Closure occurs against approved scope only.

## Follow-Up Register

| ID | Description | Source release | Suggested target release | Priority | Dependency | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FU-001 | Narrow automated fd_acknowledgement send gate for post-commit single ApplicantID workflow | r185 | r186 | High | narrow unattended-send exception design | In progress |
| FU-002 | Mobile-safe Student Portal links for PNG users; canonical /macros/s URL plus copy-paste fallback | r185 | r186 | High | portal link generation review | Pending |

---

## r212_6 Legacy Stage Batch Preview Clarity Fix

- Track: `Track L`
- Status: `Local UI fix applied; no runtime release yet`
- Baseline: `r212 / 212`, commit `a738611`, tag `staging-as212`
- Allowed files for this CIS:
  - `AdminUI.html`
  - `CURRENT_TASK.md`
  - `Config.js`
- Actual local source changes so far:
  - `AdminUI.html`
  - `CURRENT_TASK.md`
- `Config.js` remains unchanged at `r212 / 212`

### Diagnosis carried into fix

- `Preview Cohort` does not populate `Review Queues`.
- Preview output renders to:
  - `opsStageBatchSummary` / `stageBatchSummary`
  - `opsStageBatchPreviewDiagnostics` / `stageBatchPreviewDiagnostics`
- Selected stage and batch size were already passing correctly to `previewStageBatchUi_()`.
- Issue classified as legacy UI contract / visibility problem, not backend failure and not an `r212` extraction regression.

### Local fix scope applied

- Added clear inline contract text near Stage Batch Actions and OPS Bulk Tools:
  - Preview Cohort result appears in the preview result / diagnostics panel.
  - Review Queues remains a separate operational listing.
- Added explicit `Preview Cohort Result` / `Stage Batch Preview Result` labeling.
- Expanded preview summary text to show:
  - selected stage
  - requested batch size / preview limit
  - eligible preview count
  - candidate count
  - sendable-stage state
- Added safe post-preview scroll/focus to the visible preview result panel.

### Local acceptance snapshot

- `git diff --check`: PASS, no structural diff errors; CRLF warning only
- `git diff --name-only`: `.codexhub/*`, `AdminUI.html`, `CURRENT_TASK.md`
- No backend files changed
- No send/export/mutation executed

### Release state

- Browser/runtime/deployment acceptance: `PENDING`
- `r213`: `NO-GO` until this legacy stage-batch preview clarity issue is accepted or deployed and validated

### r213A addendum - stage-batch surface-aware resolver

- Root cause confirmed:
  - shared `firstExistingEl_()` resolution was preferring OPS targets before legacy targets
  - legacy Admin / Document Verification route could therefore read hidden OPS inputs and write hidden OPS preview output
- Narrow fix applied in `AdminUI.html` only:
  - added stage-batch-specific surface resolver
  - applied resolver to:
    - preview limit
    - diagnostic offset
    - preview summary
    - preview diagnostics
    - selected stage
    - message type
    - sendable
    - gate reason
    - preview/send buttons
    - inline note
    - post-preview focus target
- `Config.js` unchanged and remains `r213 / 213`
- Review button issue remains classified as separate until proven otherwise
- Release steps remain blocked pending local acceptance report and browser re-test

### r213B addendum - legacy review button identifier fix

- Track: `Track H`
- Status: `Local UI binding fix applied; no runtime release yet`
- Allowed files for this CIS:
  - `AdminUI.html`
  - `CURRENT_TASK.md`
- Root cause confirmed:
  - legacy `Review Queues` buttons render both `data-applicant-id` and `data-row-number`
  - queue-review click handling discarded `rowNumber` whenever `applicantId` existed
  - search-results review path already passed both identifiers to `review()`
- Narrow fix applied in `AdminUI.html` only:
  - queue-review now calls `review(rowNumber, applicantId, btn)` when `rowNumber` is valid
  - safe fallback remains `null` when queue rowNumber is absent/invalid
- No backend edits
- No RPC changes
- No payload changes
- No row-facts/include-boundary changes
- No send/export/mutation executed
- Billing remains out of scope
- `Config.js` remains unchanged at `r213 / 213`
