function admin_previewApplicantMessage(payload) {
  return withEnvelope_("admin_previewApplicantMessage", function (dbgId) {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    var p = payload && typeof payload === "object" ? payload : {};
    var applicantId = clean_(p.applicantId || "");
    var requestedType = clean_(p.messageType || "");
    var messageType = normalizeApplicantMessageType_(requestedType);
    var actor = resolveAdminCommActor_(p);
    if (!applicantId) return adminCommBlockedResult_("preview", "MISSING_APPLICANT_ID", dbgId, { blockReason: "Applicant ID is required." });
    if (!messageType) {
      return adminCommBlockedResult_("preview", "UNSUPPORTED_MESSAGE_TYPE", dbgId, {
        applicantId: applicantId,
        messageType: requestedType,
        blockReason: "Unsupported message type."
      });
    }
    var previewOptions = {
      actorEmail: actor.actorEmail,
      actorRole: actor.actorRole,
      batchLabel: clean_(p.batchLabel || ""),
      debugId: clean_(p.debugId || dbgId),
      editedRecipient: clean_(p.recipient || ""),
      authorityOverride: p.authorityOverride === true,
      authorityOverrideReason: clean_(p.authorityOverrideReason || "")
    };
    if (Object.prototype.hasOwnProperty.call(p, "subject") && clean_(p.subject || "")) previewOptions.editedSubject = String(p.subject || "");
    if (Object.prototype.hasOwnProperty.call(p, "body") && clean_(p.body || "")) previewOptions.editedBody = String(p.body || "");
    return previewApplicantMessage_(applicantId, messageType, previewOptions);
  });
}

function admin_sendApplicantMessage(payload) {
  return withEnvelope_("admin_sendApplicantMessage", function (dbgId) {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    requireOperationsAdmin_(adminEmail);
    var p = payload && typeof payload === "object" ? payload : {};
    if (getAdminRole_(adminEmail) === "OPERATIONS") {
      p.sourceSurface = "ops";
      p.sourceView = clean_(p.sourceView || "admin");
    }
    var applicantId = clean_(p.applicantId || "");
    var requestedType = clean_(p.messageType || "");
    var messageType = normalizeApplicantMessageType_(requestedType);
    var actor = resolveAdminCommActor_(p);
    if (Array.isArray(p.applicantIds) || Array.isArray(p.recipients) || Array.isArray(p.messages)) {
      return adminCommBlockedResult_("send", "BULK_NOT_ALLOWED", dbgId, {
        blockReason: "Manual single-send probe accepts one applicant only."
      });
    }
    if (p.confirmManualSingleSend !== true) {
      return adminCommBlockedResult_("send", "CONFIRM_REQUIRED", dbgId, {
        applicantId: applicantId,
        messageType: requestedType,
        blockReason: "Preview and explicit manual single-send confirmation are required."
      });
    }
    if (!applicantId) return adminCommBlockedResult_("send", "MISSING_APPLICANT_ID", dbgId, { blockReason: "Applicant ID is required." });
    if (!messageType) {
      return adminCommBlockedResult_("send", "UNSUPPORTED_MESSAGE_TYPE", dbgId, {
        applicantId: applicantId,
        messageType: requestedType,
        blockReason: "Unsupported message type."
      });
    }
    var opsGate = runOpsSafeModeGate_("applicant_email_send", {
      payload: p,
      adminEmail: adminEmail,
      applicantId: applicantId,
      debugId: dbgId
    });
    if (opsGate && opsGate.ok !== true) {
      return adminCommBlockedResult_("send", safeStr_(opsGate.blockCode || "OPS_SAFE_MODE_ACTION_BLOCKED"), dbgId, {
        applicantId: applicantId,
        messageType: requestedType,
        blockReason: safeStr_(opsGate.blockReason || "Ops Safe Mode blocked this action."),
        safeMode: opsGate.safeMode === true,
        diagnosticsLabel: safeStr_(opsGate.diagnosticsLabel || "OPS_SAFE_MODE_ACTION_BLOCKED")
      });
    }
    var opsRecipientOverride = opsGate && opsGate.safeMode === true
      ? clean_(CONFIG.OPS_SAFE_MODE_TEST_RECIPIENT_OVERRIDE || "")
      : "";
    var sendOptions = {
      actorEmail: actor.actorEmail,
      actorRole: actor.actorRole,
      batchLabel: clean_(p.batchLabel || ""),
      debugId: clean_(p.debugId || dbgId),
      manualSingleSendProbe: true,
      editedRecipient: opsRecipientOverride || clean_(p.recipient || ""),
      authorityOverride: p.authorityOverride === true,
      authorityOverrideReason: clean_(p.authorityOverrideReason || "")
    };
    if (Object.prototype.hasOwnProperty.call(p, "subject")) sendOptions.editedSubject = String(p.subject || "");
    if (Object.prototype.hasOwnProperty.call(p, "body")) sendOptions.editedBody = String(p.body || "");
    var sendResult = sendApplicantMessage_(applicantId, messageType, sendOptions);
    if (opsGate && opsGate.safeMode === true) {
      logOpsSafeModeEvent_(String(sendResult && sendResult.result || "").toUpperCase() === "SENT"
        ? "OPS_SAFE_MODE_ACTION_COMPLETED"
        : "OPS_SAFE_MODE_ACTION_FAILED", {
        actionType: "applicant_email_send",
        operator: adminEmail,
        applicantId: applicantId,
        debugId: dbgId,
        recipientOverride: opsRecipientOverride,
        overrideApplied: !!opsRecipientOverride,
        result: clean_(sendResult && sendResult.result || "")
      });
    }
    return sendResult;
  });
}

