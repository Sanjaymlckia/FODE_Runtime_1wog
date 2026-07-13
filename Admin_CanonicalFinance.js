var CANONICAL_FINANCE_SCHEMA_VERSION = "CANONICAL_FINANCE_V1";

function canonicalFinanceClean_(value) {
  return typeof clean_ === "function" ? clean_(value) : String(value == null ? "" : value).trim();
}

function canonicalFinanceUpper_(value) {
  return canonicalFinanceClean_(value).toUpperCase();
}

function canonicalFinanceNowIso_() {
  return new Date().toISOString();
}

function canonicalFinanceAmount_(row, names, semantic) {
  var sourceMap = [];
  for (var i = 0; i < names.length; i++) {
    var name = names[i];
    var raw = row && row[name];
    if (raw === null || raw === undefined || canonicalFinanceClean_(raw) === "") {
      sourceMap.push({ field: name, state: "BLANK", raw: "" });
      continue;
    }
    var parsed = typeof parseZohoBooksRate_ === "function" ? parseZohoBooksRate_(raw) : Number(String(raw).replace(/[^0-9.-]/g, ""));
    if (isNaN(parsed)) {
      return { semantic: semantic, state: "INVALID", amount: null, field: name, raw: canonicalFinanceClean_(raw), sourceMap: sourceMap.concat([{ field: name, state: "INVALID", raw: canonicalFinanceClean_(raw) }]) };
    }
    return { semantic: semantic, state: parsed === 0 ? "ZERO" : "VALUE", amount: parsed, field: name, raw: canonicalFinanceClean_(raw), sourceMap: sourceMap.concat([{ field: name, state: parsed === 0 ? "ZERO" : "VALUE", raw: canonicalFinanceClean_(raw) }]) };
  }
  return { semantic: semantic, state: "UNAVAILABLE", amount: null, field: "", raw: "", sourceMap: sourceMap };
}

function canonicalFinanceObjectFields_(row) {
  row = row || {};
  return {
    quoteId: canonicalFinanceClean_(row.Quote_ID || row.Quote_Number || ""),
    quoteStatus: canonicalFinanceClean_(row.Quote_Status || ""),
    quoteDate: canonicalFinanceClean_(row.Quote_Date || ""),
    invoiceId: canonicalFinanceClean_(row.Books_Invoice_ID || ""),
    invoiceNumber: canonicalFinanceClean_(row.Books_Invoice_Number || ""),
    invoiceStatus: canonicalFinanceClean_(row.Books_Invoice_Status || ""),
    invoiceDate: canonicalFinanceClean_(row.Invoice_Sent_At || row.Books_Last_Push_At || ""),
    receiptIdentifiers: {
      receiptFile: canonicalFinanceClean_(row.Fee_Receipt_File || ""),
      receiptStatus: canonicalFinanceClean_(row.Receipt_Status || ""),
      receiptComment: canonicalFinanceClean_(row.Receipt_Comment || "")
    },
    books: {
      contactId: canonicalFinanceClean_(row.Books_Contact_ID || ""),
      contactName: canonicalFinanceClean_(row.Books_Contact_Name || ""),
      invoiceId: canonicalFinanceClean_(row.Books_Invoice_ID || ""),
      invoiceNumber: canonicalFinanceClean_(row.Books_Invoice_Number || ""),
      invoiceStatus: canonicalFinanceClean_(row.Books_Invoice_Status || ""),
      pushStatus: canonicalFinanceClean_(row.Books_Push_Status || ""),
      lastPushAt: canonicalFinanceClean_(row.Books_Last_Push_At || ""),
      lastAttemptAt: canonicalFinanceClean_(row.Books_Last_Attempt_At || ""),
      lastError: canonicalFinanceClean_(row.Books_Last_Error || ""),
      attemptCount: canonicalFinanceClean_(row.Books_Attempt_Count || ""),
      lastPayloadHash: canonicalFinanceClean_(row.Books_Last_Payload_Hash || ""),
      billingReference: canonicalFinanceClean_(row.FODE_Billing_Reference || "")
    },
    legacyInvoiceTrigger: {
      crmInvoiceTriggered: canonicalFinanceClean_(row.CRM_Invoice_Triggered || ""),
      invoiceSentAt: canonicalFinanceClean_(row.Invoice_Sent_At || "")
    }
  };
}

