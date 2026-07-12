const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("F:/Playwright/fode-secure-link-diagnostic/node_modules/playwright");

const repo = path.resolve(__dirname, "..", "..");
const evidence = path.join(__dirname, "evidence", "runtime-surface");
const operatorNext = fs.readFileSync(path.join(repo, "AdminUI_OperatorNext.html"), "utf8");
const adminUi = fs.readFileSync(path.join(repo, "AdminUI.html"), "utf8");

function extractBalancedDiv(source, id) {
  const start = source.indexOf(`<div id="${id}"`);
  if (start < 0) throw new Error(`Missing ${id}`);
  const tokens = /<div\b|<\/div>/gi;
  tokens.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = tokens.exec(source))) {
    if (/^<div/i.test(match[0])) depth += 1;
    else depth -= 1;
    if (depth === 0) return source.slice(start, tokens.lastIndex);
  }
  throw new Error(`Unbalanced ${id}`);
}

function stripAppsScriptTemplates(source) {
  return source.replace(/<\?[\s\S]*?\?>/g, "");
}

const adminStyles = Array.from(adminUi.matchAll(/<style\b[^>]*>([\s\S]*?)<\/style>/gi), (match) => match[1]).join("\n");
const batchModal = extractBalancedDiv(adminUi, "standaloneBatchCommModalBack");
const reviewModal = extractBalancedDiv(adminUi, "modalBack");

