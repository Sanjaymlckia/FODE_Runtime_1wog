# EduOps Preview Fixture Sanitisation

Fixture source: deterministic local DTOs created for Preview Lab only.

Live capture: not performed during normal startup.

Sanitisation result:

- No Sheet writes.
- No Drive writes.
- No Gmail, WhatsApp, Books or Portal calls.
- No access tokens.
- No signed live URLs.
- No reusable Drive authority.
- Email and phone values are synthetic `example.test` fixtures.
- Exact fixture names and ApplicantIDs are retained only where required by the CIS for owner checks.
- Document PNG is a simulated derived rendition stored locally.

Fresh snapshot capture produces a separate per-capture `SANITISATION_REPORT.json` under `local-snapshots/<capture-id>/`.

Document policy:

- Manifest metadata may be preserved after URL/token/file authority redaction.
- Reusable signed URLs are removed.
- Local representative PNG renditions are clearly labelled when real rendition capture is not explicitly enabled.
- Representative renditions must not be described as the applicant's real document.

Fixture limitation: deterministic mode validates UI and interaction contracts. Fresh snapshot mode is current only as of capture time. Staging remains required for live authority, integration and performance acceptance.
