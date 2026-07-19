const assert = require("node:assert/strict");
const fs = require("node:fs");

function read(file) {
  return fs.readFileSync(file, "utf8");
}

const sources = {
  html: read("EduOps.html"),
  flags: read("EduOps_FeatureFlags.js"),
  commands: read("EduOps_Commands.js"),
  workload: read("EduOps_Workload.js"),
  core: read("EduOps_ClientCore.html"),
  components: read("EduOps_ClientComponents.html"),
  workbench: read("EduOps_ClientWorkbench.html"),
  batch: read("EduOps_ClientBatch.html")
};
const client = [sources.html, sources.core, sources.components, sources.workbench, sources.batch].join("\n");
const eduopsRuntime = [sources.commands, sources.workload, sources.core, sources.components, sources.workbench, sources.batch].join("\n");

for (const operation of ["DOCUMENT_REVIEW", "FINANCE_EVIDENCE_DECISION", "SEND_INDIVIDUAL_COMMUNICATION", "CONTACTABILITY_CORRECTION", "BATCH_COMMUNICATION"]) {
  assert.match(sources.flags, new RegExp(`${operation}: true`), `${operation} must be default-available when no opt-in property exists`);
}
assert.match(sources.flags, /function eduopsOperationAvailability_[\s\S]*available:[\s\S]*authoritySource/, "backend must project explicit operation availability");
assert.match(sources.workload, /operationAvailability:\s*eduopsOperationAvailability_\(\)/, "backend profile must expose explicit operation availability");
assert.match(sources.workbench, /return app\.operationAvailable\(operation\)/, "Workbench must consume backend-projected operation availability");
assert.doesNotMatch(sources.workbench, /\^\(DOCUMENT_REVIEW|FINANCE_EVIDENCE_DECISION\|SEND_INDIVIDUAL_COMMUNICATION/, "Workbench must not default released operations locally");
assert.match(sources.flags, /PORTAL_ACCESS: false[\s\S]*BOOKS_ACTION: false/, "Portal and Books must remain unavailable");
assert.match(sources.flags, /SUSPENDED_BY_ADMIN/, "Released operation suspension must be represented as an emergency suspension, not a release opt-in");
assert.match(sources.flags, /getAdminRole_\(actorEmail\) !== "SUPER"[\s\S]*REASON_REQUIRED[\s\S]*EDUOPS_FEATURE_FLAGS_SET/, "Emergency flag/suspension changes must remain SUPER-only, reasoned and audited");

assert.doesNotMatch(sources.commands, /EDUOPS_LARGE_COMMUNICATION_BATCH_THRESHOLD/, "Batch communication must not require an unapproved second approval threshold");
assert.match(sources.commands, /PORTAL_ACCESS:[\s\S]*dualApproval: true/, "Portal access retains its separately approved dual-approval boundary");
assert.match(sources.commands, /eduopsCommandRequiresDualApproval_[\s\S]*definition\.dualApproval === true[\s\S]*return false/, "Dual approval must be explicit per command definition only");

assert.match(sources.batch, /data-batch-template/, "Batch modal must expose canonical template selection");
assert.doesNotMatch(sources.batch, /first\.recommendedMessageType/, "Batch message type must not inherit from the first selected row");
assert.match(sources.batch, /draft:\s*\{\s*messageType:\s*batch\.messageType\s*\}/, "Batch preview must send the operator-selected canonical message type");
assert.match(sources.workload, /communicationTemplateGalleryMetadata_[\s\S]*isCommunicationTypeBatchSafe_/, "Batch template options must come from canonical Communication Authority metadata");

assert.match(sources.html, /eduopsSelectAllMatching/, "Workload must provide Select all matching query");
assert.match(sources.components, /ALL_ELIGIBLE_MATCHING_QUERY[\s\S]*selectionQuery[\s\S]*selectionContext/, "Query-wide operator intent remains bound to the local display context");
assert.match(sources.core, /selectionExcluded[\s\S]*excludeFromSelection[\s\S]*restoreSelectionExclusion/, "Selection exclusions and restore must be tracked explicitly");
assert.match(sources.commands, /ALL_ELIGIBLE_MATCHING_QUERY[\s\S]*eduopsFilterRows_[\s\S]*executionApplicantIds/, "Server must resolve query-wide master cohorts and bounded execution cohorts");
assert.match(sources.commands, /selectedApplicantBatchLimit_[\s\S]*eduopsNormalizeExecutionLimit_/, "Execution cohort must be capped by the authoritative selected-applicant batch limit");
assert.match(sources.commands, /STALE_SELECTION_BINDING[\s\S]*QUERY_BINDING_MISMATCH/, "Batch selection must fail closed on stale snapshot or changed query");

assert.match(sources.workload, /hiddenReasonRows[\s\S]*eduopsHiddenReasonPage_/, "Hidden reasons must be available beyond the compatibility first-page list");
assert.match(sources.components, /Count arithmetic[\s\S]*Authoritative workload composition/, "Workload composition must explain count arithmetic to operators");
assert.match(sources.workload, /matchingOnLaterPages[\s\S]*totalAuthoritySelectable[\s\S]*totalAuthorityBlocked/, "Composition DTO must distinguish later-page matches and authority-blocked rows");

assert.match(sources.html, /FODE Operations Workspace/, "Released surface title must use FODE Operations branding");
assert.doesNotMatch(client, /Pass 2|guarded operations|Mock authoritative|Local simulation|Preview-only|View authority controls|Authority-controlled workspace/i, "Released operator surface must not show transitional staging wording");
assert.doesNotMatch(client, /eduops-prototype/i, "Released operator surface must not retain prototype UI hooks");
assert.doesNotMatch(sources.html, /value="KIA"|value="MLC"/, "KIA and MLC must not appear in the released FODE product switcher");
assert.match(sources.components, /eduopsRuntimeIdentity[\s\S]*eduopsAppsScriptIdentity[\s\S]*eduopsReleaseDetails/, "Runtime identity and technical details must remain visible");

assert.doesNotMatch(eduopsRuntime, /GmailApp|MailApp|sendEmail\s*\(/, "EduOps client/workload/command code must not introduce direct email send bypasses");
assert.match(sources.commands, /admin_previewSelectedApplicantBatch[\s\S]*admin_sendSelectedApplicantBatch/, "Batch communication must stay routed through Communication Authority preview and send");
assert.match(sources.commands, /admin_sendApplicantMessage/, "Individual communication must stay routed through Communication Authority send");

assert.match(sources.batch, /title:\s*batch\.preview\.summary[\s\S]*proceedLabel:\s*batch\.preview\.summary/, "Batch confirmation must repeat the exact canonical template and recipient count");
assert.doesNotMatch(sources.batch, /Confirm batch communication|Send confirmed batch/, "Generic batch wording must not obscure exact execution scope");
assert.match(sources.workbench, /preview\.executable === true[\s\S]*app\.openConfirm\([\s\S]*confirmation: true/, "Individual and applicant mutations must require an executable backend preview and one explicit confirmation");

console.log("PASS EduOps batch governance and full-release surface repair contracts");
