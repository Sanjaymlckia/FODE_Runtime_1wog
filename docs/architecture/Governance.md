# Architecture Governance

Status: r23B consolidation draft
Scope: documentation governance only

## Source Preservation Rule

Original source documents remain in place until the consolidated architecture package is reviewed and accepted.

No source files are deleted by r23B.

## Keep / Merge / Archive / Retire Map

| Source | Recommendation | Reason |
|---|---|---|
| `ARCHITECTURE_ROADMAP_NO_CRM.md` | KEEP / MERGE | Strategic roadmap and system boundaries. |
| `docs/operations/ROADMAP_UNIFIED_OPERATIONS_PLATFORM.md` | KEEP / MERGE | Unified platform roadmap. |
| `docs/operations/S5A_OPERATIONAL_AUTHORITY_MAP.md` | KEEP / MERGE | Current authority model source. |
| `docs/operations/S5A_CANONICAL_INTAKE_LIFECYCLE.md` | KEEP / MERGE | Current lifecycle model source. |
| `docs/operations/S5B_LIFECYCLE_SEMANTICS_REVIEW.md` | KEEP / MERGE | Lifecycle semantic guardrails. |
| `docs/operations/S5A_COMMUNICATION_WORKFLOW.md` | KEEP / MERGE | Communication workflow source. |
| `docs/FODE_ARCHITECTURE_MAP_r205.md` | KEEP / MERGE / SUPERSEDE LATER | Current Mermaid/refactor benchmark. |
| `FODE_AUTHORITY_MODEL_r105.md` | ARCHIVE LATER | Historical authority model. |
| `audits/r22xA_intake_completeness_authority_audit_v01.md` | KEEP AS EVIDENCE | Completeness/review authority discovery. |
| `audits/r221A_stage_batch_authority_audit_v01.md` | KEEP AS EVIDENCE | Preview/send authority evidence. |
| `audits/r225A_document_payment_queue_count_authority_audit_v01.md` | KEEP AS EVIDENCE | Queue/count authority evidence. |
| `audits/r226A_ops_dependency_and_strategic_decision_v01.md` | KEEP AS EVIDENCE | OPS dependency and simplification evidence. |
| `audits/r226B_ops_freeze_boundary_note_v01.md` | KEEP AS EVIDENCE | OPS freeze boundary. |
| `OPS_LAYER_DIAGNOSTIC_SPRINT_REPORT_v01.md` | ARCHIVE/MOVE LATER | Diagnostic report outside current doc structure. |

## Superseded Notice Policy

After acceptance, older source docs should receive a short notice:

```text
Superseded for current architecture navigation by docs/architecture/.
Retained as historical source evidence.
```

Do not apply superseded notices before operator acceptance.

## No Runtime Authority From Docs

Architecture docs guide future implementation.

They do not change runtime behavior, queues, sends, Apps Script deployments, or Sheet data.

## Runtime Authority Verification Gate

Status: canonical governance rule for future AI/operator sessions.

Before any mutation to Sheets, Drive, Apps Script source, Apps Script deployments, Apps Script versions, email, WhatsApp, payment state, document status, Script Properties, or runtime data, the acting session must prove all of the following:

| Evidence | Required proof |
| --- | --- |
| Target object | Exact file, Sheet tab, Drive folder/file, deployment, version, email recipient, or runtime record to be changed. |
| Object ID | Spreadsheet ID, Drive file/folder ID, Apps Script script ID, deployment ID, message recipient, row/applicant ID, or property key. |
| Environment | `STAGING`, `PROD`, `Admin staging`, `Student staging`, `Production`, Playwright sandbox, or local repo path. |
| Authority source | The source used to prove authority, such as live `whoami`, `.clasp.json`, `Config.js`, `LIVE_URLS.md`, Sheet metadata, Drive metadata, Git remote, or operator-supplied evidence. |

If any required proof is missing, ambiguous, stale, or contradictory, the action is `READ ONLY`. Do not mutate.

Local source is not proof of live runtime. Live `whoami` remains runtime truth for deployed Apps Script behavior.

## Mutation Authority Gate

The mutation gate must be recorded before write operations.

Required checklist:

