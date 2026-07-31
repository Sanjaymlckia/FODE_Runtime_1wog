const fs = require("node:fs");
const assert = require("node:assert/strict");

const playwrightModule =
  process.env.FODE_PLAYWRIGHT_MODULE ||
  "F:/Playwright/fode-secure-link-diagnostic/node_modules/playwright";
const { chromium } = require(playwrightModule);

const CLIENT_FILES = [
  "EduOps_ClientCore.html",
  "EduOps_ClientOperationsWorkspace.html",
  "EduOps_ClientComponents.html",
  "EduOps_ClientWorkbench.html",
  "EduOps_ClientBatch.html",
  "EduOps_Client.html"
];

function fixtureHtml() {
  let html = fs.readFileSync("EduOps.html", "utf8");
  html = html.replace(
    '<?!= HtmlService.createHtmlOutputFromFile("EduOps_Styles").getContent(); ?>',
    fs.readFileSync("EduOps_Styles.html", "utf8")
  );
  html = html.replace(
    '<?!= HtmlService.createHtmlOutputFromFile("EduOps_OperationsWorkspaceStyles").getContent(); ?>',
    fs.readFileSync("EduOps_OperationsWorkspaceStyles.html", "utf8")
  );

  const transport = String.raw`<script>
  (function () {
    "use strict";
    window.EDUOPS_HISTORY_TIMEOUT_MS = 80;
    var state = {
      sequence: 0,
      deferBudget: {},
      pending: [],
      calls: [],
      counts: {},
      datasetVersion: 1,
      snapshotId: "R391B-SNAPSHOT",
      rowOffset: 0,
      populationIntegrity: null,
      searchMatches: [],
      savedTemplate: null,
      lastReceipt: null
    };

    function currentSnapshotId() {
      return state.snapshotId;
    }

    function populationIntegrity() {
      return JSON.parse(JSON.stringify(state.populationIntegrity || {
        schemaVersion: "CANONICAL_POPULATION_INTEGRITY_V1",
        status: "PASS",
        authoritySafeToBatch: true,
        blockCode: "",
        blockReason: "",
        populationCount: 3,
        scannedRowCount: 3,
        distinctApplicantIdCount: 3,
        duplicateApplicantIdCount: 0,
        duplicateApplicantIds: [],
        duplicateRowReferences: [],
        missingOrInvalidApplicantIdCount: 0,
        missingOrInvalidApplicantIds: [],
        reconciliationFindings: [],
        evidenceTruncated: false,
        integrityFingerprint: "CPI-" + currentSnapshotId()
      }));
    }

    function codePresentation(code, label) {
      return {
        schemaVersion: "EDUOPS_CODE_PRESENTATION_V1",
        authoritySource: "R391B deterministic fixture",
        code: code,
        label: label || String(code || "").replace(/_/g, " "),
        reason: "Deterministic fixture authority.",
        tone: "ready",
        available: true,
        stale: false
      };
    }

    function makeRow(applicantId, rowNumber, actionabilityState) {
      rowNumber = Number(rowNumber || 0) + Number(state.rowOffset || 0);
      var presentation = {
        actionability: codePresentation(actionabilityState, actionabilityState === "REVIEW_REQUIRED" ? "Needs review" : "Ready"),
        worklist: codePresentation("ALL", "All work types"),
        nextAction: codePresentation("REVIEW_APPLICANT", "Review applicant"),
        coolingOff: codePresentation("NOT_COOLING_OFF", "No waiting period"),
        lifecycle: codePresentation("INCOMPLETE_DOCUMENTS", "Incomplete documents"),
        finance: codePresentation("NOT_APPLICABLE", "Not yet payment applicable"),
        documents: codePresentation("REVIEW_REQUIRED", "Review required"),
        owner: codePresentation("ADMIN", "Admin"),
        workScope: codePresentation("ALL_AUTHORISED", "All Authorised Work"),
        route: codePresentation("REVIEW", "Review"),
        urgency: codePresentation("NORMAL", "Normal"),
        contactability: codePresentation("EMAIL_AVAILABLE", "Email available"),
        reliability: codePresentation("AUTHORITATIVE", "Authoritative")
      };
      return {
        schemaVersion: "EDUOPS_WORKLOAD_ROW_V2",
        product: "FODE",
        rowKey: "FODE:" + applicantId + ":" + rowNumber,
        rowNumber: rowNumber,
        applicantId: applicantId,
        displayName: "Applicant " + applicantId,
        email: applicantId.toLowerCase() + "@example.test",
        actionabilityState: actionabilityState,
        worklistKey: "ALL",
        worklistLabel: "All work types",
        actionOwner: "ADMIN",
        nextAction: "REVIEW_APPLICANT",
        selectable: true,
        presentation: presentation,
        applicantContextRibbon: {
          schemaVersion: "OPSEDU_APPLICANT_CONTEXT_RIBBON_V1",
          items: []
        },
        traceAudit: {
          schemaVersion: "OPSEDU_TRACE_AUDIT_V1",
          authoritySource: "R391B deterministic fixture",
          snapshotId: currentSnapshotId(),
          reasonCode: "FIXTURE"
        },
        operationalRow: {
          schemaVersion: "OPSEDU_OPERATIONAL_ROW_V1",
          issueLabel: "Fixture issue",
          issueEvidence: "Deterministic evidence",
          nextActionLabel: "Review applicant",
          statusLabel: actionabilityState === "REVIEW_REQUIRED" ? "Review" : "Ready now",
          contactLabel: "Email available",
          workPackageLabel: "All work types",
          selectionLabel: "Selectable",
          missingDocumentNames: []
        },
        authorityDecision: {
          schemaVersion: "EDUOPS_ROW_AUTHORITY_DECISION_V1",
          authoritySource: "Actionability Resolver",
          evaluatedApplicantId: applicantId,
          snapshotId: currentSnapshotId(),
          state: actionabilityState,
          reasonCode: "AVAILABLE",
          reason: "Available",
          actionAvailable: true,
          stale: false
        }
      };
    }

    function rowsFor(actionabilityState) {
      var requested = actionabilityState || "READY";
      if (requested === "EMPTY") return [];
      if (state.datasetVersion === 2) {
        if (requested === "READY") return [makeRow("B", 12, "READY"), makeRow("C", 13, "READY")];
        if (requested === "REVIEW_REQUIRED") return [makeRow("A", 11, "REVIEW_REQUIRED"), makeRow("R2", 22, "REVIEW_REQUIRED")];
      }
      if (requested === "REVIEW_REQUIRED") {
        return [makeRow("R1", 21, "REVIEW_REQUIRED"), makeRow("R2", 22, "REVIEW_REQUIRED")];
      }
      return [makeRow("A", 11, requested), makeRow("B", 12, requested), makeRow("C", 13, requested)];
    }

    function makeWorkload(payload) {
      var query = payload || {};
      var actionabilityState = query.actionabilityState || "READY";
      var rows = rowsFor(actionabilityState);
      var selection = {
        totalMatched: rows.length,
        visibleSelectable: rows.length,
        visibleBlocked: 0
      };
      var queryBinding = {
        schemaVersion: "EDUOPS_QUERY_BINDING_V1",
        authority: "SERVER_AUTHORED",
        snapshotId: currentSnapshotId(),
        queryFingerprint: JSON.stringify(query),
        integrityFingerprint: populationIntegrity().integrityFingerprint,
        query: JSON.parse(JSON.stringify(query))
      };
      var presentation = {
        schemaVersion: "EDUOPS_WORKLOAD_PRESENTATION_V1",
        authoritySource: "R391B deterministic fixture",
        actionabilityBuckets: [
          { code: "READY", label: "Ready", reason: "Fixture", tone: "ready", available: true, count: 3 },
          { code: "REVIEW_REQUIRED", label: "Needs review", reason: "Fixture", tone: "review", available: true, count: 2 },
          { code: "EMPTY", label: "Empty", reason: "Fixture", tone: "ready", available: true, count: 0 }
        ],
        allActionability: { label: "All authoritative states", count: 5 },
        worklists: [{ code: "ALL", label: "All work types", count: rows.length }],
        workScopes: [codePresentation("ALL_AUTHORISED", "All Authorised Work")],
        reliability: codePresentation("AUTHORITATIVE", "Authoritative"),
        metrics: [{ label: "Matched", value: rows.length }],
        filterOptions: {
          owner: [], urgency: [], primaryRoute: [], documentState: [], financeState: [],
          contactabilityState: [], communicationState: [], cooling: [], blockKind: []
        },
        selection: selection,
        modules: {}
      };
      var packageBinding = JSON.parse(JSON.stringify(queryBinding));
      return {
        ok: true,
        schemaVersion: "EDUOPS_OPERATIONAL_WORKLOAD_V2",
        authoritySource: "R391B deterministic fixture",
        product: "FODE",
        actionabilityState: actionabilityState,
        worklistKey: query.worklistKey || "ALL",
        workScope: query.workScope || "ALL_AUTHORISED",
        filters: query.filters || { search: "" },
        sort: query.sort || { key: "urgency", direction: "asc" },
        runtime: {
          operationalClassification: "R391B deterministic fixture",
          runtimeIdentity: "rTEST / 0"
        },
        snapshotId: currentSnapshotId(),
        snapshotAsOf: "2026-07-29T00:00:00.000Z",
        operationAvailability: {
          BATCH_COMMUNICATION: { available: true, reason: "Fixture Batch authority." },
          CONTACTABILITY_CORRECTION: { available: true, reason: "Fixture contact authority." }
        },
        presentation: presentation,
        queryBinding: queryBinding,
        populationIntegrity: populationIntegrity(),
        page: Number(query.page || 1),
        pageSize: Number(query.pageSize || 25),
        totalMatched: rows.length,
        totalPages: 1,
        rows: rows,
        reconciliation: {
          canonicalPopulation: 5,
          totalMatched: rows.length,
          hiddenFromCurrentView: Math.max(0, 5 - rows.length),
          eligibleOutsideCurrentWindow: 0,
          totalAuthoritySelectable: rows.length,
          totalAuthorityBlocked: 0,
          queryBinding: queryBinding
        },
        cockpit: {
          schemaVersion: "OPSEDU_COCKPIT_V1",
          productLabel: "FODE",
          heading: "Deterministic Operations Workspace",
          snapshotId: currentSnapshotId(),
          snapshotTimestamp: "2026-07-29T00:00:00.000Z",
          primaryBuckets: [{
            code: actionabilityState,
            label: actionabilityState,
            count: rows.length,
            reason: "Fixture",
            defaultQueueBinding: packageBinding
          }],
          actionPackages: [{
            packageId: "FIXTURE_PACKAGE",
            actionabilityState: actionabilityState,
            label: "Fixture package",
            count: rows.length,
            routeReason: "Fixture",
            ownerDomain: "Fixture",
            mutationBoundary: "Read only",
            primaryActionLabel: "Open queue",
            disabled: false,
            defaultQueueBinding: packageBinding
          }]
        },
        timings: { serverRpcMs: 1 }
      };
    }

    function makeAccess(label) {
      return {
        ok: true,
        fixtureLabel: label,
        schemaVersion: "EDUOPS_ACCESS_PROJECTION_V1",
        runtime: { operationalClassification: label, runtimeIdentity: label + " / 0" },
        user: {
          email: String(label || "BASE").toLowerCase() + "@example.test",
          role: "ADMIN",
          capabilities: { normalizedRole: "ADMIN", capabilities: {} }
        },
        operationAvailability: {
          BATCH_COMMUNICATION: { available: true, reason: "Fixture Batch authority." }
        }
      };
    }

    function makeProfile(label, actionabilityState) {
      return {
        ok: true,
        fixtureLabel: label,
        schemaVersion: "EDUOPS_PROFILE_V2",
        defaultQuery: {
          product: "FODE",
          actionabilityState: actionabilityState || "READY",
          worklistKey: "ALL",
          workScope: "ALL_AUTHORISED",
          filters: { search: "" },
          sort: { key: "urgency", direction: "asc" },
          page: 1,
          pageSize: 25
        },
        batchPolicy: { allowedExecutionLimits: [1, 2, 3] },
        operationAvailability: {
          BATCH_COMMUNICATION: { available: true, reason: "Fixture Batch authority." },
          CONTACTABILITY_CORRECTION: { available: true, reason: "Fixture contact authority." }
        }
      };
    }

    function makeWorkbench(applicantId) {
      var rowNumber = applicantId === "A" ? 11 : applicantId === "B" ? 12 : applicantId === "C" ? 13 : 99;
      var exact = makeRow(applicantId, rowNumber, applicantId === "A" && state.datasetVersion === 2 ? "REVIEW_REQUIRED" : "READY");
      var templates = [{
        templateId: "BASE_TEMPLATE",
        messageType: "fixture_message",
        label: "Fixture message",
        description: "Editable deterministic fixture template.",
        selectable: true,
        editable: true,
        recommended: true,
        availability: "AVAILABLE",
        availabilityLabel: "Available",
        subject: "Fixture subject",
        body: "Fixture body",
        authorityProjection: { Comm_Status: "READY" }
      }];
      if (state.savedTemplate) {
        templates.push({
          templateId: state.savedTemplate.templateId,
          messageType: state.savedTemplate.parentMessageType || "fixture_message",
          label: "Saved fixture variant",
          description: "Saved deterministic fixture template.",
          selectable: true,
          editable: true,
          availability: "AVAILABLE",
          availabilityLabel: "Available",
          subject: state.savedTemplate.subjectTemplate || "",
          body: state.savedTemplate.bodyTemplate || "",
          authorityProjection: { Comm_Status: "READY" }
        });
      }
      return {
        ok: true,
        schemaVersion: "EDUOPS_APPLICANT_WORKBENCH_V2",
        product: "FODE",
        snapshotId: currentSnapshotId(),
        rowKey: exact.rowKey,
        applicantId: applicantId,
        identity: {
          applicantId: applicantId,
          rowNumber: exact.rowNumber,
          displayName: "Applicant " + applicantId,
          email: applicantId.toLowerCase() + "@example.test"
        },
        exactAuthorityProjection: exact,
        applicantContextRibbon: exact.applicantContextRibbon,
        primaryActionTarget: {
          schemaVersion: "OPSEDU_PRIMARY_ACTION_TARGET_V1",
          available: false
        },
        communications: {
          schemaVersion: "EDUOPS_COMMUNICATION_SUMMARY_V1",
          operatorRecommendation: "Fixture message",
          eligibility: "Available",
          effectiveEmail: applicantId.toLowerCase() + "@example.test",
          draft: {
            recipient: applicantId.toLowerCase() + "@example.test"
          },
          communicationTemplatePanel: {
            schemaVersion: "OPSEDU_COMMUNICATION_TEMPLATE_PANEL_V1",
            templates: templates
          }
        },
        contactability: {
          schemaVersion: "EDUOPS_CONTACTABILITY_AUTHORITY_V1",
          available: true,
          state: "EMAIL_AVAILABLE",
          effectiveEmail: applicantId.toLowerCase() + "@example.test",
          emailSource: "Fixture",
          phone: "",
          hasValidEmail: true,
          hasPhoneFallback: false,
          suppressionState: "CLEAR",
          presentation: codePresentation("EMAIL_AVAILABLE", "Email available")
        },
        actions: {
          CONTACTABILITY_CORRECTION: {
            schemaVersion: "EDUOPS_WORKBENCH_ACTION_V1",
            operation: "CONTACTABILITY_CORRECTION",
            available: true,
            reason: "Fixture authority permits preview."
          },
          SEND_INDIVIDUAL_COMMUNICATION: {
            schemaVersion: "EDUOPS_WORKBENCH_ACTION_V1",
            operation: "SEND_INDIVIDUAL_COMMUNICATION",
            available: true,
            reason: "Fixture authority permits preview."
          }
        },
        operationAvailability: {
          CONTACTABILITY_CORRECTION: { available: true, reason: "Fixture contact authority." },
          SEND_INDIVIDUAL_COMMUNICATION: { available: true, reason: "Fixture communication authority." }
        }
      };
    }

    function makeManifest(applicantId) {
      return {
        ok: true,
        applicantId: applicantId,
        schemaVersion: "EDUOPS_DOCUMENT_MANIFEST_V2",
        documentGallery: {
          schemaVersion: "OPSEDU_DOCUMENT_GALLERY_V1",
          documents: [{
            documentKey: "BIRTH_ID",
            sourceField: "Birth_ID_Passport_File",
            label: "Birth ID",
            documentType: "PDF",
            status: "PENDING",
            statusPresentation: codePresentation("PENDING", "Pending review"),
            availableDecisions: [],
            evidenceCount: 1,
            evidenceFiles: [{ itemIndex: 0, fileName: applicantId + "-birth-id.pdf" }]
          }]
        },
        actionAuthority: { available: true, options: [] }
      };
    }

    function makeCatalogue(payload, label) {
      var selection = JSON.parse(JSON.stringify(payload && payload.selection || {}));
      var ids = (selection.selectedApplicantIds || []).slice();
      var executionLimit = Number(selection.executionLimit || payload && payload.executionLimit || 0);
      function template(templateId) {
        return {
          templateId: templateId,
          label: "Template " + templateId,
          selectable: true,
          availabilityState: "AVAILABLE_FOR_ALL",
          availabilityLabel: "Available",
          availableRecipientCount: ids.length,
          recipients: ids.map(function (applicantId) {
            return { applicantId: applicantId, templateId: templateId, included: true, email: applicantId.toLowerCase() + "@example.test" };
          })
        };
      }
      return {
        ok: true,
        fixtureLabel: label || "AUTO_CATALOGUE",
        schemaVersion: "EDUOPS_BATCH_COMMUNICATION_CATALOGUE_V1",
        state: "READY",
        statusLabel: "Cohort revalidated",
        executable: true,
        snapshotId: selection.snapshotId || currentSnapshotId(),
        selectionBinding: selection,
        masterCohortSize: ids.length,
        evaluatedCohortSize: Math.min(ids.length, executionLimit),
        executionLimit: executionLimit,
        remainingAfterEvaluation: Math.max(0, ids.length - executionLimit),
        excludedCount: (selection.excludedApplicantIds || []).length,
        blockedCount: 0,
        masterRecipients: ids.map(function (applicantId) { return makeRow(applicantId, applicantId === "A" ? 11 : applicantId === "B" ? 12 : 13, "READY"); }),
        templates: [template("T1"), template("T2")]
      };
    }

    function makeBatchPreview(payload, label, templateOverride) {
      var selection = JSON.parse(JSON.stringify(payload && payload.selection || {}));
      var templateId = templateOverride || payload && payload.draft && payload.draft.templateId || "";
      var ids = (selection.selectedApplicantIds || []).slice(0, Number(selection.executionLimit || 1));
      var recipients = ids.map(function (applicantId) {
        return { applicantId: applicantId, templateId: templateId, included: true, email: applicantId.toLowerCase() + "@example.test" };
      });
      return {
        ok: true,
        fixtureLabel: label || "AUTO_PREVIEW",
        schemaVersion: "EDUOPS_COMMAND_PREVIEW_V1",
        operation: "BATCH_COMMUNICATION",
        commandType: "BATCH_COMMUNICATION",
        previewId: "PREVIEW-" + (label || templateId),
        idempotencyKey: payload.idempotencyKey,
        snapshotId: selection.snapshotId || currentSnapshotId(),
        queryFingerprint: selection.queryFingerprint || "",
        selectionBinding: selection,
        selectedTemplate: { templateId: templateId, label: "Template " + templateId },
        executable: true,
        statusLabel: "Ready",
        statusReason: "Deterministic Batch authority.",
        expiresAt: "2099-01-01T00:00:00.000Z",
        executionCohortSize: recipients.length,
        partitions: [{ partitionKey: templateId, templateId: templateId, label: templateId, memberCount: recipients.length, recipients: recipients }],
        recipients: recipients,
        subject: "Fixture " + templateId,
        body: "Fixture body"
      };
    }

    function makeIndividualPreview(payload) {
      return {
        ok: true,
        schemaVersion: "EDUOPS_COMMAND_PREVIEW_V1",
        operation: payload.operation,
        commandType: payload.operation,
        operationLabel: "Contactability correction",
        previewId: "PREVIEW-" + payload.applicantId,
        receiptId: "RECEIPT-DRAFT-" + payload.applicantId,
        idempotencyKey: payload.idempotencyKey,
        stateFingerprint: "STATE-" + payload.applicantId,
        cooldownCycle: "CYCLE-1",
        snapshotId: payload.snapshotId,
        executable: true,
        expiresAt: "2099-01-01T00:00:00.000Z",
        requiredCapability: "CAN_EDIT_CONTACT_DETAILS",
        risk: "MEDIUM",
        summary: "Fixture individual preview"
      };
    }

    function automatic(name, payload) {
      if (name === "eduops_getAccessProjection") return makeAccess("BASE");
      if (name === "eduops_getProfile") return makeProfile("BASE", "READY");
      if (name === "eduops_queryOperationalWorkload") return makeWorkload(payload || {});
      if (name === "eduops_getApplicantWorkbench") return makeWorkbench(String(payload && payload.applicantId || ""));
      if (name === "eduops_getDocumentManifest") return makeManifest(String(payload && payload.applicantId || ""));
      if (name === "eduops_getDocumentRendition") return { ok: true, dataUrl: "data:image/png;base64,iVBORw0KGgo=" };
      if (name === "eduops_getDocumentFileAction") return { ok: true, url: "https://example.test/original", downloadUrl: "https://example.test/download" };
      if (name === "eduops_getBatchCommunicationCatalogue") return makeCatalogue(payload || {}, "AUTO_CATALOGUE");
      if (name === "eduops_previewCommand" && payload && payload.operation === "BATCH_COMMUNICATION") return makeBatchPreview(payload, "AUTO_PREVIEW");
      if (name === "eduops_previewCommand") return makeIndividualPreview(payload || {});
      if (name === "eduops_executeCommand") return { ok: true, receiptId: "RECEIPT-EXECUTED", outcome: "COMPLETE", applicantOutcomes: [] };
      if (name === "admin_saveReusableCommunicationTemplate") {
        state.savedTemplate = {
          ok: true,
          active: true,
          readBackVerified: true,
          templateId: "SAVED_TEMPLATE",
          parentMessageType: "fixture_message",
          versionId: "2",
          subjectTemplate: payload.subjectTemplate || "",
          bodyTemplate: payload.bodyTemplate || ""
        };
        return JSON.parse(JSON.stringify(state.savedTemplate));
      }
      if (name === "eduops_getOperationHistory") {
        var receipts = state.lastReceipt ? [JSON.parse(JSON.stringify(state.lastReceipt))] : [];
        return {
          ok: true,
          schemaVersion: "EDUOPS_OPERATION_HISTORY_V1",
          applicantId: String(payload && payload.applicantId || ""),
          receipts: receipts,
          communicationReceipts: receipts.filter(function (receipt) { return receipt.eventType === "COMMUNICATION"; })
        };
      }
      if (name === "eduops_searchApplicants") return { ok: true, matches: JSON.parse(JSON.stringify(state.searchMatches || [])) };
      return { ok: true };
    }

    function call(name, payload) {
      var id = ++state.sequence;
      state.calls.push({ id: id, name: name, payload: JSON.parse(JSON.stringify(payload || {})) });
      state.counts[name] = Number(state.counts[name] || 0) + 1;
      if (Number(state.deferBudget[name] || 0) > 0) {
        state.deferBudget[name] -= 1;
        return new Promise(function (resolve, reject) {
          state.pending.push({ id: id, name: name, payload: JSON.parse(JSON.stringify(payload || {})), resolve: resolve, reject: reject });
        });
      }
      return Promise.resolve(automatic(name, payload || {}));
    }

    function pendingSummary(name) {
      return state.pending.filter(function (item) { return !name || item.name === name; }).map(function (item) {
        return { id: item.id, name: item.name, payload: JSON.parse(JSON.stringify(item.payload || {})) };
      });
    }

    function take(id) {
      var index = state.pending.findIndex(function (item) { return item.id === id; });
      if (index < 0) throw new Error("Unknown deferred RPC " + id);
      return state.pending.splice(index, 1)[0];
    }

    window.__rpcControl = {
      defer: function (name, count) { state.deferBudget[name] = Number(state.deferBudget[name] || 0) + Number(count || 1); },
      pending: pendingSummary,
      resolveAuto: function (id) { var item = take(id); item.resolve(automatic(item.name, item.payload)); },
      resolveValue: function (id, value) {
        var item = take(id);
        if (item.name === "eduops_executeCommand" && value && value.receiptId) {
          state.lastReceipt = JSON.parse(JSON.stringify(value));
        }
        if (item.name === "admin_saveReusableCommunicationTemplate" && value && value.ok === true) {
          state.savedTemplate = Object.assign({}, value, {
            subjectTemplate: item.payload.subjectTemplate || "",
            bodyTemplate: item.payload.bodyTemplate || ""
          });
        }
        item.resolve(value);
      },
      reject: function (id, message) { take(id).reject(new Error(message || "Deterministic rejection")); },
      count: function (name) { return Number(state.counts[name] || 0); },
      calls: function (name) { return state.calls.filter(function (item) { return !name || item.name === name; }).map(function (item) { return JSON.parse(JSON.stringify(item)); }); },
      setDatasetVersion: function (value) { state.datasetVersion = Number(value || 1); },
      rotateSnapshot: function (snapshotId, rowOffset) { state.snapshotId = String(snapshotId || "R391B-SNAPSHOT"); state.rowOffset = Number(rowOffset || 0); },
      setPopulationIntegrity: function (value) { state.populationIntegrity = value ? JSON.parse(JSON.stringify(value)) : null; },
      setSearchMatches: function (rows) { state.searchMatches = JSON.parse(JSON.stringify(rows || [])); },
      makeAccess: makeAccess,
      makeProfile: makeProfile,
      makeWorkbench: makeWorkbench,
      makeManifest: makeManifest,
      makeCatalogue: makeCatalogue,
      makeBatchPreview: makeBatchPreview,
      makeRow: makeRow
    };
    window.EDUOPS_TRANSPORT = { call: call };
  })();
  </script>`;

  CLIENT_FILES.forEach(function (file, index) {
    const include =
      '<?!= HtmlService.createHtmlOutputFromFile("' +
      file.replace(/\.html$/, "") +
      '").getContent(); ?>';
    html = html.replace(include, (index === 0 ? transport : "") + fs.readFileSync(file, "utf8"));
  });

  return html
    .replace(/<\?= BUILD_VERSION \?>/g, "rTEST")
    .replace(/<\?= BUILD_RENDERED_AT \?>/g, "2026-07-29T00:00:00.000Z")
    .replace(/<\?= USER_EMAIL \?>/g, "operator@example.test")
    .replace(/<\?= ADMIN_ROLE \?>/g, "ADMIN");
}

