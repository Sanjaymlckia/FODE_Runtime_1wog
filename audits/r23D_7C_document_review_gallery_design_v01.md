# r23D.7C Document Review Gallery / Collection View

## Status

Design note only. No runtime implementation is authorized.

## Goal

Allow an officer to review all uploaded evidence for one applicant as a single collection without depending on embedded PDF iframes or repeatedly opening individual document cards.

## Proposed Operator Flow

1. Open the existing selected-applicant Review modal.
2. Select `Open Document Gallery`.
3. Review all uploaded evidence in one read-only collection.
4. Return to the existing document status/comment controls for any authorized decision.

The gallery is a viewing surface only. Existing document authority and save controls remain unchanged.

## Collection Model

Each normalized uploaded URL becomes one gallery tile:

- document label;
- source field;
- item number for multi-file fields;
- detected preview kind;
- compact evidence status;
- primary access action;
- secondary access action where reliable.

Multiple school-report URLs must render as separate tiles rather than collapsing to the first URL.

## File-Type Behavior

### Images

- Render a bounded thumbnail or image preview.
- Keep the original secure Download action.
- Any crop, resize, or thumbnail is derived viewing material only.

### PDF and Unknown Files

- Do not embed PDFs in nested iframes.
- Make Download the guaranteed action.
- Keep Open secondary only when diagnostics show the browser can use it.
- Clearly label browser-dependent actions.

### Missing Files

- Render a compact `Not Uploaded` tile.
- Do not create an action link.

## Layout

- Collapsible or modal collection launched from one `Open Document Gallery` button.
- Responsive tile grid.
- Filter: Uploaded / Missing / All.
- Keyboard-accessible next/previous movement.
- Status and comment controls remain visually separated from preview tiles.

## Authority Boundary

The gallery:

- reads existing `_docs` evidence;
- uses the existing token-gated file route;
- does not alter original evidence;
- does not decide verification status;
- does not change queue membership or lifecycle;
- does not send communications;
- does not write sheets.

## AI / Derived Preview Boundary

AI or deterministic image processing may later produce thumbnails, crops, orientation correction, or readability previews. These outputs must:

- remain advisory and read-only;
- never replace the original uploaded evidence;
- never become document-verification authority;
- be visibly labelled as derived previews;
- retain a path to the original secure download.

## Recommended Implementation Sequence

1. Use the r23D.7B.3 harness to establish reliable per-file access behavior.
2. Normalize multi-file evidence into separate read-only gallery items.
3. Implement image thumbnails only.
4. Add PDF/unknown tiles with Download primary.
5. Validate gallery navigation and evidence completeness.
6. Consider derived image aids only under a separate CIS.

## Acceptance Direction

- All uploaded URLs are represented as separate collection items.
- No original evidence is mutated.
- Images are rapidly reviewable.
- PDFs/unknown files remain accessible without iframe dependency.
- Missing evidence is obvious.
- Existing document decisions, queues, lifecycle, communication, and send behavior remain unchanged.
