# E1E Review Workflow Audit v01

Status: Discovery only  
Baseline: Admin staging `r276 / 276`

## Scope

This audit evaluates the applicant review modal as an operator workflow:

1. review evidence
2. assess documents
3. determine outcome
4. save

Inspected sources:

- [AdminUI.html](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/AdminUI.html)
- [Admin.js](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/Admin.js)
- [docs/architecture/Operator_Review_Workspace_Model_v01.md](/E:/Gdrive/01_SANJAY/Codex_Sync/FODE_Runtime_1wog/docs/architecture/Operator_Review_Workspace_Model_v01.md)

## Current Workflow

### Entry

- Operator opens a queue row via `review()` -> `admin_getApplicantDetail_json()` -> `openModal(d)`.
- Modal opens with:
  - computed document/payment context
  - workflow field summary
  - portal access state
  - token age
  - audit metadata

### Evidence review

- Existing document cards render first.
- Each document card shows:
  - document label
  - evidence state
  - preview / download / open actions where available
  - per-document status selector
  - per-document comment
  - field map
- Document Gallery is additive and loaded on explicit click.

### Decision controls

- Overall status controls appear below the document area.
- Separate save buttons exist:
  - `Save Document Statuses`
  - `Save Overall`

### Additional controls

- Copy portal link
- Reset link
- Lock / unlock editing
- communication workspace
- Zoho / billing related surfaces

## Strengths

1. Review rows open directly from the operational queue surface.
2. Document cards are explicit and field-mapped.
3. Gallery improves evidence access, especially for image MIME types.
4. Secure per-file review model is preserved.
5. Document status and comment fields are directly adjacent to each evidence item.
6. Unsaved-change warnings exist before link and refresh actions.

## Observed Friction

### 1. Start point is not explicit

The modal contains a large amount of context before the operator reaches a clear “start here” instruction.

The operator can infer the flow, but the UI does not explicitly tell them:

- review uploaded evidence first
- then set per-document outcomes
- then save document statuses
- then consider overall outcome only if relevant

### 2. Scroll burden is high

The modal contains:

- top summary cards
- workflow fields
- status/helper banners
- document cards
- gallery
- overall controls
- communication controls
- billing-related surfaces

This creates a long vertical workflow with mixed priorities.

### 3. Relationship between document decisions and overall decisions is weak

`Save Document Statuses` and `Save Overall` are both present, but the hierarchy is not visually strong enough.

The UI exposes:

- `Doc Verification (Computed)`
- `Overall (Computed)`
- `Set Overall Status`
- `Overall Reason`

This is powerful, but for a normal operator it is not immediately obvious:

- when overall status is needed
- when overall is computed automatically
- when overall is locked
- when overall is supervisory-only

### 4. Review workflow mixes operational and supervisory controls

Normal review path lives beside:

- Reset Link
- Unlock Editing
- Save Overall

Even though guards exist, their presence increases cognitive load.

### 5. PDF review experience is adequate, not elegant

Current PDF path is download/open-first, which is safe and honest.

But it remains less fluid than image review:

- images can preview inline
- PDFs usually require download/open

This is not an authority issue, but it still affects review speed.

### 6. Gallery placement is useful but secondary

The gallery is helpful, especially for multi-file and image review, but it is still an auxiliary layer rather than the primary evidence-review rail.

That is safe, but it means the operator must understand the relationship between:

- existing document cards
- gallery tiles
- per-document status controls

## Operator Confusion Points

1. Difference between:
   - `Doc Verification (Computed)`
   - `Overall (Computed)`
   - `Set Overall Status`
2. Whether overall review is required for every case or only exceptional/supervisory cases.
3. Whether the gallery is a replacement for document cards or just an evidence viewer.
4. Whether saving document statuses is sufficient to complete review.
5. Where communications fit relative to document review completion.

## Gallery Assessment

### Placement

- Acceptable as an additive evidence surface inside the modal
- Not currently the source of workflow confusion by itself

### Usefulness

- High for image files
- Medium for multi-file school reports
- Medium-low for PDFs because the safe path is still open/download-first

### Relationship to status controls

- Good functional relationship
- Weak visual relationship

The operator can review evidence in one area and mark statuses in another, but the UI could make that sequence more explicit in a future slice.

## Navigation / Scroll Assessment

### Helpful

- queue entry straight into modal
- explicit close action
- review can refresh detail safely

### Friction

- long scroll path
- many control classes mixed together
- supervisory tools appear within the same vertical working rail as normal review

## Priority Ranking

### Highest priority friction

1. Clarify review sequence and hierarchy
2. Separate normal review path from supervisory/portal controls visually
3. Strengthen relationship between document decisions and overall decisions

### Medium priority friction

4. Reduce vertical clutter near the top of the modal
5. Improve PDF review ergonomics if technically safe later

### Lower priority

6. Fine-grained gallery polish beyond current C4 state

## Recommended Future Layout

Conceptual only:

1. Review summary / applicant state strip
2. Evidence review rail
   - document cards
   - gallery access
3. Document decision rail
   - per-document status/comment
   - `Save Document Statuses`
4. Review completion / overall outcome rail
5. Communications rail
6. Supervisory / portal tools rail

This would preserve authority while making the modal easier to read as a sequence rather than a toolbox.

## Key Findings

1. The modal is capable and operationally rich.
2. The main problem is hierarchy and sequencing, not missing authority.
3. The gallery is useful and should be retained.
4. The biggest friction is mixed-purpose density inside one scroll-heavy surface.
5. Normal review and supervisory actions need stronger visual separation in a future slice.

## Recommended Next Slice

Recommended next slice from this report:

- `E1E.1 review modal hierarchy / workflow-only redesign`

Boundaries should be:

- AdminUI only if possible
- no document authority changes
- no payment authority changes
- no communication logic changes
- no queue changes

## Risk Assessment

- Low risk: hierarchy and sectioning improvements
- Medium risk: moving controls without preserving operator muscle memory
- Medium risk: over-integrating communications into the review path too early

## Confirmation

- No runtime files edited
- No tests edited
- No deployment
- No version
- No repin
- No commit
- No send
- No Sheet edit
- No Drive edit
