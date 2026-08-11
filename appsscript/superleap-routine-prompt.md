# SuperLeap routine — recreation prompt

The existing routine (`trig_018Gaz2pUVVHTAZKUPEJnjD6`, cron `55 */2 * * *`)
fires on schedule but stops on a tool-permission prompt every run, because its
approved-tool list contains only built-in tools:

```
preset:default, Task, Bash, Glob, Grep, Read, Edit, MultiEdit, Write,
NotebookEdit, WebFetch, TodoWrite, WebSearch, BashOutput, KillBash,
Skill, Tmux, Monitor, SendUserFile, REPL
```

No SuperLeap, no Google Drive. A routine inherits the approved tools of the
session that creates it, and this one was created by a session that had none
of those grants — which is why approving at the prompt never sticks. Each fire
is a fresh session, so each fire asks again.

Recreating it from a session that already holds those grants is what fixes it.

## Steps

1. Open a new Claude session with **SuperLeap** and **Google Drive** connected.
2. Exercise both tools by hand once, approving each with the persistent option
   ("Always allow" / "Don't ask again") rather than a one-time Allow:
   - a SuperLeap `execute_query` — any small read
   - a Google Drive write into folder `1CC_abng7CqZbMaSWmj7xOPrbgasTjeTq`
3. In that same session, ask it to create a routine on cron `55 */2 * * *`
   using the prompt below verbatim.
4. Confirm the new routine's approved tools include the SuperLeap and Drive
   tools, then delete the old one: `trig_018Gaz2pUVVHTAZKUPEJnjD6`.

Verify by waiting for one unattended fire and checking that a fresh
`slp_payload.json` appears in the folder without anyone clicking anything.

## The prompt, verbatim

Refresh the SuperLeap lead payload that feeds the Outskill Inside Sales workbook. This is an unattended job: do the work, then stop. Do not message the user unless something is wrong that only they can fix.

STRICTLY READ-ONLY ON SUPERLEAP. Never call create_record, update_record or delete_records. This is a real company's live CRM.

STEP 1 - pull the data.
Use the SuperLeap MCP tool execute_query on object_slug "lead" with exactly this SQL:

SELECT owner.name AS agent_slp_alias, owner.email AS email_slp_alias, stage AS stage_slp_alias, dispositions AS disp_slp_alias, sub_disposition AS sub_slp_alias, COUNT(*) AS n_slp_alias FROM lead WHERE created_at >= (date_part('epoch', TIMESTAMP '2026-04-01 00:00:00' AT TIME ZONE 'Asia/Kolkata')*1000) GROUP BY owner.name, owner.email, stage, dispositions, sub_disposition LIMIT 5000

The result is large and will be saved to a file rather than returned inline. That is expected. Read it with python or jq, not by pasting it into context. Schema: {records: {records: [{...}]}}.

If SuperLeap is unreachable or the query errors, STOP. Write nothing. The workbook keeps its last good payload, which is far better than overwriting it with a partial one. Say so in one line and end.

STEP 2 - build the payload.
Aggregate the rows into this exact shape and write it as compact JSON (no spaces, separators (',',':')):

{
 "snapshot": "<ISO 8601 timestamp, Asia/Kolkata +05:30, of when the query actually ran>",
 "from": "1 Apr 2026",
 "disp":  [[agentName, email, disposition, count], ...],
 "stage": [[agentName, stage, count], ...],
 "sub":   [[agentName, subDisposition, count], ...]
}

Rules that matter:
- agentName is owner.name; use "(no owner)" when it is null.
- In "disp", a null disposition MUST be sent as the empty string "". The reader turns "" into "Not dispositioned yet". Do not send the word null and do not drop those rows - they are roughly half the leads.
- In "disp", send the email only on an agent's FIRST row and "" on their later rows. The reader keeps the first non-blank one. This is purely to keep the file small.
- "sub" only includes rows where sub_disposition is set.
- Sort each array so the file is stable between runs.
- Sanity check before writing: the counts in "disp" must sum to the total row count of the query. If they do not, stop and do not write.

STEP 3 - deliver it.
Use the Google Drive MCP tool create_file with:
  title: slp_payload.json
  contentMimeType: text/plain
  disableConversionToGoogleType: true
  parentId: 1CC_abng7CqZbMaSWmj7xOPrbgasTjeTq
  textContent: the JSON string from step 2

That folder is shared by the workbook owner specifically for this. Do not write anywhere else in Drive and do not touch any spreadsheet.

The Apps Script side picks it up on its own timer: it reads the newest slp_payload.json in that folder, rebuilds the "SuperLeap Churn" and "SuperLeap Stage" tabs, and bins older payloads. You do not need to trigger anything in the workbook, and you must never edit the workbook directly.

STEP 4 - report in one line: the snapshot time, the total lead count, and the row counts for disp/stage/sub. Nothing more.