function selectedApplicantBatchLimit_() {
  var configured = Number(CONFIG && (CONFIG.MAX_PER_RUN_BATCH_SIZE || CONFIG.MAX_STAGE_BATCH_SIZE || CONFIG.DEFAULT_STAGE_BATCH_SIZE) || 30);
  return Math.max(1, Math.floor(configured || 30));
}

function selectedApplicantBatchInputLimit_() {
  return 500;
}

function selectedApplicantBatchCacheKey_(adminEmail) {
  return "SELECTED_BATCH_PREVIEW::" + clean_(adminEmail || "unknown").toLowerCase();
}

function readSelectedApplicantBatchPreviewCache_(adminEmail) {
  try {
    var raw = CacheService.getUserCache().get(selectedApplicantBatchCacheKey_(adminEmail));
    return raw ? JSON.parse(raw) : null;
  } catch (_err) {
    return null;
  }
}

function writeSelectedApplicantBatchPreviewCache_(adminEmail, value) {
  CacheService.getUserCache().put(selectedApplicantBatchCacheKey_(adminEmail), JSON.stringify(value || {}), 600);
}

function clearSelectedApplicantBatchPreviewCache_(adminEmail) {
  try {
    CacheService.getUserCache().remove(selectedApplicantBatchCacheKey_(adminEmail));
  } catch (_err) {}
}

function withSelectedApplicantBatchSendLock_(adminEmail, dbgId, callback) {
  var lock = null;
  try {
    lock = LockService.getUserLock();
    if (!lock.tryLock(30000)) {
      return adminCommBlockedResult_("send_selected_batch", "BATCH_SEND_IN_PROGRESS", dbgId, {
        blockReason: "A selected batch send is already in progress for this operator. Wait for it to finish before retrying."
      });
    }
    return callback();
  } finally {
    try {
      if (lock) lock.releaseLock();
    } catch (_releaseErr) {}
  }
}

function normalizeSelectedApplicantBatchIds_(ids, limitOpt) {
  var out = [];
  var seen = {};
  var limit = Math.max(1, Math.floor(Number(limitOpt || selectedApplicantBatchLimit_())));
  (Array.isArray(ids) ? ids : []).forEach(function (value) {
    var id = clean_(value || "");
    if (!id || seen[id]) return;
    seen[id] = true;
    if (out.length < limit) out.push(id);
  });
  return out;
}

function buildSelectedApplicantRowLookup_(sheet) {
  var values = sheet.getDataRange().getValues();
  var headers = (values && values.length) ? values[0] : [];
  var byApplicantId = {};
  for (var r = 1; r < values.length; r++) {
    var rowObj = {};
    for (var c = 0; c < headers.length; c++) {
      var h = clean_(headers[c]);
      if (h) rowObj[h] = values[r][c];
    }
    var applicantId = clean_(rowObj.ApplicantID || "");
    if (!applicantId || byApplicantId[applicantId]) continue;
    rowObj._rowNumber = r + 1;
    byApplicantId[applicantId] = rowObj;
  }
  return byApplicantId;
}

