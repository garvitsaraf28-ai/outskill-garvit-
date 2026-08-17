# SuperLeap routine — v3 prompt (month, workshop, named fields)

Replaces v2. Three changes.

1. **Month.** Neither v1 nor v2 puts a date in the GROUP BY, so the payload is
   every lead since 1 April collapsed into one bucket — 80,294 of them. No
   filter in the sheet can recover a month from that, because the rows were
   summed before they arrived. The Slack report needs the current month and
   the sheet needs a month dropdown; both need the month to be in the data.

2. **Named fields instead of positions.** v2 inserted `source` at index 2 and
   every reader still indexed the v1 positions, so a v2 payload would have
   read workshop codes as dispositions and counts as `NaN` — no error, just a
   tab full of nonsense. Adding month would shift them a third time. Named
   keys end that class of bug permanently: a reader that does not know a field
   ignores it, and one that needs it asks for it by name.

3. **Row count.** Adding month multiplies the rows again. The limit goes up
   and the count is checked explicitly, because a silently truncated payload
   is a report that is quietly missing agents.

---

## The prompt

Refresh the SuperLeap lead payload that feeds the Outskill Inside Sales workbook. This is an unattended job: do the work, then stop. Do not message the user unless something is wrong that only they can fix.

STRICTLY READ-ONLY ON SUPERLEAP. Never call create_record, update_record or delete_records. This is a real company's live CRM.

STEP 0 - find the disposition-activity object.
List the SuperLeap objects available to you. Find the one that records call or disposition activity — in the UI it is "Call Disposition Activities", and its Updates view can be filtered to Today. Note its object_slug and the timestamp column that filter uses (something like updated_at, activity_at or created_at).

If you cannot find such an object, do not guess. Set "today_count" to null in the payload and continue with the rest. A null is honest; a wrong number is not.

STEP 1 - pull the breakdown, now with the month.
Use execute_query on object_slug "lead" with exactly this SQL:

SELECT owner.name AS agent_slp_alias, owner.email AS email_slp_alias, source AS source_slp_alias, to_char(to_timestamp(created_at/1000) AT TIME ZONE 'Asia/Kolkata', 'YYYY-MM') AS month_slp_alias, stage AS stage_slp_alias, dispositions AS disp_slp_alias, sub_disposition AS sub_slp_alias, COUNT(*) AS n_slp_alias FROM lead WHERE created_at >= (date_part('epoch', TIMESTAMP '2026-04-01 00:00:00' AT TIME ZONE 'Asia/Kolkata')*1000) GROUP BY owner.name, owner.email, source, month_slp_alias, stage, dispositions, sub_disposition LIMIT 60000

The month is derived from created_at in Asia/Kolkata, so a lead created at 00:30 IST on the 1st belongs to that month and not the previous one. It is formatted YYYY-MM because that sorts correctly as text and carries the year — month names alone cannot be ordered across a year boundary.

If that to_char expression is rejected, do not silently drop the month. Try the engine's own equivalent (date_trunc, EXTRACT, strftime). If none works, STOP and say which expressions you tried. A payload without a month is the thing this version exists to fix.

The result is large and will be saved to a file rather than returned inline. That is expected. Read it with python or jq, not by pasting it into context. Schema: {records: {records: [{...}]}}.

If SuperLeap is unreachable or the query errors, STOP. Write nothing. The workbook keeps its last good payload, which is far better than overwriting it with a partial one. Say so in one line and end.

STEP 2 - check the query was not truncated, and was not nearly empty.

Count the rows returned.

If it equals the LIMIT exactly, the result was cut off and agents are missing from the tail. STOP, write nothing, and say the limit was hit — do not write a partial payload. Raise the limit and run again.

If it is FEWER THAN 100 rows, STOP and write nothing. Say how many rows came back and what the query was. An Inside Sales team of sixty-odd agents against four months of leads cannot produce a five-row breakdown; a tiny result means the query failed, returned an error page, or hit an empty connection — not that the business lost its leads.