const fixture = {
  ok: true,
  rows: [
    { rowNumber: 2959, applicantId: "FODE-26-002959", name: "Keziah Waffi", workloadGroupKey: "FINANCE", worklistKey: "PAYMENT_FOLLOW_UP", worklistLabel: "Payment Follow-up", worklistReason: "Awaiting payment evidence", nextAction: "SEND_PAYMENT_REMINDER", actionOwner: "APPLICANT", actionabilityState: "READY", selectable: true, recommendedMessageType: "payment_followup", ageDays: 31, communicationProgress: "Eligible for batch preview", canonicalLifecycle: { baseState: "PAYMENT_PENDING", overlays: [] }, authorityState: { portalSubmitted: true } },
    { rowNumber: 9003, applicantId: "FODE-26-TEST-003", name: "Finance Test Applicant", workloadGroupKey: "FINANCE", worklistKey: "PAYMENT_REVIEW", worklistLabel: "Payment Review", worklistReason: "Receipt pending verification", nextAction: "VERIFY_PAYMENT", actionOwner: "OFFICER", actionabilityState: "REVIEW_REQUIRED", selectable: false, selectBlockReason: "Payment verification requires an authorised reviewer.", recommendedMessageType: "", ageDays: 4, canonicalLifecycle: { baseState: "PAYMENT_TO_VERIFY", overlays: [] }, authorityState: { portalSubmitted: true } },
    { rowNumber: 3230, applicantId: "FODE-26-003230", name: "Stephanie Duba", workloadGroupKey: "APPLICANT", worklistKey: "MISSING_DOCUMENTS", worklistLabel: "Missing Documents", worklistReason: "Required documents are incomplete", nextAction: "UPLOAD_REQUIRED_DOCUMENTS", actionOwner: "APPLICANT", actionabilityState: "READY", selectable: true, recommendedMessageType: "docs_missing", ageDays: 18, communicationProgress: "Eligible for batch preview", canonicalLifecycle: { baseState: "INCOMPLETE_DOCUMENTS", overlays: ["REMINDER_DUE"] }, authorityState: { portalSubmitted: true } },
    { rowNumber: 3301, applicantId: "FODE-26-003301", name: "Document Review Applicant", workloadGroupKey: "ADMISSIONS", worklistKey: "DOCUMENT_REVIEW", worklistLabel: "Document Review", worklistReason: "Uploaded evidence requires verification", nextAction: "VERIFY_DOCUMENTS", actionOwner: "OFFICER", actionabilityState: "REVIEW_REQUIRED", selectable: false, selectBlockReason: "Officer review required.", ageDays: 8, canonicalLifecycle: { baseState: "DOCUMENTS_TO_VERIFY", overlays: [] } },
    { rowNumber: 3302, applicantId: "FODE-26-003302", name: "Correction Applicant", workloadGroupKey: "ADMISSIONS", worklistKey: "DOCUMENT_CORRECTION", worklistLabel: "Document Correction", worklistReason: "Rejected evidence requires correction", nextAction: "CORRECT_DOCUMENTS", actionOwner: "APPLICANT", actionabilityState: "AWAITING_APPLICANT", selectable: false, selectBlockReason: "Awaiting corrected document evidence.", ageDays: 10, canonicalLifecycle: { baseState: "DOCUMENT_CORRECTION_REQUIRED", overlays: ["AWAITING_APPLICANT"] } },
    { rowNumber: 3303, applicantId: "FODE-26-003303", name: "Cooling Off Applicant", workloadGroupKey: "APPLICANT", worklistKey: "MISSING_DOCUMENTS", worklistLabel: "Missing Documents", worklistReason: "Recently contacted", nextAction: "UPLOAD_REQUIRED_DOCUMENTS", actionOwner: "APPLICANT", actionabilityState: "COOLING_OFF", selectable: false, selectBlockReason: "Cooling-off active until 16 July 2026.", recommendedMessageType: "docs_missing", ageDays: 14, canonicalLifecycle: { baseState: "INCOMPLETE_DOCUMENTS", overlays: ["COOLING_OFF"] } },
    { rowNumber: 3304, applicantId: "FODE-26-003304", name: "Contactability Applicant", workloadGroupKey: "CONTACTABILITY", worklistKey: "CONTACTABILITY_EXCEPTION", worklistLabel: "Contactability Exception", worklistReason: "No effective email", nextAction: "FIX_CONTACT_DETAILS", actionOwner: "APPLICANT", actionabilityState: "REVIEW_REQUIRED", selectable: false, selectBlockReason: "No effective email address.", suppressor: "NO_EFFECTIVE_EMAIL", ageDays: 22, canonicalLifecycle: { baseState: "INCOMPLETE_DOCUMENTS", overlays: ["CONTACT_BLOCKED"] } },
    { rowNumber: 3305, applicantId: "FODE-26-003305", name: "Handover Applicant", workloadGroupKey: "ACADEMIC", worklistKey: "ACADEMIC_ONBOARDING", worklistLabel: "Academic Onboarding", worklistReason: "Ready for handover", nextAction: "PREPARE_ENROLMENT", actionOwner: "OFFICER", actionabilityState: "REVIEW_REQUIRED", selectable: false, ageDays: 2, canonicalLifecycle: { baseState: "ENROLMENT_READY", overlays: [] } },
    { rowNumber: 3306, applicantId: "FODE-26-003306", name: "Management Exception", workloadGroupKey: "MANAGEMENT", worklistKey: "POLICY_EXCEPTION", worklistLabel: "Policy Exception", worklistReason: "Authority contradiction requires escalation", nextAction: "MANAGEMENT_REVIEW", actionOwner: "ADMIN", actionabilityState: "REVIEW_REQUIRED", selectable: false, selectBlockReason: "Management decision required.", ageDays: 40, canonicalLifecycle: { baseState: "UNKNOWN", overlays: ["SLA_OVERDUE"] } },
    { rowNumber: 3307, applicantId: "FODE-26-003307", name: "Portal Intake Applicant", workloadGroupKey: "APPLICANT", worklistKey: "PORTAL_ACCESS", worklistLabel: "Portal Access", worklistReason: "Applicant has not continued", nextAction: "SEND_PORTAL_ACCESS", actionOwner: "APPLICANT", actionabilityState: "READY", selectable: true, recommendedMessageType: "legacy_invite", ageDays: 7, canonicalLifecycle: { baseState: "AWAITING_PORTAL_OR_INTAKE", overlays: [] }, authorityState: { portalSubmitted: false } }
  ],
  populationLedger: { applicantIdRows: 253, integrityStatus: "PASS" },
  workloadSummary: { READY: 96, COOLING_OFF: 157, AWAITING_APPLICANT: 1, AWAITING_PAYMENT: 0, REVIEW_REQUIRED: 5, COMPLETE: 10, UNKNOWN: 1 },
  lifecycleDriftSummary: { mismatchCount: 2 },
  bucketSummaries: {
    APPLICANT: { populationTotal: 253, eligibleNow: 96, coolingOff: 157, hidden: 65 },
    FINANCE: { populationTotal: 27, eligibleNow: 12, coolingOff: 15, hidden: 0 }
  },
  hiddenRecords: { byGroup: { APPLICANT: [{ applicantId: "FODE-26-HIDDEN", name: "Hidden Integrity Record", actionabilityState: "UNKNOWN", selectBlockReason: "Outside current bounded window." }] }, totalByGroup: { APPLICANT: 65, FINANCE: 0 } }
};

