# H4B Gmail Bounce Discovery and Applicant Match Report v01

Date: 2026-06-22
Classification: Track L - No Runtime Release
Result: PHASE B REPORT ONLY

## Scope and safety

- Gmail account inspected: `sanjay@minervacenters.com`.
- Access used read-only Gmail search/thread reads. No send, archive, delete, label, draft, or mailbox mutation occurred.
- Applicant matching used exact-email search and the existing read-only `admin_getApplicantDetail_json` RPC on Admin staging `r285 / 285`.
- No attachments or raw MIME were required.
- The review was bounded to the newest 20 matching delivery-status messages. A next-page token existed, so this is not a complete 90-day mailbox audit.
- Full message bodies, portal URLs, signatures/tokens, and unrelated mailbox content are excluded from this report.

## Gmail queries

```text
in:anywhere newer_than:90d "josiewabby27@gmail.com"
in:anywhere newer_than:90d (from:(mailer-daemon@google.com OR mailer-daemon@googlemail.com OR postmaster) OR subject:("Delivery Status Notification" OR "Address not found" OR "Message not delivered" OR "Delivery incomplete"))
in:anywhere newer_than:90d ("550 5.1.1" OR "NoSuchUser" OR "recipient address rejected" OR "user unknown" OR "domain not found")
```

Targeted follow-up:

```text
in:anywhere newer_than:90d ("akemrobertgm@il.com" OR "johnatuskamar71i@gmail.com" OR "bettysinowai50@gmail.com") from:(mailer-daemon@googlemail.com OR mailer-daemon@google.com)
```

## Discovery summary

| Measure | Result |
|---|---:|
| Delivery-status messages inspected | 20 |
| Final failure messages | 16 |
| Temporary delay messages | 4 |
| Unique failed recipient addresses | 15 |
| Exact single-applicant matches | 15 |
| High-confidence matches | 15 |
| Ambiguous matches | 0 |
| Unmatched recipients | 0 |

All 15 exact matches currently show:

- `Email_Status = SENT`
- `Email_Bounce_Flag = blank`
- `Email_Bounce_Reason = blank`
- `Email_Verification_Status = blank`
- `Last_Contact_Result = SENT`

## Matched evidence

| Bounce date | Failed recipient | Applicant | Gmail evidence | Message ref | Confidence |
|---|---|---|---|---|---|
| 2026-06-22 | `fallengjay@gmail.com` | `FODE-26-003163` - Jeromie Yessie | `550 5.1.1 NoSuchUser`; address not found | `19eedec8c81b1b76` | HIGH |
| 2026-06-21 | `josiewabby27@gmail.com` | `FODE-26-003157` - Jessica Wabianik | `550 5.1.1 NoSuchUser`; address not found | `19ee7b993849a790` | HIGH |
| 2026-06-20 | `listhenRongumaloyd@gmail.com` | `FODE-26-003151` - Listhen RONGUMA | `550 5.1.1 NoSuchUser`; address not found | `19ee31dfd0c3f1f6` | HIGH |
| 2026-06-18 | `andrewgabi@734.com` | `FODE-26-003123` - Andrew Gabi | Final delivery failure after delays; recipient server timed out | `19edcc1b1014ca4a` | HIGH |
| 2026-06-18 | `susanmaitok@gmail.com` | `FODE-26-003144` - Roland Kayver | `550 5.1.1 NoSuchUser`; address not found | `19eda93339bc1e31` | HIGH |
| 2026-06-15 | `akemrobertgm@il.com` | `FODE-26-003030` - Robert Akem | Final delivery failure after delays; connection refused | `19ecaa3a56f90871` | HIGH |
| 2026-06-15 | `johnatuskamar71i@gmail.com` | `FODE-26-003121` - John Kamari | `550 5.1.1 NoSuchUser`; address not found | `19eca4c74ac6c4ea` | HIGH |
| 2026-06-12 | `bettysinowai50@gmail.com` | `FODE-26-003109` - Steven Wemin | `550 5.1.1 NoSuchUser`; address not found | `19ebdb12510421f3` | HIGH |
| 2026-06-12 | `elizabeth38@gmail.com` | `FODE-26-003092` - Elizabeth Koaba | `550 5.1.1 NoSuchUser`; address not found | `19ebaa89d10342b7` | HIGH |
| 2026-06-12 | `davidemo964@gmail.com` | `FODE-26-003073` - David Emo | `550 5.1.1 NoSuchUser`; address not found | `19ebaa76bcb5046e` | HIGH |
| 2026-06-12 | `Jerethalonk@gmail.com` | `FODE-26-003058` - Alonk Jared | Two duplicate `550 5.1.1 NoSuchUser` failures | `19ebaa64747bd92b`, `19ebaa62e4c1aa83` | HIGH |
| 2026-06-12 | `Mundix@gmail.com` | `FODE-26-003053` - Christiand Makasu | `550 5.1.1 NoSuchUser`; address not found | `19ebaa5cbbc13135` | HIGH |
| 2026-06-12 | `Senomaken45@gmail.com` | `FODE-26-003052` - seno Maken | `550 5.1.1 NoSuchUser`; address not found | `19ebaa5b04a80c77` | HIGH |
| 2026-06-12 | `senomaken@45gimail.com` | `FODE-26-003051` - seno Maken | NXDOMAIN; recipient domain not found | `19ebaa521a6c3efd` | HIGH |
| 2026-06-12 | `makausantis@gmail.com` | `FODE-26-003040` - Kollen Makau | `550 5.1.1 NoSuchUser`; address not found | `19ebaa3ee07ad57d` | HIGH |