async function flushUi(page) {
  await page.evaluate(() => new Promise((resolve) => requestAnimationFrame(() => resolve())));
}

async function openFixturePage(browser) {
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
  await page.setContent(fixtureHtml(), { waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    () =>
      document.querySelector("#eduopsApp")?.getAttribute("data-bootstrap-state") === "INTERACTIVE" &&
      document.querySelectorAll("#eduopsWorklistRows [data-open-applicant]").length > 0,
    null,
    { timeout: 5000 }
  );
  return page;
}

async function openWorkbench(page, applicantId) {
  await page.evaluate((id) => window.EduOpsApp.openWorkbench(id, null, "overview"), applicantId);
  await page.waitForFunction(
    (id) => window.EduOpsApp.state.workbench?.identity?.applicantId === id,
    applicantId,
    { timeout: 3000 }
  );
}

async function openBatchWithApplicant(page, applicantId) {
  await page.evaluate((id) => {
    const app = window.EduOpsApp;
    app.clearSelection();
    app.state.selected[id] = true;
    app.state.selectionContext = app.selectionContext(app.queryPayload(), app.state.snapshotId);
    app.openBatch(null);
  }, applicantId);
  await page.waitForFunction(() => !!window.EduOpsApp.state.batch);
}

async function openContactabilityPreview(page, applicantId) {
  await openWorkbench(page, applicantId);
  await page.evaluate(() => {
    const app = window.EduOpsApp;
    app.state.activeTab = "contactability";
    app.renderWorkbenchPanel();
    const reason = document.querySelector("#eduopsContactReason");
    reason.value = "Deterministic correction reason";
    reason.dispatchEvent(new Event("input", { bubbles: true }));
    document.querySelector("[data-preview-command='CONTACTABILITY_CORRECTION']").click();
  });
  await page.waitForFunction(() => !!window.EduOpsApp.state.confirm && window.EduOpsApp.state.commandExecutable === true);
}

async function beginDeferredIndividualExecute(page, applicantId) {
  await openContactabilityPreview(page, applicantId);
  await page.evaluate(() => {
    window.__rpcControl.defer("eduops_executeCommand", 1);
    window.EduOpsApp.state.confirm.onProceed();
  });
  await page.waitForFunction(() => window.__rpcControl.pending("eduops_executeCommand").length === 1);
  return (await page.evaluate(() => window.__rpcControl.pending("eduops_executeCommand")))[0];
}

async function openEditableCommunication(page, applicantId) {
  await openWorkbench(page, applicantId);
  await page.evaluate(() => {
    const app = window.EduOpsApp;
    app.state.activeTab = "communications";
    app.renderWorkbenchPanel();
    document.querySelector("[data-communication-template='BASE_TEMPLATE']").click();
  });
  await page.waitForFunction(() => !document.querySelector("[data-save-reusable-template]")?.disabled);
}

async function resolveDeferred(page, item, value) {
  if (value === undefined) {
    await page.evaluate((id) => window.__rpcControl.resolveAuto(id), item.id);
  } else {
    await page.evaluate(
      ({ id, response }) => window.__rpcControl.resolveValue(id, response),
      { id: item.id, response: value }
    );
  }
  await flushUi(page);
}

async function run() {
  const browser = await chromium.launch({ headless: true });
  const failures = [];
  const passes = [];

  async function scenario(name, test) {
    const page = await openFixturePage(browser);
    try {
      await test(page);
      passes.push(name);
    } catch (error) {
      failures.push({ name, message: error.message });
    } finally {
      await page.close();
    }
  }

  try {
    await scenario("A Workbench B/C reverse completion", async (page) => {
      await openWorkbench(page, "A");
      await page.evaluate(() => {
        window.__rpcControl.defer("eduops_getApplicantWorkbench", 2);
        window.EduOpsApp.openWorkbench("B", null, "overview");
        window.EduOpsApp.openWorkbench("C", null, "overview");
      });
      const pending = await page.evaluate(() => window.__rpcControl.pending("eduops_getApplicantWorkbench"));
      assert.equal(pending.length, 2, "Both Workbench generations must be represented by exact deferred identities");
      await resolveDeferred(page, pending.find((item) => item.payload.applicantId === "C"));
      await resolveDeferred(page, pending.find((item) => item.payload.applicantId === "B"));
      const finalState = await page.evaluate(() => ({
        applicantId: window.EduOpsApp.state.workbench?.identity?.applicantId,
        rowNumber: window.EduOpsApp.state.workbench?.identity?.rowNumber,
        subtitle: document.querySelector("#eduopsWorkbenchSubtitle")?.textContent || ""
      }));
      assert.deepEqual(finalState, {
        applicantId: "C",
        rowNumber: 13,
        subtitle: "C / exact row 13"
      });
    });

    await scenario("A Workbench originating workload generation is binding", async (page) => {
      await page.evaluate(() => {
        const app = window.EduOpsApp;
        window.__rpcControl.defer("eduops_getApplicantWorkbench", 1);
        window.__originWorkbench = app.openWorkbench("A", null, "overview");
      });
      await page.waitForFunction(() => window.__rpcControl.pending("eduops_getApplicantWorkbench").length === 1);
      await page.evaluate(() => {
        const app = window.EduOpsApp;
        app.state.actionabilityState = "REVIEW_REQUIRED";
        return app.requestWorkload();
      });
      await page.waitForFunction(() => window.EduOpsApp.state.workload?.actionabilityState === "REVIEW_REQUIRED");
      const pending = (await page.evaluate(() => window.__rpcControl.pending("eduops_getApplicantWorkbench")))[0];
      await resolveDeferred(page, pending);
      const finalState = await page.evaluate(async () => ({
        outcome: await window.__originWorkbench,
        workbench: window.EduOpsApp.state.workbench?.identity?.applicantId || null,
        workload: window.EduOpsApp.state.workload?.actionabilityState,
        requestPhase: window.EduOpsApp.state.workbenchRequest.phase,
        current: window.EduOpsApp.hasCurrentWorkbenchIdentity()
      }));
      assert.equal(finalState.outcome.accepted, false);
      assert.equal(finalState.outcome.outcome, "DISCARDED_STALE_WORKLOAD_IDENTITY");
      assert.equal(finalState.workbench, null);
      assert.equal(finalState.workload, "REVIEW_REQUIRED");
      assert.equal(finalState.requestPhase, "DISCARDED_WORKLOAD_IDENTITY");
      assert.equal(finalState.current, false);
    });

    await scenario("B Work Session top navigation identity", async (page) => {
      await page.locator("#eduopsStartSession").click();
      await page.waitForFunction(() => window.EduOpsApp.state.workbench?.identity?.applicantId === "A");
      const before = await page.evaluate(() => ({
        previousDisabled: document.querySelector("#eduopsWorkbenchPrevious").disabled,
        nextDisabled: document.querySelector("#eduopsWorkbenchNext").disabled
      }));
      assert.deepEqual(before, { previousDisabled: true, nextDisabled: false }, "Resolved Work Session navigation must remain responsive.");
      await page.evaluate(() => document.querySelector("#eduopsWorkbenchNext").click());
      await page.waitForFunction(() => window.EduOpsApp.state.workSession?.index === 1 && window.EduOpsApp.state.workbench?.identity?.applicantId === "B");
      const state = await page.evaluate(() => {
        const session = window.EduOpsApp.state.workSession;
        return {
          workbench: window.EduOpsApp.state.workbench?.identity?.applicantId,
          session: session && session.applicantIds[session.index],
          previousDisabled: document.querySelector("#eduopsWorkbenchPrevious").disabled,
          nextDisabled: document.querySelector("#eduopsWorkbenchNext").disabled,
          current: window.EduOpsApp.hasCurrentWorkbenchIdentity()
        };
      });
      assert.equal(state.workbench, state.session, "Top Workbench navigation must not diverge from active Work Session identity");
      assert.equal(state.workbench, "B");
      assert.equal(state.current, true);
      assert.equal(state.previousDisabled, false);
      assert.equal(state.nextDisabled, false);
    });

    await scenario("B Work Session mismatched direct open fails closed", async (page) => {
      await page.locator("#eduopsStartSession").click();
      await page.waitForFunction(() => window.EduOpsApp.state.workbench?.identity?.applicantId === "A");
      const result = await page.evaluate(async () => {
        const app = window.EduOpsApp;
        app.state.activeTab = "contactability";
        app.renderWorkbenchPanel();
        const outcome = await app.openWorkbench("C", null, "contactability");
        return {
          outcome,
          workbench: app.state.workbench?.identity?.applicantId,
          session: app.state.workSession?.applicantIds[app.state.workSession.index],
          requestPhase: app.state.workbenchRequest.phase,
          current: app.hasCurrentWorkbenchIdentity(),
          mutationDisabled: !!document.querySelector("[data-preview-command='CONTACTABILITY_CORRECTION']")?.disabled,
          previousDisabled: document.querySelector("#eduopsWorkbenchPrevious").disabled,
          nextDisabled: document.querySelector("#eduopsWorkbenchNext").disabled
        };
      });
      assert.equal(result.outcome.accepted, false);
      assert.equal(result.outcome.outcome, "BLOCKED_WORK_SESSION_IDENTITY");
      assert.equal(result.workbench, "A");
      assert.equal(result.session, "A");
      assert.equal(result.requestPhase, "BLOCKED_SESSION_IDENTITY");
      assert.equal(result.current, false);
      assert.equal(result.mutationDisabled, true);
      assert.equal(result.previousDisabled, true);
      assert.equal(result.nextDisabled, true);
    });

    await scenario("B rapid Next/Skip reverse completion", async (page) => {
      await page.locator("#eduopsStartSession").click();
      await page.waitForFunction(() => window.EduOpsApp.state.workbench?.identity?.applicantId === "A");
      await page.evaluate(() => {
        window.__rpcControl.defer("eduops_getApplicantWorkbench", 2);
        document.querySelector("[data-session-next]").click();
        var skip = document.querySelector("[data-session-skip]");
        if (skip) skip.click();
      });
      const launched = await page.evaluate(() => {
        const session = window.EduOpsApp.state.workSession;
        return {
          index: session && session.index,
          applicantId: session && session.applicantIds[session.index],
          pending: window.__rpcControl.pending("eduops_getApplicantWorkbench"),
          nextDisabled: !!document.querySelector("[data-session-next]")?.disabled,
          skipDisabled: !!document.querySelector("[data-session-skip]")?.disabled
        };
      });
      assert.equal(launched.index, 0, "Accepted session index must not advance when a request is merely launched");
      assert.equal(launched.nextDisabled, true, "Complete-and-next must fail closed while applicant identity is unresolved");
      assert.equal(launched.skipDisabled, true, "Skip must fail closed while applicant identity is unresolved");
      for (const item of launched.pending.slice().reverse()) await resolveDeferred(page, item);
      const finalState = await page.evaluate(() => {
        const session = window.EduOpsApp.state.workSession;
        return {
          workbench: window.EduOpsApp.state.workbench?.identity?.applicantId,
          session: session && session.applicantIds[session.index]
        };
      });
      assert.equal(finalState.workbench, finalState.session);
    });

    await scenario("B responsive Work Session Previous is atomic and serialized", async (page) => {
      await page.setViewportSize({ width: 800, height: 900 });
      await page.locator("#eduopsStartSession").click();
      await page.waitForFunction(() => window.EduOpsApp.state.workbench?.identity?.applicantId === "A");
      await page.locator("[data-session-next]").click();
      await page.waitForFunction(() => window.EduOpsApp.state.workSession?.index === 1 && window.EduOpsApp.state.workbench?.identity?.applicantId === "B");
      const responsive = await page.evaluate(() => {
        const bar = document.querySelector("#eduopsSessionBar");
        const previous = bar.querySelector("[data-session-previous]");
        return {
          previousVisible: !!previous && getComputedStyle(previous).display !== "none",
          previousDisabled: previous.disabled,
          overflow: bar.scrollWidth > bar.clientWidth + 1
        };
      });
      assert.deepEqual(responsive, { previousVisible: true, previousDisabled: false, overflow: false });
      await page.evaluate(() => {
        window.__rpcControl.defer("eduops_getApplicantWorkbench", 2);
        document.querySelector("[data-session-previous]").click();
        document.querySelector("[data-session-skip]")?.click();
      });
      const pending = await page.evaluate(() => ({
        calls: window.__rpcControl.pending("eduops_getApplicantWorkbench"),
        index: window.EduOpsApp.state.workSession?.index,
        previousDisabled: document.querySelector("[data-session-previous]")?.disabled,
        nextDisabled: document.querySelector("[data-session-next]")?.disabled,
        skipDisabled: document.querySelector("[data-session-skip]")?.disabled
      }));
      assert.equal(pending.calls.length, 1, "Pending Previous must serialize rapid Skip/Next intent.");
      assert.equal(pending.index, 1, "Session index must not move until applicant A is accepted.");
      assert.equal(pending.previousDisabled, true);
      assert.equal(pending.nextDisabled, true);
      assert.equal(pending.skipDisabled, true);
      await resolveDeferred(page, pending.calls[0]);
      const finalState = await page.evaluate(() => {
        const app = window.EduOpsApp;
        const session = app.state.workSession;
        return {
          index: session?.index,
          workbench: app.state.workbench?.identity?.applicantId,
          session: session?.applicantIds[session.index],
          active: session?.activeApplicantId,
          current: app.hasCurrentWorkbenchIdentity()
        };
      });
      assert.deepEqual(finalState, { index: 0, workbench: "A", session: "A", active: "A", current: true });
    });

    await scenario("B Work Session transition preserves dirty draft", async (page) => {
      await page.locator("#eduopsStartSession").click();
      await page.waitForFunction(() => window.EduOpsApp.state.workbench?.identity?.applicantId === "A");
      const before = await page.evaluate(() => window.__rpcControl.count("eduops_getApplicantWorkbench"));
      await page.evaluate(() => {
        window.EduOpsApp.state.dirty = true;
        document.querySelector("[data-session-next]").click();
      });
      const state = await page.evaluate(() => ({
        dirty: window.EduOpsApp.state.dirty,
        index: window.EduOpsApp.state.workSession?.index,
        pendingTransition: window.EduOpsApp.state.workSession?.pendingTransition || null,
        pendingLeave: typeof window.EduOpsApp.state.pendingLeave,
        confirmOpen: !!window.EduOpsApp.state.confirm,
        calls: window.__rpcControl.count("eduops_getApplicantWorkbench")
      }));
      assert.equal(state.dirty, true);
      assert.equal(state.index, 0);
      assert.equal(state.pendingTransition, null);
      assert.equal(state.pendingLeave, "function");
      assert.equal(state.confirmOpen, true);
      assert.equal(state.calls, before);
    });

    await scenario("C pending workload cannot reuse old DTO", async (page) => {
      await page.evaluate(() => {
        window.__rpcControl.defer("eduops_queryOperationalWorkload", 1);
        window.EduOpsApp.state.actionabilityState = "REVIEW_REQUIRED";
        window.EduOpsApp.clearSelection();
        window.EduOpsApp.requestWorkload();
      });
      const before = await page.evaluate(() => ({
        workloadRetained: !!window.EduOpsApp.state.workload,
        selectVisibleDisabled: document.querySelector("#eduopsSelectVisible").disabled,
        startSessionDisabled: document.querySelector("#eduopsStartSession").disabled,
        batchDisabled: document.querySelector("#eduopsOpenBatch").disabled
      }));
      await page.evaluate(() => {
        document.querySelector("#eduopsSelectVisible").click();
        document.querySelector("#eduopsStartSession").click();
      });
      const after = await page.evaluate(() => ({
        workSession: !!window.EduOpsApp.state.workSession,
        selected: Object.keys(window.EduOpsApp.state.selected || {}).filter((key) => window.EduOpsApp.state.selected[key]),
        batchDisabled: document.querySelector("#eduopsOpenBatch").disabled,
        applicantRows: document.querySelectorAll("#eduopsWorklistRows [data-applicant-row]").length
      }));
      assert.equal(before.workloadRetained, false, "A pending generation must make the old DTO non-current");
      assert.equal(before.selectVisibleDisabled, true);
      assert.equal(before.startSessionDisabled, true);
      assert.equal(before.batchDisabled, true);
      assert.equal(after.workSession, false);
      assert.deepEqual(after.selected, []);
      assert.equal(after.batchDisabled, true);
      assert.equal(after.applicantRows, 0);
    });

    await scenario("D workload N+1 resolves before N", async (page) => {
      await page.evaluate(() => {
        window.__rpcControl.defer("eduops_queryOperationalWorkload", 2);
        window.EduOpsApp.state.actionabilityState = "READY";
        window.EduOpsApp.requestWorkload();
        window.EduOpsApp.state.actionabilityState = "REVIEW_REQUIRED";
        window.EduOpsApp.requestWorkload();
      });
      const pending = await page.evaluate(() => window.__rpcControl.pending("eduops_queryOperationalWorkload"));
      assert.equal(pending.length, 2, "N and N+1 must carry independent generations so adverse completion order is testable");
      const newer = pending.find((item) => item.payload.actionabilityState === "REVIEW_REQUIRED");
      const older = pending.find((item) => item.payload.actionabilityState === "READY");
      await resolveDeferred(page, newer);
      await resolveDeferred(page, older);
      const finalState = await page.evaluate(() => ({
        query: window.EduOpsApp.state.actionabilityState,
        workload: window.EduOpsApp.state.workload?.actionabilityState,
        rows: Array.from(document.querySelectorAll("[data-applicant-row]")).map((row) => row.getAttribute("data-applicant-row"))
      }));
      assert.equal(finalState.query, "REVIEW_REQUIRED");
      assert.equal(finalState.workload, "REVIEW_REQUIRED");
      assert.deepEqual(finalState.rows, ["R1", "R2"]);
    });

    await scenario("D workload A/B/A latest intent", async (page) => {
      await page.evaluate(() => {
        window.__rpcControl.defer("eduops_queryOperationalWorkload", 5);
        window.EduOpsApp.state.actionabilityState = "READY";
        window.EduOpsApp.requestWorkload();
        window.EduOpsApp.state.actionabilityState = "REVIEW_REQUIRED";
        window.EduOpsApp.requestWorkload();
        window.EduOpsApp.state.actionabilityState = "READY";
        window.EduOpsApp.requestWorkload();
      });
      for (let turn = 0; turn < 5; turn += 1) {
        const pending = await page.evaluate(() => window.__rpcControl.pending("eduops_queryOperationalWorkload"));
        if (!pending.length) break;
        const ordered = pending.slice().sort((left, right) => right.id - left.id);
        for (const item of ordered) await resolveDeferred(page, item);
      }
      const finalState = await page.evaluate(() => ({
        query: window.EduOpsApp.state.actionabilityState,
        workload: window.EduOpsApp.state.workload?.actionabilityState,
        rows: Array.from(document.querySelectorAll("[data-applicant-row]")).map((row) => row.getAttribute("data-applicant-row"))
      }));
      assert.equal(finalState.query, "READY");
      assert.equal(finalState.workload, "READY");
      assert.deepEqual(finalState.rows, ["A", "B", "C"]);
    });

    await scenario("E mutually exclusive computed render states", async (page) => {
      async function snapshot() {
        return page.evaluate(() => {
          const empty = document.querySelector("#eduopsEmptyState");
          return {
            rows: document.querySelectorAll("#eduopsWorklistRows [data-applicant-row]").length,
            loading: document.querySelectorAll("#eduopsWorklistRows .eduops-loading-state").length,
            error: document.querySelectorAll("#eduopsWorklistRows .eduops-error-state").length,
            emptyVisible: getComputedStyle(empty).display !== "none" && empty.getClientRects().length > 0
          };
        });
      }
      const nonempty = await snapshot();
      await page.evaluate(async () => {
        window.EduOpsApp.state.actionabilityState = "EMPTY";
        await window.EduOpsApp.requestWorkload();
      });
      const empty = await snapshot();
      await page.evaluate(() => {
        window.__rpcControl.defer("eduops_queryOperationalWorkload", 1);
        window.EduOpsApp.state.actionabilityState = "READY";
        window.EduOpsApp.requestWorkload();
      });
      const loading = await snapshot();
      const pending = await page.evaluate(() => window.__rpcControl.pending("eduops_queryOperationalWorkload"));
      await page.evaluate((id) => window.__rpcControl.reject(id, "Forced workload failure"), pending[0].id);
      await page.waitForFunction(() => document.querySelectorAll("#eduopsWorklistRows .eduops-error-state").length === 1);
      const failure = await snapshot();
      await page.evaluate(async () => {
        await window.EduOpsApp.requestWorkload();
      });
      const recovered = await snapshot();
      assert.deepEqual(nonempty, { rows: 3, loading: 0, error: 0, emptyVisible: false });
      assert.deepEqual(empty, { rows: 0, loading: 0, error: 0, emptyVisible: true });
      assert.deepEqual(loading, { rows: 0, loading: 1, error: 0, emptyVisible: false });
      assert.deepEqual(failure, { rows: 0, loading: 0, error: 1, emptyVisible: false });
      assert.deepEqual(recovered, { rows: 3, loading: 0, error: 0, emptyVisible: false });
    });

    await scenario("F individual receipt return refreshes workload", async (page) => {
      await openWorkbench(page, "A");
      const before = await page.evaluate(() => window.__rpcControl.count("eduops_queryOperationalWorkload"));
      const result = await page.evaluate(async () => {
        const app = window.EduOpsApp;
        app.state.selected.A = true;
        app.state.workSession = { applicantIds: ["A"], index: 0, activeApplicantId: "A", pendingTransition: null, completed: [], skipped: [], exceptions: [] };
        app.state.batch = {
          instanceId: 99,
          catalogueRequestGeneration: 1,
          acceptedCatalogueGeneration: 1,
          previewRequestGeneration: 1,
          acceptedPreviewGeneration: 1,
          acceptedPreviewIdentity: { previewId: "OLD" },
          authorityValid: true,
          catalogue: { fixtureLabel: "OLD" },
          preview: { previewId: "OLD" },
          receipt: null,
          step: "preview"
        };
        app.state.workbench.lastReceipt = { receiptId: "INDIVIDUAL-1", outcome: "COMPLETE" };
        window.__rpcControl.setDatasetVersion(2);
        const closing = app.closeWorkbench();
        const invalidated = {
          selected: Object.keys(app.state.selected || {}).filter((key) => app.state.selected[key]),
          workSession: !!app.state.workSession,
          batchAuthority: app.state.workloadRequest.batchAuthorityValid,
          batchCatalogue: app.state.batch?.catalogue || null,
          batchPreview: app.state.batch?.preview || null,
          batchAuthorityValid: app.state.batch?.authorityValid
        };
        await closing;
        return {
          calls: window.__rpcControl.count("eduops_queryOperationalWorkload"),
          rows: (app.state.workload?.rows || []).map((row) => row.applicantId),
          selected: Object.keys(app.state.selected || {}).filter((key) => app.state.selected[key]),
          openBatchDisabled: document.querySelector("#eduopsOpenBatch").disabled,
          invalidated
        };
      });
      assert.equal(result.calls, before + 1, "Post-receipt Workbench return must request fresh workload truth");
      assert.deepEqual(result.rows, ["B", "C"]);
      assert.deepEqual(result.selected, []);
      assert.equal(result.openBatchDisabled, true);
      assert.deepEqual(result.invalidated, {
        selected: [],
        workSession: false,
        batchAuthority: false,
        batchCatalogue: null,
        batchPreview: null,
        batchAuthorityValid: false
      });
    });

    await scenario("G Batch receipt return refreshes workload", async (page) => {
      const before = await page.evaluate(() => window.__rpcControl.count("eduops_queryOperationalWorkload"));
      const result = await page.evaluate(async () => {
        window.EduOpsApp.state.returnContext = window.EduOpsApp.snapshotReturnContext();
        window.EduOpsApp.state.batch = {
          receipt: { receiptId: "BATCH-1", outcome: "COMPLETE" },
          step: "receipt"
        };
        window.__rpcControl.setDatasetVersion(2);
        await window.EduOpsApp.closeBatch();
        return {
          calls: window.__rpcControl.count("eduops_queryOperationalWorkload"),
          rows: (window.EduOpsApp.state.workload?.rows || []).map((row) => row.applicantId),
          selected: Object.keys(window.EduOpsApp.state.selected || {}).filter((key) => window.EduOpsApp.state.selected[key])
        };
      });
      assert.equal(result.calls, before + 1, "Post-receipt Batch return must request fresh workload truth");
      assert.deepEqual(result.rows, ["B", "C"]);
      assert.deepEqual(result.selected, []);
    });

    await scenario("G Batch catalogue stale success cannot overwrite newer intent", async (page) => {
      await openBatchWithApplicant(page, "A");
      await page.evaluate(() => {
        window.__rpcControl.defer("eduops_getBatchCommunicationCatalogue", 2);
        function chooseLimit(value) {
          const select = document.querySelector("[data-batch-execution-limit]");
          select.value = String(value);
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
        chooseLimit(1);
        chooseLimit(2);
      });
      await page.waitForFunction(() => window.__rpcControl.pending("eduops_getBatchCommunicationCatalogue").length === 2);
      const pending = await page.evaluate(() => window.__rpcControl.pending("eduops_getBatchCommunicationCatalogue"));
      const older = pending.find((item) => Number(item.payload.executionLimit) === 1);
      const newer = pending.find((item) => Number(item.payload.executionLimit) === 2);
      const newerCatalogue = await page.evaluate((payload) => window.__rpcControl.makeCatalogue(payload, "CATALOGUE_NEW"), newer.payload);
      const olderCatalogue = await page.evaluate((payload) => window.__rpcControl.makeCatalogue(payload, "CATALOGUE_OLD"), older.payload);
      await resolveDeferred(page, newer, newerCatalogue);
      await resolveDeferred(page, older, olderCatalogue);
      const state = await page.evaluate(() => ({
        label: window.EduOpsApp.state.batch?.catalogue?.fixtureLabel,
        executionLimit: window.EduOpsApp.state.batch?.binding?.executionLimit,
        accepted: window.EduOpsApp.state.batch?.acceptedCatalogueGeneration,
        latest: window.EduOpsApp.state.batch?.catalogueRequestGeneration,
        loading: window.EduOpsApp.state.batch?.catalogueLoading
      }));
      assert.deepEqual(state, {
        label: "CATALOGUE_NEW",
        executionLimit: 2,
        accepted: state.latest,
        latest: state.latest,
        loading: false
      });
    });

    await scenario("G Batch catalogue stale failure cannot erase newer success", async (page) => {
      await openBatchWithApplicant(page, "A");
      await page.evaluate(() => {
        window.__rpcControl.defer("eduops_getBatchCommunicationCatalogue", 2);
        function chooseLimit(value) {
          const select = document.querySelector("[data-batch-execution-limit]");
          select.value = String(value);
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
        chooseLimit(1);
        chooseLimit(2);
      });
      await page.waitForFunction(() => window.__rpcControl.pending("eduops_getBatchCommunicationCatalogue").length === 2);
      const pending = await page.evaluate(() => window.__rpcControl.pending("eduops_getBatchCommunicationCatalogue"));
      const older = pending.find((item) => Number(item.payload.executionLimit) === 1);
      const newer = pending.find((item) => Number(item.payload.executionLimit) === 2);
      const newerCatalogue = await page.evaluate((payload) => window.__rpcControl.makeCatalogue(payload, "CATALOGUE_CURRENT"), newer.payload);
      await resolveDeferred(page, newer, newerCatalogue);
      await page.evaluate((id) => window.__rpcControl.reject(id, "Forced stale catalogue failure"), older.id);
      await flushUi(page);
      const state = await page.evaluate(() => ({
        label: window.EduOpsApp.state.batch?.catalogue?.fixtureLabel,
        authorityError: window.EduOpsApp.state.batch?.authorityError,
        authorityValid: window.EduOpsApp.state.batch?.authorityValid,
        accepted: window.EduOpsApp.state.batch?.acceptedCatalogueGeneration,
        latest: window.EduOpsApp.state.batch?.catalogueRequestGeneration
      }));
      assert.equal(state.label, "CATALOGUE_CURRENT");
      assert.equal(state.authorityError, "");
      assert.equal(state.authorityValid, true);
      assert.equal(state.accepted, state.latest);
    });

    await scenario("G Batch preview template generations reject stale completion", async (page) => {
      await openBatchWithApplicant(page, "A");
      await page.evaluate(() => {
        const limit = document.querySelector("[data-batch-execution-limit]");
        limit.value = "1";
        limit.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForFunction(() => window.EduOpsApp.state.batch?.catalogue?.schemaVersion === "EDUOPS_BATCH_COMMUNICATION_CATALOGUE_V1");
      await page.evaluate(() => {
        window.__rpcControl.defer("eduops_previewCommand", 2);
        function chooseTemplate(value) {
          const select = document.querySelector("[data-batch-template]");
          select.value = value;
          select.dispatchEvent(new Event("change", { bubbles: true }));
        }
        chooseTemplate("T1");
        document.querySelector("[data-batch-preview]").click();
        chooseTemplate("T2");
        document.querySelector("[data-batch-preview]").click();
      });
      await page.waitForFunction(() => window.__rpcControl.pending("eduops_previewCommand").length === 2);
      const pending = await page.evaluate(() => window.__rpcControl.pending("eduops_previewCommand"));
      const older = pending.find((item) => item.payload.draft.templateId === "T1");
      const newer = pending.find((item) => item.payload.draft.templateId === "T2");
      const newerPreview = await page.evaluate((payload) => window.__rpcControl.makeBatchPreview(payload, "PREVIEW_T2"), newer.payload);
      const olderPreview = await page.evaluate((payload) => window.__rpcControl.makeBatchPreview(payload, "PREVIEW_T1"), older.payload);
      await resolveDeferred(page, newer, newerPreview);
      await resolveDeferred(page, older, olderPreview);
      const state = await page.evaluate(() => ({
        fixtureLabel: window.EduOpsApp.state.batch?.preview?.fixtureLabel,
        templateId: window.EduOpsApp.state.batch?.preview?.selectedTemplate?.templateId,
        commandTemplateId: window.EduOpsApp.state.commandPreview?.selectedTemplate?.templateId,
        accepted: window.EduOpsApp.state.batch?.acceptedPreviewGeneration,
        latest: window.EduOpsApp.state.batch?.previewRequestGeneration,
        identityTemplate: window.EduOpsApp.state.batch?.acceptedPreviewIdentity?.templateId,
        step: window.EduOpsApp.state.batch?.step
      }));
      assert.equal(state.fixtureLabel, "PREVIEW_T2");
      assert.equal(state.templateId, "T2");
      assert.equal(state.commandTemplateId, "T2");
      assert.equal(state.accepted, state.latest);
      assert.equal(state.identityTemplate, "T2");
      assert.equal(state.step, "partitions");
    });

    await scenario("G Batch preview response template mismatch fails closed", async (page) => {
      await openBatchWithApplicant(page, "A");
      await page.evaluate(() => {
        const limit = document.querySelector("[data-batch-execution-limit]");
        limit.value = "1";
        limit.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForFunction(() => !!window.EduOpsApp.state.batch?.catalogue);
      await page.evaluate(() => {
        const template = document.querySelector("[data-batch-template]");
        template.value = "T1";
        template.dispatchEvent(new Event("change", { bubbles: true }));
        window.__rpcControl.defer("eduops_previewCommand", 1);
        document.querySelector("[data-batch-preview]").click();
      });
      await page.waitForFunction(() => window.__rpcControl.pending("eduops_previewCommand").length === 1);
      const pending = (await page.evaluate(() => window.__rpcControl.pending("eduops_previewCommand")))[0];
      const mismatch = await page.evaluate((payload) => window.__rpcControl.makeBatchPreview(payload, "MISMATCH", "T2"), pending.payload);
      await resolveDeferred(page, pending, mismatch);
      const state = await page.evaluate(() => ({
        executable: window.EduOpsApp.state.batch?.preview?.executable,
        reason: window.EduOpsApp.state.batch?.preview?.statusReason,
        acceptedIdentity: window.EduOpsApp.state.batch?.acceptedPreviewIdentity || null,
        commandPreview: window.EduOpsApp.state.commandPreview || null,
        step: window.EduOpsApp.state.batch?.step
      }));
      assert.equal(state.executable, false);
      assert.match(state.reason, /template did not match/i);
      assert.equal(state.acceptedIdentity, null);
      assert.equal(state.commandPreview, null);
      assert.equal(state.step, "partitions");
    });

    await scenario("G Batch prohibition blocks mutated accepted preview without execution", async (page) => {
      await openBatchWithApplicant(page, "A");
      await page.evaluate(() => {
        const limit = document.querySelector("[data-batch-execution-limit]");
        limit.value = "1";
        limit.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForFunction(() => !!window.EduOpsApp.state.batch?.catalogue);
      await page.evaluate(() => {
        const template = document.querySelector("[data-batch-template]");
        template.value = "T1";
        template.dispatchEvent(new Event("change", { bubbles: true }));
        document.querySelector("[data-batch-preview]").click();
      });
      await page.waitForFunction(() => window.EduOpsApp.state.batch?.step === "partitions");
      await page.evaluate(() => {
        document.querySelector("[data-batch-continue]").click();
        document.querySelector("[data-batch-confirm]").click();
      });
      const state = await page.evaluate(() => ({
        executeDisabled: document.querySelector("[data-batch-execute]")?.disabled === true,
        executeCalls: window.__rpcControl.count("eduops_executeCommand"),
        receipt: window.EduOpsApp.state.batch?.receipt || null
      }));
      assert.equal(state.executeDisabled, true);
      assert.equal(state.executeCalls, 0);
      assert.equal(state.receipt, null);
    });

    await scenario("I population integrity exact contract disables only Batch authority", async (page) => {
      const result = await page.evaluate(async () => {
        const app = window.EduOpsApp;
        const safe = JSON.parse(JSON.stringify(app.state.workload.populationIntegrity));
        const malformed = [
          Object.assign({}, safe, { schemaVersion: "CANONICAL_POPULATION_INTEGRITY_V0", blockReason: "Wrong schema." }),
          Object.assign({}, safe, { status: "WARN", blockReason: "Non-PASS status." }),
          Object.assign({}, safe, { authoritySafeToBatch: false, blockReason: "Authority flag is false." }),
          Object.assign({}, safe, { integrityFingerprint: "", blockReason: "Fingerprint is missing." }),
          Object.assign({}, safe, { populationCount: 4, distinctApplicantIdCount: 3, blockReason: "Counts are inconsistent." }),
          Object.assign({}, safe, { reconciliationFindings: [{ code: "UNEXPECTED" }], blockReason: "PASS evidence contains findings." })
        ];
        const decisions = [];
        for (const integrity of malformed) {
          window.__rpcControl.setPopulationIntegrity(integrity);
          await app.requestWorkload({ refreshSnapshot: true });
          decisions.push({
            batchAuthorityValid: app.state.workloadRequest.batchAuthorityValid,
            status: app.state.workloadRequest.populationIntegrityStatus,
            fingerprint: app.state.workloadRequest.populationIntegrityFingerprint,
            blockCode: app.state.workloadRequest.batchAuthorityCode,
            blockReason: app.state.workloadRequest.batchAuthorityReason,
            selectionDisabled: document.querySelector("#eduopsSelectVisible").disabled,
            rowCheckboxDisabled: document.querySelector("[data-select-applicant]")?.disabled
          });
        }
        const duplicate = Object.assign({}, safe, {
          status: "FAIL",
          authoritySafeToBatch: false,
          blockCode: "DUPLICATE_APPLICANT_ID",
          blockReason: "Duplicate ApplicantID requires canonical reconciliation.",
          populationCount: 3,
          scannedRowCount: 4,
          distinctApplicantIdCount: 2,
          duplicateApplicantIdCount: 1,
          duplicateApplicantIds: ["A"],
          duplicateRowReferences: [{ applicantId: "A", rowNumbers: [2, 3] }],
          reconciliationFindings: [{ code: "DUPLICATE_APPLICANT_ID" }],
          integrityFingerprint: "CPI-DUPLICATE"
        });
        window.__rpcControl.setPopulationIntegrity(duplicate);
        await app.requestWorkload({ refreshSnapshot: true });
        app.openBatch(null);
        return {
          decisions,
          rows: document.querySelectorAll("[data-open-applicant]").length,
          rowOpenDisabled: document.querySelector("[data-open-applicant='A']")?.disabled,
          startSessionDisabled: document.querySelector("#eduopsStartSession").disabled,
          batchDisabled: document.querySelector("#eduopsOpenBatch").disabled,
          batchReason: document.querySelector("#eduopsBatchReason").textContent,
          interaction: document.querySelector("#eduopsInteractionStatus").textContent,
          batch: app.state.batch
        };
      });
      result.decisions.forEach((decision) => {
        assert.equal(decision.batchAuthorityValid, false);
        assert.equal(decision.status, "UNPROVEN");
        assert.equal(decision.blockCode, "POPULATION_INTEGRITY_UNPROVEN");
        assert.match(decision.blockReason, /not returned with an exact safe Batch fingerprint/i);
        assert.equal(decision.selectionDisabled, true);
        assert.equal(decision.rowCheckboxDisabled, true);
      });
      assert.equal(result.decisions[3].fingerprint, "", "A missing fingerprint must remain visibly unaccepted.");
      assert.equal(result.rows, 3);
      assert.equal(result.rowOpenDisabled, false, "Read-only applicant opening remains available.");
      assert.equal(result.startSessionDisabled, false, "Read-only Work Session navigation remains available.");
      assert.equal(result.batchDisabled, true);
      assert.equal(result.batchReason, "Duplicate ApplicantID requires canonical reconciliation.");
      assert.equal(result.interaction, "Duplicate ApplicantID requires canonical reconciliation.");
      assert.equal(result.batch, null);
      await page.locator("[data-open-applicant='A']").click();
      await page.waitForFunction(() => window.EduOpsApp.state.workbench?.identity?.applicantId === "A");
    });

    await scenario("I rotated receipt refresh accepts workload before exact Workbench and closes without a second refresh", async (page) => {
      const pending = await beginDeferredIndividualExecute(page, "A");
      const before = await page.evaluate(() => window.__rpcControl.count("eduops_queryOperationalWorkload"));
      await page.evaluate(() => window.__rpcControl.rotateSnapshot("R391B-SNAPSHOT-ROTATED", 100));
      await resolveDeferred(page, pending, { ok: true, receiptId: "RECEIPT-ROTATED", outcome: "COMPLETE", applicantOutcomes: [] });
      await page.waitForFunction(() =>
        window.EduOpsApp.state.workbench?.snapshotId === "R391B-SNAPSHOT-ROTATED"
        && window.EduOpsApp.state.workbench?.identity?.rowNumber === 111
      );
      const refreshed = await page.evaluate(() => {
        const workloadCalls = window.__rpcControl.calls("eduops_queryOperationalWorkload");
        const workbenchCalls = window.__rpcControl.calls("eduops_getApplicantWorkbench");
        const app = window.EduOpsApp;
        return {
          workloadCount: workloadCalls.length,
          workloadExpectedSnapshot: workloadCalls[workloadCalls.length - 1].payload.expectedSnapshotId,
          workbenchSnapshot: workbenchCalls[workbenchCalls.length - 1].payload.expectedSnapshotId,
          workbenchRow: workbenchCalls[workbenchCalls.length - 1].payload.rowNumber,
          receiptId: app.state.workbench.lastReceipt?.receiptId,
          freshnessSatisfied: app.state.workbench.receiptFreshnessSatisfied
        };
      });
      assert.equal(refreshed.workloadCount, before + 1);
      assert.equal(refreshed.workloadExpectedSnapshot, "", "Post-mutation workload must not pin the stale snapshot.");
      assert.equal(refreshed.workbenchSnapshot, "R391B-SNAPSHOT-ROTATED");
      assert.equal(refreshed.workbenchRow, 111);
      assert.equal(refreshed.receiptId, "RECEIPT-ROTATED");
      assert.equal(refreshed.freshnessSatisfied, true);
      const afterClose = await page.evaluate(async () => {
        const beforeClose = window.__rpcControl.count("eduops_queryOperationalWorkload");
        await window.EduOpsApp.closeWorkbench();
        return {
          beforeClose,
          afterClose: window.__rpcControl.count("eduops_queryOperationalWorkload")
        };
      });
      assert.equal(afterClose.afterClose, afterClose.beforeClose, "Closing a receipt-refreshed Workbench must not trigger a redundant second workload scan.");
    });

    await scenario("I rotated reusable-template save refreshes workload before exact Workbench", async (page) => {
      await openEditableCommunication(page, "A");
      await page.evaluate(() => {
        const subject = document.querySelector("#eduopsCommSubject");
        const body = document.querySelector("#eduopsCommBody");
        subject.value = "Saved subject A";
        body.value = "Saved body A";
        subject.dispatchEvent(new Event("input", { bubbles: true }));
        body.dispatchEvent(new Event("input", { bubbles: true }));
        window.__rpcControl.defer("admin_saveReusableCommunicationTemplate", 1);
        document.querySelector("[data-save-reusable-template]").click();
      });
      await page.waitForFunction(() => window.__rpcControl.pending("admin_saveReusableCommunicationTemplate").length === 1);
      const pending = (await page.evaluate(() => window.__rpcControl.pending("admin_saveReusableCommunicationTemplate")))[0];
      const before = await page.evaluate(() => window.__rpcControl.count("eduops_queryOperationalWorkload"));
      await page.evaluate(() => window.__rpcControl.rotateSnapshot("R391B-SNAPSHOT-TEMPLATE", 100));
      await resolveDeferred(page, pending, {
        ok: true,
        active: true,
        readBackVerified: true,
        templateId: "SAVED-A",
        parentMessageType: "fixture_message",
        versionId: "2"
      });
      await page.waitForFunction(() =>
        window.EduOpsApp.state.workbench?.snapshotId === "R391B-SNAPSHOT-TEMPLATE"
        && window.EduOpsApp.state.communicationDraft?.templateId === "SAVED-A"
      );
      const state = await page.evaluate(() => {
        const workloadCalls = window.__rpcControl.calls("eduops_queryOperationalWorkload");
        const workbenchCalls = window.__rpcControl.calls("eduops_getApplicantWorkbench");
        const app = window.EduOpsApp;
        return {
          workloadCount: workloadCalls.length,
          workloadExpectedSnapshot: workloadCalls[workloadCalls.length - 1].payload.expectedSnapshotId,
          workbenchSnapshot: workbenchCalls[workbenchCalls.length - 1].payload.expectedSnapshotId,
          workbenchRow: workbenchCalls[workbenchCalls.length - 1].payload.rowNumber,
          applicantId: app.state.workbench?.identity?.applicantId,
          rowNumber: app.state.workbench?.identity?.rowNumber,
          templateId: app.state.communicationDraft?.templateId,
          subject: app.state.communicationDraft?.subject,
          body: app.state.communicationDraft?.body,
          dirty: app.state.dirty
        };
      });
      assert.equal(state.workloadCount, before + 1);
      assert.equal(state.workloadExpectedSnapshot, "");
      assert.equal(state.workbenchSnapshot, "R391B-SNAPSHOT-TEMPLATE");
      assert.equal(state.workbenchRow, 111);
      assert.equal(state.applicantId, "A");
      assert.equal(state.rowNumber, 111);
      assert.equal(state.templateId, "SAVED-A");
      assert.equal(state.subject, "Saved subject A");
      assert.equal(state.body, "Saved body A");
      assert.equal(state.dirty, true);
    });

    await scenario("I delayed Open and Download Original callbacks cannot affect newer Workbench", async (page) => {
      await openWorkbench(page, "A");
      await page.evaluate(() => {
        const app = window.EduOpsApp;
        app.state.activeTab = "documents";
        app.renderWorkbenchPanel();
      });
      await page.waitForFunction(() => !!document.querySelector("[data-open-original]"));
      await page.evaluate(() => {
        const app = window.EduOpsApp;
        window.__fileActionFinishes = [];
        window.__fileActionToasts = [];
        window.__fileActionOpens = [];
        const finish = app.finishControlAction;
        const toast = app.toast;
        app.finishControlAction = function () { window.__fileActionFinishes.push(Array.from(arguments)); return finish.apply(app, arguments); };
        app.toast = function (message) { window.__fileActionToasts.push(String(message || "")); return toast.call(app, message); };
        window.open = function (url) { window.__fileActionOpens.push(String(url || "")); };
        window.__rpcControl.defer("eduops_getDocumentFileAction", 2);
        document.querySelector("[data-open-original]").click();
        document.querySelector("[data-download-original]").click();
      });
      await page.waitForFunction(() => window.__rpcControl.pending("eduops_getDocumentFileAction").length === 2);
      await openWorkbench(page, "B");
      const pending = await page.evaluate(() => window.__rpcControl.pending("eduops_getDocumentFileAction"));
      await resolveDeferred(page, pending[0], { ok: true, url: "https://example.test/a-original" });
      await page.evaluate((id) => window.__rpcControl.reject(id, "A download failed late"), pending[1].id);
      await flushUi(page);
      const state = await page.evaluate(() => ({
        applicantId: window.EduOpsApp.state.workbench?.identity?.applicantId,
        finishes: window.__fileActionFinishes.length,
        toasts: window.__fileActionToasts.length,
        opens: window.__fileActionOpens.length
      }));
      assert.deepEqual(state, { applicantId: "B", finishes: 0, toasts: 0, opens: 0 });
    });

    await scenario("I Operations pending error and bootstrap failure neutralize all compact and expanded context", async (page) => {
      await page.evaluate(() => {
        window.__rpcControl.defer("eduops_queryOperationalWorkload", 1);
        window.EduOpsApp.state.actionabilityState = "REVIEW_REQUIRED";
        window.EduOpsApp.requestWorkload();
      });
      const loading = await page.evaluate(() => ({
        compactContext: document.querySelector("#eduopsOperationsQueueContext").textContent,
        toolbarState: document.querySelector("#eduopsOperationsToolbarState").textContent,
        toolbarPackage: document.querySelector("#eduopsOperationsToolbarPackage").textContent,
        compactStats: document.querySelector("#eduopsQueueCompactStats").textContent,
        expandedContext: document.querySelector("#eduopsOperationsWorkspaceContext").textContent,
        expandedHeading: document.querySelector("#eduopsOperationsWorkspaceHeading").textContent,
        expandedSnapshot: document.querySelector("#eduopsOperationsWorkspaceSnapshot").textContent
      }));
      assert.match(loading.compactContext, /Loading workload/);
      assert.doesNotMatch(loading.compactContext, /Matched|Fixture package/);
      assert.equal(loading.toolbarState, "Loading workload");
      assert.equal(loading.toolbarPackage, "No current package");
      assert.equal(loading.compactStats, "Loading requested workload · selection unavailable");
      assert.equal(loading.expandedContext, "Loading workload");
      assert.match(loading.expandedHeading, /Reconciling/);
      assert.equal(loading.expandedSnapshot, "Snapshot pending");
      const pending = (await page.evaluate(() => window.__rpcControl.pending("eduops_queryOperationalWorkload")))[0];
      await page.evaluate((id) => window.__rpcControl.reject(id, "Forced Operations failure"), pending.id);
      await page.waitForFunction(() => document.querySelector("#eduopsApp").getAttribute("data-workload-phase") === "FAILURE");
      const failure = await page.evaluate(() => ({
        compactContext: document.querySelector("#eduopsOperationsQueueContext").textContent,
        toolbarState: document.querySelector("#eduopsOperationsToolbarState").textContent,
        toolbarPackage: document.querySelector("#eduopsOperationsToolbarPackage").textContent,
        compactStats: document.querySelector("#eduopsQueueCompactStats").textContent,
        expandedContext: document.querySelector("#eduopsOperationsWorkspaceContext").textContent,
        expandedHeading: document.querySelector("#eduopsOperationsWorkspaceHeading").textContent,
        expandedSnapshot: document.querySelector("#eduopsOperationsWorkspaceSnapshot").textContent
      }));
      assert.match(failure.compactContext, /Workload unavailable/);
      assert.doesNotMatch(failure.compactContext, /Matched|Fixture package/);
      assert.equal(failure.toolbarState, "Workload unavailable");
      assert.equal(failure.toolbarPackage, "No current package");
      assert.equal(failure.compactStats, "Workload unavailable · selection unavailable");
      assert.equal(failure.expandedContext, "Workload unavailable");
      assert.match(failure.expandedHeading, /unavailable/i);
      assert.equal(failure.expandedSnapshot, "Snapshot unavailable");
      const bootstrap = await page.evaluate(() => {
        window.EduOpsApp.renderBootstrapError("WORKLOAD_ERROR", new Error("Forced bootstrap failure"));
        return {
          compactContext: document.querySelector("#eduopsOperationsQueueContext").textContent,
          toolbarState: document.querySelector("#eduopsOperationsToolbarState").textContent,
          toolbarPackage: document.querySelector("#eduopsOperationsToolbarPackage").textContent,
          compactStats: document.querySelector("#eduopsQueueCompactStats").textContent,
          expandedSnapshot: document.querySelector("#eduopsOperationsWorkspaceSnapshot").textContent
        };
      });
      assert.match(bootstrap.compactContext, /Workload unavailable/);
      assert.equal(bootstrap.toolbarState, "Workload unavailable");
      assert.equal(bootstrap.toolbarPackage, "No current package");
      assert.equal(bootstrap.compactStats, "Workload unavailable · selection unavailable");
      assert.equal(bootstrap.expandedSnapshot, "Snapshot unavailable");
    });

    await scenario("I direct search row identity mismatch fails closed", async (page) => {
      await page.evaluate(() => {
        window.__rpcControl.setSearchMatches([window.__rpcControl.makeRow("A", 999, "READY")]);
        const input = document.querySelector("#eduopsGlobalSearch");
        input.value = "A";
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await page.waitForFunction(() => !!document.querySelector("[data-search-open='A']"));
      await page.locator("[data-search-open='A']").click();
      await page.waitForFunction(() => window.EduOpsApp.state.workbenchRequest.phase === "FAILURE");
      const state = await page.evaluate(() => {
        const calls = window.__rpcControl.calls("eduops_getApplicantWorkbench");
        return {
          expectedRowNumber: calls[calls.length - 1].payload.rowNumber,
          workbench: window.EduOpsApp.state.workbench,
          panel: document.querySelector("#eduopsWorkbenchPanel").textContent
        };
      });
      assert.equal(state.expectedRowNumber, 999);
      assert.equal(state.workbench, null);
      assert.match(state.panel, /row identity did not match/i);
    });

    await scenario("I Workbench wrong snapshot response fails closed", async (page) => {
      await page.evaluate(() => {
        window.__rpcControl.defer("eduops_getApplicantWorkbench", 1);
        window.__wrongSnapshotOutcome = window.EduOpsApp.openWorkbench("A", null, "overview").catch((error) => ({ error: error.message }));
      });
      await page.waitForFunction(() => window.__rpcControl.pending("eduops_getApplicantWorkbench").length === 1);
      const pending = (await page.evaluate(() => window.__rpcControl.pending("eduops_getApplicantWorkbench")))[0];
      const response = await page.evaluate(() => {
        const value = window.__rpcControl.makeWorkbench("A");
        value.snapshotId = "WRONG-SNAPSHOT";
        return value;
      });
      await resolveDeferred(page, pending, response);
      const state = await page.evaluate(async () => ({
        outcome: await window.__wrongSnapshotOutcome,
        workbench: window.EduOpsApp.state.workbench,
        phase: window.EduOpsApp.state.workbenchRequest.phase
      }));
      assert.match(state.outcome.error, /snapshot did not match/i);
      assert.equal(state.workbench, null);
      assert.equal(state.phase, "FAILURE");
    });

    await scenario("I stale Workbench rejection cannot overwrite a newer workload", async (page) => {
      await page.evaluate(() => {
        window.__rpcControl.defer("eduops_getApplicantWorkbench", 1);
        window.__staleWorkbenchRejection = window.EduOpsApp.openWorkbench("A", null, "overview");
      });
      await page.waitForFunction(() => window.__rpcControl.pending("eduops_getApplicantWorkbench").length === 1);
      await page.evaluate(async () => {
        window.EduOpsApp.state.actionabilityState = "REVIEW_REQUIRED";
        await window.EduOpsApp.requestWorkload();
      });
      const pending = (await page.evaluate(() => window.__rpcControl.pending("eduops_getApplicantWorkbench")))[0];
      await page.evaluate((id) => window.__rpcControl.reject(id, "Older Workbench failed late"), pending.id);
      const state = await page.evaluate(async () => ({
        outcome: await window.__staleWorkbenchRejection,
        workload: window.EduOpsApp.state.workload?.actionabilityState,
        rows: Array.from(document.querySelectorAll("[data-applicant-row]")).map((row) => row.getAttribute("data-applicant-row")),
        phase: window.EduOpsApp.state.workbenchRequest.phase,
        errorRendered: /Workbench unavailable/.test(document.querySelector("#eduopsWorkbenchPanel").textContent)
      }));
      assert.equal(state.outcome.accepted, false);
      assert.equal(state.outcome.outcome, "DISCARDED_STALE_WORKLOAD_IDENTITY");
      assert.equal(state.workload, "REVIEW_REQUIRED");
      assert.deepEqual(state.rows, ["R1", "R2"]);
      assert.equal(state.phase, "DISCARDED_WORKLOAD_IDENTITY");
      assert.equal(state.errorRendered, false);
    });

    await scenario("I stale reusable-template save invalidates global authority without applying A draft to B", async (page) => {
      await openEditableCommunication(page, "A");
      await page.evaluate(() => {
        const subject = document.querySelector("#eduopsCommSubject");
        const body = document.querySelector("#eduopsCommBody");
        subject.value = "A subject";
        body.value = "A body";
        subject.dispatchEvent(new Event("input", { bubbles: true }));
        body.dispatchEvent(new Event("input", { bubbles: true }));
        window.__rpcControl.defer("admin_saveReusableCommunicationTemplate", 1);
        document.querySelector("[data-save-reusable-template]").click();
      });
      await page.waitForFunction(() => window.__rpcControl.pending("admin_saveReusableCommunicationTemplate").length === 1);
      const pending = (await page.evaluate(() => window.__rpcControl.pending("admin_saveReusableCommunicationTemplate")))[0];
      await page.evaluate(() => {
        const app = window.EduOpsApp;
        app.openWorkbench("B", null, "communications");
        app.state.confirm.onProceed();
      });
      await page.waitForFunction(() => window.EduOpsApp.state.workbench?.identity?.applicantId === "B");
      await page.evaluate(() => {
        const app = window.EduOpsApp;
        app.state.activeTab = "communications";
        app.renderWorkbenchPanel();
        document.querySelector("[data-communication-template='BASE_TEMPLATE']").click();
        const subject = document.querySelector("#eduopsCommSubject");
        const body = document.querySelector("#eduopsCommBody");
        subject.value = "B subject";
        body.value = "B body";
        subject.dispatchEvent(new Event("input", { bubbles: true }));
        body.dispatchEvent(new Event("input", { bubbles: true }));
        app.state.commandPreview = { previewId: "B-PREVIEW" };
        app.state.commandIdempotencyKey = "B-KEY";
        app.state.commandExecutable = true;
        window.__staleSaveFinishes = 0;
        window.__staleSaveToasts = 0;
        const finish = app.finishControlAction;
        const toast = app.toast;
        app.finishControlAction = function () { window.__staleSaveFinishes += 1; return finish.apply(app, arguments); };
        app.toast = function (message) { window.__staleSaveToasts += 1; return toast.call(app, message); };
      });
      const workloadBefore = await page.evaluate(() => window.__rpcControl.count("eduops_queryOperationalWorkload"));
      await resolveDeferred(page, pending, {
        ok: true,
        active: true,
        readBackVerified: true,
        templateId: "SAVED-A-LATE",
        parentMessageType: "fixture_message",
        versionId: "3"
      });
      const state = await page.evaluate(() => ({
        applicantId: window.EduOpsApp.state.workbench?.identity?.applicantId,
        subject: document.querySelector("#eduopsCommSubject")?.value,
        body: document.querySelector("#eduopsCommBody")?.value,
        dirty: window.EduOpsApp.state.dirty,
        commandPreview: window.EduOpsApp.state.commandPreview,
        projectionFresh: window.EduOpsApp.state.workloadRequest.projectionFresh,
        batchAuthority: window.EduOpsApp.state.workloadRequest.batchAuthorityValid,
        workloadCalls: window.__rpcControl.count("eduops_queryOperationalWorkload"),
        finishes: window.__staleSaveFinishes,
        toasts: window.__staleSaveToasts
      }));
      assert.equal(state.applicantId, "B");
      assert.equal(state.subject, "B subject");
      assert.equal(state.body, "B body");
      assert.equal(state.dirty, true);
      assert.equal(state.commandPreview, null, "A successful global template mutation invalidates B's prior preview authority.");
      assert.equal(state.projectionFresh, false);
      assert.equal(state.batchAuthority, false);
      assert.equal(state.workloadCalls, workloadBefore);
      assert.equal(state.finishes, 0);
      assert.equal(state.toasts, 0);
    });

    await scenario("I late individual receipt refreshes globally without mutating B draft controls", async (page) => {
      const pending = await beginDeferredIndividualExecute(page, "A");
      await page.evaluate(() => {
        const app = window.EduOpsApp;
        app.openWorkbench("B", null, "contactability");
        app.state.confirm.onProceed();
      });
      await page.waitForFunction(() => window.EduOpsApp.state.workbench?.identity?.applicantId === "B");
      const before = await page.evaluate(() => {
        const app = window.EduOpsApp;
        app.state.activeTab = "contactability";
        app.renderWorkbenchPanel();
        const reason = document.querySelector("#eduopsContactReason");
        reason.value = "B dirty reason";
        reason.dispatchEvent(new Event("input", { bubbles: true }));
        app.state.commandPreview = { previewId: "B-PREVIEW" };
        app.state.commandIdempotencyKey = "B-KEY";
        app.state.commandExecutable = true;
        document.querySelector("#eduopsToast").textContent = "B toast";
        window.__lateReceiptFinishes = 0;
        const finish = app.finishControlAction;
        app.finishControlAction = function () { window.__lateReceiptFinishes += 1; return finish.apply(app, arguments); };
        return window.__rpcControl.count("eduops_queryOperationalWorkload");
      });
      await resolveDeferred(page, pending, { ok: true, receiptId: "A-LATE-RECEIPT", outcome: "COMPLETE", applicantOutcomes: [] });
      await page.waitForFunction((count) =>
        window.__rpcControl.count("eduops_queryOperationalWorkload") === count + 1
        && window.EduOpsApp.hasCurrentWorkload()
      , before);
      const state = await page.evaluate(() => ({
        applicantId: window.EduOpsApp.state.workbench?.identity?.applicantId,
        dirty: window.EduOpsApp.state.dirty,
        reason: document.querySelector("#eduopsContactReason")?.value,
        commandPreview: window.EduOpsApp.state.commandPreview,
        workloadCalls: window.__rpcControl.count("eduops_queryOperationalWorkload"),
        finishes: window.__lateReceiptFinishes,
        toast: document.querySelector("#eduopsToast").textContent
      }));
      assert.equal(state.applicantId, "B");
      assert.equal(state.dirty, true);
      assert.equal(state.reason, "B dirty reason");
      assert.equal(state.commandPreview, null, "A real receipt invalidates global operation authority.");
      assert.equal(state.workloadCalls, before + 1);
      assert.equal(state.finishes, 0);
      assert.equal(state.toast, "B toast");
    });

    await scenario("I late individual execute rejection cannot mutate B controls or workload freshness", async (page) => {
      const pending = await beginDeferredIndividualExecute(page, "A");
      await page.evaluate(() => {
        const app = window.EduOpsApp;
        app.openWorkbench("B", null, "contactability");
        app.state.confirm.onProceed();
      });
      await page.waitForFunction(() => window.EduOpsApp.state.workbench?.identity?.applicantId === "B");
      const before = await page.evaluate(() => {
        const app = window.EduOpsApp;
        app.state.activeTab = "contactability";
        app.renderWorkbenchPanel();
        const reason = document.querySelector("#eduopsContactReason");
        reason.value = "B rejection-safe draft";
        reason.dispatchEvent(new Event("input", { bubbles: true }));
        app.state.commandPreview = { previewId: "B-REJECTION-PREVIEW" };
        app.state.commandIdempotencyKey = "B-REJECTION-KEY";
        app.state.commandExecutable = true;
        document.querySelector("#eduopsToast").textContent = "B rejection toast";
        window.__lateRejectFinishes = 0;
        const finish = app.finishControlAction;
        app.finishControlAction = function () { window.__lateRejectFinishes += 1; return finish.apply(app, arguments); };
        return window.__rpcControl.count("eduops_queryOperationalWorkload");
      });
      await page.evaluate((id) => window.__rpcControl.reject(id, "A execute rejected late"), pending.id);
      await flushUi(page);
      const state = await page.evaluate(() => ({
        applicantId: window.EduOpsApp.state.workbench?.identity?.applicantId,
        dirty: window.EduOpsApp.state.dirty,
        reason: document.querySelector("#eduopsContactReason")?.value,
        previewId: window.EduOpsApp.state.commandPreview?.previewId,
        executable: window.EduOpsApp.state.commandExecutable,
        projectionFresh: window.EduOpsApp.state.workloadRequest.projectionFresh,
        workloadCalls: window.__rpcControl.count("eduops_queryOperationalWorkload"),
        finishes: window.__lateRejectFinishes,
        toast: document.querySelector("#eduopsToast").textContent
      }));
      assert.equal(state.applicantId, "B");
      assert.equal(state.dirty, true);
      assert.equal(state.reason, "B rejection-safe draft");
      assert.equal(state.previewId, "B-REJECTION-PREVIEW");
      assert.equal(state.executable, true);
      assert.equal(state.projectionFresh, true);
      assert.equal(state.workloadCalls, before);
      assert.equal(state.finishes, 0);
      assert.equal(state.toast, "B rejection toast");
    });

    await scenario("I Batch preview rejects mismatched population integrity fingerprint", async (page) => {
      await openBatchWithApplicant(page, "A");
      await page.evaluate(() => {
        const limit = document.querySelector("[data-batch-execution-limit]");
        limit.value = "1";
        limit.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForFunction(() => !!window.EduOpsApp.state.batch?.catalogue);
      await page.evaluate(() => {
        const template = document.querySelector("[data-batch-template]");
        template.value = "T1";
        template.dispatchEvent(new Event("change", { bubbles: true }));
        window.__rpcControl.defer("eduops_previewCommand", 1);
        document.querySelector("[data-batch-preview]").click();
      });
      await page.waitForFunction(() => window.__rpcControl.pending("eduops_previewCommand").length === 1);
      const pending = (await page.evaluate(() => window.__rpcControl.pending("eduops_previewCommand")))[0];
      const mismatch = await page.evaluate((payload) => {
        const value = window.__rpcControl.makeBatchPreview(payload, "WRONG-INTEGRITY");
        value.selectionBinding.integrityFingerprint = "CPI-WRONG";
        return value;
      }, pending.payload);
      await resolveDeferred(page, pending, mismatch);
      const state = await page.evaluate(() => ({
        executable: window.EduOpsApp.state.batch?.preview?.executable,
        reason: window.EduOpsApp.state.batch?.preview?.statusReason,
        acceptedIdentity: window.EduOpsApp.state.batch?.acceptedPreviewIdentity
      }));
      assert.equal(state.executable, false);
      assert.match(state.reason, /selection binding did not match/i);
      assert.equal(state.acceptedIdentity, null);
    });

    await scenario("I Batch close after prohibition leaves no stale receipt path", async (page) => {
      const pageErrors = [];
      page.on("pageerror", (error) => pageErrors.push(error.message));
      await openBatchWithApplicant(page, "A");
      const before = await page.evaluate(() => window.__rpcControl.count("eduops_executeCommand"));
      await page.evaluate(() => window.EduOpsApp.closeBatch());
      await flushUi(page);
      const state = await page.evaluate(() => ({
        batch: window.EduOpsApp.state.batch,
        executeCalls: window.__rpcControl.count("eduops_executeCommand"),
        confirm: window.EduOpsApp.state.confirm
      }));
      assert.equal(state.batch, null);
      assert.equal(state.executeCalls, before);
      assert.equal(state.confirm, null);
      assert.deepEqual(pageErrors, []);
    });

    await scenario("I prohibited Batch never fabricates a receipt", async (page) => {
      await openBatchWithApplicant(page, "A");
      await page.evaluate(() => {
        const limit = document.querySelector("[data-batch-execution-limit]");
        limit.value = "1";
        limit.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await page.waitForFunction(() => !!window.EduOpsApp.state.batch?.catalogue);
      await page.evaluate(() => {
        const template = document.querySelector("[data-batch-template]");
        template.value = "T1";
        template.dispatchEvent(new Event("change", { bubbles: true }));
        document.querySelector("[data-batch-preview]").click();
      });
      await page.waitForFunction(() => window.EduOpsApp.state.batch?.step === "partitions");
      await page.evaluate(() => {
        document.querySelector("[data-batch-continue]").click();
        document.querySelector("[data-batch-confirm]").click();
      });
      const state = await page.evaluate(() => ({
        executeDisabled: document.querySelector("[data-batch-execute]")?.disabled === true,
        executeCalls: window.__rpcControl.count("eduops_executeCommand"),
        receipt: window.EduOpsApp.state.batch?.receipt || null
      }));
      assert.equal(state.executeDisabled, true);
      assert.equal(state.executeCalls, 0);
      assert.equal(state.receipt, null);
    });

    await scenario("H bootstrap retry generation", async (page) => {
      await page.evaluate(() => {
        window.__rpcControl.defer("eduops_getAccessProjection", 2);
        window.__rpcControl.defer("eduops_getProfile", 2);
        window.__bootstrapOlder = window.EduOpsApp.retryBootstrap();
        window.__bootstrapNewer = window.EduOpsApp.retryBootstrap();
      });
      await page.waitForFunction(() => window.__rpcControl.pending("eduops_getAccessProjection").length === 2);
      await page.waitForFunction(() => window.__rpcControl.pending("eduops_getProfile").length === 2);
      const access = await page.evaluate(() => window.__rpcControl.pending("eduops_getAccessProjection"));
      const profiles = await page.evaluate(() => window.__rpcControl.pending("eduops_getProfile"));
      const olderAccess = access[0];
      const newerAccess = access[1];
      const olderProfile = profiles[0];
      const newerProfile = profiles[1];
      const gen2Access = await page.evaluate(() => window.__rpcControl.makeAccess("GEN2"));
      const gen2Profile = await page.evaluate(() => window.__rpcControl.makeProfile("GEN2", "REVIEW_REQUIRED"));
      await resolveDeferred(page, newerAccess, gen2Access);
      await resolveDeferred(page, newerProfile, gen2Profile);
      await page.waitForFunction(() => window.EduOpsApp.state.profile?.fixtureLabel === "GEN2");
      const gen1Access = await page.evaluate(() => window.__rpcControl.makeAccess("GEN1"));
      await resolveDeferred(page, olderAccess, gen1Access);
      const gen1Profile = await page.evaluate(() => window.__rpcControl.makeProfile("GEN1", "READY"));
      await resolveDeferred(page, olderProfile, gen1Profile);
      await flushUi(page);
      const finalState = await page.evaluate(() => ({
        access: window.EduOpsApp.state.access?.fixtureLabel,
        profile: window.EduOpsApp.state.profile?.fixtureLabel,
        actionabilityState: window.EduOpsApp.state.actionabilityState,
        bootstrapState: window.EduOpsApp.bootstrapMachine?.state
      }));
      assert.deepEqual(finalState, {
        access: "GEN2",
        profile: "GEN2",
        actionabilityState: "REVIEW_REQUIRED",
        bootstrapState: "INTERACTIVE"
      });
    });

    await scenario("H bootstrap workload dedupe is generation-bound", async (page) => {
      await page.evaluate(() => {
        window.__rpcControl.defer("eduops_queryOperationalWorkload", 2);
        window.__bootstrapWorkloadOlder = window.EduOpsApp.retryBootstrap();
      });
      await page.waitForFunction(() => window.__rpcControl.pending("eduops_queryOperationalWorkload").length === 1);
      await page.evaluate(() => {
        window.__bootstrapOlderGeneration = window.EduOpsApp.bootstrapMachine.generation;
        window.__bootstrapWorkloadNewer = window.EduOpsApp.retryBootstrap();
      });
      await page.waitForFunction(() => window.__rpcControl.pending("eduops_queryOperationalWorkload").length === 2);
      const pending = await page.evaluate(() => window.__rpcControl.pending("eduops_queryOperationalWorkload"));
      await resolveDeferred(page, pending[0]);
      const mid = await page.evaluate(() => ({
        state: window.EduOpsApp.bootstrapMachine.state,
        generation: window.EduOpsApp.bootstrapMachine.generation,
        acceptedGeneration: window.EduOpsApp.bootstrapMachine.acceptedGeneration,
        workloadAccepted: window.EduOpsApp.state.workloadRequest.acceptedGeneration,
        workloadLatest: window.EduOpsApp.state.workloadRequest.latestGeneration
      }));
      assert.notEqual(mid.state, "INTERACTIVE", "A discarded older bootstrap workload must not establish INTERACTIVE.");
      assert.notEqual(mid.workloadAccepted, mid.workloadLatest);
      await resolveDeferred(page, pending[1]);
      const finalState = await page.evaluate(async () => ({
        older: await window.__bootstrapWorkloadOlder,
        newer: await window.__bootstrapWorkloadNewer,
        state: window.EduOpsApp.bootstrapMachine.state,
        generation: window.EduOpsApp.bootstrapMachine.generation,
        acceptedGeneration: window.EduOpsApp.bootstrapMachine.acceptedGeneration,
        workloadAccepted: window.EduOpsApp.state.workloadRequest.acceptedGeneration,
        workloadLatest: window.EduOpsApp.state.workloadRequest.latestGeneration
      }));
      assert.equal(finalState.older.outcome, "DISCARDED_STALE_BOOTSTRAP");
      assert.equal(finalState.newer.accepted, true);
      assert.equal(finalState.newer.outcome, "COMPLETE");
      assert.equal(finalState.state, "INTERACTIVE");
      assert.equal(finalState.acceptedGeneration, finalState.generation);
      assert.equal(finalState.workloadAccepted, finalState.workloadLatest);
    });

    await scenario("Audit history clears empty, failure, and stale terminal states", async (page) => {
      await openWorkbench(page, "A");
      await page.evaluate(() => {
        const app = window.EduOpsApp;
        app.state.activeTab = "audit";
        app.renderWorkbenchPanel();
      });
      await page.waitForFunction(() => document.querySelector("#eduopsOperationHistory")?.getAttribute("data-history-state") === "SUCCESS");
      assert.match(await page.locator("#eduopsOperationHistory").innerText(), /No operation receipts returned/);

      await page.evaluate(() => {
        window.__rpcControl.defer("eduops_getOperationHistory", 1);
        window.EduOpsApp.renderWorkbenchPanel();
      });
      await page.waitForFunction(() => window.__rpcControl.pending("eduops_getOperationHistory").length === 1);
      let pending = (await page.evaluate(() => window.__rpcControl.pending("eduops_getOperationHistory")))[0];
      await page.evaluate((id) => window.__rpcControl.reject(id, "Forced history failure"), pending.id);
      await page.waitForFunction(() => document.querySelector("#eduopsOperationHistory")?.getAttribute("data-history-state") === "ERROR");
      assert.match(await page.locator("#eduopsOperationHistory").innerText(), /Forced history failure/);

      await page.evaluate(() => {
        window.__rpcControl.defer("eduops_getOperationHistory", 1);
        window.EduOpsApp.renderWorkbenchPanel();
      });
      await page.waitForFunction(() => window.__rpcControl.pending("eduops_getOperationHistory").length === 1);
      pending = (await page.evaluate(() => window.__rpcControl.pending("eduops_getOperationHistory")))[0];
      await page.evaluate(() => { window.EduOpsApp.state.workloadRequest.latestGeneration += 1; });
      await resolveDeferred(page, pending);
      await page.waitForFunction(() => document.querySelector("#eduopsOperationHistory")?.getAttribute("data-history-state") === "SUPERSEDED");
      assert.match(await page.locator("#eduopsOperationHistory").innerText(), /request superseded/i);
      assert.doesNotMatch(await page.locator("#eduopsOperationHistory").innerText(), /Loading operation history/);
    });

    await scenario("Audit history timeout clears a never-settled loader", async (page) => {
      await openWorkbench(page, "A");
      await page.evaluate(() => {
        window.__rpcControl.defer("eduops_getOperationHistory", 1);
        const app = window.EduOpsApp;
        app.state.activeTab = "audit";
        app.renderWorkbenchPanel();
      });
      await page.waitForFunction(() => document.querySelector("#eduopsOperationHistory")?.getAttribute("data-history-state") === "TIMEOUT");
      assert.match(await page.locator("#eduopsOperationHistory").innerText(), /timed out/i);
      assert.doesNotMatch(await page.locator("#eduopsOperationHistory").innerText(), /Loading operation history/);
    });

    await scenario("Blocked individual communication remains explicit and enters Audit history", async (page) => {
      await openEditableCommunication(page, "A");
      await page.locator("[data-preview-command='SEND_INDIVIDUAL_COMMUNICATION']").click();
      await page.waitForFunction(() => !!window.EduOpsApp.state.confirm && window.EduOpsApp.state.commandExecutable === true);
      await page.evaluate(() => {
        window.__rpcControl.defer("eduops_executeCommand", 1);
        window.EduOpsApp.state.confirm.onProceed();
      });
      await page.waitForFunction(() => window.__rpcControl.pending("eduops_executeCommand").length === 1);
      const pending = (await page.evaluate(() => window.__rpcControl.pending("eduops_executeCommand")))[0];
      await resolveDeferred(page, pending, {
        ok: false,
        schemaVersion: "EDUOPS_RECEIPT_V1",
        receiptId: "RECEIPT-BLOCKED",
        operationId: "OP-BLOCKED",
        previewId: "PREVIEW-BLOCKED",
        commandType: "SEND_INDIVIDUAL_COMMUNICATION",
        operation: "SEND_INDIVIDUAL_COMMUNICATION",
        eventType: "COMMUNICATION",
        outcome: "BLOCKED",
        blockCode: "COOLDOWN_ACTIVE",
        blockReason: "Fixture cooldown authority blocked final execution.",
        applicantOutcomes: []
      });
      await page.waitForSelector("[data-communication-receipt-outcome='BLOCKED']");
      const notice = await page.locator("[data-communication-receipt-outcome='BLOCKED']").innerText();
      assert.match(notice, /Communication was not sent/);
      assert.match(notice, /COOLDOWN_ACTIVE/);
      assert.match(notice, /Fixture cooldown authority blocked final execution/);
      assert.match(notice, /OP-BLOCKED/);
      assert.match(notice, /PREVIEW-BLOCKED/);
      assert.match(notice, /RECEIPT-BLOCKED/);
      assert.match(notice, /Recommended message/);
      assert.match(notice, /Action currently permitted/);

      await page.locator("[data-workbench-tab='audit']").click();
      await page.waitForFunction(() => document.querySelector("#eduopsOperationHistory")?.getAttribute("data-history-state") === "SUCCESS");
      const history = await page.locator("#eduopsOperationHistory").innerText();
      assert.match(history, /RECEIPT-BLOCKED/);
      assert.match(history, /COOLDOWN_ACTIVE/);
      assert.match(history, /Fixture cooldown authority blocked final execution/);
      assert.doesNotMatch(history, /SENT|COMPLETE/);
    });

    await scenario("Applicant-scoped manifest callback is generation-bound", async (page) => {
      await openWorkbench(page, "A");
      await page.evaluate(() => {
        window.__rpcControl.defer("eduops_getDocumentManifest", 1);
        window.EduOpsApp.state.activeTab = "documents";
        window.EduOpsApp.renderWorkbenchPanel();
      });
      await page.waitForFunction(() => window.__rpcControl.pending("eduops_getDocumentManifest").length === 1);
      const manifest = (await page.evaluate(() => window.__rpcControl.pending("eduops_getDocumentManifest")))[0];
      await openWorkbench(page, "B");
      await resolveDeferred(page, manifest);
      const state = await page.evaluate(() => ({
        workbench: window.EduOpsApp.state.workbench?.identity?.applicantId,
        manifest: window.EduOpsApp.state.documentManifest?.applicantId || null
      }));
      assert.equal(state.workbench, "B");
      assert.notEqual(state.manifest, "A", "Applicant A manifest must not attach to accepted applicant B");
    });
  } finally {
    await browser.close();
  }

  console.log("R391B deterministic client-state scaffold");
  console.log("PASS scenarios:", passes.length ? passes.join(", ") : "none");
  failures.forEach((failure) => console.error("EXPECTED_BASELINE_FAILURE", failure.name, "-", failure.message));
  assert.equal(
    failures.length,
    0,
    "R391B client-state blockers remain: " + failures.map((failure) => failure.name).join(", ")
  );
}

run().catch((error) => {
  console.error(error.stack || error);
  process.exit(1);
});