function resolveCanonicalFinance_(rowObj, canonicalPopulationRow, opts) {
  var row = rowObj || {};
  var canonical = canonicalPopulationRow || {};
  var finance = canonical.finance || {};
  var lifecycle = canonical.lifecycle || {};
  var actionability = canonical.actionability || {};
  var communication = canonical.communication || {};
  var options = opts && typeof opts === "object" ? opts : {};
  var receiptStatus = canonicalFinanceClean_(row.Receipt_Status || finance.receiptStatus || "");
  var receiptStatusKey = receiptStatus.toLowerCase();
  var receiptEvidencePresent = finance.paymentEvidencePresent === true || canonicalFinanceClean_(row.Fee_Receipt_File || "") !== "";
  var paymentVerified = finance.paymentVerified === true || (typeof isCanonicalPaymentVerified_ === "function" && isCanonicalPaymentVerified_(row) === true);
  var rawPaymentVerified = canonicalFinanceClean_(row.Payment_Verified || "");
  var financeState = paymentVerified ? "PAID_VERIFIED" : (receiptEvidencePresent ? "PAYMENT_TO_VERIFY" : "PAYMENT_PENDING");
  var reasonCode = paymentVerified ? "RECEIPT_STATUS_VERIFIED" : (receiptEvidencePresent ? "RECEIPT_EVIDENCE_PENDING_VERIFICATION" : "PAYMENT_EVIDENCE_MISSING");
  var reason = paymentVerified ? "Receipt_Status verifies payment." : (receiptEvidencePresent ? "Receipt evidence exists and requires verification." : "No verified payment evidence is present.");
  var warnings = [];
  if (rawPaymentVerified && rawPaymentVerified.toLowerCase() === "yes" && !paymentVerified) warnings.push("Payment_Verified is compatibility-only and contradicts canonical Receipt_Status.");
  if (receiptStatusKey === "verified" && !paymentVerified) warnings.push("Receipt_Status text is present but canonical payment helper did not verify payment.");
  if (receiptStatusKey === "rejected") warnings.push("Receipt evidence was rejected; policy/workflow for follow-up remains owner-dependent.");

  var totalFee = canonicalFinanceAmount_(row, ["Fee_Total_Kina", "Total_Fee_Kina", "Total_Fee"], "totalFee");
  var quotedAmount = canonicalFinanceAmount_(row, ["Quote_Amount", "Quoted_Amount", "Fee_Total_Kina", "Total_Fee_Kina", "Total_Fee"], "quotedAmount");
  var invoicedAmount = canonicalFinanceAmount_(row, ["Books_Invoice_Total", "Invoice_Amount", "Invoiced_Amount"], "invoicedAmount");
  var amountPaid = canonicalFinanceAmount_(row, ["Amount_Paid", "Payment_Amount", "Paid_Amount"], "amountPaid");
  var amountPending = canonicalFinanceAmount_(row, ["Receipt_Amount", "Pending_Verification_Amount"], "amountPendingVerification");
  var amountCredited = canonicalFinanceAmount_(row, ["Credit_Amount", "Amount_Credited"], "amountCredited");
  var amountRefunded = canonicalFinanceAmount_(row, ["Refund_Amount", "Amount_Refunded"], "amountRefunded");
  var outstanding = { semantic: "outstandingBalance", state: "UNRESOLVED", amount: null, field: "", raw: "", sourceMap: [] };
  if (totalFee.state === "VALUE" && amountPaid.state === "VALUE") {
    outstanding = { semantic: "outstandingBalance", state: "VALUE", amount: Number(totalFee.amount) - Number(amountPaid.amount), field: totalFee.field + "-" + amountPaid.field, raw: "", sourceMap: totalFee.sourceMap.concat(amountPaid.sourceMap) };
  }

  var amountCompleteness = [totalFee, quotedAmount, invoicedAmount, amountPaid, amountPending, amountCredited, amountRefunded, outstanding].some(function (item) {
    return item.state === "INVALID" || item.state === "UNRESOLVED";
  }) ? "INCOMPLETE" : "SOURCE_LIMITED";

  return {
    schemaVersion: CANONICAL_FINANCE_SCHEMA_VERSION,
    readOnly: true,
    identity: {
      applicantId: canonicalFinanceClean_(canonical.identity && canonical.identity.applicantId || row.ApplicantID || ""),
      rowNumber: Number(canonical.identity && canonical.identity.rowNumber || options.rowNumber || 0),
      sourceSheetName: canonicalFinanceClean_(canonical.identity && canonical.identity.sourceSheetName || options.sourceSheetName || ""),
      applicantName: canonicalFinanceClean_(canonical.applicant && canonical.applicant.name || row.Student_Name || row.Applicant_Name || "")
    },
    financeAuthority: {
      financeState: financeState,
      financeReasonCode: reasonCode,
      financeReason: reason,
      receiptStatus: receiptStatus,
      receiptVerificationState: paymentVerified ? "VERIFIED" : (receiptEvidencePresent ? "PENDING_VERIFICATION" : "MISSING"),
      financeAuthoritySource: "Receipt_Status / canonical payment helpers",
      authorityTimestamp: canonicalFinanceClean_(row.Doc_Last_Verified_At || row.Payment_Last_Verified_At || row.Books_Last_Push_At || ""),
      paymentVerified: paymentVerified,
      paymentEvidencePresent: receiptEvidencePresent,
      compatibilityPaymentVerifiedRaw: rawPaymentVerified
    },
    amounts: {
      currency: canonicalFinanceClean_(row.Currency || "PGK"),
      totalFee: totalFee,
      quotedAmount: quotedAmount,
      invoicedAmount: invoicedAmount,
      amountPaid: amountPaid,
      amountPendingVerification: amountPending,
      amountCredited: amountCredited,
      amountRefunded: amountRefunded,
      outstandingBalance: outstanding,
      calculationCompleteness: amountCompleteness,
      amountSourceMap: {
        totalFee: totalFee.sourceMap,
        quotedAmount: quotedAmount.sourceMap,
        invoicedAmount: invoicedAmount.sourceMap,
        amountPaid: amountPaid.sourceMap,
        amountPendingVerification: amountPending.sourceMap,
        amountCredited: amountCredited.sourceMap,
        amountRefunded: amountRefunded.sourceMap,
        outstandingBalance: outstanding.sourceMap
      }
    },
    objects: canonicalFinanceObjectFields_(row),
    paymentPlan: {
      planType: canonicalFinanceClean_(row.Payment_Plan_Type || ""),
      instalmentCount: canonicalFinanceClean_(row.Instalment_Count || row.Installment_Count || ""),
      nextInstalmentDueDate: canonicalFinanceClean_(row.Next_Instalment_Due_Date || row.Next_Installment_Due_Date || ""),
      nextInstalmentAmount: canonicalFinanceAmount_(row, ["Next_Instalment_Amount", "Next_Installment_Amount"], "nextInstalmentAmount"),
      overdueAmount: canonicalFinanceAmount_(row, ["Overdue_Amount"], "overdueAmount"),
      overdueDays: canonicalFinanceClean_(row.Overdue_Days || ""),
      paymentPlanSource: "POLICY_DEPENDENT_OR_UNAVAILABLE"
    },
    exceptions: {
      financeExceptionCode: warnings.length ? "FINANCE_WARNING" : "",
      financeExceptionReason: warnings.join(" "),
      disputeState: canonicalFinanceClean_(row.Payment_Dispute_Status || "") || "NOT_IMPLEMENTED",
      refundState: canonicalFinanceClean_(row.Refund_Status || "") || "NOT_IMPLEMENTED",
      creditState: canonicalFinanceClean_(row.Credit_Status || "") || "NOT_IMPLEMENTED",
      reconciliationState: "NOT_EVALUATED",
      missingRequiredFinanceData: []
    },
    operational: {
      financeActionOwner: canonicalFinanceClean_(lifecycle.actionOwner || canonical.owner || ""),
      recommendedFinanceAction: financeState === "PAYMENT_TO_VERIFY" ? "VERIFY_PAYMENT" : (financeState === "PAYMENT_PENDING" ? "SEND_PAYMENT_REMINDER" : "NO_PAYMENT_ACTION"),
      financeActionability: canonicalFinanceClean_(actionability.state || ""),
      workloadGroupKey: canonicalFinanceClean_(actionability.workloadGroupKey || ""),
      worklistKey: canonicalFinanceClean_(actionability.worklistKey || ""),
      worklistLabel: canonicalFinanceClean_(actionability.worklistLabel || ""),
      paymentFollowupRecommended: canonicalFinanceClean_(communication.recommendedMessageType || lifecycle.recommendedMessageType || "") === "payment_followup",
      paymentVerificationRequired: financeState === "PAYMENT_TO_VERIFY",
      mutationCapabilityRequired: financeState === "PAYMENT_TO_VERIFY" ? "CAN_VERIFY_PAYMENT" : ""
    },
    audit: {
      resolvedAt: canonicalFinanceNowIso_(),
      resolverVersion: CANONICAL_FINANCE_SCHEMA_VERSION,
      sourceFields: ["Receipt_Status", "Fee_Receipt_File", "Payment_Verified", "Fee_Total_Kina", "Total_Fee_Kina", "Books_*", "FODE_Billing_Reference"],
      warnings: warnings,
      unresolvedPolicyDependencies: canonicalFinancePolicyDependencies_()
    }
  };
}

