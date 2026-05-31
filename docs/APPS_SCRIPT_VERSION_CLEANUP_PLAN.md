# Apps Script Version Cleanup Plan

Date: `2026-05-31`

## 1. Current warning

- Apps Script versions in project history: `198 / 200`
- Cleanup goal: free version slots safely without touching active deployment pins or recent rollback-safe history
- Warning: do not delete active deployment versions

## 2. Active deployments and pinned versions

Active staging deployments:

| Surface | Deployment ID | Pinned platform version | Notes |
| --- | --- | ---: | --- |
| Admin staging | `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ` | `223` | Active |
| Student staging | `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv` | `223` | Active |

Existing inactive deployments observed during precheck:

| Surface | Deployment ID | Pinned platform version | Notes |
| --- | --- | ---: | --- |
| Student staging | `AKfycbxo4pbLuCo_xC3xEAXVVOSAeeNQL5kWpxvkrAJB9yaervmq_-HoU4mpN6p6pmlMs6_E` | `93` | Inactive contaminated deployment |
| Admin staging | `AKfycbwLz4rLrVzk-NriJAovTbifpg8YpQguFJiY-l02qkRrahH1ayX_2qBh3bk_rc8dVnPp` | `93` | Inactive contaminated deployment |
| Admin staging recovery | `AKfycbwlahPEMiKEVH9YiG6Kn-G5GzNlxgTtAuaZ-YQRmZ37_-eAfxyTB1jbafdScC5Ms_h2` | `100` | Inactive recovery deployment |
| Student staging recovery | `AKfycbzylLqI4GbbFK4kv0wKAGFbB2GFVKmDLH9jKTgoJ3hekdQsWcqEgjRu1LZII6QpbMpO` | `100` | Inactive recovery deployment |

Current local runtime identity:

- `Config.js VERSION: "r205"`
- `Config.js DEPLOY_VERSION_NUMBER: 205`

## 3. KEEP list with reasons

### Keep automatically

| Version | Reason |
| ---: | --- |
| `223` | Active Admin deployment pin, active Student deployment pin, `r205`, `staging-as205`, last 25 |
| `221` | `r203` stable rollback point, `staging-as203`, last 25 |
| `220` | `r202`, `staging-as202`, last 25 |
| `219` | `r201`, `staging-as201`, last 25 |
| `218` | `r200`, `staging-as200`, last 25 |
| `174`-`223` | Protected recent rollback/history window; do not delete in this cleanup pass |

### Keep by protected description keywords

| Version | Description | Reason |
| ---: | --- | --- |
| `17` | `r234: baseline freeze - stable Model B queue engine` | contains `baseline` and `stable` |
| `18` | `r235: canonical URL enforcement (client-side)` | contains `canonical` |
| `19` | `r235: client-side canonical enforcement (admin + student)` | contains `canonical` |
| `20` | `r235A: canonical enforcement fix for verifier runtime` | contains `canonical` |
| `21` | `Student r235A current-project canonical` | contains `canonical` |
| `35` | `r241: production switch (PROD sheet)` | contains `production` |
| `100` | `r100: seeder for fresh webapp deployment rotation after serving-layer mismatch` | pinned by inactive recovery deployments and operationally significant recovery baseline |

### Keep by Git tag coverage

Git staging tags present:

`staging-as096`, `staging-as097`, `staging-as098`, `staging-as099`, `staging-as104`, `staging-as105`, `staging-as106`, `staging-as108`, `staging-as109`, `staging-as112`, `staging-as113`, `staging-as114`, `staging-as115`, `staging-as116`, `staging-as117`, `staging-as118`, `staging-as119`, `staging-as130`, `staging-as131`, `staging-as136`, `staging-as137`, `staging-as138`, `staging-as149`, `staging-as152`, `staging-as153`, `staging-as154`, `staging-as155`, `staging-as162`, `staging-as163`, `staging-as164`, `staging-as165`, `staging-as166`, `staging-as168`, `staging-as169`, `staging-as170`, `staging-as171`, `staging-as172`, `staging-as173`, `staging-as174`, `staging-as175`, `staging-as176`, `staging-as177`, `staging-as178`, `staging-as180`, `staging-as181`, `staging-as182`, `staging-as183`, `staging-as185`, `staging-as189`, `staging-as190`, `staging-as191`, `staging-as192`, `staging-as193`, `staging-as194`, `staging-as195`, `staging-as196`, `staging-as197`, `staging-as198`, `staging-as199`, `staging-as200`, `staging-as201`, `staging-as202`, `staging-as203`, `staging-as205`

These tags reinforce keeping the corresponding Apps Script versions where identified in current release history, especially `218`-`223`. Versions whose release number clearly matches a tagged staging release should not be included in the low-number cleanup batch.

## 4. DELETE CANDIDATE list, max 50

Conservative delete candidates below avoid:

