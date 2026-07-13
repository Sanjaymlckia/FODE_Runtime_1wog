# Operator Next Visual System

Status: Track L interface stabilisation pass only. No runtime release.

## Design Tokens

- Base text: `15px`
- Secondary detail text: `13px`
- Table/worklist row text: `14px`
- Buttons: `14px`, `42px` minimum height
- Badges: `13px`
- Page title: `30px`
- Section title: `19px`
- Line height: `1.48` shell baseline

## Core Components

- Page header: large title, readable subtitle, right-aligned actions
- Summary metric card: consistent `k / v / m` hierarchy
- Section panel: shared border, radius, header, and body rhythm
- Worklist/table row: strong applicant identity, readable secondary details, action cluster on the right
- Badge system: `info`, `ready`, `warn`, `blocked`, `muted`
- Button system: default, primary, action, danger, disabled
- Sticky action bar: bottom cohort action strip
- Search/filter controls: shared 15px field text and rounded control system

## Language Contract

- Primary labels must be human-readable.
- Raw enums and handler keys remain secondary only.
- Use the shared `operatorNextHumanizeToken_()` formatter in Operator Next.

## Route Consistency Rules

- Every active route uses the same shell typography scale and card rhythm.
- Empty/loading/error states use the shared Operator Next components.
- No route should reintroduce microscopic helper text or route-specific badge/button skins.
