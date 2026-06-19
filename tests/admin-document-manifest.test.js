const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("Admin.js", "utf8");

function extractFunction(name) {
  const marker = `function ${name}`;
  const start = source.indexOf(marker);
  assert.notEqual(start, -1, `Function ${name} must exist`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  let quote = "";
  let escaped = false;
  for (let i = brace; i < source.length; i += 1) {
    const ch = source[i];
    if (quote) {
      if (escaped) escaped = false;
      else if (ch === "\\") escaped = true;
      else if (ch === quote) quote = "";
      continue;
    }
    if (ch === "\"" || ch === "'" || ch === "`") {
      quote = ch;
      continue;
    }
    if (ch === "{") depth += 1;
    else if (ch === "}" && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error(`Function ${name} is not closed`);
}

const helperNames = [
  "adminDocumentManifestTypeForField_",
  "adminDocumentManifestExtension_",
  "adminDocumentManifestMimeExtensionMismatch_",
  "adminDocumentManifestIso_",
  "adminDocumentManifestFileIds_",
  "adminDocumentManifestParentIds_",
  "adminDocumentManifestFileMetadata_",
  "adminDocumentManifestPrefixField_",
  "adminDocumentManifestWarning_",
  "admin_getApplicantDocumentManifest"
];

const implementationSource = helperNames.map(extractFunction).join("\n\n");
const manifestSource = extractFunction("admin_getApplicantDocumentManifest");
assert.match(manifestSource, /requireSuperAdmin_\(adminEmail\)/, "Super Admin gate must remain present");
assert.ok(
  manifestSource.indexOf("requireSuperAdmin_(adminEmail)") < manifestSource.indexOf("openDataSheet_()"),
  "Super Admin authorization must occur before sheet access"
);
assert.ok(
  manifestSource.indexOf("requireSuperAdmin_(adminEmail)") < manifestSource.indexOf("DriveApp.getFolderById"),
  "Super Admin authorization must occur before Drive access"
);

const forbiddenPatterns = [
  "withEnvelope_",
  "setValue(",
  "setValues(",
  "appendRow(",
  "applyPatch_(",
  "writeBack_(",
  "CacheService",
  "PropertiesService",
  "MailApp",
  "GmailApp",
  "sendEmail(",
  "logAudit_(",
  "log_(",
  "getBlob(",
  "getBytes(",
  "createFile(",
  "createFolder("
];
for (const pattern of forbiddenPatterns) {
  assert.equal(implementationSource.includes(pattern), false, `Forbidden side effect or byte read: ${pattern}`);
}

const fixtureFiles = [
  ["1APiWZve1hJLOTTuHbMAuIq9f471g4R7j", "Birth_ID_Passport_File_20260526_084724_396.pdf", "application/pdf", 799338],
  ["1TOWyeveMYjK2jcWDGtStHj0KGjM4slUx", "Latest_School_Report_File_20260526_084727_744.pdf", "application/pdf", 792949],
  ["1ph1oPdCTsBd6t8q98pn0o9fV0bPmrV7B", "Latest_School_Report_File_20260526_084730_843.pdf", "application/pdf", 797431],
  ["1Y638GeHnf1S4tvmGXzi58lnbNsnjccwO", "Latest_School_Report_File_20260526_084733_562.pdf", "application/pdf", 247533],
  ["1vHCwlc-j2WVM9H4xDngJvCs8oDx2xMOb", "Passport_Photo_File_20260526_084736_611.jpg", "image/png", 228244]
].map((item, index) => ({
  getId: () => item[0],
  getName: () => item[1],
  getMimeType: () => item[2],
  getSize: () => item[3],
  getDateCreated: () => new Date(1780000000000 + index * 1000),
  getLastUpdated: () => new Date(1780001000000 + index * 1000),
  getParents: () => {
    let consumed = false;
    return {
      hasNext: () => !consumed,
      next: () => {
        consumed = true;
        return { getId: () => "11Uyp813DuF39yk5-dQj3JzCh1Q8frhGg" };
      }
    };
  }
}));

const fixtureRow = {
  ApplicantID: "FODE-26-002959",
  First_Name: "Keziah",
  Last_Name: "Waffi",
  Folder_Url: "https://drive.google.com/drive/folders/11Uyp813DuF39yk5-dQj3JzCh1Q8frhGg",
  Birth_ID_Passport_File: "https://drive.google.com/file/d/1APiWZve1hJLOTTuHbMAuIq9f471g4R7j/view",
  Latest_School_Report_File: [
    "https://drive.google.com/file/d/1TOWyeveMYjK2jcWDGtStHj0KGjM4slUx/view",
    "https://drive.google.com/file/d/1ph1oPdCTsBd6t8q98pn0o9fV0bPmrV7B/view",
    "https://drive.google.com/file/d/1Y638GeHnf1S4tvmGXzi58lnbNsnjccwO/view"
  ].join("\n"),
  Transfer_Certificate_File: "[]",
  Passport_Photo_File: "https://drive.google.com/file/d/1vHCwlc-j2WVM9H4xDngJvCs8oDx2xMOb/view",
  Fee_Receipt_File: "[]"
};

const fixtureFolder = {
  getName: () => "keziah_waffi_2026-05-25",
  getFiles: () => {
    let index = 0;
    return {
      hasNext: () => index < fixtureFiles.length,
      next: () => fixtureFiles[index++]
    };
  }
};

const clean = (value) => String(value == null ? "" : value).trim();
const context = {
  console,
  isFinite,
  CONFIG: {
    APPLICANT_ID_HEADER: "ApplicantID",
    WEBAPP_URL_STUDENT: "https://example.test/exec",
    DOC_FIELDS: [
      { label: "Birth Certificate / NID / Passport", file: "Birth_ID_Passport_File", required: true },
      { label: "Latest School Reports / Documents", file: "Latest_School_Report_File", required: true, multiple: true },
      { label: "Transfer Certificate (optional)", file: "Transfer_Certificate_File", required: false },
      { label: "Passport Size Colour Photo", file: "Passport_Photo_File", required: true },
      { label: "Admission Fee Payment Receipt", file: "Fee_Receipt_File", required: true }
    ]
  },
  SCHEMA: { FOLDER_URL: "Folder_Url" },
  clean_: clean,
  stringifyGsError_: (error) => String(error && error.message ? error.message : error),
  getCallerEmail_: () => "super@example.test",
  isAdmin_: () => true,
  requireSuperAdmin_: () => {},
  openDataSheet_: () => ({}),
  findRowByApplicantId_: () => 50,
  getRowObject_: () => fixtureRow,
  folderIdFromUrl_: (url) => (String(url).match(/\/folders\/([\w-]+)/) || [])[1] || "",
  normalizeToUrlList_: (value) => String(value || "").split(/\r?\n|,/).map(clean).filter((url) => /^https?:/.test(url)),
  extractDriveFileId_: (url) => (String(url).match(/\/d\/([\w-]+)/) || [])[1] || "",
  DriveApp: { getFolderById: () => fixtureFolder },
  getPortalSecretForApplicant_: () => ({ found: true, secret: "test-secret" }),
  getExecUrl_: () => "https://example.test/exec",
  buildTokenGatedFileUrl_: (base, applicantId, secret, field, mode) =>
    `${base}?view=file&mode=${mode}&id=${applicantId}&s=${secret}&field=${field}`
};

vm.createContext(context);
vm.runInContext(implementationSource, context);

let unauthorizedSheetReads = 0;
let unauthorizedDriveReads = 0;
context.requireSuperAdmin_ = () => { throw new Error("Access denied: SUPER admin required"); };
context.openDataSheet_ = () => { unauthorizedSheetReads += 1; return {}; };
context.DriveApp = {
  getFolderById: () => {
    unauthorizedDriveReads += 1;
    return fixtureFolder;
  }
};
const unauthorized = context.admin_getApplicantDocumentManifest({ applicantId: "FODE-26-002959" });
assert.equal(unauthorized.ok, false);
assert.equal(unauthorized.code, "ACCESS_DENIED");
assert.equal(unauthorizedSheetReads, 0);
assert.equal(unauthorizedDriveReads, 0);

context.requireSuperAdmin_ = () => {};
context.openDataSheet_ = () => ({});
context.DriveApp = { getFolderById: () => fixtureFolder };

const result = context.admin_getApplicantDocumentManifest({ applicantId: "FODE-26-002959" });
assert.equal(result.ok, true);
assert.equal(result.folderId, "11Uyp813DuF39yk5-dQj3JzCh1Q8frhGg");
assert.equal(result.folderName, "keziah_waffi_2026-05-25");
assert.equal(result.files.length, 5);
assert.equal(result.files.filter((file) => file.sourceField).length, 5);
assert.equal(result.files.filter((file) => file.sourceField === "Latest_School_Report_File").length, 3);
assert.equal(
  JSON.stringify(Array.from(result.missingExpected, (item) => item.sourceField)),
  JSON.stringify(["Fee_Receipt_File"])
);
assert.equal(
  JSON.stringify([...new Set(Array.from(result.files, (file) => file.mimeType))].sort()),
  JSON.stringify(["application/pdf", "image/png"])
);

const warningTypes = new Set([
  ...result.warnings.map((warning) => warning.code),
  ...result.files.flatMap((file) => file.warnings.map((warning) => warning.code))
]);
assert.equal(warningTypes.has("MIME_EXTENSION_MISMATCH"), true);
assert.equal(warningTypes.has("FILE_SPECIFIC_PROXY_UNAVAILABLE"), true);

const schoolReports = result.files.filter((file) => file.sourceField === "Latest_School_Report_File");
assert.equal(schoolReports.every((file) => !file.openUrl && !file.downloadUrl), true);
assert.equal(
  JSON.stringify(Array.from(result.files).filter((file) => file.previewEligible).map((file) => file.sourceField)),
  JSON.stringify(["Passport_Photo_File"])
);
assert.equal(
  JSON.stringify(result).includes("drive.google.com/file/d/"),
  false,
  "Manifest must not expose raw Drive evidence URLs"
);

console.log("PASS static/source validation");
console.log("PASS Super Admin authorization boundary");
console.log("PASS no writes, sends, cache, Script Properties, byte reads, or withEnvelope_");
console.log("PASS fixture FODE-26-002959");
console.log(JSON.stringify({
  folderId: result.folderId,
  folderName: result.folderName,
  fileCount: result.files.length,
  mappedCount: result.files.filter((file) => file.sourceField).length,
  schoolReportCount: schoolReports.length,
  missingExpected: result.missingExpected.map((item) => item.sourceField),
  mimeTypes: [...new Set(result.files.map((file) => file.mimeType))].sort(),
  warningTypes: [...warningTypes].sort()
}, null, 2));