function canonicalFinancePolicyDependencies_() {
  return [
    "partial payment lifecycle progression",
    "instalment schedule and grace period",
    "overdue definition",
    "refund eligibility and deductions",
    "credit and write-off authority",
    "discount and waiver authority",
    "Books-vs-runtime quote/invoice ownership"
  ];
}

function canonicalFinanceReconciliationForRow_(financeDto, canonicalRow) {
  var dto = financeDto || {};
  var authority = dto.financeAuthority || {};
  var state = canonicalFinanceUpper_(authority.financeState || "UNKNOWN");
  var codes = [];
  var severity = "INFO";
  if (state === "PAYMENT_PENDING") codes.push("PAYMENT_PENDING_CONSISTENT");
  else if (state === "PAYMENT_TO_VERIFY") codes.push("PAYMENT_TO_VERIFY_CONSISTENT");
  else if (state === "PAID_VERIFIED") codes.push("PAID_VERIFIED_CONSISTENT");
  else {
    codes.push("FINANCE_STATE_UNKNOWN");
    severity = "WARN";
  }
  if (authority.compatibilityPaymentVerifiedRaw && String(authority.compatibilityPaymentVerifiedRaw).toLowerCase() === "yes" && authority.paymentVerified !== true) {
    codes.push("PAYMENT_VERIFIED_COMPATIBILITY_DRIFT");
    severity = "WARN";
  }
  if (dto.amounts && dto.amounts.calculationCompleteness !== "SOURCE_LIMITED") {
    codes.push("AMOUNT_DATA_INCOMPLETE");
    if (severity === "INFO") severity = "WARN";
  }
  if (canonicalRow && canonicalRow.lifecycle && canonicalRow.lifecycle.baseState === "PAYMENT_PENDING" && state === "PAID_VERIFIED") {
    codes.push("LIFECYCLE_FINANCE_MISMATCH");
    severity = "WARN";
  }
  if (canonicalRow && canonicalRow.actionability && canonicalRow.actionability.workloadGroupKey === "FINANCE" && state === "PAID_VERIFIED") {
    codes.push("ACTIONABILITY_FINANCE_MISMATCH");
    severity = "WARN";
  }
  return {
    status: severity === "INFO" ? "PASS" : "PASS_WITH_FINDINGS",
    severity: severity,
    applicantId: dto.identity && dto.identity.applicantId || "",
    rowNumber: dto.identity && dto.identity.rowNumber || 0,
    codes: codes,
    conflictingSources: [],
    expectedRelationship: "Receipt_Status is canonical; Books and Payment_Verified do not determine payment authority.",
    actualValues: {
      financeState: state,
      receiptStatus: authority.receiptStatus || "",
      paymentVerifiedRaw: authority.compatibilityPaymentVerifiedRaw || "",
      booksInvoiceId: dto.objects && dto.objects.books && dto.objects.books.invoiceId || ""
    },
    recommendedOperatorAction: state === "PAYMENT_TO_VERIFY" ? "Open Review Workspace payment verification." : (state === "PAYMENT_PENDING" ? "Use payment follow-up workflow where Communication Authority permits." : "No immediate payment action."),
    mutationRoute: state === "PAYMENT_TO_VERIFY" ? "Review Workspace admin_setPaymentVerified" : "",
    ownerPolicyRequired: false
  };
}