function selectedApplicantBatchRecipientName_(rowObj) {
  var row = rowObj || {};
  return clean_([row.First_Name, row.Last_Name].join(" ").trim() || row.Student_Name || row.Full_Name || row.Name || row.Applicant_Name || "");
}

function selectedApplicantBatchHash_(ids) {
  var list = normalizeSelectedApplicantBatchIds_(ids);
  if (typeof stageBatchCandidateHash_ === "function") return stageBatchCandidateHash_(list);
  return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, list.join("|"))
    .map(function (b) { return ("0" + ((b < 0 ? b + 256 : b).toString(16))).slice(-2); })
    .join("");
}

function selectedApplicantBatchResponse_(payload) {
  var data = payload && typeof payload === "object" ? payload : {};
  data.ok = data.ok !== false;
  data.action = clean_(data.action || "selected_applicant_batch");
  return data;
}

function selectedApplicantBatchTemplateLabel_(messageType) {
  var type = clean_(messageType || "");
  var labels = {
    docs_missing: "Missing Documents Follow-Up",
    reminder: "Reminder",
    legacy_invite: "Portal Invitation",
    payment_followup: "Payment Follow-Up",
    fd_acknowledgement: "Application Acknowledgement"
  };
  return labels[type] || "Selected communication";
}

function selectedApplicantBatchOperatorBlockReason_(code, rawReason, messageType) {
  var blockCode = clean_(code || "").toUpperCase();
  var raw = clean_(rawReason || "");
  var templateLabel = selectedApplicantBatchTemplateLabel_(messageType);
  if (blockCode === "COOLDOWN_ACTIVE") {
    return "Blocked: " + templateLabel + " was already sent recently. Wait for cooldown or review applicant individually.";
  }
  if (blockCode === "NO_EFFECTIVE_EMAIL" || blockCode === "INVALID_EMAIL") {
    return "Blocked: No valid email address.";
  }
  if (blockCode === "BOUNCED") {
    return "Blocked: Email delivery previously bounced. Review contact details before sending.";
  }
  if (blockCode === "DO_NOT_CONTACT") {
    return "Blocked: Applicant is marked do not contact.";
  }
  if (blockCode === "APPLICANT_NOT_FOUND") {
    return "Blocked: Applicant record was not found.";
  }
  if (blockCode === "UNKNOWN_MESSAGE_TYPE") {
    return "Blocked: This communication template is not available for batch sending.";
  }
  if (blockCode === "COMM_AUTHORITY_BLOCKED" || /communication authority matrix/i.test(raw)) {
    return "Blocked: This template is not allowed for this applicant's current status. Use the recommended template or review the applicant individually.";
  }
  if (raw) return raw;
  return "Blocked: Communication policy did not allow this recipient.";
}

function selectedApplicantBatchAuthorityDiagnostics_(context, included, reason) {
  var ctx = context && typeof context === "object" ? context : {};
  var auth = ctx.canonicalLifecycleAuthority && typeof ctx.canonicalLifecycleAuthority === "object"
    ? ctx.canonicalLifecycleAuthority
    : {};
  var authoritySource = clean_(auth.authoritySource || "LEGACY_LIFECYCLE").toUpperCase() || "LEGACY_LIFECYCLE";
  var legacyStage = clean_(auth.legacyStage || ctx.legacyLifecycleStage || ctx.lifecycleStage || "");
  var canonicalBaseState = clean_(auth.canonicalBaseState || "");
  var canonicalOverlays = Array.isArray(auth.canonicalOverlays) ? auth.canonicalOverlays.slice() : [];
  var canonicalRecommendedMessageType = clean_(auth.canonicalRecommendedMessageType || "");
  var mismatch = !!(legacyStage && canonicalBaseState && legacyStage !== canonicalBaseState);
  var explanation = clean_(reason || "");
  if (!explanation && included === true) {
    if (authoritySource === "CANONICAL_LIFECYCLE" && canonicalBaseState && canonicalRecommendedMessageType) {
      explanation = "Allowed by Canonical Lifecycle (" + canonicalBaseState + " -> " + canonicalRecommendedMessageType + ").";
    } else if (legacyStage) {
      explanation = "Allowed by Legacy Lifecycle (" + legacyStage + ").";
    } else {
      explanation = "Allowed by Communication Authority.";
    }
  }
  return {
    authoritySource: authoritySource,
    legacyLifecycleStage: legacyStage,
    canonicalBaseState: canonicalBaseState,
    canonicalOverlays: canonicalOverlays,
    canonicalRecommendedMessageType: canonicalRecommendedMessageType,
    hasLifecycleMismatch: mismatch,
    mismatchReason: mismatch ? "Legacy lifecycle and canonical applicant state disagree for this communication decision." : "",
    explanation: explanation
  };
}

