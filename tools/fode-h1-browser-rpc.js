const fs = require("node:fs");
const path = require("node:path");

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith("--")) continue;
    out[key.slice(2)] = argv[i + 1] && !argv[i + 1].startsWith("--") ? argv[++i] : "true";
  }
  return out;
}

function loadPlaywright() {
  const candidates = [
    process.env.FODE_PLAYWRIGHT_MODULE,
    "F:\\Playwright\\fode-secure-link-diagnostic\\node_modules\\playwright"
  ].filter(Boolean);
  for (const candidate of candidates) {
    try { return require(candidate); } catch (_error) {}
  }
  throw new Error("Approved FODE Playwright module was not found.");
}

function adminUrl(repoRoot) {
  const context = JSON.parse(fs.readFileSync(path.join(repoRoot, "runtime-context.json"), "utf8"));
  return String(context.projects.FODE.deployments.adminStaging.url || "").replace(/[?#].*$/, "");
}

async function findRpcFrame(page) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const available = await frame.evaluate(() => typeof google !== "undefined" && !!google.script && !!google.script.run).catch(() => false);
      if (available) return frame;
    }
    await page.waitForTimeout(500);
  }
  throw new Error("Admin google.script.run bridge was not found.");
}

async function findContentFrame(page, signal) {
  const deadline = Date.now() + 60000;
  while (Date.now() < deadline) {
    for (const frame of page.frames()) {
      const text = await frame.locator("body").innerText({ timeout: 3000 }).catch(() => "");
      if (text.includes(signal)) return frame;
    }
    await page.waitForTimeout(500);
  }
  throw new Error(`Admin content frame was not found: ${signal}`);
}

