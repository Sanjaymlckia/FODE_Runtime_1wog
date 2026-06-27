# F1 Runtime Surface, Dead-Code, Logic-Risk & Operational-Risk Audit v01

Date: 2026-06-27
Classification: Track L - audit only / no runtime release
Baseline tag: `baseline/r301-dr-f1-readiness`
Baseline HEAD: `bf2fb48 docs: add DR5 backup verification report`
Runtime baseline: Admin staging `r301 / 301`

## 1. Executive Result

PASS_WITH_WARNINGS

F1 audit may proceed to F2 planning, but F2 pruning should be conservative. The runtime is operationally stable, but the surface is large and contains temporary/manual utilities, legacy campaign paths, frozen OPS paths, diagnostic probes, and multiple authority compatibility layers that should not be removed without proof.

No runtime files were edited for this audit.

## 2. Preflight

Preflight commands run:

- `git status -sb`
- `git log --oneline -5`
- `git diff --check`
- `git stash list`

Observed:

- Git status before report creation: clean, `## main...origin/main`
- Recent HEADs:
  - `bf2fb48 docs: add DR5 backup verification report`
  - `034498b docs: add roadmap DR verification plan`
  - `2519fd2 tools: add FODE disaster recovery toolkit`
  - `ba896e4 fix: complete selected applicant email templates`
  - `90a5fbc fix: sync document verification rollup queues`
- `git diff --check`: PASS
- Stashes:
  - `stash@{0}: WIP H1 semantic communication registry before AdminUI contamination rollback`
  - `stash@{1}: r218N diagnostic - stash AdminUI.html`

## 3. Runtime Surface Map

| File / surface | Classification | Role | Notes |
| --- | --- | --- | --- |
| `Code.js` | LIVE_REFACTOR_LATER | Apps Script route, portal/intake, communication runtime, lifecycle helpers, campaign/legacy mail paths | Large multi-domain file. Refactor candidate after F2, but not a direct removal target. |
| `Routes.js` | LIVE_KEEP | File proxy, whoami, portal upload route helpers | Critical for signed file route and preview/download security. |
| `Admin.js` | LIVE_REFACTOR_LATER | Admin RPC backend, document review, queues, comm surfaces, payment/Zoho, OPS bridge, manual utilities | Largest operational surface; prune temp/manual paths first. |
| `AdminUI.html` | LIVE_REFACTOR_LATER | Legacy/Admin UI plus OPS shell, review modal, gallery, communication, stage batch | Stable but dense. Do not visual-refactor until operational pruning is done. |
| `AdminUI_Ops*.html` | OPS_FROZEN_DO_NOT_TOUCH | OPS sub-surfaces / included templates | Frozen secondary surface; audit only, no expansion. |
| `AdminUI_SharedRowFacts.html` | LIVE_REFACTOR_LATER | Shared row-facts helpers for OPS/UI | Keep until OPS simplification decision. |
| `Config.js` | LIVE_KEEP | Runtime identity, gates, constants, deployment IDs, doc fields, comm types | Do not prune without full gate. |
| `Utils.js` | LIVE_REFACTOR_LATER | Shared helpers, Drive/Zoho/sheets/send/security utilities | Some legacy CRM/Zoho helpers remain; high-risk to prune without call graph proof. |
| `whoami_admin.html` | LIVE_KEEP | Runtime truth surface | Required for release discipline. |
| `appsscript.json` | LIVE_KEEP | Apps Script manifest/scopes | Required runtime manifest. |

## 4. Function / Module Classification Table

