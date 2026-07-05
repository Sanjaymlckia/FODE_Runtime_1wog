const fs = require("node:fs");
const assert = require("node:assert/strict");

const adminUi = fs.readFileSync("AdminUI.html", "utf8");
const adminJs = fs.readFileSync("Admin.js", "utf8");

function indexOfRequired(needle) {
  const index = adminUi.indexOf(needle);
  assert.notEqual(index, -1, `Missing expected AdminUI surface marker: ${needle}`);
  return index;
}

const dashboardIndex = indexOfRequired('id="actionabilityPreviewPanel"');
const reviewQueuesIndex = indexOfRequired('id="reviewQueuesPanel"');
assert.ok(dashboardIndex < reviewQueuesIndex, "Operations Workspace must render before Review Queues");
assert.ok(adminUi.includes("Operations Workspace"), "Promoted operator surface must use the Operations Workspace label");
assert.doesNotMatch(adminUi, /Actionability Dashboard/i, "Old Actionability Dashboard heading must not remain visible in AdminUI");
assert.ok(adminUi.includes("Primary workload surface. Review Workspace remains the editing authority."), "Operations Workspace must use concise primary-surface language");
assert.doesNotMatch(adminUi, /Review Queues remains the primary action surface/i, "Review Queues must not claim primary action-surface authority");
assert.doesNotMatch(adminUi, /Secondary Navigation: Review Queues/i, "Review Queues heading must not visually compete as secondary navigation");
assert.ok(adminUi.includes("Compatibility: Review Queues"), "Review Queues must remain available as a compatibility surface");
assert.ok(adminUi.includes("Review Queues remain available for compatibility and existing review workflows"), "Review Queues compatibility wording must be explicit");
assert.match(adminUi, /<details id="reviewQueuesPanel"[^>]*>/, "Review Queues must be a collapsed details surface");
assert.doesNotMatch(adminUi, /<details id="reviewQueuesPanel"[^>]*\sopen\b/, "Review Queues must be collapsed by default");
assert.ok(adminUi.includes("Advanced Diagnostics / Legacy Panels"), "Legacy/supporting panels must be grouped under Advanced Diagnostics");
assert.match(adminUi, /<details id="advancedDiagnosticsPanel"[^>]*>/, "Advanced Diagnostics must be a collapsed details surface");
assert.doesNotMatch(adminUi, /<details id="advancedDiagnosticsPanel"[^>]*\sopen\b/, "Advanced Diagnostics must be collapsed by default");
assert.match(adminUi, /--surfacePrimary:[\s\S]*--surfaceSecondary:[\s\S]*--surfaceDiagnostic:/, "Admin UI must define a unified panel surface token system");
assert.match(adminUi, /id="actionabilityPreviewPanel" class="[^"]*primaryWorkspace/, "Operations Workspace must use the Primary Workspace visual tier");
assert.match(adminUi, /id="reviewQueuesPanel" class="[^"]*secondaryOperationalPanel/, "Review Queues must use the Secondary Operational Panel tier");
assert.match(adminUi, /id="advancedDiagnosticsPanel" class="[^"]*diagnosticLegacyPanel/, "Advanced Diagnostics must use the Diagnostic / Legacy Panel tier");
assert.match(adminUi, /id="legacySearchPanel" class="[^"]*secondaryOperationalPanel/, "Search must use the Secondary Operational Panel tier");
assert.match(adminUi, /id="systemHealthPanel" class="[^"]*diagnosticLegacyPanel/, "System Health must use the Diagnostic / Legacy Panel tier");
assert.match(adminUi, /id="legacyResultsPanel" class="[^"]*secondaryOperationalPanel/, "Search results must use the Secondary Operational Panel tier");
assert.match(adminUi, /\.queue-table\{ background:#fff; color:#102030; \}/, "Secondary queue tables must use readable dark text on white");
assert.match(adminUi, /\.queue-table th\{ color:#173451; background:#eef3f8; border-bottom:1px solid #cbd8e6; font-weight:900; \}/, "Secondary queue headers must have readable contrast");
assert.match(adminUi, /\.secondaryOperationalPanel \.btn:disabled,[\s\S]*color:#52677d;[\s\S]*opacity:1;/, "Secondary disabled buttons must stay readable without opacity fade");
assert.match(adminUi, /\.statusTag\.ready\{[\s\S]*background:#e7f4ec;[\s\S]*color:#145c34;/, "Secondary ready chips must use dark text and solid readable green");
assert.match(adminUi, /\.badge-warning\{[\s\S]*background:#fff2dc;[\s\S]*color:#805006;/, "Secondary warning chips must use dark text and solid readable amber");
assert.ok(adminUi.includes("Global View: Current workload"), "Operations Workspace must expose the Global View shell");
assert.doesNotMatch(adminUi, /Operator View: Coming soon/, "Operations Workspace must not expose a fake Operator View control");
assert.ok(adminUi.includes("Operator-scoped view pending ownership model."), "Operator-scoped view must be described as pending ownership authority");
assert.match(adminUi, /data-actionability-view="global"/, "View shell must preserve actionability-scoped internal naming");
assert.doesNotMatch(adminUi, /data-actionability-view="operator"/, "Operator View must not be rendered until backend scoping exists");
assert.ok(adminUi.includes("What requires work today."), "Operations Workspace role must be clear");
assert.ok(adminUi.includes("Where applicants are."), "Lifecycle Map role must be clear");
assert.ok(adminUi.includes("Authoritative editing modal."), "Review Workspace role must be clear");
assert.ok(adminUi.includes("Troubleshooting and automation state."), "System Health role must be clear");

const kpiIndex = indexOfRequired('id="actionabilityKpiStrip"');
const summaryIndex = indexOfRequired('id="actionabilityPreviewSummary"');
assert.ok(kpiIndex > dashboardIndex, "Ledger bar must live inside the promoted dashboard");
assert.ok(kpiIndex < summaryIndex, "Ledger bar must render above operational bucket table");
assert.match(adminUi, /function renderActionabilityLedgerBar_/, "Operations Workspace must render a ledger trust bar");
assert.match(adminUi, /actionabilityLedgerItem/, "Ledger trust bar must use aligned ledger items, not decorative cards");
assert.match(adminUi, /Scanned rows/, "Ledger bar must expose scanned rows");
assert.match(adminUi, /Applicant ID rows/, "Ledger bar must expose ApplicantID rows");
assert.match(adminUi, /Unknown \/ Unclassified/, "Ledger bar must expose unknown/unclassified rows");
assert.match(adminUi, /Duplicate Applicant IDs/, "Ledger bar must expose duplicate ApplicantID risk");
assert.match(adminUi, /Integrity/, "Ledger bar must expose integrity status");
assert.match(adminUi, /Generated/, "Ledger bar must expose generated timestamp");
assert.match(adminUi, /class="actionabilityBucketTable"/, "Operational buckets must render as a table rhythm");
assert.match(adminUi, /Population<\/div>[\s\S]+Visible<\/div>/, "Operational buckets must separate population counts from visible rows");
assert.match(adminUi, /Primary Action/, "Operational buckets must preserve primary action scanning");
assert.match(adminUi, /Integrity \/ Notes/, "Operational buckets must expose integrity notes");
assert.doesNotMatch(adminUi, /<button class="actionabilityKpi/, "Operations Workspace must not render card-style KPI buttons");
assert.doesNotMatch(adminUi, /class="actionabilityGroupCard/, "Operations Workspace must not render irregular group cards");

[
  "Applicant Action",
  "Admissions Review",
  "Finance",
  "Academic Admin",
  "Exceptions",
  "Dormant",
  "Completed / No Action",
  "Unknown / Unclassified"
].forEach((label) => {
  assert.ok(adminUi.includes(label), `Operational bucket must be present: ${label}`);
});
assert.match(adminUi, /actionabilityBucketViewBtn/, "Operational bucket view buttons must use secondary button hierarchy");
assert.match(adminUi, /onclick="selectActionabilityGroup_/, "Operational bucket rows must select an actionability group");
assert.match(adminUi, /var displayRows = actionabilityActiveGroup \? \(groupRows\[actionabilityActiveGroup\] \|\| \[\]\) : rows;/, "KPI/group filters must still drive displayed worklist rows");
assert.match(adminUi, /actionabilityPopulationLedgerState\s*=\s*ledger/, "Operations Workspace must retain Population Ledger summary from the backend");
assert.match(adminUi, /function actionabilityPopulationCountForGroup_/, "Operations Workspace KPI totals must have a ledger-backed count resolver");
assert.match(adminUi, /operationalBucketCounts/, "Operations Workspace must consume ledger operational bucket counts");
assert.match(adminUi, /actionabilityPopulationCountForGroup_\(key,\s*list\.length\)/, "Operational bucket table must render full population bucket counts with visible-row fallback only");
assert.match(adminUi, /visible worklist rows \/ " \+ String\(populationTotal\) \+ " total applicant population/, "Operations Workspace meta must separate visible worklist rows from population totals");
assert.doesNotMatch(renderActionabilityRowBody_(), /Newest:/, "Operational bucket table must not spend benchmark scan space on newest metadata");
assert.match(adminUi, /stagePopulationLedgerState/, "Lifecycle Map must retain Population Ledger summary from the backend");
assert.match(adminUi, /Population Ledger: " \+ String\(Number\(ledger\.applicantIdRows/, "Lifecycle Map metadata must report ledger applicant population");
assert.doesNotMatch(adminUi, /review queue visible/i, "Lifecycle Map must not label lifecycle/actionability counts as Review Queue visibility");
assert.match(adminUi, /var ledger = data\.populationLedger/, "Global Dashboard renderer must consume Population Ledger summary");
assert.match(adminUi, /ApplicantID \/ " \+ Number\(data\.scannedRows/, "Global Dashboard scan metric must separate ApplicantID rows from scanned rows");

["APPLICANT", "ADMISSIONS", "FINANCE", "ACADEMIC", "MANAGEMENT", "DORMANT", "COMPLETE", "UNKNOWN"].forEach((key) => {
  assert.ok(adminUi.includes(`data-actionability-kpi="' + esc(key) + '"`) || adminUi.includes(`data-actionability-kpi="${key}"`), `KPI bucket key must be rendered: ${key}`);
});

assert.doesNotMatch(adminUi, /Read-Only Experimental|Experimental Actionability|Actionability Preview/i, "Promoted dashboard must not expose experimental preview wording");
assert.match(adminUi, /function reviewActionabilityRow_/, "Dashboard Review button must keep existing modal entry function");
assert.match(adminUi, /reviewActionabilityRow_\('[^']*'|reviewActionabilityRow_\(\s*'?\s*\+ String\(index\)/, "Dashboard rows must render Review actions");
assert.match(adminUi, /actionabilityRenderedRows/, "Dashboard Review buttons must use the currently rendered row list");
assert.match(adminUi, /class="btn actionabilityReviewBtn"/, "Dashboard Review button must use the emphasized operator action style");
assert.match(adminUi, /Current Worklist/, "Operations Workspace must label the dense worklist");
assert.ok(adminUi.includes("Review opens authoritative editing."), "Worklist helper text must reinforce Review as the edit handoff");
assert.match(adminUi, /class="actionabilityWorklist"/, "Applicant rows must render in the OPS-style worklist structure");
assert.match(adminUi, /role="table" aria-label="Operations Workspace Current Worklist"/, "Worklist must use a predictable table/list geometry");
assert.match(adminUi, /class="actionabilityWorklistRow" role="row" data-actionability-row=/, "Applicant rows must render as fixed worklist rows");
assert.doesNotMatch(renderActionabilityRowBody_(), /class="actionabilityTask"/, "Applicant rows must not render as the old irregular card blocks");
assert.match(adminUi, /actionabilityStatusChips/, "Dashboard rows must expose compact status chips");
assert.doesNotMatch(adminUi, /\.actionabilityWorklist\{[^}]*overflow-x:auto/, "Primary worklist must not require horizontal scrolling");
assert.doesNotMatch(adminUi, /\.actionabilityWorklistTable\{[^}]*min-width:/, "Primary worklist table must not force horizontal overflow");
["Applicant", "Ownership", "Progress", "Timeline"].forEach((label) => {
  assert.ok(adminUi.includes(`class="actionabilityClusterLabel">${label}</span>`), `Worklist must cluster operator facts under ${label}`);
});
assert.match(adminUi, /actionabilityReviewCell[\s\S]+actionabilityReviewBtn/, "Review must remain a dedicated visible action column");
assert.match(adminUi, /class="btn actionabilityReviewBtn"/, "Review must keep primary button hierarchy");
assert.match(adminUi, /id="actionabilityContextMenu"/, "Current Worklist must expose an OPS-style context menu");
assert.match(adminUi, /oncontextmenu="return openActionabilityContextMenu_/, "Current Worklist rows must open the safe context menu");
assert.match(adminUi, /data-actionability-context="review"/, "Context menu must include Review handoff");
assert.match(adminUi, /data-actionability-context="copy-id"/, "Context menu must include Copy Applicant ID");
assert.match(adminUi, /data-actionability-context="copy-name"/, "Context menu must include Copy Applicant Name");
assert.match(adminUi, /data-actionability-context="copy-summary"/, "Context menu must include a safe row summary copy action");
assert.match(adminUi, /data-actionability-context="copy-contact"/, "Context menu must include safe contact guidance copy action");
assert.match(adminUi, /data-actionability-context="copy-blocker"/, "Context menu must include safe blocker copy action");
assert.doesNotMatch(adminUi, /data-actionability-context="(?:send|reset|status|payment|document)/i, "Context menu must not expose mutation actions");
assert.match(adminUi, /let actionabilitySelectedKeys = \{\}/, "Current Worklist must keep explicit selection state");
assert.match(adminUi, /function selectVisibleActionabilityRows_/, "Current Worklist must support Select Visible");
assert.match(adminUi, /function clearActionabilitySelection_/, "Current Worklist must support Clear Selection");
assert.match(adminUi, /Batch Communication/, "Current Worklist must expose batch communication readiness");
assert.match(adminUi, /Batch Reminder/, "Current Worklist must expose batch reminder readiness");
assert.match(adminUi, /Batch Export/, "Current Worklist must expose local batch export readiness");
assert.match(adminUi, /Send authority remains in Review Workspace or existing gated batch tools/, "Batch communication must remain a handoff, not a send path");
assert.match(adminUi, /function exportActionabilitySelection_/, "Batch Export must be implemented as a local selected-row export");
assert.match(adminUi, /\.modal\{[\s\S]*background: #f8fafc;[\s\S]*border: 1px solid #dbe5ef;/, "Review modal must visually align with the operator workspace surface");
assert.doesNotMatch(renderActionabilityRowBody_(), /<strong>Invoice:<\/strong> <span>Not shown<\/span>|<strong>CRM:<\/strong> <span>Not shown<\/span>/, "Dashboard rows must not spend scan space on Not shown filler facts");
[
  ["applicantId", "Applicant ID"],
  ["name", "Applicant Name"],
  ["owner", "Owner"],
  ["nextAction", "Next Action"],
  ["docs", "Docs"],
  ["payment", "Payment"],
  ["contact", "Contact"],
  ["age", "Age / Last"],
  ["due", "Due / Next"]
].forEach(([key, label]) => {
  assert.match(adminUi, new RegExp(`sortHeader\\("${key}", "${label}"\\)`), `Sortable header must exist for ${label}`);
  assert.match(adminUi, /data-actionability-sort="' \+ esc\(key\) \+ '"/, `Sort data attribute must be rendered for ${label}`);
  assert.match(adminUi, /onclick="sortActionabilityPreview_/, `Sort action must be wired for ${label}`);
});
["applicantId", "docs", "payment", "contact", "due"].forEach((key) => {
  assert.match(adminUi, new RegExp(`state\\.key === "${key}"`), `Sorter must implement ${key}`);
});
assert.match(adminUi, /review\([^;]+actionabilityFocus:\s*true/, "Dashboard Review must explicitly mark actionability-origin focus requests");
assert.match(adminUi, /function clearPendingActionabilityReviewContext_/, "Dashboard Review focus context must have an explicit clear helper");
assert.match(adminUi, /pendingCtx\.requestId\s*=\s*reqId/, "Dashboard Review focus context must bind to the current detail request id");
assert.match(adminUi, /focusActionabilityReviewTarget_\(d\)/, "Dashboard focus must validate against the opened detail record");
assert.match(adminUi, /ctxId\s*&&\s*detailId\s*&&\s*ctxId\s*!==\s*detailId/, "Dashboard focus must ignore applicant mismatches");
assert.match(adminUi, /clearPendingActionabilityReviewContext_\(reqId\)/, "Dashboard focus context must clear on stale or failed detail requests");
assert.match(adminUi, /reviewOpts\.actionabilityFocus\s*===\s*true[\s\S]+clearPendingActionabilityReviewContext_\(\)/, "Normal Review calls must clear stale dashboard focus context");

function renderActionabilityRowBody_() {
  return adminUi.slice(indexOfRequired("function renderActionabilityPreview_"), indexOfRequired("function reviewActionabilityRow_"));
}

const renderBody = renderActionabilityRowBody_();
assert.doesNotMatch(renderBody, /esc\(\s*r\.recommendedMessageType\s*\)/, "Rows must render communication labels, not raw message type identifiers");
assert.doesNotMatch(renderBody, /esc\(\s*r\.(?:templateId|Template_ID)\s*\)/i, "Rows must not render raw template identifiers");
assert.doesNotMatch(renderBody, /INVALID_EMAIL|NO_EFFECTIVE_EMAIL/, "Rows must not render raw contactability codes");
assert.doesNotMatch(renderBody, /html\s*\+=\s*['"][\s\S]{0,120}admin_/i, "Rows must not render internal function names");
assert.match(adminUi, /function actionabilityDocumentLabel_/, "Dashboard must normalize document field keys before display");
assert.match(adminUi, /missing\.slice\(0,\s*2\)\.map\(actionabilityDocumentLabel_/, "Dashboard blocker labels must not render raw document field keys");

assert.match(adminJs, /hasPhoneFallback/, "Actionability payload must expose phone fallback availability");
assert.match(adminJs, /populationLedger:\s*populationLedgerPublicSummary_\(ledger\)/, "Actionability preview RPC must expose Population Ledger summary");
assert.match(adminJs, /communicationsActivity:\s*buildCommunicationsActivityShell_/, "Operational dashboard must expose read-only communications activity");
assert.match(adminJs, /emailResponseTraffic\s*=\s*out\.communicationsActivity/, "Legacy emailResponseTraffic field must remain a compatibility alias");
assert.match(adminUi, /id="actionabilityResponseTraffic"/, "Operations Workspace must have a read-only response traffic surface");
assert.match(adminUi, /Communications Activity/, "Operations Workspace must label the surface as Communications Activity");
["Today", "Last 7 Days", "Month-to-Date", "Previous Month", "Failed", "Suppressed / Bounced", "Last Successful Send", "Cumulative Emails Sent"].forEach((label) => {
  assert.match(adminUi, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Communications Activity must include ${label}`);
});
["Permanent Bounces", "Temporary Bounces", "Bounce Rate", "Last Bounce", "Successful Deliveries"].forEach((label) => {
  assert.match(adminUi, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Communications Activity must support reconciled delivery metric ${label}`);
});
assert.match(adminJs, /Source: latest row state only/, "Communications Activity must label latest-row source limitations");
assert.match(adminJs, /Mailbox bounces affect reliability metrics only after deterministic runtime reconciliation/, "Communications Activity must disclose that mailbox bounces require runtime reconciliation before dashboard use");
assert.match(adminJs, /cumulativeLabel:\s*"Rows with latest status SENT"/, "Cumulative metric must be labelled as row-latest proxy when no true ledger exists");
assert.match(adminJs, /deliveryHealth:\s*\{[\s\S]*Source: reconciled runtime delivery health/, "Communications Activity must define runtime delivery-health metrics separately from Gmail");
assert.match(adminUi, /delivery\.available === true/, "Reconciled delivery metrics must only render when runtime evidence exists");
assert.doesNotMatch(adminJs, /GmailApp\.search[\s\S]*communicationsActivity/, "Communications Activity metrics must not query Gmail directly");
assert.match(adminUi, /cumulativeIsHistorical === true/, "UI must distinguish historical cumulative sends from latest-row proxy counts");
assert.doesNotMatch(adminUi, /admin_sendCommunicationsActivity|admin_updateCommunicationsActivity|admin_createCommunicationsLedger/, "Communications Activity surface must not add mutation RPCs");
assert.match(adminUi, /function actionabilityManagementExceptionBreakdown_/, "Management Exceptions must expose a scoped breakdown when visible rows support it");
assert.match(adminUi, /Visible breakdown: Uncontactable/, "Management Exceptions breakdown must be labelled as visible-row derived");
assert.match(adminUi, /class="actionabilitySortBtn"[\s\S]*esc\(label \+ actionabilitySortLabel_\(key\)\)/, "Grouped worklist headers must render separated sort button labels");
assert.match(adminUi, /\.actionabilitySortBtn\{[^}]*border:1px solid #dbe5ef[^}]*text-transform:none/s, "Grouped worklist headers must avoid merged-looking uppercase labels");
assert.match(adminJs, /function admin_getPopulationLedger/, "Population Ledger RPC must exist as a read-only authority foundation");
assert.match(adminJs, /function buildPopulationLedgerFromValues_/, "Population Ledger must be reusable by dashboard and lifecycle consumers");
assert.match(adminJs, /contactabilityState: isUncontactable \? "UNCONTACTABLE"/, "Actionability payload must classify no-email/no-phone applicants as uncontactable");
assert.match(adminUi, /return "Uncontactable"/, "Dashboard priority language must show Uncontactable");
assert.match(adminUi, /return "Contact details required"/, "Dashboard due language must replace urgent due text for uncontactable applicants");
assert.match(adminUi, /return "No email, no phone"/, "Dashboard blocker must show no-email/no-phone facts");
assert.match(adminUi, /return "Contactability Gate"/, "Dashboard authority must show Contactability Gate");
assert.match(adminUi, /function actionabilityIsEmailActionable_/, "Dashboard must gate worklist email actions before presenting batch communication");
assert.match(adminUi, /NO_EFFECTIVE_EMAIL[\s\S]*EMAIL_BLOCKED_OR_BOUNCED/, "Dashboard email actionability must reject no-email and bounced/blocked suppressors");
assert.match(adminUi, /function actionabilityContactGuidance_/, "Dashboard must expose operator contactability guidance");
assert.match(adminUi, /No usable email or phone\. Route to Contactability Gate\./, "No-contact rows must route operators to Contactability Gate");
assert.match(adminUi, /function actionabilityDocumentCompletenessLabel_/, "Worklist must render document completeness evidence");
assert.match(adminUi, /All Required Missing/, "Document completeness must distinguish no uploads");
assert.match(adminUi, /Required Uploaded - Review/, "Document completeness must distinguish uploaded-but-unverified records");
assert.match(adminUi, /Required Complete/, "Document completeness must distinguish complete records");
assert.match(adminUi, /function actionabilityHiddenExplanation_/, "Bucket table must explain hidden population records");
assert.match(adminUi, /hidden by worklist window, completion state, or another authority path/, "Hidden population explanation must name why records are not visible");
assert.match(adminUi, /View Hidden/, "Bucket action must distinguish hidden population records from normal view");
assert.match(adminUi, /Explain/, "Bucket action must explain buckets with population but no visible rows");

console.log("PASS Operations Workspace is primary above Review Queues");
console.log("PASS Operations Workspace role wording, compatibility Review Queues, and Global View shell are present");
console.log("PASS ledger bar and operational bucket table replace card-heavy KPI/group surfaces");
console.log("PASS experimental/internal/contactability codes remain hidden from dashboard rows");
console.log("PASS dashboard Review action keeps existing modal entry from rendered rows");
console.log("PASS Current Worklist context menu exposes safe read-only actions only");
console.log("PASS dashboard Review focus context is request-bound and cleared on stale paths");
console.log("PASS no-contact applicants render Uncontactable / Contactability Gate language");
