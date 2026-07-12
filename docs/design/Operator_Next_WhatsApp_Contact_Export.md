# Operator Next WhatsApp Contact Export

Status: accepted prototype boundary; no direct WhatsApp integration.

## Purpose

Provide a controlled handoff when email contactability fails and an approved phone number exists.

## Authority Boundary

- Actionability identifies a Contactability Exception.
- The export surface projects applicant identity, approved phone contact, recommended message context, and authority reason.
- The operator performs any WhatsApp action outside FODE Runtime.
- FODE Runtime does not claim delivery, read status, or conversation authority.

## Prototype Flow

1. Open Contactability Exceptions.
2. Select returned records with an approved phone number.
3. Preview the bounded export.
4. Confirm sensitive-data handling.
5. Download a local VCF containing only selected phone-ready applicants.

The prototype produces a browser-local VCF only. It does not call WhatsApp, Gmail, Sheets, or Apps Script.

## Proposed VCF Contract

| VCard property | Purpose |
| --- | --- |
| `FN` | Applicant name for operator recognition. |
| `ORG` | Includes Applicant ID so phone numbers never collapse applicants. |
| `TEL;TYPE=CELL` | Effective approved phone number. |
| `NOTE` | Contactability reason only; no portal secret or internal row identifier. |

## Safety Rules

- No group creation.
- No direct send.
- No portal token or secret export.
- No internal row number or opaque backend ID by default.
- Export is bounded and capability-gated.
- Applicant ID remains the record identity even where phone numbers are shared.
- Export creation must be auditable if implemented in runtime.

## Future Implementation Gate

Runtime implementation requires a dedicated Track H CIS because it exports applicant contact data. It must reuse Actionability selection eligibility and the existing capability resolver, and must not create a new communication authority.
