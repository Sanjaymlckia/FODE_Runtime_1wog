var FODE_REGISTRY_SCHEMA_VERSION = "FODE_REGISTRY_AUTHORITY_V1";
var FODE_EXAM_ELIGIBILITY_SCHEMA_VERSION = "FODE_EXAM_ELIGIBILITY_V1";
var FODE_ACADEMIC_EVIDENCE_SCHEMA_VERSION = "FODE_ACADEMIC_EVIDENCE_V1";
var FODE_AUTHORITY_STATE_PREFIX = "FODE_AUTHORITY_STATE_V1";
var FODE_DURABLE_RECEIPT_PREFIX = "FODE_DURABLE_RECEIPT_V1";
var FODE_AUTHORITY_STATE_MAX_BYTES = 4000;
var FODE_AUTHORITY_STATE_MAX_RECORDS = 600;
var FODE_DURABLE_RECEIPT_MAX_RECORDS = 600;
var FODE_REGISTRY_PREVIEW_TTL_SECONDS = 600;
var FODE_AUTHORITY_RECEIPT_TTL_SECONDS = 21600;

var FODE_EXAM_POLICY = {
  assessmentsPerSubject: 6,
  minimumScore: 70,
  averagingAllowed: false,
  maximumAttempts: 4,
  attemptWindowYears: 2
};

function fodeAuthorityClean_(value) {
  return String(value == null ? "" : value).trim();
}

function fodeAuthorityUpper_(value) {
  return fodeAuthorityClean_(value).toUpperCase();
}

function fodeAuthorityActor_(capability) {
  var email = getCallerEmail_();
  if (!isAdmin_(email)) throw new Error("ACCESS_DENIED");
  requireAdminCapability_(email, capability);
  return {
    email: normalizeAdminEmail_(email),
    role: getAdminRole_(email),
    capability: capability
  };
}

function fodeRevalidateMutationActor_(expectedActor, capability) {
  var current = fodeAuthorityActor_(capability);
  if (current.email !== fodeAuthorityClean_(expectedActor && expectedActor.email || "")) {
    throw new Error("ACTOR_CONTEXT_CHANGED");
  }
  return current;
}

function fodeAuthorityActorAll_(capabilities) {
  var list = Array.isArray(capabilities) ? capabilities : [];
  if (!list.length) throw new Error("CAPABILITY_LIST_REQUIRED");
  var actor = fodeAuthorityActor_(list[0]);
  for (var i = 1; i < list.length; i++) requireAdminCapability_(actor.email, list[i]);
  actor.capabilities = list.slice();
  return actor;
}

function fodeRevalidateMutationActorAll_(expectedActor, capabilities) {
  var current = fodeAuthorityActorAll_(capabilities);
  if (current.email !== fodeAuthorityClean_(expectedActor && expectedActor.email || "")) {
    throw new Error("ACTOR_CONTEXT_CHANGED");
  }
  return current;
}

function fodeAuthorityAnyActor_(capabilities) {
  var email = getCallerEmail_();
  if (!isAdmin_(email)) throw new Error("ACCESS_DENIED");
  var allowed = (Array.isArray(capabilities) ? capabilities : []).filter(function (capability) {
    return adminHasCapability_(email, capability);
  });
  if (!allowed.length) throw new Error("ACCESS_DENIED");
  return {
    email: normalizeAdminEmail_(email),
    role: getAdminRole_(email),
    capability: allowed[0]
  };
}

function fodeAuthorityJson_(value, fallback) {
  if (value && typeof value === "object") return value;
  var raw = fodeAuthorityClean_(value);
  if (!raw) return fallback;
  try {
    var parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch (_err) {
    return fallback;
  }
}

function fodeAuthorityUnique_(values) {
  var seen = {};
  return (Array.isArray(values) ? values : []).map(fodeAuthorityClean_).filter(function (value) {
    var key = value.toLowerCase();
    if (!value || seen[key]) return false;
    seen[key] = true;
    return true;
  });
}

function fodeSafeAuditValue_(value) {
  if (Array.isArray(value)) return value.map(fodeSafeAuditValue_);
  if (!value || typeof value !== "object") return value;
  var out = {};
  Object.keys(value).forEach(function (key) {
    if (/secret|token|portalUrl|link/i.test(key)) return;
    out[key] = fodeSafeAuditValue_(value[key]);
  });
  return out;
}

function fodeAuthorityFingerprint_(value) {
  var text = JSON.stringify(value == null ? null : value);
  try {
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, text, Utilities.Charset.UTF_8);
    return Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, "");
  } catch (_err) {
    return String(text.length) + ":" + text;
  }
}

function fodeAuthorityStateKey_(domain, applicantId) {
  var safeDomain = fodeAuthorityUpper_(domain).replace(/[^A-Z0-9_]/g, "_");
  var safeApplicantId = fodeAuthorityClean_(applicantId).replace(/[^A-Za-z0-9_-]/g, "_");
  if (!safeDomain || !safeApplicantId) throw new Error("AUTHORITY_STATE_KEY_INVALID");
  return FODE_AUTHORITY_STATE_PREFIX + "::" + safeDomain + "::" + safeApplicantId;
}

function fodeAuthorityStateStore_() {
  return PropertiesService.getScriptProperties();
}

function fodeWithAuthorityLock_(callback) {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) throw new Error("FODE_AUTHORITY_LOCK_TIMEOUT");
  try {
    return callback();
  } finally {
    lock.releaseLock();
  }
}

function fodeReadAuthorityState_(domain, applicantId) {
  var raw = fodeAuthorityStateStore_().getProperty(fodeAuthorityStateKey_(domain, applicantId));
  if (!raw) return null;
  var parsed = fodeAuthorityJson_(raw, null);
  if (!parsed || fodeAuthorityClean_(parsed.applicantId) !== fodeAuthorityClean_(applicantId)) {
    throw new Error("AUTHORITY_STATE_BINDING_MISMATCH");
  }
  return parsed;
}

function fodeAuthorityStateIndex_(domain) {
  var prefix = FODE_AUTHORITY_STATE_PREFIX + "::" + fodeAuthorityUpper_(domain).replace(/[^A-Z0-9_]/g, "_") + "::";
  var properties = fodeAuthorityStateStore_().getProperties() || {};
  var out = {};
  Object.keys(properties).forEach(function (key) {
    if (key.indexOf(prefix) !== 0) return;
    var parsed = fodeAuthorityJson_(properties[key], null);
    var applicantId = fodeAuthorityClean_(parsed && parsed.applicantId || "");
    if (applicantId) out[applicantId] = parsed;
  });
  return out;
}

function fodeAuthorityReceiptKey_(idempotencyKey) {
  var safe = fodeAuthorityClean_(idempotencyKey).replace(/[^A-Za-z0-9_-]/g, "_");
  if (!safe) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  return FODE_AUTHORITY_STATE_PREFIX + "::RECEIPT::" + safe;
}

function fodeReadAuthorityReceipt_(idempotencyKey, contextFingerprint) {
  var raw = CacheService.getUserCache().get(fodeAuthorityReceiptKey_(idempotencyKey));
  if (!raw) return null;
  var receipt = fodeAuthorityJson_(raw, null);
  if (!receipt || receipt.contextFingerprint !== contextFingerprint) throw new Error("IDEMPOTENCY_CONTEXT_MISMATCH");
  return receipt.result;
}

