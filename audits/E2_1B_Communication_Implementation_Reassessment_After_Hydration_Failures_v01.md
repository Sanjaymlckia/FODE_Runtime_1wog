# E2.1B Communication Implementation Reassessment After Hydration Failures v01

Status: Architecture / analyst note only
Track: L
Runtime release: None
Deployment changes: None

## Scope

Reassess the communication implementation plan after three rejected AdminUI-based staging candidates:

- `r278`
- `r279`
- `r280 / E2.1A`

This note does not authorize:

- AdminUI implementation
- backend/runtime changes
- new send types
- send authority changes
- lifecycle/actionability changes
- deployment/version/repin

## Baseline

Stable baseline:

- Admin staging stable on `r277 / 277`
- Student staging unchanged at `@247`
- production untouched
- OPS frozen

Rejected live staging candidates:

1. `r278`
   - Build visible
   - runtime stuck at `Runtime: loading...`
   - page error: `Invalid or unexpected token`
   - review queues failed to hydrate
   - rolled back
2. `r279`
   - same failure class persisted
   - rolled back
3. `r280 / E2.1A`
   - local validation passed
   - remote-source proof passed
   - Apps Script version `280` created
   - Admin staging repinned to `@280`
   - live runtime failed:
     - Build visible
     - `Runtime: loading...`
     - review queues skeleton/loading
     - `Invalid or unexpected token`
     - no visible Review button
   - rejected and rolled back

Business need remains valid:

- operator needs clearer visibility of:
  - applicant state
  - recommended action
  - implemented runtime message type
  - business intent
  - sendability
  - block reason
  - fallback path
  - preview before send

## Recommendation

The communication plan is still directionally correct.

Keep the model:

1. applicant state
2. recommended action
3. implemented runtime message type
4. sendability / gate reason
5. fallback path

Do not keep the recent implementation path.

Change the path from:

- direct AdminUI copy/layout releases first

to:

- backend/config/matrix documentation first
- validator/diagnostic work before any further AdminUI release candidate
- minimal UI exposure only after parser/hydration safety is proven

## Assessment

### 1. Is the communication plan itself still correct?

Yes, with narrower scope discipline.

What should remain in scope:

- implemented runtime message-type inventory
- business-intent to runtime-type mapping
- sendability / block-reason visibility
- per-stage and per-applicant communication authority matrix
- explicit classification of:
  - present
  - partial
  - missing
  - manual fallback only

What should not remain in scope right now:

- AdminUI wording/copy releases as the first move
- adding distinct live send types during visibility work
- mixing UI cleanup with communication authority expansion

### 2. What implementation path should change?

Yes, direct AdminUI copy/layout work should pause.

Near-term path should become:

1. communication authority matrix outside AdminUI
2. audit/tests proving implemented vs missing message families
3. operator guide/report generated from the matrix
4. only then minimal Legacy Admin exposure

Rationale:

- the business model is not the current blocker
- the live blocker is AdminUI runtime safety after Apps Script deployment
- further AdminUI candidate releases are high-risk until that safety gap is understood

### 3. Likely technical class of failure

Most likely class:

- client-side parse/runtime failure inside deployed Apps Script HTML/JS

Likely mechanisms:

- inline script extraction gap
- nested template-literal escaping failure
- quote/apostrophe/backtick breakage
- en-dash or smart-punctuation corruption inside JS-sensitive strings
- Apps Script HTML service or templating interaction producing invalid client JS
- unvalidated inline JavaScript embedded in `AdminUI.html`

Why current validation gates were insufficient:

- `node --check` does not validate inline JavaScript embedded inside Apps Script HTML the way the deployed browser receives it
- repo tests validated source assumptions, not final rendered client script
- remote-source proof only proved the pushed source matched local source
- Apps Script deployment can still yield a browser-breaking HTML/JS output even when local source is textually correct
- current gates do not parse the final client-side script payload after Apps Script HTML/template rendering

### 4. Diagnostic work needed before further AdminUI changes

Required next technical slice:

- diagnostic only
- no release candidate
- no copy/layout work

Diagnostic objectives:

1. isolate the exact AdminUI inline-script segment that breaks hydration
2. compare stable `r277` output against rejected candidates
3. validate final browser-consumed script, not only source file syntax