function canonicalFinanceSnapshot_(request) {
  var snapshot = canonicalPopulationSnapshot_();
  var sourceRows = snapshot._internalSourceRowsByRowNumber || {};
  var financeRows = [];
  (snapshot.rows || []).forEach(function (row) {
    var sourceRow = sourceRows[row.identity.rowNumber] || {};
    financeRows.push(resolveCanonicalFinance_(sourceRow, row, {
      rowNumber: row.identity.rowNumber,
      sourceSheetName: row.identity.sourceSheetName
    }));
  });
  return {
    ok: true,
    readOnly: true,
    schemaVersion: CANONICAL_FINANCE_SCHEMA_VERSION,
    generatedAt: canonicalFinanceNowIso_(),
    totalRows: financeRows.length,
    rows: financeRows,
    canonicalPopulationSchemaVersion: snapshot.schemaVersion,
    sourceReconciliation: snapshot.reconciliation
  };
}

function canonicalFinanceCountBy_(rows, selector) {
  var out = {};
  (rows || []).forEach(function (row) {
    var key = canonicalFinanceUpper_(selector(row) || "UNKNOWN") || "UNKNOWN";
    out[key] = Number(out[key] || 0) + 1;
  });
  return out;
}

function canonicalFinanceSummaryFromRows_(rows) {
  var list = rows || [];
  var byState = canonicalFinanceCountBy_(list, function (row) { return row.financeAuthority.financeState; });
  var byAction = canonicalFinanceCountBy_(list, function (row) { return row.operational.recommendedFinanceAction; });
  var byWorklist = canonicalFinanceCountBy_(list, function (row) { return row.operational.worklistKey || "NONE"; });
  var exceptions = list.filter(function (row) { return row.exceptions.financeExceptionCode || (row.audit.warnings || []).length; }).length;
  var paymentFollowup = list.filter(function (row) { return row.operational.paymentFollowupRecommended === true; }).length;
  return {
    totalRows: list.length,
    byFinanceState: byState,
    byRecommendedFinanceAction: byAction,
    byWorklist: byWorklist,
    paymentPending: Number(byState.PAYMENT_PENDING || 0),
    paymentToVerify: Number(byState.PAYMENT_TO_VERIFY || 0),
    paidVerified: Number(byState.PAID_VERIFIED || 0),
    unresolvedOrInconsistent: Number(byState.UNKNOWN || 0) + Number(byState.INCONSISTENT || 0),
    paymentFollowupRecommended: paymentFollowup,
    financeExceptions: exceptions,
    policyDependent: {
      overdue: "POLICY_REQUIRED",
      refunds: "WORKFLOW_PENDING",
      credits: "WORKFLOW_PENDING",
      writeOffs: "WORKFLOW_PENDING"
    }
  };
}

