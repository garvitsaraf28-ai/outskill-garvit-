# SuperLeap routine - v4 prompt (outcome per row, batch codes)

Replaces v3. Two additions, both because the lead status report needs them
and neither can be recovered afterwards:

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

v3's row grain was agent x month x source x disposition. Adding the outcome
on top of that multiplies the array. The priority order when the file gets
too big is written into STEP 6 below: **the outcome is the report and must
never be dropped; the source is a dropdown and can be.**

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

Do NOT write one row per grouping combination. That is what the first v3 draft did and it produced 1,015,020 bytes, which create_file cannot accept inline. Nothing slices stage or sub-disposition by month, so those two do not belong in the month array.

Roll your assembled rows up into four separate aggregates:

  disp   agent + email + disposition        summed over everything else
  stage  agent + stage                      summed over everything else
  sub    agent + sub_disposition            only where sub is set
  rows   agent + month + source + outcome   summed over stage and sub

Then write compact JSON (no spaces, separators (',',':')) in exactly this shape:

{
 "version": 3,
 "snapshot": "<ISO 8601 timestamp, Asia/Kolkata +05:30, of when the query actually ran>",
 "from": "1 Apr 2026",
 "months": ["2026-04", ... every month present, ascending],
 "batches": {"2026-08": ["BC14","C160","C161","C162"], "2026-07": [...]},
 "today_count": <grand total of dispositions today, or null>,
 "today_by_agent": [{"agent":"...","n":12}, ...],
 "disp":  [["Niraj Paul","niraj.p+1@outskill.com","Non Contact",357], ...],
 "stage": [["Niraj Paul","Non Contact",412], ...],
 "sub":   [["Niraj Paul","Non Contact-2",88], ...],
 "rows":  [{"a":"Niraj Paul","m":"2026-08","s":"Website","b":"Non Contact-2","n":88}, ...]
}

"version" stays 3. The workbook's normaliser reads a version number, not a prompt number, and 3 is the shape it knows - b and batches are additions to that shape, not a new one. It carries across any key it does not recognise, so this cannot break it.

disp, stage and sub are EXACTLY the three arrays v1 sent, positional and unchanged. Every existing reader in the workbook already understands them.

rows uses short keys on purpose: a=agent, m=month, s=source, b=outcome, n=count.

Rules that matter:
- agent is owner.name; use "(no owner)" when null.
- In disp, send the email on an agent's FIRST row and "" after. In rows, omit email entirely.
- s is SuperLeap's source field - the lead channel (Website, Inbound Call, Manual, Bulk Upload), NOT the batch code. Use "(no source)" when null.
- b is the outcome from STEP 5. A row with neither a disposition nor a sub-disposition sends "" - do not drop those rows, they are roughly half the leads.
- d is not sent on rows at all. b is the finer answer to the same question and disp already carries the disposition rollup.
- sub only includes rows where sub_disposition is set.
- stage is never null; if one arrives null, send "(blank)".
- n is a number, not a string.
- Sort disp, stage and sub by agent; sort rows by agent, then month, then outcome.

STEP 7 - check the payload before writing it.

- The n values in disp must sum to the COUNT(*) from STEP 1.
- The n values in rows must sum to the COUNT(*) from STEP 1.
- Every month in "months" appears on at least one row, and no row carries a month outside it.
- Every key in "batches" is one of the months in "months".
- At least one row carries a non-empty b. If none does, the STEP 5 rule was not applied and the report will show a single "(none)" column - stop rather than send that.
- The finished JSON is under 600,000 bytes.

If it is over 600,000 bytes: re-roll rows WITHOUT s, at agent + month + outcome, and check again. Give up the source before the outcome, every time - the outcome is the report itself, the source is one dropdown on one tab. Say in STEP 8 that you dropped it and what the size was. Only if it is still over after that should you stop.

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

STEP 9 - report in one line: the snapshot time, COUNT(*) and the summed total (they must match), the assembled row count and how many pages it took, the payload size in bytes, the number of distinct agents, months, sources and outcomes, how many batch codes in the newest month, and today_count. If STEP 0 failed, add "activity object not found". If you dropped s, say so.

---

## What the workbook side does with it

`SlpPayload.gs` normalises whatever arrives - v1, v2 or v3 - into the one
shape the readers understand. Two things about it matter here:

**It carries unknown keys across.** `slp_keepExtras_` copies every top-level
key the conversion did not rebuild, so a field added to this prompt reaches
the readers without an edit on the workbook side. This was not always true:
the conversions used to return a fresh object listing the keys they knew
about, which silently deleted `batches`.

**It stands `b` in for a missing disposition.** Rows here send no `d`, so
`slp_monthRow_` fills `disposition` from `bucket`. That keeps the SuperLeap
by Month page's breakdown column working on a payload that has no separate
disposition field.

`slpPayloadSelfTest()` asserts both, so a change that reintroduces either bug
fails in the workbook rather than in a Slack post.

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
