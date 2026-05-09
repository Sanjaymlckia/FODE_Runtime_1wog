# S2C Payment State Code Audit

Date: 2026-05-09
Scope: Read-only audit of payment-state code paths, contradictions, UI rendering, and pre-Books risks

## Summary

- `Receipt_Status` is the richer operational payment signal
- `Payment_Verified` is repeatedly treated as a compatibility mirror and is also rewritten from derived logic
- UI still displays several payment-related abstractions simultaneously: `Payment_Received`, `Payment_Verified`, `Payment_Badge`, and computed status text
- Before Books integration, payment truth is spread across file evidence, receipt verification, compatibility flags, and invoice-trigger side effects

## Authoritative vs Derived Usage

### Authoritative-leaning usage

| Field / function | Approx line | Role |
| --- | ---: | --- |
| `Receipt_Status` | `Admin.js:204, 351, 635, 916, 958` | Primary review/write control for payment receipt verification |
| `derivePaymentBadge_` | `Code.js:4180` | Computes payment truth from `Receipt_Status` |
| `handleInvoiceTrigger_` | `Admin.js:1682` | Treats verified payment transition as downstream action gate |

### Derived / compatibility usage

| Field / function | Approx line | Role |
| --- | ---: | --- |
| `Payment_Verified` | `Admin.js:354, 398, 741, 809, 964` | Compatibility boolean and mirrored write target |
| `derivePaymentVerified_` | `Code.js:4146` | Rewrites `Payment_Verified` from derived logic |
| `Payment_Received` | `Admin.js:395` | Derived from `Fee_Receipt_File` or `Receipt_Status` |
| `Payment_Badge` | `Admin.js:404`, `AdminUI.html:1502, 3175` | UI/computed abstraction derived from receipt state |

## Main Contradictions

### `Receipt_Status` versus `Payment_Verified`

- `Admin.js:958` explicitly sets `Receipt_Status = "Verified"`
- `Admin.js:966` and `Code.js:4151`, `4194` then mirror payment truth into `Payment_Verified`
- This means one field is the operational decision and the other is a replicated compatibility state

### `Fee_Receipt_File` versus payment truth

- `Admin.js:395` treats the existence of `Fee_Receipt_File` or `Receipt_Status` as “Payment Received”
- `AdminUI.html:2340` labels receipt-upload evidence as “Pending”
- Evidence presence is not payment verification, but both are surfaced in adjacent UI states

### queue semantics versus raw flags

- `Admin.js:2420-2428` uses:
  - receipt evidence presence
  - `Payment_Verified`
  - docs verification
  - queue categorization
- This creates multiple operational interpretations of “payment pending”

## Write Paths

| File | Function | Approx line | Behavior |
| --- | --- | ---: | --- |
| `Admin.js` | document save path | `741-743` | Writes `Payment_Verified` compatibility based on derived payment badge |
| `Admin.js` | review patch path | `809-824` | Writes `Payment_Verified` in patch payload |
| `Admin.js` | legacy payment verify endpoint | `957-966` | Writes `Receipt_Status = Verified` then mirrors `Payment_Verified` |
| `Code.js` | `derivePaymentVerified_` | `4146-4152` | Rewrites `Payment_Verified` on row object when present |
| `Code.js` | `computeOverallStatus_` | `4192-4197` | Again aligns `Payment_Verified` before returning overall status |

## UI Display Logic

| File | Approx line | Behavior |
| --- | ---: | --- |
| `AdminUI.html:1502` | uses `Payment_Badge` or `Payment_Verified_Bool` |
| `AdminUI.html:2312` | labels `Payment_Verified` as “Yes (derived)” |
| `AdminUI.html:2321-2340` | shows `Payment Received`, `Payment Verified`, and a computed payment status badge |
| `AdminUI.html:3188-3189` | modal shows both `Payment Received` and `Payment Verified` |
| `AdminUI.html:3269` | tells operator that payment is confirmed when `Receipt_Status` is `Verified` |

## Risks Before Books Integration

- Payment truth is not represented by a single canonical field in code
- Receipt upload evidence can be mistaken for completed payment state
- Compatibility rewrites to `Payment_Verified` increase the chance of stale or circular semantics
- Invoice-trigger behavior still piggybacks on payment verification transitions before any Books-owned payment model exists
- `Registration_Complete` and overall/admission stage logic (`Code.js:4419-4425`) can elevate CRM/invoice stage based on derived payment truth

## Recommendation

- Treat `Receipt_Status` as the canonical pre-Books payment control
- Keep `Payment_Verified` compatibility-only until a future authorized patch can narrow write paths
- Do not clean up payment semantics until invoice-trigger gating is separated from CRM-era stage logic