Confidence is HIGH because each DSN exposes the exact failed recipient, the related outbound is FODE-originated, and exact-email Admin search returned one applicant with the same effective email.

## Known example

`josiewabby27@gmail.com` matched `FODE-26-003157` / Jessica Wabianik. Gmail proves `550 5.1.1 NoSuchUser`, while the runtime still reports `SENT` with no bounce flag, reason, or verification state. The known contactability defect is confirmed.

## Phase C marking safety design

The existing runtime vocabulary and `applyBounceStateToRow_()` support:

- `Email_Bounce_Flag = YES`
- `Email_Bounce_Reason = <normalized classification and short reason>`
- `Email_Status = BOUNCED`
- clearing `Email_Next_Action_Date` for hard/invalid/blocked results

Recommended first controlled marking pass:

1. Use a one-time Apps Script dry-run/apply tool, not direct manual Sheet editing.
2. Allow only explicitly reviewed HIGH-confidence applicant IDs.
3. Require exact current effective-email equality before proposing any patch.
4. Export/back up the affected rows before apply.
5. Produce a dry-run report showing current and proposed values.
6. Require separate explicit operator approval for apply mode.
7. Skip changed, missing, duplicate, medium/low-confidence, or unmatched rows.
8. Record Gmail message reference, classification, reason, and evidence date in the dry-run audit.

Proposed values:

- `550 5.1.1 NoSuchUser`, address-not-found, and NXDOMAIN: classify `INVALID`; set bounce flag `YES`, reason `INVALID: <short reason>`, status `BOUNCED`.
- Final timeout/connection-refused DSNs: classify `HARD`; set bounce flag `YES`, reason `HARD: <short reason>`, status `BOUNCED`.

Do not set `Email_Verification_Status` or overwrite `Last_Contact_Result` in the first pass. Current bounce ingestion does not update those fields, and changing them would introduce new semantics. Existing runtime advisory/dashboard logic already recognizes `Email_Bounce_Flag`, `Email_Bounce_Reason`, and `Email_Status`.

## Recommendation

Proceed next with a separately approved Track H controlled marking tool using mandatory dry-run and exact applicant/email allowlisting. Do not enable broad Gmail ingestion or automatic row mutation in the same slice.

Before approving any controlled marking, extend discovery to the designated Outlook/mail bounce folder if access is available. An older mail automation may have moved delivery-failure messages out of the inbox, so the bounded Gmail results above may undercount historical bounces.

Required future corrective action:

1. Identify the bounce-mail folder name, mailbox, and location.
2. Inspect that folder read-only without moving, labelling, deleting, or modifying messages.
3. Extract only failed recipient, error code/reason, date, source-message context, and message reference.
4. Match exact failed recipients to FODE applicant emails.
5. Merge and deduplicate Outlook-folder and Gmail discovery evidence.
6. Produce a new dry-run match report before any FODE row mutation.
7. Do not edit Sheets, update FODE rows, send email, or automate WhatsApp during discovery.

Contactability marking or advisory implementation should not be approved as complete until this secondary bounce source is either inspected or explicitly confirmed unavailable.

## Safety confirmation

- No Gmail messages were modified.
- No Outlook/mail-folder messages were accessed or modified.
- No Sheet rows were modified.
- No Drive data was modified.
- No runtime files were changed.
- No sends occurred.
- No Apps Script version, deployment, or repin occurred.
- Production and Student staging were untouched.
- OPS remained frozen.