| Item / group | Examples | Classification | Rationale / action |
| --- | --- | --- | --- |
| Core route entry points | `doGet`, `doPost`, `doGet_whoami_`, `doGet_file_`, `doPost_portalUpload_` | LIVE_KEEP | Public web-app routes. Security and release proof depend on these. |
| File proxy/signing | `buildSignedDocumentFileActionUrl_`, `verifyDocumentFileActionSignature_`, `admin_getApplicantDocumentFileAction`, `doGet_file_` | LIVE_KEEP | C1 signed per-file contract. Do not weaken. |
| Document manifest/gallery | `admin_getApplicantDocumentManifest`, `admin_getApplicantDocumentImageRendition`, `adminDocumentGallery*` | LIVE_KEEP | Current accepted document gallery/preview path. |
| Document status save | `admin_updateDocStatuses`, `admin_updateDocStatuses_impl_`, `adminVerifyDocument`, `computeDocVerificationStatus_` | LIVE_KEEP | Recently fixed status persistence and rollup behavior. |
| Queue and dashboard | `admin_getReviewQueues`, `classifyAdminQueue_`, `deriveApplicantLifecycleStage_`, `admin_getOperationalDashboardMetrics` | LIVE_REFACTOR_LATER | Live and tested, but multiple queue/lifecycle compatibility layers exist. Refactor only after F2 proof. |
| Communication semantic registry/templates | `getCommunicationSemanticRegistry_`, `buildApplicantMessage_`, `admin_previewApplicantMessage`, `admin_sendApplicantMessage` | LIVE_KEEP | E3 accepted; selected-applicant templates operational. |
| Stage batch | `admin_previewStageBatch`, `admin_sendStageBatch`, `getBatchMessageTypeForStage_` | LIVE_KEEP | Live gated send surface; tests assert Stage Batch mappings unchanged. |
| Manual single-send probe | `manualSingleSendProbe`, `getManualSendProbeStatus_`, related cache helpers | LEGACY_KEEP_FOR_REFERENCE | Useful for controlled proof but not normal operator workflow. Keep until send architecture stabilizes. |
| Automated stage runner | `automatedStageBatchRunner`, `admin_getAutomatedStageRunnerStatus`, trigger install/remove helpers | LIVE_REFACTOR_LATER | LAP scaffold exists but automation is not normal active priority. Do not remove; mark for LAP review. |
| Preview backfill core | `admin_dryRunDocumentPreviewBackfill`, `admin_runDocumentPreviewBackfillBatch`, `adminDocumentPreviewBackfillBatch_` | LIVE_REFACTOR_LATER | Backfill utility is real, tested, and may be needed for 7C-D maintenance. |
| Preview backfill manual wrappers | `manualRunDocumentPreviewBackfill_*`, property wrappers, runner/status/report wrappers | TEMP_REMOVE_CANDIDATE | Manual Apps Script wrappers should not remain permanently in live runtime unless accepted as maintenance tooling. |
| Portal token backfill | `admin_backfillPortalTokens`, dry-run/apply wrappers | TEMP_REMOVE_CANDIDATE | Historical maintenance utility. Keep only if still operationally needed. |
| Property cleanup utilities | `admin_cleanupEphemeralCommunicationProperties`, display/dry-run/confirm wrappers | TEMP_REMOVE_CANDIDATE | Useful once, risky if left as broad live admin surface. Needs proof before removal. |
| Campaign legacy functions | `campaign_prepareLegacyRows_`, `campaign_sendLegacyBatch_`, `admin_campaign*`, `legacy_invite` batch paths | LEGACY_KEEP_FOR_REFERENCE / TEMP_REMOVE_CANDIDATE | Some paths are blocked by stabilization; retain until GF/marketing replacement decision. |
| Legacy admin queues | `legacy_admin_getReviewQueues`, `legacy_admin_getQueueItems` | UNKNOWN_NEEDS_PROOF | Could be older compatibility endpoints. Remove only after UI/tests/calls prove unused. |
| Zoho Books preview/write | `admin_previewZohoBooksFodePayload`, `admin_createZohoBooksFodeDraftInvoice`, `admin_sendZohoBooksTestInvoiceEmail` | LIVE_REFACTOR_LATER | Mutation-capable and gated; not in F2 first removal pass. |
| CRM legacy quarantine | `assertCrmLegacyQuarantined_`, CRM trigger helpers | LEGACY_KEEP_FOR_REFERENCE | Quarantine layer protects stale CRM paths. Do not remove until CRM deprecation plan exists. |
| Test/manual Apps Script functions | `test_ShowConfig`, `test_DumpConfigKeys`, `_claspPing`, `test_*` | DEAD_REMOVE_CANDIDATE / UNKNOWN_NEEDS_PROOF | Likely editor-era diagnostics. Remove only after checking no release scripts rely on them. |
| Drive/portal smoke/probe routes | `driveprobe`, `drivedeepprobe`, `portalsmoke`, `uploadsmoke` | TEMP_REMOVE_CANDIDATE | Diagnostic routes increase surface area; prove whether still needed for support. |
| OPS classroom/communication bridges | `admin_previewOpsClassroomHandover`, `admin_notifyOpsClassroomAdmin`, OPS safe-mode helpers | OPS_FROZEN_DO_NOT_TOUCH | Mutation-capable but gated. Defer to OPS simplification, not F2 first prune. |

## 5. UI Surface Classification