- active deployment pins
- recent rollback/history window `174`-`223`
- `r200`-`r205`
- tagged rollback anchors in current accepted release history
- protected descriptions containing `recovery`, `rollback`, `canonical`, `production`, `stable`, or `baseline`
- versions explicitly referenced in `CURRENT_TASK.md`, `docs/`, or `audits/` from current precheck evidence
- uncertain inactive deployment-pinned versions

| Version | Description |
| ---: | --- |
| `11` | `r230: 4-stage queue workflow on clean staging binding` |
| `12` | `r230: publish 4-stage queue logic and admin UI` |
| `13` | `r230: align admin queues to Model B payment workflow` |
| `15` | `r232: add live queue canary logging` |
| `16` | `r233: rename legacy queue RPCs in Code.js` |
| `36` | `r242A: new-row initialization + PortalSecrets sync` |
| `37` | `r242B: ApplicantID finalization hardening` |
| `38` | `r243B: forward-only adapter cutover` |
| `39` | `r243B2A: ApplicantID strict deterministic assignment` |
| `40` | `r243B2C: deterministic intake finalize fix` |
| `41` | `r243B3: ApplicantID increment hardening` |
| `42` | `r243B4: finalize execution hardening` |
| `47` | `r244G: queue diag for 3815 and 3816` |
| `48` | `r244G: queue diag (clean push)` |
| `49` | `r244H: FD submit-state normalization` |
| `50` | `2026-03-26-CIS-r245: harden portal_update validation, write path, and feedback` |
| `54` | `2026-03-28-CIS-r246D: fix admin_getReviewQueues post-summary INTERNAL` |
| `55` | `2026-03-29-CIS-r246E: add hybrid candidate-row prefilter for admin_getReviewQueues` |
| `56` | `r247: controlled legacy email reactivation` |
| `57` | `r247A: Gmail authorization alignment for campaign send/bounce` |
| `58` | `r247B: authority email template upgrade` |
| `59` | `r248A: communications engine and policy` |
| `60` | `r248B: communications tracking hardening` |
| `61` | `r248C: admin communications wrappers` |
| `62` | `r248C1: restore Gmail OAuth scope` |
| `63` | `r248C1: restore Gmail OAuth scope` |
| `64` | `r248D: applicant communications UI` |
| `65` | `r248D1: refresh applicant communications UI deployment` |
| `66` | `r248D2: add legacy invite dry-run helper` |
| `67` | `r249B: email validation and blocked-overwrite guard` |
| `68` | `r249C: surface communications block reason in Admin UI` |
| `69` | `r249C: surface communications block reason in Admin UI` |
| `70` | `r250A: derive stage and eligibility in communications modal` |
| `71` | `r250B: stage aggregation + priority + visual enhancement` |
| `72` | `r250B1: fix stage dashboard render and modal contrast` |
| `73` | `r250B2: finalize lifecycle panel contrast` |
| `74` | `r250B3: fix stage dashboard data binding` |
| `75` | `r250C: add refined safe stage batch preview and send` |
| `76` | `r250C1: fix stage binding and add cohort offset` |
| `79` | `r254C3i: downstream token evidence instrumentation` |
| `80` | `r254C3iA: token trace reached marker` |
| `81` | `r254C3iB: restore downstream hex helper in evidence path` |
| `82` | `r254C3iC: downstream verify-path proof seam fix` |
| `83` | `r254C3iC: runtime identity alignment` |
| `84` | `r254C3iC: downstream identity align to 83` |

Deletion batch size: `45`

## 5. UNKNOWN / operator review list

These are intentionally not in the delete batch because the current CLI evidence leaves meaningful ambiguity:

| Version | Description | Why not auto-delete |
| ---: | --- | --- |
| `22` | `r235B: align student config to current-project deployment` | current-project alignment wording; not protected by keyword but operational context is nontrivial |
| `23` | `r235B: align student deployment constants to current project` | current-project/deployment alignment wording; not protected by keyword but operational context is nontrivial |
| `14` | `r231: make explicit workflow fields canonical and hide computed status boxes` | contains `canonical`; protected |
| `51` | `2026-03-26-CIS-r246: FD file canonicalization and admin-link enforcement` | contains `canonical`; protected |
| `52` | `2026-03-26-CIS-r246B: external FD fetch and canonical Drive storage` | contains `canonical`; protected |
| `53` | `2026-03-28-CIS-r246C: fix FD submit-state stamping after canonicalization` | contains `canonical`; protected |
| `77` | `r250C4: remove admin trampoline and restore canonical redirect` | contains `canonical`; protected |
| `78` | `r251: bounce capture and delivery truth layer` | older communications truth-layer release; safe deletion is plausible but not sufficiently certain from current evidence |
| `85` | `rNNN: state-based stage send selection` | placeholder naming indicates uncertainty |
| `86` | `rNNN: fix stage batch preview hang` | placeholder naming indicates uncertainty |
| `87`-`99` | `r087` through `r099` preview/stage-batch/runtime-truth sequence | early foundational release train; not recent, but conservative review recommended before delete |
| `93` | `r093: bounded preview collector release` | pinned by inactive contaminated deployments; not active, but deleting a version still referenced by an existing deployment record should be explicit operator choice |

