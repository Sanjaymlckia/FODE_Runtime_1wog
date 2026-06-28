# F4C Row Facts / Authority Helper Refactor

## Executive Result

PASS_WITH_WARNINGS.

F4C completed a bounded row-facts / authority helper refactor in `Admin.js` only, with test updates. The refactor extracted repeated raw-row interpretation into small Admin-side helper functions while preserving existing behavior and DTO shapes.

## Files Changed

- `Admin.js`
- `tests/payment-authority-matrix.test.js`
- `tests/payment-authority-drift.test.js`
- `tests/payment-authority-nonqueue-consumers.test.js`
- `audits/f4c_row_facts_authority_helper_refactor_v01.md`

## Refactor Summary

Added Admin-side row-facts helpers:

- `adminRowPortalSubmitted_(rowObj)`
- `adminRowDocsReviewVerified_(rowObj)`
- `adminRowPaymentEvidencePresent_(rowObj)`
- `adminRowPaymentCompatibilityRawVerified_(rowObj)`
- `adminRowPaymentAuthorityFacts_(rowObj)`

Updated read-only consumers to use these helpers:

- `isQueueCandidateRow_`
- `deriveOperationalPipelineStage_`
- `buildOperationalDashboardMetrics_`
- `campaignReportValidApplication_`
- `buildActionabilityPreviewRow_`
- `admin_getReviewQueues`

Updated static authority tests to assert helper ownership rather than duplicated inline expressions.

## Behaviour Preserved

Preserved:

- `Receipt_Status` remains canonical payment authority.
- `Payment_Verified` remains compatibility/debug/display/projection only.
- `Docs_Verified` rollup behavior is unchanged.
- computed document verification still tolerates stale `Docs_Verified`.
- review queue classifications are unchanged.
- document status save behavior is unchanged.
- payment verification write behavior is unchanged.
- communication send gates and templates are unchanged.
- portal/security behavior is unchanged.
- OPS behavior is unchanged.

## Row-Facts Helper Inventory Before

Before F4C, several Admin read paths repeated the same raw-row interpretations:

- portal submitted: `nonEmpty_(Portal_Submitted) && Portal_Submitted !== "No"`
- document review verified: `Docs_Verified === "Yes" || computeDocVerificationStatus_() === "Verified"`
- payment evidence present: `hasUploadEvidence_(Fee_Receipt_File, "Fee_Receipt_File")`
- raw payment compatibility: `Payment_Verified === "Yes"`
- payment authority: `canonicalPaymentBadge_()` and `isCanonicalPaymentVerified_()`

These appeared independently in queue candidates, operational dashboard metrics, actionability preview, campaign validity, and queue classification.

## Row-Facts Helper Inventory After

After F4C:

- portal state is read through `adminRowPortalSubmitted_()`
- document review authority is read through `adminRowDocsReviewVerified_()`
- payment evidence is read through `adminRowPaymentEvidencePresent_()`
- raw payment compatibility is isolated in `adminRowPaymentCompatibilityRawVerified_()`
- payment authority facts are grouped by `adminRowPaymentAuthorityFacts_()`

The helpers remain intentionally small. F4C does not introduce a large DTO or general resolver object.

## Protected Surfaces Touched / Not Touched

Touched:

- Admin read-only row-facts helper seam
- static authority tests tied to the helper locations

Not touched:

- Zoho write/test/draft behavior
- `admin_setPaymentVerified` write behavior
- `admin_updateDocStatuses` write behavior
- document verification save semantics
- communication send/template behavior
- Stage Batch mappings
- portal token/access security
- preview/gallery/lightbox
- FormDesigner intake
- OPS send/classroom behavior
- Apps Script deployments or versions
- Sheets or Drive data

## Tests Run

Required validation:

- `node --check Code.js`
- `node --check Admin.js`
- `node --check Routes.js`
- `node --check Utils.js`
- `node tests/admin-ui-rpc-contract.test.js`
- `node tests/payment-authority-matrix.test.js`
- `node tests/payment-authority-drift.test.js`
- `node tests/payment-authority-nonqueue-consumers.test.js`
- `node tests/admin-role-boundary-matrix.test.js`
- `node tests/admin-review-queue-rollup-consistency.test.js`
- `node tests/admin-document-status-save-persistence.test.js`
- `node tests/communication-send-gate-matrix.test.js`
- `node tests/communication-semantic-registry.test.js`
- `node tests/fd-empty-document-payload-warning.test.js`
- `git diff --check`

## Execution Stability Notes

- The Windows sandbox runner intermittently failed with `CreateProcessAsUserW failed: 1312`.
- The task recovered by retrying simple commands once and using controlled escalation only for exact validation/git commands after repeated runner failure.
- Controlled elevated/local process execution categories used:
  - repo-local Node validation commands: required because normal runner failed repeatedly before Node could start
  - exact Git push/stage/commit commands if needed: allowed only after exact-file review and normal runner failure
- All controlled elevated/local commands stayed within `E:\Gdrive\01_SANJAY\Codex_Sync\FODE_Runtime_1wog`.
- No escalation was used for deployment, Apps Script push, Drive/Sheet mutation, or broad filesystem actions.

## Discovered Risks

- Static tests still verify some authority contracts by source patterns. This is acceptable for helper-location invariants, but future F4 slices should prefer executable fixture tests when the seam is behaviorally complex.
- Larger row-facts unification across `Code.js`, `AdminUI.html`, and `AdminUI_SharedRowFacts.html` remains possible but should not be combined with write/send/security surfaces.

## Rollback Path

Revert the F4C commit to return to the F4B/F4A accepted source baseline. No deployment rollback is required because this CIS performs no Apps Script push, version creation, or staging repin.

## F4D Recommendation

F4D may proceed after review if this GitHub diff is accepted.

Recommended F4D direction:

- continue with another bounded read-only seam
- likely candidate: lifecycle/actionability read-model helper consolidation with fixture-based tests
- avoid touching write/send/security/galleries/OPS in the same pass
