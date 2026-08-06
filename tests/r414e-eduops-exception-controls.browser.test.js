const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { playwrightModule } = require("../tools/fode-playwright-path");
const { chromium } = require(playwrightModule());

const source = fs.readFileSync("EduOps_ClientComponents.html", "utf8");
const styles = fs.readFileSync("EduOps_Styles.html", "utf8") + fs.readFileSync("EduOps_OperationsWorkspaceStyles.html", "utf8");

function extract(name) {
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

const lifecycleWorklists = [
  { code:"DOCUMENTS_FOLLOW_UP", label:"Review / follow-up", count:9, stageKey:"DOCUMENTS" },
  { code:"DOCUMENTS_ASSESSMENT", label:"Assessment / verification", count:0, stageKey:"DOCUMENTS" },
  { code:"LOST_UNCONTACTABLE", label:"Lost / uncontactable", count:1, exception:true },
  { code:"DATA_INTEGRITY_EXCEPTION", label:"Data / integrity exception", count:1, exception:true },
  { code:"ALL_ACTIVE", label:"All active work", count:11, utility:true }
];
const lifecycleExceptions = [
  lifecycleWorklists[2], lifecycleWorklists[3], lifecycleWorklists[4],
  { code:"LEGACY_REVIEW_AGGREGATE", label:"Legacy Review aggregate", count:4, utility:true, secondary:true }
];
const admissionsStages = [{ code:"DOCUMENTS", label:"Documents", count:9, firstWorklistCode:"DOCUMENTS_FOLLOW_UP", worklistCodes:["DOCUMENTS_FOLLOW_UP", "DOCUMENTS_ASSESSMENT"] }];
const rows = Array.from({ length:9 }, (_, index) => ({ id:`DOC-${index + 1}`, bucket:"DOCUMENTS_FOLLOW_UP", legacy:index < 4 }))
  .concat([{ id:"LOST-1", bucket:"LOST_UNCONTACTABLE", legacy:false }, { id:"DATA-1", bucket:"DATA_INTEGRITY_EXCEPTION", legacy:false }]);

function fixture() {
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1">${styles}<style>
    body{margin:0}.r414e-shell{padding:12px}.r414e-results{display:grid;gap:4px;margin-top:10px}.r414e-row{padding:7px;background:#fff;border:1px solid #dce6ef}
  </style></head><body class="eduops-body"><main class="eduops-operations-layout r414e-shell">
    <section id="eduopsWorklist" class="eduops-workspace" data-eduops-layout-region="worklist">
      <div class="eduops-worklist-key-band" data-eduops-layout-region="work-type">
        <div id="eduopsAdmissionsPopulationSummary" class="eduops-admissions-population"></div>
        <div id="eduopsAdmissionsStages" class="eduops-admissions-stage-strip" role="tablist" aria-label="Admissions stages"></div>
        <div class="eduops-admissions-hierarchy">
          <section class="eduops-admissions-worklists" aria-labelledby="worklistsHeading"><span id="worklistsHeading" class="eduops-band-label">Precise worklists</span><div id="eduopsWorklistKeys" class="eduops-worklist-keys" role="tablist"></div></section>
          <aside class="eduops-admissions-exceptions" aria-labelledby="exceptionsHeading"><span id="exceptionsHeading" class="eduops-band-label">Exceptions and utilities</span><div id="eduopsLifecycleExceptions" class="eduops-lifecycle-exception-links"></div></aside>
        </div>
      </div>
      <div id="centralList" class="r414e-results" aria-live="polite"></div>
    </section>
  </main><script>
    var canonicalRows=${JSON.stringify(rows)};
    var presentation={lifecycleWorklists:${JSON.stringify(lifecycleWorklists)},lifecycleExceptions:${JSON.stringify(lifecycleExceptions)},admissionsStages:${JSON.stringify(admissionsStages)},populationSummary:{total:11,active:11,closed:0},actionabilityBuckets:[{code:"REVIEW_REQUIRED",count:4}]};
    var staleExceptionTarget=document.createElement("div");
    var dom={eduopsAdmissionsPopulationSummary:document.getElementById("eduopsAdmissionsPopulationSummary"),eduopsAdmissionsStages:document.getElementById("eduopsAdmissionsStages"),eduopsWorklistKeys:document.getElementById("eduopsWorklistKeys"),eduopsLifecycleExceptions:staleExceptionTarget};
    var app={state:{reviewBucketKey:"DOCUMENTS_FOLLOW_UP",actionabilityState:"ALL",worklistKey:""},esc:function(value){return String(value==null?"":value).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")},clearSelection:function(){},requestWorkload:function(){renderFixture();}};
    ${extract("renderWorklists")}
    ${extract("activateAdmissionsLifecycleControl")}
    function filteredRows(){if(app.state.actionabilityState==="REVIEW_REQUIRED")return canonicalRows.filter(function(row){return row.legacy});if(app.state.reviewBucketKey==="ALL_ACTIVE")return canonicalRows;return canonicalRows.filter(function(row){return row.bucket===app.state.reviewBucketKey});}
    function renderFixture(){renderWorklists(presentation);document.getElementById("centralList").innerHTML=filteredRows().map(function(row){return '<div class="r414e-row" data-row="'+row.id+'">'+row.id+'</div>';}).join("");}
    document.addEventListener("click",function(event){activateAdmissionsLifecycleControl(event);});
    renderFixture();
    window.__r414e={staleTarget:staleExceptionTarget,state:app.state};
  </script></body></html>`;
}

async function assertSelection(page, selector, expectedRows, expectedBucket, expectedActionability = "ALL") {
  const control = page.locator(selector);
  await control.click();
  assert.equal(await control.getAttribute("aria-selected"), "true");
  assert.equal(await page.locator("#centralList .r414e-row").count(), expectedRows);
  assert.deepEqual(await page.evaluate(() => [window.__r414e.state.reviewBucketKey, window.__r414e.state.actionabilityState]), [expectedBucket, expectedActionability]);
}

(async () => {
  const browser = await chromium.launch({ headless:true });
  const page = await browser.newPage({ viewport:{ width:1280, height:900 } });
  await page.setContent(fixture(), { waitUntil:"load" });

  const controls = page.locator("#eduopsLifecycleExceptions button");
  assert.equal(await controls.count(), 4);
  assert.deepEqual(await controls.allTextContents(), ["Lost / uncontactable1", "Data / integrity exception1", "All active work11", "Legacy Review aggregate4"]);
  for (let index = 0; index < 4; index += 1) {
    assert.equal(await controls.nth(index).isVisible(), true);
    assert.notEqual(await controls.nth(index).getAttribute("aria-hidden"), "true");
    assert.equal(await controls.nth(index).evaluate(element => element.tagName), "BUTTON");
  }
  assert.equal(await page.evaluate(() => window.__r414e.staleTarget.innerHTML), "", "the detached cached target must not receive controls");

  await assertSelection(page, '[data-lifecycle-worklist="LOST_UNCONTACTABLE"]', 1, "LOST_UNCONTACTABLE");
  await assertSelection(page, '[data-lifecycle-worklist="DATA_INTEGRITY_EXCEPTION"]', 1, "DATA_INTEGRITY_EXCEPTION");
  await assertSelection(page, '[data-lifecycle-worklist="ALL_ACTIVE"]', 11, "ALL_ACTIVE");
  await assertSelection(page, '[data-legacy-review="true"]', 4, "ALL_ACTIVE", "REVIEW_REQUIRED");

  const documents = page.locator('[data-lifecycle-worklist="DOCUMENTS_FOLLOW_UP"]');
  await documents.focus();
  await documents.press("Enter");
  assert.equal(await page.locator("#centralList .r414e-row").count(), 9);
  assert.equal(await documents.getAttribute("aria-selected"), "true");
  const lost = page.locator('[data-lifecycle-worklist="LOST_UNCONTACTABLE"]');
  await lost.focus();
  await lost.press("Space");
  assert.equal(await page.locator("#centralList .r414e-row").count(), 1);
  assert.equal(await lost.getAttribute("aria-selected"), "true");

  fs.mkdirSync("test-results", { recursive:true });
  await page.screenshot({ path:path.resolve("test-results/r414e-eduops-exceptions-desktop.png"), fullPage:true });
  await page.setViewportSize({ width:390, height:844 });
  assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), true, "390x844 must not introduce horizontal overflow");
  for (let index = 0; index < 4; index += 1) assert.equal(await controls.nth(index).isVisible(), true);
  await page.screenshot({ path:path.resolve("test-results/r414e-eduops-exceptions-390x844.png"), fullPage:true });

  await browser.close();
  console.log("PASS R414E live-target rendering, four visible controls, pointer/keyboard filtering, selected state, Documents regression, and 390x844 layout");
})().catch(error => { console.error(error); process.exitCode = 1; });
