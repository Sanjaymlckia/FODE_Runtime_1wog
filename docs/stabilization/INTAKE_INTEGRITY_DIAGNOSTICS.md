# S3B Intake Integrity Diagnostics Design

## Scope

- Design only
- No row mutation
- No schema change

## Required Future Checks

- `Folder_Url` present but required intake file missing
- `Fee_Receipt_File` present while `Receipt_Status` is blank or pending
- `Receipt_Status = Verified` with no receipt file
- Portal token missing after intake completion

## Why Deferred

- Required-file semantics are not yet canonical across the legacy intake/document columns.
- A future S3C pass should finalize which file columns are authoritative before adding a read-only helper that operators may rely on.
- This avoids hard-coding a contradictory file checklist during stabilization.

## Proposed Read-Only Helper

- Name:
  `collectIntakeIntegrityDiagnostics_(rowObj, opts)`
- Output:
  array of structured findings with `code`, `severity`, `field`, `message`
- No writes to sheet rows, properties, Drive, or triggers

## Candidate Finding Codes

- `FOLDER_WITHOUT_REQUIRED_FILE`
- `RECEIPT_FILE_WITHOUT_STATUS`
- `RECEIPT_VERIFIED_WITHOUT_FILE`
- `PORTAL_TOKEN_MISSING_AFTER_INTAKE`

## Operator Use

- Surface findings in Admin diagnostics first
- Do not block unrelated read-only operations
- Use findings to drive later cleanup and canonical schema decisions
