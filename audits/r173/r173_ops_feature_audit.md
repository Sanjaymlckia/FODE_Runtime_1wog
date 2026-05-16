# r173 Ops Feature Audit

## 1. Baseline Truth

| Field | Value |
|---|---|
| Git status | `## main...origin/main` |
| HEAD | `1125023` |
| Tag | `staging-as172` |
| Runtime version | `r172` |
| Deploy version number | `172` |
| Admin deployment | `AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ` |
| Student deployment | `AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv` |

## 2. Operator/Admin Layer

| Feature | Current UI | Current behavior | r173 mode |
|---|---|---|---|
| Search applicants | Admin search | read-only lookup | `map_only` |
| Open applicant review | Ops Admissions Queue | read-only handoff to legacy Admin review | `read_only` |
| Preview applicant email | Ops Communications | single-applicant preview only | `read_only` |
| Send applicant email | Ops Communications | real live single-send | `safe_test_only` |
| Open invoice | Ops Billing Queue | opens existing invoice URL | `read_only` |
| Refresh invoice status | Ops Billing Queue | read-only Books preview/status | `read_only` |
| Bounce scan | Admin search | operational scan/writeback path | `map_only` |
| Classroom handover preview | Ops Classroom | preview only | `read_only` |
| Classroom notify | Ops Classroom | real internal single-send email | `safe_test_only` |

## 3. Super Admin/Governance Layer

| Feature | Current UI | Current behavior | r173 mode |
|---|---|---|---|
| Parent email correction | Admin modal | writes corrected email | `disabled` |
| Portal lock/unlock | Admin modal | changes portal access state | `disabled` |
| Portal link reset | Admin modal | resets portal secret/link | `disabled` |
| Save document statuses | Admin modal | writes doc status/comments | `disabled` |
| Save overall status | Admin modal | writes override/overall review state | `disabled` |
| Payment verified | Admin workflow | writes payment verified state | `disabled` |
| Create draft invoice | Admin Books | real Books draft create | `disabled` |
| Send test invoice email | Admin Books | real Books test email send | `disabled` |
| Stage batch preview/send | Admin stage batch | preview + bulk send machinery | `disabled` |

## 4. Student Portal Diagnostics

| Feature | Current UI | Current behavior | r173 mode |
|---|---|---|---|
| Student portal surface | Student `?view=portal` | token-gated portal render | `map_only` |
| Portal field update path | Student `Save Updates` | writes allowlisted fields | `map_only` |
| Portal upload path | Student docs/payment proof | uploads/replaces files | `map_only` |
| Portal delete path | Student docs | deletes uploaded file | `disabled` |
| Portal link diagnostic | Admin helper only | resolves active portal link | `read_only` |
| Portal token/lock diagnostic | backend validation | token, expiry, lock-state checks | `read_only` |

## 5. WhatsApp / Contact Fallback

| Feature | Current UI | Current behavior | r173 mode |
|---|---|---|---|
| WhatsApp fallback CSV export | Admin fallback panel | exports fallback queue CSV | `map_only` |
| WhatsApp fallback CSV email | Admin fallback panel | emails fallback CSV to admins | `disabled` |
| Bounce/suppression status | Ops comms text | read-only status hints | `read_only` |

## 6. Lifecycle / Stage Cascade

| Stage | Current source surface | r173 treatment |
|---|---|---|
| Intake / triage | search + applicant lookup + queues | `map_only` + `read_only` queue surfaces |
| Document review | legacy Admin modal write paths | `disabled` in Ops |
| Invoice raised | Ops invoice open/status + Admin Books preview | `read_only` |
| Payment pending / evidence | student portal uploads + queue state | `map_only` |
| Payment verified | legacy Admin mutation path | `disabled` |
| Communication pipeline | Ops preview + live single-send paths | `safe_test_only` for sends |
| Classroom handover | preview + internal notify | preview `read_only`, notify `safe_test_only` |

## 7. Misleading Ops Labels

| Ops area | Current label | Actual behavior | Recommended label |
|---|---|---|---|
| Communications card | `Preview Only` | contains real live single-send actions | `Safe Test Only` |
| Classroom controls | `Disabled` | preview and notify are active; notify sends email | `Safe Test Only` |
| Executive Snapshot | `No cockpit writes` | Ops contains live single-send actions | `Safe Mode Controlled Actions` |
| Runtime / Release | `staging-as171 accepted` / `Pending r172` | accepted baseline is `r172` | `Accepted baseline: r172 / staging-as172` |
| Risks KPI | `Unknown` / `Action Required` | only partial risk implementation exists | `Risk Summary Not Yet Implemented` / `Review Required` |

## 8. r173 Must-Fix List

- Correct stale acceptance/runtime labels in Ops.
- Add Safe Mode banner with approved-target rule.
- Gate Ops single-send communication actions to the approved target only.
- Gate Ops classroom notify to the approved target only.
- Separate Operator/Admin lifecycle surfaces from Super Admin/Governance surfaces.
- Correct misleading action-mode labels.

## 9. r173 Safe-Test Candidates

- Applicant single-send reminder
- Applicant single-send missing-documents request
- Applicant single-send invoice reminder
- Applicant single-send portal access resend
- Classroom admin notify

## 10. r173 Disabled/Deferred Items

- Portal link reset
- Parent email correction
- Save document statuses
- Save overall status override
- Payment verified writes
- Books draft invoice creation
- Books test invoice email
- WhatsApp CSV email action
- Stage batch preview/send
- Bulk send flows

## 11. r174/r175 Product Polish Candidates

- Full lifecycle-first Ops restructure.
- Better read-only reports and drilldowns.
- Cleaner role-based operator vs governance views.
- Richer student portal diagnostics.
- Better release governance panel fed by real acceptance artifacts.
