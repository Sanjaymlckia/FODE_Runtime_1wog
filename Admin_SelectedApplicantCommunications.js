function adminCommunicationOperationIdentity_(payload, applicantId, messageType, actorEmail, debugId) {
  var p = payload && typeof payload === "object" ? payload : {};
  var suppliedIdentity = [p.operationId, p.previewId, p.receiptId].map(function (value) { return clean_(value || ""); });
  var suppliedIdentityCount = suppliedIdentity.filter(function (value) { return !!value; }).length;
  var expectedCommandType = clean_(applicantId || "").toUpperCase() === "COHORT"
    ? "BATCH_COMMUNICATION"
    : "SEND_INDIVIDUAL_COMMUNICATION";
  var serverActor = clean_(actorEmail || "");
  if ((suppliedIdentityCount > 0 && suppliedIdentityCount !== suppliedIdentity.length)
    || (clean_(p.commandType || "") && clean_(p.commandType || "") !== expectedCommandType)
    || (clean_(p.actor || "") && clean_(p.actor || "").toLowerCase() !== serverActor.toLowerCase())) {
    return {
      ok: false,
      blockCode: "COMMUNICATION_IDENTITY_MISMATCH",
      blockReason: "Communication operation identity does not match the authenticated endpoint context."
    };
  }
  var generatedSeed = suppliedIdentityCount ? "" : clean_(newDebugId_());
  var operationId = clean_(p.operationId || ("COMM-OPERATION-" + generatedSeed));
  var previewId = clean_(p.previewId || ("COMM-PREVIEW-" + generatedSeed));
  var receiptId = clean_(p.receiptId || ("COMM-RECEIPT-" + generatedSeed));
  var commandType = expectedCommandType;
  var stateFingerprint = clean_(p.stateFingerprint || [
    commandType,
    clean_(applicantId || ""),
    clean_(messageType || ""),
    clean_(p.recipient || "")
  ].join("::"));
  return {
    ok: true,
    operationId: operationId,
    previewId: previewId,
    receiptId: receiptId,
    applicantId: clean_(applicantId || ""),
    messageType: clean_(messageType || ""),
    commandType: commandType,
    actor: serverActor,
    stateFingerprint: stateFingerprint,
    cooldownCycle: clean_(p.cooldownCycle || ""),
    idempotencyKey: clean_(p.idempotencyKey || ["EMAIL_OPERATION", operationId, clean_(applicantId || "UNKNOWN"), clean_(messageType || "unknown").toLowerCase()].join("::"))
  };
}

function adminIndividualCommunicationPreviewCacheKey_(applicantId, messageType) {
  var applicantKey = clean_(applicantId || "").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 80);
  var messageKey = clean_(messageType || "").toLowerCase().replace(/[^a-z0-9_-]/g, "_").slice(0, 80);
  return "ADMIN_INDIVIDUAL_COMM_PREVIEW::" + applicantKey + "::" + messageKey;
}

function adminWriteIndividualCommunicationPreview_(applicantId, messageType, identity, request, previewResult) {
  var p = request && typeof request === "object" ? request : {};
  var result = previewResult && typeof previewResult === "object" ? previewResult : {};
  var approved = {
    identity: {
      operationId: clean_(identity && identity.operationId || ""),
      previewId: clean_(identity && identity.previewId || ""),
      receiptId: clean_(identity && identity.receiptId || ""),
      commandType: clean_(identity && identity.commandType || ""),
      actor: clean_(identity && identity.actor || ""),
      stateFingerprint: clean_(identity && identity.stateFingerprint || ""),
      cooldownCycle: clean_(identity && identity.cooldownCycle || ""),
      idempotencyKey: clean_(identity && identity.idempotencyKey || "")
    },
    applicantId: clean_(applicantId || ""),
    messageType: clean_(messageType || ""),
    templateId: clean_(p.templateId || messageType || ""),
    templateVersionId: clean_(p.templateVersionId || ""),
    recipient: clean_(result.effectiveEmail || p.recipient || ""),
    subject: String(result.subject || p.subject || ""),
    body: String(result.body || p.body || ""),
    cc: clean_(result.cc || p.cc || ""),
    bcc: clean_(result.bcc || p.bcc || ""),
    authorityOverride: p.authorityOverride === true,
    authorityOverrideReason: clean_(p.authorityOverrideReason || ""),
    createdAt: new Date().toISOString()
  };
  CacheService.getUserCache().put(
    adminIndividualCommunicationPreviewCacheKey_(applicantId, messageType),
    JSON.stringify(approved),
    600
  );
  return approved;
}

