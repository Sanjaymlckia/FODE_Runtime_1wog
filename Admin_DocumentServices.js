// Document services helpers shared by Admin document gallery, manifest, file-action, rendition, and backfill flows.
// Extracted in F4J using the F4I Apps Script global-scope module pattern.

function adminDocumentManifestTypeForField_(fieldName) {
  var map = {
    Birth_ID_Passport_File: "birth_id",
    Latest_School_Report_File: "school_report",
    Transfer_Certificate_File: "transfer_certificate",
    Passport_Photo_File: "passport_photo",
    Fee_Receipt_File: "payment_receipt"
  };
  return map[clean_(fieldName || "")] || "unknown";
}

function adminDocumentManifestExtension_(fileName) {
  var match = clean_(fileName || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

function adminDocumentManifestMimeExtensionMismatch_(fileName, mimeType) {
  var ext = adminDocumentManifestExtension_(fileName);
  var mime = clean_(mimeType || "").toLowerCase();
  if (!ext || !mime) return false;
  var expected = {
    pdf: ["application/pdf"],
    jpg: ["image/jpeg"],
    jpeg: ["image/jpeg"],
    png: ["image/png"],
    gif: ["image/gif"],
    webp: ["image/webp"],
    doc: ["application/msword"],
    docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"]
  };
  return !!expected[ext] && expected[ext].indexOf(mime) < 0;
}

function adminDocumentManifestIso_(value) {
  if (!value) return "";
  var date = value instanceof Date ? value : new Date(value);
  return isNaN(date.getTime()) ? "" : date.toISOString();
}

function adminDocumentManifestFileIds_(value, fieldName) {
  var ids = [];
  var seen = {};
  var urls = normalizeToUrlList_(value, fieldName);
  for (var i = 0; i < urls.length; i++) {
    var fileId = extractDriveFileId_(urls[i]);
    if (!fileId || seen[fileId]) continue;
    seen[fileId] = true;
    ids.push(fileId);
  }
  return ids;
}

function adminDocumentManifestParentIds_(file) {
  var out = [];
  var parents = file && file.getParents ? file.getParents() : null;
  while (parents && parents.hasNext()) {
    var parent = parents.next();
    var id = clean_(parent && parent.getId ? parent.getId() : "");
    if (id) out.push(id);
  }
  return out;
}

function adminDocumentManifestFileMetadata_(file, folderId) {
  var parentIds = adminDocumentManifestParentIds_(file);
  var sizeBytes = null;
  try { sizeBytes = Number(file.getSize()); } catch (_sizeErr) {}
  if (!isFinite(sizeBytes)) sizeBytes = null;
  return {
    fileId: clean_(file.getId()),
    fileName: clean_(file.getName()),
    mimeType: clean_(file.getMimeType()),
    sizeBytes: sizeBytes,
    createdTime: adminDocumentManifestIso_(file.getDateCreated()),
    modifiedTime: adminDocumentManifestIso_(file.getLastUpdated()),
    parentFolderId: parentIds.length ? parentIds[0] : "",
    parentFolderIds: parentIds,
    expectedFolderId: clean_(folderId || "")
  };
}

function adminDocumentManifestPrefixField_(fileName, docFields) {
  var name = clean_(fileName || "");
  var docs = Array.isArray(docFields) ? docFields : [];
  for (var i = 0; i < docs.length; i++) {
    var field = clean_(docs[i] && docs[i].file || "");
    if (field && name.indexOf(field + "_") === 0) return field;
  }
  return "";
}

function adminDocumentManifestWarning_(code, detail) {
  return {
    code: clean_(code || "UNKNOWN_WARNING"),
    detail: clean_(detail || "")
  };
}

function adminDocumentFileActionField_(fieldName) {
  var target = clean_(fieldName || "");
  var docs = Array.isArray(CONFIG.DOC_FIELDS) ? CONFIG.DOC_FIELDS : [];
  for (var i = 0; i < docs.length; i++) {
    if (clean_(docs[i] && docs[i].file || "") === target) return docs[i];
  }
  return null;
}

function adminResolveApplicantDocumentFile_(payload) {
  var p = payload && typeof payload === "object" ? payload : {};
  var applicantId = clean_(p.applicantId || p.ApplicantID || "");
  var rowNumber = Number(p.rowNumber);
  var sourceField = clean_(p.sourceField || "");
  var itemIndex = Number(p.itemIndex);
  if (!applicantId || !isFinite(rowNumber) || rowNumber < 2 || Math.floor(rowNumber) !== rowNumber) {
    return { ok: false, code: "INVALID_APPLICANT_CONTEXT", error: "Applicant context is invalid" };
  }
  if (!isFinite(itemIndex) || itemIndex < 0 || Math.floor(itemIndex) !== itemIndex) {
    return { ok: false, code: "INVALID_ITEM_INDEX", error: "Document item index is invalid" };
  }
  var docField = adminDocumentFileActionField_(sourceField);
  if (!docField) {
    return { ok: false, code: "INVALID_SOURCE_FIELD", error: "Document field is invalid" };
  }

  var sheet = openDataSheet_();
  var row = getRowObject_(sheet, rowNumber);
  var rowApplicantId = clean_(row.ApplicantID || row[CONFIG.APPLICANT_ID_HEADER] || "");
  if (!rowApplicantId || rowApplicantId !== applicantId) {
    return { ok: false, code: "APPLICANT_CONTEXT_MISMATCH", error: "Applicant context does not match" };
  }

  var folderUrl = clean_(row.Folder_Url || row[SCHEMA.FOLDER_URL] || "");
  var folderId = folderIdFromUrl_(folderUrl);
  if (!folderId) {
    return { ok: false, code: "DOCUMENT_SOURCE_UNAVAILABLE", error: "Document source is unavailable" };
  }
  var sourceUrls = normalizeToUrlList_(row[sourceField], sourceField);
  if (itemIndex >= sourceUrls.length) {
    return { ok: false, code: "ITEM_INDEX_OUT_OF_RANGE", error: "Document item is unavailable" };
  }
  var fileId = extractDriveFileId_(sourceUrls[itemIndex]);
  if (!fileId) {
    return { ok: false, code: "DOCUMENT_SOURCE_UNAVAILABLE", error: "Document source is unavailable" };
  }
  var file;
  try {
    file = DriveApp.getFileById(fileId);
  } catch (_fileErr) {
    return { ok: false, code: "DOCUMENT_SOURCE_UNAVAILABLE", error: "Document source is unavailable" };
  }
  if (!isFileInFolderChain_(file, folderId)) {
    return { ok: false, code: "DOCUMENT_SOURCE_MISMATCH", error: "Document source does not match applicant context" };
  }

  return {
    ok: true,
    applicantId: applicantId,
    rowNumber: rowNumber,
    sourceField: sourceField,
    itemIndex: itemIndex,
    docField: docField,
    file: file,
    folderId: folderId
  };
}

function adminDocumentGalleryRenditionHash_(value) {
  var bytes = Utilities.computeDigest(
    Utilities.DigestAlgorithm.SHA_256,
    clean_(value || ""),
    Utilities.Charset.UTF_8
  );
  return Utilities.base64EncodeWebSafe(bytes).replace(/=+$/g, "").slice(0, 32);
}

function adminDocumentGalleryRenditionFolder_(folderIdValue) {
  var folderId = clean_(folderIdValue || "");
  if (!folderId) throw new Error("Applicant folder ID missing for document rendition");
  return DriveApp.getFolderById(folderId);
}

function adminDocumentGalleryRenditionSourceStamp_(file) {
  var updated = "";
  try {
    updated = file && file.getLastUpdated ? adminDocumentManifestIso_(file.getLastUpdated()) : "";
  } catch (_updatedErr) {}
  var sizeBytes = 0;
  try {
    sizeBytes = Number(file && file.getSize ? file.getSize() : 0);
  } catch (_sizeErr) {}
  return {
    fileId: clean_(file && file.getId ? file.getId() : ""),
    fileName: clean_(file && file.getName ? file.getName() : ""),
    updated: clean_(updated || ""),
    sizeBytes: sizeBytes
  };
}

function adminDocumentGalleryRenditionKey_(resolved, mimeType) {
  var stamp = adminDocumentGalleryRenditionSourceStamp_(resolved.file);
  var raw = [
    clean_(resolved.applicantId || ""),
    clean_(resolved.sourceField || ""),
    String(Number(resolved.itemIndex || 0)),
    clean_(stamp.fileId || ""),
    clean_(stamp.updated || ""),
    String(Number(stamp.sizeBytes || 0)),
    clean_(mimeType || "")
  ].join("|");
  return adminDocumentGalleryRenditionHash_(raw);
}

function adminDocumentGalleryRenditionFileName_(resolved, key) {
  var applicant = clean_(resolved.applicantId || "applicant").replace(/[^A-Za-z0-9_-]+/g, "_");
  var field = clean_(resolved.sourceField || "document").replace(/[^A-Za-z0-9_-]+/g, "_");
  var index = String(Number(resolved.itemIndex || 0));
  return [applicant, "FODE_PREVIEW", field, "item" + index, clean_(key || "rendition")].join("__") + ".png";
}

function adminDocumentGalleryFindStoredRendition_(folder, fileName) {
  var files = folder.getFilesByName(fileName);
  return files.hasNext() ? files.next() : null;
}

function adminDocumentGalleryFetchPdfThumbnailBlob_(file) {
  var fileId = clean_(file && file.getId ? file.getId() : "");
  if (!fileId) throw new Error("PDF file ID unavailable");
  var meta = driveApiGet_("/files/" + encodeURIComponent(fileId), {
    fields: "id,name,mimeType,thumbnailLink,size,modifiedTime"
  });
  var thumb = clean_(meta && meta.json && meta.json.thumbnailLink || "");
  if (!meta || meta.ok !== true || !thumb) throw new Error("PDF thumbnailLink unavailable");
  var thumbUrl = thumb.replace(/=s\d+(-c)?/i, "=s1200");
  var resp = UrlFetchApp.fetch(thumbUrl, {
    headers: oauthHeaders_(),
    muteHttpExceptions: true
  });
  var status = Number(resp.getResponseCode ? resp.getResponseCode() : 0);
  if (status < 200 || status >= 300) throw new Error("PDF thumbnail fetch failed: " + status);
  return resp.getBlob();
}

function adminDocumentGalleryBuildPngRenditionBlob_(file, mimeType) {
  var sourceBlob = /^application\/pdf$/i.test(mimeType)
    ? adminDocumentGalleryFetchPdfThumbnailBlob_(file)
    : file.getBlob();
  var pngBlob = sourceBlob.getAs("image/png");
  if (!pngBlob) throw new Error("PNG rendition conversion unavailable");
  return pngBlob;
}

function adminDocumentGalleryGetOrCreateStoredRendition_(resolved, mimeType) {
  var folder = adminDocumentGalleryRenditionFolder_(resolved.folderId);
  var key = adminDocumentGalleryRenditionKey_(resolved, mimeType);
  var fileName = adminDocumentGalleryRenditionFileName_(resolved, key);
  var existing = adminDocumentGalleryFindStoredRendition_(folder, fileName);
  if (existing) {
    return {
      file: existing,
      key: key,
      fileName: fileName,
      folderName: clean_(folder.getName ? folder.getName() : ""),
      generated: false
    };
  }
  var pngBlob = adminDocumentGalleryBuildPngRenditionBlob_(resolved.file, mimeType);
  pngBlob.setName(fileName);
  var created = folder.createFile(pngBlob);
  return {
    file: created,
    key: key,
    fileName: fileName,
    folderName: clean_(folder.getName ? folder.getName() : ""),
    generated: true
  };
}

function adminDocumentGalleryInspectStoredRendition_(resolved, mimeType) {
  var folder = adminDocumentGalleryRenditionFolder_(resolved.folderId);
  var key = adminDocumentGalleryRenditionKey_(resolved, mimeType);
  var fileName = adminDocumentGalleryRenditionFileName_(resolved, key);
  var existing = adminDocumentGalleryFindStoredRendition_(folder, fileName);
  return {
    exists: !!existing,
    key: key,
    fileName: fileName,
    folderName: clean_(folder.getName ? folder.getName() : "")
  };
}

function adminDocumentGalleryPrepareStoredRendition_(resolved) {
  var file = resolved && resolved.file;
  var mimeType = clean_(file && file.getMimeType ? file.getMimeType() : "");
  var isImage = /^image\//i.test(mimeType);
  var isPdf = /^application\/pdf$/i.test(mimeType);
  if (!isImage && !isPdf) {
    return { ok: false, code: "UNSUPPORTED_RENDITION_TYPE", error: "Only image and PDF files can be rendered in-gallery." };
  }
  var maxBytes = Number((CONFIG && CONFIG.DOCUMENT_GALLERY_RENDITION_MAX_BYTES) || 6000000);
  var sizeBytes = Number(file && file.getSize ? file.getSize() : 0);
  if (maxBytes > 0 && sizeBytes > maxBytes) {
    return { ok: false, code: "RENDITION_TOO_LARGE", error: "File is too large for inline gallery rendering. Use Open or Download." };
  }
  var stored = adminDocumentGalleryGetOrCreateStoredRendition_(resolved, mimeType);
  return {
    ok: true,
    sourceField: resolved.sourceField,
    itemIndex: resolved.itemIndex,
    label: clean_(resolved.docField && resolved.docField.label || resolved.sourceField),
    fileName: clean_(file && file.getName ? file.getName() : ""),
    sourceMimeType: mimeType,
    renditionMimeType: "image/png",
    renditionKind: isPdf ? "pdf-first-page-png" : "image-png",
    renditionStorage: "applicant-folder",
    renditionFolderName: clean_(stored.folderName || ""),
    renditionKey: clean_(stored.key || ""),
    renditionFileName: clean_(stored.fileName || ""),
    generated: stored.generated === true,
    stalePolicy: "reuse-if-source-key-matches; regenerate-on-source-replacement",
    file: stored.file
  };
}

function adminDocumentGalleryInspectRenditionCandidate_(resolved) {
  var file = resolved && resolved.file;
  var mimeType = clean_(file && file.getMimeType ? file.getMimeType() : "");
  var isImage = /^image\//i.test(mimeType);
  var isPdf = /^application\/pdf$/i.test(mimeType);
  if (!isImage && !isPdf) {
    return { ok: false, code: "UNSUPPORTED_RENDITION_TYPE", error: "Only image and PDF files can be rendered in-gallery." };
  }
  var maxBytes = Number((CONFIG && CONFIG.DOCUMENT_GALLERY_RENDITION_MAX_BYTES) || 6000000);
  var sizeBytes = Number(file && file.getSize ? file.getSize() : 0);
  if (maxBytes > 0 && sizeBytes > maxBytes) {
    return { ok: false, code: "RENDITION_TOO_LARGE", error: "File is too large for inline gallery rendering. Use Open or Download." };
  }
  var inspected = adminDocumentGalleryInspectStoredRendition_(resolved, mimeType);
  return {
    ok: true,
    sourceMimeType: mimeType,
    renditionKind: isPdf ? "pdf-first-page-png" : "image-png",
    renditionFileName: inspected.fileName,
    renditionKey: inspected.key,
    exists: inspected.exists
  };
}

function adminResolveApplicantDocumentFileFromRow_(rowObj, rowNumber, applicantId, sourceField, itemIndex) {
  var row = rowObj || {};
  var id = clean_(applicantId || row.ApplicantID || row[CONFIG.APPLICANT_ID_HEADER] || "");
  var field = clean_(sourceField || "");
  var index = Number(itemIndex);
  var docField = adminDocumentFileActionField_(field);
  if (!id || !docField || !isFinite(index) || index < 0 || Math.floor(index) !== index) {
    return { ok: false, code: "INVALID_DOCUMENT_CONTEXT" };
  }
  var folderUrl = clean_(row.Folder_Url || row[SCHEMA.FOLDER_URL] || "");
  var folderId = folderIdFromUrl_(folderUrl);
  if (!folderId) return { ok: false, code: "DOCUMENT_FOLDER_MISSING" };
  var sourceUrls = normalizeToUrlList_(row[field], field);
  if (index >= sourceUrls.length) return { ok: false, code: "DOCUMENT_ITEM_MISSING" };
  var fileId = extractDriveFileId_(sourceUrls[index]);
  if (!fileId) return { ok: false, code: "DOCUMENT_FILE_ID_MISSING" };
  var file;
  try {
    file = DriveApp.getFileById(fileId);
  } catch (_fileErr) {
    return { ok: false, code: "DOCUMENT_SOURCE_UNAVAILABLE" };
  }
  if (!isFileInFolderChain_(file, folderId)) return { ok: false, code: "DOCUMENT_SOURCE_MISMATCH" };
  return {
    ok: true,
    applicantId: id,
    rowNumber: Number(rowNumber),
    sourceField: field,
    itemIndex: index,
    docField: docField,
    file: file,
    folderId: folderId
  };
}

function adminDocumentPreviewBackfillBatch_(payload, execute) {
  var adminEmail = getCallerEmail_();
  try {
    requireDocumentVerifier_(adminEmail);
  } catch (_authErr) {
    return { ok: false, code: "ACCESS_DENIED", error: "Access denied: document verifier required" };
  }

  var p = payload && typeof payload === "object" ? payload : {};
  var startRow = Math.max(2, Number(p.startRow || p.offset || 2));
  var batchSize = Math.max(1, Math.min(25, Number(p.batchSize || p.limit || 10)));
  var startedAt = Date.now();
  var summary = {
    mode: execute ? "execute" : "dry-run",
    startRow: startRow,
    batchSize: batchSize,
    rowsScanned: 0,
    applicantFoldersFound: 0,
    sourceFilesFound: 0,
    previewsAlreadyPresent: 0,
    previewsWouldCreate: 0,
    previewsCreated: 0,
    skippedUnsupported: 0,
    skippedMissingFolder: 0,
    skippedMissingFile: 0,
    failedConversions: 0,
    items: []
  };

  try {
    var sh = openDataSheet_();
    var lastRow = sh.getLastRow();
    var lastCol = sh.getLastColumn();
    if (lastRow < startRow) {
      summary.nextStartRow = "";
      summary.elapsedMs = Date.now() - startedAt;
      return { ok: true, summary: summary };
    }
    var headers = sh.getRange(1, 1, 1, lastCol).getValues()[0];
    var idx = headerIndex_(headers);
    var count = Math.min(batchSize, lastRow - startRow + 1);
    var values = sh.getRange(startRow, 1, count, lastCol).getValues();
    var docs = Array.isArray(CONFIG.DOC_FIELDS) ? CONFIG.DOC_FIELDS : [];
    for (var r = 0; r < values.length; r++) {
      var rowNumber = startRow + r;
      var rowObj = {};
      for (var c = 0; c < headers.length; c++) {
        var h = clean_(headers[c]);
        if (h) rowObj[h] = values[r][c];
      }
      var applicantId = clean_(rowObj.ApplicantID || rowObj[CONFIG.APPLICANT_ID_HEADER] || "");
      if (!applicantId) continue;
      summary.rowsScanned++;
      if (!folderIdFromUrl_(clean_(rowObj.Folder_Url || ""))) summary.skippedMissingFolder++;
      else summary.applicantFoldersFound++;

      for (var d = 0; d < docs.length; d++) {
        var field = clean_(docs[d] && docs[d].file || "");
        if (!field) continue;
        var urls = normalizeToUrlList_(rowObj[field], field);
        for (var i = 0; i < urls.length; i++) {
          var item = {
            applicantId: applicantId,
            rowNumber: rowNumber,
            sourceField: field,
            itemIndex: i,
            action: ""
          };
          var resolved = adminResolveApplicantDocumentFileFromRow_(rowObj, rowNumber, applicantId, field, i);
          if (!resolved || resolved.ok !== true) {
            if (resolved && resolved.code === "DOCUMENT_FOLDER_MISSING") summary.skippedMissingFolder++;
            else summary.skippedMissingFile++;
            item.action = clean_(resolved && resolved.code || "SKIPPED");
            summary.items.push(item);
            continue;
          }
          summary.sourceFilesFound++;
          try {
            var prepared = execute
              ? adminDocumentGalleryPrepareStoredRendition_(resolved)
              : adminDocumentGalleryInspectRenditionCandidate_(resolved);
            if (!prepared || prepared.ok !== true) {
              summary.skippedUnsupported++;
              item.action = clean_(prepared && prepared.code || "UNSUPPORTED_RENDITION_TYPE");
              summary.items.push(item);
              continue;
            }
            if (execute ? prepared.generated === true : prepared.exists !== true) {
              if (execute) {
                summary.previewsCreated++;
                item.action = "created";
              } else {
                summary.previewsWouldCreate++;
                item.action = "would_create";
              }
            } else {
              summary.previewsAlreadyPresent++;
              item.action = "already_present";
            }
            item.renditionFileName = clean_(prepared.renditionFileName || "");
            item.renditionKind = clean_(prepared.renditionKind || "");
            summary.items.push(item);
          } catch (err) {
            summary.failedConversions++;
            item.action = "failed";
            item.error = clean_(err && err.message ? err.message : String(err));
            summary.items.push(item);
          }
        }
      }
    }
    summary.nextStartRow = (startRow + values.length <= lastRow) ? (startRow + values.length) : "";
    summary.elapsedMs = Date.now() - startedAt;
    return { ok: true, summary: summary };
  } catch (errOuter) {
    summary.elapsedMs = Date.now() - startedAt;
    return { ok: false, code: "DOCUMENT_PREVIEW_BACKFILL_ERROR", error: clean_(errOuter && errOuter.message ? errOuter.message : String(errOuter)), summary: summary };
  }
}


// Shared document completeness, mapping, and normalization helpers moved from Admin.js in F4J.

function adminDocumentRequiredUploadFields_() {
  return [
    { field: "Birth_ID_Passport_File", label: "Birth Certificate / NID / Passport" },
    { field: "Latest_School_Report_File", label: "Latest School Reports / Documents" },
    { field: "Passport_Photo_File", label: "Passport Size Colour Photo" }
  ];
}

function adminDocumentMandatoryIssueMappings_() {
  return [
    { file: "Birth_ID_Passport_File", status: "Birth_ID_Status" },
    { file: "Latest_School_Report_File", status: "Report_Status" }
  ];
}

function adminDocumentHasEvidence_(rowObj, fieldName) {
  var row = rowObj || {};
  var field = clean_(fieldName || "");
  if (!field) return false;
  return hasUploadEvidence_(row[field], field);
}

function adminDocumentDisplayRowHasUrl_(displayRow, idx, mapping) {
  if (!mapping || !mapping.file) return false;
  if (!idx || !idx[mapping.file]) return false;
  var url = clean_((displayRow || [])[idx[mapping.file] - 1]);
  return /^https?:\/\//i.test(url);
}

function adminDocumentFieldStatus_(rowObj, statusField) {
  var row = rowObj || {};
  return normalizeDocStatus_(row[statusField] || "Pending");
}

function hasAnyRequiredDoc_(rowObj) {
  var row = rowObj || {};
  var required = [
    "Birth_ID_Passport_File",
    "Latest_School_Report_File",
    "Transfer_Certificate_File",
    "Passport_Photo_File"
  ];
  for (var i = 0; i < required.length; i++) {
    if (hasUploadEvidence_(row[required[i]], required[i])) return true;
  }
  return false;
}

function findDocMapping_(file, statusField, commentField, docMap) {
  var i;
  if (file) {
    for (i = 0; i < docMap.length; i++) if (docMap[i].file === file) return docMap[i];
  }
  if (statusField && commentField) {
    for (i = 0; i < docMap.length; i++) {
      if (docMap[i].status === statusField && docMap[i].comment === commentField) return docMap[i];
    }
  }
  return null;
}

function normalizeDocStatus_(s) {
  var v = clean_(s).toLowerCase();
  if (v === "verified") return "Verified";
  if (v === "rejected") return "Rejected";
  if (v === "fraudulent") return "Fraudulent";
  return "Pending";
}

function toRouteStatusKey_(status) {
  if (status === "Verified") return "VERIFIED";
  if (status === "Rejected") return "REJECTED";
  if (status === "Fraudulent") return "FRAUDULENT";
  return "PENDING_REVIEW";
}
