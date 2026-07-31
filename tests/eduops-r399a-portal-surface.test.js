const assert = require("assert");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const adapter = read("EduOps_FODE_Adapter.js");
const workbench = read("EduOps_ClientWorkbench.html");
const code = read("Code.js");

assert.match(adapter, /portalUrl:\s*portal\.available === true \? eduopsClean_\(portal\.portalUrl \|\| ""\) : ""/, "portal URL must remain applicant-bound and available only from the active authority projection");
assert.match(workbench, /data-portal-open/, "Portal tab must expose the existing applicant-bound portal action");
assert.match(workbench, /window\.open\(portalUrl, "_blank", "noopener,noreferrer"\)/, "portal action must open the server-resolved URL without adding a new RPC");
assert.match(workbench, /Student portal is unavailable for this applicant/, "portal action must fail closed when the URL is absent");
assert.match(code, /function resolveExistingStudentPortalAuthority_[\s\S]*buildPortalCommunicationUrl_\(id, secretPlain\)/, "portal URL must use the existing protected authority resolver");
assert.doesNotMatch(workbench, /secretPlain|PortalTokenHash|PortalSecrets/, "protected token and store fields must not be rendered in the client");

console.log("eduops-r399a-portal-surface: PASS");
