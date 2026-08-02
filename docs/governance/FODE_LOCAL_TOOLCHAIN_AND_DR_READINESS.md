# FODE_LOCAL_TOOLCHAIN_AND_DR_READINESS

Status: `IN PROGRESS` after R401 scope correction; not an R401 release blocker

## Purpose

Complete the platform-wide local toolchain and disaster-recovery capability outside bounded code-only staging releases.

## Outstanding capability work

- Durable authenticated SSH access for staging backup operations.
- Reliable materialisation of authenticated Drive/Sheet exports to the approved backup root.
- Complete protected H1 backup under separate production authority.

## Completed local capability evidence

- Python 3.13.14 is on the user PATH; the `py` launcher resolves Python 3.14.6.
- PHP 8.1.34 x64 CLI is at `D:\FODE_Tooling\PHP\8.1.34` with `pdo_mysql` enabled through the D: `php.ini`.
- All 18 communications-ledger PHP files lint successfully and the fixture suite passes 30 assertions.
- Playwright tooling and browser binaries remain under `D:\FODE_Tooling\Playwright`; browser evidence remains under `D:\FODE_Test_Evidence`.
- MariaDB 11.4.10 portable tooling is installed at `D:\FODE_Tooling\MariaDB\11.4.10`; a loopback-only fixture on port `33307` passed synthetic dump/restore and PHP PDO checks, then dropped its local databases and shut down with no listener remaining. No hosted or staging database was changed.
- The dedicated `fode-server293-ed25519` key is configured through the bounded `server293` profile in the protected user SSH directory. Reverse DNS resolves to `server293-4.web-hosting.com`; the owner-confirmed ED25519 host key `SHA256:f0L7kSpyzMQPWb0ZKVHw5/H1HPoxGJLgqCxDtDfoMuw` is trusted with strict host-key checking, and a non-mutating SSH identity check returned `kundghlt`. Public-key registration was completed by the owner through authenticated cPanel; Codex made no remote configuration change.

## R401 evidence boundary

R401 preserved the verified Git bundle, committed-source archive, working-tree patch, Apps Script source/configuration capture, partial DR inventory, SHA-256 inventory, baseline alignment proof, and D: capacity proof. The incomplete MariaDB restore, authoritative Drive reconstruction, and protected production backup remain partial DR evidence and are not claimed as `PASS`.

## Release rule

This capability task becomes a mandatory release gate only for database/schema migrations, production data changes, destructive operations, or scheduled platform DR validation, unless a future CIS explicitly defines a narrower recovery invariant.