| Check | PASS condition |
| --- | --- |
| Spreadsheet ID verified | Target sheet ID and tab are explicitly proven before any row/header/write action. |
| Drive ID verified | Target folder/file ID and environment are explicitly proven before create, copy, move, delete, or permission action. |
| Apps Script project verified | `.clasp.json` script ID matches the approved target before `clasp push`, version, or deployment work. |
| Deployment ID verified | Admin, Student, or production deployment ID is explicitly proven before repin or browser acceptance. |
| Runtime version verified | Live `whoami` matches intended `Config.js` identity before release acceptance. |
| Environment verified | The action is tied to the approved CIS environment; production and Student are prohibited unless explicitly authorized. |
| Authority source verified | Evidence source is named and current; docs alone are not enough for live mutation. |
| Action explicitly authorized | The active CIS authorizes the exact mutation class. |

Examples:

- Sheet write: prove spreadsheet ID, tab, row/applicant ID, environment, and authority source. If unproven, read-only.
- Deployment repin: prove script ID, deployment ID, intended version, remote source identity, and live `whoami` plan. If unproven, read-only.
- Email send: prove recipient, applicant ID, template/message type, send authority, environment, and explicit approval. If unproven, no send.
- Runtime data update: prove object ID, mutation path, environment, responsible authority, and rollback/verification evidence. If unproven, read-only.

## Runtime Authority Register

Current documented authority baseline:

| Surface | Authoritative identity | Authority source | Mutation rule |
| --- | --- | --- | --- |
| Local Git repository | `D:\Repos\FODE_Runtime_1wog` | `AGENTS.md`, active workspace path | Mutate only files allowed by active CIS. |
| GitHub repository | `https://github.com/Sanjaymlckia/FODE_Runtime_1wog.git` | `.git/config` | Commit/push only when explicitly authorized. |
| Apps Script project | `1wogECIIksKIhrho6OeKXdt3f7nmrMjSSeFfXwlypa3o-Do3MECvKOI90` | `.clasp.json` | No push/version/repin without release CIS and remote-source gate. |
| Admin staging deployment | `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ` | `Config.js`, `LIVE_URLS.md` | Repin/browser accept only after live `whoami` proof. |
| Student staging deployment | `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv` | `Config.js`, `LIVE_URLS.md` | No Student action unless separately authorized. |
| Production deployment | Unknown / not proven | `audits/fode_runtime_dr_backup_audit_v01.md` | Read-only until exact deployment ID and environment are proven. |
| Runtime spreadsheet - staging | `1YFgLtUExz__fzQ4zTNoIyGTu-nrnasS7dIaShNPl7Cs`, tab `FODE_Data` | `Config.js` | No Sheet mutation unless CIS authorizes exact row/tab operation. |
| Runtime spreadsheet - production | `1fHmeGNmpOj9PEPQ5Fp4tUyCP4UdH70lltukraD4SalU`, tab `FODE_Data` | `Config.js`, Data Source Authority Register | Production mutation prohibited unless explicitly authorized. |
| Portal log spreadsheet | `1AQbkHUafLFxqHDqwH3dVHR8gTuOZYtyUPkheby5ejhU` | `Config.js`, Data Source Authority Register | Diagnostic/read-only unless exact write is authorized. |
| Portal secrets spreadsheet | `1HEJPtSov-iE5YTpSWWZ89YLIQAw4Eju9DDMG46HkTRc` | `Config.js`, Data Source Authority Register | Sensitive; no broad reads or writes without security CIS. |
| Runtime Drive root | `1vGD3DoOv1hlxYoTIfrNCZqAnrVKmghuB` | `Config.js` | No Drive create/copy/move/delete unless exact action is authorized. |
| Playwright sandbox | `F:\Playwright\fode-secure-link-diagnostic` | fixture docs and harness source | Read-only browser evidence only; no arbitrary applicants or fallback rows. |
| PowerShell tooling | `tools/*.ps1` under local repo | `tools/README.md` | Tool use must match CIS; no clasp push/version/repin unless authorized. |
| Documentation authority | `docs/architecture/Governance.md` plus active `AGENTS.md` | This document and repo root instructions | Docs define process; they do not prove live runtime state. |

