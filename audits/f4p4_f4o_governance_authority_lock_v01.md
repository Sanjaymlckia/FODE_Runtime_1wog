# F4P.4 + F4O Governance Authority Lock

Track: Track L infrastructure/governance
Runtime release: No runtime release
Runtime mutation: none
Scope: Playwright fixture enforcement, governance documentation, runtime responsibility audit

## Executive Result

This pass locks communication regression to the six canonical fixture variables and establishes a documented Authority Verification Gate before future mutation work.

No runtime source behavior, Apps Script version, deployment repin, Sheet mutation, Drive mutation, email send, WhatsApp action, payment mutation, document-status mutation, production mutation, Student deployment action, or OPS action is authorized by this audit.

Production `FODE_Data` was read-only inspected to prove the canonical fixture rows and applicant IDs. No Sheet values were changed.

## Evidence Basis

- Local repo: `D:\Repos\FODE_Runtime_1wog`.
- GitHub remote: `https://github.com/Sanjaymlckia/FODE_Runtime_1wog.git` from `.git/config`.
- Apps Script project: `.clasp.json` script ID `1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90`.
- Runtime identity in local config: `Config.js` `VERSION: "r311"` and `DEPLOY_VERSION_NUMBER: 311`.
- Local data mode in config: `DATA_MODE: "PROD"`.
- Admin staging deployment ID: `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ`.
- Student staging deployment ID: `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv`.
- Production deployment ID: not proven in repo/config; existing DR audit classifies it as not safely recoverable yet.
- Runtime sheets and Drive IDs: from `Config.js` and `docs/architecture/Data_Source_Authority_Register.md`.
- Playwright sandbox: `F:\Playwright\fode-secure-link-diagnostic`.
- Fixture source proof: read-only Google Sheets metadata/range/search against production `FODE_Data`; `TEST_COMM_A..F` found on rows 323-328.

Live `whoami` was not run in this audit because no release or runtime mutation was authorized. Local source is not proof of live runtime.

## Largest Runtime Files

Line counts from `rg --count "^" -g "*.js" -g "*.html"`:

| Priority | File | Lines | Responsibility pressure |
| --- | --- | ---: | --- |
| HIGH | `Code.js` | 11205 | Student portal, intake, Drive, CRM, communication registry/builders, lifecycle/actionability, campaign/send logic. |
| HIGH | `AdminUI.html` | 10549 | Legacy Admin shell, OPS shell, selected applicant modal, communications, queues, document gallery, Books, portal, classroom, reports. |
| HIGH | `Admin.js` | 5055 | Admin RPCs, Books, portal, document/status writes, dashboards, actionability, lifecycle aggregation, campaign/OPS bridges. |
| HIGH | `Utils.js` | 4222 | Shared IO, Drive/Sheet helpers, Zoho/Books, portal secrets, send/cooldown/idempotency, property inventory. |
| MEDIUM | `Admin_StageBatchCommunications.js` | 1290 | Batch preview/send authority, caching, cursoring, parity and idempotency. |
| MEDIUM | `AdminUI_SharedRowFacts.html` | 933 | UI row facts, resolver comparison, communication row facts. |
| MEDIUM | `AdminUI_OpsCommunications.html` | 856 | OPS communication queues, selection, preview/send bridge. |
| MEDIUM | `AdminUI_OpsApplicantQueue.html` | 844 | OPS applicant queue, selection context, exports, upload reminder preview. |
| MEDIUM | `Admin_ReviewQueues.js` | 630 | Review queue row projection and rollups. |
| MEDIUM | `Admin_DocumentServices.js` | 583 | Document service helpers and manifest support. |

Apps Script size pressure remains HIGH because the four largest files carry most cross-surface responsibility and load together in the same project.

## Responsibility Overlap

### HIGH