Likely risk areas to inspect:

- template literal nesting
- quote/apostrophe escaping
- backticks
- en-dashes / smart quotes / mojibake-prone text
- server-side template interpolation
- generated script blocks inside `.html`
- HTML-service escaping differences

Stronger validation gate needed:

1. extract final rendered Admin HTML/JS payload from Apps Script or equivalent pre-release render path
2. parse the extracted client script with a real JS parser
3. fail release if parse errors occur
4. add a browser hydration smoke gate before commit/acceptance for any AdminUI change

Minimum acceptance gate before future AdminUI releases:

- live Admin whoami
- live Admin hydration
- visible Review Queue rows
- no blocking pageerror

### 5. Revised communication roadmap

Recommended roadmap:

#### Phase A: Communication authority matrix outside AdminUI

- canonical matrix of:
  - lifecycle/actionability context
  - business intent
  - implemented runtime type
  - preview/send surface
  - block reason authority
  - fallback path

#### Phase B: Tests/audit for implemented vs missing message types

- prove which families actually exist today:
  - `legacy_invite`
  - `reminder`
  - `fd_acknowledgement`
  - `application_feedback`
  - `custom_email`
  - `docs_missing`
  - `payment_followup`
- prove which requested families remain missing or ambiguous:
  - receipt request
  - verified quote / payment instruction
  - acceptance / enrolment confirmation
  - accepted-with-impact subtype
  - final reminder
  - contact failure / WhatsApp fallback as manual fallback path

#### Phase C: Operator guide/report generated from the matrix

- operator-facing note/report
- no send-logic changes
- no AdminUI dependency
- answers:
  - what can be sent
  - where
  - by whom
  - with what blocker rules

#### Phase D: Minimal Legacy Admin exposure only after validator exists

- only after AdminUI hydration validator is in place
- minimal exposure
- no broad layout rewrite
- no bundled communication redesign

#### Phase E: New distinct message templates later, separately governed

- separate governance
- separate risk review
- separate authority review

### 6. What should explicitly not happen?

Do not:

- revive OPS
- start broad Legacy Admin UI redesign
- hide new send types inside copy-only work
- change send authority
- change lifecycle/actionability logic
- create further AdminUI release candidates before parser/hydration failure is understood

### 7. Decision options for operator

#### Option 1: Rollback and pause UI work; do diagnostic-only slice

Recommended immediate option.

Use when:

- staging stability is the first priority
- no more AdminUI candidate risk is acceptable yet

#### Option 2: Implement communication matrix outside AdminUI

Recommended parallel planning/analysis option.

Use when:

- business clarification is still needed
- runtime UI change is currently too risky

#### Option 3: Continue AdminUI copy edits only after validator exists

Acceptable later, not now.

Precondition:

- stronger inline HTML/JS validation gate exists
- hydration smoke gate exists

#### Option 4: Later design a separate workspace surface after runtime is stable

Acceptable future option.

Constraint:

- not OPS revival
- not part of current communication visibility slice

## Recommended Next Slice

Recommended next slice:

- `E2.1C` or similarly named diagnostic-only AdminUI hydration isolation

Goals:

- isolate exact parse/runtime failure class
- define stronger AdminUI release validator
- no communication UI release candidate yet

In parallel, safe analyst slice:

- matrix/documentation refinement outside AdminUI

## Risks

- repeated AdminUI release attempts will keep consuming staging versions without improving business clarity
- communication visibility work will remain blocked if it stays coupled to unsafe AdminUI copy changes
- operators may continue inferring template availability from lifecycle/actionability intent instead of actual runtime message availability
- local source/test success may create false confidence unless final deployed HTML/JS validation is added

## Conclusion

The communication strategy should not be abandoned.

The implementation sequence should be changed.

Current recommendation:

1. stay on stable `r277`
2. stop further AdminUI release candidates for communication visibility
3. perform diagnostic-only hydration isolation
4. move communication clarification work into matrix/audit/operator-guide outputs first
5. return to minimal UI exposure only after AdminUI hydration validation is strengthened

## Safety Confirmation

- no runtime files changed
- no Apps Script version created
- no deployment or repin performed
- no commit performed
- no push performed
- no Student staging change
- no production change
- no Sheet edits
- no Drive data edits
- no sends
- OPS remains frozen
