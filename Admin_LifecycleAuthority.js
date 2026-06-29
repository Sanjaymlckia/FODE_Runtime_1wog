function deriveOperationalPipelineStage_(rowObj) {
  var row = rowObj || {};
  var raw = clean_(row.Pipeline_Stage || row.Operational_Stage || row.CRM_Stage || row.Stage || "");
  var normalized = raw.toLowerCase();
  if (normalized === "new to mlckia") return "New To MLCKIA";
  if (normalized === "contacted") return "Contacted";
  if (normalized === "documents pending") return "Documents Pending";
  if (normalized === "payment pending") return "Payment Pending";
  if (normalized === "enrolled") return "Enrolled";
  if (normalized === "closed lost") return "Closed Lost";

  var portalSubmitted = adminRowPortalSubmitted_(row);
  var docsVerified = adminRowDocsReviewVerified_(row);
  var paymentVerified = isCanonicalPaymentVerified_(row);
  var registrationComplete = clean_(row.Registration_Complete || "") === "Yes";
  var receiptPresent = adminRowPaymentEvidencePresent_(row);
  var emailStatus = normalizeEmailStatus_(row.Email_Status || "");
  var lastContact = clean_(row.Last_Contact_Result || "").toUpperCase();

  if (/closed|lost|withdraw/i.test(raw)) return "Closed Lost";
  if (registrationComplete || paymentVerified) return "Enrolled";
  if (docsVerified || receiptPresent) return "Payment Pending";
  if (portalSubmitted) return "Documents Pending";
  if (emailStatus === "SENT" || emailStatus === "SEND_ATTEMPT" || lastContact) return "Contacted";
  return "New To MLCKIA";
}

function campaignReportPortalSubmitted_(rowObj) {
  var row = rowObj || {};
  var raw = clean_(row.Portal_Submitted || "");
  return nonEmpty_(raw) && raw !== "No";
}

function isCampaignReportApplicationRow_(rowObj) {
  var row = rowObj || {};
  if (!clean_(row.ApplicantID || "")) return false;
  if (campaignReportPortalSubmitted_(row)) return true;
  if (isExternalFdIntakeRow_(row)) return true;
  if (hasStudentActivity_(row)) return true;
  return !!clean_(row.FD_FormID || row.FormID || "");
}

function campaignReportValidApplication_(rowObj) {
  var row = rowObj || {};
  return adminRowDocsReviewVerified_(row)
    || isCanonicalPaymentVerified_(row)
    || clean_(row.Registration_Complete || "") === "Yes";
}

function campaignReportStatusText_(rowObj) {
  var row = rowObj || {};
  return [
    row.Duplicate_Status,
    row.Duplicate_Flag,
    row.Is_Duplicate,
    row.Overall_Status,
    row.Pipeline_Stage,
    row.Operational_Stage,
    row.CRM_Stage,
    row.Stage
  ].map(function (value) { return clean_(value || ""); }).filter(Boolean).join(" | ").toLowerCase();
}

function campaignReportDuplicateBlockedIneligible_(rowObj) {
  var row = rowObj || {};
  var duplicateFlag = clean_(row.Is_Duplicate || row.Duplicate_Flag || "");
  if (/^(yes|true|1)$/i.test(duplicateFlag)) return true;
  var text = campaignReportStatusText_(rowObj);
  if (!text) return false;
  return /duplicate|blocked|ineligible|dropped|disqualified|closed\s*lost|withdrawn|not\s*eligible/.test(text);
}

function mapStagePriority_(stage) {
  switch (clean_(stage || "").toUpperCase()) {
    case "PAYMENT_REQUIRED":
    case "RECEIPT_AWAITING_VERIFICATION":
      return "HIGH";
    case "DOCS_REQUIRED":
    case "REMINDER_DUE":
    case "INVITED_AWAITING_RESPONSE":
      return "NORMAL";
    default:
      return "LOW";
  }
}

function stageAggregationSortIndex_(stage) {
  var order = {
    PAYMENT_REQUIRED: 1,
    RECEIPT_AWAITING_VERIFICATION: 2,
    DOCS_REQUIRED: 3,
    REMINDER_DUE: 4,
    INVITED_AWAITING_RESPONSE: 5,
    INVITE_PENDING: 6,
    PROCESSING: 7,
    COMPLETE: 8,
    UNKNOWN: 99
  };
  var normalized = clean_(stage || "").toUpperCase();
  return Object.prototype.hasOwnProperty.call(order, normalized) ? order[normalized] : 99;
}