function fodeWriteAuthorityReceipt_(idempotencyKey, contextFingerprint, result) {
  var record = {
    schemaVersion: "FODE_AUTHORITY_RECEIPT_V1",
    idempotencyKey: fodeAuthorityClean_(idempotencyKey),
    contextFingerprint: contextFingerprint,
    recordedAt: new Date().toISOString(),
    result: fodeSafeAuditValue_(result)
  };
  var serialized = JSON.stringify(record);
  if (serialized.length > FODE_AUTHORITY_STATE_MAX_BYTES) throw new Error("AUTHORITY_RECEIPT_TOO_LARGE");
  var key = fodeAuthorityReceiptKey_(idempotencyKey);
  CacheService.getUserCache().put(key, serialized, FODE_AUTHORITY_RECEIPT_TTL_SECONDS);
  return record.result;
}

function fodeDurableReceiptKey_(domain, idempotencyKey) {
  var receiptDomain = fodeAuthorityUpper_(domain).replace(/[^A-Z0-9_]/g, "_");
  var key = fodeAuthorityClean_(idempotencyKey);
  if (!receiptDomain || !key) throw new Error("DURABLE_RECEIPT_KEY_INVALID");
  return FODE_DURABLE_RECEIPT_PREFIX + "::" + receiptDomain + "::" + fodeAuthorityFingerprint_(key);
}

function fodeReadDurableReceipt_(domain, idempotencyKey, contextFingerprint) {
  var raw = fodeAuthorityStateStore_().getProperty(fodeDurableReceiptKey_(domain, idempotencyKey));
  if (!raw) return null;
  var record = fodeAuthorityJson_(raw, null);
  if (!record || record.idempotencyKey !== fodeAuthorityClean_(idempotencyKey)) {
    throw new Error("DURABLE_RECEIPT_BINDING_MISMATCH");
  }
  if (record.contextFingerprint !== contextFingerprint) throw new Error("IDEMPOTENCY_CONTEXT_MISMATCH");
  return record;
}

function fodeDurableReceiptIndex_(domain) {
  var prefix = FODE_DURABLE_RECEIPT_PREFIX + "::" + fodeAuthorityUpper_(domain).replace(/[^A-Z0-9_]/g, "_") + "::";
  var properties = fodeAuthorityStateStore_().getProperties() || {};
  return Object.keys(properties).filter(function (key) {
    return key.indexOf(prefix) === 0;
  }).map(function (key) {
    return fodeAuthorityJson_(properties[key], null);
  }).filter(function (record) {
    return !!record;
  });
}

function fodeWriteDurableReceipt_(domain, idempotencyKey, contextFingerprint, status, result, actor, auditEvent) {
  var record = {
    schemaVersion: "FODE_DURABLE_RECEIPT_V1",
    domain: fodeAuthorityUpper_(domain),
    idempotencyKey: fodeAuthorityClean_(idempotencyKey),
    contextFingerprint: contextFingerprint,
    status: fodeAuthorityUpper_(status),
    applicantId: fodeAuthorityClean_(result && result.applicantId || ""),
    recordedAt: new Date().toISOString(),
    recordedBy: fodeAuthorityClean_(actor && actor.email || ""),
    result: fodeSafeAuditValue_(result || {})
  };
  var serialized = JSON.stringify(record);
  if (serialized.length > FODE_AUTHORITY_STATE_MAX_BYTES) throw new Error("DURABLE_RECEIPT_TOO_LARGE");
  if (/"(?:secretPlain|portalUrl|token|secret)"\s*:/i.test(serialized)) throw new Error("DURABLE_RECEIPT_SECRET_FIELD_FORBIDDEN");
  var key = fodeDurableReceiptKey_(domain, idempotencyKey);
  var store = fodeAuthorityStateStore_();
  var before = store.getProperty(key);
  if (before == null) {
    var properties = store.getProperties() || {};
    var receiptCount = Object.keys(properties).filter(function (propertyKey) {
      return propertyKey.indexOf(FODE_DURABLE_RECEIPT_PREFIX + "::") === 0;
    }).length;
    if (receiptCount >= FODE_DURABLE_RECEIPT_MAX_RECORDS) throw new Error("DURABLE_RECEIPT_CAPACITY_REACHED");
  }
  store.setProperty(key, serialized);
  if (store.getProperty(key) !== serialized) throw new Error("DURABLE_RECEIPT_READBACK_FAILED");
  try {
    logAudit_(fodeAuthorityClean_(auditEvent || "FODE_DURABLE_RECEIPT_UPDATED"), {
      actor: record.recordedBy,
      actorRole: fodeAuthorityClean_(actor && actor.role || ""),
      applicantId: record.applicantId,
      domain: record.domain,
      status: record.status,
      at: record.recordedAt
    });
  } catch (auditError) {
    if (before == null) store.deleteProperty(key);
    else store.setProperty(key, before);
    throw new Error("DURABLE_RECEIPT_AUDIT_FAILED: " + String(auditError && auditError.message || auditError));
  }
  return record;
}

function fodeWriteAuthorityState_(domain, applicantId, state, auditEvent, actor) {
  var record = state && typeof state === "object" ? state : {};
  record.applicantId = fodeAuthorityClean_(applicantId);
  record.updatedAt = new Date().toISOString();
  record.updatedBy = fodeAuthorityClean_(actor && actor.email || "");
  record.updatedByRole = fodeAuthorityClean_(actor && actor.role || "");
  var serialized = JSON.stringify(record);
  if (serialized.length > FODE_AUTHORITY_STATE_MAX_BYTES) throw new Error("AUTHORITY_STATE_TOO_LARGE");
  if (/secretPlain|portalUrl|token/i.test(serialized)) throw new Error("AUTHORITY_STATE_SECRET_FIELD_FORBIDDEN");
  var key = fodeAuthorityStateKey_(domain, applicantId);
  var store = fodeAuthorityStateStore_();
  var before = store.getProperty(key);
  if (before == null) {
    var existing = store.getProperties() || {};
    var stateRecords = Object.keys(existing).filter(function (propertyKey) {
      return propertyKey.indexOf(FODE_AUTHORITY_STATE_PREFIX + "::") === 0;
    }).length;
    if (stateRecords >= FODE_AUTHORITY_STATE_MAX_RECORDS) throw new Error("AUTHORITY_STATE_CAPACITY_REACHED");
  }
  store.setProperty(key, serialized);
  if (store.getProperty(key) !== serialized) throw new Error("AUTHORITY_STATE_READBACK_FAILED");
  try {
    logAudit_(fodeAuthorityClean_(auditEvent || "FODE_AUTHORITY_STATE_UPDATED"), {
      actor: record.updatedBy,
      actorRole: record.updatedByRole,
      applicantId: record.applicantId,
      domain: fodeAuthorityUpper_(domain),
      state: fodeAuthorityClean_(record.state || record.status || ""),
      at: record.updatedAt
    });
  } catch (auditError) {
    if (before == null) store.deleteProperty(key);
    else store.setProperty(key, before);
    throw new Error("AUTHORITY_STATE_AUDIT_FAILED: " + String(auditError && auditError.message || auditError));
  }
  return record;
}

function fodeFraudTerminationFingerprint_(rowObj) {
  var documents = fodeRegistryDocumentAuthority_(rowObj);
  return fodeAuthorityFingerprint_({
    applicantId: fodeAuthorityClean_(rowObj && rowObj.ApplicantID || ""),
    fraudStatus: "CONFIRMED",
    documents: documents.statuses.map(function (item) {
      return { sourceField: item.sourceField, status: item.status };
    })
  });
}

