# F2C Probe Route Archive Execution v01

## Executive result

Result: PASS_WITH_WARNINGS

This pass removed only the five explicit diagnostic/smoke `view=` route entries from `resolveDoGetHandler_()`:

- `driveapiprobe`
- `drivedeepprobe`
- `driveprobe`
- `portalsmoke`
- `uploadsmoke`

The named route handlers were not defined in the searched runtime files. If invoked before this patch, these route entries would resolve to missing functions. After removal, these views follow the existing unknown-route fallback: Admin deployment renders Admin, Student deployment renders the portal. Protected routes such as `diag`, `whoami`, `file`, `admin`, `ops`, blank Admin, and blank portal were not touched.

## Route proof ledger

| Route | Runtime proof | UI/HTML proof | Tests proof | Tools/DR/release proof | F: Playwright proof | Decision | Confidence |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `driveapiprobe` | Only route-map entry found; no handler definition found. | No AdminUI/HTML reference found. | No test reference found. | No active tool dependency found; only audit docs mention it. | F: path inaccessible from this Codex environment (`os error 433`). | Removed route entry. | High for local repo; warning for inaccessible F:. |
| `drivedeepprobe` | Only route-map entry found; no handler definition found. | No AdminUI/HTML reference found. | No test reference found. | No active tool dependency found; only audit docs mention it. | F: path inaccessible from this Codex environment (`os error 433`). | Removed route entry. | High for local repo; warning for inaccessible F:. |
| `driveprobe` | Only route-map entry found; no handler definition found. | No AdminUI/HTML reference found. | No test reference found. | No active tool dependency found; only audit docs mention it. | F: path inaccessible from this Codex environment (`os error 433`). | Removed route entry. | High for local repo; warning for inaccessible F:. |
| `portalsmoke` | Only route-map entry found; no handler definition found. | No AdminUI/HTML reference found. | No test reference found. | No active tool dependency found; only audit docs mention it. | F: path inaccessible from this Codex environment (`os error 433`). | Removed route entry. | High for local repo; warning for inaccessible F:. |
| `uploadsmoke` | Only route-map entry found; no handler definition found. | No AdminUI/HTML reference found. | No test reference found. | No active tool dependency found; only audit docs mention it. | F: path inaccessible from this Codex environment (`os error 433`). | Removed route entry. | High for local repo; warning for inaccessible F:. |

## Routes removed

Removed from `resolveDoGetHandler_()` in `Code.js`:

- `if (route === "driveapiprobe") return doGet_driveApiProbe_;`
- `if (route === "drivedeepprobe") return doGet_driveDeepProbe_;`
- `if (route === "driveprobe") return doGet_driveProbe_;`
- `if (route === "portalsmoke") return doGet_portalSmoke_;`
- `if (route === "uploadsmoke") return doGet_uploadSmoke_;`

## Routes retained

Retained:

- `diag`
- `whoami`
- `file`
- `ops`
- `admin`
- blank route Admin/portal fallback
- unknown-route Admin/portal fallback

The following diagnostic helper functions were retained for a later proof pass because this CIS is scoped to route entries:

- `driveProbeFolder_`
- `driveDeepProbe_`

## Before/after route count

| Metric | Before | After | Delta |
| --- | ---: | ---: | ---: |
| Explicit `if (route === ...)` entries | 10 | 5 | -5 |
| Protected route entries changed | 0 | 0 | 0 |

## Tooling/support dependency proof

Repository search covered:

- AdminUI and HTML includes
- runtime source
- tests
- `tools/`
- `docs/`
- `audits/`

Findings:

- No active AdminUI/HTML dependency.
- No tests dependency.
- No tooling dependency in repository `tools/`.
- No DR/release tooling dependency in repository.
- Only historical/audit documentation references existed.
- F: Playwright search could not be completed from this Codex environment because `F:\Playwright\fode-secure-link-diagnostic` returned `os error 433`. This is recorded as a warning, not proof of dependency.

## Protected surface impact

No protected surface was changed:

- Zoho Books: untouched.
- Payment verification: untouched.
- Document verification: untouched.
- Queue engine: untouched.
- Communications registry: untouched.
- Stage Batch: untouched.
- Signed document routes: `file` untouched.
- Preview/gallery/lightbox: untouched.
- Runtime identity: untouched.
- DR tooling: untouched.
- FormDesigner intake: untouched.
- Classroom handover: untouched.
- LAP scaffolds: untouched.
- Portal security: untouched.
- Contactability: untouched.
- OPS: `ops` route untouched.

## Rollback path

Rollback is a single git revert of the F2C commit, or restoring the five removed route branches from `7a68394`.

No Apps Script push, deployment, version, repin, Sheet edit, Drive edit, or live data action occurred.

## Architecture/documentation impact

The root `FODE_RUNTIME_ENTRYPOINT_AND_SECRET_AUDIT.md` was updated with a short F2C note so its route list does not imply the archived probe/smoke routes remain active.

No Mermaid, roadmap, authority model, lifecycle/state diagram, or protected surface register update is required for this narrow archive.

## Validation results

Run locally:

- `node --check Code.js`
- `node --check Routes.js`
- `node --check Admin.js`
- `node --check Utils.js`
- existing document/gallery/communication/status tests per final report
- `git diff --check`

Live hydration and identity-gate checks were not run because this CIS prohibits Apps Script push, deployment, version creation, and repin. No live runtime was changed.

## Recommendation for next step

Another F2 batch is justified only for orphan diagnostic helpers after a separate proof pass. Candidate next proof targets:

- `driveProbeFolder_`
- `driveDeepProbe_`

Do not combine those with maintenance wrappers, portal-token utilities, LAP, OPS, payment, document verification, communication, preview/gallery, or Stage Batch surfaces.

## Safety confirmation

- Feature work: No.
- Refactor: No.
- Apps Script push/version/repin/deployment: No.
- Sheet edits: No.
- Drive edits: No.
- Production touched: No.
- Student staging touched: No.
- OPS touched: No.
