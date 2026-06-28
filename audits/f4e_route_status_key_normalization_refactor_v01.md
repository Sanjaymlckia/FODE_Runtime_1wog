# F4E Route / Status-Key Normalization Refactor

## Executive result
PASS_WITH_WARNINGS

F4E completed as a bounded route/status-key normalization refactor. The runtime behavior is preserved; no Apps Script push, deployment, version creation, repin, Sheet mutation, Drive mutation, production action, Student action, or OPS action occurred.

Warning: repo-local validation required controlled local execution because the normal Codex Windows runner repeatedly failed with `CreateProcessAsUserW failed: 1312`. All controlled commands stayed inside `D:\Repos\FODE_Runtime_1wog` and were limited to repo-local git, search, read/write, and Node validation.

## Files changed

- `Code.js`
- `Admin.js`
- `tests/communication-send-gate-matrix.test.js`
- `tests/communication-semantic-registry.test.js`
- `audits/f4e_route_status_key_normalization_refactor_v01.md`

## Refactor summary

- Added `normalizeLifecycleStageKey_()` to centralize lifecycle/status key normalization.
- Added `lifecycleStageMessageTypeMap_()` as the single server-side map from lifecycle stage keys to communication message types.
- Updated `communicationRecommendedMessageTypeForStage_()` to use the shared lifecycle-stage map.
- Added `isLifecycleAwaitingResponseStage_()` to centralize the lifecycle stages treated as awaiting response.
- Updated `deriveApplicantActionability_()` to use the shared normalization and awaiting-response helper.
- Updated `getBatchMessageTypeForStage_()` to keep the existing `normalizeStageBatchStage_()` allowlist, then delegate to `communicationRecommendedMessageTypeForStage_()`.
- Updated tests to assert Stage Batch uses the shared lifecycle-stage mapping and does not map selected/manual templates.

## Behaviour preserved

- Stage Batch supported stages remain unchanged:
  - `INVITE_PENDING` -> `legacy_invite`
  - `INVITED_AWAITING_RESPONSE` -> `reminder`
  - `REMINDER_DUE` -> `reminder`
  - `DOCS_REQUIRED` -> `reminder`
  - `PAYMENT_REQUIRED` -> `reminder`
  - `RECEIPT_AWAITING_VERIFICATION` -> `reminder`
- Unsupported stages such as `PROCESSING` still return no batch message type.
- Selected/manual template types remain outside Stage Batch mapping, including `custom_email`, `docs_missing`, `payment_followup`, `application_verified_quote`, `application_acceptance_confirmation`, and `application_exam_fee_reminder`.
- `AdminUI.html` was not changed.
- Route URLs, doGet/doPost dispatch, signed file routes, portal routes, and public DTO shapes were not changed.
- Communication send gates, placeholder checks, idempotency, cooldown, and production-send gates were not changed.
- Payment authority, document authority, gallery/lightbox, FormDesigner intake, and OPS were not changed.

## Status-key inventory before/after

Before:
- Lifecycle stage normalization existed inline in `communicationRecommendedMessageTypeForStage_()` and `deriveApplicantActionability_()`.
- Stage-to-message mapping existed separately in `Code.js` and `Admin.js`.
- Awaiting-response stage classification existed as a duplicated inline array.

After:
- Lifecycle stage normalization is centralized in `normalizeLifecycleStageKey_()`.
- Server-side lifecycle stage to message type mapping is centralized in `lifecycleStageMessageTypeMap_()`.
- Stage Batch keeps its existing stage allowlist via `normalizeStageBatchStage_()`, then delegates message selection to the shared mapping.
- Awaiting-response stage classification is centralized in `isLifecycleAwaitingResponseStage_()`.

## Public DTO / route compatibility

No public route names, RPC names, URL parameters, DTO fields, or browser-facing route keys were changed. This pass only consolidates internal server-side lifecycle/status-key interpretation and test assertions.

## Protected surfaces

Touched:
- Communication lifecycle-stage message mapping helpers.
- Stage Batch message type derivation helper, with the existing allowlist preserved.

Not touched:
- `AdminUI.html`
- `AdminUI_SharedRowFacts.html`
- `Routes.js`
- `Utils.js`
- `Config.js`
- `appsscript.json`
- `.clasp.json`
- Zoho Books/payment write behavior
- Document verification save behavior
- Preview/gallery/lightbox
- Signed document routes
- Portal/security
- FormDesigner intake
- OPS
- Production/Student deployments

## Tests run

- `node --check Code.js`
- `node --check Admin.js`
- `node --check Routes.js`
- `node --check Utils.js`
- `node tests/admin-review-queue-rollup-consistency.test.js`
- `node tests/admin-document-status-save-persistence.test.js`
- `node tests/payment-authority-matrix.test.js`
- `node tests/payment-authority-drift.test.js`
- `node tests/payment-authority-nonqueue-consumers.test.js`
- `node tests/admin-role-boundary-matrix.test.js`
- `node tests/admin-ui-rpc-contract.test.js`
- `node tests/communication-send-gate-matrix.test.js`
- `node tests/communication-semantic-registry.test.js`
- `node tests/fd-empty-document-payload-warning.test.js`
- `git diff --check`

Result: PASS.

## Windows runner recovery log

- Normal runner failed on initial repo-local `git status` / `rg` command with `CreateProcessAsUserW failed: 1312`.
- Controlled local execution was used for repo-local git/search/read/write/Node validation only.
- Commands stayed under `D:\Repos\FODE_Runtime_1wog`.
- No controlled execution was used for Apps Script push, deployment, versioning, repin, Sheet/Drive mutation, production, Student, or OPS actions.

## Remaining risks

- `AdminUI.html` still contains a client-side mirror of Stage Batch mapping for operator preview messaging. It was intentionally not changed in this pass to avoid AdminUI hydration risk. Server-side authority is now centralized; a future AdminUI-only slice may optionally consume server-provided mapping metadata if justified.
- Static tests protect the mapping and send gates, but this pass was not deployed and does not include live browser proof by design.

## Rollback path

Revert commit `refactor: normalize route and status keys` if post-review issues are found. No live runtime release or deployment rollback is required because this pass does not push Apps Script source or repin deployments.

## F4F recommendation

F4F may proceed as another bounded single-authority-seam refactor only after GitHub review. Avoid broad AdminUI normalization until a specific hydration-safe CIS authorizes it.