## 6. Recommended deletion batch

Recommended first batch:

- Delete the `45` versions listed in the `DELETE CANDIDATE` table above
- Do not delete:
  - `223`
  - `221`
  - `220`
  - `219`
  - `218`
  - `174`-`223`
  - `17`, `18`, `19`, `20`, `21`, `35`, `100`
  - any `UNKNOWN / operator review` versions

## 7. Target after cleanup

- Current version count: `198`
- If all `45` delete candidates are removed:
  - estimated remaining version count: `153`
- Target after cleanup:
  - `below 170 versions`
  - this target is achievable in one conservative old-version batch if all candidates are manually confirmed safe

## 8. Latest 50 Apps Script platform versions

Most recent 50 versions from `clasp versions`:

| Version | Description |
| ---: | --- |
| `174` | `r168: invoice status hydration and lifecycle badges` |
| `175` | `r169: read-only operations cockpit shell` |
| `176` | `r169: operations cockpit admin route repair` |
| `177` | `r170: operations cockpit polish and read-only data refinement` |
| `178` | `r170: operations cockpit visual rebuild` |
| `179` | `r171: operations cockpit submenu prototype` |
| `180` | `r172: operations cockpit controlled live actions` |
| `181` | `r173: Ops truth/safety correction + safe-mode lifecycle mapping` |
| `182` | `r173: ops safe-mode lifecycle mapping with row-selection acceptance fix` |
| `183` | `r174: operator console usability` |
| `184` | `r175: ops operational readiness` |
| `185` | `r176: ops stabilization and drift control` |
| `186` | `r177: ops working surface action router` |
| `187` | `r178: super admin portal controls and action activation clarity` |
| `188` | `r178: super admin portal controls and action activation clarity` |
| `189` | `r179: ops full working surface` |
| `190` | `r180: ops mode workspace acceptance fix` |
| `191` | `r181: OPS invoice workflow acceptance fixes` |
| `192` | `r182: OPS progressive role stack and acceptance hardening` |
| `193` | `r183: OPS stabilisation cleanup` |
| `194` | `r183: OPS final sidebar lifecycle tidy` |
| `195` | `r184: FD acknowledgement message type` |
| `196` | `r185: FD acknowledgement operational automation` |
| `197` | `r185 patch: accept fd acknowledgement manual single-send confirmation` |
| `198` | `r185 patch: route fd acknowledgement manual acceptance as manual single send` |
| `199` | `r186: narrow automated fd acknowledgement send gate` |
| `200` | `r186: forward fd acknowledgement automation gate metadata` |
| `201` | `r186: external FD feed classification and portal link patch-forward` |
| `202` | `r187: FD intake visibility CRM backup and OPS selected context` |
| `203` | `r187 patch: narrow fdReceived queue and selected context` |
| `204` | `r188: OPS workflow UX stabilization` |
| `205` | `r189: OPS functional parity and Super Admin selected-applicant authority` |
| `206` | `r190: fd_ack portal link repair` |
| `207` | `r191: email issue lifecycle and bounce visibility` |
| `208` | `r191: verified email issue lifecycle and bounce visibility` |
| `209` | `r191: verified email issue lifecycle and bounce visibility` |
| `210` | `r192: remove sticky selected-applicant default logic` |
| `211` | `r193 Operator Admin surface safety policy` |
| `212` | `2026-05-27 r194: lifecycle map usability cleanup and email correction contact visibility` |
| `213` | `2026-05-27 r195: email correction handoff and communications cleanup` |
| `214` | `2026-05-27 r196: document evidence wording cleanup` |
| `215` | `2026-05-27 r197: document checklist visibility` |
| `216` | `r198: Payment receipt evidence wording alignment` |
| `217` | `2026-05-27 r199: communication clarity and followup csv fields` |
| `218` | `r200: elevated admin role` |
| `219` | `r201: OPS lifecycle Dropped / Ineligible display stage` |
| `220` | `r202 campaign traffic reporting` |
| `221` | `r203 ops communications work queue surface` |
| `222` | `r204 ops communications selectable queue workbench` |
| `223` | `r205 shared row facts classifier phase 1` |

This section is reference only. It is not the deletion target set. In this cleanup pass, versions `174`-`223` are protected as the recent rollback/history window.

## 9. Approval gate

Approve deletion of the listed `DELETE CANDIDATE` versions? Reply `APPROVE_VERSION_DELETE`.