function fodeEnsureFraudTerminationCaseLocked_(rowObj, actor, requestedState, forceConfirmed) {
  var row = rowObj || {};
  var applicantId = fodeAuthorityClean_(row.ApplicantID);
  if (!applicantId) throw new Error("FRAUD_TERMINATION_APPLICANT_REQUIRED");
  var documents = fodeRegistryDocumentAuthority_(row);
  if (forceConfirmed !== true && documents.fraudStatus !== "CONFIRMED") return null;
  var state = fodeAuthorityUpper_(requestedState || "PORTAL_ACCESS_TERMINATION_REQUIRED");
  if (["PENDING_FRAUD_CONFIRMATION", "PORTAL_ACCESS_TERMINATION_REQUIRED"].indexOf(state) < 0) {
    throw new Error("FRAUD_TERMINATION_STATE_INVALID");
  }
  var fingerprint = fodeFraudTerminationFingerprint_(row);
  var existing = fodeReadAuthorityState_("PORTAL_TERMINATION", applicantId);
  if (existing && existing.state === state && existing.fraudSourceFingerprint === fingerprint) return existing;
  var now = new Date().toISOString();
  return fodeWriteAuthorityState_("PORTAL_TERMINATION", applicantId, {
    state: state,
    fraudStatus: "CONFIRMED",
    fraudSourceFingerprint: fingerprint,
    createdAt: fodeAuthorityClean_(existing && existing.createdAt || now),
    createdBy: fodeAuthorityClean_(existing && existing.createdBy || actor && actor.email || ""),
    requiredAt: state === "PORTAL_ACCESS_TERMINATION_REQUIRED" ? now : fodeAuthorityClean_(existing && existing.requiredAt || ""),
    portalAccessMutationPerformed: false
  }, state === "PORTAL_ACCESS_TERMINATION_REQUIRED" ? "FODE_PORTAL_TERMINATION_REQUIRED" : "FODE_PORTAL_TERMINATION_PENDING", actor);
}

function fodeEnsureFraudTerminationCase_(rowObj, actor, requestedState, forceConfirmed) {
  return fodeWithAuthorityLock_(function () {
    return fodeEnsureFraudTerminationCaseLocked_(rowObj, actor, requestedState, forceConfirmed);
  });
}

function fodeExactApplicantRow_(applicantId) {
  var id = fodeAuthorityClean_(applicantId);
  if (!id) throw new Error("APPLICANT_ID_REQUIRED");
  var sheet = openDataSheet_();
  var rowNumber = findRowByApplicantId_(sheet, id);
  if (!(rowNumber >= 2)) throw new Error("APPLICANT_NOT_FOUND");
  var rowObj = getRowObject_(sheet, rowNumber);
  if (fodeAuthorityClean_(rowObj.ApplicantID) !== id) throw new Error("APPLICANT_BINDING_MISMATCH");
  return { applicantId: id, rowNumber: rowNumber, rowObj: rowObj, sheet: sheet };
}

function fodeRegistrySubjects_(rowObj) {
  if (typeof parseFodeSelectedSubjectsV2_ === "function") return parseFodeSelectedSubjectsV2_(rowObj || {});
  return fodeAuthorityUnique_(fodeAuthorityClean_(rowObj && (rowObj.Subjects_Selected_Canonical || rowObj.Subjects_Selected) || "").split(","));
}

function fodeRegistryGrade_(rowObj) {
  var row = rowObj || {};
  if (typeof getFodeGradeLevelDiagnostics_ === "function") {
    var diagnostics = getFodeGradeLevelDiagnostics_(row);
    return {
      grade: fodeAuthorityClean_(diagnostics.sourceValue || diagnostics.gradeLevelKey || ""),
      gradeCode: fodeAuthorityClean_(diagnostics.gradeCode || ""),
      sourceField: fodeAuthorityClean_(diagnostics.sourceField || "")
    };
  }
  var candidates = ["Grade_Applying_For", "Upgrade_Grade_Stream", "FODE_Level", "Grade"];
  for (var i = 0; i < candidates.length; i++) {
    if (fodeAuthorityClean_(row[candidates[i]])) {
      return { grade: fodeAuthorityClean_(row[candidates[i]]), gradeCode: "", sourceField: candidates[i] };
    }
  }
  return { grade: "", gradeCode: "", sourceField: "" };
}

function fodeRegistryGradeConflicts_(rowObj) {
  var row = rowObj || {};
  var codes = [];
  ["Grade_Applying_For", "Upgrade_Grade_Stream", "FODE_Level", "Grade"].forEach(function (field) {
    var value = fodeAuthorityClean_(row[field]);
    if (!value) return;
    var code = typeof extractFodeGradeCodeFromText_ === "function" ? extractFodeGradeCodeFromText_(value) : value.toUpperCase();
    if (code) codes.push(code);
  });
  return fodeAuthorityUnique_(codes).length > 1;
}

function fodeRegistryDocumentAuthority_(rowObj) {
  var row = rowObj || {};
  var definitions = CONFIG && Array.isArray(CONFIG.DOC_FIELDS) ? CONFIG.DOC_FIELDS : [];
  var statuses = definitions.map(function (definition) {
    return {
      sourceField: fodeAuthorityClean_(definition.file),
      required: definition.required === true,
      submitted: !!fodeAuthorityClean_(row[definition.file] || ""),
      status: fodeAuthorityUpper_(row[definition.status] || "PENDING_REVIEW")
    };
  });
  var fraudFields = ["Fraud_Status", "Document_Fraud_Status", "Confirmed_Fraud"];
  var fraudConfirmed = fraudFields.some(function (field) {
    return /^(CONFIRMED|FRAUDULENT|YES|TRUE)$/.test(fodeAuthorityUpper_(row[field]));
  }) || statuses.some(function (item) { return item.status === "FRAUDULENT"; });
  var required = statuses.filter(function (item) { return item.required; });
  var submitted = statuses.filter(function (item) { return item.submitted; });
  var uncheckedSubmittedDocuments = submitted.filter(function (item) { return item.status !== "VERIFIED"; }).map(function (item) { return item.sourceField; });
  var verified = required.length > 0 &&
    required.every(function (item) { return item.status === "VERIFIED"; }) &&
    uncheckedSubmittedDocuments.length === 0;
  var conflict = statuses.some(function (item) { return item.status === "REJECTED" || item.status === "FRAUDULENT"; });
  return {
    state: fraudConfirmed ? "FRAUD_CONFIRMED" : (verified ? "VERIFIED" : (conflict ? "CONFLICT" : "INCOMPLETE")),
    verified: verified,
    fraudStatus: fraudConfirmed ? "CONFIRMED" : "NOT_CONFIRMED",
    uncheckedSubmittedDocuments: uncheckedSubmittedDocuments,
    statuses: statuses
  };
}

function fodeRegistryFingerprintSource_(rowObj) {
  var grade = fodeRegistryGrade_(rowObj);
  var documents = fodeRegistryDocumentAuthority_(rowObj);
  return {
    grade: grade.grade,
    gradeCode: grade.gradeCode,
    subjects: fodeRegistrySubjects_(rowObj),
    documentState: documents.state,
    fraudStatus: documents.fraudStatus
  };
}