- Communication authority overlaps across `Code.js`, `Admin_SelectedApplicantCommunications.js`, `Admin_StageBatchCommunications.js`, `Admin.js`, `AdminUI.html`, and `AdminUI_OpsCommunications.html`.
- Lifecycle/actionability is split across `Code.js`, `Admin_LifecycleAuthority.js`, `Admin.js`, `AdminUI_SharedRowFacts.html`, `AdminUI_OpsLifecycle.html`, and Admin UI queue rendering.
- Sheet/row authority is shared by `Utils.js`, `Admin.js`, `Code.js`, `Admin_RowFacts.js`, `Admin_ReviewQueues.js`, and UI row-facts derivation.
- Send/write authority is spread across selected applicant sends, Stage Batch sends, docs follow-up sends, campaign sends, Books test sends, payment verified emails, and OPS bridge controls.

### MEDIUM

- Document review authority overlaps between `Admin_DocumentServices.js`, `Admin_DocumentGallery.js`, `Admin_ReviewStatusAuthority.js`, `Routes.js`, `Utils.js`, and document UI rendering.
- Portal authority overlaps between `Code.js`, `Routes.js`, `Utils.js`, and `Admin.js` portal link/reset/access RPCs.
- Payment/Books authority overlaps between `Admin_PaymentAuthority.js`, `Admin.js`, `Utils.js`, and UI Books controls.

### LOW

- Access-control helpers are relatively isolated in `Admin_AccessControl.js`, but callers remain spread across runtime files.
- Small wrapper modules such as `Admin_SelectedApplicantCommunications.js` are thin and low-pressure after authority remains centralized.

## Module Coupling

### HIGH

- `Code.js` depends on shared helpers from `Utils.js` while also owning communication registry, portal, campaign, lifecycle, and send behavior.
- `Admin.js` consumes nearly every shared authority surface and exposes many RPCs; it remains a coordination hotspot.
- `AdminUI.html` still coordinates multiple included modules plus legacy modal, queues, document gallery, selected communication, Books, portal, and reporting controls.
- `Admin_StageBatchCommunications.js` depends on communication resolver, cache/property helpers, send helpers, lifecycle mappings, and row context.

### MEDIUM

- UI include modules are separated but share global state from `AdminUI.html`.
- Review queue code depends on payment, document, lifecycle, and row-fact helpers.

### LOW

- `Admin_AccessControl.js`, `Admin_RowFacts.js`, and `Admin_SelectedApplicantCommunications.js` are compact and mostly wrapper/helper layers.

## Duplicated Helpers

### HIGH

- Row/fact derivation exists in both backend row authority and UI row facts.
- Communication state/recommendation logic exists in backend resolver and selected UI recommendation hydration.
- Payment verified/evidence labels exist in backend payment authority, queues, communication resolver, and UI row facts.

### MEDIUM

- Portal link parsing/building appears in runtime helpers and UI helpers.
- Document evidence summary/rendering exists in backend manifest services and UI gallery/review card code.
- CSV/export helper logic is repeated across OPS queues and reports.

### LOW

- Small display helpers and formatting functions are duplicated in UI modules, but current risk is mostly maintainability, not authority drift.

## Remaining Extraction Candidates

### HIGH

1. Communication Authority Core: isolate registry, authority matrix, recommendation, preview/send preconditions, and fixture-backed tests from `Code.js`.
2. Admin RPC Router/Surface Split: split `Admin.js` by authority surface after stable communication and lifecycle cores are proven.
3. Admin UI Selected Applicant Shell: extract selected modal communications/document/Books/portal panels from `AdminUI.html` behind stable state contracts.
4. Lifecycle/Actionability Authority: consolidate backend lifecycle and UI row-facts derivation into one authority-backed DTO.

### MEDIUM

5. Stage Batch Authority: keep separate module but reduce dependencies on global helpers and strengthen fixture parity tests.
6. Document Services/Gallery: continue consolidating document manifest, rendition, and file-action helpers.
7. Portal Secrets/Links: isolate portal secret store and link authority from broader `Utils.js`.
8. Books/Payment: split Books integration from payment-state authority and keep write gates explicit.

### LOW

9. UI formatting/export helpers.
10. Small access-control wrapper cleanup.
11. Legacy campaign/report display helpers after send authority is stable.

## Deployment Impact

### HIGH