| UI surface | Classification | Notes |
| --- | --- | --- |
| Admin runtime header / whoami links | LIVE_KEEP | Release discipline depends on visible runtime identity. |
| Review Queues | LIVE_KEEP | Primary operational surface. |
| Document & Payment Status dashboard | LIVE_KEEP | Supporting operational summary. |
| Exceptions & Blockers / Communication Performance | LIVE_KEEP | Current operator value. |
| Compatibility Summary | LEGACY_KEEP_FOR_REFERENCE | Useful historical context, lower priority. |
| Applicant Search | LIVE_KEEP | Utility surface. |
| Actionability Preview | LIVE_REFACTOR_LATER | Advisory only; still labelled preview/experimental. |
| Selected applicant review modal | LIVE_KEEP | Core document/payment/communication operator workflow. |
| Document cards + gallery + Enlarge lightbox | LIVE_KEEP | Accepted r298 visual proof. |
| Selected-applicant communication picker | LIVE_KEEP | E3 accepted selected template surface. |
| Stage Batch Communications | LIVE_KEEP | Live gated batch surface; mappings tested. |
| Zoho Books dry-run/live-write panel | LIVE_REFACTOR_LATER | Gated mutation risk; keep but audit separately. |
| Portal supervisory/batch/export tools | LIVE_REFACTOR_LATER | Useful but high-risk adjacency; not first prune target. |
| WhatsApp fallback export | LIVE_REFACTOR_LATER | Manual-only export; sensitive data handling risk. |
| OPS shell and subpanels | OPS_FROZEN_DO_NOT_TOUCH | Freeze remains correct; do not expand. |
| Legacy edit/mutation labels | LEGACY_KEEP_FOR_REFERENCE | Wording is safer than earlier states, but still confusing for future visual redesign. |

## 6. Document Preview / Backfill Classification

| Item | Classification | Risk / recommendation |
| --- | --- | --- |
| Signed file action route | LIVE_KEEP | Security-critical; do not prune. |
| Applicant-folder `FODE_PREVIEW` PNG naming | LIVE_KEEP | Current accepted architecture. |
| Lazy preview generation | LIVE_KEEP | Operator-proven visible previews and large overlay. |
| Future-upload preview hook in `canonicalizeFdIntakeFiles_` | LIVE_KEEP | Correct source-of-truth sequence: canonical copy first, preview second. |
| Historical backfill core | LIVE_REFACTOR_LATER | Tested and useful; can stay as maintenance utility. |
| Manual backfill editor wrappers | TEMP_REMOVE_CANDIDATE | Should be removed or moved behind explicit maintenance policy after 7C-D closes. |
| Backfill batch cap mismatch | UNKNOWN_NEEDS_PROOF | Operator requested 50, but tests/evidence show core batch may cap lower. Verify before future batch ops. |
| Old central rendition folder references | UNKNOWN_NEEDS_PROOF | Ensure no stale central preview assumptions remain before cleanup. |

## 7. Communications Classification

| Item | Classification | Notes |
| --- | --- | --- |
| Active message types | LIVE_KEEP | `legacy_invite`, `reminder`, `fd_acknowledgement`, `application_feedback`, `custom_email`, `docs_missing`, `payment_followup`. |
| Selected operational types | LIVE_KEEP | `application_verified_quote`, `application_acceptance_confirmation`, `application_receipt_request`, `application_final_reminder`, `application_exam_fee_reminder`, `contact_fallback_manual` are represented/tested as planned or selected surfaces depending on current registry state. |
| `custom_email` selected-only model | LIVE_KEEP | Tests assert not batch-safe. |
| `reminder` overloaded legacy type | LEGACY_KEEP_FOR_REFERENCE | Known semantic debt; do not extend. |
| Stage Batch mappings | LIVE_KEEP | Tests assert no H3 remap to selected-only types. |
| Campaign legacy batch/followups | TEMP_REMOVE_CANDIDATE | Stabilization blocks exist. Future GF/marketing architecture should decide whether to archive. |
| Bounce/contactability ingestion | LIVE_REFACTOR_LATER | H4 audit found runtime row evidence gap; newer bounce scan paths need separate authority proof. |
| Manual probe/cache/idempotency helpers | LEGACY_KEEP_FOR_REFERENCE | Useful proof tooling but not normal workflow. |

## 8. OPS / Frozen Classification

