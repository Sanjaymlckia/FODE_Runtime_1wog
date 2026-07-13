# Temporary Capability Grants

Status: Track H1 live on Admin staging Apps Script `@373`, runtime `r340 / 340`. Schema migration completed on 2026-07-13 with zero grant records.

## Authority Boundary

Temporary grants extend the existing capability resolver. They do not create a role, mutate `CONFIG.ADMIN_ROLES`, or replace backend action gates.

Resolution order:

1. durable configured role;
2. role-default capabilities;
3. permanent account overrides;
4. active temporary capability grants;
5. backend action-specific authority and safety gates.

`resolveAdminCapabilities_()` remains the sole capability resolver. A browser capability snapshot is presentation only; backend actions re-resolve effective capabilities.

## Persistence Authority

| Concern | Authority |
| --- | --- |
| Current grant state | `Capability_Grants` Sheet tab |
| Immutable transition evidence | `Webhook_Log` through `logAudit_()` |
| Read acceleration | Script `CacheService`, never authority |
| Atomic state transition | `LockService.getScriptLock()` |
| Expiry time | Server time |

The workbook binding is explicit and independent of global `DATA_MODE`: `CONFIG.CAPABILITY_GRANTS_SPREADSHEET_CONFIG_KEY` points to the existing authoritative `CONFIG.SPREADSHEET_ID_PROD` value. `getCapabilityGrantsSpreadsheet_()` opens that ID directly. The grant module never calls `getWorkingSpreadsheet_()` and cannot accept a workbook ID from the browser.

The resolver fails closed for temporary grants if the tab is absent, inaccessible, or has invalid headers. Durable role capabilities remain available. The live `Capability_Grants` tab currently contains the exact schema header row and no grant records.

## Stable Schema

The `Capability_Grants` headers, in order, are:

1. `Grant_ID`
2. `Account_Email`
3. `Capability_Key`
4. `Grant_Type`
5. `Status`
6. `Granted_By_Email`
7. `Granted_By_Role`
8. `Granted_At`
9. `Starts_At`
10. `Expires_At`
11. `Reason`
12. `Scope_Type`
13. `Scope_Payload_JSON`
14. `Usage_Limit`
15. `Used_Count`
16. `Used_At`
17. `Revoked_By_Email`
18. `Revoked_At`
19. `Revocation_Reason`
20. `Created_Runtime_Identity`
21. `Updated_At`
22. `Record_Version`

H1 writes `TEMPORARY_CAPABILITY`, `ACCOUNT_CAPABILITY`, and statuses `ACTIVE`, `REVOKED`, `EXPIRED`, or `INVALIDATED`. Rows are never deleted. H2 exact-action approval statuses and fields are deferred.

## Delegation Policy

Maximum duration: 24 hours.

Delegable:

- `CAN_RUN_BATCH_COMMUNICATIONS`
- `CAN_SEND_INDIVIDUAL_EMAIL`
- `CAN_PREVIEW_APPLICANT_COMMUNICATION`
- `CAN_INSERT_PORTAL_LINK`
- `CAN_GENERATE_STANDARD_QUOTE`
- `CAN_GENERATE_STANDARD_INVOICE`
- `CAN_REVIEW_DOCUMENTS`
- `CAN_SAVE_DOCUMENT_STATUSES`

Non-delegable:

- `CAN_VERIFY_PAYMENT`
- `CAN_OVERRIDE_COOLDOWN`
- `CAN_APPROVE_FINANCIAL_OVERRIDE`
- `CAN_MANAGE_PORTAL_ACCESS`
- `CAN_MANAGE_ROLES`
- `CAN_ADMINISTER_RUNTIME`
- `CAN_DEPLOY_RUNTIME`
- `CAN_WRITE_ZOHO_BOOKS`

Only a configured `SUPER` account may create or revoke a grant. A grant to a `SUPER` target, unknown account, unknown capability, inherited capability, indefinite expiry, expired interval, duration over 24 hours, or overlapping active interval is rejected.

## Cache and Expiry

Active grants are cached per normalized account for at most 60 seconds and never beyond the nearest expiry. Create, revoke, schema creation, and expiry transitions invalidate relevant entries. Every cache read rechecks expiry against server time, so stale cache content cannot extend a grant.

An `ACTIVE` row whose expiry has passed is excluded immediately. Lazy status transition to `EXPIRED` is attempted under the script lock and logged. Failure to complete cleanup does not keep the capability active.

## Audit Contract

Events:

- `TEMP_CAPABILITY_GRANT_CREATED`
- `TEMP_CAPABILITY_GRANT_REVOKED`
- `TEMP_CAPABILITY_GRANT_EXPIRED`
- `TEMP_CAPABILITY_GRANT_REJECTED`
- `TEMP_CAPABILITY_GRANT_SCHEMA_CREATED`

Evidence includes actor, target, capability, grant ID, reason, interval, status transition, runtime identity, and result. If creation audit fails, the newly appended grant is invalidated so an unaudited grant cannot remain active.

## Migration and Rollback

Before migration, `admin_createCapabilityGrantPreMigrationBackup()` creates a private timestamped Drive folder containing:

- a complete Google Sheets workbook copy;
- a restorable Script Properties JSON artifact whose values are not returned to the browser;
- a sanitized manifest with commit, deployment pins, runtime identity, source/copy IDs, tab names, and property key/count verification.

The backup RPC requires `SUPER`, exact confirmation, commit hash, and Admin/Student deployment pins. The browser runner `tools/fode-h1-browser-rpc.js` has a fixed RPC allowlist and cannot invoke arbitrary server functions.

Dry-run command after an approved Track H deployment:

```javascript
admin_planCapabilityGrantsMigration({ apply: false })
```

Owner-approved creation command:

```javascript
admin_planCapabilityGrantsMigration({
  apply: true,
  confirmation: "CREATE_CAPABILITY_GRANTS"
})
```

The initializer creates the tab only when absent, writes only the header row, validates exact order, and refuses repair if an existing tab differs. It creates no grant rows.

Rollback is deployment repin first. The newly created empty tab may remain because older runtimes do not consume it. Removal, if required, is a separate owner-approved Sheet mutation after export/backup and confirmation that no grant rows exist.

## H2 Boundary

H1 does not implement approval requests, exact-batch fingerprints, approval queues, one-time consumption, or request-only batch preview. Those require a separate Track H2 authority and send-parity review.
