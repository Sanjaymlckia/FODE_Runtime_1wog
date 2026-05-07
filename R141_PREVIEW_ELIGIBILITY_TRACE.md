# R141 Preview Eligibility Trace Audit

Date: 2026-05-07

## 1. Runtime Baseline

Commands run:

```text
git status -sb
## main...origin/main
 M Admin.js
 M AdminUI.html
 M CURRENT_TASK.md
 M Config.js
 M Utils.js

git log -1 --oneline
2983ce7 r138
```

Live whoami verification:

| Surface | URL | Result |
| --- | --- | --- |
| Admin | `https://script.google.com/macros/s/AKfycbxkuj6ElPa8xE9WJnECcW9u_hGNPMpd79F5Vhxgur-p7MCpmDF2HaLFIgx7yTYRC8aZ/exec?view=whoami` | `r140 / 140`, `mismatch=false` |
| Student | `https://script.google.com/macros/s/AKfycbxqTpEAJzk2NwFOumKTV0-bphasgPxM-kJHpbx5KobveYrhNtP5FbP0LJvL8kpA4PBv/exec?view=whoami` | `r140 / 140`, `mismatch=false` |

State note: r140 is deployed and pinned, but not committed. Current HEAD remains `r138`; the working tree contains uncommitted allowed-file r139/r140 changes.

## 2. Relevant Code Excerpts

### AdminUI.html - Preview Diagnostics Panel

Why it matters: these fields are the operator-visible r140 scan diagnostics.

```javascript
// AdminUI.html:504-516
<div class="box"><div class="k">Selected Stage</div><div class="v" id="diagPreviewStage">-</div></div>
<div class="box"><div class="k">Preview Candidate Count</div><div class="v" id="diagPreviewCandidateCount">-</div></div>
<div class="box"><div class="k">Blocked Count</div><div class="v" id="diagPreviewBlockedCount">-</div></div>
<div class="box"><div class="k">Already Processed</div><div class="v" id="diagPreviewAlreadyProcessed">-</div></div>
<div class="box"><div class="k">Limit Applied</div><div class="v" id="diagPreviewLimit">-</div></div>
<div class="box"><div class="k">Rows Scanned</div><div class="v" id="diagPreviewRowsScanned">-</div></div>
<div class="box"><div class="k">Scan Window</div><div class="v" id="diagPreviewScanWindow">-</div></div>
<div class="box"><div class="k">Scan Cap</div><div class="v" id="diagPreviewScanCap">-</div></div>
<div class="box"><div class="k">Elapsed</div><div class="v" id="diagPreviewElapsed">-</div></div>
<div class="box"><div class="k">Partial</div><div class="v" id="diagPreviewPartial">-</div></div>
<div class="box"><div class="k">Partial Reason</div><div class="v" id="diagPreviewPartialReason">-</div></div>
<div class="box"><div class="k">Preview Batch ID</div><div class="v" id="diagPreviewBatchId">-</div></div>
<div class="box"><div class="k">Replay Protection Active</div><div class="v" id="diagPreviewReplayActive">-</div></div>
```

### AdminUI.html - Diagnostics Rendering

Why it matters: confirms the UI consumes scan window, scan cap, elapsed, and partial reason from the RPC response.

```javascript
// AdminUI.html:1660-1685
function renderBatchPreviewDiagnostics_(res){
  var panel = document.getElementById("stageBatchPreviewDiagnostics");
  if (!panel) return;
  var isPreview = res && (String(res.action || "") === "preview_stage_batch" || batchState.action === "preview");
  if (!isPreview) {
    panel.classList.add("hidden");
    return;
  }
  var summary = res.idempotencySummary && typeof res.idempotencySummary === "object" ? res.idempotencySummary : {};
  function set(id, value){
    var el = document.getElementById(id);
    if (el) el.textContent = value === null || value === undefined || value === "" ? "-" : String(value);
  }
  set("diagPreviewStage", res.stage || batchState.selectedStage || "-");
  set("diagPreviewCandidateCount", Number(res.candidateCount != null ? res.candidateCount : res.count || 0));
  set("diagPreviewBlockedCount", Number(res.blockedCount != null ? res.blockedCount : res.blocked || 0));
  set("diagPreviewAlreadyProcessed", Number(res.alreadyProcessedCount != null ? res.alreadyProcessedCount : summary.alreadyProcessedCount || 0));
  set("diagPreviewLimit", Number(res.limit || res.previewLimit || 0));
  set("diagPreviewRowsScanned", Number(res.rowsScanned || 0));
  set("diagPreviewScanWindow", Number(res.rowsScanned || 0) > 0 ? (String(Number(res.scanStartRow || 0)) + "-" + String(Number(res.scanEndRow || 0))) : "-");
  set("diagPreviewScanCap", Number(res.scanCap || 0));
  set("diagPreviewElapsed", Number(res.elapsedMs || 0) ? (String(Math.round(Number(res.elapsedMs || 0) / 100) / 10) + "s") : "-");
  set("diagPreviewPartial", res.partial === true ? "YES" : "NO");
  set("diagPreviewPartialReason", res.partialReason || "-");
  set("diagPreviewBatchId", res.batchId || summary.batchId || "-");
  set("diagPreviewReplayActive", summary.active === true ? "YES" : "NO");
```