function resolveFodeRegistryAuthority_(rowObj, storedRecord) {
  var row = rowObj || {};
  var applicantId = fodeAuthorityClean_(row.ApplicantID);
  var grade = fodeRegistryGrade_(row);
  var subjects = fodeRegistrySubjects_(row);
  var documents = fodeRegistryDocumentAuthority_(row);
  var allowedSubjects = (CONFIG && Array.isArray(CONFIG.PORTAL_SUBJECTS) ? CONFIG.PORTAL_SUBJECTS : []).map(function (value) {
    return fodeAuthorityClean_(value).toLowerCase();
  });
  var unknownSubjects = subjects.filter(function (subject) {
    return allowedSubjects.length && allowedSubjects.indexOf(subject.toLowerCase()) < 0;
  });
  var conflicts = [];
  if (fodeRegistryGradeConflicts_(row)) conflicts.push("GRADE_CONFLICT");
  if (unknownSubjects.length) conflicts.push("SUBJECT_NOT_IN_APPROVED_CATALOGUE");
  var missing = [];
  if (!grade.grade) missing.push("CONFIRMED_GRADE");
  if (!subjects.length) missing.push("CONFIRMED_SUBJECTS");
  var fingerprint = fodeAuthorityFingerprint_(fodeRegistryFingerprintSource_(row));
  var stored = storedRecord && typeof storedRecord === "object" ? storedRecord : null;
  var confirmationMatches = !!(stored && stored.state === "CONFIRMED" && stored.sourceFingerprint === fingerprint);
  var state = conflicts.length ? "CONFLICT" : (missing.length ? "INCOMPLETE" : (confirmationMatches ? "CONFIRMED" : "UNCONFIRMED"));
  return {
    ok: true,
    readOnly: true,
    schemaVersion: FODE_REGISTRY_SCHEMA_VERSION,
    authoritySource: "FODE Registry Authority",
    applicantId: applicantId,
    state: state,
    confirmedGrade: grade.grade,
    gradeCode: grade.gradeCode,
    confirmedSubjects: subjects,
    subjectEvidence: {
      sourceField: subjects.length ? "Subjects_Selected_Canonical" : "",
      source: fodeAuthorityClean_(stored && stored.evidenceSource || ""),
      confirmedBy: confirmationMatches ? fodeAuthorityClean_(stored.confirmedBy || "") : "",
      confirmedAt: confirmationMatches ? fodeAuthorityClean_(stored.confirmedAt || "") : ""
    },
    documentVerification: documents,
    fraudStatus: documents.fraudStatus,
    missingRequirements: missing,
    conflicts: conflicts,
    unknownSubjects: unknownSubjects,
    sourceFingerprint: fingerprint
  };
}

function admin_getFodeRegistryApplicant(payload) {
  fodeAuthorityActor_("CAN_READ_REGISTRY");
  var context = fodeExactApplicantRow_(payload && payload.applicantId);
  return resolveFodeRegistryAuthority_(context.rowObj, fodeReadAuthorityState_("REGISTRY", context.applicantId));
}

function admin_getFodeRegistryWorklist(payload) {
  fodeAuthorityActor_("CAN_READ_REGISTRY");
  var snapshot = canonicalPopulationSnapshot_();
  var stateIndex = fodeAuthorityStateIndex_("REGISTRY");
  var rows = [];
  Object.keys(snapshot._internalSourceRowsByRowNumber || {}).forEach(function (rowNumber) {
    var rowObj = snapshot._internalSourceRowsByRowNumber[rowNumber];
    var applicantId = fodeAuthorityClean_(rowObj && rowObj.ApplicantID);
    if (!applicantId) return;
    rows.push(resolveFodeRegistryAuthority_(rowObj, stateIndex[applicantId] || null));
  });
  var requestedState = fodeAuthorityUpper_(payload && payload.state || "");
  if (requestedState) rows = rows.filter(function (row) { return row.state === requestedState; });
  var limit = Math.max(1, Math.min(200, Number(payload && payload.limit || 100)));
  var counts = {};
  rows.forEach(function (row) { counts[row.state] = Number(counts[row.state] || 0) + 1; });
  return {
    ok: true,
    readOnly: true,
    schemaVersion: "FODE_REGISTRY_WORKLIST_V1",
    total: rows.length,
    counts: counts,
    rows: rows.slice(0, limit)
  };
}

function fodeRegistryPreviewCacheKey_(previewId) {
  return "FODE_REGISTRY_PREVIEW_" + fodeAuthorityClean_(previewId).replace(/[^A-Za-z0-9_-]/g, "_");
}

function admin_previewFodeRegistryConfirmation(payload) {
  var actor = fodeAuthorityActor_("CAN_MANAGE_REGISTRY");
  var p = payload && typeof payload === "object" ? payload : {};
  var context = fodeExactApplicantRow_(p.applicantId);
  var current = resolveFodeRegistryAuthority_(context.rowObj, fodeReadAuthorityState_("REGISTRY", context.applicantId));
  var grade = fodeAuthorityClean_(p.grade);
  var subjects = fodeAuthorityUnique_(Array.isArray(p.subjects) ? p.subjects : fodeAuthorityClean_(p.subjects).split(","));
  var evidenceSource = fodeAuthorityClean_(p.evidenceSource);
  var idempotencyKey = fodeAuthorityClean_(p.idempotencyKey);
  if (!grade) throw new Error("CONFIRMED_GRADE_REQUIRED");
  if (!subjects.length) throw new Error("CONFIRMED_SUBJECTS_REQUIRED");
  if (!evidenceSource) throw new Error("SUBJECT_EVIDENCE_SOURCE_REQUIRED");
  if (!idempotencyKey) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  var allowed = (CONFIG.PORTAL_SUBJECTS || []).map(function (value) { return fodeAuthorityClean_(value).toLowerCase(); });
  var invalid = subjects.filter(function (subject) { return allowed.indexOf(subject.toLowerCase()) < 0; });
  if (invalid.length) throw new Error("SUBJECT_NOT_IN_APPROVED_CATALOGUE: " + invalid.join(", "));
  var previewId = "FODE-REGISTRY-" + Utilities.getUuid();
  var preview = {
    ok: true,
    schemaVersion: "FODE_REGISTRY_CONFIRMATION_PREVIEW_V1",
    previewId: previewId,
    applicantId: context.applicantId,
    actor: actor.email,
    actorRole: actor.role,
    state: "READY",
    sourceFingerprint: current.sourceFingerprint,
    proposedGrade: grade,
    proposedSubjects: subjects,
    evidenceSource: evidenceSource,
    idempotencyKey: idempotencyKey,
    documentVerification: current.documentVerification,
    fraudStatus: current.fraudStatus,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + FODE_REGISTRY_PREVIEW_TTL_SECONDS * 1000).toISOString()
  };
  CacheService.getUserCache().put(fodeRegistryPreviewCacheKey_(previewId), JSON.stringify(preview), FODE_REGISTRY_PREVIEW_TTL_SECONDS);
  return preview;
}

