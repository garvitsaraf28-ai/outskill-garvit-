# SuperLeap routine - v5 prompt (indexed payload)

Replaces v4, which was never able to run. v4 asked for the payload in the
same spelled-out form v3 used, and on 18 Aug the routine assembled it
correctly - 148,006 leads, every check passed - and then could not deliver
it. `create_file` has no way to reference a local file: the whole JSON has
to be emitted as one tool-call argument, and at 554,331 bytes it truncated
silently. The routine was right to stop rather than upload half a file into
a folder the workbook reads on a timer.

v5 changes only how the payload is written. Each distinct string is written
once into a dictionary and referenced by position everywhere after, which on
real data is a **3.9x cut - 389 KB down to 100 KB** - with no facts given up.
The workbook expands it on the way in, so no reader changes.

It also adds a fallback ladder: if the file is still too big, re-roll it at a
coarser grain rather than stopping. A coarser payload every twelve hours
beats no payload at all, and the workbook's shrink guard now watches leads
rather than rows so it accepts one.

v4 also carried two additions that stand, both because the lead status
report needs them and neither can be recovered afterwards:

- **`b`, the outcome, on every row.** One column per outcome is the whole
  report. Without `b` every lead lands in a single column and the table
  collapses to one number per agent - which is exactly what the first live
  post showed: `(none) 10,559`.
- **`batches`, the batch codes per month.** Asked for at the top of the
  report. They live in `lead_source`, not `source`; `source` is only the
  channel (Website, Manual, Inbound Call, Bulk Upload) and carries no code.

Everything else is v3 unchanged.

### What v3 got wrong about the source

v3 said `s` is the lead channel and not the workshop code. That is correct,
and it is also why the batch codes never arrived - nothing was reading the
field that has them. `lead_source` holds strings like
`C162 16th Aug 2026`, `BC14 4th August 2026` and
`Sales Success<>C159<>USD`. The code is in there; it has to be pulled out.

### Size, and what to give up first

The priority order when the file gets too big is written into STEP 7 below:
**the outcome is the report and must never be dropped; the source is a
dropdown, and older months are history.** Give those up in that order.

---

## The prompt

Refresh the SuperLeap lead payload that feeds the Outskill Inside Sales workbook. This is an unattended job: do the work, then stop. Do not message the user unless something is wrong that only they can fix.

STRICTLY READ-ONLY ON SUPERLEAP. Never call create_record, update_record or delete_records. This is a real company's live CRM.

STEP 0 - find the disposition-activity object.
List the SuperLeap objects available to you. Find the one that records call or disposition activity - in the UI it is "Call Disposition Activities", and its Updates view can be filtered to Today. Note its object_slug and the timestamp column that filter uses.

If you cannot find such an object, do not guess. Set "today_count" to null in the payload and continue with the rest. A null is honest; a wrong number is not.

STEP 1 - get the authoritative total FIRST.

Before anything else, run:

SELECT COUNT(*) AS n_slp_alias FROM lead WHERE created_at >= (date_part('epoch', TIMESTAMP '2026-04-01 00:00:00' AT TIME ZONE 'Asia/Kolkata')*1000)

Write that number down. It is the only thing that can prove a later result is complete. Every check in STEP 3 is against it.

STEP 2 - pull the breakdown, paginated.

execute_query is capped SERVER-SIDE at 2000 rows regardless of the LIMIT you write. A run on 17 Aug asked for LIMIT 60000, got exactly 2000 rows, and those 2000 rows held 84,844 of 147,570 leads - 43% of the leads and 60% of the agents silently missing. Do not assume any single query returned everything.

Page through it. Use a stable ORDER BY over the whole grouping key so pages cannot overlap or gap:

SELECT owner.name AS agent_slp_alias, owner.email AS email_slp_alias, source AS source_slp_alias, lead_source AS leadsource_slp_alias, to_char(to_timestamp(created_at/1000) AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') AS month_slp_alias, stage AS stage_slp_alias, dispositions AS disp_slp_alias, sub_disposition AS sub_slp_alias, COUNT(*) AS n_slp_alias FROM lead WHERE created_at >= (date_part('epoch', TIMESTAMP '2026-04-01 00:00:00' AT TIME ZONE 'Asia/Kolkata')*1000) GROUP BY owner.name, owner.email, source, lead_source, month_slp_alias, stage, dispositions, sub_disposition ORDER BY owner.name, owner.email, source, lead_source, month_slp_alias, stage, dispositions, sub_disposition LIMIT 1500 OFFSET <0, then 1500, 3000, ...>

Keep paging until a page returns fewer than 1500 rows. Then check the assembled set is unique on the grouping key - a duplicate means the ORDER BY was not total and the paging drifted.

If the to_char month expression is rejected, do not silently drop the month. Try the engine's equivalent (date_trunc, EXTRACT, strftime). If none works, STOP and say which you tried.

If lead_source is rejected as a column, do not stop the whole run over it - the batch codes are one line of the report and the rest is not. Emit "batches": {} and say so in STEP 8.

If SuperLeap is unreachable or a query errors, STOP. Write nothing. The workbook keeps its last good payload, which is far better than overwriting it with a partial one.

STEP 3 - prove it is complete.

Sum the n column across every row you assembled. That sum MUST equal the COUNT(*) from STEP 1 exactly.

If it does not, the result is truncated. STOP and write nothing. Say both numbers and how many rows you assembled.

This replaces the old "did the row count equal the LIMIT?" check, which was useless: the cap is 2000 and the LIMIT was 60000, so a truncated result never equalled it. Comparing against COUNT(*) catches every cap, named or not.

Also stop if the assembled set is under 100 rows. Sixty-odd agents across four months cannot produce a five-row breakdown; a tiny result means the query failed, not that the business lost its leads. On 17 Aug a payload of 5 rows was written and accepted, and the workbook posted a Slack report saying Inside Sales had one agent.

STEP 4 - count today's dispositions.
Using the object from STEP 0, count the disposition activities recorded today in Asia/Kolkata - midnight to now, not the last 24 hours. Group by agent as well as a grand total. If STEP 0 found nothing, use null.

STEP 5 - work out the outcome and the batch code.

THE OUTCOME, b. For each assembled row: b is sub_disposition where sub_disposition is set, and dispositions where it is not. Null or blank on both gives "". This is one field derived from two you already have; do not run another query for it.

That rule is the report's definition of an outcome and it is not negotiable. It is what puts "Non Contact-2" and "Not Interested" side by side as separate columns, which is how the report has always been read. Send b verbatim - do not tidy the spelling, merge similar values or map them onto a fixed list. The workbook decides which get their own column.

THE BATCH CODE. Read it out of lead_source, NOT out of source.

  lead_source                        code
  "C162 16th Aug 2026"               C162
  "BC14 4th August 2026"             BC14
  "Sales Success<>C159<>USD"         C159
  "CGEF64 - 2nd Aug"                 CGEF64
  null or no code in it              skip the row entirely

The code is the token made of letters followed by digits, optionally with a
trailing letter - C162, BC14, CBC15, CGEF64, BC12I. If the value contains
"<>", look at each segment and take the one that matches; otherwise take the
first whitespace-separated token and strip punctuation off it. Uppercase the
result. A value that yields no code contributes nothing - do not invent one
and do not put the raw string in.

Collect the distinct codes per month, sorted.

STEP 6 - roll up, then build the payload.

Do NOT write one row per grouping combination. Roll your assembled rows up into four separate aggregates:

  disp   agent + email + disposition        summed over everything else
  stage  agent + stage                      summed over everything else
  sub    agent + sub_disposition            only where sub is set
  rows   agent + month + source + outcome   summed over stage and sub

WRITE IT IN THE INDEXED FORM. This is the part that changed and it is not optional.

Spelling "Satyam Aditya Samant" out on every one of his rows is what made the last attempt 554,331 bytes, which could not be uploaded at all - create_file takes the whole file as one argument and it truncated silently partway through. Write each distinct string ONCE in a dictionary and use its position everywhere after. The same facts come to about a quarter of the size.

Build five lists, each holding distinct values in first-seen order:

  dict.a   agent names
  dict.e   emails
  dict.o   dispositions, sub-dispositions and outcomes - ONE shared list
  dict.g   stages
  dict.s   sources

An index is that value's 0-based position in its list. The months list is its own dictionary: a month index is a position in "months".

Then write compact JSON (no spaces, separators (',',':')) in exactly this shape:

{
 "version": 4,
 "snapshot": "<ISO 8601 timestamp, Asia/Kolkata +05:30, of when the query actually ran>",
 "from": "1 Apr 2026",
 "months": ["2026-04","2026-05","2026-06","2026-07","2026-08"],
 "batches": {"2026-08":["BC14","C160","C161","C162"]},
 "today_count": <grand total of dispositions today, or null>,
 "today_by_agent": [{"agent":"Niraj Paul","n":12}],
 "dict": {"a":["Niraj Paul","Ann Rao"],"e":["niraj.p+1@outskill.com","ann@outskill.com"],"o":["Non Contact","Non Contact-2","Lead"],"g":["Non Contact","Lead"],"s":["Website","Manual"]},
 "disp":  [[0,0,0,357]],
 "stage": [[0,0,412]],
 "sub":   [[0,1,88]],
 "rows":  [[0,4,0,1,88]]
}

What each position means:

  disp   [agent, email, disposition, count]      indexes into a, e, o
  stage  [agent, stage, count]                   indexes into a, g
  sub    [agent, sub_disposition, count]         indexes into a, o
  rows   [agent, month, source, outcome, count]  indexes into a, months, s, o

Read the example above literally: disp [0,0,0,357] is Niraj Paul, his email, "Non Contact", 357. rows [0,4,0,1,88] is Niraj Paul, 2026-08, Website, "Non Contact-2", 88.

today_by_agent stays as named objects. It is a hundred-odd entries and indexing it saves nothing worth the risk of getting it wrong.

Rules that matter:
- Every index must point at something. An index past the end of its list reads as a blank agent or a blank outcome in the report. Check the highest index in each column against the length of the list it points into before you write anything.
- The count is always the LAST value in the row. Nothing else about a row may be reordered either.
- agent is owner.name; use "(no owner)" when null - as a dictionary entry like any other.
- o is ONE shared list for disp, sub and rows. Do not build separate lists for dispositions and outcomes; they overlap heavily and one list is smaller.
- b (the outcome, STEP 5) is what rows point at, not the plain disposition.
- A lead with neither a disposition nor a sub-disposition points at an entry that is the empty string "". Include that entry in dict.o. Do not drop those rows - they are roughly half the leads.
- stage is never null; if one arrives null, use "(blank)".
- Counts are numbers, not strings.
- Sort disp, stage and sub by agent name; sort rows by agent, then month, then outcome. Sort by the STRINGS, then write the indexes.

STEP 7 - check the payload before writing it.

- The counts in disp must sum to the COUNT(*) from STEP 1.
- The counts in rows must sum to the COUNT(*) from STEP 1.
- Every index is within the length of the list it points into.
- Every key in "batches" is one of the months in "months".
- At least one row carries a non-empty outcome. If none does, the STEP 5 rule was not applied and the report will show a single "(none)" column - stop rather than send that.
- The finished JSON is under 400,000 bytes.

IF IT IS OVER 400,000 BYTES, do not stop. Work down this ladder, re-checking the size after each step, and take the first one that fits:

  1. Re-roll rows without the source: [agent, month, outcome, count]. Say you did.
  2. Restrict rows to the newest THREE months in "months". Leave disp, stage and sub covering the whole window - the churn tab needs them.
  3. Restrict rows to the newest ONE month.

Every rung still counts every lead in disp, so the workbook's shrink guard - which watches leads, not rows - will accept them all. Only if the file is still too big after rung 3 should you stop.

Report which rung you used. If you used any rung at all, that is worth knowing: it means the payload is outgrowing the format again.

Any other check fails: write nothing and say which.

STEP 8 - deliver it. ONE upload, and only when the content is final.

Never write a sample, a preview, a truncated version or a first attempt to that folder. Build the complete JSON, pass STEP 7, upload exactly once.

On 17 Aug a run uploaded a truncated sample, noticed, and re-uploaded correctly nine minutes later, reasoning that "the Apps Script only reads the newest file, so this doesn't affect the workbook". That is wrong. The workbook reads on its own two-hour timer, not after you finish, so it read the bad file during those nine minutes, rebuilt its tabs from 5 rows instead of 674, and posted a report to the sales team saying Inside Sales had one agent.

Anything in that folder is live the instant it lands. There is no draft state. If you have already uploaded something wrong, uploading a correction is still right - but report it as a problem, not as harmless, because somebody may need to reload the workbook.

Use the Google Drive MCP tool create_file with:
  title: slp_payload.json
  contentMimeType: text/plain
  disableConversionToGoogleType: true
  parentId: 1CC_abng7CqZbMaSWmj7xOPrbgasTjeTq
  textContent: the JSON string from STEP 6

Do not write anywhere else in Drive and do not touch any spreadsheet. The Apps Script side picks it up on its own timer.

STEP 9 - report in one line: the snapshot time, COUNT(*) and the summed total (they must match), the assembled row count and how many pages it took, the payload size in bytes, the number of distinct agents, months, sources and outcomes, how many batch codes in the newest month, and today_count. If STEP 0 failed, add "activity object not found". Say which rung of the size ladder you used, if any.

---

## What the workbook side does with it

`SlpPayload.gs` normalises whatever arrives - v1, v2, v3 or v4 - into the
one shape the readers understand. Three things about it matter here:

**It carries unknown keys across.** `slp_keepExtras_` copies every top-level
key the conversion did not rebuild, so a field added to this prompt reaches
the readers without an edit on the workbook side. This was not always true:
the conversions used to return a fresh object listing the keys they knew
about, which silently deleted `batches`.

**It stands `b` in for a missing disposition.** Rows here send no `d`, so
`slp_monthRow_` fills `disposition` from `bucket`. That keeps the SuperLeap
by Month page's breakdown column working on a payload that has no separate
disposition field.

**It expands the dictionary.** `slp_v4ToV3_` turns the indexes back into
strings before anything reads them, so the compact form costs the readers
nothing. An index pointing past the end of its list becomes a blank rather
than a number, so a mistake in one index costs one cell instead of putting
a stray "3" in the report where an agent's name belongs.

`slpPayloadSelfTest()` asserts all three - including that the same payload
written as v3 and as v4 normalises to the identical object - so a change
that reintroduces any of these bugs fails in the workbook rather than in a
Slack post.

The shrink guard now counts **leads, not rows**. That is what makes the size
ladder safe: rung 2 drops thousands of rows and not one lead, and the guard
passes it. A genuinely truncated payload loses both and is still refused.

Who reads what:

- **`Lead Report - India` / `Lead Report - International`** - one column per
  distinct `b`, agents grouped by office, one month at a time. Batch codes
  from `batches` at the top. Built by `buildLeadReportIndia()` and
  `buildLeadReportIntl()`; posted to Slack at 11:00 and 20:00 IST for India,
  19:00 and 04:00 for International.
- **`SuperLeap by Month`** - slices `rows` by month and source.
- **The churn and agent tabs** - `disp`, `stage` and `sub`, unchanged since v1.

## One thing to decide

`created_at` is when the lead **arrived**. Grouping on it answers "leads that
came in during August".

If the question is instead "work the team did during August" - calls made this
month against leads of any age - that is the disposition timestamp, a
different field and a different query. Both are reasonable monthly reports and
they will not match. Say which one is wanted before the sheet is built on it.
