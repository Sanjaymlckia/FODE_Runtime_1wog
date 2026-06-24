const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");

const source = fs.readFileSync("Code.js", "utf8");

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

const implementationSource = [
  "describeDocFieldPayloadShape_",
  "summarizeDocFieldPayloadShapes_",
  "shouldLogEmptyDocumentPayloadWarning_",
  "canonicalizeFdIntakeFiles_"
].map(extractFunction).join("\n\n");

const clean = (value) => String(value == null ? "" : value).trim();

function normalizeToUrlList(value) {
  if (Array.isArray(value)) {
    return value.map(clean).filter((url) => /^https?:/i.test(url));
  }
  const raw = clean(value);
  if (!raw || raw === "[]") return [];
  return raw.split(/\r?\n|,/).map(clean).filter((url) => /^https?:/i.test(url));
}

function makeContext(options = {}) {
  const events = [];
  const filesCreated = [];
  const previewCalls = [];
  const folder = {
    getId: () => "folder-123",
    getUrl: () => "https://drive.google.com/drive/folders/folder-123",
    createFile: (blob) => {
      const fileId = `file-${filesCreated.length + 1}`;
      const fileName = blob.getName();
      const file = {
        getId: () => fileId,
        getUrl: () => `https://drive.google.com/file/d/${fileId}/view`,
        getMimeType: () => "application/pdf",
        getName: () => fileName,
        getSize: () => 1024,
        setName: () => {}
      };
      filesCreated.push({ fileId, fileName });
      return file;
    }
  };

  const context = {
    console,
    CONFIG: {
      DOC_FIELDS: [
        { file: "Birth_ID_Passport_File" },
        { file: "Latest_School_Report_File" },
        { file: "Transfer_Certificate_File" },
        { file: "Passport_Photo_File" },
        { file: "Fee_Receipt_File" }
      ]
    },
    clean_: clean,
    normalizeToUrlList_: normalizeToUrlList,
    appendLog_: (current, line) => (current ? `${current}\n${line}` : line),
    logActivation_: (_sheet, label, payload) => {
      events.push({ label, payload });
    },
    logS4aOutboundTrace_: () => {},
    redactUrlForLog_: (url) => url,
    UrlFetchApp: {
      fetch: (url) => ({
        getResponseCode: () => 200,
        getBlob: () => {
          let blobName = "source.pdf";
          return {
            getContentType: () => "application/pdf",
            getName: () => blobName,
            setName: (name) => {
              blobName = name;
            }
          };
        }
      })
    },
    Utilities: {
      formatDate: () => "20260621_180654_000"
    },
    Session: {
      getScriptTimeZone: () => "Pacific/Port_Moresby"
    },
    fileExtensionFromContentType_: (type) => (type === "application/pdf" ? "pdf" : ""),
    fileExtensionFromUrl_: (url) => (String(url).match(/\.([a-z0-9]+)(?:$|\?)/i) || [])[1] || "",
    fileExtensionFromName_: (name) => (String(name).match(/\.([a-z0-9]+)$/i) || [])[1] || "",
    adminDocumentGalleryPrepareStoredRendition_: (resolved) => {
      if (options.previewThrows) throw new Error("preview failed");
      previewCalls.push({
        applicantId: resolved.applicantId,
        sourceField: resolved.sourceField,
        itemIndex: resolved.itemIndex,
        fileId: resolved.file.getId()
      });
      return {
        ok: true,
        renditionKind: "pdf-first-page-png",
        renditionFileName: `${resolved.applicantId}__FODE_PREVIEW__${resolved.sourceField}__item${resolved.itemIndex}__test.png`,
        generated: true
      };
    }
  };

  vm.createContext(context);
  vm.runInContext(implementationSource, context);
  return { context, events, folder, filesCreated, previewCalls };
}