function admin_confirmFodeRegistry(payload) {
  var actor = fodeAuthorityActor_("CAN_MANAGE_REGISTRY");
  var p = payload && typeof payload === "object" ? payload : {};
  if (fodeAuthorityClean_(p.confirmation) !== "CONFIRM_REGISTRY_AUTHORITY") throw new Error("EXPLICIT_CONFIRMATION_REQUIRED");
  var raw = CacheService.getUserCache().get(fodeRegistryPreviewCacheKey_(p.previewId));
  if (!raw) throw new Error("PREVIEW_EXPIRED_OR_UNKNOWN");
  var preview = JSON.parse(raw);
  if (preview.actor !== actor.email) throw new Error("PREVIEW_ACTOR_MISMATCH");
  if (Date.parse(preview.expiresAt) <= Date.now()) throw new Error("PREVIEW_EXPIRED");
  var receiptFingerprint = fodeAuthorityFingerprint_({
    operation: "REGISTRY_CONFIRMATION",
    applicantId: preview.applicantId,
    grade: preview.proposedGrade,
    subjects: preview.proposedSubjects,
    evidenceSource: preview.evidenceSource
  });
  var prior = fodeReadAuthorityReceipt_(preview.idempotencyKey, receiptFingerprint);
  if (prior) return prior;
  return fodeWithAuthorityLock_(function () {
    fodeRevalidateMutationActor_(actor, "CAN_MANAGE_REGISTRY");
    var replay = fodeReadAuthorityReceipt_(preview.idempotencyKey, receiptFingerprint);
    if (replay) return replay;
    var context = fodeExactApplicantRow_(preview.applicantId);
    var current = resolveFodeRegistryAuthority_(context.rowObj, fodeReadAuthorityState_("REGISTRY", context.applicantId));
    if (current.sourceFingerprint !== preview.sourceFingerprint) throw new Error("REGISTRY_SOURCE_CHANGED");
    fodeEnsureFraudTerminationCaseLocked_(context.rowObj, actor, "PORTAL_ACCESS_TERMINATION_REQUIRED", false);
    applyPatch_(context.sheet, context.rowNumber, {
      Grade_Applying_For: preview.proposedGrade,
      Subjects_Selected_Canonical: preview.proposedSubjects.join(", ")
    });
    var refreshed = Object.assign({}, context.rowObj, {
      Grade_Applying_For: preview.proposedGrade,
      Subjects_Selected_Canonical: preview.proposedSubjects.join(", ")
    });
    var confirmedAt = new Date().toISOString();
    var state;
    try {
      state = fodeWriteAuthorityState_("REGISTRY", context.applicantId, {
        state: "CONFIRMED",
        confirmedGrade: preview.proposedGrade,
        confirmedSubjects: preview.proposedSubjects,
        evidenceSource: preview.evidenceSource,
        confirmedBy: actor.email,
        confirmedAt: confirmedAt,
        sourceFingerprint: fodeAuthorityFingerprint_(fodeRegistryFingerprintSource_(refreshed))
      }, "FODE_REGISTRY_CONFIRMED", actor);
    } catch (stateError) {
      applyPatch_(context.sheet, context.rowNumber, {
        Grade_Applying_For: context.rowObj.Grade_Applying_For || "",
        Subjects_Selected_Canonical: context.rowObj.Subjects_Selected_Canonical || ""
      });
      throw stateError;
    }
    return fodeWriteAuthorityReceipt_(
      preview.idempotencyKey,
      receiptFingerprint,
      resolveFodeRegistryAuthority_(refreshed, state)
    );
  });
}

function fodeNormalizeAssessmentIngestion_(value, confirmedSubjects) {
  var raw = value && typeof value === "object" ? value : {};
  var subjects = raw.subjects && typeof raw.subjects === "object" ? raw.subjects : raw;
  var canonical = Array.isArray(confirmedSubjects) ? confirmedSubjects : [];
  var keyed = {};
  Object.keys(subjects).forEach(function (subject) {
    keyed[fodeAuthorityClean_(subject).toLowerCase()] = subjects[subject];
  });
  var allowed = canonical.map(function (subject) { return fodeAuthorityClean_(subject).toLowerCase(); });
  var unknown = Object.keys(keyed).filter(function (subject) { return allowed.indexOf(subject) < 0; });
  if (unknown.length) throw new Error("ASSESSMENT_SUBJECT_NOT_REGISTERED: " + unknown.join(", "));
  var normalized = {};
  canonical.forEach(function (subject) {
    var entry = keyed[fodeAuthorityClean_(subject).toLowerCase()];
    var scores = Array.isArray(entry) ? entry : (entry && Array.isArray(entry.scores) ? entry.scores : null);
    if (!scores || scores.length !== FODE_EXAM_POLICY.assessmentsPerSubject) {
      throw new Error("SIX_ASSESSMENTS_REQUIRED: " + subject);
    }
    normalized[subject] = scores.map(function (score, index) {
      var number = Number(score);
      if (!isFinite(number) || number < 0 || number > 100) {
        throw new Error("ASSESSMENT_SCORE_INVALID: " + subject + " assessment " + String(index + 1));
      }
      return number;
    });
  });
  return { subjects: normalized };
}

function fodeNormalizeAttemptIngestion_(value) {
  var raw = Array.isArray(value) ? value : (value && Array.isArray(value.attempts) ? value.attempts : null);
  if (!raw) throw new Error("EXAM_ATTEMPTS_ARRAY_REQUIRED");
  var seen = {};
  return raw.map(function (entry, index) {
    var date = new Date(entry && typeof entry === "object" ? entry.at : entry);
    if (isNaN(date.getTime())) throw new Error("EXAM_ATTEMPT_DATE_INVALID: " + String(index + 1));
    var iso = date.toISOString();
    if (seen[iso]) throw new Error("EXAM_ATTEMPT_DUPLICATE: " + iso);
    seen[iso] = true;
    return iso;
  }).sort();
}

function fodeNormalizeTimelineIngestion_(value) {
  var raw = value && typeof value === "object" ? value : {};
  if (raw.configured !== true) throw new Error("EXAM_WINDOW_CONFIGURATION_REQUIRED");
  if (typeof raw.satisfied !== "boolean") throw new Error("EXAM_TIMELINE_SATISFIED_REQUIRED");
  if (typeof raw.missedDeadline !== "boolean") throw new Error("EXAM_MISSED_DEADLINE_FLAG_REQUIRED");
  var nextExamWindow = fodeAuthorityClean_(raw.nextExamWindow);
  var windowReference = fodeAuthorityClean_(raw.windowReference || raw.examWindowReference);
  if (!nextExamWindow) throw new Error("NEXT_EXAM_WINDOW_REQUIRED");
  if (!windowReference) throw new Error("EXAM_WINDOW_REFERENCE_REQUIRED");
  return {
    configured: true,
    satisfied: raw.satisfied,
    missedDeadline: raw.missedDeadline,
    nextExamWindow: nextExamWindow,
    windowReference: windowReference
  };
}

function fodeAcademicEvidencePreviewCacheKey_(previewId) {
  return "FODE_ACADEMIC_EVIDENCE_PREVIEW_" + fodeAuthorityClean_(previewId).replace(/[^A-Za-z0-9_-]/g, "_");
}