### AdminUI.html - Preview Button Handler, Payload, Timeout

Why it matters: this is the only browser call path for the Admin Preview Cohort button.

```javascript
// AdminUI.html:1835-1846
var STAGE_BATCH_PREVIEW_TIMEOUT_MS = 180000;
function previewStageBatchUi_(){
  var stage = batchState.selectedStage;
  var limit = getStageBatchLimitUi_();
  var offset = getStageBatchOffsetUi_();
  if (!stage || batchState.busy || !IS_SUPER) return;
  batchState.previewRequestSeq = Number(batchState.previewRequestSeq || 0) + 1;
  var requestSeq = batchState.previewRequestSeq;
  var clientRequestId = "preview-client-" + String(Date.now()) + "-" + String(requestSeq);
  var requestStartedAtMs = Date.now();
  var timeoutMs = STAGE_BATCH_PREVIEW_TIMEOUT_MS;
```

```javascript
// AdminUI.html:1964-1967
      renderBatchPanel();
    })
    .admin_previewStageBatch({ stage: stage, limit: limit, offset: offset });
}
```

### Admin.js - Stage Message Type

Why it matters: `INVITE_PENDING` maps to `legacy_invite`.

```javascript
// Admin.js:3334-3353
function normalizeStageBatchStage_(stage) {
  var normalized = clean_(stage || "").toUpperCase();
  if (!normalized || normalized === "UNKNOWN") return "";
  return stageAggregationSortIndex_(normalized) < 99 ? normalized : "";
}

function getBatchMessageTypeForStage_(stage) {
  var normalized = normalizeStageBatchStage_(stage);
  switch (normalized) {
    case "INVITE_PENDING":
      return "legacy_invite";
    case "INVITED_AWAITING_RESPONSE":
    case "REMINDER_DUE":
    case "DOCS_REQUIRED":
    case "PAYMENT_REQUIRED":
    case "RECEIPT_AWAITING_VERIFICATION":
      return "reminder";
```

### Admin.js - Stage Snapshot

Why it matters: preview uses lifecycle stage derivation before eligibility resolution.

```javascript
// Admin.js:2022-2048
function stageAggregationEffectiveEmail_(rowObj) {
  var row = rowObj || {};
  return clean_(row.Effective_Email || row.Parent_Email_Corrected || row.Parent_Email || "");
}

function stageAggregationIsValidEmail_(email) {
  var value = String(email || "").trim();
  if (!value) return false;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function stageAggregationSnapshot_(rowObj) {
  var row = rowObj || {};
  var stage = deriveApplicantLifecycleStage_(row);
  var actionability = deriveApplicantActionability_(row, stage, {
    getEffectiveEmail: stageAggregationEffectiveEmail_,
    isValidEmail: stageAggregationIsValidEmail_,
    getRecommendedMessageType: stageAggregationRecommendedMessageType_,
    resolveEligibility: false
  });

  return {
    stage: stage,
    priority: mapStagePriority_(stage),
    commStatus: actionability.commStatus,
    canSendNow: actionability.canSendNow
```

### Admin.js - Idempotency Summary

Why it matters: preview replay summary is computed after candidates are found; it does not drive candidate collection.

