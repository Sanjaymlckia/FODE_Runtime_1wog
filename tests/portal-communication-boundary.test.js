const assert = require("assert");
const fs = require("fs");
const path = require("path");

const repoRoot = process.cwd();
const codeSource = fs.readFileSync(path.join(repoRoot, "Code.js"), "utf8");
const adminSource = fs.readFileSync(path.join(repoRoot, "Admin.js"), "utf8");
const compatibilityDoc = fs.readFileSync(path.join(repoRoot, "docs", "architecture", "Compatibility_Shim_Register.md"), "utf8");
const retirementDoc = fs.readFileSync(path.join(repoRoot, "docs", "architecture", "Legacy_Retirement_Register.md"), "utf8");
const commModelDoc = fs.readFileSync(path.join(repoRoot, "docs", "architecture", "Communication_Model.md"), "utf8");

assert.match(codeSource, /function portalCommunicationMessageType_\(\)\s*\{\s*return "legacy_invite";\s*\}/, "Portal Communication compatibility alias must resolve to legacy_invite");
assert.match(codeSource, /function isPortalCommunicationMessageType_\(messageType\)/, "Portal Communication classifier must exist");
assert.match(codeSource, /function resolvePortalCommunicationSecret_\(applicantId\)\s*\{\s*return getActivePortalSecretForCampaign_\(applicantId\);\s*\}/, "Canonical portal communication secret lookup must delegate through the compatibility helper");
assert.match(codeSource, /function buildPortalCommunicationUrl_\(applicantId, secretPlain\)\s*\{\s*return buildLegacyCampaignPortalUrl_\(applicantId, secretPlain\);\s*\}/, "Canonical portal communication URL builder must delegate through the compatibility helper");
assert.match(codeSource, /function isHistoricalLegacyInviteBatchFilter_\(filterType\)\s*\{\s*return normalizeApplicantBatchFilterType_\(filterType\) === "legacy_invite_eligible";\s*\}/, "Historical batch filter classifier must exist");

assert.match(codeSource, /secretRes = resolvePortalCommunicationSecret_\(context\.applicantId\);/, "Runtime preview/send path must use the canonical Portal Communication secret adapter");
assert.match(codeSource, /context\.portalUrl = buildPortalCommunicationUrl_\(context\.applicantId, secretRes\.secretPlain\);/, "Runtime preview/send path must use the canonical Portal Communication URL adapter");
assert.match(codeSource, /if \(\(isPortalCommunicationMessageType_\(normalizedType\) \|\| normalizedType === "reminder"\) && context\.portalSubmittedActive\)/, "Portal submitted block must preserve current behavior through the canonical Portal Communication classifier");

assert.match(adminSource, /Historical Legacy Campaign compatibility wrapper\./, "Legacy invite batch planner must be explicitly classified as compatibility");
assert.match(adminSource, /Historical Legacy Campaign region\./, "Historical campaign helpers must be isolated in an explicit region");

assert.match(compatibilityDoc, /`legacy_invite` message key \| Compatibility alias \|/, "Compatibility register must classify legacy_invite as a compatibility alias");
assert.match(compatibilityDoc, /`legacy_invite_eligible` batch filter \| Compatibility shim \|/, "Compatibility register must classify legacy invite batch filtering as a shim");
assert.match(retirementDoc, /## Future Retirement Register/, "Legacy retirement register must include the future retirement section");
for (const symbol of [
  "admin_planLegacyInviteBatch()",
  "adminDryRunFirst50LegacyInvites()",
  "legacy_invite_eligible",
  "buildLegacyCampaignPortalUrl_() / getActivePortalSecretForCampaign_()"
]) {
  if (symbol === "buildLegacyCampaignPortalUrl_() / getActivePortalSecretForCampaign_()") {
    assert.ok(
      retirementDoc.includes("`buildLegacyCampaignPortalUrl_()` / `getActivePortalSecretForCampaign_()` names"),
      `${symbol} must appear in the future retirement register`
    );
    continue;
  }
  assert.ok(retirementDoc.includes(`\`${symbol}\``), `${symbol} must appear in the future retirement register`);
}
assert.match(commModelDoc, /## Portal Communication Boundary/, "Communication model must document the Portal Communication boundary");
assert.match(commModelDoc, /`legacy_invite` is a compatibility alias, not the architectural concept\./, "Communication model must freeze legacy_invite as a compatibility alias");

console.log("PASS portal communication boundary classification and compatibility freeze");
