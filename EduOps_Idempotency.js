function eduopsIdempotencyCache_() {
  return CacheService.getUserCache();
}

function eduopsIdempotencyKey_(value) {
  var raw = eduopsClean_(value || "");
  if (!raw) throw new Error("IDEMPOTENCY_KEY_REQUIRED");
  try {
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
    return "EDUOPS_IDEMPOTENCY_" + Utilities.base64EncodeWebSafe(digest).slice(0, 32);
  } catch (_err) {
    return "EDUOPS_IDEMPOTENCY_" + raw.replace(/[^A-Za-z0-9]/g, "_").slice(0, 80);
  }
}

function eduopsCanonicalJson_(value) {
  if (value === null || value === undefined) return "null";
  if (Array.isArray(value)) return "[" + value.map(eduopsCanonicalJson_).join(",") + "]";
  if (typeof value === "object") {
    return "{" + Object.keys(value).sort().map(function (key) {
      return JSON.stringify(key) + ":" + eduopsCanonicalJson_(value[key]);
    }).join(",") + "}";
  }
  return JSON.stringify(value);
}

function eduopsHashCanonicalValue_(value, prefix) {
  var raw = typeof value === "string" ? value : eduopsCanonicalJson_(value);
  var label = eduopsClean_(prefix || "EDUOPS-FINGERPRINT") || "EDUOPS-FINGERPRINT";
  try {
    var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, raw, Utilities.Charset.UTF_8);
    return label + "-" + Utilities.base64EncodeWebSafe(digest).replace(/=+$/g, "").slice(0, 43);
  } catch (_err) {
    return label + "-" + raw.replace(/[^A-Za-z0-9]/g, "_").slice(0, 80);
  }
}

function eduopsStateFingerprint_(preview) {
  var request = preview && preview.request || {};
  return eduopsHashCanonicalValue_({
    operation: preview && (preview.commandType || preview.operation) || "",
    messageType: preview && preview.messageType || "",
    product: preview && preview.product || "",
    snapshotId: preview && preview.snapshotId || "",
    queryFingerprint: preview && preview.queryFingerprint || "",
    applicantId: preview && preview.applicantId || "",
    selectedApplicantIds: preview && preview.selectedApplicantIds || [],
    document: request.document || null,
    draft: request.draft || null,
    approvalId: request.approvalId || ""
  }, "EDUOPS-STATE");
}

function eduopsIdempotencyContext_(preview) {
  var request = preview && preview.request || {};
  return eduopsCanonicalJson_({
    operationId: preview && preview.operationId || "",
    previewId: preview && preview.previewId || "",
    receiptId: preview && preview.receiptId || "",
    operation: preview && (preview.commandType || preview.operation) || "",
    commandType: preview && (preview.commandType || preview.operation) || "",
    messageType: preview && preview.messageType || "",
    actor: preview && preview.actor || "",
    stateFingerprint: preview && preview.stateFingerprint || "",
    cooldownCycle: preview && preview.cooldownCycle || "",
    idempotencyKey: preview && preview.idempotencyKey || "",
    product: preview && preview.product || "",
    snapshotId: preview && preview.snapshotId || "",
    queryFingerprint: preview && preview.queryFingerprint || "",
    applicantId: preview && preview.applicantId || "",
    selectedApplicantIds: preview && preview.selectedApplicantIds || [],
    document: request.document || null,
    draft: request.draft || null,
    approvalId: request.approvalId || ""
  });
}

function eduopsIdempotencyIdentity_(value) {
  var source = value && typeof value === "object" ? value : {};
  return {
    operationId: eduopsClean_(source.operationId || ""),
    previewId: eduopsClean_(source.previewId || ""),
    receiptId: eduopsClean_(source.receiptId || ""),
    stateFingerprint: eduopsClean_(source.stateFingerprint || ""),
    cooldownCycle: eduopsClean_(source.cooldownCycle || ""),
    idempotencyKey: eduopsClean_(source.idempotencyKey || "")
  };
}

function eduopsIdempotencyIdentityMatches_(left, right) {
  var a = eduopsIdempotencyIdentity_(left);
  var b = eduopsIdempotencyIdentity_(right);
  return ["operationId", "previewId", "receiptId", "stateFingerprint", "cooldownCycle", "idempotencyKey"].every(function (field) {
    return !a[field] || !b[field] || a[field] === b[field];
  });
}

function eduopsReplayReceipt_(receipt) {
  var replay = receipt && typeof receipt === "object"
    ? JSON.parse(JSON.stringify(receipt))
    : {};
  replay.idempotentReplay = true;
  replay.replayOutcome = "IDEMPOTENT_REPLAY";
  replay.idempotencyAuthority = "TRANSIENT_USER_CACHE";
  replay.idempotencyDurability = "TRANSIENT_CACHE_ONLY";
  replay.durableIdempotency = false;
  return replay;
}

function eduopsReadIdempotentReceipt_(key, contextFingerprint, options) {
  var cached = eduopsIdempotencyCache_().get(eduopsIdempotencyKey_(key));
  if (!cached) return null;
  try {
    var stored = JSON.parse(cached);
    if (stored && stored.contextFingerprint) {
      if (contextFingerprint && stored.contextFingerprint !== contextFingerprint) throw new Error("IDEMPOTENCY_CONTEXT_CONFLICT");
      if (stored.identity && stored.receipt && !eduopsIdempotencyIdentityMatches_(stored.identity, stored.receipt)) {
        throw new Error("IDEMPOTENCY_IDENTITY_CONFLICT");
      }
      if (!stored.receipt) return null;
      return options && options.markReplay === true
        ? eduopsReplayReceipt_(stored.receipt)
        : stored.receipt;
    }
    return options && options.markReplay === true ? eduopsReplayReceipt_(stored) : stored;
  } catch (err) {
    if (/^IDEMPOTENCY_(?:CONTEXT|IDENTITY)_CONFLICT$/.test(String(err && err.message || err))) throw err;
    return null;
  }
}

function eduopsStoreIdempotentReceipt_(key, receipt, contextFingerprint) {
  var value = receipt && typeof receipt === "object" ? receipt : {};
  eduopsIdempotencyCache_().put(eduopsIdempotencyKey_(key), JSON.stringify({
    contextFingerprint: contextFingerprint || "",
    identity: eduopsIdempotencyIdentity_(value),
    receipt: value,
    authority: "TRANSIENT_USER_CACHE",
    durability: "TRANSIENT_CACHE_ONLY",
    durableIdempotency: false
  }), 21600);
  return receipt;
}
