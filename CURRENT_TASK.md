# Current Task

## Current Objective

Maintain `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog` as the authoritative FODE Runtime repo and complete r125: UI send timeout alignment + controlled trigger activation.

## Files In Scope

- `AdminUI.html`
- `Config.js`
- `CURRENT_TASK.md`

## Current Authority

- GitHub repo: `Sanjaymlckia/FODE_Runtime_1wog`
- Local repo: `E:\Gdrive\01 SANJAY\Codex_Sync\FODE_Runtime_1wog`
- Script ID: `1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90`
- Baseline: `r124 / 124` live before r125 release.
- Admin deployment: repin to `@125` after release.
- Student deployment: repin to `@125` after release.

## r124 Finding

Manual UI send of 10 reached the backend, but the Admin client timed out at 20 seconds and discarded the late success response. No runner rework is authorized for r125.

## Next Exact Step

Release the r125 `AdminUI.html` send-timeout alignment and `Config.js` r125 / 125 bump, then verify:

1. Admin whoami reports `r125 / 125`.
2. Student whoami reports `r125 / 125`.
3. Admin UI badge reports `r125 / 125`.
4. Manual UI send for `INVITE_PENDING`, batch size 10, completes without client timeout or stale success discard.
5. `admin_getAutomatedStageRunnerStatus` returns JSON with `version=r125`, `deployVersion=125`, `enabled=true`, `batchSize=10`.
6. One manual `automatedStageBatchRunner()` completes under 120 seconds and sends 0-10 emails only.
7. Install trigger only after the clean manual runner test passes.

## Cautions

- Do not increase automation batch size above 10 in r125.
- Do not change Gmail/send pipeline logic.
- Do not change Sheet schema.
- Do not change Drive logic.
- Do not rewrite server batching or automated runner logic.
- Do not install trigger until manual runner acceptance passes.
- No commit/tag until all acceptance evidence is confirmed.
- Treat live `whoami` as runtime truth.
- Rollback prefers repinning Admin and Student to r124; if a trigger was installed, remove or disable the `automatedStageBatchRunner` trigger.