const bootstrap = `
<script>
var INITIAL_ADMIN_VIEW='operator-next';
var USER_EMAIL='principal@kundu.ac';
var ADMIN_ROLE='OPERATIONS';
var WEBAPP_URL='https://example.invalid/exec';
var ADMIN_CAPABILITIES={capabilities:{CAN_OPEN_REVIEW_WORKSPACE:true,CAN_REVIEW_DOCUMENTS:true,CAN_SAVE_DOCUMENT_STATUSES:true,CAN_PREVIEW_APPLICANT_COMMUNICATION:true,CAN_SEND_INDIVIDUAL_EMAIL:true,CAN_INSERT_PORTAL_LINK:true,CAN_GENERATE_STANDARD_QUOTE:true,CAN_GENERATE_STANDARD_INVOICE:true,CAN_RUN_BATCH_COMMUNICATIONS:true,CAN_VERIFY_PAYMENT:false,CAN_OVERRIDE_COOLDOWN:false,CAN_MANAGE_PORTAL_ACCESS:false,CAN_WRITE_ZOHO_BOOKS:false,CAN_ADMINISTER_RUNTIME:false,CAN_DEPLOY_RUNTIME:false}};
var actionabilitySelectedKeys={},actionabilityPreviewRows=[],actionabilityCurrentCohortRows=[],actionabilityRenderedRows=[],actionabilitySelectionSource='';
var __fixture=${JSON.stringify(fixture)};
function esc(value){return String(value==null?'':value).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
function actionabilityRowKey_(row){return String(row&&row.applicantId||'');}
function actionabilityIsSelectable_(row){return !!(row&&row.selectable===true);}
function loadActionabilityPreview_(){setTimeout(function(){operatorNextReceiveActionability_(__fixture);},30);}
var __runner={_success:null,withSuccessHandler:function(fn){this._success=fn;return this;},withFailureHandler:function(){return this;},_done:function(value){var fn=this._success;this._success=null;setTimeout(function(){if(fn)fn(value);},20);return this;},admin_getRuntimeInfo:function(){return this._done({ok:true,version:'r339',deployVersion:339,mismatch:false});},admin_getOperationalDashboardMetrics:function(){return this._done({formsReceivedToday:12,openLifecycleRows:71,awaitingDocuments:69,paymentPending:27,rowLoggedCommunicationsToday:30,queueBacklog:31,emailStates:{SENT:412,FAILED:3,BOUNCED:7}});},admin_getOperationalSafetyStatus:function(){return this._done({gates:{manualSendEnabled:true,batchSendEnabled:true,perRunCap:30},runtime:{version:'r339',deployVersion:339}});},admin_getOpsLifecycleSummary:function(){return this._done({counts:{fd_received:14,portal:21,docs:69,uploaded_review_required:18,payment:27,invoice:6,enrolment:8,classroom:61,exceptions:4,email_issue:9,dropped_ineligible:16}});}};
var google={script:{run:__runner}};
function setText(id,value){var el=document.getElementById(id);if(el)el.textContent=value;}
function review(rowNumber,applicantId){var row=__fixture.rows.filter(function(item){return item.applicantId===applicantId;})[0]||{};var back=document.getElementById('modalBack');if(!back)return;back.style.display='flex';setText('mApplicantName',row.name||'Applicant');setText('mApplicantId',applicantId);setText('mHeaderEmail','parent@example.com');setText('mHeaderPhone','+675 7000 0000');setText('mHeaderSubmitted',row.authorityState&&row.authorityState.portalSubmitted?'Yes':'No');setText('mHeaderStage',String(row.canonicalLifecycle&&row.canonicalLifecycle.baseState||'UNKNOWN').replace(/_/g,' '));setText('mHeaderOwner',row.actionOwner||'UNKNOWN');setText('mHeaderDeliveryHealth','Contact ok');setText('mHeaderTokenAge','LAP D3');setText('mPayment',row.worklistKey==='PAYMENT_FOLLOW_UP'?'Awaiting Payment Evidence':'Pending');var banner=document.getElementById('reviewLoadingBanner');if(banner)banner.style.display='none';var grid=document.querySelector('.reviewHeaderGrid');if(grid)grid.classList.remove('loading');setText('commApplicantId',applicantId);setText('commEffectiveEmail','parent@example.com');setText('commEmailStatus','READY');setText('commNextActionDate','Eligible now');var type=document.getElementById('commMessageType');if(type)type.value=row.recommendedMessageType||'custom_email';var recommendation=document.getElementById('commTemplateRecommendation');if(recommendation)recommendation.innerHTML='<strong>Recommended:</strong> '+esc(row.recommendedMessageType||'No automatic communication');var gallery=document.getElementById('commTemplateGallery');if(gallery)gallery.innerHTML='<button class="commTemplateCard recommended selected"><strong>'+esc(row.recommendedMessageType||'Manual review')+'</strong><span>Recommended by canonical Actionability projection</span></button><button class="commTemplateCard"><strong>Custom Email</strong><span>Other option</span></button>';var editable=document.getElementById('commEditablePanel');if(editable)editable.classList.remove('hidden');var recipient=document.getElementById('commRecipient');if(recipient)recipient.value='parent@example.com';var subject=document.getElementById('commSubject');if(subject)subject.value=row.recommendedMessageType==='payment_followup'?'FODE KIA Application - Payment Follow-Up':'FODE KIA Application - Missing Documents';var body=document.getElementById('commBody');if(body)body.value='Dear Parent/Guardian,\\n\\nThis is the reviewed applicant communication preview.\\n\\nRegards,\\nFODE Admissions';var states=document.getElementById('reviewCommStatePanel');if(states)states.innerHTML='<div class="reviewCommStateRow"><strong>Generate / Preview Email</strong><span class="reviewCommStateBadge ready">READY</span><span>Reason: Ready to generate preview.</span></div><div class="reviewCommStateRow"><strong>Insert Portal Link</strong><span class="reviewCommStateBadge ready">READY</span><span>Reason: Portal link available.</span></div><div class="reviewCommStateRow"><strong>Send Edited Email</strong><span class="reviewCommStateBadge blocked">BLOCKED</span><span>Reason: Generate preview first.</span></div>';var docs=document.getElementById('docs');if(docs)docs.innerHTML='<div class="docCard"><strong>Birth ID / Passport</strong><span class="status ok">Verified</span></div><div class="docCard"><strong>Latest School Report</strong><span class="status warn">Pending review</span></div>';var secret=document.getElementById('booksSecretSetupPanel');if(secret)secret.style.display='none';}
function closeModal(){var back=document.getElementById('modalBack');if(back)back.style.display='none';}
function openBatchCommunicationFromSelection_(){var rows=Object.keys(actionabilitySelectedKeys);var back=document.getElementById('standaloneBatchCommModalBack');back.classList.add('open');back.style.display='flex';setText('standaloneBatchCommSource','Source: Selected '+rows.length+' Applicants');var ready=document.getElementById('standaloneBatchCommReadiness');ready.innerHTML='<strong>Ready to Send</strong><span>Authority: CANONICAL_LIFECYCLE</span>';var gallery=document.getElementById('standaloneBatchCommTemplateGallery');gallery.innerHTML='<button class="commTemplateCard recommended selected"><strong>Missing Documents Follow-Up</strong><span>Recommended</span></button><button class="commTemplateCard"><strong>Payment Follow-Up</strong><span>Other option</span></button>';var summary=document.getElementById('standaloneBatchCommSummary');summary.innerHTML='<div class="batchCommSummaryGrid"><div class="batchCommSummaryItem"><strong>Selected total</strong><span>'+rows.length+'</span></div><div class="batchCommSummaryItem"><strong>Preview/send cap</strong><span>30</span></div><div class="batchCommSummaryItem"><strong>Will send this run</strong><span>'+rows.length+'</span></div><div class="batchCommSummaryItem"><strong>Remaining after cap</strong><span>0</span></div></div>';var preview=document.getElementById('standaloneBatchCommPreview');preview.innerHTML='<strong>Subject</strong><p>FODE KIA Application - Missing Documents</p><strong>Body</strong><p>Reviewed template preview for selected applicants.</p><strong>Recipient count</strong><p>'+rows.length+'</p>';var recipients=document.getElementById('standaloneBatchCommRecipients');recipients.innerHTML=rows.map(function(id){return '<div class="batchCommRecipient"><strong>'+esc(id)+'</strong><span>Included · valid email</span></div>';}).join('');}
function closeBatchCommunicationModal_(){var back=document.getElementById('standaloneBatchCommModalBack');if(back){back.classList.remove('open');back.style.display='none';}}
document.getElementById('operatorNextShell').classList.add('active');
operatorNextInit_();
</script>`;