function adminReadIndividualCommunicationPreview_(applicantId, messageType) {
  try {
    var raw = CacheService.getUserCache().get(adminIndividualCommunicationPreviewCacheKey_(applicantId, messageType));
    if (!raw) return null;
    var parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : null;
  } catch (_previewReadErr) {
    return null;
  }
}

function adminIndividualCommunicationPreviewMatches_(approved, payload, identityFieldsSupplied) {
  var cached = approved && typeof approved === "object" ? approved : null;
  var p = payload && typeof payload === "object" ? payload : {};
  if (!cached || !cached.identity) return { ok: false, code: "PREVIEW_REQUIRED", reason: "A matching server-approved communication preview is required before send." };
  var identityMismatch = (identityFieldsSupplied || []).some(function (field) {
    return clean_(p[field] || "") && clean_(p[field] || "") !== clean_(cached.identity[field] || "");
  });
  if (identityMismatch) return { ok: false, code: "COMMUNICATION_IDENTITY_MISMATCH", reason: "Send identity does not match the latest server-approved preview." };
  var contentMismatch = [
    ["recipient", clean_],
    ["subject", String],
    ["body", String],
    ["cc", clean_],
    ["bcc", clean_],
    ["templateId", clean_],
    ["templateVersionId", clean_]
  ].some(function (entry) {
    var field = entry[0];
    var normalize = entry[1];
    if (!Object.prototype.hasOwnProperty.call(p, field)) return false;
    return normalize(p[field] || "") !== normalize(cached[field] || "");
  });
  if (contentMismatch) return { ok: false, code: "PREVIEW_STALE", reason: "Recipient, template, or message content changed after preview. Preview the final communication again." };
  if ((Object.prototype.hasOwnProperty.call(p, "authorityOverride") && (p.authorityOverride === true) !== (cached.authorityOverride === true))
    || (Object.prototype.hasOwnProperty.call(p, "authorityOverrideReason") && clean_(p.authorityOverrideReason || "") !== clean_(cached.authorityOverrideReason || ""))) {
    return { ok: false, code: "PREVIEW_STALE", reason: "Communication authority override context changed after preview." };
  }
  return { ok: true };
}

function adminBindIndividualCommunicationPreview_(approved, payload) {
  var cached = approved && typeof approved === "object" ? approved : {};
  var p = payload && typeof payload === "object" ? payload : {};
  return Object.assign({}, p, cached.identity || {}, {
    recipient: clean_(cached.recipient || ""),
    subject: String(cached.subject || ""),
    body: String(cached.body || ""),
    cc: clean_(cached.cc || ""),
    bcc: clean_(cached.bcc || ""),
    templateId: clean_(cached.templateId || ""),
    templateVersionId: clean_(cached.templateVersionId || ""),
    authorityOverride: cached.authorityOverride === true,
    authorityOverrideReason: clean_(cached.authorityOverrideReason || "")
  });
}

function adminCommunicationWithIdentity_(result, identity) {
  var out = result && typeof result === "object" ? result : {};
  var source = identity && typeof identity === "object" ? identity : {};
  [
    "operationId",
    "previewId",
    "receiptId",
    "applicantId",
    "messageType",
    "commandType",
    "actor",
    "stateFingerprint",
    "cooldownCycle",
    "idempotencyKey"
  ].forEach(function (field) {
    if (!clean_(out[field] || "")) out[field] = clean_(source[field] || "");
  });
  return out;
}

