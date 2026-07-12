# Operator Next Pass 1 Visual Correction Report

Status: corrected standalone prototype

## Visual Gap Before Correction

The first Operator Next prototype was functionally useful but visually diverged from OPS:

- 244px rail rather than the compressed OPS proportion;
- system-dashboard typography with 24-25px headings and values;
- wide shallow KPI and workload cards;
- summary cards before the primary operating route;
- excessive empty canvas on sparse routes;
- generic SaaS dashboard rhythm rather than OPS horizontal work progression;
- no Lifecycle Map as the primary operating menu;
- missing visible routes for several mature Admin surfaces.

## Source and Recording Measurements

| Measure | Runtime OPS CSS | Original OPS recording (1910px frame) | Supporting benchmark | Revised prototype |
| --- | ---: | ---: | ---: | ---: |
| Sidebar width | 288px source value | approximately 206px rendered | 218px | 218px |
| Main heading | 28px | approximately 20px rendered | 20px | 20px |
| Sidebar heading | 20px | approximately 15px rendered | 15px | 15px |
| Navigation text | 14px | approximately 10-11px rendered | 11px | 10px |
| Lifecycle card | source uses responsive `minmax(210px,1fr)` and 178px minimum height | lifecycle cards not held long enough in sampled frames for reliable pixel measurement | responsive six-column grid; 178px minimum height | fixed 174px × 214px |
| Card width/height ratio | responsive | not asserted from recording | width varies by viewport | 0.81 |
| Grid gap | 10px source include | approximately 8-12px | 6px | 8px |
| Cards per wide row | responsive | not asserted from sampled frames | 6 at wide benchmark | 7 at 1600px evidence viewport |
| Card heading | 15px lifecycle-band source; card source varies | approximately 11-13px rendered | 10.5px | 10.5px |
| Card body | 11-12px source | approximately 8-10px rendered | 8.6px / 1.3 | 8.6px / 1.3 |
| Button height | 34px minimum | approximately 29-32px rendered | approximately 27px | 29px minimum |
| Main spacing | 24px shell; 14-18px grids | approximately 8-14px rendered | 6-12px | 7-11px |
| Font stack | `ui-sans-serif, system-ui, Segoe UI, Roboto, Arial` | compressed by recorded browser scale | `Arial Narrow, Aptos Narrow, Roboto Condensed, Segoe UI, Arial` | benchmark compressed stack |

The runtime CSS source and the recording differ because the recorded OPS surface is rendered at a compressed effective scale. The revised prototype follows the recording/benchmark visual proportion while retaining the runtime's restrained navy, blue, white, and status palette.

## Revised Hierarchy

1. Lifecycle Map and active scope.
2. Highest-priority actionable callout.
3. Narrow, deep lifecycle cards.
4. Selected-stage action strip.
5. Scope, refresh, and audit controls.
6. Secondary routes and diagnostics.

## Visual Character Retained

- deep navy fixed rail;
- numbered compact navigation;
- high-density white work bands;
- restrained blue active state;
- compact pills and status rows;
- clear green/amber/red operational states;
- narrow typography and tight line height;
- selected-applicant context carried into Review;
- large unused space permitted where a sparse route has no more work.

## Visual Character Removed

- oversized KPI cards;
- pastel icon circles;
- generic marketing/dashboard composition;
- repeated architecture prose;
- equal-width stretching of sparse lifecycle cards;
- decorative stage colour coding;
- false content added to fill empty space.

## Acceptance Evidence

See `prototypes/operator-next/evidence/pass1-correction/` for Lifecycle Map, Operational Dashboard, Review handoff, Communications, System Health, Roles & Capabilities, and narrow Batch Communication captures.
