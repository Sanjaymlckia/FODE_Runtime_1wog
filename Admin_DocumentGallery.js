// Document gallery public RPC facade. Private document-service helpers live in Admin_DocumentServices.js.
// Public function names remain unchanged for google.script.run and Apps Script compatibility.

function admin_getApplicantDocumentManifest(payload) {
  var adminEmail = getCallerEmail_();
  try {
    try {
      requireDocumentVerifier_(adminEmail);
    } catch (_authErr) {
      return { ok: false, code: "ACCESS_DENIED", error: "Access denied: document verifier required" };
    }

    var p = payload && typeof payload === "object" ? payload : {};
    var applicantId = clean_(p.applicantId || p.ApplicantID || "");
    if (!applicantId) {
      return { ok: false, code: "MISSING_APPLICANT_ID", error: "ApplicantID is required" };
    }

    var sheet = openDataSheet_();
    var rowNumber = findRowByApplicantId_(sheet, applicantId);
    if (!rowNumber) {
      return { ok: false, code: "APPLICANT_NOT_FOUND", applicantId: applicantId, error: "Applicant not found" };
    }

    var row = getRowObject_(sheet, rowNumber);
    var rowApplicantId = clean_(row.ApplicantID || row[CONFIG.APPLICANT_ID_HEADER] || applicantId);
    var applicantName = [clean_(row.First_Name || ""), clean_(row.Last_Name || "")].filter(function (v) {
      return !!v;
    }).join(" ");
    var folderUrl = clean_(row.Folder_Url || row[SCHEMA.FOLDER_URL] || "");
    var warnings = [];
    if (!folderUrl) {
      return {
        ok: false,
        code: "MISSING_FOLDER_URL",
        applicantId: rowApplicantId,
        applicantName: applicantName,
        folderUrl: "",
        files: [],
        missingExpected: [],
        warnings: [adminDocumentManifestWarning_("MISSING_FOLDER_URL", "Applicant row has no Folder_Url.")]
      };
    }

    var folderId = folderIdFromUrl_(folderUrl);
    if (!folderId) {
      return {
        ok: false,
        code: "INVALID_FOLDER_URL",
        applicantId: rowApplicantId,
        applicantName: applicantName,
        folderUrl: folderUrl,
        files: [],
        missingExpected: [],
        warnings: [adminDocumentManifestWarning_("INVALID_FOLDER_URL", "Folder_Url does not contain a Drive folder ID.")]
      };
    }

    var folder;
    try {
      folder = DriveApp.getFolderById(folderId);
    } catch (folderErr) {
      return {
        ok: false,
        code: "FOLDER_INACCESSIBLE",
        applicantId: rowApplicantId,
        applicantName: applicantName,
        folderId: folderId,
        folderUrl: folderUrl,
        files: [],
        missingExpected: [],
        warnings: [adminDocumentManifestWarning_("FOLDER_INACCESSIBLE", "Drive folder was not found or is not accessible.")]
      };
    }

    var docFields = Array.isArray(CONFIG.DOC_FIELDS) ? CONFIG.DOC_FIELDS : [];
    var fieldByName = {};
    var fieldIds = {};
    var mappedIds = {};
    for (var d = 0; d < docFields.length; d++) {
      var doc = docFields[d] || {};
      var fieldName = clean_(doc.file || "");
      if (!fieldName) continue;
      fieldByName[fieldName] = doc;
      fieldIds[fieldName] = adminDocumentManifestFileIds_(row[fieldName], fieldName);
    }

    var rawFiles = [];
    var filesIt = folder.getFiles();
    while (filesIt.hasNext()) {
      rawFiles.push(adminDocumentManifestFileMetadata_(filesIt.next(), folderId));
    }

    var secret = "";
    try {
      var secretRes = getPortalSecretForApplicant_(rowApplicantId);
      if (secretRes && secretRes.ok !== false) secret = clean_(secretRes.secret || secretRes.secretPlain || "");
    } catch (_secretErr) {}
    var execUrl = clean_(CONFIG.WEBAPP_URL_STUDENT || getExecUrl_() || "");
    if (!secret || !execUrl) {
      warnings.push(adminDocumentManifestWarning_(
        "SECURE_FILE_URL_UNAVAILABLE",
        "Secure file URLs could not be generated from the current portal token configuration."
      ));
    }
    var signedPreviewExpiresAtMs = Date.now() + (5 * 60 * 1000);

    var files = [];
    for (var f = 0; f < rawFiles.length; f++) {
      var meta = rawFiles[f];
      var sourceField = "";
      var mappingMethod = "unmapped";
      var matches = [];
      for (var field in fieldIds) {
        if (!Object.prototype.hasOwnProperty.call(fieldIds, field)) continue;
        if (fieldIds[field].indexOf(meta.fileId) >= 0) matches.push(field);
      }
      if (matches.length) {
        sourceField = matches[0];
        mappingMethod = "row_file_id";
        if (matches.length > 1) {
          warnings.push(adminDocumentManifestWarning_(
            "DUPLICATE_FIELD_MAPPING",
            meta.fileId + " is referenced by multiple document fields: " + matches.join(", ")
          ));
        }
      } else {
        sourceField = adminDocumentManifestPrefixField_(meta.fileName, docFields);
        if (sourceField) {
          mappingMethod = "filename_prefix";
          warnings.push(adminDocumentManifestWarning_("FILE_NOT_REFERENCED_BY_SHEET", meta.fileId));
          warnings.push(adminDocumentManifestWarning_(
            "FILENAME_PREFIX_FALLBACK",
            meta.fileId + " mapped to " + sourceField + " from filename prefix."
          ));
        }
      }

      var fileWarnings = [];
      if (!sourceField) {
        fileWarnings.push(adminDocumentManifestWarning_("UNMAPPED_FILE", "File is not mapped to a configured document field."));
        warnings.push(adminDocumentManifestWarning_("FILE_NOT_REFERENCED_BY_SHEET", meta.fileId));
      }
      if (meta.parentFolderIds.indexOf(folderId) < 0) {
        fileWarnings.push(adminDocumentManifestWarning_("UNEXPECTED_PARENT_FOLDER", meta.parentFolderIds.join(", ")));
        warnings.push(adminDocumentManifestWarning_("UNEXPECTED_PARENT_FOLDER", meta.fileId));
      }
      if (adminDocumentManifestMimeExtensionMismatch_(meta.fileName, meta.mimeType)) {
        fileWarnings.push(adminDocumentManifestWarning_("MIME_EXTENSION_MISMATCH", meta.fileName + " | " + meta.mimeType));
        warnings.push(adminDocumentManifestWarning_("MIME_EXTENSION_MISMATCH", meta.fileId));
      }
      if (sourceField) mappedIds[meta.fileId] = true;
      var sourceFieldIds = sourceField ? (fieldIds[sourceField] || []) : [];
      var itemIndex = sourceField ? sourceFieldIds.indexOf(meta.fileId) : -1;
      var canBuildFileSpecificProxy = mappingMethod === "row_file_id"
        && itemIndex >= 0;
      var previewEligible = /^image\//i.test(meta.mimeType);
      var renditionEligible = previewEligible || /^application\/pdf$/i.test(meta.mimeType);
      var renditionKind = previewEligible ? "image-png" : (/^application\/pdf$/i.test(meta.mimeType) ? "pdf-first-page-png" : "");
      var previewUrl = previewEligible && canBuildFileSpecificProxy && secret && execUrl
        ? buildSignedDocumentFileActionUrl_(
          execUrl, rowApplicantId, sourceField, itemIndex, "open", signedPreviewExpiresAtMs, secret
        )
        : "";
      if (sourceField && !canBuildFileSpecificProxy) {
        fileWarnings.push(adminDocumentManifestWarning_(
          "FILE_SPECIFIC_PROXY_UNAVAILABLE",
          "Existing secure proxy is field-based and cannot identify this file independently."
        ));
      }

      files.push({
        fileId: meta.fileId,
        fileName: meta.fileName,
        label: sourceField ? clean_((fieldByName[sourceField] && fieldByName[sourceField].label) || sourceField) : "",
        mimeType: meta.mimeType,
        sizeBytes: meta.sizeBytes,
        createdTime: meta.createdTime,
        modifiedTime: meta.modifiedTime,
        parentFolderId: meta.parentFolderId,
        sourceField: sourceField,
        itemIndex: itemIndex >= 0 ? itemIndex : null,
        mappingMethod: mappingMethod,
        suspectedDocumentType: adminDocumentManifestTypeForField_(sourceField),
        previewEligible: previewEligible,
        renditionEligible: renditionEligible && canBuildFileSpecificProxy,
        renditionKind: renditionKind,
        thumbnailAvailable: !!(renditionEligible && canBuildFileSpecificProxy),
        previewUrl: previewUrl,
        openUrl: canBuildFileSpecificProxy && secret && execUrl
          ? buildTokenGatedFileUrl_(execUrl, rowApplicantId, secret, sourceField, "open")
          : "",
        downloadUrl: canBuildFileSpecificProxy && secret && execUrl
          ? buildTokenGatedFileUrl_(execUrl, rowApplicantId, secret, sourceField, "download")
          : "",
        warnings: fileWarnings
      });
    }

    var missingExpected = [];
    for (var expectedField in fieldByName) {
      if (!Object.prototype.hasOwnProperty.call(fieldByName, expectedField)) continue;
      var expectedDoc = fieldByName[expectedField] || {};
      var ids = fieldIds[expectedField] || [];
      var mappedCount = 0;
      for (var x = 0; x < ids.length; x++) {
        if (mappedIds[ids[x]]) mappedCount++;
        else warnings.push(adminDocumentManifestWarning_(
          "SHEET_FILE_ID_NOT_FOUND_IN_FOLDER",
          expectedField + ": " + ids[x]
        ));
      }
      if (expectedDoc.required !== false && mappedCount === 0) {
        missingExpected.push({
          sourceField: expectedField,
          label: clean_(expectedDoc.label || expectedField),
          required: true
        });
      }
    }

    return {
      ok: true,
      applicantId: rowApplicantId,
      applicantName: applicantName,
      folderId: folderId,
      folderName: clean_(folder.getName()),
      folderUrl: folderUrl,
      source: "drive",
      files: files,
      missingExpected: missingExpected,
      warnings: warnings
    };
  } catch (err) {
    return {
      ok: false,
      code: "DOCUMENT_MANIFEST_ERROR",
      error: "Document manifest could not be built."
    };
  }
}

