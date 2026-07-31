/**
 * R390D controlled shadow integration for the existing individual-send path.
 * This layer can record a ledger shadow result, but it never invokes Gmail.
 */
var FODE_COMMUNICATION_LEDGER_SHADOW_PROPERTIES = {
  enabled: "COMMUNICATION_LEDGER_SHADOW_ENABLED",
  endpoint: "COMMUNICATION_LEDGER_SHADOW_ENDPOINT",
  keyId: "COMMUNICATION_LEDGER_SHADOW_KEY_ID",
  signingSecret: "COMMUNICATION_LEDGER_SHADOW_SIGNING_SECRET"
};

function fodeLedgerShadowConfig_(propertyService) {
  var props;
  try {
    props = (propertyService || PropertiesService).getScriptProperties();
    return {
      enabled: String(props.getProperty(FODE_COMMUNICATION_LEDGER_SHADOW_PROPERTIES.enabled) || "").toLowerCase() === "true",
      endpoint: String(props.getProperty(FODE_COMMUNICATION_LEDGER_SHADOW_PROPERTIES.endpoint) || ""),
      keyId: String(props.getProperty(FODE_COMMUNICATION_LEDGER_SHADOW_PROPERTIES.keyId) || ""),
      signingSecret: String(props.getProperty(FODE_COMMUNICATION_LEDGER_SHADOW_PROPERTIES.signingSecret) || "")
    };
  } catch (_error) {
    return { enabled: false, endpoint: "", keyId: "", signingSecret: "", code: "SHADOW_CONFIGURATION_UNAVAILABLE" };
  }
}

