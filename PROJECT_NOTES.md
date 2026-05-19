# PROJECT_NOTES

## Purpose

- Capture important operator observations, UX findings, architectural ideas, and lessons learned
- Non-authoritative reference only

## Not authoritative for

- Runtime truth
- Release identity
- Active CIS scope
- Deployment state
- Acceptance status

## UI / UX observations

### 2026-05-19 - Workspace visibility hierarchy

Area
OPS / Workspace navigation

Observation
Current workspace separation may create unnecessary navigation for higher roles.

Preferred model

Operator

- See operator workflow items only

Admin

- See Operator items
- Plus Admin items

Super Admin

- See Admin items
- Plus Super Admin items
- Super Admin should have a consolidated "see everything" surface
- Avoid requiring movement into subordinate workspace modes

Reasoning

- Reduces navigation friction
- Improves oversight
- Preserves hierarchy naturally
- Supports Super Admin as governance + intervention role

### 2026-05-19 - Billing action behavior

Area
OPS / Billing Queue

Observed during browser/operator testing

PASS

- Invoice badge displayed
- Invoice number displayed
- Books status visible

FAIL

- Open Invoice action inactive/no action
- Refresh Books status inactive/no action

Notes
Possible action wiring or context binding issue

### 2026-05-19 - Communications observations

Area
OPS / Communications

PASS

- Template selection
- Preview generation
- Safe-mode visibility
- Block reason visibility
- Timeline visibility

Potential follow-up
Displayed recipient source may differ from effective recipient resolver

## Operator workflow observations

- ### 2026-05-19 — Default customer portal access

Area  
OPS / Zoho Books / Customer portal

Observation  
Opening the invoice successfully exposed the Zoho customer portal flow for INV-000051.

Potential improvement  
Consider making portal access/open behavior available by default for all applicants/customers where policy permits.

Reasoning  
- Reduces operator friction
- Supports self-service payment follow-up
- Improves admissions/payment continuity
- Avoids repeated manual portal-link handling

Status  
Observation only. No implementation approved.

## Architecture observations

- Reserved for future notes.

## Lessons learned

### 2026-05-19 - Browser tooling truth vs extension state

Area
CodexHub / Tooling

Observation
UI connection state alone is not operational proof.

Observed case

PASS

- Codex Chrome extension connected
- Google account/session valid
- Chrome profile valid
- Local Playwright test passed

FAIL

- Callable Chrome/Computer Use tool absent
- Session fell back to shell/headless behavior

Lesson

Do not treat:

- Extension Connected
- Browser enabled
- Plugin visible

as proof of browser capability.

Required proof

- Callable browser tool exposed
- Visible browser control available
- Open example.com and read title through connected browser

Reasoning

Tool hydration and UI connection state are separate concerns.

---

### 2026-05-19 - Browser profile isolation strategy

Area
CodexHub / Tooling

Observation

Operational/developer systems can legitimately contain many Chrome profiles.

Lesson

Avoid aggressive cleanup of working profiles.

Preferred strategy

- One dedicated automation profile
- Minimize profile switching during testing
- Distinguish:

Website login
vs
Chrome profile sync

Reasoning

Avoids operational disruption and account contamination.

---

### 2026-05-19 - Acceptance evidence hierarchy

Area
CodexHub / Process

Observation

Headless execution can create false confidence.

Do not accept

- shell_command launching chrome.exe
- headless dump-dom output
- local browser launches

Accept

- connected browser control
- visible interaction evidence
- operator screenshots
- actual UI state verification

Reasoning

Launching a process is not equivalent to controlling an authenticated workflow.

---

### 2026-05-19 - Notes discipline

CURRENT_TASK.md

- active work only

PROJECT_NOTES.md

- observations
- UX findings
- future ideas
- lessons learned

ROADMAP.md

- approved direction

AGENTS.md

- rules and invariants

## Future enhancements

- Reserved for future notes.

## Notes discipline

CURRENT_TASK.md

- active work only

PROJECT_NOTES.md

- observations
- UX findings
- future ideas
- lessons learned

ROADMAP.md

- approved direction

AGENTS.md

- rules and invariants