function admin_getApplicantDocumentImageRendition(payload) {
  var adminEmail = getCallerEmail_();
  try {
    requireDocumentVerifier_(adminEmail);
  } catch (_authErr) {
    return { ok: false, code: "ACCESS_DENIED", error: "Access denied: document verifier required" };
  }

  try {
    var resolved = adminResolveApplicantDocumentFile_(payload);
    if (!resolved || resolved.ok !== true) return resolved;
    var prepared = adminDocumentGalleryPrepareStoredRendition_(resolved);
    if (!prepared || prepared.ok !== true) return prepared;
    var blob = prepared.file.getBlob();
    var bytes = blob.getBytes();
    return {
      ok: true,
      sourceField: prepared.sourceField,
      itemIndex: prepared.itemIndex,
      label: prepared.label,
      fileName: prepared.fileName,
      sourceMimeType: prepared.sourceMimeType,
      renditionMimeType: "image/png",
      renditionKind: prepared.renditionKind,
      renditionStorage: "applicant-folder",
      renditionFolderName: prepared.renditionFolderName,
      renditionKey: prepared.renditionKey,
      generated: prepared.generated === true,
      stalePolicy: prepared.stalePolicy,
      dataUrl: "data:image/png;base64," + Utilities.base64Encode(bytes)
    };
  } catch (_err) {
    return {
      ok: false,
      code: "DOCUMENT_IMAGE_RENDITION_ERROR",
      error: "Document image preview could not be prepared"
    };
  }
}

