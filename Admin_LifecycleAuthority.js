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

function resolveCanonicalApplicantLifecycle_(rowObj, opts) {
  var row = rowObj || {};
  var options = opts && typeof opts === "object" ? opts : {};
  var uploadSummary = typeof options.uploadSummary === "object" && options.uploadSummary
    ? options.uploadSummary
    : adminOpsRequiredDocumentUploadSummary_(row);
  var paymentFacts = typeof options.paymentFacts === "object" && options.paymentFacts
    ? options.paymentFacts
    : adminRowPaymentAuthorityFacts_(row);
  var portalSubmitted = typeof options.portalSubmitted === "boolean"
    ? options.portalSubmitted
    : adminRowPortalSubmitted_(row);
  var docReviewStatus = clean_(options.docReviewStatus || computeDocVerificationStatus_(row) || "Pending");
  var docsVerified = typeof options.docsVerified === "boolean"
    ? options.docsVerified
    : adminDocumentReviewVerifiedForAutomation_(row);
  var requiredComplete = uploadSummary && uploadSummary.requiredDocumentUploadComplete === true;
  var uploadedRequiredCount = Number(uploadSummary && uploadSummary.uploadedRequiredCount || 0);
  var requiredCount = Number(uploadSummary && uploadSummary.requiredCount || 0);
  var missingRequiredDocuments = Array.isArray(uploadSummary && uploadSummary.missingRequiredDocuments)
    ? uploadSummary.missingRequiredDocuments.slice()
    : [];
  var paymentEvidencePresent = paymentFacts && paymentFacts.paymentEvidencePresent === true;
  var paymentVerified = paymentFacts && paymentFacts.paymentVerified === true;
  var enrolled = isYes_(row.Registration_Complete)
    || isYes_(row.Enrolled_Confirmed)
    || !!clean_(row.Enrolled_At || "");
  var emailStatus = clean_(row.Email_Status || "").toUpperCase();
  var bounceFlag = /^(YES|TRUE|1|BOUNCED)$/i.test(clean_(row.Email_Bounce_Flag || ""));
  var effectiveEmail = clean_(row.Effective_Email || row.Parent_Email_Corrected || row.Parent_Email || "");
  var hasValidEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(effectiveEmail);
  var portalIssued = !!clean_(row.PortalURL || row.Portal_Link || row.Portal_Token_Status || row.portalLastUpdateAt || row.PortalLastUpdateAt || "");
  var communicationStarted = emailStatus === "SENT"
    || emailStatus === "SEND_ATTEMPT"
    || !!clean_(row.Last_Contact_Result || row.Last_Contacted_At || row.Email_Last_Sent_At || "");
  var attemptCount = typeof campaignAttemptCount_ === "function" ? campaignAttemptCount_(row) : Number(row.Email_Attempt_Count || 0);
  var nextActionTs = parseTime_(row.Email_Next_Action_Date || "");
  var nowTs = options.nowTs ? Number(options.nowTs) : Date.now();
  var now = new Date(nowTs);
  var todayTs = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  var coolingOff = nextActionTs > nowTs;
  var reminderDue = emailStatus === "SENT"
    && portalSubmitted !== true
    && bounceFlag !== true
    && attemptCount >= 1
    && attemptCount < 3
    && nextActionTs > 0
    && nextActionTs <= todayTs;
  var baseState = "UNKNOWN";
  var actionOwner = "SYSTEM";
  var recommendedNextAction = "REVIEW_APPLICANT";
  var recommendedMessageType = "";
  var reason = "";

  if (!clean_(row.ApplicantID || "")) {
    reason = "ApplicantID is missing.";
  } else if (!portalSubmitted && !uploadedRequiredCount && !communicationStarted && !portalIssued) {
    baseState = "APPLICATION_RECEIVED";
    actionOwner = "ADMIN";
    recommendedNextAction = "ISSUE_PORTAL_OR_INVITE";
    recommendedMessageType = "legacy_invite";
    reason = "Application row exists before portal/intake follow-up has begun.";
  } else if (!portalSubmitted && !uploadedRequiredCount && portalIssued && !communicationStarted) {
    baseState = "AWAITING_PORTAL_OR_INTAKE";
    actionOwner = "APPLICANT";
    recommendedNextAction = "COMPLETE_PORTAL_OR_INTAKE";
    recommendedMessageType = "legacy_invite";
    reason = "Portal/intake access exists and applicant completion is pending.";
  } else if (enrolled) {
    baseState = "COMPLETE";
    actionOwner = "NONE";
    recommendedNextAction = "NO_ACTION";
    reason = "Enrollment or registration completion is recorded.";
  } else if (paymentVerified && docsVerified) {
    baseState = "ENROLMENT_READY";
    actionOwner = "ADMIN";
    recommendedNextAction = "COMPLETE_ENROLMENT";
    reason = "Documents and payment are verified; enrolment authority is next.";
  } else if (docsVerified && paymentEvidencePresent && !paymentVerified) {
    baseState = "PAYMENT_TO_VERIFY";
    actionOwner = "FINANCE";
    recommendedNextAction = "VERIFY_PAYMENT";
    reason = "Payment evidence is present and awaiting finance verification.";
  } else if (docsVerified && !paymentVerified) {
    baseState = "PAYMENT_PENDING";
    actionOwner = "APPLICANT";
    recommendedNextAction = "SEND_PAYMENT_REMINDER";
    recommendedMessageType = "payment_followup";
    reason = "Documents are verified and payment evidence is missing.";
  } else if (docReviewStatus === "Rejected") {
    baseState = "DOCUMENT_CORRECTION_REQUIRED";
    actionOwner = "APPLICANT";
    recommendedNextAction = "RESUBMIT_DOCUMENTS";
    recommendedMessageType = "docs_missing";
    reason = "Document review requires correction or resubmission.";
  } else if (requiredComplete && !docsVerified) {
    baseState = "DOCUMENTS_TO_VERIFY";
    actionOwner = "OFFICER";
    recommendedNextAction = "REVIEW_DOCUMENTS";
    reason = "All required uploads are present and awaiting document verification.";
  } else if (!requiredComplete) {
    baseState = "INCOMPLETE_DOCUMENTS";
    actionOwner = "APPLICANT";
    recommendedNextAction = "UPLOAD_REQUIRED_DOCUMENTS";
    recommendedMessageType = "docs_missing";
    reason = "Required upload evidence is incomplete.";
  } else {
    reason = "Lifecycle state could not be resolved from current facts.";
  }

  var overlays = [];
  if (reminderDue) overlays.push("REMINDER_DUE");
  if (coolingOff) overlays.push("COOLING_OFF");
  if (!hasValidEmail || emailStatus === "DO_NOT_CONTACT") overlays.push("CONTACT_BLOCKED");
  if (bounceFlag || emailStatus === "BOUNCED") overlays.push("BOUNCED");
  if (actionOwner === "APPLICANT") overlays.push("AWAITING_APPLICANT");

  return {
    ok: true,
    readOnly: true,
    source: "resolveCanonicalApplicantLifecycle_",
    applicantId: clean_(row.ApplicantID || ""),
    baseState: baseState,
    lifecycleStage: baseState,
    overlays: overlays,
    recommendedNextAction: recommendedNextAction,
    actionOwner: actionOwner,
    recommendedMessageType: recommendedMessageType,
    reason: reason,
    facts: {
      portalSubmitted: portalSubmitted === true,
      requiredDocumentUploadComplete: requiredComplete,
      uploadedRequiredDocumentCount: uploadedRequiredCount,
      requiredDocumentCount: requiredCount,
      missingRequiredDocuments: missingRequiredDocuments,
      docReviewStatus: docReviewStatus,
      docsVerified: docsVerified === true,
      paymentEvidencePresent: paymentEvidencePresent,
      paymentVerified: paymentVerified,
      enrolled: enrolled,
      emailStatus: emailStatus,
      portalIssued: portalIssued,
      communicationStarted: communicationStarted,
      reminderDue: reminderDue,
      coolingOff: coolingOff,
      contactBlocked: !hasValidEmail || emailStatus === "DO_NOT_CONTACT",
      bounced: bounceFlag || emailStatus === "BOUNCED"
    }
  };
}