function admin_previewApplicantMessage(payload) {
  return withEnvelope_("admin_previewApplicantMessage", function (dbgId) {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    if (!adminHasCapability_(adminEmail, "CAN_PREVIEW_APPLICANT_COMMUNICATION")) {
      return adminCommBlockedResult_("preview", adminCapabilityBlockCode_("CAN_PREVIEW_APPLICANT_COMMUNICATION"), dbgId, {
        blockReason: adminCapabilityBlockReason_("CAN_PREVIEW_APPLICANT_COMMUNICATION")
      });
    }
    var p = payload && typeof payload === "object" ? payload : {};
    var applicantId = clean_(p.applicantId || "");
    var requestedType = clean_(p.messageType || "");
    var messageType = typeof communicationResolvedMessageTypeForRequest_ === "function"
      ? communicationResolvedMessageTypeForRequest_(requestedType, { templateId: clean_(p.templateId || requestedType), templateVersionId: clean_(p.templateVersionId || "") })
      : normalizeApplicantMessageType_(requestedType);
    var actor = resolveAdminCommActor_(p);
    actor.actorEmail = clean_(adminEmail || actor.actorEmail || "");
    var identity = adminCommunicationOperationIdentity_(p, applicantId, messageType, actor.actorEmail, dbgId);
    if (identity.ok !== true) return adminCommBlockedResult_("preview", identity.blockCode, dbgId, { blockReason: identity.blockReason });
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
      templateId: clean_(p.templateId || requestedType),
      templateVersionId: clean_(p.templateVersionId || ""),
      cc: clean_(p.cc || ""),
      bcc: clean_(p.bcc || ""),
      authorityOverride: p.authorityOverride === true,
      authorityOverrideReason: clean_(p.authorityOverrideReason || ""),
      operationId: identity.operationId,
      previewId: identity.previewId,
      receiptId: identity.receiptId,
      commandType: identity.commandType,
      actor: identity.actor,
      stateFingerprint: identity.stateFingerprint,
      cooldownCycle: identity.cooldownCycle,
      idempotencyKey: identity.idempotencyKey
    };
    if (Object.prototype.hasOwnProperty.call(p, "subject") && clean_(p.subject || "")) previewOptions.editedSubject = String(p.subject || "");
    if (Object.prototype.hasOwnProperty.call(p, "body") && clean_(p.body || "")) previewOptions.editedBody = String(p.body || "");
    var previewResult = adminCommunicationWithIdentity_(previewApplicantMessage_(applicantId, messageType, previewOptions), identity);
    if (previewResult && previewResult.ok === true && clean_(previewResult.result || "").toUpperCase() === "PREVIEW") {
      adminWriteIndividualCommunicationPreview_(applicantId, messageType, identity, p, previewResult);
    }
    return previewResult;
  });
}