const emptyCase = makeContext();
const emptyPayload = {
  ApplicantID: "FODE-26-003157",
  FormID: "31951943",
  File_Log: "",
  Birth_ID_Passport_File: "[]",
  Latest_School_Report_File: "[]",
  Transfer_Certificate_File: "[]",
  Passport_Photo_File: "[]",
  Fee_Receipt_File: "[]"
};
const emptyResult = emptyCase.context.canonicalizeFdIntakeFiles_(emptyPayload, emptyCase.folder, {}, {
  correlationId: "238943",
  applicantId: "FODE-26-003157"
});
const emptyWarning = emptyCase.events.find((event) => event.label === "ACTIVATION_FILE_PAYLOAD_EMPTY_WARNING");
assert.ok(emptyWarning, "003157-style empty payload should emit warning");
assert.equal(emptyWarning.payload.usableUrlCount, 0);
assert.equal(emptyWarning.payload.canonicalizedFileCount, 0);
assert.equal(emptyWarning.payload.allConfiguredFieldsPresent, true);
assert.equal(emptyWarning.payload.rawValueShapeSummary.Latest_School_Report_File, "[]");
assert.equal(emptyWarning.payload.recommendedOperatorAction.includes("resend/upload documents"), true);
assert.equal(emptyCase.filesCreated.length, 0);
assert.equal(emptyResult.File_Log, "");

const successCase = makeContext();
const successPayload = {
  ApplicantID: "FODE-26-003158",
  FormID: "31955456",
  File_Log: "",
  Birth_ID_Passport_File: "[]",
  Latest_School_Report_File: "https://formdesigner.pro/attach/files/121471/9425960/Latest_School_Report_File_20260526_084727_744.pdf",
  Transfer_Certificate_File: "[]",
  Passport_Photo_File: "[]",
  Fee_Receipt_File: "[]"
};
const successResult = successCase.context.canonicalizeFdIntakeFiles_(successPayload, successCase.folder, {}, {
  correlationId: "238944",
  applicantId: "FODE-26-003158"
});
assert.equal(
  successCase.events.some((event) => event.label === "ACTIVATION_FILE_PAYLOAD_EMPTY_WARNING"),
  false,
  "003158-style payload with usable URL must not emit empty warning"
);
assert.equal(
  successCase.events.some((event) => event.label === "ACTIVATION_FILE_CANONICALIZED"),
  true,
  "Usable URL must still canonicalize normally"
);
assert.match(successResult.Latest_School_Report_File, /https:\/\/drive\.google\.com\/file\/d\/file-1\/view/);
assert.match(successResult.File_Log, /fetched_and_copied/);
assert.deepEqual(successCase.previewCalls, [{
  applicantId: "FODE-26-003158",
  sourceField: "Latest_School_Report_File",
  itemIndex: 0,
  fileId: "file-1"
}], "Successful canonical copy should attempt applicant-folder preview generation");
assert.equal(
  successCase.events.some((event) => event.label === "ACTIVATION_FILE_PREVIEW_RENDITION_READY"),
  true,
  "Successful preview hook should log non-fatal preview readiness"
);

const missingFieldCase = makeContext();
const missingFieldPayload = {
  ApplicantID: "FODE-26-003159",
  File_Log: "",
  Birth_ID_Passport_File: "[]",
  Latest_School_Report_File: "[]",
  Transfer_Certificate_File: "[]",
  Passport_Photo_File: "[]"
};
missingFieldCase.context.canonicalizeFdIntakeFiles_(missingFieldPayload, missingFieldCase.folder, {}, {
  correlationId: "238945",
  applicantId: "FODE-26-003159"
});
assert.equal(
  missingFieldCase.events.some((event) => event.label === "ACTIVATION_FILE_PAYLOAD_EMPTY_WARNING"),
  false,
  "Warning should require configured document fields to be present"
);

console.log("PASS empty payload warning for 003157-style case");
console.log("PASS no empty payload warning for 003158-style canonicalized case");
console.log("PASS missing configured field does not trigger warning");

const previewFailureCase = makeContext({ previewThrows: true });
const previewFailureResult = previewFailureCase.context.canonicalizeFdIntakeFiles_(successPayload, previewFailureCase.folder, {}, {
  correlationId: "238946",
  applicantId: "FODE-26-003158"
});
assert.match(previewFailureResult.Latest_School_Report_File, /https:\/\/drive\.google\.com\/file\/d\/file-1\/view/);
assert.match(previewFailureResult.File_Log, /fetched_and_copied/);
assert.equal(
  previewFailureCase.events.some((event) => event.label === "ACTIVATION_FILE_PREVIEW_RENDITION_SKIP"),
  true,
  "Preview generation failure should be logged without blocking canonicalization"
);
console.log("PASS preview generation failure is non-fatal to canonicalization");