| Item | Classification | Notes |
| --- | --- | --- |
| OPS UI shell | OPS_FROZEN_DO_NOT_TOUCH | Architecture docs explicitly freeze OPS as secondary/reference surface. |
| OPS lifecycle summary | OPS_FROZEN_DO_NOT_TOUCH | Shared backend authority consumer, not primary authority. |
| OPS communications | OPS_FROZEN_DO_NOT_TOUCH | Avoid expanding send authority. |
| OPS safe-mode gates | LIVE_KEEP | Required while OPS mutation-capable paths exist. |
| OPS classroom notify | OPS_FROZEN_DO_NOT_TOUCH | Internal-send capable; do not alter in F2. |
| OPS legacy Admin bridge | OPS_FROZEN_DO_NOT_TOUCH | Fragile but intentionally bridges to current authority. |

## 9. Logic-Risk Review

| Risk | Evidence / example | Classification | F2/F3 action |
| --- | --- | --- | --- |
| Duplicated queue/lifecycle derivation | `computeDocVerificationStatus_`, `deriveApplicantLifecycleStage_`, `classifyAdminQueue_`, `adminOpsLifecycleStageKeyFromRow_` | LIVE_REFACTOR_LATER | Consolidate only after tests pin current queues. |
| Compatibility status mirrors | `Docs_Verified`, computed doc status, `Payment_Verified`, `Receipt_Status` | LIVE_REFACTOR_LATER | Keep mirrors; document source of truth before pruning. |
| Stage Batch vs selected templates | `getBatchMessageTypeForStage_` still maps broad stage reminders | LIVE_KEEP | Current tests protect; do not change in F2. |
| Legacy campaign paths vs H templates | campaign functions still use `legacy_invite`/`reminder` style flows | TEMP_REMOVE_CANDIDATE | Archive or isolate after marketing/GF plan. |
| Client/server name mismatch risk | Large `google.script.run` surface in `AdminUI.html` | UNKNOWN_NEEDS_PROOF | Generate RPC call graph before removing any `admin_*` function. |
| Silent/hidden failures | Some UI envelope handling displays generic server error; backend has mixed `err_`/plain return shapes | LIVE_REFACTOR_LATER | F3 standardize envelope/error reporting. |
| Unreachable branches | Stabilization gates block campaign sends/auto sends unless flags enabled | LEGACY_KEEP_FOR_REFERENCE | Mark blocked paths as archive candidates, not immediate dead code. |

## 10. Security-Risk Review

| Risk | Finding | Classification | Recommendation |
| --- | --- | --- | --- |
| Raw Drive IDs/URLs exposure | Secure file route exists; UI tests assert no raw Drive exposure in key paths | LIVE_KEEP | Keep tests; extend to new surfaces before pruning. |
| Permission bypass paths | Many `admin_*` RPCs are public Apps Script functions but use role gates internally | UNKNOWN_NEEDS_PROOF | F2 must classify each write RPC by required role. |
| Internal error leakage | Some file proxy/admin errors show debug IDs and sanitized messages | LIVE_REFACTOR_LATER | Preserve debug IDs, avoid raw exception details in UI. |
| Manual wrappers in runtime | Backfill/property/cleanup wrappers are callable from Apps Script editor | TEMP_REMOVE_CANDIDATE | Remove or formalize maintenance auth policy. |
| OPS mutation paths | Safe-mode gates exist but OPS remains mutation-capable | OPS_FROZEN_DO_NOT_TOUCH | Do not expand; future OPS simplification. |

## 11. Data-Integrity Review

| Risk | Finding | Recommendation |
| --- | --- | --- |
| Status/source conflicts | `Docs_Verified` is compatibility/mirror, computed required-doc status is authority | Keep tests from r300; avoid direct edits outside `admin_updateDocStatuses`. |
| Payment authority ambiguity | `Payment_Verified`, `Receipt_Status`, fee receipt evidence, Zoho/Books fields coexist | Do not refactor until payment authority audit. |
| Sheet header dependency | Many functions assume exact headers or compatibility aliases | F2 should map required headers per feature before removal. |
| Silent write failure | r299/r300 fixed false success for doc status; other write paths should be audited | Add write-count assertions to remaining mutation paths in F3. |
| Duplicate document assumptions | Multi-file school reports handled in gallery; other features may assume one file | Keep document tests; extend before refactor. |

## 12. Operational-Risk Review

| Risk | Finding | Recommendation |
| --- | --- | --- |
| Slow hydration | Large AdminUI and broad initial dashboard/queue calls remain risk | Keep F: health/hydration proof for all AdminUI changes. |
| Expensive Drive calls | Manifest/rendition/backfill paths touch Drive; lazy generation can be slow | Keep batch caps and stop conditions. |
| Manual backfill wrappers | Useful but not permanent operational surface | Resolve before F2 pruning begins. |
| Trigger assumptions | Automated stage runner trigger helpers exist but LAP not fully active | Do not enable without LAP CIS. |
| F: drive/tool runner instability | DR5 observed transient drive/session errors | Run DR tools sequentially; do not parallelize F: writes. |