function admin_dryRunDocumentPreviewBackfill(payload) {
  return adminDocumentPreviewBackfillBatch_(payload, false);
}

function admin_runDocumentPreviewBackfillBatch(payload) {
  return adminDocumentPreviewBackfillBatch_(payload, true);
}

function admin_getApplicantDocumentFileAction(payload) {
  var adminEmail = getCallerEmail_();
  try {
    requireDocumentVerifier_(adminEmail);
  } catch (_authErr) {
    return { ok: false, code: "ACCESS_DENIED", error: "Access denied: document verifier required" };
  }

  try {
    var resolved = adminResolveApplicantDocumentFile_(payload);
    if (!resolved || resolved.ok !== true) return resolved;
    var applicantId = resolved.applicantId;
    var sourceField = resolved.sourceField;
    var itemIndex = resolved.itemIndex;
    var docField = resolved.docField;
    var file = resolved.file;

    var secretRes = getPortalSecretForApplicant_(applicantId);
    var secret = clean_(secretRes && (secretRes.secret || secretRes.secretPlain) || "");
    var baseUrl = clean_(CONFIG.WEBAPP_URL_STUDENT || "");
    if (!secret || !baseUrl) {
      return { ok: false, code: "SECURE_ACTION_UNAVAILABLE", error: "Secure document action is unavailable" };
    }
    var expiresAtMs = Date.now() + (5 * 60 * 1000);
    var openUrl = buildSignedDocumentFileActionUrl_(
      baseUrl, applicantId, sourceField, itemIndex, "open", expiresAtMs, secret
    );
    var downloadUrl = buildSignedDocumentFileActionUrl_(
      baseUrl, applicantId, sourceField, itemIndex, "download", expiresAtMs, secret
    );
    if (!openUrl || !downloadUrl) {
      return { ok: false, code: "SECURE_ACTION_UNAVAILABLE", error: "Secure document action is unavailable" };
    }

    var mimeType = clean_(file.getMimeType ? file.getMimeType() : "");
    return {
      ok: true,
      sourceField: sourceField,
      itemIndex: itemIndex,
      label: clean_(docField.label || sourceField),
      mimeType: mimeType,
      previewEligible: /^image\//i.test(mimeType),
      openUrl: openUrl,
      downloadUrl: downloadUrl,
      expiresAt: new Date(expiresAtMs).toISOString()
    };
  } catch (_err) {
    return {
      ok: false,
      code: "DOCUMENT_ACTION_ERROR",
      error: "Secure document action could not be built"
    };
  }
}
