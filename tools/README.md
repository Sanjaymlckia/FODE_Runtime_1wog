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

## Release Guard

Before any Apps Script version is created, run:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\verify-remote-config-before-version.ps1
```

Only proceed to `clasp version` if the script prints:

```text
SAFE TO RUN clasp version
```

The release guard:
- reads local `Config.js`
- checks `.clasp.json` `scriptId`
- refuses any remote check folder inside the repo root
- pulls remote Apps Script source into an external folder only
- compares remote and local `VERSION` / `DEPLOY_VERSION_NUMBER`
- exits nonzero on mismatch or pull failure

It does not:
- run `clasp version`
- repin deployments
- edit Apps Script source
- edit `Config.js`

## Safety

These scripts are read-only.

They do not:
- deploy
- run `clasp push`
- create Apps Script versions
- repin deployments
- mutate Sheets, Drive, Gmail, CRM, triggers, or email state

Admin browser smoke remains manual. These scripts do not attempt authenticated Admin UI RPC browser checks.
