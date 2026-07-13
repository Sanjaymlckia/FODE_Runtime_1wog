# Apps Script Deployable Contract

Status: exact 27-file contract at runtime identity `r342 / 342`.

`.claspignore` is the local inclusion authority. `clasp status --json` projects the local set, and `tools/verify-remote-config-before-version.ps1` compares the exact normalized set and SHA-256 set hash with Apps Script `projects.getContent`. Tests, docs, `.release-proof`, private backup artifacts, and retired standalone OPS source are excluded.

| File | Type | Purpose / authority domain | Introduced | Required |
| --- | --- | --- | --- | --- |
| `Admin.js` | server JS | Admin orchestration and Actionability | `ca86c0e` | yes |
| `Admin_AccessControl.js` | server JS | role/capability access | `97266be` | yes |
| `Admin_CapabilityGrants.js` | server JS | temporary capability grants | `36b2986` | yes |
| `Admin_CanonicalFinance.js` | server JS | canonical Finance read model | `1308557` | yes |
| `Admin_CanonicalPopulation.js` | server JS | canonical population/cohorts | `84c7f87` | yes |
| `Admin_DocumentGallery.js` | server JS | document gallery | `7770587` | yes |
| `Admin_DocumentServices.js` | server JS | document services | `f134c28` | yes |
| `Admin_LifecycleAuthority.js` | server JS | canonical lifecycle | `809e9a2` | yes |
| `Admin_PaymentAuthority.js` | server JS | payment mutation boundary | `3567d61` | yes |
| `Admin_ReviewQueues.js` | server JS | compatibility navigation | `97266be` | yes |
| `Admin_ReviewStatusAuthority.js` | server JS | review status authority | `a3e12ae` | yes |
| `Admin_RowFacts.js` | server JS | shared authoritative row facts | `6154fae` | yes |
| `Admin_SelectedApplicantCommunications.js` | server JS | selected communication wrapper | `1cb6ec3` | yes |
| `Admin_StageBatchCommunications.js` | server JS | Stage Batch compatibility | `29031a1` | yes |
| `Admin_WhatsAppFallback.js` | server JS | manual contact fallback | `1fe9c85` | yes |
| `AdminUI.html` | HTML | mature Admin/Review surface | `ca86c0e` | yes |
| `AdminUI_OperatorNext.html` | HTML | Operator Next work surface | `9f4ea27` | yes |
| `AdminUI_OpsApplicantQueue.html` | HTML | retained Admin queue include | `a738611` | yes |
| `AdminUI_OpsCommunications.html` | HTML | retained communication include | `c6e19cc` | yes |
| `AdminUI_OpsLifecycle.html` | HTML | retained lifecycle include | `865fbd5` | yes |
| `AdminUI_SharedRowFacts.html` | HTML | shared Review display facts | `bfd3fe7` | yes |
| `Code.js` | server JS | core runtime and Communication Authority | `ca86c0e` | yes |
| `Config.js` | server JS | runtime configuration/identity | `ca86c0e` | yes |
| `Routes.js` | server JS | web routes | `ca86c0e` | yes |
| `Utils.js` | server JS | shared runtime utilities | `ca86c0e` | yes |
| `appsscript.json` | manifest | Apps Script scopes/runtime | `ca86c0e` | yes |
| `whoami_admin.html` | HTML | runtime identity proof | `ca86c0e` | yes |

## Count Progression

| Milestone | Count | Addition |
| --- | ---: | --- |
| pre-Operator Next runtime | 23 | established deployable baseline |
| Operator Next | 24 | `AdminUI_OperatorNext.html` |
| H1 capability grants | 25 | `Admin_CapabilityGrants.js` |
| M1 canonical population | 26 | `Admin_CanonicalPopulation.js` |
| M2 canonical Finance | 27 | `Admin_CanonicalFinance.js` |

The earlier count near 22 predates one or more extracted Admin includes and is historical only; it is not used as a current contract. The exact current set, not the count, is authoritative.
