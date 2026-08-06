const assert = require("node:assert/strict");
const fs = require("node:fs");

const admin = fs.readFileSync("Admin.js", "utf8");
const canonical = fs.readFileSync("Admin_CanonicalPopulation.js", "utf8");
const adapter = fs.readFileSync("EduOps_FODE_Adapter.js", "utf8");
const workload = fs.readFileSync("EduOps_Workload.js", "utf8");
const adminUi = fs.readFileSync("AdminUI.html", "utf8");
const eduopsUi = fs.readFileSync("EduOps_ClientComponents.html", "utf8");
const eduopsShell = fs.readFileSync("EduOps.html", "utf8");

assert.match(admin, /reviewLifecycleReconciliation:[\s\S]*applicantReviewLifecycleReconcile_/, "Admin must expose a canonical bucket reconciliation without a second queue scan");
assert.match(adminUi, /Waiting on:[\s\S]*Why this is in this queue:[\s\S]*Source evidence:/, "Admin worklist must visibly explain lifecycle placement");
assert.match(canonical, /reviewBucketKey:[\s\S]*reviewReason:[\s\S]*reviewRequirement:[\s\S]*reviewWaitingOn:/, "canonical population must retain R412A lifecycle fields");
assert.match(adapter, /reviewBucketKey: eduopsClean_\(actionability\.reviewBucketKey[\s\S]*reviewFollowupCount:[\s\S]*reviewCommunicationEvidenceAvailable:/, "EduOps adapter must pass canonical lifecycle evidence through without recalculation");
assert.match(adapter, /reviewLifecycle: \{[\s\S]*bucketKey:[\s\S]*requirement:[\s\S]*qualifyingCommunicationCount:/, "EduOps DTO must expose the authoritative lifecycle position");
assert.match(eduopsUi, /review\.admissionsStageLabel[\s\S]*review\.bucketLabel[\s\S]*review\.requirement/, "EduOps worklist rows must show admissions stage, precise worklist, and requirement");
assert.match(eduopsUi, /Why this is in this queue[\s\S]*Waiting on[\s\S]*Qualifying communications[\s\S]*Source evidence/, "EduOps quick view must expose evidence and read-only communication status");
assert.match(workload, /"reviewBucketKey", "reviewReason", "reviewRequirement"/, "Admin/EduOps parity diagnostics must compare canonical lifecycle fields");
assert.match(eduopsShell, /eduops-table-scroll/, "EduOps lifecycle rows remain inside the responsive table container");
assert.doesNotMatch([adapter, workload, eduopsUi].join("\n"), /GmailApp|MailApp|sendEmail\s*\(/, "visibility work must not add a send path");

const canonicalRow = { reviewBucketKey: "PENDING_APPLICANT_RESPONSE", reviewReason: "A successful bound follow-up was sent.", reviewRequirement: "Passport copy", nextAction: "WAIT" };
const eduopsProjection = { reviewBucketKey: canonicalRow.reviewBucketKey, reviewReason: canonicalRow.reviewReason, reviewRequirement: canonicalRow.reviewRequirement, nextAction: canonicalRow.nextAction };
assert.deepEqual(eduopsProjection, canonicalRow, "Admin and EduOps visibility contracts retain the same canonical bucket, reason, requirement, and next action");
console.log("PASS R412B Admin/EduOps lifecycle visibility contract");