```javascript
// Admin.js:3457-3483
function buildBatchPreviewIdempotencySummary_(cohort, messageType, batchId) {
  var candidates = Array.isArray(cohort && cohort.candidates) ? cohort.candidates : [];
  var alreadyProcessedCount = Number(cohort && cohort.alreadySentExcluded || 0);
  var replaySamples = [];
  candidates.forEach(function (candidate) {
    var ctx = {
      applicantId: clean_(candidate && candidate.applicantId || ""),
      messageType: clean_(messageType || ""),
      rowObj: candidate && candidate.rowObj ? candidate.rowObj : {},
      emailStatus: clean_(candidate && candidate.emailStatus || ""),
      batchLabel: ""
    };
    var key = typeof computeEmailIdempotencyKey_ === "function" ? computeEmailIdempotencyKey_(ctx, { batchLabel: "" }) : "";
    var replay = typeof wasEmailAlreadyProcessed_ === "function" ? wasEmailAlreadyProcessed_(ctx, key) : { alreadyProcessed: false };
    if (replay && replay.alreadyProcessed) {
      alreadyProcessedCount++;
      if (replaySamples.length < 10) replaySamples.push(ctx.applicantId);
    }
  });
```

### Admin.js - Prior Success / Failed Exclusions

Why it matters: these are the pre-resolution exclusions in `collectStageBatchCohort_`.

```javascript
// Admin.js:3486-3504
function stageBatchShouldExcludeFailedDefault_(rowObj, messageType) {
  // Production invite batches skip prior hard failures for the same message type until an explicit retry flow is used.
  var normalizedType = normalizeApplicantMessageType_(messageType || "");
  if (!normalizedType) return false;
  var row = rowObj || {};
  var status = clean_(row.Email_Status || "").toUpperCase();
  var flag = clean_(row.Email_Bounce_Flag || "").toUpperCase();
  var reason = clean_(row.Email_Bounce_Reason || "");
  var reasonLower = reason.toLowerCase();
  if (status === "FAILED") {
    if (["HARD", "DOMAIN", "UNKNOWN"].indexOf(flag) >= 0) return true;
    if (reasonLower.indexOf("missing required alias") >= 0) return true;
    if (flag === "TEMP") {
      var nextActionMs = typeof parseTime_ === "function" ? parseTime_(row.Email_Next_Action_Date || "") : 0;
      return !(nextActionMs > 0 && nextActionMs <= new Date().getTime());
    }
  }
  var communicationState = deriveCommunicationState_(row, normalizedType, {});
  return communicationState.durablePriorFailureSameType === true;
}
```

```javascript
// Admin.js:3539-3545
function stageBatchShouldExcludePriorSuccessDefault_(rowObj, stage, messageType) {
  var normalizedType = normalizeApplicantMessageType_(messageType || "");
  if (!normalizedType) return false;
  var communicationState = deriveCommunicationState_(rowObj || {}, normalizedType, {});
  if (normalizedType === "legacy_invite") {
    return clean_(communicationState.base && communicationState.base.emailStatus || "") === "SENT";
```

### Admin.js - Preview Response Scan Fields

Why it matters: confirms r140 response carries scan diagnostics to the UI.

```javascript
// Admin.js:3615-3621
    scanStartRow: Number(src.scanStartRow || 0),
    scanEndRow: Number(src.scanEndRow || 0),
    rowsScanned: Number(src.rowsScanned || src.scanned || 0),
    scanCap: Number(src.scanCap || 0),
    requestedLimit: Number(src.requestedLimit || src.previewLimit || src.limit || 0),
    partial: src.partial === true,
    partialReason: clean_(src.partialReason || ""),
```

### Admin.js - Cohort Cursor and Scan Cap

Why it matters: r140 uses the existing cursor as a non-mutating start hint, then scans only the configured cap.

```javascript
// Admin.js:3720-3754
  var inviteStatefulFlow = normalizedStage === "INVITE_PENDING" || messageType === "legacy_invite";
  var phaseTimings = options.phaseTimings && typeof options.phaseTimings === "object" ? options.phaseTimings : {};
  phaseTimings.candidateSelectionMs = Number(phaseTimings.candidateSelectionMs || 0);
  phaseTimings.eligibilityFilteringMs = Number(phaseTimings.eligibilityFilteringMs || 0);
  phaseTimings.rowHydrationMs = Number(phaseTimings.rowHydrationMs || 0);
  phaseTimings.resolutionMs = Number(phaseTimings.resolutionMs || 0);
  phaseTimings.payloadAssemblyMs = Number(phaseTimings.payloadAssemblyMs || 0);
  var sh = openDataSheet_();
  var values = sh.getDataRange().getValues();
  var headers = (values && values.length) ? values[0] : [];
  ...
  var deterministicPreview = options.deterministicPreview === true;
  var eligibleCountBounded = false;
  var lastRow = values.length;
  var savedCursor = Math.max(2, getStageCursor_(normalizedStage, messageType));
  var cursor = savedCursor > lastRow ? 2 : savedCursor;
  var nextCursor = cursor;
  var scanned = 0;
  var scanStartRow = cursor;
  var scanEndRow = 0;
  var previewScanCap = deterministicPreview ? Math.max(1, Math.floor(Number(CONFIG.BATCH_PREVIEW_SCAN_ROW_CAP || 500))) : 0;
```

