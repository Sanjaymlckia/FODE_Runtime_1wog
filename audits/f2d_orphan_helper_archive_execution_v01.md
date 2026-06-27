# F2D Orphan Helper Archive Execution v01

## Executive result

Result: PASS_WITH_WARNINGS

This pass removed two conclusively orphaned internal Drive diagnostic helpers:

- `driveProbeFolder_`
- `driveDeepProbe_`

Codex chose a batch size of two because only those helpers had high-confidence orphan proof after F2C. All other probe/manual/maintenance helpers had protected-surface, manual workflow, diagnostic, or future-roadmap ambiguity and were retained.

## Proof ledger

| Function | File | Last known operational purpose | Why obsolete now | Proof | Confidence | Protected-surface impact | Rollback path | Decision |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `driveProbeFolder_` | `Code.js` | Read-only folder probe for historical Drive diagnostics. | F2C removed the public probe routes; no remaining caller exists. | `rg` found only the function definition before removal; no UI, route, test, tool, DR/release, or operator workflow reference in the repository. | High | None. Does not affect signed document routes, preview/gallery, FormDesigner intake, or Drive canonicalization. | Revert F2D commit or restore from `6463b37`. | REMOVE |
| `driveDeepProbe_` | `Code.js` | Deep Drive diagnostic that could create/trash temporary probe folders/files. | F2C removed the public probe routes; no remaining caller exists. Its mutation-capable diagnostic behavior should not remain as an orphan helper. | `rg` found only the function definition before removal; no UI, route, test, tool, DR/release, or operator workflow reference in the repository. | High | None. Removes unused diagnostic write capability only. | Revert F2D commit or restore from `6463b37`. | REMOVE |
| `authDrive` | `Code.js` | Apps Script editor authorization helper. | Still documented as owner auth workflow. | Referenced in entrypoint audit and diagnostics. | High | Drive auth support. | Not applicable. | RETAIN |
| `authDriveYearFolder` | `Code.js` | Apps Script editor authorization/root folder helper. | Still documented as owner auth workflow. | Referenced in entrypoint audit and diagnostics. | High | Drive auth support. | Not applicable. | RETAIN |
| manual single-send probe helpers | `Admin.js` / `Utils.js` / `Code.js` | Controlled communication proof/status telemetry. | Protected by communication/send-surface ambiguity. | UI and runtime references exist. | High | Communication/send gates. | Not applicable. | RETAIN |
| preview backfill/manual wrappers | `Admin.js` | Controlled preview backfill operations. | Recent operational use and future upload/backfill closure dependency. | F2A.5 marks verify-first. | High | Preview/gallery/backfill. | Not applicable. | RETAIN |
| LAP trigger/scaffold helpers | `Code.js` / `Admin.js` | Future/partial lifecycle automation. | Protected partial roadmap surface. | F2A.5/F2A.6 protected. | High | LAP. | Not applicable. | RETAIN |

## Functions removed

- `driveProbeFolder_`
- `driveDeepProbe_`

## Functions retained

- `authDrive`
- `authDriveYearFolder`
- all manual single-send probe helpers
- all preview backfill wrappers
- all portal token maintenance helpers
- all property cleanup utilities
- all LAP scaffolds
- all OPS functions
- all Zoho/payment/document/communication/gallery/portal-security functions

## Batch-size rationale

The safe batch size was two. The two removed functions were orphan definitions with no direct or dynamic repository references and no route surface after F2C. `driveDeepProbe_` also had mutation-capable diagnostic behavior, which made removing the orphan safer than retaining it.

No additional helpers were removed because the remaining candidates had either active UI/runtime references, maintenance ambiguity, protected-surface relationship, or future-roadmap relevance.

## Validation results

Run locally:

- `node --check Code.js`
- `node --check Admin.js`
- `node --check Utils.js`
- `node --check Routes.js`
- key F2B/F2C regression tests per final report
- `git diff --check`

Live hydration and identity-gate checks were not run because this CIS prohibits Apps Script push, deployment, version creation, and repin. No live runtime was changed.

## Safety confirmation

- Protected surfaces changed: No.
- Feature work: No.
- Broad helper cleanup: No.
- Refactor: No.
- Apps Script push/version/repin/deployment: No.
- Sheet edits: No.
- Drive edits: No.
- Production touched: No.
- Student staging touched: No.
- OPS touched: No.

## Recommendation

Further F2 cleanup should pause unless a new CIS identifies another very small, high-confidence orphan set. The remaining likely cleanup areas are maintenance wrappers or protected/future surfaces and should not be pruned without operational closure proof.
