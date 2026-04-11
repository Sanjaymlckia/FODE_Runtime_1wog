# FODE CRM Boundary Model - r108

Trusted baseline: downstream runtime r108 / 108.

## Purpose

This note defines the current CRM boundary for FODE across both repos.
It is binding documentation only.
It does not change runtime behavior.

System intent:
- Portal/admin plus downstream sheet and Drive workflow are the operational authority layer.
- CRM is a downstream/commercial integration surface.
- CRM must not be required for portal continuity, document workflow, lifecycle derivation, queueing, or communication eligibility.

## Repo Inventory

### Upstream repo
Path: C:\ClaspFODE
Role today:
- intake preprocessing
- normalization/enrichment
- forwarding to downstream
- early side effects: Drive folder creation and CRM upsert

#### Source-proven CRM touchpoints
1. Intake-time CRM write path
- File: C:\ClaspFODE\Code.js
- Lines: around 206-245
- Behavior:
  - creates applicant folder
  - refreshes Zoho token
  - upserts Zoho contact
  - upserts Zoho deal
  - stores CRM_Response, Contact_ID, Deal_ID, Folder_Url into forwarded downstream payload
- Classification: premature, duplicated, semantically risky
- Reason:
  - occurs before downstream runtime has become authoritative for the applicant lifecycle
  - mixes adapter responsibilities with operational/commercial side effects

2. Zoho token refresh helper
- File: C:\ClaspFODE\Code.js
- Function: getZohoToken_()
- Lines: around 1179-1193
- Classification: supporting CRM infrastructure

3. Zoho contact upsert helper
- File: C:\ClaspFODE\Code.js
- Function: upsertZohoContact_()
- Lines: around 1195-1224
- Classification: live CRM write

4. Zoho deal upsert helper
- File: C:\ClaspFODE\Code.js
- Function: upsertZohoDeal_()
- Lines: around 1226-1268
- Classification: live CRM write

#### Upstream CRM role assessment
Allowed by current source:
- adapter can collect/forward CRM identifiers and responses
- adapter can currently trigger CRM side effects

What upstream should own under the authority model:
- payload normalization
- forwarding
- correlation IDs
- non-authoritative observability

What upstream should not be treated as owning:
- applicant lifecycle truth
- portal continuity truth
- document verification truth
- final commercial milestone truth
- authoritative CRM sync timing

### Downstream repo
Path: C:\FODE_Runtime_1wog
Role today:
- operational authority
- portal runtime
- admin lifecycle control
- queueing and review
- document workflow
- payment verification workflow
- later CRM synchronization

#### Source-proven CRM touchpoints
1. Payment-verified CRM sync path
- File: C:\FODE_Runtime_1wog\Admin.js
- Function: crm_syncOnPaymentVerified_()
- Lines: around 1005-1057
- Behavior:
  - ensures stable FormID
  - builds CRM payload from row
  - refreshes Zoho token
  - upserts contact
  - upserts deal
  - writes Contact_ID, Deal_ID, CRM_Response back to row
  - logs success/error
- Classification: correctly placed relative to current business intent, but still mirror-only
- Reason:
  - occurs after operational milestone: payment verified
  - uses downstream row/Drive context as source of truth

2. CRM payload builder
- File: C:\FODE_Runtime_1wog\Code.js
- Function: buildCrmPayloadFromRow_()
- Lines: around 4147-4174
- Behavior:
  - builds CRM payload from downstream row truth, including folder URL and payment-verified stage config
- Classification: correct supporting helper for downstream-owned CRM sync

3. Stable FormID enforcement
- File: C:\FODE_Runtime_1wog\Code.js
- Function: ensureStableFormId_()
- Lines: around 4176-4188
- Classification: supporting helper for downstream-owned CRM sync

4. Payment verified workflow dry-run CRM event
- File: C:\FODE_Runtime_1wog\Utils.js
- Function: handlePaymentVerifiedTrigger_()
- Lines: around 1396-1404
- Behavior:
  - logs CRM_PUSH_DRY_RUN payload when dry-run config is enabled
- Classification: advisory/logging only, not authoritative sync

5. CRM config surface
- File: C:\FODE_Runtime_1wog\Config.js
- Keys:
  - ZOHO_API_BASE
  - ZOHO_OAUTH_BASE
  - CRM_PIPELINE_FODE
  - CRM_STAGE_PAYMENT_VERIFIED
  - CRM_PUSH_DRY_RUN
- Classification: supporting configuration only

## Classification Summary