- Refactoring `Code.js`, `Admin.js`, `Utils.js`, or `AdminUI.html` requires full release discipline and live `whoami` proof because these files carry runtime behavior, sends, data access, and deployment identity.
- Any extraction touching send/write authority is Track H.

### MEDIUM

- UI include extraction can remain Track L only if it changes presentation/module boundaries without backend behavior, schema, sends, or mutation paths.
- Playwright fixture harness changes are outside Apps Script runtime but affect acceptance quality.

### LOW

- Documentation-only governance updates are Track L / no runtime release.

## Recommended Refactor Order

### HIGH

1. Communication Authority Core with canonical fixture suite as the acceptance floor.
2. Lifecycle/Actionability DTO consolidation to reduce backend/UI authority drift.
3. Admin selected-applicant surface extraction from `AdminUI.html` after DTO boundaries are stable.
4. Admin RPC surface split from `Admin.js` by authority domain.

### MEDIUM

5. Stage Batch dependency cleanup and parity tests.
6. Document manifest/gallery service consolidation.
7. Portal secrets/link authority isolation.
8. Books/payment authority split.

### LOW

9. UI formatting/export helper consolidation.
10. Access-control wrapper cleanup.
11. Historical campaign/report helper cleanup.

## Governance Authority Lock

The canonical Authority Verification Gate now lives in `docs/architecture/Governance.md`.

Before any mutation, future sessions must prove:

- target object;
- object ID;
- environment;
- authority source.

If any proof is missing, the only permitted mode is read-only.

## Communication Fixture Lock

Playwright communication acceptance must use only:

| Env var | ApplicantID | Sheet row | Permanent name |
| --- | --- | ---: | --- |
| `FODE_COMM_AUTHORITY_APPLICANT_A` | `FODE-26-TEST-001` | 323 | `TEST_COMM_A` |
| `FODE_COMM_AUTHORITY_APPLICANT_B` | `FODE-26-TEST-002` | 324 | `TEST_COMM_B` |
| `FODE_COMM_AUTHORITY_APPLICANT_C` | `FODE-26-TEST-003` | 325 | `TEST_COMM_C` |
| `FODE_COMM_AUTHORITY_APPLICANT_D` | `FODE-26-TEST-004` | 326 | `TEST_COMM_D` |
| `FODE_COMM_AUTHORITY_APPLICANT_E` | `FODE-26-TEST-005` | 327 | `TEST_COMM_E` |
| `FODE_COMM_AUTHORITY_APPLICANT_F` | `FODE-26-TEST-006` | 328 | `TEST_COMM_F` |

Missing variables, missing Admin target URL, lookup failure, lifecycle mismatch, recommendation mismatch, or authority mismatch must fail the run. Arbitrary applicant fallback is prohibited.

## Validation Evidence

Node/runtime checks:

- `node tests\communication-send-gate-matrix.test.js`: PASS.
- `node tests\communication-semantic-registry.test.js`: PASS.
- Existing admin/payment/document authority tests listed in the run log: PASS.
- `node --check Admin.js`: PASS.
- `node --check Admin_StageBatchCommunications.js`: PASS.
- `node --check Admin_SelectedApplicantCommunications.js`: PASS.

Playwright read-only fixture checks:

- `npm run test:comm-smoke`: PASS.
- `npm run test:comm-authority-fixtures`: PASS.
- `npm run test:comm-recommendation`: PASS.
- `npm run test:comm-applicant-switch-hygiene`: PASS.
- `npm run test:comm-stale-draft-hygiene`: PASS.
- `npm run test:comm-blocked-template-authority`: PASS.
- `npm run test:comm-override-workflow`: PASS.
- `npm run test:comm-no-send-verification`: PASS.

Repository check:

- `git diff --check`: PASS.

## Boundaries Observed

- No Apps Script push.
- No Apps Script version.
- No deployment repin.
- No Sheet mutation.
- No Drive mutation.
- No email or WhatsApp send.
- No payment mutation.
- No document-status mutation.
- No production mutation. Production `FODE_Data` was read-only inspected for fixture proof.
- No Student deployment action.
- No OPS action.
