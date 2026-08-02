# FODE_LOCAL_TOOLCHAIN_AND_DR_READINESS

Status: `FOLLOW-UP` after R401 scope correction; not an R401 release blocker

## Purpose

Complete the platform-wide local toolchain and disaster-recovery capability outside bounded code-only staging releases.

## Outstanding capability work

- Durable authenticated SSH access for staging backup operations.
- Matching MariaDB 11.4 local loopback restore environment.
- PHP CLI and required ledger extensions.
- Reliable materialisation of authenticated Drive/Sheet exports to the approved backup root.
- Complete protected H1 backup under separate production authority.

## R401 evidence boundary

R401 preserved the verified Git bundle, committed-source archive, working-tree patch, Apps Script source/configuration capture, partial DR inventory, SHA-256 inventory, baseline alignment proof, and D: capacity proof. The incomplete MariaDB restore, authoritative Drive reconstruction, and protected production backup remain partial DR evidence and are not claimed as `PASS`.

## Release rule

This capability task becomes a mandatory release gate only for database/schema migrations, production data changes, destructive operations, or scheduled platform DR validation, unless a future CIS explicitly defines a narrower recovery invariant.
