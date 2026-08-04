const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");

const adminUi = read("AdminUI.html");
const eduOps = read("EduOps.html");
const eduOpsStyles = read("EduOps_Styles.html");
const eduOpsWorkload = read("EduOps_Workload.js");
const code = read("Code.js");

assert.match(adminUi, /WEBAPP_URL_ADMIN[^\n]+\?view=eduops[^\n]+EduOps workspace/, "Admin must expose the canonical EduOps workspace route");
assert.match(eduOps, /class="eduops-admin-workspace-link"[^>]+href="<\?= ADMIN_URL \?>\?view=admin"[^>]*>Admin workspace<\/a>/, "EduOps must expose the Admin specialist workspace route");
assert.match(eduOpsWorkload, /t\.ADMIN_URL = clean_\(CONFIG\.WEBAPP_URL_ADMIN \|\| CONFIG\.WEBAPP_URL \|\| ""\);/, "EduOps Admin navigation must come from canonical server configuration");
assert.match(code, /if \(route === "eduops"\) return renderEduOpsApp_;/, "EduOps route must remain server-routed");
assert.match(code, /if \(route === "admin"\) return renderAdminApp_;/, "Admin route must remain server-routed");
assert.match(eduOpsStyles, /@media \(max-width: 900px\)[\s\S]*?\.eduops-global-search-strip \.eduops-global-search \{ grid-template-columns: minmax\(0, 1fr\) auto; \}/, "The dual-surface link must retain a bounded 390px layout");
assert.doesNotMatch(adminUi + eduOps, /FODE-26-003241[^\n]+href=|href=[^\n]+FODE-26-003241/, "Cross-surface navigation must not transport or substitute an applicant identity");
assert.doesNotMatch(adminUi + eduOps, /google\.script\.run[^\n]+(?:send|prepare|reconcile)/i, "Navigation links must not invoke communication or mutation RPCs");

console.log("PASS R408 Admin/EduOps dual working-surface navigation and mobile route contract");
