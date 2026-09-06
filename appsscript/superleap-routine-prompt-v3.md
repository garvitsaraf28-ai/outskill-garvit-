# SuperLeap routine — v3 prompt (month, workshop, named fields)

> **Superseded by `superleap-routine-prompt-v5.md`.** v3 sends no outcome on
> its rows and no batch codes, so the lead status report built on it shows
> every lead in one column called `(none)` and no batches. Kept for the
> history of why the payload has the shape it has. **v5 is the live prompt**
> - v4 named those two fields but was never deliverable at its size.

Replaces v2. The month and the workshop code get into the payload, so the
Slack report can show the current month and the sheet can have a month
dropdown. Neither is possible today: v1 collapses every lead since 1 April
into one bucket, and a month cannot be recovered from rows that were summed
before they arrived.

**Additive, not a redesign.** `disp`, `stage` and `sub` stay exactly as v1
sends them - positional, unchanged, already understood by every reader in the
workbook. One new array, `rows`, carries the month and workshop dimension.
Nothing that works today is disturbed.

### Two things a real run taught us, the hard way

**The 60000 LIMIT was a fiction.** `execute_query` is capped server-side at
**2000 rows**. A run asked for 60000, got exactly 2000, and those held 84,844
of 147,570 leads - 43% of leads and 60% of agents missing. The old check
("did the row count equal the LIMIT?") could never catch it, because 2000 is
not 60000. The check is now: **does the summed `n` equal `SELECT COUNT(*)`?**
That catches any cap, named or not. The query is paginated with a total
`ORDER BY`.

**One row per dimension combination was too big to deliver.** The first draft
put agent x source x month x stage x disposition x sub in one array with long
key names: 5,731 rows, **1,015,020 bytes**, and `create_file` only takes
content inline. Nothing slices stage or sub by month or workshop, so they do
not belong in the month array. Rolled up to agent x month x source x
disposition with short keys, the file lands around 200-300 KB.

Both failures were found by the routine itself, which stopped rather than
uploading. That was the right call and the prompt now makes it a rule.

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