```javascript
// Admin.js:3775-3804
  for (var r = cursor - 1; r < values.length; r++) {
    if (previewScanCap > 0 && scanned >= previewScanCap) {
      scanStoppedByCap = true;
      break;
    }
    if (new Date().getTime() - startedAtMs > timeBudgetMs) {
      scanStoppedByTimeBudget = true;
      Logger.log("AUTO_STAGE_RUN_TIMEOUT_NEAR");
      break;
    }
    ...
    scanned++;
    scanEndRow = r + 1;
    nextCursor = r + 2;
    var applicantId = clean_(rowObj.ApplicantID || "");
    if (!applicantId) continue;
    if (clean_(rowObj.Email_Status || "").toUpperCase() === "SENT") {
      continue;
    }
```

### Admin.js - Candidate Inclusion / Exclusion

Why it matters: a row must first derive to the selected stage, then pass message, prior-success, failed, and resolution checks.

```javascript
// Admin.js:3805-3842
    var snapshot = stageAggregationSnapshot_(rowObj);
    phaseTimings.candidateSelectionMs += new Date().getTime() - candidateStartedAtMs;
    if (clean_(snapshot.stage || "").toUpperCase() !== normalizedStage) continue;
    totalInStage++;
    ...
    if (stageBatchShouldExcludePriorSuccessDefault_(rowObj, normalizedStage, messageType)) {
      alreadySentExcluded++;
      phaseTimings.eligibilityFilteringMs += new Date().getTime() - filterStartedAtMs;
      continue;
    }
    if (inviteStatefulFlow && stageBatchShouldExcludeFailedDefault_(rowObj, messageType)) {
      failedExcluded++;
      phaseTimings.eligibilityFilteringMs += new Date().getTime() - filterStartedAtMs;
      continue;
    }
    ...
    var resolved = resolveApplicantMessageContextFromRow_(rowObj, r + 1, sh, messageType, {
      action: "stageBatchCollect",
      actorEmail: actorEmail,
      actorRole: actorRole,
      debugId: debugId,
      applicantId: applicantId,
      requestId: requestId,
      previewMetrics: phaseTimings,
      portalSecretLookup: portalSecretLookup,
      cooldownLookup: cooldownLookup,
      skipPortalUrlBuild: !!portalSecretLookup
    });
```

### Admin.js - Preview RPC

Why it matters: this is the server entry point called by the UI.

```javascript
// Admin.js:3890-3918
function admin_previewStageBatch(payload) {
  return withEnvelope_("admin_previewStageBatch", function (dbgId) {
    var startedAtMs = new Date().getTime();
    var requestId = clean_(dbgId || newDebugId_());
    var stage = "";
    var messageType = "";
    var limit = 0;
    var requestedOffset = 0;
    var phaseTimings = {
      candidateSelectionMs: 0,
      eligibilityFilteringMs: 0,
      rowHydrationMs: 0,
      resolutionMs: 0,
      payloadAssemblyMs: 0
    };
    try {
      var adminEmail = getCallerEmail_();
      if (!isAdmin_(adminEmail)) throw new Error("Access denied");
      requireSuperAdmin_(adminEmail);
      var p = payload && typeof payload === "object" ? payload : {};
      var propertyGuard = buildScriptPropertyRegressionGuard_();
      if (!propertyGuard.ok) {
```

```javascript
// Admin.js:3988-4007
      if (sendable && typeof communicationRequiresPortalUrl_ === "function" && communicationRequiresPortalUrl_(messageType) && typeof buildPortalSecretPreviewLookup_ === "function") {
        previewPortalSecretLookup = buildPortalSecretPreviewLookup_();
      }
      var previewCooldownLookup = null;
      if (sendable && typeof buildCommunicationCooldownPreviewLookup_ === "function") {
        previewCooldownLookup = buildCommunicationCooldownPreviewLookup_(messageType);
      }
      var cohort = collectStageBatchCohort_(stage, limit, requestedOffset, {
        messageType: messageType,
        actorEmail: actor.actorEmail,
        actorRole: actor.actorRole,
        debugId: dbgId,
        requestId: requestId,
        phaseTimings: phaseTimings,
        portalSecretLookup: previewPortalSecretLookup && previewPortalSecretLookup.ok ? previewPortalSecretLookup : null,
        cooldownLookup: previewCooldownLookup && previewCooldownLookup.ok ? previewCooldownLookup : null,
        previewEarlyStop: true,
        previewEligibleBuffer: 2,
        deterministicPreview: true
```