async function acceptLiveSurfaces(page, baseUrl, screenshotPath) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error && error.message || error)));
  await page.goto(`${baseUrl}?view=operator-next`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const operatorFrame = await findContentFrame(page, "Roles & Capabilities");
  await operatorFrame.locator('[data-onx-route="roles"]').click();
  await operatorFrame.locator("#onxGrantSchemaState").filter({ hasText: "SCHEMA READY" }).waitFor({ state: "visible", timeout: 60000 });
  await operatorFrame.locator("#onxAccountCapabilityMatrix").filter({ hasText: "sanjay@minervacenters.com" }).waitFor({ state: "visible", timeout: 60000 });
  const accountMatrixText = await operatorFrame.locator("#onxAccountCapabilityMatrix").innerText();
  const grantHistoryText = await operatorFrame.locator("#onxTemporaryGrantRows").innerText();
  const resolvedRole = (await operatorFrame.locator("#onxResolvedRole").innerText()).trim();
  const grantButtons = operatorFrame.locator("[data-onx-grant-account]");
  const grantButtonCount = await grantButtons.count();
  if (grantButtonCount > 0) await grantButtons.first().click();
  const delegableOptions = grantButtonCount > 0
    ? await operatorFrame.locator("#onxGrantCapability option").evaluateAll((options) => options.map((option) => option.value))
    : [];
  if (grantButtonCount > 0) await operatorFrame.locator("#onxGrantDialogClose").click();
  const expectedAccounts = [
    "sanjay@minervacenters.com", "principal@kundu.ac", "operations@minervacenters.com", "enquiries@kundu.ac",
    "fode_kia@kundu.ac", "mlc@minervacenters.com", "mlccorporate@minervacenters.com"
  ];
  const expectedDelegable = [
    "CAN_RUN_BATCH_COMMUNICATIONS", "CAN_SEND_INDIVIDUAL_EMAIL", "CAN_PREVIEW_APPLICANT_COMMUNICATION",
    "CAN_INSERT_PORTAL_LINK", "CAN_GENERATE_STANDARD_QUOTE", "CAN_GENERATE_STANDARD_INVOICE",
    "CAN_REVIEW_DOCUMENTS", "CAN_SAVE_DOCUMENT_STATUSES"
  ];
  const operatorChecks = {
    roleIsSuper: resolvedRole === "SUPER",
    schemaReady: (await operatorFrame.locator("#onxGrantSchemaState").innerText()).trim() === "SCHEMA READY",
    allAccountsVisible: expectedAccounts.every((email) => accountMatrixText.includes(email)),
    zeroGrantRecords: /No matching temporary grant records/i.test(grantHistoryText),
    grantControlsVisibleForSuper: grantButtonCount > 0,
    delegableCapabilitiesExact: JSON.stringify(delegableOptions) === JSON.stringify(expectedDelegable),
    migrationWarningAbsent: !accountMatrixText.includes("MIGRATION REQUIRED")
  };
  if (screenshotPath) {
    fs.mkdirSync(path.dirname(screenshotPath), { recursive: true });
    await page.screenshot({ path: screenshotPath, fullPage: true });
  }
  await page.goto(`${baseUrl}?view=admin`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const adminFrame = await findContentFrame(page, "Review Workspace");
  const adminText = await adminFrame.locator("body").innerText();
  const adminChecks = {
    accessAllowed: !/Access denied|Not authorized/i.test(adminText),
    runtimeIdentityVisible: /r340/.test(adminText),
    reviewWorkspaceVisible: /Review Workspace/.test(adminText),
    individualCommunicationRoutePresent: await adminFrame.locator("#btnCommGenerateEditable").count() === 1 && await adminFrame.locator("#btnCommSendEdited").count() === 1,
    batchCommunicationRoutePresent: await adminFrame.locator("#standaloneBatchCommModal").count() === 1
  };
  return {
    result: "ACCEPTANCE_COMPLETE",
    operatorNext: { resolvedRole, grantButtonCount, delegableOptions, checks: operatorChecks },
    currentAdmin: { checks: adminChecks },
    pageErrors,
    passed: Object.values(operatorChecks).every(Boolean) && Object.values(adminChecks).every(Boolean) && pageErrors.length === 0
  };
}

async function waitForOperatorRows(frame) {
  await frame.waitForFunction(() => {
    return typeof operatorNextState_ !== "undefined"
      && operatorNextState_.initialized === true
      && Array.isArray(operatorNextState_.rows)
      && operatorNextState_.rows.length > 0;
  }, null, { timeout: 90000 });
}

async function closureAcceptLiveSurfaces(page, baseUrl, evidenceDir) {
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(String(error && error.message || error)));
  await page.goto(`${baseUrl}?view=operator-next`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const frame = await findContentFrame(page, "Lifecycle Map");
  await waitForOperatorRows(frame);

  const runtime = await frame.evaluate(() => ({
    bootstrap: typeof operatorNextBootstrapContext_ === "function" ? operatorNextBootstrapContext_() : null,
    runtime: operatorNextState_.runtime || null,
    rowCount: operatorNextState_.rows.length,
    globalViewContained: !!(document.getElementById("onxGlobalScope") && document.getElementById("onxGlobalScope").disabled)
  }));
  const rowEvidence = await frame.evaluate(() => {
    function snapshot(id) {
      const row = operatorNextState_.rows.find((item) => String(item && item.applicantId || "") === id) || null;
      if (!row) return null;
      return {
        applicantId: row.applicantId,
        name: row.name,
        rowNumber: row.rowNumber,
        canonicalLifecycle: row.canonicalLifecycle,
        actionabilityState: row.actionabilityState,
        selectable: row.selectable === true,
        selectBlockReason: row.selectBlockReason || "",
        workloadGroupKey: row.workloadGroupKey || "",
        worklistKey: row.worklistKey || "",
        worklistLabel: row.worklistLabel || "",
        worklistReason: row.worklistReason || "",
        nextAction: row.nextAction || "",
        recommendedMessageType: row.recommendedMessageType || ""
      };
    }
    return {
      waffi: snapshot("FODE-26-002959"),
      stephanie: snapshot("FODE-26-003230"),
      coolingOffCount: operatorNextState_.rows.filter((row) => row && row.actionabilityState === "COOLING_OFF").length,
      blockedCount: operatorNextState_.rows.filter((row) => row && row.selectable !== true).length
    };
  });

  async function reviewApplicant(applicantId, expectedMessageType, screenshotName) {
    const openedFromReturnedRow = await frame.evaluate((id) => {
      const row = operatorNextState_.rows.find((item) => String(item && item.applicantId || "") === id);
      if (row) operatorNextOpenReview_(row);
      else review(null, id, null, { actionabilityFocus: true });
      return !!row;
    }, applicantId);
    await frame.locator("#modalBack").waitFor({ state: "visible", timeout: 60000 });
    await frame.waitForFunction((id) => {
      const applicant = document.getElementById("mApplicantId");
      const loading = document.getElementById("reviewLoadingBanner");
      return applicant && String(applicant.textContent || "").includes(id)
        && (!loading || loading.offsetParent === null || !/loading/i.test(String(loading.textContent || "")));
    }, applicantId, { timeout: 90000 });
    await frame.waitForFunction(({ id, expected }) => {
      return currentDetail
        && String(currentDetail.ApplicantID || "") === id
        && String(currentDetail.Comm_Recommended_Message_Type || "") === expected
        && String(document.getElementById("commMessageType")?.value || "") === expected;
    }, { id: applicantId, expected: expectedMessageType }, { timeout: 90000 });
    const before = await frame.evaluate(() => ({
      applicantId: String(document.getElementById("mApplicantId")?.textContent || "").trim(),
      applicantName: String(document.getElementById("mApplicantName")?.textContent || "").trim(),
      messageType: String(document.getElementById("commMessageType")?.value || ""),
      recommendation: String(document.getElementById("commTemplateRecommendation")?.textContent || "").replace(/\s+/g, " ").trim(),
      statePanel: String(document.getElementById("reviewCommStatePanel")?.textContent || "").replace(/\s+/g, " ").trim(),
      payment: String(document.getElementById("mPayment")?.textContent || "").trim(),
      stage: String(document.getElementById("mHeaderStage")?.textContent || "").trim(),
      authorityDisplay: currentDetail && currentDetail._authorityDisplay || null,
      canonicalLifecycle: currentDetail && currentDetail.canonicalLifecycle || currentDetail && currentDetail._canonicalLifecycle || null,
      derived: currentDetail ? {
        recommendedMessageType: currentDetail.Comm_Recommended_Message_Type || "",
        requestedMessageType: currentDetail.Comm_Requested_Message_Type || "",
        permitted: currentDetail.Comm_Permitted,
        sendableNow: currentDetail.Comm_Can_Send_Now,
        blockCode: currentDetail.Comm_Block_Code || "",
        blockReason: currentDetail.Comm_Block_Reason || ""
      } : null
    }));
    const generate = frame.locator("#btnCommGenerateEditable");
    const canPreview = await generate.isEnabled().catch(() => false);
    let preview = null;
    if (canPreview) {
      await generate.click({ timeout: 15000 });
      await frame.waitForFunction(() => {
        return typeof communicationsState !== "undefined"
          && communicationsState.busy !== true
          && !!(communicationsState.lastRawResponse || communicationsState.result);
      }, null, { timeout: 90000 });
      preview = await frame.evaluate(() => ({
        selectedMessageType: communicationsState.selectedMessageType || "",
        requestedMessageType: communicationsState.requestedMessageType || "",
        permitted: communicationsState.authority ? communicationsState.authority.permitted : null,
        sendableNow: communicationsState.authority ? communicationsState.authority.sendableNow : null,
        blockCode: communicationsState.authority ? communicationsState.authority.blockCode || "" : "",
        blockReason: communicationsState.authority ? communicationsState.authority.blockReason || "" : "",
        subject: String(document.getElementById("commSubject")?.value || ""),
        bodyLength: String(document.getElementById("commBody")?.value || "").length,
        resultText: String(document.getElementById("commResult")?.textContent || "").replace(/\s+/g, " ").trim()
      }));
    }
    if (evidenceDir) await page.screenshot({ path: path.join(evidenceDir, screenshotName), fullPage: true });
    await frame.evaluate(() => closeModal());
    await frame.locator("#modalBack").waitFor({ state: "hidden", timeout: 15000 });
    return { expectedMessageType, openedFromReturnedRow, canPreview, before, preview };
  }

  if (evidenceDir) fs.mkdirSync(evidenceDir, { recursive: true });
  const waffi = await reviewApplicant("FODE-26-002959", "payment_followup", "01-waffi-review.png");
  const stephanie = await reviewApplicant("FODE-26-003230", "docs_missing", "02-stephanie-review.png");

  const returnedHandoff = await frame.evaluate(() => {
    const row = operatorNextState_.rows.find((item) => item && item.applicantId && item.rowNumber);
    if (!row) return null;
    operatorNextOpenReview_(row);
    return { applicantId: row.applicantId, rowNumber: row.rowNumber };
  });
  if (!returnedHandoff) throw new Error("No returned Operator Next row was available for exact handoff proof.");
  await frame.locator("#modalBack").waitFor({ state: "visible", timeout: 60000 });
  await frame.waitForFunction((id) => String(document.getElementById("mApplicantId")?.textContent || "").includes(id), returnedHandoff.applicantId, { timeout: 90000 });
  returnedHandoff.observedApplicantId = await frame.locator("#mApplicantId").innerText();
  await frame.evaluate(() => closeModal());

  const batchSelection = await frame.evaluate(() => {
    const groups = {};
    operatorNextState_.rows.forEach((row) => {
      const type = String(row && row.recommendedMessageType || "");
      if (!type || row.selectable !== true) return;
      (groups[type] || (groups[type] = [])).push(row);
    });
    const type = Object.keys(groups).find((key) => groups[key].length >= 2);
    if (!type) return null;
    const rows = groups[type].slice(0, 2);
    operatorNextState_.selected = {};
    rows.forEach((row) => { operatorNextState_.selected[operatorNextRowKey_(row)] = true; });
    operatorNextOpenBatch_();
    return { messageType: type, applicantIds: rows.map((row) => row.applicantId) };
  });
  if (!batchSelection) throw new Error("No bounded two-recipient selectable communication cohort was available.");
  await frame.locator("#standaloneBatchCommModalBack").waitFor({ state: "visible", timeout: 30000 });
  await frame.evaluate(() => previewBatchCommunicationModal_());
  await frame.waitForFunction(() => typeof batchCommState !== "undefined" && batchCommState.busy !== true && !!batchCommState.preview, null, { timeout: 90000 });
  const batch = await frame.evaluate(() => ({
    sourceType: batchCommState.sourceType,
    applicantIds: batchCommState.applicantIds.slice(),
    selectedMessageType: batchCommState.selectedMessageType,
    preview: batchCommState.preview,
    modalText: String(document.getElementById("standaloneBatchCommModal")?.textContent || "").replace(/\s+/g, " ").trim()
  }));
  if (evidenceDir) await page.screenshot({ path: path.join(evidenceDir, "03-selected-batch-preview.png"), fullPage: true });
  await frame.evaluate(() => closeBatchCommunicationModal_());

  const routes = {};
  for (const route of ["reports", "health", "roles"]) {
    const navPresent = await frame.locator(`[data-onx-route="${route}"]`).count() === 1;
    await frame.evaluate((key) => {
      if (typeof closeModal === "function") closeModal();
      operatorNextActivateRoute_(key);
    }, route);
    if (route === "roles") await frame.locator("#onxGrantSchemaState").filter({ hasText: "SCHEMA READY" }).waitFor({ state: "visible", timeout: 60000 });
    else await page.waitForTimeout(1500);
    routes[route] = await frame.evaluate((key) => ({
      active: document.getElementById(`onxRoute-${key}`)?.classList.contains("active") === true,
      text: String(document.getElementById(`onxRoute-${key}`)?.textContent || "").replace(/\s+/g, " ").trim()
    }), route);
    routes[route].navPresent = navPresent;
  }
  if (evidenceDir) await page.screenshot({ path: path.join(evidenceDir, "04-roles-capabilities.png"), fullPage: true });

  await page.goto(`${baseUrl}?view=admin`, { waitUntil: "domcontentloaded", timeout: 90000 });
  const adminFrame = await findContentFrame(page, "Review Workspace");
  const adminText = await adminFrame.locator("body").innerText();
  const admin = {
    accessAllowed: !/Access denied|Not authorized/i.test(adminText),
    runtimeIdentityVisible: /r340/.test(adminText),
    reviewWorkspaceVisible: /Review Workspace/.test(adminText),
    individualCommunicationRoutePresent: await adminFrame.locator("#btnCommGenerateEditable").count() === 1,
    batchCommunicationRoutePresent: await adminFrame.locator("#standaloneBatchCommModal").count() === 1,
    systemHealthPresent: /System Health/.test(adminText)
  };

  const checks = {
    startup: !!runtime.bootstrap && runtime.rowCount > 0 && pageErrors.length === 0,
    runtimeIdentity: runtime.runtime && runtime.runtime.version === "r340" && Number(runtime.runtime.deployVersion) === 340,
    workingViewContained: runtime.globalViewContained === true,
    waffi: waffi.before.messageType === "payment_followup" && waffi.before.applicantId.includes("FODE-26-002959"),
    stephanie: stephanie.before.messageType === "docs_missing" && stephanie.before.applicantId.includes("FODE-26-003230"),
    exactReviewHandoff: String(returnedHandoff.observedApplicantId || "").includes(returnedHandoff.applicantId),
    individualPreview: waffi.canPreview && stephanie.canPreview && !!waffi.preview && !!stephanie.preview,
    selectedBatchPreview: batch.sourceType === "selected" && JSON.stringify(batch.applicantIds) === JSON.stringify(batchSelection.applicantIds) && !!batch.preview,
    routes: Object.values(routes).every((item) => item.navPresent && item.active && item.text.length > 0),
    adminFallback: Object.values(admin).every(Boolean)
  };
  return { result: "V1_CLOSURE_ACCEPTANCE_COMPLETE", runtime, rowEvidence, waffi, stephanie, returnedHandoff, batchSelection, batch, routes, admin, pageErrors, checks, passed: Object.values(checks).every(Boolean) };
}

async function invoke(frame, functionName, payload) {
  return frame.evaluate(({ functionName: fn, payload: body }) => new Promise((resolve, reject) => {
    const runner = google.script.run
      .withSuccessHandler(resolve)
      .withFailureHandler((error) => reject(new Error(String(error && error.message || error || "RPC failed"))));
    runner[fn](body || {});
  }), { functionName, payload });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const action = String(args.action || "");
  const allowed = {
    probe: { fn: "admin_getRuntimeInfo", payload: {} },
    plan: { fn: "admin_planCapabilityGrantsMigration", payload: { apply: false } },
    migrate: { fn: "admin_planCapabilityGrantsMigration", payload: { apply: true, confirmation: args.confirm || "" } },
    matrix: { fn: "admin_getCapabilityGrantMatrix", payload: {} },
    backup: {
      fn: "admin_createCapabilityGrantPreMigrationBackup",
      payload: {
        confirmation: args.confirm || "",
        commitHash: args.commit || "",
        adminDeploymentPin: args["admin-pin"] || "",
        studentDeploymentPin: args["student-pin"] || ""
      }
    }
  };
  if (action !== "accept" && action !== "closure" && !Object.prototype.hasOwnProperty.call(allowed, action)) throw new Error("Unsupported H1 action. Use probe, plan, migrate, matrix, backup, accept, or closure.");
  if (action === "migrate" && args.confirm !== "CREATE_CAPABILITY_GRANTS") throw new Error("Migration confirmation is required.");
  if (action === "backup" && args.confirm !== "CREATE_H1_PRE_MIGRATION_BACKUP") throw new Error("Backup confirmation is required.");
  const repoRoot = path.resolve(__dirname, "..");
  const outputPath = path.resolve(args.output || path.join(repoRoot, ".release-proof", `h1-${action}.json`));
  const authState = process.env.FODE_ADMIN_AUTH_STATE || "F:\\Playwright\\fode-secure-link-diagnostic\\auth\\admin-storage-state.json";
  const { chromium } = loadPlaywright();
  const browser = await chromium.launch({ headless: true });
  try {
    const contextOptions = fs.existsSync(authState) ? { storageState: authState } : {};
    const browserContext = await browser.newContext(contextOptions);
    const page = await browserContext.newPage();
    await page.goto(`${adminUrl(repoRoot)}?view=operator-next`, { waitUntil: "domcontentloaded", timeout: 90000 });
    const result = action === "accept"
      ? await acceptLiveSurfaces(page, adminUrl(repoRoot), args.screenshot ? path.resolve(args.screenshot) : "")
      : action === "closure"
        ? await closureAcceptLiveSurfaces(page, adminUrl(repoRoot), args["evidence-dir"] ? path.resolve(args["evidence-dir"]) : "")
        : await invoke(await findRpcFrame(page), allowed[action].fn, allowed[action].payload);
    fs.mkdirSync(path.dirname(outputPath), { recursive: true });
    fs.writeFileSync(outputPath, JSON.stringify({ action, capturedAt: new Date().toISOString(), result }, null, 2));
    const ok = result && result.ok !== false && result.passed !== false;
    if (!ok) throw new Error(String(result && (result.message || result.error || result.code) || "RPC returned failure"));
    process.stdout.write(`PASS ${action} evidence=${outputPath}\n`);
  } finally {
    await browser.close();
  }
}

main().catch((error) => {
  process.stderr.write(`FAIL ${String(error && error.message || error)}\n`);
  process.exit(1);
});