This is not hypothetical. On 17 Aug this routine wrote a payload containing 5 rows, and on 12 Aug one containing 16. Both were valid JSON in the correct shape, so the workbook accepted them, rebuilt its tabs from almost nothing, and posted a Slack report to the sales team saying Inside Sales had one agent and 123 leads. Writing nothing at all would have been correct in both cases: the workbook keeps its last good payload and simply reports slightly stale numbers until the next run.

A partial payload is worse than no payload. If anything about the result looks thin, stop.

STEP 3 - count today's dispositions.
Using the object found in step 0, count the disposition activities recorded today in Asia/Kolkata — midnight to now, not the last 24 hours. Group the count by agent as well as a grand total, so the report can show both.

If step 0 found nothing, skip this and use null.

STEP 4 - build the payload.
Write compact JSON (no spaces, separators (',',':')) in this exact shape. Note that every row is an OBJECT with named keys, not a positional array — that is the point of v3:

{
 "version": 3,
 "snapshot": "<ISO 8601 timestamp, Asia/Kolkata +05:30, of when the query actually ran>",
 "from": "1 Apr 2026",
 "months": ["2026-04", ... every month present, ascending],
 "today_count": <grand total of dispositions today, or null>,
 "today_by_agent": [{"agent":"...","n":12}, ...],
 "rows": [
   {"agent":"Niraj Paul","email":"niraj.p+1@outskill.com","source":"C160",
    "month":"2026-08","stage":"Non Contact","disposition":"Non Contact",
    "sub":"Non Contact-2","n":357},
   ...
 ]
}

One "rows" array replaces the three of v1 and v2. Those were three separate rollups of the same query, which lost the correlation between them — you could not ask how many Non Contact leads for workshop C160 were at sub-disposition NC-3, because stage, disposition and sub were summed apart from each other. One row carrying every dimension lets the sheet roll up whichever way each page needs.

Rules that matter:
- agent is owner.name; use "(no owner)" when it is null.
- email: send it on every row. v1 and v2 sent it only on an agent's first row to keep the file small; with named keys that saving is not worth the fragility of a reader having to remember.
- source is the workshop code. Use "(no source)" when null. Send it verbatim - do not tidy, trim or reformat it, because the workbook matches on the exact string.
- disposition: a null MUST be sent as the empty string "". The reader turns "" into "Not dispositioned yet". Do not send the word null and do not drop those rows - they are roughly half the leads.
- sub: send "" when there is no sub_disposition. Do not omit the key.
- stage is never null in SuperLeap; if one arrives null, send "(blank)".
- n is a number, not a string.
- Sort rows by agent, then month, then source, so the file is stable between runs and two payloads can be diffed.

STEP 5 - sanity check before writing.
The "n" values across all rows must sum to the total row count of the query. If they do not, stop and do not write.

Also check every month in "months" appears on at least one row, and that no row carries a month outside it. A month in the list with no rows behind it would show as an empty selection in the sheet's dropdown.

STEP 6 - deliver it.
Use the Google Drive MCP tool create_file with:
  title: slp_payload.json
  contentMimeType: text/plain
  disableConversionToGoogleType: true
  parentId: 1CC_abng7CqZbMaSWmj7xOPrbgasTjeTq
  textContent: the JSON string from step 4

That folder is shared by the workbook owner specifically for this. Do not write anywhere else in Drive and do not touch any spreadsheet.

The Apps Script side picks it up on its own timer: it reads the newest slp_payload.json in that folder, rebuilds the SuperLeap tabs and the churn report, and bins older payloads. You do not need to trigger anything in the workbook, and you must never edit the workbook directly.

STEP 7 - report in one line: the snapshot time, the row count against the limit, the total lead count, the number of distinct agents, months and sources, and today_count. If step 0 failed to find the activity object, add "activity object not found" to that line.

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