### Code.js - Lifecycle Stage Derivation

Why it matters: most unsent rows still derive to `INVITE_PENDING`, but this derivation is independent of whether they are within the r140 scan window.

```javascript
// Code.js:6683-6719
function deriveApplicantLifecycleStage_(rowObj) {
  var row = rowObj || {};
  var emailStatus = normalizeEmailStatus_(row.Email_Status || "");
  var portalSubmittedActive = isCampaignPortalSubmittedActive_(row);
  var bounceFlag = isCampaignBounceFlagTrue_(row.Email_Bounce_Flag);
  var docsVerified = computeDocVerificationStatus_(row) === "Verified" || clean_(row.Docs_Verified || "") === "Yes";
  var paymentBadge = derivePaymentBadge_(row);
  var paymentVerified = paymentBadge === "Verified" || clean_(row.Payment_Verified || "") === "Yes";
  ...
  var stage = "INVITE_PENDING";

  if (paymentVerified) stage = "COMPLETE";
  else if (portalSubmittedActive || emailStatus === "RESPONDED") stage = "PROCESSING";
  else if (docsVerified && !paymentVerified && paymentBadge !== "Verified" && receiptEvidencePresent) stage = "RECEIPT_AWAITING_VERIFICATION";
  else if (docsVerified && !paymentVerified) stage = "PAYMENT_REQUIRED";
  else if (!docsVerified && (docSignals || docStage === "Rejected")) stage = "DOCS_REQUIRED";
  else if (reminderDue) stage = "REMINDER_DUE";
  else if (emailStatus === "SENT") stage = "INVITED_AWAITING_RESPONSE";

  return stage;
}
```

### Code.js - Communication State / Cooldown

Why it matters: eligibility uses effective email, normalized email status, portal submitted state, bounce flag, doc/payment state, and cooldown.

```javascript
// Code.js:6271-6328
function deriveCommunicationState_(rowObj, messageType, opts) {
  var row = rowObj || {};
  var options = opts && typeof opts === "object" ? opts : {};
  var normalizedType = normalizeApplicantMessageType_(messageType || "");
  var applicantId = clean_(row.ApplicantID || options.applicantId || "");
  var effectiveEmail = getCampaignEffectiveEmail_(row);
  var emailStatus = normalizeEmailStatus_(row.Email_Status || "");
  ...
  if (normalizedType) {
    if (cooldownLookup && cooldownLookup.byApplicantId) {
      cooldownLastSentAt = clean_(cooldownLookup.byApplicantId[applicantId] || "");
    } else {
      cooldownLastSentAt = getLastCommunicationSentAt_(applicantId, normalizedType);
    }
  }
  ...
    hasValidEffectiveEmail: isValidEffectiveEmail_(effectiveEmail),
    emailStatus: emailStatus,
    portalSubmittedActive: isCampaignPortalSubmittedActive_(row),
    bounceFlag: isCampaignBounceFlagTrue_(row.Email_Bounce_Flag),
```

### Code.js - Eligibility Predicate for `legacy_invite`

Why it matters: `legacy_invite` requires an applicant ID, valid effective email, no bounce/DO_NOT_CONTACT/cooldown, usable active portal secret, and no submitted portal.