SELECT owner.name AS agent_slp_alias, owner.email AS email_slp_alias, source AS source_slp_alias, to_char(to_timestamp(created_at/1000) AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') AS month_slp_alias, stage AS stage_slp_alias, dispositions AS disp_slp_alias, sub_disposition AS sub_slp_alias, COUNT(*) AS n_slp_alias FROM lead WHERE created_at >= (date_part('epoch', TIMESTAMP '2026-04-01 00:00:00' AT TIME ZONE 'Asia/Kolkata')*1000) GROUP BY owner.name, owner.email, source, month_slp_alias, stage, dispositions, sub_disposition ORDER BY owner.name, owner.email, source, month_slp_alias, stage, dispositions, sub_disposition LIMIT 1500 OFFSET <0, then 1500, 3000, ...>

Keep paging until a page returns fewer than 1500 rows. Then check the assembled set is unique on the grouping key - a duplicate means the ORDER BY was not total and the paging drifted.

If the to_char month expression is rejected, do not silently drop the month. Try the engine's equivalent (date_trunc, EXTRACT, strftime). If none works, STOP and say which you tried. A payload without a month is what this version exists to fix.

If SuperLeap is unreachable or a query errors, STOP. Write nothing. The workbook keeps its last good payload, which is far better than overwriting it with a partial one.

STEP 3 - prove it is complete.

Sum the n column across every row you assembled. That sum MUST equal the COUNT(*) from STEP 1 exactly.

If it does not, the result is truncated. STOP and write nothing. Say both numbers and how many rows you assembled.

This replaces the old "did the row count equal the LIMIT?" check, which was useless: the cap is 2000 and the LIMIT was 60000, so a truncated result never equalled it. Comparing against COUNT(*) catches every cap, named or not.

Also stop if the assembled set is under 100 rows. Sixty-odd agents across four months cannot produce a five-row breakdown; a tiny result means the query failed, not that the business lost its leads. On 17 Aug a payload of 5 rows was written and accepted, and the workbook posted a Slack report saying Inside Sales had one agent.

STEP 4 - count today's dispositions.
Using the object from STEP 0, count the disposition activities recorded today in Asia/Kolkata - midnight to now, not the last 24 hours. Group by agent as well as a grand total. If STEP 0 found nothing, use null.

STEP 5 - roll up, then build the payload.

Do NOT write one row per grouping combination. That is what the first v3 draft did and it produced 1,015,020 bytes, which create_file cannot accept inline. Nothing slices stage or sub-disposition by month or workshop, so those two do not belong in the month array.

Roll your assembled rows up into four separate aggregates:

  disp   agent + email + disposition          summed over everything else
  stage  agent + stage                        summed over everything else
  sub    agent + sub_disposition              only where sub is set
  rows   agent + month + source + disposition summed over stage and sub

Then write compact JSON (no spaces, separators (',',':')) in exactly this shape:

{
 "version": 3,
 "snapshot": "<ISO 8601 timestamp, Asia/Kolkata +05:30, of when the query actually ran>",
 "from": "1 Apr 2026",
 "months": ["2026-04", ... every month present, ascending],
 "today_count": <grand total of dispositions today, or null>,
 "today_by_agent": [{"agent":"...","n":12}, ...],
 "disp":  [["Agent One","agent.one@example.com","Non Contact",357], ...],
 "stage": [["Agent One","Non Contact",412], ...],
 "sub":   [["Agent One","Non Contact-2",88], ...],
 "rows":  [{"a":"Agent One","m":"2026-08","s":"C160","d":"Non Contact","n":357}, ...]
}

disp, stage and sub are EXACTLY the three arrays v1 sent, positional and unchanged. Every existing reader in the workbook already understands them, which is why they stay as they are - the month upgrade must not disturb what already works.

rows is the new part and the only new part. Short keys on purpose: a=agent, m=month, s=source, d=disposition, n=count. At this grain the file lands around 200-300 KB instead of a megabyte.

Rules that matter:
- agent is owner.name; use "(no owner)" when null.
- In disp, send the email on an agent's FIRST row and "" after. In rows, omit email entirely.
- s is SuperLeap's source field - the lead channel (Website, Inbound Call, Manual, Bulk Upload), NOT the workshop code. An earlier version of this prompt called it the workshop code; a real payload proved otherwise, returning five channel values and no batch codes. Use "(no source)" when null and send it verbatim.
- d: a null disposition MUST be the empty string "". The reader turns "" into "Not dispositioned yet". Do not send the word null and do not drop those rows - they are roughly half the leads.
- sub only includes rows where sub_disposition is set.
- stage is never null; if one arrives null, send "(blank)".
- n is a number, not a string.
- Sort disp, stage and sub by agent; sort rows by agent, then month, then source.

STEP 6 - check the payload before writing it.

- The n values in disp must sum to the COUNT(*) from STEP 1.
- The n values in rows must sum to the COUNT(*) from STEP 1.
- Every month in "months" appears on at least one row, and no row carries a month outside it.
- The finished JSON is under 600,000 bytes. If it is larger, STOP and say the size. Do not try to emit it anyway - a truncated emission uploads corrupt JSON, which is worse than uploading nothing.

Any check fails: write nothing and say which.

STEP 7 - deliver it. ONE upload, and only when the content is final.

Never write a sample, a preview, a truncated version or a first attempt to that folder. Build the complete JSON, pass STEP 6, upload exactly once.

On 17 Aug a run uploaded a truncated sample, noticed, and re-uploaded correctly nine minutes later, reasoning that "the Apps Script only reads the newest file, so this doesn't affect the workbook". That is wrong. The workbook reads on its own two-hour timer, not after you finish, so it read the bad file during those nine minutes, rebuilt its tabs from 5 rows instead of 674, and posted a report to the sales team saying Inside Sales had one agent.

Anything in that folder is live the instant it lands. There is no draft state. If you have already uploaded something wrong, uploading a correction is still right - but report it as a problem, not as harmless, because somebody may need to reload the workbook.

Use the Google Drive MCP tool create_file with:
  title: slp_payload.json
  contentMimeType: text/plain
  disableConversionToGoogleType: true
  parentId: 1CC_abng7CqZbMaSWmj7xOPrbgasTjeTq
  textContent: the JSON string from STEP 5

Do not write anywhere else in Drive and do not touch any spreadsheet. The Apps Script side picks it up on its own timer.

STEP 8 - report in one line: the snapshot time, COUNT(*) and the summed total (they must match), the assembled row count and how many pages it took, the payload size in bytes, the number of distinct agents, months and sources, and today_count. If STEP 0 failed, add "activity object not found".

---

## What the workbook side needs

**Done — `SlpPayload.gs` (`appsscript/slp-payload.gs`).** The readers are not
replaced. A normaliser sits in front of them and converts v1, v2 or v3 into
the one shape they already understand, carrying month and workshop alongside
rather than discarding them. `slp_payloadVersion_` detects the version from
the row shape, so a v1 file already sitting in Drive keeps working during the
changeover instead of being misread.

Wiring it in is two one-line changes, both documented in that file's header:
`slpAutoRefresh` and `slpLoadFromDrive` each normalise `text` before parsing
it. Until those two lines are in, **do not point the routine at v3** — a v3
payload has no `disp` key, so `slpAutoRefresh` would stop at its guard, log
"payload has no disposition rows", and leave the workbook showing its last
good numbers every two hours without ever saying why.

Order of operations, therefore: paste `SlpPayload.gs`, make the two edits, run
`slpPayloadSelfTest()` and `slpPayloadCheck()`, and only then switch the
routine to this prompt.

Once `rows` carries month and source:

- **Slack, current month.** Filter `rows` to the newest entry in `months`.
  That is the report asked for; today it publishes four and a half months
  stacked together.
- **Sheet, month and workshop dropdowns.** Same pattern the Agent, Manager and
  Rhythm pages already use: a hidden lookup tab keyed `month|source|agent`,
  the visible tab INDEX/MATCHing against two data-validation cells. That is
  exactly how `buildOverallReport` drives `_OverallData`, so it is a shape the
  workbook already proves.

## One thing to decide

`created_at` is when the lead **arrived**. Grouping on it answers "leads that
came in during August".

If the question is instead "work the team did during August" — calls made this
month against leads of any age — that is the disposition timestamp, a
different field and a different query. Both are reasonable monthly reports and
they will not match. Say which one is wanted before the sheet is built on it.