function admin_previewSelectedApplicantBatch(payload) {
  return withEnvelope_("admin_previewSelectedApplicantBatch", function (dbgId) {
    var startedAtMs = new Date().getTime();
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    requireOperationsAdmin_(adminEmail);
    var p = payload && typeof payload === "object" ? payload : {};
    var requestedType = clean_(p.messageType || "");
    var messageType = normalizeApplicantMessageType_(requestedType);
    var sourceLabel = clean_(p.sourceLabel || "Selected applicants");
    var selectedIds = normalizeSelectedApplicantBatchIds_(p.applicantIds || [], selectedApplicantBatchInputLimit_());
    var previewSendCap = selectedApplicantBatchLimit_();
    var applicantIds = selectedIds.slice(0, previewSendCap);
    var selectedTotal = selectedIds.length;
    var remainingAfterCap = Math.max(0, selectedTotal - applicantIds.length);
    var excluded = {};
    normalizeSelectedApplicantBatchIds_(p.excludedApplicantIds || [], selectedApplicantBatchInputLimit_()).forEach(function (id) { excluded[id] = true; });
    var actor = resolveAdminCommActor_(p);
    var requestId = clean_(dbgId || newDebugId_());
    if (!messageType) {
      return selectedApplicantBatchResponse_({
        ok: false,
        result: "BLOCKED",
        blockCode: "UNSUPPORTED_MESSAGE_TYPE",
        blockReason: "Unsupported message type.",
        requestId: requestId,
        messageType: requestedType,
        sourceLabel: sourceLabel
      });
    }
    if (typeof isCommunicationTypeBatchSafe_ === "function" && isCommunicationTypeBatchSafe_(messageType) !== true) {
      return selectedApplicantBatchResponse_({
        ok: false,
        result: "BLOCKED",
        blockCode: "MESSAGE_TYPE_NOT_BATCH_SAFE",
        blockReason: "Selected template is not approved for batch communication.",
        requestId: requestId,
        messageType: messageType,
        sourceLabel: sourceLabel
      });
    }
    if (!applicantIds.length) {
      return selectedApplicantBatchResponse_({
        ok: false,
        result: "BLOCKED",
        blockCode: "EMPTY_COHORT",
        blockReason: "Select at least one applicant before previewing batch communication.",
        requestId: requestId,
        messageType: messageType,
        sourceLabel: sourceLabel
      });
    }
    var sh = openDataSheet_();
    var lookup = buildSelectedApplicantRowLookup_(sh);
    var recipients = [];
    var blockedByReason = {};
    var eligibleIds = [];
    var previewSubject = "";
    var previewBody = "";
    var total = selectedTotal;
    var excludedCount = 0;
    var missing = 0;
    var blocked = 0;
    applicantIds.forEach(function (applicantId) {
      var rowObj = lookup[applicantId] || null;
      var name = selectedApplicantBatchRecipientName_(rowObj || {});
      if (excluded[applicantId]) {
        excludedCount++;
        recipients.push({ applicantId: applicantId, name: name, email: "", status: "Excluded", included: false, excluded: true, reason: "Operator excluded before send." });
        return;
      }
      if (!rowObj) {
        missing++;
        blockedByReason.APPLICANT_NOT_FOUND = Number(blockedByReason.APPLICANT_NOT_FOUND || 0) + 1;
        recipients.push({ applicantId: applicantId, name: "", email: "", status: "Excluded", included: false, reason: "Applicant record not found." });
        return;
      }
      var context = resolveApplicantMessageContextFromRow_(rowObj, Number(rowObj._rowNumber || 0), sh, messageType, {
        action: "selectedBatchPreview",
        actorEmail: actor.actorEmail,
        actorRole: actor.actorRole,
        debugId: requestId,
        requestId: requestId,
        batchLabel: "SELECTED_BATCH_PREVIEW::" + requestId
      });
      if (context && context.eligible === true) {
        var built = buildApplicantMessage_(context);
        if (!previewSubject) previewSubject = clean_(built.subject || "");
        if (!previewBody) previewBody = String(built.body || "");
        eligibleIds.push(applicantId);
        var includedAuthority = selectedApplicantBatchAuthorityDiagnostics_(context, true, "");
        recipients.push({
          applicantId: applicantId,
          name: name,
          email: clean_(context.effectiveEmail || ""),
          status: "Included",
          included: true,
          reason: includedAuthority.explanation,
          authorityDiagnostics: includedAuthority
        });
        return;
      }
      blocked++;
      var code = clean_(context && (context.blockCode || context.code) || "BLOCKED");
      var rawReason = clean_(context && (context.blockReason || context.message || context.error) || code);
      var operatorReason = selectedApplicantBatchOperatorBlockReason_(code, rawReason, messageType);
      blockedByReason[code] = Number(blockedByReason[code] || 0) + 1;
      recipients.push({
        applicantId: applicantId,
        name: name,
        email: clean_(context && context.effectiveEmail || ""),
        status: "Excluded",
        included: false,
        reason: operatorReason,
        technicalReason: rawReason,
        authorityDiagnostics: selectedApplicantBatchAuthorityDiagnostics_(context, false, operatorReason)
      });
    });
    var candidateHash = selectedApplicantBatchHash_(eligibleIds);
    var elapsedMs = new Date().getTime() - startedAtMs;
    var out = selectedApplicantBatchResponse_({
      ok: true,
      result: "PREVIEW",
      requestId: requestId,
      sourceLabel: sourceLabel,
      sourceType: clean_(p.sourceType || "selected"),
      messageType: messageType,
      totalActionable: total,
      selectedTotal: selectedTotal,
      previewSendCap: previewSendCap,
      willSendThisRun: eligibleIds.length,
      remainingAfterCap: remainingAfterCap,
      capApplied: remainingAfterCap > 0,
      alreadyCommunicated: Number(blockedByReason.COOLDOWN_ACTIVE || 0),
      eligible: eligibleIds.length,
      count: eligibleIds.length,
      blocked: blocked + missing,
      excluded: excludedCount,
      remainingAfterBatch: Math.max(0, total - excludedCount - eligibleIds.length - blocked - missing),
      blockedByReason: blockedByReason,
      recipients: recipients.slice(0, previewSendCap),
      recipientCount: recipients.length,
      candidateIds: eligibleIds,
      candidateCount: eligibleIds.length,
      candidateHash: candidateHash,
      subject: previewSubject,
      body: previewBody,
      elapsedMs: elapsedMs,
      technicalDiagnostics: {
        requestId: requestId,
        candidateHash: candidateHash,
        boundedLimit: previewSendCap,
        previewSendCap: previewSendCap,
        inputCount: total,
        cappedInputCount: applicantIds.length,
        remainingAfterCap: remainingAfterCap,
        elapsedMs: elapsedMs
      }
    });
    if (eligibleIds.length) {
      writeSelectedApplicantBatchPreviewCache_(adminEmail, {
        requestId: requestId,
        sourceLabel: sourceLabel,
        messageType: messageType,
        selectedTotal: selectedTotal,
        previewSendCap: previewSendCap,
        willSendThisRun: eligibleIds.length,
        remainingAfterCap: remainingAfterCap,
        capApplied: remainingAfterCap > 0,
        candidateIds: eligibleIds,
        candidateCount: eligibleIds.length,
        candidateHash: candidateHash,
        writtenAt: new Date().toISOString()
      });
    } else {
      clearSelectedApplicantBatchPreviewCache_(adminEmail);
    }
    return out;
  });
}

