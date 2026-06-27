# F2B Batch A Archive Execution v01

## Executive summary

Result: PASS_WITH_WARNINGS

This was a small proof-backed archive/prune pass limited to obsolete Apps Script editor diagnostics and local test helpers. Protected operational surfaces were not changed.

Removed functions:

- `test_ShowConfig`
- `test_DumpConfigKeys`
- `test_LogSheetWrite`
- `_claspPing`
- `test_PortalLogWrite`
- `test_AdminAuth`
- `test_AdminResetPortalLink`
- `test_BackfillPortalTokens_DryRun`

Retained because proof was insufficient or the surface is protected:

- `test_Smoke`
- diagnostic/probe routes: `driveapiprobe`, `drivedeepprobe`, `driveprobe`, `portalsmoke`, `uploadsmoke`
- preview backfill wrappers
- portal-token backfill operational functions
- property cleanup utilities
- campaign legacy paths
- LAP trigger/scaffold functions
- OPS functions
- Zoho/payment/document/communication/gallery/portal-security surfaces

## Removal ledger

| File | Function | Reason | Proof | Rollback source | Confidence | Protected-surface impact |
| --- | --- | --- | --- | --- | --- | --- |
| `Code.js` | `test_ShowConfig` | Editor diagnostic logging config IDs. | `rg` found no UI, route, trigger, test, tool, or runtime references outside audit docs. | `git revert` of this commit or restore from `5ecd883`. | High | None. |
| `Code.js` | `test_DumpConfigKeys` | Editor diagnostic logging config key list. | `rg` found no active references outside audit docs. | `git revert` or restore from `5ecd883`. | High | None. |
| `Code.js` | `test_LogSheetWrite` | Write-capable diagnostic to log sheet; not part of runtime workflow. | `rg` found no active references outside audit docs; write risk favors archive. | `git revert` or restore from `5ecd883`. | High | None; removes unsafe test write helper only. |
| `Code.js` | `_claspPing` | Historical clasp ping helper. | `rg` found no active references outside audit docs. | `git revert` or restore from `5ecd883`. | High | None. |
| `Utils.js` | `test_PortalLogWrite` | Write-capable portal log smoke helper. | `rg` found no active references outside its own body and audit docs. | `git revert` or restore from `5ecd883`. | High | None; removes unsafe test write helper only. |
| `Admin.js` | `test_AdminAuth` | Editor diagnostic logging active user. | `rg` found no active references outside audit docs. | `git revert` or restore from `5ecd883`. | High | None. |
| `Admin.js` | `test_AdminResetPortalLink` | Mutation-capable portal reset diagnostic targeting row 2. | `rg` found no active references outside audit docs; mutation risk favors archive. | `git revert` or restore from `5ecd883`. | High | None; removes unsafe test mutation helper only. |
| `Admin.js` | `test_BackfillPortalTokens_DryRun` | Editor diagnostic wrapper over portal token backfill dry-run. | `rg` found no active references outside audit docs; core backfill function remains. | `git revert` or restore from `5ecd883`. | Medium | None; operational function retained. |

## Items retained

| Item | Reason retained |
| --- | --- |
| `test_Smoke` | Its inline comment describes a dependency smoke workflow. It is read-only and not fully proven obsolete. |
| Probe/smoke routes | Still present in route map and only medium-confidence archive candidates in F2A. |
| Manual preview backfill wrappers | Recent operational use; protected by F2A.5 as verify-first. |
| Portal token backfill functions | Historical maintenance path; keep until active migration need is closed. |
| Property cleanup utilities | Operational safety diagnostics; keep until separately scoped. |
| Campaign legacy paths | Tied to marketing/GF separation; keep as legacy reference until replacement plan. |
| LAP runners/triggers | Partial/future protected scaffold; not Batch A scope. |

## Items rejected

| Candidate | Decision |
| --- | --- |
| `driveapiprobe`, `drivedeepprobe`, `driveprobe`, `portalsmoke`, `uploadsmoke` | Rejected from this batch; route-map presence requires stronger proof. |
| all `admin_*` maintenance wrappers | Rejected from this batch; Apps Script editor/manual invocation can be a dynamic reference. |
| any communication/payment/document/gallery/portal/OPS helper | Rejected as protected surface. |

## Metrics before/after

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Runtime functions | 869 | 861 | -8 |
| Public `admin_*` functions | 78 | 78 | 0 |
| Routes | 10 | 10 | 0 |
| Trigger-candidate string hits | 120 | 120 | 0 |
| Archive candidates remaining | 14 high-confidence candidates from F2A, minus 8 removed | 6 plus medium/low proof candidates | -8 |
| Unknown/proof-required remaining | Many dynamic/editor/route/manual references | Unchanged except removed editor diagnostics | No broad change |

## Regression risk assessment

Risk is low. The removed functions were top-level editor diagnostics or local write/mutation test helpers with no active UI, route, test, trigger, tooling, DR, or operator workflow dependency proven by search. Operational functions called by those helpers were retained.

Protected surfaces were not edited:

- Zoho Books
- payment verification
- document verification
- queue engine
- communications registry
- Stage Batch
- signed document routes
- preview/gallery/lightbox
- runtime identity
- DR tooling
- FormDesigner intake
- classroom handover
- LAP scaffolds
- portal security
- contactability
- OPS

## Validation results

Local validation passed:

- `node --check Code.js`
- `node --check Admin.js`
- `node --check Utils.js`
- `node --check Routes.js`
- `node tests/admin-document-status-save-persistence.test.js`
- `node tests/admin-review-queue-rollup-consistency.test.js`
- `node tests/admin-document-gallery-ui.test.js`
- `node tests/admin-document-file-action.test.js`
- `node tests/communication-semantic-registry.test.js`
- `node tests/fd-empty-document-payload-warning.test.js`
- `git diff --check`

Live hydration and identity-gate checks were not run because this CIS prohibits Apps Script push, deployment, version creation, and repin. No live runtime was changed.

## Rollback verification

Rollback path is a single git revert of the F2B Batch A commit or restoration of the removed functions from `5ecd883`. No live deployment or data mutation occurred as part of this archive pass.

## Architecture impact

No architecture behavior changes. The archive aligns with F2A.5/F2A.6 by pruning only proven diagnostics and leaving partial/future/protected surfaces intact.

## Documentation impact

This audit is the documentation impact record. Mermaid, roadmap, architecture authority docs, lifecycle/state diagram, and protected surface register do not require updates for this narrow removal.

## Recommendation for F2C

F2C is justified only as another narrow proof batch. Recommended next candidates:

1. Prove whether probe routes are still needed by support, F: Playwright, DR, or release tooling.
2. If not used, remove one route family at a time with health proof.
3. Continue to exclude all protected live/frozen and partial/future surfaces.

Do not start broad refactor or maintenance-wrapper cleanup until route/probe proof is complete.

## Safety confirmation

- Runtime feature work: No.
- Refactor: No.
- Deployment/version/repin/App Script push: No.
- Sheet edits: No.
- Drive edits: No.
- Production touched: No.
- Student staging touched: No.
- OPS touched: No.