function canonicalFinancePublicRow_(row) {
  return {
    schemaVersion: row.schemaVersion,
    identity: row.identity,
    financeAuthority: row.financeAuthority,
    amounts: row.amounts,
    objects: row.objects,
    paymentPlan: row.paymentPlan,
    exceptions: row.exceptions,
    operational: row.operational,
    audit: row.audit
  };
}

function canonicalFinanceRowMatches_(row, filters) {
  var f = filters || {};
  if (f.financeState && canonicalFinanceUpper_(row.financeAuthority.financeState) !== canonicalFinanceUpper_(f.financeState)) return false;
  if (f.worklistKey && canonicalFinanceUpper_(row.operational.worklistKey) !== canonicalFinanceUpper_(f.worklistKey)) return false;
  if (f.recommendedFinanceAction && canonicalFinanceUpper_(row.operational.recommendedFinanceAction) !== canonicalFinanceUpper_(f.recommendedFinanceAction)) return false;
  if (f.paymentFollowupRecommended === true && row.operational.paymentFollowupRecommended !== true) return false;
  if (f.paymentVerificationRequired === true && row.operational.paymentVerificationRequired !== true) return false;
  if (f.exceptionOnly === true && !row.exceptions.financeExceptionCode && !(row.audit.warnings || []).length) return false;
  return true;
}

function canonicalFinancePaged_(rows, request) {
  var p = request || {};
  var pageSize = Math.max(1, Math.min(100, Number(p.pageSize || p.limit || 25)));
  var page = Math.max(1, Number(p.page || 1));
  var start = (page - 1) * pageSize;
  var filtered = (rows || []).filter(function (row) { return canonicalFinanceRowMatches_(row, p.filters || p); });
  filtered.sort(function (a, b) {
    return canonicalFinanceClean_(a.identity.applicantId).localeCompare(canonicalFinanceClean_(b.identity.applicantId)) || Number(a.identity.rowNumber || 0) - Number(b.identity.rowNumber || 0);
  });
  return {
    page: page,
    pageSize: pageSize,
    total: filtered.length,
    rows: filtered.slice(start, start + pageSize).map(canonicalFinancePublicRow_)
  };
}

