const assert = require("node:assert/strict");
const fs = require("node:fs");

function read(file) { return fs.readFileSync(file, "utf8"); }

const code = read("Code.js");
const gallery = read("Admin_DocumentGallery.js");
const workbench = read("EduOps_ClientWorkbench.html");
const core = read("EduOps_ClientCore.html");
const commands = read("EduOps_Commands.js");
const receipts = read("EduOps_Receipts.js");
const selected = read("Admin_SelectedApplicantCommunications.js");

assert.match(gallery, /var diagnostics = \[\];[\s\S]*var grouped = \{\};/, "manifest must retain malformed entries as diagnostics and group actionable files");
assert.match(gallery, /candidate\.mappingMethod === "row_file_id"/, "actionable manifest entries must be applicant-row bound");
assert.match(gallery, /diagnosticReason:[\s\S]*INVALID_OR_UNRECOGNISED_SOURCE_FIELD[\s\S]*MISSING_REUSABLE_FILE_IDENTITY[\s\S]*FILE_NOT_BOUND_TO_APPLICANT_ROW/, "malformed document entries must be excluded with exact diagnostic reasons");
assert.match(gallery, /rowApplicantId \+ "\|" \+ candidate\.sourceField/, "document review unit must be applicantId plus sourceField");
assert.match(gallery, /evidenceFiles:[\s\S]*evidenceCount:[\s\S]*canonicalReviewUnit/, "multiple files under one requirement must stay inside one review card");
assert.match(gallery, /applicantId:\s*applicantId[\s\S]*fileId:[\s\S]*fileName:[\s\S]*openUrl:[\s\S]*downloadUrl:[\s\S]*downloadUnavailableReason/, "file action RPC must return applicant/source/file/open/download fields");

assert.match(workbench, /function documentDraftKey\(file\)[\s\S]*sourceField/, "client document drafts must be keyed by canonical sourceField");
assert.match(workbench, /function documentDecisionDrafts\(\)[\s\S]*seen\[field\][\s\S]*docs\.push\(\{ file: field/, "overall document preview must dedupe by sourceField and forbid blank file identifiers");
assert.match(workbench, /Review each document requirement once/, "operator guidance must state one review per requirement");
assert.match(workbench, /Browser preview - derived viewing copy[\s\S]*Original document - authoritative evidence/, "preview/original roles must be explicit");
assert.match(workbench, /data-open-original[\s\S]*data-download-original/, "Workbench must expose Open Original and Download Original controls");
assert.match(commands, /function eduopsNormalizeDocumentReviewDocs_[\s\S]*DOCUMENT_SOURCE_FIELD_REQUIRED[\s\S]*DUPLICATE_DOCUMENT_SOURCE_FIELD/, "server command gate must reject blank and duplicate document fields");
assert.match(commands, /admin_updateDocStatuses\(\{ applicantId: preview\.applicantId, rowNumber: rowNumber, docs: docs \}\)/, "final document mutation must use the normalized bounded docs list");

assert.match(code, /return \[\s*intro,\s*"{{portal_url}}"/, "portal blocks must use governed merge token instead of manual ACTION REQUIRED text");
assert.match(code, /PORTAL_LINK_UNAVAILABLE/, "missing or inactive portal authority must use required block code");
assert.match(code, /function communicationValidateRenderedContent_[\s\S]*COMMUNICATION_TEMPLATE_UNRESOLVED_TOKEN/, "preview/send must share unresolved-token validation");
assert.match(code, /function communicationApplyMandatoryPolicyBlocks_[\s\S]*communicationUnderReviewNoPaymentNotice_[\s\S]*communicationDocumentVerificationCaution_/, "mandatory notices must be server-controlled policy blocks");
assert.match(code, /Your application is currently under review\. No payment is required at this stage\./, "under-review no-payment notice must use approved wording");
assert.match(code, /Your application cannot be processed further until we receive clear, complete and verifiable copies/, "document-verification caution must use approved wording");
assert.match(workbench, /CC - visible to recipient[\s\S]*BCC - approved internal only/, "CC/BCC must be individual-only visible fields");
assert.match(selected, /cc: clean_\(p\.cc \|\| ""\)[\s\S]*bcc: clean_\(p\.bcc \|\| ""\)/, "admin individual preview/send facade must pass CC/BCC");
assert.match(code, /function communicationValidateCcBcc_[\s\S]*BCC_NOT_INTERNAL/, "BCC must be restricted to approved internal addresses or domains");
assert.match(code, /gmailOptions\.cc[\s\S]*gmailOptions\.bcc/, "final individual send must use preview-approved CC/BCC values");

assert.match(code, /COMM_TEMPLATE_INDEX_V1[\s\S]*COMM_TEMPLATE::/, "saved template variants must use the bounded Script Properties namespace");
assert.match(code, /admin_saveReusableCommunicationTemplate[\s\S]*SUPER[\s\S]*COMM_TEMPLATE_VARIANT_OVERWRITE_BLOCKED/, "only Super Admin may save variants and active versions must not be overwritten");
assert.match(code, /batchSafe: communicationSendAuthorityForDefinition_\(validated\.definition\)\.batchSafe === true/, "variant batch safety must inherit from parent authority");
assert.match(code, /COMM_TEMPLATE_VARIANT_INDEX_MISMATCH/, "variant index and stored version disagreement must fail closed");
assert.match(core, /admin_saveReusableCommunicationTemplate:\s*true/, "saved template RPC must be explicitly write-allowlisted");
assert.match(workbench, /data-save-reusable-template[\s\S]*admin_saveReusableCommunicationTemplate/, "Workbench must expose Save as reusable template for editable individual messages");

assert.match(receipts, /templateVersionId[\s\S]*templateSource[\s\S]*contentEdited[\s\S]*subjectFingerprint[\s\S]*bodyFingerprint[\s\S]*cc[\s\S]*bcc[\s\S]*portalLinkRequired[\s\S]*portalLinkHydrated/, "R376D receipts must include R376E template/content metadata");
assert.match(commands, /cc: draft\.cc[\s\S]*bcc: draft\.bcc/, "EduOps preview/execute path must preserve preview-approved CC/BCC");

console.log("PASS R376E document grouping, original actions, portal hydration, unresolved-token, CC/BCC, variants, and receipt contracts");
