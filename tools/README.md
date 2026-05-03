# FODE Validation Pack

These local scripts provide repeatable read-only checks before and after FODE runtime releases.

## Preflight

Run preflight before any release push, version creation, deployment repin, or git finalization.

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\preflight.ps1
```

The preflight script checks:
- authoritative repo root
- restricted-file git hygiene
- `Config.js` version contract
- critical dormant flags and daily cap
- JavaScript syntax with `node --check`
- `git diff --check`
- canonical URL hygiene
- r119 Admin UI RPC identity-source normalization targets

## Runtime Verify

Run runtime verify after deployments are repinned.

```powershell
powershell -ExecutionPolicy Bypass -File .\tools\verify-runtime.ps1 -ExpectedVersionNumber 119
```

The runtime verifier checks Admin and Student `?view=whoami` endpoints for:
- expected `VERSION`
- expected `DEPLOY_VERSION_NUMBER`
- expected script ID
- canonical `/macros/s/` URLs
- `mismatch=false`

## Safety

These scripts are read-only.

They do not:
- deploy
- run `clasp push`
- create Apps Script versions
- repin deployments
- mutate Sheets, Drive, Gmail, CRM, triggers, or email state

Admin browser smoke remains manual. These scripts do not attempt authenticated Admin UI RPC browser checks.