function admin_getCanonicalFinanceSummary(payload) {
  var snapshot = canonicalFinanceSnapshot_(payload || {});
  return { ok: true, readOnly: true, schemaVersion: snapshot.schemaVersion, generatedAt: snapshot.generatedAt, summary: canonicalFinanceSummaryFromRows_(snapshot.rows), sourceReconciliation: snapshot.sourceReconciliation };
}

function admin_getCanonicalFinanceWorklist(request) {
  var snapshot = canonicalFinanceSnapshot_(request || {});
  var page = canonicalFinancePaged_(snapshot.rows, request || {});
  return { ok: true, readOnly: true, schemaVersion: snapshot.schemaVersion, generatedAt: snapshot.generatedAt, summary: canonicalFinanceSummaryFromRows_(snapshot.rows), page: page };
}

function admin_getCanonicalFinanceApplicant(payload) {
  var applicantId = canonicalFinanceClean_(payload && payload.applicantId || "");
  if (!applicantId) return { ok: false, readOnly: true, code: "APPLICANT_ID_REQUIRED", applicant: null };
  var snapshot = canonicalFinanceSnapshot_(payload || {});
  var matches = snapshot.rows.filter(function (row) { return row.identity.applicantId === applicantId; });
  return { ok: matches.length === 1, readOnly: true, schemaVersion: snapshot.schemaVersion, code: matches.length > 1 ? "DUPLICATE_APPLICANT_ID" : (matches.length ? "" : "APPLICANT_NOT_FOUND"), applicant: matches.length ? canonicalFinancePublicRow_(matches[0]) : null };
}

function admin_getCanonicalFinanceReconciliation(request) {
  var snapshot = canonicalFinanceSnapshot_(request || {});
  var rows = snapshot.rows.map(function (row) { return canonicalFinanceReconciliationForRow_(row, null); });
  var byCode = {};
  rows.forEach(function (item) {
    (item.codes || []).forEach(function (code) { byCode[code] = Number(byCode[code] || 0) + 1; });
  });
  var findings = rows.filter(function (item) { return item.severity !== "INFO"; });
  var limit = Math.max(1, Math.min(200, Number(request && request.limit || 50)));
  return { ok: true, readOnly: true, schemaVersion: snapshot.schemaVersion, status: findings.length ? "PASS_WITH_FINDINGS" : "PASS", summary: { totalRows: rows.length, findings: findings.length, byCode: byCode }, findings: findings.slice(0, limit) };
}

function admin_getCanonicalFinanceExceptions(request) {
  var reconciliation = admin_getCanonicalFinanceReconciliation(request || {});
  return { ok: true, readOnly: true, schemaVersion: reconciliation.schemaVersion, total: reconciliation.summary.findings, rows: reconciliation.findings };
}

function admin_getCanonicalFinanceObjectHistory(payload) {
  var applicant = admin_getCanonicalFinanceApplicant(payload || {});
  if (!applicant.ok) return applicant;
  var row = applicant.applicant;
  return {
    ok: true,
    readOnly: true,
    schemaVersion: CANONICAL_FINANCE_SCHEMA_VERSION,
    applicantId: row.identity.applicantId,
    objects: row.objects,
    history: [
      { objectType: "receipt", authority: "Receipt_Status", status: row.financeAuthority.receiptStatus || "blank" },
      { objectType: "quote", authority: "Runtime/Review Workspace design pending", status: row.objects.quoteStatus || "unavailable" },
      { objectType: "invoice", authority: "Zoho Books external integration metadata", status: row.objects.invoiceStatus || "unavailable" },
      { objectType: "legacyInvoiceTrigger", authority: "Compatibility only", status: row.objects.legacyInvoiceTrigger.crmInvoiceTriggered || "blank" }
    ]
  };
}

function admin_getCanonicalFinancePolicyStatus() {
  return {
    ok: true,
    readOnly: true,
    schemaVersion: CANONICAL_FINANCE_SCHEMA_VERSION,
    implementedStates: ["PAYMENT_PENDING", "PAYMENT_TO_VERIFY", "PAID_VERIFIED"],
    unresolvedStates: ["NOT_QUOTED", "QUOTED", "INVOICED", "PARTIALLY_PAID", "OVERDUE", "DISPUTED", "CREDIT_BALANCE", "REFUND_PENDING", "REFUNDED", "WAIVED", "CANCELLED", "WRITTEN_OFF"],
    ownerDecisionsRequired: canonicalFinancePolicyDependencies_()
  };
}