```javascript
// Code.js:6548-6584
  if (!normalizedType) return block("UNKNOWN_MESSAGE_TYPE");
  if (!actor.isAdmin) return block("ROLE_BLOCKED");
  if (clean_(options.action || "") === "planBatch" && !actor.isSuper) return block("ROLE_BLOCKED");
  if (!context.applicantId) return block("APPLICANT_NOT_FOUND");

  if (!baseState.hasEffectiveEmail) return block("NO_EFFECTIVE_EMAIL");
  if (baseState.hasValidEffectiveEmail !== true) return block("INVALID_EMAIL", "Applicant does not have a valid email address.");
  if (baseState.bounceFlag) return block("BOUNCED", clean_(baseState.bounceReason || "") || communicationBlockReason_("BOUNCED", normalizedType));
  if (context.emailStatus === "DO_NOT_CONTACT") return block("DO_NOT_CONTACT");
  if (communicationState.cooldownActive) return block("COOLDOWN_ACTIVE");

  if (context.requiresPortalUrl) {
    var secretRes = null;
    if (portalSecretLookup && portalSecretLookup.byApplicantId) {
      var cachedSecret = portalSecretLookup.byApplicantId[context.applicantId] || null;
      if (!cachedSecret) return block("MISSING_PORTAL_SECRET");
      var cachedStatus = clean_(cachedSecret.status || "");
      if (portalSecretLookup.hasStatus === true && cachedStatus !== "Active") return block("INACTIVE_SECRET");
      if (!clean_(cachedSecret.secretPlain || "") || !clean_(cachedSecret.secretHash || "")) return block("UNUSABLE_SECRET");
      ...
  if ((normalizedType === "legacy_invite" || normalizedType === "reminder") && context.portalSubmittedActive) {
    return block("PORTAL_ALREADY_SUBMITTED");
```

### Code.js - Portal Secret Preview Lookup

Why it matters: runtime preview does not rely on `FODE_Data.PortalTokenHash`; it reads active usable rows from the separate `PortalSecrets` sheet.

```javascript
// Code.js:6419-6454
function buildPortalSecretPreviewLookup_() {
  try {
    var opened = openPortalSecretsExistingSheet_(newDebugId_(), { source: "config" });
    if (!opened || opened.ok !== true) throw new Error(clean_(opened && opened.code || "SECRET_LOOKUP_FAILED"));
    var secretsSheet = opened.sheet;
    var idx = getHeaderIndexMap_(secretsSheet);
    if (!idx.ApplicantID) throw new Error("PortalSecrets missing header: ApplicantID");
    var data = withSpreadsheetRetry_(function () {
      return secretsSheet.getDataRange().getValues();
    });
    var byApplicantId = {};
    for (var r = 1; r < data.length; r++) {
      var row = data[r] || [];
      var rec = normalizePortalSecretRow_(idx, row, r + 1);
      var applicantId = clean_(rec.applicantId || "");
      if (!applicantId) continue;
      if (idx.Status && rec.status !== "Active") {
        if (!byApplicantId[applicantId]) {
          byApplicantId[applicantId] = {
```

### Utils.js - Cooldown and Property Guard

Why it matters: preview reads Script Properties only for property inventory/cursor; cooldown is CacheService, not `COMM_LAST::*`.

```javascript
// Utils.js:1372-1388
function getCommunicationCooldownCacheKey_(applicantId, messageType) {
  var type = safeStr_(messageType || "").toLowerCase();
  var id = safeStr_(applicantId || "");
  var key = "COMM_COOLDOWN::" + type + "::" + id;
  return key.length <= 240 ? key : key.slice(0, 240);
}

function getCommunicationCooldownState_(applicantId, messageType) {
  var key = getCommunicationCooldownCacheKey_(applicantId, messageType);
  if (!safeStr_(applicantId || "") || !safeStr_(messageType || "")) return null;
  try {
    var raw = CacheService.getScriptCache().get(key);
```

```javascript
// Utils.js:1470-1485
function buildScriptPropertyRegressionGuard_() {
  var summary = typeof getPropertyInventorySummary_ === "function" ? getPropertyInventorySummary_() : null;
  var total = Number(summary && summary.totalPropertyCount || 0);
  var commLast = Number(summary && summary.commLastCount || 0);
  var expected = Math.max(0, Number(CONFIG.EXPECTED_SCRIPT_PROPERTY_COUNT_AFTER_CLEANUP || 0));
  var warning = "";
  if (commLast > 0) warning = "COMM_LAST_PROPERTY_REGRESSION";
  else if (expected && total > expected) warning = "SCRIPT_PROPERTY_COUNT_GREW";
  return {
    ok: !warning,
```

### Code.js - Idempotency Helpers

Why it matters: replay/idempotency is not the reason zero candidates are collected; it is applied to candidates after selection.