## 13. Test-Coverage Review

Covered critical areas:

- Document file action / signed route / preview safety: `tests/admin-document-file-action.test.js`
- Gallery UI/lightbox behavior: `tests/admin-document-gallery-ui.test.js`
- Document status persistence: `tests/admin-document-status-save-persistence.test.js`
- Queue rollup consistency: `tests/admin-review-queue-rollup-consistency.test.js`
- Verifier/role gates: `tests/admin-document-verifier-role.test.js`
- Communication semantic registry/templates: `tests/communication-semantic-registry.test.js`
- Empty document payload warning: `tests/fd-empty-document-payload-warning.test.js`
- Preview backfill: `tests/admin-document-preview-backfill.test.js`

Gaps:

- No generated call graph proving unused `admin_*` RPCs.
- No systematic test for every write RPC returning zero-write failure.
- No comprehensive Playwright suite for all selected-applicant communication surfaces after E3.
- No automated test proving OPS remains frozen/non-authoritative.
- No test proving diagnostic routes/probes are inaccessible or intentionally safe.
- No Drive inventory/backfill end-to-end dry-run test outside Apps Script.

## 14. DR-Readiness Linkage

DR5 proves a usable repo snapshot and non-destructive restore baseline for r301. F2 removals are safer now because:

- `baseline/r301-dr-f1-readiness` exists.
- r301 snapshot restored to HEAD `034498b` in `F:\FODE_DR_Backup\restore_drills\dr5_verify_20260627_1305`.
- Release proof and Apps Script metadata exist.

F2 still must avoid removals that cannot be restored by Git alone, including:

- Apps Script deployment state
- Sheet data
- Drive applicant documents
- Script Properties / trigger state

## 15. Safe Removal Candidates

Top candidates for F2 archive/prune planning:

1. Apps Script editor `test_*` and `_claspPing` diagnostics after confirming no release/tooling dependency.
2. Drive/portal smoke/probe routes if no longer used in support workflows.
3. Manual preview backfill wrappers after 7C-D historical backfill is closed or moved to controlled maintenance tooling.
4. Portal-token backfill dry-run/apply wrappers after confirming no active migration need.
5. Legacy campaign batch/followup send paths after GF/marketing intake architecture supersedes them.

## 16. Items Requiring Proof Before Removal

- `legacy_admin_getReviewQueues` / `legacy_admin_getQueueItems`
- OPS include files and shared row facts
- CRM legacy quarantine helpers
- Zoho Books helper layers
- Automated stage runner scaffold
- Bounce/contactability scan functions
- Communication property cleanup helpers
- Any `admin_*` function referenced only by dynamic client strings

## 17. F2 Prune / Archive Recommendation

F2 should be a proof-first archive plan, not direct deletion.

Recommended F2 sequence:

1. Generate an RPC/function call graph from `AdminUI.html`, included HTML files, tests, and server code.
2. Classify every public `admin_*`, `legacy_admin_*`, `manual*`, `test_*`, campaign, and trigger function.
3. Create an archive plan with batches:
   - diagnostics/probes
   - manual wrappers
   - legacy campaign paths
   - OPS frozen remnants
   - stale tests
4. Remove only the first low-risk batch after tests and health proof.

## 18. F3 Refactor Recommendation

F3 should follow F2 and should not begin with deletion.

Recommended F3 themes:

- Split `Code.js` into route/portal/intake/communication/lifecycle modules if Apps Script bundling allows.
- Split `Admin.js` into document, queue, communication, payment/Zoho, and maintenance surfaces.
- Centralize authority functions for document/payment/lifecycle/communication state.
- Standardize RPC envelope/error/write-count behavior.
- Keep AdminUI visual redesign out of F3 unless explicitly approved.

## 19. Whether F2 May Begin

F2 may begin as an archive/prune planning pass only.

F2 should not delete runtime code until:

- call graph proof is generated;
- removal batch is scoped;
- tests for affected surfaces are identified;
- rollback target is recorded;
- no deployment/runtime release is attempted without a separate CIS.

## 20. Boundary Confirmation

This audit created a Markdown report only.

No runtime files were edited.
No code was deleted.
No pruning or refactor was performed.
No Apps Script source push occurred.
No Apps Script version was created.
No deployment was repinned.
No Sheet edit occurred.
No Drive edit occurred.
No production action occurred.
No Student staging action occurred.
No OPS action occurred.
No email was sent.
