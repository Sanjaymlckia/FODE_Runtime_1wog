# Admin Release Evidence

- Verdict: PASS WITH RESTRICTIONS - ADMIN STAGING VERIFIED; MOBILE PORTAL FOLLOW-UP REQUIRED
- Release identifier: R20260801-011817-Admin-HighRiskAuthority
- Release class: HighRiskAuthority
- Baseline Git commit: be5770d09fc63049de9c2cba85168ef8097c9c41
- Diff hash: e0cec2e6e04b1b9555a129ec8671b94812fda1ee1d9d4c62561c4a7111457147
- Runtime before: r399 / 399
- Runtime after: r400 / 400
- Selected gate: Full
- Git commit status: Not committed or pushed - awaiting final owner acceptance

## Changed Files
- `Config.js`
- `EduOps_ClientWorkbench.html`
- `EduOps_FODE_Adapter.js`
- `EduOps_OperationsWorkspaceStyles.html`
- `tests/eduops-integrated-authority-surface.browser.test.js`
- `tests/eduops-r399a-portal-surface.test.js`

## Test Selection
- Gate: Full
- Escalation reasons: HighRiskAuthority release; explicit operator Full Gate request
- Tests intentionally not run: none
- Residual risk: Full repository suite selected.

## Browser Acceptance
- Admin live `whoami`: PASS - r400 / 400.
- Student live `whoami`: PASS - r217 / 217; unchanged.
- Applicant target: PASS - FODE-26-003235, exact row 332, Ezreel Inahori.
- Existing applicant-bound portal: PASS - opened read-only through the surfaced action; secure link verified; no portal mutation.
- Existing communication history: PASS - one `SEND_INDIVIDUAL_COMMUNICATION` receipt with outcome `SENT` for the exact applicant; no new communication was sent.
- Guardian relationship: PASS - portal record identifies Venoly Kifan Wavisause as Guardian. The historical recipient label uses the shorter “Venoly Kifan Wavisa” form; this naming variant must be reconciled before any future send.
- Portal desktop rendering: PASS - content and secure-link state visible.
- Portal mobile rendering at 390x844: RESTRICTION - content rendered, but measured document width 568px versus 375px viewport client width, indicating horizontal overflow in the existing Student portal surface. No mutation occurred.

## Safety
No Batch send, Gmail send, applicant mutation, Sheet mutation, Drive mutation, Zoho write, Google Classroom write, Student change or Production change occurred.