function admin_previewFodeAcademicEvidenceIngestion(payload) {
  var actor = fodeAuthorityActor_("CAN_MANAGE_REGISTRY");
  var p = payload && typeof payload === "object" ? payload : {};
  var context = fodeExactApplicantRow_(p.applicantId);
  var registry = resolveFodeRegistryAuthority_(context.rowObj, fodeReadAuthorityState_("REGISTRY", context.applicantId));
  if (registry.state !== "CONFIRMED") throw new Error("REGISTRY_CONFIRMATION_REQUIRED");
  var evidenceType = fodeAuthorityUpper_(p.evidenceType);
  var normalized;
  if (evidenceType === "ASSESSMENT_RESULTS") normalized = fodeNormalizeAssessmentIngestion_(p.value || p.assessments, registry.confirmedSubjects);
  else if (evidenceType === "EXAM_ATTEMPTS") normalized = fodeNormalizeAttemptIngestion_(p.value || p.attempts);
  else if (evidenceType === "EXAM_TIMELINE") normalized = fodeNormalizeTimelineIngestion_(p.value || p.timeline);
  else throw new Error("ACADEMIC_EVIDENCE_TYPE_INVALID");
  var evidenceSource = fodeAuthorityClean_(p.evidenceSource);
  var idempotencyKey = fodeAuthorityClean_(p.idempotencyKey);
  if (!evidenceSource) throw new Error("ACADEMIC_EVIDENCE_SOURCE_REQUIRED");
  if (!idempotencyKey) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  var current = fodeReadAuthorityState_("ACADEMIC_EVIDENCE", context.applicantId) || {};
  var preview = {
    ok: true,
    schemaVersion: "FODE_ACADEMIC_EVIDENCE_PREVIEW_V1",
    previewId: "FODE-ACADEMIC-EVIDENCE-" + Utilities.getUuid(),
    applicantId: context.applicantId,
    actor: actor.email,
    actorRole: actor.role,
    evidenceType: evidenceType,
    normalizedValue: normalized,
    evidenceSource: evidenceSource,
    idempotencyKey: idempotencyKey,
    sourceFingerprint: fodeAuthorityFingerprint_({
      registry: registry.sourceFingerprint,
      currentEvidence: current
    }),
    state: "READY",
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + FODE_REGISTRY_PREVIEW_TTL_SECONDS * 1000).toISOString()
  };
  CacheService.getUserCache().put(fodeAcademicEvidencePreviewCacheKey_(preview.previewId), JSON.stringify(preview), FODE_REGISTRY_PREVIEW_TTL_SECONDS);
  return preview;
}

function admin_confirmFodeAcademicEvidenceIngestion(payload) {
  var actor = fodeAuthorityActor_("CAN_MANAGE_REGISTRY");
  var p = payload && typeof payload === "object" ? payload : {};
  if (fodeAuthorityClean_(p.confirmation) !== "CONFIRM_ACADEMIC_EVIDENCE") throw new Error("EXPLICIT_CONFIRMATION_REQUIRED");
  var raw = CacheService.getUserCache().get(fodeAcademicEvidencePreviewCacheKey_(p.previewId));
  if (!raw) throw new Error("PREVIEW_EXPIRED_OR_UNKNOWN");
  var preview = JSON.parse(raw);
  if (preview.actor !== actor.email) throw new Error("PREVIEW_ACTOR_MISMATCH");
  if (Date.parse(preview.expiresAt) <= Date.now()) throw new Error("PREVIEW_EXPIRED");
  var receiptFingerprint = fodeAuthorityFingerprint_({
    operation: "ACADEMIC_EVIDENCE_INGESTION",
    applicantId: preview.applicantId,
    evidenceType: preview.evidenceType,
    normalizedValue: preview.normalizedValue,
    evidenceSource: preview.evidenceSource
  });
  var prior = fodeReadAuthorityReceipt_(preview.idempotencyKey, receiptFingerprint);
  if (prior) return prior;
  return fodeWithAuthorityLock_(function () {
    fodeRevalidateMutationActor_(actor, "CAN_MANAGE_REGISTRY");
    var replay = fodeReadAuthorityReceipt_(preview.idempotencyKey, receiptFingerprint);
    if (replay) return replay;
    var context = fodeExactApplicantRow_(preview.applicantId);
    var registry = resolveFodeRegistryAuthority_(context.rowObj, fodeReadAuthorityState_("REGISTRY", context.applicantId));
    var current = fodeReadAuthorityState_("ACADEMIC_EVIDENCE", context.applicantId) || {};
    var sourceFingerprint = fodeAuthorityFingerprint_({ registry: registry.sourceFingerprint, currentEvidence: current });
    if (sourceFingerprint !== preview.sourceFingerprint) throw new Error("ACADEMIC_EVIDENCE_AUTHORITY_CHANGED");
    if (registry.state !== "CONFIRMED") throw new Error("REGISTRY_CONFIRMATION_REQUIRED");
    var now = new Date().toISOString();
    var record = {
      schemaVersion: FODE_ACADEMIC_EVIDENCE_SCHEMA_VERSION,
      state: "CONFIRMED",
      assessments: current.assessments || null,
      attempts: current.attempts || null,
      timeline: current.timeline || null
    };
    var evidenceRecord = {
      value: preview.normalizedValue,
      evidenceSource: preview.evidenceSource,
      confirmedBy: actor.email,
      confirmedAt: now
    };
    if (preview.evidenceType === "ASSESSMENT_RESULTS") record.assessments = evidenceRecord;
    else if (preview.evidenceType === "EXAM_ATTEMPTS") record.attempts = evidenceRecord;
    else record.timeline = evidenceRecord;
    var stored = fodeWriteAuthorityState_(
      "ACADEMIC_EVIDENCE",
      context.applicantId,
      record,
      "FODE_ACADEMIC_EVIDENCE_CONFIRMED",
      actor
    );
    return fodeWriteAuthorityReceipt_(preview.idempotencyKey, receiptFingerprint, {
      ok: true,
      schemaVersion: FODE_ACADEMIC_EVIDENCE_SCHEMA_VERSION,
      applicantId: context.applicantId,
      evidenceType: preview.evidenceType,
      evidenceSource: preview.evidenceSource,
      confirmedBy: actor.email,
      confirmedAt: now,
      state: stored.state
    });
  });
}

function fodeAssessmentEvidenceFromRow_(rowObj, storedEvidence) {
  var row = rowObj || {};
  var stored = storedEvidence && storedEvidence.assessments;
  if (stored && stored.value && stored.value.subjects &&
      fodeAuthorityClean_(stored.evidenceSource) &&
      fodeAuthorityClean_(stored.confirmedBy) &&
      fodeAuthorityClean_(stored.confirmedAt)) {
    return {
      available: true,
      sourceField: FODE_ACADEMIC_EVIDENCE_SCHEMA_VERSION,
      evidenceSource: fodeAuthorityClean_(stored.evidenceSource || ""),
      confirmedBy: fodeAuthorityClean_(stored.confirmedBy || ""),
      confirmedAt: fodeAuthorityClean_(stored.confirmedAt || ""),
      value: stored.value
    };
  }
  var fields = ["FODE_Assessment_Evidence_JSON", "Assessment_Evidence_JSON", "Assessment_Results_JSON"];
  for (var i = 0; i < fields.length; i++) {
    var parsed = fodeAuthorityJson_(row[fields[i]], null);
    if (parsed) {
      return {
        available: false,
        sourceField: fields[i],
        evidenceSource: "Legacy row evidence",
        value: null,
        legacyEvidencePresent: true,
        reasonCode: "ASSESSMENT_EVIDENCE_INGESTION_REQUIRED"
      };
    }
  }
  return { available: false, sourceField: "", evidenceSource: "", value: null, reasonCode: "ASSESSMENT_EVIDENCE_MISSING" };
}