function admin_sendApplicantMessage(payload) {
  return withEnvelope_("admin_sendApplicantMessage", function (dbgId) {
    var adminEmail = getCallerEmail_();
    if (!isAdmin_(adminEmail)) throw new Error("Access denied");
    if (!adminHasCapability_(adminEmail, "CAN_SEND_INDIVIDUAL_EMAIL")) {
      return adminCommBlockedResult_("send", adminCapabilityBlockCode_("CAN_SEND_INDIVIDUAL_EMAIL"), dbgId, {
        blockReason: adminCapabilityBlockReason_("CAN_SEND_INDIVIDUAL_EMAIL")
      });
    }
    var p = payload && typeof payload === "object" ? payload : {};
    if (adminHasCapability_(adminEmail, "CAN_RUN_BATCH_COMMUNICATIONS")) {
      p.sourceSurface = "ops";
      p.sourceView = clean_(p.sourceView || "admin");
    }
    var applicantId = clean_(p.applicantId || "");
    var requestedType = clean_(p.messageType || "");
    var messageType = typeof communicationResolvedMessageTypeForRequest_ === "function"
      ? communicationResolvedMessageTypeForRequest_(requestedType, { templateId: clean_(p.templateId || requestedType), templateVersionId: clean_(p.templateVersionId || "") })
      : normalizeApplicantMessageType_(requestedType);
    var actor = resolveAdminCommActor_(p);
    actor.actorEmail = clean_(adminEmail || actor.actorEmail || "");
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
    var identityFields = ["operationId", "previewId", "receiptId", "commandType", "actor", "stateFingerprint", "cooldownCycle", "idempotencyKey"];
    var sendResult = withAdminIndividualCommunicationLock_(adminEmail, dbgId, function () {
      var approvedPreview = adminReadIndividualCommunicationPreview_(applicantId, messageType);
      var previewMatch = adminIndividualCommunicationPreviewMatches_(approvedPreview, p, identityFields);
      if (previewMatch.ok !== true) {
        return adminCommBlockedResult_("send", previewMatch.code, dbgId, {
          applicantId: applicantId,
          messageType: requestedType,
          blockReason: previewMatch.reason
        });
      }
      var boundPayload = adminBindIndividualCommunicationPreview_(approvedPreview, p);
      var identity = adminCommunicationOperationIdentity_(boundPayload, applicantId, messageType, actor.actorEmail, dbgId);
      if (identity.ok !== true) return adminCommBlockedResult_("send", identity.blockCode, dbgId, { blockReason: identity.blockReason });
      var sendOptions = {
        actorEmail: actor.actorEmail,
        actorRole: actor.actorRole,
        batchLabel: clean_(boundPayload.batchLabel || ""),
        debugId: clean_(boundPayload.debugId || dbgId),
        manualSingleSendProbe: true,
        editedRecipient: opsRecipientOverride || clean_(boundPayload.recipient || ""),
        templateId: clean_(boundPayload.templateId || requestedType),
        templateVersionId: clean_(boundPayload.templateVersionId || ""),
        cc: clean_(boundPayload.cc || ""),
        bcc: clean_(boundPayload.bcc || ""),
        authorityOverride: boundPayload.authorityOverride === true,
        authorityOverrideReason: clean_(boundPayload.authorityOverrideReason || ""),
        operationId: identity.operationId,
        previewId: identity.previewId,
        receiptId: identity.receiptId,
        commandType: identity.commandType,
        actor: identity.actor,
        stateFingerprint: identity.stateFingerprint,
        cooldownCycle: identity.cooldownCycle,
        idempotencyKey: identity.idempotencyKey
      };
      if (Object.prototype.hasOwnProperty.call(boundPayload, "subject") && clean_(boundPayload.subject || "")) {
        sendOptions.editedSubject = String(boundPayload.subject || "");
      }
      if (Object.prototype.hasOwnProperty.call(boundPayload, "body") && clean_(boundPayload.body || "")) {
        sendOptions.editedBody = String(boundPayload.body || "");
      }
      return adminCommunicationWithIdentity_(sendApplicantMessage_(applicantId, messageType, sendOptions), identity);
    });
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

function withAdminIndividualCommunicationLock_(adminEmail, dbgId, callback) {
  var lock = null;
  try {
    lock = LockService.getUserLock();
    if (!lock.tryLock(30000)) {
      return adminCommBlockedResult_("send", "COMMUNICATION_SEND_IN_PROGRESS", dbgId, {
        blockReason: "Another communication send is in progress for this operator. Wait for it to finish before retrying."
      });
    }
    return callback();
  } finally {
    try {
      if (lock) lock.releaseLock();
    } catch (_releaseErr) {}
  }
}

function selectedApplicantBatchLimit_() {
  return batchPolicyConfiguredPerRunCap_();
}

function selectedApplicantBatchInputLimit_() {
  return 500;
}

function selectedApplicantBatchCacheKey_(adminEmail) {
  return batchPolicyPreviewCacheKey_("SELECTED_BATCH_PREVIEW", adminEmail);
}

function readSelectedApplicantBatchPreviewCache_(adminEmail) {
  return batchPolicyReadPreviewCache_("SELECTED_BATCH_PREVIEW", adminEmail);
}

function writeSelectedApplicantBatchPreviewCache_(adminEmail, value) {
  batchPolicyWritePreviewCache_("SELECTED_BATCH_PREVIEW", adminEmail, value, batchPolicyPreviewCacheTtlSeconds_());
}

function clearSelectedApplicantBatchPreviewCache_(adminEmail) {
  batchPolicyClearPreviewCache_("SELECTED_BATCH_PREVIEW", adminEmail);
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

function selectedBatchApplicantOutcome_(applicantId, sendResult, errorOpt) {
  var result = sendResult && typeof sendResult === "object" ? sendResult : {};
  var errorMessage = errorOpt ? clean_(errorOpt && errorOpt.message || errorOpt) : "";
  var resultType = clean_(result.result || "").toUpperCase();
  var blockCode = clean_(result.blockCode || result.code || "");
  var gmailAccepted = result.gmailAccepted === true || resultType === "SENT";
  var rowPatchConfirmed = result.rowPatchConfirmed === true || resultType === "SENT";
  var communicationRecorded = result.communicationRecorded === true || resultType === "SENT";
  var outcome = "FAILED";
  if (resultType === "SENT" && gmailAccepted && rowPatchConfirmed && communicationRecorded) outcome = "SENT";
  else if (resultType === "IDEMPOTENT_REPLAY" || resultType === "ALREADY_PROCESSED_FOR_OPERATION") outcome = "IDEMPOTENT_REPLAY";
  else if (resultType === "BLOCKED" || resultType === "DUPLICATE") outcome = "BLOCKED";
  else if (resultType === "RECONCILIATION_REQUIRED" || gmailAccepted) outcome = "RECONCILIATION_REQUIRED";
  else if (errorMessage) outcome = "FAILED";
  return {
    applicantId: clean_(applicantId || result.applicantId || ""),
    outcome: outcome,
    blockCode: outcome === "BLOCKED" || outcome === "IDEMPOTENT_REPLAY" ? (blockCode || (outcome === "IDEMPOTENT_REPLAY" ? "ALREADY_PROCESSED_FOR_OPERATION" : "BLOCKED")) : "",
    blockReason: clean_(result.blockReason || result.reason || result.error || errorMessage || ""),
    reason: clean_(result.blockReason || result.reason || result.error || errorMessage || ""),
    gmailAttempted: result.gmailAttempted === true || gmailAccepted || resultType === "FAILED",
    gmailAccepted: gmailAccepted,
    rowPatchConfirmed: rowPatchConfirmed,
    communicationRecorded: communicationRecorded,
    messageType: clean_(result.messageType || ""),
    effectiveEmail: clean_(result.effectiveEmail || ""),
    debugId: clean_(result.debugId || "")
  };
}

function selectedBatchOutcomeTotals_(out) {
  var outcomes = Array.isArray(out && out.applicantOutcomes) ? out.applicantOutcomes : [];
  out.attempted = outcomes.length;
  out.sent = outcomes.filter(function (item) { return item.outcome === "SENT"; }).length;
  out.replayed = outcomes.filter(function (item) { return item.outcome === "IDEMPOTENT_REPLAY"; }).length;
  out.blocked = outcomes.filter(function (item) { return item.outcome === "BLOCKED"; }).length;
  out.failed = outcomes.filter(function (item) { return item.outcome === "FAILED"; }).length;
  out.reconciliationRequired = outcomes.filter(function (item) { return item.outcome === "RECONCILIATION_REQUIRED"; }).length;
  out.blockedByReason = {};
  outcomes.forEach(function (item) {
    if (item.outcome === "BLOCKED") {
      var code = clean_(item.blockCode || "BLOCKED");
      out.blockedByReason[code] = Number(out.blockedByReason[code] || 0) + 1;
    }
  });
  var completed = out.sent + out.replayed;
  out.result = out.reconciliationRequired ? "RECONCILIATION_REQUIRED" : (completed && (out.blocked || out.failed) ? "PARTIAL" : (completed && !out.blocked && !out.failed ? "COMPLETE" : (out.blocked && !completed && !out.failed ? "BLOCKED" : "PARTIAL")));
  return out;
}

function normalizeSelectedApplicantBatchIds_(ids, limitOpt) {
  return batchPolicyNormalizeCandidateIds_(ids, limitOpt || selectedApplicantBatchLimit_());
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
  return batchPolicyCandidateHash_(normalizeSelectedApplicantBatchIds_(ids));
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
    var messageType = typeof communicationResolvedMessageTypeForRequest_ === "function"
      ? communicationResolvedMessageTypeForRequest_(requestedType, { templateId: clean_(p.templateId || requestedType), templateVersionId: clean_(p.templateVersionId || "") })
      : normalizeApplicantMessageType_(requestedType);
    var sourceLabel = clean_(p.sourceLabel || "Selected applicants");
    var selectedIds = normalizeSelectedApplicantBatchIds_(p.applicantIds || [], selectedApplicantBatchInputLimit_());
    var previewSendCap = selectedApplicantBatchLimit_();
    var applicantIds = selectedIds.slice(0, previewSendCap);
    var selectedTotal = selectedIds.length;
    var remainingAfterCap = Math.max(0, selectedTotal - applicantIds.length);
    var excluded = {};
    normalizeSelectedApplicantBatchIds_(p.excludedApplicantIds || [], selectedApplicantBatchInputLimit_()).forEach(function (id) { excluded[id] = true; });
    var actor = resolveAdminCommActor_(p);
    actor.actorEmail = clean_(adminEmail || actor.actorEmail || "");
    var requestId = clean_(dbgId || newDebugId_());
    var hasOperationIdentity = [p.operationId, p.previewId, p.receiptId].some(function (value) { return !!clean_(value || ""); });
    var operationIdentity = hasOperationIdentity
      ? adminCommunicationOperationIdentity_(p, "COHORT", messageType, actor.actorEmail, requestId)
      : null;
    if (operationIdentity && operationIdentity.ok !== true) {
      return selectedApplicantBatchResponse_({
        ok: false,
        result: "BLOCKED",
        blockCode: operationIdentity.blockCode,
        blockReason: operationIdentity.blockReason,
        requestId: requestId,
        messageType: requestedType,
        sourceLabel: sourceLabel
      });
    }
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
      var context = resolveApplicantMessageContextFromRow_(rowObj, Number(rowObj._rowNumber || 0), sh, messageType, Object.assign({
        action: "selectedBatchPreview",
        actorEmail: actor.actorEmail,
        actorRole: actor.actorRole,
        debugId: requestId,
        requestId: requestId,
        templateId: clean_(p.templateId || requestedType),
        templateVersionId: clean_(p.templateVersionId || ""),
        batchLabel: "SELECTED_BATCH_PREVIEW::" + requestId
      }, operationIdentity || {}));
      if (context && context.eligible === true) {
        var built = buildApplicantMessage_(context);
        var renderedSubject = communicationRenderTemplateText_(built.subject || "", context);
        var renderedBody = communicationRenderFinalBody_(context, built.body || "");
        if (!previewSubject) previewSubject = clean_(renderedSubject || "");
        if (!previewBody) previewBody = String(renderedBody || "");
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
      templateId: clean_(p.templateId || requestedType),
      templateVersionId: clean_(p.templateVersionId || ""),
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
    if (operationIdentity) adminCommunicationWithIdentity_(out, operationIdentity);
    if (eligibleIds.length) {
      writeSelectedApplicantBatchPreviewCache_(adminEmail, adminCommunicationWithIdentity_({
        requestId: requestId,
        sourceLabel: sourceLabel,
        messageType: messageType,
        templateId: clean_(p.templateId || requestedType),
        templateVersionId: clean_(p.templateVersionId || ""),
        selectedTotal: selectedTotal,
        previewSendCap: previewSendCap,
        willSendThisRun: eligibleIds.length,
        remainingAfterCap: remainingAfterCap,
        capApplied: remainingAfterCap > 0,
        candidateIds: eligibleIds,
        candidateCount: eligibleIds.length,
        candidateHash: candidateHash,
        writtenAt: new Date().toISOString()
      }, operationIdentity || {}));
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
    var requestedType = clean_(p.messageType || "");
    var messageType = typeof communicationResolvedMessageTypeForRequest_ === "function"
      ? communicationResolvedMessageTypeForRequest_(requestedType, { templateId: clean_(p.templateId || requestedType), templateVersionId: clean_(p.templateVersionId || "") })
      : normalizeApplicantMessageType_(requestedType);
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
    var requestedTemplateId = clean_(p.templateId || requestedType || "");
    var cachedTemplateId = clean_(preview && preview.templateId || "");
    var candidateIds = Array.isArray(preview && preview.candidateIds) ? normalizeSelectedApplicantBatchIds_(preview.candidateIds) : [];
    var identityMismatch = ["operationId", "previewId", "receiptId", "commandType", "actor", "stateFingerprint", "cooldownCycle", "idempotencyKey"].some(function (field) {
      return clean_(p[field] || "") && clean_(p[field] || "") !== clean_(preview && preview[field] || "");
    });
    if (!preview || !previewRequestId || previewRequestId !== cachedRequestId || !candidateHash || candidateHash !== cachedHash || cachedMessageType !== messageType || cachedTemplateId !== requestedTemplateId || !candidateIds.length || identityMismatch) {
      return adminCommBlockedResult_("send_selected_batch", "PREVIEW_REQUIRED", dbgId, {
        blockReason: "A matching selected-batch preview is required before send.",
        previewRequestId: previewRequestId,
        cachedRequestId: cachedRequestId,
        candidateHashPresent: !!candidateHash,
        cachedCandidateHashPresent: !!cachedHash
      });
    }
    var actor = resolveAdminCommActor_(p);
    actor.actorEmail = clean_(adminEmail || actor.actorEmail || "");
    var requestId = clean_(dbgId || newDebugId_());
    var batchLabel = "SELECTED_BATCH_SEND::" + requestId;
    var operationIdentity = clean_(preview.operationId || "")
      ? adminCommunicationOperationIdentity_(preview, "COHORT", messageType, actor.actorEmail, requestId)
      : null;
    if (operationIdentity && operationIdentity.ok !== true) {
      return adminCommBlockedResult_("send_selected_batch", operationIdentity.blockCode, dbgId, {
        blockReason: operationIdentity.blockReason
      });
    }
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
      replayed: 0,
      skipped: 0,
      failed: 0,
      blocked: 0,
      reconciliationRequired: 0,
      blockedByReason: {},
      applicantOutcomes: [],
      sentApplicantIdsSample: [],
      batchId: batchLabel
    };
    if (operationIdentity) adminCommunicationWithIdentity_(out, operationIdentity);
    candidateIds.forEach(function (applicantId) {
      try {
        var sendResult = sendApplicantMessage_(applicantId, messageType, Object.assign({
          actorEmail: actor.actorEmail,
          actorRole: actor.actorRole,
          batchLabel: batchLabel,
          debugId: requestId,
          templateId: requestedTemplateId,
          templateVersionId: clean_(p.templateVersionId || preview.templateVersionId || ""),
          sendSource: "ADMIN_SELECTED_BATCH",
          unattended: false
        }, operationIdentity || {}));
        var outcome = selectedBatchApplicantOutcome_(applicantId, sendResult, null);
        out.applicantOutcomes.push(outcome);
        if (outcome.outcome === "SENT" && out.sentApplicantIdsSample.length < 10) out.sentApplicantIdsSample.push(applicantId);
      } catch (recipientErr) {
        out.applicantOutcomes.push(selectedBatchApplicantOutcome_(applicantId, null, recipientErr));
      }
    });
    selectedBatchOutcomeTotals_(out);
    out.skipped = Math.max(0, Number(preview.candidateCount || candidateIds.length) - out.attempted);
    clearSelectedApplicantBatchPreviewCache_(adminEmail);
    return out;
    });
  });
}
