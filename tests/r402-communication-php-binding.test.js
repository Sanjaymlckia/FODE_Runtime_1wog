const assert = require("node:assert/strict");
const fs = require("node:fs");

const repository = fs.readFileSync("services/communication-ledger/src/Ledger/Repository.php", "utf8");
const commandHandler = fs.readFileSync("services/communication-ledger/src/Commands/CommandHandler.php", "utf8");
const shadow = fs.readFileSync("CommunicationLedgerShadow.js", "utf8");
const admin = fs.readFileSync("Admin_SelectedApplicantCommunications.js", "utf8");

assert.match(repository, /insertCommunication\(\$communicationId,\$request\);\s*\$this->insertPreviewIfBound\(\$communicationId,\$request\);\s*\$this->insertOperation\(/, "Bound previews must be persisted before operations to satisfy the preview foreign key.");
assert.match(repository, /INSERT INTO previews/, "The PHP binding must create a durable preview record for a bound command.");
assert.match(repository, /\[REDACTED\]/, "Shadow preview persistence must not store recipient or message content.");
assert.match(repository, /previewFingerprint/, "The durable preview must retain the non-secret preview fingerprint.");
assert.match(shadow, /legacy\.technicalTimestamp \|\| legacy\.sentAt \|\| legacy\.recordedAt[\s\S]*preview\.ledgerRequestTimestamp \|\| preview\.createdAt/, "Shadow request identity must prefer a stable operation timestamp.");
assert.match(shadow, /commandType: "COMMUNICATION_PREPARE"/, "Individual sends must have a durable pre-send command.");
assert.match(shadow, /commandType: "COMMUNICATION_FINALIZE"/, "Individual sends must finalize the durable ledger after Gmail.");
assert.match(repository, /PRE_SEND_PREPARED/, "The ledger must record the pre-send state before Gmail.");
assert.match(repository, /GMAIL_SENT/, "The ledger must record the final Gmail state.");
assert.match(repository, /elseif \(!\$prepare\)/, "Preparation must not create an unrelated authorized-operation event.");
assert.match(repository, /DELIVERY_UNKNOWN/, "The ledger must represent uncertain delivery without false SENT.");
assert.match(admin, /fodeLedgerPrepareIndividual_\(identity/, "Admin must prepare the ledger before invoking Gmail.");
assert.match(admin, /var legacyResult = adminCommunicationWithIdentity_\(sendApplicantMessage_/, "Gmail must run only after ledger preparation.");
assert.match(admin, /fodeLedgerFinalizeIndividual_\(identity/, "Admin must finalize the ledger after the legacy Gmail result.");
assert.doesNotMatch(admin, /fodeLedgerShadowRecord_\(sendResult/, "The old post-send shadow path must not silently accept Gmail success.");
assert.match(admin, /LEDGER_FINALIZE_FAILED|LEDGER_FINALIZE_HELPER_UNAVAILABLE/, "Finalization failure must be visible as reconciliation-required.");
assert.match(shadow, /LEDGER_CORRELATION_MISMATCH/, "Accepted ledger responses with missing or mismatched correlation IDs must fail closed.");
assert.match(admin, /ledgerPayload\.communicationId = clean_\(prepared\.communicationId/, "Finalization must bind the communication ID returned by pre-send preparation.");
assert.match(repository, /\['eventId'\]\s*=\s*\$this->appendEvent/, "Pre-send and shadow acknowledgements must expose their durable event ID.");
assert.match(repository, /'eventId'=>\$eventId/, "Finalization must expose its durable event ID.");
assert.match(repository, /Receipt is not bound to the prepared operation/, "Finalization must reject an unbound receipt.");
assert.match(commandHandler, /COMMUNICATION_PREPARE|COMMUNICATION_FINALIZE/, "PHP command handling must validate communication correlation fields.");
assert.doesNotMatch(repository, /api_signing_secret|fixture-secret|portal-secret/i);
assert.doesNotMatch(shadow, /api_signing_secret|fixture-secret|portal-secret/i);

console.log("PASS R402 PHP binding contracts: preview-before-operation, redacted shadow preview persistence, stable request timestamp, and secret hygiene");