function compareLegacyCanonicalLifecycle_(legacyLifecycle, canonicalLifecycle) {
  var legacy = clean_(legacyLifecycle || "UNKNOWN").toUpperCase() || "UNKNOWN";
  var canonical = canonicalLifecycle && typeof canonicalLifecycle === "object" ? canonicalLifecycle : {};
  var baseState = clean_(canonical.baseState || canonical.lifecycleStage || "UNKNOWN").toUpperCase() || "UNKNOWN";
  var overlays = Array.isArray(canonical.overlays) ? canonical.overlays.map(function (item) {
    return clean_(item || "").toUpperCase();
  }).filter(Boolean) : [];
  var equivalent = {
    INVITE_PENDING: ["APPLICATION_RECEIVED", "AWAITING_PORTAL_OR_INTAKE"],
    DOCS_REQUIRED: ["INCOMPLETE_DOCUMENTS", "DOCUMENT_CORRECTION_REQUIRED"],
    PAYMENT_REQUIRED: ["PAYMENT_PENDING"],
    RECEIPT_AWAITING_VERIFICATION: ["PAYMENT_TO_VERIFY"],
    COMPLETE: ["COMPLETE"]
  };
  var expected = equivalent[legacy] || [legacy];
  var matchesBase = expected.indexOf(baseState) >= 0;
  var out = {
    hasLifecycleMismatch: false,
    legacyLifecycle: legacy,
    canonicalBaseState: baseState,
    canonicalOverlays: overlays,
    mismatchReason: ""
  };

  if (matchesBase) return out;
  if (overlays.indexOf(legacy) >= 0) {
    out.hasLifecycleMismatch = true;
    out.mismatchReason = "Legacy lifecycle represents a timing/contact overlay while canonical lifecycle preserves applicant base state.";
    return out;
  }
  out.hasLifecycleMismatch = true;
  out.mismatchReason = "Legacy lifecycle does not match canonical applicant base state.";
  return out;
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
