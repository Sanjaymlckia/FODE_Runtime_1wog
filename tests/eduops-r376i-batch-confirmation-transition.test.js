const assert = require("node:assert/strict");
const fs = require("node:fs");

const source = fs.readFileSync("EduOps_ClientBatch.html", "utf8");

function extractFunction(name) {
  const start = source.indexOf(`function ${name}(`);
  assert.notEqual(start, -1, `${name} must exist`);
  const brace = source.indexOf("{", start);
  let depth = 0;
  for (let index = brace; index < source.length; index += 1) {
    if (source[index] === "{") depth += 1;
    if (source[index] === "}" && --depth === 0) return source.slice(start, index + 1);
  }
  throw new Error(`${name} is not closed`);
}

const execute = extractFunction("execute");
assert.match(source, /data-batch-execute disabled[^>]*>Bulk send prohibited</, "Batch footer must display a disabled prohibition control");
assert.match(execute, /BATCH_SEND_PROHIBITED/, "Batch execute action must return the terminal prohibition");
assert.match(execute, /gmailPathEntered:\s*false[\s\S]*recipientsSent:\s*0/, "Batch prohibition must prove no delivery path entry");
assert.doesNotMatch(execute, /eduops_executeCommand|openConfirm|BATCH_CONFIRMATION_/, "retired confirmation and execution transitions must be absent");
assert.doesNotMatch(source, /GmailApp|MailApp|sendEmail|sendApplicantMessage_/, "client must not introduce a Gmail-capable path");

console.log("PASS R376I retired Batch confirmation is visibly and terminally prohibited");
