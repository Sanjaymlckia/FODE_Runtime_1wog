# Admin Release Evidence

- Verdict: PASS - ADMIN STAGING VERIFIED
- Release identifier: R20260730-091304-Admin-ClientOnly
- Release class: ClientOnly
- Baseline Git commit: 8506ce4dfdc1f7791d61ecb970ca0c2d768c9d99
- Diff hash: f6ec714580cc390f61272fa8345f3fbde48b00963d5ecbd5190fc3207286530a
- Runtime before: r392 / 392
- Runtime after: r393 / 393
- Selected gate: Fast
- Git commit status: Not committed or pushed - awaiting final owner acceptance

## Changed Files
- `Config.js`
- `EduOps_ClientWorkbench.html`
- `EduOps_OperationsWorkspaceStyles.html`
- `EduOps_Styles.html`
- `tests/r391de-density-readability.test.js`
- `tools/eduops-snapshot-capture/tests/preview-lab.browser.test.js`

## Test Selection
- Gate: Fast
- Escalation reasons:
- Tests intentionally not run: full repository suite
- Residual risk: Bounded selection relies on reviewed domain-to-test mapping plus permanent critical invariants; run Full Gate if mapping confidence changes.

## R391D/E Visual Density Evidence

Fixture path: EduOps Preview Lab, 100% browser zoom, deterministic scenario data. Before measurements use the accepted baseline CSS from Git `HEAD`; after measurements use the released R391D/E source. Control-overlap counts are clipping-aware and count only controls visible inside their rendered scroll/container bounds.

### 1366 x 768

| Metric | Before | After |
| --- | ---: | ---: |
| Useful workload rows visible | 4 | 4 |
| Summary-area height | 76 px | 76 px |
| Queue-control-band height | 337 px | 334 px |
| Applicant identity-header height | 216 px | 187 px |
| Overlapping controls | 0 | 0 |
| Clipped primary controls | 0 | 0 |

Additional checks:
- Global search font size: 15 px after release.
- Document original controls: 2 after release (`Open Original`, `Download Original`).
- Batch-send controls detected in fixture primary UI: 0.

### Larger Desktop Viewport

Viewport: 1920 x 1080.

| Metric | After |
| --- | ---: |
| Useful workload rows visible | 7 |
| Summary-area height | 82 px |
| Queue-control-band height | 301 px |
| Applicant identity-header height | 187 px |
| Overlapping controls | 0 |
| Clipped primary controls | 0 |

Manual acceptance confirmations from fixture/browser evidence:
- Operations Workspace is materially denser and easier to scan, primarily through reduced Workbench identity-header height, tighter queue band, stable row rhythm, and no visible control collisions.
- Global search remains at least 15 px and readable.
- Document originals remain accessible through governed `Open Original` and `Download Original` controls.
- Verify-once and bounded hidden-preview behaviour remain intact by unchanged command/document authority tests and Preview Lab contracts.
- Recommendation and permission remain distinct; package controls do not reintroduce false Compact/Expanded/Hidden modes.
- Finance remains read-only.
- Batch send remains prohibited.
- Stale-response, applicant-binding and population-integrity protections remain intact.

## Safety
No Batch send, Gmail send, applicant mutation, Sheet mutation, Drive mutation, Zoho write, Google Classroom write, Student change or Production change occurred.