function fodeTimelineEvidenceFromRow_(rowObj, storedEvidence) {
  var row = rowObj || {};
  var stored = storedEvidence && storedEvidence.timeline;
  if (stored && stored.value && stored.value.configured === true &&
      fodeAuthorityClean_(stored.evidenceSource) &&
      fodeAuthorityClean_(stored.confirmedBy) &&
      fodeAuthorityClean_(stored.confirmedAt)) {
    return Object.assign({
      available: true,
      sourceField: FODE_ACADEMIC_EVIDENCE_SCHEMA_VERSION,
      evidenceSource: fodeAuthorityClean_(stored.evidenceSource || ""),
      confirmedBy: fodeAuthorityClean_(stored.confirmedBy || ""),
      confirmedAt: fodeAuthorityClean_(stored.confirmedAt || "")
    }, stored.value);
  }
  var parsed = fodeAuthorityJson_(row.FODE_Exam_Timeline_JSON || row.Exam_Timeline_JSON, null);
  return parsed ? {
    available: false,
    configured: false,
    sourceField: row.FODE_Exam_Timeline_JSON ? "FODE_Exam_Timeline_JSON" : "Exam_Timeline_JSON",
    evidenceSource: "Legacy row evidence",
    legacyEvidencePresent: true,
    reasonCode: "EXAM_TIMELINE_INGESTION_REQUIRED"
  } : { available: false, configured: false, reasonCode: "EXAM_TIMELINE_EVIDENCE_MISSING" };
}

function fodeAttemptEvidenceFromRow_(rowObj, storedEvidence) {
  var row = rowObj || {};
  var stored = storedEvidence && storedEvidence.attempts;
  if (stored && Array.isArray(stored.value) &&
      fodeAuthorityClean_(stored.evidenceSource) &&
      fodeAuthorityClean_(stored.confirmedBy) &&
      fodeAuthorityClean_(stored.confirmedAt)) {
    return {
      available: true,
      sourceField: FODE_ACADEMIC_EVIDENCE_SCHEMA_VERSION,
      evidenceSource: fodeAuthorityClean_(stored.evidenceSource || ""),
      confirmedBy: fodeAuthorityClean_(stored.confirmedBy || ""),
      confirmedAt: fodeAuthorityClean_(stored.confirmedAt || ""),
      value: stored.value
    };
  }
  var fields = ["FODE_Exam_Attempts_JSON", "Exam_Attempts_JSON"];
  for (var i = 0; i < fields.length; i++) {
    var raw = fodeAuthorityClean_(row[fields[i]]);
    if (!raw) continue;
    var parsed = fodeAuthorityJson_(raw, null);
    if (Array.isArray(parsed) || (parsed && Array.isArray(parsed.attempts))) {
      return {
        available: false,
        sourceField: fields[i],
        value: null,
        legacyEvidencePresent: true,
        reasonCode: "ATTEMPT_EVIDENCE_INGESTION_REQUIRED"
      };
    }
    return { available: false, sourceField: fields[i], value: null, reasonCode: "ATTEMPT_EVIDENCE_MALFORMED" };
  }
  return { available: false, sourceField: "", value: null, reasonCode: "ATTEMPT_EVIDENCE_MISSING" };
}

