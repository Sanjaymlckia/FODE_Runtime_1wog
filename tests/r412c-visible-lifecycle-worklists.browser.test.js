const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { playwrightModule } = require("../tools/fode-playwright-path");
const { chromium } = require(playwrightModule());

const adminSource = fs.readFileSync("AdminUI_OpsLifecycle.html", "utf8");
const eduopsComponents = fs.readFileSync("EduOps_ClientComponents.html", "utf8");

function extract(source, name) {
  const start = source.indexOf(`function ${name}`);
  assert.notEqual(start, -1, `${name} must exist`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (escaped) { escaped = false; continue; }
    if (quote && ch === "\\") { escaped = true; continue; }
    if (quote) { if (ch === quote) quote = ""; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth += 1;
    if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`${name} is not closed`);
}

const adminFunctions = [
  "opsReviewLifecycleDefinitions_", "opsReviewLifecycleBucketKey_", "opsRowsForReviewLifecycleBucket_",
  "opsReviewLifecycleCount_", "opsReviewLifecycleStageText_", "opsReviewLifecycleValue_",
  "opsReviewLifecycleRowsHtml_", "renderOpsReviewLifecycleWorklists_"
].map(name => extract(adminSource, name)).join("\n");
const eduopsFunctions = ["renderWorklists", "contextRibbonHtml", "rowDetailHtml"].map(name => extract(eduopsComponents, name)).join("\n");
const adminStyle = adminSource.match(/<style>([\s\S]*?)<\/style>/)[1];

const lifecycle = [
  ["DOCUMENTS_FOLLOW_UP", "Documents — review / follow-up"],
  ["DOCUMENTS_ASSESSMENT", "Documents received — assessment / verification required"],
  ["PENDING_APPLICANT_RESPONSE", "Pending applicant response"],
  ["HELD_ABEYANCE_NO_RESPONSE", "Held in abeyance — no response"],
  ["HELD_ABEYANCE_OTHER", "Held in abeyance — other reason"],
  ["WORKING_ON_IT", "Working on it"],
  ["READY_FOR_DECISION", "Ready for decision"],
  ["ADMITTED_ONBOARDING_OUTSTANDING", "Admitted — onboarding outstanding"],
  ["LOST_UNCONTACTABLE", "Lost / uncontactable"],
  ["DATA_INTEGRITY_EXCEPTION", "Data / integrity exception"],
  ["CLOSED_OUTCOME", "Closed outcomes"]
];
const rows = lifecycle.map((item, index) => ({
  applicantId: `FODE-R412C-${String(index + 1).padStart(2, "0")}`,
  name: `Lifecycle Fixture ${index + 1}`,
  reviewBucketKey: item[0], reviewBucketLabel: item[1],
  reviewRequirement: item[0] === "DOCUMENTS_FOLLOW_UP" ? "Passport copy" : "Canonical requirement",
  reviewReason: `Canonical evidence resolves this case to ${item[1]}.`,
  reviewWaitingOn: item[0] === "PENDING_APPLICANT_RESPONSE" ? "Applicant response" : "Admissions reviewer",
  reviewNextAction: item[0] === "LOST_UNCONTACTABLE" ? "Fix contact details" : "Review canonical evidence",
  reviewOwner: "Admissions officer", reviewDate: "12 Aug 2026",
  reviewReactivationCondition: "Matched evidence return",
  reviewLastMeaningfulActivity: "05 Aug 2026 09:30",
  reviewFollowupCount: item[0] === "HELD_ABEYANCE_NO_RESPONSE" ? 3 : 0,
  reviewCommunicationEvidenceAvailable: true,
  reviewSourceEvidence: "Canonical population fixture",
  contactabilityState: item[0] === "LOST_UNCONTACTABLE" ? "UNCONTACTABLE" : "CONTACTABLE",
  canonicalLifecycle: { lifecycleStage: item[0] === "CLOSED_OUTCOME" ? "CLOSED" : "INCOMPLETE_DOCUMENTS" }
}));
const counts = Object.fromEntries(lifecycle.map(item => [item[0], 1]));
const subtotals = Object.fromEntries(lifecycle.map(item => [item[0], { INCOMPLETE_DOCUMENTS: 1 }]));
const presentation = [{ code: "ALL_ACTIVE", label: "All active lifecycle work", count: 10, closed: false, stageSubtotals: [{ code: "INCOMPLETE_DOCUMENTS", count: 10 }] }]
  .concat(lifecycle.map(item => ({ code: item[0], label: item[1], count: 1, closed: item[0] === "CLOSED_OUTCOME", stageSubtotals: [{ code: "INCOMPLETE_DOCUMENTS", count: 1 }] })));

function htmlFixture() {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>
    *{box-sizing:border-box} body{margin:0;padding:16px;background:#eef3f8;color:#17324d;font:14px Arial,sans-serif} main{display:grid;gap:18px;max-width:1440px;margin:auto}.surface{padding:16px;background:#fff;border:1px solid #d8e3ed;border-radius:12px}.surface h1{margin:0 0 5px;font-size:22px}.surface>p{margin:0 0 12px;color:#60758b}.opsStatusPill{display:inline-block;padding:3px 7px;border-radius:999px;background:#e9f3ff}.opsPlaceholder{padding:14px;color:#60758b}.eduops-worklist-keys{display:grid;grid-template-columns:repeat(auto-fit,minmax(190px,1fr));gap:7px}.eduops-worklist-key{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:5px;padding:9px;border:1px solid #dce6ef;border-radius:8px;background:#fff;color:#17324d;text-align:left}.eduops-worklist-key[aria-selected=true]{background:#1f70ea;color:#fff}.eduops-worklist-key small{grid-column:1/-1}.eduops-key-count{font-size:18px;font-weight:900}.eduops-row-detail{margin-top:12px}.eduops-row-detail-grid,.eduops-definition-list{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:6px}.eduops-row-detail-grid div,.eduops-definition-list div{padding:7px;background:#f6f9fc;border-radius:5px}.eduops-row-detail span,.eduops-definition-list dt{display:block;color:#60758b;font-size:10px;text-transform:uppercase}.eduops-lifecycle-evidence{margin-top:8px;padding:8px;background:#f3f8fc;border:1px solid #dce6ef;border-radius:6px}.eduops-lifecycle-evidence h4{margin:0 0 6px}.eduops-operations-context-unavailable{display:none}
    ${adminStyle}
    @media(max-width:560px){body{padding:8px}.surface{padding:10px}.eduops-worklist-keys,.eduops-row-detail-grid,.eduops-definition-list{grid-template-columns:1fr}.opsReviewLifecycleDeck,.opsReviewLifecycleRow{grid-template-columns:1fr}.opsReviewLifecycleWhy{grid-column:1}}
  </style></head><body><main>
    <section class="surface" id="adminSurface"><h1>Admin · Applicant Lifecycle Worklists</h1><p>Canonical lifecycle buckets are the primary staff work-management view.</p><div id="opsReviewLifecycleBucketCards" class="opsReviewLifecycleDeck"></div><div id="opsReviewLifecycleSelection" class="opsReviewLifecycleSelection"></div><div id="opsReviewLifecycleRows" class="opsReviewLifecycleRows"></div></section>
    <section class="surface" id="eduopsSurface"><h1>EduOps · Canonical Lifecycle Worklists</h1><p>Select a lifecycle worklist; actionability remains execution context.</p><div id="eduopsWorklistKeys" class="eduops-worklist-keys"></div><div id="eduopsFixtureDetail"></div></section>
  </main><script>
    var fixtureRows=${JSON.stringify(rows)}; var queueDataState={reviewLifecycleCounts:${JSON.stringify(counts)},reviewLifecycleStageSubtotals:${JSON.stringify(subtotals)},hasMore:false};
    var opsSelectedReviewBucket="ALL_ACTIVE"; var opsActionState={queueFilter:""};
    function esc(value){return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
    function opsAllQueueRows_(){return fixtureRows} function renderOpsQueue_(){renderOpsReviewLifecycleWorklists_()} function opsScrollTo_(){} function opsSelectApplicantContext_(){}
    ${adminFunctions}
    var dom={eduopsWorklistKeys:document.getElementById("eduopsWorklistKeys")};
    var app={state:{reviewBucketKey:"ALL_ACTIVE"},esc:esc,formatCode:function(value){return String(value||"").replace(/_/g," ")},authorityLabel:function(){return "Authority context"},authorityUnavailable:function(label){return label+" unavailable"},displayRecipientEmail:function(value){return value||"No email"},formatPngDisplay:function(value,fallback){return value||fallback||""}};
    ${eduopsFunctions}
    renderOpsReviewLifecycleWorklists_();
    renderWorklists({lifecycleWorklists:${JSON.stringify(presentation)}});
    var eduopsRow={reviewLifecycle:{bucketLabel:"Documents — review / follow-up",requirement:"Passport copy",reason:"Passport copy is unresolved.",waitingOn:"Admissions reviewer",owner:"Admissions officer",reviewDate:"12 Aug 2026",reactivationCondition:"Matched evidence return",lastMeaningfulActivity:"05 Aug 2026 09:30",qualifyingCommunicationCount:0,sourceEvidence:"Canonical document evidence"},presentation:{},actionOwner:"Admissions officer",selectBlockReason:"Individual review required"};
    var op={missingDocumentNames:["Passport copy"],lifecycleLabel:"Incomplete documents",actionabilityLabel:"Review required",workPackageLabel:"Lifecycle review",primaryRouteLabel:"Admissions",lifecycleOwnerLabel:"Admissions officer",nextActionLabel:"Review evidence",reasonCode:"REVIEW_REQUIRED",documentLabel:"Incomplete",financeLabel:"Not applicable",contactabilityLabel:"Contactable",communicationLabel:"No send",selectionLabel:"Not selectable",authorityResultLabel:"Review required",authorityReason:"Individual review required"};
    document.getElementById("eduopsFixtureDetail").innerHTML=rowDetailHtml(eduopsRow,op,"Individual review required");
  </script></body></html>`;
}

(async () => {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
  await page.setContent(htmlFixture(), { waitUntil: "load" });
  assert.equal(await page.locator("#adminSurface .opsReviewLifecycleCard").count(), 12);
  assert.equal(await page.locator("#eduopsSurface [data-lifecycle-worklist]").count(), 12);
  await page.locator('#adminSurface [data-review-lifecycle-bucket="PENDING_APPLICANT_RESPONSE"]').click();
  assert.equal(await page.locator("#adminSurface .opsReviewLifecycleRow").count(), 1);
  assert.match(await page.locator("#opsReviewLifecycleSelection").innerText(), /Pending applicant response/);
  assert.match(await page.locator("#eduopsFixtureDetail").innerText(), /Why this is in this queue[\s\S]*Passport copy is unresolved/);
  fs.mkdirSync("test-results", { recursive: true });
  await page.screenshot({ path: path.resolve("test-results/r412c-lifecycle-worklists-desktop.png"), fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "390x844 must not introduce horizontal page overflow");
  assert.equal(await page.locator('#adminSurface [data-review-lifecycle-bucket="LOST_UNCONTACTABLE"]').isVisible(), true);
  assert.equal(await page.locator('#eduopsSurface [data-lifecycle-worklist="CLOSED_OUTCOME"]').isVisible(), true);
  await page.screenshot({ path: path.resolve("test-results/r412c-lifecycle-worklists-390x844.png"), fullPage: true });
  await browser.close();
  console.log("PASS R412C rendered lifecycle controls, selection, evidence disclosure, and 390x844 usability");
})().catch(error => { console.error(error); process.exitCode = 1; });
