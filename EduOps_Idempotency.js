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

function eduopsIdempotencyContext_(preview) {
  var request = preview && preview.request || {};
  return eduopsCanonicalJson_({
    operation: preview && preview.operation || "",
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

function eduopsReadIdempotentReceipt_(key, contextFingerprint) {
  var cached = eduopsIdempotencyCache_().get(eduopsIdempotencyKey_(key));
  if (!cached) return null;
  try {
    var stored = JSON.parse(cached);
    if (stored && stored.contextFingerprint) {
      if (contextFingerprint && stored.contextFingerprint !== contextFingerprint) throw new Error("IDEMPOTENCY_CONTEXT_CONFLICT");
      return stored.receipt || null;
    }
    return stored;
  } catch (err) {
    if (String(err && err.message || err) === "IDEMPOTENCY_CONTEXT_CONFLICT") throw err;
    return null;
  }
}

function eduopsStoreIdempotentReceipt_(key, receipt, contextFingerprint) {
  eduopsIdempotencyCache_().put(eduopsIdempotencyKey_(key), JSON.stringify({ contextFingerprint: contextFingerprint || "", receipt: receipt || {} }), 21600);
  return receipt;
}