function fodeLedgerShadowCanonicalPayload_(legacyResult, approvedPreview, nowMs, pngTimestamp) {
  var legacy = legacyResult && typeof legacyResult === "object" ? legacyResult : {};
  var preview = approvedPreview && typeof approvedPreview === "object" ? approvedPreview : {};
  var identity = preview.identity && typeof preview.identity === "object" ? preview.identity : preview;
  var canonical = {
    recipient: String(preview.recipient || preview.effectiveEmail || legacy.effectiveEmail || "").trim(),
    subject: String(preview.subject || legacy.subject || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n"),
    body: String(preview.body || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n"),
    cc: String(preview.cc || legacy.cc || "").trim(),
    bcc: String(preview.bcc || legacy.bcc || "").trim(),
    templateId: String(preview.templateId || legacy.templateId || "").trim(),
    templateVersionId: String(preview.templateVersionId || legacy.templateVersionId || "").trim()
  };
  var technicalTimestamp = new Date(Number(nowMs)).toISOString().replace(/\.\d{3}Z$/, "Z");
  return {
    shadowMode: true,
    shadowState: "shadow_recorded",
    communicationId: "comm_" + String(identity.operationId || legacy.operationId || "").replace(/[^A-Za-z0-9_-]/g, "_").slice(0, 70),
    receiptId: String(identity.receiptId || legacy.receiptId || ""),
    channel: "EMAIL",
    legacyOutcome: String(legacy.result || legacy.outcome || "UNKNOWN"),
    legacyCode: String(legacy.code || legacy.blockCode || ""),
    gmailAccepted: legacy.gmailAccepted === true,
    rowPatchConfirmed: legacy.rowPatchConfirmed === true,
    communicationRecorded: legacy.communicationRecorded === true,
    uncertaintyState: legacy.result === "RECONCILIATION_REQUIRED" ? "DELIVERY_UNKNOWN" : "",
    technicalTimestamp: technicalTimestamp,
    pngTimestamp: String(pngTimestamp || ""),
    previewFingerprint: fodeLedgerSha256Hex_(fodeLedgerCanonicalJson_(canonical)),
    recipientFingerprint: fodeLedgerSha256Hex_(canonical.recipient),
    subjectFingerprint: fodeLedgerSha256Hex_(canonical.subject),
    bodyFingerprint: fodeLedgerSha256Hex_(canonical.body),
    portalLinkPresent: /https?:\/\//i.test(canonical.body),
    portalLinkOmitted: true
  };
}

function fodeLedgerShadowPngTimestamp_(milliseconds) {
  try { return Utilities.formatDate(new Date(Number(milliseconds)), Session.getScriptTimeZone() || "GMT", "dd MMM yyyy, hh:mm a"); } catch (_error) { return ""; }
}

function fodeLedgerShadowReconciliation_(request, ledgerResult, legacyResult, clientResult) {
  var response = ledgerResult && typeof ledgerResult === "object" ? ledgerResult : {};
  var payload = request && request.payload && typeof request.payload === "object" ? request.payload : {};
  var fields = ["operationId", "applicantId", "previewId", "receiptId", "channel", "legacyOutcome", "technicalTimestamp"];
  var mismatches = fields.filter(function (field) {
    var expected = field === "operationId" ? request.operationId : field === "applicantId" ? request.applicantId : field === "previewId" ? request.previewId : payload[field];
    return String(response[field] == null ? "" : response[field]) !== String(expected == null ? "" : expected);
  });
  var legacyAccepted = legacyResult && legacyResult.gmailAccepted === true;
  if (clientResult.status === "REPLAY") return { ok: mismatches.length === 0, state: mismatches.length === 0 ? "shadow_replayed" : "shadow_reconciliation_required", mismatches: mismatches, replay: true, reconciliationRequired: mismatches.length !== 0 };
  if (mismatches.length) return { ok: false, state: "shadow_reconciliation_required", mismatches: mismatches, replay: false, reconciliationRequired: true };
  return { ok: true, state: "shadow_reconciled", mismatches: [], replay: false, reconciliationRequired: false, legacyDeliveryAccepted: legacyAccepted };
}

function fodeLedgerShadowRecord_(legacyResult, approvedPreview, options) {
  options = options || {};
  var legacy = legacyResult && typeof legacyResult === "object" ? legacyResult : {};
  var preview = approvedPreview && typeof approvedPreview === "object" ? approvedPreview : {};
  var identity = preview.identity && typeof preview.identity === "object" ? preview.identity : preview;
  var operationId = String(identity.operationId || legacy.operationId || "");
  var base = { operationId: operationId, contractVersion: "1.0", enabled: false, externalDeliveryInvoked: false, reconciliationRequired: false };
  if (!operationId) return Object.assign(base, { shadowState: "shadow_failed", code: "SHADOW_OPERATION_ID_REQUIRED" });
  var nowMs = options.nowMs == null ? new Date().getTime() : Number(options.nowMs);
  var payload = fodeLedgerShadowCanonicalPayload_(legacy, preview, nowMs, options.pngTimestamp || fodeLedgerShadowPngTimestamp_(nowMs));
  var config = options.config || fodeLedgerShadowConfig_(options.propertyService);
  if (config.enabled !== true) return Object.assign(base, { shadowState: "shadow_pending", code: config.code || "SHADOW_DISABLED", payloadSummary: fodeLedgerRedact_({ operationId: operationId, contractVersion: "1.0", shadowState: "shadow_pending", channel: payload.channel, legacyOutcome: payload.legacyOutcome, technicalTimestamp: payload.technicalTimestamp, pngTimestamp: payload.pngTimestamp }) });
  if (!config.endpoint || !config.keyId || !config.signingSecret) return Object.assign(base, { enabled: true, shadowState: "shadow_failed", code: "SHADOW_CONFIGURATION_INCOMPLETE" });
  var client = options.client || new FodeCommunicationLedgerClient({ endpoint: config.endpoint, keyId: config.keyId, signingSecret: config.signingSecret, maxAttempts: 2 });
  var request = {
    commandType: "SHADOW_COMMUNICATION_RESULT",
    commandId: "shadow_cmd_" + operationId.replace(/[^A-Za-z0-9_-]/g, "_"),
    actor: "FODE_SHADOW",
    authorityContext: { source: "R390D_SHADOW", contractVersion: "1.0", externalDeliveryAuthority: "LEGACY_INDIVIDUAL_SEND" },
    operationId: operationId,
    idempotencyKey: String(identity.idempotencyKey || legacy.idempotencyKey || operationId),
    previewId: String(identity.previewId || legacy.previewId || ""),
    applicantId: String(preview.applicantId || legacy.applicantId || ""),
    expectedState: "SHADOW_PENDING",
    requestedAt: payload.technicalTimestamp,
    payload: payload
  };
  var result = client.sendCommand(request);
  var shadowState = result.status === "ACCEPTED" ? "shadow_recorded" : result.status === "REPLAY" ? "shadow_replayed" : result.status === "DELIVERY_UNKNOWN" ? "shadow_delivery_unknown" : result.code === "IDEMPOTENCY_CONFLICT" ? "shadow_conflict" : "shadow_failed";
  if (result.status === "ACCEPTED" || result.status === "REPLAY") {
    var reconciliation = fodeLedgerShadowReconciliation_(request, result.response, legacy, result);
    shadowState = reconciliation.state;
    return Object.assign(base, { enabled: true, shadowState: shadowState, ledgerStatus: result.status, operationId: operationId, reconciliation: reconciliation, reconciliationRequired: reconciliation.reconciliationRequired, diagnostics: fodeLedgerRedact_({ operationId: operationId, contractVersion: "1.0", shadowState: shadowState, ledgerStatus: result.status, reconciliationRequired: reconciliation.reconciliationRequired, attempts: result.attempts }) });
  }
  return Object.assign(base, { enabled: true, shadowState: shadowState, ledgerStatus: result.status || "REJECTED", code: result.code, uncertain: result.uncertain === true, reconciliationRequired: result.uncertain === true || legacy.gmailAccepted === true, diagnostics: fodeLedgerRedact_({ operationId: operationId, contractVersion: "1.0", shadowState: shadowState, code: result.code, uncertain: result.uncertain === true, attempts: result.attempts }) });
}
