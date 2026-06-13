# r226B OPS Freeze Boundary Note

## Status

- OPS status: **FROZEN / SECONDARY / EXPERIMENTAL**
- Primary operational surface: **Legacy Admin**

## Decision

- No new OPS features will be developed for the foreseeable future.
- OPS remains accessible for reference and testing only.
- Legacy Admin remains the production operator surface.
- OPS must not become a competing authority surface.
- OPS must not gain send authority, communications execution, or additional client-side classification logic.

## Conceptually Worth Preserving in OPS

The following concepts remain useful and may be worth preserving for future reference:

- Global vs Working View
- Loaded queue drill-down and loaded-snapshot context
- Selected-applicant context across tools
- Awaiting Uploads workflow
- Read-heavy cross-surface visibility for operator review
- Thin orchestration over proven backend authority, where no duplicate authority is introduced

## Frozen Areas — No Development

The following areas are frozen and should not be developed further under the current strategy:

- New feature development in OPS
- Send authority
- Communications execution
- Batch communication workflows
- Additional client-side classification or row-facts logic
- Expansion of OPS as a competing authority surface
- Duplicated dashboard or queue authority logic

## Areas That Must Not Be Expanded

The following must not be expanded in OPS:

- Any work that creates duplicate or competing authority interpretations
- Broad communications or batch execution features
- OPS-specific send eligibility logic
- OPS-specific document classification logic
- OPS-specific payment classification logic
- OPS-specific lifecycle classification logic
- OPS-specific automation authority

## Conditions Required Before OPS Work Can Resume

OPS work may only resume if all of the following are true:

- Legacy authority is stable and trusted as the single source of truth
- Marketing and intake priorities are stable
- A clear operational need exists that Legacy Admin cannot meet cleanly
- OPS can consume backend authority without creating client-side duplicate authority
- Operator workflow value is clearly higher than maintenance cost

## Immediate Action Recommendation

- Recommended immediate action: **no runtime action**

Reason:

- Current evidence supports a strategic freeze, not an emergency runtime intervention.
- OPS can remain available as a secondary/reference surface without further expansion.

Possible future low-risk options, if operator confusion becomes active again:

- documentation-only note
- menu de-emphasis
- future removal from primary navigation

No runtime/UI change is recommended under this note.

## Reassessment Trigger

OPS should be reassessed only when one or more of the following occurs:

- legacy authority work is stable and trusted
- marketing/intake priorities are stabilised
- a new operator need appears that Legacy Admin cannot satisfy well
- a future scheduled strategic review is requested

## Future Decision Options

This freeze note preserves the following future options:

- keep frozen
- simplify and align
- hide from primary navigation
- deprecate
- remove

## Boundary Summary

OPS should survive only as a cleaner view over proven backend authority.

It should not be treated as:

- a primary operator execution surface
- a send-authority surface
- a separate lifecycle/document/payment/communication authority system

Legacy Admin remains the trusted operational surface unless and until backend authority is simplified enough to support a thinner OPS model safely.

## Confirmation

- No runtime files were modified
- No OPS files were modified
- No sheets were modified
- No deployment, versioning, repin, commit, tag, or send occurred