function admin_sendSelectedApplicantBatch(payload) {
  return withEnvelope_("admin_sendSelectedApplicantBatch", function (dbgId) {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    requireOperationsAdmin_(adminEmail);
    var p = payload && typeof payload === "object" ? payload : {};
    if (isBatchSendEnabled_() !== true) {
      return adminCommBlockedResult_("send_selected_batch", "BATCH_SENDS_DISABLED_PREVIEW_ONLY_MODE", dbgId, { blockReason: "Batch sends are disabled in preview-only mode." });
    }
    if (p.confirmSend !== true) {
      return adminCommBlockedResult_("send_selected_batch", "CONFIRM_REQUIRED", dbgId, { blockReason: "Explicit confirmation is required before selected batch send." });
    }
    var messageType = normalizeApplicantMessageType_(p.messageType || "");
    if (!messageType) return adminCommBlockedResult_("send_selected_batch", "UNSUPPORTED_MESSAGE_TYPE", dbgId, { blockReason: "Unsupported message type." });
    if (typeof isCommunicationTypeBatchSafe_ === "function" && isCommunicationTypeBatchSafe_(messageType) !== true) {
      return adminCommBlockedResult_("send_selected_batch", "MESSAGE_TYPE_NOT_BATCH_SAFE", dbgId, { blockReason: "Selected template is not approved for batch communication." });
    }
    return withSelectedApplicantBatchSendLock_(adminEmail, dbgId, function () {
    var preview = readSelectedApplicantBatchPreviewCache_(adminEmail);
    var previewRequestId = clean_(p.previewRequestId || "");
    var candidateHash = clean_(p.candidateHash || "");
    var cachedHash = clean_(preview && preview.candidateHash || "");
    var cachedRequestId = clean_(preview && preview.requestId || "");
    var cachedMessageType = clean_(preview && preview.messageType || "");
    var candidateIds = Array.isArray(preview && preview.candidateIds) ? normalizeSelectedApplicantBatchIds_(preview.candidateIds) : [];
    if (!preview || !previewRequestId || previewRequestId !== cachedRequestId || !candidateHash || candidateHash !== cachedHash || cachedMessageType !== messageType || !candidateIds.length) {
      return adminCommBlockedResult_("send_selected_batch", "PREVIEW_REQUIRED", dbgId, {
        blockReason: "A matching selected-batch preview is required before send.",
        previewRequestId: previewRequestId,
        cachedRequestId: cachedRequestId,
        candidateHashPresent: !!candidateHash,
        cachedCandidateHashPresent: !!cachedHash
      });
    }
    clearSelectedApplicantBatchPreviewCache_(adminEmail);
    var actor = resolveAdminCommActor_(p);
    var requestId = clean_(dbgId || newDebugId_());
    var batchLabel = "SELECTED_BATCH_SEND::" + requestId;
    var out = {
      ok: true,
      action: "send_selected_batch",
      result: "COMPLETE",
      requestId: requestId,
      previewRequestId: previewRequestId,
      sourceLabel: clean_(preview.sourceLabel || p.sourceLabel || "Selected applicants"),
      messageType: messageType,
      selectedTotal: Number(preview.selectedTotal || candidateIds.length),
      previewSendCap: Number(preview.previewSendCap || selectedApplicantBatchLimit_()),
      willSendThisRun: candidateIds.length,
      remainingAfterCap: Number(preview.remainingAfterCap || 0),
      capApplied: preview.capApplied === true,
      candidateHash: candidateHash,
      attempted: 0,
      sent: 0,
      skipped: 0,
      failed: 0,
      blocked: 0,
      blockedByReason: {},
      sentApplicantIdsSample: [],
      batchId: batchLabel
    };
    candidateIds.forEach(function (applicantId) {
      out.attempted++;
      var sendResult = sendApplicantMessage_(applicantId, messageType, {
        actorEmail: actor.actorEmail,
        actorRole: actor.actorRole,
        batchLabel: batchLabel,
        debugId: requestId,
        sendSource: "ADMIN_SELECTED_BATCH",
        unattended: false
      });
      var resultType = clean_(sendResult && sendResult.result || "").toUpperCase();
      if (resultType === "SENT") {
        out.sent++;
        if (out.sentApplicantIdsSample.length < 10) out.sentApplicantIdsSample.push(applicantId);
      } else if (resultType === "BLOCKED") {
        out.blocked++;
        var code = clean_(sendResult && (sendResult.blockCode || sendResult.code) || "BLOCKED");
        out.blockedByReason[code] = Number(out.blockedByReason[code] || 0) + 1;
      } else {
        out.failed++;
      }
    });
    out.skipped = Math.max(0, Number(preview.candidateCount || candidateIds.length) - out.attempted);
    return out;
    });
  });
}