function resolveFodeExamEligibility_(registry, assessmentEvidence, timelineEvidence, attemptEvidence, nowValue) {
  var reg = registry && typeof registry === "object" ? registry : {};
  var assessments = assessmentEvidence && typeof assessmentEvidence === "object" ? assessmentEvidence : { available: false, value: null };
  var timeline = timelineEvidence && typeof timelineEvidence === "object" ? timelineEvidence : { configured: false };
  var attemptAuthority = attemptEvidence && typeof attemptEvidence === "object" && !Array.isArray(attemptEvidence)
    ? attemptEvidence
    : { available: false, sourceField: "", value: null, reasonCode: "ATTEMPT_EVIDENCE_UNCONFIRMED" };
  var assessmentAuthorityConfirmed = assessments.available === true &&
    assessments.sourceField === FODE_ACADEMIC_EVIDENCE_SCHEMA_VERSION &&
    !!fodeAuthorityClean_(assessments.evidenceSource) &&
    !!fodeAuthorityClean_(assessments.confirmedBy) &&
    !!fodeAuthorityClean_(assessments.confirmedAt);
  var attemptAuthorityConfirmed = attemptAuthority.available === true &&
    attemptAuthority.sourceField === FODE_ACADEMIC_EVIDENCE_SCHEMA_VERSION &&
    !!fodeAuthorityClean_(attemptAuthority.evidenceSource) &&
    !!fodeAuthorityClean_(attemptAuthority.confirmedBy) &&
    !!fodeAuthorityClean_(attemptAuthority.confirmedAt);
  var timelineAuthorityConfirmed = timeline.available === true &&
    timeline.sourceField === FODE_ACADEMIC_EVIDENCE_SCHEMA_VERSION &&
    !!fodeAuthorityClean_(timeline.evidenceSource) &&
    !!fodeAuthorityClean_(timeline.confirmedBy) &&
    !!fodeAuthorityClean_(timeline.confirmedAt) &&
    timeline.configured === true &&
    typeof timeline.satisfied === "boolean" &&
    typeof timeline.missedDeadline === "boolean" &&
    !!fodeAuthorityClean_(timeline.nextExamWindow) &&
    !!fodeAuthorityClean_(timeline.windowReference);
  var attempts = attemptAuthority.available === true && Array.isArray(attemptAuthority.value) ? attemptAuthority.value : [];
  var now = nowValue instanceof Date ? nowValue : new Date(nowValue || Date.now());
  var reasons = [];
  var missing = [];
  var result = "ELIGIBLE";
  if (reg.fraudStatus === "CONFIRMED") {
    result = "NOT_ELIGIBLE";
    reasons.push("CONFIRMED_DOCUMENT_FRAUD");
  } else if (reg.state !== "CONFIRMED") {
    result = "REVIEW_REQUIRED";
    reasons.push("REGISTRY_" + fodeAuthorityUpper_(reg.state || "UNAVAILABLE"));
    missing = missing.concat(reg.missingRequirements || []);
  } else if (!reg.documentVerification || reg.documentVerification.verified !== true) {
    result = "REVIEW_REQUIRED";
    reasons.push("DOCUMENT_VERIFICATION_" + fodeAuthorityUpper_(reg.documentVerification && reg.documentVerification.state || "INCOMPLETE"));
    missing.push("VERIFIED_SUBMITTED_DOCUMENTS");
  }
  var subjectResults = assessments.value && typeof assessments.value === "object"
    ? (assessments.value.subjects && typeof assessments.value.subjects === "object" ? assessments.value.subjects : assessments.value)
    : {};
  var normalizedResults = {};
  Object.keys(subjectResults || {}).forEach(function (subject) {
    var entry = subjectResults[subject];
    normalizedResults[fodeAuthorityClean_(subject).toLowerCase()] = Array.isArray(entry) ? entry : (entry && Array.isArray(entry.scores) ? entry.scores : []);
  });
  var failedAssessments = [];
  if (result !== "NOT_ELIGIBLE") {
    if (!assessmentAuthorityConfirmed) {
      result = "REVIEW_REQUIRED";
      reasons.push(fodeAuthorityClean_(assessments.reasonCode || "ASSESSMENT_EVIDENCE_UNCONFIRMED"));
      missing.push("SIX_ASSESSMENTS_PER_CONFIRMED_SUBJECT");
    } else {
      (reg.confirmedSubjects || []).forEach(function (subject) {
        var scores = normalizedResults[fodeAuthorityClean_(subject).toLowerCase()] || [];
        if (scores.length !== FODE_EXAM_POLICY.assessmentsPerSubject) {
          missing.push(subject + ":SIX_ASSESSMENTS_REQUIRED");
          return;
        }
        scores.forEach(function (score, index) {
          var numeric = Number(score);
          if (!isFinite(numeric)) missing.push(subject + ":ASSESSMENT_" + String(index + 1) + "_INVALID");
          else if (numeric < FODE_EXAM_POLICY.minimumScore) failedAssessments.push({ subject: subject, assessment: index + 1, score: numeric });
        });
      });
      if (missing.length) {
        result = "REVIEW_REQUIRED";
        reasons.push("ASSESSMENT_EVIDENCE_INCOMPLETE");
      } else if (failedAssessments.length) {
        result = "NOT_ELIGIBLE";
        reasons.push("ASSESSMENT_BELOW_70");
      }
    }
  }
  var attemptCutoff = new Date(now.getTime());
  attemptCutoff.setUTCFullYear(attemptCutoff.getUTCFullYear() - FODE_EXAM_POLICY.attemptWindowYears);
  var invalidAttempts = [];
  var attemptsInWindow = 0;
  if (result !== "NOT_ELIGIBLE") {
    if (!attemptAuthorityConfirmed) {
      result = "REVIEW_REQUIRED";
      reasons.push(fodeAuthorityClean_(attemptAuthority.reasonCode || "ATTEMPT_EVIDENCE_UNCONFIRMED"));
      missing.push("VERIFIED_EXAM_ATTEMPT_HISTORY");
    } else {
      attempts.forEach(function (entry, index) {
        var raw = entry && typeof entry === "object" ? entry.at : entry;
        var date = new Date(raw);
        if (isNaN(date.getTime())) {
          invalidAttempts.push(index + 1);
          return;
        }
        if (date >= attemptCutoff && date <= now) attemptsInWindow++;
      });
      if (invalidAttempts.length) {
        result = "REVIEW_REQUIRED";
        reasons.push("ATTEMPT_EVIDENCE_INVALID");
        missing.push("VALID_EXAM_ATTEMPT_DATES");
      }
    }
  }
  if (result === "ELIGIBLE" && attemptsInWindow >= FODE_EXAM_POLICY.maximumAttempts) {
    result = "NOT_ELIGIBLE";
    reasons.push("MAXIMUM_ATTEMPTS_WITHIN_TWO_YEARS_REACHED");
  }
  if (result === "ELIGIBLE" && !timelineAuthorityConfirmed) {
    result = "POLICY_REQUIRED";
    reasons.push(fodeAuthorityClean_(timeline.reasonCode || "INSTITUTIONAL_TIMELINE_OR_EXAM_WINDOW_NOT_CONFIGURED"));
  } else if (result === "ELIGIBLE" && (timeline.missedDeadline === true || timeline.satisfied === false)) {
    result = "REVIEW_REQUIRED";
    reasons.push("DEFERRED_TO_NEXT_EXAM_WINDOW");
  }
  return {
    ok: true,
    readOnly: true,
    schemaVersion: FODE_EXAM_ELIGIBILITY_SCHEMA_VERSION,
    authoritySource: "FODE Exam Eligibility Policy 2026",
    state: result,
    reasons: fodeAuthorityUnique_(reasons),
    missingRequirements: fodeAuthorityUnique_(missing),
    failedAssessments: failedAssessments,
    policy: {
      assessmentsPerSubject: 6,
      minimumScoreEach: 70,
      averagingAllowed: false,
      maximumAttempts: 4,
      attemptWindowYears: 2,
      missedDeadlineEffect: "DEFER_TO_NEXT_EXAM_WINDOW"
    },
    evidence: {
      registryState: fodeAuthorityClean_(reg.state || ""),
      assessmentSource: fodeAuthorityClean_(assessments.sourceField || ""),
      attemptSource: fodeAuthorityClean_(attemptAuthority.sourceField || ""),
      attemptEvidenceAvailable: attemptAuthority.available === true,
      invalidAttemptEntries: invalidAttempts,
      timelineConfigured: timeline.configured === true,
      nextExamWindow: fodeAuthorityClean_(timeline.nextExamWindow || ""),
      attemptsInTwoYears: attemptsInWindow
    }
  };
}

function admin_getFodeExamEligibility(payload) {
  fodeAuthorityActor_("CAN_REVIEW_EXAM_ELIGIBILITY");
  var context = fodeExactApplicantRow_(payload && payload.applicantId);
  var registry = resolveFodeRegistryAuthority_(context.rowObj, fodeReadAuthorityState_("REGISTRY", context.applicantId));
  var academicEvidence = fodeReadAuthorityState_("ACADEMIC_EVIDENCE", context.applicantId);
  var result = resolveFodeExamEligibility_(
    registry,
    fodeAssessmentEvidenceFromRow_(context.rowObj, academicEvidence),
    fodeTimelineEvidenceFromRow_(context.rowObj, academicEvidence),
    fodeAttemptEvidenceFromRow_(context.rowObj, academicEvidence),
    new Date()
  );
  result.applicantId = context.applicantId;
  return result;
}

function admin_getFodeAcademicAuthorityOverview(payload) {
  var actor = fodeAuthorityAnyActor_(["CAN_READ_REGISTRY", "CAN_REVIEW_EXAM_ELIGIBILITY"]);
  var includeRegistry = adminHasCapability_(actor.email, "CAN_READ_REGISTRY");
  var includeExamEligibility = adminHasCapability_(actor.email, "CAN_REVIEW_EXAM_ELIGIBILITY");
  var snapshot = canonicalPopulationSnapshot_();
  var stateIndex = fodeAuthorityStateIndex_("REGISTRY");
  var evidenceIndex = fodeAuthorityStateIndex_("ACADEMIC_EVIDENCE");
  var registryCounts = {};
  var examCounts = {};
  Object.keys(snapshot._internalSourceRowsByRowNumber || {}).forEach(function (rowNumber) {
    var rowObj = snapshot._internalSourceRowsByRowNumber[rowNumber];
    var applicantId = fodeAuthorityClean_(rowObj && rowObj.ApplicantID);
    if (!applicantId) return;
    var registry = resolveFodeRegistryAuthority_(rowObj, stateIndex[applicantId] || null);
    var academicEvidence = evidenceIndex[applicantId] || null;
    var exam = resolveFodeExamEligibility_(
      registry,
      fodeAssessmentEvidenceFromRow_(rowObj, academicEvidence),
      fodeTimelineEvidenceFromRow_(rowObj, academicEvidence),
      fodeAttemptEvidenceFromRow_(rowObj, academicEvidence),
      new Date()
    );
    if (includeRegistry) registryCounts[registry.state] = Number(registryCounts[registry.state] || 0) + 1;
    if (includeExamEligibility) examCounts[exam.state] = Number(examCounts[exam.state] || 0) + 1;
  });
  var out = {
    ok: true,
    readOnly: true,
    schemaVersion: "FODE_ACADEMIC_AUTHORITY_OVERVIEW_V1",
    population: snapshot.totalRows,
    policy: FODE_EXAM_POLICY
  };
  if (includeRegistry) out.registry = registryCounts;
  if (includeExamEligibility) out.examEligibility = examCounts;
  return out;
}