const pageHtml = `<!doctype html><html><head><meta charset="utf-8"><style>${stripAppsScriptTemplates(adminStyles)}</style></head><body>${operatorNext}${stripAppsScriptTemplates(batchModal)}${stripAppsScriptTemplates(reviewModal)}${bootstrap}</body></html>`;

async function activateRoute(page, route) {
  const started = Date.now();
  await page.locator(`#onxNav [data-onx-route="${route}"]`).click();
  await page.locator(`#onxRoute-${route}.active`).waitFor();
  return Date.now() - started;
}

(async () => {
  fs.mkdirSync(evidence, { recursive: true });
  const browser = await chromium.launch({ headless: true });
  const timings = {};

  const wide = await browser.newPage({ viewport: { width: 1600, height: 1000 } });
  wide.setDefaultTimeout(7000);
  const hydrationStarted = Date.now();
  await wide.setContent(pageHtml, { waitUntil: "load" });
  await wide.waitForFunction(() => document.querySelector("#onxPriorityTitle")?.textContent.includes("returned applicants"));
  timings.initialHydrationMs = Date.now() - hydrationStarted;
  await wide.locator('[data-onx-stage="INCOMPLETE_DOCUMENTS"]').click();
  await wide.screenshot({ path: path.join(evidence, "01-wide-lifecycle-map.png"), fullPage: true });
  await wide.waitForFunction(() => {
    const btn = document.querySelector("#onxGlobalScope");
    const note = document.querySelector("#onxScopeNote");
    return !!btn && btn.disabled === true && /canonical summary pending/i.test(btn.textContent || "") && !!note && /Working View remains authoritative/i.test(note.textContent || "");
  });
  await wide.evaluate(() => {
    if (typeof window.operatorNextShowGlobalCompatibility_ === "function") {
      window.operatorNextShowGlobalCompatibility_();
    }
  });
  await wide.waitForFunction(() => document.querySelector("#onxScopePill")?.textContent.includes("Working Canonical View"));
  await wide.screenshot({ path: path.join(evidence, "01b-wide-global-view-contained.png"), fullPage: true });
  await wide.locator("#onxWorkingScope").click();
  timings.dashboardRouteMs = await activateRoute(wide, "dashboard");
  await wide.screenshot({ path: path.join(evidence, "02-wide-operational-dashboard.png"), fullPage: true });
  timings.reportsRouteMs = await activateRoute(wide, "reports");
  await wide.screenshot({ path: path.join(evidence, "03-wide-reports-audit.png"), fullPage: true });

  const laptop = await browser.newPage({ viewport: { width: 1180, height: 900 } });
  laptop.setDefaultTimeout(7000);
  await laptop.setContent(pageHtml, { waitUntil: "load" });
  await laptop.waitForFunction(() => document.querySelector("#onxPriorityTitle")?.textContent.includes("returned applicants"));
  timings.financeRouteMs = await activateRoute(laptop, "finance");
  await laptop.screenshot({ path: path.join(evidence, "04-laptop-finance.png"), fullPage: true });
  await laptop.locator('#onxPaymentFollowup [data-onx-compact-review="FODE-26-002959"]').click();
  await laptop.locator("#modalBack").waitFor({ state: "visible" });
  await laptop.screenshot({ path: path.join(evidence, "05-laptop-review-workspace.png") });
  await laptop.locator("#communicationsCard").scrollIntoViewIfNeeded();
  await laptop.screenshot({ path: path.join(evidence, "06-laptop-review-communications.png") });
  await laptop.evaluate(() => closeModal());
  timings.communicationsRouteMs = await activateRoute(laptop, "communications");
  await laptop.screenshot({ path: path.join(evidence, "07-laptop-communications.png"), fullPage: true });
  timings.healthRouteMs = await activateRoute(laptop, "health");
  await laptop.waitForTimeout(40);
  await laptop.screenshot({ path: path.join(evidence, "08-laptop-system-health.png"), fullPage: true });
  await activateRoute(laptop, "applicant");
  await laptop.locator('#onxApplicantQueue tr[data-onx-row-index="0"]').click({ button: "right" });
  await laptop.locator("#onxContextMenu.open").waitFor();
  await laptop.screenshot({ path: path.join(evidence, "09-laptop-context-menu.png") });
  await activateRoute(laptop, "contactability");
  await laptop.screenshot({ path: path.join(evidence, "10-laptop-contactability-vcf-boundary.png"), fullPage: true });

  const narrow = await browser.newPage({ viewport: { width: 760, height: 1000 } });
  narrow.setDefaultTimeout(7000);
  await narrow.setContent(pageHtml, { waitUntil: "load" });
  await narrow.waitForFunction(() => document.querySelector("#onxPriorityTitle")?.textContent.includes("returned applicants"));
  await activateRoute(narrow, "applicant");
  await narrow.locator('#onxApplicantQueue [data-onx-select-all="applicant"]').click();
  await narrow.locator("#onxApplicantQueue [data-onx-batch]").click();
  await narrow.locator("#standaloneBatchCommModalBack").waitFor({ state: "visible" });
  await narrow.screenshot({ path: path.join(evidence, "11-narrow-batch-communication.png") });

  await browser.close();
  const summary = {
    result: "PASS",
    source: "AdminUI_OperatorNext.html with real AdminUI Review/Batch modal markup",
    network: "none",
    mutation: "none",
    operatorNextBytes: Buffer.byteLength(operatorNext),
    timings,
    screenshots: fs.readdirSync(evidence).filter((name) => name.endsWith(".png")).sort()
  };
  fs.writeFileSync(path.join(evidence, "RUN_SUMMARY.json"), JSON.stringify(summary, null, 2));
  console.log(`PASS Operator Next runtime-surface visual evidence: ${evidence}`);
  console.log(JSON.stringify(summary, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
