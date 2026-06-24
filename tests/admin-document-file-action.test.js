const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const vm = require("node:vm");

const adminSource = fs.readFileSync("Admin.js", "utf8");
const routesSource = fs.readFileSync("Routes.js", "utf8");
const utilsSource = fs.readFileSync("Utils.js", "utf8");

function extractFunction(source, name) {
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

const adminFunctions = [
  "adminDocumentFileActionField_",
  "adminResolveApplicantDocumentFile_",
  "admin_getApplicantDocumentImageRendition",
  "admin_getApplicantDocumentFileAction"
].map((name) => extractFunction(adminSource, name)).join("\n\n");

const utilityFunctions = [
  "stringifyGsError_",
  "documentFileActionSignaturePayload_",
  "signDocumentFileAction_",
  "constantTimeStringEquals_",
  "verifyDocumentFileActionSignature_",
  "buildSignedDocumentFileActionUrl_"
].map((name) => extractFunction(utilsSource, name)).join("\n\n");

const routeFunction = extractFunction(routesSource, "doGet_file_");
const adminFunction = extractFunction(adminSource, "admin_getApplicantDocumentFileAction");
const renditionFunction = extractFunction(adminSource, "admin_getApplicantDocumentImageRendition");
const resolverFunction = extractFunction(adminSource, "adminResolveApplicantDocumentFile_");
assert.ok(
  adminFunction.indexOf("requireDocumentVerifier_(adminEmail)") < adminFunction.indexOf("adminResolveApplicantDocumentFile_(payload)"),
  "Document verifier authorization must precede file-action resolver access"
);
assert.ok(
  renditionFunction.indexOf("requireDocumentVerifier_(adminEmail)") < renditionFunction.indexOf("adminResolveApplicantDocumentFile_(payload)"),
  "Document verifier authorization must precede image-rendition resolver access"
);
assert.match(resolverFunction, /openDataSheet_\(\)/, "Private resolver must perform Sheet lookup after public verifier gates");
assert.match(resolverFunction, /DriveApp\.getFileById/, "Private resolver must perform Drive lookup after public verifier gates");
const routeSignatureCheck = routeFunction.indexOf("verifyDocumentFileActionSignature_");
assert.ok(routeSignatureCheck >= 0, "Signed route verification must exist");
assert.ok(
  routeSignatureCheck < routeFunction.indexOf("getWorkingSpreadsheet_()"),
  "Signed action verification must precede applicant Sheet access"
);

for (const pattern of [
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
  "createFile(",
  "createFolder("
]) {
  assert.equal(adminFunctions.includes(pattern), false, `Forbidden Admin contract side effect: ${pattern}`);
}

const applicantId = "FODE-26-002959";
const folderId = "11Uyp813DuF39yk5-dQj3JzCh1Q8frhGg";
const fileIds = {
  birth: "1APiWZve1hJLOTTuHbMAuIq9f471g4R7j",
  report0: "1TOWyeveMYjK2jcWDGtStHj0KGjM4slUx",
  report1: "1ph1oPdCTsBd6t8q98pn0o9fV0bPmrV7B",
  report2: "1Y638GeHnf1S4tvmGXzi58lnbNsnjccwO",
  photo: "1vHCwlc-j2WVM9H4xDngJvCs8oDx2xMOb"
};
const driveUrl = (id) => `https://drive.google.com/file/d/${id}/view`;
const row = {
  ApplicantID: applicantId,
  Folder_Url: `https://drive.google.com/drive/folders/${folderId}`,
  Birth_ID_Passport_File: driveUrl(fileIds.birth),
  Latest_School_Report_File: [
    driveUrl(fileIds.report0),
    driveUrl(fileIds.report1),
    driveUrl(fileIds.report2)
  ].join("\n"),
  Passport_Photo_File: driveUrl(fileIds.photo)
};
const clean = (value) => String(value == null ? "" : value).trim();
const fileMime = {
  [fileIds.birth]: "application/pdf",
  [fileIds.report0]: "application/pdf",
  [fileIds.report1]: "application/pdf",
  [fileIds.report2]: "application/pdf",
  [fileIds.photo]: "image/jpeg"
};
let parentOverride = folderId;
const fileForId = (id) => ({
  getId: () => id,
  getName: () => id === fileIds.photo ? "Passport_Photo_File_20260621.jpg" : "document.pdf",
  getMimeType: () => fileMime[id] || "application/octet-stream",
  getSize: () => 1024,
  getBlob: () => ({
    getAs: (mime) => ({
      getBytes: () => mime === "image/png" ? [137, 80, 78, 71] : [1, 2, 3],
      getContentType: () => mime
    }),
    getBytes: () => [255, 216, 255],
    getContentType: () => fileMime[id] || "application/octet-stream"
  }),
  getParents: () => {
    let consumed = false;
    return {
      hasNext: () => !consumed,
      next: () => {
        consumed = true;
        return { getId: () => parentOverride };
      }
    };
  }
});
const utilities = {
  computeHmacSha256Signature: (payload, secret) =>
    Array.from(crypto.createHmac("sha256", secret).update(payload).digest()),
  base64Encode: (bytes) => Buffer.from(bytes).toString("base64"),
  base64EncodeWebSafe: (bytes) =>
    Buffer.from(bytes).toString("base64").replace(/\+/g, "-").replace(/\//g, "_")
};

let sheetReads = 0;
let driveReads = 0;
const context = {
  console,
  Date,
  isFinite,
  Math,
  Utilities: utilities,
  CONFIG: {
    APPLICANT_ID_HEADER: "ApplicantID",
    WEBAPP_URL_STUDENT: "https://student.example/exec",
    DOC_FIELDS: [
      { label: "Birth Certificate / NID / Passport", file: "Birth_ID_Passport_File" },
      { label: "Latest School Reports / Documents", file: "Latest_School_Report_File", multiple: true },
      { label: "Passport Size Colour Photo", file: "Passport_Photo_File" }
    ]
  },
  SCHEMA: { FOLDER_URL: "Folder_Url" },
  clean_: clean,
  getCallerEmail_: () => "super@example.test",
  isAdmin_: () => true,
  requireSuperAdmin_: () => {},
  requireDocumentVerifier_: () => {},
  openDataSheet_: () => {
    sheetReads += 1;
    return {};
  },
  getRowObject_: () => row,
  folderIdFromUrl_: (url) => (String(url).match(/\/folders\/([\w-]+)/) || [])[1] || "",
  normalizeToUrlList_: (value) => String(value || "").split(/\r?\n|,/).map(clean).filter(Boolean),
  extractDriveFileId_: (url) => (String(url).match(/\/d\/([\w-]+)/) || [])[1] || "",
  DriveApp: {
    getFileById: (id) => {
      driveReads += 1;
      return fileForId(id);
    }
  },
  isFileInFolderChain_: (file, expectedFolderId) => {
    const parents = file.getParents();
    while (parents.hasNext()) {
      if (parents.next().getId() === expectedFolderId) return true;
    }
    return false;
  },
  getPortalSecretForApplicant_: () => ({ secret: "server-only-secret" })
};
vm.createContext(context);
vm.runInContext(`${utilityFunctions}\n\n${adminFunctions}`, context);

context.requireDocumentVerifier_ = () => { throw new Error("denied"); };
const denied = context.admin_getApplicantDocumentFileAction({
  rowNumber: 50,
  applicantId,
  sourceField: "Birth_ID_Passport_File",
  itemIndex: 0
});
assert.equal(denied.code, "ACCESS_DENIED");
assert.equal(sheetReads, 0);
assert.equal(driveReads, 0);
context.requireDocumentVerifier_ = () => {};

function request(sourceField, itemIndex, overrides = {}) {
  return context.admin_getApplicantDocumentFileAction({
    rowNumber: 50,
    applicantId,
    sourceField,
    itemIndex,
    ...overrides
  });
}

const single = request("Birth_ID_Passport_File", 0);
assert.equal(single.ok, true);
assert.equal(single.itemIndex, 0);
assert.equal(new URL(single.downloadUrl).searchParams.get("idx"), "0");

const reports = [0, 1, 2].map((index) => request("Latest_School_Report_File", index));
assert.equal(reports.every((result) => result.ok), true);
assert.deepEqual(
  reports.map((result) => new URL(result.downloadUrl).searchParams.get("idx")),
  ["0", "1", "2"]
);
assert.equal(new Set(reports.map((result) => result.downloadUrl)).size, 3);

assert.equal(request("Latest_School_Report_File", 3).code, "ITEM_INDEX_OUT_OF_RANGE");
assert.equal(request("Unknown_File", 0).code, "INVALID_SOURCE_FIELD");
assert.equal(request("Birth_ID_Passport_File", 0, { applicantId: "FODE-26-999999" }).code, "APPLICANT_CONTEXT_MISMATCH");

parentOverride = "wrong-folder";
assert.equal(request("Birth_ID_Passport_File", 0).code, "DOCUMENT_SOURCE_MISMATCH");
parentOverride = folderId;

const dtoText = JSON.stringify(single);
for (const sensitive of [
  folderId,
  fileIds.birth,
  driveUrl(fileIds.birth),
  "server-only-secret"
]) {
  assert.equal(dtoText.includes(sensitive), false, `DTO must not contain ${sensitive}`);
}
assert.equal(dtoText.includes("drive.google.com"), false);
assert.equal(single.sourceField, "Birth_ID_Passport_File");
assert.equal(single.mimeType, "application/pdf");

const imageRendition = context.admin_getApplicantDocumentImageRendition({
  rowNumber: 50,
  applicantId,
  sourceField: "Passport_Photo_File",
  itemIndex: 0
});
assert.equal(imageRendition.ok, true);
assert.equal(imageRendition.renditionMimeType, "image/png");
assert.equal(imageRendition.renditionStorage, "transient-data-url");
assert.equal(imageRendition.stalePolicy, "regenerate-on-request");
assert.match(imageRendition.dataUrl, /^data:image\/png;base64,/);
const imageRenditionDto = JSON.stringify(imageRendition);
for (const sensitive of [
  folderId,
  fileIds.photo,
  driveUrl(fileIds.photo),
  "server-only-secret",
  "drive.google.com"
]) {
  assert.equal(imageRenditionDto.includes(sensitive), false, `Rendition DTO must not contain ${sensitive}`);
}
const pdfRendition = context.admin_getApplicantDocumentImageRendition({
  rowNumber: 50,
  applicantId,
  sourceField: "Birth_ID_Passport_File",
  itemIndex: 0
});
assert.equal(pdfRendition.code, "UNSUPPORTED_RENDITION_TYPE");

const routeContext = {
  ...context,
  Session: {
    getEffectiveUser: () => ({ getEmail: () => "" }),
    getActiveUser: () => ({ getEmail: () => "" })
  },
  Logger: { log: () => {} },
  newDebugId_: () => "DBG-TEST",
  htmlOutput_: (html) => ({ html }),
  renderFileProxyMessageHtml_: (message) => `MESSAGE:${message}`,
  renderFileProxyBlobHtml_: (_b64, _mime, _name, mode) => `BLOB:${mode}`,
  safeFileName_: (name) => name,
  getWorkingSpreadsheet_: () => {
    sheetReads += 1;
    return {};
  },
  mustGetDataSheet_: () => ({}),
  findRowByApplicantId_: () => 50,
  findPortalRowByIdSecret_: () => null,
  getFileBlobByUrlOrId_: (rawValue) => {
    routeContext.selectedRawValue = rawValue;
    return {
      ok: true,
      fileId: context.extractDriveFileId_(rawValue),
      fileName: "document.pdf",
      mimeType: "application/pdf",
      blob: {
        getBytes: () => [1, 2, 3],
        getName: () => "document.pdf",
        getContentType: () => "application/pdf"
      }
    };
  },
  selectedRawValue: ""
};
vm.createContext(routeContext);
vm.runInContext(`${utilityFunctions}\n\n${routeFunction}`, routeContext);

function eventFromUrl(url) {
  const parsed = new URL(url);
  return { parameter: Object.fromEntries(parsed.searchParams.entries()) };
}

sheetReads = 0;
routeContext.selectedRawValue = "";
const routeResult = routeContext.doGet_file_(eventFromUrl(reports[1].downloadUrl));
assert.equal(routeResult.html, "BLOB:download");
assert.equal(routeContext.selectedRawValue, driveUrl(fileIds.report1));

const tampered = new URL(reports[1].downloadUrl);
tampered.searchParams.set("idx", "2");
sheetReads = 0;
const tamperedResult = routeContext.doGet_file_(eventFromUrl(tampered.toString()));
assert.match(tamperedResult.html, /Invalid or expired file action/);
assert.equal(sheetReads, 0, "Tampered signature must fail before applicant Sheet access");

parentOverride = "wrong-folder";
const wrongFolderResult = routeContext.doGet_file_(eventFromUrl(single.downloadUrl));
assert.match(wrongFolderResult.html, /File unavailable/);

console.log("PASS authorization before Sheet/Drive access");
console.log("PASS single-file itemIndex 0");
console.log("PASS multi-file itemIndex 0, 1, 2 distinct");
console.log("PASS invalid index, field, applicant context, and folder membership");
console.log("PASS signed route tamper resistance");
console.log("PASS image rendition uses verifier/applicant/source/item authority without exposing Drive IDs");
console.log("PASS sanitized DTO contains no Drive IDs, raw URLs, folder IDs, or secrets");
console.log("PASS no Admin contract writes, sends, cache/properties mutation, or audit logging");
