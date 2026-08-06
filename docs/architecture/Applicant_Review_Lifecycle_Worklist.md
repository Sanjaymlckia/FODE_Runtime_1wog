# Applicant Review Lifecycle Worklist

Status: R412A local implementation. This projection is read-only: the
canonical applicant/admissions record remains lifecycle authority, while the
communication ledger remains evidence only.

## Current-trigger mapping

| Existing trigger | R412A primary bucket | Stage/reason |
| --- | --- | --- |
| Missing required upload / portal evidence | Documents — review / follow-up | Incomplete documents; identify the specific missing requirement before individual follow-up. |
| Required uploads present but not verified | Documents received — assessment / verification required | Documents need substantive admissions review. |
| Qualifying bound follow-up for the same requirement and stage | Pending applicant response | Wait for the applicant response or scheduled follow-up. |
| Three qualifying bound, distinct follow-ups with no response | Held in abeyance — no response | Stop routine re-chasing; reactivate only with new evidence or a new requirement. |
| Explicit hold/abeyance facts | Held in abeyance — other reason | Show the reason, review date, and reactivation condition. |
| Explicit active-work fact | Working on it | Show owner and due/review date. |
| Complete evidence / enrolment decision next | Ready for decision | Await authorised decision. |
| Admitted but not enrolled | Admitted — onboarding outstanding | Show outstanding downstream action. |
| No usable email or phone route | Lost / uncontactable | Contact correction/reporting only; never pending-contact or sendable. |
| Lifecycle mismatch or explicit integrity flag | Data / integrity exception | Resolve source, identity, or binding conflict before ordinary review. |
| Concluded lifecycle/outcome | Closed outcomes | Audit/search only; exclude from active work. |

No current trigger is silently mapped to a generic `Needs review` bucket. A
record with insufficient evidence receives `Ready for decision` with an
explicit canonical-evidence reason rather than an implicit review label.

## Follow-up evidence

`applicantReviewFollowupEvidence_()` counts only events with all of:

- `result: SENT`;
- `correctlyBound: true`;
- matching applicant, requirement, and lifecycle stage; and
- a distinct operation identity.

Drafts, previews, suppressions, failures, delivery-unknown events, unbound
events, and duplicate retries are excluded. Where requirement-scoped event
evidence is unavailable, the projection reports zero qualifying events and
does not infer an exhausted cycle from the row-level cadence counter.

## Local reconciliation result

The R412A regression fixture reconciles every test record to exactly one
`reviewBucketKey` or `CLOSED_OUTCOME`. The runtime preview exposes the same
per-row bucket, requirement, reason, waiting party, and source-evidence fields
without writing or reclassifying applicant records.