```javascript
// Code.js:6886-6912
function computeEmailIdempotencyKey_(context, opts) {
  var ctx = context && typeof context === "object" ? context : {};
  var options = opts && typeof opts === "object" ? opts : {};
  var applicantId = clean_(ctx.applicantId || options.applicantId || "");
  var messageType = clean_(ctx.messageType || options.messageType || "").toLowerCase();
  var batchId = clean_(options.batchId || options.batchLabel || ctx.batchLabel || "");
  return ["EMAIL", applicantId, messageType, batchId].join("::");
}

function wasEmailAlreadyProcessed_(context, idempotencyKey) {
  var ctx = context && typeof context === "object" ? context : {};
  var messageType = clean_(ctx.messageType || "").toLowerCase();
  var row = ctx.rowObj || {};
  var emailStatus = clean_(row.Email_Status || ctx.emailStatus || "").toUpperCase();
  var lastContactType = clean_(row.Last_Contact_Type || "").toLowerCase();
  var lastContactResult = clean_(row.Last_Contact_Result || "").toUpperCase();
  var lastContactBatch = clean_(row.Last_Contact_Batch || "");
```

## 3. Runtime Eligibility Pipeline

| Step | Input fields used | Output | Sheet read/write | Script Properties read/write |
| --- | --- | --- | --- | --- |
| Admin UI Preview Cohort click | `batchState.selectedStage`, batch size input, offset input | payload `{ stage, limit, offset }` | none | none |
| `admin_previewStageBatch(payload)` | admin caller, stage, limit, offset | preview response or block | reads Admin session context only | reads property inventory via guard |
| Portal/cooldown preloads | `messageType=legacy_invite` | portal secret lookup, empty cache cooldown lookup | reads `PortalSecrets` sheet | CacheService read only |
| `collectStageBatchCohort_` | data sheet rows, stage, message type, cursor hint, cap | cohort with candidates, blocked counts, scan diagnostics | reads `FODE_Data` full data range | reads stage cursor; r140 preview does not write cursor |
| stage derivation | `Email_Status`, `Portal_Submitted`, doc/payment/receipt fields, next-action date | lifecycle stage | none beyond row already read | none |
| exclusion predicates | `Email_Status`, `Email_Bounce_Flag`, `Email_Bounce_Reason`, `Last_Contact_*` | skip as prior success or failed | none | CacheService read only through communication state |
| eligibility resolution | `ApplicantID`, effective email, bounce flag, portal submitted, portal secret, cooldown | eligible or block code | may read PortalSecrets lookup already loaded | CacheService read only |
| idempotency summary | candidate row objects only | replay summary | none | CacheService read only |
| UI diagnostics | response scan/candidate fields | visible diagnostics | none | none |

Possible exclusion/block reasons in this path:

- Not selected stage: lifecycle stage is not `INVITE_PENDING`.
- Prior success: `Email_Status === SENT` for `legacy_invite`.
- Failed excluded: hard/domain/unknown/missing-alias failed rows or prior same-type failed result.
- `APPLICANT_NOT_FOUND`
- `NO_EFFECTIVE_EMAIL`
- `INVALID_EMAIL`
- `BOUNCED`
- `DO_NOT_CONTACT`
- `COOLDOWN_ACTIVE`
- `MISSING_PORTAL_SECRET`
- `INACTIVE_SECRET`
- `UNUSABLE_SECRET`
- `PORTAL_ALREADY_SUBMITTED`
- `PREVIEW_WINDOW_EXHAUSTED`

## 4. Live Data Comparison

CSV file status: `FODE_Applications_2026 - FODE_Data (11).csv` was not present under the local repo checkout. I used read-only live sheet export from:

`https://docs.google.com/spreadsheets/d/1fHmeGNmpOj9PEPQ5Fp4tUyCP4UdH70lltukraD4SalU`

Sheet metadata:

- Spreadsheet: `FODE_Applications_2026`
- Tab: `FODE_Data`
- Grid: `2902` rows including header, `292` columns

Read-only counts from selected live columns:

| Metric | Count |
| --- | ---: |
| data rows | 2901 |
| rows deriving to `INVITE_PENDING` by current source logic | 2129 |
| `Email_Status = SENT` | 757 |
| not `Email_Status = SENT` | 2144 |
| `Last_Contact_Result = FAILED` | 864 |
| `Last_Contact_Result = BLOCKED` | 34 |
| blank `Last_Contact_Result` | 1247 |
| syntactically valid `Parent_Email` | 2389 |
| syntactically valid effective email | 2389 |
| missing `Program` and `Program_Applied_For` | 2901 |
| missing intake fields | 29 |
| missing `PortalTokenHash` | 2879 |
| `INVITE_PENDING` rows missing `PortalTokenHash` | 1599 |
| `INVITE_PENDING` rows invalid effective email | 506 |
| `INVITE_PENDING` rows missing effective email | 4 |
| `INVITE_PENDING` rows missing applicant ID | 12 |
| candidate-looking rows from `FODE_Data` only | 8 |
| `INVITE_PENDING` rows in first 500 data rows | 0 |
| candidate-looking rows in first 500 data rows | 0 |