### Correctly timed / acceptable under current model
1. Downstream payment-verified CRM sync
- Repo: downstream
- Path: crm_syncOnPaymentVerified_()
- Why acceptable:
  - sync is triggered from downstream operational truth
  - timing is tied to a meaningful business milestone
  - CRM is updated after portal/admin workflow has already established state

### Premature
1. Upstream intake-time Zoho contact upsert
2. Upstream intake-time Zoho deal upsert
- Why premature:
  - they occur before downstream lifecycle authority has been established
  - they can create commercial records before operational review/verification has occurred

### Duplicated
1. Contact upsert exists in both repos
2. Deal upsert exists in both repos
3. CRM identifiers and response are written in both phases of the system lifecycle
- Risk:
  - duplicate side effects
  - ambiguous ownership of CRM timing
  - harder reconciliation when CRM state and downstream state diverge

### Semantically unclear
1. Upstream forwards CRM output into downstream payload
- It is unclear whether those values are advisory, required, or authoritative.

2. Downstream writes CRM ids/response back to row
- This is acceptable as mirror metadata, but only if documented as non-authoritative.

3. Current system has two CRM moments
- intake-time sync in upstream
- payment-verified sync in downstream
- Without explicit boundary rules, this reads as CRM being both early intake sink and later milestone sink.

## Operational Truth vs CRM Mirror Model

### Operational truth
Authoritative source:
- downstream repo runtime logic
- downstream applicant sheet row
- downstream portal access/secret state
- downstream Drive-linked document workflow
- downstream lifecycle stage derivation
- downstream review queues
- downstream communication eligibility/history model

CRM is not authoritative for:
- applicant lifecycle state
- operator queue state
- portal access/state
- communication eligibility or cooldown truth
- document verification truth
- payment verification truth
- final release/access workflow

### CRM mirror/sync role
CRM may hold:
- mirrored applicant commercial/contact record
- mirrored deal/opportunity state
- mirrored late-stage commercial milestones
- mirrored external reporting references

CRM must be treated as:
- advisory/mirror downstream system
- not a prerequisite for portal/admin continuity
- not the operational brain

## Explicit Boundary Rule

1. Upstream boundary
Upstream is allowed to:
- normalize and enrich intake payloads
- attach correlation metadata
- forward payload to downstream
- surface advisory CRM metadata if current operations still require it

Upstream should not own:
- authoritative CRM timing
- applicant lifecycle decisions
- operational milestone-to-CRM transition rules
- document/workflow completion semantics

2. Downstream boundary
Downstream is authoritative for:
- applicant lifecycle state
- queue/actionability state
- communication truth
- document and payment workflow state
- deciding when a business milestone is ready to be mirrored to CRM

3. CRM rule
CRM is authoritative nowhere in the live admissions workflow.
It is a mirror/commercial integration target only.

## Boundary Conflicts Present Today

1. Upstream performs live CRM writes before downstream acceptance
- Source: C:\ClaspFODE\Code.js
- Risk:
  - premature commercial record creation
  - duplicate sync later downstream

2. CRM ids/response propagate across both repos
- Source: upstream forward path and downstream row patch path
- Risk:
  - unclear ownership of CRM metadata lifecycle

3. Two different CRM timing models coexist
- intake-time sync
- payment-verified sync
- Risk:
  - business ambiguity about what CRM state is supposed to mean at each point

## Recommended Next Tiny Hardening Candidate

Not implemented in this pass.

Preferred next small CIS:
- documentation plus one tiny downstream helper-boundary hardening only
- objective:
  - make downstream CRM sync trigger rule explicit in code comments/helper naming
  - make upstream CRM output explicitly advisory in documentation
- avoid disabling upstream CRM writes until stakeholder confirms no operational dependency remains

Reason not to change runtime yet:
- upstream intake CRM writes may still be relied upon externally
- removing them without an explicit migration decision would be risky

## Inventory Completeness Statement

This inventory covers all source-proven CRM touchpoints found by repo-wide search in:
- C:\ClaspFODE\Code.js
- C:\FODE_Runtime_1wog\Code.js
- C:\FODE_Runtime_1wog\Admin.js
- C:\FODE_Runtime_1wog\Utils.js
- C:\FODE_Runtime_1wog\Config.js

No other live CRM write path was found in the inspected source.

## Boundary Definition Statement

The CRM boundary is now explicit at the documentation level:
- operational truth = downstream portal/admin/sheet/Drive workflow
- CRM = mirror/commercial integration target only
- upstream CRM writes are currently present but classified as premature and duplicated relative to the intended architecture
- downstream payment-verified sync is the closest current implementation to the intended boundary
