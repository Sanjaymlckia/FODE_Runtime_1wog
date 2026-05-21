# Release Closure Discipline + Follow-Up Register (Binding)

## Purpose

Protect runtime stability and prevent release drift.

## Standing Rule

A release closes only against its approved scope and acceptance criteria.

New findings discovered during implementation, browser testing, operator testing, live acceptance, or runtime observation must be classified before affecting closure.

## Classification

### BLOCKER

Definition: directly prevents the approved release objective from functioning correctly.

Examples:

- whoami mismatch
- deployment mismatch
- broken workflow
- duplicate protection failure
- unintended send/write
- security regression
- data corruption risk

Action: may block release closure.

### FOLLOW-UP

Definition: important but does not prevent the approved release objective from functioning.

Examples:

- mobile-safe portal links
- PNG device usability improvements
- future automation
- UI enhancements
- reporting improvements
- workflow optimization
- convenience features

Action: must not block release closure.

## Closure Rule

- Do not silently absorb follow-up items into the current release.
- Do not expand acceptance criteria after implementation begins unless the issue is a true `BLOCKER`.
- Closure occurs against approved scope only.

## Required CURRENT_TASK.md Section

Every active release task must include this standing section or preserve the current repo-local equivalent:

```markdown
## Release Closure Discipline + Follow-Up Register (Binding)

### Purpose

Protect runtime stability and prevent release drift.

### Rule

A release closes only against its approved scope and acceptance criteria.

New findings discovered during implementation, browser testing, operator testing, live acceptance, or runtime observation must be classified before affecting closure.

### Classification

`BLOCKER`

- Definition: directly prevents the approved release objective from functioning correctly.
- Examples: whoami mismatch, deployment mismatch, broken workflow, duplicate protection failure, unintended send/write, security regression, data corruption risk.
- Action: may block release closure.

`FOLLOW-UP`

- Definition: important but does not prevent the approved release objective from functioning.
- Examples: mobile-safe portal links, PNG device usability improvements, future automation, UI enhancements, reporting improvements, workflow optimization, convenience features.
- Action: must not block release closure.

### Closure Rule

- Do not silently absorb follow-up items into the current release.
- Do not expand acceptance criteria after implementation begins unless the issue is a true `BLOCKER`.
- Closure occurs against approved scope only.

## Follow-Up Register

| ID | Description | Source release | Suggested target release | Priority | Dependency | Status |
| --- | --- | --- | --- | --- | --- | --- |
| FU-000 | Example follow-up item | rNNN | rNNN+1 | Medium | owner/design dependency | Pending |
```

## Required Future CIS Template Section

Every future CIS must include a closure classification section:

```markdown
## Release Closure Discipline

This CIS closes only against its approved scope and acceptance criteria.

New findings discovered during implementation, browser testing, operator testing, live acceptance, or runtime observation must be classified as `BLOCKER` or `FOLLOW-UP` before affecting closure.

### BLOCKER

Definition: directly prevents the approved release objective from functioning correctly.

Action: may block release closure.

### FOLLOW-UP

Definition: important but does not prevent the approved release objective from functioning.

Action: record in the Follow-Up Register. Must not block release closure.

### Follow-Up Register Updates

Any `FOLLOW-UP` found during this CIS must be added to `CURRENT_TASK.md` with:

- ID
- Description
- Source release
- Suggested target release
- Priority
- Dependency
- Status
```