Important interpretation:

- The external observation that unsent rows remain is correct.
- The zero preview result is not explained by all rows being sent.
- The first 500-row r140 preview window from row 2 contains zero rows that derive to `INVITE_PENDING`.
- Candidate-looking rows are near the end of the sheet, not near row 2.

First 10 candidate-looking samples from `FODE_Data` only:

| Row | ApplicantID | Masked email | Email_Status | Last_Contact_Result | PortalTokenHash present | Program | Intake |
| ---: | --- | --- | --- | --- | --- | --- | --- |
| 2883 | `FODE-26-002885` | `t***@dummy.com` | blank | blank | true | blank | blank |
| 2884 | `FODE-26-002886` | `t***@dummy.com` | blank | blank | true | blank | blank |
| 2885 | `FODE-26-002887` | `t***@dummy.com` | blank | blank | true | blank | blank |
| 2889 | `FODE-26-002898` | `t***@dummy.com` | blank | blank | true | blank | blank |
| 2898 | `FODE-26-002922` | `c***@example.com` | blank | blank | true | blank | blank |
| 2899 | `FODE-26-002923` | `s***@kundu.ac` | blank | blank | true | blank | blank |
| 2900 | `FODE-26-002924` | `s***@kundu.ac` | blank | blank | true | blank | blank |
| 2901 | `FODE-26-002925` | `s***@kundu.ac` | blank | blank | true | blank | blank |

PortalSecrets spot-check:

- `PortalSecrets!A2880:H2931` contains active usable rows for the candidate-looking IDs around `FODE-26-002885` through `FODE-26-002925`.
- This supports that at least the sampled late-sheet candidate-looking rows can pass the runtime portal-secret requirement.

## 5. Root Cause Classification

Likely root cause class: **Cursor/start-row issue** plus **bounded scan window does not reach the remaining eligible rows**.

Supporting evidence:

1. Live sheet has `2129` rows deriving to `INVITE_PENDING`.
2. Live sheet has `8` candidate-looking rows after applying FODE_Data-only checks for applicant ID, valid effective email, and portal token hash.
3. Those sample rows are clustered at rows `2883-2901`.
4. The first 500 data rows contain `0` rows deriving to `INVITE_PENDING`.
5. r140 preview starts from the existing stage cursor hint, or row 2 if absent/stale, and scans only `BATCH_PREVIEW_SCAN_ROW_CAP = 500`.
6. Therefore, if the runtime cursor is row 2 or any early row before the candidate cluster, preview correctly returns zero/partial within the bounded window even though eligible rows exist later.

Rejected or less likely classes:

- **UI payload issue:** unlikely. UI sends `{ stage, limit, offset }` to `admin_previewStageBatch`.
- **Message-type mismatch:** unlikely. `INVITE_PENDING` maps to `legacy_invite`.
- **Replay/idempotency exclusion issue:** unlikely. Idempotency summary runs after candidates are collected.
- **Eligibility predicate too strict:** possible for many rows, but not the primary reason for zero in r140 because the first 500-row window contains no `INVITE_PENDING` rows at all.
- **Data/state mismatch:** partial contributor. Most unsent rows are not necessarily eligible; only a small late cluster appears candidate-like.

## 6. Recommended Next CIS

Propose r142 as a no-send preview-window repair.

Exact change direction:

1. Keep sends, triggers, automation OFF.
2. Keep preview read-only: no sheet row mutation, no cursor write, no Script Properties write.
3. Add an operator-visible preview window control or automatic bounded wrap scan:
   - primary window: existing cursor/start row, cap 500
   - if zero stage matches found, perform a second bounded window from row 2 or from the next segment, still read-only
   - or allow `previewStartRow` in UI/RPC for diagnostics
4. Include `stageMatchCount` distinct from `candidateCount`.
5. Include `windowExhausted=true` when no stage matches are found within the cap.
6. Acceptance should verify `INVITE_PENDING` preview can target rows near 2883 without mutation and returns the same candidate ordering twice.

No functional fix is included in this CIS/report.

## 7. Mutation Statement

No email sent.
No sheet rows changed.
No Script Properties changed.
No trigger changed.
No deployment changed.
No Apps Script push/version/deploy action performed for r141.
