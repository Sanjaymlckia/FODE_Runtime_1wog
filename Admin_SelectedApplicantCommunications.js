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
