function adminRowPortalSubmitted_(rowObj) {
  var row = rowObj || {};
  var raw = clean_(row.Portal_Submitted || "");
  return nonEmpty_(raw) && raw !== "No";
}

function adminRowDocsReviewVerified_(rowObj) {
  return adminDocumentReviewVerifiedForPaymentGate_(rowObj);
}

function adminRowPaymentEvidencePresent_(rowObj) {
  var row = rowObj || {};
  return hasUploadEvidence_(row.Fee_Receipt_File, "Fee_Receipt_File");
}

function adminRowPaymentCompatibilityRawVerified_(rowObj) {
  var row = rowObj || {};
  return clean_(row.Payment_Verified || "") === "Yes";
}

function adminRowPaymentAuthorityFacts_(rowObj) {
  var row = rowObj || {};
  return {
    paymentVerifiedRaw: adminRowPaymentCompatibilityRawVerified_(row),
    paymentBadge: canonicalPaymentBadge_(row),
    paymentEvidencePresent: adminRowPaymentEvidencePresent_(row),
    paymentVerified: isCanonicalPaymentVerified_(row)
  };
}
