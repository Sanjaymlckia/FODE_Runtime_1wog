const fs = require("node:fs");
const assert = require("node:assert/strict");

const adminUi = fs.readFileSync("AdminUI.html", "utf8");
const adminJs = fs.readFileSync("Admin.js", "utf8");

function indexOfRequired(needle) {
  const index = adminUi.indexOf(needle);
  assert.notEqual(index, -1, `Missing expected AdminUI surface marker: ${needle}`);
  return index;
}

function cssRule(selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const match = adminUi.match(new RegExp(`(?:^|\\n)\\s*${escaped}\\{([^}]*)\\}`, "s"));
  assert.ok(match, `Missing CSS rule: ${selector}`);
  return match[1];
}

function expectReadableControl(selector) {
  const rule = cssRule(selector);
  assert.match(rule, /white-space:normal;/, `${selector} must allow wrapping`);
  assert.match(rule, /overflow:visible;/, `${selector} must not hide text`);
  assert.match(rule, /text-overflow:clip;/, `${selector} must not ellipsize operator labels`);
  assert.match(rule, /overflow-wrap:anywhere;/, `${selector} must wrap long labels instead of clipping`);
}

function functionSource(name) {
  const start = indexOfRequired(`function ${name}(`);
  const next = adminUi.indexOf("\n    function ", start + 1);
  return adminUi.slice(start, next === -1 ? adminUi.length : next);
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
assert.match(adminUi, /\.secondaryOperationalPanel \.btn:disabled,[\s\S]*background:#e2eaf2;[\s\S]*border-color:#8da2b7;[\s\S]*color:#26384e;[\s\S]*opacity:1;/, "Secondary disabled buttons must stay readable without opacity fade");
assert.match(adminUi, /\.statusTag\.ready\{[\s\S]*background:#e7f4ec;[\s\S]*color:#145c34;/, "Secondary ready chips must use dark text and solid readable green");
assert.match(adminUi, /\.badge-warning\{[\s\S]*background:#fff2dc;[\s\S]*color:#805006;/, "Secondary warning chips must use dark text and solid readable amber");
expectReadableControl(".btn");
assert.match(cssRule(".btn:disabled,\n    .btn[disabled]"), /opacity:1;[\s\S]*color:#26384e;/, "Disabled global buttons must remain readable");
[
  ".actionabilityBucketSortBtn",
  ".actionabilityBucketReviewBtn",
  ".actionabilityBucketHiddenPanel summary",
  ".actionabilitySortBtn",
  ".actionabilityMiniChip",
  ".badge",
  ".commTemplateChip",
  ".opsStatusPill",
  ".opsSortableHeader",
  ".opsActionBtn",
  ".operatorControl"
].forEach(expectReadableControl);
assert.match(adminUi, /\.operatorControlPrimary\{[^}]*background:#1f5aa5;[^}]*color:#fff;/, "Primary operator controls must use a consistent readable primary state");
assert.match(adminUi, /\.operatorControlSecondary\{[^}]*background:#fff;[^}]*color:#173451;/, "Secondary operator controls must use a consistent readable secondary state");
assert.match(adminUi, /\.operatorControlBatch\{[^}]*background:#fff7e8;[^}]*color:#704a00;/, "Batch operator controls must use a consistent readable batch state");
assert.match(adminUi, /\.operatorControl:disabled,[\s\S]*\.operatorControl\[disabled\],[\s\S]*\.operatorControlDisabled\{[\s\S]*cursor:not-allowed;[\s\S]*background:#e2eaf2;[\s\S]*color:#26384e;[\s\S]*opacity:1;/, "Disabled operator controls must remain readable and unavailable");
assert.match(adminUi, /\.operatorControlBusy,[\s\S]*\.operatorControl\[aria-busy="true"\]\{[\s\S]*cursor:progress;[\s\S]*background:#dbeafe;[\s\S]*color:#173451;/, "Busy operator controls must have a distinct readable busy state");
assert.match(cssRule(".actionabilityBucketReviewBtn:disabled"), /background:#e2eaf2;[\s\S]*color:#26384e;[\s\S]*opacity:1;/, "Disabled bucket review buttons must remain readable");
assert.match(adminUi, /\.actionabilityBucketReviewBtn\.operatorControlSecondary\{[\s\S]*background:#fff;[\s\S]*color:#174a8b;/, "Show Worklist must render as a secondary operator control");
assert.match(adminUi, /\.actionabilityReviewBtn\.operatorControlPrimary\{[\s\S]*background:#1f5aa5;[\s\S]*color:#fff;/, "Row Review must render as the primary operator control");
assert.match(cssRule(".opsModeBtn[disabled]"), /opacity:1;[\s\S]*color:#d6e7f8;/, "Disabled mode buttons must not be washed out");
assert.match(cssRule(".opsActionBtn[disabled]"), /color:#26384e;[\s\S]*background:#e2eaf2;[\s\S]*opacity:1;/, "Disabled ops action buttons must remain readable");
[
  ".actionabilityLedgerItem .k",
  ".actionabilityLedgerItem .v",
  ".actionabilityBucketMetric .v",
  ".actionabilityTrafficItem .v",
  ".actionabilityWorklistCell strong",
  ".actionabilityWorklistCell span",
  ".actionabilityDueBlock span",
  ".actionabilityGuidance",
  ".reviewApplicantName",
  ".reviewApplicantId",
  ".reviewHeaderFactValue",
  ".documentGalleryFileName",
  ".documentGalleryActions .muted[aria-label=\"Recommendation\"]"
].forEach(expectReadableControl);
[
  ".actionabilityBucketSortBtn",
  ".actionabilitySortBtn",
  ".actionabilityMiniChip",
  ".opsStatusPill",
  ".commTemplateChip",
  ".reviewApplicantName",
  ".actionabilityWorklistCell span",
  ".actionabilityGuidance"
].forEach((selector) => {
  assert.doesNotMatch(cssRule(selector), /text-overflow:ellipsis|white-space:nowrap|overflow:hidden/, `${selector} must not hide operator-critical labels`);
});
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
assert.ok(kpiIndex < summaryIndex, "Ledger bar must render above operational bucket cards");
assert.match(adminUi, /function renderActionabilityLedgerBar_/, "Operations Workspace must render a ledger trust bar");
assert.match(adminUi, /actionabilityLedgerItem/, "Ledger trust bar must use aligned ledger items, not decorative cards");
assert.match(adminUi, /Scanned rows/, "Ledger bar must expose scanned rows");
assert.match(adminUi, /Applicant ID rows/, "Ledger bar must expose ApplicantID rows");
assert.match(adminUi, /Unknown \/ Unclassified/, "Ledger bar must expose unknown/unclassified rows");
assert.match(adminUi, /Duplicate Applicant IDs/, "Ledger bar must expose duplicate ApplicantID risk");
assert.match(adminUi, /Integrity/, "Ledger bar must expose integrity status");
assert.match(adminUi, /Generated/, "Ledger bar must expose generated timestamp");
assert.match(adminUi, /class="actionabilityBucketDeck"/, "Operational buckets must render as a card deck");
assert.match(adminUi, /class="actionabilityBucketCard/, "Operational buckets must render horizontal cards");
assert.match(adminUi, /Current Worklist Eligible/, "Applicant Action cards must expose returned worklist eligibility");
assert.match(functionSource("renderActionabilityBucketCard_"), /hiddenMetricLabel = key === "APPLICANT" \? "Eligible Outside Current Window" : "Hidden"/, "Applicant Action cards must relabel hidden workload as outside-current-window eligibility");
assert.match(functionSource("renderActionabilityBucketCard_"), /Current Worklist Eligible/, "Applicant Action cards must render a distinct returned-worklist metric");
assert.match(adminUi, /function actionabilityEligibleNowCountForGroup_/, "Operational cards must use a shared eligible-now count helper");
assert.match(functionSource("actionabilityEligibleNowCountForGroup_"), /actionabilityBucketSummaryForGroup_\(key\)[\s\S]*summary\.eligibleNowCount[\s\S]*workload\.READY[\s\S]*filter\(actionabilityIsSelectable_\)/, "Applicant Action eligible-now count must prefer server-authored bucket summaries with workload and row fallbacks");
assert.match(functionSource("actionabilityCoolingOffCountForGroup_"), /actionabilityBucketSummaryForGroup_\(key\)[\s\S]*summary\.coolingOffCount[\s\S]*workload\.COOLING_OFF[\s\S]*COOLING_OFF/, "Applicant Action cooling-off count must prefer server-authored bucket summaries with workload and row fallbacks");
assert.match(functionSource("renderActionabilityBucketCard_"), /actionabilityEligibleNowCountForGroup_\(key, rows\)[\s\S]*actionabilityCoolingOffCountForGroup_\(key, rows\)/, "Operational cards must derive eligible/cooling counts from shared Actionability authority helpers");
assert.match(functionSource("renderActionabilityPreview_"), /actionabilityBucketSummariesState = data\.bucketSummaries \|\| \{\}/, "Operations Workspace must hydrate server-authored bucket summaries");
assert.match(adminUi, /Next Operator Action/, "Operational cards must preserve next action scanning");
assert.match(adminUi, /actionabilityBucketStatusBlock/, "Operational cards must expose concise status blocks");
assert.doesNotMatch(adminUi, /Not derived|Cooling not yet derived|Cooling Off/, "Operational cards must not advertise unfinished Cooling Off placeholders");
assert.doesNotMatch(adminUi, /\.actionabilityBucketMetric\{[^}]*border:/, "Operational card metrics must use typography rather than nested metric boxes");
assert.doesNotMatch(adminUi, /<button class="actionabilityKpi/, "Operations Workspace must not render card-style KPI buttons");
assert.doesNotMatch(adminUi, /class="actionabilityGroupCard/, "Operations Workspace must not render irregular group cards");

[
  "Applicant Action",
  "Admissions Review",
  "Finance",
  "Academic Admin",
  "Contactability Exceptions",
  "Exceptions",
  "Dormant",
  "Completed / No Action",
  "Unknown / Unclassified"
].forEach((label) => {
  assert.ok(adminUi.includes(label), `Operational bucket must be present: ${label}`);
});
assert.match(adminUi, /actionabilityBucketReviewBtn/, "Operational bucket cards must expose left-side Review controls");
assert.match(adminUi, /function filterActionabilityBucketForReview_/, "Bucket Review controls must filter the bucket worklist");
assert.match(adminUi, /onclick="filterActionabilityBucketForReview_/, "Bucket Review controls must use filter-only handoff");
assert.match(adminUi, /Show this bucket worklist\. Use row Review to open an exact applicant\./, "Bucket Review control must explain exact-applicant handoff");
assert.doesNotMatch(functionSource("filterActionabilityBucketForReview_"), /reviewActionabilityRecord_|review\(/, "Bucket Review must not open a modal or choose a first applicant");
assert.match(functionSource("filterActionabilityBucketForReview_"), /actionabilityActiveGroup\s*=\s*normalized[\s\S]*renderActionabilityPreview_\(\{ preserveRows: true \}\)/, "Bucket Review must switch the visible worklist to that bucket");
assert.match(adminUi, /actionabilityBucketHiddenPanel[\s\S]*Hidden ' \+ esc\(hiddenCount\)/, "Operational bucket cards must expose secondary hidden controls");
assert.match(adminUi, /data-actionability-bucket-sort/, "Operational bucket cards must expose sort controls");
assert.match(adminUi, /onclick="selectActionabilityGroup_/, "Operational bucket rows must select an actionability group");
assert.match(adminUi, /var rawDisplayRows = actionabilityActiveGroup \? \(groupRows\[actionabilityActiveGroup\] \|\| \[\]\) : rows;/, "KPI/group filters must still drive displayed worklist source rows");
assert.match(adminUi, /var displayRows = actionabilityActiveGroup \? actionabilityDisplayRowsForGroup_\(actionabilityActiveGroup, rawDisplayRows\) : rawDisplayRows;/, "KPI/group filters must reconcile displayed worklist rows through server actionability DTOs");
assert.match(adminUi, /actionabilityPopulationLedgerState\s*=\s*ledger/, "Operations Workspace must retain Population Ledger summary from the backend");
assert.match(adminUi, /function actionabilityPopulationCountForGroup_/, "Operations Workspace KPI totals must have a ledger-backed count resolver");
assert.match(adminUi, /operationalBucketCounts/, "Operations Workspace must consume ledger operational bucket counts");
assert.match(adminUi, /actionabilityPopulationCountForGroup_\(key,\s*rows\.length\)/, "Operational bucket cards must render full population bucket counts with visible-row fallback only");
assert.match(adminUi, /eligible-now rows shown/, "Operations Workspace meta must label Applicant Action rows as eligible-now work");
assert.match(adminUi, /bounded worklist rows/, "Operations Workspace meta must retain bounded worklist wording for non-Applicant filters");
assert.match(adminUi, /String\(populationTotal\) \+ " total applicant population/, "Operations Workspace meta must separate displayed worklist rows from population totals");
assert.doesNotMatch(renderActionabilityRowBody_(), /Newest:/, "Operational bucket cards must not spend benchmark scan space on newest metadata");
assert.match(adminUi, /stagePopulationLedgerState/, "Lifecycle Map must retain Population Ledger summary from the backend");
assert.match(adminUi, /Population Ledger: " \+ String\(Number\(ledger\.applicantIdRows/, "Lifecycle Map metadata must report ledger applicant population");
assert.doesNotMatch(adminUi, /review queue visible/i, "Lifecycle Map must not label lifecycle/actionability counts as Review Queue visibility");
assert.match(adminUi, /var ledger = data\.populationLedger/, "Global Dashboard renderer must consume Population Ledger summary");
assert.match(adminUi, /ApplicantID \/ " \+ Number\(data\.scannedRows/, "Global Dashboard scan metric must separate ApplicantID rows from scanned rows");

["APPLICANT", "ADMISSIONS", "FINANCE", "ACADEMIC", "CONTACTABILITY", "MANAGEMENT", "DORMANT", "COMPLETE", "UNKNOWN"].forEach((key) => {
  assert.ok(adminUi.includes(`data-actionability-kpi="' + esc(key) + '"`) || adminUi.includes(`data-actionability-kpi="${key}"`), `KPI bucket key must be rendered: ${key}`);
});

assert.doesNotMatch(adminUi, /Read-Only Experimental|Experimental Actionability|Actionability Preview/i, "Promoted dashboard must not expose experimental preview wording");
assert.match(adminUi, /function reviewActionabilityRow_/, "Dashboard Review button must keep existing modal entry function");
assert.match(adminUi, /reviewActionabilityRow_\('[^']*'|reviewActionabilityRow_\(\s*'?\s*\+ String\(index\)/, "Dashboard rows must render Review actions");
assert.match(adminUi, /actionabilityRenderedRows/, "Dashboard Review buttons must use the currently rendered row list");
assert.match(functionSource("reviewActionabilityRow_"), /actionabilityRenderedRows[\s\S]*reviewActionabilityRecord_\(rows\[Number\(index\)\]/, "Row Review must open the exact rendered row");
assert.match(functionSource("reviewActionabilityRecord_"), /review\(Number\(row\.rowNumber \|\| 0\)[\s\S]*String\(row\.applicantId \|\| ""\)/, "Row Review must pass the selected applicant ID into the modal opener");
assert.match(adminUi, /class="btn actionabilityReviewBtn operatorControl operatorControlPrimary"/, "Dashboard Review button must use the emphasized operator action style");
assert.match(adminUi, /Current Worklist/, "Operations Workspace must label the dense worklist");
assert.ok(adminUi.includes("Review opens authoritative editing."), "Worklist helper text must reinforce Review as the edit handoff");
assert.match(adminUi, /class="actionabilityWorklist"/, "Applicant rows must render in the OPS-style worklist structure");
assert.match(adminUi, /role="table" aria-label="Operations Workspace Current Worklist"/, "Worklist must use a predictable table/list geometry");
assert.match(adminUi, /class="actionabilityWorklistRow" role="row" data-actionability-row=/, "Applicant rows must render as fixed worklist rows");
assert.doesNotMatch(renderActionabilityRowBody_(), /class="actionabilityTask"/, "Applicant rows must not render as the old irregular card blocks");
assert.match(adminUi, /const ACTIONABILITY_PAGE_SIZE = 10/, "Current Worklist must use deterministic page size 10");
assert.match(adminUi, /function renderActionabilityPager_/, "Current Worklist must render pagination controls");
assert.match(adminUi, /Showing " \+ String\(Number\(meta\.start \|\| 0\) \+ 1\) \+ "-" \+ String\(Number\(meta\.end/, "Pagination must show range text such as Showing 1-10 of N");
assert.match(adminUi, /Previous<\/button>[\s\S]*Next<\/button>/, "Pagination must expose Previous and Next controls");
assert.match(adminUi, /actionabilityRenderedRows = pageRows\.slice\(\)/, "Rendered rows must be the current page only");
assert.match(adminUi, /actionabilityCurrentCohortRows = displayRows\.slice\(\)/, "Full bounded cohort must remain available outside the current page");
assert.match(adminUi, /actionabilityStatusChips/, "Dashboard rows must expose compact status chips");
assert.doesNotMatch(adminUi, /\.actionabilityWorklist\{[^}]*overflow-x:auto/, "Primary worklist must not require horizontal scrolling");
assert.doesNotMatch(adminUi, /\.actionabilityWorklistTable\{[^}]*min-width:/, "Primary worklist table must not force horizontal overflow");
["Applicant", "Ownership", "Progress", "Timeline"].forEach((label) => {
  assert.ok(adminUi.includes(`class="actionabilityClusterLabel">${label}</span>`), `Worklist must cluster operator facts under ${label}`);
});
assert.match(adminUi, /actionabilityReviewCell[\s\S]+actionabilityReviewBtn/, "Review must remain a dedicated visible action column");
assert.match(adminUi, /class="btn actionabilityReviewBtn operatorControl operatorControlPrimary"/, "Review must keep primary button hierarchy");
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
assert.match(adminJs, /function resolveActionabilityState_/, "Server-side Actionability Resolver must exist");
assert.match(adminJs, /actionabilityState:[\s\S]*selectable:[\s\S]*selectBlockReason:[\s\S]*coolingOffUntil:[\s\S]*recommendedAction:[\s\S]*reasonCode:/, "Actionability rows must expose workload state, selection eligibility, and operator reasons");
assert.match(adminJs, /workloadSummary:\s*\{ READY: 0, COOLING_OFF: 0, AWAITING_APPLICANT: 0, AWAITING_PAYMENT: 0, REVIEW_REQUIRED: 0, COMPLETE: 0, UNKNOWN: 0 \}/, "Actionability preview must return workload summaries separately from Population Ledger counts");
assert.match(functionSource("actionabilityIsEmailActionable_"), /Object\.prototype\.hasOwnProperty\.call\(r, "selectable"\)[\s\S]*actionabilityIsSelectable_\(r\)/, "Client email actionability must defer to server-provided selectable state");
assert.match(functionSource("selectVisibleActionabilityRows_"), /if \(!actionabilityIsSelectable_\(row\)\) return;/, "Select Visible must auto-select READY rows only");
assert.match(functionSource("selectAllActionabilityRows_"), /if \(!actionabilityIsSelectable_\(row\)\) return;/, "Select All must auto-select READY rows only");
assert.match(adminUi, /READY rows selected/, "Selection feedback must tell operators that only READY rows were selected");
assert.match(adminUi, /eligible for batch preview now/, "Selection summary must describe eligible-now preview readiness instead of guaranteed send readiness");
assert.match(adminUi, /data-actionability-state=/, "Worklist rows must expose server-derived actionability state");
assert.match(adminUi, /function selectVisibleActionabilityRows_/, "Current Worklist must support Select Visible");
assert.match(adminUi, /function selectAllActionabilityRows_/, "Current Worklist must support Select All bounded by current authority/filter");
assert.match(adminUi, /function clearActionabilitySelection_/, "Current Worklist must support Clear Selection");
assert.match(adminUi, /Batch Communication/, "Current Worklist must expose batch communication readiness");
assert.match(adminUi, /Batch Reminder/, "Current Worklist must expose batch reminder readiness");
assert.match(adminUi, /Batch Export/, "Current Worklist must expose local batch export readiness");
assert.match(adminUi, /function exportActionabilitySelection_/, "Batch Export must be implemented as a local selected-row export");
assert.match(adminUi, /id="standaloneBatchCommModalBack"/, "Batch communication must provide a standalone modal surface");
assert.match(adminUi, /id="standaloneBatchCommModalBack" class="modalBack standaloneBatchCommBack"/, "Standalone batch modal container must be renderable as a real modal");
assert.match(adminUi, /\.standaloneBatchCommBack\.open\{ display:flex; \}/, "Standalone batch modal open state must visibly display the modal");
assert.match(functionSource("openBatchCommunicationModal_"), /standaloneBatchCommModalBack[\s\S]*back\.classList\.add\("open"\)[\s\S]*back\.style\.display = "flex"/, "Batch Communication must visibly open the standalone modal container");
assert.match(functionSource("openBatchCommunicationModal_"), /BLOCKED: Batch Communication modal container is missing/, "Batch Communication must show an explicit blocked reason if the modal cannot open");
assert.match(adminUi, /id="standaloneBatchCommTemplateGallery"/, "Batch modal must expose the shared template gallery pattern");
assert.match(adminUi, /commTemplateSelectedBanner[\s\S]*Selected template[\s\S]*commTemplateRecommendedBanner[\s\S]*Recommended/, "Batch modal must visibly highlight the selected recommended template");
assert.match(adminUi, /id="standaloneBatchCommRecipients"/, "Batch modal must expose recipient preview and quick exclusion");
assert.match(adminUi, /Recipient count/, "Batch modal preview must show recipient count");
assert.match(adminUi, /id="btnStandaloneBatchCommPreview"[\s\S]*>Generate Preview<\/button>[\s\S]*id="btnStandaloneBatchCommSend"[\s\S]*onclick="requestBatchCommunicationConfirmation_\(\)"[\s\S]*>Review Send<\/button>/, "Batch modal must expose generate preview and in-app confirmation controls");
assert.match(adminUi, /id="standaloneBatchCommConfirm"/, "Batch modal must render an in-app confirmation panel");
assert.match(adminUi, /batchCommWorkflow[\s\S]*Template[\s\S]*Preview[\s\S]*Recipients[\s\S]*Confirm[\s\S]*Send/, "Batch modal must show a workflow checklist");
assert.match(adminUi, /commTemplateOtherBanner[\s\S]*Other option/, "Batch modal must mark non-recommended templates as other options");
assert.match(adminUi, /Excluded \/ Blocked/, "Batch modal summary must make exclusions and blocked records prominent");
assert.match(adminUi, /Technical Diagnostics/, "Batch modal must keep diagnostics collapsed under a technical section");
assert.match(functionSource("batchCommAuthoritySummary_"), /authoritySource[\s\S]*mismatchCount/, "Batch modal must summarize Communication Authority source and lifecycle mismatch counts");
assert.match(functionSource("batchCommAuthorityDetail_"), /Authority:[\s\S]*Legacy:[\s\S]*Canonical:[\s\S]*Overlays:[\s\S]*Recommended:/, "Batch modal recipient rows must show legacy/canonical authority details");
assert.match(functionSource("renderBatchCommunicationModal_"), /Ready to Send \| Authority:/, "Batch modal readiness must display the Communication Authority source");
assert.match(functionSource("renderBatchCommunicationModal_"), /selectionAuthority:\s*"Actionability"[\s\S]*communicationAuthority:\s*"Send gate"/, "Batch modal technical diagnostics must distinguish selection and communication authority");
assert.match(functionSource("renderBatchCommunicationModal_"), /Selected total[\s\S]*Preview\/send cap[\s\S]*Will send this run[\s\S]*Remaining after cap/, "Batch modal summary must distinguish selected total from capped this-run send count");
assert.match(functionSource("batchCommRecipientCounts_"), /selectedTotal[\s\S]*previewSendCap[\s\S]*willSendThisRun[\s\S]*remainingAfterCap/, "Batch modal recipient counts must consume selected-batch cap fields from the backend");
assert.match(functionSource("actionabilityBatchCommunication_"), /openBatchCommunicationFromSelection_\("selected"\)/, "Selected cohort batch communication must open the batch modal");
assert.match(functionSource("actionabilityBatchCommunication_"), /actionabilityBatchMessage = ""[\s\S]*actionabilityBatchPanelMode = ""[\s\S]*openBatchCommunicationFromSelection_\("selected"\)/, "Selected cohort batch communication must open the modal directly without a handoff panel");
assert.match(functionSource("actionabilityBatchReminder_"), /openBatchCommunicationFromSelection_\("reminder"\)/, "Selected reminder cohort must open the batch modal with reminder intent");
assert.match(functionSource("renderActionabilitySelectionControls_"), /var canBatchEmail = eligible > 1;/, "Batch Communication must be enabled only when two or more READY rows are selected");
assert.doesNotMatch(adminUi, /Batch Communication Handoff|Batch Reminder Handoff/, "Batch workflow must not expose a handoff panel as the primary result");
assert.doesNotMatch(adminUi, /Open first eligible in Review/, "Batch workflow must not route multi-applicant cohorts through the Review Workspace path");
assert.match(functionSource("previewBatchCommunicationModal_"), /admin_previewStageBatch[\s\S]*admin_previewSelectedApplicantBatch/, "Batch modal preview must support both stage and selected cohort sources");
assert.match(functionSource("sendBatchCommunicationModal_"), /admin_sendStageBatch[\s\S]*admin_sendSelectedApplicantBatch/, "Batch modal send must support both stage and selected cohort sources");
assert.doesNotMatch(functionSource("previewBatchCommunicationModal_") + functionSource("sendBatchCommunicationModal_"), /admin_sendApplicantMessage/, "Batch modal must not fall back to the single-applicant Review RPC");
assert.match(functionSource("selectBatchCommTemplate_"), /batchCommState\.sourceType === "stage"[\s\S]*batchCommState\.recommendedMessageType/, "Stage cohort template changes must remain locked to lifecycle-stage policy");
assert.match(adminUi, /Stage policy locked/, "Batch modal must explain disabled stage template overrides");
assert.match(adminUi, /onclick="openBatchCommunicationFromStage_\(\)">Open Batch Communication/, "Stage cohort controls must open the batch communication modal as the primary workflow");
assert.doesNotMatch(adminUi, /Confirm in Batch Modal/, "Old inline confirmation controls must not compete with the batch modal");
assert.match(adminUi, /Default batch size: 30\. Larger batches may be restricted by send policy\./, "Batch UI must explain the default batch size and send-policy cap");
assert.doesNotMatch(adminUi, /id="(?:opsStageBatchLimit|stageBatchLimit)"[^>]*value="50"/, "Stage batch defaults must not advertise 50-row production batches");
assert.match(functionSource("openBatchCommunicationFromSelection_"), /ids\.length === 1[\s\S]*Single applicant selected[\s\S]*Review Workspace communication flow/, "Single selected applicant must use an explicit single-recipient path instead of the batch modal");
assert.match(functionSource("openBatchCommunicationFromSelection_"), /!ids\.length[\s\S]*Select at least two applicants/, "Empty selected cohorts must explain why the batch modal cannot open");
assert.match(functionSource("renderBatchPanel"), /sendBtn\.style\.display = "none"/, "Legacy inline stage send control must be hidden so the modal remains primary");
assert.match(functionSource("openBatchCommunicationFromSelection_"), /actionabilitySelectionSourceLabel_\(\)/, "Selected cohort modal source must identify page, manual, or full bounded cohort source");
assert.match(functionSource("selectVisibleActionabilityRows_"), /var visible = Array\.isArray\(actionabilityRenderedRows\)[\s\S]*Current page selection[\s\S]*READY rows selected/, "Select Visible must select READY rows from the current page only");
assert.match(functionSource("selectAllActionabilityRows_"), /actionabilitySelectionSource = "all"/, "Select All must mark the full bounded cohort source");
assert.match(functionSource("loadActionabilityPreview_"), /admin_getActionabilityPreview\(\{ limit: 100/, "Operations Workspace must load the full existing bounded worklist cap before client pagination");
assert.match(functionSource("batchCommCanSend_"), /previewStale === true/, "Quick exclusions must make preview stale before send");
assert.match(functionSource("batchCommCanSend_"), /sendResult[\s\S]*ok !== false[\s\S]*return false/, "Completed batch sends must disable repeat send attempts from the same preview");
assert.match(functionSource("toggleBatchCommRecipient_"), /previewStale = true/, "Quick exclusions must update counts and require a fresh preview");
assert.match(adminUi, /sentThisSession: false[\s\S]*refreshAfterSendPending: false/, "Batch modal must track whether a send occurred this session and whether post-send refresh is pending");
assert.match(functionSource("handleBatchCommSendResult_"), /previewStale = true[\s\S]*sentThisSession = true[\s\S]*actionabilitySelectedKeys = \{\}[\s\S]*refreshActionabilityAfterBatchSend_\("send_success"\)/, "Successful batch send must invalidate the preview, clear stale selection state, and force a fresh actionability reload");
assert.match(functionSource("closeBatchCommunicationModal_"), /sentThisSession \|\| refreshPending[\s\S]*refreshActionabilityAfterBatchSend_\("close_after_send"\)/, "Closing the batch modal after send must require a refreshed worklist state");
assert.match(functionSource("closeBatchCommunicationModal_"), /resetBatchCommunicationSessionState_\(\);/, "Closing the batch modal must clear stale modal session state");
assert.match(functionSource("loadActionabilityPreview_"), /typeof o\.onSuccess === "function"[\s\S]*typeof o\.onFailure === "function"/, "Forced post-send refresh must support completion callbacks");
assert.match(functionSource("refreshActionabilityAfterBatchSend_"), /force: true[\s\S]*clearActionabilitySelectionKeysForNonSelectableRows_\(\)/, "Post-send refresh helper must force a server-derived reload and clear stale non-selectable selection keys");
assert.match(functionSource("batchCommConfirmHtml_"), /This action will immediately send[\s\S]*emails[\s\S]*<strong>Template<\/strong>[\s\S]*<strong>Recipients<\/strong>[\s\S]*<strong>Cap<\/strong>[\s\S]*<strong>Authority<\/strong>/, "Batch confirmation panel must name template, recipient count, cap, and authority");
assert.match(functionSource("batchCommConfirmHtml_"), /Send ' \+ esc\(recipients\) \+ ' Emails/, "Batch confirmation button must use exact send count");
assert.doesNotMatch(functionSource("sendBatchCommunicationModal_"), /window\.confirm/, "Batch send must use the in-app confirmation panel instead of browser-native confirm");
assert.ok(adminUi.includes("Eligible for batch preview."), "Selectable rows must describe preview eligibility instead of guaranteed send readiness");
assert.doesNotMatch(adminUi, /Ready for batch communication|READY for batch communication/, "Worklist rows must not overstate selected-batch send readiness");
assert.match(adminUi, /Select Visible<\/button>[\s\S]*Select All Returned<\/button>[\s\S]*Clear Selection<\/button>/, "Selection controls must remain visible in the operator control strip with returned-cohort wording");
assert.match(adminUi, /class="btn small operatorControl operatorControlSecondary" type="button" onclick="selectVisibleActionabilityRows_\(\)">Select Visible/, "Select Visible must use secondary operator control semantics");
assert.match(adminUi, /class="btn small operatorControl operatorControlSecondary" type="button" onclick="selectAllActionabilityRows_\(\)">Select All Returned/, "Select All Returned must use secondary operator control semantics");
assert.match(functionSource("selectAllActionabilityRows_"), /All returned READY rows selected for Applicant Action: /, "Applicant Action Select All message must explicitly describe returned READY rows");
assert.match(functionSource("selectAllActionabilityRows_"), /eligible now\./, "Applicant Action Select All message must retain full eligible-now context");
assert.match(adminUi, /class="btn small operatorControl operatorControlSecondary" type="button" onclick="clearActionabilitySelection_\(\)"[\s\S]*disabled/, "Clear Selection must use disabled secondary semantics when nothing is selected");
assert.match(adminUi, /class="btn small operatorControl operatorControlBatch" type="button" onclick="actionabilityBatchCommunication_\(\)"[\s\S]*>Batch Communication<\/button>/, "Batch Communication must use batch operator control semantics");
assert.match(adminUi, /class="btn small operatorControl operatorControlBatch" type="button" onclick="actionabilityBatchReminder_\(\)"[\s\S]*>Batch Reminder<\/button>/, "Batch Reminder must use batch operator control semantics");
assert.match(adminUi, /class="btn small operatorControl operatorControlBatch" type="button" onclick="exportActionabilitySelection_\(\)"[\s\S]*>Batch Export<\/button>/, "Batch Export must use batch operator control semantics");
assert.match(adminUi, /class="actionabilityBucketReviewBtn operatorControl operatorControlSecondary"[\s\S]*>Show Worklist<\/button>/, "Show Worklist must use secondary operator control semantics");
assert.match(adminUi, /class="btn actionabilityReviewBtn operatorControl operatorControlPrimary"[\s\S]*>Review<\/button>/, "Row Review must use primary operator control semantics");
assert.match(functionSource("setReviewButtonLoading_"), /classList\.add\("operatorControlBusy"\)[\s\S]*setAttribute\("aria-busy", "true"\)[\s\S]*btn\.disabled = true/, "Review loading must be busy and disabled to prevent double-submit");
assert.match(functionSource("setReviewButtonLoading_"), /classList\.remove\("operatorControlBusy"\)[\s\S]*removeAttribute\("aria-busy"\)/, "Review loading state must be cleared after detail load");
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
  ["due", "Priority / Next"]
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
["Today", "Last 7 Days", "Month-to-Date", "Previous Month", "Failed", "Suppressed / Bounced", "Last Successful Send", "Latest SENT Applicants"].forEach((label) => {
  assert.match(adminUi, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Communications Activity must include ${label}`);
});
["Permanent Bounces", "Temporary Bounces", "Bounce Rate", "Last Bounce", "Successful Deliveries"].forEach((label) => {
  assert.match(adminUi, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `Communications Activity must support reconciled delivery metric ${label}`);
});
assert.match(adminJs, /Source: Communications Ledger - latest row state only/, "Communications Activity must label latest-row source limitations");
assert.match(adminJs, /sourceType:\s*"communications_ledger_latest_row_state"/, "Communications Activity must expose a single communications ledger source type");
assert.match(adminJs, /authorityName:\s*"Communications Ledger"/, "Communications Activity must name the communications ledger authority");
assert.match(adminUi, /What Work Remains/, "Operations Workspace must explain what work remains after communications");
assert.doesNotMatch(adminUi, /Why Work Remains/, "Operations Workspace must not use ambiguous Why Work Remains wording");
assert.match(adminUi, /Communication Progress/, "Worklist details must expose communication progress without internal diagnostics");
assert.match(adminJs, /Mailbox bounces affect reliability metrics only after deterministic runtime reconciliation/, "Communications Activity must disclose that mailbox bounces require runtime reconciliation before dashboard use");
assert.match(adminJs, /cumulativeLabel:\s*"Current applicants with latest status SENT"/, "Snapshot SENT metric must be labelled as row-latest proxy when no true ledger exists");
assert.doesNotMatch(adminUi, /Cumulative Emails Sent|Lifetime|Emails Ever Sent/, "Communications Activity must not imply historical send accounting without a true ledger");
assert.match(adminJs, /deliveryHealth:\s*\{[\s\S]*Source: reconciled runtime delivery health/, "Communications Activity must define runtime delivery-health metrics separately from Gmail");
assert.match(adminUi, /delivery\.available === true/, "Reconciled delivery metrics must only render when runtime evidence exists");
assert.doesNotMatch(adminJs, /GmailApp\.search[\s\S]*communicationsActivity/, "Communications Activity metrics must not query Gmail directly");
assert.match(adminUi, /cumulativeIsHistorical === true/, "UI must distinguish historical cumulative sends from latest-row proxy counts");
assert.doesNotMatch(adminUi, /admin_sendCommunicationsActivity|admin_updateCommunicationsActivity|admin_createCommunicationsLedger/, "Communications Activity surface must not add mutation RPCs");
assert.match(adminUi, /function actionabilityManagementExceptionBreakdown_/, "Management Exceptions must expose a scoped breakdown when visible rows support it");
assert.match(adminUi, /Visible breakdown: Uncontactable/, "Management Exceptions breakdown must be labelled as visible-row derived");
assert.match(adminUi, /function actionabilityContactabilityExceptionBreakdown_/, "Contactability Exceptions must expose a scoped breakdown");
assert.match(adminUi, /Visible breakdown: No effective email/, "Contactability Exceptions breakdown must explain contactability failure types");
assert.match(adminUi, /class="actionabilitySortBtn' \+ \(active \? ' active' : ''\)/, "Grouped worklist headers must render active sort state");
assert.match(adminUi, /aria-pressed="' \+ \(active \? "true" : "false"\)/, "Grouped worklist sort controls must expose active state accessibly");
assert.match(adminUi, /class="actionabilitySortBtn' \+ \(active \? ' active' : ''\)[\s\S]*esc\(label \+ actionabilitySortLabel_\(key\)\)/, "Grouped worklist headers must render separated sort button labels");
assert.match(adminUi, /\.actionabilitySortBtn\{[^}]*border:1px solid #9fb4ca[^}]*text-transform:none/s, "Grouped worklist headers must avoid merged-looking uppercase labels");
assert.match(adminUi, /\.actionabilitySortBtn\.active\{[^}]*background:#eef6ff[^}]*color:#0f3f78/s, "Active worklist controls must be visibly active");
assert.match(adminJs, /function admin_getPopulationLedger/, "Population Ledger RPC must exist as a read-only authority foundation");
assert.match(adminJs, /function buildPopulationLedgerFromValues_/, "Population Ledger must be reusable by dashboard and lifecycle consumers");
assert.match(adminJs, /contactabilityState: isUncontactable \? "UNCONTACTABLE"/, "Actionability payload must classify no-email/no-phone applicants as uncontactable");
assert.match(adminUi, /return "Uncontactable"/, "Dashboard priority language must show Uncontactable");
assert.match(adminUi, /function actionabilityUrgencyProvenance_/, "Dashboard must expose compact urgency provenance");
assert.match(adminUi, /return "Blocked by contactability"/, "Urgency provenance must distinguish contactability blocks");
assert.match(adminUi, /return "Stale 21\+ days"/, "Urgency provenance must distinguish stale urgent work");
assert.match(adminUi, /return "Contact details required"/, "Dashboard due language must replace urgent due text for uncontactable applicants");
assert.match(adminUi, /return "No email, no phone"/, "Dashboard blocker must show no-email/no-phone facts");
assert.match(adminUi, /return "Contactability Exception"/, "Dashboard authority must show Contactability Exception for contactability failures");
assert.match(adminJs, /return "CONTACTABILITY";/, "Server-side bucket routing must promote contactability suppressors into a first-class CONTACTABILITY group");
assert.match(adminUi, /function actionabilityIsEmailActionable_/, "Dashboard must gate worklist email actions before presenting batch communication");
assert.match(adminUi, /NO_EFFECTIVE_EMAIL[\s\S]*EMAIL_BLOCKED_OR_BOUNCED/, "Dashboard email actionability must reject no-email and bounced/blocked suppressors");
assert.match(adminUi, /function actionabilityContactGuidance_/, "Dashboard must expose operator contactability guidance");
assert.match(adminUi, /No usable email or phone\. Route to Contactability Gate\./, "No-contact rows must route operators to Contactability Gate");
assert.match(adminUi, /function actionabilityBucketDisplayLabel_/, "Dashboard rows must support contactability-specific bucket display");
assert.match(adminUi, /return "Contactability Exceptions"/, "Contactability rows must render under a first-class Contactability Exceptions bucket");
assert.match(adminUi, /function actionabilityDocumentCompletenessLabel_/, "Worklist must render document completeness evidence");
assert.match(adminUi, /All Required Missing/, "Document completeness must distinguish no uploads");
assert.match(adminUi, /Required Uploaded - Review/, "Document completeness must distinguish uploaded-but-unverified records");
assert.match(adminUi, /Required Complete/, "Document completeness must distinguish complete records");
assert.match(adminUi, /function actionabilityHiddenExplanation_/, "Bucket table must explain hidden population records");
assert.match(adminJs, /function buildActionabilityHiddenRecords_/, "Actionability preview must expose bounded hidden record DTOs");
assert.match(adminJs, /hiddenRecords:\s*\{ perBucketLimit: 5, byGroup: \{\}, totalByGroup: \{\} \}/, "Actionability preview must initialize hiddenRecords DTO");
assert.match(adminJs, /out\.hiddenRecords = buildActionabilityHiddenRecords_/, "Actionability preview must populate hiddenRecords from the full read-only row set");
assert.match(adminUi, /function actionabilityHiddenPanel_/, "Bucket table must render hidden record drill-down");
assert.doesNotMatch(adminUi, /Show Hidden:/, "Hidden drill-down must not render old full-width Show Hidden rows");
assert.match(adminUi, /Showing ' \+ esc\(records\.length\) \+ ' of ' \+ esc\(boundedTotal \|\| hiddenCount\) \+ ' hidden in /, "Hidden drill-down must explicitly reconcile displayed and total hidden rows");
assert.match(adminUi, /function actionabilityHiddenBreakdown_/, "Bucket cards must structure hidden reason breakdowns");
assert.match(adminUi, /Applicant ID unavailable/, "Hidden drill-down must expose bounded applicant identity fallback");
assert.match(adminUi, /reviewActionabilityHiddenRecord_/, "Hidden records must be openable in Review Workspace");
assert.match(functionSource("reviewActionabilityHiddenRecord_"), /actionabilityHiddenRecordsState[\s\S]*byGroup\[groupKey\][\s\S]*reviewActionabilityRecord_\(records\[Number\(index\)\]/, "Hidden Review must open the selected hidden record only");
assert.match(adminUi, /hidden by worklist window, completion state, or another authority path/, "Hidden population explanation must name why records are not visible");
assert.doesNotMatch(renderActionabilityRowBody_(), /View Hidden|Show Hidden:/, "Bucket cards must not duplicate old View Hidden / Show Hidden language");
assert.match(adminUi, /Explain/, "Bucket action must explain buckets with population but no visible rows");
assert.match(adminUi, /Priority \/ Next/, "Timing column must honestly describe priority/next-action sorting");
assert.match(adminUi, /Urgency: ' \+ esc\(actionabilityUrgencyProvenance_\(r\)\)/, "Worklist timeline must render compact urgency provenance in-row");
assert.doesNotMatch(adminUi, /Due \/ Next/, "Timing column must not imply a due-date scheduler when none exists");
assert.match(adminUi, /function commContactabilityGate_/, "Review modal must treat Contactability Gate as a first-class workflow state");
assert.match(adminUi, /Email workflow unavailable/, "Contactability Gate must suppress normal email template workflow");
assert.match(adminUi, /Email preview disabled by Contactability Gate/, "Contactability Gate must visibly disable email preview");
assert.match(adminUi, /btnCommGenerateEditable[\s\S]*contactGate\.active/, "Generate / Preview Email must be disabled by Contactability Gate with visible label");
assert.match(adminUi, /btnCommInsertPortalLink[\s\S]*contactGate\.active/, "Insert Portal Link must be disabled by Contactability Gate with visible label");
assert.match(adminUi, /btnCommSendEdited[\s\S]*contactGate\.active/, "Send edited email must be disabled by Contactability Gate with visible label");
assert.match(adminUi, /function actionabilityMissingDocumentsDetail_/, "Expanded worklist details must name missing documents");
assert.match(adminUi, /Missing Documents:<\/strong>/, "Expanded worklist details must include missing document names");

console.log("PASS Operations Workspace is primary above Review Queues");
console.log("PASS Operations Workspace role wording, compatibility Review Queues, and Global View shell are present");
console.log("PASS ledger bar and operational bucket table replace card-heavy KPI/group surfaces");
console.log("PASS experimental/internal/contactability codes remain hidden from dashboard rows");
console.log("PASS dashboard Review action keeps existing modal entry from rendered rows");
console.log("PASS Current Worklist context menu exposes safe read-only actions only");
console.log("PASS dashboard Review focus context is request-bound and cleared on stale paths");
console.log("PASS no-contact applicants render Uncontactable / Contactability Gate language");
