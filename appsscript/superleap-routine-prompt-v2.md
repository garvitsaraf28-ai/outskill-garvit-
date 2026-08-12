# SuperLeap routine — v2 prompt (churn report)

Replaces the v1 prompt. Two things change:

1. **Workshop code.** The churn report groups by workshop (C160, C155). That
   code lives in the lead's **source** field, which v1 never selected, so the
   payload has no workshop dimension at all.

2. **Dispositions today.** The report opens with a count of dispositions done
   today. The SuperLeap UI exposes this under *Call Disposition Activities >
   Updates > Today*, but the object and timestamp column behind that filter are
   not known here — so the prompt has the agent discover them rather than
   guessing a field name that would fail silently at 04:00.

The discovery step runs every fire. It is a few seconds against a schema that
rarely changes, and it is cheaper than a payload that is quietly wrong.

---

## The prompt

Refresh the SuperLeap lead payload that feeds the Outskill Inside Sales workbook. This is an unattended job: do the work, then stop. Do not message the user unless something is wrong that only they can fix.

STRICTLY READ-ONLY ON SUPERLEAP. Never call create_record, update_record or delete_records. This is a real company's live CRM.

STEP 0 - find the disposition-activity object.
List the SuperLeap objects available to you. Find the one that records call or disposition activity — in the UI it is "Call Disposition Activities", and its Updates view can be filtered to Today. Note its object_slug and the timestamp column that filter uses (something like updated_at, activity_at or created_at).

If you cannot find such an object, do not guess. Set "today_count" to null in the payload and continue with the rest. A null is honest; a wrong number is not.

STEP 1 - pull the stage and disposition breakdown.
Use execute_query on object_slug "lead" with exactly this SQL:

SELECT owner.name AS agent_slp_alias, owner.email AS email_slp_alias, source AS source_slp_alias, stage AS stage_slp_alias, dispositions AS disp_slp_alias, sub_disposition AS sub_slp_alias, COUNT(*) AS n_slp_alias FROM lead WHERE created_at >= (date_part('epoch', TIMESTAMP '2026-04-01 00:00:00' AT TIME ZONE 'Asia/Kolkata')*1000) GROUP BY owner.name, owner.email, source, stage, dispositions, sub_disposition LIMIT 20000

Note the two changes from before: source is now selected and grouped, and the limit is raised because adding source multiplies the row count.

The result is large and will be saved to a file rather than returned inline. That is expected. Read it with python or jq, not by pasting it into context. Schema: {records: {records: [{...}]}}.

If SuperLeap is unreachable or the query errors, STOP. Write nothing. The workbook keeps its last good payload, which is far better than overwriting it with a partial one. Say so in one line and end.

STEP 2 - count today's dispositions.
Using the object found in step 0, count the disposition activities recorded today in Asia/Kolkata — midnight to now, not the last 24 hours. Group the count by agent as well as a grand total, so the report can show both.

If step 0 found nothing, skip this and use null.

STEP 3 - build the payload.
Aggregate into this exact shape and write it as compact JSON (no spaces, separators (',',':')):

{
 "snapshot": "<ISO 8601 timestamp, Asia/Kolkata +05:30, of when the query actually ran>",
 "from": "1 Apr 2026",
 "today_count": <grand total of dispositions today, or null>,
 "today_by_agent": [[agentName, count], ...],
 "disp":  [[agentName, email, source, disposition, count], ...],
 "stage": [[agentName, source, stage, count], ...],
 "sub":   [[agentName, source, subDisposition, count], ...]
}

Rules that matter:
- agentName is owner.name; use "(no owner)" when it is null.
- source is the workshop code. Use "(no source)" when it is null. Send it verbatim - do not tidy, trim or reformat it, because the workbook matches on the exact string.
- In "disp", a null disposition MUST be sent as the empty string "". The reader turns "" into "Not dispositioned yet". Do not send the word null and do not drop those rows - they are roughly half the leads.
- In "disp", send the email only on an agent's FIRST row and "" on their later rows. The reader keeps the first non-blank one. This is purely to keep the file small.
- "sub" only includes rows where sub_disposition is set.
- Sort each array so the file is stable between runs.
- Sanity check before writing: the counts in "disp" must sum to the total row count of the query. If they do not, stop and do not write.

STEP 4 - deliver it.
Use the Google Drive MCP tool create_file with:
  title: slp_payload.json
  contentMimeType: text/plain
  disableConversionToGoogleType: true
  parentId: 1CC_abng7CqZbMaSWmj7xOPrbgasTjeTq
  textContent: the JSON string from step 3

That folder is shared by the workbook owner specifically for this. Do not write anywhere else in Drive and do not touch any spreadsheet.

The Apps Script side picks it up on its own timer: it reads the newest slp_payload.json in that folder, rebuilds the SuperLeap tabs and the churn report, and bins older payloads. You do not need to trigger anything in the workbook, and you must never edit the workbook directly.

STEP 5 - report in one line: the snapshot time, the total lead count, the row counts for disp/stage/sub, the number of distinct sources, and today_count. If step 0 failed to find the activity object, add "activity object not found" to that line.
