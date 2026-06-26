const fs = require("node:fs");
const assert = require("node:assert/strict");

const adminSource = fs.readFileSync("Admin.js", "utf8");
const routesSource = fs.readFileSync("Routes.js", "utf8");
const adminUiSource = fs.readFileSync("AdminUI.html", "utf8");

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

const saveDocsUi = extractFunction(adminUiSource, "saveDocs");
const updateDocs = extractFunction(adminSource, "admin_updateDocStatuses_impl_");
const adminVerifyDocument = extractFunction(routesSource, "adminVerifyDocument");
const statusMapper = extractFunction(routesSource, "docStatusKeyToStoredValue_");
const verifiedCheck = extractFunction(routesSource, "isVerifiedDocStatusValue_");

assert.match(saveDocsUi, /statusField:\s*base\.statusField/, "Save payload must include the mapped status field");
assert.match(saveDocsUi, /commentField:\s*base\.commentField/, "Save payload must include the mapped comment field");
assert.match(saveDocsUi, /status,\s*comment/, "Save payload must include selected status and comment values");

assert.match(updateDocs, /NO_DOCUMENT_STATUS_FIELDS_WRITTEN/, "Backend must not report success when zero document fields are written");
assert.match(updateDocs, /documentStatuses:\s*refreshedDocStatuses/, "Save response must include refreshed status-field values");
assert.match(updateDocs, /documentStatusFields:\s*refreshedDocStatusFields/, "Save response must include refreshed document status DTOs");
assert.match(updateDocs, /changedFields:[\s\S]*previousStatus[\s\S]*newStatus/, "Save response must expose previous/new status fields for proof");
assert.match(updateDocs, /cols\.docsCompat[\s\S]*docStage === "Verified" \? "Yes" : ""/, "Document save must sync Docs_Verified when computed required documents are verified");
assert.match(updateDocs, /paymentVerified \? "Yes" : ""/, "Document save must not mark payment verified unless payment authority computes verified");

assert.match(statusMapper, /if \(key === "VERIFIED"\) return "Verified"/, "Route VERIFIED key must persist as UI-readable Verified");
assert.match(statusMapper, /if \(key === "REJECTED"\) return "Rejected"/, "Route REJECTED key must persist as UI-readable Rejected");
assert.match(statusMapper, /if \(key === "FRAUDULENT"\) return "Fraudulent"/, "Route FRAUDULENT key must persist as UI-readable Fraudulent");
assert.match(statusMapper, /return "Pending"/, "Route pending/default key must persist as UI-readable Pending");

assert.match(adminVerifyDocument, /var storedStatus = docStatusKeyToStoredValue_\(newStatus\)/, "adminVerifyDocument must derive a persisted UI status");
assert.match(adminVerifyDocument, /patch\[docMeta\.status\] = storedStatus/, "adminVerifyDocument must write the persisted UI status to the backing field");
assert.match(adminVerifyDocument, /isVerifiedDocStatusValue_\(st\)/, "Docs_Verified rollup must accept existing route-key and title-case verified values");
assert.match(adminVerifyDocument, /status: storedStatus/, "adminVerifyDocument response must report the persisted UI status");
assert.match(verifiedCheck, /docStatusKeyToStoredValue_\(value\) === "Verified"/, "Verified check must normalize mixed stored status conventions");

console.log("PASS document status save payload includes selected mapped fields");
console.log("PASS document status save rejects zero-write success");
console.log("PASS document status persistence stores UI-readable status values");
console.log("PASS document status save syncs Docs_Verified without marking payment verified");
