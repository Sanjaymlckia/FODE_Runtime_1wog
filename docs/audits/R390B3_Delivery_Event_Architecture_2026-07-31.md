# R390B3 — Delivery Event Architecture

The delivery model preserves separate append-only facts: send acceptance, bounce, open signal, read receipt, reply, portal activity, and required-action completion. Provider IDs are nullable; no identifier is fabricated. Tracking pixels and Gmail polling are intentionally out of scope. Uncertainty records an explicit state and never authorizes automatic resend.

## Gate 2 signed-request evidence — 2026-07-31

Synthetic signed staging requests proved a valid request (200), compatible duplicate replay (200 with `idempotent: true`), conflicting replay rejection (401), first ApplicantID use (200), and cross-operation ApplicantID reuse rejection (401). The deployed replay indicator initially failed; the bounded `Repository.php` correction was linted and regression-tested locally (30 assertions), redeployed, and retested successfully.

Negative tests for invalid signature, body hash, past/future timestamp, unknown key, and malformed signed request remain outstanding. No Gmail call or delivery-provider interaction occurred.
